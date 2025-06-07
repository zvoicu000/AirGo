import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Pipeline, PipelineType, ExecutionMode } from 'aws-cdk-lib/aws-codepipeline';
import { CodePipeline, CodePipelineSource, ManualApprovalStep, ShellStep } from 'aws-cdk-lib/pipelines';
import { ApplicationStage } from './application-stage';
import { EnvironmentConfig } from '../config';

interface PipelineProps extends StackProps {
  repoName: string;
  gitHubConnectionArn: string;
  envConfig: EnvironmentConfig;
  branch: string;
  preApproval: boolean;
}

/**
 * Represents a stack that defines a deployment pipeline using AWS CDK.
 *
 * This stack sets up a CodePipeline with a GitHub source and uses the CDK's
 * opinionated `CodePipeline` construct to define the pipeline stages and actions.
 * As the CodePipeline CDK construct currently does not support Code Pipeline V2,
 * this stack uses the `Pipeline` class to define the pipeline which is then imported into
 * the `CodePipeline` class.
 *
 * @extends Stack
 *
 * @param scope - The scope in which this stack is defined.
 * @param id - The unique identifier for this stack.
 * @param props - The properties for configuring the pipeline stack.
 *
 * Properties in `props`:
 * - `repoName` (string): The name of the GitHub repository.
 * - `gitHubConnectionArn` (string): The ARN of the GitHub connection in AWS CodeStar Connections.
 * - `envConfig` (object): The environment configuration, including the environment name.
 * - `branch` (string): The branch of the repository to use as the source.
 * - `preApproval` (boolean): Whether a manual approval step is required before deployment.
 *
 * The pipeline includes:
 * - A source stage that pulls code from the specified GitHub repository and branch.
 * - A synth stage that installs dependencies, builds the project, and synthesizes the CDK app.
 * - A deployment stage that deploys the application to the target environment.
 *
 * If `preApproval` is set to true, a manual approval step is added before deployment.
 */
export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    // Environment props
    const { repoName, gitHubConnectionArn, envConfig, branch, preApproval } = props;

    // Define the code pipeline that will be used by the opinionated CDK Pipeline construct
    const codePipeline = new Pipeline(this, `${envConfig.name}-CodePipeline`, {
      pipelineName: `${envConfig.name}-Deployment-Pipeline`,
      pipelineType: PipelineType.V2,
      executionMode: ExecutionMode.QUEUED,
      restartExecutionOnUpdate: true,
      crossAccountKeys: true,
    });

    // Use the opinionated CDK Pipeline construct to define the pipeline
    const pipeline = new CodePipeline(this, `${envConfig.name}-Pipeline`, {
      codePipeline: codePipeline,
      selfMutation: true,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(repoName, branch, {
          connectionArn: gitHubConnectionArn,
        }),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    // Deploy to the target account
    pipeline.addStage(new ApplicationStage(this, envConfig.name, envConfig), {
      pre: preApproval ? [new ManualApprovalStep('PreApproval')] : [],
    });
  }
}
