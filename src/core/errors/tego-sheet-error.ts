export type TegoSheetErrorCode =
  | 'INVALID_DATA'
  | 'INVALID_COMMAND'
  | 'CLIPBOARD_DENIED'
  | 'PRINT_FAILED'
  | 'RENDER_FAILED';

export interface TegoSheetError {
  readonly code: TegoSheetErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
}
