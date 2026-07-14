import { describe, expect, it } from 'vitest';
import { History } from '../../../src/core/controller/history';

describe('controller history', () => {
  it('records one undoable transition and moves it deterministically between stacks', () => {
    const history = new History<string>();
    const entry = { before: 'A', after: 'B', metadata: 'cell-1' };

    history.record(entry);

    expect(history.size).toEqual({ undo: 1, redo: 0 });
    expect(history.undo()).toEqual(entry);
    expect(history.size).toEqual({ undo: 0, redo: 1 });
    expect(history.redo()).toEqual(entry);
    expect(history.size).toEqual({ undo: 1, redo: 0 });
  });

  it('invalidates redo after a new committed transition', () => {
    const history = new History<string>();
    history.record({ before: 'A', after: 'B', metadata: 'first' });
    history.undo();

    history.record({ before: 'A', after: 'C', metadata: 'replacement' });

    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
    expect(history.undo()).toEqual({ before: 'A', after: 'C', metadata: 'replacement' });
  });

  it('checkpoints and restores isolated stack arrays', () => {
    const history = new History<string>();
    history.record({ before: 'A', after: 'B', metadata: 'first' });
    const checkpoint = history.checkpoint();
    history.record({ before: 'B', after: 'C', metadata: 'second' });

    history.restore(checkpoint);

    expect(history.size).toEqual({ undo: 1, redo: 0 });
    expect(history.undo()?.metadata).toBe('first');
    expect(checkpoint.undo).toHaveLength(1);
  });

  it('exposes immutable checkpoint arrays and entries', () => {
    const history = new History<string>();
    history.record({ before: 'A', after: 'B', metadata: 'first' });
    const checkpoint = history.checkpoint();

    expect(() => {
      (checkpoint.undo as Array<unknown>).push('forged');
    }).toThrow();
    expect(() => {
      (checkpoint.undo[0] as { before: string }).before = 'forged';
    }).toThrow();

    expect(history.undo()).toEqual({ before: 'A', after: 'B', metadata: 'first' });
  });
});
