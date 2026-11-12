// Escala Kids v1.2.5 — mantém a navegação montada enquanto as abas forem as mesmas.
// Só o indicador usa transform; a troca de aba atualiza classes e aria-current.
export const navSignature = items => items.map(([id]) => id).join('|');
export function syncNavigation(nav, items, active, ico, esc) {
  nav.style.display = items.length ? 'flex' : 'none';
  const signature = navSignature(items);
  const rebuilt = nav.dataset.navSignature !== signature;
  if (rebuilt) {
    nav.innerHTML = '<span class="nav-indicator" aria-hidden="true"></span>' +
      items.map(([id,name,icon]) =>
        '<button type="button" data-a="tab" data-tab="' + esc(id) + '" aria-current="false">' +
        '<span class="nav-icon">' + ico(icon) + '</span><span class="nav-label">' +
        esc(name) + '</span></button>').join('');
    nav.dataset.navSignature = signature;
  }
  const buttons = [...nav.querySelectorAll('button[data-a="tab"]')];
  for (const btn of buttons) {
    const item = items.find(([id]) => id === btn.dataset.tab);
    const selected = btn.dataset.tab === active;
    btn.classList.toggle('on', selected);
    btn.setAttribute('aria-current',selected?'page':'false');
    const label = btn.querySelector('.nav-label');
    if (item && label && label.textContent !== item[1]) label.textContent = item[1];
  }
  const target = buttons.find(btn => btn.dataset.tab === active);
  const indicator = nav.querySelector('.nav-indicator');
  if (target && indicator) {
    const x = target.offsetLeft + (target.offsetWidth - 44) / 2;
    indicator.style.transform = 'translate3d(' + x + 'px,0,0)';
    indicator.style.opacity = '1';
  } else if (indicator) indicator.style.opacity = '0';
  return {rebuilt, active};
}
