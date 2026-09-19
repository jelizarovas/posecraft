import {createBenchProject3D,validateBenchProject3D} from './bench-project-3d.js';
const copy=structuredClone,record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function createWorkoutProject3D(){const base=createBenchProject3D();return {...base,kind:'workout3d',name:'One More Rep',camera:{position:[5,3.1,6],target:[-.6,1,0],height:4},pullup:{position:[-2.2,2.25,0],rotation:[0,0,0,1],width:1.1},bottle:{position:[1.5,1.1,1.7],rotation:[0,0,0,1]},workout:{seed:17,reps:{min:6,max:8},sequence:['pullup','bench'],restThreshold:65,drinkThreshold:45,restDuration:4,drinkDuration:4,fatigue:0,dehydration:0,failureBase:.08}};}
export function validateWorkoutProject3D(value){
 const errors=[],add=(path,message)=>{if(errors.length<40)errors.push({path,message});};
 try{
  let count=0;const active=new WeakSet();function json(v,path,depth){if(++count>1500||depth>10)throw Error('Project exceeds its data limits.');if(v===null||typeof v==='boolean')return;if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Expected finite numbers.');return;}if(typeof v==='string'){if(v.length>200)throw Error('Text exceeds 200 characters.');return;}if(typeof v!=='object'||active.has(v)||!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Expected plain JSON without cycles.');active.add(v);if(Object.getOwnPropertySymbols(v).length)throw Error('Symbols are not JSON.');const ds=Object.getOwnPropertyDescriptors(v);for(const [k,d]of Object.entries(ds)){if(Array.isArray(v)&&k==='length')continue;if(['__proto__','prototype','constructor'].includes(k)||!Object.hasOwn(d,'value')||!d.enumerable)throw Error('Unsupported JSON property.');json(d.value,path+'.'+k,depth+1);}if(Array.isArray(v)&&(Object.keys(ds).length!==v.length+1||Object.keys(ds).some(k=>k!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length))))throw Error('Expected dense arrays.');active.delete(v);}json(value,'$',0);
  const fields=(v,keys,path)=>{if(!record(v)){add(path,'Expected an object.');return false;}for(const k of Object.keys(v))if(!keys.includes(k))add(path+'.'+k,'Unknown field.');return true;};
  if(!fields(value,['kind','version','name','character','bench','camera','settings','pullup','bottle','workout'],'$'))return {valid:false,errors};
  if(value.kind!=='workout3d'||value.version!==1)add('$','Expected a version 1 native workout.');
  const base={};for(const key of ['version','name','character','bench','camera','settings'])base[key]=value[key];base.kind='bench-study3d';errors.push(...validateBenchProject3D(base).errors);
  for(const key of ['pullup','bottle'])if(fields(value[key],key==='pullup'?['position','rotation','width']:['position','rotation'],'$.'+key)){
   const p=value[key].position,q=value[key].rotation;if(!Array.isArray(p)||p.length!==3||!p.every(n=>finite(n,-20,20)))add('$.'+key+'.position','Expected three finite coordinates within 20 meters.');
   if(!Array.isArray(q)||q.length!==4||!q.every(n=>finite(n,-1,1))||Math.abs(Math.hypot(...q)-1)>1e-5)add('$.'+key+'.rotation','Expected a normalized quaternion.');
   if(key==='pullup'&&!finite(value[key].width,.5,2))add('$.pullup.width','Width must be .5..2 meters.');
  }
  const w=value.workout;if(fields(w,['seed','reps','sequence','restThreshold','drinkThreshold','restDuration','drinkDuration','fatigue','dehydration','failureBase'],'$.workout')){
   if(!Number.isInteger(w.seed)||!finite(w.seed,0,4294967295))add('$.workout.seed','Seed must be an unsigned 32-bit integer.');
   if(fields(w.reps,['min','max'],'$.workout.reps')&&(!Number.isInteger(w.reps.min)||!Number.isInteger(w.reps.max)||!finite(w.reps.min,1,12)||!finite(w.reps.max,w.reps.min,12)))add('$.workout.reps','Repetition bounds must be ordered integers in 1..12.');
   if(!Array.isArray(w.sequence)||!w.sequence.length||w.sequence.length>16||w.sequence.some(n=>!['pullup','bench','rest','drink'].includes(n)))add('$.workout.sequence','Use 1..16 known action names.');
   for(const key of ['restThreshold','drinkThreshold'])if(!finite(w[key],1,100))add('$.workout.'+key,'Threshold must be 1..100.');
   for(const key of ['restDuration','drinkDuration'])if(!finite(w[key],3,30))add('$.workout.'+key,'Duration must be 3..30 seconds.');
   for(const key of ['fatigue','dehydration'])if(!finite(w[key],0,100))add('$.workout.'+key,'Initial statistic must be 0..100.');
   if(!finite(w.failureBase,0,1))add('$.workout.failureBase','Failure probability must be 0..1.');
  }
 }catch(error){add('$',error.message||'Invalid project JSON.');}
 return {valid:!errors.length,errors};
}
export function assertWorkoutProject3D(value){const result=validateWorkoutProject3D(value);if(!result.valid)throw Error(result.errors.map(e=>e.path+': '+e.message).join('; '));return value;}
export class WorkoutProject3DStore{
 #document;#past=[];#future=[];#revision=0;
 constructor(project=createWorkoutProject3D()){this.#document=copy(assertWorkoutProject3D(project));}
 get document(){return copy(this.#document);}get revision(){return this.#revision;}get canUndo(){return this.#past.length>0;}get canRedo(){return this.#future.length>0;}
 replace(project,expectedRevision=this.#revision){if(expectedRevision!==this.#revision)throw Error('Project changed while this edit was being prepared.');const next=copy(assertWorkoutProject3D(project));if(JSON.stringify(next)===JSON.stringify(this.#document))return this.document;this.#past.push(this.#document);if(this.#past.length>60)this.#past.shift();this.#future=[];this.#document=next;this.#revision++;return this.document;}
 undo(){if(!this.canUndo)return this.document;this.#future.push(this.#document);this.#document=this.#past.pop();this.#revision++;return this.document;}
 redo(){if(!this.canRedo)return this.document;this.#past.push(this.#document);this.#document=this.#future.pop();this.#revision++;return this.document;}
}
