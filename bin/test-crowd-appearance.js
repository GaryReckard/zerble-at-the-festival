#!/usr/bin/env node
import vm from 'node:vm';
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
assert(/const hairGeos = \[shortHair, curls, longHair, ponytail, bun, braids\]/.test(crowd) && /hairMeshes\[appearance\.hairStyle\]/.test(crowd),
  'distinct hair silhouettes no longer use their compact instanced style buckets');
assert(/for \(let i = MAX_NPCS - 1; i >= 0; i--\) \{[\s\S]*?this\.free\.push\(i\)/.test(crowd),
  'crowd slots no longer allocate upward from zero');
assert(/behaviorSeed: MAX_NPCS - 1 - idx/.test(crowd) && /npc\.behaviorSeed % 7/.test(crowd),
  'slot compaction changed the existing NPC behavior phase');
assert(/if \(remaining\.hairSlot >= 0\)/.test(crowd) || /_hairFree\[npc\.appearance\.hairStyle\]\.push\(npc\.hairSlot\)/.test(crowd),
  'hair slots are not returned to their compact style pool');

process.stdout.write(`PASS  stable crowd appearance, ${skins.size} skin tones, ${styles.size} hair forms, ${shirts.size} shirts, ${(drinkRate * 100).toFixed(1)}% drinks, RNG isolation, slot pooling, no extra shadow casters\n`);

// Execute the production geometry construction with primitive surface bounds;
// this catches long styles collapsing back into cap-sized silhouettes.
class Geometry {
  constructor(x,y=x,z=x) {
    this.vertices=[];
    for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])this.vertices.push([a*x,b*y,c*z]);
  }
  translate(x,y,z){for(const v of this.vertices){v[0]+=x;v[1]+=y;v[2]+=z;}return this;}
  scale(x,y,z){for(const v of this.vertices){v[0]*=x;v[1]*=y;v[2]*=z;}return this;}
  rotateX(a){for(const v of this.vertices){const y=v[1],z=v[2];v[1]=Math.cos(a)*y-Math.sin(a)*z;v[2]=Math.sin(a)*y+Math.cos(a)*z;}return this;}
  clone(){const g=new Geometry(0);g.vertices=this.vertices.map(v=>[...v]);return g;}
}
const geometryCode=crowd.slice(crowd.indexOf('    const hairCap ='),crowd.indexOf('    // The cup'));
const shapes=vm.runInNewContext(`(()=>{${geometryCode};return {shortHair,curls,longHair,ponytail,bun,braids};})()`,{
 THREE:{SphereGeometry:class extends Geometry{constructor(r){super(r);}},IcosahedronGeometry:class extends Geometry{constructor(r){super(r);}},
 BoxGeometry:class extends Geometry{constructor(x,y,z){super(x/2,y/2,z/2);}},CapsuleGeometry:class extends Geometry{constructor(r,h){super(r,h/2+r,r);}}},
 mergeGeometrySet(parts){const g=new Geometry(0);g.vertices=parts.flatMap(p=>p.vertices);return g;},
});
const minY=g=>Math.min(...g.vertices.map(v=>v[1]));
const maxY=g=>Math.max(...g.vertices.map(v=>v[1]));
const maxZ=g=>Math.max(...g.vertices.map(v=>v[2]));
assert(minY(shapes.longHair)<1.1 && minY(shapes.braids)<1.2,'long hair and braids must reach the shoulders/back');
assert(maxZ(shapes.ponytail)>maxZ(shapes.shortHair)+.12,'ponytail must extend behind the head');
assert(maxY(shapes.bun)>maxY(shapes.shortHair)+.1,'bun must visibly rise above the cropped crown');
assert(shapes.curls.vertices.length>shapes.shortHair.vertices.length*2,'curls must have individually modeled coil volume');
assert(/_hairFree = CROWD_HAIR_STYLES.map/.test(crowd),'all style pools must have fixed capacity');
console.log('PASS production hair geometry: shoulder-length curtain, rear ponytail, raised bun, two braids and modeled curls');
