import type { FileStore } from '@svgframe/core';
import type { SvgFileGateway } from './SvgFileGateway.js';

/**
 * Adapts the host-injected file gateway to the public `FileStore` port so the
 * core `EditorSession` can read and save documents through `ctx.fs`.
 */
export class GatewayFileStore implements FileStore {
  constructor(private readonly gateway: SvgFileGateway) {}

  async read(path: string): Promise<string> {
    const target = await this.gateway.resolve(path);
    return this.gateway.readText(target);
  }

  async write(path: string, content: string): Promise<void> {
    const target = await this.gateway.resolve(path);
    await this.gateway.writeText(target, content);
  }
}
