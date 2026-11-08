import Logic from './satRuntime';
import { VariantSolver, type Clues } from './variantSolver';
import { UNITS } from './vendor/sudokui/engine/board';
import { intersectionClues, type ClueMode } from './puzzle';

/** Exact SAT verification. Blocking only the 81 cell assignments (not auxiliary
 * tuple selectors) makes the second model a genuinely different Sudoku grid. */
function buildModel(clues: Clues, mode: ClueMode, guarded = false) {
  const options = new VariantSolver(clues, mode).clueOptions();
  const solver = new Logic.Solver();
  const variables = Array.from({ length: 81 }, (_, cell) =>
    Array.from({ length: 9 }, (_, digit) => `c${cell}d${digit + 1}`));
  for (const cell of variables) solver.require(Logic.exactlyOne(cell));
  for (const unit of UNITS) for (let digit = 0; digit < 9; digit++) {
    solver.require(Logic.exactlyOne(unit.map(cell => variables[cell][digit])));
  }
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
