import { expect, test } from '@playwright/test';
import { cellPoint, openHarness, selection } from './support';

test('@parity:selection.pointer-drag selects the exact canvas range under browser layout', async ({ page }) => {
  await openHarness(page);
  const start = await cellPoint(page, 1, 1);
  const end = await cellPoint(page, 3, 2);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  await expect.poll(() => selection(page)).toMatchObject({
    active: { row: 3, column: 2 },
    range: { start: { row: 1, column: 1 }, end: { row: 3, column: 2 } },
  });
});
