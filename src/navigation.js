// Incremental four-neighbor A*. Positions are scene pixels; props are inflated
// by the requested clearance. This plans routes, not footsteps or locomotion.
export class PathJob {
 constructor(document,{start,end,cellSize=20,clearance=10}={}){
  if(![start?.x,start?.y,end?.x,end?.y,cellSize,clearance].every(Number.isFinite)||cellSize<8||clearance<0||clearance>500)throw new Error('Invalid path request.');
  this.cols=Math.ceil(document.bounds.width/cellSize);this.rows=Math.ceil(document.bounds.height/cellSize);
  if(this.cols*this.rows>16384)throw new Error('Path grid exceeds 16384 cells. Increase cell size.');
  this.cellSize=cellSize;this.document=document;this.clearance=clearance;this.expanded=0;this.done=false;this.result=null;
  for(const p of [start,end])if(p.x<0||p.y<0||p.x>=document.bounds.width||p.y>=document.bounds.height)throw new Error('Path endpoints must be inside scene bounds.');
  this.start=this.index(start);this.end=this.index(end);this.open=[this.start];this.cost=new Map([[this.start,0]]);this.parent=new Map();this.closed=new Set();this.blocked=new Map();
 }
 index(p){return Math.floor(p.y/this.cellSize)*this.cols+Math.floor(p.x/this.cellSize);}
 point(i){return {x:Math.min((i%this.cols+.5)*this.cellSize,this.document.bounds.width-.01),y:Math.min((Math.floor(i/this.cols)+.5)*this.cellSize,this.document.bounds.height-.01)};}
 solid(i){
  if(this.blocked.has(i))return this.blocked.get(i);const p=this.point(i),margin=this.clearance+this.cellSize*Math.SQRT2/2;
  const solid=p.x<this.clearance||p.y<this.clearance||p.x>this.document.bounds.width-this.clearance||p.y>this.document.bounds.height-this.clearance||(this.document.props||[]).some(prop=>{const c=prop.collider;if(!c.enabled)return false;const a=-prop.rotation*Math.PI/180,dx=p.x-prop.x,dy=p.y-prop.y,x=dx*Math.cos(a)-dy*Math.sin(a)-c.x,y=dx*Math.sin(a)+dy*Math.cos(a)-c.y;return Math.abs(x)<=c.width/2+margin&&Math.abs(y)<=c.height/2+margin;});
  this.blocked.set(i,solid);return solid;
 }
 heuristic(i){return Math.abs(i%this.cols-this.end%this.cols)+Math.abs(Math.floor(i/this.cols)-Math.floor(this.end/this.cols));}
 step(maxNodes=64){
  for(let count=0;count<maxNodes&&!this.done;count++){
   if(!this.open.length||this.solid(this.start)||this.solid(this.end)){this.finish(null);break;}
   let best=0;for(let j=1;j<this.open.length;j++)if(this.cost.get(this.open[j])+this.heuristic(this.open[j])<this.cost.get(this.open[best])+this.heuristic(this.open[best]))best=j;
   const current=this.open.splice(best,1)[0];this.expanded++;
   if(current===this.end){const route=[];for(let i=current;i!==undefined;i=this.parent.get(i))route.push(this.point(i));this.finish(route.reverse());break;}
   this.closed.add(current);const x=current%this.cols,y=Math.floor(current/this.cols);
   for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    if(nx<0||ny<0||nx>=this.cols||ny>=this.rows)continue;const next=ny*this.cols+nx;
    if(this.closed.has(next)||this.solid(next))continue;const cost=this.cost.get(current)+1;
    if(cost<(this.cost.get(next)??Infinity)){if(!this.cost.has(next))this.open.push(next);this.cost.set(next,cost);this.parent.set(next,current);}
   }
  }return this.done;
 }
 finish(path){this.done=true;this.result={path,expanded:this.expanded,cellSize:this.cellSize};}
}
