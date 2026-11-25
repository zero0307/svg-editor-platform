import { Group } from '@svgframe/core';

/**
 * Public container test double for `stats`: a group-shaped container whose
 * domain `kind` is `box`. It proves the command counts containers through the
 * public `ContainerShape` capability and leaves through `kind`, without any
 * `g`/`box` name check or a dependency on the box plugin.
 */
export class FakeBoxShape extends Group {
  override get kind(): string {
    return 'box';
  }
  override clone(): FakeBoxShape {
    const copy = new FakeBoxShape(this.id);
    this.copyPresentationTo(copy);
    this.children().forEach((child) => copy.insert(child.clone()));
    return copy;
  }
}
