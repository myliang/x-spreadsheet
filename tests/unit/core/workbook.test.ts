import freezeFixture from '../../parity/fixtures/operations/freeze.json';
import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';

describe('sheet and freeze operations', () => {
  it('matches the captured freeze operation and unfreezes silently when already A1', () => {
    const controller = new WorkbookController({ ...freezeFixture.sheet, freeze: 'A1' });
    const sheet = controller.getSheetIds()[0]!;

    const outcome = controller.dispatch({
      type: 'set-freeze', sheet, row: freezeFixture.operation.ri, column: freezeFixture.operation.ci,
    }, 'toolbar');

    expect(controller.getValue()[0]).toEqual(freezeFixture.sheet);
    expect(outcome).toMatchObject({
      status: 'committed', commit: { change: { kind: 'structure', sheet } },
    });
    expect(controller.dispatch({
      type: 'set-freeze', sheet, row: freezeFixture.operation.ri, column: freezeFixture.operation.ci,
    }, 'toolbar')).toEqual({ status: 'noop' });
  });

  it('@parity:correction.empty-workbook adds, renames, deletes the last sheet, and returns its ID', () => {
    const controller = new WorkbookController([]);
    const events = vi.fn();
    controller.subscribe(events);

    const added = controller.dispatch({ type: 'add-sheet', name: 'Only' }, 'sheet-tabs');
    expect(added.status).toBe('committed');
    if (added.status !== 'committed') throw new Error('expected add to commit');
    const sheet = added.commit.result;
    expect(sheet).toBe(controller.getSheetIds()[0]);
    expect(added.commit.change).toMatchObject({ kind: 'sheet', sheet, source: 'sheet-tabs' });

    controller.dispatch({ type: 'rename-sheet', sheet, name: 'Renamed' }, 'sheet-tabs');
    expect(controller.getValue()[0]!.name).toBe('Renamed');
    controller.dispatch({ type: 'delete-sheet', sheet }, 'sheet-tabs');
    expect(controller.getValue()).toEqual([]);
    expect(controller.getSheetIds()).toEqual([]);
    expect(controller.historySize).toEqual({ undo: 3, redo: 0 });
    expect(events).toHaveBeenCalledTimes(3);

    controller.undo();
    expect(controller.getSheetIds()).toEqual([sheet]);
    expect(controller.getValue()[0]!.name).toBe('Renamed');
  });

  it('generates unique default names and rejects blank or duplicate names atomically', () => {
    const controller = new WorkbookController([{ name: 'sheet1' }, { name: 'sheet2' }]);
    const before = controller.getValue();
    const events = vi.fn();
    controller.subscribe(events);

    const added = controller.dispatch({ type: 'add-sheet' }, 'sheet-tabs');
    expect(added.status).toBe('committed');
    expect(controller.getValue()[2]!.name).toBe('sheet3');
    const third = controller.getSheetIds()[2]!;
    const afterAdd = controller.getValue();

    expect(() => controller.dispatch({ type: 'rename-sheet', sheet: third, name: '   ' }, 'sheet-tabs'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({ type: 'rename-sheet', sheet: third, name: 'sheet1' }, 'sheet-tabs'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({ type: 'add-sheet', name: 'sheet2' }, 'sheet-tabs'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(afterAdd);
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    expect(events).toHaveBeenCalledTimes(1);
    expect(before).toHaveLength(2);
  });
});
