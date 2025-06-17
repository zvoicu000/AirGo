/* eslint-disable @typescript-eslint/no-explicit-any */
import * as geohash from 'ngeohash';
import { logger } from '../shared';
import { getDistance, getRhumbLineBearing, computeDestinationPoint, getDistanceFromLine } from 'geolib';

export type Point = { lat: number; lon: number };
export type BoundingBox = { latMin: number; lonMin: number; latMax: number; lonMax: number };

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
 * - For points of type `'Weather'`, only those within 10,000 meters of the route are included.
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
