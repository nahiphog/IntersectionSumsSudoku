import { expect, it, vi } from 'vitest';
import * as sat from '../src/satVerifier';
it('falls back to exact search instead of treating SAT failure as uniqueness', async () => {
  const messages: { type: string; count?: number; solutions?: number[][] }[] = [];
  const worker = { onmessage: undefined as unknown as (event: unknown) => void };
  vi.stubGlobal('self', worker); vi.stubGlobal('postMessage', (message: typeof messages[number]) => messages.push(message));
  const failure = vi.spyOn(sat, 'verifyWithSat').mockImplementation(() => { throw new Error('Resource failure'); });
  try {
    await import('../src/lab.worker');
    worker.onmessage({ data: { task: 'verify', mode: 'sum', clues: Array(81).fill(null) } });
    expect(messages[0].type).toBe('progress');
    expect(messages.at(-1)?.type).toBe('verified');
    expect(messages.at(-1)?.count).toBe(2);
    expect(messages.at(-1)?.solutions).toHaveLength(2);
  } finally { failure.mockRestore(); vi.unstubAllGlobals(); }
});
