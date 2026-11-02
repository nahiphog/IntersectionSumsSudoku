import { describe, it, expect } from 'vitest';
import { findConstraintStep } from '../src/walkthroughSolver';
import { VariantSolver } from '../src/variantSolver';
import { emptyGrid, UNITS } from '../src/vendor/sudokui/engine/board';
import { orthogonalNeighbours, serializeClues } from '../src/puzzle';
import { diggingGroups } from '../src/digging';

describe('locked intersection digits', () => {
  for (const {cell, target, box, digits, set} of [
    {cell:13,target:810,box:1,digits:[3,5,6,9],set:'(3, 5, 6, 9)'},
    {cell:63,target:56,box:6,digits:[7],set:null},
    {cell:76,target:14,box:7,digits:[1,2,7],set:'(1, 2, 7)'},
  ]) it(`locks ${digits} into neighbours of cell ${cell}`, () => {
    const clues = Array<number|null>(81).fill(null); clues[cell] = target;
    const step = findConstraintStep(emptyGrid(), new VariantSolver(clues, 'product'), 'product')!;
    for (const other of UNITS[18+box].filter(c => !orthogonalNeighbours(cell).includes(c))) {
      for (const digit of digits) expect(step.eliminations).toContainEqual({cell:other,digit});
    }
    expect(step.description).toContain(`must contain ${digits.join(', ')}`);
    if (set) expect(step.description).toContain(`must be ${set} in some order`);
    else expect(step.eliminations.filter(e => e.cell === cell).map(e => e.digit)).toEqual([7]);
  });
  it('does not lock a digit into a box when it could occur across the boundary', () => {
    const clues = Array<number|null>(81).fill(null); clues[11] = 56;
    const step = findConstraintStep(emptyGrid(), new VariantSolver(clues, 'product'), 'product')!;
    expect(step.eliminations).not.toContainEqual({cell:0,digit:7});
  });
});

it('pairs opposite cells exactly once, with a single centre cell', () => {
  const groups = diggingGroups('dual');
  expect(groups).toHaveLength(41);
  expect(groups.flat().sort((a,b)=>a-b)).toEqual(Array.from({length:81},(_,i)=>i));
  expect(groups[40]).toEqual([40]);
  groups.slice(0,40).forEach(([a,b])=>expect(a+b).toBe(80));
});

it('exports all 81 cells row by row, using zero for empty cells', () => {
  const clues = Array<number|null>(81).fill(null);
  clues[0]=810; clues[8]=56; clues[9]=14; clues[80]=2520;
  const output = serializeClues(clues).split(',');
  expect(output).toHaveLength(81);
  expect(output.slice(0,10)).toEqual(['810','0','0','0','0','0','0','0','56','14']);
  expect(output[80]).toBe('2520');
  expect(serializeClues(Array(81).fill(null))).toBe(Array(81).fill('0').join(','));
});
