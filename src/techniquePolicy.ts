import { SOLVE_ORDER, TECHS, type Category, type Tech } from './vendor/sudokui/engine/ratings';

// Temporary exclusions; keep the imported engine intact for later re-enabling.
export const DISABLED_FAMILIES: ReadonlySet<Category> = new Set([
  'Uniqueness', 'Coloring', 'Chains and Loops', 'Almost Locked Sets',
  'Finned Fish', 'Complex Fish', 'Miscellaneous',
]);
export const DISABLED_TECHNIQUES: ReadonlySet<Tech> = new Set([
  'TURBOT_FISH', 'CELL_FORCING_CHAIN', 'DIGIT_FORCING_CHAIN', 'NISHIO_FORCING_CHAIN', 'PATTERN_OVERLAY',
]);
export const ACTIVE_LOGICAL_ORDER = SOLVE_ORDER.filter(tech =>
  tech !== 'BRUTE_FORCE' && !DISABLED_TECHNIQUES.has(tech)
  && (tech === 'REMOTE_PAIR' || !DISABLED_FAMILIES.has(TECHS[tech].category)));
export const BRUTE_FORCE_NAME = 'Brute force';
export const BRUTE_FORCE_SCORE = 10000;
export const POLICY_NOTE = 'Temporarily disabled: Uniqueness, Colouring, Chains & loops (except Remote Pair), ALS, Finned Fish, Complex fish, Miscellaneous, Turbot Fish, Cell Forcing Chain, Digit Forcing Chain, Nishio Forcing Chain, and Pattern Overlay.';
