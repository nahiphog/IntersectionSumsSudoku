import { describe, expect, it } from 'vitest';
import { solveWalkthrough, findConstraintStep, type Walkthrough } from '../src/walkthroughSolver';
import { generatePuzzle, intersectionClues, type ClueMode } from '../src/puzzle';

import { VariantSolver } from '../src/variantSolver';
import { emptyGrid, bit, UNITS } from '../src/vendor/sudokui/engine/board';

function random() { let state = 42; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
function verify(walk: Walkthrough, solution: number[]) {
  expect(walk.status).toBe('solved');
  expect(walk.initial.values).toEqual(Array(81).fill(0));
  expect(walk.steps.some(s => s.kind === 'constraint')).toBe(true);
  expect(walk.steps.some(s => s.kind === 'sudoku')).toBe(true);
  walk.steps.forEach((step, index) => {
    expect(step.before).toEqual(index ? walk.steps[index - 1].after : walk.initial);
    for (const { cell, digit } of [...step.eliminations, ...step.peerEliminations]) expect(digit).not.toBe(solution[cell]);
    for (const { cell, digit } of step.placements) expect(digit).toBe(solution[cell]);
    for (let cell = 0; cell < 81; cell++) {
      if (step.after.values[cell]) expect(step.after.values[cell]).toBe(solution[cell]);
      else expect(step.after.candidates[cell] & bit(solution[cell])).not.toBe(0);
    }
    expect(step.description.length).toBeGreaterThan(10);
  });
  expect(walk.steps.at(-1)!.after.values).toEqual(solution);
}

describe('explained variant solver', () => {
  for (const mode of ['sum', 'product'] as ClueMode[]) {
    it(`${mode}: combines clue deductions and imported techniques without a supplied answer`, () => {
      const puzzle = generatePuzzle(random(), mode);
      const clues = [...puzzle.clues];
      verify(solveWalkthrough(clues, mode), puzzle.solution);
      expect(clues).toEqual(puzzle.clues);
    }, 60000);
  }
  it('solves a 17-clue sum fixture produced by seeded digging', () => {
    const clues = Array<number | null>(81).fill(null);
    for (const [cell, clue] of Object.entries({ 0:3, 18:11, 21:20, 25:24, 27:15, 28:22, 31:19, 35:25, 39:20, 42:15, 43:28, 49:22, 50:15, 56:11, 61:20, 68:16, 80:15 })) clues[Number(cell)] = clue;
    const puzzle = generatePuzzle(random(), 'sum');
    expect(clues).toHaveLength(81);
    clues.forEach((clue, cell) => { if (clue !== null) expect(clue).toBe(puzzle.clues[cell]); });
    verify(solveWalkthrough(clues, 'sum'), puzzle.solution);
  }, 120000);
  it('explains neighbour combinations and locked digits, and rejects impossible clues', () => {
    const clues: (number | null)[] = Array(81).fill(null); clues[0] = 3;
    const grid = emptyGrid();
    const step = findConstraintStep(grid, new VariantSolver(clues, 'sum'), 'sum')!;
    expect(step.neighbourOrder).toEqual([1, 9]);
    expect(step.combinations).toEqual([[1, 2], [2, 1]]);
    expect(step.eliminations.filter(e => [1, 9].includes(e.cell)).every(e => e.digit > 2)).toBe(true);
    expect(step.eliminations).toContainEqual({cell:0,digit:1});
    clues[0] = 1;
    expect(() => solveWalkthrough(clues, 'sum')).toThrow(/no valid combination/);
  });
  it('backtracking respects the current candidate domains and both kinds of clues', () => {
    for (const mode of ['sum', 'product'] as ClueMode[]) {
      const puzzle = generatePuzzle(random(), mode);
      const solver = new VariantSolver(puzzle.clues, mode);
      const result = solver.solve(new Uint16Array(81).fill(511))!;
      expect([...result]).toEqual(puzzle.solution);
      expect(intersectionClues([...result], mode)).toEqual(puzzle.clues);
      for (const unit of UNITS) expect(new Set(unit.map(cell => result[cell])).size).toBe(9);
      const impossible = new Uint16Array(81).fill(511);
      impossible[0] &= ~bit(puzzle.solution[0]);
      expect(solver.solve(impossible)).toBeNull();
    }
  });
});

