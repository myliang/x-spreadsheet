import { expect, type Page } from '@playwright/test';

export async function openHarness(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-mode', 'controlled');
  await expect(page.locator('.tego-sheet__canvas')).toBeVisible();
}

export async function capture(page: Page): Promise<unknown[]> {
  await page.getByRole('button', { name: 'Capture workbook' }).click();
  return JSON.parse(await page.getByTestId('capture').textContent() ?? '[]') as unknown[];
}

export async function cellPoint(page: Page, row: number, column: number) {
  const canvas = page.locator('.tego-sheet__canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas has no box');
  return {
    x: box.x + 60 + column * 100 + 50,
    y: box.y + 25 + row * 25 + 12,
  };
}

export async function selectCell(page: Page, row: number, column: number): Promise<void> {
  const point = await cellPoint(page, row, column);
  await page.mouse.click(point.x, point.y);
}

export async function dragCells(
  page: Page,
  start: Readonly<{ readonly row: number; readonly column: number }>,
  end: Readonly<{ readonly row: number; readonly column: number }>,
): Promise<void> {
  const from = await cellPoint(page, start.row, start.column);
  const to = await cellPoint(page, end.row, end.column);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

export async function openCellMenu(page: Page, row: number, column: number): Promise<void> {
  const point = await cellPoint(page, row, column);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'Cell actions' })).toBeVisible();
}

export async function dispatchClipboard(
  page: Page,
  type: 'copy' | 'cut' | 'paste',
  text?: string,
): Promise<void> {
  await page.evaluate(({ eventType, value }) => {
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    if (value !== undefined) {
      const transfer = new DataTransfer();
      transfer.setData('text/plain', value);
      Object.defineProperty(event, 'clipboardData', { value: transfer });
    }
    window.dispatchEvent(event);
  }, { eventType: type, value: text });
}

export async function selection(page: Page) {
  return JSON.parse(await page.getByTestId('selection').textContent() ?? 'null') as {
    active: { row: number; column: number };
    range: { start: { row: number; column: number }; end: { row: number; column: number } };
  } | null;
}
