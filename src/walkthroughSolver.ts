import { VariantSolver, type Clues } from './variantSolver';
import type { ClueMode } from './puzzle';
import { clueValue, intersectionClues } from './puzzle';
import { emptyGrid, cloneGrid, bit, digitsOf, cellName, isSolved, isBroken, UNITS, type Grid } from './vendor/sudokui/engine/board';
import { findStep, applyStep } from './vendor/sudokui/engine/humanSolver';
import { TECHS } from './vendor/sudokui/engine/ratings';
import { ACTIVE_LOGICAL_ORDER, BRUTE_FORCE_NAME } from './techniquePolicy';
import type { CellDigit, Step } from './vendor/sudokui/engine/steps';
import { sumEquations, type SumEquation } from './sumEquations';
import { findIntersectionLockedCandidates } from './intersectionLocks';

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

export function describeSudokuStep(step: Step): string {
  if (step.tech !== 'REMOTE_PAIR' || !step.colouring) return step.description;
  const cluster = step.colouring.clusters[0];
  const digits = [...new Set(cluster.dark.map(candidate => candidate.digit))].sort();
  const group = (candidates: CellDigit[]) => candidates.filter(candidate => candidate.digit === digits[0]).map(candidate => cellName(candidate.cell)).join(', ');
  return `Remote Pair: these cells all contain only ${digits.join(' and ')}. Cells linked by a shared row, column, or box must alternate digits. `
    + `Group A (${group(cluster.dark)}) therefore holds one digit, and group B (${group(cluster.light)}) holds the other. `
    + 'Any outside cell seeing a cell from each group cannot contain either digit. '
    + `Remove ${step.eliminations.map(candidate => `${candidate.digit} from ${cellName(candidate.cell)}`).join('; ')}.`;
}

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
    const name = (c: number) => cellName(c).toUpperCase();
    for (const [unitIndex, unit] of UNITS.entries()) {
      const positions = neighbours.flatMap((c, j) => unit.includes(c) ? [j] : []);
      if (!positions.length) continue;
      const mandatory = digitsOf(allowed.reduce((mask, tuple) =>
        mask & positions.reduce((set, j) => set | tuple[j], 0), 511));
      const locked = mandatory.filter(digit => unit.some(c => !neighbours.includes(c)
        && !grid.values[c] && (grid.cands[c] & bit(digit))));
      if (!locked.length) continue;
      const unitName = unitIndex < 9 ? `Row ${unitIndex + 1}` : unitIndex < 18 ? `Column ${unitIndex - 8}` : `Box ${unitIndex - 17}`;
      locks.push(`Other cells in ${unitName} cannot be ${locked.join(' or ')}.`);
      for (const cell of unit) {
        if (neighbours.includes(cell) || grid.values[cell]) continue;
        for (const digit of locked) if ((grid.cands[cell] & bit(digit))
          && !eliminations.some(e => e.cell === cell && e.digit === digit)) eliminations.push({ cell, digit });
      }
    }
    if (!eliminations.length) continue;
    const target = clueValue(allowed[0].map(mask => digitsOf(mask)[0]), mode);
    const digitSets = [...new Set(allowed.map(tuple => tuple.map(mask => digitsOf(mask)[0]).sort((a, b) => a - b).join(', ')))];
    const symbol = mode === 'sum' ? ' + ' : ' × ';
    const forced = neighbours.flatMap((c, j) => !grid.values[c] && digitsOf(support[j]).length === 1
      ? [name(c) + ' must be ' + digitsOf(support[j])[0]] : []);
    const pair = forced.length === 0 && neighbours.length === 2 && digitSets.length === 1
      && new Set(digitSets[0].split(', ')).size === 2
      && UNITS.some(unit => neighbours.every(c => unit.includes(c)));
    const fact = mode === 'pencilmark' ? `Pencilmark clue ${target}: the neighbouring cells must contain exactly ${digitSets[0]}, including repeated digits.` : digitSets.length === 1
      ? target + ' = ' + digitSets[0].split(', ').join(symbol) + '.'
      : target + ': possible neighbour groups are ' + (digitSets.length <= 4
        ? digitSets.map(set => '(' + set + ')').join(' or ')
        : neighbours.map((c,j) => name(c) + ' ∈ {' + digitsOf(support[j]).join(', ') + '}').join('; ')) + '.';
    const deduction = pair ? 'Hidden pair (' + digitSets[0] + ') in ' + neighbours.map(name).join(' and ') + '.'
      : forced.length ? forced.join('; ') + '.'
      : digitSets.length === 1 ? neighbours.map(name).join(', ') + ' contain these digits in some order.' : '';
    return {
      technique: mode === 'sum' ? 'Intersection sum' : mode === 'product' ? 'Intersection product' : 'Intersection pencilmarks', kind: 'constraint',
      description: [fact, deduction, ...(forced.length ? [] : locks)].filter(Boolean).join(' '),
      placements: [], eliminations, related: [...new Set([cell, ...neighbours, ...eliminations.map(e => e.cell)])], clueCell: cell,
      neighbourOrder: neighbours, combinationCount: allowed.length,
      combinations: allowed.slice(0, 12).map(tuple => tuple.map(mask => digitsOf(mask)[0])),
    };
  }
  return null;
}

/** Logical deductions use only clues and candidates. A validated completion is used only for explicitly labelled brute-force steps. */
export function solveWalkthrough(clues: Clues, mode: ClueMode, options: {
  allowSearch?: boolean;
  completion?: readonly number[];
  onStep?: (step: ExplainedStep, initial: Snapshot) => void;
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
  let completion: Uint8Array | null = options.completion ? Uint8Array.from(options.completion) : null;
  if (options.completion) {
    const values = options.completion;
    const calculated = intersectionClues([...values], mode);
    if (values.length !== 81 || values.some(d => !Number.isInteger(d) || d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(c => values[c])).size !== 9)
      || clues.some((clue, cell) => clue !== null && (mode === 'pencilmark' ? clueValue(String(clue).split('').map(Number), mode) : clue) !== calculated[cell])) throw new Error('Invalid shared completion.');
  }
  const order = ACTIVE_LOGICAL_ORDER.filter(tech =>
    options.profile !== 'generation' || TECHS[tech].index <= TECHS.XYZ_WING.index);
  let stepCount = 0;
  const fromSudoku = (step: Step): Omit<ExplainedStep, 'before' | 'after' | 'peerEliminations'> => ({
    technique: TECHS[step.tech].name, kind: 'sudoku', description: describeSudokuStep(step),
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
    if (!step) step = findIntersectionLockedCandidates(grid, solver, mode);
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
      const domains = domainsOf(grid);
      if (completion && completion.some((digit, cell) => !(domains[cell] & bit(digit)))) {
        throw new Error('Logical deductions conflict with the validated completion.');
      }
      completion ??= solver.solve(domains);
      if (!completion) throw new Error('No completion satisfies the current candidates and dug clues.');
      const cell = [...grid.values].findIndex(value => !value);
      step = {
        technique: BRUTE_FORCE_NAME, kind: 'search',
        description: `The active logical techniques found no further step. A previously validated or newly searched completion satisfies all Sudoku rules, remaining ${mode} clues, and current candidates. This step follows that completion; it is not a logical deduction. Place ${completion[cell]} in ${cellName(cell)} along that searched path. This brute-force placement adds 10000 points.`,
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
    if (options.recordSteps !== false) {
      const explained = { ...step, before, after, peerEliminations };
      steps.push(explained);
      options.onStep?.(explained, initial);
    }
    options.onProgress?.(++stepCount, step.technique);
  }
  const calculated = intersectionClues([...grid.values], mode);
  if (UNITS.some(unit => new Set(unit.map(c => grid.values[c])).size !== 9)
    || clues.some((clue, cell) => clue !== null && clue !== calculated[cell])) {
    throw new Error('The resulting grid failed final Sudoku or clue validation.');
  }
  return { initial, steps, status: 'solved', searchSteps };
}
