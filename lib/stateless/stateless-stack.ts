/*
 * Stateless Stack
 * This is the parent stack that contains all the stateless resources.
 * This includes Lambda functions, API Gateway and EventBridge.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig, Stage } from '@config';
import { LambdaResources } from './nested/lambda-stack';

export interface StatelessStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class StatelessStack extends Stack {
  public lambdaResources: LambdaResources;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);
    const { stage, envConfig } = props;

    // Create the lambda resources nested stack
    this.lambdaResources = new LambdaResources(this, 'LambdaResources', {
      stage: stage,
      envConfig: envConfig,
    });
  }
}
