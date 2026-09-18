import {evaluateDrawing} from '../src/render-evaluation.js';
import {mountCanvas,pickDrawing} from '../src/canvas.js';
import {renderDepthCanvas} from '../src/canvas-depth.js';
import {mountRenderer} from '../src/render-mount.js';
import {SceneDocument} from '../src/schema.js';
import {Frame} from '../src/scene.js';
declare const scene:SceneDocument,frame:Frame,host:HTMLElement,context:CanvasRenderingContext2D;
const drawing=evaluateDrawing(scene,frame);const view=mountCanvas(host,scene,frame);view.pick(2,3)?.actor;view.update(frame);view.dispose();mountRenderer(host,scene,frame).dispose();pickDrawing(context,drawing,1,2)?.object;renderDepthCanvas(context,drawing).pick(1,2)?.part;
