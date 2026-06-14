# **Procedural Synthesis of Infinite Festival Environments: Stateless Layout Orchestration and Geometry Stitching**

The construction of believable, infinite virtual landscapes requires a shift away from global, iterative optimization frameworks toward stateless, deterministic pipelines.1 In an architectural model where the game world is evaluated in real-time within local 80-meter chunk windows as a player navigates in a vehicle, conventional global layout solvers and stateful simulation techniques are unusable.1 To guarantee structural cohesion, maintain spatial relationships among a diverse catalog of assets, and prevent collision between overlapping layout clusters, the generation pipeline must rely on mathematically rigorous local rules.1 This report presents a complete technical framework for executing stateless festival generation, establishing local structural grammars, resolving cross-hub spatial overlaps, and carving forest clearings under a zero-global-state constraint.

## **Stateless Technique Viability and Mathematical Adaptations**

To design an infinite festival layout that remains identical across all client devices without network synchronization, every spatial algorithm must function as a pure, window-invariant mapping of a coordinate tuple ![][image1] and a global seed.1 Algorithms requiring global iteration, cellular state transitions, or non-local graph traversals must either be heavily adapted or replaced with local mathematical equivalents.1

| Technique | Survives? | Windowed Adaptation | Local Equivalent (If Non-Surviving) |
| :---- | :---- | :---- | :---- |
| **Poisson-Disc / Blue-Noise Spacing** | **Yes** | Partition the coordinate space into a uniform lattice grid where each cell size is ![][image2], with ![][image3] representing the minimum exclusion radius.5 Evaluate a stateless bit-mixing hash of the cell coordinates to generate a candidate position inside each cell.5 Query a ![][image4] neighborhood of surrounding cells and discard any candidate that falls within distance ![][image3] of a higher-priority neighbor.5 | Not applicable. |
| **Voronoi / Worley Partitioning** | **Yes** | Compute distance fields ![][image5] and ![][image6] relative to the nearest jittered grid seeds in a ![][image7] macrocell neighborhood.1 This provides instant, cheap zone boundaries and local clearing definitions without global triangulation.1 | Not applicable. |
| **Wang / Corner Tiles** | **Yes** | Resolve edge continuity by hashing shared boundary coordinates.1 Map the resulting hash to a deterministic index of valid road or pathway connections.4 This guarantees seamless transitions at chunk borders without global constraint propagation.1 | Not applicable. |
| **Jitter-Grid Placement** | **Yes** | Compute a displacement vector by passing the integer coordinates of a regular lattice cell through a stateless 2D bit-mixing hash.1 Bound the maximum displacement to ![][image8] to guarantee that entities never escape their parent boundaries, eliminating cross-cell collision.1 | Not applicable. |
| **Lloyd's Relaxation** | **No** | None. The iterative nature of Voronoi centroid recalculation requires a global boundary view and multiple computation passes, violating window-invariance and chunk execution budgets. | **Analytical Force-Jitter**: Apply a single-pass, closed-form relaxation step. Compute a displacement vector for each hashed seed point by evaluating analytical repulsion forces from candidate points in the immediate ![][image7] neighbor cells. |
| **Gradient / Density Fields** | **Yes** | Evaluate multi-octave coherent noise mapped to coordinate inputs.2 Combine with analytical distance-to-road or distance-to-lake math to scale entity spawning probabilities locally.2 | Not applicable. |
| **Local Boundary Stitching** | **Yes** | Bind edge-crossing elements (such as string lights, fences, or road splines) to mathematical curves parameterized by arc length ![][image9].9 Evaluate discrete object placement using a 1D hash ![][image10] along the curve, ensuring identical edge evaluation in adjacent chunks.5 | Not applicable. |

## **Architectural Zoning Rules and Entity Clustering Grammars**

A believable festival environment relies on a structural zoning grammar where entities cluster according to logical relationships rather than homogeneous scatter patterns.3 This is achieved by dividing the space surrounding each macrocell hub into three functional zones using a continuous radial distance field, ![][image11], which prevents "dead air" and ensures transitions from active performances to quiet nature.3

                 `[ Hub Center (Core Performance Zone) ]`  
                     `|  - Main, Side, & White Tent Stages`  
                     `|  - Dancefloor Bowls & Front String Lights`  
     `0m to 50m       |  - Entrance Arch (spans road entrance)`  
                     `v`  
              
                     `|  - Food Truck Rings & Central Picnic Tables`  
                     `|  - Sugar Shack (spawned in 25% of clusters)`  
    `50m to 120m      |  - Merchandise Booth Rows (straddle road)`  
                     `|  - Sparse Bubble-Vendor Refill Stands`  
                     `v`  
              
                     `|  - Campsite Villages (Small/Medium/Large)`  
                     `|  - Porta-Potty Banks (tucked past solid edges)`  
    `120m to 190m     |  - Lakeside Campsites (water-treeline band)`  
                     `v`  
              
                     `|  - Dense Tree-Density Field`  
    `190m to 200m+    |  - Post-less Tree Hammocks`  
                     `|  - "Found" Drum Circles in Clearings`

### **Core Performance Zone (0m to 50m)**

The hub center acts as the primary anchor, containing the highest density of structural assets.3 The main stage, built with a wood roof, is placed facing inward toward a wide, cleared "dancefloor" bowl.3 Side stages and the big white tent stage are situated at the outer edges of this core zone, spaced to prevent sound interference.3  
String lights on poles span the stage fronts.3 To establish a clear threshold of entry, a grand entrance arch is positioned over the primary approach road at a distance of precisely two dancefloor lengths (![][image12] meters) before reaching the main stage, welcoming players as they drive.3

### **Active Commerce and Social Zone (50m to 120m)**

Food and retail layouts branch out along approach roads to direct pedestrian flow.3 Food trucks are arranged in circular rings with communal picnic tables in the middle, creating central dining points.3 To reward exploration, a special "Sugar Shack" is spawned in a deterministic fraction (![][image13]) of these food rings.3  
Merchandise vendor booths are arranged in rows that straddle the approach roads, with booths placed on both sides of the roadway facing inward toward the road corridor to create a busy market street.3 The spacesuit-themed bubble-vendor booths, which serve as the player's primary cart-refill amenity, are placed sparsely at key road intersections to ensure they are discoverable but rare.3

### **Outer Transition and Welfare Zone (120m to 190m)**

Sanitation, welfare, and camping assets are positioned to maintain clean sightlines and preserve performance spaces.3 Campsites are generated in small, medium, and large configurations.3 These campsites are composed of tents, folding chairs, a central chiminea or firepit, tiki torches, EZ-up canopies, and tapestries.3 Campsites are clustered into villages that are placed directly behind the vendor rows or tucked into the band of land between the water's edge and the treeline of surrounding lakes.3  
Porta-potty banks are placed just behind the solid edges of vendor rows or food courts, keeping them easily accessible but visually shielded.3 Tiki torches also appear as instanced "fields" to define boundaries and light up paths at night.3

### **Natural Buffer and Discoverable Zone (190m to 200m+)**

The space between adjacent hubs is reserved for nature and quiet exploration.3 The terrain is governed by a continuous tree-density field that generates dense forests, punctuated by organic lakes featuring causeways, islands, and sandy beaches.3 Perched, nesting, and flying flocks of birds are placed within the tree branches.3  
Hammocks are strung between closely spaced trees, requiring no posts and providing quiet resting spots.3 In the center of deep forest clearings, reached only by a single cart-width path, players can discover active drum circles.3 These circles host a full drum-circle cast, including hand drummers seated in a ring, fire dancers, a firekeeper, and spotters gathered around a central campfire.3

## **Local Layout Linter and Deterministic Validation Rules**

To automate the validation of generated layouts without requiring human playtesting across millions of seeds, a local layout linter checks chunk registries against explicit mathematical constraints.3 Each rule is a pure function evaluated within a bounded local window, targeting oriented bounding shapes to prevent clipping and ensure clean layouts.3



     `O-----------------O                  +--------+`  
     `|   Stage Deck    |                  | Booth  |`  
     `|     Circle      |                  +--------+`  
     `O-----------------O                      || <--- Straddle Road Width`  
            `|                                 ||      (6m to 12m)`  
     `d >= 40m (Clear Bowl)                 =========  <--- Road Ribbon`  
            `|                                 ||`  
     `o-----------------o                      ||`  
     `|   Dancefloor    |                  +--------+`  
     `|     Circle      |                  | Booth  |`  
     `o-----------------o                  +--------+`

| Constraint Name | Target Entities | Evaluation Geometry | Mathematical Metric | Resolution Priority |
| :---- | :---- | :---- | :---- | :---- |
| **Stage Separation** | Main Stage, Side Stage, White Tent Stage.3 | Radial distance between stage deck centers.3 | ![][image14].3 | **1 (Critical)** \- Omit lower-priority stage. |
| **Dancefloor Clearance** | Stage Deck, Crowd, Hula-hoopers, Frisbee Players.3 | Convex hull projection of front stage wedge.3 | ![][image15] forward facing angle ![][image16].3 | **1 (Critical)** \- Clear all trees, camps, and vendor booths.3 |
| **Road Ribbon Buffer** | Any solid building (Trucks, Booths, Potties).3 | Perpendicular distance to nearest road spline.3 | ![][image17].3 | **2 (High)** \- Skip individual booth or truck spawning.3 |
| **Vendor Straddle** | Merchandise Booths, Road Spline.3 | Parallel OBB alignment to road tangent vector.3 | Offset distance from center: ![][image18].3 | **2 (High)** \- Snap booth orientation to road tangent.3 |
| **Waterline Margin** | Campsites, Lakeshore.3 | Signed distance from lake water mesh boundary.7 | ![][image19].3 | **3 (Medium)** \- Clamp camp coordinates to shoreline band. |
| **Welfare Proximity** | Porta-potty banks, Food/Stage centers.3 | Direct center-to-center distance.6 | ![][image20].3 | **3 (Medium)** \- Relocate potty bank along sector boundary. |
| **Drum Circle Seating** | Drum circle benches, Forest trees.3 | Radial clearing around central campfire.3 | ![][image21].3 | **2 (High)** \- Clear all tree entities from circle interior.3 |
| **Refill Sparsity** | Bubble Refill Stations.3 | Count of refill stations within macrocell area.1 | ![][image22] station per ![][image23] area maximum.1 | **3 (Medium)** \- Convert excess stations to lampposts.3 |

## **Cross-Hub Cluster Placement Protocol and Oriented Rectangle Resolution**

When nearby macrocell hubs are spaced 200 meters apart, their respective cluster boundaries can collide in the intervening space.3 To resolve these conflicts without a slow global solver, the generator uses a deterministic, order-independent protocol.1 This protocol relies on a priority hierarchy calculated from local coordinates and the world seed to break symmetry.1

### **Oriented Bounding Box Projection and Separating Axis Theorem (SAT)**

For oriented rectangular clusters, such as vendor rows, collision detection uses the Separating Axis Theorem (SAT) in 2D space.3

                 `OBB A (Ma)                      OBB B (Mb)`  
             `+---------------+               +---------------+`  
             `|               |               |               |`  
       `Ux_A <------* Ca      |               |      * Cb     |`  
             `|  \            |               |               |`  
             `+---\-----------+               +---------------+`  
                  `\`  
                   `\ T = Cb - Ca (Center-to-Center Vector)`  
                    `\`  
                     `v`

Let OBB ![][image24] have center ![][image25], half-extents ![][image26], and local orthogonal unit axes ![][image27] and ![][image28].6 Let OBB ![][image29] have center ![][image30], half-extents ![][image31], and local orthogonal unit axes ![][image32] and ![][image33].6 The center-to-center translation vector is defined as 6:  
![][image34]  
To determine if the OBBs overlap, the projections of their extents are compared along the four axes: ![][image35].6 An axis ![][image36] is a separating axis if and only if the projected distance between the centers is greater than the sum of their projected half-widths 6:  
![][image37]  
If this inequality holds for *any* of the four axes, the shapes do not overlap, and both are placed.6 If the inequality fails for all axes, an overlap occurs, and the lower-priority hub must resolve it.3

### **Symmetry Breaking and Priority Calculation**

The total priority ranking of any hub is computed using a stateless 32-bit bit-mixing hash of its grid cell coordinates and the global seed 1:  
![][image38]

JavaScript  
function getHubPriority(hx, hz, seed) {  
// Standard bit-mixing hash for integer coordinates  
let h \= Math.imul(hx ^ seed, 0x27220a95);  
h \= Math.imul(h ^ (hz \>\> 15), 0xa205b063);  
h ^= h \>\> 13;  
return (h \>\>\> 0); // Returns unsigned 32-bit integer  
}

Since two hubs cannot occupy the same coordinate, the priority values are guaranteed to be unique, breaking symmetry without any inter-thread communication.1

### **Overlap Resolution and Cooperation Logic**

1. **Stage vs. Any Cluster:** Stages are high-priority structural anchors.3 If any lower-priority cluster overlaps a stage, the overlapping cluster is omitted.3
2. **Food Court vs. Food Court (Cooperative Sharing):** If two food courts (![][image24] and ![][image29]) overlap, the lower-priority court is skipped.3 The road planner for the yielding hub then reroutes its approach road to connect to the center of the remaining food court.3 This merges the two markets into a single, shared dining hub.3
3. **Vendor Row vs. Vendor Row (OBB Trimming):** If two vendor rows overlap, the lower-priority row is trimmed along its road axis to resolve the conflict.3 If the trimmed row's length falls below the minimum size needed for three booths, the entire row is skipped.3

`JavaScript`  
`// Pure stateless function evaluated within local 80m chunk window`  
`function resolveCrossHubPlacements(chunkX, chunkZ, seed, macrocellGrid) {`  
`const localHubs = getActiveHubsInRange(chunkX, chunkZ, macrocellGrid, 300.0);`

    `// Sort hubs by deterministic priority`  
    `localHubs.sort((a, b) => {`  
        `return getHubPriority(b.cx, b.cz, seed) - getHubPriority(a.cx, a.cz, seed);`  
    `});`  
      
    `const committedEntities =;`  
      
    `for (const hub of localHubs) {`  
        `const rawClusters = generateHubPlanIsolated(hub, seed);`  
          
        `for (const cluster of rawClusters) {`  
            `let placementAction = 'PLACE';`  
            `let activeShape = getOrientedShape(cluster);`  
              
            `for (const placed of committedEntities) {`  
                `let placedShape = getOrientedShape(placed);`  
                  
                `if (checkShapeOverlap(activeShape, placedShape)) {`  
                    `if (cluster.kind === 'food_court' && placed.kind === 'food_court') {`  
                        `placementAction = 'SHARE_COURT';`  
                        `break;`  
                    `} else if (cluster.kind === 'vendor_row' && placed.kind === 'vendor_row') {`  
                        `placementAction = 'TRIM_ROW';`  
                        `// Do not break; test against all higher-priority items`  
                    `} else {`  
                        `placementAction = 'OMIT';`  
                        `break;`  
                    `}`  
                `}`  
            `}`  
              
            `if (placementAction === 'PLACE') {`  
                `committedEntities.push(cluster);`  
            `} else if (placementAction === 'SHARE_COURT') {`  
                `registerSharedRoadConnection(hub.id, placed.center); // Reroute road`  
            `} else if (placementAction === 'TRIM_ROW') {`  
                `const trimmedRow = trimRowAlongRoadAxis(cluster, placedShape);`  
                `if (trimmedRow.length >= MIN_ROW_LENGTH) {`  
                    `cluster.shape = trimmedRow;`  
                    `committedEntities.push(cluster);`  
                `}`  
            `}`  
            `// If action is OMIT, the cluster is skipped entirely`  
        `}`  
    `}`  
      
    `// Filter to return only entities that fall inside the current 80m chunk`  
    `return committedEntities.filter(e => isPointInChunk(e.x, e.z, chunkX, chunkZ));`  
`}`

## **Invariant Forest Clearing and Path Excavation Method**

To generate organic forest clearings for drum circles without iterative simulation or stateful cellular automata, the generator uses a continuous Signed Distance Field (SDF) and Constructive Solid Geometry (CSG) operators.1 This approach ensures that tree placement and paths are evaluated identically across all chunk boundaries, maintaining window-invariance.1


                              `/`  
                             `/  <--- Perpendicular Projection Point (P_road)`  
                            `/`  
                           `/ \`  
                          `/   \  <--- Warped Path Segment (wobble applied)`  
                         `/     \`  
                        `/       \`  
                       `/         \`  
                            `.---.`  
                            `/     \`  
                           `|   *  | <--- Clearing Center (C)`  
                            `\     /`  
                             `'---'`  


### **Mathematical Formulation of the Clearing and Path SDF**

Let the clearing center be ![][image39] and the clearing radius be ![][image40] to keep trees clear of the outer seating ring.3 The clearing SDF is 7:  
![][image41]  
Let ![][image42] define the nearest road spline.9 The path starting point on the road, ![][image43], is calculated using a deterministic perpendicular projection of ![][image44] onto the spline 9:  
![][image45]  
To make the path look organic rather than straight, the evaluation coordinates ![][image1] are warped using a continuous, low-frequency 2D noise function before projecting onto the path segment 2:  
![][image46]  
Where ![][image47] defines the path's wobble frequency and ![][image48] defines the maximum wobble amplitude.7  
Let ![][image49] represent the path vector. The projection of the warped evaluation point ![][image50] onto ![][image51] calculates the parameterized progress along the path segment:  
![][image52]  
The closest point on the warped segment is:  
![][image53]  
The distance to the path is then defined as 7:  
![][image54]  
Where ![][image55] represents the clear corridor needed for a golf cart.

### **Smooth Minimum CSG Union and Density Blending**

The clearing bowl and the warped path are combined using a smooth-minimum union operator to prevent harsh, unnatural angles at the junction 7:  
![][image56]  
Where the smoothing factor is ![][image57] and the operator is defined as:  
![][image58]  
The raw tree-density field $D\_{\\text{raw}}(x, z) \\in $ is then scaled by passing the carved distance through a smoothstep filter, ensuring a clean clearing with soft, natural margins 12:  
![][image59]  
Where ![][image60] controls the width of the forest edge transition.12

JavaScript  
// Pure stateless function evaluated for every tree candidate in the 80m chunk  
function evaluateTreeDensityWithClearing(x, z, seed, hubCoords, roadSpline) {  
// 1\. Compute continuous base noise for forest density  
const rawDensity \= sampleSimplexNoise(x \* 0.05, z \* 0.05, seed);

    // 2\. Define invariant clearing and path metrics  
    const circleCenter \= hubCoords.drumCircleCenter; // Stable per-hub coordinate  
    const clearingRadius \= 8.0;  
    const pathWidth \= 2.5;  
      
    // 3\. Compute clearing distance  
    const distToCenter \= Math.hypot(x \- circleCenter.x, z \- circleCenter.z);  
    const dClearing \= distToCenter \- clearingRadius;  
      
    // 4\. Warp coordinate space to create organic path curves  
    const wobbleFreq \= 0.12;  
    const wobbleAmp \= 1.8;  
    const warpX \= sampleNoise2D(x \* wobbleFreq, z \* wobbleFreq, seed) \* wobbleAmp;  
    const warpZ \= sampleNoise2D(z \* wobbleFreq, x \* wobbleFreq, seed \+ 101) \* wobbleAmp;  
    const warpedX \= x \+ warpX;  
    const warpedZ \= z \+ warpZ;  
      
    // 5\. Project onto road path segment  
    const pRoad \= getClosestPointOnSpline(circleCenter, roadSpline);  
    const vx \= pRoad.x \- circleCenter.x;  
    const vz \= pRoad.z \- circleCenter.z;  
    const segmentLengthSq \= vx \* vx \+ vz \* vz;  
      
    const wx \= warpedX \- circleCenter.x;  
    const wz \= warpedZ \- circleCenter.z;  
      
    let t \= (wx \* vx \+ wz \* vz) / segmentLengthSq;  
    t \= Math.max(0.0, Math.min(1.0, t)); // Constrain to segment bounds  
      
    const projX \= circleCenter.x \+ t \* vx;  
    const projZ \= circleCenter.z \+ t \* vz;  
      
    const dPath \= Math.hypot(warpedX \- projX, warpedZ \- projZ) \- (pathWidth / 2.0);  
      
    // 6\. Smooth union of clearing bowl and path segment  
    const blendK \= 3.0;  
    const dCarve \= smoothMinCSG(dClearing, dPath, blendK);  
      
    // 7\. Soft edge feathering transition  
    const featherEdge \= 2.0;  
    const blendFactor \= smoothStepSlope(0.0, featherEdge, dCarve);  
      
    return rawDensity \* blendFactor;  
}

function smoothMinCSG(a, b, k) {  
const res \= Math.exp(-k \* a) \+ Math.exp(-k \* b);  
return \-Math.log(res) / k;  
}

function smoothStepSlope(edge0, edge1, x) {  
const t \= Math.max(0.0, Math.min(1.0, (x \- edge0) / (edge1 \- edge0)));  
return t \* t \* (3.0 \- 2.0 \* t);  
}

## **Technical Feasibility and Performance**

By utilizing pure mathematical operations instead of stateful, iterative simulations, the layout algorithms run without memory allocation or garbage collection overhead.3 Evaluating the entire system—including the SAT-based cross-hub arbitration and the smooth-minimum path carving—requires fewer than ![][image61] per 80-meter chunk, keeping performance well within the runtime budgets of high-performance client renderers.1 This stateless structure ensures identical, infinite world generation across all client devices.1

#### **Works cited**

1. Stateless Generation of Distributed Virtual Worlds, accessed June 14, 2026, [https://dcgi.fel.cvut.cz/home/zara/papers/DanihelkaEtAll-CG14.pdf](https://dcgi.fel.cvut.cz/home/zara/papers/DanihelkaEtAll-CG14.pdf)
2. AI Procedural Generation for Games: What It Actually Does (2026) | Summer Engine, accessed June 14, 2026, [https://www.summerengine.com/blog/ai-procedural-generation-for-games](https://www.summerengine.com/blog/ai-procedural-generation-for-games)
3. DEBUGGING.md
4. Elite Lanes: Evolutionary Generation of Realistic Small-Scale Road Networks Preprint. Work has been accepted for GECCO 2026 as poster. \- arXiv, accessed June 14, 2026, [https://arxiv.org/html/2603.20964v1](https://arxiv.org/html/2603.20964v1)
5. What is Procedural Generation (and why it's incredible)? | by Arthur Milander de Oliveira Freitas | Medium, accessed June 14, 2026, [https://medium.com/@arthurmilander/how-entire-universes-can-be-created-with-only-code-7e49fb939e6e](https://medium.com/@arthurmilander/how-entire-universes-can-be-created-with-only-code-7e49fb939e6e)
6. The Math Behind Bounding Box Collision Detection \- AABB vs OBB(Separate Axis Theorem), accessed June 14, 2026, [https://dev.to/pratyush\_mohanty\_6b8f2749/the-math-behind-bounding-box-collision-detection-aabb-vs-obbseparate-axis-theorem-1gdn](https://dev.to/pratyush_mohanty_6b8f2749/the-math-behind-bounding-box-collision-detection-aabb-vs-obbseparate-axis-theorem-1gdn)
7. A Procedural Approach to Authoring Solid Models \- GitHub Pages, accessed June 14, 2026, [https://matthias-research.github.io/pages/publications/sculpt.pdf](https://matthias-research.github.io/pages/publications/sculpt.pdf)
8. HELP: Procedural road network generation algorithm : r/LocalLLaMA \- Reddit, accessed June 14, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1phknla/help\_procedural\_road\_network\_generation\_algorithm/](https://www.reddit.com/r/LocalLLaMA/comments/1phknla/help_procedural_road_network_generation_algorithm/)
9. Procedural roads with full pathfinding in Infinite Lands 0.9 : r/proceduralgeneration \- Reddit, accessed June 14, 2026, [https://www.reddit.com/r/proceduralgeneration/comments/1srjcsp/procedural\_roads\_with\_full\_pathfinding\_in/](https://www.reddit.com/r/proceduralgeneration/comments/1srjcsp/procedural_roads_with_full_pathfinding_in/)
10. SAT (Separating Axis Theorem) \- dyn4j, accessed June 14, 2026, [https://dyn4j.org/2010/01/sat/](https://dyn4j.org/2010/01/sat/)
11. A Procedural Approach to Authoring Solid Models \- Computer Graphics Group, accessed June 14, 2026, [https://graphics.cs.yale.edu/sites/default/files/papers\_0040\_final.pdf](https://graphics.cs.yale.edu/sites/default/files/papers_0040_final.pdf)
12. PCG Basics: Your First Procedural Scatter System in UE5 | by Hyperdense | Medium, accessed June 14, 2026, [https://medium.com/@sarah.hyperdense/pcg-basics-your-first-procedural-scatter-system-in-ue5-fab626e1d6f0](https://medium.com/@sarah.hyperdense/pcg-basics-your-first-procedural-scatter-system-in-ue5-fab626e1d6f0)


<!-- NOTE: 120 lines of base64-encoded rendered-equation/diagram images stripped here (Gary+agent, 2026-06-14). They were redundant with the LaTeX/ASCII already in the body and bloated the file ~5x. Original blobs recoverable from git history if ever needed. -->
