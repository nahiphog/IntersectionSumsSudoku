import { describe, it, expect, vi } from 'vitest';
import { countVariantSolutions, VariantSolver } from '../src/variantSolver';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { digPuzzle, isLogicallySolvableForDigging, diggingGroups, type DiggingMode } from '../src/digging';
import { generatePuzzle, intersectionClues, type ClueMode } from '../src/puzzle';

const seeded = () => { let seed = 42; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; };

describe('variant uniqueness and digging', () => {
  it('retains a stalled puzzle and never falls back to search in the generation profile', () => {
    const search = vi.spyOn(VariantSolver.prototype, 'solve');
    try {
      for (const mode of ['sum', 'product'] as ClueMode[]) {
        const clues = Array<number | null>(81).fill(null);
        expect(isLogicallySolvableForDigging(clues, mode)).toBe(false);
        // Even an omitted allowSearch:false must not enable generation guesses.
        expect(solveWalkthrough(clues, mode, { profile: 'generation' }).status).toBe('stalled');
      }
      expect(search).not.toHaveBeenCalled();
    } finally { search.mockRestore(); }
  });
  it('distinguishes no solution from multiple solutions without using a saved solution', () => {
    expect(countVariantSolutions(Array(81).fill(null), 'sum')).toBe(2);
    const clues: (number | null)[] = Array(81).fill(null);
    clues[0] = 1;
    expect(countVariantSolutions(clues, 'sum')).toBe(0);
    clues[0] = 2;
    expect(countVariantSolutions(clues, 'product')).toBe(2);
    clues[0] = 11;
    expect(countVariantSolutions(clues, 'product')).toBe(0);
  });

  for (const mode of ['sum', 'product'] as ClueMode[]) for (const diggingMode of ['single', 'dual'] as DiggingMode[]) {
    it(`${mode}/${diggingMode}: digs a unique, logically solvable puzzle and preserves all source clues`, () => {
      const random = seeded();
      const initial = generatePuzzle(random, mode);
      const clues = [...initial.clues];
      const result = digPuzzle(mode, () => {}, random, initial, diggingMode);
      expect(initial.clues).toEqual(clues);
      expect(result.clues).toEqual(intersectionClues(result.solution, mode));
      expect(result.dugClues.filter(c => c !== null).length).toBeLessThan(81);
      const solver = new VariantSolver(result.dugClues, mode, result.solution);
      expect(solver.countSolutions()).toBe(1);
      const logical = solveWalkthrough(result.dugClues, mode, { allowSearch: false });
      expect(isLogicallySolvableForDigging(result.dugClues, mode)).toBe(true);
      expect(logical.status).toBe('solved');
      expect(logical.searchSteps).toBe(0);
      expect(logical.steps.at(-1)!.after.values).toEqual(result.solution);
      if (diggingMode === 'dual') result.dugClues.forEach((clue, cell) => expect(clue === null).toBe(result.dugClues[80 - cell] === null));
      for (const group of diggingGroups(diggingMode)) {
        const cell = group[0];
        if (result.dugClues[cell] === null) continue;
        expect(result.dugClues[cell]).toBe(result.clues[cell]);
        const active = Array(81).fill(true);
        for (const c of group) active[c] = false;
        const candidate = [...result.dugClues];
        for (const c of group) candidate[c] = null;
        if (isLogicallySolvableForDigging(candidate, mode)) {
          expect(solver.countSolutions(active)).toBe(2);
        }
      }
      expect(result.values).toEqual(Array(81).fill(0));
    }, 600000);
  }
});
