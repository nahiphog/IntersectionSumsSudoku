import { SOLVE_ORDER, TECHS, type Category } from './vendor/sudokui/engine/ratings';

// Temporary exclusions; keep the imported engine intact for later re-enabling.
export const DISABLED_FAMILIES: ReadonlySet<Category> = new Set([
  'Uniqueness', 'Coloring', 'Chains and Loops', 'Almost Locked Sets',
  'Finned Fish', 'Complex Fish', 'Miscellaneous',
]);
export const ACTIVE_LOGICAL_ORDER = SOLVE_ORDER.filter(tech =>
  tech !== 'BRUTE_FORCE' && tech !== 'TURBOT_FISH' && !DISABLED_FAMILIES.has(TECHS[tech].category));
export const BRUTE_FORCE_NAME = 'Brute force';
export const BRUTE_FORCE_SCORE = 10000;
export const POLICY_NOTE = 'Temporarily disabled: Uniqueness, Colouring, Chains & loops, ALS, Finned Fish, Complex fish, Miscellaneous, and Turbot Fish.';
