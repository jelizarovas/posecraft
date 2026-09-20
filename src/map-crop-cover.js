/** World-anchored stalk tips, so crop cover does not shimmer when the camera pans.
 * Artwork alpha still supplies the gaps between leaves below this height limit. */
export function traceMapCropCover(ctx,bounds,cut,scale){
 const step=1.25*scale,start=Math.floor(bounds.x/step),end=Math.ceil((bounds.x+bounds.width)/step);
 ctx.beginPath();
 for(let i=start;i<=end;i++){
  const hash=(Math.imul(i,374761393)^(i>>>3))>>>0;
  const y=cut+(hash%101)/100*5*scale;
  if(i===start)ctx.moveTo(i*step,y);else ctx.lineTo(i*step,y);
 }
 ctx.lineTo(end*step,bounds.y+bounds.height);ctx.lineTo(start*step,bounds.y+bounds.height);ctx.closePath();
}
