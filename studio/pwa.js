export function installStudioPWA({button,notify}){
 let prompt;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;button.hidden=false;});
 button.onclick=async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;button.hidden=true;};
 window.addEventListener('appinstalled',()=>{button.hidden=true;notify('Studio installed. Open and save project files on this device.');});
 // Development modules must never be kept by a production service worker.
 if(!import.meta.env.PROD||!('serviceWorker' in navigator)||!window.isSecureContext)return;
 window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('studio-sw.js',new URL(import.meta.env.BASE_URL,location.href)),{scope:import.meta.env.BASE_URL}).then(registration=>{
  if(registration.waiting)notify('A Studio update is ready. Save your project and close all Studio tabs to apply it.');
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')notify(navigator.serviceWorker.controller?'A Studio update is ready. Save your project and close all Studio tabs to apply it.':'Studio is ready for offline use on this device.');});});
 }).catch(error=>console.warn('Studio offline support is unavailable:',error.message)),{once:true});
}
