import { expect, it } from 'vitest';
import { findProductEquationStep } from '../src/productEquations';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { bit, emptyGrid, setValue } from '../src/vendor/sudokui/engine/board';
import { parseClues } from '../src/lab';
import { stepScore } from '../src/difficulty';
import { VariantSolver } from '../src/variantSolver';
import { generatePuzzle } from '../src/puzzle';

it('cancels the 140 and 144 clues to force 4/9 and excludes the same-box 6/6 pair', () => {
  const clues = Array<number | null>(81).fill(null);
  clues[47] = 140; clues[55] = 144;
  const grid = emptyGrid(); setValue(grid, 38, 7); setValue(grid, 48, 5);
  grid.cands[54] = grid.cands[64] = [1,2,4,6,9].reduce((mask, d) => mask | bit(d), 0);
  const step = findProductEquationStep(grid, clues)!;
  expect(step.description).toContain('R7C1 × R8C2 = 144 ÷ 4 = 36');
  for (const cell of [54,64]) for (const digit of [1,2,6]) expect(step.eliminations).toContainEqual({ cell, digit });
  expect(step.eliminations).toHaveLength(6);
  expect(stepScore(step)).toBe(10);
});

it('uses combined products on the supplied puzzle without search', () => {
  const clues = parseClues('0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,56,0,0,0,2646,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,648,0,24,0,0,0,0,140,0,0,0,0,0,0,0,144,0,0,0,0,75,0,0,0,0,0,378,0,0,36,0,0,0,0,0,0,0,0,0,0,0', 'product');
  const walk = solveWalkthrough(clues, 'product', { allowSearch: false });
  const combined = walk.steps.filter(s => s.technique === 'Combined product equations');
  expect(combined.length).toBeGreaterThan(0);
  expect(combined.some(s => s.description.includes('R7C1 × R8C2 = 144 ÷ 4 = 36'))).toBe(true);
  expect(walk.searchSteps).toBe(0);
  // Independently reject every removed candidate with the exact variant solver.
  const solver = new VariantSolver(clues, 'product');
  for (const step of combined) for (const { cell, digit } of step.eliminations) {
    const domains = Uint16Array.from(step.before.candidates, (mask, c) => step.before.values[c] ? bit(step.before.values[c]) : mask);
    domains[cell] = bit(digit);
    expect(solver.countSolutions(undefined, { domains, limit: 1 })).toBe(0);
  }
});

it('preserves known valid completions across generated product grids', () => {
  let seed = 42;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 12; trial++) {
    const puzzle = generatePuzzle(random, 'product');
    const grid = emptyGrid();
    for (let c = 0; c < 81; c++) if (random() < 0.25) setValue(grid, c, puzzle.solution[c]);
    const step = findProductEquationStep(grid, puzzle.clues);
    for (const e of step?.eliminations ?? []) expect(e.digit).not.toBe(puzzle.solution[e.cell]);
  }
});
