// EffectComposer keeps its own pixel ratio in three.js r160. Renderer quality
// changes and viewport resizes must pass through the same owner so the canvas,
// scene targets, bloom mips, and FXAA agree on physical pixel dimensions.
export function syncRenderPipelineSize({ renderer, composer, camera, fxaaPass }, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const pixelRatio = renderer.getPixelRatio();

  renderer.setSize(w, h);
  if (composer._pixelRatio !== pixelRatio) composer.setPixelRatio(pixelRatio);
  if (composer._width !== w || composer._height !== h) composer.setSize(w, h);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (fxaaPass) {
    fxaaPass.material.uniforms.resolution.value.set(
      1 / (w * pixelRatio), 1 / (h * pixelRatio),
    );
  }
}

export function readRenderPipelineSize({ renderer, composer, bloomPass }) {
  return {
    canvasW: renderer.domElement.width,
    canvasH: renderer.domElement.height,
    targetW: composer.readBuffer.width,
    targetH: composer.readBuffer.height,
    bloomW: bloomPass.renderTargetBright.width,
    bloomH: bloomPass.renderTargetBright.height,
  };
}
