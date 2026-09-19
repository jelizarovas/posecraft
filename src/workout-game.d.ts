export interface WorkoutCommandEvent {type:string;request?:string;error?:string;[key:string]:unknown}
export interface WorkoutCommandView {subscribe(listener:(event:WorkoutCommandEvent)=>void):()=>void;request(action:string,options:{request:string;target?:string}):unknown|Promise<unknown>;cancel(request:string):unknown|Promise<unknown>;describe():unknown}
export interface WorkoutCommandOptions {signal?:AbortSignal;target?:string}
export function createWorkoutGame(view:WorkoutCommandView,options?:{onCommand?:()=>void}):{
 actor(id:'atlas'):{capabilities():unknown;do(action:string,options?:WorkoutCommandOptions):Promise<WorkoutCommandEvent>;cancel():void;sequence(steps:Array<{do:string;target?:string}>,options?:{signal?:AbortSignal}):{finished:Promise<void>;cancel():void}};
 describe():unknown;dispose():void;
};
