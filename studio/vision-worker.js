import {FaceLandmarker,HandLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
// Block SDK telemetry and any upload. This worker only fetches same-origin static assets.
const assetFetch=self.fetch.bind(self);
self.fetch=(input,options={})=>{
 const url=new URL(input instanceof Request?input.url:input,self.location.href),method=options.method||(input instanceof Request?input.method:'GET');
 if(url.origin!==self.location.origin||method!=='GET')return Promise.reject(new Error('Vision permits local asset downloads only.'));
 return assetFetch(input,options);
};
let face,hand;
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   const files=await FilesetResolver.forVisionTasks(m.base,true);
   // The task loader clears ModuleFactory after each instance; ESM imports are cached.
   const {default:factory}=await import(/* @vite-ignore */ files.wasmLoaderPath);
   files.wasmLoaderPath=undefined;self.ModuleFactory=factory;
   face=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:m.base+'/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});
   self.ModuleFactory=factory;
   hand=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:m.base+'/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2});
   self.postMessage({type:'ready'});
  }else if(m.type==='frame'){
   const start=performance.now(),f=face.detectForVideo(m.bitmap,m.time),h=hand.detectForVideo(m.bitmap,m.time);
   self.postMessage({type:'result',time:m.time,computeMs:performance.now()-start,face:f.faceLandmarks[0]||null,blendshapes:Object.fromEntries((f.faceBlendshapes[0]?.categories||[]).map(c=>[c.categoryName,c.score])),hands:h.landmarks.map((points,i)=>({points,side:h.handedness[i][0].categoryName,score:h.handedness[i][0].score}))});
  }
 }catch(e){self.postMessage({type:'error',message:e.message||'Tracking failed.'});}
 finally{m.bitmap?.close();}
};
