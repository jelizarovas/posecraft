import {SceneDocument} from './schema.js';
import {Frame} from './scene.js';
export function renderSVG(document:SceneDocument,frame:Frame,options?:{label?:string;bones?:boolean}):string;
export function mountSVG(element:Element,document:SceneDocument,frame:Frame,options?:{label?:string;bones?:boolean}):{update(frame:Frame):void;dispose():void};
