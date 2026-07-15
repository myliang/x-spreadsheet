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
import type { EventDispatcher } from '../adapters/event-dispatcher';
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

interface RuntimeCapture {
  readonly activeDecisionVersion: number;
  readonly runtime: TegoSheetHandleRuntime;
}

interface RuntimeSlot {
  readonly capture: () => RuntimeCapture;
  readonly compareAndSetActiveSheet: (capture: RuntimeCapture, sheet: SheetId | null) => boolean;
  readonly deactivate: () => void;
  readonly require: () => TegoSheetHandleRuntime;
  readonly setActiveSheet: (sheet: SheetId | null) => void;
  readonly update: (runtime: TegoSheetHandleRuntime) => void;
}

function createRuntimeSlot(): RuntimeSlot {
  let current: TegoSheetHandleRuntime | null = null;
  let activeDecisionVersion = 0;
  const requireRuntime = () => {
    if (current === null || !current.isActive()) {
      throw invalid('TegoSheet handle runtime is inactive');
    }
    return current;
  };
  const applyActiveSheet = (runtime: TegoSheetHandleRuntime, sheet: SheetId | null) => {
    activeDecisionVersion += 1;
    current = { ...runtime, activeSheet: sheet };
    runtime.setActiveSheet(sheet);
  };
  return {
    capture: () => ({ activeDecisionVersion, runtime: requireRuntime() }),
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
    require: requireRuntime,
    setActiveSheet(sheet) {
      applyActiveSheet(requireRuntime(), sheet);
    },
    update(runtime) {
      current = runtime;
    },
  };
}

function runtimeSheet(runtime: TegoSheetHandleRuntime, address: CellAddress) {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(sheet => sheet.id === address.sheet);
  if (index < 0) throw invalid(`Unknown sheet ID: ${address.sheet}`);
  return snapshot.value[index]!;
}

function createStableHandle(slot: RuntimeSlot): TegoSheetHandle {
  return {
    focus() {
      slot.require().root?.focus();
    },
    getValue: () => slot.require().controller.getValue(),
    getCell(address) {
      const runtime = slot.require();
      runtime.controller.getCellText(address);
      return selectCell(runtimeSheet(runtime, address), address.row, address.column);
    },
    getCellStyle(address) {
      const runtime = slot.require();
      runtime.controller.getCellText(address);
      return selectCellStyle(
        runtimeSheet(runtime, address),
        address.row,
        address.column,
        runtime.defaultStyle,
      );
    },
    setCellText(address, text) {
      slot.require().dispatcher.dispatchRef({ type: 'set-cell-text', address, text }, 'ref');
    },
    addSheet(name) {
      const capture = slot.capture();
      const { runtime } = capture;
      const wasEmpty = runtime.controller.getSnapshot().sheets.length === 0;
      const result = committedResult(
        runtime.dispatcher,
        name === undefined ? { type: 'add-sheet' } : { type: 'add-sheet', name },
        'ref',
      );
      if (typeof result !== 'string') throw invalid('Adding a sheet did not return a sheet ID');
      const sheet = result as SheetId;
      if (wasEmpty) slot.compareAndSetActiveSheet(capture, sheet);
      return sheet;
    },
    deleteSheet(sheet) {
      const capture = slot.capture();
      const { runtime } = capture;
      const before = runtime.controller.getSnapshot();
      const removedIndex = before.sheets.findIndex(item => item.id === sheet);
      runtime.dispatcher.dispatchRef({ type: 'delete-sheet', sheet }, 'ref');
      if (runtime.activeSheet !== sheet) return;
      const after = runtime.controller.getSnapshot();
      const replacementIndex = Math.min(removedIndex, after.sheets.length - 1);
      slot.compareAndSetActiveSheet(
        capture,
        replacementIndex < 0 ? null : after.sheets[replacementIndex]!.id,
      );
    },
    renameSheet(sheet, name) {
      slot.require().dispatcher.dispatchRef({ type: 'rename-sheet', sheet, name }, 'ref');
    },
    activateSheet(sheet) {
      const runtime = slot.require();
      const index = runtime.controller.getSnapshot().sheets.findIndex(item => item.id === sheet);
      if (index < 0) throw invalid(`Unknown sheet ID: ${sheet}`);
      slot.setActiveSheet(sheet);
      runtime.dispatcher.emitActiveSheetChange({ sheet, index, source: 'ref' });
    },
    undo() {
      slot.require().dispatcher.dispatchRef({ type: 'undo' }, 'ref');
    },
    redo() {
      slot.require().dispatcher.dispatchRef({ type: 'redo' }, 'ref');
    },
    validate: () => slot.require().controller.validate(),
    print() {
      slot.require();
      window.print();
    },
    recalculateLayout() {
      slot.require().engineSlot.get()?.recalculateLayout();
    },
  };
}

export function useTegoSheetHandle(
  forwardedRef: ForwardedRef<TegoSheetHandle>,
  getRuntime: () => TegoSheetHandleRuntime,
): void {
  const [slot] = useState(createRuntimeSlot);
  const [handle] = useState(() => createStableHandle(slot));
  useLayoutEffect(() => {
    slot.update(getRuntime());
  });
  useLayoutEffect(() => () => slot.deactivate(), [slot]);
  useImperativeHandle(forwardedRef, () => handle, [handle]);
}
