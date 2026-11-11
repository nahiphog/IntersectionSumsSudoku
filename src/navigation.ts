import { PENCILMARK_DESCRIPTION } from './puzzle';
export function mountNavigation() {
  const header = document.querySelector<HTMLElement>('.masthead');
  if (!header) return;
  const base = import.meta.env.BASE_URL;
  header.innerHTML = `
    <nav class="header-navigation" aria-label="Main navigation"><select aria-label="Choose page"></select></nav>
    <a class="brand" href="${base}" aria-label="Intersection Sums/Products/Pencilmarks Sudoku home"><span class="brand-mark" aria-hidden="true">✣</span><span>Intersection Sums/Products/Pencilmarks Sudoku</span></a>
    <button type="button" class="about-button" aria-haspopup="dialog">About</button>`;
  const select = header.querySelector('select')!;
  for (const [path, label] of [['', 'Generate'], ['techniques/', 'All techniques'], ['custom-build/', 'Custom Build'], ['simulation/', 'Simulation'], ['simulation-difficulty/', 'Simulation difficulty'], ['verify/', 'Verify']]) {
    const option = document.createElement('option');
    option.value = base + path; option.textContent = label;
    option.selected = location.pathname === base + path || location.pathname === base + path + 'index.html';
    select.append(option);
  }
  select.addEventListener('change', () => location.assign(select.value));

  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog'; dialog.setAttribute('aria-labelledby', 'about-title');
  dialog.innerHTML = `<h2 id="about-title">About</h2><p>Normal Sudoku rules apply. Fill every row, column, and 3 × 3 box with the digits 1–9, each appearing exactly once.</p><p>A clue written in the upper-left corner of a cell refers to its orthogonally adjacent cells—the cells immediately above, below, left, and right. Only neighbours within the grid are included. The cell containing the clue is not included.</p><p><strong>Sum mode</strong> — The clue gives the sum of the digits in those neighbouring cells.</p><p><strong>Product mode</strong> — The clue gives the product of the digits in those neighbouring cells.</p><p>${PENCILMARK_DESCRIPTION}</p><p>For example, 1688 at R7C3 means R7C2, R7C4, R6C3, and R8C3 contain 1, 6, 8, and 8 in some order. Repeated digits are required. Corner clues list two digits; edge clues list three.</p><form method="dialog"><button class="walk-button" autofocus>Close</button></form>`;
  document.body.append(dialog);
  const about = header.querySelector<HTMLButtonElement>('.about-button')!;
  about.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('close', () => about.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
