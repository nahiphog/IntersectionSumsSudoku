import { expect, it } from 'vitest';
import { bit, emptyGrid } from '../src/vendor/sudokui/engine/board';
import { findStep, applyStep } from '../src/vendor/sudokui/engine/humanSolver';
import { describeSudokuStep } from '../src/walkthroughSolver';
import { stepScore } from '../src/difficulty';

function fixture(cells: number[]) {
  const grid = emptyGrid();
  for (const cell of cells) grid.cands[cell] = bit(1) | bit(2);
  return grid;
}

it('eliminates both remote-pair digits from cells seeing opposite groups', () => {
  const grid = fixture([0, 3, 30, 33]);
  const step = findStep('REMOTE_PAIR', grid)!;
  expect(step.tech).toBe('REMOTE_PAIR');
  expect(step.eliminations).toContainEqual({ cell: 6, digit: 1 });
  expect(step.eliminations).toContainEqual({ cell: 6, digit: 2 });
  expect(step.eliminations.some(candidate => candidate.cell === 9)).toBe(false);
  expect(step.eliminations.some(candidate => [0, 3, 30, 33].includes(candidate.cell))).toBe(false);
  expect(step.eliminations.every(candidate => [1, 2].includes(candidate.digit))).toBe(true);
  applyStep(grid, step);
  expect(grid.cands[6] & (bit(1) | bit(2))).toBe(0);
  expect(grid.cands[6] & bit(3)).toBe(bit(3));
  const description = describeSudokuStep(step);
  expect(description).toContain('Group A');
  expect(description).toContain('group B');
  expect(description).not.toContain('purple');
  expect(stepScore({ kind: 'sudoku', technique: 'Remote Pair' })).toBe(110);
});

it('does not connect disconnected pairs or accept contradictory odd cycles', () => {
  expect(findStep('REMOTE_PAIR', fixture([0, 3, 55, 58]))).toBeNull();
  expect(findStep('REMOTE_PAIR', fixture([0, 1, 2, 3]))).toBeNull();
});
