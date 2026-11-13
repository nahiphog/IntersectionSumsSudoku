import { POLICY_NOTE } from './techniquePolicy';
import { saveTally } from './tally';
import { rateWalkthrough, stepScore } from './difficulty';
import type { ClueMode } from './puzzle';
import type { ExplainedStep, Walkthrough, Snapshot } from './walkthroughSolver';

const position = (cell: number) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;

export function mountWalkthrough(host: HTMLElement, onRating?: (rating: ReturnType<typeof rateWalkthrough>) => void, options: { showPolicyNote?: boolean } = {}) {
  host.innerHTML = `
    <div class="walk-heading"><div><p class="step">04 / SOLVING</p><h2>Solution walkthrough</h2></div><button class="walk-button" data-action="solve" disabled>Solve step by step</button></div>
    <p class="walk-status" role="status">Generate a dug puzzle to begin.</p>
    <div class="walk-options"><label><input type="checkbox" data-option="search" checked> Allow brute force if logic stalls</label><button class="walk-button" data-action="cancel" hidden>Cancel solving</button></div>
    ${options.showPolicyNote === false ? '' : `<p class="walk-note">Uses sudokUI techniques and the remaining sum/product/pencilmark clues. ${POLICY_NOTE} Brute-force steps are labeled explicitly.</p>`}
    <div class="walk-content" hidden>
      <p class="walk-rating" data-display="rating" role="status"></p>
      <p class="walk-note">Variant rating: sudokUI technique scores, plus 10 per intersection sum/product/pencilmark or combined sum equation step. Locked candidates (Intersection sums/products/pencilmarks) adds 50 per use. Brute force adds 10000 per use. Unfinished walkthroughs show a subtotal only.</p>
      <div class="walk-layout"><article class="board-panel"><div class="panel-heading"><h3 data-display="counter"></h3><label>View <select data-option="view"><option value="after">After step</option><option value="before">Before step</option></select></label></div><div class="grid walk-grid" role="table" aria-label="Solver candidates and placements"></div><div class="walk-controls"><button class="walk-button" data-action="first">First</button><button class="walk-button" data-action="previous">Previous</button><label class="walk-slider">Step <input type="range" min="0" value="0" max="0" aria-label="Walkthrough step"></label><button class="walk-button" data-action="next">Next</button><button class="walk-button" data-action="last">Last</button></div><label class="walk-jump">Jump to step <select aria-label="Jump to solver step"></select></label><p class="walk-legend"><span>Blue: pattern</span><span>Purple: clue</span><span>Green: placement</span><span>Red ×: removed candidate</span></p></article>
      <div class="walk-sidebar"><section class="walk-summary" aria-label="Techniques tally"><h3>Techniques tally</h3><table><thead><tr><th scope="col">Technique</th><th scope="col">Steps</th></tr></thead><tbody></tbody></table><p class="walk-note">Select a step number to open that step in the walkthrough.</p></section><div class="walk-detail"><span class="pill" data-display="kind"></span><h3 data-display="technique"></h3><p data-display="description"></p><details class="walk-effects"><summary>Candidate changes</summary><p data-display="effects"></p></details><details class="walk-combinations" hidden><summary>Valid neighbouring combinations</summary><p data-display="combination-order"></p><ul data-display="combinations"></ul></details></div></div></div>


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
  let completion: number[] | undefined;

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
    display('kind', step ? { sudoku: 'sudokUI technique', constraint: 'Variant constraint', search: 'Brute force' }[step.kind] : 'Starting position');
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
        const item = document.createElement('li'); item.textContent = mode === 'pencilmark' ? `${tuple.join(', ')} — digits for clue ${clues[step.clueCell!]}` : `${tuple.join(mode === 'sum' ? ' + ' : ' × ')} = ${clues[step.clueCell!]}`;
        get('[data-display="combinations"]').append(item);
      }
    }
    range.value = String(index); jump.value = String(index);
    for (const button of host.querySelectorAll<HTMLButtonElement>('.walk-count')) {
      if (Number(button.dataset.step) === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
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
    current.onmessage = (event: MessageEvent<{ type: string; steps: number; message: string; result: Walkthrough; batch: ExplainedStep[]; initial: Snapshot }>) => {
      if (worker !== current) return;
      if (event.data.type === 'error') { fail(event.data.message); return; }
      if (event.data.type === 'progress') { status.textContent = `${event.data.steps} steps recorded. ${event.data.message}`; return; }
      const streaming = event.data.type === 'step';
      if (streaming) {
        walk ??= { initial: event.data.initial, steps: [], status: 'stalled', searchSteps: 0 };
        walk.steps.push(...event.data.batch);
        walk.searchSteps += event.data.batch.filter(step => step.kind === 'search').length;
      } else {
        walk = event.data.result; saveTally(walk, mode); stop();
      }
      content.hidden = false;
      solveButton.textContent = 'Rebuild walkthrough';
      status.textContent = streaming ? `Building walkthrough · ${walk.steps.length} steps available` : `${walk.status === 'solved' ? 'Solved' : 'Logic stalled — partial walkthrough'} · ${walk.steps.length} steps · ${walk.searchSteps} brute-force · ${((performance.now() - started) / 1000).toFixed(2)} s`;
      const rating = rateWalkthrough(walk);
      if (!streaming) onRating?.(rating);
      display('rating', rating.complete ? 'Difficulty: ' + rating.level + ' · ' + rating.score + ' points' : 'Difficulty: ' + (walk.searchSteps ? 'brute force used' : 'not yet rated') + ' · subtotal: ' + rating.score + ' points');
      range.max = String(walk.steps.length); jump.replaceChildren();
      ['Initial candidates', ...walk.steps.map(s => s.technique)].forEach((name, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = `${i}. ${name}`; jump.append(option); });
      const tally = new Map<string, number[]>();
      walk.steps.forEach((step, i) => { const indices = tally.get(step.technique) ?? []; indices.push(i + 1); tally.set(step.technique, indices); });
      const body = get('.walk-summary tbody'); body.replaceChildren();
      const sortedTally = [...tally].sort(([nameA, a], [nameB, b]) =>
        (stepScore(walk!.steps[a[0] - 1]) ?? Infinity) - (stepScore(walk!.steps[b[0] - 1]) ?? Infinity) || nameA.localeCompare(nameB));
      for (const [name, indices] of sortedTally) {
        const row = document.createElement('tr'); const label = document.createElement('th'); label.scope = 'row'; label.textContent = name;
        const steps = document.createElement('td');
        indices.forEach((stepNumber, i) => {
          if (i > 0) steps.append(', ');
          const button = document.createElement('button'); button.type = 'button'; button.className = 'walk-count';
          button.textContent = String(stepNumber); button.dataset.step = String(stepNumber);
          button.setAttribute('aria-label', name + ', step ' + stepNumber);
          button.addEventListener('click', () => { index = stepNumber; render(); }); steps.append(button);
        });
        row.append(label, steps); body.append(row);
      }
      render();
    };
    current.postMessage({ clues: [...clues], mode, allowSearch: searchInput.checked, completion });
  }
  solveButton.addEventListener('click', start);
  searchInput.addEventListener('change', () => { if (clues) start(); });
  cancelButton.addEventListener('click', () => { stop(); status.textContent = 'Solving cancelled. Available steps are retained; completion is not established.'; });
  const moves: Record<string, () => number> = { first: () => 0, previous: () => index - 1, next: () => index + 1, last: () => walk!.steps.length };
  for (const [action, move] of Object.entries(moves)) {
    get(`[data-action="${action}"]`).addEventListener('click', () => { if (walk) { index = Math.max(0, Math.min(walk.steps.length, move())); render(); } });
  }
  range.addEventListener('input', () => { index = Number(range.value); render(); });
  jump.addEventListener('change', () => { index = Number(jump.value); render(); });
  view.addEventListener('change', render);
  return {
    reset() { completion = undefined; clues = undefined; stop(); walk = undefined; index = 0; content.hidden = true; status.textContent = 'Generate a dug puzzle to begin.'; },
    load(nextClues: (number | null)[], nextMode: ClueMode, allowSearch = true, sharedCompletion?: number[]) { completion = sharedCompletion; clues = [...nextClues]; mode = nextMode; searchInput.checked = allowSearch; start(); },
  };
}
