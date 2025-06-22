import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ApiResources } from '../../lib/stateless/nested/api-stack';
import { Stage } from '../../config';

describe('ApiResources Stack', () => {
  const createTestStack = () => {
    const stack = new Stack();
    
    // Create mock Lambda functions
    const processRoute = new NodejsFunction(stack, 'ProcessRoute', {
      entry: 'src/lambda/process-route.ts',
    });
    
    const optimiseRoute = new NodejsFunction(stack, 'OptimiseRoute', {
      entry: 'src/lambda/optimise-route.ts',
    });
    
    const getBoundingBox = new NodejsFunction(stack, 'GetBoundingBox', {
      entry: 'src/lambda/get-bounding-box.ts',
    });

    // Create the API stack
    new ApiResources(stack, 'TestApi', {
      stage: Stage.DEV,
      envConfig: {
        region: 'us-east-1',
        account: '123456789012',
      },
      processRoute,
      optimiseRoute,
      getBoundingBox,
    });

    return stack;
  };

  test('API Gateway is created with CORS configuration', () => {
    const stack = createTestStack();
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'Drone Delivery Service API',
    });

    // Verify CORS configuration in OPTIONS method
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'OPTIONS',
      ResourceId: { Ref: expect.any(String) },
      RestApiId: { Ref: expect.any(String) },
      Integration: {
        Type: 'MOCK',
        RequestTemplates: {
          'application/json': '{ "statusCode": 200 }',
        },
      },
      MethodResponses: [
        {
          StatusCode: '200',
          ResponseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  });
});