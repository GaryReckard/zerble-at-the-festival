#!/usr/bin/env node
import { buildCrowdHair } from '../src/crowdHair.js';
import { readFile } from 'node:fs/promises';
import { setSessionSeed } from '../src/rng.js';
import { CROWD_HAIR, CROWD_HAIR_STYLES, CROWD_SHIRTS, CROWD_SKIN, crowdAppearanceRng, rollCrowdAppearance } from '../src/crowdAppearance.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

setSessionSeed(814203);
const pos = {x: 12.375, z: -48.25};
const first = rollCrowdAppearance(crowdAppearanceRng(pos));
const second = rollCrowdAppearance(crowdAppearanceRng(pos));
assert(JSON.stringify(first) === JSON.stringify(second), 'appearance is not stable for a fixed seed and spawn position');
setSessionSeed(814204);
assert(JSON.stringify(first) !== JSON.stringify(rollCrowdAppearance(crowdAppearanceRng(pos))), 'appearance ignores the session seed');

setSessionSeed(814203);
const skins = new Set(), hairs = new Set(), shirts = new Set(), styles = new Set();
let drinks = 0;
const sampleCount = 12000;
for (let i = 0; i < sampleCount; i++) {
  const a = rollCrowdAppearance(crowdAppearanceRng({x: i * 1.37, z: -i * 2.11}));
  skins.add(a.skin); hairs.add(a.hair); shirts.add(a.shirt); styles.add(a.hairStyle);
  if (a.hasDrink) drinks++;
}
const drinkRate = drinks / sampleCount;
assert(skins.size === CROWD_SKIN.length, 'skin tone palette is not being used across the sample');
assert(hairs.size === CROWD_HAIR.length && styles.size === CROWD_HAIR_STYLES.length, 'hair palette or silhouette styles are not varied');
assert(shirts.size === CROWD_SHIRTS.length, 'shirt palette is not being used across the sample');
assert(drinkRate > 0.06 && drinkRate < 0.08, `beverage rate ${drinkRate} is outside the intended 6–8%`);

const crowd = await readFile(new URL('../src/crowd.js', import.meta.url), 'utf8');
assert(/legacyTieDye = rng\(\) < 0\.55/.test(crowd) && /if \(pick !== legacyShirt\) break/.test(crowd),
  'the previous visual random draws no longer preserve downstream gameplay RNG');
assert(/for \(const mesh of this\.hairMeshes\) mesh\.castShadow = false/.test(crowd) && /drinkMesh\.castShadow = false/.test(crowd),
  'appearance additions became shadow casters');
assert(/drinkMesh\.count = this\._drinkDrawCount/.test(crowd) && /_drinkFree\.push\(npc\.drinkSlot\)/.test(crowd),
  'beverage instances are not packed and returned to their slot pool');
assert(/const hairGeos = buildCrowdHair\(\)/.test(crowd) && /hairMeshes\[appearance\.hairStyle\]/.test(crowd),
  'distinct hair silhouettes no longer use their compact instanced style buckets');
assert(/for \(let i = MAX_NPCS - 1; i >= 0; i--\) \{[\s\S]*?this\.free\.push\(i\)/.test(crowd),
  'crowd slots no longer allocate upward from zero');
assert(/behaviorSeed: MAX_NPCS - 1 - idx/.test(crowd) && /npc\.behaviorSeed % 7/.test(crowd),
  'slot compaction changed the existing NPC behavior phase');
assert(/if \(remaining\.hairSlot >= 0\)/.test(crowd) || /_hairFree\[npc\.appearance\.hairStyle\]\.push\(npc\.hairSlot\)/.test(crowd),
  'hair slots are not returned to their compact style pool');

process.stdout.write(`PASS  stable crowd appearance, ${skins.size} skin tones, ${styles.size} hair forms, ${shirts.size} shirts, ${(drinkRate * 100).toFixed(1)}% drinks, RNG isolation, slot pooling, no extra shadow casters\n`);

// Test actual Three.js vertices rather than primitive bounding-box substitutes.
const names = ['cropped', 'curls', 'long', 'ponytail', 'bun', 'braids'];
const shapes = buildCrowdHair();
const repeat = buildCrowdHair();
const costs = [];
for (const [i, g] of shapes.entries()) {
  const positions = g.attributes.position.array;
  assert(positions.every(Number.isFinite), `${names[i]} has invalid vertices`);
  assert(g.attributes.normal.array.every(Number.isFinite), `${names[i]} has invalid normals`);
  assert(positions.every((v, j) => v === repeat[i].attributes.position.array[j]), 'hair geometry must be deterministic');
  g.computeBoundingBox();
  costs.push(positions.length / 9);
  assert(costs[i] <= 650, `${names[i]} exceeds the per-style triangle budget`);
  assert(g.boundingBox.max.y < 2.15 && g.boundingBox.min.y > 1, `${names[i]} escapes head/shoulder bounds`);
  // Hair over the forehead must leave both eyes and the nose unobscured.
  for (let j = 0; j < positions.length; j += 3) {
    const [x,y,z] = positions.slice(j,j+3);
    assert(!(Math.abs(x)<.14 && y<1.73 && z<-.23), `${names[i]} covers the eyes`);
  }
}
assert(shapes[2].boundingBox.min.y<1.1 && shapes[5].boundingBox.min.y<1.2, 'long styles must reach the shoulders');
assert(shapes[3].boundingBox.max.z>shapes[0].boundingBox.max.z+.12, 'ponytail must extend behind the head');
assert(shapes[4].boundingBox.max.y>shapes[0].boundingBox.max.y+.1, 'bun must rise above the cropped crown');
for (const g of [...shapes,...repeat]) g.dispose();
console.log('PASS actual hair geometry: deterministic, finite, face clearance, shoulder silhouettes; triangles:', costs.join(', '));
