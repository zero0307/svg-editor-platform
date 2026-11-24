import { Group } from '../../index.js';

/** Composite demo type: SVG tag stays `g`, the domain kind is `demo-box`. */
export class DemoBoxShape extends Group {
  override get kind(): string {
    return 'demo-box';
  }
  protected override newContainer(): DemoBoxShape {
    return new DemoBoxShape(this.id);
  }
}
