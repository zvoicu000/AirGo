import { Region, Stage } from './types';
import { EnvironmentConfig, getEnvironmentConfig } from './environment-config';

export interface PipelineConfig {
  repoName: string;
  gitHubConnectionArn: string;
  pipelineName: string; // Name of the pipeline stack
  stackNamePrefix: string; // Prefix for the Pipeline stack names - specified so we have a predictable role name
  pipelineAccount: string;
  pipelineRegion: string;
  pipelines: {
    envConfig: EnvironmentConfig;
    branch: string;
    preApproval: boolean; // Require approval before Create Change Set
  }[];
}

/**
 * Configuration object for defining the pipeline setup.
 *
 * @constant
 * @type {PipelineConfig}
 *
 * @property {string} repoName - The name of the repository associated with the pipeline.
 * @property {string} gitHubConnectionArn - The ARN of the GitHub connection used for the pipeline.
 * @property {string} pipelineName - The name of the pipeline.
 * @property {string} stackNamePrefix - The prefix for stack names created by the pipeline.
 * @property {string} pipelineAccount - The AWS account ID where the pipeline is hosted.
 * @property {Region} pipelineRegion - The primary region where the pipeline operates.
 * @property {Array<Object>} pipelines - An array of pipeline stage configurations.
 *
 * Each pipeline stage configuration includes:
 * - `envConfig` (EnvironmentConfig): The environment-specific configuration for the stage.
 * - `branch` (string): The branch in the repository associated with the stage.
 * - `preApproval` (boolean): Indicates whether manual approval is required before deployment.
 */
export const pipelineConfig: PipelineConfig = {
  repoName: 'Crockwell-Solutions/drone-delivery-service',
  gitHubConnectionArn: 'arn:aws:codeconnections:us-east-1:384064000282:connection/2c2d9dcf-336f-4c3a-86f0-eebe908d8a35',
  pipelineName: 'PlatformPipeline',
  stackNamePrefix: 'Pipeline',
  pipelineAccount: '384064000282',
  pipelineRegion: Region.primary,
  pipelines: [
    {
      envConfig: getEnvironmentConfig(Stage.dev),
      branch: 'dev',
      preApproval: false,
    },
    {
      envConfig: getEnvironmentConfig(Stage.stg),
      branch: 'stg',
      preApproval: false,
    },
    {
      envConfig: getEnvironmentConfig(Stage.prod),
      branch: 'prod',
      preApproval: true,
    },
  ],
};
