import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const CATEGORY_NAMES = ['kernel', 'assembly', 'plugin', 'vscode', 'dsh'];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];

function escapeRegExp(text) {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** Minimal glob: `**` crosses segments, `*`/`?` stay inside one segment. */
export function globToRegExp(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index++;
        if (pattern[index + 1] === '/') {
          index++;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(character);
    }
  }
  return new RegExp(`${source}$`);
}

export class ClassificationError extends Error {
  constructor(problems) {
    super(`classification failed for ${problems.length} path(s):\n${problems.join('\n')}`);
    this.name = 'ClassificationError';
    this.problems = problems;
  }
}

export class Classifier {
  #definition;
  #digest;
  #excludes;
  #rules;

  constructor(definition, digest) {
    this.#definition = definition;
    this.#digest = digest;
    this.#excludes = (definition.excludes ?? []).map((entry) => ({
      ...entry,
      pattern: globToRegExp(entry.match),
    }));
    this.#rules = (definition.rules ?? []).map((entry) => ({
      ...entry,
      pattern: globToRegExp(entry.match),
    }));
    for (const rule of this.#rules) {
      if (!CATEGORY_NAMES.includes(rule.category)) {
        throw new Error(`classification rule ${rule.match}: unknown category ${rule.category}`);
      }
    }
  }

  get digest() {
    return this.#digest;
  }

  get version() {
    return this.#definition.version;
  }

  get excludePatterns() {
    return (this.#definition.excludes ?? []).map((entry) => ({
      match: entry.match,
      reason: entry.reason,
    }));
  }

  /** Returns `{ excluded: true, reason, match }` or `{ category, responsibility, match }`. */
  classify(file) {
    const excluded = this.#excludes.find((entry) => entry.pattern.test(file));
    if (excluded) return { excluded: true, reason: excluded.reason, match: excluded.match };
    const matches = this.#rules.filter((entry) => entry.pattern.test(file));
    if (matches.length === 0)
      return { excluded: false, problems: [`${file}: no classification rule`] };
    if (matches.length > 1) {
      return {
        excluded: false,
        problems: [
          `${file}: matches ${matches.length} rules (${matches.map((entry) => entry.match).join(', ')})`,
        ],
      };
    }
    const [rule] = matches;
    if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) {
      return {
        excluded: false,
        problems: [
          `${file}: classified as ${rule.category} but is not a measured source file; add an exclude rule`,
        ],
      };
    }
    return {
      excluded: false,
      category: rule.category,
      responsibility: rule.responsibility,
      match: rule.match,
    };
  }

  /**
   * Classify every tracked path of one commit. Throws once with all problems, so a single run
   * reports every unclassified or doubly classified path instead of stopping at the first.
   */
  classifyAll(files) {
    const measured = new Map();
    const excluded = new Map();
    const problems = [];
    for (const file of files) {
      const result = this.classify(file);
      if (result.excluded) {
        excluded.set(result.match, (excluded.get(result.match) ?? 0) + 1);
        continue;
      }
      if (result.problems) {
        problems.push(...result.problems);
        continue;
      }
      measured.set(file, {
        category: result.category,
        responsibility: result.responsibility,
        rule: result.match,
      });
    }
    if (problems.length) throw new ClassificationError(problems);
    return { measured, excluded };
  }
}

export async function loadClassification(file) {
  const text = await readFile(file, 'utf8');
  const definition = JSON.parse(text);
  const digest = createHash('sha256').update(text).digest('hex');
  return new Classifier(definition, digest);
}

export function summarizeExclusions(excluded) {
  return [...excluded.entries()]
    .map(([match, count]) => ({ match, count }))
    .sort((left, right) => (left.match < right.match ? -1 : left.match > right.match ? 1 : 0));
}
