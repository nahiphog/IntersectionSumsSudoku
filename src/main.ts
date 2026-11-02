import './style.css';
import { intersectionClues, orthogonalNeighbours, type ClueMode, type IntersectionPuzzle } from './puzzle';
import type { DugPuzzle, DigProgress } from './digging';
import { mountWalkthrough } from './walkthrough';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead">
    <a class="brand" href="./" aria-label="Intersection Sums/Products Sudoku home"><span class="brand-mark" aria-hidden="true">✣</span> <span>Intersection Sums/Products Sudoku</span></a>
    <span class="version">GENERATOR · 01</span>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">A DIFFERENT WAY TO SEE SUDOKU</p><h1>Every neighbour counts.</h1><p class="lead">A completed grid. Two ways to connect it.<br>Explore Intersection Sums/Products Sudoku.</p></div>
      <div class="generator-controls"><fieldset class="mode-toggle"><legend>Clue operation</legend><label><input type="radio" name="mode" value="sum" checked><span>Sum</span></label><label><input type="radio" name="mode" value="product"><span>Product</span></label></fieldset><button id="generate" class="generate"><span aria-hidden="true">↻</span> Generate</button></div>
    </section>
    <section class="rule-strip" aria-label="Puzzle rules"><span class="rule-label">THE RULES</span><p id="rules"></p><div class="rule-cross" aria-hidden="true"><span></span><span>↑</span><span></span><span>←</span><span id="operation-symbol">Σ</span><span>→</span><span></span><span>↓</span><span></span></div></section>
    <div class="workspace-bar"><span><i class="status-dot"></i> GENERATION WORKSPACE</span><p id="status" role="status" aria-live="polite">Ready when you are</p></div>
    <section class="boards" aria-label="Sudoku generator">
      <article class="board-panel"><div class="panel-heading"><div><span class="step">01 / SOURCE</span><h2>Completed grid</h2></div><span class="pill">9 × 9</span></div><div id="solution" class="grid" role="table" aria-label="Completed Sudoku grid"></div><p class="board-caption"><span class="caption-line"></span> Every row, column and box contains 1–9.</p></article>
      <article class="board-panel puzzle-panel"><div class="panel-heading"><div><span class="step">02 / TRANSFORMATION</span><h2 id="puzzle-title">Intersection sums</h2></div><span class="pill green">81 clues</span></div><div id="puzzle" class="grid clue-grid" role="table" aria-label="Empty Intersection Sums puzzle"></div><p class="board-caption"><span class="caption-corner">Σ</span> Small clues. All 81 digits left for you to discover.</p></article>
    </section>
    <section class="dig-section" aria-label="Dug puzzle generation"><article class="board-panel"><div class="panel-heading"><div><span class="step">03 / DIGGING</span><h2>Dug puzzle</h2></div><span id="given-count" class="pill green">— givens</span></div><div id="dug" class="grid clue-grid" role="table" aria-label="Dug puzzle"></div><p class="board-caption">Clues preserve uniqueness and a complete logical solution.</p></article><div class="dig-info"><h2>Find the essentials.</h2><p>Clues are tested in a random order. Each removal is kept only if backtracking confirms exactly one solution and the logical solver finishes using sudokUI techniques and sum/product constraints without backtracking.</p><p id="dig-status" role="status">Generate to begin digging.</p><p>Generation time: <strong id="elapsed">—</strong></p><progress id="dig-progress" max="81" value="0" aria-label="Clues tested"></progress><button id="cancel" hidden>Cancel generation</button><p class="dig-note">Fast digging keeps clues whenever its logical techniques stall. Puzzles may have more clues, but every removal preserves uniqueness and a complete solution without backtracking.</p></div></section>
    <section class="inspector" aria-label="Clue explanation"><span class="inspector-icon" aria-hidden="true">＋</span><div><h3>Follow a clue</h3><p id="explanation" aria-live="polite">Generate a puzzle, then select a sum to explore its neighbours.</p></div><span class="inspector-note">UP · DOWN · LEFT · RIGHT</span></section>
    <section id="walkthrough" class="walkthrough" aria-label="Solution walkthrough"></section>
    <footer><span>INTERSECTION SUMS/PRODUCTS SUDOKU</span><span>Classic solving engine from <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI ↗</a> · <a href="./LICENSE.txt">GPL-3.0</a></span></footer>
  </main>`;

let puzzle: IntersectionPuzzle | undefined;
let mode: ClueMode = 'sum';
let generation = 0;
let activeCell = -1;
let dugClues: (number | null)[] | undefined;
let worker: Worker | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let started = 0;
const solutionElement = document.querySelector<HTMLDivElement>('#solution')!;
const puzzleElement = document.querySelector<HTMLDivElement>('#puzzle')!;
const dugElement = document.querySelector<HTMLDivElement>('#dug')!;
const explanation = document.querySelector<HTMLParagraphElement>('#explanation')!;
const walkthrough = mountWalkthrough(document.querySelector('#walkthrough')!);

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
  explanation.textContent = `Row ${Math.floor(index / 9) + 1}, column ${index % 9 + 1}: ${neighbours.map(cell => puzzle!.solution[cell]).join(mode === 'sum' ? ' + ' : ' × ')} = ${puzzle.clues[index]}. ${neighbours.length} neighbours; the cell itself is excluded.`;
}

function updateModeText(): void {
  const plural = mode === 'sum' ? 'sums' : 'products';
  document.querySelector('#rules')!.textContent = `Normal sudoku rules apply. A clue written in the upper-left corner of a cell gives the ${mode} of the digits in the cells orthogonally adjacent to that cell.`;
  document.querySelector('#puzzle-title')!.textContent = `Intersection ${plural}`;
  puzzleElement.setAttribute('aria-label', `Empty Intersection ${plural} puzzle`);
  document.querySelectorAll('#operation-symbol, .caption-corner').forEach(element => element.textContent = mode === 'sum' ? 'Σ' : 'Π');
  document.querySelector('.inspector-icon')!.textContent = mode === 'sum' ? '＋' : '×';
  document.querySelector('#status')!.textContent = puzzle ? `Grid ${String(generation).padStart(2, '0')} generated · 81 ${mode} clues` : 'Ready when you are';
  explanation.textContent = puzzle
    ? `Select a ${mode} in the right grid to highlight its neighbours in the completed grid. Use arrow keys to move.`
    : `Generate a puzzle, then select a ${mode} to explore its neighbours.`;
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
  document.querySelector<HTMLButtonElement>('#generate')!.disabled = false;
  document.querySelector<HTMLButtonElement>('#cancel')!.hidden = true;
}

function startDigging(initial?: IntersectionPuzzle): void {
  stopWorker();
  walkthrough.reset();
  started = performance.now();
  generation++;
  activeCell = -1;
  dugClues = undefined;
  renderGrid(dugElement, true, Array(81).fill(null));
  document.querySelector('#given-count')!.textContent = '— givens';
  document.querySelector('#dig-status')!.textContent = 'Checking the full puzzle for uniqueness and logical solvability…';
  document.querySelector<HTMLProgressElement>('#dig-progress')!.value = 0;
  document.querySelector<HTMLButtonElement>('#generate')!.disabled = true;
  document.querySelector<HTMLButtonElement>('#cancel')!.hidden = false;
  const updateTime = () => { document.querySelector('#elapsed')!.textContent = `${((performance.now() - started) / 1000).toFixed(2)} s`; };
  updateTime();
  timer = setInterval(updateTime, 100);
  const current = new Worker(new URL('./digging.worker.ts', import.meta.url), { type: 'module' });
  worker = current;
  const fail = (message: string) => {
    if (worker !== current) return;
    updateTime();
    stopWorker();
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
        renderGrid(solutionElement, false);
        renderGrid(puzzleElement, true);
        updateModeText();
      }
      const { attempt, tested, givens, phase, pass } = data.progress;
      document.querySelector('#dig-status')!.textContent = phase === 'checking'
        ? `Attempt ${attempt}: checking all 81 clues for uniqueness and logical solvability…`
        : `Attempt ${attempt}: pass ${pass}: tested ${tested} / 81 positions · ${givens} remaining`;
      document.querySelector<HTMLProgressElement>('#dig-progress')!.value = tested;
    } else if (data.type === 'complete') {
      puzzle = data.result;
      dugClues = data.result.dugClues;
      renderGrid(dugElement, true, dugClues);
      document.querySelector('#given-count')!.textContent = `${dugClues.filter(clue => clue !== null).length} givens`;
      document.querySelector('#dig-status')!.textContent = `Complete · unique solution · solvable without backtracking · ${data.result.attempts} attempt(s)`;
      updateTime();
      stopWorker();
      walkthrough.load(dugClues, mode);
    }
  };
  current.postMessage({ mode, initial });
}

document.querySelector<HTMLButtonElement>('#generate')!.addEventListener('click', () => startDigging());
document.querySelector<HTMLButtonElement>('#cancel')!.addEventListener('click', () => {
  stopWorker();
  document.querySelector('#dig-status')!.textContent = 'Generation cancelled. No final dug puzzle produced.';
});

renderGrid(solutionElement, false);
renderGrid(puzzleElement, true);
renderGrid(dugElement, true, Array(81).fill(null));
updateModeText();
