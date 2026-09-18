import {createDrawing} from '../src/vector-authoring.js';
export function meshExportFixture(){
 const d=createDrawing(),p=d.packs.drawing;d.name='Weighted surface export';d.bounds={width:360,height:240};d.requiredFeatures=['spatial-rig','skinned-mesh','scene-lighting'];p.spatial=true;
 p.joints.push({id:'fold',parent:'root',x:60,y:0,length:60,rotation:0,min:-180,max:180});
 const vertex=(x,y,joint='root')=>({weights:[{joint,x,y,z:0,weight:1}]}),vertices=[vertex(0,0),vertex(0,40),vertex(60,0),vertex(60,40),vertex(60,0,'fold'),vertex(60,40,'fold')];
 for(const i of [2,3])vertices[i].weights=[{joint:'root',x:60,y:i===2?0:40,weight:.5},{joint:'fold',x:0,y:i===2?0:40,weight:.5}];
 p.parts=[{id:'skin',joint:'root',d:'M0 0H120V40H0Z',fill:'#c98159',stroke:'#663f32',strokeWidth:2,spatial:{mesh:{vertices,triangles:[[0,2,1],[1,2,3],[2,4,3],[3,4,5]],creaseAngle:30,correctives:[{joint:'fold',channel:'rotation',min:0,max:50,offsets:[{vertex:4,y:-8,z:10},{vertex:5,y:8,z:10}]}]}}}];
 p.clips.idle={duration:2,loop:true,tracks:{'fold.rotation':[[0,0],[1,50],[2,0]],'fold.yaw':[[0,0],[1,65],[2,0]],'root.yaw':[[0,-20],[1,25],[2,-20]]}};
 d.actors[0].transform={x:115,y:90,scale:1,rotation:0};d.lighting={enabled:true,shading:'cel',type:'directional',angle:-135,elevation:50,intensity:.5,ambient:.7,celThickness:.3,celIntensity:.4,floorShadow:0,wallShadow:0,reflection:0};return d;
}
