/*
 * Frontend Deployment Actions
 * This script is responsible for deploying the frontend configuration to an S3 bucket.
 * It retrieves the API URL from AWS Systems Manager Parameter Store and uploads a config.js file to the specified S3 bucket.
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../shared';

const ssm = new SSMClient({});
const s3 = new S3Client({});

export const handler = async (): Promise<void> => {
  const apiUrlParamName = process.env.API_URL_PARAMETER_NAME;
  const bucketName = process.env.WEBSITE_BUCKET_NAME;
  logger.info('Processing post-deployment action for frontend', {
    apiUrlParamName,
    bucketName,
  });

  if (!apiUrlParamName || !bucketName) {
    throw new Error('Missing required environment variables.');
  }

  // Step 1: Get the API URL from SSM
  const ssmCommand = new GetParameterCommand({
    Name: apiUrlParamName,
    WithDecryption: true,
  });

  const ssmResponse = await ssm.send(ssmCommand);
  const apiUrl = ssmResponse.Parameter?.Value;

  if (!apiUrl) {
    throw new Error(`Could not find API URL in SSM parameter: ${apiUrlParamName}`);
  }

  // Step 2: Generate config.js content
  const configJsContent = `window.API_BASE_URL = '${apiUrl}';`;

  // Step 3: Upload to S3
  const s3Command = new PutObjectCommand({
    Bucket: bucketName,
    Key: 'config.js',
    Body: configJsContent,
    ContentType: 'application/javascript',
  });

  await s3.send(s3Command);

  logger.info('config.js uploaded to bucket', bucketName);
};
