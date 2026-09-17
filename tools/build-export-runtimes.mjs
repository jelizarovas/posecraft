import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
/** Build stable entry names and record the actual module graph, including workers. */
export async function buildRuntimeFiles({entries,outDir,plugins=[]}){
  const result=await build({configFile:false,root:projectRoot,base:'./',logLevel:'error',plugins,build:{write:false,emptyOutDir:false,minify:true,target:'es2022',modulePreload:false,rollupOptions:{input:entries,preserveEntrySignatures:'strict',output:{entryFileNames:'[name].js',chunkFileNames:'chunks/[name]-[hash].js',assetFileNames:'assets/[name]-[hash][extname]'}}}});
  const output=(Array.isArray(result)?result:[result]).flatMap(result=>result.output),files=[];
  await fs.mkdir(outDir,{recursive:true});const root=path.resolve(outDir);
  for(const file of output){const destination=path.resolve(root,file.fileName);if(!destination.startsWith(root+path.sep))throw new Error('Compiler produced an unsafe output path.');await fs.mkdir(path.dirname(destination),{recursive:true});const content=file.type==='chunk'?file.code:file.source;await fs.writeFile(destination,content);files.push({file:file.fileName,bytes:Buffer.byteLength(content),imports:file.imports||[],dynamicImports:file.dynamicImports||[],modules:file.type==='chunk'?Object.keys(file.modules).map(id=>id.replaceAll('\\','/').replace(projectRoot.replaceAll('\\','/'),'')):[]});}
  return files;
}
export async function buildExportRuntimes(outDir=path.join(projectRoot,'dist/runtime')){
  const files=await buildRuntimeFiles({entries:{illustration:path.join(projectRoot,'src/illustration-entry.js'),physics:path.join(projectRoot,'src/export-physics.js')},outDir});
  const manifest={format:'posecraft-runtime',version:1,entries:{illustration:'illustration.js',physics:'physics.js'},files};await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const manifest=await buildExportRuntimes();console.log(JSON.stringify({runtimeFiles:manifest.files.length,bytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0)}));}catch(error){console.error(error.message);process.exitCode=1;}
