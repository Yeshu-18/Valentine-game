/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { getTerrainHeight } from '../terrainMath';
import { AuroraAudioSynthesizer } from './AuroraAudio';
import {
  AURORA_CINEMATIC_DIALOGUE,
  AuroraDialogueLine,
  AuroraDialogueSequence,
} from './auroraDialogueData';

export type AuroraCinematicState =
  | 'IDLE'
  | 'ENTERING'
  | 'DESCENDING'
  | 'UNDERGROUND_DARKNESS'
  | 'MAN_APPROACH'
  | 'SITTING'
  | 'SKY_REVEAL'
  | 'AURORA_REVEAL'
  | 'POND_REVEAL'
  | 'QUIET_AURORA'
  | 'ROMANTIC_DIALOGUE_1'
  | 'ROMANTIC_DIALOGUE_2'
  | 'ROMANTIC_DIALOGUE_3'
  | 'PROPOSAL'
  | 'EMOTIONAL_HOLD'
  | 'RETURN_PREP'
  | 'ASCENDING'
  | 'SURFACE_REVEAL'
  | 'RESTORING'
  | 'COMPLETE';

export interface AuroraCinematicCameraFocus {
  active: boolean;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  playerPos: THREE.Vector3;
  playerYaw: number;
  isSitting?: boolean;
}

export interface AuroraCinematicBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  isNearStone: (playerWorldPos: THREE.Vector3) => boolean;
  getInteractionPrompt: (playerWorldPos: THREE.Vector3) => string | null;
  triggerCinematic: (
    playerWorldPos: THREE.Vector3,
    playerYaw: number,
    camPos: THREE.Vector3,
    lookPos: THREE.Vector3,
  ) => boolean;
  applyMouseLookDelta: (dx: number, dy: number) => void;
  skipCinematic: () => void;
  isActive: () => boolean;
  getCurrentDialogue: () => AuroraDialogueLine | null;
  advanceDialogue: () => boolean;
  getCameraFocus: () => AuroraCinematicCameraFocus | null;
  update: (dt: number, elapsedTime: number) => void;
  dispose: () => void;
}

export type AuroraUndergroundCinematicBundle = AuroraCinematicBundle;

// Authoritative location of the Aurora Lake Vista Stone Plinth
export const AURORA_STONE_POS = {
  x: 0.0,
  z: 55.0,
} as const;

const STONE_INTERACTION_RADIUS = 2.8;
const UNDERGROUND_DEPTH_Y = -26.0;

// Existing Sky Dome boundary & strict inner Aurora containment radius
const DOME_RADIUS = 22.5;
const SAFE_AURORA_MAX_RADIUS = 19.8; // At least 2.7m inside the 22.5m sky dome at all points

// Camera mouse-look limits (Section 10: ±60° yaw, -25° to +35° pitch)
const MAX_LOOK_YAW = THREE.MathUtils.degToRad(60);
const MIN_LOOK_PITCH = THREE.MathUtils.degToRad(-25);
const MAX_LOOK_PITCH = THREE.MathUtils.degToRad(35);

/**
 * Builds a curved spherical-band geometry strictly contained inside the sky dome.
 * Because every vertex follows `r = sphereRadius * cos(elev)` and `y = sphereRadius * sin(elev)`
 * with `sphereRadius <= SAFE_AURORA_MAX_RADIUS`, the curtain naturally curves with the dome
 * and can never intersect or penetrate the outer sky dome surface.
 */
function createContainedSphericalCurtainGeometry(
  sphereRadius: number,
  azimuthStart: number,
  azimuthSpan: number,
  elevMinRad: number,
  elevMaxRad: number,
  segX = 96,
  segY = 28,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vertCount = (segX + 1) * (segY + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  let ptr = 0;
  let uvPtr = 0;

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY;
    const elev = THREE.MathUtils.lerp(elevMinRad, elevMaxRad, v);
    const cosE = Math.cos(elev);
    const sinE = Math.sin(elev);

    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const azim = azimuthStart + u * azimuthSpan;

      // Subtle organic S-curve wave built into the curtain footprint (clamped safely inside dome)
      const organicWave =
        Math.sin(u * Math.PI * 2.5 + azim * 0.7) * 0.45 +
        Math.cos(u * Math.PI * 4.2 - azim * 0.4) * 0.25;
      const safeR = Math.min(
        SAFE_AURORA_MAX_RADIUS - 0.85,
        sphereRadius + organicWave * (1.0 - v * 0.4),
      );

      const x = Math.sin(azim) * cosE * safeR;
      const y = sinE * safeR;
      const z = Math.cos(azim) * cosE * safeR;

      positions[ptr++] = x;
      positions[ptr++] = y;
      positions[ptr++] = z;

      uvs[uvPtr++] = u;
      uvs[uvPtr++] = v;
    }
  }

  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * (segX + 1) + ix;
      const b = a + 1;
      const c = (iy + 1) * (segX + 1) + ix;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createAuroraUndergroundCinematic(): AuroraCinematicBundle {
  const group = new THREE.Group();
  group.name = 'AuroraUndergroundCinematicGroup';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];

  const surfaceY = getTerrainHeight(AURORA_STONE_POS.x, AURORA_STONE_POS.z);
  const audio = new AuroraAudioSynthesizer();

  // State Machine Variables
  let state: AuroraCinematicState = 'IDLE';
  let stateTimer = 0.0;
  let inviteSequenceStarted = false;
  let returnWalkTimer = 0.0;
  let currentDialogue: AuroraDialogueLine | null = null;
  let currentDialogueKey: string | null = null;
  let currentDialogueIndex = -1;

  function beginDialogueSequence(key: string) {
    const sequence: AuroraDialogueSequence | undefined = AURORA_CINEMATIC_DIALOGUE[key];
    if (!sequence || sequence.length === 0) {
      currentDialogueKey = null;
      currentDialogueIndex = -1;
      currentDialogue = null;
      return;
    }
    currentDialogueKey = key;
    currentDialogueIndex = 0;
    currentDialogue = sequence[0];
  }

  function clearDialogueSequence() {
    currentDialogueKey = null;
    currentDialogueIndex = -1;
    currentDialogue = null;
  }

  function isDialogueComplete() {
    if (!currentDialogueKey) return true;
    const sequence = AURORA_CINEMATIC_DIALOGUE[currentDialogueKey];
    return !sequence || currentDialogueIndex >= sequence.length - 1;
  }

  function advanceDialogueInternal(): boolean {
    if (!currentDialogueKey) return false;
    const sequence = AURORA_CINEMATIC_DIALOGUE[currentDialogueKey];
    if (!sequence) return false;

    if (currentDialogueIndex < sequence.length - 1) {
      currentDialogueIndex += 1;
      currentDialogue = sequence[currentDialogueIndex];
      return false;
    }

    clearDialogueSequence();
    return true;
  }

  // Stored player transforms before descent
  const capturedPlayerPos = new THREE.Vector3(
    AURORA_STONE_POS.x,
    surfaceY,
    AURORA_STONE_POS.z,
  );
  let capturedPlayerYaw = 0;

  // Cinematic Base Camera & Harsha transforms
  const cinCamPos = new THREE.Vector3();
  const cinLookPos = new THREE.Vector3();
  const finalLookPos = new THREE.Vector3();
  const cinPlayerPos = new THREE.Vector3();
  let cinPlayerYaw = 0;
  let cinIsSitting = false;
  let cameraBlendAlpha = 0;

  // AuroraCameraLook: Damped mouse-look state (Sections 9, 10, 11)
  let targetLookYaw = 0;
  let targetLookPitch = 0;
  let currentLookYaw = 0;
  let currentLookPitch = 0;

  // Start & Return camera anchors
  const initialCamPos = new THREE.Vector3();
  const initialLookPos = new THREE.Vector3();

  // ----------------------------------------------------------------------------
  // 1. THE STONE ELEVATOR PLINTH (EXACT STONE AT AURORA LAKE VISTA)
  // ----------------------------------------------------------------------------
  const stoneElevatorGroup = new THREE.Group();
  stoneElevatorGroup.name = 'AuroraStoneElevator';
  stoneElevatorGroup.position.set(
    AURORA_STONE_POS.x,
    surfaceY,
    AURORA_STONE_POS.z,
  );
  group.add(stoneElevatorGroup);

  const stoneSlabMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b4656'),
      roughness: 0.82,
      metalness: 0.06,
      fog: false,
    }),
  );
  // Existing cyan glow used only as a small runic accent on the stone plinth (Section 2)
  const stoneRuneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2dd4bf'),
      emissive: new THREE.Color('#0d9488'),
      emissiveIntensity: 0.28,
      roughness: 0.35,
      fog: false,
    }),
  );

  const slabGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.15, 2.35, 0.44, 18),
  );
  slabGeo.translate(0, 0.22, 0);
  const slabMesh = new THREE.Mesh(slabGeo, stoneSlabMat);
  slabMesh.castShadow = true;
  slabMesh.receiveShadow = true;
  stoneElevatorGroup.add(slabMesh);

  const stoneRuneRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(1.4, 1.55, 36),
  );
  stoneRuneRingGeo.rotateX(-Math.PI / 2);
  stoneRuneRingGeo.translate(0, 0.445, 0);
  const stoneRuneRing = new THREE.Mesh(stoneRuneRingGeo, stoneRuneMat);
  stoneElevatorGroup.add(stoneRuneRing);

  const runeStarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.01, 2.7));
  for (let r = 0; r < 3; r++) {
    const starRay = new THREE.Mesh(runeStarGeo, stoneRuneMat);
    starRay.position.y = 0.446;
    starRay.rotation.y = (r * Math.PI) / 3;
    stoneElevatorGroup.add(starRay);
  }

  // ----------------------------------------------------------------------------
  // 2. VERTICAL DESCENT PASSAGE
  // ----------------------------------------------------------------------------
  const chimneyGroup = new THREE.Group();
  chimneyGroup.position.set(AURORA_STONE_POS.x, 0, AURORA_STONE_POS.z);
  chimneyGroup.visible = false;
  group.add(chimneyGroup);

  const shaftHeight = Math.abs(UNDERGROUND_DEPTH_Y - surfaceY) + 2.0;
  const shaftCenterY = (surfaceY + UNDERGROUND_DEPTH_Y) * 0.5;
  const shaftGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(4.4, 4.8, shaftHeight, 28, 12, true),
  );
  const shaftMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#02040a'),
      side: THREE.BackSide,
      transparent: true,
      opacity: 1.0,
      fog: false,
    }),
  );
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.position.y = shaftCenterY;
  chimneyGroup.add(shaftMesh);

  // ----------------------------------------------------------------------------
  // 3. UNDERGROUND CHAMBER & NIGHT-LIT EMERALD MEADOW FLOOR
  // ----------------------------------------------------------------------------
  const chamberGroup = new THREE.Group();
  chamberGroup.position.set(
    AURORA_STONE_POS.x,
    UNDERGROUND_DEPTH_Y,
    AURORA_STONE_POS.z,
  );
  chamberGroup.visible = false;
  group.add(chamberGroup);

  const meadowGeo = tracker.trackGeo(
    new THREE.CircleGeometry(DOME_RADIUS + 0.2, 64),
  );
  meadowGeo.rotateX(-Math.PI / 2);

  // Dark night-lit emerald ground that receives subtle green aurora ambient contribution (Section 18)
  const meadowShaderMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uMeadowReveal: { value: 0 },
        uAuroraGlow: { value: 0 },
      },
      vertexShader: `
        varying vec2 vWorldXZ;
        varying float vDist;
        void main() {
          vec3 pos = position;
          float dCenter = length(pos.xz);
          float dPond = length(pos.xz - vec2(4.8, 4.2));
          if (dCenter > 2.8 && dPond > 5.6) {
            float hill = sin(pos.x * 0.22) * cos(pos.z * 0.22) * 0.28
                       + sin(pos.x * 0.11 + pos.z * 0.14) * 0.20;
            pos.y += hill * smoothstep(2.8, 7.0, dCenter);
          }
          vWorldXZ = pos.xz;
          vDist = dCenter;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vWorldXZ;
        varying float vDist;
        uniform float uTime;
        uniform float uMeadowReveal;
        uniform float uAuroraGlow;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          float normDist = clamp(vDist / 22.5, 0.0, 1.0);
          float radialWave = smoothstep(normDist * 0.65, normDist * 0.65 + 0.35, uMeadowReveal);

          float n1 = noise(vWorldXZ * 0.65);
          float n2 = noise(vWorldXZ * 2.4 + vec2(13.7, 29.1));
          float microBlade = noise(vWorldXZ * 9.5);

          // Linear-sRGB restrained dark night-lit emerald meadow (Section 18: dark scene with soft green aurora contribution)
          vec3 deepNightMoss  = vec3(0.003, 0.022, 0.012);
          vec3 darkEmerald    = vec3(0.006, 0.048, 0.022);
          vec3 auroraLitGrass = vec3(0.010, 0.082, 0.036);

          vec3 grassCol = mix(deepNightMoss, darkEmerald, smoothstep(0.25, 0.75, n1));
          grassCol = mix(grassCol, auroraLitGrass, smoothstep(0.45, 0.85, n2) * 0.65 * uAuroraGlow);
          grassCol += vec3(0.002, 0.010, 0.005) * (microBlade - 0.5);

          // Subtle drifting aurora green light reflection on the grass
          float auroraWave = sin(vWorldXZ.x * 0.18 + vWorldXZ.y * 0.14 - uTime * 0.25) * 0.5 + 0.5;
          grassCol += vec3(0.004, 0.032, 0.014) * auroraWave * uAuroraGlow;

          float edgeBlend = 1.0 - smoothstep(16.5, 22.4, vDist) * 0.65;
          vec3 finalCol = mix(vec3(0.001, 0.002, 0.005), grassCol * edgeBlend, radialWave);
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `,
    }),
  );

  const meadowMesh = new THREE.Mesh(meadowGeo, meadowShaderMat);
  meadowMesh.position.y = 0.0;
  chamberGroup.add(meadowMesh);

  // Subtle night-lit grass tufts & blossoms
  const grassTuftCount = 460;
  const grassBladeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.06, 0.3, 4),
  );
  grassBladeGeo.translate(0, 0.15, 0);

  const grassTuftMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#010205'),
      fog: false,
    }),
  );
  const grassInstancedMesh = new THREE.InstancedMesh(
    grassBladeGeo,
    grassTuftMat,
    grassTuftCount,
  );

  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyScale = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);

  let grassPlaced = 0;
  let grassAttempt = 0;
  while (grassPlaced < grassTuftCount && grassAttempt < 1800) {
    grassAttempt++;
    const angle = grassAttempt * 2.3999632;
    const rad = 2.6 + Math.sqrt(grassAttempt / 1800) * (DOME_RADIUS - 3.6);
    const gx = Math.cos(angle) * rad;
    const gz = Math.sin(angle) * rad;

    const distPlinth = Math.hypot(gx, gz);
    const distPond = Math.hypot(gx - 4.8, gz - 4.2);
    const distBench = Math.hypot(gx - 1.8, gz - 2.2);
    if (distPlinth < 2.5 || distPond < 5.5 || distBench < 1.6) continue;

    const hScale = 0.7 + (grassAttempt % 7) * 0.12;
    const wScale = 0.85 + (grassAttempt % 5) * 0.1;
    dummyPos.set(gx, 0.0, gz);
    dummyQuat.setFromAxisAngle(upAxis, angle);
    dummyScale.set(wScale, hScale, wScale);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    grassInstancedMesh.setMatrixAt(grassPlaced, dummyMatrix);
    grassPlaced++;
  }
  grassInstancedMesh.count = grassPlaced;
  grassInstancedMesh.instanceMatrix.needsUpdate = true;
  chamberGroup.add(grassInstancedMesh);

  const blossomCountPerType = 45;
  const blossomHeadGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.075, 6, 6),
  );
  blossomHeadGeo.scale(1.1, 1.25, 1.1);
  blossomHeadGeo.translate(0, 0.22, 0);

  const blossomEmeraldMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#010205'),
      fog: false,
    }),
  );
  const blossomTealMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#010205'),
      fog: false,
    }),
  );

  const blossomEmeraldMesh = new THREE.InstancedMesh(
    blossomHeadGeo,
    blossomEmeraldMat,
    blossomCountPerType,
  );
  const blossomTealMesh = new THREE.InstancedMesh(
    blossomHeadGeo,
    blossomTealMat,
    blossomCountPerType,
  );

  function populateBlossoms(mesh: THREE.InstancedMesh, seedOffset: number) {
    let placed = 0;
    let attempt = 0;
    while (placed < blossomCountPerType && attempt < 350) {
      attempt++;
      const angle = (attempt * 1.618033 + seedOffset) * Math.PI * 2;
      const rad = 2.8 + ((attempt * 13) % 165) * 0.1;
      const bx = Math.cos(angle) * rad;
      const bz = Math.sin(angle) * rad;

      const distPlinth = Math.hypot(bx, bz);
      const distPond = Math.hypot(bx - 4.8, bz - 4.2);
      const distBench = Math.hypot(bx - 1.8, bz - 2.2);
      if (distPlinth < 2.4 || distPond < 5.5 || distBench < 1.5) continue;

      const sc = 0.75 + (attempt % 5) * 0.12;
      dummyPos.set(bx, 0.0, bz);
      dummyQuat.setFromAxisAngle(upAxis, angle);
      dummyScale.set(sc, sc, sc);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      mesh.setMatrixAt(placed, dummyMatrix);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
  }

  populateBlossoms(blossomEmeraldMesh, 0.15);
  populateBlossoms(blossomTealMesh, 0.55);
  chamberGroup.add(blossomEmeraldMesh, blossomTealMesh);

  const darkVoidCol = new THREE.Color('#010205');
  const grassNightCol = new THREE.Color('#0a4229');
  const emeraldBlossomCol = new THREE.Color('#15803d');
  const tealBlossomCol = new THREE.Color('#0f766e');

  function setFloraReveal(revealAlpha: number, pulse: number) {
    const a = THREE.MathUtils.clamp(revealAlpha, 0, 1);
    grassTuftMat.color.lerpColors(darkVoidCol, grassNightCol, a * 0.85);
    blossomEmeraldMat.color.lerpColors(
      darkVoidCol,
      emeraldBlossomCol,
      a * pulse * 0.85,
    );
    blossomTealMat.color.lerpColors(
      darkVoidCol,
      tealBlossomCol,
      a * pulse * 0.85,
    );
  }

  // ----------------------------------------------------------------------------
  // 4. AURORA REFLECTION POND & FISH (SECTION 17 & 18C)
  // ----------------------------------------------------------------------------
  const pondCenter = new THREE.Vector3(4.8, 0.04, 4.2);
  const pondRadius = 5.2;

  const pondWaterGeo = tracker.trackGeo(
    new THREE.CircleGeometry(pondRadius, 48),
  );
  pondWaterGeo.rotateX(-Math.PI / 2);

  // Lightweight atmospheric pond reflection responding in sync with the Aurora (Section 17)
  // Receives green reflection, teal reflection, and very subtle violet reflection with tiny water ripples.
  // Strictly clamped in Linear-sRGB so it never glows white.
  const pondWaterMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uAuroraIntensity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uReveal;
        uniform float uAuroraIntensity;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          float r = length(vUv);

          // Tiny water ripples disturbing the reflection
          float ripple1 = sin(r * 26.0 - uTime * 1.8) * 0.018;
          float ripple2 = cos(vUv.x * 32.0 + vUv.y * 28.0 + uTime * 1.3) * 0.012;
          vec2 warpedUv = vUv + vec2(ripple1 + ripple2, ripple1 - ripple2);

          // Slow drifting Aurora curtain bands reflected in the water
          float curtainWave = sin(warpedUv.x * 2.6 - uTime * 0.08 + sin(warpedUv.y * 2.2 + uTime * 0.05) * 1.1);
          float bandMask1 = exp(-pow((warpedUv.y - 0.12 - curtainWave * 0.28) * 2.8, 2.0));
          float bandMask2 = exp(-pow((warpedUv.y + 0.22 + curtainWave * 0.22) * 3.4, 2.0));

          float rayStriation = noise(vec2(warpedUv.x * 9.5 + uTime * 0.06, warpedUv.y * 2.0));

          // Linear-sRGB dark night water + natural green, teal, and subtle violet reflections
          vec3 darkNightWater   = vec3(0.002, 0.007, 0.014);
          vec3 greenReflection  = vec3(0.008, 0.19, 0.042);
          vec3 tealReflection   = vec3(0.007, 0.12, 0.095);
          vec3 violetReflection = vec3(0.022, 0.010, 0.055);

          vec3 reflCol = greenReflection * (bandMask1 * (0.55 + 0.45 * rayStriation));
          reflCol += tealReflection * (bandMask2 * 0.55);
          reflCol += violetReflection * (bandMask2 * (1.0 - rayStriation) * 0.25);

          // Soft shoreline edge darkening
          float edgeFade = 1.0 - smoothstep(0.75, 1.0, r) * 0.6;
          vec3 waterCol = darkNightWater + reflCol * uAuroraIntensity * edgeFade;

          // Anti-white safety clamp
          waterCol = min(waterCol, vec3(0.035, 0.24, 0.12));

          vec3 finalCol = mix(vec3(0.001, 0.002, 0.005), waterCol, uReveal);
          gl_FragColor = vec4(finalCol, 0.94);
        }
      `,
    }),
  );

  const pondMesh = new THREE.Mesh(pondWaterGeo, pondWaterMat);
  pondMesh.position.copy(pondCenter);
  chamberGroup.add(pondMesh);

  // Dark mossy stone shoreline rim (slightly illuminated by soft green aurora ambient)
  const riverJadeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#091e18'),
      roughness: 0.62,
      metalness: 0.08,
      emissive: new THREE.Color('#064e3b'),
      emissiveIntensity: 0.0,
      fog: false,
    }),
  );
  const mossSlateMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c1920'),
      roughness: 0.82,
      metalness: 0.04,
      emissive: new THREE.Color('#064e3b'),
      emissiveIntensity: 0.0,
      fog: false,
    }),
  );

  const pondRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(pondRadius, 0.28, 8, 40),
  );
  pondRimGeo.rotateX(Math.PI / 2);
  const pondRimMesh = new THREE.Mesh(pondRimGeo, riverJadeMat);
  pondRimMesh.position.copy(pondCenter);
  pondRimMesh.position.y += 0.05;
  chamberGroup.add(pondRimMesh);

  // Colorful playful fish gliding beneath the Aurora reflection (Section 18C)
  const fishCount = 6;
  const fishGroup = new THREE.Group();
  fishGroup.position.copy(pondCenter);
  chamberGroup.add(fishGroup);

  const fishBodyGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.38, 8));
  fishBodyGeo.rotateZ(-Math.PI / 2);
  const fishTailGeo = tracker.trackGeo(new THREE.BufferGeometry());
  const tailVerts = new Float32Array([
    -0.19, 0, 0, -0.32, 0.1, 0, -0.32, -0.1, 0,
  ]);
  fishTailGeo.setAttribute('position', new THREE.BufferAttribute(tailVerts, 3));
  fishTailGeo.computeVertexNormals();
  tracker.trackGeo(fishTailGeo);

  const fishColors = [
    new THREE.Color('#10b981'), // Emerald
    new THREE.Color('#14b8a6'), // Teal
    new THREE.Color('#d97706'), // Warm Amber Gold
    new THREE.Color('#0ea5e9'), // Deep Sky Cyan
    new THREE.Color('#e11d48'), // Deep Coral Rose
    new THREE.Color('#22c55e'), // Jade Green
  ];

  interface FishInstance {
    group: THREE.Group;
    tailMesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    baseRadius: number;
    speed: number;
    phase: number;
    depthY: number;
  }

  const fishInstances: FishInstance[] = [];

  for (let f = 0; f < fishCount; f++) {
    const fMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: fishColors[f],
        transparent: true,
        opacity: 0.0,
        fog: false,
      }),
    );

    const fRoot = new THREE.Group();
    const fBody = new THREE.Mesh(fishBodyGeo, fMat);
    const fTail = new THREE.Mesh(fishTailGeo, fMat);
    fRoot.add(fBody, fTail);
    fishGroup.add(fRoot);

    fishInstances.push({
      group: fRoot,
      tailMesh: fTail,
      mat: fMat,
      baseRadius: 1.15 + (f % 3) * 0.95 + f * 0.28,
      speed: 0.38 + (f % 2) * 0.18,
      phase: (f * Math.PI * 2) / fishCount,
      depthY: 0.015,
    });
  }

  // ----------------------------------------------------------------------------
  // 5. ROMANTIC STONE BENCH BESIDE THE POND
  // ----------------------------------------------------------------------------
  const benchPos = new THREE.Vector3(1.8, 0, 2.2);
  const benchGroup = new THREE.Group();
  benchGroup.position.copy(benchPos);
  benchGroup.rotation.y = Math.PI * 0.28;
  chamberGroup.add(benchGroup);

  const benchStoneGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.72, 0.85, 0.36, 12),
  );
  benchStoneGeo.translate(0, 0.18, 0);
  const benchSlabGeo = tracker.trackGeo(
    new THREE.BoxGeometry(2.1, 0.14, 0.82),
  );
  benchSlabGeo.translate(0, 0.42, 0);

  const benchL = new THREE.Mesh(benchStoneGeo, mossSlateMat);
  benchL.position.x = -0.65;
  const benchR = new THREE.Mesh(benchStoneGeo, mossSlateMat);
  benchR.position.x = 0.65;
  const benchSlab = new THREE.Mesh(benchSlabGeo, riverJadeMat);
  benchGroup.add(benchL, benchR, benchSlab);

  // ----------------------------------------------------------------------------
  // 6. EXISTING SKY DOME & CONTAINED 5-LAYER PROCEDURAL AURORA VOLUME
  // ----------------------------------------------------------------------------
  const domeGroup = new THREE.Group();
  domeGroup.name = 'ExistingUndergroundSkyDome';
  chamberGroup.add(domeGroup);

  // 6A. Existing Sky Dome Boundary (r = 22.5m)
  // Deep navy zenith, dark blue mid-sky, subtle purple-blue horizon, very low ambient brightness (Section 16)
  const domeShellGeo = tracker.trackGeo(
    new THREE.SphereGeometry(
      DOME_RADIUS,
      72,
      48,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55,
    ),
  );

  const domeShellMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
        uStarIntensity: { value: 0 },
        uSkyAwaken: { value: 0 },
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vLocalPos;
        uniform float uTime;
        uniform float uStarIntensity;
        uniform float uSkyAwaken;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec3 dir = normalize(vLocalPos);
          float elev = clamp(dir.y, 0.0, 1.0);
          float angle = atan(dir.z, dir.x);

          // Linear-sRGB deep night sky (Section 16: deep navy, dark blue, subtle purple-blue horizon)
          vec3 pitchVoid     = vec3(0.001, 0.002, 0.005);
          vec3 deepNavyZenith = vec3(0.002, 0.005, 0.015);
          vec3 darkBlueMid    = vec3(0.004, 0.009, 0.024);
          vec3 purpleBlueHorz = vec3(0.007, 0.008, 0.022);

          vec3 nightSky = mix(
            purpleBlueHorz,
            mix(darkBlueMid, deepNavyZenith, smoothstep(0.18, 0.78, elev)),
            smoothstep(0.0, 0.25, elev)
          );

          vec3 skyCol = mix(pitchVoid, nightSky, uSkyAwaken);

          // Crisp, restrained night stars inside the sky dome
          if (uStarIntensity > 0.01 && elev > 0.05) {
            vec2 starCell = floor(vec2((angle + 3.14159265) * 34.0, elev * 105.0));
            float sSeed = hash(starCell);
            if (sSeed > 0.968) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 1.8 + sSeed * 110.0);
              float starBri = twinkle * uStarIntensity * smoothstep(0.05, 0.20, elev) * 0.22;
              skyCol += vec3(0.65, 0.80, 0.95) * starBri;
            }
          }

          gl_FragColor = vec4(skyCol, 1.0);
        }
      `,
    }),
  );

  const domeShellMesh = new THREE.Mesh(domeShellGeo, domeShellMat);
  domeShellMesh.position.y = -0.2;
  domeShellMesh.renderOrder = 1;
  domeGroup.add(domeShellMesh);

  // 6B. Contained 5-Layer Procedural Aurora Volume (Sections 1, 2, 3, 4, 5, 6, 7, 13, 14, 18B)
  // Architecture:
  // AuroraVolume
  //  ├── Layer 1: DeepGreenBackCurtain (r = 19.3m, very slow, very low opacity, deep green)
  //  ├── Layer 2: GreenCurtain (r = 18.2m, slow, medium opacity, primary emerald green)
  //  ├── Layer 3: TealCurtain (r = 17.1m, slow, higher fold opacity, green + teal)
  //  ├── Layer 4: CyanSecondaryLayer (r = 16.0m, slow opposite drift, low opacity, soft cyan-green)
  //  └── Layer 5: VerySubtleVioletLayer (r = 15.0m, very slow, extremely low opacity, subtle lower violet + green)
  const auroraVolumeGroup = new THREE.Group();
  auroraVolumeGroup.name = 'AuroraVolume';
  domeGroup.add(auroraVolumeGroup);

  const auroraVertexShader = `
    varying vec2 vUv;
    varying float vRadialFactor;
    uniform float uTime;
    uniform float uDriftSpeed;
    uniform float uNoiseScale;
    uniform float uLayerPhase;
    uniform float uMaxSafeRadius;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Slow organic horizontal curtain folding in world space
      float arcPhase = uv.x * 6.2831853 * uNoiseScale + uLayerPhase;
      float slowTime = uTime * uDriftSpeed;

      float broadFold = sin(arcPhase * 0.65 + slowTime * 1.2) * 0.52
                      + cos(arcPhase * 1.35 - slowTime * 0.85) * 0.32;
      float fineFold  = sin(arcPhase * 2.8 + slowTime * 1.9 + uv.y * 2.2) * 0.16;

      // Curtain folds are strongest in the lower-to-mid curtain body
      float foldEnvelope = smoothstep(0.0, 0.25, uv.y) * (1.0 - uv.y * 0.35);
      float radialOffset = (broadFold + fineFold) * foldEnvelope;

      vec2 horizDir = normalize(pos.xz + vec2(0.0001));
      pos.x += horizDir.x * radialOffset;
      pos.z += horizDir.y * radialOffset;
      pos.y += sin(arcPhase * 0.9 + slowTime) * 0.18 * foldEnvelope;

      // STRICT DOME CONTAINMENT (Section 7):
      // Never allow any procedural vertex displacement to exceed uMaxSafeRadius (19.8m < 22.5m dome)
      float distFromDomeCenter = length(pos);
      if (distFromDomeCenter > uMaxSafeRadius) {
        pos *= (uMaxSafeRadius / distFromDomeCenter);
      }
      vRadialFactor = distFromDomeCenter / uMaxSafeRadius;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const auroraFragmentShader = `
    varying vec2 vUv;
    varying float vRadialFactor;

    uniform float uTime;
    uniform float uReveal;
    uniform float uLayerOpacity;
    uniform float uDriftSpeed;
    uniform float uNoiseScale;
    uniform float uLayerPhase;
    uniform vec3 uPrimaryCol;
    uniform vec3 uSecondaryCol;
    uniform vec3 uFringeCol;
    uniform float uFringeStrength;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = rot * p * 2.03 + vec2(17.3, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      if (uReveal <= 0.001) discard;

      // 1. Irregular Horizontal Curtain Envelope & Darker Sky Gaps (Section 6)
      // Fade every geometric boundary. Without this, the rectangular
      // curtain footprint can become visible for a frame as transparent
      // sorting/depth changes, producing the reported white-box blink.
      float horizEdgeFade =
        smoothstep(0.0, 0.12, vUv.x) *
        smoothstep(1.0, 0.88, vUv.x);
      float verticalEdgeFade =
        smoothstep(0.0, 0.055, vUv.y) *
        smoothstep(1.0, 0.82, vUv.y);
      float radialEdgeFade =
        1.0 - smoothstep(0.84, 1.0, vRadialFactor);
      float boundaryFade = horizEdgeFade * verticalEdgeFade * radialEdgeFade;

      float slowDrift = uTime * uDriftSpeed;
      float arcCoord = vUv.x * uNoiseScale * 3.2 + uLayerPhase;

      // Domain-warped curtain folds & natural darker gaps
      float warp = fbm(vec2(arcCoord * 0.55 + slowDrift * 0.7, vUv.y * 0.8 - slowDrift * 0.35));
      float warpedArc = arcCoord + (warp - 0.5) * 1.65;

      float macroCurtain = fbm(vec2(warpedArc * 0.85 - slowDrift * 0.45, vUv.y * 0.45));
      // Creates darker atmospheric gaps between luminous curtain ribbons
      float gapMask = smoothstep(0.26, 0.68, macroCurtain);

      // 2. Anisotropic Magnetic Field Striations / Tall Vertical Rays (Section 4 & 18B.2)
      // 12:1 vertical stretch along magnetic field lines with slow vertical rise
      float verticalRise = uTime * 0.022;
      float rayNoise1 = noise(vec2(warpedArc * 8.5 + slowDrift * 1.1, vUv.y * 0.75 - verticalRise));
      float rayNoise2 = noise(vec2(warpedArc * 16.0 - slowDrift * 0.8, vUv.y * 1.35 - verticalRise * 1.4));
      float verticalRays = smoothstep(0.22, 0.88, rayNoise1 * 0.62 + rayNoise2 * 0.38);

      // Narrow brighter curtain fold ridges
      float foldRidge = pow(verticalRays, 1.85) * smoothstep(0.45, 0.82, macroCurtain);

      // 3. Asymmetric Vertical Profile (Section 18B.1)
      // Crisp, luminous lower border + long exponential upward ray decay
      float lowerWarp = (warp - 0.5) * 0.06;
      float yShifted = clamp(vUv.y + lowerWarp, 0.0, 1.0);
      float lowerCutoff = smoothstep(0.06, 0.20, yShifted);
      float upperDecay  = pow(1.0 - yShifted, 2.2);
      float lowerEdgeBright = exp(-pow((yShifted - 0.17) * 7.0, 2.0)) * 0.24;

      float verticalProfile = lowerCutoff * (upperDecay + lowerEdgeBright);

      // Extremely subtle slow atmospheric breathing (Section 4)
      float slowPulse = 0.90 + 0.10 * sin(uTime * 0.28 + uLayerPhase + vUv.x * 2.5);

      float density = boundaryFade * gapMask * (0.38 + 0.62 * verticalRays + foldRidge * 0.45) * verticalProfile * slowPulse;

      // Progressive reveal from upper sky across the curtain
      float revealMask = smoothstep(0.0, 1.0, uReveal * 1.15 - (1.0 - vUv.y) * 0.15);
      float alpha = clamp(density * uLayerOpacity * revealMask, 0.0, 0.42);
      alpha *= boundaryFade;

      if (boundaryFade <= 0.002 || alpha < 0.002) discard;

      // 4. Natural Aurora Color Hierarchy in Linear-sRGB (Sections 3, 12, 13, 18B.3)
      // Altitude & density color mapping:
      // - Primary: deep aurora green -> emerald green -> soft pale green in narrow fold cores
      // - Secondary: teal / cyan-green in upper/secondary folds
      // - Very subtle: blue-violet trace at lowest ionization fringe (vUv.y < 0.14)
      vec3 baseGreen = mix(uPrimaryCol, uSecondaryCol, smoothstep(0.22, 0.75, yShifted) * 0.65 + (1.0 - verticalRays) * 0.25);

      // Slightly brighter emerald/pale-green highlight on dense narrow fold cores (never white!)
      vec3 emeraldCore = vec3(0.026, 0.52, 0.115);
      vec3 col = mix(baseGreen, emeraldCore, clamp(foldRidge * 0.65 + lowerEdgeBright * 0.5, 0.0, 0.75));

      // Subtle lower-altitude violet fringe (only at vUv.y < 0.15)
      float fringeMask = exp(-pow((yShifted - 0.10) * 16.0, 2.0)) * uFringeStrength;
      col = mix(col, uFringeCol, clamp(fringeMask, 0.0, 0.45));

      // STRICT ANTI-WHITE CLAMP (Section 3, 12, 18B.3):
      // Prevents ACES tone-mapping desaturation or bloom from turning the Aurora white
      col.r = min(col.r, 0.055);
      col.g = min(col.g, 0.46);
      col.b = min(col.b, 0.22);

      gl_FragColor = vec4(col, alpha);
    }
  `;

  interface AuroraLayerSpec {
    name: string;
    radius: number;
    azimuthStart: number;
    azimuthSpan: number;
    elevMinDeg: number;
    elevMaxDeg: number;
    driftSpeed: number;
    noiseScale: number;
    layerPhase: number;
    layerOpacity: number;
    primaryCol: THREE.Color; // Linear-sRGB
    secondaryCol: THREE.Color; // Linear-sRGB
    fringeCol: THREE.Color; // Linear-sRGB
    fringeStrength: number;
    renderOrder: number;
  }

  // 5 Contained Atmospheric Layers (Section 2 & Section 5)
  // Colors specified directly in Linear-sRGB for accurate ShaderMaterial output
  const layerSpecs: AuroraLayerSpec[] = [
    {
      // Layer 1: Deep green, very low opacity, very slow background veil
      name: 'DeepGreenBackCurtain',
      radius: 19.3,
      azimuthStart: -Math.PI * 0.78,
      azimuthSpan: Math.PI * 1.56,
      elevMinDeg: 10,
      elevMaxDeg: 48,
      driftSpeed: 0.025,
      noiseScale: 1.5,
      layerPhase: 0.4,
      layerOpacity: 0.25,
      primaryCol: new THREE.Color().setRGB(0.005, 0.21, 0.036),
      secondaryCol: new THREE.Color().setRGB(0.007, 0.26, 0.065),
      fringeCol: new THREE.Color().setRGB(0.032, 0.016, 0.095),
      fringeStrength: 0.15,
      renderOrder: 10,
    },
    {
      // Layer 2: Primary Emerald Green Curtain, medium opacity, slow movement
      name: 'GreenCurtain',
      radius: 18.2,
      azimuthStart: -Math.PI * 0.68,
      azimuthSpan: Math.PI * 1.38,
      elevMinDeg: 9,
      elevMaxDeg: 45,
      driftSpeed: 0.042,
      noiseScale: 2.2,
      layerPhase: 1.7,
      layerOpacity: 0.46,
      primaryCol: new THREE.Color().setRGB(0.011, 0.44, 0.085),
      secondaryCol: new THREE.Color().setRGB(0.012, 0.34, 0.12),
      fringeCol: new THREE.Color().setRGB(0.038, 0.018, 0.11),
      fringeStrength: 0.22,
      renderOrder: 11,
    },
    {
      // Layer 3: Green + Teal Curtain, higher fold opacity, slow counter-drift
      name: 'TealCurtain',
      radius: 17.1,
      azimuthStart: -Math.PI * 0.56,
      azimuthSpan: Math.PI * 1.24,
      elevMinDeg: 11,
      elevMaxDeg: 43,
      driftSpeed: -0.036,
      noiseScale: 2.7,
      layerPhase: 3.1,
      layerOpacity: 0.42,
      primaryCol: new THREE.Color().setRGB(0.012, 0.4, 0.095),
      secondaryCol: new THREE.Color().setRGB(0.012, 0.27, 0.175),
      fringeCol: new THREE.Color().setRGB(0.04, 0.018, 0.115),
      fringeStrength: 0.25,
      renderOrder: 12,
    },
    {
      // Layer 4: Soft Cyan-Green Secondary Layer, low opacity, different movement direction
      name: 'CyanSecondaryLayer',
      radius: 16.0,
      azimuthStart: -Math.PI * 0.48,
      azimuthSpan: Math.PI * 1.08,
      elevMinDeg: 13,
      elevMaxDeg: 44,
      driftSpeed: 0.031,
      noiseScale: 2.4,
      layerPhase: 4.5,
      layerOpacity: 0.22,
      primaryCol: new THREE.Color().setRGB(0.012, 0.31, 0.14),
      secondaryCol: new THREE.Color().setRGB(0.014, 0.26, 0.21),
      fringeCol: new THREE.Color().setRGB(0.035, 0.018, 0.105),
      fringeStrength: 0.18,
      renderOrder: 13,
    },
    {
      // Layer 5: Very Subtle Violet + Deep Green Layer, extremely low opacity, very slow
      name: 'VerySubtleVioletLayer',
      radius: 15.0,
      azimuthStart: -Math.PI * 0.42,
      azimuthSpan: Math.PI * 0.94,
      elevMinDeg: 8,
      elevMaxDeg: 36,
      driftSpeed: -0.022,
      noiseScale: 1.9,
      layerPhase: 5.8,
      layerOpacity: 0.14,
      primaryCol: new THREE.Color().setRGB(0.01, 0.28, 0.07),
      secondaryCol: new THREE.Color().setRGB(0.028, 0.08, 0.13),
      fringeCol: new THREE.Color().setRGB(0.048, 0.02, 0.135),
      fringeStrength: 0.65,
      renderOrder: 14,
    },
  ];

  const auroraLayerMaterials: THREE.ShaderMaterial[] = [];

  for (let i = 0; i < layerSpecs.length; i++) {
    const spec = layerSpecs[i];
    const geo = tracker.trackGeo(
      createContainedSphericalCurtainGeometry(
        spec.radius,
        spec.azimuthStart,
        spec.azimuthSpan,
        THREE.MathUtils.degToRad(spec.elevMinDeg),
        THREE.MathUtils.degToRad(spec.elevMaxDeg),
        96,
        28,
      ),
    );

    // NormalBlending (Section 14 & 18B.4) — prevents additive white blowout
    const mat = tracker.trackMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        // Keep depthTest enabled so foreground characters, bench, and plinth occlude the sky behind them,
        // while depthWrite: false ensures the 5 Aurora layers never occlude each other.
        depthTest: true,
        // The camera is inside the spherical curtain, so only inward-facing
        // surfaces are needed. This also avoids the two-pass DoubleSide
        // transparency artifacts that can produce flashing patches.
        side: THREE.BackSide,
        forceSinglePass: true,
        blending: THREE.NormalBlending,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uLayerOpacity: { value: spec.layerOpacity },
          uDriftSpeed: { value: spec.driftSpeed },
          uNoiseScale: { value: spec.noiseScale },
          uLayerPhase: { value: spec.layerPhase },
          uMaxSafeRadius: { value: SAFE_AURORA_MAX_RADIUS },
          uPrimaryCol: { value: spec.primaryCol },
          uSecondaryCol: { value: spec.secondaryCol },
          uFringeCol: { value: spec.fringeCol },
          uFringeStrength: { value: spec.fringeStrength },
        },
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
      }),
    );

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = spec.name;
    mesh.renderOrder = spec.renderOrder;
    auroraVolumeGroup.add(mesh);
    auroraLayerMaterials.push(mat);
  }

  function setAuroraVolumeReveal(reveal: number, elapsedTime: number) {
    const clamped = THREE.MathUtils.clamp(reveal, 0, 1);
    for (let i = 0; i < auroraLayerMaterials.length; i++) {
      auroraLayerMaterials[i].uniforms.uReveal.value = clamped;
      auroraLayerMaterials[i].uniforms.uTime.value = elapsedTime;
    }
  }

  // ----------------------------------------------------------------------------
  // 7. SUBTLE ENVIRONMENT LIGHTING (SECTION 18 & 18C)
  // ----------------------------------------------------------------------------
  // Soft green ambient contribution + subtle green/teal rim on characters & rocks (scene stays dark)
  const auroraLight = new THREE.PointLight('#0ca652', 0.0, 28.0, 1.5);
  auroraLight.position.set(0, 11.0, 4.0);
  chamberGroup.add(auroraLight);

  const characterGreenRimLight = new THREE.PointLight('#0d9488', 0.0, 9.0, 1.8);
  characterGreenRimLight.position.set(2.2, 2.2, 3.6);
  chamberGroup.add(characterGreenRimLight);

  const warmSilhouetteLight = new THREE.PointLight('#eab308', 0.0, 7.5, 2.0);
  warmSilhouetteLight.position.set(0, 2.3, 0);
  chamberGroup.add(warmSilhouetteLight);

  // ----------------------------------------------------------------------------
  // 8. PROCEDURAL STYLIZED YESHWANTH CHARACTER MODEL
  // ----------------------------------------------------------------------------
  const yeshwanthGroup = new THREE.Group();
  yeshwanthGroup.name = 'AuroraCinematicYeshwanth';
  yeshwanthGroup.visible = false;
  chamberGroup.add(yeshwanthGroup);

  const charMats: THREE.Material[] = [];
  const yeshSkinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e6bea0'),
      roughness: 0.65,
      metalness: 0.02,
      emissive: new THREE.Color('#0d9488'),
      emissiveIntensity: 0.06,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );
  const yeshHairMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1410'),
      roughness: 0.5,
      metalness: 0.06,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );
  const yeshJacketMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#162032'),
      roughness: 0.55,
      metalness: 0.08,
      emissive: new THREE.Color('#065f46'),
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );
  const yeshPantsMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0f172a'),
      roughness: 0.6,
      metalness: 0.04,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );
  const yeshGoldTrimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d97706'),
      roughness: 0.35,
      metalness: 0.65,
      emissive: new THREE.Color('#0d9488'),
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );
  const yeshBootsMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1917'),
      roughness: 0.55,
      metalness: 0.08,
      transparent: true,
      opacity: 0.0,
      fog: false,
    }),
  );

  charMats.push(
    yeshSkinMat,
    yeshHairMat,
    yeshJacketMat,
    yeshPantsMat,
    yeshGoldTrimMat,
    yeshBootsMat,
  );

  const yeshBodyGroup = new THREE.Group();
  yeshwanthGroup.add(yeshBodyGroup);

  const torsoGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.52, 0.24));
  torsoGeo.translate(0, 1.12, 0);
  const torsoMesh = new THREE.Mesh(torsoGeo, yeshJacketMat);
  yeshBodyGroup.add(torsoMesh);

  const lapelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.24, 0.04));
  lapelGeo.translate(0, 1.25, 0.125);
  const lapelMesh = new THREE.Mesh(lapelGeo, yeshGoldTrimMat);
  yeshBodyGroup.add(lapelMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.45, 0);
  yeshBodyGroup.add(headPivot);

  const headGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 12, 12));
  headGeo.scale(1.0, 1.15, 0.98);
  const headMesh = new THREE.Mesh(headGeo, yeshSkinMat);
  const hairGeo = tracker.trackGeo(new THREE.SphereGeometry(0.155, 12, 12));
  hairGeo.scale(1.02, 1.05, 1.02);
  hairGeo.translate(0, 0.035, -0.015);
  const hairMesh = new THREE.Mesh(hairGeo, yeshHairMat);
  headPivot.add(headMesh, hairMesh);

  const armGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.065, 0.26, 6, 8));
  armGeo.translate(0, -0.16, 0);
  const handGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 6, 6));
  handGeo.translate(0, -0.34, 0);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.25, 1.34, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, yeshJacketMat);
  const leftHandMesh = new THREE.Mesh(handGeo, yeshSkinMat);
  leftArmPivot.add(leftArmMesh, leftHandMesh);
  yeshBodyGroup.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.25, 1.34, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, yeshJacketMat);
  const rightHandMesh = new THREE.Mesh(handGeo, yeshSkinMat);
  rightArmPivot.add(rightArmMesh, rightHandMesh);
  yeshBodyGroup.add(rightArmPivot);

  const legGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.075, 0.42, 6, 8));
  legGeo.translate(0, -0.24, 0);
  const bootGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.12, 0.22));
  bootGeo.translate(0, -0.52, 0.04);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.86, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, yeshPantsMat);
  const leftBootMesh = new THREE.Mesh(bootGeo, yeshBootsMat);
  leftLegPivot.add(leftLegMesh, leftBootMesh);
  yeshBodyGroup.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.86, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, yeshPantsMat);
  const rightBootMesh = new THREE.Mesh(bootGeo, yeshBootsMat);
  rightLegPivot.add(rightLegMesh, rightBootMesh);
  yeshBodyGroup.add(rightLegPivot);

  function setYeshwanthOpacity(opacity: number) {
    for (let i = 0; i < charMats.length; i++) {
      charMats[i].opacity = opacity;
    }
  }

  /**
   * Animates subtle romantic micro-details on Yeshwanth while seated under the Aurora (Section 18C):
   * - Gentle breathing
   * - Looking up at the shifting curtains
   * - Periodically turning his head softly toward Harsha and leaning his shoulder gently toward hers
   */
  function updateYeshwanthSeatedMicroAnimation(
    elapsedTime: number,
    isProposalTurn = false,
    proposalTurnAlpha = 0,
  ) {
    const breath = Math.sin(elapsedTime * 1.55 + 0.6) * 0.008;
    yeshBodyGroup.position.y = breath;

    // Periodic gentle glance & shoulder lean toward Harsha
    const glanceWave = Math.pow(
      Math.max(0, Math.sin(elapsedTime * 0.32 - 0.4)),
      3.0,
    );
    const effectiveGlance = isProposalTurn
      ? Math.max(glanceWave, proposalTurnAlpha)
      : glanceWave;

    // Gentle shoulder lean toward Harsha (who sits at +X on the bench)
    yeshBodyGroup.rotation.z = -0.055 * effectiveGlance;

    const skyPitch = -0.26 + Math.sin(elapsedTime * 0.36) * 0.04;
    const glancePitch = -0.06;
    headPivot.rotation.x = THREE.MathUtils.lerp(
      skyPitch,
      glancePitch,
      effectiveGlance,
    );

    const skyYaw = Math.sin(elapsedTime * 0.24) * 0.1;
    const glanceYaw = 0.44; // Turning toward Harsha
    headPivot.rotation.y = THREE.MathUtils.lerp(
      skyYaw,
      glanceYaw,
      effectiveGlance,
    );
  }

  function resetUndergroundVisuals() {
    domeShellMat.uniforms.uStarIntensity.value = 0.0;
    domeShellMat.uniforms.uSkyAwaken.value = 0.0;
    setAuroraVolumeReveal(0.0, 0.0);

    meadowShaderMat.uniforms.uMeadowReveal.value = 0.0;
    meadowShaderMat.uniforms.uAuroraGlow.value = 0.0;

    pondWaterMat.uniforms.uReveal.value = 0.0;
    pondWaterMat.uniforms.uAuroraIntensity.value = 0.0;

    riverJadeMat.emissiveIntensity = 0.0;
    mossSlateMat.emissiveIntensity = 0.0;
    auroraLight.intensity = 0.0;
    characterGreenRimLight.intensity = 0.0;
    warmSilhouetteLight.intensity = 0.0;

    setFloraReveal(0.0, 1.0);
    fishInstances.forEach((f) => (f.mat.opacity = 0.0));

    yeshBodyGroup.position.set(0, 0, 0);
    yeshBodyGroup.rotation.set(0, 0, 0);
    headPivot.rotation.set(0, 0, 0);
    leftArmPivot.rotation.set(0, 0, 0);
    rightArmPivot.rotation.set(0, 0, 0);
    leftLegPivot.rotation.set(0, 0, 0);
    rightLegPivot.rotation.set(0, 0, 0);

    inviteSequenceStarted = false;
    returnWalkTimer = 0.0;

    targetLookYaw = 0;
    targetLookPitch = 0;
    currentLookYaw = 0;
    currentLookPitch = 0;

    yeshwanthGroup.visible = false;
    setYeshwanthOpacity(0.0);
    chimneyGroup.visible = false;
    chamberGroup.visible = false;
  }

  function performSkipCinematic() {
    if (state === 'IDLE' || state === 'COMPLETE') return;

    audio.stopDescentRumble(0.2);
    audio.stopRomanticAuroraPads(0.2);

    state = 'IDLE';
    stateTimer = 0.0;
    clearDialogueSequence();
    cinIsSitting = false;

    stoneElevatorGroup.position.set(
      AURORA_STONE_POS.x,
      surfaceY,
      AURORA_STONE_POS.z,
    );

    resetUndergroundVisuals();
  }

  // ----------------------------------------------------------------------------
  // 9. CUSTOM EVENT BRIDGE
  // ----------------------------------------------------------------------------
  const handleAuroraDialogueAdvance = () => {
    if (state === 'IDLE' || state === 'COMPLETE') return;
    advanceDialogueInternal();
  };

  window.addEventListener('aurora-dialogue-advance', handleAuroraDialogueAdvance);

  // ----------------------------------------------------------------------------
  // 10. PUBLIC API & STATE PROGRESSION
  // ----------------------------------------------------------------------------
  return {
    group,
    colliders,

    isNearStone(playerWorldPos: THREE.Vector3): boolean {
      const d = Math.hypot(
        playerWorldPos.x - AURORA_STONE_POS.x,
        playerWorldPos.z - AURORA_STONE_POS.z,
      );
      return d <= STONE_INTERACTION_RADIUS;
    },

    getInteractionPrompt(playerWorldPos: THREE.Vector3): string | null {
      if (state !== 'IDLE') return null;
      const d = Math.hypot(
        playerWorldPos.x - AURORA_STONE_POS.x,
        playerWorldPos.z - AURORA_STONE_POS.z,
      );
      if (d <= STONE_INTERACTION_RADIUS) {
        return 'E Enter';
      }
      return null;
    },

    triggerCinematic(
      playerWorldPos: THREE.Vector3,
      playerYaw: number,
      camPos: THREE.Vector3,
      lookPos: THREE.Vector3,
    ): boolean {
      if (state !== 'IDLE') return false;

      capturedPlayerPos.copy(playerWorldPos);
      capturedPlayerYaw = playerYaw;
      initialCamPos.copy(camPos);
      initialLookPos.copy(lookPos);

      cinPlayerPos.copy(playerWorldPos);
      cinPlayerYaw = playerYaw;
      cinCamPos.copy(camPos);
      cinLookPos.copy(lookPos);
      finalLookPos.copy(lookPos);
      cameraBlendAlpha = 1.0;
      cinIsSitting = false;

      resetUndergroundVisuals();
      chimneyGroup.visible = true;
      chamberGroup.visible = true;
      shaftMat.opacity = 1.0;

      state = 'ENTERING';
      stateTimer = 0.0;
      clearDialogueSequence();

      audio.ensureRunning();
      return true;
    },

    applyMouseLookDelta(dx: number, dy: number) {
      if (state === 'IDLE' || state === 'COMPLETE') return;
      // Do not accumulate mouse offset during final camera return so it blends cleanly back to gameplay
      if (state === 'SURFACE_REVEAL' || state === 'RESTORING') return;

      const sensitivity = 0.0024;
      targetLookYaw = THREE.MathUtils.clamp(
        targetLookYaw - dx * sensitivity,
        -MAX_LOOK_YAW,
        MAX_LOOK_YAW,
      );
      targetLookPitch = THREE.MathUtils.clamp(
        targetLookPitch - dy * sensitivity,
        MIN_LOOK_PITCH,
        MAX_LOOK_PITCH,
      );
    },

    skipCinematic() {
      performSkipCinematic();
    },

    isActive(): boolean {
      return state !== 'IDLE' && state !== 'COMPLETE';
    },

    getCurrentDialogue(): AuroraDialogueLine | null {
      return currentDialogue;
    },

    advanceDialogue(): boolean {
      if (state === 'IDLE' || state === 'COMPLETE') return false;
      return advanceDialogueInternal();
    },

    getCameraFocus(): AuroraCinematicCameraFocus | null {
      if (state === 'IDLE' || state === 'COMPLETE') return null;
      return {
        active: true,
        camWorldPos: cinCamPos,
        lookWorldPos: finalLookPos,
        blendAlpha: cameraBlendAlpha,
        playerPos: cinPlayerPos,
        playerYaw: cinPlayerYaw,
        isSitting: cinIsSitting,
      };
    },

    update(dt: number, elapsedTime: number) {
      domeShellMat.uniforms.uTime.value = elapsedTime;
      meadowShaderMat.uniforms.uTime.value = elapsedTime;
      pondWaterMat.uniforms.uTime.value = elapsedTime;
      for (let i = 0; i < auroraLayerMaterials.length; i++) {
        auroraLayerMaterials[i].uniforms.uTime.value = elapsedTime;
      }

      const blossomPulse = Math.sin(elapsedTime * 1.8) * 0.12 + 0.88;

      // Update colorful fish gliding gently toward the brightest emerald reflection zone (Section 18C)
      const reflectionAttractorX = Math.sin(elapsedTime * 0.18) * 0.85;
      const reflectionAttractorZ = 0.45 + Math.cos(elapsedTime * 0.15) * 0.65;
      for (let i = 0; i < fishInstances.length; i++) {
        const fish = fishInstances[i];
        const ang = elapsedTime * fish.speed + fish.phase;
        const fx =
          Math.cos(ang) * fish.baseRadius + reflectionAttractorX * 0.35;
        const fz =
          Math.sin(ang) * fish.baseRadius * 0.82 + reflectionAttractorZ * 0.35;
        const prevX = fish.group.position.x;
        const prevZ = fish.group.position.z;
        fish.group.position.set(fx, fish.depthY, fz);
        if (Math.hypot(fx - prevX, fz - prevZ) > 0.0001) {
          fish.group.rotation.y =
            Math.atan2(fx - prevX, fz - prevZ) - Math.PI / 2;
        }
        fish.tailMesh.rotation.y =
          Math.sin(elapsedTime * 5.5 + fish.phase) * 0.32;
      }

      if (state === 'IDLE') return;

      const prevTimer = stateTimer;
      stateTimer += dt;

      // ------------------------------------------------------------------------
      // CINEMATIC TIMELINE EXECUTION
      // ------------------------------------------------------------------------
      switch (state) {
        case 'ENTERING': {
          const u = THREE.MathUtils.smoothstep(stateTimer, 0, 2.2);
          cinCamPos.lerpVectors(
            initialCamPos,
            new THREE.Vector3(
              AURORA_STONE_POS.x,
              surfaceY + 1.85,
              AURORA_STONE_POS.z - 3.6,
            ),
            u,
          );
          cinLookPos.lerpVectors(
            initialLookPos,
            new THREE.Vector3(
              AURORA_STONE_POS.x,
              surfaceY + 1.4,
              AURORA_STONE_POS.z + 5.0,
            ),
            u,
          );

          if (stateTimer >= 2.2) {
            state = 'DESCENDING';
            stateTimer = 0.0;
            audio.startDescentRumble();
          }
          break;
        }

        case 'DESCENDING': {
          const duration = 11.5;
          const u = THREE.MathUtils.clamp(stateTimer / duration, 0, 1);
          const easeU = THREE.MathUtils.smoothstep(u, 0, 1);

          const currentY = THREE.MathUtils.lerp(
            surfaceY,
            UNDERGROUND_DEPTH_Y,
            easeU,
          );
          stoneElevatorGroup.position.y = currentY;

          const shaftFade = 1.0 - THREE.MathUtils.smoothstep(u, 0.55, 0.92);
          shaftMat.opacity = shaftFade;
          chimneyGroup.visible = shaftFade > 0.01;

          cinPlayerPos.set(
            AURORA_STONE_POS.x,
            currentY + 0.44,
            AURORA_STONE_POS.z,
          );

          cinCamPos.set(
            AURORA_STONE_POS.x + Math.sin(u * 1.5) * 0.35,
            currentY + 1.9,
            AURORA_STONE_POS.z - 3.2,
          );
          cinLookPos.set(
            AURORA_STONE_POS.x,
            currentY + 1.25,
            AURORA_STONE_POS.z + 2.0,
          );

          if (stateTimer >= duration) {
            state = 'UNDERGROUND_DARKNESS';
            stateTimer = 0.0;
            chimneyGroup.visible = false;
            audio.stopDescentRumble(1.6);
          }
          break;
        }

        case 'UNDERGROUND_DARKNESS': {
          const duration = 3.8;

          cinCamPos.set(
            AURORA_STONE_POS.x - 1.2,
            UNDERGROUND_DEPTH_Y + 1.6,
            AURORA_STONE_POS.z - 2.8,
          );
          cinLookPos.set(
            AURORA_STONE_POS.x,
            UNDERGROUND_DEPTH_Y + 1.35,
            AURORA_STONE_POS.z + 1.0,
          );

          if (stateTimer >= duration) {
            state = 'MAN_APPROACH';
            stateTimer = 0.0;
            inviteSequenceStarted = false;
            yeshwanthGroup.visible = true;
          }
          break;
        }

        case 'MAN_APPROACH': {
          const walkU = THREE.MathUtils.smoothstep(stateTimer, 0.4, 4.6);
          const opacity =
            THREE.MathUtils.smoothstep(stateTimer, 0.2, 1.8) * 0.95;
          setYeshwanthOpacity(opacity);

          warmSilhouetteLight.intensity =
            THREE.MathUtils.smoothstep(stateTimer, 0.8, 3.8) * 0.55;

          const startX = AURORA_STONE_POS.x - 0.75;
          const startZ = AURORA_STONE_POS.z - 3.2;
          const endX = AURORA_STONE_POS.x - 0.45;
          const endZ = AURORA_STONE_POS.z - 0.2;

          const currX = THREE.MathUtils.lerp(startX, endX, walkU);
          const currZ = THREE.MathUtils.lerp(startZ, endZ, walkU);
          yeshwanthGroup.position.set(
            currX - AURORA_STONE_POS.x,
            0.44,
            currZ - AURORA_STONE_POS.z,
          );
          yeshwanthGroup.rotation.y = 0.15;

          if (walkU > 0.05 && walkU < 0.95) {
            const swing = Math.sin(stateTimer * 5.0) * 0.32;
            leftLegPivot.rotation.x = swing;
            rightLegPivot.rotation.x = -swing;
          } else {
            leftLegPivot.rotation.x = 0;
            rightLegPivot.rotation.x = 0;
            yeshBodyGroup.position.y = Math.sin(elapsedTime * 1.6) * 0.008;
          }

          // Start the INVITE dialogue sequence exactly once at 3.6s
          if (stateTimer >= 3.6 && !inviteSequenceStarted) {
            inviteSequenceStarted = true;
            beginDialogueSequence('INVITE');
          }

          cinCamPos.set(
            AURORA_STONE_POS.x + 1.8,
            UNDERGROUND_DEPTH_Y + 1.65,
            AURORA_STONE_POS.z - 1.8,
          );
          cinLookPos.set(
            AURORA_STONE_POS.x - 0.2,
            UNDERGROUND_DEPTH_Y + 1.4,
            AURORA_STONE_POS.z + 0.4,
          );

          // Advance to SITTING only after INVITE has been started and all 5 lines have been completed via Enter
          if (inviteSequenceStarted && stateTimer >= 4.8 && !currentDialogue) {
            state = 'SITTING';
            stateTimer = 0.0;
          }
          break;
        }

        case 'SITTING': {
          const duration = 5.8;
          const transU = THREE.MathUtils.smoothstep(stateTimer, 0, 3.0);
          const sitU = THREE.MathUtils.smoothstep(stateTimer, 0, duration);

          domeShellMat.uniforms.uSkyAwaken.value = sitU * 0.6;
          warmSilhouetteLight.intensity = THREE.MathUtils.lerp(
            0.55,
            0.22,
            sitU,
          );

          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          cinPlayerPos.set(
            THREE.MathUtils.lerp(
              AURORA_STONE_POS.x,
              worldBenchX + 0.28,
              transU,
            ),
            UNDERGROUND_DEPTH_Y + 0.44,
            THREE.MathUtils.lerp(AURORA_STONE_POS.z, worldBenchZ, transU),
          );
          cinPlayerYaw = THREE.MathUtils.lerp(
            capturedPlayerYaw,
            Math.PI * 0.28,
            transU,
          );

          yeshwanthGroup.position.set(
            THREE.MathUtils.lerp(-0.45, benchPos.x - 0.28, transU),
            0.44,
            THREE.MathUtils.lerp(-0.2, benchPos.z, transU),
          );
          yeshwanthGroup.rotation.y = Math.PI * 0.28;

          if (transU > 0.85) {
            cinIsSitting = true;
            leftLegPivot.rotation.x = -1.45;
            rightLegPivot.rotation.x = -1.45;
            updateYeshwanthSeatedMicroAnimation(elapsedTime);
          } else {
            const walkSwing = Math.sin(stateTimer * 5.2) * 0.28;
            leftLegPivot.rotation.x = walkSwing;
            rightLegPivot.rotation.x = -walkSwing;
          }

          cinCamPos.set(
            worldBenchX - 2.8,
            UNDERGROUND_DEPTH_Y + 1.45,
            worldBenchZ - 1.8,
          );
          cinLookPos.set(
            worldBenchX + 0.8,
            UNDERGROUND_DEPTH_Y + 2.2,
            worldBenchZ + 1.8,
          );

          if (stateTimer >= duration) {
            state = 'SKY_REVEAL';
            stateTimer = 0.0;
            audio.startRomanticAuroraPads();
          }
          break;
        }

        case 'SKY_REVEAL': {
          const duration = 9.5;
          const starU = THREE.MathUtils.smoothstep(stateTimer, 0.5, 6.5);
          const earlyAuroraU =
            THREE.MathUtils.smoothstep(stateTimer, 2.2, duration) * 0.36;
          const earlyMeadowU =
            THREE.MathUtils.smoothstep(stateTimer, 3.0, duration) * 0.42;

          domeShellMat.uniforms.uSkyAwaken.value = THREE.MathUtils.lerp(
            0.6,
            1.0,
            starU,
          );
          domeShellMat.uniforms.uStarIntensity.value = starU;
          setAuroraVolumeReveal(earlyAuroraU, elapsedTime);

          meadowShaderMat.uniforms.uMeadowReveal.value = earlyMeadowU;
          meadowShaderMat.uniforms.uAuroraGlow.value = earlyAuroraU;
          pondWaterMat.uniforms.uReveal.value = earlyMeadowU;
          pondWaterMat.uniforms.uAuroraIntensity.value = earlyAuroraU;
          setFloraReveal(earlyMeadowU * 0.65, blossomPulse);

          auroraLight.intensity = earlyAuroraU * 0.65;
          characterGreenRimLight.intensity = earlyAuroraU * 0.45;

          updateYeshwanthSeatedMicroAnimation(elapsedTime);

          if (prevTimer < 1.2 && stateTimer >= 1.2) {
            audio.playStarChime(932.33, 0); // Bb5
          }
          if (prevTimer < 3.4 && stateTimer >= 3.4) {
            audio.playStarChime(1046.5, 0); // C6
          }
          if (prevTimer < 5.8 && stateTimer >= 5.8) {
            audio.playStarChime(1244.51, 0); // Eb6
          }

          const tiltU = THREE.MathUtils.smoothstep(stateTimer, 1.0, 8.5);
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          cinCamPos.set(
            worldBenchX - THREE.MathUtils.lerp(2.8, 3.6, tiltU),
            UNDERGROUND_DEPTH_Y + 1.35,
            worldBenchZ - THREE.MathUtils.lerp(1.8, 2.5, tiltU),
          );
          cinLookPos.set(
            worldBenchX + 1.5,
            UNDERGROUND_DEPTH_Y + THREE.MathUtils.lerp(2.2, 5.6, tiltU),
            worldBenchZ + 4.5,
          );

          if (stateTimer >= duration) {
            state = 'AURORA_REVEAL';
            stateTimer = 0.0;
          }
          break;
        }

        case 'AURORA_REVEAL': {
          const duration = 14.0;
          const u = THREE.MathUtils.smoothstep(stateTimer, 0, 10.5);
          const auroraU = THREE.MathUtils.lerp(0.36, 1.0, u);
          const meadowU = THREE.MathUtils.lerp(0.42, 1.0, u);

          setAuroraVolumeReveal(auroraU, elapsedTime);

          meadowShaderMat.uniforms.uMeadowReveal.value = meadowU;
          meadowShaderMat.uniforms.uAuroraGlow.value = auroraU;
          pondWaterMat.uniforms.uReveal.value = meadowU;
          pondWaterMat.uniforms.uAuroraIntensity.value = auroraU;
          riverJadeMat.emissiveIntensity = meadowU * 0.14;
          mossSlateMat.emissiveIntensity = meadowU * 0.1;

          setFloraReveal(meadowU, blossomPulse);
          auroraLight.intensity = auroraU * 0.65;
          characterGreenRimLight.intensity = auroraU * 0.48;

          updateYeshwanthSeatedMicroAnimation(elapsedTime);

          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;
          const panOffset =
            Math.sin((stateTimer / duration) * Math.PI) * 0.65;

          cinCamPos.set(
            worldBenchX - 3.4 + panOffset,
            UNDERGROUND_DEPTH_Y + 1.42,
            worldBenchZ - 2.6,
          );
          cinLookPos.set(
            worldBenchX + 1.8,
            UNDERGROUND_DEPTH_Y + 5.2,
            worldBenchZ + 6.5,
          );

          if (stateTimer >= duration) {
            state = 'POND_REVEAL';
            stateTimer = 0.0;
          }
          break;
        }

        case 'POND_REVEAL': {
          const duration = 8.0;
          const fishU = THREE.MathUtils.smoothstep(stateTimer, 0.5, 4.5);
          fishInstances.forEach((f) => (f.mat.opacity = fishU * 0.92));
          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime);

          if (prevTimer < 2.0 && stateTimer >= 2.0) {
            audio.playWaterRipple(1.0);
          }
          if (prevTimer < 4.8 && stateTimer >= 4.8) {
            audio.playWaterRipple(1.22);
          }

          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;
          const worldPondX = AURORA_STONE_POS.x + pondCenter.x;
          const worldPondZ = AURORA_STONE_POS.z + pondCenter.z;

          cinCamPos.set(
            worldBenchX - 1.6,
            UNDERGROUND_DEPTH_Y + 1.62,
            worldBenchZ - 0.9,
          );
          cinLookPos.set(worldPondX, UNDERGROUND_DEPTH_Y + 0.85, worldPondZ);

          if (stateTimer >= duration) {
            state = 'QUIET_AURORA';
            stateTimer = 0.0;
          }
          break;
        }

        case 'QUIET_AURORA': {
          const duration = 10.0;
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime);

          const driftAng = (stateTimer / duration) * 0.45;
          cinCamPos.set(
            worldBenchX - 3.3 * Math.cos(driftAng),
            UNDERGROUND_DEPTH_Y + 1.48,
            worldBenchZ - 3.3 * Math.sin(driftAng) - 1.2,
          );
          cinLookPos.set(
            worldBenchX + 1.2,
            UNDERGROUND_DEPTH_Y + 4.2,
            worldBenchZ + 5.0,
          );

          if (stateTimer >= duration) {
            state = 'ROMANTIC_DIALOGUE_1';
            stateTimer = 0.0;
            beginDialogueSequence('BEAUTIFUL');
          }
          break;
        }

        case 'ROMANTIC_DIALOGUE_1': {
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime);

          const sway = Math.sin(stateTimer * 0.22) * 0.35;
          cinCamPos.set(
            worldBenchX - 2.95 + sway,
            UNDERGROUND_DEPTH_Y + 1.46,
            worldBenchZ - 2.4,
          );
          cinLookPos.set(
            worldBenchX + 1.1,
            UNDERGROUND_DEPTH_Y + 3.6,
            worldBenchZ + 4.2,
          );

          if (!currentDialogue) {
            state = 'ROMANTIC_DIALOGUE_2';
            stateTimer = 0.0;
            beginDialogueSequence('WANTED_TO_SEE');
          }
          break;
        }

        case 'ROMANTIC_DIALOGUE_2': {
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime, true, 0.35);

          const sway = Math.sin(stateTimer * 0.18) * 0.3;
          cinCamPos.set(
            worldBenchX - 2.45 + sway,
            UNDERGROUND_DEPTH_Y + 1.42,
            worldBenchZ - 2.05,
          );
          cinLookPos.set(
            worldBenchX + 0.95,
            UNDERGROUND_DEPTH_Y + 2.8,
            worldBenchZ + 3.2,
          );

          if (!currentDialogue) {
            state = 'ROMANTIC_DIALOGUE_3';
            stateTimer = 0.0;
            beginDialogueSequence('SOMETHING_TO_TELL');
          }
          break;
        }

        case 'ROMANTIC_DIALOGUE_3': {
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime, true, 0.55);

          const sway = Math.sin(stateTimer * 0.16) * 0.24;
          cinCamPos.set(
            worldBenchX - 2.25 + sway,
            UNDERGROUND_DEPTH_Y + 1.4,
            worldBenchZ - 1.9,
          );
          cinLookPos.set(
            worldBenchX + 0.75,
            UNDERGROUND_DEPTH_Y + 2.35,
            worldBenchZ + 2.5,
          );

          if (!currentDialogue) {
            state = 'PROPOSAL';
            stateTimer = 0.0;
            beginDialogueSequence('PROPOSAL');
          }
          break;
        }

        case 'PROPOSAL': {
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);

          const turnU = THREE.MathUtils.smoothstep(stateTimer, 0, 1.8);
          updateYeshwanthSeatedMicroAnimation(elapsedTime, true, turnU);
          rightArmPivot.rotation.x = -turnU * 0.55;

          cinCamPos.set(
            worldBenchX - 2.1,
            UNDERGROUND_DEPTH_Y + 1.42,
            worldBenchZ - 1.85,
          );
          cinLookPos.set(
            worldBenchX + 0.6,
            UNDERGROUND_DEPTH_Y + 2.1,
            worldBenchZ + 2.2,
          );

          // The proposal is completely Enter-driven.
          // When the final line is advanced, currentDialogue becomes null.
          if (!currentDialogue) {
            state = 'EMOTIONAL_HOLD';
            stateTimer = 0.0;
          }
          break;
        }

        case 'EMOTIONAL_HOLD': {
          const duration = 12.0;
          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          setFloraReveal(1.0, blossomPulse);
          setAuroraVolumeReveal(1.0, elapsedTime);
          updateYeshwanthSeatedMicroAnimation(elapsedTime, true, 0.85);

          const panU = Math.sin((stateTimer / duration) * Math.PI) * 0.45;
          cinCamPos.set(
            worldBenchX - 2.6 + panU,
            UNDERGROUND_DEPTH_Y + 1.45,
            worldBenchZ - 2.0,
          );
          cinLookPos.set(
            worldBenchX + 0.8,
            UNDERGROUND_DEPTH_Y + 2.8,
            worldBenchZ + 3.0,
          );

          if (stateTimer >= duration) {
            state = 'RETURN_PREP';
            stateTimer = 0.0;
            returnWalkTimer = 0.0;
            beginDialogueSequence('RETURN');
          }
          break;
        }

        case 'RETURN_PREP': {
          const standU = THREE.MathUtils.smoothstep(stateTimer, 0.3, 2.2);

          // Once the player finishes pressing Enter on the RETURN lines ("Come.", "Let's go back."),
          // advance returnWalkTimer so they walk smoothly back onto the stone plinth as the realm fades.
          if (!currentDialogue) {
            returnWalkTimer += dt;
          }

          const walkDuration = 3.8;
          const walkU = THREE.MathUtils.smoothstep(
            returnWalkTimer,
            0.0,
            walkDuration,
          );

          yeshBodyGroup.position.y = 0;
          yeshBodyGroup.rotation.z = THREE.MathUtils.lerp(
            yeshBodyGroup.rotation.z,
            0,
            standU,
          );
          headPivot.rotation.x = THREE.MathUtils.lerp(
            headPivot.rotation.x,
            0,
            standU,
          );
          headPivot.rotation.y = THREE.MathUtils.lerp(
            headPivot.rotation.y,
            0,
            standU,
          );

          if (standU > 0.75) {
            cinIsSitting = false;
          }

          if (!currentDialogue && walkU > 0.05 && walkU < 0.95) {
            const swing = Math.sin(returnWalkTimer * 5.2) * 0.28;
            leftLegPivot.rotation.x = swing;
            rightLegPivot.rotation.x = -swing;
          } else {
            leftLegPivot.rotation.x = THREE.MathUtils.lerp(-1.45, 0, standU);
            rightLegPivot.rotation.x = THREE.MathUtils.lerp(-1.45, 0, standU);
          }

          // Gentle hand-offer while standing up, relaxing naturally as they step onto the stone plinth
          rightArmPivot.rotation.x = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(-0.55, -0.75, standU),
            0.0,
            walkU,
          );
          rightArmPivot.rotation.z = THREE.MathUtils.lerp(-0.28, 0.0, walkU);

          const worldBenchX = AURORA_STONE_POS.x + benchPos.x;
          const worldBenchZ = AURORA_STONE_POS.z + benchPos.z;

          cinPlayerPos.set(
            THREE.MathUtils.lerp(
              worldBenchX + 0.28,
              AURORA_STONE_POS.x + 0.25,
              walkU,
            ),
            UNDERGROUND_DEPTH_Y + 0.44,
            THREE.MathUtils.lerp(worldBenchZ, AURORA_STONE_POS.z, walkU),
          );

          yeshwanthGroup.position.set(
            THREE.MathUtils.lerp(benchPos.x - 0.28, -0.25, walkU),
            0.44,
            THREE.MathUtils.lerp(benchPos.z, 0, walkU),
          );
          yeshwanthGroup.rotation.y = THREE.MathUtils.lerp(
            Math.PI * 0.28,
            0.0,
            walkU,
          );

          // Keep the Aurora realm illuminated while the player reads RETURN dialogue,
          // then smoothly fade out to darkness as they walk onto the elevator.
          const fadeU = THREE.MathUtils.smoothstep(
            returnWalkTimer,
            0.2,
            walkDuration,
          );
          const remain = 1.0 - fadeU;
          domeShellMat.uniforms.uStarIntensity.value = remain;
          domeShellMat.uniforms.uSkyAwaken.value = remain;
          setAuroraVolumeReveal(remain, elapsedTime);
          meadowShaderMat.uniforms.uMeadowReveal.value = remain;
          meadowShaderMat.uniforms.uAuroraGlow.value = remain;
          pondWaterMat.uniforms.uReveal.value = remain;
          pondWaterMat.uniforms.uAuroraIntensity.value = remain;
          setFloraReveal(remain, blossomPulse);
          auroraLight.intensity = remain * 0.65;
          characterGreenRimLight.intensity = remain * 0.48;
          fishInstances.forEach((f) => (f.mat.opacity = remain * 0.92));

          // Gently begin decaying mouse-look offset as they return to the elevator
          targetLookYaw = THREE.MathUtils.damp(targetLookYaw, 0, 2.5, dt);
          targetLookPitch = THREE.MathUtils.damp(targetLookPitch, 0, 2.5, dt);

          cinCamPos.set(
            AURORA_STONE_POS.x - 2.8,
            UNDERGROUND_DEPTH_Y + 1.7,
            AURORA_STONE_POS.z - 2.2,
          );
          cinLookPos.set(
            AURORA_STONE_POS.x,
            UNDERGROUND_DEPTH_Y + 1.4,
            AURORA_STONE_POS.z,
          );

          if (!currentDialogue && returnWalkTimer >= walkDuration) {
            state = 'ASCENDING';
            stateTimer = 0.0;
            cinIsSitting = false;
            leftLegPivot.rotation.set(0, 0, 0);
            rightLegPivot.rotation.set(0, 0, 0);
            leftArmPivot.rotation.set(0, 0, 0);
            rightArmPivot.rotation.set(0, 0, 0);
            headPivot.rotation.set(0, 0, 0);
            yeshBodyGroup.rotation.set(0, 0, 0);
            audio.stopRomanticAuroraPads(2.2);
            audio.startAscentRumble();
            chimneyGroup.visible = true;
          }
          break;
        }

        case 'ASCENDING': {
          const duration = 12.0;
          const u = THREE.MathUtils.clamp(stateTimer / duration, 0, 1);
          const easeU = THREE.MathUtils.smoothstep(u, 0, 1);

          cinIsSitting = false;
          leftLegPivot.rotation.x = 0;
          rightLegPivot.rotation.x = 0;
          rightArmPivot.rotation.x = 0;
          rightArmPivot.rotation.z = 0;

          const currentY = THREE.MathUtils.lerp(
            UNDERGROUND_DEPTH_Y,
            surfaceY,
            easeU,
          );
          stoneElevatorGroup.position.y = currentY;
          shaftMat.opacity = THREE.MathUtils.smoothstep(u, 0.08, 0.35);

          cinPlayerPos.set(
            AURORA_STONE_POS.x + 0.25,
            currentY + 0.44,
            AURORA_STONE_POS.z,
          );
          yeshwanthGroup.position.set(
            -0.25,
            currentY - UNDERGROUND_DEPTH_Y + 0.44,
            0,
          );

          targetLookYaw = THREE.MathUtils.damp(targetLookYaw, 0, 3.0, dt);
          targetLookPitch = THREE.MathUtils.damp(targetLookPitch, 0, 3.0, dt);

          cinCamPos.set(
            AURORA_STONE_POS.x,
            currentY + 1.95,
            AURORA_STONE_POS.z - 3.4,
          );
          cinLookPos.set(
            AURORA_STONE_POS.x,
            currentY + 1.25,
            AURORA_STONE_POS.z + 2.0,
          );

          if (stateTimer >= duration) {
            state = 'SURFACE_REVEAL';
            stateTimer = 0.0;
            chimneyGroup.visible = false;
            audio.stopDescentRumble(1.5);
          }
          break;
        }

        case 'SURFACE_REVEAL': {
          const duration = 5.0;

          cinPlayerPos.set(
            AURORA_STONE_POS.x,
            surfaceY + 0.44,
            AURORA_STONE_POS.z,
          );
          cinPlayerYaw = capturedPlayerYaw;

          // Smoothly decay mouse-look offsets to zero so camera return is 100% seamless (Section 11)
          targetLookYaw = THREE.MathUtils.damp(targetLookYaw, 0, 5.0, dt);
          targetLookPitch = THREE.MathUtils.damp(targetLookPitch, 0, 5.0, dt);

          const u = THREE.MathUtils.smoothstep(stateTimer, 0, duration);
          cinCamPos.lerpVectors(
            new THREE.Vector3(
              AURORA_STONE_POS.x,
              surfaceY + 1.95,
              AURORA_STONE_POS.z - 3.4,
            ),
            initialCamPos,
            u,
          );
          cinLookPos.lerpVectors(
            new THREE.Vector3(
              AURORA_STONE_POS.x,
              surfaceY + 1.25,
              AURORA_STONE_POS.z + 2.0,
            ),
            initialLookPos,
            u,
          );

          const fadeOut = THREE.MathUtils.smoothstep(stateTimer, 2.0, 4.8);
          setYeshwanthOpacity((1.0 - fadeOut) * 0.95);

          if (stateTimer >= duration) {
            state = 'RESTORING';
            stateTimer = 0.0;
          }
          break;
        }

        case 'RESTORING': {
          state = 'IDLE';
          stateTimer = 0.0;
          cameraBlendAlpha = 0;
          clearDialogueSequence();
          resetUndergroundVisuals();
          break;
        }
      }

      // ------------------------------------------------------------------------
      // DAMPED MOUSE-LOOK CAMERA ROTATION APPLICATION (Sections 9, 10, 11)
      // ------------------------------------------------------------------------
      currentLookYaw = THREE.MathUtils.damp(
        currentLookYaw,
        targetLookYaw,
        6.5,
        dt,
      );
      currentLookPitch = THREE.MathUtils.damp(
        currentLookPitch,
        targetLookPitch,
        6.5,
        dt,
      );

      const dx = cinLookPos.x - cinCamPos.x;
      const dy = cinLookPos.y - cinCamPos.y;
      const dz = cinLookPos.z - cinCamPos.z;
      const lookDist = Math.max(0.1, Math.hypot(dx, dy, dz));

      const baseYaw = Math.atan2(dx, dz);
      const basePitch = Math.asin(
        THREE.MathUtils.clamp(dy / lookDist, -0.98, 0.98),
      );

      const combinedYaw = baseYaw + currentLookYaw;
      const combinedPitch = THREE.MathUtils.clamp(
        basePitch + currentLookPitch,
        -Math.PI * 0.42,
        Math.PI * 0.45,
      );

      finalLookPos.set(
        cinCamPos.x +
          Math.sin(combinedYaw) * Math.cos(combinedPitch) * lookDist,
        cinCamPos.y + Math.sin(combinedPitch) * lookDist,
        cinCamPos.z +
          Math.cos(combinedYaw) * Math.cos(combinedPitch) * lookDist,
      );
    },

    dispose() {
      window.removeEventListener(
        'aurora-dialogue-advance',
        handleAuroraDialogueAdvance,
      );
      audio.dispose();
      tracker.dispose();
    },
  };
}
