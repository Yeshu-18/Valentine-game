import * as THREE from 'three';
import { BoardingCueEvents } from './HeartlineTrainSolver';
import { LOVE_MEADOW_CENTER } from './HeartlineTrackSpline';

export interface ChoreographyTargets {
  departureBeaconsMesh: THREE.InstancedMesh;
  departureBeaconCount: number;
  crystalTunnelRibsMesh: THREE.InstancedMesh;
  crystalTunnelRibCount: number;
  heartlineBeaconsMesh: THREE.InstancedMesh;
  heartlineBeaconCount: number;
  meadowButterfliesMesh: THREE.InstancedMesh;
  meadowButterflyCount: number;
  queueGlowMaterial: THREE.MeshStandardMaterial;
  castleGardenGlowMaterial: THREE.MeshStandardMaterial;
}

export interface HeartlineChoreographyDirector {
  playTicketConfirmationCue: () => void;
  processBoardingCues: (cues: BoardingCueEvents) => void;
  update: (
    dt: number,
    elapsedTime: number,
    leadU: number,
    speed: number,
    isPlayerRiding: boolean,
    ticketConfirmed: boolean
  ) => void;
  dispose: () => void;
}

const _scratchColor = new THREE.Color();
const _scratchBaseCyan = new THREE.Color(0x0ea5e9);
const _scratchBrightCyan = new THREE.Color(0x7dd3fc);
const _scratchBaseLavender = new THREE.Color(0xa855f7);
const _scratchBrightWhiteCyan = new THREE.Color(0xe0f2fe);
const _scratchMatrix = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();

export function createHeartlineChoreographyDirector(
  targets: ChoreographyTargets
): HeartlineChoreographyDirector {
  let audioCtx: AudioContext | null = null;
  let lastChainClickTime = 0;

  function ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq: number, duration: number, delaySec = 0, type: OscillatorType = 'sine', gainPeak = 0.08): void {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playTicketConfirmationCue(): void {
    // Rising crystalline sapphire arpeggio (C5 -> E5 -> G5 -> B5 -> C6)
    playTone(523.25, 0.28, 0.0, 'triangle', 0.09);
    playTone(659.25, 0.28, 0.09, 'triangle', 0.09);
    playTone(783.99, 0.32, 0.18, 'triangle', 0.10);
    playTone(987.77, 0.36, 0.27, 'sine', 0.10);
    playTone(1046.5, 0.55, 0.36, 'sine', 0.12);
  }

  function playRestraintClick(): void {
    // Double mechanical latch lock click at T+1.5s
    playTone(185, 0.07, 0.0, 'square', 0.07);
    playTone(260, 0.09, 0.08, 'triangle', 0.08);
  }

  function playConsoleChime(): void {
    // Warm two-note station dispatch chime at T+2.0s
    playTone(587.33, 0.35, 0.0, 'sine', 0.09);
    playTone(880.0, 0.55, 0.18, 'sine', 0.11);
  }

  function playBrakeReleaseHiss(): void {
    // Low pneumatic release pulse at T+4.0s
    playTone(110, 0.26, 0.0, 'sawtooth', 0.045);
    playTone(165, 0.22, 0.05, 'triangle', 0.05);
  }

  function playArrivalChime(): void {
    // Gentle major chord on station return
    playTone(523.25, 0.5, 0.0, 'sine', 0.08);
    playTone(659.25, 0.55, 0.12, 'sine', 0.08);
    playTone(783.99, 0.65, 0.24, 'sine', 0.09);
  }

  function processBoardingCues(cues: BoardingCueEvents): void {
    if (cues.restraintLockedJustNow) {
      playRestraintClick();
    }
    if (cues.consoleChimeJustNow) {
      playConsoleChime();
    }
    if (cues.brakeReleaseJustNow) {
      playBrakeReleaseHiss();
    }
    if (cues.rideCompleteJustNow) {
      playArrivalChime();
    }
  }

  function update(
    _dt: number,
    elapsedTime: number,
    leadU: number,
    speed: number,
    isPlayerRiding: boolean,
    ticketConfirmed: boolean
  ): void {
    // 1. Subtle chain-lift ratchet click cadence when player is climbing the 45m Lift Hill (u = 0.09..0.215)
    if (isPlayerRiding && leadU >= 0.09 && leadU <= 0.215 && speed > 1.0) {
      if (elapsedTime - lastChainClickTime > 0.22) {
        lastChainClickTime = elapsedTime;
        playTone(320, 0.035, 0, 'triangle', 0.025);
      }
    }

    // 2. Queue Garden Path & Lantern Glow (brightens when ticket is confirmed)
    const targetQueueEmissive = ticketConfirmed
      ? 1.25 + Math.sin(elapsedTime * 3.2) * 0.2
      : 0.75 + Math.sin(elapsedTime * 1.8) * 0.1;
    targets.queueGlowMaterial.emissiveIntensity = targetQueueEmissive;

    // 3. Act 2: Progressive Departure Beacons (LIGHT 1 -> LIGHT 5 along u = 0.04..0.09)
    for (let i = 0; i < targets.departureBeaconCount; i++) {
      const pairIdx = Math.floor(i / 2);
      const beaconU = 0.042 + (pairIdx / Math.max(1, targets.departureBeaconCount / 2 - 1)) * 0.045;
      const distU = leadU - beaconU;
      let pulse = 0.25 + 0.15 * Math.sin(elapsedTime * 2.5 + pairIdx * 0.7);
      if (leadU >= 0.035 && leadU <= 0.11 && distU >= -0.012) {
        pulse = Math.min(1.0, 0.85 + 0.15 * Math.sin(elapsedTime * 8.0));
      }
      _scratchColor.lerpColors(_scratchBaseCyan, _scratchBrightWhiteCyan, pulse);
      targets.departureBeaconsMesh.setColorAt(i, _scratchColor);
    }
    if (targets.departureBeaconsMesh.instanceColor) {
      targets.departureBeaconsMesh.instanceColor.needsUpdate = true;
    }

    // 4. Act 10–11: Castle Flyby Garden Glow (brightens as train sweeps past u = 0.44..0.54)
    const inCastleFlyby = leadU >= 0.42 && leadU <= 0.55;
    targets.castleGardenGlowMaterial.emissiveIntensity = inCastleFlyby
      ? 1.45 + Math.sin(elapsedTime * 5.0) * 0.25
      : 0.85 + Math.sin(elapsedTime * 2.0) * 0.12;

    // 5. Act 12–14: Gemstone Crystal Tunnel Sequential Wave (u = 0.54..0.64)
    // "TRAIN -> 💡1 -> 💡2 -> 💡3 -> 💡4 -> 💡5" ahead of the lead car!
    for (let i = 0; i < targets.crystalTunnelRibCount; i++) {
      const frac = i / Math.max(1, targets.crystalTunnelRibCount - 1);
      const ribU = 0.54 + frac * 0.10;
      // Base cyan-to-lavender gradient along the tunnel
      _scratchColor.lerpColors(_scratchBaseCyan, _scratchBaseLavender, frac);

      // Travelling wave ahead of the train + ambient shimmer
      const aheadDelta = ribU - leadU;
      let waveBoost = 0.15 * (0.5 + 0.5 * Math.sin(elapsedTime * 3.0 - i * 0.55));
      if (aheadDelta >= -0.015 && aheadDelta <= 0.038) {
        const proximity = 1.0 - Math.abs(aheadDelta - 0.01) / 0.028;
        waveBoost = Math.max(waveBoost, Math.max(0, proximity) * 0.95);
      }
      _scratchColor.lerp(_scratchBrightWhiteCyan, THREE.MathUtils.clamp(waveBoost, 0, 1));
      targets.crystalTunnelRibsMesh.setColorAt(i, _scratchColor);
    }
    if (targets.crystalTunnelRibsMesh.instanceColor) {
      targets.crystalTunnelRibsMesh.instanceColor.needsUpdate = true;
    }

    // 6. Act 15: Signature Heartline Element Sequential Pulse (u = 0.64..0.75)
    for (let i = 0; i < targets.heartlineBeaconCount; i++) {
      const frac = i / Math.max(1, targets.heartlineBeaconCount - 1);
      const nodeU = 0.64 + frac * 0.11;
      const dist = Math.abs(leadU - nodeU);
      let glow = 0.3 + 0.25 * Math.sin(elapsedTime * 4.0 - i * 0.6);
      if (dist < 0.025) {
        glow = 1.0;
      }
      _scratchColor.lerpColors(_scratchBaseCyan, _scratchBrightCyan, glow);
      targets.heartlineBeaconsMesh.setColorAt(i, _scratchColor);
    }
    if (targets.heartlineBeaconsMesh.instanceColor) {
      targets.heartlineBeaconsMesh.instanceColor.needsUpdate = true;
    }

    // 7. Act 5–7: Summit "I LOVE YOU ❤️" Meadow Ambient Butterflies (gentle orbital flutter)
    for (let i = 0; i < targets.meadowButterflyCount; i++) {
      const seed = i * 1.618;
      const angle = elapsedTime * (0.35 + (i % 5) * 0.06) + seed * 6.28;
      const rx = 5.0 + (i % 7) * 2.4;
      const rz = 3.5 + (i % 4) * 2.1;
      const bx = LOVE_MEADOW_CENTER.x + Math.cos(angle) * rx;
      const bz = LOVE_MEADOW_CENTER.z + Math.sin(angle * 1.2) * rz;
      const by = LOVE_MEADOW_CENTER.y + 1.8 + Math.sin(elapsedTime * 2.6 + seed) * 0.65;

      _scratchPos.set(bx, by, bz);
      _scratchEuler.set(
        Math.sin(elapsedTime * 8.0 + seed) * 0.35,
        -angle + Math.PI / 2,
        Math.cos(elapsedTime * 8.0 + seed) * 0.25
      );
      _scratchQuat.setFromEuler(_scratchEuler);
      const wingScale = 0.85 + 0.25 * Math.sin(elapsedTime * 11.0 + seed);
      _scratchScale.set(wingScale, 1.0, 1.0);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      targets.meadowButterfliesMesh.setMatrixAt(i, _scratchMatrix);
    }
    targets.meadowButterfliesMesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(): void {
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  return {
    playTicketConfirmationCue,
    processBoardingCues,
    update,
    dispose,
  };
}
