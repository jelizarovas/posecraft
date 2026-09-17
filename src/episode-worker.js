import {EpisodeController} from './episode.js';
let controller;
self.onmessage=({data:m})=>{try{if(m.type==='init'){controller=new EpisodeController(m.project);self.postMessage({type:'ready'});}else if(m.type==='frame'){const start=performance.now();self.postMessage({type:'frame',frame:controller.frame(m.time),computeMs:performance.now()-start});}else if(m.type==='bake')self.postMessage({type:'bake',id:m.id,keys:controller.bakeMotion(m.shot,m.actor)});}catch(error){self.postMessage({type:'error',message:error.message,id:m.id});}};
