export function versionedTag(context, layer = []) {
  function gtag() {
    const args = arguments;
    if (args[0] === 'event') args[2] = { ...args[2], ...context };
    layer.push(args);
  }
  return { gtag, layer };
}

export function analyticsURL(input, base) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
  return url.protocol === 'https:' && /(^|\.)google-analytics\.com$/.test(url.hostname) && url.pathname === '/g/collect';
}

export function startArchiveAnalytics(scope, context) {
  const enabled = scope.document && scope.location.hostname === 'game-archive.zerble.net' &&
    scope.navigator?.globalPrivacyControl !== true && scope.navigator?.doNotTrack !== '1' &&
    new URL(scope.location.href).searchParams.get('analytics') !== '0';
  const { gtag, layer } = versionedTag(Object.freeze(context || {}));
  const lock = (key, value) => Object.defineProperty(scope, key, { value, writable: false, configurable: false });
  lock('dataLayer', layer);
  lock('gtag', enabled ? gtag : () => {});
  if (!enabled) return false;
  gtag('js', new Date());
  gtag('set', context);
  gtag('config', 'G-CY1FNMY8H8', { ...context, cookie_domain: 'none', cookie_expires: 0,
    allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = scope.document.createElement('script');
  script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=G-CY1FNMY8H8';
  scope.document.head.append(script);
  return true;
}
