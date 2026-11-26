import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { artworkTargets } from '../src/artworkTargets.ts';
import { edgeTargets } from '../src/edgeTargets.ts';
import { sessionPath, targets, currentSelection, quoteNode } from './selection.js';

export const name = 'svg-editor-selection';
export const inject = ['slots', 'documentPreviews', 'sessions'];
const id = 'dsh-svg-editor/selection';
const emptySubscribe = () => () => {};
function Preview({ content, resourceAddress, selectionSession, getInput }) {
  const bytes = content.kind === 'bytes' ? content.data : undefined;
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [endpoint, setEndpoint] = useState(null);
  const path = sessionPath(resourceAddress, selectionSession);
  const input = getInput();
  const selection = currentSelection(
    useSyncExternalStore(
      input ? (fn) => input.state.subscribe(fn) : emptySubscribe,
      () => input?.draftSnapshot,
    ),
  );
  useEffect(() => {
    setNotice('');
    setEndpoint(null);
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
    const native = targets(root);
    const nodes = native.length ? native : artworkTargets(root);
    return { box, nodes, edges: edgeTargets(root, nodes) };
  }, [bytes]);
  if (!url) return null;
  if (!scene || (!scene.nodes.length && !scene.edges.length) || !path)
    return <img src={url} alt="SVG 预览" style={{ maxWidth: '100%' }} />;
  const [x, y, width, height] = scene.box;
  const selectedEdge =
    selection?.path === path && scene.edges.find((e) => e.id === selection.edgeId);
  const activeEnd =
    selectedEdge && endpoint?.path === path && endpoint.id === selectedEdge.id
      ? endpoint.field
      : null;
  const nodeTitle = (id) => scene.nodes.find((n) => n.id === id)?.title ?? id ?? '未识别';
  function changeEdge(field, value) {
    const live = currentSelection(getInput()?.draftSnapshot);
    if (!selectedEdge || live?.path !== path || live.edgeId !== selectedEdge.id) return;
    const changes = { ...live.changes };
    if (value && value !== selectedEdge[field]) changes[field] = value;
    else delete changes[field];
    setNotice(quoteNode(getInput(), path, { ...selectedEdge, changes }));
    setEndpoint(null);
  }
  function controls(target, selected) {
    const pick = () => {
      if (activeEnd && !target.parts) {
        changeEdge(activeEnd, target.id);
        return;
      }
      setEndpoint(null);
      if (selected && target.parts) {
        setNotice('');
        return;
      }
      setNotice(quoteNode(getInput(), path, target));
    };
    return {
      tabIndex: 0,
      role: 'button',
      'aria-label': target.title + ' · ' + target.id,
      'aria-pressed': selected,
      style: { cursor: 'pointer' },
      onClick: pick,
      onKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          pick();
        }
      },
    };
  }
  return (
    <section style={{ width: '100%' }}>
      <div role="status" style={{ padding: '6px 12px', fontSize: 12 }}>
        {notice ||
          (activeEnd
            ? '请点图中的' + (activeEnd === 'from' ? '起点' : '终点') + '模块'
            : selectedEdge
              ? '已选连线 · ' + selectedEdge.title
              : selection?.path === path && selection.nodeId
                ? '已选模块 · ' + nodeTitle(selection.nodeId)
                : '点选节点或连线，最后一次点选即为当前对话的目标。')}
      </div>
      {selectedEdge && (!selectedEdge.artwork || selectedEdge.reconnectable) && (
        <div
          role="group"
          aria-label="编辑所选连线"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '0 12px 6px',
            fontSize: 12,
          }}
        >
          {['from', 'to'].map((field) => {
            const label = field === 'from' ? '起点' : '终点';
            return (
              <button
                key={field}
                type="button"
                aria-pressed={activeEnd === field}
                title={'点此按钮，再点图中的' + label + '模块'}
                onClick={() => {
                  setNotice('');
                  setEndpoint(activeEnd === field ? null : { path, id: selectedEdge.id, field });
                }}
              >
                {label + ' · ' + nodeTitle(selection.changes?.[field] ?? selectedEdge[field])}
              </button>
            );
          })}
          <label>
            线型{' '}
            <select
              aria-label="线型"
              value={selection.changes?.connectorStyle ?? ''}
              onChange={(e) => changeEdge('connectorStyle', e.target.value)}
            >
              <option value="">自动</option>
              <option value="straight">直线</option>
              <option value="arc">弧线</option>
              <option value="angular">折线路由</option>
              <option value="rounded">圆角折线</option>
            </select>
          </label>
          {activeEnd && (
            <button type="button" onClick={() => setEndpoint(null)}>
              取消选点
            </button>
          )}
        </div>
      )}
      <svg
        aria-label="SVG 节点与连线点选"
        viewBox={scene.box.join(' ')}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <image href={url} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
        {scene.edges.map((edge) => {
          const selected = selection?.path === path && selection.edgeId === edge.id;
          return (
            <g
              key={'edge:' + edge.id}
              {...controls(edge, selected)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>{edge.title}</title>
              {edge.parts.map(({ shape: Shape, geometry }, i) => (
                <React.Fragment key={i}>
                  <Shape
                    {...geometry}
                    stroke="transparent"
                    strokeWidth="14"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="stroke"
                  />
                  {selected && (
                    <Shape
                      {...geometry}
                      stroke="#007c91"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                </React.Fragment>
              ))}
            </g>
          );
        })}
        {scene.nodes.map((node) => {
          const Shape = node.shape;
          const selected = selection?.path === path && selection.nodeId === node.id;

          return (
            <Shape
              key={node.id}
              {...node.geometry}
              fill="transparent"
              stroke={selected ? '#007c91' : 'none'}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              {...controls(node, selected)}
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
      title: () => 'SVG 节点与连线点选',
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
