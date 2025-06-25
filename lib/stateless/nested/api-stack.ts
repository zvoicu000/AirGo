import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

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

  constructor(scope: Construct, id: string, props: ApiResourcesProps) {
    super(scope, id, props);

    const { assessRoute, optimiseRoute, getBoundingBox } = props;

    // Create the API Gateway
    this.api = new RestApi(this, 'DroneDeliveryApi', {
      restApiName: 'Drone Delivery Service API',
      description: 'API for drone delivery service operations',
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

    // Add routes resource
    const routes = this.api.root.addResource('routes');

    // Add optimise route endpoint
    const optimise = routes.addResource('optimise');
    optimise.addMethod('POST', new LambdaIntegration(optimiseRoute));

    // Add spatial queries resource
    const spatial = this.api.root.addResource('spatial');

    // Add bounding box query endpoint
    const boundingBox = spatial.addResource('bounding-box');
    boundingBox.addMethod('GET', new LambdaIntegration(getBoundingBox));

    // Add route assessment resource
    const assessRouteResource = spatial.addResource('route');
    assessRouteResource.addMethod('GET', new LambdaIntegration(assessRoute));

    // Save the API URL to the System Manager Parameter Store
    new StringParameter(this, 'ApiUrlParameter', {
      parameterName: props.envConfig.apiUrlParameterName || '/droneServiceApi/apiUrl',
      stringValue: this.api.url,
    });
  }
}
