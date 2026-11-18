// Original 1280×720 composition, with a half-stage of additional painted scenery.
// The 20px inset reserves room for the independently moving layer edges.
export function titleFraming(width, height, originalOnly = false) {
  if (originalOnly) {
    const scale = Math.max(width / 1280, height / 720);
    const halfW = width / (2 * scale), halfH = height / (2 * scale);
    return { scale,
      centerX: Math.max(halfW, Math.min(1280 - halfW, 1090 - halfW)),
      centerY: Math.max(halfH, Math.min(720 - halfH, 700 - halfH)),
    };
  }
  const scale = Math.max(Math.min(width / 1280, height / 720), width / 1880, height / 1040);
  // Keep the original gate posts and Zerble inside unusually wide/tall views.
  const centerX = Math.max(640, 1090 - width / (2 * scale));
  const centerY = Math.max(360, 700 - height / (2 * scale));
  return { scale, centerX, centerY };
}

export function initTitleScene(doc = document, win = window) {
  const title = doc.getElementById('title-card');
  const originalOnly = !!win.matchMedia?.('(pointer: coarse)').matches;
  const compact = win.matchMedia?.('(max-height:500px) and (orientation:landscape)');
  const navigation = doc.getElementById('title-navigation');
  const syncNavigation = () => { if (navigation) navigation.open = !compact?.matches; };
  const onNavigationKey = event => {
    if (event.key === 'Escape' && compact?.matches && navigation.open) {
      event.preventDefault(); navigation.open = false;
      navigation.querySelector('summary')?.focus();
    }
  };
  syncNavigation();
  compact?.addEventListener('change', syncNavigation);
  navigation?.addEventListener('keydown', onNavigationKey);
  const fit = () => {
    const { scale, centerX, centerY } = titleFraming(win.innerWidth, win.innerHeight, originalOnly);
    title.style.setProperty('--title-fit', `translate(${-centerX * scale}px, ${-centerY * scale}px) scale(${scale})`);
  };
  fit();
  win.addEventListener('resize', fit, { passive: true });
  win.visualViewport?.addEventListener('resize', fit, { passive: true });

  // Restore the pre-Lantern Night sizes, two overlapping passes, jitter and timing.
  // CSS owns their curved paths, with this whole group below the foreground.
  const specs = [[30, 9, 0], [16, 12, 2], [26, 8, 4], [34, 11, 1],
    [22, 10, 6], [28, 13, 3.5], [32, 9.5, 7], [18, 7.5, 5],
    [24, 10.5, 8.5], [20, 8.5, 2.8], [30, 11.5, 6.8], [14, 9.8, 4.6]];
  const bubbles = doc.getElementById('title-bubbles');
  // Touch titles use four original, unmasked static layers. Avoid allocating
  // the decorative plume there while the browser is rotating and decoding art.
  for (let pass = 0; pass < (originalOnly ? 0 : 2); pass++) {
    specs.forEach(([width, duration, delay], index) => {
      const bubble = doc.createElement('img');
      bubble.className = 'title-bubble';
      bubble.src = 'assets/title-screen/bubble.webp';
      bubble.alt = '';
      bubble.width = bubble.height = width;
      bubble.style.setProperty('--bubble-duration', `${duration}s`);
      bubble.style.setProperty('--bubble-delay', `${delay - pass * duration / 2}s`);
      const jitterIndex = index + pass * specs.length;
      bubble.style.marginLeft = `${(jitterIndex * 37) % 121 - 60}px`;
      bubble.style.marginTop = `${(jitterIndex * 17) % 31 - 12}px`;
      bubbles.appendChild(bubble);
    });
  }
  return () => {
    win.removeEventListener('resize', fit);
    win.visualViewport?.removeEventListener('resize', fit);
    compact?.removeEventListener('change', syncNavigation);
    navigation?.removeEventListener('keydown', onNavigationKey);
    bubbles.replaceChildren();
  };
}
