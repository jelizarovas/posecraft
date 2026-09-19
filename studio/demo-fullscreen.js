/** Keep the running player mounted while entering native or in-page fullscreen. */
export function mountDemoFullscreen(player, button) {
  const doc=player.ownerDocument;
  let active=false,busy=false,native=false,previousFocus=null;
  const outside=new Map();
  // Inline Material fullscreen glyphs also work with the site's subset icon font.
  const setIcon=value=>{button.innerHTML=`<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${value?'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z':'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'}"/></svg>`;};
  setIcon(false);
  function update(value) {
    active=value;
    player.classList.toggle('demo-fullscreen',value);
    button.setAttribute('aria-pressed',String(value));
    button.setAttribute('aria-label',value?'Exit fullscreen':'Enter fullscreen');
    button.title=value?'Exit fullscreen':'Enter fullscreen';
    setIcon(value);
    if(value){
      previousFocus=doc.activeElement;
      for(let node=player;node.parentElement&&node!==doc.body;node=node.parentElement){
        for(const sibling of node.parentElement.children){
          if(sibling!==node){outside.set(sibling,sibling.inert);sibling.inert=true;}
        }
      }
      button.focus({preventScroll:true});
    }else{
      for(const [element,inert] of outside)element.inert=inert;
      outside.clear();
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    }
  }
  const fullscreenElement=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
  async function toggle(){
    if(busy)return;
    busy=true;
    try{
      if(active){
        const exit=doc.exitFullscreen||doc.webkitExitFullscreen;
        if(fullscreenElement()===player&&exit){
          try{await exit.call(doc);}catch{return;}
        }
        native=false;update(false);
      }else{
        update(true);
        const request=player.requestFullscreen||player.webkitRequestFullscreen;
        if(request){
          try{await request.call(player);native=fullscreenElement()===player;}
          catch{native=false;} // iPhone/embedded browsers retain the full-viewport player.
        }
      }
    }finally{busy=false;}
  }
  function changed(){
    if(fullscreenElement()===player)native=true;
    else if(native){native=false;if(active)update(false);}
  }
  button.addEventListener('click',toggle);
  doc.addEventListener('fullscreenchange',changed);
  doc.addEventListener('webkitfullscreenchange',changed);
  doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active&&!fullscreenElement()){
      event.preventDefault();native=false;update(false);
    }
  });
}
