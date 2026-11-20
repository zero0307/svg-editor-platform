import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
  values: { evidence, input, demo, theme },
} = parseArgs({
  options: {
    evidence: { type: 'string' },
    input: { type: 'string' },
    demo: { type: 'boolean' },
    theme: { type: 'string', default: 'studio' },
  },
});
assert.ok(['studio', 'print'].includes(theme), 'Choose --theme studio or print');
const npm = process.env.npm_execpath;
// Locate the official npm/pnpm install behind a PATH entry, including Windows shims.
function findCli() {
  if (process.env.DSH_CLI) return path.resolve(process.env.DSH_CLI);
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const executable = path.join(dir, process.platform === 'win32' ? 'dsh.cmd' : 'dsh');
    if (!existsSync(executable)) continue;
    const entry = realpathSync(executable);
    if (path.basename(entry) === 'bin.js') return entry;
    for (const modules of [path.resolve(dir, '..'), path.join(dir, 'node_modules')]) {
      const candidate = path.join(modules, '@deepseek-ai/dsh/lib/bin.js');
      if (existsSync(candidate)) return candidate;
    }
  }
}
const cli = findCli();
if (!cli || !npm)
  throw new Error(
    'Install the pinned DSH and pnpm from doc/dsh.md or set DSH_CLI to dsh/lib/bin.js. Start the demo using npm.',
  );
const temp = mkdtempSync(path.join(tmpdir(), 'dsh-svg-check-'));
const cwd = path.join(temp, 'workspace');
const env = {
  ...process.env,
  SVG_DEMO_THEME: theme,
  SVG_DEMO_INPUT: input
    ? path.resolve(input)
    : path.resolve(import.meta.dirname, '../demo/review.json'),
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
  copyFileSync(
    path.join(root, 'doc/evidence/dsh/desktop/桌面验收.svg'),
    path.join(cwd, 'legacy.svg'),
  );
  copyFileSync(
    path.join(root, 'doc/evidence/dsh/directed/shortcut.svg'),
    path.join(cwd, 'directed.svg'),
  );
  const version = run(cli, ['--version']).trim();
  assert.equal(version, '0.2.2-rc.5');
  run(npm, ['pack', '--silent', '--workspace', 'dsh-svg-editor', '--pack-destination', temp], root);
  run(cli, ['--profile', profile, '--from-default-profile', 'sdk-minimal', '--dump-config']);
  const archives = readdirSync(temp).filter((name) => name.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  const archive = path.join(temp, archives[0]);
  run(cli, ['plugin', '--profile', profile, 'add', archive]);
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
  const tarball = readFileSync(archive);
  const report =
    JSON.stringify(
      {
        pluginPackage: archives[0],
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
  let destination;
  if (evidence) {
    destination = path.resolve(evidence);
    mkdirSync(destination); // Preserve existing evidence.
  } else if (demo) {
    const artifacts = path.join(root, 'artifacts');
    mkdirSync(artifacts, { recursive: true });
    destination = mkdtempSync(path.join(artifacts, 'dsh-demo-'));
  }
  if (destination) {
    writeFileSync(path.join(destination, 'verification.json'), report);
    copyFileSync(
      path.join(cwd, result.demo.directory, result.demo.created.path),
      path.join(destination, 'demo.svg'),
    );
    if (demo) copyFileSync(archive, path.join(destination, archives[0]));
    else copyFileSync(path.join(cwd, result.created.path), path.join(destination, 'flowchart.svg'));
  }
  if (demo) {
    const { nodes, edges } = result.demo.created;
    console.log(`DSH ${version}: svg_layout_flowchart → svg_create_flowchart → svg_inspect`);
    console.log(`${nodes} nodes, ${edges} edges. Install, read-back and uninstall verified.`);
    console.log(`SVG: ${path.join(destination, 'demo.svg')}
Report and installable package: ${destination}`);
  } else process.stdout.write(report);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
