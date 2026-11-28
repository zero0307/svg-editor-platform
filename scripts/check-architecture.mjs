import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve('.');
const failures = [];
const toPosix = (value) => value.split(path.sep).join('/');

/*
 * Phase 1 layout: `src/` is split into layers and keeps its own direction rules.
 * This block must stay valid until the CLI migration (#14) removes `src/`.
 */
const legacyRoot = path.join(projectRoot, 'src');
const legacyLayers = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  cli: new Set(['cli', 'application', 'domain']),
  infrastructure: new Set(['infrastructure', 'application', 'domain']),
  bootstrap: new Set(['bootstrap', 'cli', 'application', 'infrastructure', 'domain']),
};
let legacyFiles = [];
try {
  legacyFiles = (await readdir(legacyRoot, { recursive: true })).filter((file) =>
    file.endsWith('.ts'),
  );
} catch {
  // #14 removes the old kernel; the workspace rules below remain mandatory.
  legacyFiles = [];
}
let legacyEdges = 0;
for (const file of legacyFiles) {
  const source = await readFile(path.join(legacyRoot, file), 'utf8');
  const layer = file.split(path.sep)[0];
  const classes = [...source.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g)].map(
    (match) => match[1],
  );
  if (classes.length > 1 || (classes.length === 1 && path.basename(file, '.ts') !== classes[0]))
    failures.push(`${file}: one class per file; filename must match`);
  for (const [, dependency] of source.matchAll(
    /(?:import\s[\s\S]*?from\s*|import\s*)['"]([^'"]+)['"]/g,
  )) {
    if (!dependency.startsWith('.')) {
      if (layer === 'domain' || layer === 'application')
        failures.push(`${file}: forbidden external dependency ${dependency}`);
      continue;
    }
    const target = path
      .relative(legacyRoot, path.resolve(legacyRoot, path.dirname(file), dependency))
      .split(path.sep)[0];
    legacyEdges++;
    if (!legacyLayers[layer]?.has(target))
      failures.push(`${file}: ${layer} -> ${target} is forbidden`);
  }
  if (/switch\s*\([^)]*\b(?:tag|type)\b/.test(source))
    failures.push(`${file}: tag/type switch is forbidden`);
}

/*
 * Phase 2 workspaces: package boundaries, public entry points and the declared
 * dependency matrix. Every workspace listed by the root `workspaces` patterns is
 * checked; new packages must be reviewed and added to the matrix below.
 */
const readJson = async (file) => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const rootManifest = await readJson(path.join(projectRoot, 'package.json'));
const workspacePatterns = rootManifest.workspaces ?? [];
const workspaceDirectories = [];
for (const pattern of workspacePatterns) {
  const areaMatch = /^([^*]+)\/\*$/.exec(pattern);
  if (!areaMatch) {
    failures.push(`package.json: unsupported workspace pattern ${pattern}`);
    continue;
  }
  const areaDirectory = path.join(projectRoot, areaMatch[1]);
  let entries;
  try {
    entries = await readdir(areaDirectory, { withFileTypes: true });
  } catch {
    // Declared area without any package yet, for example `plugins/` before #17.
    continue;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(areaDirectory, entry.name);
    try {
      await readFile(path.join(directory, 'package.json'));
      workspaceDirectories.push(directory);
    } catch {
      failures.push(`${toPosix(path.relative(projectRoot, directory))}: missing package.json`);
    }
  }
}

const workspaces = [];
for (const directory of workspaceDirectories) {
  const manifest = await readJson(path.join(directory, 'package.json'));
  if (typeof manifest.name !== 'string' || !manifest.name) {
    failures.push(`${toPosix(path.relative(projectRoot, directory))}: package has no name`);
    continue;
  }
  if (workspaces.some((workspace) => workspace.manifest.name === manifest.name))
    failures.push(`duplicate workspace package name: ${manifest.name}`);
  workspaces.push({
    directory,
    relative: toPosix(path.relative(projectRoot, directory)),
    manifest,
  });
}
const workspaceByName = new Map(
  workspaces.map((workspace) => [workspace.manifest.name, workspace]),
);
const pluginNames = workspaces
  .filter((workspace) => workspace.relative.startsWith('plugins/'))
  .map((workspace) => workspace.manifest.name);

const dependencyMatrix = (workspace) => {
  const { relative } = workspace;
  if (relative === 'packages/core') return [];
  if (['packages/svg-xml', 'packages/host', 'packages/builtins'].includes(relative))
    return ['@svgframe/core'];
  if (relative.startsWith('plugins/')) return ['@svgframe/core'];
  if (relative === 'apps/cli')
    return [
      '@svgframe/core',
      '@svgframe/host',
      '@svgframe/svg-xml',
      '@svgframe/builtins',
      ...pluginNames,
    ];
  if (relative === 'apps/vscode-svg') return ['@svgframe/svg-xml'];
  if (relative === 'apps/dsh-plugin')
    return ['@svgframe/core', '@svgframe/svg-xml', '@svgframe/host', '@svgframe/builtins'];
  return undefined;
};

const sourceExtensions = ['.ts', '.js', '.mjs', '.cjs'];
const skippedDirectories = new Set([
  'node_modules',
  'dist',
  'coverage',
  'artifacts',
  'examples',
  '.vscode',
]);
const collectSources = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name))
        files.push(...(await collectSources(path.join(directory, entry.name))));
      continue;
    }
    if (sourceExtensions.some((extension) => entry.name.endsWith(extension)))
      files.push(path.join(directory, entry.name));
  }
  return files;
};

const declaredDependencies = (manifest) => {
  const names = new Set();
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const name of Object.keys(manifest[field] ?? {})) names.add(name);
  }
  return names;
};

const nodeBuiltins = new Set([
  'assert',
  'child_process',
  'crypto',
  'events',
  'fs',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'process',
  'readline',
  'stream',
  'timers',
  'tty',
  'url',
  'util',
  'v8',
  'worker_threads',
  'zlib',
]);
const platformModules = (workspace) =>
  workspace.relative === 'apps/vscode-svg' ? new Set(['vscode']) : new Set();

let workspaceEdges = 0;
let workspaceSources = 0;
for (const workspace of workspaces) {
  const allowed = dependencyMatrix(workspace);
  if (!allowed) {
    failures.push(
      `${toPosix(path.relative(projectRoot, workspace.directory))}: no dependency rule; add it to check-architecture.mjs`,
    );
    continue;
  }
  const manifest = workspace.manifest;
  if (manifest.type !== 'module')
    failures.push(`${workspace.relative}: workspace package must be ESM ("type": "module")`);
  if (workspace.relative.startsWith('packages/')) {
    const entry = manifest.exports?.['.'];
    if (!entry || !entry.types || !(entry.import || entry.default))
      failures.push(
        `${workspace.relative}: library package needs exports["."] with types and runtime entry`,
      );
  }
  const isTypeScriptPackage = await readFile(
    path.join(workspace.directory, 'tsconfig.json'),
    'utf8',
  ).then(
    () => true,
    () => false,
  );
  const declared = declaredDependencies(manifest);
  for (const name of declared) {
    if (!name.startsWith('@svgframe/')) continue;
    if (!workspaceByName.has(name))
      failures.push(
        `${workspace.relative}: package.json declares unknown workspace package ${name}`,
      );
    else if (!allowed.includes(name))
      failures.push(
        `${workspace.relative}: package.json declares forbidden workspace dependency ${name}`,
      );
  }
  const forWorkspace = await collectSources(workspace.directory);
  for (const file of forWorkspace) {
    const relative = toPosix(path.relative(workspace.directory, file));
    const segments = relative.split('/');
    const isTest = segments.includes('test') || /\.test\.[cm]?[jt]s$/.test(relative);
    const isDeclaration = relative.endsWith('.d.ts');
    const source = await readFile(file, 'utf8');
    workspaceSources++;
    if (file.endsWith('.ts') && !isDeclaration && !isTest) {
      const classes = [...source.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g)].map(
        (match) => match[1],
      );
      if (classes.length > 1 || (classes.length === 1 && path.basename(file, '.ts') !== classes[0]))
        failures.push(`${relative}: one class per file; filename must match`);
      if (/switch\s*\([^)]*\b(?:tag|type)\b/.test(source))
        failures.push(`${relative}: tag/type switch is forbidden`);
      if (
        workspace.relative === 'packages/core' &&
        /\b(?:process\.|Buffer\.|__dirname|__filename)/.test(source)
      )
        failures.push(`${relative}: core source must not use Node globals`);
    }
    const specifiers = new Set();
    for (const pattern of [
      /^\s*(?:import|export)\s+(?:type\s+)?[^;\n]*?\bfrom\s*['"]([^'"]+)['"]/gm,
      /^\s*(?:import|export)\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"]([^'"]+)['"]/gm,
      /^\s*import\s*['"]([^'"]+)['"]/gm,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]) {
      for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier);
        const inside = !toPosix(path.relative(workspace.directory, target)).startsWith('..');
        if (!inside)
          failures.push(`${relative}: relative import escapes the package: ${specifier}`);
        continue;
      }
      if (specifier.startsWith('@svgframe/')) {
        const dependency = workspaceByName.get(specifier);
        if (!dependency) {
          failures.push(`${relative}: unknown workspace package ${specifier}`);
          continue;
        }
        if (!allowed.includes(specifier))
          failures.push(`${relative}: ${workspace.relative} must not import ${specifier}`);
        if (!declared.has(specifier))
          failures.push(`${relative}: ${specifier} is imported but not declared in package.json`);
        workspaceEdges++;
        continue;
      }
      if (workspace.relative === 'packages/core' && specifier === '@xmldom/xmldom')
        failures.push(`${relative}: core must not depend on an XML DOM library`);
      const isNodeBuiltin =
        specifier.startsWith('node:') || nodeBuiltins.has(specifier.split('/')[0]);
      if (isNodeBuiltin) {
        const platformNeutral = [
          'packages/core',
          'packages/svg-xml',
          'packages/builtins',
          'plugins/',
        ].some((prefix) => workspace.relative.startsWith(prefix));
        if (platformNeutral && !isTest)
          failures.push(
            `${relative}: ${workspace.relative} source must not import Node builtin ${specifier}`,
          );
        continue;
      }
      if (platformModules(workspace).has(specifier)) continue;
      if (isTypeScriptPackage && !declared.has(specifier))
        failures.push(
          `${relative}: external dependency ${specifier} is not declared in package.json`,
        );
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Architecture check passed: ${legacyFiles.length} legacy files, ${legacyEdges} legacy imports, ` +
      `${workspaces.length} workspace packages, ${workspaceSources} workspace sources, ` +
      `${workspaceEdges} cross-package imports, matching class filenames.`,
  );
}
