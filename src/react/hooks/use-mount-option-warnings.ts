import { useEffect, useRef, useState } from 'react';
import type { CellStyle, SheetOptions } from '../../core';
import { TegoSheetException } from '../../core';

export interface TegoSheetMountOptions {
  readonly rows?: Readonly<{
    readonly initialCount?: number;
    readonly defaultHeight?: number;
  }>;
  readonly columns?: Readonly<{
    readonly initialCount?: number;
    readonly defaultWidth?: number;
    readonly minimumWidth?: number;
  }>;
  readonly rowHeaderWidth?: number;
  readonly defaultStyle?: CellStyle;
  readonly autoFocus?: boolean;
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    ) as T;
  }
  return value;
}

export function captureMountOptions(options: SheetOptions | undefined): TegoSheetMountOptions {
  return clone({
    rows: options?.rows === undefined ? undefined : {
      initialCount: options.rows.initialCount,
      defaultHeight: options.rows.defaultHeight,
    },
    columns: options?.columns === undefined ? undefined : {
      initialCount: options.columns.initialCount,
      defaultWidth: options.columns.defaultWidth,
      minimumWidth: options.columns.minimumWidth,
    },
    rowHeaderWidth: options?.rowHeaderWidth,
    defaultStyle: options?.defaultStyle,
    autoFocus: options?.autoFocus,
  });
}

function invalidOption(name: string): never {
  throw new TegoSheetException({
    code: 'INVALID_COMMAND',
    message: `${name} must be a non-negative finite number`,
    recoverable: false,
  });
}

function validateDimension(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) invalidOption(name);
}

function validateCount(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TegoSheetException({
      code: 'INVALID_COMMAND',
      message: `${name} must be a non-negative safe integer`,
      recoverable: false,
    });
  }
}

function validateMountOptions(options: TegoSheetMountOptions): void {
  validateCount(options.rows?.initialCount, 'options.rows.initialCount');
  validateDimension(options.rows?.defaultHeight, 'options.rows.defaultHeight');
  validateCount(options.columns?.initialCount, 'options.columns.initialCount');
  validateDimension(options.columns?.defaultWidth, 'options.columns.defaultWidth');
  validateDimension(options.columns?.minimumWidth, 'options.columns.minimumWidth');
  validateDimension(options.rowHeaderWidth, 'options.rowHeaderWidth');
}

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => same(item, right[index]));
  }
  const leftKeys = Object.keys(left as object).sort();
  const rightKeys = Object.keys(right as object).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && same(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
      )
    ));
}

interface MountLeaf {
  readonly name: string;
  readonly initial: unknown;
  readonly current: unknown;
}

function leaves(
  initialActiveSheetIndex: number | undefined,
  initial: TegoSheetMountOptions,
  currentActiveSheetIndex: number | undefined,
  current: TegoSheetMountOptions,
): readonly MountLeaf[] {
  return [
    { name: 'initialActiveSheetIndex', initial: initialActiveSheetIndex, current: currentActiveSheetIndex },
    { name: 'options.rows.initialCount', initial: initial.rows?.initialCount, current: current.rows?.initialCount },
    { name: 'options.rows.defaultHeight', initial: initial.rows?.defaultHeight, current: current.rows?.defaultHeight },
    { name: 'options.columns.initialCount', initial: initial.columns?.initialCount, current: current.columns?.initialCount },
    { name: 'options.columns.defaultWidth', initial: initial.columns?.defaultWidth, current: current.columns?.defaultWidth },
    { name: 'options.columns.minimumWidth', initial: initial.columns?.minimumWidth, current: current.columns?.minimumWidth },
    { name: 'options.rowHeaderWidth', initial: initial.rowHeaderWidth, current: current.rowHeaderWidth },
    { name: 'options.defaultStyle', initial: initial.defaultStyle, current: current.defaultStyle },
    { name: 'options.autoFocus', initial: initial.autoFocus, current: current.autoFocus },
  ];
}

export function useMountOptionWarnings(
  initialActiveSheetIndex: number | undefined,
  options: SheetOptions | undefined,
): TegoSheetMountOptions {
  const [baseline] = useState<{
    readonly activeSheetIndex: number | undefined;
    readonly options: TegoSheetMountOptions;
  }>(() => {
    const captured = captureMountOptions(options);
    validateMountOptions(captured);
    return {
      activeSheetIndex: initialActiveSheetIndex,
      options: captured,
    };
  });
  const warned = useRef(new Set<string>());
  const current = captureMountOptions(options);

  useEffect(() => {
    const production = (
      import.meta as ImportMeta & { readonly env?: { readonly PROD?: boolean } }
    ).env?.PROD === true;
    if (production) return;
    for (const leaf of leaves(
      baseline.activeSheetIndex,
      baseline.options,
      initialActiveSheetIndex,
      current,
    )) {
      if (warned.current.has(leaf.name) || same(leaf.initial, leaf.current)) continue;
      warned.current.add(leaf.name);
      console.warn(
        `TegoSheet mount-only option "${leaf.name}" changed after mount; remount with a React key to apply it.`,
      );
    }
  }, [baseline, current, initialActiveSheetIndex]);

  return baseline.options;
}
