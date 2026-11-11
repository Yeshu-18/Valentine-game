import * as THREE from 'three';
import { AtmosphereBundle } from '../AtmosphereSystem';
import {
  BROOM_STAND_POS,
  getHeartIslandMask,
  getTerrainHeight,
} from '../terrainMath';

export type RevealStageId =
  | 'IDLE'
  | 'STAGE_A_VISION'
  | 'STAGE_B_MATERIALIZE'
  | 'STAGE_C_ILLUMINATE'
  | 'STAGE_D_GRAND_REVEAL'
  | 'COMPLETED';

export interface DreamWorldRevealUiState {
  active: boolean;
  stage: RevealStageId;
  stageLabel: string;
  progress: number; // 0..1 overall sequence progress
  warmVeilOpacity: number; // 0..1 dark-to-warm blindfold lift in Stage A
  warmTintOpacity: number; // 0..1 golden-rose glow as vision returns
  focusBlurPx: number; // Optical blur: 14px -> 1.4px in Stage A/B, then 4.2px soft island blur in Stage D, -> 0px at handoff
  interiorMistVeilOpacity: number; // 0..1 subtle radial mist during Stage D keeping inner island contents mysterious yet visible
  dedicationOpacity: number; // 0..1 romantic title card in Stage D
}

export interface RevealDistrictGroups {
  islandTerrain: THREE.Group;
  centralPlaza: THREE.Group;
  vegetation: THREE.Group;
  magicFlight: THREE.Group;
  enchantedGarden: THREE.Group;
  carnivalDistrict: THREE.Group;
  ancientForest: THREE.Group;
  heartlinePrecinct: THREE.Group;
  brickWorkshop: THREE.Group;
  wizardingSchool: THREE.Group;
  mysteryBox: THREE.Group;
  dreamCastle: THREE.Group;
  distantLandmarks: THREE.Group;
}

export interface DreamWorldRevealDirectorConfig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  atmosphere: AtmosphereBundle;
  groups: RevealDistrictGroups;
  setBloomStrength: (strength: number) => void;
  setGradeExposureAndVignette: (exposure: number, vignette: number) => void;
  onUiStateChange: (state: DreamWorldRevealUiState) => void;
  onComplete: () => void;
}

export interface DreamWorldRevealDirector {
  startSequence: () => void;
  skipToEnd: () => void;
  isActive: () => boolean;
  update: (delta: number, elapsedTime: number) => void;
  dispose: () => void;
}

const TOTAL_DURATION = 24.0;

// Pre-allocated vectors for zero per-frame garbage collection
const _camStartPos = new THREE.Vector3();
const _camStartLook = new THREE.Vector3();
const _camStageBPos = new THREE.Vector3();
const _camStageCPos = new THREE.Vector3();
const _camPlazaHeartLook = new THREE.Vector3();
const _camVistaPos = new THREE.Vector3();
const _camVistaLook = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Samples points along the exact heart-shaped shoreline contour (getHeartIslandMask(x, z) ≈ 0)
 * so that during the zoomed-out Stage D aerial reveal, a delicate golden-rose shoreline halo
 * accentuates the heart silhouette while the island's interior contents are softly blurred.
 */
function sampleHeartShorelinePoints(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const centerX = 0.0;
  const centerZ = 35.0;

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2.0;
    const dirX = Math.sin(theta);
    const dirZ = Math.cos(theta);

    // Binary search along ray from (0, 35) outward to find the shoreline boundary (mask == 0)
    let lo = 40.0;
    let hi = 260.0;
    for (let iter = 0; iter < 14; iter++) {
      const mid = (lo + hi) * 0.5;
      const mx = centerX + dirX * mid;
      const mz = centerZ + dirZ * mid;
      if (getHeartIslandMask(mx, mz) >= 0) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const r = (lo + hi) * 0.5;
    const px = centerX + dirX * r;
    const pz = centerZ + dirZ * r;
    positions[i * 3] = px;
    positions[i * 3 + 1] = 2.6 + (i % 5) * 0.65;
    positions[i * 3 + 2] = pz;
  }

  return positions;
}

/**
 * Web Audio API layered synthesizer for the extended 24.0-second Dream World Appearance Sequence:
 * - Stage A (0.0s - 4.5s): Warm atmospheric sub-pad + gentle blindfold release breath
 * - Stage B (4.5s - 9.5s): 12-note pentatonic celesta/harp shimmer as the island materializes
 * - Stage C (9.5s - 14.0s): Gradual warm harmonic swell as plaza & attractions illuminate
 * - Stage D (14.0s - 24.0s): Sustained emotional full-island chord resolution during the high-altitude heart-island vista
 */
class DreamWorldRevealAudioScore {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private scheduledTimers: number[] = [];

  public start(): void {
    this.stop();
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.42, ctx.currentTime + 1.1);
      master.connect(ctx.destination);
      this.masterGain = master;

      // Stage A (0.0s - 4.5s): Soft atmospheric introduction (warm F3/C4/A4 pad + airy shimmer)
      this.playWarmPadChord([174.61, 261.63, 349.23, 440.0], 0.0, 5.2, 0.14);
      this.playBellNote(523.25, 0.5, 2.8, 0.055);
      this.playBellNote(659.25, 1.8, 2.8, 0.06);
      this.playBellNote(783.99, 3.1, 2.8, 0.065);

      // Stage B (4.5s - 9.5s): Gentle magical shimmer arpeggio as environment materializes
      const stageBNotes = [
        { freq: 349.23, delay: 4.5 }, // F4
        { freq: 392.0, delay: 4.95 }, // G4
        { freq: 440.0, delay: 5.4 }, // A4
        { freq: 523.25, delay: 5.85 }, // C5
        { freq: 587.33, delay: 6.3 }, // D5
        { freq: 659.25, delay: 6.75 }, // E5
        { freq: 698.46, delay: 7.2 }, // F5
        { freq: 783.99, delay: 7.65 }, // G5
        { freq: 880.0, delay: 8.1 }, // A5
        { freq: 1046.5, delay: 8.55 }, // C6
        { freq: 1174.66, delay: 9.0 }, // D6
      ];
      stageBNotes.forEach((n) => {
        this.playBellNote(n.freq, n.delay, 2.5, 0.07);
      });
      this.playWarmPadChord([233.08, 293.66, 349.23, 440.0], 4.5, 5.5, 0.16);

      // Stage C (9.5s - 14.0s): Gradual musical build as attractions illuminate
      this.playWarmPadChord(
        [196.0, 293.66, 392.0, 493.88, 587.33],
        9.5,
        5.0,
        0.2,
      );
      const stageCNotes = [
        { freq: 587.33, delay: 9.6 },
        { freq: 659.25, delay: 10.2 },
        { freq: 783.99, delay: 10.8 },
        { freq: 880.0, delay: 11.4 },
        { freq: 1046.5, delay: 12.0 },
        { freq: 1174.66, delay: 12.6 },
        { freq: 1318.51, delay: 13.2 },
      ];
      stageCNotes.forEach((n) => {
        this.playBellNote(n.freq, n.delay, 2.8, 0.08);
      });

      // Stage D (14.0s - 24.0s): Emotional musical peak during the zoomed-out heart-island reveal
      // First lush swell as camera pulls high above the heart shoreline (14.0s - 19.5s)
      this.playWarmPadChord(
        [174.61, 261.63, 349.23, 440.0, 523.25, 659.25, 783.99],
        14.0,
        6.2,
        0.24,
      );
      // Second warm resolution hold as the dedication card shines (18.2s - 23.8s)
      this.playWarmPadChord(
        [174.61, 220.0, 261.63, 349.23, 523.25, 659.25],
        18.2,
        5.5,
        0.21,
      );
      this.playBellNote(1046.5, 14.3, 3.8, 0.105);
      this.playBellNote(1318.51, 15.1, 3.6, 0.095);
      this.playBellNote(1567.98, 16.2, 3.8, 0.09);
      this.playBellNote(1318.51, 18.0, 3.5, 0.08);
      this.playBellNote(1046.5, 19.6, 3.8, 0.085);
    } catch {
      // Ignore Web Audio autoplay restrictions if browser blocks un-interacted audio
    }
  }

  private playWarmPadChord(
    freqs: number[],
    delaySec: number,
    durationSec: number,
    peakGain: number,
  ): void {
    const timer = window.setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const perVoiceGain = peakGain / Math.max(1, freqs.length);

      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime((idx - 1.5) * 4.5, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, now);
        filter.frequency.exponentialRampToValueAtTime(
          1850,
          now + durationSec * 0.55,
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(
          perVoiceGain,
          now + Math.min(1.4, durationSec * 0.35),
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + durationSec + 0.05);
      });
    }, delaySec * 1000);
    this.scheduledTimers.push(timer);
  }

  private playBellNote(
    freq: number,
    delaySec: number,
    durationSec: number,
    peakGain: number,
  ): void {
    const timer = window.setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const overtoneGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2.0, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      overtoneGain.gain.setValueAtTime(0.0001, now);
      overtoneGain.gain.linearRampToValueAtTime(peakGain * 0.25, now + 0.02);
      overtoneGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + durationSec * 0.5,
      );

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + durationSec + 0.05);
      overtone.stop(now + durationSec + 0.05);
    }, delaySec * 1000);
    this.scheduledTimers.push(timer);
  }

  public stop(): void {
    this.scheduledTimers.forEach((id) => window.clearTimeout(id));
    this.scheduledTimers.length = 0;

    if (this.ctx && this.masterGain) {
      try {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(
          Math.max(0.0001, this.masterGain.gain.value),
          now,
        );
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        const ctxToClose = this.ctx;
        window.setTimeout(() => {
          ctxToClose.close().catch(() => {});
        }, 260);
      } catch {
        // Ignore close errors
      }
    }
    this.ctx = null;
    this.masterGain = null;
  }
}

export function createDreamWorldRevealDirector(
  config: DreamWorldRevealDirectorConfig,
): DreamWorldRevealDirector {
  const {
    scene,
    camera,
    atmosphere,
    groups,
    setBloomStrength,
    setGradeExposureAndVignette,
    onUiStateChange,
    onComplete,
  } = config;

  const audioScore = new DreamWorldRevealAudioScore();

  // 1. Floating Golden Particles for Stage A ("Vision Returns") & Stage B/C
  const PARTICLE_COUNT = 180;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleSeeds = new Float32Array(PARTICLE_COUNT);

  const spawnX = -16.5;
  const spawnZ = 16.0;
  const spawnY = getTerrainHeight(spawnX, spawnZ);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2.0 + (i % 7) * 0.43;
    const radius = 1.4 + ((i * 19) % 100) * 0.22; // 1.4m .. 23.4m around Harsha
    particlePositions[i * 3] = spawnX + Math.cos(angle) * radius;
    particlePositions[i * 3 + 1] = spawnY + 0.3 + ((i * 13) % 40) * 0.14;
    particlePositions[i * 3 + 2] = spawnZ + Math.sin(angle) * radius;
    particleSeeds[i] = (i * 0.61803398875) % 1.0;
  }

  const particleGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(particlePositions, 3);
  particleGeo.setAttribute('position', posAttr);

  // Procedural soft radial golden glow sprite texture
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64;
  spriteCanvas.height = 64;
  const sCtx = spriteCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 250, 225, 1.0)');
    grad.addColorStop(0.35, 'rgba(251, 191, 36, 0.85)');
    grad.addColorStop(0.7, 'rgba(244, 114, 182, 0.32)');
    grad.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
  }
  const spriteTexture = new THREE.CanvasTexture(spriteCanvas);
  spriteTexture.colorSpace = THREE.SRGBColorSpace;

  const particleMat = new THREE.PointsMaterial({
    map: spriteTexture,
    size: 0.28,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const goldenParticles = new THREE.Points(particleGeo, particleMat);
  goldenParticles.name = 'DreamWorldRevealGoldenParticles';
  goldenParticles.visible = false;
  goldenParticles.frustumCulled = false;
  scene.add(goldenParticles);

  // 1B. Heart Island Shoreline Halo Ring (360 luminous beacons along getHeartIslandMask == 0)
  // Makes the outer heart shape of the island unmistakable when zoomed far out & blurred in Stage D
  const SHORELINE_COUNT = 360;
  const shorelinePositions = sampleHeartShorelinePoints(SHORELINE_COUNT);
  const shorelineGeo = new THREE.BufferGeometry();
  shorelineGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(shorelinePositions, 3),
  );
  const shorelineMat = new THREE.PointsMaterial({
    map: spriteTexture,
    color: 0xffd6a5,
    size: 14.5,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shorelineHaloPoints = new THREE.Points(shorelineGeo, shorelineMat);
  shorelineHaloPoints.name = 'HeartIslandShorelineRevealHalo';
  shorelineHaloPoints.visible = false;
  shorelineHaloPoints.frustumCulled = false;
  scene.add(shorelineHaloPoints);

  // 2. Camera Anchors matching PlayerController's exact initial spawn pose
  const initialYaw = Math.atan2(
    BROOM_STAND_POS.x - spawnX,
    BROOM_STAND_POS.z - spawnZ,
  );
  _camStartPos.set(
    spawnX - Math.sin(initialYaw) * 6.2,
    spawnY + 3.0,
    spawnZ - Math.cos(initialYaw) * 6.2,
  );
  _camStartLook.set(spawnX, spawnY + 1.5, spawnZ);

  // First Camera Pullback Anchors (Stages B & C: 4.5s -> 13.8s):
  // Centers and focuses directly on the Central Plaza's Luminous Heart Fountain
  // (Sculpted Brushed-Gold Heart Arch & Levitating Crystal Heart Core at (0, plazaBaseY + 6.0, 0))
  const plazaBaseY = getTerrainHeight(0.0, 0.0);
  _camPlazaHeartLook.set(0.0, plazaBaseY + 6.0, 0.0);
  _camStageBPos.set(0.0, plazaBaseY + 7.2, -16.5);
  _camStageCPos.set(0.0, plazaBaseY + 9.4, -24.0);

  // Stage D High-Angled Full-Heart Aerial Vista Pos (Zoomed far out to frame all 440m x 480m of the Heart Island)
  _camVistaPos.set(0.0, 335.0, -285.0);
  _camVistaLook.set(0.0, 6.0, 32.0);

  // 3. Staggered District Emergence Bands (Near -> Far across Stage B: 4.5s -> 9.5s)
  const districtBands = [
    {
      group: groups.islandTerrain,
      startSec: 2.2,
      endSec: 6.5,
      dropY: -6.0,
      hideBeforeStart: false,
    },
    {
      group: groups.centralPlaza,
      startSec: 3.2,
      endSec: 7.0,
      dropY: -5.5,
      hideBeforeStart: false,
    },
    {
      group: groups.magicFlight,
      startSec: 3.8,
      endSec: 7.4,
      dropY: -4.5,
      hideBeforeStart: true,
    },
    {
      group: groups.vegetation,
      startSec: 4.5,
      endSec: 8.0,
      dropY: -7.5,
      hideBeforeStart: true,
    },
    {
      group: groups.enchantedGarden,
      startSec: 5.0,
      endSec: 8.4,
      dropY: -8.5,
      hideBeforeStart: true,
    },
    {
      group: groups.carnivalDistrict,
      startSec: 5.4,
      endSec: 8.8,
      dropY: -10.0,
      hideBeforeStart: true,
    },
    {
      group: groups.ancientForest,
      startSec: 5.8,
      endSec: 9.1,
      dropY: -10.0,
      hideBeforeStart: true,
    },
    {
      group: groups.heartlinePrecinct,
      startSec: 6.1,
      endSec: 9.3,
      dropY: -10.0,
      hideBeforeStart: true,
    },
    {
      group: groups.brickWorkshop,
      startSec: 6.3,
      endSec: 9.5,
      dropY: -9.0,
      hideBeforeStart: true,
    },
    {
      group: groups.wizardingSchool,
      startSec: 6.6,
      endSec: 9.8,
      dropY: -14.0,
      hideBeforeStart: true,
    },
    {
      group: groups.mysteryBox,
      startSec: 6.8,
      endSec: 9.9,
      dropY: -12.0,
      hideBeforeStart: true,
    },
    {
      group: groups.dreamCastle,
      startSec: 7.0,
      endSec: 10.2,
      dropY: -16.0,
      hideBeforeStart: true,
    },
    {
      group: groups.distantLandmarks,
      startSec: 7.4,
      endSec: 10.6,
      dropY: -18.0,
      hideBeforeStart: true,
    },
  ];

  let active = false;
  let seqElapsed = 0;
  let uiEmitTimer = 0;

  function restoreBaselineSceneState() {
    for (let i = 0; i < districtBands.length; i++) {
      const b = districtBands[i];
      b.group.visible = true;
      b.group.position.y = 0;
    }

    goldenParticles.visible = false;
    particleMat.opacity = 0;

    shorelineHaloPoints.visible = false;
    shorelineMat.opacity = 0;

    atmosphere.setRevealModulation({
      active: false,
      envLightFactor: 1.0,
      pointLightFactor: 1.0,
      fogDensityOverride: null,
      fogColorBlend: 1.0,
      skyVisibilityFactor: 1.0,
    });

    setBloomStrength(0.38);
    setGradeExposureAndVignette(0.95, 0.26);

    camera.position.copy(_camStartPos);
    camera.lookAt(_camStartLook);
  }

  function finishSequence() {
    if (!active) return;
    active = false;
    audioScore.stop();
    restoreBaselineSceneState();
    onUiStateChange({
      active: false,
      stage: 'COMPLETED',
      stageLabel: '',
      progress: 1,
      warmVeilOpacity: 0,
      warmTintOpacity: 0,
      focusBlurPx: 0,
      interiorMistVeilOpacity: 0,
      dedicationOpacity: 0,
    });
    onComplete();
  }

  return {
    startSequence() {
      active = true;
      seqElapsed = 0;
      uiEmitTimer = 0.1;

      goldenParticles.visible = true;
      particleMat.opacity = 0.92;

      shorelineHaloPoints.visible = true;
      shorelineMat.opacity = 0.0;

      // Apply Stage A initial state immediately so frame 0 has no sudden pop
      for (let i = 0; i < districtBands.length; i++) {
        const b = districtBands[i];
        b.group.position.y = b.dropY;
        b.group.visible = !b.hideBeforeStart;
      }

      atmosphere.setRevealModulation({
        active: true,
        envLightFactor: 0.08,
        pointLightFactor: 0.04,
        fogDensityOverride: 0.045,
        fogColorBlend: 0.0,
        skyVisibilityFactor: 0.0,
      });

      setBloomStrength(0.52);
      setGradeExposureAndVignette(0.55, 0.55);

      camera.position.copy(_camStartPos);
      camera.lookAt(_camStartLook);

      audioScore.start();

      onUiStateChange({
        active: true,
        stage: 'STAGE_A_VISION',
        stageLabel: 'Stage I · Vision Returns',
        progress: 0,
        warmVeilOpacity: 0.96,
        warmTintOpacity: 0.65,
        focusBlurPx: 14.0,
        interiorMistVeilOpacity: 0,
        dedicationOpacity: 0,
      });
    },

    skipToEnd() {
      if (!active) return;
      finishSequence();
    },

    isActive() {
      return active;
    },

    update(delta: number, elapsedTime: number) {
      if (!active) return;

      seqElapsed += delta;
      if (seqElapsed >= TOTAL_DURATION) {
        finishSequence();
        return;
      }

      const progress = THREE.MathUtils.clamp(seqElapsed / TOTAL_DURATION, 0, 1);

      // 1. Determine current Stage & label across the 24.0s timeline
      let stage: RevealStageId = 'STAGE_A_VISION';
      let stageLabel = 'Stage I · Vision Returns';
      if (seqElapsed >= 14.0) {
        stage = 'STAGE_D_GRAND_REVEAL';
        stageLabel = 'Stage IV · Heart Island Silhouette';
      } else if (seqElapsed >= 9.5) {
        stage = 'STAGE_C_ILLUMINATE';
        stageLabel = 'Stage III · Attractions Illuminate';
      } else if (seqElapsed >= 4.5) {
        stage = 'STAGE_B_MATERIALIZE';
        stageLabel = 'Stage II · World Materializes';
      }

      // 2. Stage A & B & C: Animate Floating Golden Particles around Harsha
      const particleFadeIn = smootherstep(0.0, 1.5, seqElapsed);
      const particleFadeOut = 1.0 - smootherstep(13.5, 16.8, seqElapsed);
      particleMat.opacity = particleFadeIn * particleFadeOut * 0.9;

      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const seed = particleSeeds[i];
        arr[i * 3] += Math.sin(elapsedTime * 1.2 + seed * 12.0) * delta * 0.22;
        arr[i * 3 + 1] += (0.42 + seed * 0.52) * delta;
        arr[i * 3 + 2] +=
          Math.cos(elapsedTime * 1.1 + seed * 9.0) * delta * 0.22;

        if (arr[i * 3 + 1] > spawnY + 6.5) {
          arr[i * 3 + 1] = spawnY + 0.25;
        }
      }
      posAttr.needsUpdate = true;

      // 2B. Stage D: Animate Heart Shoreline Halo Ring so the heart silhouette glows clearly through the soft blur
      const shorelineIn = smootherstep(12.5, 16.0, seqElapsed);
      const shorelineOut = 1.0 - smootherstep(21.0, 23.4, seqElapsed);
      shorelineMat.opacity = shorelineIn * shorelineOut * 0.78;
      shorelineHaloPoints.position.y = Math.sin(elapsedTime * 1.5) * 0.6;

      // 3. Stage B: Progressive Near-to-Far District Emergence (Zero Popping)
      for (let i = 0; i < districtBands.length; i++) {
        const b = districtBands[i];
        if (seqElapsed < b.startSec) {
          b.group.visible = !b.hideBeforeStart;
          b.group.position.y = b.dropY;
        } else {
          b.group.visible = true;
          const t = smootherstep(b.startSec, b.endSec, seqElapsed);
          b.group.position.y = THREE.MathUtils.lerp(b.dropY, 0.0, t);
        }
      }

      // 4. Stage A -> B -> C -> D: Atmosphere, Fog Clearing & Attractions Illumination
      // Fog clears from dense 0.045 in Stage A, through 0.0055 in Stage B, to 0.0018 in Stage C,
      // and to 0.00105 during the high-altitude Stage D zoom-out so the entire 480m heart shoreline is visible
      // while soft mist + optical blur veil the inner details.
      const fogClearB = smootherstep(2.5, 9.5, seqElapsed);
      const fogClearC = smootherstep(9.0, 13.8, seqElapsed);
      const fogVistaD =
        smootherstep(14.0, 16.5, seqElapsed) *
        (1.0 - smootherstep(21.2, 23.8, seqElapsed));
      const baseFogDensity = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.045, 0.0058, fogClearB),
        0.0018,
        fogClearC,
      );
      const currentFogDensity = THREE.MathUtils.lerp(
        baseFogDensity,
        0.00105,
        fogVistaD,
      );

      // Sun & Hemisphere light warm up from 0.08 in Stage A to 0.55 in Stage B and 1.0 in Stage C
      const envLightAtoB = smootherstep(0.6, 9.2, seqElapsed);
      const envLightC = smootherstep(9.0, 13.5, seqElapsed);
      const envLightFactor = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.08, 0.52, envLightAtoB),
        1.0,
        envLightC,
      );

      // Attraction & Plaza PointLights ignite during Stage C (9.5s -> 14.0s) and remain glowing in Stage D
      const ptBase = smootherstep(3.5, 9.5, seqElapsed) * 0.25;
      const ptIgnite = smootherstep(9.2, 13.5, seqElapsed);
      const ptCrest =
        Math.sin(smootherstep(9.5, 20.5, seqElapsed) * Math.PI) * 0.35;
      const pointLightFactor = ptBase + ptIgnite * 0.75 + ptCrest;

      // Sky dome & horizon mountains reveal across Stage B/C
      const skyVisibilityFactor = smootherstep(6.0, 13.2, seqElapsed);
      const fogColorBlend = smootherstep(2.2, 11.5, seqElapsed);

      atmosphere.setRevealModulation({
        active: true,
        envLightFactor,
        pointLightFactor,
        fogDensityOverride: currentFogDensity,
        fogColorBlend,
        skyVisibilityFactor,
      });

      // 5. Post-Processing Exposure, Vignette & Bloom Progression
      const exposureRamp = smootherstep(0.0, 8.0, seqElapsed);
      const stageCBloomSwirl =
        Math.sin(smootherstep(9.2, 21.5, seqElapsed) * Math.PI) * 0.24;
      setBloomStrength(0.38 + stageCBloomSwirl);
      setGradeExposureAndVignette(
        THREE.MathUtils.lerp(0.58, 0.95, exposureRamp),
        THREE.MathUtils.lerp(0.52, 0.28, exposureRamp),
      );

      // 6. Four-Stage Camera Choreography across 24.0 Seconds
      if (seqElapsed < 4.5) {
        // Stage A (0.0s -> 4.5s): Stationary camera behind Harsha with subtle breathing drift
        const breath = Math.sin(seqElapsed * 1.5) * 0.06;
        camera.position.set(
          _camStartPos.x,
          _camStartPos.y + breath,
          _camStartPos.z,
        );
        camera.lookAt(
          _camStartLook.x,
          _camStartLook.y + breath * 0.5,
          _camStartLook.z,
        );
      } else if (seqElapsed < 9.5) {
        // Stage B (4.5s -> 9.5s): Smooth movement into the Central Plaza, centering focus on the Plaza's Center Heart Arch & Crystal Heart Core
        const tB = smootherstep(4.5, 9.5, seqElapsed);
        _camPos.lerpVectors(_camStartPos, _camStageBPos, tB);
        _camLook.lerpVectors(_camStartLook, _camPlazaHeartLook, tB);
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);
      } else if (seqElapsed < 13.8) {
        // Stage C (9.5s -> 13.8s): First camera pullback directly along the plaza axis while locked dead-center on the Central Plaza's Center Heart as lights ignite
        const tC = smootherstep(9.5, 13.8, seqElapsed);
        _camPos.lerpVectors(_camStageBPos, _camStageCPos, tC);
        camera.position.copy(_camPos);
        camera.lookAt(_camPlazaHeartLook);
      } else if (seqElapsed < 21.2) {
        // Stage D (Part 1: 13.8s -> 16.6s Zoom Far Out to High Aerial Vista & Hold until 21.2s):
        // Frames the entire 440m x 480m heart-shaped island from (0, 335, -285)
        const tPullback = smootherstep(13.8, 16.6, seqElapsed);
        _camPos.lerpVectors(_camStageCPos, _camVistaPos, tPullback);
        _camLook.lerpVectors(_camPlazaHeartLook, _camVistaLook, tPullback);
        // Subtle slow aerial drift during the hold (16.6s -> 21.2s)
        const holdDrift = smootherstep(16.0, 21.2, seqElapsed);
        _camPos.y += holdDrift * 14.0;
        _camPos.z -= holdDrift * 12.0;
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);
      } else {
        // Stage D (Part 2: 21.2s -> 24.0s): Smooth glide back down to exact PlayerController third-person pose
        const tReturn = smootherstep(21.2, TOTAL_DURATION, seqElapsed);
        const vistaEndPos = _camVistaPos
          .clone()
          .add(new THREE.Vector3(0, 14.0, -12.0));
        _camPos.lerpVectors(vistaEndPos, _camStartPos, tReturn);
        _camLook.lerpVectors(_camVistaLook, _camStartLook, tReturn);
        camera.position.copy(_camPos);
        camera.lookAt(_camLook);
      }

      // 7. Compute Overlay UI State:
      // - Stage A optical defocus (14px -> 1.4px)
      // - Stage D soft island blur (ramps to 4.2px during high aerial zoom-out so only the heart shape & warm lights are revealed while interior details stay veiled, then clears to 0px at 24.0s)
      const warmVeilOpacity = 1.0 - smootherstep(0.0, 3.4, seqElapsed);
      const warmTintOpacity =
        (1.0 - smootherstep(0.5, 4.4, seqElapsed)) * 0.55;

      const stageABlur = THREE.MathUtils.lerp(
        14.0,
        1.2,
        smootherstep(0.0, 4.2, seqElapsed),
      );
      const stageDVistaBlurIn = smootherstep(13.6, 16.4, seqElapsed);
      const stageDVistaBlurOut = 1.0 - smootherstep(21.2, 23.7, seqElapsed);
      const stageDFinalClear = 1.0 - smootherstep(21.4, 23.9, seqElapsed);

      const focusBlurPx =
        seqElapsed < 13.6
          ? stageABlur
          : THREE.MathUtils.lerp(
              1.2 * stageDFinalClear,
              4.2,
              stageDVistaBlurIn * stageDVistaBlurOut,
            );

      const interiorMistVeilOpacity =
        stageDVistaBlurIn * stageDVistaBlurOut * 0.72;

      const dedicationIn = smootherstep(16.0, 17.0, seqElapsed);
      const dedicationOut = 1.0 - smootherstep(20.4, 21.4, seqElapsed);
      const dedicationOpacity = dedicationIn * dedicationOut;

      uiEmitTimer += delta;
      if (uiEmitTimer >= 0.04) {
        uiEmitTimer = 0;
        onUiStateChange({
          active: true,
          stage,
          stageLabel,
          progress,
          warmVeilOpacity,
          warmTintOpacity,
          focusBlurPx,
          interiorMistVeilOpacity,
          dedicationOpacity,
        });
      }
    },

    dispose() {
      audioScore.stop();
      scene.remove(goldenParticles);
      scene.remove(shorelineHaloPoints);
      particleGeo.dispose();
      particleMat.dispose();
      shorelineGeo.dispose();
      shorelineMat.dispose();
      spriteTexture.dispose();
    },
  };
}
