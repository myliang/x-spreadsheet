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

  await page.getByRole('button', { name: 'Load print fixture' }).click();
  await expect(page.getByRole('tab', { name: 'Print', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Print' });
  await dialog.getByLabel('Paper').selectOption('A5');
  await dialog.getByLabel('Orientation').selectOption('landscape');
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => window.__tegoPrintCalls)).toBe(1);
  const snapshot = await page.evaluate(() => window.__tegoPrintSnapshot);
  expect(snapshot).toBeDefined();
  expect(snapshot?.css).toContain('@page { size: A5 landscape; }');
  expect(snapshot?.pages).toBeGreaterThanOrEqual(1);
  expect(snapshot?.canvases.every(canvas => canvas.width > 0 && canvas.height > 0)).toBe(true);
  expect(snapshot?.texts).not.toContain('secret-never-print');
  expect(snapshot?.fills).toContainEqual(expect.objectContaining({
    color: '#ffeecc',
    width: 198,
    height: 68,
  }));
  expect(snapshot?.strokes).toBeGreaterThan(0);
  await expect(page.locator('[data-tego-print-pages]')).toHaveCount(0);
  await expect(page.locator('[data-tego-print-style]')).toHaveCount(0);
});
