import type { DshFsService } from './DshContracts.js';
import type { SvgFileGateway, SvgFileInfo, SvgFileTarget } from './SvgFileGateway.js';

/**
 * Binds the abstract `SvgFileGateway` to the host-injected `ctx.fs` service.
 *
 * The DSH filesystem owns path resolution, UTF-8 decoding and atomic
 * publication. Pass its resolved target back unchanged on every operation.
 */
export class CtxFsSvgFileGateway implements SvgFileGateway {
  constructor(private readonly fs: DshFsService) {}

  async resolve(path: string, options: { signal?: AbortSignal } = {}): Promise<SvgFileTarget> {
    return this.fs.resolve(path, options);
  }

  async stat(target: SvgFileTarget, signal?: AbortSignal): Promise<SvgFileInfo | undefined> {
    const info = await this.fs.stat(target, signal);
    return info === undefined ? undefined : { size: info.size };
  }

  async readText(target: SvgFileTarget, signal?: AbortSignal): Promise<string> {
    return this.fs.readText(target, signal);
  }

  async writeText(target: SvgFileTarget, content: string, signal?: AbortSignal): Promise<void> {
    await this.fs.writeText(target, content, signal);
  }
}
