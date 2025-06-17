import * as geohash from 'ngeohash';
import { getDistance, getRhumbLineBearing, computeDestinationPoint } from 'geolib';

export type Point = { lat: number; lon: number };
export type BoundingBox = { latMin: number; lonMin: number; latMax: number; lonMax: number };

/**
 * Returns a Set of GeoHashes (precision 5) intersected by the route.
 */
export function getRouteGeoHashes(start: Point, end: Point, precision = 5, stepMeters = 100): Array<string> {
  const geoHashes = new Set<string>();

  // Always include start and end
  geoHashes.add(geohash.encode(start.lat, start.lon, precision));
  geoHashes.add(geohash.encode(end.lat, end.lon, precision));

  const distance = getDistance(start, end); // in meters
  const bearing = getRhumbLineBearing(start, end); // constant bearing

  const steps = Math.floor(distance / stepMeters);

  for (let i = 1; i < steps; i++) {
    const point = computeDestinationPoint(start, stepMeters * i, bearing);
    const hash = geohash.encode(point.latitude, point.longitude, precision);
    geoHashes.add(hash);
  }

  return Array.from(geoHashes);
}
