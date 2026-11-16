import * as THREE from 'three';
import {animateStageBand, sampleStageBand} from './stageBand.js';

// The viewer borrows the same band and audio handle used by production. Hold is
// a visual inspection only; it never pauses or rewrites the audio scheduler.
export function createStageWorkshop({band, cam, applyCam, play, stop, finishSong, changeStyle}) {
  const root = document.createElement('div');
  root.className = 'stage-workshop';
  const style = document.createElement('select');
  style.setAttribute('aria-label', 'Band music style');
  for (const value of ['jam', 'folk', 'funk', 'brass', 'dance', 'world', 'dub']) {
    const option = document.createElement('option'); option.value = value; option.textContent = value;
    style.append(option);
  }
  style.value = band.style;
  style.onchange = () => changeStyle(style.value);
  root.append(style);
  const player = document.createElement('select');
  player.setAttribute('aria-label', 'Inspect musician');
  band.performers.forEach((person, i) => {
    const option = document.createElement('option'); option.value = i;
    option.textContent = `${i + 1}. ${person.userData.instrument.replaceAll('_', ' ')}`;
    player.append(option);
  });
  root.append(player);
  const original = {target: cam.target.clone(), yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist};
  const point = new THREE.Vector3(), direction = new THREE.Vector3();
  let held = null, heldTime = 0, time = 0;
  const button = (label, action) => {
    const node = document.createElement('button'); node.textContent = label;
    node.onclick = action; root.append(node);
  };
  button('Play this band', () => { held = null; play(); });
  button('Between songs', () => { held = null; play(false); finishSong(); });
  button('Rest / stop music', () => { held = null; stop(); });
  button('Hold pose', () => { held = {...sampleStageBand(band, time)}; heldTime = time; });
  button('Live motion', () => { held = null; });
  const focus = () => {
    const person = band.performers[Number(player.value)];
    person.getWorldPosition(point); person.getWorldDirection(direction);
    cam.target.copy(point); cam.target.y += 1.1;
    cam.yaw = Math.atan2(-direction.x, -direction.z) + .25;
    cam.pitch = .16; cam.dist = person.userData.instrument === 'drum' ? 5.8 : 4.6;
    applyCam();
  };
  player.onchange = focus;
  button('Musician close-up', focus);
  button('Full stage', () => {cam.target.copy(original.target);Object.assign(cam,{yaw:original.yaw,pitch:original.pitch,dist:original.dist});applyCam();});
  const state = document.createElement('div'); state.className = 'stage-performance-state';
  state.style.cssText = 'font:11px/1.4 monospace;padding:6px 0;white-space:pre-wrap';
  state.setAttribute('aria-label', 'Stage performance'); root.append(state);
  let previous = '';
  return {
    root,
    update(seconds) {
      time = seconds;
      const cue = animateStageBand(band, held ? heldTime : seconds, held);
      const text = `${held ? 'Held visual pose · ' : ''}${cue.style} · ${cue.state} · ${cue.section || 'waiting'} · beat ${cue.beat + 1}\n` +
        ['lead','bass','chord','kick','snare','hat'].map(key => `${key} ${Math.round(cue[key] * 4)}/4`).join(' · ');
      if (text !== previous) {state.textContent = text;previous = text;}
      return cue;
    },
  };
}
