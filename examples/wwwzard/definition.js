const joint = (id, parent, x, y, length, rotation, min, max) => ({ id, parent, x, y, length, rotation, min, max });
const joints = [
  joint('root', null, 330, 395, 0, 0, 0, 0),
  joint('torso', 'root', 0, 0, 0, 0, -8, 8),
  joint('head', 'torso', 0, -136, 0, -3, -18, 18),
  joint('leftUpper', 'torso', -54, -87, 68, 112, 0, 180),
  joint('leftLower', 'leftUpper', 68, 0, 66, -78, -155, 0),
  joint('leftHand', 'leftLower', 66, 0, 0, 0, -35, 35),
  joint('rightUpper', 'torso', 54, -87, 68, 68, -100, 160),
  joint('rightLower', 'rightUpper', 68, 0, 66, 78, 0, 155),
  joint('rightHand', 'rightLower', 66, 0, 0, 0, -35, 35),
  joint('leftThigh', 'root', -28, 12, 54, 135, 45, 145),
  joint('leftCalf', 'leftThigh', 54, 0, 52, -45, -80, 30),
  joint('leftFoot', 'leftCalf', 52, 0, 0, -90, -150, -30),
  joint('rightThigh', 'root', 28, 12, 54, 45, 35, 135),
  joint('rightCalf', 'rightThigh', 54, 0, 52, 45, -30, 80),
  joint('rightFoot', 'rightCalf', 52, 0, 0, -90, -150, -30)
];
const defaults = {
  ...Object.fromEntries(joints.flatMap(j => [[j.id + '.rotation', j.rotation], [j.id + '.x', 0], [j.id + '.y', 0]])),
  'eyes.open': 1, 'eyes.x': 0, 'eyes.y': 0,
  'left.depth':0, 'right.depth':0,
  'ik.left.x': 290, 'ik.left.y': 403, 'ik.left.weight': 1,
  'ik.right.x': 365, 'ik.right.y': 402, 'ik.right.weight': 1,
  'book.visible': 0, 'book.page': 0, 'envelope.visible': 0, 'envelope.flight': 0,
  'flask.visible': 0, 'flask.angle': 0, 'flask.pour': 0, 'glasses.visible': 0, 'phone.visible': 0,
  'stance': 1, 'desk.visible': 0, 'laptop.visible': 0, 'face.smile': .3, 'face.brow': 0, 'face.lid': 1
};
const still = value => [[0, value]];
const actionKeys = ['root.y', 'stance', 'laptop.visible', 'leftThigh.rotation', 'leftCalf.rotation', 'rightThigh.rotation', 'rightCalf.rotation', 'leftUpper.rotation', 'leftLower.rotation', 'rightUpper.rotation', 'rightLower.rotation', 'ik.left.x', 'ik.left.y', 'ik.left.weight', 'ik.right.x', 'ik.right.y', 'ik.right.weight', 'book.visible', 'book.page', 'envelope.visible', 'envelope.flight', 'flask.visible', 'flask.angle', 'flask.pour', 'glasses.visible', 'phone.visible'];
actionKeys.push('desk.visible');
const actionNeutral = {...Object.fromEntries(actionKeys.map(key => [key, defaults[key]])), 'root.y':-25, 'leftThigh.rotation':100,'rightThigh.rotation':80,'leftCalf.rotation':-10,'rightCalf.rotation':10};
const workstation = {'desk.visible':still(1),'laptop.visible':still(1),'stance':still(0),'root.y':still(0)};
const number = (value, min, max) => ({ type: 'number', default: value, min, max });
const bool = value => ({ type: 'boolean', default: value });
const expressions = {
  calm: {'face.smile':.3,'face.brow':0,'face.lid':1},
  happy: {'face.smile':1,'face.brow':-1,'face.lid':1},
  curious: {'face.smile':0,'face.brow':-4,'face.lid':1},
  pouting: {'face.smile':-1,'face.brow':3,'face.lid':.8},
  tired: {'face.smile':-.2,'face.brow':1,'face.lid':.45}
};

export const wwwzardDefinition = {
  joints, defaults,
  chains: [{ id: 'left', upper: 'leftUpper', lower: 'leftLower', bend: -1 }, { id: 'right', upper: 'rightUpper', lower: 'rightLower', bend: 1 }],
  inputs: {
    keyboardDriven:bool(false),
    keyLeftX:number(292,100,600),keyLeftY:number(394,180,500),
    keyRightX:number(366,100,600),keyRightY:number(394,180,500),
    leftArmBehind:bool(false), rightArmBehind:bool(false),
    typing: bool(false), followPointer: bool(true), gazeX: number(0, -1, 1), gazeY: number(0, -1, 1),
    activity: number(.75, 0, 1), tempo: number(1, .25, 2), manualIK: bool(false), ikWeight: number(1, 0, 1),
    leftX: number(290, 100, 600), leftY: number(403, 180, 500),
    rightX: number(365, 100, 600), rightY: number(402, 180, 500),
    stride: number(0,0,1), gaitSpeed:number(1,.25,3), clothEnabled: bool(true),
    emotion: {type:'string',default:'calm',options:['calm','happy','curious','pouting','tired']}
  },
  events: ['REST', 'WORK', 'READ', 'SEND', 'BLINK', 'LOOK_AWAY', 'STAND', 'WALK', 'RUN', 'POUR', 'CLEAN', 'PHONE'],
  eventInputs: { REST: { typing: false }, WORK: { typing: true }, READ: { typing: false }, SEND: { typing: false }, STAND:{typing:false}, WALK:{typing:false,stride:0,gaitSpeed:1}, RUN:{typing:false,stride:1,gaitSpeed:1.85}, POUR:{typing:false}, CLEAN:{typing:false}, PHONE:{typing:false} },
  clips: {
    workspaceIntro: {duration:1.2,loop:false,tracks:{
      'desk.visible':[[0,0],[.45,1],[1.2,1]],
      'laptop.visible':[[0,0],[.4,0],[.8,1],[1.2,1]],
      'stance':[[0,1],[.8,1],[1.2,0]],'root.y':[[0,-25],[.8,-25],[1.2,0]],
      'ik.left.weight':[[0,0],[.8,0],[1.2,1]],'ik.right.weight':[[0,0],[.8,0],[1.2,1]],
      'leftUpper.rotation':still(105),'rightUpper.rotation':still(75),'leftLower.rotation':still(-8),'rightLower.rotation':still(8)
    },events:[{time:.45,name:'desk:ready'},{time:.8,name:'laptop:ready'}]},
    standing: {duration:4,loop:true,tracks:{'root.y':still(-25),'stance':still(1),'laptop.visible':still(0),'ik.left.weight':still(0),'ik.right.weight':still(0),'leftUpper.rotation':[[0,105],[2,106],[4,105]],'rightUpper.rotation':[[0,75],[2,74],[4,75]],'leftLower.rotation':still(-8),'rightLower.rotation':still(8),'leftThigh.rotation':still(100),'rightThigh.rotation':still(80),'leftCalf.rotation':still(-10),'rightCalf.rotation':still(10)}},
    pouring: {duration:3,loop:false,tracks:{
      'ik.left.x':[[0,290],[.5,345],[2.4,345],[3,290]],'ik.left.y':[[0,403],[.5,402],[2.4,402],[3,403]],
      'ik.right.x':[[0,365],[.5,416],[2.3,416],[3,365]],'ik.right.y':[[0,402],[.5,310],[2.3,310],[3,402]],
      'flask.visible':[[0,0],[.2,1],[2.7,1],[3,0]],'flask.angle':[[0,0],[.5,0],[.9,-70],[1.9,-70],[2.3,0],[3,0]],
      'flask.pour':[[0,0],[.85,0],[1,1],[1.85,1],[2,0],[3,0]]
    },events:[{time:1,name:'flask:pour-start'},{time:2,name:'flask:pour-stop'}]},
    cleaning: {duration:2,loop:true,tracks:{
      'ik.left.x':still(307),'ik.left.y':still(351),
      'ik.right.x':[[0,328],[.25,334],[.5,328],[.75,334],[1,345],[1.25,351],[1.5,345],[1.75,336],[2,328]],
      'ik.right.y':[[0,346],[.25,342],[.5,346],[.75,342],[1,346],[1.25,342],[1.5,346],[2,346]],'glasses.visible':still(1)
    },events:[{time:1,name:'glasses:polished'}]},
    phone: {duration:2.4,loop:true,tracks:{
      'ik.right.x':still(382),'ik.right.y':[[0,348],[1.2,347],[2.4,348]],
      'ik.left.x':[[0,344],[.8,344],[1.05,372],[1.2,374],[1.4,368],[1.7,344],[2.4,344]],
      'ik.left.y':[[0,375],[.8,375],[1.05,327],[1.2,324],[1.4,329],[1.7,375],[2.4,375]],'phone.visible':still(1)
    },events:[{time:1.2,name:'phone:tap'}]},
    legsStill: {duration:1,loop:true,tracks:{}},
    walk: {duration:1.2,loop:true,tracks:{
      'root.y':[[0,0],[.3,1.5],[.6,0],[.9,1.5],[1.2,0]],
      'leftThigh.rotation':[[0,-7],[.3,0],[.6,7],[.9,0],[1.2,-7]],'rightThigh.rotation':[[0,7],[.3,0],[.6,-7],[.9,0],[1.2,7]],
      'leftCalf.rotation':[[0,0],[.3,-12],[.6,0],[.9,0],[1.2,0]],'rightCalf.rotation':[[0,0],[.3,0],[.6,0],[.9,12],[1.2,0]],
      'leftFoot.rotation':[[0,7],[.3,12],[.6,-7],[.9,0],[1.2,7]],'rightFoot.rotation':[[0,-7],[.3,0],[.6,7],[.9,-12],[1.2,-7]],
      'leftUpper.rotation':[[0,7],[.6,-7],[1.2,7]],'rightUpper.rotation':[[0,-7],[.6,7],[1.2,-7]]
    }},
    run: {duration:.65,loop:true,tracks:{
      'root.y':[[0,0],[.1625,-4],[.325,0],[.4875,-4],[.65,0]],
      'leftThigh.rotation':[[0,-14],[.1625,0],[.325,14],[.4875,0],[.65,-14]],'rightThigh.rotation':[[0,14],[.1625,0],[.325,-14],[.4875,0],[.65,14]],
      'leftCalf.rotation':[[0,0],[.1625,-26],[.325,0],[.4875,0],[.65,0]],'rightCalf.rotation':[[0,0],[.1625,0],[.325,0],[.4875,26],[.65,0]],
      'leftFoot.rotation':[[0,14],[.1625,26],[.325,-14],[.4875,0],[.65,14]],'rightFoot.rotation':[[0,-14],[.1625,0],[.325,14],[.4875,-26],[.65,-14]],
      'leftUpper.rotation':[[0,12],[.325,-12],[.65,12]],'rightUpper.rotation':[[0,-12],[.325,12],[.65,-12]]
    }},
    idle: { duration: 4, loop: true, tracks: {
      'ik.left.y': [[0,403],[2,401],[4,403]], 'ik.right.y': [[0,402],[2,404],[4,402]]
    } },
    thinking: { duration: 2, loop: true, tracks: {
      ...workstation,
      'ik.left.y': [[0,402],[1,399],[2,402]], 'ik.right.y': [[0,399],[1,393],[2,399]]
    } },
    typing: { duration: .8, loop: true, tracks: {
      ...workstation,
      'ik.left.x': [[0,290],[.2,284],[.4,292],[.6,287],[.8,290]],
      'ik.left.y': [[0,401],[.1,398],[.2,403],[.4,401],[.5,399],[.6,403],[.8,401]],
      'ik.right.x': [[0,365],[.2,369],[.4,359],[.6,366],[.8,365]],
      'ik.right.y': [[0,399],[.1,403],[.3,398],[.4,403],[.6,400],[.7,403],[.8,399]]
    } },
    reading: { duration: 3, loop: true, tracks: {
      'ik.left.x': still(280), 'ik.left.y': [[0,363],[1.5,360],[3,363]],
      'ik.right.x': [[0,381],[1.4,381],[1.65,384],[1.8,366],[2,320],[2.2,281],[2.5,381],[3,381]],
      'ik.right.y': [[0,359],[1.4,359],[1.65,344],[1.8,322],[2,320],[2.2,346],[2.5,359],[3,359]],
      'book.visible': still(1), 'book.page': [[0,0],[1.5,0],[2.2,1],[3,1]]
    }, events: [{ time: 1.8, name: 'page:turn' }] },
    sending: { duration: 2.6, loop: false, tracks: {
      'ik.right.x': [[0,365],[.25,351],[.6,414],[.9,424],[1.1,426],[1.5,411],[2.2,365]],
      'ik.right.y': [[0,402],[.25,390],[.6,312],[.9,296],[1.1,299],[1.5,335],[2.2,402]],
      'envelope.visible': [[0,0],[.2,1],[2.2,1],[2.5,0]],
      'envelope.flight': [[0,0],[.9,0],[2.2,1],[2.6,1]]
    }, events: [{ time: .9, name: 'envelope:release' }, { time: 2.2, name: 'envelope:delivered' }] },
    breathing: { duration: 4.8, loop: true, tracks: {
      'torso.y': [[0,0],[2.4,-1.2],[4.8,0]],
      'torso.rotation': [[0,-.25],[2.4,.25],[4.8,-.25]]
    } },
    autoBlink: { duration: 6.3, loop: true, tracks: {
      'eyes.open': [[0,1],[2.7,1],[2.77,0],[2.88,1],[5.1,1],[5.17,0],[5.28,1],[5.38,0],[5.49,1],[6.3,1]]
    }, events: [{ time: 2.77, name: 'eyes:blink' }, { time: 5.17, name: 'eyes:blink' }] },
    blink: { duration: .24, loop: false, tracks: { 'eyes.open': [[0,1],[.08,0],[.14,0],[.24,1]] }, events: [{ time: .08, name: 'eyes:blink' }] },
    lookAway: { duration: 2.4, loop: false, tracks: {
      'head.rotation': [[0,0],[.5,-12],[1.6,-12],[2.4,0]],
      'eyes.x': [[0,0],[.3,-4],[1.7,-4],[2.4,0]],
      'eyes.y': [[0,0],[.4,-2],[1.7,-2],[2.4,0]]
    } }
  },
  layers: [
    {
      name: 'Action', mode: 'override', weight: 1, initial: 'idle', mask: actionKeys, neutral: actionNeutral,
      transitions: [{ event: 'REST', to: 'idle' }, { event: 'WORK', to: 'preparing' }, { event: 'READ', to: 'reading' }, { event: 'SEND', to: 'sending', duration: .18 },{event:'STAND',to:'standing'},{event:'WALK',to:'walking'},{event:'RUN',to:'running'},{event:'POUR',to:'pouring'},{event:'CLEAN',to:'cleaning'},{event:'PHONE',to:'phone'}],
      states: {
        idle: { clip: 'standing', transitions: [{ when: inputs => inputs.typing, to: 'preparing' }] },
        preparing: {clip:'workspaceIntro',onComplete:'working',exitDuration:.1,transitions:[{when:inputs=>!inputs.typing && !inputs.keyboardDriven,to:'idle'}]},
        working: { duration: .8, speedInput: 'tempo', blend: { input: 'activity', children: [{ at: 0, clip: 'thinking' }, { at: 1, clip: 'typing' }] }, transitions: [{ when: inputs => !inputs.typing && !inputs.keyboardDriven, to: 'idle' }] },
        reading: { clip: 'reading', speedInput: 'tempo', transitions: [{ when: inputs => inputs.typing, to: 'preparing' }] },
        sending: { clip: 'sending', onComplete: 'idle', exitDuration: .25 }
        ,standing:{clip:'standing'},walking:{clip:'standing'},running:{clip:'standing'},
        pouring:{clip:'pouring',onComplete:'idle'},cleaning:{clip:'cleaning'},phone:{clip:'phone'}
      }
    },
    {
      name:'Locomotion',mode:'additive',weight:1,initial:'still',
      mask:['root.y','leftThigh.rotation','rightThigh.rotation','leftCalf.rotation','rightCalf.rotation','leftFoot.rotation','rightFoot.rotation','leftUpper.rotation','rightUpper.rotation'],
      neutral:{'root.y':0,'leftThigh.rotation':0,'rightThigh.rotation':0,'leftCalf.rotation':0,'rightCalf.rotation':0,'leftFoot.rotation':0,'rightFoot.rotation':0,'leftUpper.rotation':0,'rightUpper.rotation':0},
      transitions:[...['REST','STAND','WORK','READ','SEND','POUR','CLEAN','PHONE'].map(event=>({event,to:'still'})),{event:'WALK',to:'moving'},{event:'RUN',to:'moving'}],
      states:{still:{clip:'legsStill'},moving:{duration:1.2,speedInput:'gaitSpeed',blend:{input:'stride',children:[{at:0,clip:'walk'},{at:1,clip:'run'}]}}}
    },
    {
      name: 'Breathing', mode: 'additive', weight: 1, initial: 'breathing',
      mask: ['torso.y', 'torso.rotation'], neutral: { 'torso.y': 0, 'torso.rotation': 0 },
      states: { breathing: { clip: 'breathing' } }
    },
    {
      name: 'Attention', mode: 'additive', weight: 1, initial: 'tracking',
      mask: ['head.rotation', 'eyes.x', 'eyes.y'], neutral: { 'head.rotation': 0, 'eyes.x': 0, 'eyes.y': 0 },
      transitions: [{ event: 'LOOK_AWAY', to: 'away' }],
      states: {
        tracking: { sample: inputs => ({
          'head.rotation': inputs.followPointer ? inputs.gazeX * 9 : 0,
          'eyes.x': inputs.followPointer ? inputs.gazeX * 3 : 0,
          'eyes.y': inputs.followPointer ? inputs.gazeY * 2 : 0
        }) },
        away: { clip: 'lookAway', onComplete: 'tracking', exitDuration: .3 }
      }
    },
    {
      name:'Expression',mode:'override',weight:1,initial:'calm',
      mask:['face.smile','face.brow','face.lid'],neutral:{'face.smile':.3,'face.brow':0,'face.lid':1},
      states:Object.fromEntries(Object.entries(expressions).map(([name,values])=>[name,{
        sample:()=>values,
        transitions:Object.keys(expressions).filter(target=>target!==name).map(target=>({when:inputs=>inputs.emotion===target,to:target,duration:.25}))
      }]))
    },
    {
      name:'Keyboard',mode:'override',weight:0,initial:'held',
      mask:['ik.left.x','ik.left.y','ik.right.x','ik.right.y'],
      neutral:{'ik.left.x':292,'ik.left.y':394,'ik.right.x':366,'ik.right.y':394},
      states:{held:{sample:inputs=>({'ik.left.x':inputs.keyLeftX,'ik.left.y':inputs.keyLeftY,'ik.right.x':inputs.keyRightX,'ik.right.y':inputs.keyRightY})}}
    },
    ...['left','right'].map(side => ({
      name:side + ' arm depth',mode:'override',weight:1,initial:'front',
      mask:[side+'.depth'],neutral:{[side+'.depth']:0},
      states:{
        front:{sample:()=>({[side+'.depth']:0}),transitions:[{when:inputs=>inputs[side+'ArmBehind'],to:'back',duration:.35}]},
        back:{sample:()=>({[side+'.depth']:1}),transitions:[{when:inputs=>!inputs[side+'ArmBehind'],to:'front',duration:.35}]}
      }
    })),
    {
      name: 'Face', mode: 'override', weight: 1, initial: 'auto',
      mask: ['eyes.open'], neutral: { 'eyes.open': 1 },
      transitions: [{ event: 'BLINK', to: 'blink', duration: .02 }],
      states: { auto: { clip: 'autoBlink' }, blink: { clip: 'blink', onComplete: 'auto', exitDuration: .02 } }
    }
  ]
};
