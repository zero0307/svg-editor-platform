/**
 * The default container is the kernel's public `Group`; builtins re-exports it so
 * Phase 1 consumers keep importing `Group` from the default shape package without
 * introducing a second container type.
 */
export { Group } from '@svgframe/core';
