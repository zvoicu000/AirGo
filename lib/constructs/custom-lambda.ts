import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Runtime, Tracing, Architecture, LoggingFormat, SystemLogLevel } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EnvironmentConfig } from '@config';

const lambdaPowerToolsConfig = {
  POWERTOOLS_LOGGER_LOG_EVENT: 'true',
  POWERTOOLS_LOGGER_SAMPLE_RATE: '0.05',
  POWERTOOLS_TRACE_ENABLED: 'enabled',
  POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
  POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
  POWERTOOLS_METRICS_NAMESPACE: 'DroneDeliveryService',
};

const lambdaDefaultEnvironmentVariables = {
  AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
  NODE_OPTIONS: '--enable-source-maps',
};

interface CustomLambdaProps extends NodejsFunctionProps {
  readonly envConfig: EnvironmentConfig; // The environment configuration
  readonly environmentVariables?: object; // Additional environment variables to add to the function
  readonly policyStatements?: [PolicyStatement]; // The policy statements to add to the function
  readonly externalModules?: [string] | []; // Array of external modules to include explicitly
}

const defaultLambdaProps = {
  memorySize: 512,
  timeout: Duration.seconds(60),
  handler: 'handler',
  environmentVariables: {},
  alarmsEnabled: false,
};

export class CustomLambda extends Construct {
  public readonly lambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: CustomLambdaProps) {
    super(scope, id);

    // Merge the default lambda props with the provided ones
    props = { ...defaultLambdaProps, ...props };

    this.lambda = new NodejsFunction(this, id, {
      functionName: props.functionName ? props.functionName : id, // If no function name is provided, use the lambda construct id
      memorySize: props.memorySize,
      timeout: props.timeout,
      entry: props.entry,
      environment: {
        REGION: props.envConfig.env.region,
        ...lambdaDefaultEnvironmentVariables,
        ...lambdaPowerToolsConfig,
        POWERTOOLS_SERVICE_NAME: props.functionName ? props.functionName : id,
        POWERTOOLS_LOG_LEVEL: props.envConfig.logLevel,
        ...props.environmentVariables,
      },
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      handler: props.handler,
      logRetention: RetentionDays.THREE_MONTHS,
      loggingFormat: LoggingFormat.JSON,
      systemLogLevelV2: props.envConfig.logLevel === 'DEBUG' ? SystemLogLevel.DEBUG : SystemLogLevel.WARN,
      tracing: Tracing.ACTIVE,
      bundling: {
        sourceMap: true,
        minify: props.envConfig.minifyCodeOnDeployment,
        esbuildArgs: {
          '--log-level': 'warning',
        },
        // The NodejsLambda externalModules will default to [aws-sdk/*] for NODEJS 18+ deployments
        ...(props.externalModules && { externalModules: props.externalModules }),
      },
      ...(props.vpc && {
        vpc: props.vpc,
        vpcSubnets: props.vpcSubnets,
        securityGroups: props.securityGroups,
      }),
    });
  }
}
