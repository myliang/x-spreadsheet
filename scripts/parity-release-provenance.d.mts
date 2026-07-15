import type { ParityReleaseContext } from '../tests/parity/manifest-types.ts';

export function hashReleaseFiles(root: string, paths: readonly string[]): string;
export function computeParityReleaseIdentity(root: string): Pick<ParityReleaseContext, 'revision' | 'treeHash' | 'manifestHash' | 'lanes'>;
export function createParityReleaseContext(root: string, now?: Date): ParityReleaseContext;
export function assertParityReleaseContextCurrent(context: unknown, root: string, now?: Date): void;
