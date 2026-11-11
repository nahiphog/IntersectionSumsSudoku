import { expect, it } from 'vitest';
import { generatePuzzle, serializeClues, type ClueMode } from '../src/puzzle';
import { readVerifyLink, verifyLink } from '../src/verifyLink';

for (const mode of ['sum', 'product', 'pencilmark'] as ClueMode[]) {
  it(`round-trips a ${mode} sample under the GitHub Pages base path`, () => {
    const puzzle = generatePuzzle(undefined, mode);
    const clues = puzzle.clues.map((clue, cell) => cell % 3 === 0 ? null : clue);
    const url = new URL(verifyLink('https://example.com/IntersectionSumsSudoku/', clues, mode));
    expect(url.pathname).toBe('/IntersectionSumsSudoku/verify/');
    expect(readVerifyLink(url.search)).toEqual({ mode, clues, puzzle: serializeClues(clues) });
  });
}

it('supports local hosting and leaves a normal Verify visit empty', () => {
  expect(new URL(verifyLink('http://localhost:5173/', Array(81).fill(null), 'sum')).pathname).toBe('/verify/');
  expect(readVerifyLink('')).toBeNull();
});

it('rejects invalid modes and malformed clues in incoming links', () => {
  expect(() => readVerifyLink('?mode=unknown&puzzle=0')).toThrow(/clue mode/);
  expect(() => readVerifyLink('?mode=sum&puzzle=1,2')).toThrow(/81/);
  expect(() => readVerifyLink('?puzzle=0')).toThrow(/clue mode/);
});
