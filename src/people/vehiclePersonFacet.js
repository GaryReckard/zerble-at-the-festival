import {PersonHandles} from './personHandle.js';

// A persistent vehicle can expose one person for inspection/selection while
// its existing controller keeps physics, rendering and relationship authority.
// No activity/boarding/collider capability is implied by this read-only facet.
export class VehiclePersonFacet {
  constructor({runtime,key,vehicle,read,order=90,schedule=[]}) {
    if(!vehicle||typeof read!=='function')throw new TypeError('Vehicle facet requires an owner and copied reader.');
    this.runtime=runtime;this.vehicle=vehicle;this.disposed=false;
    this.ownerToken=runtime.register({key,controller:this,schedule,capabilities:{nearby:this.forEachPersonNear},capabilityOrder:{nearby:order}});
    this.peopleHandles=new PersonHandles({runtime,ownerToken:this.ownerToken,read});
    this.peopleView=this.peopleHandles.view;
    this.person=this.peopleHandles.create(0,vehicle);
  }
  readPerson(handle,out){return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,scratch=null){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this.disposed)return;
    const view=scratch??(this._queryScratch??={});if(!this.readPerson(this.person,view))return;
    const distance=Math.hypot(view.x-x,view.z-z);if(distance<radius)visit(this.person,view,distance);
  }
  inspect(out){out.population=this.disposed?0:1;out.physicsOwner='vehicle';out.disposed=this.disposed;}
  dispose(reason='vehicle-facet-disposed'){
    if(this.disposed)return;this.disposed=true;
    this.peopleHandles.dispose();
    if(this.runtime.isRegistered(this.ownerToken))this.runtime.unregister(this.ownerToken,reason);
  }
}
