declare module 'logic-solver' {
  type Formula = string | object;
  interface Solution { evaluate(term: string): boolean }
  class Solver {
    require(formula: Formula): void;
    forbid(formula: Formula): void;
    solve(): Solution | null;
  }
  const Logic: {
    Solver: typeof Solver;
    exactlyOne(terms: Formula[]): Formula;
    or(terms: Formula[]): Formula;
    and(terms: Formula[]): Formula;
    implies(left: Formula, right: Formula): Formula;
  };
  export default Logic;
}
declare module 'underscore' {
  const underscore: object;
  export default underscore;
}
