import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Optional browser acceptance: supply a Chromium executable and a node_modules
// directory containing React and React DOM. The shipped client itself externalizes React.
const [chrome, modules] = process.argv.slice(2);
assert.ok(
  chrome && modules,
  'Expected: node edge-picker-browser.mjs <chromium executable> <React node_modules>',
);
const temp = await mkdtemp(path.join(tmpdir(), 'dsh-edge-picker-'));
try {
  await build({
    entryPoints: [path.join(import.meta.dirname, 'edge-picker-browser.jsx')],
    outfile: path.join(temp, 'check.js'),
    bundle: true,
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: {
      react: path.resolve(modules, 'react'),
      'react-dom': path.resolve(modules, 'react-dom'),
    },
    loader: { '.svg': 'text' },
  });
  const html = path.join(temp, 'check.html');
  await writeFile(
    html,
    '<!doctype html><meta charset=utf-8><div id="root"></div><script src="./check.js"></script>',
  );
  const dom = execFileSync(
    chrome,
    [
      '--headless',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--user-data-dir=' + path.join(temp, 'profile'),
      '--window-size=1200,900',
      '--virtual-time-budget=12000',
      '--dump-dom',
      pathToFileURL(html).href,
    ],
    { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const report = dom.match(/<pre id="report">([^<]+)<\/pre>/)?.[1];
  assert.ok(report, 'Browser returned no acceptance report');
  const checks = JSON.parse(report);
  console.log(JSON.stringify(checks, null, 2));
  assert.equal(Object.keys(checks).length, 27, 'Browser did not reach all checks');
  assert.ok(
    Object.values(checks).every((check) => check.pass),
    'Browser selection failed',
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
