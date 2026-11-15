// Module 5 · simulator-first console layout: details drawer, weather chips, destination switch and
// bottom-bar indicators. Scoped DOM wiring only; mission state stays in mission.js.

const TAB_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
let drawer = null, returnFocus = null;

function q(selector, root = document) { return root.querySelector(selector); }
function qa(selector, root = document) { return [...root.querySelectorAll(selector)]; }

function tabs() { return qa('[data-drawer-tab]', drawer); }
function syncExpanded(open) {
  for (const trigger of qa('[data-open-drawer]')) trigger.setAttribute('aria-expanded', String(open && trigger.dataset.openDrawer === drawer.dataset.tab));
}

export function selectDrawerTab(name, { focusTab = false } = {}) {
  if (!drawer) return;
  const known = tabs().some((tab) => tab.dataset.drawerTab === name);
  const active = known ? name : 'compare';
  drawer.dataset.tab = active;
  for (const tab of tabs()) {
    const selected = tab.dataset.drawerTab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) tab.focus({ preventScroll: true });
  }
  for (const panel of qa('[data-drawer-panel]', drawer)) panel.hidden = panel.dataset.drawerPanel !== active;
  syncExpanded(!drawer.hidden);
}

export function openDrawer(name, { focus = true } = {}) {
  if (!drawer) return;
  if (drawer.hidden) returnFocus = document.activeElement instanceof HTMLElement && !drawer.contains(document.activeElement) ? document.activeElement : null;
  drawer.hidden = false;
  document.documentElement.classList.add('drawer-open');
  selectDrawerTab(name || drawer.dataset.tab, { focusTab: focus });
}

export function closeDrawer() {
  if (!drawer || drawer.hidden) return;
  const hadFocus = drawer.contains(document.activeElement);
  drawer.hidden = true;
  document.documentElement.classList.remove('drawer-open');
  syncExpanded(false);
  if (hadFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}

// Opens the drawer on the tab that contains `target` and brings it into view (links, focus requests).
export function revealInDrawer(target, { focus = true } = {}) {
  const node = typeof target === 'string' ? document.getElementById(target) : target;
  const panel = node?.closest?.('[data-drawer-panel]');
  if (!panel || !drawer?.contains(panel)) return false;
  openDrawer(panel.dataset.drawerPanel, { focus: false });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => {
    node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (focus) {
      if (!node.matches('a,button,input,select,textarea,summary,[tabindex]')) node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    }
  });
  return true;
}

function wireDrawer() {
  drawer = q('#sim-drawer');
  if (!drawer) return;
  drawer.dataset.tab = 'compare';
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-open-drawer]');
    if (trigger) {
      const name = trigger.dataset.openDrawer;
      if (!drawer.hidden && drawer.dataset.tab === name && !trigger.closest('#sim-drawer')) closeDrawer();
      else openDrawer(name);
      return;
    }
    if (event.target.closest?.('[data-drawer-close]')) { closeDrawer(); return; }
    // In-page links whose target lives inside the drawer (e.g. «#analogy-audit» from the landing panel).
    const link = event.target.closest?.('a[href^="#"]');
    if (link && link.getAttribute('href').length > 1) {
      const target = document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      if (target && drawer.contains(target)) { event.preventDefault(); revealInDrawer(target); }
    }
  });
  for (const tab of tabs()) {
    tab.addEventListener('click', () => selectDrawerTab(tab.dataset.drawerTab, { focusTab: true }));
    tab.addEventListener('keydown', (event) => {
      if (!TAB_KEYS.includes(event.key)) return;
      event.preventDefault();
      const list = tabs(), index = list.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      selectDrawerTab(list[next].dataset.drawerTab, { focusTab: true });
    });
  }
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.target.closest('dialog')) { event.stopPropagation(); closeDrawer(); }
  });
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (target && drawer.contains(target)) revealInDrawer(target, { focus: false });
  };
  addEventListener('hashchange', fromHash);
  fromHash();
}

// Weather: one-click chips that drive the existing <select> (its change handler stays in mission.js).
function chipify(select, group) {
  const render = () => {
    const options = [...select.options];
    group.replaceChildren(...options.map((option) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'weather-chip';
      chip.dataset.value = option.value;
      chip.textContent = option.textContent;
      chip.setAttribute('aria-pressed', String(option.value === select.value));
      chip.addEventListener('click', () => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
      return chip;
    }));
    group.hidden = options.length === 0;
  };
  const sync = () => { for (const chip of group.children) chip.setAttribute('aria-pressed', String(chip.dataset.value === select.value)); };
  render();
  // mission.js rebuilds the options and sets .value in the same task; the observer runs after both.
  new MutationObserver(render).observe(select, { childList: true, subtree: true, characterData: true });
  select.addEventListener('change', sync);
  select.hidden = true;
}

function wireWeatherChips() {
  for (const group of qa('[data-chips-for]')) {
    const select = document.getElementById(group.dataset.chipsFor);
    if (select) chipify(select, group);
  }
}

// Top-bar destination switch: Earth = globe view; Moon / Mars = first scenario of that body.
function wireDestinationSwitch() {
  const buttons = qa('[data-dest]');
  if (!buttons.length) return;
  const current = () => {
    const room = q('.control-room');
    if (room?.dataset.mode !== 'scenario') return 'earth';
    return q('#scenario-list .scenario-button[aria-pressed="true"]')?.dataset.body || null;
  };
  const sync = () => { const body = current(); for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.dest === body)); };
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const body = button.dataset.dest;
      if (body === 'earth') { q('#view-globe')?.click(); return; }
      if (current() === body) return;
      const target = q(`#scenario-list .scenario-button[data-body="${body}"]`);
      if (target) target.click();
      else q('#scenario-heading')?.scrollIntoView({ block: 'start' });
    });
  }
  const room = q('.control-room'), list = q('#scenario-list');
  const observer = new MutationObserver(sync);
  if (room) observer.observe(room, { attributes: true, attributeFilter: ['data-mode'] });
  if (list) observer.observe(list, { attributes: true, subtree: true, childList: true, attributeFilter: ['aria-pressed'] });
  sync();
}

// Bottom bar: plain-language key indicators. tone: good | warn | bad | '' ; detail goes to the tooltip/label.
export function setIndicator(key, value, { tone = '', detail = '' } = {}) {
  const button = q(`[data-indicator="${key}"]`);
  if (!button) return;
  const strong = q('[data-indicator-value]', button);
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  if (strong.textContent !== text) strong.textContent = text;
  if (button.dataset.tone !== tone) button.dataset.tone = tone;
  const label = `${q('span', button).textContent}: ${text}${detail ? `. ${detail}` : ''}. Open Compare for details.`;
  if (button.title !== label) { button.title = label; button.setAttribute('aria-label', label); }
}

export function initSimLayout() {
  wireDrawer();
  wireWeatherChips();
  wireDestinationSwitch();
}
