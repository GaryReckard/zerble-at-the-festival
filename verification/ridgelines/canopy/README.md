# Wooded Blue Ridge canopy correction

This follow-up corrects the smooth, grassy slopes in the initial ridge pass at
`a48b2b1`. The nearer ranges now carry irregular, overlapping canopy crowns and
a broken treetop silhouette, while distant layers fade into atmospheric color.
The [gallery](gallery.html) shows the actual game and isolated workshop.
The [parent report](../README.md) preserves the initial pass as historical evidence.

## Rendering and ownership

One deterministic 128×128 RGBA data texture supplies crown shade, tint and edge
height. It repeats seamlessly, uses mipmaps and diminishes across the four
ranges; the furthest range skips the lookup. Two narrow indexed fringe strips
break up the nearer crests within the same opaque mesh and material, using
fragment discard at the leaf edge. Night detail is reduced by 84%.

There are no individual tree objects, added lights or shadow casters. The texture
is baked once per backdrop, and updates only change uniforms. Material disposal
releases the owned texture exactly once. The sandbox offers a canopy texture
toggle and a rebuild button; the toggle retains fringe geometry, so it is a
shading comparison rather than a full comparison with the previous model.
Rebuilding also preserves a held midnight palette.

## Measured allocation and geometry

| Backdrop | Draws | Triangles | Vertices | Geometry bytes | Texture bytes including mips |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original rounded hills, `9b25750` | 1 | 18,720 | 56,160 | 2,471,040 | 0 |
| Initial smooth ridges, `a48b2b1` | 1 | 10,240 | 6,168 | 357,504 | 0 |
| Wooded ridges, this correction | 1 | 13,824 | 9,756 | 707,328 | 87,380 |

The current geometry plus texture totals 794,708 bytes, approximately 68% below
the original hills, with approximately 26% fewer triangles. This correction costs
more than the initial smooth ridges and adds texture sampling to textured ridge
fragments. The overhead camera hides the entire backdrop, eliminating its draw.
These are geometry/allocation counts, not a claim of improved device frame time.
The single cold construction sample in [geometry.json](geometry.json) is not a
controlled comparative benchmark.

## Verification on 2026-11-16

- `npm run check` passed, including seeded geometry, exact seams, index bounds,
  silhouette variation, texture determinism, fixed texture versions across 600
  updates, owned-resource disposal, real time-of-day uniforms, and actual chase,
  first-person and overhead camera clipping at ground and elevated positions.
- `npm run build` passed.
- The native in-app browser booted the real game through its ready mode plank
  on Low and Mid, with no captured console errors. Noon and Midnight views were
  checked, alongside maximum chase distance and maximum overhead zoom.
- Three consecutive Mid workshop rebuilds retained 3 draws, 13,872 triangles,
  4 geometries and 4 textures, including the workshop reference floor/grid.
  The canopy toggle retained those counts. See [browser-counters.json](browser-counters.json).
- The held midnight rebuild stayed dark, and temporary test tabs were closed.
  The existing development server was retained.

No physical phone/iPad acceptance or GPU timing comparison was performed.
The pale far-field forest proxies and distant stage diamonds remain separate
systems, and proposed view-dependent tree impostors and evening homestead light
points are not implemented by this correction.

## Captures

- [Mid driving at Noon](driving-noon-mid.jpg) and [Midnight](driving-midnight-mid.jpg)
- [Low driving at Noon](driving-noon-low.jpg) and [Midnight](driving-midnight-low.jpg)
- [Maximum chase distance at Midnight](chase-max-midnight-mid.jpg)
- [Maximum overhead zoom on Low](top-max-low.jpg)
- [Mid workshop at Noon](workshop-noon-mid.jpg), [Midnight after rebuilds](workshop-midnight-mid.jpg), and [texture off](workshop-texture-off-mid.jpg)
- [Low workshop at Noon](workshop-noon-low.jpg) and [Midnight](workshop-midnight-low.jpg)
