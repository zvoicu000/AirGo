import { WeatherReport } from '../../../src/models/weather-report';

describe('WeatherReport', () => {
  const sampleMetar = {
    latitude: ['37.62'],
    longitude: ['-122.37'],
    temp_c: ['15.6'],
    wind_speed_kt: ['10'],
    visibility_statute_mi: ['10.0'],
    wx_string: ['RA'],
    observation_time: ['2023-12-01T00:00:00Z'],
  };

  it('should create a valid weather report from METAR data', () => {
    const report = new WeatherReport(sampleMetar);
    expect(report.isValid).toBe(true);
    expect(report.lat).toBe(37.62);
    expect(report.lon).toBe(-122.37);
    expect(report.temperature).toBe(15.6);
    expect(report.windSpeed).toBeCloseTo(5.144, 1);
    expect(report.visibility).toBe(16093);
    expect(report.precipitationLevel).toBe(2);
  });

  it('should mark report as invalid with incorrect coordinates', () => {
    const invalidMetar = {
      ...sampleMetar,
      latitude: ['91'], // Invalid latitude
      longitude: ['180'],
    };
    const report = new WeatherReport(invalidMetar);
    expect(report.isValid).toBe(false);
  });

  it('should generate correct DynamoDB JSON', () => {
    const report = new WeatherReport(sampleMetar);
    const json = report.getDynamoDBJson();
    
    expect(json).toHaveProperty('PK', 'WEATHER#37.6200#-122.3700');
    expect(json).toHaveProperty('SK');
    expect(json).toHaveProperty('lat', 37.62);
    expect(json).toHaveProperty('lon', -122.37);
    expect(json).toHaveProperty('temperature', 15.6);
    expect(json).toHaveProperty('windSpeed');
    expect(json).toHaveProperty('visibility');
    expect(json).toHaveProperty('precipitationLevel', 2);
  });

  it('should return null from getDynamoDBJson for invalid reports', () => {
    const invalidMetar = {
      ...sampleMetar,
      latitude: ['91'], // Invalid latitude
    };
    const report = new WeatherReport(invalidMetar);
    expect(report.getDynamoDBJson()).toBeNull();
  });
});