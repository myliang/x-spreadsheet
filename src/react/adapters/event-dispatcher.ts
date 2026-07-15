import type { CommandCommit, CommandOutcome } from '../../core/commands/command-result';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import type { WorkbookController } from '../../core/controller/workbook-controller';
import {
  TegoSheetException,
  type ActiveSheetChangeEvent,
  type CellEditEvent,
  type ChangeSource,
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
  readonly getCallbacks: () => TegoSheetCallbacks;
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

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      output[key] = clone((value as Record<string, unknown>)[key]);
    }
    return output as T;
  }
  return value;
}

function selectionValues(
  controller: WorkbookController,
  selection: Selection,
): readonly (readonly string[])[] {
  const rows: string[][] = [];
  for (let row = selection.range.start.row; row <= selection.range.end.row; row += 1) {
    const values: string[] = [];
    for (
      let column = selection.range.start.column;
      column <= selection.range.end.column;
      column += 1
    ) {
      values.push(controller.getCellText({ sheet: selection.sheet, row, column }));
    }
    rows.push(values);
  }
  return rows;
}

export function createEventDispatcher(options: EventDispatcherOptions): EventDispatcher {
  const { controller } = options;

  const reportUiError = (error: TegoSheetError) => {
    options.getCallbacks().onError?.(clone(error));
  };

  const notifyCommit = (
    commit: CommandCommit<unknown, WorkbookCommand>,
    previousText: string | undefined,
    internalValues: readonly (readonly string[])[] | undefined,
    notificationOptions: DispatchNotificationOptions,
  ) => {
    const callbacks = options.getCallbacks();
    options.recordControlledCheckpoint?.(commit);
    callbacks.onChange?.(clone(commit.value), clone(commit.change));

    if (commit.command.type === 'set-cell-text') {
      const event: CellEditEvent = {
        changeId: commit.change.id,
        address: commit.command.address,
        previousText: previousText ?? '',
        text: commit.command.text,
        source: commit.change.source,
      };
      callbacks.onCellEdit?.(clone(event));
    } else if (commit.command.type === 'paste-external') {
      const event: PasteEvent = {
        changeId: commit.change.id,
        source: 'external',
        target: commit.command.target,
        values: commit.command.values,
      };
      callbacks.onPaste?.(clone(event));
    } else if (commit.command.type === 'paste-internal') {
      const event: PasteEvent = {
        changeId: commit.change.id,
        source: 'internal',
        sourceSelection: commit.command.source,
        target: commit.command.target,
        values: internalValues ?? [],
      };
      callbacks.onPaste?.(clone(event));
    }

    if (notificationOptions.selectionAfterCommit !== undefined) {
      callbacks.onSelectionChange?.(clone(notificationOptions.selectionAfterCommit));
    }
    options.schedulePaint?.();
  };

  const dispatch = (
    command: WorkbookCommand,
    source: ChangeSource,
    notificationOptions: DispatchNotificationOptions = {},
  ): CommandOutcome<unknown, WorkbookCommand> => {
    const previousText = command.type === 'set-cell-text'
      ? controller.getCellText(command.address)
      : undefined;
    const internalValues = command.type === 'paste-internal'
      ? selectionValues(controller, command.source)
      : undefined;
    const outcome = controller.dispatch(command, source) as CommandOutcome<
      unknown,
      WorkbookCommand
    >;
    if (outcome.status === 'committed') {
      notifyCommit(outcome.commit, previousText, internalValues, notificationOptions);
    }
    return outcome;
  };

  return {
    dispatchUi(command, source, notificationOptions) {
      try {
        return dispatch(command, source, notificationOptions);
      } catch (error) {
        if (!(error instanceof TegoSheetException)) throw error;
        const payload = clone(error.error);
        reportUiError(payload);
        return { status: 'rejected', error: payload };
      }
    },
    dispatchRef: (command, source = 'ref', notificationOptions) =>
      dispatch(command, source, notificationOptions),
    emitSelectionChange(selection) {
      options.getCallbacks().onSelectionChange?.(clone(selection));
    },
    emitActiveSheetChange(event) {
      options.getCallbacks().onActiveSheetChange?.(clone(event));
    },
    reportUiError,
  };
}
