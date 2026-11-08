# Adaptive exact uniqueness during digging

Generate, Simulation and Simulation difficulty all call `digPuzzle`. Both clue
operations and both digging modes use the same uniqueness policy:

- Keep the original exact solver for dense boards and easy removal attempts.
- At 24 or fewer remaining clues, give that solver a 64-node Sum budget or
  10,000-node Product budget. Exhaustion
  throws `SearchLimitError`; it is never reported as a solution count.
- For harder attempts, build a guarded SAT model and reuse it for subsequent hard
  attempts. Validate and exclude the original completed grid. UNSAT then proves
  uniqueness; a second model is independently validated before reporting ambiguity.
- Each query explicitly enables or disables every included clue. Failed removals
  can restore clues without retaining assumptions from earlier queries.
- If SAT throws, disable it for that generation attempt and use unlimited exact
  search. Retain the existing logical-solvability requirement when brute force is off.

Sum SAT uses two partial totals rather than a selector for every complete
neighbour tuple. Each two-cell total is constrained in all three directions:
both digits fix the total, and the total plus either digit fixes the other.
Only the equality between the two totals and the clue is guarded. Inactive
clues impose no additional restriction on the Sudoku digits. Digging uses direct
pairwise Sudoku exclusions to avoid extra grouping variables during search.
Product encoding is unchanged. The MiniSat heap remains 64 MiB; allocation errors
still fall back rather than being treated as an UNSAT result.

`node scripts/benchmark-digging-sat.mjs` compares seeded single-cell generation
against commit 257a7e2 in isolated workers. A 60-second cutoff means unknown, never
unique. Optional environment filters: BENCH_MODES, BENCH_SEEDS, BENCH_VERSIONS.
BENCH_TIMEOUT_MS changes the cutoff; BENCH_OUTPUT saves raw JSON results.
BENCH_BASELINE selects the comparison commit. Memory-limit messages are recorded.

SAT is not uniformly faster: direct SAT increased seed-44 Sum generation time in
development comparisons, so the integration preserves the original easy-search
path. Adaptive seed-44 comparisons produced identical 18-clue Sum and 12-clue
Product puzzles with similar times. Timing depends on hardware and system load;
this change does not promise a speedup for every generated puzzle.

See `COMPACT-SAT-BENCHMARK.md` for the follow-up measurements after replacing the
tuple encoding and shortening the Sum search budget.

Regression tests cover assumption restoration, invalid witnesses, search-budget
exhaustion, successful SAT integration and fallback after SAT errors. Final dug
puzzles in integration tests are checked with the independent original solver.
