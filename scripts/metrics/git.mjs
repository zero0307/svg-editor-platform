import { execFileSync } from 'node:child_process';

function run(root, args, encoding) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Read-only Git plumbing for the metrics script. Every measurement reads blobs from a
 * commit, never from the working tree, so an uncommitted working copy cannot change results.
 */
export class GitRepository {
  #root;

  constructor(root) {
    this.#root = root;
  }

  get root() {
    return this.#root;
  }

  /** Dereferenced commit SHA for a rev (`final^{commit}` semantics). */
  commitOf(rev) {
    return run(this.#root, ['rev-parse', '--verify', `${rev}^{commit}`], 'utf8').trim();
  }

  /** Ref SHA before dereferencing; differs from commitOf only for annotated tags. */
  refOf(rev) {
    return run(this.#root, ['rev-parse', '--verify', rev], 'utf8').trim();
  }

  /** All Git-tracked paths at `commit`, POSIX separators, sorted. */
  filesAt(commit) {
    const output = run(this.#root, ['ls-tree', '-r', '-z', '--name-only', commit], 'utf8');
    return output.split('\0').filter(Boolean).sort();
  }

  /** Raw blob bytes at `commit:path`. */
  blobAt(commit, file) {
    return run(this.#root, ['show', `${commit}:${file}`], 'buffer');
  }
}
