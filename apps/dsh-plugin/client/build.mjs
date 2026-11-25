import { build } from 'esbuild';
await build({
  entryPoints: ['client/preview.jsx'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  external: ['react'],
  banner: {
    js: "window.__ModuleLoader__.load({id:'dsh-svg-editor',factory:require=>{var module={exports:{}};var exports=module.exports;",
  },
  footer: { js: 'return module.exports;}});' },
});
