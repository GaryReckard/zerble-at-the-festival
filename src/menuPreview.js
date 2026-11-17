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
const { createQuestLog } = await import('./quests/questLog.js');
const questLog = createQuestLog({ getItem: () => null, setItem() { if (flags.has('blocked')) throw Error('Storage unavailable'); } });
if (!flags.has('empty')) for (const [type, kind, label, reward] of [['normal', 'stage', 'Willow Stage', 9], ['urgent', 'potty', 'Porta-potties', 14], ['party', 'camp', 'The camp', 12]]) questLog.record({ type, kind, label, reward });
const passport = createPassportMenu(); passport.init(stats, { questLog, beforeOpen: () => { Settings.close(); UpgradesMenu.close(); } });
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
if (screen === 'brakes' || screen === 'touch' || screen === 'rides') {
  // Real input/parking/HUD without a second WebGL world. Native slope behavior
  // is covered by the physical driving course and test-vehicle-braking.
  document.body.append(source.getElementById('touch-controls'));
  document.body.classList.add('game-started');
  if (flags.has('touch')) document.body.classList.add('is-touch');
  document.getElementById('touch-controls').setAttribute('aria-hidden', 'false');
  document.getElementById('title-card').classList.add('hidden');
  const canvas = document.createElement('canvas'); canvas.id = 'game'; document.body.append(canvas);
  const [{Input},{Touch},{createDrivingControls},{createTouchMenu},{FestivalMap},{CONFIG}] = await Promise.all([
    import('./input.js'), import('./touch.js'), import('./drivingControls.js'), import('./touchMenu.js'),
    import('./festivalMap/view.js'), import('./worldgen/constants.js'),
  ]);
  Touch.install({ force: flags.has('touch') });
  const map = new FestivalMap({seed:1977,config:CONFIG,preview:true,namespace:'touch-comfort-preview'});
  map.compact = true; map.host.hidden = false; map.measure();
  let cameraView = 'Chase view', musicPlaying = false;
  const menu = createTouchMenu({
    settings:Settings,upgrades:UpgradesMenu,passport,
    camera:{label:()=>cameraView,toggle:()=>{cameraView=cameraView==='Chase view'?'First-person view':'Chase view';}},
    music:{playing:()=>musicPlaying,busy:()=>false,toggle:()=>{musicPlaying=!musicPlaying;}},
    onToggle:()=>Input.clear(),
  });
  const controls = createDrivingControls(), cart = { speed: 0, position: { x: 0, z: 0 } };
  const readout = document.createElement('output'); readout.id = 'brake-readout'; toolbar.append(readout);
  toolbar.style.bottom = 'auto'; toolbar.style.top = '90px';
  function frame() {
    menu.update();
    if (menu.isOpen() || passport.isOpen()) { requestAnimationFrame(frame); return; }
    const state = controls.update(Input, cart, Input.consumePressed('R'));
    Touch.updateParking(state); HUD.setParking(state.parked);
    cart.speed = state.input.throttle * 4;
    map.tick({player:cart.position,heading:0,live:[],dt:1/60});
    readout.textContent = ` · ${state.parked ? 'Parked' : state.input.brake ? 'Braking' : cart.speed ? 'Driving' : 'Coasting'}${Input.consumePressed('E') ? ' · Honk' : ''}`;
    requestAnimationFrame(frame);
  }
  frame();
}
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

if (screen === 'rides') {
  // Combined production controls, map, sidebar and toast, including short
  // landscape, long destination names and all three simultaneous requests.
  const [{QuestCompass},{iconDataURL}] = await Promise.all([import('./questHud.js'), import('./models/questBubble.js')]);
  const compass = new QuestCompass(document.getElementById('quest-strip'), {iconURL:iconDataURL, onPick:id=>HUD.toast(`Selected sample passenger ${id}`,1600)});
  const rides = [
    {id:1,kind:'hammock',short:'Hammocks',icon:'hammock',x:0,z:-180,dist:180,radius:25,warmth:.5,type:'ride'},
    {id:2,kind:'porta_potty',short:'Potty!!!',icon:'potty',x:120,z:0,dist:120,radius:16,warmth:.3,type:'urgent',timeLeft:39},
    {id:3,kind:'camp_village',short:'My camp',icon:'camp',x:-80,z:-80,dist:113,radius:40,warmth:.2,type:'ride'},
  ];
  if (flags.get('case') === 'arrival') {
    rides[0].arrivalTarget={x:0,z:0,radius:25};
    rides[1].phase='handoff';
    rides[2].kind='hammock';rides[2].icon='hammock';rides[2].x=0;rides[2].z=0;rides[2].dist=0;rides[2].arrivalBlocked='occupied';
  }
  if (flags.get('case') === 'approach') {
    rides[0].blockedTarget={x:0,z:0,radius:25,approaching:true};
    rides[0].arrivalBlocked='occupied';
  }
  if (flags.has('long')) rides[2].short = 'Our friends at the far end of Mountain Top camping';
  compass.sync(flags.has('single') ? rides.slice(0,1) : rides, {x:0,z:0,heading:0,speed:0});
  HUD.toast(flags.has('long') ? 'Someone is flagging you down. Pull up beside them and stop to give them a lift!' : '💭 “Whenever you are ready, driver.”', 600000);
  toolbar.style.top = 'auto'; toolbar.style.bottom = '4px';
}

// Production HUD and reminder policy without waiting through a whole tank.
if (screen === 'juice') {
  const [{DryJuiceReminder}, {Sound}, {A11y}] = await Promise.all([
    import('./juiceFeedback.js'), import('./sound.js'), import('./a11y.js'),
  ]);
  A11y.init();
  document.body.classList.add('game-started');
  document.getElementById('title-card').classList.add('hidden');
  let juice = 1, held = false, last = performance.now(), wasEmpty = false;
  const reminder = new DryJuiceReminder(juice);
  const controls = document.createElement('span');
  controls.innerHTML = '<button id="juice-dry">Empty tank</button><button id="juice-low">Low tank</button><button id="juice-refill">Refill tank</button><button id="juice-try">Try bubbles (hold)</button><button id="juice-countdown">Show countdown</button><button id="juice-calm">Toggle calm</button><button id="juice-audio">Hear dry cue</button>';
  toolbar.append(controls);
  controls.querySelector('#juice-dry').onclick = () => {juice = 0;};
  controls.querySelector('#juice-low').onclick = () => {juice = .2;};
  controls.querySelector('#juice-refill').onclick = () => {juice = 1;};
  const tryButton = controls.querySelector('#juice-try');
  tryButton.onpointerdown = e => {held = true; tryButton.setPointerCapture(e.pointerId);};
  tryButton.onpointerup = tryButton.onpointercancel = tryButton.onlostpointercapture = () => {held = false;};
  tryButton.onkeydown = e => {if (e.key === ' ' || e.key === 'Enter') {held = true; e.preventDefault();}};
  tryButton.onkeyup = tryButton.onblur = () => {held = false;};
  controls.querySelector('#juice-countdown').onclick = () => {juice = 0; HUD.setSputter(45);};
  controls.querySelector('#juice-calm').onclick = () => document.body.classList.toggle('reduced-motion');
  controls.querySelector('#juice-audio').onclick = () => {Sound.init(); Sound.setMuted(false); Sound.playJuiceSputter(); setTimeout(() => Sound.setMuted(true), 600);};
  const tick = now => {
    const remind = reminder.update((now-last)/1000, juice, held); last = now;
    HUD.setJuice(juice);
    if (juice > .02) HUD.setSputter(null);
    if (remind) {HUD.remindJuiceEmpty(); Sound.playJuiceSputter();}
    if (juice <= .02 && !wasEmpty) Sound.playJuiceSputter();
    wasEmpty = juice <= .02;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (screen === 'toast') {
  document.body.classList.add('game-started');
  document.getElementById('title-card').classList.add('hidden');
  const showHail = () => HUD.toast('Someone is flagging you down. Pull up beside them and stop to give them a lift!', 60000);
  const replay = document.createElement('button');
  replay.textContent = 'Show hailing message'; replay.onclick = showHail;
  toolbar.append(replay); showHail();
}
