import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:clipboard.system-bridge uses the browser clipboard and reports permission denial', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.evaluate(() => window.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true })));
  await expect.poll(() => page.evaluate(() => window.__tegoClipboard?.writes)).toEqual(['odd']);

  await page.reload();
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.evaluate(() => window.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true })));
  await expect.poll(() => page.evaluate(() => window.__tegoClipboard?.reads)).toBe(1);
  const pasted = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(pasted[0]?.rows?.['1']?.cells?.['0']?.text).toBe('pasted');
  expect(pasted[0]?.rows?.['1']?.cells?.['1']?.text).toBe('from-browser');

  await page.goto('/?clipboard=deny');
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-mode', 'controlled');
  await selectCell(page, 1, 0);
  await page.evaluate(() => window.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true })));
  await expect(page.locator('[role="status"][data-error-code="CLIPBOARD_DENIED"]')).toBeVisible();
});
