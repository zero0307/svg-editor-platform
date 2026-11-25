import { ContainerShape, DomainError } from '@svgframe/core';
import type {
  Shape,
  ShapeProvider,
  ShapeProviderRegistry,
  ShapeRestoreService,
  SvgElementView,
} from '@svgframe/core';

/**
 * Provider selection and complete-subtree restoration.
 *
 * Explicit semantic matches (`matches`) win over tag defaults; two matches at the
 * same level are ambiguous and rejected instead of depending on registration
 * order. Missing explicit matches fall back to the provider whose `defaultTag`
 * equals the element tag, so a marker without an installed provider (for example
 * a plugin-specific `data-kind` value) degrades to the ordinary tag and keeps the
 * marker attribute.
 * Unknown tags still fail like Phase 1.
 */
export class SvgRestorer implements ShapeRestoreService {
  constructor(private readonly providers: ShapeProviderRegistry) {}

  restore(element: SvgElementView): Shape {
    const provider = this.select(element);
    const shape = provider.restore(element, this);
    if (shape instanceof ContainerShape && element.tag !== 'text' && (element.text ?? '').trim())
      throw new DomainError('unsupported text outside <text>');
    if (element.children.length > 0 && shape.children().length === 0)
      throw new DomainError(`unsupported child elements in <${element.tag}>`);
    return shape;
  }

  private select(element: SvgElementView): ShapeProvider {
    const providers = this.providers.entries();
    const explicit = providers.filter((provider) => provider.matches(element));
    if (explicit.length > 1) throw this.ambiguous(element, explicit);
    if (explicit.length === 1) return explicit[0]!;
    const defaults = providers.filter((provider) => provider.defaultTag === element.tag);
    if (defaults.length > 1) throw this.ambiguous(element, defaults);
    if (defaults.length === 1) return defaults[0]!;
    throw new DomainError(`unknown shape type: ${element.tag} (is the plugin loaded?)`);
  }

  private ambiguous(element: SvgElementView, providers: readonly ShapeProvider[]): DomainError {
    const types = providers.map((provider) => provider.type).sort();
    return new DomainError(`ambiguous provider match for <${element.tag}>: ${types.join(', ')}`);
  }
}
