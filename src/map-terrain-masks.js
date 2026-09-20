const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};

/** Transition alpha depends on neighbor membership, not the texture's world phase. */
export function createMapTerrainMasks(doc,limit=32){
  const cache=new Map();let builds=0;
  return{
    get(size,membership){
      const key=size+':'+membership;
      if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
      const canvas=doc.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true}),alpha=ctx.createImageData(size,size);
      const offsets=new Int8Array(size),weights=new Float64Array(size);
      for(let i=0;i<size;i++){const g=(i+.5)/size-.5,cell=Math.floor(g);offsets[i]=cell;weights[i]=smooth((g-cell-.30)/.40);}
      const bits=Array.from({length:9},(_,i)=>(membership>>i)&1);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const index=(offsets[y]+1)*3+offsets[x]+1,sx=weights[x],sy=weights[y];
        const a=(bits[index]*(1-sx)+bits[index+1]*sx)*(1-sy)+(bits[index+3]*(1-sx)+bits[index+4]*sx)*sy;
        alpha.data[(y*size+x)*4+3]=Math.round(a*255);
      }
      ctx.putImageData(alpha,0,0);cache.set(key,canvas);builds++;
      while(cache.size>limit){const oldest=cache.keys().next().value,entry=cache.get(oldest);entry.width=entry.height=1;cache.delete(oldest);}
      return canvas;
    },
    clear(){for(const canvas of cache.values())canvas.width=canvas.height=1;cache.clear();},
    stats(){return{masks:cache.size,maskBuilds:builds};}
  };
}
