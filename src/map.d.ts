export interface MapPoint { x: number; y: number }
export interface MapRect extends MapPoint { width: number; height: number }
export interface MapProp extends MapRect { id: string; kind: 'tree' | 'rock' | 'chest' | 'house' }
export interface MapActor extends MapPoint { id: string; speed: number; color?: string }
export interface MapImage {
  /** Relative or HTTPS URL. HTTP is allowed for localhost development. */
  src: string;
  /** Positive pixels at a 64-pixel tile width, at most 1024 on either axis. */
  width: number; height: number;
  /** Ground anchor as a fraction of image dimensions, between zero and one. */
  anchorX: number; anchorY: number;
}
export interface MapArt {
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
  /** Row-major values: 0 grass, 1 path, 2 impassable water, 3 sand. */
  terrain: number[];
  /** Optional row-major grid vertices, (width+1)*(height+1). Units are tile-height pixels upward.
   * Heights lie between -16 and 16; adjacent vertices differ by at most 0.4. */
  elevations?: number[];
  props: MapProp[];
  actors: MapActor[];
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
