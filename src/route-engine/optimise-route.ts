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
const GEOHASH_PRECISION = parseFloat(process.env.GEOHASH_PRECISION || '5');
const STEP_DISTANCE = 1000; // Distance in meters for each step
const ANGLE_RANGE = 30; // Maximum deviation angle in degrees
const SEARCH_ITERATIONS = 10; // Number of angles to try at each step

/**
 * Finds an optimized route between two points that minimizes exposure to populated areas.
 * Uses a step-by-step approach, evaluating multiple possible directions at each step.
 */
async function findOptimizedRoute(startPoint: Point, endPoint: Point, spatialData: any[]): Promise<Point[]> {
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

  // Step 3: Find optimized route
  const optimizedRoute = await findOptimizedRoute(startPoint, endPoint, results);
  logger.info('Optimized Route Generated', {
    numberOfPoints: optimizedRoute.length,
    totalDistance: optimizedRoute.reduce((sum, point, i) => {
      if (i === 0) return 0;
      return sum + getDistance(optimizedRoute[i - 1], point);
    }, 0),
  });

  // Step 4: Evaluate the optimized route
  let totalPopulationImpact = 0;
  for (let i = 0; i < optimizedRoute.length - 1; i++) {
    const segmentStart = optimizedRoute[i];
    const segmentEnd = optimizedRoute[i + 1];
    const nearbyPoints = getPointsNearRoute(segmentStart, segmentEnd, results);
    const segmentPopulation = nearbyPoints
      .filter((p) => p.type === 'Population')
      .reduce((sum, point) => sum + (point.population || 0), 0);
    totalPopulationImpact += segmentPopulation;
  }

  logger.info('Route Evaluation Complete', {
    totalPopulationImpact: Math.round(totalPopulationImpact),
    routePoints: optimizedRoute,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      route: optimizedRoute,
      populationImpact: Math.round(totalPopulationImpact),
    }),
  };
};
