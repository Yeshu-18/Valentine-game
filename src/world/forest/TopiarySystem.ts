import * as THREE from 'three';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  FOREST_SEED,
  castleLocalToWorld,
  dampValue,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';

export type TopiaryType =
  | 'wizard'
  | 'witch'
  | 'owl'
  | 'frog'
  | 'deer'
  | 'dragon'
  | 'bird'
  | 'cat'
  | 'rabbit'
  | 'serpent';

export interface TopiaryPlacementSpec {
  id: string;
  type: TopiaryType;
  localX: number;
  localZ: number;
  rotationY: number;
  scale: number;
  /** 0.0 = neatly trimmed near Greenhouse Exit; 1.0 = wild & overgrown deeper along the path */
  overgrowth: number;
}

export interface TopiarySystemBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  placements: ReadonlyArray<TopiaryPlacementSpec>;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

interface PuffSpec {
  x: number;
  y: number;
  z: number;
  r: number;
  sx: number;
  sy: number;
  sz: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
}

interface BranchSpec {
  x: number;
  y: number;
  z: number;
  rTop: number;
  rBot: number;
  len: number;
  rotX: number;
  rotZ: number;
}

function createBoxwoodLeafBumpTexture(
  tracker: ResourceTracker,
  seed: number,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  for (let i = 0; i < 3600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 1.2 + rand() * 2.8;
    const ry = 0.7 + rand() * 1.6;
    const ang = rand() * Math.PI;
    const shade = rand() > 0.46 ? 212 : 48;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.30)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Displaces an IcosahedronGeometry with organic 3D multi-frequency botanical clumping
 * so every topiary volume reads as dense sculpted foliage rather than a smooth primitive.
 */
function createPerturbedFoliagePuff(
  spec: PuffSpec,
  overgrowth: number,
  seedOffset: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(spec.r, 2);
  const pos = geo.attributes.position;
  const amp = spec.r * (0.14 + overgrowth * 0.14);
  const freq = 3.4 + (seedOffset % 5) * 0.45;
  const phase = seedOffset * 1.37;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;

    const wave1 =
      Math.sin(vx * freq + vy * (freq * 0.85) + phase) *
      Math.cos(vz * freq - vx * 0.75 - phase);
    const wave2 = Math.sin((vx + vz) * freq * 1.65 + vy * 2.1 + phase) * 0.52;
    // Unruly outward shoots on higher overgrowth levels
    const wildShoot =
      overgrowth > 0.25
        ? Math.max(0, Math.sin(vx * 6.2 + vz * 5.8 + seedOffset)) *
          overgrowth *
          spec.r *
          0.18
        : 0;

    const disp = (wave1 + wave2) * amp + wildShoot;
    pos.setXYZ(i, vx + nx * disp, vy + ny * disp * 0.9, vz + nz * disp);
  }

  geo.scale(spec.sx, spec.sy, spec.sz);
  if (spec.rotX) geo.rotateX(spec.rotX);
  if (spec.rotY) geo.rotateY(spec.rotY);
  if (spec.rotZ) geo.rotateZ(spec.rotZ);
  geo.translate(spec.x, spec.y, spec.z);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Returns the multi-puff botanical silhouette and internal woody branch armature
 * for each of the 10 TopiaryType creatures/figures.
 * All coordinates are relative to the top of the stone planter soil bed (Y = 0.58m).
 */
function getTopiaryRecipe(
  type: TopiaryType,
  overgrowth: number,
  rand: () => number,
): {
  puffs: PuffSpec[];
  branches: BranchSpec[];
} {
  const puffs: PuffSpec[] = [];
  const branches: BranchSpec[] = [
    // Central woody trunk rising from soil bed
    { x: 0, y: 0.42, z: 0, rTop: 0.08, rBot: 0.14, len: 0.84, rotX: 0.04, rotZ: -0.03 },
    { x: -0.14, y: 0.36, z: 0.08, rTop: 0.05, rBot: 0.09, len: 0.65, rotX: 0.18, rotZ: 0.28 },
    { x: 0.15, y: 0.38, z: -0.06, rTop: 0.05, rBot: 0.09, len: 0.65, rotX: -0.15, rotZ: -0.26 },
  ];

  switch (type) {
    case 'wizard': {
      // Flowing robe tiers, bearded head, raised staff arm, crooked pointed wizard hat
      puffs.push(
        { x: 0, y: 0.52, z: 0, r: 0.52, sx: 1.05, sy: 0.95, sz: 1.02 },
        { x: 0, y: 1.02, z: 0.02, r: 0.44, sx: 0.96, sy: 0.95, sz: 0.94 },
        { x: 0, y: 1.44, z: 0.04, r: 0.36, sx: 1.08, sy: 0.85, sz: 0.95 },
        // Flowing beard puff in front
        { x: 0, y: 1.56, z: 0.28, r: 0.22, sx: 0.85, sy: 1.25, sz: 0.78, rotX: 0.25 },
        // Left & right robe sleeves
        { x: -0.42, y: 1.28, z: 0.12, r: 0.21, sx: 0.82, sy: 1.25, sz: 0.82, rotZ: 0.42 },
        { x: 0.46, y: 1.42, z: 0.22, r: 0.22, sx: 0.82, sy: 1.32, sz: 0.82, rotZ: -0.58, rotX: 0.35 },
        // Head puff
        { x: 0, y: 1.82, z: 0.04, r: 0.26, sx: 0.95, sy: 1.0, sz: 0.95 },
        // Wide wizard hat brim (ring of overlapping flat puffs)
        { x: 0, y: 2.04, z: 0.04, r: 0.38, sx: 1.35, sy: 0.32, sz: 1.35, rotX: -0.12, rotZ: 0.08 },
        // Wizard hat cone & crooked tip
        { x: 0.03, y: 2.28, z: 0.0, r: 0.24, sx: 0.85, sy: 1.25, sz: 0.85, rotZ: -0.16 },
        { x: 0.12, y: 2.56, z: -0.06, r: 0.16, sx: 0.75, sy: 1.35, sz: 0.75, rotZ: -0.48, rotX: -0.22 },
      );
      // Wooden wizard staff held in right hand
      branches.push({
        x: 0.58,
        y: 1.18,
        z: 0.32,
        rTop: 0.035,
        rBot: 0.048,
        len: 2.25,
        rotX: 0.08,
        rotZ: -0.06,
      });
      puffs.push({ x: 0.64, y: 2.28, z: 0.4, r: 0.15, sx: 1.0, sy: 1.15, sz: 1.0 });
      break;
    }

    case 'witch': {
      // Bell-shaped flared skirt, corseted waist, cape shoulders, wide witch hat & broomstick
      puffs.push(
        { x: 0, y: 0.48, z: 0, r: 0.56, sx: 1.16, sy: 0.88, sz: 1.12 },
        { x: -0.24, y: 0.42, z: 0.18, r: 0.36, sx: 1.0, sy: 0.85, sz: 1.0 },
        { x: 0.24, y: 0.42, z: -0.16, r: 0.36, sx: 1.0, sy: 0.85, sz: 1.0 },
        { x: 0, y: 0.98, z: 0, r: 0.36, sx: 0.88, sy: 1.05, sz: 0.86 },
        { x: 0, y: 1.38, z: 0.02, r: 0.38, sx: 1.14, sy: 0.82, sz: 0.92 },
        { x: -0.38, y: 1.24, z: 0.1, r: 0.2, sx: 0.85, sy: 1.2, sz: 0.85, rotZ: 0.48 },
        { x: 0.38, y: 1.26, z: 0.14, r: 0.2, sx: 0.85, sy: 1.2, sz: 0.85, rotZ: -0.45 },
        { x: 0, y: 1.74, z: 0.04, r: 0.25, sx: 0.94, sy: 0.98, sz: 0.94 },
        // Sweeping witch hat brim & curved spire
        { x: 0, y: 1.96, z: 0.04, r: 0.42, sx: 1.42, sy: 0.28, sz: 1.38, rotX: -0.14, rotZ: -0.1 },
        { x: -0.04, y: 2.22, z: 0.0, r: 0.22, sx: 0.82, sy: 1.3, sz: 0.82, rotZ: 0.22 },
        { x: -0.16, y: 2.48, z: -0.08, r: 0.14, sx: 0.72, sy: 1.35, sz: 0.72, rotZ: 0.58 },
      );
      // Witch's twig broom resting at her left side
      branches.push({
        x: -0.52,
        y: 1.05,
        z: 0.22,
        rTop: 0.03,
        rBot: 0.042,
        len: 1.95,
        rotX: 0.14,
        rotZ: 0.16,
      });
      puffs.push({
        x: -0.64,
        y: 0.38,
        z: 0.12,
        r: 0.24,
        sx: 0.78,
        sy: 1.35,
        sz: 0.82,
        rotZ: 0.16,
      });
      break;
    }

    case 'owl': {
      // Perched plump owl on a horizontal branch pedestal, folded wings, ear tufts
      puffs.push(
        // Stone/moss perch cushion
        { x: 0, y: 0.36, z: 0, r: 0.42, sx: 1.25, sy: 0.65, sz: 0.95 },
        // Plump owl breast & body
        { x: 0, y: 0.92, z: 0.04, r: 0.46, sx: 0.96, sy: 1.18, sz: 0.92, rotX: 0.12 },
        // Folded left & right wings
        { x: -0.38, y: 0.92, z: -0.02, r: 0.28, sx: 0.62, sy: 1.35, sz: 0.95, rotZ: 0.18 },
        { x: 0.38, y: 0.92, z: -0.02, r: 0.28, sx: 0.62, sy: 1.35, sz: 0.95, rotZ: -0.18 },
        // Tail feathers behind
        { x: 0, y: 0.56, z: -0.34, r: 0.24, sx: 0.88, sy: 0.95, sz: 0.75, rotX: -0.45 },
        // Round owl head & facial disc
        { x: 0, y: 1.46, z: 0.08, r: 0.35, sx: 1.06, sy: 0.92, sz: 0.96 },
        // Left & right horned ear tufts
        { x: -0.24, y: 1.76, z: 0.1, r: 0.13, sx: 0.65, sy: 1.35, sz: 0.65, rotZ: 0.42 },
        { x: 0.24, y: 1.76, z: 0.1, r: 0.13, sx: 0.65, sy: 1.35, sz: 0.65, rotZ: -0.42 },
      );
      branches.push({
        x: 0,
        y: 0.46,
        z: 0.06,
        rTop: 0.09,
        rBot: 0.11,
        len: 1.05,
        rotX: 0,
        rotZ: Math.PI / 2,
      });
      break;
    }

    case 'frog': {
      // Crouched plump botanical frog on a broad lily-pad cushion with raised eye domes
      puffs.push(
        // Broad lily-pad foliage base
        { x: 0, y: 0.26, z: 0, r: 0.58, sx: 1.32, sy: 0.36, sz: 1.32 },
        // Plump crouched frog torso
        { x: 0, y: 0.68, z: -0.04, r: 0.46, sx: 1.08, sy: 0.82, sz: 1.22, rotX: -0.22 },
        // Vocal throat sac puff
        { x: 0, y: 0.78, z: 0.34, r: 0.28, sx: 1.02, sy: 0.85, sz: 0.92 },
        // Folded muscular hind legs
        { x: -0.42, y: 0.52, z: -0.16, r: 0.26, sx: 0.78, sy: 0.85, sz: 1.25, rotY: 0.28 },
        { x: 0.42, y: 0.52, z: -0.16, r: 0.26, sx: 0.78, sy: 0.85, sz: 1.25, rotY: -0.28 },
        // Front forelegs
        { x: -0.24, y: 0.48, z: 0.32, r: 0.16, sx: 0.72, sy: 1.15, sz: 0.72, rotX: 0.22 },
        { x: 0.24, y: 0.48, z: 0.32, r: 0.16, sx: 0.72, sy: 1.15, sz: 0.72, rotX: 0.22 },
        // Broad frog head & prominent twin eye domes
        { x: 0, y: 0.98, z: 0.22, r: 0.34, sx: 1.16, sy: 0.74, sz: 0.98 },
        { x: -0.18, y: 1.2, z: 0.26, r: 0.13, sx: 0.95, sy: 1.05, sz: 0.95 },
        { x: 0.18, y: 1.2, z: 0.26, r: 0.13, sx: 0.95, sy: 1.05, sz: 0.95 },
      );
      break;
    }

    case 'deer': {
      // Noble standing stag/doe with four pillar legs, arched neck, and branching antlers
      puffs.push(
        // Four slender foliage-wrapped legs
        { x: -0.22, y: 0.48, z: 0.34, r: 0.16, sx: 0.68, sy: 1.75, sz: 0.68 },
        { x: 0.22, y: 0.48, z: 0.34, r: 0.16, sx: 0.68, sy: 1.75, sz: 0.68 },
        { x: -0.22, y: 0.48, z: -0.36, r: 0.17, sx: 0.72, sy: 1.75, sz: 0.72 },
        { x: 0.22, y: 0.48, z: -0.36, r: 0.17, sx: 0.72, sy: 1.75, sz: 0.72 },
        // Barrel chest, flank & rump
        { x: 0, y: 0.98, z: 0.22, r: 0.36, sx: 0.88, sy: 0.92, sz: 1.12 },
        { x: 0, y: 0.95, z: -0.22, r: 0.34, sx: 0.85, sy: 0.88, sz: 1.15 },
        // Raised tail tuft
        { x: 0, y: 1.08, z: -0.62, r: 0.14, sx: 0.75, sy: 1.1, sz: 0.85, rotX: 0.45 },
        // Proudly arched neck
        { x: 0, y: 1.42, z: 0.42, r: 0.24, sx: 0.78, sy: 1.45, sz: 0.82, rotX: 0.28 },
        // Sculpted head & snout
        { x: 0, y: 1.78, z: 0.56, r: 0.22, sx: 0.82, sy: 0.82, sz: 1.32, rotX: 0.15 },
        // Leafy ear puffs
        { x: -0.18, y: 1.92, z: 0.44, r: 0.11, sx: 1.25, sy: 0.65, sz: 0.65, rotZ: 0.45 },
        { x: 0.18, y: 1.92, z: 0.44, r: 0.11, sx: 1.25, sy: 0.65, sz: 0.65, rotZ: -0.45 },
        // Antler crown puffs
        { x: -0.26, y: 2.22, z: 0.36, r: 0.14, sx: 1.15, sy: 0.85, sz: 0.85 },
        { x: 0.26, y: 2.22, z: 0.36, r: 0.14, sx: 1.15, sy: 0.85, sz: 0.85 },
      );
      // Woody stag antlers rising from the head
      branches.push(
        { x: -0.16, y: 2.08, z: 0.4, rTop: 0.022, rBot: 0.038, len: 0.58, rotX: -0.25, rotZ: 0.42 },
        { x: 0.16, y: 2.08, z: 0.4, rTop: 0.022, rBot: 0.038, len: 0.58, rotX: -0.25, rotZ: -0.42 },
        { x: -0.28, y: 2.22, z: 0.44, rTop: 0.018, rBot: 0.028, len: 0.38, rotX: 0.35, rotZ: 0.72 },
        { x: 0.28, y: 2.22, z: 0.44, rTop: 0.018, rBot: 0.028, len: 0.38, rotX: 0.35, rotZ: -0.72 },
      );
      break;
    }

    case 'dragon': {
      // Rearing winged dragon with coiled tail, muscular chest, spread wings & horned head
      puffs.push(
        // Coiled tail base on planter
        { x: 0, y: 0.42, z: -0.18, r: 0.48, sx: 1.15, sy: 0.72, sz: 1.18 },
        { x: 0.28, y: 0.38, z: -0.48, r: 0.28, sx: 0.95, sy: 0.75, sz: 1.25, rotY: 0.55 },
        { x: -0.18, y: 0.52, z: -0.68, r: 0.2, sx: 0.8, sy: 0.85, sz: 1.35, rotX: 0.35 },
        // Rearing dragon torso & chest
        { x: 0, y: 0.96, z: 0.02, r: 0.42, sx: 0.95, sy: 1.18, sz: 0.95, rotX: -0.18 },
        { x: 0, y: 1.46, z: 0.12, r: 0.34, sx: 0.92, sy: 1.15, sz: 0.9, rotX: 0.15 },
        // Spread left & right dragon wings (2 puffs per wing)
        { x: -0.52, y: 1.48, z: -0.04, r: 0.32, sx: 1.38, sy: 0.78, sz: 0.52, rotZ: 0.48, rotY: 0.25 },
        { x: -0.88, y: 1.76, z: -0.14, r: 0.26, sx: 1.42, sy: 0.72, sz: 0.48, rotZ: 0.22, rotY: 0.35 },
        { x: 0.52, y: 1.48, z: -0.04, r: 0.32, sx: 1.38, sy: 0.78, sz: 0.52, rotZ: -0.48, rotY: -0.25 },
        { x: 0.88, y: 1.76, z: -0.14, r: 0.26, sx: 1.42, sy: 0.72, sz: 0.48, rotZ: -0.22, rotY: -0.35 },
        // Sinuous neck, fierce snout & swept crest horns
        { x: 0, y: 1.88, z: 0.26, r: 0.24, sx: 0.78, sy: 1.25, sz: 0.82, rotX: 0.35 },
        { x: 0, y: 2.16, z: 0.46, r: 0.24, sx: 0.82, sy: 0.78, sz: 1.38, rotX: 0.18 },
        { x: -0.14, y: 2.34, z: 0.24, r: 0.12, sx: 0.65, sy: 1.35, sz: 0.75, rotX: -0.55, rotZ: 0.28 },
        { x: 0.14, y: 2.34, z: 0.24, r: 0.12, sx: 0.65, sy: 1.35, sz: 0.75, rotX: -0.55, rotZ: -0.28 },
      );
      break;
    }

    case 'bird': {
      // Crested songbird / phoenix perched on a floral mound with swept wings and plumed tail
      puffs.push(
        { x: 0, y: 0.38, z: 0, r: 0.38, sx: 1.12, sy: 0.72, sz: 1.08 },
        { x: 0, y: 0.88, z: 0.06, r: 0.42, sx: 0.92, sy: 1.05, sz: 1.18, rotX: -0.24 },
        // Swept half-open wings
        { x: -0.38, y: 0.98, z: -0.02, r: 0.26, sx: 1.25, sy: 0.68, sz: 0.92, rotZ: 0.42, rotY: 0.2 },
        { x: 0.38, y: 0.98, z: -0.02, r: 0.26, sx: 1.25, sy: 0.68, sz: 0.92, rotZ: -0.42, rotY: -0.2 },
        // Long sweeping tail plume
        { x: 0, y: 0.72, z: -0.48, r: 0.24, sx: 0.78, sy: 0.68, sz: 1.55, rotX: 0.38 },
        { x: 0, y: 0.58, z: -0.82, r: 0.18, sx: 0.68, sy: 0.58, sz: 1.45, rotX: 0.22 },
        // Bird head, beak & royal crest plume
        { x: 0, y: 1.34, z: 0.26, r: 0.26, sx: 0.92, sy: 0.95, sz: 1.02 },
        { x: 0, y: 1.36, z: 0.52, r: 0.12, sx: 0.62, sy: 0.62, sz: 1.35, rotX: 0.12 },
        { x: 0, y: 1.62, z: 0.14, r: 0.15, sx: 0.68, sy: 1.35, sz: 0.95, rotX: -0.48 },
      );
      break;
    }

    case 'cat': {
      // Seated slender feline with arched back, pointed ears & tall S-curved tail
      puffs.push(
        // Seated haunches
        { x: 0, y: 0.48, z: -0.12, r: 0.42, sx: 0.96, sy: 0.92, sz: 1.12 },
        // Upright chest & tucked front paws
        { x: 0, y: 0.88, z: 0.14, r: 0.34, sx: 0.86, sy: 1.18, sz: 0.88, rotX: 0.18 },
        { x: -0.14, y: 0.32, z: 0.32, r: 0.15, sx: 0.75, sy: 0.85, sz: 1.1 },
        { x: 0.14, y: 0.32, z: 0.32, r: 0.15, sx: 0.75, sy: 0.85, sz: 1.1 },
        // Feline head & pointed ears
        { x: 0, y: 1.38, z: 0.22, r: 0.28, sx: 0.98, sy: 0.92, sz: 0.96 },
        { x: -0.16, y: 1.66, z: 0.22, r: 0.11, sx: 0.68, sy: 1.38, sz: 0.68, rotZ: 0.25 },
        { x: 0.16, y: 1.66, z: 0.22, r: 0.11, sx: 0.68, sy: 1.38, sz: 0.68, rotZ: -0.25 },
        // S-curved upright cat tail
        { x: 0, y: 0.78, z: -0.48, r: 0.16, sx: 0.68, sy: 1.45, sz: 0.68, rotX: -0.35 },
        { x: 0.08, y: 1.18, z: -0.62, r: 0.14, sx: 0.65, sy: 1.45, sz: 0.65, rotX: 0.25, rotZ: -0.22 },
        { x: 0.16, y: 1.52, z: -0.56, r: 0.12, sx: 0.78, sy: 1.15, sz: 0.78, rotZ: -0.48 },
      );
      break;
    }

    case 'rabbit': {
      // Alert upright woodland hare with rounded haunches, tucked paws, and tall twin ears
      puffs.push(
        { x: 0, y: 0.48, z: -0.08, r: 0.44, sx: 1.04, sy: 0.92, sz: 1.12 },
        // Fluffy cotton tail puff behind
        { x: 0, y: 0.44, z: -0.48, r: 0.18, sx: 0.95, sy: 0.95, sz: 0.95 },
        // Upright torso & tucked forepaws
        { x: 0, y: 0.96, z: 0.06, r: 0.34, sx: 0.88, sy: 1.18, sz: 0.88, rotX: 0.12 },
        { x: -0.14, y: 0.94, z: 0.34, r: 0.13, sx: 0.72, sy: 0.85, sz: 1.15, rotX: 0.35 },
        { x: 0.14, y: 0.94, z: 0.34, r: 0.13, sx: 0.72, sy: 0.85, sz: 1.15, rotX: 0.35 },
        // Hare head & cheeks
        { x: 0, y: 1.42, z: 0.14, r: 0.27, sx: 0.94, sy: 0.92, sz: 1.08 },
        // Tall twin rabbit ears
        { x: -0.12, y: 1.88, z: 0.08, r: 0.14, sx: 0.58, sy: 2.15, sz: 0.68, rotZ: 0.14, rotX: -0.12 },
        { x: 0.12, y: 1.88, z: 0.08, r: 0.14, sx: 0.58, sy: 2.15, sz: 0.68, rotZ: -0.14, rotX: -0.12 },
      );
      break;
    }

    case 'serpent': {
      // Coiling S-curve guardian serpent rising with a flared botanical hood
      puffs.push(
        // Lower coils on stone planter
        { x: -0.22, y: 0.36, z: 0.18, r: 0.32, sx: 1.25, sy: 0.68, sz: 1.05, rotY: 0.4 },
        { x: 0.24, y: 0.44, z: -0.16, r: 0.32, sx: 1.22, sy: 0.72, sz: 1.05, rotY: -0.4 },
        { x: -0.12, y: 0.68, z: -0.24, r: 0.28, sx: 1.05, sy: 0.88, sz: 1.05 },
        // Rising S-curve neck
        { x: 0.14, y: 1.04, z: -0.04, r: 0.25, sx: 0.88, sy: 1.22, sz: 0.88, rotZ: -0.28 },
        { x: -0.08, y: 1.44, z: 0.12, r: 0.24, sx: 0.88, sy: 1.22, sz: 0.88, rotZ: 0.26 },
        // Flared serpent hood & poised head
        { x: 0, y: 1.78, z: 0.22, r: 0.32, sx: 1.42, sy: 0.88, sz: 0.68, rotX: 0.22 },
        { x: 0, y: 1.96, z: 0.38, r: 0.22, sx: 0.88, sy: 0.78, sz: 1.28, rotX: 0.15 },
      );
      break;
    }
  }

  // Add progressive overgrowth shoots and wild side-puffs for higher overgrowth levels
  const extraPuffCount = Math.floor(overgrowth * 4.5);
  for (let i = 0; i < extraPuffCount; i++) {
    const ang = rand() * Math.PI * 2;
    const h = 0.45 + rand() * 1.35;
    const dist = 0.28 + rand() * 0.25;
    puffs.push({
      x: Math.cos(ang) * dist,
      y: h,
      z: Math.sin(ang) * dist,
      r: 0.14 + rand() * 0.12,
      sx: 0.9 + rand() * 0.5,
      sy: 0.8 + rand() * 0.5,
      sz: 0.9 + rand() * 0.5,
      rotX: (rand() - 0.5) * 0.8,
      rotZ: (rand() - 0.5) * 0.8,
    });
  }

  // Add protruding woody twigs sticking out of the foliage (more abundant as overgrowth increases)
  const twigCount = 4 + Math.floor(overgrowth * 9);
  for (let t = 0; t < twigCount; t++) {
    const ang = (t / twigCount) * Math.PI * 2 + rand() * 0.5;
    const y = 0.55 + rand() * 1.45;
    const rDist = 0.26 + rand() * 0.22;
    const len = 0.28 + overgrowth * 0.32 + rand() * 0.18;
    branches.push({
      x: Math.cos(ang) * rDist,
      y,
      z: Math.sin(ang) * rDist,
      rTop: 0.009,
      rBot: 0.022,
      len,
      rotX: Math.sin(ang) * (0.65 + rand() * 0.45),
      rotZ: -Math.cos(ang) * (0.65 + rand() * 0.45),
    });
  }

  return { puffs, branches };
}

/**
 * Builds Phase F1 Zone 2 (+ Zone 4 Overgrown Transition): The Enchanted Topiary System.
 * - Uses deterministic RNG with FOREST_SEED = 74291.
 * - 12 living boxwood/yew topiaries spanning all 10 TopiaryType silhouettes.
 * - Grounded in weathered stone planters with dark soil, moss cushions, small blossoms,
 *   internal branch skeletons, and protruding twigs.
 * - Colliders placed strictly on the stone planter base so foliage/twigs never snag the player.
 */
export function createTopiarySystem(): TopiarySystemBundle {
  const group = new THREE.Group();
  group.name = 'EnchantedTopiarySystem';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED + 101);

  const leafBumpTex = createBoxwoodLeafBumpTexture(tracker, FOREST_SEED + 202);

  // Shared PBR Materials
  const planterStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#847d74'),
      roughness: 0.84,
      metalness: 0.04,
    }),
  );
  const crackedMossStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#656d5d'),
      roughness: 0.88,
      metalness: 0.03,
    }),
  );
  const darkSoilMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b281e'),
      roughness: 0.94,
      metalness: 0.01,
    }),
  );
  const branchWoodMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3222'),
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  const mossCushionMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6a34'),
      roughness: 0.86,
      metalness: 0.01,
    }),
  );

  // 3 subtle boxwood foliage shades (vibrant emerald -> lush yew -> mossy sage, with warm sunlit-at-dusk bounce)
  const foliageTrimmedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3fa656'),
      emissive: new THREE.Color('#1e4d2b'),
      emissiveIntensity: 0.36,
      roughness: 0.62,
      metalness: 0.02,
      bumpMap: leafBumpTex,
      bumpScale: 0.035,
    }),
  );
  const foliageMidMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#35914a'),
      emissive: new THREE.Color('#1a4425'),
      emissiveIntensity: 0.34,
      roughness: 0.64,
      metalness: 0.02,
      bumpMap: leafBumpTex,
      bumpScale: 0.04,
    }),
  );
  const foliageWildMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2c7d3f'),
      emissive: new THREE.Color('#163a20'),
      emissiveIntensity: 0.3,
      roughness: 0.68,
      metalness: 0.02,
      bumpMap: leafBumpTex,
      bumpScale: 0.045,
    }),
  );

  // Bioluminescent blossom accents & warm planter rune ring materials
  const blossomLavenderMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5d0fe'),
      emissive: new THREE.Color('#c084fc'),
      emissiveIntensity: 0.72,
      roughness: 0.28,
    }),
  );
  const blossomCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.75,
      roughness: 0.26,
    }),
  );
  const blossomRoseMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.72,
      roughness: 0.28,
    }),
  );
  const planterRuneGoldMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.68,
      roughness: 0.26,
    }),
  );

  // Shared Planter Base Geometries
  const planterBodyGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.82, 0.92, 0.56, 10),
  );
  planterBodyGeo.translate(0, 0.28, 0);

  const planterRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.84, 0.085, 8, 20),
  );
  planterRimGeo.rotateX(Math.PI / 2);
  planterRimGeo.translate(0, 0.56, 0);

  const planterRuneBandGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.87, 0.028, 6, 24),
  );
  planterRuneBandGeo.rotateX(Math.PI / 2);
  planterRuneBandGeo.translate(0, 0.42, 0);

  const planterGroundHaloGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.92, 1.08, 24),
  );
  planterGroundHaloGeo.rotateX(-Math.PI / 2);
  planterGroundHaloGeo.translate(0, 0.03, 0);

  const soilDiscGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.76, 0.76, 0.08, 10),
  );
  soilDiscGeo.translate(0, 0.55, 0);

  const flowerBudGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.056, 0),
  );

  // 12 Curated Topiary Placements along the Phase F1 Garden Spline (localX, localZ)
  // Symmetrical honor-guard pairs near the Greenhouse Exit, becoming staggered & wilder deeper in
  const placements: TopiaryPlacementSpec[] = [
    // Pair 1 (s ~ 5.5m, Zone 1/2 threshold): Symmetrical Wizard & Witch greeting Harsha outside the Greenhouse
    {
      id: 'topiary_wizard_entry',
      type: 'wizard',
      localX: 15.8,
      localZ: 40.9,
      rotationY: -Math.PI * 0.48,
      scale: 1.05,
      overgrowth: 0.08,
    },
    {
      id: 'topiary_witch_entry',
      type: 'witch',
      localX: 15.8,
      localZ: 35.4,
      rotationY: Math.PI * 0.48,
      scale: 1.05,
      overgrowth: 0.1,
    },
    // Pair 2 (s ~ 9.8m, Zone 2 Topiary Garden): Owl & Frog flanking the stone walk
    {
      id: 'topiary_owl_north',
      type: 'owl',
      localX: 19.8,
      localZ: 40.4,
      rotationY: -Math.PI * 0.42,
      scale: 1.0,
      overgrowth: 0.16,
    },
    {
      id: 'topiary_frog_south',
      type: 'frog',
      localX: 19.2,
      localZ: 34.8,
      rotationY: Math.PI * 0.55,
      scale: 1.02,
      overgrowth: 0.18,
    },
    // Pair 3 (s ~ 14.2m, Zone 2 Centerpiece): Stag Deer & Crested Songbird
    {
      id: 'topiary_deer_north',
      type: 'deer',
      localX: 24.4,
      localZ: 38.6,
      rotationY: -Math.PI * 0.36,
      scale: 1.08,
      overgrowth: 0.24,
    },
    {
      id: 'topiary_bird_south',
      type: 'bird',
      localX: 22.8,
      localZ: 32.9,
      rotationY: Math.PI * 0.62,
      scale: 0.98,
      overgrowth: 0.26,
    },
    // Pair 4 (s ~ 18.8m, Zone 2/3): Seated Cat & Alert Woodland Rabbit
    {
      id: 'topiary_cat_north',
      type: 'cat',
      localX: 28.5,
      localZ: 35.6,
      rotationY: -Math.PI * 0.32,
      scale: 1.0,
      overgrowth: 0.36,
    },
    {
      id: 'topiary_rabbit_south',
      type: 'rabbit',
      localX: 26.4,
      localZ: 30.2,
      rotationY: Math.PI * 0.68,
      scale: 1.0,
      overgrowth: 0.4,
    },
    // Pair 5 (s ~ 23.5m, Zone 3/4 Transition): Rearing Dragon & Coiled Serpent
    {
      id: 'topiary_dragon_north',
      type: 'dragon',
      localX: 32.8,
      localZ: 31.2,
      rotationY: -Math.PI * 0.28,
      scale: 1.12,
      overgrowth: 0.52,
    },
    {
      id: 'topiary_serpent_south',
      type: 'serpent',
      localX: 30.2,
      localZ: 25.8,
      rotationY: Math.PI * 0.72,
      scale: 1.04,
      overgrowth: 0.58,
    },
    // Pair 6 (s ~ 29.5m, Zone 4 Overgrown Transition): Neglected Mossy Stag & Overgrown Owl Sentinel
    {
      id: 'topiary_deer_overgrown',
      type: 'deer',
      localX: 36.8,
      localZ: 24.4,
      rotationY: -Math.PI * 0.22,
      scale: 1.06,
      overgrowth: 0.76,
    },
    {
      id: 'topiary_owl_overgrown',
      type: 'owl',
      localX: 34.0,
      localZ: 19.2,
      rotationY: Math.PI * 0.78,
      scale: 0.96,
      overgrowth: 0.85,
    },
  ];

  interface TopiaryInstanceRig {
    spec: TopiaryPlacementSpec;
    worldPos: THREE.Vector3;
    foliageCrownPivot: THREE.Group;
    rustleFactor: number;
    phase: number;
  }

  const rigs: TopiaryInstanceRig[] = [];

  placements.forEach((spec, idx) => {
    const worldCoords = castleLocalToWorld(spec.localX, spec.localZ);
    const groundY = getTerrainHeight(worldCoords.x, worldCoords.z);

    const root = new THREE.Group();
    root.name = `Topiary_${spec.id}`;
    // Slightly sink & tilt planter in overgrown zones
    const sinkY = spec.overgrowth * 0.08;
    root.position.set(worldCoords.x, groundY - sinkY, worldCoords.z);
    // Convert local rotationY to world space (schoolRoot has rotation.y = -Math.PI / 4)
    root.rotation.y = spec.rotationY - Math.PI / 4;
    if (spec.overgrowth > 0.4) {
      root.rotation.x = (rand() - 0.5) * spec.overgrowth * 0.1;
      root.rotation.z = (rand() - 0.5) * spec.overgrowth * 0.1;
    }
    root.scale.setScalar(spec.scale);
    group.add(root);

    // Meaningful collider strictly on the stone planter base
    colliders.push({
      x: worldCoords.x,
      z: worldCoords.z,
      radius: 0.88 * spec.scale,
    });

    // 1. Grounded Stone Planter & Soil Bed
    const pMat =
      spec.overgrowth > 0.45 ? crackedMossStoneMat : planterStoneMat;
    const planterBody = new THREE.Mesh(planterBodyGeo, pMat);
    planterBody.castShadow = true;
    planterBody.receiveShadow = true;

    const planterRim = new THREE.Mesh(planterRimGeo, pMat);
    planterRim.castShadow = true;
    planterRim.receiveShadow = true;

    const soilDisc = new THREE.Mesh(soilDiscGeo, darkSoilMat);
    soilDisc.receiveShadow = true;

    const runeBand = new THREE.Mesh(planterRuneBandGeo, planterRuneGoldMat);
    const groundHalo = new THREE.Mesh(
      planterGroundHaloGeo,
      idx % 2 === 0 ? planterRuneGoldMat : blossomCreamMat,
    );
    groundHalo.position.y = sinkY;
    root.add(planterBody, planterRim, soilDisc, runeBand, groundHalo);

    // 2. Moss Cushions around the Planter Base & Soil Edge (more abundant with overgrowth)
    const mossCount = 3 + Math.floor(spec.overgrowth * 6);
    const mossGeos: THREE.BufferGeometry[] = [];
    for (let m = 0; m < mossCount; m++) {
      const mAng = (m / mossCount) * Math.PI * 2 + rand() * 0.6;
      const isBaseMoss = m % 2 === 0;
      const mr = isBaseMoss ? 0.86 + rand() * 0.12 : 0.62 + rand() * 0.18;
      const my = isBaseMoss ? 0.08 + rand() * 0.14 : 0.57;
      const mGeo = createPerturbedFoliagePuff(
        {
          x: Math.cos(mAng) * mr,
          y: my,
          z: Math.sin(mAng) * mr,
          r: 0.15 + spec.overgrowth * 0.09 + rand() * 0.06,
          sx: 1.35,
          sy: 0.48,
          sz: 1.25,
          rotY: mAng,
        },
        0.3,
        idx * 31 + m,
      );
      mossGeos.push(mGeo);
    }
    if (mossGeos.length > 0) {
      const mergedMoss = tracker.trackGeo(mergeGeometries(mossGeos));
      mossGeos.forEach((g) => g.dispose());
      const mossMesh = new THREE.Mesh(mergedMoss, mossCushionMat);
      mossMesh.receiveShadow = true;
      root.add(mossMesh);
    }

    // 3. Sculpted Multi-Puff Foliage Crown + Internal Branch Skeleton + Twigs
    const crownPivot = new THREE.Group();
    crownPivot.position.set(0, 0.56, 0);
    root.add(crownPivot);

    const recipe = getTopiaryRecipe(spec.type, spec.overgrowth, rand);

    // Merge foliage puffs for this topiary into a single draw call
    const puffGeos = recipe.puffs.map((pSpec, pIdx) =>
      createPerturbedFoliagePuff(pSpec, spec.overgrowth, idx * 97 + pIdx * 13),
    );
    const mergedFoliageGeo = tracker.trackGeo(mergeGeometries(puffGeos));
    puffGeos.forEach((g) => g.dispose());

    const foliageMat =
      spec.overgrowth < 0.25
        ? foliageTrimmedMat
        : spec.overgrowth < 0.55
          ? foliageMidMat
          : foliageWildMat;

    const foliageMesh = new THREE.Mesh(mergedFoliageGeo, foliageMat);
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    crownPivot.add(foliageMesh);

    // Merge internal woody trunk & protruding twigs into a single draw call
    const branchGeos = recipe.branches.map((b) => {
      const cyl = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 6);
      cyl.rotateX(b.rotX);
      cyl.rotateZ(b.rotZ);
      cyl.translate(b.x, b.y, b.z);
      return cyl;
    });
    if (branchGeos.length > 0) {
      const mergedBranches = tracker.trackGeo(mergeGeometries(branchGeos));
      branchGeos.forEach((g) => g.dispose());
      const branchMesh = new THREE.Mesh(mergedBranches, branchWoodMat);
      branchMesh.castShadow = true;
      crownPivot.add(branchMesh);
    }

    // 4. Small Restrained Flowers nestled on the lower foliage & planter soil
    const flowerCount = 5 + Math.floor((1.0 - spec.overgrowth * 0.4) * 5);
    const flowerGeos: THREE.BufferGeometry[] = [];
    for (let f = 0; f < flowerCount; f++) {
      const fPuff = recipe.puffs[f % Math.min(4, recipe.puffs.length)];
      const fAng = (f / flowerCount) * Math.PI * 2 + rand() * 0.5;
      const fx = fPuff.x + Math.cos(fAng) * (fPuff.r * fPuff.sx * 0.92);
      const fy = fPuff.y + (rand() - 0.3) * fPuff.r * 0.6;
      const fz = fPuff.z + Math.sin(fAng) * (fPuff.r * fPuff.sz * 0.92);
      const fg = flowerBudGeo.clone();
      fg.translate(fx, fy, fz);
      flowerGeos.push(fg);
    }
    if (flowerGeos.length > 0) {
      const mergedFlowers = tracker.trackGeo(mergeGeometries(flowerGeos));
      flowerGeos.forEach((g) => g.dispose());
      const fMat =
        idx % 3 === 0
          ? blossomLavenderMat
          : idx % 3 === 1
            ? blossomCreamMat
            : blossomRoseMat;
      const flowerMesh = new THREE.Mesh(mergedFlowers, fMat);
      crownPivot.add(flowerMesh);
    }

    rigs.push({
      spec,
      worldPos: new THREE.Vector3(worldCoords.x, groundY, worldCoords.z),
      foliageCrownPivot: crownPivot,
      rustleFactor: 0,
      phase: idx * 1.17 + rand() * 2.0,
    });
  });

  return {
    group,
    colliders,
    placements,

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
    ): void {
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i];
        const dist = Math.hypot(
          playerWorldPos.x - rig.worldPos.x,
          playerWorldPos.z - rig.worldPos.z,
        );

        // Subtle living rustle when Harsha walks close to a sculpted topiary
        const targetRustle = dist < 4.4 ? 1.0 - dist / 4.4 : 0.0;
        rig.rustleFactor = dampValue(rig.rustleFactor, targetRustle, 5.5, dt);

        const baseWindX =
          Math.sin(elapsedTime * 1.35 + rig.phase) *
          (0.014 + rig.spec.overgrowth * 0.012);
        const baseWindZ =
          Math.cos(elapsedTime * 1.1 + rig.phase * 0.8) *
          (0.012 + rig.spec.overgrowth * 0.01);

        const rustleX =
          Math.sin(elapsedTime * 11.5 + rig.phase) * 0.032 * rig.rustleFactor;
        const rustleY =
          Math.cos(elapsedTime * 9.0 + rig.phase) * 0.045 * rig.rustleFactor;

        rig.foliageCrownPivot.rotation.set(
          baseWindX + rustleX,
          rustleY,
          baseWindZ - rustleX * 0.7,
        );
      }
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
