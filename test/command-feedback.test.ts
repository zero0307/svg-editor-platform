import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateAction, DeleteAction, Group, StructureService, SvgDocument } from '@svgframe/core';
import {
  BackAction,
  FrontAction,
  MoveAction,
  Rect,
  ScaleAction,
  registerDefaultShapes,
} from '@svgframe/builtins';
import { ProviderShapeCreationService, ShapeProviderRegistry } from '@svgframe/core';

class CompositeFixture extends Group {
  override get kind(): string {
    return 'demo-box';
  }
  override creationParts(): readonly string[] {
    return [`g#${this.id}`];
  }
}

test('composite command feedback uses the domain kind, plain shapes keep P1 bytes', () => {
  const document = new SvgDocument();
  const rect = new Rect('r', 0, 0, 1, 1);
  document.add(rect);
  assert.equal(new MoveAction('r', 1, 2).apply(document), 'rect#r moved by (1,2): x=1 y=2 w=1 h=1');
  assert.equal(new ScaleAction('r', 2).apply(document), 'rect#r scaled by 2');
  assert.equal(new FrontAction('r').apply(document), 'rect#r moved to front');
  assert.equal(new BackAction('r').apply(document), 'rect#r moved to back');

  const composite = new CompositeFixture('n2');
  document.add(composite);
  assert.equal(new MoveAction('n2', 0, 100).apply(document), 'demo-box#n2 moved by (0,100)');
  assert.equal(new ScaleAction('n2', 2).apply(document), 'demo-box#n2 scaled by 2');
  assert.equal(new FrontAction('n2').apply(document), 'demo-box#n2 moved to front');
  assert.equal(new BackAction('n2').apply(document), 'demo-box#n2 moved to back');
});

test('default create/delete feedback keeps the Phase 1 bytes for six built-in shapes', () => {
  const providers = new ShapeProviderRegistry();
  registerDefaultShapes(providers);
  const shapes = new ProviderShapeCreationService(providers);
  const document = new SvgDocument();
  assert.equal(
    new CreateAction(shapes, 'rect', 'r', ['0', '0', '1', '1']).apply(document),
    'rect#r created',
  );
  assert.equal(new CreateAction(shapes, 'g', 'g1', []).apply(document), 'g#g1 created');
  assert.equal(new DeleteAction(new StructureService(), 'r').apply(document), 'rect#r deleted');
});
