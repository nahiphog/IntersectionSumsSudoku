import { bit, cellName, digitsOf, sees, type Grid } from './vendor/sudokui/engine/board';
import type { VariantSolver } from './variantSolver';
import type { ExplainedStep } from './walkthroughSolver';
import { clueValue, type ClueMode } from './puzzle';
import { PRODUCT_LOCK_NAME, SUM_LOCK_NAME, PENCILMARK_LOCK_NAME } from './techniquePolicy';

/** A mandatory digit in a clue's unresolved neighbours excludes that digit
 * from any outside cell seeing every possible location, even across units. */
export function findIntersectionLockedCandidates(grid: Grid, solver: VariantSolver, mode: ClueMode):
  Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'> | null {
  const domains = Uint16Array.from(grid.cands, (mask, cell) => grid.values[cell] ? bit(grid.values[cell]) : mask);
  for (const { cell, neighbours, tuples } of solver.clueOptions()) {
    const allowed = tuples.filter(tuple => tuple.every((mask, j) => domains[neighbours[j]] & mask));
    if (!allowed.length) throw new Error(`The ${mode} clue at ${cellName(cell)} has no valid combination.`);
    const remaining = neighbours.flatMap((neighbour, j) => grid.values[neighbour] ? [] : [j]);
    if (!remaining.length) continue;
    // Intersection of the digits present in EVERY possible assignment, not
    // just the union of candidates or a single convenient combination.
    const mandatory = allowed.reduce((mask, tuple) =>
      mask & remaining.reduce((digits, j) => digits | tuple[j], 0), 511);
    const eliminations: { cell: number; digit: number }[] = [];
    const reasons: string[] = [];
    for (const digit of digitsOf(mandatory)) {
      const locations = remaining.filter(j => allowed.some(tuple => tuple[j] & bit(digit))).map(j => neighbours[j]);
      const targets = Array.from({ length: 81 }, (_, c) => c).filter(c =>
        !grid.values[c] && !neighbours.includes(c) && (grid.cands[c] & bit(digit))
        && locations.every(location => sees(c, location)));
      if (!targets.length) continue;
      eliminations.push(...targets.map(cell => ({ cell, digit })));
      reasons.push(`${digit} must occur in ${locations.map(c => cellName(c).toUpperCase()).join(' or ')}. `
        + `Remove ${digit} from ${targets.map(c => cellName(c).toUpperCase()).join(', ')}: each of these cells sees every possible location.`);
    }
    if (!eliminations.length) continue;
    const target = clueValue(allowed[0].map(mask => digitsOf(mask)[0]), mode);
    const fixed = neighbours.filter(c => grid.values[c]);
    const groups = [...new Set(allowed.map(tuple => remaining.map(j => digitsOf(tuple[j])[0]).sort((a,b) => a-b).join(', ')))];
    let reduction = '', factors: string;
    const fixedDescription = fixed.map(c => `${cellName(c).toUpperCase()} = ${grid.values[c]}`).join(', ');
    if (mode === 'pencilmark') {
      reduction = fixed.length ? `${fixedDescription}. Remove one occurrence of each placed digit from the clue. ` : '';
      factors = `The remaining neighbours contain ${groups[0]} in some order, including every repeated digit. `;
    } else {
      const fixedValue = clueValue(fixed.map(c => grid.values[c]), mode);
      const residual = mode === 'sum' ? target - fixedValue : target / fixedValue;
      reduction = fixed.length
        ? `${fixedDescription}; ${target}${fixed.map(c => ` ${mode === 'sum' ? '−' : '÷'} ${grid.values[c]}`).join('')} = ${residual}. ` : '';
      factors = groups.length === 1
        ? `The remaining neighbours contain ${groups[0]} in some order. `
        : `Every valid assignment of the remaining neighbours has ${mode} ${residual}. `;
    }
    return {
      technique: mode === 'pencilmark' ? PENCILMARK_LOCK_NAME : mode === 'sum' ? SUM_LOCK_NAME : PRODUCT_LOCK_NAME, kind: 'constraint',
      description: `${mode === 'pencilmark' ? 'Pencilmark' : mode === 'sum' ? 'Sum' : 'Product'} clue ${target} at ${cellName(cell).toUpperCase()}: ${reduction}${factors}${reasons.join(' ')}`,
      placements: [], eliminations,
      related: [...new Set([cell, ...neighbours, ...eliminations.map(e => e.cell)])], clueCell: cell,
      neighbourOrder: neighbours, combinationCount: allowed.length,
      combinations: allowed.slice(0, 12).map(tuple => tuple.map(mask => digitsOf(mask)[0])),
    };
  }
  return null;
}
