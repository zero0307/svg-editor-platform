import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..', '..');
const POSIX = (value) => value.split(path.sep).join('/');

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function git(args, { allowFailure = false } = {}) {
  try {
    return {
      ok: true,
      output: execFileSync('git', ['-C', repoRoot, ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
  } catch (error) {
    if (!allowFailure) throw error;
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function commitOf(ref) {
  const result = git(['rev-parse', `--verify`, `${ref}^{commit}`]);
  if (!result.ok) throw new Error(`cannot resolve ${ref}`);
  return result.output.trim();
}

function short(sha) {
  return sha.slice(0, 7);
}

const argv = process.argv.slice(2);
const frameworkRef = option(argv, '--framework', 'a21f758');
const codeRef = option(argv, '--code', 'evidence/box-code');
const configRef = option(argv, '--config', 'evidence/box-config');
const integrationRef = option(argv, '--integration', 'd2b5e23');
const outDirectory = path.resolve(repoRoot, option(argv, '--out', 'doc/evidence/assembly'));

const framework = commitOf(frameworkRef);
const code = commitOf(codeRef);
const config = commitOf(configRef);
const integration = commitOf(integrationRef);
const codeParent = commitOf(`${code}^`);
const configParent = commitOf(`${config}^`);
if (codeParent !== framework) throw new Error(`C_A parent ${codeParent} is not F ${framework}`);
if (configParent !== framework) throw new Error(`C_B parent ${configParent} is not F ${framework}`);
await mkdir(outDirectory, { recursive: true });

const sha = {
  generatedBy: `node scripts/assembly/diff-evidence.mjs --framework ${frameworkRef} --code ${codeRef} --config ${configRef} --integration ${integrationRef}`,
  framework: { ref: frameworkRef, commit: framework, short: short(framework) },
  code: { ref: codeRef, commit: code, short: short(code), parent: codeParent },
  config: { ref: configRef, commit: config, short: short(config), parent: configParent },
  integration: { ref: integrationRef, commit: integration, short: short(integration) },
  entry: 'apps/cli/dist/main.js',
  tags: { created: [] },
};

function diffText(title, args) {
  return [`# ${title}`, `# $ git ${args.join(' ')}`, git(args).output, ''].join('\n');
}

function nameStatus(from, to) {
  return git(['diff', '--name-status', from, to]).output.trimEnd();
}

await writeFile(path.join(outDirectory, 'sha.json'), `${JSON.stringify(sha, null, 2)}\n`);
await writeFile(
  path.join(outDirectory, 'diff-C_A.txt'),
  [
    `# C_A: ${codeRef} (${code}) parent F ${framework}`,
    diffText(`git diff --name-status ${short(framework)} ${short(code)}`, [
      'diff',
      '--name-status',
      framework,
      code,
    ]),
    diffText(`git diff ${short(framework)} ${short(code)}`, ['diff', framework, code]),
  ].join('\n'),
);
await writeFile(
  path.join(outDirectory, 'diff-C_B.txt'),
  [
    `# C_B: ${configRef} (${config}) parent F ${framework}`,
    diffText(`git diff --name-status ${short(framework)} ${short(config)}`, [
      'diff',
      '--name-status',
      framework,
      config,
    ]),
    diffText(`git diff ${short(framework)} ${short(config)}`, ['diff', framework, config]),
  ].join('\n'),
);

const protectedPaths = [
  { path: 'packages/core', label: 'kernel' },
  { path: 'packages/host', label: 'loader/host' },
  { path: 'packages/svg-xml', label: 'xml adapter' },
  { path: 'packages/builtins', label: 'default capability (existing provider/command set)' },
];
const requiredPaths = [
  ...protectedPaths,
  { path: 'apps/cli/src/main.ts', label: 'A composition root' },
  { path: 'plugins.config.json', label: 'B configuration' },
];
const allowedCode = new Set([
  'apps/cli/src/main.ts',
  'apps/cli/package.json',
  'package-lock.json',
  'tsconfig.build.json',
]);
const allowedConfig = new Set(['plugins.config.json', 'package-lock.json', 'tsconfig.build.json']);

function filesOf(commit) {
  return git(['ls-tree', '-r', '-z', '--name-only', commit]).output.split('\0').filter(Boolean);
}

function checkZeroChange(commit, allowed, label) {
  const changed = nameStatus(`${commit}^`, commit)
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t').at(-1));
  const pluginChanges = changed.filter((file) => file.startsWith('plugins/shape-box/'));
  const unexpected = changed.filter(
    (file) => !file.startsWith('plugins/shape-box/') && !allowed.has(file),
  );
  const lines = [];
  lines.push(`## ${label}: git diff --name-status ${short(commit)}^ ${short(commit)}`);
  lines.push(nameStatus(`${commit}^`, commit) || '(empty)');
  lines.push('');
  lines.push(`new plugin files: ${pluginChanges.length} under plugins/shape-box/`);
  lines.push(
    `non-plugin changes: ${
      [...new Set(changed.filter((file) => !file.startsWith('plugins/shape-box/')))]
        .map((file) => `${file} (${allowed.has(file) ? 'allowed' : 'UNEXPECTED'})`)
        .join(', ') || '(none)'
    }`,
  );
  lines.push(`unexpected changes: ${unexpected.length === 0 ? 'none' : unexpected.join(', ')}`);
  return { lines, ok: unexpected.length === 0 };
}

const checkLines = [];
let failed = false;
const verdict = (ok, text) => {
  checkLines.push(`${ok ? 'PASS' : 'FAIL'} ${text}`);
  if (!ok) failed = true;
};

checkLines.push('# 零改动检查（TASK-QA-02 / Issue #21）');
checkLines.push(`# F=${framework}  C_A=${code}  C_B=${config}  I=${integration}`);
checkLines.push('');

checkLines.push('## 1. 受保护路径存在性（git cat-file -e <commit>:<path>）');
for (const entry of requiredPaths) {
  const result = git(['cat-file', '-e', `${code}:${entry.path}`], { allowFailure: true });
  const object = result.ok
    ? git(['rev-parse', `${code}:${entry.path}`]).output.trim()
    : '(missing)';
  checkLines.push(
    `${result.ok ? 'exists' : 'MISSING'} ${entry.path} (${entry.label}) object=${object}`,
  );
  verdict(result.ok, `${entry.path} exists at C_A for ${entry.label}`);
}
const pluginsAtFramework = git(['cat-file', '-e', `${framework}:plugins`], { allowFailure: true });
checkLines.push(
  `${pluginsAtFramework.ok ? 'exists' : 'absent'} plugins/ at F (${short(framework)}): F 是框架冻结提交，尚无正式业务插件包`,
);
checkLines.push('');

checkLines.push('## 2. 内核/loader/既有能力零改动');
for (const commit of [code, config]) {
  const diff = git([
    'diff',
    '--name-status',
    `${commit}^`,
    commit,
    '--',
    'packages',
    ':(exclude)plugins/shape-box',
  ]).output.trimEnd();
  checkLines.push(
    `$ git diff --name-status ${short(commit)}^ ${short(commit)} -- packages ':(exclude)plugins/shape-box'`,
  );
  checkLines.push(diff || '(empty)');
  verdict(diff === '', `${short(commit)}: packages/* 零改动（内核、loader、既有默认能力）`);
  const otherPlugins = git([
    'diff',
    '--name-status',
    `${commit}^`,
    commit,
    '--',
    'plugins',
    ':(exclude)plugins/shape-box',
  ]).output.trimEnd();
  checkLines.push(
    `$ git diff --name-status ${short(commit)}^ ${short(commit)} -- plugins ':(exclude)plugins/shape-box'`,
  );
  checkLines.push(otherPlugins || '(empty)');
  verdict(
    otherPlugins === '',
    `${short(commit)}: 既有插件零改动（F 无既有插件，路径缺失时以本条为准）`,
  );
  checkLines.push('');
}

checkLines.push('## 3. 运行源码与元数据白名单');
const codeCheck = checkZeroChange(code, allowedCode, 'C_A');
checkLines.push(...codeCheck.lines, '');
verdict(codeCheck.ok, 'C_A 只含新插件 + 一个组合根 + 已声明元数据');
const configCheck = checkZeroChange(config, allowedConfig, 'C_B');
checkLines.push(...configCheck.lines, '');
verdict(configCheck.ok, 'C_B 只含新插件 + 配置文件 + 已声明元数据');
const cliDiff = git([
  'diff',
  '--name-status',
  `${config}^`,
  config,
  '--',
  'apps/cli',
]).output.trimEnd();
checkLines.push('$ git diff --name-status C_B^ C_B -- apps/cli');
checkLines.push(cliDiff || '(empty)');
verdict(cliDiff === '', 'C_B: apps/cli 运行源码零改动');
checkLines.push('');
checkLines.push('## 汇总');
checkLines.push(failed ? 'FAIL 零改动检查未通过' : 'PASS 所有零改动与白名单检查通过');
checkLines.push('');
checkLines.push(
  '说明：C_A 只允许修改一个顶层组合根 apps/cli/src/main.ts；apps/cli/package.json、tsconfig.build.json、package-lock.json 是新增 workspace 所需的元数据变化。',
);
checkLines.push(
  '说明：F 上 plugins/ 不存在，因此“既有插件零改动”以 packages/builtins 与 plugins 路径不存在的事实为准，不伪造空 diff。',
);
await writeFile(path.join(outDirectory, 'zero-change-check.txt'), `${checkLines.join('\n')}\n`);

console.log(
  `sha.json, diff-C_A.txt, diff-C_B.txt, zero-change-check.txt written to ${POSIX(path.relative(repoRoot, outDirectory))}`,
);
console.log(failed ? 'zero-change check FAILED' : 'zero-change check passed');
if (failed) process.exitCode = 1;
