import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:editing.ime-input keeps composition in the editor until explicit commit', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 0);
  await page.keyboard.press('F2');
  const editor = page.getByRole('textbox', { name: 'Cell editor' });
  await expect(editor).toBeFocused();
  await editor.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '漢' }));
    const textarea = element as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, '漢字');
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: '漢字', inputType: 'insertCompositionText' }));
    textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '漢字' }));
  });
  await expect(editor).toHaveValue('漢字');
  await page.keyboard.press('Enter');
  const value = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(value[0]?.rows?.['1']?.cells?.['0']?.text).toBe('漢字');

  await page.getByRole('button', { name: 'Toggle read only' }).click();
  await selectCell(page, 1, 0);
  await page.locator('[data-tego-sheet]').focus();
  await page.keyboard.press('F2');
  await expect(page.getByRole('textbox', { name: 'Cell editor' })).toHaveCount(0);
  await page.keyboard.type('blocked');
  const readOnlyValue = await capture(page) as Array<{ rows?: Record<string, { cells?: Record<string, { text?: string }> }> }>;
  expect(readOnlyValue[0]?.rows?.['1']?.cells?.['0']?.text).toBe('漢字');
});
