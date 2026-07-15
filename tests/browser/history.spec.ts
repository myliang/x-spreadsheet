import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

async function textAt(page: Parameters<typeof capture>[0]) {
  const value = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  return value[0]?.rows?.['1']?.cells?.['0']?.text;
}

test('@parity:history.shortcuts applies browser undo and redo shortcuts', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.keyboard.type('changed');
  await page.keyboard.press('Enter');
  expect(await textAt(page)).toBe('changed');
  await page.locator('[data-tego-sheet]').focus();
  await page.keyboard.press('Control+z');
  expect(await textAt(page)).toBe('odd');
  await page.locator('[data-tego-sheet]').focus();
  await page.keyboard.press('Control+y');
  expect(await textAt(page)).toBe('changed');
});
