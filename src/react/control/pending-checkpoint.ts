import type { CommandCommit } from '../../core/commands/command-result';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import type { ControllerCheckpoint } from '../../core/controller/controller-checkpoint';
import type { WorkbookController } from '../../core/controller/workbook-controller';
import type { ChangeSource, SheetId, WorkbookData } from '../../core';

export interface PendingCheckpoint {
  readonly command: WorkbookCommand;
  readonly source: ChangeSource;
  readonly changeId: string;
  readonly projected: WorkbookData;
  readonly projectedKey: string;
  readonly checkpoint: ControllerCheckpoint;
  readonly runtimeSheetIds: readonly SheetId[];
  readonly addedSheetId?: SheetId;
}

export function createPendingCheckpoint(
  controller: WorkbookController,
  commit: CommandCommit<unknown, WorkbookCommand>,
  original?: PendingCheckpoint,
): PendingCheckpoint {
  const addedSheetId = original?.addedSheetId ?? (
    commit.command.type === 'add-sheet' && typeof commit.result === 'string'
      ? commit.result as SheetId
      : undefined
  );
  return Object.freeze({
    command: original?.command ?? commit.command,
    source: original?.source ?? commit.change.source,
    changeId: original?.changeId ?? commit.change.id,
    projected: original?.projected ?? commit.value,
    projectedKey: original?.projectedKey ?? JSON.stringify(commit.value),
    checkpoint: controller.checkpoint(),
    runtimeSheetIds: original?.runtimeSheetIds ?? controller.getSheetIds(),
    ...(addedSheetId === undefined ? {} : { addedSheetId }),
  });
}
