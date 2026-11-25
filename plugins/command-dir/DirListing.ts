import type { DirectoryEntry, DirectoryReader } from '@svgframe/core';

const groupOrder: Readonly<Record<DirectoryEntry['kind'], number>> = {
  directory: 0,
  file: 1,
  link: 2,
  other: 3,
};

const markerOf: Readonly<Record<DirectoryEntry['kind'], string>> = {
  directory: '[DIR]',
  file: '[FILE]',
  link: '[LINK]',
  other: '[OTHER]',
};

/**
 * Formats the direct children of the process working directory for `dir`.
 *
 * The plugin only sees the public `DirectoryReader` port, so it owns the whole
 * presentation policy: directories first, then regular files, links and other
 * special entries, each group ascending by a case-sensitive JavaScript string
 * comparison (`a < b`, never `localeCompare`). Hidden names are kept, `[MARK]`
 * markers are followed by exactly two spaces, listing is not recursive and links
 * are never followed. An empty listing is `(empty directory)`; read failures are
 * not caught, so the adapter wording `cannot read directory: <path>` reaches the
 * CLI, which prefixes `error: `.
 */
export class DirListing {
  async render(reader: DirectoryReader): Promise<readonly string[]> {
    const path = reader.cwd();
    const entries = await reader.list(path);
    if (!entries.length) return ['(empty directory)'];
    return [...entries]
      .sort(DirListing.compare)
      .map((entry) => `${markerOf[entry.kind]}  ${entry.name}`);
  }
  private static compare(left: DirectoryEntry, right: DirectoryEntry): number {
    const group = groupOrder[left.kind] - groupOrder[right.kind];
    if (group !== 0) return group;
    if (left.name === right.name) return 0;
    return left.name < right.name ? -1 : 1;
  }
}
