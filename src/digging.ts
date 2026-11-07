import { generatePuzzle, type ClueMode, type IntersectionPuzzle } from './puzzle';
import { VariantSolver } from './variantSolver';
import { solveWalkthrough } from './walkthroughSolver';

/** A stall retains the clue; it never counts as a successful solve. */
export const isLogicallySolvableForDigging = (clues: (number | null)[], mode: ClueMode) =>
  solveWalkthrough(clues, mode, { allowSearch: false, profile: 'generation', recordSteps: false }).status === 'solved';

export type DiggingMode = 'single' | 'dual';
export const diggingGroups = (mode: DiggingMode): number[][] => mode === 'dual'
  ? Array.from({ length: 41 }, (_, cell) => cell === 40 ? [40] : [cell, 80 - cell])
  : Array.from({ length: 81 }, (_, cell) => [cell]);

export interface DigProgress {
  attempt: number;
  pass?: number;
  tested: number;
  total?: number;
  givens: number;
  phase: 'checking' | 'digging';
  dugClues?: (number | null)[];
}
export interface DugPuzzle extends IntersectionPuzzle {
  dugClues: (number | null)[];
  attempts: number;
}

export function digPuzzle(
  mode: ClueMode,
  onProgress: (progress: DigProgress, puzzle?: IntersectionPuzzle) => void = () => {},
  random: () => number = Math.random,
  initial?: IntersectionPuzzle,
  diggingMode: DiggingMode = 'single',
  allowBacktracking = true,
): DugPuzzle {
  for (let attempt = 1; ; attempt++) {
    const puzzle = attempt === 1 && initial ? initial : generatePuzzle(random, mode);
    onProgress({ attempt, tested: 0, givens: 81, phase: 'checking' }, puzzle);
    const solver = new VariantSolver(puzzle.clues, mode, puzzle.solution);
    if ((!allowBacktracking && !isLogicallySolvableForDigging(puzzle.clues, mode)) || solver.countSolutions() !== 1) continue;
    const active = Array<boolean>(81).fill(true);
    onProgress({ attempt, tested: 0, total: diggingMode === 'dual' ? 41 : 81, pass: 1, givens: 81, phase: 'digging', dugClues: [...puzzle.clues] });
    const order = diggingGroups(diggingMode);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let givens = 81;
    // Counts identify board states within this attempt: accepted removals only decrease givens.
    const failedRemovals = diggingMode === 'single' && !allowBacktracking
      ? new Map<number, number | 'multiple'>() : undefined;
    let removed: boolean;
    let pass = 0;
    do {
      removed = false;
      pass++;
      for (const [tested, cells] of order.entries()) {
        const first = cells[0];
        if (!active[first]) continue;
        const failure = failedRemovals?.get(first);
        if (failure === 'multiple' || failure === givens) continue;
        for (const cell of cells) active[cell] = false;
        // Reject logical stalls before spending time on an exact uniqueness search.
        const logical = allowBacktracking || isLogicallySolvableForDigging(
          puzzle.clues.map((clue, index) => active[index] ? clue : null), mode);
        const solutions = logical ? solver.countSolutions(active) : undefined;
        if (solutions === 1) {
          givens -= cells.length;
          removed = true;
        } else {
          if (solutions === 0) throw new Error('A clue removal excluded the known solution.');
          failedRemovals?.set(first, solutions === 2 ? 'multiple' : givens);
          for (const cell of cells) active[cell] = true;
        }
        onProgress({ attempt, tested: tested + 1, total: order.length, givens, pass, phase: 'digging', dugClues: puzzle.clues.map((clue, cell) => active[cell] ? clue : null) });
      }
    } while (removed && !allowBacktracking);
    // Recheck retained clues: a deterministic logical strategy need not behave
    // monotonically as clues change. Uniqueness alone is monotone, so when
    // backtracking is allowed a single pass is sufficient.
    return { ...puzzle, dugClues: puzzle.clues.map((clue, cell) => active[cell] ? clue : null), attempts: attempt };
  }
}
