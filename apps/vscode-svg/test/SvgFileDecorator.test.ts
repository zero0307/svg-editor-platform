import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgFileDecorator } from '../src/SvgFileDecorator.js';
import type { DecoratedFile, DecoratedFileType } from '../src/DecoratedFile.js';

const decorator = new SvgFileDecorator();

const file = (
  fsPath: string,
  fileType: DecoratedFileType = 'file',
  scheme = 'file',
): DecoratedFile => ({
  fsPath,
  scheme,
  fileType,
});

test('marks regular SVG files with the empty bracket badge', () => {
  for (const fsPath of [
    '/work/canvas.svg',
    '/work/CANVAS.SVG',
    '/work/archive.2026.svg',
    'C:\\work\\canvas.svg',
  ]) {
    assert.deepEqual(
      decorator.decide(file(fsPath)),
      { badge: '[]', tooltip: 'SVG document' },
      fsPath,
    );
  }
});

test('ignores non-SVG files and names without a real extension', () => {
  for (const fsPath of [
    '/work/notes.txt',
    '/work/canvas.svgz',
    '/work/README',
    '/work/svg',
    '/work/.svg',
    '/work/canvas.svg.bak',
  ]) {
    assert.equal(decorator.decide(file(fsPath)), undefined, fsPath);
  }
});

test('ignores directories whose name looks like an SVG file', () => {
  assert.equal(decorator.decide(file('/work/icons.svg', 'directory')), undefined);
});

test('ignores symlinks and other file types', () => {
  assert.equal(decorator.decide(file('/work/link.svg', 'link')), undefined);
  assert.equal(decorator.decide(file('/work/pipe.svg', 'other')), undefined);
});

test('ignores entries from non-file schemes', () => {
  for (const scheme of ['untitled', 'vscode-remote', 'git']) {
    assert.equal(decorator.decide(file('/work/canvas.svg', 'file', scheme)), undefined, scheme);
  }
});

test('handles hidden directories, spaces and non-ASCII paths', () => {
  for (const fsPath of [
    '/work/.hidden/canvas.svg',
    '/work/a folder/my canvas.svg',
    '/work/图形/画布.svg',
    '/work/emojis/🎨.svg',
  ]) {
    assert.equal(decorator.decide(file(fsPath))?.badge, '[]', fsPath);
  }
});

test('never throws for degenerate paths', () => {
  for (const fsPath of ['', '.', '..', 'svg', '.svg', 'canvas.', '/', 'C:\\']) {
    assert.doesNotThrow(() => decorator.decide(file(fsPath)));
    assert.equal(decorator.decide(file(fsPath)), undefined, fsPath);
  }
});
