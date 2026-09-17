import { SceneController } from 'posecraft/scene';
import { assertDocument } from 'posecraft/schema';
import { Posecraft, PosecraftHandle } from 'posecraft/react';
import { DocumentStore } from 'posecraft/commands';
import { AnimationController } from 'posecraft';
import { createElement, createRef } from 'react';
declare const incoming:unknown;
const scene=assertDocument(incoming);
const store=new DocumentStore(scene);
store.transact([{op:'set',path:['name'],value:'Example'}],scene.revision);
const player=new SceneController(scene);
player.setInput('ona','greeting',true);
const ref=createRef<PosecraftHandle>();
createElement(Posecraft,{scene,ref,inputs:{ona:{greeting:true}}});
new AnimationController({joints:[]});
// @ts-expect-error Input values cannot be objects.
player.setInput('ona','greeting',{});
