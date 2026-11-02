import { UNITS } from './vendor/sudokui/engine/board';
import { orthogonalNeighbours } from './puzzle';
import type { Clues } from './variantSolver';

export interface SumEquation { terms: [number, number][]; target: number; tolerance: number }
const abs = (n: bigint) => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b) { const r = a % b; a = b; b = r; }
  return a;
}

/** Exact integer row reduction combines the 45 totals with sum clues.
 * Only equations whose entire arithmetic fits safely in Number are used
 * for search bounds; larger rows are omitted, never approximated.
 */
export function sumEquations(clues: Clues, active: readonly boolean[]): SumEquation[] {
  const rows: bigint[][] = [];
  const add = (cells: number[], target: number) => {
    const row = Array<bigint>(82).fill(0n);
    for (const cell of cells) row[cell] = 1n;
    row[81] = BigInt(target);
    rows.push(row);
  };
  for (const unit of UNITS) add(unit, 45);
  clues.forEach((clue, cell) => { if (clue !== null && active[cell]) add(orthogonalNeighbours(cell), clue); });
  let pivot = 0;
  for (let col = 0; col < 81 && pivot < rows.length; col++) {
    let best = -1;
    for (let i = pivot; i < rows.length; i++) {
      if (rows[i][col] !== 0n && (best === -1 || abs(rows[i][col]) < abs(rows[best][col]))) best = i;
    }
    if (best === -1) continue;
    [rows[pivot], rows[best]] = [rows[best], rows[pivot]];
    for (let i = 0; i < rows.length; i++) {
      if (i === pivot || rows[i][col] === 0n) continue;
      const factor = gcd(rows[pivot][col], rows[i][col]);
      const a = rows[pivot][col] / factor, b = rows[i][col] / factor;
      let divisor = 0n;
      for (let j = 0; j < 82; j++) {
        rows[i][j] = rows[i][j] * a - rows[pivot][j] * b;
        divisor = gcd(divisor, rows[i][j]);
      }
      if (divisor > 1n) for (let j = 0; j < 82; j++) rows[i][j] /= divisor;
    }
    pivot++;
  }
  return rows.filter(row => row.reduce((sum, n) => sum + abs(n) * 36n, 0n) < BigInt(Number.MAX_SAFE_INTEGER))
    .map(row => ({
      terms: row.slice(0, 81).flatMap((coefficient, cell) => coefficient !== 0n ? [[cell, Number(coefficient)] as [number, number]] : []),
      target: Number(row[81]), tolerance: 0,
    }));
}
