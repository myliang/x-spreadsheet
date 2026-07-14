const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const workbookIds = ['blank-object', 'empty-array', 'multiple-sheets', 'sheet-fields', 'rows', 'cells', 'columns', 'styles', 'validations', 'autofilter', 'sparse-falsy'];
const operationIds = ['history', 'structure', 'merge', 'clipboard', 'autofill', 'filter', 'sort', 'formulas', 'freeze', 'printable'];
const targets = [
  ...workbookIds.map(id => `tests/parity/fixtures/workbooks/${id}.json`),
  ...operationIds.map(id => `tests/parity/fixtures/operations/${id}.json`),
  'tests/parity/legacy/baseline-meta.json',
];

function writeFailureInjector(filePath) {
  const source = `
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.ATOMIC_CAPTURE_ROOT);
const failAt = Number(process.env.ATOMIC_CAPTURE_FAIL_AT);
let publishCount = 0;

function isTarget(filePath) {
  const absolute = path.resolve(String(filePath));
  const fixtureRoot = path.join(root, 'tests/parity/fixtures') + path.sep;
  const metadata = path.join(root, 'tests/parity/legacy/baseline-meta.json');
  return absolute === metadata
    || (absolute.startsWith(fixtureRoot) && absolute.endsWith('.json'));
}

function failOnNthPublish(filePath) {
  if (!isTarget(filePath)) return;
  publishCount += 1;
  if (publishCount === failAt) {
    throw new Error('injected fifth publish failure');
  }
}

const writeFileSync = fs.writeFileSync;
fs.writeFileSync = function patchedWriteFileSync(filePath, ...args) {
  failOnNthPublish(filePath);
  return writeFileSync.call(this, filePath, ...args);
};

const renameSync = fs.renameSync;
fs.renameSync = function patchedRenameSync(source, target) {
  failOnNthPublish(target);
  return renameSync.call(this, source, target);
};
`;
  fs.writeFileSync(filePath, source);
}

function readState(root) {
  return new Map(targets.map((relativePath) => {
    const filePath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(filePath) ? fs.readFileSync(filePath) : null];
  }));
}

function findArtifacts(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true })
    .filter(entry => /(?:\.tmp-|\.bak-|legacy-parity-)/.test(entry));
}

test('capture rollback preserves the complete previous baseline after an Nth publish failure', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-parity-atomicity-')));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));

  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'scripts/capture-legacy-parity.cjs'),
    path.join(root, 'scripts/capture-legacy-parity.cjs'),
  );
  fs.symlinkSync(path.join(repoRoot, 'src'), path.join(root, 'src'), 'dir');

  targets.forEach((relativePath, index) => {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (index === 1 || index === 3) return;
    fs.writeFileSync(filePath, `{"sentinel":${JSON.stringify(relativePath)}}\n`);
  });
  const before = readState(root);

  const injectorPath = path.join(root, 'inject-publish-failure.cjs');
  writeFailureInjector(injectorPath);
  const result = spawnSync(
    process.execPath,
    [
      '-r',
      require.resolve('@babel/register'),
      '-r',
      injectorPath,
      path.join(root, 'scripts/capture-legacy-parity.cjs'),
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ATOMIC_CAPTURE_FAIL_AT: '5',
        ATOMIC_CAPTURE_ROOT: root,
      },
    },
  );

  assert.notEqual(
    result.status,
    0,
    `failure injection must abort capture\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stderr, /injected fifth publish failure/);

  const after = readState(root);
  targets.forEach((relativePath) => {
    assert.deepEqual(after.get(relativePath), before.get(relativePath), `${relativePath} changed`);
  });
  assert.deepEqual(findArtifacts(path.join(root, 'tests')), [], 'temporary publication artifacts remain');
});
