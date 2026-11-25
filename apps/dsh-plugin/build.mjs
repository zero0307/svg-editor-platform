import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bundles the compiled plugin into one self-contained ESM file for DSH.
 *
 * `@svgframe/core`, `@svgframe/svg-xml`, `@svgframe/builtins` and the XML DOM
 * are inlined so the plugin directory installs into a clean profile without
 * workspace links. Nothing is left external: DSH injects only `ctx`.
 */
const root = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(root, 'dist/src/index.js')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: path.join(root, 'dist/plugin.js'),
  legalComments: 'none',
  logLevel: 'info',
});
