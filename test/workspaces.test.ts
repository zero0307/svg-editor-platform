import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('workspace check rejects private paths, reverse dependencies, plugin coupling and missing references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svg-boundaries-'));
  const checker = resolve('scripts/check-workspaces.mjs');
  try {
    const dirs = ['packages/core', 'packages/host', 'plugins/one', 'plugins/two'];
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ workspaces: ['packages/*', 'plugins/*'] }),
    );
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({ references: dirs.map((path) => ({ path })) }),
    );
    for (const dir of dirs) {
      await mkdir(join(root, dir, 'src'), { recursive: true });
      const name = '@svgframe/' + dir.split('/')[1];
      await writeFile(
        join(root, dir, 'package.json'),
        JSON.stringify({
          name,
          exports: { '.': './dist/index.js' },
          devDependencies: dir === 'packages/core' ? {} : { '@svgframe/core': '0.1.0' },
        }),
      );
      await writeFile(join(root, dir, 'tsconfig.json'), '{}');
    }
    const run = () => spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
    await writeFile(
      join(root, 'plugins/one/src/index.ts'),
      "export type { X } from '@svgframe/core'",
    );
    assert.equal(run().status, 0);
    await writeFile(
      join(root, 'plugins/one/src/index.ts'),
      "export * from '@svgframe/core/src/private'; export { X } from '@svgframe/core'; import('@svgframe/two'); import '../../../packages/core/src/value';",
    );
    await writeFile(
      join(root, 'packages/core/src/index.ts'),
      "import '@svgframe/host'; import 'node:fs';",
    );
    await writeFile(join(root, 'tsconfig.json'), '{"references":[]}');
    const failure = run();
    assert.equal(failure.status, 1);
    for (const message of [
      'non-public package path',
      'undeclared package dependency (@svgframe/core)',
      'relative import escapes workspace',
      '(@svgframe/two)',
      '(@svgframe/host)',
      '(node:fs)',
      'missing a project reference',
    ])
      assert.ok(failure.stderr.includes(message), failure.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
