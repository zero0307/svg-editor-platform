import type { FileStore } from '@svgframe/core';
import { SvgTools } from '../src/SvgTools.js';
import { Phase1EditorSession } from '../src/session.cjs';

export function fixture() {
  const files = new Map<string, string>();
  const store: FileStore = {
    async read(path) {
      const content = files.get(path);
      if (content === undefined) throw new Error('missing file');
      return content;
    },
    async write(path, content) {
      if (path === 'denied.svg') throw new Error('write denied');
      files.set(path, content);
    },
  };
  const session = () => new Phase1EditorSession(store, { quadraticPaths: true });
  return { files, tools: new SvgTools(session), session };
}
