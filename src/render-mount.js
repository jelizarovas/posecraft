import {mountSVG} from './svg.js';
import {mountCanvas} from './canvas.js';
/** Explicit backend selection. Unsupported Canvas features throw rather than disappear. */
export function mountRenderer(element,document,frame,options={}){return document.renderer==='canvas'?mountCanvas(element,document,frame,options):mountSVG(element,document,frame,options);}
