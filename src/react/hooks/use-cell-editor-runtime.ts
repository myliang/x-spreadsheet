import { useCallback, type RefObject } from 'react';
import {
  containsCell,
  parseA1Range,
  validationDataToRule,
  type CellAddress,
  type CellPoint,
  type ChangeSource,
  type Selection,
} from '../../core';
import type { ChromeEditor } from '../../ui/sheet-chrome';
import type {
  EditorCommitResult,
  EditorSelectionTarget,
} from '../adapters/interaction-adapter';
import type {
  TegoSheetHandleRuntime,
  TegoSheetRuntimeAuthority,
} from './use-tego-sheet-handle';

export interface ActiveCellEditor extends ChromeEditor {
  readonly address: CellAddress;
  readonly source: ChangeSource;
}

export interface CellEditorRuntime extends TegoSheetHandleRuntime {
  readonly readOnly: boolean;
}

export interface CellEditorRuntimeOptions<Runtime extends CellEditorRuntime> {
  readonly editorRef: RefObject<ActiveCellEditor | null>;
  readonly isActive: () => boolean;
  readonly replaceEditor: (editor: ActiveCellEditor | null) => void;
  readonly runtimeAuthority: TegoSheetRuntimeAuthority<Runtime>;
  readonly setSelection: (selection: Selection) => void;
}

function sameSelection(left: Selection, right: Selection): boolean {
  return left.sheet === right.sheet
    && left.active.row === right.active.row
    && left.active.column === right.active.column
    && left.range.start.row === right.range.start.row
    && left.range.start.column === right.range.start.column
    && left.range.end.row === right.range.end.row
    && left.range.end.column === right.range.end.column;
}

function dateEditorFor(runtime: CellEditorRuntime, address: CellAddress): boolean {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(sheet => sheet.id === runtime.activeSheet);
  const sheet = index < 0 ? undefined : snapshot.value[index];
  if (sheet === undefined) return false;
  return (sheet.validations ?? []).some(data => {
    const rule = validationDataToRule(data);
    if (rule?.type !== 'date') return false;
    return (data.refs ?? []).some(reference => {
      try {
        return containsCell(parseA1Range(reference), address);
      } catch {
        return false;
      }
    });
  });
}

export function useCellEditorRuntime<Runtime extends CellEditorRuntime>(
  options: CellEditorRuntimeOptions<Runtime>,
): Readonly<{
  commitEditor: (
    selectionAfterCommit?: EditorSelectionTarget,
    move?: 'up' | 'down' | 'left' | 'right',
  ) => EditorCommitResult;
  refreshEditorAnchor: () => void;
  requestEdit: (point: CellPoint, initialText: string | undefined, source: ChangeSource) => void;
}> {
  const {
    editorRef,
    isActive,
    replaceEditor,
    runtimeAuthority,
    setSelection,
  } = options;
  const commitEditor = useCallback((
    selectionAfterCommit?: EditorSelectionTarget,
    move?: 'up' | 'down' | 'left' | 'right',
  ): EditorCommitResult => {
    const current = editorRef.current;
    if (current === null) return { allow: true };
    if (!isActive()) {
      editorRef.current = null;
      return { allow: false };
    }
    const runtime = runtimeAuthority.require();
    if (runtime.readOnly || runtime.controller.getSnapshot().readOnly) {
      replaceEditor(null);
      return { allow: false };
    }
    const engine = runtime.engineSlot.get();
    const proposedTarget = selectionAfterCommit ?? (
      move === undefined ? null : engine?.nextSelection(move) ?? null
    );
    const nextTarget = proposedTarget !== null
      && !sameSelection(engine?.publicSelection() ?? proposedTarget.selection, proposedTarget.selection)
      ? proposedTarget
      : null;
    let selectionHandled = nextTarget === null;
    replaceEditor(null);
    const outcome = runtime.dispatcher.dispatchUi(
      { type: 'set-cell-text', address: current.address, text: current.value },
      current.source,
      nextTarget === null ? undefined : {
        selectionAfterCommit: nextTarget.selection,
        beforeSelectionNotify: () => {
          engine?.stageSelection(nextTarget.state);
          setSelection(nextTarget.selection);
          selectionHandled = true;
        },
      },
    );
    if (outcome.status === 'rejected') {
      if (isActive() && editorRef.current === null) replaceEditor(current);
      return { allow: false };
    }
    if (!isActive()) return { allow: false };
    replaceEditor(null);
    if (outcome.status === 'committed' && !selectionHandled) {
      return { allow: false };
    }
    if (nextTarget !== null && outcome.status === 'noop') {
      engine?.stageSelection(nextTarget.state);
      setSelection(nextTarget.selection);
      runtime.dispatcher.emitSelectionChange(nextTarget.selection);
      engine?.render(runtime.controller.getSnapshot(), runtime.activeSheet);
      selectionHandled = true;
    }
    runtime.root?.focus();
    return { allow: true };
  }, [editorRef, isActive, replaceEditor, runtimeAuthority, setSelection]);

  const refreshEditorAnchor = useCallback(() => {
    const current = editorRef.current;
    if (current === null || !isActive()) return;
    const anchor = runtimeAuthority.require().engineSlot.get()?.overlayAnchor(current.address);
    if (anchor === null || anchor === undefined) {
      replaceEditor(null);
      return;
    }
    if (
      anchor.left === current.anchor.left
      && anchor.top === current.anchor.top
      && anchor.width === current.anchor.width
      && anchor.height === current.anchor.height
      && anchor.clipped === current.anchor.clipped
    ) return;
    replaceEditor({ ...current, anchor });
  }, [editorRef, isActive, replaceEditor, runtimeAuthority]);

  const requestEdit = useCallback((
    point: CellPoint,
    initialText: string | undefined,
    source: ChangeSource,
  ) => {
    if (!isActive()) return;
    const runtime = runtimeAuthority.require();
    if (runtime.readOnly || runtime.controller.getSnapshot().readOnly || runtime.activeSheet === null) return;
    const anchor = runtime.engineSlot.get()?.ensureVisible(point);
    if (anchor === null || anchor === undefined) return;
    const address: CellAddress = { sheet: runtime.activeSheet, ...point };
    const original = runtime.controller.getCellText(address);
    replaceEditor({
      address,
      anchor,
      date: dateEditorFor(runtime, address),
      source,
      value: initialText ?? original,
      onCancel: () => {
        replaceEditor(null);
        runtime.root?.focus();
      },
      onChange: value => {
        const active = editorRef.current;
        if (active !== null && active.address === address) replaceEditor({ ...active, value });
      },
      onCommit: move => { void commitEditor(undefined, move); },
    });
  }, [commitEditor, editorRef, isActive, replaceEditor, runtimeAuthority]);

  return { commitEditor, refreshEditorAnchor, requestEdit };
}
