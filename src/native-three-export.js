const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}

/** One file containing the same action, renderer, document and selected GLB. */
export async function exportNativeBenchHTML(project,{runtimeURL='./runtime/native-three-player.js',assetURL}={}){
  const {assertBenchProject3D}=await import('./bench-project-3d.js');
  const data=structuredClone(assertBenchProject3D(project));
  const asset=assetURL||`./assets/native-3d/${data.character.asset}.glb`;
  const responses=await Promise.all([fetch(runtimeURL),fetch(asset)]);
  for(const response of responses)if(!response.ok)throw new Error(`Export could not load ${response.url}: ${response.status}. Use the built Studio preview.`);
  const runtime=await responses[0].text(),bytes=new Uint8Array(await responses[1].arrayBuffer());
  if(!runtime.includes('PosecraftNative'))throw new Error('The native player bundle is missing. Build the studio before exporting.');
  if(bytes.length<12||new DataView(bytes.buffer).getUint32(0,true)!==0x46546c67)throw new Error('The selected character is not a binary glTF asset.');
  const uri='data:model/gltf-binary;base64,'+base64(bytes);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(data.name)}</title><style>html,body{margin:0;background:#e8eceb;font:14px system-ui;color:#20373c}main{width:100vw;height:100dvh;min-height:320px}canvas{display:block;width:100%;height:100%;touch-action:none}#error{position:absolute;top:1rem;left:1rem;color:#862b32}button{position:absolute;bottom:20px;left:20px;border:1px solid #b9c6c4;border-radius:30px;padding:10px 20px;background:#fff;color:#20373c;cursor:pointer}</style></head><body><main id="scene" aria-label="${escapeHTML(data.name)}"></main><p id="error" role="alert"></p><script id="project" type="application/json">${safeJSON(data)}</script><script>${runtime.replace(/<\/script/gi,'<\\/script')}</script><script>PosecraftNative.mountNativeBenchPlayer(document.getElementById('scene'),JSON.parse(document.getElementById('project').textContent),{assetUrl:${safeJSON(uri)}}).then(player=>{window.posecraft=player;addEventListener('pagehide',()=>player.dispose(),{once:true});}).catch(error=>{document.getElementById('error').textContent=error.message;});</script></body></html>`;
}
