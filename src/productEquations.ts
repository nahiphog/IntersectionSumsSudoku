import type { Clues } from './variantSolver';
import { orthogonalNeighbours } from './puzzle';
import { bit, digitsOf, cellName, sees, type Grid } from './vendor/sudokui/engine/board';
import type { ExplainedStep } from './walkthroughSolver';

type Deduction = Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'>;
const name = (cell: number) => cellName(cell).toUpperCase();
const product = (cells: number[]) => cells.length ? cells.map(name).join(' × ') : '1';

/** Cancel shared, nonzero factors. Enumerate only a small derived equation,
 * never trial placements or a search for a completed Sudoku. */
export function findProductEquationStep(grid: Grid, clues: Clues): Deduction | null {
  const equations = clues.flatMap((target, cell) => {
    if (target === null) return [];
    const neighbours = orthogonalNeighbours(cell);
    const known = neighbours.filter(c => grid.values[c]).map(c => grid.values[c]);
    const divisor = known.reduce((a, b) => a * b, 1);
    if (target % divisor !== 0) throw new Error('The product equations contradict the placed digits.');
    return [{ cell, target, known, remaining: target / divisor, cells: neighbours.filter(c => !grid.values[c]) }];
  });
  for (let i = 0; i < equations.length; i++) for (let j = i + 1; j < equations.length; j++) {
    const a = equations[i], b = equations[j];
    const shared = a.cells.filter(c => b.cells.includes(c));
    if (!shared.length) continue;
    const left = a.cells.filter(c => !shared.includes(c));
    const right = b.cells.filter(c => !shared.includes(c));
    const cells = [...left, ...right];
    // This bounded local technique deliberately skips larger equations.
    if (!cells.length || cells.length > 4) continue;
    const support = cells.map(() => 0), chosen: number[] = [];
    const candidates = cells.map(c => digitsOf(grid.cands[c]));
    let count = 0;
    const visit = (index: number, l: number, r: number) => {
      if (index === cells.length) {
        // Each factor is at most 9 and each clue at most 9^4: exact safe integers.
        if (l * b.remaining !== r * a.remaining) return;
        count++;
        chosen.forEach((digit, k) => { support[k] |= bit(digit); });
        return;
      }
      for (const digit of candidates[index]) {
        if (chosen.some((previous, k) => previous === digit && sees(cells[k], cells[index]))) continue;
        chosen.push(digit);
        visit(index + 1, index < left.length ? l * digit : l, index >= left.length ? r * digit : r);
        chosen.pop();
      }
    };
    visit(0, 1, 1);
    if (!count) throw new Error('The combined product equations contradict the current candidates.');
    const eliminations = cells.flatMap((cell, k) => digitsOf(grid.cands[cell] & ~support[k]).map(digit => ({ cell, digit })));
    if (!eliminations.length) continue;
    const describe = (e: typeof a) => `${name(e.cell)}: ${product(e.cells)} = ${e.target}${e.known.map(d => ` ÷ ${d}`).join('')}${e.known.length ? ` = ${e.remaining}` : ''}.`;
    const result = !left.length
      ? `${product(right)} = ${b.remaining} ÷ ${a.remaining} = ${b.remaining / a.remaining}`
      : !right.length ? `${product(left)} = ${a.remaining} ÷ ${b.remaining} = ${a.remaining / b.remaining}`
      : `(${product(left)}) × ${b.remaining} = (${product(right)}) × ${a.remaining}`;
    return {
      technique: 'Combined product equations', kind: 'constraint', placements: [], eliminations,
      related: [...new Set([a.cell, b.cell, ...orthogonalNeighbours(a.cell), ...orthogonalNeighbours(b.cell)])],
      description: `${describe(a)} ${describe(b)} Cancel the shared factors ${product(shared)} to get ${result}. `
        + `Using the current candidates and excluding repeated digits in a shared row, column, or box, ${cells.map((c, k) => `${name(c)} can only be ${digitsOf(support[k]).join(' or ')}`).join('; ')}.`,
    };
  }
  return null;
}
