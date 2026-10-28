// DOM-free command grammar. The game supplies an explicit action adapter;
// parsing and completion never evaluate code or traverse arbitrary properties.
const TOGGLES = ['on','off','toggle'];
const TIMES = {dawn:0,morning:.15,noon:.30,dusk:.50,evening:.63,midnight:.75};
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const number = (text,min,max,integer=false) => {
  if(typeof text!=='string'||!text.trim())return null;
  const n=Number(text);
  return Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n))?n:null;
};

export function createDebugCommands(actions, targets, targetDescriptions, worldgenV2=true) {
  const defs = new Map();
  const add=(name,description,syntax,args,run)=>defs.set(name,{name,description,syntax,args,run});
  const use=name=>'Use /'+defs.get(name).syntax;
  const toggle=(name,action)=>add(name, 'Toggle '+(name==='god'?'invincibility':'collision outlines'),name+' [on|off|toggle]',[TOGGLES],args=>{
    if(args.length>1||args.length&&!TOGGLES.includes(args[0]))return use(name);
    return action(args[0]||'toggle');
  });
  const names=()=>[...defs.keys()];
  const targetNames=Object.keys(targets).filter(name=>worldgenV2?name!=='forest':!['woodland','village'].includes(name));
  add('help','Discover commands or explain one','help [command]',[names],args=>{
    if(args.length>1)return use('help');
    if(args.length){const def=defs.get(args[0]);return def?'/'+def.syntax+'\n'+def.description:'Unknown command. Type /help.';}
    return [...defs.values()].map(d=>'/'+d.syntax+' · '+d.description).join('\n')+'\nRepeat a teleport destination to visit another.';
  });
  add('tp','Teleport to a place or coordinates; repeat to visit another','tp <destination> | <x> <z>',[()=>targetNames],args=>{
    if(args.length===2){
      const values=args.map(v=>number(v,-1e7,1e7));
      if(values.every(v=>v!==null))return actions.teleport(...values);
    }
    if(args.length!==1||!own(targets,args[0])||!targetNames.includes(args[0]))return use('tp');
    return actions.locate(targets[args[0]]);
  });
  add('time','Read or set the day/night cycle','time [dawn|morning|noon|dusk|evening|midnight|0..1]',[Object.keys(TIMES)],args=>{
    if(args.length>1)return use('time');
    if(!args.length)return actions.time();
    const t=own(TIMES,args[0])?TIMES[args[0]]:number(args[0],0,1);
    return t===null?use('time'):actions.time(t);
  });
  add('pause','Pause simulation while keeping commands available','pause',[],()=>actions.pause(true));
  add('resume','Resume simulation and clear queued steps','resume',[],()=>actions.pause(false));
  add('step','Pause, then advance a bounded number of frames','step [1..120]',[['1','10','60','120']],args=>{
    const n=args.length?number(args[0],1,120,true):1;
    return args.length>1||n===null?use('step'):actions.step(n);
  });
  toggle('god',mode=>actions.god(mode));toggle('colliders',mode=>actions.colliders(mode));
  add('npc','Inspect the crowd, freeze/resume it, or trigger a nearby cheer','npc <status|freeze|resume|cheer>',[['status','freeze','resume','cheer']],args=>{
    if(args.length!==1||!['status','freeze','resume','cheer'].includes(args[0]))return use('npc');
    return actions.npc(args[0]);
  });
  add('juice','Read or set bubble-juice reserves','juice [0..100]',[['0','1','5','20','100']],args=>{
    const n=args.length?number(args[0],0,100):undefined;
    return args.length>1||n===null?use('juice'):actions.juice(n);
  });
  add('smiles','Drop collectible smiles near the cart','smiles [1..100]',[['1','10','50','100']],args=>{
    const n=args.length?number(args[0],1,100,true):10;
    return args.length>1||n===null?use('smiles'):actions.smiles(n);
  });
  add('star','Find the star-power pickup or create one near the cart','star [find|spawn|trigger|end]',[['find','spawn','trigger','end']],args=>{
    if(args.length>1||args.length&&!['find','spawn','trigger','end'].includes(args[0]))return use('star');
    return actions.star(args[0]||'find');
  });
  add('heading','Read or set the cart heading in degrees','heading [0..360]',[['0','90','180','270']],args=>{
    const n=args.length?number(args[0],0,360):undefined;
    return args.length>1||n===null?use('heading'):actions.heading(n);
  });
  add('stop','Stop the cart immediately','stop',[],()=>actions.stop());
  add('where','Show world coordinates and heading','where',[],()=>actions.where());
  add('seed','Show the current procedural seed','seed',[],()=>actions.seed());
  add('status','Show simulation, world and rendering status','status',[],()=>actions.status());
  add('inspect','Inspect people controllers, nearby camps, NPC states, audio or world counts','inspect <people|camps|npcs|audio|world>',[['people','camps','npcs','audio','world']],args=>{
    if(args.length!==1||!['people','camps','npcs','audio','world'].includes(args[0]))return use('inspect');
    return actions.inspect(args[0]);
  });
  add('camera','Switch to chase or a top-down view; optional span in metres','camera <chase|top> [20..600]',[['chase','top'],args=>args[0]==='top'?['60','120','240','480']:[]],args=>{
    if(args[0]==='chase'&&args.length===1)return actions.camera('chase');
    const span=args.length===2?number(args[1],20,600):120;
    if(args[0]!=='top'||args.length>2||span===null)return use('camera');
    return actions.camera('top',span);
  });
  add('perf','Read rendering counters or start/stop local performance recording','perf [status|on|off]',[['status','on','off']],args=>{
    if(args.length>1||args.length&&!['status','on','off'].includes(args[0]))return use('perf');
    return actions.perf(args[0]||'status');
  });
  add('mute','Read or change session audio mute','mute [on|off|toggle]',[TOGGLES],args=>{
    if(args.length>1||args.length&&!TOGGLES.includes(args[0]))return use('mute');
    return actions.mute(args[0]);
  });
  return {
    run(text) {
      const tokens=String(text).trim().replace(/^\//,'').toLowerCase().split(/\s+/),name=tokens.shift(),def=defs.get(name);
      if(!def)return 'Unknown command. Type /help.';
      if(!def.args.length&&tokens.length)return use(name);
      if(name!=='help'&&!actions.ready())return 'Start a game mode before using this command.';
      try{return String(def.run(tokens));}catch(error){return 'Command failed: '+error.message;}
    },
    suggest(text,caret=text.length) {
      const left=text.slice(0,caret),match=left.match(/^(\s*\/?)(.*)$/);if(!match)return [];
      const [,prefix,body]=match,words=body.split(/\s+/),partial=words.pop().toLowerCase();
      const end=caret+(text.slice(caret).match(/^\S*/)?.[0].length||0),suffix=text.slice(end);
      if(!words.length)return names().filter(n=>n.startsWith(partial)).filter(n=>n!==partial||defs.get(n).args.length)
        .map(n=>({label:'/'+n,detail:defs.get(n).description,value:prefix+n+(defs.get(n).args.length?' ':'')+suffix}));
      const command=words.shift().toLowerCase(),def=defs.get(command);if(!def)return [];
      const spec=def.args[words.length],options=typeof spec==='function'?spec(words.map(w=>w.toLowerCase())):spec||[];
      return options.filter(n=>n.startsWith(partial)&&n!==partial).map(n=>({label:n,
        detail:command==='tp'?targetDescriptions[n]:command==='help'?defs.get(n).description:def.description,
        value:prefix+[command,...words,n].join(' ')+suffix}));
    },
  };
}
