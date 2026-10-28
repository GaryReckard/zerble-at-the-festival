// Frozen registry-first and family candidate order before Task 2.19.
      _collScratch.length = 0;
      _regColPoolN = 0;
      _npcColPoolN = 0;
      registry.collidersNear(zerble.position.x, zerble.position.z, zerble.radius + 1, (e) => {
        _collScratch.push(_regColWrap(e));
      });
      puppets.appendColliders(_collScratch);
      band.appendColliders(_collScratch);
      kids.appendColliders(_collScratch);
      wooks.appendColliders(_collScratch);
      hoopers.appendColliders(_collScratch);
      frisbees.appendColliders(_collScratch);
      const broadphaseR2 = 36; // 6m broadphase
      for (const n of crowd.npcs) {
        if (n.state === 'riding' || n.state === 'boarding' || n.state === 'disembarking' || n.state === 'camp_sleeping' || n.campJamHidden || crowd.hasHiddenBinding(n.personHandle)) continue;
        const dx = n.pos.x - zerble.position.x;
        const dz = n.pos.z - zerble.position.z;
        if (dx * dx + dz * dz > broadphaseR2) continue;
        _collScratch.push(_npcColWrap(n));
      }
