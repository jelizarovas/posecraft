export interface MeshWeight { joint:string; x:number; y:number; z?:number; weight:number }
export interface MeshCorrective { joint:string; channel:'rotation'|'yaw'|'pitch'|'bend'; min:number; max:number; offsets:Array<{vertex:number;x?:number;y?:number;z?:number}> }
export interface SkinnedMesh { vertices:Array<{weights:MeshWeight[]}>; triangles:Array<[number,number,number]>; correctives?:MeshCorrective[]; creaseAngle?:number }
export interface MeshVertex { x:number;y:number;z:number;depth:number }
export interface MeshFace { index:number;indices:[number,number,number];d:string;depth:number;frontFacing:boolean;facing:number;visible:boolean;normal:{x:number;y:number;z:number} }
export interface MeshEdge { id:string;indices:[number,number];faces:number[];kind:'internal'|'boundary'|'silhouette'|'crease';visible:boolean;d:string;depth:number }
export interface EvaluatedMesh { vertices:MeshVertex[];faces:MeshFace[];edges:MeshEdge[];silhouettePath:string;boundaryPath:string;creasePath:string;bounds:{minX:number;minY:number;minZ:number;maxX:number;maxY:number;maxZ:number} }
export function evaluateSkinnedMesh(mesh:SkinnedMesh,world:Record<string,{x:number;y:number;z?:number;layerDepth?:number;m?:number[]}>,pose?:Record<string,number>):EvaluatedMesh;
