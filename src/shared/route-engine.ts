/* eslint-disable @typescript-eslint/no-explicit-any */
import * as geohash from 'ngeohash';
import { logger, chunkArray } from '../shared';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDistance, getRhumbLineBearing, computeDestinationPoint, getDistanceFromLine } from 'geolib';

const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const MAXIMUM_DYNAMODB_FETCH = 10; // Maximum number of fetches to prevent infinite loops
const DYNAMODB_FETCH_LIMIT = 1000; // Maximum items to fetch per request

export type Point = { lat: number; lon: number };
export type BoundingBox = { latMin: number; lonMin: number; latMax: number; lonMax: number };

/**
 * Calculates and returns an array of geohash strings that cover the specified bounding box.
 *
 * @param boundingBox - The bounding box defined by minimum and maximum latitude and longitude.
 * @param precision - The precision level of the geohash (default is 4).
 * @returns An array of geohash strings covering the bounding box.
 */
export function getBoundingBoxGeoHashes(boundingBox: BoundingBox, precision = 4): string[] {
  const { latMin, lonMin, latMax, lonMax } = boundingBox;
  logger.debug('Calculating geohashes for bounding box', { boundingBox });

  // Generate geohashes for the bounding box
  const hashes = geohash.bboxes(latMin, lonMin, latMax, lonMax, precision);
  logger.debug(`Generated ${hashes.length} geohashes for bounding box`, { hashes });

  return hashes;
}

/**
 * Generates a list of geohashes representing the route between two geographic points.
 *
 * The function computes geohashes along the straight path (rhumb line) from the start point to the end point,
 * at intervals specified by `stepMeters`. The geohash precision can be customized.
 * The start and end points are always included in the result.
 *
 * @param start - The starting geographic point with latitude and longitude.
 * @param end - The ending geographic point with latitude and longitude.
 * @param precision - The number of characters in the geohash (default is 5).
 * @param stepMeters - The distance in meters between each computed geohash along the route (default is 100).
 * @param bufferMeters - The buffer distance in meters around the route to include additional geohashes (default is 10,000).
 * @returns An array of unique geohash strings covering the route from start to end.
 */
export function getRouteGeoHashes(
  start: Point,
  end: Point,
  precision = 5,
  stepMeters = 1000, // 1km spacing for performance
  bufferMeters = 10000,
): string[] {
  const routeLength = getDistance(start, end); // in meters
  logger.debug(`Route length from start to end: ${routeLength} meters`, { start, end });

  const geoHashes = new Set<string>();

  // Always include start and end
  geoHashes.add(geohash.encode(start.lat, start.lon, precision));
  geoHashes.add(geohash.encode(end.lat, end.lon, precision));

  const bearing = getRhumbLineBearing(start, end);
  const steps = Math.floor(routeLength / stepMeters);

  for (let i = 0; i <= steps; i++) {
    const point = computeDestinationPoint(start, i * stepMeters, bearing);

    // Convert buffer radius from meters to degrees approximately
    const latBuffer = bufferMeters / 111000; // 1 deg ≈ 111 km
    const lonBuffer = bufferMeters / (111000 * Math.cos((point.latitude * Math.PI) / 180));

    const hashes = geohash.bboxes(
      point.latitude - latBuffer,
      point.longitude - lonBuffer,
      point.latitude + latBuffer,
      point.longitude + lonBuffer,
      precision,
    );

    hashes.forEach((h) => geoHashes.add(h));
  }

  return Array.from(geoHashes);
}

/**
 * Returns an array of geo points that are near the route defined by the start and end points.
 *
 * - For points of type `'Population'`, only those within 500 meters of the route are included.
 * - For points of type `'Weather'`, only those within 20,000 meters of the route are included.
 *
 * @param start - The starting point of the route.
 * @param end - The ending point of the route.
 * @param geoPoints - An array of geo points to check, each expected to have `lat`, `lon`, and `type` properties.
 * @returns An array of geo points that are near the route according to their type-specific distance thresholds.
 */
export function getPointsNearRoute(start: Point, end: Point, geoPoints: Array<any>): Array<any> {
  const results: Array<any> = [];
  const populationDistanceThreshold = 500; // Distance in meters
  const weatherDistanceThreshold = 20000; // Distance in meters

  const routeLength = getDistance(start, end); // in meters
  logger.debug(`Route length from start to end: ${routeLength} meters`, { start, end });

  for (const point of geoPoints) {
    if (point.lat && point.lon) {
      const distance = getDistanceFromLine(
        { latitude: point.lat, longitude: point.lon },
        { latitude: start.lat, longitude: start.lon },
        { latitude: end.lat, longitude: end.lon },
      );
      //logger.debug(`Distance from point to route: ${distance} meters`, { point });

      if (distance <= populationDistanceThreshold && point.type === 'Population') {
        results.push(point);
      }
      if (distance <= weatherDistanceThreshold && point.type === 'Weather') {
        results.push(point);
      }
    }
  }

  return results;
}

/**
 * Fetches items from a DynamoDB table for a list of geohash prefixes.
 *
 * Processes the provided geohash prefixes in chunks (batches) of 50, querying DynamoDB for each prefix in parallel.
 * Aggregates all items returned from the queries into a single array.
 * Logs errors for individual prefix queries and logs the total count of items retrieved.
 *
 * @param ddb - The DynamoDBDocumentClient instance used to send queries.
 * @param geoHashes - An array of geohash prefix strings to query.
 * @param useGSI1 - A boolean indicating whether to use the GSI1 index for the query (default is false).
 * @returns A promise that resolves to an array of items retrieved from DynamoDB.
 */
export async function fetchGeoHashItemsFromDynamoDB(
  ddb: DynamoDBDocumentClient,
  geoHashes: string[],
  useGSI1: boolean = false,
): Promise<any[]> {
  const results: any[] = [];
  // Step 2: Process in chunks of 50
  const chunks = chunkArray(geoHashes, 50);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (prefix) => {
        try {
          const response = await performGeospatialQueryCommand(ddb, prefix, useGSI1);
          if (response) results.push(...response);
        } catch (err) {
          logger.error(`Error querying prefix ${prefix}`, { error: err });
        }
      }),
    );
  }
  logger.info('Queried Results from GeoHashes', { count: results.length });
  return results;
}

/**
 * Performs a paginated geospatial query on a DynamoDB table using the provided geoHash as the partition key.
 * Fetches up to `MAXIMUM_DYNAMODB_FETCH` pages of results, each limited by `DYNAMODB_FETCH_LIMIT`.
 * Aggregates and returns all retrieved items as an array.
 *
 * @param ddb - The DynamoDBDocumentClient instance used to execute the query.
 * @param geoHash - The geohash string used as the partition key for the query.
 * @param useGSI1 - A boolean indicating whether to use the GSI1 index for the query (default is false).
 * @returns A promise that resolves to an array of items retrieved from the DynamoDB table.
 */
export async function performGeospatialQueryCommand(
  ddb: DynamoDBDocumentClient,
  geoHash: string,
  useGSI1: boolean = false,
): Promise<any[]> {
  let lastEvaluatedKey = undefined;
  const returnData: any[] = [];

  const queryParams = useGSI1
    ? {
        KeyConditionExpression: 'GSI1PK = :pk',
        IndexName: 'GSI1',
        ExpressionAttributeValues: {
          ':pk': geoHash,
        },
      }
    : {
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': geoHash,
        },
      };
  for (let index = 0; index < MAXIMUM_DYNAMODB_FETCH; index++) {
    const params = new QueryCommand({
      TableName: SPATIAL_DATA_TABLE,
      Limit: DYNAMODB_FETCH_LIMIT,
      ExclusiveStartKey: lastEvaluatedKey,
      ...queryParams,
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

/**
 * Calculates the round trip route length in kilometers between two points.
 *
 * This function computes the distance between the `start` and `end` points using `getDistance`,
 * converts the result to kilometers by dividing by 1000, doubles it to account for a round trip,
 * and rounds the result to one decimal place.
 *
 * @param start - The starting point of the route.
 * @param end - The ending point of the route.
 * @returns A promise that resolves to the round trip distance in kilometers, rounded to one decimal place.
 */
export async function getRouteDistance(start: Point, end: Point): Promise<number> {
  // Calculate the round trip distance in km between the start and end points
  const distance = getDistance(start, end);
  // Convert to kilometers, double to get the round trip distance, and round to one decimal place
  const routeLength = Number((distance / 500).toFixed(1));
  return routeLength;
}

/**
 * Calculates the population impact based on an array of geographic points.
 *
 * Filters the input array to include only points of type 'Population', then sums
 * the population of each point.
 * If a point does not have a population, it is treated as 0.
 * The population impact is scaled by a factor of 0.1 to account for the direct impact that drones will have on the population.
 * The geoPoint represents a 1km square, and we assume that the population is evenly distributed across this area.
 * We assume that the drone flies a direct route through the area and only impacts the population within 50m of the route.
 *
 * @param geoPoints - An array of geographic point objects, each potentially containing a 'type' and 'population' property.
 * @returns A promise that resolves to the calculated population impact as a number.
 */
export async function assessPopulationImpact(geoPoints: Array<any>): Promise<number> {
  const populationImpact = geoPoints
    .filter((p) => p.type === 'Population')
    .reduce((sum, point) => sum + (point.population * 0.1 || 0), 0);
  return Math.round(populationImpact);
}

/**
 * Calculates a noise impact score based on the affected population.
 *
 * The score is a number between 0 and 5 (inclusive), rounded to one decimal place.
 * The population impact is scaled such that 5,000 people corresponds to the maximum score of 5.
 * Any value above 5,000 people will be capped at 5, and values below 0 will be capped at 0.
 *
 * @param populationImpact - The number of people affected by noise.
 * @returns A Promise that resolves to the noise impact score (0.0 to 5.0).
 */
export async function assessNoiseImpact(populationImpact: number): Promise<number> {
  const noiseImpact = Math.min(5, Math.max(0, Number((populationImpact / 1000).toFixed(1))));
  return noiseImpact;
}

/**
 * Assesses the weather impact along a given route by analyzing weather-related geo points.
 *
 * Calculates two types of risks:
 * - **Visibility Risk**: Scaled up to 5 when visibility is less than 1,000 meters.
 * - **Wind Risk**: Scaled up to 5 when wind speed exceeds 20 m/s.
 *
 * For each weather point:
 * - Visibility risk is computed as `(1000 - visibility) / 200` if visibility is below 1,000 meters.
 * - Wind risk is computed as `windSpeed / 4` if wind speed is 20 m/s or less, otherwise 5.
 * - The maximum risk value across all points is used for each risk type.
 *
 * @param geoPoints - An array of geo points, each potentially containing weather data.
 * @returns An object containing the highest calculated `visibilityRisk` and `windRisk` (rounded to one decimal place), or `undefined` if not applicable.
 */
export async function assessWeatherImpact(
  geoPoints: Array<any>,
): Promise<{ visibilityRisk?: number; windRisk?: number }> {
  let visibilityRisk = undefined;
  let windRisk = undefined;
  // Find the weather points neat the route
  const weatherPoints = geoPoints.filter((p) => p.type === 'Weather');
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
  return {
    visibilityRisk,
    windRisk,
  };
}
