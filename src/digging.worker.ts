import { digPuzzle } from './digging';
import type { ClueMode, IntersectionPuzzle } from './puzzle';

self.onmessage = (event: MessageEvent<{ mode: ClueMode; initial?: IntersectionPuzzle }>) => {
  try {
    const result = digPuzzle(event.data.mode, (progress, puzzle) => {
      self.postMessage({ type: 'progress', progress, puzzle });
    }, Math.random, event.data.initial);
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Generation failed.' });
  }
};
