import { expect, test } from '@playwright/test';
import { capture, openHarness } from './support';

test('@parity:workbook.import-export imports controlled data and exports canonical workbook data', async ({ page }) => {
  await openHarness(page);
  await page.getByRole('button', { name: 'Import workbook' }).click();
  const value = await capture(page);
  expect(value).toHaveLength(1);
  expect(value[0]).toMatchObject({ name: 'Browser', rows: { len: 60 }, cols: { len: 12 } });
});
