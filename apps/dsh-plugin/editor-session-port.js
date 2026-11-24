/**
 * Minimal local stand-in for the `EditorSessionPort` used by the DSH tools.
 *
 * #5 has not created the npm workspaces yet, so this package may not import
 * `@svgframe/core` by path. The interface below is deliberately structural:
 * #16 will swap this module for the real `EditorSessionPort` from
 * `@svgframe/core` once workspaces exist, keeping the tool bodies unchanged.
 *
 * @typedef {object} EditorDocumentView
 * @property {string} rootId      Root element id of the inspected document.
 * @property {number} elementCount  Number of elements below the root.
 *
 * @typedef {object} EditorSessionPort
 * @property {string} id
 * @property {(options?: { signal?: AbortSignal }) => Promise<EditorDocumentView>} inspectDocument
 * @property {() => Promise<void>} close
 */

/**
 * Fake port used by the plugin and by the package tests. It never touches the
 * filesystem or a CLI subprocess.
 *
 * @param {{ id?: string, rootId?: string, elementCount?: number, fail?: boolean }} [seed]
 * @returns {EditorSessionPort}
 */
export function createFakeEditorSession(seed = {}) {
  const state = {
    id: seed.id ?? 'fake-session',
    rootId: seed.rootId ?? 'svg-root',
    elementCount: seed.elementCount ?? 3,
    closed: false,
  };
  return {
    get id() {
      return state.id;
    },
    /** @param {{ signal?: AbortSignal }} [options] */
    async inspectDocument(options = {}) {
      if (seed.fail === true) throw new Error('fake editor session failed on purpose');
      options.signal?.throwIfAborted();
      return { rootId: state.rootId, elementCount: state.elementCount };
    },
    async close() {
      state.closed = true;
    },
  };
}
