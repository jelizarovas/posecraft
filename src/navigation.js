import {nodeVisible} from './scene-graph.js';
const rad=Math.PI/180,finite=Number.isFinite;
export function navigationObstacles(document){const shapes=[];for(const p of document.props||[]){const c=p.collider;if(!c?.enabled||!nodeVisible(document,p))continue;const a=(p.rotation||0)*rad;shapes.push({shape:'box',x:p.x+c.x*Math.cos(a)-c.y*Math.sin(a),y:p.y+c.x*Math.sin(a)+c.y*Math.cos(a),width:c.width,height:c.height,rotation:p.rotation||0});}for(const o of document.objects||[])if(o.enabled!==false&&o.mass===0)shapes.push({shape:o.shape,x:o.x,y:o.y,width:o.width,height:o.height,radius:o.radius,rotation:o.rotation||0});return shapes;}
const local=(p,o)=>{const a=-(o.rotation||0)*rad,x=p.x-o.x,y=p.y-o.y;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};};
const segmentDistance=(a,b,p)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y);};
function boxCrosses(a,b,rx,ry){let lo=0,hi=1;for(const [axis,r]of [['x',rx],['y',ry]]){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-12){if(Math.abs(a[axis])>r)return false;continue;}const t1=(-r-a[axis])/delta,t2=(r-a[axis])/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}return true;}
export function segmentClear(shapes,a,b,{clearance=0,area}={}){if(area&&[a,b].some(p=>p.x<area.x+clearance||p.x>area.x+area.width-clearance||p.y<area.y+clearance||p.y>area.y+area.height-clearance))return false;return !shapes.some(o=>o.shape==='circle'?segmentDistance(a,b,o)<=o.radius+clearance:boxCrosses(local(a,o),local(b,o),o.width/2+clearance,o.height/2+clearance));}
export function navigationSegmentClear(document,a,b,options={}){return segmentClear(navigationObstacles(document),a,b,options);}
/** Incremental deterministic A*. Heap operations and node expansions are bounded;
 * inflated whole cells keep route segments clear of rotated obstacles. */
export class PathJob {
 constructor(document,{start,end,cellSize=20,clearance=10,area={x:0,y:0,...document.bounds}}={}){
  if(![start?.x,start?.y,end?.x,end?.y,cellSize,clearance,area.x,area.y,area.width,area.height].every(finite)||cellSize<8||cellSize>4096||clearance<0||clearance>500||area.x<0||area.y<0||area.width<=0||area.height<=0||area.x+area.width>document.bounds.width||area.y+area.height>document.bounds.height)throw Error('Invalid path request.');
  this.cols=Math.ceil(area.width/cellSize);this.rows=Math.ceil(area.height/cellSize);if(this.cols*this.rows>16384)throw Error('Path grid exceeds 16384 cells. Increase cell size.');
  this.cellSize=cellSize;this.document=document;this.area={...area};this.clearance=clearance;this.expanded=0;this.done=false;this.result=null;this.shapes=navigationObstacles(document);this.request={start:{...start},end:{...end},cellSize,clearance,area:{...area}};
  for(const p of[start,end])if(p.x<area.x||p.y<area.y||p.x>=area.x+area.width||p.y>=area.y+area.height)throw Error('Path endpoints must be inside scene bounds.');
  this.start=this.index(start);this.end=this.index(end);this.open=[];this.serial=0;this.cost=new Map([[this.start,0]]);this.parent=new Map();this.closed=new Set();this.blocked=new Map();this.push(this.start,0);
 }
 index(p){return Math.floor((p.y-this.area.y)/this.cellSize)*this.cols+Math.floor((p.x-this.area.x)/this.cellSize);}
 point(i){return {x:Math.min(this.area.x+(i%this.cols+.5)*this.cellSize,this.area.x+this.area.width-.01),y:Math.min(this.area.y+(Math.floor(i/this.cols)+.5)*this.cellSize,this.area.y+this.area.height-.01)};}
 solid(i){if(this.blocked.has(i))return this.blocked.get(i);const p=this.point(i),r=this.clearance+this.cellSize*Math.SQRT2/2;const solid=!segmentClear(this.shapes,p,p,{clearance:r,area:this.area});this.blocked.set(i,solid);return solid;}
 heuristic(i){return Math.abs(i%this.cols-this.end%this.cols)+Math.abs(Math.floor(i/this.cols)-Math.floor(this.end/this.cols));}
 less(a,b){return a.f<b.f||a.f===b.f&&a.serial<b.serial;}
 push(index,cost){const entry={index,cost,f:cost+this.heuristic(index),serial:this.serial++};let i=this.open.length;this.open.push(entry);while(i){const parent=(i-1)>>1;if(!this.less(entry,this.open[parent]))break;this.open[i]=this.open[parent];i=parent;}this.open[i]=entry;}
 pop(){const first=this.open[0],last=this.open.pop();if(this.open.length){let i=0;while(i*2+1<this.open.length){let child=i*2+1;if(child+1<this.open.length&&this.less(this.open[child+1],this.open[child]))child++;if(!this.less(this.open[child],last))break;this.open[i]=this.open[child];i=child;}this.open[i]=last;}return first;}
 step(maxNodes=64){if(!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>4096)throw Error('Path work budget is 1..4096 nodes.');for(let count=0;count<maxNodes&&!this.done;count++){
  if(!this.open.length||this.solid(this.start)||this.solid(this.end)){this.finish(null);break;}const entry=this.pop(),current=entry.index;if(this.closed.has(current)||entry.cost!==this.cost.get(current))continue;this.expanded++;
  if(current===this.end){const route=[];for(let i=current;i!==undefined;i=this.parent.get(i))route.push(this.point(i));this.finish(route.reverse());break;}this.closed.add(current);const x=current%this.cols,y=Math.floor(current/this.cols);
  for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=this.cols||ny>=this.rows)continue;const next=ny*this.cols+nx;if(this.closed.has(next)||this.solid(next))continue;const cost=entry.cost+1;if(cost<(this.cost.get(next)??Infinity)){this.cost.set(next,cost);this.parent.set(next,current);this.push(next,cost);}}
 }return this.done;}
 finish(path){this.done=true;this.result={path,expanded:this.expanded,cellSize:this.cellSize};}
 snapshot(){return {version:1,request:structuredClone(this.request),expanded:this.expanded,done:this.done,result:structuredClone(this.result),open:structuredClone(this.open),serial:this.serial,cost:[...this.cost],parent:[...this.parent],closed:[...this.closed],blocked:[...this.blocked],shapes:structuredClone(this.shapes)};}
 static restore(document,s){if(s?.version!==1)throw Error('Unsupported navigation checkpoint.');const job=new PathJob(document,s.request);for(const key of['expanded','done','result','open','serial','shapes'])job[key]=structuredClone(s[key]);job.cost=new Map(s.cost);job.parent=new Map(s.parent);job.closed=new Set(s.closed);job.blocked=new Map(s.blocked);return job;}
}

/** Find a conservative free approach cell near a blocked target, within a
 * bounded radius. The caller still checks actual hand contact before pickup. */
export function approachPoint(document,request,maxRings=12){const job=new PathJob(document,request);if(!job.solid(job.end))return {...request.end};const x=job.end%job.cols,y=Math.floor(job.end/job.cols);for(let r=1;r<=Math.min(12,maxRings);r++){const candidates=[];for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r||x+dx<0||y+dy<0||x+dx>=job.cols||y+dy>=job.rows)continue;const i=(y+dy)*job.cols+x+dx;if(!job.solid(i))candidates.push(job.point(i));}if(candidates.length)return candidates.sort((a,b)=>Math.hypot(a.x-request.end.x,a.y-request.end.y)-Math.hypot(b.x-request.end.x,b.y-request.end.y))[0];}return null;}
