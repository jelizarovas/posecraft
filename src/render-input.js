const surfaces=new WeakMap();
export function registerRenderInput(surface,adapter){surfaces.set(surface,adapter);return ()=>surfaces.delete(surface);}
function adapter(element,event){return surfaces.get(event.target)||surfaces.get(element)||surfaces.get(element.querySelector?.('canvas[data-posecraft-renderer]'));}
export function rendererPoint(element,event){const input=adapter(element,event);if(input)return input.point(event.clientX,event.clientY);const svg=element.matches?.('svg')?element:element.querySelector('svg'),matrix=svg?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}
export function rendererHit(element,event){return adapter(element,event)?.hit(event.clientX,event.clientY)||null;}
