import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell, selection } from './support';

test('@parity:tools.filter-menu proves visible filtering, sorting, and validation serialization', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('odd').uncheck();
  await dialog.getByRole('button', { name: 'Apply filter' }).click();
  let value = await capture(page) as Array<{
    autofilter?: {
      filters?: Array<{ ci?: number; operator?: string; value?: string[] }>;
      sort?: { ci?: number; order?: string };
    };
    rows?: Record<string, { cells?: Record<string, { text?: string }> }>;
    validations?: Array<Record<string, unknown>>;
  }>;
  expect(value[0]?.autofilter?.filters).toEqual([{ ci: 0, operator: 'in', value: ['even'] }]);

  await selectCell(page, 1, 0);
  await expect.poll(async () => (await selection(page))?.active.row).toBe(2);

  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('odd').check();
  await dialog.getByRole('button', { name: 'Apply filter' }).click();

  await selectCell(page, 2, 0);
  await page.getByRole('button', { name: 'Freeze', exact: true }).click();
  await page.getByRole('button', { name: 'Sort ascending', exact: true }).click();
  await selectCell(page, 1, 0);
  await expect.poll(async () => (await selection(page))?.active.row).toBe(2);
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await selection(page))?.active.row).toBe(4);
  await selectCell(page, 2, 0);
  await expect.poll(async () => (await selection(page))?.active.row).toBe(4);

  await page.getByRole('button', { name: 'Sort descending', exact: true }).click();
  await selectCell(page, 1, 0);
  await expect.poll(async () => (await selection(page))?.active.row).toBe(1);
  await selectCell(page, 2, 0);
  await expect.poll(async () => (await selection(page))?.active.row).toBe(3);
  await page.getByRole('button', { name: 'Unfreeze', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.autofilter?.sort).toEqual({ ci: 0, order: 'desc' });

  await page.getByRole('button', { name: 'Clear filter', exact: true }).click();
  await selectCell(page, 1, 0);
  await page.getByRole('button', { name: 'Data validation', exact: true }).click();
  const validation = page.getByRole('dialog', { name: 'Data validation' });
  await validation.getByLabel('Type').selectOption('email');
  await validation.getByLabel('Required').check();
  await validation.getByRole('button', { name: 'Save', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.validations).toEqual([{
    refs: ['A2'],
    mode: 'cell',
    type: 'email',
    required: true,
  }]);

  await page.getByRole('button', { name: 'Validate workbook' }).click();
  const result = JSON.parse(await page.getByTestId('validation').textContent() ?? 'null') as {
    valid?: boolean;
    issues?: Array<{ address?: { row?: number; column?: number }; rule?: { type?: string } }>;
  };
  expect(result.valid).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({
    address: expect.objectContaining({ row: 1, column: 0 }),
    rule: expect.objectContaining({ type: 'email' }),
  }));
});
