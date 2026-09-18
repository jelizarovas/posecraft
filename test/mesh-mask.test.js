import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialParts} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';

test('two-sided mesh masks retain all visible faces through front and back turns',()=>{
 for(const columns of [1,16]){
  const rows=8,vertices=[],triangles=[];for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)vertices.push({weights:[{joint:'root',x:x*6,y:y*8,weight:1}]});for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const i=y*(columns+1)+x;triangles.push([i,i+1,i+columns+1],[i+1,i+columns+2,i+columns+1]);}
  const p={spatial:true,joints:[{id:'root',parent:null,x:0,y:0,length:0,rotation:0,min:-180,max:180}],parts:[{id:'skin',joint:'root',d:'M0 0Z',fill:'#c98159',spatial:{mesh:{vertices,triangles}}}]};
  for(const yaw of [0,45,90,135,180,-180]){const pose={'root.yaw':yaw},view=spatialParts(p,{pose,world:forwardKinematics(p.joints,pose)}).parts.get('skin'),visible=view.mesh.faces.filter(f=>f.visible);assert.equal((view.d.match(/M/g)||[]).length,visible.length,`mask drops a rendered face at ${yaw} degrees`);if(Math.abs(yaw)!==90)assert.ok(view.d.length>0);}
 }
});
