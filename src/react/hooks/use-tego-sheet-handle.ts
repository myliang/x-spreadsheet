import {
  useImperativeHandle,
  useLayoutEffect,
  useState,
  type ForwardedRef,
} from 'react';
import {
  selectCell,
  selectCellStyle,
  TegoSheetException,
  type CellAddress,
  type CellStyle,
  type ChangeSource,
  type SheetId,
} from '../../core';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import type { ControllerEpoch } from './use-controller-epoch';
import {
  printWorkbook,
  type EventDispatcher,
} from '../adapters/event-dispatcher';
import type { EngineAdapterSlot } from './use-canvas-engine';
import type { TegoSheetHandle } from '../tego-sheet.types';

function invalid(message: string): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: true,
  });
}

function committedResult(
  dispatcher: EventDispatcher,
  command: WorkbookCommand,
  source: ChangeSource,
): unknown {
  const outcome = dispatcher.dispatchRef(command, source);
  return outcome.status === 'committed' ? outcome.commit.result : undefined;
}

export interface TegoSheetHandleRuntime {
  readonly activeSheet: SheetId | null;
  readonly controller: ControllerEpoch['controller'];
  readonly defaultStyle: CellStyle | undefined;
  readonly dispatcher: EventDispatcher;
  readonly engineSlot: EngineAdapterSlot;
  readonly isActive: () => boolean;
  readonly root: HTMLDivElement | null;
  readonly setActiveSheet: (sheet: SheetId | null) => void;
}

export interface RuntimeCapture<Runtime extends TegoSheetHandleRuntime> {
  readonly activeDecisionVersion: number;
  readonly runtime: Runtime;
}

export interface TegoSheetRuntimeAuthority<Runtime extends TegoSheetHandleRuntime> {
  readonly capture: () => RuntimeCapture<Runtime>;
  readonly commit: (token: object, runtime: Runtime) => void;
  readonly committed: (token: object) => Runtime | null;
  readonly compareAndSetActiveSheet: (
    capture: RuntimeCapture<Runtime>,
    sheet: SheetId | null,
  ) => boolean;
  readonly deactivate: () => void;
  readonly patchRoot: (root: HTMLDivElement) => boolean;
  readonly require: () => Runtime;
  readonly activate: (sheet: SheetId | null) => void;
}

function createRuntimeAuthority<Runtime extends TegoSheetHandleRuntime>(): TegoSheetRuntimeAuthority<Runtime> {
  let current: Runtime | null = null;
  let activeDecisionVersion = 0;
  const committedTokens = new WeakSet<object>();
  const requireRuntime = () => {
    if (current === null || !current.isActive()) {
      throw invalid('TegoSheet handle runtime is inactive');
    }
    return current;
  };
  const applyActiveSheet = (runtime: Runtime, sheet: SheetId | null) => {
    activeDecisionVersion += 1;
    current = { ...runtime, activeSheet: sheet };
    runtime.setActiveSheet(sheet);
  };
  return {
    capture: () => ({ activeDecisionVersion, runtime: requireRuntime() }),
    commit(token, runtime) {
      if (
        current !== null
        && (
          current.controller !== runtime.controller
          || current.activeSheet !== runtime.activeSheet
        )
      ) activeDecisionVersion += 1;
      current = runtime;
      committedTokens.add(token);
    },
    committed(token) {
      if (!committedTokens.has(token)) return null;
      const runtime = current;
      return runtime?.isActive() === true ? runtime : null;
    },
    compareAndSetActiveSheet(capture, sheet) {
      const runtime = current;
      if (
        runtime === null
        || !runtime.isActive()
        || runtime.controller !== capture.runtime.controller
        || activeDecisionVersion !== capture.activeDecisionVersion
      ) return false;
      applyActiveSheet(runtime, sheet);
      return true;
    },
    deactivate() {
      activeDecisionVersion += 1;
      current = null;
    },
    patchRoot(root) {
      const runtime = current;
      if (runtime === null || !runtime.isActive()) return false;
      current = { ...runtime, root };
      return true;
    },
    require: requireRuntime,
    activate(sheet) {
      applyActiveSheet(requireRuntime(), sheet);
    },
  };
}

function runtimeSheet(runtime: TegoSheetHandleRuntime, address: CellAddress) {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(sheet => sheet.id === address.sheet);
  if (index < 0) throw invalid(`Unknown sheet ID: ${address.sheet}`);
  return snapshot.value[index]!;
}

function createStableHandle<Runtime extends TegoSheetHandleRuntime>(
  authority: TegoSheetRuntimeAuthority<Runtime>,
): TegoSheetHandle {
  return {
    focus() {
      authority.require().root?.focus();
    },
    getValue: () => authority.require().controller.getValue(),
    getCell(address) {
      const runtime = authority.require();
      runtime.controller.getCellText(address);
      return selectCell(runtimeSheet(runtime, address), address.row, address.column);
    },
    getCellStyle(address) {
      const runtime = authority.require();
      runtime.controller.getCellText(address);
      return selectCellStyle(
        runtimeSheet(runtime, address),
        address.row,
        address.column,
        runtime.defaultStyle,
      );
    },
    setCellText(address, text) {
      authority.require().dispatcher.dispatchRef({ type: 'set-cell-text', address, text }, 'ref');
    },
    addSheet(name) {
      const capture = authority.capture();
      const { runtime } = capture;
      const wasEmpty = runtime.controller.getSnapshot().sheets.length === 0;
      const result = committedResult(
        runtime.dispatcher,
        name === undefined ? { type: 'add-sheet' } : { type: 'add-sheet', name },
        'ref',
      );
      if (typeof result !== 'string') throw invalid('Adding a sheet did not return a sheet ID');
      const sheet = result as SheetId;
      if (wasEmpty) authority.compareAndSetActiveSheet(capture, sheet);
      return sheet;
    },
    deleteSheet(sheet) {
      const capture = authority.capture();
      const { runtime } = capture;
      const before = runtime.controller.getSnapshot();
      const removedIndex = before.sheets.findIndex(item => item.id === sheet);
      runtime.dispatcher.dispatchRef({ type: 'delete-sheet', sheet }, 'ref');
      if (runtime.activeSheet !== sheet) return;
      const after = runtime.controller.getSnapshot();
      const replacementIndex = Math.min(removedIndex, after.sheets.length - 1);
      authority.compareAndSetActiveSheet(
        capture,
        replacementIndex < 0 ? null : after.sheets[replacementIndex]!.id,
      );
    },
    renameSheet(sheet, name) {
      authority.require().dispatcher.dispatchRef({ type: 'rename-sheet', sheet, name }, 'ref');
    },
    activateSheet(sheet) {
      const runtime = authority.require();
      const index = runtime.controller.getSnapshot().sheets.findIndex(item => item.id === sheet);
      if (index < 0) throw invalid(`Unknown sheet ID: ${sheet}`);
      authority.activate(sheet);
      runtime.dispatcher.emitActiveSheetChange({ sheet, index, source: 'ref' });
    },
    undo() {
      authority.require().dispatcher.dispatchRef({ type: 'undo' }, 'ref');
    },
    redo() {
      authority.require().dispatcher.dispatchRef({ type: 'redo' }, 'ref');
    },
    validate: () => authority.require().controller.validate(),
    print() {
      printWorkbook(authority.require().dispatcher);
    },
    recalculateLayout() {
      authority.require().engineSlot.get()?.recalculateLayout();
    },
  };
}

export function useTegoSheetHandle<Runtime extends TegoSheetHandleRuntime>(
  forwardedRef: ForwardedRef<TegoSheetHandle>,
): TegoSheetRuntimeAuthority<Runtime> {
  const [authority] = useState(createRuntimeAuthority<Runtime>);
  const [handle] = useState(() => createStableHandle(authority));
  useLayoutEffect(() => () => authority.deactivate(), [authority]);
  useImperativeHandle(forwardedRef, () => handle, [handle]);
  return authority;
}
