import { ENGINE_WATER_HEIGHT } from './vehicleTuning.js';
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
// Speed is signed longitudinal travel, so a vertical fall cannot rev the motor.
export function engineDemand(state,out={}) {
  const throttle=clamp(Math.abs(state.throttle??0)),speed=clamp(Math.abs(state.speed??0)/18);
  const load=clamp(state.load??0),immersion=Math.max(0,state.immersion??0);
  const boost=clamp(state.boost===true?1:state.boost??0);
  const wet=clamp((immersion-.35)/(ENGINE_WATER_HEIGHT-.35)),running=!state.stopped&&immersion<ENGINE_WATER_HEIGHT;
  out.revs=running?clamp(.05+speed*.45+throttle*(state.grounded===false?.65:.4)+boost*.2):0;
  out.volume=running?(.05+speed*.25+throttle*(.4+load*.3))*(1-wet*.75):0;
  out.muffle=wet;
  return out;
}
