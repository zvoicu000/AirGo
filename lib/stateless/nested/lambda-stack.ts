import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
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
  public optimiseRoute: NodejsFunction;

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
      source: 'src/route-engine/process-route.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
      },
    }).lambda;
    spatialDataTable.grantReadData(this.processRoute);

    // Create the OptimiseRoute Lambda function
    this.optimiseRoute = new CustomLambda(this, 'OptimiseRouteFunction', {
      envConfig: envConfig,
      source: 'src/route-engine/optimise-route.ts',
      environmentVariables: {
        SPATIAL_DATA_TABLE: spatialDataTable.tableName,
      },
    }).lambda;
    spatialDataTable.grantReadData(this.optimiseRoute);

    // Create IAM role for the EventBridge Scheduler
    const schedulerRole = new Role(this, 'WeatherDataSchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });

    // Grant the scheduler role permission to invoke the Lambda function
    schedulerRole.addToPolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [this.loadWeatherData.functionArn],
      }),
    );

    // Create EventBridge scheduler to trigger loadWeatherData function every hour
    new CfnSchedule(this, 'WeatherDataSchedule', {
      flexibleTimeWindow: {
        mode: 'OFF',
      },
      scheduleExpression: 'cron(0 * * * ? *)', // Every hour at minute 0
      description: 'Triggers loadWeatherData function every hour',
      target: {
        arn: this.loadWeatherData.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });
  }
}
