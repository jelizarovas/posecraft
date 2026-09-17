import React, { useId, useRef } from 'react';
import { clamp } from './engine';

function limitArc(world, joint, pose) {
  const parent = world.rotation - pose[joint.id + '.rotation'];
  const point = angle => [world.x + 26 * Math.cos(angle * Math.PI / 180), world.y + 26 * Math.sin(angle * Math.PI / 180)];
  const start = point(parent + joint.min), end = point(parent + joint.max);
  return 'M' + world.x + ',' + world.y + 'L' + start.join(',') + 'A26,26 0 ' + (joint.max - joint.min > 180 ? 1 : 0) + ',1 ' + end.join(',') + 'Z';
}

export default function RigSvg({ frame, controller, showBones, showLimits, handsInFront, releasePoint, selectedJoint, onSelectJoint, onChange, accessories = {}, onPropAction }) {
  const id = useId().replace(/:/g, '');
  const drag = useRef(null);
  const { world, pose, targets } = frame;
  const behind = side => pose[side + '.depth'] >= .5;
  const armBehindBody = side => behind(side);
  const atDesk = pose['desk.visible'] > 0;
  const laptopOpacity = accessories.laptop === false ? 0 : pose['laptop.visible'];
  const laptopEntrance = 'translate(0 '+(-35*(1-pose['laptop.visible']))+')';
  const paint = name => 'url(#' + id + '-' + name + ')';
  const bone = (name, contents) => {
    const joint = world[name];
    return <g transform={'translate(' + joint.x + ' ' + joint.y + ') rotate(' + joint.rotation + ')'}>{contents}</g>;
  };
  const moveTarget = (name, x, y) => {
    controller.setInput('manualIK', true);
    controller.setInput(name + 'X', x);
    controller.setInput(name + 'Y', y);
    onChange();
  };
  const pointerMove = event => {
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    if (drag.current) moveTarget(drag.current, local.x, local.y);
    else {
      controller.setInput('gazeX', clamp((local.x - world.head.x) / 210, -1, 1));
      controller.setInput('gazeY', clamp((local.y - world.head.y) / 180, -1, 1));
    }
  };
  const sleeves = Object.fromEntries(['left', 'right'].map(side => {
    const shoulder = world[side + 'Upper'], elbow = world[side + 'Lower'], wrist = world[side + 'Hand'];
    const mix = (a, b, t) => ({x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t});
    const before = mix(shoulder, elbow, .68), after = mix(elbow, wrist, .32);
    const p = point => point.x + ',' + point.y;
    // One rounded contour and one world-space gradient across both bones.
    const center = 'M' + p(shoulder) + 'L' + p(before) + 'Q' + p(elbow) + ' ' + p(after) + 'L' + p(wrist);
    const sleeve = <g>
      <path d={'M'+p(mix(shoulder,elbow,.35))+'L'+p(before)+'Q'+p(elbow)+' '+p(after)+'L'+p(wrist)} fill="none" stroke="#663078" strokeWidth="36" strokeLinecap="butt" strokeLinejoin="round" />
      <path d={center} fill="none" stroke={paint(side + '-sleeve')} strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
      {bone(side+'Lower',<path d="M56-16Q60 0 56 16" fill="none" stroke="#54256a" strokeWidth="3" opacity=".65" />)}
    </g>;
    const split = {x:(before.x+2*elbow.x+after.x)/4,y:(before.y+2*elbow.y+after.y)/4};
    const splitAngle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
    return [side, {shoulder, wrist, elbow, after, sleeve, split, splitAngle}];
  }));
  const hand = <g><path d="M-7-11Q3-15 12-8L23 1Q27 8 22 12L10 9Q6 18-5 14L-11 4Z" fill={paint('skin')} /><path d="M11 2L19 7M5 5L14 11" stroke="#cb967a" strokeWidth="1.7" fill="none" strokeLinecap="round" /></g>;
  const pageEdge = 394 - pose['book.page'] * 122;
  const pageLift = Math.sin(pose['book.page'] * Math.PI) * 31;
  const flaskAngle = pose['flask.angle'] * Math.PI / 180;
  const spout = {x:world.rightHand.x + 29*Math.sin(flaskAngle),y:world.rightHand.y - 29*Math.cos(flaskAngle)};
  const hem = frame.cloth || [];
  const first = hem[0], last = hem.at(-1);
  const clothPath = first ? 'M' + (world.torso.x-61) + ',' + (world.torso.y-10) + 'Q' + (first.x+4) + ',' + (first.y-30) + ' ' + first.x + ',' + first.y + hem.slice(1).map(point=>'L'+point.x+','+point.y).join('') + 'Q' + (last.x-4) + ',' + (last.y-30) + ' ' + (world.torso.x+61) + ',' + (world.torso.y-10) + 'Z' : '';
  const foot = <path d="M-10-8L11-8L30 1Q35 12 24 13L-12 10Z" fill="#443353" />;
  const slots = [
    ...['left','right'].flatMap(side=>[
      {id:side+'-thigh',order:10,node:bone(side+'Thigh',<path d="M-9-14H56V14H-9Z" fill="#58396d" />)},
      {id:side+'-calf',order:11,node:bone(side+'Calf',<path d="M-4-11H53V11H-4Z" fill="#51305f" />)},
      {id:side+'-foot',order:12,node:bone(side+'Foot',foot)}
    ]),
    { id: 'neck', order: 19, node: bone('torso', <path d="M-17-111L-15-82Q0-74 16-82L18-111Z" fill="#d7a486" />) },
    { id: 'robe', order: 20, node: bone('torso', <g>
      <path d="M-44-119Q-78-105-69-61L-79 30Q0 55 77 27L67-66Q76-101 43-119Z" fill={paint('robe')} />
      <path d="M-44-118L-11-76L7-99L36-122" fill="#b557ca" opacity=".5" />
      <path d="M-7-89L-9 26M-55-38L-61 17M45-52L53 18" fill="none" stroke="#542578" strokeWidth="4" opacity=".55" />
      <path d="M-10-82L-10 17" stroke="#e8a0d2" strokeWidth="2" opacity=".5" />
      <circle cx="-10" cy="-53" r="3" fill="#e5b465" /><circle cx="-10" cy="-26" r="3" fill="#e5b465" />
    </g>) },
    { id: 'cloth', order: 22, node: <g><path d={clothPath} fill={paint('hem')} />{hem.filter((_,i)=>i%2===1).map((point,i)=><path key={i} d={'M'+(world.torso.x-40+i*27)+','+(world.torso.y+1)+'Q'+(point.x+4)+','+(point.y-22)+' '+point.x+','+(point.y-4)} fill="none" stroke="#512766" strokeWidth="3" opacity=".3" />)}</g> },
    { id: 'head', order: 35, node: bone('head', <g>
      <path d="M-38-23Q-4-44 34-22L39 9Q32 46 4 47Q-26 43-36 17Z" fill={paint('skin')} />
      <g>
        {[-13, 17].map((x, index) => {
          const blink=clamp(pose['eyes.open'],0,1);
          const expression=pose['face.brow'];
          const tilt=Math.max(0,expression)*(index===0?1:-1)*.7*blink;
          const top=(-7*pose['face.lid']+(1-pose['face.lid'])*5+(index===0?Math.min(0,expression)*.5:0))*blink;
          const lid='M-8,'+(top-tilt)+'Q0,'+(top-1.5*blink)+' 8,'+(top+tilt);
          const outline=lid+'Q10,'+(10*blink)+' 0,'+(11*blink)+'Q-10,'+(10*blink)+' -8,'+(top-tilt)+'Z';
          const eyeId=id+'-eye-'+index;
          return <g key={x} transform={'translate('+x+' 12)'}>
            <defs><clipPath id={eyeId}><path d={outline} /></clipPath></defs>
            <path d={outline} fill="#fff9ed" stroke="#65464b" strokeWidth=".7" />
            <g clipPath={'url(#'+eyeId+')'}>
              <ellipse cx={pose['eyes.x']*.65} cy={pose['eyes.y']*.8+1} rx="4" ry="5.2" fill="#332541" />
              <circle cx={pose['eyes.x']*.65+1} cy={pose['eyes.y']*.8-.5} r=".8" fill="#fff" />
            </g>
            <path d={lid} fill="none" stroke="#493044" strokeWidth="1.5" strokeLinecap="round" />
          </g>;
        })}
      </g>
      <g transform="translate(0 -3) scale(.65 .78)">
      <path d="M-96-29Q-84-43-42-44L52-43Q94-34 94-20Q85 5 12 8Q-51 7-96-13Q-103-22-96-29" fill={paint('brim')} />
      <path d="M-65-35L-43-93L-6-146L30-111L65-36Q9-13-65-35" fill={paint('hat')} />
      <path d="M-43-92L-68-79L-27-131L-6-146L-14-104Z" fill="#5335a2" />
      <path d="M-61-46Q-4-27 61-49L66-33Q4-10-67-31Z" fill="#42287d" />
      <g transform="translate(25 -43) rotate(-13)"><rect x="-13" y="-14" width="26" height="28" rx="3" fill="#efc063" /><rect x="-7" y="-8" width="14" height="16" rx="1" fill="#654393" /></g>
      </g>
    </g>) },
    ...['left', 'right'].flatMap(side => [
      {id: side + '-sleeve-back', order: 18, node: sleeves[side].sleeve},
      {id: side + '-hand', order: armBehindBody(side) ? 18.5 : atDesk || handsInFront ? 80 : 46, node: bone(side + 'Hand', <g transform={'translate(7 0) scale(1 '+(side==='left'?-1:1)+')'}>{hand}</g>)},
      {id: side + '-sleeve-front', order: armBehindBody(side) ? 18 : atDesk || handsInFront ? 78 : 30, node: <g clipPath={paint(side+'-forearm-clip')}>{sleeves[side].sleeve}</g>},
    ]),
    { id: 'book', order: 48, node: <g opacity={accessories.book === false ? 0 : pose['book.visible']}>
      <path d="M263 348Q293 337 330 352Q361 335 399 347L390 384Q359 380 330 392Q300 380 271 387Z" fill="#673ca8" />
      <path d="M268 344Q300 336 330 351Q360 335 394 343L386 377Q353 376 330 386Q298 374 276 380Z" fill="#fff5e6" />
      <path d="M330 351V386M280 351L317 358M280 359L317 366M344 357L381 349M344 365L379 358" stroke="#baacd0" strokeWidth="2" />
      {pose['book.page'] > 0 && pose['book.page'] < 1 && <path d={'M330 351Q' + pageEdge + ' ' + (328 - pageLift) + ' ' + pageEdge + ' ' + (344 - pageLift) + 'L' + (pageEdge - 5) + ' ' + (377 - pageLift) + 'Q345 372 330 386Z'} fill="#fffaf0" stroke="#d5c8dc" strokeWidth="1" />}
    </g> },
    {id:'desk',order:60,node:<g opacity={pose['desk.visible']} transform={'translate('+((1-pose['desk.visible'])*190)+' 0)'}>
      <path d="M220 430L420 403L478 445L273 480Z" fill="#eee9f6" />
      <path d="M220 430L273 467L478 434V447L273 480L220 444Z" fill="#c4b6d8" />
      <path d="M230 446L273 476V535L230 506Z" fill="#88769f" />
      <path d="M273 476L467 445V503L273 535Z" fill="#ad9ac5" />
      <path d="M284 485L456 457" stroke="#c7b8d8" strokeWidth="2" />
      <path d="M284 523L456 496" stroke="#8d79a6" strokeWidth="3" />
    </g>},
    { id: 'laptop-keyboard', order: 70, node: <g opacity={laptopOpacity} transform={laptopEntrance}>
      <path d="M254 416L413 411L450 438L280 450L239 432Z" fill="#d3cde9" />
      <path d="M270 418L406 415L429 433L287 440Z" fill="#77728f" />
      {[0,1,2].map(row => <path key={row} d={'M' + (276 + row * 6) + ' ' + (421 + row * 5) + 'L' + (405 + row * 6) + ' ' + (418 + row * 5)} stroke="#ddd8ef" strokeWidth="2" />)}
      <path d="M239 432L280 450L450 438L450 444L280 458L239 439Z" fill="#aca3d1" />
      <path d="M305 439L331 437L338 441L312 443Z" fill="#b3a8ca" />
    </g> },
    { id: 'laptop-lid', order: 85, node: <g opacity={laptopOpacity} transform={laptopEntrance}>
      <path d="M332 442L445 423L432 335L320 355Z" fill="#574270" />
      <path d="M336 438L440 420L428 340L325 359Z" fill={paint('lid')} />
      <path d="M325 359L428 340" stroke="#c2a8e0" strokeWidth="2" />
      <path d="M375 382L383 373L391 379L383 389Z" fill="#ddc9f1" opacity=".8" />
      <path d="M335 440L444 422" stroke="#392b50" strokeWidth="4" strokeLinecap="round" />
    </g> },
    {id:'flask',order:95,node:<g opacity={accessories.flask === false ? 0 : pose['flask.visible']}>
      <g transform={'translate('+world.rightHand.x+' '+world.rightHand.y+') rotate('+pose['flask.angle']+')'}><path d="M-7-29H7V-10Q28 15 14 27Q0 36-14 27Q-28 15-7-10Z" fill="#d1dbe9" fillOpacity=".9" stroke="#8d8aa9" strokeWidth="2" /><path d="M-16 8Q0 13 16 8Q25 27 0 29Q-25 27-16 8" fill="#9e72d1" /><path d="M-10-29H10" stroke="#706786" strokeWidth="4" /></g>
      <path d={'M'+spout.x+','+spout.y+'Q'+spout.x+','+(spout.y+38)+' '+(world.leftHand.x+13)+','+(world.leftHand.y+3)} fill="none" stroke="#ae80d8" strokeWidth="3" opacity={pose['flask.pour']} />
    </g>},
    {id:'cup',order:95,node:<g opacity={accessories.flask === false ? 0 : pose['flask.visible']} transform={'translate('+world.leftHand.x+' '+world.leftHand.y+')'}><path d="M-4-14L0 14H27L31-14Z" fill="#eee8f7" stroke="#b5a5ca" /><path d="M2 3H25V12H2Z" fill="#b491d8" /></g>},
    {id:'glasses',order:96,node:<g opacity={accessories.glasses === false ? 0 : pose['glasses.visible']}>
      <g transform={'translate('+world.leftHand.x+' '+world.leftHand.y+')'}><circle cx="8" cy="0" r="13" fill="#f3f6fc80" stroke="#b9a063" strokeWidth="2.5" /><circle cx="40" cy="0" r="13" fill="#f3f6fc80" stroke="#b9a063" strokeWidth="2.5" /><path d="M21 0H27M-5-3L-12-12M53-3L59-12" stroke="#b9a063" fill="none" strokeWidth="2.5" /></g>
      <path d={'M'+(world.rightHand.x-12)+','+(world.rightHand.y-8)+'l23 3-3 23-25-4Z'} fill="#e2c4e7" />
    </g>},
    {id:'phone',order:97,node:<g opacity={accessories.phone === false ? 0 : pose['phone.visible']} transform={'translate('+world.rightHand.x+' '+world.rightHand.y+') rotate(8)'}><rect x="-14" y="-43" width="28" height="49" rx="5" fill="#423652" /><rect x="-10" y="-37" width="20" height="32" rx="1" fill="#b599e6" /><path d="M-5-28H6M-5-22H3" stroke="#ede4ff" strokeWidth="2" /><circle cx="0" cy="0" r="2" fill="#a68bb9" /></g>}
  ];
  // Held objects follow the owning hand. Scene furniture never follows arm depth.
  for (const slot of slots) {
    const owner = {phone:'right',flask:'right',cup:'left',glasses:'left'}[slot.id];
    if (owner && behind(owner)) slot.order = 18.75;
    if (slot.id === 'book' && behind('left') && behind('right')) slot.order = 18.75;
  }
  const flight = pose['envelope.flight'];
  const launch = releasePoint || { x: world.rightHand.x, y: world.rightHand.y };
  const envelopeX = flight > 0 ? launch.x + flight * 240 : world.rightHand.x;
  const envelopeY = flight > 0 ? launch.y - Math.sin(flight * Math.PI / 2) * 180 : world.rightHand.y;
  slots.push({ id: 'envelope', order: flight === 0 && behind('right') ? 18.75 : 100, node: <g opacity={pose['envelope.visible'] * (1 - Math.max(0, (flight - .75) * 4))} transform={'translate(' + envelopeX + ' ' + envelopeY + ') rotate(' + (-12 - flight * 14) + ')'}>
    <rect x="-24" y="-15" width="48" height="31" rx="2" fill="#fff6f5" stroke="#bda9d8" strokeWidth="1.5" /><path d="M-23-13L0 3L23-13M-23 15L-7 2M23 15L7 2" fill="none" stroke="#bda9d8" strokeWidth="1.5" /><circle cx="0" cy="2" r="4" fill="#d979bc" />
  </g> });
  return <svg className="rig-art" viewBox="0 0 720 555" role="group" aria-label="Interactive 2D wwwzard rig" onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => { if (!drag.current) { controller.setInput('gazeX', 0); controller.setInput('gazeY', 0); } }}>
    <defs>
      <clipPath id={id + '-palm-clip'}><rect x="0" y="-25" width="35" height="50" /></clipPath>
      {Object.entries(sleeves).map(([side, arm]) => <React.Fragment key={side}>
        <linearGradient id={id + '-' + side + '-sleeve'} gradientUnits="userSpaceOnUse" x1={arm.shoulder.x} y1={arm.shoulder.y} x2={arm.wrist.x} y2={arm.wrist.y}><stop stopColor="#a94db7" /><stop offset="1" stopColor="#70307f" /></linearGradient>
        <clipPath id={id + '-' + side + '-forearm-clip'}>
          <rect transform={'translate('+arm.split.x+' '+arm.split.y+') rotate('+arm.splitAngle+')'} x="-2" y="-400" width="800" height="800" />
        </clipPath>
      </React.Fragment>)}
      <linearGradient id={id + '-robe'} gradientUnits="userSpaceOnUse" x1="0" y1="-120" x2="0" y2="-10"><stop stopColor="#a04aaa" /><stop offset="1" stopColor="#763184" /></linearGradient>
      <linearGradient id={id + '-hem'} gradientUnits="userSpaceOnUse" x1={world.torso.x} y1={world.torso.y-10} x2={world.torso.x} y2={world.torso.y+118}><stop stopColor="#763184" /><stop offset="1" stopColor="#582566" /></linearGradient>
      <linearGradient id={id + '-hat'}><stop stopColor="#483588" /><stop offset=".5" stopColor="#8050d2" /><stop offset="1" stopColor="#9f50cc" /></linearGradient>
      <linearGradient id={id + '-brim'}><stop stopColor="#3d2f71" /><stop offset="1" stopColor="#7248ac" /></linearGradient>
      <linearGradient id={id + '-skin'} x2="0" y2="1"><stop stopColor="#ffe4bf" /><stop offset="1" stopColor="#e3b699" /></linearGradient>
      <linearGradient id={id + '-sleeve'} x2="0" y2="1"><stop stopColor="#a94db7" /><stop offset="1" stopColor="#70307f" /></linearGradient>
      <linearGradient id={id + '-screen'} x2="0" y2="1"><stop stopColor="#ac7ef5" /><stop offset="1" stopColor="#6a4fbb" /></linearGradient>
      <linearGradient id={id + '-lid'} x2="1" y2="1"><stop stopColor="#ae8ace" /><stop offset="1" stopColor="#795795" /></linearGradient>
    </defs>
    <g aria-hidden="true">
      <ellipse cx="337" cy="505" rx="224" ry="22" fill="#78648f" opacity=".08" />
      <path d="M513 99H648V271H513Z" fill="#fff" stroke="#e6dfea" strokeWidth="5" />
      <path d="M522 109H638V260H522Z" fill="#e3deef" /><circle cx="609" cy="143" r="17" fill="#fff5d7" />
      <path d="M522 228Q561 174 601 222L638 198V260H522Z" fill="#b5c7bb" /><path d="M580 109V260M522 183H638" stroke="#fff" strokeWidth="6" />
    </g>
    {slots.sort((a,b) => a.order - b.order).map(slot => <g key={slot.id} data-slot={slot.id} aria-hidden="true">{slot.node}</g>)}
    <g className="rig-prop-shelf">
      <path d="M530 361H675V369H530M530 428H675V436H530" fill="#d2c7df" />
      {[['book','READ',550,329],['flask','POUR',620,329],['glasses','CLEAN',550,396],['phone','PHONE',620,396]].filter(([key])=>accessories[key]!==false).map(([key,event,x,y])=><g key={key} transform={'translate('+x+' '+y+')'} role="button" tabIndex="0" aria-label={'Use '+key} onClick={()=>onPropAction?.(event)} onKeyDown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onPropAction?.(event);}}}>
        <rect x="-10" y="-27" width="57" height="59" rx="5" fill="#ffffff01" />
        {key==='book' && <g><path d="M0-12L17-8L36-12V20L18 24L0 20Z" fill="#9065b3" /><path d="M3-15L18-10L33-15V16L18 21L3 16Z" fill="#fff5dc" /><path d="M18-10V21" stroke="#c8b1d2" /></g>}
        {key==='flask' && <path d="M12-17H24V-4Q44 25 18 25Q-8 25 12-4Z" fill="#bc9bdc" stroke="#9a83b1" />}
        {key==='glasses' && <g fill="none" stroke="#b29a67" strokeWidth="2.5"><circle cx="8" cy="9" r="10" /><circle cx="32" cy="9" r="10" /><path d="M18 9H22" /></g>}
        {key==='phone' && <g><rect x="7" y="-20" width="25" height="44" rx="4" fill="#58436c" /><rect x="10" y="-15" width="19" height="30" fill="#c1a2e2" /></g>}
      </g>)}
    </g>
    {showBones && <g className="rig-debug">
      {hem.map((point,i)=><circle key={'cloth'+i} cx={point.x} cy={point.y} r="3.5" fill="#b862c8" stroke="#fff" />)}
      {controller.joints.map(joint => {
        const point = world[joint.id];
        return <g key={joint.id}>
          {showLimits && joint.min !== joint.max && <path d={limitArc(point, joint, pose)} fill="#fbbf2426" stroke="#bd8300" strokeWidth="1" />}
          {joint.length > 0 && <path d={'M' + point.x + ',' + point.y + 'L' + point.endX + ',' + point.endY} stroke="#0891b2" strokeWidth="3" />}
          <circle cx={point.x} cy={point.y} r={selectedJoint === joint.id ? 7 : 5} fill={selectedJoint === joint.id ? '#f59e0b' : '#fff'} stroke="#0891b2" strokeWidth="2" onPointerDown={event => { event.stopPropagation(); onSelectJoint(joint.id); }} />
        </g>;
      })}
      {Object.entries(targets).map(([name, target]) => <g key={name}>
        <path d={'M' + (target.x - 12) + ',' + target.y + 'h24M' + target.x + ',' + (target.y - 12) + 'v24'} stroke="#db2777" strokeWidth="1.5" pointerEvents="none" />
        <circle className="rig-target" cx={target.x} cy={target.y} r="15" fill="#db277718" stroke="#db2777" strokeDasharray="3 3" role="slider" tabIndex="0" aria-label={name + ' hand target, arrow keys move horizontally or vertically'} aria-valuemin="100" aria-valuemax="600" aria-valuenow={Math.round(target.x)} aria-valuetext={'x ' + Math.round(target.x) + ', y ' + Math.round(target.y)}
          onPointerDown={event => { event.stopPropagation(); drag.current = name; event.currentTarget.setPointerCapture(event.pointerId); moveTarget(name, target.x, target.y); }}
          onKeyDown={event => { const delta = { ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,-5], ArrowDown: [0,5] }[event.key]; if (delta) { event.preventDefault(); moveTarget(name, target.x + delta[0], target.y + delta[1]); } }} />
      </g>)}
    </g>}
  </svg>;
}
