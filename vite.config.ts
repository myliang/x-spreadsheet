import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export function isReactExternal(id: string): boolean {
  return (
    id === 'react'
    || id.startsWith('react/')
    || id === 'react-dom'
    || id.startsWith('react-dom/')
  );
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  build: {
    lib: {
      cssFileName: 'styles',
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      fileName: (format) => (format === 'es' ? 'tego-sheet.js' : 'tego-sheet.cjs'),
      formats: ['es', 'cjs'],
      name: 'TegoSheet',
    },
    rollupOptions: {
      external: isReactExternal,
      output: {
        exports: 'named',
      },
    },
    sourcemap: true,
  },
});
