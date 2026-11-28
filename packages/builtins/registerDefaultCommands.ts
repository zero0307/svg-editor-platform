import { AddToCommand } from './commands/AddToCommand.js';
import { AttributeEditingService, StructureService, TreePresenter } from '@svgframe/core';
import { BackCommand } from './commands/BackCommand.js';
import { CanvasCommand } from './commands/CanvasCommand.js';
import { CreateCommand } from './commands/CreateCommand.js';
import { DeleteCommand } from './commands/DeleteCommand.js';
import { FrontCommand } from './commands/FrontCommand.js';
import { GroupCommand } from './commands/GroupCommand.js';
import { HelpCommand } from './commands/HelpCommand.js';
import { InitCommand } from './commands/InitCommand.js';
import { MoveCommand } from './commands/MoveCommand.js';
import { ReadCommand } from './commands/ReadCommand.js';
import { RedoCommand } from './commands/RedoCommand.js';
import { SaveCommand } from './commands/SaveCommand.js';
import { ScaleCommand } from './commands/ScaleCommand.js';
import { SetCommand } from './commands/SetCommand.js';
import { ShowCommand } from './commands/ShowCommand.js';
import { TreeCommand } from './commands/TreeCommand.js';
import { UndoCommand } from './commands/UndoCommand.js';
import { UngroupCommand } from './commands/UngroupCommand.js';
import type { Command, CommandRegistry } from '@svgframe/core';
import type { DefaultCommandServices } from './DefaultCommandServices.js';

/**
 * Registers the Phase 1 command set in the exact Phase 1 help order. Commands
 * carry their own usage and parameter rules; the dispatcher only sees
 * `requiresDocument` and `effect`.
 */
export function registerDefaultCommands(
  registry: CommandRegistry,
  services: DefaultCommandServices,
): void {
  const presenter = new TreePresenter(services.treeDecorators);
  const attributes = new AttributeEditingService(services.attributeHandlers);
  const structure = new StructureService();
  const commands: readonly Command[] = [
    new InitCommand(),
    new ReadCommand(),
    new SaveCommand(),
    new CanvasCommand(),
    new CreateCommand(services.shapes),
    new DeleteCommand(structure),
    new MoveCommand(),
    new ScaleCommand(),
    new SetCommand(attributes),
    new GroupCommand(structure),
    new UngroupCommand(structure),
    new AddToCommand(structure),
    new FrontCommand(),
    new BackCommand(),
    new TreeCommand(presenter),
    new ShowCommand(presenter),
    new UndoCommand(),
    new RedoCommand(),
    new HelpCommand(services.commands, services.shapeProviders),
  ];
  for (const command of commands) registry.register(command);
}
