import { expect, test } from '@playwright/test';
import { capture, openHarness, selectCell } from './support';

test('@parity:formatting.shortcuts applies bold italic and underline through browser keymaps', async ({ page }) => {
  await openHarness(page);
  await selectCell(page, 1, 1);
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+i');
  await page.keyboard.press('Control+u');
  await page.getByRole('combobox', { name: 'Number format' }).selectOption('percent');
  await page.getByRole('combobox', { name: 'Font' }).selectOption('Times New Roman');
  await page.getByRole('spinbutton', { name: 'Font size' }).fill('14');
  await page.getByRole('button', { name: 'Strike' }).click();
  await page.getByLabel('Text color').evaluate((element, value) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, '#123456');
  await page.getByLabel('Fill color').evaluate((element, value) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, '#fedcba');
  await page.getByRole('combobox', { name: 'Horizontal align' }).selectOption('center');
  await page.getByRole('combobox', { name: 'Vertical align' }).selectOption('middle');
  await page.getByRole('button', { name: 'Wrap text' }).click();
  await page.getByRole('combobox', { name: 'Borders' }).selectOption('outside');
  const value = await capture(page) as Array<{
    styles?: Array<Record<string, unknown>>;
    rows?: Record<string, { cells?: Record<string, { style?: number }> }>;
  }>;
  const styleIndex = value[0]?.rows?.['1']?.cells?.['1']?.style;
  expect(styleIndex).toEqual(expect.any(Number));
  expect(value[0]?.styles?.[styleIndex!]).toMatchObject({
    format: 'percent',
    font: { name: 'Times New Roman', size: 14, bold: true, italic: true },
    underline: true,
    strike: true,
    color: '#123456',
    bgcolor: '#fedcba',
    align: 'center',
    valign: 'middle',
    textwrap: true,
    border: {
      top: ['thin', '#000000'],
      right: ['thin', '#000000'],
      bottom: ['thin', '#000000'],
      left: ['thin', '#000000'],
    },
  });
});
