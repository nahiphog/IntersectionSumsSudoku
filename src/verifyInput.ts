import { parseClues } from './lab';
import type { ClueMode } from './puzzle';

export function bindPuzzleString(
  input: HTMLTextAreaElement,
  mode: () => ClueMode,
  fillGrid: (clues: (number | null)[]) => void,
  feedback: HTMLElement,
) {
  const sync = () => {
    try {
      const clues = input.value.trim() ? parseClues(input.value, mode()) : Array(81).fill(null);
      fillGrid(clues);
      feedback.textContent = '';
      input.removeAttribute('aria-invalid');
    } catch (error) {
      feedback.textContent = (error as Error).message;
      input.setAttribute('aria-invalid', 'true');
    }
  };
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  window.addEventListener('pageshow', sync);
  sync();
  return sync;
}
