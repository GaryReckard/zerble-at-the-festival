import { Input } from './input.js';

// Shared keyboard ownership without pausing the simulation. Passport retains
// its separate pause/inert lifecycle; this helper owns only its registered sheet.
const openMenus = [];
export function createMenuDialog(root, { focus, close, dismissible = true, shortcut, beforeEscape, clearInput = true } = {}) {
  let opener = null;
  const visibleControls = () => [...root.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')]
    .filter(el => el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[hidden], .is-hidden'));
  const onKey = event => {
    if (openMenus.at(-1) !== api) return;
    const key = event.key.toLowerCase();
    // Let keyup reach Input so a key held before opening cannot stick.
    event.stopPropagation();
    if (key === 'escape' || (shortcut && key === shortcut && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.matches('input, textarea, select'))) {
      event.preventDefault();
      if (!event.repeat && !beforeEscape?.() && dismissible) close?.();
    } else if (key === 'tab') {
      const controls = visibleControls(), first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (!root.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  const api = {
    open() {
      if (openMenus.includes(api)) return;
      opener = document.activeElement;
      if (clearInput) Input.clear();
      openMenus.push(api);
      document.addEventListener('keydown', onKey);
      const target = root.querySelector(focus) || visibleControls()[0];
      target?.focus({ preventScroll: true });
      // A sheet opened from display/visibility:none may not accept focus until
      // layout settles. Do not steal focus if it has already moved inside.
      if (target && !root.contains(document.activeElement)) requestAnimationFrame(() => {
        if (openMenus.at(-1) === api && !root.contains(document.activeElement)) target.focus({ preventScroll: true });
      });
    },
    close() {
      const i = openMenus.indexOf(api);
      if (i < 0) return;
      openMenus.splice(i, 1);
      document.removeEventListener('keydown', onKey);
      if (clearInput) Input.clear();
      if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
      opener = null;
    },
  };
  return api;
}

export function initHelpControls(root) {
  if (!root) return;
  const scheme = root.querySelector('.controls-scheme');
  if (!scheme) return;
  function select(value) {
    root.dataset.scheme = value;
    scheme.querySelectorAll('[data-scheme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scheme === value)));
  }
  select(document.body.classList.contains('is-touch') || matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard');
  scheme.addEventListener('click', event => {
    const button = event.target.closest('[data-scheme]');
    if (button) select(button.dataset.scheme);
  });
}
