import type { WorkbookCommand } from '../commands/workbook-command';
import type { WorkbookState } from '../model/workbook-state';
import type { WorkbookChange } from '../types/changes';
import type { HistoryCheckpoint } from './history';

const checkpointOwner: unique symbol = Symbol('tego-sheet.controller-checkpoint-owner');

export interface HistoryMetadata {
  readonly command: WorkbookCommand;
  readonly change: WorkbookChange;
}

export interface ControllerCheckpoint {
  readonly state: WorkbookState;
  readonly history: HistoryCheckpoint<WorkbookState, HistoryMetadata>;
  readonly revision: number;
  readonly [checkpointOwner]: object;
}

export function createControllerCheckpoint(
  state: WorkbookState,
  history: HistoryCheckpoint<WorkbookState, HistoryMetadata>,
  revision: number,
  owner: object,
): ControllerCheckpoint {
  const checkpoint = { state, history, revision } as ControllerCheckpoint;
  Object.defineProperty(checkpoint, checkpointOwner, {
    configurable: false,
    enumerable: false,
    value: owner,
    writable: false,
  });
  return Object.freeze(checkpoint);
}

export function hasCheckpointOwner(
  checkpoint: ControllerCheckpoint,
  owner: object,
): boolean {
  return checkpoint[checkpointOwner] === owner;
}
