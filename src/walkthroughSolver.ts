import { VariantSolver, type Clues } from './variantSolver';
import type { ClueMode } from './puzzle';
import { intersectionClues } from './puzzle';
import { emptyGrid, cloneGrid, bit, digitsOf, cellName, isSolved, isBroken, UNITS, type Grid } from './vendor/sudokui/engine/board';
import { findStep, applyStep } from './vendor/sudokui/engine/humanSolver';
import { NO_UNIQUENESS_ORDER, TECHS } from './vendor/sudokui/engine/ratings';
import type { CellDigit, Step } from './vendor/sudokui/engine/steps';
import { sumEquations, type SumEquation } from './sumEquations';

export interface Snapshot { values: number[]; candidates: number[] }
export interface ExplainedStep {
  technique: string;
  kind: 'sudoku' | 'constraint' | 'search';
  description: string;
  before: Snapshot;
  after: Snapshot;
  placements: CellDigit[];
  eliminations: CellDigit[];
  peerEliminations: CellDigit[];
  related: number[];
  clueCell?: number;
  combinations?: number[][];
  combinationCount?: number;
  neighbourOrder?: number[];
}
export interface Walkthrough {
  initial: Snapshot;
  steps: ExplainedStep[];
  status: 'solved' | 'stalled';
  searchSteps: number;
}
const snapshot = (grid: Grid): Snapshot => ({ values: [...grid.values], candidates: [...grid.cands] });
const domainsOf = (grid: Grid) => Uint16Array.from(grid.cands, (mask, cell) => grid.values[cell] ? bit(grid.values[cell]) : mask);

function findSumEquationStep(grid: Grid, equations: SumEquation[]): Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'> | null {
  const domains = domainsOf(grid);
  for (const { terms, target } of equations) {
    const bounds = terms.map(([cell, coefficient]) => {
      const values = digitsOf(domains[cell]).map(digit => digit * coefficient);
      return [Math.min(...values), Math.max(...values)];
    });
    const min = bounds.reduce((total, pair) => total + pair[0], 0);
    const max = bounds.reduce((total, pair) => total + pair[1], 0);
    if (target < min || target > max) throw new Error('The sum equations contradict the current candidates.');
    for (const [j, [cell, coefficient]] of terms.entries()) {
      if (grid.values[cell]) continue;
      const low = min - bounds[j][0], high = max - bounds[j][1];
      const eliminations = digitsOf(domains[cell])
        .filter(digit => coefficient * digit + low > target || coefficient * digit + high < target)
        .map(digit => ({ cell, digit }));
      if (!eliminations.length) continue;
      const equation = terms.map(([c, k]) => `(${k} × ${cellName(c)})`).join(' + ');
      return {
        technique: 'Combined sum equations', kind: 'constraint',
        description: `Exact algebraic elimination combines the remaining sum clues with the total of 45 in each Sudoku row, column, and box, giving ${equation} = ${target}. `
          + `For ${cellName(cell)}, the other terms range from ${low} to ${high} under the current candidates. `
          + `Remove ${eliminations.map(e => e.digit).join(', ')}: multiplying each by ${coefficient} and adding that range cannot reach ${target}. No trial assignments or backtracking are used.`,
        placements: [], eliminations, related: terms.map(([c]) => c),
      };
    }
  }
  return null;
}

export function findConstraintStep(grid: Grid, solver: VariantSolver, mode: ClueMode): Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'> | null {
  const domains = domainsOf(grid);
  for (const { cell, neighbours, tuples } of solver.clueOptions()) {
    const allowed = tuples.filter(tuple => tuple.every((mask, j) => domains[neighbours[j]] & mask));
    if (!allowed.length) throw new Error(`The ${mode} clue at ${cellName(cell)} has no valid combination.`);
    const support = neighbours.map((_, j) => allowed.reduce((mask, tuple) => mask | tuple[j], 0));
    const eliminations = neighbours.flatMap((neighbour, j) => grid.values[neighbour] ? []
      : digitsOf(grid.cands[neighbour] & ~support[j]).map(digit => ({ cell: neighbour, digit })));
    const locks: string[] = [];
    for (const [unitIndex, unit] of UNITS.entries()) {
      const positions = neighbours.flatMap((c, j) => unit.includes(c) ? [j] : []);
      if (!positions.length) continue;
      const mandatory = digitsOf(allowed.reduce((mask, tuple) =>
        mask & positions.reduce((set, j) => set | tuple[j], 0), 511));
      const locked = mandatory.filter(digit => unit.some(c => !neighbours.includes(c)
        && !grid.values[c] && (grid.cands[c] & bit(digit))));
      if (!locked.length) continue;
      const unitName = unitIndex < 9 ? `row ${unitIndex + 1}` : unitIndex < 18 ? `column ${unitIndex - 8}` : `box ${unitIndex - 17}`;
      locks.push(`The neighbouring cells in ${unitName} must contain ${locked.join(', ')} in every valid combination. These digits cannot appear in the other cells of that ${unitName}, including the clue cell when it belongs to that unit.`);
      for (const cell of unit) {
        if (neighbours.includes(cell) || grid.values[cell]) continue;
        for (const digit of locked) if ((grid.cands[cell] & bit(digit))
          && !eliminations.some(e => e.cell === cell && e.digit === digit)) eliminations.push({ cell, digit });
      }
    }
    if (!eliminations.length) continue;
    const target = allowed[0].reduce((value, mask) => mode === 'sum' ? value + digitsOf(mask)[0] : value * digitsOf(mask)[0], mode === 'sum' ? 0 : 1);
    const changes = neighbours.flatMap(neighbour => {
      const removed = eliminations.filter(e => e.cell === neighbour).map(e => e.digit);
      return removed.length ? [`${cellName(neighbour)} cannot be ${removed.join(', ')}`] : [];
    });
    const digitSets = [...new Set(allowed.map(tuple => tuple.map(mask => digitsOf(mask)[0]).sort((a, b) => a - b).join(', ')))];
    const must = digitSets.length === 1 ? `The neighbours must be (${digitSets[0]}) in some order. ` : '';
    return {
      technique: mode === 'sum' ? 'Intersection sum' : 'Intersection product', kind: 'constraint',
      description: `The clue at ${cellName(cell)} requires the ${mode} of ${neighbours.map(cellName).join(', ')} to equal ${target}. `
        + `Exactly ${allowed.length} ordered combination(s) match the ${mode}, current candidates, and Sudoku restrictions between these neighbours. `
        + must + (changes.length ? `Neighbour candidate reductions: ${changes.join('; ')}. ` : '')
        + locks.join(' ') + ' The clue cell itself does not contribute to the clue value.',
      placements: [], eliminations, related: [...new Set([cell, ...neighbours, ...eliminations.map(e => e.cell)])], clueCell: cell,
      neighbourOrder: neighbours, combinationCount: allowed.length,
      combinations: allowed.slice(0, 12).map(tuple => tuple.map(mask => digitsOf(mask)[0])),
    };
  }
  return null;
}

/** Uses only the dug clues. It never receives the generated completed grid. */
export function solveWalkthrough(clues: Clues, mode: ClueMode, options: {
  allowSearch?: boolean;
  /** Conservative generation filter: stop before expensive advanced finders. */
  profile?: 'full' | 'generation';
  /** Digging needs a proof of completion, not hundreds of UI snapshots. */
  recordSteps?: boolean;
  onProgress?: (steps: number, message: string) => void;
} = {}): Walkthrough {
  const grid = emptyGrid();
  const initial = snapshot(grid);
  const solver = new VariantSolver(clues, mode);
  const equations = mode === 'sum' ? sumEquations(clues, Array(81).fill(true)) : [];
  const steps: ExplainedStep[] = [];
  let searchSteps = 0;
  const order = NO_UNIQUENESS_ORDER.filter(tech => tech !== 'BRUTE_FORCE'
    && (options.profile !== 'generation' || TECHS[tech].index <= TECHS.XYZ_WING.index));
  let stepCount = 0;
  const fromSudoku = (step: Step): Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'> => ({
    technique: TECHS[step.tech].name, kind: 'sudoku', description: step.description,
    placements: step.placements, eliminations: step.eliminations,
    related: [...new Set([
      ...(step.primary ?? []).map(c => c.cell), ...(step.secondary ?? []).map(c => c.cell),
      ...(step.fins ?? []).map(c => c.cell), ...(step.chainCells ?? []),
      ...(step.units ?? []).flatMap(u => UNITS[u.unit]),
      ...(step.links ?? []).flatMap(l => [...l.from, ...l.to].map(c => c.cell)),
      ...step.placements.map(c => c.cell), ...step.eliminations.map(c => c.cell),
    ])],
  });
  while (!isSolved(grid)) {
    if (isBroken(grid)) throw new Error('The candidate state is contradictory.');
    const before = snapshot(grid);
    let classic: Step | null = null;
    // Place singles promptly, then use clues before trying expensive patterns.
    for (const tech of order.slice(0, 3)) { classic = findStep(tech, grid); if (classic) break; }
    let step = classic ? fromSudoku(classic) : findConstraintStep(grid, solver, mode);
    if (!step) step = findSumEquationStep(grid, equations);
    if (!step) {
      for (const tech of order.slice(3)) {
        options.onProgress?.(stepCount, `Checking ${TECHS[tech].name}…`);
        classic = findStep(tech, grid);
        if (classic) { step = fromSudoku(classic); break; }
      }
    }
    if (!step) {
      if (options.allowSearch === false || options.profile === 'generation') return { initial, steps, status: 'stalled', searchSteps };
      options.onProgress?.(steps.length, 'Logical techniques stalled; searching Sudoku and clue constraints…');
      const completion = solver.solve(domainsOf(grid));
      if (!completion) throw new Error('No completion satisfies the current candidates and dug clues.');
      const cell = [...grid.values].findIndex(value => !value);
      step = {
        technique: 'Backtracking (search)', kind: 'search',
        description: `The applicable logical techniques found no further step. Backtracking tested candidate assignments against all Sudoku rules and remaining ${mode} clues and found a compatible completion. Place ${completion[cell]} in ${cellName(cell)} along that searched path. This is a search-assisted placement, not a named logical deduction.`,
        placements: [{ cell, digit: completion[cell] }], eliminations: [], related: [cell],
      };
      searchSteps++;
    }
    const previous = options.recordSteps === false ? null : cloneGrid(grid);
    // Custom steps share the imported engine's placement/elimination semantics.
    applyStep(grid, { tech: classic?.tech ?? 'BRUTE_FORCE', placements: step.placements, eliminations: step.eliminations, description: step.description });
    const after = snapshot(grid);
    const peerEliminations: CellDigit[] = [];
    for (let cell = 0; previous && cell < 81; cell++) {
      if (grid.values[cell]) continue;
      for (const digit of digitsOf(previous.cands[cell] & ~grid.cands[cell])) {
        if (!step.eliminations.some(e => e.cell === cell && e.digit === digit)) peerEliminations.push({ cell, digit });
      }
    }
    if (before.values.every((v, i) => v === after.values[i]) && before.candidates.every((v, i) => v === after.candidates[i])) {
      throw new Error(`${step.technique} produced no change.`);
    }
    if (options.recordSteps !== false) steps.push({ ...step, before, after, peerEliminations });
    options.onProgress?.(++stepCount, step.technique);
  }
  const calculated = intersectionClues([...grid.values], mode);
  if (UNITS.some(unit => new Set(unit.map(c => grid.values[c])).size !== 9)
    || clues.some((clue, cell) => clue !== null && clue !== calculated[cell])) {
    throw new Error('The resulting grid failed final Sudoku or clue validation.');
  }
  return { initial, steps, status: 'solved', searchSteps };
}
