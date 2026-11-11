import { expect, it } from 'vitest';
import { ACTIVE_LOGICAL_ORDER, DISABLED_FAMILIES } from '../src/techniquePolicy';
import { SOLVE_ORDER, TECHS } from '../src/vendor/sudokui/engine/ratings';

it('excludes every requested family and individual technique while retaining other active techniques', () => {
  expect([...DISABLED_FAMILIES]).toEqual(['Uniqueness','Coloring','Chains and Loops','Almost Locked Sets','Finned Fish','Complex Fish','Miscellaneous']);
  for (const tech of SOLVE_ORDER) {
    expect(ACTIVE_LOGICAL_ORDER.includes(tech)).toBe(
      !['BRUTE_FORCE', 'TURBOT_FISH', 'CELL_FORCING_CHAIN', 'DIGIT_FORCING_CHAIN', 'NISHIO_FORCING_CHAIN', 'PATTERN_OVERLAY'].includes(tech)
      && (tech === 'REMOTE_PAIR' || !DISABLED_FAMILIES.has(TECHS[tech].category)));
  }
  expect(ACTIVE_LOGICAL_ORDER).toContain('SKYSCRAPER');
  expect(ACTIVE_LOGICAL_ORDER).toContain('REMOTE_PAIR');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('CHUTE_REMOTE_PAIR');
  expect(ACTIVE_LOGICAL_ORDER).toContain('TWO_STRING_KITE');
  expect(ACTIVE_LOGICAL_ORDER).toContain('XY_WING');
  expect(ACTIVE_LOGICAL_ORDER).toContain('EXOCET');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('CELL_FORCING_CHAIN');
  expect(ACTIVE_LOGICAL_ORDER).toContain('UNIT_FORCING_CHAIN');
});
