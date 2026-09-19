import type {MapDocument, MapPoint} from './map.js';
import {MapController} from './map-runtime.js';

export interface MapViewSnapshot {
  format: 'posecraft-map-view-state'; version: 1;
  camera: {x: number; y: number; zoom: number};
  scene: ReturnType<MapController['snapshot']>;
}
export interface MapViewStats {
  visibleTiles: number; visibleProps: number; visibleActors: number;
  candidateActors: number; candidateRouteSegments: number;
  occlusionCandidates: number; maskedActors: number; scratchPixels: number;
  art: {requested: number; loaded: number; failed: number};
  totalTiles: number; totalProps: number; drawnFrames: number;
  terrainBuilds: number; sceneryBuilds: number; paintMs: number;
  terrainCache: {tiles: number; pixels: number; materials: number; builds: number; pending: boolean; maxPixels: number; rasterScale: number; chunks: number; completed: number; tilePixels: number; tileBuilds: number; visibleChunks: number; workingSetPixels: number};
  backingWidth: number; backingHeight: number;
  camera: {x: number; y: number; zoom: number};
  visitedChunks: number; candidateTiles: number; candidateProps: number;
}
export interface MapView {
  controller: MapController;
  /** Settles after referenced image loads finish; failed images use fallback art and call onError. */
  ready: Promise<void>;
  moveTo: MapController['moveTo'];
  /** Center the camera on continuous grid coordinates. */
  panTo(x: number, y: number): void;
  /** Zoom is clamped to 0.45–2.5. */
  zoomTo(value: number): void;
  /** Recenter once; does not lock the camera to the actor. */
  focusActor(id: string): void;
  /** Coordinates relative to the canvas, in CSS pixels. */
  screenToMap(x: number, y: number): MapPoint;
  mapToScreen(point: MapPoint): MapPoint;
  snapshot(): MapViewSnapshot;
  restore(state: MapViewSnapshot): Promise<void>;
  play(): void; pause(): void;
  stats(): Partial<MapViewStats>;
  dispose(): void;
}
export function mountMap(element: HTMLElement, map: MapDocument, options?: {
  onEvent?: NonNullable<ConstructorParameters<typeof MapController>[1]>['onEvent'];
  onError?: (error: Error) => void;
  execution?: 'worker' | 'main';
  autoplay?: boolean;
  reducedMotion?: boolean | 'system';
}): MapView;
