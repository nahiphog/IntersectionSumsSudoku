import Logic from './satRuntime';
import { VariantSolver, type Clues } from './variantSolver';
import { UNITS } from './vendor/sudokui/engine/board';
import { intersectionClues, type ClueMode } from './puzzle';

/** Exact SAT verification. Blocking only the 81 cell assignments (not auxiliary
 * tuple selectors) makes the second model a genuinely different Sudoku grid. */
export function verifyWithSat(clues: Clues, mode: ClueMode, onSolution?: (values: number[]) => void) {
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
    solver.require(Logic.or(selectors));
    // A selected tuple fixes all its neighbours to that exact allowed assignment.
    tuples.forEach((tuple, i) => tuple.forEach((mask, j) => {
      solver.require(Logic.implies(selectors[i], variables[neighbours[j]][31 - Math.clz32(mask)]));
    }));
    // Redundant support clauses strengthen propagation without excluding any model.
    neighbours.forEach((neighbour, j) => {
      for (let digit = 0; digit < 9; digit++) {
        solver.require(Logic.implies(variables[neighbour][digit],
          Logic.or(selectors.filter((_, i) => tuples[i][j] === (1 << digit)))));
      }
    });
  }
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
