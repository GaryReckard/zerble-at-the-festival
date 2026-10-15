# Food truck model references and visual direction

## What real concession rigs share

- A serving window is the defining face, with a fold-up gull-wing hatch above a counter shelf. [SDG Trailers' food and concession trailer overview](https://sdgtrailers.com/trailers/food-and-concession-trailers/) describes one to three windows, a raised awning, and a stainless counter as the customer-facing arrangement.
- Step vans and trailers create different silhouettes. A real 16-foot step-van build pairs a large service opening with roof-mounted ventilation and under-mounted equipment. [FoodTrucks4Sale's SKY View build sheet](https://foodtrucks4sale.com/vehicle-portfolio/sky-view-food-truck/) lists a 72-inch awning window, roof A/C, and exhaust hood.
- Branding and canopy details distinguish otherwise similar white boxes. [Concession Nation](https://concessionnation.com/) describes configurable menu boards, awnings, lighting, and multiple truck/trailer formats; [MOBITRUCK's compact project](https://mobitruckusa.com/projects/da-lorenzo) shows a compact body with a serving window and roof identity sign.

## Applied in the model

`src/models/foodTruck.js` selects one of three shared-geometry silhouettes with the existing single random draw: a rounded cab-over box truck, a tall walk-in step van, or a compact tandem-wheel concession trailer with a tow tongue. Each has a true cut-through service opening with a dark kitchen recess, inner worktop, customer shelf, four-bar surround, raised gull-wing awning and supports, and textured brand/menu faces. The cab-over adds driver glass, door seams, front lights, wheel arches, and a taco roof badge; Moonbean has roof exhaust and a coffee-cup marker; Pizza Pie has a two-rail A-frame, landing jack, pizza badge, and toppings. Six bright body palettes keep the festival tone while accent colors separate each service face.

The builder still returns a scaled `THREE.Group`, keeps `FOOD_TRUCK_SCALE` and the current import contract, pools shared geometry/materials, tags them for safe streamed-chunk disposal, and does not consume additional RNG values. Only the first body mesh casts a shadow; small trim, counters, windows, wheels, and roof equipment remain shadow-free.

## Verification status

`check.html` imports the actual builder and Three.js, enumerates all 18 style/palette slots, and checks single-draw RNG behavior, shared finite geometry/material/texture resources, world-space envelope, shadow-caster limit, service-opening clearance, and actual render submissions. Fixed preview samples `0.03`, `0.41`, and `0.81` select the cab-over, step van, and trailer. Both low and mid tiers pass 889 assertions (see `results-low.json` and `results-mid.json`). Noon and midnight sandbox captures are included. A muted low-tier main-game boot with seed 932033385 passed world generation. `npm run check` passed.

Material-preserving batches cost 13 draws for tacos, 12 for coffee and 11 for pizza, each with one shadow caster. Their scaled radii remain inside the existing 6.12 m collision radius. Geometry is cached for all 18 variants; six shared sign/menu textures provide readable vendor identities.
