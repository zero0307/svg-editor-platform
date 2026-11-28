import { DomainError, Numbers } from '@svgframe/core';
import type { Shape, SvgElementView } from '@svgframe/core';

/** Phase 1 parameter-count rule shared by all built-in providers. */
export const requireParameterCount = (
  type: string,
  parameters: readonly string[],
  min: number,
  max: number,
): void => {
  if (parameters.length < min || parameters.length > max)
    throw new DomainError(`invalid parameters for ${type}`);
};

/** One raw parameter; the caller has already validated the count. */
export const parameter = (type: string, parameters: readonly string[], index: number): string => {
  const value = parameters[index];
  if (value === undefined) throw new DomainError(`invalid parameters for ${type}`);
  return value;
};

/** Phase 1 number label: `parameter <1-based index>`. */
export const numberParameter = (
  type: string,
  parameters: readonly string[],
  index: number,
): number => Numbers.parse(parameter(type, parameters, index), `parameter ${index + 1}`);

/** Missing geometry attributes default to `0`, exactly like Phase 1 restore. */
export const geometryParameters = (
  element: SvgElementView,
  fields: readonly string[],
): readonly string[] => fields.map((field) => element.attributes[field] ?? '0');

export const restoredId = (element: SvgElementView): string => element.id ?? '';

/**
 * Applies the already-normalized element attributes in Phase 1 order:
 * geometry is owned by the constructor, presentation attributes go through the
 * shape's validated setters, everything else is preserved as imported metadata.
 */
export const applyRestoredAttributes = (
  shape: Shape,
  element: SvgElementView,
  geometry: readonly string[],
): void => {
  for (const [name, value] of Object.entries(element.attributes)) {
    if (name === 'id' || geometry.includes(name) || name.startsWith('xmlns')) continue;
    if (name === 'fill' || name === 'stroke' || name === 'stroke-width')
      shape.setAttribute(name, value);
    else shape.preserveAttribute(name, value);
  }
};

/** Leaf providers apply the normalized world transform exactly once. */
export const applyElementTransform = (shape: Shape, element: SvgElementView): void => {
  shape.scale(element.transform.scale);
  shape.move(element.transform.translateX, element.transform.translateY);
};
