/*
 * Stateful Stack
 * This is the parent stack that contains all the nested stacks for the stateful resources.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig, Stage } from '../config';

export interface StatefulStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class StatefulStack extends Stack {

  constructor(scope: Construct, id: string, props: StatefulStackProps) {
    super(scope, id, props);
    const { stage, envConfig } = props;
  }
}
