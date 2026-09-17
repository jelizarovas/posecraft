import {createDrawing} from '../src/vector-authoring.js';
export function actionFixture(){
 const d=createDrawing(),pack=d.packs.drawing;d.presentation='live';d.requiredFeatures=['action-variations'];
 pack.parts=[{id:'body',joint:'root',d:'M0 0H40V40H0Z',fill:'#8b65c9'}];
 pack.clips.lift={duration:1,loop:false,tracks:{'root.y':[[0,0],[.5,-20],[1,0]]}};
 pack.clips.struggle={duration:1.5,loop:false,tracks:{'root.y':[[0,0],[.6,-8],[.9,-5],[1.1,-9],[1.5,0]]}};
 d.behaviorGraph={seed:42,variables:{fatigue:0,reps:0,failures:0},variableBounds:{fatigue:{min:0,max:100},reps:{min:0,max:1000},failures:{min:0,max:1000}},initial:'work',states:{work:{actions:[{type:'perform',activity:'lift'}]},rest:{actions:[]}},edges:[{id:'repeat',from:'work',to:'work',event:'done',weight:1}],handlers:[{event:'start',actions:[{type:'perform',activity:'lift'}]}],activities:{lift:{actor:'character',variants:[{id:'normal',clip:'lift',weight:2,speed:{min:.85,max:1.15},offsets:{'root.rotation':{min:-3,max:3}}},{id:'slow',clip:'lift',weight:1,speed:{min:.65,max:.8}}],failureVariants:[{id:'stall',clip:'struggle',weight:1,speed:{min:.8,max:1}}],success:{base:1,modifiers:[{variable:'fatigue',weight:-.01}]},onStart:[{type:'add',variable:'fatigue',value:20}],onSuccess:[{type:'add',variable:'reps',value:1},{type:'event',event:'done'}],onFailure:[{type:'add',variable:'failures',value:1},{type:'event',event:'done'}]}}};
 return d;
}
