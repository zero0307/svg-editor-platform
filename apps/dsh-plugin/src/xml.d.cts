import type * as DOM from '@xmldom/xmldom';

// esbuild publishes these constructors inside the self-contained plug-in package.
export const DOMParser: typeof DOM.DOMParser;
export const XMLSerializer: typeof DOM.XMLSerializer;
