import { mountNavigation } from './navigation';
import './style.css';
import { intersectionClues, orthogonalNeighbours, serializeClues, serializeSolution, type ClueMode, type IntersectionPuzzle } from './puzzle';
import type { DugPuzzle, DigProgress, DiggingMode } from './digging';
import { mountWalkthrough } from './walkthrough';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead">
    <a class="brand" href="./" aria-label="Intersection Sums/Products Sudoku home"><span class="brand-mark" aria-hidden="true">✣</span> <span>Intersection Sums/Products Sudoku</span></a>
    <span class="version">GENERATOR · 01</span>
  </header>
  <main>
    <section class="intro">
      <div class="generator-controls"><fieldset class="mode-toggle"><legend>Clue operation</legend><label><input type="radio" name="mode" value="sum" checked><span>Sum</span></label><label><input type="radio" name="mode" value="product"><span>Product</span></label></fieldset><fieldset class="mode-toggle"><legend>Digging algorithm</legend><label><input type="radio" name="digging" value="single" checked><span>Single</span></label><label><input type="radio" name="digging" value="dual"><span>Dual</span></label></fieldset><label class="generation-search"><input id="allow-backtracking" type="checkbox" checked> Allow brute force</label><button id="generate" class="generate"><span aria-hidden="true">↻</span> Generate</button></div>
    </section>
    <div class="workspace-bar"><span><i class="status-dot"></i> GENERATION WORKSPACE</span><p id="status" role="status" aria-live="polite">Ready when you are</p></div>
    <section class="dig-section" aria-label="Dug puzzle generation"><article class="board-panel"><div class="panel-heading"><div><span class="step">03 / DIGGING</span><h2>Dug puzzle</h2></div><span id="given-count" class="pill green">— givens</span></div><div id="dug" class="grid clue-grid" role="table" aria-label="Dug puzzle"></div><p class="board-caption">Only confirmed clue removals are kept.</p></article><div class="dig-info"><p id="dig-status" role="status">Generate to begin digging.</p><p>Generation time: <strong id="elapsed">—</strong></p><p id="dig-rating" class="walk-rating" role="status">Difficulty: —</p><p id="dig-outcome">Digging: not started</p><button id="copy-dug" disabled>Copy dug puzzle</button><p id="copy-status" role="status"></p><textarea id="copy-fallback" aria-label="Dug puzzle comma-separated clues" readonly hidden></textarea></div></section>
    <section id="walkthrough" class="walkthrough" aria-label="Solution walkthrough"></section>
    <section class="boards" aria-label="Sudoku generator">
      <article class="board-panel"><div class="panel-heading"><div><span class="step">01 / SOURCE</span><h2>Completed grid</h2></div><span class="pill">9 × 9</span></div><button id="copy-solution" class="copy-grid" disabled>Copy completed grid</button><span id="copy-solution-status" role="status"></span><button type="button" class="walk-button grid-toggle" aria-controls="solution" aria-expanded="false">Expand grid</button><div id="solution" hidden class="grid" role="table" aria-label="Completed Sudoku grid"></div><p class="board-caption"><span class="caption-line"></span> Every row, column and box contains 1–9.</p></article>
      <article class="board-panel puzzle-panel"><div class="panel-heading"><div><span class="step">02 / TRANSFORMATION</span><h2 id="puzzle-title">Intersection sums</h2></div><span class="pill green">81 clues</span></div><button id="copy-transformed" class="copy-grid" disabled>Copy sums/products grid</button><span id="copy-transformed-status" role="status"></span><button type="button" class="walk-button grid-toggle" aria-controls="puzzle" aria-expanded="false">Expand grid</button><div id="puzzle" hidden class="grid clue-grid" role="table" aria-label="Empty Intersection Sums puzzle"></div><p class="board-caption"><span class="caption-corner">Σ</span> Small clues. All 81 digits left for you to discover.</p></article>
    </section>
    <footer><span>INTERSECTION SUMS/PRODUCTS SUDOKU</span><span>Classic solving engine from <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI ↗</a> · <a href="./LICENSE.txt">GPL-3.0</a></span></footer>
  </main>`;

let puzzle: IntersectionPuzzle | undefined;
let mode: ClueMode = 'sum';
let diggingMode: DiggingMode = 'single';
let allowBacktracking = true;
let generation = 0;
let activeCell = -1;
let verified = false;
let dugClues: (number | null)[] | undefined;
let worker: Worker | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let started = 0;
const solutionElement = document.querySelector<HTMLDivElement>('#solution')!;
const puzzleElement = document.querySelector<HTMLDivElement>('#puzzle')!;
const dugElement = document.querySelector<HTMLDivElement>('#dug')!;
const walkthrough = mountWalkthrough(document.querySelector('#walkthrough')!, rating => {
  document.querySelector('#dig-rating')!.textContent = rating.complete
    ? 'Difficulty: ' + rating.level + ' · ' + rating.score + ' points'
    : 'Difficulty: not fully rated · subtotal ' + rating.score + ' points';
});

function renderGrid(element: HTMLDivElement, isClue: boolean, clues = puzzle?.clues as readonly (number | null)[] | undefined): void {
  element.replaceChildren();
  for (let row = 0; row < 9; row++) {
    const rowElement = document.createElement('div');
    rowElement.className = 'grid-row';
    rowElement.setAttribute('role', 'row');
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'cell');
      if (isClue && puzzle && clues?.[index] != null) {
        const button = document.createElement('button');
        button.className = 'clue-button';
        button.innerHTML = `<span class="clue">${clues[index]}</span>`;
        button.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${mode} ${clues[index]}. Inspect neighbours.`);
        button.tabIndex = index === 0 ? 0 : -1;
        button.addEventListener('focus', () => inspect(index));
        button.addEventListener('click', () => inspect(index));
        button.addEventListener('keydown', event => {
          const offsets: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
          if (!(event.key in offsets)) return;
          event.preventDefault();
          let next = index + offsets[event.key];
          while (next >= 0 && next < 81) {
            if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && Math.floor(next / 9) !== row) return;
            const target = element.querySelector<HTMLButtonElement>(`[data-index="${next}"] button`);
            if (target) { target.focus(); return; }
            next += offsets[event.key];
          }
        });
        cell.append(button);
      } else {
        cell.textContent = !isClue && puzzle ? String(puzzle.solution[index]) : '';
        cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${!isClue && puzzle ? puzzle.solution[index] : 'empty'}`);
      }
      rowElement.append(cell);
    }
    element.append(rowElement);
  }
  element.querySelector<HTMLButtonElement>('button')?.setAttribute('tabindex', '0');
}

function inspect(index: number): void {
  if (!puzzle) return;
  activeCell = index;
  const neighbours = orthogonalNeighbours(index);
  solutionElement.querySelectorAll<HTMLElement>('.cell').forEach(cell => {
    const cellIndex = Number(cell.dataset.index);
    cell.classList.toggle('neighbour', neighbours.includes(cellIndex));
    cell.classList.toggle('source-cell', cellIndex === index);
  });
  for (const grid of [puzzleElement, dugElement]) {
    grid.querySelectorAll<HTMLElement>('.cell').forEach(cell => {
      const button = cell.querySelector('button');
      const selected = Number(cell.dataset.index) === activeCell && !!button;
      cell.classList.toggle('selected', selected);
      if (!button) return;
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute('aria-pressed', String(selected));
    });
    if (!grid.querySelector('button[tabindex="0"]')) grid.querySelector('button')?.setAttribute('tabindex', '0');
  }
}

function updateModeText(): void {
  const plural = mode === 'sum' ? 'sums' : 'products';
  document.querySelector('#puzzle-title')!.textContent = `Intersection ${plural}`;
  puzzleElement.setAttribute('aria-label', `Empty Intersection ${plural} puzzle`);
  document.querySelectorAll('#operation-symbol, .caption-corner').forEach(element => element.textContent = mode === 'sum' ? 'Σ' : 'Π');
  document.querySelector('#status')!.textContent = puzzle ? `Grid ${String(generation).padStart(2, '0')} generated · 81 ${mode} clues` : 'Ready when you are';
  if (activeCell >= 0) inspect(activeCell);
}

document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(input => {
  input.addEventListener('change', () => {
    mode = input.value as ClueMode;
    if (puzzle) {
      puzzle.clues = intersectionClues(puzzle.solution, mode);
      renderGrid(puzzleElement, true);
    }
    updateModeText();
    if (puzzle || worker) startDigging(puzzle);
  });
});

function stopWorker(): void {
  worker?.terminate();
  worker = undefined;
  clearInterval(timer);
  document.querySelector<HTMLButtonElement>('#generate')!.textContent = 'Generate';
}

function startDigging(initial?: IntersectionPuzzle): void {
  stopWorker();
  walkthrough.reset();
  started = performance.now();
  generation++;
  activeCell = -1;
  dugClues = undefined; verified = false;
  document.querySelector('#dig-rating')!.textContent = 'Difficulty: pending';
  document.querySelector('#dig-outcome')!.textContent = 'Digging: in progress';
  for (const id of ['solution', 'transformed']) {
    document.querySelector<HTMLButtonElement>('#copy-' + id)!.disabled = true;
    document.querySelector('#copy-' + id + '-status')!.textContent = '';
  }
  document.querySelector<HTMLButtonElement>('#copy-dug')!.disabled = true;
  document.querySelector('#copy-status')!.textContent = '';
  document.querySelector<HTMLTextAreaElement>('#copy-fallback')!.hidden = true;
  renderGrid(dugElement, true, Array(81).fill(null));
  document.querySelector('#given-count')!.textContent = '— givens';
  document.querySelector('#dig-status')!.textContent = allowBacktracking ? 'Checking the full puzzle for uniqueness…' : 'Checking the full puzzle for uniqueness and logical solvability…';
  document.querySelector<HTMLButtonElement>('#generate')!.textContent = 'Cancel generation';
  const updateTime = () => { document.querySelector('#elapsed')!.textContent = `${((performance.now() - started) / 1000).toFixed(2)} s`; };
  updateTime();
  timer = setInterval(updateTime, 100);
  const current = new Worker(new URL('./digging.worker.ts', import.meta.url), { type: 'module' });
  worker = current;
  const fail = (message: string) => {
    if (worker !== current) return;
    updateTime();
    stopWorker();
    document.querySelector('#dig-outcome')!.textContent = 'Digging: halted by error';
    document.querySelector('#dig-status')!.textContent = `Generation failed: ${message} Try Generate again.`;
  };
  current.onerror = event => fail(event.message);
  current.onmessage = (event: MessageEvent<{ type: string; progress: DigProgress; puzzle?: IntersectionPuzzle; result: DugPuzzle; message: string }>) => {
    if (worker !== current) return;
    const data = event.data;
    if (data.type === 'error') { fail(data.message); return; }
    if (data.type === 'progress') {
      if (data.puzzle) {
        puzzle = data.puzzle;
        verified = false; dugClues = [...puzzle.clues];
        renderGrid(dugElement, true, dugClues);
        document.querySelector('#given-count')!.textContent = '81 givens';
        document.querySelector<HTMLButtonElement>('#copy-solution')!.disabled = false;
        document.querySelector<HTMLButtonElement>('#copy-transformed')!.disabled = false;
        renderGrid(solutionElement, false);
        renderGrid(puzzleElement, true);
        updateModeText();
      }
      const { attempt, tested, givens, phase, pass, total } = data.progress;
      if (data.progress.dugClues) {
        verified = true; dugClues = data.progress.dugClues;
        renderGrid(dugElement, true, dugClues);
        document.querySelector('#given-count')!.textContent = givens + ' givens';
      }
      document.querySelector('#dig-status')!.textContent = phase === 'checking'
        ? `Attempt ${attempt}: checking all 81 clues for uniqueness${allowBacktracking ? '' : ' and logical solvability'}…`
        : `Attempt ${attempt}: pass ${pass}: tested ${tested} / ${total} ${diggingMode === 'dual' ? 'pairs/centre' : 'cells'} · ${givens} remaining`;
    } else if (data.type === 'complete') {
      verified = true;
      document.querySelector('#dig-outcome')!.textContent = 'Digging: completed (not halted)';
      document.querySelector('#dig-rating')!.textContent = 'Difficulty: calculating…';
      puzzle = data.result;
      dugClues = data.result.dugClues;
      document.querySelector<HTMLButtonElement>('#copy-dug')!.disabled = false;
      renderGrid(dugElement, true, dugClues);
      document.querySelector('#given-count')!.textContent = `${dugClues.filter(clue => clue !== null).length} givens`;
      document.querySelector('#dig-status')!.textContent = `Complete · unique solution · ${allowBacktracking ? 'brute force allowed' : 'solvable without brute force'} · ${data.result.attempts} attempt(s)`;
      updateTime();
      stopWorker();
      walkthrough.load(dugClues, mode, allowBacktracking);
    }
  };
  current.postMessage({ mode, initial, diggingMode, allowBacktracking });
}

document.querySelector<HTMLButtonElement>('#generate')!.addEventListener('click', () => {
  if (!worker) { startDigging(); return; }
  stopWorker();
  document.querySelector('#elapsed')!.textContent = ((performance.now() - started) / 1000).toFixed(2) + ' s';
  document.querySelector('#dig-outcome')!.textContent = 'Digging: halted by user';
  document.querySelector('#dig-status')!.textContent = verified
    ? 'Stopped. The remaining clues have a unique solution.'
    : 'Stopped before the full puzzle was verified. Uniqueness is not yet confirmed.';
  if (dugClues) {
    renderGrid(dugElement, true, dugClues);
    document.querySelector<HTMLButtonElement>('#copy-dug')!.disabled = false;
    document.querySelector('#dig-rating')!.textContent = 'Difficulty: calculating…';
    walkthrough.load(dugClues, mode, allowBacktracking);
  } else document.querySelector('#dig-rating')!.textContent = 'Difficulty: unavailable (no puzzle generated)';
});

renderGrid(solutionElement, false);
renderGrid(puzzleElement, true);
renderGrid(dugElement, true, Array(81).fill(null));
updateModeText();

 document.querySelectorAll<HTMLInputElement>('input[name="digging"]').forEach(input => {
  input.addEventListener('change', () => {
    diggingMode = input.value as DiggingMode;
    if (puzzle || worker) startDigging(puzzle);
  });
});

document.querySelector<HTMLInputElement>('#allow-backtracking')!.addEventListener('change', event => {
  allowBacktracking = (event.target as HTMLInputElement).checked;
  if (puzzle || worker) startDigging(puzzle);
});
function bindCopy(id: string, statusId: string, getText: () => string | undefined, message: string) {
  document.querySelector<HTMLButtonElement>(id)!.addEventListener('click', async () => {
    const text = getText();
    if (text === undefined) return;
    try {
      await navigator.clipboard.writeText(text);
      if (getText() === text) document.querySelector(statusId)!.textContent = message;
    } catch {
      if (getText() !== text) return;
      const fallback = document.querySelector<HTMLTextAreaElement>('#copy-fallback')!;
      fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
      document.querySelector(statusId)!.textContent = 'Clipboard unavailable. Copy the selected text.';
    }
  });
}
bindCopy('#copy-dug', '#copy-status', () => dugClues && serializeClues(dugClues), 'Copied 81 comma-separated clues.');
bindCopy('#copy-solution', '#copy-solution-status', () => puzzle && serializeSolution(puzzle.solution), 'Copied 81 digits.');
bindCopy('#copy-transformed', '#copy-transformed-status', () => puzzle && serializeClues(puzzle.clues), 'Copied 81 comma-separated clues.');

document.querySelectorAll<HTMLButtonElement>('.grid-toggle').forEach(button => {
  const grid = document.getElementById(button.getAttribute('aria-controls')!)!;
  button.addEventListener('click', () => {
    grid.hidden = !grid.hidden;
    button.setAttribute('aria-expanded', String(!grid.hidden));
    button.textContent = grid.hidden ? 'Expand grid' : 'Hide grid';
  });
});

mountNavigation();
