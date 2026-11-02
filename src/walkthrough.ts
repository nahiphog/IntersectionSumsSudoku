import { saveTally } from './tally';
import { rateWalkthrough, stepScore } from './difficulty';
import type { ClueMode } from './puzzle';
import type { ExplainedStep, Walkthrough } from './walkthroughSolver';

const position = (cell: number) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;

export function mountWalkthrough(host: HTMLElement) {
  host.innerHTML = `
    <div class="walk-heading"><div><p class="step">04 / SOLVING</p><h2>Solution walkthrough</h2></div><button class="walk-button" data-action="solve" disabled>Solve step by step</button></div>
    <p class="walk-status" role="status">Generate a dug puzzle to begin.</p>
    <div class="walk-options"><label><input type="checkbox" data-option="search" checked> Allow backtracking if logic stalls</label><button class="walk-button" data-action="cancel" hidden>Cancel solving</button></div>
    <p class="walk-note">Uses sudokUI techniques and the remaining sum/product clues. Classic uniqueness techniques are excluded. Search-assisted steps are labeled explicitly.</p>
    <div class="walk-content" hidden>
      <p class="walk-rating" data-display="rating" role="status"></p>
      <p class="walk-note">Variant rating: sudokUI technique scores, plus 10 per intersection sum/product or combined sum equation step. Search steps are unscored; incomplete logical solves show a subtotal only.</p>
      <div class="walk-layout"><article class="board-panel"><div class="panel-heading"><h3 data-display="counter"></h3><label>View <select data-option="view"><option value="after">After step</option><option value="before">Before step</option></select></label></div><div class="grid walk-grid" role="table" aria-label="Solver candidates and placements"></div><p class="walk-legend"><span>Blue: pattern / clue</span><span>Green: placement</span><span>Red ×: removed candidate</span></p></article>
      <div class="walk-detail"><span class="pill" data-display="kind"></span><h3 data-display="technique"></h3><p data-display="description"></p><details class="walk-effects"><summary>Candidate changes</summary><p data-display="effects"></p></details><details class="walk-combinations" hidden><summary>Valid neighbouring combinations</summary><p data-display="combination-order"></p><ul data-display="combinations"></ul></details></div></div>
      <div class="walk-controls"><button class="walk-button" data-action="first">First</button><button class="walk-button" data-action="previous">Previous</button><label class="walk-slider">Step <input type="range" min="0" value="0" max="0" aria-label="Walkthrough step"></label><button class="walk-button" data-action="next">Next</button><button class="walk-button" data-action="last">Last</button></div>
      <label class="walk-jump">Jump to step <select aria-label="Jump to solver step"></select></label>
      <details class="walk-summary"><summary>Techniques used</summary><table><thead><tr><th scope="col">Technique</th><th scope="col">Steps</th><th scope="col">Points / use</th><th scope="col">Total</th></tr></thead><tbody></tbody></table></details>
    </div>`;
  const get = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const display = (name: string, value: string) => { get(`[data-display="${name}"]`).textContent = value; };
  const status = get('.walk-status');
  const content = get('.walk-content');
  const solveButton = get<HTMLButtonElement>('[data-action="solve"]');
  const cancelButton = get<HTMLButtonElement>('[data-action="cancel"]');
  const searchInput = get<HTMLInputElement>('[data-option="search"]');
  const range = get<HTMLInputElement>('input[type="range"]');
  const jump = get<HTMLSelectElement>('.walk-jump select');
  const view = get<HTMLSelectElement>('[data-option="view"]');
  let clues: (number | null)[] | undefined;
  let mode: ClueMode = 'sum';
  let worker: Worker | undefined;
  let walk: Walkthrough | undefined;
  let index = 0;

  function stop() {
    worker?.terminate(); worker = undefined;
    solveButton.disabled = !clues;
    cancelButton.hidden = true;
    searchInput.disabled = false;
  }
  function render() {
    if (!walk || !clues) return;
    const step: ExplainedStep | undefined = walk.steps[index - 1];
    const before = view.value === 'before';
    const state = step ? (before ? step.before : step.after) : walk.initial;
    display('counter', `Step ${index} of ${walk.steps.length}`);
    display('kind', step ? { sudoku: 'sudokUI technique', constraint: 'Variant constraint', search: 'Search-assisted' }[step.kind] : 'Starting position');
    display('technique', step ? step.technique + (stepScore(step) === null ? ' (unscored)' : ' (+' + stepScore(step) + ')') : 'Initial candidates');
    display('description', step?.description ?? 'All cells start empty with candidates 1–9. Corner numbers are clues about neighbouring cells, not placed Sudoku digits. Move to the next step to see the first deduction.');
    const list = (items: { cell: number; digit: number }[]) => items.map(item => `${position(item.cell)} ≠ ${item.digit}`).join('; ');
    display('effects', step ? [
      step.placements.length ? `Place: ${step.placements.map(p => `${position(p.cell)} = ${p.digit}`).join('; ')}.` : '',
      step.eliminations.length ? `Remove: ${list(step.eliminations)}.` : '',
      step.peerEliminations.length ? `The placement also removes ${step.peerEliminations.length} candidate(s) from its Sudoku peers: ${list(step.peerEliminations)}.` : '',
    ].filter(Boolean).join(' ') : '');
    const grid = get('.walk-grid'); grid.replaceChildren();
    for (let row = 0; row < 9; row++) {
      const line = document.createElement('div'); line.className = 'grid-row'; line.setAttribute('role', 'row');
      for (let col = 0; col < 9; col++) {
        const cell = row * 9 + col;
        const box = document.createElement('div'); box.className = 'cell'; box.setAttribute('role', 'cell');
        const removals = [...(step?.eliminations ?? []), ...(step?.peerEliminations ?? [])].filter(e => e.cell === cell).map(e => e.digit);
        if (step?.related.includes(cell)) box.classList.add('walk-related');
        if (step?.clueCell === cell) box.classList.add('walk-clue-source');
        if (step?.placements.some(p => p.cell === cell)) box.classList.add('walk-placement');
        if (clues[cell] !== null) { const label = document.createElement('span'); label.className = 'clue'; label.textContent = String(clues[cell]); box.append(label); }
        const candidates: number[] = [];
        if (state.values[cell]) {
          const value = document.createElement('span'); value.className = 'walk-value'; value.textContent = String(state.values[cell]); box.append(value);
        } else {
          const notes = document.createElement('div'); notes.className = 'walk-candidates';
          for (let digit = 1; digit <= 9; digit++) {
            const note = document.createElement('span');
            const available = !!(state.candidates[cell] & (1 << (digit - 1)));
            if (available) candidates.push(digit);
            const removed = removals.includes(digit);
            note.textContent = available || removed ? String(digit) : '';
            if (removed) { note.className = 'walk-removed'; note.title = `${digit} is eliminated in this step`; }
            notes.append(note);
          }
          box.append(notes);
        }
        box.setAttribute('aria-label', `${position(cell)}${clues[cell] !== null ? `, ${mode} clue ${clues[cell]}` : ''}: ${state.values[cell] ? `digit ${state.values[cell]}` : `candidates ${candidates.join(', ')}`}${removals.length ? `; this step removes ${removals.join(', ')}` : ''}`);
        line.append(box);
      }
      grid.append(line);
    }
    const combinations = get('.walk-combinations'); combinations.hidden = !step?.combinations;
    get('[data-display="combinations"]').replaceChildren();
    if (step?.combinations) {
      display('combination-order', `In order: ${step.neighbourOrder!.map(position).join(', ')}. Showing ${step.combinations.length} of ${step.combinationCount} valid combinations.`);
      for (const tuple of step.combinations) {
        const item = document.createElement('li'); item.textContent = `${tuple.join(mode === 'sum' ? ' + ' : ' × ')} = ${clues[step.clueCell!]}`;
        get('[data-display="combinations"]').append(item);
      }
    }
    range.value = String(index); jump.value = String(index);
    for (const action of ['first', 'previous']) get<HTMLButtonElement>(`[data-action="${action}"]`).disabled = index === 0;
    for (const action of ['next', 'last']) get<HTMLButtonElement>(`[data-action="${action}"]`).disabled = index === walk.steps.length;
  }
  function start() {
    if (!clues) return;
    stop(); walk = undefined; index = 0; content.hidden = true;
    solveButton.disabled = true; searchInput.disabled = true; cancelButton.hidden = false;
    status.textContent = 'Building an explained solve path from the dug clues…';
    const started = performance.now();
    const current = new Worker(new URL('./walkthrough.worker.ts', import.meta.url), { type: 'module' });
    worker = current;
    const fail = (message: string) => { if (worker !== current) return; stop(); status.textContent = `Unable to build the walkthrough: ${message}`; };
    current.onerror = event => fail(event.message);
    current.onmessage = (event: MessageEvent<{ type: string; steps: number; message: string; result: Walkthrough }>) => {
      if (worker !== current) return;
      if (event.data.type === 'error') { fail(event.data.message); return; }
      if (event.data.type === 'progress') { status.textContent = `${event.data.steps} steps recorded. ${event.data.message}`; return; }
      walk = event.data.result; saveTally(walk, mode); stop(); content.hidden = false;
      solveButton.textContent = 'Rebuild walkthrough';
      status.textContent = `${walk.status === 'solved' ? 'Solved' : 'Logic stalled — partial walkthrough'} · ${walk.steps.length} steps · ${walk.searchSteps} search-assisted · ${((performance.now() - started) / 1000).toFixed(2)} s`;
      const rating = rateWalkthrough(walk);
      display('rating', rating.complete ? 'Difficulty: ' + rating.level + ' · ' + rating.score + ' points' : 'Difficulty: ' + (walk.searchSteps ? 'search-assisted' : 'not yet rated') + ' · logical subtotal: ' + rating.score + ' points');
      range.max = String(walk.steps.length); jump.replaceChildren();
      ['Initial candidates', ...walk.steps.map(s => s.technique)].forEach((name, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = `${i}. ${name}`; jump.append(option); });
      const tally = new Map<string, number[]>();
      walk.steps.forEach((step, i) => { const indices = tally.get(step.technique) ?? []; indices.push(i + 1); tally.set(step.technique, indices); });
      const body = get('.walk-summary tbody'); body.replaceChildren();
      for (const [name, indices] of tally) {
        const row = document.createElement('tr'); const label = document.createElement('th'); label.scope = 'row'; label.textContent = name;
        const count = document.createElement('td'); const button = document.createElement('button'); button.className = 'walk-count'; button.textContent = `${indices.length} — go to first`;
        button.addEventListener('click', () => { index = indices[0]; render(); }); count.append(button); const points = stepScore(walk.steps[indices[0] - 1]);
        const perUse = document.createElement('td'); perUse.textContent = points === null ? 'Unscored' : '+' + points;
        const total = document.createElement('td'); total.textContent = points === null ? '—' : String(points * indices.length);
        row.append(label, count, perUse, total); body.append(row);
      }
      render();
    };
    current.postMessage({ clues: [...clues], mode, allowSearch: searchInput.checked });
  }
  solveButton.addEventListener('click', start);
  searchInput.addEventListener('change', () => { if (clues) start(); });
  cancelButton.addEventListener('click', () => { stop(); status.textContent = 'Solving cancelled. Rebuild the walkthrough to try again.'; });
  const moves: Record<string, () => number> = { first: () => 0, previous: () => index - 1, next: () => index + 1, last: () => walk!.steps.length };
  for (const [action, move] of Object.entries(moves)) {
    get(`[data-action="${action}"]`).addEventListener('click', () => { if (walk) { index = Math.max(0, Math.min(walk.steps.length, move())); render(); } });
  }
  range.addEventListener('input', () => { index = Number(range.value); render(); });
  jump.addEventListener('change', () => { index = Number(jump.value); render(); });
  view.addEventListener('change', render);
  return {
    reset() { clues = undefined; stop(); walk = undefined; index = 0; content.hidden = true; status.textContent = 'Generate a dug puzzle to begin.'; },
    load(nextClues: (number | null)[], nextMode: ClueMode, allowSearch = true) { clues = [...nextClues]; mode = nextMode; searchInput.checked = allowSearch; start(); },
  };
}
