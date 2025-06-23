import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { EnvironmentConfig, Stage } from '../../config';
import * as path from 'path';

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

    // Create config.js with dynamic API URL
    // new BucketDeployment(this, 'ConfigDeployment', {
    //   sources: [Source.data('config.js', `window.API_BASE_URL = '${props.api.url}';`)],
    //   destinationBucket: websiteBucket,
    //   distribution: this.distribution,
    //   distributionPaths: ['/config.js'],
    // });

    // Add CORS preflight configuration for the API
    // props.api.root.addCorsPreflight({
    //   allowOrigins: [`https://${this.distribution.distributionDomainName}`, 'http://localhost:3000'],
    //   allowMethods: ['GET', 'POST', 'OPTIONS'],
    //   allowHeaders: [
    //     'Content-Type',
    //     'Authorization',
    //     'X-Amz-Date',
    //     'X-Api-Key',
    //     'X-Amz-Security-Token',
    //     'X-Amz-User-Agent',
    //   ],
    // });
  }
}
