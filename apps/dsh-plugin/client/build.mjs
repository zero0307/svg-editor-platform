import { build } from 'esbuild';
import { createRequire } from 'node:module';
const local = createRequire(import.meta.url);
await build({
  entryPoints: ['client/preview.jsx'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  minify: true,
  loader: { '.css': 'text' },
  plugins: [
    {
      name: 'shared-svg-codec',
      setup(build) {
        build.onResolve({ filter: /^\.\/(xml|session)\.cjs$/ }, ({ path }) => ({
          path:
            path === './xml.cjs'
              ? local.resolve('@xmldom/xmldom')
              : local.resolve('../../../src/bootstrap/Phase1EditorSession.ts'),
        }));
      },
    },
  ],
  format: 'cjs',
  external: ['react'],
  banner: {
    js: "window.__ModuleLoader__.load({id:'dsh-svg-editor',factory:require=>{var module={exports:{}};var exports=module.exports;",
  },
  footer: { js: 'return module.exports;}});' },
});
