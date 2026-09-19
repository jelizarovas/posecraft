export interface MapPoint { x: number; y: number }
export interface MapRect extends MapPoint { width: number; height: number }
export interface MapProp extends MapRect { id: string; kind: 'tree' | 'rock' | 'chest' | 'house' }
export interface MapActor extends MapPoint { id: string; speed: number; color?: string }
export interface MapDocument {
  format: 'posecraft-map'; version: 1; id: string; name: string;
  width: number; height: number; seed: number;
  tileSize: { width: number; height: number };
  /** Row-major values: 0 grass, 1 path, 2 impassable water, 3 sand. */
  terrain: number[];
  props: MapProp[];
  actors: MapActor[];
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
export function generateMap(options?: { width?: number; height?: number; seed?: number }): MapDocument;
export function projectMap(map: MapDocument, point: MapPoint): MapPoint;
export function unprojectMap(map: MapDocument, point: MapPoint): MapPoint;
/** Static terrain and prop index. Rebuild after terrain or footprint edits. */
export class MapIndex {
  constructor(map: MapDocument, options?: { chunkSize?: number });
  readonly map: MapDocument;
  readonly chunkSize: number;
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
