# Recommendation

**Rapier 3D (Rust/WASM)** is the best fit for this workload, subject to conditions. It is actively maintained, optimized with SIMD (automatically on) and optional parallelism, and provides rich features (convex/mesh colliders, joints, CCD, sleeping, contact events). It loads as an async WebAssembly module (via `import('@dimforge/rapier3d')`) and has an Apache-2.0 license. We should treat the player/cart as a kinematic body (Rapier has two kinematic modes for user-driven motion) and enable dynamic-vs-kinematic contacts by setting the collider’s active collision types. The Rapier engine runs its fixed-step simulation in JavaScript on the main thread (browser WASM has no native threads on Safari), but is still very fast per-step. 

Use Rapier *if* we can accept the WASM loading overhead and bundle complexity. We would disable multithreading (because Safari iOS lacks SharedArrayBuffer) and rely on its single-thread speed. As a fallback on very low-end or iOS devices, **cannon-es (JavaScript)** could be used for a lighter-weight, all-JS physics with a simpler API, though it lacks CCD and advanced colliders. **Jolt (C++/WASM)** is another option with similar capabilities; it offers both WASM and asm.js builds and even experimental multithreading. In practice Jolt’s asm.js mode ensures it can run on browsers without WASM threads, but its integration is more complex. We recommend Rapier for best performance and feature set, but if bundle size or async loading is unacceptable, consider cannon-es for basic objects. A **hybrid/custom approach** (e.g. scripted motion for simple objects) could be a fallback if full physics proves too costly; however, that sacrifices emergent behavior and complicates maintenance. 

## Physics Engine Comparison

| Engine    | Language/Module              | Load/Thread | Safari/iOS Support                | Key Features                  | License         |
|-----------|------------------------------|-------------|-----------------------------------|-------------------------------|-----------------|
| **Rapier** | Rust→WASM (npm **@dimforge/rapier3d**) | WASM (async)⏤SIMD on by default; no browser threads (Safari iOS only single-thread) | WebAssembly supported (no built-in threads on iOS). Use `-compat` mode if bundler issues. | Dynamic & Kinematic bodies, convex/tri mesh/heightfield, CCD, joints, sensors, sleeping, contact event callbacks | Apache-2.0 |
| **Jolt**   | C++→WASM or asm.js (npm **jolt-physics**) | WASM async or asm; optional multithreading. 7 build “flavours” (wasm, asm.js, plus multithread variants). | Safari requires asm.js or single-thread WASM (threads disabled without cross-origin isolation). ASM fallback guaranteed. | Rigid body dynamics (used in AAA games), convex (and triangle) shapes, limited CCD (sphere/box), joints, sleeping, debug renderer. | MIT |
| **cannon-es** | JavaScript (ES module)       | Pure JS; synchronous import. No multithreading. | Runs on any browser (ES module support needed). | Basic shapes (box, sphere, cylinder, convex, heightfield; *no static triangle mesh collision*), kinematic/static types, simple constraints (distance, hinge, point), sleeping (wake on force). No CCD. | MIT |
| **Ammo.js** | C++→WASM (Bullet port)      | WASM (async) or asm. Single-thread (bullet has internal multithread, but Ammo.js typically single). | Runs on modern browsers; large download (~10MB). | Rich feature set (concave mesh, vehicles, ragdolls, CCD), but heavy and outdated. | zlib (like Bullet) |
| **Custom/Hybrid** | JS logic, simple integrators | No engine (scripts). | Full control, trivial support. | Only handles specific cases you code (e.g. slide a chair with friction formula, keyframe tipping). Little built-in collision or chain reactions; difficult to maintain generically. | N/A (your code) |



## Loading, Browser Support, Licensing

- **Rapier 3D**: NPM packages `@dimforge/rapier3d` provide WASM modules. Initialization is asynchronous (`import('@dimforge/rapier3d').then(...)`). For bundlers that struggle with WASM, the `-compat` UMD builds embed the WASM in base64. It’s tested on browsers including Safari, but Safari’s WASM thread support is lacking (so we must run single-thread). (On Apple Silicon, Rapier can take advantage of its performance cores via Rayon, but that requires native threads which web builds won’t use.) License: Apache-2.0.

- **JoltPhysics.js**: Distributed as `jolt-physics` on npm. Offers multiple builds: a normal WASM, a separate asm.js version, and thread-enabled variants. You can import from `'jolt-physics/wasm'` or `'jolt-physics/asm'` (see docs). Safari/iOS cannot run WASM threads or SharedArrayBuffer, so we’d use either the single-thread WASM or the asm.js build. Example import: `import Jolt from 'jolt-physics'; // default WASM-compat bundle`. Jolt uses MIT license.

- **cannon-es**: Pure JS library (`import * as CANNON from 'cannon-es'`) with no additional assets. No WASM/worker needed. Works wherever ES modules run. Easy to install (`npm i cannon-es`). License: MIT.

- **Ammo.js**: Typically loaded by fetching `ammo.wasm.js` and `ammo.wasm.wasm` (or via `await Ammo()` in code). It’s heavier (many megabytes). License: zlib. We would only use this if we needed features (e.g. full ragdoll) that other engines lack.

All engines are open-source and permissively licensed, so licensing is not a blocker.

## Kinematic Bodies & Collisions

Each engine handles kinematic vs static bodies differently:

- **Rapier**: Has two kinematic modes (position-based or velocity-based) where the user controls motion, and the engine updates velocity/position for realistic contacts. **Important:** Rapier kinematics ignore contact forces by default (the body “goes through” obstacles). Dynamic bodies colliding with a kinematic will respond realistically (they get pushed), but the kinematic itself does not bounce off walls. We can still enable kinematic-vs-fixed collisions if needed via `ActiveCollisionTypes::KINEMATIC_FIXED`. For our game, we will keep the player as kinematic (with its arcade input), and let Rapier push objects out of the way.

- **Jolt**: Provides a “character controller” and also allows moving a rigid body kinematically. In the JS binding, you can create a body and set it to Static or a special “Moving” type, then manually update its position each step. Jolt’s documentation shows a “Rigid body character” type for kinematics. We’d treat NPCs or the cart similarly – code sets their transforms, and Jolt sim responds. (If Jolt offers explicit kinematic vs static tags, we’d use those.)

- **cannon-es**: You set `body.type = CANNON.Body.KINEMATIC` (or give mass=0 for static, nonzero for dynamic). Kinematic bodies have nonzero velocity but ignore forces. They will collide with dynamic bodies and push them (though some tuning may be needed). Out of the box, cannon-es has only static (mass=0) or dynamic, but it recognizes kinematic as a type in the docs. We can move a kinematic by setting `body.velocity` or `body.position` each step, and collisions will be reported if we subscribe.

- **Ammo.js**: Full Bullet semantics: `BT_KINEMATIC` vs `BT_STATIC`. Kinematic objects move and hit dynamics. We would use them similarly if Ammo were chosen.

For all engines, we rely on *fixed-step integration*. Cannon-es uses `world.fixedStep()` by default. Rapier’s `world.step()` takes a fixed time delta. In all cases, we should run physics at a consistent timestep (e.g. 60Hz) and interpolate/forward-render as needed.

**Collision filtering**: All engines support group/mask filtering. For example, cannon-es bodies have `.collisionFilterGroup`/`.collisionFilterMask` (as in original Cannon) for per-object filters. Rapier’s `ColliderDesc` can set collision groups/flags. Jolt has collision layers/filters as well. We’d use filtering to isolate, say, “player pushes chairs but not tree vs tree collisions” if needed.

**CCD (Continuous Collision Detection)**: Important for fast impacts. Rapier supports CCD for rigid bodies (configurable on a per-body basis). Jolt explicitly supports CCD for spheres and boxes. Ammo/Bullet has CCD modes (must enable on shape). Cannon-es has *no CCD* – very fast objects may tunnel through thin colliders. We may need to either widen colliders or limit velocities, or switch to Rapier/Jolt if fast-moving items (e.g. flung water cups) are critical.

**Sleeping & activation**: All three engines can sleep inactive bodies to save CPU. Cannon-es now wakes sleeping bodies when a force is applied. Rapier has built-in sleeping thresholds (configurable per-body) so objects at rest stop being simulated. Jolt also supports putting bodies to sleep and waking them on impulse. We should use sleeping aggressively to limit active objects. All engines allow querying “anyActiveBodies” or similar to skip physics when nothing moves.

**Joints/Constraints**: Rapier has hinge, ball-socket, fixed, and motor joints. Jolt has many constraints including hinge, ragdoll limbs, etc. Cannon-es has basic constraints (distance, hinge, lock) and even a simple vehicle class. We will likely only need very simple joints (maybe for cooler lids or for a loosely hinged sign). Rapier or Jolt provides more stability for chains of many bodies; cannon-es can do a few with care (and limited performance).

**Contact events**: Rapier allows registering callbacks or iterating contact/contact-force events after stepping. Jolt can invoke custom callbacks per collision pair. Cannon-es emits collision events if you hook world’s ContactEquation objects. In general, all engines let you detect when two bodies start/stop colliding. We will use this to detach cups from chairs (e.g. remove a cup-mesh from a chair when their rigid-bodies collide).

## Instanced Mesh Conversion

Because our world uses InstancedMesh for performance, turning one instance into a dynamic object is non-trivial. In practice we would:

- **Detach one instance**: Copy the instance’s transform (and mesh geometry) into a standalone `THREE.Mesh` and remove/disable that instance in the InstancedMesh. This may require updating the InstancedMesh’s buffer (setting that instance’s scale to zero or rebuilding the instance matrix array). 
- **Physics body**: Create a dynamic rigid body for the standalone mesh, matching its collider to the chair geometry. 
- **Re-merging**: After it settles and is far from the player, we can remove the dynamic mesh/body and restore an instance in the InstancedMesh (resetting position to original). 

The overhead: CPU cost for buffer updates and extra draw calls. This is relatively small per object (copying a 4×4 matrix and a mesh), but if done many times per frame it adds up. It’s effectively an O(1) cost per convert, so occasional conversions are fine. Re-building an InstancedMesh with one less instance could be expensive if naively re-creating buffers; a better approach is to keep a “visible” flag per instance. These costs are separate from the physics step cost itself, and should be benchmarked. 

We should measure: e.g. detaching one chair instance from a pool of N instanced chairs – how long does that take in JS? Also: when returning it, how long to update/bind? If this cost is too high on mobile, we might instead cheat by pooling a few dynamic chairs on startup rather than recycling dynamically.

## Dense Pileups & Streaming

We assume physics is **bounded to an active vicinity**. Since the world streams chunks in/out, we will only simulate objects in loaded chunks near the player. Physics bodies in far-off chunks can sleep or be removed. We **do not need a global history** of object state beyond streaming; once an object moves out of range and has no constraints (and no one is carrying it), we can optionally delete its body and reset it if the chunk unloads.

**Allocation pressure**: Frequently creating/destroying bodies or colliders can cause GC pressure. All engines allow reusing or pooling bodies to mitigate this. We should reuse RigidBody/Collider instances when possible or defer creation until needed.

**Worst-case (capacity exhaustion)**: If many objects suddenly interact (e.g. a crowd collision or an exploded cooler scattering contents), physics workload spikes. We must ensure the engine’s solver can handle the number of constraints. For example, Rapier and Jolt are robust, but if you attach hundreds of constraints (like joints for an “occupied chair”), performance could degrade or joints might break. We will impose practical limits: e.g. cap the number of objects one can hold, limit joint counts. We expect the physics to saturate by slowing simulation (larger lag) rather than crashing.

## Worker Thread Considerations

Offloading physics to a Web Worker could keep the render loop smooth. Each engine can run in a worker if we serialize data: e.g. send player/cart motion to worker, step Rapier there, then receive updated object transforms to apply to Three.js meshes. 

- **Rapier**: The WASM module can be loaded in a worker. Communication overhead: each physics step we must postMessage state (positions/inputs) and receive updated body transforms. If we use SharedArrayBuffer (SAB) for a float32 array of positions, we could minimize copies, but Safari does not support SAB without special headers, so likely no SAB in iOS. Without SAB, the message cost (even with Transferable ArrayBuffer) might offset gains for a moderate number of objects. Debugging in a worker is harder (no DOM). 
- **Jolt**: Similar story. If compiled with multithread WASM, Jolt itself could spawn internal threads (but again no Safari threads). We can also run Jolt code in a worker and pass data back. Jolt’s footprint is larger, so worker download time may even exceed main-thread.
- **cannon-es**: Could simply be imported in a worker; since it’s JS, it would mean another copy of the code. The message-passing overhead is similar.

We should benchmark: e.g. 100 bodies, world.step at 60Hz, measure if main-thread physics (blocking render loop) is worse than worker with messaging overhead. Preliminary expectation: on desktop, worker is beneficial (especially if physics is heavy); on mobile, the serialized copy of many object transforms may cost as much as the physics itself, reducing benefit.

In summary, a worker **may help** on slower machines, but adds complexity. If we do it, keep the data transfer minimal (e.g. only velocities/positions of bodies that moved).

## Occupied Chairs and Edge Cases

“Occupied chair” collisions are tricky: if an NPC is “in” a chair, we have two bodies linked (character and chair) plus a joint or attachment. In a rapid collision, either the character falls out, the chair breaks, or the pair spills. We should *not* model a full ragdoll; instead:
- Make the NPC a kinematic or scripted body that can detach on demand. For example, attach the NPC as a child of the chair body until collision force exceeds a threshold, then “detach” (end the joint) and let a character animation or simplified physics handle the fall.
- If we did link them with a physics joint (like a fixed constraint), a strong impulse could blow up solver stability. We should test if Rapier/Jolt handle a body-on-body crash: likely the joint will either break or the solver will resolve into some unnatural motion. If one engine consistently “explodes” in that scenario, that is a sign to handle it higher-level (e.g. on heavy chair collision, simply unseat the NPC via code).

## Benchmark Plan

We propose the following minimal benchmarks:

- **Isolated Physics Test**:  
  - Setup:  a stack of 100 chairs (boxes) resting, then collide a moving box into them.  
  - Metrics: physics step time (ms) for each engine (Rapier, Jolt, cannon-es) at a fixed 60Hz step, with `performance.now()`. Also count collisions/joints.  
  - Pass: Rapier and Jolt achieve acceptable step time (e.g. <8ms with 100 bodies) on target hardware. Cannon-es is slower but under 16ms.  
  - If Rapier or Jolt *cannot* simulate this in reasonable time, our recommendation fails.

- **Instanced-mesh Conversion Test**:  
  - Setup: Use Three.js to create an `InstancedMesh` of 1000 identical chairs.  
  - Test: Remove one instance (take its transform, spawn a new mesh), then reapply it. Measure how long (ms) this takes on desktop/mobile.  
  - Criteria: Time cost should be small (<1ms) per conversion on a typical device. If converting is too slow (say >5ms), we need to reconsider how many dynamic bodies we create per frame.

- **Worker Synchronization Test**:  
  - Setup: Use Rapier (or cannon) in a Worker. Simulate 50 objects with streaming positions.  
  - Test: Each frame, post a message with player transform, and receive back 50 body transforms. Measure round-trip latency and frames dropped.  
  - Criteria: If the overhead (~copying e.g. 50 vectors) plus solve time is less than doing physics on main thread (especially on mobile), then worker use is justified. Otherwise, keep physics on main thread.

- **Occupied Chair Collision**:  
  - Setup: Rapier or Jolt world with one box (“chair”) and one kinematic “NPC” above it. Drive the NPC (or chair) into a wall at speed.  
  - Test: Observe the outcome. Do we see realistic push-off or unnatural overlap? Does the NPC detach appropriately?  
  - Criteria: If the engine causes a pass-through or “explosion” (extremely large recoil), we must implement a manual detach. If it produces a reasonable albeit imperfect collision, the engine is acceptable.

- **Render Integration Test**:  
  - Setup: A minimal Three.js scene with 50 dynamic objects (meshes) and corresponding physics bodies.  
  - Test: Ensure physics step results are correctly mirrored to mesh transforms each frame.  
  - Criteria: No artifacts in syncing (no visible jitter or lag between physics and rendering).

Each experiment isolates one assumption. We treat engine performance figures from documentation as prior knowledge but verify in our actual environment. For example, Rapier’s “fast” claim must be tested with our object types. The biggest uncertainties include: browser-specific performance (esp. Safari), multithreading viability, and instancing overhead. 

**Distinguishing Verified vs Assumed:** Verified facts (from sources) include load mechanisms, license, and basic API features. Our inferences (marked above) include expected performance trade-offs on mobile, the exact behavior of kinematic collisions, and instanced conversion cost—these require the proposed tests to confirm. 

# What I would test before trusting this report

1. **Real-time Physics Step Cost:** Implement a micro-benchmark in-browser that steps Rapier, Jolt, and cannon-es worlds for 100 dynamic bodies (boxes or spheres) and logs `world.step()` duration on an iPhone and on desktop. **Pass:** Rapier (and Jolt) step times are small enough (e.g. <5ms per step on desktop, <10ms on mobile). **Fail:** If e.g. Rapier takes >16ms at 60Hz, our recommendation is too optimistic.

2. **InstancedMesh Dynamics:** Create a Three.js InstancedMesh of 500-1000 objects. Programmatically “pick up” one instance: copy its matrix into a new Mesh, remove it from the InstancedMesh, then reapply it. Time this conversion (e.g. using `performance.now()` around the detach/attach). **Pass:** The round-trip costs under ~5ms (allowing many actions per second). **Fail:** If a single detach/reattach is slow (e.g. >20ms), dynamic conversions will bog down.

3. **Worker vs Main:** Put Rapier (or cannon-es) in a Web Worker. Send a dummy position update and wait for a physics step. Measure end-to-end latency. Compare to doing the step on main thread (no postMessage overhead). **Pass:** Worker approach is faster or at least smoother (less main-thread blocking) than main-thread physics for the same object count. **Fail:** If messaging overhead dominates (e.g. latency > frame time), then skip worker.

4. **Occupied-Chair Behavior:** Simulate the player/cart (kinematic) colliding with a chair+NPC (dynamic+attached). Check if the NPC remains on the chair or falls off naturally. If not, simulate ourselves by un-parenting the NPC in code. **Pass:** Engine handles the collision stably (NPC shifts realistically). **Fail:** Engine produces a glitchy explosion or NPC remains locked; we then must implement manual detachment logic.

5. **Edge-case Collisions:** Test a very heavy collision (e.g. two fast-moving cubes) to ensure CCD works. For cannon-es (no CCD), verify nothing critical goes through. **Pass:** Either no tunneling occurs in our use-case, or our speed limits prevent it. **Fail:** If fast objects clearly tunnel, we must restrict velocities or switch engine.

Each test has clear outcomes. Testing Rapier’s actual stepping cost and instancing cost are high priority, as they directly validate our main performance assumptions. If, for example, Rapier’s WASM load time is too high on mobile, or it still lags in a small world test, we’d reconsider the recommendation. Similarly, if worker tests show no benefit, we’d stick to main-thread physics. These experiments separate hard facts (measured timings) from our current inferences.