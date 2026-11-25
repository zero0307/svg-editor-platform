import { Group } from '../../index.js';

/** Composite demo type: SVG tag stays `g`, the domain kind is `demo-box`. */
export class DemoBoxShape extends Group {
  override get kind(): string {
    return 'demo-box';
  }
  override creationParts(): readonly string[] {
    return [`g#${this.id}`, ...this.children().map((child) => `${child.tag}#${child.id}`)];
  }
  protected override newContainer(): DemoBoxShape {
    return new DemoBoxShape(this.id);
  }
}
