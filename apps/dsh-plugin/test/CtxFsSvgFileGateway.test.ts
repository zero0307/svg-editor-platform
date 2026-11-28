import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CtxFsSvgFileGateway } from '../src/CtxFsSvgFileGateway.js';

test('stat, read and write receive the original host-resolved target', async () => {
  const hostTarget = { displayPath: 'diagram.svg', handle: Symbol('file') };
  const gateway = new CtxFsSvgFileGateway({
    resolve: async () => hostTarget,
    stat: async (target) => {
      assert.strictEqual(target, hostTarget);
      return { size: 6 };
    },
    readText: async (target) => {
      assert.strictEqual(target, hostTarget);
      return '<svg/>';
    },
    writeText: async (target, content) => {
      assert.strictEqual(target, hostTarget);
      assert.equal(content, '<svg/>');
    },
  });
  const target = await gateway.resolve('diagram.svg');
  assert.deepEqual(await gateway.stat(target), { size: 6 });
  const content = await gateway.readText(target);
  await gateway.writeText(target, content);
});
