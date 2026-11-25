import { ModifiedStarPlugin } from './ModifiedStarPlugin.js';

export { contentSnapshot, dirtyIds } from './ContentSnapshot.js';
export type { ContentSnapshot } from './ContentSnapshot.js';
export { ModifiedStarDecorator } from './ModifiedStarDecorator.js';
export { ModifiedStarPlugin } from './ModifiedStarPlugin.js';
export { modifiedStarManifest } from './ModifiedStarManifest.js';

/** Default export consumed by the host loader (B) and the A composition root. */
export default new ModifiedStarPlugin();
