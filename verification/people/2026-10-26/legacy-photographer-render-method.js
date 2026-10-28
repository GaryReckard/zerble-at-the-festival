// Frozen population rendering before photographer pose sampling extraction.
export class PhotographerRenderOracle {
  _writeMatrices(npc) {
    groundNpc(npc);
    if (npc.state === 'camp_sleeping' || npc.campJamHidden || npc._activityBinding?.hidden) { this._hideNpc(npc); return; }
    if (npc.party) { this._hideNpc(npc); publishGroupBinding(npc); return; }
    // Bo is rendered by the wagon, while the crowd still owns his reserved seat.
    if (npc.seatSlot?.permanent && npc.seatSlot.vehicle?.driverModel) {
      this._hideNpc(npc);
      if (npc.isPhotographer) {
        this.cameraMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
        this.flashMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
      }
      return;
    }
    const m = this._mat4;
    const photographing = isPhotographerState(npc.state);
    const photoPose = npc.state === PHOTO_STATE_POSE;
    let photoPoseAmount = 0;
    if (photoPose) {
      const poseIn = Math.min(1, Math.max(0, (PHOTO_POSE_DURATION - npc.stateTimer) * 5));
      const poseOut = Math.min(1, Math.max(0, npc.stateTimer * 5));
      photoPoseAmount = Math.min(poseIn, poseOut);
    }
    // Reuse scratch Quaternion/Euler — avoids ~30k allocations/sec at 500 NPCs × 60fps.
    // hammock_riding NPCs need a supine rotation (X=+π/2 face up, then Y=yaw); all
    // others just rotate around Y by yaw. Build the right quat per branch.
    // Dancefloor NPCs bounce harder + sway more, on a phase seeded by their
    // dance value so neighbors aren't in lockstep. Unique-feeling moves come
    // from a sum of sin terms at staggered frequencies — different `dance`
    // values produce visibly different rhythms within the crowd. Computed
    // BEFORE the quat composition so the yaw wiggle can layer onto npc.yaw.
    let bobY;
    let danceTilt;
    let danceYawWiggle = 0;
    if (npc.onDancefloor) {
      const t = npc.bob;
      // Vertical bounce: a dominant low-frequency hop + a slight off-beat
      // ripple. Scale 0.06-0.10m so it reads clearly without floating.
      bobY = (Math.sin(t * 1.8) * 0.07 + Math.sin(t * 3.7 + npc.dance * 6) * 0.025);
      // Hip sway around Z axis — 0.18 rad peak (~10°) per personality.
      danceTilt = Math.sin(t * 1.5 + npc.dance * 3) * 0.18;
      // Yaw shimmy — a slow back-and-forth that varies per NPC.
      danceYawWiggle = Math.sin(t * 0.9 + npc.dance * 5) * 0.20;
    } else {
      bobY = Math.sin(npc.bob) * 0.04;
      danceTilt = npc.dance > 0.6 && (npc.state === 'idle' || npc.state === 'watching' || npc.state === 'riding')
        ? Math.sin(npc.bob * 2) * 0.05 * (npc.dance - 0.5)
        : 0;
    }
    // Unhappy NPCs don't vibe — kill the bounce + sway while frowning.
    if (npc.frownTimer > 0 || photographing) { bobY = 0; danceTilt = 0; danceYawWiggle = 0; }

    // Chair contact stays fixed even near dancefloors or while smiling. A
    // feet-origin bob/tilt moves the pelvis through the supporting fabric.
    if (npc.state === 'camp_seated' || npc.campMusic) { bobY = 0; danceTilt = 0; danceYawWiggle = 0; }

    let quat;
    if (npc.state === 'hammock_riding') {
      // Compose Y * X — applies X first (supine), then Y (align with hammock yaw)
      this._supineQuatY.setFromAxisAngle(this._axisY, npc.yaw + danceYawWiggle);
      quat = this._tmpQuat.multiplyQuaternions(this._supineQuatY, this._supineQuatX);
    } else {
      // Yaw + per-NPC dance shimmy. The Z-axis hip tilt (`danceTilt`) is
      // applied SEPARATELY below via `m.multiply(this._tmpDanceMat)` — don't
      // double up here by adding it to the Euler.
      quat = this._tmpQuat.setFromEuler(this._tmpEuler.set(0, npc.yaw + danceYawWiggle, 0));
    }

    // Happy bounce: while smile cooldown is active the body bobs up by a small
    // sin wave (~6cm amplitude) so the whole figure (body + mouth) hops.
    const bouncing = npc.smileTimeCooldown > 0 && !photographing && !npc.campMusic;
    const bounceY = bouncing
      ? Math.abs(Math.sin(performance.now() * 0.012 + npc.bob)) * 0.06
      : 0;

    // Cheer jump: positive-half sine so NPCs hop upward without clipping the floor.
    // Seeded by the stable behavior slot so pooling stays visually decoupled.
    const cheering = npc.cheerTimer > 0 && !npc.campMusic;
    const cheerY = cheering
      ? Math.max(0, Math.sin(performance.now() * 0.001 * HOP_HZ + npc.behaviorSeed * 1.3)) * HOP_HEIGHT
      : 0;

    // All 5 body meshes share one matrix. The matrix's Y = "feet level" for this NPC.
    // Each geometry has its part offset baked in (legs at y≈0.325, torso at y=1.0,
    // arms at y=1.10, head at y=1.65, shoes at y≈0.035). Scale is applied uniformly
    // via compose() so the whole figure scales together from the feet origin.
    //
    // Special states: riding/hammock npcs are lifted off the ground. We derive the
    // feet-equivalent Y from the seat/hammock world height so the torso (baked at +1.0)
    // lands at the right visual position.
    //   - riding:        torso should sit at ≈ seatY - 0.05  →  feet Y = seatY - 1.05
    //   - hammock_riding: torso should sit at ≈ hammockY - 0.1 →  feet Y = hammockY - 1.1
    //   - normal:        feet at the sampled ground position
    // Seated riders (bench / driver / roof) sit with their butt on the seat;
    // running-board riders stand. Computed here so it drives both the lift and
    // the leg bend below.
    const seated = (npc.state === 'riding' && npc.seatSlot &&
      (npc.seatSlot.kind === 'bench' || npc.seatSlot.kind === 'driver_seat' || npc.seatSlot.kind === 'roof'))
      || npc.pottySitting                  // caught sitting on the potty — same forward leg bend
      || npc.state === 'table_seated' || npc.state === 'camp_seated';     // sitting on a picnic bench — same forward leg bend
    let feetY;
    if (npc.pottySitting && npc.seatY != null) {
      // Butt on the toilet seat; bent legs hang forward. seatY is the seat-top
      // height; drop the feet ~0.62 so the hip (bend pivot) lands on the seat.
      // No cheer-hop — they're seated.
      feetY = npc.seatY - 0.62 + bobY;
    } else if (npc.state === 'riding' && npc.seatY != null) {
      // Seated: butt rests on top of the seat cushion (the torso bottom sits ≈
      // at the cushion surface so the seat doesn't cut through the belly); the
      // bent legs hang forward below. Standing running-board riders stay low.
      // Wagon cushions use the actual hip pivot; Zerble retains its existing pose.
      const hipOffset = npc.seatSlot?.vehicle ? .62 * npc.scale : .4;
      feetY = (seated ? npc.seatY - hipOffset : npc.seatSlot?.vehicle ? npc.seatY : npc.seatY - 1.05) + bobY + bounceY;
    } else if (npc.state === 'hammock_riding' && npc.hammockY != null) {
      // Supine: body lies horizontal with back pressed into the cloth. After
      // X=π/2 the body's "up" direction (away from back) is +Y. The torso
      // capsule is ~0.26 thick, but we want the back to SINK into the sag
      // slightly — so lift by only 0.16, not the full half-thickness.
      feetY = npc.hammockY + 0.16 + bobY + bounceY;
    } else if (npc.state === 'camp_seated' && npc.campY!==undefined) {
      // The torso capsule extends below the leg pivot. Align its rounded
      // bottom to the actual fabric height, keeping a centimetre of clearance.
      feetY = npc.campY - BODY_SEATED_BOTTOM * npc.scale + 0.01;
    } else if (npc.state === 'table_seated' && npc.picnicY!=null) {
      // Butt on the bench cushion; bent legs hang forward (the `seated` leg bend).
      // Same -0.4 hip drop a seated cart rider uses so the hip lands on the seat.
      feetY = npc.picnicY - 0.4 + bobY;
    } else {
      feetY = npc.pos.y + bobY + bounceY + cheerY; // authoritative ground position plus animation
    }
    if (photoPose && npc.photoCrouch) feetY -= 0.24 * photoPoseAmount;

    // CRITICAL: position and scale must be DISTINCT Vector3 instances.
    // Reusing this._tmpV for both args caused position to be overwritten by scale,
    // making every non-riding NPC render at (scale, scale, scale) ≈ (1,1,1).
    const posV = this._tmpV;
    const scaleV = this._tmpV2;

    if (npc.state === 'hammock_riding') {
      // Supine body extends in (sin(yaw), 0, cos(yaw)) direction from the matrix
      // origin (which is at feet after rotation). Shift matrix back by 0.825 in
      // the head direction so the body CENTER lands at npc.pos (hammock seat
      // + sway). Otherwise the body anchors feet-at-seat and head 1.65m out.
      const hx = Math.sin(npc.yaw);
      const hz = Math.cos(npc.yaw);
      posV.set(npc.pos.x - hx * 0.825, feetY, npc.pos.z - hz * 0.825);
    } else {
      posV.set(npc.pos.x, feetY, npc.pos.z);
    }
    scaleV.set(npc.scale, npc.scale, npc.scale);
    m.compose(posV, quat, scaleV);
    if (danceTilt) {
      // Reuse scratch Matrix4 — avoids per-NPC allocation for dancing crowd.
      this._tmpDanceMat.makeRotationZ(danceTilt);
      m.multiply(this._tmpDanceMat);
    }

    // Write the same transform to legs/shoes/body/arms/head/eyes — per-part offsets live in geometry.
    // Eyes also use this matrix (eyes geometry has offsets baked in, no scale reaction).
    // Exception: seated riders (bench / driver / roof — see `seated` above) get
    // their legs+shoes bent forward at the hip so they sit; the upright
    // body/arms/head still use `m`. Standing running-board riders keep straight legs.
    // Cheering NPCs get arms rotated up via _armsUpMat (same pattern as _sitLegMat).
    if (photoPose && npc.photoCrouch) {
      this._legMat.multiplyMatrices(m, this._photoCrouchLegMat);
      this.legsMesh.setMatrixAt(npc.idx, this._legMat);
      this.shoesMesh.setMatrixAt(npc.idx, this._legMat);
    } else if (seated) {
      this._legMat.multiplyMatrices(m, this._sitLegMat);
      this.legsMesh.setMatrixAt(npc.idx, this._legMat);
      this.shoesMesh.setMatrixAt(npc.idx, this._legMat);
    } else {
      this.legsMesh.setMatrixAt(npc.idx, m);
      this.shoesMesh.setMatrixAt(npc.idx, m);
    }
    this.shoppingBagMesh?.setMatrixAt(npc.idx, npc.shoppingBagTime > 0 ? m : this._zeroMat);
    this.bodyMesh.setMatrixAt(npc.idx, m);
    if (npc.campInstrument) {
      const active = npc.campMusicStage === 'playing';
      const bend = npc.campInstrument.kind === 'fiddle' ? 1.45 : 1.12;
      this._musicArmMat.makeTranslation(0, 1.35, 0)
        .multiply(this._tmpDanceMat.makeRotationX(bend + (active ? Math.sin(npc.bob * 7) * .07 : 0)))
        .multiply(this._musicPivotMat.makeTranslation(0, -1.35, 0));
      this._armsMat.multiplyMatrices(m, this._musicArmMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (npc.state === 'market_chatting' || npc.state === 'market_buying') {
      this._musicArmMat.makeTranslation(0, 1.35, 0)
        .multiply(this._tmpDanceMat.makeRotationX(.65 + Math.sin(npc.bob * 3) * .14))
        .multiply(this._musicPivotMat.makeTranslation(0, -1.35, 0));
      this._armsMat.multiplyMatrices(m, this._musicArmMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (photographing) {
      this._armsMat.multiplyMatrices(m, this._photoArmsMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else if (cheering || (npc.state === 'riding' && npc.seatSlot?.name === 'platform')) {
      this._armsMat.multiplyMatrices(m, this._armsUpMat);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    } else {
      this._armsMat.copy(m);
      this.armsMesh.setMatrixAt(npc.idx, this._armsMat);
    }
    this.headMesh.setMatrixAt(npc.idx, m);
    this.eyesMesh.setMatrixAt(npc.idx, m);
    const hairStyle = npc.appearance?.hairStyle || 0;
    const hairYScale = hairStyle === 0 ? 0.92 : 1;
    this._tmpV3.set(0, 1.78 * (1 - hairYScale), 0);
    this._tmpScale.set(0.98, hairYScale, hairStyle === 2 ? 1.02 : 0.98);
    this._hairLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
    this._hairMat.multiplyMatrices(m, this._hairLocalMat);
    this.hairMeshes[hairStyle].setMatrixAt(npc.hairSlot, this._hairMat);
    if (npc.drinkSlot >= 0 && !photographing && !npc.campInstrument) {
      this._tmpV3.set(0.34, 0, -0.07);
      this._tmpScale.set(0.76, 0.76, 0.76);
      this._drinkLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
      this._drinkMat.multiplyMatrices(this._armsMat, this._drinkLocalMat);
      this.drinkMesh.setMatrixAt(npc.drinkSlot, this._drinkMat);
    } else if (npc.drinkSlot >= 0) {
      this.drinkMesh.setMatrixAt(npc.drinkSlot, this._zeroMat);
    }
    if (npc.campInstrument) this._writeCampInstrument(npc, m);

    // ---- Mouth: child of the body matrix, with its own smile-pop scale ----
    // Mouth geometry is baked at origin. We build a local matrix that places it
    // at the face offset (NPC body frame) with the smile-pop scale, then
    // multiply it ONTO the body matrix `m`. Deriving from `m` means the smile
    // inherits everything the head/eyes do — bob, the dance hip-sway tilt
    // (danceTilt), yaw wiggle, NPC scale, and the riding/hammock seat lift — so
    // it stays glued to the face instead of floating beside a swaying head.
    // Frowning (dry-cart disappointment) flips the arc + shows it full-size;
    // otherwise it's a smile, big right after smiling and small at rest.
    const frowning = npc.frownTimer > 0;
    const mouthScale = (frowning || npc.smileTimeCooldown > 0) ? 1.0 : 0.3;
    this._tmpV3.set(0, 1.55, -0.215); // face-local offset, NPC body frame
    this._tmpScale.set(mouthScale, mouthScale, mouthScale);
    this._mouthLocalMat.compose(this._tmpV3, frowning ? this._frownQuat : this._identityQuat, this._tmpScale);
    this._mouthMat.multiplyMatrices(m, this._mouthLocalMat);
    this.mouthMesh.setMatrixAt(npc.idx, this._mouthMat);

    if (npc.isPhotographer) {
      // Camera geometry has its local chest/face offset baked in, so it follows
      // the same pooled body matrix through walking, crouching, and posing.
      this.cameraMesh.setMatrixAt(npc.photoSlot, m);
      if (npc.photoFlashTimer > 0) {
        const flashT = npc.photoFlashTimer / PHOTO_FLASH_DURATION;
        const flashScale = 0.72 + Math.sin(Math.min(1, flashT) * Math.PI) * 0.55;
        this._tmpV3.set(0, 1.20, -0.62);
        this._tmpScale.set(flashScale, flashScale, flashScale);
        this._flashLocalMat.compose(this._tmpV3, this._identityQuat, this._tmpScale);
        this._flashMat.multiplyMatrices(m, this._flashLocalMat);
        this.flashMesh.setMatrixAt(npc.photoSlot, this._flashMat);
      } else {
        this.flashMesh.setMatrixAt(npc.photoSlot, this._zeroMat);
      }
    }
  }

}
