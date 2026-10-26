/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  ResourceTracker,
  ThemeParkMaterials,
  createBeveledBoxGeometry,
  createHeartShape2D,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { getTerrainHeight } from '../terrainMath';
import { CarnivalAudioSynthesizer } from './CarnivalAudio';
import {
  CARNIVAL_PRIZES,
  PrizeDisplayBoxInstance,
  createPrizeDisplayBox,
} from './CarnivalPrizeSystem';
import { PrizeCinematicFXSystem } from './PrizeCinematicFX';
import {
  CarnivalActiveOverlay,
  CarnivalAttractionId,
  CarnivalAttractionState,
  CarnivalCameraFocus,
  CarnivalPromptVerb,
} from './CarnivalState';

const _raycaster = new THREE.Raycaster();
const _centerUv = new THREE.Vector2(0, 0);

export interface CarnivalBoothAttraction {
  id: CarnivalAttractionId;
  title: string;
  subtitle: string;
  verb: CarnivalPromptVerb;
  group: THREE.Group;
  worldPos: THREE.Vector3;
  interactPos: THREE.Vector3;
  interactRadius: number;
  getState: () => CarnivalAttractionState;
  getPrizeId: () => string;
  activate: (
    playerPos: THREE.Vector3,
    playerYaw: number,
    camPos: THREE.Vector3,
    lookPos: THREE.Vector3,
  ) => void;
  performAction: (camera?: THREE.PerspectiveCamera) => boolean;
  advanceStep: () => boolean;
  skip: () => { earnedPrizeId: string | null };
  applyMouseDelta: (dx: number, dy: number) => void;
  applyZoomDelta?: (delta: number) => void;
  selectOption?: (index: number) => void;
  getOverlay: () => CarnivalActiveOverlay | null;
  getCameraFocus: () => CarnivalCameraFocus | null;
  update: (
    dt: number,
    elapsedTime: number,
    camera?: THREE.PerspectiveCamera,
    keys?: Set<string>,
  ) => { newlyEarnedPrizeId: string | null };
}

function createPaintedSignTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  tracker: ResourceTracker,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#faf1e4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(138, 98, 68, 0.14)';
  ctx.lineWidth = 2;
  for (let y = 26; y < canvas.height; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#c89646';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = accentHex;
  const drawMiniHeart = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.65);
    ctx.bezierCurveTo(
      cx - r * 1.2,
      cy - r * 0.2,
      cx - r * 0.6,
      cy - r * 1.1,
      cx,
      cy - r * 0.35,
    );
    ctx.bezierCurveTo(
      cx + r * 0.6,
      cy - r * 1.1,
      cx + r * 1.2,
      cy - r * 0.2,
      cx,
      cy + r * 0.65,
    );
    ctx.fill();
  };
  drawMiniHeart(44, 80, 14);
  drawMiniHeart(canvas.width - 44, 80, 14);

  ctx.fillStyle = '#4a1c28';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 66);

  ctx.fillStyle = '#8c3b4f';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText(subtitle, canvas.width / 2, 114);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared 360-degree Interactive Gift Orbit & Zoom Controller
 */
export interface GiftOrbitCameraState {
  yaw: number;
  pitch: number;
  distance: number;
  reset: () => void;
  applyMouse: (dx: number, dy: number, prizeBox?: PrizeDisplayBoxInstance) => void;
  applyZoom: (delta: number) => void;
  updateKeys: (dt: number, keys?: Set<string>) => void;
  computeFocus: (
    presWorldPos: THREE.Vector3,
    baseRotY: number,
    outCam: THREE.Vector3,
    outLook: THREE.Vector3,
  ) => void;
}

export function createGiftOrbitCameraState(defaultDist = 1.28): GiftOrbitCameraState {
  const state: GiftOrbitCameraState = {
    yaw: 0,
    pitch: 0.14,
    distance: defaultDist,
    reset() {
      this.yaw = 0;
      this.pitch = 0.14;
      this.distance = defaultDist;
    },
    applyMouse(dx: number, dy: number, prizeBox?: PrizeDisplayBoxInstance) {
      // Natural 360° orbit around stationary box: horizontal movement orbits yaw, vertical movement tilts pitch
      this.yaw -= dx * 0.0075;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0055, -0.55, 0.82);
      if (prizeBox) {
        prizeBox.setTactileTilt(
          0,
          THREE.MathUtils.clamp(this.pitch * 0.25, -0.18, 0.18),
        );
      }
    },
    applyZoom(delta: number) {
      const normalized = Math.abs(delta) > 1.0 ? delta * 0.0018 : delta * 1.4;
      const step = THREE.MathUtils.clamp(normalized, -0.16, 0.16);
      this.distance = THREE.MathUtils.clamp(this.distance + step, 0.65, 2.35);
    },
    updateKeys(dt: number, keys?: Set<string>) {
      if (!keys) return;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) {
        this.yaw -= 1.95 * dt;
      }
      if (keys.has('KeyD') || keys.has('ArrowRight')) {
        this.yaw += 1.95 * dt;
      }
      if (keys.has('KeyW') || keys.has('ArrowUp')) {
        this.distance = THREE.MathUtils.clamp(this.distance - 0.95 * dt, 0.65, 2.35);
      }
      if (keys.has('KeyS') || keys.has('ArrowDown')) {
        this.distance = THREE.MathUtils.clamp(this.distance + 0.95 * dt, 0.65, 2.35);
      }
    },
    computeFocus(
      presWorldPos: THREE.Vector3,
      baseRotY: number,
      outCam: THREE.Vector3,
      outLook: THREE.Vector3,
    ) {
      const totalYaw = baseRotY + this.yaw;
      const horizDist = Math.cos(this.pitch) * this.distance;
      const vertOffset = Math.sin(this.pitch) * this.distance;
      const focusY = presWorldPos.y + 0.16;

      outCam.set(
        presWorldPos.x + Math.sin(totalYaw) * horizDist,
        focusY + vertOffset,
        presWorldPos.z + Math.cos(totalYaw) * horizDist,
      );
      outLook.set(presWorldPos.x, focusY, presWorldPos.z);
    },
  };
  return state;
}

export function softenGiftMaterials(group: THREE.Group) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial & { clearcoat?: number };
        if (std && std.isMeshStandardMaterial) {
          std.roughness = Math.max(std.roughness ?? 0.5, 0.48);
          std.metalness = Math.min(std.metalness ?? 0.2, 0.42);
          if (typeof std.clearcoat === 'number') {
            std.clearcoat = Math.min(std.clearcoat, 0.18);
          }
          if (std.emissiveIntensity && std.emissiveIntensity > 0.35) {
            std.emissiveIntensity = 0.35;
          }
        }
      }
    }
  });
}

interface SharedBoothShell {
  root: THREE.Group;
  interiorGroup: THREE.Group;
  bulbMeshes: THREE.Mesh[];
  prizeBox: PrizeDisplayBoxInstance;
  backWall: THREE.Mesh;
  setFestoonGlow: (intensity: number) => void;
}

function buildHandcraftedBoothShell(
  title: string,
  subtitle: string,
  accentHex: string,
  prizeId: keyof typeof CARNIVAL_PRIZES,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
): SharedBoothShell {
  const root = new THREE.Group();

  const deckGeo = tracker.trackGeo(createBeveledBoxGeometry(3.6, 0.16, 2.8, 0.03));
  const deckMesh = new THREE.Mesh(deckGeo, mats.warmTimber);
  deckMesh.receiveShadow = true;
  root.add(deckMesh);

  const counterBaseGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.48, 0.92, 0.62, 0.03),
  );
  const counterBase = new THREE.Mesh(counterBaseGeo, mats.creamStone);
  counterBase.position.set(0, 0.16, 1.05);
  counterBase.castShadow = true;
  counterBase.receiveShadow = true;
  root.add(counterBase);

  const panelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.92, 0.58, 0.04));
  for (let i = -1; i <= 1; i++) {
    const panel = new THREE.Mesh(
      panelGeo,
      i === 0 ? mats.crimsonVelvet : mats.blushPastel,
    );
    panel.position.set(i * 1.06, 0.62, 1.36);
    root.add(panel);
  }

  const counterTopGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.62, 0.08, 0.76, 0.02),
  );
  const counterTop = new THREE.Mesh(counterTopGeo, mats.darkWalnut);
  counterTop.position.set(0, 1.06, 1.05);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  root.add(counterTop);

  const postGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.075, 0.085, 2.75, 10),
  );
  postGeo.translate(0, 1.375, 0);
  const postOffsets: Array<[number, number]> = [
    [-1.64, 1.24],
    [1.64, 1.24],
    [-1.64, -1.18],
    [1.64, -1.18],
  ];
  for (const [px, pz] of postOffsets) {
    const post = new THREE.Mesh(postGeo, mats.creamStone);
    post.position.set(px, 0.16, pz);
    post.castShadow = true;
    root.add(post);

    const ringGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.095, 0.095, 0.08, 10),
    );
    const brassRing = new THREE.Mesh(ringGeo, mats.brushedGold);
    brassRing.position.set(px, 1.25, pz);
    root.add(brassRing);
  }

  const backWallGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.42, 2.65, 0.14, 0.02),
  );
  const backWall = new THREE.Mesh(backWallGeo, mats.crimsonVelvet);
  backWall.position.set(0, 0.16, -1.2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  root.add(backWall);

  const sideWallGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.12, 1.15, 2.4, 0.02),
  );
  for (const sx of [-1.64, 1.64]) {
    const sideWall = new THREE.Mesh(sideWallGeo, mats.creamStone);
    sideWall.position.set(sx, 0.16, 0.02);
    sideWall.castShadow = true;
    root.add(sideWall);
  }

  const roofGroup = new THREE.Group();
  roofGroup.position.set(0, 2.86, 0.05);
  root.add(roofGroup);

  const stripeCount = 7;
  const stripeWidth = 3.78 / stripeCount;
  const stripeGeo = tracker.trackGeo(
    createBeveledBoxGeometry(stripeWidth + 0.01, 0.12, 3.05, 0.02),
  );
  const scallopGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(stripeWidth * 0.48, stripeWidth * 0.48, 0.22, 12),
  );

  for (let i = 0; i < stripeCount; i++) {
    const x = -1.89 + stripeWidth * (i + 0.5);
    const mat = i % 2 === 0 ? mats.crimsonVelvet : mats.ivoryCanvas;
    const slope = new THREE.Mesh(stripeGeo, mat);
    slope.position.set(x, 0.18, 0);
    slope.rotation.x = 0.18;
    slope.castShadow = true;
    roofGroup.add(slope);

    const valance = new THREE.Mesh(scallopGeo, mat);
    valance.position.set(x, -0.06, 1.48);
    roofGroup.add(valance);
  }

  const heartShape = createHeartShape2D(0.26);
  const crestGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
  );
  crestGeo.center();
  const crest = new THREE.Mesh(crestGeo, mats.brushedGold);
  crest.position.set(0, 0.65, 1.38);
  roofGroup.add(crest);

  const signTex = createPaintedSignTexture(title, subtitle, accentHex, tracker);
  const signMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.48,
      metalness: 0.04,
    }),
  );
  const signBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(2.55, 0.68, 0.08));
  const signBoard = new THREE.Mesh(signBoardGeo, signMat);
  signBoard.position.set(0, 0.25, 1.54);
  roofGroup.add(signBoard);

  const bulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.045, 8, 8));
  const bulbMat = tracker.trackMat(mats.warmLanternGlow.clone());
  bulbMat.emissiveIntensity = 0.32;
  const bulbMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const bx = -1.52 + (i / 8) * 3.04;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(bx, 2.66, 1.38);
    root.add(bulb);
    bulbMeshes.push(bulb);
  }

  const interiorGroup = new THREE.Group();
  root.add(interiorGroup);

  const prizeBox = createPrizeDisplayBox(prizeId, tracker, mats);
  softenGiftMaterials(prizeBox.group);
  prizeBox.group.position.set(1.18, 1.14, 1.05);
  prizeBox.group.rotation.y = -0.25;
  root.add(prizeBox.group);

  return {
    root,
    interiorGroup,
    bulbMeshes,
    prizeBox,
    backWall,
    setFestoonGlow(intensity: number) {
      bulbMat.emissiveIntensity = Math.min(intensity, 0.65);
    },
  };
}

export function computeDynamicPrizeCameraFocus(
  presentationWorldPos: THREE.Vector3,
  forwardDir: THREE.Vector3,
  combinedRadius = 0.48,
  camera?: THREE.PerspectiveCamera,
): { camWorldPos: THREE.Vector3; lookWorldPos: THREE.Vector3 } {
  const fov = camera ? camera.fov : 60;
  const aspect = camera ? camera.aspect : window.innerWidth / window.innerHeight;
  const vFovRad = THREE.MathUtils.degToRad(fov);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const minFov = Math.min(vFovRad, hFovRad);

  const safeDistance = Math.max(1.32, (combinedRadius / Math.sin(minFov / 2)) * 1.35);

  const camWorldPos = presentationWorldPos.clone().addScaledVector(forwardDir, safeDistance);
  camWorldPos.y += 0.08;
  const lookWorldPos = presentationWorldPos.clone().add(new THREE.Vector3(0, 0.08, 0));

  return { camWorldPos, lookWorldPos };
}

/**
 * ============================================================================
 * 1. HEARTSHOT BOOTH (-9.8, -51.5)
 * Calibrated Aiming + Fixed Mousepad Alignment + Generous Hit Proxies
 * ============================================================================
 */
function createHeartshotBooth(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'paired_heart_charm';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const shell = buildHandcraftedBoothShell(
    'HEARTSHOT',
    'Paired Heart Gallery',
    '#c23b57',
    prizeId,
    tracker,
    mats,
  );

  const groundY = getTerrainHeight(x, z);
  shell.root.position.set(x, groundY, z);
  shell.root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.95 });

  const railGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.022, 0.022, 2.8, 8),
  );
  railGeo.rotateZ(Math.PI / 2);
  const upperRail = new THREE.Mesh(railGeo, mats.brushedGold);
  upperRail.position.set(0, 2.02, -0.55);
  const lowerRail = new THREE.Mesh(railGeo, mats.brushedGold);
  lowerRail.position.set(0, 1.56, -0.35);
  shell.interiorGroup.add(upperRail, lowerRail);

  const heartShape = createHeartShape2D(0.25);
  const targetGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    }),
  );
  targetGeo.center();

  // Calibrated hit proxy radius (0.35m) so shots inside or brushing the heart reliably register
  const hitProxyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.35, 12, 10));
  const hitProxyMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({ visible: false }),
  );

  interface HeartTargetNode {
    pivot: THREE.Group;
    mesh: THREE.Mesh;
    hitMesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
    speed: number;
    amp: number;
    isHit: boolean;
    hitFlip: number;
    isSpecial: boolean;
  }

  const targets: HeartTargetNode[] = [];
  const regularConfigs = [
    { x: -0.95, y: 2.02, z: -0.52, phase: 0.0, speed: 1.45, amp: 0.2 },
    { x: 0.0, y: 2.02, z: -0.52, phase: 1.6, speed: 1.65, amp: 0.22 },
    { x: 0.95, y: 2.02, z: -0.52, phase: 3.1, speed: 1.5, amp: 0.2 },
    { x: -0.58, y: 1.56, z: -0.32, phase: 0.9, speed: 1.35, amp: 0.18 },
    { x: 0.58, y: 1.56, z: -0.32, phase: 2.4, speed: 1.4, amp: 0.18 },
  ];

  for (let i = 0; i < regularConfigs.length; i++) {
    const cfg = regularConfigs[i];
    const pivot = new THREE.Group();
    pivot.position.set(cfg.x, cfg.y, cfg.z);
    const mesh = new THREE.Mesh(
      targetGeo,
      i % 2 === 0 ? mats.softRoseGlow : mats.blushPastel,
    );
    const hitMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    pivot.add(mesh, hitMesh);
    shell.interiorGroup.add(pivot);
    targets.push({
      pivot,
      mesh,
      hitMesh,
      baseX: cfg.x,
      baseY: cfg.y,
      baseZ: cfg.z,
      phase: cfg.phase,
      speed: cfg.speed,
      amp: cfg.amp,
      isHit: false,
      hitFlip: 0,
      isSpecial: false,
    });
  }

  const specialPivot = new THREE.Group();
  specialPivot.position.set(0, 1.78, -0.18);
  specialPivot.scale.setScalar(0.01);
  const specialMeshL = new THREE.Mesh(targetGeo, mats.crystalHeart);
  specialMeshL.position.set(-0.08, 0, 0);
  const specialMeshR = new THREE.Mesh(targetGeo, mats.brushedGold);
  specialMeshR.position.set(0.08, 0.02, 0.02);
  const specialHitMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  specialPivot.add(specialMeshL, specialMeshR, specialHitMesh);
  shell.interiorGroup.add(specialPivot);

  const specialTarget: HeartTargetNode = {
    pivot: specialPivot,
    mesh: specialMeshL,
    hitMesh: specialHitMesh,
    baseX: 0,
    baseY: 1.78,
    baseZ: -0.18,
    phase: 0,
    speed: 1.15,
    amp: 0.16,
    isHit: false,
    hitFlip: 0,
    isSpecial: true,
  };

  const launcherPivot = new THREE.Group();
  launcherPivot.position.set(0, 1.22, 1.18);
  const barrelGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.032, 0.042, 0.42, 10),
  );
  barrelGeo.rotateX(Math.PI / 2);
  const barrelMesh = new THREE.Mesh(barrelGeo, mats.brushedGold);
  launcherPivot.add(barrelMesh);
  shell.interiorGroup.add(launcherPivot);

  const dartGroup = new THREE.Group();
  dartGroup.visible = false;
  const dartShaftGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.012, 0.018, 0.28, 8),
  );
  dartShaftGeo.rotateX(Math.PI / 2);
  const dartShaft = new THREE.Mesh(dartShaftGeo, mats.brushedGold);
  const dartFletch = new THREE.Mesh(targetGeo, mats.crimsonVelvet);
  dartFletch.scale.setScalar(0.28);
  dartFletch.position.z = 0.14;
  dartGroup.add(dartShaft, dartFletch);
  shell.interiorGroup.add(dartGroup);

  // 3D In-Booth Crosshair Ring on the target plane so aim is 100% calibrated even without pointer-lock
  const reticleGeo = tracker.trackGeo(new THREE.RingGeometry(0.055, 0.085, 24));
  const reticleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
  reticleMesh.renderOrder = 10;
  reticleMesh.visible = false;
  shell.interiorGroup.add(reticleMesh);

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let hitsCount = 0;
  let specialRevealed = false;
  // Direct local target coordinates on the target plane:
  // aimX in [-1.25, +1.25] (left to right), aimY in [1.35, 2.25] (bottom to top)
  let aimX = 0;
  let aimY = 1.78;
  let isTargetHovered = false;
  let hoveredTargetNode: HeartTargetNode | null = null;
  let prizeAwardedThisRun = false;

  const orbitCam = createGiftOrbitCameraState(1.32);

  let dartActive = false;
  let dartProgress = 0;
  const dartStart = new THREE.Vector3();
  const dartEnd = new THREE.Vector3();
  let pendingTarget: HeartTargetNode | null = null;

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.55,
    groundY,
    z + forwardDir.z * 2.55,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  function resetBoothTargets() {
    hitsCount = 0;
    specialRevealed = false;
    dartActive = false;
    dartGroup.visible = false;
    reticleMesh.visible = false;
    pendingTarget = null;
    isTargetHovered = false;
    hoveredTargetNode = null;
    aimX = 0;
    aimY = 1.78;
    orbitCam.reset();
    shell.prizeBox.setTactileTilt(0, 0);
    shell.prizeBox.group.position.set(1.18, 1.14, 1.05);
    shell.prizeBox.group.rotation.y = -0.25;
    for (const t of targets) {
      t.isHit = false;
      t.hitFlip = 0;
      t.pivot.rotation.x = 0;
    }
    specialTarget.isHit = false;
    specialTarget.hitFlip = 0;
    specialTarget.pivot.scale.setScalar(0.01);
    specialTarget.pivot.rotation.set(0, 0, 0);
    shell.setFestoonGlow(0.32);
    shell.prizeBox.setOpenProgress(0, 0);
  }

  return {
    id: 'heartshot',
    title: 'Heartshot Gallery',
    subtitle: 'Romantic Target Booth',
    verb: 'E Play',
    group: shell.root,
    worldPos,
    interactPos,
    interactRadius: 3.8,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      resetBoothTargets();
      prizeAwardedThisRun = false;
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    performAction() {
      if (state !== 'PLAYING' || dartActive) return false;

      audio.playLaunchPop(360);
      dartActive = true;
      dartProgress = 0;
      dartStart.set(aimX * 0.25, 1.28, 1.05);

      if (hoveredTargetNode) {
        pendingTarget = hoveredTargetNode;
        dartEnd.copy(hoveredTargetNode.pivot.position);
      } else {
        pendingTarget = null;
        dartEnd.set(aimX, aimY, -0.45);
      }

      dartGroup.visible = true;
      dartGroup.position.copy(dartStart);
      dartGroup.lookAt(dartEnd);
      return true;
    },

    advanceStep() {
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      resetBoothTargets();
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'PLAYING') {
        // FIXED MOUSEPAD ALIGNMENT:
        // Moving finger/mouse Right (dx > 0) moves reticle Right (+X)
        // Moving finger/mouse Up (dy < 0) moves reticle Up (+Y); Down (dy > 0) moves reticle Down (-Y)
        aimX = THREE.MathUtils.clamp(aimX + dx * 0.0032, -1.25, 1.25);
        aimY = THREE.MathUtils.clamp(aimY - dy * 0.0028, 1.32, 2.28);
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, shell.prizeBox);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'heartshot',
          title: 'Heartshot Gallery',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'WIN' || state === 'CINEMATIC') {
        return {
          attractionId: 'heartshot',
          title: 'Heartshot Gallery',
          subtitle: 'Special Target Struck',
          state,
          captionLine:
            'The golden paired hearts chime in harmony as the velvet prize box unlatches.',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'heartshot',
        title: 'Heartshot Gallery',
        subtitle: specialRevealed
          ? 'Final Shot: Golden Paired Heart!'
          : `Targets Struck: ${hitsCount} / 3`,
        state,
        instruction:
          'Mouse or WASD to Aim · Left Click or Space to Fire when Reticle Turns Green!',
        progressText: specialRevealed
          ? 'Strike the glowing center Paired Heart!'
          : `${3 - hitsCount} more to reveal the Special Target`,
        requiresEnterToContinue: false,
        showReticle: state === 'PLAYING',
        reticleHovered: isTargetHovered,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.42, 1.48)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        // Camera looks directly at the calibrated (aimX, aimY, -0.42) point inside the booth!
        const localCam = new THREE.Vector3(0, 1.76, 2.75);
        const localLook = new THREE.Vector3(aimX, aimY, -0.42);
        camWorldPos.copy(localCam).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY).add(worldPos);
        lookWorldPos.copy(localLook).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY).add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      // Calibrated WASD / Arrow Key aiming: A=Left(-X), D=Right(+X), W=Up(+Y), S=Down(-Y)
      if (state === 'PLAYING' && keys) {
        if (keys.has('KeyA') || keys.has('ArrowLeft')) {
          aimX = THREE.MathUtils.clamp(aimX - 1.45 * dt, -1.25, 1.25);
        }
        if (keys.has('KeyD') || keys.has('ArrowRight')) {
          aimX = THREE.MathUtils.clamp(aimX + 1.45 * dt, -1.25, 1.25);
        }
        if (keys.has('KeyW') || keys.has('ArrowUp')) {
          aimY = THREE.MathUtils.clamp(aimY + 1.15 * dt, 1.32, 2.28);
        }
        if (keys.has('KeyS') || keys.has('ArrowDown')) {
          aimY = THREE.MathUtils.clamp(aimY - 1.15 * dt, 1.32, 2.28);
        }
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.updateKeys(dt, keys);
      }

      // Oscillate regular targets
      for (const t of targets) {
        t.pivot.position.x =
          t.baseX + Math.sin(elapsedTime * t.speed + t.phase) * t.amp;
        if (t.isHit) {
          t.hitFlip = Math.min(1, t.hitFlip + dt * 6.5);
          t.pivot.rotation.x = -t.hitFlip * (Math.PI * 0.48);
        }
      }

      if (specialRevealed) {
        const scaleU = THREE.MathUtils.lerp(
          specialTarget.pivot.scale.x,
          1.15,
          1 - Math.exp(-8 * dt),
        );
        specialTarget.pivot.scale.setScalar(scaleU);
        if (!specialTarget.isHit) {
          specialTarget.pivot.position.x =
            Math.sin(elapsedTime * specialTarget.speed) * specialTarget.amp;
          specialTarget.pivot.position.y =
            specialTarget.baseY + Math.sin(elapsedTime * 2.6) * 0.05;
        } else {
          specialTarget.pivot.rotation.y += dt * 5.2;
        }
      }

      // Exact 2D/3D target proximity calibration on the booth target plane
      if (state === 'PLAYING') {
        reticleMesh.visible = true;
        reticleMesh.position.set(aimX, aimY, -0.35);

        let bestNode: HeartTargetNode | null = null;
        let bestDist = 0.34; // Generous 34cm magnetic lock radius

        if (specialRevealed && !specialTarget.isHit) {
          const d = Math.hypot(
            aimX - specialTarget.pivot.position.x,
            aimY - specialTarget.pivot.position.y,
          );
          if (d <= bestDist) {
            bestDist = d;
            bestNode = specialTarget;
          }
        }
        for (const t of targets) {
          if (!t.isHit) {
            const d = Math.hypot(aimX - t.pivot.position.x, aimY - t.pivot.position.y);
            if (d <= bestDist) {
              bestDist = d;
              bestNode = t;
            }
          }
        }

        hoveredTargetNode = bestNode;
        isTargetHovered = bestNode !== null;
        reticleMat.color.setHex(isTargetHovered ? 0x4ade80 : 0xffd166);
        reticleMesh.scale.setScalar(isTargetHovered ? 1.25 : 1.0);
      } else {
        reticleMesh.visible = false;
        hoveredTargetNode = null;
        isTargetHovered = false;
      }

      launcherPivot.rotation.y = -aimX * 0.45;
      launcherPivot.rotation.x = (aimY - 1.78) * 0.5;

      if (dartActive) {
        dartProgress += dt * 7.2;
        const u = Math.min(1, dartProgress);
        dartGroup.position.lerpVectors(dartStart, dartEnd, u);
        dartGroup.position.y += Math.sin(u * Math.PI) * 0.08;

        if (u >= 1) {
          dartActive = false;
          dartGroup.visible = false;

          if (pendingTarget) {
            pendingTarget.isHit = true;
            if (pendingTarget.isSpecial) {
              audio.playPrizeRevealArpeggio();
              state = 'WIN';
              stateTimer = 0;
            } else {
              hitsCount += 1;
              audio.playTargetHitChime(hitsCount);
              if (hitsCount >= 3 && !specialRevealed) {
                specialRevealed = true;
              }
            }
            pendingTarget = null;
          } else {
            audio.playLaunchPop(190);
          }
        }
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.45) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        state = 'CINEMATIC';
        stateTimer = 0;
        shell.setFestoonGlow(0.6);
      } else if (state === 'CINEMATIC') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        shell.prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        if (stateTimer >= totalDuration) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'PRIZE_REVEAL') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        shell.prizeBox.updateCinematicAnimation(stateTimer + 3.5, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.55;
        shell.prizeBox.group.position.lerp(new THREE.Vector3(1.18, 1.14, 1.05), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = -0.25;
        shell.prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting((1 - recoverU) * 0.45, worldPos);
        if (stateTimer >= 0.55) {
          resetBoothTargets();
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 2. RING TOSS BOOTH (9.8, -51.5)
 * Calibrated 1:1 Preview-to-Spindle Trajectory + 360° Gift Orbit
 * ============================================================================
 */
function createRingTossBooth(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'twin_ring_charms';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const shell = buildHandcraftedBoothShell(
    'RING TOSS',
    'Companion Ring Stand',
    '#b8335a',
    prizeId,
    tracker,
    mats,
  );

  const groundY = getTerrainHeight(x, z);
  shell.root.position.set(x, groundY, z);
  shell.root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.95 });

  const boardGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.75, 0.12, 1.45, 0.025),
  );
  const boardMesh = new THREE.Mesh(boardGeo, mats.darkWalnut);
  boardMesh.position.set(0, 1.36, -0.15);
  boardMesh.rotation.x = 0.28;
  shell.interiorGroup.add(boardMesh);

  const pegGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.036, 0.045, 0.34, 10),
  );
  pegGeo.translate(0, 0.17, 0);
  const sidePegPositions: Array<[number, number, number]> = [
    [-0.78, 1.45, -0.05],
    [0.78, 1.45, -0.05],
    [-0.52, 1.56, -0.45],
    [0.52, 1.56, -0.45],
  ];
  for (const [px, py, pz] of sidePegPositions) {
    const peg = new THREE.Mesh(pegGeo, mats.creamStone);
    peg.position.set(px, py, pz);
    shell.interiorGroup.add(peg);
  }

  const pairedPedestalPivot = new THREE.Group();
  pairedPedestalPivot.position.set(0, 1.52, -0.25);
  shell.interiorGroup.add(pairedPedestalPivot);

  const pedBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.24, 0.28, 0.18, 16),
  );
  const pedBase = new THREE.Mesh(pedBaseGeo, mats.brushedGold);
  pairedPedestalPivot.add(pedBase);

  const centerSpindleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.048, 0.058, 0.44, 12),
  );
  centerSpindleGeo.translate(0, 0.22, 0);
  const centerSpindle = new THREE.Mesh(centerSpindleGeo, mats.softRoseGold);
  pairedPedestalPivot.add(centerSpindle);

  const heartShape = createHeartShape2D(0.16);
  const finialGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    }),
  );
  finialGeo.center();
  const finial = new THREE.Mesh(finialGeo, mats.crystalHeart);
  finial.position.set(0, 0.48, 0);
  pairedPedestalPivot.add(finial);

  const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.024, 10, 28));
  ringGeo.rotateX(Math.PI / 2);

  const specialRingMatA = tracker.trackMat(mats.warmLanternGlow.clone());
  const specialRingMatB = tracker.trackMat(mats.softRoseGlow.clone());
  specialRingMatA.emissiveIntensity = 0.22;
  specialRingMatB.emissiveIntensity = 0.22;

  const ringMeshes = [
    new THREE.Mesh(ringGeo, mats.brushedGold),
    new THREE.Mesh(ringGeo, specialRingMatA),
    new THREE.Mesh(ringGeo, specialRingMatB),
  ];
  for (const rm of ringMeshes) {
    rm.visible = false;
    shell.interiorGroup.add(rm);
  }

  // Calibrated 3D Aiming Guide Ring on the Pegboard:
  // At power = 0.72 (center of 0.56..0.88 sweet spot) and aimX = 0, it sits dead-center on (0, 1.62, -0.25)!
  const aimMarkerGeo = tracker.trackGeo(new THREE.RingGeometry(0.15, 0.19, 28));
  aimMarkerGeo.rotateX(-Math.PI / 2);
  const aimMarkerMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  const aimMarker = new THREE.Mesh(aimMarkerGeo, aimMarkerMat);
  aimMarker.renderOrder = 10;
  aimMarker.visible = false;
  shell.interiorGroup.add(aimMarker);

  const SWEET_MIN = 0.56;
  const SWEET_MAX = 0.88;
  const AIM_TOLERANCE = 0.32;

  // Exact mapping where power = 0.72 maps to z = -0.25, y = 1.62
  function computeRingLandingPoint(power: number, xOffset: number, out: THREE.Vector3) {
    const zPos = 0.38 - (power / 0.72) * 0.63; // at power=0.72 -> z = -0.25
    const yPos = 1.44 + (power / 0.72) * 0.18; // at power=0.72 -> y = 1.62
    out.set(xOffset, yPos, zPos);
  }

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let successfulLandings = 0;
  let ringInFlight = false;
  let flightU = 0;
  let flightWasSuccess = false;
  let activeRingIdx = 0;
  let aimX = 0;
  let powerMeter = 0.2;
  let isHoldingSpace = false;
  let chargeTimer = 0;
  let statusFeedback = '';
  let prizeAwardedThisRun = false;

  const orbitCam = createGiftOrbitCameraState(1.32);
  const ringStart = new THREE.Vector3(0, 1.25, 1.05);
  const ringTarget = new THREE.Vector3();

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.55,
    groundY,
    z + forwardDir.z * 2.55,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  function resetRings() {
    successfulLandings = 0;
    ringInFlight = false;
    flightU = 0;
    aimX = 0;
    powerMeter = 0.2;
    isHoldingSpace = false;
    chargeTimer = 0;
    statusFeedback = '';
    orbitCam.reset();
    shell.prizeBox.setTactileTilt(0, 0);
    shell.prizeBox.group.position.set(1.18, 1.14, 1.05);
    shell.prizeBox.group.rotation.y = -0.25;
    pairedPedestalPivot.rotation.set(0, 0, 0);
    specialRingMatA.emissiveIntensity = 0.22;
    specialRingMatB.emissiveIntensity = 0.22;
    ringMeshes[0].visible = true;
    ringMeshes[0].position.set(-0.32, 1.13, 1.05);
    ringMeshes[1].visible = true;
    ringMeshes[1].position.set(0.0, 1.13, 1.05);
    ringMeshes[2].visible = true;
    ringMeshes[2].position.set(0.32, 1.13, 1.05);
    aimMarker.visible = false;
    shell.setFestoonGlow(0.32);
    shell.prizeBox.setOpenProgress(0, 0);
  }

  function launchCurrentRing(launchPower: number) {
    if (ringInFlight || successfulLandings >= 2) return;
    activeRingIdx = successfulLandings + 1;
    ringInFlight = true;
    flightU = 0;
    ringStart.set(aimX * 0.55, 1.22, 1.05);
    audio.playLaunchPop(280 + Math.round(launchPower * 120));

    const powerGood = launchPower >= SWEET_MIN && launchPower <= SWEET_MAX;
    const aimGood = Math.abs(aimX) <= AIM_TOLERANCE;

    if (powerGood && aimGood) {
      flightWasSuccess = true;
      ringTarget.set(0, 1.62 + successfulLandings * 0.04, -0.25);
      statusFeedback =
        successfulLandings === 0
          ? 'Ring 1 landed! Now land the second Companion Ring on the Heart Pedestal!'
          : 'Both Companion Rings linked!';
    } else {
      flightWasSuccess = false;
      computeRingLandingPoint(launchPower, aimX, ringTarget);
      if (!aimGood) {
        statusFeedback = 'Missed left/right! Center the ring over the Heart Pedestal until it turns green.';
      } else if (launchPower < SWEET_MIN) {
        statusFeedback = 'Too short! Release when the ring reaches the Heart Pedestal (green zone).';
      } else {
        statusFeedback = 'Too far! Overshot the pedestal—release inside the green sweet spot.';
      }
    }
  }

  resetRings();

  return {
    id: 'ring_toss',
    title: 'Companion Ring Toss',
    subtitle: 'Paired Pedestal Game',
    verb: 'E Play',
    group: shell.root,
    worldPos,
    interactPos,
    interactRadius: 3.8,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      resetRings();
      prizeAwardedThisRun = false;
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    performAction() {
      if (state !== 'PLAYING' || ringInFlight) return false;
      if (!isHoldingSpace) {
        launchCurrentRing(powerMeter);
        return true;
      }
      return false;
    },

    advanceStep() {
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      resetRings();
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'PLAYING' && !ringInFlight) {
        aimX = THREE.MathUtils.clamp(aimX + dx * 0.0028, -0.95, 0.95);
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, shell.prizeBox);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'ring_toss',
          title: 'Companion Ring Toss',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: 'Some things are better as a pair.',
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'WIN' || state === 'CINEMATIC') {
        return {
          attractionId: 'ring_toss',
          title: 'Companion Ring Toss',
          subtitle: 'Paired Rings United',
          state,
          captionLine: 'Some things are better as a pair.',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'ring_toss',
        title: 'Companion Ring Toss',
        subtitle:
          statusFeedback ||
          `Companion Rings Landed: ${successfulLandings} / 2`,
        state,
        instruction:
          'A / D or Mouse to Center Ring · Hold & Release SPACE (or Click) when Ring Turns GREEN!',
        progressText: `Rings Linked on Pedestal: ${successfulLandings} / 2`,
        powerMeter,
        sweetSpotStart: SWEET_MIN,
        sweetSpotEnd: SWEET_MAX,
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.42, 1.48)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        const localCam = new THREE.Vector3(0, 1.92, 2.55);
        const localLook = new THREE.Vector3(aimX * 0.25, 1.54, -0.25);
        camWorldPos
          .copy(localCam)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        lookWorldPos
          .copy(localLook)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      if (state === 'PLAYING') {
        aimMarker.visible = !ringInFlight;

        if (keys && !ringInFlight) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            aimX = THREE.MathUtils.clamp(aimX - 1.35 * dt, -0.95, 0.95);
          }
          if (keys.has('KeyD') || keys.has('ArrowRight')) {
            aimX = THREE.MathUtils.clamp(aimX + 1.35 * dt, -0.95, 0.95);
          }

          const spaceDown = keys.has('Space');
          if (spaceDown) {
            isHoldingSpace = true;
            chargeTimer += dt * 2.35;
            powerMeter = 0.5 + 0.48 * Math.sin(chargeTimer - Math.PI / 2);
          } else if (isHoldingSpace) {
            isHoldingSpace = false;
            launchCurrentRing(powerMeter);
            chargeTimer = 0;
          } else {
            powerMeter = 0.5 + 0.48 * Math.sin(elapsedTime * 2.2);
          }
        } else if (!ringInFlight) {
          powerMeter = 0.5 + 0.48 * Math.sin(elapsedTime * 2.2);
        }

        // Exact 1:1 preview position matching the throw math
        computeRingLandingPoint(powerMeter, aimX, aimMarker.position);
        const aligned =
          Math.abs(aimX) <= AIM_TOLERANCE &&
          powerMeter >= SWEET_MIN &&
          powerMeter <= SWEET_MAX;
        aimMarkerMat.color.setHex(aligned ? 0x4ade80 : 0xffd166);
        aimMarker.scale.setScalar(aligned ? 1.18 : 1.0);

        const previewRing = ringMeshes[Math.min(2, successfulLandings + 1)];
        if (!ringInFlight && previewRing) {
          previewRing.position.set(aimX * 0.55, 1.18 + powerMeter * 0.08, 1.05);
        }
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        aimMarker.visible = false;
        orbitCam.updateKeys(dt, keys);
      }

      if (ringInFlight) {
        flightU += dt * 2.4;
        const u = Math.min(1, flightU);
        const rm = ringMeshes[activeRingIdx];
        rm.position.lerpVectors(ringStart, ringTarget, u);
        rm.position.y += Math.sin(u * Math.PI) * 0.58;
        rm.rotation.x = Math.sin(u * Math.PI) * 0.65;

        if (u >= 1) {
          ringInFlight = false;
          rm.rotation.set(0, 0, 0);

          if (flightWasSuccess) {
            successfulLandings += 1;
            audio.playTargetHitChime(successfulLandings + 1);
            if (successfulLandings >= 2) {
              audio.playPrizeRevealArpeggio();
              state = 'WIN';
              stateTimer = 0;
            }
          } else {
            audio.playLaunchPop(150);
            rm.position.set(aimX * 0.55, 1.13, 1.05);
          }
        }
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.45) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        specialRingMatA.emissiveIntensity = 0.55;
        specialRingMatB.emissiveIntensity = 0.55;
        pairedPedestalPivot.rotation.y += dt * 3.2;
        state = 'CINEMATIC';
        stateTimer = 0;
        shell.setFestoonGlow(0.6);
      } else if (state === 'CINEMATIC') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        pairedPedestalPivot.rotation.y += dt * 2.8;
        shell.prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        if (stateTimer >= totalDuration) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'PRIZE_REVEAL') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        pairedPedestalPivot.rotation.y += dt * 1.5;
        shell.prizeBox.updateCinematicAnimation(stateTimer + 3.5, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.55;
        shell.prizeBox.group.position.lerp(new THREE.Vector3(1.18, 1.14, 1.05), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = -0.25;
        shell.prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting((1 - recoverU) * 0.45, worldPos);
        if (stateTimer >= 0.55) {
          resetRings();
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 3. PRIZE KNOCKDOWN BOOTH (-12.8, -61.5)
 * Calibrated Pin Plane Reticle + True Impact Radius + 360° Gift Orbit
 * ============================================================================
 */
function createPrizeKnockdownBooth(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'little_rose_token';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const shell = buildHandcraftedBoothShell(
    'ROSE KNOCKDOWN',
    'Painted Pin Pyramid',
    '#b23a48',
    prizeId,
    tracker,
    mats,
  );

  const groundY = getTerrainHeight(x, z);
  shell.root.position.set(x, groundY, z);
  shell.root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.95 });

  const shelfGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.85, 0.42, 0.56, 0.025),
  );
  const shelfMesh = new THREE.Mesh(shelfGeo, mats.warmTimber);
  shelfMesh.position.set(0, 1.12, -0.38);
  shell.interiorGroup.add(shelfMesh);

  const pinBodyGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.068, 0.088, 0.24, 12),
  );
  pinBodyGeo.translate(0, 0.12, 0);
  const pinNeckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.042, 0.062, 0.12, 12),
  );
  pinNeckGeo.translate(0, 0.3, 0);

  interface KnockdownPin {
    pivot: THREE.Group;
    homeX: number;
    homeY: number;
    homeZ: number;
    fallAxisX: number;
    fallAxisZ: number;
    knocked: boolean;
    fallProgress: number;
  }

  const pins: KnockdownPin[] = [];
  const pyramidLayout = [
    { x: -0.24, y: 1.54, z: -0.38, fx: -1.1, fz: 0.7 },
    { x: 0.0, y: 1.54, z: -0.38, fx: -1.3, fz: 0.2 },
    { x: 0.24, y: 1.54, z: -0.38, fx: -1.1, fz: -0.7 },
    { x: -0.12, y: 1.9, z: -0.38, fx: -1.4, fz: 0.5 },
    { x: 0.12, y: 1.9, z: -0.38, fx: -1.4, fz: -0.5 },
    { x: 0.0, y: 2.26, z: -0.38, fx: -1.6, fz: 0.3 },
  ];

  for (let i = 0; i < pyramidLayout.length; i++) {
    const p = pyramidLayout[i];
    const pivot = new THREE.Group();
    pivot.position.set(p.x, p.y, p.z);
    const body = new THREE.Mesh(
      pinBodyGeo,
      i % 2 === 0 ? mats.ivoryCanvas : mats.blushPastel,
    );
    const neck = new THREE.Mesh(pinNeckGeo, mats.crimsonVelvet);
    pivot.add(body, neck);
    shell.interiorGroup.add(pivot);
    pins.push({
      pivot,
      homeX: p.x,
      homeY: p.y,
      homeZ: p.z,
      fallAxisX: p.fx,
      fallAxisZ: p.fz,
      knocked: false,
      fallProgress: 0,
    });
  }

  const ballGeo = tracker.trackGeo(new THREE.SphereGeometry(0.085, 14, 14));
  const ballMesh = new THREE.Mesh(ballGeo, mats.crimsonVelvet);
  ballMesh.position.set(0, 1.18, 1.05);
  shell.interiorGroup.add(ballMesh);

  // Calibrated 3D Aim Reticle Ring right on the pin plane (z = -0.34) with depthTest:false so zero parallax error!
  const aimRingGeo = tracker.trackGeo(new THREE.RingGeometry(0.09, 0.13, 24));
  const aimRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  const aimRing = new THREE.Mesh(aimRingGeo, aimRingMat);
  aimRing.renderOrder = 10;
  aimRing.position.set(0, 1.82, -0.34);
  aimRing.visible = false;
  shell.interiorGroup.add(aimRing);

  const SWEET_MIN = 0.56;
  const SWEET_MAX = 0.88;

  // Exact mapping where power = 0.72 hits y = 1.82 (heart of the pyramid)
  function computeBallHitY(power: number): number {
    return 1.32 + (power / 0.72) * 0.5;
  }

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let ballInFlight = false;
  let ballU = 0;
  let aimX = 0;
  let powerMeter = 0.2;
  let isHoldingSpace = false;
  let chargeTimer = 0;
  let launchedPower = 0.5;
  let statusFeedback = '';
  let prizeAwardedThisRun = false;

  const orbitCam = createGiftOrbitCameraState(1.32);
  const ballStart = new THREE.Vector3(0, 1.32, 1.12);
  const ballTarget = new THREE.Vector3(0, 1.82, -0.36);

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.55,
    groundY,
    z + forwardDir.z * 2.55,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  function resetPins() {
    ballInFlight = false;
    ballU = 0;
    aimX = 0;
    powerMeter = 0.2;
    isHoldingSpace = false;
    chargeTimer = 0;
    statusFeedback = '';
    orbitCam.reset();
    shell.prizeBox.setTactileTilt(0, 0);
    shell.prizeBox.group.position.set(1.18, 1.14, 1.05);
    shell.prizeBox.group.rotation.y = -0.25;
    ballMesh.position.set(0, 1.18, 1.05);
    aimRing.visible = false;
    for (const p of pins) {
      p.knocked = false;
      p.fallProgress = 0;
      p.pivot.position.set(p.homeX, p.homeY, p.homeZ);
      p.pivot.rotation.set(0, 0, 0);
    }
    shell.setFestoonGlow(0.32);
    shell.prizeBox.setOpenProgress(0, 0);
  }

  function throwBall(power: number) {
    if (ballInFlight) return;
    launchedPower = power;
    ballInFlight = true;
    ballU = 0;
    ballStart.set(aimX * 0.45, 1.28, 1.08);
    const hitHeight = computeBallHitY(power);
    ballTarget.set(aimX, hitHeight, -0.36);
    audio.playLaunchPop(240 + Math.round(power * 130));
  }

  return {
    id: 'prize_knockdown',
    title: 'Rose Knockdown',
    subtitle: 'Classic Midway Toss',
    verb: 'E Play',
    group: shell.root,
    worldPos,
    interactPos,
    interactRadius: 3.8,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      resetPins();
      prizeAwardedThisRun = false;
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    performAction() {
      if (state !== 'PLAYING' || ballInFlight) return false;
      if (!isHoldingSpace) {
        throwBall(powerMeter);
        return true;
      }
      return false;
    },

    advanceStep() {
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      resetPins();
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'PLAYING' && !ballInFlight) {
        aimX = THREE.MathUtils.clamp(aimX + dx * 0.0025, -0.75, 0.75);
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, shell.prizeBox);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'prize_knockdown',
          title: 'Rose Knockdown',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'WIN' || state === 'CINEMATIC') {
        return {
          attractionId: 'prize_knockdown',
          title: 'Rose Knockdown',
          subtitle: 'All Targets Toppled',
          state,
          captionLine:
            'Every painted bottle tumbles with a warm wooden clatter as the booth lights brighten.',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'prize_knockdown',
        title: 'Rose Knockdown',
        subtitle:
          statusFeedback ||
          `Pins Standing: ${pins.filter((p) => !p.knocked).length} / 6`,
        state,
        instruction:
          'A / D or Mouse to Aim · Hold & Release SPACE (or Click) when Reticle Turns GREEN!',
        progressText: `Pins Remaining: ${pins.filter((p) => !p.knocked).length} / 6`,
        powerMeter,
        sweetSpotStart: SWEET_MIN,
        sweetSpotEnd: SWEET_MAX,
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.42, 1.48)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        const localCam = new THREE.Vector3(0, 1.82, 2.55);
        const localLook = new THREE.Vector3(aimX * 0.3, 1.78, -0.38);
        camWorldPos
          .copy(localCam)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        lookWorldPos
          .copy(localLook)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      if (state === 'PLAYING') {
        aimRing.visible = !ballInFlight;

        if (keys && !ballInFlight) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            aimX = THREE.MathUtils.clamp(aimX - 1.25 * dt, -0.75, 0.75);
          }
          if (keys.has('KeyD') || keys.has('ArrowRight')) {
            aimX = THREE.MathUtils.clamp(aimX + 1.25 * dt, -0.75, 0.75);
          }

          const spaceDown = keys.has('Space');
          if (spaceDown) {
            isHoldingSpace = true;
            chargeTimer += dt * 2.35;
            powerMeter = 0.5 + 0.48 * Math.sin(chargeTimer - Math.PI / 2);
          } else if (isHoldingSpace) {
            isHoldingSpace = false;
            throwBall(powerMeter);
            chargeTimer = 0;
          } else {
            powerMeter = 0.5 + 0.48 * Math.sin(elapsedTime * 2.25);
          }
        } else if (!ballInFlight) {
          powerMeter = 0.5 + 0.48 * Math.sin(elapsedTime * 2.25);
        }

        const previewY = computeBallHitY(powerMeter);
        aimRing.position.set(aimX, previewY, -0.34);

        // Check if current aim & power will strike standing pins
        const inSweetPower = powerMeter >= SWEET_MIN && powerMeter <= SWEET_MAX;
        const nearStandingPin = pins.some(
          (p) => !p.knocked && Math.hypot(p.homeX - aimX, (p.homeY + 0.16 - previewY) * 0.65) <= 0.38,
        );
        aimRingMat.color.setHex(inSweetPower && nearStandingPin ? 0x4ade80 : 0xffd166);
        aimRing.scale.setScalar(inSweetPower && nearStandingPin ? 1.2 : 1.0);

        if (!ballInFlight) {
          ballMesh.position.set(aimX * 0.45, 1.18 + powerMeter * 0.08, 1.05);
        }
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        aimRing.visible = false;
        orbitCam.updateKeys(dt, keys);
      }

      if (ballInFlight) {
        ballU += dt * 3.2;
        const u = Math.min(1, ballU);
        ballMesh.position.lerpVectors(ballStart, ballTarget, u);
        ballMesh.position.y += Math.sin(u * Math.PI) * 0.24;

        if (u >= 1) {
          ballInFlight = false;
          ballMesh.position.set(aimX * 0.45, 1.18, 1.05);

          let newlyKnocked = 0;
          if (launchedPower >= 0.42) {
            const isSweetHit = launchedPower >= SWEET_MIN && launchedPower <= SWEET_MAX;
            const impactRadius = isSweetHit ? 0.48 : 0.28;
            for (const p of pins) {
              if (!p.knocked) {
                const dx = p.homeX - ballTarget.x;
                const dy = (p.homeY + 0.16) - ballTarget.y;
                const dist = Math.hypot(dx, dy * 0.6);
                if (dist <= impactRadius) {
                  p.knocked = true;
                  newlyKnocked++;
                }
              }
            }
            // Cascade gravity: if a bottom pin falls, upper pins resting on it topple
            if (pins[0].knocked || pins[1].knocked) pins[3].knocked = true;
            if (pins[1].knocked || pins[2].knocked) pins[4].knocked = true;
            if (pins[3].knocked || pins[4].knocked) pins[5].knocked = true;
          }

          const remaining = pins.filter((p) => !p.knocked).length;
          if (remaining === 0) {
            audio.playPrizeRevealArpeggio();
            state = 'WIN';
            stateTimer = 0;
          } else if (newlyKnocked > 0) {
            audio.playTargetHitChime(6 - remaining);
            statusFeedback = `Toppled ${6 - remaining}/6 pins! Aim at the remaining ${remaining} pins!`;
          } else {
            audio.playLaunchPop(150);
            statusFeedback =
              launchedPower < 0.42
                ? 'Throw was too low! Release when the reticle rises onto the pins (green).'
                : 'Missed the standing pins! Line up the reticle with A/D.';
          }
        }
      }

      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        if (p.knocked) {
          p.fallProgress = Math.min(1, p.fallProgress + dt * 3.8);
          const u = p.fallProgress;
          p.pivot.rotation.x = p.fallAxisX * u;
          p.pivot.rotation.z = p.fallAxisZ * u;
          p.pivot.position.y = p.homeY - u * 0.28;
          p.pivot.position.z = p.homeZ - u * 0.22;
        }
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.45) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        state = 'CINEMATIC';
        stateTimer = 0;
        shell.setFestoonGlow(0.6);
      } else if (state === 'CINEMATIC') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        shell.prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        if (stateTimer >= totalDuration) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'PRIZE_REVEAL') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        shell.prizeBox.updateCinematicAnimation(stateTimer + totalDuration, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.55;
        shell.prizeBox.group.position.lerp(new THREE.Vector3(1.18, 1.14, 1.05), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = -0.25;
        shell.prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting((1 - recoverU) * 0.45, worldPos);
        if (stateTimer >= 0.55) {
          resetPins();
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 4. FROG LAUNCH BOOTH (12.8, -61.5)
 * Calibrated Live 3D Water Landing Ring + Fair Sweet-Spot (0.64..0.84)
 * ============================================================================
 */
function createFrogLaunchBooth(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'golden_star_token';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const shell = buildHandcraftedBoothShell(
    'FROG LAUNCH',
    'Lily-Pad Leap Basin',
    '#2e7775',
    prizeId,
    tracker,
    mats,
  );

  const groundY = getTerrainHeight(x, z);
  shell.root.position.set(x, groundY, z);
  shell.root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.95 });

  const basinGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.92, 0.86, 0.22, 24),
  );
  const basinRim = new THREE.Mesh(basinGeo, mats.creamStone);
  basinRim.position.set(0, 1.18, -0.25);
  shell.interiorGroup.add(basinRim);

  const waterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.84, 0.84, 0.04, 24));
  const waterMesh = new THREE.Mesh(waterGeo, mats.fountainWater);
  waterMesh.position.set(0, 1.28, -0.25);
  shell.interiorGroup.add(waterMesh);

  const padGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 18));
  const targetPad = new THREE.Mesh(padGeo, mats.mintPastel);
  targetPad.position.set(0, 1.31, -0.25);
  const targetRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.18, 0.23, 24),
  );
  targetRingGeo.rotateX(-Math.PI / 2);
  const targetRing = new THREE.Mesh(targetRingGeo, mats.brushedGold);
  targetRing.position.set(0, 1.33, -0.25);
  shell.interiorGroup.add(targetPad, targetRing);

  // Live 3D Jump Landing Preview Ring on the water surface so timing is 100% calibrated visually!
  const jumpMarkerGeo = tracker.trackGeo(new THREE.RingGeometry(0.12, 0.16, 24));
  jumpMarkerGeo.rotateX(-Math.PI / 2);
  const jumpMarkerMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  const jumpMarker = new THREE.Mesh(jumpMarkerGeo, jumpMarkerMat);
  jumpMarker.renderOrder = 10;
  jumpMarker.visible = false;
  shell.interiorGroup.add(jumpMarker);

  for (const sx of [-0.48, 0.48]) {
    const sidePad = new THREE.Mesh(padGeo, mats.patinaTealRoof);
    sidePad.scale.setScalar(0.75);
    sidePad.position.set(sx, 1.305, -0.15);
    shell.interiorGroup.add(sidePad);
  }

  const catapultPivot = new THREE.Group();
  catapultPivot.position.set(0, 1.14, 0.95);
  const leverGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.44));
  const leverMesh = new THREE.Mesh(leverGeo, mats.brushedGold);
  catapultPivot.add(leverMesh);
  shell.interiorGroup.add(catapultPivot);

  const frogGroup = new THREE.Group();
  const frogBodyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.095, 14, 12));
  frogBodyGeo.scale(1.08, 0.82, 1.25);
  const frogBody = new THREE.Mesh(frogBodyGeo, mats.mintPastel);
  frogBody.castShadow = true;
  frogGroup.add(frogBody);

  // Vocal throat sac sphere under the chin (-Z is frog's forward direction)
  const throatSacGeo = tracker.trackGeo(new THREE.SphereGeometry(0.052, 10, 10));
  const throatSac = new THREE.Mesh(throatSacGeo, mats.blushPastel);
  throatSac.position.set(0, -0.012, -0.082);
  frogGroup.add(throatSac);

  // Cute sculpted hind legs & front legs
  const hindLegGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.028, 0.065, 6, 8));
  const hindFootGeo = tracker.trackGeo(new THREE.BoxGeometry(0.048, 0.015, 0.075));
  const hindLegL = new THREE.Group();
  hindLegL.position.set(-0.085, -0.02, 0.045);
  const hindThighL = new THREE.Mesh(hindLegGeo, mats.mintPastel);
  hindThighL.rotation.x = 0.45;
  const hindFootL = new THREE.Mesh(hindFootGeo, mats.mintPastel);
  hindFootL.position.set(0, -0.038, -0.025);
  hindLegL.add(hindThighL, hindFootL);

  const hindLegR = new THREE.Group();
  hindLegR.position.set(0.085, -0.02, 0.045);
  const hindThighR = new THREE.Mesh(hindLegGeo, mats.mintPastel);
  hindThighR.rotation.x = 0.45;
  const hindFootR = new THREE.Mesh(hindFootGeo, mats.mintPastel);
  hindFootR.position.set(0, -0.038, -0.025);
  hindLegR.add(hindThighR, hindFootR);

  const frontLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.022, 0.065, 8));
  const frontLegL = new THREE.Mesh(frontLegGeo, mats.mintPastel);
  frontLegL.position.set(-0.055, -0.042, -0.055);
  frontLegL.rotation.x = -0.2;
  const frontLegR = new THREE.Mesh(frontLegGeo, mats.mintPastel);
  frontLegR.position.set(0.055, -0.042, -0.055);
  frontLegR.rotation.x = -0.2;
  frogGroup.add(hindLegL, hindLegR, frontLegL, frontLegR);

  // Expressive eyes with pupils inside an eyeGroup for blinking & wiggling
  const eyeGroup = new THREE.Group();
  const frogEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.032, 10, 10));
  const frogPupilGeo = tracker.trackGeo(new THREE.SphereGeometry(0.016, 8, 8));
  const frogPupilMat = tracker.trackMat(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  for (const sx of [-0.048, 0.048]) {
    const eyeWhite = new THREE.Mesh(frogEyeGeo, mats.ivoryCanvas);
    eyeWhite.position.set(sx, 0.068, -0.062);
    const pupil = new THREE.Mesh(frogPupilGeo, frogPupilMat);
    pupil.position.set(sx * 1.04, 0.072, -0.088);
    eyeGroup.add(eyeWhite, pupil);
  }
  frogGroup.add(eyeGroup);

  // Tiny golden crown & crimson bow on the frog's head
  const crownGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.034, 0.025, 0.042, 5));
  const crownMesh = new THREE.Mesh(crownGeo, mats.brushedGold);
  crownMesh.position.set(0, 0.098, -0.022);
  const bowGeo = tracker.trackGeo(new THREE.SphereGeometry(0.016, 8, 8));
  bowGeo.scale(1.6, 0.9, 0.8);
  const crownBow = new THREE.Mesh(bowGeo, mats.crimsonVelvet);
  crownBow.position.set(0, 0.118, -0.036);
  frogGroup.add(crownMesh, crownBow);

  frogGroup.position.set(0, 1.21, 0.95);
  shell.interiorGroup.add(frogGroup);

  const SWEET_MIN = 0.64;
  const SWEET_MAX = 0.84;

  // Exact mapping where power = 0.74 (center of sweet spot) lands at z = -0.25 (center of lily pad)
  function computeFrogLandingZ(power: number): number {
    return 0.55 - (power / 0.74) * 0.8;
  }

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let powerMeter = 0.5;
  let frogInFlight = false;
  let frogU = 0;
  let frogLandedOnPad = false;
  let landingTimer = 0;
  let statusFeedback = '';
  let prizeAwardedThisRun = false;

  const orbitCam = createGiftOrbitCameraState(1.32);
  const frogStart = new THREE.Vector3(0, 1.21, 0.95);
  const frogEnd = new THREE.Vector3(0, 1.36, -0.25);

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.55,
    groundY,
    z + forwardDir.z * 2.55,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  function resetFrog() {
    frogInFlight = false;
    frogU = 0;
    frogLandedOnPad = false;
    landingTimer = 0;
    statusFeedback = '';
    orbitCam.reset();
    shell.prizeBox.setTactileTilt(0, 0);
    shell.prizeBox.group.position.set(1.18, 1.14, 1.05);
    shell.prizeBox.group.rotation.y = -0.25;
    frogGroup.position.copy(frogStart);
    frogGroup.rotation.set(0, 0, 0);
    frogGroup.scale.set(1, 1, 1);
    throatSac.scale.setScalar(1);
    hindLegL.rotation.x = 0;
    hindLegR.rotation.x = 0;
    catapultPivot.rotation.x = 0;
    targetPad.position.y = 1.31;
    jumpMarker.visible = false;
    shell.setFestoonGlow(0.32);
    shell.prizeBox.setOpenProgress(0, 0);
  }

  let launchedPower = 0.5;
  let isSweetSpot = false;
  let isShort = false;

  return {
    id: 'frog_launch',
    title: 'Lily-Pad Frog Launch',
    subtitle: 'Spring Catapult Basin',
    verb: 'E Play',
    group: shell.root,
    worldPos,
    interactPos,
    interactRadius: 3.8,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      resetFrog();
      prizeAwardedThisRun = false;
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    performAction() {
      if (state !== 'PLAYING' || frogInFlight) return false;
      launchedPower = powerMeter;
      isSweetSpot = launchedPower >= SWEET_MIN && launchedPower <= SWEET_MAX;
      isShort = launchedPower < SWEET_MIN;

      if (isSweetSpot) {
        frogEnd.set(0, 1.36, -0.25);
        statusFeedback = 'Bullseye! Right on the golden lily pad!';
      } else {
        const landZ = computeFrogLandingZ(launchedPower);
        frogEnd.set(0, isShort ? 1.26 : 1.48, landZ);
        statusFeedback = isShort
          ? 'Too early! Wait for the ring to enter the golden lily pad (green)!'
          : 'Too late! Overshot the lily pad—press when the ring turns green!';
      }

      frogInFlight = true;
      frogLandedOnPad = false;
      frogU = 0;
      catapultPivot.rotation.x = 0.38;
      audio.playFrogBoing();
      return true;
    },

    advanceStep() {
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      resetFrog();
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, shell.prizeBox);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'frog_launch',
          title: 'Lily-Pad Frog Launch',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'WIN' || state === 'CINEMATIC') {
        return {
          attractionId: 'frog_launch',
          title: 'Lily-Pad Frog Launch',
          subtitle: 'Bullseye Lily-Pad Landing!',
          state,
          captionLine:
            'The little crowned frog turns to face you on the golden lily pad with a cheerful ribbit!',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'frog_launch',
        title: 'Lily-Pad Frog Launch',
        subtitle: statusFeedback || 'Time Your Spring Leap onto the Lily Pad',
        state,
        instruction:
          'Press SPACE or Click when the Water Ring aligns with the Lily Pad (GREEN)!',
        powerMeter,
        sweetSpotStart: SWEET_MIN,
        sweetSpotEnd: SWEET_MAX,
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.42, 1.48)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        const localCam = new THREE.Vector3(0, 1.88, 2.38);
        const localLook = new THREE.Vector3(0, 1.32, -0.05);
        camWorldPos
          .copy(localCam)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        lookWorldPos
          .copy(localLook)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        jumpMarker.visible = false;
        orbitCam.updateKeys(dt, keys);
      }

      // 1. IDLE / WAITING ON CATAPULT ANIMATION (Breathing, Vocal Throat Sac, Blinking, Excited Hop every 2.2s)
      if (!frogInFlight && !frogLandedOnPad) {
        frogGroup.rotation.y = THREE.MathUtils.lerp(frogGroup.rotation.y, 0, 1 - Math.exp(-10 * dt));
        frogGroup.rotation.z = Math.sin(elapsedTime * 2.6) * 0.03;

        // Vocal throat sac inflating/deflating
        const sacPulse = 1.0 + 0.42 * Math.max(0, Math.sin(elapsedTime * 5.6));
        throatSac.scale.set(sacPulse, sacPulse * 0.95, sacPulse * 1.1);

        // Tiny excited hop every 2.2 seconds
        const hopPhase = elapsedTime % 2.2;
        const hopLift = hopPhase < 0.28 ? Math.sin((hopPhase / 0.28) * Math.PI) * 0.045 : 0;
        const breathBob = Math.sin(elapsedTime * 3.8) * 0.006;
        frogGroup.position.set(frogStart.x, frogStart.y + hopLift + breathBob, frogStart.z);

        // Subtle breathing squash/stretch
        const breathScale = 1.0 + Math.sin(elapsedTime * 3.8) * 0.035;
        frogGroup.scale.set(breathScale, 1.0 / breathScale, breathScale);
        hindLegL.rotation.x = hopLift > 0.01 ? 0.45 : 0;
        hindLegR.rotation.x = hopLift > 0.01 ? 0.45 : 0;

        // Periodic cute eye blink & wiggle
        const blinkCycle = elapsedTime % 2.8;
        const blinkScaleY = blinkCycle < 0.12 ? 0.15 : 1.0;
        eyeGroup.scale.set(1, blinkScaleY, 1);
      }

      if (state === 'PLAYING' && !frogInFlight) {
        // Calibrated medium oscillation speed (2.15 rad/s) so human reaction time feels great
        powerMeter = 0.5 + 0.48 * Math.sin(elapsedTime * 2.15);
        jumpMarker.visible = true;
        jumpMarker.position.set(0, 1.34, computeFrogLandingZ(powerMeter));
        const inZone = powerMeter >= SWEET_MIN && powerMeter <= SWEET_MAX;
        jumpMarkerMat.color.setHex(inZone ? 0x4ade80 : 0xffd166);
        jumpMarker.scale.setScalar(inZone ? 1.25 : 1.0);
      } else {
        jumpMarker.visible = false;
      }

      catapultPivot.rotation.x = THREE.MathUtils.lerp(
        catapultPivot.rotation.x,
        0,
        1 - Math.exp(-8 * dt),
      );

      // 2. MID-AIR JUMP ARC & STRETCH ANIMATION
      if (frogInFlight) {
        frogU += dt * 1.95;
        const u = Math.min(1, frogU);
        frogGroup.position.lerpVectors(frogStart, frogEnd, u);
        frogGroup.position.y += Math.sin(u * Math.PI) * 0.78;

        // Stretch frog along its jump trajectory and kick hind legs back
        const airStretch = Math.sin(u * Math.PI);
        frogGroup.scale.set(1 - airStretch * 0.14, 1 - airStretch * 0.1, 1 + airStretch * 0.32);
        frogGroup.rotation.x = Math.cos(u * Math.PI) * 0.55;
        hindLegL.rotation.x = airStretch * 0.95;
        hindLegR.rotation.x = airStretch * 0.95;

        if (u >= 1) {
          frogInFlight = false;
          frogGroup.rotation.x = 0;
          frogGroup.scale.set(1, 1, 1);
          hindLegL.rotation.x = 0;
          hindLegR.rotation.x = 0;

          if (isSweetSpot) {
            frogLandedOnPad = true;
            landingTimer = 0;
            targetPad.position.y = 1.28;
            audio.playTargetHitChime(3);
            audio.playPrizeRevealArpeggio();
            state = 'WIN';
            stateTimer = 0;
          } else {
            audio.playLaunchPop(isShort ? 160 : 135);
            frogGroup.position.copy(frogStart);
            frogGroup.rotation.set(0, 0, 0);
          }
        }
      }

      // 3. CELEBRATION ON LILY PAD: Squash-and-stretch bounce + 180° turn to face player + happy hops & head tilts!
      if (frogLandedOnPad) {
        landingTimer += dt;
        // Smoothly rotate 180° (to Math.PI) so the frog faces the player/camera directly!
        frogGroup.rotation.y = THREE.MathUtils.lerp(
          frogGroup.rotation.y,
          Math.PI,
          1 - Math.exp(-10 * dt),
        );

        // Initial landing squash-and-stretch + continuous happy celebration hops
        const squash = Math.sin(landingTimer * 16) * Math.exp(-landingTimer * 4.5) * 0.28;
        const celebHop = Math.max(0, Math.sin(landingTimer * 6.2)) * 0.055;
        targetPad.position.y =
          1.31 + Math.sin(landingTimer * 14) * 0.02 * Math.exp(-landingTimer * 2.2);
        frogGroup.position.set(0, targetPad.position.y + 0.05 + celebHop, -0.25);
        frogGroup.scale.set(1 + squash, 1 - squash * 1.2, 1 + squash);

        // Puff vocal throat sac and tilt head left & right toward Harsha
        const celebSac = 1.0 + 0.45 * Math.max(0, Math.sin(elapsedTime * 7.2));
        throatSac.scale.setScalar(celebSac);
        frogGroup.rotation.z = Math.sin(elapsedTime * 6.5) * 0.14;
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.45) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        state = 'CINEMATIC';
        stateTimer = 0;
        shell.setFestoonGlow(0.6);
      } else if (state === 'CINEMATIC') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        shell.prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        if (stateTimer >= totalDuration) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'PRIZE_REVEAL') {
        shell.prizeBox.group.position.lerp(new THREE.Vector3(0, 1.42, 1.48), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = 0;
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        shell.prizeBox.updateCinematicAnimation(stateTimer + totalDuration, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.55;
        shell.prizeBox.group.position.lerp(new THREE.Vector3(1.18, 1.14, 1.05), 1 - Math.exp(-8 * dt));
        shell.prizeBox.group.rotation.y = -0.25;
        shell.prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting((1 - recoverU) * 0.45, worldPos);
        if (stateTimer >= 0.55) {
          resetFrog();
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 5. MYSTERY EGG MACHINE (5.4, -56.8)
 * ============================================================================
 */
function createMysteryEggMachine(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'tiny_aurora_crystal';
  const prizeDef = CARNIVAL_PRIZES[prizeId];

  const root = new THREE.Group();
  const groundY = getTerrainHeight(x, z);
  root.position.set(x, groundY, z);
  root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.05 });

  const plinthGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.36, 0.24, 1.36, 0.03),
  );
  const plinth = new THREE.Mesh(plinthGeo, mats.warmTimber);
  root.add(plinth);

  const cabinetGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.12, 1.15, 1.12, 0.04),
  );
  const cabinet = new THREE.Mesh(cabinetGeo, mats.creamStone);
  cabinet.position.y = 0.24;
  cabinet.castShadow = true;
  root.add(cabinet);

  const trimBandGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.18, 0.1, 1.18, 0.02),
  );
  const trimBand = new THREE.Mesh(trimBandGeo, mats.brushedGold);
  trimBand.position.y = 1.34;
  root.add(trimBand);

  const gearWheelGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
  );
  gearWheelGeo.rotateX(Math.PI / 2);
  const gearA = new THREE.Mesh(gearWheelGeo, mats.brushedGold);
  gearA.position.set(-0.14, 0.92, 0.57);
  const gearB = new THREE.Mesh(gearWheelGeo, mats.softRoseGold);
  gearB.scale.setScalar(0.72);
  gearB.position.set(0.18, 0.78, 0.58);
  root.add(gearA, gearB);

  const globeMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fffdf9'),
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );
  const globeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.54, 20, 16));
  const globeMesh = new THREE.Mesh(globeGeo, globeMat);
  globeMesh.position.y = 1.88;
  globeMesh.renderOrder = 2;
  root.add(globeMesh);

  const capGeo = tracker.trackGeo(new THREE.ConeGeometry(0.36, 0.28, 16));
  const capMesh = new THREE.Mesh(capGeo, mats.brushedGold);
  capMesh.position.y = 2.48;
  root.add(capMesh);

  const eggGeo = tracker.trackGeo(new THREE.SphereGeometry(0.095, 10, 10));
  eggGeo.scale(1, 1.28, 1);
  const eggMaterials = [
    mats.blushPastel,
    mats.mintPastel,
    mats.lavenderPastel,
    mats.brushedGold,
    mats.softRoseGold,
  ];
  const innerEggsGroup = new THREE.Group();
  innerEggsGroup.position.y = 1.72;
  root.add(innerEggsGroup);

  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const rad = i < 9 ? 0.28 : 0.12;
    const ey = i < 9 ? 0.0 : 0.16;
    const egg = new THREE.Mesh(eggGeo, eggMaterials[i % eggMaterials.length]);
    egg.position.set(Math.cos(angle) * rad, ey, Math.sin(angle) * rad);
    egg.rotation.set(i * 0.4, i * 0.7, i * 0.3);
    innerEggsGroup.add(egg);
  }

  const prizeBox = createPrizeDisplayBox(prizeId, tracker, mats);
  softenGiftMaterials(prizeBox.group);
  prizeBox.group.position.set(0, 0.44, 0.72);
  root.add(prizeBox.group);

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let crankTurned = false;
  let crankTimer = 0;
  let prizeAwardedThisRun = false;

  const orbitCam = createGiftOrbitCameraState(1.28);

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.15,
    groundY,
    z + forwardDir.z * 2.15,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  return {
    id: 'mystery_egg',
    title: 'Mystery Egg Automaton',
    subtitle: 'Clockwork Capsule Dispenser',
    verb: 'E Play',
    group: root,
    worldPos,
    interactPos,
    interactRadius: 3.2,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      crankTurned = false;
      crankTimer = 0;
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.group.position.set(0, 0.44, 0.72);
      prizeBox.group.rotation.y = 0;
      prizeAwardedThisRun = false;
      prizeBox.setOpenProgress(0, 0);
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    performAction() {
      if (state !== 'PLAYING' || crankTurned) return false;
      crankTurned = true;
      crankTimer = 0;
      audio.playMechanicalTurn();
      return true;
    },

    advanceStep() {
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      crankTurned = false;
      prizeBox.setOpenProgress(0, 0);
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, prizeBox);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'mystery_egg',
          title: 'Mystery Egg Automaton',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'WIN' || state === 'CINEMATIC') {
        return {
          attractionId: 'mystery_egg',
          title: 'Mystery Egg Automaton',
          subtitle: 'Capsule Delivered',
          state,
          captionLine:
            'Brass gears chime softly as a golden capsule drops into the velvet tray and opens.',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'mystery_egg',
        title: 'Mystery Egg Automaton',
        subtitle: 'Clockwork Capsule Dispenser',
        state,
        instruction:
          'Press Space, Click, or Enter to turn the brass crank and dispense a capsule',
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.25, 1.12)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        const localCam = new THREE.Vector3(0, 1.64, 2.05);
        const localLook = new THREE.Vector3(0, 1.48, 0.35);
        camWorldPos
          .copy(localCam)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        lookWorldPos
          .copy(localLook)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.updateKeys(dt, keys);
      }

      if (crankTurned && state === 'PLAYING') {
        crankTimer += dt;
        gearA.rotation.z -= dt * 5.2;
        gearB.rotation.z += dt * 7.4;
        innerEggsGroup.rotation.y += dt * 4.5;
        if (crankTimer >= 0.85) {
          audio.playPrizeRevealArpeggio();
          state = 'WIN';
          stateTimer = 0;
        }
      } else {
        innerEggsGroup.rotation.y = Math.sin(elapsedTime * 0.6) * 0.15;
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.4) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        state = 'CINEMATIC';
        stateTimer = 0;
      } else if (state === 'CINEMATIC') {
        prizeBox.group.position.lerp(new THREE.Vector3(0, 1.25, 1.12), 1 - Math.exp(-8 * dt));
        prizeBox.group.rotation.y = 0;
        prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        if (stateTimer >= totalDuration) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'PRIZE_REVEAL') {
        prizeBox.group.position.lerp(new THREE.Vector3(0, 1.25, 1.12), 1 - Math.exp(-8 * dt));
        prizeBox.group.rotation.y = 0;
        const totalDuration = 3.5 + (prizeDef.holdExtraSeconds || 0);
        prizeBox.updateCinematicAnimation(stateTimer + totalDuration, elapsedTime, fx, audio);
        fx.setTheatricalLighting(0.45, worldPos);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.5;
        prizeBox.group.position.lerp(new THREE.Vector3(0, 0.44, 0.72), 1 - Math.exp(-8 * dt));
        prizeBox.group.rotation.y = 0;
        prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting((1 - recoverU) * 0.45, worldPos);
        if (stateTimer >= 0.5) {
          crankTurned = false;
          prizeBox.setOpenProgress(0, 0);
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 6. EMOTIONAL PHOTOBOOTH ATTRACTION (14.6, -66.8 — Right of Frog Launch)
 * Three Emotion Choices -> Custom Photo Card Reveal + Full 360° Inspection
 * ============================================================================
 */
interface PhotoEmotionChoice {
  label: string;
  subtitle: string;
  caption: string;
  accentColor: string;
  cardBgTop: string;
  cardBgBottom: string;
  cardTextHex: string;
  imageUrl: string;
}

const PHOTO_EMOTION_CHOICES: PhotoEmotionChoice[] = [
  {
    label: 'Sweet & Romantic',
    subtitle: 'When I Look at You',
    caption: 'My favorite place in the whole world is right beside you. ♡',
    accentColor: '#d94668',
    cardBgTop: '#fce7f3',
    cardBgBottom: '#fbcfe8',
    cardTextHex: '#701a3c',
    imageUrl: '/assets/harsha/photo-romantic.jpg',
  },
  {
    label: 'Silly & Playful',
    subtitle: 'The Way We Laugh',
    caption: 'For all the goofy faces, laughing fits, and moments only we understand. ✦',
    accentColor: '#e09f3e',
    cardBgTop: '#fef9c3',
    cardBgBottom: '#fde68a',
    cardTextHex: '#6b3e08',
    imageUrl: '/assets/harsha/photo-playful.jpg',
  },
  {
    label: 'Deep & Treasured',
    subtitle: 'Our Unforgettable Days',
    caption: 'Every chapter of our story is something I will keep forever. ♡',
    accentColor: '#38bdf8',
    cardBgTop: '#1e293b',
    cardBgBottom: '#0f172a',
    cardTextHex: '#f8fafc',
    imageUrl: '/assets/harsha/photo-treasured.jpg',
  },
];

/**
 * Builds the bespoke high-DPI texture for each of the 3 Physical 3D Emotion Cards
 * resting in brass slots on the velvet shelf inside the Vintage Photo Booth:
 * - Card 0: Blush rose cardstock, embossed gold heart filigree, crimson accent
 * - Card 1: Warm cream cardstock, golden star sparkles, amber doodle trim
 * - Card 2: Midnight navy cardstock, vintage filigree scrollwork, cyan-gold accent
 */
function createEmotionTokenCardTexture(
  choiceIdx: number,
  tracker: ResourceTracker,
): THREE.CanvasTexture {
  const choice = PHOTO_EMOTION_CHOICES[choiceIdx];
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 440;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, choice.cardBgTop);
  grad.addColorStop(1, choice.cardBgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Embossed gold filigree border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Accent inner trim
  ctx.strokeStyle = choice.accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Corner filigree flourishes
  ctx.fillStyle = '#d4af37';
  for (const cx of [38, canvas.width - 38]) {
    for (const cy of [38, canvas.height - 38]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Center emblem per emotion card
  ctx.save();
  ctx.translate(canvas.width / 2, 155);
  if (choiceIdx === 0) {
    // Embossed gold & crimson heart filigree
    ctx.fillStyle = choice.accentColor;
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.bezierCurveTo(-68, -14, -46, -68, 0, -24);
    ctx.bezierCurveTo(46, -68, 68, -14, 0, 42);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (choiceIdx === 1) {
    // Golden star sparkles & playful amber bursts
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 78px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', 0, 0);
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillStyle = '#b45309';
    ctx.fillText('★', -55, -35);
    ctx.fillText('★', 55, 28);
  } else {
    // Vintage filigree scrollwork & starlight crescent/diamond
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = choice.accentColor;
    ctx.font = 'bold 56px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❖', 0, 2);
  }
  ctx.restore();

  // Title & Subtitle on physical 3D cardstock token
  ctx.fillStyle = choice.cardTextHex;
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(choice.label, canvas.width / 2, 275);

  ctx.fillStyle = choiceIdx === 2 ? '#cbd5e1' : '#7c2d42';
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText(`"${choice.subtitle}"`, canvas.width / 2, 322);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('♡  Keepsake Card  ♡', canvas.width / 2, 378);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Renders the developed keepsake photo texture with warm paper cardstock border (#fffef9),
 * contrast(1.08) saturate(1.12) vibrance boost, and sRGB colorSpace.
 */
function createPhotoCardTexture(
  choice: PhotoEmotionChoice,
  tracker: ResourceTracker,
  loadedImg?: HTMLImageElement,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Warm paper cardstock border (#fffef9)
  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  const px = 38;
  const py = 38;
  const pw = canvas.width - 76;
  const ph = 420;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.filter = 'contrast(1.08) saturate(1.12)';

  if (loadedImg && loadedImg.width > 0) {
    const imgAspect = loadedImg.width / loadedImg.height;
    const boxAspect = pw / ph;
    let drawW = pw;
    let drawH = ph;
    let drawX = px;
    let drawY = py;
    if (imgAspect > boxAspect) {
      drawW = ph * imgAspect;
      drawX = px - (drawW - pw) * 0.5;
    } else {
      drawH = pw / imgAspect;
      drawY = py - (drawH - ph) * 0.5;
    }
    ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);
  } else {
    const grad = ctx.createLinearGradient(px, py, px, py + ph);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.55, choice.accentColor);
    grad.addColorStop(1, '#fde68a');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (let s = 0; s < 28; s++) {
      const sx = px + ((s * 73) % pw);
      const sy = py + ((s * 41) % (ph * 0.6));
      ctx.beginPath();
      ctx.arc(sx, sy, (s % 3) + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('H  ♡  Y', canvas.width / 2, py + ph * 0.48);

    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillText(choice.subtitle, canvas.width / 2, py + ph * 0.68);
  }
  ctx.restore();

  ctx.strokeStyle = choice.accentColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#3d1520';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(choice.subtitle, canvas.width / 2, 505);

  ctx.fillStyle = '#7c2d42';
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillText('Harsha & Yeshwanth · Dream World Keepsake', canvas.width / 2, 548);

  ctx.fillStyle = choice.accentColor;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('♡   ✦   ♡', canvas.width / 2, 590);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createPhotoBoothAttraction(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const prizeId = 'little_rose_token';
  const root = new THREE.Group();
  const groundY = getTerrainHeight(x, z);
  root.position.set(x, groundY, z);
  root.rotation.y = rotY;
  colliders.push({ x, z, radius: 1.45 });

  // ==========================================================================
  // 1. ENCLOSED VINTAGE PHOTO BOOTH ARCHITECTURE (Dark Walnut, Cream Stone & Brass Rivets)
  // ==========================================================================
  const floorGeo = tracker.trackGeo(createBeveledBoxGeometry(2.15, 0.18, 1.85, 0.03));
  const floorMesh = new THREE.Mesh(floorGeo, mats.darkWalnut);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // Enclosed Back Wall (-Z) & Twin Side Walls (-X, +X)
  const backWallGeo = tracker.trackGeo(createBeveledBoxGeometry(1.96, 2.38, 0.14, 0.03));
  const backWall = new THREE.Mesh(backWallGeo, mats.creamStone);
  backWall.position.set(0, 0.18, -0.78);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  root.add(backWall);

  // Warm dark walnut interior wainscoting panel on back wall
  const wainscotGeo = tracker.trackGeo(createBeveledBoxGeometry(1.82, 2.24, 0.04, 0.015));
  const wainscot = new THREE.Mesh(wainscotGeo, mats.darkWalnut);
  wainscot.position.set(0, 0.22, -0.69);
  root.add(wainscot);

  const sideWallGeo = tracker.trackGeo(createBeveledBoxGeometry(0.14, 2.38, 1.66, 0.03));
  for (const sx of [-0.92, 0.92]) {
    const sideWall = new THREE.Mesh(sideWallGeo, mats.creamStone);
    sideWall.position.set(sx, 0.18, -0.02);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    root.add(sideWall);
  }

  // 4 Dark Walnut Corner Timber Pillars with Polished Brass Rivets
  const cornerPostGeo = tracker.trackGeo(createBeveledBoxGeometry(0.16, 2.46, 0.16, 0.02));
  const rivetGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 8));
  for (const px of [-0.94, 0.94]) {
    for (const pz of [-0.78, 0.78]) {
      const post = new THREE.Mesh(cornerPostGeo, mats.darkWalnut);
      post.position.set(px, 0.18, pz);
      post.castShadow = true;
      root.add(post);

      for (const ry of [0.55, 1.15, 1.75, 2.35]) {
        const rivet = new THREE.Mesh(rivetGeo, mats.brushedGold);
        rivet.position.set(px * 1.03, ry, pz * 1.03);
        root.add(rivet);
      }
    }
  }

  // Arched Timber & Brass Roof Canopy
  const roofPlinthGeo = tracker.trackGeo(createBeveledBoxGeometry(2.12, 0.16, 1.82, 0.03));
  const roofPlinth = new THREE.Mesh(roofPlinthGeo, mats.darkWalnut);
  roofPlinth.position.set(0, 2.54, 0);
  roofPlinth.castShadow = true;
  root.add(roofPlinth);

  const archRoofGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.04, 1.04, 1.78, 20, 1, false, 0, Math.PI),
  );
  archRoofGeo.rotateZ(Math.PI / 2);
  archRoofGeo.rotateY(Math.PI / 2);
  archRoofGeo.scale(1.0, 0.36, 1.0);
  const archRoof = new THREE.Mesh(archRoofGeo, mats.darkWalnut);
  archRoof.position.set(0, 2.68, 0);
  archRoof.castShadow = true;
  root.add(archRoof);

  const brassArchTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.04, 0.028, 10, 24, Math.PI),
  );
  brassArchTrimGeo.scale(1.0, 0.36, 1.0);
  for (const tz of [-0.88, 0.88]) {
    const trim = new THREE.Mesh(brassArchTrimGeo, mats.brushedGold);
    trim.position.set(0, 2.68, tz);
    root.add(trim);
  }

  // ==========================================================================
  // 2. DEEP CRIMSON VELVET PRIVACY CURTAINS ON CURVED BRASS ROD & RINGS
  // ==========================================================================
  const curtainRodGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 1.88, 12));
  curtainRodGeo.rotateZ(Math.PI / 2);
  const curtainRod = new THREE.Mesh(curtainRodGeo, mats.brushedGold);
  curtainRod.position.set(0, 2.38, 0.82);
  root.add(curtainRod);

  const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(0.034, 0.007, 8, 14));
  ringGeo.rotateY(Math.PI / 2);
  for (let i = 0; i < 10; i++) {
    const rx = -0.78 + (i / 9) * 1.56;
    if (Math.abs(rx) < 0.28) continue; // Center parted entryway
    const ring = new THREE.Mesh(ringGeo, mats.brushedGold);
    ring.position.set(rx, 2.38, 0.82);
    root.add(ring);
  }

  // Draped pleated velvet privacy curtains framing the entrance & sides
  const pleatGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.085, 0.105, 2.12, 12));
  for (const side of [-1, 1]) {
    for (let p = 0; p < 3; p++) {
      const pleat = new THREE.Mesh(pleatGeo, mats.crimsonVelvet);
      pleat.position.set(side * (0.52 + p * 0.14), 1.28, 0.81 - p * 0.02);
      pleat.rotation.z = side * -0.06;
      pleat.castShadow = true;
      root.add(pleat);
    }
    // Gold tie-back tassel band
    const tasselBand = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.018, 8, 16)),
      mats.brushedGold,
    );
    tasselBand.rotation.x = Math.PI / 2;
    tasselBand.position.set(side * 0.68, 1.12, 0.81);
    root.add(tasselBand);
  }

  // Cozy padded crimson velvet bench inside the booth for sitting/posing
  const seatGeo = tracker.trackGeo(createBeveledBoxGeometry(1.42, 0.12, 0.42, 0.03));
  const seatMesh = new THREE.Mesh(seatGeo, mats.crimsonVelvet);
  seatMesh.position.set(0, 0.56, 0.46);
  root.add(seatMesh);

  // ==========================================================================
  // 3. VINTAGE MAHOGANY CAMERA CONSOLE, VANITY BULB RING, BRASS BELLOWS & SHELF
  // ==========================================================================
  const consoleCabinetGeo = tracker.trackGeo(createBeveledBoxGeometry(1.24, 1.15, 0.34, 0.025));
  const consoleCabinet = new THREE.Mesh(consoleCabinetGeo, mats.darkWalnut);
  consoleCabinet.position.set(0, 1.18, -0.52);
  root.add(consoleCabinet);

  // Brass console faceplate frame
  const faceplateGeo = tracker.trackGeo(createBeveledBoxGeometry(0.92, 0.82, 0.04, 0.015));
  const faceplate = new THREE.Mesh(faceplateGeo, mats.creamStone);
  faceplate.position.set(0, 1.42, -0.35);
  root.add(faceplate);

  // Ring of 12 Warm Glowing Vanity Bulbs around the lens (restrained emissive)
  const vanityBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.028, 10, 10));
  const vanityBulbMat = tracker.trackMat(mats.warmLanternGlow.clone());
  vanityBulbMat.emissiveIntensity = 0.42;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const vBulb = new THREE.Mesh(vanityBulbGeo, vanityBulbMat);
    vBulb.position.set(
      Math.cos(a) * 0.31,
      1.62 + Math.sin(a) * 0.31,
      -0.31,
    );
    root.add(vBulb);
  }

  // Accordion-Fold Camera Bellows (stepped dark walnut & brass pleats) + Gold Lens Barrel
  for (let b = 0; b < 4; b++) {
    const w = 0.26 - b * 0.022;
    const pleatBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(w, w, 0.032));
    const pleatBox = new THREE.Mesh(
      pleatBoxGeo,
      b % 2 === 0 ? mats.darkWalnut : mats.brushedGold,
    );
    pleatBox.position.set(0, 1.62, -0.30 + b * 0.032);
    root.add(pleatBox);
  }

  const lensBarrelGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.088, 0.105, 0.12, 20));
  lensBarrelGeo.rotateX(Math.PI / 2);
  const lensBarrel = new THREE.Mesh(lensBarrelGeo, mats.brushedGold);
  lensBarrel.position.set(0, 1.62, -0.14);
  root.add(lensBarrel);

  const lensGlassGeo = tracker.trackGeo(new THREE.SphereGeometry(0.072, 16, 12));
  lensGlassGeo.scale(1, 1, 0.35);
  const lensGlassMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#1e293b'),
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
    }),
  );
  lensGlassMat.userData.preserveFinish = true;
  const lensGlass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
  lensGlass.position.set(0, 1.62, -0.08);
  root.add(lensGlass);

  // Top Vintage Flash Diffuser Bulb (pulses warmly for 0.25s on shutter snap)
  const flashBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.075, 14, 12));
  const flashMat = tracker.trackMat(mats.warmLanternGlow.clone());
  flashMat.emissiveIntensity = 0.35;
  const flashBulb = new THREE.Mesh(flashBulbGeo, flashMat);
  flashBulb.position.set(0, 2.04, -0.26);
  root.add(flashBulb);

  // Velvet-Lined Card Shelf & Central Brass Insertion Chute
  const shelfWoodGeo = tracker.trackGeo(createBeveledBoxGeometry(1.06, 0.06, 0.32, 0.015));
  const shelfWood = new THREE.Mesh(shelfWoodGeo, mats.darkWalnut);
  shelfWood.position.set(0, 1.16, -0.22);
  root.add(shelfWood);

  const shelfVelvetGeo = tracker.trackGeo(createBeveledBoxGeometry(0.98, 0.02, 0.26, 0.01));
  const shelfVelvet = new THREE.Mesh(shelfVelvetGeo, mats.crimsonVelvet);
  shelfVelvet.position.set(0, 1.21, -0.21);
  root.add(shelfVelvet);

  // Brass Insertion Chute below the lens
  const chuteRimGeo = tracker.trackGeo(createBeveledBoxGeometry(0.24, 0.045, 0.06, 0.008));
  const chuteRim = new THREE.Mesh(chuteRimGeo, mats.brushedGold);
  chuteRim.position.set(0, 1.31, -0.31);
  root.add(chuteRim);

  // ==========================================================================
  // 4. THREE PHYSICAL 3D EMOTION CARDS IN BRASS SLOTS ON THE SHELF
  // ==========================================================================
  const slotGeo = tracker.trackGeo(createBeveledBoxGeometry(0.20, 0.025, 0.045, 0.006));
  const tokenCardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.165, 0.225, 0.012));

  const cardBackMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fffef9'),
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.35,
    }),
  );
  cardBackMat.userData.preserveFinish = true;

  interface PhysicalEmotionCardNode {
    pivot: THREE.Group;
    rimMat: THREE.MeshStandardMaterial;
    baseX: number;
    baseY: number;
    baseZ: number;
  }

  const emotionCardNodes: PhysicalEmotionCardNode[] = [];
  for (let i = 0; i < 3; i++) {
    const slotX = (i - 1) * 0.28;
    const brassSlot = new THREE.Mesh(slotGeo, mats.brushedGold);
    brassSlot.position.set(slotX, 1.225, -0.18);
    root.add(brassSlot);

    const tokenFrontMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        map: createEmotionTokenCardTexture(i, tracker),
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.16,
      }),
    );
    tokenFrontMat.userData.preserveFinish = true;

    const rimMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d4af37'),
        emissive: new THREE.Color('#ffdfa8'),
        emissiveIntensity: i === 0 ? 0.55 : 0.08,
        roughness: 0.28,
        metalness: 0.72,
      }),
    );
    rimMat.userData.preserveFinish = true;

    const cardPivot = new THREE.Group();
    const baseY = 1.33;
    const baseZ = -0.18;
    cardPivot.position.set(slotX, baseY, baseZ);

    const tokenMesh = new THREE.Mesh(tokenCardGeo, [
      rimMat,
      rimMat,
      rimMat,
      rimMat,
      tokenFrontMat,
      cardBackMat,
    ]);
    tokenMesh.castShadow = true;
    cardPivot.add(tokenMesh);
    root.add(cardPivot);

    emotionCardNodes.push({
      pivot: cardPivot,
      rimMat,
      baseX: slotX,
      baseY,
      baseZ,
    });
  }

  // Exterior Vintage Header Sign
  const signTex = createPaintedSignTexture(
    'PHOTO BOOTH',
    'Vintage Keepsake Portraits',
    '#c23b57',
    tracker,
  );
  const signMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45, metalness: 0.05 }),
  );
  const signMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.92, 0.48, 0.08)),
    signMat,
  );
  signMesh.position.set(0, 2.86, 0.88);
  root.add(signMesh);

  // ==========================================================================
  // 5. DEVELOPED GLOSSY KEEPSAKE PHOTO CARD (MeshPhysicalMaterial + Clearcoat)
  // ==========================================================================
  const photoCardGroup = new THREE.Group();
  // Floats inside the intimate booth interior right in front of the console
  photoCardGroup.position.set(0, 1.46, 0.12);
  photoCardGroup.scale.setScalar(0.001);
  root.add(photoCardGroup);

  const initialPhotoTex = createPhotoCardTexture(PHOTO_EMOTION_CHOICES[0], tracker);
  const cardFrontMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: initialPhotoTex,
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color('#fff6e8'),
      emissiveMap: initialPhotoTex,
      emissiveIntensity: 0.18,
    }),
  );
  cardFrontMat.userData.preserveFinish = true;

  const cardGoldRimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4af37'),
      roughness: 0.32,
      metalness: 0.68,
    }),
  );
  cardGoldRimMat.userData.preserveFinish = true;

  const cardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.46, 0.58, 0.018));
  const cardMesh = new THREE.Mesh(cardGeo, [
    cardGoldRimMat,
    cardGoldRimMat,
    cardGoldRimMat,
    cardGoldRimMat,
    cardFrontMat,
    cardBackMat,
  ]);
  photoCardGroup.add(cardMesh);

  const loadedTextures: Array<THREE.CanvasTexture | null> = [null, null, null];
  PHOTO_EMOTION_CHOICES.forEach((choice, idx) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedTextures[idx] = createPhotoCardTexture(choice, tracker, img);
      if (selectedEmotionIdx === idx) {
        cardFrontMat.map = loadedTextures[idx];
        cardFrontMat.emissiveMap = loadedTextures[idx];
        cardFrontMat.needsUpdate = true;
      }
    };
    img.src = choice.imageUrl;
  });

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let selectedEmotionIdx = 0;
  let shutterTriggered = false;
  let shutterTimer = 0;
  let swapFlashTimer = 0;
  let mouseSelectAccum = 0;
  let prizeAwardedThisRun = false;
  const viewedEmotions = new Set<number>();

  const orbitCam = createGiftOrbitCameraState(0.96);

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 2.15,
    groundY,
    z + forwardDir.z * 2.15,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  function applyEmotionTexture(idx: number) {
    selectedEmotionIdx = ((idx % 3) + 3) % 3;
    viewedEmotions.add(selectedEmotionIdx);
    const tex =
      loadedTextures[selectedEmotionIdx] ||
      createPhotoCardTexture(PHOTO_EMOTION_CHOICES[selectedEmotionIdx], tracker);
    cardFrontMat.map = tex;
    cardFrontMat.emissiveMap = tex;
    cardFrontMat.needsUpdate = true;
  }

  function highlightEmotionCard(idx: number) {
    const nextIdx = ((idx % 3) + 3) % 3;
    if (nextIdx !== selectedEmotionIdx) {
      selectedEmotionIdx = nextIdx;
      audio.playTargetHitChime(selectedEmotionIdx + 1);
    }
  }

  function triggerShutter(idx: number) {
    if (shutterTriggered) return;
    applyEmotionTexture(idx);
    shutterTriggered = true;
    shutterTimer = 0;
    flashMat.emissiveIntensity = 2.8;
    audio.playMechanicalTurn();
    audio.playTargetHitChime(selectedEmotionIdx + 1);
    const lensWorld = new THREE.Vector3(0, 1.62, -0.1)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
      .add(worldPos);
    fx.triggerSparkleRing(lensWorld, 0.24, 18);
  }

  function swapPhotoInInspection(idx: number) {
    const nextIdx = ((idx % 3) + 3) % 3;
    applyEmotionTexture(nextIdx);
    swapFlashTimer = 0.25;
    flashMat.emissiveIntensity = 2.8;
    photoCardGroup.scale.setScalar(0.78);
    audio.playMechanicalTurn();
    audio.playCardFlutter();
    const cardWorld = new THREE.Vector3(0, 1.46, 0.12)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
      .add(worldPos);
    fx.triggerSparkleRing(cardWorld, 0.22, 16);
  }

  return {
    id: 'photo_booth' as CarnivalAttractionId,
    title: 'Vintage Photo Booth',
    subtitle: 'Enclosed Keepsake Portrait Studio',
    verb: 'E Enter Photo Booth' as CarnivalPromptVerb,
    group: root,
    worldPos,
    interactPos,
    interactRadius: 3.6,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      shutterTriggered = false;
      shutterTimer = 0;
      swapFlashTimer = 0;
      mouseSelectAccum = 0;
      selectedEmotionIdx = 0;
      viewedEmotions.clear();
      prizeAwardedThisRun = false;
      orbitCam.reset();
      photoCardGroup.scale.setScalar(0.001);
      photoCardGroup.rotation.set(0, 0, 0);
      flashMat.emissiveIntensity = 0.35;
      state = 'ACTIVATING';
      stateTimer = 0;
      audio.ensureRunning();
    },

    selectOption(index: number) {
      const normalizedIdx = index >= 1 && index <= 3 ? index - 1 : THREE.MathUtils.clamp(index, 0, 2);
      if (state === 'PLAYING' && !shutterTriggered) {
        highlightEmotionCard(normalizedIdx);
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        swapPhotoInInspection(normalizedIdx);
      }
    },

    performAction() {
      if (state === 'PLAYING' && !shutterTriggered) {
        triggerShutter(selectedEmotionIdx);
        return true;
      }
      return false;
    },

    advanceStep() {
      // Strict No Auto-Advancing: Photo 1 stays floating indefinitely in 360° inspection
      // until Harsha explicitly chooses another emotion card or presses Enter to collect & exit.
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      photoCardGroup.scale.setScalar(0.001);
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'PLAYING' && !shutterTriggered) {
        // Hovering/sliding mouse across the shelf smoothly selects among the 3 physical 3D cards
        mouseSelectAccum += dx;
        if (mouseSelectAccum > 42) {
          mouseSelectAccum = 0;
          highlightEmotionCard(selectedEmotionIdx + 1);
        } else if (mouseSelectAccum < -42) {
          mouseSelectAccum = 0;
          highlightEmotionCard(selectedEmotionIdx - 1);
        }
      } else if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy);
      }
    },

    applyZoomDelta(delta: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(delta);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      const choice = PHOTO_EMOTION_CHOICES[selectedEmotionIdx];
      const emotionKey =
        selectedEmotionIdx === 0
          ? 'romantic'
          : selectedEmotionIdx === 1
            ? 'playful'
            : 'treasured';

      if (state === 'PRIZE_REVEAL' || state === 'CINEMATIC' || state === 'WIN') {
        return {
          attractionId: 'photo_booth' as CarnivalAttractionId,
          title: 'Vintage Photo Booth',
          subtitle: choice.label,
          state,
          selectedEmotion: emotionKey,
          prizeName: `Keepsake Portrait: ${choice.subtitle}`,
          prizeCategory: choice.label,
          captionLine: `"${choice.caption}"`,
          progressText: 'Sweet & Romantic   ·   Silly & Playful   ·   Deep & Treasured',
          instruction:
            'Drag / WASD to Inspect 360° & Zoom · Q/E to Try Another Mood Card · Enter to Keep & Exit',
          requiresEnterToContinue: true,
        };
      }

      return {
        attractionId: 'photo_booth' as CarnivalAttractionId,
        title: 'Vintage Photo Booth',
        subtitle: `Highlighted Card: ${choice.label} — "${choice.subtitle}"`,
        state,
        photoBoothStep: shutterTriggered ? 'flash' : 'select',
        selectedEmotion: emotionKey,
        captionLine: `"${choice.caption}"`,
        instruction:
          'Hover or A / D to Lift a Keepsake Card on the Velvet Shelf · Press SPACE or Click to Insert & Snap Photo',
        progressText: 'Sweet & Romantic   ·   Silly & Playful   ·   Deep & Treasured',
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const presWorld = new THREE.Vector3(0, 1.34, 0.12)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        orbitCam.computeFocus(presWorld, rotY, camWorldPos, lookWorldPos);
      } else {
        // Intimate interior camera view inside the velvet-curtained booth facing the mahogany console & 3D card shelf
        const localCam = new THREE.Vector3(0, 1.54, 0.68);
        const localLook = new THREE.Vector3(0, 1.42, -0.32);
        camWorldPos
          .copy(localCam)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        lookWorldPos
          .copy(localLook)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
      }

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: interactPos,
        playerYaw: rotY + Math.PI,
        hidePlayerAvatar: true,
      };
    },

    update(dt: number, elapsedTime: number, _camera?: THREE.PerspectiveCamera, keys?: Set<string>) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      if (swapFlashTimer > 0) {
        swapFlashTimer = Math.max(0, swapFlashTimer - dt);
        flashMat.emissiveIntensity = 0.35 + (swapFlashTimer / 0.25) * 2.45;
      }

      if (keys && (state === 'PLAYING' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL')) {
        if (keys.has('Digit1') || keys.has('Numpad1')) {
          keys.delete('Digit1');
          keys.delete('Numpad1');
          if (state === 'PLAYING') highlightEmotionCard(0);
          else swapPhotoInInspection(0);
        } else if (keys.has('Digit2') || keys.has('Numpad2')) {
          keys.delete('Digit2');
          keys.delete('Numpad2');
          if (state === 'PLAYING') highlightEmotionCard(1);
          else swapPhotoInInspection(1);
        } else if (keys.has('Digit3') || keys.has('Numpad3')) {
          keys.delete('Digit3');
          keys.delete('Numpad3');
          if (state === 'PLAYING') highlightEmotionCard(2);
          else swapPhotoInInspection(2);
        } else if (keys.has('KeyQ')) {
          keys.delete('KeyQ');
          if (state === 'PLAYING') highlightEmotionCard(selectedEmotionIdx - 1);
          else swapPhotoInInspection(selectedEmotionIdx - 1);
        } else if (keys.has('KeyE') && (state === 'CINEMATIC' || state === 'PRIZE_REVEAL')) {
          keys.delete('KeyE');
          swapPhotoInInspection(selectedEmotionIdx + 1);
        }
      }

      if (state === 'PLAYING' && keys && !shutterTriggered) {
        if (keys.has('KeyA') || keys.has('ArrowLeft')) {
          keys.delete('KeyA');
          keys.delete('ArrowLeft');
          highlightEmotionCard(selectedEmotionIdx - 1);
        } else if (keys.has('KeyD') || keys.has('ArrowRight')) {
          keys.delete('KeyD');
          keys.delete('ArrowRight');
          highlightEmotionCard(selectedEmotionIdx + 1);
        }
      }

      // Animate the 3 physical 3D emotion cards in their brass slots:
      // Active card lifts +0.04m (+4cm) with golden rim highlight and slight forward tilt;
      // When shutter is triggered, the chosen card slides into the brass chute!
      for (let i = 0; i < 3; i++) {
        const node = emotionCardNodes[i];
        const isSelected = i === selectedEmotionIdx;
        let targetX = node.baseX;
        let targetY = isSelected ? node.baseY + 0.04 : node.baseY;
        let targetZ = isSelected ? node.baseZ + 0.032 : node.baseZ;
        let targetRotX = isSelected ? -0.14 : 0;

        if (isSelected && shutterTriggered) {
          targetX = 0;
          targetY = 1.31;
          targetZ = -0.32;
          targetRotX = -Math.PI * 0.35;
        }

        node.pivot.position.x = THREE.MathUtils.lerp(node.pivot.position.x, targetX, 12 * dt);
        node.pivot.position.y = THREE.MathUtils.lerp(node.pivot.position.y, targetY, 12 * dt);
        node.pivot.position.z = THREE.MathUtils.lerp(node.pivot.position.z, targetZ, 12 * dt);
        node.pivot.rotation.x = THREE.MathUtils.lerp(node.pivot.rotation.x, targetRotX, 12 * dt);
        node.rimMat.emissiveIntensity = THREE.MathUtils.lerp(
          node.rimMat.emissiveIntensity,
          isSelected ? 0.65 : 0.08,
          10 * dt,
        );
      }

      // Keep soft warm key light inside the booth during selection
      if (state === 'PLAYING' || state === 'ACTIVATING') {
        const shelfWorld = new THREE.Vector3(0, 1.38, -0.15)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        fx.setTheatricalLighting(0.65, shelfWorld);
      }

      if (shutterTriggered && state === 'PLAYING') {
        shutterTimer += dt;
        // 0.25s warm camera flash pulse
        if (shutterTimer < 0.25) {
          flashMat.emissiveIntensity = 2.8;
        } else {
          flashMat.emissiveIntensity = THREE.MathUtils.lerp(flashMat.emissiveIntensity, 0.35, 10 * dt);
        }
        if (shutterTimer >= 0.5) {
          audio.playPrizeRevealArpeggio();
          state = 'WIN';
          stateTimer = 0;
        }
      }

      if (state === 'ACTIVATING' && stateTimer >= 0.4) {
        state = 'PLAYING';
        stateTimer = 0;
      } else if (state === 'WIN' && stateTimer >= 0.15) {
        state = 'CINEMATIC';
        stateTimer = 0;
      } else if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.updateKeys(dt, keys);
        const s = THREE.MathUtils.lerp(photoCardGroup.scale.x, 1.0, 1 - Math.exp(-8 * dt));
        photoCardGroup.scale.setScalar(s);
        photoCardGroup.position.y = 1.46 + Math.sin(elapsedTime * 2.2) * 0.015;
        photoCardGroup.rotation.y = 0;

        // Position the dedicated warm local key light (#fff6e8, intensity 1.15) directly facing the floating photo card
        const cardWorld = new THREE.Vector3(0, 1.46, 0.12)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        fx.setTheatricalLighting(1.0, cardWorld);

        if (state === 'CINEMATIC' && stateTimer >= 1.2) {
          state = 'PRIZE_REVEAL';
          stateTimer = 0;
          if (!prizeAwardedThisRun) {
            prizeAwardedThisRun = true;
            newlyEarnedPrizeId = prizeId;
          }
        }
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.5;
        photoCardGroup.scale.setScalar(Math.max(0.001, 1 - recoverU));
        const cardWorld = new THREE.Vector3(0, 1.46, 0.12)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY)
          .add(worldPos);
        fx.setTheatricalLighting((1 - recoverU) * 1.0, cardWorld);
        if (stateTimer >= 0.5) {
          shutterTriggered = false;
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * Creates all 6 playable Carnival booths/machines:
 * Photo Booth is placed at (14.6, -66.8) right next to Frog Launch (12.8, -61.5).
 */
export function createCarnivalBooths(
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction[] {
  return [
    createHeartshotBooth(-9.8, -51.5, 0.32, tracker, mats, audio, colliders, fx),
    createRingTossBooth(9.8, -51.5, -0.32, tracker, mats, audio, colliders, fx),
    createPrizeKnockdownBooth(-12.8, -61.5, 0.48, tracker, mats, audio, colliders, fx),
    createFrogLaunchBooth(12.8, -61.5, -0.48, tracker, mats, audio, colliders, fx),
    createMysteryEggMachine(5.4, -56.8, -0.25, tracker, mats, audio, colliders, fx),
    createPhotoBoothAttraction(14.6, -66.8, -0.52, tracker, mats, audio, colliders, fx),
  ];
}