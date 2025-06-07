import { handler } from '../../../src/integrations/example';

describe('Example Lambda Function', () => {
  test('successful execution', async () => {
    const result = await handler();

    expect(result).toBeDefined();
  });
});
