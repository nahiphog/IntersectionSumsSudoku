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
  // Preserve the repertoire published on the Techniques page in the solver too.
  && (TECHS[tech].score === null || TECHS[tech].score < 400 || TECHS[tech].score > 800)
  && (tech === 'REMOTE_PAIR' || !DISABLED_FAMILIES.has(TECHS[tech].category)));
export const BRUTE_FORCE_NAME = 'Brute force';
export const BRUTE_FORCE_SCORE = 10000;
export const PRODUCT_LOCK_NAME = 'Locked candidates (Intersection products)';
export const PRODUCT_LOCK_SCORE = 50;
export const SUM_LOCK_NAME = 'Locked candidates (Intersection sums)';
export const SUM_LOCK_SCORE = 50;
export const PENCILMARK_LOCK_NAME = 'Locked candidates (Intersection pencilmarks)';
export const PENCILMARK_LOCK_SCORE = 50;
/** Shared source for the displayed repertoire and score lookup. */
export const ACTIVE_TECHNIQUES = [
  { name: 'Intersection sum', score: 10 },
  { name: 'Intersection product', score: 10 },
  { name: 'Intersection pencilmarks', score: 10 },
  { name: 'Combined sum equations', score: 10 },
  { name: 'Combined product equations', score: 10 },
  { name: PRODUCT_LOCK_NAME, score: PRODUCT_LOCK_SCORE },
  { name: SUM_LOCK_NAME, score: SUM_LOCK_SCORE },
  { name: PENCILMARK_LOCK_NAME, score: PENCILMARK_LOCK_SCORE },
  ...ACTIVE_LOGICAL_ORDER.map(tech => TECHS[tech]),
  { name: BRUTE_FORCE_NAME, score: BRUTE_FORCE_SCORE },
];
export const POLICY_NOTE = 'Only the repertoire listed on the Techniques page is enabled. Mode-specific techniques apply only to their matching clue mode. Brute force is used only when allowed.';
