import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttributeHandlerConflictError,
  AttributeHandlerRegistry,
  CommandRegistry,
  DuplicateRegistrationError,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '../index.js';
import type { AttributeHandler, ShapeProvider, TreeDecorator } from '../index.js';
import { DemoQueryCommand } from './support/DemoQueryCommand.js';

const provider = (type: string): ShapeProvider => ({
  type,
  create: () => {
    throw new Error('not used');
  },
  matches: () => false,
  restore: () => {
    throw new Error('not used');
  },
});

const decorator = (name: string): TreeDecorator => ({ name, decorate: () => null });

const handler = (name: string): AttributeHandler => ({
  name,
  handles: () => false,
  apply: () => ({}),
});

test('commands keep registration order and reject duplicate names', () => {
  const registry = new CommandRegistry();
  const first = new DemoQueryCommand('stats');
  registry.register(first);
  registry.register(new DemoQueryCommand('dir'));
  assert.deepEqual(registry.names(), ['stats', 'dir']);
  assert.deepEqual(
    registry.entries().map((command) => command.name),
    ['stats', 'dir'],
  );
  assert.equal(registry.size, 2);
  assert.equal(registry.require('stats'), first);
  assert.equal(registry.get('dir')?.name, 'dir');
  assert.equal(registry.has('missing'), false);
  assert.throws(
    () => registry.register(new DemoQueryCommand('stats')),
    (error: unknown) => {
      if (!(error instanceof DuplicateRegistrationError)) return false;
      assert.equal(error.kind, 'command');
      assert.equal(error.contributionName, 'stats');
      assert.match(error.message, /duplicate command registration: stats/);
      return true;
    },
  );
  assert.equal(registry.require('stats'), first);
  assert.deepEqual(registry.names(), ['stats', 'dir']);
});

test('unknown registration uses the Phase 1 command wording', () => {
  const registry = new CommandRegistry();
  assert.throws(() => registry.require('nope'), /unknown command: nope/);
  assert.equal(registry.get('nope'), undefined);
});

test('shape providers are keyed by domain type and keep the plugin hint', () => {
  const registry = new ShapeProviderRegistry();
  registry.register(provider('rect'));
  registry.register(provider('box'));
  assert.deepEqual(registry.names(), ['rect', 'box']);
  assert.throws(
    () => registry.require('circle'),
    /unknown shape type: circle \(is the plugin loaded\?\)/,
  );
  assert.throws(
    () => registry.register(provider('rect')),
    (error: unknown) =>
      error instanceof DuplicateRegistrationError && error.kind === 'shape provider',
  );
  assert.throws(
    () => registry.register(provider('has space')),
    /invalid shape provider registration name/,
  );
});

test('decorators and attribute handlers are keyed by stable names', () => {
  const decorators = new TreeDecoratorRegistry();
  decorators.register(decorator('box-type-label'));
  decorators.register(decorator('modified-star'));
  assert.deepEqual(decorators.names(), ['box-type-label', 'modified-star']);
  assert.throws(() => decorators.register(decorator('modified-star')), /duplicate tree decorator/);

  const handlers = new AttributeHandlerRegistry();
  handlers.register(handler('box-attributes'));
  assert.equal(handlers.require('box-attributes').name, 'box-attributes');
  assert.throws(
    () => handlers.register(handler('')),
    /invalid attribute handler registration name/,
  );
});

test('conflict error carries the competing handler names', () => {
  const error = new AttributeHandlerConflictError('box1', 'fill', ['a-attributes', 'b-attributes']);
  assert.equal(error.name, 'AttributeHandlerConflictError');
  assert.deepEqual(error.handlers, ['a-attributes', 'b-attributes']);
  assert.match(
    error.message,
    /ambiguous attribute handlers for box1\.fill: a-attributes, b-attributes/,
  );
});
