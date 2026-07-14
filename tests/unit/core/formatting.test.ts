import { describe, expect, it } from 'vitest';
import {
  addStyle,
  FORMAT_DEFINITIONS,
  formatValue,
  normalizeStyle,
  stylesEqual,
} from '../../../src/core';
import type { CellStyle } from '../../../src/core';

describe('legacy formats', () => {
  it('exposes every approved legacy format in stable order', () => {
    expect(FORMAT_DEFINITIONS.map(format => format.key)).toEqual([
      'normal', 'text', 'number', 'percent', 'rmb', 'usd', 'eur',
      'date', 'time', 'datetime', 'duration',
    ]);
  });

  it.each([
    ['normal', 'AC', 'AC'],
    ['text', 'abc', 'abc'],
    ['number', '11000.20', '11,000.20'],
    ['number', '110,00.20', '110,00.20'],
    ['number', '-1200', '-1,200.00'],
    ['percent', '50.456', '50.456%'],
    ['rmb', '1200.333', '￥1,200.33'],
    ['usd', '1200.333', '$1,200.33'],
    ['eur', '1200.333', '€1,200.33'],
    ['date', '26/09/2008', '26/09/2008'],
    ['time', '15:59:00', '15:59:00'],
    ['datetime', '26/09/2008 15:59:00', '26/09/2008 15:59:00'],
    ['duration', '24:01:00', '24:01:00'],
  ])('@parity:formatting.number-and-date %s renders %j', (format, value, expected) => {
    expect(formatValue(format, value)).toBe(expected);
  });

  it('falls back to the normal renderer for unknown preserved format keys', () => {
    expect(formatValue('vendor-format', 'kept')).toBe('kept');
  });
});

describe('immutable style normalization and deduplication', () => {
  it('normalizes a deep clone without losing extension data or falsy values', () => {
    const style = {
      format: 'number',
      textwrap: false,
      font: { bold: false, vendorFont: { weight: 0 } },
      border: { top: ['thin', '#000'] as const, vendorBorder: 'keep' },
      vendorStyle: { nested: [false, 0, '', null] },
    } satisfies CellStyle;
    const before = structuredClone(style);
    const normalized = normalizeStyle(style);

    expect(normalized).toEqual(before);
    expect(style).toEqual(before);
    expect(normalized).not.toBe(style);
    expect(normalized.font).not.toBe(style.font);
    expect(normalized.vendorStyle).not.toBe(style.vendorStyle);
  });

  it('deduplicates semantically equal styles without mutating the style table', () => {
    const styles = Object.freeze([
      Object.freeze({ font: Object.freeze({ bold: true }), vendor: 'keep' }),
    ]) satisfies readonly CellStyle[];
    const found = addStyle(styles, { vendor: 'keep', font: { bold: true } });
    const added = addStyle(styles, { font: { italic: true }, vendor: 'new' });

    expect(found).toEqual({ styles, index: 0, added: false });
    expect(found.styles).toBe(styles);
    expect(added).toMatchObject({ index: 1, added: true });
    expect(added.styles).toEqual([
      { font: { bold: true }, vendor: 'keep' },
      { font: { italic: true }, vendor: 'new' },
    ]);
    expect(styles).toHaveLength(1);
  });

  it('preserves dangerous extension keys as own data without changing prototypes', () => {
    const style = JSON.parse(`{
      "__proto__": {"polluted": true},
      "constructor": {"vendor": "kept"},
      "font": {"bold": true, "__proto__": {"fontPolluted": true}}
    }`) as CellStyle;
    const equivalent = JSON.parse(`{
      "font": {"__proto__": {"fontPolluted": true}, "bold": true},
      "constructor": {"vendor": "kept"},
      "__proto__": {"polluted": true}
    }`) as CellStyle;

    const normalized = normalizeStyle(style);
    expect(Object.hasOwn(normalized, '__proto__')).toBe(true);
    expect(Object.hasOwn(normalized, 'constructor')).toBe(true);
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
    expect(normalized.__proto__).toEqual({ polluted: true });
    expect(normalized.constructor).toEqual({ vendor: 'kept' });
    expect(Object.hasOwn(normalized.font as object, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(normalized.font as object)).toBe(Object.prototype);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(JSON.parse(JSON.stringify(style)));
    expect(stylesEqual(normalized, equivalent)).toBe(true);

    const result = addStyle([normalized], equivalent);
    expect(result).toMatchObject({ index: 0, added: false });
    expect(result.styles).toHaveLength(1);
  });
});
