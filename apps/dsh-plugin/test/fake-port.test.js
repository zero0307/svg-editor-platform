import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFakeEditorSession } from '../editor-session-port.js';

test('fake port reports the seeded document view', async () => {
  const session = createFakeEditorSession({ id: 'caller', rootId: 'root-1', elementCount: 7 });
  assert.equal(session.id, 'caller');
  assert.deepEqual(await session.inspectDocument(), { rootId: 'root-1', elementCount: 7 });
});

test('fake port can fail on purpose so callers can test the error path', async () => {
  const session = createFakeEditorSession({ fail: true });
  await assert.rejects(() => session.inspectDocument(), /failed on purpose/);
});

test('fake port observes cancellation and closes', async () => {
  const session = createFakeEditorSession();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => session.inspectDocument({ signal: controller.signal }));
  await session.close();
});
