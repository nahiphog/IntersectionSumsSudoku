import { expect, it } from 'vitest';
import { findIntersectionLockedCandidates } from '../src/intersectionLocks';
import { VariantSolver } from '../src/variantSolver';
import { bit, emptyGrid, setValue } from '../src/vendor/sudokui/engine/board';
import { ACTIVE_TECHNIQUES, PENCILMARK_LOCK_NAME } from '../src/techniquePolicy';
import { rateWalkthrough, stepScore } from '../src/difficulty';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { tallySteps } from '../src/tally';
import { digPuzzle } from '../src/digging';

it('locks the remaining pencilmark pair across different Sudoku units at 50 points per use', () => {
  const clues = Array<number | null>(81).fill(null); clues[59] = 1139;
  const grid = emptyGrid(); setValue(grid, 50, 1); setValue(grid, 58, 1);
  const step = findIntersectionLockedCandidates(grid, new VariantSolver(clues, 'pencilmark'), 'pencilmark')!;
  expect(step.technique).toBe(PENCILMARK_LOCK_NAME);
  expect(step.description).toContain('3, 9 in some order');
  expect(step.description).not.toContain('÷');
  for (const cell of [57,69,70,71]) for (const digit of [3,9]) {
    expect(step.eliminations).toContainEqual({ cell, digit });
  }
  expect(step.eliminations.some(e => [54,60,68,50,58].includes(e.cell))).toBe(false);
  expect(step.eliminations.every(e => [3,9].includes(e.digit))).toBe(true);
  expect(stepScore(step)).toBe(50);
  const explained = { ...step, before: { values: [], candidates: [] }, after: { values: [], candidates: [] }, peerEliminations: [] };
  const walk = { initial: explained.before, steps: [explained, explained], status: 'solved' as const, searchSteps: 0 };
  expect(rateWalkthrough(walk).score).toBe(100);
  expect(tallySteps(walk)).toEqual([{ name: PENCILMARK_LOCK_NAME, count: 2, points: 50 }]);
});

it('keeps repeated digits and consumes only one occurrence for a solved neighbour', () => {
  const clues = Array<number | null>(81).fill(null); clues[56] = 1688;
  const grid = emptyGrid();
  const solver = new VariantSolver(clues, 'pencilmark');
  const before = findIntersectionLockedCandidates(grid, solver, 'pencilmark')!;
  expect(before.description).toContain('1, 6, 8, 8 in some order');
  setValue(grid, 47, 8);
  const after = findIntersectionLockedCandidates(grid, solver, 'pencilmark')!;
  expect(after.description).toContain('1, 6, 8 in some order');
  expect(after.description).toContain('Remove one occurrence');
  expect(after.eliminations).toContainEqual({ cell: 54, digit: 8 });
  expect(after.eliminations.some(e => [47,55,57,65].includes(e.cell))).toBe(false);
});

it.each([{ cell: 0, clue: 12, digits: [1,2], outside: 10 }, { cell: 1, clue: 123, digits: [1,2,3], outside: 11 }])(
  'handles pencilmark boundary clue $clue at cell $cell', ({ cell, clue, digits, outside }) => {
    const clues = Array<number | null>(81).fill(null); clues[cell] = clue;
    const step = findIntersectionLockedCandidates(emptyGrid(), new VariantSolver(clues, 'pencilmark'), 'pencilmark')!;
    for (const digit of digits) expect(step.eliminations).toContainEqual({ cell: outside, digit });
    expect(step.neighbourOrder).toHaveLength(digits.length);
  },
);

it('rejects inconsistent pencilmarks rather than making eliminations', () => {
  const clues = Array<number | null>(81).fill(null); clues[59] = 1139;
  const grid = emptyGrid(); setValue(grid, 50, 2);
  expect(() => findIntersectionLockedCandidates(grid, new VariantSolver(clues, 'pencilmark'), 'pencilmark')).toThrow(/no valid combination/);
});

it('preserves a generated pencilmark solution and uses only listed techniques', () => {
  let seed = 42;
  const puzzle = digPuzzle('pencilmark', undefined, () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; });
  const walk = solveWalkthrough(puzzle.dugClues, 'pencilmark', { completion: puzzle.solution });
  expect(walk.status).toBe('solved');
  expect(walk.steps.at(-1)!.after.values).toEqual(puzzle.solution);
  expect(walk.steps.some(step => step.technique === PENCILMARK_LOCK_NAME)).toBe(true);
  for (const step of walk.steps) {
    expect(ACTIVE_TECHNIQUES.map(info => info.name)).toContain(step.technique);
    for (const removal of [...step.eliminations, ...step.peerEliminations]) expect(removal.digit).not.toBe(puzzle.solution[removal.cell]);
  }
}, 60000);
