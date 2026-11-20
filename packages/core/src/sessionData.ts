import type { SessionShapeRequest } from './model.js';

// Session callers can annotate shapes without overriding geometry, styles or SVG event handlers.
export function sessionData(request: SessionShapeRequest): Record<string, string> {
  const invalidXml = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\uD800-\uDFFF\uFFFE\uFFFF]/u;
  const entries = Object.entries(request.dataAttributes ?? {});
  for (const [key, value] of entries) {
    if (!/^data-[a-z][a-z0-9-]*$/.test(key) || typeof value !== 'string' || invalidXml.test(value))
      throw new RangeError('Invalid SVG data attribute: ' + key);
  }
  return Object.fromEntries(entries);
}

const solidColor = /^#[0-9a-f]{6}$/i;
const length = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i;
const allowed = {
  fill: solidColor,
  stroke: solidColor,
  'stroke-width': length,
  rx: length,
  'font-size': length,
  'font-weight': /^(400|500|600|700)$/,
  'stroke-linecap': /^(round|butt|square)$/,
  'text-anchor': /^(start|middle|end)$/,
  'font-family': /^[A-Za-z][A-Za-z0-9 -]*(?:, *[A-Za-z][A-Za-z0-9 -]*)*$/,
};

export function sessionPresentation(request: SessionShapeRequest): Record<string, string> {
  const entries = Object.entries(request.presentation ?? {});
  for (const [key, value] of entries) {
    if (
      !Object.hasOwn(allowed, key) ||
      typeof value !== 'string' ||
      !allowed[key as keyof typeof allowed].test(value) ||
      (allowed[key as keyof typeof allowed] === length && !Number.isFinite(Number(value)))
    )
      throw new RangeError('Invalid SVG presentation attribute: ' + key);
  }
  return Object.fromEntries(entries);
}
