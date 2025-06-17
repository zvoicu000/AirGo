/*
 * Process Route
 * Process the proposed route for a drone operation and assess its feasibility.
 */

import { logger, chunkArray } from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as geohash from 'ngeohash';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const GEOHASH_PRECISION = 5; // Approx 5km resolution for partitioning

interface BoundingBoxEvent {
  latMin: number;
  lonMin: number;
  latMax: number;
  lonMax: number;
}

export const handler = async (event: BoundingBoxEvent) => {
  const { latMin, lonMin, latMax, lonMax } = event;
  logger.info('Processing Drone Operation Proposed Route', { event });

  if ([latMin, lonMin, latMax, lonMax].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = geohash.bboxes(latMin, lonMin, latMax, lonMax, GEOHASH_PRECISION);
  logger.info('Geohash Prefixes', { count: hashPrefixes.length });

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

  // Step 3: Optional — post-filter results to strict bounding box
  const filtered = results.filter((item) => {
    return item.lat >= latMin && item.lat <= latMax && item.lon >= lonMin && item.lon <= lonMax;
  });

  logger.info('Filtered Results', { count: filtered.length });

  return {
    statusCode: 200,
    body: JSON.stringify(filtered),
  };
};
