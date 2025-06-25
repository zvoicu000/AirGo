/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Assess Route
 * Process the proposed route for a drone operation and assess its feasibility.
 */

import { logger, chunkArray, Point, getRouteGeoHashes, getPointsNearRoute } from '../shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDistance } from 'geolib';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const PARTITION_KEY_HASH_PRECISION = parseFloat(process.env.PARTITION_KEY_HASH_PRECISION || '5');

export const handler = async (event: any) => {
  logger.info('Processing Drone Operation Proposed Route', { event });

  // If the bounding box parameters are in the queryStringParameters, set them now
  if (event.queryStringParameters) {
    const {
      latStart: queryLatStart,
      lonStart: queryLonStart,
      latEnd: queryLatEnd,
      lonEnd: queryLonEnd,
    } = event.queryStringParameters;
    if (queryLatStart && queryLonStart && queryLatEnd && queryLonEnd) {
      event.latStart = parseFloat(queryLatStart);
      event.lonStart = parseFloat(queryLonStart);
      event.latEnd = parseFloat(queryLatEnd);
      event.lonEnd = parseFloat(queryLonEnd);
    }
  }

  const { latStart, lonStart, latEnd, lonEnd } = event;
  if ([latStart, lonStart, latEnd, lonEnd].some((v) => v === undefined)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing route parameters.' }),
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

  // Step 3: Evaluate the route
  let totalPopulationImpact = 0;
  const nearbyPoints = getPointsNearRoute(startPoint, endPoint, results);
  const segmentPopulation = nearbyPoints
    .filter((p) => p.type === 'Population')
    .reduce((sum, point) => sum + (point.population * 0.1 || 0), 0);
  totalPopulationImpact += segmentPopulation;

  // Get the round trip distance in kilometers, to one decimal place
  const routeDistance = Number((getDistance(startPoint, endPoint) / 500).toFixed(1));
  logger.info('Route Distance', { distance: routeDistance });

  // Find the weather points neat the route
  let visibilityRisk = undefined;
  let windRisk = undefined;
  const weatherPoints = nearbyPoints.filter((p) => p.type === 'Weather');
  if (weatherPoints.length > 0) {
    for (const point of weatherPoints) {
      // Visibility risk is calculated up to 5 when the visibility is less than 1,000 meters
      const visibilityRiskValue = point.visibility < 1000 ? (1000 - point.visibility) / 200 : 0;
      visibilityRisk = visibilityRisk ? Math.max(visibilityRisk, visibilityRiskValue) : visibilityRiskValue;
      if (visibilityRiskValue > visibilityRisk) visibilityRisk = visibilityRiskValue;
      // Wind risk is calculated up to 5 when the wind speed is greater than 20 m/s
      const windRiskValue = point.windSpeed ? (point.windSpeed > 20 ? 5 : point.windSpeed / 4) : 0;
      windRisk = windRisk ? Math.max(windRisk, windRiskValue) : windRiskValue;
      if (windRiskValue > windRisk) windRisk = windRiskValue;
    }
  }
  visibilityRisk = visibilityRisk && Number(visibilityRisk.toFixed(1));
  windRisk = windRisk && Number(windRisk.toFixed(1));
  logger.info('Weather Risks', { visibilityRisk, windRisk });

  // Calculate the population impact score. This is score to one decimal place between 0 and 5
  // The maximum population impact is 5,000 people, so we scale it to a score out of 5
  const noiseImpactScore = Math.min(5, Math.max(0, Number((totalPopulationImpact / 1000).toFixed(1))));

  logger.info('Route Evaluation Complete', {
    routeDistance: routeDistance,
    totalPopulationImpact: Math.round(totalPopulationImpact),
    noiseImpactScore: noiseImpactScore,
    visibilityRisk: visibilityRisk,
    windRisk: windRisk,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      routeDistance: routeDistance,
      populationImpact: Math.round(totalPopulationImpact),
      ...(noiseImpactScore && { noiseImpactScore: noiseImpactScore }),
      ...(visibilityRisk && { visibilityRisk: visibilityRisk }),
      ...(windRisk && { windRisk: windRisk }),
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
