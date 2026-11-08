# Compact Sum SAT: correctness and performance

Measured on 8 November 2026, Node v24.19.0, Intel Core i7-8665U @ 1.90 GHz.
Baseline is e54a028 (the previously published adaptive tuple-based SAT digger).
The new implementation is the source committed with this report.

## Results

All ten new Sum trials completed. Their actual average digging duration was
**32.896 seconds**. The baseline completed only two trials within its 60-second
cutoff; counting the eight timeouts as 60 seconds gives **53.664 seconds**.
Thus the new actual mean is **38.7% lower than even the capped baseline mean**.
This is a conservative comparison, not a claim that the baseline's uncapped mean
is known. The cutoff includes worker startup; completed timings exclude startup.

| Seed | Baseline seconds | New seconds | New givens |
| --- | ---: | ---: | ---: |
| 40 | >60 | 9.873 | 18 |
| 41 | >60 | 15.058 | 17 |
| 42 | >60 | 12.644 | 17 |
| 43 | 48.186 | 13.377 | 17 |
| 44 | 8.452 | 5.046 | 18 |
| 45 | >60 | 54.863 | 18 |
| 46 | >60 | 31.162 | 17 |
| 47 | >60 | 16.327 | 18 |
| 48 | >60 | 108.689 | 19 |
| 49 | >60 | 61.918 | 19 |

The two fully completed baseline pairs also improved: their mean fell from
28.319 to 9.212 seconds (67.5%). They produced identical clue grids. We cannot
compare final grids for the baseline trials that timed out.

Memory-limit messages occurred in **8/10 baseline Sum trials, 0/10 new trials**.
Both versions use the same fixed 64 MiB MiniSat heap. This fixes the observed
failures in this sample; arbitrary inputs can still exceed finite resources, so
the exact fallback remains necessary.

## Measurement limits and reproduction

- Same seeds 40–49 and random generator; single-cell digging; brute force allowed.
- Baseline timings were collected in paired alternating-order runs during this
  session. After additional encoding experiments, the final new code was rerun
  separately on every seed with a 300-second limit, starting with seed 48. No
  new trial reached that limit. Each ran in a fresh worker, sequentially, with no
  concurrent builds or tests. System load and JIT effects still affect timings.
- This is one observation per seed/version, not a statistical confidence estimate
  or a guarantee for every puzzle. Some individual development trials slowed down.
- Timings include full-grid construction and digging, exclude UI rendering and
  walkthrough/difficulty rating. The same digger serves all three generation pages.
- Product's encoding and search budget are unchanged. The final benchmark focuses
  on Sum; regression tests cover Product, single/dual digging and logical eligibility.
- Raw baseline data: `compact-sat-baseline-results.json` (includes Product controls).
  Raw final Sum data: `final-compact-sat-benchmark-results.json`. The `updated` field
  is the parent HEAD; `workingTree: true` identifies the then-uncommitted implementation.

```powershell
$env:BENCH_BASELINE='e54a028'
$env:BENCH_MODES='sum'
$env:BENCH_TIMEOUT_MS='300000'
$env:BENCH_OUTPUT='scripts/repeated-compact-sat-results.json'
node scripts/benchmark-digging-sat.mjs
```

## Why uniqueness is preserved

The Sudoku model assigns exactly one digit to every cell and exactly one instance
of each digit to every row, column and box. For a two-cell partial sum, every digit
pair implies its mathematical total and exactly one total is allowed. Conversely,
the extra total/digit clauses are arithmetic consequences of that equality.
The active clue permits precisely the two partial totals that add to its value.
Every valid digit assignment has an extension to these auxiliary variables, and
every satisfying model obeys the original clue. Disabling a clue removes that
equality; its unguarded partial totals remain definable for every digit pair.

Digging independently validates the known completed grid and excludes exactly
that grid from SAT. An exhaustive UNSAT result then proves that no alternative
exists. A SAT result is decoded and independently checked before returning two
solutions. Failed removals restore assumptions; learned clauses remain valid.
Search-budget exhaustion and SAT exceptions never count as uniqueness proofs.

Regression tests cross-check the SAT and original finite-domain solvers, exercise
clue removal/restoration, validate the 15-clue Sum fixture, inject SAT failures to
check fallback, and independently verify the generated seed-44 Sum puzzle.
