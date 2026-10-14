// Festival stage — deck, banner, truss, speaker stacks, stage lights.
// Sits at the group's origin; caller positions the group.
//
// Caller-supplied opts:
//   isMain         - bigger stage with the LEAF banner
//   leafTexture    - { diffuse, emissive } CanvasTexture pair (chunks.js owns the cache)
//
// Returns { group, deckWidth, deckDepth, deckHeight, frontZ } so callers can
// register colliders / attractors in world space relative to where they place
// the group.

import * as THREE from 'three';
import { buildPerformer, bakePerformancePart } from './performer.js';
import { register as registerContextLight } from '../contextLights.js';
import { STAGE_SHAPES, STAGE_SURFACES } from '../festivalShapes.js';


const backlineCache=new Map();
const backlineMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
backlineMat.userData.shared=true;
function stageBackline(isMain){
  if(backlineCache.has(isMain))return backlineCache.get(isMain);
  const {width:w,depth:d,trussHeight:th}=isMain?STAGE_SHAPES.main:STAGE_SHAPES.side;
  const h=STAGE_SURFACES.deckHeight,black=0x1d202a,metal=0x999eaa;
  const geo=bakePerformancePart(({box,oval,rod,tube,add})=>{
    // Detailed gear is one pooled draw, rather than a draw per cone, knob or cable.
    box(black,[0,h+.16,-d*.25],[3.8,.32,2.6]);
    for(const x of [-w*.22,w*.22]){
      box(0x774248,[x,h+.015,d*.12],[3.3,.025,2.1]);
      for(const z of [-.9,.9])box(0xccab67,[x,h+.03,d*.12+z],[3.05,.012,.035]);
    }
    for(const x of [-w*.27,0,w*.27]){
      box(black,[x,h+.22,d*.5-.7],[1.15,.42,.65],[-.28,0,0]);
      box(0x46505a,[x,h+.38,d*.5-.61],[.98,.025,.46],[-.28,0,0]);
      tube(black,[[x,h+.03,d*.5-.7],[x+.5,h+.03,1],[x+.8,h+.03,-d*.3]],.014);
    }
    for(const sx of [-1,1]){
      box(black,[sx*w*.29,h+.63,-d*.31],[1.5,1.25,.72]);
      box(0x4e4947,[sx*w*.29,h+.6,-d*.31+.37],[1.32,.92,.015]);
      for(const y of [h+.34,h+.84])oval(0x24242b,[sx*w*.29,y,-d*.31+.39],[.29,.23,.012]);
      box(0xc7b99b,[sx*w*.29,h+1.18,-d*.31+.38],[1.28,.11,.023]);
      for(let i=0;i<5;i++)oval(metal,[sx*w*.29-.4+i*.20,h+1.18,-d*.31+.4],[.025,.025,.015]);
      // A flight case at each wing, with edge strips, corners and handles.
      const x=sx*(w*.5-1.15),z=-d*.22;
      box(0x394858,[x,h+.4,z],[1.4,.8,.85]);
      for(const y of [h+.07,h+.74])box(metal,[x,y,z+.44],[1.42,.035,.025]);
      for(const dx of [-.68,.68])box(metal,[x+dx,h+.4,z+.44],[.035,.77,.025]);
      box(black,[x,h+.45,z+.46],[.34,.09,.035]);
      // Visible drivers distinguish PA cabinets from plain black boxes.
      for(let row=0;row<3;row++){
        const px=sx*(w*.5+1),py=1.4+row*1.45,pz=-d*.5+2.01;
        oval(0x424550,[px,py-.20,pz],[.50,.50,.035]);
        oval(black,[px,py-.20,pz+.04],[.19,.19,.025]);
        box(0x54515c,[px,py+.46,pz],[.78,.22,.03]);
      }
      // Diagonal braces make the existing posts read as a working truss.
      for(let y=1;y<th-1;y+=1.6){
        rod(metal,[sx*(w*.5-.42),y,d*.5-.3],[sx*(w*.5-.12),y+1.4,d*.5-.3],.027);
      }
      for(let step=0;step<3;step++)box(0x66513e,[sx*(w*.5-.85),(step+1)*h/6,d*.5+.3+(.8-step*.3)],[1.4,(step+1)*h/3,.36]);
    }
    // Small festival pennants across the audience truss.
    for(let i=0;i<11;i++){
      const x=-w*.43+i*w*.086;
      const shape=new THREE.Shape([new THREE.Vector2(-.35,0),new THREE.Vector2(.35,0),new THREE.Vector2(0,-.65)]);
      add(new THREE.ShapeGeometry(shape),[0xf4bd57,0xd35e8b,0x5dc1bb][i%3],[x,th-.23,d*.5+.02]);
    }
  });
  backlineCache.set(isMain,geo);return geo;
}

export function buildStage(opts = {}) {
  // `scale` (default 1.0) scales the deck dimensions + truss + speakers +
  // stage lights uniformly so chunks.js can give each stage a different
  // size for visual variety. The returned dimensions reflect the scale so
  // callers can register correctly-sized colliders.
  const { isMain = false, leafTexture = null, rng = Math.random, scale = 1.0 } = opts;

  const g = new THREE.Group();
  const shape = isMain ? STAGE_SHAPES.main : STAGE_SHAPES.side;
  const w = shape.width * scale;
  const d = shape.depth * scale;
  const h = STAGE_SURFACES.deckHeight * scale;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: STAGE_SURFACES.deckColor, roughness: 0.95, flatShading: true })
  );
  deck.position.set(0, h / 2, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  const bannerColor = isMain
    ? STAGE_SURFACES.mainBannerColor
    : STAGE_SURFACES.sideBannerColors[Math.floor(rng() * STAGE_SURFACES.sideBannerColors.length)];
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(w, STAGE_SURFACES.bannerHeight * scale, STAGE_SURFACES.bannerThickness * scale),
    new THREE.MeshStandardMaterial({ color: bannerColor, roughness: 0.9, flatShading: true })
  );
  banner.position.set(0, STAGE_SURFACES.bannerCenterY * scale, -d / 2 - STAGE_SURFACES.bannerThickness * scale / 2);
  banner.castShadow = true;
  g.add(banner);

  if (isMain && leafTexture) {
    const bannerW = Math.min(w - 2 * scale, 16 * scale);
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(bannerW, 3.4 * scale),
      new THREE.MeshStandardMaterial({
        map: leafTexture.diffuse,
        emissive: 0xffd28a,
        emissiveMap: leafTexture.emissive,
        emissiveIntensity: 0.55,
        roughness: 0.6,
        side: THREE.DoubleSide,
      })
    );
    leaf.position.set(0, 5.3 * scale, -d / 2 + 0.06 * scale);
    g.add(leaf);
  }

  // Truss
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a1f3a, roughness: 0.5, metalness: 0.4, flatShading: true });
  const trussH = shape.trussHeight * scale;
  const trussThk = 0.25 * scale;
  for (const [px, pz] of [
    [-w / 2 + 0.3 * scale, -d / 2 + 0.3 * scale], [w / 2 - 0.3 * scale, -d / 2 + 0.3 * scale],
    [-w / 2 + 0.3 * scale, d / 2 - 0.3 * scale], [w / 2 - 0.3 * scale, d / 2 - 0.3 * scale],
  ]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(trussThk, trussH, trussThk), trussMat);
    p.position.set(px, trussH / 2, pz);
    g.add(p);
  }
  for (const dx of [-w / 2, w / 2]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(trussThk, trussThk, d), trussMat);
    b.position.set(dx, trussH, 0);
    g.add(b);
  }
  for (const dz of [-d / 2, d / 2]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, trussThk, trussThk), trussMat);
    b.position.set(0, trussH, dz);
    g.add(b);
  }

  // Main stage gets a real wooden structure — a back wall behind the band and
  // a gabled roof on the truss top — so it reads as a built stage, not just a
  // platform with a floating banner. Side stages stay open.
  if (isMain) {
    const woodMat = new THREE.MeshStandardMaterial({ color: shape.roofColor, roughness: 0.92, flatShading: true });

    // Back wall — full width, up to the truss top, just behind the banner.
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(w, trussH, 0.4 * scale),
      woodMat,
    );
    back.position.set(0, trussH / 2, -d / 2 - 0.3 * scale);
    back.castShadow = true;
    back.receiveShadow = true;
    g.add(back);

    // Gabled roof — ridge along the width, sloping down to front + back eaves
    // with a small overhang. Springs from the truss top.
    const eaveY = trussH;
    const peak = shape.roofRise * scale;
    const overhang = shape.roofOverhang * scale;
    const halfD = d / 2 + overhang;
    const slopeLen = Math.hypot(halfD, peak);
    const slabThk = 0.22 * scale;
    const slabW = w + 2 * overhang;
    const angle = Math.atan2(peak, halfD);
    for (const dir of [1, -1]) {              // +1 = front slope (+Z), -1 = back
      const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, slabThk, slopeLen), woodMat);
      slab.position.set(0, eaveY + peak / 2, (dir * halfD) / 2);
      slab.rotation.x = dir * angle;          // tilt so both slopes meet at the ridge (z=0)
      slab.castShadow = true;
      g.add(slab);
    }
    // Ridge beam capping the peak.
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.3 * scale, 0.3 * scale), woodMat);
    ridge.position.set(0, eaveY + peak, 0);
    g.add(ridge);
  }

  // Speaker stacks
  const spkW = 1.6 * scale;
  const spkH = 1.4 * scale;
  for (const sx of [-w / 2 - 1 * scale, w / 2 + 1 * scale]) {
    for (let sy = 0; sy < 3; sy++) {
      const spk = new THREE.Mesh(
        new THREE.BoxGeometry(spkW, spkH, spkW),
        new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.8, flatShading: true })
      );
      spk.position.set(sx, 1.4 * scale + sy * 1.45 * scale, -d / 2 + 1.2 * scale);
      // 6 speakers per stage; deck + banner already cast the stage shadow.
      g.add(spk);
    }
  }

  // Stage lights — emissive lens mesh + SpotLight aimed into the audience.
  // The day-night system ramps SpotLight intensity with nightness and
  // animates each beam's target so the beams sweep across the crowd in
  // colorful patterns at night.
  const stageLights = [];
  const stageBeams = [];
  const PALETTE = [0xff3380, 0xff8a3b, 0xffe066, 0x6fcf6a, 0x33d9ff, 0xc080ff];
  for (let i = 0; i < 3; i++) {
    const lxArr = [-w * 0.32, 0, w * 0.32];
    const lx = lxArr[i];
    const colorHex = isMain
      ? PALETTE[Math.floor(rng() * PALETTE.length)]
      : 0xffd28a;
    const lampLens = new THREE.Mesh(
      new THREE.ConeGeometry(0.4 * scale, 0.6 * scale, 12, 1, true),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 2.5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    const lensY = trussH - 0.7 * scale;
    lampLens.position.set(lx, lensY, 0);
    lampLens.rotation.x = Math.PI;
    g.add(lampLens);
    stageLights.push(lampLens);

    // SpotLight directly behind the lens, aimed into the audience
    // (+Z, downward). Target sits a few meters in front + below.
    const beam = new THREE.SpotLight(
      colorHex,
      0,                // intensity — animated by updateStageLightShow
      24 * scale,       // throw distance
      i === 1 ? Math.PI / 7 : Math.PI / 4,      // ~25° cone half-angle (narrowish so beams read)
      0.45,             // penumbra
      1.0,              // decay
    );
    beam.position.set(lx, lensY - 0.1, 0);
    const target = new THREE.Object3D();
    // Default target: 8m forward (+Z) of the stage, on the ground.
    const wash = i !== 1;
    target.position.set(lx, wash ? h + .8 : 0, wash ? d * .2 : 10 * scale);
    g.add(target);
    beam.target = target;
    g.add(beam);
    // Distance-cull stage SpotLights — they're the heaviest light in the
    // game (SpotLights are ~2× a PointLight per fragment) and a stage that
    // isn't visible shouldn't be paying that cost.
    registerContextLight(beam);

    stageBeams.push({ beam, target, wash, baseTargetX: lx, baseTargetZ: target.position.z, phaseOffset: i * 1.7 });
  }

  g.userData.animateLights=(t,nightness)=>{
    for(const ref of stageBeams){
      ref.beam.intensity=nightness*(ref.wash?24:8);
      ref.target.position.x=ref.baseTargetX+Math.sin(t*.5+ref.phaseOffset)*(ref.wash?.4:3)*scale;
    }
    for(const lens of stageLights)lens.material.emissiveIntensity=2+nightness*3;
  };
  const equipment=new THREE.Mesh(stageBackline(isMain),backlineMat);
  equipment.scale.setScalar(scale);equipment.receiveShadow=true;g.add(equipment);

  return {
    group: g,
    deckWidth: w,
    deckDepth: d,
    deckHeight: h,
    scale,
    frontZ: d / 2,           // local Z of the deck front edge (audience side)
    stageLights,
    stageBeams,
  };
}

// Lay a band out across a stage. `bandSeed` is the array of instrument
// strings (e.g. ['lead_vocal','guitar','drum']). Returns the performer
// groups in placement order so caller can register them for animation.
export function placeBandOnStage(stageGroup, instruments, opts) {
  const { deckWidth, deckDepth, deckHeight, rng = Math.random } = opts;
  const w = deckWidth;
  const d = deckDepth;
  const lineZ = d * .5 - 1.8;              // slightly behind the front edge
  const backZ = -d * 0.25;
  const performers = [];
  const flankCount=instruments.filter(i=>i!=='lead_vocal'&&i!=='drum').length;
  let flankIndex=0;
  for (let i = 0; i < instruments.length; i++) {
    const inst = instruments[i];
    const isLead = inst === 'lead_vocal' || inst === 'drum' || inst === 'bass';
    const spread = w * 0.32;
    const spotX = inst === 'lead_vocal' || inst === 'drum' ? 0
      : (flankCount===1 ? -.65 : -1 + 2*(flankIndex++)/(flankCount-1)) * spread;
    const spotZ = inst === 'drum' ? backZ : (isLead && i === 0 ? lineZ : lineZ - .8);
    const performer = buildPerformer(inst, rng);
    performer.position.set(spotX, deckHeight + (inst === 'drum' ? .32 * (deckHeight/STAGE_SURFACES.deckHeight) : 0), spotZ);
    performer.rotation.y = Math.PI;
    stageGroup.add(performer);
    performers.push(performer);
  }
  return performers;
}
