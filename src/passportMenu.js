import { PASSPORT_STAMPS } from './playerStats.js';

const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const formatCount = n => n >= 1e9 ? compact.format(n) : integer.format(n);
export function formatPassportDistance(n) {
  return n >= 1000 ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n / 1000)} km` : `${integer.format(Math.floor(n))} m`;
}
const duration = n => n < 60 ? `${Math.floor(n)} s` : n >= 3600 ? `${Math.floor(n / 3600)} h ${Math.floor(n % 3600 / 60)} min` : `${Math.floor(n / 60)} min`;

export function createPassportMenu() {
  let stats, overlay, previousFocus, scope = 'visit', options = {};
  const background = new Map();
  const isOpen = () => !!overlay && !overlay.hidden;
  function render() {
    if (!stats || !overlay) return;
    const state = stats.snapshot(), selected = scope === 'visit' ? state.visit : state.allTime;
    overlay.querySelectorAll('[data-scope]').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.scope === scope));
      button.tabIndex = button.dataset.scope === scope ? 0 : -1;
    });
    const panel = overlay.querySelector('[role="tabpanel"]');
    panel.setAttribute('aria-labelledby', `passport-tab-${scope}`);
    const rows = [
      ...(scope === 'visit' ? [['From the entrance', formatPassportDistance(selected.currentDistance)]] : []),
      ['Farthest adventure', formatPassportDistance(selected.farthest)],
      ['Distance driven', formatPassportDistance(selected.distance)],
      ['Smiles collected', formatCount(selected.smiles), integer.format(selected.smiles)],
      ['Bubbles blown', formatCount(selected.bubbles), integer.format(selected.bubbles)],
      ['Stages visited', formatCount(selected.stages), integer.format(selected.stages)],
      ['Passengers welcomed', formatCount(selected.passengers), integer.format(selected.passengers)],
      ['Bonks', formatCount(selected.bonks), integer.format(selected.bonks)],
      ['Time at the festival', duration(selected.activeSeconds)],
    ];
    const list = overlay.querySelector('.passport-stats');
    list.replaceChildren();
    for (const [label, value, exact] of rows) {
      const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value;
      if (exact) { detail.title = exact; detail.setAttribute('aria-label', exact); }
      row.append(term, detail); list.append(row);
    }
    overlay.querySelector('.passport-note').textContent = !state.started && scope === 'visit'
      ? 'Choose a mode to begin your next visit. Your all-time memories are already here.'
      : scope === 'visit'
        ? 'A fresh game starts a new visit. A settings restart keeps this one.'
        : 'Saved in this browser. Earlier smiles are included; other memories begin with your passport.';
    overlay.querySelector('.passport-storage').textContent = state.storageOK
      ? 'Your memories stay in this browser. Clearing site data clears the passport; it does not sync between devices.'
      : 'Saving is unavailable. These memories last until this page closes; enable browser storage to keep them.';
    const relocated = overlay.querySelector('.passport-relocated');
    relocated.hidden = state.explorationEligible;
    relocated.textContent = 'You were relocated during this visit. Distance driven still counts, but exploration records and new stage visits resume with your next visit.';
    const stampList = overlay.querySelector('.passport-stamps');
    stampList.replaceChildren();
    let count = 0;
    for (const stamp of PASSPORT_STAMPS) {
      const earned = !!state.stamps[stamp.id];
      if (earned) count++;
      const card = document.createElement('li');
      card.className = 'passport-stamp' + (earned ? ' is-earned' : '');
      const icon = document.createElement('span');
      icon.className = 'passport-stamp-icon'; icon.textContent = stamp.icon; icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('strong'); name.textContent = stamp.name;
      const status = document.createElement('span'); status.className = 'passport-stamp-status'; status.textContent = earned ? 'Stamped' : 'Still to discover';
      const hint = document.createElement('p'); hint.textContent = stamp.hint;
      card.append(icon, name, status, hint); stampList.append(card);
    }
    overlay.querySelector('.passport-stamp-count').textContent = `${count} of ${PASSPORT_STAMPS.length} memories stamped · All time`;
  }
  function close() {
    if (!isOpen()) return;
    overlay.hidden = true;
    for (const [element, wasInert] of background) element.inert = wasInert;
    background.clear();
    document.body.classList.remove('passport-reading');
    options.onToggle?.(false);
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function open() {
    if (!overlay || isOpen()) return;
    options.beforeOpen?.();
    previousFocus = document.activeElement;
    scope = stats.snapshot().started ? 'visit' : 'allTime';
    render();
    for (const element of document.body.children) {
      if (element === overlay || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue;
      background.set(element, element.inert); element.inert = true;
    }
    overlay.hidden = false;
    document.body.classList.add('passport-reading');
    options.onToggle?.(true);
    overlay.querySelector('.passport-panel').focus();
    options.onOpen?.();
  }
  return {
    init(playerStats, callbacks = {}) {
      if (overlay) return;
      stats = playerStats; options = callbacks;
      const button = document.createElement('button');
      button.id = 'passport-btn'; button.type = 'button'; button.setAttribute('aria-label', 'Open Festival Passport');
      button.title = 'Festival Passport (P)';
      button.innerHTML = '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M5 3h13v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M6 3v18 M10 8h5 M10 12h5 M10 16h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.append(button);
      overlay = document.createElement('div'); overlay.id = 'passport-overlay'; overlay.hidden = true;
      overlay.innerHTML = `
        <div class="passport-backdrop"></div>
        <section class="passport-panel" role="dialog" aria-modal="true" aria-labelledby="passport-heading" aria-describedby="passport-intro" tabindex="-1">
          <button class="passport-close" type="button" aria-label="Close Festival Passport"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
          <p class="passport-eyebrow">A little record of a lovely time</p>
          <h2 id="passport-heading">Festival Passport</h2>
          <p id="passport-intro">The places you wandered. The smiles you brought.</p>
          <p class="passport-pause-note">Gameplay pauses while your passport is open.</p>
          <div class="passport-body"><div class="passport-records">
          <div class="passport-tabs" role="tablist" aria-label="Passport statistics">
            <button type="button" id="passport-tab-visit" role="tab" data-scope="visit" aria-controls="passport-stat-panel">This visit</button>
            <button type="button" id="passport-tab-allTime" role="tab" data-scope="allTime" aria-controls="passport-stat-panel">All time</button>
          </div>
          <div id="passport-stat-panel" role="tabpanel" tabindex="0"><dl class="passport-stats"></dl><p class="passport-note"></p></div>
          <p class="passport-definitions">Smiles count pickups before score bonuses. Distances follow the ground plane, and stages count once per festival layout.</p>
          <p class="passport-relocated" hidden></p>
          </div><div class="passport-memories">
          <h3>Festival memories</h3><p class="passport-stamp-count"></p><ul class="passport-stamps"></ul>
          </div></div>
          <p class="passport-storage" role="status"></p>
        </section>`;
      document.body.append(overlay);
      button.addEventListener('click', open);
      document.getElementById('passport-open-title')?.addEventListener('click', open);
      overlay.querySelector('.passport-close').addEventListener('click', close);
      overlay.querySelector('.passport-backdrop').addEventListener('click', close);
      overlay.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
      overlay.querySelector('.passport-tabs').addEventListener('click', event => {
        const tab = event.target.closest('[data-scope]');
        if (tab) { scope = tab.dataset.scope; render(); }
      });
      window.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (!isOpen()) {
          if (key !== 'p' || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target?.closest?.('input, textarea, select, [contenteditable], [role="dialog"]')) return;
          if (!document.body.classList.contains('game-started') && document.getElementById('passport-open-title')?.disabled !== false) return;
          event.preventDefault(); event.stopImmediatePropagation(); open(); return;
        }
        event.stopImmediatePropagation();
        if (key === 'escape' || key === 'p') { event.preventDefault(); if (!event.repeat) close(); return; }
        if (event.target?.matches('[data-scope]') && ['arrowleft', 'arrowright', 'home', 'end'].includes(key)) {
          event.preventDefault(); scope = key === 'home' ? 'visit' : key === 'end' ? 'allTime' : scope === 'visit' ? 'allTime' : 'visit';
          render(); overlay.querySelector(`[data-scope="${scope}"]`).focus(); return;
        }
        if (key !== 'tab') return;
        const focusable = [...overlay.querySelectorAll('button, [tabindex="0"]')].filter(el => el.tabIndex >= 0);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay.querySelector('.passport-panel'))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }, true);
    },
    open, close, isOpen, refresh: render,
  };
}

export const PassportMenu = createPassportMenu();
