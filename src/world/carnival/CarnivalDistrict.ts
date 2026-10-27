/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  ResourceTracker,
  createBeveledBoxGeometry,
  createExtrudedArchwayGeometry,
  createHeartShape2D,
  createThemeParkMaterials,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { getTerrainHeight } from '../terrainMath';
import { CarnivalAudioSynthesizer } from './CarnivalAudio';
import { CarnivalBoothAttraction, createCarnivalBooths } from './CarnivalBooths';
import {
  createCarnivalKeepsakeDisplay,
  createRomanticMidwayAdditions,
} from './CarnivalKeepsakeDisplay';
import { createCarnivalLandmarks } from './CarnivalLandmarks';
import {
  CARNIVAL_CENTER,
  CarnivalActiveOverlay,
  CarnivalCameraFocus,
  CarnivalDistrictBundle,
  CarnivalProximityPrompt,
} from './CarnivalState';
import { PrizeCinematicFXSystem } from './PrizeCinematicFX';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Creates a gilded "ROMANTIC MIDWAY" header plaque texture for the front entrance arch.
 */
function createMidwayNameboardTexture(
  tracker: ResourceTracker,
  mats: ReturnType<typeof createThemeParkMaterials>,
): THREE.Material {
  if (typeof document === 'undefined') {
    return mats.brushedGold;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return mats.brushedGold;

  ctx.fillStyle = '#4c0519';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#eab965';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 100);

  ctx.fillStyle = '#fef08a';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CARNIVAL PROMENADE', 256, 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Fraunces", Georgia, serif';
  ctx.fillText('ROMANTIC MIDWAY', 256, 82);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tracker.trackMat(new THREE.MeshBasicMaterial({ map: tex }));
}

/**
 * Builds the handcrafted Romantic Midway / Carnival District at (0, -65).
 * Includes wooden boardwalks, ornamental archways, catenary festoon lights,
 * bunting flags, background sweet stalls, flower planters, benches,
 * 5 playable carnival games, Carousel, Ferris Wheel, and Quiet Garden.
 */
export function createCarnivalDistrict(): CarnivalDistrictBundle {
  const tracker = new ResourceTracker();
  const mats = createThemeParkMaterials(tracker);
  const audio = new CarnivalAudioSynthesizer();
  const group = new THREE.Group();
  group.name = 'CarnivalDistrict_RomanticMidway';

  const colliders: CircleCollider[] = [];
  const earnedPrizes = new Set<string>();

  // ==========================================================================
  // 1. WOODEN BOARDWALK PROMENADE & CENTRAL PLAZA HUB (InstancedMesh Planks)
  // ==========================================================================
  const centerGroundY = getTerrainHeight(CARNIVAL_CENTER.x, CARNIVAL_CENTER.z);

  // Central Midway Roundabout Medallion at (0, -60.0)
  const hubX = 0;
  const hubZ = -60.0;
  const hubY = getTerrainHeight(hubX, hubZ);

  const hubDeckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(5.6, 5.8, 0.1, 32),
  );
  hubDeckGeo.translate(0, 0.05, 0);
  const hubDeck = new THREE.Mesh(hubDeckGeo, mats.creamStone);
  hubDeck.position.set(hubX, hubY, hubZ);
  hubDeck.receiveShadow = true;
  group.add(hubDeck);

  const hubInnerGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.2, 4.2, 0.11, 32),
  );
  hubInnerGeo.translate(0, 0.055, 0);
  const hubInner = new THREE.Mesh(hubInnerGeo, mats.warmTimber);
  hubInner.position.set(hubX, hubY, hubZ);
  hubInner.receiveShadow = true;
  group.add(hubInner);

  const heartShape = createHeartShape2D(0.58);
  const hubHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    }),
  );
  hubHeartGeo.rotateX(-Math.PI / 2);
  hubHeartGeo.scale(1, 1, -1);
  const hubHeartInlay = new THREE.Mesh(hubHeartGeo, mats.softRoseGold);
  hubHeartInlay.position.set(hubX, hubY + 0.1, hubZ);
  group.add(hubHeartInlay);

  // Instanced Wooden Boardwalk Planks along the North-South Spine & Radial Spurs
  const plankGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.8, 0.07, 0.44, 0.015),
  );
  const plankTransforms: Array<{
    x: number;
    y: number;
    z: number;
    rotY: number;
    scaleX: number;
    tint: number;
  }> = [];

  // Spine from Z = -43.5 to Z = -85.5
  for (let z = -43.5; z >= -85.5; z -= 0.54) {
    // Skip central medallion core
    if (Math.abs(z - hubZ) < 3.8) continue;
    const py = getTerrainHeight(0, z);
    plankTransforms.push({
      x: 0,
      y: py,
      z,
      rotY: 0,
      scaleX: 1.08,
      tint: (Math.abs(Math.round(z * 2)) % 3) * 0.03,
    });
  }

  // Spur paths to booths, Quiet Garden, Carousel, and Ferris Wheel
  const spurs = [
    { x0: -2.0, z0: -51.5, x1: -7.5, z1: -51.5 }, // Heartshot
    { x0: 2.0, z0: -51.5, x1: 7.5, z1: -51.5 }, // Ring Toss
    { x0: -2.0, z0: -61.5, x1: -10.2, z1: -61.5 }, // Knockdown
    { x0: 2.0, z0: -61.5, x1: 10.2, z1: -61.5 }, // Frog Launch
    { x0: -2.2, z0: -54.5, x1: -12.5, z1: -54.5 }, // Quiet Garden path
    { x0: 2.0, z0: -70.5, x1: 7.4, z1: -71.2 }, // Carousel spur
    { x0: -2.0, z0: -72.0, x1: -9.2, z1: -72.6 }, // Ferris Wheel spur
  ];

  for (const s of spurs) {
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(3, Math.floor(len / 0.56));
    const yaw = Math.atan2(dx, dz);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const px = THREE.MathUtils.lerp(s.x0, s.x1, u);
      const pz = THREE.MathUtils.lerp(s.z0, s.z1, u);
      const py = getTerrainHeight(px, pz);
      plankTransforms.push({
        x: px,
        y: py,
        z: pz,
        rotY: yaw,
        scaleX: 0.72,
        tint: (i % 3) * 0.03,
      });
    }
  }

  const boardwalkMesh = new THREE.InstancedMesh(
    plankGeo,
    mats.warmTimber,
    plankTransforms.length,
  );
  boardwalkMesh.receiveShadow = true;
  for (let i = 0; i < plankTransforms.length; i++) {
    const p = plankTransforms[i];
    _dummy.position.set(p.x, p.y, p.z);
    _dummy.rotation.set(0, p.rotY, 0);
    _dummy.scale.set(p.scaleX, 1, 1);
    _dummy.updateMatrix();
    boardwalkMesh.setMatrixAt(i, _dummy.matrix);
    _color.setHex(0x8c583a).offsetHSL(0, 0, p.tint - 0.02);
    boardwalkMesh.setColorAt(i, _color);
  }
  boardwalkMesh.instanceMatrix.needsUpdate = true;
  if (boardwalkMesh.instanceColor) boardwalkMesh.instanceColor.needsUpdate = true;
  boardwalkMesh.computeBoundingSphere();
  group.add(boardwalkMesh);

  // ==========================================================================
  // 2. DECORATIVE NORTH & SOUTH CARNIVAL ARCHWAYS
  // ==========================================================================
  const archGeo = tracker.trackGeo(
    createExtrudedArchwayGeometry(6.4, 5.2, 4.4, 4.1, 0.65),
  );
  const archLocations = [
    { x: 0, z: -43.5, label: 'NORTH ARCH' },
    { x: 0, z: -84.5, label: 'SOUTH ARCH' },
  ];

  const midwayPlaqueMat = createMidwayNameboardTexture(tracker, mats);

  for (const loc of archLocations) {
    const ay = getTerrainHeight(loc.x, loc.z);
    const archGroup = new THREE.Group();
    archGroup.position.set(loc.x, ay, loc.z);
    archGroup.rotation.y = 0;

    const archMesh = new THREE.Mesh(archGeo, mats.creamStone);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    archGroup.add(archMesh);

    const crownTrimGeo = tracker.trackGeo(
      createBeveledBoxGeometry(6.7, 0.24, 0.82, 0.03),
    );
    const crownTrim = new THREE.Mesh(crownTrimGeo, mats.brushedGold);
    crownTrim.position.y = 5.15;
    archGroup.add(crownTrim);

    if (loc.label === 'NORTH ARCH') {
      const plaqueGeo = tracker.trackGeo(
        createBeveledBoxGeometry(4.2, 0.72, 0.18, 0.02),
      );
      const plaqueMesh = new THREE.Mesh(plaqueGeo, midwayPlaqueMat);
      plaqueMesh.position.set(0, 4.85, 0.35);
      const plaqueMeshBack = new THREE.Mesh(plaqueGeo, midwayPlaqueMat);
      plaqueMeshBack.position.set(0, 4.85, -0.35);
      plaqueMeshBack.rotation.y = Math.PI;
      archGroup.add(plaqueMesh, plaqueMeshBack);
    }

    const archHeart = new THREE.Mesh(hubHeartGeo, mats.crystalHeart);
    archHeart.rotation.x = Math.PI / 2;
    archHeart.position.set(0, 5.65, 0);
    archGroup.add(archHeart);

    group.add(archGroup);
    colliders.push({ x: loc.x - 2.7, z: loc.z, radius: 0.65 });
    colliders.push({ x: loc.x + 2.7, z: loc.z, radius: 0.65 });
  }

  // ==========================================================================
  // 3. BACKGROUND SWEET / SNACK STALLS, PLANTERS & BENCHES
  // ==========================================================================
  // Two charming non-interactive confection & spiced cider carts near the north entry
  const snackPositions = [
    { x: -6.4, z: -46.2, rotY: 0.42 },
    { x: 6.4, z: -46.2, rotY: -0.42 },
  ];
  const cartBodyGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.1, 0.95, 1.15, 0.03),
  );
  const cartRoofGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.3, 0.16, 1.35, 0.03),
  );
  const wheelGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16),
  );
  wheelGeo.rotateZ(Math.PI / 2);

  for (let i = 0; i < snackPositions.length; i++) {
    const sp = snackPositions[i];
    const sy = getTerrainHeight(sp.x, sp.z);
    const cart = new THREE.Group();
    cart.position.set(sp.x, sy, sp.z);
    cart.rotation.y = sp.rotY;

    const body = new THREE.Mesh(
      cartBodyGeo,
      i === 0 ? mats.blushPastel : mats.creamStone,
    );
    body.position.y = 0.22;
    body.castShadow = true;
    cart.add(body);

    const roof = new THREE.Mesh(cartRoofGeo, mats.crimsonVelvet);
    roof.position.y = 2.18;
    roof.castShadow = true;
    cart.add(roof);

    for (const wx of [-0.75, 0.75]) {
      const post = new THREE.Mesh(
        tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8)),
        mats.brushedGold,
      );
      post.position.set(wx, 1.65, 0);
      cart.add(post);
    }

    const wL = new THREE.Mesh(wheelGeo, mats.brushedGold);
    wL.position.set(-1.08, 0.32, 0);
    const wR = new THREE.Mesh(wheelGeo, mats.brushedGold);
    wR.position.set(1.08, 0.32, 0);
    cart.add(wL, wR);

    // Warm glass jars / lanterns on counter
    const jarGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.11, 0.11, 0.26, 10),
    );
    for (let j = -1; j <= 1; j++) {
      const jar = new THREE.Mesh(
        jarGeo,
        j === 0 ? mats.warmLanternGlow : mats.softRoseGlow,
      );
      jar.position.set(j * 0.45, 1.3, 0.15);
      cart.add(jar);
    }

    group.add(cart);
    colliders.push({ x: sp.x, z: sp.z, radius: 1.25 });
  }

  // Midway Benches & Flower Planters around the Central Medallion
  const planterBoxGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.45, 0.48, 0.65, 0.03),
  );
  const shrubGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.28, 0.38, 0.48, 0.06),
  );
  const planterPlacements = [
    { x: -4.8, z: -57.2, rotY: 0.55 },
    { x: 4.8, z: -57.2, rotY: -0.55 },
    { x: -4.8, z: -63.5, rotY: -0.55 },
    { x: 4.8, z: -63.5, rotY: 0.55 },
  ];
  for (const pp of planterPlacements) {
    const py = getTerrainHeight(pp.x, pp.z);
    const pGroup = new THREE.Group();
    pGroup.position.set(pp.x, py, pp.z);
    pGroup.rotation.y = pp.rotY;

    const box = new THREE.Mesh(planterBoxGeo, mats.creamStone);
    const shrub = new THREE.Mesh(shrubGeo, mats.patinaTealRoof);
    shrub.position.y = 0.45;
    pGroup.add(box, shrub);
    group.add(pGroup);
    colliders.push({ x: pp.x, z: pp.z, radius: 0.75 });
  }

  // ==========================================================================
  // 4. OVERHEAD FESTOON STRING LIGHTS & BUNTING FLAGS (InstancedMesh)
  // ==========================================================================
  const polePositions: Array<[number, number]> = [
    [-3.6, -45.5],
    [3.6, -45.5],
    [-5.8, -54.0],
    [5.8, -54.0],
    [-5.8, -60.0],
    [5.8, -60.0],
    [-5.8, -66.5],
    [5.8, -66.5],
    [-4.8, -76.5],
    [4.8, -76.5],
  ];

  const lampPostGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.055, 0.075, 4.2, 10),
  );
  lampPostGeo.translate(0, 2.1, 0);
  for (const [px, pz] of polePositions) {
    const py = getTerrainHeight(px, pz);
    const post = new THREE.Mesh(lampPostGeo, mats.wroughtBronze);
    post.position.set(px, py, pz);
    post.castShadow = true;
    group.add(post);
  }

  // Span festoon bulbs & bunting triangles across pairs of poles
  const spanPairs: Array<[[number, number], [number, number]]> = [
    [polePositions[0], polePositions[1]],
    [polePositions[0], polePositions[2]],
    [polePositions[1], polePositions[3]],
    [polePositions[2], polePositions[4]],
    [polePositions[3], polePositions[5]],
    [polePositions[4], polePositions[5]],
    [polePositions[4], polePositions[6]],
    [polePositions[5], polePositions[7]],
    [polePositions[6], polePositions[7]],
    [polePositions[6], polePositions[8]],
    [polePositions[7], polePositions[9]],
  ];

  const bulbsPerSpan = 10;
  const totalFestoonBulbs = spanPairs.length * bulbsPerSpan;
  const festoonBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 8, 8));
  const festoonInstanced = new THREE.InstancedMesh(
    festoonBulbGeo,
    mats.warmLanternGlow,
    totalFestoonBulbs,
  );

  const buntingGeo = tracker.trackGeo(new THREE.ConeGeometry(0.09, 0.22, 4));
  buntingGeo.rotateX(Math.PI);
  const buntingInstanced = new THREE.InstancedMesh(
    buntingGeo,
    mats.ivoryCanvas,
    totalFestoonBulbs,
  );
  const buntingPalette = [0xc23b57, 0xf5c6d1, 0xe5b564, 0xfaf3e6, 0x2e7775];

  let instanceIdx = 0;
  for (const [pA, pB] of spanPairs) {
    const yA = getTerrainHeight(pA[0], pA[1]) + 4.1;
    const yB = getTerrainHeight(pB[0], pB[1]) + 4.1;
    const yaw = Math.atan2(pB[0] - pA[0], pB[1] - pA[1]);

    for (let k = 0; k < bulbsPerSpan; k++) {
      const u = (k + 0.5) / bulbsPerSpan;
      const bx = THREE.MathUtils.lerp(pA[0], pB[0], u);
      const bz = THREE.MathUtils.lerp(pA[1], pB[1], u);
      const sag = Math.sin(u * Math.PI) * 0.52;
      const by = THREE.MathUtils.lerp(yA, yB, u) - sag;

      _dummy.position.set(bx, by, bz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      festoonInstanced.setMatrixAt(instanceIdx, _dummy.matrix);

      _dummy.position.set(bx, by - 0.12, bz);
      _dummy.rotation.set(0, yaw, 0);
      _dummy.updateMatrix();
      buntingInstanced.setMatrixAt(instanceIdx, _dummy.matrix);
      _color.setHex(buntingPalette[instanceIdx % buntingPalette.length]);
      buntingInstanced.setColorAt(instanceIdx, _color);

      instanceIdx++;
    }
  }
  festoonInstanced.instanceMatrix.needsUpdate = true;
  festoonInstanced.computeBoundingSphere();
  buntingInstanced.instanceMatrix.needsUpdate = true;
  if (buntingInstanced.instanceColor) buntingInstanced.instanceColor.needsUpdate = true;
  buntingInstanced.computeBoundingSphere();
  group.add(festoonInstanced, buntingInstanced);

  // ==========================================================================
  // 5. WARM EVENING POINT LIGHTS (Strictly 2 PointLights for Budget Compliance)
  // ==========================================================================
  const midwayHubLight = new THREE.PointLight(0xffcb88, 2.2, 34, 1.4);
  midwayHubLight.position.set(0, centerGroundY + 5.2, -62.0);
  group.add(midwayHubLight);

  const activeSpotLight = new THREE.PointLight(0xffdfa8, 1.8, 22, 1.5);
  activeSpotLight.position.set(11.5, centerGroundY + 4.5, -71.5);
  group.add(activeSpotLight);

  const fx = new PrizeCinematicFXSystem(tracker);
  group.add(fx.group);

  // ==========================================================================
  // 6. MOUNT ALL CARNIVAL ATTRACTIONS (5 Games + Single Enclosed Photo Booth at 14.6,-66.8 + Landmarks + 6 Romantic Additions)
  // ==========================================================================
  let fullFestoonIlluminated = false;
  const keepsakeDisplay = createCarnivalKeepsakeDisplay(
    -8.8,
    -56.2,
    0.42,
    tracker,
    mats,
    colliders,
  );
  group.add(keepsakeDisplay.group);

  const romanticAdditions = createRomanticMidwayAdditions(
    tracker,
    mats,
    audio,
    colliders,
    fx,
    earnedPrizes,
    () => {
      fullFestoonIlluminated = true;
      mats.warmLanternGlow.emissiveIntensity = 1.25;
      midwayHubLight.intensity = 3.1;
    },
  );
  group.add(romanticAdditions.group);

  const booths = createCarnivalBooths(tracker, mats, audio, colliders, fx);
  const landmarks = createCarnivalLandmarks(tracker, mats, audio, colliders, fx);
  const allAttractions: CarnivalBoothAttraction[] = [
    ...booths,
    ...landmarks,
    ...romanticAdditions.attractions,
  ];

  for (const attr of allAttractions) {
    group.add(attr.group);
  }

  let activeAttraction: CarnivalBoothAttraction | null = null;

  function findNearestIdleAttraction(
    playerPos: THREE.Vector3,
  ): CarnivalBoothAttraction | null {
    let best: CarnivalBoothAttraction | null = null;
    let bestDist = Infinity;
    for (const attr of allAttractions) {
      const dx = playerPos.x - attr.interactPos.x;
      const dz = playerPos.z - attr.interactPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= attr.interactRadius && dist < bestDist) {
        bestDist = dist;
        best = attr;
      }
    }
    return best;
  }

  return {
    group,
    colliders,

    getProximityPrompt(playerPos: THREE.Vector3): CarnivalProximityPrompt | null {
      if (activeAttraction && activeAttraction.getState() !== 'IDLE') {
        return null;
      }
      const nearest = findNearestIdleAttraction(playerPos);
      if (!nearest) return null;
      return {
        attractionId: nearest.id,
        title: nearest.title,
        verb: nearest.verb,
      };
    },

    getActiveOverlay(): CarnivalActiveOverlay | null {
      if (!activeAttraction) return null;
      return activeAttraction.getOverlay();
    },

    getEarnedPrizeIds(): string[] {
      return Array.from(earnedPrizes);
    },

    isActive(): boolean {
      return activeAttraction !== null && activeAttraction.getState() !== 'IDLE';
    },

    isMovementLocked(): boolean {
      return activeAttraction !== null && activeAttraction.getState() !== 'IDLE';
    },

    triggerNearestAttraction(
      playerPos: THREE.Vector3,
      playerYaw: number,
      camPos: THREE.Vector3,
      lookPos: THREE.Vector3,
    ): boolean {
      if (activeAttraction && activeAttraction.getState() !== 'IDLE') {
        return false;
      }
      const nearest = findNearestIdleAttraction(playerPos);
      if (!nearest) return false;

      activeAttraction = nearest;
      nearest.activate(playerPos, playerYaw, camPos, lookPos);
      return true;
    },

    performGameAction(camera?: THREE.PerspectiveCamera): boolean {
      if (!activeAttraction) return false;
      return activeAttraction.performAction(camera);
    },

    advanceCinematicOrPrize(camera?: THREE.PerspectiveCamera): boolean {
      if (!activeAttraction) return false;
      const st = activeAttraction.getState();
      if (st === 'PLAYING') {
        // For Carousel / Quiet Garden / Bench / Wish Jar / Cabinets, pressing Enter finishes;
        // for booths, pressing Enter during PLAYING fires/throws!
        if (activeAttraction.advanceStep()) {
          return true;
        }
        return activeAttraction.performAction(camera);
      }
      return activeAttraction.advanceStep();
    },

    skipActiveAttraction(): void {
      if (!activeAttraction) return;
      const { earnedPrizeId } = activeAttraction.skip();
      if (earnedPrizeId) {
        earnedPrizes.add(earnedPrizeId);
      }
      activeAttraction = null;
    },

    applyMouseLookDelta(dx: number, dy: number): void {
      if (!activeAttraction) return;
      activeAttraction.applyMouseDelta(dx, dy);
    },

    applyZoomDelta(delta: number): void {
      if (!activeAttraction) return;
      if ('applyZoomDelta' in activeAttraction && typeof (activeAttraction as any).applyZoomDelta === 'function') {
        (activeAttraction as any).applyZoomDelta(delta);
      }
    },

    selectOption(index: number): void {
      if (!activeAttraction) return;
      activeAttraction.selectOption?.(index);
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (!activeAttraction) return null;
      return activeAttraction.getCameraFocus();
    },

    update(
      dt: number,
      elapsedTime: number,
      playerPos?: THREE.Vector3,
      camera?: THREE.PerspectiveCamera,
      keys?: Set<string>,
    ): void {
      // Distance simulation gating when not actively riding/playing
      if (!activeAttraction && playerPos) {
        const distToCarnival = Math.hypot(
          playerPos.x - 2.0,
          playerPos.z - (-62.0),
        );
        if (distToCarnival > 90.0) {
          return;
        }
      }

      fx.update(dt);

      for (const attr of allAttractions) {
        const { newlyEarnedPrizeId } = attr.update(dt, elapsedTime, camera, keys);
        if (newlyEarnedPrizeId) {
          earnedPrizes.add(newlyEarnedPrizeId);
        }
      }

      keepsakeDisplay.update(dt, elapsedTime, earnedPrizes);
      romanticAdditions.update(dt, elapsedTime, playerPos, earnedPrizes);

      if (activeAttraction && activeAttraction.getState() === 'IDLE') {
        activeAttraction = null;
      }

      if (fullFestoonIlluminated && midwayHubLight.visible) {
        midwayHubLight.intensity = 3.0 + Math.sin(elapsedTime * 2.2) * 0.2;
      }

      // Smoothly move the dynamic accent light toward the active attraction (or Carousel when idle)
      if (activeAttraction) {
        activeSpotLight.position.x = THREE.MathUtils.lerp(
          activeSpotLight.position.x,
          activeAttraction.worldPos.x,
          1 - Math.exp(-6 * dt),
        );
        activeSpotLight.position.y = THREE.MathUtils.lerp(
          activeSpotLight.position.y,
          activeAttraction.worldPos.y + 3.4,
          1 - Math.exp(-6 * dt),
        );
        activeSpotLight.position.z = THREE.MathUtils.lerp(
          activeSpotLight.position.z,
          activeAttraction.worldPos.z + 1.2,
          1 - Math.exp(-6 * dt),
        );
        if (activeSpotLight.visible) {
          activeSpotLight.intensity = 2.4;
        }
      } else {
        activeSpotLight.position.x = THREE.MathUtils.lerp(
          activeSpotLight.position.x,
          11.5,
          1 - Math.exp(-3 * dt),
        );
        activeSpotLight.position.y = THREE.MathUtils.lerp(
          activeSpotLight.position.y,
          centerGroundY + 4.5,
          1 - Math.exp(-3 * dt),
        );
        activeSpotLight.position.z = THREE.MathUtils.lerp(
          activeSpotLight.position.z,
          -71.5,
          1 - Math.exp(-3 * dt),
        );
        if (activeSpotLight.visible) {
          activeSpotLight.intensity = 1.8 + Math.sin(elapsedTime * 1.8) * 0.15;
        }
      }
    },

    dispose(): void {
      keepsakeDisplay.dispose();
      romanticAdditions.dispose();
      audio.dispose();
      tracker.dispose();
    },
  };
}
