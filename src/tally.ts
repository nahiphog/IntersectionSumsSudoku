import { stepScore } from './difficulty';
import type { Walkthrough } from './walkthroughSolver';
import type { ClueMode } from './puzzle';
export const TALLY_KEY = 'intersection-latest-tally-v2';
export function tallySteps(walk: Walkthrough) {
  const rows = new Map<string, { name: string; count: number; points: number | null }>();
  for (const step of walk.steps) {
    const row = rows.get(step.technique) ?? { name: step.technique, count: 0, points: stepScore(step) };
    row.count++; rows.set(step.technique, row);
  }
  return [...rows.values()];
}
export function saveTally(walk: Walkthrough, mode: ClueMode) {
  try { localStorage.setItem(TALLY_KEY, JSON.stringify({ mode, status: walk.status, date: new Date().toISOString(), rows: tallySteps(walk) })); } catch { /* Walkthrough remains usable when browser storage is disabled. */ }
}
