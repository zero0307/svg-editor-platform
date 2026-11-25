import { SvgDocument } from '@svgframe/core';
import { TestContainer } from './TestContainer.js';
import { TestShape } from './TestShape.js';
import type { EditorEvent } from '@svgframe/core';

export function rect(id = 'r1', x = 0, y = 0, width = 10, height = 10): TestShape {
  return new TestShape(id, 'rect', { x, y, width, height });
}

export function label(id = 't1', text = 'hello'): TestShape {
  return new TestShape(id, 'text', { x: 0, y: 0 }, text, 'text');
}

export function group(id = 'g1'): TestContainer {
  return new TestContainer(id);
}

export function box(id = 'n1', caption = 'start'): TestContainer {
  const container = new TestContainer(id, 'box');
  container.preserveAttribute('data-kind', 'box');
  container.insert(new TestShape(`${id}-rect`, 'rect', { x: 0, y: 0, width: 100, height: 40 }));
  container.insert(new TestShape(`${id}-label`, 'text', { x: 10, y: 20 }, caption, 'text'));
  return container;
}

/** Baseline scene: g1[r1, r2], g2[t1]. */
export function scene(width = 800, height = 600): SvgDocument {
  const document = new SvgDocument(width, height);
  const left = group('g1');
  left.insert(rect('r1'));
  left.insert(rect('r2', 20));
  const right = group('g2');
  right.insert(label('t1'));
  document.add(left);
  document.add(right);
  return document;
}

export function initialized(document: SvgDocument): EditorEvent {
  return { type: 'documentInitialized', document };
}

export function edited(document: SvgDocument, message = 'edit'): EditorEvent {
  return { type: 'editCommitted', document, message };
}

export function undone(document: SvgDocument, message = 'undo'): EditorEvent {
  return { type: 'undoCommitted', document, message };
}

export function redone(document: SvgDocument, message = 'redo'): EditorEvent {
  return { type: 'redoCommitted', document, message };
}

export function saved(document: SvgDocument): EditorEvent {
  return { type: 'documentSaved', document, path: 'saved.svg' };
}

export function read(document: SvgDocument): EditorEvent {
  return { type: 'documentRead', document, path: 'read.svg', warnings: [] };
}

export function canvasChanged(document: SvgDocument): EditorEvent {
  return {
    type: 'canvasChanged',
    document,
    width: document.width,
    height: document.height,
    message: 'canvas',
  };
}
