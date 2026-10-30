import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { getTerrainHeight } from '../terrainMath';
import { CircleCollider } from '../VegetationSystem';
import { createDreamCastleMaterials, DreamCastleMaterials } from './CastleMaterials';
import {
  CastleNavigationController,
  CASTLE_ORIGIN_X,
  CASTLE_ORIGIN_Z,
  CASTLE_FLOOR_DEFS,
  CASTLE_STAIRCASE_CONFIGS,
} from './CastleNavigation';
import {
  CastleFloor1RoomsBundle,
  createCastleFloor1Rooms,
  Floor1CameraState,
} from './CastleFloor1Rooms';
import {
  CastleFloor2RoomsBundle,
  createCastleFloor2Rooms,
  Floor2CameraState,
} from './CastleFloor2Rooms';
import {
  CastleFloor3RoomsBundle,
  createCastleFloor3Rooms,
  Floor3CameraState,
} from './CastleFloor3Rooms';
import {
  CastleFloor2CreativeWingBundle,
  createCastleFloor2CreativeWing,
  CreativeWing,
  CreativeWingCameraState,
} from './CastleFloor2CreativeWing';
import { CastleGardenBundle, createCastleGarden } from './CastleGarden';
import {
  CastleHeartTreesBundle,
  createCastleHeartTrees,
  HeartTreePlacement,
} from './CastleHeartTrees';

export interface DreamCastleBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  cameraOccluders: THREE.Mesh[];
  interiorPartitionMeshes: THREE.Mesh[];
  nav: CastleNavigationController;
  floor1Rooms: CastleFloor1RoomsBundle;
  floor2Rooms: CastleFloor2RoomsBundle;
  creativeWing: CreativeWing;
  floor2CreativeWing: CastleFloor2CreativeWingBundle;
  floor3Rooms: CastleFloor3RoomsBundle;
  rearGarden: CastleGardenBundle;
  heartTrees: CastleHeartTreesBundle;
  setAvatarRoseCallback: (cb: (held: boolean) => void) => void;
  getSurfaceHeight: (wx: number, wz: number, playerY: number, defaultGroundY: number) => number;
  isInsideCastle: (wx: number, wz: number) => boolean;
  getProximityPrompt: (playerPos: THREE.Vector3) => { prompt: string; action: 'door' | 'call_elevator' | 'fountain' | 'telescope' | 'floor1_room' | 'floor2_room' | 'floor3_room' | 'none' } | null;
  interact: (playerPos?: THREE.Vector3) => boolean;
  handleElevatorFloorSelect: (floorNum: number) => boolean;
  performPredefinedDance: (stepIndex: number) => void;
  setGalleryFrameImage: (frameIndex: number, imageSrc: string) => void;
  getGalleryFrames: () => readonly { index: number; title: string; sub: string; hasCustomImage: boolean; customImageSrc?: string }[];
  getCameraFocus: () => { target: THREE.Vector3; position: THREE.Vector3; fov?: number; blendAlpha: number; isSitting?: boolean; isFirstPersonSeated?: boolean; seatWorldPos?: THREE.Vector3; seatYaw?: number } | null;
  update: (delta: number, playerPos: THREE.Vector3, elapsedTime?: number, inputKeys?: Set<string>) => void;
  dispose: () => void;
}

function createFountainHologramTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 512, 640);

    // 1. Soft radial cyan & champagne-gold holographic aura
    const bgGrad = ctx.createRadialGradient(256, 310, 24, 256, 310, 250);
    bgGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.42)');
    bgGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.28)');
    bgGrad.addColorStop(0.82, 'rgba(14, 165, 233, 0.08)');
    bgGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 640);

    // 2. Arched Royal Filigree Frame
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(256, 250, 172, Math.PI, 0, false);
    ctx.lineTo(428, 520);
    ctx.quadraticCurveTo(256, 555, 84, 520);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 250, 160, Math.PI, 0, false);
    ctx.lineTo(416, 508);
    ctx.quadraticCurveTo(256, 540, 96, 508);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 3. Glowing Heart Halo behind Yeshwanth & Harsha
    const drawHeart = (cx: number, cy: number, size: number, fill: string, stroke?: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.35);
      ctx.bezierCurveTo(cx - size, cy - size * 0.25, cx - size * 0.55, cy - size * 0.95, cx, cy - size * 0.42);
      ctx.bezierCurveTo(cx + size * 0.55, cy - size * 0.95, cx + size, cy - size * 0.25, cx, cy + size * 0.35);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    };

    ctx.save();
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 22;
    drawHeart(256, 255, 118, 'rgba(253, 224, 71, 0.16)', 'rgba(253, 224, 71, 0.78)');
    ctx.restore();

    // 4. Stylized Romantic Silhouette Portrait of Yeshwanth & Harsha Holding Hands
    ctx.save();
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 18;
    const silGrad = ctx.createLinearGradient(160, 175, 350, 465);
    silGrad.addColorStop(0.0, 'rgba(254, 249, 195, 0.96)');
    silGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.92)');
    silGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.78)');
    ctx.fillStyle = silGrad;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
    ctx.lineWidth = 2.5;

    // Yeshwanth (left, slightly taller)
    ctx.beginPath();
    ctx.arc(216, 214, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(182, 438);
    ctx.quadraticCurveTo(180, 290, 196, 246);
    ctx.quadraticCurveTo(216, 238, 236, 248);
    ctx.quadraticCurveTo(250, 285, 254, 332);
    ctx.lineTo(242, 438);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Harsha (right, flowing gown)
    ctx.beginPath();
    ctx.arc(292, 226, 21.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(252, 438);
    ctx.quadraticCurveTo(260, 325, 272, 256);
    ctx.quadraticCurveTo(292, 248, 310, 258);
    ctx.quadraticCurveTo(334, 335, 348, 438);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Joined hands at center with glowing heart spark
    drawHeart(255, 305, 22, 'rgba(254, 240, 138, 0.95)', 'rgba(255, 255, 255, 0.95)');
    ctx.restore();

    // 5. Floating Heart Sparkles
    const heartSpots = [
      { x: 132, y: 185, s: 14 },
      { x: 382, y: 192, s: 15 },
      { x: 148, y: 315, s: 12 },
      { x: 372, y: 310, s: 13 },
      { x: 256, y: 125, s: 18 },
      { x: 188, y: 145, s: 11 },
      { x: 326, y: 148, s: 11 },
    ];
    heartSpots.forEach((h) => {
      drawHeart(h.x, h.y, h.s, 'rgba(253, 224, 71, 0.85)', 'rgba(125, 211, 252, 0.9)');
    });

    // 6. Subtle Holographic Scanlines
    ctx.fillStyle = 'rgba(186, 230, 253, 0.09)';
    for (let y = 60; y < 560; y += 6) {
      ctx.fillRect(76, y, 360, 1.5);
    }

    // 7. Romantic Caption & Names
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(14, 165, 233, 0.95)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('Yeshwanth & Harsha', 256, 478);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'italic 16.5px Georgia, serif';
    ctx.fillText('"Our favorite place in the world', 256, 508);
    ctx.fillText('is right beside you. ♡"', 256, 530);
    ctx.restore();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.needsUpdate = true;

  // Real Image Loader with Cover-Fit Scaling
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!ctx || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

      ctx.clearRect(0, 0, 512, 640);

      // Backlighting aura
      const bgGrad = ctx.createRadialGradient(256, 320, 40, 256, 320, 275);
      bgGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.55)');
      bgGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.36)');
      bgGrad.addColorStop(0.88, 'rgba(14, 165, 233, 0.14)');
      bgGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 640);

      // Rounded rect clip
      const frameX = 48;
      const frameY = 42;
      const frameW = 416;
      const frameH = 492;
      const cornerR = 36;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, cornerR);
      ctx.clip();

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const boxAspect = frameW / frameH;
      let drawW = frameW;
      let drawH = frameH;
      let drawX = frameX;
      let drawY = frameY;
      if (imgAspect > boxAspect) {
        drawW = frameH * imgAspect;
        drawX = frameX - (drawW - frameW) * 0.5;
      } else {
        drawH = frameW / imgAspect;
        drawY = frameY - (drawH - frameH) * 0.35;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Holographic water shimmer & gold vignette overlay
      const innerVig = ctx.createRadialGradient(
        256,
        frameY + frameH * 0.48,
        frameW * 0.28,
        256,
        frameY + frameH * 0.5,
        frameH * 0.58,
      );
      innerVig.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      innerVig.addColorStop(0.78, 'rgba(56, 189, 248, 0.08)');
      innerVig.addColorStop(1.0, 'rgba(12, 74, 110, 0.38)');
      ctx.fillStyle = innerVig;
      ctx.fillRect(frameX, frameY, frameW, frameH);
      ctx.restore();

      // Gold & cyan double border
      ctx.save();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.92)';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, cornerR);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16, cornerR - 6);
      ctx.stroke();
      ctx.restore();

      // Lower caption banner
      ctx.save();
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(14, 165, 233, 0.95)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 23px Georgia, serif';
      ctx.fillText('Yeshwanth & Harsha', 256, 568);

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillText('"Our favorite place in the world is right beside you. ♡"', 256, 596);
      ctx.restore();

      tex.needsUpdate = true;
    };
    img.src = '/assets/harsha/fountain-portrait.jpg';
  }

  return tex;
}

export function createDreamCastle(): DreamCastleBundle {
  const tracker = new ResourceTracker();
  const mats: DreamCastleMaterials = createDreamCastleMaterials(tracker);
  const nav = new CastleNavigationController();

  const group = new THREE.Group();
  group.name = 'DreamCastle_Sprint1';
  group.position.set(nav.originX, nav.baseY, nav.originZ);

  const colliders: CircleCollider[] = [];

  // ========================================================================
  // 1. ARCHITECTURAL PODIUM & EXTERIOR FOUNDATION (5-LEVEL SHELL)
  // ========================================================================
  // Strict vertical hierarchy: Exterior Podium top surface at y = +0.10m (never coplanar with Floor 1 at y = +0.25m)
  const podiumGeo = tracker.trackGeo(new THREE.BoxGeometry(38.0, 0.5, 38.0));
  podiumGeo.translate(0, -0.15, 0);
  const podium = new THREE.Mesh(podiumGeo, mats.creamStone);
  podium.receiveShadow = true;
  group.add(podium);

  const stepsGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 0.35, 5.8));
  stepsGeo.translate(0, 0.025, -19.1);
  const stepsMesh = new THREE.Mesh(stepsGeo, mats.blushRoseMarble);
  stepsMesh.receiveShadow = true;
  group.add(stepsMesh);

  // Colonnade Columns (supporting high 7.2m entrance arch & pediment)
  const colGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.36, 0.44, 6.8, 12));
  colGeo.translate(0, 3.4, 0);
  const colCapGeo = tracker.trackGeo(new THREE.BoxGeometry(1.1, 0.35, 1.1));
  colCapGeo.translate(0, 6.95, 0);

  [-3.8, -1.9, 1.9, 3.8].forEach((cx) => {
    const col = new THREE.Mesh(colGeo, mats.pearlWhite);
    col.position.set(cx, 0.25, -16.8);
    col.castShadow = true;
    const cap = new THREE.Mesh(colCapGeo, mats.champagneGold);
    cap.position.set(cx, 0.25, -16.8);
    group.add(col, cap);
    colliders.push({ x: nav.originX + cx, z: nav.originZ - 16.8, radius: 0.55 });
  });

  const pedimentGeo = tracker.trackGeo(new THREE.BoxGeometry(9.6, 1.2, 2.2));
  pedimentGeo.translate(0, 7.65, -16.8);
  const pediment = new THREE.Mesh(pedimentGeo, mats.blushRoseMarble);
  pediment.castShadow = true;
  group.add(pediment);

  // ========================================================================
  // 1B. FIREFLY-LIT ENCHANTED STONE PAVER PATHWAY
  // ========================================================================
  const PAVER_STEPS = 32;
  const paverMainGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.15, 1.22, 0.14, 8));
  const paverSideGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.58, 0.64, 0.14, 7));
  const flowerBedMoundGeo = tracker.trackGeo(new THREE.SphereGeometry(0.46, 8, 6));
  flowerBedMoundGeo.scale(1.3, 0.42, 1.1);
  const flowerBlossomGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.16, 0));

  const mainPaverInst = new THREE.InstancedMesh(paverMainGeo, mats.blushRoseMarble, PAVER_STEPS);
  const sidePaverInst = new THREE.InstancedMesh(paverSideGeo, mats.creamStone, PAVER_STEPS * 2);
  const flowerMoundInst = new THREE.InstancedMesh(flowerBedMoundGeo, mats.softLavender, PAVER_STEPS * 2);
  const flowerBlossomInst = new THREE.InstancedMesh(flowerBlossomGeo, mats.champagneGold, PAVER_STEPS * 2);
  mainPaverInst.receiveShadow = true;
  sidePaverInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const samplePathwayCenter = (t: number): { lx: number; lz: number; tangentAngle: number } => {
    // t = 0: Castle Porch Steps (lx: 0, lz: -20.5) [World: X 88, Z -2.5]
    // t = 1: Fashion Boulevard Welcome Board (lx: -27.0, lz: -20.0) [World: X 61, Z -2]
    const lx = THREE.MathUtils.lerp(0.0, -27.0, t);
    const arcZ = Math.sin(t * Math.PI) * -4.5;
    const lz = THREE.MathUtils.lerp(-20.5, -20.0, t) + arcZ;

    const dt = 0.02;
    const t2 = Math.min(1.0, t + dt);
    const lx2 = THREE.MathUtils.lerp(0.0, -27.0, t2);
    const lz2 = THREE.MathUtils.lerp(-20.5, -20.0, t2) + Math.sin(t2 * Math.PI) * -4.5;
    const tangentAngle = Math.atan2(lx2 - lx, lz2 - lz);

    return { lx, lz, tangentAngle };
  };

  for (let i = 0; i < PAVER_STEPS; i++) {
    const t = i / (PAVER_STEPS - 1);
    const { lx, lz, tangentAngle } = samplePathwayCenter(t);
    const wx = nav.originX + lx;
    const wz = nav.originZ + lz;
    const ly = getTerrainHeight(wx, wz) - nav.baseY;

    dummy.position.set(lx, ly + 0.04, lz);
    dummy.rotation.set(0, tangentAngle + (i % 3) * 0.35, 0);
    dummy.scale.set(1.15, 1.0, 0.88);
    dummy.updateMatrix();
    mainPaverInst.setMatrixAt(i, dummy.matrix);

    const perpX = Math.cos(tangentAngle);
    const perpZ = -Math.sin(tangentAngle);
    [-1, 1].forEach((side, sIdx) => {
      const idx = i * 2 + sIdx;
      const curbOffset = 1.48 * side;
      const sx = lx + perpX * curbOffset;
      const sz = lz + perpZ * curbOffset;
      const sy = getTerrainHeight(nav.originX + sx, nav.originZ + sz) - nav.baseY;

      dummy.position.set(sx, sy + 0.05, sz);
      dummy.rotation.set(0, tangentAngle + idx * 0.5, 0);
      dummy.scale.set(1.0, 1.0, 1.0);
      dummy.updateMatrix();
      sidePaverInst.setMatrixAt(idx, dummy.matrix);

      const bedOffset = (2.35 + (i % 2) * 0.35) * side;
      const fx = lx + perpX * bedOffset;
      const fz = lz + perpZ * bedOffset;
      const fy = getTerrainHeight(nav.originX + fx, nav.originZ + fz) - nav.baseY;

      dummy.position.set(fx, fy + 0.08, fz);
      dummy.rotation.set(0, idx * 0.8, 0);
      dummy.scale.set(1.0, 1.0, 1.0);
      dummy.updateMatrix();
      flowerMoundInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(fx, fy + 0.34, fz);
      dummy.rotation.set(0.2, idx * 1.1, 0.2);
      dummy.scale.set(1.0, 1.2, 1.0);
      dummy.updateMatrix();
      flowerBlossomInst.setMatrixAt(idx, dummy.matrix);
    });
  }
  mainPaverInst.instanceMatrix.needsUpdate = true;
  sidePaverInst.instanceMatrix.needsUpdate = true;
  flowerMoundInst.instanceMatrix.needsUpdate = true;
  flowerBlossomInst.instanceMatrix.needsUpdate = true;
  group.add(mainPaverInst, sidePaverInst, flowerMoundInst, flowerBlossomInst);

  // 60 Glowing Fireflies
  const PATHWAY_FIREFLY_COUNT = 60;
  interface PathwayFirefly {
    anchorX: number;
    anchorY: number;
    anchorZ: number;
    phase: number;
    speedX: number;
    speedY: number;
    speedZ: number;
    ampX: number;
    ampY: number;
    ampZ: number;
    baseR: number;
    baseG: number;
    baseB: number;
  }
  const pathwayFireflies: PathwayFirefly[] = [];
  const fireflyPosArray = new Float32Array(PATHWAY_FIREFLY_COUNT * 3);
  const fireflyColorArray = new Float32Array(PATHWAY_FIREFLY_COUNT * 3);

  for (let i = 0; i < PATHWAY_FIREFLY_COUNT; i++) {
    const t = (i + 0.5) / PATHWAY_FIREFLY_COUNT;
    const { lx, lz, tangentAngle } = samplePathwayCenter(t);
    const side = i % 2 === 0 ? -1 : 1;
    const perpX = Math.cos(tangentAngle);
    const perpZ = -Math.sin(tangentAngle);
    const lateralDist = (1.85 + ((i * 7) % 5) * 0.45) * side;

    const anchorX = lx + perpX * lateralDist;
    const anchorZ = lz + perpZ * lateralDist;
    const groundY = getTerrainHeight(nav.originX + anchorX, nav.originZ + anchorZ) - nav.baseY;
    const anchorY = groundY + 0.85 + (i % 4) * 0.32;

    const isAmber = i % 2 === 0;
    const baseR = isAmber ? 0.99 : 0.28;
    const baseG = isAmber ? 0.86 : 0.82;
    const baseB = isAmber ? 0.28 : 0.98;

    pathwayFireflies.push({
      anchorX,
      anchorY,
      anchorZ,
      phase: i * 1.17,
      speedX: 1.15 + (i % 5) * 0.18,
      speedY: 1.65 + (i % 4) * 0.24,
      speedZ: 1.05 + (i % 6) * 0.16,
      ampX: 0.55 + (i % 3) * 0.18,
      ampY: 0.28 + (i % 3) * 0.09,
      ampZ: 0.55 + (i % 4) * 0.16,
      baseR,
      baseG,
      baseB,
    });

    const i3 = i * 3;
    fireflyPosArray[i3] = anchorX;
    fireflyPosArray[i3 + 1] = anchorY;
    fireflyPosArray[i3 + 2] = anchorZ;
    fireflyColorArray[i3] = baseR;
    fireflyColorArray[i3 + 1] = baseG;
    fireflyColorArray[i3 + 2] = baseB;
  }

  const fireflyGeo = tracker.trackGeo(new THREE.BufferGeometry());
  const fireflyPosAttr = new THREE.BufferAttribute(fireflyPosArray, 3);
  const fireflyColorAttr = new THREE.BufferAttribute(fireflyColorArray, 3);
  fireflyGeo.setAttribute('position', fireflyPosAttr);
  fireflyGeo.setAttribute('color', fireflyColorAttr);

  const fireflySpriteCanvas = document.createElement('canvas');
  fireflySpriteCanvas.width = 64;
  fireflySpriteCanvas.height = 64;
  const ffCtx = fireflySpriteCanvas.getContext('2d');
  if (ffCtx) {
    const g = ffCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.35, 'rgba(255, 250, 220, 0.85)');
    g.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ffCtx.fillStyle = g;
    ffCtx.fillRect(0, 0, 64, 64);
  }
  const fireflySpriteTex = tracker.trackTex(new THREE.CanvasTexture(fireflySpriteCanvas));
  const fireflyMat = tracker.trackMat(
    new THREE.PointsMaterial({
      size: 0.52,
      map: fireflySpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  const pathwayFireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  pathwayFireflyPoints.frustumCulled = false;
  group.add(pathwayFireflyPoints);

  // ========================================================================
  // 2. 4 CORNER TOWERS
  // ========================================================================
  const towerPositions = [
    { name: 'HeartTower', lx: -15.5, lz: -15.5, spireColor: mats.powderBlueSpire },
    { name: 'RoseTower', lx: 15.5, lz: -15.5, spireColor: mats.powderBlueSpire },
    { name: 'StarTower', lx: -15.5, lz: 15.5, spireColor: mats.softLavender },
    { name: 'PearlTower', lx: 15.5, lz: 15.5, spireColor: mats.powderBlueSpire },
  ];

  const towerBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.1, 3.4, 21.0, 16));
  towerBodyGeo.translate(0, 10.5, 0);
  const towerCorniceGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.6, 3.1, 0.9, 16));
  towerCorniceGeo.translate(0, 21.4, 0);
  const towerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(3.4, 8.5, 16));
  towerSpireGeo.translate(0, 25.8, 0);
  const towerFinialGeo = tracker.trackGeo(new THREE.SphereGeometry(0.55, 10, 10));
  towerFinialGeo.translate(0, 30.4, 0);

  const cameraOccluders: THREE.Mesh[] = [];

  towerPositions.forEach((tp) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tp.lx, 0, tp.lz);

    const body = new THREE.Mesh(towerBodyGeo, mats.pearlWhite);
    body.castShadow = true;
    body.receiveShadow = true;
    cameraOccluders.push(body);
    const cornice = new THREE.Mesh(towerCorniceGeo, mats.champagneGold);
    const spire = new THREE.Mesh(towerSpireGeo, tp.spireColor);
    spire.castShadow = true;
    const finial = new THREE.Mesh(towerFinialGeo, mats.champagneGold);

    tGroup.add(body, cornice, spire, finial);

    // Ornamental Crown-Like Top, Crystal Finial, Pastel Pennant & Heart Medallions on ALL 4 Towers (Section 13)
    const towerCrownRingGeo = tracker.trackGeo(new THREE.TorusGeometry(3.25, 0.14, 10, 24));
    towerCrownRingGeo.rotateX(Math.PI / 2);
    towerCrownRingGeo.translate(0, 21.85, 0);
    tGroup.add(new THREE.Mesh(towerCrownRingGeo, mats.champagneGold));

    const towerCrownSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.28, 1.35, 5));
    towerCrownSpireGeo.translate(0, 0.675, 0);
    const towerCrownGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.18, 0));
    for (let tc = 0; tc < 8; tc++) {
      const cAng = (tc * Math.PI * 2) / 8;
      const pk = new THREE.Mesh(towerCrownSpireGeo, mats.champagneGold);
      pk.position.set(Math.cos(cAng) * 3.25, 21.85, Math.sin(cAng) * 3.25);
      pk.rotation.y = -cAng;
      const gm = new THREE.Mesh(towerCrownGemGeo, mats.warmLanternGlow);
      gm.position.set(Math.cos(cAng) * 3.32, 21.75, Math.sin(cAng) * 3.32);
      tGroup.add(pk, gm);
    }

    // Crystal Finial & Pastel Silk Flag atop the tower spire (y = 30.9..32.6)
    const finialPole = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.04, 0.06, 1.8, 8)).translate(0, 31.3, 0),
      mats.champagneGold,
    );
    const finialCrystal = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(0.32, 0)).translate(0, 32.3, 0),
      mats.crystalGlass,
    );
    const flagPennantGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 1.35, 4));
    flagPennantGeo.rotateZ(-Math.PI / 2);
    flagPennantGeo.translate(0.7, 31.85, 0);
    const flagPennant = new THREE.Mesh(flagPennantGeo, mats.blushRoseMarble);
    tGroup.add(finialPole, finialCrystal, flagPennant);

    // Heart Window & Medallion on each tower's outward-facing facade
    const outZSign = tp.lz < 0 ? -1 : 1;
    const heartWinGroup = new THREE.Group();
    heartWinGroup.position.set(0, 13.5, outZSign * 3.22);
    if (outZSign > 0) heartWinGroup.rotation.y = Math.PI;
    const lobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.42, 10, 10));
    const lobeL = new THREE.Mesh(lobeGeo, mats.champagneGold);
    lobeL.position.set(-0.32, 0.35, 0);
    const lobeR = new THREE.Mesh(lobeGeo, mats.champagneGold);
    lobeR.position.set(0.32, 0.35, 0);
    const pointGeo = tracker.trackGeo(new THREE.ConeGeometry(0.62, 0.95, 10));
    pointGeo.rotateX(Math.PI);
    const pointM = new THREE.Mesh(pointGeo, mats.champagneGold);
    pointM.position.set(0, -0.1, 0);
    const glassPaneGeo = tracker.trackGeo(new THREE.CircleGeometry(0.55, 12));
    const glassPane = new THREE.Mesh(glassPaneGeo, mats.warmLanternGlow);
    glassPane.position.set(0, 0.15, -0.05);
    heartWinGroup.add(lobeL, lobeR, pointM, glassPane);
    tGroup.add(heartWinGroup);

    group.add(tGroup);

    colliders.push({
      x: nav.originX + tp.lx,
      z: nav.originZ + tp.lz,
      radius: 3.3,
    });
  });

  // Exterior Perimeter Walls
  const wallFrontLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 16.0, 1.2));
  wallFrontLeftGeo.translate(-9.5, 8.0, -16.0);
  const wallFrontRightGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 16.0, 1.2));
  wallFrontRightGeo.translate(9.5, 8.0, -16.0);

  const wallDoorFlankLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(1.92, 16.0, 1.2));
  wallDoorFlankLeftGeo.translate(-3.05, 8.0, -16.0);
  const wallDoorFlankRightGeo = tracker.trackGeo(new THREE.BoxGeometry(1.92, 16.0, 1.2));
  wallDoorFlankRightGeo.translate(3.05, 8.0, -16.0);

  // Doorway arch opening raised to y = 7.2m; upper transom (y = 7.2..14.0, lx = -2.4..+2.4) uses translucent crystalGlass
  const wallDoorUpperTransomGeo = tracker.trackGeo(new THREE.BoxGeometry(4.8, 6.8, 0.36));
  wallDoorUpperTransomGeo.translate(0, 10.6, -16.0);

  const wallBackLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(12.2, 16.0, 1.2));
  wallBackLeftGeo.translate(-8.9, 8.0, 16.0);
  const wallBackRightGeo = tracker.trackGeo(new THREE.BoxGeometry(12.2, 16.0, 1.2));
  wallBackRightGeo.translate(8.9, 8.0, 16.0);
  const wallBackUpperTransomGeo = tracker.trackGeo(new THREE.BoxGeometry(5.6, 11.0, 1.2));
  wallBackUpperTransomGeo.translate(0, 10.5, 16.0);

  const wallSideLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 16.0, 30.0));
  wallSideLeftGeo.translate(-16.0, 8.0, 0);
  const wallSideRightGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 16.0, 30.0));
  wallSideRightGeo.translate(16.0, 8.0, 0);

  const wallFL = new THREE.Mesh(wallFrontLeftGeo, mats.pearlWhite);
  const wallFR = new THREE.Mesh(wallFrontRightGeo, mats.pearlWhite);
  const wallDFL = new THREE.Mesh(wallDoorFlankLeftGeo, mats.pearlWhite);
  const wallDFR = new THREE.Mesh(wallDoorFlankRightGeo, mats.pearlWhite);
  const wallDUT = new THREE.Mesh(wallDoorUpperTransomGeo, mats.crystalGlass);
  wallDUT.updateMatrix();
  wallDUT.matrixAutoUpdate = false;
  group.add(wallDUT);

  const wallBL = new THREE.Mesh(wallBackLeftGeo, mats.pearlWhite);
  const wallBR = new THREE.Mesh(wallBackRightGeo, mats.pearlWhite);
  const wallBUT = new THREE.Mesh(wallBackUpperTransomGeo, mats.pearlWhite);
  const wallSL = new THREE.Mesh(wallSideLeftGeo, mats.pearlWhite);
  const wallSR = new THREE.Mesh(wallSideRightGeo, mats.pearlWhite);
  [wallFL, wallFR, wallDFL, wallDFR, wallBL, wallBR, wallBUT, wallSL, wallSR].forEach((w) => {
    w.castShadow = true;
    w.receiveShadow = true;
    w.updateMatrix();
    w.matrixAutoUpdate = false;
    group.add(w);
    cameraOccluders.push(w);
  });

  // Detailed 3D Relief Carvings & Niches
  const reliefBackplateGeo = tracker.trackGeo(new THREE.BoxGeometry(1.48, 4.15, 0.14));
  const reliefFramePillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 3.7, 10));
  const reliefArchCrownGeo = tracker.trackGeo(new THREE.TorusGeometry(0.68, 0.085, 10, 20, Math.PI));
  const reliefPedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.42, 0.52, 0.28, 14));
  const dollSkirtLowerGeo = tracker.trackGeo(new THREE.ConeGeometry(0.46, 1.18, 16));
  const dollSkirtMidGeo = tracker.trackGeo(new THREE.ConeGeometry(0.36, 0.82, 16));
  const dollPeplumGeo = tracker.trackGeo(new THREE.SphereGeometry(0.24, 12, 10));
  dollPeplumGeo.scale(1.15, 0.65, 0.72);
  const dollWaistSashGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.038, 8, 16));
  dollWaistSashGeo.rotateX(Math.PI / 2);
  const dollBodiceGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.16, 0.12, 0.52, 12));
  const dollNeckGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.18, 10));
  const dollHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.155, 14, 14));
  const dollHairCrownGeo = tracker.trackGeo(new THREE.SphereGeometry(0.17, 12, 12));
  const dollPonytailGeo = tracker.trackGeo(new THREE.ConeGeometry(0.13, 0.58, 12));
  const dollTiaraGeo = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.22, 5));
  const dollArmGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.042, 0.036, 0.56, 8));
  const dollWandShaftGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 6));
  const dollStarFinialGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.095, 0));
  const upperCameoFrameGeo = tracker.trackGeo(new THREE.TorusGeometry(0.52, 0.065, 10, 24));
  const upperCameoPlateGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20));
  upperCameoPlateGeo.rotateX(Math.PI / 2);

  [-3.05, 3.05].forEach((rx, sideIdx) => {
    const isLeft = sideIdx === 0;
    const mirror = isLeft ? 1 : -1;

    [-16.64, -15.36].forEach((rz, faceIdx) => {
      const faceDir = faceIdx === 0 ? -1 : 1;
      const reliefGroup = new THREE.Group();
      reliefGroup.position.set(rx, 0.25, rz);
      if (faceDir === 1) {
        reliefGroup.rotation.y = Math.PI;
      }

      const backplate = new THREE.Mesh(reliefBackplateGeo, mats.blushRoseMarble);
      backplate.position.set(0, 2.25, 0);
      const pillarL = new THREE.Mesh(reliefFramePillarGeo, mats.champagneGold);
      pillarL.position.set(-0.68, 2.05, -0.05);
      const pillarR = new THREE.Mesh(reliefFramePillarGeo, mats.champagneGold);
      pillarR.position.set(0.68, 2.05, -0.05);
      const archCrown = new THREE.Mesh(reliefArchCrownGeo, mats.champagneGold);
      archCrown.position.set(0, 3.88, -0.06);

      const pedestal = new THREE.Mesh(reliefPedestalGeo, mats.champagneGold);
      pedestal.position.set(0, 0.42, -0.12);

      const dollGroup = new THREE.Group();
      dollGroup.position.set(0, 0.56, -0.14);
      dollGroup.rotation.y = mirror * 0.18;

      const skirtLower = new THREE.Mesh(dollSkirtLowerGeo, mats.blushRoseMarble);
      skirtLower.position.set(0, 0.58, 0);
      skirtLower.scale.set(1.05, 1.0, 0.68);

      const skirtMid = new THREE.Mesh(dollSkirtMidGeo, mats.softLavender);
      skirtMid.position.set(0, 0.92, -0.02);
      skirtMid.scale.set(1.0, 1.0, 0.68);

      const peplum = new THREE.Mesh(dollPeplumGeo, mats.champagneGold);
      peplum.position.set(0, 1.24, -0.02);

      const waistSash = new THREE.Mesh(dollWaistSashGeo, mats.champagneGold);
      waistSash.position.set(0, 1.32, -0.02);

      const bodice = new THREE.Mesh(dollBodiceGeo, mats.blushRoseMarble);
      bodice.position.set(0, 1.56, -0.02);
      bodice.scale.set(1.05, 1.0, 0.74);

      const neck = new THREE.Mesh(dollNeckGeo, mats.pearlWhite);
      neck.position.set(0, 1.88, -0.02);

      const head = new THREE.Mesh(dollHeadGeo, mats.pearlWhite);
      head.position.set(0, 2.06, -0.03);
      head.scale.set(0.92, 1.06, 0.86);

      const hairCrown = new THREE.Mesh(dollHairCrownGeo, mats.champagneGold);
      hairCrown.position.set(0, 2.11, 0.02);
      hairCrown.scale.set(0.96, 1.02, 0.88);

      const ponytail = new THREE.Mesh(dollPonytailGeo, mats.champagneGold);
      ponytail.position.set(-mirror * 0.14, 2.02, 0.08);
      ponytail.rotation.z = mirror * 0.55;
      ponytail.rotation.x = 2.45;

      const tiara = new THREE.Mesh(dollTiaraGeo, mats.warmLanternGlow);
      tiara.position.set(0, 2.28, -0.05);
      tiara.scale.set(1.0, 1.0, 0.55);

      const armInner = new THREE.Mesh(dollArmGeo, mats.pearlWhite);
      armInner.position.set(mirror * 0.22, 1.62, -0.08);
      armInner.rotation.z = -mirror * 0.52;
      armInner.rotation.x = -0.35;

      const armOuter = new THREE.Mesh(dollArmGeo, mats.pearlWhite);
      armOuter.position.set(-mirror * 0.21, 1.52, -0.04);
      armOuter.rotation.z = mirror * 0.36;

      const wandShaft = new THREE.Mesh(dollWandShaftGeo, mats.champagneGold);
      wandShaft.position.set(mirror * 0.36, 1.88, -0.15);
      wandShaft.rotation.z = -mirror * 0.22;

      const wandStar = new THREE.Mesh(dollStarFinialGeo, mats.warmLanternGlow);
      wandStar.position.set(mirror * 0.43, 2.22, -0.16);

      dollGroup.add(
        skirtLower,
        skirtMid,
        peplum,
        waistSash,
        bodice,
        neck,
        head,
        hairCrown,
        ponytail,
        tiara,
        armInner,
        armOuter,
        wandShaft,
        wandStar,
      );

      const cameoPlate = new THREE.Mesh(upperCameoPlateGeo, mats.softLavender);
      cameoPlate.position.set(0, 4.95, -0.03);
      const cameoFrame = new THREE.Mesh(upperCameoFrameGeo, mats.champagneGold);
      cameoFrame.position.set(0, 4.95, -0.06);
      const cameoStar = new THREE.Mesh(dollStarFinialGeo, mats.champagneGold);
      cameoStar.position.set(0, 4.95, -0.09);
      cameoStar.scale.set(2.2, 2.6, 0.8);

      reliefGroup.add(
        backplate,
        pillarL,
        pillarR,
        archCrown,
        pedestal,
        dollGroup,
        cameoPlate,
        cameoFrame,
        cameoStar,
      );
      group.add(reliefGroup);
    });
  });

  // Dense overlapping perimeter wall colliders (1.2m thick wall barrier, zero gaps)
  [-13.6, -12.2, -10.8, -9.4, -8.0, -6.6, -5.2, -3.9, -2.9, 2.9, 3.9, 5.2, 6.6, 8.0, 9.4, 10.8, 12.2, 13.6].forEach(
    (wx) => {
      colliders.push({ x: nav.originX + wx, z: nav.originZ - 16.0, radius: 0.92 });
    },
  );

  // Rear wall colliders with open Rear Center Portal (lx: -2.4..+2.4)
  [-13.6, -12.2, -10.8, -9.4, -8.0, -6.6, -5.2, -3.9, -3.0, 3.0, 3.9, 5.2, 6.6, 8.0, 9.4, 10.8, 12.2, 13.6].forEach(
    (wx) => {
      colliders.push({ x: nav.originX + wx, z: nav.originZ + 16.0, radius: 0.92 });
    },
  );

  // Left and Right outer wall colliders along x = -16.0 and x = +16.0 (every 1.3m so zero gaps exist)
  [
    -13.5, -12.2, -10.9, -9.6, -8.3, -7.0, -5.7, -4.4, -3.1, -1.8, -0.6, 0.6, 1.8, 3.1, 4.4, 5.7, 7.0, 8.3, 9.6, 10.9,
    12.2, 13.5,
  ].forEach((wz) => {
    colliders.push({ x: nav.originX - 16.0, z: nav.originZ + wz, radius: 0.92 });
    colliders.push({ x: nav.originX + 16.0, z: nav.originZ + wz, radius: 0.92 });
  });

  // ========================================================================
  // 3. BARBIE DREAMHOUSE ROYAL ARCHED DOUBLE ENTRANCE DOORS & BARRIER
  // ========================================================================
  const doorBarrierColliders: CircleCollider[] = [
    { x: nav.originX - 1.35, z: nav.originZ - 16.0, radius: 0.95 },
    { x: nav.originX, z: nav.originZ - 16.0, radius: 0.95 },
    { x: nav.originX + 1.35, z: nav.originZ - 16.0, radius: 0.95 },
  ];
  doorBarrierColliders.forEach((c) => colliders.push(c));
  let doorBarrierRemoved = false;

  const barbiePinkMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e11d48'),
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 0.45,
      clearcoatRoughness: 0.16,
    }),
  );
  const pastelBlushMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fda4af'),
      roughness: 0.4,
      metalness: 0.05,
    }),
  );

  // Shared Barbie Door Geometries
  const doorBaseLeafGeo = tracker.trackGeo(new THREE.BoxGeometry(2.08, 3.65, 0.18));
  doorBaseLeafGeo.translate(0, 1.825, 0);
  const doorArchCrownGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.04, 1.04, 0.18, 24, 1, false, 0, Math.PI),
  );
  doorArchCrownGeo.rotateZ(Math.PI / 2);
  doorArchCrownGeo.rotateY(Math.PI / 2);

  const doorOuterGoldStileVGeo = tracker.trackGeo(new THREE.BoxGeometry(0.09, 3.62, 0.21));
  const doorOuterGoldRailHGeo = tracker.trackGeo(new THREE.BoxGeometry(1.96, 0.09, 0.21));
  const doorArchGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(0.98, 0.055, 10, 24, Math.PI));
  const doorScallopBeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 8, 8));

  // Quilted Inset Panels & Gold Star Studs
  const quiltUpperPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(1.56, 1.82, 0.2));
  const quiltLowerPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(1.56, 1.12, 0.2));
  const quiltFrameUpperVGeo = tracker.trackGeo(new THREE.BoxGeometry(0.055, 1.88, 0.22));
  const quiltFrameLowerVGeo = tracker.trackGeo(new THREE.BoxGeometry(0.055, 1.18, 0.22));
  const quiltFrameHGeo = tracker.trackGeo(new THREE.BoxGeometry(1.62, 0.055, 0.22));
  const quiltRibbonDiagGeo = tracker.trackGeo(new THREE.BoxGeometry(0.028, 0.72, 0.215));
  const goldStarStudGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.048, 0));

  // Heart Medallion & Bow Handle Geometries
  const heartLobeSmallGeo = tracker.trackGeo(new THREE.SphereGeometry(0.085, 10, 10));
  const heartPointSmallGeo = tracker.trackGeo(new THREE.ConeGeometry(0.125, 0.19, 10));
  heartPointSmallGeo.rotateX(Math.PI);

  const bowEscutcheonGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16));
  bowEscutcheonGeo.rotateX(Math.PI / 2);
  const bowLoopGeo = tracker.trackGeo(new THREE.TorusGeometry(0.105, 0.028, 8, 16));
  bowLoopGeo.scale(1.25, 0.78, 0.65);
  const bowKnotGeo = tracker.trackGeo(new THREE.SphereGeometry(0.048, 10, 10));
  const bowTailGeo = tracker.trackGeo(new THREE.BoxGeometry(0.036, 0.22, 0.02));
  const dropletStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6));

  const buildSculptedHeart = (scale: number, mat: THREE.Material): THREE.Group => {
    const hg = new THREE.Group();
    const lL = new THREE.Mesh(heartLobeSmallGeo, mat);
    lL.position.set(-0.062, 0.055, 0);
    const lR = new THREE.Mesh(heartLobeSmallGeo, mat);
    lR.position.set(0.062, 0.055, 0);
    const pt = new THREE.Mesh(heartPointSmallGeo, mat);
    pt.position.set(0, -0.038, 0);
    hg.add(lL, lR, pt);
    hg.scale.setScalar(scale);
    return hg;
  };

  const buildBowHandleGroup = (isLeft: boolean): THREE.Group => {
    const handlePivot = new THREE.Group();
    const dir = isLeft ? -1 : 1;

    const escutcheon = new THREE.Mesh(bowEscutcheonGeo, mats.champagneGold);
    handlePivot.add(escutcheon);

    // Mount sculpted bow & hanging heart droplet on both exterior (-Z) and interior (+Z) faces
    [-0.14, 0.14].forEach((zFace) => {
      const bowAssembly = new THREE.Group();
      bowAssembly.position.set(dir * 0.12, 0, zFace);

      const loopL = new THREE.Mesh(bowLoopGeo, mats.champagneGold);
      loopL.position.set(-0.1, 0.03, 0);
      loopL.rotation.z = 0.28;
      const loopR = new THREE.Mesh(bowLoopGeo, mats.champagneGold);
      loopR.position.set(0.1, 0.03, 0);
      loopR.rotation.z = -0.28;

      const knot = new THREE.Mesh(bowKnotGeo, mats.champagneGold);
      const tailL = new THREE.Mesh(bowTailGeo, mats.champagneGold);
      tailL.position.set(-0.06, -0.11, 0);
      tailL.rotation.z = 0.32;
      const tailR = new THREE.Mesh(bowTailGeo, mats.champagneGold);
      tailR.position.set(0.06, -0.11, 0);
      tailR.rotation.z = -0.32;

      const dropStem = new THREE.Mesh(dropletStemGeo, mats.champagneGold);
      dropStem.position.set(0, -0.1, 0);
      const heartDrop = buildSculptedHeart(0.62, barbiePinkMat);
      heartDrop.position.set(0, -0.19, 0);
      const heartDropRim = buildSculptedHeart(0.72, mats.champagneGold);
      heartDropRim.position.set(0, -0.19, -Math.sign(zFace) * 0.008);

      bowAssembly.add(loopL, loopR, knot, tailL, tailR, dropStem, heartDropRim, heartDrop);
      handlePivot.add(bowAssembly);
    });

    return handlePivot;
  };

  const populateBarbieDoorLeaf = (pivot: THREE.Group, isLeft: boolean) => {
    const cx = isLeft ? 1.04 : -1.04;

    // 1. Glossy Barbie Pink Door Leaf & Arched Crown
    const baseLeaf = new THREE.Mesh(doorBaseLeafGeo, barbiePinkMat);
    baseLeaf.position.set(cx, 0, 0);
    baseLeaf.castShadow = true;
    baseLeaf.receiveShadow = true;

    const archCrown = new THREE.Mesh(doorArchCrownGeo, barbiePinkMat);
    archCrown.position.set(cx, 3.65, 0);
    archCrown.castShadow = true;

    // 2. Gold Leaf Perimeter Stile & Scalloped Arch Trim
    const stileOuter = new THREE.Mesh(doorOuterGoldStileVGeo, mats.champagneGold);
    stileOuter.position.set(cx - (isLeft ? 0.96 : -0.96), 1.82, 0);
    const stileInner = new THREE.Mesh(doorOuterGoldStileVGeo, mats.champagneGold);
    stileInner.position.set(cx + (isLeft ? 0.96 : -0.96), 1.82, 0);
    const railBottom = new THREE.Mesh(doorOuterGoldRailHGeo, mats.champagneGold);
    railBottom.position.set(cx, 0.08, 0);
    const railMid = new THREE.Mesh(doorOuterGoldRailHGeo, mats.champagneGold);
    railMid.position.set(cx, 1.52, 0);

    const archRim = new THREE.Mesh(doorArchGoldRimGeo, mats.champagneGold);
    archRim.position.set(cx, 3.65, 0);

    pivot.add(baseLeaf, archCrown, stileOuter, stileInner, railBottom, railMid, archRim);

    // Scalloped gold beads along the arch curve
    for (let b = 0; b <= 8; b++) {
      const ang = (b / 8) * Math.PI;
      const bead = new THREE.Mesh(doorScallopBeadGeo, mats.champagneGold);
      bead.position.set(cx + Math.cos(ang) * 0.88, 3.65 + Math.sin(ang) * 0.88, 0);
      pivot.add(bead);
    }

    // 3. Pastel Blush Quilted Inset Panels + Gold Lattice & Star Studs
    const upperPanel = new THREE.Mesh(quiltUpperPanelGeo, pastelBlushMat);
    upperPanel.position.set(cx, 2.58, 0);
    const lowerPanel = new THREE.Mesh(quiltLowerPanelGeo, pastelBlushMat);
    lowerPanel.position.set(cx, 0.78, 0);

    const qfUL = new THREE.Mesh(quiltFrameUpperVGeo, mats.champagneGold);
    qfUL.position.set(cx - 0.78, 2.58, 0);
    const qfUR = new THREE.Mesh(quiltFrameUpperVGeo, mats.champagneGold);
    qfUR.position.set(cx + 0.78, 2.58, 0);
    const qfUT = new THREE.Mesh(quiltFrameHGeo, mats.champagneGold);
    qfUT.position.set(cx, 3.49, 0);
    const qfUB = new THREE.Mesh(quiltFrameHGeo, mats.champagneGold);
    qfUB.position.set(cx, 1.67, 0);

    const qfLL = new THREE.Mesh(quiltFrameLowerVGeo, mats.champagneGold);
    qfLL.position.set(cx - 0.78, 0.78, 0);
    const qfLR = new THREE.Mesh(quiltFrameLowerVGeo, mats.champagneGold);
    qfLR.position.set(cx + 0.78, 0.78, 0);
    const qfLT = new THREE.Mesh(quiltFrameHGeo, mats.champagneGold);
    qfLT.position.set(cx, 1.34, 0);
    const qfLB = new THREE.Mesh(quiltFrameHGeo, mats.champagneGold);
    qfLB.position.set(cx, 0.22, 0);

    pivot.add(upperPanel, lowerPanel, qfUL, qfUR, qfUT, qfUB, qfLL, qfLR, qfLT, qfLB);

    // Quilted diamond lattice strips & gold star studs
    const upperStudY = [2.05, 2.58, 3.11];
    const studXOffsets = [-0.44, 0.0, 0.44];
    for (const sy of upperStudY) {
      for (const sxOff of studXOffsets) {
        const d1 = new THREE.Mesh(quiltRibbonDiagGeo, mats.champagneGold);
        d1.position.set(cx + sxOff, sy, 0);
        d1.rotation.z = Math.PI / 4;
        const d2 = new THREE.Mesh(quiltRibbonDiagGeo, mats.champagneGold);
        d2.position.set(cx + sxOff, sy, 0);
        d2.rotation.z = -Math.PI / 4;
        const stud = new THREE.Mesh(goldStarStudGeo, mats.champagneGold);
        stud.position.set(cx + sxOff, sy, 0);
        stud.scale.set(1.1, 1.1, 2.6);
        pivot.add(d1, d2, stud);
      }
    }

    const lowerStudY = [0.54, 1.02];
    for (const sy of lowerStudY) {
      for (const sxOff of studXOffsets) {
        const d1 = new THREE.Mesh(quiltRibbonDiagGeo, mats.champagneGold);
        d1.position.set(cx + sxOff, sy, 0);
        d1.rotation.z = Math.PI / 4;
        const d2 = new THREE.Mesh(quiltRibbonDiagGeo, mats.champagneGold);
        d2.position.set(cx + sxOff, sy, 0);
        d2.rotation.z = -Math.PI / 4;
        const stud = new THREE.Mesh(goldStarStudGeo, mats.champagneGold);
        stud.position.set(cx + sxOff, sy, 0);
        stud.scale.set(1.1, 1.1, 2.6);
        pivot.add(d1, d2, stud);
      }
    }

    // Center Arched Heart Cameo on upper crown
    [-0.1, 0.1].forEach((zSide) => {
      const crownHeartGold = buildSculptedHeart(1.45, mats.champagneGold);
      crownHeartGold.position.set(cx, 3.92, zSide);
      const crownHeartPink = buildSculptedHeart(1.1, barbiePinkMat);
      crownHeartPink.position.set(cx, 3.92, zSide + Math.sign(zSide) * 0.015);
      pivot.add(crownHeartGold, crownHeartPink);
    });
  };

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-2.1, 0.25, -16.0);
  populateBarbieDoorLeaf(leftDoorPivot, true);
  const leftDoorHandle = buildBowHandleGroup(true);
  leftDoorHandle.position.set(1.84, 2.02, 0);
  leftDoorPivot.add(leftDoorHandle);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(2.1, 0.25, -16.0);
  populateBarbieDoorLeaf(rightDoorPivot, false);
  const rightDoorHandle = buildBowHandleGroup(false);
  rightDoorHandle.position.set(-1.84, 2.02, 0);
  rightDoorPivot.add(rightDoorHandle);

  group.add(leftDoorPivot, rightDoorPivot);

  // 4. Royal Transom Crest with Glowing Frosted Glass Fanlight & Filigree Wings (raised to y = 7.2m)
  const transomGroup = new THREE.Group();
  transomGroup.position.set(0, 7.2, -16.0);

  const archHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(4.85, 0.42, 0.86));
  const archHeader = new THREE.Mesh(archHeaderGeo, mats.champagneGold);
  transomGroup.add(archHeader);

  const fanlightBackingGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.12, 2.12, 0.26, 28, 1, false, 0, Math.PI),
  );
  fanlightBackingGeo.rotateZ(Math.PI / 2);
  fanlightBackingGeo.rotateY(Math.PI / 2);
  const fanlightGlass = new THREE.Mesh(fanlightBackingGeo, mats.warmLanternGlow);
  fanlightGlass.position.set(0, 0.18, 0);
  transomGroup.add(fanlightGlass);

  const fanlightOuterArchGeo = tracker.trackGeo(new THREE.TorusGeometry(2.15, 0.12, 12, 32, Math.PI));
  const fanlightInnerArchGeo = tracker.trackGeo(new THREE.TorusGeometry(1.42, 0.06, 10, 28, Math.PI));
  const fanlightOuterArch = new THREE.Mesh(fanlightOuterArchGeo, mats.champagneGold);
  fanlightOuterArch.position.set(0, 0.18, -0.32);
  const fanlightInnerArch = new THREE.Mesh(fanlightInnerArchGeo, mats.champagneGold);
  fanlightInnerArch.position.set(0, 0.18, -0.34);
  const fanlightOuterArchBack = new THREE.Mesh(fanlightOuterArchGeo, mats.champagneGold);
  fanlightOuterArchBack.position.set(0, 0.18, 0.32);
  transomGroup.add(fanlightOuterArch, fanlightInnerArch, fanlightOuterArchBack);

  const fanRayGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 2.05, 8));
  fanRayGeo.translate(0, 1.025, 0);
  for (let r = 1; r <= 5; r++) {
    const ang = (r / 6) * Math.PI - Math.PI / 2;
    const ray = new THREE.Mesh(fanRayGeo, mats.champagneGold);
    ray.position.set(0, 0.18, -0.34);
    ray.rotation.z = ang;
    transomGroup.add(ray);
  }

  // Sculpted Golden Barbie Heart Crest with Filigree Wings
  const crestCenter = new THREE.Group();
  crestCenter.position.set(0, 1.05, -0.44);

  const crestGoldHeart = buildSculptedHeart(3.4, mats.champagneGold);
  const crestPinkHeart = buildSculptedHeart(2.55, barbiePinkMat);
  crestPinkHeart.position.z = -0.05;
  const crestInnerBlushHeart = buildSculptedHeart(1.5, pastelBlushMat);
  crestInnerBlushHeart.position.z = -0.09;
  crestCenter.add(crestGoldHeart, crestPinkHeart, crestInnerBlushHeart);

  // Filigree Wings flanking the heart crest
  const wingFeatherGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.78, 8));
  wingFeatherGeo.translate(0, 0.39, 0);
  [-1, 1].forEach((side) => {
    for (let f = 0; f < 4; f++) {
      const feather = new THREE.Mesh(wingFeatherGeo, mats.champagneGold);
      feather.position.set(side * (0.34 + f * 0.14), 0.05 - f * 0.06, 0.02);
      feather.rotation.z = -side * (1.08 + f * 0.16);
      feather.scale.set(1.0, 1.15 - f * 0.16, 0.55);
      crestCenter.add(feather);
    }
  });

  // Mini Royal Tiara atop the Heart Crest
  const crestTiaraSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.055, 0.28, 6));
  [-0.14, -0.07, 0, 0.07, 0.14].forEach((tx, idx) => {
    const spire = new THREE.Mesh(crestTiaraSpireGeo, mats.champagneGold);
    const hScale = idx === 2 ? 1.35 : idx === 1 || idx === 3 ? 1.05 : 0.8;
    spire.scale.set(1.0, hScale, 0.7);
    spire.position.set(tx, 0.54 + hScale * 0.06, -0.04);
    spire.rotation.z = -tx * 1.2;
    crestCenter.add(spire);
  });

  transomGroup.add(crestCenter);
  group.add(transomGroup);

  // ========================================================================
  // 4. LEVEL 1: GRAND ENTRANCE HALL, FOUNTAIN HOLOGRAM & CHANDELIER
  // ========================================================================
  // Main Floor 1 Marble Slab: top surface at exact y = +0.25m
  const floor1Geo = tracker.trackGeo(new THREE.BoxGeometry(31.0, 0.4, 31.0));
  floor1Geo.translate(0, 0.05, 0);
  const floor1Mesh = new THREE.Mesh(floor1Geo, mats.blushRoseMarble);
  floor1Mesh.receiveShadow = true;
  group.add(floor1Mesh);

  // Carpets, Runners, and Medallions sit at y = 0.275m - 0.285m with polygonOffset enabled to prevent Z-fighting
  const carpetOverlayMat = tracker.trackMat(
    mats.velvetPlum.clone(),
  );
  carpetOverlayMat.polygonOffset = true;
  carpetOverlayMat.polygonOffsetFactor = -1;
  carpetOverlayMat.polygonOffsetUnits = -1;

  const medallionPearlOverlayMat = tracker.trackMat(
    mats.pearlWhite.clone(),
  );
  medallionPearlOverlayMat.polygonOffset = true;
  medallionPearlOverlayMat.polygonOffsetFactor = -1;
  medallionPearlOverlayMat.polygonOffsetUnits = -1;

  const medallionGoldOverlayMat = tracker.trackMat(
    mats.champagneGold.clone(),
  );
  medallionGoldOverlayMat.polygonOffset = true;
  medallionGoldOverlayMat.polygonOffsetFactor = -2;
  medallionGoldOverlayMat.polygonOffsetUnits = -2;

  const carpetGeo = tracker.trackGeo(new THREE.BoxGeometry(3.6, 0.02, 18.0));
  carpetGeo.translate(0, 0.275, -5.0);
  const carpetMesh = new THREE.Mesh(carpetGeo, carpetOverlayMat);
  carpetMesh.receiveShadow = true;
  group.add(carpetMesh);

  const medallionOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(4.8, 4.8, 0.024, 32));
  medallionOuterGeo.translate(0, 0.275, 0);
  const medallionInnerGeo = tracker.trackGeo(new THREE.TorusGeometry(4.2, 0.08, 8, 36));
  medallionInnerGeo.rotateX(Math.PI / 2);
  medallionInnerGeo.translate(0, 0.285, 0);
  const medallionOuter = new THREE.Mesh(medallionOuterGeo, medallionPearlOverlayMat);
  medallionOuter.receiveShadow = true;
  const medallionInner = new THREE.Mesh(medallionInnerGeo, medallionGoldOverlayMat);
  group.add(medallionOuter, medallionInner);

  // Gilded Archway Portals into the 6 Floor 1 Alcove Rooms (pushed outward to |lx| = 9.2, clear of staircases)
  const roomArchPillarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 3.8, 0.42));
  roomArchPillarGeo.translate(0, 2.15, 0);
  const roomArchHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.55, 2.9));
  roomArchHeaderGeo.translate(0, 4.15, 0);
  [-9.2, 9.2].forEach((wx) => {
    [-11.4, 0.0, 11.4].forEach((wz) => {
      const p1 = new THREE.Mesh(roomArchPillarGeo, mats.champagneGold);
      p1.position.set(wx, 0, wz - 1.25);
      p1.updateMatrix();
      p1.matrixAutoUpdate = false;
      const p2 = new THREE.Mesh(roomArchPillarGeo, mats.champagneGold);
      p2.position.set(wx, 0, wz + 1.25);
      p2.updateMatrix();
      p2.matrixAutoUpdate = false;
      const hdr = new THREE.Mesh(roomArchHeaderGeo, mats.blushRoseMarble);
      hdr.position.set(wx, 0, wz);
      hdr.updateMatrix();
      hdr.matrixAutoUpdate = false;
      group.add(p1, p2, hdr);
    });
  });

  // Central Crystal Lotus Water Fountain
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, 0.25, 0);

  const basinOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.8, 3.1, 0.75, 24));
  basinOuterGeo.translate(0, 0.375, 0);
  const basinRimGeo = tracker.trackGeo(new THREE.TorusGeometry(2.9, 0.16, 8, 32));
  basinRimGeo.rotateX(Math.PI / 2);
  basinRimGeo.translate(0, 0.75, 0);
  const waterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32));
  waterGeo.translate(0, 0.65, 0);

  const fountainWaterUniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 0.0 },
  };
  const fountainWaterShaderMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: fountainWaterUniforms,
      transparent: true,
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec3 vLocalPos;
        void main() {
          float r = length(vLocalPos.xz);
          float speed = mix(2.4, 6.2, uIntensity);
          float freq = mix(5.5, 10.5, uIntensity);
          float wave1 = sin(r * freq - uTime * speed) * 0.5 + 0.5;
          float wave2 = sin(r * (freq * 1.45) - uTime * (speed * 1.25) + 1.2) * 0.5 + 0.5;
          float ripple = pow(wave1 * wave2, mix(2.2, 1.35, uIntensity));

          vec3 baseWater = vec3(0.48, 0.84, 0.96);
          vec3 cyanGlow = vec3(0.22, 0.78, 0.98);
          vec3 goldCrest = vec3(0.99, 0.91, 0.52);

          vec3 col = mix(baseWater, cyanGlow, ripple * (0.45 + 0.55 * uIntensity));
          col = mix(col, goldCrest, pow(ripple, 2.0) * (0.28 + 0.65 * uIntensity));
          float centerGlow = smoothstep(1.6, 0.0, r) * uIntensity * 0.55;
          col += goldCrest * centerGlow;

          float alpha = mix(0.84, 0.95, uIntensity);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );

  const basinOuter = new THREE.Mesh(basinOuterGeo, mats.blushRoseMarble);
  const basinRim = new THREE.Mesh(basinRimGeo, mats.champagneGold);
  const waterMesh = new THREE.Mesh(waterGeo, fountainWaterShaderMat);
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;

  const rippleRingGeo = tracker.trackGeo(new THREE.TorusGeometry(1.0, 0.045, 8, 32));
  rippleRingGeo.rotateX(Math.PI / 2);
  const rippleRingMesh = new THREE.Mesh(rippleRingGeo, mats.warmLanternGlow);
  rippleRingMesh.position.set(0, 0.72, 0);
  rippleRingMesh.visible = false;

  // Hologram Projector Group
  const hologramGroup = new THREE.Group();
  hologramGroup.position.set(0, 0.7, 0);
  hologramGroup.visible = false;

  const beamUniforms = {
    uTime: { value: 0.0 },
    uAlpha: { value: 0.0 },
  };
  const beamMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          float vertFade = sin(vUv.y * 3.14159265) * (1.0 - vUv.y * 0.35);
          float shimmer = 0.82 + 0.18 * sin(vUv.y * 18.0 - uTime * 4.5 + vUv.x * 12.56);
          vec3 cyanCol = vec3(0.25, 0.82, 0.98);
          vec3 goldCol = vec3(0.99, 0.89, 0.48);
          vec3 col = mix(goldCol, cyanCol, vUv.y);
          gl_FragColor = vec4(col, vertFade * shimmer * 0.36 * uAlpha);
        }
      `,
    }),
  );
  const beamGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.25, 0.42, 3.8, 28, 1, true));
  beamGeo.translate(0, 1.9, 0);
  const hologramBeamMesh = new THREE.Mesh(beamGeo, beamMat);
  hologramGroup.add(hologramBeamMesh);

  const hologramTex = createFountainHologramTexture(tracker);
  // Strictly THREE.FrontSide with front & back planes so 'Yeshwanth & Harsha' is NEVER mirrored
  const hologramPlaneMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: hologramTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  const hologramBackdropMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: hologramTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );

  const backglowCanvas = document.createElement('canvas');
  backglowCanvas.width = 128;
  backglowCanvas.height = 128;
  const bgCtx = backglowCanvas.getContext('2d');
  if (bgCtx) {
    const g = bgCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0.0, 'rgba(254, 240, 138, 0.95)');
    g.addColorStop(0.45, 'rgba(56, 189, 248, 0.65)');
    g.addColorStop(0.8, 'rgba(14, 165, 233, 0.22)');
    g.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, 128, 128);
  }
  const backglowTex = tracker.trackTex(new THREE.CanvasTexture(backglowCanvas));
  const hologramBacklightMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: backglowTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  const hologramBacklightGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.15, 3.75));
  const hologramBacklightMesh = new THREE.Mesh(hologramBacklightGeo, hologramBacklightMat);
  hologramBacklightMesh.position.z = -0.02;
  const hologramBacklightBackMesh = new THREE.Mesh(hologramBacklightGeo, hologramBacklightMat);
  hologramBacklightBackMesh.position.z = -0.02;
  hologramBacklightBackMesh.rotation.y = Math.PI;

  const goldFoilFrameMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e6c268'),
      roughness: 0.2,
      metalness: 0.8,
      emissive: new THREE.Color('#785214'),
      emissiveIntensity: 0.22,
    }),
  );
  const frameGroup = new THREE.Group();
  const frameHorizGeo = tracker.trackGeo(new THREE.BoxGeometry(2.48, 0.075, 0.045));
  const frameVertGeo = tracker.trackGeo(new THREE.BoxGeometry(0.075, 3.08, 0.045));
  const frameCornerGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.075, 0));

  const frameTop = new THREE.Mesh(frameHorizGeo, goldFoilFrameMat);
  frameTop.position.set(0, 1.5, 0);
  const frameBottom = new THREE.Mesh(frameHorizGeo, goldFoilFrameMat);
  frameBottom.position.set(0, -1.5, 0);
  const frameLeft = new THREE.Mesh(frameVertGeo, goldFoilFrameMat);
  frameLeft.position.set(-1.2, 0, 0);
  const frameRight = new THREE.Mesh(frameVertGeo, goldFoilFrameMat);
  frameRight.position.set(1.2, 0, 0);
  frameGroup.add(frameTop, frameBottom, frameLeft, frameRight);

  [
    [-1.2, 1.5],
    [1.2, 1.5],
    [-1.2, -1.5],
    [1.2, -1.5],
  ].forEach(([cx, cy]) => {
    const rosette = new THREE.Mesh(frameCornerGeo, goldFoilFrameMat);
    rosette.position.set(cx, cy, 0.01);
    frameGroup.add(rosette);
  });

  const hologramPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.35, 2.95));
  const hologramBackdropMesh = new THREE.Mesh(hologramPlaneGeo, hologramBackdropMat);
  hologramBackdropMesh.position.z = 0.008;
  const hologramGlowMesh = new THREE.Mesh(hologramPlaneGeo, hologramPlaneMat);
  hologramGlowMesh.position.z = 0.016;

  // Back-facing FrontSide pair (rotated Math.PI) so the hologram text reads left-to-right from behind as well
  const hologramBackdropBackMesh = new THREE.Mesh(hologramPlaneGeo, hologramBackdropMat);
  hologramBackdropBackMesh.position.z = -0.008;
  hologramBackdropBackMesh.rotation.y = Math.PI;
  const hologramGlowBackMesh = new THREE.Mesh(hologramPlaneGeo, hologramPlaneMat);
  hologramGlowBackMesh.position.z = -0.016;
  hologramGlowBackMesh.rotation.y = Math.PI;

  const hologramPortraitPivot = new THREE.Group();
  // Fixed baseline initial position at Y = 1.85m
  hologramPortraitPivot.position.set(0, 1.85, 0);
  hologramPortraitPivot.add(
    hologramBacklightMesh,
    hologramBacklightBackMesh,
    hologramBackdropMesh,
    hologramGlowMesh,
    hologramBackdropBackMesh,
    hologramGlowBackMesh,
    frameGroup,
  );
  hologramGroup.add(hologramPortraitPivot);

  const blossomSparklesGroup = new THREE.Group();
  blossomSparklesGroup.position.set(0, 0.85, 0);
  blossomSparklesGroup.visible = false;

  const sparkleHeartGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.085, 0));
  const confettiGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.09, 0.055));
  const cyanSparkleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  const roseConfettiMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f9a8d4',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );

  interface HologramParticle {
    mesh: THREE.Mesh;
    baseAngle: number;
    radius: number;
    baseY: number;
    speed: number;
  }
  const hologramParticles: HologramParticle[] = [];
  for (let b = 0; b < 28; b++) {
    const isHeart = b % 2 === 0;
    const mat = b % 3 === 0 ? mats.warmLanternGlow : b % 3 === 1 ? cyanSparkleMat : roseConfettiMat;
    const sp = new THREE.Mesh(isHeart ? sparkleHeartGeo : confettiGeo, mat);
    const baseAngle = (b * Math.PI * 2) / 28;
    const radius = 1.15 + (b % 4) * 0.28;
    const baseY = (b % 7) * 0.42;
    sp.position.set(Math.cos(baseAngle) * radius, baseY, Math.sin(baseAngle) * radius);
    blossomSparklesGroup.add(sp);
    hologramParticles.push({
      mesh: sp,
      baseAngle,
      radius,
      baseY,
      speed: 0.9 + (b % 5) * 0.22,
    });
  }

  const lotusStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.42, 0.6, 1.4, 12));
  lotusStemGeo.translate(0, 1.35, 0);
  const lotusStem = new THREE.Mesh(lotusStemGeo, mats.champagneGold);

  const lotusPetalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.7, 1.3, 6));
  const lotusPetalsGroup = new THREE.Group();
  lotusPetalsGroup.position.set(0, 2.0, 0);
  for (let p = 0; p < 8; p++) {
    const ang = (p * Math.PI * 2) / 8;
    const petal = new THREE.Mesh(lotusPetalGeo, mats.fountainWater);
    petal.position.set(Math.cos(ang) * 0.45, 0, Math.sin(ang) * 0.45);
    petal.rotation.z = Math.cos(ang) * 0.4;
    petal.rotation.x = -Math.sin(ang) * 0.4;
    lotusPetalsGroup.add(petal);
  }

  fountainGroup.add(
    basinOuter,
    basinRim,
    waterMesh,
    rippleRingMesh,
    hologramGroup,
    blossomSparklesGroup,
    lotusStem,
    lotusPetalsGroup,
  );
  group.add(fountainGroup);
  colliders.push({ x: nav.originX, z: nav.originZ, radius: 2.9 });
  let fountainClock = 0;

  // ========================================================================
  // 4B. "TWO HEARTS BECAME ONE LIGHT" GRAND HALL CHANDELIER (LoveChandelier)
  // ========================================================================
  const loveChandelierGroup = new THREE.Group();
  loveChandelierGroup.name = 'LoveChandelier';
  loveChandelierGroup.position.set(0, 7.8, 0);

  const chCeilingMountGroup = new THREE.Group();
  chCeilingMountGroup.name = 'CeilingMount';
  const chCrownGroup = new THREE.Group();
  chCrownGroup.name = 'Crown';
  const chHeartsGroup = new THREE.Group();
  chHeartsGroup.name = 'Hearts';
  const chArmsGroup = new THREE.Group();
  chArmsGroup.name = 'Arms';
  const chFlowersGroup = new THREE.Group();
  chFlowersGroup.name = 'Flowers';
  const chCrystalsGroup = new THREE.Group();
  chCrystalsGroup.name = 'Crystals';
  const chGlowEffectsGroup = new THREE.Group();
  chGlowEffectsGroup.name = 'GlowEffects';

  loveChandelierGroup.add(
    chCeilingMountGroup,
    chCrownGroup,
    chHeartsGroup,
    chArmsGroup,
    chFlowersGroup,
    chCrystalsGroup,
    chGlowEffectsGroup,
  );

  // Chandelier Materials
  const chWarmCrystalHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f43f5e'),
      emissive: new THREE.Color('#e11d48'),
      emissiveIntensity: 0.72,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.65,
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.85,
    }),
  );

  const chBlushCrystalHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.68,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.68,
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.85,
    }),
  );

  const chUnifiedCoreCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff1f2'),
      emissive: new THREE.Color('#fda4af'),
      emissiveIntensity: 1.35,
      roughness: 0.08,
      metalness: 0.12,
      clearcoat: 0.95,
    }),
  );

  const chBlossomPinkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.32,
      roughness: 0.28,
      metalness: 0.1,
    }),
  );

  // 1. CeilingMount: Pearl-White Ceiling Rosette with Pink Blossoms, Gold Filigree & Suspension Rod
  const rodGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 7.6, 8));
  rodGeo.translate(0, 3.8, 0);
  const rodMesh = new THREE.Mesh(rodGeo, mats.champagneGold);

  const rosettePlateGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.35, 1.55, 0.18, 24));
  rosettePlateGeo.translate(0, 7.35, 0);
  const rosettePlate = new THREE.Mesh(rosettePlateGeo, mats.pearlWhite);

  const rosetteFiligreeRingGeo = tracker.trackGeo(new THREE.TorusGeometry(1.42, 0.06, 8, 24));
  rosetteFiligreeRingGeo.rotateX(Math.PI / 2);
  rosetteFiligreeRingGeo.translate(0, 7.26, 0);
  const rosetteFiligreeRing = new THREE.Mesh(rosetteFiligreeRingGeo, mats.champagneGold);
  chCeilingMountGroup.add(rodMesh, rosettePlate, rosetteFiligreeRing);

  const rosetteBlossomGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.11, 0));
  for (let rb = 0; rb < 8; rb++) {
    const ang = (rb * Math.PI * 2) / 8;
    const bl = new THREE.Mesh(rosetteBlossomGeo, chBlossomPinkMat);
    bl.position.set(Math.cos(ang) * 1.18, 7.24, Math.sin(ang) * 1.18);
    bl.scale.set(1.2, 0.55, 1.2);
    chCeilingMountGroup.add(bl);
  }

  // 2. Crown: Upper Royal Crown Canopy on Chandelier
  const chCrownBandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.85, 0.065, 10, 24));
  chCrownBandGeo.rotateX(Math.PI / 2);
  chCrownBandGeo.translate(0, 0.72, 0);
  chCrownGroup.add(new THREE.Mesh(chCrownBandGeo, mats.champagneGold));

  const chCrownPeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.38, 5));
  chCrownPeakGeo.translate(0, 0.19, 0);
  for (let cp = 0; cp < 8; cp++) {
    const ang = (cp * Math.PI * 2) / 8;
    const pk = new THREE.Mesh(chCrownPeakGeo, mats.champagneGold);
    pk.position.set(Math.cos(ang) * 0.85, 0.74, Math.sin(ang) * 0.85);
    pk.rotation.y = -ang;
    chCrownGroup.add(pk);
  }

  // 3. Hearts: "Two Hearts Became One Light" — Two Intertwined Crystal Hearts Merging into One Central Crystal
  const buildLargeCrystalHeart = (mat: THREE.Material, scale: number): THREE.Group => {
    const hg = new THREE.Group();
    const lobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.28, 12, 12));
    lobeGeo.scale(1.0, 1.0, 0.52);
    const tipGeo = tracker.trackGeo(new THREE.ConeGeometry(0.39, 0.58, 12));
    tipGeo.rotateX(Math.PI);
    tipGeo.scale(1.0, 1.0, 0.52);

    const lL = new THREE.Mesh(lobeGeo, mat);
    lL.position.set(-0.18, 0.15, 0);
    const lR = new THREE.Mesh(lobeGeo, mat);
    lR.position.set(0.18, 0.15, 0);
    const tip = new THREE.Mesh(tipGeo, mat);
    tip.position.set(0, -0.22, 0);

    const goldRim = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.38, 0.025, 8, 20)),
      mats.champagneGold,
    );
    hg.add(lL, lR, tip, goldRim);
    hg.scale.setScalar(scale);
    return hg;
  };

  // Heart 1: Warm Rose-Pink Crystal (#f43f5e)
  const intertwinedHeartWarm = buildLargeCrystalHeart(chWarmCrystalHeartMat, 1.15);
  intertwinedHeartWarm.position.set(-0.22, 0.08, 0.06);
  intertwinedHeartWarm.rotation.set(0.12, 0.38, 0.18);

  // Heart 2: Soft Blush-Pink Crystal (#f9a8d4)
  const intertwinedHeartBlush = buildLargeCrystalHeart(chBlushCrystalHeartMat, 1.15);
  intertwinedHeartBlush.position.set(0.22, 0.08, -0.06);
  intertwinedHeartBlush.rotation.set(-0.12, -0.38, -0.18);

  // Unified Central Glowing Crystal Core ("One Light")
  const unifiedCoreGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.32, 1));
  unifiedCoreGeo.scale(0.85, 1.35, 0.85);
  const unifiedCoreMesh = new THREE.Mesh(unifiedCoreGeo, chUnifiedCoreCrystalMat);
  unifiedCoreMesh.position.set(0, 0.02, 0);

  // Heart-Shaped Bottom Finial Crystal
  const bottomHeartCrystal = buildLargeCrystalHeart(chWarmCrystalHeartMat, 0.68);
  bottomHeartCrystal.position.set(0, -1.48, 0);

  chHeartsGroup.add(
    intertwinedHeartWarm,
    intertwinedHeartBlush,
    unifiedCoreMesh,
    bottomHeartCrystal,
  );

  // 4. Arms, Flowers & Crystals: 8 Sweeping Gold Arms with Hidden Filigree Hearts & Flower -> Crystal -> Tiny Hanging Heart
  const ring1Geo = tracker.trackGeo(new THREE.TorusGeometry(2.35, 0.065, 8, 28));
  ring1Geo.rotateX(Math.PI / 2);
  const ring2Geo = tracker.trackGeo(new THREE.TorusGeometry(1.42, 0.05, 8, 24));
  ring2Geo.rotateX(Math.PI / 2);
  ring2Geo.translate(0, -0.52, 0);
  chArmsGroup.add(
    new THREE.Mesh(ring1Geo, mats.champagneGold),
    new THREE.Mesh(ring2Geo, mats.champagneGold),
  );

  const armSweepCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 0.25, 0),
    new THREE.Vector3(1.15, -0.32, 0),
    new THREE.Vector3(1.95, 0.14, 0),
    new THREE.Vector3(2.38, -0.08, 0),
  ]);
  const armTubeGeo = tracker.trackGeo(new THREE.TubeGeometry(armSweepCurve, 14, 0.036, 7, false));
  const filigreeHeartScrollGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.018, 6, 14));
  const armFlowerPetalGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 7, 6));
  armFlowerPetalGeo.scale(1.3, 0.45, 0.8);
  const crystalDropGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.11, 0));
  crystalDropGeo.scale(0.65, 1.65, 0.65);

  for (let armIdx = 0; armIdx < 8; armIdx++) {
    const ang = (armIdx * Math.PI * 2) / 8;
    const armPivot = new THREE.Group();
    armPivot.rotation.y = ang;

    const armMesh = new THREE.Mesh(armTubeGeo, mats.champagneGold);
    armPivot.add(armMesh);

    // Subtle hidden miniature heart formed by paired filigree scrolls inside the arm
    const scrollL = new THREE.Mesh(filigreeHeartScrollGeo, mats.champagneGold);
    scrollL.position.set(1.32, -0.05, 0);
    scrollL.rotation.z = 0.45;
    const scrollR = new THREE.Mesh(filigreeHeartScrollGeo, mats.champagneGold);
    scrollR.position.set(1.48, -0.05, 0);
    scrollR.rotation.z = -0.45;
    armPivot.add(scrollL, scrollR);
    chArmsGroup.add(armPivot);

    // Tip world/chandelier-local position at r = 2.38
    const tipX = Math.cos(ang) * 2.38;
    const tipZ = Math.sin(ang) * 2.38;

    // 5-Petal Barbie Blossom at arm tip
    const flowerCluster = new THREE.Group();
    flowerCluster.position.set(tipX, -0.06, tipZ);
    for (let p = 0; p < 5; p++) {
      const pAng = (p * Math.PI * 2) / 5;
      const pet = new THREE.Mesh(armFlowerPetalGeo, chBlossomPinkMat);
      pet.position.set(Math.cos(pAng) * 0.075, 0, Math.sin(pAng) * 0.075);
      pet.rotation.y = -pAng;
      flowerCluster.add(pet);
    }
    chFlowersGroup.add(flowerCluster);

    // Faceted Crystal below flower
    const crys = new THREE.Mesh(crystalDropGeo, mats.crystalGlass);
    crys.position.set(tipX, -0.34, tipZ);
    chCrystalsGroup.add(crys);

    // Tiny Hanging Heart below crystal
    const tinyHeart = buildSculptedHeart(
      0.55,
      armIdx % 2 === 0 ? chWarmCrystalHeartMat : chBlushCrystalHeartMat,
    );
    tinyHeart.position.set(tipX, -0.64, tipZ);
    tinyHeart.rotation.y = -ang + Math.PI / 2;
    chCrystalsGroup.add(tinyHeart);

    // Inner tier crystal drop at r = 1.42
    const innerCrys = new THREE.Mesh(crystalDropGeo, mats.crystalGlass);
    innerCrys.position.set(Math.cos(ang) * 1.42, -0.78, Math.sin(ang) * 1.42);
    chCrystalsGroup.add(innerCrys);
  }

  // 5. GlowEffects: 1 Primary Warm PointLight + 1 Subtle Pink Fill PointLight + Floor Heart Projection Decal
  const chandelierLight = new THREE.PointLight('#fef08a', 2.2, 24.0, 1.5);
  chandelierLight.position.set(0, -0.35, 0);
  const chandelierPinkFillLight = new THREE.PointLight('#f472b6', 0.65, 16.0, 1.6);
  chandelierPinkFillLight.position.set(0, -0.85, 0);
  chGlowEffectsGroup.add(chandelierLight, chandelierPinkFillLight);
  group.add(loveChandelierGroup);

  // Soft Rose-Pink Heart-Shaped Floor Illumination Decal (activated when player stands beneath chandelier)
  const createFloorHeartGlowTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      const rad = ctx.createRadialGradient(128, 128, 10, 128, 128, 122);
      rad.addColorStop(0, 'rgba(251, 207, 232, 0.55)');
      rad.addColorStop(0.5, 'rgba(244, 63, 94, 0.28)');
      rad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.save();
      ctx.translate(128, 134);
      ctx.beginPath();
      ctx.moveTo(0, 56);
      ctx.bezierCurveTo(-78, 6, -86, -58, -38, -76);
      ctx.bezierCurveTo(-12, -86, 0, -58, 0, -44);
      ctx.bezierCurveTo(0, -58, 12, -86, 38, -76);
      ctx.bezierCurveTo(86, -58, 78, 6, 0, 56);
      ctx.closePath();
      ctx.fillStyle = 'rgba(253, 164, 175, 0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const chandelierFloorHeartMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: createFloorHeartGlowTexture(),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const chandelierFloorHeartGeo = tracker.trackGeo(new THREE.PlaneGeometry(7.2, 7.2));
  chandelierFloorHeartGeo.rotateX(-Math.PI / 2);
  const chandelierFloorHeartDecal = new THREE.Mesh(
    chandelierFloorHeartGeo,
    chandelierFloorHeartMat,
  );
  chandelierFloorHeartDecal.position.set(0, 0.292, 0);
  chandelierFloorHeartDecal.visible = false;
  group.add(chandelierFloorHeartDecal);
  let chandelierShimmerAlpha = 0.0;

  // ========================================================================
  // 5. "LOVE RIBBON" STAIRCASE SYSTEM (FLOOR 1 -> 2, FLOOR 2 -> 3, FLOOR 3 -> 4)
  // ========================================================================
  const loveRibbonStaircaseGroup = new THREE.Group();
  loveRibbonStaircaseGroup.name = 'LoveRibbonStaircase';
  const lrMainRailGroup = new THREE.Group();
  lrMainRailGroup.name = 'MainRail';
  const lrPinkRibbonGroup = new THREE.Group();
  lrPinkRibbonGroup.name = 'PinkRibbon';
  const lrHeartFiligreeGroup = new THREE.Group();
  lrHeartFiligreeGroup.name = 'HeartFiligree';
  const lrFlowersGroup = new THREE.Group();
  lrFlowersGroup.name = 'Flowers';
  const lrCrystalsGroup = new THREE.Group();
  lrCrystalsGroup.name = 'Crystals';
  const lrCrownFinialGroup = new THREE.Group();
  lrCrownFinialGroup.name = 'CrownFinial';

  loveRibbonStaircaseGroup.add(
    lrMainRailGroup,
    lrPinkRibbonGroup,
    lrHeartFiligreeGroup,
    lrFlowersGroup,
    lrCrystalsGroup,
    lrCrownFinialGroup,
  );
  group.add(loveRibbonStaircaseGroup);

  // Love Ribbon Shared Materials (Sections 1A - 1G)
  const loveRibbonGoldMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b467'),
      metalness: 0.85,
      roughness: 0.2,
    }),
  );

  const loveRibbonPinkMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f43f5e'),
      emissive: new THREE.Color('#e11d48'),
      emissiveIntensity: 0.24,
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.92,
    }),
  );

  const balusterBlushTrimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.18,
      roughness: 0.25,
      metalness: 0.15,
    }),
  );

  const flowerBlushPetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.22,
      roughness: 0.3,
      metalness: 0.08,
    }),
  );

  const flowerHotPinkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ec4899'),
      emissive: new THREE.Color('#db2777'),
      emissiveIntensity: 0.28,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );

  const roseCrystalDropMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f472b6'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.9,
      clearcoat: 0.85,
    }),
  );

  const newelHeartCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f43f5e'),
      emissive: new THREE.Color('#f43f5e'),
      emissiveIntensity: 0.55,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 0.9,
    }),
  );

  // Helper to build a complete Love Ribbon Balustrade (S-Curve Gold Rail + Weaving Pink Ribbon +
  // Bottom Newel with Twin Heart Crystals + Top Crown-Heart Finial) along a stair flight
  const newelPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.085, 0.11, 1.08, 12));
  newelPostGeo.translate(0, 0.54, 0);
  const newelCapGeo = tracker.trackGeo(new THREE.SphereGeometry(0.115, 10, 10));
  newelCapGeo.translate(0, 1.1, 0);

  interface BalusterPlacement {
    x: number;
    y: number;
    z: number;
    isFlowerSupport: boolean;
  }
  const balusterPlacements: BalusterPlacement[] = [];
  const heroCrystalDropPlacements: Array<{ x: number; y: number; z: number; isRose: boolean }> = [];

  const buildLoveRibbonRailLine = (
    railX: number,
    startZ: number,
    startY: number,
    endZ: number,
    endY: number,
    swaySign: number,
    includeNewelAndFinial: boolean,
  ) => {
    const railPts: THREE.Vector3[] = [];
    const ribbonPts: THREE.Vector3[] = [];
    const numSamples = 20;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      const baseY = THREE.MathUtils.lerp(startY, endY, t) + 0.96;
      // Gentle S-curve horizontal & vertical wave
      const sCurveX = railX + Math.sin(t * Math.PI * 2) * 0.065 * swaySign;
      const sCurveY = baseY + Math.sin(t * Math.PI * 2) * 0.04;
      railPts.push(new THREE.Vector3(sCurveX, sCurveY, z));

      // Glossy Barbie-pink ribbon weaving gracefully around the gold handrail
      const wrapAngle = t * Math.PI * 6.0 + (swaySign > 0 ? 0 : Math.PI);
      const ribX = sCurveX + Math.cos(wrapAngle) * 0.058;
      const ribY = sCurveY + Math.sin(wrapAngle) * 0.058;
      ribbonPts.push(new THREE.Vector3(ribX, ribY, z));
    }

    // Top landing curl upward for finial
    const curlEndZ = endZ + 0.22;
    railPts.push(new THREE.Vector3(railX, endY + 1.14, curlEndZ));
    ribbonPts.push(new THREE.Vector3(railX + 0.04 * swaySign, endY + 1.12, curlEndZ));

    const mainCurve = new THREE.CatmullRomCurve3(railPts);
    const ribbonCurve = new THREE.CatmullRomCurve3(ribbonPts);

    const mainTubeGeo = tracker.trackGeo(new THREE.TubeGeometry(mainCurve, 36, 0.044, 8, false));
    const ribbonTubeGeo = tracker.trackGeo(new THREE.TubeGeometry(ribbonCurve, 44, 0.024, 7, false));

    lrMainRailGroup.add(new THREE.Mesh(mainTubeGeo, loveRibbonGoldMat));
    lrPinkRibbonGroup.add(new THREE.Mesh(ribbonTubeGeo, loveRibbonPinkMat));

    // Record hero inflection points (3 per rail) for hanging crystal drops
    [0.25, 0.52, 0.78].forEach((tInf, idx) => {
      const pt = mainCurve.getPoint(tInf);
      heroCrystalDropPlacements.push({
        x: pt.x,
        y: pt.y - 0.14,
        z: pt.z,
        isRose: idx % 2 === 1,
      });
    });

    if (includeNewelAndFinial) {
      // 1F. Bottom Newel with Two Tiny Heart-Shaped Rose Crystals
      const newelGroup = new THREE.Group();
      newelGroup.position.set(railX, startY, startZ - 0.12);
      newelGroup.add(
        new THREE.Mesh(newelPostGeo, loveRibbonGoldMat),
        new THREE.Mesh(newelCapGeo, loveRibbonGoldMat),
      );
      const heartL = buildSculptedHeart(0.48, newelHeartCrystalMat);
      heartL.position.set(-0.045, 1.24, 0);
      heartL.rotation.z = 0.18;
      const heartR = buildSculptedHeart(0.48, newelHeartCrystalMat);
      heartR.position.set(0.045, 1.24, 0);
      heartR.rotation.z = -0.18;
      newelGroup.add(heartL, heartR);
      lrMainRailGroup.add(newelGroup);

      // 1G. Top Landing Finial: Small Royal Crown surrounding a Glowing Pink Heart Gemstone
      const finialGroup = new THREE.Group();
      finialGroup.position.set(railX, endY + 1.18, curlEndZ);
      const crownRim = new THREE.Mesh(
        tracker.trackGeo(new THREE.TorusGeometry(0.11, 0.022, 8, 16)).rotateX(Math.PI / 2),
        loveRibbonGoldMat,
      );
      finialGroup.add(crownRim);
      const finialSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.028, 0.11, 5));
      finialSpireGeo.translate(0, 0.055, 0);
      for (let sp = 0; sp < 5; sp++) {
        const sAng = (sp * Math.PI * 2) / 5;
        const spire = new THREE.Mesh(finialSpireGeo, loveRibbonGoldMat);
        spire.position.set(Math.cos(sAng) * 0.11, 0, Math.sin(sAng) * 0.11);
        finialGroup.add(spire);
      }
      const finialHeartGem = buildSculptedHeart(0.56, newelHeartCrystalMat);
      finialHeartGem.position.set(0, 0.08, 0);
      finialGroup.add(finialHeartGem);
      lrCrownFinialGroup.add(finialGroup);
    }
  };

  // --- 5.1 FLOOR 1 -> FLOOR 2 TWIN SWEEPING STAIRCASES (Driven by CASTLE_STAIRCASE_CONFIGS[0..1]) ---
  const scWest12 = CASTLE_STAIRCASE_CONFIGS[0];
  const scEast12 = CASTLE_STAIRCASE_CONFIGS[1];
  const numSteps12 = scWest12.stepCount;
  const stepW = scWest12.stepWidth;
  const stepH = scWest12.stepHeight;
  const stepD = scWest12.stepDepth;
  const stepGeo = tracker.trackGeo(new THREE.BoxGeometry(stepW, stepH, stepD + 0.06));
  const crystalRiserGeo = tracker.trackGeo(new THREE.BoxGeometry(stepW - 0.14, stepH * 0.42, 0.04));

  const stairsWestGroup = new THREE.Group();
  const stairsEastGroup = new THREE.Group();
  const stairRiserMats: THREE.MeshStandardMaterial[] = [];
  const stairStepHeights: number[] = [];

  // Explicit Bottom & Top Landing Transition Pads for F1->F2 Twin Staircases (flush with Floor 1 y=0.25 and Floor 2 y=5.25)
  const landingPad12Geo = tracker.trackGeo(new THREE.BoxGeometry(stepW + 0.16, 0.12, 0.85));
  [scWest12, scEast12].forEach((sc) => {
    const botPad = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
    botPad.position.set(sc.startX, sc.startY - 0.058, sc.startZ - 0.35);
    botPad.receiveShadow = true;
    const topPad = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
    topPad.position.set(sc.endX, sc.endY - 0.058, sc.endZ + 0.35);
    topPad.receiveShadow = true;
    group.add(botPad, topPad);
  });

  for (let s = 0; s < numSteps12; s++) {
    const sz = scWest12.startZ + (s + 0.5) * stepD;
    // Step s top surface is startY + (s + 1) * stepH so Step 18 topY === 5.25m (exact match with Floor 2!)
    const topY = scWest12.startY + (s + 1) * stepH;
    const sy = topY - 0.5 * stepH;
    stairStepHeights.push(sy);

    const riserMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fda4af'),
        emissive: new THREE.Color('#f43f5e'),
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.15,
      }),
    );
    stairRiserMats.push(riserMat);

    const westStep = new THREE.Mesh(stepGeo, mats.blushRoseMarble);
    westStep.position.set(scWest12.startX, sy, sz);
    westStep.receiveShadow = true;
    const westRiser = new THREE.Mesh(crystalRiserGeo, riserMat);
    westRiser.position.set(scWest12.startX, sy + stepH * 0.12, sz - stepD * 0.5);
    stairsWestGroup.add(westStep, westRiser);

    const eastStep = new THREE.Mesh(stepGeo, mats.blushRoseMarble);
    eastStep.position.set(scEast12.startX, sy, sz);
    eastStep.receiveShadow = true;
    const eastRiser = new THREE.Mesh(crystalRiserGeo, riserMat);
    eastRiser.position.set(scEast12.startX, sy + stepH * 0.12, sz - stepD * 0.5);
    stairsEastGroup.add(eastStep, eastRiser);

    // Every 2nd step: place negative-space heart filigree balusters (and every 3rd support gets a 5-petal Barbie flower)
    if (s % 2 === 0) {
      const supportIdx = Math.floor(s / 2);
      const isFlowerSupport = supportIdx % 3 === 1;
      [
        scWest12.railOuterX,
        scWest12.railInnerX,
        scEast12.railInnerX,
        scEast12.railOuterX,
      ].forEach((bx) => {
        balusterPlacements.push({
          x: bx,
          y: topY,
          z: sz,
          isFlowerSupport,
        });
      });
    }
  }
  group.add(stairsWestGroup, stairsEastGroup);

  // Build Love Ribbon Rails for Floor 1 -> Floor 2 Twin Staircases
  buildLoveRibbonRailLine(scWest12.railOuterX, scWest12.startZ, scWest12.startY, scWest12.endZ, scWest12.endY, -1, true);
  buildLoveRibbonRailLine(scWest12.railInnerX, scWest12.startZ, scWest12.startY, scWest12.endZ, scWest12.endY, 1, true);
  buildLoveRibbonRailLine(scEast12.railInnerX, scEast12.startZ, scEast12.startY, scEast12.endZ, scEast12.endY, -1, true);
  buildLoveRibbonRailLine(scEast12.railOuterX, scEast12.startZ, scEast12.startY, scEast12.endZ, scEast12.endY, 1, true);

  // ========================================================================
  // 6. LEVEL 2: MEZZANINE (TOP SURFACE Y = +5.25m) — CLEAR STAIRWELL OPENING ABOVE STAIRS
  // ========================================================================
  // Side plates start at |lx| = 8.6 (x = ±11.95, w = 6.7) so the twin staircases at lx = ±6.9 (|lx| = 5.2..8.6)
  // have 100% open headroom all the way up to Step 18 at lz = +6.0, and top surface is exactly y = 5.25m!
  const mezSlabThickness = 0.35;
  const mezSlabCenterY = 5.25 - mezSlabThickness * 0.5; // topY === 5.25m
  const mezPlates = [
    { x: 0, z: -10.5, w: 30.0, d: 9.0, isFront: true },
    { x: 0, z: 10.5, w: 30.0, d: 9.0, isFront: false },
    { x: 0, z: 4.9, w: 10.4, d: 2.2, isFront: false }, // Central-North Elevator Lobby Bridge (lz: +3.8..+6.0)
    { x: -11.95, z: 0, w: 6.7, d: 12.0, isFront: false },
    { x: 11.95, z: 0, w: 6.7, d: 12.0, isFront: false },
  ];

  let mezFrontPlate: THREE.Mesh | null = null;
  mezPlates.forEach((p) => {
    const geo = tracker.trackGeo(new THREE.BoxGeometry(p.w, mezSlabThickness, p.d));
    geo.translate(p.x, mezSlabCenterY, p.z);
    const mesh = new THREE.Mesh(geo, mats.softLavender);
    mesh.receiveShadow = true;
    if (p.isFront) {
      mezFrontPlate = mesh;
    }
    group.add(mesh);
    cameraOccluders.push(mesh);
  });

  // Mezzanine Balcony Balustrade Rails framing the open central atrium & stairwells
  const mezCenterRailGeo = tracker.trackGeo(new THREE.BoxGeometry(10.4, 0.12, 0.16));
  mezCenterRailGeo.translate(0, 6.15, 0);
  const mezSouthRail = new THREE.Mesh(mezCenterRailGeo, loveRibbonGoldMat);
  mezSouthRail.position.set(0, 0, -6.0);
  const mezNorthCenterRail = new THREE.Mesh(mezCenterRailGeo, loveRibbonGoldMat);
  mezNorthCenterRail.position.set(0, 0, 3.8);
  group.add(mezSouthRail, mezNorthCenterRail);

  const mezLobbySideRailGeo = tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.12, 2.2));
  mezLobbySideRailGeo.translate(0, 6.15, 0);
  [-5.2, 5.2].forEach((bx) => {
    const lobbyRail = new THREE.Mesh(mezLobbySideRailGeo, loveRibbonGoldMat);
    lobbyRail.position.set(bx, 0, 4.9);
    group.add(lobbyRail);
  });

  const mezSideWellRailGeo = tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.12, 12.0));
  mezSideWellRailGeo.translate(0, 6.15, 0);
  [-8.6, 8.6].forEach((bx) => {
    const railSide = new THREE.Mesh(mezSideWellRailGeo, loveRibbonGoldMat);
    railSide.position.set(bx, 0, 0);
    group.add(railSide);
  });

  // --- 6.2 FLOOR 2 -> FLOOR 3 EAST GALLERY STAIRCASE (Driven by CASTLE_STAIRCASE_CONFIGS[2]) ---
  const scEast23 = CASTLE_STAIRCASE_CONFIGS[2];
  const numSteps23 = scEast23.stepCount;
  const stepH23 = scEast23.stepHeight;
  const stepD23 = scEast23.stepDepth;
  const step23Geo = tracker.trackGeo(
    new THREE.BoxGeometry(scEast23.stepWidth, stepH23, stepD23 + 0.06),
  );

  // Explicit Bottom & Top Landing Pads for Floor 2 -> Floor 3 Staircase
  const botPad23 = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
  botPad23.position.set(scEast23.startX, scEast23.startY - 0.058, scEast23.startZ - 0.28);
  const topPad23 = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
  topPad23.position.set(scEast23.endX, scEast23.endY - 0.058, scEast23.endZ + 0.35);
  group.add(botPad23, topPad23);

  for (let s = 0; s < numSteps23; s++) {
    const sz = scEast23.startZ + (s + 0.5) * stepD23;
    // Step s top surface is startY + (s + 1) * stepH23 so Step 14 topY === 10.25m (exact match with Floor 3!)
    const topY = scEast23.startY + (s + 1) * stepH23;
    const sy = topY - 0.5 * stepH23;
    const stp = new THREE.Mesh(step23Geo, mats.blushRoseMarble);
    stp.position.set(scEast23.startX, sy, sz);
    stp.receiveShadow = true;
    group.add(stp);

    if (s % 2 === 0) {
      const supportIdx = Math.floor(s / 2);
      const isFlowerSupport = supportIdx % 3 === 1;
      [scEast23.railInnerX, scEast23.railOuterX].forEach((bx) => {
        balusterPlacements.push({ x: bx, y: topY, z: sz, isFlowerSupport });
      });
    }
  }
  buildLoveRibbonRailLine(scEast23.railInnerX, scEast23.startZ, scEast23.startY, scEast23.endZ, scEast23.endY, -1, true);
  buildLoveRibbonRailLine(scEast23.railOuterX, scEast23.startZ, scEast23.startY, scEast23.endZ, scEast23.endY, 1, true);

  // ========================================================================
  // 7. LEVEL 3: DREAM WING (TOP SURFACE Y = +10.25m) — CLEAR STAIRWELL OPENING AT EAST (lx: 5.8..9.2, lz: 6.5..13.0)
  // ========================================================================
  const dreamSlabThickness = 0.35;
  const dreamSlabCenterY = 10.25 - dreamSlabThickness * 0.5; // topY === 10.25m
  const dreamPlates = [
    // South Promenade (lz: -15.0 .. -5.2)
    { x: 0, z: -10.1, w: 30.0, d: 9.8 },
    // West Gallery Promenade (lx: -15.0 .. -5.2, lz: -5.2 .. +6.5) — connects directly to F3->F4 West Staircase at (-7.5, +6.5)!
    { x: -10.1, z: 0.65, w: 9.8, d: 11.7 },
    // East Gallery Promenade South of F2->F3 Stairwell (lx: +5.2 .. +15.0, lz: -5.2 .. +6.5)
    { x: 10.1, z: 0.65, w: 9.8, d: 11.7 },
    // Central-North Elevator Lobby Bridge between Chandelier Atrium and Elevator/Stairs (lx: -5.2 .. +5.8, lz: +3.8 .. +6.5)
    { x: 0.3, z: 5.15, w: 11.0, d: 2.7 },
    // North-West & Central Gallery around F2->F3 East Stairwell (lx: -15.0 .. +5.8, lz: +6.5 .. +15.2)
    { x: -4.6, z: 10.85, w: 20.8, d: 8.7 },
    // Outer North-East Gallery beside F2->F3 East Stairwell (lx: +9.2 .. +15.0, lz: +6.5 .. +15.2)
    { x: 12.1, z: 10.85, w: 5.8, d: 8.7 },
    // North-East Stair Landing where Step 14 of F2->F3 arrives (lx: +5.8 .. +9.2, lz: +13.0 .. +15.2)
    { x: 7.5, z: 14.1, w: 3.5, d: 2.2 },
  ];

  dreamPlates.forEach((p) => {
    const geo = tracker.trackGeo(new THREE.BoxGeometry(p.w, dreamSlabThickness, p.d));
    geo.translate(p.x, dreamSlabCenterY, p.z);
    const mesh = new THREE.Mesh(geo, mats.pearlWhite);
    mesh.receiveShadow = true;
    group.add(mesh);
    cameraOccluders.push(mesh);
  });

  // Floor 3 Atrium Balustrade Rails framing the central atrium opening (lx: -5.2..+5.2, lz: -5.2..+3.8)
  const f3AtriumHorizRailGeo = tracker.trackGeo(new THREE.BoxGeometry(10.4, 0.12, 0.16));
  f3AtriumHorizRailGeo.translate(0, 11.15, 0);
  const f3SouthAtriumRail = new THREE.Mesh(f3AtriumHorizRailGeo, loveRibbonGoldMat);
  f3SouthAtriumRail.position.set(0, 0, -5.2);
  const f3NorthAtriumRail = new THREE.Mesh(f3AtriumHorizRailGeo, loveRibbonGoldMat);
  f3NorthAtriumRail.position.set(0, 0, 3.8);
  group.add(f3SouthAtriumRail, f3NorthAtriumRail);

  const f3AtriumSideRailGeo = tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.12, 9.0));
  f3AtriumSideRailGeo.translate(0, 11.15, 0);
  [-5.2, 5.2].forEach((bx) => {
    const sRail = new THREE.Mesh(f3AtriumSideRailGeo, loveRibbonGoldMat);
    sRail.position.set(bx, 0, -0.7);
    group.add(sRail);
  });

  // Protective Gold Balustrade Rail on Floor 3 at the south drop-off edge of the F2->F3 stairwell (z = 6.45, lx = 5.8..9.2)
  const wellBackRailGeo = tracker.trackGeo(new THREE.BoxGeometry(3.3, 0.92, 0.12));
  const f3WellBackRail = new THREE.Mesh(wellBackRailGeo, loveRibbonGoldMat);
  f3WellBackRail.position.set(scEast23.startX, 10.25 + 0.46, scEast23.startZ - 0.08);
  group.add(f3WellBackRail);

  // --- 7.2 FLOOR 3 -> FLOOR 4 WEST GALLERY STAIRCASE (Driven by CASTLE_STAIRCASE_CONFIGS[3]) ---
  const scWest34 = CASTLE_STAIRCASE_CONFIGS[3];
  const botPad34 = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
  botPad34.position.set(scWest34.startX, scWest34.startY - 0.058, scWest34.startZ - 0.28);
  const topPad34 = new THREE.Mesh(landingPad12Geo, mats.blushRoseMarble);
  topPad34.position.set(scWest34.endX, scWest34.endY - 0.058, scWest34.endZ + 0.35);
  group.add(botPad34, topPad34);

  for (let s = 0; s < scWest34.stepCount; s++) {
    const sz = scWest34.startZ + (s + 0.5) * scWest34.stepDepth;
    // Step s top surface is startY + (s + 1) * stepHeight so Step 14 topY === 15.25m (exact match with Floor 4 Rooftop!)
    const topY = scWest34.startY + (s + 1) * scWest34.stepHeight;
    const sy = topY - 0.5 * scWest34.stepHeight;
    const stp = new THREE.Mesh(step23Geo, mats.blushRoseMarble);
    stp.position.set(scWest34.startX, sy, sz);
    stp.receiveShadow = true;
    group.add(stp);

    if (s % 2 === 0) {
      const supportIdx = Math.floor(s / 2);
      const isFlowerSupport = supportIdx % 3 === 1;
      [scWest34.railOuterX, scWest34.railInnerX].forEach((bx) => {
        balusterPlacements.push({ x: bx, y: topY, z: sz, isFlowerSupport });
      });
    }
  }
  buildLoveRibbonRailLine(scWest34.railOuterX, scWest34.startZ, scWest34.startY, scWest34.endZ, scWest34.endY, -1, true);
  buildLoveRibbonRailLine(scWest34.railInnerX, scWest34.startZ, scWest34.startY, scWest34.endZ, scWest34.endY, 1, true);

  // --- INSTANCED NEGATIVE-SPACE HEART BALUSTERS, 5-PETAL BARBIE FLOWERS & CRYSTAL DROPS ---
  // 1C. Paired Curved Gold Filigree Supports facing each other so the negative space forms a subtle Heart (♡)
  const balusterStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 0.96, 8));
  balusterStemGeo.translate(0, 0.48, 0);
  const heartCurveScrollGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.145, 0.018, 7, 16, Math.PI * 1.15),
  );
  const heartInnerTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.115, 0.012, 6, 14, Math.PI * 1.1),
  );

  const totalBalusters = balusterPlacements.length;
  const balusterStemInst = new THREE.InstancedMesh(balusterStemGeo, loveRibbonGoldMat, totalBalusters);
  const heartScrollLeftInst = new THREE.InstancedMesh(heartCurveScrollGeo, loveRibbonGoldMat, totalBalusters);
  const heartScrollRightInst = new THREE.InstancedMesh(heartCurveScrollGeo, loveRibbonGoldMat, totalBalusters);
  const heartTrimLeftInst = new THREE.InstancedMesh(heartInnerTrimGeo, balusterBlushTrimMat, totalBalusters);
  const heartTrimRightInst = new THREE.InstancedMesh(heartInnerTrimGeo, balusterBlushTrimMat, totalBalusters);

  const flowerSupportPlacements = balusterPlacements.filter((b) => b.isFlowerSupport);
  const numFlowerSupports = flowerSupportPlacements.length;
  const balusterFlowerPetalGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 7, 6));
  balusterFlowerPetalGeo.scale(1.35, 0.48, 0.75);
  const balusterFlowerCenterGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.042, 0));

  const balusterFlowerPetalInst = new THREE.InstancedMesh(
    balusterFlowerPetalGeo,
    flowerBlushPetalMat,
    numFlowerSupports * 5,
  );
  const balusterFlowerCenterInst = new THREE.InstancedMesh(
    balusterFlowerCenterGeo,
    flowerHotPinkMat,
    numFlowerSupports,
  );

  const balDummy = new THREE.Object3D();
  for (let i = 0; i < totalBalusters; i++) {
    const bp = balusterPlacements[i];
    balDummy.position.set(bp.x, bp.y, bp.z);
    balDummy.rotation.set(0, Math.PI / 2, 0);
    balDummy.scale.setScalar(1);
    balDummy.updateMatrix();
    balusterStemInst.setMatrixAt(i, balDummy.matrix);

    // Left half of negative-space heart (facing along the stair flight)
    balDummy.position.set(bp.x, bp.y + 0.54, bp.z - 0.075);
    balDummy.rotation.set(0, Math.PI / 2, Math.PI * 0.42);
    balDummy.updateMatrix();
    heartScrollLeftInst.setMatrixAt(i, balDummy.matrix);
    heartTrimLeftInst.setMatrixAt(i, balDummy.matrix);

    // Right half of negative-space heart (mirroring left half to enclose a heart silhouette ♡)
    balDummy.position.set(bp.x, bp.y + 0.54, bp.z + 0.075);
    balDummy.rotation.set(0, -Math.PI / 2, Math.PI * 0.42);
    balDummy.updateMatrix();
    heartScrollRightInst.setMatrixAt(i, balDummy.matrix);
    heartTrimRightInst.setMatrixAt(i, balDummy.matrix);
  }
  balusterStemInst.instanceMatrix.needsUpdate = true;
  heartScrollLeftInst.instanceMatrix.needsUpdate = true;
  heartScrollRightInst.instanceMatrix.needsUpdate = true;
  heartTrimLeftInst.instanceMatrix.needsUpdate = true;
  heartTrimRightInst.instanceMatrix.needsUpdate = true;

  lrMainRailGroup.add(balusterStemInst);
  lrHeartFiligreeGroup.add(
    heartScrollLeftInst,
    heartScrollRightInst,
    heartTrimLeftInst,
    heartTrimRightInst,
  );

  // 1D. Instanced 5-Petal Barbie Flowers on every 3rd major support (~1-2% visual mass)
  for (let fIdx = 0; fIdx < numFlowerSupports; fIdx++) {
    const fp = flowerSupportPlacements[fIdx];
    balDummy.position.set(fp.x, fp.y + 0.56, fp.z);
    balDummy.rotation.set(0, 0, 0);
    balDummy.scale.setScalar(1);
    balDummy.updateMatrix();
    balusterFlowerCenterInst.setMatrixAt(fIdx, balDummy.matrix);

    for (let p = 0; p < 5; p++) {
      const pAng = (p * Math.PI * 2) / 5;
      balDummy.position.set(
        fp.x,
        fp.y + 0.56 + Math.sin(pAng) * 0.068,
        fp.z + Math.cos(pAng) * 0.068,
      );
      balDummy.rotation.set(pAng, Math.PI / 2, 0);
      balDummy.scale.setScalar(1);
      balDummy.updateMatrix();
      balusterFlowerPetalInst.setMatrixAt(fIdx * 5 + p, balDummy.matrix);
    }
  }
  balusterFlowerCenterInst.instanceMatrix.needsUpdate = true;
  balusterFlowerPetalInst.instanceMatrix.needsUpdate = true;
  lrFlowersGroup.add(balusterFlowerPetalInst, balusterFlowerCenterInst);

  // 1E. Instanced Hanging Crystal Drops at Hero Inflection Points
  const stairDropThreadGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6));
  stairDropThreadGeo.translate(0, 0.08, 0);
  const stairDropGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.058, 0));
  stairDropGemGeo.scale(0.68, 1.55, 0.68);

  const totalDrops = heroCrystalDropPlacements.length;
  const stairDropThreadInst = new THREE.InstancedMesh(stairDropThreadGeo, loveRibbonGoldMat, totalDrops);
  const stairDropGemInst = new THREE.InstancedMesh(stairDropGemGeo, roseCrystalDropMat, totalDrops);

  for (let dIdx = 0; dIdx < totalDrops; dIdx++) {
    const dp = heroCrystalDropPlacements[dIdx];
    balDummy.position.set(dp.x, dp.y, dp.z);
    balDummy.rotation.set(0, dIdx * 0.7, 0);
    balDummy.scale.setScalar(1);
    balDummy.updateMatrix();
    stairDropThreadInst.setMatrixAt(dIdx, balDummy.matrix);
    stairDropGemInst.setMatrixAt(dIdx, balDummy.matrix);
  }
  stairDropThreadInst.instanceMatrix.needsUpdate = true;
  stairDropGemInst.instanceMatrix.needsUpdate = true;
  lrCrystalsGroup.add(stairDropThreadInst, stairDropGemInst);

  // ========================================================================
  // 8. LEVEL 4: ROOFTOP OBSERVATORY TERRACE & TELESCOPE (TOP SURFACE Y = +15.25m)
  //    (SPLIT AROUND WEST STAIRWELL OPENING: lx in -9.2..-5.8, lz in 6.5..13.0)
  // ========================================================================
  const roofSlabThickness = 0.45;
  const roofSlabCenterY = 15.25 - roofSlabThickness * 0.5; // topY === 15.25m
  const roofPlates = [
    { x: 0, z: -4.5, w: 31.2, d: 22.0 }, // South & Central terrace (lz: -15.5 .. +6.5)
    { x: 0, z: 14.3, w: 31.2, d: 2.6 }, // North landing terrace (lz: +13.0 .. +15.6) where Step 14 of F3->F4 arrives!
    { x: -12.4, z: 9.75, w: 6.4, d: 6.5 }, // Outer West strip (lx: -15.6 .. -9.2)
    { x: 4.9, z: 9.75, w: 21.4, d: 6.5 }, // Center + East terrace (lx: -5.8 .. +15.6)
  ];
  roofPlates.forEach((rp) => {
    const rGeo = tracker.trackGeo(new THREE.BoxGeometry(rp.w, roofSlabThickness, rp.d));
    rGeo.translate(rp.x, roofSlabCenterY, rp.z);
    const rMesh = new THREE.Mesh(rGeo, mats.blushRoseMarble);
    rMesh.receiveShadow = true;
    group.add(rMesh);
    cameraOccluders.push(rMesh);
  });

  // Protective Gold Balustrade Rail on Floor 4 at the south drop-off edge of the F3->F4 stairwell (z = 6.45, lx = -9.2..-5.8)
  const f4WellBackRail = new THREE.Mesh(wellBackRailGeo, loveRibbonGoldMat);
  f4WellBackRail.position.set(scWest34.startX, 15.25 + 0.46, scWest34.startZ - 0.08);
  group.add(f4WellBackRail);

  const domeGeo = tracker.trackGeo(new THREE.SphereGeometry(4.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45));
  domeGeo.translate(0, 15.25, 0);
  const glassDome = new THREE.Mesh(domeGeo, mats.crystalGlass);
  const domeFinialGeo = tracker.trackGeo(new THREE.SphereGeometry(0.4, 8, 8));
  domeFinialGeo.translate(0, 18.45, 0);
  const domeFinial = new THREE.Mesh(domeFinialGeo, mats.champagneGold);
  group.add(glassDome, domeFinial);

  const roofRailNGeo = tracker.trackGeo(new THREE.BoxGeometry(30.7, 0.88, 0.14));
  roofRailNGeo.translate(0, 15.69, -15.35);
  const roofRailSGeo = tracker.trackGeo(new THREE.BoxGeometry(30.7, 0.88, 0.14));
  roofRailSGeo.translate(0, 15.69, 15.35);
  const roofRailWGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.88, 30.7));
  roofRailWGeo.translate(-15.35, 15.69, 0);
  const roofRailEGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.88, 30.7));
  roofRailEGeo.translate(15.35, 15.69, 0);

  const rRailN = new THREE.Mesh(roofRailNGeo, mats.champagneGold);
  const rRailS = new THREE.Mesh(roofRailSGeo, mats.champagneGold);
  const rRailW = new THREE.Mesh(roofRailWGeo, mats.champagneGold);
  const rRailE = new THREE.Mesh(roofRailEGeo, mats.champagneGold);
  group.add(rRailN, rRailS, rRailW, rRailE);

  const telescopeGroup = new THREE.Group();
  telescopeGroup.position.set(0, 15.25, -13.5);

  const teleBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.65, 0.85, 0.25, 12));
  const telePierGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 1.35, 10));
  telePierGeo.translate(0, 0.75, 0);
  const teleTubeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 2.2, 12));
  teleTubeGeo.rotateX(Math.PI / 4.5);
  teleTubeGeo.translate(0, 1.48, 0.35);

  const teleBase = new THREE.Mesh(teleBaseGeo, mats.champagneGold);
  const telePier = new THREE.Mesh(telePierGeo, mats.champagneGold);
  const teleTube = new THREE.Mesh(teleTubeGeo, mats.telescopeBrass);
  telescopeGroup.add(teleBase, telePier, teleTube);
  group.add(telescopeGroup);

  const planterBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(2.2, 0.55, 0.85));
  planterBoxGeo.translate(0, 15.52, 0);
  const blossomBushGeo = tracker.trackGeo(new THREE.SphereGeometry(0.55, 10, 8));
  blossomBushGeo.scale(1.6, 0.75, 0.9);
  blossomBushGeo.translate(0, 15.95, 0);
  const lanternPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.45, 8));
  lanternPostGeo.translate(0, 16.0, 0);
  const lanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.22, 10, 10));
  lanternOrbGeo.translate(0, 16.8, 0);

  [
    { x: -8.5, z: -13.8 },
    { x: 8.5, z: -13.8 },
    { x: -11.5, z: 14.2 },
    { x: 11.5, z: 14.2 },
  ].forEach((pt) => {
    const planter = new THREE.Mesh(planterBoxGeo, mats.pearlWhite);
    planter.position.set(pt.x, 0, pt.z);
    const bush = new THREE.Mesh(blossomBushGeo, mats.blushRoseMarble);
    bush.position.set(pt.x, 0, pt.z);
    const lPost = new THREE.Mesh(lanternPostGeo, mats.champagneGold);
    lPost.position.set(pt.x * 1.12, 0, pt.z);
    const lOrb = new THREE.Mesh(lanternOrbGeo, mats.warmLanternGlow);
    lOrb.position.set(pt.x * 1.12, 0, pt.z);
    group.add(planter, bush, lPost, lOrb);
  });

  const rooftopLight = new THREE.PointLight('#fef08a', 1.8, 18.0, 1.6);
  rooftopLight.position.set(0, 17.5, 0);
  group.add(rooftopLight);

  // ========================================================================
  // 9. LEVEL -1: BASEMENT VAULT & SERVICE STAIRS (TOP SURFACE Y = -4.5m)
  // ========================================================================
  const basementFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(26.0, 0.5, 26.0));
  basementFloorGeo.translate(0, -4.75, 0); // topY === -4.5m
  const basementFloor = new THREE.Mesh(basementFloorGeo, mats.creamStone);
  basementFloor.receiveShadow = true;
  group.add(basementFloor);

  const scBasement = CASTLE_STAIRCASE_CONFIGS[4];
  const numStepsB = scBasement.stepCount;
  const absStepHB = Math.abs(scBasement.stepHeight);
  const stepDB = scBasement.stepDepth;
  const stepBGeo = tracker.trackGeo(
    new THREE.BoxGeometry(scBasement.stepWidth, absStepHB, stepDB + 0.05),
  );

  for (let s = 0; s < numStepsB; s++) {
    const sz = scBasement.startZ + (s + 0.5) * stepDB;
    const topY = scBasement.startY + (s + 1) * scBasement.stepHeight;
    const sy = topY - 0.5 * absStepHB;
    const stp = new THREE.Mesh(stepBGeo, mats.creamStone);
    stp.position.set(scBasement.startX, sy, sz);
    stp.receiveShadow = true;
    stp.updateMatrix();
    stp.matrixAutoUpdate = false;
    group.add(stp);
  }

  // Validate physical staircase-to-floor-slab connections and optional wireframe debug helpers
  nav.validateStaircaseConnections();
  const DEBUG_STAIRCASES = false;
  if (DEBUG_STAIRCASES) {
    const debugStairsGroup = new THREE.Group();
    debugStairsGroup.name = 'DebugStaircases';
    const debugLineMat = tracker.trackMat(new THREE.LineBasicMaterial({ color: 0x00ffcc }));
    CASTLE_STAIRCASE_CONFIGS.forEach((sc) => {
      const pts = [
        new THREE.Vector3(sc.startX, sc.startY, sc.startZ),
        new THREE.Vector3(sc.endX, sc.endY, sc.endZ),
      ];
      const lineGeo = tracker.trackGeo(new THREE.BufferGeometry().setFromPoints(pts));
      debugStairsGroup.add(new THREE.Line(lineGeo, debugLineMat));
    });
    group.add(debugStairsGroup);
  }

  // ========================================================================
  // 10. BARBIE CASTLE ROYAL CRYSTAL ELEVATOR (RoyalElevator)
  //     SCENE GRAPH: RoyalElevator -> Shaft, Doors, Cabin, ControlPanel, FloorIndicator
  // ========================================================================
  const elevatorShaftX = nav.elevatorShaftLocalX;
  const elevatorShaftZ = nav.elevatorShaftLocalZ;

  const royalElevatorGroup = new THREE.Group();
  royalElevatorGroup.name = 'RoyalElevator';
  const reShaftGroup = new THREE.Group();
  reShaftGroup.name = 'Shaft';
  const reDoorsGroup = new THREE.Group();
  reDoorsGroup.name = 'Doors';
  const cabinGroup = new THREE.Group();
  cabinGroup.name = 'Cabin';
  const crystalPanelGroup = new THREE.Group();
  crystalPanelGroup.name = 'ControlPanel';
  const reFloorIndicatorGroup = new THREE.Group();
  reFloorIndicatorGroup.name = 'FloorIndicator';

  royalElevatorGroup.add(reShaftGroup, cabinGroup, reFloorIndicatorGroup);
  group.add(royalElevatorGroup);

  // --- Helper CanvasTextures for the Barbie Castle Elevator ---
  // 10.1 Marble Pink-and-White Compass-Star & Crown Inlaid Cabin Floor Texture ("TOP VIEW / INSIDE VIEW")
  const createElevatorCabinFloorTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = 256;
      const cy = 256;

      const bgGrad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 250);
      bgGrad.addColorStop(0, '#fff1f2');
      bgGrad.addColorStop(0.48, '#fce7f3');
      bgGrad.addColorStop(0.78, '#fbcfe8');
      bgGrad.addColorStop(0.92, '#f472b6');
      bgGrad.addColorStop(1, '#d8b467');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(216, 180, 103, 0.55)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI * 2) / 12;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 95, cy + Math.sin(ang) * 95);
        ctx.lineTo(cx + Math.cos(ang) * 236, cy + Math.sin(ang) * 236);
        ctx.stroke();
      }

      const rings = [
        { r: 238, color: '#d8b467', w: 8 },
        { r: 222, color: '#fdf2f8', w: 5 },
        { r: 196, color: '#d8b467', w: 4 },
        { r: 142, color: '#f472b6', w: 4 },
        { r: 96, color: '#d8b467', w: 5 },
      ];
      rings.forEach((rg) => {
        ctx.beginPath();
        ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = rg.w;
        ctx.stroke();
      });

      for (let p = 0; p < 8; p++) {
        const ang = (p * Math.PI * 2) / 8;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(26, -85, 0, -172);
        ctx.quadraticCurveTo(-26, -85, 0, -18);
        ctx.closePath();
        ctx.fillStyle = p % 2 === 0 ? '#f472b6' : '#fbcfe8';
        ctx.fill();
        ctx.strokeStyle = '#d8b467';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fillStyle = '#fffdf9';
      ctx.fill();
      ctx.strokeStyle = '#d8b467';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = '#d8b467';
      ctx.font = 'bold 52px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♕', cx, cy - 2);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // 10.2 Faceted Pink Crystal Glass Texture for Curved Doors & Shaft Panels
  const createPinkCrystalFacetTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 256, 512);
      grad.addColorStop(0, 'rgba(251, 207, 232, 0.88)');
      grad.addColorStop(0.35, 'rgba(244, 114, 182, 0.82)');
      grad.addColorStop(0.7, 'rgba(236, 72, 153, 0.86)');
      grad.addColorStop(1, 'rgba(251, 207, 232, 0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 512);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 2;
      for (let y = -128; y < 640; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y + 128);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(256, y);
        ctx.lineTo(0, y + 128);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
      ctx.font = '28px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('♕', 128, 140);
      ctx.fillText('♡', 128, 256);
      ctx.fillText('✦', 128, 372);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // 10.3 Royal Pink & Gold Crown Welcome Rug Texture in front of Elevator Entrance
  const createElevatorWelcomeRugTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, '#be185d');
      grad.addColorStop(0.5, '#ec4899');
      grad.addColorStop(1, '#be185d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 10;
      ctx.strokeRect(14, 14, 484, 228);
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 28, 456, 200);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♕', 256, 118);

      ctx.font = 'italic bold 20px Georgia, serif';
      ctx.fillStyle = '#fff1f2';
      ctx.fillText('✦ BARBIE ROYAL ELEVATOR ✦', 256, 182);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // 10.4 Dynamic Magical Holographic Floor Indicator Plaque Texture ("FLOOR 1..4 / BASEMENT")
  // Strictly un-mirrored (ctx.scale(1, 1), THREE.FrontSide, positive mesh scale)
  const floorIndicatorCanvas = document.createElement('canvas');
  floorIndicatorCanvas.width = 512;
  floorIndicatorCanvas.height = 256;
  const floorIndicatorCtx = floorIndicatorCanvas.getContext('2d');
  const floorIndicatorTex = tracker.trackTex(new THREE.CanvasTexture(floorIndicatorCanvas));
  floorIndicatorTex.colorSpace = THREE.SRGBColorSpace;
  floorIndicatorTex.flipY = true;

  const drawMagicalFloorIndicator = (floorId: number) => {
    if (!floorIndicatorCtx) return;
    const ctx = floorIndicatorCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(1, 1);
    ctx.clearRect(0, 0, 512, 256);

    const grad = ctx.createRadialGradient(256, 128, 12, 256, 128, 235);
    grad.addColorStop(0, 'rgba(244, 114, 182, 0.96)');
    grad.addColorStop(0.55, 'rgba(219, 39, 119, 0.92)');
    grad.addColorStop(1, 'rgba(131, 24, 67, 0.94)');

    ctx.beginPath();
    ctx.moveTo(256, 18);
    ctx.lineTo(476, 128);
    ctx.lineTo(256, 238);
    ctx.lineTo(36, 128);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(256, 32);
    ctx.lineTo(452, 128);
    ctx.lineTo(256, 224);
    ctx.lineTo(60, 128);
    ctx.closePath();
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const label =
      floorId === -1 ? 'BASEMENT' : `FLOOR ${floorId}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText('♕', 256, 66);

    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText(label, 256, 128);
    ctx.restore();

    ctx.fillStyle = '#fef08a';
    ctx.font = '20px Georgia, serif';
    ctx.fillText('✦   ✦   ✦   ✦   ✦', 256, 184);

    floorIndicatorTex.needsUpdate = true;
  };
  drawMagicalFloorIndicator(1);

  // 10.5 Floating Crystal Control Panel Texture inside the Cabin ("1, 2, 3, 4, B")
  // Strictly un-mirrored (ctx.scale(1, 1), THREE.FrontSide)
  const controlPanelCanvas = document.createElement('canvas');
  controlPanelCanvas.width = 256;
  controlPanelCanvas.height = 420;
  const controlPanelCtx = controlPanelCanvas.getContext('2d');
  const controlPanelTex = tracker.trackTex(new THREE.CanvasTexture(controlPanelCanvas));
  controlPanelTex.colorSpace = THREE.SRGBColorSpace;
  controlPanelTex.flipY = true;

  const drawCrystalControlPanel = (activeFloorId: number) => {
    if (!controlPanelCtx) return;
    const ctx = controlPanelCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(1, 1);
    ctx.clearRect(0, 0, 256, 420);

    const bg = ctx.createLinearGradient(0, 0, 256, 420);
    bg.addColorStop(0, 'rgba(251, 207, 232, 0.88)');
    bg.addColorStop(0.5, 'rgba(244, 114, 182, 0.82)');
    bg.addColorStop(1, 'rgba(219, 39, 119, 0.88)');
    ctx.fillStyle = bg;
    ctx.fillRect(10, 10, 236, 400);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 228, 392);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 208, 372);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('♕', 128, 54);

    const buttons: Array<{ id: number; label: string; x: number; y: number }> = [
      { id: 3, label: '3', x: 82, y: 126 },
      { id: 4, label: '4', x: 174, y: 126 },
      { id: 1, label: '1', x: 82, y: 206 },
      { id: 2, label: '2', x: 174, y: 206 },
      { id: -1, label: 'B', x: 128, y: 284 },
    ];

    buttons.forEach((btn) => {
      const isSelected = btn.id === activeFloorId;
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, 29, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#fde047' : 'rgba(255, 241, 242, 0.32)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : '#fde047';
      ctx.lineWidth = isSelected ? 4 : 2.5;
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#9d174d' : '#ffffff';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(btn.label, btn.x, btn.y + 2);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.fillRect(44, 338, 168, 38);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 338, 168, 38);
    ctx.fillStyle = '#fffdf9';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('◄◄  ✦ OPEN ✦  ►►', 128, 358);

    controlPanelTex.needsUpdate = true;
  };
  drawCrystalControlPanel(1);

  // 10.5B Crown-Etched Frosted Glass Motif Texture (Shaft & Cabin Frosted Glass Panels)
  const createCrownEtchedFrostedGlassTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const bg = ctx.createLinearGradient(0, 0, 512, 512);
      bg.addColorStop(0, 'rgba(253, 242, 248, 0.78)');
      bg.addColorStop(0.5, 'rgba(251, 207, 232, 0.72)');
      bg.addColorStop(1, 'rgba(253, 242, 248, 0.8)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(216, 180, 103, 0.85)';
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 18, 476, 476);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(30, 30, 452, 452);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = 1.8;
      for (let i = -256; i < 768; i += 64) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i + 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(512, i);
        ctx.lineTo(0, i + 256);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rows = [110, 256, 402];
      const cols = [128, 256, 384];
      for (const ry of rows) {
        for (const cx of cols) {
          ctx.beginPath();
          ctx.arc(cx, ry, 42, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(216, 180, 103, 0.75)';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.font = 'bold 34px Georgia, serif';
          ctx.fillText('♕', cx, ry - 6);
          ctx.fillStyle = 'rgba(244, 114, 182, 0.85)';
          ctx.font = '18px Georgia, serif';
          ctx.fillText('♡', cx, ry + 20);
        }
      }
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // 10.5C Tufted Blush-Pink Velvet (#fbcfe8) Upholstery Texture with Diamond Quilting & Gold Studs
  const createTuftedBlushVelvetTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(0, 0, 512, 256);

      const stepX = 64;
      const stepY = 64;
      for (let y = 0; y <= 256; y += stepY) {
        for (let x = 0; x <= 512; x += stepX) {
          const pillow = ctx.createRadialGradient(x + 32, y + 28, 4, x + 32, y + 32, 36);
          pillow.addColorStop(0, 'rgba(255, 241, 242, 0.65)');
          pillow.addColorStop(0.65, 'rgba(251, 207, 232, 0.25)');
          pillow.addColorStop(1, 'rgba(190, 24, 93, 0.22)');
          ctx.fillStyle = pillow;
          ctx.fillRect(x, y, stepX, stepY);
        }
      }

      ctx.strokeStyle = 'rgba(157, 23, 77, 0.34)';
      ctx.lineWidth = 3;
      for (let x = -256; x <= 768; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 256, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 256, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }

      for (let y = 0; y <= 256; y += stepY) {
        for (let x = 0; x <= 512; x += stepX) {
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = '#d8b467';
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.needsUpdate = true;
    return tex;
  };

  // --- Shared Barbie Elevator Materials ---
  const polishedGoldFiligreeMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d8b467'),
      emissive: new THREE.Color('#b45309'),
      emissiveIntensity: 0.14,
      roughness: 0.16,
      metalness: 0.9,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
    }),
  );

  const crownEtchedFrostedGlassMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: createCrownEtchedFrostedGlassTexture(),
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.18,
      roughness: 0.2,
      metalness: 0.08,
      transmission: 0.48,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
    }),
  );

  const pinkCrystalDoorMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: createPinkCrystalFacetTexture(),
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.28,
      roughness: 0.14,
      metalness: 0.15,
      clearcoat: 0.65,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    }),
  );

  const pinkLedStripMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f43f5e'),
      emissiveIntensity: 1.55,
      roughness: 0.18,
    }),
  );

  const pinkCrystalGemMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f472b6'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 0.8,
    }),
  );

  // Strictly THREE.FrontSide so text is NEVER mirrored from behind!
  const floorIndicatorPlaqueMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: floorIndicatorTex,
      transparent: true,
      side: THREE.FrontSide,
    }),
  );

  const controlPanelMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: controlPanelTex,
      transparent: true,
      side: THREE.FrontSide,
    }),
  );

  const welcomeRugMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: createElevatorWelcomeRugTexture(),
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );

  // --- 10.6 Slightly Oval Pink-Tinted Crystal Elevator Shaft + Champagne-Gold Ribs ---
  const shaftTowerGlassGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.94, 1.94, 24.7, 28, 1, true, -Math.PI * 0.78, Math.PI * 1.56),
  );
  // Slightly oval cross-section (1.06x wider in X, 0.96x in Z) for royal crystal elegance
  shaftTowerGlassGeo.scale(1.06, 1.0, 0.96);
  shaftTowerGlassGeo.translate(elevatorShaftX, 7.85, elevatorShaftZ);
  const shaftTowerGlassMesh = new THREE.Mesh(shaftTowerGlassGeo, crownEtchedFrostedGlassMat);
  reShaftGroup.add(shaftTowerGlassMesh);

  const shaftColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 24.8, 12));
  shaftColGeo.translate(0, 7.9, 0);
  const shaftLedStripGeo = tracker.trackGeo(new THREE.BoxGeometry(0.052, 24.6, 0.052));
  shaftLedStripGeo.translate(0, 7.9, 0);
  const guideColCollarGeo = tracker.trackGeo(new THREE.TorusGeometry(0.155, 0.032, 8, 16));
  guideColCollarGeo.rotateX(Math.PI / 2);

  const shaftCornerOffsets = [
    { x: -1.82, z: -1.72 },
    { x: 1.82, z: -1.72 },
    { x: -1.82, z: 1.72 },
    { x: 1.82, z: 1.72 },
  ];
  shaftCornerOffsets.forEach((off) => {
    const colX = elevatorShaftX + off.x;
    const colZ = elevatorShaftZ + off.z;
    const guideCol = new THREE.Mesh(shaftColGeo, polishedGoldFiligreeMat);
    guideCol.position.set(colX, 0, colZ);
    guideCol.castShadow = true;

    const dirX = Math.sign(off.x);
    const dirZ = Math.sign(off.z);
    const ledOuter = new THREE.Mesh(shaftLedStripGeo, pinkLedStripMat);
    ledOuter.position.set(colX + dirX * 0.095, 0, colZ - dirZ * 0.095);
    const ledInner = new THREE.Mesh(shaftLedStripGeo, pinkLedStripMat);
    ledInner.position.set(colX - dirX * 0.095, 0, colZ + dirZ * 0.095);
    reShaftGroup.add(guideCol, ledOuter, ledInner);

    CASTLE_FLOOR_DEFS.forEach((f) => {
      const collar = new THREE.Mesh(guideColCollarGeo, polishedGoldFiligreeMat);
      collar.position.set(colX, f.elevOffset + 0.08, colZ);
      reShaftGroup.add(collar);
    });

    colliders.push({
      x: nav.originX + colX,
      z: nav.originZ + colZ,
      radius: 0.52,
    });
  });

  // Crown-Etched Frosted Glass Panels framed by Polished Champagne-Gold Filigree on Left, Right, and Rear of Shaft
  const frostedSidePanelGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.25, 4.65));
  const filigreeScrollRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.28, 0.024, 8, 18));
  CASTLE_FLOOR_DEFS.forEach((f) => {
    [-1.85, 1.85].forEach((sx) => {
      const sidePanel = new THREE.Mesh(frostedSidePanelGeo, crownEtchedFrostedGlassMat);
      sidePanel.position.set(elevatorShaftX + sx, f.elevOffset + 2.4, elevatorShaftZ);
      sidePanel.rotation.y = Math.PI / 2;
      reShaftGroup.add(sidePanel);
    });
    const rearPanel = new THREE.Mesh(frostedSidePanelGeo, crownEtchedFrostedGlassMat);
    rearPanel.position.set(elevatorShaftX, f.elevOffset + 2.4, elevatorShaftZ + 1.75);
    [-1.25, 1.25].forEach((rx) => {
      const scroll = new THREE.Mesh(filigreeScrollRingGeo, polishedGoldFiligreeMat);
      scroll.position.set(elevatorShaftX + rx, f.elevOffset + 4.25, elevatorShaftZ + 1.77);
      reShaftGroup.add(scroll);
    });
    reShaftGroup.add(rearPanel);
  });

  const shaftColumnAngles = [
    -Math.PI * 0.78,
    -Math.PI * 0.48,
    -Math.PI * 0.18,
    Math.PI * 0.18,
    Math.PI * 0.48,
    Math.PI * 0.78,
  ];
  shaftColumnAngles.forEach((ang) => {
    const colX = elevatorShaftX + Math.sin(ang) * 2.06;
    const colZ = elevatorShaftZ + Math.cos(ang) * 1.92;
    const col = new THREE.Mesh(shaftColGeo, polishedGoldFiligreeMat);
    col.position.set(colX, 0, colZ);
    col.castShadow = true;

    const led = new THREE.Mesh(shaftLedStripGeo, pinkLedStripMat);
    led.position.set(
      elevatorShaftX + Math.sin(ang) * 1.98,
      0,
      elevatorShaftZ + Math.cos(ang) * 1.84,
    );
    reShaftGroup.add(col, led);
  });

  [
    { x: -1.85, z: -0.6 },
    { x: -1.85, z: 0.6 },
    { x: 1.85, z: -0.6 },
    { x: 1.85, z: 0.6 },
    { x: -0.7, z: 1.85 },
    { x: 0.0, z: 1.9 },
    { x: 0.7, z: 1.85 },
  ].forEach((sc) => {
    colliders.push({
      x: nav.originX + elevatorShaftX + sc.x,
      z: nav.originZ + elevatorShaftZ + sc.z,
      radius: 0.54,
    });
  });

  // --- 10.7 Giant Glowing Royal Crown Spire at the Top of the Elevator Shaft ---
  const shaftTopCrownGroup = new THREE.Group();
  shaftTopCrownGroup.position.set(elevatorShaftX, 20.2, elevatorShaftZ);

  const crownBaseBandGeo = tracker.trackGeo(new THREE.TorusGeometry(2.04, 0.14, 12, 32));
  crownBaseBandGeo.rotateX(Math.PI / 2);
  const crownUpperBandGeo = tracker.trackGeo(new THREE.TorusGeometry(2.14, 0.09, 10, 32));
  crownUpperBandGeo.rotateX(Math.PI / 2);
  crownUpperBandGeo.translate(0, 0.42, 0);
  shaftTopCrownGroup.add(
    new THREE.Mesh(crownBaseBandGeo, polishedGoldFiligreeMat),
    new THREE.Mesh(crownUpperBandGeo, polishedGoldFiligreeMat),
  );

  const crownPeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 1.65, 5));
  crownPeakGeo.translate(0, 0.825, 0);
  const crownGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.22, 0));
  const crownPearlTipGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const px = Math.sin(ang) * 2.08;
    const pz = Math.cos(ang) * 2.08;

    const peak = new THREE.Mesh(crownPeakGeo, polishedGoldFiligreeMat);
    peak.position.set(px, 0.36, pz);
    peak.rotation.y = ang;
    peak.rotation.x = Math.cos(ang) * 0.14;
    peak.rotation.z = -Math.sin(ang) * 0.14;

    const tipOrb = new THREE.Mesh(crownPearlTipGeo, pinkLedStripMat);
    tipOrb.position.set(Math.sin(ang) * 2.28, 2.02, Math.cos(ang) * 2.28);

    const gem = new THREE.Mesh(crownGemGeo, pinkCrystalGemMat);
    gem.position.set(Math.sin(ang) * 2.18, 0.22, Math.cos(ang) * 2.18);
    gem.scale.set(0.85, 1.25, 0.65);
    gem.rotation.y = ang;

    shaftTopCrownGroup.add(peak, tipOrb, gem);
  }

  const crownSpireConeGeo = tracker.trackGeo(new THREE.ConeGeometry(1.88, 2.9, 20));
  crownSpireConeGeo.translate(0, 1.45, 0);
  const crownSpireCone = new THREE.Mesh(crownSpireConeGeo, pinkCrystalDoorMat);
  const spireFinialStem = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.05, 0.09, 0.95, 8)).translate(0, 3.2, 0),
    polishedGoldFiligreeMat,
  );
  shaftTopCrownGroup.add(crownSpireCone, spireFinialStem);

  const elevHeartLobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
  elevHeartLobeGeo.scale(1.0, 1.0, 0.45);
  const elevHeartTipGeo = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.19, 8));
  elevHeartTipGeo.rotateX(Math.PI);
  elevHeartTipGeo.scale(1.0, 1.0, 0.45);

  const buildHeartIndicatorMesh = (mat: THREE.Material): THREE.Group => {
    const hg = new THREE.Group();
    const l = new THREE.Mesh(elevHeartLobeGeo, mat);
    l.position.set(-0.055, 0.045, 0);
    const r = new THREE.Mesh(elevHeartLobeGeo, mat);
    r.position.set(0.055, 0.045, 0);
    const t = new THREE.Mesh(elevHeartTipGeo, mat);
    t.position.set(0, -0.065, 0);
    hg.add(l, r, t);
    return hg;
  };

  const miniCrownBandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.15, 0.08, 12));
  const miniCrownSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.045, 0.16, 5));
  miniCrownSpireGeo.translate(0, 0.08, 0);
  const buildMiniGoldenCrown = (scale = 1.0): THREE.Group => {
    const cg = new THREE.Group();
    const band = new THREE.Mesh(miniCrownBandGeo, polishedGoldFiligreeMat);
    cg.add(band);
    for (let s = 0; s < 5; s++) {
      const ang = (s / 4 - 0.5) * Math.PI * 0.85;
      const sp = new THREE.Mesh(miniCrownSpireGeo, polishedGoldFiligreeMat);
      sp.position.set(Math.sin(ang) * 0.15, 0.03, Math.cos(ang) * 0.08);
      sp.rotation.z = -ang * 0.35;
      if (s === 2) sp.scale.set(1.2, 1.35, 1.2);
      cg.add(sp);
    }
    const centerGem = new THREE.Mesh(crownGemGeo, pinkCrystalGemMat);
    centerGem.scale.setScalar(0.22);
    centerGem.position.set(0, 0.01, 0.16);
    cg.add(centerGem);
    cg.scale.setScalar(scale);
    return cg;
  };

  const topSpireHeartFinial = buildHeartIndicatorMesh(pinkLedStripMat);
  topSpireHeartFinial.position.set(0, 3.78, 0);
  topSpireHeartFinial.scale.setScalar(2.8);
  shaftTopCrownGroup.add(topSpireHeartFinial);
  reShaftGroup.add(shaftTopCrownGroup);

  // --- 10.8 Castle-Gate Style Floor Landings, Royal Welcome Rugs & Un-Mirrored Floor Indicators ---
  interface ElevatorHeartIndicator {
    floorId: number;
    elevOffset: number;
    mat: THREE.MeshStandardMaterial;
  }
  const elevatorHeartIndicators: ElevatorHeartIndicator[] = [];

  const landingPilasterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 2.75, 12));
  landingPilasterGeo.translate(0, 1.375, 0);
  const landingRugGeo = tracker.trackGeo(new THREE.BoxGeometry(2.25, 0.016, 1.25));
  const indicatorPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.96, 0.48));
  let lastDisplayedFloorId = 1;

  CASTLE_FLOOR_DEFS.forEach((f) => {
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(2.04, 0.075, 10, 28));
    ringGeo.rotateX(Math.PI / 2);
    ringGeo.scale(1.06, 1.0, 0.96);
    ringGeo.translate(elevatorShaftX, f.elevOffset, elevatorShaftZ);
    const ring = new THREE.Mesh(ringGeo, polishedGoldFiligreeMat);

    const pinkRingGeo = tracker.trackGeo(new THREE.TorusGeometry(2.06, 0.032, 8, 28));
    pinkRingGeo.rotateX(Math.PI / 2);
    pinkRingGeo.scale(1.06, 1.0, 0.96);
    pinkRingGeo.translate(elevatorShaftX, f.elevOffset + 0.1, elevatorShaftZ);
    const pinkRing = new THREE.Mesh(pinkRingGeo, pinkLedStripMat);
    reShaftGroup.add(ring, pinkRing);

    [-1.16, 1.16].forEach((px) => {
      const pil = new THREE.Mesh(landingPilasterGeo, mats.pearlWhite);
      pil.position.set(elevatorShaftX + px, f.elevOffset, elevatorShaftZ - 1.88);
      const cap = new THREE.Mesh(
        tracker.trackGeo(new THREE.CylinderGeometry(0.2, 0.16, 0.16, 12)).translate(
          elevatorShaftX + px,
          f.elevOffset + 2.72,
          elevatorShaftZ - 1.88,
        ),
        polishedGoldFiligreeMat,
      );
      reShaftGroup.add(pil, cap);
    });

    const rug = new THREE.Mesh(landingRugGeo, welcomeRugMat);
    rug.position.set(elevatorShaftX, f.elevOffset + 0.025, elevatorShaftZ - 2.58);
    rug.rotation.y = Math.PI; // Orient top UV so text reads right-side-up and left-to-right when approaching elevator (-Z looking +Z)
    reShaftGroup.add(rug);

    const headerOuterArch = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(1.16, 0.075, 10, 24, Math.PI)).translate(
        elevatorShaftX,
        f.elevOffset + 2.52,
        elevatorShaftZ - 1.88,
      ),
      polishedGoldFiligreeMat,
    );
    const headerInnerArch = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(1.02, 0.04, 8, 24, Math.PI)).translate(
        elevatorShaftX,
        f.elevOffset + 2.52,
        elevatorShaftZ - 1.86,
      ),
      pinkLedStripMat,
    );

    const indMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fda4af'),
        emissive: new THREE.Color('#f43f5e'),
        emissiveIntensity: 0.9,
        roughness: 0.2,
      }),
    );
    const landingHeart = buildHeartIndicatorMesh(indMat);
    landingHeart.position.set(elevatorShaftX, f.elevOffset + 3.42, elevatorShaftZ - 1.94);
    landingHeart.scale.setScalar(1.35);

    const archCrown = buildMiniGoldenCrown(1.15);
    archCrown.position.set(elevatorShaftX, f.elevOffset + 3.66, elevatorShaftZ - 1.94);
    archCrown.rotation.y = Math.PI;

    // Exterior Floor Indicator Plaque: rotation.y = Math.PI so its +Z front normal points toward the Grand Hall (-Z)!
    const indPlaque = new THREE.Mesh(indicatorPlaqueGeo, floorIndicatorPlaqueMat);
    indPlaque.position.set(elevatorShaftX, f.elevOffset + 3.04, elevatorShaftZ - 1.93);
    indPlaque.rotation.y = Math.PI;
    indPlaque.scale.set(1, 1, 1);

    reFloorIndicatorGroup.add(headerOuterArch, headerInnerArch, landingHeart, archCrown, indPlaque);
    elevatorHeartIndicators.push({ floorId: f.id, elevOffset: f.elevOffset, mat: indMat });
  });

  // --- 10.9 Barbie Castle Elevator Cabin (Inside View & Top View) ---
  cabinGroup.position.set(elevatorShaftX, nav.elevatorCabinY - nav.baseY, elevatorShaftZ);

  const cabinFloorMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: createElevatorCabinFloorTexture(),
      roughness: 0.22,
      metalness: 0.08,
    }),
  );
  const cabinFloorGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.85, 1.85, 0.22, 28));
  cabinFloorGeo.translate(0, -0.11, 0);
  const cabinFloorMesh = new THREE.Mesh(cabinFloorGeo, cabinFloorMat);
  cabinFloorMesh.receiveShadow = true;

  const cabinFloorGlowRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.78, 0.028, 8, 28)).rotateX(Math.PI / 2).translate(0, 0.02, 0),
    pinkLedStripMat,
  );
  const cabinGoldBaseboardRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.75, 0.036, 8, 28, Math.PI * 1.46))
      .rotateX(Math.PI / 2)
      .rotateY(Math.PI * 0.77)
      .translate(0, 0.05, 0),
    polishedGoldFiligreeMat,
  );
  cabinGroup.add(cabinFloorGlowRing, cabinGoldBaseboardRing);

  const cabinCeilGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.85, 1.85, 0.16, 28));
  cabinCeilGeo.translate(0, 2.68, 0);
  const cabinCeilMesh = new THREE.Mesh(cabinCeilGeo, polishedGoldFiligreeMat);

  const cabinCeilGlowDisc = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.62, 1.62, 0.02, 24)).translate(0, 2.59, 0),
    pinkLedStripMat,
  );
  cabinGroup.add(cabinCeilGlowDisc);

  const cabinCrystalDomeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(1.84, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
  );
  cabinCrystalDomeGeo.translate(0, 2.72, 0);
  const cabinDomeMesh = new THREE.Mesh(cabinCrystalDomeGeo, crownEtchedFrostedGlassMat);

  const domeRibGeo = tracker.trackGeo(new THREE.TorusGeometry(1.85, 0.035, 8, 20, Math.PI));
  for (let rb = 0; rb < 3; rb++) {
    const rib = new THREE.Mesh(domeRibGeo, polishedGoldFiligreeMat);
    rib.position.set(0, 2.72, 0);
    rib.rotation.y = (rb * Math.PI) / 3;
    cabinGroup.add(rib);
  }
  const domeCrownFinial = buildMiniGoldenCrown(1.85);
  domeCrownFinial.position.set(0, 4.62, 0);
  cabinGroup.add(domeCrownFinial);

  const crownChandelierGroup = new THREE.Group();
  crownChandelierGroup.position.set(0, 2.32, 0);

  const chandChain = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8)).translate(0, 0.18, 0),
    polishedGoldFiligreeMat,
  );
  const chandBand = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.42, 0.042, 10, 24)).rotateX(Math.PI / 2),
    polishedGoldFiligreeMat,
  );
  const chandInnerGlow = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.22, 12, 10)),
    mats.warmLanternGlow,
  );
  crownChandelierGroup.add(chandChain, chandBand, chandInnerGlow);

  const chandPeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.075, 0.26, 5));
  chandPeakGeo.translate(0, 0.13, 0);
  const chandDropGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.055, 0));
  for (let c = 0; c < 8; c++) {
    const ang = (c * Math.PI * 2) / 8;
    const pk = new THREE.Mesh(chandPeakGeo, polishedGoldFiligreeMat);
    pk.position.set(Math.sin(ang) * 0.42, 0.02, Math.cos(ang) * 0.42);
    pk.rotation.y = ang;
    const drop = new THREE.Mesh(chandDropGeo, pinkCrystalGemMat);
    drop.position.set(Math.sin(ang) * 0.36, -0.12, Math.cos(ang) * 0.36);
    drop.scale.set(0.7, 1.4, 0.7);
    crownChandelierGroup.add(pk, drop);
  }
  cabinGroup.add(crownChandelierGroup);

  const cabinGlassGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.82, 1.82, 2.6, 28, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
  );
  cabinGlassGeo.translate(0, 1.3, 0);
  const cabinGlassMesh = new THREE.Mesh(cabinGlassGeo, crownEtchedFrostedGlassMat);

  const cabinMullionGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.034, 0.034, 2.6, 8));
  cabinMullionGeo.translate(0, 1.3, 0);
  [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].forEach((mFrac) => {
    const ang = mFrac * Math.PI;
    const mul = new THREE.Mesh(cabinMullionGeo, polishedGoldFiligreeMat);
    mul.position.set(Math.sin(ang) * 1.81, 0, Math.cos(ang) * 1.81);
    const topScroll = new THREE.Mesh(filigreeScrollRingGeo, polishedGoldFiligreeMat);
    topScroll.scale.setScalar(0.55);
    topScroll.position.set(Math.sin(ang) * 1.77, 2.38, Math.cos(ang) * 1.77);
    topScroll.rotation.y = ang;
    cabinGroup.add(mul, topScroll);
  });

  const cabinVelvetMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: createTuftedBlushVelvetTexture(),
      color: new THREE.Color('#fbcfe8'),
      roughness: 0.48,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
  );
  const cabinVelvetPaddingGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.75, 1.75, 1.02, 28, 1, true, -Math.PI * 0.72, Math.PI * 1.44),
  );
  cabinVelvetPaddingGeo.translate(0, 0.54, 0);
  const cabinVelvetPaddingMesh = new THREE.Mesh(cabinVelvetPaddingGeo, cabinVelvetMat);

  const velvetTuftStudGeo = tracker.trackGeo(new THREE.SphereGeometry(0.026, 8, 8));
  for (let row = 0; row < 2; row++) {
    const ty = row === 0 ? 0.34 : 0.74;
    for (let col = -5; col <= 5; col++) {
      const ang = (col + (row % 2 === 0 ? 0 : 0.5)) * 0.22;
      const stud = new THREE.Mesh(velvetTuftStudGeo, polishedGoldFiligreeMat);
      stud.position.set(Math.sin(ang) * 1.72, ty, Math.cos(ang) * 1.72);
      cabinGroup.add(stud);
    }
  }

  const benchCushionGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.68, 1.68, 0.14, 16, 1, false, -Math.PI * 0.22, Math.PI * 0.44),
  );
  [-1, 1].forEach((side) => {
    const bench = new THREE.Mesh(benchCushionGeo, cabinVelvetMat);
    bench.position.set(0, 0.46, 0);
    bench.rotation.y = side * Math.PI * 0.48;
    cabinGroup.add(bench);
  });

  const cabinGoldHandrailGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.71, 0.036, 8, 28, Math.PI * 1.42),
  );
  cabinGoldHandrailGeo.rotateX(Math.PI / 2);
  cabinGoldHandrailGeo.rotateY(Math.PI * 0.79);
  cabinGoldHandrailGeo.translate(0, 1.08, 0);
  const cabinGoldHandrailMesh = new THREE.Mesh(cabinGoldHandrailGeo, polishedGoldFiligreeMat);

  const cabinUpperFiligreeFriezeGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.76, 0.03, 8, 28, Math.PI * 1.44),
  );
  cabinUpperFiligreeFriezeGeo.rotateX(Math.PI / 2);
  cabinUpperFiligreeFriezeGeo.rotateY(Math.PI * 0.78);
  cabinUpperFiligreeFriezeGeo.translate(0, 2.52, 0);
  cabinGroup.add(new THREE.Mesh(cabinUpperFiligreeFriezeGeo, polishedGoldFiligreeMat));

  // Interior Floor Indicator Plaque above the cabin doorway:
  // Placed at z = -1.72 with rotation.y = 0 so its +Z front normal points toward the cabin center (0, 0)!
  const cabinFloorPlaque = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(0.76, 0.38)),
    floorIndicatorPlaqueMat,
  );
  cabinFloorPlaque.position.set(0, 2.38, -1.72);
  cabinFloorPlaque.rotation.y = 0;
  cabinFloorPlaque.scale.set(1, 1, 1);
  cabinGroup.add(cabinFloorPlaque);

  elevatorHeartIndicators.forEach((ind, idx) => {
    const cabinHeart = buildHeartIndicatorMesh(ind.mat);
    cabinHeart.position.set((idx - 2) * 0.26, 2.12, -1.74);
    cabinHeart.scale.setScalar(0.72);
    cabinGroup.add(cabinHeart);
  });

  // --- 10.10 Floating Crystal Control Panel Inside the Elevator Cabin (Un-Mirrored Back-to-Back FrontSide) ---
  // Positioned on the right-front interior curve; rotated so its +Z front normal faces directly toward the cabin center (0, 0)
  crystalPanelGroup.position.set(1.08, 1.32, -1.12);
  crystalPanelGroup.rotation.y = Math.atan2(-1.08, 1.12);

  const panelPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.46, 0.74));
  // Front face (facing interior cabin viewer)
  const panelPlateFrontMesh = new THREE.Mesh(panelPlaneGeo, controlPanelMat);
  panelPlateFrontMesh.position.z = 0.011;
  panelPlateFrontMesh.scale.set(1, 1, 1);

  // Back face (rotated Math.PI with THREE.FrontSide so if viewed from outside the crystal cabin it ALSO reads left-to-right!)
  const panelPlateBackMesh = new THREE.Mesh(panelPlaneGeo, controlPanelMat);
  panelPlateBackMesh.position.z = -0.011;
  panelPlateBackMesh.rotation.y = Math.PI;
  panelPlateBackMesh.scale.set(1, 1, 1);

  const panelGoldBorder = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.49, 0.77, 0.018)),
    polishedGoldFiligreeMat,
  );
  const panelCrownTop = buildMiniGoldenCrown(0.55);
  panelCrownTop.position.set(0, 0.42, 0.01);
  crystalPanelGroup.add(panelPlateFrontMesh, panelPlateBackMesh, panelGoldBorder, panelCrownTop);

  const panelSparkleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.032, 0));
  const panelSparkleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.0,
    }),
  );
  const panelSparkleMeshes: THREE.Mesh[] = [];
  for (let sp = 0; sp < 8; sp++) {
    const sm = new THREE.Mesh(panelSparkleGeo, panelSparkleMat);
    sm.visible = false;
    panelSparkleMeshes.push(sm);
    crystalPanelGroup.add(sm);
  }
  let elevatorPanelSparkleTimer = 0.0;
  cabinGroup.add(crystalPanelGroup);

  // --- 10.11 Two Curved Pink-Crystal & Gold Filigree Castle-Gate Doors ---
  const buildCurvedCastleElevatorDoor = (isLeft: boolean): THREE.Group => {
    const doorPivot = new THREE.Group();
    const startAng = isLeft ? Math.PI - 0.52 : Math.PI;
    const arcLen = 0.52;

    const curvedGlassGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.83, 1.83, 2.48, 14, 1, true, startAng, arcLen),
    );
    curvedGlassGeo.translate(0, 1.24, 0);
    const curvedGlass = new THREE.Mesh(curvedGlassGeo, pinkCrystalDoorMat);
    doorPivot.add(curvedGlass);

    const railArcGeo = tracker.trackGeo(new THREE.TorusGeometry(1.83, 0.042, 8, 16, arcLen));
    railArcGeo.rotateX(Math.PI / 2);
    railArcGeo.rotateY(startAng + Math.PI / 2);

    const bottomRail = new THREE.Mesh(railArcGeo, polishedGoldFiligreeMat);
    bottomRail.position.y = 0.06;
    const midRail = new THREE.Mesh(railArcGeo, polishedGoldFiligreeMat);
    midRail.position.y = 1.02;
    const topRail = new THREE.Mesh(railArcGeo, polishedGoldFiligreeMat);
    topRail.position.y = 2.46;
    doorPivot.add(bottomRail, midRail, topRail);

    const edgeAngles = [startAng, startAng + arcLen * 0.5, startAng + arcLen];
    const stileGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 2.48, 8));
    stileGeo.translate(0, 1.24, 0);
    edgeAngles.forEach((ea, idx) => {
      const st = new THREE.Mesh(stileGeo, polishedGoldFiligreeMat);
      if (idx === 1) st.scale.set(0.65, 1.0, 0.65);
      st.position.set(Math.sin(ea) * 1.835, 0, Math.cos(ea) * 1.835);
      doorPivot.add(st);
    });

    const midAng = startAng + arcLen * 0.5;
    const scrollRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.24, 0.022, 8, 16));
    [0.54, 1.56, 2.08].forEach((sy, sIdx) => {
      const sr = new THREE.Mesh(scrollRingGeo, polishedGoldFiligreeMat);
      sr.position.set(Math.sin(midAng) * 1.845, sy, Math.cos(midAng) * 1.845);
      sr.rotation.y = midAng;
      if (sIdx === 1) {
        const doorHeart = buildHeartIndicatorMesh(pinkLedStripMat);
        doorHeart.position.set(Math.sin(midAng) * 1.855, sy, Math.cos(midAng) * 1.855);
        doorHeart.rotation.y = midAng;
        doorHeart.scale.setScalar(0.95);
        doorPivot.add(doorHeart);
      }
      doorPivot.add(sr);
    });

    return doorPivot;
  };

  const leftSlideDoor = buildCurvedCastleElevatorDoor(true);
  const rightSlideDoor = buildCurvedCastleElevatorDoor(false);
  reDoorsGroup.add(leftSlideDoor, rightSlideDoor);

  cabinGroup.add(
    cabinFloorMesh,
    cabinCeilMesh,
    cabinDomeMesh,
    cabinGlassMesh,
    cabinVelvetPaddingMesh,
    cabinGoldHandrailMesh,
    reDoorsGroup,
  );

  // ========================================================================
  // 10B. SPRINT 2 & SPRINT 01: FLOOR 1 & FLOOR 2 ROOMS & REAR ROSE/BUTTERFLY GARDEN
  // ========================================================================
  const floor1Rooms = createCastleFloor1Rooms(
    tracker,
    mats,
    nav.originX,
    nav.baseY,
    nav.originZ,
  );
  group.add(floor1Rooms.group);
  for (const c of floor1Rooms.colliders) {
    colliders.push(c);
  }
  for (const pm of floor1Rooms.partitionMeshes) {
    cameraOccluders.push(pm);
  }

  const floor2Rooms = createCastleFloor2Rooms(
    tracker,
    mats,
    nav.originX,
    nav.baseY,
    nav.originZ,
  );
  group.add(floor2Rooms.group);
  for (const c of floor2Rooms.colliders) {
    colliders.push(c);
  }
  for (const pm of floor2Rooms.partitionMeshes) {
    cameraOccluders.push(pm);
  }

  const floor2CreativeWing = createCastleFloor2CreativeWing(
    tracker,
    mats,
    nav.originX,
    nav.baseY,
    nav.originZ,
  );
  group.add(floor2CreativeWing.group);
  for (const c of floor2CreativeWing.colliders) {
    colliders.push(c);
  }
  for (const pm of floor2CreativeWing.partitionMeshes) {
    cameraOccluders.push(pm);
  }

  const floor3Rooms = createCastleFloor3Rooms(
    tracker,
    mats,
    nav.originX,
    nav.baseY,
    nav.originZ,
  );
  group.add(floor3Rooms.group);
  for (const c of floor3Rooms.colliders) {
    colliders.push(c);
  }
  for (const pm of floor3Rooms.partitionMeshes) {
    cameraOccluders.push(pm);
  }

  floor2CreativeWing.setKeepMemoryCallback((portraitDataUrl, portraitIndex) => {
    floor3Rooms.setGalleryFrameImage((portraitIndex - 1) % 5, portraitDataUrl);
  });

  const allInteriorPartitionMeshes: THREE.Mesh[] = [
    ...floor1Rooms.partitionMeshes,
    ...floor2Rooms.partitionMeshes,
    ...floor2CreativeWing.partitionMeshes,
    ...floor3Rooms.partitionMeshes,
  ];

  const rearGarden = createCastleGarden(
    tracker,
    mats,
    nav.originX,
    nav.baseY,
    nav.originZ,
  );
  group.add(rearGarden.group);
  for (const c of rearGarden.colliders) {
    colliders.push(c);
  }

  // ========================================================================
  // 10C. SIGNATURE 3D HEART TREES, ROMANTIC CASTLE ARCHITECTURE,
  //      UN-MIRRORED WORLD ENGRAVINGS & YESHWANTH ENTRANCE PRESENTATION
  // ========================================================================
  const sampleLocalGroundY = (lx: number, lz: number): number => {
    return getTerrainHeight(nav.originX + lx, nav.originZ + lz) - nav.baseY;
  };

  const heartTreePlacements: HeartTreePlacement[] = [
    // 1. Two Large Framing Heart Trees at the Grand Castle Entrance (Section 10)
    {
      lx: -7.6,
      y: sampleLocalGroundY(-7.6, -19.6),
      lz: -19.6,
      scale: 1.32,
      rotY: 0.25,
      variant: 'pink',
      awakeningRole: 'entrance_primary',
    },
    {
      lx: 7.6,
      y: sampleLocalGroundY(7.6, -19.6),
      lz: -19.6,
      scale: 1.32,
      rotY: -0.25,
      variant: 'dream',
      awakeningRole: 'entrance_secondary',
    },
    // 2. Main Approach Path Heart Trees
    {
      lx: -6.8,
      y: sampleLocalGroundY(-6.8, -27.2),
      lz: -27.2,
      scale: 1.12,
      rotY: 0.42,
      variant: 'lavender',
      awakeningRole: 'ambient',
    },
    {
      lx: 6.8,
      y: sampleLocalGroundY(6.8, -27.2),
      lz: -27.2,
      scale: 1.12,
      rotY: -0.38,
      variant: 'golden',
      awakeningRole: 'ambient',
    },
    // 3. Courtyard / Forecourt Viewpoints
    {
      lx: -13.6,
      y: sampleLocalGroundY(-13.6, -22.5),
      lz: -22.5,
      scale: 1.05,
      rotY: 0.55,
      variant: 'golden',
      awakeningRole: 'ambient',
    },
    {
      lx: 13.6,
      y: sampleLocalGroundY(13.6, -22.5),
      lz: -22.5,
      scale: 1.05,
      rotY: -0.55,
      variant: 'lavender',
      awakeningRole: 'ambient',
    },
    // 4. Central Garden, Reflective Pond & Love Garden (Rear Castle Garden)
    {
      lx: -8.4,
      y: sampleLocalGroundY(-8.4, 22.4),
      lz: 22.4,
      scale: 1.18,
      rotY: 0.18,
      variant: 'pink',
      awakeningRole: 'ambient',
    },
    {
      lx: 8.4,
      y: sampleLocalGroundY(8.4, 22.4),
      lz: 22.4,
      scale: 1.18,
      rotY: -0.18,
      variant: 'dream',
      awakeningRole: 'ambient',
    },
    {
      lx: -7.5,
      y: sampleLocalGroundY(-7.5, 31.8),
      lz: 31.8,
      scale: 1.14,
      rotY: 0.35,
      variant: 'lavender',
      awakeningRole: 'ambient',
    },
    {
      lx: 7.5,
      y: sampleLocalGroundY(7.5, 31.8),
      lz: 31.8,
      scale: 1.14,
      rotY: -0.35,
      variant: 'golden',
      awakeningRole: 'ambient',
    },
    {
      lx: -13.2,
      y: sampleLocalGroundY(-13.2, 26.6),
      lz: 26.6,
      scale: 1.06,
      rotY: 0.22,
      variant: 'dream',
      awakeningRole: 'ambient',
    },
    {
      lx: 13.2,
      y: sampleLocalGroundY(13.2, 26.6),
      lz: 26.6,
      scale: 1.06,
      rotY: -0.22,
      variant: 'pink',
      awakeningRole: 'ambient',
    },
    // 5. Balcony Viewpoint & Rooftop Observatory Heart Trees
    {
      lx: -12.6,
      y: 15.25,
      lz: -12.6,
      scale: 0.56,
      rotY: 0.3,
      variant: 'golden',
      awakeningRole: 'ambient',
      skipCollider: true,
    },
    {
      lx: 12.6,
      y: 15.25,
      lz: -12.6,
      scale: 0.56,
      rotY: -0.3,
      variant: 'dream',
      awakeningRole: 'ambient',
      skipCollider: true,
    },
  ];

  const heartTrees = createCastleHeartTrees(tracker, mats, heartTreePlacements);
  group.add(heartTrees.group);
  for (const tc of heartTrees.localColliders) {
    colliders.push({
      x: nav.originX + tc.lx,
      z: nav.originZ + tc.lz,
      radius: tc.radius,
    });
  }

  // --- Helper for Un-Mirrored Engraved Gold Plaques (Strictly THREE.FrontSide + flipY = true) ---
  const createRomanticEngravingTex = (
    headline: string,
    subline: string,
    bgStyle: 'gold' | 'blush' = 'gold',
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 768, 220);

      const grad = ctx.createLinearGradient(0, 0, 768, 220);
      if (bgStyle === 'gold') {
        grad.addColorStop(0, '#fffdf7');
        grad.addColorStop(0.5, '#fef3c7');
        grad.addColorStop(1, '#fde68a');
      } else {
        grad.addColorStop(0, '#fff1f2');
        grad.addColorStop(0.5, '#fce7f3');
        grad.addColorStop(1, '#fbcfe8');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(8, 8, 752, 204);

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 7;
      ctx.strokeRect(14, 14, 740, 192);
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(24, 24, 720, 172);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#9d174d';
      ctx.font = 'bold 42px Georgia, serif';
      ctx.fillText(headline, 384, 84);

      ctx.fillStyle = '#78350f';
      ctx.font = 'italic 25px Georgia, serif';
      ctx.fillText(subline, 384, 148);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  };

  // 1. CASTLE ENTRANCE FRAME & GOLD ENGRAVING (Sections 10, 15, 22)
  const entranceFrameGroup = new THREE.Group();
  entranceFrameGroup.name = 'RomanticCastleEntranceFrame';
  group.add(entranceFrameGroup);

  const entranceEngravingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: createRomanticEngravingTex(
        '♥ I LOVE YOU, HARSHA ♥',
        'Welcome to your Dream Castle on Heart Island',
        'gold',
      ),
      side: THREE.FrontSide,
    }),
  );
  const entranceFriezeBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(5.2, 1.15, 0.14));
  const entranceFriezePlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.95, 0.98));

  const entranceFriezeBoard = new THREE.Mesh(entranceFriezeBoardGeo, mats.champagneGold);
  entranceFriezeBoard.position.set(0, 6.45, -16.92);
  // Front plaque facing South (-Z) toward approaching player & entrance camera (rotation.y = Math.PI)
  const entranceFriezeFront = new THREE.Mesh(entranceFriezePlaneGeo, entranceEngravingMat);
  entranceFriezeFront.position.set(0, 6.45, -17.0);
  entranceFriezeFront.rotation.y = Math.PI;
  // Interior backing board & plaque facing North (+Z) toward the Grand Hall (rotation.y = 0)
  const entranceFriezeInnerBoard = new THREE.Mesh(entranceFriezeBoardGeo, mats.champagneGold);
  entranceFriezeInnerBoard.position.set(0, 6.45, -15.39);
  const entranceFriezeBack = new THREE.Mesh(entranceFriezePlaneGeo, entranceEngravingMat);
  entranceFriezeBack.position.set(0, 6.45, -15.31);
  entranceFriezeBack.rotation.y = 0;
  entranceFrameGroup.add(
    entranceFriezeBoard,
    entranceFriezeFront,
    entranceFriezeInnerBoard,
    entranceFriezeBack,
  );

  // Climbing Rose Vines, Flowing Ribbons, Golden Lanterns & Foreground Rose Bushes on the Entrance Columns
  const vineLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#15803d'),
      roughness: 0.55,
    }),
  );
  const vineBlossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 8, 8));
  const hangingRibbonGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 2.2, 0.03));
  const entranceLanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.24, 10, 10));

  const awakeningWindowGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.75,
      roughness: 0.18,
    }),
  );

  [-3.8, -1.9, 1.9, 3.8].forEach((cx, cIdx) => {
    // Climbing spiral floral vine around each entrance column
    const vinePts: THREE.Vector3[] = [];
    for (let v = 0; v <= 16; v++) {
      const vt = v / 16;
      const vang = vt * Math.PI * 4.0 + cIdx;
      vinePts.push(
        new THREE.Vector3(
          cx + Math.cos(vang) * 0.42,
          0.35 + vt * 6.2,
          -16.8 + Math.sin(vang) * 0.42,
        ),
      );
      if (v % 2 === 0) {
        const rose = new THREE.Mesh(
          vineBlossomGeo,
          v % 4 === 0 ? barbiePinkMat : pastelBlushMat,
        );
        rose.position.set(
          cx + Math.cos(vang) * 0.47,
          0.35 + vt * 6.2,
          -16.8 + Math.sin(vang) * 0.47,
        );
        entranceFrameGroup.add(rose);
      }
    }
    const vineCurve = new THREE.CatmullRomCurve3(vinePts);
    const vineTube = new THREE.Mesh(
      tracker.trackGeo(new THREE.TubeGeometry(vineCurve, 24, 0.035, 6, false)),
      vineLeafMat,
    );
    entranceFrameGroup.add(vineTube);

    // Flowing silk ribbon & warm golden lantern suspended from the column capital
    const ribbon = new THREE.Mesh(hangingRibbonGeo, loveRibbonPinkMat);
    ribbon.position.set(cx, 5.65, -17.28);
    ribbon.rotation.z = (cIdx < 2 ? 1 : -1) * 0.08;
    const lanternOrb = new THREE.Mesh(entranceLanternOrbGeo, awakeningWindowGlowMat);
    lanternOrb.position.set(cx, 5.15, -17.42);
    entranceFrameGroup.add(ribbon, lanternOrb);
  });

  // Foreground Rose Bushes & Crystal Heart Ornaments framing the Entrance Steps (lz = -17.5 .. -21.5)
  const forecourtBushGeo = tracker.trackGeo(new THREE.SphereGeometry(0.62, 10, 8));
  forecourtBushGeo.scale(1.45, 0.72, 1.15);
  [
    { x: -5.4, z: -17.8 },
    { x: 5.4, z: -17.8 },
    { x: -4.8, z: -20.6 },
    { x: 4.8, z: -20.6 },
    { x: -6.2, z: -22.2 },
    { x: 6.2, z: -22.2 },
  ].forEach((fb, idx) => {
    const fy = sampleLocalGroundY(fb.x, fb.z);
    const bush = new THREE.Mesh(forecourtBushGeo, vineLeafMat);
    bush.position.set(fb.x, fy + 0.28, fb.z);
    entranceFrameGroup.add(bush);
    for (let b = 0; b < 5; b++) {
      const bAng = (b * Math.PI * 2) / 5 + idx;
      const bud = new THREE.Mesh(
        vineBlossomGeo,
        b % 2 === 0 ? barbiePinkMat : mats.champagneGold,
      );
      bud.position.set(
        fb.x + Math.cos(bAng) * 0.55,
        fy + 0.52,
        fb.z + Math.sin(bAng) * 0.45,
      );
      entranceFrameGroup.add(bud);
    }
  });

  // 2. ARCHED EXTERIOR WINDOWS & ROUNDED FLOWER BALCONIES (Sections 11 & 12)
  const winPaneGeo = tracker.trackGeo(new THREE.BoxGeometry(1.38, 2.25, 0.08));
  const winArchCrownGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.69, 0.075, 8, 18, Math.PI),
  );
  const winFrameSideGeo = tracker.trackGeo(new THREE.BoxGeometry(0.09, 2.25, 0.14));
  const winSillBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(1.62, 0.28, 0.42));

  const buildExteriorRomanticWindow = (
    x: number,
    y: number,
    z: number,
    rotY: number,
  ) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    wg.rotation.y = rotY;

    const pane = new THREE.Mesh(winPaneGeo, awakeningWindowGlowMat);
    const arch = new THREE.Mesh(winArchCrownGeo, mats.champagneGold);
    arch.position.set(0, 1.12, 0.04);
    const stL = new THREE.Mesh(winFrameSideGeo, mats.champagneGold);
    stL.position.set(-0.69, 0, 0.04);
    const stR = new THREE.Mesh(winFrameSideGeo, mats.champagneGold);
    stR.position.set(0.69, 0, 0.04);
    const sill = new THREE.Mesh(winSillBoxGeo, mats.pearlWhite);
    sill.position.set(0, -1.22, 0.16);

    const heartMotif = buildSculptedHeart(0.95, mats.champagneGold);
    heartMotif.position.set(0, 0.85, 0.08);

    // Flower-box roses along the window sill
    for (let f = -2; f <= 2; f++) {
      const fl = new THREE.Mesh(
        vineBlossomGeo,
        f % 2 === 0 ? barbiePinkMat : mats.softLavender,
      );
      fl.position.set(f * 0.28, -1.04, 0.22);
      wg.add(fl);
    }

    wg.add(pane, arch, stL, stR, sill, heartMotif);
    group.add(wg);
  };

  // Place arched romantic windows across Front (-Z), Rear (+Z), West (-X), and East (+X) walls
  [-11.2, -7.2, 7.2, 11.2].forEach((wx) => {
    [2.85, 7.85, 12.65].forEach((wy) => {
      buildExteriorRomanticWindow(wx, wy, -16.64, Math.PI); // Front South facade
      buildExteriorRomanticWindow(wx, wy, 16.64, 0); // Rear North facade
    });
  });
  [-10.5, -5.2, 0.0, 5.2, 10.5].forEach((wz) => {
    [2.85, 7.85, 12.65].forEach((wy) => {
      buildExteriorRomanticWindow(-16.64, wy, wz, -Math.PI / 2); // West facade
      buildExteriorRomanticWindow(16.64, wy, wz, Math.PI / 2); // East facade
    });
  });

  // Rounded Exterior Flower & Heart Balconies on Front & Rear Upper Facades (Section 12)
  const extBalconySlabGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.45, 2.15, 0.32, 20, 1, false, 0, Math.PI),
  );
  const extBalconyRailGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.35, 0.065, 8, 24, Math.PI),
  );
  extBalconyRailGeo.rotateX(Math.PI / 2);

  [
    { x: -9.2, y: 5.25, z: -16.6, rotY: Math.PI },
    { x: 9.2, y: 5.25, z: -16.6, rotY: Math.PI },
    { x: 0.0, y: 10.25, z: -16.6, rotY: Math.PI },
    { x: 0.0, y: 10.25, z: 16.6, rotY: 0 },
  ].forEach((bCfg) => {
    const bg = new THREE.Group();
    bg.position.set(bCfg.x, bCfg.y, bCfg.z);
    bg.rotation.y = bCfg.rotY;

    const slab = new THREE.Mesh(extBalconySlabGeo, mats.pearlWhite);
    const rail = new THREE.Mesh(extBalconyRailGeo, mats.champagneGold);
    rail.position.y = 0.92;
    bg.add(slab, rail);

    for (let k = 1; k <= 5; k++) {
      const ang = (k / 6) * Math.PI;
      const rx = Math.cos(ang) * 2.32;
      const rz = Math.sin(ang) * 2.32;
      const hBal = buildSculptedHeart(0.85, mats.champagneGold);
      hBal.position.set(rx, 0.52, rz);
      hBal.rotation.y = -ang + Math.PI / 2;
      const fl = new THREE.Mesh(
        vineBlossomGeo,
        k % 2 === 0 ? barbiePinkMat : pastelBlushMat,
      );
      fl.position.set(rx, 0.98, rz);
      bg.add(hBal, fl);
    }
    group.add(bg);
  });

  // 3. STAIRCASE ENGRAVED PLAQUE & HIDDEN BASEMENT SECRET SHRINE (Sections 15 & 22)
  const stairPlaqueMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: createRomanticEngravingTex(
        '♥ I LOVE YOU, HARSHA ♥',
        'Every step of this staircase leads closer to my heart',
        'blush',
      ),
      side: THREE.FrontSide,
    }),
  );
  const stairPlaqueBoard = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(2.85, 0.68, 0.08)),
    mats.champagneGold,
  );
  stairPlaqueBoard.position.set(0, 5.72, -6.0);
  const stairPlaqueSouth = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(2.72, 0.58)),
    stairPlaqueMat,
  );
  stairPlaqueSouth.position.set(0, 5.72, -6.05);
  stairPlaqueSouth.rotation.y = Math.PI; // Faces -Z (Grand Hall & Staircase approach)
  const stairPlaqueNorth = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(2.72, 0.58)),
    stairPlaqueMat,
  );
  stairPlaqueNorth.position.set(0, 5.72, -5.95);
  stairPlaqueNorth.rotation.y = 0; // Faces +Z (Mezzanine Gallery)
  group.add(stairPlaqueBoard, stairPlaqueSouth, stairPlaqueNorth);

  // Hidden Basement Secret Romantic Shrine (y = -4.5m, lz = -11.5m)
  const secretVaultShrineGroup = new THREE.Group();
  secretVaultShrineGroup.position.set(0, -4.5, -11.5);
  const shrinePedestal = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.15, 1.35, 0.92, 16)).translate(0, 0.46, 0),
    mats.blushRoseMarble,
  );
  const shrineHeartCrystal = buildSculptedHeart(2.2, chWarmCrystalHeartMat);
  shrineHeartCrystal.position.set(0, 1.48, 0);
  const secretPlaqueMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: createRomanticEngravingTex(
        '♥ I LOVE YOU FOREVER — Y ♥ H ♥',
        'Even in the quietest hidden corners of our world, my heart is yours',
        'gold',
      ),
      side: THREE.FrontSide,
    }),
  );
  const secretPlaqueBoard = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(2.45, 0.65, 0.08)),
    mats.champagneGold,
  );
  secretPlaqueBoard.position.set(0, 2.25, -1.2);
  const secretPlaquePlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.32, 0.56));
  const secretPlaqueFront = new THREE.Mesh(secretPlaquePlaneGeo, secretPlaqueMat);
  secretPlaqueFront.position.set(0, 2.25, -1.15);
  secretPlaqueFront.rotation.y = 0; // Faces +Z into the Basement Vault
  const secretPlaqueBack = new THREE.Mesh(secretPlaquePlaneGeo, secretPlaqueMat);
  secretPlaqueBack.position.set(0, 2.25, -1.25);
  secretPlaqueBack.rotation.y = Math.PI; // Faces -Z (rear of shrine)
  secretVaultShrineGroup.add(
    shrinePedestal,
    shrineHeartCrystal,
    secretPlaqueBoard,
    secretPlaqueFront,
    secretPlaqueBack,
  );
  group.add(secretVaultShrineGroup);

  // 4. YESHWANTH AT THE GRAND CASTLE ENTRANCE WITH CRIMSON-GOLD ROSE (Sections 23, 24, 25)
  const yeshwanthEntranceGroup = new THREE.Group();
  yeshwanthEntranceGroup.name = 'YeshwanthEntranceHost';
  yeshwanthEntranceGroup.position.set(0.52, 0.25, -15.4);
  yeshwanthEntranceGroup.rotation.y = Math.PI; // Facing South (-Z) toward Harsha at the entrance

  const ySkinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#f1c27d'), roughness: 0.45 }),
  );
  const yHairMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1917'), roughness: 0.55 }),
  );
  const ySuitMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      roughness: 0.35,
      metalness: 0.15,
    }),
  );
  const yTrouserMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#0f172a'), roughness: 0.45 }),
  );

  const yLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.068, 0.056, 0.72, 10));
  yLegGeo.translate(0, -0.36, 0);
  const yLeftLeg = new THREE.Mesh(yLegGeo, yTrouserMat);
  yLeftLeg.position.set(-0.1, 0.72, 0);
  const yRightLeg = new THREE.Mesh(yLegGeo, yTrouserMat);
  yRightLeg.position.set(0.1, 0.72, 0);

  const yTorso = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.19, 0.15, 0.62, 12)).translate(0, 1.03, 0),
    ySuitMat,
  );
  const yGoldSash = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.17, 0.025, 8, 16))
      .rotateY(Math.PI / 2)
      .rotateZ(0.55)
      .translate(0, 1.05, 0),
    mats.champagneGold,
  );
  const yHead = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 14)).translate(0, 1.48, 0),
    ySkinMat,
  );
  const yHair = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.152, 12, 12))
      .scale(1.0, 0.85, 1.02)
      .translate(0, 1.54, -0.015),
    yHairMat,
  );
  const yCrown = buildMiniGoldenCrown(0.58);
  yCrown.position.set(0, 1.65, 0);

  const yArmGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.048, 0.04, 0.54, 10));
  yArmGeo.translate(0, -0.27, 0);
  const yLeftArmPivot = new THREE.Group();
  yLeftArmPivot.position.set(-0.23, 1.28, 0);
  yLeftArmPivot.add(new THREE.Mesh(yArmGeo, ySuitMat));

  const yRightArmPivot = new THREE.Group();
  yRightArmPivot.position.set(0.23, 1.28, 0);
  yRightArmPivot.add(new THREE.Mesh(yArmGeo, ySuitMat));

  // Romantic 3D Rose held in Yeshwanth's right hand (offered to Harsha during entrance proposal)
  const yRoseGroup = new THREE.Group();
  yRoseGroup.name = 'YeshwanthProposalRose';
  yRoseGroup.position.set(0, -0.52, 0.06);
  yRoseGroup.rotation.x = 1.22; // Upright romantic presentation facing Harsha
  const yRoseStem = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6)).translate(0, 0.16, 0),
    vineLeafMat,
  );
  const yRosePetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e11d48'),
      emissive: new THREE.Color('#ff1744'),
      emissiveIntensity: 0.95,
      roughness: 0.28,
      metalness: 0.12,
    }),
  );
  const yRoseBloom = new THREE.Mesh(
    tracker.trackGeo(new THREE.DodecahedronGeometry(0.088, 1)).translate(0, 0.34, 0),
    yRosePetalMat,
  );
  const yRosePetalRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.082, 0.024, 8, 16)).translate(0, 0.33, 0),
    yRosePetalMat,
  );
  const yRoseGoldHalo = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.108, 0.014, 6, 16)).translate(0, 0.34, 0),
    mats.champagneGold,
  );
  const yRoseLeafGeo = tracker.trackGeo(new THREE.ConeGeometry(0.035, 0.12, 4));
  yRoseLeafGeo.rotateZ(Math.PI / 3);
  yRoseLeafGeo.translate(-0.04, 0.2, 0);
  const yRoseLeaf1 = new THREE.Mesh(yRoseLeafGeo, vineLeafMat);
  const yRoseLeaf2 = new THREE.Mesh(yRoseLeafGeo, vineLeafMat);
  yRoseLeaf2.rotation.y = Math.PI;
  yRoseLeaf2.position.set(0, -0.04, 0);

  // Dedicated romantic rosy point light radiating from the proposal bloom
  const yRosePointLight = new THREE.PointLight(0xff2d75, 1.8, 3.8, 2.0);
  yRosePointLight.position.set(0, 0.36, 0);

  yRoseGroup.add(
    yRoseStem,
    yRoseLeaf1,
    yRoseLeaf2,
    yRoseBloom,
    yRosePetalRing,
    yRoseGoldHalo,
    yRosePointLight,
  );
  yRightArmPivot.add(yRoseGroup);

  yeshwanthEntranceGroup.add(
    yLeftLeg,
    yRightLeg,
    yTorso,
    yGoldSash,
    yHead,
    yHair,
    yCrown,
    yLeftArmPivot,
    yRightArmPivot,
  );
  group.add(yeshwanthEntranceGroup);

  // 6 Glowing Heart Lanterns & Romantic Lighting in front of the Castle Entrance Steps
  const heartLanternMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffb6c1'),
      emissive: new THREE.Color('#ff2d75'),
      emissiveIntensity: 0.95,
      roughness: 0.22,
      metalness: 0.15,
      transparent: true,
      opacity: 0.94,
    }),
  );

  const entranceHeartLanternGroup = new THREE.Group();
  entranceHeartLanternGroup.name = 'EntranceHeartLanterns';

  const heartPostColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.045, 0.065, 1.05, 10));
  heartPostColGeo.translate(0, 0.525, 0);
  const heartPostBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 12));
  heartPostBaseGeo.translate(0, 0.06, 0);
  const heartPostCapGeo = tracker.trackGeo(new THREE.TorusGeometry(0.09, 0.02, 6, 16));
  heartPostCapGeo.rotateX(Math.PI / 2);
  heartPostCapGeo.translate(0, 1.05, 0);

  const lanternPostPositions = [
    { lx: -1.95, ly: 0.22, lz: -17.5, rotY: 0.25 },
    { lx: -2.35, ly: 0.18, lz: -19.8, rotY: 0.42 },
    { lx: -2.75, ly: 0.12, lz: -22.2, rotY: 0.58 },
    { lx: 1.95, ly: 0.22, lz: -17.5, rotY: -0.25 },
    { lx: 2.35, ly: 0.18, lz: -19.8, rotY: -0.42 },
    { lx: 2.75, ly: 0.12, lz: -22.2, rotY: -0.58 },
  ];

  lanternPostPositions.forEach((pos) => {
    const postGrp = new THREE.Group();
    postGrp.position.set(pos.lx, pos.ly, pos.lz);
    postGrp.rotation.y = pos.rotY;

    const base = new THREE.Mesh(heartPostBaseGeo, mats.champagneGold);
    const col = new THREE.Mesh(heartPostColGeo, mats.champagneGold);
    const cap = new THREE.Mesh(heartPostCapGeo, mats.champagneGold);

    // Sculpted Glowing 3D Heart Light atop post
    const heartHead = buildSculptedHeart(1.85, heartLanternMat);
    heartHead.position.set(0, 1.25, 0);

    // Decorative golden halo rim
    const haloGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.015, 6, 16));
    haloGeo.rotateX(Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, mats.champagneGold);
    halo.position.set(0, 1.42, 0);

    postGrp.add(base, col, cap, heartHead, halo);
    entranceHeartLanternGroup.add(postGrp);
  });

  const entranceHeartLightL = new THREE.PointLight(0xff4d79, 1.35, 6.5, 1.8);
  entranceHeartLightL.position.set(-2.2, 1.35, -19.5);
  const entranceHeartLightR = new THREE.PointLight(0xff4d79, 1.35, 6.5, 1.8);
  entranceHeartLightR.position.set(2.2, 1.35, -19.5);

  group.add(entranceHeartLanternGroup, entranceHeartLightL, entranceHeartLightR);

  // ========================================================================
  // 11. PREALLOCATED PROMPTS & CAMERA FOCUS OBJECTS (ZERO PER-FRAME ALLOCATION)
  // ========================================================================
  const _promptDoor = { prompt: '[E] Open the Grand Palace Doors', action: 'door' as const };
  const _promptElevatorEnter = {
    prompt: '[E] Enter Royal Crystal Elevator',
    action: 'call_elevator' as const,
  };
  const _promptElevatorInside = {
    prompt: '[1-4 / B] Select Floor · Drag Mouse / Arrows to Look 360° · [E] Step Out',
    action: 'call_elevator' as const,
  };
  const _promptFloor1Room = { prompt: '', action: 'floor1_room' as const };
  const _promptFloor2Room = { prompt: '', action: 'floor2_room' as const };
  const _promptFloor3Room = { prompt: '', action: 'floor3_room' as const };
  const _promptFountain = { prompt: '[E] Touch Fountain Water', action: 'fountain' as const };
  const _promptTelescope = {
    prompt: '[E] Look through Gilded Telescope',
    action: 'telescope' as const,
  };

  const _cameraFocusOut = {
    target: new THREE.Vector3(),
    position: new THREE.Vector3(),
    fov: 60,
    blendAlpha: 1,
    isSitting: false as boolean | undefined,
    isFirstPersonSeated: false as boolean | undefined,
    seatWorldPos: undefined as THREE.Vector3 | undefined,
    seatYaw: undefined as number | undefined,
  };

  return {
    group,
    colliders,
    cameraOccluders,
    interiorPartitionMeshes: allInteriorPartitionMeshes,
    nav,
    floor1Rooms,
    floor2Rooms,
    creativeWing: floor2CreativeWing,
    floor2CreativeWing,
    floor3Rooms,
    rearGarden,
    heartTrees,

    setAvatarRoseCallback: (cb: (held: boolean) => void) => {
      nav.setEntranceRoseCallback(cb);
    },

    getSurfaceHeight: (wx: number, wz: number, playerY: number, defaultGroundY: number) => {
      return nav.getSurfaceHeight(wx, wz, playerY, defaultGroundY);
    },

    isInsideCastle: (wx: number, wz: number) => {
      return nav.isInsideCastleBounds(wx, wz);
    },

    getProximityPrompt: (playerPos: THREE.Vector3) => {
      if (nav.activeCameraFocus?.mode === 'entrance') {
        return null;
      }
      // Priority 1: Royal Crystal Elevator (Inside FPV or Outside Entry)
      if (nav.isElevatorFpvActive || nav.isInsideElevatorCabin(playerPos)) {
        return _promptElevatorInside;
      }
      if (nav.getNearbyElevatorFloor(playerPos)) {
        return _promptElevatorEnter;
      }

      // Priority 2: Doors / Rooftop Telescope
      if (nav.isNearEntranceDoors(playerPos) && nav.doorState === 'CLOSED') {
        return _promptDoor;
      }
      const { lx, lz } = nav.worldToLocal(playerPos.x, playerPos.z);
      if (Math.hypot(lx, lz - (-13.5)) <= 2.8 && playerPos.y >= nav.baseY + 14.5) {
        return _promptTelescope;
      }

      // Priority 3: Floor 3 Rooms (Star Lounge, Heart Gallery, Infinite Mirrors, Cloud Bed, Aurora Sanctuary)
      const room3Prompt = floor3Rooms.getProximityPrompt(playerPos);
      if (room3Prompt) {
        _promptFloor3Room.prompt = room3Prompt;
        return _promptFloor3Room;
      }

      // Priority 4: Floor 2 Rooms & Creative Wing
      const room2Prompt = floor2Rooms.getProximityPrompt(playerPos);
      if (room2Prompt) {
        _promptFloor2Room.prompt = room2Prompt;
        return _promptFloor2Room;
      }
      const creativePrompt = floor2CreativeWing.getProximityPrompt(playerPos);
      if (creativePrompt) {
        _promptFloor2Room.prompt = creativePrompt;
        return _promptFloor2Room;
      }

      // Priority 5: Floor 1 Rooms (Kitchen/Fridge -> Piano/Guitar -> Romantic Objects)
      const roomPrompt = floor1Rooms.getProximityPrompt(playerPos);
      if (roomPrompt) {
        _promptFloor1Room.prompt = roomPrompt;
        return _promptFloor1Room;
      }

      // Priority 5: Central Crystal Fountain
      if (nav.isNearFountain(playerPos)) {
        return _promptFountain;
      }

      return null;
    },

    interact: (playerPos?: THREE.Vector3) => {
      // While the Grand Castle Entrance dialogue sequence is active, only Enter or Click Continue advances beats
      if (nav.activeCameraFocus?.mode === 'entrance') {
        return true;
      }

      if (playerPos) {
        // Priority 0: If currently inside an active Floor 3, Floor 2, or Floor 1 camera mode, interact cleanly exits/toggles it
        if (floor3Rooms.getCameraState().active) {
          return floor3Rooms.interact(playerPos);
        }
        if (floor2Rooms.getCameraState().active) {
          return floor2Rooms.interact(playerPos);
        }
        if (floor2CreativeWing.getCameraState().active) {
          return floor2CreativeWing.interact(playerPos);
        }
        if (floor1Rooms.getCameraState().active) {
          return floor1Rooms.interact(playerPos);
        }

        // Priority 1: Royal Crystal Elevator FPV Entry / Exit
        if (nav.isElevatorFpvActive || nav.isInsideElevatorCabin(playerPos)) {
          return nav.exitElevatorFpv(playerPos);
        }
        if (nav.getNearbyElevatorFloor(playerPos)) {
          elevatorPanelSparkleTimer = 1.25;
          return nav.enterElevatorFpv(playerPos);
        }

        // Priority 2: Entrance Doors & Rooftop Telescope
        if (nav.isNearEntranceDoors(playerPos) && nav.doorState === 'CLOSED') {
          return nav.openEntranceDoors();
        }
        const { lx, lz } = nav.worldToLocal(playerPos.x, playerPos.z);
        if (Math.hypot(lx, lz - (-13.5)) <= 2.8 && playerPos.y >= nav.baseY + 14.5) {
          nav.triggerRooftopPanoramicPan(playerPos, true);
          return true;
        }

        // Priority 3: Floor 3 Rooms
        if (floor3Rooms.interact(playerPos)) {
          return true;
        }

        // Priority 4: Floor 2 Rooms & Creative Wing
        if (floor2Rooms.interact(playerPos)) {
          return true;
        }
        if (floor2CreativeWing.interact(playerPos)) {
          return true;
        }

        // Priority 5: Floor 1 Rooms
        if (floor1Rooms.interact(playerPos)) {
          return true;
        }

        // Priority 5: Fountain
        if (nav.isNearFountain(playerPos)) {
          return nav.triggerFountainRipple();
        }
      }
      if (nav.doorState === 'CLOSED') {
        return nav.openEntranceDoors();
      }
      return false;
    },

    handleElevatorFloorSelect: (floorNum: number) => {
      elevatorPanelSparkleTimer = 1.25;
      drawCrystalControlPanel(floorNum);
      return nav.callElevatorToFloor(floorNum);
    },

    performPredefinedDance: (stepIndex: number) => {
      floor2Rooms.performPredefinedDance(stepIndex);
    },

    setGalleryFrameImage: (frameIndex: number, imageSrc: string) => {
      floor3Rooms.setGalleryFrameImage(frameIndex, imageSrc);
    },

    getGalleryFrames: () => {
      return floor3Rooms.getGalleryFrames();
    },

    getCameraFocus: () => {
      if (nav.activeCameraFocus) {
        _cameraFocusOut.target = nav.activeCameraFocus.target;
        _cameraFocusOut.position = nav.activeCameraFocus.position;
        _cameraFocusOut.fov = nav.activeCameraFocus.fov ?? 60;
        _cameraFocusOut.blendAlpha = nav.activeCameraFocus.blendAlpha;
        _cameraFocusOut.isSitting = false;
        _cameraFocusOut.isFirstPersonSeated = false;
        _cameraFocusOut.seatWorldPos = nav.activeCameraFocus.seatWorldPos;
        _cameraFocusOut.seatYaw = nav.activeCameraFocus.seatYaw;
        return _cameraFocusOut;
      }
      const room3Cam: Floor3CameraState = floor3Rooms.getCameraState();
      if (room3Cam.active) {
        _cameraFocusOut.target = room3Cam.lookWorldPos;
        _cameraFocusOut.position = room3Cam.camWorldPos;
        _cameraFocusOut.fov = 55;
        _cameraFocusOut.blendAlpha = room3Cam.blendAlpha;
        _cameraFocusOut.isSitting = room3Cam.isSitting;
        _cameraFocusOut.isFirstPersonSeated = false;
        _cameraFocusOut.seatWorldPos = room3Cam.seatWorldPos;
        _cameraFocusOut.seatYaw = room3Cam.seatYaw;
        return _cameraFocusOut;
      }
      const creativeCam: CreativeWingCameraState = floor2CreativeWing.getCameraState();
      if (creativeCam.active) {
        _cameraFocusOut.target = creativeCam.lookWorldPos;
        _cameraFocusOut.position = creativeCam.camWorldPos;
        _cameraFocusOut.fov = creativeCam.fov ?? 55;
        _cameraFocusOut.blendAlpha = creativeCam.blendAlpha;
        _cameraFocusOut.isSitting = Boolean(creativeCam.isSitting);
        _cameraFocusOut.isFirstPersonSeated = false;
        _cameraFocusOut.seatWorldPos = creativeCam.seatWorldPos;
        _cameraFocusOut.seatYaw = creativeCam.seatYaw;
        return _cameraFocusOut;
      }
      const room2Cam: Floor2CameraState = floor2Rooms.getCameraState();
      if (room2Cam.active) {
        _cameraFocusOut.target = room2Cam.lookWorldPos;
        _cameraFocusOut.position = room2Cam.camWorldPos;
        _cameraFocusOut.fov = 55;
        _cameraFocusOut.blendAlpha = room2Cam.blendAlpha;
        _cameraFocusOut.isSitting = room2Cam.isSitting;
        _cameraFocusOut.isFirstPersonSeated = false;
        _cameraFocusOut.seatWorldPos = room2Cam.seatWorldPos;
        _cameraFocusOut.seatYaw = room2Cam.seatYaw;
        return _cameraFocusOut;
      }
      const roomCam: Floor1CameraState = floor1Rooms.getCameraState();
      if (roomCam.active) {
        _cameraFocusOut.target = roomCam.lookWorldPos;
        _cameraFocusOut.position = roomCam.camWorldPos;
        _cameraFocusOut.fov = roomCam.isFirstPersonSeated ? 62 : 56;
        _cameraFocusOut.blendAlpha = roomCam.blendAlpha;
        _cameraFocusOut.isSitting = roomCam.isSitting;
        _cameraFocusOut.isFirstPersonSeated = roomCam.isFirstPersonSeated;
        _cameraFocusOut.seatWorldPos = roomCam.seatWorldPos;
        _cameraFocusOut.seatYaw = roomCam.seatYaw;
        return _cameraFocusOut;
      }
      return null;
    },

    update: (delta: number, playerPos: THREE.Vector3, elapsedTime?: number, inputKeys?: Set<string>) => {
      nav.update(delta, playerPos);
      fountainClock += delta;
      const clockVal = elapsedTime !== undefined ? elapsedTime : fountainClock;

      floor1Rooms.update(delta, clockVal, playerPos, inputKeys);
      floor2Rooms.update(delta, clockVal, playerPos, inputKeys);
      floor2CreativeWing.update(delta, clockVal, playerPos, inputKeys);
      floor3Rooms.update(delta, clockVal, playerPos, inputKeys);
      rearGarden.update(delta, clockVal, playerPos);

      // Update Signature Heart Trees & Castle Window Awakening
      const isEntranceReveal = nav.activeCameraFocus?.mode === 'entrance';
      const primaryTreeAwake = isEntranceReveal || nav.hasTriggeredEntranceReveal
        ? nav.primaryTreeAwake
        : 0.45;
      const secondaryTreeAwake = isEntranceReveal || nav.hasTriggeredEntranceReveal
        ? nav.secondaryTreeAwake
        : 0.45;
      const winAwake = isEntranceReveal || nav.hasTriggeredEntranceReveal
        ? nav.castleWindowsAwake
        : 0.35;

      heartTrees.update(delta, clockVal, primaryTreeAwake, secondaryTreeAwake, 0.82);
      awakeningWindowGlowMat.emissiveIntensity =
        0.35 + winAwake * 1.45 + Math.sin(clockVal * 2.4) * 0.1;

      // Update 6 Glowing Heart Lanterns in front of the castle
      const heartLightAwake = Math.max(winAwake, primaryTreeAwake);
      const lanternPulse = 1.0 + Math.sin(clockVal * 2.8) * 0.16;
      heartLanternMat.emissiveIntensity = (0.55 + heartLightAwake * 1.5) * lanternPulse;
      entranceHeartLightL.intensity = (0.45 + heartLightAwake * 1.4) * lanternPulse;
      entranceHeartLightR.intensity = (0.45 + heartLightAwake * 1.4) * (1.0 + Math.cos(clockVal * 2.8) * 0.16);

      // Animate Yeshwanth at the Grand Castle Entrance
      const yWalk = nav.yeshwanthWalkProgress;
      const yRoseExt = nav.yeshwanthRoseExtend;
      if (isEntranceReveal) {
        yeshwanthEntranceGroup.visible = nav.doorOpenRatio > 0.08 || yWalk > 0.01;
        const yZ = THREE.MathUtils.lerp(-15.4, -18.35, yWalk);
        const yY = THREE.MathUtils.lerp(0.25, 0.19, yWalk);
        yeshwanthEntranceGroup.position.set(0.52, yY, yZ);
        yeshwanthEntranceGroup.rotation.y = Math.PI + 0.25; // Facing Harsha at (-0.52, -19.25)

        const isWalking = yWalk > 0.01 && yWalk < 0.99;
        const stride = isWalking ? Math.sin(clockVal * 7.5) * 0.38 : 0.0;
        yLeftLeg.rotation.x = stride;
        yRightLeg.rotation.x = -stride;
        yLeftArmPivot.rotation.x = -stride * 0.6;
        yRightArmPivot.rotation.x = THREE.MathUtils.lerp(-stride * 0.5, -1.18, yRoseExt);
        yRoseGroup.visible = true; // Rose stays prominently visible throughout the proposal!
      } else if (nav.hasTriggeredEntranceReveal) {
        yeshwanthEntranceGroup.visible = true;
        yeshwanthEntranceGroup.position.set(1.45, 0.25, -17.2);
        yeshwanthEntranceGroup.rotation.y = Math.PI + Math.sin(clockVal * 0.8) * 0.12;
        yLeftLeg.rotation.x = 0;
        yRightLeg.rotation.x = 0;
        yLeftArmPivot.rotation.x = 0;
        yRightArmPivot.rotation.x = -0.35;
        yRoseGroup.visible = false;
      } else {
        yeshwanthEntranceGroup.visible = false;
      }

      // Remove doorway barrier once doors begin opening
      if (!doorBarrierRemoved && nav.doorState !== 'CLOSED') {
        doorBarrierRemoved = true;
        for (const c of doorBarrierColliders) {
          c.radius = -10.0;
          c.x = -99999;
          c.z = -99999;
          const idx = colliders.indexOf(c);
          if (idx !== -1) {
            colliders.splice(idx, 1);
          }
        }
      }

      // Animate Entrance Doors Swing
      leftDoorHandle.rotation.z = -nav.doorHandleAngle;
      rightDoorHandle.rotation.z = nav.doorHandleAngle;
      const maxSwing = THREE.MathUtils.degToRad(105);
      leftDoorPivot.rotation.y = nav.doorOpenRatio * maxSwing;
      rightDoorPivot.rotation.y = -nav.doorOpenRatio * maxSwing;

      // Water Ripple Shader uniforms
      const holoAlpha = nav.fountainHologramAlpha;
      fountainWaterUniforms.uTime.value = fountainClock;
      fountainWaterUniforms.uIntensity.value = Math.max(
        holoAlpha,
        nav.fountainRippleTimer > 0 ? 0.55 : 0.0,
      );

      // Water Ripple Ring
      if (holoAlpha > 0.01 || nav.fountainRippleTimer > 0) {
        const rippleWave = (fountainClock * 0.75) % 1.0;
        rippleRingMesh.visible = true;
        const rippleScale = THREE.MathUtils.lerp(0.65, 2.55, rippleWave);
        rippleRingMesh.scale.set(rippleScale, rippleScale, 1);
      } else {
        rippleRingMesh.visible = false;
      }

      // Hologram Projection & Particle Orbit
      if (holoAlpha > 0.01) {
        hologramGroup.visible = true;
        beamUniforms.uTime.value = fountainClock;
        beamUniforms.uAlpha.value = holoAlpha;

        const riseEase = 1.0 - Math.pow(1.0 - holoAlpha, 3);
        const bobOffset = Math.sin(fountainClock * 2.2) * 0.08;
        hologramPortraitPivot.position.y =
          THREE.MathUtils.lerp(0.9, 1.85, riseEase) + bobOffset;
        const scaleEase = THREE.MathUtils.lerp(0.55, 1.0, riseEase);
        hologramPortraitPivot.scale.setScalar(scaleEase);

        const lookYaw = Math.atan2(
          playerPos.x - nav.originX,
          playerPos.z - nav.originZ,
        );
        hologramPortraitPivot.rotation.y = lookYaw;

        hologramBacklightMat.opacity = holoAlpha * 0.92;
        hologramBackdropMat.opacity = holoAlpha * 0.92;
        hologramPlaneMat.opacity =
          holoAlpha * (0.34 + 0.1 * Math.sin(fountainClock * 4.2));

        blossomSparklesGroup.visible = true;
        cyanSparkleMat.opacity = holoAlpha * 0.9;
        roseConfettiMat.opacity = holoAlpha * 0.9;
        for (let i = 0; i < hologramParticles.length; i++) {
          const p = hologramParticles[i];
          const ang = p.baseAngle + fountainClock * p.speed;
          const lift = ((p.baseY + fountainClock * 0.55) % 2.8) * riseEase;
          const radialPulse = p.radius + Math.sin(fountainClock * 2.4 + i) * 0.12;
          p.mesh.position.set(
            Math.cos(ang) * radialPulse,
            0.35 + lift,
            Math.sin(ang) * radialPulse,
          );
          p.mesh.rotation.y = ang + fountainClock * 1.8;
          p.mesh.rotation.x = Math.sin(fountainClock * 2.2 + i) * 0.45;
        }
      } else {
        hologramGroup.visible = false;
        blossomSparklesGroup.visible = false;
      }

      // Player Local Coordinates & Distance-Based Detail (LOD: 0-12m, 12-25m, 25m+)
      const playerLocalX = playerPos.x - nav.originX;
      const playerLocalY = playerPos.y - nav.baseY;
      const playerLocalZ = playerPos.z - nav.originZ;
      const distToCastleCenter = Math.hypot(playerLocalX, playerLocalZ);

      // Section 6: Distance-Based Detail (LOD) for Love Ribbon Staircase & Chandelier
      const isCloseLod = distToCastleCenter <= 12.0;
      const isMedLod = distToCastleCenter <= 25.0;
      lrCrystalsGroup.visible = isMedLod;
      lrHeartFiligreeGroup.visible = isMedLod;
      chCrystalsGroup.visible = isMedLod;

      // Firefly Pathway Animation
      for (let i = 0; i < PATHWAY_FIREFLY_COUNT; i++) {
        const f = pathwayFireflies[i];
        const i3 = i * 3;
        const loopX =
          f.anchorX +
          Math.sin(fountainClock * f.speedX + f.phase) * f.ampX +
          Math.cos(fountainClock * 0.7 + f.phase) * 0.25;
        const loopY =
          f.anchorY +
          Math.sin(fountainClock * f.speedY + f.phase * 1.3) * f.ampY;
        const loopZ =
          f.anchorZ +
          Math.cos(fountainClock * f.speedZ + f.phase * 0.9) * f.ampZ;

        const dx = playerLocalX - loopX;
        const dz = playerLocalZ - loopZ;
        const distXZ = Math.hypot(dx, dz);

        let attractRatio = 0.0;
        if (distXZ < 7.5 && Math.abs(playerLocalY - loopY) < 4.5) {
          attractRatio = Math.pow(1.0 - distXZ / 7.5, 1.5);
        }

        const swirlAngle = fountainClock * 3.4 + f.phase;
        const targetFootX = playerLocalX + Math.cos(swirlAngle) * 1.15;
        const targetFootY = playerLocalY + 0.65 + Math.sin(swirlAngle * 1.3) * 0.28;
        const targetFootZ = playerLocalZ + Math.sin(swirlAngle) * 1.15;

        fireflyPosArray[i3] = THREE.MathUtils.lerp(loopX, targetFootX, attractRatio * 0.58);
        fireflyPosArray[i3 + 1] = THREE.MathUtils.lerp(loopY, targetFootY, attractRatio * 0.52);
        fireflyPosArray[i3 + 2] = THREE.MathUtils.lerp(loopZ, targetFootZ, attractRatio * 0.58);

        const pulse = 0.68 + 0.32 * Math.sin(fountainClock * 3.6 + f.phase * 2.0);
        const boost = THREE.MathUtils.lerp(pulse, 1.55, attractRatio);
        fireflyPosAttr.needsUpdate = true;
        fireflyColorArray[i3] = Math.min(1.0, f.baseR * boost);
        fireflyColorArray[i3 + 1] = Math.min(1.0, f.baseG * boost);
        fireflyColorArray[i3 + 2] = Math.min(1.0, f.baseB * boost);
      }
      fireflyPosAttr.needsUpdate = true;
      fireflyColorAttr.needsUpdate = true;

      // Animate Barbie Castle Elevator Cabin Y, Curved Pink/Gold Doors, Magical Floor Indicator & Control Panel Sparkles
      const currentCabinLocalY = nav.elevatorCabinY - nav.baseY;
      cabinGroup.position.y = currentCabinLocalY;

      const doorArcAngle = nav.elevatorDoorsOpenRatio * 0.54;
      leftSlideDoor.rotation.y = -doorArcAngle;
      rightSlideDoor.rotation.y = doorArcAngle;

      crownChandelierGroup.rotation.y = clockVal * 0.35;
      topSpireHeartFinial.rotation.y = clockVal * 0.85;
      pinkLedStripMat.emissiveIntensity = 1.35 + Math.sin(clockVal * 3.2) * 0.25;

      let closestFloorId = lastDisplayedFloorId;
      let minFloorDist = 999;
      for (let i = 0; i < elevatorHeartIndicators.length; i++) {
        const ind = elevatorHeartIndicators[i];
        const floorDist = Math.abs(currentCabinLocalY - ind.elevOffset);
        if (floorDist < minFloorDist) {
          minFloorDist = floorDist;
          closestFloorId = ind.floorId;
        }
        const isCurrentFloor = floorDist < 1.1;
        ind.mat.emissiveIntensity = isCurrentFloor
          ? 2.1 + Math.sin(clockVal * 5.5) * 0.45
          : 0.48 + Math.sin(clockVal * 2.0 + i) * 0.12;
      }

      if (closestFloorId !== lastDisplayedFloorId) {
        lastDisplayedFloorId = closestFloorId;
        drawMagicalFloorIndicator(closestFloorId);
        drawCrystalControlPanel(closestFloorId);
      }

      if (elevatorPanelSparkleTimer > 0) {
        elevatorPanelSparkleTimer = Math.max(0, elevatorPanelSparkleTimer - delta);
        const prog = 1.0 - elevatorPanelSparkleTimer / 1.25;
        panelSparkleMat.opacity = Math.sin(prog * Math.PI);
        for (let sp = 0; sp < panelSparkleMeshes.length; sp++) {
          const sm = panelSparkleMeshes[sp];
          sm.visible = true;
          const ang = (sp * Math.PI * 2) / panelSparkleMeshes.length + prog * 3.2;
          const rad = 0.12 + prog * 0.28;
          sm.position.set(Math.cos(ang) * rad, Math.sin(ang) * (rad * 1.2), 0.04 + prog * 0.06);
          sm.rotation.z = prog * 6.0 + sp;
          sm.scale.setScalar(0.6 + Math.sin(prog * Math.PI) * 0.8);
        }
      } else {
        for (let sp = 0; sp < panelSparkleMeshes.length; sp++) {
          panelSparkleMeshes[sp].visible = false;
        }
      }

      // Section 1F & 5: Pulse Love Ribbon Staircase Newel Heart Crystals & Risers ONLY when climbing stairs
      const isOnStairs12 =
        Math.abs(Math.abs(playerLocalX) - 6.9) < 2.2 && Math.abs(playerLocalZ) < 6.8;
      const isOnStairs23 =
        Math.abs(playerLocalX - 7.5) < 2.1 && playerLocalZ >= 6.0 && playerLocalZ <= 13.5 && playerLocalY >= 4.8;
      const isOnStairs34 =
        Math.abs(playerLocalX - (-7.5)) < 2.1 && playerLocalZ >= 6.0 && playerLocalZ <= 13.5 && playerLocalY >= 9.8;
      const isClimbingAnyStair = isOnStairs12 || isOnStairs23 || isOnStairs34;

      if (isClimbingAnyStair) {
        newelHeartCrystalMat.emissiveIntensity = 1.15 + Math.sin(clockVal * 4.8) * 0.45;
        loveRibbonPinkMat.emissiveIntensity = 0.38 + Math.sin(clockVal * 3.6) * 0.14;
      } else {
        newelHeartCrystalMat.emissiveIntensity = 0.45;
        loveRibbonPinkMat.emissiveIntensity = 0.22;
      }

      if (isMedLod) {
        for (let s = 0; s < stairRiserMats.length; s++) {
          const stepY = stairStepHeights[s];
          const stepProximity =
            isOnStairs12 && Math.abs(playerLocalY - stepY) < 1.25
              ? 1.0 - Math.abs(playerLocalY - stepY) / 1.25
              : 0.0;
          const gentleWave = isCloseLod
            ? 0.52 + 0.24 * Math.sin(clockVal * 3.2 - s * 0.35)
            : 0.52;
          stairRiserMats[s].emissiveIntensity = gentleWave + stepProximity * 1.65;
        }
      }

      // Section 15: "Two Hearts Became One Light" Chandelier Proximity Shimmer & Floor Heart Illumination
      const isBeneathChandelier = distToCastleCenter < 4.2 && Math.abs(playerLocalY - 0.25) < 2.0;
      const targetChandelierShimmer = isBeneathChandelier ? 1.0 : 0.0;
      chandelierShimmerAlpha = THREE.MathUtils.lerp(
        chandelierShimmerAlpha,
        targetChandelierShimmer,
        1 - Math.exp(-4.5 * delta),
      );

      if (chandelierShimmerAlpha > 0.01) {
        chandelierFloorHeartDecal.visible = true;
        chandelierFloorHeartMat.opacity =
          chandelierShimmerAlpha * (0.65 + 0.15 * Math.sin(clockVal * 3.2));
        chandelierFloorHeartDecal.rotation.z = clockVal * 0.12;
      } else {
        chandelierFloorHeartDecal.visible = false;
      }

      chUnifiedCoreCrystalMat.emissiveIntensity =
        1.25 + chandelierShimmerAlpha * 0.95 + Math.sin(clockVal * 3.8) * 0.22;
      chWarmCrystalHeartMat.emissiveIntensity =
        0.68 + chandelierShimmerAlpha * 0.55 + Math.sin(clockVal * 3.2) * 0.15;
      chBlushCrystalHeartMat.emissiveIntensity =
        0.65 + chandelierShimmerAlpha * 0.55 + Math.cos(clockVal * 3.2) * 0.15;
      unifiedCoreMesh.rotation.y = clockVal * 0.65;
      bottomHeartCrystal.rotation.y = clockVal * 0.45;

      const musicPulse = Math.max(
        floor1Rooms.getMusicPulseIntensity(),
        floor2Rooms.getStagePulseIntensity(),
      );
      chandelierLight.intensity =
        2.2 +
        chandelierShimmerAlpha * 0.45 +
        musicPulse * 0.85 +
        Math.sin(clockVal * 4.5) * (musicPulse > 0.05 ? 0.25 : 0.04);
      chandelierPinkFillLight.intensity =
        0.65 + chandelierShimmerAlpha * 0.55 + musicPulse * 0.35;
    },

    dispose: () => {
      tracker.dispose();
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    },
  };
}