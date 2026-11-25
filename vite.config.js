import {build,defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {studioPWA} from './studio/pwa-plugin.js';

const spriteEmbed={
 name:'standalone-sprite-player',
 resolveId(id){if(id==='virtual:posecraft-sprite-embed')return '\0'+id;},
 async load(id){
   if(id!=='\0virtual:posecraft-sprite-embed')return;
   const entry=fileURLToPath(new URL('./studio/sprite-embed.js',import.meta.url));
   const result=await build({configFile:false,publicDir:false,logLevel:'error',build:{write:false,
     lib:{entry,name:'PosecraftSpritePlayer',formats:['iife']},minify:true}});
   const chunk=[result].flat().flatMap(file=>file.output).find(file=>file.type==='chunk');
   for(const file of Object.keys(chunk.modules))this.addWatchFile(file);
   return 'export default '+JSON.stringify(chunk.code);
 }
};

const studio={studio:'index.html',draw:'draw.html',puppet:'puppet.html',director:'director.html'};
const demos={demos:'demos.html',wwwzard:'wwwzard.html',wwzard:'wwzard.html',originalWwwzard:'wwwzard-legacy.html',react:'react-demo.html',gameDemo:'game-demo.html',play:'play.html',atlas3d:'atlas-3d.html',mapEditor:'map-editor.html',nativeStudio:'native-studio.html'};
export default defineConfig(({mode})=>({
 base:'./',
 publicDir:mode==='studio'?false:'public',
 plugins:mode==='demos'?[spriteEmbed,{name:'demo-studio-links',transformIndexHtml:html=>html.replaceAll('href="./?demo=','href="../studio/?demo=').replaceAll('href="./"','href="../studio/"')} ]:[spriteEmbed,studioPWA()],
 build:{outDir:mode==='studio'?'dist/studio':mode==='demos'?'dist/demos':'dist',rollupOptions:{input:mode==='studio'?studio:mode==='demos'?demos:{...studio,...demos,mapEditor:'map-editor.html',nativeStudio:'native-studio.html'}}},
 server:{host:'127.0.0.1'},
}));
