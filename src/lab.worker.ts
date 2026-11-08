import { verifyWithSat } from './satVerifier';
import { generatePuzzle, type ClueMode } from './puzzle';
import { digPuzzle, type DiggingMode } from './digging';
import { maskedClues, verifyClues } from './lab';
import { VariantSolver } from './variantSolver';
import { solveWalkthrough } from './walkthroughSolver';
import { rateWalkthrough } from './difficulty';

export type LabRequest =
  | { task: 'verify'; mode: ClueMode; clues: (number | null)[] }
  | { task: 'custom'; mode: ClueMode; selected: number[]; min: number; max: number; attempts: number }
  | { task: 'simulation'; mode: ClueMode; trials: number; digging: DiggingMode; allowSearch: boolean; rateDifficulty?: boolean };

self.onmessage = ({ data }: MessageEvent<LabRequest>) => {
  try {
    if (data.task === 'verify') {
      const report = (solution: number[]) => postMessage({ type: 'solution', solution });
      let result;
      if (data.mode === 'sum' && data.clues.filter(clue => clue !== null).length <= 24) {
        try { result = verifyWithSat(data.clues, data.mode, report); }
        catch {
          postMessage({ type: 'progress', message: 'SAT checker unavailable; continuing with the independent exact search…' });
          result = verifyClues(data.clues, data.mode, report);
        }
      } else result = verifyClues(data.clues, data.mode, report);
      postMessage({ type: 'verified', ...result });
    } else if (data.task === 'custom') {
      for (let attempt = 1; attempt <= data.attempts; attempt++) {
        postMessage({ type: 'progress', message: `Attempt ${attempt} / ${data.attempts}: checking the selected pattern…` });
        const puzzle = generatePuzzle(Math.random, data.mode);
        const clues = maskedClues(puzzle.clues, data.selected);
        if (new VariantSolver(clues, data.mode, puzzle.solution).countSolutions() !== 1) continue;
        postMessage({ type: 'progress', message: `Attempt ${attempt}: unique; checking logical difficulty…` });
        const walk = solveWalkthrough(clues, data.mode, { allowSearch: false });
        const rating = rateWalkthrough(walk);
        if (!rating.complete || rating.score < data.min || rating.score > data.max) continue;
        postMessage({ type: 'built', clues, solution: puzzle.solution, walk, attempt });
        return;
      }
      postMessage({ type: 'exhausted', message: 'No matching puzzle found within the attempt limit. Try more clue positions, a wider score range, or another run.' });
    } else {
      for (let trial = 1; trial <= data.trials; trial++) {
        const started = performance.now();
        const puzzle = digPuzzle(data.mode, progress => postMessage({ type: 'progress', message: `Trial ${trial} / ${data.trials}: ${progress.phase}, ${progress.givens} clues remaining…` }), Math.random, undefined, data.digging, data.allowSearch);
        let rating: ReturnType<typeof rateWalkthrough> | undefined;
        if (data.rateDifficulty) {
          postMessage({ type: 'progress', message: 'Trial ' + trial + ': calculating difficulty…' });
          rating = rateWalkthrough(solveWalkthrough(puzzle.dugClues, data.mode, { allowSearch: data.allowSearch }));
        }
        postMessage({ type: 'sample', trial, clues: puzzle.dugClues, rating, ms: performance.now() - started });
      }
      postMessage({ type: 'complete' });
    }
  } catch (error) {
    postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
