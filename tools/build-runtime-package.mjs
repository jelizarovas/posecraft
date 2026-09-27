import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const packageRoot=path.join(root,'packages/runtime');
export async function buildRuntimePackage(){
  const dist=path.join(packageRoot,'dist');
  const result=await build({configFile:false,root,logLevel:'error',build:{
    outDir:dist,emptyOutDir:true,copyPublicDir:false,target:'es2022',minify:true,
    lib:{entry:Object.fromEntries(['index','react','animation'].map(name=>[name,path.join(packageRoot,`src/${name}.js`)])),formats:['es']},
    rollupOptions:{external:['react'],output:{entryFileNames:'[name].js',chunkFileNames:'chunks/[name]-[hash].js',minify:{compress:true,mangle:true,codegen:{removeWhitespace:true}},comments:{annotation:true,legal:true}}},
  }});
  // Providers and their validators live in shared source modules. A separate optional
  // build lets the root drop provider exports instead of retaining them in a shared chunk.
  const optional=await build({configFile:false,root,logLevel:'error',build:{
    outDir:dist,emptyOutDir:false,copyPublicDir:false,target:'es2022',minify:true,
    lib:{entry:path.join(packageRoot,'src/features.js'),formats:['es'],fileName:()=> 'features.js'},
    rollupOptions:{output:{minify:{compress:true,mangle:true,codegen:{removeWhitespace:true}},comments:{annotation:true,legal:true}}},
  }});
  const output=[result,optional].flatMap(item=>Array.isArray(item)?item:[item]).flatMap(item=>item.output);
  const modules=output.filter(item=>item.type==='chunk').flatMap(item=>Object.keys(item.modules));
  const forbidden=modules.filter(id=>/(?:\/|\\)(?:node_modules(?:\/|\\)(?:planck|three)|src(?:\/|\\)(?:physics|scene-3d|rig-3d|map-))/.test(id));
  if(forbidden.length)throw new Error(`Unexpected heavyweight runtime modules: ${forbidden.join(', ')}`);
  for(const entry of ['index','react','animation','features'])await fs.copyFile(path.join(packageRoot,`src/${entry}.d.ts`),path.join(dist,`${entry}.d.ts`));

  // Follow declaration references so a consumer needs no repository paths or dev dependencies.
  const copied=new Set();
  async function copyType(name){
    if(copied.has(name))return;copied.add(name);
    if(!/^[\w-]+\.d\.ts$/.test(name))throw Error(`Unsafe declaration path: ${name}`);
    const source=await fs.readFile(path.join(root,'src',name),'utf8');
    await fs.mkdir(path.join(dist,'types'),{recursive:true});
    await fs.writeFile(path.join(dist,'types',name),source);
    for(const match of source.matchAll(/(?:from\s*|import\()['"]\.\/([^'"]+)['"]/g))await copyType(match[1].replace(/\.js$/,'.d.ts'));
  }
  const declaration=await fs.readFile(path.join(packageRoot,'src/index.d.ts'),'utf8');
  for(const match of declaration.matchAll(/['"]\.\/types\/([^'"]+)['"]/g))await copyType(match[1].replace(/\.js$/,'.d.ts'));
  await copyType('index.d.ts');
  await fs.copyFile(path.join(root,'LICENSE'),path.join(packageRoot,'LICENSE'));
  const report={format:'posecraft-runtime-package',version:1,modules:modules.map(id=>path.relative(root,id).replaceAll('\\','/')),files:output.map(item=>({file:item.fileName,bytes:Buffer.byteLength(item.type==='chunk'?item.code:item.source),imports:item.imports||[]})),declarations:copied.size};
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  await fs.writeFile(path.join(root,'test-results/runtime-package-build.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await buildRuntimePackage();console.log(JSON.stringify({files:report.files,declarations:report.declarations}));
}
