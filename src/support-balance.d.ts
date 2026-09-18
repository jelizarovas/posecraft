export interface SupportPoint {x:number;y:number}
export interface SuspendedSupportOptions {
 anchor?:SupportPoint;
 supports?:Array<SupportPoint&{weight?:number}>;
 restCenter:SupportPoint;
 centerOffset?:SupportPoint;
 resistance?:number;
 load?:number;
 elapsed?:number;
 amplitude?:number;
 settle?:number;
 maxLean?:number;
 maxShift?:number;
 rotation?:number;
 gravity?:SupportPoint;
}
export interface SuspendedSupportSample {
 center:SupportPoint;
 rotation:number;
 centerOfMass:SupportPoint;
 anchor:SupportPoint;
 alignment:number;
 lateralError:number;
 target:{center:SupportPoint;rotation:number};
 limited:boolean;
}
export function sampleSuspendedSupport(options:SuspendedSupportOptions):SuspendedSupportSample;
