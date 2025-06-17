/*
 * Example Lambda Function
 * This is an example of a simple AWS Lambda function that can be used as a template
 */

import * as xml2js from 'xml2js';
import * as zlib from 'zlib';
import axios from 'axios';
import { logger } from '../shared';

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const GEOHASH_PRECISION = parseFloat(process.env.GEOHASH_PRECISION || '5');
const WEATHER_DATA_SOURCE_URL = process.env.WEATHER_DATA_SOURCE_URL || '';

// Initialize XML parser
const parser = new xml2js.Parser();

/**
 * Lambda Handler
 *
 * @param {object} event - The event object containing the payload passed to this function.
 * @param {object} context - The context object provided by the AWS Lambda runtime.
 */
export const handler = async () => {
  logger.info('Loading and processing weather data');

  const response = await axios.get(WEATHER_DATA_SOURCE_URL, {
    responseType: 'arraybuffer',
    headers: {
      'Accept-Encoding': 'gzip',
    },
  });
  const buffer = Buffer.from(response.data, 'binary');
  const data = zlib.gunzipSync(buffer).toString().trim();

  logger.info('XML METAR data received of length', { length: data.length });
  const weatherData = await parser.parseStringPromise(data);
  const metarReports = weatherData?.response?.data[0]?.METAR || [];
  logger.info('Parsed weather data successfully', { count: metarReports.length });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Weather data loaded successfully',
    }),
  };
};
