import { DomainError } from '../DomainError.js';
import { Numbers } from '../Numbers.js';
import { GeometryShape } from './GeometryShape.js';

const number = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
const separator = '(?:\\s*,\\s*|\\s+)';
const pair = number + separator + number;
const command = new RegExp('^\\s*M\\s*' + pair + '\\s*Q\\s*' + pair + separator + pair + '\\s*$');

export function quadraticPoints(d: string) {
  const match = command.exec(d);
  if (!match)
    throw new DomainError('Expected a single absolute quadratic SVG path: M x y Q cx cy x y');
  const [x1, y1, cx, cy, x2, y2] = match
    .slice(1)
    .map((value) => Numbers.parse(value, 'path coordinate'));
  return { x1: x1!, y1: y1!, cx: cx!, cy: cy!, x2: x2!, y2: y2! };
}

export class QuadraticPath extends GeometryShape {
  readonly tag = 'path';
  constructor(id: string, d: string) {
    super(id, quadraticPoints(d), []);
  }
  override move(dx: number, dy: number) {
    this.translate(['x1', 'cx', 'x2'], ['y1', 'cy', 'y2'], dx, dy);
  }
  override geometry() {
    return {
      d: `M ${this.get('x1')} ${this.get('y1')} Q ${this.get('cx')} ${this.get('cy')} ${this.get('x2')} ${this.get('y2')}`,
    };
  }
  override clone() {
    const copy = new QuadraticPath(this.id, this.geometry().d);
    this.copyPresentationTo(copy);
    return copy;
  }
  override summary() {
    return this.geometry().d + this.styleSummary();
  }
}
