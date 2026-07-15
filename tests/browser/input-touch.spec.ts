import { expect, test } from '@playwright/test';
import { capture, cellPoint, openHarness, selection } from './support';

test('@parity:input.touch-gestures supports tap, double-tap editing, and swipe scrolling', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('-touch'), 'Touch behavior runs in the three touch projects.');
  await openHarness(page);
  const before = await capture(page);
  const point = await cellPoint(page, 1, 0);
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(async () => (await selection(page))?.active).toEqual({ row: 1, column: 0 });
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.getByRole('textbox', { name: 'Cell editor' })).toBeVisible();
  await page.keyboard.press('Escape');

  const canvas = page.locator('.tego-sheet__canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas has no box');
  const x = box.x + 200;
  const startY = box.y + 300;
  const endY = box.y + 150;
  await canvas.dispatchEvent('touchstart', {
    touches: [{ identifier: 1, clientX: x, clientY: startY }],
  });
  await canvas.dispatchEvent('touchmove', {
    touches: [{ identifier: 1, clientX: x, clientY: endY }],
  });
  await canvas.dispatchEvent('touchend', {
    changedTouches: [{ identifier: 1, clientX: x, clientY: endY }],
    touches: [],
  });
  const top = await cellPoint(page, 0, 0);
  await page.touchscreen.tap(top.x, top.y);
  await expect.poll(async () => (await selection(page))?.active.row ?? -1).toBeGreaterThan(0);
  const after = await capture(page);
  expect(after).toEqual(before);
});
