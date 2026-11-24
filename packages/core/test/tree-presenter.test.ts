import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError, Group, SvgDocument, TreeDecoratorRegistry, TreePresenter } from '../index.js';
import { createTestSession } from './support/TestSession.js';
import { CountingAction } from './support/CountingAction.js';
import { GoldenShape } from './support/GoldenShape.js';

/*
 * Expected strings were produced by running the Phase 1 `ShapePresenter` against
 * an equivalent fixture (rect#bg, text#title, g#markers > circle#c1, rect#box).
 */
const TREE = [
  'svg (800x600)',
  '├── rect#bg  x=0 y=0 w=800 h=600 fill=#ffffff',
  '├── text#title  (20,40) "My Diagram"',
  '└── g#markers',
  '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
  '    └── rect#box  x=200 y=80 w=60 h=60 fill=#3366ff',
];
const TREE_MARKERS = [
  'g#markers',
  '├── circle#c1  cx=100 cy=100 r=20 fill=red',
  '└── rect#box  x=200 y=80 w=60 h=60 fill=#3366ff',
];
const SHOW_TITLE = ['text#title  parent=svg', '  x=20', '  y=40', '  text="My Diagram"'];
const SHOW_C1 = ['circle#c1  parent=g#markers', '  cx=100', '  cy=100', '  r=20', '  fill=red'];
const SHOW_MARKERS = ['g#markers  parent=svg', '  children=c1, box'];
const SHOW_BG = [
  'rect#bg  parent=svg',
  '  x=0',
  '  y=0',
  '  width=800',
  '  height=600',
  '  fill=#ffffff',
];

const fixture = (): SvgDocument => {
  const document = new SvgDocument();
  const background = new GoldenShape(
    'bg',
    'rect',
    { x: '0', y: '0', width: '800', height: '600', fill: '#ffffff' },
    'x=0 y=0 w=800 h=600 fill=#ffffff',
  );
  const title = new GoldenShape(
    'title',
    'text',
    { x: '20', y: '40' },
    '(20,40) "My Diagram"',
    'My Diagram',
  );
  const markers = new Group('markers');
  markers.insert(
    new GoldenShape(
      'c1',
      'circle',
      { cx: '100', cy: '100', r: '20', fill: 'red' },
      'cx=100 cy=100 r=20 fill=red',
    ),
  );
  markers.insert(
    new GoldenShape(
      'box',
      'rect',
      { x: '200', y: '80', width: '60', height: '60', fill: '#3366ff' },
      'x=200 y=80 w=60 h=60 fill=#3366ff',
    ),
  );
  document.add(background);
  document.add(title);
  document.add(markers);
  return document;
};

test('zero decorators reproduce the Phase 1 tree/show bytes', () => {
  const document = fixture();
  const presenter = new TreePresenter(new TreeDecoratorRegistry());
  assert.deepEqual(presenter.tree(document), TREE);
  assert.deepEqual(presenter.tree(document, 'markers'), TREE_MARKERS);
  assert.deepEqual(presenter.show(document, 'title'), SHOW_TITLE);
  assert.deepEqual(presenter.show(document, 'c1'), SHOW_C1);
  assert.deepEqual(presenter.show(document, 'markers'), SHOW_MARKERS);
  assert.deepEqual(presenter.show(document, 'bg'), SHOW_BG);
  assert.deepEqual(presenter.tree(new SvgDocument()), ['svg (800x600)']);
  for (const line of presenter.tree(document)) assert.equal(line, line.trimEnd());
  assert.throws(() => presenter.tree(document, 'missing'), /no such shape: missing/);
});

test('suffixes are appended in registration order after one space', () => {
  const document = fixture();
  const registry = new TreeDecoratorRegistry();
  registry.register({
    name: 'first-label',
    decorate: (row) => (row.node.id === 'markers' ? '(group)' : null),
  });
  registry.register({
    name: 'second-label',
    decorate: (row) => (row.node.id === 'markers' ? '*' : ''),
  });
  registry.register({
    name: 'bg-label',
    decorate: (row) => (row.node.id === 'bg' ? '#' : '   '),
  });
  const presenter = new TreePresenter(registry);
  const expected = TREE.map((line) => {
    if (line.includes('#markers')) return `${line} (group) *`;
    if (line.includes('#bg')) return `${line} #`;
    return line;
  });
  assert.deepEqual(presenter.tree(document), expected);
  assert.deepEqual(presenter.show(document, 'markers')[0], 'g#markers  parent=svg (group) *');
});

test('a decorator can mark the root row and empty documents', () => {
  const registry = new TreeDecoratorRegistry();
  registry.register({
    name: 'root-label',
    decorate: (row) => (row.depth === 0 && row.node.id === 'canvas' ? '*' : null),
  });
  const presenter = new TreePresenter(registry);
  assert.equal(presenter.tree(fixture())[0], 'svg (800x600) *');
  assert.deepEqual(presenter.tree(new SvgDocument()), ['svg (800x600) *']);
});

test('a failing decorator is reported, disabled, and other suffixes continue', () => {
  const document = fixture();
  const failures: string[] = [];
  const registry = new TreeDecoratorRegistry();
  registry.register({ name: 'star', decorate: () => '★' });
  registry.register({
    name: 'broken',
    decorate: () => {
      throw new DomainError('decorator broke');
    },
  });
  registry.register({ name: 'hash', decorate: () => '#' });
  const presenter = new TreePresenter(registry, (error, name) => {
    failures.push(`${name}:${String((error as Error).message)}`);
  });
  const expected = TREE.map((line) => `${line} ★ #`);
  assert.deepEqual(presenter.tree(document), expected);
  assert.equal(presenter.isDisabled('broken'), true);
  assert.deepEqual(presenter.disabledNames(), ['broken']);
  assert.deepEqual(failures, ['broken:decorator broke']);
  assert.deepEqual(presenter.tree(document), expected);
  assert.equal(failures.length, 1);
});

test('display failures never mutate the document', () => {
  const document = fixture();
  const before = JSON.stringify(
    document.all().map((shape) => [shape.id, shape.attributes(), shape.textContent()]),
  );
  const registry = new TreeDecoratorRegistry();
  registry.register({
    name: 'broken',
    decorate: () => {
      throw new DomainError('decorator broke');
    },
  });
  new TreePresenter(registry).tree(document);
  assert.equal(
    JSON.stringify(
      document.all().map((shape) => [shape.id, shape.attributes(), shape.textContent()]),
    ),
    before,
  );
});

test('two presenter instances keep independent disabled state', () => {
  const document = fixture();
  const registry = new TreeDecoratorRegistry();
  registry.register({
    name: 'broken',
    decorate: () => {
      throw new DomainError('decorator broke');
    },
  });
  const first = new TreePresenter(registry);
  const second = new TreePresenter(registry);
  assert.deepEqual(first.tree(document), TREE);
  assert.equal(first.isDisabled('broken'), true);
  assert.equal(second.isDisabled('broken'), false);
  assert.deepEqual(second.tree(document), TREE);
  assert.equal(second.isDisabled('broken'), true);
});

test('committed events reach decorators and a failing observer is disabled', () => {
  const { session } = createTestSession();
  const seen: string[] = [];
  const failures: string[] = [];
  const registry = new TreeDecoratorRegistry();
  registry.register({
    name: 'recorder',
    decorate: () => null,
    onEvent: (event) => seen.push(event.type),
  });
  registry.register({
    name: 'broken-event',
    decorate: () => null,
    onEvent: () => {
      throw new DomainError('event observer broke');
    },
  });
  const presenter = new TreePresenter(registry, (error, name) =>
    failures.push(`${name}:${String((error as Error).message)}`),
  );
  const detach = presenter.connect(session.events);
  assert.throws(() => presenter.connect(session.events), /already connected/);
  session.init();
  session.edit(new CountingAction());
  assert.deepEqual(seen, ['documentInitialized', 'editCommitted']);
  assert.deepEqual(failures, ['broken-event:event observer broke']);
  assert.equal(presenter.isDisabled('broken-event'), true);
  assert.equal(session.undo(), 'undone: counted edit');
  detach();
  session.redo();
  assert.deepEqual(seen, ['documentInitialized', 'editCommitted', 'undoCommitted']);
});

test('a third decorator needs no renderer change', () => {
  const document = fixture();
  const registry = new TreeDecoratorRegistry();
  const presenter = new TreePresenter(registry);
  assert.deepEqual(presenter.tree(document), TREE);
  registry.register({ name: 'third-label', decorate: () => '⊕' });
  assert.deepEqual(
    presenter.tree(document),
    TREE.map((line) => `${line} ⊕`),
  );
});
