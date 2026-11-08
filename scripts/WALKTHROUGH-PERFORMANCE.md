# Walkthrough performance update

Run `node scripts/benchmark-walkthrough.mjs` to compare against commit `79a3450`. Each case runs in an isolated worker with a 10-second diagnostic ceiling. The ceiling is only for the benchmark; it is not a solution verdict. `BENCH_TASKS` can restrict the comma-separated cases.

The sparse fixture is the user's 15-clue Sum puzzle. The shared-completion case uses the completed grid the user supplied. This models generation, where the completed grid already exists, and verification after its first completion has been found. It does not measure finding that completion from scratch.

One local paired run (milliseconds, subject to machine load):

| Case | Before | After |
| --- | ---: | ---: |
| Full-clue Sum walkthrough | 265 | 235 |
| Full-clue Product walkthrough | 128 | 117 |
| 15-clue Sum, completion available | >10000 | 2189 |
| 15-clue Sum uniqueness from scratch | >10000 | >10000 |

The optimized sparse walkthrough produced its first deduction in 41 ms, and finished with 164 steps including 18 explicitly scored Brute force placements. This is solver timing, not browser rendering timing. Full-clue walkthrough step counts were unchanged (135 Sum, 119 Product). Final heap usage was approximately 21 MB for the sparse walkthrough; this is not a peak-memory measurement.

Sum uniqueness checks on the full-clue fixture improved in two short runs (86 to 63 ms, 140 to 100 ms). Product timings varied and did not improve, so the new constraint-signature optimization is restricted to Sum. These are small fixtures, not evidence of an across-the-board uniqueness speedup.

Implementation:

- Stream the first deduction immediately, then batches while solving, and flush before expensive finders/search. Cancellation retains already received steps.
- Verify begins logical-only solving concurrently. Its exact solver reports the first completion before finishing its search for a second; that completion is reused for explicitly labelled brute-force walkthrough steps.
- Generated and halted puzzles reuse their validated completed grid for brute-force steps. Logical deductions never read it. Shared completions are checked against all Sudoku units, clues, and current candidates.
- A standalone walkthrough searches for a completion at most once, rather than once for each brute-force placement.
- Cache the exact Sum equations for the last active-clue mask within a solver instance. In Sum search branches, skip equation/clue propagation when the relevant domains have not changed. Branch-local signatures are never reused across backtracking siblings.
- No additional logical-technique failure cache was added: inspection showed each finder is already tested once per candidate state, and every accepted step must change that state. A cache would add overhead without avoiding work in this loop.

Uniqueness verification remains exhaustive. Partial logic, a known completion, cancellation, and benchmark timeouts never establish uniqueness. The sparse fixture remains slow to verify from scratch; the new UI no longer withholds all deductions during that wait.
