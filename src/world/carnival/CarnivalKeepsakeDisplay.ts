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
  CarnivalBoothAttraction,
  createGiftOrbitCameraState,
} from './CarnivalBooths';
import { createPrizeDisplayBox } from './CarnivalPrizeSystem';
import { PrizeCinematicFXSystem } from './PrizeCinematicFX';
import {
  CarnivalActiveOverlay,
  CarnivalAttractionId,
  CarnivalAttractionState,
  CarnivalCameraFocus,
  CarnivalPromptVerb,
} from './CarnivalState';

export interface CarnivalKeepsakeDisplayInstance {
  group: THREE.Group;
  update: (dt: number, elapsedTime: number, earnedPrizeIds: Set<string>) => void;
  dispose: () => void;
}

export interface RomanticMidwayAdditionsBundle {
  group: THREE.Group;
  attractions: CarnivalBoothAttraction[];
  update: (
    dt: number,
    elapsedTime: number,
    playerPos: THREE.Vector3 | undefined,
    earnedPrizeIds: Set<string>,
  ) => void;
  dispose: () => void;
}

const _dummy = new THREE.Object3D();

/**
 * Creates the persistent Romantic Midway Keepsake Display Table in the Carnival district.
 * Shows an ornate tiered wooden & velvet display table where each earned miniature prize
 * is permanently showcased under warm lantern light for Harsha to admire anytime.
 */
export function createCarnivalKeepsakeDisplay(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  colliders: CircleCollider[],
): CarnivalKeepsakeDisplayInstance {
  const group = new THREE.Group();
  group.name = 'CarnivalKeepsakeDisplay';
  const groundY = getTerrainHeight(x, z);
  group.position.set(x, groundY, z);
  group.rotation.y = rotY;

  colliders.push({ x, z, radius: 1.5 });

  // 1. Table base: Carved cream stone & warm timber plinth
  const tableTopGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.6, 0.12, 1.2, 0.025),
  );
  tableTopGeo.translate(0, 0.95, 0);
  const tableTop = new THREE.Mesh(tableTopGeo, mats.warmTimber);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  group.add(tableTop);

  const tableSkirtGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.5, 0.18, 1.1, 0.02),
  );
  tableSkirtGeo.translate(0, 0.82, 0);
  const tableSkirt = new THREE.Mesh(tableSkirtGeo, mats.creamStone);
  group.add(tableSkirt);

  // 4 Turned brass & timber legs
  const legGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.065, 0.045, 0.88, 10));
  for (const lx of [-1.15, 1.15]) {
    for (const lz of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(legGeo, mats.brushedGold);
      leg.position.set(lx, 0.44, lz);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  // 2. Velvet-lined two-tier stepped riser on the table surface
  const lowerRiserGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.4, 0.06, 0.5, 0.015),
  );
  lowerRiserGeo.translate(0, 1.04, 0.22);
  const lowerRiser = new THREE.Mesh(lowerRiserGeo, mats.crimsonVelvet);
  group.add(lowerRiser);

  const upperRiserGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.4, 0.12, 0.5, 0.015),
  );
  upperRiserGeo.translate(0, 1.07, -0.22);
  const upperRiser = new THREE.Mesh(upperRiserGeo, mats.crimsonVelvet);
  group.add(upperRiser);

  // Header display sign: "HARSHA'S CARNIVAL KEEPSAKES ♡"
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#faf1e4';
  sCtx.fillRect(0, 0, 512, 128);
  sCtx.strokeStyle = '#c89646';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(6, 6, 500, 116);
  sCtx.fillStyle = '#4a1c28';
  sCtx.font = 'bold 26px Georgia, serif';
  sCtx.textAlign = 'center';
  sCtx.textBaseline = 'middle';
  sCtx.fillText("HARSHA'S KEEPSAKES", 256, 48);
  sCtx.fillStyle = '#c23b57';
  sCtx.font = 'italic 18px Georgia, serif';
  sCtx.fillText('Every Gift Won With Love ♡', 256, 88);

  const signTex = tracker.trackTex(new THREE.CanvasTexture(signCanvas));
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.needsUpdate = true;
  const signMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 }),
  );
  const signGeo = tracker.trackGeo(new THREE.BoxGeometry(1.4, 0.32, 0.04));
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(0, 1.45, -0.5);
  group.add(signMesh);

  // Two delicate brass posts holding the header sign
  const postGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8));
  for (const px of [-0.62, 0.62]) {
    const post = new THREE.Mesh(postGeo, mats.brushedGold);
    post.position.set(px, 1.25, -0.5);
    group.add(post);
  }

  // 3. Mount 8 velvet pedestals (4 on front tier, 4 on rear tier)
  const pedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.13, 0.04, 16));
  const prizeKeys = [
    'paired_heart_charm', // #1 Heartshot
    'twin_ring_charms',   // #2 Ring Toss
    'little_rose_token',  // #3 Knockdown (Memory Card)
    'golden_star_token',  // #4 Frog Launch
    'tiny_aurora_crystal',// #5 Mystery Egg
    'mini_carousel_horse',// #6 Carousel
    'unfolding_sky_ticket',// #7 Ferris Wheel
    'little_glowing_flower',// #8 Quiet Garden
  ] as const;

  interface DisplaySlot {
    key: string;
    boxInstance: ReturnType<typeof createPrizeDisplayBox>;
    pedestalMesh: THREE.Mesh;
    unlocked: boolean;
  }

  const slots: DisplaySlot[] = [];

  for (let i = 0; i < 8; i++) {
    const key = prizeKeys[i];
    const isFrontTier = i < 4;
    const colIdx = i % 4;
    const px = -0.84 + colIdx * 0.56;
    const pz = isFrontTier ? 0.22 : -0.22;
    const py = isFrontTier ? 1.08 : 1.14;

    const pedestal = new THREE.Mesh(pedestalGeo, mats.brushedGold);
    pedestal.position.set(px, py, pz);
    group.add(pedestal);

    const boxInstance = createPrizeDisplayBox(key, tracker, mats);
    boxInstance.group.position.set(px, py + 0.02, pz);
    boxInstance.group.scale.setScalar(0.55);
    boxInstance.group.visible = false;
    group.add(boxInstance.group);

    slots.push({
      key,
      boxInstance,
      pedestalMesh: pedestal,
      unlocked: false,
    });
  }

  return {
    group,
    update(_dt: number, elapsedTime: number, earnedPrizeIds: Set<string>) {
      for (const slot of slots) {
        const isEarned = earnedPrizeIds.has(slot.key);
        if (isEarned && !slot.unlocked) {
          slot.unlocked = true;
          slot.boxInstance.group.visible = true;
          slot.boxInstance.setOpenProgress(1.0, elapsedTime);
        }

        if (slot.unlocked) {
          slot.boxInstance.charmPivot.rotation.y = elapsedTime * 0.9;
        }
      }
    },
    dispose() {
      for (const s of slots) {
        s.boxInstance.dispose();
      }
    },
  };
}

/**
 * Helper to create an engraved brass plaque texture.
 */
function createEngravedBrassPlaqueTexture(
  headline: string,
  inscription: string,
  tracker: ResourceTracker,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 160);
  grad.addColorStop(0, '#f6d678');
  grad.addColorStop(0.5, '#ffeca8');
  grad.addColorStop(1, '#c8912c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#5c3a09';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#3b2104';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline, 256, 48);

  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText(inscription, 256, 102);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the Parchment Letter texture inside the "Two Stamped Tickets" Climax Cabinet.
 */
function createYeshwanthParchmentLetterTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, 512, 640);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 480, 608);

  ctx.strokeStyle = '#c23b57';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 456, 584);

  ctx.fillStyle = '#8c2d46';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('For Harsha ♡', 256, 95);

  ctx.fillStyle = '#2d121c';
  ctx.font = 'italic 22px Georgia, serif';
  const lines = [
    'Every game, every lantern light,',
    'and every quiet corner of this',
    'midway was built to see you smile.',
    '',
    'Thank you for sharing this ride,',
    'this island, and every adventure',
    'with me.',
  ];
  lines.forEach((line, idx) => {
    ctx.fillText(line, 256, 175 + idx * 42);
  });

  ctx.fillStyle = '#8c2d46';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('Forever yours, Yeshwanth ♡', 256, 505);

  // Crimson wax seal emblem at bottom
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(256, 565, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText('♡', 256, 572);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * ============================================================================
 * SECTION 5: THE 6 ROMANTIC MIDWAY ENVIRONMENTAL ADDITIONS
 * 1. Midway Memory Waltz (Reactive Footstep Fireflies)
 * 2. Dual-Seat Bench & Vintage Music Box at Water's Edge (x = 9.2, z = -74.5)
 * 3. Starlight Wish Jar on the Boardwalk Pier (x = 0, z = -84.0) + Sky Constellation
 * 4. "Lost & Found" Curiosity Cabinet (x = -5.6, z = -56.8)
 * 5. Lantern Bloom Path to the Quiet Garden (3m proximity bloom + audio crossfade)
 * 6. "Two Stamped Tickets" Climax Cabinet (x = 5.4, z = -66.8)
 * ============================================================================
 */
export function createRomanticMidwayAdditions(
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
  earnedPrizes: Set<string>,
  onUnlockFullFestoonGlow: () => void,
): RomanticMidwayAdditionsBundle {
  const group = new THREE.Group();
  group.name = 'RomanticMidwayAdditions';
  const attractions: CarnivalBoothAttraction[] = [];

  // ==========================================================================
  // 1. MIDWAY MEMORY WALTZ (Reactive Footstep Fireflies InstancedMesh)
  // ==========================================================================
  const footstepPoolSize = 36;
  const footstepGeo = tracker.trackGeo(new THREE.SphereGeometry(0.032, 8, 8));
  const footstepMat = tracker.trackMat(mats.warmLanternGlow.clone());
  footstepMat.emissiveIntensity = 1.15;
  const footstepMesh = new THREE.InstancedMesh(footstepGeo, footstepMat, footstepPoolSize);
  footstepMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  footstepMesh.frustumCulled = false;
  group.add(footstepMesh);

  interface FootstepMote {
    x: number;
    y: number;
    z: number;
    vy: number;
    phase: number;
    life: number;
    maxLife: number;
  }
  const activeFootsteps: FootstepMote[] = [];
  const lastPlayerPos = new THREE.Vector3();
  let hasLastPlayerPos = false;
  let stepDistanceAccum = 0;

  // ==========================================================================
  // 2. DUAL-SEAT BENCH & VINTAGE MUSIC BOX AT WATER'S EDGE (x = 9.2, z = -74.5)
  // ==========================================================================
  {
    const bx = 9.2;
    const bz = -74.5;
    const bRotY = -0.35;
    const bGroundY = getTerrainHeight(bx, bz);
    const benchRoot = new THREE.Group();
    benchRoot.position.set(bx, bGroundY, bz);
    benchRoot.rotation.y = bRotY;
    group.add(benchRoot);
    colliders.push({ x: bx, z: bz, radius: 1.25 });

    // Dual-seat timber & wrought-bronze romantic bench
    const seatGeo = tracker.trackGeo(createBeveledBoxGeometry(1.75, 0.08, 0.58, 0.02));
    const seatMesh = new THREE.Mesh(seatGeo, mats.warmTimber);
    seatMesh.position.y = 0.46;
    seatMesh.castShadow = true;
    const backGeo = tracker.trackGeo(createBeveledBoxGeometry(1.75, 0.52, 0.07, 0.02));
    const backMesh = new THREE.Mesh(backGeo, mats.warmTimber);
    backMesh.position.set(0, 0.55, 0.25);
    backMesh.rotation.x = 0.14;
    const legGeo = tracker.trackGeo(new THREE.BoxGeometry(0.1, 0.46, 0.52));
    legGeo.translate(0, 0.23, 0);
    const legL = new THREE.Mesh(legGeo, mats.wroughtBronze);
    legL.position.x = -0.74;
    const legR = new THREE.Mesh(legGeo, mats.wroughtBronze);
    legR.position.x = 0.74;
    benchRoot.add(seatMesh, backMesh, legL, legR);

    // Side table & Vintage Walnut Music Box with spinning brass drum
    const sideTableGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.26, 0.62, 14));
    sideTableGeo.translate(0, 0.31, 0);
    const sideTable = new THREE.Mesh(sideTableGeo, mats.darkWalnut);
    sideTable.position.set(1.18, 0, -0.12);
    sideTable.castShadow = true;
    benchRoot.add(sideTable);

    const mboxBaseGeo = tracker.trackGeo(createBeveledBoxGeometry(0.32, 0.14, 0.24, 0.015));
    const mboxBase = new THREE.Mesh(mboxBaseGeo, mats.darkWalnut);
    mboxBase.position.set(1.18, 0.69, -0.12);
    benchRoot.add(mboxBase);

    const mboxLidPivot = new THREE.Group();
    mboxLidPivot.position.set(1.18, 0.76, -0.01);
    const mboxLidGeo = tracker.trackGeo(createBeveledBoxGeometry(0.32, 0.04, 0.24, 0.01));
    mboxLidGeo.translate(0, 0.02, -0.11);
    const mboxLid = new THREE.Mesh(mboxLidGeo, mats.creamStone);
    mboxLidPivot.add(mboxLid);
    benchRoot.add(mboxLidPivot);

    const brassDrumGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.16, 12));
    brassDrumGeo.rotateZ(Math.PI / 2);
    const brassDrum = new THREE.Mesh(brassDrumGeo, mats.brushedGold);
    brassDrum.position.set(1.18, 0.77, -0.12);
    benchRoot.add(brassDrum);

    let state: CarnivalAttractionState = 'IDLE';
    let stateTimer = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let curYaw = 0;
    let curPitch = 0;

    const worldPos = new THREE.Vector3(bx, bGroundY, bz);
    const interactPos = new THREE.Vector3(bx, bGroundY, bz - 0.85);
    const seatWorldPos = new THREE.Vector3(bx, bGroundY + 0.08, bz);
    const camWorldPos = new THREE.Vector3();
    const lookWorldPos = new THREE.Vector3();

    attractions.push({
      id: 'waters_edge_bench' as CarnivalAttractionId,
      title: "Water's Edge Bench & Music Box",
      subtitle: 'Starlight Harbor Overlook',
      verb: 'E Sit Together & Listen' as CarnivalPromptVerb,
      group: benchRoot,
      worldPos,
      interactPos,
      interactRadius: 3.2,
      getState: () => state,
      getPrizeId: () => '',
      activate() {
        state = 'PLAYING';
        stateTimer = 0;
        targetYaw = 0;
        targetPitch = 0;
        curYaw = 0;
        curPitch = 0;
        audio.startCarouselMusicBox();
        fx.triggerSparkleRing(worldPos.clone().add(new THREE.Vector3(1.18, 0.82, -0.12)), 0.22, 16);
      },
      performAction() {
        return false;
      },
      advanceStep() {
        if (state === 'PLAYING') {
          audio.stopCarouselMusicBox();
          state = 'RECOVERY';
          stateTimer = 0;
          return true;
        }
        return false;
      },
      skip() {
        audio.stopCarouselMusicBox();
        state = 'IDLE';
        stateTimer = 0;
        return { earnedPrizeId: null };
      },
      applyMouseDelta(dx: number, dy: number) {
        if (state !== 'PLAYING') return;
        targetYaw = THREE.MathUtils.clamp(targetYaw - dx * 0.0032, -1.48, 1.48);
        targetPitch = THREE.MathUtils.clamp(targetPitch - dy * 0.0026, -0.55, 0.75);
      },
      getOverlay(): CarnivalActiveOverlay | null {
        if (state === 'IDLE' || state === 'RECOVERY') return null;
        return {
          attractionId: 'waters_edge_bench' as CarnivalAttractionId,
          title: "Water's Edge Bench & Music Box",
          subtitle: 'Vintage Cylinder Music Box Playing',
          state,
          captionLine:
            '"Sitting by the water with you while the Ferris wheel lights shimmer across the waves—I could stay here forever. ♡"',
          instruction: 'Move Mouse or WASD / Arrows to Look Around · Press Enter or Esc to Stand Up',
          requiresEnterToContinue: true,
        };
      },
      getCameraFocus(): CarnivalCameraFocus | null {
        if (state === 'IDLE') return null;
        // Look south-west across the moonlit water & Starlight Ferris Wheel
        const viewYaw = Math.PI + bRotY + curYaw;
        const viewPitch = 0.05 + curPitch;
        camWorldPos.set(seatWorldPos.x, seatWorldPos.y + 1.02, seatWorldPos.z);
        lookWorldPos.set(
          camWorldPos.x + Math.sin(viewYaw) * Math.cos(viewPitch) * 12,
          camWorldPos.y + Math.sin(viewPitch) * 12,
          camWorldPos.z + Math.cos(viewYaw) * Math.cos(viewPitch) * 12,
        );
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.5 : 1.0,
          playerPos: state === 'RECOVERY' ? interactPos : seatWorldPos,
          playerYaw: viewYaw,
          isSitting: true,
          hidePlayerAvatar: true,
        };
      },
      update(dt: number, elapsedTime: number, _cam?: THREE.PerspectiveCamera, keys?: Set<string>) {
        stateTimer += dt;
        const openTarget = state === 'PLAYING' ? 1.25 : 0;
        mboxLidPivot.rotation.x = THREE.MathUtils.lerp(mboxLidPivot.rotation.x, openTarget, 8 * dt);
        if (state === 'PLAYING') {
          brassDrum.rotation.x = elapsedTime * 2.4;
          if (keys) {
            if (keys.has('KeyA') || keys.has('ArrowLeft')) targetYaw = THREE.MathUtils.clamp(targetYaw + 1.5 * dt, -1.48, 1.48);
            if (keys.has('KeyD') || keys.has('ArrowRight')) targetYaw = THREE.MathUtils.clamp(targetYaw - 1.5 * dt, -1.48, 1.48);
            if (keys.has('KeyW') || keys.has('ArrowUp')) targetPitch = THREE.MathUtils.clamp(targetPitch + 1.2 * dt, -0.55, 0.75);
            if (keys.has('KeyS') || keys.has('ArrowDown')) targetPitch = THREE.MathUtils.clamp(targetPitch - 1.2 * dt, -0.55, 0.75);
          }
          curYaw = THREE.MathUtils.damp(curYaw, targetYaw, 10, dt);
          curPitch = THREE.MathUtils.damp(curPitch, targetPitch, 10, dt);
        } else if (state === 'RECOVERY' && stateTimer >= 0.5) {
          state = 'IDLE';
          stateTimer = 0;
        }
        return { newlyEarnedPrizeId: null };
      },
    });
  }

  // ==========================================================================
  // 3. STARLIGHT WISH JAR ON THE BOARDWALK PIER (x = 0, z = -84.0)
  // ==========================================================================
  {
    const wx = 0;
    const wz = -84.0;
    const wGroundY = getTerrainHeight(wx, wz);
    const wishRoot = new THREE.Group();
    wishRoot.position.set(wx, wGroundY, wz);
    group.add(wishRoot);
    colliders.push({ x: wx, z: wz, radius: 0.95 });

    // Ornate carved stone & brass pier pedestal
    const pedGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.34, 0.44, 1.08, 16));
    pedGeo.translate(0, 0.54, 0);
    const pedMesh = new THREE.Mesh(pedGeo, mats.creamStone);
    pedMesh.castShadow = true;
    wishRoot.add(pedMesh);

    const brassCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.38, 0.36, 0.08, 16));
    brassCapGeo.translate(0, 1.1, 0);
    const brassCap = new THREE.Mesh(brassCapGeo, mats.brushedGold);
    wishRoot.add(brassCap);

    // Crystalline Glass Starlight Wish Jar
    const jarGlassMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fffbeb'),
        roughness: 0.1,
        metalness: 0.05,
        transmission: 0.78,
        transparent: true,
        opacity: 0.88,
        clearcoat: 1.0,
      }),
    );
    jarGlassMat.userData.preserveFinish = true;
    const jarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.19, 0.17, 0.44, 18));
    jarGeo.translate(0, 1.36, 0);
    const jarMesh = new THREE.Mesh(jarGeo, jarGlassMat);
    wishRoot.add(jarMesh);

    const jarLidGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.15, 0.16, 0.06, 16));
    jarLidGeo.translate(0, 1.60, 0);
    const jarLid = new THREE.Mesh(jarLidGeo, mats.brushedGold);
    wishRoot.add(jarLid);

    // Floating golden starlight motes inside the jar + ascending sky constellation above Ferris Wheel
    const starGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.055, 0));
    const starMat = tracker.trackMat(mats.warmLanternGlow.clone());
    starMat.emissiveIntensity = 1.6;

    const jarMotes: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(starGeo, starMat);
      m.scale.setScalar(0.5);
      wishRoot.add(m);
      jarMotes.push(m);
    }

    // 3 Rising Constellation Stars that arc high into the night sky above the Ferris Wheel (-13.5, 27.5, -73.0)
    const WISHES = [
      {
        title: 'Starlight Wish I · Quiet Evenings',
        caption: '"For every quiet evening we spend laughing at nothing at all. ♡"',
        skyTarget: new THREE.Vector3(-15.5, 27.5, 11.0), // relative to wishRoot (0, wGroundY, -84.0) -> world (-15.5, 28, -73)
      },
      {
        title: 'Starlight Wish II · Beyond the Horizon',
        caption: '"For all the adventures waiting for us beyond the horizon. ✦"',
        skyTarget: new THREE.Vector3(-13.5, 29.8, 11.0),
      },
      {
        title: 'Starlight Wish III · Always Beside You',
        caption: '"For a lifetime of choosing the seat right next to you. ♡"',
        skyTarget: new THREE.Vector3(-11.5, 27.5, 11.0),
      },
    ];

    interface SkyStarNode {
      mesh: THREE.Mesh;
      launched: boolean;
      progress: number;
      target: THREE.Vector3;
    }
    const skyStars: SkyStarNode[] = WISHES.map((w) => {
      const sMesh = new THREE.Mesh(starGeo, starMat);
      sMesh.position.set(0, 1.4, 0);
      sMesh.scale.setScalar(0.001);
      wishRoot.add(sMesh);
      return {
        mesh: sMesh,
        launched: false,
        progress: 0,
        target: w.skyTarget,
      };
    });

    let state: CarnivalAttractionState = 'IDLE';
    let stateTimer = 0;
    let currentWishIdx = 0;
    let nextWishCounter = 0;

    const worldPos = new THREE.Vector3(wx, wGroundY, wz);
    const interactPos = new THREE.Vector3(wx, wGroundY, wz + 1.65);
    const camWorldPos = new THREE.Vector3();
    const lookWorldPos = new THREE.Vector3();

    function releaseWish(idx: number) {
      currentWishIdx = ((idx % 3) + 3) % 3;
      const star = skyStars[currentWishIdx];
      star.launched = true;
      star.progress = 0;
      audio.playPrizeRevealArpeggio();
      fx.triggerSparkleRing(worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.28, 22);
      fx.triggerHeartBurst(worldPos.clone().add(new THREE.Vector3(0, 1.55, 0)), 12);
    }

    attractions.push({
      id: 'starlight_wish_jar' as CarnivalAttractionId,
      title: 'Starlight Wish Jar',
      subtitle: 'Boardwalk Pier Constellation',
      verb: 'E Make a Starlight Wish' as CarnivalPromptVerb,
      group: wishRoot,
      worldPos,
      interactPos,
      interactRadius: 3.2,
      getState: () => state,
      getPrizeId: () => '',
      activate() {
        state = 'PLAYING';
        stateTimer = 0;
        releaseWish(nextWishCounter);
        nextWishCounter = (nextWishCounter + 1) % 3;
      },
      selectOption(index: number) {
        const normalized = index >= 1 && index <= 3 ? index - 1 : THREE.MathUtils.clamp(index, 0, 2);
        if (state === 'PLAYING') {
          releaseWish(normalized);
        }
      },
      performAction() {
        if (state === 'PLAYING') {
          releaseWish((currentWishIdx + 1) % 3);
          return true;
        }
        return false;
      },
      advanceStep() {
        if (state === 'PLAYING') {
          state = 'RECOVERY';
          stateTimer = 0;
          return true;
        }
        return false;
      },
      skip() {
        state = 'IDLE';
        stateTimer = 0;
        return { earnedPrizeId: null };
      },
      applyMouseDelta() {},
      getOverlay(): CarnivalActiveOverlay | null {
        if (state === 'IDLE' || state === 'RECOVERY') return null;
        const w = WISHES[currentWishIdx];
        const launchedCount = skyStars.filter((s) => s.launched).length;
        return {
          attractionId: 'starlight_wish_jar' as CarnivalAttractionId,
          title: 'Starlight Wish Jar',
          subtitle: `${w.title} (${launchedCount}/3 Stars in the Sky)`,
          state,
          captionLine: w.caption,
          instruction: 'Press Space to Release Another Wish into the Constellation · Enter or Esc to Step Back',
          requiresEnterToContinue: true,
        };
      },
      getCameraFocus(): CarnivalCameraFocus | null {
        if (state === 'IDLE') return null;
        const star = skyStars[currentWishIdx];
        const lookLift = THREE.MathUtils.smoothstep(star.progress, 0.1, 0.95) * 4.5;
        camWorldPos.set(wx + 0.4, wGroundY + 1.68, wz + 2.35);
        lookWorldPos.set(wx - 2.2 * (lookLift / 4.5), wGroundY + 1.45 + lookLift, wz - 1.5);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.5 : 1.0,
          playerPos: interactPos,
          playerYaw: Math.PI,
          hidePlayerAvatar: true,
        };
      },
      update(dt: number, elapsedTime: number) {
        stateTimer += dt;
        for (let i = 0; i < jarMotes.length; i++) {
          const a = elapsedTime * 1.6 + i * 1.05;
          jarMotes[i].position.set(
            Math.cos(a) * 0.09,
            1.28 + ((Math.sin(elapsedTime * 2.1 + i) + 1) * 0.12),
            Math.sin(a) * 0.09,
          );
        }
        for (let i = 0; i < skyStars.length; i++) {
          const st = skyStars[i];
          if (!st.launched) continue;
          st.progress = Math.min(1, st.progress + dt * 0.55);
          const u = THREE.MathUtils.smoothstep(st.progress, 0, 1);
          st.mesh.position.set(
            THREE.MathUtils.lerp(0, st.target.x, u),
            THREE.MathUtils.lerp(1.45, st.target.y, u) + Math.sin(u * Math.PI) * 3.5,
            THREE.MathUtils.lerp(0, st.target.z, u),
          );
          const twinkle = 2.6 + Math.sin(elapsedTime * 4.5 + i * 2) * 0.65;
          st.mesh.scale.setScalar(THREE.MathUtils.lerp(0.6, twinkle, u));
          st.mesh.rotation.y = elapsedTime * 1.8;
        }
        if (state === 'RECOVERY' && stateTimer >= 0.5) {
          state = 'IDLE';
          stateTimer = 0;
        }
        return { newlyEarnedPrizeId: null };
      },
    });
  }

  // ==========================================================================
  // 4. "LOST & FOUND" CURIOSITY CABINET (x = -5.6, z = -56.8, rotY = 0.25)
  // ==========================================================================
  {
    const cx = -5.6;
    const cz = -56.8;
    const cRotY = 0.25;
    const cGroundY = getTerrainHeight(cx, cz);
    const cabRoot = new THREE.Group();
    cabRoot.position.set(cx, cGroundY, cz);
    cabRoot.rotation.y = cRotY;
    group.add(cabRoot);
    colliders.push({ x: cx, z: cz, radius: 1.15 });

    // Walnut & Brass Curiosity Cabinet
    const cabBodyGeo = tracker.trackGeo(createBeveledBoxGeometry(1.36, 1.85, 0.68, 0.025));
    cabBodyGeo.translate(0, 0.925, 0);
    const cabBody = new THREE.Mesh(cabBodyGeo, mats.darkWalnut);
    cabBody.castShadow = true;
    cabRoot.add(cabBody);

    const velvetBackGeo = tracker.trackGeo(new THREE.BoxGeometry(1.18, 1.05, 0.04));
    const velvetBack = new THREE.Mesh(velvetBackGeo, mats.crimsonVelvet);
    velvetBack.position.set(0, 1.28, -0.18);
    cabRoot.add(velvetBack);

    // 3 Handcrafted Miniature Mementos inside:
    // (a) Vintage cinema/carnival ticket stubs (left)
    const stubGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.09, 0.01));
    const stubA = new THREE.Mesh(stubGeo, mats.brushedGold);
    stubA.position.set(-0.34, 1.28, 0.02);
    stubA.rotation.z = 0.18;
    const stubB = new THREE.Mesh(stubGeo, mats.softRoseGold);
    stubB.position.set(-0.30, 1.26, 0.04);
    stubB.rotation.z = -0.12;
    cabRoot.add(stubA, stubB);

    // (b) Silver & Rose-Gold Heart Locket (center)
    const locketHeart = createHeartShape2D(0.11);
    const locketGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(locketHeart, { depth: 0.02, bevelEnabled: false }),
    );
    locketGeo.center();
    const locketMesh = new THREE.Mesh(locketGeo, mats.softRoseGold);
    locketMesh.position.set(0, 1.32, 0.04);
    cabRoot.add(locketMesh);

    // (c) Miniature Snow Globe containing a tiny heart island (right)
    const globeBase = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 0.05, 14)),
      mats.darkWalnut,
    );
    globeBase.position.set(0.34, 1.18, 0.04);
    const globeSphere = new THREE.Mesh(
      tracker.trackGeo(new THREE.SphereGeometry(0.085, 14, 12)),
      mats.auroraCyanGlow,
    );
    globeSphere.position.set(0.34, 1.27, 0.04);
    cabRoot.add(globeBase, globeSphere);

    // Engraved Brass Plaque: "Things that were never lost, only kept safe for the right moment."
    const plaqueTex = createEngravedBrassPlaqueTexture(
      'LOST & FOUND CURIOSITY CABINET',
      '"Things that were never lost, only kept safe for the right moment."',
      tracker,
    );
    const plaqueMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.3, metalness: 0.65 }),
    );
    plaqueMat.userData.preserveFinish = true;
    const plaqueMesh = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(1.12, 0.28, 0.02)),
      plaqueMat,
    );
    plaqueMesh.position.set(0, 0.56, 0.35);
    cabRoot.add(plaqueMesh);

    let state: CarnivalAttractionState = 'IDLE';
    let stateTimer = 0;
    const orbitCam = createGiftOrbitCameraState(1.25);
    const worldPos = new THREE.Vector3(cx, cGroundY, cz);
    const forwardDir = new THREE.Vector3(Math.sin(cRotY), 0, Math.cos(cRotY));
    const interactPos = new THREE.Vector3(
      cx + forwardDir.x * 1.95,
      cGroundY,
      cz + forwardDir.z * 1.95,
    );
    const camWorldPos = new THREE.Vector3();
    const lookWorldPos = new THREE.Vector3();

    attractions.push({
      id: 'curiosity_cabinet' as CarnivalAttractionId,
      title: '"Lost & Found" Curiosity Cabinet',
      subtitle: 'Keepsake Mementos Under Glass',
      verb: 'E Inspect Cabinet' as CarnivalPromptVerb,
      group: cabRoot,
      worldPos,
      interactPos,
      interactRadius: 3.0,
      getState: () => state,
      getPrizeId: () => '',
      activate() {
        state = 'PLAYING';
        stateTimer = 0;
        orbitCam.reset();
        audio.playCardFlutter();
      },
      performAction() {
        return false;
      },
      advanceStep() {
        if (state === 'PLAYING') {
          state = 'RECOVERY';
          stateTimer = 0;
          return true;
        }
        return false;
      },
      skip() {
        state = 'IDLE';
        stateTimer = 0;
        return { earnedPrizeId: null };
      },
      applyMouseDelta(dx: number, dy: number) {
        if (state === 'PLAYING') {
          orbitCam.applyMouse(dx, dy);
        }
      },
      applyZoomDelta(delta: number) {
        if (state === 'PLAYING') {
          orbitCam.applyZoom(delta);
        }
      },
      getOverlay(): CarnivalActiveOverlay | null {
        if (state === 'IDLE' || state === 'RECOVERY') return null;
        return {
          attractionId: 'curiosity_cabinet' as CarnivalAttractionId,
          title: '"Lost & Found" Curiosity Cabinet',
          subtitle: 'Ticket Stubs · Silver Heart Locket · Mini Heart Island Globe',
          state,
          captionLine: '"Things that were never lost, only kept safe for the right moment."',
          instruction: 'Move Mouse / A-D to Orbit · Scroll / W-S to Zoom · Press Enter or Esc to Step Back',
          requiresEnterToContinue: true,
        };
      },
      getCameraFocus(): CarnivalCameraFocus | null {
        if (state === 'IDLE') return null;
        const focusCenter = new THREE.Vector3(cx, cGroundY + 1.12, cz);
        orbitCam.computeFocus(focusCenter, cRotY, camWorldPos, lookWorldPos);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.5 : 1.0,
          playerPos: interactPos,
          playerYaw: cRotY + Math.PI,
          hidePlayerAvatar: true,
        };
      },
      update(dt: number, elapsedTime: number, _cam?: THREE.PerspectiveCamera, keys?: Set<string>) {
        stateTimer += dt;
        locketMesh.rotation.y = Math.sin(elapsedTime * 1.5) * 0.35;
        if (state === 'PLAYING') {
          orbitCam.updateKeys(dt, keys);
          fx.setTheatricalLighting(0.85, new THREE.Vector3(cx, cGroundY + 1.25, cz));
        } else if (state === 'RECOVERY') {
          fx.setTheatricalLighting((1 - stateTimer / 0.5) * 0.85, new THREE.Vector3(cx, cGroundY + 1.25, cz));
          if (stateTimer >= 0.5) {
            state = 'IDLE';
            stateTimer = 0;
          }
        }
        return { newlyEarnedPrizeId: null };
      },
    });
  }

  // ==========================================================================
  // 5. LANTERN BLOOM PATH TO THE QUIET GARDEN (3m Proximity Bloom + Audio Crossfade)
  // ==========================================================================
  const lanternCoords = [
    { x: -7.8, z: -67.2 },
    { x: -9.2, z: -65.4 },
    { x: -10.6, z: -63.5 },
    { x: -11.9, z: -61.6 },
    { x: -13.1, z: -59.8 },
    { x: -14.2, z: -58.0 },
    { x: -15.1, z: -56.4 },
    { x: -15.8, z: -55.1 },
  ];

  interface PathLanternNode {
    worldPos: THREE.Vector3;
    coreMat: THREE.MeshStandardMaterial;
    bloomAlpha: number;
    hasChimed: boolean;
  }
  const pathLanterns: PathLanternNode[] = [];
  const lBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.19, 0.38, 8));
  lBaseGeo.translate(0, 0.19, 0);
  const lCoreGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
  lCoreGeo.translate(0, 0.44, 0);
  const lCapGeo = tracker.trackGeo(new THREE.ConeGeometry(0.24, 0.16, 8));
  lCapGeo.translate(0, 0.58, 0);

  for (const lc of lanternCoords) {
    const ly = getTerrainHeight(lc.x, lc.z);
    const lGroup = new THREE.Group();
    lGroup.position.set(lc.x, ly, lc.z);

    const baseMesh = new THREE.Mesh(lBaseGeo, mats.creamStone);
    const coreMat = tracker.trackMat(mats.warmLanternGlow.clone());
    coreMat.emissiveIntensity = 0.18;
    const coreMesh = new THREE.Mesh(lCoreGeo, coreMat);
    const mossyCap = new THREE.Mesh(lCapGeo, mats.patinaTealRoof);
    lGroup.add(baseMesh, coreMesh, mossyCap);
    group.add(lGroup);

    pathLanterns.push({
      worldPos: new THREE.Vector3(lc.x, ly + 0.44, lc.z),
      coreMat,
      bloomAlpha: 0,
      hasChimed: false,
    });
  }

  // ==========================================================================
  // 6. "TWO STAMPED TICKETS" CLIMAX CABINET (x = 5.4, z = -66.8, rotY = -0.38)
  // ==========================================================================
  {
    const tx = 5.4;
    const tz = -66.8;
    const tRotY = -0.38;
    const tGroundY = getTerrainHeight(tx, tz);
    const climaxRoot = new THREE.Group();
    climaxRoot.position.set(tx, tGroundY, tz);
    climaxRoot.rotation.y = tRotY;
    group.add(climaxRoot);
    colliders.push({ x: tx, z: tz, radius: 1.15 });

    // Walnut & Brass Climax Pedestal Cabinet
    const cabPedGeo = tracker.trackGeo(createBeveledBoxGeometry(1.18, 1.06, 0.76, 0.025));
    cabPedGeo.translate(0, 0.53, 0);
    const cabPed = new THREE.Mesh(cabPedGeo, mats.darkWalnut);
    cabPed.castShadow = true;
    climaxRoot.add(cabPed);

    // Top Velvet Deck with Two Brass Ticket Slots (Slot 1: Heartshot, Slot 2: Ring Toss)
    const topDeckGeo = tracker.trackGeo(createBeveledBoxGeometry(1.08, 0.04, 0.66, 0.01));
    topDeckGeo.translate(0, 1.08, 0);
    const topDeck = new THREE.Mesh(topDeckGeo, mats.crimsonVelvet);
    climaxRoot.add(topDeck);

    const ticketSlotGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.03, 0.08));
    const stampedTicketGeo = tracker.trackGeo(new THREE.BoxGeometry(0.20, 0.14, 0.012));
    const ticketMeshes: THREE.Mesh[] = [];
    for (const sx of [-0.26, 0.26]) {
      const slot = new THREE.Mesh(ticketSlotGeo, mats.brushedGold);
      slot.position.set(sx, 1.11, -0.05);
      climaxRoot.add(slot);

      const ticket = new THREE.Mesh(stampedTicketGeo, mats.brushedGold);
      ticket.position.set(sx, 1.16, -0.05);
      ticket.visible = false;
      climaxRoot.add(ticket);
      ticketMeshes.push(ticket);
    }

    // Sliding Velvet-Lined Walnut Drawer & Yeshwanth's Parchment Letter
    const drawerPivot = new THREE.Group();
    drawerPivot.position.set(0, 0.86, 0.12);
    climaxRoot.add(drawerPivot);

    const drawerBoxGeo = tracker.trackGeo(createBeveledBoxGeometry(0.86, 0.14, 0.52, 0.015));
    const drawerBox = new THREE.Mesh(drawerBoxGeo, mats.darkWalnut);
    const drawerVelvetGeo = tracker.trackGeo(new THREE.BoxGeometry(0.78, 0.04, 0.44));
    drawerVelvetGeo.translate(0, 0.06, 0);
    const drawerVelvet = new THREE.Mesh(drawerVelvetGeo, mats.crimsonVelvet);
    drawerPivot.add(drawerBox, drawerVelvet);

    const letterTex = createYeshwanthParchmentLetterTexture(tracker);
    const letterMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        map: letterTex,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        emissive: new THREE.Color('#fff6e8'),
        emissiveMap: letterTex,
        emissiveIntensity: 0.22,
      }),
    );
    letterMat.userData.preserveFinish = true;
    const letterMesh = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.42, 0.52, 0.012)),
      letterMat,
    );
    letterMesh.position.set(0, 0.36, 0.14);
    letterMesh.rotation.x = -0.25;
    letterMesh.scale.setScalar(0.001);
    drawerPivot.add(letterMesh);

    let state: CarnivalAttractionState = 'IDLE';
    let stateTimer = 0;
    let climaxUnlocked = false;
    const orbitCam = createGiftOrbitCameraState(1.08);
    const worldPos = new THREE.Vector3(tx, tGroundY, tz);
    const forwardDir = new THREE.Vector3(Math.sin(tRotY), 0, Math.cos(tRotY));
    const interactPos = new THREE.Vector3(
      tx + forwardDir.x * 1.95,
      tGroundY,
      tz + forwardDir.z * 1.95,
    );
    const camWorldPos = new THREE.Vector3();
    const lookWorldPos = new THREE.Vector3();

    function unlockClimaxDrawer() {
      if (!climaxUnlocked) {
        climaxUnlocked = true;
        ticketMeshes[0].visible = true;
        ticketMeshes[1].visible = true;
        onUnlockFullFestoonGlow();
        audio.playWinFanfare();
        audio.playPrizeRevealArpeggio();
        fx.triggerHeartBurst(worldPos.clone().add(new THREE.Vector3(0, 1.25, 0)), 18);
        fx.triggerSparkleRing(worldPos.clone().add(new THREE.Vector3(0, 1.15, 0)), 0.34, 24);
      }
    }

    attractions.push({
      id: 'climax_ticket_cabinet' as CarnivalAttractionId,
      title: '"Two Stamped Tickets" Climax Cabinet',
      subtitle: 'Heartshot & Ring Toss Keepsake Vault',
      verb: 'E Place Stamped Tickets' as CarnivalPromptVerb,
      group: climaxRoot,
      worldPos,
      interactPos,
      interactRadius: 3.1,
      getState: () => state,
      getPrizeId: () => '',
      activate() {
        state = 'PLAYING';
        stateTimer = 0;
        orbitCam.reset();
        unlockClimaxDrawer();
      },
      performAction() {
        return false;
      },
      advanceStep() {
        if (state === 'PLAYING') {
          state = 'RECOVERY';
          stateTimer = 0;
          return true;
        }
        return false;
      },
      skip() {
        state = 'IDLE';
        stateTimer = 0;
        return { earnedPrizeId: null };
      },
      applyMouseDelta(dx: number, dy: number) {
        if (state === 'PLAYING') {
          orbitCam.applyMouse(dx, dy);
        }
      },
      applyZoomDelta(delta: number) {
        if (state === 'PLAYING') {
          orbitCam.applyZoom(delta);
        }
      },
      getOverlay(): CarnivalActiveOverlay | null {
        if (state === 'IDLE' || state === 'RECOVERY') return null;
        return {
          attractionId: 'climax_ticket_cabinet' as CarnivalAttractionId,
          title: '"Two Stamped Tickets" Climax Cabinet',
          subtitle: 'Both Stamped Tickets Placed · Overhead Festoons Illuminated',
          state,
          prizeName: "Yeshwanth's Keepsake Letter",
          prizeCategory: 'Velvet Drawer Unlocked',
          captionLine:
            '"Every game, every lantern light, and every quiet corner of this midway was built to see you smile. Forever yours, Yeshwanth ♡"',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom · Press Enter or Esc to Close',
          requiresEnterToContinue: true,
        };
      },
      getCameraFocus(): CarnivalCameraFocus | null {
        if (state === 'IDLE') return null;
        const focusWorld = new THREE.Vector3(0, 1.18, 0.35)
          .applyAxisAngle(THREE.Object3D.DEFAULT_UP, tRotY)
          .add(worldPos);
        orbitCam.computeFocus(focusWorld, tRotY, camWorldPos, lookWorldPos);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.5 : 1.0,
          playerPos: interactPos,
          playerYaw: tRotY + Math.PI,
          hidePlayerAvatar: true,
        };
      },
      update(dt: number, elapsedTime: number, _cam?: THREE.PerspectiveCamera, keys?: Set<string>) {
        stateTimer += dt;
        const hasTicket1 = earnedPrizes.has('paired_heart_charm');
        const hasTicket2 = earnedPrizes.has('twin_ring_charms');
        if (hasTicket1) ticketMeshes[0].visible = true;
        if (hasTicket2) ticketMeshes[1].visible = true;
        if (hasTicket1 && hasTicket2 && !climaxUnlocked) {
          unlockClimaxDrawer();
        }

        const targetDrawerZ = climaxUnlocked || state === 'PLAYING' ? 0.40 : 0.12;
        drawerPivot.position.z = THREE.MathUtils.lerp(drawerPivot.position.z, targetDrawerZ, 8 * dt);

        const targetLetterScale = state === 'PLAYING' ? 1.0 : climaxUnlocked ? 0.55 : 0.001;
        const nextScale = THREE.MathUtils.lerp(letterMesh.scale.x, targetLetterScale, 8 * dt);
        letterMesh.scale.setScalar(nextScale);
        letterMesh.position.y = 0.36 + Math.sin(elapsedTime * 2.2) * 0.015;

        if (state === 'PLAYING') {
          orbitCam.updateKeys(dt, keys);
          const focusWorld = new THREE.Vector3(0, 1.24, 0.35)
            .applyAxisAngle(THREE.Object3D.DEFAULT_UP, tRotY)
            .add(worldPos);
          fx.setTheatricalLighting(1.0, focusWorld);
        } else if (state === 'RECOVERY') {
          if (stateTimer >= 0.5) {
            state = 'IDLE';
            stateTimer = 0;
          }
        }
        return { newlyEarnedPrizeId: null };
      },
    });
  }

  return {
    group,
    attractions,
    update(
      dt: number,
      elapsedTime: number,
      playerPos: THREE.Vector3 | undefined,
      earnedPrizeIds: Set<string>,
    ) {
      // 1. Update Midway Memory Waltz (Reactive Footstep Fireflies)
      if (playerPos) {
        if (!hasLastPlayerPos) {
          lastPlayerPos.copy(playerPos);
          hasLastPlayerPos = true;
        } else {
          const moveDist = Math.hypot(
            playerPos.x - lastPlayerPos.x,
            playerPos.z - lastPlayerPos.z,
          );
          lastPlayerPos.copy(playerPos);

          const onMidwayBoardwalk =
            Math.abs(playerPos.x) < 16.5 &&
            playerPos.z >= -86.0 &&
            playerPos.z <= -42.0;

          if (onMidwayBoardwalk && moveDist > 0.005) {
            stepDistanceAccum += moveDist;
            const spawnThreshold = earnedPrizeIds.size > 0 ? 0.42 : 0.85;
            if (stepDistanceAccum >= spawnThreshold) {
              stepDistanceAccum = 0;
              const burstCount = Math.min(3, 1 + Math.floor(earnedPrizeIds.size / 2));
              for (let b = 0; b < burstCount; b++) {
                if (activeFootsteps.length >= footstepPoolSize) {
                  activeFootsteps.shift();
                }
                const ang = Math.random() * Math.PI * 2;
                const rad = 0.12 + Math.random() * 0.32;
                activeFootsteps.push({
                  x: playerPos.x + Math.cos(ang) * rad,
                  y: playerPos.y + 0.08,
                  z: playerPos.z + Math.sin(ang) * rad,
                  vy: 0.32 + Math.random() * 0.28,
                  phase: Math.random() * Math.PI * 2,
                  life: 0,
                  maxLife: 1.35 + Math.random() * 0.45,
                });
              }
            }
          }
        }
      }

      for (let i = activeFootsteps.length - 1; i >= 0; i--) {
        const m = activeFootsteps[i];
        m.life += dt;
        if (m.life >= m.maxLife) {
          activeFootsteps.splice(i, 1);
          continue;
        }
        m.y += m.vy * dt;
        const u = m.life / m.maxLife;
        const s = Math.sin(u * Math.PI) * 1.15;
        _dummy.position.set(
          m.x + Math.sin(elapsedTime * 3.2 + m.phase) * 0.08,
          m.y,
          m.z + Math.cos(elapsedTime * 3.2 + m.phase) * 0.08,
        );
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        footstepMesh.setMatrixAt(i, _dummy.matrix);
      }
      for (let i = activeFootsteps.length; i < footstepPoolSize; i++) {
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        footstepMesh.setMatrixAt(i, _dummy.matrix);
      }
      footstepMesh.instanceMatrix.needsUpdate = true;

      // 5. Update Lantern Bloom Path to the Quiet Garden (3m proximity bloom)
      if (playerPos) {
        for (let i = 0; i < pathLanterns.length; i++) {
          const ln = pathLanterns[i];
          const dist = Math.hypot(
            playerPos.x - ln.worldPos.x,
            playerPos.z - ln.worldPos.z,
          );
          const isNear = dist <= 3.0;
          if (isNear && !ln.hasChimed) {
            ln.hasChimed = true;
            audio.playFlowerBloomBell();
            fx.triggerSparkleRing(ln.worldPos, 0.2, 12);
          }
          const targetBloom = isNear || ln.hasChimed ? 1.0 : 0.0;
          ln.bloomAlpha = THREE.MathUtils.lerp(ln.bloomAlpha, targetBloom, 4 * dt);
          ln.coreMat.emissiveIntensity =
            0.18 + ln.bloomAlpha * (1.15 + Math.sin(elapsedTime * 2.6 + i) * 0.15);
        }
      }
    },
    dispose() {
      // Tracked via ResourceTracker
    },
  };
}
