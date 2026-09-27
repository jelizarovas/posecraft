import { defineConfig } from 'vite';
import {studioPWA} from './studio/pwa-plugin.js';

const studio={studio:'index.html',draw:'draw.html',director:'director.html'};
const demos={demos:'demos.html',wwwzard:'wwwzard.html',wwzard:'wwzard.html',originalWwwzard:'wwwzard-legacy.html',react:'react-demo.html',gameDemo:'game-demo.html',play:'play.html',atlas3d:'atlas-3d.html',mapEditor:'map-editor.html',nativeStudio:'native-studio.html'};
export default defineConfig(({mode})=>({
 base:'./',
 publicDir:mode==='studio'?false:'public',
 plugins:mode==='demos'?[{name:'demo-studio-links',transformIndexHtml:html=>html.replaceAll('href="./?demo=','href="../studio/?demo=').replaceAll('href="./"','href="../studio/"')}]:[studioPWA()],
 build:{outDir:mode==='studio'?'dist/studio':mode==='demos'?'dist/demos':'dist',rollupOptions:{input:mode==='studio'?studio:mode==='demos'?demos:{...studio,...demos,mapEditor:'map-editor.html',nativeStudio:'native-studio.html'}}},
 server:{host:'127.0.0.1'},
}));
