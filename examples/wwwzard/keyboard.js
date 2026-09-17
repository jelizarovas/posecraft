// Project physical QWERTY keys onto the laptop's angled keyboard plane.
const rows = [
  ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','Backspace'],
  ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight'],
  ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Enter'],
  ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash']
];
export function keyTarget(code) {
  if (code === 'Space') return {side:'right',x:340,y:419};
  for (let row=0;row<rows.length;row++) {
    const column=rows[row].indexOf(code);
    if (column<0) continue;
    const u=(column+row*.3)/12;
    return {side:column<5?'left':'right',x:270+u*133+row*3,y:404+row*4-u*3};
  }
  return null;
}

export function heldHandTargets(pressed) {
  const result={left:{x:292,y:394,down:false},right:{x:366,y:394,down:false}};
  for (const code of pressed) {
    const target=keyTarget(code);
    if (target) result[target.side]={x:target.x,y:target.y,down:true};
  }
  return result;
}
