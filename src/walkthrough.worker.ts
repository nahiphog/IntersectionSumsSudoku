import { solveWalkthrough, type ExplainedStep, type Snapshot } from './walkthroughSolver';
import type { ClueMode } from './puzzle';

self.onmessage = (event: MessageEvent<{ clues: (number | null)[]; mode: ClueMode; allowSearch: boolean; completion?: number[] }>) => {
  try {
    let last = 0;
    let pending: ExplainedStep[] = [];
    let initial: Snapshot | undefined;
    let first = true;
    const flush = () => {
      if (!pending.length) return;
      self.postMessage({ type: 'step', batch: pending, initial }); pending = [];
    };
    const result = solveWalkthrough(event.data.clues, event.data.mode, {
      allowSearch: event.data.allowSearch,
      completion: event.data.completion,
      onStep: (step, start) => {
        initial = start; pending.push(step);
        if (first || performance.now() - last >= 100) { first = false; flush(); }
      },
      onProgress: (steps, message) => {
        // Publish all deductions before entering a potentially long finder/search.
        if (message.startsWith('Checking ') || message.startsWith('Logical techniques stalled')) flush();
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
