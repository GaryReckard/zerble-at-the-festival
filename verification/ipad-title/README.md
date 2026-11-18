# iPad title header, November 17, 2026

Gary's physical-iPad screenshot showed the How to play sign covering the right
side of the Zerble logo. Reproduced in the in-app browser at 1080×746 CSS pixels,
an approximation of the attached 2160-pixel-wide screenshot after browser chrome.
This is responsive desktop verification, not an iPad Safari run.

## Cause and fix

The old tablet rule reserved a guessed 740px for navigation, while the loaded
six-label menu measured 780.58px. At the reproduced viewport, the logo occupied
x32.40–372.40 and the first menu button began at x283.83, overlapping the logo.

The [title stylesheet](../../lantern-ui.css) now shares one responsive marquee
width between the logo and the navigation's available-width calculation. The
navigation wraps within the remaining header space, with room for the second
row's hanging cords. The logo remains 340px wide at 1080×746; navigation begins
at x394.01, beyond its right edge. Large desktops retain a single row when it fits.

The short-phone boundary check also exposed an existing 568×320 overlap and
mode content extending above the screen. At widths up to 700px in short
landscape, navigation now occupies the right column while the mode/name column
scrolls below the logo. The outer title uses `overflow: clip` so browser focus
can scroll the mode column without shifting the entire title header. After
focusing the name field at 568×320, the mode column scrolled 83px, the outer title
remained at scrollTop 0, and the logo stayed at y6.40.

## Evidence

- [Before](before.jpg): production title fixture reproducing the iPad overlap.
- [After](after.jpg): real, ready title at 1080×746, with wrapped navigation.
- [Short phone](phone.jpg): 568×320 layout before scrolling to the name field.
- [Measured bounds](bounds.json): fourteen responsive sizes after font loading,
  including the 700/701, 900/901 and 1199/1200 boundaries, landscape phones,
  tablet portrait and 1920×1080 desktop. Every recorded menu/logo overlap,
  menu/mode-column overlap and offscreen-menu list is empty; all outer title
  scroll positions are zero and mode columns stay within the viewport.
- [Game at Noon](game-noon.jpg) and [game at Midnight](game-midnight.jpg): real
  Low boot through an enabled mode plank, followed by the existing time commands.
  How to play opened and returned to the corrected title before the boot.
  No browser console errors were captured.

Used `menu-preview.html?screen=loading&mute=1` for the responsive matrix and
`/?perf=low&mute=1` for real-game integration. The name-field test changed focus,
not its value. The owned browser tab was closed, viewport override reset and
temporary Vite server stopped. No standalone browser was launched.

`npm run check`, `npm run build`, the saved geometry assertions and
`git diff --check` passed. Physical-iPad Safari refresh/rotation and software
keyboard behavior remain hands-on acceptance checks.
