/*
 * Get Bounding Box Lambda Function
 *
 * This Lambda function is triggered by API Gateway to get locations of interest within a specified bounding box.
 * This is used to display items on the map view
 * It uses the sparsely populated Global Secondary Index (GSI) of DynamoDB, which has a lower precision geohash
 * to efficiently query items that fall within the bounding box.
 *
 * This software is licensed under the GNU General Public License v3.0.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { logger, BoundingBox, getBoundingBoxGeoHashes, RETURN_HEADERS, fetchGeoHashItemsFromDynamoDB } from '../shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const GSI_HASH_PRECISION = parseFloat(process.env.GSI_HASH_PRECISION || '4');

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Processing Bounding Box Query', { event });

  // Ensure all bounding box parameters are provided
  if (
    [
      event.queryStringParameters?.latMin,
      event.queryStringParameters?.lonMin,
      event.queryStringParameters?.latMax,
      event.queryStringParameters?.lonMax,
    ].some((v) => v === undefined)
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  // Setup the bounding box object
  const boundingBox: BoundingBox = {
    latMin: event.queryStringParameters?.latMin ? parseFloat(event.queryStringParameters?.latMin) : 0,
    lonMin: event.queryStringParameters?.lonMin ? parseFloat(event.queryStringParameters?.lonMin) : 0,
    latMax: event.queryStringParameters?.latMax ? parseFloat(event.queryStringParameters?.latMax) : 0,
    lonMax: event.queryStringParameters?.lonMax ? parseFloat(event.queryStringParameters?.lonMax) : 0,
  };

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = getBoundingBoxGeoHashes(boundingBox, GSI_HASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the bounding box', { count: hashPrefixes.length });

  // Step 2: Query DynamoDB for each geohash prefix
  const results = await fetchGeoHashItemsFromDynamoDB(ddb, hashPrefixes, true);
  logger.info('Queried Results from GeoHashes', { count: results.length });

  // Step 3: Filter results to ensure they are within the bounding box
  const filteredResults = results.filter((item) => {
    return (
      item.lat >= boundingBox.latMin! &&
      item.lat <= boundingBox.latMax! &&
      item.lon >= boundingBox.lonMin! &&
      item.lon <= boundingBox.lonMax!
    );
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
