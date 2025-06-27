/*
 * Stateful Stack
 * This is the parent stack that contains all the stateful resources.
 */

import * as path from 'path';
import { Stack, StackProps, Aspects } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Table, AttributeType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { EnvironmentConfig, Stage, getRemovalPolicyFromStage } from '../../config';
import { CustomTable } from '../constructs/custom-table';

export interface StatefulStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class StatefulStack extends Stack {
  // Exports from this stack
  public readonly spatialDataTable: Table;
  public readonly routesTable: Table;

  constructor(scope: Construct, id: string, props: StatefulStackProps) {
    super(scope, id, props);
    const { stage, envConfig } = props;

    // Define a DynamoDB table that will be used to store the spatial data
    this.spatialDataTable = new CustomTable(this, 'SpatialDataTable', {
      tableName: envConfig.spatialDataTableName,
      stageName: stage,
      dataPath: path.join(__dirname, '../../resources/seed-data/population-data/processed'),
      removalPolicy: getRemovalPolicyFromStage(stage),
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: AttributeType.STRING,
      },
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
        },
      ],
    }).table;

    // Define a DynamoDB table that will used to store the flight routes
    this.routesTable = new CustomTable(this, 'RoutesTable', {
      tableName: envConfig.routesTableName,
      stageName: stage,
      removalPolicy: getRemovalPolicyFromStage(stage),
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    }).table;

    // cdk nag check and suppressions
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'Server access logging is not required for this stack',
        },
        {
          id: 'AwsSolutions-S10',
          reason: 'Use of SSL is not required for this stack',
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Use of managed policies is not required for this stack',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Use of wildcard policies has been accepted for this stack',
        },
        {
          id: 'AwsSolutions-L1',
          reason: 'Lambda function is use the latest runtime and is not using deprecated features',
        },
      ],
      true,
    );
  }
}
