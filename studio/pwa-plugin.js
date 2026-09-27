import {createHash} from 'node:crypto';
import path from 'node:path';
import {readFileSync} from 'node:fs';

/** Precache only Studio's dependency graph; demos and public art are separate. */
export function studioPWA(){return {name:'posecraft-studio-pwa',apply:'build',generateBundle(_options,bundle){
 const files=new Set(['index.html','studio.webmanifest','studio-icon.svg','studio-icon-192.png','studio-icon-512.png']);
 const publicFiles={};for(const file of [...files].filter(file=>file!=='index.html')){const source=readFileSync(new URL('../public/'+file,import.meta.url));publicFiles[file]=source;this.emitFile({type:'asset',fileName:file,source});}
 const visit=name=>{if(files.has(name))return;files.add(name);const chunk=bundle[name];if(chunk?.type==='chunk'){for(const child of [...chunk.imports,...chunk.dynamicImports,...(chunk.viteMetadata?.importedCss||[]),...(chunk.viteMetadata?.importedAssets||[])])visit(child);for(const asset of Object.keys(bundle))if(bundle[asset].type==='asset'&&chunk.code.includes(path.posix.basename(asset)))visit(asset);}else if(name.endsWith('.css')){for(const match of String(chunk?.source||'').matchAll(/url\(["']?([^\s)'"?]+)[^)]*\)/g)){const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));if(bundle[target])visit(target);}}};
 for(const [name,chunk] of Object.entries(bundle))if(chunk.type==='chunk'&&chunk.facadeModuleId?.replaceAll('\\','/').endsWith('/studio/main.js'))visit(name);
 // Vite can identify an HTML facade as the entry rather than main.js.
 for(const [name,chunk] of Object.entries(bundle))if(chunk.type==='chunk'&&chunk.facadeModuleId?.replaceAll('\\','/').endsWith('/index.html'))visit(name);
 const urls=[...files].sort(),version=createHash('sha256').update(urls.map(name=>name+(bundle[name]?.source||bundle[name]?.code||publicFiles[name]||'')).join('\n')).digest('hex').slice(0,16);
 this.emitFile({type:'asset',fileName:'studio-sw.js',source:`const BASE=new URL('./',self.location.href);
const PREFIX='posecraft-studio-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+'${version}';
const FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new URL(path,BASE).href)))));
// No skipWaiting: an update must never reload an editor with unsaved work.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin)return;
const relative=url.pathname.slice(BASE.pathname.length);
if(!url.pathname.startsWith(BASE.pathname))return;
if(event.request.mode==='navigate'&&(relative===''||relative==='index.html')){event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL('index.html',BASE).href)).then(hit=>hit||fetch(event.request)));return;}
if(FILES.includes(relative))event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL(relative,BASE).href)).then(hit=>hit||fetch(event.request)));
});`});
}};}
