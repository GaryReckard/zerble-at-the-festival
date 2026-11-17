# Desktop title sizing and navigation alignment

November 17, 2026. Local Vite game, muted, Low quality, in-app GPU browser.

- At 1860 × 926, the logo box measures 892.8 × 333.4 CSS pixels instead of the previous height-limited 20cqh box. Its right edge is 948.6, before navigation begins at 1006.7. `desktop.png` shows the result.
- At 1200 × 800, the logo box narrows to 320 pixels and navigation begins at 373.6, retaining separation.
- All six navigation items share top=33 at both desktop sizes, with zero margins. The old `#howto-open` top margin caused the reported stagger.
- At 844 × 390, the compact 14vh logo rule remains active, all navigation tops equal 25, and the document has no horizontal overflow. The compact title was visually inspected.
- Started Just Cruisin’ through its ready mode button; the title hid, the world rendered, and the browser reported no console errors. This is desktop layout/integration evidence, not physical-phone or audio acceptance.

The desktop CSS reserves horizontal space for navigation and increases logo height only above 1200px width and 500px height. No gameplay or image assets changed.

Validation: `npm run check`, `npm run build`, and `git diff --check` passed.

## Registered logo lights

Replaced the background-only marquee with one 3:1 image frame and twelve decorative CSS overlays, positioned using bulb centers in the 2172 × 724 source artwork. The glows use fixed radial gradients and animate opacity only, with an 11-second repeating stagger. No WebGL lights, JavaScript timers, or animation dependencies were added.

- At 1860 × 926, the shared image/overlay frame is 892.8 × 297.6 at y=55.6, moving the title down 37 pixels from the earlier y=18.5 position. `illuminated-desktop.png` shows the result.
- At 844 × 390, image and overlay frame both measure 163.8 × 54.6, with all twelve lights and no horizontal document overflow. Visually checked the bulb registration at both sizes.
- The production Settings accessibility checkbox stops all twelve animations (`animation-name: none`) and retains opacity 0.3. Restored the original unchecked preference afterward. The existing operating-system Reduced Motion rule also targets these descendants; no OS preference was changed during this check.
- Starting through the ready Just Cruisin’ plank boots the game and pauses all twelve lights. Browser error log remained empty. Closed the test tab and stopped the owned server.

Logo-light validation: the full `npm run check`, production `npm run build`, and `git diff --check` passed.
