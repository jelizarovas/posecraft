import {build,defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

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

export default defineConfig({ base: './', plugins: [spriteEmbed], build: { rollupOptions: { input: { studio: 'index.html', mapEditor: 'map-editor.html', nativeStudio: 'native-studio.html', gameDemo: 'game-demo.html', play: 'play.html', draw: 'draw.html', puppet: 'puppet.html', demos: 'demos.html', atlas3d: 'atlas-3d.html', director: 'director.html', react: 'react-demo.html', wwwzard: 'wwwzard.html' } } }, server: { host: '127.0.0.1' } });
