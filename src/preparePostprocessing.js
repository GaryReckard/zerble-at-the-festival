import * as THREE from 'three';

// These passes are gated off in daylight, so their first shader links would
// otherwise happen during driving at dusk or on the first Trip. Compile the
// exact materials against a composer target before arming the Start gesture.
export async function preparePostprocessing(renderer, { bloomPass, tripPass, renderTarget, writeBuffer }) {
  const materials = [...new Set([
    ...(bloomPass ? [bloomPass.materialHighPassFilter, ...bloomPass.separableBlurMaterials,
      bloomPass.compositeMaterial, bloomPass.blendMaterial] : []),
    tripPass?.material,
  ].filter(Boolean))];
  if (!materials.length) return { materials: 0 };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  for (const material of materials) scene.add(new THREE.Mesh(geometry, material));
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMip = renderer.getActiveMipmapLevel();
  const previousAutoClear = renderer.autoClear;
  const previousClearColor = renderer.getClearColor(new THREE.Color());
  const previousClearAlpha = renderer.getClearAlpha();
  const passes = [bloomPass, tripPass].filter(Boolean);
  const screenFlags = passes.map(pass => pass.renderToScreen);
  try {
    // Tone mapping and output color space are part of the program key. Using
    // the canvas here would prepare variants the composer never renders.
    renderer.setRenderTarget(renderTarget);
    await renderer.compileAsync(scene, camera);
    // Shader readiness alone leaves target allocation and uniform setup for
    // the first draw. Warm those too, entirely inside the composer buffers.
    renderer.clear();
    for (const pass of passes) {
      pass.renderToScreen = false;
      pass.render(renderer, writeBuffer, renderTarget, 0, false);
    }
    return { materials: materials.length };
  } finally {
    passes.forEach((pass, index) => { pass.renderToScreen = screenFlags[index]; });
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.setRenderTarget(previousTarget, previousFace, previousMip);
    geometry.dispose();
    scene.clear();
    // The live passes own the materials, which retain the prepared programs.
  }
}
