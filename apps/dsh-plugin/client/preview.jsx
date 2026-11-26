import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { artworkTargets } from '../src/artworkTargets.ts';
import { revisionEdgeTargets } from '../src/edgeTargets.ts';
import { sessionPath, targets, currentSelection, edgeChoices, quoteNode } from './selection.js';

import { edgePreview } from './edgePreview.js';
import css from './preview.css';

export const name = 'svg-editor-selection';
export const inject = ['slots', 'documentPreviews', 'sessions', 'fileActions'];
const id = 'dsh-svg-editor/selection';
const emptySubscribe = () => () => {};
async function inspectScene(bytes) {
  const source = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return;
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const box = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number) ?? [0, 0, Number(root.getAttribute('width')), Number(root.getAttribute('height'))];
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return;
  const native = targets(root);
  const nodes = native.length ? native : artworkTargets(root);
  return { source, box, nodes, edges: await revisionEdgeTargets(root, nodes, source) };
}
function Preview({ content, resourceAddress, selectionSession, getInput, fileActions }) {
  const bytes = content.kind === 'bytes' ? content.data : undefined;
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');
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
    if (!bytes) return;
    let active = true;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
    setPreview({ bytes, url });
    inspectScene(bytes).then(
      (scene) => {
        if (active) setPreview({ bytes, url, scene });
      },
      () => {
        if (active) setNotice('无法读取可点选元素。');
      },
    );
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [bytes, resourceAddress]);

  if (!bytes || preview?.bytes !== bytes) return null;
  const { url, scene } = preview;
  if (!scene || (!scene.nodes.length && !scene.edges.length) || !path)
    return (
      <>
        {notice && <div role="status">{notice}</div>}
        <img src={url} alt="SVG 预览" style={{ maxWidth: '100%' }} />
      </>
    );
  return <Editor key={url} {...{ scene, url, path, selection, getInput, fileActions }} />;
}
function Editor({ scene, url, path, selection, getInput, fileActions }) {
  const [choices, setChoices] = useState([]),
    [endpoint, setEndpoint] = useState(null);
  const [notice, setNotice] = useState(''),
    [candidate, setCandidate] = useState(null);
  const cache = useRef(null),
    sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  const [x, y, width, height] = scene.box;
  const edgeQuote = selection?.path === path && selection.edgeId;
  const selectedEdge =
    edgeQuote &&
    scene.edges.find(
      (edge) =>
        edge.id === edgeQuote &&
        (!edge.artwork || edge.originalGeometry === selection.originalGeometry),
    );
  const activeEnd =
    selectedEdge && endpoint?.path === path && endpoint.id === selectedEdge.id
      ? endpoint.field
      : null;
  const changes = selectedEdge && selection.changes;
  const keyFor = (edge, fields) =>
    JSON.stringify([edge.id, fields.from, fields.to, fields.connectorStyle]);
  const key = changes ? keyFor(selectedEdge, changes) : null;
  const current = key && candidate?.key === key ? candidate : null;
  function previewFor(edge, fields) {
    const key = keyFor(edge, fields);
    if (cache.current?.key !== key)
      cache.current = { key, promise: edgePreview(scene.source, edge, fields) };
    return cache.current.promise;
  }
  useEffect(() => {
    let active = true,
      objectUrl;
    setCandidate(null);
    if (key && (changes.from ?? selectedEdge.from) && (changes.to ?? selectedEdge.to)) {
      previewFor(selectedEdge, changes)
        .then((result) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(result.blob);
          setCandidate({ ...result, url: objectUrl, key });
        })
        .catch(() => {
          if (active) setNotice('当前修改无法预览，请调整端点或线型。');
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key]);
  const nodeTitle = (id) => scene.nodes.find((n) => n.id === id)?.title ?? id ?? '请选择模块';
  const duplicate = (nodeId) => scene.nodes.filter((n) => n.title === nodeTitle(nodeId)).length > 1;
  const endId = (field) => changes?.[field] ?? selectedEdge?.[field];
  async function changeEdge(field, value) {
    const run = ++sequence.current;
    const live = currentSelection(getInput()?.draftSnapshot);
    if (
      !selectedEdge ||
      live?.path !== path ||
      live.edgeId !== selectedEdge.id ||
      (selectedEdge.artwork && live.originalGeometry !== selectedEdge.originalGeometry)
    )
      return;
    const changes = { ...live.changes };
    if (value && value !== selectedEdge[field]) changes[field] = value;
    else delete changes[field];
    const from = changes.from ?? selectedEdge.from,
      to = changes.to ?? selectedEdge.to;
    if (from && from === to) {
      setNotice('起点和终点不能是同一模块，请选择另一个模块。');
      return;
    }
    if (Object.keys(changes).length && from && to) {
      try {
        await previewFor(selectedEdge, changes);
      } catch {
        if (run === sequence.current) setNotice('这组端点和线型无法安全连通，请换一个模块或线型。');
        return;
      }
    }
    if (
      run !== sequence.current ||
      JSON.stringify(currentSelection(getInput()?.draftSnapshot)) !== JSON.stringify(live)
    )
      return;
    setNotice(quoteNode(getInput(), path, { ...selectedEdge, changes }));
    setEndpoint(!from || !to ? { path, id: selectedEdge.id, field: from ? 'to' : 'from' } : null);
  }
  async function saveCopy() {
    if (!current || !fileActions) return;
    const run = ++sequence.current;
    const name =
      path
        .split('/')
        .pop()
        .replace(/\.svg$/i, '') + '-改接.svg';
    try {
      const saved = await fileActions.save(
        { url: current.url, name, mediaType: 'image/svg+xml', read: async () => current.blob },
        fileActions.canSaveAs ? 'saveAs' : 'download',
      );
      if (run === sequence.current)
        setNotice(
          saved.status === 'saved'
            ? '副本已保存 · ' + saved.path
            : saved.status === 'requested'
              ? '已请求下载 SVG 副本。'
              : '',
        );
    } catch {
      if (run === sequence.current) setNotice('保存失败，请重新另存副本。');
    }
  }
  function pick(target) {
    sequence.current++;
    setChoices([]);
    if (activeEnd && !target.parts) {
      changeEdge(activeEnd, target.id);
      return;
    }
    setEndpoint(null);
    if (selectedEdge && target === selectedEdge) {
      setNotice('');
      return;
    }
    setNotice(quoteNode(getInput(), path, target));
  }
  function controls(target, selected) {
    return {
      tabIndex: 0,
      role: 'button',
      'aria-label': target.title + ' · ' + target.id,
      'aria-pressed': selected,
      style: { cursor: 'pointer' },
      onClick(event) {
        if (target.parts && event.detail > 0) {
          const svg = event.currentTarget.ownerSVGElement;
          const root = svg.getRootNode();
          const hits = edgeChoices(root.elementsFromPoint(event.clientX, event.clientY), svg);
          if (hits.length > 1) {
            setChoices(scene.edges.filter((e) => hits.includes(e.id)));
            setEndpoint(null);
            setNotice('');
            return;
          }
          if (hits.length === 1) return pick(scene.edges.find((e) => e.id === hits[0]));
        }
        pick(target);
      },
      onKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          pick(target);
        }
      },
    };
  }
  return (
    <section
      className="dsh-edge-editor"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          sequence.current++;
          setEndpoint(null);
          setChoices([]);
          setNotice('');
        }
      }}
    >
      <style>{css}</style>
      <div className="edge-panel">
        <div className="edge-status" role="status">
          {notice ||
            (choices.length
              ? '此处有多条连线，请选择要编辑的一条。'
              : activeEnd
                ? '点击图中的模块，将其设为新' + (activeEnd === 'from' ? '起点' : '终点')
                : selectedEdge
                  ? (changes ? '修改预览 · 尚未写入原图' : '已选连线') + '　' + selectedEdge.id
                  : edgeQuote
                    ? '图中连线已变化，请重新点选。'
                    : selection?.path === path && selection.nodeId
                      ? '已选模块 · ' + nodeTitle(selection.nodeId)
                      : '点击一条连线修改连接，或点模块选中它。')}
        </div>
        {choices.length > 0 && (
          <div
            className="edge-options"
            role="group"
            aria-label="选择重叠连线"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setChoices([]);
            }}
          >
            {choices.map((edge) => {
              const color = edge.element.getAttribute('stroke');
              const dashed = edge.element.getAttribute('stroke-dasharray');
              return (
                <button
                  key={edge.id}
                  type="button"
                  data-choice={edge.id}
                  onClick={() => pick(edge)}
                >
                  <span
                    className="edge-sample"
                    aria-hidden="true"
                    style={{
                      borderColor: color || 'currentColor',
                      borderTopStyle: dashed && dashed !== 'none' ? 'dashed' : 'solid',
                    }}
                  />
                  {edge.title} · {edge.id}
                  {color ? ' · ' + color : ''}
                  {dashed && dashed !== 'none' ? ' · 虚线' : ''}
                </button>
              );
            })}
            <button type="button" onClick={() => setChoices([])}>
              取消
            </button>
          </div>
        )}
        {!choices.length &&
          selectedEdge &&
          (!selectedEdge.artwork || selectedEdge.reconnectable) && (
            <div role="group" aria-label="编辑所选连线" className="edge-tools">
              {['from', 'to'].map((field) => {
                const label = field === 'from' ? '起点' : '终点';
                return (
                  <button
                    key={field}
                    data-endpoint={field}
                    aria-label={
                      '改' +
                      label +
                      ' · ' +
                      nodeTitle(endId(field)) +
                      (duplicate(endId(field)) ? ' · ' + endId(field) : '')
                    }
                    type="button"
                    aria-pressed={activeEnd === field}
                    title={'点此按钮，再点图中的' + label + '模块'}
                    onClick={() => {
                      sequence.current++;
                      setNotice('');
                      setEndpoint(
                        activeEnd === field ? null : { path, id: selectedEdge.id, field },
                      );
                    }}
                  >
                    <span className="endpoint-action">{'改' + label}</span>
                    <strong>{nodeTitle(endId(field))}</strong>
                    {duplicate(endId(field)) && <small>{endId(field)}</small>}
                  </button>
                );
              })}
              <label className="line-style">
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
              {changes && (
                <button
                  type="button"
                  className="reset-edit"
                  onClick={() => {
                    sequence.current++;
                    setNotice(quoteNode(getInput(), path, selectedEdge));
                    setEndpoint(null);
                  }}
                >
                  撤销预览
                </button>
              )}
              {current && fileActions && (
                <button type="button" className="save-copy" onClick={saveCopy}>
                  另存 SVG
                </button>
              )}
              {activeEnd && (
                <button type="button" onClick={() => setEndpoint(null)}>
                  取消选点
                </button>
              )}
            </div>
          )}
      </div>
      <svg
        aria-label="SVG 节点与连线点选"
        viewBox={scene.box.join(' ')}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <image
          href={current?.url ?? url}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="none"
        />
        {scene.edges.map((edge) => {
          const selected = selectedEdge === edge;
          return (
            <g
              key={'edge:' + edge.id}
              {...controls(edge, selected)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>{edge.title}</title>
              {(selected && current ? current.parts : edge.parts).map(
                ({ shape: Shape, geometry }, i) => (
                  <React.Fragment key={i}>
                    <Shape
                      {...geometry}
                      stroke="transparent"
                      data-edge-hit={edge.id}
                      strokeWidth="14"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="stroke"
                    />
                    <Shape
                      {...geometry}
                      data-edge-hit={edge.id}
                      data-edge-ink="true"
                      stroke="transparent"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="stroke"
                    />
                    {selected && !current && (
                      <Shape
                        {...geometry}
                        stroke="#007c91"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                    )}
                  </React.Fragment>
                ),
              )}
            </g>
          );
        })}
        {scene.nodes.map((node) => {
          const Shape = node.shape;
          const selected = selection?.path === path && selection.nodeId === node.id;

          const role =
            selectedEdge &&
            (node.id === endId('from') ? 'from' : node.id === endId('to') ? 'to' : null);
          return (
            <Shape
              data-node-id={node.id}
              data-picking={activeEnd ? 'true' : undefined}
              className="editable-node"
              key={node.id}
              {...node.geometry}
              fill="transparent"
              stroke={
                selected
                  ? '#007c91'
                  : role === 'from'
                    ? '#168175'
                    : role === 'to'
                      ? '#6655af'
                      : 'none'
              }
              vectorEffect="non-scaling-stroke"
              strokeWidth="2"
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
            fileActions: ctx.fileActions,
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
