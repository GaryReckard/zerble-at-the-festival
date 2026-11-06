// Compare untouched Chrome PNG captures, excluding explicitly declared HUD
// rectangles. Uses only Node built-ins; it does not modify the source images.
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';

function png(file){
  const bytes=readFileSync(file);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not PNG');
  let width,height,bpp;const chunks=[];
  for(let p=8;p<bytes.length;){
    const length=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8),data=bytes.subarray(p+8,p+8+length);p+=12+length;
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);if(data[8]!==8||![2,6].includes(data[9])||data[12]!==0)throw Error('Unsupported PNG encoding');bpp=data[9]===2?3:4;}
    if(type==='IDAT')chunks.push(data);
  }
  const compressed=inflateSync(Buffer.concat(chunks)),stride=width*bpp,pixels=new Uint8Array(stride*height);let offset=0;
  for(let y=0;y<height;y++){
    const filter=compressed[offset++];if(filter>4)throw Error('Invalid PNG filter');
    for(let x=0;x<stride;x++){
      const left=x>=bpp?pixels[y*stride+x-bpp]:0,up=y?pixels[(y-1)*stride+x]:0,corner=y&&x>=bpp?pixels[(y-1)*stride+x-bpp]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      if(filter===2)predictor=up;
      if(filter===3)predictor=Math.floor((left+up)/2);
      if(filter===4){const p=left+up-corner,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-corner);predictor=a<=b&&a<=c?left:b<=c?up:corner;}
      pixels[y*stride+x]=(compressed[offset++]+predictor)&255;
    }
  }
  if(offset!==compressed.length)throw Error('Unexpected PNG scanline data');
  return {width,height,bpp,pixels,sha256:createHash('sha256').update(bytes).digest('hex')};
}
const directory=process.argv[2],report=JSON.parse(readFileSync(path.join(directory,'cameras.json'),'utf8')),rows=[];
for(const comparison of report.comparisons){
  const [a,b]=comparison.pair.map(row=>png(path.join(directory,row.image)));
  if(a.width!==b.width||a.height!==b.height)throw Error('Dimensions changed');
  let pixels=0,changed=0,over8=0,total=0,squares=0,maximum=0;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
    if(y<135||(x<365&&y>360)||(x>1060&&y>500))continue;
    let max=0;
    for(let c=0;c<3;c++){
      const d=Math.abs(a.pixels[(y*a.width+x)*a.bpp+c]-b.pixels[(y*b.width+x)*b.bpp+c]);total+=d;squares+=d*d;max=Math.max(max,d);
    }
    pixels++;if(max)changed++;if(max>8)over8++;maximum=Math.max(maximum,max);
  }
  rows.push({mode:comparison.mode,time:comparison.time,width:a.width,height:a.height,comparedPixels:pixels,changedPixels:changed,
    pixelsOver8:over8,fractionOver8:over8/pixels,meanAbsChannel:total/(pixels*3),rmse:Math.sqrt(squares/(pixels*3)),maxChannelDifference:maximum,
    sha256:[a.sha256,b.sha256],images:comparison.pair.map(x=>x.image)});
}
console.log(JSON.stringify({scope:'Frozen same-scene individual/instance raster comparison. Excludes top135px, physics HUD x<365/y>360 and minimap x>1060/y>500. Reports differences, not a subjective quality verdict.',rows},null,2));
