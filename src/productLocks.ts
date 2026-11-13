import { findIntersectionLockedCandidates } from './intersectionLocks';
import type { Grid } from './vendor/sudokui/engine/board';
import type { VariantSolver } from './variantSolver';
import type { ClueMode } from './puzzle';

export function findProductLockedCandidates(grid: Grid, solver: VariantSolver, mode: ClueMode) {
  return mode === 'product' ? findIntersectionLockedCandidates(grid, solver, mode) : null;
}
