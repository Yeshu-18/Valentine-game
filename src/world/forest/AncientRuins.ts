/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker, createBeveledBoxGeometry } from '../ProceduralKit';
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

export interface RuneStoneDialogueBanner {
  title: string;
  subtitle: string;
  message: string;
  speaker: string;
  stepIndex: number;
  totalSteps: number;
}

export interface AncientRuinsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  runeStoneWorldPos: THREE.Vector3;
  getRunePrompt: (playerWorldPos: THREE.Vector3) => {
    isNear: boolean;
    title: string;
    actionLabel: string;
  } | null;
  triggerRuneStone: (
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
    elapsedTime: number,
  ) => boolean;
  isDialogueActive: () => boolean;
  advanceDialogue: () => boolean;
  skipDialogue: () => boolean;
  getActiveBanner: () => RuneStoneDialogueBanner | null;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

/**
 * Creates an organic crag / chipped stone geometry.
 */
function createWeatheredStoneGeo(
  sx: number,
  sy: number,
  sz: number,
  chipping: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(sx, sy, sz, 4, 4, 4);
  const pos = geo.attributes.position;
  const rand = mulberry32(seed);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    // Weather edges inward and add organic chip facets
    const edgeDistX = Math.abs(vx) / (sx * 0.5);
    const edgeDistY = Math.abs(vy) / (sy * 0.5);
    const edgeDistZ = Math.abs(vz) / (sz * 0.5);
    const maxEdge = Math.max(edgeDistX, Math.max(edgeDistY, edgeDistZ));

    const chip = maxEdge > 0.72 ? (rand() - 0.5) * chipping : 0;
    pos.setXYZ(i, vx + chip, vy + chip, vz + chip);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an ancient weathered engraved rune texture for the Rune Monolith.
 */
function createRuneStoneTexture(tracker: ResourceTracker): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Weathered granite background with noise grain
  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 0, w, h);

  // Mottled stone weathering
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * 38;
    d[i] = Math.max(0, Math.min(255, 48 + grain));
    d[i + 1] = Math.max(0, Math.min(255, 44 + grain));
    d[i + 2] = Math.max(0, Math.min(255, 40 + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Border carvings
  ctx.strokeStyle = 'rgba(214, 211, 209, 0.45)';
  ctx.lineWidth = 6;
  ctx.strokeRect(32, 40, w - 64, h - 80);
  ctx.strokeRect(44, 52, w - 88, h - 104);

  // Ancient Celestial & Spiral Runes
  ctx.strokeStyle = '#7dd3fc';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';

  // 1. Top Spiral Seal
  ctx.beginPath();
  const cx = w * 0.5;
  const cy = 200;
  for (let a = 0; a < Math.PI * 6; a += 0.1) {
    const r = a * 12;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 2. Vertical Runic Glyphs
  ctx.font = 'bold 54px serif';
  ctx.fillStyle = '#bae6fd';
  ctx.textAlign = 'center';
  ctx.fillText('ᚠ   ᚢ   ᚦ   ᚨ', cx, 410);
  ctx.fillText('ᚱ   ᚲ   ᚷ   ᚹ', cx, 510);
  ctx.fillText('ᚺ   ᚾ   ᛁ   ᛃ', cx, 610);
  ctx.fillText('ᛈ   ᛇ   ᛉ   ᛊ', cx, 710);

  // 3. Bottom Entwined Heart Knot Emblem
  ctx.beginPath();
  const by = 860;
  ctx.moveTo(cx, by + 45);
  ctx.bezierCurveTo(cx - 75, by, cx - 75, by - 55, cx, by - 30);
  ctx.bezierCurveTo(cx + 75, by - 55, cx + 75, by, cx, by + 45);
  ctx.stroke();

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an authentic handcrafted broken-wood signboard texture
 * with deeply carved/burned rustic lettering: "ANCIENT WEATHERED RUNE STONE".
 */
function createBrokenWoodSignTexture(tracker: ResourceTracker): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. Dark weathered oak timber background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#38281d');
  grad.addColorStop(0.5, '#4a3727');
  grad.addColorStop(1.0, '#302217');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Horizontal wood grain lines
  ctx.strokeStyle = 'rgba(25, 17, 12, 0.45)';
  for (let y = 10; y < h; y += 7) {
    ctx.lineWidth = 1.2 + (y % 3) * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.2) * 2.5);
    ctx.bezierCurveTo(
      w * 0.33,
      y + Math.cos(y * 0.15) * 4,
      w * 0.67,
      y - Math.sin(y * 0.25) * 4,
      w,
      y + Math.cos(y * 0.18) * 3,
    );
    ctx.stroke();
  }

  // 3. Rough weather cracks
  ctx.strokeStyle = '#1a110a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(35, 40);
  ctx.lineTo(85, 48);
  ctx.lineTo(130, 44);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 120, h - 50);
  ctx.lineTo(w - 45, h - 42);
  ctx.stroke();

  // 4. Carved / Burned Handcrafted Lettering & Directional Arrow
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Chisel drop-shadow (burned edge)
  ctx.fillStyle = 'rgba(18, 12, 8, 0.95)';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('ANCIENT WEATHERED', w * 0.5 + 2, h * 0.28 + 2);
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('RUNE STONE', w * 0.5 + 2, h * 0.54 + 2);

  // Deep carved warm timber fill
  ctx.fillStyle = '#f3d59e';
  ctx.shadowColor = 'rgba(235, 180, 110, 0.45)';
  ctx.shadowBlur = 6;
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('ANCIENT WEATHERED', w * 0.5, h * 0.28);
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('RUNE STONE', w * 0.5, h * 0.54);

  // Chiseled Directional Arrow Graphic pointing along path to Rune Stone
  const drawChiseledArrow = (
    cx: number,
    cy: number,
    length: number,
    thickness: number,
    headW: number,
    headH: number,
    color: string,
  ) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const halfL = length * 0.5;
    const halfT = thickness * 0.5;
    const shaftRight = cx + halfL - headW;
    ctx.moveTo(cx - halfL, cy - halfT);
    ctx.lineTo(shaftRight, cy - halfT);
    ctx.lineTo(shaftRight, cy - headH * 0.5);
    ctx.lineTo(cx + halfL, cy);
    ctx.lineTo(shaftRight, cy + headH * 0.5);
    ctx.lineTo(shaftRight, cy + halfT);
    ctx.lineTo(cx - halfL, cy + halfT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Shadow arrow
  drawChiseledArrow(w * 0.5 + 2, h * 0.82 + 2, 340, 14, 32, 32, 'rgba(18, 12, 8, 0.95)');
  // Amber-gold fill arrow pointing right towards the destination
  ctx.shadowColor = 'rgba(245, 158, 11, 0.65)';
  ctx.shadowBlur = 8;
  drawChiseledArrow(w * 0.5, h * 0.82, 340, 14, 32, 32, '#f59e0b');

  // Text inside / along the arrow
  ctx.shadowBlur = 0;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillStyle = '#1c1917';
  ctx.fillText('FOLLOW PATH ➔', w * 0.5 - 20, h * 0.82);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a terrain-conforming quad strip for the luminous neon pathway.
 */
function createNeonPathwayRibbonGeo(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  baseWidth: number,
  vRepeat = 8,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  const colFracs = [-0.5, -0.25, 0.25, 0.5];
  const colUvs = [0.0, 0.35, 0.65, 1.0];
  const colElevs = [0.032, 0.048, 0.048, 0.032];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, _pt);
    curve.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const w = baseWidth;
    const v = u * vRepeat;

    for (let c = 0; c < 4; c++) {
      const lat = _right.clone().multiplyScalar(colFracs[c] * w);
      const vx = _pt.x + lat.x;
      const vz = _pt.z + lat.z;
      const vy = getTerrainHeight(vx, vz) + colElevs[c];

      positions.push(vx, vy, vz);
      normals.push(0, 1, 0);
      uvs.push(colUvs[c], v);
    }
  }

  for (let i = 0; i < segments; i++) {
    const row = i * 4;
    const nextRow = (i + 1) * 4;
    for (let c = 0; c < 3; c++) {
      const i0 = row + c;
      const i1 = row + c + 1;
      const i2 = nextRow + c;
      const i3 = nextRow + c + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds Phase F3 System 2: Ancient Ruins & System 3: Rune Stone with Interactive Dialogue.
 * - Located in sunken glade around localX: 62.5, localZ: -12.5
 * - Broken stone arch, 4 damaged pillars, collapsed wall, staircase, statue, debris, moss & roots
 * - Distinctive upright Rune Monolith with personal message from Yeshwanth to Harsha
 */
export function createAncientRuins(): AncientRuinsBundle {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'AncientRuins';
  const colliders: CircleCollider[] = [];

  const rand = mulberry32(FOREST_SEED + 4200);

  // Center of Ruins glade in Wizarding School local coordinates
  const ruinsCenterLocal = { localX: 62.5, localZ: -12.5 };
  const centerWorld = castleLocalToWorld(ruinsCenterLocal.localX, ruinsCenterLocal.localZ);

  // Distinctive Rune Stone Location
  const runeLocal = { localX: 62.8, localZ: -12.2 };
  const runeW = castleLocalToWorld(runeLocal.localX, runeLocal.localZ);
  const runeStoneWorldPos = new THREE.Vector3(
    runeW.x,
    getTerrainHeight(runeW.x, runeW.z),
    runeW.z,
  );

  // Shared Materials
  const agedStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#78716c'),
      roughness: 0.92,
      metalness: 0.04,
    }),
  );

  const ruinedMasonryMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#57534e'),
      roughness: 0.95,
      metalness: 0.02,
    }),
  );

  const ruinMossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#365314'),
      roughness: 0.96,
      metalness: 0.02,
    }),
  );

  const ancientRootMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38281d'),
      roughness: 0.9,
      metalness: 0.03,
    }),
  );

  // Rune Monolith Material (Engraved Face with Emissive Runes)
  const runeTexture = createRuneStoneTexture(tracker);
  const runeStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#57534e'),
      map: runeTexture,
      emissiveMap: runeTexture,
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.16,
      roughness: 0.88,
      metalness: 0.06,
    }),
  );

  // 1. Magical Neon Landmark Plant Material (Luminous Star-Bell Blossom)
  const starBellPetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0.04,
    }),
  );

  const starBellStemMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38281d'),
      roughness: 0.92,
      metalness: 0.02,
    }),
  );

  // 0. Luminous Neon Pathway Materials
  const neonPathMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38bdf8'),
      emissive: new THREE.Color('#00f0ff'),
      emissiveIntensity: 1.1,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
    }),
  );

  const neonFilamentMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.05,
    }),
  );

  const neonRuneStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#292524'),
      roughness: 0.9,
      metalness: 0.04,
    }),
  );

  const neonGlyphMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00f0ff'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 1.35,
      roughness: 0.15,
      metalness: 0.08,
    }),
  );

  const neonGuideBeaconMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#0ea5e9'),
      emissiveIntensity: 1.6,
      roughness: 0.12,
      metalness: 0.06,
    }),
  );

  // 2. Handcrafted Broken-Wood Sign Materials (with self-illuminated carved face)
  const signTex = createBrokenWoodSignTexture(tracker);
  const signFaceMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: signTex ?? undefined,
      emissiveMap: signTex ?? undefined,
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.48,
      roughness: 0.86,
      metalness: 0.02,
    }),
  );

  const signWoodMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3727'),
      roughness: 0.9,
      metalness: 0.02,
    }),
  );

  const stoneGeos: THREE.BufferGeometry[] = [];
  const masonryGeos: THREE.BufferGeometry[] = [];
  const mossGeos: THREE.BufferGeometry[] = [];
  const rootGeos: THREE.BufferGeometry[] = [];

  // ============================================================================
  // 1. BROKEN STONE ARCHWAY
  // ============================================================================
  // Two beveled stone columns with arch spans
  const archLocal = { localX: 60.5, localZ: -15.2 };
  const archW = castleLocalToWorld(archLocal.localX, archLocal.localZ);
  const archY = getTerrainHeight(archW.x, archW.z);

  // Left Post
  const leftCol = createWeatheredStoneGeo(0.65, 3.8, 0.65, 0.06, 101);
  leftCol.translate(archW.x - 1.5, archY + 1.9, archW.z);
  stoneGeos.push(leftCol);
  colliders.push({ x: archW.x - 1.5, z: archW.z, radius: 0.65 });

  // Right Post
  const rightCol = createWeatheredStoneGeo(0.65, 3.8, 0.65, 0.06, 102);
  rightCol.translate(archW.x + 1.5, archY + 1.9, archW.z);
  stoneGeos.push(rightCol);
  colliders.push({ x: archW.x + 1.5, z: archW.z, radius: 0.65 });

  // Cracked Arch Lintel (Half-collapsed overhead)
  const lintelLeft = createWeatheredStoneGeo(1.9, 0.55, 0.72, 0.08, 103);
  lintelLeft.rotateZ(0.12);
  lintelLeft.translate(archW.x - 0.75, archY + 3.85, archW.z);
  stoneGeos.push(lintelLeft);

  const fallenLintel = createWeatheredStoneGeo(1.6, 0.55, 0.68, 0.08, 104);
  fallenLintel.rotateY(0.45);
  fallenLintel.rotateZ(-0.25);
  fallenLintel.translate(archW.x + 1.1, archY + 0.35, archW.z + 0.4);
  stoneGeos.push(fallenLintel);

  // Moss on top of Arch
  const archMoss = createWeatheredStoneGeo(2.1, 0.16, 0.78, 0.05, 105);
  archMoss.translate(archW.x - 0.75, archY + 4.15, archW.z);
  mossGeos.push(archMoss);

  // ============================================================================
  // 2. FOUR DAMAGED ANCIENT PILLARS
  // ============================================================================
  const pillarOffsets: Array<{
    dx: number;
    dz: number;
    h: number;
    tiltX: number;
    tiltZ: number;
    broken: boolean;
  }> = [
    { dx: -3.8, dz: -1.8, h: 3.6, tiltX: 0.04, tiltZ: -0.06, broken: false },
    { dx: -4.2, dz: 2.8, h: 2.1, tiltX: -0.15, tiltZ: 0.08, broken: true },
    { dx: 3.6, dz: -2.4, h: 2.8, tiltX: 0.08, tiltZ: 0.12, broken: true },
    { dx: 4.4, dz: 2.2, h: 3.4, tiltX: -0.05, tiltZ: -0.03, broken: false },
  ];

  pillarOffsets.forEach((p, idx) => {
    const pw = castleLocalToWorld(ruinsCenterLocal.localX + p.dx, ruinsCenterLocal.localZ + p.dz);
    const py = getTerrainHeight(pw.x, pw.z);

    const pillarGeo = new THREE.CylinderGeometry(0.42, 0.48, p.h, 10);
    pillarGeo.rotateX(p.tiltX);
    pillarGeo.rotateZ(p.tiltZ);
    pillarGeo.translate(pw.x, py + p.h * 0.5, pw.z);
    stoneGeos.push(pillarGeo);

    colliders.push({ x: pw.x, z: pw.z, radius: 0.65 });

    // Capital
    const capGeo = createBeveledBoxGeometry(0.95, 0.35, 0.95, 0.06);
    capGeo.rotateX(p.tiltX);
    capGeo.rotateZ(p.tiltZ);
    capGeo.translate(pw.x, py + p.h + 0.12, pw.z);
    stoneGeos.push(capGeo);

    // If broken, add a fallen fractured cylinder drum on the ground
    if (p.broken) {
      const brokenDrum = new THREE.CylinderGeometry(0.4, 0.44, 1.4, 10);
      brokenDrum.rotateZ(Math.PI / 2 + 0.18);
      brokenDrum.rotateY(0.65 * idx);
      brokenDrum.translate(pw.x + 0.85, py + 0.38, pw.z + 0.45);
      stoneGeos.push(brokenDrum);
      colliders.push({ x: pw.x + 0.85, z: pw.z + 0.45, radius: 0.55 });

      // Moss cap on fracture
      const mCap = new THREE.CylinderGeometry(0.44, 0.46, 0.15, 8);
      mCap.translate(pw.x, py + p.h + 0.22, pw.z);
      mossGeos.push(mCap);
    }
  });

  // ============================================================================
  // 3. COLLAPSED WALL SECTION & WEATHERED STAIRCASE
  // ============================================================================
  // Wall running along Southern boundary of ruins
  const wallW = castleLocalToWorld(ruinsCenterLocal.localX - 1.2, ruinsCenterLocal.localZ - 4.5);
  const wallY = getTerrainHeight(wallW.x, wallW.z);

  for (let b = 0; b < 6; b++) {
    const wx = wallW.x + (b - 2.5) * 0.85;
    const wz = wallW.z + (rand() - 0.5) * 0.35;
    const wy = getTerrainHeight(wx, wz);
    const bh = 0.55 + (b % 2) * 0.45 + (b < 4 ? 0.6 : 0);

    const block = createWeatheredStoneGeo(0.82, bh, 0.68, 0.08, 300 + b);
    block.rotateY((rand() - 0.5) * 0.18);
    block.translate(wx, wy + bh * 0.5, wz);
    masonryGeos.push(block);

    colliders.push({ x: wx, z: wz, radius: 0.58 });
  }

  // Weathered Staircase (5 steps descending into glade)
  const stairW = castleLocalToWorld(ruinsCenterLocal.localX + 2.8, ruinsCenterLocal.localZ - 3.8);
  const stairY = getTerrainHeight(stairW.x, stairW.z);
  for (let s = 0; s < 5; s++) {
    const sx = stairW.x + (s * 0.32);
    const sz = stairW.z - (s * 0.42);
    const step = createWeatheredStoneGeo(1.8, 0.22, 0.52, 0.04, 400 + s);
    step.rotateY(-0.65);
    step.translate(sx, stairY - s * 0.18 + 0.1, sz);
    stoneGeos.push(step);

    // Moss creeping onto steps
    if (s % 2 === 0) {
      const sm = createWeatheredStoneGeo(1.4, 0.08, 0.28, 0.03, 450 + s);
      sm.rotateY(-0.65);
      sm.translate(sx, stairY - s * 0.18 + 0.2, sz);
      mossGeos.push(sm);
    }
  }

  // ============================================================================
  // 4. PARTIALLY BURIED OLD STATUE
  // ============================================================================
  const statueW = castleLocalToWorld(ruinsCenterLocal.localX - 2.8, ruinsCenterLocal.localZ + 1.8);
  const statueY = getTerrainHeight(statueW.x, statueW.z);

  // Weathered Pedestal
  const ped = createWeatheredStoneGeo(1.1, 0.65, 1.1, 0.08, 501);
  ped.translate(statueW.x, statueY + 0.28, statueW.z);
  stoneGeos.push(ped);

  // Contemplative Torso & Head (Ancient smoothed silhouette)
  const torso = new THREE.CylinderGeometry(0.38, 0.48, 0.95, 8);
  torso.translate(statueW.x, statueY + 1.05, statueW.z);
  stoneGeos.push(torso);

  const head = new THREE.SphereGeometry(0.26, 8, 8);
  head.scale(0.85, 1.1, 0.85);
  head.translate(statueW.x, statueY + 1.68, statueW.z);
  stoneGeos.push(head);

  colliders.push({ x: statueW.x, z: statueW.z, radius: 0.85 });

  // ============================================================================
  // 5. ROOTS GROWING THROUGH MASONRY CRACKS & SCATTERED WEATHERED RUBBLE
  // ============================================================================
  // Roots snaking over wall and pillars
  for (let r = 0; r < 4; r++) {
    const rx = wallW.x + (r - 1.5) * 1.6;
    const rz = wallW.z + 0.25;
    const ry = getTerrainHeight(rx, rz);

    const rootCurve = new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6);
    rootCurve.rotateX(0.75 + (r % 2) * 0.2);
    rootCurve.rotateY(r * 0.85);
    rootCurve.translate(rx, ry + 0.45, rz);
    rootGeos.push(rootCurve);
  }

  // 12 Scattered Weathered Masonry Debris Blocks
  for (let d = 0; d < 12; d++) {
    const rad = 2.5 + rand() * 5.2;
    const ang = rand() * Math.PI * 2;
    const dx = centerWorld.x + Math.cos(ang) * rad;
    const dz = centerWorld.z + Math.sin(ang) * rad;
    const dy = getTerrainHeight(dx, dz);

    const debScale = 0.35 + rand() * 0.45;
    const debris = createWeatheredStoneGeo(debScale, debScale * 0.6, debScale * 0.8, 0.06, 600 + d);
    debris.rotateX(rand() * 0.4);
    debris.rotateY(rand() * Math.PI * 2);
    debris.rotateZ(rand() * 0.4);
    debris.translate(dx, dy + debScale * 0.25, dz);
    masonryGeos.push(debris);
  }

  // ============================================================================
  // STEP 0: LUMINOUS NEON PATHWAY TO SIGNBOARD & RUNE STONE
  // Directly connects the main forest walkway to the neon plant, the signboard,
  // and the Ancient Weathered Rune Stone monolith with a brilliant glowing trail.
  // ============================================================================
  const neonPathwayLocalPts = [
    { lx: 55.6, lz: -4.0 }, // Main walkway junction
    { lx: 57.0, lz: -5.6 }, // Approaching forest glade
    { lx: 58.5, lz: -7.5 }, // Flanking Luminous Star-Bell Blossom
    { lx: 59.8, lz: -8.8 }, // In front of the Broken-Wood Signboard
    { lx: 61.2, lz: -10.4 }, // Path descending to ruins clearing
    { lx: 62.8, lz: -12.2 }, // Ancient Weathered Rune Stone monolith
  ];
  const neonSplineWorldPts = neonPathwayLocalPts.map((p) => {
    const w = castleLocalToWorld(p.lx, p.lz);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const neonPathwaySpline = new THREE.CatmullRomCurve3(neonSplineWorldPts);

  // 1. Terrain-Conforming Luminous Neon Ground Ribbon
  const neonRibbonGeo = tracker.trackGeo(
    createNeonPathwayRibbonGeo(neonPathwaySpline, 36, 0.72, 8),
  );
  const neonRibbonMesh = new THREE.Mesh(neonRibbonGeo, neonPathMat);
  neonRibbonMesh.receiveShadow = true;
  neonRibbonMesh.name = 'NeonPathwayRibbon';
  group.add(neonRibbonMesh);

  // 2. Dual Glowing Neon Edge Tracer Filaments along the shoulders
  const leftTracerPts: THREE.Vector3[] = [];
  const rightTracerPts: THREE.Vector3[] = [];
  const _nPt = new THREE.Vector3();
  const _nTan = new THREE.Vector3();
  const _nRight = new THREE.Vector3();
  const _nUp = new THREE.Vector3(0, 1, 0);

  for (let s = 0; s <= 36; s++) {
    const u = s / 36;
    neonPathwaySpline.getPointAt(u, _nPt);
    neonPathwaySpline.getTangentAt(u, _nTan).normalize();
    _nRight.crossVectors(_nTan, _nUp).normalize();

    const lx = _nPt.x - _nRight.x * 0.46;
    const lz = _nPt.z - _nRight.z * 0.46;
    const ly = getTerrainHeight(lx, lz) + 0.052;
    leftTracerPts.push(new THREE.Vector3(lx, ly, lz));

    const rx = _nPt.x + _nRight.x * 0.46;
    const rz = _nPt.z + _nRight.z * 0.46;
    const ry = getTerrainHeight(rx, rz) + 0.052;
    rightTracerPts.push(new THREE.Vector3(rx, ry, rz));
  }

  const leftTracerCurve = new THREE.CatmullRomCurve3(leftTracerPts);
  const rightTracerCurve = new THREE.CatmullRomCurve3(rightTracerPts);
  const leftTracerGeo = tracker.trackGeo(new THREE.TubeGeometry(leftTracerCurve, 36, 0.026, 6, false));
  const rightTracerGeo = tracker.trackGeo(new THREE.TubeGeometry(rightTracerCurve, 36, 0.026, 6, false));
  const leftTracerMesh = new THREE.Mesh(leftTracerGeo, neonFilamentMat);
  const rightTracerMesh = new THREE.Mesh(rightTracerGeo, neonFilamentMat);
  group.add(leftTracerMesh, rightTracerMesh);

  // 3. 10 Inlaid Glowing Neon Runic Stepping Stones along the pathway
  const neonStoneGeos: THREE.BufferGeometry[] = [];
  const neonGlyphGeos: THREE.BufferGeometry[] = [];
  const neonStemGeos: THREE.BufferGeometry[] = [];
  const neonSproutGeos: THREE.BufferGeometry[] = [];

  for (let st = 0; st < 10; st++) {
    const u = 0.06 + (st / 9) * 0.88;
    neonPathwaySpline.getPointAt(u, _nPt);
    neonPathwaySpline.getTangentAt(u, _nTan).normalize();
    _nRight.crossVectors(_nTan, _nUp).normalize();
    const yaw = Math.atan2(_nTan.x, _nTan.z);

    const latShift = (st % 2 === 0 ? 1 : -1) * 0.08;
    const sx = _nPt.x + _nRight.x * latShift;
    const sz = _nPt.z + _nRight.z * latShift;
    const sy = getTerrainHeight(sx, sz) + 0.04;

    // Basalt Stepping Stone
    const stoneSlab = createBeveledBoxGeometry(0.58, 0.07, 0.44, 0.02);
    stoneSlab.rotateY(yaw + 0.08);
    stoneSlab.translate(sx, sy, sz);
    neonStoneGeos.push(stoneSlab);

    // Inlaid Glowing Neon Ring
    const glyphRing = new THREE.TorusGeometry(0.12, 0.022, 6, 12);
    glyphRing.rotateX(Math.PI * 0.5);
    glyphRing.translate(sx, sy + 0.038, sz);
    neonGlyphGeos.push(glyphRing);

    // Flanking Neon Guide Sprouts on alternating trail shoulders
    const fSide = st % 2 === 0 ? 1 : -1;
    const fx = _nPt.x + _nRight.x * (fSide * 0.68);
    const fz = _nPt.z + _nRight.z * (fSide * 0.68);
    const fy = getTerrainHeight(fx, fz);

    // Small glowing star-bell blossom shoot
    const sproutStem = new THREE.CylinderGeometry(0.018, 0.024, 0.28, 5);
    sproutStem.translate(fx, fy + 0.14, fz);
    neonStemGeos.push(sproutStem);

    const sproutPetals = new THREE.SphereGeometry(0.08, 6, 5);
    sproutPetals.scale(1.0, 1.3, 1.0);
    sproutPetals.translate(fx, fy + 0.28, fz);
    neonSproutGeos.push(sproutPetals);
  }

  // 4. Two Glowing Entry Guide Pillars at the Main Walkway Junction (u = 0.0)
  neonPathwaySpline.getPointAt(0.0, _nPt);
  neonPathwaySpline.getTangentAt(0.0, _nTan).normalize();
  _nRight.crossVectors(_nTan, _nUp).normalize();

  [-0.9, 0.9].forEach((pSide, pIdx) => {
    const px = _nPt.x + _nRight.x * pSide;
    const pz = _nPt.z + _nRight.z * pSide;
    const py = getTerrainHeight(px, pz);

    // Mossy Stone Pedestal
    const pedCol = createWeatheredStoneGeo(0.38, 0.68, 0.38, 0.04, 300 + pIdx);
    pedCol.translate(px, py + 0.34, pz);
    stoneGeos.push(pedCol);

    // Glowing Neon Crystal Beacon atop the pedestal
    const crystal = new THREE.OctahedronGeometry(0.14, 0);
    crystal.scale(0.8, 1.4, 0.8);
    crystal.translate(px, py + 0.76, pz);
    neonGlyphGeos.push(crystal);
  });

  const mergedNeonStones = tracker.trackGeo(mergeGeometries(neonStoneGeos));
  neonStoneGeos.forEach((g) => g.dispose());
  group.add(new THREE.Mesh(mergedNeonStones, neonRuneStoneMat));

  const mergedNeonGlyphs = tracker.trackGeo(mergeGeometries(neonGlyphGeos));
  neonGlyphGeos.forEach((g) => g.dispose());
  group.add(new THREE.Mesh(mergedNeonGlyphs, neonGlyphMat));

  if (neonStemGeos.length > 0) {
    const mergedNeonStems = tracker.trackGeo(mergeGeometries(neonStemGeos));
    neonStemGeos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(mergedNeonStems, starBellStemMat));
  }

  if (neonSproutGeos.length > 0) {
    const mergedSprouts = tracker.trackGeo(mergeGeometries(neonSproutGeos));
    neonSproutGeos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(mergedSprouts, neonGuideBeaconMat));
  }

  // ============================================================================
  // STEP 1: LUMINOUS STAR-BELL BLOSSOM (Magical Neon Landmark Plant)
  // Visible through the trees from the main walkway (localX: 58.5, localZ: -7.5)
  // ============================================================================
  const neonLocal = { localX: 58.5, localZ: -7.5 };
  const neonW = castleLocalToWorld(neonLocal.localX, neonLocal.localZ);
  const neonY = getTerrainHeight(neonW.x, neonW.z);

  const starBellGroup = new THREE.Group();
  starBellGroup.position.set(neonW.x, neonY, neonW.z);
  starBellGroup.name = 'LuminousStarBellBlossom';

  // Raised organic mossy soil mound cradling the plant
  const moundGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.85, 1.25, 0.22, 10));
  moundGeo.translate(0, 0.11, 0);
  const moundMesh = new THREE.Mesh(moundGeo, ruinMossMat);
  starBellGroup.add(moundMesh);

  // Main twisting gnarled stem (height ~1.38m)
  const stemGeos: THREE.BufferGeometry[] = [];
  const petalGeos: THREE.BufferGeometry[] = [];

  const mainStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(0.08, 0.52, 0.05),
    new THREE.Vector3(-0.06, 0.95, -0.04),
    new THREE.Vector3(0.02, 1.38, 0.01),
  ]);
  const mainStemGeo = new THREE.TubeGeometry(mainStemCurve, 12, 0.042, 7, false);
  stemGeos.push(mainStemGeo);

  // 5 Star-Bell Blossoms branching out from stem nodes
  const blossomAngles = [
    { u: 0.55, ang: 0.4, pitch: 0.65, len: 0.42 },
    { u: 0.68, ang: 2.1, pitch: 0.55, len: 0.48 },
    { u: 0.82, ang: -1.6, pitch: 0.7, len: 0.45 },
    { u: 0.92, ang: 3.2, pitch: 0.48, len: 0.38 },
    { u: 1.0, ang: 0.0, pitch: 0.15, len: 0.32 }, // Apex bloom
  ];

  blossomAngles.forEach((bSpec) => {
    const nodePt = mainStemCurve.getPointAt(bSpec.u);
    const branchCurve = new THREE.CatmullRomCurve3([
      nodePt,
      new THREE.Vector3(
        nodePt.x + Math.sin(bSpec.ang) * bSpec.len * 0.5,
        nodePt.y + Math.cos(bSpec.pitch) * bSpec.len * 0.5,
        nodePt.z + Math.cos(bSpec.ang) * bSpec.len * 0.5,
      ),
      new THREE.Vector3(
        nodePt.x + Math.sin(bSpec.ang) * bSpec.len,
        nodePt.y + Math.cos(bSpec.pitch) * bSpec.len + 0.08,
        nodePt.z + Math.cos(bSpec.ang) * bSpec.len,
      ),
    ]);
    const bGeo = new THREE.TubeGeometry(branchCurve, 6, 0.024, 6, false);
    stemGeos.push(bGeo);

    // Tip position for the star-bell blossom
    const tipPos = branchCurve.getPointAt(1.0);

    // Flared Star-Bell Flower Cup (Dome + 5 Star Petal Points)
    const bellDome = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    bellDome.scale(1.0, 1.4, 1.0);
    bellDome.rotateX(Math.PI);
    bellDome.rotateY(bSpec.ang);
    bellDome.rotateX(bSpec.pitch * 0.8);
    bellDome.translate(tipPos.x, tipPos.y, tipPos.z);
    petalGeos.push(bellDome);

    // 5 Flared Star Petal Tips
    for (let p = 0; p < 5; p++) {
      const pAng = (p / 5) * Math.PI * 2;
      const pTip = new THREE.ConeGeometry(0.045, 0.12, 4);
      pTip.scale(1.0, 1.0, 0.3);
      pTip.rotateZ(0.65);
      pTip.rotateY(pAng);
      pTip.rotateX(bSpec.pitch * 0.8);
      pTip.rotateY(bSpec.ang);
      pTip.translate(
        tipPos.x + Math.sin(pAng + bSpec.ang) * 0.11,
        tipPos.y - 0.08,
        tipPos.z + Math.cos(pAng + bSpec.ang) * 0.11,
      );
      petalGeos.push(pTip);
    }
  });

  const mergedStems = tracker.trackGeo(mergeGeometries(stemGeos));
  stemGeos.forEach((g) => g.dispose());
  const stemMesh = new THREE.Mesh(mergedStems, starBellStemMat);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  starBellGroup.add(stemMesh);

  const mergedPetals = tracker.trackGeo(mergeGeometries(petalGeos));
  petalGeos.forEach((g) => g.dispose());
  const petalMesh = new THREE.Mesh(mergedPetals, starBellPetalMat);
  petalMesh.castShadow = true;
  starBellGroup.add(petalMesh);

  group.add(starBellGroup);
  colliders.push({ x: neonW.x, z: neonW.z, radius: 0.65 });

  // ============================================================================
  // STEP 2: HANDCRAFTED BROKEN-WOOD RUNE STONE SIGN
  // Positioned on the pathway shoulder AFTER the neon plant (localX: 59.8, localZ: -8.8)
  // Displays "ANCIENT WEATHERED RUNE STONE" and a directional arrow pointing toward the ruins
  // ============================================================================
  const signLocal = { localX: 59.8, localZ: -8.8 };
  const signW = castleLocalToWorld(signLocal.localX, signLocal.localZ);
  const signY = getTerrainHeight(signW.x, signW.z);

  const signGroup = new THREE.Group();
  signGroup.position.set(signW.x, signY, signW.z);
  signGroup.rotation.y = 0.52; // Orient toward player approaching along the pathway past the neon plant
  signGroup.name = 'BrokenWoodRuneStoneSign';

  // Uneven crooked rustic posts
  const postGeos: THREE.BufferGeometry[] = [];
  [-0.38, 0.38].forEach((px, pIdx) => {
    const ph = 1.25 + (pIdx === 0 ? 0.08 : -0.06);
    const post = new THREE.CylinderGeometry(0.046, 0.054, ph, 7);
    post.rotateZ((pIdx === 0 ? 1 : -1) * 0.05);
    post.translate(px, ph * 0.5, 0);
    postGeos.push(post);
  });
  const mergedPosts = tracker.trackGeo(mergeGeometries(postGeos));
  postGeos.forEach((g) => g.dispose());
  const postsMesh = new THREE.Mesh(mergedPosts, signWoodMat);
  postsMesh.castShadow = true;
  postsMesh.receiveShadow = true;
  signGroup.add(postsMesh);

  // Rough broken timber cross-plank (1.08m wide, 0.44m tall, 0.05m deep)
  const signBoardGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.08, 0.44, 0.05, 0.015),
  );
  signBoardGeo.rotateZ(0.055); // Slightly crooked tilt
  signBoardGeo.translate(0, 0.95, 0.02);
  const signBoardMesh = new THREE.Mesh(signBoardGeo, signWoodMat);
  signBoardMesh.castShadow = true;
  signBoardMesh.receiveShadow = true;
  signGroup.add(signBoardMesh);

  // Carved Signboard Face displaying "ANCIENT WEATHERED RUNE STONE" with Directional Arrow
  // Front face
  const signFaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.04, 0.4));
  signFaceGeo.rotateZ(0.055);
  signFaceGeo.translate(0, 0.95, 0.048);
  const signFaceMesh = new THREE.Mesh(signFaceGeo, signFaceMat);
  signGroup.add(signFaceMesh);

  // Back face (double-sided readability)
  const signBackGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.04, 0.4));
  signBackGeo.rotateZ(-0.055);
  signBackGeo.rotateY(Math.PI);
  signBackGeo.translate(0, 0.95, -0.01);
  const signBackMesh = new THREE.Mesh(signBackGeo, signFaceMat);
  signGroup.add(signBackMesh);

  // Moss tuft on top edge of the board
  const signMossGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.1, 1));
  signMossGeo.scale(1.8, 0.55, 0.9);
  signMossGeo.translate(-0.36, 1.2, 0.02);
  const signMossMesh = new THREE.Mesh(signMossGeo, ruinMossMat);
  signGroup.add(signMossMesh);

  // 3D Carved Directional Pointer Arrow mounted on top of the sign post
  // Points along the pathway directly toward the Ancient Weathered Rune Stone
  const arrowGroup = new THREE.Group();
  arrowGroup.position.set(0, 1.28, 0.02);

  // Pointer arrow: beveled shaft + tapered arrowhead
  const arrowShaftGeo = createBeveledBoxGeometry(0.12, 0.09, 0.38, 0.015);
  arrowShaftGeo.translate(0, 0, -0.06);

  const arrowTipGeo = new THREE.ConeGeometry(0.13, 0.22, 4);
  arrowTipGeo.rotateX(Math.PI * 0.5); // Apex points at +Z
  arrowTipGeo.scale(1.2, 0.7, 1.0);
  arrowTipGeo.translate(0, 0, 0.21);

  const mergedArrowGeo = tracker.trackGeo(mergeGeometries([arrowShaftGeo, arrowTipGeo]));
  arrowShaftGeo.dispose();
  arrowTipGeo.dispose();

  const arrowMesh = new THREE.Mesh(mergedArrowGeo, signWoodMat);
  arrowMesh.castShadow = true;
  arrowMesh.receiveShadow = true;
  arrowGroup.add(arrowMesh);

  // Carved amber chisel stripe / inlay on arrow body (emissive highlight)
  const arrowInlayGeo = tracker.trackGeo(createBeveledBoxGeometry(0.04, 0.025, 0.24, 0.006));
  arrowInlayGeo.translate(0, 0.05, 0.04);
  const arrowInlayMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f59e0b'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.85,
      roughness: 0.45,
      metalness: 0.1,
    }),
  );
  const arrowInlayMesh = new THREE.Mesh(arrowInlayGeo, arrowInlayMat);
  arrowGroup.add(arrowInlayMesh);

  // Compute direction in signGroup's local coordinate system toward the Rune Monolith
  signGroup.add(arrowGroup);
  signGroup.updateMatrixWorld(true);
  const targetInLocal = signGroup.worldToLocal(runeStoneWorldPos.clone());
  targetInLocal.y = arrowGroup.position.y;
  arrowGroup.lookAt(targetInLocal);

  // 5. Enchanted Neon Lantern Mounted on Signboard Post
  const lanternBracketGeo = tracker.trackGeo(createBeveledBoxGeometry(0.28, 0.04, 0.04, 0.008));
  lanternBracketGeo.translate(0.36, 1.34, 0.08);
  const lanternBracketMesh = new THREE.Mesh(lanternBracketGeo, signWoodMat);
  signGroup.add(lanternBracketMesh);

  // Lantern Glass & Metal Frame
  const lanternFrameGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 6));
  lanternFrameGeo.translate(0.48, 1.22, 0.08);
  const lanternFrameMesh = new THREE.Mesh(lanternFrameGeo, agedStoneMat);
  signGroup.add(lanternFrameMesh);

  // Glowing Neon Lantern Core (Radiant Cyan Crystal)
  const lanternCoreGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.065, 0));
  lanternCoreGeo.scale(0.9, 1.4, 0.9);
  lanternCoreGeo.translate(0.48, 1.22, 0.08);
  const lanternCoreMesh = new THREE.Mesh(lanternCoreGeo, neonFilamentMat);
  signGroup.add(lanternCoreMesh);

  // Dedicated Localized PointLight for the Signboard
  // Brilliantly illuminates the signboard face, carved lettering, 3D arrow, and pathway ground
  const signLight = new THREE.PointLight('#38bdf8', 1.35, 7.5, 1.8);
  signLight.position.set(signW.x + 0.32, signY + 1.35, signW.z + 0.15);
  group.add(signLight);

  group.add(signGroup);
  colliders.push({ x: signW.x, z: signW.z, radius: 0.55 });

  // ============================================================================
  // STEP 3: DISTINCTIVE RUNE STONE MONOLITH & CLEARING
  // ============================================================================
  // Weathered Flagstone Clearing Ring framing the Rune Stone (reduces clutter and sharpens silhouette)
  for (let pa = 0; pa < 8; pa++) {
    const pAng = (pa / 8) * Math.PI * 2;
    const px = runeStoneWorldPos.x + Math.cos(pAng) * 1.55;
    const pz = runeStoneWorldPos.z + Math.sin(pAng) * 1.55;
    const py = getTerrainHeight(px, pz);
    const paver = createWeatheredStoneGeo(0.68, 0.08, 0.52, 0.03, 800 + pa);
    paver.rotateY(pAng + 0.3);
    paver.translate(px, py + 0.04, pz);
    stoneGeos.push(paver);
  }

  // Weathered megalith: 0.72m wide, 2.3m tall, 0.42m deep
  const runeMonolithGeo = createWeatheredStoneGeo(0.72, 2.3, 0.42, 0.05, 777);
  // Slightly orient toward the pathway approach (facing roughly South-Southeast)
  runeMonolithGeo.rotateY(0.42);
  runeMonolithGeo.translate(runeStoneWorldPos.x, runeStoneWorldPos.y + 1.15, runeStoneWorldPos.z);
  const runeMesh = new THREE.Mesh(runeMonolithGeo, runeStoneMat);
  runeMesh.castShadow = true;
  runeMesh.receiveShadow = true;
  group.add(runeMesh);

  colliders.push({
    x: runeStoneWorldPos.x,
    z: runeStoneWorldPos.z,
    radius: 0.85,
  });

  // Subtle localized PointLight for the Rune Stone (Subtle cyan/amber glow)
  const runeLight = new THREE.PointLight('#38bdf8', 0.45, 5.5, 1.8);
  runeLight.position.set(
    runeStoneWorldPos.x,
    runeStoneWorldPos.y + 1.45,
    runeStoneWorldPos.z,
  );
  group.add(runeLight);

  // Floating pollen / dust motes surrounding the Rune Stone (20 motes)
  const pollenCount = 20;
  const pollenPositions = new Float32Array(pollenCount * 3);
  const pollenBase: Array<{
    x: number;
    y: number;
    z: number;
    phase: number;
    radius: number;
  }> = [];

  for (let p = 0; p < pollenCount; p++) {
    const ang = rand() * Math.PI * 2;
    const rad = 0.45 + rand() * 1.1;
    const px = runeStoneWorldPos.x + Math.cos(ang) * rad;
    const pz = runeStoneWorldPos.z + Math.sin(ang) * rad;
    const py = runeStoneWorldPos.y + 0.4 + rand() * 1.8;

    pollenPositions[p * 3] = px;
    pollenPositions[p * 3 + 1] = py;
    pollenPositions[p * 3 + 2] = pz;
    pollenBase.push({
      x: px,
      y: py,
      z: pz,
      phase: rand() * Math.PI * 2,
      radius: 0.12 + rand() * 0.22,
    });
  }

  const pollenGeo = tracker.trackGeo(new THREE.BufferGeometry());
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
  const pollenMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#bae6fd'),
      size: 0.08,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const pollenPoints = new THREE.Points(pollenGeo, pollenMat);
  group.add(pollenPoints);

  // Merge remaining geometries
  if (stoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(stoneGeos));
    stoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, agedStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (masonryGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(masonryGeos));
    masonryGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, ruinedMasonryMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (mossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(mossGeos));
    mossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, ruinMossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (rootGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(rootGeos));
    rootGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, ancientRootMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // ============================================================================
  // 7. INTERACTION & DIALOGUE STATE
  // ============================================================================
  const RUNE_DIALOGUE_LINES = [
    {
      title: 'Ancient Weathered Rune Stone',
      subtitle: 'The Ancient Forest • Inscribed Memories',
      speaker: 'Yeshwanth to Harsha',
      message:
        'Centuries before us, someone carved words into this stone hoping they would outlast time...',
    },
    {
      title: 'Ancient Weathered Rune Stone',
      subtitle: 'The Ancient Forest • Inscribed Memories',
      speaker: 'Yeshwanth to Harsha',
      message:
        "I don't need a thousand years of stone, Harsha. Just every ordinary tomorrow with you.",
    },
    {
      title: 'Ancient Weathered Rune Stone',
      subtitle: 'The Ancient Forest • Inscribed Memories',
      speaker: 'Yeshwanth to Harsha',
      message:
        'Wherever this path leads us in life, my hand is already holding yours.',
    },
  ];

  let isDialogueOpen = false;
  let dialogueStep = 0;
  let activationGlowAlpha = 0.0;

  return {
    group,
    colliders,
    runeStoneWorldPos,

    getRunePrompt(playerWorldPos: THREE.Vector3) {
      if (isDialogueOpen) return null;
      const dist = Math.hypot(
        playerWorldPos.x - runeStoneWorldPos.x,
        playerWorldPos.z - runeStoneWorldPos.z,
      );
      if (dist < 2.85) {
        return {
          isNear: true,
          title: 'Ancient Weathered Rune Stone',
          actionLabel: 'Examine Inscriptions',
        };
      }
      return null;
    },

    triggerRuneStone(
      playerWorldPos: THREE.Vector3,
      audio: ForestAudioSynthesizer,
      elapsedTime: number,
    ): boolean {
      const dist = Math.hypot(
        playerWorldPos.x - runeStoneWorldPos.x,
        playerWorldPos.z - runeStoneWorldPos.z,
      );
      if (dist > 3.2) return false;

      isDialogueOpen = true;
      dialogueStep = 0;
      activationGlowAlpha = 1.0;
      audio.playRuneActivationChime(elapsedTime);
      return true;
    },

    isDialogueActive: () => isDialogueOpen,

    advanceDialogue(): boolean {
      if (!isDialogueOpen) return false;
      if (dialogueStep < RUNE_DIALOGUE_LINES.length - 1) {
        dialogueStep++;
        return true;
      }
      // Reached final line -> Enter completes interaction and restores gameplay!
      isDialogueOpen = false;
      return true;
    },

    skipDialogue(): boolean {
      if (!isDialogueOpen) return false;
      isDialogueOpen = false;
      return true;
    },

    getActiveBanner(): RuneStoneDialogueBanner | null {
      if (!isDialogueOpen) return null;
      const step = RUNE_DIALOGUE_LINES[dialogueStep];
      return {
        title: step.title,
        subtitle: step.subtitle,
        message: step.message,
        speaker: step.speaker,
        stepIndex: dialogueStep + 1,
        totalSteps: RUNE_DIALOGUE_LINES.length,
      };
    },

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
      _audio: ForestAudioSynthesizer,
    ): void {
      const dist = Math.hypot(
        playerWorldPos.x - runeStoneWorldPos.x,
        playerWorldPos.z - runeStoneWorldPos.z,
      );

      // Subtle resting glow + activation boost
      const isNear = dist < 4.0;
      const restingGlow = isNear ? 0.35 + Math.sin(elapsedTime * 2.5) * 0.12 : 0.16;
      const currentEmissive = Math.max(restingGlow, activationGlowAlpha * 0.85);

      runeStoneMat.emissiveIntensity = currentEmissive;
      runeLight.intensity = 0.45 + activationGlowAlpha * 0.95;

      // Gentle breathing pulse for the magical Star-Bell Blossom landmark plant
      starBellPetalMat.emissiveIntensity = 0.75 + Math.sin(elapsedTime * 2.2) * 0.18;

      // Synchronized breathing pulse for the Neon Pathway & Signboard illumination
      const pathPulse = Math.sin(elapsedTime * 2.6);
      neonPathMat.emissiveIntensity = 0.95 + pathPulse * 0.28;
      neonFilamentMat.emissiveIntensity = 1.4 + Math.sin(elapsedTime * 2.6 + 0.5) * 0.35;
      neonGlyphMat.emissiveIntensity = 1.25 + pathPulse * 0.25;
      signLight.intensity = 1.35 + pathPulse * 0.25;

      if (!isDialogueOpen && activationGlowAlpha > 0) {
        activationGlowAlpha = dampValue(activationGlowAlpha, 0, 1.8, dt);
      }

      // Animate pollen motes
      const posAttr = pollenGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let p = 0; p < pollenCount; p++) {
        const b = pollenBase[p];
        const a = elapsedTime * 0.45 + b.phase;
        posAttr.setXYZ(
          p,
          b.x + Math.cos(a) * b.radius,
          b.y + Math.sin(elapsedTime * 0.8 + b.phase) * 0.18 + (isDialogueOpen ? 0.25 : 0),
          b.z + Math.sin(a) * b.radius,
        );
      }
      posAttr.needsUpdate = true;
      pollenMat.opacity = 0.38 + activationGlowAlpha * 0.45;
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
