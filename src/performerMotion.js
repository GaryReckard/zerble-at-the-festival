// Rig coordinates in metres, with the audience on -Z. Each hand has a rest
// and an action contact in instrument space; the same contacts author the mesh.
const pair=(a,b)=>[a,b];
export const performerContacts={
  guitar:[pair([-.42,1.33,-.43],[-.67,1.445,-.43]),pair([.055,1.17,-.472],[.17,.99,-.48])],
  bass:[pair([-.40,1.32,-.43],[-.68,1.45,-.43]),pair([.09,1.095,-.479],[.11,1.065,-.452])],
  drum:[pair([-.27,1.40,-.36],[-.31,1.25,-.36]),pair([.41,1.61,-.44],[.43,1.51,-.46])],
  march_drum:[pair([-.22,1.37,-.28],[-.20,1.20,-.32]),pair([.22,1.37,-.28],[.20,1.20,-.32])],
  sax:[pair([.085,1.35,-.43],[.095,1.34,-.415]),pair([.175,1.13,-.43],[.183,1.12,-.413])],
  trumpet:[pair([.01,1.49,-.45],[.01,1.49,-.45]),pair([.035,1.704,-.52],[.035,1.669,-.52])],
  trombone:[pair([.0,1.53,-.39],[.0,1.53,-.39]),pair([.035,1.46,-.46],[.035,1.46,-.82])],
  tuba:[pair([-.34,1.31,-.26],[-.34,1.31,-.26]),pair([.12,1.56,-.35],[.12,1.529,-.35])],
  lead_vocal:[pair([-.04,1.49,-.41],[-.02,1.55,-.37]),pair([.36,.91,-.13],[.56,1.52,-.22])],
  keys:[pair([-.316,1.20,-.43],[-.316,1.162,-.44]),pair([.179,1.20,-.43],[.179,1.162,-.44])],
  sound:[pair([-.22,1.15,-.60],[-.30,1.12,-.71]),pair([.25,1.15,-.60],[.21,1.13,-.69])],
};
export const stickTips={
  drum:[pair([-.4,1.64,-.59],[-.43,1.16,-.58]),pair([.68,1.80,-.63],[.68,1.51,-.69])],
  march_drum:[pair([-.16,1.59,-.52],[-.12,1.11,-.59]),pair([.16,1.59,-.52],[.12,1.11,-.59])],
};

const clip=x=>Math.min(1,Math.max(0,x||0));
// Use the playable range of each miniature instrument. A lower pitch needs a
// longer string or air column; a higher keyboard register lies to the right.
function register(hz,low,octaves){
  return clip(Math.log2(hz/low)/octaves);
}
export function samplePerformerPose(role,seconds,cue,phase,out){
  // Only autonomous parade/standalone actors get an illustrative rhythm.
  // Explicit transport states, including a paused or out-of-range stage, win.
  const playing=cue==null || cue.playing;
  const t=playing && cue!=null ? cue.time : seconds;
  const beat=cue==null?Math.floor(t*1.8):cue.beat;
  const step=cue==null?t*1.8%1:cue.beatPhase;
  const pulse=Math.max(0,1-3*step);
  const lead=playing?clip(cue==null?pulse:cue.lead):0;
  const chord=playing?clip(cue==null?pulse:cue.chord):0;
  const bass=playing?clip(cue==null?pulse:cue.bass):0;
  const snare=playing?clip(cue==null?(beat%2?pulse:0):cue.snare):0;
  const hat=playing?clip(cue==null?pulse:cue.hat):0;
  const kick=playing?clip(cue==null?(beat%2?0:pulse):cue.kick):0;
  let l=0,r=0;
  if(role==='drum'){l=snare;r=hat;}
  else if(role==='march_drum'){l=snare;r=kick;}
  else if(role==='guitar'||role==='bass'){
    const voice=role==='bass'?bass:Math.max(chord,lead);
    if(playing && cue){
      const pitch=role==='bass'?cue.bassPitch:(cue.leadPitch || (chord>0 && cue.bassPitch));
      l=out.left??0;
      if(pitch>0)l=1-register(pitch,role==='bass'?41.2:110,role==='bass'?2.5:3);
    }else if(playing){
      const bar=Math.floor(beat/2),from=Math.sin((bar-1)*.96+phase),to=Math.sin(bar*.96+phase);
      const u=clip(((beat%2)+step)*4),glide=u*u*(3-2*u);
      l=.47+.43*(from+(to-from)*glide);
    }
    r=voice;
  }else if(role==='keys'){
    l=chord;r=lead;
    // The right hand follows melody. The chord hand uses its accompanying
    // bass register when available, then holds that voicing through its rest.
    if(!playing){out.keyLeft=0;out.keyRight=0;}
    if(playing && cue?.leadPitch>0){
      out.keyRight=(Math.round(register(cue.leadPitch,130.81,3)*8)-2)/6;
    }
    if(chord>0 && cue?.bassPitch>0){
      out.keyLeft=(Math.round(register(cue.bassPitch,41.2,2.5)*6)-2)/6;
    }
  }else if(role==='trombone'){
    if(playing && cue){
      r=cue.leadPitch>0?1-register(cue.leadPitch,130.81,3):(out.right??0);
    }else if(playing)r=lead;
  }
  else if(role==='lead_vocal'){l=lead;r=playing?Math.min(1,lead*.25+chord*.25+(1-lead)*.50*(.5+.5*Math.sin((beat+step)*.8+phase))):0;}
  else if(role==='sound'){l=chord;r=Math.max(bass,hat);}
  else{l=role==='tuba'?bass:lead;r=l;}
  const sway=Math.sin(t*.83+phase);
  const energy=playing?Math.max(lead,bass,chord,kick,snare,hat):0;
  const intensity=playing?clip(cue?.intensity??.7):0;
  out.glance=Math.sin(t*.51+phase)*(.95-.55*energy);
  out.nod=.18*Math.sin(t*.87+phase)+(role==='drum'?kick:Math.max(lead,bass,chord))*(.45+.28*intensity);
  out.left=l;out.right=r;out.kick=kick;
  out.lean=.022*sway+.038*Math.max(chord,kick,lead);
  out.turn=.085*Math.sin(t*.48+phase)+.035*Math.max(lead,bass);
  out.breath=.012*Math.sin(t*1.7+phase)+.040*Math.max(lead,bass);
  return out;
}
