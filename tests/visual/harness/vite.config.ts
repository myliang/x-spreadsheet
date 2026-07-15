import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = resolve(import.meta.dirname, '../../..');

export default defineConfig({
  root: import.meta.dirname,
  publicDir: resolve(projectRoot, 'tests/visual'),
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'tego-sheet/styles.css', replacement: resolve(projectRoot, 'src/ui/styles/index.less') },
      { find: 'tego-sheet/locales', replacement: resolve(projectRoot, 'src/locales/index.ts') },
      { find: 'tego-sheet', replacement: resolve(projectRoot, 'src/index.ts') },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
});
