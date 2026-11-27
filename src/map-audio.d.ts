export interface MapAudioLevels {
  master: number; step: number;
  jumpTakeoff: number; jumpLand: number; vaultTakeoff: number; vaultLand: number;
  roll: number; rollRecover: number; climb: number; interact: number;
  wind: number; bird: number; river: number; waterfall: number;
  chicken: number; livestockPlaceholder: number;
}
export interface MapAudioMemory {sampleRate: number; buffers: number; seconds: number; samples: number; bytes: number; nodes: number}
export interface MapAudioCue {name: string; time: number; surface: string; gain: number; voice: number; placeholder: boolean}
export interface MapAudioActor {
  x: number; y: number; phase: number; gait: 'walk' | 'run'; gaitWeight: number;
  walking: boolean; running: boolean; skidding: boolean; jumping: boolean; rolling: boolean;
  traversalAction: string | null;
}
/** Live controller record. `actors` is read in place; `actorPosition` copies on every call. */
export interface MapAudioController {
  actors: {get(id: string): MapAudioActor | undefined};
  subscribe(listener: (event: MapAudioEvent) => void): () => void;
}
export interface MapAudioEvent {type: string; actor?: string; action?: string; [key: string]: unknown}
export interface MapAudioMap {
  width: number; height: number; terrain: ArrayLike<number>;
  terraces?: ReadonlyArray<unknown>;
  props: ReadonlyArray<{kind: string; x: number; y: number; width: number; height: number}>;
  actors: ReadonlyArray<{id: string; appearance?: {kind?: string}; npc?: {species?: string}}>;
  art?: {actors?: Record<string, {walk?: {frames?: number; image?: string}; run?: {frames?: number; image?: string}}>}
}
export interface MapAudioMountView {
  controller: MapAudioController;
  mapToScreen(point: {x: number; y: number}): {x: number; y: number};
}
export interface MapAudioHandle {
  readonly context: AudioContext | null;
  readonly running: boolean;
  readonly audio: MapAudio;
  recentCues(): MapAudioCue[];
  setVolume(value: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}
export const FOOT_CONTACTS: {readonly procedural: readonly number[]; readonly walk: readonly number[]; readonly run: readonly number[]};
export const MAP_AUDIO_LEVELS: Readonly<MapAudioLevels>;
export const MAP_AUDIO_NODES: number;
export const MAP_AUDIO_NODE_BUDGET: number;
export const MAP_EVENT_SOUNDS: Readonly<Record<string, string | null>>;
export const WATERFALL_NEAR: number;
export const WATERFALL_FAR: number;
export const RIVER_NEAR: number;
export const RIVER_FAR: number;
export const WATERFALL_CLUSTER: number;
export function mapAudioMemory(sampleRate?: number): MapAudioMemory;
export function terrainAt(map: {width: number; height: number; terrain: ArrayLike<number>}, x: number, y: number): number;
export function surfaceAt(map: {width: number; height: number; terrain: ArrayLike<number>}, x: number, y: number): 'grass' | 'road' | 'water' | 'sand';
export function footContactsFor(gait: 'walk' | 'run', clip?: {frames?: number; image?: string}): readonly number[];
export function footContactsCrossed(previous: number, next: number, contacts?: readonly number[]): number;
export function soundForMapEvent(event: {type?: string; action?: string}): string | null;
export function distanceGain(distance: number, near: number, far: number): number;
export function screenPan(sourceX: number, listenerX: number, viewWidth: number): number;
export function windShelter(distance: number): number;
export function housePoints(map: {props?: ReadonlyArray<{kind: string; x: number; y: number; width: number; height: number}>}): Array<{x: number; y: number}>;
export function nearestDistance(points: ReadonlyArray<{x: number; y: number}>, x: number, y: number): number;
export function nearestWaterInto(map: {width: number; height: number; terrain: ArrayLike<number>}, x: number, y: number, radius: number, out: {found: boolean; distance: number; x: number; y: number}): boolean;
export function waterfallSources(map: MapAudioMap): Array<{x: number; y: number}>;
export function clusterSources(points: ReadonlyArray<{x: number; y: number}>, radius?: number): Array<{x: number; y: number; count: number}>;
export function nearestInto(points: ReadonlyArray<{x: number; y: number}>, x: number, y: number, out: {index: number; distance: number}): boolean;
export function livestockRoster(actors: ReadonlyArray<{id: string; appearance?: {kind?: string}; npc?: {species?: string}}>): Array<{id: string; species: 'cow' | 'sheep' | 'chicken'}>;
export class MapAudio {
  constructor(options?: {volume?: number; muted?: boolean; createContext?: () => AudioContext});
  readonly volume: number;
  readonly muted: boolean;
  readonly enabled: boolean;
  readonly context: AudioContext | null;
  readonly running: boolean;
  readonly nodeCount: number;
  readonly bufferSamples: number;
  prime(phase: number): void;
  unlock(): Promise<boolean>;
  setVolume(value: number): void;
  setMuted(muted: boolean): void;
  handle(event: MapAudioEvent, playerId?: string): boolean;
  poll(actor: MapAudioActor, map: {width: number; height: number; terrain: ArrayLike<number>}, contacts?: readonly number[]): number;
  setAmbience(levels: {wind?: number; river?: number; riverPan?: number; fall?: number; fallPan?: number; birdAt?: number}): void;
  cueAnimal(species: string, closeness: number, pan: number): boolean;
  pause(): void;
  resume(): Promise<boolean>;
  recentCues(): MapAudioCue[];
  dispose(): void;
}
export function mountMapAudio(view: MapAudioMountView, map: MapAudioMap, options?: {playerId?: string; volume?: number; muted?: boolean}): MapAudioHandle;
