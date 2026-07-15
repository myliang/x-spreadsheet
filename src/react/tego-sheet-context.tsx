/* eslint-disable react-refresh/only-export-components -- provider and its scoped consumer hook form one internal context surface. */
import { createContext, useContext, type ReactNode } from 'react';
import type { SheetTabsRenderProps, ToolbarRenderProps } from '../core';

export interface TegoSheetContextValue {
  readonly toolbar: ToolbarRenderProps;
  readonly sheetTabs: SheetTabsRenderProps;
}

const TegoSheetContext = createContext<TegoSheetContextValue | null>(null);

export function TegoSheetProvider(props: {
  readonly value: TegoSheetContextValue;
  readonly children: ReactNode;
}) {
  return (
    <TegoSheetContext.Provider value={props.value}>
      {props.children}
    </TegoSheetContext.Provider>
  );
}

export function useTegoSheetContext(): TegoSheetContextValue {
  const value = useContext(TegoSheetContext);
  if (value === null) throw new Error('TegoSheet slot host is outside its provider');
  return value;
}
