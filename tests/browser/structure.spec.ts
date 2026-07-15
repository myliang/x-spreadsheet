import { expect, test } from '@playwright/test';
import { capture, openCellMenu, openHarness } from './support';

test('@parity:structure.resize-drag exercises structure mutations and sheet management through browser chrome', async ({ page }) => {
  await openHarness(page);
  let value = await capture(page) as Array<{
    name?: string;
    rows?: Record<string, unknown> & { len?: number };
    cols?: Record<string, unknown> & { len?: number };
  }>;

  await openCellMenu(page, 2, 0);
  await page.getByRole('menuitem', { name: 'Insert row', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.len).toBe(61);
  expect(value[0]?.rows?.['2']).toBeUndefined();
  expect(value[0]?.rows?.['3']).toMatchObject({ cells: { 0: { text: 'even' } } });
  await openCellMenu(page, 2, 0);
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.len).toBe(60);
  expect(value[0]?.rows?.['2']).toMatchObject({ cells: { 0: { text: 'even' } } });

  await openCellMenu(page, 1, 1);
  await page.getByRole('menuitem', { name: 'Insert column', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.cols?.len).toBe(13);
  expect(value[0]?.rows?.['1']).toMatchObject({ cells: { 2: { text: '1' } } });
  await openCellMenu(page, 1, 1);
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.cols?.len).toBe(12);
  expect(value[0]?.rows?.['1']).toMatchObject({ cells: { 1: { text: '1' } } });

  await openCellMenu(page, 2, 0);
  await page.getByRole('menuitem', { name: 'Hide row', exact: true }).click();
  await openCellMenu(page, 1, 1);
  await page.getByRole('menuitem', { name: 'Hide column', exact: true }).click();
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.['2']).toMatchObject({ hide: true });
  expect(value[0]?.cols?.['1']).toMatchObject({ hide: true });

  const box = await page.locator('.tego-sheet__canvas').boundingBox();
  if (box === null) throw new Error('canvas has no box');

  const columnX = box.x + 60 + 100;
  const columnY = box.y + 12;
  await page.mouse.move(columnX, columnY);
  await page.mouse.down();
  await page.mouse.move(columnX + 25, columnY);
  await page.mouse.up();

  const rowX = box.x + 30;
  const rowY = box.y + 25 + 25;
  await page.mouse.move(rowX, rowY);
  await page.mouse.down();
  await page.mouse.move(rowX, rowY + 15);
  await page.mouse.up();

  value = await capture(page) as typeof value;
  expect(value[0]?.cols?.['0']).toMatchObject({ width: 125 });
  expect(value[0]?.rows?.['0']).toMatchObject({ height: 40 });

  await page.getByRole('button', { name: 'Add sheet', exact: true }).click();
  const added = page.getByRole('tab', { name: 'sheet2', exact: true });
  await expect(added).toHaveAttribute('aria-selected', 'false');
  await added.click();
  await expect(added).toHaveAttribute('aria-selected', 'true');
  await added.dblclick();
  const rename = page.getByRole('textbox', { name: 'Rename sheet' });
  await rename.fill('Renamed');
  await rename.press('Enter');
  await page.getByRole('tab', { name: 'Browser', exact: true }).click();
  await page.getByRole('button', { name: 'Delete sheet Renamed', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Renamed', exact: true })).toHaveCount(0);
  value = await capture(page) as typeof value;
  expect(value.map(sheet => sheet.name)).toEqual(['Browser']);
});
