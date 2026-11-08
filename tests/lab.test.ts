import { expect, it } from 'vitest';
import { maskedClues, parseClues, verifyClues } from '../src/lab';
import { intersectionClues, serializeClues } from '../src/puzzle';
import { solveWalkthrough } from '../src/walkthroughSolver';
import { tallySteps } from '../src/tally';
import { rateWalkthrough } from '../src/difficulty';

const solution = Array.from({ length: 81 }, (_, i) => (Math.floor(i / 9) * 3 + Math.floor(i / 27) + i % 9) % 9 + 1);
it('parses row-major clues, blanks and whitespace without accepting malformed values', () => {
  const clues = Array(81).fill(0); clues[13] = 810;
  expect(parseClues(clues.join(', '), 'product')[13]).toBe(810);
  expect(parseClues(clues.join(','), 'product')[0]).toBeNull();
  for (const bad of ['1,2', Array(81).fill('').join(','), Array(81).fill('-1').join(','), Array(81).fill('1.5').join(','), Array(81).fill('1e2').join(',')]) expect(()=>parseClues(bad,'product')).toThrow();
  expect(()=>parseClues(clues.join(','),'sum')).toThrow();
});
for (const mode of ['sum','product'] as const) it(`verifies a unique ${mode} grid and returns its actual completion`, () => {
  const clues = intersectionClues(solution,mode);
  const result = verifyClues(parseClues(serializeClues(clues),mode),mode);
  expect(result.count).toBe(1); expect(result.solutions).toEqual([solution]);
});
it('distinguishes no solution from multiple solutions with two distinct witnesses', () => {
  const impossible = Array<number|null>(81).fill(null); impossible[0]=1;
  expect(verifyClues(impossible,'product')).toEqual({count:0,solutions:[]});
  const multiple = verifyClues(Array(81).fill(null),'product');
  expect(multiple.count).toBe(2); expect(multiple.solutions).toHaveLength(2);
  expect(multiple.solutions[0]).not.toEqual(multiple.solutions[1]);
});
it('custom patterns retain exactly the selected clue positions', () => {
  const clues = intersectionClues(solution,'product');
  const masked = maskedClues(clues,[0,40,80]);
  expect(masked.filter(c=>c!==null)).toEqual([clues[0],clues[40],clues[80]]);
  expect(masked[1]).toBeNull(); expect(()=>maskedClues(clues,[81])).toThrow();
});
it('the technique tally accounts for all steps and agrees with the rating', () => {
  const walk = solveWalkthrough(intersectionClues(solution,'product'),'product',{allowSearch:false});
  const rows = tallySteps(walk);
  expect(rows.reduce((n,r)=>n+r.count,0)).toBe(walk.steps.length);
  expect(rows.reduce((n,r)=>n+r.count*(r.points??0),0)).toBe(rateWalkthrough(walk).score);
  expect(rows.find(r=>r.name==='Intersection product')?.points).toBe(10);
});

it('reports each actual solution before returning the uniqueness result', () => {
  const clues = intersectionClues(solution, 'sum');
  const seen: number[][] = [];
  const result = verifyClues(clues, 'sum', values => seen.push(values));
  expect(seen).toEqual(result.solutions);
  expect(seen).toEqual([solution]);
});
