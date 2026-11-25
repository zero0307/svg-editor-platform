import type { DshFsService, DshFsTarget } from './DshContracts.js';
import type { SvgFileGateway, SvgFileInfo, SvgFileTarget } from './SvgFileGateway.js';

/**
 * Binds the abstract `SvgFileGateway` to the host-injected `ctx.fs` service.
 *
 * The DSH filesystem owns path resolution, UTF-8 decoding and atomic
 * publication, so this adapter only forwards calls and narrows the opaque
 * target to the display path the tool results may show.
 */
export class CtxFsSvgFileGateway implements SvgFileGateway {
  constructor(private readonly fs: DshFsService) {}

  async resolve(path: string, options: { signal?: AbortSignal } = {}): Promise<SvgFileTarget> {
    const target = await this.fs.resolve(path, options);
    return Object.freeze({ displayPath: target.displayPath });
  }

  async stat(target: SvgFileTarget, signal?: AbortSignal): Promise<SvgFileInfo | undefined> {
    const info = await this.fs.stat(this.hostTarget(target), signal);
    return info === undefined ? undefined : { size: info.size };
  }

  async readText(target: SvgFileTarget, signal?: AbortSignal): Promise<string> {
    return this.fs.readText(this.hostTarget(target), signal);
  }

  async writeText(target: SvgFileTarget, content: string, signal?: AbortSignal): Promise<void> {
    await this.fs.writeText(this.hostTarget(target), content, signal);
  }

  private hostTarget(target: SvgFileTarget): DshFsTarget {
    return target as unknown as DshFsTarget;
  }
}
