import {generateMap} from '../src/map.js';

// URLs are relative to the host page. Copy assets/map with exported map JSON.
export const woodlandArt={
 images:{
  meadow:{src:'./assets/map/terrain/meadow-v2.webp',width:512,height:512,anchorX:0,anchorY:0},
  road:{src:'./assets/map/terrain/road-v2.webp',width:384,height:384,anchorX:0,anchorY:0},
  water:{src:'./assets/map/terrain/water.webp',width:128,height:128,anchorX:0,anchorY:0},
  sand:{src:'./assets/map/terrain/sand.webp',width:128,height:128,anchorX:0,anchorY:0},
  oak:{src:'./assets/map/trees/oak.webp',width:100,height:91.39,anchorX:.52,anchorY:.9},
  fir:{src:'./assets/map/trees/fir.webp',width:74,height:111,anchorX:.505,anchorY:.915},
  birch:{src:'./assets/map/trees/birch.webp',width:78,height:93.6,anchorX:.455,anchorY:.92},
  boulder:{src:'./assets/map/rocks/mossy-boulder.webp',width:46,height:30.67,anchorX:.5,anchorY:.75},
  cluster:{src:'./assets/map/rocks/granite-cluster.webp',width:53,height:35.33,anchorX:.51,anchorY:.75},
  inn:{src:'./assets/map/buildings/woodland-inn.webp',width:184,height:151.28,anchorX:.534,anchorY:.753}
 },
 props:{tree:['oak','fir','birch'],rock:['boulder','cluster'],house:['inn']},
 terrain:{grass:'meadow',road:'road',water:'water',sand:'sand'}
};

export function withWoodlandArt(map){return {...map,art:map.art??structuredClone(woodlandArt)};}
export function createWoodlandMap(options){const map=generateMap({elevation:true,...options});map.tileSize={width:36,height:18};return withWoodlandArt(map);}
