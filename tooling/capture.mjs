import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;

// Vite binds to loopback by default. Remote phone captures use the existing
// token-protected Python playtest server against dist, not this endpoint.
export function captureMiddleware(root) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/__capture/')) return next();
    const name = /^\/__capture\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname)?.[1];
    const reply = (code, body) => { res.statusCode = code; res.end(body); };
    if (!name) return reply(400, 'Invalid capture name');
    if (req.method !== 'POST') return reply(405, 'POST required');
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reply(403, 'Loopback captures only');
    // Reject cross-origin browser writes, including requests from remote sites
    // to localhost; the capture bridge is only for the game on this server.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(403, 'Same origin required');
    if (Number(req.headers['content-length']) > MAX_CAPTURE_BYTES) return reply(413, 'Capture too large');
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_CAPTURE_BYTES) return reply(413, 'Capture too large');
        chunks.push(chunk);
      }
      if (!size) return reply(413, 'Empty capture');
      const directory = join(root, '.claude/captures');
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, `${name}.json`), Buffer.concat(chunks));
      reply(200, `wrote ${name}.json (${size} bytes)`);
    } catch (error) {
      console.error('[capture]', error);
      if (!res.writableEnded) reply(500, 'Capture failed');
    }
  };
}
