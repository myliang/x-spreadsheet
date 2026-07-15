import { expect, test } from '@playwright/test';
import { openHarness } from './support';

test('@parity:output.export-download crosses the consumer download and library print boundaries', async ({ page }) => {
  await openHarness(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download workbook' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('workbook.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toHaveLength(1);

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Print' });
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => window.__tegoPrintCalls)).toBe(1);
  await expect(page.locator('[data-tego-print-pages]')).toHaveCount(0);
});
