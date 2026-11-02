// Authored engineering fixture, not procedural district admission or populated content.
import { createTriangleSampler, buildHeightGrid } from './geometry.js';
import { createSupportWorld } from './support.js';

export const LANDSCAPE_VERSION = 4;
export const LANDSCAPE_BOUNDS = Object.freeze({ minX: -120, maxX: 120, minZ: -420, maxZ: 35 });
export const LANDSCAPE_BUDGET = Object.freeze({ terrainVertices: 55781, terrainTriangles: 109200, terrainBatches: 6, deckTriangles: 2, waterTriangles: 2 });
export const BRIDGE_ID = 'fixture:side-road-bridge';
export const LANDSCAPE_STOPS = Object.freeze([
  { name: 'Start · side road and crossing', x: 80, z: 12 },
  { name: 'Lower meadow · camping shelf', x: 0, z: -165 },
  { name: 'Bank · try a run-up or roll downhill', x: 0, z: -198 },
  { name: 'Side road · climb beside the bank', x: 80, z: -215 },
  { name: 'Upper meadow · camping shelf', x: 0, z: -300 },
  { name: 'Clearing · wooded descent', x: -42, z: -394 },
  { name: 'Bridge · deck support', x: 80, z: -50, surfaceId: BRIDGE_ID },
  { name: 'Underneath · riverbed support', x: 80, z: -50, surfaceId: 'terrain' },
].map(Object.freeze));
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function landscapeVertexHeight(x, z) {
  const d = -z;
  x /= -2;
  const lower = 8 * smooth((d - 80) / 70);
  const upper = 10 * smooth((d - 205) / 20);
  const roadUpper = 10 * smooth((d - 180) / 100);
  const roadWeight = 1 - smooth((Math.abs(x + 40) - 6) / 18);
  // A short eased constant-grade descent ends before the whole drum clearing.
  const t=Math.max(0,Math.min(33,d-340));
  const ramp=t<3?t*t/6:t>30?30-(33-t)*(33-t)/6:t-1.5;
  const descent = 8*ramp/30;
  const channel = 3 * smooth((d - 30) / 10) * (1 - smooth((d - 60) / 10));
  return lower + upper * (1 - roadWeight) + roadUpper * roadWeight - descent - channel;
}

const terrainSampler=createTriangleSampler(landscapeVertexHeight,{stepX:2,stepZ:1,
  bounds:{minX:-117,maxX:117,minZ:-417,maxZ:32},
  surfaceClass:(x,z)=>-z>39&&-z<61?'riverbed':Math.abs(x-80)<=12?'dirt':'grass'});
export const sampleLandscapeTerrain=terrainSampler.sample;

export function buildLandscapeStrip(minZ, maxZ) {
  if (![minZ, maxZ].every(Number.isInteger) || minZ < -420 || maxZ > 35 || maxZ <= minZ || maxZ - minZ > 80) throw new RangeError('Invalid bounded terrain strip');
  return buildHeightGrid(landscapeVertexHeight,{minX:-120,maxX:120,minZ,maxZ,stepX:2,stepZ:1});
}

export function createLandscapeFixture() {
  const supportWorld = createSupportWorld({ sampleTerrain: sampleLandscapeTerrain, decks: [{ id: BRIDGE_ID, height: 0,
    bounds: { minX: 68, maxX: 92, minZ: -75, maxZ: -25 },
    approaches: [{ minX: 68, maxX: 92, minZ: -33, maxZ: -21 }, { minX: 68, maxX: 92, minZ: -79, maxZ: -67 }] }] });
  return Object.freeze({ version: LANDSCAPE_VERSION, supportWorld, sampleTerrain: sampleLandscapeTerrain,
    // Top-surface rectangles use the same descriptor bounds as selection.
    deck: supportWorld.descriptors[0], water: Object.freeze({ minX: -120, maxX: 120, minZ: -59, maxZ: -41, height: -2.5 }) });
}
