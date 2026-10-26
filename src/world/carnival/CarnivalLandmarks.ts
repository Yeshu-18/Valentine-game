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
  createOrnamentalBasinRimGeometry,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { getTerrainHeight } from '../terrainMath';
import { CarnivalAudioSynthesizer } from './CarnivalAudio';
import {
  CarnivalBoothAttraction,
  computeDynamicPrizeCameraFocus,
  createGiftOrbitCameraState,
  softenGiftMaterials,
} from './CarnivalBooths';
import {
  CARNIVAL_PRIZES,
  createPrizeDisplayBox,
} from './CarnivalPrizeSystem';
import { PrizeCinematicFXSystem } from './PrizeCinematicFX';
import {
  CarnivalActiveOverlay,
  CarnivalAttractionState,
  CarnivalCameraFocus,
} from './CarnivalState';

const _dummyObj = new THREE.Object3D();

/**
 * Builds a multi-part sculpted fantasy carousel steed (body, arched neck, head,
 * saddle, tail, and legs) so each of the 8 carousel mounts reads as a charming
 * handcrafted wooden horse rather than a primitive box.
 */
function createCarouselHorseGroup(
  saddleMat: THREE.Material,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
): THREE.Group {
  const horse = new THREE.Group();

  const bodyGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.18, 0.42, 8, 12));
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mats.ivoryCanvas);
  body.castShadow = true;
  horse.add(body);

  // Saddle blanket
  const saddleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.195, 0.195, 0.24, 12),
  );
  saddleGeo.rotateX(Math.PI / 2);
  const saddle = new THREE.Mesh(saddleGeo, saddleMat);
  saddle.position.set(0, 0.04, 0);
  horse.add(saddle);

  // Neck & head
  const neckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.085, 0.13, 0.36, 10),
  );
  const neck = new THREE.Mesh(neckGeo, mats.ivoryCanvas);
  neck.position.set(0, 0.22, 0.24);
  neck.rotation.x = 0.42;
  horse.add(neck);

  const headGeo = tracker.trackGeo(new THREE.ConeGeometry(0.095, 0.26, 10));
  headGeo.rotateX(Math.PI / 2);
  const head = new THREE.Mesh(headGeo, mats.ivoryCanvas);
  head.position.set(0, 0.36, 0.38);
  horse.add(head);

  const maneGeo = tracker.trackGeo(new THREE.BoxGeometry(0.04, 0.28, 0.08));
  const mane = new THREE.Mesh(maneGeo, mats.brushedGold);
  mane.position.set(0, 0.26, 0.18);
  mane.rotation.x = 0.42;
  horse.add(mane);

  // Flowing tail
  const tailGeo = tracker.trackGeo(new THREE.ConeGeometry(0.075, 0.32, 8));
  const tail = new THREE.Mesh(tailGeo, mats.brushedGold);
  tail.position.set(0, -0.04, -0.36);
  tail.rotation.x = -0.65;
  horse.add(tail);

  return horse;
}

/**
 * ============================================================================
 * 1. GRAND CAROUSEL / SOCIAL HUB (11.5, -71.5)
 * ============================================================================
 */
function createCarouselLandmark(
  x: number,
  z: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const root = new THREE.Group();
  const groundY = getTerrainHeight(x, z);
  root.position.set(x, groundY, z);
  colliders.push({ x, z, radius: 4.55 });

  const prizeId = 'mini_carousel_horse';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const prizeBox = createPrizeDisplayBox(prizeId, tracker, mats);
  prizeBox.group.position.set(-3.2, 0.42, 2.6);
  prizeBox.group.rotation.y = 0.42;
  softenGiftMaterials(prizeBox.group);
  root.add(prizeBox.group);
  const orbitCam = createGiftOrbitCameraState(1.15);

  // 1. Two-tier circular platform base
  const outerStepGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.45, 4.6, 0.22, 32),
  );
  outerStepGeo.translate(0, 0.11, 0);
  const outerStep = new THREE.Mesh(outerStepGeo, mats.creamStone);
  outerStep.receiveShadow = true;
  root.add(outerStep);

  const deckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.05, 4.15, 0.18, 32),
  );
  deckGeo.translate(0, 0.31, 0);
  const deck = new THREE.Mesh(deckGeo, mats.warmTimber);
  deck.receiveShadow = true;
  root.add(deck);

  // 2. Rotating turntable group
  const turntable = new THREE.Group();
  turntable.position.y = 0.4;
  root.add(turntable);

  // Ornate central column
  const colGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.68, 0.78, 3.65, 16),
  );
  colGeo.translate(0, 1.825, 0);
  const centerCol = new THREE.Mesh(colGeo, mats.creamStone);
  centerCol.castShadow = true;
  turntable.add(centerCol);

  const goldBandGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.76, 0.76, 0.14, 16),
  );
  for (const by of [0.65, 1.85, 3.05]) {
    const band = new THREE.Mesh(goldBandGeo, mats.brushedGold);
    band.position.y = by;
    turntable.add(band);
  }

  // 3. Scalloped Pavilion Canopy (cone + valance rim + warm bulbs)
  const canopyConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(4.35, 1.85, 24),
  );
  canopyConeGeo.translate(0, 4.55, 0);
  const canopyCone = new THREE.Mesh(canopyConeGeo, mats.crimsonVelvet);
  canopyCone.castShadow = true;
  turntable.add(canopyCone);

  const corniceGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.38, 4.38, 0.28, 24),
  );
  corniceGeo.translate(0, 3.65, 0);
  const cornice = new THREE.Mesh(corniceGeo, mats.brushedGold);
  turntable.add(cornice);

  // Top heart finial
  const heartShape = createHeartShape2D(0.38);
  const finialGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    }),
  );
  finialGeo.center();
  const finial = new THREE.Mesh(finialGeo, mats.crystalHeart);
  finial.position.y = 5.75;
  turntable.add(finial);

  // Warm rim bulbs around carousel cornice
  const bulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 8, 8));
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const bulb = new THREE.Mesh(bulbGeo, mats.warmLanternGlow);
    bulb.position.set(Math.cos(ang) * 4.28, 3.52, Math.sin(ang) * 4.28);
    turntable.add(bulb);
  }

  // 4. 8 Brass Poles & 8 Bobbing Fantasy Carousel Horses
  const poleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.032, 0.032, 3.6, 10),
  );
  poleGeo.translate(0, 1.8, 0);

  const saddleMats = [
    mats.crimsonVelvet,
    mats.softRoseGold,
    mats.patinaTealRoof,
    mats.brushedGold,
  ];
  const horseNodes: Array<{ group: THREE.Group; phase: number; radius: number; angle: number }> = [];

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 3.05;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;

    const pole = new THREE.Mesh(poleGeo, mats.brushedGold);
    pole.position.set(px, 0, pz);
    turntable.add(pole);

    const horse = createCarouselHorseGroup(
      saddleMats[i % saddleMats.length],
      tracker,
      mats,
    );
    horse.position.set(px, 1.25, pz);
    // Tangent direction along rotation
    horse.rotation.y = -angle + Math.PI;
    turntable.add(horse);

    horseNodes.push({
      group: horse,
      phase: (i * Math.PI) / 2,
      radius,
      angle,
    });
  }

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let targetLookYaw = 0;
  let targetLookPitch = 0;
  let currentLookYaw = 0;
  let currentLookPitch = 0;
  let prizeAwardedThisRun = false;

  const worldPos = new THREE.Vector3(x, groundY, z);
  const interactPos = new THREE.Vector3(x - 4.2, groundY, z + 3.6);
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();
  const riderWorldPos = new THREE.Vector3();

  return {
    id: 'carousel',
    title: 'Grand Romantic Carousel',
    subtitle: 'Music-Box Pavilion',
    verb: 'E Ride',
    group: root,
    worldPos,
    interactPos,
    interactRadius: 6.2,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      state = 'PLAYING';
      stateTimer = 0;
      targetLookYaw = 0;
      targetLookPitch = 0;
      currentLookYaw = 0;
      currentLookPitch = 0;
      prizeAwardedThisRun = false;
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.setOpenProgress(0, 0);
      audio.startCarouselMusicBox();
    },

    performAction() {
      return false;
    },

    advanceStep() {
      if (state === 'PLAYING') {
        audio.stopCarouselMusicBox();
        state = 'CINEMATIC';
        stateTimer = 0;
        return true;
      }
      if (state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        audio.stopCarouselMusicBox();
        state = 'RECOVERY';
        stateTimer = 0;
        return true;
      }
      return false;
    },

    skip() {
      audio.stopCarouselMusicBox();
      const earned =
        state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL'
          ? prizeId
          : null;
      fx.clear();
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.setOpenProgress(0, 0);
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'IDLE') return;
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, prizeBox);
        return;
      }
      // Standardized Ride Look Math:
      // dx > 0 (Right) -> turns view Right; dx < 0 (Left) -> turns view Left
      // dy < 0 (Up) -> pitches view Up (+); dy > 0 (Down) -> pitches view Down (-)
      targetLookYaw = THREE.MathUtils.clamp(
        targetLookYaw - dx * 0.0032,
        -1.48,
        1.48,
      );
      targetLookPitch = THREE.MathUtils.clamp(
        targetLookPitch - dy * 0.0026,
        -0.61,
        0.78,
      );
    },

    applyZoomDelta(deltaZoom: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(deltaZoom);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'carousel',
          title: 'Grand Romantic Carousel',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'CINEMATIC' || state === 'WIN') {
        return {
          attractionId: 'carousel',
          title: 'Grand Romantic Carousel',
          subtitle: 'Keepsake Revealed',
          state,
          captionLine: 'A miniature carved carousel horse that spins on a brass spiral pole.',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'carousel',
        title: 'Grand Romantic Carousel',
        subtitle: 'Music-Box Waltz in Motion',
        state,
        captionLine:
          'Warm lantern light and a gentle waltz drift across the boardwalk as the painted horses gallop in time.',
        instruction: 'Mouse or WASD / Arrows to Look Around · Press Enter for Keepsake · Esc to Step Off',
        requiresEnterToContinue: true,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const prizeWorldPos = new THREE.Vector3();
        prizeBox.group.getWorldPosition(prizeWorldPos);
        orbitCam.computeFocus(prizeWorldPos, 0.42, camWorldPos, lookWorldPos);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: 1.0,
          playerPos: interactPos,
          playerYaw: 0,
          hidePlayerAvatar: true,
        };
      }

      const rideElapsedTime = stateTimer;
      const mountAngle = turntable.rotation.y;
      const r = 3.05;
      const baseMountY = 1.28;
      const baseCamY = groundY + 2.20;
      const gallopOffset = Math.sin(rideElapsedTime * 2.8) * 0.18;
      const pitchTilt = Math.cos(rideElapsedTime * 2.8) * 0.045;

      const horseMount = horseNodes[0]?.group;
      if (horseMount) {
        horseMount.position.y = baseMountY + gallopOffset;
        horseMount.rotation.x = pitchTilt;
      }

      riderWorldPos.set(
        x + Math.cos(mountAngle) * r,
        groundY + 0.4 + baseMountY + gallopOffset,
        z - Math.sin(mountAngle) * r,
      );

      // Forward tangent along horse motion is mountAngle + Math.PI
      const tangentYaw = mountAngle + Math.PI + currentLookYaw;
      const pitch = currentLookPitch + pitchTilt;
      camWorldPos.set(
        riderWorldPos.x,
        baseCamY + gallopOffset,
        riderWorldPos.z,
      );
      lookWorldPos.set(
        camWorldPos.x + Math.sin(tangentYaw) * Math.cos(pitch) * 10.0,
        camWorldPos.y + Math.sin(pitch) * 10.0,
        camWorldPos.z + Math.cos(tangentYaw) * Math.cos(pitch) * 10.0,
      );

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.55 : 1.0,
        playerPos: state === 'RECOVERY' ? interactPos : riderWorldPos,
        playerYaw: tangentYaw,
        isSitting: true,
        hidePlayerAvatar: true,
      };
    },

    update(
      dt: number,
      elapsedTime: number,
      _camera?: THREE.PerspectiveCamera,
      keys?: Set<string>,
    ) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      // Keyboard look support during ride (A/D or Left/Right for yaw, W/S or Up/Down for pitch)
      if (state === 'PLAYING' || state === 'ACTIVATING') {
        if (keys) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw + 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyD') || keys.has('ArrowRight')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw - 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyW') || keys.has('ArrowUp')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch + 1.25 * dt, -0.61, 0.78);
          }
          if (keys.has('KeyS') || keys.has('ArrowDown')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch - 1.25 * dt, -0.61, 0.78);
          }
        }
        currentLookYaw = THREE.MathUtils.damp(currentLookYaw, targetLookYaw, 10, dt);
        currentLookPitch = THREE.MathUtils.damp(currentLookPitch, targetLookPitch, 10, dt);
      }

      // Smooth continuous carousel rotation + synchronized horse galloping
      const spinSpeed = state === 'PLAYING' ? 0.58 : 0.38;
      turntable.rotation.y = (turntable.rotation.y + dt * spinSpeed) % (Math.PI * 2);
      finial.rotation.y = elapsedTime * 0.9;

      const rideElapsedTime = state === 'PLAYING' ? stateTimer : elapsedTime;
      const baseMountY = 1.28;
      for (let i = 0; i < horseNodes.length; i++) {
        const h = horseNodes[i];
        const phase = i === 0 && state === 'PLAYING' ? 0 : h.phase;
        const gallopOffset = Math.sin(rideElapsedTime * 2.8 + phase) * 0.18;
        const pitchTilt = Math.cos(rideElapsedTime * 2.8 + phase) * 0.045;
        h.group.position.y = baseMountY + gallopOffset;
        h.group.rotation.x = pitchTilt;
      }

      if (state === 'CINEMATIC') {
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.rotation.y = 0.42;
        prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
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
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.rotation.y = 0.42;
        prizeBox.updateCinematicAnimation(stateTimer + 3.5, elapsedTime, fx, audio);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.55;
        prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting(1 - recoverU, worldPos);
        if (stateTimer >= 0.55) {
          orbitCam.reset();
          prizeBox.setTactileTilt(0, 0);
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
 * 2. FERRIS WHEEL EMOTIONAL LANDMARK (-13.5, -73.0)
 * 10-Step Ride Sequence with Apex Hold: "Look how beautiful this place is."
 * ============================================================================
 */
function createFerrisWheelLandmark(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const root = new THREE.Group();
  const groundY = getTerrainHeight(x, z);
  root.position.set(x, groundY, z);
  root.rotation.y = rotY;
  colliders.push({ x, z, radius: 4.8 });

  const hubHeight = 14.4;
  const wheelRadius = 10.8;
  const gondolaCount = 12;

  // 1. Boarding platform & steps
  const deckGeo = tracker.trackGeo(
    createBeveledBoxGeometry(7.6, 0.55, 5.2, 0.04),
  );
  const deck = new THREE.Mesh(deckGeo, mats.warmTimber);
  deck.receiveShadow = true;
  root.add(deck);

  // 2. Heavy A-Frame support legs (front and rear pairs)
  const legLength = Math.hypot(5.8, hubHeight);
  const legAngle = Math.atan2(5.8, hubHeight);
  const legGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.18, 0.26, legLength, 12),
  );

  for (const zSide of [-1.45, 1.45]) {
    for (const xDir of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.creamStone);
      leg.position.set(xDir * 2.9, hubHeight * 0.5, zSide);
      leg.rotation.z = xDir * legAngle;
      leg.castShadow = true;
      root.add(leg);
    }
  }

  // Central axle crossbar
  const axleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.32, 0.32, 3.6, 16),
  );
  axleGeo.rotateX(Math.PI / 2);
  const axle = new THREE.Mesh(axleGeo, mats.brushedGold);
  axle.position.set(0, hubHeight, 0);
  root.add(axle);

  // 3. Rotating Wheel Pivot
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0, hubHeight, 0);
  root.add(wheelPivot);

  // Twin outer rims & inner star rings
  const rimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(wheelRadius, 0.14, 12, 48),
  );
  const innerRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(wheelRadius * 0.62, 0.09, 10, 36),
  );
  for (const zOff of [-1.05, 1.05]) {
    const rim = new THREE.Mesh(rimGeo, mats.creamStone);
    rim.position.z = zOff;
    const innerRim = new THREE.Mesh(innerRimGeo, mats.brushedGold);
    innerRim.position.z = zOff;
    wheelPivot.add(rim, innerRim);
  }

  // Glowing central heart emblem on both sides of the hub
  const heartShape = createHeartShape2D(0.95);
  const hubHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    }),
  );
  hubHeartGeo.center();
  const hubHeartFront = new THREE.Mesh(hubHeartGeo, mats.softRoseGlow);
  hubHeartFront.position.z = 1.25;
  const hubHeartBack = new THREE.Mesh(hubHeartGeo, mats.softRoseGlow);
  hubHeartBack.position.z = -1.25;
  wheelPivot.add(hubHeartFront, hubHeartBack);

  // Spokes & 12 Upright-Stabilized Romantic Gondolas
  const spokeGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.045, 0.045, wheelRadius * 2, 8),
  );
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI;
    for (const zOff of [-1.05, 1.05]) {
      const spoke = new THREE.Mesh(spokeGeo, mats.brushedGold);
      spoke.rotation.z = ang;
      spoke.position.z = zOff;
      wheelPivot.add(spoke);
    }
  }

  const gondolaPivots: THREE.Group[] = [];
  const cabinMaterials = [
    mats.crimsonVelvet,
    mats.blushPastel,
    mats.patinaTealRoof,
    mats.softRoseGold,
  ];
  const cabinBasketGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.68, 0.54, 0.72, 14),
  );
  const cabinRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(0.76, 0.38, 14));
  const hangerGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8),
  );
  const lanternGlobeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.095, 10, 10),
  );

  let gondola0Hanger: THREE.Mesh | null = null;
  let gondola0Lantern: THREE.Mesh | null = null;

  for (let i = 0; i < gondolaCount; i++) {
    const angle = (i / gondolaCount) * Math.PI * 2 - Math.PI / 2;
    const gx = Math.cos(angle) * wheelRadius;
    const gy = Math.sin(angle) * wheelRadius;

    const pivot = new THREE.Group();
    pivot.position.set(gx, gy, 0);
    wheelPivot.add(pivot);

    const hanger = new THREE.Mesh(hangerGeo, mats.brushedGold);
    hanger.position.y = -0.55;
    pivot.add(hanger);

    const roof = new THREE.Mesh(cabinRoofGeo, mats.ivoryCanvas);
    roof.position.y = -0.12;
    pivot.add(roof);

    const basket = new THREE.Mesh(
      cabinBasketGeo,
      cabinMaterials[i % cabinMaterials.length],
    );
    basket.position.y = -1.12;
    basket.castShadow = true;
    pivot.add(basket);

    const lantern = new THREE.Mesh(lanternGlobeGeo, mats.warmLanternGlow);
    lantern.position.y = -0.52;
    pivot.add(lantern);

    if (i === 0) {
      gondola0Hanger = hanger;
      gondola0Lantern = lantern;
    }

    gondolaPivots.push(pivot);
  }

  // Mounted Sky Ticket Prize Display Box in clear space in front of the boarding platform
  const prizeId = 'unfolding_sky_ticket';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const prizeBox = createPrizeDisplayBox(prizeId, tracker, mats);
  const idleBoxPos = new THREE.Vector3(2.4, 0.65, 2.35);
  const presentationBoxPos = new THREE.Vector3(0, 1.85, 3.45);
  prizeBox.group.position.copy(idleBoxPos);
  prizeBox.group.rotation.y = 0;
  softenGiftMaterials(prizeBox.group);
  root.add(prizeBox.group);
  const orbitCam = createGiftOrbitCameraState(1.22);

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let rideWheelAngle = 0;
  let targetLookYaw = 0;
  let targetLookPitch = 0;
  let currentLookYaw = 0;
  let currentLookPitch = 0;
  let prizeAwardedThisRun = false;

  const worldPos = new THREE.Vector3(x, groundY, z);
  const forwardDir = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPos = new THREE.Vector3(
    x + forwardDir.x * 3.8,
    groundY,
    z + forwardDir.z * 3.8,
  );
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();
  const gondolaWorldPos = new THREE.Vector3();

  return {
    id: 'ferris_wheel',
    title: 'Starlight Ferris Wheel',
    subtitle: 'Heart Island Overlook Ride',
    verb: 'E Ride',
    group: root,
    worldPos,
    interactPos,
    interactRadius: 6.4,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      state = 'ACTIVATING';
      stateTimer = 0;
      rideWheelAngle = 0;
      wheelPivot.rotation.z = 0;
      targetLookYaw = 0;
      targetLookPitch = 0;
      currentLookYaw = 0;
      currentLookPitch = 0;
      prizeAwardedThisRun = false;
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.group.position.copy(idleBoxPos);
      prizeBox.group.rotation.y = 0;
      prizeBox.setOpenProgress(0, 0);
      audio.ensureRunning();
      audio.playTargetHitChime(0);
    },

    performAction() {
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
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.group.position.copy(idleBoxPos);
      prizeBox.group.rotation.y = 0;
      prizeBox.setOpenProgress(0, 0);
      if (gondola0Hanger) gondola0Hanger.visible = true;
      if (gondola0Lantern) gondola0Lantern.visible = true;
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'IDLE') return;
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, prizeBox);
        return;
      }
      // Standardized Ride Look Math:
      // dx > 0 (Right) -> turns view Right; dx < 0 (Left) -> turns view Left
      // dy < 0 (Up) -> pitches view Up (+); dy > 0 (Down) -> pitches view Down (-)
      targetLookYaw = THREE.MathUtils.clamp(
        targetLookYaw - dx * 0.0032,
        -1.48,
        1.48,
      );
      targetLookPitch = THREE.MathUtils.clamp(
        targetLookPitch - dy * 0.0026,
        -0.61,
        0.78,
      );
    },

    applyZoomDelta(deltaZoom: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(deltaZoom);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'ferris_wheel',
          title: 'Starlight Ferris Wheel',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'CINEMATIC' || state === 'WIN') {
        return {
          attractionId: 'ferris_wheel',
          title: 'Starlight Ferris Wheel',
          subtitle: 'Apex Overlook & Sky Ticket',
          state,
          captionLine: '"I\'d choose the seat next to you anywhere in this universe."',
          instruction:
            'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom · Press Enter to Descend',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'RECOVERY') {
        return {
          attractionId: 'ferris_wheel',
          title: 'Starlight Ferris Wheel',
          subtitle: 'Descending to the Boardwalk',
          state,
          captionLine:
            'The gondola glides gently back toward the warm lantern glow of the Midway.',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'ferris_wheel',
        title: 'Starlight Ferris Wheel',
        subtitle:
          state === 'ACTIVATING'
            ? 'Step 1: Boarding Gondola & Closing Latch'
            : 'Rising Above the Carnival Lights',
        state,
        captionLine:
          'The wooden boardwalk, glowing booths, and spinning carousel unfold beneath your gondola.',
        instruction: 'Mouse or WASD / Arrows to Look Across Heart Island · Esc to Exit',
        requiresEnterToContinue: false,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      // Track Gondola 0 world position
      gondolaPivots[0].getWorldPosition(gondolaWorldPos);

      const radialVistaYaw = Math.atan2(0 - x, -58 - z);
      const baseVistaYaw = radialVistaYaw + currentLookYaw;

      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const prizeWorldPos = new THREE.Vector3();
        prizeBox.group.getWorldPosition(prizeWorldPos);
        orbitCam.computeFocus(prizeWorldPos, rotY, camWorldPos, lookWorldPos);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: 1.0,
          playerPos: interactPos,
          playerYaw: rotY,
          isSitting: false,
          hidePlayerAvatar: true,
        };
      }

      // Move ride camera anchor outward (+0.68m clear of gondola front railing/pillars along outward view vector)
      // and slightly elevated (-0.56m) so zero gondola bars or wheel spokes obstruct the panoramic view
      const pitch = -0.06 + currentLookPitch;
      camWorldPos.set(
        gondolaWorldPos.x + Math.sin(radialVistaYaw) * 0.68,
        gondolaWorldPos.y - 0.56,
        gondolaWorldPos.z + Math.cos(radialVistaYaw) * 0.68,
      );
      lookWorldPos.set(
        camWorldPos.x + Math.sin(baseVistaYaw) * Math.cos(pitch) * 14.0,
        camWorldPos.y + Math.sin(pitch) * 14.0,
        camWorldPos.z + Math.cos(baseVistaYaw) * Math.cos(pitch) * 14.0,
      );

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 5.0 : 1.0,
        playerPos:
          state === 'RECOVERY' && stateTimer > 4.2
            ? interactPos
            : new THREE.Vector3(
                gondolaWorldPos.x,
                gondolaWorldPos.y - 1.15,
                gondolaWorldPos.z,
              ),
        playerYaw: baseVistaYaw,
        isSitting: true,
        hidePlayerAvatar: true,
      };
    },

    update(
      dt: number,
      elapsedTime: number,
      _camera?: THREE.PerspectiveCamera,
      keys?: Set<string>,
    ) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;

      // Hide Gondola 0's inner hanger bar and lantern during the ride view so zero geometry clips the camera
      const inRideView =
        state === 'ACTIVATING' || state === 'PLAYING' || state === 'RECOVERY';
      if (gondola0Hanger) gondola0Hanger.visible = !inRideView;
      if (gondola0Lantern) gondola0Lantern.visible = !inRideView;

      if (inRideView) {
        if (keys) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw + 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyD') || keys.has('ArrowRight')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw - 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyW') || keys.has('ArrowUp')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch + 1.25 * dt, -0.61, 0.78);
          }
          if (keys.has('KeyS') || keys.has('ArrowDown')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch - 1.25 * dt, -0.61, 0.78);
          }
        }
        currentLookYaw = THREE.MathUtils.damp(currentLookYaw, targetLookYaw, 10, dt);
        currentLookPitch = THREE.MathUtils.damp(currentLookPitch, targetLookPitch, 10, dt);
      }

      if (state === 'IDLE') {
        // Gentle ambient rotation when idle
        wheelPivot.rotation.z =
          (wheelPivot.rotation.z + dt * 0.16) % (Math.PI * 2);
      } else if (state === 'ACTIVATING') {
        if (stateTimer >= 1.1) {
          state = 'PLAYING';
          stateTimer = 0;
        }
      } else if (state === 'PLAYING') {
        // Smooth ascent from bottom (0) to top apex (PI) over 7.5 seconds
        const u = THREE.MathUtils.smoothstep(
          Math.min(1, stateTimer / 7.5),
          0,
          1,
        );
        rideWheelAngle = u * Math.PI;
        wheelPivot.rotation.z = rideWheelAngle;
        if (stateTimer >= 7.6) {
          state = 'CINEMATIC';
          stateTimer = 0;
          audio.playPrizeRevealArpeggio();
        }
      } else if (state === 'CINEMATIC') {
        wheelPivot.rotation.z = Math.PI;
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.position.lerp(presentationBoxPos, 1 - Math.exp(-8 * dt));
        prizeBox.group.rotation.y = 0;
        prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
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
        wheelPivot.rotation.z = Math.PI;
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.position.lerp(presentationBoxPos, 1 - Math.exp(-8 * dt));
        prizeBox.group.rotation.y = 0;
        prizeBox.updateCinematicAnimation(stateTimer + 3.5, elapsedTime, fx, audio);
      } else if (state === 'RECOVERY') {
        // Smooth descent from apex (PI) back to boarding platform (2*PI) over 5.0 seconds
        const u = THREE.MathUtils.smoothstep(
          Math.min(1, stateTimer / 5.0),
          0,
          1,
        );
        rideWheelAngle = Math.PI + u * Math.PI;
        wheelPivot.rotation.z = rideWheelAngle;
        prizeBox.group.position.lerp(idleBoxPos, 1 - Math.exp(-6 * dt));
        prizeBox.setOpenProgress(1 - u, elapsedTime);
        if (stateTimer >= 5.1) {
          orbitCam.reset();
          prizeBox.setTactileTilt(0, 0);
          prizeBox.group.position.copy(idleBoxPos);
          prizeBox.setOpenProgress(0, 0);
          state = 'IDLE';
          stateTimer = 0;
        }
      }

      // Keep all 12 gondolas upright regardless of wheel rotation
      const counterRot = -wheelPivot.rotation.z;
      for (let i = 0; i < gondolaPivots.length; i++) {
        gondolaPivots[i].rotation.z = counterRot;
      }

      return { newlyEarnedPrizeId };
    },
  };
}

/**
 * ============================================================================
 * 3. QUIET GARDEN ALCOVE (-16.5, -54.5)
 * Peaceful sanctuary tucked into the Carnival: bench, stone fountain,
 * warm lantern, trimmed hedges, flowers, and drifting fireflies.
 * ============================================================================
 */
function createQuietGardenLandmark(
  x: number,
  z: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  const root = new THREE.Group();
  const groundY = getTerrainHeight(x, z);
  root.position.set(x, groundY, z);

  const prizeId = 'little_glowing_flower';
  const prizeDef = CARNIVAL_PRIZES[prizeId];
  const prizeBox = createPrizeDisplayBox(prizeId, tracker, mats);
  prizeBox.group.position.set(0.9, 0.52, -1.25);
  prizeBox.group.rotation.y = -0.58;
  softenGiftMaterials(prizeBox.group);
  root.add(prizeBox.group);
  const orbitCam = createGiftOrbitCameraState(1.12);

  // 1. Circular stone garden floor pad
  const floorGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.2, 4.4, 0.1, 28),
  );
  floorGeo.translate(0, 0.05, 0);
  const floor = new THREE.Mesh(floorGeo, mats.warmSandstone);
  floor.receiveShadow = true;
  root.add(floor);

  // 2. Curved enclosing hedge segments & flower blossoms
  const hedgeGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.65, 1.05, 0.65, 0.08),
  );
  const blossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
  const hedgeAngles = [-2.4, -1.75, -1.1, -0.45, 0.2];
  for (let i = 0; i < hedgeAngles.length; i++) {
    const a = hedgeAngles[i];
    const hx = Math.cos(a) * 3.85;
    const hz = Math.sin(a) * 3.85;
    const hedge = new THREE.Mesh(hedgeGeo, mats.patinaTealRoof);
    hedge.position.set(hx, 0.08, hz);
    hedge.rotation.y = -a + Math.PI / 2;
    hedge.castShadow = true;
    root.add(hedge);

    for (let b = -1; b <= 1; b++) {
      const blossom = new THREE.Mesh(
        blossomGeo,
        (i + b) % 2 === 0 ? mats.softRoseGlow : mats.lavenderPastel,
      );
      blossom.position.set(
        hx + Math.cos(a) * -0.15 + b * 0.25,
        1.12,
        hz + Math.sin(a) * -0.15,
      );
      root.add(blossom);
    }
  }

  // 3. Tiered stone fountain in the center of the alcove
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(-0.65, 0.08, -0.45);
  root.add(fountainGroup);
  colliders.push({ x: x - 0.65, z: z - 0.45, radius: 1.35 });

  const basinRimGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(0.95, 1.25, 0.42, 8),
  );
  const basinRim = new THREE.Mesh(basinRimGeo, mats.creamStone);
  fountainGroup.add(basinRim);

  const waterDiskGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.05, 1.05, 0.05, 24),
  );
  const waterDisk = new THREE.Mesh(waterDiskGeo, mats.fountainWater);
  waterDisk.position.y = 0.34;
  fountainGroup.add(waterDisk);

  const pedestalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.22, 0.32, 1.05, 12),
  );
  pedestalGeo.translate(0, 0.525, 0);
  const pedestal = new THREE.Mesh(pedestalGeo, mats.creamStone);
  fountainGroup.add(pedestal);

  const heartShape = createHeartShape2D(0.22);
  const memoryHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
  );
  memoryHeartGeo.center();
  const memoryHeart = new THREE.Mesh(memoryHeartGeo, mats.crystalHeart);
  memoryHeart.position.y = 1.28;
  fountainGroup.add(memoryHeart);

  // 4. Two-person romantic wooden bench facing the fountain and Midway lights
  const benchGroup = new THREE.Group();
  benchGroup.position.set(1.35, 0.08, -1.55);
  benchGroup.rotation.y = -0.58;
  root.add(benchGroup);

  const seatGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.65, 0.08, 0.56, 0.02),
  );
  const seat = new THREE.Mesh(seatGeo, mats.warmTimber);
  seat.position.y = 0.46;
  const backGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.65, 0.48, 0.07, 0.02),
  );
  const backrest = new THREE.Mesh(backGeo, mats.warmTimber);
  backrest.position.set(0, 0.52, -0.24);
  backrest.rotation.x = -0.14;
  const legGeo = tracker.trackGeo(new THREE.BoxGeometry(0.1, 0.46, 0.48));
  legGeo.translate(0, 0.23, 0);
  const legL = new THREE.Mesh(legGeo, mats.wroughtBronze);
  legL.position.x = -0.68;
  const legR = new THREE.Mesh(legGeo, mats.wroughtBronze);
  legR.position.x = 0.68;
  benchGroup.add(seat, backrest, legL, legR);

  // 5. Warm garden lantern post beside the bench
  const postGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.05, 0.07, 2.55, 10),
  );
  postGeo.translate(0, 1.275, 0);
  const lanternPost = new THREE.Mesh(postGeo, mats.wroughtBronze);
  lanternPost.position.set(2.35, 0.08, -1.15);
  const globeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.18, 12, 12));
  const lanternGlobe = new THREE.Mesh(globeGeo, mats.warmLanternGlow);
  lanternGlobe.position.set(2.35, 2.72, -1.15);
  root.add(lanternPost, lanternGlobe);

  // 6. Drifting Fireflies / Butterflies InstancedMesh (20 instances = 1 draw call)
  const fireflyCount = 20;
  const fireflyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.032, 6, 6));
  const fireflies = new THREE.InstancedMesh(
    fireflyGeo,
    mats.warmLanternGlow,
    fireflyCount,
  );
  fireflies.frustumCulled = false;
  root.add(fireflies);

  let state: CarnivalAttractionState = 'IDLE';
  let stateTimer = 0;
  let targetLookYaw = 0;
  let targetLookPitch = 0;
  let currentLookYaw = 0;
  let currentLookPitch = 0;
  let prizeAwardedThisRun = false;

  const worldPos = new THREE.Vector3(x, groundY, z);
  const benchSeatWorldPos = new THREE.Vector3(x + 1.35, groundY + 0.08, z - 1.55);
  const interactPos = new THREE.Vector3(x + 1.1, groundY, z - 0.6);
  const camWorldPos = new THREE.Vector3();
  const lookWorldPos = new THREE.Vector3();

  return {
    id: 'quiet_garden',
    title: 'Quiet Garden Sanctuary',
    subtitle: 'Lantern & Fountain Alcove',
    verb: 'E Enter',
    group: root,
    worldPos,
    interactPos,
    interactRadius: 4.4,
    getState: () => state,
    getPrizeId: () => prizeId,

    activate() {
      state = 'PLAYING';
      stateTimer = 0;
      targetLookYaw = 0;
      targetLookPitch = 0;
      currentLookYaw = 0;
      currentLookPitch = 0;
      prizeAwardedThisRun = false;
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.setOpenProgress(0, 0);
    },

    performAction() {
      return false;
    },

    advanceStep() {
      if (state === 'PLAYING') {
        state = 'CINEMATIC';
        stateTimer = 0;
        return true;
      }
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
      orbitCam.reset();
      prizeBox.setTactileTilt(0, 0);
      prizeBox.setOpenProgress(0, 0);
      state = 'IDLE';
      stateTimer = 0;
      return { earnedPrizeId: earned };
    },

    applyMouseDelta(dx: number, dy: number) {
      if (state === 'IDLE') return;
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyMouse(dx, dy, prizeBox);
        return;
      }
      targetLookYaw = THREE.MathUtils.clamp(
        targetLookYaw - dx * 0.0032,
        -1.48,
        1.48,
      );
      targetLookPitch = THREE.MathUtils.clamp(
        targetLookPitch - dy * 0.0026,
        -0.61,
        0.78,
      );
    },

    applyZoomDelta(deltaZoom: number) {
      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        orbitCam.applyZoom(deltaZoom);
      }
    },

    getOverlay(): CarnivalActiveOverlay | null {
      if (state === 'IDLE' || state === 'RECOVERY') return null;
      if (state === 'PRIZE_REVEAL') {
        return {
          attractionId: 'quiet_garden',
          title: 'Quiet Garden Sanctuary',
          subtitle: prizeDef.category,
          state,
          prizeName: prizeDef.name,
          prizeCategory: prizeDef.subtitle,
          captionLine: prizeDef.caption,
          instruction: 'Move Mouse / A-D to Rotate 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: true,
        };
      }
      if (state === 'CINEMATIC' || state === 'WIN') {
        return {
          attractionId: 'quiet_garden',
          title: 'Quiet Garden Sanctuary',
          subtitle: 'Night Blossom Blooming',
          state,
          captionLine: '"Thank you for loving me so purely and beautifully."',
          instruction: 'Move Mouse / A-D to Orbit 360° · Scroll / W-S to Zoom · Enter to Collect',
          requiresEnterToContinue: false,
        };
      }
      return {
        attractionId: 'quiet_garden',
        title: 'Quiet Garden Sanctuary',
        subtitle: 'A Moment to Sit & Breathe',
        state,
        captionLine:
          'A quiet corner away from the midway lights—just the fountain, warm lanterns, and time slowing down.',
        instruction: 'Mouse or WASD / Arrows to Look Around · Press Enter or Esc to Stand Up',
        requiresEnterToContinue: true,
      };
    },

    getCameraFocus(): CarnivalCameraFocus | null {
      if (state === 'IDLE') return null;

      if (state === 'WIN' || state === 'CINEMATIC' || state === 'PRIZE_REVEAL') {
        const prizeWorldPos = new THREE.Vector3();
        prizeBox.group.getWorldPosition(prizeWorldPos);
        orbitCam.computeFocus(prizeWorldPos, -0.58, camWorldPos, lookWorldPos);
        return {
          active: true,
          camWorldPos,
          lookWorldPos,
          blendAlpha: 1.0,
          playerPos: benchSeatWorldPos,
          playerYaw: -0.58,
          isSitting: true,
          hidePlayerAvatar: true,
        };
      }

      // Dedicated first-person seated view right on the garden bench
      const seatYaw = -0.58 + currentLookYaw;
      const pitch = -0.04 + currentLookPitch;
      camWorldPos.set(
        benchSeatWorldPos.x,
        benchSeatWorldPos.y + 0.95,
        benchSeatWorldPos.z,
      );
      lookWorldPos.set(
        camWorldPos.x + Math.sin(seatYaw) * Math.cos(pitch) * 10.0,
        camWorldPos.y + Math.sin(pitch) * 10.0,
        camWorldPos.z + Math.cos(seatYaw) * Math.cos(pitch) * 10.0,
      );

      return {
        active: true,
        camWorldPos,
        lookWorldPos,
        blendAlpha: state === 'RECOVERY' ? 1.0 - stateTimer / 0.5 : 1.0,
        playerPos: state === 'RECOVERY' ? interactPos : benchSeatWorldPos,
        playerYaw: -0.58,
        isSitting: true,
        hidePlayerAvatar: true,
      };
    },

    update(
      dt: number,
      elapsedTime: number,
      _camera?: THREE.PerspectiveCamera,
      keys?: Set<string>,
    ) {
      let newlyEarnedPrizeId: string | null = null;
      stateTimer += dt;
      memoryHeart.rotation.y = elapsedTime * 0.85;
      memoryHeart.position.y = 1.28 + Math.sin(elapsedTime * 2.1) * 0.04;

      if (state === 'PLAYING' || state === 'ACTIVATING') {
        if (keys) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw + 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyD') || keys.has('ArrowRight')) {
            targetLookYaw = THREE.MathUtils.clamp(targetLookYaw - 1.55 * dt, -1.48, 1.48);
          }
          if (keys.has('KeyW') || keys.has('ArrowUp')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch + 1.25 * dt, -0.61, 0.78);
          }
          if (keys.has('KeyS') || keys.has('ArrowDown')) {
            targetLookPitch = THREE.MathUtils.clamp(targetLookPitch - 1.25 * dt, -0.61, 0.78);
          }
        }
        currentLookYaw = THREE.MathUtils.damp(currentLookYaw, targetLookYaw, 10, dt);
        currentLookPitch = THREE.MathUtils.damp(currentLookPitch, targetLookPitch, 10, dt);
      }

      // Update drifting fireflies
      for (let i = 0; i < fireflyCount; i++) {
        const phase = i * 1.37;
        const r = 1.2 + (i % 5) * 0.52;
        const a = elapsedTime * (0.35 + (i % 3) * 0.12) + phase;
        const fxPos = Math.cos(a) * r;
        const fyPos = 0.65 + Math.sin(elapsedTime * 1.4 + phase) * 0.42 + (i % 4) * 0.25;
        const fzPos = Math.sin(a) * r;
        const pulse = 0.7 + 0.35 * Math.sin(elapsedTime * 3.2 + phase);
        _dummyObj.position.set(fxPos, fyPos, fzPos);
        _dummyObj.scale.setScalar(pulse);
        _dummyObj.updateMatrix();
        fireflies.setMatrixAt(i, _dummyObj.matrix);
      }
      fireflies.instanceMatrix.needsUpdate = true;

      if (state === 'CINEMATIC') {
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.rotation.y = -0.58;
        prizeBox.updateCinematicAnimation(stateTimer, elapsedTime, fx, audio);
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
        orbitCam.updateKeys(dt, keys);
        prizeBox.group.rotation.y = -0.58;
        prizeBox.updateCinematicAnimation(stateTimer + 3.5, elapsedTime, fx, audio);
      } else if (state === 'RECOVERY') {
        const recoverU = stateTimer / 0.5;
        prizeBox.setOpenProgress(1 - recoverU, elapsedTime);
        fx.setTheatricalLighting(1 - recoverU, worldPos);
        if (stateTimer >= 0.5) {
          orbitCam.reset();
          prizeBox.setTactileTilt(0, 0);
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
 * Creates the 3 Carnival Landmark attractions (Carousel, Ferris Wheel, Quiet Garden).
 */
export function createCarnivalLandmarks(
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction[] {
  return [
    createCarouselLandmark(11.5, -71.5, tracker, mats, audio, colliders, fx),
    createFerrisWheelLandmark(-13.5, -73.0, 0.36, tracker, mats, audio, colliders, fx),
    createQuietGardenLandmark(-16.5, -54.5, tracker, mats, audio, colliders, fx),
  ];
}
