// Run in sandbox.html?entity=zerble or against __dbg.game.zerble in the game.
export function checkMustache(zerble) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const group = zerble.root.getObjectByName('ZerbleMustache');
  assert(group?.children.length === 2, 'Mustache must have two mirrored halves');
  assert(group.children[0].scale.x === -1 && group.children[1].scale.x === 1, 'Halves must mirror');
  assert(group.position.y === 1.11 && group.children[0].rotation.z < 0 && group.children[1].rotation.z > 0, 'Mustache must clear the eyes with mirrored outward tilt');
  const body = group.children[0].children[0];
  assert(body.geometry === group.children[1].children[0].geometry, 'Halves must share body geometry');
  const positions = body.geometry.attributes.position;
  const normals = body.geometry.attributes.normal;
  assert([...positions.array, ...normals.array].every(Number.isFinite), 'Surface must have finite vertices and normals');
  body.geometry.computeBoundingBox();
  const box = body.geometry.boundingBox;
  assert(box.max.x > 2.2 && box.max.x < 2.4, 'Curl must stay inside the intended width');
  assert(box.max.y > 0.6 && box.max.y < 0.8 && box.min.y < -0.4, 'Plush silhouette must retain its lobes and curls');
  assert(box.max.z - box.min.z < 0.5, 'Fabric must remain flattened, not cylindrical');
  const front = [...Array(positions.count).keys()].filter(i => positions.getZ(i) < -0.15);
  assert(front.length > 0 && front.every(i => normals.getZ(i) < 0), 'Front-facing surface normals must point toward the camera');
  let draws = 0, triangles = 0, casters = 0;
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    draws++;
    casters += mesh.castShadow ? 1 : 0;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    if (mesh.isInstancedMesh) {
      assert(mesh.count === 192 && mesh.instanceColor, 'Fur must remain instanced and colored');
      assert([...mesh.instanceMatrix.array].every(Number.isFinite), 'Fur transforms must be finite');
      assert(!mesh.castShadow, 'Small tufts must not cast shadows');
    }
  });
  assert(draws === 68 && triangles < 11000 && casters === 2, 'Mustache render budget exceeded');
  assert(zerble._mustacheLeds.length === 64, 'Both upper and lower perimeter lights must remain animated');
  assert(zerble._mustacheLeds.every(led => led.geometry.parameters.radius === 0.018 && led.position.z === -0.23 && led.material.toneMapped === false), 'Small saturated bulbs must remain in front of the fur');
  for (let side = 0; side < 2; side++) {
    const lights = zerble._mustacheLeds.slice(side * 32, (side + 1) * 32);
    assert(lights[31].position.y > lights[0].position.y, 'Lights must trace the upper edge as well as the lower edge');
  }
  const lamps = zerble.root.children.filter(n => n.name === 'HeadlightLens');
  assert(lamps.length === 4 && lamps.every(n => n.position.y === 0.60), 'Headlight lenses must sit under the hood');
  assert(Math.abs(lamps[1].position.x - lamps[0].position.x - lamps[0].geometry.parameters.width - 0.08) < 1e-6, 'Lens dividers must retain their intermediate width');
  assert(zerble.root.getObjectByName('HeadlightFascia') && zerble.root.getObjectByName('LowerFrontPanel'), 'Headlights need their black backing and lower panel');
  assert(zerble.root.getObjectByName('LowerFrontPanel').geometry.parameters.width === 0.81, 'Lower black panel must stay half-width');
  assert(zerble._headlightLights.every(light => light.distance === 36 && !light.castShadow && light.target.position.z === -12), 'Headlights must retain their extended shadow-free reach');
  assert(zerble._mustacheLeds.every(led => led.userData.mat === led.material && Number.isFinite(led.material.emissiveIntensity)), 'LED animation references must remain valid');
  return { draws, triangles, casters, leds: zerble._mustacheLeds.length, bounds: { min: box.min.toArray(), max: box.max.toArray() } };
}
