import { expect, it, vi } from 'vitest';
import type { Walkthrough, ExplainedStep } from '../src/walkthroughSolver';
import { intersectionClues } from '../src/puzzle';

it('streams ordered walkthrough batches before the final result', async () => {
  const messages: { type: string; batch?: ExplainedStep[]; result?: Walkthrough }[] = [];
  const worker = { onmessage: undefined as unknown as (event: unknown) => void, postMessage: (message: typeof messages[number]) => messages.push(message) };
  vi.stubGlobal('self', worker);
  try {
    await import('../src/walkthrough.worker');
    const solution = Array.from({ length: 81 }, (_, i) => (Math.floor(i / 9) * 3 + Math.floor(i / 27) + i % 9) % 9 + 1);
    worker.onmessage({ data: { clues: intersectionClues(solution, 'product'), mode: 'product', allowSearch: true } });
    const final = messages.at(-1)!;
    expect(final.type).toBe('complete');
    expect(final.result!.status).toBe('solved');
    const streamed = messages.flatMap(message => message.batch ?? []);
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed).toEqual(final.result!.steps.slice(0, streamed.length));
  } finally { vi.unstubAllGlobals(); }
});
