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
