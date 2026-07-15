import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:formulas.keyboard-commit commits a formula through the browser editor', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 2);
  await page.keyboard.type('=B2*3');
  await expect(page.getByRole('textbox', { name: 'Cell editor' })).toHaveValue('=B2*3');
  await page.keyboard.press('Enter');
  const value = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(value[0]?.rows?.['1']?.cells?.['2']?.text).toBe('=B2*3');
});
