/*
 * CDK Nested Stack - API Resources
 *
 * This CDK nested stack sets up the API resources for the Drone Delivery Service.
 * This contains the API Gateway and routes for assessing and optimising flight routes,
 *
 * This software is licensed under the GNU General Public License v3.0.
 */

import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration, ApiKey, UsagePlan, ApiKeySourceType } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

interface ApiResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  assessRoute: NodejsFunction;
  optimiseRoute: NodejsFunction;
  getBoundingBox: NodejsFunction;
  allowedOrigins?: string[];
}

export class ApiResources extends NestedStack {
  public api: RestApi;
  public apiKeyValue: string;

  constructor(scope: Construct, id: string, props: ApiResourcesProps) {
    super(scope, id, props);

    const { assessRoute, optimiseRoute, getBoundingBox } = props;

    // Create the API Gateway
    this.api = new RestApi(this, 'DroneDeliveryApi', {
      restApiName: 'Drone Delivery Service API',
      description: 'API for drone delivery service operations',
      apiKeySourceType: ApiKeySourceType.HEADER,
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      },
    });

    // Create API Key
    const apiKey = new ApiKey(this, 'DroneDeliveryApiKey', {
      apiKeyName: `drone-delivery-api-key-${props.stage}`,
      description: `API Key for Drone Delivery Service - ${props.stage}`,
    });

    // Create Usage Plan
    const usagePlan = new UsagePlan(this, 'DroneDeliveryUsagePlan', {
      name: `drone-delivery-usage-plan-${props.stage}`,
      description: `Usage Plan for Drone Delivery Service - ${props.stage}`,
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
    });

    // Associate API Key with Usage Plan
    usagePlan.addApiKey(apiKey);

    // Get the API Key value
    const apiKeyFetch: AwsSdkCall = {
      service: 'APIGateway',
      action: 'getApiKey',
      parameters: {
        apiKey: apiKey.keyId,
        includeValue: true,
      },
      physicalResourceId: PhysicalResourceId.of(`APIKey:${apiKey.keyId}`),
    };

    const apiKeyCr = new AwsCustomResource(this, 'api-key-cr', {
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [apiKey.keyArn],
          actions: ['apigateway:GET'],
        }),
      ]),
      logRetention: RetentionDays.ONE_DAY,
      onCreate: apiKeyFetch,
      onUpdate: apiKeyFetch,
    });

    apiKeyCr.node.addDependency(apiKey);
    this.apiKeyValue = apiKeyCr.getResponseField('value');

    // Add routes resource
    const routes = this.api.root.addResource('routes');

    // Add route assessment resource
    const assessRouteResource = routes.addResource('assess-route');
    assessRouteResource.addMethod('GET', new LambdaIntegration(assessRoute), {
      apiKeyRequired: true,
    });

    // Add optimise route endpoint
    const optimiseRouteResource = routes.addResource('optimise-route');
    optimiseRouteResource.addMethod('POST', new LambdaIntegration(optimiseRoute), {
      apiKeyRequired: true,
    });

    // Add spatial queries resource
    const spatial = this.api.root.addResource('spatial');

    // Add bounding box query endpoint
    const boundingBox = spatial.addResource('bounding-box');
    boundingBox.addMethod('GET', new LambdaIntegration(getBoundingBox), {
      apiKeyRequired: true,
    });

    // Save the API URL and key to the System Manager Parameter Store
    new StringParameter(this, 'ApiUrlParameter', {
      parameterName: props.envConfig.apiUrlParameterName || '/droneServiceApi/apiUrl',
      stringValue: this.api.url,
    });
  }
}
