import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { parsers } from 'prettier/plugins/typescript';

const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const packages = new Map();
const failures = [];
const references = new Set(
  json('tsconfig.json').references.map(({ path: dir }) => path.resolve(dir)),
);
for (const pattern of json('package.json').workspaces) {
  const parent = path.dirname(pattern);
  if (!existsSync(parent)) continue;
  for (const { name } of readdirSync(parent, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  )) {
    const dir = path.join(parent, name);
    if (!existsSync(path.join(dir, 'package.json'))) continue;
    const manifest = json(path.join(dir, 'package.json'));
    packages.set(manifest.name, { dir, parent, name, manifest });
    if (existsSync(path.join(dir, 'tsconfig.json')) && !references.has(path.resolve(dir)))
      failures.push(dir + ': root build is missing a project reference');
  }
}

function allowed(source, target) {
  if (source === target) return true;
  if (
    source.parent === 'plugins' ||
    source.name === 'builtins' ||
    source.name === 'host' ||
    source.name === 'svg-xml'
  )
    return target.dir === path.join('packages', 'core');
  if (source.parent === 'apps') {
    if (source.name === 'vscode-svg') return target.dir === path.join('packages', 'svg-xml');
    return target.parent === 'packages' || (source.name === 'cli' && target.parent === 'plugins');
  }
  return false;
}

function dependencyProblem(pkg, file, specifier, testing, typeOnly) {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    const target = path.resolve(path.dirname(file), specifier);
    if (!target.startsWith(path.resolve(pkg.dir) + path.sep))
      return 'relative import escapes workspace';
    if (!testing && !target.startsWith(path.resolve(pkg.dir, 'src') + path.sep))
      return 'source imports non-source path';
    return;
  }
  const name = specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');
  const target = packages.get(name);
  if (target) {
    const subpath = '.' + specifier.slice(name.length);
    if (!allowed(pkg, target)) return 'forbidden package dependency';
    if (!Object.hasOwn(target.manifest.exports ?? {}, subpath)) return 'non-public package path';
    if (!testing && subpath === './testing') return 'production uses test doubles';
    if (
      target !== pkg &&
      !Object.hasOwn(pkg.manifest.dependencies ?? {}, name) &&
      !Object.hasOwn(pkg.manifest.peerDependencies ?? {}, name) &&
      !((testing || typeOnly) && Object.hasOwn(pkg.manifest.devDependencies ?? {}, name))
    )
      return 'undeclared package dependency';
    return;
  }
  if (testing && isBuiltin(specifier)) return;
  if (pkg.name === 'core' || pkg.name === 'builtins' || pkg.parent === 'plugins')
    return 'only public core dependencies permitted';
  if (isBuiltin(specifier) && pkg.name !== 'svg-xml') return;
  if (specifier === 'vscode' && pkg.name === 'vscode-svg') return;
  if (
    !Object.hasOwn(pkg.manifest.dependencies ?? {}, name) &&
    !Object.hasOwn(pkg.manifest.peerDependencies ?? {}, name) &&
    !((testing || typeOnly) && Object.hasOwn(pkg.manifest.devDependencies ?? {}, name))
  )
    return 'undeclared external dependency';
}

function visit(node, inspect) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, inspect);
    return;
  }
  if (!node.type) return;
  inspect(node);
  for (const [key, child] of Object.entries(node)) {
    if (!['tokens', 'comments', 'loc', 'range'].includes(key)) visit(child, inspect);
  }
}

let count = 0;
for (const pkg of packages.values()) {
  for (const name of Object.keys(pkg.manifest.dependencies ?? {})) {
    const target = packages.get(name);
    if (target && !allowed(pkg, target))
      failures.push(pkg.dir + ': forbidden manifest dependency ' + name);
  }
  for (const subtree of ['src', 'test']) {
    const root = path.join(pkg.dir, subtree);
    if (!existsSync(root)) continue;
    for (const relative of readdirSync(root, { recursive: true }).filter((f) =>
      /\.[cm]?[jt]sx?$/.test(f),
    )) {
      const file = path.join(root, relative);
      const ast = await parsers.typescript.parse(readFileSync(file, 'utf8'), { filepath: file });
      const classes = [];
      visit(ast, (node) => {
        if (node.type === 'ClassDeclaration') classes.push(node.id?.name);
        let source;
        if (
          [
            'ImportDeclaration',
            'ExportAllDeclaration',
            'ExportNamedDeclaration',
            'ImportExpression',
            'TSImportType',
          ].includes(node.type)
        )
          source = node.source ?? node.argument;
        if (node.type === 'CallExpression' && node.callee.name === 'require')
          source = node.arguments[0];
        if (node.type === 'TSExternalModuleReference') source = node.expression;
        if (!source) return;
        const value = source.value ?? source.literal?.value;
        if (typeof value !== 'string') {
          if (pkg.parent === 'plugins' || ['core', 'builtins', 'svg-xml'].includes(pkg.name))
            failures.push(file + ': runtime module resolution belongs to host');
          return;
        }
        const problem = dependencyProblem(
          pkg,
          file,
          value,
          subtree === 'test' || relative.startsWith('testing' + path.sep),
          node.importKind === 'type' || node.exportKind === 'type',
        );
        if (problem) failures.push(file + ': ' + problem + ' (' + value + ')');
      });
      if (classes.length > 1 || (classes.length === 1 && classes[0] !== path.parse(file).name))
        failures.push(file + ': one class per file, matching filename required');
      count++;
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'Workspace boundaries passed: ' +
      packages.size +
      ' packages, ' +
      count +
      ' source and test files.',
  );
