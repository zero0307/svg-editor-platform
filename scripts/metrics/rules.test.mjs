import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSources } from './ast.mjs';
import { ClassificationError, Classifier, globToRegExp } from './classify.mjs';
import { countLines, measureSourceFile } from './rules.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..', '..');

async function measure(source) {
  const parsed = await parseSources(new Map([['sample.ts', Buffer.from(source)]]));
  try {
    return measureSourceFile(parsed.trees.get('sample.ts'), Buffer.from(source));
  } finally {
    await parsed.close();
  }
}

const increments = `
export function everything(flag: boolean, items: number[], value?: number): number {
  let total = 0;
  if (flag) total += 1;
  for (let index = 0; index < items.length; index++) total += items[index] ?? 0;
  for (const item of items) total += item;
  for (const key in items) total += Number(key);
  while (total > 100) total -= 1;
  do { total += 1; } while (total < 0);
  try { total += 1; } catch (error) { total -= 1; }
  total += flag ? 1 : 0;
  switch (value) {
    case 1:
      total += 1;
      break;
    case 2:
      total += 2;
      break;
    default:
      total += 3;
  }
  total += flag && items.length ? 1 : 0;
  total += flag || items.length ? 1 : 0;
  total += value ?? 0;
  return total;
}
`;

test('rules: every +1 construct counts exactly once', async () => {
  const metrics = await measure(increments);
  // base 1 + if + for + for-of + for-in + while + do + catch + 5 ternaries + 2 non-default cases
  // + && + || + two ?? operators = 17. The do/while tail is one DoStatement, not an extra loop.
  assert.equal(metrics.complexity.functions, 1);
  assert.equal(metrics.complexity.total, 17);
  assert.equal(metrics.complexity.max, 17);
});

test('rules: comments, strings, regular expressions and template text are not counted', async () => {
  const source = [
    '// if (a && b) { for (;;) {} }',
    '/* while (x) { try { } catch (e) { } } */',
    "const text = 'if (a && b) { return a ?? b; }';",
    'const template = `while (a || b) { case 1: }`;',
    'const pattern = /( if | for | && | \\?\\? )/gu;',
    'export function plain(): number {',
    '  return 1;',
    '}',
    '',
  ].join('\n');
  const metrics = await measure(source);
  assert.equal(metrics.complexity.functions, 1);
  assert.equal(metrics.complexity.total, 1);
});

test('rules: empty files, blank lines and trailing newline follow the documented line count', async () => {
  assert.equal(countLines(Buffer.alloc(0)), 0);
  assert.equal(countLines(Buffer.from('\n')), 1);
  assert.equal(countLines(Buffer.from('a')), 1);
  assert.equal(countLines(Buffer.from('a\n')), 1);
  assert.equal(countLines(Buffer.from('a\n\n')), 2);
  assert.equal(countLines(Buffer.from('a\r\nb')), 2);
  const empty = await measure('');
  assert.deepEqual(empty, { lines: 0, complexity: { total: 0, functions: 0, max: 0 } });
});

test('rules: nested units are measured separately and do not inflate the outer unit', async () => {
  const source = [
    'export function outer(flag: boolean): number {',
    '  const inner = (x: number) => {',
    '    if (x > 0) return 1;',
    '    if (x < 0) return -1;',
    '    return 0;',
    '  };',
    '  if (flag) return inner(1);',
    '  return 0;',
    '}',
    '',
  ].join('\n');
  const metrics = await measure(source);
  assert.equal(metrics.complexity.functions, 2);
  assert.equal(metrics.complexity.total, 5); // outer 2 + arrow 3
  assert.equal(metrics.complexity.max, 3);
});

test('rules: declarations and accessors are all units', async () => {
  const source = [
    'export class Sample {',
    '  private value = 0;',
    '  constructor(initial: number) { this.value = initial; }',
    '  get current(): number { return this.value; }',
    '  set current(next: number) { this.value = next; }',
    '  method(flag: boolean): number { return flag ? 1 : 0; }',
    '  readonly arrow = (flag: boolean): number => (flag ? 2 : 3);',
    '}',
    'export function standalone(): void {}',
    '',
  ].join('\n');
  const metrics = await measure(source);
  assert.equal(metrics.complexity.functions, 6);
  // constructor, getter, setter, method and standalone are 1 each; method and arrow add one
  // conditional each, so total is 1 + 1 + 1 + 2 + 2 + 1 = 8.
  assert.equal(metrics.complexity.total, 8);
});

test('classification: globs stay inside one segment except for **', () => {
  assert.equal(globToRegExp('packages/core/**').test('packages/core/domain/Shape.ts'), true);
  assert.equal(globToRegExp('**/*.d.ts').test('apps/dsh-plugin/index.d.ts'), true);
  assert.equal(globToRegExp('**/*.d.ts').test('index.d.ts'), true);
  assert.equal(globToRegExp('src/*/index.ts').test('src/domain/index.ts'), true);
  assert.equal(globToRegExp('src/*/index.ts').test('src/domain/deep/index.ts'), false);
  assert.equal(globToRegExp('plugins/**').test('plugins/command-stats/package.json'), true);
});

test('classification: excluded paths are skipped and every other path must match once', () => {
  const classifier = new Classifier(
    {
      version: 1,
      excludes: [{ match: 'test/**', reason: 'tests' }],
      rules: [
        { match: 'packages/core/**', category: 'kernel', responsibility: 'core' },
        { match: 'plugins/**', category: 'plugin', responsibility: 'plugins' },
      ],
    },
    'digest',
  );
  const { measured, excluded } = classifier.classifyAll([
    'packages/core/index.ts',
    'plugins/command-stats/index.ts',
    'test/harness.ts',
  ]);
  assert.deepEqual(
    [...measured.keys()],
    ['packages/core/index.ts', 'plugins/command-stats/index.ts'],
  );
  assert.equal(measured.get('plugins/command-stats/index.ts').category, 'plugin');
  assert.equal(excluded.get('test/**'), 1);
  assert.throws(
    () => classifier.classifyAll(['README.md']),
    (error) =>
      error instanceof ClassificationError &&
      /README\.md: no classification rule/.test(error.message),
  );
});

test('classification: duplicate rules and non-source files fail loudly', () => {
  const duplicated = new Classifier(
    {
      version: 1,
      excludes: [],
      rules: [
        { match: 'packages/**', category: 'kernel', responsibility: 'a' },
        { match: 'packages/core/**', category: 'kernel', responsibility: 'b' },
      ],
    },
    'digest',
  );
  assert.throws(() => duplicated.classifyAll(['packages/core/index.ts']), /matches 2 rules/);

  const nonSource = new Classifier(
    {
      version: 1,
      excludes: [],
      rules: [{ match: 'packages/core/**', category: 'kernel', responsibility: 'a' }],
    },
    'digest',
  );
  assert.throws(
    () => nonSource.classifyAll(['packages/core/logo.png']),
    /not a measured source file/,
  );
});

test('classification: the committed tree classifies without gaps or duplicates', async () => {
  const { loadClassification } = await import('./classify.mjs');
  const classifier = await loadClassification(path.join(scriptDirectory, 'classification.json'));
  const files = execFileSync('git', ['-C', root, 'ls-tree', '-r', '-z', '--name-only', 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  const { measured } = classifier.classifyAll(files);
  assert.ok(measured.size > 100, `expected the CLI source set, measured ${measured.size} files`);
  for (const [file, rule] of measured) {
    assert.ok(['.ts', '.tsx', '.js', '.mjs', '.cjs'].some((extension) => file.endsWith(extension)));
    assert.ok(
      ['kernel', 'assembly', 'plugin', 'vscode', 'dsh'].includes(rule.category),
      `${file}: ${rule.category}`,
    );
  }
});

test('metrics: the same revision and arguments produce byte-identical output', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'svg-metrics-out-'));
  try {
    const args = [
      path.join(scriptDirectory, 'metrics.mjs'),
      '--from',
      'final^{commit}',
      '--to',
      'HEAD',
      '--out',
      output,
    ];
    execFileSync(process.execPath, args, { cwd: root, stdio: 'ignore' });
    const jsonName = execFileSync('git', ['-C', root, 'rev-parse', '--short=7', 'final^{commit}'], {
      encoding: 'utf8',
    }).trim();
    const headName = execFileSync('git', ['-C', root, 'rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const jsonFile = path.join(output, `${jsonName}-to-${headName}.json`);
    const first = createHash('sha256')
      .update(await readFile(jsonFile))
      .digest('hex');
    execFileSync(process.execPath, args, { cwd: root, stdio: 'ignore' });
    const second = createHash('sha256')
      .update(await readFile(jsonFile))
      .digest('hex');
    assert.equal(first, second);
    const report = JSON.parse(await readFile(jsonFile, 'utf8'));
    assert.equal(report.inputs.to.commit.length, 40);
    assert.equal(report.rulesVersion, 1);
    assert.equal(report.measured.to.files.length > 0, true);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
