import { digPuzzle, type DiggingMode } from './digging';
import type { ClueMode, IntersectionPuzzle } from './puzzle';

self.onmessage = (event: MessageEvent<{ mode: ClueMode; initial?: IntersectionPuzzle; diggingMode?: DiggingMode; allowBacktracking?: boolean }>) => {
  try {
    const result = digPuzzle(event.data.mode, (progress, puzzle) => {
      self.postMessage({ type: 'progress', progress, puzzle });
    }, Math.random, event.data.initial, event.data.diggingMode, event.data.allowBacktracking);
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Generation failed.' });
  }
};
