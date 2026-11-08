# Exact uniqueness benchmark

Run `node scripts/benchmark-uniqueness.mjs`. The baseline defaults to commit `2aed0aa`; set `BENCH_VERSIONS=after` to run only the new implementation. The script runs each version sequentially in an isolated worker. Its diagnostic time limits are not puzzle verdicts.

For the user's 15-clue Sum fixture, the previous verifier exceeded the 60-second diagnostic limit without finding a completion. The finalized SAT verifier found its first solution in 29.38 seconds and proved it was the only solution in 33.17 seconds in an isolated local run. Timing depends on hardware and load. The solution was:

`432169875687523194591847362254631987378492651169758243713984526946215738825376419`

The verifier does not receive that answer. It constructs its model from the 15 clues only.

## Why the verdict is exact

- Exactly one digit is required per cell, and each digit occurs exactly once in every row, column, and box.
- Each corner clue requires at least one allowed neighbouring tuple. Tuple selectors imply all corresponding cell assignments. Additional support clauses preserve the same set of solutions while helping propagation.
- Every returned grid is checked independently against all Sudoku units and the original sum/product arithmetic.
- After finding a grid, the checker forbids its 81 cell assignments together. It does not block merely an auxiliary-variable assignment. A second SAT model must therefore be a different grid. UNSAT after this blocking clause establishes uniqueness.
- The first completion is streamed to the walkthrough while the second search continues. Cancellation returns no uniqueness verdict. Engine failures fall back to the pre-existing exact search, never to an assumption of uniqueness.

## Scope and packaging

Verify uses this route for Sum puzzles with at most 24 clues. Product verification, dense Sum verification, digging, and logical-technique policy retain their existing algorithms.

The pinned MIT-licensed `logic-solver` package embeds MiniSat. Its generated asm.js is loaded verbatim from the installed package, because bundler rewriting substantially slowed it in testing. The loader evaluates only those fixed package sources, never clue text. Dependencies are explicit and locked; licenses are distributed in `public/SAT-LICENSES.txt`. The existing YAML deployment installs the lockfile with `npm ci`.

Rejected experiments included cheaper propagation, alternate cell/unit branching, dense redundant SAT arithmetic, and pairwise Sudoku encodings. Some were slower or hit the engine's memory limit. They are not part of the production algorithm.
