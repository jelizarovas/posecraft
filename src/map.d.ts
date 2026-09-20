export interface MapPoint { x: number; y: number }
export interface MapRect extends MapPoint { width: number; height: number }
export interface MapTerrace extends MapRect {id:string;heightOffset:number}
export interface MapCollisionRect extends MapRect {shape:'rect'}
export interface MapCollisionCircle extends MapPoint {shape:'circle';radius:number}
export type MapPropCollision =
  | {shape:'none'}
  | {shape:'circle';radius:number;x?:number;y?:number}
  | MapCollisionRect
  | {shape:'compound';parts:Array<MapCollisionRect|MapCollisionCircle>};
export interface MapProp extends MapRect {
  id: string;
  kind: 'tree' | 'rock' | 'chest' | 'house' | 'decoration';
  /** An image ID in MapArt.images. Overrides the kind's seeded art binding. */
  art?: string;
  /** Shared fence graph in prop-local cell coordinates. Links are axis-aligned node-index pairs. */
  fence?:{nodes:MapPoint[];links:Array<[number,number]>};
  /** Local cell-space ground shapes. Omitted means the full footprint, except decoration defaults to nonblocking. */
  collision?:MapPropCollision;
  /** `low-foliage` uses art to cover an actor's lower body in this footprint; `ground` always stays under actors. */
  occlusion?:{mode:'low-foliage';lowerBodyFraction?:number}|{mode:'ground'};
  /** Authored crossing. Click endpoints use prop-local cell coordinates. */
  traversal?:{kind:'vault'|'climb';activation?:'auto'|'click';height:number;endpoints?:[MapPoint,MapPoint];style?:'rock'|'branch'};
}
export interface MapActor extends MapPoint {
 id:string;name?:string;speed:number;color?:string;stride?:number;
 appearance?:{kind:'livestock';image:string;scale?:number}|{kind:'villager';palette:string;skin?:string;hat?:'none'|'straw'|'cap'|'hood';scale?:number};
 npc?:{species:'human'|'child'|'sheep'|'cow'|'chicken';role?:'farmer'|'carrier'|'herder'|'villager';home:MapRect};
}
export interface MapBird {id:string;species:'crow'|'eagle';home:MapPoint&{z:number};radius:number;seed?:number;roost?:'nest'|'branch'|'rock'}
export interface MapSpriteClip {image:string;frames:number;directions:number;frameWidth:number;frameHeight:number;supportAnchors?:MapPoint[]|Array<Array<MapPoint|null>>;supportWindow?:[number,number]}
export interface MapImage {
  /** Optional opened-state image ID, sharing this image's dimensions and ground anchor. */
  opened?: string;
  /** Relative or HTTPS URL. HTTP is allowed for localhost development. */
  src: string;
  /** Positive pixels at a 64-pixel tile width, at most 1024 on either axis. */
  width: number; height: number;
  /** Ground anchor as a fraction of image dimensions, between zero and one. */
  anchorX: number; anchorY: number;
}
export interface MapArt {
  /** Direction rows, animation frame columns. Images describe a single frame's display size. */
  actors?:Record<string,{idle:MapSpriteClip;walk:MapSpriteClip;run:MapSpriteClip;jump?:MapSpriteClip;roll?:MapSpriteClip;vault?:MapSpriteClip;climbUp?:MapSpriteClip;climbDown?:MapSpriteClip}>;
  /** At most 64 images. All referenced image IDs must exist. */
  images: Record<string, MapImage>;
  /** Seeded stable variants for each prop kind. */
  props?: Partial<Record<MapProp['kind'], string[]>>;
  /** Ground-plane textures clipped to tiles. Image dimensions control repeat scale; anchors are unused. */
  terrain?: Partial<Record<'grass' | 'road' | 'water' | 'sand', string>>;
}
export interface MapDocument {
  format: 'posecraft-map'; version: 1; id: string; name: string;
  width: number; height: number; seed: number;
  tileSize: { width: number; height: number };
  /** Optional quarter-cell navigation with exact destinations and authored footprint shapes. */
  navigation?:{mode:'continuous';radius:number};
  /** Row-major values: 0 grass, 1 path, 2 impassable water, 3 sand. */
  terrain: number[];
  /** Sparse row-major tile index to MapArt.images ID. Visual only; logical terrain stays in terrain. */
  groundPaint?:Record<string,string>;
  /** Optional row-major grid vertices, (width+1)*(height+1). Units are tile-height pixels upward.
   * Heights lie between -16 and 16; adjacent vertices differ by at most 0.4. */
  elevations?: number[];
  /** Cell-aligned plateaus. Overlaps use the greatest integer heightOffset, from 1 through 16. */
  terraces?:MapTerrace[];
  props: MapProp[];
  actors: MapActor[];
  /** Independent aerial actors. home.z is an absolute terrain-height unit. */
  birds?:MapBird[];
  art?: MapArt;
}
export interface VisibleMap {
  tiles: Array<{ x: number; y: number; terrain: number }>;
  props: MapProp[];
  stats: { visitedChunks: number; candidateTiles: number; candidateProps: number };
}
export interface MapPathResult {
  status: 'pending' | 'complete' | 'failed';
  /** Includes the start and destination cell centers. Null until complete. */
  path: MapPoint[] | null;
  reason: 'blocked-start' | 'blocked-target' | 'search-limit' | 'unreachable' | null;
  visited: number;
}
export function assertMap(map: unknown): MapDocument;
export function generateMap(options?: { width?: number; height?: number; seed?: number; elevation?: boolean }): MapDocument;
/** Piecewise-linear height using each cell's NW-SE diagonal; edge heights extend outside the map. */
export function groundHeight(map: MapDocument, point: MapPoint): number;
export function terrainHeightOffset(map:MapDocument,point:MapPoint):number;
export function terrainTileCorners(map:MapDocument,x:number,y:number):Array<MapPoint&{z:number}>;
export function cliffFaces(map:MapDocument,bounds?:MapRect):Array<{x:number;y:number;edge:'north'|'east'|'south'|'west';heightOffset:number;neighborHeightOffset:number;top:Array<MapPoint&{z:number}>;bottom:Array<MapPoint&{z:number}>}>;
export function cliffGroundPick(map:MapDocument,point:MapPoint):MapPoint|null;
/** Uses terrain height unless point.z explicitly supplies a height in the same units. */
export function projectMap(map: MapDocument, point: MapPoint & { z?: number }): MapPoint;
/** Picks the unique continuous ground point under a projected pixel, including hills and dips. */
export function unprojectMap(map: MapDocument, point: MapPoint): MapPoint;
/** Static terrain and prop index. Rebuild after terrain or footprint edits. */
export class MapIndex {
  constructor(map: MapDocument, options?: { chunkSize?: number });
  readonly map: MapDocument;
  readonly chunkSize: number;
  readonly minElevation: number;
  readonly maxElevation: number;
  isBlocked(x: number, y: number): boolean;
  isPointBlocked(x:number,y:number,radius?:number):boolean;
  propsAt(x:number,y:number):MapProp[];
  prop(id: string): MapProp | undefined;
  /** Projected world-pixel viewport. Includes conservative tall-prop bounds. */
  visible(rect: MapRect, overscan?: number): VisibleMap;
}
/** Houses use central +Y entrance cells; other props use any free footprint edge. */
export function approachTiles(map: MapDocument, index: MapIndex, prop: MapProp): MapPoint[];
export class MapPathJob {
  constructor(map: MapDocument, index: MapIndex, start: MapPoint, goals: MapPoint | MapPoint[], options?: { diagonal?: boolean; maxVisited?: number });
  readonly result: MapPathResult;
  /** At most budget heap entries processed per call, including stale entries. */
  step(budget?: number): MapPathResult;
}
