import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSceneExport,inspectSceneFeatures} from '../src/scene-export.js';
import {buildRuntimeFiles,projectRoot} from './build-export-runtimes.mjs';

/** Emit a self-contained website directory with only the selected feature graph. */
export async function compileScene(document,outDir){
  const exported=createSceneExport(document,{local:true}),inspection=inspectSceneFeatures(document),root=path.resolve(outDir);
  try{if((await fs.readdir(root)).length)throw new Error('Choose an empty output directory; compilation never overwrites an existing website.');}catch(error){if(error.code!=='ENOENT')throw error;}
  const virtual='posecraft:compiled-illustration',moduleURL=name=>JSON.stringify(path.join(projectRoot,'src',name).replaceAll('\\','/'));
  const imports=[`import {mountIllustration} from ${moduleURL('illustration.js')};`],providers=[];
  for(const [feature,name,symbol,key] of [['bottle-fluid','bottle-fluid.js','BottleFluid','fluidFactory'],['bottle-fluid','bottle-browser.js','mountBottleControls','mountBottleControls'],['ensemble','ensemble.js','CampfireEnsemble','ensembleFactory'],['contacts','contacts.js','applyContacts','contactSolver'],['behaviors','behaviors.js','BehaviorRuntime','behaviorFactory'],['pointer-interactions','pointer-interactions.js','ScenePointerInteraction','pointerFactory'],['pointer-interactions','pointer-browser.js','mountScenePointers','mountPointers']])if(inspection.features.includes(feature)){imports.push(`import {${symbol}} from ${moduleURL(name)};`);providers.push(`${key}:${symbol}`);}
  const source=imports.join('\n')+`\nexport function mountExport(element,document,options={}){return mountIllustration(element,document,{${providers.length?providers.join(',')+',':''}...options});}`;
  const entries={[inspection.runtime]:inspection.runtime==='physics'?path.join(projectRoot,'src/export-physics.js'):virtual};
  const files=await buildRuntimeFiles({entries,outDir:path.join(root,'runtime'),plugins:[{name:'posecraft-compiled-scene',resolveId:id=>id===virtual?'\0'+virtual:null,load:id=>id==='\0'+virtual?source:null}]});
  const manifest={...exported.manifest,runtimeManifestURL:'./manifest.json',dependencies:files.map(file=>'./runtime/'+file.file),files};
  await fs.writeFile(path.join(root,'index.html'),exported.html);await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node tools/compile-scene.mjs scene.json empty-output-directory');if((await fs.stat(input)).size>5000000)throw new Error('Expected a scene JSON file under 5 MB.');const manifest=await compileScene(JSON.parse(await fs.readFile(input,'utf8')),output);console.log(JSON.stringify({output:path.resolve(output),runtime:manifest.runtime,features:manifest.features,bytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0)}));}catch(error){console.error(error.message);process.exitCode=1;}
