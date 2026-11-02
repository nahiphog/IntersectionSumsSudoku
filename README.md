# Intersection Sums/Products Sudoku

A TypeScript / Vite website for generating Intersection Sums/Products Sudoku.

Live site: [Intersection Sums/Products Sudoku](https://nahiphog.github.io/IntersectionSumsSudoku/).

Normal sudoku rules apply. A clue written in the upper-left corner of a cell gives the sum (Sum mode) or product (Product mode) of the digits in the cells orthogonally adjacent to that cell.

## Run

```sh
npm install
npm run dev
```

`npm run build` checks all TypeScript (including the imported engine) and builds `dist/`. `npm test` verifies Sudoku validity, sum calculations, empty puzzle values, variation, and classic solver integration.

## Current scope

Click **Generate** to create a random completed grid using randomized backtracking and its matching empty puzzle with all 81 clues. Toggle **Sum** or **Product** to recalculate clues on the same solution; Generate respects the selected operation. Corners use two neighbours, edges three, and interior cells four. The clue cell itself never contributes. Select any sum to inspect its contributors; arrow keys navigate the clue grid.

The full classic Sudoku engine and all 27 technique modules from [AImenes/sudokUI](https://github.com/AImenes/sudokUI) are vendored unchanged under `src/vendor/sudokui/engine`. `src/solver.ts` exposes its board model, technique catalog, human solver and brute-force utilities. The website already uses the imported completed-grid generator.

Generate now also creates a **dug puzzle** in a background worker. A dedicated variant solver checks the full clue set for exactly one solution, regenerates if necessary, and tests all 81 clues in shuffled order. **Allow brute force** is checked by default: every removal must preserve a unique solution, but the puzzle may require search. Turn it off to additionally require a complete logical solve with the imported techniques and sum/product constraints. The full clue set must pass the selected checks too. Changing this setting re-digs the current solution. The final clue count and elapsed time include initial generation, uniqueness checks, retries, and digging. Cancel terminates the worker without presenting a partial result as a finished puzzle. Switching modes re-digs the current completed grid, regenerating if its full clue set fails either check in the new mode.

The backtracking solver enforces Sudoku units and exact sum/product tuple constraints. It propagates candidates, singles, pairs and locked candidates; sum mode additionally uses exact integer combinations of clue equations and 45 unit totals. A validated solution witness helps order branches and detect actual alternate Sudoku digit trades. Uniqueness still requires a complete search, stopping as soon as two solutions are found. There is no time limit that silently assumes uniqueness. Sparse sum puzzles can take considerably longer than product puzzles.

When backtracking is disallowed, digging uses a conservative fast technique profile: imported singles, intersections, subsets, basic fish, short patterns, and wings through XYZ-Wing, together with local sum/product constraints and exact sum equations. If these techniques stall, the clue is retained; expensive advanced chains and forcing techniques are not attempted during digging. This can leave more clues but never accepts an unfinished logical solve. Every accepted removal still passes the independent exact uniqueness check. The full technique set remains available to the walkthrough solver.

Choose **Single** to test one clue at a time, or **Dual** to test rotationally opposite clues together: RrCc and R(10−r)C(10−c). Dual mode makes the clue positions rotationally symmetric; the centre cell R5C5 is tested once. Both clues are restored if uniqueness fails, or if logical completion fails when backtracking is disallowed. Changing the digging option starts a fresh dig on the current solution.

**Copy completed grid** copies the 81 solution digits without separators. **Copy sums/products grid** copies all 81 transformed clue values separated by commas. After generation, **Copy dug puzzle** copies exactly 81 comma-separated clue values in row-major order (left to right, top to bottom), with `0` for an empty cell. If clipboard access is denied, a selected text field provides the same export for manual copying.

The finished puzzle is locally minimal under the selected single-cell or paired removal strategy, this fast profile, and the uniqueness check, not guaranteed to have the global minimum number of clues. With logic-only generation, retained clues or pairs are retested until a full pass removes nothing, since the deterministic logical strategy may behave differently after further removals. With backtracking allowed, a single pass suffices because uniqueness is monotone under clue removal. Automated tests exercise both modes and verify uniqueness, a complete logical solution, and that each retained clue is necessary for at least one check. Generation checks omit walkthrough history and peer-elimination snapshots; the final walkthrough is built once after digging.

## Solution walkthrough

After digging completes, a second worker automatically builds a walkthrough using only the dug clues, never the generator's saved solution. It interleaves imported sudokUI singles and other enabled non-uniqueness techniques with exact local sum/product deductions. Clue deductions enumerate ordered neighbour assignments consistent with current candidates and shared Sudoku units, then eliminate candidates that appear in none of them. They also lock any digit guaranteed in a shared row, column, or box into the contributing neighbours, removing that digit from the unit’s other cells. Explanations state the required digit set when all combinations are permutations of the same digits. Sum mode also shares exact algebraic deductions from the remaining clue equations and Sudoku unit totals of 45. These steps display the resulting equation and candidate bounds; they do not use trial assignments or backtracking.

Use First / Previous / Next / Last, the step slider, or the step selector to inspect each move. Before/After views show candidates, the clue or pattern cells, placements, and removed candidates. Clue explanations use short factorizations, hidden-pair descriptions, and forced cell values. Detailed candidate changes are collapsed by default. Each step has an explanation and explicit changes; clue steps include example valid combinations. The technique table counts steps and links to the first use of each technique. The interface follows the navigation/candidate/explanation pattern in [SquishdokuMaker](https://github.com/nahiphog/SquishdokuMaker/blob/main/index.html), implemented here for 9×9 intersection constraints.

Logic-only generated puzzles pass the same solver with search disabled. For puzzles generated with backtracking allowed, if logic stalls, the backtracking option searches the current candidate state against all remaining clues. Each resulting placement is explicitly labeled **Brute force (+10000)**. Uncheck that option to see where the logical path stops. Cancel solving, generating again, or changing modes discards obsolete work. Classic Sudoku uniqueness deductions are excluded because variant uniqueness does not justify those assumptions. The variant difficulty rating uses sudokUI technique scores and level thresholds, adding 10 points per intersection sum/product or combined sum equation step. The technique table shows points per use and totals. Every Brute force placement adds 10000 points; solved walkthroughs include these points in their difficulty rating. Stalled walkthroughs display a subtotal.

Run the site with `npm run dev`; opening `index.html` directly with `file://` cannot run the TypeScript modules and workers. Difficulty grading and editable solving remain future work. Upstream catalog entries marked unimplemented remain unimplemented; all existing implementations are included.

## GitHub Pages deployment

The `.github/workflows/pages.yml` workflow installs dependencies with `npm ci` from `package-lock.json`, runs the full Sudoku, digging, and walkthrough test suite, checks TypeScript, and builds the static site on Node.js 24. Pushes to `main` deploy `dist/` through GitHub Pages; pull requests run build checks without deploying. Repository Settings → Pages must use **GitHub Actions** as the source. The `.github/workflows/solver-regression.yml` workflow also allows digging tests to be rerun manually.

`npm run build -- --mode github-pages` sets the correct `/IntersectionSumsSudoku/` asset and worker paths. Regular development builds keep `/` as their base. Application code, workers, and Vite configuration remain TypeScript; only the generated deployment assets are JavaScript. npm dependencies live in `package.json` and its lockfile, while `.github/dependabot.yml` checks npm and GitHub Actions dependencies monthly.

The workflow follows the [Vite GitHub Pages deployment guide](https://vite.dev/guide/static-deploy#github-pages).

The dug grid uses twice the source-grid width on desktop. The walkthrough uses the original smaller grid, with explanations to its right. On narrow screens the explanation stacks below the grid.

## License and provenance

GPL-3.0; see `LICENSE` and `THIRD_PARTY_NOTICES.md`. Upstream engine code is preserved unchanged at commit `101f0eadf5f4f0b6a9db54724c169e646ef87f4d`.



## Puzzle laboratory pages

- **Techniques tally** (`techniques/`): the active catalogue, scores, and counts from the latest walkthrough saved in this browser. Storage is optional; no puzzle data is uploaded.
- **Custom Build** (`custom-build/`): select exact clue positions, operation, rating range, and an attempt limit. Random completed grids supply clue values. A result must pass exact uniqueness and a full logical solve without backtracking before its rating is accepted. Stop terminates the worker. A failed search does not prove that the pattern is impossible.
- **Simulation** (`simulation/`): batch single/dual digging with the same uniqueness and optional logic-only policy as Generate. All completed trials populate the clue-count histogram and mean/time statistics; only the latest 11 samples within the selected clue cap are retained. Stop preserves completed trials.
- **Verify** (`verify/`): enter 81 comma-separated clues (zero for blanks), or use the editable grid. Exact search distinguishes no solution, exactly one, and at least two, showing two different completions for ambiguous puzzles. Unique puzzles have an explained walkthrough. Strings and PNG images can be exported.

All four routes are Vite multi-page entries, including direct navigation on GitHub Pages. Adapted from the corresponding [SquishdokuMaker pages](https://github.com/nahiphog/SquishdokuMaker); the implementation uses this project’s 9×9 intersection solver.

## Temporary technique policy

`src/techniquePolicy.ts` disables the sudokUI families Uniqueness, Colouring (Coloring), Chains & loops (Chains and Loops), ALS (Almost Locked Sets), Finned Fish, Complex Fish, and Miscellaneous, plus Turbot Fish, Digit Forcing Chain, Nishio Forcing Chain, and Pattern Overlay. All solving flows and the Techniques tally catalogue use the same policy; imported engine files remain unchanged. Other categories, including Last Resort, retain their existing settings. Exact uniqueness checks remain enabled. The saved tally version changes so counts from the previous policy are not shown as current results.

The walkthrough displays its technique tally beside the grid, above the current step explanation. Rows are sorted by ascending per-use difficulty rating and show only technique names and usage counts. Counts cover the full walkthrough and link to the first use of each technique; narrow screens stack the sidebar below the grid.
