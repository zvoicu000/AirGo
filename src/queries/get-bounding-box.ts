/*
 * Get Bounding Box
 * Query all geospatial objects within a given bounding box using geohash-based queries.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { logger, BoundingBox, getBoundingBoxGeoHashes, RETURN_HEADERS, fetchGeoHashItemsFromDynamoDB } from '../shared';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const GSI_HASH_PRECISION = parseFloat(process.env.GSI_HASH_PRECISION || '4');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  logger.info('Processing Bounding Box Query', { event });
  const boundingBox: BoundingBox = {
    latMin: event.latMin,
    lonMin: event.lonMin,
    latMax: event.latMax,
    lonMax: event.lonMax,
  };

  // If the bounding box parameters are in the queryStringParameters, set them now
  if (event.queryStringParameters) {
    const { latMin, lonMin, latMax, lonMax } = event.queryStringParameters;
    if (latMin && lonMin && latMax && lonMax) {
      boundingBox.latMin = parseFloat(latMin);
      boundingBox.lonMin = parseFloat(lonMin);
      boundingBox.latMax = parseFloat(latMax);
      boundingBox.lonMax = parseFloat(lonMax);
    }
  }

  // Ensure all bounding box parameters are provided
  if ([boundingBox.latMin, boundingBox.lonMin, boundingBox.latMax, boundingBox.lonMax].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = getBoundingBoxGeoHashes(boundingBox, GSI_HASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the bounding box', { count: hashPrefixes.length });

  // Step 2: Query DynamoDB for each geohash prefix
  const results = await fetchGeoHashItemsFromDynamoDB(ddb, hashPrefixes, true);
  logger.info('Queried Results from GeoHashes', { count: results.length });

  // Step 3: Filter results to ensure they are within the bounding box
  const { latMin, lonMin, latMax, lonMax } = boundingBox;
  const filteredResults = results.filter((item) => {
    return item.lat >= latMin && item.lat <= latMax && item.lon >= lonMin && item.lon <= lonMax;
  });
  logger.info('Filtered Results within Bounding Box', { count: filteredResults.length });

  return {
    body: JSON.stringify({
      items: filteredResults,
      count: filteredResults.length,
    }),
    ...RETURN_HEADERS,
  };
};
