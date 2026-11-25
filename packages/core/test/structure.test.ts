import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DeleteAction,
  Group,
  GroupAction,
  AddToAction,
  StructureService,
  SvgDocument,
  UngroupAction,
} from '../index.js';
import { createTestSession } from './support/TestSession.js';
import { FakeLeafShape } from './support/FakeLeafShape.js';
import { ProtectedBoxShape } from './support/ProtectedBoxShape.js';
import { RejectingGroup } from './support/RejectingGroup.js';

const structure = new StructureService();

const protectedDocument = (): SvgDocument => {
  const document = new SvgDocument();
  const box = new ProtectedBoxShape('box1');
  box.insert(new FakeLeafShape('box1-rect'));
  box.insert(new FakeLeafShape('box1-label'));
  box.insert(new FakeLeafShape('extra'));
  document.add(box);
  document.add(new FakeLeafShape('leaf'));
  return document;
};

const nestedGroupDocument = (): SvgDocument => {
  const document = new SvgDocument();
  const outer = new Group('outer');
  const inner = new Group('inner');
  inner.setAttribute('fill', 'red');
  inner.insert(new FakeLeafShape('r'));
  outer.insert(inner);
  outer.insert(new FakeLeafShape('other'));
  document.add(outer);
  return document;
};

const sessionWith = async (document: () => SvgDocument) => {
  const { session, files } = createTestSession({ documentFactory: document });
  files.files.set('doc.svg', 'source');
  await session.read('doc.svg');
  return { session, files };
};

test('delete removes a leaf as one undo unit', async () => {
  const { session } = await sessionWith(protectedDocument);
  assert.equal(session.edit(new DeleteAction(structure, 'leaf')), 'rect#leaf deleted');
  assert.throws(() => session.document().require('leaf'), /no such shape: leaf/);
  assert.equal(session.undo(), 'undone: rect#leaf deleted');
  assert.equal(session.document().require('leaf').id, 'leaf');
});

test('delete removes a whole composite subtree when its parent allows it', async () => {
  const { session } = await sessionWith(protectedDocument);
  assert.equal(session.edit(new DeleteAction(structure, 'box1')), 'demo-box#box1 deleted');
  assert.throws(() => session.document().require('box1'), /no such shape/);
  assert.throws(() => session.document().require('box1-rect'), /no such shape/);
  assert.equal(session.document().require('leaf').id, 'leaf');
});

test('delete rejects a necessary part and keeps document and history', async () => {
  const { session } = await sessionWith(protectedDocument);
  const events: string[] = [];
  session.events.subscribe((event) => events.push(event.type));
  assert.throws(
    () => session.edit(new DeleteAction(structure, 'box1-rect')),
    /cannot remove necessary part: box1-rect/,
  );
  assert.equal(session.document().require('box1-rect').id, 'box1-rect');
  assert.deepEqual(events, []);
});

test('addto moves an ordinary shape into a public container', async () => {
  const { session } = await sessionWith(() => {
    const document = new SvgDocument();
    document.add(new Group('g1'));
    document.add(new FakeLeafShape('leaf'));
    return document;
  });
  assert.equal(session.edit(new AddToAction(structure, 'g1', 'leaf')), 'rect#leaf added to g#g1');
  assert.equal(session.document().require('leaf').parent?.id, 'g1');
  session.undo();
  assert.equal(session.document().require('leaf').parent?.id, 'canvas');
});

test('moving a necessary part out of its composite is rejected', async () => {
  const { session } = await sessionWith(() => {
    const document = protectedDocument();
    document.add(new Group('target'));
    return document;
  });
  assert.throws(
    () => session.edit(new AddToAction(structure, 'target', 'box1-rect')),
    /cannot move necessary part: box1-rect/,
  );
  assert.equal(session.document().require('box1-rect').parent?.id, 'box1');
  assert.equal(session.document().require('target').children().length, 0);
});

test('group preserves document order and reports Phase 1 feedback', async () => {
  const { session } = await sessionWith(() => {
    const document = new SvgDocument();
    document.add(new FakeLeafShape('a'));
    document.add(new Group('g1'));
    document.add(new FakeLeafShape('b'));
    return document;
  });
  assert.equal(
    session.edit(new GroupAction(structure, 'pair', ['b', 'a'])),
    'g#pair created with 2 children',
  );
  assert.deepEqual(
    session
      .document()
      .require('pair')
      .children()
      .map((child) => child.id),
    ['a', 'b'],
  );
  session.undo();
  assert.throws(() => session.document().require('pair'), /no such shape/);
});

test('group rejects a necessary part before mutating the candidate', async () => {
  const { session } = await sessionWith(protectedDocument);
  assert.throws(
    () => session.edit(new GroupAction(structure, 'pair', ['box1-rect', 'leaf'])),
    /cannot move necessary part: box1-rect/,
  );
  assert.throws(() => session.document().require('pair'), /no such shape/);
  assert.equal(session.document().require('box1-rect').parent?.id, 'box1');
});

test('ungroup materializes inherited presentation and keeps child order', async () => {
  const { session } = await sessionWith(nestedGroupDocument);
  assert.equal(
    session.edit(new UngroupAction(structure, 'inner')),
    'g#inner ungrouped (1 children)',
  );
  assert.throws(() => session.document().require('inner'), /no such shape/);
  assert.equal(session.document().require('r').parent?.id, 'outer');
  assert.equal(session.document().require('r').attributes().fill, 'red');
  assert.deepEqual(
    session
      .document()
      .require('outer')
      .children()
      .map((child) => child.id),
    ['r', 'other'],
  );
  session.undo();
  assert.equal(session.document().require('inner').children().length, 1);
});

test('ungroup rejects a composite before the ordinary top-level restriction', async () => {
  const { session } = await sessionWith(protectedDocument);
  assert.throws(
    () => session.edit(new UngroupAction(structure, 'box1')),
    /cannot ungroup composite shape: box1/,
  );
  assert.equal(session.document().require('box1').kind, 'demo-box');
});

test('ungroup keeps the Phase 1 top-level restriction for ordinary groups', async () => {
  const { session } = await sessionWith(() => {
    const document = new SvgDocument();
    document.add(new Group('g1'));
    return document;
  });
  assert.throws(
    () => session.edit(new UngroupAction(structure, 'g1')),
    /cannot ungroup top-level container: g1/,
  );
  assert.equal(session.document().require('g1').id, 'g1');
});

test('a target container can reject an insertion through the public policy', async () => {
  const { session } = await sessionWith(() => {
    const document = new SvgDocument();
    document.add(new RejectingGroup('g1'));
    document.add(new FakeLeafShape('blocked'));
    return document;
  });
  assert.throws(
    () => session.edit(new AddToAction(structure, 'g1', 'blocked')),
    /cannot insert rect#blocked into g#g1/,
  );
  assert.equal(session.document().require('blocked').parent?.id, 'canvas');
});

test('structure failures keep the existing redo branch intact', async () => {
  const { session } = await sessionWith(protectedDocument);
  session.edit(new DeleteAction(structure, 'leaf'));
  session.undo();
  assert.throws(
    () => session.edit(new DeleteAction(structure, 'box1-rect')),
    /cannot remove necessary part/,
  );
  assert.equal(session.redo(), 'redone: rect#leaf deleted');
  assert.throws(() => session.document().require('leaf'), /no such shape/);
});
