import { expect, test } from '@playwright/test';
import {
  capture,
  cellPoint,
  dragCells,
  openCellMenu,
  openHarness,
  selectCell,
  selection,
} from './support';

test('@parity:view.zoom-scroll keeps canvas hit testing aligned after consumer zoom and scrolling', async ({ page }) => {
  await openHarness(page);
  await expect(page.getByRole('toolbar', { name: 'Spreadsheet toolbar' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Sheets' })).toBeVisible();
  await selectCell(page, 1, 1);
  await page.getByRole('button', { name: 'Freeze', exact: true }).click();
  let value = await capture(page) as Array<{ freeze?: string }>;
  expect(value[0]?.freeze).toBe('B2');
  await page.getByRole('button', { name: 'Unfreeze', exact: true }).click();

  await openCellMenu(page, 1, 0);
  await page.getByRole('menu', { name: 'Cell actions' }).press('Escape');
  await expect(page.getByRole('menu', { name: 'Cell actions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle grid' }).click();
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-grid-visible', 'false');
  await page.getByRole('button', { name: 'Toggle grid' }).click();
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-grid-visible', 'true');

  await page.getByRole('button', { name: 'Toggle zoom' }).click();
  await selectCell(page, 1, 1);
  expect(await selection(page)).toMatchObject({ active: { row: 1, column: 1 } });
  await dragCells(page, { row: 1, column: 1 }, { row: 2, column: 1 });
  expect(await selection(page)).toMatchObject({
    active: { row: 2, column: 1 },
    range: { start: { row: 1, column: 1 }, end: { row: 2, column: 1 } },
  });
  const canvas = page.locator('.tego-sheet__canvas');
  await canvas.hover({ position: { x: 200, y: 200 } });
  for (let index = 0; index < 5; index += 1) await page.mouse.wheel(0, 100);
  const point = await cellPoint(page, 0, 0);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await selection(page))?.active.row ?? -1).toBeGreaterThanOrEqual(5);
  value = await capture(page) as typeof value;
  expect(value[0]?.freeze ?? 'A1').toBe('A1');
});
