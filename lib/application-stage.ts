import { Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StatefulStack } from '../stateful/stateful-stack';
import { StatelessStack } from '../stateless/stateless-stack';
import { EnvironmentConfig } from '../config';

/**
 * Represents an application stage that extends the `Stage` class.
 * This stage is responsible for creating and managing the stateful and stateless stacks
 * within the application, ensuring proper dependency order between them.
 * This the application that is deployed by the CodePipeline
 */
export class ApplicationStage extends Stage {
  constructor(scope: Construct, id: string, props: EnvironmentConfig) {
    super(scope, id, props);
    const envConfig = props;

    const statefulStack = new StatefulStack(this, 'StatefulStack', {
      stage: envConfig.stage,
      envConfig: envConfig,
    });

    const statelessStack = new StatelessStack(this, 'StatelessStack', {
      stage: envConfig.stage,
      envConfig: envConfig,
    });

    // Ensure the stateful stack is deployed before the stateless stack
    statelessStack.addDependency(statefulStack);
  }
}
