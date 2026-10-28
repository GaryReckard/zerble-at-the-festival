// A place lends its existing display updater to the directory. It still owns
// its rigs, chunk publications and disposal; this adapter creates no people,
// movement claims, query candidates or collision candidates.
export class PlaceDisplay {
  constructor({runtime,key,slot,advance,count}) {
    if(typeof advance!=='function'||typeof count!=='function')throw new TypeError('Place display requires an updater and count reader.');
    this.runtime=runtime;this.advance=advance;this.count=count;this.disposed=false;
    this.ownerToken=runtime.register({key,controller:this,schedule:[{slot,run:this.run}]});
  }

  run(dt,frame) {if(!this.disposed)this.advance(dt,frame);}
  inspect(out) {out.displayOnly=true;out.population=0;out.displays=this.disposed?0:this.count();out.disposed=this.disposed;}
  dispose(reason='place-display-disposed') {
    if(this.disposed)return;
    this.disposed=true;
    if(this.runtime.isRegistered(this.ownerToken))this.runtime.unregister(this.ownerToken,reason);
  }
}
