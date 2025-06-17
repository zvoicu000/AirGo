/*
 * Stateful Stack
 * This is the parent stack that contains all the stateful resources.
 */

import * as path from 'path';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { EnvironmentConfig, Stage, getRemovalPolicyFromStage } from '../../config';
import { CustomTable } from '../constructs/custom-table';

export interface StatefulStackProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class StatefulStack extends Stack {
  // Exports from this stack
  public readonly spatialDataTable: Table;

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
    }).table;
  }
}
