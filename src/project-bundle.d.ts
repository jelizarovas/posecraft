import type {Episode} from './episode.js';
export const projectBundleLimits:Readonly<{fileBytes:number;assetBytes:number;totalAssetBytes:number;assets:number;dimension:number;pixels:number}>;
export interface ProjectAsset {id:string;type:'image/png'|'image/jpeg'|'image/webp';bytes:number;sha256:string;data:string}
export interface ProjectBundle {kind:'posecraft-project';schemaVersion:1;project:Episode;assets:ProjectAsset[]}
export interface BundleOptions {validateImage?:(blob:Blob)=>void|Promise<void>}
export function inspectRaster(bytes:Uint8Array,type:string):{width:number;height:number};
export function createProjectBundle(project:Episode,loadReference:(id:string)=>Promise<Blob|undefined>,options?:BundleOptions):Promise<ProjectBundle>;
export function readProjectBundle(value:unknown,options?:BundleOptions):Promise<{project:Episode;assets:Map<string,Blob>}>;
