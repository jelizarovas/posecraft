import {SceneDocument} from './schema.js';
import {Frame} from './scene.js';
export interface SVGOptions {label?:string;bones?:boolean;limits?:boolean;selectedActor?:string;selectedJoint?:string}
export function renderSVG(document:SceneDocument,frame:Frame,options?:SVGOptions):string;
export function mountSVG(element:Element,document:SceneDocument,frame:Frame,options?:SVGOptions):{update(frame:Frame):void;dispose():void};
