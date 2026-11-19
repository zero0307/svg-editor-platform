import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-fs';
import type {} from '@deepseek-ai/dsh-sandbox-policy';
import type {} from '@deepseek-ai/dsh-working-directory';
import { ToolArgsError, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { FileStore } from '@svgframe/core';

export class DshFileStore implements FileStore {
  constructor(
    private readonly ctx: Context,
    private readonly exec: ToolRunContext,
  ) {}
  private async target(path: string) {
    if (!path.trim() || !path.toLowerCase().endsWith('.svg'))
      throw new ToolArgsError(['Provide an .svg file path.']);
    const { agent, signal } = this.exec;
    signal.throwIfAborted();
    const cwd = agent && (await this.ctx.workingDirectory.ensure(agent, signal));
    return this.ctx.fs.resolve(path, { cwd, signal });
  }
  async read(path: string): Promise<string> {
    return this.ctx.fs.readText(await this.target(path), this.exec.signal);
  }
  async write(path: string, content: string): Promise<void> {
    const target = await this.target(path);
    const { agent, signal } = this.exec;
    const policy =
      this.ctx.fs.sandboxMode === undefined
        ? undefined
        : this.ctx.sandboxPolicy.resolve(agent ? { session: agent.session } : {});
    // A generated chart is a new document. The provider atomically checks absence and publishes.
    const result = await this.ctx.fs.writeText(
      target,
      content,
      { kind: 'createIfAbsent' },
      signal,
      policy,
    );
    this.ctx.emit('fs/observed', target, { kind: 'present', version: result.version }, this.exec);
  }
}
