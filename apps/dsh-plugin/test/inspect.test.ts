import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SvgInspector } from '../src/SvgInspector.js';
import { SvgRuntime } from '../src/SvgRuntime.js';
import { FakeSvgFileGateway } from './FakeSvgFileGateway.js';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect id="a" x="10" y="20" width="100" height="50" fill="#ffffff"/>
  <text id="b" x="20" y="40" fill="#000000">hello</text>
  <line id="c" x1="0" y1="0" x2="10" y2="10" stroke="#000000"/>
</svg>
`;

const gatewayWith = (path: string, content: string): FakeSvgFileGateway => {
  const gateway = new FakeSvgFileGateway();
  gateway.files.set(path, content);
  return gateway;
};

test('inspection reports canvas, element count, stable kinds and root children', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  const first = await inspector.inspect('sample.svg', gatewayWith('sample.svg', SAMPLE));

  assert.equal(first.path, 'sample.svg');
  assert.equal(first.width, 800);
  assert.equal(first.height, 600);
  assert.equal(first.elements, 3);
  assert.deepEqual(first.kinds, { rect: 1, line: 1, text: 1 });
  assert.deepEqual(first.rootChildren, ['a', 'b', 'c']);
});

test('two inspections of the same file return the same projection', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  const gateway = gatewayWith('sample.svg', SAMPLE);

  const first = await inspector.inspect('sample.svg', gateway);
  const second = await inspector.inspect('sample.svg', gateway);
  assert.deepEqual(first, second);
});

test('a missing file fails clearly', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  await assert.rejects(
    () => inspector.inspect('missing.svg', new FakeSvgFileGateway()),
    /file not found: missing\.svg/,
  );
});

test('an empty path fails clearly', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  await assert.rejects(() => inspector.inspect('  ', new FakeSvgFileGateway()), /path must be/);
});

test('read failure surfaces and a later inspection still works', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  const gateway = gatewayWith('sample.svg', SAMPLE);
  gateway.failRead = true;

  await assert.rejects(() => inspector.inspect('sample.svg', gateway), /cannot read file/);
  gateway.failRead = false;
  const result = await inspector.inspect('sample.svg', gateway);
  assert.equal(result.elements, 3);
});

test('inspection does not modify the file', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  const gateway = gatewayWith('sample.svg', SAMPLE);
  await inspector.inspect('sample.svg', gateway);
  assert.equal(gateway.files.get('sample.svg'), SAMPLE);
});

test('an aborted signal stops before reading', async () => {
  const inspector = new SvgInspector(SvgRuntime.create());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => inspector.inspect('sample.svg', gatewayWith('sample.svg', SAMPLE), controller.signal),
    /aborted/,
  );
});

test('inspection observes cancellation during the read before decoding', async () => {
  const controller = new AbortController();
  const gateway = gatewayWith('sample.svg', SAMPLE);
  gateway.readText = async () => {
    controller.abort();
    return 'incomplete xml';
  };
  await assert.rejects(
    new SvgInspector(SvgRuntime.create()).inspect('sample.svg', gateway, controller.signal),
    { name: 'AbortError' },
  );
});
