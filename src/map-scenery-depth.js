const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

function footprint(entry){
 const points=entry.part&&(entry.part.nodes.length?entry.part.nodes:entry.part.posts);
 if(points){
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
 }
 return entry.prop;
}

function fenceBehindCrop(fence,crop){
 const points=fence.part.nodes.length?fence.part.nodes:fence.part.posts;
 const [a,b]=points,cx=crop.x+crop.width/2,cy=crop.y+crop.height/2;
 if(b&&Math.abs(a.y-b.y)<1e-7)return a.y<cy;
 if(b&&Math.abs(a.x-b.x)<1e-7)return a.x<cx;
 return a.x+a.y<cx+cy;
}

/** Static painter dependencies for overlapping art, using separation on either
 * ground axis. A large building's front corner must not cover a tree beside it.
 * Build once per map, with projected buckets to avoid all-pairs comparisons. */
export function orderMapScenery(entries){
 const ordered=[...entries].sort((a,b)=>a.depth-b.depth||a.order-b.order);
 const ground=ordered.map(footprint),edges=ordered.map(()=>[]),incoming=new Uint32Array(ordered.length),buckets=new Map();
 for(let i=0;i<ordered.length;i++){
  const entry=ordered[i];if(entry.draw===false)continue;
  const b=entry.bounds,candidates=new Set();
  for(let y=Math.floor(b.y/128);y<=Math.floor((b.y+b.height)/128);y++)for(let x=Math.floor(b.x/128);x<=Math.floor((b.x+b.width)/128);x++){
   const key=`${x}:${y}`,bucket=buckets.get(key)||[];
   for(const j of bucket)candidates.add(j);bucket.push(i);buckets.set(key,bucket);
  }
  for(const j of candidates){
   if(entry.prop===ordered[j].prop||!overlaps(b,ordered[j].bounds))continue;
   const a=ground[j],c=ground[i];
   let before=a.x+a.width<=c.x+1e-7||a.y+a.height<=c.y+1e-7;
   let after=c.x+c.width<=a.x+1e-7||c.y+c.height<=a.y+1e-7;
   // A canopy extends sideways from its trunk. Use the building's near
   // edges, as for actor occlusion, rather than its distant front corner.
   if(a.kind==='house'&&c.kind==='tree'){
    before=c.x+c.width/2>=a.x+a.width||c.y+c.height/2>=a.y+a.height;after=!before;
   }else if(a.kind==='tree'&&c.kind==='house'){
    after=a.x+a.width/2>=c.x+c.width||a.y+a.height/2>=c.y+c.height;before=!after;
   }
   // Crop tiles include soil around the stalk roots. A fence may be built
   // inside that tile: compare the local rail axis with the plant roots,
   // instead of treating the entire crop tile as a solid foreground box.
   if(ordered[j].part&&entry.prop.occlusion?.mode==='low-foliage'){
    before=fenceBehindCrop(ordered[j],entry.prop);after=!before;
   }else if(entry.part&&ordered[j].prop.occlusion?.mode==='low-foliage'){
    after=fenceBehindCrop(entry,ordered[j].prop);before=!after;
   }
   // Opposite-axis separation is ambiguous; retain the depth tie-breaker.
   if(before===after)continue;
   const from=before?j:i,to=before?i:j;edges[from].push(to);incoming[to]++;
  }
 }
 // Min heap keeps the original depth order wherever dependencies permit it.
 const ready=[],done=new Uint8Array(ordered.length),result=[];
 const push=value=>{let i=ready.length;ready.push(value);while(i){const p=(i-1)>>1;if(ready[p]<=value)break;ready[i]=ready[p];i=p;}ready[i]=value;};
 const pop=()=>{const value=ready[0],last=ready.pop();if(ready.length){let i=0;while(i*2+1<ready.length){let c=i*2+1;if(c+1<ready.length&&ready[c+1]<ready[c])c++;if(ready[c]>=last)break;ready[i]=ready[c];i=c;}ready[i]=last;}return value;};
 for(let i=0;i<ordered.length;i++)if(!incoming[i])push(i);
 let cursor=0;
 while(result.length<ordered.length){
  // Interpenetrating artwork can have cyclic dependencies. Break those in
  // stable depth order rather than dropping props or looping indefinitely.
  if(!ready.length){while(done[cursor])cursor++;push(cursor);}
  const i=pop();if(done[i])continue;done[i]=1;result.push(ordered[i]);
  for(const next of edges[i])if(--incoming[next]===0&&!done[next])push(next);
 }
 return result;
}
