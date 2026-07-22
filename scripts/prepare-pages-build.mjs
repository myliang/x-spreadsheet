import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const pagesRoot = resolve(import.meta.dirname, '..', 'docs');

await Promise.all([
  rm(resolve(pagesRoot, 'assets'), { force: true, recursive: true }),
  rm(resolve(pagesRoot, 'index.html'), { force: true }),
]);
