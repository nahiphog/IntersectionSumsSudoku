export function mountNavigation() {
  const nav = document.createElement('nav');
  nav.className = 'site-nav'; nav.setAttribute('aria-label', 'Main navigation');
  const base = import.meta.env.BASE_URL;
  for (const [path, label] of [['', 'Generate'], ['techniques/', 'Techniques tally'], ['custom-build/', 'Custom Build'], ['simulation/', 'Simulation'], ['verify/', 'Verify']]) {
    const link = document.createElement('a'); link.href = base + path; link.textContent = label;
    if (location.pathname === base + path || location.pathname === base + path + 'index.html') link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  document.querySelector('.masthead')?.after(nav);
  if (!nav.isConnected) document.body.prepend(nav);
}
