import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const files = [
  ...new Set([...tracked, ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')]),
].filter(Boolean);
const versioned = new Set(files);
const failures = [];
const notices = [];
const forbiddenSegments = new Set([
  '.git',
  'node_modules',
  'dist',
  '.npm-cache',
  'coverage',
  'artifacts',
]);
const missingOriginalImages = new Set([
  'phase_cli_2-研-1.md\0docs/images/vscode-svg-badge.jpg',
  'phase_cli_2-研-1.md\0docs/images/vscode-svg-outline.jpg',
]);
let checkedLinks = 0;

for (const file of tracked) {
  const segments = file.split('/');
  if (
    segments.some((segment) => forbiddenSegments.has(segment)) ||
    segments[0] === 'reference' ||
    segments[0] === 'phase2-plan'
  ) {
    failures.push(`${file}: dependency, build output or external material clone is tracked`);
  }
}
for (const entry of git('ls-files', '--stage', '-z').split('\0').filter(Boolean)) {
  if (entry.startsWith('160000 ')) {
    failures.push(
      `${entry.slice(entry.indexOf('\t') + 1)}: nested Git repository/submodule is tracked`,
    );
  }
}

function destinationAt(text, offset) {
  if (text[offset] === '<') {
    const end = text.indexOf('>', offset + 1);
    return end < 0 ? null : text.slice(offset + 1, end);
  }
  let destination = '';
  let depth = 0;
  for (let index = offset; index < text.length; index++) {
    const character = text[index];
    if (character === '\\' && index + 1 < text.length) {
      destination += text.slice(index, index + 2);
      index++;
    } else if (character === '(') {
      depth++;
      destination += character;
    } else if (character === ')') {
      if (depth === 0) return destination;
      depth--;
      destination += character;
    } else if (/\s/.test(character) && depth === 0) {
      return destination;
    } else {
      destination += character;
    }
  }
  return destination || null;
}

function checkDestination(file, lineNumber, destination) {
  if (
    !destination ||
    destination.startsWith('#') ||
    destination.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(destination)
  ) {
    return;
  }
  const location = `${file}:${lineNumber}`;
  let target;
  try {
    target = decodeURIComponent(destination.split(/[?#]/, 1)[0]).replace(
      /\\([\\ ()#[\]<>])/g,
      '$1',
    );
  } catch {
    failures.push(`${location}: invalid URL encoding in ${destination}`);
    return;
  }
  if (!target) return;
  checkedLinks++;
  const absolute = target.startsWith('/')
    ? path.resolve(root, `.${target}`)
    : path.resolve(root, path.dirname(file), target);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    failures.push(`${location}: local link escapes repository: ${destination}`);
    return;
  }
  if (!existsSync(absolute)) {
    if (missingOriginalImages.has(`${file}\0${relative}`)) {
      notices.push(`${location}: original course image not supplied: ${relative}`);
    } else {
      failures.push(`${location}: missing local link target: ${destination}`);
    }
    return;
  }
  const represented = statSync(absolute).isDirectory()
    ? relative === '' || files.some((candidate) => candidate.startsWith(`${relative}/`))
    : versioned.has(relative);
  if (!represented) {
    failures.push(
      `${location}: link target is ignored or outside Git-managed files: ${destination}`,
    );
  }
}

const markdown = files.filter((file) => file.toLowerCase().endsWith('.md'));
for (const file of markdown) {
  if (!existsSync(path.join(root, file))) {
    failures.push(`${file}: tracked Markdown file is missing`);
    continue;
  }
  let fence;
  const lines = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`).test(line))
        fence = undefined;
      return;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening) {
      fence = { character: opening[1][0], length: opening[1].length, line: index + 1 };
      return;
    }
    const text = line.replace(/(`+).*?\1/g, (code) => ' '.repeat(code.length));
    for (const match of text.matchAll(/\]\([ \t]*/g)) {
      checkDestination(file, index + 1, destinationAt(text, match.index + match[0].length));
    }
    const definition = /^ {0,3}\[[^\]]+\]:[ \t]*/.exec(text);
    if (definition) checkDestination(file, index + 1, destinationAt(text, definition[0].length));
  });
  if (fence) failures.push(`${file}:${fence.line}: unclosed Markdown code fence`);
}

for (const notice of notices) console.warn(`notice: ${notice}`);
if (failures.length) {
  for (const failure of failures) console.error(`error: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation check passed: ${markdown.length} Markdown files, ${checkedLinks} local links, ${notices.length} documented source-image omissions; repository layout checked.`,
  );
}
