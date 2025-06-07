import { Logger } from '@aws-lambda-powertools/logger';

export const logger = new Logger({
  logBufferOptions: {
    enabled: true,
    bufferAtVerbosity: 'DEBUG',
    maxBytes: 20480,
    flushOnErrorLog: true,
  },
});
