import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:tools.filter-menu applies checked browser menu values to the workbook', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('odd').uncheck();
  await dialog.getByRole('button', { name: 'Apply filter' }).click();
  const value = await capture(page) as Array<{ autofilter?: { filters?: Array<{ ci?: number; value?: string[] }> } }>;
  expect(value[0]?.autofilter?.filters).toEqual([{ ci: 0, operator: 'in', value: ['even'] }]);
});
