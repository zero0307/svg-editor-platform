import { SvgExtension } from './SvgExtension.js';

let extension: SvgExtension | undefined;

/** Extension Host entry point. Called once per activation. */
export function activate(): void {
  extension = new SvgExtension();
  extension.activate();
}

/** Releases the providers registered above; safe to call without activation. */
export function deactivate(): void {
  extension?.deactivate();
  extension = undefined;
}
