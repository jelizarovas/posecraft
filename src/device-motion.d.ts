export interface MotionReading {acceleration?:{x:number|null;y:number|null}|null;accelerationIncludingGravity?:{x:number|null;y:number|null}|null;rotationRate?:{alpha:number|null;beta:number|null;gamma:number|null}|null}
export class MotionSignal {
 reset():void;
 update(event:MotionReading,time:number,screenAngle?:number,sensitivity?:number):boolean;
 sample(time:number):{ax:number;ay:number;turn:number};
}
export class PhoneMotion {
 constructor(options?:{onStatus?:(message:string)=>void;environment?:typeof globalThis;signal?:MotionSignal});
 readonly signal:MotionSignal;readonly enabled:boolean;sensitivity:number;
 enable():Promise<boolean>;disable():void;
}
