#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitRepository } from './git.mjs';
import { CATEGORY_NAMES, loadClassification, summarizeExclusions } from './classify.mjs';
import { parseSources } from './ast.mjs';
import { RULES_SUMMARY, RULES_VERSION, measureSourceFile } from './rules.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '..', '..');
const POSIX = (value) => value.split(path.sep).join('/');

function readOption(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function usage() {
  return [
    'usage: node scripts/metrics/metrics.mjs [--from <rev>] [--to <rev>] [--out <dir>] [--root <dir>]',
    '  --from  baseline revision, default final^{commit}',
    '  --to    target revision, default integration/phase2',
    '  --out   output directory, default docs/metrics',
  ].join('\n');
}

function emptyBucket() {
  return { files: 0, lines: 0, complexity: { total: 0, functions: 0, max: 0 } };
}

function addToBucket(bucket, entry) {
  bucket.files += 1;
  bucket.lines += entry.lines;
  bucket.complexity.total += entry.complexity.total;
  bucket.complexity.functions += entry.complexity.functions;
  bucket.complexity.max = Math.max(bucket.complexity.max, entry.complexity.max);
}

function aggregate(entries) {
  const byCategory = {};
  for (const category of CATEGORY_NAMES) byCategory[category] = emptyBucket();
  const totals = emptyBucket();
  for (const entry of entries) {
    addToBucket(byCategory[entry.category], entry);
    addToBucket(totals, entry);
  }
  return { totals, byCategory };
}

function minus(after, before) {
  return {
    files: after.files - before.files,
    lines: after.lines - before.lines,
    complexity: {
      total: after.complexity.total - before.complexity.total,
      functions: after.complexity.functions - before.complexity.functions,
      max: after.complexity.max - before.complexity.max,
    },
  };
}

function deltaOf(fromAggregate, toAggregate) {
  const byCategory = {};
  for (const category of CATEGORY_NAMES) {
    byCategory[category] = minus(
      toAggregate.byCategory[category],
      fromAggregate.byCategory[category],
    );
  }
  return { totals: minus(toAggregate.totals, fromAggregate.totals), byCategory };
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  return { text, value: JSON.parse(text), digest: createHash('sha256').update(text).digest('hex') };
}

async function measure(repo, commit, classifier) {
  const files = repo.filesAt(commit);
  const { measured, excluded } = classifier.classifyAll(files);
  const sources = new Map();
  for (const file of measured.keys()) sources.set(file, repo.blobAt(commit, file));
  const parsed = await parseSources(sources);
  try {
    const entries = [];
    for (const [file, rule] of measured) {
      const metrics = measureSourceFile(parsed.trees.get(file), sources.get(file));
      entries.push({
        path: file,
        category: rule.category,
        responsibility: rule.responsibility,
        lines: metrics.lines,
        complexity: metrics.complexity,
      });
    }
    entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    return {
      commit,
      trackedFiles: files.length,
      measuredFiles: entries.length,
      files: entries,
      summary: aggregate(entries),
      exclusions: summarizeExclusions(excluded),
    };
  } finally {
    await parsed.close();
  }
}

function migrationPresence(prefix, files, kind) {
  if (kind === 'directory')
    return files.some((file) => file === prefix || file.startsWith(`${prefix}/`));
  return files.includes(prefix);
}

function describeMigration(migration, fromFiles, toFiles) {
  const ordered = [...migration.entries].sort((left, right) => (left.from < right.from ? -1 : 1));
  return ordered.map((entry) => {
    const presentAtFrom = migrationPresence(entry.from, fromFiles, entry.kind);
    const presentAtTo = migrationPresence(entry.to, toFiles, entry.kind);
    const status =
      presentAtFrom && presentAtTo
        ? 'both'
        : presentAtFrom
          ? 'pending'
          : presentAtTo
            ? 'moved'
            : 'neither';
    return {
      from: entry.from,
      to: entry.to,
      kind: entry.kind,
      fromCategory: entry.fromCategory,
      toCategory: entry.toCategory,
      note: entry.note,
      presentAtFrom,
      presentAtTo,
      status,
    };
  });
}

function formatNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}

function summaryMarkdown(report, migration, outLabel) {
  const { inputs, measured, delta, tool, classification } = report;
  const lines = [];
  lines.push(`# CLI 指标：${inputs.from.rev} → ${inputs.to.rev}`);
  lines.push('');
  lines.push(
    '本文件由 `scripts/metrics/metrics.mjs` 从 Git 历史生成，不接受手改；同一输入 SHA 与工具版本生成相同字节。',
  );
  lines.push('');
  lines.push('| 输入 | 值 |');
  lines.push('| --- | --- |');
  lines.push(`| 基线 rev | \`${inputs.from.rev}\` |`);
  lines.push(`| 基线标签对象 | \`${inputs.from.tagObject ?? '—'}\` |`);
  lines.push(`| 基线提交 | \`${inputs.from.commit}\` |`);
  lines.push(`| 目标 rev | \`${inputs.to.rev}\` |`);
  lines.push(`| 目标提交 | \`${inputs.to.commit}\` |`);
  lines.push(`| 规则版本 | ${report.rulesVersion} |`);
  lines.push(`| 解析器 | \`${tool.parser}\`（TypeScript ${tool.typescript}，Node ${tool.node}） |`);
  lines.push(
    `| 分类表 | \`${classification.file}\`（sha256 ${classification.digest.slice(0, 12)}） |`,
  );
  lines.push(`| 生成命令 | \`${report.command}\` |`);
  lines.push('');
  lines.push('## 三类 CLI 指标');
  lines.push('');
  lines.push(
    '| 分类 | 文件(旧) | 文件(新) | 文件增量 | 行数(旧) | 行数(新) | 行数增量 | 复杂度(旧) | 复杂度(新) | 复杂度增量 | 函数数(新) | 最大单元(新) |',
  );
  lines.push(
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  const row = (name, before, after, change) =>
    `| ${name} | ${before.files} | ${after.files} | ${formatNumber(change.files)} | ${before.lines} | ${after.lines} | ${formatNumber(change.lines)} | ${before.complexity.total} | ${after.complexity.total} | ${formatNumber(change.complexity.total)} | ${after.complexity.functions} | ${after.complexity.max} |`;
  for (const category of CATEGORY_NAMES) {
    lines.push(
      row(
        category,
        measured.from.summary.byCategory[category],
        measured.to.summary.byCategory[category],
        delta.byCategory[category],
      ),
    );
  }
  lines.push(
    row('CLI 合计', measured.from.summary.totals, measured.to.summary.totals, delta.totals),
  );
  lines.push('');
  lines.push(
    `范围：${measured.from.measuredFiles} → ${measured.to.measuredFiles} 个源文件（各提交跟踪 ${measured.from.trackedFiles} → ${measured.to.trackedFiles} 个文件）。VSCode 与 DSH 单列，不计入 CLI 合计。`,
  );
  lines.push('');
  lines.push('## 目标提交中复杂度最高的文件（前 10）');
  lines.push('');
  lines.push('| 文件 | 分类 | 行数 | 复杂度 | 函数数 | 最大 |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
  const top = [...measured.to.files]
    .sort(
      (left, right) =>
        right.complexity.total - left.complexity.total ||
        (left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    )
    .slice(0, 10);
  for (const entry of top) {
    lines.push(
      `| \`${entry.path}\` | ${entry.category} | ${entry.lines} | ${entry.complexity.total} | ${entry.complexity.functions} | ${entry.complexity.max} |`,
    );
  }
  lines.push('');
  lines.push('## 迁移表（旧路径 → 新路径）');
  lines.push('');
  lines.push('| 旧路径 | 新路径 | 分类变化 | from 存在 | to 存在 | 状态 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const entry of migration) {
    lines.push(
      `| \`${entry.from}\` | \`${entry.to}\` | ${entry.fromCategory} → ${entry.toCategory} | ${entry.presentAtFrom} | ${entry.presentAtTo} | ${entry.status} |`,
    );
  }
  lines.push('');
  lines.push('搬目录不算消除复杂度：迁移期间旧路径与新路径同时存在时，两类都会计入指标。');
  lines.push('');
  lines.push('## 排除项');
  lines.push('');
  lines.push('| 模式 | 文件数(旧) | 文件数(新) |');
  lines.push('| --- | ---: | ---: |');
  const patterns = report.classification.excludePatterns;
  const fromCounts = new Map(measured.from.exclusions.map((entry) => [entry.match, entry.count]));
  const toCounts = new Map(measured.to.exclusions.map((entry) => [entry.match, entry.count]));
  for (const pattern of patterns) {
    const fromCount = fromCounts.get(pattern.match) ?? 0;
    const toCount = toCounts.get(pattern.match) ?? 0;
    if (fromCount === 0 && toCount === 0) continue;
    lines.push(`| \`${pattern.match}\` | ${fromCount} | ${toCount} |`);
  }
  lines.push('');
  lines.push('规则口径：');
  lines.push('');
  for (const rule of RULES_SUMMARY) lines.push(`- ${rule}`);
  lines.push('');
  lines.push(`产物：\`${outLabel}\`；逐文件指标见同名 JSON。`);
  lines.push('');
  return `${lines.join('\n')}`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }
  const root = path.resolve(readOption(argv, '--root', defaultRoot));
  const fromRev = readOption(argv, '--from', 'final^{commit}');
  const toRev = readOption(argv, '--to', 'integration/phase2');
  const outDirectory = path.resolve(root, readOption(argv, '--out', 'docs/metrics'));
  const repo = new GitRepository(root);

  const fromCommit = repo.commitOf(fromRev);
  const fromRef = repo.refOf(fromRev);
  const toCommit = repo.commitOf(toRev);
  const toRef = repo.refOf(toRev);

  const classifier = await loadClassification(path.join(scriptDirectory, 'classification.json'));
  const migrationFile = await readJson(path.join(scriptDirectory, 'migration.json'));
  const typescriptVersion = (
    await readJson(path.join(root, 'node_modules', 'typescript', 'package.json'))
  ).value.version;

  const from = await measure(repo, fromCommit, classifier);
  const to = await measure(repo, toCommit, classifier);
  const migration = describeMigration(
    migrationFile.value,
    repo.filesAt(fromCommit),
    repo.filesAt(toCommit),
  );
  const outLabel = POSIX(path.relative(root, outDirectory)) || '.';
  const command = `node scripts/metrics/metrics.mjs --from ${fromRev} --to ${toRev} --out ${outLabel}`;

  const report = {
    rulesVersion: RULES_VERSION,
    rules: RULES_SUMMARY,
    tool: {
      script: 'scripts/metrics/metrics.mjs',
      parser: 'typescript/unstable/sync (syntax-only AST)',
      typescript: typescriptVersion,
      node: process.version,
    },
    inputs: {
      from: {
        rev: fromRev,
        ref: fromRef,
        tagObject: fromRef === fromCommit ? null : fromRef,
        commit: fromCommit,
      },
      to: {
        rev: toRev,
        ref: toRef,
        tagObject: toRef === toCommit ? null : toRef,
        commit: toCommit,
      },
    },
    command,
    classification: {
      file: 'scripts/metrics/classification.json',
      version: classifier.version,
      digest: classifier.digest,
      excludePatterns: classifier.excludePatterns,
    },
    migration: {
      file: 'scripts/metrics/migration.json',
      digest: migrationFile.digest,
      entries: migration,
    },
    measured: {
      from: {
        commit: fromCommit,
        trackedFiles: from.trackedFiles,
        measuredFiles: from.measuredFiles,
        summary: from.summary,
        exclusions: from.exclusions,
        files: from.files,
      },
      to: {
        commit: toCommit,
        trackedFiles: to.trackedFiles,
        measuredFiles: to.measuredFiles,
        summary: to.summary,
        exclusions: to.exclusions,
        files: to.files,
      },
    },
    delta: deltaOf(from.summary, to.summary),
  };

  await mkdir(outDirectory, { recursive: true });
  const jsonName = `${fromCommit.slice(0, 7)}-to-${toCommit.slice(0, 7)}.json`;
  const jsonPath = path.join(outDirectory, jsonName);
  const jsonText = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(jsonPath, jsonText);
  const markdown = summaryMarkdown(report, migration, `${outLabel}/${jsonName}`);
  await writeFile(path.join(outDirectory, 'summary.md'), markdown);

  const cli = report.measured.to.summary.byCategory;
  const cliFrom = report.measured.from.summary.byCategory;
  const cliDelta = report.delta.byCategory;
  const line = (category) =>
    `${category} files ${cliFrom[category].files}->${cli[category].files}, lines ${cliFrom[category].lines}->${cli[category].lines} (${formatNumber(cliDelta[category].lines)}), complexity ${cliFrom[category].complexity.total}->${cli[category].complexity.total} (${formatNumber(cliDelta[category].complexity.total)})`;
  console.log(
    `measured ${fromRev} (${fromCommit.slice(0, 7)}) -> ${toRev} (${toCommit.slice(0, 7)}) with rules v${RULES_VERSION}, TypeScript ${typescriptVersion}`,
  );
  for (const category of ['kernel', 'assembly', 'plugin']) console.log(`  ${line(category)}`);
  console.log(
    `  vscode files ${cliFrom.vscode.files}->${cli['vscode'].files}; dsh files ${cliFrom.dsh.files}->${cli.dsh.files} (separate, not in CLI totals)`,
  );
  console.log(
    `wrote ${POSIX(path.relative(root, jsonPath))} and ${POSIX(path.relative(root, path.join(outDirectory, 'summary.md')))}`,
  );
}

await main();
