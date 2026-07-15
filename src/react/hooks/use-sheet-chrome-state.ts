import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Selection, TegoSheetError } from '../../core';
import type { ChromeContextMenu, ChromeEditor } from '../../ui/sheet-chrome';

export interface SheetChromeState<Editor extends ChromeEditor> {
  readonly editor: Editor | null;
  readonly editorRef: RefObject<Editor | null>;
  readonly contextMenu: ChromeContextMenu | null;
  readonly filterOpen: boolean;
  readonly validationOpen: boolean;
  readonly printOpen: boolean;
  readonly notification: TegoSheetError | null;
  readonly paintSource: Selection | null;
  readonly replaceEditor: (editor: Editor | null) => void;
  readonly cancelTransient: () => void;
  readonly requestContextMenu: (
    point: Readonly<{ readonly x: number; readonly y: number }>,
    selection: Selection,
  ) => void;
  readonly closeContextMenu: () => void;
  readonly openFilter: () => void;
  readonly openValidation: () => void;
  readonly setFilterOpen: Dispatch<SetStateAction<boolean>>;
  readonly setValidationOpen: Dispatch<SetStateAction<boolean>>;
  readonly setPrintOpen: Dispatch<SetStateAction<boolean>>;
  readonly setNotification: Dispatch<SetStateAction<TegoSheetError | null>>;
  readonly togglePaintSource: (selection: Selection) => void;
  readonly consumePaintSource: (selection: Selection) => Selection | null;
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

export function useSheetChromeState<Editor extends ChromeEditor>(
  isActive: () => boolean,
): SheetChromeState<Editor> {
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [contextMenu, setContextMenu] = useState<ChromeContextMenu | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [notification, setNotification] = useState<TegoSheetError | null>(null);
  const [paintSource, setPaintSource] = useState<Selection | null>(null);
  const paintSourceRef = useRef<Selection | null>(null);

  const replaceEditor = useCallback((next: Editor | null) => {
    editorRef.current = next;
    if (isActive()) setEditor(next);
  }, [isActive]);
  const cancelTransient = useCallback(() => {
    replaceEditor(null);
    paintSourceRef.current = null;
    if (!isActive()) return;
    setPaintSource(null);
    setContextMenu(null);
    setFilterOpen(false);
    setValidationOpen(false);
    setPrintOpen(false);
  }, [isActive, replaceEditor]);
  const requestContextMenu = useCallback((
    point: Readonly<{ readonly x: number; readonly y: number }>,
    selection: Selection,
  ) => {
    if (isActive()) setContextMenu({ point, selection });
  }, [isActive]);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openFilter = useCallback(() => {
    closeContextMenu();
    setFilterOpen(true);
  }, [closeContextMenu]);
  const openValidation = useCallback(() => {
    closeContextMenu();
    setValidationOpen(true);
  }, [closeContextMenu]);
  const togglePaintSource = useCallback((selection: Selection) => {
    const next = paintSourceRef.current === null ? selection : null;
    paintSourceRef.current = next;
    if (isActive()) setPaintSource(next);
  }, [isActive]);
  const consumePaintSource = useCallback((selection: Selection): Selection | null => {
    const source = paintSourceRef.current;
    if (source === null || sameSelection(source, selection)) return null;
    paintSourceRef.current = null;
    if (isActive()) setPaintSource(null);
    return source;
  }, [isActive]);

  return {
    editor,
    editorRef,
    contextMenu,
    filterOpen,
    validationOpen,
    printOpen,
    notification,
    paintSource,
    replaceEditor,
    cancelTransient,
    requestContextMenu,
    closeContextMenu,
    openFilter,
    openValidation,
    setFilterOpen,
    setValidationOpen,
    setPrintOpen,
    setNotification,
    togglePaintSource,
    consumePaintSource,
  };
}
