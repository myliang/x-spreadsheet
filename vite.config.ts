import { existsSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
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

export function addJavaScriptDeclarationExtensions(filePath: string, content: string): string {
  const sourceDirectory = resolve(
    import.meta.dirname,
    'src',
    dirname(relative(resolve(import.meta.dirname, 'dist'), filePath)),
  );
  return content.replace(
    /(from\s+['"]|import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\)?)/g,
    (statement, prefix: string, specifier: string, suffix: string) => {
      if (/\.(?:[cm]?js|json|css)$/.test(specifier)) return statement;
      const sourceTarget = resolve(sourceDirectory, specifier);
      const extension = existsSync(sourceTarget) && statSync(sourceTarget).isDirectory()
        ? '/index.js'
        : '.js';
      return `${prefix}${specifier}${extension}${suffix}`;
    },
  );
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.build.json',
      beforeWriteFile: (filePath, content) => ({
        content: addJavaScriptDeclarationExtensions(filePath, content),
      }),
    }),
  ],
  build: {
    lib: {
      cssFileName: 'styles',
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        'locales/index': resolve(import.meta.dirname, 'src/locales/index.ts'),
      },
      fileName: (format, entryName) => {
        const extension = format === 'es' ? 'js' : 'cjs';
        return entryName === 'index' ? `tego-sheet.${extension}` : `${entryName}.${extension}`;
      },
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
