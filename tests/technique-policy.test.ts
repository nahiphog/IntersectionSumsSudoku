import { expect, it } from 'vitest';
import { ACTIVE_LOGICAL_ORDER, ACTIVE_TECHNIQUES, DISABLED_FAMILIES } from '../src/techniquePolicy';
import { stepScore } from '../src/difficulty';
import { SOLVE_ORDER, TECHS } from '../src/vendor/sudokui/engine/ratings';

it('excludes every requested family and individual technique while retaining other active techniques', () => {
  expect([...DISABLED_FAMILIES]).toEqual(['Uniqueness','Coloring','Chains and Loops','Almost Locked Sets','Finned Fish','Complex Fish','Miscellaneous']);
  for (const tech of SOLVE_ORDER) {
    expect(ACTIVE_LOGICAL_ORDER.includes(tech)).toBe(
      !['BRUTE_FORCE', 'TURBOT_FISH', 'CELL_FORCING_CHAIN', 'DIGIT_FORCING_CHAIN', 'NISHIO_FORCING_CHAIN', 'PATTERN_OVERLAY'].includes(tech)
      && (TECHS[tech].score === null || TECHS[tech].score < 400 || TECHS[tech].score > 800)
      && (tech === 'REMOTE_PAIR' || !DISABLED_FAMILIES.has(TECHS[tech].category)));
  }
  expect(ACTIVE_LOGICAL_ORDER).toContain('SKYSCRAPER');
  expect(ACTIVE_LOGICAL_ORDER).toContain('REMOTE_PAIR');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('CHUTE_REMOTE_PAIR');
  expect(ACTIVE_LOGICAL_ORDER).toContain('TWO_STRING_KITE');
  expect(ACTIVE_LOGICAL_ORDER).toContain('XY_WING');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('EXOCET');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('CELL_FORCING_CHAIN');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('UNIT_FORCING_CHAIN');
  expect(ACTIVE_LOGICAL_ORDER).not.toContain('FORCING_NET');
});

it('lists and scores every enabled classic technique, with no hidden classics', () => {
  const displayed = new Set(ACTIVE_TECHNIQUES.map(info => info.name));
  for (const tech of SOLVE_ORDER.filter(tech => tech !== 'BRUTE_FORCE')) {
    expect(displayed.has(TECHS[tech].name)).toBe(ACTIVE_LOGICAL_ORDER.includes(tech));
  }
  for (const info of ACTIVE_TECHNIQUES) {
    expect(stepScore({ kind: 'sudoku', technique: info.name })).toBe(info.score);
  }
  expect(stepScore({ kind: 'sudoku', technique: 'Forcing Net' })).toBeNull();
  expect(stepScore({ kind: 'constraint', technique: 'Unlisted deduction' })).toBeNull();
});
