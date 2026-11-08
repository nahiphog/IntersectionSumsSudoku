# Slow Sum digging: selective algebra-assisted SAT

## Final measurements

Compared with the deployed baseline **38ff314**, using identical seeded puzzles,
single-cell digging and brute force allowed. Each before/after pair ran sequentially
in fresh workers; order alternated by seed. No builds or tests ran concurrently.
All ten final runs completed within 300 seconds, with no detected timing pauses
and no MiniSat memory-limit messages. Every pair produced identical clue grids.

| Seed | Before (seconds) | After (seconds) | Change |
| --- | ---: | ---: | --- |
| 48 — formerly measured at 108.69 s | 70.233 | 33.173 | 52.8% faster |
| 49 | 39.859 | 43.770 | 9.8% slower |
| 45 | 50.495 | 40.167 | 20.5% faster |
| **Mean: three historically slow seeds** | **53.529** | **39.037** | **27.1% faster** |
| 42 — additional corner-constrained case | 6.828 | 10.452 | 53.1% slower |
| 44 — faster control | 4.212 | 4.936 | 17.2% slower |
| **Mean: all five seeds** | **34.325** | **26.500** | **22.8% faster** |

Use the fresh paired baseline, not the historical 108.69-second result, for the
improvement percentage. System load and warm-up materially affected earlier runs.
This is a small, selected sample with one final observation per version/seed, not
a statistical confidence estimate or evidence of a universal average speedup.
Some cases regress. Seeds 45, 49 and 44 take the original SAT path during the
expensive sparse checks, so timing variation contributes to their differences.
Seed 42 demonstrates that even eligible puzzles can become slower.

Raw data and hardware/runtime metadata: `sum-tail-final-results.json`.
Intermediate experiments and interrupted timings are excluded from these figures.

## Implementation and correctness

- Preserve candidate eliminations made by the finite-domain checker **before any
  trial assignment**. The callback receives a copy and fires only at the root.
- Derive equations using the existing exact BigInt elimination of active clues
  and the total of 45 in every Sudoku unit. Encode only equations of two to four
  cells, coefficients +1/-1, containing both signs. Other equations are omitted;
  they are never approximated.
- Cache signed two-cell totals. These define arithmetic independent of clues.
  Guard the derived equalities and candidate restrictions with the complete active
  clue mask, so deductions cannot leak into a later removal or restoration.
- Select the enriched model only when at least three eligible equations exist
  and an active corner clue restricts each neighbour to at most four digits
  (sum <=6 or >=14). This is an empirical performance heuristic, not a logical
  assumption. Retain a separate original model for other checks.
- Both models exclude the independently validated completed grid. Only an exact
  UNSAT result proves uniqueness; every found alternative is independently checked.
  Resource errors still invoke unlimited exact fallback. Logic-only digging keeps
  its additional requirement of a complete solve without brute force.

The extra model uses another 64 MiB MiniSat heap when needed; this trades memory
for search performance. Both models are local to one generation attempt. Product
does not use this enrichment. No dependency or SAT-engine replacement was retained.
The shared digger serves Generate, Simulation and Simulation difficulty.

Regression tests cover root-candidate copying, pre-branch reporting, restoring clue
masks after ambiguity, invalid propagated domains, the sparse seed-48 fixture,
independent uniqueness checks and resource-error fallback.

## Reproduce

```powershell
$env:BENCH_BASELINE='38ff314'
$env:BENCH_MODES='sum'
$env:BENCH_SEEDS='42,48,49,45,44'
$env:BENCH_TIMEOUT_MS='300000'
$env:BENCH_OUTPUT='scripts/repeated-sum-tail-results.json'
node scripts/benchmark-digging-sat.mjs
```

`BENCH_PROFILE=1` additionally records individual checker calls exceeding 100 ms.
The parent worker heartbeat flags gaps exceeding 2.5 seconds as invalid timing;
such runs must be discarded and repeated. This detects pauses, not all CPU load
variation. Completed timings cover full-grid generation and digging, excluding
worker/module initialization, rendering and difficulty/walkthrough calculation.
