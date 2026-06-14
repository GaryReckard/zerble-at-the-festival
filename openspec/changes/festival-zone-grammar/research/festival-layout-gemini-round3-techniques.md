Here is the deep architectural specification and mathematical blueprint for your Claude Code agent to build the **Worldgen v2** layout, proximity, and composition systems. This specification is designed to operate strictly within your hard technical constraints: 100% deterministic, chunk-by-chunk local evaluation, zero global state, and extremely low execution overhead.

---

## Part 1: Procedural Generation Techniques Survival & Adaptation Matrix

To maintain absolute window-invariance, every generation technique must resolve to a pure function of local coordinate queries and a shared world seed.

| Technique | Survives? | Windowed Adaptation / Stateless Hash-Based Implementation | Local Equivalent (If Dead) |
| --- | --- | --- | --- |
| **Poisson-Disc / Blue-Noise Spacing** | **YES** | Divide space into grid cells of size $s = \frac{r}{\sqrt{2}}$, where $r$ is the exclusion radius. Each cell contains at most one candidate point. Query the cell coordinates $(c_x, c_z)$ and evaluate a deterministic priority value using a spatial hash. Only the candidate with the highest priority in its $3 \times 3$ cell neighborhood survives. | N/A |
| **Voronoi / Worley Partitioning** | **YES** | Jitter-grid seed point generation. For any point $(x, z)$ inside an 80m chunk, query the jittered seeds of only the $9$ neighboring cells. Calculating distances to these $9$ deterministic points finds the true Voronoi boundary in $O(1)$ time.

 | N/A |
| **Wang / Corner Tiles** | **YES** | Seed a lattice of corner vertices at the grid boundaries of your 80m chunks. Run a hash function $H(seed, i, j)$ on the integer coordinates of the corner lattice to set their states. The interior road, path, or biome transitions of the chunk are then resolved purely as a lookup matching these four corner states. | N/A |
| **Lloyd's Relaxation / Point Smoothing** | **NO** | Integrating Voronoi cell centroids is a stateful, iterative global process that cannot be computed in an isolated, stateless window. | **Stateless Jittered Hexagonal Grid**: Use a hex-grid lattice where each cell has a center $C_i$. Apply a deterministic offset vector $\vec{D}_i = \vec{D}_{\max} \cdot \left(\operatorname{hash}(seed, C_i) \cdot 2 - 1\right)$. This achieves natural blue-noise spacing in a single pass without iterative drift. |
| **Gradient / Density Fields** | **YES** | Evaluate continuous, analytical coordinate-based scalar field equations (e.g., layered Perlin/Simplex noise or distance functions) directly inside the chunk generator. Evaluates in $O(1)$ time and guarantees seamless chunk transitions. | N/A |
| **Local Stitching / Seam Agreement** | **YES** | Align roads, paths, and borders to parameterized Bezier splines or line segments $\vec{S}(t)$ running between adjacent hubs. Because the spline geometry is defined purely by the coordinates of the two hubs it connects, any chunk intersecting it can compute identical path boundaries independently. | N/A |

---

## Part 2: Architectural Composition, Proximity & Zoning Rules

A primary issue in playtests is that assets feel "scattered" rather than "composed." To fix this, you must enforce a strict spatial zoning hierarchy. The following rules specify what assets belong near each other, how they are grouped, and how they sit relative to natural boundaries.

```
                         
                             ~~~~ Water ~~~~
                           =================   ◄── Sand Beach Buffer (0m to 3m)
                           H   H   H   H   H   ◄── Hammock Line (3.5m to 5.5m between trees)
                           ▲   ▲   ▲   ▲   ▲
                            ◄── Nestled Camp Ring (3m to 15m)
                           =================
                           [Continuous Forest] ◄── Forest Seeding Field

```

### 1. Music & Stage Plazas (The Anchor Hubs)

* **Stage Sizing and Structural Metrics**:
* **Main Stage**: elevated $1.5\text{ to } 1.8\text{ meters}$ off the ground. Footprint is $24\text{m} \times 12\text{m}$ with a $12\text{m}$ wood roof clearance to accommodate large line arrays.


* **Side Stage**: elevated $0.9\text{ to } 1.2\text{ meters}$. Footprint is $12\text{m} \times 8\text{m}$ with a $6\text{m}$ canopy.


* **Big White Tent Stage**: fully enclosed geodesic dome or marquee fabric structure. It features hanging black acoustic baffles and double-layered mass-loaded vinyl (MLV) soundproofing curtains on backstage walls to contain low frequencies.




* **The Dancefloor Bowl**: A cleared semi-circular cone projecting from the stage front. Usable crowd area is a flat or gently sloped bowl of radius $R_{\text{bowl}} = 40\text{m}$ for Side Stages and $R_{\text{bowl}} = 80\text{m}$ for Main Stages. Inside this bowl, tree density is forced to $0.0$, and campsite spawning is blocked.


* **Grand Entrance Arch**: Must be placed over the primary approach road spline, exactly $100\text{meters}$ back from the stage center. It must span the roadway width ($8\text{m}$) and act as the clear transition point preceding the performance plaza.


* **String Lights on Poles**: Spaced at polar angle intervals of $\theta = \frac{\pi}{8}$ along the outer perimeter of the dancefloor bowl (radius $R_{\text{bowl}}$). Each pole stands $4\text{m}$ high and suspends a catenary string light path to its adjacent pole.


* **Performers & Roaming Brass Band**:
* **Stage Performers**: Deterministically spawned on the stage structure: $1$ Lead Vocal (center front), $1$ Guitar (left), $1$ Bass (right), $1$ Drum Kit (center rear), and $1$ Saxophone (mid-left).


* **Roaming Brass Band**: A group of $5$ characters (Trumpet, Tuba, Saxophone, Snare, Trombone) led by a Grand Marshal holding a parasol. They are parameterized to walk back and forth along the primary road splines using a 1D time-based coordinate offset $t_{\text{band}} = (t_{\text{current}} \cdot v) \pmod{L}$, where $L$ is the road spline length and $v$ is the walking speed.





### 2. Food & Vendor Ecosystems

* **Food Truck Ring**: A radial node of $70\text{meters}$ in diameter. Trucks are aligned along the outer ring circumference using polar angles. Picnic tables are distributed inside the inner concentric ring (diameter $30\text{m}$), leaving a clear $5\text{m}$ pedestrian aisle in front of the trucks.


* **The "Sugar Shack"**: A special vendor structure. To spawn it deterministically without a global coordinator, run a spatial hash on the food ring's hub center:



$$\text{if } \operatorname{hash}(seed, \operatorname{round}(Hub.x), \operatorname{round}(Hub.z)) \pmod{10} < 3$$



The generator replaces the food truck at slot index $0$ with the Sugar Shack asset.


* **Merchandise Rows**: Parallel rows of booths straddling a secondary road segment. Booths spawn on both sides of the street facing the aisle. The street width is set to exactly $5.0\text{meters}$ (the clear aisle). Shopkeeper characters are placed inside each booth, facing outward.


* **Bubble-Vendor Refill Booth**: A space-suit refueling stand. These are sparse and must only be spawned at high-traffic road junctions where three or more roads meet (junction valence $\ge 3$), or on the approach road exactly halfway between the entrance arch and the stage plaza. The minimum spacing between bubble vendors is enforced at $500\text{meters}$ using a sparse blue-noise pruning pass.



### 3. Camping, Lakes & Natural Buffers

* **Lake Geometry and Spline Causeways**:
* Lakes are defined by a 2D continuous noise field where $Lake(M) < 0$.
* If an arterial road spline intersects a lake, a **Causeway** is formed. The terrain height inside the road width envelope is clamped to $1.5\text{m}$ above water level, and stone retaining-wall meshes are spawned along both sides of the road.
* Islands spawn inside lakes where a high-frequency noise layer raises local coordinates back above water level.
* Sandy beaches are generated in the transition band where $0.0 \le Lake(M) \le 3.0\text{meters}$. Canoes are placed parallel to the shore at the shoreline boundary ($Lake(M) \approx 0.1\text{m}$).


* **Campsite Scales**: Small ($4\text{m} \times 4\text{m}$), Medium ($6\text{m} \times 6\text{m}$), and Large ($10\text{m} \times 10\text{m}$). Each site contains a cluster of camp tents, folding chairs, a central chiminea/firepit, tiki torches, an EZ-up canopy, and tapestries.


* **Camping Villages**: Grouped clusters of campsites. They are placed strictly **behind** merchandise rows, offset perpendicularly by a vector $\vec{V}_{\text{off}} = \pm d \cdot \vec{N}_{\text{road}}$, where $d \in [15\text{m}, 30\text{m}]$ and $\vec{N}_{\text{road}}$ is the road normal.


* **Lake Ring Camping**: Campsites are clustered in a narrow band nestled between the beach and the forest treeline ($3.0\text{m} < Lake(M) \le 15.0\text{meters}$). To comply with universal park standards, a hard safety buffer is enforced: no tents or fires can spawn within $3\text{meters}$ of the active water line.


* **Post-less Tree Hammocks**: Hammock assets must be suspended directly between pairs of trees. The generator parses local tree coordinates within the chunk; if any two trees $(T_a, T_b)$ are separated by a distance $3.5\text{m} \le \left\| T_a - T_b \right\| \le 5.5\text{m}$, and the straight-line path between them is clear of other vegetation, a hammock is spawned suspended along the vector $T_b - T_a$.


* **Birds**: Flying flocks are spawned as looping 3D splines at a height of $y = 12\text{m}$ above the canopy. Perched and nesting birds are attached directly to tree branch sockets with a probability scaled by local foliage density.



### 4. Amenities, Logistics & Signage

* **Porta-Potty Complexes**: Toilets must be grouped into linear banks of $4 \text{ to } 8$ units on flat gravel pads. Each bank must feature at least $1$ handwashing station for every $4 \text{ to } 6$ toilets.


* **Placement**: Must sit adjacent to secondary roads (offset by exactly $8\text{m}$) for service truck access.
* **Olfactory Buffer**: Enforce a strict minimum buffer of $30\text{meters}$ downwind/down-gradient from any food truck ring.


* **Sanitation Capacity Scaling**:

$$N_{\text{toilets}} = \operatorname{ceil}\left(\frac{\text{Local Capacity}}{75} \times 1.20 \times 1.15\right)$$



where the local capacity is defined by the peak crowd size of the nearest hub. At least $10\%$ of the units in each bank must utilize the wider, ramp-accessible ADA footprint.




* **Lampposts & Festoon Lights**: Lampposts are placed along primary road edges at regular intervals of $15\text{meters}$. Festoon string lights connecting adjacent lampposts are rendered as catenary curves :



$$y(x) = a \cosh\left(\frac{x - x_0}{a}\right) + y_0$$


* **Floating Bubble-Juice Pickups**: Spawns are determined using a sparse Poisson grid ($r = 30\text{m}$) restricted strictly to open areas (where tree density $< 0.1$) or along the center lines of winding walking paths.

---

## Part 3: Cross-Hub Cluster Placement Protocol

To prevent independent hubs from colliding or placing overlapping vendor rows, the generation pipeline utilizes a **Deterministic Priority Pipeline on Parameterized Edge Splines**. This protocol guarantees that both hubs arrive at the exact same placement decisions without any inter-process communication.

```
                     (Spline Tangent Vector T)
  Hub A (t=0.0) ──────────────►───────►───────►────────────── Hub B (t=1.0)
                        Slot 1 (t=0.35)    Slot 2 (t=0.65)
                        [Priority: 85]     [Priority: 42]
                        (Survives SAT)     (Pruned/Merged)

```

### Mathematical Framework

Let two neighboring hubs be $A = (x_A, z_A)$ and $B = (x_B, z_B)$, separated by a distance $L = \left\| B - A \right\|$. The connecting road spline is parameterized as:


$$\vec{S}(t) = A + t(B - A) \quad \text{for } t \in [0.0, 1.0]$$

We evaluate candidate slots at fixed intervals:


$$t_i = i \cdot \Delta t \quad \text{for } t_i \in [0.15, 0.85]$$

For each slot, the generator calculates:

* **The Forward Tangent**: $\vec{T}_i = \frac{B - A}{\left\| B - A \right\|}$
* **The Perpendicular Normal**: $\vec{N}_i = (-\vec{T}_{i,z}, \vec{T}_{i,x})$
* **Oriented Bounding Box ($OBB_i$)**: Defined by center $S_i = \vec{S}(t_i)$, width $W_i$ (row length along the road tangent), height $H_i$ (booth depth perpendicular to the road), and rotation angle $\theta_i = \operatorname{atan2}(\vec{T}_{i,z}, \dots)$.

Each slot is assigned a deterministic priority value based on its spatial hash:


$$Priority(S_i) = \operatorname{hash}(seed, \lfloor S_{i,x} \rfloor, \lfloor S_{i,z} \rfloor) \pmod{100}$$

### Overlap Resolution via 2D Separating Axis Theorem (SAT)

For two oriented bounding boxes $A$ and $B$, let $\vec{a}_1, \vec{a}_2$ be the orthogonal face axes of box $A$ with half-extents $w_A, h_A$, and $\vec{b}_1, \vec{b}_2$ be the axes of box $B$ with half-extents $w_B, h_B$. Let $\vec{T}$ be the translation vector connecting the box centers. The boxes overlap if and only if for all projection axes $\vec{L} \in \{ \vec{a}_1, \vec{a}_2, \vec{b}_1, \vec{b}_2 \}$:


$$\left| \vec{T} \cdot \vec{L} \right| \le w_A \left| \vec{a}_1 \cdot \vec{L} \right| + h_A \left| \vec{a}_2 \cdot \vec{L} \right| + w_B \left| \vec{b}_1 \cdot \vec{L} \right| + h_B \left| \vec{b}_2 \cdot \vec{L} \right|$$

If this condition holds on all four axes, the oriented rectangles collide, and the lower-priority slot must yield and be pruned.

### Pseudo-code: Order-Independent Overlap & Symmetric Sharing

This logic runs locally inside any chunk intersecting the road corridor, ensuring identical, deterministic placement.

```python
import math

class OrientedBoundingBox:
    def __init__(self, center, tangent, width, height):
        self.center = center # Vector2
        self.axes = [tangent, Vector2(-tangent.y, tangent.x)] # Orthogonal normals
        self.half_extents = [width / 2.0, height / 2.0]

def check_sat_collision(obb_a, obb_b):
    # Vector connecting centers
    translation = obb_b.center - obb_a.center
    
    # Test all 4 face axes
    for axis in obb_a.axes + obb_b.axes:
        # Project translation onto axis
        proj_t = abs(translation.dot(axis))
        
        # Calculate maximum projection radii
        radius_a = obb_a.half_extents * abs(obb_a.axes.dot(axis)) + obb_a.half_extents[1] * abs(obb_a.axes.[1]dot(axis))
        radius_b = obb_b.half_extents * abs(obb_b.axes.dot(axis)) + obb_b.half_extents[1] * abs(obb_b.axes.[1]dot(axis))
        
        if proj_t > (radius_a + radius_b):
            # Found a separating axis; no collision possible
            return False
            
    return True # Overlap confirmed on all axes

def resolve_cross_hub_slot(current_slot, world_seed):
    # Query nearby candidate slots along the road splines in range
    nearby_slots = query_adjacent_road_slots(current_slot.pos, max_search_radius=60.0)
    
    # Sort by priority (highest first) to guarantee deterministic tie-breaking
    nearby_slots.sort(key=lambda s: s.priority, reverse=True)
    
    for neighbor in nearby_slots:
        if neighbor.id == current_slot.id:
            continue
            
        if neighbor.priority > current_slot.priority:
            if check_sat_collision(current_slot.obb, neighbor.obb):
                # Conflict detected. Check for Symmetric Cooperative Sharing rule:
                # If both are food truck rings and land near the exact center corridor of the hubs:
                if (current_slot.type == "F_RING" and neighbor.type == "F_RING" and 
                    0.4 <= current_slot.t_val <= 0.6 and 0.4 <= neighbor.t_val <= 0.6):
                    # Instead of pruning, convert this slot to a Shared Midpoint Plaza
                    current_slot.type = "SHARED_MIDPOINT_PLAZA"
                    current_slot.obb.center = current_slot.road_spline.evaluate(0.5)
                    return True
                
                # Normal conflict: lower priority yields and is pruned
                return False 
                
        elif neighbor.priority == current_slot.priority:
            # Handle rare priority ties with coordinate hashing
            if hash_coords(neighbor.pos) > hash_coords(current_slot.pos):
                if check_sat_collision(current_slot.obb, neighbor.obb):
                    return False
                    
    return True # Slot survives

```

---

## Part 4: Deterministic Forest Clearing & Winding Path SDF

To place drum circles inside dense forest zones, the generator must carve out a pocket in the tree density field and create a navigable dirt track back to the road network. This is achieved using **Constructive Solid Geometry (CSG) on continuous Signed Distance Fields (SDFs)**, executing in microseconds per point and requiring no state storage.

```
                     Tree density field: D_base(M)
               ┌──────────────────────────────────────────┐
               │    o      o      o      o      o      o  │
               │  o   ┌────────────────────┐   o      o   │
               │      │  Clearing (SDF < 0)│        o     │
               │   o  │   * Firekeeper *   │  o           │
               │      │  * Hand Drummers * │      o       │
               │  o   └───┐            ┌───┘    o      o  │
               │    o     │ Path       │     o            │
               │          │ SDF < 0    │          o       │
               └───-──────┴────────────┴──────────────────┘
                               Road Spline

```

### 1. Winding Path Offset Formula

Let the clearing center be $C = (x_c, z_c)$ and the closest point on the road spline be $P = (x_p, z_p)$. The straight-line vector is $\vec{u} = P - C$. To make the path wind organically rather than run in a clinical straight line, we add an analytical perturbation term perpendicular to the path direction:

$$\vec{N}_{\text{path}} = \left(\frac{-u_z}{\left\| \vec{u} \right\|}, \frac{u_x}{\left\| \vec{u} \right\|}\right)$$

For any sample coordinate $M = (x, z)$, project $M$ onto the segment $CP$ to find the projection factor $t \in [0.0, 1.0]$. The winding offset displacement is calculated as:
$$\delta(t) = A \sin(\omega \cdot t + \phi) + B \cos(2.5 \cdot \omega \cdot t)$$where $A = 3.0\text{m}$ (amplitude) and $\omega = 2\pi$ (frequency) are controlled by the world seed. The perturbed path coordinate is:

$$M_{\text{perturbed}} = M + \delta(t) \cdot \vec{N}_{\text{path}}$$

### 2. The Combined SDF Equations

With $M_{\text{perturbed}}$ calculated, the analytical distance fields are:

* **Clearing Distance Field**:

$$d_{\text{clear}}(M) = \left\| M - C \right\| - R_{\text{clear}}$$


* **Winding Path Distance Field**:

$$d_{\text{path}}(M) = \left\| M_{\text{perturbed}} - (C + t \cdot \vec{u}) \right\| - W_{\text{path}}$$



where $W_{\text{path}} = 2.0\text{meters}$ (the cart-width track).
* **Combined Carve Field**:

$$\Phi_{\text{carve}}(M) = \min(d_{\text{clear}}(M), \ d_{\text{path}}(M))$$



### 3. Density Modulation and Asset Placement

To map tree placement and ground texturing:

```python
def evaluate_chunk_point(M, clearing_center, road_point, seed):
    # Calculate the combined signed distance field value for coordinate M
    phi = calculate_winding_sdf(M, clearing_center, road_point, seed)
    
    # Define a transition boundary to smoothly blend the forest edge
    transition_width = 2.0
    blend_factor = smoothstep(0.0, transition_width, phi)
    
    # 1. Modulate Tree Spawning Density
    base_density = sample_fractal_noise(M.x, M.z, seed)
    final_density = base_density * blend_factor
    
    # 2. Ground Texture Blending
    if phi < -1.0:
        # Deep inside clearing or path; paint dirt track
        set_terrain_texture(M, "Dirt_Track")
        
        # Spawn the Drum Circle Cast radially around clearing center
        dist_to_center = distance(M, clearing_center)
        if abs(dist_to_center - 5.0) < 0.5:
            # Spawn Drummers in a ring facing the center
            spawn_actor_facing_target(M, clearing_center, "Hand_Drummer")
            spawn_static_prop(M, "Seating_Log")
        elif abs(dist_to_center - 3.0) < 0.5:
            # Spawn Fire Dancers and Spotters in the active ring
            spawn_actor(M, "Fire_Dancer")
        elif dist_to_center < 1.0:
            # Central campfire spot
            spawn_static_prop(M, "Campfire_Central")
            spawn_actor(M, "Firekeeper")
            
    elif phi < 1.0:
        # Blending zone: transition from dirt track to grass/moss
        edge_blend = smoothstep(-1.0, 1.0, phi)
        set_terrain_blend(M, "Dirt_Track", "Forest_Moss", edge_blend)
    else:
        # Normal forest floor
        set_terrain_texture(M, "Forest_Moss")

```

This SDF pipeline is completely stateless, evaluates in microseconds per sample point, and guarantees that every drum circle has a perfectly aligned, non-cluttered clearance and dirt track leading directly to the main road network, completely independent of chunk loading order.
