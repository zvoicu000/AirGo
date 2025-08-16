import { WeatherReport } from '../../../src/models/weather-report';

// Intercept the logger calls
import { logger } from '../../../src/shared';
jest.mock('../../../src/shared/logger');
const mockLoggerError = jest.spyOn(logger, 'error');

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
    expect(report.lat).toBe('37.62');
    expect(report.lon).toBe('-122.37');
    expect(report.temperature).toBe('15.6');
    expect(report.windSpeed).toBe('5.1');
    expect(report.visibility).toBe('10000');
    expect(mockLoggerError).not.toHaveBeenCalled();
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
    expect(json).toHaveProperty('PK', '9q8yp');
    expect(json).toHaveProperty('SK');
    expect(json).toHaveProperty('GSI1PK', '9q8y');
    expect(json).toHaveProperty('lat', '37.62');
    expect(json).toHaveProperty('lon', '-122.37');
    expect(json).toHaveProperty('temperature', '15.6');
    expect(json).toHaveProperty('windSpeed');
    expect(json).toHaveProperty('visibility');
  });

  it('should return null from getDynamoDBJson for invalid reports', () => {
    const invalidMetar = {
      ...sampleMetar,
      latitude: ['91'], // Invalid latitude
    };
    const report = new WeatherReport(invalidMetar);
    expect(report.getDynamoDBJson()).toBeUndefined();
  });
});
