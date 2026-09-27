import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWwwzardHomeScene as createWwzardIllustration} from '../examples/wwwzard-home.js';
import {assertDocument} from '../src/schema.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.resolve(process.argv[2]||path.join(root,'releases/wwwzard.scene.json'));
const scene=assertDocument(createWwzardIllustration());
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.writeFile(destination,JSON.stringify(scene)+'\n');
console.log(JSON.stringify({scene:destination,bytes:Buffer.byteLength(JSON.stringify(scene)),name:scene.name}));
