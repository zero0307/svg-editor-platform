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

export function currentSelection(draft) {
  const start = draft.indexOf(prefix + '{');
  if (start < 0) return;
  const line = draft.slice(start + prefix.length).split('\n', 1)[0];
  try {
    const selected = JSON.parse(line);
    if (typeof selected.path === 'string' && typeof selected.nodeId === 'string') return selected;
  } catch {
    return;
  }
}

export function quoteNode(input, path, node) {
  if (!input || !path) return '请先在本会话的工作区打开 SVG。';
  const previous = currentSelection(input.state.getSnapshot().draft);
  if (previous) {
    if (previous.path !== path || previous.nodeId !== node.id)
      return '请先移除输入框里的上一条 SVG 选区。';
  } else {
    const selection = {
      path,
      nodeId: node.id,
      ...(node.artwork ? { textIndex: node.textIndex, originalText: node.title } : {}),
      ...(node.label && node.label.length <= 200 ? { label: node.label } : {}),
    };
    const text =
      prefix +
      JSON.stringify(selection) +
      '\n' +
      (node.artwork
        ? '保留原图样式。请用 svg_artwork 的 rename，以选区的 nodeId、textIndex、originalText 定位标题，另存新文件。要改框内其他行，用 inspect 核对行号及原文。'
        : '该框已定位。修改框内文字可直接调用 svg_edit_flowchart，用 operation=rename、labelLine（框内从 1 起算）及新 label。返回的 diskReadBack 是主文件和原件的实际磁盘校验；如需单独查节点，可用 svg_inspect(path,nodeId)。');
    if (
      !input.insertQuote(text, {
        label: 'SVG 选区',
        title: node.title,
        detail: node.id,
        body: text,
      })
    )
      return '当前输入框暂时无法接收选区。';
  }
  input.focus();
  return '';
}
