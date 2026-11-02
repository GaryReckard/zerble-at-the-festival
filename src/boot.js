// A module entry lets Vite discover the game graph while retaining the local
// delayed-boot probe and the title card's independent loading indicator.
const host = location.hostname;
const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host) ||
  host.endsWith('.local') || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
  host.includes('claude-preview') || host.includes('happycog');
const delay = local
  ? Math.min(10000, Math.max(0, Number(new URLSearchParams(location.search).get('bootDelay')) || 0))
  : 0;
const start = () => import('./main.js').catch(error => {
  console.error('Festival startup failed:', error);
  window.__zerbleBootLoader?.fail(error);
});
if (delay) setTimeout(start, delay);
else start();
