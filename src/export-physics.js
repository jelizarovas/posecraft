import {mountScene} from './browser.js';
/** Physical scenes retain the full player. Cross-origin hosted modules use the main thread because browsers reject a cross-origin Worker URL. */
export function mountExport(element,document,options={}){const execution=options.execution??(new URL(import.meta.url).origin===globalThis.location.origin?'worker':'main');return mountScene(element,document,{...options,execution});}
