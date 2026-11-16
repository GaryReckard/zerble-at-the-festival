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


const backlineCache = new Map();
const backlineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
backlineMat.userData.shared = true;

function stageBackline(isMain) {
  if (backlineCache.has(isMain)) return backlineCache.get(isMain);
  const { width: w, depth: d, trussHeight: th } = isMain ? STAGE_SHAPES.main : STAGE_SHAPES.side;
  const h = STAGE_SURFACES.deckHeight;
  const black = 0x1d202a, metal = 0x999eaa, truss = 0x535565;
  const geo = bakePerformancePart(({ box, rod, tube, add }) => {
    // The downstage PA and the lighting bridge share the static equipment draw.
    // Use shallow cylinders for flat speaker cones rather than tessellated spheres.
    const driver = (color, x, y, z, r) => {
      add(new THREE.CylinderGeometry(r * .92, r, .04, 12), color, [x, y, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
    };
    const drumX = w * .10, drumZ = -d * .25;
    box(black, [drumX, h + .16, drumZ], [3.8, .32, 2.8]);
    box(0x824a49, [drumX, h + .324, drumZ], [3.55, .008, 2.58]);

    // Wedge grilles face upstage at the players. Their rear panels face the crowd.
    const wedge = new THREE.Shape();
    wedge.moveTo(-.40, 0);
    wedge.lineTo(.40, 0);
    wedge.lineTo(.40, .46);
    wedge.lineTo(-.40, .11);
    wedge.closePath();
    for (const x of [-w * .29, 0, w * .29]) {
      const z = d * .5 - .66;
      add(new THREE.ExtrudeGeometry(wedge, { depth: 1.05, bevelEnabled: false }), black,
        [x + .525, h, z], [1, 1, 1], [0, -Math.PI / 2, 0]);
      box(0x474851, [x, h + .295, z], [.93, .022, .73], [-Math.atan2(.35, .8), 0, 0]);
      // Route the cable along the downstage lip, clear of players' feet.
      tube(black, [[x + .49, h + .06, z], [x + .64, h + .024, z + .12],
        [x + .9, h + .024, z + .42], [w * .40, h + .024, z + .45]], .016);
    }

    for (const side of [-1, 1]) {
      // Short wing curtains mask the cases from the side while framing the banner.
      const curtain = new THREE.BufferGeometry(), cloth = [];
      const curtainWidth = w * .105;
      const edge = side * (w / 2 - .34) - (side > 0 ? curtainWidth : 0);
      for (let fold = 0; fold < 6; fold++) {
        const x1 = edge + curtainWidth * fold / 6;
        const x2 = edge + curtainWidth * (fold + 1) / 6;
        const z1 = -d / 2 + (fold % 2 ? .34 : .12);
        const z2 = -d / 2 + (fold % 2 ? .12 : .34);
        const bottom = h + .16, top = th - .48;
        const a = [x1, bottom, z1], b = [x2, bottom, z2];
        const c = [x1, top, z1], upperRight = [x2, top, z2];
        cloth.push(...a, ...b, ...c, ...b, ...upperRight, ...c);
      }
      curtain.setAttribute('position', new THREE.Float32BufferAttribute(cloth, 3));
      curtain.computeVertexNormals();
      add(curtain, 0x593e58);
      const ampX = side * w * .31, ampZ = -d * .31;
      box(black, [ampX, h + .62, ampZ], [1.45, 1.24, .72]);
      box(0x534c50, [ampX, h + .59, ampZ + .365], [1.28, .94, .018]);
      for (const y of [.35, .82]) driver(0x30313b, ampX, h + y, ampZ + .38, .21);
      box(0xc7b99b, [ampX, h + 1.14, ampZ + .37], [1.27, .11, .03]);

      const x = side * (w / 2 - 1.12), z = -d * .22;
      box(0x394858, [x, h + .4, z], [1.4, .8, .85]);
      for (const y of [.06, .74]) box(metal, [x, h + y, z + .44], [1.42, .04, .03]);
      for (const dx of [-.68, .68]) box(metal, [x + dx, h + .4, z + .44], [.04, .77, .03]);
      box(black, [x, h + .45, z + .46], [.34, .09, .04]);

      // Ground-stacked subs carry two tops; there is no gap under the cabinets.
      const paX = side * (w / 2 + 1), paZ = d / 2 - .82;
      box(black, [paX, .77, paZ], [1.6, 1.54, 1.56]);
      driver(0x3b3b47, paX, .78, paZ + .79, .60);
      driver(black, paX, .78, paZ + .82, .23);
      for (let tier = 0; tier < 2; tier++) {
        const y = 2.16 + tier * 1.24;
        box(black, [paX, y, paZ], [1.34, 1.24, 1.18]);
        driver(0x454650, paX, y - .16, paZ + .61, .37);
        box(0x51525c, [paX, y + .36, paZ + .60], [.77, .19, .04]);
      }

      // Front towers have paired chords and a continuous zigzag web.
      for (const pz of [-d / 2 + .24, d / 2 - .24]) {
        const outer = side * (w / 2 - .18), inner = outer - side * .44;
        box(truss, [outer, th / 2, pz], [.14, th, .14]);
        box(truss, [inner, th / 2, pz], [.12, th, .12]);
        for (let bay = 0; bay < 5; bay++) {
          const a = bay % 2 ? inner : outer, b = bay % 2 ? outer : inner;
          rod(metal, [a, .08 + (th - .16) * bay / 5, pz], [b, .08 + (th - .16) * (bay + 1) / 5, pz], .043);
        }
      }
      box(truss, [side * (w / 2 - .18), th, 0], [.16, .16, d - .48]);

      // The highest tread meets the deck; the lowest stays within the original approach.
      for (let step = 0; step < 5; step++) {
        const rise = h * (step + 1) / 5;
        const sz = d / 2 + (4.5 - step) * .25;
        box(0x664c3e, [x, rise / 2, sz], [1.38, rise, .25]);
        box(0xbfa47b, [x, rise - .026, sz + .122], [1.38, .052, .016]);
      }
    }

    const span = w - .36;
    for (const z of [-d / 2 + .24, 0, d / 2 - .24]) {
      box(truss, [0, th, z], [span, .14, .14]);
      box(truss, [0, th - .45, z], [span, .12, .12]);
      const bays = isMain ? 16 : 10;
      for (let i = 0; i < bays; i++) {
        const x = -span / 2 + span * i / bays;
        rod(metal, [x, th - (i % 2 ? .45 : 0), z],
          [x + span / bays, th - (i % 2 ? 0 : .45), z], .035);
      }
    }
    for (const x of [-w * .32, 0, w * .32]) {
      box(black, [x, th - .58, 0], [.56, .32, .46]);
    }

    // Tie the festival pennants to the lower audience-facing chord.
    const flag = new THREE.Shape([new THREE.Vector2(-.31, 0), new THREE.Vector2(0, -.57), new THREE.Vector2(.31, 0)]);
    for (let i = 0; i < 11; i++) {
      add(new THREE.ShapeGeometry(flag), [0xf4bd57, 0xd35e8b, 0x5dc1bb][i % 3],
        [-w * .43 + i * w * .086, th - .44, d / 2 - .17]);
    }
  });
  geo.deleteAttribute('strideSide');
  backlineCache.set(isMain, geo);
  return geo;
}

export function buildStage(opts = {}) {
  // `scale` (default 1.0) scales the deck dimensions + truss + speakers +
  // stage lights uniformly so chunks.js can give each stage a different
  // size for visual variety. The returned dimensions reflect the scale so
  // callers can register correctly-sized colliders.
  const { isMain = false, leafTexture = null, rng = Math.random, scale = 1.0 } = opts;

  const g = new THREE.Group();
  g.userData.isMainStage = isMain;
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

  const trussH = shape.trussHeight * scale;

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
    lampLens.rotation.x = -.52;
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
  equipment.name = 'Stage rig and backline';
  equipment.scale.setScalar(scale);
  equipment.receiveShadow = true;
  g.add(equipment);

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

const ENSEMBLES = {
  jam: {
    main: ['lead_vocal', 'guitar', 'guitar', 'bass', 'drum', 'sax'],
    side: ['lead_vocal', 'guitar', 'drum'],
  },
  folk: {
    main: ['lead_vocal', 'guitar', 'guitar', 'bass', 'march_drum', 'sax'],
    side: ['guitar', 'bass', 'march_drum'],
  },
  funk: {
    main: ['lead_vocal', 'guitar', 'keys', 'bass', 'drum', 'trumpet'],
    side: ['guitar', 'bass', 'drum'],
  },
  brass: {
    main: ['trumpet', 'trombone', 'sax', 'tuba', 'trumpet', 'trombone'],
    side: ['trumpet', 'trombone', 'tuba'],
  },
  dance: {
    main: ['lead_vocal', 'keys', 'guitar', 'bass', 'drum', 'keys'],
    side: ['keys', 'bass', 'drum'],
  },
  world: {
    main: ['guitar', 'march_drum', 'sax', 'bass', 'drum', 'lead_vocal'],
    side: ['guitar', 'march_drum', 'drum'],
  },
  dub: {
    main: ['lead_vocal', 'keys', 'trombone', 'bass', 'drum', 'guitar'],
    side: ['bass', 'guitar', 'drum'],
  },
};

export function stageInstruments(style = 'jam', isMain = false) {
  const ensemble = Object.hasOwn(ENSEMBLES, style) ? ENSEMBLES[style] : ENSEMBLES.jam;
  return [...ensemble[isMain ? 'main' : 'side']];
}

export function placeBandOnStage(stageGroup, instruments, opts) {
  const { deckWidth: w, deckDepth: d, deckHeight: h, rng = Math.random, style } = opts;
  const isMain = stageGroup.userData.isMainStage === true;
  const roles = instruments ?? stageInstruments(style, isMain);
  const legacySlots = ENSEMBLES.jam[isMain ? 'main' : 'side'];
  const scale = h / STAGE_SURFACES.deckHeight;
  const leadIndex = roles.includes('lead_vocal') ? roles.indexOf('lead_vocal') : roles.findIndex(role => role !== 'drum');
  const riserRole = ['drum', 'tuba', 'march_drum'].find(role => roles.includes(role));
  const riserIndex = roles.indexOf(riserRole);
  const wings = roles.map((_, i) => i).filter(i => i !== leadIndex && i !== riserIndex);
  return roles.map((role, index) => {
    // Each old guitar slot consumed a second world draw. Retain its precise
    // position even when the new arrangement assigns a horn or keys to it.
    let performer;
    if (style != null && legacySlots.length === roles.length) {
      const variant = rng();
      if (legacySlots[index] === 'guitar') rng();
      performer = buildPerformer(role, () => variant);
    } else {
      performer = buildPerformer(role, rng);
    }
    const flank = wings.indexOf(index);
    // Open a window between the centre mic and the inside flank for the kit.
    const spread = wings.length === 4 ? [-.34, -.18, .20, .34][flank]
      : wings.length === 1 ? -.25 : -.34 + .68 * flank / Math.max(1, wings.length - 1);
    const onRiser = index === riserIndex, lead = index === leadIndex;
    performer.position.set(
      onRiser ? w * .10 : lead ? 0 : w * spread,
      h + (onRiser ? .328 * scale : 0),
      onRiser ? -d * .25 - .18 * scale : lead ? d * .14 : d * .06,
    );
    performer.rotation.y = Math.PI;
    stageGroup.add(performer);
    return performer;
  });
}
