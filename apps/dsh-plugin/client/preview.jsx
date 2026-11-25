import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { sessionPath, targets, currentSelection, quoteNode } from './selection.js';

export const name = 'svg-editor-selection';
export const inject = ['slots', 'documentPreviews', 'sessions'];
const id = 'dsh-svg-editor/selection';
const emptySubscribe = () => () => {};
function Preview({ content, resourceAddress, selectionSession, getInput }) {
  const bytes = content.kind === 'bytes' ? content.data : undefined;
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const path = sessionPath(resourceAddress, selectionSession);
  const input = getInput();
  const selection = currentSelection(
    useSyncExternalStore(
      input ? (fn) => input.state.subscribe(fn) : emptySubscribe,
      () => input?.state.getSnapshot().draft ?? '',
    ),
  );
  useEffect(() => {
    setNotice('');
    if (!bytes) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [bytes, resourceAddress]);
  const scene = useMemo(() => {
    if (!bytes) return;
    const source = new TextDecoder().decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) return;
    const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    const box = root
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number) ?? [
      0,
      0,
      Number(root.getAttribute('width')),
      Number(root.getAttribute('height')),
    ];
    if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return;
    return { box, nodes: targets(root) };
  }, [bytes]);
  if (!url) return null;
  if (!scene?.nodes.length || !path)
    return <img src={url} alt="SVG 预览" style={{ maxWidth: '100%' }} />;
  const [x, y, width, height] = scene.box;
  return (
    <section style={{ width: '100%' }}>
      <div role="status" style={{ padding: '6px 12px', fontSize: 12 }}>
        {notice || '点选节点，将它引用到当前对话。'}
      </div>
      <svg
        aria-label="SVG 节点点选"
        viewBox={scene.box.join(' ')}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <image href={url} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
        {scene.nodes.map((node) => {
          const Shape = node.shape;
          const selected = selection?.path === path && selection.nodeId === node.id;
          const pick = () => setNotice(quoteNode(getInput(), path, node));
          return (
            <Shape
              key={node.id}
              {...node.geometry}
              fill="transparent"
              stroke={selected ? '#007c91' : 'none'}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              role="button"
              aria-label={node.title + ' · ' + node.id}
              aria-pressed={selected}
              onClick={pick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pick();
                }
              }}
            >
              <title>{node.title + ' · ' + node.id}</title>
            </Shape>
          );
        })}
      </svg>
    </section>
  );
}
export function apply(ctx) {
  ctx.effect(() =>
    ctx.documentPreviews.register({
      id,
      extensions: ['svg'],
      priority: 'extension',
      title: () => 'SVG 节点点选',
      loading: 'bytes-complete',
      wrap: false,
    }),
  );
  ctx.effect(() =>
    ctx.slots.inject('sidebar.right.tab.document', () =>
      ctx.slots.register(
        {
          name: 'sidebar.right.tab.document',
          key: id,
          inject: (sessionId) => ({
            selectionSession: sessionId,
            getInput: () => {
              const scope = ctx.sessions.scope(sessionId);
              return scope?.get('conversation')?.input.for(scope);
            },
          }),
        },
        Preview,
      ),
    ),
  );
}
