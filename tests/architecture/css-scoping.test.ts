import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import less from 'less';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const styleEntry = resolve(root, 'src/ui/styles/index.less');

function selectors(css: string): readonly string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([^{}]+)\{/g)]
    .flatMap(match => (match[1] ?? '').trim().startsWith('@')
      ? []
      : (match[1] ?? '').split(',').map(value => value.trim()))
    .filter(Boolean);
}

it('keeps every emitted stylesheet selector beneath the tego-sheet namespace', async () => {
  const rendered = await less.render(readFileSync(styleEntry, 'utf8'), {
    filename: styleEntry,
  });
  const emitted = selectors(rendered.css);

  expect(emitted.length).toBeGreaterThan(0);
  for (const selector of emitted) {
    expect(selector, selector).toMatch(/^\.tego-sheet(?:[\s.#:[>+~]|$)/);
    expect(selector, selector).not.toMatch(/^(?:html|body|button|input|select|textarea|label|fieldset)\b/i);
  }
});

it('does not inject global body, html, or unscoped form-control selectors at runtime', () => {
  const printSource = readFileSync(resolve(root, 'src/ui/print-workbook.ts'), 'utf8');

  expect(printSource).not.toMatch(/(?:^|[\s'"`{;,])(?:body|html)\s*(?:[>+~.#:[{]|$)/im);
  expect(printSource).not.toMatch(/@media\s+print[\s\S]*?\b(?:button|input|select|textarea)\b/i);
});

it('renders toolbar icons as component-owned SVG without a global icon font', async () => {
  const buttonSource = readFileSync(resolve(root, 'src/ui/toolbar/toolbar-button.tsx'), 'utf8');
  const rendered = await less.render(readFileSync(styleEntry, 'utf8'), { filename: styleEntry });

  expect(buttonSource).toMatch(/<svg\b/);
  expect(buttonSource).toMatch(/aria-hidden/);
  expect(rendered.css).not.toMatch(/@font-face|font-family:\s*['"]?(?:icon|tego-icon)/i);
});

it('keeps the demo on declared package imports instead of implementation paths', () => {
  const demoSources = ['demo/src/main.tsx', 'demo/src/app.tsx']
    .map(file => readFileSync(resolve(root, file), 'utf8'))
    .join('\n');

  expect(demoSources).toMatch(/from ['"]tego-sheet['"]/);
  expect(demoSources).toMatch(/['"]tego-sheet\/styles\.css['"]/);
  expect(demoSources).not.toMatch(/(?:\.\.\/)+src\/|src\/(?:core|engine|react|ui|locales)/);
});
