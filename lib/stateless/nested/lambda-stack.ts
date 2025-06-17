import { Construct } from 'constructs';
import { NestedStack, NestedStackProps, Duration } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { EnvironmentConfig, Stage } from '../../../config';
import { CustomLambda } from '../../constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

interface LambdaResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
  spatialDataTable: Table;
}

export class LambdaResources extends NestedStack {
  public loadWeatherData: NodejsFunction;
  public processRoute: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id, props);

    const { envConfig, spatialDataTable } = props;

    // Create the LoadWeatherDataFunction Lambda function
    this.loadWeatherData = new CustomLambda(this, 'LoadWeatherDataFunction', {
      envConfig: envConfig,
      source: 'src/data-loading/load-weather-data.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
        WEATHER_DATA_SOURCE_URL: envConfig.weatherDataSourceUrl,
        WEATHER_DATA_TTL_SECONDS: envConfig.weatherDataTtlSeconds?.toString(),
      },
    }).lambda;
    spatialDataTable.grantReadWriteData(this.loadWeatherData);

    // Create the ProcessRoute Lambda function
    this.processRoute = new CustomLambda(this, 'ProcessRouteFunction', {
      envConfig: envConfig,
      source: 'src/process-route/process-route.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
      },
    }).lambda;
    spatialDataTable.grantReadData(this.processRoute);

    // Create EventBridge rule to trigger loadWeatherData function every hour
    const weatherDataScheduleRule = new Rule(this, 'WeatherDataScheduleRule', {
      description: 'Triggers loadWeatherData function every hour',
      schedule: Schedule.rate(Duration.hours(1)),
    });

    // Add the Lambda function as a target for the EventBridge rule
    weatherDataScheduleRule.addTarget(new LambdaFunction(this.loadWeatherData));
  }
}
