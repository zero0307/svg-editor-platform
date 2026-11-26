import React from 'react';
import { createRoot } from 'react-dom/client';
import source from '../demo/dense-connectors.svg';
import native from '../../../doc/evidence/dsh/presentation/cross-attention.svg';
let plugin;
window.__ModuleLoader__ = {
  load(row) {
    plugin = row.factory(() => React);
  },
};
require('../dist/client.js');
let Preview;
plugin.apply({
  effect: (f) => f(),
  documentPreviews: { register() {} },
  slots: {
    inject: (n, f) => f(),
    register: (d, r) => {
      Preview = r;
    },
  },
});
// Minimal host composer; the preview, React rendering and SVG hit testing are real.
let snapshot = { text: '保留这段草稿 🖋 ', references: [], quotes: [] },
  subs = new Set();
const update = (s) => {
  snapshot = s;
  for (const f of subs) f();
};
const input = {
  get draftSnapshot() {
    return snapshot;
  },
  state: {
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getSnapshot: () => ({ phase: 'plain' }),
  },
  setDraft: update,
  focus() {},
  insertQuote(text, summary) {
    const raw = '> ' + text.replaceAll('\n', '\n> ');
    update({
      ...snapshot,
      text: snapshot.text + raw + ' ',
      quotes: [
        ...snapshot.quotes,
        { text, summary, offset: snapshot.text.length, length: raw.length },
      ],
    });
    return true;
  },
};
let saved, saveMode, finishSave;
const savedCopy = new Promise((resolve) => {
  finishSave = resolve;
});
const fileActions = {
  canSaveAs: true,
  async save(source, mode) {
    saved = await (await source.read()).text();
    saveMode = mode;
    finishSave();
    return { status: 'saved', path: source.name };
  },
};
const pick = () => snapshot.quotes[0]?.summary.detail;
const data = () => JSON.parse(snapshot.quotes[0].text.split('\n')[0].slice('SVG 选区 '.length));
const root = createRoot(document.querySelector('#root'));
const render = (svg) =>
  root.render(
    <Preview
      content={{ kind: 'bytes', data: new TextEncoder().encode(svg) }}
      resourceAddress="dsh-resource://file/session/test/dense.svg"
      selectionSession="test"
      getInput={() => input}
      fileActions={fileActions}
    />,
  );
const pause = () => new Promise((r) => setTimeout(r, 40));
async function waitForSvg() {
  for (let i = 0; i < 100; i++) {
    await pause();
    if (document.querySelector('section svg')) return;
  }
  throw new Error('Preview did not mount');
}
const results = {};
const check = (name, got, want) =>
  (results[name] = { got, want, pass: JSON.stringify(got) === JSON.stringify(want) });
async function click(x, y) {
  const svg = document.querySelector('section svg'),
    p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  // Dispatch to the element hit by Chromium at the transformed viewport coordinates.
  const el = document.elementFromPoint(p.x, p.y);
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, detail: 1, clientX: p.x, clientY: p.y }),
  );
  await pause();
}
(async () => {
  render(source);
  await waitForSvg();
  for (const width of [640, 480, 960]) {
    document.querySelector('#root').style.width = width + 'px';
    await pause();
    await click(270, 78);
    check('upper' + width, pick(), 'id:upper');
    await click(270, 82);
    check('lower' + width, pick(), 'id:lower');
  }
  await click(270, 78);
  document.querySelector('[data-endpoint="to"]').click();
  await pause();
  await click(485, 170);
  const arcStyle = document.querySelector('select');
  arcStyle.value = 'arc';
  arcStyle.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const between = await (
    await fetch(document.querySelector('section image').getAttribute('href'))
  ).text();
  const arc = new DOMParser()
    .parseFromString(between, 'image/svg+xml')
    .querySelector('#upper')
    .getAttribute('d');
  const [, a, , c, , b] = arc.match(/-?[\d.]+/g).map(Number);
  const heights = Array.from({ length: 1001 }, (_, i) => {
    const t = i / 1000;
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t * t * b;
  });
  check(
    'visible selected arc stays between both parallel bands',
    arc.includes(' Q ') && Math.min(...heights) > 82 && Math.max(...heights) < 170,
    true,
  );
  await click(485, 80);
  await click(485, 170);
  check('latest duplicate card', pick(), 'node-out-b');
  await click(270, 170);
  const chooser = () => document.querySelector('[aria-label="选择重叠连线"]');
  check('overlap awaits explicit pick', pick(), 'node-out-b');
  const candidates = Array.from(chooser()?.querySelectorAll('button[data-choice]') ?? []);
  check('distinct choices', candidates.length, 2);
  if (candidates.length === 2) {
    const chosen = candidates[1].dataset.choice;
    candidates[1].click();
    await pause();
    check('overlap selected', pick(), chosen);
    const old = data().originalGeometry;
    const select = document.querySelector('select');
    select.value = 'arc';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    check('staged arc', data().changes?.connectorStyle, 'arc');
    const press = async (selector) => {
      document.querySelector(selector).click();
      await pause();
    };
    const selectModule = async (field, id) => {
      await press('[data-endpoint="' + field + '"]');
      document
        .querySelector('[data-node-id="' + id + '"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await pause();
    };
    await selectModule('to', 'node-in-b');
    check(
      'self loop refused',
      [
        data().changes.to ?? null,
        document.querySelector('[data-endpoint="to"]').getAttribute('aria-pressed'),
      ],
      [null, 'true'],
    );
    await press('[data-endpoint="to"]');
    await selectModule('to', 'node-out-a');
    const previewText = async () =>
      (await fetch(document.querySelector('section svg image').getAttribute('href'))).text();
    const file = new DOMParser().parseFromString(await previewText(), 'image/svg+xml');
    const paths = file.querySelectorAll('#edges path');
    check('same edge remains selected', [pick(), data().changes.to], [chosen, 'node-out-a']);
    check('other coincident edge untouched', paths[2].getAttribute('d'), 'M120 170H430');
    check(
      'live curve visible before save',
      /^M 120 [^ ]+ Q .* 430 [^ ]+$/.test(paths[3].getAttribute('d')),
      true,
    );
    check(
      'preview hit surface follows curve',
      document.querySelector('[data-edge-hit="' + chosen + '"]').getAttribute('d'),
      paths[3].getAttribute('d'),
    );
    check(
      'same name endpoints disambiguated',
      document.querySelector('[data-endpoint="to"]').textContent.includes('node-out-a'),
      true,
    );
    await press('.save-copy');
    await savedCopy;
    check(
      'desktop export uses visible SVG',
      [saveMode, saved === (await previewText())],
      ['saveAs', true],
    );
    await selectModule('from', 'node-in-a');
    check('source replacement accumulates independently', data().changes, {
      connectorStyle: 'arc',
      to: 'node-out-a',
      from: 'node-in-a',
    });
    await press('.reset-edit');
    check(
      'undo restores original and selection',
      [(await previewText()) === source, pick(), data().changes ?? null],
      [true, chosen, null],
    );
    select.value = 'arc';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    render(source.replace('#007a82', '#007f89'));
    await pause();
    await pause();
    check('stale toolbar hidden', !!document.querySelector('select'), false);
    await click(270, 170);
    Array.from(chooser().querySelectorAll('button[data-choice]'))
      .find((b) => b.dataset.choice === chosen)
      .click();
    await pause();
    check('fresh revision', data().originalGeometry !== old, true);
    check('old changes cleared', data().changes ?? null, null);
  }
  render(native);
  await pause();
  await waitForSvg();
  const nativeButton = document.querySelector('[aria-label$=" · out"]');
  nativeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await pause();
  document.querySelector('select').value = 'arc';
  document.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const nativeText = await (
    await fetch(document.querySelector('section image').getAttribute('href'))
  ).text();
  const xml = new DOMParser().parseFromString(nativeText, 'image/svg+xml');
  check(
    'native output edge gets a single arc',
    xml.querySelectorAll('#out path[data-dsh-part="route"]').length,
    1,
  );
  const origXml = new DOMParser().parseFromString(native, 'image/svg+xml');
  check(
    'native K/V group retained',
    xml.querySelector('#kv').isEqualNode(origXml.querySelector('#kv')),
    true,
  );
  check(
    'one quote, original draft',
    [snapshot.quotes.length, snapshot.text.startsWith('保留这段草稿 🖋 ')],
    [1, true],
  );
})()
  .catch((e) => {
    results.error = String(e);
  })
  .finally(() => {
    const pre = document.createElement('pre');
    pre.id = 'report';
    pre.textContent = JSON.stringify(results);
    document.body.append(pre);
  });
