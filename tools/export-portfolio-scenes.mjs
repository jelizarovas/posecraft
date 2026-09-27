import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {assertDocument} from '@posecraft/runtime';
import {createWwwzardStoriesScene} from '../examples/wwwzard-stories.js';
import {createWwwzardProjectsScene} from '../examples/wwwzard-projects.js';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.resolve(process.argv[2]||path.join(root,'releases'));
await fs.mkdir(destination,{recursive:true});
for(const [name,create] of Object.entries({stories:createWwwzardStoriesScene,projects:createWwwzardProjectsScene,contact:createWwwzardContactScene})){
  const scene=assertDocument(create()),json=JSON.stringify(scene)+'\n',gzipBytes=gzipSync(json).byteLength;
  if(gzipBytes>30*1024)throw Error(`${name} scene exceeds its 30 KiB gzip budget: ${gzipBytes}`);
  const file=path.join(destination,`wwwzard-${name}.scene.json`);
  await fs.writeFile(file,json);
  console.log(JSON.stringify({scene:name,file,bytes:Buffer.byteLength(json),gzipBytes}));
}
