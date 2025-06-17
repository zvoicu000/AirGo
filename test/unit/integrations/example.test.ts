import { handler } from '../../../src/data-loading/load-weather-data';

describe('Example Lambda Function', () => {
  test('successful execution', async () => {
    const result = await handler();

    expect(result).toBeDefined();
  });
});
