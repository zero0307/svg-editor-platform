import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { API } from 'typescript/unstable/sync';

const POSIX = (value) => value.split(path.sep).join('/');

/**
 * Parse source blobs with the repository-locked TypeScript (7.0.2, native tsgo) through the
 * syntax-only API. Files are materialised into a temporary directory because the API opens a
 * tsconfig project; nothing is read from the working tree and no output depends on the temp path.
 *
 * Returns `{ trees: Map<path, SourceFile>, close }`. The trees are only valid until `close()`.
 */
export async function parseSources(sources) {
  const directory = await mkdtemp(path.join(tmpdir(), 'svg-metrics-'));
  const files = [...sources.keys()].sort();
  for (const file of files) {
    const absolute = path.join(directory, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, sources.get(file));
  }
  const configFileName = 'tsconfig.metrics.json';
  const configPath = POSIX(path.join(directory, configFileName));
  await writeFile(
    path.join(directory, configFileName),
    `${JSON.stringify(
      {
        compilerOptions: {
          noEmit: true,
          allowJs: true,
          skipLibCheck: true,
          types: [],
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        files,
      },
      null,
      2,
    )}\n`,
  );

  const api = new API();
  let snapshot;
  try {
    snapshot = api.updateSnapshot({ openProjects: [configPath] });
  } catch (error) {
    api.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const project =
    snapshot.getProject(configPath) ??
    snapshot.getProjects().find((entry) => entry.rootFiles.length);
  if (!project) {
    api.close();
    await rm(directory, { recursive: true, force: true });
    throw new Error(`metrics parser: no TypeScript project for ${configPath}`);
  }

  const byName = new Map();
  for (const name of project.program.getSourceFileNames())
    byName.set(POSIX(path.resolve(name)), name);
  const trees = new Map();
  for (const file of files) {
    const absolute = POSIX(path.join(directory, file));
    const name = byName.get(absolute) ?? absolute;
    const tree = project.program.getSourceFile(name);
    if (!tree) {
      api.close();
      await rm(directory, { recursive: true, force: true });
      throw new Error(`metrics parser: TypeScript did not return a syntax tree for ${file}`);
    }
    trees.set(file, tree);
  }
  return {
    trees,
    async close() {
      api.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
