import {spritePlayer} from './sprite-player.js';
const canvas=document.querySelector('canvas');
spritePlayer(canvas,JSON.parse(document.getElementById('puppet').textContent));
