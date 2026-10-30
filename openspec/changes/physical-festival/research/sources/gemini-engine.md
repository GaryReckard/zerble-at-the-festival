# **Architectural Strategy for Scalable Physical Interactions in WebGL Environments**

## **Executive Summary and Primary Recommendation**

The integration of emergent, physically reactive mechanics into a procedurally generated Three.js browser game introduces profound architectural tensions. The application—a streaming outdoor music festival featuring an arcade-style player controller (Zerble)—must balance the desire for playful, varied interactions against the strict resource constraints of mobile WebGL environments. The requirement to support sliding camp chairs, tumbling coolers with articulated lids, detaching cups, and expressive Non-Player Character (NPC) collisions necessitates a robust rigid-body physics engine. However, the existing reliance on THREE.InstancedMesh for rendering thousands of static props across streaming procedural chunks strictly precludes running continuous physical simulations for every object.  
To resolve this, the system must employ a highly bounded "promotion and demotion" architecture. Props remain cheap, static instanced geometries by default. Upon detecting an interaction vector—such as player proximity, an NPC collision, or an incoming projectile—specific objects are logically extracted from the instanced buffer, promoted into dynamic rigid bodies governed by a WebAssembly (WASM) physics solver, and paired with standalone Three.js meshes. Once the object's kinetic energy dissipates and the physics engine flags the body as sleeping, it must be demoted back into a static instanced representation to recover CPU cycles and GPU draw calls.  
Following an exhaustive evaluation of available physics engines, WebGL limitations, and JavaScript garbage collection behaviors, the recommended foundational physics engine is **Rapier3D**, specifically deployed via the @dimforge/rapier3d-compat package1.  
The recommendation of Rapier3D rests on several verified conditions. First, the project strictly mandates a no-build, browser-module/import-map workflow. Rapier's \-compat package uniquely supports this by inlining the entire WebAssembly binary as a base64-encoded string directly within the ECMAScript module, entirely bypassing the need for asynchronous .wasm asset fetching or bundler configurations2. Second, deploying browser games to diverse platforms, particularly third-party portals like itch.io, frequently results in execution within nested iframes that lack strict Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers6. The absence of these headers disables SharedArrayBuffer support across modern browsers (including iOS Safari), which neutralizes the multithreading advantages of competing engines like Jolt Physics7. Consequently, the architecture demands a highly optimized, single-threaded impulse solver capable of resolving dense pileups without multithreading, an area where Rapier3D excels9.  
This recommendation would change if the deployment parameters were altered. If the application were exclusively hosted on a dedicated, first-party domain where COOP and COEP headers could be strictly enforced, SharedArrayBuffer would become available globally. Under those specific conditions, Jolt Physics would emerge as the superior choice due to its highly parallelized broad-phase and island-solving architecture, which drastically outperforms single-threaded solvers in extreme density scenarios11. Alternatively, if the game design eschewed emergent chain reactions and tumbling physics in favor of purely kinematic sliding, a hybrid geometric approach utilizing three-mesh-bvh for spatial queries and raycasting would eliminate the need for a rigid-body solver entirely, saving approximately 1.9 MB of payload size12.

## **Comparative Analysis of Physics Foundations**

The selection of the underlying physics engine dictates the stability of the interactions, the size of the JavaScript payload, and the memory footprint on constrained devices. The analysis focused on four primary candidates: Rapier3D, Jolt Physics, Cannon-es, and a hybrid geometric approach utilizing Bounding Volume Hierarchies (BVH).

| Feature / Engine | Rapier3D (rapier3d-compat) | Jolt Physics (jolt-physics.js) | Cannon-es | Hybrid (three-mesh-bvh) |
| :---- | :---- | :---- | :---- | :---- |
| **Language Foundation** | Rust ![][image1] WASM10 | C++ ![][image1] WASM14 | TypeScript / JavaScript15 | Pure JavaScript12 |
| **Compressed Size (Gzip)** | **![][image2]** 1.9 MB (base64 inline)16 | ![][image2] 1.8 MB17 | ![][image2] 60 KB18 | ![][image2] 25 KB |
| **Import Map Compatibility** | Excellent (Native ESM via CDN)2 | Moderate (Requires separate WASM fetch)17 | Excellent (Direct ESM import)15 | Excellent (Direct ESM import) |
| **Multithreading Capacity** | Limited (Single-thread focus) | Advanced (Requires SharedArrayBuffer)19 | None | Worker Support12 |
| **Cross-Platform Determinism** | Verified (IEEE 754 compliance)20 | Conditional (Requires specific compilation)17 | Local session only | N/A (Raycast resolution only) |
| **Dense Collision Resolution** | Excellent (Impulse Solvers) | Excellent (Symplectic Euler Integration) | Poor (Frame drops on stacking)10 | N/A |
| **Memory Cleanup Model** | WASM GC / Explicit Removal | Explicit manual Jolt.destroy() required17 | Automatic (JS Garbage Collection) | Automatic (JS Garbage Collection) |
| **License** | Apache-2.0 / MIT21 | MIT10 | MIT18 | MIT |

Rapier3D stands out due to its native support for the required import-map workflow and its continuous collision detection (CCD) capabilities, which prevent fast-moving objects (such as a kicked cup) from tunneling through thin barriers like directional signs9.  
Jolt Physics represents the current industry gold standard for C++ rigid-body simulation, famously powering AAA titles such as *Horizon Forbidden West*23. While its JavaScript port via Emscripten is highly performant, it introduces severe friction for this specific architectural context. The Emscripten compilation requires developers to manually invoke Jolt.destroy() on nearly every instantiated object, as the engine utilizes reference counting (RefTarget) that the JavaScript garbage collector cannot trace17. Failing to meticulously track and destroy bodies, shapes, and constraints during the continuous promotion and demotion cycles inherent to streaming chunks will result in catastrophic memory leaks, inevitably leading to browser crashes on iOS25.  
Cannon-es is a lightweight, pure-JavaScript engine that avoids the memory boundary crossing of WASM entirely, offering a trivial footprint of approximately 60 KB15. However, it utilizes an older Gauss-Seidel iterative solver that performs poorly under dense resting contacts27. If ten procedural camp chairs are stacked in the music festival and struck by the player, Cannon-es will exhibit severe jitter, interpenetration, and a precipitous plunge in frame rate10.  
The hybrid strategy using three-mesh-bvh allows for ![][image3] raycasting against static geometry12. While incredibly efficient for determining ground height or simple wall sliding, it fundamentally cannot simulate angular momentum, joint constraints (like the articulated cooler lid), or emergent chain reactions, disqualifying it as the primary solution but remaining a valuable auxiliary tool for static terrain queries.

## **Web Worker Viability and Safari/iOS Constraints**

A common proposal for optimizing JavaScript game engines is to offload the physics simulation to a Web Worker, freeing the main UI thread to focus exclusively on rendering and WebGL draw calls. The investigation into worker viability for this specific workload indicates that moving physics to a worker is fundamentally counterproductive under the project's current constraints.  
The crux of the issue lies in thread synchronization. To synchronize a physics thread with a render thread efficiently, developers rely on SharedArrayBuffer (SAB), a JavaScript object that allows multiple threads to read and write to the same memory space without serialization overhead6. However, following the discovery of the Spectre and Meltdown vulnerabilities, browser vendors disabled SAB unless the document is served with strict Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) headers7. Because the game is intended for browser environments and potentially hosted on platforms like itch.io, the application will frequently run inside cross-origin iframes where the developer has absolutely no control over the HTTP response headers7. Consequently, SharedArrayBuffer is disabled in these environments, particularly on iOS Safari8.  
Without SharedArrayBuffer, the only mechanism to communicate between the main thread and a Web Worker is the postMessage API. Passing thousands of transformation matrices (position and quaternion data for every dynamic prop) via postMessage forces the browser to serialize and deserialize the data using structured cloning32. The parsing latency and memory allocations associated with transferring large arrays via postMessage can introduce garbage collection pauses that exceed the 16.67ms frame budget34. Furthermore, triple-buffering the game state across threads introduces an inherent latency of one to two frames29. For an arcade-style controller requiring crisp, immediate collision feedback, a multi-frame delay between pressing an input, the worker calculating the collision, and the main thread rendering the response results in unacceptable input lag. Therefore, the inference is that executing the WASM physics solver synchronously on the main thread is practically superior for this specific constrained architecture.

## **The Promotion and Demotion Pipeline Architecture**

To maintain 60 frames per second, representing the entire outdoor music festival through continuous physical simulation is unviable. The procedural chunks contain thousands of static props. Rendering these as individual THREE.Mesh objects bound to permanent dynamic rigid bodies would saturate both the CPU (via the physics broad-phase) and the GPU (via draw-call overhead). The solution requires a highly orchestrated promotion and demotion pipeline that mutates instanced rendering buffers on the fly.

### **Extracting and Promoting Instances**

Three.js utilizes THREE.InstancedMesh to render thousands of identical geometries in a single draw call, storing the transformation of each instance in a flat Float32Array called the instanceMatrix35. To interact with a specific chair or cooler, the architecture must decouple the visual instance from this batch without triggering costly memory reallocations.  
When a localized interaction is triggered—for example, the arcade controller overlaps a predetermined proximity radius—the following pipeline must be executed synchronously:

> 1. **Target Identification:** The system identifies the specific instanceId of the prop interacting with the player, usually via a spatial hash grid or a localized BVH query.  
> 2. **Matrix Swapping:** The transformation matrix of the target instanceId is read and cached. To visually remove the instance from the instanced mesh without rebuilding the buffer, the system swaps the matrix at the target instanceId with the matrix residing at the index count \- 137.  
> 3. **Buffer Truncation:** The count property of the InstancedMesh is decremented by 1\. The WebGL renderer uses this count to define the draw range; thus, the swapped instance is immediately hidden from the GPU without reallocating the underlying array38.  
> 4. **Buffer Synchronization:** The flag instancedMesh.instanceMatrix.needsUpdate \= true is set, notifying Three.js to upload the mutated portion of the buffer to the GPU on the next render pass40.  
> 5. **Physical Promotion:** A standalone THREE.Mesh is instantiated at the extracted transformation matrix. Simultaneously, a dynamic RigidBody and a corresponding Collider are injected into the Rapier physics world10. The standalone mesh is now bound to the rigid body's transform each frame.

### **The Cost of GPU Upload Bandwidth**

A highly dangerous assumption in this proposed direction is that manipulating InstancedMesh buffers is a zero-cost operation. In Three.js, setting instanceMatrix.needsUpdate \= true forces the engine to upload the *entire* Float32Array backing the buffer to the GPU over the PCIe bus40.  
If a procedural chunk contains an InstancedMesh of 50,000 camp chairs, the instanceMatrix requires 3.2 Megabytes of memory (50,000 instances ![][image4] 16 floats per matrix ![][image4] 4 bytes per float). If a single chair is promoted, the entire 3.2 MB buffer is transmitted to the GPU. If interactions occur constantly, transferring 3.2 MB every frame (at 60 FPS) consumes nearly 200 MB/s of bus bandwidth. On mobile devices with unified memory architectures, this rapid buffer thrashing will induce severe micro-stuttering and thermal throttling.  
To mitigate this, it is proposed that procedural chunks be aggressively subdivided into bounded instancing grids. An InstancedMesh should never exceed 1,000 to 2,500 instances. At 1,000 instances, the matrix buffer is only 64 KB, which can be uploaded safely and repeatedly without saturating bandwidth or triggering heavy V8 garbage collection cycles34.

### **Demotion and Sleep States**

Once the promoted dynamic body's kinetic energy dissipates, it must be returned to the instanced pool. Rapier tracks the linear and angular velocity of all bodies; when these values fall below a predefined threshold, the engine flags the body as "sleeping" to cull it from the active solver iterations42.  
The game loop must poll for newly sleeping bodies. Upon detection, the demotion pipeline reverses the promotion steps:

> 1. The final, resting transform of the sleeping RigidBody is extracted.  
> 2. The InstancedMesh.count is incremented by 1\.  
> 3. The extracted transform is written into the instanceMatrix at the new count \- 1 index.  
> 4. The standalone THREE.Mesh is disposed of, and world.removeRigidBody(body) is invoked in Rapier to explicitly free the WASM memory3.

### **Procedural Streaming and Logical Persistence**

The application streams procedural chunks in and out based on player proximity. A promoted object—such as a cooler currently being pushed or carried by the player—must decouple from its origin chunk's lifecycle.  
To achieve this persistence without duplicating objects upon chunk regeneration, the system must separate logical object identity from rendering handles. Every interactive prop must possess a deterministic global ID derived from its procedural seed and spatial coordinate. When a chunk unloads, the architecture iterates over all active dynamic bodies. If a body originated from the unloading chunk but is currently active, its ownership is transferred to a persistent, non-streamed "Active Interactions" scene graph node.  
When the original chunk eventually reloads, the chunk generation algorithm must query a lightweight hash set of currently promoted global IDs. If an ID is present in the active set, the procedural generator simply omits that instance from the newly constructed InstancedMesh. Once the player moves far enough away that the promoted object is no longer observed, it is garbage collected. The system does not require a permanent history of displaced objects; returning to a distant area will simply regenerate the pristine procedural state, fulfilling the design constraints.

## **Integrating the Arcade Controller and Fixed-Step Timing**

The existing player character, Zerble, utilizes an arcade-style movement system. Rigid-body physics engines are inherently hostile to arcade-style manual position overrides. If a developer manually teleports a rigid body's coordinates every frame to match an arcade controller, the physics engine cannot calculate proper velocities, resulting in erratic collision responses and the total failure of continuous collision detection.

### **Kinematic Position Control**

To preserve the arcade feel while interacting cleanly with the dynamic world, the player character must be modeled in Rapier as a KinematicPositionBased rigid body. Kinematic bodies are immune to external forces, impulses, and gravity; their positions are dictated entirely by the developer's game loop logic, yet they participate fully in collision detection and can exert infinite mass against dynamic objects42.  
However, this infinite mass presents a secondary problem. If the kinematic player walks directly into a dynamic cooler, Rapier's internal solver will attempt to resolve the penetration by applying immense force to the cooler, potentially launching it into the air at unrealistic velocities. To correct this, the architecture should utilize Rapier's built-in Kinematic Character Controller (KCC). The KCC calculates collision margins and filters which bodies it is allowed to push. Instead of relying on strict penetration resolution, the KCC detects the overlap and allows the developer to apply a predictable, authored impulse to the dynamic cooler, ensuring smooth, sliding behavior that respects the arcade inputs3.

### **Fixed-Step Integration**

Synchronizing the asynchronous refresh rate of the browser with the physics engine is a critical architectural requirement. Browsers utilize requestAnimationFrame for rendering, which provides variable delta times that fluctuate wildly on mobile devices due to background tasks or thermal throttling. Physics engines require a fixed time step ( ![][image5] ) to maintain mathematical stability and determinism; passing a variable delta time directly to world.step(dt) will cause fast-moving objects to tunnel through geometry during frame drops2.  
The architecture must implement a fixed-step accumulator pattern within the main rendering loop:

> 1. A fixed step is defined (e.g., ![][image6] seconds).  
> 2. The variable delta time from requestAnimationFrame is added to an accumulator.  
> 3. The delta time must be rigidly capped (e.g., maximum 0.25 seconds). If iOS Safari backgrounds the tab and regains focus an hour later, the delta time will be massive. Without a cap, the while loop will attempt to simulate thousands of physics steps instantly, freezing the browser in a "spiral of death"2.  
> 4. A while loop consumes the accumulator in discrete fixed steps, updating the arcade controller and calling world.step().  
> 5. The remaining accumulator fraction is used to interpolate the visual THREE.Mesh positions between the previous and current physics states, ensuring perfectly smooth rendering regardless of monitor refresh rate.

## **Authoring Playful Physical Interactions**

The game's design calls for varied interactions ranging from simple sliding to complex chain reactions. Implementing these requires leveraging specific features of the Rapier engine.

### **Articulated Coolers and Joints**

A cooler consists of a primary tub and a lid. In Rapier, this is modeled as two separate dynamic rigid bodies linked by a Revolute Joint (a hinge). Rapier's joint system allows for strict angular limits to be enforced, preventing the lid from clipping backwards through the tub9.  
When the cooler tumbles, the solver naturally calculates the angular momentum applied to the lid. To optimize this, the lid should be assigned a specific collision group that ignores collisions with the tub itself, relying solely on the joint constraints to maintain structural integrity.

### **Detaching Cups and Contact Events**

Cups resting on chairs or in cooler cupholders should not be simulated as independent rigid bodies constantly. Resting contacts consume valuable solver iterations and memory. Instead, a cup should be parented logically to the cooler's Three.js mesh.  
A spherical spatial trigger (sensor collider) should be placed around the cooler42. Rapier provides a drainCollisionEvents API that queues penetration and contact data efficiently3. When the event queue reports that a high-velocity impact has entered the cooler's sensor, the cup's visual mesh is detached from the cooler's local space and translated to world space. Simultaneously, a small dynamic sphere collider is injected into the Rapier world with an initial impulse mimicking the kinetic transfer. This "just-in-time" physics activation ensures that the engine only pays the cost of simulating cups during the brief window of a crash.

### **Bending and Snapping Directional Signs**

Directional signs can be modeled as dynamic bodies attached to the static ground geometry via Fixed Joints. Rapier allows fixed joints to be configured with specific break force thresholds9.  
If the player strikes the sign gently, the joint holds, and the sign behaves as a static obstacle. If the player strikes the sign at high velocity, the kinetic force transferred to the joint exceeds the threshold, and Rapier automatically destroys the joint. The sign then falls dynamically as a standard rigid body. Because these changes must be bounded to the live neighborhood, when the player leaves the procedural chunk, the detached sign is garbage-collected. When the player eventually returns, the procedural generator simply reconstructs the sign in its unbroken, default state.

### **Occupied Chairs and Expressive NPCs**

Handling occupied chairs introduces the complexity of human interaction. Applying full rigid-body ragdolls to NPCs is prohibitively expensive for mobile WebGL, generating extreme solver overhead and unpredictable visual anomalies. Instead, the architecture should utilize a hybrid blending of animation and physics.  
When a chair is occupied, the chair geometry and the NPC geometry are merged logically, though the NPC remains a skinned mesh driven by an animation state machine. The physics representation is simplified into a single compound collider (e.g., a cuboid for the chair seat and a cylinder for the NPC torso).

> 1. If the player strikes the chair softly, the rigid body slides. The NPC's animation controller continuously reads the linear velocity of the chair's rigid body. If the velocity exceeds a predefined "brace" threshold, the animation state machine overrides the idle loop and blends into a procedural bracing or balancing animation.  
> 2. If the impact exceeds a catastrophic "fall" threshold, the compound collider is destroyed. The chair becomes an independent dynamic body, and the NPC switches to a purely kinematic bounding box that translates to the ground while triggering a pre-authored "fall and recover" animation sequence45. This provides highly expressive, believable reactions while keeping the physics simulation strictly bounded to primitive shapes.

## **Managing Capacity Exhaustion and Mobile Memory Limits**

The most severe risk in a browser-based physical simulation involves capacity exhaustion, particularly on iOS devices constrained by WebKit's Jetsam daemon.  
WebAssembly memory is allocated as a contiguous ArrayBuffer. When Rapier initializes, it claims a substantial block of memory. As bodies are created, the memory may grow. Because the architecture promotes and demotes objects dynamically, the system will allocate and free rigid bodies continuously. However, a fundamental limitation of WASM is that its memory *never shrinks*; it only grows46.  
If the player initiates a massive chain reaction—for example, crashing a cart into an occupied chair, which strikes a cooler, causing fifty cups to detach and bounce into a dense crowd of NPCs—the game will promote dozens of objects simultaneously. If this expansion, combined with the VRAM usage of Three.js textures and geometries, breaches the iOS Jetsam limit (often around 1 GB to 2 GB depending on the device generation), the operating system will forcefully and instantly terminate the browser tab, presenting the user with an unrecoverable "A problem repeatedly occurred" error26.  
To prevent total application failure during capacity exhaustion, the engine must implement a strict ceiling on the number of concurrent dynamic bodies (e.g., a maximum of 150 active bodies). The game loop must maintain a priority queue of all promoted instances, weighted by their current kinetic energy and their distance from the player camera.  
If a collision event attempts to promote an object that would push the active body count above the ceiling, the system must forcefully demote the lowest-priority bodies in the queue back into their InstancedMesh representations, regardless of whether they have finished settling. This aggressive culling cuts off the tail of the physics simulation, sacrificing visual realism in the background to absolutely guarantee that the WASM heap does not expand into lethal memory thresholds25.

## **Representative Benchmark Plan**

To definitively validate the assumptions of the promotion/demotion architecture and the capabilities of the Rapier solver, a targeted benchmark plan must be executed before deep integration begins. It is critical that these benchmarks are not evaluated on desktop hardware; results from an Apple M2 or high-end GPU will mask the severe limitations of mobile devices. All testing must occur on mid-range target hardware (e.g., an iPhone 12 or equivalent Android device) via local network profiling.  
**Phase 1: Isolated Physics Headless Benchmark** The objective is to measure the pure cost of the Rapier WASM solver without rendering overhead.

> 1. Initialize a Rapier world in a headless browser context.  
> 2. Spawn a fixed floor plane and 1,000 dynamic cuboids in a vertical column, allowing them to fall, collide, and stack into a resting pileup.  
> 3. Measure the execution time of world.step() across 500 frames using high-resolution timers (performance.now()).  
> 4. *Success Criterion:* The solver must stabilize the resting stack (sleep state) within 3 seconds, and step times must not exceed 8ms per frame, leaving the remaining 8.6ms of the frame budget for JavaScript logic and WebGL overhead.

**Phase 2: The Promotion/Demotion Stress Test** The objective is to measure the cost of manipulating the InstancedMesh matrices and observing V8 garbage collection behavior.

> 1. Initialize Three.js with an InstancedMesh of 10,000 objects divided into optimal chunk sizes.  
> 2. Simulate a kinematic "player radius" sweeping through the grid at a constant velocity.  
> 3. Every frame, swap 10 matrices to the back of the instance buffer, decrement count, set needsUpdate \= true, and instantiate 10 Rapier dynamic bodies.  
> 4. Concurrently, forcefully demote the oldest 10 bodies back into the instance buffer, simulating the capacity exhaustion ceiling.  
> 5. *Success Criterion:* The Chrome DevTools or Safari Web Inspector memory profiler must verify that the V8 Scavenger garbage collector does not trigger major "stop-the-world" pauses exceeding 10ms. Frame times must remain stable without micro-stuttering during the matrix array uploads.

**Phase 3: The Occupied Chair Collision Test** The objective is to validate the hybrid animation/physics response latency.

> 1. Construct the compound rigid body representing the chair and the kinematic NPC proxy.  
> 2. Propel a heavy dynamic sphere (the player) into the chair at high velocity.  
> 3. Measure the stability of the impulse transfer to the chair and log the latency between the Rapier contact event firing and the JavaScript animation state machine triggering the NPC's "fall" sequence.

## **Minimal Prototype: Bounded Promotion Architecture**

The following code block outlines a minimal, executable prototype that isolates the core risk of the architecture: seamlessly transitioning an object from a static InstancedMesh into a dynamic Rapier body using the no-build import-map workflow. This prototype can be saved as an HTML file and run locally to immediately disprove or validate the matrix-swapping logic before committing to a larger refactor.

HTML  
\<\!DOCTYPE **html**\>  
\<html lang\="en"\>  
\<head\>  
    \<meta charset\="UTF-8"\>  
    \<title\>Three.js \+ Rapier Promotion Prototype\</title\>  
    \<style\>body { margin: 0; overflow: hidden; background: \#111; }\</style\>  
      
    \<\!-- Import Map satisfying the no-build constraint \--\>  
    \<script type\="importmap"\>  
    {  
        "imports": {  
            "three": "https\://unpkg.com/three@0.164.0/build/three.module.js",  
            "three/addons/": "https\://unpkg.com/three@0.164.0/examples/jsm/",  
            "@dimforge/rapier3d-compat": "https\://esm.sh/@dimforge/rapier3d-compat@0.19.3/rapier.mjs"  
        }  
    }  
    \</script\>  
\</head\>  
\<body\>  
    \<script type\="module"\>  
        import \* as THREE from 'three';  
        import RAPIER from '@dimforge/rapier3d-compat';  
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

        // 1\. Initialize Rapier (Parses the inlined Base64 WASM binary)  
        await RAPIER.init();  
        const world \= new RAPIER.World({ x: 0, y: \-9.81, z: 0 });

        // 2\. Initialize Three.js WebGL Renderer  
        const scene \= new THREE.Scene();  
        const camera \= new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);  
        camera.position.set(0, 10, 20);  
          
        const renderer \= new THREE.WebGLRenderer({ antialias: true });  
        renderer.setSize(window.innerWidth, window.innerHeight);  
        document.body.appendChild(renderer.domElement);  
        new OrbitControls(camera, renderer.domElement);  
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        // Create Static Ground for Physics  
        const groundBodyDesc \= RAPIER.RigidBodyDesc.fixed().setTranslation(0, \-0.5, 0);  
        const groundBody \= world.createRigidBody(groundBodyDesc);  
        const groundCollider \= RAPIER.ColliderDesc.cuboid(50, 0.5, 50);  
        world.createCollider(groundCollider, groundBody);

        const groundMesh \= new THREE.Mesh(  
            new THREE.BoxGeometry(100, 1, 100),  
            new THREE.MeshStandardMaterial({ color: 0x333333 })  
        );  
        groundMesh.position.y \= \-0.5;  
        scene.add(groundMesh);

        // 3\. Construct the InstancedMesh for static, cheap props  
        const INSTANCE\_COUNT \= 1000;  
        const geometry \= new THREE.BoxGeometry(1, 1, 1);  
        const material \= new THREE.MeshStandardMaterial({ color: 0x00ff00 });  
        const instancedMesh \= new THREE.InstancedMesh(geometry, material, INSTANCE\_COUNT);  
          
        const dummyMatrix \= new THREE.Matrix4();  
        const dummyPosition \= new THREE.Vector3();

        for (let i \= 0; i \< INSTANCE\_COUNT; i++) {  
            dummyPosition.set(  
                (Math.random() \- 0.5) \* 40,  
                0.5,  
                (Math.random() \- 0.5) \* 40  
            );  
            dummyMatrix.setPosition(dummyPosition);  
            instancedMesh.setMatrixAt(i, dummyMatrix);  
        }  
        scene.add(instancedMesh);

        const dynamicMeshes \= \[\];  
        const dynamicBodies \= \[\];  
        const raycaster \= new THREE.Raycaster();  
        const mouse \= new THREE.Vector2();

        // 4\. The Core Promotion Logic  
        function promoteInstance(instanceId) {  
            if (instanceId \>= instancedMesh.count) return;

            // Extract the world position of the target instance  
            const matrix \= new THREE.Matrix4();  
            instancedMesh.getMatrixAt(instanceId, matrix);  
            const position \= new THREE.Vector3().setFromMatrixPosition(matrix);

            // Swap the target instance with the last visible instance in the buffer  
            const lastIndex \= instancedMesh.count \- 1;  
            const lastMatrix \= new THREE.Matrix4();  
            instancedMesh.getMatrixAt(lastIndex, lastMatrix);  
            instancedMesh.setMatrixAt(instanceId, lastMatrix);

            // Decrement the draw count to hide the instance, and flag the GPU upload  
            instancedMesh.count--;  
            instancedMesh.instanceMatrix.needsUpdate \= true;

            // Spawn the Dynamic Physics Body slightly elevated to simulate a pop  
            const bodyDesc \= RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y \+ 5, position.z);  
            const rigidBody \= world.createRigidBody(bodyDesc);  
            const colliderDesc \= RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);  
            world.createCollider(colliderDesc, rigidBody);

            // Spawn the Standalone Visual Mesh to follow the body  
            const mesh \= new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff0000 }));  
            scene.add(mesh);

            dynamicBodies.push(rigidBody);  
            dynamicMeshes.push(mesh);  
        }

        // Raycast on Pointer Down to simulate an interaction event  
        window.addEventListener('pointerdown', (event) \=\> {  
            mouse.x \= (event.clientX / window.innerWidth) \* 2 \- 1;  
            mouse.y \= \-(event.clientY / window.innerHeight) \* 2 \+ 1;  
            raycaster.setFromCamera(mouse, camera);

            const intersects \= raycaster.intersectObject(instancedMesh);  
            if (intersects.length \> 0) {  
                promoteInstance(intersects\[0\].instanceId);  
            }  
        });

        // 5\. Fixed-Step Game Loop Integration  
        const fixedTimeStep \= 1.0 / 60.0;  
        let accumulator \= 0.0;  
        let lastTime \= performance.now();

        renderer.setAnimationLoop(() \=\> {  
            const now \= performance.now();  
            let dt \= (now \- lastTime) / 1000.0;  
            lastTime \= now;  
              
            // Hard cap the delta time to prevent the simulation from spiraling on context restoration  
            if (dt \> 0.25) dt \= 0.25;   
            accumulator \+= dt;

            // Step the physics engine in predictable fixed increments  
            while (accumulator \>= fixedTimeStep) {  
                world.step();  
                accumulator \-= fixedTimeStep;  
            }

            // Synchronize the standalone visual meshes to the new dynamic body states  
            for (let i \= 0; i \< dynamicBodies.length; i++) {  
                const translation \= dynamicBodies\[i\].translation();  
                const rotation \= dynamicBodies\[i\].rotation();  
                dynamicMeshes\[i\].position.set(translation.x, translation.y, translation.z);  
                dynamicMeshes\[i\].quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);  
            }

            renderer.render(scene, camera);  
        });  
    \</script\>  
\</body\>  
\</html\>

## **Conclusion**

Architecting a physically reactive environment within a procedurally generated Three.js application requires strict discipline regarding render-state lifecycles and memory boundaries. Defaulting props to static InstancedMesh representations and utilizing an index-swapping promotion pipeline shields the CPU and GPU from the overhead of thousands of unnecessary broad-phase physics queries and VRAM allocations.  
Deploying Rapier3D via its \-compat package seamlessly satisfies the no-build import-map workflow while delivering the deterministic solver strength necessary for simulating complex articulations, breaking joints, and precise character collisions. Developers must remain hyper-vigilant regarding iOS Safari's WebKit Jetsam limits, enforcing hard ceilings on WASM heap growth by aggressively culling and demoting sleeping or low-priority bodies. If these architectural boundaries are respected and the capacity limits are enforced programmatically, the result will be a deeply interactive, emergent physical experience that scales securely and efficiently across desktop and mobile browsers.

#### **Works cited**

> 1. Getting started \- Rapier.rs, [https\://rapier.rs/docs/user\_guides/javascript/getting\_started\_js/](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)  
> 2. claude-mods/skills/threejs-ops/SKILL.md at main \- GitHub, [https\://github.com/0xDarkMatter/claude-mods/blob/main/skills/threejs-ops/SKILL.md](https://github.com/0xDarkMatter/claude-mods/blob/main/skills/threejs-ops/SKILL.md)  
> 3. CHANGELOG.md \- rapier.js \- GitHub, [https\://github.com/dimforge/rapier.js/blob/master/CHANGELOG.md](https://github.com/dimforge/rapier.js/blob/master/CHANGELOG.md)  
> 4. npm:@dimforge/rapier3d-compat \- Skypack.dev, [https\://www\.skypack.dev/view/@dimforge/rapier3d-compat](https://www.skypack.dev/view/@dimforge/rapier3d-compat)  
> 5. GitHub \- khanmjk/Hourglass\_Fable5: A digital-twin hourglass timer, [https\://github.com/khanmjk/Hourglass\_Fable5](https://github.com/khanmjk/Hourglass_Fable5)  
> 6. How to run Node.js in the browser \| Nearform, [https\://nearform.com/digital-community/how-to-run-node-js-in-the-browser/](https://nearform.com/digital-community/how-to-run-node-js-in-the-browser/)  
> 7. Where to Publish HTML5 Games \| Portal Size Rules and Setup, [https\://www\.summerengine.com/make-great-games/publish-an-html5-game](https://www.summerengine.com/make-great-games/publish-an-html5-game)  
> 8. How to run my html5 game made with godot 4 on my own website?, [https\://stackoverflow.com/questions/78799926/how-to-run-my-html5-game-made-with-godot-4-on-my-own-website](https://stackoverflow.com/questions/78799926/how-to-run-my-html5-game-made-with-godot-4-on-my-own-website)  
> 9. rapier/CHANGELOG.md at master \- dimforge \- GitHub, [https\://github.com/dimforge/rapier/blob/master/CHANGELOG.md](https://github.com/dimforge/rapier/blob/master/CHANGELOG.md)  
> 10. JavaScript Physics Engines Comparison — Cannon-es vs Rapier, [https\://www\.mysimulator.uk/content/references/physics-engines-comparison.html](https://www.mysimulator.uk/content/references/physics-engines-comparison.html)  
> 11. Havok Physics Benchmark & Multithreading Question, [https\://forum.babylonjs.com/t/havok-physics-benchmark-multithreading-question/49009](https://forum.babylonjs.com/t/havok-physics-benchmark-multithreading-question/49009)  
> 12. gkjohnson/three-mesh-bvh \- DeepWiki, [https\://deepwiki.com/gkjohnson/three-mesh-bvh](https://deepwiki.com/gkjohnson/three-mesh-bvh)  
> 13. gkjohnson/three-mesh-bvh: A BVH implementation to speed up, [https\://github.com/gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)  
> 14. JoltPhysics/Docs/Architecture.md at master \- GitHub, [https\://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md)  
> 15. GitHub \- code4fukui/cannon-es: A lightweight 3D physics engine, [https\://github.com/code4fukui/cannon-es](https://github.com/code4fukui/cannon-es)  
> 16. dimforge/rapier3d-compat CDN by jsDelivr, [https\://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/](https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/)  
> 17. Port of JoltPhysics to JavaScript using emscripten \- GitHub, [https\://github.com/jrouwe/JoltPhysics.js/](https://github.com/jrouwe/JoltPhysics.js/)  
> 18. Cannon Es Debugger: React Utilities Library, [https\://reactlibraryhub.vercel.app/library/cannon-es-debugger](https://reactlibraryhub.vercel.app/library/cannon-es-debugger)  
> 19. Multithread Support with Emscripten · jrouwe JoltPhysics.js \- GitHub, [https\://github.com/jrouwe/JoltPhysics.js/discussions/110](https://github.com/jrouwe/JoltPhysics.js/discussions/110)  
> 20. dimforge/rapier3d \- NPM, [https\://www\.npmjs.com/package/@dimforge/rapier3d](https://www.npmjs.com/package/@dimforge/rapier3d)  
> 21. threejson/extensions/physics-rapier/README.md at master \- GitHub, [https\://github.com/nnrj/threejson/blob/master/extensions/physics-rapier/README.md](https://github.com/nnrj/threejson/blob/master/extensions/physics-rapier/README.md)  
> 22. Open source & credits \- Palpable, [https\://palpable.technology/open-source](https://palpable.technology/open-source)  
> 23. Erin Catto released Box3D last week, so I got it running in Godot, [https\://www\.reddit.com/r/godot/comments/1usevlf/erin\_catto\_released\_box3d\_last\_week\_so\_i\_got\_it/](https://www.reddit.com/r/godot/comments/1usevlf/erin_catto_released_box3d_last_week_so_i_got_it/)  
> 24. Sebastian Aaltonen (@sebaaltonen.bsky.social) — Bluesky, [https\://bsky.app/profile/sebaaltonen.bsky.social](https://bsky.app/profile/sebaaltonen.bsky.social)  
> 25. WebGL Game Development: Build Browser 3D Games (2026), [https\://generalistprogrammer.com/tutorials/webgl-game-development-complete-browser-gaming-guide-2025](https://generalistprogrammer.com/tutorials/webgl-game-development-complete-browser-gaming-guide-2025)  
> 26. Debugging a iOS Safari crash "A problem repeatedly occurred", [https\://stackoverflow.com/questions/76127296/debugging-a-ios-safari-crash-a-problem-repeatedly-occurred](https://stackoverflow.com/questions/76127296/debugging-a-ios-safari-crash-a-problem-repeatedly-occurred)  
> 27. Three.js Game Development Tutorial: Build 3D Games for the Web, [https\://www\.abratabia.com/threejs/](https://www.abratabia.com/threejs/)  
> 28. threejs-playground/ai\_prompts\_takeaways.md at main \- GitHub, [https\://github.com/ryanfitzpatrickio/threejs-playground/blob/main/ai\_prompts\_takeaways.md](https://github.com/ryanfitzpatrickio/threejs-playground/blob/main/ai_prompts_takeaways.md)  
> 29. Third Room Development Update 4-25-2022 · matrix-org thirdroom, [https\://github.com/matrix-org/thirdroom/discussions/47](https://github.com/matrix-org/thirdroom/discussions/47)  
> 30. Cross-Origin-Embedder-Policy-Report-Only \- HTTP.DEV, [https\://http.dev/cross-origin-embedder-policy-report-only](https://http.dev/cross-origin-embedder-policy-report-only)  
> 31. Cross-Origin-Opener-Policy (COOP) header \- HTTP \- MDN Web Docs, [https\://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)  
> 32. Web workers in 3D web applications \- Discussion \- three.js forum, [https\://discourse.threejs.org/t/web-workers-in-3d-web-applications/5674](https://discourse.threejs.org/t/web-workers-in-3d-web-applications/5674)  
> 33. Using web workers for the physics, world and networking? \- Questions, [https\://forum.babylonjs.com/t/using-web-workers-for-the-physics-world-and-networking/571](https://forum.babylonjs.com/t/using-web-workers-for-the-physics-world-and-networking/571)  
> 34. MQTT and WebSocket Architecture for 3D Digital Twins \- TkTurners, [https\://www\.tkturners.com/blog/mqtt-and-websocket-architecture-for-3d-digital-twins-streaming-real-time](https://www.tkturners.com/blog/mqtt-and-websocket-architecture-for-3d-digital-twins-streaming-real-time)  
> 35. Draw Calls: The Silent Killer \| Three.js Roadmap, [https\://threejsroadmap.com/blog/draw-calls-the-silent-killer](https://threejsroadmap.com/blog/draw-calls-the-silent-killer)  
> 36. InstancedMesh.count – three.js docs, [https\://threejs.org/docs/\#api/en/objects/InstancedMesh.count](https://threejs.org/docs/#api/en/objects/InstancedMesh.count)  
> 37. InstancedMesh2 \- Easy handling and frustum culling \- three.js forum, [https\://discourse.threejs.org/t/instancedmesh2-easy-handling-and-frustum-culling/58622](https://discourse.threejs.org/t/instancedmesh2-easy-handling-and-frustum-culling/58622)  
> 38. How was the "ThreeJS ChatGPT Mentor" Made? \- Questions, [https\://discourse.threejs.org/t/how-was-the-threejs-chatgpt-mentor-made/85059](https://discourse.threejs.org/t/how-was-the-threejs-chatgpt-mentor-made/85059)  
> 39. How to show and hide an instance in instance mesh \- three.js forum, [https\://discourse.threejs.org/t/how-to-show-and-hide-an-instance-in-instance-mesh/28198](https://discourse.threejs.org/t/how-to-show-and-hide-an-instance-in-instance-mesh/28198)  
> 40. 3d\_simulator/CONCEPT\_ENGINEERING.md at main · Timothy-Lee, [https\://github.com/Timothy-Lee-Grant/3d\_simulator/blob/main/CONCEPT\_ENGINEERING.md](https://github.com/Timothy-Lee-Grant/3d_simulator/blob/main/CONCEPT_ENGINEERING.md)  
> 41. 100 Three.js Tips That Actually Improve Performance (2026) \- Utsubo, [https\://www\.utsubo.com/blog/threejs-best-practices-100-tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)  
> 42. Jolt Physics \- GitHub Pages, [https\://jrouwe.github.io/JoltPhysicsDocs/5.0.0/index.html](https://jrouwe.github.io/JoltPhysicsDocs/5.0.0/index.html)  
> 43. Gorilla3D Framework \- Documentation \- Version v1.5, [https\://gorilla3d.de/doc/v3/export/pdf?version=v1.5\&pages\[\]=Gaming/Physics/Physics.md](https://gorilla3d.de/doc/v3/export/pdf?version=v1.5&pages%5B%5D=Gaming/Physics/Physics.md)  
> 44. Modern Game Engine \- myqcloud.com, [https\://games-1312234642.cos.ap-guangzhou.myqcloud.com/course/GAMES104/GAMES104\_Lecture11.pdf](https://games-1312234642.cos.ap-guangzhou.myqcloud.com/course/GAMES104/GAMES104_Lecture11.pdf)  
> 45. Threejs Impl Physics (Grade A) \- Claude Skill \- Skills Directory, [https\://www\.skillsdirectory.com/skills/impertio-studio-threejs-impl-physics](https://www.skillsdirectory.com/skills/impertio-studio-threejs-impl-physics)  
> 46. Why am I excited about WebAssembly? \- Hacker News, [https\://news.ycombinator.com/item?id=32128209](https://news.ycombinator.com/item?id=32128209)  
> 47. 四大平台Web Canvas显存限制差异全解析- U深搜 \- UniFuncs, [https\://unifuncs.com/s/R1uiy08H](https://unifuncs.com/s/R1uiy08H)  
> 48. Canvas context allocation fails because "Total canvas memory use, [https\://bugs.webkit.org/show\_bug.cgi?id=195325](https://bugs.webkit.org/show_bug.cgi?id=195325)  
> 49. Why Is Safari Slow & Crashing on iPhone? Storage & WebKit Fix, [https\://swipephotocleaner.com/blog/why-is-safari-slow-lagging-tabs-closing-iphone/](https://swipephotocleaner.com/blog/why-is-safari-slow-lagging-tabs-closing-iphone/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAATCAYAAACdkl3yAAAAUklEQVR4XmNgGAWjgGSwF12AXPAPXYBcYAPEZeiC5IJzQGyOLmhCJr4FxPsYkIAfmfgaFLMwUAAmArE3uiCpQBGIO9EFyQGf0AXIBYfRBQYfAAAd4BESiNtkvQAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAATCAYAAACgADyUAAAAlUlEQVR4XmNgGAWDGGgCsSy6IBbACGMoAPF/IP4HxN+g7DSYJBrgBGITGAekAR3sB+LfQCyDJv4dmeOJzEECwkD8lwHiAhi2QVFBBGBBF4CBTgaEqavR5NCBHYxxAoibkSRmMkAMCEISg4FyIGaDcXqQJJDBZQaIASVA7A/EV4D4BrICuAlYAB8Qzwfia0CcgiY3FAAADTMbOp2DdbUAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAWCAYAAAC40nDiAAADWUlEQVR4Xu2YS8iNQRjHH3fKJZKFQkpSFjbKZUEuYaEUVpIvC+USFiQ7GwuXlHJNkRQLCmVh4fa5X4qwEUpuKdfI/e75NzPOc/5n5pz5vtP5jk/fr/71zv95ZuZ958w7M+8RaaON/5UpbLQyZrJRLYNUO1VbVT0pFmOhajV5fVXDyPuXmaXaw2Zz2Kz6rZrnywNVL1Rf/maUMkD1zJTHiWsDOm38lgCD8F4K/e8tijp+SiEOTTKxa6o5ptwk2otr8CwHPD9Uv9j0oF5XNqU+gxiwgxQD9zWETU+qTkVQ8QGbholS+quBsaqv5AXqNYjtVMdVR8TdQ2ytKzdQD1Vb2KzEUynfKAgz9RD536V0LQzUaxCXq0b669RsxJuVYrrE6yQZL65CI/lMb3F5b8mH1428QGoQ8RpdVF2SwtrL9FKtEbdGd1GNUn2QvBny2lzjfnEfdnMcqlpvyjGaNIiYSagQW9Msc8Xl3TReD++liA3iFdV9U94kpZvWOnF1u6v6+Ov9qqn+uhI2Bz8YyneNd0Bc2+VAnTFspkByzo3dE5eHo0xggvdS8CAu8h4D7wKVV5oylpBYvRhYD4+Rx8+Y0xZy5rMZo5+UdpAilodO2LPwIMbaAMjhh1xsyru9l4NdD62H+ht9+ZuJpUA+3oiKdBCX/JkDxGxxeXz8afB+CsTOUDmWf1Scj/sBWPSvF8LyUdx6mMMbNjyh7+GqtRSLgVwsNVmkHsySyhktcT+QO4jYYKyPA+8jcedS+LjOJdY+OCEuhmNcaiO0IHcZmyneSbpj8FhcvBMHpLBjp0DMzl7Mrlh+2NwCsZwcOqpOsekJR7TctpGHM3A2qHCbTeWluAcsB+p2ZtOD2K2Ih2/ywAjv4UgTwAzEa3lZ3AzCbjrDxGNgKXilusoBwycpPQmkyB3sInADqIgjCNZIXONsVgnkrSBvsuq56om4b2rMdss+KcwKHJkwgyyHfSymGAfF9YHzIc6F+DaOgR9sCZsR8G9Uqq+asEryF/0cdkjpoAfwYLvYrAF3VEvZrDV4OJ5NzeWG6jybHmwwmHW1pkVnYWCaFH+FVAteRztY+IEaJe98Vy0nxT1PXdigWsBmFQxWbVedU21T9S8O1wT8U4VNrK40sNHKsF9JWfwB4RD7KtRv5VwAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAWCAYAAADJqhx8AAAAd0lEQVR4XmNgGAXDDEgCMRO6IBrwRBdAB/+BmAVdEAp+ATEXuiA2ADKEFU3sNxDzoInhBciGgDTzIskRDUCGgDTzoUsQC/5BMTu6BDEApBHmZxCbDUmOIEDWjCyGHrBYwV8G3FEFMgRXFIOBMgNhp8aiC4wCKgAAti8ROCOFFUIAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAWCAYAAAA1vze2AAABBklEQVR4Xu2TPw5BQRDGB4nEJZyAC0g0ohB6F3ABUSgkKo1EoRC1aHS4gAvoNCqJTilaKmYyuzI7dp8neZ33S75k9/tm9+2/B5CSIA9UQZtJMkA9URcdJAl9wCqvshBU29RmiC5qhBoCDzy7sZcycG1WByGoWLZJOeH52II7LpIOaiL6Y+DBR+FJGsBHRDV3VAtVdSo8+FZjd+Ojh+oD5yvTrzsVijZqrk1kBjzJXgcGex8ZHfgIrZaI2s0awpkDne1Sm4IF8EQ7HQD7V236iLOS0G7Io2cfSQV4y9/YAE8oa0vGs/9HDQIXb1f4iyz0ZGX/JtpvivA5QRxNabDhZLyD8FL+nRfOF1SSiWzSUAAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAWCAYAAACMq7H+AAACnElEQVR4Xu2XS6hNURjHPyTJyCvqMjFQJsKAPNKVsfKeIDN55JkMmJlcYmRiZCjJRCkDA8VAeUwUMeEMyCOPUArl8f3PWuueb//3t/a9ex+lq/2rr3O+31pr7+/ss/dae4m0tPwPTGLRUuYti7HCUY09LEdgjcZTjd8aF6mtig8sIts0vks43j5qA1M0bkhov68xrthcSdNa5ZLGDwkDEXuLzZUc0fhl8t0SjjESuzRWsVTeaNw1+ReN5SYfkHD8yTGfHvPxwz3yNK21RN2LhP4LHHeKHOMVd1uKfkPMjxn3VeOyycEDjW/kPJrWWqLORVov/o9Nj0oV91hIGLOD3GLK0WcruePRV9FPrSXqXKSb4p+gI75PnNeYSW5Iwhg8Pphj1hWbu6yW0Icf053RTyNvaVqrS52L9En8EzwW3ye8Nqx08Ps1tmvMlfAI3TF9DsU+S4wDW6JfRt7StFYXDPBWFA/09U7wUHwP8G9fYCm9Y90yDncU3KaYn4z5wuEegTR3YVXM0aTWLBiAf3M0vBL/BI/E9wB3hrdkpx8xP+MBVkR8X9Rr7rI5+rXkLU1qzYIBB1hmyD3nz8T3IOc74rfZi5TmJPtKADDZw+P1IEeTWrNgAJ790XBC/BPkVowVGgdZRk6LP8ZeJGxj8L3J6la31kow4DDLCCbIWeTQn1cVuGvkwEcWhjT/zCEP95zycyYH16O39FtrlhkSBp3lBun9CC4Gb8gdk8+W0GeicYnPLIgnGq9NvlLCsSYY5901yDea/G/UWuKKxjuNlxov4ieWZGxVLFcl7O2Y9xL6p390XrG5CybdQZYOeHvGMbAdwefUYnMXbKN+xk/08aaHfmr9Z9g9U0sGbxvSYjgjYb5rqYAn0BaHpSzGEn8A5ATW6x5Alj4AAAAASUVORK5CYII=>