// Existing bounded lake-aware placement, shared without changing random draws.
import {isPointInLake} from '../lakes.js';
export function _pickPositionAvoidingLakes(centerX, centerZ, rNear, rFar) {
  let nx = centerX, nz = centerZ;
  for (let tries = 0; tries < 6; tries++) {
    const ang = Math.random() * (Math.PI * 2);
    const r = rNear + Math.random() * (rFar - rNear);
    nx = centerX + Math.cos(ang) * r;
    nz = centerZ + Math.sin(ang) * r;
    if (!isPointInLake(nx, nz)) return { x: nx, z: nz };
  }
  return { x: nx, z: nz };
}
