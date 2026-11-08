# Adaptive exact uniqueness during digging

Generate, Simulation and Simulation difficulty all call `digPuzzle`. Both clue
operations and both digging modes use the same uniqueness policy:

- Keep the original exact solver for dense boards and easy removal attempts.
- At 24 or fewer remaining clues, give that solver a 10,000-node budget. Exhaustion
  throws `SearchLimitError`; it is never reported as a solution count.
- For harder attempts, build a guarded SAT model and reuse it for subsequent hard
  attempts. Validate and exclude the original completed grid. UNSAT then proves
  uniqueness; a second model is independently validated before reporting ambiguity.
- Each query explicitly enables or disables every included clue. Failed removals
  can restore clues without retaining assumptions from earlier queries.
- If SAT throws, disable it for that generation attempt and use unlimited exact
  search. Retain the existing logical-solvability requirement when brute force is off.

`node scripts/benchmark-digging-sat.mjs` compares seeded single-cell generation
against commit 257a7e2 in isolated workers. A 60-second cutoff means unknown, never
unique. Optional environment filters: BENCH_MODES, BENCH_SEEDS, BENCH_VERSIONS.
BENCH_TIMEOUT_MS changes the cutoff; BENCH_OUTPUT saves raw JSON results.

SAT is not uniformly faster: direct SAT increased seed-44 Sum generation time in
development comparisons, so the integration preserves the original easy-search
path. Adaptive seed-44 comparisons produced identical 18-clue Sum and 12-clue
Product puzzles with similar times. Timing depends on hardware and system load;
this change does not promise a speedup for every generated puzzle.

Regression tests cover assumption restoration, invalid witnesses, search-budget
exhaustion, successful SAT integration and fallback after SAT errors. Final dug
puzzles in integration tests are checked with the independent original solver.
