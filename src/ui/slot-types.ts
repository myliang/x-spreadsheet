import type { ReactNode } from 'react';
import type { SheetTabsRenderProps, ToolbarRenderProps } from '../core';

export type ToolbarRenderer = (props: ToolbarRenderProps) => ReactNode;
export type SheetTabsRenderer = (props: SheetTabsRenderProps) => ReactNode;
