import { TegoSheetException } from '../../core/errors/tego-sheet-exception';
import type { Selection } from '../../core/types/coordinates';

export interface ClipboardPort {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface DataTransferPort {
  clearData?(): void;
  getData(type: string): string;
  setData(type: string, value: string): void;
}

export interface InternalClipboardState {
  readonly selection: Selection;
  readonly cut: boolean;
  readonly text: string;
}

export function matrixToTsv(values: readonly (readonly string[])[]): string {
  return values.map(row => row.join('\t')).join('\n');
}

export function clipboardDenied(cause: unknown): TegoSheetException {
  return new TegoSheetException({
    code: 'CLIPBOARD_DENIED',
    message: 'Clipboard access was denied',
    recoverable: true,
    cause,
  });
}

export function clipboardSelectionUnavailable(cause: unknown): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message: 'The selected cells cannot be copied',
    recoverable: true,
    cause,
  });
}
