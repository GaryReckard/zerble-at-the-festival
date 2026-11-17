import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ROOT, SOURCE_URL, escapeHTML as h, policyBundle } from './build.mjs';

export async function renderTimeline(destination, snapshots) {
  const milestones = JSON.parse(await readFile(resolve(ROOT, 'tooling/time-machine/milestones.json'), 'utf8'));
  const chapters = milestones.flatMap(milestone => {
    const snapshot = snapshots.findLast(item => item.source.startsWith(milestone.ref));
    return snapshot ? [{ ...milestone, ...snapshot }] : [];
  });
  const tagged = new Map();
  for (const snapshot of snapshots) if (snapshot.milestoneTag && !chapters.some(item => item.source === snapshot.source)) tagged.set(snapshot.source, snapshot);
  for (const snapshot of tagged.values()) chapters.push({ ...snapshot, title:'A stop along the way',
    summary:'A tagged moment from the festival’s history, ready for another visit.', changes:[] });
  chapters.sort((a,b) => b.date.localeCompare(a.date));
  const month = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  const dateRange = chapters.length ? `${month(chapters.at(-1).date)} to ${month(chapters[0].date)}` : 'The story is getting ready';
  const cards = chapters.map((item, index) => {
    const date = new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { year:'numeric',month:'long',day:'numeric',timeZone:'UTC' });
    return `<li class="moment${index % 2 ? ' moment--flip' : ''}" id="chapter-${h(item.source.slice(0,12))}" data-date="${h(item.date)}">
      <article class="moment-text"><p class="when"><time datetime="${h(item.date)}">${h(date)}</time></p>
      <h2>${h(item.title)}</h2><p>${h(item.summary)}</p><ul>${item.changes.map(change => `<li>${h(change)}</li>`).join('')}</ul>
      <a class="btn" href="./${h(item.id)}/" aria-label="Play ${h(item.title)}, ${h(date)}">Play this version ↗</a>
      <details><summary>About this snapshot</summary><p>Prepared from the original game, with session-only storage and version-labeled analytics. Every reload starts fresh; public score submission and restart-dependent settings are unavailable.</p>
      <a href="${SOURCE_URL}/commit/${h(item.source)}">Original commit</a>${item.changelogURL ? `<a href="${h(item.changelogURL)}">Original changelog</a>` : ''}
      <a href="./${h(item.id)}/snapshot.json">Build record</a><p class="source">Source ${h(item.source.slice(0,12))} · Adapter ${h(item.adapter.slice(0,12))}</p></details></article>
      <div class="moment-media" aria-hidden="true"><span class="chapter-number">${String(chapters.length-index).padStart(2,'0')}</span></div></li>`;
  }).join('\n');
  const policy = await policyBundle();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1a1430"><title>Time Machine · Zerble at the Festival</title><meta name="description" content="Follow Zerble's journey from the first parade to today's festival, and play a little history along the way."><link rel="canonical" href="https://game-archive.zerble.net/"><link rel="stylesheet" href="./timeline.css"><link rel="icon" href="./favicon.svg"><script>Object.defineProperty(globalThis,'__ZERBLE_ARCHIVE_CONTEXT__',{value:Object.freeze({game_version:'timeline',game_channel:'timeline'})});${policy.replace(/<\/script/gi,'<\\/script')}</script><script defer src="./timeline.js"></script><script defer src="./timeline-cart.js"></script></head>
    <body><a class="skip" href="#chapters">Skip to the timeline</a><header class="site-header wrap"><a class="brand" href="https://zerble.net/">Zerble</a><nav aria-label="Explore Zerble"><a href="https://zerble.net/">The real Zerble</a><a href="https://game.zerble.net/">Play today’s game ↗</a></nav></header>
    <main class="wrap"><section class="hero" aria-labelledby="page-title"><p class="eyebrow">Zerble at the Festival</p><h1 id="page-title">Time Machine</h1><p>Every festival starts somewhere. Follow the road back through Zerble’s story, then hop in and play the game as it was.</p><p class="fresh">Old adventures, fresh starts. Archived progress lasts only until you leave or reload.</p><a class="btn btn--current" href="https://game.zerble.net/">Play the latest game ↗</a></section>
    <section id="chapters" aria-label="Playable game history"><div class="timeline-tools"><p>${chapters.length} stops along the way · ${h(dateRange)}</p><nav class="order" aria-label="Timeline order"><a data-order="newest" href="?order=newest#chapters" aria-current="true">Newest first</a><a data-order="oldest" href="?order=oldest#chapters">Oldest first</a></nav></div><ol class="timeline">${cards}</ol>${chapters.length ? '' : '<p class="empty">The first snapshots are being prepared. Come back for a little time travel soon.</p>'}</section></main>
    <footer class="site-footer wrap"><nav aria-label="Footer"><a href="https://game.zerble.net/">Today’s festival</a><a href="https://zerble.net/">Zerble.net</a><a href="${SOURCE_URL}">Source on GitHub</a></nav><p>Built from the original commits, with a little help getting them running today. Some older quirks are part of the ride.</p><p>Timeline road and little rolling Zerble borrowed from <a href="https://zerble.net/#story">Zerble’s real-world story</a>.</p></footer></body></html>`;
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'index.html'), html);
  await writeFile(join(destination, '.nojekyll'), '');
  await writeFile(join(destination, 'CNAME'), 'game-archive.zerble.net\n');
  for (const file of ['timeline.css','timeline.js','timeline-cart.js']) await cp(resolve(ROOT,'tooling/time-machine/ui',file),join(destination,file));
  await mkdir(join(destination,'fonts'),{recursive:true});
  for (const file of ['caprasimo-latin.woff2','outfit-latin.woff2','Caprasimo-OFL.txt','Outfit-OFL.txt']) await cp(resolve(ROOT,'assets/fonts',file),join(destination,'fonts',file));
  await cp(resolve(ROOT,'favicon.svg'),join(destination,'favicon.svg'));
  await writeFile(join(destination,'snapshots.json'),JSON.stringify({schema:1,snapshots},null,2)+'\n');
  await writeFile(join(destination,'404.html'),'<!doctype html><meta charset="utf-8"><title>Lost in time · Zerble</title><h1>That stop isn’t on the map.</h1><p><a href="https://game-archive.zerble.net/">Return to the Time Machine</a></p>');
  return chapters;
}
