#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FrontendStack } from '../lib/frontend/frontend-stack';
import { Stage, getStage, getEnvironmentConfig } from '../config';

const stage = getStage(process.env.STAGE as Stage) as Stage;
const envConfig = getEnvironmentConfig(stage);

const app = new cdk.App();

new FrontendStack(app, 'FrontendStack', {
  stage: stage,
  envConfig: envConfig,
});

// Tag all resources in CloudFormation with the stage name
cdk.Tags.of(app).add('service', 'drone-delivery-service-frontend');
cdk.Tags.of(app).add('stage', `${stage}`);
