import { CircleProvider } from './providers/CircleProvider.js';
import { EllipseProvider } from './providers/EllipseProvider.js';
import { GroupProvider } from './providers/GroupProvider.js';
import { LineProvider } from './providers/LineProvider.js';
import { RectProvider } from './providers/RectProvider.js';
import { TextProvider } from './providers/TextProvider.js';
import type { ShapeProvider, ShapeProviderRegistry } from '@svgframe/core';

/** Phase 1 shape order: rect, circle, ellipse, line, text, g. */
export const defaultProviders = (): readonly ShapeProvider[] => [
  new RectProvider(),
  new CircleProvider(),
  new EllipseProvider(),
  new LineProvider(),
  new TextProvider(),
  new GroupProvider(),
];

export function registerDefaultShapes(registry: ShapeProviderRegistry): void {
  for (const provider of defaultProviders()) registry.register(provider);
}
