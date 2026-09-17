import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { rollupOptions: { input: { studio: 'index.html', draw: 'draw.html', demos: 'demos.html', director: 'director.html', react: 'react-demo.html', wwwzard: 'wwwzard.html' } } }, server: { host: '127.0.0.1' } });
