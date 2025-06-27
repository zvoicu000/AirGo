/*
 * CDK Stack - Frontend Resources
 *
 * This CDK stack sets up the frontend resources for the Drone Delivery Service.
 * This contains the S3 bucket for hosting the React application and the CloudFront distribution for serving it.
 *
 * This software is licensed under the GNU General Public License v3.0.
 */

import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
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

    // Create CloudFront distribution
    this.distribution = new Distribution(this, 'DroneServiceWebsiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
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
          exclude: ['config.js', 'config.js.example'],
        }),
      ],
      destinationBucket: websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: false,
    });

    // Output the CloudFront distribution domain name
    this.exportValue(this.distribution.distributionDomainName, {
      name: 'CloudFrontDistributionDomainName',
      description: 'The domain name of the CloudFront distribution for the Drone Delivery Service',
    });
  }
}
