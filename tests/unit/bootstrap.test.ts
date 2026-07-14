import { expect, it } from 'vitest';

it('imports the library entry without browser globals', async () => {
  const entry = await import('../../src/index');

  expect(Object.getOwnPropertyNames(entry)).toEqual(['TegoSheetException']);
});
