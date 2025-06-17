#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StatefulStack } from '../lib/stateful/stateful-stack';
import { StatelessStack } from '../lib/stateless/stateless-stack';
import { Stage, getStage, getEnvironmentConfig } from '../config';

const stage = getStage(process.env.STAGE as Stage) as Stage;
const envConfig = getEnvironmentConfig(stage);

const app = new cdk.App();

const statefulStack = new StatefulStack(app, 'StatefulStack', {
  stage: stage,
  envConfig: envConfig,
});

const statelessStack = new StatelessStack(app, 'StatelessStack', {
  stage: stage,
  envConfig: envConfig,
});

// Ensure the stateful stack is deployed before the stateless stack
statelessStack.addDependency(statefulStack);
