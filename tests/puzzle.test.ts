import { describe, expect, it } from 'vitest';
import { generatePuzzle, intersectionSums, intersectionProducts, orthogonalNeighbours } from '../src/puzzle';
import { UNITS, parseGrid, gridToString, isSolved, findNextStep, applyStep, ALL_TECHS, TECHS, findStep } from '../src/solver';

describe('Intersection Sums generation', () => {
  it('calculates products for every cell, including corners and edges', () => {
    for (let run = 0; run < 25; run++) {
      const puzzle = generatePuzzle(Math.random, 'product');
      expect(puzzle.values).toEqual(Array(81).fill(0));
      expect(puzzle.clues).toEqual(intersectionProducts(puzzle.solution));
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const neighbours = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([y,x]) => y >= 0 && y < 9 && x >= 0 && x < 9);
        expect(puzzle.clues[r*9+c]).toBe(neighbours.reduce((product,[y,x]) => product * puzzle.solution[y*9+x], 1));
      }
    }
    expect(() => intersectionProducts([1,2,3])).toThrow();
  });
  it('generates varied valid complete grids and 81 empty cells with correct clues', () => {
    const grids = new Set<string>();
    for (let run = 0; run < 100; run++) {
      const puzzle = generatePuzzle();
      grids.add(puzzle.solution.join(''));
      for (const unit of UNITS) {
        expect(unit.map(cell => puzzle.solution[cell]).sort()).toEqual([1,2,3,4,5,6,7,8,9]);
      }
      expect(puzzle.values).toEqual(Array(81).fill(0));
      expect(puzzle.clues).toHaveLength(81);
      // Independent coordinate calculation checks all boundaries and excludes the centre.
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const neighbours = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([y,x]) => y >= 0 && y < 9 && x >= 0 && x < 9);
        expect(puzzle.clues[r*9+c]).toBe(neighbours.reduce((sum,[y,x]) => sum + puzzle.solution[y*9+x], 0));
      }
    }
    expect(grids.size).toBeGreaterThan(90);
  });
  it('handles all corners, edges and interior cells without wrapping', () => {
    expect(orthogonalNeighbours(0)).toEqual([1,9]);
    expect(orthogonalNeighbours(8)).toEqual([7,17]);
    expect(orthogonalNeighbours(72)).toEqual([63,73]);
    expect(orthogonalNeighbours(80)).toEqual([71,79]);
    expect(orthogonalNeighbours(9)).toEqual([0,10,18]);
    expect(orthogonalNeighbours(40)).toEqual([31,39,41,49]);
    expect(() => intersectionSums([1,2,3])).toThrow();
  });
});

describe('imported sudokUI engine', () => {
  it('solves a known classic puzzle through the imported technique dispatcher', () => {
    const grid = parseGrid('003020600900305001001806400008102900700000008006708200002609500800203009005010300')!;
    for (let i = 0; i < 81 && !isSolved(grid); i++) {
      const step = findNextStep(grid);
      expect(step).not.toBeNull();
      applyStep(grid, step!);
    }
    expect(gridToString(grid)).toBe('483921657967345821251876493548132976729564138136798245372689514814253769695417382');
  });
  it('loads every implemented technique on a solved board', () => {
    const grid = parseGrid('483921657967345821251876493548132976729564138136798245372689514814253769695417382')!;
    for (const tech of ALL_TECHS.filter(tech => TECHS[tech].implemented)) {
      expect(findStep(tech, grid)).toBeNull();
    }
  });
});
