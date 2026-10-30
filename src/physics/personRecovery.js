import {createStandRecovery} from './standRecovery.js';
export function createPersonRecovery({adapter,people,handle,scale,ground}) {
    // Treat nearby people like other clearance contacts: an initial overlap
    // may be escaped, but cannot deepen or remain at the stand-up endpoint.
    const recoveryQueries={queryBodyContacts(id,generation,pose,options){
     const result=adapter.queryBodyContacts(id,generation,pose,options);if(!result.ok)return result;
     const q=pose.rotation,up=1-2*(q.x*q.x+q.z*q.z);
     const reach=.3*scale+.4*scale*Math.sqrt(Math.max(0,1-up*up));
     people.forEachPersonNear(pose.position.x,pose.position.z,reach+2,(other,view,distance)=>{
      if(other===handle||view.hidden||Math.abs(view.y+view.scale-pose.position.y)>scale+view.scale)return;
      const separation=distance-reach-.3*view.scale;
      if(separation<.03)result.contacts.push({id:`person:${other.slot}`,generation:other.generation,distance:separation});
     });
     return result;
    }};
    return createStandRecovery({adapter:recoveryQueries,ground,radius:.3*scale,halfHeight:.4*scale,rootHeight:scale,automaticPreparation:false});
}
