import { expect, it } from 'vitest';
import { ACTIVE_LOGICAL_ORDER, DISABLED_FAMILIES } from '../src/techniquePolicy';
import { SOLVE_ORDER, TECHS } from '../src/vendor/sudokui/engine/ratings';

it('excludes every requested family and Turbot Fish while retaining other active techniques', () => {
  expect([...DISABLED_FAMILIES]).toEqual(['Uniqueness','Coloring','Chains and Loops','Almost Locked Sets','Finned Fish','Complex Fish','Miscellaneous']);
  for (const tech of SOLVE_ORDER) {
    expect(ACTIVE_LOGICAL_ORDER.includes(tech)).toBe(
      tech !== 'BRUTE_FORCE' && tech !== 'TURBOT_FISH' && !DISABLED_FAMILIES.has(TECHS[tech].category));
  }
  expect(ACTIVE_LOGICAL_ORDER).toContain('SKYSCRAPER');
  expect(ACTIVE_LOGICAL_ORDER).toContain('TWO_STRING_KITE');
  expect(ACTIVE_LOGICAL_ORDER).toContain('XY_WING');
  expect(ACTIVE_LOGICAL_ORDER).toContain('EXOCET');
});
