// The paths bound loose camping groups; sleeping pitches deliberately avoid a grid.
import { planCampRecipe } from '../campPlanning.js';
import { mulberry32 } from '../rng.js';
import { LANDSCAPE_BOUNDS } from './fixture.js';
const points = values => Object.freeze(values.map(Object.freeze));
export function mountainDistrictPlan(seed = 1977, id = `mountaintop:${seed}`) {
  if (!Number.isSafeInteger(seed) || typeof id !== 'string' || !id) throw new TypeError('Invalid district identity');
  const camps = [], rng=mulberry32(seed^0x4D544F50);
  for (const [shelf, hostZ, minZ, maxZ, target] of [['lower',-168,-195,-160,8],['upper',-279,-321,-273,5]]) {
    const add = (x,z,role,facing) => {
      const index=camps.length, recipe=Object.freeze(planCampRecipe('small', {role,tightSleeping:true,
        archetype:role==='satellite'?'light-travelers':undefined,seed:seed^index}));
      camps.push(Object.freeze({id:`${id}:${shelf}:${index}`,x,z,size:'small',shelf,role,recipe,facing,
        clearance:role==='host'?14:6.5}));
    };
    for (const x of (shelf==='upper'?[-98,44]:[-94,-34,34])) add(x+(rng()-.5)*3,hostZ+(rng()-.5)*3,'host',(rng()-.5)*.8);
    let accepted=0;
    for (let attempt=0;attempt<512 && accepted<target;attempt++) {
      const x=-108+rng()*163,z=minZ+rng()*(maxZ-minZ);
      if ([0,-68].some(lane=>Math.abs(x-lane)<13.5)) continue;
      if (shelf==='upper' && Math.hypot(x+34,z+285)<37) continue;
      if (camps.some(p=>Math.hypot(p.x-x,p.z-z)<p.clearance+6.5+.5)) continue;
      add(x,z,'satellite',rng()*Math.PI*2);accepted++;
    }
    if (accepted<(shelf==='lower'?6:4)) throw new Error(`Mountain camping capacity rejected: ${shelf} (${accepted}/${target})`);
  }
  const accessPaths = [];
  for (const [junction, end] of [[-151, -201], [-260, -326]]) {
    accessPaths.push(points([{x:80,z:junction},{x:-108,z:junction}]));
    for (const x of [0,-68]) accessPaths.push(points([{x,z:junction},{x,z:end}]));
  }
  const mainRoad=points([{x:80,z:12},{x:80,z:-334},{x:-104,z:-334}]);
  const narrowPath=points([{x:-28,z:-334},{x:-32,z:-349},{x:-40,z:-365},{x:-42,z:-383},{x:-42,z:-394}]);
  return Object.freeze({ id, seed, bounds: LANDSCAPE_BOUNDS,
    camps:Object.freeze(camps),clearing:Object.freeze({x:-60,z:-394,radius:18,facing:0}),
    mainRoad,narrowPath,
    frame:Object.freeze({origin:Object.freeze({x:0,z:0}),turns:0}),
    woodland:Object.freeze({bounds:Object.freeze({minX:-110,maxX:110,minZ:-410,maxZ:-348}),step:10}),
    commons:Object.freeze({x:-34,z:-285,radius:29}),
    meadowFire:Object.freeze({x:-34,z:-272,radius:2}),
    route:points([...mainRoad.slice(0,2),...narrowPath]),accessPaths:Object.freeze(accessPaths),
    visitorRoute:points([{x:80,z:12},{x:80,z:-260},{x:-68,z:-260},{x:-68,z:-313}]),
    ports:points([{id:`${id}:entry`,x:80,z:12,width:12,surfaceId:'terrain'}]),
    shelves:Object.freeze([{id:'lower',minX:-114,maxX:64,minZ:-203,maxZ:-150,height:8},
      {id:'upper',minX:-114,maxX:64,minZ:-329,maxZ:-260,height:18}].map(Object.freeze)),
  });
}
