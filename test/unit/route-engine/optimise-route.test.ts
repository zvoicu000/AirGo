import { handler } from '../../../src/route-engine/optimise-route';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('optimise-route', () => {
  const mockSend = jest.fn();
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup DynamoDB mock
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
      send: mockSend,
    });
    
    // Set required environment variables
    process.env.SPATIAL_DATA_TABLE = 'test-table';
    process.env.GEOHASH_PRECISION = '5';
  });

  it('should return 400 if parameters are missing', async () => {
    const event = {
      latStart: 51.5074,
      lonStart: -0.1278,
      // Missing latEnd and lonEnd
    };

    const result = await handler(event as any);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Missing bounding box parameters.');
  });

  it('should optimise route to avoid populated areas', async () => {
    // Mock spatial data with some population points
    const mockPopulationData = [
      { 
        lat: 51.51,
        lon: -0.13,
        type: 'Population',
        population: 1000
      },
      {
        lat: 51.52,
        lon: -0.12,
        type: 'Population',
        population: 500
      }
    ];

    // Setup mock response for DynamoDB
    mockSend.mockResolvedValue({
      Items: mockPopulationData
    });

    const event = {
      latStart: 51.5074,
      lonStart: -0.1278,
      latEnd: 51.5300,
      lonEnd: -0.1000
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('route');
    expect(body).toHaveProperty('populationImpact');
    expect(Array.isArray(body.route)).toBe(true);
    expect(body.route.length).toBeGreaterThan(1);
    
    // Verify start and end points
    expect(body.route[0]).toEqual({ lat: event.latStart, lon: event.lonStart });
    expect(body.route[body.route.length - 1]).toEqual({ lat: event.latEnd, lon: event.lonEnd });
  });

  it('should handle empty spatial data results', async () => {
    // Setup mock response for DynamoDB with no results
    mockSend.mockResolvedValue({
      Items: []
    });

    const event = {
      latStart: 51.5074,
      lonStart: -0.1278,
      latEnd: 51.5300,
      lonEnd: -0.1000
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.populationImpact).toBe(0);
    expect(body.route.length).toBeGreaterThan(1);
  });
});