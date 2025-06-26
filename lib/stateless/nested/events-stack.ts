import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { CustomLambda } from '../../constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { FilterCriteria, FilterRule, StartingPosition } from 'aws-cdk-lib/aws-lambda';

interface EventResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  spatialDataTable: Table;
  routesTable: Table;
}

export class EventResources extends NestedStack {
  public optimiseNewRoute: NodejsFunction;

  constructor(scope: Construct, id: string, props: EventResourcesProps) {
    super(scope, id, props);

    const { envConfig, spatialDataTable, routesTable } = props;

    // Create the OptimiseRoute Lambda function
    this.optimiseNewRoute = new CustomLambda(this, 'OptimiseNewRouteFunction', {
      envConfig: envConfig,
      memorySize: 2048, // Increase CPU for A* algorithm
      source: 'src/api/optimise-route.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
        ROUTES_TABLE: routesTable.tableName,
        PARTITION_KEY_HASH_PRECISION: envConfig.partitionKeyHashPrecision?.toString(),
        SORT_KEY_HASH_PRECISION: envConfig.sortKeyHashPrecision?.toString(),
        GSI_HASH_PRECISION: envConfig.gsiHashPrecision?.toString(),
      },
    }).lambda;
    spatialDataTable.grantReadData(this.optimiseNewRoute);
    routesTable.grantReadWriteData(this.optimiseNewRoute);

    // Trigger the OptimiseRoute Lambda function when a new route is inserted into the routes table
    this.optimiseNewRoute.addEventSource(
      new DynamoEventSource(routesTable, {
        startingPosition: StartingPosition.LATEST,
        filters: [FilterCriteria.filter({ eventName: FilterRule.isEqual('INSERT') })],
      }),
    );
  }
}
