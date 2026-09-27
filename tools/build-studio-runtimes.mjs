import {buildExportRuntimes} from './build-export-runtimes.mjs';
import {fileURLToPath} from 'node:url';
const result=await buildExportRuntimes(fileURLToPath(new URL('../dist/studio/runtime/',import.meta.url)));
console.log(JSON.stringify({studioExportRuntimeFiles:result.files.length}));
