/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Process Route
 * Process the proposed route for a drone operation and assess its feasibility.
 * Implements population-aware route optimization.
 */

import { logger, chunkArray, Point, getRouteGeoHashes, getPointsNearRoute } from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDistance, getRhumbLineBearing, computeDestinationPoint } from 'geolib';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const PARTITION_KEY_HASH_PRECISION = parseFloat(process.env.PARTITION_KEY_HASH_PRECISION || '5');
const STEP_DISTANCE = 1000; // Distance in meters for each step
const ANGLE_RANGE = 30; // Maximum deviation angle in degrees
const SEARCH_ITERATIONS = 10; // Number of angles to try at each step

/**
 * Finds an optimised route between two points that minimizes exposure to populated areas.
 * Uses a step-by-step approach, evaluating multiple possible directions at each step.
 */
async function findOptimisedRoute(startPoint: Point, endPoint: Point, spatialData: any[]): Promise<Point[]> {
  const route: Point[] = [startPoint];
  let currentPoint = startPoint;

  while (getDistance(currentPoint, endPoint) > STEP_DISTANCE) {
    const directBearing = getRhumbLineBearing(currentPoint, endPoint);
    let bestNextPoint = currentPoint;
    let minPopulation = Number.MAX_VALUE;

    // Try different angles within the allowed range
    for (let i = 0; i < SEARCH_ITERATIONS; i++) {
      const angle = directBearing + ANGLE_RANGE * ((2 * i) / (SEARCH_ITERATIONS - 1) - 1);
      const candidatePoint = computeDestinationPoint(
        { latitude: currentPoint.lat, longitude: currentPoint.lon },
        STEP_DISTANCE,
        angle,
      );
      const nextPoint = { lat: candidatePoint.latitude, lon: candidatePoint.longitude };

      // Evaluate population impact for this step
      const nearbyPoints = getPointsNearRoute(currentPoint, nextPoint, spatialData);
      const populationImpact = nearbyPoints
        .filter((p) => p.type === 'Population')
        .reduce((sum, point) => sum + (point.population || 0), 0);

      if (populationImpact < minPopulation) {
        minPopulation = populationImpact;
        bestNextPoint = nextPoint;
      }
    }

    route.push(bestNextPoint);
    currentPoint = bestNextPoint;
  }

  // Add the endpoint to complete the route
  route.push(endPoint);
  return route;
}

export const handler = async (event: any) => {
  logger.info('Processing Drone Operation Proposed Route', { event });

  // If this is processing a request from API Gateway, the parameters will be in the event object
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      event.latStart = body.latStart;
      event.lonStart = body.lonStart;
      event.latEnd = body.latEnd;
      event.lonEnd = body.lonEnd;
    } catch (err) {
      logger.error('Error parsing request body', { error: err });
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid request body.' }),
      };
    }
  }

  const { latStart, lonStart, latEnd, lonEnd } = event;
  if ([latStart, lonStart, latEnd, lonEnd].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing bounding box parameters.' }),
    };
  }

  const startPoint: Point = { lat: latStart, lon: lonStart };
  const endPoint: Point = { lat: latEnd, lon: lonEnd };

  // Step 1: Get all GeoHash prefixes covering the bounding box
  const hashPrefixes = getRouteGeoHashes(startPoint, endPoint, PARTITION_KEY_HASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the route', { count: hashPrefixes.length });

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
  logger.info('Queried Results from GeoHashes', { count: results.length });

  // Step 3: Find optimised route
  const optimisedRoute = await findOptimisedRoute(startPoint, endPoint, results);
  logger.info('Optimised Route Generated', {
    numberOfPoints: optimisedRoute.length,
    totalDistance: optimisedRoute.reduce((sum, point, i) => {
      if (i === 0) return 0;
      return sum + getDistance(optimisedRoute[i - 1], point);
    }, 0),
  });

  // Step 4: Evaluate the optimised route
  let totalPopulationImpact = 0;
  for (let i = 0; i < optimisedRoute.length - 1; i++) {
    const segmentStart = optimisedRoute[i];
    const segmentEnd = optimisedRoute[i + 1];
    const nearbyPoints = getPointsNearRoute(segmentStart, segmentEnd, results);
    const segmentPopulation = nearbyPoints
      .filter((p) => p.type === 'Population')
      .reduce((sum, point) => sum + (point.population || 0), 0);
    totalPopulationImpact += segmentPopulation;
  }

  logger.info('Route Evaluation Complete', {
    totalPopulationImpact: Math.round(totalPopulationImpact),
    routePoints: optimisedRoute,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      route: optimisedRoute,
      populationImpact: Math.round(totalPopulationImpact),
    }),
    isBase64Encoded: false,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
    },
  };
};
