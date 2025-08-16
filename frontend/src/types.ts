export interface PopulationData {
  GSI1PK: string;
  lon: number;
  population: number;
  SK: string;
  lat: number;
  PK: string;
  GSI1SK: string;
  type: 'Population';
}

export interface WeatherData {
  GSI1PK: string;
  windSpeed: string;
  dataTimestamp: number;
  lon: string;
  ttl: number;
  recordTimestamp: number;
  SK: string;
  lat: string;
  PK: string;
  GSI1SK: string;
  temperature: string;
  type: 'Weather';
}

export type MapData = PopulationData | WeatherData;

export interface ApiResponse {
  items: MapData[];
  count: number;
}

export interface RouteResponse {
  route: Array<{ lat: number; lon: number }>;
  routeDistance: number;
  populationImpact: number;
  noiseImpactScore?: number;
  visibilityRisk?: number;
  windRisk?: number;
}