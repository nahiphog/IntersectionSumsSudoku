import Logic from './satRuntime';
import { VariantSolver, type Clues } from './variantSolver';
import { UNITS } from './vendor/sudokui/engine/board';
import { intersectionClues, orthogonalNeighbours, type ClueMode } from './puzzle';

/** Exact SAT verification. Blocking only the 81 cell assignments (not auxiliary
 * tuple selectors) makes the second model a genuinely different Sudoku grid. */
function buildModel(clues: Clues, mode: ClueMode, guarded = false) {
  if (clues.length !== 81 || clues.some(c => c !== null && (!Number.isSafeInteger(c) || c < 1))) {
    throw new Error('Expected 81 positive clues or null for missing clues.');
  }
  const options = mode === 'product' ? new VariantSolver(clues, mode).clueOptions() : [];
  const solver = new Logic.Solver();
  const variables = Array.from({ length: 81 }, (_, cell) =>
    Array.from({ length: 9 }, (_, digit) => `c${cell}d${digit + 1}`));
  const exactlyOne = (terms: string[]) => {
    if (mode === 'product' || !guarded) { solver.require(Logic.exactlyOne(terms)); return; }
    solver.require(Logic.or(terms));
    for (let i = 0; i < terms.length; i++) for (let j = i + 1; j < terms.length; j++) {
      solver.require(Logic.or([Logic.not(terms[i]), Logic.not(terms[j])]));
    }
  };
  for (const cell of variables) exactlyOne(cell);
  for (const unit of UNITS) for (let digit = 0; digit < 9; digit++) {
    exactlyOne(unit.map(cell => variables[cell][digit]));
  }
  if (mode === 'sum') clues.forEach((target, cell) => {
    if (target === null) return;
    const neighbours = orthogonalNeighbours(cell);
    const totals = (cells: number[], side: string): Map<number, string> => {
      if (cells.length === 1) return new Map(variables[cells[0]].map((v, d) => [d + 1, v]));
      const sums = new Map(Array.from({ length: 17 }, (_, i) => [i + 2, `sum${cell}${side}${i + 2}`]));
      solver.require(Logic.exactlyOne([...sums.values()]));
      for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
        solver.require(Logic.or([Logic.not(variables[cells[0]][a-1]),
          Logic.not(variables[cells[1]][b-1]), sums.get(a+b)!]));
      }
      // Propagate in both directions: a total and either digit determine the other.
      for (const [sum, variable] of sums) for (let digit = 1; digit <= 9; digit++) {
        const other = sum - digit;
        for (let side = 0; side < 2; side++) {
          solver.require(Logic.or([Logic.not(variable), Logic.not(variables[cells[side]][digit-1]),
            ...(other >= 1 && other <= 9 ? [variables[cells[1-side]][other-1]] : [])]));
        }
      }
      return sums;
    };
    const left = totals(neighbours.slice(0, Math.floor(neighbours.length / 2)), 'L');
    const right = totals(neighbours.slice(Math.floor(neighbours.length / 2)), 'R');
    // Each half has exactly one total. The only permitted pair sums to the clue.
    for (const [a, variable] of left) {
      const other = right.get(target - a);
      const clause = [Logic.not(variable), ...(other ? [other] : [])];
      if (guarded) clause.push(Logic.not(`active${cell}`));
      solver.require(Logic.or(clause));
    }
    for (const [b, variable] of right) {
      const other = left.get(target - b);
      const clause = [Logic.not(variable), ...(other ? [other] : [])];
      if (guarded) clause.push(Logic.not(`active${cell}`));
      solver.require(Logic.or(clause));
    }
  });
  for (const { cell, neighbours, tuples } of options) {
    const selectors = tuples.map((_, i) => `clue${cell}tuple${i}`);
    const requireClue = (formula: Parameters<typeof solver.require>[0]) =>
      solver.require(guarded ? Logic.implies(`active${cell}`, formula) : formula);
    requireClue(Logic.or(selectors));
    if (guarded) for (const selector of selectors) solver.require(Logic.implies(selector, `active${cell}`));
    // A selected tuple fixes all its neighbours to that exact allowed assignment.
    tuples.forEach((tuple, i) => tuple.forEach((mask, j) => {
      solver.require(Logic.implies(selectors[i], variables[neighbours[j]][31 - Math.clz32(mask)]));
    }));
    // Redundant support clauses strengthen propagation without excluding any model.
    neighbours.forEach((neighbour, j) => {
      for (let digit = 0; digit < 9; digit++) {
        requireClue(Logic.implies(variables[neighbour][digit],
          Logic.or(selectors.filter((_, i) => tuples[i][j] === (1 << digit)))));
      }
    });
  }
  return { solver, variables };
}

export function verifyWithSat(clues: Clues, mode: ClueMode, onSolution?: (values: number[]) => void) {
  const { solver, variables } = buildModel(clues, mode);
  const solutions: number[][] = [];
  while (solutions.length < 2) {
    const model = solver.solve();
    if (!model) break; // Exhaustive UNSAT, never a timeout or an approximate verdict.
    const values = variables.map(cell => cell.findIndex(variable => model.evaluate(variable)) + 1);
    const calculated = intersectionClues(values, mode);
    if (values.some(d => d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(cell => values[cell])).size !== 9)
      || clues.some((clue, cell) => clue !== null && clue !== calculated[cell])
      || solutions.some(previous => previous.every((digit, cell) => digit === values[cell]))) {
      throw new Error('SAT completion failed independent validation.');
    }
    solutions.push(values); onSolution?.([...values]);
    solver.forbid(Logic.and(values.map((digit, cell) => variables[cell][digit - 1])));
  }
  return { count: solutions.length, solutions };
}

/** Reuse a guarded SAT model across clue-removal attempts. The supplied completed
 * grid is validated and excluded once; each query searches for a different grid. */
export class SatDiggingSolver {
  private model: ReturnType<typeof buildModel>;
  constructor(private clues: Clues, private mode: ClueMode, private witness: readonly number[], private included: readonly boolean[]) {
    const calculated = intersectionClues([...witness], mode);
    if (witness.length !== 81 || witness.some(d => !Number.isInteger(d) || d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(c => witness[c])).size !== 9)
      || clues.some((clue,c) => clue !== null && clue !== calculated[c])) throw new Error('Invalid digging witness.');
    this.included = [...included];
    this.model = buildModel(clues.map((clue,c) => included[c] ? clue : null), mode, true);
    const known = Logic.and(witness.map((digit,c) => this.model.variables[c][digit-1]));
    this.model.solver.forbid(known);
  }
  countSolutions(active: readonly boolean[]): 1 | 2 {
    if (active.length !== 81 || active.some((on,c) => on && !this.included[c])) throw new Error('Clue outside SAT model.');
    const { solver, variables } = this.model;
    const assumption = Logic.and(this.included.flatMap((on,c) => on ? [active[c] ? 'active'+c : Logic.not('active'+c)] : []));
    const alternative = solver.solveAssuming(assumption);
    if (!alternative) return 1;
    const values = variables.map(cell => cell.findIndex(variable => alternative.evaluate(variable)) + 1);
    const calculated = intersectionClues(values, this.mode);
    if (values.some(d => d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(c => values[c])).size !== 9)
      || this.clues.some((clue,c) => active[c] && clue !== null && clue !== calculated[c])
      || values.every((d,c) => d === this.witness[c])) throw new Error('Invalid alternative SAT completion.');
    return 2;
  }
}
