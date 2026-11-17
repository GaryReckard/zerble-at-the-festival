import { createMenuDialog } from './menuUi.js';

// Keep the parent open below child sheets. Its one pause boundary survives
// navigation, while the existing sheets retain their own focus/input lifecycles.
export function createTouchMenu({ settings, upgrades, passport, camera, music, onToggle = () => {} }) {
  const launcher = document.createElement('button');
  launcher.id = 'touch-menu-btn'; launcher.type = 'button';
  launcher.innerHTML = '<span aria-hidden="true">☰</span><span class="launcher-label">Menu</span><span class="touch-menu-new" hidden>NEW</span>';
  launcher.setAttribute('aria-label', 'Open festival menu'); launcher.setAttribute('aria-expanded', 'false');
  const root = document.createElement('div'); root.id = 'touch-menu-overlay'; root.hidden = true;
  root.innerHTML = `<div class="touch-menu-backdrop"></div>
    <section class="touch-menu-panel" role="dialog" aria-modal="true" aria-labelledby="touch-menu-heading">
      <header><h2 id="touch-menu-heading">Take a breather</h2><p>The festival is paused.</p></header>
      <div class="touch-menu-actions">
        <button type="button" data-action="passport">Festival Passport</button>
        <button type="button" data-action="bubbles">Bubble upgrades <span class="touch-menu-bubble-new" hidden>NEW</span></button>
        <button type="button" data-action="settings">Settings</button>
        <button type="button" data-action="camera">Camera view</button>
        <button type="button" data-action="music">Music</button>
      </div>
      <button type="button" class="touch-menu-resume">Resume driving</button>
    </section>`;
  document.body.append(launcher, root); document.body.classList.add('has-touch-menu');
  let lastAction = null, childWasOpen = false, unread = null, viewKey = null;
  const childOpen = () => !!(settings.isOpen() || upgrades.isOpen() || passport.isOpen());
  const dialog = createMenuDialog(root, { focus: '.touch-menu-resume', close });
  function open() {
    if (!root.hidden) return;
    root.hidden = false; update(); dialog.open();
    launcher.setAttribute('aria-expanded', 'true'); onToggle(true);
  }
  function close() {
    if (root.hidden) return;
    root.inert = false; root.removeAttribute('aria-hidden'); root.hidden = true;
    dialog.close(); launcher.setAttribute('aria-expanded', 'false'); onToggle(false);
  }
  function update() {
    const hasNew = !!upgrades.hasUnread();
    if (hasNew !== unread) {
      unread = hasNew;
      launcher.querySelector('.touch-menu-new').hidden = !hasNew;
      root.querySelector('.touch-menu-bubble-new').hidden = !hasNew;
      launcher.setAttribute('aria-label', hasNew ? 'Open festival menu, new bubble upgrades' : 'Open festival menu');
    }
    if (root.hidden) return;
    const child = childOpen();
    if (child !== childWasOpen) {
      root.inert = child;
      if (child) root.setAttribute('aria-hidden', 'true'); else root.removeAttribute('aria-hidden');
      if (!child) lastAction?.focus({ preventScroll: true });
    }
    childWasOpen = child;
    const label = camera.label(), busy = music.busy(), playing = music.playing();
    const key = `${label}:${busy}:${playing}`;
    if (key !== viewKey) {
      viewKey = key;
      root.querySelector('[data-action="camera"]').textContent = `Camera: ${label}`;
      root.querySelector('[data-action="music"]').textContent = busy ? 'Music is loading…' : `Music: ${playing ? 'on' : 'off'}`;
      root.querySelector('[data-action="music"]').disabled = busy;
    }
  }
  launcher.addEventListener('click', open);
  root.querySelector('.touch-menu-resume').addEventListener('click', close);
  root.querySelector('.touch-menu-backdrop').addEventListener('click', close);
  // Wheel zoom is bound to window independently of the main pause branch.
  root.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  root.querySelector('.touch-menu-actions').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || childOpen() || button.disabled) return;
    lastAction = button; button.focus({ preventScroll: true });
    const action = button.dataset.action;
    if (action === 'passport') passport.open();
    else if (action === 'bubbles') upgrades.open({ paused: true });
    else if (action === 'settings') settings.open();
    else { close(); if (action === 'camera') camera.toggle(); else if (action === 'music') music.toggle(); }
    update();
  });
  update();
  return { open, close, update, isOpen: () => !root.hidden, root, launcher };
}
