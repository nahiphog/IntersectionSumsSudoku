import { parseClues } from './lab';
import { serializeClues, type ClueMode } from './puzzle';

export function verifyLink(baseUrl: string, clues: (number | null)[], mode: ClueMode): string {
  const url = new URL('verify/', baseUrl);
  url.search = new URLSearchParams({ mode, puzzle: serializeClues(clues) }).toString();
  return url.href;
}

export function readVerifyLink(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has('puzzle')) return null;
  const mode = params.get('mode');
  if (mode !== 'sum' && mode !== 'product' && mode !== 'pencilmark') throw new Error('The puzzle link has an invalid clue mode.');
  const clues = parseClues(params.get('puzzle')!, mode);
  return { mode, clues, puzzle: serializeClues(clues) };
}
