import type {SceneDocument,CharacterPack} from './schema.js';
export function createDrawing():SceneDocument;
export function shapePath(kind:'rectangle'|'ellipse'|'triangle',x?:number,y?:number,width?:number,height?:number):string;
export function importSVG(source:string,Parser?:typeof DOMParser):SceneDocument;
export function multiply(a:number[],b:number[]):number[];
export function matrixText(matrix:number[]):string;
export function parseTransform(text?:string):number[];
export function jointMatrices(pack:CharacterPack):Record<string,number[]>;
export function assignArtwork(pack:CharacterPack,partId:string,jointId:string):CharacterPack;
export function movePivot(pack:CharacterPack,jointId:string,x:number,y:number):CharacterPack;
export function reparentJoint(pack:CharacterPack,jointId:string,parent:string|null):CharacterPack;

export function validatePath(path:string):string;
