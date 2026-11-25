import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeEditAction,
  AttributeEditingService,
  AttributeHandlerRegistry,
  CreateAction,
  EditorSession,
  FakeFileStore,
  FakeSvgCodec,
  SvgDocument,
} from '@svgframe/core';
import { BoxAttributeHandler, BoxShape } from '../index.js';
import { TestLeafShape } from './TestLeafShape.js';
import { TestShapeService } from './TestShapeService.js';

const PARAMETERS = ['120', '100', '160', '60', '开始'];

function scene(): { document: SvgDocument; box: BoxShape } {
  const service = new TestShapeService();
  const document = new SvgDocument(800, 600);
  const created = service.create({ type: 'box', id: 'n1', parameters: PARAMETERS });
  assert.ok(created instanceof BoxShape);
  document.add(created);
  return { document, box: created };
}

test('handles is a pure query that claims only box fill and label', () => {
  const { document, box } = scene();
  const handler = new BoxAttributeHandler();
  const before = JSON.stringify({
    box: box.attributes(),
    rect: box.rect().attributes(),
    label: box.label().textContent(),
  });
  assert.equal(handler.handles(box, 'fill'), true);
  assert.equal(handler.handles(box, 'label'), true);
  assert.equal(handler.handles(box, 'stroke'), false);
  assert.equal(handler.handles(box, 'x'), false);
  assert.equal(
    JSON.stringify({
      box: box.attributes(),
      rect: box.rect().attributes(),
      label: box.label().textContent(),
    }),
    before,
  );
  const rect = document.require('n1-rect');
  assert.equal(handler.handles(rect, 'fill'), false);
  assert.equal(handler.handles(rect, 'label'), false);
});

test('apply propagates fill to the inner rect and label to the inner text', () => {
  const { document, box } = scene();
  const handler = new BoxAttributeHandler();
  const fill = handler.apply({ document }, { targetId: 'n1', attribute: 'fill', value: '#f5a623' });
  assert.deepEqual(fill, { message: 'box#n1 fill propagated to n1-rect' });
  assert.equal(box.rect().attributes().fill, '#f5a623');
  assert.equal(box.attributes().fill, undefined, 'the container itself stays unstyled');
  assert.equal(box.label().textContent(), '开始');
  const label = handler.apply(
    { document },
    { targetId: 'n1', attribute: 'label', value: '处理数据 v2' },
  );
  assert.deepEqual(label, { message: 'box#n1 label updated: "处理数据 v2"' });
  assert.equal(box.label().textContent(), '处理数据 v2');
  assert.equal(box.rect().attributes().fill, '#f5a623');
});

test('the handler refuses non-box targets and unknown attributes when called directly', () => {
  const { document } = scene();
  const handler = new BoxAttributeHandler();
  assert.throws(
    () => handler.apply({ document }, { targetId: 'n1', attribute: 'stroke', value: 'red' }),
    /unknown attribute: stroke/,
  );
  const other = new SvgDocument();
  other.add(new TestLeafShape('r', 'rect'));
  assert.throws(
    () => handler.apply({ document: other }, { targetId: 'r', attribute: 'fill', value: 'red' }),
    /not a box: r/,
  );
});

test('a label on a non-box shape falls back to the default whitelist error', () => {
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new BoxAttributeHandler());
  const service = new AttributeEditingService(handlers);
  const document = new SvgDocument();
  document.add(new TestLeafShape('r', 'rect'));
  assert.throws(
    () => service.apply(document, { targetId: 'r', attribute: 'label', value: 'x' }),
    /unknown attribute: label/,
  );
  const message = service.apply(document, { targetId: 'r', attribute: 'fill', value: 'red' });
  assert.equal(message, 'rect#r updated: fill="red"');
});

test('fill and label are each one undo unit and redo restores the change', () => {
  const shapes = new TestShapeService();
  const handlers = new AttributeHandlerRegistry();
  handlers.register(new BoxAttributeHandler());
  const editing = new AttributeEditingService(handlers);
  const session = new EditorSession(new FakeFileStore(), new FakeSvgCodec());
  session.init(800, 600);
  session.edit(new CreateAction(shapes, 'box', 'n1', PARAMETERS));
  const box = session.document().require('n1') as BoxShape;
  assert.equal(box.rect().attributes().fill, '#4a90d9');

  const fill = session.edit(
    new AttributeEditAction(editing, { targetId: 'n1', attribute: 'fill', value: '#f5a623' }),
  );
  assert.equal(fill, 'box#n1 fill propagated to n1-rect');
  assert.equal((session.document().require('n1') as BoxShape).rect().attributes().fill, '#f5a623');
  assert.equal(session.undo(), 'undone: box#n1 fill propagated to n1-rect');
  assert.equal((session.document().require('n1') as BoxShape).rect().attributes().fill, '#4a90d9');
  assert.equal(session.redo(), 'redone: box#n1 fill propagated to n1-rect');
  assert.equal((session.document().require('n1') as BoxShape).rect().attributes().fill, '#f5a623');

  const label = session.edit(
    new AttributeEditAction(editing, {
      targetId: 'n1',
      attribute: 'label',
      value: '处理数据 v2',
    }),
  );
  assert.equal(label, 'box#n1 label updated: "处理数据 v2"');
  assert.equal((session.document().require('n1') as BoxShape).label().textContent(), '处理数据 v2');
  assert.equal(session.undo(), 'undone: box#n1 label updated: "处理数据 v2"');
  assert.equal((session.document().require('n1') as BoxShape).label().textContent(), '开始');
  assert.equal(session.redo(), 'redone: box#n1 label updated: "处理数据 v2"');
  assert.equal((session.document().require('n1') as BoxShape).label().textContent(), '处理数据 v2');
});
