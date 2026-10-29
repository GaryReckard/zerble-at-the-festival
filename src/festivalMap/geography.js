import { VERSION } from './model.js';
export class Geography {
  constructor({seed,mode,config},changed=()=>{}) {
    this.options={seed,mode,config,version:VERSION}; this.changed=changed;
    this.tiles=new Map();this.desired=[];this.serial=0;this.generation=0;this.jobs=0;
    this.stats={workerMs:0,bytes:0,commitMs:0,requests:0};this.status=mode==='v2'?'loading':'legacy';
    if(mode==='v2')this.start();
  }
  start() {
    if(this.closed||this.status==='legacy')return;
    this.ready=false;this.identity=`${VERSION}:${this.options.seed}:${++this.generation}`;
    try {
      this.worker=new Worker(new URL('./geography.worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{
        if(data.identity!==this.identity||this.closed)return;
        if(data.type==='error'){this.fail(data.message);return;}
        if(data.type==='ready'){clearTimeout(this.timeout);this.ready=true;this.status='ready';this.pump();return;}
        if(data.type!=='tile'||data.id!==this.active?.id)return;
        clearTimeout(this.timeout);this.active=null;
        const begin=performance.now();
        // Retain only desired results; old zoom/view requests cannot evict useful tiles.
        if(this.desired.some(t=>t.key===data.key)) {
          this.tiles.set(data.key,data);
          if(this.tiles.size>64)this.tiles.delete(this.tiles.keys().next().value);
          this.stats.workerMs=data.workerMs;this.stats.bytes=data.bytes;
          this.changed();
        }
        this.stats.commitMs=performance.now()-begin;
        if(++this.jobs>=256){this.worker.terminate();this.jobs=0;this.start();}else this.pump();
      };
      this.worker.onerror=e=>{e.preventDefault();this.fail('Map geography unavailable');};
      this.worker.onmessageerror=()=>this.fail('Map geography unavailable');
      this.worker.postMessage({type:'init',...this.options,identity:this.identity});
      this.timeout=setTimeout(()=>this.fail('Map geography timed out'),15000);
    }catch{this.fail('Map geography unavailable');}
  }
  fail(reason){clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.active=null;this.status=reason;this.changed();}
  request(tiles){this.desired=tiles.slice(0,36);this.pump();}
  pump(){
    if(this.closed||this.suspended||!this.ready||!this.worker||this.active)return;
    const tile=this.desired.find(t=>!this.tiles.has(t.key));if(!tile)return;
    this.active={id:++this.serial,key:tile.key};this.stats.requests++;
    this.worker.postMessage({type:'tile',identity:this.identity,id:this.active.id,tile});
    this.timeout=setTimeout(()=>this.fail('Map geography timed out'),15000);
  }
  suspend(on){this.suspended=on;if(!on)this.pump();}
  snapshot(){return {...this.stats,status:this.status,tiles:this.tiles.size,pending:this.desired.filter(t=>!this.tiles.has(t.key)).length,active:!!this.active};}
  dispose(){this.closed=true;clearTimeout(this.timeout);this.worker?.terminate();this.tiles.clear();this.desired=[];}
}
