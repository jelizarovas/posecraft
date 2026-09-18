import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
import type {CanvasOptions,MountedCanvas} from './canvas.js';
export function mountRenderer(element:Element,document:SceneDocument,frame:Frame,options?:CanvasOptions):MountedCanvas|{update(frame:Frame):void;dispose():void};
