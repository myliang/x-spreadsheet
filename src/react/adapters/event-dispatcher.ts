import type { CommandCommit, CommandOutcome } from '../../core/commands/command-result';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import type { WorkbookController } from '../../core/controller/workbook-controller';
import {
  TegoSheetException,
  type ActiveSheetChangeEvent,
  type CellEditEvent,
  type ChangeSource,
  type CellPoint,
  type CellRange,
  type PasteEvent,
  type Selection,
  type TegoSheetError,
} from '../../core';
import type { TegoSheetCallbacks } from '../tego-sheet.types';

export interface DispatchNotificationOptions {
  readonly selectionAfterCommit?: Selection;
}

export type UiDispatchOutcome =
  | CommandOutcome<unknown, WorkbookCommand>
  | { readonly status: 'rejected'; readonly error: TegoSheetError };

export interface EventDispatcherOptions {
  readonly controller: WorkbookController;
  readonly getControlledNotificationVersion?: () => number;
  readonly getCallbacks: () => TegoSheetCallbacks;
  readonly isActive?: () => boolean;
  readonly recordControlledCheckpoint?: (
    commit: CommandCommit<unknown, WorkbookCommand>,
  ) => void;
  readonly schedulePaint?: () => void;
}

export interface EventDispatcher {
  readonly dispatchUi: (
    command: WorkbookCommand,
    source: ChangeSource,
    options?: DispatchNotificationOptions,
  ) => UiDispatchOutcome;
  readonly dispatchRef: (
    command: WorkbookCommand,
    source?: ChangeSource,
    options?: DispatchNotificationOptions,
  ) => CommandOutcome<unknown, WorkbookCommand>;
  readonly emitSelectionChange: (selection: Selection) => void;
  readonly emitActiveSheetChange: (event: ActiveSheetChangeEvent) => void;
  readonly reportUiError: (error: TegoSheetError) => void;
}

function define(output: object, key: string, value: unknown): void {
  Object.defineProperty(output, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function isDomException(value: object): value is DOMException {
  return typeof DOMException === 'function' && value instanceof DOMException;
}

function cloneError<T extends Error>(value: T, seen: WeakMap<object, unknown>): T {
  const output = (isDomException(value)
    ? new DOMException(value.message, value.name)
    : new Error(value.message)) as T;
  seen.set(value, output);
  if (!isDomException(output)) {
    output.name = value.name;
    if (value.stack !== undefined) output.stack = value.stack;
  }
  const cause = (value as Error & { readonly cause?: unknown }).cause;
  if (Object.hasOwn(value, 'cause')) define(output, 'cause', clone(cause, seen));
  for (const key of Object.keys(value)) {
    if (key === 'cause') continue;
    define(output, key, clone((value as unknown as Record<string, unknown>)[key], seen));
  }
  return output;
}

function clone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  const cached = seen.get(value);
  if (cached !== undefined) return cached as T;
  if (value instanceof Error || isDomException(value)) return cloneError(value, seen);
  if (Array.isArray(value)) {
    const output: unknown[] = new Array(value.length);
    seen.set(value, output);
    for (const key of Object.keys(value)) {
      define(output, key, clone((value as unknown as Record<string, unknown>)[key], seen));
    }
    return output as T;
  }
  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const key of Object.keys(value)) {
    define(output, key, clone((value as Record<string, unknown>)[key], seen));
  }
  return output as T;
}

function inactiveException(): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message: 'Controller epoch is inactive',
    recoverable: true,
  });
}

function clipPoint(point: CellPoint, range: CellRange): CellPoint {
  return {
    row: Math.min(range.end.row, Math.max(range.start.row, point.row)),
    column: Math.min(range.end.column, Math.max(range.start.column, point.column)),
  };
}

function committedTarget(
  target: Selection,
  commit: CommandCommit<unknown, WorkbookCommand>,
): Selection {
  const range = commit.change.range ?? target.range;
  return {
    sheet: commit.change.sheet,
    range,
    active: clipPoint(target.active, range),
  };
}

function pasteValues(result: unknown): readonly (readonly string[])[] {
  return Array.isArray(result) ? result as readonly (readonly string[])[] : [];
}

export function createEventDispatcher(options: EventDispatcherOptions): EventDispatcher {
  const { controller } = options;
  const isActive = () => options.isActive?.() !== false;
  const ensureActive = () => {
    if (!isActive()) throw inactiveException();
  };

  const reportUiError = (error: TegoSheetError) => {
    if (!isActive()) return;
    options.getCallbacks().onError?.(clone(error));
  };

  const notifyCommit = (
    commit: CommandCommit<unknown, WorkbookCommand>,
    previousText: string | undefined,
    controlledNotificationVersion: number | undefined,
    notificationOptions: DispatchNotificationOptions,
  ) => {
    if (!isActive()) return;
    const callbacks = options.getCallbacks();
    const decisionIsCurrent = () => controlledNotificationVersion === undefined
      || options.getControlledNotificationVersion?.() === controlledNotificationVersion;
    if (!decisionIsCurrent()) return;
    callbacks.onChange?.(clone(commit.value), clone(commit.change));
    if (!isActive() || !decisionIsCurrent()) return;

    if (commit.command.type === 'set-cell-text') {
      const event: CellEditEvent = {
        changeId: commit.change.id,
        address: commit.command.address,
        previousText: previousText ?? '',
        text: commit.command.text,
        source: commit.change.source,
      };
      callbacks.onCellEdit?.(clone(event));
    } else if (commit.command.type === 'paste-external' && callbacks.onPaste !== undefined) {
      const event: PasteEvent = {
        changeId: commit.change.id,
        source: 'external',
        target: committedTarget(commit.command.target, commit),
        values: pasteValues(commit.result),
      };
      callbacks.onPaste(clone(event));
    } else if (commit.command.type === 'paste-internal' && callbacks.onPaste !== undefined) {
      const event: PasteEvent = {
        changeId: commit.change.id,
        source: 'internal',
        sourceSelection: commit.command.source,
        target: committedTarget(commit.command.target, commit),
        values: pasteValues(commit.result),
      };
      callbacks.onPaste(clone(event));
    }

    if (!isActive() || !decisionIsCurrent()) return;
    if (notificationOptions.selectionAfterCommit !== undefined) {
      callbacks.onSelectionChange?.(clone(notificationOptions.selectionAfterCommit));
    }
    if (!isActive() || !decisionIsCurrent()) return;
    options.schedulePaint?.();
  };

  const dispatchCore = (
    command: WorkbookCommand,
    source: ChangeSource,
  ): {
    readonly controlledNotificationVersion: number | undefined;
    readonly outcome: CommandOutcome<unknown, WorkbookCommand>;
    readonly previousText: string | undefined;
  } => {
    ensureActive();
    const previousText = command.type === 'set-cell-text'
      ? controller.getCellText(command.address)
      : undefined;
    const capturePasteValues = (
      command.type === 'paste-external' || command.type === 'paste-internal'
    ) && options.getCallbacks().onPaste !== undefined;
    let controlledNotificationVersion: number | undefined;
    const outcome = controller.dispatch(command, source, {
      capturePasteValues,
      beforeNotify(commit) {
        options.recordControlledCheckpoint?.(commit);
        controlledNotificationVersion = options.getControlledNotificationVersion?.();
      },
    }) as CommandOutcome<
      unknown,
      WorkbookCommand
    >;
    return { controlledNotificationVersion, outcome, previousText };
  };

  const notify = (
    dispatched: ReturnType<typeof dispatchCore>,
    notificationOptions: DispatchNotificationOptions = {},
  ): CommandOutcome<unknown, WorkbookCommand> => {
    if (dispatched.outcome.status === 'committed' && isActive()) {
      notifyCommit(
        dispatched.outcome.commit,
        dispatched.previousText,
        dispatched.controlledNotificationVersion,
        notificationOptions,
      );
    }
    return dispatched.outcome;
  };

  return {
    dispatchUi(command, source, notificationOptions) {
      if (!isActive()) {
        return { status: 'rejected', error: clone(inactiveException().error) };
      }
      let dispatched: ReturnType<typeof dispatchCore>;
      try {
        dispatched = dispatchCore(command, source);
      } catch (error) {
        if (!(error instanceof TegoSheetException)) throw error;
        const payload = clone(error.error);
        if (isActive()) reportUiError(payload);
        return { status: 'rejected', error: payload };
      }
      return notify(dispatched, notificationOptions);
    },
    dispatchRef: (command, source = 'ref', notificationOptions) =>
      notify(dispatchCore(command, source), notificationOptions),
    emitSelectionChange(selection) {
      ensureActive();
      options.getCallbacks().onSelectionChange?.(clone(selection));
    },
    emitActiveSheetChange(event) {
      ensureActive();
      options.getCallbacks().onActiveSheetChange?.(clone(event));
    },
    reportUiError,
  };
}
