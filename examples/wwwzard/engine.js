import { AnimationController as PosecraftController } from 'posecraft';
import { createCloth, stepCloth } from './cloth.js';

export * from 'posecraft';

// The robe and manual hand controls belong to this character, not the runtime.
export class AnimationController extends PosecraftController {
  constructor(definition) {
    super({
      ...definition,
      chains: definition.chains.map(chain => ({
        ...chain,
        target: ({ pose, inputs }) => {
          const prefix = `ik.${chain.id}`;
          return {
            x: inputs.manualIK ? inputs[`${chain.id}X`] : pose[`${prefix}.x`],
            y: inputs.manualIK ? inputs[`${chain.id}Y`] : pose[`${prefix}.y`],
            weight: inputs.ikWeight * (inputs.manualIK ? 1 : pose[`${prefix}.weight`])
          };
        }
      }))
    });
    this.cloth = createCloth(this.frame.world, this.frame.pose.stance);
    this.frame.cloth = this.cloth;
  }

  step(dt) {
    const frame = super.step(dt);
    this.cloth = stepCloth(this.cloth, frame.world, frame.pose.stance, dt, this.time, this.inputs.clothEnabled);
    frame.cloth = this.cloth;
    return frame;
  }
}
