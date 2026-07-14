export interface HistoryEntry<State, Metadata = unknown> {
  readonly before: State;
  readonly after: State;
  readonly metadata: Metadata;
}

export interface HistoryCheckpoint<State, Metadata = unknown> {
  readonly undo: readonly HistoryEntry<State, Metadata>[];
  readonly redo: readonly HistoryEntry<State, Metadata>[];
}

export class History<State, Metadata = unknown> {
  private undoEntries: HistoryEntry<State, Metadata>[] = [];
  private redoEntries: HistoryEntry<State, Metadata>[] = [];

  get canUndo(): boolean {
    return this.undoEntries.length > 0;
  }

  get canRedo(): boolean {
    return this.redoEntries.length > 0;
  }

  get size(): { readonly undo: number; readonly redo: number } {
    return { undo: this.undoEntries.length, redo: this.redoEntries.length };
  }

  record(entry: HistoryEntry<State, Metadata>): void {
    this.undoEntries.push(Object.freeze({ ...entry }));
    this.redoEntries = [];
  }

  undo(): HistoryEntry<State, Metadata> | null {
    const entry = this.undoEntries.pop();
    if (entry === undefined) return null;
    this.redoEntries.push(entry);
    return entry;
  }

  redo(): HistoryEntry<State, Metadata> | null {
    const entry = this.redoEntries.pop();
    if (entry === undefined) return null;
    this.undoEntries.push(entry);
    return entry;
  }

  clear(): void {
    this.undoEntries = [];
    this.redoEntries = [];
  }

  checkpoint(): HistoryCheckpoint<State, Metadata> {
    return Object.freeze({
      undo: Object.freeze([...this.undoEntries]),
      redo: Object.freeze([...this.redoEntries]),
    });
  }

  restore(checkpoint: HistoryCheckpoint<State, Metadata>): void {
    this.undoEntries = [...checkpoint.undo];
    this.redoEntries = [...checkpoint.redo];
  }
}
