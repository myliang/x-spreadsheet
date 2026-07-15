import {
  canonicalizeWorkbook,
  TegoSheetException,
  type TegoSheetError,
  type WorkbookData,
  type WorkbookInput,
  type WorkbookInitializationDefaults,
} from '../../core';
import type { PendingCheckpoint } from './pending-checkpoint';

export type CanonicalWorkbook = WorkbookData;

export type ValueUpdate =
  | { readonly kind: 'same-reference' }
  | { readonly kind: 'acknowledge'; readonly through: number }
  | { readonly kind: 'rollback' }
  | { readonly kind: 'replace'; readonly workbook: CanonicalWorkbook }
  | { readonly kind: 'invalid'; readonly error: TegoSheetError };

export interface ValueClassificationState {
  readonly observedValue: unknown;
  readonly acknowledgedKey: string;
  readonly pending: readonly PendingCheckpoint[];
}

function invalidValue(cause: unknown): TegoSheetError {
  const message = cause instanceof TegoSheetException
    ? cause.message
    : 'Workbook data is invalid';
  return {
    code: 'INVALID_DATA',
    message,
    recoverable: true,
    cause,
  };
}

export function classifyValueUpdate(
  state: ValueClassificationState,
  value: WorkbookInput,
  defaults: Readonly<WorkbookInitializationDefaults> = {},
): ValueUpdate {
  if (Object.is(value, state.observedValue)) return { kind: 'same-reference' };
  let workbook: WorkbookData;
  try {
    workbook = canonicalizeWorkbook(value, defaults);
  } catch (cause) {
    return { kind: 'invalid', error: invalidValue(cause) };
  }
  const key = JSON.stringify(workbook);
  for (let index = state.pending.length - 1; index >= 0; index -= 1) {
    if (state.pending[index]!.projectedKey === key) {
      return { kind: 'acknowledge', through: index };
    }
  }
  if (key === state.acknowledgedKey) return { kind: 'rollback' };
  return { kind: 'replace', workbook };
}
