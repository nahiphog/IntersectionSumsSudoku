import type { ClueMode } from './puzzle';
import { orthogonalNeighbours } from './puzzle';
import { VariantSolver } from './variantSolver';

export function parseClues(text: string, mode: ClueMode): (number | null)[] {
  const parts = text.trim().split(',').map(s => s.trim());
  if (parts.length !== 81) throw new Error('Enter exactly 81 comma-separated clues, using 0 for empty cells.');
  return parts.map((part, cell) => {
    if (!/^\d+$/.test(part)) throw new Error(`R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}: use a non-negative whole number.`);
    const value = Number(part);
    const n = orthogonalNeighbours(cell).length;
    if (!Number.isSafeInteger(value) || value > (mode === 'sum' ? n * 9 : 9 ** n)) throw new Error(`R${Math.floor(cell / 9) + 1}C${cell % 9 + 1}: clue exceeds the possible ${mode}.`);
    return value || null;
  });
}

export function verifyClues(clues: (number | null)[], mode: ClueMode) {
  const solutions: number[][] = [];
  const count = new VariantSolver(clues, mode).countSolutions(undefined, {
    onSolution: values => solutions.push([...values]),
  });
  return { count, solutions };
}

export function maskedClues(clues: number[], selected: number[]) {
  const mask = new Set(selected);
  if (clues.length !== 81 || selected.some(c => !Number.isInteger(c) || c < 0 || c > 80)) throw new Error('Invalid clue pattern.');
  return clues.map((value, cell) => mask.has(cell) ? value : null);
}
