import {continuousSegmentClear} from './map-collision.js';

class Heap{
 constructor(){this.items=[];}
 push(v){const a=this.items;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
/** Sparse quarter-cell A*. Terrain tiles remain independent of locomotion. */
export class MapNavigationJob{
 constructor(map,index,start,goals,{allowVault=true}={}){
  this.map=map;this.index=index;this.start={x:start.x,y:start.y};this.radius=map.navigation.radius;this.allowVault=allowVault;
  this.goals=(Array.isArray(goals)?goals:[goals]).filter(p=>!index.isPointBlocked(p.x,p.y,this.radius));
  this.result={status:'pending',path:null,reason:null,visited:0};this.open=new Heap();this.cost=new Map();this.parents=new Map();this.closed=new Set();this.width=map.width*4;
  if(index.isPointBlocked(start.x,start.y,this.radius)){this.fail('blocked-start');return;}
  if(!this.goals.length){this.fail('blocked-target');return;}
  // Nearby exact destinations can be connected without a grid waypoint.
  const nearest=[...this.goals].sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y));
  for(const goal of nearest)if(this.clear(start,goal)){this.result={status:'complete',path:[this.start,{...goal}],reason:null,visited:0};return;}
  const sx=Math.floor(start.x*4),sy=Math.floor(start.y*4);
  for(let y=sy-1;y<=sy+1;y++)for(let x=sx-1;x<=sx+1;x++){
   const p=this.point(x,y);if(!this.inside(x,y)||!this.clear(start,p))continue;
   const id=y*this.width+x,g=Math.hypot(start.x-p.x,start.y-p.y);this.cost.set(id,g);this.parents.set(id,-1);this.open.push({id,g,f:g+this.heuristic(p)});
  }
 }
 inside(x,y){return x>=0&&y>=0&&x<this.width&&y<this.map.height*4;}
 point(x,y){return{x:(x+.5)/4,y:(y+.5)/4};}
 clear(a,b){return continuousSegmentClear(this.index,a,b,this.radius,{allowVault:this.allowVault});}
 heuristic(p){return Math.min(...this.goals.map(g=>Math.hypot(g.x-p.x,g.y-p.y)));}
 fail(reason){this.result.status='failed';this.result.reason=reason;}
 step(budget=128){
  if(!Number.isInteger(budget)||budget<1||budget>10000)throw TypeError('Invalid navigation budget');
  let work=0;
  while(this.result.status==='pending'&&this.open.items.length&&work++<budget){
   const node=this.open.pop();if(this.closed.has(node.id)||this.cost.get(node.id)!==node.g)continue;
   this.closed.add(node.id);this.result.visited++;
   const x=node.id%this.width,y=Math.floor(node.id/this.width),p=this.point(x,y);
   const goal=this.goals.find(g=>Math.hypot(g.x-p.x,g.y-p.y)<.5&&this.clear(p,g));
   if(goal){const path=[{...goal}];let id=node.id;while(id!==-1){path.push(this.point(id%this.width,Math.floor(id/this.width)));id=this.parents.get(id);}path.push(this.start);this.result.status='complete';this.result.path=path.reverse();break;}
   if(this.result.visited>=100000){this.fail('search-limit');break;}
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if((!dx&&!dy)||!this.inside(x+dx,y+dy))continue;
    const id=(y+dy)*this.width+x+dx;if(this.closed.has(id))continue;
    const q=this.point(x+dx,y+dy);if(!this.clear(p,q))continue;
    const terrain=this.map.terrain[Math.floor(q.y)*this.map.width+Math.floor(q.x)];
    const g=node.g+Math.hypot(dx,dy)/4*(terrain===1?1:terrain===3?1.6:1.2);
    if(g>=(this.cost.get(id)??Infinity))continue;
    this.cost.set(id,g);this.parents.set(id,node.id);this.open.push({id,g,f:g+this.heuristic(q)});
   }
  }
  if(this.result.status==='pending'&&!this.open.items.length)this.fail('unreachable');
  return this.result;
 }
}
