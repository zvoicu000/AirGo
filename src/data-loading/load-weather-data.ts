/*
 * Example Lambda Function
 * This is an example of a simple AWS Lambda function that can be used as a template
 */

import { logger } from '../shared';

/**
 * Lambda Handler
 *
 * @param {object} event - The event object containing the payload passed to this function.
 * @param {object} context - The context object provided by the AWS Lambda runtime.
 */
export const handler = async () => {
  logger.info('Processing Example Lambda Function');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Example Lambda Function Response',
    }),
  };
};
