import { handler } from '../../../src/api/get-bounding-box';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('getBoundingBox', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SPATIAL_DATA_TABLE = 'test-table';
    process.env.GEOHASH_PRECISION = '5';
  });

  it('should return 400 if missing parameters', async () => {
    const event = {
      latMin: undefined,
      lonMin: -73.9876,
      latMax: 40.7589,
      lonMax: -73.9656,
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Missing bounding box parameters.');
  });

  it('should query DynamoDB and filter results within bounding box', async () => {
    const event = {
      latMin: 40.7489,
      lonMin: -73.9876,
      latMax: 40.7589,
      lonMax: -73.9656,
    };

    // Mock items that should be both inside and outside the bounding box
    const mockItems = [
      { lat: 40.7500, lon: -73.9700, type: 'Population', population: 1000 }, // Inside
      { lat: 40.7400, lon: -73.9800, type: 'Population', population: 2000 }, // Outside (below latMin)
      { lat: 40.7550, lon: -73.9750, type: 'Weather', temperature: 25 }, // Inside
    ];

    ddbMock.on(QueryCommand).resolves({
      Items: mockItems,
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.items).toHaveLength(2); // Only the items within bounds
    expect(body.items[0].population).toBe(1000);
    expect(body.items[1].temperature).toBe(25);
  });

  it('should handle DynamoDB errors gracefully', async () => {
    const event = {
      latMin: 40.7489,
      lonMin: -73.9876,
      latMax: 40.7589,
      lonMax: -73.9656,
    };

    ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).items).toHaveLength(0);
  });
});