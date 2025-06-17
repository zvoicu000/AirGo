import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
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
  }
}
