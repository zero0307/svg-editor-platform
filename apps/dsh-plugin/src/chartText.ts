const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const words = new Intl.Segmenter('und', { granularity: 'word' });
export const fontSize = 15,
  lineHeight = 21,
  padding = 16;
const maxContentWidth = 166;

// Conservative advance estimates keep layout deterministic across fonts and operating systems.
function advance(glyph: string): number {
  if (/^[ \t]+$/.test(glyph)) return fontSize * 0.4;
  if (/^[ilI.,:;'!|]$/.test(glyph)) return fontSize * 0.42;
  if (/^[MW@%]$/.test(glyph)) return fontSize;
  if (/^[\p{Script=Latin}\p{Number}][\p{Mark}]*$/u.test(glyph)) return fontSize * 0.72;
  // Some SVG renderers show joined emoji as separate fallback glyphs.
  // Reserve their combined width, but keep the entire grapheme on one line.
  const pictographs = glyph.match(
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu,
  );
  if (pictographs && pictographs.length > 1) return fontSize * 1.65 * pictographs.length;
  return fontSize * 1.06;
}
export interface LabelLine {
  text: string;
  before: string;
  width: number;
}
export function wrapLabel(label: string, limit = maxContentWidth): LabelLine[] {
  const lines: LabelLine[] = [];
  let line: LabelLine = { text: '', before: '', width: 0 };
  function next(before: string) {
    lines.push(line);
    line = { text: '', before, width: 0 };
  }
  for (const paragraph of label.split(/(\r\n|\r|\n)/)) {
    if (/^[\r\n]/.test(paragraph)) {
      next(paragraph);
      continue;
    }
    for (const word of words.segment(paragraph)) {
      const glyphs = Array.from(segmenter.segment(word.segment), (s) => s.segment);
      const total = glyphs.reduce((sum, g) => sum + advance(g), 0);
      if (line.width && total <= limit && line.width + total > limit && word.isWordLike) next('');
      for (const glyph of glyphs) {
        const width = advance(glyph);
        if (line.width && line.width + width > limit) {
          // Keep a closing CJK punctuation mark with the previous complete grapheme.
          const trailing = /^[。，、；：！？）》】」』]$/u.test(glyph)
            ? segmenter.segment(line.text).containing(line.text.length - 1)
            : undefined;
          if (trailing && trailing.index > 0 && advance(trailing.segment) + width <= limit) {
            const carry = trailing.segment,
              carryWidth = advance(carry);
            line.text = line.text.slice(0, trailing.index);
            line.width -= carryWidth;
            next('');
            line.text = carry;
            line.width = carryWidth;
          } else next('');
        }
        line.text += glyph;
        line.width += width;
      }
    }
  }
  lines.push(line);
  return lines;
}

// One request owns the cache. Different text widths can produce different line breaks.
export function cachedWrap() {
  const labels = new Map<string, Map<number, LabelLine[]>>();
  return (label: string, limit = maxContentWidth) => {
    let widths = labels.get(label);
    if (!widths) {
      widths = new Map();
      labels.set(label, widths);
    }
    let lines = widths.get(limit);
    if (!lines) {
      lines = wrapLabel(label, limit);
      widths.set(limit, lines);
    }
    return lines;
  };
}

export function nodeSize(label: string, wrap = wrapLabel) {
  const lines = wrap(label);
  const widest = lines.reduce((max, l) => Math.max(max, l.width), 0);
  return {
    width: Math.max(108, Math.ceil(widest) + padding * 2),
    height: Math.max(52, lines.length * lineHeight + 22),
  };
}

// Manual coordinates remain usable: scale the text to the supplied box if necessary.
export function fitLabel(label: string, width: number, height: number, wrap = wrapLabel) {
  const available = Math.max(width - Math.min(2 * padding, width * 0.2), width * 0.5);
  // A very short manually positioned box benefits more from one scaled line than forced wrapping.
  const limit =
    height < lineHeight * 2 + 12
      ? Math.max(maxContentWidth, available)
      : Math.min(maxContentWidth, available);
  const lines = wrap(label, limit);
  const widest = lines.reduce((max, l) => Math.max(max, l.width), 1);
  const scale = Math.min(1, available / widest, (height * 0.84) / (lines.length * lineHeight));
  return { lines, size: fontSize * scale, step: lineHeight * scale };
}
