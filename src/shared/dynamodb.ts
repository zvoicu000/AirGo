/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../shared';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const MAXIMUM_DYNAMODB_FETCH = 10; // Maximum number of fetches to prevent infinite loops
const DYNAMODB_FETCH_LIMIT = 1000; // Maximum items to fetch per request

export async function performGeospatialQueryCommand(ddb: DynamoDBDocumentClient, geoHash: string): Promise<any[]> {
  let lastEvaluatedKey = undefined;
  const returnData: any[] = [];
  for (let index = 0; index < MAXIMUM_DYNAMODB_FETCH; index++) {
    const params = new QueryCommand({
      TableName: SPATIAL_DATA_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': geoHash,
      },
      Limit: DYNAMODB_FETCH_LIMIT,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const data: any = await ddb.send(params);
    lastEvaluatedKey = data.LastEvaluatedKey;
    if (data === false) return [];
    if (data.Items.length > 0) returnData.push(...data.Items);
    if (lastEvaluatedKey === undefined) break;
  }
  logger.debug('Successfully retrieved record(s) from DynamoDB Query', {
    numberOfRecords: returnData.length,
  });
  return returnData;
}
