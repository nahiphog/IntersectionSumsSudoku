import Logic from './satRuntime';
import { VariantSolver, type Clues } from './variantSolver';
import { UNITS } from './vendor/sudokui/engine/board';
import { clueValue, intersectionClues, orthogonalNeighbours, type ClueMode } from './puzzle';
import { sumEquations, type SumEquation } from './sumEquations';

/** Exact consequences of the current clues and unit totals. Only short signed
 * equations are encoded; their equality is guarded by this exact clue mask.
 * Cached partial totals merely define arithmetic and are valid for every mask. */
function addDerivedSums(solver: InstanceType<typeof Logic.Solver>, variables: string[][], equations: SumEquation[],
  guard: Parameters<typeof solver.require>[0], cache: Map<string, Map<number, string>>) {
  for (const equation of equations) {
    const { terms, target } = equation;
    const totals = (group: [number, number][]) => {
      if (group.length === 1) return new Map(variables[group[0][0]].map((v, d) => [(d + 1) * group[0][1], v]));
      const [[a, ka], [b, kb]] = group;
      const key = `${a}_${ka}_${b}_${kb}`;
      if (cache.has(key)) return cache.get(key)!;
      const sums = new Map<number, string>();
      cache.set(key, sums);
      for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) {
        const value = x * ka + y * kb;
        if (!sums.has(value)) sums.set(value, `derived${key}v${value}`);
        solver.require(Logic.or([Logic.not(variables[a][x-1]), Logic.not(variables[b][y-1]), sums.get(value)!]));
      }
      solver.require(Logic.exactlyOne([...sums.values()]));
      for (const [value, total] of sums) for (let x = 1; x <= 9; x++) {
        const y = (value - x * ka) / kb;
        solver.require(Logic.or([Logic.not(total), Logic.not(variables[a][x-1]), ...(y >= 1 && y <= 9 ? [variables[b][y-1]] : [])]));
        const z = (value - x * kb) / ka;
        solver.require(Logic.or([Logic.not(total), Logic.not(variables[b][x-1]), ...(z >= 1 && z <= 9 ? [variables[a][z-1]] : [])]));
      }
      return sums;
    };
    const middle = Math.floor(terms.length / 2);
    const left = totals(terms.slice(0, middle)), right = totals(terms.slice(middle));
    for (const [a, v] of left) solver.require(Logic.implies(guard, Logic.or([Logic.not(v), ...(right.has(target-a) ? [right.get(target-a)!] : [])])));
    for (const [b, v] of right) solver.require(Logic.implies(guard, Logic.or([Logic.not(v), ...(left.has(target-b) ? [left.get(target-b)!] : [])])));
  }
}

/** Exact SAT verification. Blocking only the 81 cell assignments (not auxiliary
 * tuple selectors) makes the second model a genuinely different Sudoku grid. */
function buildModel(clues: Clues, mode: ClueMode, guarded = false) {
  if (clues.length !== 81 || clues.some(c => c !== null && (!Number.isSafeInteger(c) || c < 1))) {
    throw new Error('Expected 81 positive clues or null for missing clues.');
  }
  const options = mode !== 'sum' ? new VariantSolver(clues, mode).clueOptions() : [];
  const solver = new Logic.Solver();
  const variables = Array.from({ length: 81 }, (_, cell) =>
    Array.from({ length: 9 }, (_, digit) => `c${cell}d${digit + 1}`));
  const exactlyOne = (terms: string[]) => {
    if (mode !== 'sum' || !guarded) { solver.require(Logic.exactlyOne(terms)); return; }
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
      || clues.some((clue, cell) => clue !== null && (mode === 'pencilmark' ? clueValue(String(clue).split('').map(Number), mode) : clue) !== calculated[cell])
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
  private enrichedModel?: ReturnType<typeof buildModel>;
  private derivedTotals = new Map<string, Map<number, string>>();
  constructor(private clues: Clues, private mode: ClueMode, private witness: readonly number[], private included: readonly boolean[]) {
    const calculated = intersectionClues([...witness], mode);
    if (witness.length !== 81 || witness.some(d => !Number.isInteger(d) || d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(c => witness[c])).size !== 9)
      || clues.some((clue,c) => clue !== null && (mode === 'pencilmark' ? clueValue(String(clue).split('').map(Number), mode) : clue) !== calculated[c])) throw new Error('Invalid digging witness.');
    this.included = [...included];
    this.model = buildModel(clues.map((clue,c) => included[c] ? clue : null), mode, true);
    const known = Logic.and(witness.map((digit,c) => this.model.variables[c][digit-1]));
    this.model.solver.forbid(known);
  }
  countSolutions(active: readonly boolean[], rootDomains?: Uint16Array): 1 | 2 {
    if (active.length !== 81 || active.some((on,c) => on && !this.included[c])) throw new Error('Clue outside SAT model.');
    // Empirical routing, not a logical rule: small-domain corner sums make the
    // extra algebra useful. Other puzzles retain the original SAT search path.
    const tightCorner = this.mode === 'sum' && [0,8,72,80].some(cell => active[cell]
      && this.clues[cell] !== null && (this.clues[cell]! <= 6 || this.clues[cell]! >= 14));
    const equations = tightCorner ? sumEquations(this.clues, active).filter(({ terms }) =>
      terms.length >= 2 && terms.length <= 4 && terms.every(([, k]) => Math.abs(k) === 1)
      && terms.some(([, k]) => k < 0) && terms.some(([, k]) => k > 0)) : [];
    const enriched = equations.length >= 3;
    if (enriched && !this.enrichedModel) {
      this.enrichedModel = buildModel(this.clues.map((clue,c) => this.included[c] ? clue : null), this.mode, true);
      this.enrichedModel.solver.forbid(Logic.and(this.witness.map((digit,c) => this.enrichedModel!.variables[c][digit-1])));
    }
    const { solver, variables } = enriched ? this.enrichedModel! : this.model;
    const assumption = Logic.and(this.included.flatMap((on,c) => on ? [active[c] ? 'active'+c : Logic.not('active'+c)] : []));
    if (enriched) addDerivedSums(solver, variables, equations, assumption, this.derivedTotals);
    if (rootDomains) {
      if (rootDomains.length !== 81 || rootDomains.some((mask, c) => mask > 511 || !(mask & (1 << (this.witness[c] - 1))))) {
        throw new Error('Invalid propagated domains.');
      }
      for (let cell = 0; cell < 81; cell++) if (enriched && rootDomains[cell] !== 511) {
        solver.require(Logic.implies(assumption,
          Logic.or(variables[cell].filter((_, digit) => rootDomains[cell] & (1 << digit)))));
      }
    }
    const alternative = solver.solveAssuming(assumption);
    if (!alternative) return 1;
    const values = variables.map(cell => cell.findIndex(variable => alternative.evaluate(variable)) + 1);
    const calculated = intersectionClues(values, this.mode);
    if (values.some(d => d < 1 || d > 9)
      || UNITS.some(unit => new Set(unit.map(c => values[c])).size !== 9)
      || this.clues.some((clue,c) => active[c] && clue !== null && (this.mode === 'pencilmark' ? clueValue(String(clue).split('').map(Number), this.mode) : clue) !== calculated[c])
      || values.every((d,c) => d === this.witness[c])) throw new Error('Invalid alternative SAT completion.');
    return 2;
  }
}
