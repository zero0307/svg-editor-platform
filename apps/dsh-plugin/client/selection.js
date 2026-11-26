const svg = 'http://www.w3.org/2000/svg';
const prefix = 'SVG 选区 ';

export function sessionPath(address, sessionId) {
  const start = 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/';
  if (!address.startsWith(start)) return;
  try {
    const path = decodeURIComponent(address.slice(start.length).split(/[?#]/, 1)[0]);
    if (path && !/[\u0000-\u001f]/.test(path)) return path;
  } catch {
    // An undecodable resource has no reliable tool path.
  }
}

export function targets(root) {
  if (
    root.namespaceURI !== svg ||
    root.localName !== 'svg' ||
    root.querySelector('[transform], style') ||
    root.hasAttribute('transform')
  )
    return [];
  const counts = new Map();
  for (const el of root.querySelectorAll('[id]')) counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
  const result = [];
  for (const group of root.children) {
    if (
      group.namespaceURI !== svg ||
      group.localName !== 'g' ||
      group.getAttribute('data-dsh-role') !== 'node' ||
      counts.get(group.id) !== 1
    )
      continue;
    const body = Array.from(group.children).find((el) =>
      ['rect', 'ellipse'].includes(el.localName),
    );
    const title = Array.from(group.children).find(
      (el) => el.localName === 'text' && el.id === group.id + '-label',
    );
    if (!body || !title || !group.id) continue;
    const oval = body.localName === 'ellipse';
    const keys = oval ? ['cx', 'cy', 'rx', 'ry'] : ['x', 'y', 'width', 'height'];
    const geometry = {};
    for (const key of keys) {
      const value = body.getAttribute(key);
      geometry[key] = value?.trim() ? Number(value) : NaN;
    }
    if (
      !Object.values(geometry).every(Number.isFinite) ||
      geometry[keys[2]] <= 0 ||
      geometry[keys[3]] <= 0
    )
      continue;
    if (!oval && body.hasAttribute('rx')) geometry.rx = body.getAttribute('rx');
    const rows = [title.textContent];
    for (const child of group.children) {
      if (
        child.localName !== 'text' ||
        child.getAttribute('data-dsh-part') !== 'label-continuation'
      )
        continue;
      if (['crlf', 'cr', 'lf'].includes(child.getAttribute('data-dsh-break')))
        rows.push(child.textContent);
      else rows[rows.length - 1] += child.textContent;
    }
    result.push({
      id: group.id,
      title: title.textContent,
      label: rows.join('\n'),
      shape: body.localName,
      geometry,
    });
  }
  return result;
}

function picked(quote) {
  if (
    quote.summary?.label !== 'SVG 选区' ||
    quote.summary.body !== quote.text ||
    !quote.text.startsWith(prefix)
  )
    return;
  try {
    const value = JSON.parse(quote.text.slice(prefix.length).split('\n', 1)[0]);
    const id = value.edgeId ?? value.nodeId;
    if (typeof value.path === 'string' && typeof id === 'string' && id === quote.summary.detail)
      return value;
  } catch {
    // Other quotes and user-typed examples are ordinary conversation content.
  }
}

export function currentSelection(snapshot) {
  return (snapshot?.quotes ?? []).map(picked).find(Boolean);
}

function selectionQuote(path, target) {
  let selection, hint;
  if (target.parts) {
    selection = {
      path,
      edgeId: target.id,
      ...(target.artwork
        ? { originalGeometry: target.originalGeometry, from: target.from, to: target.to }
        : { from: target.from, to: target.to }),
    };
    if (target.changes && Object.keys(target.changes).length) selection.changes = target.changes;
    hint = target.artwork
      ? target.reconnectable
        ? '用 svg_artwork reconnect，沿用选区 edgeId 和 originalGeometry，from、to、connectorStyle 可独立修改。只改弧线用 connectorStyle=arc，保留两端，另存新文件。用 inspect 查节点。'
        : '这是原画的线段。用 svg_artwork inspect 核对该段；分离的箭头、分叉或变换需结合原图处理。'
      : '用 svg_edit_flowchart reconnect，沿用选区 edgeId，仅填要换的 from、to 或 connectorStyle（弧线用 arc）；另存新文件并核对。';
    if (selection.changes) hint += ' changes 是用户在桌面指定的新值，调用工具时展开为同名参数。';
  } else {
    selection = {
      path,
      nodeId: target.id,
      ...(target.artwork ? { textIndex: target.textIndex, originalText: target.title } : {}),
      ...(target.label && target.label.length <= 200 ? { label: target.label } : {}),
    };
    hint = target.artwork
      ? '保留原图样式。请用 svg_artwork 的 rename，以选区的 nodeId、textIndex、originalText 定位标题，另存新文件。要改框内其他行，用 inspect 核对行号及原文。'
      : '该框已定位。修改框内文字可直接调用 svg_edit_flowchart，用 operation=rename、labelLine（框内从 1 起算）及新 label。返回的 diskReadBack 是主文件和原件的实际磁盘校验；如需单独查节点，可用 svg_inspect(path,nodeId)。';
  }
  return prefix + JSON.stringify(selection) + '\n' + hint;
}

// Replace only our quoted spans in the previous semantic draft. Offsets are UTF-16
// positions in DSH's clipboard projection, which includes Markdown quote prefixes.
function replaceSelection(snapshot, previous, inserted, formatted) {
  let cursor = 0,
    text = '';
  const references = [],
    quotes = [];
  const spans = [...snapshot.references, ...snapshot.quotes].sort((a, b) => a.offset - b.offset);
  for (const span of spans) {
    text += snapshot.text.slice(cursor, span.offset);
    if (!previous.includes(span)) {
      const rest = { ...span, offset: text.length };
      if ('clipboardText' in span) references.push(rest);
      else quotes.push(rest);
      text += snapshot.text.slice(span.offset, span.offset + span.length);
    } else if (span === previous[0]) {
      quotes.push({ ...inserted, offset: text.length });
      text += formatted;
    }
    cursor = span.offset + span.length;
  }
  return { ...snapshot, text: text + snapshot.text.slice(cursor), references, quotes };
}

export function quoteNode(input, path, target) {
  const unavailable = '当前输入框暂时无法接收选区。';
  if (!input || !path) return '请先在本会话的工作区打开 SVG。';
  const snapshot = input.draftSnapshot;
  if (!snapshot || input.state.getSnapshot().phase !== 'plain') return unavailable;
  const previous = (snapshot.quotes ?? []).filter(picked);
  const text = selectionQuote(path, target);
  if (previous.length !== 1 || previous[0].text !== text) {
    // Let the host enforce its edit permissions and supply the exact quote encoding.
    if (
      !input.insertQuote(text, {
        label: 'SVG 选区',
        title: target.title,
        detail: target.id,
        body: text,
      })
    )
      return unavailable;
    if (previous.length) {
      const updated = input.draftSnapshot;
      const inserted = updated.quotes.find((q) => q.text === text && picked(q));
      const formatted = updated.text.slice(inserted.offset, inserted.offset + inserted.length);
      input.setDraft(replaceSelection(snapshot, previous, inserted, formatted));
    }
  }
  input.focus();
  return '';
}
