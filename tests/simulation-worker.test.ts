import { afterEach, expect, it, vi } from 'vitest';
import { generatePuzzle, type ClueMode } from '../src/puzzle';
import { digPuzzle } from '../src/digging';
import type { LabRequest } from '../src/lab.worker';

vi.mock('../src/digging', () => ({ digPuzzle: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks(); });

for (const mode of ['sum', 'product', 'pencilmark'] as ClueMode[]) {
  it(`rates every ${mode} simulation sample without a separate rating flag`, async () => {
    let seed = 42;
    const puzzle = generatePuzzle(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }, mode);
    vi.mocked(digPuzzle).mockReturnValue({ ...puzzle, dugClues: puzzle.clues } as ReturnType<typeof digPuzzle>);
    const worker = { onmessage: undefined as unknown as (event: { data: LabRequest }) => void };
    const post = vi.fn();
    vi.stubGlobal('self', worker); vi.stubGlobal('postMessage', post);
    await import('../src/lab.worker');
    worker.onmessage({ data: { task: 'simulation', mode, trials: 1, digging: 'single', allowSearch: false } });
    const messages = post.mock.calls.map(([message]) => message);
    expect(messages.some(message => message.type === 'error')).toBe(false);
    const sample = messages.find(message => message.type === 'sample');
    expect(sample.clues).toEqual(puzzle.clues);
    expect(sample.rating.complete).toBe(true);
    expect(sample.rating.level).toBeTypeOf('string');
    expect(sample.rating.score).toBeGreaterThan(0);
    expect(messages.at(-1)).toEqual({ type: 'complete' });
  });
}
