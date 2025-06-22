/**
 * A CDK construct that creates a custom AWS Lambda function using Node.js.
 *
 * This construct wraps the `NodejsFunction` from `@aws-cdk/aws-lambda-nodejs` and applies
 * default configuration, while allowing overrides via `CustomLambdaProps`.
 *
 * Features:
 * - Merges default Lambda properties with user-provided properties.
 * - Sets up environment variables including PowerTools and custom variables.
 * - Supports VPC configuration, custom memory size, timeout, and logging.
 * - Bundles Lambda code with source maps and optional minification.
 * - Uses ARM_64 architecture and the latest Node.js runtime.
 *
 * @example
 * ```typescript
 * new CustomLambda(this, 'MyFunction', {
 *   functionName: 'my-lambda',
 *   source: 'src/my-function.ts',
 *   handler: 'handler',
 *   envConfig: { env: { region: 'us-east-1' }, logLevel: 'INFO', minifyCodeOnDeployment: false },
 *   environmentVariables: { FOO: 'bar' },
 * });
 * ```
 *
 * @extends Construct
 *
 * @property {NodejsFunction} lambda - The underlying NodejsFunction instance.
 *
 * @param scope - The parent construct.
 * @param id - The unique identifier for this construct.
 * @param props - Custom properties for configuring the Lambda function.
 */

import * as path from 'path';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Runtime, Tracing, Architecture, LoggingFormat, SystemLogLevel } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EnvironmentConfig } from '@config';
import { projectRoot } from '../utils';

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
  readonly source: string; // The source file for the lambda function
  readonly environmentVariables?: object; // Additional environment variables to add to the function
  readonly policyStatements?: [PolicyStatement]; // The policy statements to add to the function
  readonly externalModules?: [string] | []; // Array of external modules to include explicitly
}

// Default properties for the Lambda function
const defaultLambdaProps = {
  memorySize: 512,
  timeout: Duration.seconds(60),
  handler: 'handler',
  environmentVariables: {},
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
      entry: path.join(projectRoot, props.source),
      environment: {
        REGION: props.envConfig.env.region,
        ...lambdaDefaultEnvironmentVariables,
        ...lambdaPowerToolsConfig,
        POWERTOOLS_SERVICE_NAME: props.functionName ? props.functionName : id,
        POWERTOOLS_LOG_LEVEL: props.envConfig.logLevel,
        ...props.environmentVariables,
      },
      runtime: Runtime.NODEJS_LATEST,
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
