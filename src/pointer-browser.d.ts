import {SceneDocument,PointerCommand} from './schema.js';
import {Frame} from './scene.js';
export function mountScenePointers(element:HTMLElement,document:SceneDocument,controller:{frame():Frame;pointer(command:PointerCommand):unknown},options?:{isEnabled?:()=>boolean;onInteract?:()=>void;onUpdate?:()=>void}):{dispose():void};
