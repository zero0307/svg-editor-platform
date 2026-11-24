import {
  EditorSession,
  FakeFileStore,
  FakeShapeCreationService,
  FakeSvgCodec,
  SvgDocument,
} from '../../index.js';
import type { FakeSvgCodecOptions } from '../../index.js';
import type { EditorEvent } from '../../index.js';
import { DemoBoxProvider } from './DemoBoxProvider.js';
import { FakeLeafShape } from './FakeLeafShape.js';

/** Session wired to in-memory file and codec doubles for transaction tests. */
export const createTestSession = (
  options: FakeSvgCodecOptions = {},
  onObserverError?: (error: unknown, event: EditorEvent) => void,
) => {
  const files = new FakeFileStore();
  const codec = new FakeSvgCodec(options);
  const session = new EditorSession(files, codec, onObserverError);
  return { files, codec, session };
};

/** Creation service that knows `demo-box`, `rect` and `text`. */
export const createDemoShapes = (): FakeShapeCreationService => {
  const shapes = new FakeShapeCreationService({
    rect: (request) => new FakeLeafShape(request.id, 'rect'),
    text: (request) => new FakeLeafShape(request.id, 'text'),
  });
  shapes.register('demo-box', (request) => new DemoBoxProvider().create(request, shapes));
  return shapes;
};

/** Document with one `demo-box` composite plus a plain leaf. */
export const createDemoDocument = (boxId = 'box1'): SvgDocument => {
  const document = new SvgDocument();
  document.add(
    new DemoBoxProvider().create(
      { type: 'demo-box', id: boxId, parameters: [] },
      createDemoShapes(),
    ),
  );
  document.add(new FakeLeafShape('leaf'));
  return document;
};
