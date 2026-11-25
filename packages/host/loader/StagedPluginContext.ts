import {
  AttributeHandlerRegistry,
  CommandRegistry,
  ShapeProviderRegistry,
  TreeDecoratorRegistry,
} from '@svgframe/core';
import type {
  DirectoryReader,
  EditorEventListener,
  EditorEvents,
  PluginContext,
  ShapeCreationService,
} from '@svgframe/core';

interface StagedSubscription {
  readonly listener: EditorEventListener;
  active: boolean;
  detach?: () => void;
}

/**
 * Per-plugin staging area handed to `activate`.
 *
 * Registrations go to fresh registries and event subscriptions stay in this
 * object instead of the live bus. The installer publishes registrations first and
 * only then connects the staged subscriptions, so a failed plugin leaves neither
 * the four registries nor the event bus touched.
 */
export class StagedPluginContext implements PluginContext {
  readonly shapeProviders = new ShapeProviderRegistry();
  readonly commands = new CommandRegistry();
  readonly treeDecorators = new TreeDecoratorRegistry();
  readonly attributeHandlers = new AttributeHandlerRegistry();
  readonly options: Readonly<Record<string, unknown>>;
  private readonly subscriptions: StagedSubscription[] = [];

  constructor(
    readonly shapes: ShapeCreationService,
    readonly directories: DirectoryReader,
    options: Readonly<Record<string, unknown>>,
  ) {
    this.options = Object.freeze({ ...options });
  }

  subscribe(listener: EditorEventListener): () => void {
    const subscription: StagedSubscription = { listener, active: true };
    this.subscriptions.push(subscription);
    return () => {
      if (!subscription.active) return;
      subscription.active = false;
      subscription.detach?.();
    };
  }

  /** Connect every still-active staged subscription; called after commit only. */
  connect(events: EditorEvents): void {
    for (const subscription of this.subscriptions) {
      if (!subscription.active) continue;
      subscription.detach = events.subscribe(subscription.listener);
    }
  }

  /** Drop the staging area without touching the live bus (rollback path). */
  discard(): void {
    for (const subscription of this.subscriptions) {
      subscription.active = false;
      subscription.detach?.();
    }
    this.subscriptions.length = 0;
  }
}
