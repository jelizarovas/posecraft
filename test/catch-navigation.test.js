import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatchNavigation} from '../examples/catch.js';
import {SceneController} from '../src/scene.js';
import {SceneObjects} from '../src/scene-objects.js';
import {PropGameRuntime} from '../src/prop-games.js';
import {applyContacts} from '../src/contacts.js';
import {IllustrationController} from '../src/illustration.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {PathJob,navigationObstacles,segmentClear} from '../src/navigation.js';

test('navigation accounts for rotated collider offsets, hidden folders and static circles',()=>{
 const doc={bounds:{width:500,height:400},groups:[{id:'hidden',hidden:true}],props:[
  {x:200,y:150,rotation:90,collider:{enabled:true,x:40,y:0,width:40,height:12}},
  {x:80,y:80,group:'hidden',collider:{enabled:true,x:0,y:0,width:80,height:80}}
 ],objects:[{shape:'circle',x:350,y:150,radius:25,mass:0},{shape:'circle',x:80,y:80,radius:40,mass:1}]};
 const shapes=navigationObstacles(doc);assert.equal(shapes.length,2);assert.equal(shapes[0].y,190);
 assert.equal(segmentClear(shapes,{x:160,y:190},{x:240,y:190}),false);
 assert.equal(segmentClear(shapes,{x:30,y:80},{x:120,y:80}),true);
 assert.equal(segmentClear(shapes,{x:280,y:150},{x:420,y:150},{clearance:10}),false);
});

test('active incremental routes restore exactly and each route segment has clearance',()=>{
 const doc=createCatchNavigation(),request={start:{x:180,y:318},end:{x:600,y:318},area:doc.objectGames[0].navigation.bounds,cellSize:12,clearance:18};
 const a=new PathJob(doc,request);a.step(8);assert.equal(a.done,false);const b=PathJob.restore(doc,a.snapshot());
 while(!a.done){const before=a.expanded;a.step(8);b.step(8);assert.ok(a.expanded-before<=8);assert.deepEqual(a.snapshot(),b.snapshot());}
 assert.ok(a.result.path?.length);const points=[request.start,...a.result.path,request.end];
 for(let i=1;i<points.length;i++)assert.equal(segmentClear(navigationObstacles(doc),points[i-1],points[i],request),true);
 assert.ok(points.some(p=>Math.abs(p.y-318)>40));
});

test('Catch follows a genuine detour without crossing scenery, with bounded planning and replay',()=>{
 const doc=createCatchNavigation(),c=new SceneController(doc),r=c.propGames,g=doc.objectGames[0],state=r.games[0],actor=state.actors[0];
 state.actors[1].x=680;state.actors[1].y=260;r.navigationShapes=navigationObstacles(doc);r.navigationKey=JSON.stringify(r.navigationShapes);
 const advance=()=>{r.time+=1/120;state.navigationBudget=8;const before=r.routes.get(actor.id)?.job?.expanded||0;r.navigate(actor,{x:600,y:318},145,1/120,3,{...g,navigation:{...g.navigation,maxNodes:8}});const after=r.routes.get(actor.id)?.job?.expanded||0;assert.ok(after-before<=8);};
 advance();assert.equal(r.routes.get(actor.id)?.job.done,false);const snap=r.snapshot();for(let i=0;i<20;i++)advance();const result=r.snapshot();r.restore(snap);
 // Restore replaces actor state; compare a second controller to avoid stale references.
 const copy=new SceneController(doc);copy.propGames.restore(snap);copy.propGames.navigationShapes=r.navigationShapes;copy.propGames.navigationKey=r.navigationKey;
 for(let i=0;i<20;i++){const rr=copy.propGames,ss=rr.games[0];rr.time+=1/120;ss.navigationBudget=8;rr.navigate(ss.actors[0],{x:600,y:318},145,1/120,3,{...g,navigation:{...g.navigation,maxNodes:8}});}
 assert.deepEqual(copy.propGames.snapshot(),result);
 const rr=copy.propGames,aa=rr.games[0].actors[0];let deviation=0;
 for(let i=0;i<1000;i++){const before={x:aa.x,y:aa.y};rr.time+=1/120;rr.games[0].navigationBudget=8;rr.navigate(aa,{x:600,y:318},145,1/120,3,{...g,navigation:{...g.navigation,maxNodes:8}});assert.equal(segmentClear(rr.navigationShapes,before,aa,{area:g.navigation.bounds,clearance:g.navigation.clearance}),true);deviation=Math.max(deviation,Math.abs(aa.y-318));}
 assert.ok(deviation>40);assert.ok(Math.hypot(aa.x-600,aa.y-318)<4);copy.dispose();c.dispose();
});

test('routed Catch retrieves missed balls and replays full and lightweight scenes identically',()=>{
 const doc=createCatchNavigation();assertDocument(doc);const events=[],full=new SceneController(doc),lite=new IllustrationController(doc,{objectFactory:SceneObjects,gameFactory:PropGameRuntime,contactSolver:applyContacts});full.subscribe(e=>events.push(e.type));
 for(let i=0;i<4200;i++){full.tick();lite.tick();}
 const frame=full.frame();assert.ok(frame.objectGames[0].throws>=4);assert.ok(frame.objectGames[0].catches>=1);assert.ok(events.includes('retrieve'));
 assert.deepEqual(lite.frame().objectGames,frame.objectGames);assert.deepEqual(lite.frame().objects,frame.objects);
 for(const a of frame.actors)assert.deepEqual(lite.frame().actors.find(b=>b.id===a.id).pose,a.pose);
 full.seek(35);assert.deepEqual(full.frame().objects,frame.objects);assert.deepEqual(full.frame().objectGames,frame.objectGames);full.dispose();lite.dispose();
});

test('walking areas reject insufficient clearance and excessive grids',()=>{
 for(const change of [n=>n.bounds.height=30,n=>n.bounds.x=790,n=>n.maxNodes=1000,n=>n.cellSize=2]){const d=createCatchNavigation();change(d.objectGames[0].navigation);assert.equal(validateDocument(d).valid,false);}
});
