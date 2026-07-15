import type { TegoSheetError, TegoSheetErrorCode } from './tego-sheet-error';

export class TegoSheetException extends Error {
  override readonly name = 'TegoSheetException';
  override readonly cause?: unknown;
  readonly error: TegoSheetError;
  readonly code: TegoSheetErrorCode;
  readonly recoverable: boolean;

  constructor(error: TegoSheetError) {
    super(error.message, { cause: error.cause });
    this.cause = error.cause;
    this.error = error;
    this.code = error.code;
    this.recoverable = error.recoverable;
  }
}
