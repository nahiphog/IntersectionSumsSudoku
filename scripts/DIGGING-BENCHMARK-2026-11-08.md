# Digging benchmark — 8 November 2026

The update did not demonstrate an average Sum speedup. Among the two Sum pairs
that completed within the limit, average duration increased by 57.7%. Eight of ten
Sum seeds timed out on BOTH versions, so the full uncapped mean is unknown.
Product averaged 19.1% faster in this small, single-run sample.

| Mode / measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Sum: mean of 2 completed pairs | 18.315 s | 28.887 s | 57.7% slower |
| Sum: mean with all 10 trials capped at 60 s | 51.663 s | 53.777 s | 4.1% higher |
| Sum: timeouts | 8 / 10 | 8 / 10 | Unchanged |
| Product: mean of all 10 pairs | 0.494 s | 0.399 s | 19.1% faster |
| Product: timeouts | 0 / 10 | 0 / 10 | Unchanged |

The capped mean substitutes 60 seconds for each timeout; it is NOT an average
completion duration or proof of the difference in uncapped means. Completed-only
Sum results exclude most trials and must not be generalized to all Sum puzzles.

## Method

- Baseline: 257a7e2; updated digging: 320b52b.
- Node v24.19.0, Intel Core i7-8665U @ 1.90 GHz.
- Seeds 40–49, same LCG sequence for both versions, Sum and Product.
- Single-cell digging, brute force allowed (Simulation defaults).
- Each trial ran in a fresh isolated worker, sequentially; run order alternated
  before/after by seed parity. One observation per version/seed, no warm-up.
- Measured completed trial time covers full-grid creation and digging. It excludes
  module loading, UI rendering, and walkthrough/difficulty calculation. The cutoff
  is worker wall time, including startup. No build or test suite ran concurrently.
- Both versions produced identical clue grids in every completed pair (12 pairs).
  This is a regression comparison, not a new independent proof of uniqueness.
- Product's sub-second timings are sensitive to system load and JIT effects; the
  sample does not establish a statistically reliable speedup or its cause.
- Simulation difficulty also calculates a rating; its total duration is not
  measured here. This benchmark isolates the shared digging process.

## Sum details

| Seed | Before (s) | After (s) | Remaining clues |
| --- | ---: | ---: | ---: |
| 40 | >60 | >60 | Unknown |
| 41 | >60 | >60 | Unknown |
| 42 | >60 | >60 | Unknown |
| 43 | 29.026 | 52.166 | 17 |
| 44 | 7.603 | 5.607 | 18 |
| 45 | >60 | >60 | Unknown |
| 46 | >60 | >60 | Unknown |
| 47 | >60 | >60 | Unknown |
| 48 | >60 | >60 | Unknown |
| 49 | >60 | >60 | Unknown |

Several updated Sum trials logged MiniSat's 64 MiB memory limit and fell back to
the original exact solver. This adds work before fallback; seed 43 was one such
completed trial. These measurements support investigating SAT memory use and
fallback policy next, rather than claiming the update reduced Sum trial duration.

## Reproduce (PowerShell)

```powershell
$env:BENCH_OUTPUT='scripts/digging-benchmark-results.json'
node scripts/benchmark-digging-sat.mjs
```

Raw timings and completed clue grids are in `digging-benchmark-results.json`.
The script uses working-tree digging code for the updated side; check out 320b52b
for the measured implementation if the solver subsequently changes.
