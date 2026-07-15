import { expect, test } from '@playwright/test';
import { capture, openHarness } from './support';

test('@parity:workbook.import-export imports controlled data and exports canonical workbook data', async ({ page }) => {
  await openHarness(page);
  await page.getByRole('button', { name: 'Load alternate workbook' }).click();
  const alternate = await capture(page);
  expect(alternate).toMatchObject([{
    name: 'Alternate',
    rows: { len: 2, 0: { cells: { 0: { text: 'alternate-only' } } } },
    cols: { len: 2 },
  }]);
  expect(alternate[0]).toMatchObject({
    freeze: 'A1',
    merges: [],
    styles: [],
    validations: [],
    autofilter: {},
  });

  await page.getByRole('button', { name: 'Import workbook' }).click();
  const value = await capture(page);
  expect(value).toHaveLength(1);
  expect(value[0]).toMatchObject({
    name: 'Browser',
    rows: { len: 60, 1: { cells: { 0: { text: 'odd' }, 2: { text: '=B2*2' } } } },
    cols: { len: 12 },
    autofilter: { ref: 'A1:D60' },
  });
  expect(value).not.toEqual(alternate);
});
