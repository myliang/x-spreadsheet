import { expect, test } from '@playwright/test';
import { capture, cellPoint, openHarness, selectCell } from './support';

test('@parity:ranges.drag-fill autofills from the canvas selection handle', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  const source = await cellPoint(page, 1, 0);
  const target = await cellPoint(page, 3, 0);
  await page.mouse.move(source.x + 48, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + 48, target.y + 10);
  await page.mouse.up();
  const value = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(value[0]?.rows?.['2']?.cells?.['0']?.text).toBe('odd');
  expect(value[0]?.rows?.['3']?.cells?.['0']?.text).toBe('odd');
});
