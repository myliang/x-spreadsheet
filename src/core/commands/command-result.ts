import type { WorkbookData } from '../types/workbook';
import type { WorkbookChange } from '../types/changes';
import type { WorkbookCommand } from './workbook-command';

export interface CommandCommit<
  Result = void,
  Command extends WorkbookCommand = WorkbookCommand,
> {
  readonly command: Command;
  readonly change: WorkbookChange;
  readonly result: Result;
  readonly value: WorkbookData;
}

export type CommandOutcome<
  Result = void,
  Command extends WorkbookCommand = WorkbookCommand,
> =
  | { readonly status: 'noop' }
  | { readonly status: 'committed'; readonly commit: CommandCommit<Result, Command> };
