import { solveWalkthrough } from './walkthroughSolver';
import type { ClueMode } from './puzzle';

self.onmessage = (event: MessageEvent<{ clues: (number | null)[]; mode: ClueMode; allowSearch: boolean }>) => {
  try {
    let last = 0;
    const result = solveWalkthrough(event.data.clues, event.data.mode, {
      allowSearch: event.data.allowSearch,
      onProgress: (steps, message) => {
        if (performance.now() - last < 100) return;
        last = performance.now();
        self.postMessage({ type: 'progress', steps, message });
      },
    });
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
