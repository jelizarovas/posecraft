import type {SceneDocument} from './schema.js';
export interface SceneFeatureInspection {runtime:'illustration'|'physics';features:string[];reasons:string[]}
export interface SceneExportManifest {format:'posecraft-website';version:1;scene:string;runtime:'illustration'|'physics';features:string[];runtimeURL:string;runtimeManifestURL:string;documentEmbedded:true;dependencies:string[];notes:string[]}
export function inspectSceneFeatures(document:SceneDocument):SceneFeatureInspection;
export function createSceneExport(document:SceneDocument,options?:{runtimeBase?:string;local?:boolean;label?:string;autoplay?:boolean}):{html:string;manifest:SceneExportManifest};
