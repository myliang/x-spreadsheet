import { expect, test } from '@playwright/test';
import { capture, openHarness } from './support';

test('@parity:structure.resize-drag persists a column resize from the canvas header', async ({ page }) => {
  await openHarness(page);
  const box = await page.locator('.tego-sheet__canvas').boundingBox();
  if (box === null) throw new Error('canvas has no box');
  const x = box.x + 60 + 100;
  const y = box.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 25, y);
  await page.mouse.up();
  const value = await capture(page) as Array<{ cols?: Record<string, { width?: number }> }>;
  expect(value[0]?.cols?.['0']?.width).toBe(125);
});
