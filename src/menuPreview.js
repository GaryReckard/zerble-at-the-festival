// Local, renderer-free verification of actual production DOM and modules.
// No scores are submitted, and passport/upgrade progress uses memory only.
import markup from '../index.html?raw';
const source = new DOMParser().parseFromString(markup, 'text/html');
for (const id of ['title-card', 'score-screen', 'hud', 'rotate-phone']) document.body.append(source.getElementById(id));
import { initTitleScene } from './titleScene.js';
initTitleScene();
const [{ HUD }, { Settings }, { createPlayerStats }, { createPassportMenu }, { createBubbleProgress }, { UpgradesMenu }] = await Promise.all([
  import('./hud.js'), import('./settings.js'), import('./playerStats.js'),
  import('./passportMenu.js'), import('./bubbleProgress.js'), import('./upgradesMenu.js'),
]);
const flags = new URLSearchParams(location.search);
const stats = createPlayerStats({ get: () => null, set: () => { if (flags.has('blocked')) throw Error('Fixture: storage unavailable'); } });
stats.start({ entrance: { x: 0, z: 0 }, worldSeed: 1977 });
stats.record('smiles', 243); stats.record('bubbles', 12840); stats.record('passengers', 8); stats.flush();
const passport = createPassportMenu(); passport.init(stats, { beforeOpen: () => { Settings.close(); UpgradesMenu.close(); } });
const progress = createBubbleProgress({ get: () => null, set() {} });
if (!flags.has('locked')) for (const id of ['heart', 'firefly', 'sparkler', 'smile', 'confetti']) progress.unlock(id, 'debug');
UpgradesMenu.init(progress);
Settings.init({ festivalMap: { compact: true, setCompact(on) { this.compact = on; }, async reset() {} } });
HUD.onStart(() => { document.body.classList.add('game-started'); document.getElementById('title-card').classList.add('hidden'); });
document.getElementById('boot-copy').textContent = 'Bubble pressure: magnificent.';
document.getElementById('boot-copy').classList.add('is-done');
const toolbar = document.createElement('div'); toolbar.className = 'fixture-controls';
toolbar.innerHTML = 'UI fixture · no running world <button id="fixture-results">Sample results</button><button id="fixture-new">New discovery</button><button id="fixture-return">Title</button>';
document.body.append(toolbar);
const results = () => HUD.showScoreScreen({ cause: 'Zerble ran dry on Day 3…', score: 245, days: 3, bestCombo: 4, highlightRank: 1, board: flags.has('empty') ? [] : [{ name: 'Sample Zerbler', score: 245, days: 3 }, { name: 'Bubble Friend', score: 180, days: 2 }] });
toolbar.querySelector('#fixture-results').onclick = results;
toolbar.querySelector('#fixture-new').onclick = () => UpgradesMenu.markUnread();
toolbar.querySelector('#fixture-return').onclick = () => location.reload();
if (flags.has('new')) UpgradesMenu.markUnread();
const screen = flags.get('screen');
if (screen === 'results') results();
if (screen === 'settings') Settings.open();
if (screen === 'passport') passport.open();
if (screen === 'upgrades') UpgradesMenu.open();
if (screen === 'loading' || screen === 'failed') {
  document.getElementById('title-card').dataset.load = screen;
  for (const id of ['mode-cruisin', 'mode-festival', 'settings-open-title', 'passport-open-title', 'upgrades-open-title']) {
    const el = document.getElementById(id); el.disabled = true; el.classList.remove('is-ready'); el.setAttribute('aria-disabled', 'true');
  }
  const copy = document.getElementById('boot-copy'); copy.classList.remove('is-done');
  copy.textContent = screen === 'failed' ? 'The festival could not finish loading.' : 'Pressurizing the bubble tank…';
  document.getElementById('boot-retry').hidden = screen !== 'failed';
}
