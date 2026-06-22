// Player-facing Settings panel — graphics quality, effect overrides, and
// volume. The SEOMatic "override" model: the game auto-detects a tier and a
// runtime governor (AdaptiveQuality) keeps it smooth; the player can pin their
// own quality and take manual control of effects, and the choices persist.
//
// This is the PLAYER surface. The dev-only backtick overlay (debug.js) stays
// hidden and keeps its god/collider/budget tools — only the perceptual quality
// + audio knobs cross over here.
//
// Three kinds of control, by how they apply:
//   * Live, instant      — Quality mode (governor on/off), Glow, Detailed
//                          bubbles, the volume sliders.
//   * Reload to apply     — Graphics quality tier (PERF is baked at boot),
//                          Shadows + extra lights (boot flags; a live shadow
//                          walk decays as new chunks stream in). These persist
//                          immediately; the shared "Apply & restart" button
//                          reloads when any differs from what booted.

import { PERF, DETECTED_TIER } from './perf.js';
import * as AdaptiveQuality from './adaptiveQuality.js';
import { Sound } from './sound.js';

const K = {
  tier: 'zerble.perfOverride',
  adaptive: 'zerble.gfx.adaptive',
  bloom: 'zerble.gfx.bloom',
  detailBubbles: 'zerble.gfx.detailBubbles',
  shadows: 'zerble.gfx.shadows',
  context: 'zerble.contextLights',
  fancy: 'zerble.fancyLights',
};

const TIER_LABEL = { low: 'Low', mid: 'Medium', high: 'High' };
const TIER_RANK = { low: 1, mid: 2, high: 3 };
// Per-bus slider ceiling — 100% maps to this gain. Picked so the restored
// defaults (master 0.55, music ~1.2, sfx 1.0) land at sensible mid positions.
const VOL_MAX = { master: 1.0, music: 1.6, sfx: 1.5 };

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

let refs = null;       // { bubbles }
let bootSnap = null;   // reload-required settings as they booted
let $overlay = null;

export const Settings = {
  // Called once at boot, AFTER AdaptiveQuality.install(). Applies any persisted
  // overrides, then builds + wires the UI.
  init(opts) {
    refs = opts || {};
    this.applyBootOverrides();
    bootSnap = {
      tier: lsGet(K.tier) || 'auto',
      shadows: !!PERF.shadows,
      context: !!PERF.contextLights,
      fancy: !!PERF.fancyLights,
    };
    this._build();
    this._wire();
  },

  // Re-apply the persisted LIVE overrides at boot. The reload-required ones
  // (tier, shadows, lights) are already baked by perf.js reading localStorage;
  // this handles the governor + its live knobs.
  applyBootOverrides() {
    if (lsGet(K.adaptive) === '0') {
      AdaptiveQuality.setEnabled(false);
      const b = lsGet(K.bloom);
      if (b !== null) AdaptiveQuality.setBloomAllowed(b === '1');
      const db = lsGet(K.detailBubbles);
      if (db !== null && refs.bubbles?.setCheapMaterial) {
        refs.bubbles.setCheapMaterial(db === '0');   // detail off → cheap material
      }
    }
  },

  open() { if ($overlay) { this._sync(); $overlay.classList.remove('hidden'); } },
  close() { if ($overlay) $overlay.classList.add('hidden'); },

  _build() {
    // In-game gear (hidden until game-started, like the touch overlay).
    const gear = document.createElement('button');
    gear.id = 'settings-gear';
    gear.setAttribute('aria-label', 'Open settings');
    gear.innerHTML = GEAR_SVG;
    document.body.appendChild(gear);

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
      <div class="settings-backdrop"></div>
      <div class="settings-card" role="dialog" aria-modal="true" aria-label="Settings">
        <button class="settings-close" aria-label="Close settings">&times;</button>
        <div class="settings-accent"></div>
        <div class="settings-eyebrow">Settings</div>
        <h2 class="settings-title">Graphics &amp; sound</h2>
        <p class="settings-sub">Auto matches your device. Pin your own if you'd rather, or take manual control of the fancy bits.</p>

        <div class="settings-section">
          <div class="settings-section-label">Graphics quality</div>
          <div id="set-quality" role="radiogroup" aria-label="Graphics quality">
            ${tierRow('auto', 'Auto')}
            ${tierRow('low', 'Low')}
            ${tierRow('mid', 'Medium')}
            ${tierRow('high', 'High')}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-label">Effects</div>
          <div id="set-mode" role="radiogroup" aria-label="Effects mode" class="settings-modeswitch">
            <button class="settings-mode" data-mode="auto">Auto<span>keeps it smooth</span></button>
            <button class="settings-mode" data-mode="custom">Custom<span>I'll choose</span></button>
          </div>
          <div id="set-effects" class="settings-effects">
            ${toggleRow('set-glow', 'Glow', 'soft light bloom at night')}
            ${toggleRow('set-bubbles', 'Detailed bubbles', 'shinier, costlier bubbles')}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-label">Advanced <span class="settings-reload-note">reload to apply</span></div>
          ${toggleRow('set-shadows', 'Shadows', 'cast shadows on the ground')}
          ${toggleRow('set-context', 'Warm extra lights', 'firepits &amp; lamps glow for real')}
          ${toggleRow('set-fancy', 'Extra detail lights', 'every torch &amp; bulb — heaviest')}
        </div>

        <div class="settings-section">
          <div class="settings-section-label">Sound</div>
          ${sliderRow('set-vol-master', 'Master')}
          ${sliderRow('set-vol-music', 'Music')}
          ${sliderRow('set-vol-sfx', 'Sound effects')}
        </div>

        <div class="settings-foot">
          <button class="settings-apply" disabled>Apply &amp; restart</button>
          <div class="settings-apply-note">Saved instantly. A reload applies quality, shadows &amp; lights.</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $overlay = overlay;
  },

  _wire() {
    const $ = (s) => $overlay.querySelector(s);
    const gear = document.getElementById('settings-gear');
    const titleTrigger = document.getElementById('settings-open-title');
    if (gear) gear.addEventListener('click', () => this.open());
    if (titleTrigger) titleTrigger.addEventListener('click', () => this.open());
    $('.settings-close').addEventListener('click', () => this.close());
    $('.settings-backdrop').addEventListener('click', () => this.close());

    // --- Graphics quality (reload) ---
    $('#set-quality').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'auto') lsDel(K.tier); else lsSet(K.tier, v);
      this._refreshApply();
    });

    // --- Effects mode (live) ---
    $('#set-mode').addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-mode');
      if (!btn) return;
      this._setMode(btn.dataset.mode);
    });

    // --- Glow (live, via the bloom-allow flag main.js honors) ---
    $('#set-glow').addEventListener('change', (e) => {
      AdaptiveQuality.setBloomAllowed(e.target.checked);
      lsSet(K.bloom, e.target.checked ? '1' : '0');
    });

    // --- Detailed bubbles (live material swap) ---
    $('#set-bubbles').addEventListener('change', (e) => {
      refs.bubbles?.setCheapMaterial?.(!e.target.checked);
      lsSet(K.detailBubbles, e.target.checked ? '1' : '0');
    });

    // --- Advanced (reload boot flags) ---
    $('#set-shadows').addEventListener('change', (e) => {
      lsSet(K.shadows, e.target.checked ? '1' : '0');
      this._refreshApply();
    });
    $('#set-context').addEventListener('change', (e) => {
      lsSet(K.context, e.target.checked ? '1' : '0');
      this._refreshApply();
    });
    $('#set-fancy').addEventListener('change', (e) => {
      lsSet(K.fancy, e.target.checked ? '1' : '0');
      this._refreshApply();
    });

    // --- Volume (live, Sound persists itself) ---
    bindSlider($('#set-vol-master'), 'master', (v) => Sound.setMasterVolume(v));
    bindSlider($('#set-vol-music'), 'music', (v) => Sound.setMusicVolume(v));
    bindSlider($('#set-vol-sfx'), 'sfx', (v) => Sound.setSfxVolume(v));

    // --- Apply & restart ---
    $('.settings-apply').addEventListener('click', () => {
      if (!$('.settings-apply').disabled) location.reload();
    });
  },

  _setMode(mode) {
    const custom = mode === 'custom';
    if (custom) {
      AdaptiveQuality.setEnabled(false);
      lsSet(K.adaptive, '0');
      // Apply the panel's current glow/bubble choices the moment we take over.
      const glow = $overlay.querySelector('#set-glow').checked;
      const detail = $overlay.querySelector('#set-bubbles').checked;
      AdaptiveQuality.setBloomAllowed(glow);
      refs.bubbles?.setCheapMaterial?.(!detail);
      lsSet(K.bloom, glow ? '1' : '0');
      lsSet(K.detailBubbles, detail ? '1' : '0');
    } else {
      AdaptiveQuality.setEnabled(true);
      lsDel(K.adaptive);
      // Hand the live knobs back to the governor at its current level.
      AdaptiveQuality.applyLevel(AdaptiveQuality.getLevel());
    }
    this._syncMode(custom);
  },

  // Reflect the live/persisted state into the controls. Run every time the
  // panel opens so it never shows stale values.
  _sync() {
    const $ = (s) => $overlay.querySelector(s);
    // Quality tier
    const tier = lsGet(K.tier) || 'auto';
    const r = $(`#set-quality input[value="${tier}"]`);
    if (r) r.checked = true;
    $('#set-quality-detected').textContent = 'detected: ' + (TIER_LABEL[DETECTED_TIER] || 'Low');
    // Mode + effects
    this._syncMode(lsGet(K.adaptive) === '0');
    $('#set-glow').checked = AdaptiveQuality.bloomAllowed();
    $('#set-bubbles').checked = lsGet(K.detailBubbles) !== '0';
    // Advanced (booted state)
    $('#set-shadows').checked = !!PERF.shadows;
    $('#set-context').checked = !!PERF.contextLights;
    $('#set-fancy').checked = !!PERF.fancyLights;
    // Volume
    setSlider($('#set-vol-master'), Sound.getMasterVolume(), 'master');
    setSlider($('#set-vol-music'), Sound.getMusicVolume(), 'music');
    setSlider($('#set-vol-sfx'), Sound.getSfxVolume(), 'sfx');
    this._refreshApply();
  },

  _syncMode(custom) {
    const $ = (s) => $overlay.querySelector(s);
    $('#set-effects').classList.toggle('is-locked', !custom);
    $('#set-glow').disabled = !custom;
    $('#set-bubbles').disabled = !custom;
    $overlay.querySelectorAll('.settings-mode').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === (custom ? 'custom' : 'auto'));
    });
  },

  _refreshApply() {
    const $ = (s) => $overlay.querySelector(s);
    const tierNow = ($('#set-quality input:checked') || {}).value || 'auto';
    const pending =
      tierNow !== bootSnap.tier ||
      $('#set-shadows').checked !== bootSnap.shadows ||
      $('#set-context').checked !== bootSnap.context ||
      $('#set-fancy').checked !== bootSnap.fancy;
    $('.settings-apply').disabled = !pending;
  },
};

// ---- DOM template helpers ----

function tierRow(value, label) {
  const warn = value !== 'auto' && TIER_RANK[value] > TIER_RANK[DETECTED_TIER];
  const chip = value === 'auto'
    ? `<span class="settings-chip" id="set-quality-detected">detected: Low</span>` : '';
  const warnEl = warn
    ? `<div class="settings-warn"><span class="settings-warn-ico">&#9888;</span> may run slower on this device</div>` : '';
  return `
    <label class="settings-radio">
      <input type="radio" name="set-quality" value="${value}">
      <span class="settings-dot"></span>
      <span class="settings-radio-body">
        <span class="settings-radio-head"><span class="settings-radio-label">${label}</span>${chip}</span>
        ${warnEl}
      </span>
    </label>`;
}

function toggleRow(id, label, sub) {
  return `
    <label class="settings-toggle-row">
      <span class="settings-toggle-body">
        <span class="settings-toggle-label">${label}</span>
        <span class="settings-toggle-sub">${sub}</span>
      </span>
      <input type="checkbox" id="${id}" class="settings-switch">
    </label>`;
}

function sliderRow(id, label) {
  return `
    <div class="settings-slider-row">
      <span class="settings-slider-label">${label}</span>
      <input type="range" id="${id}" min="0" max="100" value="60" class="settings-slider">
    </div>`;
}

function bindSlider(input, bus, apply) {
  input.addEventListener('input', () => {
    const pct = Number(input.value) / 100;
    apply(pct * VOL_MAX[bus]);
  });
}

function setSlider(input, gain, bus) {
  const pct = Math.round((gain / VOL_MAX[bus]) * 100);
  input.value = String(Math.max(0, Math.min(100, pct)));
}

const GEAR_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
