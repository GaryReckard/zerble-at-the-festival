import { computeLandscapeTask } from '../worldgen/landscapeTask.js';
self.onmessage=({data})=>{
  try {
    const result=computeLandscapeTask(data);
    const buffers=result.render?['roadPositions','waterPositions','roadNormals','waterNormals','roadUvs'].map(key=>result.render[key].buffer):[];
    if(JSON.stringify({...result,render:null}).length+buffers.reduce((sum,b)=>sum+b.byteLength,0)>512000)throw new Error('Landscape worker payload exceeds its budget');
    self.postMessage(result,buffers);
  } catch(error) {self.postMessage({type:'error',id:data.id,key:data.key,message:error.message});}
};
