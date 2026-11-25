import { DirPlugin } from './DirPlugin.js';

export { DirCommand } from './DirCommand.js';
export { DirListing } from './DirListing.js';
export { DirPlugin } from './DirPlugin.js';
export { commandDirManifest } from './DirManifest.js';

/** Default export consumed by the host loader (B) and the A composition root. */
export default new DirPlugin();
