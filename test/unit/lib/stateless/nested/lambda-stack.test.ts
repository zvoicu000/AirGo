import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaResources } from '../../../../../lib/stateless/nested/lambda-stack';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';

describe('LambdaResources Stack', () => {
  const createTestStack = () => {
    const stack = new Stack();
    
    // Create a mock DynamoDB table
    const spatialDataTable = new Table(stack, 'TestTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    // Create the LambdaResources stack
    new LambdaResources(stack, 'TestLambdaResources', {
      stage: 'test',
      envConfig: {
        weatherDataSourceUrl: 'http://test.example.com',
        weatherDataTtlSeconds: 3600,
      },
      spatialDataTable,
    });

    return stack;
  };

  test('creates EventBridge Scheduler with correct configuration', () => {
    const stack = createTestStack();
    const template = Template.fromStack(stack);

    // Verify the EventBridge Scheduler is created
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Description: 'Triggers loadWeatherData function every hour',
      ScheduleExpression: 'rate(1 hour)',
      FlexibleTimeWindow: {
        Mode: 'OFF',
      },
    });

    // Verify the IAM role for the scheduler is created
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'scheduler.amazonaws.com',
            },
          },
        ],
      },
    });

    // Verify the role has permission to invoke the Lambda function
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                expect.stringMatching(/LoadWeatherDataFunction.*/),
                'Arn',
              ],
            },
          },
        ],
      },
    });
  });
});