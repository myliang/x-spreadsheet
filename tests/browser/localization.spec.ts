import { expect, test } from '@playwright/test';
import { openHarness } from './support';

test('@parity:locale.browser-default uses English fallback under the fixed browser locale', async ({ page }) => {
  await openHarness(page);
  expect(await page.evaluate(() => navigator.language)).toBe('en-US');
  await expect(page.getByRole('toolbar', { name: 'Spreadsheet toolbar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Data validation' })).toBeVisible();
});
