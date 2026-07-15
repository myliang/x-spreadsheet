import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = resolve(import.meta.dirname, '..');

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'tego-sheet/locales/zh-cn',
        replacement: resolve(repositoryRoot, 'src/locales/zh-cn.ts'),
      },
      {
        find: 'tego-sheet/styles.css',
        replacement: resolve(repositoryRoot, 'src/ui/styles/index.less'),
      },
      {
        find: 'tego-sheet',
        replacement: resolve(repositoryRoot, 'src/index.ts'),
      },
    ],
  },
  build: {
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'demo-dist'),
  },
});
