import { expect, test } from '@playwright/test';
import { capture, cellPoint, dragCells, openHarness, selectCell } from './support';

test('@parity:ranges.drag-fill exercises merge, format painting, clearing, and autofill through browser UI', async ({ page }) => {
  await openHarness(page);

  await dragCells(page, { row: 1, column: 1 }, { row: 2, column: 2 });
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  let value = await capture(page) as Array<{
    merges?: string[];
    styles?: Array<{ font?: { bold?: boolean } }>;
    rows?: Record<string, { cells?: Record<string, { merge?: number[]; style?: number; text?: string }> }>;
  }>;
  expect(value[0]?.merges).toContain('B2:C3');
  expect(value[0]?.rows?.['1']?.cells?.['1']?.merge).toEqual([1, 1]);
  await page.getByRole('button', { name: 'Unmerge', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.merges).not.toContain('B2:C3');
  expect(value[0]?.rows?.['1']?.cells?.['1']?.merge).toBeUndefined();

  await selectCell(page, 1, 1);
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.getByRole('button', { name: 'Paint format', exact: true }).click();
  await selectCell(page, 1, 2);
  value = await capture(page) as typeof value;
  const paintedStyle = value[0]?.rows?.['1']?.cells?.['2']?.style;
  expect(paintedStyle).toEqual(expect.any(Number));
  expect(value[0]?.styles?.[paintedStyle!]).toMatchObject({ font: { bold: true } });
  await page.getByRole('button', { name: 'Clear format', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.['1']?.cells?.['2']?.style).toBeUndefined();

  await selectCell(page, 1, 0);
  const source = await cellPoint(page, 1, 0);
  const target = await cellPoint(page, 3, 0);
  await page.mouse.move(source.x + 48, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + 48, target.y + 10);
  await page.mouse.up();
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.['2']?.cells?.['0']?.text).toBe('odd');
  expect(value[0]?.rows?.['3']?.cells?.['0']?.text).toBe('odd');
});
