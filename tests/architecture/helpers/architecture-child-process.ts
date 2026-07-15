import {
  execFileSync,
  type ExecFileSyncOptionsWithStringEncoding,
} from 'node:child_process';

export const ARCHITECTURE_CHILD_TIMEOUT_MS = 20_000;
export const ARCHITECTURE_CHILD_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
export const ARCHITECTURE_TEST_TIMEOUT_MS = 30_000;

export type ArchitectureChildExecutor = (
  file: string,
  arguments_: readonly string[],
  options: ExecFileSyncOptionsWithStringEncoding,
) => string;

const defaultExecutor: ArchitectureChildExecutor = (file, arguments_, options) => (
  execFileSync(file, arguments_, options)
);

export function execArchitectureChild(
  file: string,
  arguments_: readonly string[],
  options: Pick<ExecFileSyncOptionsWithStringEncoding, 'cwd' | 'env'>,
  executor: ArchitectureChildExecutor = defaultExecutor,
): string {
  return executor(file, arguments_, {
    ...options,
    encoding: 'utf8',
    maxBuffer: ARCHITECTURE_CHILD_MAX_BUFFER_BYTES,
    stdio: 'pipe',
    timeout: ARCHITECTURE_CHILD_TIMEOUT_MS,
  });
}
