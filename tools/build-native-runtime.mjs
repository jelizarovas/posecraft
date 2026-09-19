import {build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function buildNativeRuntime(outDir='dist/runtime'){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const result=await build({root,configFile:false,logLevel:'error',build:{write:false,minify:true,target:'es2022',lib:{entry:path.join(root,'src/native-three-player.js'),name:'PosecraftNative',formats:['iife'],fileName:()=> 'native-three-player.js'}}});
  const output=(Array.isArray(result)?result:[result]).flatMap(r=>r.output),bundle=output.find(o=>o.type==='chunk');
  if(!bundle)throw new Error('Native player bundle is missing.');
  await fs.mkdir(outDir,{recursive:true});await fs.writeFile(path.join(outDir,'native-three-player.js'),bundle.code);
  const modules=Object.keys(bundle.modules).map(id=>id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),''));
  const manifest={format:'posecraft-native-player',version:1,bytes:Buffer.byteLength(bundle.code),features:['gltf-skinning','native-3d-rig','two-bone-contacts','bench-action','workout-director','pullup-action','ground-locomotion','game-commands'],modules};
  if(modules.some(id=>/node_modules\/planck|src\/physics\.js|examples\/gym\.js/.test(id)))throw new Error('Native player accidentally included the legacy demo or physics engine.');
  await fs.writeFile(path.join(outDir,'native-three-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const manifest=await buildNativeRuntime(process.argv[2]);console.log(JSON.stringify({nativeRuntimeBytes:manifest.bytes}));}
