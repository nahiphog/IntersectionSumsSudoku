import { expect, it } from 'vitest';
import { verifyWithSat } from '../src/satVerifier';
import { verifyClues } from '../src/lab';
import { intersectionClues, type ClueMode } from '../src/puzzle';
import { UNITS } from '../src/vendor/sudokui/engine/board';
const sparse = '0,0,0,0,0,0,17,0,0,0,0,16,0,0,19,0,0,0,0,19,0,16,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,30,0,0,0,0,0,0,18,0,27,0,0,0,0,0,0,20,0,0,0,0,15,0,0,0,0,14,0,0,0,17,0,18,0,0,0,0,0,0,0,0,0'.split(',').map(n => +n || null);
const answer = Array.from('432169875687523194591847362254631987378492651169758243713984526946215738825376419', Number);
it('proves the 15-clue Sum fixture unique without receiving its answer', () => {
  const reported: number[][] = [];
  const result = verifyWithSat(sparse, 'sum', solution => reported.push(solution));
  expect(result.count).toBe(1);
  expect(result.solutions).toEqual([answer]);
  expect(reported).toEqual(result.solutions);
}, 120000);
for (const mode of ['sum', 'product'] as ClueMode[]) it(`cross-checks SAT against the independent ${mode} solver`, () => {
  const complete = intersectionClues(answer, mode);
  const impossible = Array<number | null>(81).fill(null); impossible[0] = mode === 'sum' ? 2 : 11;
  for (const clues of [complete, complete.map((c,i)=>i%5===0?null:c), impossible, Array<number|null>(81).fill(null)]) {
    const result = verifyWithSat(clues, mode);
    expect(result.count).toBe(verifyClues(clues, mode).count);
    const distinct = new Set(result.solutions.map(values=>values.join('')));
    expect(distinct.size).toBe(result.count);
    for (const values of result.solutions) {
      for(const unit of UNITS) expect([...unit.map(c=>values[c])].sort()).toEqual([1,2,3,4,5,6,7,8,9]);
      const calculated = intersectionClues(values, mode);
      clues.forEach((clue,c)=>{if(clue!==null)expect(calculated[c]).toBe(clue)});
    }
  }
}, 120000);
