import { handler } from '../../../src/api/get-bounding-box';
import { logger } from '../../../src/shared';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// Intercept the logger calls
jest.mock('../../../src/shared/logger');
const mockLoggerError = jest.spyOn(logger, 'error');

const ddbMock = mockClient(DynamoDBDocumentClient);

const apiGatewayEvent = {
  resource: '/bounding-box',
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: {},
  path: '/bounding-box',
  pathParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: 'test-account',
    apiId: 'test-api',
    authorizer: {},
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'jest',
      userArn: null,
    },
    path: '/bounding-box',
    stage: 'test',
    requestId: 'test-request-id',
    requestTimeEpoch: 0,
    resourceId: 'test-resource-id',
    resourcePath: '/bounding-box',
  },
};

describe('getBoundingBox', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SPATIAL_DATA_TABLE = 'test-table';
    process.env.GEOHASH_PRECISION = '5';
  });

  it('should return 400 if missing parameters', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: {
        latMin: undefined,
        lonMin: '-73.9876',
        latMax: '40.7589',
        lonMax: '-73.9656',
      },
      ...apiGatewayEvent,
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Missing bounding box parameters.');
  });

  it('should query DynamoDB and filter results within bounding box', async () => {
    const event = {
      queryStringParameters: {
        latMin: '40.7489',
        lonMin: '-73.9876',
        latMax: '40.7589',
        lonMax: '-73.9656',
      },
      ...apiGatewayEvent,
    };

    // Mock items that should be both inside and outside the bounding box
    const mockItems = [
      { lat: 40.75, lon: -73.97, type: 'Population', population: 1000 }, // Inside
      { lat: 40.74, lon: -73.98, type: 'Population', population: 2000 }, // Outside (below latMin)
      { lat: 40.755, lon: -73.975, type: 'Weather', temperature: 25 }, // Inside
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
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB errors gracefully', async () => {
    const event = {
      queryStringParameters: {
        latMin: '40.7489',
        lonMin: '-73.9876',
        latMax: '40.7589',
        lonMax: '-73.9656',
      },
      ...apiGatewayEvent,
    };

    ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).items).toHaveLength(0);
  });
});
