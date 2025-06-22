/*
 * Get Bounding Box
 * Query all geospatial objects within a given bounding box using geohash-based queries.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as geohash from 'ngeohash';
import { logger, chunkArray, BoundingBox } from '../shared';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const GEOHASH_PRECISION = parseFloat(process.env.GEOHASH_PRECISION || '5');

export const handler = async (event: BoundingBox) => {
  const { latMin, lonMin, latMax, lonMax } = event;
  logger.info('Processing Bounding Box Query', { event });

  if ([latMin, lonMin, latMax, lonMax].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = geohash.bboxes(latMin, lonMin, latMax, lonMax, GEOHASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the bounding box', { count: hashPrefixes.length });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];

  // Step 2: Process in chunks of 50 to avoid overwhelming DynamoDB
  const chunks = chunkArray(hashPrefixes, 50);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (prefix) => {
        try {
          const command = new QueryCommand({
            TableName: SPATIAL_DATA_TABLE,
            KeyConditionExpression: 'GSI1PK = :pk',
            IndexName: 'GSI1',
            ExpressionAttributeValues: {
              ':pk': prefix,
            },
          });

          const response = await ddb.send(command);
          if (response.Items) {
            // logger.debug(`Found ${response.Items.length} items for prefix ${prefix}`, { prefix });
            // Filter points to ensure they are actually within the bounding box
            // (geohash boxes can extend beyond the requested bounding box)
            const filteredItems = response.Items.filter((item) => {
              return item.lat >= latMin && item.lat <= latMax && item.lon >= lonMin && item.lon <= lonMax;
            });
            results.push(...filteredItems);
          }
        } catch (err) {
          logger.error(`Error querying prefix ${prefix}`, { error: err });
        }
      }),
    );
  }
  logger.info('Found items within bounding box', { count: results.length });

  return {
    statusCode: 200,
    body: JSON.stringify({
      items: results,
      count: results.length,
    }),
  };
};
