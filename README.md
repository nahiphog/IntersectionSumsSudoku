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

Generate now also creates a **dug puzzle** in a background worker. A dedicated variant solver checks the full clue set for exactly one solution, regenerates if necessary, and tests all 81 clues in shuffled order. It keeps a removal only when the puzzle remains uniquely solvable and the walkthrough solver completes it using imported sudokUI techniques and sum/product constraints with backtracking disabled. The full clue set must also pass both checks. The final clue count and elapsed time include initial generation, uniqueness checks, retries, and digging. Cancel terminates the worker without presenting a partial result as a finished puzzle. Switching modes re-digs the current completed grid, regenerating if its full clue set fails either check in the new mode.

The backtracking solver enforces Sudoku units and exact sum/product tuple constraints. It propagates candidates, singles, pairs and locked candidates; sum mode additionally uses exact integer combinations of clue equations and 45 unit totals. A validated solution witness helps order branches and detect actual alternate Sudoku digit trades. Uniqueness still requires a complete search, stopping as soon as two solutions are found. There is no time limit that silently assumes uniqueness. Sparse sum puzzles can take considerably longer than product puzzles.

The finished puzzle is locally minimal under these two checks, not guaranteed to have the global minimum number of clues. Retained clues are retested until a full pass removes nothing, since the deterministic logical strategy may behave differently after further removals. Automated tests exercise both modes and verify uniqueness, a complete logical solution, and that each retained clue is necessary for at least one check. Logical checks add to generation time.

## Solution walkthrough

After digging completes, a second worker automatically builds a walkthrough using only the dug clues, never the generator's saved solution. It interleaves imported sudokUI singles and other enabled non-uniqueness techniques with exact local sum/product deductions. Clue deductions enumerate ordered neighbour assignments consistent with current candidates and shared Sudoku units, then eliminate candidates that appear in none of them. Sum mode also shares exact algebraic deductions from the remaining clue equations and Sudoku unit totals of 45. These steps display the resulting equation and candidate bounds; they do not use trial assignments or backtracking.

Use First / Previous / Next / Last, the step slider, or the step selector to inspect each move. Before/After views show candidates, the clue or pattern cells, placements, and removed candidates. Each step has an explanation and explicit changes; clue steps include example valid combinations. The technique table counts steps and links to the first use of each technique. The interface follows the navigation/candidate/explanation pattern in [SquishdokuMaker](https://github.com/nahiphog/SquishdokuMaker/blob/main/index.html), implemented here for 9×9 intersection constraints.

Newly dug puzzles pass the same solver with search disabled. For other puzzles, if logic stalls, the default backtracking option searches the current candidate state against all remaining clues. Each resulting placement is explicitly labeled **Backtracking (search)**. Uncheck that option to see where the logical path stops. Cancel solving, generating again, or changing modes discards obsolete work. Classic Sudoku uniqueness deductions are excluded because variant uniqueness does not justify those assumptions. No classic difficulty score is presented as a rating for this variant.

Run the site with `npm run dev`; opening `index.html` directly with `file://` cannot run the TypeScript modules and workers. Difficulty grading and editable solving remain future work. Upstream catalog entries marked unimplemented remain unimplemented; all existing implementations are included.

## GitHub Pages deployment

The `.github/workflows/pages.yml` workflow installs dependencies with `npm ci` from `package-lock.json`, runs the tests, checks TypeScript, and builds the static site on Node.js 24. Pushes to `main` deploy `dist/` through GitHub Pages; pull requests run build checks without deploying. Repository Settings → Pages must use **GitHub Actions** as the source.

`npm run build -- --mode github-pages` sets the correct `/IntersectionSumsSudoku/` asset and worker paths. Regular development builds keep `/` as their base. Application code, workers, and Vite configuration remain TypeScript; only the generated deployment assets are JavaScript. npm dependencies live in `package.json` and its lockfile, while `.github/dependabot.yml` checks npm and GitHub Actions dependencies monthly.

The workflow follows the [Vite GitHub Pages deployment guide](https://vite.dev/guide/static-deploy#github-pages).

## License and provenance

GPL-3.0; see `LICENSE` and `THIRD_PARTY_NOTICES.md`. Upstream engine code is preserved unchanged at commit `101f0eadf5f4f0b6a9db54724c169e646ef87f4d`.


