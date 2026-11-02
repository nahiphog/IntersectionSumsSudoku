import { generatePuzzle, type ClueMode, type IntersectionPuzzle } from './puzzle';
import { VariantSolver } from './variantSolver';
import { solveWalkthrough } from './walkthroughSolver';

/** A stall retains the clue; it never counts as a successful solve. */
export const isLogicallySolvableForDigging = (clues: (number | null)[], mode: ClueMode) =>
  solveWalkthrough(clues, mode, { allowSearch: false, profile: 'generation', recordSteps: false }).status === 'solved';

export interface DigProgress {
  attempt: number;
  pass?: number;
  tested: number;
  givens: number;
  phase: 'checking' | 'digging';
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
): DugPuzzle {
  for (let attempt = 1; ; attempt++) {
    const puzzle = attempt === 1 && initial ? initial : generatePuzzle(random, mode);
    onProgress({ attempt, tested: 0, givens: 81, phase: 'checking' }, puzzle);
    const solver = new VariantSolver(puzzle.clues, mode, puzzle.solution);
    if (!isLogicallySolvableForDigging(puzzle.clues, mode) || solver.countSolutions() !== 1) continue;
    const active = Array<boolean>(81).fill(true);
    const order = Array.from({ length: 81 }, (_, i) => i);
    for (let i = 80; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let givens = 81;
    let removed: boolean;
    let pass = 0;
    do {
      removed = false;
      pass++;
      for (const [tested, cell] of order.entries()) {
        if (!active[cell]) continue;
        active[cell] = false;
        const candidate = puzzle.clues.map((clue, index) => active[index] ? clue : null);
        // Reject logical stalls before spending time on an exact uniqueness search.
        if (isLogicallySolvableForDigging(candidate, mode)
          && solver.countSolutions(active) === 1) {
          givens--;
          removed = true;
        } else active[cell] = true;
        onProgress({ attempt, tested: tested + 1, givens, pass, phase: 'digging' });
      }
    } while (removed);
    // Recheck retained clues: a deterministic logical strategy need not behave
    // monotonically as clues change. Stop only after a pass removes nothing.
    return { ...puzzle, dugClues: puzzle.clues.map((clue, cell) => active[cell] ? clue : null), attempts: attempt };
  }
}
