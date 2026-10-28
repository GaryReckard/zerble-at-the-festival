// Frozen before public handle role commands.
export class PhotographerCommandOracle {
  forcePhotographer(npc = null) {
    const target = npc || this.npcs.find((n) => n.isPhotographer) ||
      this.npcs.find((n) => PHOTOGRAPHER_ELIGIBLE.has(n.state)) || this.npcs[0];
    if (!target || !this.peopleHandles.isLive(this.peopleHandles.handleFor(target))) return null;
    if (!target.isPhotographer) {
      Object.assign(target, photographerProfile(target.pos, true));
      target.photoSlot = this._photoFree.pop();
      this._photographerCount++;
      if (target.photoSlot + 1 > this._photoDrawCount) this._photoDrawCount = target.photoSlot + 1;
    }
    startPhotographerShot(target);
    this._writeMatrices(target);
    return target;
  }

  triggerPhotographer(npc = null) {
    const target = npc || this.npcs.find((n) => n.isPhotographer);
    if (!target || !this.peopleHandles.isLive(this.peopleHandles.handleFor(target))) return null;
    startPhotographerShot(target);
    this._writeMatrices(target);
    return target;
  }

  previewPhotographerFlash(npc = null, duration = 0.6) {
    const target = npc || this.npcs.find((n) => n.isPhotographer);
    if (!target || !this.peopleHandles.isLive(this.peopleHandles.handleFor(target))) return null;
    target.photoFlashTimer = Math.max(PHOTO_FLASH_DURATION, duration);
    this._writeMatrices(target);
    return target;
  }

}
