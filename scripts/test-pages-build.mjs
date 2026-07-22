import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const pagesRoot = resolve(repositoryRoot, 'docs');

async function verifyPagesBuild() {
  const index = await readFile(resolve(pagesRoot, 'index.html'), 'utf8');
  const assetNames = await readdir(resolve(pagesRoot, 'assets'));
  const scriptNames = assetNames.filter(name => /^index-[\w-]+\.js$/.test(name));
  const styleNames = assetNames.filter(name => /^index-[\w-]+\.css$/.test(name));
  const scriptName = scriptNames[0];
  const styleName = styleNames[0];

  if (!index.includes('/x-spreadsheet/assets/')) {
    throw new Error('docs/index.html does not use the /x-spreadsheet/ Pages base');
  }
  if (index.includes('localhost')) {
    throw new Error('docs/index.html contains a localhost URL');
  }
  if (scriptNames.length !== 1 || styleNames.length !== 1 || scriptName === undefined || styleName === undefined) {
    throw new Error(`Pages assets are stale or incomplete: ${assetNames.join(', ')}`);
  }
  if (!index.includes(`/x-spreadsheet/assets/${scriptName}`)
    || !index.includes(`/x-spreadsheet/assets/${styleName}`)) {
    throw new Error('docs/index.html does not reference the generated Pages assets');
  }

  const script = await readFile(resolve(pagesRoot, 'assets', scriptName), 'utf8');
  if (!script.includes('Product roadmap') || !script.includes('template-printing.md')) {
    throw new Error('Pages JavaScript bundle does not contain the Roadmap section');
  }

  console.log(`Pages bundle verified: ${scriptName}`);
}

verifyPagesBuild().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
