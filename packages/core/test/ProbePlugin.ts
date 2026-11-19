import type {
  AttributeHandler,
  Command,
  CreateShapeRequest,
  EditableDocument,
  PluginContext,
  PluginModule,
  PreparedCommand,
  ShapeProvider,
  ShapeView,
  SvgElementView,
  TreeDecorator,
  TreeRow,
} from '@svgframe/core';
import { ProbeShape } from './ProbeShape.js';

// The same name in different contribution categories is legal.
export class ProbePlugin
  implements PluginModule, ShapeProvider, Command, AttributeHandler, TreeDecorator
{
  readonly name = 'probe';
  readonly usage = 'probe';
  readonly requiresDocument = false;
  activate(ctx: PluginContext): void {
    ctx.registerCommand(this);
    ctx.registerShape(this);
    ctx.registerAttribute(this);
    ctx.registerDecorator(this);
  }
  create(request: CreateShapeRequest): ProbeShape {
    return new ProbeShape(request.id);
  }
  matches(node: SvgElementView): 'kind' | undefined {
    return node.attributes['data-kind'] === this.name ? 'kind' : undefined;
  }
  restore(node: SvgElementView): ProbeShape {
    if (!node.id) throw new Error('missing id');
    const shape = new ProbeShape(node.id);
    shape.setAttribute('fill', node.attributes.fill ?? '');
    return shape;
  }
  prepare(): PreparedCommand {
    return { effect: 'query', run: ({ directory }) => directory.cwd() };
  }
  handles(target: ShapeView, attribute: string): boolean {
    return target.kind === this.name && attribute === 'paint';
  }
  apply(doc: EditableDocument, id: string, _attribute: string, value: string): string {
    doc.require(id).setAttribute('fill', value);
    return value;
  }
  suffix(row: TreeRow): string | undefined {
    return row.kind === 'shape' && row.shape.kind === this.name ? '(probe)' : undefined;
  }
}
