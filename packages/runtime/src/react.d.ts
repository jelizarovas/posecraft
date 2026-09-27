import type {CSSProperties,ForwardRefExoticComponent,RefAttributes} from 'react';
import type {SceneDocument,IllustrationPlayer,MountIllustrationOptions} from './index.js';
export interface PosecraftIllustrationProps extends Pick<MountIllustrationOptions,'label'|'autoplay'|'reducedMotion'|'onEvent'|'onError'> {
  scene:SceneDocument;
  onReady?:(player:IllustrationPlayer)=>void;
  className?:string;
  style?:CSSProperties;
}
export interface PosecraftIllustrationHandle extends Pick<IllustrationPlayer,'dispatch'|'setVariable'|'setInput'|'play'|'pause'|'reset'|'seek'> {
  readonly player:IllustrationPlayer|null;
}
export const PosecraftIllustration:ForwardRefExoticComponent<PosecraftIllustrationProps&RefAttributes<PosecraftIllustrationHandle>>;
