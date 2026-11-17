import { installArchivePolicy } from './runtime.mjs';
try {
  installArchivePolicy();
} catch (error) {
  console.error('Archive session could not be isolated:', error);
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.replaceChildren(Object.assign(document.createElement('p'), {
        textContent: 'This archived game could not start safely. Please open it from https://game-archive.zerble.net/',
      }));
    }, { once: true });
  }
  throw error;
}
