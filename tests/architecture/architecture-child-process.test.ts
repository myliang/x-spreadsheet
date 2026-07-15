import { expect, it, vi } from 'vitest';
import {
  ARCHITECTURE_CHILD_MAX_BUFFER_BYTES,
  ARCHITECTURE_CHILD_TIMEOUT_MS,
  ARCHITECTURE_TEST_TIMEOUT_MS,
  execArchitectureChild,
} from './helpers/architecture-child-process';

it('enforces a process timeout below the outer architecture-test budget', () => {
  const executor = vi.fn(() => 'listed');

  expect(execArchitectureChild('/node', ['cli.js'], { cwd: '/repo' }, executor)).toBe('listed');
  expect(executor).toHaveBeenCalledWith('/node', ['cli.js'], expect.objectContaining({
    encoding: 'utf8',
    maxBuffer: ARCHITECTURE_CHILD_MAX_BUFFER_BYTES,
    stdio: 'pipe',
    timeout: ARCHITECTURE_CHILD_TIMEOUT_MS,
  }));
  expect(ARCHITECTURE_CHILD_TIMEOUT_MS).toBeLessThan(ARCHITECTURE_TEST_TIMEOUT_MS);
});
