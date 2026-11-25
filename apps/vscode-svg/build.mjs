import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bundles the compiled extension into a single ESM file for `main`/VSIX.
 *
 * `@svgframe/svg-xml` and its runtime dependencies are inlined so the VSIX works
 * in a clean profile without workspace links, while `vscode` stays external
 * because the Extension Host injects it.
 */
const root = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(root, 'dist/src/extension.js')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['vscode'],
  outfile: path.join(root, 'dist/extension.js'),
  legalComments: 'none',
  logLevel: 'info',
});
