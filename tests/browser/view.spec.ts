import { expect, test } from '@playwright/test';
import { cellPoint, openHarness, selection } from './support';

test('@parity:view.zoom-scroll keeps canvas hit testing aligned after consumer zoom and scrolling', async ({ page }) => {
  await openHarness(page);
  await page.getByRole('button', { name: 'Toggle zoom' }).click();
  const canvas = page.locator('.tego-sheet__canvas');
  await canvas.hover({ position: { x: 200, y: 200 } });
  for (let index = 0; index < 5; index += 1) await page.mouse.wheel(0, 100);
  const point = await cellPoint(page, 0, 0);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await selection(page))?.active.row ?? -1).toBeGreaterThanOrEqual(5);
});
