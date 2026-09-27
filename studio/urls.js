/** Standalone Studio and demos are siblings; the combined development site is flat. */
export function demoURL(file,mode=import.meta.env?.MODE){return (mode==='studio'?'../demos/':'./')+file;}
