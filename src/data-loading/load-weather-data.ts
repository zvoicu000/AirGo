/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Lambda function to load weather data from METAR reports into DynamoDB
 */

import * as xml2js from 'xml2js';
import * as zlib from 'zlib';
import axios from 'axios';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { logger } from '../shared';
import { WeatherReport } from '../models/weather-report';

// Load environment variables
const SPATIAL_DATA_TABLE = process.env.SPATIAL_DATA_TABLE;
const WEATHER_DATA_SOURCE_URL = process.env.WEATHER_DATA_SOURCE_URL || '';

// Initialize XML parser and DynamoDB client
const parser = new xml2js.Parser();
const ddbClient = DynamoDBDocument.from(new DynamoDB({}));

/**
 * Batch writes items to DynamoDB in chunks of 25
 * @param items Array of items to write
 */
async function batchWriteItems(items: any[], stats: any): Promise<void> {
  const batchSize = 25;
  const batches = [];

  // Split items into batches of 25
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Process each batch
  for (const batch of batches) {
    const writeRequests = batch.map((item) => ({
      PutRequest: {
        Item: item,
      },
    }));

    try {
      await ddbClient.batchWrite({
        RequestItems: {
          [SPATIAL_DATA_TABLE!]: writeRequests,
        },
      });
      logger.info('Successfully wrote batch to DynamoDB', { count: batch.length });
      stats.processedReports += batch.length;
    } catch (error) {
      logger.error('Error writing batch to DynamoDB', { error: error, batch: batch });
      stats.errors += batch.length;
    }
  }
}

/**
 * Lambda Handler
 *
 * @param {object} event - The event object containing the payload passed to this function.
 * @param {object} context - The context object provided by the AWS Lambda runtime.
 */
export const handler = async () => {
  logger.info('Loading and processing weather data');

  const stats = {
    weatherReports: 0,
    parsedWeatherReports: 0,
    processedReports: 0,
    errors: 0,
  };

  try {
    // Fetch and decompress METAR data
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
    stats.weatherReports = metarReports.length;

    // Process METAR reports into WeatherReport objects
    const weatherItems = metarReports
      .map((metar: any) => {
        const report = new WeatherReport(metar);
        return report.getDynamoDBJson();
      })
      .filter((item: any) => item !== undefined); // Filter out invalid reports

    logger.info('Created weather reports', { count: weatherItems.length });
    stats.parsedWeatherReports = weatherItems.length;

    // Write items to DynamoDB in batches
    if (weatherItems.length > 0) {
      await batchWriteItems(weatherItems, stats);
      logger.info('Successfully wrote all weather reports to DynamoDB');
    }

    logger.info('Weather data processing complete', { stats });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Weather data loaded successfully',
        processedCount: weatherItems.length,
      }),
    };
  } catch (error) {
    logger.error('Error processing weather data', { error });
    throw error;
  }
};
