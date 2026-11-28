import { DomainError } from '@svgframe/core';
import type { SvgFileGateway, SvgFileInfo, SvgFileTarget } from '../src/SvgFileGateway.js';

/**
 * In-memory `SvgFileGateway` test double. Tests seed `files`, force resolve,
 * read or write failures, and inspect what the tool wrote — no Node file API
 * and no CLI subprocess is involved.
 */
export class FakeSvgFileGateway implements SvgFileGateway {
  readonly files = new Map<string, string>();
  failResolve = false;
  failRead = false;
  failWrite = false;

  async resolve(path: string, options: { signal?: AbortSignal } = {}): Promise<SvgFileTarget> {
    options.signal?.throwIfAborted();
    if (this.failResolve) throw new DomainError(`cannot resolve path: ${path}`);
    return { displayPath: path };
  }

  async stat(target: SvgFileTarget): Promise<SvgFileInfo | undefined> {
    const content = this.files.get(target.displayPath);
    return content === undefined ? undefined : { size: content.length };
  }

  async readText(target: SvgFileTarget): Promise<string> {
    if (this.failRead) throw new DomainError(`cannot read file: ${target.displayPath}`);
    const content = this.files.get(target.displayPath);
    if (content === undefined) throw new DomainError(`cannot read file: ${target.displayPath}`);
    return content;
  }

  async writeText(target: SvgFileTarget, content: string): Promise<void> {
    if (this.failWrite) throw new DomainError(`cannot write file: ${target.displayPath}`);
    this.files.set(target.displayPath, content);
  }
}
