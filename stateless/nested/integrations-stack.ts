import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EnvironmentConfig, Stage } from '../../config';
import { CustomLambda } from '../../lib/constructs';

interface IntegrationsResourcesProps extends NestedStackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class IntegrationsResources extends NestedStack {
  public exampleLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: IntegrationsResourcesProps) {
    super(scope, id, props);

    const { envConfig } = props;

    // Create an example Lambda function
    this.exampleLambda = new CustomLambda(this, 'ExampleLambda', {
      envConfig: envConfig,
      entry: `${__dirname}/../../src/integrations/example.ts`,
    }).lambda;
  }
}
