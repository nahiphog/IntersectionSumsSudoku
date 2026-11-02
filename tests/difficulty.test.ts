import { expect, it } from 'vitest';
import { rateWalkthrough, stepScore } from '../src/difficulty';
import { TECHS } from '../src/vendor/sudokui/engine/ratings';
import type { ExplainedStep } from '../src/walkthroughSolver';

const step = (kind: ExplainedStep['kind'], technique: string): ExplainedStep => ({
  kind, technique, description: '', before: { values: [], candidates: [] },
  after: { values: [], candidates: [] }, placements: [], eliminations: [],
  peerEliminations: [], related: [],
});

it('adds 10 for every variant deduction and uses imported classic scores', () => {
  const steps = [step('constraint', 'Intersection sum'), step('constraint', 'Intersection product'),
    step('constraint', 'Combined sum equations'), step('sudoku', TECHS.NAKED_SINGLE.name)];
  expect(rateWalkthrough({ status: 'solved', steps })).toEqual({
    score: 30 + TECHS.NAKED_SINGLE.score, level: 'Easy', complete: true,
  });
});
it('uses total-score thresholds and the hardest technique level', () => {
  expect(rateWalkthrough({ status: 'solved', steps: Array(81).fill(step('constraint', 'Intersection sum')) }).level).toBe('Medium');
  expect(rateWalkthrough({ status: 'solved', steps: [step('sudoku', TECHS.X_WING.name)] }).level).toBe(TECHS.X_WING.level);
});
it('scores every brute-force instance and leaves stalled ratings incomplete', () => {
  const logical = step('constraint', 'Intersection product');
  const search = step('search', 'Brute force');
  expect(stepScore(search)).toBe(10000);
  expect(rateWalkthrough({ status: 'solved', steps: [logical, search, search] }))
    .toEqual({ score: 20010, level: 'Extreme', complete: true });
  expect(rateWalkthrough({ status: 'stalled', steps: [logical, search] }))
    .toEqual({ score: 10010, level: null, complete: false });
});
