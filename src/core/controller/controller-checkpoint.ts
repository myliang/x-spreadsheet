import type { WorkbookCommand } from '../commands/workbook-command';
import type { WorkbookState } from '../model/workbook-state';
import type { WorkbookChange } from '../types/changes';
import type { HistoryCheckpoint } from './history';

export interface HistoryMetadata {
  readonly command: WorkbookCommand;
  readonly change: WorkbookChange;
}

export interface ControllerCheckpoint {
  readonly state: WorkbookState;
  readonly history: HistoryCheckpoint<WorkbookState, HistoryMetadata>;
  readonly revision: number;
}

export function createControllerCheckpoint(
  state: WorkbookState,
  history: HistoryCheckpoint<WorkbookState, HistoryMetadata>,
  revision: number,
): ControllerCheckpoint {
  return Object.freeze({ state, history, revision });
}
