import { BoxPlugin } from './BoxPlugin.js';

export { BoxAttributeHandler } from './BoxAttributeHandler.js';
export { BoxPlugin } from './BoxPlugin.js';
export { BoxProvider } from './BoxProvider.js';
export { BoxShape } from './BoxShape.js';
export { BoxTypeLabelDecorator } from './BoxTypeLabelDecorator.js';
export { boxManifest } from './BoxManifest.js';

/** Default export consumed by the host loader (B) and the A composition root. */
export default new BoxPlugin();
