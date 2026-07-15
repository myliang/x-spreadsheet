import { expect, test } from '@playwright/test';
import { capture, dispatchClipboard, openHarness, selectCell } from './support';

test('@parity:clipboard.system-bridge covers copy, cut, internal/external paste, and denial', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await dispatchClipboard(page, 'copy');
  await expect.poll(() => page.evaluate(() => window.__tegoClipboard?.writes)).toEqual(['odd']);
  await selectCell(page, 2, 0);
  await dispatchClipboard(page, 'paste');
  let value = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(value[0]?.rows?.['2']?.cells?.['0']?.text).toBe('odd');

  await selectCell(page, 1, 1);
  await dispatchClipboard(page, 'cut');
  await selectCell(page, 3, 1);
  await dispatchClipboard(page, 'paste');
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.['1']?.cells?.['1']?.text ?? '').toBe('');
  expect(value[0]?.rows?.['3']?.cells?.['1']?.text).toBe('1');

  await selectCell(page, 4, 0);
  await dispatchClipboard(page, 'paste', 'alpha\tbeta\r\ngamma\tdelta');
  value = await capture(page) as typeof value;
  expect(value[0]?.rows?.['4']?.cells?.['0']?.text).toBe('alpha');
  expect(value[0]?.rows?.['4']?.cells?.['1']?.text).toBe('beta');
  expect(value[0]?.rows?.['5']?.cells?.['0']?.text).toBe('gamma');
  expect(value[0]?.rows?.['5']?.cells?.['1']?.text).toBe('delta');

  await page.reload();
  await openHarness(page);
  await selectCell(page, 1, 0);
  await dispatchClipboard(page, 'paste');
  await expect.poll(() => page.evaluate(() => window.__tegoClipboard?.reads)).toBe(1);
  const pasted = await capture(page) as typeof value;
  expect(pasted[0]?.rows?.['1']?.cells?.['0']?.text).toBe('pasted');
  expect(pasted[0]?.rows?.['1']?.cells?.['1']?.text).toBe('from-browser');

  await page.goto('/?clipboard=deny');
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-mode', 'controlled');
  await selectCell(page, 1, 0);
  await dispatchClipboard(page, 'paste');
  await expect(page.locator('[role="status"][data-error-code="CLIPBOARD_DENIED"]')).toBeVisible();
});
