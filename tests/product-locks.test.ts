import { expect, it } from 'vitest';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { parseClues } from '../src/lab';
import { findProductLockedCandidates } from '../src/productLocks';
import { VariantSolver } from '../src/variantSolver';
import { bit, emptyGrid, setValue } from '../src/vendor/sudokui/engine/board';
import { ACTIVE_TECHNIQUES, PRODUCT_LOCK_NAME } from '../src/techniquePolicy';
import { rateWalkthrough, stepScore } from '../src/difficulty';
import { tallySteps } from '../src/tally';

const puzzle = '0,0,0,0,0,0,0,135,0,0,0,0,2520,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,896,0,0,0,21,3024,0,0,0,0,0,0,0,960,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,27,0,0,0,180,0,0,0,0,1440,0,0,0,0,0,0,0,0,0,0,0,0';

it('uses product locks before resorting to search on the supplied puzzle', () => {
  const clues = parseClues(puzzle, 'product');
  const walk = solveWalkthrough(clues, 'product');
  for (const step of walk.steps) expect(ACTIVE_TECHNIQUES.map(info => info.name)).toContain(step.technique);
  expect(walk.steps.some(step => step.technique === 'Forcing Net')).toBe(false);
  const lock = walk.steps.find(step => step.technique === PRODUCT_LOCK_NAME && step.clueCell === 59)!;
  expect(lock).toBeDefined();
  expect(lock.description).toContain('27 ÷ 1 ÷ 1 = 27');
  expect(lock.description).toContain('3, 9 in some order');
  expect(lock.eliminations).toContainEqual({ cell: 57, digit: 3 });
  expect(lock.eliminations).toContainEqual({ cell: 69, digit: 9 });
  expect(lock.eliminations).toContainEqual({ cell: 70, digit: 3 });
  expect(lock.eliminations).toContainEqual({ cell: 71, digit: 3 });
  const firstSearch = walk.steps.findIndex(step => step.kind === 'search');
  expect(firstSearch === -1 || firstSearch > walk.steps.indexOf(lock)).toBe(true);
  expect(walk.status).toBe('solved');
  const solution = walk.steps.at(-1)!.after.values;
  for (const step of walk.steps) for (const removal of [...step.eliminations, ...step.peerEliminations]) {
    expect(removal.digit).not.toBe(solution[removal.cell]);
  }
  const locks = walk.steps.filter(step => step.technique === PRODUCT_LOCK_NAME);
  expect(locks.every(step => stepScore(step) === 50)).toBe(true);
  expect(rateWalkthrough({ status: 'solved', steps: [lock, lock] }).score).toBe(100);
  expect(tallySteps(walk)).toContainEqual({ name: PRODUCT_LOCK_NAME, count: locks.length, points: 50 });
});

it('removes both pair digits from all four cited cells across different units', () => {
  const clues = Array<number | null>(81).fill(null); clues[59] = 27;
  const grid = emptyGrid(); setValue(grid, 50, 1); setValue(grid, 58, 1);
  grid.cands[60] = grid.cands[68] = bit(3) | bit(9);
  const step = findProductLockedCandidates(grid, new VariantSolver(clues, 'product'), 'product')!;
  for (const cell of [57,69,70,71]) for (const digit of [3,9]) {
    expect(step.eliminations).toContainEqual({ cell, digit });
  }
  // R7C1 sees R7C7 but not R8C6; the pair cells themselves stay intact.
  expect(step.eliminations.some(e => [54,60,68].includes(e.cell))).toBe(false);
  expect(step.eliminations.every(e => e.digit === 3 || e.digit === 9)).toBe(true);
});

it('requires a digit in every combination and is exclusive to product mode', () => {
  const clues = Array<number | null>(81).fill(null); clues[59] = 36;
  const grid = emptyGrid(); setValue(grid, 50, 1); setValue(grid, 58, 1);
  // Remaining factors can be 4×9, 9×4, or 6×6: no mandatory digit.
  const solver = new VariantSolver(clues, 'product');
  expect(findProductLockedCandidates(grid, solver, 'product')).toBeNull();
  clues[59] = 27;
  const pairSolver = new VariantSolver(clues, 'product');
  expect(findProductLockedCandidates(grid, pairSolver, 'sum')).toBeNull();
  expect(findProductLockedCandidates(grid, pairSolver, 'pencilmark')).toBeNull();
});
