import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

interface ApiResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  processRoute: NodejsFunction;
  optimiseRoute: NodejsFunction;
  getBoundingBox: NodejsFunction;
  allowedOrigins?: string[];
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

    // Save the API URL to the System Manager Parameter Store
    new StringParameter(this, 'ApiUrlParameter', {
      parameterName: '/droneServiceApi/apiUrl',
      stringValue: this.api.url,
    });

    // Output the API URL
    this.exportValue(this.api.url, {
      name: 'ApiUrl',
      description: 'The URL of the API Gateway for the Drone Delivery Service',
    });
  }
}
