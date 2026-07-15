import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:formatting.shortcuts applies bold italic and underline through browser keymaps', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 1);
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+i');
  await page.keyboard.press('Control+u');
  const value = await capture(page) as Array<{
    styles?: Array<{ font?: { bold?: boolean; italic?: boolean }; underline?: boolean }>;
    rows?: Record<string, { cells?: Record<string, { style?: number }> }>;
  }>;
  const styleIndex = value[0]?.rows?.['1']?.cells?.['1']?.style;
  expect(styleIndex).toEqual(expect.any(Number));
  expect(value[0]?.styles?.[styleIndex!]).toMatchObject({
    font: { bold: true, italic: true },
    underline: true,
  });
});
