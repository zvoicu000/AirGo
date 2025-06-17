import { handler } from '../../../src/data-loading/load-weather-data';
import axios from 'axios';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

jest.mock('axios');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('load-weather-data', () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;
  const mockDynamoDBDocument = {
    batchWrite: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPATIAL_DATA_TABLE = 'test-table';
    process.env.WEATHER_DATA_SOURCE_URL = 'http://test.url';
    (DynamoDBDocument.from as jest.Mock).mockReturnValue(mockDynamoDBDocument);
  });

  it('should process weather data and write to DynamoDB', async () => {
    // Mock the METAR XML response
    const mockMetarXml = `<?xml version="1.0" encoding="UTF-8"?>
      <response>
        <data>
          <METAR>
            <latitude>37.62</latitude>
            <longitude>-122.37</longitude>
            <temp_c>15.6</temp_c>
            <wind_speed_kt>10</wind_speed_kt>
            <visibility_statute_mi>10.0</visibility_statute_mi>
            <wx_string>RA</wx_string>
            <observation_time>2023-12-01T00:00:00Z</observation_time>
          </METAR>
          <METAR>
            <latitude>40.65</latitude>
            <longitude>-73.78</longitude>
            <temp_c>12.2</temp_c>
            <wind_speed_kt>15</wind_speed_kt>
            <visibility_statute_mi>5.0</visibility_statute_mi>
            <wx_string>-RA</wx_string>
            <observation_time>2023-12-01T00:00:00Z</observation_time>
          </METAR>
        </data>
      </response>`;

    // Create a Buffer containing gzipped data
    const zlib = require('zlib');
    const gzippedData = zlib.gzipSync(mockMetarXml);

    mockAxios.get.mockResolvedValueOnce({
      data: gzippedData,
    });

    const result = await handler();

    // Verify the response
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Weather data loaded successfully');
    expect(JSON.parse(result.body).processedCount).toBe(2);

    // Verify DynamoDB batch write was called
    expect(mockDynamoDBDocument.batchWrite).toHaveBeenCalled();
    const batchWriteCall = mockDynamoDBDocument.batchWrite.mock.calls[0][0];
    expect(batchWriteCall.RequestItems['test-table']).toHaveLength(2);
  });

  it('should handle errors gracefully', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    await expect(handler()).rejects.toThrow('Network error');
  });
});