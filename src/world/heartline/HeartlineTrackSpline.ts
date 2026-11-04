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
    uEnd: 0.65,
    label: 'Underwater Coral Reef Journey',
    targetFov: 58,
    horizonLockFactor: 0.72,
    shakeStrength: 0.04,
  },
  {
    id: 'HEARTLINE_ENTRY',
    uStart: 0.65,
    uEnd: 0.76,
    label: 'Underwater Heartline — I LOVE YOU ❤️',
    targetFov: 60,
    horizonLockFactor: 0.78,
    shakeStrength: 0.04,
  },
  {
    id: 'LOW_SPEED_RUN',
    uStart: 0.76,
    uEnd: 0.83,
    label: 'Final Reef & Open Sky Emergence',
    targetFov: 62,
    horizonLockFactor: 0.68,
    shakeStrength: 0.08,
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

// Canonical World Anchor Coordinates for the Northeast Spectacular Thrill Zone Precinct (strictly z >= 65.0, clear of Castle Rear Garden z <= 56.5)
export const LOVE_MEADOW_CENTER = new THREE.Vector3(90.0, 17.6, 110.0);
export const DREAM_CASTLE_SPIRE_TARGET = new THREE.Vector3(88.0, 28.0, 18.0);
export const STATION_BOARDING_POS = new THREE.Vector3(70.0, 12.85, 80.8);
export const STATION_EXIT_POS = new THREE.Vector3(70.0, 12.85, 75.2);
export const TICKET_BOOTH_POS = new THREE.Vector3(55.0, 12.5, 71.0);
export const ENTRANCE_ARCH_POS = new THREE.Vector3(46.0, 12.5, 65.0);
export const VIEWING_DECK_POS = new THREE.Vector3(65.5, 13.3, 86.5);
export const CRYSTAL_TUNNEL_CENTER = new THREE.Vector3(83.5, 6.2, 77.0);

export interface ControlPointSpec {
  x: number;
  y: number;
  z: number;
  rollDeg: number;
}

/**
 * 36 surveyed 3D control points matching the "Track Layout (Top View)" and "Underwater Coral Journey" blueprints:
 * - Station at (70, 13.15, 78) oriented East-West.
 * - Sweeping Lift Hill ascending to 45m above the meadow (Y = 57.5m) along the Northern ridge.
 * - Love Reveal Crest directly overlooking the oval "I LOVE YOU ❤️" meadow at (90, 17.6, 110).
 * - Steep 62° Major Drop + camelback wave sweeping into the elevated Castle Flyby (strictly z >= 65.5, clear of Castle Rear Garden).
 * - Crystal Tunnel diving physically beneath the Y = 0.0m ocean water surface into the living Underwater Coral Reef (Y = -4.6m..-3.5m):
 *   T+00s Transition In -> T+03s First Reef ("You are my world.") -> T+08s Living Reef ("My heart belongs to you.")
 *   -> T+13s Coral Passage ("With you, everything feels magical.") -> T+18s Heart Reef ("You are my happy place.")
 *   -> T+23s Heartline Element ("I LOVE YOU ❤️") -> T+28s Final Reef & Exit to Open Sky.
 * - Emerges back out of the ocean water to the open sky, crossing the Queue Garden bridge into the Final Helix and Brake Run.
 */
const CONTROL_POINT_SPECS: readonly ControlPointSpec[] = [
  // Zone 1: Station (collinear along +X at Z = 78.0, Y = 13.15)
  { x: 70.0, y: 13.15, z: 78.0, rollDeg: 0 }, // 0: Station Center (s = 0)
  { x: 77.0, y: 13.15, z: 78.0, rollDeg: 0 }, // 1: Station Departure Threshold

  // Zone 2: Departure Curve (sweeping out and around toward the West/North-West Lift Hill base, staying South/West of Love Meadow)
  { x: 83.0, y: 13.6, z: 79.5, rollDeg: 10 }, // 2: Departure Beacon 1-3
  { x: 82.0, y: 14.8, z: 85.0, rollDeg: 14 }, // 3: Departure Beacon 4-5
  { x: 70.0, y: 17.5, z: 91.5, rollDeg: 10 }, // 4: Turn toward Lift Hill Base

  // Zone 3: 45m Lift Hill Climb (ascending along the NW -> North perimeter around the Love Meadow)
  { x: 58.0, y: 24.5, z: 102.0, rollDeg: 4 }, // 5: Lower Lift Hill
  { x: 56.0, y: 35.0, z: 116.0, rollDeg: 0 }, // 6: Mid Lift Hill (Scenic Overlook)
  { x: 63.0, y: 46.5, z: 127.0, rollDeg: -5 }, // 7: Upper Lift Hill
  { x: 74.0, y: 55.2, z: 132.5, rollDeg: -8 }, // 8: Crest Approach (u ~ 0.22)

  // Zone 4: 45m Love Reveal Crest (Y = 57.5m, looking down South at "I LOVE YOU ❤️" Meadow (90, 17.6, 110))
  { x: 83.0, y: 57.4, z: 133.5, rollDeg: -7 }, // 9: Crest Reveal Start
  { x: 91.0, y: 57.6, z: 133.5, rollDeg: -6 }, // 10: Crest Reveal Center (45m above Meadow)
  { x: 100.0, y: 56.8, z: 131.5, rollDeg: -9 }, // 11: Crest Exit Trigger

  // Zone 5: 62° Major Drop & Camelback Wave
  { x: 112.0, y: 41.5, z: 122.0, rollDeg: -16 }, // 12: Steep 62° First Drop Dive
  { x: 120.0, y: 21.0, z: 108.0, rollDeg: -26 }, // 13: Drop Valley Pullout
  { x: 121.0, y: 28.5, z: 94.0, rollDeg: -14 }, // 14: Secondary Airtime Crest (per Overview image)
  { x: 119.0, y: 17.0, z: 80.0, rollDeg: -34 }, // 15: High-Speed Banked Valley

  // Zone 6: Dream Castle Approach & Sweeping Elevated Flyby (strictly z >= 65.5 so it never overlaps Castle Rear Garden)
  { x: 112.0, y: 24.5, z: 68.5, rollDeg: 28 }, // 16: Castle Approach Ascent
  { x: 98.0, y: 27.5, z: 65.5, rollDeg: 35 }, // 17: Castle Flyby Apex (grand vista of Castle spires)
  { x: 84.0, y: 21.0, z: 67.0, rollDeg: 22 }, // 18: Castle Flyby Sweep Away

  // Zone 7 & 8: Crystal Tunnel Plunge -> Submerged Ocean Coral Reef Journey -> Underwater Heartline ("I LOVE YOU ❤️") -> Exit to Open Sky
  { x: 80.0, y: 13.0, z: 73.5, rollDeg: -6 }, // 19 (u=0.528): Crystal Tunnel West Portal
  { x: 87.0, y: -0.8, z: 80.5, rollDeg: 5 }, // 20 (u=0.556): T+00s Transition In — Crystal Tunnel plunges beneath Y=0.0m ocean water!
  { x: 96.5, y: -4.1, z: 86.2, rollDeg: -8 }, // 21 (u=0.583): T+03s First Reef — "You are my world." & tropical fish school
  { x: 109.5, y: -4.5, z: 88.5, rollDeg: 10 }, // 22 (u=0.611): T+08s Living Reef — "My heart belongs to you." & sea turtles
  { x: 123.0, y: -4.6, z: 86.5, rollDeg: -10 }, // 23 (u=0.639): T+13s Coral Passage — Coral Arch, light rays & "With you, everything feels magical."
  { x: 133.5, y: -4.3, z: 79.5, rollDeg: 12 }, // 24 (u=0.667): T+18s Heart Reef — Heart-shaped coral arch & "You are my happy place."
  { x: 131.0, y: -3.9, z: 71.0, rollDeg: 14 }, // 25 (u=0.694): T+21s Underwater Heartline Approach Turn
  { x: 119.5, y: -3.5, z: 68.2, rollDeg: 0 }, // 26 (u=0.722): T+23s Heartline Element — Twin Glowing Heart Arches & "I LOVE YOU ❤️"
  { x: 107.5, y: -2.5, z: 69.8, rollDeg: -8 }, // 27 (u=0.750): T+25s Final Reef — Reef opens, light brightens ahead
  { x: 96.5, y: -0.2, z: 73.2, rollDeg: -6 }, // 28 (u=0.778): T+28s Ocean Surface Breach — Rising through Y=0.0m ocean water surface!

  // Zone 9: Emergence to Open Sky & Queue Garden Bridge Run
  { x: 86.0, y: 10.2, z: 78.8, rollDeg: 8 }, // 29 (u=0.806): T+28s Exit to Open Sky
  { x: 76.0, y: 16.4, z: 84.0, rollDeg: 16 }, // 30 (u=0.833): Signature Coaster Bridge over Queue Garden
  { x: 62.0, y: 15.2, z: 89.5, rollDeg: -20 }, // 31: Reflective Stream & Stone Garden Run

  // Zone 10: Final Rising Panoramic Helix (with distant callback view of Love Meadow)
  { x: 48.5, y: 20.5, z: 92.0, rollDeg: -30 }, // 32: Final Helix North Entry
  { x: 41.5, y: 24.8, z: 84.5, rollDeg: -32 }, // 33: Final Helix West Apex (Panoramic World Reveal)
  { x: 46.5, y: 18.2, z: 78.0, rollDeg: -15 }, // 34: Final Helix Exit

  // Zone 11 & 12: Magnetic Brake Run & Station Return (collinear along +X at Z = 78.0, Y = 13.15)
  { x: 58.0, y: 13.15, z: 78.0, rollDeg: 0 }, // 35: Straight Magnetic Brake Run
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
