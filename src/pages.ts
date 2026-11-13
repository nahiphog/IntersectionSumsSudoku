import { gridImage, imageBlob } from './gridImage';
import { ACTIVE_LOGICAL_ORDER, BRUTE_FORCE_NAME, BRUTE_FORCE_SCORE, PRODUCT_LOCK_NAME, PRODUCT_LOCK_SCORE } from './techniquePolicy';
import './style.css';
import { mountNavigation } from './navigation';
import { mountWalkthrough } from './walkthrough';
import { parseClues } from './lab';
import { bindPuzzleString } from './verifyInput';
import { readVerifyLink, verifyLink } from './verifyLink';
import { PENCILMARK_DESCRIPTION, serializeClues, serializeSolution, type ClueMode } from './puzzle';
import { TECHS } from './vendor/sudokui/engine/ratings';
import { saveTally } from './tally';
import { rateWalkthrough } from './difficulty';
import type { Walkthrough } from './walkthroughSolver';
import type { LabRequest } from './lab.worker';

const page = location.pathname.split('/').filter(Boolean).filter(p => p !== 'index.html').pop();
const titles: Record<string, string> = { techniques: 'All techniques', 'custom-build': 'Custom Build', simulation: 'Simulation', 'simulation-difficulty': 'Simulation difficulty', verify: 'Verify' };
const title = titles[page ?? ''] ?? 'Verify';
document.title = `${title} — Intersection Sums/Products/Pencilmarks Sudoku`;
document.querySelector('#app')!.innerHTML = `<header class="masthead"><a class="brand" href="${import.meta.env.BASE_URL}">✣ Intersection Sums/Products/Pencilmarks Sudoku</a></header><main class="lab-page"><p class="eyebrow">PUZZLE LABORATORY</p><h1>${title}</h1><div id="page-controls"></div><p id="lab-status" role="status">Ready.</p><button id="lab-stop" class="walk-button" hidden>Stop</button><section id="lab-results" aria-label="Results"></section><section id="lab-walk"></section></main>`;
mountNavigation();
const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const controls = get('#page-controls'), results = get('#lab-results'), status = get('#lab-status');
const walkthrough = mountWalkthrough(get('#lab-walk'));
get('#lab-walk').hidden = true;
const stopButton = get<HTMLButtonElement>('#lab-stop');
let worker: Worker | undefined;
const operation = `<label>Clue mode <select id="lab-mode"><option value="sum">Sum</option><option value="product">Product</option><option value="pencilmark">Pencilmark</option></select></label><p id="mode-description" role="status"></p>`;
const mode = () => get<HTMLSelectElement>('#lab-mode').value as ClueMode;
const integer = (selector: string, min: number, max: number) => {
  const input = get<HTMLInputElement>(selector), value = Number(input.value);
  if (!input.value.trim() || !Number.isInteger(value) || value < min || value > max) throw new Error(`${input.getAttribute('aria-label') ?? 'Value'} must be an integer from ${min} to ${max}.`);
  return value;
};
function stop() {
  worker?.terminate(); worker = undefined; stopButton.hidden = true;
  const fields = controls.querySelector('fieldset'); if (fields) fields.disabled = false;
}
stopButton.onclick = () => { stop(); status.textContent = 'Stopped. Completed results are retained; unfinished searches have no verdict.'; };
window.addEventListener('pagehide', () => { stop(); walkthrough.reset(); });
function run(request: LabRequest, receive: (data: LabResponse) => void) {
  stop(); controls.querySelector('fieldset')!.disabled = true; stopButton.hidden = false;
  const current = new Worker(new URL('./lab.worker.ts', import.meta.url), { type: 'module' }); worker = current;
  current.onerror = event => { if (worker !== current) return; stop(); status.textContent = `Unable to finish: ${event.message}`; };
  current.onmessage = ({ data }: MessageEvent<LabResponse>) => {
    if (worker !== current) return;
    if (data.type === 'progress') { status.textContent = data.message; return; }
    if (data.type === 'error' || data.type === 'exhausted') { stop(); status.textContent = data.message; return; }
    receive(data);
  };
  current.postMessage(request);
}
type LabResponse =
  | { type: 'progress' | 'error' | 'exhausted'; message: string }
  | { type: 'solution'; solution: number[] }
  | { type: 'verified'; count: number; solutions: number[][] }
  | { type: 'built'; clues: (number | null)[]; solution: number[]; walk: Walkthrough; attempt: number }
  | { type: 'sample'; trial: number; clues: (number | null)[]; ms: number; rating: ReturnType<typeof rateWalkthrough> }
  | { type: 'complete' };
function resetResults() { results.replaceChildren(); walkthrough.reset(); get('#lab-walk').hidden = true; }
function showWalk(clues: (number | null)[], clueMode: ClueMode, allowSearch = true) {
  get('#lab-walk').hidden = false; walkthrough.load(clues, clueMode, allowSearch);
}
function button(text: string, action: () => void) {
  const b = document.createElement('button'); b.className = 'walk-button'; b.textContent = text; b.onclick = action; return b;
}
function grid(values: (number | null)[], clues: boolean, alternate?: number[]) {
  const board = document.createElement('div'); board.className = 'grid lab-grid'; board.setAttribute('role', 'table');
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('div'); row.className = 'grid-row'; row.setAttribute('role', 'row');
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c, cell = document.createElement('div'); cell.className = 'cell'; cell.setAttribute('role', 'cell');
      const value = document.createElement('span'); value.className = clues ? 'clue' : 'walk-value'; value.textContent = values[i] ? String(values[i]) : '';
      cell.setAttribute('aria-label', `R${r + 1}C${c + 1}: ${values[i] ?? 'empty'}`);
      if (alternate && alternate[i] !== values[i]) cell.classList.add('lab-different');
      cell.append(value); row.append(cell);
    }
    board.append(row);
  }
  return board;
}
async function copy(text: string, host: HTMLElement) {
  try { await navigator.clipboard.writeText(text); status.textContent = 'Copied to clipboard.'; }
  catch { const area = document.createElement('textarea'); area.readOnly = true; area.value = text; area.setAttribute('aria-label', 'Copy this text'); host.append(area); area.focus(); area.select(); status.textContent = 'Clipboard unavailable. Copy the selected text.'; }
}
async function copyImage(values: (number | null)[], clues: boolean, feedback: HTMLElement) {
  const canvas = gridImage(values, clues);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob(canvas) })]);
    feedback.textContent = 'Grid image copied.';
  } catch {
    feedback.textContent = 'Image clipboard unavailable. ';
    const link = document.createElement('a'); link.textContent = 'Download PNG instead';
    link.href = canvas.toDataURL('image/png'); link.download = 'intersection-sudoku.png';
    feedback.append(link);
  }
}

function card(name: string, values: (number | null)[], clues = true, alternate?: number[]) {
  const article = document.createElement('article'); article.className = 'board-panel lab-card';
  const heading = document.createElement('h2'); heading.textContent = name; article.append(heading, grid(values, clues, alternate));
  const actions = document.createElement('div'); actions.className = 'lab-actions';
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
  actions.append(button('Copy string', () => void copy(clues ? serializeClues(values) : serializeSolution(values as number[]), article)), button('Copy image', () => void copyImage(values, clues, feedback)));
  article.append(actions, feedback); return article;
}

if (page === 'verify') {
  results.classList.add('verify-results');
  controls.innerHTML = `<p>Paste 81 comma-separated sum/product/pencilmark clues (0 for blanks), or fill the grid. Clues describe neighbours, not the digit in their own cell.</p><fieldset>${operation}<label class="lab-string">Puzzle string<textarea id="puzzle-string" placeholder="0,0,0,…" spellcheck="false"></textarea></label><p>Grid edits update the string automatically. A valid puzzle string updates the grid.</p><p id="entry-count" role="status">0 / 81 cells filled</p><div id="entry-grid" class="grid lab-grid"></div><div class="lab-actions"><button id="verify-now" type="button">Verify puzzle</button><button id="clear-input" type="button">Clear input</button><button id="paste-clipboard" type="button">Paste clipboard</button></div></fieldset>`;
  const inputs: HTMLInputElement[] = [];
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('div'); row.className = 'grid-row';
    for (let c = 0; c < 9; c++) {
      const wrap = document.createElement('div'); wrap.className = 'cell';
      const input = document.createElement('input'); input.inputMode = 'numeric'; input.maxLength = 4; input.setAttribute('aria-label', `R${r + 1}C${c + 1} clue`);
      const index = r * 9 + c;
      input.onkeydown = event => { const delta = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 9, ArrowUp: -9 } as Record<string, number>)[event.key]; if (delta) { event.preventDefault(); inputs[Math.max(0, Math.min(80, index + delta))].focus(); } };
      inputs.push(input); wrap.append(input); row.append(wrap);
    }
    get('#entry-grid').append(row);
  }
  const string = get<HTMLTextAreaElement>('#puzzle-string');
  const feedback = document.createElement('p');
  feedback.id = 'puzzle-string-feedback';
  feedback.setAttribute('role', 'status');
  string.setAttribute('aria-describedby', feedback.id);
  string.closest('label')!.after(feedback);
  const updateCount = () => {
    const count = inputs.filter(input => input.value.trim() !== '' && Number(input.value) !== 0).length;
    get('#entry-count').textContent = `${count} / 81 cells filled`;
  };
  const fillGrid = (clues: (number | null)[]) => {
    inputs.forEach((input, index) => { input.value = clues[index] === null ? '' : String(clues[index]); });
    updateCount();
  };
  inputs.forEach(input => { input.oninput = () => {
    string.value = inputs.map(cell => cell.value.trim() || '0').join(',');
    updateCount();
    syncString();
  }; });
  const syncString = bindPuzzleString(string, mode, fillGrid, feedback);
  get('#lab-mode').addEventListener('change', syncString);
  get('#clear-input').onclick = () => { string.value = ''; syncString(); resetResults(); status.textContent = 'Input cleared.'; };
  get('#paste-clipboard').onclick = async () => { try { const text = await navigator.clipboard.readText(); const clues = parseClues(text, mode()); string.value = text; fillGrid(clues); syncString(); resetResults(); status.textContent = 'Puzzle pasted.'; } catch (error) { status.textContent = `Could not paste: ${error instanceof Error ? error.message : error}. You can paste directly into Puzzle string.`; } };
  const verifyPuzzle = () => {
    resetResults();
    try {
      const clueMode = mode(), clues = parseClues(string.value.trim() || inputs.map(i => i.value.trim() || '0').join(','), clueMode);
      status.textContent = 'Checking for up to two solutions… Logical steps are available below while uniqueness is checked.';
      get('#lab-walk').hidden = false; walkthrough.load(clues, clueMode, false);
      let found = false;
      run({ task: 'verify', mode: clueMode, clues }, data => {
        if (data.type === 'solution') {
          if (!found) { found = true; walkthrough.load(clues, clueMode, true, data.solution); }
          status.textContent = 'A completion was found. Checking for a second solution… The walkthrough may include brute-force steps.';
          return;
        }
        if (data.type !== 'verified') return; stop();
        status.textContent = data.count === 0 ? 'This puzzle has no solution.' : data.count === 1 ? 'This puzzle has exactly one solution.' : 'This puzzle has at least two solutions. Differences are highlighted in orange.';
        results.append(card('Entered puzzle', clues));
        data.solutions.forEach((solution, i) => results.append(card(`Solution ${i + 1}`, solution, false, data.count > 1 ? data.solutions[1 - i] : undefined)));
        if (data.count === 0) { walkthrough.reset(); get('#lab-walk').hidden = true; }
      });
    } catch (error) { status.textContent = (error as Error).message; }
  };
  get('#verify-now').onclick = verifyPuzzle;
  try {
    const linked = readVerifyLink(location.search);
    if (linked) {
      get<HTMLSelectElement>('#lab-mode').value = linked.mode;
      string.value = linked.puzzle;
      syncString();
      verifyPuzzle();
    }
  } catch (error) { status.textContent = `Could not load puzzle link: ${(error as Error).message}`; }
} else if (page === 'custom-build') {
  controls.innerHTML = `<p>Select the positions that should contain clues. Build searches for values at exactly those positions, with one solution and a complete logical walkthrough within your rating range.</p><fieldset>${operation}<div id="pattern" class="grid lab-grid" aria-label="Select clue positions"></div><p id="selection" aria-live="polite">0 clue positions selected</p><div class="lab-actions"><button id="select-all" type="button">Select all</button><button id="select-none" type="button">Remove highlights</button></div><div class="lab-actions"><label>Minimum rating <input id="minimum" aria-label="Minimum rating" type="number" value="0" min="0" max="1000000"></label><label>Maximum rating <input id="maximum" aria-label="Maximum rating" type="number" value="100000" min="0" max="1000000"></label><label>Attempt limit <input id="attempts" aria-label="Attempt limit" type="number" value="1000" min="1" max="1000000"></label></div><button id="build-now" type="button">Build now</button></fieldset>`;
  const selected = new Set<number>(), cells: HTMLButtonElement[] = [];
  const update = () => { cells.forEach((b, i) => { b.setAttribute('aria-pressed', String(selected.has(i))); b.classList.toggle('selected', selected.has(i)); }); get('#selection').textContent = `${selected.size} clue positions selected: ${[...selected].sort((a,b)=>a-b).map(i=>`R${Math.floor(i / 9)+1}C${i%9+1}`).join(', ') || 'none'}`; };
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('div'); row.className = 'grid-row';
    for (let c = 0; c < 9; c++) { const i = r * 9 + c, cell = document.createElement('div'); cell.className = 'cell'; const b = button('', () => { selected.has(i) ? selected.delete(i) : selected.add(i); update(); }); b.setAttribute('aria-label', `R${r+1}C${c+1} clue position`); b.setAttribute('aria-pressed','false'); cells.push(b); cell.append(b); row.append(cell); }
    get('#pattern').append(row);
  }
  get('#select-all').onclick = () => { cells.forEach((_,i)=>selected.add(i)); update(); };
  get('#select-none').onclick = () => { selected.clear(); update(); };
  get('#build-now').onclick = () => {
    try {
      if (!selected.size) throw new Error('Select at least one clue position. Sparse patterns may not admit a unique puzzle.');
      const min = integer('#minimum',0,1000000), max = integer('#maximum',0,1000000), attempts = integer('#attempts',1,1000000), clueMode = mode();
      if (min > max) throw new Error('Minimum rating must not exceed maximum rating.');
      resetResults(); status.textContent = 'Searching for a matching puzzle…';
      run({ task:'custom',mode:clueMode,selected:[...selected],min,max,attempts }, data => {
        if (data.type !== 'built') return; stop(); const rating = rateWalkthrough(data.walk); saveTally(data.walk,clueMode);
        status.textContent = `Found a unique puzzle in ${data.attempt} attempt(s). Difficulty: ${rating.level} · ${rating.score} points.`;
        results.append(card('Built puzzle',data.clues),card('Completed grid',data.solution,false)); showWalk(data.clues,clueMode,false);
      });
    } catch (error) { status.textContent = (error as Error).message; }
  };
} else if (page === 'simulation' || page === 'simulation-difficulty') {
  const byDifficulty = page === 'simulation-difficulty';
  const sampleFilter = byDifficulty
    ? '<label>Display grid with difficulty rating of at least <select id="minimum-rating" aria-label="Minimum difficulty rating">' + [0,300,500,800,1000,1500,3000,10000,1000000].map(n => '<option value="' + n + '"' + (n === 800 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
    : '<label>Sample clue cap <input id="cap" aria-label="Sample clue cap" type="number" min="0" max="81"></label>';
  controls.innerHTML = `<p>Generate dug puzzles and tally their remaining clue counts. Every accepted puzzle is uniquely solvable. ${byDifficulty ? "Only fully rated puzzles meeting the minimum difficulty are displayed." : "Only samples meeting the clue cap are displayed."} Every sample is rated; trial duration includes difficulty calculation. All completed trials count in the distribution.</p><fieldset><div class="lab-actions">${operation}<label>Trials <select id="trials" aria-label="Trials">${[1,10,100,1000,10000,100000,1000000].map(n => `<option value="${n}"${n === 1000000 ? ' selected' : ''}>${n.toLocaleString('en-US')}</option>`).join('')}</select></label>${sampleFilter}<label>Digging <select id="digging"><option value="single">Single</option><option value="dual">Dual</option></select></label><label><input id="search" type="checkbox" checked> Allow brute force</label></div><button id="run-simulation" type="button">Run simulation</button></fieldset>`;
  if (!byDifficulty) {
    const setDefaultCap = () => { get<HTMLInputElement>('#cap').value = mode() === 'sum' ? '15' : mode() === 'pencilmark' ? '7' : '9'; };
    get('#lab-mode').addEventListener('change', setDefaultCap);
    setDefaultCap();
  }
  get('#run-simulation').onclick = () => {
    try {
      const trials = Number(get<HTMLSelectElement>('#trials').value), cap = byDifficulty ? 81 : integer('#cap',0,81);
      const minimumRating = byDifficulty ? Number(get<HTMLSelectElement>('#minimum-rating').value) : 0;
      const clueMode = mode();
      resetResults(); results.innerHTML = '<p id="simulation-summary" role="status">No completed trials yet.</p><h2>Clue-count distribution</h2><div id="histogram" aria-label="Clue-count distribution"></div><h2>Qualifying samples</h2><p>Showing the latest 11 qualifying grids.</p><div id="samples" class="lab-samples"></div>';
      let total = 0, qualified = 0, milliseconds = 0, cluesTotal = 0; const counts = new Map<number,number>();
      run({ task:'simulation',mode:clueMode,trials,digging:get<HTMLSelectElement>('#digging').value as 'single'|'dual',allowSearch:get<HTMLInputElement>('#search').checked }, data => {
        if (data.type === 'complete') { stop(); status.textContent = `Complete: ${total} trials, ${qualified} qualifying grids.`; return; }
        if (data.type !== 'sample') return;
        const n = data.clues.filter(c=>c!==null).length; total++; milliseconds += data.ms; cluesTotal += n; counts.set(n,(counts.get(n) ?? 0)+1);
        if (byDifficulty ? data.rating.complete && data.rating.score >= minimumRating : n <= cap) {
          qualified++;
          const samples = get('#samples');
          const sample = card(`Trial ${data.trial} · ${n} clues`, data.clues);
          const rating = document.createElement('p');
          rating.textContent = data.rating.complete
            ? `Difficulty: ${data.rating.level} · ${data.rating.score} points`
            : `Difficulty: not fully rated · subtotal ${data.rating.score} points`;
          const displayed = new Date();
          const timestamp = document.createElement('p');
          const time = document.createElement('time');
          time.dateTime = displayed.toISOString();
          time.textContent = displayed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' });
          timestamp.append('Displayed (local time): ', time);
          sample.querySelector('h2')!.after(rating, timestamp);
          const url = verifyLink(new URL(import.meta.env.BASE_URL, location.origin).href, data.clues, clueMode);
          sample.querySelector('.lab-actions')!.prepend(button('Open in Verify', () => { window.open(url, '_blank', 'noopener,noreferrer'); }));
          samples.prepend(sample);
          while(samples.children.length>11) samples.lastElementChild!.remove();
        }
        get('#simulation-summary').textContent = `${total} / ${trials} completed · ${qualified} qualify · mean ${(cluesTotal/total).toFixed(1)} clues · ${(milliseconds/total/1000).toFixed(2)} s/grid`;
        const histogram = get('#histogram'); histogram.replaceChildren(); const max = Math.max(...counts.values());
        for (const [clues, count] of [...counts].sort(([a],[b])=>a-b)) { const row = document.createElement('div'); row.className = 'hist-row'; const label = document.createElement('span'); label.textContent = `${clues} clues: ${count}`; const bar = document.createElement('meter'); bar.min=0;bar.max=max;bar.value=count;bar.setAttribute('aria-label',`${clues} clues: ${count} puzzles`); row.append(label,bar);histogram.append(row); }
      });
    } catch (error) { status.textContent = (error as Error).message; }
  };
} else {
  status.hidden = true;
  const catalogue = [
    {name:'Intersection sum',score:10}, {name:'Intersection product',score:10}, {name:'Intersection pencilmarks',score:10}, {name:'Combined sum equations',score:10},
    {name:PRODUCT_LOCK_NAME,score:PRODUCT_LOCK_SCORE},
    ...ACTIVE_LOGICAL_ORDER.map(t => TECHS[t]), {name:BRUTE_FORCE_NAME,score:BRUTE_FORCE_SCORE},
  ].filter(info => info.score === null || info.score < 400 || info.score > 800)
    .sort((a,b) => (a.score ?? Infinity) - (b.score ?? Infinity) || a.name.localeCompare(b.name));
  const table = document.createElement('table'); table.className = 'lab-table';
  table.innerHTML = '<thead><tr><th scope="col">Technique</th><th scope="col">Points</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const info of catalogue) {
    const row = document.createElement('tr');
    for (const value of [info.name, info.score === null ? 'Unscored' : '+' + info.score]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    body.append(row);
  }
  table.append(body); results.append(table);
}


const modeSelect = document.querySelector<HTMLSelectElement>('#lab-mode');
if (modeSelect) {
  const updateDescription = () => { get('#mode-description').textContent = modeSelect.value === 'pencilmark' ? PENCILMARK_DESCRIPTION : ''; };
  modeSelect.addEventListener('change', updateDescription);
  updateDescription();
}
