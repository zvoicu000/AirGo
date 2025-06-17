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
 *      resources/seed-data/population-data/processed/uk-population-data.gzip
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import * as proj4 from 'proj4';
import * as ngeohash from 'ngeohash';
import { fromArrayBuffer } from 'geotiff';
import { marshall } from '@aws-sdk/util-dynamodb';

// Manually define EPSG:27700 (British National Grid)
proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
);

const BNG = 'EPSG:27700';
const WGS84 = 'EPSG:4326';
const PARTITION_KEY_HASH_PRECISION = 5; // GeoHash precision for partition key
const SORT_KEY_HASH_PRECISION = 8; // GeoHash precision for sort key
const INPUT_FILE = 'resources/seed-data/population-data/input/uk-population-data.tif';
const OUTPUT_FILE = 'resources/seed-data/population-data/processed/uk-population-data.json.gzip';

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

  if (!origin || !resolution) {
    throw new Error('Missing georeferencing metadata.');
  }

  const [originX, originY] = origin;
  const [xRes, yRes] = resolution;

  // Output file to gzip format
  const fileStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
  const gzipStream = zlib.createGzip();
  gzipStream.pipe(fileStream);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let value = values[idx];

      if (noData !== undefined && value === noData) continue;

      // Handle NaN → 0 and round to 1 decimal place
      if (isNaN(value)) value = 0;
      value = Math.round(value * 10) / 10;

      const easting = originX + x * xRes;
      const northing = originY + y * yRes;

      const [lon, lat] = proj4(BNG, WGS84, [easting, northing]);

      const pk = ngeohash.encode(lat, lon, PARTITION_KEY_HASH_PRECISION);
      const sk = `POP#${ngeohash.encode(lat, lon, SORT_KEY_HASH_PRECISION)}`;

      const item = {
        PK: pk,
        SK: sk,
        type: 'Population',
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        population: value,
      };

      const marshalled = marshall(item);
      gzipStream.write(JSON.stringify({ Item: marshalled }) + '\n');
    }
  }

  gzipStream.end();
  fileStream.on('finish', () => {
    console.log(`Output written to ${OUTPUT_FILE}`);
  });
}

extractPopulationData(INPUT_FILE).catch(console.error);
