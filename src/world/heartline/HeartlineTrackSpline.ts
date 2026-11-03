import * as THREE from 'three';

export type HeartlineZoneId =
  | 'STATION'
  | 'DEPARTURE'
  | 'CLIMB'
  | 'CREST_APPROACH'
  | 'CREST_REVEAL'
  | 'MAJOR_DROP'
  | 'CASTLE_FLYBY'
  | 'CRYSTAL_TUNNEL'
  | 'HEARTLINE_ENTRY'
  | 'LOW_SPEED_RUN'
  | 'FINAL_HELIX'
  | 'BRAKE_RUN'
  | 'STATION_RETURN';

export interface TrackZoneDescriptor {
  id: HeartlineZoneId;
  uStart: number;
  uEnd: number;
  label: string;
  targetFov: number;
  horizonLockFactor: number;
  shakeStrength: number;
}

export interface HeartlineTrackFrame {
  u: number;
  s: number;
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  rollRad: number;
  zone: TrackZoneDescriptor;
}

export const HEARTLINE_TRACK_ZONES: readonly TrackZoneDescriptor[] = [
  {
    id: 'STATION',
    uStart: 0.0,
    uEnd: 0.04,
    label: 'Sapphire & Pearl Station',
    targetFov: 50,
    horizonLockFactor: 1.0,
    shakeStrength: 0.0,
  },
  {
    id: 'DEPARTURE',
    uStart: 0.04,
    uEnd: 0.09,
    label: 'Station Departure',
    targetFov: 53,
    horizonLockFactor: 0.85,
    shakeStrength: 0.05,
  },
  {
    id: 'CLIMB',
    uStart: 0.09,
    uEnd: 0.215,
    label: '45m Sapphire Lift Hill',
    targetFov: 56,
    horizonLockFactor: 0.8,
    shakeStrength: 0.04,
  },
  {
    id: 'CREST_APPROACH',
    uStart: 0.215,
    uEnd: 0.24,
    label: 'Summit Approach',
    targetFov: 53,
    horizonLockFactor: 0.9,
    shakeStrength: 0.02,
  },
  {
    id: 'CREST_REVEAL',
    uStart: 0.24,
    uEnd: 0.31,
    label: 'Love Reveal Crest (45m)',
    targetFov: 52,
    horizonLockFactor: 0.95,
    shakeStrength: 0.01,
  },
  {
    id: 'MAJOR_DROP',
    uStart: 0.31,
    uEnd: 0.44,
    label: '62° Major Drop',
    targetFov: 68,
    horizonLockFactor: 0.35,
    shakeStrength: 0.18,
  },
  {
    id: 'CASTLE_FLYBY',
    uStart: 0.44,
    uEnd: 0.54,
    label: 'Dream Castle Flyby',
    targetFov: 62,
    horizonLockFactor: 0.45,
    shakeStrength: 0.1,
  },
  {
    id: 'CRYSTAL_TUNNEL',
    uStart: 0.54,
    uEnd: 0.64,
    label: 'Gemstone Crystal Tunnel',
    targetFov: 56,
    horizonLockFactor: 0.4,
    shakeStrength: 0.08,
  },
  {
    id: 'HEARTLINE_ENTRY',
    uStart: 0.64,
    uEnd: 0.75,
    label: 'Signature Heartline Element',
    targetFov: 64,
    horizonLockFactor: 0.3,
    shakeStrength: 0.15,
  },
  {
    id: 'LOW_SPEED_RUN',
    uStart: 0.75,
    uEnd: 0.83,
    label: 'Botanical Garden Speed Run',
    targetFov: 65,
    horizonLockFactor: 0.5,
    shakeStrength: 0.14,
  },
  {
    id: 'FINAL_HELIX',
    uStart: 0.83,
    uEnd: 0.92,
    label: 'Final Panoramic Helix',
    targetFov: 58,
    horizonLockFactor: 0.65,
    shakeStrength: 0.05,
  },
  {
    id: 'BRAKE_RUN',
    uStart: 0.92,
    uEnd: 0.97,
    label: 'World Reveal & Brake Run',
    targetFov: 54,
    horizonLockFactor: 0.9,
    shakeStrength: 0.02,
  },
  {
    id: 'STATION_RETURN',
    uStart: 0.97,
    uEnd: 1.0,
    label: 'Station Arrival',
    targetFov: 50,
    horizonLockFactor: 1.0,
    shakeStrength: 0.0,
  },
];

// Canonical World Anchor Coordinates for the Northeast Spectacular Thrill Zone Precinct
export const LOVE_MEADOW_CENTER = new THREE.Vector3(98.0, 13.2, 96.0);
export const DREAM_CASTLE_SPIRE_TARGET = new THREE.Vector3(88.0, 28.0, 18.0);
export const STATION_BOARDING_POS = new THREE.Vector3(78.0, 12.85, 70.8);
export const STATION_EXIT_POS = new THREE.Vector3(78.0, 12.85, 65.2);
export const TICKET_BOOTH_POS = new THREE.Vector3(63.0, 12.5, 57.0);
export const ENTRANCE_ARCH_POS = new THREE.Vector3(54.0, 12.5, 48.0);
export const VIEWING_DECK_POS = new THREE.Vector3(73.5, 13.3, 77.5);
export const CRYSTAL_TUNNEL_CENTER = new THREE.Vector3(96.0, 14.2, 69.5);

export interface ControlPointSpec {
  x: number;
  y: number;
  z: number;
  rollDeg: number;
}

/**
 * 36 surveyed 3D control points matching the "Track Layout (Top View)" and "Full Attraction Overview" blueprints:
 * - Station at (78, 13.15, 68) oriented East-West.
 * - Sweeping Lift Hill ascending to 45m above the meadow (Y = 57.5m) along the Northern ridge.
 * - Love Reveal Crest directly overlooking the oval "I LOVE YOU ❤️" meadow at (98, 13.2, 96).
 * - Steep 62° Major Drop + camelback wave sweeping into the elevated Castle Flyby (safe outside Dream Castle (88, 18)).
 * - Arched Gemstone Crystal Tunnel over the stone bridge & reflective stream at (96, 14.2, 69.5).
 * - Iconic upright 3D Heartline Element silhouette (twin upper lobes + central heart cusp dip).
 * - Low Garden Speed Run slalom leading into the rising Final Helix on the West flank and straight Magnetic Brake Run.
 */
const CONTROL_POINT_SPECS: readonly ControlPointSpec[] = [
  // Zone 1: Station (collinear along +X at Z = 68.0, Y = 13.15)
  { x: 78.0, y: 13.15, z: 68.0, rollDeg: 0 }, // 0: Station Center (s = 0)
  { x: 85.0, y: 13.15, z: 68.0, rollDeg: 0 }, // 1: Station Departure Threshold

  // Zone 2: Departure Curve (sweeping out and around toward the West/North-West Lift Hill base)
  { x: 92.0, y: 13.6, z: 70.5, rollDeg: 10 }, // 2: Departure Beacon 1-3
  { x: 93.5, y: 14.8, z: 78.5, rollDeg: 14 }, // 3: Departure Beacon 4-5
  { x: 84.0, y: 17.5, z: 86.0, rollDeg: 10 }, // 4: Turn toward Lift Hill Base

  // Zone 3: 45m Lift Hill Climb (ascending along the NW -> North perimeter)
  { x: 70.0, y: 24.5, z: 94.0, rollDeg: 4 }, // 5: Lower Lift Hill
  { x: 66.0, y: 35.0, z: 106.0, rollDeg: 0 }, // 6: Mid Lift Hill (Scenic Overlook)
  { x: 72.0, y: 46.5, z: 116.0, rollDeg: -5 }, // 7: Upper Lift Hill
  { x: 82.0, y: 55.2, z: 121.0, rollDeg: -8 }, // 8: Crest Approach (u ~ 0.22)

  // Zone 4: 45m Love Reveal Crest (Y = 57.5m, looking down South at "I LOVE YOU ❤️" Meadow (98, 13.2, 96))
  { x: 91.0, y: 57.4, z: 122.0, rollDeg: -7 }, // 9: Crest Reveal Start
  { x: 99.0, y: 57.6, z: 121.8, rollDeg: -6 }, // 10: Crest Reveal Center (45m above Meadow)
  { x: 108.0, y: 56.8, z: 119.5, rollDeg: -9 }, // 11: Crest Exit Trigger

  // Zone 5: 62° Major Drop & Camelback Wave
  { x: 118.0, y: 41.5, z: 110.0, rollDeg: -16 }, // 12: Steep 62° First Drop Dive
  { x: 126.0, y: 21.0, z: 96.0, rollDeg: -26 }, // 13: Drop Valley Pullout
  { x: 128.0, y: 28.5, z: 83.0, rollDeg: -14 }, // 14: Secondary Airtime Crest (per Overview image)
  { x: 127.0, y: 17.0, z: 69.0, rollDeg: -34 }, // 15: High-Speed Banked Valley

  // Zone 6: Dream Castle Approach & Sweeping Elevated Flyby (Dream Castle is at (88, 18))
  { x: 120.0, y: 24.5, z: 54.0, rollDeg: 28 }, // 16: Castle Approach Ascent
  { x: 106.0, y: 27.5, z: 46.5, rollDeg: 35 }, // 17: Castle Flyby Apex (grand vista of Castle spires)
  { x: 92.0, y: 21.0, z: 50.0, rollDeg: 22 }, // 18: Castle Flyby Sweep Away

  // Zone 7: Gemstone Crystal Tunnel (curving across the stone bridge & reflective pond)
  { x: 87.5, y: 14.8, z: 60.5, rollDeg: -10 }, // 19: Crystal Tunnel West Portal
  { x: 96.0, y: 14.2, z: 69.5, rollDeg: 8 }, // 20: Crystal Tunnel Gemstone Heart
  { x: 105.5, y: 15.0, z: 77.5, rollDeg: -12 }, // 21: Crystal Tunnel East Emergence

  // Zone 8: Signature 3D Heartline Element (sculpted upright tilted Heart Loop silhouette!)
  { x: 115.0, y: 17.5, z: 73.0, rollDeg: 24 }, // 22: Heartline Bottom Stem Entry
  { x: 123.5, y: 26.5, z: 78.5, rollDeg: 38 }, // 23: Heartline Left/North Upper Lobe Rise
  { x: 120.0, y: 32.5, z: 72.0, rollDeg: 28 }, // 24: Heartline Left/North Lobe Peak
  { x: 117.5, y: 27.8, z: 66.0, rollDeg: 0 }, // 25: Heartline Top Center Cusp Dip (Heart Indentation!)
  { x: 120.5, y: 32.8, z: 59.5, rollDeg: -28 }, // 26: Heartline Right/South Lobe Peak
  { x: 124.0, y: 25.5, z: 54.5, rollDeg: -38 }, // 27: Heartline Right/South Lobe Descent
  { x: 114.5, y: 16.5, z: 56.5, rollDeg: 18 }, // 28: Heartline Bottom Point Exit

  // Zone 9: Low-Level Botanical Garden Speed Run (passing over Queue Bridge & Reflective Stream)
  { x: 101.0, y: 14.2, z: 59.0, rollDeg: -16 }, // 29: Flower & Crystal Garden Slalom
  { x: 84.0, y: 16.4, z: 75.0, rollDeg: 16 }, // 30: Signature Coaster Bridge over Queue Garden
  { x: 70.0, y: 15.2, z: 84.0, rollDeg: -20 }, // 31: Reflective Stream & Stone Garden Run

  // Zone 10: Final Rising Panoramic Helix (with distant callback view of Love Meadow)
  { x: 56.5, y: 20.5, z: 85.0, rollDeg: -30 }, // 32: Final Helix North Entry
  { x: 49.5, y: 24.8, z: 75.5, rollDeg: -32 }, // 33: Final Helix West Apex (Panoramic World Reveal)
  { x: 54.5, y: 18.2, z: 68.0, rollDeg: -15 }, // 34: Final Helix Exit

  // Zone 11 & 12: Magnetic Brake Run & Station Return (collinear along +X at Z = 68.0, Y = 13.15)
  { x: 66.0, y: 13.15, z: 68.0, rollDeg: 0 }, // 35: Straight Magnetic Brake Run
];

const LUT_SAMPLES = 2048;

const _worldUp = new THREE.Vector3(0, 1, 0);
const _scratchPtA = new THREE.Vector3();
const _scratchPtB = new THREE.Vector3();
const _scratchTan = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchBaseNormal = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();

export interface HeartlineTrackSpline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly totalLength: number;
  readonly lutCount: number;
  readonly controlPoints: readonly ControlPointSpec[];
  sToU: (s: number) => number;
  uToS: (u: number) => number;
  getZoneAtU: (u: number) => TrackZoneDescriptor;
  evaluateAtS: (s: number, outFrame: HeartlineTrackFrame) => HeartlineTrackFrame;
  evaluateAtU: (u: number, outFrame: HeartlineTrackFrame) => HeartlineTrackFrame;
}

export function createHeartlineTrackSpline(): HeartlineTrackSpline {
  const points = CONTROL_POINT_SPECS.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);

  const cumLengths = new Float32Array(LUT_SAMPLES + 1);
  cumLengths[0] = 0;
  curve.getPoint(0, _scratchPtA);

  let runningLen = 0;
  for (let i = 1; i <= LUT_SAMPLES; i++) {
    const u = i / LUT_SAMPLES;
    curve.getPoint(u, _scratchPtB);
    runningLen += _scratchPtA.distanceTo(_scratchPtB);
    cumLengths[i] = runningLen;
    _scratchPtA.copy(_scratchPtB);
  }
  const totalLength = runningLen;

  const uniformSToU = new Float32Array(LUT_SAMPLES + 1);
  let searchIdx = 0;
  for (let i = 0; i <= LUT_SAMPLES; i++) {
    const targetS = (i / LUT_SAMPLES) * totalLength;
    while (searchIdx < LUT_SAMPLES && cumLengths[searchIdx + 1] < targetS) {
      searchIdx++;
    }
    const s0 = cumLengths[searchIdx];
    const s1 = cumLengths[searchIdx + 1];
    const frac = s1 > s0 ? (targetS - s0) / (s1 - s0) : 0;
    uniformSToU[i] = (searchIdx + frac) / LUT_SAMPLES;
  }

  function wrapS(s: number): number {
    let r = s % totalLength;
    if (r < 0) r += totalLength;
    return r;
  }

  function wrapU(u: number): number {
    let r = u % 1.0;
    if (r < 0) r += 1.0;
    return r;
  }

  function sToU(s: number): number {
    const ws = wrapS(s);
    const fIdx = (ws / totalLength) * LUT_SAMPLES;
    const i0 = Math.min(LUT_SAMPLES - 1, Math.max(0, Math.floor(fIdx)));
    const frac = fIdx - i0;
    return uniformSToU[i0] + (uniformSToU[i0 + 1] - uniformSToU[i0]) * frac;
  }

  function uToS(u: number): number {
    const wu = wrapU(u);
    const fIdx = wu * LUT_SAMPLES;
    const i0 = Math.min(LUT_SAMPLES - 1, Math.max(0, Math.floor(fIdx)));
    const frac = fIdx - i0;
    return cumLengths[i0] + (cumLengths[i0 + 1] - cumLengths[i0]) * frac;
  }

  function sampleRollRadAtU(u: number): number {
    const wu = wrapU(u);
    const n = CONTROL_POINT_SPECS.length;
    const scaled = wu * n;
    const i0 = Math.floor(scaled) % n;
    const i1 = (i0 + 1) % n;
    const t = scaled - Math.floor(scaled);
    const st = t * t * (3 - 2 * t);
    const r0 = CONTROL_POINT_SPECS[i0].rollDeg;
    const r1 = CONTROL_POINT_SPECS[i1].rollDeg;
    return THREE.MathUtils.degToRad(r0 + (r1 - r0) * st);
  }

  function getZoneAtU(u: number): TrackZoneDescriptor {
    const wu = wrapU(u);
    for (let i = 0; i < HEARTLINE_TRACK_ZONES.length; i++) {
      const z = HEARTLINE_TRACK_ZONES[i];
      if (wu >= z.uStart && wu <= z.uEnd) {
        return z;
      }
    }
    return HEARTLINE_TRACK_ZONES[0];
  }

  function evaluateAtU(u: number, outFrame: HeartlineTrackFrame): HeartlineTrackFrame {
    const wu = wrapU(u);
    outFrame.u = wu;
    outFrame.s = uToS(wu);
    outFrame.zone = getZoneAtU(wu);

    curve.getPoint(wu, outFrame.pos);
    curve.getTangent(wu, _scratchTan).normalize();
    outFrame.tangent.copy(_scratchTan);

    _scratchRight.crossVectors(_scratchTan, _worldUp);
    if (_scratchRight.lengthSq() < 1e-5) {
      _scratchRight.set(1, 0, 0);
    } else {
      _scratchRight.normalize();
    }
    _scratchBaseNormal.crossVectors(_scratchRight, _scratchTan).normalize();

    const rollRad = sampleRollRadAtU(wu);
    outFrame.rollRad = rollRad;

    _scratchQuat.setFromAxisAngle(_scratchTan, rollRad);
    outFrame.normal.copy(_scratchBaseNormal).applyQuaternion(_scratchQuat).normalize();
    outFrame.binormal.crossVectors(outFrame.tangent, outFrame.normal).normalize();

    return outFrame;
  }

  function evaluateAtS(s: number, outFrame: HeartlineTrackFrame): HeartlineTrackFrame {
    const ws = wrapS(s);
    const u = sToU(ws);
    evaluateAtU(u, outFrame);
    outFrame.s = ws;
    return outFrame;
  }

  return {
    curve,
    totalLength,
    lutCount: LUT_SAMPLES,
    controlPoints: CONTROL_POINT_SPECS,
    sToU,
    uToS,
    getZoneAtU,
    evaluateAtS,
    evaluateAtU,
  };
}

export function createEmptyTrackFrame(): HeartlineTrackFrame {
  return {
    u: 0,
    s: 0,
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(1, 0, 0),
    normal: new THREE.Vector3(0, 1, 0),
    binormal: new THREE.Vector3(0, 0, 1),
    rollRad: 0,
    zone: HEARTLINE_TRACK_ZONES[0],
  };
}
