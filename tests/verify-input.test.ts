import { afterEach, expect, it, vi } from 'vitest';
import { bindPuzzleString } from '../src/verifyInput';

const puzzle = '0,0,0,0,0,0,17,0,0,0,0,16,0,0,19,0,0,0,0,19,0,16,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,30,0,0,0,0,0,0,18,0,27,0,0,0,0,0,0,20,0,0,0,0,15,0,0,0,0,14,0,0,0,17,0,18,0,0,0,0,0,0,0,0,0';

afterEach(() => vi.unstubAllGlobals());

function setup(value = '') {
  const input = Object.assign(new EventTarget(), { value, setAttribute: vi.fn(), removeAttribute: vi.fn() });
  const feedback = { textContent: '' };
  const fillGrid = vi.fn();
  const windowEvents = new EventTarget();
  vi.stubGlobal('window', windowEvents);
  bindPuzzleString(input as unknown as HTMLTextAreaElement, () => 'sum', fillGrid, feedback as HTMLElement);
  return { input, feedback, fillGrid, windowEvents };
}

it.each(['input', 'change', 'pageshow'])('synchronizes the supplied puzzle on %s', event => {
  const { input, fillGrid, feedback, windowEvents } = setup();
  input.value = puzzle;
  (event === 'pageshow' ? windowEvents : input).dispatchEvent(new Event(event));
  expect(fillGrid).toHaveBeenLastCalledWith(puzzle.split(',').map(value => Number(value) || null));
  expect(feedback.textContent).toBe('');
});

it('synchronizes an already populated string on initialization', () => {
  const { fillGrid } = setup(puzzle);
  expect(fillGrid).toHaveBeenLastCalledWith(puzzle.split(',').map(value => Number(value) || null));
});

it('explains malformed input, recovers on valid input, and clears the grid', () => {
  const { input, feedback, fillGrid } = setup();
  input.value = '0,1';
  input.dispatchEvent(new Event('input'));
  expect(feedback.textContent).toContain('exactly 81');
  input.value = puzzle;
  input.dispatchEvent(new Event('input'));
  expect(feedback.textContent).toBe('');
  input.value = '';
  input.dispatchEvent(new Event('input'));
  expect(fillGrid).toHaveBeenLastCalledWith(Array(81).fill(null));
});

