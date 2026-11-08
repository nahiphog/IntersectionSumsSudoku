import { expect, it, vi } from 'vitest';
import { SatDiggingSolver } from '../src/satVerifier';
import { generatePuzzle, intersectionClues } from '../src/puzzle';
import { digPuzzle } from '../src/digging';
import { VariantSolver, SearchLimitError } from '../src/variantSolver';
const solution = Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1);
it('scopes propagated candidates and derived equations to their own clue set', () => {
  const clues = intersectionClues(solution, 'sum');
  const full = Array<boolean>(81).fill(true);
  let root: Uint16Array | undefined;
  const onRoot = vi.fn((domains: Uint16Array) => { root = domains; });
  expect(new VariantSolver(clues, 'sum').countSolutions(full, { onRootDomains: onRoot })).toBe(1);
  expect(onRoot).toHaveBeenCalledTimes(1);
  expect(root).toBeDefined();
  const sat = new SatDiggingSolver(clues, 'sum', solution, full);
  expect(sat.countSolutions(full, root)).toBe(1);
  expect(sat.countSolutions(Array(81).fill(false))).toBe(2);
  expect(sat.countSolutions(full)).toBe(1);
  expect(() => sat.countSolutions(full, new Uint16Array(81))).toThrow('Invalid propagated domains');
}, 60000);

it('reports pre-branch candidates once and does not expose mutable search state', () => {
  const empty = Array(81).fill(null);
  const root = vi.fn((domains: Uint16Array) => {
    expect([...domains]).toEqual(Array(81).fill(511));
    domains.fill(0);
  });
  expect(new VariantSolver(empty, 'sum').countSolutions(undefined, { onRootDomains: root })).toBe(2);
  expect(root).toHaveBeenCalledTimes(1);
});

it('restores a sparse Sum proof after checking a genuinely ambiguous removal', () => {
  let seed = 48;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const puzzle = generatePuzzle(random, 'sum');
  // Unique retained mask from the independent pre-optimization benchmark.
  const cells = [0,5,8,9,10,12,24,33,35,37,43,55,58,60,65,67,74,78,80];
  const active = Array.from({ length: 81 }, (_, cell) => cells.includes(cell));
  const sat = new SatDiggingSolver(puzzle.clues, 'sum', puzzle.solution, active);
  let root: Uint16Array | undefined;
  try {
    new VariantSolver(puzzle.clues, 'sum', puzzle.solution).countSolutions(active, {
      nodeLimit: 1, onRootDomains: domains => { root = domains; },
    });
  } catch (error) { if (!(error instanceof SearchLimitError)) throw error; }
  expect(root).toBeDefined();
  expect(sat.countSolutions(active, root)).toBe(1);
  const missing = [...active]; missing[8] = false;
  expect(sat.countSolutions(missing)).toBe(2);
  expect(sat.countSolutions(active)).toBe(1);
}, 180000);
it.each(['sum', 'product'] as const)('keeps %s SAT assumptions temporary when clues are removed and restored', (mode) => {
  const clues = intersectionClues(solution, mode);
  const full = Array<boolean>(81).fill(true);
  const solver = new SatDiggingSolver(clues, mode, solution, full);
  expect(solver.countSolutions(full)).toBe(1);
  expect(solver.countSolutions(Array(81).fill(false))).toBe(2);
  expect(solver.countSolutions(full)).toBe(1);
  const oneMissing = [...full]; oneMissing[0] = false;
  expect(solver.countSolutions(oneMissing)).toBe(new VariantSolver(clues,mode,solution).countSolutions(oneMissing));
  expect(solver.countSolutions(full)).toBe(1);
},60000);

it('digs Sum with compact SAT without fallback and agrees with the independent exact solver', () => {
  let seed = 44;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let fallbacks = 0;
  const original = VariantSolver.prototype.countSolutions;
  const exact = vi.spyOn(VariantSolver.prototype, 'countSolutions').mockImplementation(function(this: VariantSolver, active, options) {
    if (active && active.filter(Boolean).length <= 24 && !options?.nodeLimit) fallbacks++;
    return original.call(this, active, options);
  });
  const sat = vi.spyOn(SatDiggingSolver.prototype, 'countSolutions');
  let result: ReturnType<typeof digPuzzle>;
  try {
    result = digPuzzle('sum', undefined, random);
    expect(sat).toHaveBeenCalled();
    expect(fallbacks).toBe(0);
  } finally { exact.mockRestore(); sat.mockRestore(); }
  expect(new VariantSolver(result.dugClues, 'sum', result.solution).countSolutions()).toBe(1);
  expect(result.dugClues.filter(c => c !== null)).toHaveLength(18);
}, 120000);
it('rejects an invalid witness or clues outside the guarded model', () => {
  const clues = intersectionClues(solution, 'sum');
  expect(()=>new SatDiggingSolver(clues,'sum',Array(81).fill(1),Array(81).fill(true))).toThrow('Invalid digging witness');
  const mask = Array(81).fill(false);
  const solver = new SatDiggingSolver(clues,'sum',solution,mask);
  mask[0] = true;
  expect(()=>solver.countSolutions(mask)).toThrow('Clue outside SAT model');
});
it('falls back after a SAT failure and still returns a uniquely solvable dug puzzle', () => {
  let seed=44;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const initial=generatePuzzle(random,'product');
  const original = VariantSolver.prototype.countSolutions;
  const bounded = vi.spyOn(VariantSolver.prototype,'countSolutions').mockImplementation(function(this: VariantSolver, active, options) {
    if(options?.nodeLimit) throw new SearchLimitError('Test budget');
    return original.call(this,active,options);
  });
  const sat=vi.spyOn(SatDiggingSolver.prototype,'countSolutions').mockImplementation(()=>{throw new Error('SAT resource error')});
  try {
    const result=digPuzzle('product',undefined,random,initial,'single',true);
    expect(sat).toHaveBeenCalledTimes(1);
    expect(new VariantSolver(result.dugClues,'product').countSolutions()).toBe(1);
  } finally {sat.mockRestore(); bounded.mockRestore();}
},60000);

it('never returns a solution count when a bounded search runs out of budget', () => {
  const solver = new VariantSolver(Array(81).fill(null), 'sum');
  expect(()=>solver.countSolutions(undefined,{nodeLimit:0})).toThrow(SearchLimitError);
  expect(solver.countSolutions()).toBe(2);
});
it('uses the SAT checker after a difficult query and independently verifies the result', () => {
  let seed=44;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const initial=generatePuzzle(random,'product');
  const original=VariantSolver.prototype.countSolutions;
  let forceBudget=true;
  const bounded=vi.spyOn(VariantSolver.prototype,'countSolutions').mockImplementation(function(this: VariantSolver,active,options){
    if(options?.nodeLimit && forceBudget){forceBudget=false;throw new SearchLimitError('Exercise SAT route');}
    return original.call(this,active,options);
  });
  const sat=vi.spyOn(SatDiggingSolver.prototype,'countSolutions');
  try {
    const result=digPuzzle('product',undefined,random,initial,'dual',true);
    expect(sat).toHaveBeenCalled();
    expect(new VariantSolver(result.dugClues,'product').countSolutions()).toBe(1);
    result.dugClues.forEach((clue,c)=>expect(clue===null).toBe(result.dugClues[80-c]===null));
  } finally {sat.mockRestore();bounded.mockRestore();}
},60000);
