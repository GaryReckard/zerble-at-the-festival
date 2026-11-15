// Singles cancellation scoring: a game can finish only after all eight bags.
export class CornholeRules {
  constructor(){this.score=[0,0];this.round=1;this.leader=0;this.throws=[];this.winner=null;}
  get turn(){return (this.leader+this.throws.length)%2;}
  toss(points){
    if(this.winner!==null||this.throws.length===8)throw new Error('Round is closed.');
    if(![0,1,3].includes(points))throw new RangeError('A bag scores zero, one or three.');
    this.throws.push({player:this.turn,points});
    if(this.throws.length!==8)return null;
    const totals=[0,0];for(const bag of this.throws)totals[bag.player]+=bag.points;
    const delta=totals[0]-totals[1];
    if(delta!==0){this.leader=delta>0?0:1;this.score[this.leader]+=Math.abs(delta);}
    if(this.score[this.leader]>=21)this.winner=this.leader;
    return {totals,score:[...this.score],winner:this.winner};
  }
  nextRound(){if(this.throws.length!==8||this.winner!==null)throw new Error('Round cannot advance.');this.round++;this.throws=[];}
}
