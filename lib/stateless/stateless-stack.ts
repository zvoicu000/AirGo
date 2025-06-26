/*
 * Stateless Stack
 * This is the parent stack that contains all the stateless resources.
 * This includes Lambda functions, API Gateway and EventBridge.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig, Stage } from '@config';
import { LambdaResources } from './nested/lambda-stack';
import { ApiResources } from './nested/api-stack';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventResources } from './nested/events-stack';

export interface StatelessStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  spatialDataTable: Table;
  routesTable: Table;
}

export class StatelessStack extends Stack {
  public lambdaResources: LambdaResources;
  public eventResources: EventResources;
  public apiResources: ApiResources;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);
    const { stage, envConfig } = props;

    // Create the lambda resources nested stack
    this.lambdaResources = new LambdaResources(this, 'LambdaResources', {
      stage: stage,
      envConfig: envConfig,
      spatialDataTable: props.spatialDataTable,
      routesTable: props.routesTable,
    });

    // Create the events nested stack
    this.eventResources = new EventResources(this, 'EventResources', {
      stage: stage,
      envConfig: envConfig,
      spatialDataTable: props.spatialDataTable,
      routesTable: props.routesTable,
    });

    // Create the API Gateway resources nested stack with CloudFront URL for CORS
    this.apiResources = new ApiResources(this, 'ApiResources', {
      stage: stage,
      envConfig: envConfig,
      assessRoute: this.lambdaResources.assessRoute,
      optimiseRoute: this.lambdaResources.optimiseRoute,
      getBoundingBox: this.lambdaResources.getBoundingBox,
    });

    // Output the API URL
    this.exportValue(this.apiResources.api.url, {
      name: 'ApiUrl',
      description: 'The URL of the API Gateway for the Drone Delivery Service',
    });
  }
}
