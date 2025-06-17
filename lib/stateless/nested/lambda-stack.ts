import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../../config';
import { CustomLambda } from '../../constructs';

interface LambdaResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class LambdaResources extends NestedStack {
  public exampleLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id, props);

    const { envConfig } = props;

    // Create the LoadWeatherDataFunction Lambda function
    this.exampleLambda = new CustomLambda(this, 'LoadWeatherDataFunction', {
      envConfig: envConfig,
      source: 'src/data-loading/load-weather-data.ts',
    }).lambda;
  }
}
