/*
 * Optimise Route Lambda Function
 *
 * This Lambda function is triggered by API Gateway to process a drone operation route
 * and find an optimised path that minimizes exposure to populated areas.
 * It makes use of the A* style search algorithm with deviation constraints.
 * Core logic for the algorithm is contained in the shared route-engine module.
 *
 * This software is licensed under the GNU General Public License v3.0.
 */

import { logger, Point, RETURN_HEADERS, createRouteRecord } from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Processing Drone Operation Route Optimisation', { event });

  // Ensure all route parameters are provided
  const payload = event.body ? JSON.parse(event.body) : {};
  if (
    [payload.startPoint?.lat, payload.startPoint?.lon, payload.endPoint?.lat, payload.endPoint?.lon].some(
      (v) => v === undefined,
    )
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing route parameters.' }),
    };
  }

  // Setup the start and end points
  const startPoint: Point = {
    lat: payload.startPoint?.lat || 0,
    lon: payload.startPoint?.lon || 0,
  };
  const endPoint: Point = {
    lat: payload.endPoint?.lat || 0,
    lon: payload.endPoint?.lon || 0,
  };

  // Create a new record in the routes table for this request
  const routeId = await createRouteRecord(ddb, [startPoint, endPoint]);

  return {
    body: JSON.stringify({
      message: 'Route optimisation started successfully.',
      routeId: routeId,
    }),
    ...RETURN_HEADERS,
  };
};
