import { SyntaxKind } from 'typescript/unstable/ast';

/**
 * Fixed metric rules, version 1. Changing any rule here requires bumping RULES_VERSION,
 * updating scripts/metrics/README.md and doc/adr/0016-metrics-rules-and-classification.md,
 * then regenerating docs/metrics; numbers are only comparable within one rules version.
 */
export const RULES_VERSION = 1;

export const RULES_SUMMARY = [
  'lines: physical lines; empty file is 0; a trailing newline does not add a line; blank and comment lines count',
  'complexity unit: function declaration, method, constructor, getter, setter, function expression, arrow function',
  'complexity base: 1 per unit; +1 for if, for, for-in, for-of, while, do, catch, conditional (?:), non-default case, &&, ||, ??',
  'complexity nested units: a nested function is its own unit and does not add its increments to the outer unit',
  'complexity report: sum over units (total), unit count (functions), largest unit (max); files without units report 0',
];

const UNIT_KINDS = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
]);

const INCREMENT_KINDS = new Map([
  [SyntaxKind.IfStatement, 'if'],
  [SyntaxKind.ForStatement, 'for'],
  [SyntaxKind.ForInStatement, 'for-in'],
  [SyntaxKind.ForOfStatement, 'for-of'],
  [SyntaxKind.WhileStatement, 'while'],
  [SyntaxKind.DoStatement, 'do'],
  [SyntaxKind.CatchClause, 'catch'],
  [SyntaxKind.ConditionalExpression, 'conditional'],
]);

const LOGICAL_OPERATOR_KINDS = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
]);

/** Physical line count; a trailing newline terminates the last line instead of adding one. */
export function countLines(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  if (buffer.length === 0) return 0;
  let lines = 0;
  for (const byte of buffer) if (byte === 10) lines++;
  if (buffer[buffer.length - 1] !== 10) lines++;
  return lines;
}

function logicalOperatorKind(node) {
  if (node.operatorToken !== undefined && node.operatorToken !== null) {
    return node.operatorToken.kind;
  }
  let found;
  node.forEachChild((child) => {
    if (found === undefined && LOGICAL_OPERATOR_KINDS.has(child.kind)) found = child.kind;
  });
  return found;
}

function incrementFor(node) {
  const named = INCREMENT_KINDS.get(node.kind);
  if (named !== undefined) return 1;
  if (node.kind === SyntaxKind.CaseClause) return node.expression === undefined ? 0 : 1;
  if (node.kind === SyntaxKind.BinaryExpression) {
    const operator = logicalOperatorKind(node);
    return operator !== undefined && LOGICAL_OPERATOR_KINDS.has(operator) ? 1 : 0;
  }
  return 0;
}

/** Complexity of one unit, not counting increments that belong to nested units. */
function unitComplexity(unit) {
  let value = 1;
  const visit = (node) => {
    if (UNIT_KINDS.has(node.kind)) return;
    value += incrementFor(node);
    node.forEachChild(visit);
  };
  unit.forEachChild(visit);
  return value;
}

function collectUnits(node, units) {
  if (UNIT_KINDS.has(node.kind)) units.push(node);
  node.forEachChild((child) => {
    collectUnits(child, units);
  });
  return units;
}

/**
 * Measure one parsed source file. `sourceFile` is a TypeScript 7 syntax tree from
 * `scripts/metrics/ast.mjs`; `content` is the raw blob used for physical line counting.
 */
export function measureSourceFile(sourceFile, content) {
  const units = collectUnits(sourceFile, []);
  let total = 0;
  let max = 0;
  for (const unit of units) {
    const value = unitComplexity(unit);
    total += value;
    if (value > max) max = value;
  }
  return {
    lines: countLines(content),
    complexity: { total, functions: units.length, max },
  };
}

export function emptyMetrics() {
  return { lines: 0, complexity: { total: 0, functions: 0, max: 0 } };
}
