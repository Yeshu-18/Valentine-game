import * as THREE from 'three';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';
import { ResourceTracker } from '../ProceduralKit';
import {
  FOREST_SEED,
  castleLocalToWorld,
  dampValue,
  getTerrainHeight,
  mulberry32,
  smoothstep01,
} from '../terrainMath';

export enum PlantReaction {
  TURN = 'TURN',
  HIDE = 'HIDE',
  BLOOM = 'BLOOM',
  FOLLOW = 'FOLLOW',
  PULSE = 'PULSE',
  SQUEAK = 'SQUEAK',
  CHIME = 'CHIME',
}

export type MagicalPlantSpecies =
  | 'mandrake_tuft'
  | 'tentacula_vine'
  | 'bell_flower'
  | 'strange_bulb'
  | 'moon_fern';

export interface MagicalPlantSpec {
  id: string;
  species: MagicalPlantSpecies;
  reactions: ReadonlyArray<PlantReaction>;
  localX: number;
  localZ: number;
  triggerRadius: number;
  cooldownDuration: number;
  scale: number;
  rotationY: number;
}

export interface InteractivePlantPromptInfo {
  id: 'f1_mandrake' | 'f1_devils_snare';
  title: string;
  actionLabel: string;
  distance: number;
}

export interface MagicalPlantSystemBundle {
  group: THREE.Group;
  plants: ReadonlyArray<MagicalPlantSpec>;
  getInteractivePlantPrompt: (
    playerWorldPos: THREE.Vector3,
  ) => InteractivePlantPromptInfo | null;
  triggerInteractivePlant: (
    playerWorldPos: THREE.Vector3,
  ) => 'f1_mandrake' | 'f1_devils_snare' | 'none';
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

/**
 * Generates a soft radial-gradient circular sprite texture for bioluminescent plant spores.
 */
function createBioluminescentSporeTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    1,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  );
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.78)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lightweight, restrained Web Audio synthesizer for PlantReaction.CHIME and PlantReaction.SQUEAK.
 * Never throws or blocks if the browser AudioContext has not yet been unlocked by user interaction.
 */
class BotanicalAudioSynth {
  private ctx: AudioContext | null = null;
  private lastSoundTime = 0;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playChime(pitchIndex: number, nowSec: number): void {
    if (nowSec - this.lastSoundTime < 0.35) return;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    this.lastSoundTime = nowSec;

    const pentatonicHz = [587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
    const freq = pentatonicHz[pitchIndex % pentatonicHz.length];
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.008, t0 + 0.9);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.032, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1.2);
  }

  playSqueak(isBulbPuff: boolean, nowSec: number): void {
    if (nowSec - this.lastSoundTime < 0.45) return;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    this.lastSoundTime = nowSec;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isBulbPuff) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.14);
      osc.frequency.exponentialRampToValueAtTime(190, t0 + 0.34);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.024, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(690, t0 + 0.09);
      osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.22);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.022, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    }
  }

  /**
   * Very short, soft comedic squeak ("Oops, you caught me!") for the interactive F1 Mandrake.
   */
  playMandrakeInteractiveSqueak(nowSec: number): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    this.lastSoundTime = nowSec;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(590, t0);
    osc.frequency.exponentialRampToValueAtTime(840, t0 + 0.065);
    osc.frequency.exponentialRampToValueAtTime(480, t0 + 0.17);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.018, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  /**
   * Very subtle botanical leaf rustle and soft woody creak for the interactive F1 Creeping Vine.
   */
  playVineRustleCreak(nowSec: number): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;
    this.lastSoundTime = nowSec;

    const t0 = ctx.currentTime;

    // 1. Subtle low woody creak (soft triangle pitch bend)
    const creakOsc = ctx.createOscillator();
    const creakGain = ctx.createGain();
    creakOsc.type = 'triangle';
    creakOsc.frequency.setValueAtTime(118, t0);
    creakOsc.frequency.exponentialRampToValueAtTime(86, t0 + 0.28);
    creakOsc.frequency.exponentialRampToValueAtTime(104, t0 + 0.52);

    creakGain.gain.setValueAtTime(0.0001, t0);
    creakGain.gain.linearRampToValueAtTime(0.012, t0 + 0.08);
    creakGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);

    creakOsc.connect(creakGain);
    creakGain.connect(ctx.destination);
    creakOsc.start(t0);
    creakOsc.stop(t0 + 0.56);

    // 2. Soft foliage rustle shimmer
    const rustleOsc = ctx.createOscillator();
    const rustleGain = ctx.createGain();
    rustleOsc.type = 'sine';
    rustleOsc.frequency.setValueAtTime(310, t0 + 0.05);
    rustleOsc.frequency.exponentialRampToValueAtTime(240, t0 + 0.45);

    rustleGain.gain.setValueAtTime(0.0001, t0 + 0.05);
    rustleGain.gain.linearRampToValueAtTime(0.009, t0 + 0.16);
    rustleGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);

    rustleOsc.connect(rustleGain);
    rustleGain.connect(ctx.destination);
    rustleOsc.start(t0 + 0.05);
    rustleOsc.stop(t0 + 0.5);
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

/**
 * Builds Phase F1 Zone 3: The Reactive Magical Plant System with Bioluminescent Illumination.
 * - Uses deterministic placement & variation seeded with FOREST_SEED = 74291.
 * - Implements all 5 magical plant species and all 7 PlantReaction behaviors:
 *   1. Mandrake-inspired plant (HIDE at ~4.5m + SQUEAK + luminous emerald leaf tips & rune rim)
 *   2. Tentacula-inspired vine (FOLLOW player briefly then retreat + TURN + glowing crimson-rose pod)
 *   3. Bell Flower (BLOOM + CHIME + PULSE + radiant lavender-pearl bells & golden clappers)
 *   4. Strange Bulb (SQUEAK + inflate/wobble/deflate + PULSE + glowing amber-gold ribs & ring)
 *   5. Moon Fern (fronds gradually uncurl via BLOOM + TURN + glowing cyan-silver spore beads)
 * - Includes 95 rising bioluminescent spore motes drifting above the plant beds.
 */
export function createMagicalPlantSystem(): MagicalPlantSystemBundle {
  const group = new THREE.Group();
  group.name = 'MagicalPlantSystem';

  const tracker = new ResourceTracker();
  const rand = mulberry32(FOREST_SEED + 303);
  const audioSynth = new BotanicalAudioSynth();

  // Shared Botanical & Bioluminescent Materials (high-visibility warm & bioluminescent bounce)
  const terracottaPotMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c25e2e'),
      emissive: new THREE.Color('#7c2d12'),
      emissiveIntensity: 0.24,
      roughness: 0.7,
      metalness: 0.04,
    }),
  );
  const glowingPotRuneRimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.72,
      roughness: 0.26,
    }),
  );
  const darkSoilMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3222'),
      roughness: 0.88,
    }),
  );
  const mandrakeRootMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c89052'),
      emissive: new THREE.Color('#92400e'),
      emissiveIntensity: 0.32,
      roughness: 0.65,
    }),
  );
  const mandrakeEyeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.82,
      roughness: 0.2,
    }),
  );
  const emeraldLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4ade80'),
      emissive: new THREE.Color('#16a34a'),
      emissiveIntensity: 0.46,
      roughness: 0.44,
      side: THREE.DoubleSide,
    }),
  );
  const biolumLeafTipMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bbf7d0'),
      emissive: new THREE.Color('#22c55e'),
      emissiveIntensity: 0.74,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  const tentaculaStemMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2e7d56'),
      emissive: new THREE.Color('#059669'),
      emissiveIntensity: 0.38,
      roughness: 0.46,
    }),
  );
  const stamenGoldMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef9c3'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.84,
      roughness: 0.2,
    }),
  );
  const moonFernFrondMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ccfbf1'),
      emissive: new THREE.Color('#2dd4bf'),
      emissiveIntensity: 0.74,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  const cyanSporeBeadMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ecfeff'),
      emissive: new THREE.Color('#22d3ee'),
      emissiveIntensity: 0.85,
      roughness: 0.18,
    }),
  );
  const luminousMossBedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4ade80'),
      emissive: new THREE.Color('#15803d'),
      emissiveIntensity: 0.48,
      roughness: 0.65,
    }),
  );
  const copperBollardStemMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4764a'),
      roughness: 0.35,
      metalness: 0.82,
    }),
  );
  const dewLanternOrbMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbeb'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.86,
      roughness: 0.18,
    }),
  );

  // Shared Geometries
  const potGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.28, 0.2, 0.34, 10),
  );
  potGeo.translate(0, 0.17, 0);
  const potRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.28, 0.034, 7, 16),
  );
  potRimGeo.rotateX(Math.PI / 2);
  potRimGeo.translate(0, 0.34, 0);
  const potSoilGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.25, 0.25, 0.04, 10),
  );
  potSoilGeo.translate(0, 0.32, 0);

  // Luminous Botanical Ground Bed Disc & Halo Ring around each Magical Plant
  const groundBedDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.54, 20));
  groundBedDiscGeo.rotateX(-Math.PI / 2);
  groundBedDiscGeo.translate(0, 0.03, 0);

  const groundHaloRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.5, 0.66, 24),
  );
  groundHaloRingGeo.rotateX(-Math.PI / 2);
  groundHaloRingGeo.translate(0, 0.038, 0);

  // Low Copper-and-Crystal Botanical Dew Lantern Bollard beside each plant cluster
  const dewHookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.38, 0),
    new THREE.Vector3(0.08, 0.56, 0),
    new THREE.Vector3(0.22, 0.52, 0),
  ]);
  const dewHookStemGeo = tracker.trackGeo(
    new THREE.TubeGeometry(dewHookCurve, 12, 0.018, 6, false),
  );
  const dewLanternCapGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.095, 0.075, 8),
  );
  const dewLanternOrbGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.078, 10, 10),
  );

  // Curated Data-Driven Magical Plant Placements across Zones 1, 2, 3 & 4
  const plants: MagicalPlantSpec[] = [
    // 1. Mandrake-Inspired Plants (HIDE at ~4.5m + SQUEAK)
    {
      id: 'mandrake_garden_1',
      species: 'mandrake_tuft',
      reactions: [PlantReaction.HIDE, PlantReaction.SQUEAK],
      localX: 16.8,
      localZ: 39.8,
      triggerRadius: 4.5,
      cooldownDuration: 4.0,
      scale: 1.05,
      rotationY: 0.4,
    },
    {
      id: 'mandrake_garden_2',
      species: 'mandrake_tuft',
      reactions: [PlantReaction.HIDE, PlantReaction.SQUEAK],
      localX: 21.6,
      localZ: 34.4,
      triggerRadius: 4.5,
      cooldownDuration: 4.2,
      scale: 1.1,
      rotationY: -0.8,
    },
    {
      id: 'mandrake_garden_3',
      species: 'mandrake_tuft',
      reactions: [PlantReaction.HIDE, PlantReaction.SQUEAK],
      localX: 27.6,
      localZ: 34.6,
      triggerRadius: 4.5,
      cooldownDuration: 4.0,
      scale: 1.0,
      rotationY: 1.2,
    },
    {
      id: 'mandrake_garden_4',
      species: 'mandrake_tuft',
      reactions: [PlantReaction.HIDE, PlantReaction.SQUEAK],
      localX: 31.8,
      localZ: 25.0,
      triggerRadius: 4.5,
      cooldownDuration: 4.5,
      scale: 1.08,
      rotationY: -1.5,
    },

    // 2. Tentacula-Inspired Vines (FOLLOW player briefly then retreat + TURN)
    {
      id: 'tentacula_vine_1',
      species: 'tentacula_vine',
      reactions: [PlantReaction.FOLLOW, PlantReaction.TURN],
      localX: 21.8,
      localZ: 39.2,
      triggerRadius: 5.6,
      cooldownDuration: 6.5,
      scale: 1.1,
      rotationY: -0.5,
    },
    {
      id: 'tentacula_vine_2',
      species: 'tentacula_vine',
      reactions: [PlantReaction.FOLLOW, PlantReaction.TURN],
      localX: 28.2,
      localZ: 29.4,
      triggerRadius: 5.8,
      cooldownDuration: 6.8,
      scale: 1.16,
      rotationY: 0.9,
    },
    {
      id: 'tentacula_vine_3',
      species: 'tentacula_vine',
      reactions: [PlantReaction.FOLLOW, PlantReaction.TURN],
      localX: 34.8,
      localZ: 27.8,
      triggerRadius: 5.6,
      cooldownDuration: 6.5,
      scale: 1.12,
      rotationY: -1.1,
    },

    // 3. Bell Flowers (BLOOM + CHIME + PULSE)
    {
      id: 'bell_flower_1',
      species: 'bell_flower',
      reactions: [
        PlantReaction.BLOOM,
        PlantReaction.CHIME,
        PlantReaction.PULSE,
      ],
      localX: 17.6,
      localZ: 36.2,
      triggerRadius: 5.0,
      cooldownDuration: 7.5,
      scale: 1.08,
      rotationY: 0.3,
    },
    {
      id: 'bell_flower_2',
      species: 'bell_flower',
      reactions: [
        PlantReaction.BLOOM,
        PlantReaction.CHIME,
        PlantReaction.PULSE,
      ],
      localX: 25.2,
      localZ: 37.4,
      triggerRadius: 5.2,
      cooldownDuration: 7.5,
      scale: 1.14,
      rotationY: -0.7,
    },
    {
      id: 'bell_flower_3',
      species: 'bell_flower',
      reactions: [
        PlantReaction.BLOOM,
        PlantReaction.CHIME,
        PlantReaction.PULSE,
      ],
      localX: 29.8,
      localZ: 33.4,
      triggerRadius: 5.2,
      cooldownDuration: 7.5,
      scale: 1.1,
      rotationY: 1.1,
    },
    {
      id: 'bell_flower_4',
      species: 'bell_flower',
      reactions: [
        PlantReaction.BLOOM,
        PlantReaction.CHIME,
        PlantReaction.PULSE,
      ],
      localX: 35.4,
      localZ: 20.6,
      triggerRadius: 5.0,
      cooldownDuration: 7.5,
      scale: 1.05,
      rotationY: -0.4,
    },

    // 4. Strange Bulbs (SQUEAK + inflate/wobble/deflate + PULSE)
    {
      id: 'strange_bulb_1',
      species: 'strange_bulb',
      reactions: [PlantReaction.SQUEAK, PlantReaction.PULSE],
      localX: 20.4,
      localZ: 35.6,
      triggerRadius: 4.8,
      cooldownDuration: 6.2,
      scale: 1.06,
      rotationY: 0.2,
    },
    {
      id: 'strange_bulb_2',
      species: 'strange_bulb',
      reactions: [PlantReaction.SQUEAK, PlantReaction.PULSE],
      localX: 26.2,
      localZ: 31.8,
      triggerRadius: 4.8,
      cooldownDuration: 6.5,
      scale: 1.14,
      rotationY: 1.6,
    },
    {
      id: 'strange_bulb_3',
      species: 'strange_bulb',
      reactions: [PlantReaction.SQUEAK, PlantReaction.PULSE],
      localX: 32.4,
      localZ: 28.8,
      triggerRadius: 4.8,
      cooldownDuration: 6.2,
      scale: 1.1,
      rotationY: -0.9,
    },

    // 5. Moon Ferns (fronds gradually uncurl as player passes: BLOOM + TURN)
    {
      id: 'moon_fern_1',
      species: 'moon_fern',
      reactions: [PlantReaction.BLOOM, PlantReaction.TURN],
      localX: 18.8,
      localZ: 39.4,
      triggerRadius: 5.5,
      cooldownDuration: 2.5,
      scale: 1.08,
      rotationY: 0.0,
    },
    {
      id: 'moon_fern_2',
      species: 'moon_fern',
      reactions: [PlantReaction.BLOOM, PlantReaction.TURN],
      localX: 24.2,
      localZ: 33.8,
      triggerRadius: 5.5,
      cooldownDuration: 2.5,
      scale: 1.14,
      rotationY: 0.8,
    },
    {
      id: 'moon_fern_3',
      species: 'moon_fern',
      reactions: [PlantReaction.BLOOM, PlantReaction.TURN],
      localX: 31.0,
      localZ: 31.0,
      triggerRadius: 5.5,
      cooldownDuration: 2.5,
      scale: 1.16,
      rotationY: -1.2,
    },
    {
      id: 'moon_fern_4',
      species: 'moon_fern',
      reactions: [PlantReaction.BLOOM, PlantReaction.TURN],
      localX: 36.2,
      localZ: 22.8,
      triggerRadius: 5.5,
      cooldownDuration: 2.5,
      scale: 1.1,
      rotationY: 0.5,
    },
    {
      id: 'moon_fern_5',
      species: 'moon_fern',
      reactions: [PlantReaction.BLOOM, PlantReaction.TURN],
      localX: 38.4,
      localZ: 16.4,
      triggerRadius: 5.5,
      cooldownDuration: 2.5,
      scale: 1.06,
      rotationY: -0.6,
    },
  ];

  // Runtime Rigs per species
  interface MandrakeRuntime {
    kind: 'mandrake_tuft';
    spec: MagicalPlantSpec;
    worldPos: THREE.Vector3;
    tuftPivot: THREE.Group;
    leafCrown: THREE.Group;
    hideProgress: number;
    cooldown: number;
    wasHidden: boolean;
    phase: number;
  }

  interface TentaculaRuntime {
    kind: 'tentacula_vine';
    spec: MagicalPlantSpec;
    worldPos: THREE.Vector3;
    baseYawGroup: THREE.Group;
    lowerStalk: THREE.Group;
    midStalk: THREE.Group;
    upperHead: THREE.Group;
    podMat: THREE.MeshStandardMaterial;
    currentYaw: number;
    followBlend: number;
    followTimer: number;
    cooldown: number;
    phase: number;
  }

  interface BellFlowerRuntime {
    kind: 'bell_flower';
    spec: MagicalPlantSpec;
    worldPos: THREE.Vector3;
    petals: THREE.Mesh[];
    clappers: THREE.Mesh[];
    petalMat: THREE.MeshStandardMaterial;
    bloomProgress: number;
    pulseTime: number;
    cooldown: number;
    pitchIdx: number;
    phase: number;
  }

  interface StrangeBulbRuntime {
    kind: 'strange_bulb';
    spec: MagicalPlantSpec;
    worldPos: THREE.Vector3;
    bulbBodyGroup: THREE.Group;
    veinMat: THREE.MeshStandardMaterial;
    reactionTime: number;
    cooldown: number;
    phase: number;
  }

  interface MoonFernRuntime {
    kind: 'moon_fern';
    spec: MagicalPlantSpec;
    worldPos: THREE.Vector3;
    rosetteGroup: THREE.Group;
    frondChains: Array<{
      baseJoint: THREE.Group;
      midJoint: THREE.Group;
      tipJoint: THREE.Group;
    }>;
    uncurlProgress: number;
    currentYawOffset: number;
    phase: number;
  }

  type PlantRuntime =
    | MandrakeRuntime
    | TentaculaRuntime
    | BellFlowerRuntime
    | StrangeBulbRuntime
    | MoonFernRuntime;

  const runtimes: PlantRuntime[] = [];

  // Shared Geometries for Species Construction
  const mandrakeHeadGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.14, 10, 10),
  );
  mandrakeHeadGeo.scale(1.0, 1.15, 1.0);
  const mandrakeEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.025, 6, 6));
  const mandrakeLeafBladeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.088, 0.36, 5),
  );
  mandrakeLeafBladeGeo.scale(1.0, 1.0, 0.32);
  mandrakeLeafBladeGeo.translate(0, 0.18, 0);

  const vineSegGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.044, 0.06, 0.46, 8),
  );
  vineSegGeo.translate(0, 0.23, 0);
  const vineLeafGeo = tracker.trackGeo(new THREE.ConeGeometry(0.115, 0.34, 4));
  vineLeafGeo.scale(1.0, 1.0, 0.28);
  vineLeafGeo.translate(0, 0.17, 0);
  const vineBudGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.135, 1),
  );
  vineBudGeo.scale(0.95, 1.28, 0.95);

  const bellPetalGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.082, 0.26, 5),
  );
  bellPetalGeo.scale(1.0, 1.0, 0.36);
  bellPetalGeo.translate(0, -0.13, 0);
  const bellClapperGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.036, 8, 8),
  );

  const bulbCoreGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.25, 12, 10),
  );
  bulbCoreGeo.scale(1.06, 1.24, 1.06);
  bulbCoreGeo.translate(0, 0.25, 0);

  const bulbRibGeos: THREE.BufferGeometry[] = [];
  for (let r = 0; r < 6; r++) {
    const rib = new THREE.TorusGeometry(0.24, 0.032, 6, 16, Math.PI);
    rib.rotateZ(-Math.PI / 2);
    rib.rotateY((r * Math.PI) / 3);
    rib.scale(1.02, 1.18, 1.02);
    rib.translate(0, 0.25, 0);
    bulbRibGeos.push(rib);
  }
  const mergedBulbRibsGeo = tracker.trackGeo(mergeGeometries(bulbRibGeos));
  bulbRibGeos.forEach((g) => g.dispose());

  const fernSegGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.095, 0.23, 0.024),
  );
  fernSegGeo.translate(0, 0.115, 0);
  const sporeBeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.028, 6, 6));

  plants.forEach((spec, idx) => {
    const worldCoords = castleLocalToWorld(spec.localX, spec.localZ);
    const groundY = getTerrainHeight(worldCoords.x, worldCoords.z);
    const root = new THREE.Group();
    root.name = `MagicalPlant_${spec.id}`;
    root.position.set(worldCoords.x, groundY, worldCoords.z);
    root.rotation.y = spec.rotationY;
    root.scale.setScalar(spec.scale);
    group.add(root);

    const worldPos = new THREE.Vector3(worldCoords.x, groundY, worldCoords.z);
    const phase = idx * 1.43 + rand() * 3.14;

    // Luminous Botanical Moss Bed Disc & Copper Dew-Lantern Bollard right beside every plant
    const bedPad = new THREE.Mesh(groundBedDiscGeo, luminousMossBedMat);
    const dewLantern = new THREE.Group();
    const bollardAng = (idx % 2 === 0 ? 1 : -1) * 0.85;
    dewLantern.position.set(
      Math.cos(bollardAng) * 0.48,
      0,
      Math.sin(bollardAng) * 0.48,
    );
    dewLantern.rotation.y = bollardAng + Math.PI;
    const dewStem = new THREE.Mesh(dewHookStemGeo, copperBollardStemMat);
    const dewCap = new THREE.Mesh(dewLanternCapGeo, copperBollardStemMat);
    dewCap.position.set(0.22, 0.51, 0);
    const dewOrb = new THREE.Mesh(dewLanternOrbGeo, dewLanternOrbMat);
    dewOrb.position.set(0.22, 0.43, 0);
    dewLantern.add(dewStem, dewCap, dewOrb);
    root.add(bedPad, dewLantern);

    if (spec.species === 'mandrake_tuft') {
      const pot = new THREE.Mesh(potGeo, terracottaPotMat);
      pot.castShadow = true;
      pot.receiveShadow = true;
      // Glowing golden-amber rune rim around the pot so it catches the eye
      const rim = new THREE.Mesh(potRimGeo, glowingPotRuneRimMat);
      const soil = new THREE.Mesh(potSoilGeo, darkSoilMat);
      const halo = new THREE.Mesh(groundHaloRingGeo, biolumLeafTipMat);
      root.add(pot, rim, soil, halo);

      const tuftPivot = new THREE.Group();
      tuftPivot.position.set(0, 0.36, 0);
      root.add(tuftPivot);

      const head = new THREE.Mesh(mandrakeHeadGeo, mandrakeRootMat);
      head.castShadow = true;
      const eyeL = new THREE.Mesh(mandrakeEyeGeo, mandrakeEyeMat);
      eyeL.position.set(-0.048, 0.04, 0.125);
      const eyeR = new THREE.Mesh(mandrakeEyeGeo, mandrakeEyeMat);
      eyeR.position.set(0.048, 0.04, 0.125);
      tuftPivot.add(head, eyeL, eyeR);

      const leafCrown = new THREE.Group();
      leafCrown.position.set(0, 0.11, 0);
      tuftPivot.add(leafCrown);

      for (let l = 0; l < 8; l++) {
        const lMesh = new THREE.Mesh(
          mandrakeLeafBladeGeo,
          l % 2 === 0 ? biolumLeafTipMat : emeraldLeafMat,
        );
        const lAng = (l / 8) * Math.PI * 2;
        lMesh.rotation.y = lAng;
        lMesh.rotation.x = 0.38 + (l % 2) * 0.2;
        leafCrown.add(lMesh);
      }

      runtimes.push({
        kind: 'mandrake_tuft',
        spec,
        worldPos,
        tuftPivot,
        leafCrown,
        hideProgress: 0,
        cooldown: 0,
        wasHidden: false,
        phase,
      });
    } else if (spec.species === 'tentacula_vine') {
      const podMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#fecdd3'),
          emissive: new THREE.Color('#f43f5e'),
          emissiveIntensity: 0.72,
          roughness: 0.28,
        }),
      );

      const basePot = new THREE.Mesh(potGeo, terracottaPotMat);
      basePot.scale.set(1.25, 0.85, 1.25);
      basePot.castShadow = true;
      const baseRim = new THREE.Mesh(potRimGeo, glowingPotRuneRimMat);
      baseRim.scale.set(1.25, 0.85, 1.25);
      const baseSoil = new THREE.Mesh(potSoilGeo, darkSoilMat);
      baseSoil.scale.set(1.25, 0.85, 1.25);
      const halo = new THREE.Mesh(groundHaloRingGeo, podMat);
      root.add(basePot, baseRim, baseSoil, halo);

      const baseYawGroup = new THREE.Group();
      baseYawGroup.position.set(0, 0.26, 0);
      root.add(baseYawGroup);

      // 4 Basal Collar Leaves with bioluminescent tips
      for (let c = 0; c < 4; c++) {
        const cLeaf = new THREE.Mesh(
          vineLeafGeo,
          c % 2 === 0 ? biolumLeafTipMat : emeraldLeafMat,
        );
        cLeaf.rotation.y = (c * Math.PI) / 2;
        cLeaf.rotation.x = 0.72;
        baseYawGroup.add(cLeaf);
      }

      const lowerStalk = new THREE.Group();
      baseYawGroup.add(lowerStalk);
      const seg1 = new THREE.Mesh(vineSegGeo, tentaculaStemMat);
      seg1.castShadow = true;
      lowerStalk.add(seg1);

      const midStalk = new THREE.Group();
      midStalk.position.set(0, 0.44, 0);
      lowerStalk.add(midStalk);
      const seg2 = new THREE.Mesh(vineSegGeo, tentaculaStemMat);
      seg2.scale.set(0.86, 0.95, 0.86);
      seg2.castShadow = true;
      midStalk.add(seg2);

      // Bioluminescent side leaves on mid stalk
      [-1, 1].forEach((side) => {
        const sLeaf = new THREE.Mesh(vineLeafGeo, biolumLeafTipMat);
        sLeaf.position.set(0, 0.22, 0);
        sLeaf.rotation.z = side * 0.85;
        midStalk.add(sLeaf);
      });

      const upperHead = new THREE.Group();
      upperHead.position.set(0, 0.42, 0);
      midStalk.add(upperHead);

      const seg3 = new THREE.Mesh(vineSegGeo, tentaculaStemMat);
      seg3.scale.set(0.72, 0.78, 0.72);
      upperHead.add(seg3);

      const pod = new THREE.Mesh(vineBudGeo, podMat);
      pod.position.set(0, 0.38, 0.04);
      pod.rotation.x = 0.45;
      const nectarCore = new THREE.Mesh(bellClapperGeo, stamenGoldMat);
      nectarCore.position.set(0, 0.46, 0.12);
      upperHead.add(pod, nectarCore);

      runtimes.push({
        kind: 'tentacula_vine',
        spec,
        worldPos,
        baseYawGroup,
        lowerStalk,
        midStalk,
        upperHead,
        podMat,
        currentYaw: 0,
        followBlend: 0,
        followTimer: 0,
        cooldown: 0,
        phase,
      });
    } else if (spec.species === 'bell_flower') {
      const petalMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#fae8ff'),
          emissive: new THREE.Color('#d946ef'),
          emissiveIntensity: 0.72,
          roughness: 0.26,
          side: THREE.DoubleSide,
        }),
      );

      const halo = new THREE.Mesh(groundHaloRingGeo, petalMat);
      root.add(halo);

      const petals: THREE.Mesh[] = [];
      const clappers: THREE.Mesh[] = [];

      // 3 Arched Bell Stems per cluster
      for (let s = 0; s < 3; s++) {
        const sAng = (s * Math.PI * 2) / 3 + 0.2;
        const stemGroup = new THREE.Group();
        stemGroup.rotation.y = sAng;
        root.add(stemGroup);

        const h = 0.72 + (s % 2) * 0.16;
        const archCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.15, h * 0.85, 0),
          new THREE.Vector3(0.34, h, 0),
        );
        const stemGeo = tracker.trackGeo(
          new THREE.TubeGeometry(archCurve, 10, 0.02, 6, false),
        );
        const stemMesh = new THREE.Mesh(stemGeo, emeraldLeafMat);
        stemMesh.castShadow = true;
        stemGroup.add(stemMesh);

        const bellHead = new THREE.Group();
        bellHead.position.set(0.34, h, 0);
        stemGroup.add(bellHead);

        // Glowing golden calyx cap at the top of each bell
        const calyxCap = new THREE.Mesh(sporeBeadGeo, stamenGoldMat);
        calyxCap.scale.set(1.4, 0.9, 1.4);
        bellHead.add(calyxCap);

        for (let p = 0; p < 4; p++) {
          const pPivot = new THREE.Group();
          pPivot.rotation.y = (p * Math.PI) / 2;
          bellHead.add(pPivot);

          const pMesh = new THREE.Mesh(bellPetalGeo, petalMat);
          pMesh.rotation.z = 0.28;
          pPivot.add(pMesh);
          petals.push(pMesh);
        }

        const clapper = new THREE.Mesh(bellClapperGeo, stamenGoldMat);
        clapper.position.set(0, -0.15, 0);
        bellHead.add(clapper);
        clappers.push(clapper);
      }

      runtimes.push({
        kind: 'bell_flower',
        spec,
        worldPos,
        petals,
        clappers,
        petalMat,
        bloomProgress: 0,
        pulseTime: 0,
        cooldown: 0,
        pitchIdx: idx,
        phase,
      });
    } else if (spec.species === 'strange_bulb') {
      const veinMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#fef08a'),
          emissive: new THREE.Color('#fbbf24'),
          emissiveIntensity: 0.72,
          roughness: 0.24,
        }),
      );
      const bulbFleshMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#9333ea'),
          emissive: new THREE.Color('#7e22ce'),
          emissiveIntensity: 0.45,
          roughness: 0.38,
        }),
      );

      const halo = new THREE.Mesh(groundHaloRingGeo, veinMat);
      root.add(halo);

      // Basal leaf nest
      for (let b = 0; b < 6; b++) {
        const bLeaf = new THREE.Mesh(
          vineLeafGeo,
          b % 2 === 0 ? biolumLeafTipMat : emeraldLeafMat,
        );
        bLeaf.rotation.y = (b * Math.PI) / 3;
        bLeaf.rotation.x = 1.12;
        bLeaf.scale.set(1.25, 1.1, 1.25);
        root.add(bLeaf);
      }

      const bulbBodyGroup = new THREE.Group();
      root.add(bulbBodyGroup);

      const coreMesh = new THREE.Mesh(bulbCoreGeo, bulbFleshMat);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      const ribsMesh = new THREE.Mesh(mergedBulbRibsGeo, veinMat);
      const crownPearl = new THREE.Mesh(bellClapperGeo, stamenGoldMat);
      crownPearl.position.set(0, 0.56, 0);
      crownPearl.scale.setScalar(1.3);
      bulbBodyGroup.add(coreMesh, ribsMesh, crownPearl);

      runtimes.push({
        kind: 'strange_bulb',
        spec,
        worldPos,
        bulbBodyGroup,
        veinMat,
        reactionTime: -1,
        cooldown: 0,
        phase,
      });
    } else if (spec.species === 'moon_fern') {
      const halo = new THREE.Mesh(groundHaloRingGeo, moonFernFrondMat);
      root.add(halo);

      const rosetteGroup = new THREE.Group();
      root.add(rosetteGroup);

      // Glowing central pearl core in the Moon Fern rosette
      const centerPearl = new THREE.Mesh(bellClapperGeo, cyanSporeBeadMat);
      centerPearl.position.set(0, 0.08, 0);
      centerPearl.scale.setScalar(1.25);
      rosetteGroup.add(centerPearl);

      const frondChains: MoonFernRuntime['frondChains'] = [];
      const frondCount = 5;
      for (let f = 0; f < frondCount; f++) {
        const fRoot = new THREE.Group();
        fRoot.rotation.y = (f * Math.PI * 2) / frondCount;
        rosetteGroup.add(fRoot);

        const baseJoint = new THREE.Group();
        baseJoint.position.set(0.05, 0.04, 0);
        fRoot.add(baseJoint);
        const segA = new THREE.Mesh(fernSegGeo, emeraldLeafMat);
        baseJoint.add(segA);

        const midJoint = new THREE.Group();
        midJoint.position.set(0, 0.22, 0);
        baseJoint.add(midJoint);
        const segB = new THREE.Mesh(fernSegGeo, moonFernFrondMat);
        segB.scale.set(0.88, 0.94, 1.0);
        const midBead = new THREE.Mesh(sporeBeadGeo, cyanSporeBeadMat);
        midBead.position.set(0, 0.12, 0.02);
        midJoint.add(segB, midBead);

        const tipJoint = new THREE.Group();
        tipJoint.position.set(0, 0.2, 0);
        midJoint.add(tipJoint);
        const segC = new THREE.Mesh(fernSegGeo, moonFernFrondMat);
        segC.scale.set(0.68, 0.85, 1.0);
        const tipBead = new THREE.Mesh(sporeBeadGeo, cyanSporeBeadMat);
        tipBead.position.set(0, 0.2, 0.02);
        tipBead.scale.setScalar(1.2);
        tipJoint.add(segC, tipBead);

        frondChains.push({ baseJoint, midJoint, tipJoint });
      }

      runtimes.push({
        kind: 'moon_fern',
        spec,
        worldPos,
        rosetteGroup,
        frondChains,
        uncurlProgress: 0,
        currentYawOffset: 0,
        phase,
      });
    }
  });

  // ============================================================================
  // FLOATING BIOLUMINESCENT SPORE & POLLEN MOTE SYSTEM (95 Particles)
  // ============================================================================
  const sporeCount = plants.length * 5; // 19 * 5 = 95 motes
  const sporePositions = new Float32Array(sporeCount * 3);
  const sporeColors = new Float32Array(sporeCount * 3);
  const sporeBaseCoords: Array<{
    wx: number;
    wy: number;
    wz: number;
    phase: number;
    radius: number;
    speed: number;
  }> = [];

  const cSporeEmerald = new THREE.Color('#86efac');
  const cSporeRose = new THREE.Color('#fda4af');
  const cSporeLavender = new THREE.Color('#e9d5ff');
  const cSporeAmber = new THREE.Color('#fde047');
  const cSporeCyan = new THREE.Color('#99f6e4');

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    const w = castleLocalToWorld(p.localX, p.localZ);
    const wy = getTerrainHeight(w.x, w.z);
    const col =
      p.species === 'mandrake_tuft'
        ? cSporeEmerald
        : p.species === 'tentacula_vine'
          ? cSporeRose
          : p.species === 'bell_flower'
            ? cSporeLavender
            : p.species === 'strange_bulb'
              ? cSporeAmber
              : cSporeCyan;

    for (let k = 0; k < 5; k++) {
      const idx = i * 5 + k;
      sporeColors[idx * 3] = col.r;
      sporeColors[idx * 3 + 1] = col.g;
      sporeColors[idx * 3 + 2] = col.b;

      sporeBaseCoords.push({
        wx: w.x,
        wy,
        wz: w.z,
        phase: idx * 0.77 + rand() * 6.28,
        radius: 0.24 + rand() * 0.42,
        speed: 0.22 + rand() * 0.18,
      });
    }
  }

  const sporeGeo = tracker.trackGeo(new THREE.BufferGeometry());
  sporeGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(sporePositions, 3),
  );
  sporeGeo.setAttribute('color', new THREE.BufferAttribute(sporeColors, 3));

  const sporeSpriteTex = createBioluminescentSporeTexture(tracker);
  const sporeMat = tracker.trackMat(
    new THREE.PointsMaterial({
      size: 0.16,
      map: sporeSpriteTex ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sporePoints = new THREE.Points(sporeGeo, sporeMat);
  sporePoints.name = 'BioluminescentPlantSpores';
  group.add(sporePoints);

  // ============================================================================
  // F1 PATCH: TWO DELIBERATE [E]-INTERACTIVE MAGICAL PLANTS ALONG THE PATH
  // 1. Mandrake-Inspired Plant at local (20.6, 38.6) -> World (-92.81, 28.88, 111.94)
  // 2. Devil's-Snare-Inspired Creeping Vine at local (33.6, 23.6) -> World (-73.01, 28.08, 110.53)
  // ============================================================================
  const INTERACTIVE_TRIGGER_RADIUS = 2.5;

  // --- INTERACTION 1: MANDRAKE-INSPIRED PLANT (localX = 20.6, localZ = 38.6) ---
  const interactiveMandrakeLocal = { localX: 20.6, localZ: 38.6 };
  const interactiveMandrakeWorldCoords = castleLocalToWorld(
    interactiveMandrakeLocal.localX,
    interactiveMandrakeLocal.localZ,
  );
  const interactiveMandrakeGroundY = getTerrainHeight(
    interactiveMandrakeWorldCoords.x,
    interactiveMandrakeWorldCoords.z,
  );
  const interactiveMandrakeWorldPos = new THREE.Vector3(
    interactiveMandrakeWorldCoords.x,
    interactiveMandrakeGroundY,
    interactiveMandrakeWorldCoords.z,
  );

  const mandrakeInteractiveRoot = new THREE.Group();
  mandrakeInteractiveRoot.name = 'F1_InteractiveMandrake';
  mandrakeInteractiveRoot.position.copy(interactiveMandrakeWorldPos);
  // Orient toward the stone pathway centerline (localZ ~ 37.1)
  const mandrakeBaseYaw = -0.35;
  mandrakeInteractiveRoot.rotation.y = mandrakeBaseYaw;
  group.add(mandrakeInteractiveRoot);

  // Weathered low stone planter rim & rich dark soil patch tucked into moss/ferns
  const lowPlanterStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#78716c'),
      roughness: 0.84,
      metalness: 0.04,
    }),
  );
  const mandrakeTuberBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b87d4b'),
      emissive: new THREE.Color('#78350f'),
      emissiveIntensity: 0.24,
      roughness: 0.72,
    }),
  );
  const mandrakeDarkBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5c3a21'),
      roughness: 0.86,
    }),
  );
  const mandrakePupilMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1917'),
      roughness: 0.25,
    }),
  );

  const mandrakeSoilMoundGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.34, 0.44, 0.16, 12),
  );
  mandrakeSoilMoundGeo.translate(0, 0.08, 0);
  const mandrakeSoilMound = new THREE.Mesh(mandrakeSoilMoundGeo, darkSoilMat);
  mandrakeSoilMound.receiveShadow = true;

  const mandrakePlanterRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.39, 0.065, 8, 16),
  );
  mandrakePlanterRingGeo.rotateX(Math.PI / 2);
  mandrakePlanterRingGeo.translate(0, 0.09, 0);
  const mandrakePlanterRing = new THREE.Mesh(
    mandrakePlanterRingGeo,
    lowPlanterStoneMat,
  );
  mandrakePlanterRing.castShadow = true;
  mandrakePlanterRing.receiveShadow = true;

  // Tucked framing moss & side fern fronds so the player discovers it naturally
  const tuckedMossGeo = tracker.trackGeo(new THREE.SphereGeometry(0.18, 8, 6));
  tuckedMossGeo.scale(1.3, 0.45, 1.1);
  const mossCushionL = new THREE.Mesh(tuckedMossGeo, luminousMossBedMat);
  mossCushionL.position.set(-0.34, 0.06, -0.18);
  const mossCushionR = new THREE.Mesh(tuckedMossGeo, luminousMossBedMat);
  mossCushionR.position.set(0.32, 0.05, -0.22);
  mandrakeInteractiveRoot.add(
    mandrakeSoilMound,
    mandrakePlanterRing,
    mossCushionL,
    mossCushionR,
  );

  for (let tf = 0; tf < 4; tf++) {
    const fBlade = new THREE.Mesh(mandrakeLeafBladeGeo, emeraldLeafMat);
    const fAng = -Math.PI * 0.75 + tf * 0.48;
    fBlade.position.set(Math.cos(fAng) * 0.38, 0.08, Math.sin(fAng) * 0.38);
    fBlade.rotation.y = -fAng + Math.PI * 0.5;
    fBlade.rotation.x = 0.55;
    fBlade.scale.setScalar(0.95);
    mandrakeInteractiveRoot.add(fBlade);
  }

  // Animated Mandrake Body Group (rises from soil, wiggles, turns toward player)
  const mandrakeBodyRig = new THREE.Group();
  const MANDRAKE_IDLE_Y = 0.14;
  mandrakeBodyRig.position.set(0, MANDRAKE_IDLE_Y, 0);
  mandrakeInteractiveRoot.add(mandrakeBodyRig);

  // Sculpted tuberous root torso (lower belly + upper head-tuber + root ridges)
  const lowerTuberGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.135, 12, 10),
  );
  lowerTuberGeo.scale(1.05, 1.28, 0.98);
  lowerTuberGeo.translate(0, 0.04, 0);
  const lowerTuber = new THREE.Mesh(lowerTuberGeo, mandrakeTuberBarkMat);
  lowerTuber.castShadow = true;

  const upperTuberGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.145, 12, 10),
  );
  upperTuberGeo.scale(1.02, 1.18, 0.96);
  upperTuberGeo.translate(0, 0.21, 0);
  const upperTuber = new THREE.Mesh(upperTuberGeo, mandrakeTuberBarkMat);
  upperTuber.castShadow = true;

  const browRidgeGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.095, 0.022, 6, 12, Math.PI * 0.78),
  );
  const browRidge = new THREE.Mesh(browRidgeGeo, mandrakeDarkBarkMat);
  browRidge.position.set(0, 0.265, 0.115);
  browRidge.rotation.x = 0.35;
  browRidge.rotation.z = Math.PI * 0.11;

  const buttonNoseGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
  buttonNoseGeo.scale(1.1, 0.85, 1.25);
  const buttonNose = new THREE.Mesh(buttonNoseGeo, mandrakeTuberBarkMat);
  buttonNose.position.set(0, 0.21, 0.145);

  // Expressive Eyes (widen when startled)
  const mandrakeEyeLeftGroup = new THREE.Group();
  mandrakeEyeLeftGroup.position.set(-0.052, 0.235, 0.128);
  const mandrakeEyeRightGroup = new THREE.Group();
  mandrakeEyeRightGroup.position.set(0.052, 0.235, 0.128);

  const irisGeo = tracker.trackGeo(new THREE.SphereGeometry(0.024, 8, 8));
  const pupilGeo = tracker.trackGeo(new THREE.SphereGeometry(0.013, 6, 6));
  [mandrakeEyeLeftGroup, mandrakeEyeRightGroup].forEach((eyeGrp) => {
    const iris = new THREE.Mesh(irisGeo, mandrakeEyeMat);
    const pupil = new THREE.Mesh(pupilGeo, mandrakePupilMat);
    pupil.position.set(0, 0, 0.015);
    eyeGrp.add(iris, pupil);
  });

  // Expressive Mouth (opens into a tiny surprised "O" during the squeak)
  const mandrakeMouthGroup = new THREE.Group();
  mandrakeMouthGroup.position.set(0, 0.165, 0.136);
  const mouthLipGeo = tracker.trackGeo(new THREE.TorusGeometry(0.024, 0.007, 6, 12));
  const mouthHollowGeo = tracker.trackGeo(new THREE.CircleGeometry(0.022, 10));
  const mouthLip = new THREE.Mesh(mouthLipGeo, mandrakeDarkBarkMat);
  const mouthHollow = new THREE.Mesh(mouthHollowGeo, mandrakePupilMat);
  mouthHollow.position.z = -0.002;
  mandrakeMouthGroup.add(mouthLip, mouthHollow);
  mandrakeMouthGroup.scale.set(0.85, 0.32, 1.0);

  mandrakeBodyRig.add(
    lowerTuber,
    upperTuber,
    browRidge,
    buttonNose,
    mandrakeEyeLeftGroup,
    mandrakeEyeRightGroup,
    mandrakeMouthGroup,
  );

  // Partially Exposed Gnarled Roots & Stubby Root-Arms
  const exposedRootsGroup = new THREE.Group();
  mandrakeBodyRig.add(exposedRootsGroup);
  for (let r = 0; r < 5; r++) {
    const rAng = (r / 5) * Math.PI * 2 + 0.3;
    const rCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(rAng) * 0.08, 0.02, Math.sin(rAng) * 0.08),
      new THREE.Vector3(Math.cos(rAng + 0.25) * 0.16, -0.06, Math.sin(rAng + 0.25) * 0.16),
      new THREE.Vector3(Math.cos(rAng - 0.15) * 0.23, -0.14, Math.sin(rAng - 0.15) * 0.23),
    ]);
    const rGeo = tracker.trackGeo(
      new THREE.TubeGeometry(rCurve, 8, 0.018, 6, false),
    );
    const rMesh = new THREE.Mesh(rGeo, mandrakeDarkBarkMat);
    exposedRootsGroup.add(rMesh);
  }

  // Two stubby root-arms that wiggle when startled
  const rootArmCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.09, 0.03, 0.03),
    new THREE.Vector3(-0.15, 0.09, 0.05),
  ]);
  const rootArmGeoL = tracker.trackGeo(
    new THREE.TubeGeometry(rootArmCurveL, 7, 0.019, 6, false),
  );
  const mandrakeArmL = new THREE.Mesh(rootArmGeoL, mandrakeTuberBarkMat);
  mandrakeArmL.position.set(-0.09, 0.11, 0);

  const rootArmCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.09, 0.03, 0.03),
    new THREE.Vector3(0.15, 0.09, 0.05),
  ]);
  const rootArmGeoR = tracker.trackGeo(
    new THREE.TubeGeometry(rootArmCurveR, 7, 0.019, 6, false),
  );
  const mandrakeArmR = new THREE.Mesh(rootArmGeoR, mandrakeTuberBarkMat);
  mandrakeArmR.position.set(0.09, 0.11, 0);
  mandrakeBodyRig.add(mandrakeArmL, mandrakeArmR);

  // Lush Crown of 9 Botanical Leaves on the Mandrake's Head
  const mandrakeCrownGroup = new THREE.Group();
  mandrakeCrownGroup.position.set(0, 0.34, 0);
  mandrakeBodyRig.add(mandrakeCrownGroup);

  const mandrakeLeafPivots: THREE.Group[] = [];
  for (let l = 0; l < 9; l++) {
    const lPivot = new THREE.Group();
    const lAng = (l / 9) * Math.PI * 2;
    lPivot.rotation.y = lAng;
    const lMesh = new THREE.Mesh(
      mandrakeLeafBladeGeo,
      l % 2 === 0 ? biolumLeafTipMat : emeraldLeafMat,
    );
    lMesh.scale.set(1.08, 1.12, 1.08);
    lMesh.rotation.x = 0.34 + (l % 3) * 0.14;
    lPivot.add(lMesh);
    mandrakeCrownGroup.add(lPivot);
    mandrakeLeafPivots.push(lPivot);
  }

  // 3 Tiny Falling Leaves for the startled Mandrake reaction (ultra-low count)
  const tinyFallingLeafGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.038, 0.11, 4),
  );
  tinyFallingLeafGeo.scale(1.0, 1.0, 0.25);
  const mandrakeFallingLeaves: THREE.Mesh[] = [];
  for (let fl = 0; fl < 3; fl++) {
    const flMesh = new THREE.Mesh(
      tinyFallingLeafGeo,
      fl % 2 === 0 ? biolumLeafTipMat : emeraldLeafMat,
    );
    flMesh.visible = false;
    mandrakeInteractiveRoot.add(flMesh);
    mandrakeFallingLeaves.push(flMesh);
  }

  // Mandrake Interactive State Machine
  const MANDRAKE_ANIM_DURATION = 2.6; // 2-3 seconds total animation
  const MANDRAKE_COOLDOWN = 4.8;
  let mandrakeAnimTime = -1;
  let mandrakeCooldown = 0;
  let mandrakeTargetYaw = 0;
  let mandrakeCurrentYaw = 0;

  // --- INTERACTION 2: DEVIL'S-SNARE-INSPIRED CREEPING VINE (localX = 33.6, localZ = 23.6) ---
  const interactiveVineLocal = { localX: 33.6, localZ: 23.6 };
  const interactiveVineWorldCoords = castleLocalToWorld(
    interactiveVineLocal.localX,
    interactiveVineLocal.localZ,
  );
  const interactiveVineGroundY = getTerrainHeight(
    interactiveVineWorldCoords.x,
    interactiveVineWorldCoords.z,
  );
  const interactiveVineWorldPos = new THREE.Vector3(
    interactiveVineWorldCoords.x,
    interactiveVineGroundY,
    interactiveVineWorldCoords.z,
  );

  const vineInteractiveRoot = new THREE.Group();
  vineInteractiveRoot.name = 'F1_InteractiveDevilsSnareVine';
  vineInteractiveRoot.position.copy(interactiveVineWorldPos);
  const vineBaseYaw = 0.65;
  vineInteractiveRoot.rotation.y = vineBaseYaw;
  group.add(vineInteractiveRoot);

  // Materials with dark green foliage and subtle purple/blue undertones
  const snareCentralVineMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1b4332'),
      emissive: new THREE.Color('#1e1b4b'),
      emissiveIntensity: 0.32,
      roughness: 0.56,
    }),
  );
  const snareTendrilMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d6a4f'),
      emissive: new THREE.Color('#312e81'),
      emissiveIntensity: 0.38,
      roughness: 0.48,
    }),
  );
  const snarePurpleUndertoneLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b3464'),
      emissive: new THREE.Color('#4c1d95'),
      emissiveIntensity: 0.44,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  const snareDarkFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#14532d'),
      emissive: new THREE.Color('#064e3b'),
      emissiveIntensity: 0.3,
      roughness: 0.54,
      side: THREE.DoubleSide,
    }),
  );

  // Nearby Stone & Root Anchor + Moss Cushions
  const anchorBoulderGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.42, 1),
  );
  anchorBoulderGeo.scale(1.25, 0.68, 1.05);
  anchorBoulderGeo.translate(-0.14, 0.18, -0.12);
  const anchorBoulder = new THREE.Mesh(anchorBoulderGeo, lowPlanterStoneMat);
  anchorBoulder.castShadow = true;
  anchorBoulder.receiveShadow = true;

  const anchorMossCapGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.36, 1),
  );
  anchorMossCapGeo.scale(1.22, 0.38, 1.02);
  anchorMossCapGeo.translate(-0.12, 0.34, -0.1);
  const anchorMossCap = new THREE.Mesh(anchorMossCapGeo, luminousMossBedMat);

  const anchorRootCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.52, 0.02, -0.28),
    new THREE.Vector3(-0.22, 0.26, -0.05),
    new THREE.Vector3(0.14, 0.14, 0.12),
    new THREE.Vector3(0.42, 0.01, 0.28),
  ]);
  const anchorRootGeo = tracker.trackGeo(
    new THREE.TubeGeometry(anchorRootCurve, 12, 0.055, 7, false),
  );
  const anchorRootMesh = new THREE.Mesh(anchorRootGeo, mandrakeDarkBarkMat);
  anchorRootMesh.castShadow = true;

  vineInteractiveRoot.add(anchorBoulder, anchorMossCap, anchorRootMesh);

  // Basal dark-green and purple-undertone foliage nest around the stone/root anchor
  for (let bf = 0; bf < 8; bf++) {
    const bfAng = (bf / 8) * Math.PI * 2;
    const bfMesh = new THREE.Mesh(
      vineLeafGeo,
      bf % 2 === 0 ? snareDarkFoliageMat : snarePurpleUndertoneLeafMat,
    );
    bfMesh.position.set(
      Math.cos(bfAng) * 0.24,
      0.16,
      Math.sin(bfAng) * 0.24,
    );
    bfMesh.rotation.y = -bfAng + Math.PI * 0.5;
    bfMesh.rotation.x = 0.82;
    bfMesh.scale.set(1.15, 1.1, 1.15);
    vineInteractiveRoot.add(bfMesh);
  }

  // Slightly thicker central vine (articulated 2-stage trunk that leans toward player)
  const centralVineYawGroup = new THREE.Group();
  centralVineYawGroup.position.set(0, 0.18, 0);
  vineInteractiveRoot.add(centralVineYawGroup);

  const centralVineBase = new THREE.Group();
  centralVineYawGroup.add(centralVineBase);
  const centralSeg1Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.052, 0.074, 0.44, 8),
  );
  centralSeg1Geo.translate(0, 0.22, 0);
  const centralSeg1 = new THREE.Mesh(centralSeg1Geo, snareCentralVineMat);
  centralSeg1.castShadow = true;
  centralVineBase.add(centralSeg1);

  const centralVineUpper = new THREE.Group();
  centralVineUpper.position.set(0, 0.42, 0);
  centralVineBase.add(centralVineUpper);
  const centralSeg2Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.034, 0.052, 0.38, 8),
  );
  centralSeg2Geo.translate(0, 0.19, 0);
  const centralSeg2 = new THREE.Mesh(centralSeg2Geo, snareCentralVineMat);
  centralSeg2.castShadow = true;
  centralVineUpper.add(centralSeg2);

  // Foliage leaves along the central vine
  for (let cl = 0; cl < 4; cl++) {
    const clMesh = new THREE.Mesh(
      vineLeafGeo,
      cl % 2 === 0 ? snarePurpleUndertoneLeafMat : snareDarkFoliageMat,
    );
    clMesh.position.set(0, 0.12 + cl * 0.07, 0);
    clMesh.rotation.y = cl * 1.57;
    clMesh.rotation.z = 0.68;
    clMesh.scale.setScalar(0.85);
    centralVineUpper.add(clMesh);
  }

  // Helper to build a multi-jointed thin creeping tendril
  interface ArticulatedTendril {
    yawGroup: THREE.Group;
    seg1: THREE.Group;
    seg2: THREE.Group;
    seg3: THREE.Group;
    restYaw: number;
    restPitch1: number;
    restPitch2: number;
    restPitch3: number;
  }

  const tendrilSeg1Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.024, 0.034, 0.34, 7),
  );
  tendrilSeg1Geo.translate(0, 0.17, 0);
  const tendrilSeg2Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.016, 0.024, 0.3, 7),
  );
  tendrilSeg2Geo.translate(0, 0.15, 0);
  const tendrilSeg3Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.008, 0.016, 0.24, 6),
  );
  tendrilSeg3Geo.translate(0, 0.12, 0);

  function buildArticulatedTendril(
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    restYaw: number,
    restPitch1: number,
    restPitch2: number,
    restPitch3: number,
  ): ArticulatedTendril {
    const yawGroup = new THREE.Group();
    yawGroup.position.set(offsetX, offsetY, offsetZ);
    yawGroup.rotation.y = restYaw;
    vineInteractiveRoot.add(yawGroup);

    const seg1 = new THREE.Group();
    seg1.rotation.x = restPitch1;
    yawGroup.add(seg1);
    const m1 = new THREE.Mesh(tendrilSeg1Geo, snareTendrilMat);
    m1.castShadow = true;
    seg1.add(m1);

    const leaf1 = new THREE.Mesh(vineLeafGeo, snarePurpleUndertoneLeafMat);
    leaf1.position.set(0, 0.18, 0);
    leaf1.rotation.z = 0.72;
    leaf1.scale.setScalar(0.68);
    seg1.add(leaf1);

    const seg2 = new THREE.Group();
    seg2.position.set(0, 0.32, 0);
    seg2.rotation.x = restPitch2;
    seg1.add(seg2);
    const m2 = new THREE.Mesh(tendrilSeg2Geo, snareTendrilMat);
    m2.castShadow = true;
    seg2.add(m2);

    const leaf2 = new THREE.Mesh(vineLeafGeo, snareDarkFoliageMat);
    leaf2.position.set(0, 0.16, 0);
    leaf2.rotation.z = -0.75;
    leaf2.scale.setScalar(0.56);
    seg2.add(leaf2);

    const seg3 = new THREE.Group();
    seg3.position.set(0, 0.28, 0);
    seg3.rotation.x = restPitch3;
    seg2.add(seg3);
    const m3 = new THREE.Mesh(tendrilSeg3Geo, snareTendrilMat);
    seg3.add(m3);

    return {
      yawGroup,
      seg1,
      seg2,
      seg3,
      restYaw,
      restPitch1,
      restPitch2,
      restPitch3,
    };
  }

  // Primary Tendril 1 & Primary Tendril 2 (turn toward player, curl around each other, lean forward)
  const primaryTendril1 = buildArticulatedTendril(
    -0.08,
    0.22,
    0.04,
    -0.42,
    0.22,
    0.28,
    0.35,
  );
  const primaryTendril2 = buildArticulatedTendril(
    0.09,
    0.2,
    0.05,
    0.46,
    0.25,
    0.3,
    0.38,
  );
  // 3 Secondary Creeping Tendrils anchored over the stone and root
  const secondaryTendrils: ArticulatedTendril[] = [
    buildArticulatedTendril(-0.22, 0.24, -0.08, -1.35, 0.48, 0.36, 0.42),
    buildArticulatedTendril(0.2, 0.16, -0.06, 1.28, 0.52, 0.34, 0.4),
    buildArticulatedTendril(-0.04, 0.28, -0.18, 2.75, 0.44, 0.38, 0.36),
  ];

  // 6 Tiny Pollen Particles for the curious Vine reaction (ultra-low particle count)
  const vinePollenGeo = tracker.trackGeo(new THREE.SphereGeometry(0.016, 6, 6));
  const vinePollenMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ddd6fe'),
      transparent: true,
      opacity: 0.0,
    }),
  );
  const vinePollenMotes: THREE.Mesh[] = [];
  for (let pm = 0; pm < 6; pm++) {
    const mote = new THREE.Mesh(vinePollenGeo, vinePollenMat);
    mote.visible = false;
    vineInteractiveRoot.add(mote);
    vinePollenMotes.push(mote);
  }

  // Devil's-Snare Vine Interactive State Machine
  const VINE_ANIM_DURATION = 3.2;
  const VINE_COOLDOWN = 5.2;
  let vineAnimTime = -1;
  let vineCooldown = 0;
  let vineTargetLocalYaw = 0;

  return {
    group,
    plants,

    getInteractivePlantPrompt(
      playerWorldPos: THREE.Vector3,
    ): InteractivePlantPromptInfo | null {
      const distMandrake = Math.hypot(
        playerWorldPos.x - interactiveMandrakeWorldPos.x,
        playerWorldPos.z - interactiveMandrakeWorldPos.z,
      );
      const distVine = Math.hypot(
        playerWorldPos.x - interactiveVineWorldPos.x,
        playerWorldPos.z - interactiveVineWorldPos.z,
      );

      const mandrakeReady =
        distMandrake <= INTERACTIVE_TRIGGER_RADIUS &&
        mandrakeAnimTime < 0 &&
        mandrakeCooldown <= 0;
      const vineReady =
        distVine <= INTERACTIVE_TRIGGER_RADIUS &&
        vineAnimTime < 0 &&
        vineCooldown <= 0;

      if (mandrakeReady && (!vineReady || distMandrake <= distVine)) {
        return {
          id: 'f1_mandrake',
          title: 'Tucked Garden Mandrake',
          actionLabel: 'Examine the Mandrake',
          distance: distMandrake,
        };
      }
      if (vineReady) {
        return {
          id: 'f1_devils_snare',
          title: 'Creeping Shadow-Vine',
          actionLabel: 'Touch the Creeping Vine',
          distance: distVine,
        };
      }
      return null;
    },

    triggerInteractivePlant(
      playerWorldPos: THREE.Vector3,
    ): 'f1_mandrake' | 'f1_devils_snare' | 'none' {
      const prompt = this.getInteractivePlantPrompt(playerWorldPos);
      if (!prompt) return 'none';

      if (prompt.id === 'f1_mandrake') {
        mandrakeAnimTime = 0;
        mandrakeCooldown = MANDRAKE_COOLDOWN;
        const dx = playerWorldPos.x - interactiveMandrakeWorldPos.x;
        const dz = playerWorldPos.z - interactiveMandrakeWorldPos.z;
        const worldAngle = Math.atan2(dx, dz);
        mandrakeTargetYaw =
          ((worldAngle - mandrakeBaseYaw + Math.PI * 3) % (Math.PI * 2)) -
          Math.PI;
        audioSynth.playMandrakeInteractiveSqueak(performance.now() * 0.001);
        return 'f1_mandrake';
      }

      if (prompt.id === 'f1_devils_snare') {
        vineAnimTime = 0;
        vineCooldown = VINE_COOLDOWN;
        const dx = playerWorldPos.x - interactiveVineWorldPos.x;
        const dz = playerWorldPos.z - interactiveVineWorldPos.z;
        const worldAngle = Math.atan2(dx, dz);
        vineTargetLocalYaw =
          ((worldAngle - vineBaseYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        audioSynth.playVineRustleCreak(performance.now() * 0.001);
        return 'f1_devils_snare';
      }

      return 'none';
    },

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
    ): void {
      // 0A. Update Interactive Mandrake-Inspired Plant (local 20.6, 38.6)
      if (mandrakeCooldown > 0) {
        mandrakeCooldown = Math.max(0, mandrakeCooldown - dt);
      }

      if (mandrakeAnimTime >= 0) {
        mandrakeAnimTime += dt;
        const t = mandrakeAnimTime;

        if (t >= MANDRAKE_ANIM_DURATION) {
          // 9. Return cleanly to idle
          mandrakeAnimTime = -1;
          mandrakeBodyRig.position.set(0, MANDRAKE_IDLE_Y, 0);
          mandrakeBodyRig.rotation.set(0, mandrakeCurrentYaw, 0);
          mandrakeEyeLeftGroup.scale.setScalar(1.0);
          mandrakeEyeRightGroup.scale.setScalar(1.0);
          mandrakeMouthGroup.scale.set(0.85, 0.32, 1.0);
          mandrakeArmL.rotation.set(0, 0, 0);
          mandrakeArmR.rotation.set(0, 0, 0);
          for (let fl = 0; fl < mandrakeFallingLeaves.length; fl++) {
            mandrakeFallingLeaves[fl].visible = false;
          }
        } else {
          // 1. Notices player: smoothly turns toward player
          const noticeBlend = smoothstep01(t / 0.28) * (1.0 - smoothstep01((t - 1.9) / 0.7));
          mandrakeCurrentYaw = dampValue(
            mandrakeCurrentYaw,
            mandrakeTargetYaw * noticeBlend,
            10.0,
            dt,
          );

          // 2. Eyes widen slightly (0.05s -> 1.25s)
          const eyeWideEnv =
            smoothstep01((t - 0.04) / 0.18) *
            (1.0 - smoothstep01((t - 1.15) / 0.28));
          const eyeScale = 1.0 + eyeWideEnv * 0.42;
          mandrakeEyeLeftGroup.scale.setScalar(eyeScale);
          mandrakeEyeRightGroup.scale.setScalar(eyeScale);

          // 3 & 4. Leaves tremble + body/root mass wiggles (0.15s -> 1.25s)
          const wiggleEnv =
            smoothstep01((t - 0.12) / 0.18) *
            (1.0 - smoothstep01((t - 1.18) / 0.22));
          const bodyWiggleZ = Math.sin(t * 38.0) * 0.14 * wiggleEnv;
          const bodyWiggleY = Math.cos(t * 32.0) * 0.16 * wiggleEnv;

          // 5 & 7. Rises slightly from soil (0.48s -> 1.12s), then quickly drops back into soil (1.12s -> 1.42s)
          const riseUp = smoothstep01((t - 0.46) / 0.24);
          const dropDown = smoothstep01((t - 1.1) / 0.22);
          const settleBounce =
            t > 1.28 && t < 1.65
              ? -Math.sin(((t - 1.28) / 0.37) * Math.PI) * 0.035
              : 0.0;
          const verticalLift = (riseUp - dropDown) * 0.19 + settleBounce;

          mandrakeBodyRig.position.set(0, MANDRAKE_IDLE_Y + verticalLift, 0);
          mandrakeBodyRig.rotation.set(
            (riseUp - dropDown) * -0.08,
            mandrakeCurrentYaw + bodyWiggleY,
            bodyWiggleZ,
          );

          // 6. Tiny comedic squeak mouth "O" + stubby root-arm flare while risen
          const squeakEnv =
            smoothstep01((t - 0.52) / 0.14) *
            (1.0 - smoothstep01((t - 1.08) / 0.18));
          mandrakeMouthGroup.scale.set(
            0.85 + squeakEnv * 0.55,
            0.32 + squeakEnv * 0.95,
            1.0,
          );
          mandrakeArmL.rotation.z =
            -squeakEnv * 0.45 + Math.sin(t * 42.0) * 0.18 * wiggleEnv;
          mandrakeArmR.rotation.z =
            squeakEnv * 0.45 - Math.sin(t * 42.0) * 0.18 * wiggleEnv;

          // 8. Leaves tremble during jump and remain slightly shaken after dropping (1.35s -> 2.45s)
          const postShakeEnv =
            t >= 1.25
              ? Math.exp(-(t - 1.25) * 2.6) *
                (1.0 - smoothstep01((t - 2.2) / 0.4))
              : 0.0;
          const totalLeafTremble = wiggleEnv * 0.22 + postShakeEnv * 0.16;

          for (let l = 0; l < mandrakeLeafPivots.length; l++) {
            const lp = mandrakeLeafPivots[l];
            lp.rotation.z =
              Math.sin(t * 44.0 + l * 1.3) * totalLeafTremble;
            lp.rotation.x =
              Math.cos(t * 36.0 + l * 0.9) * totalLeafTremble * 0.7;
          }

          // Optional secondary reaction: 3 tiny leaves fluttering down when startled (0.55s -> 2.35s)
          for (let fl = 0; fl < mandrakeFallingLeaves.length; fl++) {
            const leafMesh = mandrakeFallingLeaves[fl];
            const flStart = 0.55 + fl * 0.08;
            const flAge = t - flStart;
            if (flAge > 0 && flAge < 1.75) {
              leafMesh.visible = true;
              const flProg = flAge / 1.75;
              const baseAng = fl * 2.1 + 0.5;
              const radius = 0.16 + flProg * 0.18;
              leafMesh.position.set(
                Math.cos(baseAng) * radius + Math.sin(flAge * 7.5 + fl) * 0.05,
                0.56 - flProg * 0.46,
                Math.sin(baseAng) * radius + Math.cos(flAge * 6.2 + fl) * 0.04,
              );
              leafMesh.rotation.set(
                flAge * 3.2 + fl,
                flAge * 4.5,
                Math.sin(flAge * 8.0 + fl) * 0.6,
              );
              const s = 1.0 - smoothstep01((flProg - 0.75) / 0.25);
              leafMesh.scale.setScalar(Math.max(0.01, s));
            } else {
              leafMesh.visible = false;
            }
          }
        }
      } else {
        // Calm idle breathing & gentle leaf sway for the Interactive Mandrake
        mandrakeCurrentYaw = dampValue(mandrakeCurrentYaw, 0, 3.5, dt);
        const idleBob = Math.sin(elapsedTime * 1.7) * 0.008;
        mandrakeBodyRig.position.set(0, MANDRAKE_IDLE_Y + idleBob, 0);
        mandrakeBodyRig.rotation.set(
          0,
          mandrakeCurrentYaw + Math.sin(elapsedTime * 0.9) * 0.06,
          Math.sin(elapsedTime * 1.3) * 0.025,
        );
        for (let l = 0; l < mandrakeLeafPivots.length; l++) {
          mandrakeLeafPivots[l].rotation.z =
            Math.sin(elapsedTime * 1.8 + l * 0.7) * 0.035;
          mandrakeLeafPivots[l].rotation.x = 0;
        }
      }

      // 0B. Update Interactive Devil's-Snare-Inspired Creeping Vine (local 33.6, 23.6)
      if (vineCooldown > 0) {
        vineCooldown = Math.max(0, vineCooldown - dt);
      }

      if (vineAnimTime >= 0) {
        vineAnimTime += dt;
        const t = vineAnimTime;

        if (t >= VINE_ANIM_DURATION) {
          // 8. Return cleanly to idle
          vineAnimTime = -1;
          for (let pm = 0; pm < vinePollenMotes.length; pm++) {
            vinePollenMotes[pm].visible = false;
          }
          vinePollenMat.opacity = 0;
        } else {
          // Retreat envelope after ~2.25s (curious hold lasts ~1.5s from 0.75s -> 2.25s)
          const retreatFade = 1.0 - smoothstep01((t - 2.25) / 0.95);

          // 1 & 2. Tendril 1 slowly turns toward player (0.0s -> 0.55s), Tendril 2 follows (0.28s -> 0.85s)
          const t1Turn = smoothstep01(t / 0.55) * retreatFade;
          const t2Turn = smoothstep01((t - 0.26) / 0.58) * retreatFade;

          // 4 & 5. Tendrils gently curl around each other & briefly lean toward player (0.65s -> 2.25s)
          const curlTogether =
            smoothstep01((t - 0.62) / 0.55) *
            (1.0 - smoothstep01((t - 2.15) / 0.75));
          const leanTowardPlayer =
            smoothstep01((t - 0.72) / 0.5) * retreatFade;

          // Central vine subtly turns & leans toward the player
          const centralYawDiff =
            ((vineTargetLocalYaw - centralVineYawGroup.rotation.y + Math.PI * 3) %
              (Math.PI * 2)) -
            Math.PI;
          centralVineYawGroup.rotation.y +=
            centralYawDiff * Math.min(1, dt * 5.0) * t1Turn;
          centralVineBase.rotation.x = leanTowardPlayer * 0.24;
          centralVineUpper.rotation.x = leanTowardPlayer * 0.28;

          // Tendril 1: turns toward player, curls inward (+z/+y helix), leans forward
          const t1TargetYaw = THREE.MathUtils.lerp(
            primaryTendril1.restYaw,
            vineTargetLocalYaw - 0.14 * (1.0 - curlTogether * 0.6),
            t1Turn,
          );
          primaryTendril1.yawGroup.rotation.y = t1TargetYaw;
          primaryTendril1.seg1.rotation.x =
            primaryTendril1.restPitch1 + leanTowardPlayer * 0.34;
          primaryTendril1.seg1.rotation.z = -curlTogether * 0.36;
          primaryTendril1.seg2.rotation.x =
            primaryTendril1.restPitch2 + curlTogether * 0.42;
          primaryTendril1.seg2.rotation.z =
            curlTogether * 0.52 + Math.sin(t * 4.2) * 0.08 * curlTogether;
          primaryTendril1.seg3.rotation.x =
            primaryTendril1.restPitch3 + curlTogether * 0.48;
          primaryTendril1.seg3.rotation.z = curlTogether * 0.45;

          // Tendril 2: follows shortly after, curls around Tendril 1 in complementary helix
          const t2TargetYaw = THREE.MathUtils.lerp(
            primaryTendril2.restYaw,
            vineTargetLocalYaw + 0.14 * (1.0 - curlTogether * 0.6),
            t2Turn,
          );
          primaryTendril2.yawGroup.rotation.y = t2TargetYaw;
          primaryTendril2.seg1.rotation.x =
            primaryTendril2.restPitch1 + leanTowardPlayer * 0.32;
          primaryTendril2.seg1.rotation.z = curlTogether * 0.38;
          primaryTendril2.seg2.rotation.x =
            primaryTendril2.restPitch2 + curlTogether * 0.46;
          primaryTendril2.seg2.rotation.z =
            -curlTogether * 0.54 - Math.sin(t * 4.2) * 0.08 * curlTogether;
          primaryTendril2.seg3.rotation.x =
            primaryTendril2.restPitch3 + curlTogether * 0.52;
          primaryTendril2.seg3.rotation.z = -curlTogether * 0.48;

          // Secondary tendrils subtly perk up in sympathy
          for (let st = 0; st < secondaryTendrils.length; st++) {
            const sec = secondaryTendrils[st];
            sec.seg2.rotation.x =
              sec.restPitch2 + curlTogether * 0.18;
            sec.seg3.rotation.x =
              sec.restPitch3 + curlTogether * 0.24;
          }

          // Optional secondary reaction: 6 tiny pollen particles drifting up during curl
          vinePollenMat.opacity = curlTogether * 0.72;
          for (let pm = 0; pm < vinePollenMotes.length; pm++) {
            const mote = vinePollenMotes[pm];
            mote.visible = curlTogether > 0.02;
            const pAng = pm * 1.047 + t * 1.4;
            const pRad = 0.12 + (pm % 2) * 0.07;
            mote.position.set(
              Math.cos(pAng) * pRad,
              0.42 + ((t * 0.28 + pm * 0.11) % 0.48),
              Math.sin(pAng) * pRad + leanTowardPlayer * 0.14,
            );
          }
        }
      } else {
        // Organic idle undulation for the Devil's-Snare Creeping Vine
        centralVineYawGroup.rotation.y = dampValue(
          centralVineYawGroup.rotation.y,
          Math.sin(elapsedTime * 0.8) * 0.12,
          2.5,
          dt,
        );
        centralVineBase.rotation.x = dampValue(
          centralVineBase.rotation.x,
          Math.sin(elapsedTime * 1.2) * 0.05,
          3.0,
          dt,
        );
        centralVineUpper.rotation.x = dampValue(
          centralVineUpper.rotation.x,
          Math.cos(elapsedTime * 1.5) * 0.07,
          3.0,
          dt,
        );

        const allTendrils = [
          primaryTendril1,
          primaryTendril2,
          ...secondaryTendrils,
        ];
        for (let idx = 0; idx < allTendrils.length; idx++) {
          const td = allTendrils[idx];
          const ph = idx * 1.3;
          td.yawGroup.rotation.y = dampValue(
            td.yawGroup.rotation.y,
            td.restYaw + Math.sin(elapsedTime * 0.9 + ph) * 0.08,
            3.2,
            dt,
          );
          td.seg1.rotation.x = dampValue(
            td.seg1.rotation.x,
            td.restPitch1 + Math.sin(elapsedTime * 1.4 + ph) * 0.05,
            3.2,
            dt,
          );
          td.seg1.rotation.z = dampValue(td.seg1.rotation.z, 0, 3.5, dt);
          td.seg2.rotation.x = dampValue(
            td.seg2.rotation.x,
            td.restPitch2 + Math.cos(elapsedTime * 1.7 + ph) * 0.06,
            3.2,
            dt,
          );
          td.seg2.rotation.z = dampValue(td.seg2.rotation.z, 0, 3.5, dt);
          td.seg3.rotation.x = dampValue(
            td.seg3.rotation.x,
            td.restPitch3 + Math.sin(elapsedTime * 2.1 + ph) * 0.07,
            3.2,
            dt,
          );
          td.seg3.rotation.z = dampValue(td.seg3.rotation.z, 0, 3.5, dt);
        }
      }

      // 1. Update Floating Bioluminescent Spore Motes above all 19 Magical Plants
      const posAttr = sporeGeo.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      for (let i = 0; i < sporeCount; i++) {
        const b = sporeBaseCoords[i];
        const cyc = (elapsedTime * b.speed + b.phase) % 1.0;
        const ang = elapsedTime * 1.15 + b.phase;
        const r = b.radius * (0.7 + 0.3 * Math.sin(cyc * Math.PI));
        posAttr.setXYZ(
          i,
          b.wx + Math.cos(ang) * r,
          b.wy + 0.22 + cyc * 1.45,
          b.wz + Math.sin(ang) * r,
        );
      }
      posAttr.needsUpdate = true;

      // 2. Update All 5 Reactive Magical Plant Species
      for (let i = 0; i < runtimes.length; i++) {
        const rt = runtimes[i];
        const dx = playerWorldPos.x - rt.worldPos.x;
        const dz = playerWorldPos.z - rt.worldPos.z;
        const dist = Math.hypot(dx, dz);

        if (rt.kind === 'mandrake_tuft') {
          if (rt.cooldown > 0) {
            rt.cooldown = Math.max(0, rt.cooldown - dt);
          }

          const shouldHide = dist <= rt.spec.triggerRadius;
          if (shouldHide && !rt.wasHidden && rt.cooldown <= 0) {
            audioSynth.playSqueak(false, elapsedTime);
            rt.cooldown = rt.spec.cooldownDuration;
          }
          rt.wasHidden = shouldHide;

          const targetHide = shouldHide ? 1.0 : 0.0;
          rt.hideProgress = dampValue(
            rt.hideProgress,
            targetHide,
            shouldHide ? 9.5 : 3.2,
            dt,
          );

          rt.tuftPivot.position.y = 0.36 - rt.hideProgress * 0.23;
          const leafFold = 1.0 - rt.hideProgress * 0.45;
          rt.leafCrown.scale.set(leafFold, 1.0, leafFold);

          const nervous =
            dist > rt.spec.triggerRadius && dist < 6.8
              ? 1.0 - (dist - rt.spec.triggerRadius) / 2.3
              : 0.0;
          rt.tuftPivot.rotation.z =
            Math.sin(elapsedTime * 18.0 + rt.phase) * 0.08 * nervous;
          rt.tuftPivot.rotation.y =
            Math.sin(elapsedTime * 1.4 + rt.phase) *
            0.12 *
            (1.0 - rt.hideProgress);
        } else if (rt.kind === 'tentacula_vine') {
          if (rt.cooldown > 0) {
            rt.cooldown = Math.max(0, rt.cooldown - dt);
          }

          const inRange = dist <= rt.spec.triggerRadius;
          if (inRange && rt.followTimer <= 0 && rt.cooldown <= 0) {
            rt.followTimer = 3.6;
          }

          if (rt.followTimer > 0) {
            rt.followTimer -= dt;
            if (rt.followTimer <= 0) {
              rt.cooldown = rt.spec.cooldownDuration;
            }
          }

          const isFollowing = inRange && rt.followTimer > 0;
          rt.followBlend = dampValue(
            rt.followBlend,
            isFollowing ? 1.0 : 0.0,
            3.8,
            dt,
          );

          if (rt.followBlend > 0.01) {
            const worldAngleToPlayer = Math.atan2(dx, dz) - rt.spec.rotationY;
            const diff =
              ((worldAngleToPlayer - rt.currentYaw + Math.PI * 3) %
                (Math.PI * 2)) -
              Math.PI;
            rt.currentYaw += diff * Math.min(1, dt * 4.5);
          } else {
            rt.currentYaw = dampValue(
              rt.currentYaw,
              Math.sin(elapsedTime * 0.7 + rt.phase) * 0.35,
              2.2,
              dt,
            );
          }

          rt.baseYawGroup.rotation.y = rt.currentYaw;
          const idleSway = Math.sin(elapsedTime * 1.6 + rt.phase) * 0.14;
          const leanForward = rt.followBlend * 0.34;
          rt.lowerStalk.rotation.x = idleSway * 0.5 + leanForward * 0.45;
          rt.midStalk.rotation.x = -idleSway * 0.6 + leanForward * 0.65;
          rt.upperHead.rotation.x = idleSway * 0.8 + leanForward * 0.55;
          rt.podMat.emissiveIntensity =
            0.55 +
            Math.sin(elapsedTime * 2.5 + rt.phase) * 0.08 +
            rt.followBlend * 0.26;
        } else if (rt.kind === 'bell_flower') {
          if (rt.cooldown > 0) {
            rt.cooldown = Math.max(0, rt.cooldown - dt);
          }

          const inRange = dist <= rt.spec.triggerRadius;
          if (inRange && rt.cooldown <= 0) {
            audioSynth.playChime(rt.pitchIdx, elapsedTime);
            rt.pulseTime = 2.6;
            rt.cooldown = rt.spec.cooldownDuration;
          }

          if (rt.pulseTime > 0) {
            rt.pulseTime = Math.max(0, rt.pulseTime - dt);
          }

          rt.bloomProgress = dampValue(
            rt.bloomProgress,
            inRange || rt.pulseTime > 0 ? 1.0 : 0.0,
            4.2,
            dt,
          );

          const petalAngle = 0.28 + rt.bloomProgress * 0.38;
          for (let p = 0; p < rt.petals.length; p++) {
            rt.petals[p].rotation.z =
              petalAngle +
              Math.sin(elapsedTime * 2.4 + rt.phase + p) * 0.03;
          }

          const chimeSwing =
            rt.pulseTime > 0
              ? Math.sin(elapsedTime * 14.0 + rt.phase) *
                0.045 *
                (rt.pulseTime / 2.6)
              : 0;
          for (let c = 0; c < rt.clappers.length; c++) {
            rt.clappers[c].position.x = chimeSwing;
          }

          const idleShimmer =
            Math.sin(elapsedTime * 2.2 + rt.phase) * 0.06;
          const pulseBoost =
            rt.pulseTime > 0
              ? Math.sin((rt.pulseTime / 2.6) * Math.PI) * 0.32
              : rt.bloomProgress * 0.22;
          rt.petalMat.emissiveIntensity = 0.54 + idleShimmer + pulseBoost;
        } else if (rt.kind === 'strange_bulb') {
          if (rt.cooldown > 0) {
            rt.cooldown = Math.max(0, rt.cooldown - dt);
          }

          const inRange = dist <= rt.spec.triggerRadius;
          if (inRange && rt.reactionTime < 0 && rt.cooldown <= 0) {
            rt.reactionTime = 0;
            rt.cooldown = rt.spec.cooldownDuration;
            audioSynth.playSqueak(true, elapsedTime);
          }

          if (rt.reactionTime >= 0) {
            rt.reactionTime += dt;
            const t = rt.reactionTime;
            if (t >= 2.8) {
              rt.reactionTime = -1;
              rt.bulbBodyGroup.scale.set(1, 1, 1);
              rt.veinMat.emissiveIntensity = 0.56;
            } else {
              const env =
                smoothstep01(t / 0.45) * (1.0 - smoothstep01((t - 1.9) / 0.9));
              const wobble =
                Math.sin(t * 16.5) * Math.exp(-t * 1.4) * 0.14 * env;
              const inflate = env * 0.26;
              rt.bulbBodyGroup.scale.set(
                1.0 + inflate + wobble,
                1.0 + inflate * 0.85 - wobble * 0.8,
                1.0 + inflate + wobble,
              );
              rt.veinMat.emissiveIntensity = 0.56 + env * 0.32;
            }
          } else {
            const breathe = Math.sin(elapsedTime * 1.8 + rt.phase) * 0.035;
            rt.bulbBodyGroup.scale.set(
              1.0 + breathe,
              1.0 - breathe * 0.6,
              1.0 + breathe,
            );
            rt.veinMat.emissiveIntensity =
              0.54 + Math.sin(elapsedTime * 2.4 + rt.phase) * 0.08;
          }
        } else if (rt.kind === 'moon_fern') {
          const inRange = dist <= rt.spec.triggerRadius;
          const targetUncurl = inRange
            ? smoothstep01(1.0 - (dist - 1.5) / (rt.spec.triggerRadius - 1.5))
            : 0.0;
          rt.uncurlProgress = dampValue(
            rt.uncurlProgress,
            targetUncurl,
            3.2,
            dt,
          );

          const targetYaw = inRange
            ? Math.sin(Math.atan2(dx, dz) - rt.spec.rotationY) * 0.25
            : 0.0;
          rt.currentYawOffset = dampValue(
            rt.currentYawOffset,
            targetYaw,
            2.5,
            dt,
          );
          rt.rosetteGroup.rotation.y = rt.currentYawOffset;

          const u = rt.uncurlProgress;
          const sway = Math.sin(elapsedTime * 1.5 + rt.phase) * 0.05;
          for (let f = 0; f < rt.frondChains.length; f++) {
            const chain = rt.frondChains[f];
            chain.baseJoint.rotation.z =
              THREE.MathUtils.lerp(-0.35, -0.82, u) + sway;
            chain.midJoint.rotation.z = THREE.MathUtils.lerp(
              -1.15,
              -0.24,
              u,
            );
            chain.tipJoint.rotation.z = THREE.MathUtils.lerp(
              -1.35,
              -0.18,
              u,
            );
          }
        }
      }
    },

    dispose(): void {
      audioSynth.dispose();
      tracker.dispose();
    },
  };
}
