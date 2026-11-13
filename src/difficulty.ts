import { LEVELS, LEVEL_MAX_SCORE, TECHS } from './vendor/sudokui/engine/ratings';
import type { ExplainedStep, Walkthrough } from './walkthroughSolver';
import { ACTIVE_TECHNIQUES } from './techniquePolicy';

type RatedStep = Pick<ExplainedStep, 'kind' | 'technique'>;
const catalogue = new Map(Object.values(TECHS).map(info => [info.name, info]));
const activeScores = new Map(ACTIVE_TECHNIQUES.map(info => [info.name, info.score]));

export function stepScore(step: RatedStep): number | null {
  return activeScores.get(step.technique) ?? null;
}

export function rateWalkthrough(walk: Pick<Walkthrough, 'steps' | 'status'>) {
  let score = 0, levelIndex = 0;
  let complete = walk.status === 'solved';
  for (const step of walk.steps) {
    const points = stepScore(step);
    if (points === null) { complete = false; continue; }
    score += points;
    const info = step.kind === 'sudoku' ? catalogue.get(step.technique) : undefined;
    if (info) levelIndex = Math.max(levelIndex, LEVELS.indexOf(info.level));
  }
  while (levelIndex < LEVELS.length - 1 && score > LEVEL_MAX_SCORE[LEVELS[levelIndex]]) levelIndex++;
  return { score, level: complete ? LEVELS[levelIndex] : null, complete };
}
