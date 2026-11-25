import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AddToAction,
  AttributeEditAction,
  AttributeEditingService,
  AttributeHandlerRegistry,
  CreateAction,
  DeleteAction,
  EditAction,
  EditorSession,
  FakeFileStore,
  FakeSvgCodec,
  GroupAction,
  StructureService,
  TreeDecoratorRegistry,
  TreePresenter,
  UngroupAction,
} from '@svgframe/core';
import { BoxAttributeHandler, BoxShape, BoxTypeLabelDecorator } from '../index.js';
import { TestShapeService } from './TestShapeService.js';
import type { ReadonlyDocument, ReadonlyShape, SvgDocument } from '@svgframe/core';

class MoveAction extends EditAction {
  constructor(
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    candidate.require(this.id).move(this.dx, this.dy);
    return `${this.id} moved`;
  }
}

class ScaleAction extends EditAction {
  constructor(
    private readonly id: string,
    private readonly factor: number,
  ) {
    super();
  }
  override apply(candidate: SvgDocument): string {
    candidate.require(this.id).scale(this.factor);
    return `${this.id} scaled`;
  }
}

function snapshot(document: ReadonlyDocument): string {
  const rows: string[] = [];
  const visit = (shape: ReadonlyShape, depth: number): void => {
    const attributes = Object.entries(shape.attributes())
      .map(([name, value]) => `${name}=${value}`)
      .join(',');
    rows.push(`${'  '.repeat(depth)}${shape.tag}#${shape.id}[${shape.kind}] ${attributes}`);
    shape.children().forEach((child) => visit(child, depth + 1));
  };
  document.root.children().forEach((child) => visit(child, 0));
  rows.push(`canvas ${document.width}x${document.height}`);
  return rows.join('\n');
}

function scene(): {
  session: EditorSession;
  shapes: TestShapeService;
  structure: StructureService;
  attributes: AttributeEditingService;
} {
  const shapes = new TestShapeService();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new BoxAttributeHandler());
  const session = new EditorSession(new FakeFileStore(), new FakeSvgCodec());
  session.init(800, 600);
  session.edit(new CreateAction(shapes, 'box', 'n1', ['120', '100', '160', '60', '开始']));
  session.edit(new CreateAction(shapes, 'box', 'n2', ['130', '110', '80', '30', '内层'], 'n1'));
  return {
    session,
    shapes,
    structure: new StructureService(),
    attributes: new AttributeEditingService(handlers),
  };
}

function box(document: ReadonlyDocument, id: string): BoxShape {
  const shape = document.require(id);
  assert.ok(shape instanceof BoxShape);
  return shape;
}

test('create, in-clause nesting and the tree label reproduce the box shape', () => {
  const { session } = scene();
  const n1 = box(session.document(), 'n1');
  assert.deepEqual(
    n1.children().map((child) => child.id),
    ['n1-rect', 'n1-label', 'n2'],
  );
  const n2 = box(session.document(), 'n2');
  assert.equal(n2.parent, n1);
  assert.equal(n2.label().textContent(), '内层');
  const decorators = new TreeDecoratorRegistry();
  decorators.register(new BoxTypeLabelDecorator());
  assert.deepEqual(new TreePresenter(decorators).tree(session.document()), [
    'svg (800x600)',
    '└── g#n1 (box)',
    '    ├── rect#n1-rect',
    '    ├── text#n1-label',
    '    └── g#n2 (box)',
    '        ├── rect#n2-rect',
    '        └── text#n2-label',
  ]);
});

test('move and scale operate on the whole box and stay single undo units', () => {
  const { session } = scene();
  const before = snapshot(session.document());
  session.edit(new MoveAction('n2', 10, 20));
  assert.deepEqual(box(session.document(), 'n2').rect().geometry(), {
    x: '140',
    y: '130',
    width: '80',
    height: '30',
  });
  session.undo();
  assert.equal(snapshot(session.document()), before);
  session.redo();
  assert.equal(box(session.document(), 'n2').rect().geometry().x, '140');

  session.edit(new ScaleAction('n1', 2));
  assert.deepEqual(box(session.document(), 'n1').rect().geometry(), {
    x: '240',
    y: '200',
    width: '320',
    height: '120',
  });
  session.undo();
  assert.equal(box(session.document(), 'n1').rect().geometry().x, '120');
});

test('fill and label edits are one undo unit each and keep nested structure', () => {
  const { session, attributes } = scene();
  session.edit(
    new AttributeEditAction(attributes, { targetId: 'n2', attribute: 'fill', value: '#f5a623' }),
  );
  assert.equal(box(session.document(), 'n2').rect().attributes().fill, '#f5a623');
  session.undo();
  assert.equal(box(session.document(), 'n2').rect().attributes().fill, '#4a90d9');
  session.redo();
  assert.equal(box(session.document(), 'n2').rect().attributes().fill, '#f5a623');

  session.edit(
    new AttributeEditAction(attributes, {
      targetId: 'n1',
      attribute: 'label',
      value: '处理数据 v2',
    }),
  );
  assert.equal(box(session.document(), 'n1').label().textContent(), '处理数据 v2');
  session.undo();
  assert.equal(box(session.document(), 'n1').label().textContent(), '开始');
  session.redo();
  assert.equal(box(session.document(), 'n1').label().textContent(), '处理数据 v2');
  assert.equal(box(session.document(), 'n2').parent?.id, 'n1');
});

test('boxes can be grouped while their necessary parts cannot be split off', () => {
  const { session, structure } = scene();
  assert.equal(
    session.edit(new GroupAction(structure, 'flow', ['n1'])),
    'g#flow created with 1 children',
  );
  assert.equal(box(session.document(), 'n1').parent?.id, 'flow');
  const grouped = snapshot(session.document());
  session.undo();
  assert.equal(box(session.document(), 'n1').parent?.id, 'canvas');
  session.redo();
  assert.equal(snapshot(session.document()), grouped);

  for (const action of [
    new GroupAction(structure, 'bad', ['n1-rect']),
    new AddToAction(structure, 'n1', 'n1-rect'),
    new DeleteAction(structure, 'n1-rect'),
    new UngroupAction(structure, 'n1'),
  ]) {
    assert.throws(() => session.edit(action));
    assert.equal(snapshot(session.document()), grouped, 'a rejected action keeps the document');
  }
  assert.throws(() => session.edit(new UngroupAction(structure, 'n1')), /cannot ungroup box: n1/);
  assert.throws(
    () => session.edit(new DeleteAction(structure, 'n1-rect')),
    /cannot remove necessary part: n1-rect/,
  );
  assert.throws(
    () => session.edit(new AddToAction(structure, 'n1', 'n1-rect')),
    /cannot move necessary part: n1-rect/,
  );
  assert.equal(session.undo(), 'undone: g#flow created with 1 children');
});

test('deleting the whole box is allowed, including nested boxes, and undo restores it', () => {
  const { session, shapes, structure } = scene();
  session.edit(new CreateAction(shapes, 'rect', 'extra', ['0', '0', '5', '5'], 'n1'));
  assert.equal(session.edit(new DeleteAction(structure, 'n1')), 'g#n1 deleted');
  assert.equal(session.document().find('n1'), undefined);
  assert.equal(session.document().find('n2'), undefined);
  assert.equal(session.document().find('extra'), undefined);
  session.undo();
  const restored = box(session.document(), 'n1');
  assert.deepEqual(
    restored.children().map((child) => child.id),
    ['n1-rect', 'n1-label', 'n2', 'extra'],
  );
  assert.equal(box(session.document(), 'n2').label().textContent(), '内层');
});

test('extra children can be removed while the necessary parts stay protected', () => {
  const { session, shapes, structure } = scene();
  session.edit(new CreateAction(shapes, 'rect', 'extra', ['0', '0', '5', '5'], 'n1'));
  assert.equal(session.edit(new DeleteAction(structure, 'extra')), 'rect#extra deleted');
  assert.equal(
    box(session.document(), 'n1')
      .children()
      .some((child) => child.id === 'extra'),
    false,
  );
  session.undo();
  assert.equal(
    box(session.document(), 'n1')
      .children()
      .some((child) => child.id === 'extra'),
    true,
  );
});
