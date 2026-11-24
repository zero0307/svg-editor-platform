import type { SvgSyntaxElement } from './SvgSyntaxElement.js';
import type { SvgSyntaxResult } from './SvgSyntaxResult.js';
import type { SvgSyntaxSpan } from './SvgSyntaxSpan.js';

interface StartTag {
  readonly id: string | undefined;
  readonly selfClosing: boolean;
}

/**
 * Single-pass, dependency-free scanner for the neutral SVG syntax tree.
 *
 * It deliberately does not use `@xmldom/xmldom`: that parser exposes no source
 * ranges, so Outline positions cannot be derived from it without searching tag
 * text again. The scanner only needs to be tolerant enough for the Outline
 * contract (unknown tags, no ids, duplicates, same-line elements); every
 * malformed input becomes an `ok: false` result instead of a thrown error.
 */
export class SvgSyntaxParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): SvgSyntaxResult {
    try {
      return { ok: true, root: this.parseDocument() };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'invalid SVG syntax',
      };
    }
  }

  private parseDocument(): SvgSyntaxElement {
    this.skipMisc(true);
    if (this.index >= this.source.length) this.fail('no root element');
    if (this.source[this.index] !== '<') this.fail('expected a root element');
    const root = this.parseElement();
    this.skipMisc(false);
    if (this.index < this.source.length) this.fail('unexpected content after the root element');
    return root;
  }

  private parseElement(): SvgSyntaxElement {
    const start = this.index;
    this.expect('<');
    const nameStart = this.index;
    const tag = this.readName('an element name');
    const nameEnd = this.index;
    const { id, selfClosing } = this.parseStartTag(tag);
    const startTagSpan: SvgSyntaxSpan = { start, end: this.index };
    const nameSpan: SvgSyntaxSpan = { start: nameStart, end: nameEnd };
    if (selfClosing) {
      return { tag, id, text: '', children: [], outerSpan: startTagSpan, startTagSpan, nameSpan };
    }
    const text: string[] = [];
    const children: SvgSyntaxElement[] = [];
    for (;;) {
      if (this.index >= this.source.length) this.fail(`unclosed element <${tag}>`);
      const next = this.source.indexOf('<', this.index);
      if (next < 0) {
        text.push(this.source.slice(this.index));
        this.index = this.source.length;
        this.fail(`unclosed element <${tag}>`);
      }
      if (next > this.index) {
        text.push(this.source.slice(this.index, next));
        this.index = next;
      }
      if (this.startsWith('</')) {
        this.index += 2;
        this.skipWhitespace();
        const closingName = this.readName('a closing tag name');
        this.skipWhitespace();
        if (closingName !== tag) this.fail(`mismatched closing tag </${closingName}> for <${tag}>`);
        this.expect('>');
        const end = this.index;
        return {
          tag,
          id,
          text: text.join(''),
          children,
          outerSpan: { start, end },
          startTagSpan,
          nameSpan,
        };
      }
      if (this.startsWith('<!--')) {
        this.skipComment();
        continue;
      }
      if (this.startsWith('<![CDATA[')) {
        text.push(this.readCdata());
        continue;
      }
      if (this.startsWith('<?')) {
        this.skipProcessingInstruction();
        continue;
      }
      if (this.startsWith('<!')) this.fail('unsupported markup declaration inside an element');
      children.push(this.parseElement());
    }
  }

  private parseStartTag(tag: string): StartTag {
    let id: string | undefined;
    for (;;) {
      this.skipWhitespace();
      if (this.index >= this.source.length) this.fail(`unterminated start tag <${tag}>`);
      if (this.startsWith('/>')) {
        this.index += 2;
        return { id, selfClosing: true };
      }
      if (this.source[this.index] === '>') {
        this.index += 1;
        return { id, selfClosing: false };
      }
      const name = this.readAttributeName();
      this.skipWhitespace();
      if (this.source[this.index] !== '=') this.fail(`attribute ${name} has no value`);
      this.index += 1;
      this.skipWhitespace();
      const value = this.readAttributeValue(name);
      if (name === 'id') id = value;
    }
  }

  private readAttributeValue(name: string): string {
    const quote = this.source[this.index];
    if (quote === '"' || quote === "'") {
      const start = this.index + 1;
      const end = this.source.indexOf(quote, start);
      if (end < 0) this.fail(`unterminated value for attribute ${name}`);
      this.index = end + 1;
      return this.source.slice(start, end);
    }
    const start = this.index;
    while (this.index < this.source.length) {
      const character = this.source[this.index]!;
      if (/\s/.test(character) || character === '>' || character === '/') break;
      this.index += 1;
    }
    if (this.index === start) this.fail(`empty value for attribute ${name}`);
    return this.source.slice(start, this.index);
  }

  private readAttributeName(): string {
    const start = this.index;
    while (this.index < this.source.length) {
      const character = this.source[this.index]!;
      if (/\s/.test(character)) break;
      if (character === '=' || character === '/' || character === '>' || character === '<') break;
      this.index += 1;
    }
    if (this.index === start) this.fail('expected an attribute name');
    return this.source.slice(start, this.index);
  }

  private readName(what: string): string {
    const start = this.index;
    while (this.index < this.source.length) {
      const character = this.source[this.index]!;
      if (/\s/.test(character)) break;
      if (
        character === '<' ||
        character === '>' ||
        character === '/' ||
        character === '=' ||
        character === '"' ||
        character === "'"
      )
        break;
      this.index += 1;
    }
    if (this.index === start) this.fail(`expected ${what}`);
    return this.source.slice(start, this.index);
  }

  private skipMisc(allowDoctype: boolean): void {
    for (;;) {
      this.skipWhitespace();
      if (this.startsWith('<!--')) {
        this.skipComment();
        continue;
      }
      if (this.startsWith('<?')) {
        this.skipProcessingInstruction();
        continue;
      }
      if (allowDoctype && this.startsWith('<!DOCTYPE')) {
        this.skipDoctype();
        continue;
      }
      return;
    }
  }

  private skipComment(): void {
    const end = this.source.indexOf('-->', this.index + 4);
    if (end < 0) this.fail('unterminated comment');
    this.index = end + 3;
  }

  private skipProcessingInstruction(): void {
    const end = this.source.indexOf('?>', this.index + 2);
    if (end < 0) this.fail('unterminated processing instruction');
    this.index = end + 2;
  }

  private skipDoctype(): void {
    let depth = 0;
    let quote: string | undefined;
    for (let cursor = this.index + 9; cursor < this.source.length; cursor++) {
      const character = this.source[cursor]!;
      if (quote) {
        if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === '[') depth += 1;
      if (character === ']') depth = Math.max(0, depth - 1);
      if (character === '>' && depth === 0) {
        this.index = cursor + 1;
        return;
      }
    }
    this.fail('unterminated document type declaration');
  }

  private readCdata(): string {
    const start = this.index + 9;
    const end = this.source.indexOf(']]>', start);
    if (end < 0) this.fail('unterminated CDATA section');
    this.index = end + 3;
    return this.source.slice(start, end);
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index]!)) this.index += 1;
  }

  private expect(character: string): void {
    if (this.source[this.index] !== character) this.fail(`expected '${character}'`);
    this.index += 1;
  }

  private startsWith(value: string): boolean {
    return this.source.startsWith(value, this.index);
  }

  private fail(message: string): never {
    throw new Error(`invalid SVG syntax at offset ${this.index}: ${message}`);
  }
}
