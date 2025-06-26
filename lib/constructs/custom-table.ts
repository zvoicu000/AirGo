/**
 * A custom CDK construct for creating a DynamoDB table with optional pre-population of data from a local path.
 *
 * This construct:
 * - Creates a DynamoDB table with sensible defaults (PAY_PER_REQUEST billing, AWS-managed encryption, PITR, and contributor insights).
 * - Optionally, if a `dataPath` is provided in the props, uploads local JSON files to a temporary S3 bucket and configures the table to import this data on creation.
 * - Ensures resources are cleaned up by setting appropriate removal policies.
 * - Adds dependencies to ensure correct resource creation order.
 *
 * @remarks
 * The table is only pre-populated when required, as determined by the presence of `dataPath`.
 *
 * @example
 * ```typescript
 * new CustomTable(this, 'MyTable', {
 *   partitionKey: { name: 'PK', type: AttributeType.STRING },
 *   dataPath: './seed-data'
 * });
 * ```
 *
 * @extends Construct
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import {
  Table,
  TableProps,
  Attribute,
  BillingMode,
  TableEncryption,
  InputFormat,
  InputCompressionType,
  GlobalSecondaryIndexProps,
} from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';

interface CustomTableProps
  extends Pick<TableProps, 'removalPolicy' | 'partitionKey' | 'tableName' | 'sortKey' | 'stream'> {
  stageName: string; //The stage name which the dynamodb table is being used with
  partitionKey: Attribute; // The partition key attribute for the table
  removalPolicy: RemovalPolicy; //The removal policy for the table
  dataPath?: string; // The optional data path to the json files
  globalSecondaryIndexes?: GlobalSecondaryIndexProps[]; // Optional global secondary indexes to add to the table
}

type FixedCustomTableProps = Omit<TableProps, 'removalPolicy' | 'partitionKey' | 'tableName' | 'sortKey'>;

export class CustomTable extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: CustomTableProps) {
    super(scope, id);

    let importSource;
    let deployment;

    const fixedProps: FixedCustomTableProps = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 7,
      },
      contributorInsightsEnabled: true,
      timeToLiveAttribute: 'ttl',
    };

    // if we have provided a dataPath, we will pre-populate the table with data
    if (props.dataPath) {
      // Create a temporary S3 bucket to hold the data files
      const dynamoDbSeedDataBucket = new Bucket(this, 'DynamoDbSeedDataBucket', {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      });

      // create the deployment of the local json files into s3 for the table import
      deployment = new BucketDeployment(this, 'BucketDeployment', {
        sources: [Source.asset(props.dataPath)],
        exclude: ['*.DS_Store'],
        destinationBucket: dynamoDbSeedDataBucket,
      });

      // we only pre-populate the table in non prod stages
      importSource = {
        bucket: dynamoDbSeedDataBucket,
        inputFormat: InputFormat.dynamoDBJson(),
        compressionType: InputCompressionType.GZIP,
      };

      deployment.node.addDependency(dynamoDbSeedDataBucket);
    }

    this.table = new Table(this, id, {
      ...fixedProps,
      ...(importSource && { importSource: importSource }),
      ...props,
    });

    // if we have a dataPath, we add a dependency on the bucket deployment
    if (props.dataPath) {
      this.table.node.addDependency(deployment as BucketDeployment);
    }

    // Add any global secondary indexes if provided
    if (props.globalSecondaryIndexes) {
      for (const index of props.globalSecondaryIndexes) {
        this.table.addGlobalSecondaryIndex(index);
      }
    }
  }
}
