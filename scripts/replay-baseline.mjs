import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { cli: { type: 'string' }, capture: { type: 'string' } } });
const entry = path.resolve(values.cli ?? path.join(root, 'dist/src/bootstrap/main.js'));
const expected = path.join(root, 'test/fixtures/expected');
const capture = values.capture && path.resolve(values.capture);
if (capture) await mkdir(capture); // Refuse to overwrite an existing set of reference bytes.
const cases = [
  { name: 'cli-1', inputs: ['other.svg'], outputs: ['demo.svg'] },
  { name: 'flowchart-a', inputs: [], outputs: ['flowchart.svg'] },
  { name: 'errors-and-history', inputs: [], outputs: [] },
];

for (const { name, inputs, outputs } of cases) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'svg-replay-'));
  try {
    for (const file of inputs)
      await copyFile(path.join(root, 'examples', file), path.join(cwd, file));
    const input = await readFile(path.join(root, 'doc/transcript', name + '.txt'));
    const result = spawnSync(process.execPath, [entry], { cwd, input });
    if (result.error) throw result.error;
    assert.equal(result.signal, null, name + ': CLI terminated by signal');
    const artifacts = new Map([
      ['stdout.txt', result.stdout],
      ['stderr.txt', result.stderr],
      ['exit-code.txt', Buffer.from(String(result.status) + '\n')],
    ]);
    for (const file of outputs) artifacts.set(file, await readFile(path.join(cwd, file)));
    if (capture) await mkdir(path.join(capture, name));
    for (const [file, bytes] of artifacts) {
      if (capture) await writeFile(path.join(capture, name, file), bytes);
      else
        assert.deepEqual(bytes, await readFile(path.join(expected, name, file)), name + '/' + file);
    }
    console.log(name + ': ' + artifacts.size + ' artifacts, CLI exit ' + result.status);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
