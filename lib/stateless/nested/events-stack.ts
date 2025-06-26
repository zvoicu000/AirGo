import { Construct } from 'constructs';
import { Duration, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { CustomLambda } from '../../constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { FilterCriteria, FilterRule, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { AppSyncAuthorizationType, EventApi } from 'aws-cdk-lib/aws-appsync';

interface EventResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  spatialDataTable: Table;
  routesTable: Table;
}

export class EventResources extends NestedStack {
  public optimiseNewRoute: NodejsFunction;
  public eventsApi: EventApi;

  constructor(scope: Construct, id: string, props: EventResourcesProps) {
    super(scope, id, props);

    const { envConfig, spatialDataTable, routesTable } = props;

    // Create the AppSync Events Websocket API
    const apiKeyProvider = { authorizationType: AppSyncAuthorizationType.API_KEY };

    // create an API called `my-event-api` that uses API Key authorization
    this.eventsApi = new EventApi(this, 'api', {
      apiName: 'RouteOptimisationEvents',
      authorizationConfig: { authProviders: [apiKeyProvider] },
    });

    // add a channel namespace called `default`
    this.eventsApi.addChannelNamespace('default');

    // Create the OptimiseRoute Lambda function
    this.optimiseNewRoute = new CustomLambda(this, 'OptimiseNewRouteFunction', {
      envConfig: envConfig,
      memorySize: 3008, // 3GB
      timeout: Duration.seconds(300), // 5 minutes
      source: 'src/event-processing/process-new-route.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
        ROUTES_TABLE: routesTable.tableName,
        PARTITION_KEY_HASH_PRECISION: envConfig.partitionKeyHashPrecision?.toString(),
        SORT_KEY_HASH_PRECISION: envConfig.sortKeyHashPrecision?.toString(),
        GSI_HASH_PRECISION: envConfig.gsiHashPrecision?.toString(),
        APPSYNC_EVENTS_HTTP_DOMAIN: this.eventsApi.httpDns,
        APPSYNC_EVENTS_API_KEY: this.eventsApi.apiKeys['Default'].attrApiKey,
      },
    }).lambda;
    spatialDataTable.grantReadData(this.optimiseNewRoute);
    routesTable.grantReadWriteData(this.optimiseNewRoute);

    // Trigger the OptimiseRoute Lambda function when a new route is inserted into the routes table
    this.optimiseNewRoute.addEventSource(
      new DynamoEventSource(routesTable, {
        startingPosition: StartingPosition.LATEST,
        filters: [FilterCriteria.filter({ eventName: FilterRule.isEqual('INSERT') })],
        retryAttempts: 2,
        batchSize: 1,
        maxRecordAge: Duration.minutes(5),
      }),
    );
  }
}
