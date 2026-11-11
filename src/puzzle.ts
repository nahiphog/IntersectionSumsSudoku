import { generateFullGrid } from './vendor/sudokui/engine/generator';

export type ClueMode = 'sum' | 'product' | 'pencilmark';

export const PENCILMARK_DESCRIPTION = 'Pencilmark mode:  The clue indicates which numbers must be placed in the orthogonally adjacent cells.';

export function clueValue(digits: readonly number[], mode: ClueMode): number {
  if (mode === 'pencilmark') return Number([...digits].sort((a, b) => a - b).join(''));
  return digits.reduce((value, digit) => mode === 'sum' ? value + digit : value * digit, mode === 'sum' ? 0 : 1);
}

export function serializeSolution(solution: readonly number[]): string {
  if (solution.length !== 81 || solution.some(d => !Number.isInteger(d) || d < 1 || d > 9)) {
    throw new Error('Expected 81 completed Sudoku digits.');
  }
  return solution.join('');
}

/** Row-major export: empty cells become zero; clue values stay intact. */
export function serializeClues(clues: readonly (number | null)[]): string {
  if (clues.length !== 81) throw new Error('Expected 81 clue cells.');
  return clues.map(clue => clue ?? 0).join(',');
}

export interface IntersectionPuzzle {
  solution: number[];
  values: number[];
  clues: number[];
}

/** Only neighbours sharing an edge; never wrap between rows. */
export function orthogonalNeighbours(cell: number): number[] {
  if (!Number.isInteger(cell) || cell < 0 || cell >= 81) throw new RangeError('Cell must be 0–80.');
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  const neighbours: number[] = [];
  if (row > 0) neighbours.push(cell - 9);
  if (col > 0) neighbours.push(cell - 1);
  if (col < 8) neighbours.push(cell + 1);
  if (row < 8) neighbours.push(cell + 9);
  return neighbours;
}

export function intersectionClues(solution: readonly number[], mode: ClueMode): number[] {
  if (solution.length !== 81 || solution.some(d => !Number.isInteger(d) || d < 1 || d > 9)) {
    throw new Error('Expected 81 completed Sudoku digits.');
  }
  return solution.map((_, cell) => clueValue(orthogonalNeighbours(cell).map(neighbour => solution[neighbour]), mode));
}

export const intersectionSums = (solution: readonly number[]) => intersectionClues(solution, 'sum');
export const intersectionProducts = (solution: readonly number[]) => intersectionClues(solution, 'product');

export function generatePuzzle(random: () => number = Math.random, mode: ClueMode = 'sum'): IntersectionPuzzle {
  const solution = Array.from(generateFullGrid(random).values);
  return { solution, values: Array<number>(81).fill(0), clues: intersectionClues(solution, mode) };
}
