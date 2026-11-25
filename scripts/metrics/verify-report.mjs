import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function option(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const argv = process.argv.slice(2);
const reportPath = option(argv, '--report');
const candidatePath = option(argv, '--candidate');
if (!reportPath || !candidatePath) {
  console.error(
    'usage: node scripts/metrics/verify-report.mjs --report <committed.json> --candidate <rerun.json>',
  );
  process.exit(2);
}

const report = JSON.parse(await readFile(path.resolve(reportPath), 'utf8'));
const candidate = JSON.parse(await readFile(path.resolve(candidatePath), 'utf8'));
// Compare only measured source data: everything else (tracked-file counts, exclusion counts,
// command, target commit) legitimately changes when the report/evidence commit is added.
const core = (value) => ({
  rulesVersion: value.rulesVersion,
  classification: value.classification.digest,
  from: { files: value.measured.from.files, summary: value.measured.from.summary },
  to: { files: value.measured.to.files, summary: value.measured.to.summary },
});

const sourceDigest = (value) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        value.measured.to.files.map((file) => [file.path, file.lines, file.complexity]),
      ),
    )
    .digest('hex');

const sameSources =
  JSON.stringify(report.measured.to.files) === JSON.stringify(candidate.measured.to.files);
const sameFrom =
  JSON.stringify(report.measured.from.files) === JSON.stringify(candidate.measured.from.files);
const sameSummary =
  JSON.stringify(report.measured.to.summary) === JSON.stringify(candidate.measured.to.summary);
const sameRules = report.rulesVersion === candidate.rulesVersion;
const sameClassification = report.classification.digest === candidate.classification.digest;
const sameNumbers = JSON.stringify(core(report)) === JSON.stringify(core(candidate));

const lines = [
  'metrics report recheck',
  `report file: ${reportPath}`,
  `candidate file: ${candidatePath}`,
  `measured commit (report):    ${report.inputs.to.commit}`,
  `measured commit (candidate):  ${candidate.inputs.to.commit}`,
  `rules version: ${report.rulesVersion} / ${candidate.rulesVersion}`,
  `classification sha256: ${report.classification.digest.slice(0, 16)} / ${candidate.classification.digest.slice(0, 16)}`,
  `target source digest: ${sourceDigest(report)}`,
  `candidate source digest: ${sourceDigest(candidate)}`,
  `same target source files: ${sameSources}`,
  `same baseline source files: ${sameFrom}`,
  `same target summary: ${sameSummary}`,
  `same rules version: ${sameRules}`,
  `same classification: ${sameClassification}`,
  `same measured source data: ${sameNumbers}`,
  '',
  'expected differences: inputs.to.commit and command only (the report commit sits on top of the measured candidate and changes docs/metrics plus scripts/metrics).',
];
const ok = sameSources && sameFrom && sameSummary && sameRules && sameClassification && sameNumbers;
lines.push(
  ok
    ? 'PASS measured CLI sources are identical between the report and the candidate commit'
    : 'FAIL measured CLI sources or metrics differ',
);
console.log(lines.join('\n'));
if (!ok) process.exitCode = 1;
