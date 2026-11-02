import { generateFullGrid } from './vendor/sudokui/engine/generator';

export type ClueMode = 'sum' | 'product';

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
  return solution.map((_, cell) => orthogonalNeighbours(cell).reduce(
    (value, neighbour) => mode === 'sum' ? value + solution[neighbour] : value * solution[neighbour],
    mode === 'sum' ? 0 : 1,
  ));
}

export const intersectionSums = (solution: readonly number[]) => intersectionClues(solution, 'sum');
export const intersectionProducts = (solution: readonly number[]) => intersectionClues(solution, 'product');

export function generatePuzzle(random: () => number = Math.random, mode: ClueMode = 'sum'): IntersectionPuzzle {
  const solution = Array.from(generateFullGrid(random).values);
  return { solution, values: Array<number>(81).fill(0), clues: intersectionClues(solution, mode) };
}
