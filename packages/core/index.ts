/**
 * Public entry of `@svgframe/core`.
 *
 * Only this file may be imported across packages (`import '@svgframe/core'`).
 * Everything here is platform neutral: no host, builtins, plugin, filesystem,
 * VSCode, DSH or XML DOM dependency.
 */

// Domain abstractions and read-only projections.
export { DomainError } from './domain/DomainError.js';
export { Numbers } from './domain/Numbers.js';
export { SvgString } from './domain/SvgString.js';
export type { ReadonlyShape } from './domain/ReadonlyShape.js';
export type { ReadonlyDocument } from './domain/ReadonlyDocument.js';
export type { EditableDocument } from './domain/EditableDocument.js';
export { Shape } from './domain/Shape.js';
export { ContainerShape } from './domain/ContainerShape.js';
export { Group } from './domain/Group.js';
export { SvgDocument } from './domain/SvgDocument.js';
export type { ElementTransform, SvgElementView } from './domain/SvgElementView.js';
export type { TreeRow } from './domain/TreeRow.js';

// Extension point contracts and typed registries.
export { Registry } from './extensions/Registry.js';
export { DuplicateRegistrationError } from './extensions/DuplicateRegistrationError.js';
export type { ShapeProvider } from './extensions/ShapeProvider.js';
export { ShapeProviderRegistry } from './extensions/ShapeProviderRegistry.js';
export type {
  Command,
  CommandEffect,
  CommandOutput,
  CommandPreparation,
  DocumentOperation,
  DocumentPreparation,
  EditPreparation,
  HistoryOperation,
  HistoryPreparation,
  PreparationBase,
  QueryOperation,
  QueryPreparation,
} from './extensions/Command.js';
export { CommandRegistry } from './extensions/CommandRegistry.js';
export { EditAction } from './extensions/EditAction.js';
export { QueryContext } from './extensions/QueryContext.js';
export type { TreeDecorator } from './extensions/TreeDecorator.js';
export { TreeDecoratorRegistry } from './extensions/TreeDecoratorRegistry.js';
export type {
  AttributeEditContext,
  AttributeHandler,
  AttributeRequest,
  AttributeResult,
} from './extensions/AttributeHandler.js';
export { AttributeHandlerRegistry } from './extensions/AttributeHandlerRegistry.js';
export { AttributeHandlerConflictError } from './extensions/AttributeHandlerConflictError.js';
export type { PluginContributions, PluginManifest } from './extensions/PluginManifest.js';
export type { PluginModule } from './extensions/PluginModule.js';
export type { PluginContext } from './extensions/PluginContext.js';

// Public service ports.
export type { ShapeCreationRequest } from './ports/ShapeCreationRequest.js';
export type { ShapeCreationService } from './ports/ShapeCreationService.js';
export type { ShapeRestoreService } from './ports/ShapeRestoreService.js';
export type { FileStore } from './ports/FileStore.js';
export type {
  DirectoryEntry,
  DirectoryEntryKind,
  DirectoryReader,
} from './ports/DirectoryReader.js';
export type { EditorSessionPort } from './ports/EditorSessionPort.js';

// Event boundary.
export type {
  CanvasChangedEvent,
  DocumentInitializedEvent,
  DocumentReadEvent,
  DocumentSavedEvent,
  EditCommittedEvent,
  EditorEvent,
  EditorEventListener,
  RedoCommittedEvent,
  UndoCommittedEvent,
} from './events/EditorEvent.js';
export type { EditorEvents } from './events/EditorEvents.js';
export { EditorEventBus } from './events/EditorEventBus.js';

// Contract test doubles and fakes (not production implementations).
export { FakeEditorSession } from './testing/FakeEditorSession.js';
export type { FakeShapeFactory } from './testing/FakeShapeCreationService.js';
export { FakeShapeCreationService } from './testing/FakeShapeCreationService.js';
export { FakeShapeRestoreService } from './testing/FakeShapeRestoreService.js';
export { FakeDirectoryReader } from './testing/FakeDirectoryReader.js';
export { FakePluginContext } from './testing/FakePluginContext.js';
export { FaultyAttributeHandler } from './testing/FaultyAttributeHandler.js';
export { FaultyTreeDecorator } from './testing/FaultyTreeDecorator.js';
