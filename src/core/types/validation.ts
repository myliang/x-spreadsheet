import type { CellAddress, SheetId } from './coordinates';

export type ValidationType = 'date' | 'number' | 'list' | 'phone' | 'email';

export type ValidationOperator =
  | 'be'
  | 'nbe'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte';

export interface ValidationRule {
  readonly mode: 'cell';
  readonly type: ValidationType;
  readonly required: boolean;
  readonly operator?: ValidationOperator;
  readonly value?: string | readonly [string, string];
}

export interface ValidationIssue {
  readonly sheet: SheetId;
  readonly sheetIndex: number;
  readonly address: CellAddress;
  readonly rule: ValidationRule;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}
