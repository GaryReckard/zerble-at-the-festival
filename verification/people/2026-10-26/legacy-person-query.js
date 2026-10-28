export class QueryOracle {
  forEachPersonNear(x,z,radius,visit) {
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    const scratch=this._personQueryScratch??={};
    for(const npc of this.npcs){
      if(!this.peopleHandles.isLive(npc.personHandle))continue;
      const distance=Math.hypot(npc.pos.x-x,npc.pos.z-z);
      if(distance>=radius)continue;
      this.peopleHandles.readOwnedRecord(npc,scratch);
      if(visit(npc.personHandle,scratch,distance)===false)return;
    }
  }

}
