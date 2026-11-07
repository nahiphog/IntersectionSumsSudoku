export function mountNavigation() {
  const header = document.querySelector<HTMLElement>('.masthead');
  if (!header) return;
  const base = import.meta.env.BASE_URL;
  header.innerHTML = `
    <nav class="header-navigation" aria-label="Main navigation"><select aria-label="Choose page"></select></nav>
    <a class="brand" href="${base}" aria-label="Intersection Sums/Products Sudoku home"><span class="brand-mark" aria-hidden="true">✣</span><span>Intersection Sums/Products Sudoku</span></a>
    <button type="button" class="about-button" aria-haspopup="dialog">About</button>`;
  const select = header.querySelector('select')!;
  for (const [path, label] of [['', 'Generate'], ['techniques/', 'Technique tally'], ['custom-build/', 'Custom Build'], ['simulation/', 'Simulation'], ['verify/', 'Verify']]) {
    const option = document.createElement('option');
    option.value = base + path; option.textContent = label;
    option.selected = location.pathname === base + path || location.pathname === base + path + 'index.html';
    select.append(option);
  }
  select.addEventListener('change', () => location.assign(select.value));

  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog'; dialog.setAttribute('aria-labelledby', 'about-title');
  dialog.innerHTML = `<h2 id="about-title">About</h2><p>The rules: Normal sudoku rules apply. A clue written in the upper-left corner of a cell gives the sum of the digits in the cells orthogonally adjacent to that cell.</p><form method="dialog"><button class="walk-button" autofocus>Close</button></form>`;
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
