import { StatsPlugin } from './StatsPlugin.js';

export { StatsCommand } from './StatsCommand.js';
export { StatsPlugin } from './StatsPlugin.js';
export { StatsTally } from './StatsTally.js';
export { commandStatsManifest } from './StatsManifest.js';

/** Default export consumed by the host loader (B) and the A composition root. */
export default new StatsPlugin();
