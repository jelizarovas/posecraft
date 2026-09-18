export interface BenchProject3D {kind:'bench-study3d';version:1;name:string;character:{asset:'athlete'|'regular';height:number};bench:{position:[number,number,number];rotation:[number,number,number,number];scale:number;rackHeight?:number};camera:{position:[number,number,number];target:[number,number,number];height:number};settings:{reps:number;effort:number;tempo:number;elbowMax?:number;kneeMax?:number}}
export function createBenchProject3D():BenchProject3D;
export function validateBenchProject3D(value:unknown):{valid:boolean;errors:Array<{path:string;message:string}>};
export function assertBenchProject3D(value:unknown):BenchProject3D;
export class BenchProject3DStore {constructor(project?:BenchProject3D);readonly document:BenchProject3D;readonly revision:number;readonly canUndo:boolean;readonly canRedo:boolean;replace(project:BenchProject3D,expectedRevision?:number):BenchProject3D;undo():BenchProject3D;redo():BenchProject3D}
