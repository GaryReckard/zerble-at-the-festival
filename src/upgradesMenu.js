import { Analytics } from './analytics.js';
import { CHARM, charmLevel, visibleCatalog } from './bubbleTypes.js';

let progress = null;
let overlay = null;
let button = null;
let previousFocus = null;
let unread = false;
const UNREAD_KEY = 'zerble.upgradesUnread';

function saveUnread(on) {
  try {
    if (on) localStorage.setItem(UNREAD_KEY, '1');
    else localStorage.removeItem(UNREAD_KEY);
  } catch { /* the in-memory dot still works when storage is blocked */ }
}

function render() {
  if (!overlay || !progress) return;
  const catalog = visibleCatalog(progress.earnedIds());
  const level = charmLevel(catalog.found);
  overlay.querySelector('.upgrades-summary').textContent =
    `${catalog.found} of ${catalog.total} found · Bubble charm +${Math.round(level * CHARM.perUpgrade * 100)}%`;
  const list = overlay.querySelector('.upgrades-list');
  list.replaceChildren();
  for (const type of catalog.entries) {
    const earned = progress.isEarned(type.id);
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (earned ? ' is-earned' : ' is-locked');
    card.dataset.upgrade = type.id;

    const swatch = document.createElement('span');
    swatch.className = 'upgrade-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    if (earned) {
      const hex = `#${type.look.tint.toString(16).padStart(6, '0')}`;
      swatch.style.setProperty('--upgrade-color', hex);
    }
    card.appendChild(swatch);

    const copy = document.createElement('div');
    copy.className = 'upgrade-copy';
    const name = document.createElement('strong');
    name.textContent = type.name;
    const detail = document.createElement('span');
    detail.textContent = earned ? (type.earnedLine || type.hint) : type.hint;
    copy.append(name, detail);
    card.appendChild(copy);

    if (earned) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'upgrade-toggle';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-label', `${type.name} in the bubble stream`);
      toggle.setAttribute('aria-checked', String(progress.isEnabled(type.id)));
      toggle.dataset.toggle = type.id;
      toggle.innerHTML = '<span aria-hidden="true"></span>';
      card.appendChild(toggle);
    } else {
      const lock = document.createElement('span');
      lock.className = 'upgrade-lock';
      lock.setAttribute('role', 'img');
      lock.setAttribute('aria-label', 'Locked');
      lock.textContent = '🔒';
      card.appendChild(lock);
    }
    list.appendChild(card);
  }
}

export const UpgradesMenu = {
  init(bubbleProgress) {
    progress = bubbleProgress;
    try { unread = localStorage.getItem(UNREAD_KEY) === '1'; } catch { unread = false; }
    const title = document.getElementById('upgrades-open-title');
    button = document.createElement('button');
    button.id = 'upgrades-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open bubble upgrades');
    button.innerHTML = '<span aria-hidden="true">♡</span><span class="upgrades-unread" aria-hidden="true"></span>';
    button.classList.toggle('has-unread', unread);
    document.body.appendChild(button);

    overlay = document.createElement('div');
    overlay.id = 'upgrades-overlay';
    overlay.className = 'hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="upgrades-backdrop"></div>
      <div class="upgrades-panel" role="dialog" aria-modal="true" aria-labelledby="upgrades-heading" tabindex="-1">
        <button class="upgrades-close" type="button" aria-label="Close bubble upgrades">&times;</button>
        <div class="settings-accent"></div>
        <h2 id="upgrades-heading">Bubble Upgrades</h2>
        <p class="upgrades-summary"></p>
        <div class="upgrades-list"></div>
      </div>`;
    document.body.appendChild(overlay);
    title?.addEventListener('click', () => this.open());
    button.addEventListener('click', () => this.open());
    overlay.querySelector('.upgrades-close').addEventListener('click', () => this.close());
    overlay.querySelector('.upgrades-backdrop').addEventListener('click', () => this.close());
    overlay.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    overlay.querySelector('.upgrades-list').addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      const id = toggle.dataset.toggle;
      if (progress.setEnabled(id, !progress.isEnabled(id))) {
        Analytics.featureUsed('upgrade_toggle');
        render();
        overlay.querySelector(`[data-toggle="${id}"]`)?.focus();
      }
    });
    overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape' || event.key.toUpperCase() === 'U') { event.preventDefault(); this.close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll('button:not([disabled])'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    render();
  },

  open() {
    if (!overlay || !overlay.classList.contains('hidden')) return;
    previousFocus = document.activeElement;
    render();
    this.clearUnread();
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.querySelector('.upgrades-close').focus();
    Analytics.upgradesMenuOpen();
  },

  close() {
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  },

  markUnread() {
    if (overlay && !overlay.classList.contains('hidden')) { render(); return; }
    unread = true;
    saveUnread(true);
    button?.classList.add('has-unread');
  },

  clearUnread() {
    unread = false;
    saveUnread(false);
    button?.classList.remove('has-unread');
  },

  refresh() { render(); },
  isOpen() { return !!overlay && !overlay.classList.contains('hidden'); },
  hasUnread() { return unread; },
};
