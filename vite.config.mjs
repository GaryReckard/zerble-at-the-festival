import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureMiddleware } from './tooling/capture.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
export const pages = ['index.html', 'sandbox.html', 'hub-sandbox.html',
  'terrain-sandbox.html', 'map-sandbox.html', 'passport-preview.html', 'festival-map-preview.html'];
const staticFiles = ['favicon.ico', 'favicon.svg', 'favicon-96x96.png',
  'apple-touch-icon.png', 'site.webmanifest',
  'web-app-manifest-192x192.png', 'web-app-manifest-512x512.png'];

export default defineConfig({
  // Relative output also works at the GitHub Pages project subpath and in
  // the loopback/phone production-preview servers.
  base: './',
  publicDir: false,
  appType: 'mpa',
  resolve: {
    alias: [
      { find: /^three$/, replacement: resolve(root, 'src/threeShim.js') },
      { find: /^three-actual$/, replacement: resolve(root, 'node_modules/three/build/three.module.js') },
      { find: /^three\/addons\//, replacement: resolve(root, 'node_modules/three/examples/jsm') + '/' },
    ],
  },
  server: { host: '127.0.0.1', port: 8765, strictPort: true,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**',
      '**/.claude/**', '**/.codex/**', '**/.agents/**', '**/.aws/**'] } },
  preview: { host: '127.0.0.1', port: 8765, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { input: pages.map(page => resolve(root, page)) },
  },
  plugins: [{
    name: 'zerble-local-tools',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Manifest icon URLs are relative to the manifest, so keep it at the
        // site root alongside its icons rather than relocating it to assets/.
        return html.replace(/(<link\s+rel="manifest"\s+href=")[^"]+/, '$1./site.webmanifest');
      },
    },
    configureServer(server) { server.middlewares.use(captureMiddleware(root)); },
    configurePreviewServer(server) { server.middlewares.use(captureMiddleware(root)); },
    // Game logic owns scene/audio state. Reload it instead of accepting live
    // module replacement without a complete disposal/recreation contract.
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.js')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
    writeBundle(options) {
      // Runtime MIDI URLs, inline title-card images and social previews need
      // their existing stable paths as well as Vite's hashed CSS assets.
      const output = resolve(root, options.dir || 'dist');
      cpSync(resolve(root, 'assets'), resolve(output, 'assets'), { recursive: true,
        filter: source => !source.endsWith('.DS_Store') });
      for (const file of staticFiles) copyFileSync(resolve(root, file), resolve(output, file));
    },
  }],
});
