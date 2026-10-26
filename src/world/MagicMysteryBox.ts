import * as THREE from 'three';
import { CircleCollider } from './VegetationSystem';
import {
  CASTLE_GATE_POS,
  CASTLE_KEEP_POS,
  CASTLE_TERRACE_POS,
  MYSTERY_BOX_POS,
  easeInOutQuad,
  easeOutCubic,
  smoothstep01,
} from './terrainMath';

export type MysteryBoxState = 'CLOSED' | 'CINEMATIC' | 'OPENED';
export type CastleGateState = 'LOCKED' | 'UNLOCKING' | 'OPEN';
export type MysteryPromptMode =
  | 'none'
  | 'open_box'
  | 'locked_gate'
  | 'unlock_gate';

export interface MysteryCinematicCaption {
  speaker: string;
  line: string;
  headline?: string;
  subline?: string;
  stepIndex: number;
  totalSteps: number;
}

export interface MagicMysteryBoxBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  getBoxState: () => MysteryBoxState;
  getGateState: () => CastleGateState;
  hasKey: () => boolean;
  isCastleAwaitsVisible: () => boolean;
  isDialogueActive: () => boolean;
  isCinematicCameraActive: () => boolean;
  advanceDialogue: () => boolean;
  skipCinematicOrDialogue: () => boolean;
  getActiveCaption: () => MysteryCinematicCaption | null;
  getPromptMode: (
    playerPos: THREE.Vector3,
    isWalking: boolean,
  ) => MysteryPromptMode;
  startBoxCinematic: (
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    outTargetPlayerPos: THREE.Vector3,
    outTargetPlayerYaw: { value: number },
  ) => boolean;
  updateCinematic: (
    dt: number,
    elapsedTime: number,
    camera: THREE.PerspectiveCamera,
    rightHandWorldPos: THREE.Vector3,
    gameplayCamPos: THREE.Vector3,
    gameplayLookAt: THREE.Vector3,
  ) => {
    finished: boolean;
    isReceivingKey: boolean;
    cinematicTime: number;
  };
  unlockCastleGate: (
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    outTargetPlayerPos: THREE.Vector3,
    outTargetPlayerYaw: { value: number },
  ) => boolean;
  getCameraShakeOffset: (target: THREE.Vector3) => THREE.Vector3;
  update: (dt: number, elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Generates high-resolution (1024x256) procedural Albedo + Tangent-Space Normal + Bump
 * CanvasTextures for the golden key's central collar/shaft, physically engraving
 * "Harshuu 💗" / "HARSHA" into the metal surface with crisp chisel bevels and filigree framing.
 */
function createHarshaEngravedTextures(): {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 256;
  const inscriptionText = 'HARSHA';

  // 1. Heightfield Canvas (white = raised polished gold, black = deep chiseled engraving)
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = width;
  heightCanvas.height = height;
  const hCtx = heightCanvas.getContext('2d')!;

  // Base flat polished gold surface (height = 235)
  hCtx.fillStyle = 'rgb(235, 235, 235)';
  hCtx.fillRect(0, 0, width, height);

  // Outer beveled recessed border frame
  hCtx.lineWidth = 10;
  hCtx.strokeStyle = 'rgb(95, 95, 95)';
  hCtx.strokeRect(24, 22, width - 48, height - 44);

  hCtx.lineWidth = 4;
  hCtx.strokeStyle = 'rgb(255, 255, 255)';
  hCtx.strokeRect(34, 32, width - 68, height - 64);

  // Subtle decorative diamond hallmarks flanking the inscription
  const drawDiamond = (cx: number, cy: number, rx: number, ry: number) => {
    hCtx.beginPath();
    hCtx.moveTo(cx, cy - ry);
    hCtx.lineTo(cx + rx, cy);
    hCtx.lineTo(cx, cy + ry);
    hCtx.lineTo(cx - rx, cy);
    hCtx.closePath();
    hCtx.fillStyle = 'rgb(40, 40, 40)';
    hCtx.fill();
    hCtx.lineWidth = 3;
    hCtx.strokeStyle = 'rgb(255, 255, 255)';
    hCtx.stroke();
  };
  drawDiamond(82, height / 2, 16, 20);
  drawDiamond(width - 82, height / 2, 16, 20);

  // Deeply chiseled inscription in the center of the shaft
  hCtx.font = '900 108px Georgia, "Times New Roman", serif';
  hCtx.textAlign = 'center';
  hCtx.textBaseline = 'middle';

  // Outer chisel bevel halo (slight raised lip around the carved letters)
  hCtx.lineWidth = 14;
  hCtx.strokeStyle = 'rgb(255, 255, 255)';
  hCtx.strokeText(inscriptionText, width / 2, height / 2 + 4);

  // Mid-slope V-carve wall
  hCtx.lineWidth = 7;
  hCtx.strokeStyle = 'rgb(85, 85, 85)';
  hCtx.strokeText(inscriptionText, width / 2, height / 2 + 4);

  // Deep recessed letter trench
  hCtx.fillStyle = 'rgb(12, 12, 12)';
  hCtx.fillText(inscriptionText, width / 2, height / 2 + 4);

  const hData = hCtx.getImageData(0, 0, width, height).data;

  // 2. Compute Tangent-Space Normal Map & Roughness Map from the Heightfield
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nCtx = normalCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(width, height);
  const nData = nImg.data;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(width, height);
  const rData = rImg.data;

  const sampleH = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return hData[(cy * width + cx) * 4] / 255.0;
  };

  const strength = 7.2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const hL = sampleH(x - 1, y);
      const hR = sampleH(x + 1, y);
      const hU = sampleH(x, y - 1);
      const hD = sampleH(x, y + 1);
      const hC = sampleH(x, y);

      let nx = (hL - hR) * strength;
      let ny = (hD - hU) * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      nData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nData[idx + 3] = 255;

      // Recessed engraving has higher roughness (matte antique patina), raised gold is satin-brushed (not mirror-blinding)
      const roughVal = Math.round((0.38 + (1.0 - hC) * 0.44) * 255);
      rData[idx] = roughVal;
      rData[idx + 1] = roughVal;
      rData[idx + 2] = roughVal;
      rData[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // 3. Albedo Canvas (Warm satin antique gold with deep high-contrast chiseled letters)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;

  const goldGrad = aCtx.createLinearGradient(0, 0, 0, height);
  goldGrad.addColorStop(0, '#DFB14B');
  goldGrad.addColorStop(0.5, '#C8962E');
  goldGrad.addColorStop(1, '#A6751A');
  aCtx.fillStyle = goldGrad;
  aCtx.fillRect(0, 0, width, height);

  // Recessed border groove
  aCtx.lineWidth = 9;
  aCtx.strokeStyle = '#5c3a07';
  aCtx.strokeRect(24, 22, width - 48, height - 44);

  aCtx.lineWidth = 3;
  aCtx.strokeStyle = '#e8c36b';
  aCtx.strokeRect(34, 32, width - 68, height - 64);

  // Flanking diamond hallmarks
  const drawAlbedoDiamond = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ) => {
    aCtx.beginPath();
    aCtx.moveTo(cx, cy - ry);
    aCtx.lineTo(cx + rx, cy);
    aCtx.lineTo(cx, cy + ry);
    aCtx.lineTo(cx - rx, cy);
    aCtx.closePath();
    aCtx.fillStyle = '#3b2202';
    aCtx.fill();
    aCtx.lineWidth = 2.5;
    aCtx.strokeStyle = '#e3bc64';
    aCtx.stroke();
  };
  drawAlbedoDiamond(82, height / 2, 16, 20);
  drawAlbedoDiamond(width - 82, height / 2, 16, 20);

  // Subtle satin bevel edge + deep burnished antique-bronze recess for the inscription
  aCtx.font = '900 108px Georgia, "Times New Roman", serif';
  aCtx.textAlign = 'center';
  aCtx.textBaseline = 'middle';

  aCtx.lineWidth = 9;
  aCtx.strokeStyle = '#e6c168';
  aCtx.strokeText(inscriptionText, width / 2, height / 2 + 4);

  aCtx.lineWidth = 5;
  aCtx.strokeStyle = '#633b06';
  aCtx.strokeText(inscriptionText, width / 2, height / 2 + 4);

  aCtx.fillStyle = '#241201';
  aCtx.fillText(inscriptionText, width / 2, height / 2 + 4);

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = 8;
  albedoMap.needsUpdate = true;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.anisotropy = 8;
  normalMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(heightCanvas);
  bumpMap.anisotropy = 8;
  bumpMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 8;
  roughnessMap.needsUpdate = true;

  return { albedoMap, normalMap, bumpMap, roughnessMap };
}

/**
 * Helper to create a 2D Three.Shape for a stylized symmetric heart.
 */
function createHeartShape(scale = 1.0): THREE.Shape {
  const s = scale;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.55 * s);
  shape.bezierCurveTo(
    0.55 * s,
    -0.15 * s,
    0.68 * s,
    0.35 * s,
    0.32 * s,
    0.52 * s,
  );
  shape.bezierCurveTo(0.12 * s, 0.62 * s, 0, 0.42 * s, 0, 0.28 * s);
  shape.bezierCurveTo(
    0,
    0.42 * s,
    -0.12 * s,
    0.62 * s,
    -0.32 * s,
    0.52 * s,
  );
  shape.bezierCurveTo(
    -0.68 * s,
    0.35 * s,
    -0.55 * s,
    -0.15 * s,
    0,
    -0.55 * s,
  );
  return shape;
}

/**
 * Lid opening curve with smooth ease-in-out and a slight mechanical settle bounce at the top.
 */
function lidEaseWithSettleBounce(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  if (x < 0.82) {
    const t = x / 0.82;
    // Smooth ease-in-out up to 1.045 (slight overshoot against the back stop)
    return (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) * 1.045;
  }
  // Mechanical settle bounce from 1.045 -> 0.985 -> 1.0
  const b = (x - 0.82) / 0.18;
  return 1.0 + Math.cos(b * Math.PI * 1.5) * 0.045 * (1.0 - b);
}

/**
 * Heavy-mass inertia curve for the massive oak & wrought-iron Castle Doors (Stage 3: 2.6s - 5.6s).
 * - Very slow initial acceleration overcoming static inertia
 * - Steady mid-swing with subtle stone-hinge friction micro-vibration
 * - Slight mechanical rebound/thud when hitting the open stops at u = 1.0
 */
function heavyDoorInertiaCurve(u: number, elapsedTime: number): number {
  const x = Math.max(0, Math.min(1, u));
  if (x < 0.88) {
    const s = x / 0.88;
    // Cubic-in / quadratic-out heavy mass curve reaching 1.022 at s = 1.0
    const base =
      s < 0.45
        ? 2.2 * Math.pow(s, 2.6)
        : 1.022 - 0.82 * Math.pow(1.0 - s, 2.1);
    const hingeFrictionMicroVib =
      Math.sin(elapsedTime * 42.0) * 0.0035 * Math.sin(s * Math.PI);
    return Math.max(0, base + hingeFrictionMicroVib);
  }
  // Final mechanical rebound/thud against the stone door-stops (0.88 .. 1.0)
  const r = (x - 0.88) / 0.12;
  return 1.0 + Math.cos(r * Math.PI * 1.65) * 0.022 * (1.0 - r);
}

// ============================================================================
// SHARED MASONRY DUST PARTICLE POOL (80 Pre-Allocated Particles, Zero-GC)
// ============================================================================
const MASONRY_DUST_POOL_SIZE = 80;
const _poolMat4 = new THREE.Matrix4();
const _poolPos = new THREE.Vector3();
const _poolQuat = new THREE.Quaternion();
const _poolEuler = new THREE.Euler();
const _poolScale = new THREE.Vector3();
const _poolColor = new THREE.Color();

interface MasonryDustParticlePool {
  group: THREE.Group;
  triggerUnsealBurst: () => void;
  resetPool: () => void;
  update: (dt: number, elapsedTime: number) => void;
  getActiveCount: () => number;
}

/**
 * Generates a soft radial procedural dust puff CanvasTexture for the fine
 * airborne mortar dust enveloping the falling masonry fragments.
 */
function createSoftMasonryDustTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0.0, 'rgba(232, 225, 214, 0.95)');
  grad.addColorStop(0.38, 'rgba(214, 205, 192, 0.65)');
  grad.addColorStop(0.72, 'rgba(186, 177, 164, 0.22)');
  grad.addColorStop(1.0, 'rgba(168, 158, 145, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a shared particle pool of 80 masonry dust particles that fall from the
 * Castle Gate archway keystone (Y ≈ 4.68m) to the stone threshold (Y ≈ 0.03m)
 * when the Castle Gate unseals.
 *
 * Performance Architecture:
 * - Pre-allocated Structure-of-Arrays (SoA) typed buffers + O(1) free-list stack.
 * - Zero heap allocations in `triggerUnsealBurst()` or `update(dt, elapsedTime)`.
 * - Dual shared GPU draw calls:
 *   1) `THREE.InstancedMesh` (count = 80) for tumbling 3D stone & mortar crumbs.
 *   2) `THREE.Points` (count = 80) for soft billowing masonry dust plumes.
 */
function createMasonryDustParticlePool(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  trackTex: <T extends THREE.Texture>(t: T) => T,
): MasonryDustParticlePool {
  const poolGroup = new THREE.Group();
  poolGroup.name = 'MasonryDustParticlePool';
  poolGroup.visible = false;

  const count = MASONRY_DUST_POOL_SIZE;

  // O(1) Shared Pool Free-List Stack & Active Flags
  const freeList = new Int32Array(count);
  const activeFlags = new Uint8Array(count);
  let freeTop = count;
  let activeCount = 0;

  // Structure-of-Arrays (SoA) Particle Physics State
  const spawnDelay = new Float32Array(count);
  const age = new Float32Array(count);
  const maxLife = new Float32Array(count);
  const posX = new Float32Array(count);
  const posY = new Float32Array(count);
  const posZ = new Float32Array(count);
  const velX = new Float32Array(count);
  const velY = new Float32Array(count);
  const velZ = new Float32Array(count);
  const rotX = new Float32Array(count);
  const rotY = new Float32Array(count);
  const rotZ = new Float32Array(count);
  const angVelX = new Float32Array(count);
  const angVelY = new Float32Array(count);
  const angVelZ = new Float32Array(count);
  const chipScale = new Float32Array(count);
  const gravityAccel = new Float32Array(count);
  const airDrag = new Float32Array(count);
  const turbulenceSeed = new Float32Array(count);
  const bounceCount = new Uint8Array(count);
  const baseColorR = new Float32Array(count);
  const baseColorG = new Float32Array(count);
  const baseColorB = new Float32Array(count);

  // 1. Shared 3D Masonry Chip InstancedMesh (Single GPU draw call for all 80 stone crumbs)
  const chipGeo = trackGeo(new THREE.DodecahedronGeometry(0.024, 0));
  chipGeo.scale(1.18, 0.74, 0.92);
  const chipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  const chipInstancedMesh = new THREE.InstancedMesh(chipGeo, chipMat, count);
  chipInstancedMesh.frustumCulled = false;
  chipInstancedMesh.castShadow = false;
  chipInstancedMesh.receiveShadow = true;

  // 2. Shared Soft Dust Cloud Points (Single GPU draw call for airborne mortar dust)
  const pointPositions = new Float32Array(count * 3);
  const pointColors = new Float32Array(count * 3);
  const dustPositionAttr = new THREE.BufferAttribute(pointPositions, 3);
  dustPositionAttr.setUsage(THREE.DynamicDrawUsage);
  const dustColorAttr = new THREE.BufferAttribute(pointColors, 3);
  dustColorAttr.setUsage(THREE.DynamicDrawUsage);

  const dustPointsGeo = trackGeo(new THREE.BufferGeometry());
  dustPointsGeo.setAttribute('position', dustPositionAttr);
  dustPointsGeo.setAttribute('color', dustColorAttr);

  const dustSpriteTex = trackTex(createSoftMasonryDustTexture());
  const dustPointsMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.145,
      map: dustSpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const dustCloudPoints = new THREE.Points(dustPointsGeo, dustPointsMat);
  dustCloudPoints.frustumCulled = false;

  poolGroup.add(chipInstancedMesh, dustCloudPoints);

  // Palette of weathered limestone, mortar grey, warm sandstone, and basalt specks
  const stonePalette = [
    new THREE.Color('#dfd8ce'),
    new THREE.Color('#c9c0b3'),
    new THREE.Color('#b7afa2'),
    new THREE.Color('#d4c7b4'),
    new THREE.Color('#9c9488'),
  ];

  // Deterministic pseudo-random helper for repeatable organic distribution
  const seededRand = (seed: number): number => {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    const c = stonePalette[i % stonePalette.length];
    baseColorR[i] = c.r;
    baseColorG[i] = c.g;
    baseColorB[i] = c.b;
    chipInstancedMesh.setColorAt(i, c);
  }
  if (chipInstancedMesh.instanceColor) {
    chipInstancedMesh.instanceColor.needsUpdate = true;
  }

  const hideSlotVisual = (idx: number) => {
    _poolMat4.makeScale(0, 0, 0);
    chipInstancedMesh.setMatrixAt(idx, _poolMat4);
    pointPositions[idx * 3] = 0;
    pointPositions[idx * 3 + 1] = -100;
    pointPositions[idx * 3 + 2] = 0;
    pointColors[idx * 3] = 0;
    pointColors[idx * 3 + 1] = 0;
    pointColors[idx * 3 + 2] = 0;
  };

  const resetPool = () => {
    freeTop = count;
    activeCount = 0;
    for (let i = 0; i < count; i++) {
      freeList[i] = count - 1 - i;
      activeFlags[i] = 0;
      hideSlotVisual(i);
    }
    chipInstancedMesh.instanceMatrix.needsUpdate = true;
    dustPositionAttr.needsUpdate = true;
    dustColorAttr.needsUpdate = true;
    poolGroup.visible = false;
  };

  // Initialize pool in clean inactive state
  resetPool();

  const acquireParticle = (): number => {
    if (freeTop <= 0) {
      return -1;
    }
    freeTop--;
    const idx = freeList[freeTop];
    activeFlags[idx] = 1;
    activeCount++;
    return idx;
  };

  const releaseParticle = (idx: number) => {
    if (activeFlags[idx] === 0) return;
    activeFlags[idx] = 0;
    freeList[freeTop] = idx;
    freeTop++;
    activeCount = Math.max(0, activeCount - 1);
    hideSlotVisual(idx);
  };

  /**
   * Acquires all 80 particles from the shared pool and spawns them along the
   * Castle Gate archway keystone (Y ≈ 4.68m) and upper arch voussoirs, ready
   * to cascade down to the stone threshold (Y ≈ 0.03m).
   */
  const triggerUnsealBurst = () => {
    resetPool();
    poolGroup.visible = true;

    for (let i = 0; i < count; i++) {
      const slot = acquireParticle();
      if (slot < 0) break;

      const r1 = seededRand(i * 3.17 + 1.1);
      const r2 = seededRand(i * 7.31 + 2.3);
      const r3 = seededRand(i * 11.13 + 3.7);
      const r4 = seededRand(i * 17.59 + 5.1);

      // 60% of particles burst directly from the central Archway Keystone (Y = 4.50m..4.82m, X = -0.38m..+0.38m)
      // 40% shake loose from the adjacent upper pointed-arch mortar joints
      const isKeystoneCore = i < 48;
      if (isKeystoneCore) {
        posX[slot] = (r1 - 0.5) * 0.76;
        posY[slot] = 4.52 + r2 * 0.32;
        posZ[slot] = 0.18 + (r3 - 0.5) * 0.28;
        spawnDelay[slot] = r4 * 0.26; // Immediate dense cascade on seal break
      } else {
        const archAngle = (r1 - 0.5) * Math.PI * 0.78;
        posX[slot] = Math.sin(archAngle) * 1.68;
        posY[slot] = 3.82 + Math.cos(archAngle) * 0.86;
        posZ[slot] = 0.16 + (r3 - 0.5) * 0.26;
        spawnDelay[slot] = 0.08 + r4 * 0.48; // Trailing masonry specks during friction shudder
      }

      // Initial velocity: downward impulse from keystone jolt + slight outward drift
      velX[slot] = (r2 - 0.5) * 0.42 + posX[slot] * 0.08;
      velY[slot] = -(0.45 + r1 * 0.95);
      velZ[slot] = 0.14 + r3 * 0.46;

      rotX[slot] = r1 * Math.PI * 2;
      rotY[slot] = r2 * Math.PI * 2;
      rotZ[slot] = r3 * Math.PI * 2;
      angVelX[slot] = (r2 - 0.5) * 7.5;
      angVelY[slot] = (r3 - 0.5) * 7.5;
      angVelZ[slot] = (r4 - 0.5) * 7.5;

      // Heavier stone crumbs fall faster; finer mortar specks have higher air drag
      const sizeFactor = 0.55 + r1 * 0.95;
      chipScale[slot] = sizeFactor;
      gravityAccel[slot] = 3.6 + sizeFactor * 1.85; // ~4.6 - 6.4 m/s^2 so 4.7m drop takes ~1.2s - 1.6s
      airDrag[slot] = 0.55 + (1.5 - sizeFactor) * 0.85;
      turbulenceSeed[slot] = r4 * Math.PI * 2;
      bounceCount[slot] = 0;

      age[slot] = 0;
      maxLife[slot] = 3.1 + r3 * 0.85;

      // Place hidden until spawnDelay elapses
      hideSlotVisual(slot);
    }

    chipInstancedMesh.instanceMatrix.needsUpdate = true;
    dustPositionAttr.needsUpdate = true;
    dustColorAttr.needsUpdate = true;
  };

  const update = (dt: number, elapsedTime: number) => {
    if (activeCount <= 0) {
      if (poolGroup.visible) {
        poolGroup.visible = false;
      }
      return;
    }

    const thresholdY = 0.032;

    for (let i = 0; i < count; i++) {
      if (activeFlags[i] === 0) continue;

      if (spawnDelay[i] > 0) {
        spawnDelay[i] -= dt;
        continue;
      }

      age[i] += dt;
      const lifeRatio = age[i] / maxLife[i];
      if (lifeRatio >= 1.0) {
        releaseParticle(i);
        continue;
      }

      // Apply gravity & air drag while airborne, plus subtle turbulent eddy from the opening portal
      if (posY[i] > thresholdY || velY[i] > 0.01) {
        velY[i] -= gravityAccel[i] * dt;

        const dragFactor = Math.max(0, 1.0 - airDrag[i] * dt);
        velX[i] *= dragFactor;
        velZ[i] *= dragFactor;

        const turbPhase = turbulenceSeed[i] + elapsedTime * 4.2;
        velX[i] += Math.sin(turbPhase) * 0.28 * dt;
        velZ[i] += Math.cos(turbPhase * 0.85) * 0.22 * dt;

        posX[i] += velX[i] * dt;
        posY[i] += velY[i] * dt;
        posZ[i] += velZ[i] * dt;

        rotX[i] += angVelX[i] * dt;
        rotY[i] += angVelY[i] * dt;
        rotZ[i] += angVelZ[i] * dt;

        // Impact & pooling at the bottom stone threshold
        if (posY[i] <= thresholdY) {
          posY[i] = thresholdY;
          if (bounceCount[i] < 2 && Math.abs(velY[i]) > 0.35) {
            // Damped masonry crumb micro-bounce on the stone threshold
            velY[i] = -velY[i] * (0.18 + (i % 3) * 0.05);
            velX[i] =
              velX[i] * 0.65 + Math.sin(turbulenceSeed[i]) * 0.28;
            velZ[i] =
              velZ[i] * 0.65 + Math.cos(turbulenceSeed[i]) * 0.28;
            bounceCount[i]++;
          } else {
            velY[i] = 0;
          }
        }
      } else {
        // Pooled on the threshold floor: gently spread outward along the stone seam and settle
        posY[i] = thresholdY;
        velX[i] *= Math.max(0, 1.0 - 4.5 * dt);
        velZ[i] *= Math.max(0, 1.0 - 4.5 * dt);
        posX[i] +=
          (velX[i] + Math.sin(turbulenceSeed[i]) * 0.06) * dt;
        posZ[i] +=
          (velZ[i] + Math.cos(turbulenceSeed[i]) * 0.06) * dt;
      }

      // Compute smooth fade-in on release and fade-out after pooling on the threshold
      const fadeIn = smoothstep01(age[i] / 0.14);
      const fadeOut = 1.0 - smoothstep01((lifeRatio - 0.68) / 0.32);
      const alpha = fadeIn * fadeOut;

      // Update InstancedMesh 3D masonry crumb transform (zero-GC)
      _poolPos.set(posX[i], posY[i], posZ[i]);
      _poolEuler.set(rotX[i], rotY[i], rotZ[i]);
      _poolQuat.setFromEuler(_poolEuler);
      const s = chipScale[i] * alpha;
      _poolScale.set(s, s, s);
      _poolMat4.compose(_poolPos, _poolQuat, _poolScale);
      chipInstancedMesh.setMatrixAt(i, _poolMat4);

      // Update companion soft dust cloud point position & vertex color intensity
      pointPositions[i * 3] = posX[i];
      pointPositions[i * 3 + 1] = posY[i] + 0.025;
      pointPositions[i * 3 + 2] = posZ[i];

      pointColors[i * 3] = baseColorR[i] * alpha;
      pointColors[i * 3 + 1] = baseColorG[i] * alpha;
      pointColors[i * 3 + 2] = baseColorB[i] * alpha;
    }

    chipInstancedMesh.instanceMatrix.needsUpdate = true;
    dustPositionAttr.needsUpdate = true;
    dustColorAttr.needsUpdate = true;
  };

  return {
    group: poolGroup,
    triggerUnsealBurst,
    resetPool,
    update,
    getActiveCount: () => activeCount,
  };
}

export function createMagicMysteryBoxSystem(): MagicMysteryBoxBundle {
  const group = new THREE.Group();
  group.name = 'MagicMysteryBoxAndCastleGate';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // Orientation along the Castle Landing Terrace -> Castle Keep axis
  const terraceToCastleYaw = Math.atan2(
    CASTLE_KEEP_POS.x - CASTLE_TERRACE_POS.x,
    CASTLE_KEEP_POS.z - CASTLE_TERRACE_POS.z,
  ); // -Math.PI / 4
  // Front (+Z) of the Plinth & Castle Gate faces Southeast toward the Landing Circle
  const facingTerraceYaw = terraceToCastleYaw + Math.PI; // 3 * Math.PI / 4

  // ==========================================================================
  // SHARED MATERIALS
  // ==========================================================================
  const creamStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dfd7cc'),
      roughness: 0.78,
      metalness: 0.04,
    }),
  );
  const basaltStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4c465e'),
      roughness: 0.82,
      metalness: 0.08,
    }),
  );
  const darkWalnutMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2c1810'),
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 0.48,
      clearcoatRoughness: 0.28,
    }),
  );
  const brushedBrassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c89d54'),
      roughness: 0.3,
      metalness: 0.88,
    }),
  );
  const glowingBrassRuneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f7d586'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.15,
      roughness: 0.28,
      metalness: 0.82,
    }),
  );
  const burgundyVelvetMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#5c1024'),
      roughness: 0.92,
      metalness: 0.02,
      clearcoat: 0.05,
    }),
  );
  const violetRuneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b4fe'),
      emissive: new THREE.Color('#7c3aed'),
      emissiveIntensity: 0.45,
      roughness: 0.32,
      metalness: 0.15,
    }),
  );
  const polishedGoldKeyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d8a236'),
      emissive: new THREE.Color('#4a2c04'),
      emissiveIntensity: 0.03,
      roughness: 0.36,
      metalness: 0.78,
      envMapIntensity: 0.45,
      clearcoat: 0.14,
      clearcoatRoughness: 0.38,
    }),
  );

  // Engraved "Harshuu 💗" / "HARSHA" material for both front (+Z) and back (-Z) faces of the key shaft
  const engravedMaps = createHarshaEngravedTextures();
  trackTex(engravedMaps.albedoMap);
  trackTex(engravedMaps.normalMap);
  trackTex(engravedMaps.bumpMap);
  trackTex(engravedMaps.roughnessMap);

  const engravedHarshaKeyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: engravedMaps.albedoMap,
      normalMap: engravedMaps.normalMap,
      normalScale: new THREE.Vector2(1.95, 1.95),
      bumpMap: engravedMaps.bumpMap,
      bumpScale: 0.016,
      roughnessMap: engravedMaps.roughnessMap,
      roughness: 0.44,
      metalness: 0.72,
      envMapIntensity: 0.38,
      emissive: new THREE.Color('#3d2303'),
      emissiveIntensity: 0.02,
      clearcoat: 0.08,
      clearcoatRoughness: 0.45,
    }),
  );

  /**
   * Helper to build the 0.30m sculpted Golden Heart Key mesh hierarchy.
   */
  const buildGoldenKeyVisual = (): THREE.Group => {
    const visual = new THREE.Group();

    // A) Heart-Shaped Bow (x = -0.15m to -0.058m)
    const bowHeartPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3) * 0.0024;
      const hy =
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)) *
        0.0024;
      bowHeartPts.push(new THREE.Vector3(-0.105 + hy, hx, 0));
    }
    const bowCurve = new THREE.CatmullRomCurve3(bowHeartPts, true);
    const bowTubeGeo = trackGeo(
      new THREE.TubeGeometry(bowCurve, 48, 0.0075, 10, true),
    );
    const bowTubeMesh = new THREE.Mesh(bowTubeGeo, polishedGoldKeyMat);
    bowTubeMesh.castShadow = true;
    visual.add(bowTubeMesh);

    const innerBowGeo = trackGeo(
      new THREE.TorusGeometry(0.018, 0.0038, 8, 20),
    );
    innerBowGeo.translate(-0.104, 0, 0);
    const innerBowMesh = new THREE.Mesh(innerBowGeo, polishedGoldKeyMat);
    visual.add(innerBowMesh);

    const collarRingGeo = trackGeo(
      new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16),
    );
    collarRingGeo.rotateZ(Math.PI / 2);
    const leftCollar = new THREE.Mesh(collarRingGeo, polishedGoldKeyMat);
    leftCollar.position.set(-0.062, 0, 0);
    const rightCollar = new THREE.Mesh(collarRingGeo, polishedGoldKeyMat);
    rightCollar.position.set(0.068, 0, 0);
    visual.add(leftCollar, rightCollar);

    // B) Engraved Golden Collar / Shaft Plate (both +Z and -Z faces receive the engraved material)
    const engravedShaftGeo = trackGeo(
      new THREE.BoxGeometry(0.118, 0.034, 0.015),
    );
    engravedShaftGeo.translate(0.003, 0, 0);
    const engravedShaftMaterials = [
      polishedGoldKeyMat,
      polishedGoldKeyMat,
      polishedGoldKeyMat,
      polishedGoldKeyMat,
      engravedHarshaKeyMat,
      engravedHarshaKeyMat,
    ];
    const engravedShaftMesh = new THREE.Mesh(
      engravedShaftGeo,
      engravedShaftMaterials,
    );
    engravedShaftMesh.castShadow = true;
    engravedShaftMesh.receiveShadow = true;
    visual.add(engravedShaftMesh);

    const shaftRailGeo = trackGeo(
      new THREE.BoxGeometry(0.122, 0.0045, 0.0175),
    );
    const topRail = new THREE.Mesh(shaftRailGeo, polishedGoldKeyMat);
    topRail.position.set(0.003, 0.018, 0);
    const botRail = new THREE.Mesh(shaftRailGeo, polishedGoldKeyMat);
    botRail.position.set(0.003, -0.018, 0);
    visual.add(topRail, botRail);

    // C) Key Tip Barrel & Ornate Warded Key Bit (total key length = 0.30m)
    const barrelGeo = trackGeo(
      new THREE.CylinderGeometry(0.0095, 0.0095, 0.082, 14),
    );
    barrelGeo.rotateZ(Math.PI / 2);
    barrelGeo.translate(0.109, 0, 0);
    const barrelMesh = new THREE.Mesh(barrelGeo, polishedGoldKeyMat);
    barrelMesh.castShadow = true;
    visual.add(barrelMesh);

    const tipFinialGeo = trackGeo(new THREE.SphereGeometry(0.011, 12, 12));
    tipFinialGeo.translate(0.15, 0, 0);
    const tipFinial = new THREE.Mesh(tipFinialGeo, polishedGoldKeyMat);
    visual.add(tipFinial);

    const bitMainGeo = trackGeo(new THREE.BoxGeometry(0.038, 0.042, 0.009));
    bitMainGeo.translate(0.118, -0.026, 0);
    const bitMain = new THREE.Mesh(bitMainGeo, polishedGoldKeyMat);
    bitMain.castShadow = true;

    const bitTooth1Geo = trackGeo(new THREE.BoxGeometry(0.01, 0.012, 0.013));
    bitTooth1Geo.translate(0.106, -0.048, 0);
    const bitTooth1 = new THREE.Mesh(bitTooth1Geo, polishedGoldKeyMat);

    const bitTooth2Geo = trackGeo(new THREE.BoxGeometry(0.012, 0.012, 0.013));
    bitTooth2Geo.translate(0.13, -0.048, 0);
    const bitTooth2 = new THREE.Mesh(bitTooth2Geo, polishedGoldKeyMat);

    visual.add(bitMain, bitTooth1, bitTooth2);
    return visual;
  };

  // ==========================================================================
  // 1. ORNATE STONE PLINTH & DARK WALNUT MYSTERY BOX (MYSTERY_BOX_POS)
  // ==========================================================================
  const plinthRoot = new THREE.Group();
  plinthRoot.position.set(
    MYSTERY_BOX_POS.x,
    MYSTERY_BOX_POS.y,
    MYSTERY_BOX_POS.z,
  );
  plinthRoot.rotation.y = facingTerraceYaw;
  group.add(plinthRoot);

  // 1A. Ornate Stone Plinth (~0.96m high with a burgundy velvet top pad)
  const baseStep1Geo = trackGeo(
    new THREE.CylinderGeometry(0.56, 0.64, 0.14, 8),
  );
  baseStep1Geo.rotateY(Math.PI / 8);
  baseStep1Geo.translate(0, 0.07, 0);
  const baseStep1 = new THREE.Mesh(baseStep1Geo, basaltStoneMat);
  baseStep1.castShadow = true;
  baseStep1.receiveShadow = true;

  const baseStep2Geo = trackGeo(
    new THREE.CylinderGeometry(0.44, 0.52, 0.12, 8),
  );
  baseStep2Geo.rotateY(Math.PI / 8);
  baseStep2Geo.translate(0, 0.2, 0);
  const baseStep2 = new THREE.Mesh(baseStep2Geo, creamStoneMat);
  baseStep2.castShadow = true;
  baseStep2.receiveShadow = true;

  const columnGeo = trackGeo(
    new THREE.CylinderGeometry(0.31, 0.35, 0.54, 16),
  );
  columnGeo.translate(0, 0.53, 0);
  const columnMesh = new THREE.Mesh(columnGeo, creamStoneMat);
  columnMesh.castShadow = true;
  columnMesh.receiveShadow = true;

  const brassRingLowGeo = trackGeo(
    new THREE.TorusGeometry(0.355, 0.018, 8, 24),
  );
  brassRingLowGeo.rotateX(Math.PI / 2);
  brassRingLowGeo.translate(0, 0.28, 0);
  const brassRingLow = new THREE.Mesh(brassRingLowGeo, brushedBrassMat);

  const brassRingHighGeo = trackGeo(
    new THREE.TorusGeometry(0.325, 0.018, 8, 24),
  );
  brassRingHighGeo.rotateX(Math.PI / 2);
  brassRingHighGeo.translate(0, 0.78, 0);
  const brassRingHigh = new THREE.Mesh(brassRingHighGeo, brushedBrassMat);

  const plinthRuneRingGeo = trackGeo(
    new THREE.CylinderGeometry(0.334, 0.334, 0.045, 16),
  );
  plinthRuneRingGeo.translate(0, 0.54, 0);
  const plinthRuneRing = new THREE.Mesh(plinthRuneRingGeo, violetRuneMat);

  const capitalGeo = trackGeo(new THREE.BoxGeometry(0.74, 0.14, 0.56));
  capitalGeo.translate(0, 0.87, 0);
  const capitalMesh = new THREE.Mesh(capitalGeo, creamStoneMat);
  capitalMesh.castShadow = true;
  capitalMesh.receiveShadow = true;

  const capitalBrassTrimGeo = trackGeo(
    new THREE.BoxGeometry(0.76, 0.028, 0.58),
  );
  capitalBrassTrimGeo.translate(0, 0.945, 0);
  const capitalBrassTrim = new THREE.Mesh(
    capitalBrassTrimGeo,
    brushedBrassMat,
  );

  // Velvet plinth resting pad on top of the stone capital (visible when box levitates +0.14m)
  const plinthVelvetPadGeo = trackGeo(
    new THREE.BoxGeometry(0.62, 0.016, 0.46),
  );
  plinthVelvetPadGeo.translate(0, 0.958, 0);
  const plinthVelvetPad = new THREE.Mesh(
    plinthVelvetPadGeo,
    burgundyVelvetMat,
  );
  plinthVelvetPad.receiveShadow = true;

  plinthRoot.add(
    baseStep1,
    baseStep2,
    columnMesh,
    brassRingLow,
    brassRingHigh,
    plinthRuneRing,
    capitalMesh,
    capitalBrassTrim,
    plinthVelvetPad,
  );

  // 1B. Dark Walnut Mystery Box (Sitting on plinth top at Y = 0.96m, levitates to Y = 1.10m)
  const boxBaseY = 0.96;
  const boxGroup = new THREE.Group();
  boxGroup.position.set(0, boxBaseY, 0);
  plinthRoot.add(boxGroup);

  const boxW = 0.56;
  const boxH = 0.18;
  const boxD = 0.4;
  const wallT = 0.032;

  const floorGeo = trackGeo(new THREE.BoxGeometry(boxW, 0.028, boxD));
  floorGeo.translate(0, 0.014, 0);
  const frontWallGeo = trackGeo(new THREE.BoxGeometry(boxW, boxH, wallT));
  frontWallGeo.translate(0, boxH / 2, (boxD - wallT) / 2);
  const backWallGeo = trackGeo(new THREE.BoxGeometry(boxW, boxH, wallT));
  backWallGeo.translate(0, boxH / 2, -(boxD - wallT) / 2);
  const leftWallGeo = trackGeo(
    new THREE.BoxGeometry(wallT, boxH, boxD - wallT * 2),
  );
  leftWallGeo.translate(-(boxW - wallT) / 2, boxH / 2, 0);
  const rightWallGeo = trackGeo(
    new THREE.BoxGeometry(wallT, boxH, boxD - wallT * 2),
  );
  rightWallGeo.translate((boxW - wallT) / 2, boxH / 2, 0);

  [floorGeo, frontWallGeo, backWallGeo, leftWallGeo, rightWallGeo].forEach(
    (g) => {
      const m = new THREE.Mesh(g, darkWalnutMat);
      m.castShadow = true;
      m.receiveShadow = true;
      boxGroup.add(m);
    },
  );

  // Brushed-Brass Corner Pillars & Rim Straps on Box Base
  const cornerPostGeo = trackGeo(
    new THREE.BoxGeometry(0.042, boxH + 0.01, 0.042),
  );
  cornerPostGeo.translate(0, boxH / 2, 0);
  [
    [-boxW / 2 + 0.012, -boxD / 2 + 0.012],
    [boxW / 2 - 0.012, -boxD / 2 + 0.012],
    [-boxW / 2 + 0.012, boxD / 2 - 0.012],
    [boxW / 2 - 0.012, boxD / 2 - 0.012],
  ].forEach(([cx, cz]) => {
    const post = new THREE.Mesh(cornerPostGeo, brushedBrassMat);
    post.position.set(cx, 0, cz);
    boxGroup.add(post);
  });

  const rimBandFrontGeo = trackGeo(
    new THREE.BoxGeometry(boxW + 0.016, 0.022, 0.018),
  );
  const rimFront = new THREE.Mesh(rimBandFrontGeo, brushedBrassMat);
  rimFront.position.set(0, boxH - 0.01, boxD / 2 + 0.004);
  const rimBack = new THREE.Mesh(rimBandFrontGeo, brushedBrassMat);
  rimBack.position.set(0, boxH - 0.01, -boxD / 2 - 0.004);
  boxGroup.add(rimFront, rimBack);

  // Glowing Brass Rune Inlays along the Front & Side Trim of the Walnut Box
  const runeInlayFrontGeo = trackGeo(
    new THREE.BoxGeometry(boxW - 0.08, 0.016, 0.008),
  );
  const runeInlayFront = new THREE.Mesh(runeInlayFrontGeo, glowingBrassRuneMat);
  runeInlayFront.position.set(0, boxH * 0.48, boxD / 2 + 0.004);
  const runeInlayBack = new THREE.Mesh(runeInlayFrontGeo, glowingBrassRuneMat);
  runeInlayBack.position.set(0, boxH * 0.48, -boxD / 2 - 0.004);

  const runeInlaySideGeo = trackGeo(
    new THREE.BoxGeometry(0.008, 0.016, boxD - 0.08),
  );
  const runeInlayLeft = new THREE.Mesh(runeInlaySideGeo, glowingBrassRuneMat);
  runeInlayLeft.position.set(-boxW / 2 - 0.004, boxH * 0.48, 0);
  const runeInlayRight = new THREE.Mesh(runeInlaySideGeo, glowingBrassRuneMat);
  runeInlayRight.position.set(boxW / 2 + 0.004, boxH * 0.48, 0);
  boxGroup.add(runeInlayFront, runeInlayBack, runeInlayLeft, runeInlayRight);

  // 1C. Burgundy Velvet Interior Liner & Tufted Cushion
  const velvetBedGeo = trackGeo(
    new THREE.BoxGeometry(boxW - wallT * 2, 0.065, boxD - wallT * 2),
  );
  velvetBedGeo.translate(0, 0.06, 0);
  const velvetBed = new THREE.Mesh(velvetBedGeo, burgundyVelvetMat);
  velvetBed.receiveShadow = true;
  boxGroup.add(velvetBed);

  const cushionGeo = trackGeo(new THREE.SphereGeometry(0.22, 20, 14));
  cushionGeo.scale(1.05, 0.34, 0.72);
  cushionGeo.translate(0, 0.105, 0);
  const cushionMesh = new THREE.Mesh(cushionGeo, burgundyVelvetMat);
  cushionMesh.receiveShadow = true;
  boxGroup.add(cushionMesh);

  const cordGeo = trackGeo(new THREE.TorusGeometry(0.19, 0.008, 8, 28));
  cordGeo.rotateX(Math.PI / 2);
  cordGeo.scale(1.18, 1.0, 0.76);
  cordGeo.translate(0, 0.1, 0);
  const cordMesh = new THREE.Mesh(cordGeo, brushedBrassMat);
  boxGroup.add(cordMesh);

  // 1D. Hinged Dark Walnut Lid (Pivots at back top edge: Y = boxH, Z = -boxD/2)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, boxH, -boxD / 2);
  boxGroup.add(lidPivot);

  const lidOuterGeo = trackGeo(new THREE.BoxGeometry(boxW, 0.068, boxD));
  lidOuterGeo.translate(0, 0.034, boxD / 2);
  const lidOuterMesh = new THREE.Mesh(lidOuterGeo, darkWalnutMat);
  lidOuterMesh.castShadow = true;
  lidOuterMesh.receiveShadow = true;
  lidPivot.add(lidOuterMesh);

  const lidCrownGeo = trackGeo(
    new THREE.BoxGeometry(boxW - 0.06, 0.034, boxD - 0.06),
  );
  lidCrownGeo.translate(0, 0.082, boxD / 2);
  const lidCrownMesh = new THREE.Mesh(lidCrownGeo, darkWalnutMat);
  lidCrownMesh.castShadow = true;
  lidPivot.add(lidCrownMesh);

  const lidVelvetInnerGeo = trackGeo(
    new THREE.PlaneGeometry(boxW - 0.06, boxD - 0.06),
  );
  lidVelvetInnerGeo.rotateX(Math.PI / 2);
  lidVelvetInnerGeo.translate(0, 0.002, boxD / 2);
  const lidVelvetInner = new THREE.Mesh(lidVelvetInnerGeo, burgundyVelvetMat);
  lidPivot.add(lidVelvetInner);

  const lidStrapGeo = trackGeo(
    new THREE.BoxGeometry(0.032, 0.092, boxD + 0.012),
  );
  lidStrapGeo.translate(0, 0.048, boxD / 2);
  [-0.18, 0.18].forEach((sx) => {
    const strap = new THREE.Mesh(lidStrapGeo, brushedBrassMat);
    strap.position.x = sx;
    lidPivot.add(strap);
  });

  const lidRuneRingGeo = trackGeo(new THREE.RingGeometry(0.065, 0.082, 24));
  lidRuneRingGeo.rotateX(-Math.PI / 2);
  lidRuneRingGeo.translate(0, 0.101, boxD / 2);
  const lidRuneRing = new THREE.Mesh(lidRuneRingGeo, glowingBrassRuneMat);
  lidPivot.add(lidRuneRing);

  // 1E. 3D Brass Heart Latch on the Front Face of the Box (Rotates 90 degrees to unlatch)
  const heartLatchGroup = new THREE.Group();
  heartLatchGroup.position.set(0, boxH - 0.01, boxD / 2 + 0.016);
  boxGroup.add(heartLatchGroup);

  const latchHeartShape = createHeartShape(0.085);
  const latchHeartGeo = trackGeo(
    new THREE.ExtrudeGeometry(latchHeartShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005,
    }),
  );
  latchHeartGeo.translate(0, 0, -0.009);
  const latchHeartMesh = new THREE.Mesh(latchHeartGeo, brushedBrassMat);
  latchHeartMesh.castShadow = true;
  heartLatchGroup.add(latchHeartMesh);

  const keyholeGemGeo = trackGeo(new THREE.CircleGeometry(0.012, 12));
  keyholeGemGeo.translate(0, 0.004, 0.016);
  const keyholeGem = new THREE.Mesh(keyholeGemGeo, glowingBrassRuneMat);
  heartLatchGroup.add(keyholeGem);

  // ==========================================================================
  // 2. THE 0.30m GOLDEN KEY WITH HEART-SHAPED BOW & ENGRAVING
  // ==========================================================================
  const keyGroup = new THREE.Group();
  const keyRestWorldPos = new THREE.Vector3(
    MYSTERY_BOX_POS.x,
    MYSTERY_BOX_POS.y + 1.095,
    MYSTERY_BOX_POS.z,
  );
  keyGroup.position.copy(keyRestWorldPos);
  keyGroup.rotation.set(0, facingTerraceYaw, 0);
  group.add(keyGroup);

  const keyVisual = buildGoldenKeyVisual();
  // Start with the key lying flat inside the velvet cushion
  keyVisual.rotation.x = -Math.PI / 2;
  keyGroup.add(keyVisual);

  // ==========================================================================
  // 3. PENSIEVE WISP VORTEX (60 Golden-Violet Stardust Particles + Trail)
  // ==========================================================================
  const boxRuneLight = new THREE.PointLight('#a855f7', 1.2, 5.5, 1.6);
  boxRuneLight.position.set(0, 1.32, 0.2);
  plinthRoot.add(boxRuneLight);

  // Dedicated warm-golden macro key light (sweeps across the key shaft during 4.2s - 6.8s)
  const macroKeyLight = new THREE.PointLight('#ffe094', 0.0, 4.5, 1.4);
  macroKeyLight.position.set(
    MYSTERY_BOX_POS.x,
    MYSTERY_BOX_POS.y + 1.65,
    MYSTERY_BOX_POS.z,
  );
  group.add(macroKeyLight);

  // 60 Golden-Violet Stardust Particles (Pensieve Wisp Vortex & Key Flight Trail)
  const moteCount = 60;
  const motePositions = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  const motePhases = new Float32Array(moteCount);
  const goldColor = new THREE.Color('#fde047');
  const violetColor = new THREE.Color('#d8b4fe');
  const tempColor = new THREE.Color();

  for (let i = 0; i < moteCount; i++) {
    motePhases[i] = (i / moteCount) * Math.PI * 2;
    const ang = motePhases[i];
    const r = 0.12 + (i % 6) * 0.045;
    motePositions[i * 3] = MYSTERY_BOX_POS.x + Math.cos(ang) * r;
    motePositions[i * 3 + 1] =
      MYSTERY_BOX_POS.y + 1.05 + (i / moteCount) * 0.45;
    motePositions[i * 3 + 2] = MYSTERY_BOX_POS.z + Math.sin(ang) * r;

    tempColor.lerpColors(goldColor, violetColor, (i % 5) / 4);
    moteColors[i * 3] = tempColor.r;
    moteColors[i * 3 + 1] = tempColor.g;
    moteColors[i * 3 + 2] = tempColor.b;
  }
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(motePositions, 3),
  );
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteColors, 3));
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.052,
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const motePoints = new THREE.Points(moteGeo, moteMat);
  group.add(motePoints);

  // ==========================================================================
  // 4. GRAND CASTLE GATE AT CASTLE_GATE_POS (-80.08, 27.2, +70.08)
  // ==========================================================================
  const castleGateRoot = new THREE.Group();
  castleGateRoot.position.set(
    CASTLE_GATE_POS.x,
    CASTLE_GATE_POS.y,
    CASTLE_GATE_POS.z,
  );
  castleGateRoot.rotation.y = facingTerraceYaw;
  group.add(castleGateRoot);

  const weatheredOakMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2314'),
      roughness: 0.78,
      metalness: 0.08,
    }),
  );
  const wroughtIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#27272a'),
      roughness: 0.44,
      metalness: 0.82,
    }),
  );
  const goldenThresholdGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbeb'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.12,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
    }),
  );

  // 4A. Flanking Gothic Stone Gatehouse Piers & Pointed Arch Portal
  const gatePierGeo = trackGeo(new THREE.BoxGeometry(1.45, 6.2, 1.65));
  gatePierGeo.translate(0, 3.1, 0);
  const leftGatePier = new THREE.Mesh(gatePierGeo, basaltStoneMat);
  leftGatePier.position.set(-2.45, 0, 0);
  leftGatePier.castShadow = true;
  leftGatePier.receiveShadow = true;

  const rightGatePier = new THREE.Mesh(gatePierGeo, basaltStoneMat);
  rightGatePier.position.set(2.45, 0, 0);
  rightGatePier.castShadow = true;
  rightGatePier.receiveShadow = true;

  const pierCapGeo = trackGeo(new THREE.ConeGeometry(1.15, 2.2, 4));
  pierCapGeo.rotateY(Math.PI / 4);
  pierCapGeo.translate(0, 7.3, 0);
  const leftPierCap = new THREE.Mesh(pierCapGeo, basaltStoneMat);
  leftPierCap.position.set(-2.45, 0, 0);
  const rightPierCap = new THREE.Mesh(pierCapGeo, basaltStoneMat);
  rightPierCap.position.set(2.45, 0, 0);

  const lintelGeo = trackGeo(new THREE.BoxGeometry(6.4, 1.45, 1.55));
  lintelGeo.translate(0, 5.35, 0);
  const lintelMesh = new THREE.Mesh(lintelGeo, basaltStoneMat);
  lintelMesh.castShadow = true;
  lintelMesh.receiveShadow = true;

  const archMoldingGeo = trackGeo(
    new THREE.TorusGeometry(1.78, 0.22, 10, 28, Math.PI),
  );
  archMoldingGeo.translate(0, 3.85, 0.68);
  const archMolding = new THREE.Mesh(archMoldingGeo, creamStoneMat);

  // Sculpted Archway Keystone at the apex of the stone arch (Y = 4.72m)
  const archKeystoneGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.58, 0.56));
  const archKeystoneMesh = new THREE.Mesh(archKeystoneGeo, creamStoneMat);
  archKeystoneMesh.position.set(0, 4.72, 0.52);
  archKeystoneMesh.castShadow = true;
  archKeystoneMesh.receiveShadow = true;

  const gateCrestShape = createHeartShape(0.42);
  const gateCrestGeo = trackGeo(
    new THREE.ExtrudeGeometry(gateCrestShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    }),
  );
  const gateCrestMesh = new THREE.Mesh(gateCrestGeo, brushedBrassMat);
  gateCrestMesh.position.set(0, 5.45, 0.78);

  castleGateRoot.add(
    leftGatePier,
    rightGatePier,
    leftPierCap,
    rightPierCap,
    lintelMesh,
    archMolding,
    archKeystoneMesh,
    gateCrestMesh,
  );

  // 4B. Heavy Wrought-Iron & Aged Oak Double Doors (each leaf 1.74m wide x 4.65m tall)
  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-1.74, 0, 0.12);
  castleGateRoot.add(leftDoorPivot);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(1.74, 0, 0.12);
  castleGateRoot.add(rightDoorPivot);

  const doorLeafGeo = trackGeo(new THREE.BoxGeometry(1.74, 4.65, 0.22));
  const strapBandGeo = trackGeo(new THREE.BoxGeometry(1.72, 0.14, 0.26));
  const vertBarGeo = trackGeo(new THREE.BoxGeometry(0.08, 4.55, 0.26));
  const ringKnockerGeo = trackGeo(new THREE.TorusGeometry(0.18, 0.032, 8, 20));

  const buildDoorLeaf = (isLeft: boolean, parentPivot: THREE.Group) => {
    const dir = isLeft ? 1 : -1;
    const centerOffset = dir * 0.87;

    const oakLeaf = new THREE.Mesh(doorLeafGeo, weatheredOakMat);
    oakLeaf.position.set(centerOffset, 2.325, 0);
    oakLeaf.castShadow = true;
    oakLeaf.receiveShadow = true;
    parentPivot.add(oakLeaf);

    [0.55, 1.65, 2.75, 3.85].forEach((sy) => {
      const band = new THREE.Mesh(strapBandGeo, wroughtIronMat);
      band.position.set(centerOffset, sy, 0);
      parentPivot.add(band);
    });

    [0.22, 0.87, 1.52].forEach((bx) => {
      const bar = new THREE.Mesh(vertBarGeo, wroughtIronMat);
      bar.position.set(dir * bx, 2.325, 0);
      parentPivot.add(bar);
    });

    const knocker = new THREE.Mesh(ringKnockerGeo, brushedBrassMat);
    knocker.position.set(dir * 1.28, 2.15, 0.14);
    parentPivot.add(knocker);
  };

  buildDoorLeaf(true, leftDoorPivot);
  buildDoorLeaf(false, rightDoorPivot);

  // Ornate Brass Heart Lock Escutcheon Plate on the meeting edge of the Left Door
  const lockEscutcheonGeo = trackGeo(
    new THREE.ExtrudeGeometry(createHeartShape(0.24), {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    }),
  );
  const lockEscutcheonMesh = new THREE.Mesh(lockEscutcheonGeo, brushedBrassMat);
  lockEscutcheonMesh.position.set(1.68, 2.15, 0.13);
  leftDoorPivot.add(lockEscutcheonMesh);

  // Recessed Dark Warded Keyhole Slot & Polished Brass Keyhole Bezel on the Heart Lock Escutcheon
  const darkKeyholeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#09060c'),
    }),
  );
  const keyholeBezelGeo = trackGeo(
    new THREE.TorusGeometry(0.044, 0.0065, 10, 24),
  );
  const keyholeBezelMesh = new THREE.Mesh(keyholeBezelGeo, brushedBrassMat);
  keyholeBezelMesh.position.set(1.68, 2.155, 0.204);
  leftDoorPivot.add(keyholeBezelMesh);

  const keyholeCircleGeo = trackGeo(
    new THREE.CylinderGeometry(0.018, 0.018, 0.016, 16),
  );
  keyholeCircleGeo.rotateX(Math.PI / 2);
  const keyholeCircleMesh = new THREE.Mesh(keyholeCircleGeo, darkKeyholeMat);
  keyholeCircleMesh.position.set(1.68, 2.165, 0.202);
  leftDoorPivot.add(keyholeCircleMesh);

  const keyholeSlotGeo = trackGeo(new THREE.BoxGeometry(0.015, 0.046, 0.016));
  const keyholeSlotMesh = new THREE.Mesh(keyholeSlotGeo, darkKeyholeMat);
  keyholeSlotMesh.position.set(1.68, 2.134, 0.202);
  leftDoorPivot.add(keyholeSlotMesh);

  // Golden Spark Ring right around the keyhole bezel when the HARSHA key seats into the lock
  const gateKeyInsertRingGeo = trackGeo(
    new THREE.RingGeometry(0.048, 0.072, 28),
  );
  const gateKeyInsertRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fde68a'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const gateKeyInsertRingMesh = new THREE.Mesh(
    gateKeyInsertRingGeo,
    gateKeyInsertRingMat,
  );
  gateKeyInsertRingMesh.position.set(1.68, 2.155, 0.212);
  gateKeyInsertRingMesh.visible = false;
  leftDoorPivot.add(gateKeyInsertRingMesh);

  // Dedicated warm point light illuminating the Heart Lock Escutcheon & HARSHA Key during insertion
  const gateKeyholeLight = new THREE.PointLight('#ffe09e', 0.0, 3.8, 1.5);
  gateKeyholeLight.position.set(0.15, 2.28, 0.88);
  castleGateRoot.add(gateKeyholeLight);

  // 4C. STAGE 1 PROPS: Two Heavy Horizontal Iron Lock-Bars (Deadbolts), Expanding Rune Ring & Inserting Key
  const deadboltGeo = trackGeo(new THREE.BoxGeometry(1.25, 0.16, 0.12));
  const deadboltBracketGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.24, 0.16));

  // Left heavy iron lock-bar (slides outward to the left after key insertion & 180° turn)
  const leftDeadboltMesh = new THREE.Mesh(deadboltGeo, wroughtIronMat);
  leftDeadboltMesh.position.set(1.25, 2.42, 0.18);
  leftDeadboltMesh.castShadow = true;
  leftDoorPivot.add(leftDeadboltMesh);

  const leftBracket = new THREE.Mesh(deadboltBracketGeo, brushedBrassMat);
  leftBracket.position.set(0.85, 2.42, 0.18);
  leftDoorPivot.add(leftBracket);

  // Right heavy iron lock-bar (slides outward to the right after key insertion & 180° turn)
  const rightDeadboltMesh = new THREE.Mesh(deadboltGeo, wroughtIronMat);
  rightDeadboltMesh.position.set(-1.25, 1.88, 0.18);
  rightDeadboltMesh.castShadow = true;
  rightDoorPivot.add(rightDeadboltMesh);

  const rightBracket = new THREE.Mesh(deadboltBracketGeo, brushedBrassMat);
  rightBracket.position.set(-0.85, 1.88, 0.18);
  rightDoorPivot.add(rightBracket);

  // Expanding Golden-Amber Rune Ring across the wrought-iron seams when the inserted key turns 180°
  const gateRuneRingGeo = trackGeo(new THREE.RingGeometry(0.82, 0.96, 36));
  const gateRuneRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fbbf24'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const gateRuneRingMesh = new THREE.Mesh(gateRuneRingGeo, gateRuneRingMat);
  gateRuneRingMesh.position.set(-0.06, 2.155, 0.34);
  gateRuneRingMesh.visible = false;
  castleGateRoot.add(gateRuneRingMesh);

  // Dedicated 3D Golden "HARSHA" Key parented to leftDoorPivot so it arcs from Harsha's hand,
  // physically slides into the keyhole at (1.68, 2.165, 0.315), turns 180 deg, and stays seated in the lock as the door opens!
  const gateUnlockKeyGroup = new THREE.Group();
  gateUnlockKeyGroup.position.set(1.68, 2.165, 0.62);
  gateUnlockKeyGroup.visible = false;
  leftDoorPivot.add(gateUnlockKeyGroup);

  const gateKeyVisual = buildGoldenKeyVisual();
  // Orient key so its tip (+X in keyVisual) points straight into the keyhole (-Z in leftDoorPivot),
  // and its engraved "HARSHA" shaft faces (+X / -X) toward the close-up camera!
  gateKeyVisual.rotation.y = Math.PI / 2;
  gateKeyVisual.scale.setScalar(1.35);
  gateUnlockKeyGroup.add(gateKeyVisual);

  // 4D. STAGE 2 PROPS: Shared 80-Particle Masonry Dust Pool (Keystone -> Threshold)
  const masonryDustPool = createMasonryDustParticlePool(
    trackGeo,
    trackMat,
    trackTex,
  );
  castleGateRoot.add(masonryDustPool.group);

  // 4E. STAGE 4 PROPS: Threshold Portal Veil & Warm Great Hall Light Spill (max intensity 6.5)
  const portalGlowPlaneGeo = trackGeo(new THREE.PlaneGeometry(3.48, 4.55));
  portalGlowPlaneGeo.translate(0, 2.3, -0.18);
  const portalGlowPlane = new THREE.Mesh(
    portalGlowPlaneGeo,
    goldenThresholdGlowMat,
  );
  castleGateRoot.add(portalGlowPlane);

  // Warm Golden Light-Spill Decal/Plane on the stone terrace floor stretching outward from the open doorway
  const thresholdSpillCarpetGeo = trackGeo(new THREE.PlaneGeometry(3.6, 5.8));
  thresholdSpillCarpetGeo.rotateX(-Math.PI / 2);
  // Translate so its back edge is at Z = 0.12 (the doorway line) and it stretches outward along +Z
  thresholdSpillCarpetGeo.translate(0, 0.035, 3.02);
  const thresholdSpillCarpetMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd28a'),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const thresholdSpillCarpet = new THREE.Mesh(
    thresholdSpillCarpetGeo,
    thresholdSpillCarpetMat,
  );
  thresholdSpillCarpet.scale.set(0.15, 1.0, 0.1);
  castleGateRoot.add(thresholdSpillCarpet);

  // Warm Golden Interior PointLight (0xffd28a, max intensity 6.5 — restrained so bloom never blows out)
  const gateThresholdLight = new THREE.PointLight('#ffd28a', 0.25, 22.0, 1.45);
  gateThresholdLight.position.set(0, 2.75, 0.85);
  castleGateRoot.add(gateThresholdLight);

  // ==========================================================================
  // 5. COLLIDERS (Plinth + Castle Gate Piers + Dynamic Locked Gate Barrier)
  // ==========================================================================
  const sinYaw = Math.sin(facingTerraceYaw);
  const cosYaw = Math.cos(facingTerraceYaw);
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  const gateCenterBarrierCollider: CircleCollider = {
    x: CASTLE_GATE_POS.x,
    z: CASTLE_GATE_POS.z,
    radius: 1.95,
  };

  const colliders: CircleCollider[] = [
    {
      x: MYSTERY_BOX_POS.x,
      z: MYSTERY_BOX_POS.z,
      radius: 0.65,
    },
    {
      x: CASTLE_GATE_POS.x - rightX * 2.45,
      z: CASTLE_GATE_POS.z - rightZ * 2.45,
      radius: 1.15,
    },
    {
      x: CASTLE_GATE_POS.x + rightX * 2.45,
      z: CASTLE_GATE_POS.z + rightZ * 2.45,
      radius: 1.15,
    },
    gateCenterBarrierCollider,
  ];

  // ==========================================================================
  // 6. PLAYER-CONTROLLED DIALOGUE & INDEPENDENT ANIMATION STATE MACHINE
  //    - Dialogue NEVER auto-advances; Enter advances 1 step, Esc skips cleanly.
  //    - Underlying 3D animations continue smoothly while waiting for Enter.
  // ==========================================================================
  const BOX_DIALOGUE_STEPS: Array<{
    speaker: string;
    line: string;
    headline?: string;
  }> = [
    {
      speaker: 'Yeshwanth',
      line: '“Okay, Harsha... This one is actually from me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I know I don’t always say everything I feel. But I notice what you do for me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I notice when you understand me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I notice when you care about me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I notice when you change something because you know it matters to me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I notice when you stay beside me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“And yes... I notice every time you scold me because I’m doing something stupid.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“I might not say thank you for all of it every time. But I’m grateful for you.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“Thank you for loving me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“Thank you for being with me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“Thank you for choosing me.”',
    },
    {
      speaker: 'Yeshwanth',
      line: '“Always.”',
      headline: 'I LOVE YOU, HARSHA.',
    },
    {
      speaker: 'Yeshwanth',
      line: '“The Castle Gate awaits.”',
      headline: "HAPPY VALENTINE'S DAY ❤️",
    },
  ];

  const GATE_DIALOGUE_STEPS: Array<{
    speaker: string;
    line: string;
    headline?: string;
  }> = [
    {
      speaker: 'Yeshwanth • Heart Lock Escutcheon',
      line: '“Ready?”',
      headline: 'INSERTING THE HARSHA KEY',
    },
    {
      speaker: 'Yeshwanth • Unsealing the Castle Gate',
      line: '“Come on.”',
    },
    {
      speaker: 'The Castle Gate',
      line: '“Step inside the Great Hall.”',
      headline: 'THE ENCHANTED REALM AWAITS.',
    },
  ];

  let boxState: MysteryBoxState = 'CLOSED';
  let gateState: CastleGateState = 'LOCKED';
  let hasHarshaKey = false;
  let cinematicTimer = 0; // Continuous animation clock during box cinematic
  let boxDialogueStep = 0;
  let boxStepTimer = 0; // Time elapsed within the current boxDialogueStep
  let keyArcProgress = 0; // 0..1 progress of key arcing from hover apex into Harsha's hand

  let gateSequenceTimer = 0;
  let gateDialogueActive = false;
  let gateDialogueStep = 0;
  let hasTriggeredUnsealDust = false;
  const cameraShakeOffset = new THREE.Vector3();

  // Gate Unlock Timeline Constants:
  // 0.00s - 1.05s: Golden HARSHA key arcs from Harsha's hand to poise at the Heart Keyhole
  // 1.05s - 1.95s: Key physically slides straight into the keyhole slot & seats with a golden spark ring
  //   (While gateDialogueStep === 0 ["Ready?"], animation pauses at 1.95s with key seated in the closed door!)
  // 1.95s - 2.95s: Key physically turns 180° inside the lock & heavy iron deadbolts slide open (door still 0°!)
  // 2.95s - 3.75s: Seal Break (3.5° jolt + 0.3s friction pause + camera shake + 80 falling masonry dust specks)
  // 3.75s - 6.80s: Heavy inertia swing to 78° + warm Great Hall candlelight spill
  const GATE_KEY_INSERTED_TIME = 1.95;
  const GATE_KEY_TURNED_UNSEAL_TIME = 2.95;
  const GATE_SEAL_BREAK_END_TIME = 3.75;
  const GATE_SEQUENCE_DURATION = 6.8;

  const savedStartCamPos = new THREE.Vector3();
  const savedStartLookAt = new THREE.Vector3();
  const handLaunchStartPos = new THREE.Vector3();
  const _camPosA = new THREE.Vector3();
  const _camPosB = new THREE.Vector3();
  const _lookPosA = new THREE.Vector3();
  const _lookPosB = new THREE.Vector3();
  const _arcMid = new THREE.Vector3();

  const plinthLocalToWorld = (
    lx: number,
    ly: number,
    lz: number,
    target: THREE.Vector3,
  ): THREE.Vector3 => {
    return target.set(
      MYSTERY_BOX_POS.x + lx * rightX + lz * sinYaw,
      MYSTERY_BOX_POS.y + ly,
      MYSTERY_BOX_POS.z + lx * rightZ + lz * cosYaw,
    );
  };

  const castleGateLocalToWorld = (
    lx: number,
    ly: number,
    lz: number,
    target: THREE.Vector3,
  ): THREE.Vector3 => {
    return target.set(
      CASTLE_GATE_POS.x + lx * rightX + lz * sinYaw,
      CASTLE_GATE_POS.y + ly,
      CASTLE_GATE_POS.z + lx * rightZ + lz * cosYaw,
    );
  };

  function completeBoxCinematicOnly() {
    boxState = 'OPENED';
    hasHarshaKey = true;
    keyGroup.visible = false;
    boxGroup.position.set(0, boxBaseY, 0);
    heartLatchGroup.rotation.z = -(Math.PI / 2);
    lidPivot.rotation.x = -1.88;
    glowingBrassRuneMat.emissiveIntensity = 0.35;
    macroKeyLight.intensity = 0;
    // IMPORTANT: Do NOT unlock or open the Castle Gate here!
    // The Castle Gate remains LOCKED until the player unlocks it with the HARSHA key.
  }

  function isGateCinematicCameraActive(): boolean {
    if (gateState === 'UNLOCKING') {
      // Keep cinematic camera active during Key Insertion & Key Turn, and while gate dialogue is active
      return gateDialogueActive || gateSequenceTimer < GATE_SEAL_BREAK_END_TIME;
    }
    return gateDialogueActive;
  }

  function getActiveCaption(): MysteryCinematicCaption | null {
    if (boxState === 'CINEMATIC') {
      const idx = Math.max(
        0,
        Math.min(BOX_DIALOGUE_STEPS.length - 1, boxDialogueStep),
      );
      const item = BOX_DIALOGUE_STEPS[idx];
      return {
        speaker: item.speaker,
        line: item.line,
        headline: item.headline,
        stepIndex: idx + 1,
        totalSteps: BOX_DIALOGUE_STEPS.length,
      };
    }

    if (gateDialogueActive) {
      const idx = Math.max(
        0,
        Math.min(GATE_DIALOGUE_STEPS.length - 1, gateDialogueStep),
      );
      const item = GATE_DIALOGUE_STEPS[idx];
      return {
        speaker: item.speaker,
        line: item.line,
        headline: item.headline,
        stepIndex: idx + 1,
        totalSteps: GATE_DIALOGUE_STEPS.length,
      };
    }

    return null;
  }

  return {
    group,
    colliders,
    getBoxState: () => boxState,
    getGateState: () => gateState,
    hasKey: () => hasHarshaKey,
    isCastleAwaitsVisible: () =>
      boxState === 'OPENED' && hasHarshaKey && gateState === 'LOCKED',
    isDialogueActive: () => boxState === 'CINEMATIC' || gateDialogueActive,
    isCinematicCameraActive: () =>
      boxState === 'CINEMATIC' || isGateCinematicCameraActive(),
    getActiveCaption,

    advanceDialogue(): boolean {
      if (boxState === 'CINEMATIC') {
        if (boxDialogueStep < BOX_DIALOGUE_STEPS.length - 1) {
          boxDialogueStep++;
          boxStepTimer = 0;
          if (boxDialogueStep >= 9) {
            hasHarshaKey = true;
          }
          return true;
        }
        // Final line of Mystery Box reached -> complete Box cinematic ONLY; Gate remains LOCKED until key is inserted!
        completeBoxCinematicOnly();
        return true;
      }

      if (gateDialogueActive) {
        if (gateDialogueStep === 0) {
          // Pressing Enter on Step 0 ("Ready?"): ensure key has reached the keyhole before turning 180° & unsealing
          if (gateSequenceTimer < GATE_KEY_INSERTED_TIME) {
            gateSequenceTimer = GATE_KEY_INSERTED_TIME;
          }
          gateDialogueStep = 1;
          return true;
        }
        if (gateDialogueStep === 1) {
          // Pressing Enter on Step 1 ("Come on."): ensure key has turned 180° and unsealed before final welcome
          if (gateSequenceTimer < GATE_KEY_TURNED_UNSEAL_TIME) {
            gateSequenceTimer = GATE_KEY_TURNED_UNSEAL_TIME;
          }
          gateDialogueStep = 2;
          return true;
        }
        // Pressing Enter on Step 2 ("Step inside the Great Hall."):
        if (gateSequenceTimer < GATE_SEAL_BREAK_END_TIME) {
          gateSequenceTimer = GATE_SEAL_BREAK_END_TIME;
        }
        gateDialogueActive = false;
        return true;
      }

      return false;
    },

    skipCinematicOrDialogue(): boolean {
      // Case 1: Skipping the Mystery Box cinematic -> grant the HARSHA key, but keep the Castle Gate LOCKED!
      if (boxState === 'CINEMATIC') {
        completeBoxCinematicOnly();
        return true;
      }

      // Case 2: Skipping the Castle Gate Unlock sequence -> seat the key in the lock and open the Castle Gate
      if (gateDialogueActive || gateState === 'UNLOCKING') {
        gateDialogueActive = false;
        gateState = 'OPEN';
        gateSequenceTimer = GATE_SEQUENCE_DURATION;

        // Keep the HARSHA key visibly seated inside the Brass Heart Lock Escutcheon on the open Left Door
        gateUnlockKeyGroup.visible = true;
        gateUnlockKeyGroup.position.set(1.68, 2.165, 0.315);
        gateUnlockKeyGroup.rotation.set(0, 0, Math.PI);
        gateUnlockKeyGroup.scale.setScalar(1.0);

        gateKeyInsertRingMesh.visible = false;
        gateRuneRingMesh.visible = false;
        gateKeyholeLight.intensity = 0.0;

        leftDeadboltMesh.position.x = 1.25 - 0.88;
        rightDeadboltMesh.position.x = -1.25 + 0.88;
        const maxOpenAngle = THREE.MathUtils.degToRad(78.0);
        leftDoorPivot.rotation.y = -maxOpenAngle;
        rightDoorPivot.rotation.y = maxOpenAngle;
        gateCenterBarrierCollider.radius = 0;
        masonryDustPool.resetPool();
        cameraShakeOffset.set(0, 0, 0);

        gateThresholdLight.intensity = 5.5;
        portalGlowPlane.visible = false;
        thresholdSpillCarpetMat.opacity = 0.38;
        thresholdSpillCarpet.scale.set(1.1, 1.0, 1.0);

        return true;
      }

      return false;
    },

    getCameraShakeOffset(target: THREE.Vector3): THREE.Vector3 {
      return target.copy(cameraShakeOffset);
    },

    getPromptMode(
      playerPos: THREE.Vector3,
      isWalking: boolean,
    ): MysteryPromptMode {
      if (
        !isWalking ||
        boxState === 'CINEMATIC' ||
        gateState === 'UNLOCKING' ||
        gateDialogueActive
      ) {
        return 'none';
      }

      const distToBox = Math.hypot(
        playerPos.x - MYSTERY_BOX_POS.x,
        playerPos.z - MYSTERY_BOX_POS.z,
      );
      if (boxState === 'CLOSED' && distToBox <= 3.35) {
        return 'open_box';
      }

      const distToGate = Math.hypot(
        playerPos.x - CASTLE_GATE_POS.x,
        playerPos.z - CASTLE_GATE_POS.z,
      );
      // Generous 6.5m radius once the player has the HARSHA key so the Unlock Gate prompt is immediately visible after the box opens
      const gatePromptRadius = hasHarshaKey ? 6.5 : 4.35;
      if (gateState === 'LOCKED' && distToGate <= gatePromptRadius) {
        return hasHarshaKey ? 'unlock_gate' : 'locked_gate';
      }

      return 'none';
    },

    startBoxCinematic(
      camera: THREE.PerspectiveCamera,
      _playerPos: THREE.Vector3,
      outTargetPlayerPos: THREE.Vector3,
      outTargetPlayerYaw: { value: number },
    ): boolean {
      if (boxState !== 'CLOSED') return false;

      boxState = 'CINEMATIC';
      cinematicTimer = 0;
      boxDialogueStep = 0;
      boxStepTimer = 0;
      keyArcProgress = 0;

      savedStartCamPos.copy(camera.position);
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      savedStartLookAt.copy(camera.position).addScaledVector(camDir, 4.0);

      // Position player cleanly 1.48m in front (+Z) of the plinth, facing the Mystery Box (-Z)
      plinthLocalToWorld(0, 0, 1.48, outTargetPlayerPos);
      outTargetPlayerYaw.value = terraceToCastleYaw;

      return true;
    },

    unlockCastleGate(
      camera: THREE.PerspectiveCamera,
      _playerPos: THREE.Vector3,
      outTargetPlayerPos: THREE.Vector3,
      outTargetPlayerYaw: { value: number },
    ): boolean {
      if (gateState !== 'LOCKED' || !hasHarshaKey) {
        return false;
      }

      gateState = 'UNLOCKING';
      gateSequenceTimer = 0;
      gateDialogueActive = true;
      gateDialogueStep = 0;
      hasTriggeredUnsealDust = false;
      masonryDustPool.resetPool();
      gateCenterBarrierCollider.radius = 0;

      savedStartCamPos.copy(camera.position);
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      savedStartLookAt.copy(camera.position).addScaledVector(camDir, 4.0);

      // Position Harsha 2.25m in front (+Z) of the Castle Gate, facing the Brass Heart Lock Escutcheon (-Z)
      castleGateLocalToWorld(0, 0, 2.25, outTargetPlayerPos);
      outTargetPlayerYaw.value = terraceToCastleYaw;

      // Reset doors & deadbolts to locked state so the Key Insertion Animation always starts on a closed door
      leftDoorPivot.rotation.y = 0;
      rightDoorPivot.rotation.y = 0;
      leftDeadboltMesh.position.x = 1.25;
      rightDeadboltMesh.position.x = -1.25;
      gateUnlockKeyGroup.visible = true;
      gateUnlockKeyGroup.scale.setScalar(1.0);
      gateUnlockKeyGroup.rotation.set(0, 0, 0);

      return true;
    },

    updateCinematic(
      dt: number,
      elapsedTime: number,
      camera: THREE.PerspectiveCamera,
      rightHandWorldPos: THREE.Vector3,
      gameplayCamPos: THREE.Vector3,
      gameplayLookAt: THREE.Vector3,
    ) {
      // ======================================================================
      // MODE B: CASTLE GATE KEY INSERTION, 180° TURN & DOOR OPENING CINEMATIC
      // ======================================================================
      if (boxState !== 'CINEMATIC' && isGateCinematicCameraActive()) {
        const gt = gateSequenceTimer;

        if (gt <= GATE_KEY_INSERTED_TIME) {
          // ------------------------------------------------------------------
          // PHASE 1 (0.0s – 1.95s): Close-up Key Arc from Harsha's Hand &
          // Physical Insertion into the Brass Heart Keyhole (Door is CLOSED!)
          // ------------------------------------------------------------------
          const uCamMove = smoothstep01(gt / 0.85);
          castleGateLocalToWorld(0.56, 2.21, 1.14, _camPosA);
          castleGateLocalToWorld(-0.06, 2.165, 0.44, _lookPosA);

          camera.position.lerpVectors(savedStartCamPos, _camPosA, uCamMove);
          _lookPosB.lerpVectors(savedStartLookAt, _lookPosA, uCamMove);
          camera.lookAt(_lookPosB);
        } else if (gt <= GATE_KEY_TURNED_UNSEAL_TIME) {
          // ------------------------------------------------------------------
          // PHASE 2 (1.95s – 2.95s): Inserted Key Turns 180° Inside the Lock &
          // Heavy Iron Deadbolts Slide Open (Door is STILL CLOSED!)
          // ------------------------------------------------------------------
          const uPhase = smoothstep01(
            (gt - GATE_KEY_INSERTED_TIME) /
              (GATE_KEY_TURNED_UNSEAL_TIME - GATE_KEY_INSERTED_TIME),
          );
          castleGateLocalToWorld(0.56, 2.21, 1.14, _camPosA);
          castleGateLocalToWorld(0.68, 2.2, 1.62, _camPosB);
          camera.position.lerpVectors(_camPosA, _camPosB, uPhase);

          castleGateLocalToWorld(-0.06, 2.165, 0.36, _lookPosA);
          camera.lookAt(_lookPosA);
        } else {
          // ------------------------------------------------------------------
          // PHASE 3 (2.95s – 6.80s): Seal Break (3.5° Jolt + 80 Falling Masonry
          // Dust Particles) & Heavy Door Swing to 78° with Camera Shake!
          // ------------------------------------------------------------------
          const uPullBack = smoothstep01(
            (gt - GATE_KEY_TURNED_UNSEAL_TIME) / 1.15,
          );
          castleGateLocalToWorld(0.68, 2.2, 1.62, _camPosA);
          castleGateLocalToWorld(0.0, 2.38, 4.25, _camPosB);
          camera.position.lerpVectors(_camPosA, _camPosB, uPullBack);
          camera.position.add(cameraShakeOffset);

          castleGateLocalToWorld(-0.06, 2.165, 0.36, _lookPosA);
          castleGateLocalToWorld(0.0, 2.25, 0.0, _lookPosB);
          _arcMid.lerpVectors(_lookPosA, _lookPosB, uPullBack);
          camera.lookAt(_arcMid);
        }

        return {
          finished: false,
          isReceivingKey: gt < 1.1,
          cinematicTime: gt,
        };
      }

      if (boxState !== 'CINEMATIC') {
        return {
          finished: true,
          isReceivingKey: false,
          cinematicTime: cinematicTimer,
        };
      }

      cinematicTimer += dt;
      boxStepTimer += dt;

      // Key hover apex above the levitating box (Y = +1.56m above terrace)
      const hoverApexWorld = plinthLocalToWorld(
        0,
        1.56,
        0.04,
        new THREE.Vector3(),
      );

      // ======================================================================
      // STEPS 0 .. 7: Box Opening, Key Emergence & Macro "HARSHA" Engraving Focus
      // - Animation runs smoothly from box tremble/levitation -> lid open ->
      //   key rise -> continuous macro hover & light sweep across "HARSHA"
      // - Waits indefinitely at each dialogue step until player presses ENTER!
      // ======================================================================
      if (boxDialogueStep < 8) {
        // If player presses Enter early during Step 0, fast-forward intro animation to macro hover
        const introT =
          boxDialogueStep === 0 ? Math.min(4.2, cinematicTimer) : 4.2;

        if (introT <= 1.8) {
          const uCam = smoothstep01(introT / 1.4);
          plinthLocalToWorld(0.16, 1.38, 0.9, _camPosA);
          plinthLocalToWorld(0, 1.16, 0.02, _lookPosA);

          camera.position.lerpVectors(savedStartCamPos, _camPosA, uCam);
          _lookPosB.lerpVectors(savedStartLookAt, _lookPosA, uCam);
          camera.lookAt(_lookPosB);

          const trembleEnvelope = Math.sin(smoothstep01(introT / 1.8) * Math.PI);
          const trembleOffset =
            Math.sin(introT * 48.0) * 0.004 * trembleEnvelope;

          const uLevitate = smoothstep01((introT - 0.25) / 1.3);
          const currentBoxLift = uLevitate * 0.14;
          boxGroup.position.set(
            trembleOffset,
            boxBaseY + currentBoxLift + trembleOffset * 0.5,
            Math.cos(introT * 44.0) * 0.003 * trembleEnvelope,
          );

          const uRunes = smoothstep01(introT / 1.4);
          glowingBrassRuneMat.emissiveIntensity = 0.12 + uRunes * 0.65;

          const uLatch = smoothstep01((introT - 0.85) / 0.85);
          heartLatchGroup.rotation.z = -uLatch * (Math.PI / 2);
          heartLatchGroup.position.z = boxD / 2 + 0.016 + uLatch * 0.016;

          lidPivot.rotation.x = 0;

          keyGroup.visible = true;
          keyGroup.position.set(
            MYSTERY_BOX_POS.x + trembleOffset,
            MYSTERY_BOX_POS.y + 1.095 + currentBoxLift,
            MYSTERY_BOX_POS.z,
          );
          keyGroup.rotation.set(0, facingTerraceYaw, 0);
          keyVisual.rotation.set(-Math.PI / 2, 0, 0);
          keyVisual.scale.setScalar(1.0);

          macroKeyLight.intensity = uRunes * 0.45;
        } else if (introT < 4.2) {
          const uPhase2 = (introT - 1.8) / 2.4;

          const hoverBob = Math.sin(elapsedTime * 2.8) * 0.006;
          boxGroup.position.set(0, boxBaseY + 0.14 + hoverBob, 0);
          heartLatchGroup.rotation.z = -(Math.PI / 2);

          const uLid = Math.min(1.0, (introT - 1.8) / 1.3);
          const lidFactor = lidEaseWithSettleBounce(uLid);
          lidPivot.rotation.x = -lidFactor * 1.88;

          const uRise = smoothstep01((introT - 2.1) / 2.1);
          const levitatedCushionPos = new THREE.Vector3(
            MYSTERY_BOX_POS.x,
            MYSTERY_BOX_POS.y + 1.235,
            MYSTERY_BOX_POS.z,
          );
          keyGroup.position.lerpVectors(
            levitatedCushionPos,
            hoverApexWorld,
            easeOutCubic(uRise),
          );
          keyGroup.rotation.set(0, facingTerraceYaw, 0);
          keyVisual.rotation.set(
            THREE.MathUtils.lerp(-Math.PI / 2, 0.0, uRise),
            Math.sin(uRise * Math.PI) * 0.2,
            0.03 * Math.sin(elapsedTime * 3.0),
          );

          plinthLocalToWorld(0.16, 1.38, 0.9, _camPosA);
          plinthLocalToWorld(0.03, 1.565, 0.33, _camPosB);
          camera.position.lerpVectors(
            _camPosA,
            _camPosB,
            smoothstep01(uPhase2),
          );

          plinthLocalToWorld(0, 1.16, 0.02, _lookPosA);
          _lookPosB.lerpVectors(
            _lookPosA,
            keyGroup.position,
            smoothstep01(uPhase2),
          );
          camera.lookAt(_lookPosB);

          macroKeyLight.intensity = THREE.MathUtils.lerp(0.45, 1.05, uRise);
          macroKeyLight.position
            .copy(camera.position)
            .add(new THREE.Vector3(0.24, 0.32, 0));
        } else {
          // Continuous Macro Hover & Specular Glint Sweep (waits indefinitely for Enter!)
          boxGroup.position.set(
            0,
            boxBaseY + 0.14 + Math.sin(elapsedTime * 2.8) * 0.005,
            0,
          );
          heartLatchGroup.rotation.z = -(Math.PI / 2);
          lidPivot.rotation.x = -1.88;

          keyGroup.visible = true;
          keyGroup.position.copy(hoverApexWorld);
          keyGroup.position.y += Math.sin(elapsedTime * 3.2) * 0.004;

          // Playful key wobble on Step 6 ("every time you scold me because I'm doing something stupid")
          const isScoldStep = boxDialogueStep === 6;
          const scoldEnv = isScoldStep
            ? Math.exp(-boxStepTimer * 0.85) * 0.85 + 0.25
            : 0.0;
          const playfulWobbleZ = Math.sin(elapsedTime * 28.0) * 0.13 * scoldEnv;
          const playfulWobbleX = Math.cos(elapsedTime * 22.0) * 0.08 * scoldEnv;

          // Flip key 180° on Steps 3+ to showcase engraving on both sides of the shaft
          const targetFlip = boxDialogueStep >= 3 ? Math.PI : 0.0;
          const glintAngleTilt = Math.sin(elapsedTime * 1.6) * 0.11;
          keyGroup.rotation.set(
            0,
            facingTerraceYaw + targetFlip + glintAngleTilt,
            0,
          );
          keyVisual.rotation.set(
            0.04 * Math.sin(elapsedTime * 1.8) + playfulWobbleX,
            0,
            0.02 * Math.cos(elapsedTime * 1.8) + playfulWobbleZ,
          );
          keyVisual.scale.setScalar(1.0);

          plinthLocalToWorld(
            0.028 * Math.cos(elapsedTime * 0.9),
            1.56,
            0.31,
            _camPosA,
          );
          camera.position.lerp(_camPosA, Math.min(1, dt * 8));
          camera.lookAt(keyGroup.position);

          macroKeyLight.intensity = 1.15;
          const lightSweepX = Math.sin(elapsedTime * 1.6) * 0.45;
          plinthLocalToWorld(lightSweepX, 1.82, 0.38, macroKeyLight.position);
        }

        handLaunchStartPos.copy(keyGroup.position);
      }

      // ======================================================================
      // STEPS 8 .. 12: Key Arcs Along Curved Bezier Path into Harsha's Hand & Glows
      // - Step 8 ("Thank you for loving me.") launches the key into her hand
      // - Steps 9..12 hold the glowing key focus with Harsha until final Enter!
      // ======================================================================
      else {
        keyArcProgress = Math.min(1.0, keyArcProgress + dt / 1.5);
        const uArc = smoothstep01(keyArcProgress);

        boxGroup.position.set(0, boxBaseY + 0.14 * (1.0 - uArc), 0);
        glowingBrassRuneMat.emissiveIntensity = 0.77 - uArc * 0.42;

        _arcMid
          .lerpVectors(handLaunchStartPos, rightHandWorldPos, 0.5)
          .add(new THREE.Vector3(0, 0.42, 0));

        const oneMinusU = 1.0 - uArc;
        keyGroup.position
          .set(0, 0, 0)
          .addScaledVector(handLaunchStartPos, oneMinusU * oneMinusU)
          .addScaledVector(_arcMid, 2.0 * oneMinusU * uArc)
          .addScaledVector(rightHandWorldPos, uArc * uArc);

        keyGroup.rotation.set(
          uArc * 0.45,
          facingTerraceYaw +
            Math.PI +
            uArc * Math.PI * 1.5 +
            (uArc >= 1.0 ? elapsedTime * 1.2 : 0),
          uArc * 0.35,
        );
        const handClaspScale =
          uArc > 0.85
            ? 1.0 - smoothstep01((uArc - 0.85) / 0.15) * 0.42
            : 1.0;
        keyVisual.scale.setScalar(handClaspScale);
        keyGroup.visible = true;

        if (uArc >= 0.95) {
          hasHarshaKey = true;
        }

        if (boxDialogueStep < 11) {
          plinthLocalToWorld(0.028, 1.56, 0.31, _camPosA);
          plinthLocalToWorld(1.15, 1.62, 1.25, _camPosB);
          camera.position.lerpVectors(_camPosA, _camPosB, easeInOutQuad(uArc));

          _lookPosA.lerpVectors(
            hoverApexWorld,
            rightHandWorldPos,
            smoothstep01(uArc * 0.85),
          );
          camera.lookAt(_lookPosA);
        } else {
          // Steps 11 & 12 ("I LOVE YOU, HARSHA." / "HAPPY VALENTINE'S DAY ❤️"):
          // Smoothly frame Harsha and the Castle Gate behind her while waiting for final Enter
          camera.position.lerp(gameplayCamPos, Math.min(1, dt * 4.5));
          camera.lookAt(gameplayLookAt);
        }

        macroKeyLight.intensity =
          0.95 + Math.sin(elapsedTime * 4.0) * 0.25;
        macroKeyLight.position
          .copy(rightHandWorldPos)
          .add(new THREE.Vector3(0, 0.35, 0));
      }

      const isReceivingKey = boxDialogueStep >= 8;

      return {
        finished: false,
        isReceivingKey,
        cinematicTime: cinematicTimer,
      };
    },

    update(dt: number, elapsedTime: number) {
      // Reset camera shake offset each frame unless Castle Gate unlocking is shaking
      cameraShakeOffset.set(0, 0, 0);

      // 1. Subtle violet rune pulse on the Mystery Box Plinth
      const runePulse = 0.45 + 0.2 * Math.sin(elapsedTime * 2.2);
      violetRuneMat.emissiveIntensity =
        boxState === 'CINEMATIC' ? 0.68 : runePulse;
      boxRuneLight.intensity =
        boxState === 'CINEMATIC'
          ? 1.15
          : 0.95 + 0.2 * Math.sin(elapsedTime * 2.0);

      // 2. Animate 60 Golden-Violet Stardust Particles (Pensieve Vortex & Key Trail)
      const posAttr = moteGeo.getAttribute(
        'position',
      ) as THREE.BufferAttribute;

      if (boxState === 'CINEMATIC') {
        const t = cinematicTimer;
        if (boxDialogueStep === 0 && t < 1.8) {
          moteMat.opacity = smoothstep01(t / 1.8) * 0.55;
          for (let i = 0; i < moteCount; i++) {
            const ang = motePhases[i] + elapsedTime * 1.4;
            const r = 0.22 + (i % 5) * 0.04;
            posAttr.setXYZ(
              i,
              MYSTERY_BOX_POS.x + Math.cos(ang) * r,
              MYSTERY_BOX_POS.y +
                boxGroup.position.y +
                0.06 +
                (i / moteCount) * 0.18,
              MYSTERY_BOX_POS.z + Math.sin(ang) * r,
            );
          }
        } else if (boxDialogueStep < 8) {
          const vortexProgress =
            boxDialogueStep === 0 ? smoothstep01((t - 1.8) / 1.8) : 1.0;
          moteMat.opacity = 0.88;
          for (let i = 0; i < moteCount; i++) {
            const frac = i / moteCount;
            const cycle = (frac + elapsedTime * 0.42) % 1.0;
            const spiralAngle =
              motePhases[i] + elapsedTime * 4.2 + cycle * Math.PI * 3.0;
            const funnelRadius =
              (0.06 + cycle * 0.26) * (0.4 + 0.6 * vortexProgress);
            const h =
              boxGroup.position.y +
              0.08 +
              cycle * (0.68 * vortexProgress + 0.12);
            posAttr.setXYZ(
              i,
              MYSTERY_BOX_POS.x + Math.cos(spiralAngle) * funnelRadius,
              MYSTERY_BOX_POS.y + h,
              MYSTERY_BOX_POS.z + Math.sin(spiralAngle) * funnelRadius,
            );
          }
        } else {
          // Steps 8..12: Key Collection Particle Trail swirling around Harsha's hand
          const uTrail = keyArcProgress;
          moteMat.opacity = 0.78;
          for (let i = 0; i < moteCount; i++) {
            const lag = (i / moteCount) * 0.35;
            const uMote = Math.max(0, Math.min(1, uTrail - lag));
            const oneMinus = 1.0 - uMote;
            const swirlAng = motePhases[i] + elapsedTime * 5.0;
            const swirlR = (1.0 - uMote * 0.55) * 0.14;

            const px =
              handLaunchStartPos.x * oneMinus * oneMinus +
              _arcMid.x * 2.0 * oneMinus * uMote +
              keyGroup.position.x * uMote * uMote +
              Math.cos(swirlAng) * swirlR;
            const py =
              handLaunchStartPos.y * oneMinus * oneMinus +
              _arcMid.y * 2.0 * oneMinus * uMote +
              keyGroup.position.y * uMote * uMote +
              Math.sin(swirlAng) * swirlR;
            const pz =
              handLaunchStartPos.z * oneMinus * oneMinus +
              _arcMid.z * 2.0 * oneMinus * uMote +
              keyGroup.position.z * uMote * uMote +
              Math.sin(swirlAng * 1.3) * swirlR;

            posAttr.setXYZ(i, px, py, pz);
          }
        }
      } else {
        moteMat.opacity = boxState === 'OPENED' ? 0.38 : 0.25;
        for (let i = 0; i < moteCount; i++) {
          const phase = motePhases[i] + elapsedTime * 0.85;
          const radius = 0.26 + Math.sin(phase * 1.7 + i) * 0.06;
          const heightCycle = (elapsedTime * 0.16 + i / moteCount) % 1.0;
          posAttr.setXYZ(
            i,
            MYSTERY_BOX_POS.x + Math.cos(phase) * radius,
            MYSTERY_BOX_POS.y + 1.02 + heightCycle * 0.42,
            MYSTERY_BOX_POS.z + Math.sin(phase) * radius,
          );
        }
      }
      posAttr.needsUpdate = true;

      // ======================================================================
      // 3. CASTLE GATE KEY INSERTION, 180° TURN, UNSEALING & DOOR SWING
      //    - The door NEVER opens until the key is inserted (0.0s - 1.95s)
      //      AND turned 180° to retract the heavy iron deadbolts (1.95s - 2.95s)!
      //    - While gateDialogueStep === 0 ("Ready?"), the timeline pauses at
      //      1.95s with the HARSHA key visibly seated inside the keyhole of
      //      the closed Castle Gate until the player presses Enter!
      // ======================================================================
      if (gateState === 'UNLOCKING' || gateState === 'OPEN') {
        if (gateState === 'UNLOCKING') {
          const maxAllowedTime =
            gateDialogueActive && gateDialogueStep === 0
              ? GATE_KEY_INSERTED_TIME
              : GATE_SEQUENCE_DURATION;

          gateSequenceTimer = Math.min(
            maxAllowedTime,
            gateSequenceTimer + dt,
          );

          if (gateSequenceTimer >= GATE_SEQUENCE_DURATION) {
            gateState = 'OPEN';
            gateKeyInsertRingMesh.visible = false;
            gateRuneRingMesh.visible = false;
            gateKeyholeLight.intensity = 0.0;
          }
        }

        const gt =
          gateState === 'OPEN' ? GATE_SEQUENCE_DURATION : gateSequenceTimer;
        const joltAngle = THREE.MathUtils.degToRad(3.5);
        const maxOpenAngle = THREE.MathUtils.degToRad(78.0);

        // --------------------------------------------------------------------
        // STAGE 1A (0.0s – 1.95s): Key Arcs from Harsha's Hand (0.0s - 1.05s)
        // and Physically Inserts into the Brass Heart Keyhole (1.05s - 1.95s).
        // Doors remain 100% CLOSED (0°)!
        // --------------------------------------------------------------------
        if (gt <= GATE_KEY_INSERTED_TIME) {
          gateUnlockKeyGroup.visible = true;
          gateUnlockKeyGroup.scale.setScalar(1.0);
          gateKeyholeLight.intensity = 1.35;

          if (gt <= 0.95) {
            // Quadratic Bezier arc from Harsha's outstretched right hand to keyhole alignment
            const uArc = easeOutCubic(smoothstep01(gt / 0.95));
            const oneMinus = 1.0 - uArc;
            // In leftDoorPivot local space:
            // Hand start: (1.92, 1.38, 1.75) -> Mid apex: (1.82, 2.34, 1.18) -> Keyhole poise: (1.68, 2.165, 0.62)
            const kx =
              1.92 * oneMinus * oneMinus +
              1.82 * 2.0 * oneMinus * uArc +
              1.68 * uArc * uArc;
            const ky =
              1.38 * oneMinus * oneMinus +
              2.34 * 2.0 * oneMinus * uArc +
              2.165 * uArc * uArc;
            const kz =
              1.75 * oneMinus * oneMinus +
              1.18 * 2.0 * oneMinus * uArc +
              0.62 * uArc * uArc;

            gateUnlockKeyGroup.position.set(kx, ky, kz);
            gateUnlockKeyGroup.rotation.set(
              (1.0 - uArc) * 0.38,
              (1.0 - uArc) * -0.45,
              0,
            );
            gateKeyInsertRingMesh.visible = false;
          } else {
            // 0.95s - 1.12s: Brief poise at keyhole (z = 0.62)
            // 1.12s - 1.95s: Physical linear slide straight into the keyhole slot (z = 0.62 -> 0.315)
            const uSlide = easeInOutQuad(smoothstep01((gt - 1.12) / 0.8));
            gateUnlockKeyGroup.position.set(
              1.68,
              2.165,
              THREE.MathUtils.lerp(0.62, 0.315, uSlide),
            );
            gateUnlockKeyGroup.rotation.set(0, 0, 0);

            // Crisp golden spark ring around the keyhole bezel as the key seats into the lock
            if (gt >= 1.55) {
              const uSpark = smoothstep01((gt - 1.55) / 0.4);
              gateKeyInsertRingMesh.visible = true;
              const pulse = 1.0 + 0.18 * Math.sin(elapsedTime * 5.0);
              gateKeyInsertRingMesh.scale.setScalar(
                (0.75 + uSpark * 0.85) * pulse,
              );
              gateKeyInsertRingMat.opacity =
                0.35 + 0.45 * Math.sin(uSpark * Math.PI);
            } else {
              gateKeyInsertRingMesh.visible = false;
            }
          }

          gateRuneRingMesh.visible = false;
          leftDeadboltMesh.position.x = 1.25;
          rightDeadboltMesh.position.x = -1.25;
          leftDoorPivot.rotation.y = 0;
          rightDoorPivot.rotation.y = 0;
        }

        // --------------------------------------------------------------------
        // STAGE 1B (1.95s – 2.95s): Inserted Key Physically Rotates 180° in the
        // Keyhole, Golden Rune Ring Expands, & Heavy Iron Deadbolts Slide Outward.
        // Doors STILL remain 100% CLOSED (0°) until key turn & unbolt finish!
        // --------------------------------------------------------------------
        else if (gt <= GATE_KEY_TURNED_UNSEAL_TIME) {
          const stageT = gt - GATE_KEY_INSERTED_TIME; // 0.0 .. 1.0s
          gateUnlockKeyGroup.visible = true;
          gateUnlockKeyGroup.scale.setScalar(1.0);
          gateUnlockKeyGroup.position.set(1.68, 2.165, 0.315);
          gateKeyholeLight.intensity = 1.45;

          // Key physically turns 180 degrees (Math.PI) inside the keyhole (0.0s - 0.78s of Stage 1B)
          const uTurn = easeInOutQuad(smoothstep01(stageT / 0.78));
          gateUnlockKeyGroup.rotation.set(0, 0, uTurn * Math.PI);

          // Keyhole spark ring flares and fades as the key turns
          gateKeyInsertRingMesh.visible = true;
          gateKeyInsertRingMesh.scale.setScalar(1.35 + uTurn * 0.9);
          gateKeyInsertRingMat.opacity = (1.0 - uTurn) * 0.65;

          // Expanding golden-amber rune ring across the wrought-iron seams
          const uRune = smoothstep01(stageT / 1.0);
          gateRuneRingMesh.visible = uRune > 0;
          const ringScale = 0.15 + easeOutCubic(uRune) * 1.75;
          gateRuneRingMesh.scale.setScalar(ringScale);
          gateRuneRingMat.opacity = Math.sin(uRune * Math.PI) * 0.78;

          // Two heavy horizontal iron deadbolts physically slide outward (0.20s - 1.0s of Stage 1B)
          const uBolt = easeInOutQuad(smoothstep01((stageT - 0.2) / 0.8));
          leftDeadboltMesh.position.x = 1.25 - uBolt * 0.88;
          rightDeadboltMesh.position.x = -1.25 + uBolt * 0.88;

          leftDoorPivot.rotation.y = 0;
          rightDoorPivot.rotation.y = 0;
        }

        // --------------------------------------------------------------------
        // STAGE 2 (2.95s – 3.75s): The Seal Break (3.5° Jolt + 0.3s Friction Pause),
        // Shudder, Subtle Camera Shake (0.045m), & 80 Falling Archway Dust Specks.
        // Key remains physically seated in the Left Door's Heart Lock Escutcheon!
        // --------------------------------------------------------------------
        else if (gt <= GATE_SEAL_BREAK_END_TIME) {
          const stageT = gt - GATE_KEY_TURNED_UNSEAL_TIME; // 0.0 .. 0.8s
          gateUnlockKeyGroup.visible = true;
          gateUnlockKeyGroup.scale.setScalar(1.0);
          gateUnlockKeyGroup.position.set(1.68, 2.165, 0.315);
          gateUnlockKeyGroup.rotation.set(0, 0, Math.PI);

          gateKeyInsertRingMesh.visible = false;
          gateRuneRingMesh.visible = false;
          gateKeyholeLight.intensity = THREE.MathUtils.lerp(
            1.45,
            0.35,
            stageT / 0.8,
          );

          leftDeadboltMesh.position.x = 1.25 - 0.88;
          rightDeadboltMesh.position.x = -1.25 + 0.88;

          // Doors jolt open to 3.5 deg (0.0s - 0.25s), pause for 0.3s (0.25s - 0.55s) overcoming friction, and shudder
          const uJolt = easeOutCubic(smoothstep01(stageT / 0.25));
          const shudderEnvelope = 1.0 - smoothstep01(stageT / 0.8);
          const doorShudder =
            Math.sin(gt * 58.0) * 0.0065 * shudderEnvelope;
          const angle = uJolt * joltAngle + doorShudder;

          leftDoorPivot.rotation.y = -angle;
          rightDoorPivot.rotation.y = angle;

          // Damped sinusoidal/noise Camera Shake (amplitude: 0.045m)
          const shakeAmp = 0.045 * shudderEnvelope;
          cameraShakeOffset.set(
            Math.sin(elapsedTime * 47.0) * shakeAmp,
            Math.cos(elapsedTime * 53.0) * shakeAmp,
            Math.sin(elapsedTime * 41.0) * shakeAmp * 0.7,
          );
        }

        // --------------------------------------------------------------------
        // STAGE 3 (3.75s – 6.80s): Heavy Inertia Swing to 78°, Continuous
        // Low-Rumble Camera Vibration (0.015m), & Final 0.035m Thud Impulse.
        // Key remains seated in the Left Door's lock as the door swings open!
        // --------------------------------------------------------------------
        else {
          gateUnlockKeyGroup.visible = true;
          gateUnlockKeyGroup.scale.setScalar(1.0);
          gateUnlockKeyGroup.position.set(1.68, 2.165, 0.315);
          gateUnlockKeyGroup.rotation.set(0, 0, Math.PI);

          gateKeyInsertRingMesh.visible = false;
          gateRuneRingMesh.visible = false;
          gateKeyholeLight.intensity = 0.0;

          const uSwing = Math.min(
            1.0,
            (gt - GATE_SEAL_BREAK_END_TIME) / 3.0,
          );
          const inertiaFactor = heavyDoorInertiaCurve(uSwing, elapsedTime);
          const currentAngle =
            joltAngle + (maxOpenAngle - joltAngle) * inertiaFactor;

          leftDoorPivot.rotation.y = -currentAngle;
          rightDoorPivot.rotation.y = currentAngle;

          if (gt < 6.25) {
            // Gentle continuous low-rumble camera vibration (amplitude: 0.015m) while doors grind open
            const rumbleEnv = Math.sin(uSwing * Math.PI);
            const rumbleAmp = 0.015 * (0.45 + 0.55 * rumbleEnv);
            cameraShakeOffset.set(
              Math.sin(elapsedTime * 34.0) * rumbleAmp,
              Math.cos(elapsedTime * 39.0) * rumbleAmp,
              Math.sin(elapsedTime * 29.0) * rumbleAmp * 0.6,
            );
          } else if (gt < 6.78) {
            // Final 0.035m thud impulse when the heavy doors hit their fully open stops
            const uThud = (gt - 6.25) / 0.53;
            const thudAmp =
              0.035 * Math.exp(-uThud * 5.5) * Math.cos(uThud * Math.PI * 4.0);
            cameraShakeOffset.set(
              thudAmp * 0.7,
              Math.abs(thudAmp),
              thudAmp * 0.5,
            );
          }
        }

        // --------------------------------------------------------------------
        // Trigger & Update Shared 80-Particle Masonry Dust Pool on Gate Unseal (gt >= 2.95s)
        // --------------------------------------------------------------------
        if (gt >= GATE_KEY_TURNED_UNSEAL_TIME && !hasTriggeredUnsealDust) {
          hasTriggeredUnsealDust = true;
          masonryDustPool.triggerUnsealBurst();
        }
        masonryDustPool.update(dt, elapsedTime);

        // --------------------------------------------------------------------
        // STAGE 4: Warm Great Hall Light Spill (0xffd28a, max intensity 6.5)
        // & Scaling/Fading Floor Light-Spill Plane
        // --------------------------------------------------------------------
        const currentDoorAngle = Math.abs(leftDoorPivot.rotation.y);
        const doorOpenFraction = THREE.MathUtils.clamp(
          currentDoorAngle / maxOpenAngle,
          0,
          1,
        );

        gateThresholdLight.intensity =
          0.25 +
          doorOpenFraction * (5.25 + Math.sin(elapsedTime * 2.4) * 0.2);
        goldenThresholdGlowMat.emissiveIntensity =
          0.12 + Math.sin(doorOpenFraction * Math.PI) * 0.72;
        const veilOpacity =
          (1.0 - smoothstep01((doorOpenFraction - 0.18) / 0.52)) * 0.78;
        goldenThresholdGlowMat.opacity = veilOpacity;
        portalGlowPlane.visible = veilOpacity > 0.01;

        thresholdSpillCarpetMat.opacity = doorOpenFraction * 0.38;
        thresholdSpillCarpet.scale.set(
          0.25 + doorOpenFraction * 0.85,
          1.0,
          0.08 + doorOpenFraction * 0.92,
        );
      }
    },

    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
