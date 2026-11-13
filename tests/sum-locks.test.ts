import { expect, it } from 'vitest';
import { findIntersectionLockedCandidates } from '../src/intersectionLocks';
import { VariantSolver } from '../src/variantSolver';
import { bit, emptyGrid, setValue } from '../src/vendor/sudokui/engine/board';
import { ACTIVE_TECHNIQUES, SUM_LOCK_NAME } from '../src/techniquePolicy';
import { rateWalkthrough, stepScore } from '../src/difficulty';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { tallySteps } from '../src/tally';

function fixture(target: number) {
  const clues = Array<number | null>(81).fill(null); clues[59] = target;
  const grid = emptyGrid(); setValue(grid, 50, 1); setValue(grid, 58, 1);
  return { grid, solver: new VariantSolver(clues, 'sum') };
}

it('subtracts fixed neighbours and locks a sum pair across different units', () => {
  const { grid, solver } = fixture(14);
  grid.cands[60] = grid.cands[68] = bit(3) | bit(9);
  const step = findIntersectionLockedCandidates(grid, solver, 'sum')!;
  expect(step.technique).toBe(SUM_LOCK_NAME);
  expect(step.description).toContain('14 − 1 − 1 = 12');
  expect(step.description).toContain('3, 9 in some order');
  for (const cell of [57,69,70,71]) for (const digit of [3,9]) {
    expect(step.eliminations).toContainEqual({ cell, digit });
  }
  expect(step.eliminations.some(e => [54,60,68,50,58].includes(e.cell))).toBe(false);
  expect(stepScore(step)).toBe(50);
  const explained = { ...step, before: { values: [], candidates: [] }, after: { values: [], candidates: [] }, peerEliminations: [] };
  const walk = { initial: explained.before, steps: [explained, explained], status: 'solved' as const, searchSteps: 0 };
  expect(rateWalkthrough(walk).score).toBe(100);
  expect(tallySteps(walk)).toEqual([{ name: SUM_LOCK_NAME, count: 2, points: 50 }]);
});

it('does not assume a particular pair when the sum allows alternatives', () => {
  const { grid, solver } = fixture(14);
  // Residual 12 allows 3+9, 4+8, 5+7, and 6+6; no digit is mandatory.
  expect(findIntersectionLockedCandidates(grid, solver, 'sum')).toBeNull();
  expect(findIntersectionLockedCandidates(grid, solver, 'pencilmark')).toBeNull();
});

it('preserves repeated digits in valid sum assignments', () => {
  const { grid, solver } = fixture(8);
  grid.cands[60] = grid.cands[68] = bit(3);
  const step = findIntersectionLockedCandidates(grid, solver, 'sum')!;
  expect(step.description).toContain('3, 3 in some order');
  expect(step.eliminations).toContainEqual({ cell: 57, digit: 3 });
  expect(step.eliminations.every(e => e.digit === 3)).toBe(true);
});

it.each([{ cell: 0, sum: 3, digits: [1,2], outside: 10 }, { cell: 1, sum: 6, digits: [1,2,3], outside: 11 }])(
  'supports the boundary clue at cell $cell', ({ cell, sum, digits, outside }) => {
    const clues = Array<number | null>(81).fill(null); clues[cell] = sum;
    const step = findIntersectionLockedCandidates(emptyGrid(), new VariantSolver(clues, 'sum'), 'sum')!;
    for (const digit of digits) expect(step.eliminations).toContainEqual({ cell: outside, digit });
    expect(step.neighbourOrder).toHaveLength(digits.length);
  },
);

it('uses the approved repertoire and preserves the solution on a sparse sum puzzle', () => {
  const clues = Array<number | null>(81).fill(null);
  for (const [cell, clue] of Object.entries({ 0:3, 18:11, 21:20, 25:24, 27:15, 28:22, 31:19, 35:25, 39:20, 42:15, 43:28, 49:22, 50:15, 56:11, 61:20, 68:16, 80:15 })) clues[Number(cell)] = clue;
  const walk = solveWalkthrough(clues, 'sum');
  expect(walk.status).toBe('solved');
  expect(walk.steps.some(step => step.technique === SUM_LOCK_NAME)).toBe(true);
  const solution = walk.steps.at(-1)!.after.values;
  for (const step of walk.steps) {
    expect(ACTIVE_TECHNIQUES.map(info => info.name)).toContain(step.technique);
    for (const removal of [...step.eliminations, ...step.peerEliminations]) expect(removal.digit).not.toBe(solution[removal.cell]);
  }
}, 60000);
