/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Assess Route
 * Process the proposed route for a drone operation and assess its feasibility.
 */

import {
  logger,
  Point,
  getRouteGeoHashes,
  getPointsNearRoute,
  fetchGeoHashItemsFromDynamoDB,
  assessPopulationImpact,
  getRouteDistance,
  assessNoiseImpact,
  assessWeatherImpact,
  RETURN_HEADERS,
} from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const PARTITION_KEY_HASH_PRECISION = parseFloat(process.env.PARTITION_KEY_HASH_PRECISION || '5');

export const handler = async (event: any) => {
  logger.info('Processing Drone Operation Assess Route', { event });
  const startPoint: Point = { lat: event.latStart, lon: event.lonStart };
  const endPoint: Point = { lat: event.latEnd, lon: event.lonEnd };

  // If the route parameters are in the queryStringParameters, set them now
  if (event.queryStringParameters) {
    const { latStart, lonStart, latEnd, lonEnd } = event.queryStringParameters;
    if (latStart && lonStart && latEnd && lonEnd) {
      startPoint.lat = parseFloat(latStart);
      startPoint.lon = parseFloat(lonStart);
      endPoint.lat = parseFloat(latEnd);
      endPoint.lon = parseFloat(lonEnd);
    }
  }

  // Ensure all route parameters are provided
  if ([startPoint.lat, startPoint.lon, endPoint.lat, endPoint.lon].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing route parameters.' }),
    };
  }

  // Step 1: Get all GeoHash prefixes covering the route
  const hashPrefixes = getRouteGeoHashes(startPoint, endPoint, PARTITION_KEY_HASH_PRECISION);
  logger.info('Geohash Prefixes intercepting the route', { count: hashPrefixes.length });

  // Step 2: Query DynamoDB for items in the geohashes
  const results = await fetchGeoHashItemsFromDynamoDB(ddb, hashPrefixes);
  logger.info('Queried Results from GeoHashes', { count: results.length });

  // Step 3: Evaluate the route
  const routeDistance = await getRouteDistance(startPoint, endPoint);
  const routePointsOfInterest = getPointsNearRoute(startPoint, endPoint, results);
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

  return {
    body: JSON.stringify({
      routeDistance: routeDistance,
      populationImpact: populationImpact,
      ...(noiseImpact && { noiseImpactScore: noiseImpact }),
      ...(visibilityRisk && { visibilityRisk: visibilityRisk }),
      ...(windRisk && { windRisk: windRisk }),
    }),
    ...RETURN_HEADERS,
  };
};
