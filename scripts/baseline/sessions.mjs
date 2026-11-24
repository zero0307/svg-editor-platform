/**
 * Four Phase 1 sessions frozen by TASK-QA-01. Inputs live in doc/transcript (commands and
 * comments only); fixtures live under test/fixtures. `dir` has no Phase 1 command, so its
 * baseline is the documented "unknown command" fallback.
 */
export const goldenRoot = 'test/fixtures/expected/baseline-final';

export const sessions = [
  {
    name: 'basic',
    transcript: 'doc/transcript/baseline-basic.txt',
    seedFiles: ['test/fixtures/svg/other.svg'],
    description:
      'Phase 1 §6 basic session: shapes, group, tree, undo/redo, attribute, failure, save, import',
  },
  {
    name: 'flowchart',
    transcript: 'doc/transcript/baseline-flowchart.txt',
    description:
      'Phase 1 §6.1A manual flowchart: containers, in-clause, container move, nested text edit',
  },
  {
    name: 'io',
    transcript: 'doc/transcript/baseline-io.txt',
    seedFiles: ['test/fixtures/svg/other.svg'],
    description: 'IO barrier, failure continues, remembered save path',
  },
  {
    name: 'dir',
    transcript: 'doc/transcript/baseline-dir.txt',
    seedTree: 'test/fixtures/dir/tree',
    description:
      'P2 dir command on the frozen directory fixture; Phase 1 fallback is unknown command',
  },
];
