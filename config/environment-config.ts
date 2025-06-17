import { RemovalPolicy } from 'aws-cdk-lib';
import { Region, Stage } from '@config/types';

export function getStage(stage: string): string {
  switch (stage) {
    case Stage.prod:
      return Stage.prod;
    case Stage.dev:
      return Stage.dev;
    default:
      return Stage.dev; // return the dev environment if not known
  }
}

export interface EnvironmentConfig {
  env: {
    account: string;
    region: string;
  };
  stage: Stage;
  name: string;
  terminationProtection: boolean;
  logLevel: string;
  minifyCodeOnDeployment?: boolean;
}

/**
 * Define the default configuration.
 * These configuration options will be used if no environment-specific configuration is provided.
 * e.g. An ephemeral environment
 */
const defaultConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT as string,
    region: Region.primary,
  },
  stage: Stage.dev,
  name: 'Default',
  terminationProtection: false,
  logLevel: 'DEBUG',
  minifyCodeOnDeployment: false,
};

/**
 * Retrieves the environment configuration based on the provided stage.
 *
 * @param stage - The deployment stage for which the environment configuration is required.
 *                It can be one of the following:
 *                - `Stage.dev`: Development environment configuration.
 *                - `Stage.prod`: Production environment configuration.
 *
 * @returns The environment configuration object for the specified stage, including
 *          properties such as account ID, stage name, VPC CIDR, ACM domain, and
 *          optional deployment flags for specific resources.
 *
 * @remarks
 * - The `defaultConfig` is used as the base configuration and is extended with
 *   stage-specific properties.
 * - The `logLevel` is set to `INFO` for the production stage.
 */
export const getEnvironmentConfig = (stage: Stage): EnvironmentConfig => {
  switch (stage) {
    case Stage.dev:
      return {
        ...defaultConfig,
        env: {
          ...defaultConfig.env,
          account: 'xxx',
        },
        stage: Stage.dev,
        name: 'Dev',
      };
    case Stage.prod:
      return {
        ...defaultConfig,
        env: {
          ...defaultConfig.env,
          account: 'xxx',
        },
        terminationProtection: true,
        stage: Stage.prod,
        name: 'Prod',
        logLevel: 'INFO',
      };
    default:
      return defaultConfig;
  }
};

export function getRemovalPolicyFromStage(stage: Stage): RemovalPolicy {
  if (stage !== Stage.prod) {
    return RemovalPolicy.DESTROY; // retain the prod resources
  }
  return RemovalPolicy.RETAIN;
}
