/*
 * Process New Route Lambda Function
 *
 * This Lambda function is triggered by a DynamoDB stream event to process new drone operation routes.
 * It is only triggered when a new route is created in the DynamoDB table. (INSERT operation)
 *
 * The function retrieves relevant data from the DynamoDB table and finds an optimised path that minimizes exposure to populated areas.
 * It makes use of the A* style search algorithm with deviation constraints.
 * Core logic for the algorithm is contained in the shared route-engine module.
 *
 * Once the optimised route is found, it saves the route details back to the DynamoDB table and creates an AppSync event to notify other services.
 *
 * This software is licensed under the GNU General Public License v3.0.
 */

import {
  logger,
  Point,
  getRouteGeoHashes,
  getPointsNearRoute,
  fetchGeoHashItemsFromDynamoDB,
  findOptimisedRoute,
  getRouteDistance,
  assessPopulationImpact,
  assessNoiseImpact,
  assessWeatherImpact,
} from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

const ROUTES_TABLE = process.env.ROUTES_TABLE;
const APPSYNC_EVENTS_HTTP_DOMAIN = process.env.APPSYNC_EVENTS_HTTP_DOMAIN;
const APPSYNC_EVENTS_API_KEY = process.env.APPSYNC_EVENTS_API_KEY;

const client = new DynamoDBClient();
const ddb = DynamoDBDocumentClient.from(client);

const PARTITION_KEY_HASH_PRECISION = parseFloat(process.env.PARTITION_KEY_HASH_PRECISION || '5');

export const handler = async (event: DynamoDBStreamEvent): Promise<undefined> => {
  logger.info('Processing Drone Operation Route Optimisation', { event });

  // Parse and unmarshall the DynamoDB stream event
  if (!event.Records || event.Records.length === 0) {
    logger.error('No valid records found in the event');
    return undefined;
  }

  const payload = event.Records[0]?.dynamodb?.NewImage;
  if (!payload) {
    logger.error('No NewImage found in DynamoDB stream record');
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeRecord = unmarshall(payload as any);
  logger.info('Parsed Route Record', { routeRecord });

  // Setup the start and end points
  const startPoint: Point = {
    lat: routeRecord.routePoints[0]?.lat || 0,
    lon: routeRecord.routePoints[0]?.lon || 0,
  };
  const endPoint: Point = {
    lat: routeRecord.routePoints[1]?.lat || 0,
    lon: routeRecord.routePoints[1]?.lon || 0,
  };

  // Step 1: Get all GeoHash prefixes covering the route
  const hashPrefixes = getRouteGeoHashes(startPoint, endPoint, PARTITION_KEY_HASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the route', { count: hashPrefixes.length });

  // Step 2: Query DynamoDB for items in the geohashes
  const results = await fetchGeoHashItemsFromDynamoDB(ddb, hashPrefixes);
  logger.info('Queried Results from GeoHashes', { count: results.length });

  // Step 3: Find optimised route
  const optimisedRoute = await findOptimisedRoute(startPoint, endPoint, results);

  // Step 4: Evaluate the optimised route
  const routeDistance = await getRouteDistance(optimisedRoute);
  const routePointsOfInterest = getPointsNearRoute(optimisedRoute, results);
  const populationImpact = await assessPopulationImpact(routePointsOfInterest);
  const noiseImpact = await assessNoiseImpact(populationImpact);
  const { visibilityRisk, windRisk } = await assessWeatherImpact(routePointsOfInterest);

  logger.info('Route Evaluation Complete', {
    routeDistance: routeDistance,
    populationImpact: populationImpact,
    noiseImpactScore: noiseImpact,
    visibilityRisk: visibilityRisk,
    windRisk: windRisk,
  });

  // Step 5: Save the optimised route back to DynamoDB.
  // This creates an update record in the routes table, so does not trigger this Lambda again.
  const params = new UpdateCommand({
    TableName: ROUTES_TABLE,
    Key: {
      PK: routeRecord.PK,
    },
    UpdateExpression: `SET 
      optimisedRoute = :optimisedRoute,
      optimisedRouteDistance = :optimisedRouteDistance,
      populationImpact = :populationImpact,
      noiseImpact = :noiseImpact,
      visibilityRisk = :visibilityRisk,
      windRisk = :windRisk`,
    ExpressionAttributeValues: {
      ':optimisedRoute': optimisedRoute,
      ':optimisedRouteDistance': routeDistance,
      ':populationImpact': populationImpact,
      ':noiseImpact': noiseImpact,
      ':visibilityRisk': visibilityRisk,
      ':windRisk': windRisk,
    },
  });
  await ddb.send(params);
  logger.info('Optimised route saved to DynamoDB', { PK: routeRecord.PK });

  // Step 6: Create an AppSync event to notify other services
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (APPSYNC_EVENTS_API_KEY) {
    headers['x-api-key'] = APPSYNC_EVENTS_API_KEY;
  }

  const appsyncEventPostResult = await fetch(`https://${APPSYNC_EVENTS_HTTP_DOMAIN}/event`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channel: 'default/routes',
      events: [
        JSON.stringify({
          type: 'routeOptimised',
          data: {
            id: routeRecord.PK,
            route: optimisedRoute,
            routeDistance,
            populationImpact,
            ...(noiseImpact !== undefined && { noiseImpactScore: noiseImpact }),
            ...(visibilityRisk !== undefined && { visibilityRisk: visibilityRisk }),
            ...(windRisk !== undefined && { windRisk: windRisk }),
          },
        }),
      ],
    }),
  });
  if (!appsyncEventPostResult.ok) {
    logger.error('Failed to post event to AppSync', {
      status: appsyncEventPostResult.status,
      statusText: appsyncEventPostResult.statusText,
    });
  } else {
    logger.info('AppSync event posted successfully');
  }
};
