import { describe, expect, it } from 'vitest';
import {
  createSelectionState,
  createSheetGridModel,
  extendSelection,
  moveSelection,
  normalizeSelection,
} from '../../../src/engine';

describe('selection state', () => {
  it('deep-freezes cloned selection state without exposing model merge references', () => {
    const model = createSheetGridModel({
      rows: { len: 4 },
      cols: { len: 4 },
      merges: ['B2:C3'],
    });
    const input = { row: 2, column: 2 };
    const created = createSelectionState(input);
    const normalized = normalizeSelection(created, model);

    input.row = 0;
    expect(created.active).toEqual({ row: 2, column: 2 });
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.range)).toBe(true);
    expect(Object.isFrozen(created.range.start)).toBe(true);
    expect(Object.isFrozen(created.range.end)).toBe(true);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.active)).toBe(true);
    expect(Object.isFrozen(normalized.range)).toBe(true);
    expect(Object.isFrozen(normalized.range.start)).toBe(true);
    expect(Object.isFrozen(normalized.range.end)).toBe(true);

    try {
      (normalized.active as { row: number }).row = 0;
    } catch {
      // Strict-mode mutation of frozen state is expected to throw.
    }
    try {
      (normalized.range.start as { row: number }).row = 0;
      (normalized.range.end as { column: number }).column = 3;
    } catch {
      // Strict-mode mutation of frozen state is expected to throw.
    }

    expect(model.mergeAt({ row: 2, column: 2 })).toEqual({
      start: { row: 1, column: 1 },
      end: { row: 2, column: 2 },
    });
    expect(model.merges).toEqual([{
      start: { row: 1, column: 1 },
      end: { row: 2, column: 2 },
    }]);
    expect(Object.isFrozen(model.merges[0])).toBe(true);
    expect(Object.isFrozen(model.merges[0]?.start)).toBe(true);
    expect(Object.isFrozen(model.merges[0]?.end)).toBe(true);
  });

  it('@parity:selection.normalize-range normalizes a backwards drag while retaining its active focus', () => {
    const model = createSheetGridModel({ rows: { len: 8 }, cols: { len: 8 } });
    const selection = createSelectionState(
      { row: 4, column: 5 },
      { row: 1, column: 2 },
    );

    expect(normalizeSelection(selection, model)).toEqual({
      kind: 'cell',
      anchor: { row: 4, column: 5 },
      focus: { row: 1, column: 2 },
      active: { row: 1, column: 2 },
      range: {
        start: { row: 1, column: 2 },
        end: { row: 4, column: 5 },
      },
    });
  });

  it('expands selection through a chain of non-overlapping merges', () => {
    const model = createSheetGridModel({
      rows: { len: 8 },
      cols: { len: 8 },
      merges: ['B2:D2', 'D3:E4'],
    });
    const selection = createSelectionState(
      { row: 1, column: 1 },
      { row: 2, column: 2 },
    );

    expect(normalizeSelection(selection, model)).toEqual({
      kind: 'cell',
      anchor: { row: 1, column: 1 },
      focus: { row: 2, column: 2 },
      active: { row: 2, column: 2 },
      range: {
        start: { row: 1, column: 1 },
        end: { row: 3, column: 4 },
      },
    });
    expect(normalizeSelection(
      createSelectionState({ row: 1, column: 2 }),
      model,
    ).active).toEqual({ row: 1, column: 1 });
  });

  it('clamps extension to the model and moves by index through hidden structure', () => {
    const model = createSheetGridModel({
      rows: { len: 5, 1: { hide: true }, 2: { hide: true } },
      cols: { len: 5, 1: { hide: true } },
    });
    const initial = createSelectionState({ row: 0, column: 0 });
    const down = moveSelection(initial, 'down', model);
    const right = moveSelection(down, 'right', model);
    const extended = extendSelection(right, { row: 99, column: 99 }, model);

    expect(down.active).toEqual({ row: 1, column: 0 });
    expect(right.active).toEqual({ row: 1, column: 1 });
    expect(extended.range).toEqual({
      start: { row: 1, column: 1 },
      end: { row: 4, column: 4 },
    });
    expect(initial.active).toEqual({ row: 0, column: 0 });
  });

  it('moves right and down beyond the normalized merged range end', () => {
    const model = createSheetGridModel({
      rows: { len: 8 },
      cols: { len: 8 },
      merges: ['B2:C3'],
    });
    const merged = normalizeSelection(createSelectionState({ row: 2, column: 2 }), model);

    expect(moveSelection(merged, 'right', model).active).toEqual({ row: 1, column: 3 });
    expect(moveSelection(merged, 'down', model).active).toEqual({ row: 3, column: 1 });
  });

  it('expands merges in list order for exactly the two legacy passes', () => {
    const model = createSheetGridModel({
      rows: { len: 8 },
      cols: { len: 8 },
      merges: ['A5:C5', 'D3:D5', 'B2:D2'],
    });
    const selection = createSelectionState(
      { row: 1, column: 1 },
      { row: 2, column: 2 },
    );

    expect(normalizeSelection(selection, model).range).toEqual({
      start: { row: 1, column: 1 },
      end: { row: 4, column: 3 },
    });
  });

  it('uses only the first matching merge when normalizing one point', () => {
    const model = createSheetGridModel({
      rows: { len: 8 },
      cols: { len: 8 },
      merges: ['B2:C3', 'C3:D4'],
    });

    expect(normalizeSelection(
      createSelectionState({ row: 2, column: 2 }),
      model,
    )).toEqual({
      kind: 'cell',
      anchor: { row: 2, column: 2 },
      focus: { row: 2, column: 2 },
      active: { row: 1, column: 1 },
      range: {
        start: { row: 1, column: 1 },
        end: { row: 2, column: 2 },
      },
    });
  });

  it('moves non-shift arrows from the anchor of a backwards range', () => {
    const model = createSheetGridModel({ rows: { len: 8 }, cols: { len: 8 } });
    const backwards = normalizeSelection(createSelectionState(
      { row: 4, column: 5 },
      { row: 1, column: 2 },
    ), model);

    expect(moveSelection(backwards, 'left', model).active).toEqual({ row: 4, column: 4 });
    expect(moveSelection(backwards, 'right', model).active).toEqual({ row: 4, column: 6 });
    expect(moveSelection(backwards, 'up', model).active).toEqual({ row: 3, column: 5 });
    expect(moveSelection(backwards, 'down', model).active).toEqual({ row: 5, column: 5 });
  });

  it('keeps kind enumerable through spread and defaults missing runtime kind to cell', () => {
    const model = createSheetGridModel({ rows: { len: 3 }, cols: { len: 3 } });
    const selection = createSelectionState({ row: 1, column: 1 });
    expect(Object.keys(selection)).toContain('kind');
    expect({ ...selection }).toMatchObject({ kind: 'cell' });

    const withoutKind = { ...selection, kind: undefined } as unknown as typeof selection;
    expect(normalizeSelection(withoutKind, model)).toMatchObject({ kind: 'cell' });
  });
});
