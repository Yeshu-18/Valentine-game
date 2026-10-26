/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  FOREST_SEED,
  castleLocalToWorld,
  dampValue,
  getTerrainHeight,
  mulberry32,
  smoothstep01,
} from '../terrainMath';
import { ForestAudioSynthesizer } from './ForestAudio';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';

export interface MushroomGroveBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  centerWorldPos: THREE.Vector3;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

export type MushroomVariant = 'small' | 'medium' | 'tall' | 'clustered' | 'curved';

interface MushroomInstanceData {
  localX: number;
  localZ: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  variant: MushroomVariant;
  colorType: 'cyan' | 'violet' | 'amber';
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  phase: number;
}

/**
 * Creates an organic mushroom cap geometry based on variant.
 */
function createMushroomCapGeo(variant: MushroomVariant, seed: number): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  if (variant === 'small') {
    // Hemispherical button cap
    geo = new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    geo.scale(1.0, 0.72, 1.0);
  } else if (variant === 'medium') {
    // Flared dome with curved lip
    geo = new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    geo.scale(1.12, 0.65, 1.12);
  } else if (variant === 'tall') {
    // Slender conical bell cap
    geo = new THREE.ConeGeometry(0.18, 0.34, 10, 2);
    geo.translate(0, 0.17, 0);
  } else if (variant === 'clustered') {
    // Small rounded parasol cap
    geo = new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.54);
    geo.scale(1.05, 0.75, 1.05);
  } else {
    // Downward curved bell cap
    geo = new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.68);
    geo.scale(0.92, 1.05, 0.92);
  }

  // Subtle organic rim perturbation
  const pos = geo.attributes.position;
  const rand = mulberry32(seed);
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vz);
    if (len > 0.05) {
      const wobble = Math.sin(Math.atan2(vz, vx) * 5 + seed) * 0.018 * (rand() * 0.6 + 0.7);
      pos.setXYZ(i, vx * (1 + wobble), vy, vz * (1 + wobble));
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a stalk geometry based on variant.
 */
function createMushroomStemGeo(variant: MushroomVariant): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  if (variant === 'small') {
    geo = new THREE.CylinderGeometry(0.038, 0.055, 0.22, 7);
    geo.translate(0, 0.11, 0);
  } else if (variant === 'medium') {
    geo = new THREE.CylinderGeometry(0.045, 0.068, 0.38, 8);
    geo.translate(0, 0.19, 0);
  } else if (variant === 'tall') {
    geo = new THREE.CylinderGeometry(0.032, 0.048, 0.65, 8);
    // Slight stem curvature
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const curve = Math.sin((y / 0.65) * Math.PI) * 0.045;
      pos.setX(i, pos.getX(i) + curve);
    }
    geo.translate(0, 0.325, 0);
  } else if (variant === 'clustered') {
    geo = new THREE.CylinderGeometry(0.03, 0.045, 0.28, 6);
    geo.translate(0, 0.14, 0);
  } else {
    // Curved nodding stem
    geo = new THREE.CylinderGeometry(0.036, 0.052, 0.46, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const bend = Math.pow(Math.max(0, y / 0.46), 2) * 0.075;
      pos.setZ(i, pos.getZ(i) + bend);
    }
    geo.translate(0, 0.23, 0);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds Phase F3 System 1: The Mushroom Grove inside the Ancient Forest.
 * - 44 mushrooms deterministically placed in a natural clearing around local (54.5, 8.5)
 * - Muted colors: soft cyan, subtle violet, gentle amber
 * - Proximity brightening wave, gentle pulse, and Web Audio chimes
 */
export function createMushroomGrove(): MushroomGroveBundle {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'MushroomGrove';
  const colliders: CircleCollider[] = [];

  const rand = mulberry32(FOREST_SEED + 3100);

  // Clearing center in Wizarding School local coordinates:
  // Glade 1 / North side clearing nestled between the ancient hero trees
  const groveCenterLocal = { localX: 54.5, localZ: 8.5 };
  const centerWorld = castleLocalToWorld(groveCenterLocal.localX, groveCenterLocal.localZ);
  const centerWorldPos = new THREE.Vector3(
    centerWorld.x,
    getTerrainHeight(centerWorld.x, centerWorld.z),
    centerWorld.z,
  );

  // 1. Generate 44 Mushroom Placement Records
  const mushroomCount = 44;
  const mushrooms: MushroomInstanceData[] = [];

  const variants: MushroomVariant[] = ['small', 'medium', 'tall', 'clustered', 'curved'];
  const colorTypes: Array<'cyan' | 'violet' | 'amber'> = ['cyan', 'violet', 'amber'];

  // 6 Organic Sub-clusters radiating in the clearing
  for (let i = 0; i < mushroomCount; i++) {
    const cluster = i % 6;
    const clusterAngle = (cluster / 6) * Math.PI * 2 + (rand() - 0.5) * 0.45;
    const clusterDist = 1.2 + Math.pow(rand(), 0.75) * 3.8;

    // Local offset within sub-cluster
    const subAngle = rand() * Math.PI * 2;
    const subDist = rand() * 0.95;

    const lx = groveCenterLocal.localX + Math.cos(clusterAngle) * clusterDist + Math.cos(subAngle) * subDist;
    const lz = groveCenterLocal.localZ + Math.sin(clusterAngle) * clusterDist + Math.sin(subAngle) * subDist;
    const w = castleLocalToWorld(lx, lz);
    const wy = getTerrainHeight(w.x, w.z);

    const variant = variants[Math.floor(rand() * variants.length)];
    const colorType = colorTypes[i % 3];
    const scale = 0.75 + rand() * 0.55;
    const yaw = rand() * Math.PI * 2;
    const pitch = (rand() - 0.5) * 0.18;
    const roll = (rand() - 0.5) * 0.18;

    mushrooms.push({
      localX: lx,
      localZ: lz,
      worldX: w.x,
      worldY: wy,
      worldZ: w.z,
      variant,
      colorType,
      scale,
      yaw,
      pitch,
      roll,
      phase: rand() * Math.PI * 2,
    });
  }

  // 2. Shared Materials with Restrained Emissive Palettes
  // Stem Material (Pale creamy earth with subtle subterranean texture)
  const stemMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dcd3be'),
      roughness: 0.88,
      metalness: 0.04,
      emissive: new THREE.Color('#382f24'),
      emissiveIntensity: 0.08,
    }),
  );

  // Cyan Cap Material (Soft pale azure/cyan glow)
  const cyanCapMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38bdf8'),
      roughness: 0.78,
      metalness: 0.06,
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.28,
    }),
  );

  // Violet Cap Material (Delicate lavender/violet glow)
  const violetCapMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a78bfa'),
      roughness: 0.82,
      metalness: 0.05,
      emissive: new THREE.Color('#6d28d9'),
      emissiveIntensity: 0.26,
    }),
  );

  // Amber Cap Material (Subtle warm honey/amber glow)
  const amberCapMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbbf24'),
      roughness: 0.8,
      metalness: 0.05,
      emissive: new THREE.Color('#b45309'),
      emissiveIntensity: 0.27,
    }),
  );

  // Moss Mound Cushion Material for clusters
  const mossMoundMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d4022'),
      roughness: 0.94,
      metalness: 0.02,
    }),
  );

  // 3. Assemble and Merge Geometries
  const stemGeos: THREE.BufferGeometry[] = [];
  const cyanCapGeos: THREE.BufferGeometry[] = [];
  const violetCapGeos: THREE.BufferGeometry[] = [];
  const amberCapGeos: THREE.BufferGeometry[] = [];
  const mossMoundGeos: THREE.BufferGeometry[] = [];

  mushrooms.forEach((m, idx) => {
    // Stem
    const stem = createMushroomStemGeo(m.variant);
    stem.scale(m.scale, m.scale, m.scale);
    stem.rotateX(m.pitch);
    stem.rotateY(m.yaw);
    stem.rotateZ(m.roll);
    stem.translate(m.worldX, m.worldY, m.worldZ);
    stemGeos.push(stem);

    // Cap
    const cap = createMushroomCapGeo(m.variant, 2000 + idx);
    const capH =
      m.variant === 'small'
        ? 0.18
        : m.variant === 'medium'
          ? 0.32
          : m.variant === 'tall'
            ? 0.55
            : m.variant === 'clustered'
              ? 0.24
              : 0.38;
    cap.scale(m.scale, m.scale, m.scale);
    cap.rotateX(m.pitch);
    cap.rotateY(m.yaw);
    cap.rotateZ(m.roll);
    cap.translate(m.worldX, m.worldY + capH * m.scale, m.worldZ);

    if (m.colorType === 'cyan') {
      cyanCapGeos.push(cap);
    } else if (m.colorType === 'violet') {
      violetCapGeos.push(cap);
    } else {
      amberCapGeos.push(cap);
    }

    // Every 5th mushroom gets a small moss cushion at its base
    if (idx % 5 === 0) {
      const mound = new THREE.IcosahedronGeometry(0.32 * m.scale, 1);
      mound.scale(1.4, 0.35, 1.3);
      mound.translate(m.worldX, m.worldY + 0.05, m.worldZ);
      mossMoundGeos.push(mound);
    }
  });

  if (stemGeos.length > 0) {
    const mergedStems = tracker.trackGeo(mergeGeometries(stemGeos));
    stemGeos.forEach((g) => g.dispose());
    const stemMesh = new THREE.Mesh(mergedStems, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    group.add(stemMesh);
  }

  if (cyanCapGeos.length > 0) {
    const mergedCyan = tracker.trackGeo(mergeGeometries(cyanCapGeos));
    cyanCapGeos.forEach((g) => g.dispose());
    const cyanMesh = new THREE.Mesh(mergedCyan, cyanCapMat);
    cyanMesh.castShadow = true;
    cyanMesh.receiveShadow = true;
    group.add(cyanMesh);
  }

  if (violetCapGeos.length > 0) {
    const mergedViolet = tracker.trackGeo(mergeGeometries(violetCapGeos));
    violetCapGeos.forEach((g) => g.dispose());
    const violetMesh = new THREE.Mesh(mergedViolet, violetCapMat);
    violetMesh.castShadow = true;
    violetMesh.receiveShadow = true;
    group.add(violetMesh);
  }

  if (amberCapGeos.length > 0) {
    const mergedAmber = tracker.trackGeo(mergeGeometries(amberCapGeos));
    amberCapGeos.forEach((g) => g.dispose());
    const amberMesh = new THREE.Mesh(mergedAmber, amberCapMat);
    amberMesh.castShadow = true;
    amberMesh.receiveShadow = true;
    group.add(amberMesh);
  }

  if (mossMoundGeos.length > 0) {
    const mergedMounds = tracker.trackGeo(mergeGeometries(mossMoundGeos));
    mossMoundGeos.forEach((g) => g.dispose());
    const moundMesh = new THREE.Mesh(mergedMounds, mossMoundMat);
    moundMesh.receiveShadow = true;
    group.add(moundMesh);
  }

  // 4. Subtle Localized PointLight in the Clearing (Pulses gently when player visits)
  const groveLight = new THREE.PointLight('#7dd3fc', 0.52, 7.5, 1.8);
  groveLight.position.set(
    centerWorldPos.x,
    centerWorldPos.y + 0.85,
    centerWorldPos.z,
  );
  group.add(groveLight);

  // Soft spore motes hovering in the clearing (24 points)
  const sporeCount = 24;
  const sporePositions = new Float32Array(sporeCount * 3);
  const sporeBaseData: Array<{
    x: number;
    y: number;
    z: number;
    phase: number;
    radius: number;
  }> = [];

  for (let s = 0; s < sporeCount; s++) {
    const m = mushrooms[s % mushrooms.length];
    const sx = m.worldX + (rand() - 0.5) * 0.45;
    const sy = m.worldY + 0.35 + rand() * 0.85;
    const sz = m.worldZ + (rand() - 0.5) * 0.45;
    sporePositions[s * 3] = sx;
    sporePositions[s * 3 + 1] = sy;
    sporePositions[s * 3 + 2] = sz;
    sporeBaseData.push({
      x: sx,
      y: sy,
      z: sz,
      phase: rand() * Math.PI * 2,
      radius: 0.15 + rand() * 0.25,
    });
  }

  const sporeGeo = tracker.trackGeo(new THREE.BufferGeometry());
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePositions, 3));
  const sporeMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#93c5fd'),
      size: 0.075,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sporePoints = new THREE.Points(sporeGeo, sporeMat);
  sporePoints.name = 'MushroomGroveSpores';
  group.add(sporePoints);

  // 5. Environmental Proximity & Reaction State
  let proximityGlow = 0.0;
  let hasTriggeredChimeThisVisit = false;

  return {
    group,
    colliders,
    centerWorldPos,

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
      audio: ForestAudioSynthesizer,
    ): void {
      const distToCenter = Math.hypot(
        playerWorldPos.x - centerWorldPos.x,
        playerWorldPos.z - centerWorldPos.z,
      );

      // Proximity threshold: within 5.2m of grove center
      const inProximity = distToCenter < 5.2;

      if (inProximity) {
        if (!hasTriggeredChimeThisVisit) {
          hasTriggeredChimeThisVisit = true;
          audio.playMushroomChime(elapsedTime);
        }
      } else if (distToCenter > 7.5) {
        hasTriggeredChimeThisVisit = false;
      }

      const targetGlow = inProximity ? 1.0 : 0.0;
      proximityGlow = dampValue(proximityGlow, targetGlow, 2.2, dt);

      // Subtle wave ripple propagation across the grove
      const wave = Math.sin(elapsedTime * 2.2) * 0.12;
      const pulseFactor = 1.0 + wave * proximityGlow;

      // Restrained emissive breathing
      cyanCapMat.emissiveIntensity =
        0.28 + proximityGlow * 0.32 + Math.sin(elapsedTime * 1.8) * 0.05;
      violetCapMat.emissiveIntensity =
        0.26 + proximityGlow * 0.3 + Math.cos(elapsedTime * 1.7) * 0.05;
      amberCapMat.emissiveIntensity =
        0.27 + proximityGlow * 0.28 + Math.sin(elapsedTime * 2.1) * 0.05;

      groveLight.intensity = 0.52 + proximityGlow * 0.48;

      // Animate floating spore motes
      const posAttr = sporeGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let s = 0; s < sporeCount; s++) {
        const b = sporeBaseData[s];
        const a = elapsedTime * 0.65 + b.phase;
        posAttr.setXYZ(
          s,
          b.x + Math.cos(a) * b.radius,
          b.y + Math.sin(elapsedTime * 0.9 + b.phase) * 0.18 + proximityGlow * 0.12,
          b.z + Math.sin(a) * b.radius,
        );
      }
      posAttr.needsUpdate = true;
      sporeMat.opacity = 0.45 + proximityGlow * 0.35;
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
