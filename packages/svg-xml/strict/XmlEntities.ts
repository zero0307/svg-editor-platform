const named: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Decode the XML entity references the strict layer needs to be byte-compatible
 * with Phase 1 (which parsed with a DOM). Unknown named entities are kept as-is;
 * numeric references outside the Unicode scalar range are also left untouched.
 */
export function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g,
    (whole, name: string) => {
      if (name.startsWith('#x') || name.startsWith('#X')) {
        const code = Number.parseInt(name.slice(2), 16);
        return validCodePoint(code) ? String.fromCodePoint(code) : whole;
      }
      if (name.startsWith('#')) {
        const code = Number.parseInt(name.slice(1), 10);
        return validCodePoint(code) ? String.fromCodePoint(code) : whole;
      }
      return named[name] ?? whole;
    },
  );
}

const validCodePoint = (code: number): boolean =>
  Number.isInteger(code) &&
  (code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff));
