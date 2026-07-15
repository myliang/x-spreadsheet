import { expect, it, vi } from 'vitest';
import { TegoSheetException, type WorkbookInput } from '../../src/core';
import { renderSheet } from '../helpers/render-sheet';

it('throws a synchronous contract exception for mixed control modes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() => renderSheet({ value: [], defaultValue: [] })).toThrowError(
    expect.objectContaining({
      code: 'INVALID_COMMAND',
      recoverable: false,
    }),
  );
});

it('throws when a mounted boundary switches from controlled to uncontrolled', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const rendered = renderSheet({ value: [] });

  expect(() => rendered.rerenderProps({ defaultValue: [] })).toThrow(TegoSheetException);
});

it('throws when a mounted boundary switches from uncontrolled to controlled', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const rendered = renderSheet({ defaultValue: [] });

  expect(() => rendered.rerenderProps({ value: [] })).toThrow(TegoSheetException);
});

it('throws invalid initial workbook data during initialization', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() => renderSheet({ defaultValue: { rows: { len: -1 } } })).toThrowError(
    expect.objectContaining({ code: 'INVALID_DATA', recoverable: false }),
  );
});

it('does not reinterpret explicit null as a missing workbook prop', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() => renderSheet({
    defaultValue: null as unknown as WorkbookInput,
  })).toThrowError(expect.objectContaining({ code: 'INVALID_DATA' }));
});
