import { describe, expect, it, vi } from 'vitest';
import {
  WorkbookController,
  type ControllerEvent,
} from '../../../src/core/controller/workbook-controller';
import { TegoSheetException } from '../../../src/core/errors/tego-sheet-exception';
import type { CellAddress } from '../../../src/core/types/coordinates';

function firstAddress(controller: WorkbookController, row = 0, column = 0): CellAddress {
  const sheet = controller.getSheetIds()[0];
  if (sheet === undefined) throw new Error('test workbook requires a sheet');
  return { sheet, row, column };
}

describe('WorkbookController command boundary', () => {
  it('does not publish or checkpoint a semantic no-op', () => {
    const controller = new WorkbookController({ rows: { 0: { cells: { 0: { text: '' } } } } });
    const address = firstAddress(controller);
    const events: ControllerEvent[] = [];
    controller.subscribe(event => events.push(event));

    expect(controller.dispatch({ type: 'set-cell-text', address, text: '' }, 'ref'))
      .toEqual({ status: 'noop' });
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(events).toHaveLength(0);
  });

  it('validates, commits, checkpoints, and publishes synchronously once', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller, 2, 3);
    const seen: string[] = [];
    controller.subscribe(event => {
      const value = event.snapshot.value as unknown as Array<{
        rows?: Record<string, { cells?: Record<string, { text?: string }> }>;
      }>;
      seen.push(`${event.commit.change.kind}:${value[0]?.rows?.['2']?.cells?.['3']?.text}`);
    });

    const outcome = controller.dispatch({ type: 'set-cell-text', address, text: 'next' }, 'ref');

    expect(outcome.status).toBe('committed');
    if (outcome.status === 'committed') {
      expect(outcome.commit.change).toMatchObject({
        kind: 'cell',
        source: 'ref',
        sheet: address.sheet,
        range: { start: { row: 2, column: 3 }, end: { row: 2, column: 3 } },
      });
      expect(outcome.commit.change.id).toMatch(/^change-\d+-1$/);
    }
    expect(seen).toEqual(['cell:next']);
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    expect(controller.getCellText(address)).toBe('next');
  });

  it('undoes and redoes with history changes and invalidates redo after a new commit', () => {
    const controller = new WorkbookController({ rows: { 0: { cells: { 0: { text: 'A' } } } } });
    const address = firstAddress(controller);
    const kinds: string[] = [];
    controller.subscribe(event => kinds.push(event.commit.change.kind));

    controller.dispatch({ type: 'set-cell-text', address, text: 'B' }, 'keyboard');
    expect(controller.undo('keyboard').status).toBe('committed');
    expect(controller.getCellText(address)).toBe('A');
    expect(controller.historySize).toEqual({ undo: 0, redo: 1 });

    expect(controller.redo('keyboard').status).toBe('committed');
    expect(controller.getCellText(address)).toBe('B');
    expect(controller.undo('keyboard').status).toBe('committed');
    controller.dispatch({ type: 'set-cell-text', address, text: 'C' }, 'keyboard');

    expect(controller.redo('keyboard')).toEqual({ status: 'noop' });
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    expect(kinds).toEqual(['cell', 'history', 'history', 'history', 'cell']);
  });

  it('rejects all document and history mutation while read-only before changing state', () => {
    const controller = new WorkbookController({ name: 'A' }, { readOnly: true });
    const address = firstAddress(controller);
    const before = controller.getValue();
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(() => controller.dispatch({ type: 'set-cell-text', address, text: 'blocked' }, 'ref'))
      .toThrowError(TegoSheetException);
    expect(() => controller.undo('ref')).toThrowError(
      expect.objectContaining({ code: 'INVALID_COMMAND' }),
    );
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('returns isolated query values and snapshots', () => {
    const controller = new WorkbookController({
      name: 'A',
      vendor: { nested: true },
      rows: { 0: { cells: { 0: { text: 'safe' } } } },
    });
    const value = controller.getValue() as unknown as Array<Record<string, unknown>>;
    const snapshot = controller.getSnapshot() as unknown as {
      value: Array<Record<string, unknown>>;
    };

    value[0]!.name = 'mutated';
    expect(() => { snapshot.value[0]!.name = 'also-mutated'; }).toThrow();

    expect(controller.getValue()[0]?.name).toBe('A');
    expect(controller.getCellText(firstAddress(controller))).toBe('safe');
  });

  it('restores a controller checkpoint silently and replaces with fresh runtime IDs', () => {
    const controller = new WorkbookController({ name: 'A' });
    const originalId = controller.getSheetIds()[0]!;
    const address: CellAddress = { sheet: originalId, row: 0, column: 0 };
    const checkpoint = controller.checkpoint();
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    controller.dispatch({ type: 'set-cell-text', address, text: 'pending' }, 'ref', { notify: false });
    expect(controller.getCellText(address)).toBe('pending');
    expect(subscriber).not.toHaveBeenCalled();

    controller.restore(checkpoint);
    expect(controller.getCellText(address)).toBe('');
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();

    controller.dispatch({ type: 'set-cell-text', address, text: 'discarded' }, 'ref', { notify: false });
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    controller.replace([{ name: 'A' }]);
    expect(controller.getSheetIds()[0]).not.toBe(originalId);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('rejects foreign and structurally copied checkpoints atomically and silently', () => {
    const first = new WorkbookController({ name: 'First' });
    const second = new WorkbookController({ name: 'Second' });
    const secondAddress = firstAddress(second);
    second.dispatch({ type: 'set-cell-text', address: secondAddress, text: 'kept' }, 'ref', {
      notify: false,
    });
    const foreign = first.checkpoint();
    const genuine = second.checkpoint();
    const forged = { ...genuine } as typeof genuine;
    const tokenCopied = Object.create(
      Object.getPrototypeOf(genuine),
      Object.getOwnPropertyDescriptors(genuine),
    ) as typeof genuine;
    const before = {
      ids: second.getSheetIds(),
      value: second.getValue(),
      history: second.historySize,
      revision: second.getSnapshot().revision,
    };
    const subscriber = vi.fn();
    second.subscribe(subscriber);

    expect(() => second.restore(foreign))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => second.restore(forged))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => second.restore(tokenCopied))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));

    expect(second.getSheetIds()).toEqual(before.ids);
    expect(second.getValue()).toEqual(before.value);
    expect(second.historySize).toEqual(before.history);
    expect(second.getSnapshot().revision).toBe(before.revision);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('restores registered same-controller checkpoints silently', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    const checkpoint = controller.checkpoint();
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    controller.dispatch({ type: 'set-cell-text', address, text: 'later' }, 'ref', {
      notify: false,
    });
    controller.restore(checkpoint);

    expect(controller.getCellText(address)).toBe('');
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(controller.getSnapshot().revision).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('invalidates every prior checkpoint only after a successful genuine replacement', () => {
    const controller = new WorkbookController({ name: 'Before' });
    const beforeAddress = firstAddress(controller);
    controller.dispatch({ type: 'set-cell-text', address: beforeAddress, text: 'history' }, 'ref', {
      notify: false,
    });
    const oldCheckpoint = controller.checkpoint();

    controller.replace({ name: 'After' });
    const replacement = {
      ids: controller.getSheetIds(),
      value: controller.getValue(),
      history: controller.historySize,
      revision: controller.getSnapshot().revision,
    };
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(() => controller.restore(oldCheckpoint))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getSheetIds()).toEqual(replacement.ids);
    expect(controller.getValue()).toEqual(replacement.value);
    expect(controller.historySize).toEqual(replacement.history);
    expect(controller.getSnapshot().revision).toBe(replacement.revision);
    expect(subscriber).not.toHaveBeenCalled();

    const replacementCheckpoint = controller.checkpoint();
    const afterAddress = firstAddress(controller);
    controller.dispatch({ type: 'set-cell-text', address: afterAddress, text: 'temporary' }, 'ref', {
      notify: false,
    });
    controller.restore(replacementCheckpoint);
    expect(controller.getValue()).toEqual(replacement.value);
    expect(controller.getSheetIds()).toEqual(replacement.ids);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('deeply isolates history command and change metadata from checkpoint mutation', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller, 2, 3);
    controller.dispatch({ type: 'set-cell-text', address, text: 'committed' }, 'ref', {
      notify: false,
    });
    const checkpoint = controller.checkpoint();
    const entry = checkpoint.history.undo[0]!;
    const metadata = entry.metadata as unknown as {
      command: { address: { row: number }; text: string };
      change: { kind: string; range: { start: { row: number } } };
    };

    expect(() => {
      (entry as unknown as { metadata: unknown }).metadata = {};
    }).toThrow();
    expect(() => {
      (entry.metadata as unknown as { command: unknown }).command = { type: 'undo' };
    }).toThrow();
    expect(() => { metadata.command.text = 'forged'; }).toThrow();
    expect(() => { metadata.command.address.row = 99; }).toThrow();
    expect(() => { metadata.change.kind = 'sheet'; }).toThrow();
    expect(() => { metadata.change.range.start.row = 99; }).toThrow();

    const changes: Array<{ kind: string; row: number | undefined }> = [];
    controller.subscribe(event => changes.push({
      kind: event.commit.change.kind,
      row: event.commit.change.range?.start.row,
    }));
    controller.undo('ref');
    controller.redo('ref');

    expect(changes).toEqual([
      { kind: 'history', row: 2 },
      { kind: 'history', row: 2 },
    ]);
    expect(controller.getCellText(address)).toBe('committed');
  });

  it('keeps subscription traversal safe across unsubscribe and reentrant dispatch', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    const calls: string[] = [];
    let nested = false;
    let unsubscribeSecond = (): void => undefined;

    controller.subscribe(() => {
      calls.push('first');
      unsubscribeSecond();
      if (!nested) {
        nested = true;
        controller.dispatch({ type: 'set-cell-text', address, text: 'nested' }, 'ref');
      }
    });
    unsubscribeSecond = controller.subscribe(() => calls.push('second'));

    controller.dispatch({ type: 'set-cell-text', address, text: 'outer' }, 'ref');

    expect(calls).toEqual(['first', 'first']);
    expect(controller.getCellText(address)).toBe('nested');
    expect(controller.historySize).toEqual({ undo: 2, redo: 0 });
  });

  it('queues reentrant publications so every listener observes revisions in FIFO order', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    const calls: string[] = [];
    let nested = false;

    controller.subscribe(event => {
      calls.push(`first:${event.snapshot.revision}`);
      if (!nested) {
        nested = true;
        controller.dispatch({ type: 'set-cell-text', address, text: 'nested' }, 'ref');
        controller.subscribe(queued => calls.push(`added:${queued.snapshot.revision}`));
      }
    });
    controller.subscribe(event => calls.push(`second:${event.snapshot.revision}`));

    controller.dispatch({ type: 'set-cell-text', address, text: 'outer' }, 'ref');

    expect(calls).toEqual([
      'first:1',
      'second:1',
      'first:2',
      'second:2',
      'added:2',
    ]);
  });

  it('drains current and queued subscribers before propagating the first original exception', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    const callbackError = new Error('consumer callback failed');
    const laterError = new Error('later callback also failed');
    const calls: string[] = [];
    let nested = false;
    controller.subscribe(event => {
      calls.push(`throwing:${event.snapshot.revision}`);
      if (!nested) {
        nested = true;
        controller.dispatch({ type: 'set-cell-text', address, text: 'nested' }, 'ref');
        throw callbackError;
      }
    });
    controller.subscribe(event => {
      calls.push(`later:${event.snapshot.revision}`);
      if (event.snapshot.revision === 1) throw laterError;
    });

    let caught: unknown;
    try {
      controller.dispatch({ type: 'set-cell-text', address, text: 'committed' }, 'ref');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(callbackError);
    expect(calls).toEqual(['throwing:1', 'later:1', 'throwing:2', 'later:2']);
    expect(controller.getCellText(address)).toBe('nested');
    expect(controller.historySize).toEqual({ undo: 2, redo: 0 });
  });

  it('isolates a command once before validation and applies exactly the committed snapshot', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    let reads = 0;
    const command = {
      type: 'set-cell-text' as const,
      address,
      get text() {
        reads += 1;
        return reads === 1 ? 'snapshot' : 'changed';
      },
    };

    const outcome = controller.dispatch(command, 'ref', { notify: false });

    expect(outcome.status).toBe('committed');
    if (outcome.status === 'committed') {
      expect(outcome.commit.command.text).toBe('snapshot');
      expect(Object.isFrozen(outcome.commit.command)).toBe(true);
      expect(Object.isFrozen(outcome.commit.command.address)).toBe(true);
    }
    expect(controller.getCellText(address)).toBe('snapshot');
    expect(reads).toBe(1);
  });

  it('rejects throwing undo and redo command snapshots before moving history', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    controller.dispatch({ type: 'set-cell-text', address, text: 'committed' }, 'ref', {
      notify: false,
    });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    const ownKeysError = new Error('ownKeys failed');
    const undo = new Proxy({ type: 'undo' as const }, {
      ownKeys() { throw ownKeysError; },
    });
    const beforeUndo = controller.getSnapshot();

    expect(() => controller.dispatch(undo, 'ref'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND', cause: ownKeysError }));
    expect(controller.getValue()).toEqual(beforeUndo.value);
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    expect(controller.getSnapshot().revision).toBe(beforeUndo.revision);
    expect(subscriber).not.toHaveBeenCalled();

    controller.undo('ref', { notify: false });
    const getterError = new Error('type getter failed');
    const redo = Object.defineProperty({}, 'type', {
      enumerable: true,
      get() { throw getterError; },
    }) as { readonly type: 'redo' };
    const beforeRedo = controller.getSnapshot();

    expect(() => controller.dispatch(redo, 'ref'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND', cause: getterError }));
    expect(controller.getValue()).toEqual(beforeRedo.value);
    expect(controller.historySize).toEqual({ undo: 0, redo: 1 });
    expect(controller.getSnapshot().revision).toBe(beforeRedo.revision);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('rejects scaffolded but unimplemented Task 9 commands without fake commits', () => {
    const controller = new WorkbookController({ name: 'A' });
    const sheet = controller.getSheetIds()[0]!;
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(() => controller.dispatch({ type: 'rename-sheet', sheet, name: 'B' }, 'ref'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()[0]?.name).toBe('A');
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('keeps the last valid state and runtime IDs when replacement parsing fails', () => {
    const controller = new WorkbookController({ name: 'valid' });
    const id = controller.getSheetIds()[0]!;
    const checkpoint = controller.checkpoint();

    expect(() => controller.replace({ rows: { len: -1 } } as never))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DATA' }));

    expect(controller.getValue()[0]?.name).toBe('valid');
    expect(controller.getSheetIds()).toEqual([id]);
    expect(() => controller.restore(checkpoint)).not.toThrow();
  });

  it('disposes idempotently and forbids later subscriptions or dispatch', () => {
    const controller = new WorkbookController({ name: 'A' });
    const address = firstAddress(controller);
    const subscriber = vi.fn();
    const unsubscribe = controller.subscribe(subscriber);
    const checkpoint = controller.checkpoint();

    controller.dispose();
    controller.dispose();
    expect(unsubscribe).not.toThrow();

    expect(() => controller.subscribe(subscriber))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({ type: 'set-cell-text', address, text: 'late' }, 'ref'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.restore(checkpoint))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(subscriber).not.toHaveBeenCalled();
  });
});
