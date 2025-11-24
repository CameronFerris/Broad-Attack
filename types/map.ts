export interface Checkpoint {
  id: string;
  type: 'start' | 'finish';
  latitude: number;
  longitude: number;
  name: string;
}

export interface GhostPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface RunRecord {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  startCheckpoint: Checkpoint;
  finishCheckpoint: Checkpoint;
  averageSpeed: number;
  maxSpeed: number;
  date: string;
  courseId: string;
  lapNumber?: number;
  ghostPath?: GhostPoint[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export type SpeedUnit = 'mph' | 'kmh';

export type VoiceMode = 'off' | 'normal' | 'rally';

export interface UserLocationInfo {
  country: string | null;
  countryCode: string | null;
  speedUnit: SpeedUnit;
}

export type RallyCornerType = 
  | 'hairpin' | 'square' | 'acute' | 'kink' | 'chicane'
  | 'flat' | 'ballistic' | 'absolute';

export type RallyModifier = 
  | 'tightens' | 'opens' | 'long' | 'short' | 'very-long' | 'very-short'
  | 'plus' | 'minus' | 'tightens-over-crest' | 'tightens-into'
  | 'opens-long';

export type RallyCrest = 
  | 'crest' | 'small-crest' | 'big-crest' | 'flat-crest'
  | 'jump' | 'jump-maybe' | 'brow' | 'bump' | 'dip';

export type RallyWarning = 
  | 'caution' | 'danger' | 'double-danger' | 'care' 
  | 'dont-cut' | 'cut' | 'small-cut' | 'big-cut'
  | 'slippy' | 'rough' | 'very-rough' | 'narrow' | 'very-narrow';

export interface RallyPacenote {
  severity: number;
  direction: 'left' | 'right';
  cornerType?: RallyCornerType;
  modifier?: RallyModifier;
  crest?: RallyCrest;
  warning?: RallyWarning;
  distance?: number;
  distanceToNext?: number;
}

export interface RoadSegment {
  latitude: number;
  longitude: number;
  bearing: number;
  distanceFromStart: number;
}

export interface UpcomingTurn {
  type: 'left' | 'right' | 'straight';
  severity: number;
  distance: number;
  angle: number;
  description: string;
}

export interface NavigationInstruction {
  type: 'turn' | 'straight' | 'finish';
  severity?: number;
  direction?: 'left' | 'right';
  distance: number;
  heading: number;
  rallyPacenote?: RallyPacenote;
  upcomingTurns?: UpcomingTurn[];
  nextTurnDescription?: string;
}

export type SpeedCameraType = 'fixed' | 'mobile' | 'red-light' | 'average-speed';

export interface SpeedCamera {
  id: string;
  type: SpeedCameraType;
  latitude: number;
  longitude: number;
  speedLimit?: number;
  name?: string;
}

export interface RouteOption {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  distance: number;
  duration: number;
  isMainRoute: boolean;
}

export interface ActiveRunPath {
  coordinates: { latitude: number; longitude: number }[];
  startTime: number;
}
