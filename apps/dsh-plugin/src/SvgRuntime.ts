import {
  ProviderShapeCreationService,
  ShapeProviderRegistry,
  type ShapeCreationService,
} from '@svgframe/core';
import { registerDefaultShapes } from '@svgframe/builtins';
import { XmlSvgCodec } from '@svgframe/svg-xml';
import type { SvgCodec } from '@svgframe/core';

/**
 * Fresh public runtime for one tool call: the built-in shape providers, the
 * provider-driven creation service and the strict SVG codec.
 *
 * A runtime is created per call and never stored at module level, so no tool
 * call can observe or mutate another call's document, registry or codec state.
 */
export class SvgRuntime {
  readonly shapeProviders: ShapeProviderRegistry;
  readonly shapes: ShapeCreationService;
  readonly codec: SvgCodec;

  constructor() {
    this.shapeProviders = new ShapeProviderRegistry();
    registerDefaultShapes(this.shapeProviders);
    this.shapes = new ProviderShapeCreationService(this.shapeProviders);
    this.codec = new XmlSvgCodec(this.shapeProviders);
  }

  /** Build an isolated runtime for a single invocation. */
  static create(): SvgRuntime {
    return new SvgRuntime();
  }
}
