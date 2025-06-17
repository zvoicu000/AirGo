/*
 * Process Route
 * Process the proposed route for a drone operation and assess its feasibility.
 */

import { logger, chunkArray, Point, getRouteGeoHashes, getPointsNearRoute } from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const GEOHASH_PRECISION = parseFloat(process.env.GEOHASH_PRECISION || '5');

interface RouteEvent {
  latStart: number;
  lonStart: number;
  latEnd: number;
  lonEnd: number;
}

export const handler = async (event: RouteEvent) => {
  const { latStart, lonStart, latEnd, lonEnd } = event;
  logger.info('Processing Drone Operation Proposed Route', { event });

  if ([latStart, lonStart, latEnd, lonEnd].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  const startPoint: Point = { lat: latStart, lon: lonStart };
  const endPoint: Point = { lat: latEnd, lon: lonEnd };

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = getRouteGeoHashes(startPoint, endPoint, GEOHASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the route', { count: hashPrefixes.length });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];

  // Step 2: Process in chunks of 50
  const chunks = chunkArray(hashPrefixes, 50);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (prefix) => {
        try {
          const command = new QueryCommand({
            TableName: SPATIAL_DATA_TABLE,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
              ':pk': prefix,
            },
          });

          const response = await ddb.send(command);
          if (response.Items) {
            results.push(...response.Items);
          }
        } catch (err) {
          logger.error(`Error querying prefix ${prefix}`, { error: err });
        }
      }),
    );
  }
  logger.info('Queried Results', { count: results.length });

  // Find the geoPoints that are within the route
  const nearbyPoints = getPointsNearRoute(startPoint, endPoint, results);
  logger.info('Points near the route', { count: nearbyPoints.length });

  return {
    statusCode: 200,
  };
};
