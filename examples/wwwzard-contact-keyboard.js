const warp=(path,dx,dy,weight)=>path.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>{
  const [x,y]=pair.split(/\s+/).map(Number),w=weight(x,y);
  return `${+(x+dx*w).toFixed(3)} ${+(y+dy*w).toFixed(3)}`;
});

/** Saved input layers keep keyboard poses editable and portable. Host inputs
 * are bounded hand offsets, never text, DOM paths or direct SVG mutations. */
export function addContactKeyboard(scene){
  const hero=scene.packs.wwzard;
  scene.requiredFeatures.push('motion-layers');
  // Typing timing now comes from input. Keep breathing, but remove the old
  // autonomous two-hand cycle and the prepared pose's unsolicited taps.
  for(const name of ['typing','prepared'])for(const channel of Object.keys(hero.clips[name].tracks)){
    // Input replaces movement, not visibility. The lid-grip overlay must stay
    // hidden while typing, including when the other hand holds the plane.
    if(/^(leftHand|leftArm|leftGrip|rightHand|rightArm)\./.test(channel)&&!channel.endsWith('.opacity')&&!(name==='prepared'&&channel.startsWith('right')))delete hero.clips[name].tracks[channel];
  }
  scene.motionLayers??=[];
  const add=(id,joint,channel,variable,amplitude,clips)=>scene.motionLayers.push({id,actor:'wwzard',joint,channel,type:'input',amplitude,frequency:1,phase:0,seed:0,variable,range:[-1,1],clips});
  // Legacy joint names describe the drawing's sides, not his anatomy.
  // His left hand is the far hand (rightHand); his right is nearest us.
  for(const [side,prefix,parts,origin,span] of [
    ['left','keyRight',['left-sleeve','left-sleeve-shadow'],191,76],
    ['right','keyLeft',['right-sleeve','right-cuff'],249,51],
  ]){
    const clips=['ready','typing'];
    for(const [axis,amplitude] of [['X',18],['Y',14]]){
      for(const sign of [1,-1]){
        const variable=prefix+(sign<0?'N':'')+axis;
        scene.behaviorGraph.variables[variable]=0;
        scene.behaviorGraph.variableBounds??={};scene.behaviorGraph.variableBounds[variable]={min:-1,max:1};
        if(!(axis==='Y'&&sign>0)){
        hero.joints.push({id:variable,parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
        for(const id of parts){const part=hero.parts.find(p=>p.id===id);
          const target=warp(part.d,axis==='X'?sign*amplitude:0,axis==='Y'?sign*amplitude:0,x=>Math.max(0,Math.min(1,(x-origin)/span)));
          part.spatial.morph.layers??=[];part.spatial.morph.layers.push({channel:variable+'.bend',target});
        }
        add(variable+'-sleeve',variable,'bend',variable,1,clips);
        }
        if(sign>0)add(variable+'-hand',side+'Hand',axis.toLowerCase(),variable,amplitude,clips);
      }
    }
  }
  // The host provides the most recent key's bounded full-keyboard target too.
  // Clip filters route it to the free hand while the other holds a prop.
  for(const layer of [...scene.motionLayers].filter(layer=>layer.variable?.startsWith('keyRight'))){
    const variable=layer.variable.replace('keyRight','keySolo');
    scene.behaviorGraph.variables[variable]=0;
    scene.behaviorGraph.variableBounds[variable]={min:-1,max:1};
    scene.motionLayers.push({...layer,id:layer.id.replace('keyRight','keySolo'),variable,clips:['prepared']});
  }
}
