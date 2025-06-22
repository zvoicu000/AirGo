import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';

interface ApiResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  processRoute: NodejsFunction;
  optimiseRoute: NodejsFunction;
  getBoundingBox: NodejsFunction;
}

export class ApiResources extends NestedStack {
  public api: RestApi;

  constructor(scope: Construct, id: string, props: ApiResourcesProps) {
    super(scope, id, props);

    const { processRoute, optimiseRoute, getBoundingBox } = props;

    // Create the API Gateway
    this.api = new RestApi(this, 'DroneDeliveryApi', {
      restApiName: 'Drone Delivery Service API',
      description: 'API for drone delivery service operations',
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'],
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

    // Add routes resource
    const routes = this.api.root.addResource('routes');

    // Add process route endpoint
    routes.addMethod('POST', new LambdaIntegration(processRoute));

    // Add optimize route endpoint
    const optimize = routes.addResource('optimize');
    optimize.addMethod('POST', new LambdaIntegration(optimiseRoute));

    // Add spatial queries resource
    const spatial = this.api.root.addResource('spatial');

    // Add bounding box query endpoint
    const boundingBox = spatial.addResource('bounding-box');
    boundingBox.addMethod('GET', new LambdaIntegration(getBoundingBox));
  }
}
