import { applyCommand } from '../commands/apply-command';
import type { CommandCommit, CommandOutcome } from '../commands/command-result';
import { invalidCommand, validateCommand } from '../commands/validate-command';
import type { CommandResult, WorkbookCommand } from '../commands/workbook-command';
import { WorkbookState } from '../model/workbook-state';
import { selectCellText } from '../selectors/cell';
import type { ChangeSource, WorkbookChange } from '../types/changes';
import { assertCellAddress } from '../types/coordinates';
import type { CellAddress, SheetId } from '../types/coordinates';
import type { WorkbookData, WorkbookInput } from '../types/workbook';
import type { ValidationResult } from '../types/validation';
import { validateWorkbook } from '../selectors/validation';
import {
  createControllerCheckpoint,
  hasCheckpointOwner,
  type ControllerCheckpoint,
  type HistoryMetadata,
} from './controller-checkpoint';
import { History, type HistoryEntry } from './history';
import { SubscriptionStore } from './subscription-store';

export interface WorkbookControllerOptions {
  readonly readOnly?: boolean;
}

export interface DispatchOptions {
  /** Run an internal atomic observer after commit construction and before subscriptions publish. */
  readonly beforeNotify?: (
    commit: CommandCommit<unknown, WorkbookCommand>,
  ) => void;
  /** Suppress the document subscription used by controlled replay and restore. */
  readonly notify?: boolean;
  /** Skip the potentially large paste result when no consumer needs it. */
  readonly capturePasteValues?: boolean;
  /** Preserve the originally exposed runtime ID while replaying a pending add-sheet command. */
  readonly replayAddSheetId?: SheetId;
}

export interface ControllerSheetSnapshot {
  readonly id: SheetId;
  readonly index: number;
  readonly name: string;
}

export interface ControllerSnapshot {
  readonly revision: number;
  readonly value: WorkbookData;
  readonly sheets: readonly ControllerSheetSnapshot[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly readOnly: boolean;
}

export interface ControllerEvent {
  readonly snapshot: ControllerSnapshot;
  readonly commit: CommandCommit<unknown, WorkbookCommand>;
}

export type ControllerSubscriber = (event: ControllerEvent) => void;

let nextControllerId = 1;

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value: cloneValue((value as Record<string, unknown>)[key]),
        writable: true,
      });
    }
    return output as T;
  }
  return value;
}

function freezeValue<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      freezeValue((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function isolated<T>(value: T): T {
  return freezeValue(cloneValue(value));
}

export class WorkbookController {
  private state: WorkbookState;
  private readonly history = new History<WorkbookState, HistoryMetadata>();
  private readonly subscriptions = new SubscriptionStore<ControllerEvent>();
  private checkpointOwner: object = Object.freeze({});
  private checkpoints = new WeakSet<ControllerCheckpoint>();
  private readonly controllerId: number;
  private revision = 0;
  private changeSequence = 0;
  private readOnly: boolean;
  private disposed = false;

  constructor(input: WorkbookInput, options: WorkbookControllerOptions = {}) {
    this.state = WorkbookState.from(input);
    this.readOnly = options.readOnly ?? false;
    this.controllerId = nextControllerId;
    nextControllerId += 1;
  }

  get historySize(): { readonly undo: number; readonly redo: number } {
    return this.history.size;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  getValue(): WorkbookData {
    return this.state.serialize();
  }

  getSheetIds(): readonly SheetId[] {
    return Object.freeze(this.state.sheets.map(sheet => sheet.id));
  }

  getCellText(address: CellAddress): string {
    try {
      assertCellAddress(address);
    } catch (cause) {
      throw invalidCommand('Cell query requires a valid address', cause);
    }
    const sheet = this.state.get(address.sheet);
    if (sheet === null) throw invalidCommand(`Unknown sheet ID: ${address.sheet}`);
    return selectCellText(sheet.data, address.row, address.column);
  }

  getSnapshot(): ControllerSnapshot {
    const value = this.getValue();
    return isolated({
      revision: this.revision,
      value,
      sheets: this.state.sheets.map((sheet, index) => ({
        id: sheet.id,
        index,
        name: sheet.data.name ?? '',
      })),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      readOnly: this.readOnly,
    });
  }

  validate(): ValidationResult {
    this.ensureActive();
    return validateWorkbook(this);
  }

  subscribe(subscriber: ControllerSubscriber): () => void {
    this.ensureActive();
    return this.subscriptions.subscribe(subscriber);
  }

  dispatch<Command extends WorkbookCommand>(
    command: Command,
    source: ChangeSource,
    options: DispatchOptions = {},
  ): CommandOutcome<CommandResult<Command>, Command> {
    this.ensureMutable();
    const commandSnapshot = this.isolateCommand(command);
    validateCommand(this.state, commandSnapshot);
    if (commandSnapshot.type === 'undo') {
      return this.applyHistory('undo', commandSnapshot, source, options) as CommandOutcome<
        CommandResult<Command>,
        Command
      >;
    }
    if (commandSnapshot.type === 'redo') {
      return this.applyHistory('redo', commandSnapshot, source, options) as CommandOutcome<
        CommandResult<Command>,
        Command
      >;
    }

    const applied = applyCommand(this.state, commandSnapshot, {
      capturePasteValues: options.capturePasteValues !== false,
      replayAddSheetId: options.replayAddSheetId,
    });
    if (applied === null) return { status: 'noop' };

    const before = this.state;
    const change = this.createChange(
      applied.kind,
      source,
      applied.sheet,
      applied.range,
    );
    this.state = applied.state;
    this.revision += 1;
    if (applied.undoable) {
      const metadata = Object.freeze<HistoryMetadata>({ command: commandSnapshot, change });
      this.history.record({
        before,
        after: applied.state,
        metadata,
      });
    }

    const commit = this.createCommit(
      commandSnapshot,
      change,
      applied.result as CommandResult<Command>,
    );
    options.beforeNotify?.(commit as CommandCommit<unknown, WorkbookCommand>);
    this.publish(commit, options);
    return { status: 'committed', commit };
  }

  undo(
    source: ChangeSource = 'ref',
    options: DispatchOptions = {},
  ): CommandOutcome<void, { readonly type: 'undo' }> {
    return this.dispatch({ type: 'undo' }, source, options);
  }

  redo(
    source: ChangeSource = 'ref',
    options: DispatchOptions = {},
  ): CommandOutcome<void, { readonly type: 'redo' }> {
    return this.dispatch({ type: 'redo' }, source, options);
  }

  checkpoint(): ControllerCheckpoint {
    this.ensureActive();
    const checkpoint = createControllerCheckpoint(
      this.state,
      this.history.checkpoint(),
      this.revision,
      this.checkpointOwner,
    );
    this.checkpoints.add(checkpoint);
    return checkpoint;
  }

  restore(checkpoint: ControllerCheckpoint): void {
    this.ensureActive();
    if (
      typeof checkpoint !== 'object'
      || checkpoint === null
      || !this.checkpoints.has(checkpoint)
      || !hasCheckpointOwner(checkpoint, this.checkpointOwner)
    ) {
      throw invalidCommand('Checkpoint does not belong to this workbook controller');
    }
    this.state = checkpoint.state;
    this.history.restore(checkpoint.history);
    this.revision = checkpoint.revision;
  }

  replace(input: WorkbookInput): void {
    this.ensureActive();
    const replacement = this.state.replace(input);
    this.state = replacement;
    this.history.clear();
    this.revision += 1;
    this.checkpointOwner = Object.freeze({});
    this.checkpoints = new WeakSet<ControllerCheckpoint>();
  }

  setReadOnly(readOnly: boolean): void {
    this.ensureActive();
    this.readOnly = readOnly;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.subscriptions.dispose();
    this.history.clear();
  }

  private applyHistory<Command extends { readonly type: 'undo' | 'redo' }>(
    direction: 'undo' | 'redo',
    command: Command,
    source: ChangeSource,
    options: DispatchOptions,
  ): CommandOutcome<void, Command> {
    const entry = direction === 'undo' ? this.history.undo() : this.history.redo();
    if (entry === null) return { status: 'noop' };
    this.state = direction === 'undo' ? entry.before : entry.after;
    this.revision += 1;
    const change = this.createChange(
      'history',
      source,
      entry.metadata.change.sheet,
      entry.metadata.change.range,
    );
    const commit = this.createCommit(command, change, undefined);
    options.beforeNotify?.(commit as CommandCommit<unknown, WorkbookCommand>);
    this.publish(commit, options);
    return { status: 'committed', commit };
  }

  private createChange(
    kind: WorkbookChange['kind'],
    source: ChangeSource,
    sheet: SheetId,
    range?: WorkbookChange['range'],
  ): WorkbookChange {
    this.changeSequence += 1;
    return isolated({
      id: `change-${this.controllerId}-${this.changeSequence}`,
      kind,
      source,
      sheet,
      ...(range === undefined ? {} : { range }),
    });
  }

  private createCommit<Result, Command extends WorkbookCommand>(
    command: Command,
    change: WorkbookChange,
    result: Result,
  ): CommandCommit<Result, Command> {
    return Object.freeze({
      command,
      change,
      result: isolated(result),
      value: isolated(this.getValue()),
    });
  }

  private isolateCommand<Command extends WorkbookCommand>(command: Command): Command {
    try {
      const snapshot = isolated(command);
      if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new TypeError('Command must be an object');
      }
      return snapshot;
    } catch (cause) {
      throw invalidCommand('Command could not be isolated', cause);
    }
  }

  private publish<Result, Command extends WorkbookCommand>(
    commit: CommandCommit<Result, Command>,
    options: DispatchOptions,
  ): void {
    if (options.notify === false) return;
    this.subscriptions.publish(Object.freeze({
      snapshot: this.getSnapshot(),
      commit: commit as CommandCommit<unknown, WorkbookCommand>,
    }));
  }

  private ensureMutable(): void {
    this.ensureActive();
    if (this.readOnly) throw invalidCommand('Workbook is read-only');
  }

  private ensureActive(): void {
    if (this.disposed) throw invalidCommand('Workbook controller is disposed');
  }
}

export type WorkbookHistoryEntry = HistoryEntry<WorkbookState, HistoryMetadata>;
