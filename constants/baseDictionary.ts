import type { SpeedCameraType, SpeedUnit, VoiceMode, RallyModifier, RallyCrest, RallyWarning } from '@/types/map';

export interface VoiceModeEntry {
  key: VoiceMode;
  label: string;
  description: string;
  accentColor: string;
}

export interface SpeedUnitEntry {
  key: SpeedUnit;
  label: string;
  suffix: string;
  conversionFactorToKmh: number;
}

export interface SpeedCameraTypeEntry {
  key: SpeedCameraType;
  label: string;
  description: string;
  badgeColor: string;
}

export interface RallyReferenceEntry {
  key: RallyModifier | RallyCrest | RallyWarning;
  label: string;
  recommendation: string;
}

export interface BaseDictionary {
  voiceModes: VoiceModeEntry[];
  speedUnits: SpeedUnitEntry[];
  speedCameraTypes: SpeedCameraTypeEntry[];
  rallyModifiers: RallyReferenceEntry[];
  rallyCrests: RallyReferenceEntry[];
  rallyWarnings: RallyReferenceEntry[];
}

export const BASE_DICTIONARY: BaseDictionary = {
  voiceModes: [
    {
      key: 'off',
      label: 'Muted',
      description: 'No voice prompts, visual cues only',
      accentColor: '#8E8E93',
    },
    {
      key: 'normal',
      label: 'Navigator',
      description: 'Classic turn-by-turn navigation',
      accentColor: '#007AFF',
    },
    {
      key: 'rally',
      label: 'Co-Driver',
      description: 'Aggressive rally-style pacenotes',
      accentColor: '#FF9500',
    },
  ],
  speedUnits: [
    {
      key: 'kmh',
      label: 'Kilometers per hour',
      suffix: 'km/h',
      conversionFactorToKmh: 1,
    },
    {
      key: 'mph',
      label: 'Miles per hour',
      suffix: 'mph',
      conversionFactorToKmh: 1.60934,
    },
  ],
  speedCameraTypes: [
    {
      key: 'fixed',
      label: 'Fixed Speed',
      description: 'Always-on camera mounted to infrastructure',
      badgeColor: '#FF9500',
    },
    {
      key: 'mobile',
      label: 'Mobile Tripod',
      description: 'Moveable enforcement with uncertain availability',
      badgeColor: '#FFCC00',
    },
    {
      key: 'red-light',
      label: 'Red Light',
      description: 'Triggers when crossing intersections on red',
      badgeColor: '#FF3B30',
    },
    {
      key: 'average-speed',
      label: 'Average Speed',
      description: 'Measures average speed between gantries',
      badgeColor: '#34C759',
    },
  ],
  rallyModifiers: [
    {
      key: 'tightens',
      label: 'Tightens',
      recommendation: 'Prepare to scrub speed mid-corner',
    },
    {
      key: 'opens',
      label: 'Opens',
      recommendation: 'Early apex is safe, unwind steering quickly',
    },
    {
      key: 'long',
      label: 'Long',
      recommendation: 'Hold steering input longer than usual',
    },
    {
      key: 'short',
      label: 'Short',
      recommendation: 'Expect rapid transition to next instruction',
    },
    {
      key: 'opens-long',
      label: 'Opens Long',
      recommendation: 'Stay on throttle, exit widens dramatically',
    },
    {
      key: 'tightens-into',
      label: 'Tightens Into',
      recommendation: 'Corner progressively sharpens before next call',
    },
  ],
  rallyCrests: [
    {
      key: 'crest',
      label: 'Crest',
      recommendation: 'Reduce steering input and let suspension settle',
    },
    {
      key: 'small-crest',
      label: 'Small Crest',
      recommendation: 'Light lift if visibility is limited',
    },
    {
      key: 'brow',
      label: 'Brow',
      recommendation: 'Stay centered, road falls away suddenly',
    },
    {
      key: 'dip',
      label: 'Dip',
      recommendation: 'Expect compression, be ready for rebound grip',
    },
  ],
  rallyWarnings: [
    {
      key: 'caution',
      label: 'Caution',
      recommendation: 'Moderate lift, surface risk ahead',
    },
    {
      key: 'danger',
      label: 'Danger',
      recommendation: 'Heavy brake, obstacle strongly advised',
    },
    {
      key: 'double-danger',
      label: 'Double Danger',
      recommendation: 'Maximum alert, severe penalty for mistakes',
    },
    {
      key: 'dont-cut',
      label: "Don’t Cut",
      recommendation: 'Inside hazards present, stay mid-lane',
    },
    {
      key: 'slippy',
      label: 'Slippy',
      recommendation: 'Feather throttle, gentle steering inputs',
    },
    {
      key: 'narrow',
      label: 'Narrow',
      recommendation: 'Reduce width usage, prepare for single line',
    },
  ],
};
