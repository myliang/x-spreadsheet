import { describe, expect, it } from 'vitest';
import {
  containsCell,
  differenceRanges,
  intersectRanges,
  iterateRange,
  normalizeRange,
  parseA1,
  parseA1Range,
  parseA1Reference,
  rangeSize,
  rangesEqual,
  renderA1,
  renderA1Range,
  shiftA1,
  shiftA1Range,
  unionRanges,
} from '../../../src/core';

describe('A1 coordinates', () => {
  it.each([
    ['A1', { row: 0, column: 0 }],
    ['B3', { row: 2, column: 1 }],
    ['Z10', { row: 9, column: 25 }],
    ['AA1', { row: 0, column: 26 }],
    ['ZA1', { row: 0, column: 676 }],
    ['AAA42', { row: 41, column: 702 }],
  ])('@parity:formulas.references parses %s', (input, expected) => {
    expect(parseA1(input)).toEqual(expected);
    expect(renderA1(expected)).toBe(input);
  });

  it.each(['', 'A0', '0A', 'A-1', 'A1x', '$A1', 'a1'])('rejects malformed point %j', input => {
    expect(() => parseA1(input)).toThrow(TypeError);
  });

  it('tracks absolute axes separately while keeping plain parse results minimal', () => {
    expect(parseA1Reference('$B$3')).toEqual({
      row: 2,
      column: 1,
      rowAbsolute: true,
      columnAbsolute: true,
    });
    expect(parseA1Reference('B$3')).toEqual({
      row: 2,
      column: 1,
      rowAbsolute: true,
      columnAbsolute: false,
    });
  });

  it.each([
    ['A1', 1, 1, 'B2'],
    ['$A1', 3, 2, '$A4'],
    ['A$1', 3, 2, 'C$1'],
    ['$A$1', 3, 2, '$A$1'],
  ])('shifts %s with row %i and column %i', (input, rowDelta, columnDelta, expected) => {
    expect(shiftA1(input, { row: rowDelta, column: columnDelta })).toBe(expected);
  });

  it('rejects reference shifts outside the sheet origin', () => {
    expect(() => shiftA1('A1', { row: -1, column: 0 })).toThrow(RangeError);
  });
});

describe('A1 ranges', () => {
  it.each([
    ['A1', { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }],
    ['B3:D5', { start: { row: 2, column: 1 }, end: { row: 4, column: 3 } }],
    ['D5:B3', { start: { row: 2, column: 1 }, end: { row: 4, column: 3 } }],
  ])('parses and normalizes %s', (input, expected) => {
    expect(parseA1Range(input)).toEqual(expected);
    expect(renderA1Range(expected)).toBe(expected.start.row === expected.end.row
      && expected.start.column === expected.end.column ? 'A1' : 'B3:D5');
  });

  it('normalizes, contains, intersects, unions, and iterates without mutation', () => {
    const source = {
      start: { row: 3, column: 4 },
      end: { row: 1, column: 2 },
    } as const;
    const before = structuredClone(source);
    const range = normalizeRange(source);

    expect(source).toEqual(before);
    expect(range).toEqual({ start: { row: 1, column: 2 }, end: { row: 3, column: 4 } });
    expect(containsCell(range, { row: 2, column: 3 })).toBe(true);
    expect(containsCell(range, { row: 4, column: 3 })).toBe(false);
    expect(intersectRanges(range, parseA1Range('D1:F3'))).toEqual({
      start: { row: 1, column: 3 },
      end: { row: 2, column: 4 },
    });
    expect(unionRanges(range, parseA1Range('A1:C2'))).toEqual({
      start: { row: 0, column: 0 },
      end: { row: 3, column: 4 },
    });
    expect(iterateRange(parseA1Range('A1:B2'))).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ]);
  });

  it('returns null for disjoint intersections', () => {
    expect(intersectRanges(parseA1Range('A1:B2'), parseA1Range('D4:E5'))).toBeNull();
  });

  it('reports size/equality and partitions rectangular differences like the legacy range', () => {
    const source = parseA1Range('A1:E5');
    const removed = parseA1Range('B2:D4');
    const difference = differenceRanges(source, removed);

    expect(rangeSize(source)).toEqual([5, 5]);
    expect(rangesEqual(source, parseA1Range('E5:A1'))).toBe(true);
    expect(difference.map(renderA1Range)).toEqual(['A1:E1', 'A5:E5', 'A2:A4', 'E2:E4']);
    expect(differenceRanges(source, parseA1Range('G1:H2'))).toEqual([source]);
    expect(differenceRanges(source, source)).toEqual([]);
  });

  it('shifts absolute and relative range axes', () => {
    expect(shiftA1Range('$A1:B$2', { row: 2, column: 3 })).toBe('$A3:E$2');
  });
});
