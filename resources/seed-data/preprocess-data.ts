/* eslint-disable no-console */
/**
 * Extracts population data from a GeoTIFF and converts it into a DynamoDB-compatible format.
 * The output is a gzipped newline-delimited JSON file suitable for S3 import into DynamoDB.
 *
 * Functionality:
 * - Parses a British National Grid (EPSG:27700) GeoTIFF containing population data.
 * - Transforms coordinates to WGS84 (EPSG:4326).
 * - Handles invalid or missing population values (sets NaN to 0).
 * - Rounds population values to 1 decimal place.
 * - Generates DynamoDB items with:
 *   - PK: GeoHash (precision 6)
 *   - SK: 'POP#' + GeoHash (precision 8)
 *   - lat/lon (6 decimal precision)
 *   - population
 * - Marshals records into DynamoDB JSON format and writes them as newline-delimited JSON.
 *
 * Usage:
 *   1. Install dependencies:
 *      npm install
 *
 *   2. Run the script:
 *      npm run preprocess
 *
 *   3. Output will be written to:
 *      resources/seed-data/population-data/processed/uk-population-data.json.gzip
 *      (This file format can be used for direct DynamoDB seeding on creation via S3)
 */

import fs from 'fs';
import zlib from 'zlib';
import proj4 from 'proj4';
import ngeohash from 'ngeohash';
import { fromArrayBuffer } from 'geotiff';
import { marshall } from '@aws-sdk/util-dynamodb';





// Define EPSG:3035 (ETRS89 / LAEA Europe)
proj4.defs(
  'EPSG:3035',
  '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs'
);

const EU_LAEA = 'EPSG:3035';
const WGS84 = 'EPSG:4326';
const PARTITION_KEY_HASH_PRECISION = 5; // GeoHash precision for partition key (approx 5km resolution)
const SORT_KEY_HASH_PRECISION = 8; // GeoHash precision for sort key (approx 50m resolution)
const GSI_HASH_PRECISION = 4; // GeoHash precision for GSI partition key (approx 40km resolution)
const INPUT_FILE = 'resources/seed-data/population-data/input/rou_ppp_2019_1km_Aggregated.tif';
const OUTPUT_FILE = 'resources/seed-data/population-data/processed/rou_ppp_2019_1km_Aggregated.json.gzip';

// Romania bounding box (approximate)
const areaOfInterest = {
  minLat: 43.6,   // Southern Romania
  maxLat: 48.3,   // Northern Romania
  minLon: 20.3,   // Western Romania
  maxLon: 29.7,   // Eastern Romania
};

/**
 * Calculates the 95th percentile value from an array of population numbers.
 *
 * The function sorts the input array in ascending order and returns the value at the 95th percentile index.
 * If the input array is empty, it returns 0.
 *
 * @param populations - An array of numbers representing population values.
 * @returns The value at the 95th percentile of the sorted array, or 0 if the array is empty.
 */
function get95thPercentile(inputPopulations: Float32Array | Uint16Array | Int32Array): number {
  const populations: number[] = [];
  for (let i = 0; i < inputPopulations.length; i++) {
    const value = inputPopulations[i];
    if (isNaN(value)) continue; // Don't include zero values in the assessment
    populations.push(value);
  }

  if (populations.length === 0) return 0;
  const sorted = populations.slice().sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[index];
}

/**
 * Extracts population data from a GeoTIFF raster file, processes it, and writes the results
 * in DynamoDB-compatible format to a gzipped output file.
 *
 * The function reads the raster data, determines the 95th percentile of population values,
 * and for each cell, transforms its coordinates from British National Grid (BNG) to WGS84.
 * It then encodes the location into geohashes for partition and sort keys, marshals the data
 * for DynamoDB, and writes each item as a JSON line to a gzip-compressed output file.
 *
 * Cells with population values above the 95th percentile are additionally indexed with
 * GSI1PK and GSI2SK attributes for DynamoDB secondary indexes. This is useful for
 * querying high-interest geospatial items efficiently.
 *
 * @param tifPath - The file path to the input GeoTIFF raster file containing population data.
 * @returns A Promise that resolves when the extraction and writing process is complete.
 * @throws If georeferencing metadata (origin or resolution) is missing from the raster.
 */
async function extractPopulationData(tifPath: string): Promise<void> {
  const buffer = fs.readFileSync(tifPath);
  const tiff = await fromArrayBuffer(buffer.buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters({ interleave: true });
  const values = rasters as Float32Array | Uint16Array | Int32Array;

  const width = image.getWidth();
  const height = image.getHeight();
  const origin = image.getOrigin(); // [x, y] = [easting, northing]
  const resolution = image.getResolution(); // [xRes, yRes]
  const noData = image.getGDALNoData();

  const processingStats = {
    areasInSourceData: 0,
    areasWithinAreasOfInterest: 0,
    areasWithNonZeroPopulationData: 0,
    ninetyFifthPercentilePopulation: 0,
    areasWithGreaterThanNinetyFifthPercentilePopulation: 0,
  };

  if (!origin || !resolution) {
    throw new Error('Missing georeferencing metadata.');
  }

  const [originX, originY] = origin;
  const [xRes, yRes] = resolution;

  // Log the metadata of the raster
  console.log({ origin, resolution, bbox: image.getBoundingBox() });

  // Output file to gzip format
  const fileStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
  const gzipStream = zlib.createGzip();
  gzipStream.pipe(fileStream);

  // Pre-process the data to determine what value represents the population at the 95% percentile
  const population95thPercentile = get95thPercentile(values);
  processingStats.ninetyFifthPercentilePopulation = population95thPercentile;

  // Iterate through the raster data and convert to DynamoDB format
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let value = values[idx];
      processingStats.areasInSourceData++;

      if (noData !== undefined && value === noData) continue;

      // Handle NaN → 0 and round to 1 decimal place
      if (isNaN(value)) value = 0;
      value = Math.round(value * 10) / 10;
      if (value > 0) processingStats.areasWithNonZeroPopulationData++;
      const highInterest = value > population95thPercentile;
      if (highInterest) processingStats.areasWithGreaterThanNinetyFifthPercentilePopulation++;

      const easting = originX + (x + 0.5) * xRes;
      const northing = originY + (y + 0.5) * yRes;

  const [lon, lat] = [easting, northing];

      // If the coordinates are outside the area of interest, skip them
      // This is done to reduce the number of items written to DynamoDB and save time on initial deployment
      if (
        lat < areaOfInterest.minLat ||
        lat > areaOfInterest.maxLat ||
        lon < areaOfInterest.minLon ||
        lon > areaOfInterest.maxLon
      ) {
        continue;
      }

      processingStats.areasWithinAreasOfInterest++;

      const item = {
        PK: ngeohash.encode(lat, lon, PARTITION_KEY_HASH_PRECISION),
        SK: `POP#${ngeohash.encode(lat, lon, SORT_KEY_HASH_PRECISION)}`,
        ...(highInterest && { GSI1PK: ngeohash.encode(lat, lon, GSI_HASH_PRECISION) }),
        ...(highInterest && { GSI1SK: `POP#${ngeohash.encode(lat, lon, SORT_KEY_HASH_PRECISION)}` }),
        type: 'Population',
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        population: value,
      };

      const marshalled = marshall(item);
      gzipStream.write(JSON.stringify({ Item: marshalled }) + '\n');

    }
  }

  console.log('Finished processing. Final stats:');
  console.dir(processingStats);

  gzipStream.end();
  fileStream.on('finish', () => {
    console.log(`Output written to ${OUTPUT_FILE}`);
  });
}

extractPopulationData(INPUT_FILE).catch(console.error);
