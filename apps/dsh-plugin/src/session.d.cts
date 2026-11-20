// Runtime implementation is bundled from src/bootstrap/Phase1EditorSession.ts before packing.
import type { EditorSessionPort, FileStore } from '@svgframe/core';
export const Phase1EditorSession: new (
  files: FileStore,
  options?: { quadraticPaths?: boolean },
) => EditorSessionPort;

export declare function quadraticPoints(d: string): {
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
};
