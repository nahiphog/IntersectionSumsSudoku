import { expect, it } from 'vitest';
import { clueValue, generatePuzzle, intersectionClues, orthogonalNeighbours, serializeClues } from '../src/puzzle';
import { parseClues } from '../src/lab';
import { VariantSolver } from '../src/variantSolver';
import { verifyWithSat } from '../src/satVerifier';
import { findConstraintStep, solveWalkthrough } from '../src/walkthroughSolver';
import { emptyGrid, digitsOf } from '../src/vendor/sudokui/engine/board';
import { digPuzzle } from '../src/digging';

const random = () => { let state = 42; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };

it('preserves the exact multiset in the R7C3 example and excludes the clue cell', () => {
  const clues = Array<number | null>(81).fill(null); clues[56] = 1688;
  const solver = new VariantSolver(clues, 'pencilmark');
  const option = solver.clueOptions()[0];
  expect([...option.neighbours].sort((a,b) => a-b)).toEqual([47,55,57,65]);
  expect(option.tuples.length).toBeGreaterThan(0);
  for (const tuple of option.tuples) expect(tuple.map(mask => digitsOf(mask)[0]).sort()).toEqual([1,6,8,8]);
  const step = findConstraintStep(emptyGrid(), solver, 'pencilmark')!;
  expect(step.technique).toBe('Intersection pencilmarks');
  expect(step.description).toContain('1, 6, 8, 8');
  expect(step.eliminations).toContainEqual({ cell: 47, digit: 2 });
  expect(clueValue([8,1,8,6], 'pencilmark')).toBe(1688);
});

it('validates clue lengths and digits and accepts unordered lists', () => {
  const clues = Array(81).fill(0); clues[0] = 21; clues[1] = 321; clues[56] = 8816;
  const parsed = parseClues(clues.join(','), 'pencilmark');
  expect([parsed[0], parsed[1], parsed[56]]).toEqual([12,123,1688]);
  for (const [cell, value] of [[0,123], [1,12], [56,168], [56,1088]]) {
    const invalid = Array(81).fill(0); invalid[cell] = value;
    expect(() => parseClues(invalid.join(','), 'pencilmark')).toThrow(/pencilmark digits/);
  }
  const impossible = Array<number | null>(81).fill(null); impossible[0] = 11;
  expect(new VariantSolver(impossible, 'pencilmark').countSolutions()).toBe(0);
});

it('generates, verifies, and explains complete pencilmark puzzles', () => {
  const puzzle = generatePuzzle(random(), 'pencilmark');
  puzzle.clues.forEach((clue, cell) => {
    expect(String(clue).length).toBe(orthogonalNeighbours(cell).length);
  });
  expect(parseClues(serializeClues(puzzle.clues), 'pencilmark')).toEqual(puzzle.clues);
  expect(new VariantSolver(puzzle.clues, 'pencilmark', puzzle.solution).countSolutions()).toBe(1);
  const result = verifyWithSat(puzzle.clues, 'pencilmark');
  expect(result.count).toBe(1);
  expect(result.solutions).toEqual([puzzle.solution]);
  const walk = solveWalkthrough(puzzle.clues, 'pencilmark', { allowSearch: false });
  expect(walk.status).toBe('solved');
  expect(walk.steps.some(step => step.technique === 'Intersection pencilmarks')).toBe(true);
  expect(walk.steps.at(-1)!.after.values).toEqual(puzzle.solution);
  for (const step of walk.steps) for (const removal of [...step.eliminations, ...step.peerEliminations]) {
    expect(removal.digit).not.toBe(puzzle.solution[removal.cell]);
  }
});

it('digs pencilmark puzzles while retaining a unique completion', () => {
  const puzzle = digPuzzle('pencilmark', undefined, random());
  expect(puzzle.dugClues.filter(clue => clue !== null).length).toBeLessThan(81);
  expect(new VariantSolver(puzzle.dugClues, 'pencilmark').countSolutions()).toBe(1);
  const calculated = intersectionClues(puzzle.solution, 'pencilmark');
  puzzle.dugClues.forEach((clue, cell) => { if (clue !== null) expect(clue).toBe(calculated[cell]); });
}, 60000);
