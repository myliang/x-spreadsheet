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
const publishFailAt = Number(process.env.ATOMIC_CAPTURE_PUBLISH_FAIL_AT || 0);
let publishCount = 0;

const writeFileSync = fs.writeFileSync;
const copyFileSync = fs.copyFileSync;
const renameSync = fs.renameSync;
const rmSync = fs.rmSync;

function summary(error) {
  if (!(error instanceof Error)) return null;
  return { message: error.message, name: error.name };
}

process.on('uncaughtExceptionMonitor', (error) => {
  writeFileSync(process.env.ATOMIC_CAPTURE_ERROR_REPORT, JSON.stringify({
    cause: summary(error.cause),
    cleanupError: summary(error.cleanupError),
    errors: Array.isArray(error.errors) ? error.errors.map(summary) : null,
    message: error.message,
    name: error.name,
    publicationError: summary(error.publicationError),
    recoveryDirectory: error.recoveryDirectory || null,
    rollbackErrors: Array.isArray(error.rollbackErrors) ? error.rollbackErrors.map(summary) : null,
  }, null, 2));
});

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
  if (publishCount === publishFailAt) {
    if (process.env.ATOMIC_CAPTURE_CONCURRENT_TARGET) {
      writeFileSync(
        path.join(root, process.env.ATOMIC_CAPTURE_CONCURRENT_TARGET),
        process.env.ATOMIC_CAPTURE_CONCURRENT_BYTES,
      );
    }
    throw new Error('injected fifth publish failure');
  }
}

fs.writeFileSync = function patchedWriteFileSync(filePath, ...args) {
  failOnNthPublish(filePath);
  return writeFileSync.call(this, filePath, ...args);
};

fs.copyFileSync = function patchedCopyFileSync(source, target, ...args) {
  const rollbackTarget = process.env.ATOMIC_CAPTURE_ROLLBACK_FAIL_TARGET;
  if (rollbackTarget
    && path.resolve(String(target)) === path.join(root, rollbackTarget)
    && String(source).includes('.capture-legacy-parity-')) {
    throw new Error('injected rollback restoration failure');
  }
  return copyFileSync.call(this, source, target, ...args);
};

fs.renameSync = function patchedRenameSync(source, target) {
  failOnNthPublish(target);
  return renameSync.call(this, source, target);
};

fs.rmSync = function patchedRmSync(target, ...args) {
  if (process.env.ATOMIC_CAPTURE_CLEANUP_FAIL === '1'
    && path.basename(String(target)).startsWith('.capture-legacy-parity-')) {
    throw new Error('injected transaction cleanup failure');
  }
  return rmSync.call(this, target, ...args);
};
`;
  fs.writeFileSync(filePath, source);
}

function createSandbox(t, missingIndexes = [1, 3]) {
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
    if (missingIndexes.includes(index)) return;
    fs.writeFileSync(filePath, `{"sentinel":${JSON.stringify(relativePath)}}\n`);
  });
  return root;
}

function readState(root) {
  return new Map(targets.map((relativePath) => {
    const filePath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(filePath) ? fs.readFileSync(filePath) : null];
  }));
}

function recoveryDirectories(root) {
  const parityDir = path.join(root, 'tests/parity');
  if (!fs.existsSync(parityDir)) return [];
  return fs.readdirSync(parityDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('.capture-legacy-parity-'))
    .map(entry => path.join(parityDir, entry.name));
}

function runCapture(root, injected = {}) {
  const injectorPath = path.join(root, 'inject-publish-failure.cjs');
  const errorReport = path.join(root, 'capture-error.json');
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
        ATOMIC_CAPTURE_ERROR_REPORT: errorReport,
        ATOMIC_CAPTURE_ROOT: root,
        ...injected,
      },
    },
  );
  return {
    ...result,
    error: fs.existsSync(errorReport) ? JSON.parse(fs.readFileSync(errorReport, 'utf8')) : null,
  };
}

function assertFailed(result) {
  assert.notEqual(
    result.status,
    0,
    `failure injection must abort capture\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function assertStateEqual(actual, expected, except = new Set()) {
  targets.forEach((relativePath) => {
    if (!except.has(relativePath)) {
      assert.deepEqual(actual.get(relativePath), expected.get(relativePath), `${relativePath} changed`);
    }
  });
}

test('capture rollback preserves the complete previous baseline after an Nth publish failure', (t) => {
  const root = createSandbox(t);
  const before = readState(root);
  const result = runCapture(root, { ATOMIC_CAPTURE_PUBLISH_FAIL_AT: '5' });

  assertFailed(result);
  assert.equal(result.error.message, 'injected fifth publish failure');
  assertStateEqual(readState(root), before);
  assert.deepEqual(recoveryDirectories(root), []);
});

test('incomplete rollback retains recovery backups and exposes publication and rollback errors', (t) => {
  const root = createSandbox(t);
  const before = readState(root);
  const result = runCapture(root, {
    ATOMIC_CAPTURE_PUBLISH_FAIL_AT: '5',
    ATOMIC_CAPTURE_ROLLBACK_FAIL_TARGET: targets[0],
  });

  assertFailed(result);
  assert.equal(result.error.name, 'AggregateError');
  assert.equal(result.error.publicationError.message, 'injected fifth publish failure');
  assert.deepEqual(
    result.error.rollbackErrors.map(error => error.message),
    ['injected rollback restoration failure'],
  );
  assert.match(result.error.recoveryDirectory, /\.capture-legacy-parity-/);
  const recovery = recoveryDirectories(root);
  assert.deepEqual(recovery, [result.error.recoveryDirectory]);
  assert.equal(fs.existsSync(path.join(recovery[0], 'backup-0.json.bak')), true);
  assert.notDeepEqual(readState(root).get(targets[0]), before.get(targets[0]));
});

test('cleanup failure after rollback preserves the publication error as the cause', (t) => {
  const root = createSandbox(t);
  const before = readState(root);
  const result = runCapture(root, {
    ATOMIC_CAPTURE_CLEANUP_FAIL: '1',
    ATOMIC_CAPTURE_PUBLISH_FAIL_AT: '5',
  });

  assertFailed(result);
  assert.equal(result.error.name, 'AggregateError');
  assert.equal(result.error.cause.message, 'injected fifth publish failure');
  assert.equal(result.error.publicationError.message, 'injected fifth publish failure');
  assert.equal(result.error.cleanupError.message, 'injected transaction cleanup failure');
  assert.match(result.error.recoveryDirectory, /\.capture-legacy-parity-/);
  assertStateEqual(readState(root), before);
  assert.deepEqual(recoveryDirectories(root), [result.error.recoveryDirectory]);
});

test('rollback leaves a concurrent edit to an untouched target intact', (t) => {
  const root = createSandbox(t);
  const before = readState(root);
  const concurrentBytes = '{"concurrent":true}\n';
  const concurrentTarget = targets[10];
  const result = runCapture(root, {
    ATOMIC_CAPTURE_CONCURRENT_BYTES: concurrentBytes,
    ATOMIC_CAPTURE_CONCURRENT_TARGET: concurrentTarget,
    ATOMIC_CAPTURE_PUBLISH_FAIL_AT: '5',
  });

  assertFailed(result);
  const after = readState(root);
  assertStateEqual(after, before, new Set([concurrentTarget]));
  assert.deepEqual(after.get(concurrentTarget), Buffer.from(concurrentBytes));
  assert.deepEqual(recoveryDirectories(root), []);
});

test('capture rejects a symlink target before mutating the baseline', (t) => {
  const root = createSandbox(t, []);
  const symlinkTarget = path.join(root, targets[0]);
  const referent = path.join(root, 'symlink-referent.json');
  fs.writeFileSync(referent, '{"referent":true}\n');
  fs.unlinkSync(symlinkTarget);
  fs.symlinkSync(referent, symlinkTarget);
  const before = readState(root);

  const result = runCapture(root);

  assertFailed(result);
  assert.match(result.error.message, /must be a regular file and not a symbolic link/);
  assert.equal(fs.lstatSync(symlinkTarget).isSymbolicLink(), true);
  assert.deepEqual(fs.readFileSync(referent), Buffer.from('{"referent":true}\n'));
  assertStateEqual(readState(root), before);
  assert.deepEqual(recoveryDirectories(root), []);
});

test('cleanup failure after successful publication reports cleanup as the primary error', (t) => {
  const root = createSandbox(t);
  const before = readState(root);
  const result = runCapture(root, { ATOMIC_CAPTURE_CLEANUP_FAIL: '1' });

  assertFailed(result);
  assert.equal(result.error.message, 'injected transaction cleanup failure');
  assert.equal(result.error.publicationError, null);
  assert.notDeepEqual(readState(root).get(targets[0]), before.get(targets[0]));
  assert.equal(fs.existsSync(path.join(root, targets[1])), true);
  assert.equal(recoveryDirectories(root).length, 1);
});
