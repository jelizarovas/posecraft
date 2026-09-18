export interface CheckpointOptions {enabled?:boolean;interval?:number;maxEntries?:number;maxBytes?:number}
export interface CheckpointStats {entries:number;bytes:number;maxBytes:number;hits:number;misses:number;replayedTicks:number;reason:string|null}
export class ReplayCheckpoints {constructor(options?:CheckpointOptions);clear():void;invalidateFrom(time:number):void;syncHistory(log:Array<{time:number;[key:string]:unknown}>):void;store(time:number,cursor:number,state:unknown,history?:unknown):boolean;find(time:number,historyAt?:(cursor:number)=>unknown):{time:number;cursor:number;state:unknown}|null;stats():CheckpointStats}
export function stateBytes(value:unknown):number;
