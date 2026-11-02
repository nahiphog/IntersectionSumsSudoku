/** Classic Sudoku engine, available for the next solver development phase.
 * These functions do not yet understand Intersection Sums clues.
 * Uniqueness-based deductions must not be applied to a variant merely
 * because its combined constraints have a unique solution.
 */
export * from './vendor/sudokui/engine/board';
export * from './vendor/sudokui/engine/humanSolver';
export * from './vendor/sudokui/engine/ratings';
export * from './vendor/sudokui/engine/steps';
export { solve, countSolutions, hasUniqueSolution } from './vendor/sudokui/engine/bruteForce';
