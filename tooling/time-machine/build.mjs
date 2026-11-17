import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SOURCE_URL = 'https://github.com/GaryReckard/zerble-at-the-festival';
export const digest = value => createHash('sha256').update(value).digest('hex');
export const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], maxBuffer: 100 * 1024 * 1024 }).trim();
export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function resolveCommit(ref) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(ref) || ref.includes('..')) throw Error('Use a commit hash, branch or tag, without revision expressions.');
  return git('rev-parse', '--verify', `${ref}^{commit}`);
}

export function publicFiles(tree) {
  return tree.split('\0').filter(Boolean).flatMap(row => {
    const match = /^(\d+) blob ([a-f0-9]+)\t(.+)$/.exec(row);
    if (!match) return [];
    const [, mode, , path] = match;
    const allowed = path === 'index.html' || /^[^/]+\.(css|ico|svg|png|webp|jpg)$/.test(path) ||
      /^src\/.+\.(js|mjs|json|wasm|glsl|css)$/.test(path) || /^assets\//.test(path);
    if (!allowed || path.split('/').some(part => part.startsWith('.')) || path.endsWith('.html') && path !== 'index.html') return [];
    if (mode !== '100644' && mode !== '100755') throw Error(`Refusing non-regular public file: ${path}`);
    return [path];
  });
}

export function prepareHTML(html, policy) {
  let entry = null, hadInjector = false, inlineModule = 0;
  const modules = [];
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs, body) => {
    if (/googletagmanager|google-analytics|gtag\(/.test(body) || /type=["']importmap["']/.test(attrs)) return '';
    if (/three-actual|const mods\s*=/.test(body) && /createElement\(['"]script/.test(body)) { hadInjector = true; return ''; }
    const src = /\bsrc=["']([^"']+)["']/.exec(attrs)?.[1];
    if (src && /^(\.\/)?src\/(main|boot)\.js(?:\?.*)?$/.test(src)) { entry = src.replace(/\?.*/, ''); return ''; }
    if (src) throw Error(`Unsupported historical executable script: ${src}`);
    if (/type=["']module["']/.test(attrs)) {
      const name = `archive-title-${inlineModule++}.js`; modules.push({ name, body });
      return `<script type="module">if(globalThis.__zerbleArchive?.ready) import('./${name}');</script>`;
    }
    return `<script>if(globalThis.__zerbleArchive?.ready){\n${body}\n}</script>`;
  });
  if (!entry && hadInjector) entry = './src/main.js';
  if (!entry) throw Error('Unknown historical game entry; refusing to guess.');
  if (!entry.startsWith('./')) entry = './' + entry;
  html = html.replace(/<link\b[^>]*rel=["'](?:manifest|preconnect|dns-prefetch)["'][^>]*>/gi, '');
  // Remove historical social URLs; archived links must never advertise live play.
  html = html.replace(/<meta\b[^>]*(?:property|name)=["'](?:og:url|og:image|twitter:image)["'][^>]*>/gi, '');
  html = html.replace(/<meta\b[^>]*charset\s*=[^>]*>/gi, '');
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://esm.sh https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.google-analytics.com; font-src 'self' data:; connect-src 'self' https://esm.sh https://*.google-analytics.com; worker-src 'self' blob:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
  html = html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<script>${policy.replace(/<\/script/gi, '<\\/script')}</script>\n<link rel="stylesheet" href="./archive-session.css">`);
  html = html.replace(/<\/body>/i, `<script>if(globalThis.__zerbleArchive?.ready){globalThis.__archiveStartButtons=[...document.querySelectorAll('#start-btn,#mode-cruisin,#mode-festival')].filter(button=>!button.disabled);for(const button of globalThis.__archiveStartButtons)button.disabled=true;}</script>
    <script type="module">if(globalThis.__zerbleArchive?.ready) import('${entry}').then(()=>{for(const button of globalThis.__archiveStartButtons)button.disabled=false;}).catch(error=>{console.error('Archived game failed to load:',error);});</script>\n</body>`);
  return { html, modules, entry };
}

export async function policyBundle() {
  const output = await build({ configFile: false, root: ROOT, logLevel: 'silent',
    build: { write: false, target: 'es2022', minify: true,
      lib: { entry: resolve(ROOT, 'tooling/time-machine/policy-entry.mjs'), name: 'ZerbleArchivePolicy', formats: ['iife'] } } });
  return (Array.isArray(output) ? output[0] : output).output.find(item => item.type === 'chunk').code;
}

export async function fileHashes(directory) {
  const hashes = {};
  async function walk(path) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = join(path, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Symlink in output: ${file}`);
      if (entry.isDirectory()) await walk(file);
      else hashes[relative(directory, file).replaceAll('\\', '/')] = digest(await readFile(file));
    }
  }
  await walk(directory); return hashes;
}

export async function adapterIdentity() {
  const files = ['package-lock.json', 'tooling/time-machine/runtime.mjs', 'tooling/time-machine/analytics.mjs', 'tooling/time-machine/policy-entry.mjs', 'tooling/time-machine/build.mjs'];
  return digest(Buffer.concat(await Promise.all(files.map(file => readFile(resolve(ROOT, file))))));
}

export async function buildSnapshot(ref, destination) {
  const source = resolveCommit(ref), adapter = await adapterIdentity();
  const id = `${source}-${adapter.slice(0, 12)}`;
  const finalPath = resolve(destination, id);
  try {
    const existing = JSON.parse(await readFile(join(finalPath, 'snapshot.json'), 'utf8'));
    const hashes = await fileHashes(finalPath); delete hashes['snapshot.json'];
    if (existing.schema !== 1 || existing.id !== id || existing.source !== source || existing.adapter !== adapter || existing.storage !== 'memory' ||
      existing.checksum !== digest(JSON.stringify(hashes)) || JSON.stringify(hashes) !== JSON.stringify(existing.files)) throw Error(`Existing snapshot failed integrity: ${id}`);
    return existing;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = await mkdtemp(join(tmpdir(), 'zerble-archive-'));
  try {
    const root = join(temporary, 'source'), output = join(temporary, 'output');
    await mkdir(root);
    const files = publicFiles(execFileSync('git', ['ls-tree', '-rz', source], { cwd: ROOT, encoding: 'utf8' }));
    if (!files.includes('index.html') || !files.includes('src/main.js')) throw Error('Commit does not contain the game.');
    const archive = execFileSync('git', ['archive', source, '--', ...files], { cwd: ROOT, maxBuffer: 200 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', root], { input: archive });
    const historicalHTML = await readFile(join(root, 'index.html'), 'utf8');
    let declared = {};
    try { declared = JSON.parse(execFileSync('git', ['show', `${source}:package.json`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).dependencies || {}; } catch (error) {
      if (!historicalHTML.includes('three@0.160.0')) throw Error('Cannot establish historical Three.js version.');
    }
    const toolPackage = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
    for (const name of ['three', '@dimforge/rapier3d-compat']) {
      if (declared[name] && declared[name] !== toolPackage.dependencies[name]) throw Error(`Historical ${name} ${declared[name]} differs from trusted ${toolPackage.dependencies[name]}`);
    }
    const policy = await policyBundle();
    const context = JSON.stringify({ game_version: source.slice(0,12), game_channel: 'archive' });
    const prepared = prepareHTML(historicalHTML, `Object.defineProperty(globalThis,'__ZERBLE_ARCHIVE_CONTEXT__',{value:Object.freeze(${context})});\n${policy}`);
    await writeFile(join(root, 'index.html'), prepared.html);
    for (const module of prepared.modules) await writeFile(join(root, module.name), module.body);
    await writeFile(join(root, 'archive-session.css'), '#archive-session-note{position:fixed;z-index:2147483647;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:calc(100vw - 16px);padding:7px 12px;border:1px solid #fff6e6;border-radius:12px;background:#1a1430ed;color:#fff6e6;font:12px/1.4 system-ui;box-shadow:0 2px 12px #0008}#archive-session-note a{color:#ffd23f;white-space:nowrap}#archive-session-note button{background:none;border:0;color:inherit;font-size:20px;cursor:pointer}');
    const hasShim = files.includes('src/threeShim.js');
    const config = {
      configFile: false, root, base: './', publicDir: false, logLevel: 'warn',
      resolve: { alias: [
        { find: /^three$/, replacement: hasShim ? join(root, 'src/threeShim.js') : resolve(ROOT, 'node_modules/three/build/three.module.js') },
        { find: /^three-actual$/, replacement: resolve(ROOT, 'node_modules/three/build/three.module.js') },
        { find: /^three\/addons\//, replacement: resolve(ROOT, 'node_modules/three/examples/jsm/') + '/' },
        { find: /^@dimforge\/rapier3d-compat$/, replacement: resolve(ROOT, 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs') },
      ] },
      worker: { format: 'es', rollupOptions: { output: { banner: policy } } },
      build: { outDir: output, emptyOutDir: true, target: 'es2022', sourcemap: false,
        rollupOptions: { input: join(root, 'index.html') } },
    };
    await build(config);
    for (const file of files.filter(file => file.startsWith('assets/') || !file.includes('/') && file !== 'index.html' && !file.endsWith('.css'))) {
      await mkdir(dirname(join(output, file)), { recursive: true }); await cp(join(root, file), join(output, file));
    }
    const hashes = await fileHashes(output);
    if (Object.keys(hashes).some(file => file.endsWith('.html') && file !== 'index.html')) throw Error('Unexpected HTML entry in snapshot');
    const manifest = { schema: 1, id, source, adapter, date: git('show', '-s', '--format=%cI', source).slice(0,10),
      sourceURL: `${SOURCE_URL}/commit/${source}`, declaredDependencies: declared,
      runtimeDependencies: { three: toolPackage.dependencies.three, rapier: declared['@dimforge/rapier3d-compat'] || null },
      storage: 'memory', files: hashes, checksum: digest(JSON.stringify(hashes)) };
    await writeFile(join(output, 'snapshot.json'), JSON.stringify(manifest, null, 2) + '\n');
    await mkdir(destination, { recursive: true });
    await cp(output, finalPath, { recursive: true, errorOnExist: true, force: false });
    return manifest;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
