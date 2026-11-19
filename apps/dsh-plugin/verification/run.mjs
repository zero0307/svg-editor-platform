import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const {
  values: { evidence },
} = parseArgs({ options: { evidence: { type: 'string' } } });
const cli = process.env.DSH_CLI;
const npm = process.env.npm_execpath;
if (!cli || !npm)
  throw new Error('Set DSH_CLI to the installed dsh/lib/bin.js and run npm run verify:dsh.');
const temp = mkdtempSync(path.join(tmpdir(), 'dsh-svg-check-'));
const cwd = path.join(temp, 'workspace');
const env = {
  ...process.env,
  DSH_HOME: path.join(temp, 'home'),
  XDG_CONFIG_HOME: path.join(temp, 'config'),
  XDG_DATA_HOME: path.join(temp, 'data'),
  XDG_STATE_HOME: path.join(temp, 'state'),
  XDG_CACHE_HOME: path.join(temp, 'cache'),
  npm_config_store_dir: path.join(temp, 'store'),
};
delete env.DEEPSEEK_API_KEY;
const profile = 'svg-acceptance';
function run(entry, args, dir = cwd) {
  return execFileSync(process.execPath, [entry, ...args], {
    cwd: dir,
    env,
    timeout: 90000,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
try {
  mkdirSync(cwd);
  const version = run(cli, ['--version']).trim();
  assert.equal(version, '0.2.2-rc.5');
  run(npm, ['pack', '--silent', '--workspace', 'dsh-svg-editor', '--pack-destination', temp], root);
  run(cli, ['--profile', profile, '--from-default-profile', 'sdk-minimal', '--dump-config']);
  run(cli, ['plugin', '--profile', profile, 'add', path.join(temp, 'dsh-svg-editor-0.1.0.tgz')]);
  const profileDir = path.join(env.DSH_HOME, 'profiles', profile);
  const installed = path.join(profileDir, 'node_modules', 'dsh-svg-editor');
  assert.ok(realpathSync(installed).startsWith(realpathSync(temp) + path.sep));
  const driver = path.join(temp, 'probe.mjs');
  copyFileSync(path.join(import.meta.dirname, 'probe.mjs'), driver);
  const patch = path.join(temp, 'acceptance.yml');
  writeFileSync(
    patch,
    JSON.stringify([
      { id: 'sdk-jsonrpc-server', disabled: true },
      { insert: [{ id: 'svg-acceptance-driver', name: driver }] },
    ]),
  );
  function boot(mode) {
    env.SVG_CHECK_MODE = mode;
    const out = run(cli, ['--profile', profile, '--patch', patch]);
    const marker = out.split(/\r?\n/).find((s) => s.startsWith('SVG_ACCEPTANCE '));
    assert.ok(marker, 'Acceptance driver did not run');
    return JSON.parse(marker.slice('SVG_ACCEPTANCE '.length));
  }
  const result = boot('installed');
  run(cli, ['plugin', '--profile', profile, 'remove', 'dsh-svg-editor']);
  assert.ok(
    !JSON.parse(readFileSync(path.join(profileDir, 'package.json'))).dsh.profile.bundles.includes(
      'dsh-svg-editor',
    ),
  );
  assert.ok(!existsSync(installed));
  const removed = boot('removed');
  const tarball = readFileSync(path.join(temp, 'dsh-svg-editor-0.1.0.tgz'));
  const report =
    JSON.stringify(
      {
        dsh: version,
        node: process.version,
        platform: process.platform,
        profile: 'sdk-minimal',
        packageSha256: createHash('sha256').update(tarball).digest('hex'),
        ...result,
        ...removed,
      },
      null,
      2,
    ) + '\n';
  if (evidence) {
    mkdirSync(evidence); // Preserve earlier evidence by requiring a new output directory.
    writeFileSync(path.join(evidence, 'verification.json'), report);
    copyFileSync(path.join(cwd, result.created.path), path.join(evidence, 'flowchart.svg'));
  }
  process.stdout.write(report);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
