import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, CustomResource } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { EnvironmentConfig, Stage } from '../../config';
import { CustomLambda } from '../constructs';
import * as path from 'path';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';

interface FrontendResourcesProps extends StackProps {
  stage: Stage;
  envConfig: EnvironmentConfig;
}

export class FrontendStack extends Stack {
  public distribution: Distribution;

  constructor(scope: Construct, id: string, props: FrontendResourcesProps) {
    super(scope, id, props);

    // Create an S3 bucket to host the React application
    const websiteBucket = new Bucket(this, 'DroneServiceWebsiteBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create an Origin Access Identity for CloudFront
    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
    websiteBucket.grantRead(originAccessIdentity);

    // Create CloudFront distribution
    this.distribution = new Distribution(this, 'DroneServiceWebsiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Deploy the React application to S3
    new BucketDeployment(this, 'WebsiteDeployment', {
      sources: [
        Source.asset(path.join(__dirname, '../../frontend/build'), {
          exclude: ['config.js'],
        }),
      ],
      destinationBucket: websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // Create a Lambda function that will perform post deployment actions to update the API URL in the config.js file
    const frontendPostDeploymentActionFunction = new CustomLambda(this, 'FrontendPostDeploymentActionFunction', {
      envConfig: props.envConfig,
      source: 'src/deployment/frontend-deployment-actions.ts',
      environmentVariables: {
        API_URL_PARAMETER_NAME: props.envConfig.apiUrlParameterName,
        WEBSITE_BUCKET_NAME: websiteBucket.bucketName,
      },
    }).lambda;

    // Grant the Lambda function permissions to read the API URL from SSM and write to the S3 bucket
    frontendPostDeploymentActionFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${props.envConfig.apiUrlParameterName}`],
      }),
    );
    websiteBucket.grantWrite(frontendPostDeploymentActionFunction);

    // Invoke the Lambda function as a post-deployment action
    const provider = new Provider(this, 'ConfigUploaderProvider', {
      onEventHandler: frontendPostDeploymentActionFunction,
    });

    new CustomResource(this, 'PerformFrontendPostDeploymentActions', {
      serviceToken: provider.serviceToken,
    });

    // Output the CloudFront distribution domain name
    this.exportValue(this.distribution.distributionDomainName, {
      name: 'CloudFrontDistributionDomainName',
      description: 'The domain name of the CloudFront distribution for the Drone Delivery Service',
    });
  }
}
