/*
 * Stateless Stack
 * This is the parent stack that contains all the nested stacks for the stateless resources.
 * It includes the integrations resources.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig, Stage } from '@config';
import { IntegrationsResources } from './nested/integrations-stack';

export interface StatelessStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class StatelessStack extends Stack {
  public integrationsResources: IntegrationsResources;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);
    const { stage, envConfig } = props;

    // Create the integrations resources nested stack
    this.integrationsResources = new IntegrationsResources(this, 'IntegrationsResources', {
      stage: stage,
      envConfig: envConfig,
    });
  }
}
