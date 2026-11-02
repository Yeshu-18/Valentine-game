import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';
import {
  InteractivePortraitExhibit,
  GALLERY_PLACEMENT_STORAGE_KEY,
} from './HeartGalleryPlacementTool';
import { RosePetalGeometry } from './RosePetalGeometry';

export { RosePetalGeometry };

export type Floor3ActiveCameraMode = 'none' | 'heart_gallery';

export interface Floor3CameraState {
  active: boolean;
  mode: Floor3ActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  isSitting: boolean;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
}

export interface GalleryFrameInfo {
  index: number;
  title: string;
  sub: string;
  hasCustomImage: boolean;
  customImageSrc?: string;
}

export interface CastleFloor3RoomsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  setAvatarCallbacks: (cbs: {
    setActivityPose: (pose: any) => void;
    resetNeutralPose: () => void;
    getRightHandWorldPos?: (out: THREE.Vector3) => THREE.Vector3;
    getPlayerFacingYaw?: () => number;
  }) => void;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyLookDelta: (yawDelta: number, pitchDelta: number) => void;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor3CameraState;
  selectGalleryFrame: (index: number) => void;
  setGalleryFrameImage: (frameIndex: number, imageSrc: string) => void;
  getGalleryFrames: () => readonly GalleryFrameInfo[];
  getInteractivePortraitExhibits: () => InteractivePortraitExhibit[];
  isPlayerOnIceRink: (playerPos: THREE.Vector3) => boolean;
  isSkatingModeActive: () => boolean;
  exitSkatingMode: () => void;
  constrainSkatingToRinkCurb: (
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
  ) => void;
  recordSkateBladeMark: (wx: number, wz: number, yaw: number, speed: number) => void;
  isHoldingPuppyBall: () => boolean;
  triggerSkatingJump: () => void;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ) => void;
}

interface GalleryMemory {
  title: string;
  subtitle: string;
  quote: string;
  skyTop: string;
  skyBottom: string;
  accentColor: string;
  customImage: HTMLImageElement | null;
  customImageUrl: string | null;
}

type PuppyBehaviorState = 'REST' | 'WANDER' | 'PLAY' | 'FOLLOW_PLAYER';

type PuppyRetrievePhase = 'NONE' | 'CHASE_BALL' | 'RETURN_TO_PLAYER' | 'PLAY_BOW';

interface PuppyNpc {
  name: string;
  personality: 'energetic' | 'curious' | 'sleepy' | 'playful';
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  headPivot: THREE.Group;
  tailPivot: THREE.Group;
  legFL: THREE.Group;
  legFR: THREE.Group;
  legBL: THREE.Group;
  legBR: THREE.Group;
  state: PuppyBehaviorState;
  stateTimer: number;
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
  homeLx: number;
  homeLz: number;
  yaw: number;
  speed: number;
  hopPhase: number;
  barkSparkleBoost: number;
  retrievePhase: PuppyRetrievePhase;
  playBowTimer: number;
  carryingBallIdx: number;
  followDisengageTimer: number;
}

const GALLERY_STORAGE_KEY_PREFIX = 'heart_island_gallery_frame_v1_';

// Module-scope scratch matrix & vectors (Zero Per-Frame Allocations)
const _dummy = new THREE.Object3D();
const _scratchDir = new THREE.Vector2();

function buildExtrudedHeartGeometry(
  tracker: ResourceTracker,
  scale = 1.0,
  depth = 0.14,
  bevelThickness = 0.04,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const s = scale;
  shape.moveTo(0, -0.45 * s);
  shape.bezierCurveTo(-0.55 * s, -0.1 * s, -0.58 * s, 0.42 * s, -0.28 * s, 0.48 * s);
  shape.bezierCurveTo(-0.1 * s, 0.52 * s, 0, 0.34 * s, 0, 0.22 * s);
  shape.bezierCurveTo(0, 0.34 * s, 0.1 * s, 0.52 * s, 0.28 * s, 0.48 * s);
  shape.bezierCurveTo(0.58 * s, 0.42 * s, 0.55 * s, -0.1 * s, 0, -0.45 * s);

  const geo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(shape, {
      depth: depth * s,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: bevelThickness * s,
      bevelThickness: bevelThickness * s,
    }),
  );
  geo.center();
  return geo;
}

/**
 * FLOOR 3: THE HEART & PLAY WING (Elev +10.25m)
 * Strict Spatial Hierarchy:
 *   1. HEART GALLERY (Largest — East & South-East Grand Wing, lx: +4.8..+15.0, lz: -15.0..+7.8, ~232 m²)
 *   2. ICE SKATING PALACE (Second-Largest — West Grand Wing, lx: -15.0..-3.8, lz: -15.0..+4.2, ~215 m²)
 *   3. PUPPY PLAY AREA (Third-Largest — South-Central Garden Playground, lx: -3.8..+4.8, lz: -15.0..-4.2, ~93 m²)
 *   4. PET SALON (Fourth/Smallest — North-West Luxury Miniature Suite, lx: -15.0..-9.6, lz: +4.5..+14.8, ~55 m²)
 * Connected by the open Central Royal Promenade (`lx: -3.8..+4.8, lz: -4.2..+14.8`) with zero dead ends.
 */
export function createCastleFloor3Rooms(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor3RoomsBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor3HeartAndPlayWing';
  const colliders: CircleCollider[] = [];
  const partitionMeshes: THREE.Mesh[] = [];

  const y0 = 10.25; // Floor 3 Slab Top Surface
  const floor3WorldY = baseY + y0;

  let avatarCallbacks: {
    setActivityPose: (pose: any) => void;
    resetNeutralPose: () => void;
    getRightHandWorldPos?: (out: THREE.Vector3) => THREE.Vector3;
    getPlayerFacingYaw?: () => number;
  } | null = null;
  const _handWorldScratch = new THREE.Vector3();

  let audioCtx: AudioContext | null = null;
  const playChime = (freq1 = 523.25, freq2 = 659.25) => {
    try {
      if (!audioCtx && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioCtx = new AudioCtx();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, now);
      osc.frequency.exponentialRampToValueAtTime(freq2, now + 0.18);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Ignore audio fallback
    }
  };

  const registerLocalCollider = (lx: number, lz: number, radius: number, height = 3.2) => {
    colliders.push({ x: originX + lx, z: originZ + lz, radius, y: floor3WorldY, height });
  };

  // ==========================================================================
  // SHARED LUXURY MATERIALS (Pearl, Blush Pink, Champagne Gold, Crystal Ice, Pastel Mint)
  // ==========================================================================
  const galleryRoseMarbleMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.08,
      roughness: 0.16,
      metalness: 0.08,
    }),
  );
  const crystalArchMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.28,
      transmission: 0.55,
      opacity: 0.92,
      transparent: true,
      roughness: 0.08,
      metalness: 0.1,
      ior: 1.48,
    }),
  );
  const floatingHeartCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.52,
      transmission: 0.62,
      opacity: 0.95,
      transparent: true,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1.0,
      ior: 1.52,
    }),
  );
  const iceSurfaceMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#c4b5fd'),
      emissiveIntensity: 0.16,
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transmission: 0.28,
      transparent: true,
      opacity: 0.9,
      ior: 1.31,
    }),
  );
  const iceCrystalBarrierMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f0f9ff'),
      emissive: new THREE.Color('#a5b4fc'),
      emissiveIntensity: 0.22,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const iceFountainHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f5d0fe'),
      emissive: new THREE.Color('#c084fc'),
      emissiveIntensity: 0.46,
      roughness: 0.06,
      metalness: 0.12,
      transmission: 0.58,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const pastelLawnMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d1fae5'),
      emissive: new THREE.Color('#6ee7b7'),
      emissiveIntensity: 0.06,
      roughness: 0.68,
      metalness: 0.02,
    }),
  );
  const pastelHedgeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a7f3d0'),
      emissive: new THREE.Color('#34d399'),
      emissiveIntensity: 0.05,
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  const puppyCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppySnowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffdf9'),
      roughness: 0.52,
      metalness: 0.02,
    }),
  );
  const puppyBlushMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde2e4'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppyCaramelMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5d0a9'),
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const puppyEyeNoseMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#292524'),
      roughness: 0.22,
      metalness: 0.1,
    }),
  );
  const bubbleIridescentMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fdf4ff'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.08,
      transmission: 0.7,
      transparent: true,
      opacity: 0.75,
    }),
  );

  // ==========================================================================
  // 0. FLOOR 3 CENTRAL PLAZA: SMALL ROMANTIC CRYSTAL FOUNTAIN & INLAID FLOOR INSCRIPTION
  //    ("YESHWANTH LOVES HARSHA" in real 3D extruded champagne-gold lettering on a dedicated marble band,
  //     paired with clear, reflective, gravity-flowing water and subtle impact ripples)
  //    Centered at (lx = -0.35, lz = +1.25) with generous walkable circulation to all 4 wings & stairs!
  // ==========================================================================
  const plazaFountainX = -0.35;
  const plazaFountainZ = 1.25;
  const plazaFountainGroup = new THREE.Group();
  plazaFountainGroup.name = 'Floor3RomanticCrystalFountain';
  plazaFountainGroup.position.set(plazaFountainX, y0, plazaFountainZ);
  group.add(plazaFountainGroup);

  const fountainGoldMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f7d782'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.14,
      roughness: 0.18,
      metalness: 0.88,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12,
    }),
  );

  // Dedicated Champagne-Gold Material for the Physical 3D Floor Lettering (Vivid Warm Gold, Controlled Emissive)
  const inlaidLetterGoldMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.38,
      roughness: 0.16,
      metalness: 0.88,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    }),
  );

  // Subtle Dark Plum-Bronze Contact-Shadow Plinth Material beneath each 3D Gold Letter
  const inlaidLetterShadowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d0819'),
      roughness: 0.65,
      metalness: 0.15,
    }),
  );

  const fountainSoftGlowMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
    }),
  );
  const fountainPinkGlowMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fbcfe8'),
    }),
  );

  // Shared Time Uniform for Zero-Allocation Fountain Water Shaders
  const plazaFountainWaterUniforms = {
    uTime: { value: 0.0 },
  };

  // Clear, Lightly Cool Reflective Water Surface Shader (Picks up Champagne-Gold & Pink Crystal Reflections via Fresnel)
  const fountainClearWaterSurfaceMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: plazaFountainWaterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vWorldPos;
        void main() {
          vLocalPos = position;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vLocalPos;
        varying vec3 vWorldPos;

        void main() {
          vec2 p = vLocalPos.xz;
          float r = length(p);
          float angle = atan(p.y, p.x);

          // Superposition of gentle radial waves from the center pedestal + 8 falling stream impact points (r = 1.04m)
          float centerWave = sin(r * 18.0 - uTime * 2.6) * 0.5 + 0.5;
          float crossWave = sin(r * 26.0 + cos(angle * 8.0) * 1.8 - uTime * 3.4) * 0.5 + 0.5;

          float impactWaves = 0.0;
          vec2 grad = vec2(0.0);
          for (int i = 0; i < 8; i++) {
            float iAng = float(i) * 0.78539816;
            vec2 impPos = vec2(cos(iAng), sin(iAng)) * 1.04;
            vec2 dVec = p - impPos;
            float dist = length(dVec) + 0.001;
            float w = sin(dist * 34.0 - uTime * 4.8 + float(i) * 0.9);
            float atten = exp(-dist * 3.6);
            impactWaves += (w * 0.5 + 0.5) * atten;
            grad += (dVec / dist) * cos(dist * 34.0 - uTime * 4.8 + float(i) * 0.9) * atten * 0.14;
          }

          // Perturbed water surface normal
          vec2 radialDir = p / (r + 0.001);
          grad += radialDir * cos(r * 18.0 - uTime * 2.6) * 0.06;
          vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
          vec3 V = normalize(cameraPosition - vWorldPos);

          // View-dependent Fresnel reflection
          float ndotv = max(dot(N, V), 0.0);
          float fresnel = pow(1.0 - ndotv, 2.6);

          // Clear, lightly cool base water color (NOT neon pink)
          vec3 clearCoolWater = vec3(0.84, 0.94, 0.99);
          vec3 deepBasinTint = vec3(0.76, 0.88, 0.95);
          vec3 waterBase = mix(clearCoolWater, deepBasinTint, smoothstep(0.1, 1.15, r));

          // Subtle environment reflections from the champagne-gold rim/sculpture & central pink heart crystal
          vec3 goldReflection = vec3(0.99, 0.90, 0.65);
          vec3 pinkCrystalReflection = vec3(0.97, 0.86, 0.93);
          float centerCrystalInfluence = smoothstep(0.85, 0.12, r);
          float rimGoldInfluence = smoothstep(0.75, 1.24, r) * 0.75 + 0.25 * crossWave;
          vec3 envReflection = mix(
            mix(vec3(0.92, 0.96, 1.0), goldReflection, rimGoldInfluence),
            pinkCrystalReflection,
            centerCrystalInfluence * 0.62
          );

          // Specular highlights from overhead warm palace lighting
          vec3 L1 = normalize(vec3(0.35, 0.88, 0.32));
          vec3 L2 = normalize(vec3(-0.42, 0.85, -0.30));
          vec3 H1 = normalize(L1 + V);
          vec3 H2 = normalize(L2 + V);
          float spec = pow(max(dot(N, H1), 0.0), 52.0) + pow(max(dot(N, H2), 0.0), 40.0) * 0.7;

          // Subtle caustic & ripple crest highlights
          float crestHighlight = pow(centerWave * crossWave, 2.2) * 0.18 + impactWaves * 0.12;

          vec3 finalCol = mix(waterBase, envReflection, 0.28 + fresnel * 0.56);
          finalCol += goldReflection * crestHighlight;
          finalCol += vec3(1.0, 0.98, 0.92) * spec * 0.65;

          // Mostly clear/transparent in the basin center, slightly more reflective at grazing angles & rim
          float alpha = clamp(0.54 + fresnel * 0.30 + spec * 0.25 + impactWaves * 0.08, 0.52, 0.86);
          gl_FragColor = vec4(finalCol, alpha);
        }
      `,
    }),
  );

  // Transparent, Gravity-Accelerated Flowing Water Stream Shader (No Neon Pink Tubes)
  const fountainFlowingStreamMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: plazaFountainWaterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          // vUv.x = 0 (top source) -> 1 (bottom basin impact); vUv.y = 0..1 around irregular stream profile
          float flowCoord = vUv.x * 7.5 - uTime * 4.4;
          float streak1 = sin(flowCoord + sin(vUv.y * 12.566) * 0.8) * 0.5 + 0.5;
          float streak2 = sin(flowCoord * 1.85 - uTime * 2.2 + vUv.y * 18.85) * 0.5 + 0.5;
          float rivulet = pow(streak1 * 0.65 + streak2 * 0.35, 1.4);

          // Slight breakup into fine water rivulets/droplets near the bottom impact (vUv.x > 0.72)
          float breakup = mix(1.0, 0.65 + 0.35 * streak2, smoothstep(0.68, 1.0, vUv.x));

          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - abs(dot(N, V)), 2.2);

          // Clear, lightly cool water catching warm champagne-gold & subtle crystal highlights
          vec3 clearWater = vec3(0.90, 0.96, 1.0);
          vec3 goldGlint = vec3(0.99, 0.93, 0.76);
          vec3 crystalHint = vec3(0.98, 0.90, 0.95);

          vec3 L = normalize(vec3(0.3, 0.9, 0.35));
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 36.0);

          vec3 col = mix(clearWater, crystalHint, fresnel * 0.35);
          col = mix(col, goldGlint, rivulet * 0.32 + spec * 0.55);
          col += vec3(1.0, 0.99, 0.96) * spec * 0.45;

          // Soft silhouette feathering so the stream never looks like a solid cylindrical rod
          float profileFade = sin(vUv.y * 3.14159265);
          float endFade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - 0.25 * smoothstep(0.88, 1.0, vUv.x));
          float alpha = (0.20 + rivulet * 0.26 + fresnel * 0.24 + spec * 0.28) * (0.45 + 0.55 * profileFade) * breakup * endFade;

          gl_FragColor = vec4(col, clamp(alpha, 0.08, 0.72));
        }
      `,
    }),
  );

  // Pooled Animated Concentric Water Impact Ripple Shader
  const fountainImpactRippleMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: plazaFountainWaterUniforms,
      transparent: true,
      depthWrite: false,
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
        varying vec2 vUv;
        void main() {
          vec2 centered = (vUv - 0.5) * 2.0;
          float dist = length(centered);
          if (dist > 1.0) discard;

          // Two staggered expanding concentric rings + tiny central impact highlight
          float p1 = fract(uTime * 0.85);
          float p2 = fract(uTime * 0.85 + 0.5);

          float ring1 = exp(-pow((dist - p1 * 0.92) * 16.0, 2.0)) * (1.0 - p1) * smoothstep(0.0, 0.15, p1);
          float ring2 = exp(-pow((dist - p2 * 0.92) * 16.0, 2.0)) * (1.0 - p2) * smoothstep(0.0, 0.15, p2);
          float centerFoam = exp(-dist * 9.5) * (0.35 + 0.15 * sin(uTime * 9.0));

          float intensity = ring1 + ring2 + centerFoam;
          vec3 col = mix(vec3(0.90, 0.97, 1.0), vec3(1.0, 0.96, 0.86), 0.45);
          float alpha = clamp(intensity * 0.58 * (1.0 - dist * 0.35), 0.0, 0.65);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );

  // --- 0.1 DEDICATED CIRCULAR MARBLE INSCRIPTION BAND & REAL 3D EXTRUDED GOLD LETTERING ("YESHWANTH LOVES HARSHA") ---
  // High-resolution 2048x2048 circular floor composition with a dedicated, uncluttered deep rose-plum royal marble band
  // (r = 1.62m .. 2.34m) that gives high contrast to the large 3D extruded champagne-gold letters.
  const createPlazaFloorInscriptionTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const C = 1024;
      ctx.clearRect(0, 0, 2048, 2048);

      // Outer blush-pearl palace floor transition (990px => 2.68m radius)
      const bgGrad = ctx.createRadialGradient(C, C, 480, C, C, 995);
      bgGrad.addColorStop(0, '#fdf2f8');
      bgGrad.addColorStop(0.55, '#fce7f3');
      bgGrad.addColorStop(0.94, '#fbcfe8');
      bgGrad.addColorStop(1, 'rgba(251, 207, 232, 0.0)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(C, C, 995, 0, Math.PI * 2);
      ctx.fill();

      // Dedicated Clean Royal Rose-Plum Marble Band for "YESHWANTH LOVES HARSHA"
      // World radius r = 1.62m .. 2.34m => pixel radius 598px .. 864px (centered at 731px = 1.98m)
      // Zero overlapping radial lines, flowers, or motifs inside this band!
      const bandGrad = ctx.createRadialGradient(C, C, 598, C, C, 864);
      bandGrad.addColorStop(0, '#4a1027');
      bandGrad.addColorStop(0.15, '#5b1633');
      bandGrad.addColorStop(0.5, '#681b3c');
      bandGrad.addColorStop(0.85, '#5b1633');
      bandGrad.addColorStop(1, '#4a1027');
      ctx.beginPath();
      ctx.arc(C, C, 864, 0, Math.PI * 2);
      ctx.arc(C, C, 598, 0, Math.PI * 2, true);
      ctx.fillStyle = bandGrad;
      ctx.fill();

      // Subtle polished marble veining inside the dark rose-plum band (kept very soft so lettering stays 100% clean)
      ctx.strokeStyle = 'rgba(251, 207, 232, 0.07)';
      ctx.lineWidth = 2.5;
      for (let v = 0; v < 16; v++) {
        const a1 = (v / 16) * Math.PI * 2;
        const a2 = a1 + 0.22;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(a1) * 615, C + Math.sin(a1) * 615);
        ctx.quadraticCurveTo(
          C + Math.cos((a1 + a2) * 0.5) * 731,
          C + Math.sin((a1 + a2) * 0.5) * 731,
          C + Math.cos(a2) * 848,
          C + Math.sin(a2) * 848,
        );
        ctx.stroke();
      }

      // Clean Champagne-Gold Border Lines framing the Dedicated Inscription Band
      [592, 604, 858, 870, 976].forEach((rPx, idx) => {
        ctx.beginPath();
        ctx.arc(C, C, rPx, 0, Math.PI * 2);
        ctx.strokeStyle = idx % 2 === 0 ? '#d97706' : '#fef08a';
        ctx.lineWidth = idx === 4 ? 8 : 4;
        ctx.stroke();
      });
    }

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };

  const plazaFloorInlayTex = createPlazaFloorInscriptionTexture();
  const plazaFloorInlayMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: plazaFloorInlayTex,
      roughness: 0.16,
      metalness: 0.18,
      transparent: true,
    }),
  );

  const plazaFloorDiscGeo = tracker.trackGeo(new THREE.PlaneGeometry(5.55, 5.55));
  plazaFloorDiscGeo.rotateX(-Math.PI / 2);
  const plazaFloorDisc = new THREE.Mesh(plazaFloorDiscGeo, plazaFloorInlayMat);
  plazaFloorDisc.position.y = 0.011;
  plazaFloorDisc.receiveShadow = true;
  plazaFountainGroup.add(plazaFloorDisc);

  // Physical 3D Concentric Champagne-Gold Border Rings framing the Dedicated Inscription Band (r = 1.62m .. 2.34m)
  // Kept strictly at the inner/outer edges of the band so no ring ever cuts through the letters
  [
    { r: 1.62, tube: 0.02, mat: fountainGoldMat },
    { r: 2.34, tube: 0.022, mat: fountainGoldMat },
    { r: 2.66, tube: 0.026, mat: fountainGoldMat },
  ].forEach(({ r, tube, mat }) => {
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(r, tube, 10, 72));
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, mat);
    ringMesh.position.y = 0.015;
    plazaFountainGroup.add(ringMesh);
  });

  // Builder for Real 3D Extruded Monumental Roman Capital Letters for "YESHWANTH LOVES HARSHA"
  // Every unique character (A, E, H, L, N, O, R, S, T, V, W, Y) is constructed as an exact 2D THREE.Shape
  // and extruded into beveled 3D geometry so the phrase is clearly readable from 6m, 8m, and 10m in 3rd-person view.
  const letterGeoCache = new Map<string, { goldGeo: THREE.BufferGeometry; shadowGeo: THREE.BufferGeometry }>();

  const createLetterShape2D = (ch: string): THREE.Shape => {
    const s = new THREE.Shape();
    switch (ch) {
      case 'Y': {
        s.moveTo(-0.14, -0.5);
        s.lineTo(0.14, -0.5);
        s.lineTo(0.14, -0.04);
        s.lineTo(0.48, 0.5);
        s.lineTo(0.2, 0.5);
        s.lineTo(0.0, 0.15);
        s.lineTo(-0.2, 0.5);
        s.lineTo(-0.48, 0.5);
        s.lineTo(-0.14, -0.04);
        s.closePath();
        break;
      }
      case 'E': {
        s.moveTo(-0.42, -0.5);
        s.lineTo(0.42, -0.5);
        s.lineTo(0.42, -0.28);
        s.lineTo(-0.16, -0.28);
        s.lineTo(-0.16, -0.1);
        s.lineTo(0.34, -0.1);
        s.lineTo(0.34, 0.1);
        s.lineTo(-0.16, 0.1);
        s.lineTo(-0.16, 0.28);
        s.lineTo(0.42, 0.28);
        s.lineTo(0.42, 0.5);
        s.lineTo(-0.42, 0.5);
        s.closePath();
        break;
      }
      case 'S': {
        // Smooth thickened S-curve polygon (24 spine samples from bottom-left terminal to top-right terminal)
        const spinePts: Array<[number, number]> = [
          [-0.38, -0.32],
          [-0.26, -0.44],
          [-0.04, -0.46],
          [0.2, -0.43],
          [0.34, -0.32],
          [0.36, -0.18],
          [0.24, -0.06],
          [0.0, 0.02],
          [-0.24, 0.1],
          [-0.35, 0.22],
          [-0.33, 0.35],
          [-0.18, 0.44],
          [0.06, 0.45],
          [0.28, 0.41],
          [0.38, 0.32],
        ];
        const halfThick = 0.115;
        const leftSide: Array<[number, number]> = [];
        const rightSide: Array<[number, number]> = [];
        for (let i = 0; i < spinePts.length; i++) {
          const prev = spinePts[Math.max(0, i - 1)];
          const next = spinePts[Math.min(spinePts.length - 1, i + 1)];
          const tx = next[0] - prev[0];
          const ty = next[1] - prev[1];
          const len = Math.hypot(tx, ty) || 1;
          const nx = -ty / len;
          const ny = tx / len;
          leftSide.push([spinePts[i][0] + nx * halfThick, spinePts[i][1] + ny * halfThick]);
          rightSide.push([spinePts[i][0] - nx * halfThick, spinePts[i][1] - ny * halfThick]);
        }
        s.moveTo(rightSide[0][0], rightSide[0][1]);
        for (let i = 1; i < rightSide.length; i++) {
          s.lineTo(rightSide[i][0], rightSide[i][1]);
        }
        for (let i = leftSide.length - 1; i >= 0; i--) {
          s.lineTo(leftSide[i][0], leftSide[i][1]);
        }
        s.closePath();
        break;
      }
      case 'H': {
        s.moveTo(-0.44, -0.5);
        s.lineTo(-0.18, -0.5);
        s.lineTo(-0.18, -0.11);
        s.lineTo(0.18, -0.11);
        s.lineTo(0.18, -0.5);
        s.lineTo(0.44, -0.5);
        s.lineTo(0.44, 0.5);
        s.lineTo(0.18, 0.5);
        s.lineTo(0.18, 0.11);
        s.lineTo(-0.18, 0.11);
        s.lineTo(-0.18, 0.5);
        s.lineTo(-0.44, 0.5);
        s.closePath();
        break;
      }
      case 'W': {
        s.moveTo(-0.56, 0.5);
        s.lineTo(-0.34, -0.5);
        s.lineTo(-0.13, -0.5);
        s.lineTo(0.0, 0.06);
        s.lineTo(0.13, -0.5);
        s.lineTo(0.34, -0.5);
        s.lineTo(0.56, 0.5);
        s.lineTo(0.34, 0.5);
        s.lineTo(0.23, -0.12);
        s.lineTo(0.09, 0.5);
        s.lineTo(-0.09, 0.5);
        s.lineTo(-0.23, -0.12);
        s.lineTo(-0.34, 0.5);
        s.closePath();
        break;
      }
      case 'A': {
        s.moveTo(-0.48, -0.5);
        s.lineTo(-0.21, -0.5);
        s.lineTo(-0.13, -0.22);
        s.lineTo(0.13, -0.22);
        s.lineTo(0.21, -0.5);
        s.lineTo(0.48, -0.5);
        s.lineTo(0.14, 0.5);
        s.lineTo(-0.14, 0.5);
        s.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-0.08, -0.02);
        hole.lineTo(0.0, 0.24);
        hole.lineTo(0.08, -0.02);
        hole.closePath();
        s.holes.push(hole);
        break;
      }
      case 'N': {
        s.moveTo(-0.44, -0.5);
        s.lineTo(-0.2, -0.5);
        s.lineTo(-0.2, 0.1);
        s.lineTo(0.2, -0.5);
        s.lineTo(0.44, -0.5);
        s.lineTo(0.44, 0.5);
        s.lineTo(0.2, 0.5);
        s.lineTo(0.2, -0.1);
        s.lineTo(-0.2, 0.5);
        s.lineTo(-0.44, 0.5);
        s.closePath();
        break;
      }
      case 'T': {
        s.moveTo(-0.14, -0.5);
        s.lineTo(0.14, -0.5);
        s.lineTo(0.14, 0.28);
        s.lineTo(0.46, 0.28);
        s.lineTo(0.46, 0.5);
        s.lineTo(-0.46, 0.5);
        s.lineTo(-0.46, 0.28);
        s.lineTo(-0.14, 0.28);
        s.closePath();
        break;
      }
      case 'L': {
        s.moveTo(-0.4, -0.5);
        s.lineTo(0.42, -0.5);
        s.lineTo(0.42, -0.27);
        s.lineTo(-0.14, -0.27);
        s.lineTo(-0.14, 0.5);
        s.lineTo(-0.4, 0.5);
        s.closePath();
        break;
      }
      case 'O': {
        s.absellipse(0, 0, 0.45, 0.5, 0, Math.PI * 2, false, 0);
        const hole = new THREE.Path();
        hole.absellipse(0, 0, 0.21, 0.28, 0, Math.PI * 2, true, 0);
        s.holes.push(hole);
        break;
      }
      case 'V': {
        s.moveTo(-0.14, -0.5);
        s.lineTo(0.14, -0.5);
        s.lineTo(0.48, 0.5);
        s.lineTo(0.21, 0.5);
        s.lineTo(0.0, -0.18);
        s.lineTo(-0.21, 0.5);
        s.lineTo(-0.48, 0.5);
        s.closePath();
        break;
      }
      case 'R':
      default: {
        s.moveTo(-0.44, -0.5);
        s.lineTo(-0.18, -0.5);
        s.lineTo(-0.18, -0.06);
        s.lineTo(-0.02, -0.06);
        s.lineTo(0.2, -0.5);
        s.lineTo(0.46, -0.5);
        s.lineTo(0.2, -0.02);
        s.lineTo(0.36, 0.06);
        s.lineTo(0.42, 0.21);
        s.lineTo(0.36, 0.38);
        s.lineTo(0.16, 0.5);
        s.lineTo(-0.44, 0.5);
        s.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-0.18, 0.11);
        hole.lineTo(-0.18, 0.31);
        hole.lineTo(0.08, 0.31);
        hole.lineTo(0.17, 0.21);
        hole.lineTo(0.08, 0.11);
        hole.closePath();
        s.holes.push(hole);
        break;
      }
    }
    return s;
  };

  const getExtrudedLetterGeometries = (ch: string) => {
    const cached = letterGeoCache.get(ch);
    if (cached) return cached;

    const shape = createLetterShape2D(ch);
    const letterW = ch === 'W' ? 0.24 : 0.19;
    const letterH = 0.42; // 42cm tall floor letters for crystal-clear readability from distance

    const goldGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.032,
        bevelEnabled: true,
        bevelThickness: 0.007,
        bevelSize: 0.005,
        bevelSegments: 2,
        curveSegments: 12,
      }),
    );
    goldGeo.scale(letterW, letterH, 1.0);

    const shadowGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.014,
        bevelSegments: 1,
        curveSegments: 10,
      }),
    );
    shadowGeo.scale(letterW, letterH, 1.0);

    const pair = { goldGeo, shadowGeo };
    letterGeoCache.set(ch, pair);
    return pair;
  };

  // Place "YESHWANTH LOVES HARSHA" on the West side (centerPhi = Math.PI * 0.92)
  // and "HARSHA LOVES YESHWANTH" on the opposite East side (centerPhi = Math.PI * 0.92 - Math.PI)
  // in matching 3D extruded champagne-gold lettering, with inlaid hearts in between both texts.
  const inscriptionRadius = 1.98;
  const primaryCenterPhi = Math.PI * 0.92;
  const oppositeCenterPhi = primaryCenterPhi - Math.PI;
  const inscriptionTotalArc = 2.42; // ~138.6 degrees per phrase, leaving clean space for the hearts in between

  const _letterBasisMat = new THREE.Matrix4();
  const _rightAxis = new THREE.Vector3();
  const _forwardAxis = new THREE.Vector3();
  const _upAxis = new THREE.Vector3(0, 1, 0);

  const placeArcInscription = (phrase: string, centerPhi: number) => {
    const charWeights = phrase
      .split('')
      .map((c) => (c === ' ' ? 0.85 : c === 'W' ? 1.24 : 1.0));
    const totalWeight = charWeights.reduce((acc, w) => acc + w, 0);
    const startPhi = centerPhi + inscriptionTotalArc * 0.5;

    let accumWeight = 0;
    for (let i = 0; i < phrase.length; i++) {
      const ch = phrase[i];
      const w = charWeights[i];
      const charCenterWeight = accumWeight + w * 0.5;
      accumWeight += w;

      if (ch === ' ') continue;

      const u = charCenterWeight / totalWeight;
      const phi = startPhi - u * inscriptionTotalArc;
      const lxPos = Math.cos(phi) * inscriptionRadius;
      const lzPos = Math.sin(phi) * inscriptionRadius;

      // Right-handed basis on the floor so a viewer standing outside the fountain looking inward
      // reads the phrase left-to-right with letter tops pointing inward toward the fountain:
      //   local +X (letter width left->right) = (+sin(phi), 0, -cos(phi))
      //   local +Y (letter height bottom->top) = (-cos(phi), 0, -sin(phi))
      //   local +Z (extrusion height)          = (0, 1, 0)
      _rightAxis.set(Math.sin(phi), 0, -Math.cos(phi));
      _forwardAxis.set(-Math.cos(phi), 0, -Math.sin(phi));
      _letterBasisMat.makeBasis(_rightAxis, _forwardAxis, _upAxis);

      const { goldGeo, shadowGeo } = getExtrudedLetterGeometries(ch);

      const shadowMesh = new THREE.Mesh(shadowGeo, inlaidLetterShadowMat);
      shadowMesh.rotation.setFromRotationMatrix(_letterBasisMat);
      shadowMesh.position.set(lxPos, 0.015, lzPos);

      const goldMesh = new THREE.Mesh(goldGeo, inlaidLetterGoldMat);
      goldMesh.rotation.setFromRotationMatrix(_letterBasisMat);
      goldMesh.position.set(lxPos, 0.024, lzPos);
      goldMesh.castShadow = true;
      goldMesh.receiveShadow = true;

      plazaFountainGroup.add(shadowMesh, goldMesh);
    }
  };

  placeArcInscription('YESHWANTH LOVES HARSHA', primaryCenterPhi);
  placeArcInscription('HARSHA LOVES YESHWANTH', oppositeCenterPhi);

  // Two Inlaid Heart Motifs in between both texts (at primaryCenterPhi ± Math.PI * 0.5)
  const floorHeartBezelGeo = buildExtrudedHeartGeometry(tracker, 0.32, 0.026, 0.009);
  floorHeartBezelGeo.rotateX(-Math.PI / 2);
  const floorHeartCrystalGeo = buildExtrudedHeartGeometry(tracker, 0.24, 0.032, 0.009);
  floorHeartCrystalGeo.rotateX(-Math.PI / 2);

  [primaryCenterPhi - Math.PI * 0.5, primaryCenterPhi + Math.PI * 0.5].forEach((heartPhi) => {
    const heartBezel = new THREE.Mesh(floorHeartBezelGeo, fountainGoldMat);
    heartBezel.position.set(
      Math.cos(heartPhi) * inscriptionRadius,
      0.018,
      Math.sin(heartPhi) * inscriptionRadius,
    );
    heartBezel.rotation.y = -heartPhi + Math.PI * 0.5;

    const heartCrystal = new THREE.Mesh(floorHeartCrystalGeo, floatingHeartCrystalMat);
    heartCrystal.position.set(
      Math.cos(heartPhi) * inscriptionRadius,
      0.022,
      Math.sin(heartPhi) * inscriptionRadius,
    );
    heartCrystal.rotation.y = -heartPhi + Math.PI * 0.5;
    plazaFountainGroup.add(heartBezel, heartCrystal);
  });

  // --- 0.1B DEDICATED ROYAL FOUNTAIN COMMEMORATIVE DEDICATION BOARDS / PLAQUES ---
  // High-contrast, illuminated, eye-level angled presentation boards mounted on the fountain rim
  // so "HARSHA LOVES YESHWANTH" & "YESHWANTH LOVES HARSHA" are 100% visible, elevated, and unmissable!
  const createFountainDedicationPlaqueTex = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 1024, 420);

      // 1. Radiant champagne-gold & soft rose enamel gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1024, 420);
      bgGrad.addColorStop(0, '#fffdf7');
      bgGrad.addColorStop(0.25, '#fef9c3');
      bgGrad.addColorStop(0.5, '#fef08a');
      bgGrad.addColorStop(0.75, '#fde68a');
      bgGrad.addColorStop(1, '#fce7f3');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(8, 8, 1008, 404);

      // 2. Chiseled Royal Gold & Ruby Inlay Borders
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 12;
      ctx.strokeRect(14, 14, 996, 392);

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 6;
      ctx.strokeRect(26, 26, 972, 368);

      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(38, 38, 948, 344);

      // 3. Ornate Corner Medallions
      [
        { x: 42, y: 42 },
        { x: 982, y: 42 },
        { x: 982, y: 378 },
        { x: 42, y: 378 },
      ].forEach((c) => {
        ctx.fillStyle = '#be185d';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // 4. Line 1: HARSHA LOVES YESHWANTH
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.shadowColor = 'rgba(180, 83, 9, 0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#831843';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText('✦ HARSHA LOVES YESHWANTH ✦', 512, 118);
      ctx.restore();

      // 5. Center Golden Heart Medallion & Flourish
      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('💖', 512, 192);

      // 6. Line 2: YESHWANTH LOVES HARSHA
      ctx.save();
      ctx.shadowColor = 'rgba(180, 83, 9, 0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#831843';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText('✦ YESHWANTH LOVES HARSHA ✦', 512, 268);
      ctx.restore();

      // 7. Dedication Subtitle
      ctx.fillStyle = '#581c87';
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillText('Forever & Always on Heart Island · Floor 3 Palace Sanctuary', 512, 346);
    }

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  };

  const fountainDedicationTex = createFountainDedicationPlaqueTex();
  const fountainDedicationPlaqueMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: fountainDedicationTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#fffbeb'),
      emissiveIntensity: 0.72,
      emissiveMap: fountainDedicationTex,
      roughness: 0.16,
      metalness: 0.25,
      side: THREE.FrontSide,
    }),
  );

  const plaqueCartoucheBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(1.22, 0.52, 0.06));
  const plaqueCartouchePlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.16, 0.46));
  const plaqueCartoucheLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 12));
  const plaqueHeartFinialGeo = buildExtrudedHeartGeometry(tracker, 0.14, 0.035, 0.012);

  // Mount twin dedication boards on the South promenade face and North gallery face of the fountain
  [primaryCenterPhi, oppositeCenterPhi].forEach((plaquePhi) => {
    const plaqueHolder = new THREE.Group();
    // Positioned at the outer basin rim (r = 1.48m, y = 0.48m)
    const px = Math.cos(plaquePhi) * 1.46;
    const pz = Math.sin(plaquePhi) * 1.46;
    plaqueHolder.position.set(px, 0.48, pz);

    // Orient facing outward away from fountain center, tilted upward 26° for comfortable standing eye-level viewing
    plaqueHolder.rotation.y = -plaquePhi - Math.PI * 0.5;
    plaqueHolder.rotation.x = -Math.PI * 0.14;

    const boardBack = new THREE.Mesh(plaqueCartoucheBoardGeo, fountainGoldMat);
    const boardFace = new THREE.Mesh(plaqueCartouchePlaneGeo, fountainDedicationPlaqueMat);
    boardFace.position.z = 0.032;

    // Ornate top crystal heart finial
    const topHeart = new THREE.Mesh(plaqueHeartFinialGeo, floatingHeartCrystalMat);
    topHeart.position.set(0, 0.32, 0.015);
    topHeart.rotation.z = Math.PI;

    // Twin champagne-gold plinth legs anchoring to the marble basin rim
    [-0.42, 0.42].forEach((lx) => {
      const leg = new THREE.Mesh(plaqueCartoucheLegGeo, fountainGoldMat);
      leg.position.set(lx, -0.32, -0.02);
      leg.rotation.x = Math.PI * 0.14; // counter-tilt to stay vertical into the basin rim
      plaqueHolder.add(leg);
    });

    plaqueHolder.add(boardBack, boardFace, topHeart);
    plazaFountainGroup.add(plaqueHolder);
  });

  // --- 0.2 SHALLOW CIRCULAR POLISHED BLUSH-MARBLE BASIN (Diameter = 2.68m, Radius = 1.34m) ---
  const basinBaseStepGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.48, 1.54, 0.09, 48));
  const basinBaseStep = new THREE.Mesh(basinBaseStepGeo, fountainGoldMat);
  basinBaseStep.position.y = 0.045;

  const basinUnderGlowGeo = tracker.trackGeo(new THREE.TorusGeometry(1.53, 0.024, 8, 48));
  basinUnderGlowGeo.rotateX(Math.PI / 2);
  const basinUnderGlow = new THREE.Mesh(basinUnderGlowGeo, fountainSoftGlowMat);
  basinUnderGlow.position.y = 0.02;

  const basinOuterWallGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.34, 1.38, 0.38, 48));
  const basinOuterWall = new THREE.Mesh(basinOuterWallGeo, galleryRoseMarbleMat);
  basinOuterWall.position.y = 0.25;
  basinOuterWall.receiveShadow = true;

  const basinTopGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.32, 0.055, 14, 48));
  basinTopGoldRimGeo.rotateX(Math.PI / 2);
  const basinTopGoldRim = new THREE.Mesh(basinTopGoldRimGeo, fountainGoldMat);
  basinTopGoldRim.position.y = 0.44;

  const basinInnerLipGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.24, 1.24, 0.06, 40));
  const basinInnerLip = new THREE.Mesh(basinInnerLipGeo, mats.pearlWhite);
  basinInnerLip.position.y = 0.42;

  // Submerged Pearl-Blush Marble Basin Floor beneath the clear reflective water surface
  const submergedBasinFloorGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.23, 1.23, 0.02, 44));
  const submergedBasinFloor = new THREE.Mesh(submergedBasinFloorGeo, mats.pearlWhite);
  submergedBasinFloor.position.y = 0.33;

  plazaFountainGroup.add(
    basinBaseStep,
    basinUnderGlow,
    basinOuterWall,
    basinTopGoldRim,
    basinInnerLip,
    submergedBasinFloor,
  );

  // 8 Subtle Engraved & Illuminated Heart Patterns around the Exterior of the Blush-Marble Basin
  const basinHeartFrameGeo = buildExtrudedHeartGeometry(tracker, 0.25, 0.04, 0.015);
  const basinHeartInnerGeo = buildExtrudedHeartGeometry(tracker, 0.18, 0.05, 0.012);
  for (let bh = 0; bh < 8; bh++) {
    const ang = (bh / 8) * Math.PI * 2;
    const br = 1.36;
    const bx = Math.cos(ang) * br;
    const bz = Math.sin(ang) * br;
    const rotY = Math.atan2(bx, bz);

    const hFrame = new THREE.Mesh(basinHeartFrameGeo, fountainGoldMat);
    hFrame.position.set(bx, 0.26, bz);
    hFrame.rotation.y = rotY;

    const hInner = new THREE.Mesh(
      basinHeartInnerGeo,
      bh % 2 === 0 ? fountainSoftGlowMat : fountainPinkGlowMat,
    );
    hInner.position.set(Math.cos(ang) * (br + 0.012), 0.26, Math.sin(ang) * (br + 0.012));
    hInner.rotation.y = rotY;

    plazaFountainGroup.add(hFrame, hInner);
  }

  // Clear Reflective Water Surface inside the Main Basin
  const waterDiscGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.25, 1.25, 0.018, 56));
  const waterDisc = new THREE.Mesh(waterDiscGeo, fountainClearWaterSurfaceMat);
  waterDisc.position.y = 0.395;
  plazaFountainGroup.add(waterDisc);

  // --- 0.3 CENTRAL PEDESTAL, UPPER SPILL BOWL & SMALL ELEGANT CRYSTAL CENTERPIECE ---
  const centerStemBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.36, 0.44, 0.14, 24));
  const centerStemBase = new THREE.Mesh(centerStemBaseGeo, fountainGoldMat);
  centerStemBase.position.y = 0.45;

  const centerStemColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.31, 0.48, 24));
  const centerStemCol = new THREE.Mesh(centerStemColGeo, galleryRoseMarbleMat);
  centerStemCol.position.y = 0.72;

  const upperBowlGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.66, 0.32, 0.18, 36));
  const upperBowl = new THREE.Mesh(upperBowlGeo, galleryRoseMarbleMat);
  upperBowl.position.y = 0.98;

  const upperBowlGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(0.66, 0.032, 12, 36));
  upperBowlGoldRimGeo.rotateX(Math.PI / 2);
  const upperBowlGoldRim = new THREE.Mesh(upperBowlGoldRimGeo, fountainGoldMat);
  upperBowlGoldRim.position.y = 1.07;

  const upperBowlWaterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 0.016, 36));
  const upperBowlWater = new THREE.Mesh(upperBowlWaterGeo, fountainClearWaterSurfaceMat);
  upperBowlWater.position.y = 1.062;

  plazaFountainGroup.add(
    centerStemBase,
    centerStemCol,
    upperBowl,
    upperBowlGoldRim,
    upperBowlWater,
  );

  // Two Graceful Curved Champagne-Gold Forms Rising Toward Each Other
  // (Subtly suggesting two people coming together around the suspended translucent pink heart crystal)
  const centerpieceBaseOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 16, 14));
  const centerpieceBaseOrb = new THREE.Mesh(centerpieceBaseOrbGeo, fountainGoldMat);
  centerpieceBaseOrb.position.y = 1.11;
  plazaFountainGroup.add(centerpieceBaseOrb);

  [-1, 1].forEach((side) => {
    const outerEmbraceCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(side * 0.04, 1.1, 0),
      new THREE.Vector3(side * 0.56, 1.32, 0),
      new THREE.Vector3(side * 0.52, 1.82, 0),
      new THREE.Vector3(side * 0.03, 1.72, 0),
    );
    const outerEmbraceGeo = tracker.trackGeo(
      new THREE.TubeGeometry(outerEmbraceCurve, 28, 0.036, 12, false),
    );
    const outerEmbraceMesh = new THREE.Mesh(outerEmbraceGeo, fountainGoldMat);

    const innerEmbraceCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(side * 0.03, 1.14, 0),
      new THREE.Vector3(side * 0.42, 1.34, 0.04 * side),
      new THREE.Vector3(side * 0.38, 1.72, -0.04 * side),
      new THREE.Vector3(side * 0.02, 1.66, 0),
    );
    const innerEmbraceGeo = tracker.trackGeo(
      new THREE.TubeGeometry(innerEmbraceCurve, 24, 0.018, 10, false),
    );
    const innerEmbraceMesh = new THREE.Mesh(innerEmbraceGeo, fountainSoftGlowMat);

    plazaFountainGroup.add(outerEmbraceMesh, innerEmbraceMesh);
  });

  // Small Translucent Pink Heart Crystal Suspended Between the Two Champagne-Gold Forms
  const plazaFountainHeartPivot = new THREE.Group();
  plazaFountainHeartPivot.position.set(0, 1.46, 0);
  const suspendedHeartGeo = buildExtrudedHeartGeometry(tracker, 0.42, 0.16, 0.04);
  const suspendedHeartMesh = new THREE.Mesh(suspendedHeartGeo, floatingHeartCrystalMat);
  const suspendedHeartCoreGeo = buildExtrudedHeartGeometry(tracker, 0.24, 0.1, 0.02);
  const suspendedHeartCore = new THREE.Mesh(suspendedHeartCoreGeo, fountainPinkGlowMat);
  plazaFountainHeartPivot.add(suspendedHeartMesh, suspendedHeartCore);

  // Tiny Companion Crown Heart Finial atop the Gold Embrace Arch
  const topFinialHeartGeo = buildExtrudedHeartGeometry(tracker, 0.18, 0.09, 0.022);
  const topFinialHeart = new THREE.Mesh(topFinialHeartGeo, floatingHeartCrystalMat);
  topFinialHeart.position.set(0, 1.86, 0);
  const topFinialRim = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.22, 0.07, 0.018),
    fountainGoldMat,
  );
  topFinialRim.position.set(0, 1.86, 0);

  plazaFountainGroup.add(plazaFountainHeartPivot, topFinialHeart, topFinialRim);

  // --- 0.4 TRANSPARENT, VARIABLE-PROFILE GRAVITY WATER STREAMS, POOLED IMPACT RIPPLES & CLEAR DROPLETS ---
  // Builds a non-uniform, gravity-accelerated water stream mesh with an irregular/flattened cross-section
  // that narrows mid-fall and feathers near impact (never a uniform cylindrical tube).
  const buildVariableWaterStreamGeometry = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    baseWidth: number,
    baseThick: number,
  ): THREE.BufferGeometry => {
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const tubularSegments = 22;
    const radialSegments = 10;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const pt = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const sideAxis = new THREE.Vector3();
    const outAxis = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const vPos = new THREE.Vector3();
    const vNorm = new THREE.Vector3();

    for (let i = 0; i <= tubularSegments; i++) {
      // Gravity-accelerated parameterization along the falling curve
      const u = i / tubularSegments;
      const gravityT = 0.65 * u + 0.35 * u * u;
      curve.getPoint(gravityT, pt);
      curve.getTangent(gravityT, tangent).normalize();

      sideAxis.crossVectors(worldUp, tangent);
      if (sideAxis.lengthSq() < 0.0001) {
        sideAxis.set(1, 0, 0);
      } else {
        sideAxis.normalize();
      }
      outAxis.crossVectors(tangent, sideAxis).normalize();

      // Stream narrows as velocity increases under gravity (vena contracta), then flares slightly at basin entry
      const widthEnvelope =
        baseWidth * (1.0 - 0.38 * Math.sin(u * Math.PI * 0.82) + 0.16 * Math.pow(u, 3.0));
      const thickEnvelope = baseThick * (1.0 - 0.32 * u + 0.12 * u * u);

      for (let j = 0; j <= radialSegments; j++) {
        const v = j / radialSegments;
        const theta = v * Math.PI * 2;
        // Irregular fluted fluid cross-section so silhouette never reads as a cylinder
        const fluteMod = 1.0 + 0.18 * Math.sin(theta * 3.0 + u * 5.0) + 0.08 * Math.cos(theta * 5.0);
        const rx = Math.cos(theta) * widthEnvelope * fluteMod;
        const ry = Math.sin(theta) * thickEnvelope * fluteMod;

        vPos
          .copy(pt)
          .addScaledVector(sideAxis, rx)
          .addScaledVector(outAxis, ry);
        positions.push(vPos.x, vPos.y, vPos.z);

        vNorm
          .copy(sideAxis)
          .multiplyScalar(Math.cos(theta) / Math.max(0.001, widthEnvelope))
          .addScaledVector(outAxis, Math.sin(theta) / Math.max(0.001, thickEnvelope))
          .normalize();
        normals.push(vNorm.x, vNorm.y, vNorm.z);
        uvs.push(u, v);
      }
    }

    const stride = radialSegments + 1;
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return tracker.trackGeo(geo);
  };

  const impactRippleDiscGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.32, 0.32));
  impactRippleDiscGeo.rotateX(-Math.PI / 2);

  // 4 Delicate Upper Streams emerging from the centerpiece into the upper bowl
  for (let us = 0; us < 4; us++) {
    const ang = (us / 4) * Math.PI * 2 + Math.PI * 0.25;
    const uStreamGeo = buildVariableWaterStreamGeometry(
      new THREE.Vector3(Math.cos(ang) * 0.06, 1.32, Math.sin(ang) * 0.06),
      new THREE.Vector3(Math.cos(ang) * 0.28, 1.25, Math.sin(ang) * 0.28),
      new THREE.Vector3(Math.cos(ang) * 0.46, 1.062, Math.sin(ang) * 0.46),
      0.022,
      0.01,
    );
    const uStreamMesh = new THREE.Mesh(uStreamGeo, fountainFlowingStreamMat);

    const upperImpactPatch = new THREE.Mesh(impactRippleDiscGeo, fountainImpactRippleMat);
    upperImpactPatch.position.set(Math.cos(ang) * 0.46, 1.066, Math.sin(ang) * 0.46);
    upperImpactPatch.scale.setScalar(0.65);

    plazaFountainGroup.add(uStreamMesh, upperImpactPatch);
  }

  // 8 Gravity-Accelerated Water Streams arcing from the upper bowl lip into the main basin
  for (let ls = 0; ls < 8; ls++) {
    const ang = (ls / 8) * Math.PI * 2;
    const lStreamGeo = buildVariableWaterStreamGeometry(
      new THREE.Vector3(Math.cos(ang) * 0.63, 1.055, Math.sin(ang) * 0.63),
      new THREE.Vector3(Math.cos(ang) * 0.9, 0.9, Math.sin(ang) * 0.9),
      new THREE.Vector3(Math.cos(ang) * 1.04, 0.395, Math.sin(ang) * 1.04),
      0.032,
      0.013,
    );
    const lStreamMesh = new THREE.Mesh(lStreamGeo, fountainFlowingStreamMat);

    const lowerImpactPatch = new THREE.Mesh(impactRippleDiscGeo, fountainImpactRippleMat);
    lowerImpactPatch.position.set(Math.cos(ang) * 1.04, 0.401, Math.sin(ang) * 1.04);
    lowerImpactPatch.rotation.y = ang;

    plazaFountainGroup.add(lStreamMesh, lowerImpactPatch);
  }

  // Restrained Pool of 16 Clear Specular Water Droplets near Stream Impacts (No Neon Pink Particles)
  const PLAZA_FOUNTAIN_DROPLET_COUNT = 16;
  const clearDropletGeo = tracker.trackGeo(new THREE.SphereGeometry(0.015, 8, 8));
  const clearDropletMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f0f9ff'),
      roughness: 0.03,
      metalness: 0.06,
      transmission: 0.84,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
      ior: 1.333,
    }),
  );
  const plazaFountainDropletInst = new THREE.InstancedMesh(
    clearDropletGeo,
    clearDropletMat,
    PLAZA_FOUNTAIN_DROPLET_COUNT,
  );
  plazaFountainDropletInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plazaFountainGroup.add(plazaFountainDropletInst);

  // --- 0.5 SMALL ROMANTIC FLOWER CLUSTERS & MINIATURE GOLD LANTERNS AROUND BASIN EDGE ---
  // Hugs the immediate outer edge of the basin (r = 1.46m..1.50m), leaving the dedicated
  // "YESHWANTH LOVES HARSHA" marble band (r = 1.62m..2.34m) 100% clear and unobstructed!
  const smallRoseGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.058, 1));
  const tinyWhiteFlowerGeo = tracker.trackGeo(new THREE.SphereGeometry(0.036, 8, 8));
  const clusterLeafGeo = tracker.trackGeo(new THREE.ConeGeometry(0.048, 0.12, 5));
  const lavenderFlowerMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b4fe'),
      emissive: new THREE.Color('#a855f7'),
      emissiveIntensity: 0.14,
      roughness: 0.38,
    }),
  );

  for (let fc = 0; fc < 4; fc++) {
    const centerAng = (fc / 4) * Math.PI * 2 + Math.PI * 0.25;
    // 7 small blossoms per cluster curving along the basin base
    for (let b = -3; b <= 3; b++) {
      const ang = centerAng + b * 0.085;
      const rad = 1.46 + (Math.abs(b) % 2) * 0.04;
      const fx = Math.cos(ang) * rad;
      const fz = Math.sin(ang) * rad;

      const leaf = new THREE.Mesh(clusterLeafGeo, pastelHedgeMat);
      leaf.position.set(fx, 0.08, fz);
      leaf.rotation.x = Math.PI * 0.35;
      leaf.rotation.y = ang;

      const roseMat =
        b % 3 === 0
          ? puppySnowMat
          : b % 2 === 0
            ? bubbleIridescentMat
            : lavenderFlowerMat;
      const blossom = new THREE.Mesh(
        b % 3 === 0 ? tinyWhiteFlowerGeo : smallRoseGeo,
        roseMat,
      );
      blossom.position.set(fx, 0.14 + (1 - Math.abs(b) * 0.15) * 0.04, fz);

      plazaFountainGroup.add(leaf, blossom);
    }

    // Small romantic champagne-gold lantern between the 4 flower clusters (r = 1.50m)
    const lanAng = (fc / 4) * Math.PI * 2;
    const lxPos = Math.cos(lanAng) * 1.5;
    const lzPos = Math.sin(lanAng) * 1.5;
    const lanGrp = new THREE.Group();
    lanGrp.position.set(lxPos, 0.06, lzPos);

    const lanBase = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 6)),
      fountainGoldMat,
    );
    const lanGlass = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.065, 0.18, 6)),
      fountainSoftGlowMat,
    );
    lanGlass.position.y = 0.12;
    const lanRoof = new THREE.Mesh(
      tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.1, 6)),
      fountainGoldMat,
    );
    lanRoof.position.y = 0.25;
    lanGrp.add(lanBase, lanGlass, lanRoof);
    plazaFountainGroup.add(lanGrp);
  }

  // Register collider strictly for the physical marble basin (r = 1.46m) so the player can walk
  // freely over the entire circular floor composition & "YESHWANTH LOVES HARSHA" inscription!
  registerLocalCollider(plazaFountainX, plazaFountainZ, 1.46, 2.1);

  // Helper to build elegant Palace Archways with Pearl Columns, Gold Trim & Subtle Crystal Heart Crest (Zero Giant Floating Text Signs)
  const buildPalacePortalArch = (
    cx: number,
    cz: number,
    width: number,
    height: number,
    rotY: number,
    crestMat: THREE.Material = crystalArchMat,
  ) => {
    const portal = new THREE.Group();
    portal.position.set(cx, y0, cz);
    portal.rotation.y = rotY;

    const halfW = width * 0.5;
    const colGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, height, 16));
    colGeo.translate(0, height * 0.5, 0);
    const baseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.35, 0.24, 16));
    baseGeo.translate(0, 0.12, 0);
    const capGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.34, 0.25, 0.24, 16));
    capGeo.translate(0, height - 0.12, 0);

    [-halfW, halfW].forEach((px) => {
      const col = new THREE.Mesh(colGeo, mats.pearlWhite);
      col.position.set(px, 0, 0);
      const base = new THREE.Mesh(baseGeo, mats.champagneGold);
      base.position.set(px, 0, 0);
      const cap = new THREE.Mesh(capGeo, mats.champagneGold);
      cap.position.set(px, 0, 0);
      portal.add(col, base, cap);
    });

    // Overhead crystal & gold arch lintel
    const lintelGeo = tracker.trackGeo(new THREE.BoxGeometry(width + 0.65, 0.34, 0.44));
    const lintel = new THREE.Mesh(lintelGeo, mats.pearlWhite);
    lintel.position.set(0, height + 0.15, 0);
    const lintelGoldGeo = tracker.trackGeo(new THREE.BoxGeometry(width + 0.72, 0.08, 0.48));
    const lintelGold = new THREE.Mesh(lintelGoldGeo, mats.champagneGold);
    lintelGold.position.set(0, height + 0.34, 0);
    portal.add(lintel, lintelGold);

    const archCurveGeo = tracker.trackGeo(
      new THREE.TorusGeometry(halfW, 0.11, 10, 28, Math.PI),
    );
    const archCurve = new THREE.Mesh(archCurveGeo, crestMat);
    archCurve.position.set(0, height, 0);
    portal.add(archCurve);

    // Subtle sculpted crystal heart crest at the crown of the arch
    const crestHeartGeo = buildExtrudedHeartGeometry(tracker, 0.42, 0.14, 0.03);
    const crestHeart = new THREE.Mesh(crestHeartGeo, crestMat);
    crestHeart.position.set(0, height + 0.56, 0);
    portal.add(crestHeart);

    group.add(portal);
  };

  // ==========================================================================
  // 1. ROYAL HEART GALLERY (REFERENCE-LOCKED RECONSTRUCTION)
  //    East & South-East Grand Wing: lx in [+4.8, +15.0], lz in [-15.0, +7.8] (~232 m²)
  //    Primary Visual Source of Truth: Supplied Royal Heart Gallery Reference Image
  // ==========================================================================
  const heartGalleryGroup = new THREE.Group();
  heartGalleryGroup.name = 'HeartGalleryWing';
  group.add(heartGalleryGroup);

  // --- 1.1 REFERENCE-LOCKED GALLERY MATERIALS ---
  const galleryPolishedFloorMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.06,
      roughness: 0.09,
      metalness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
      reflectivity: 0.85,
    }),
  );
  const galleryBlushWallMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f7d4e3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.04,
      roughness: 0.34,
      metalness: 0.04,
    }),
  );
  const galleryRoyalGoldMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f5d076'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.18,
      roughness: 0.18,
      metalness: 0.86,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
    }),
  );
  const galleryWarmLinearGlowMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
    }),
  );
  const gallerySheerCurtainMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.2,
      roughness: 0.22,
      metalness: 0.02,
      transmission: 0.46,
      transparent: true,
      opacity: 0.86,
      sheen: 0.9,
      sheenColor: new THREE.Color('#fce7f3'),
      side: THREE.DoubleSide,
    }),
  );
  const galleryBurgundyBenchMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#9f1239'),
      emissive: new THREE.Color('#4c0519'),
      emissiveIntensity: 0.12,
      roughness: 0.42,
      metalness: 0.04,
      sheen: 0.85,
      sheenColor: new THREE.Color('#fda4af'),
      clearcoat: 0.15,
    }),
  );
  const galleryRoseLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#15803d'),
      emissive: new THREE.Color('#14532d'),
      emissiveIntensity: 0.06,
      roughness: 0.48,
      metalness: 0.04,
    }),
  );
  const galleryRoseDeepPinkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ec4899'),
      emissive: new THREE.Color('#be185d'),
      emissiveIntensity: 0.14,
      roughness: 0.35,
      metalness: 0.04,
    }),
  );
  const galleryRoseSoftPinkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.12,
      roughness: 0.35,
      metalness: 0.04,
    }),
  );
  const galleryRoseCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff1f2'),
      emissive: new THREE.Color('#fecdd3'),
      emissiveIntensity: 0.1,
      roughness: 0.35,
      metalness: 0.04,
    }),
  );
  const galleryShadowBackingMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2e101d'),
      roughness: 0.85,
      metalness: 0.05,
    }),
  );

  // Soft Warm Downward Light Spill Texture for Portrait Picture Lights & Wall Sconces
  const createWarmWallWashTexture = (isCone: boolean): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      if (isCone) {
        // Downward warm light cone from the gold picture light hood
        const grad = ctx.createRadialGradient(128, 22, 4, 128, 128, 130);
        grad.addColorStop(0, 'rgba(254, 249, 195, 0.92)');
        grad.addColorStop(0.22, 'rgba(253, 224, 71, 0.56)');
        grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.22)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(128, 10);
        ctx.lineTo(248, 248);
        ctx.lineTo(8, 248);
        ctx.closePath();
        ctx.fill();
      } else {
        // Radial warm wall glow behind crystal sconces
        const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 120);
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        grad.addColorStop(0.38, 'rgba(244, 114, 182, 0.42)');
        grad.addColorStop(0.72, 'rgba(244, 114, 182, 0.12)');
        grad.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
      }
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const portraitWashTex = createWarmWallWashTexture(true);
  const sconceWashTex = createWarmWallWashTexture(false);

  const portraitWallWashMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: portraitWashTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const sconceWallWashMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: sconceWashTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );

  // --- 1.2 POLISHED BLUSH-ROSE MARBLE FLOOR INLAY ---
  const galleryFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(10.2, 0.022, 23.0));
  const galleryFloor = new THREE.Mesh(galleryFloorGeo, galleryPolishedFloorMat);
  galleryFloor.position.set(9.9, y0 + 0.011, -3.5);
  galleryFloor.receiveShadow = true;
  heartGalleryGroup.add(galleryFloor);

  // --- 1.3 GALLERY PERIMETER WALLS WITH CORNICE COVE LIGHT, DADO RAIL & STEPPED GOLD BASEBOARD ---
  // West Colonnade Wall at lx = +4.8 has two grand portals matching CastleNavigation:
  //   - Main Grand Entrance Archway: lz in [-0.3, +3.3] (center lz = +1.5, width 3.6m)
  //   - Secondary Ornate Archway: lz in [-11.1, -7.9] (center lz = -9.5, width 3.2m)
  const buildReferenceGalleryWall = (
    cx: number,
    cz: number,
    len: number,
    alongZ: boolean,
    height = 4.35,
  ) => {
    const thickness = 0.34;
    const w = alongZ ? thickness : len;
    const d = alongZ ? len : thickness;

    const wallGeo = tracker.trackGeo(new THREE.BoxGeometry(w, height, d));
    const wall = new THREE.Mesh(wallGeo, galleryBlushWallMat);
    wall.position.set(cx, y0 + height * 0.5, cz);
    wall.receiveShadow = true;

    // Stepped Champagne-Gold Baseboard Plinth + Continuous Lower Linear Light Strip + Gold Dado Rail
    const baseOuterGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.09 : len + 0.04, 0.16, alongZ ? len + 0.04 : thickness + 0.09),
    );
    const baseOuter = new THREE.Mesh(baseOuterGeo, galleryRoyalGoldMat);
    baseOuter.position.set(cx, y0 + 0.08, cz);

    const baseGlowGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.1 : len + 0.02, 0.028, alongZ ? len + 0.02 : thickness + 0.1),
    );
    const baseGlow = new THREE.Mesh(baseGlowGeo, galleryWarmLinearGlowMat);
    baseGlow.position.set(cx, y0 + 0.18, cz);

    const dadoRailGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.07 : len + 0.02, 0.055, alongZ ? len + 0.02 : thickness + 0.07),
    );
    const dadoRail = new THREE.Mesh(dadoRailGeo, galleryRoyalGoldMat);
    dadoRail.position.set(cx, y0 + 0.56, cz);

    const dadoGlowGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.075 : len + 0.02, 0.022, alongZ ? len + 0.02 : thickness + 0.075),
    );
    const dadoGlow = new THREE.Mesh(dadoGlowGeo, galleryWarmLinearGlowMat);
    dadoGlow.position.set(cx, y0 + 0.52, cz);

    // Upper Stepped Champagne-Gold Cornice + Continuous Warm Cove Light Strip
    const corniceGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.12 : len + 0.06, 0.18, alongZ ? len + 0.06 : thickness + 0.12),
    );
    const cornice = new THREE.Mesh(corniceGeo, galleryRoyalGoldMat);
    cornice.position.set(cx, y0 + height - 0.06, cz);

    const coveGlowGeo = tracker.trackGeo(
      new THREE.BoxGeometry(alongZ ? thickness + 0.09 : len + 0.02, 0.035, alongZ ? len + 0.02 : thickness + 0.09),
    );
    const coveGlow = new THREE.Mesh(coveGlowGeo, galleryWarmLinearGlowMat);
    coveGlow.position.set(cx, y0 + height - 0.17, cz);

    heartGalleryGroup.add(wall, baseOuter, baseGlow, dadoRail, dadoGlow, cornice, coveGlow);
    partitionMeshes.push(wall);
  };

  // West Gallery Wall segments (lx = +4.8):
  // Left of Main Archway (lz: +3.3 .. +8.1), Between Main & Secondary Archways (lz: -7.9 .. -0.3), South of Secondary Archway (lz: -15.0 .. -11.1)
  buildReferenceGalleryWall(4.8, (3.3 + 8.1) * 0.5, 8.1 - 3.3, true);
  buildReferenceGalleryWall(4.8, (-7.9 + -0.3) * 0.5, -0.3 - -7.9, true);
  buildReferenceGalleryWall(4.8, (-15.0 + -11.1) * 0.5, -11.1 - -15.0, true);

  // North Gallery Wall segments at lz = +7.8 (lx: 4.8..10.2 and 13.0..15.0, preserving 2.8m North Portal at lx: 10.2..13.0)
  buildReferenceGalleryWall((4.8 + 10.2) * 0.5, 7.8, 10.2 - 4.8, false);
  buildReferenceGalleryWall((13.0 + 15.0) * 0.5, 7.8, 15.0 - 13.0, false);

  // Interior East Gallery Wall Trim along lx = +14.85 (lz: -14.8 .. +7.6) so East Apse matches the West Wall's luxury trim
  buildReferenceGalleryWall(14.85, -3.6, 22.4, true);

  // Interior South Gallery Wall Trim along lz = -14.85 (lx: +4.8 .. +14.85) so the right-hand interior wall has matching luxury trim
  buildReferenceGalleryWall((4.8 + 14.85) * 0.5, -14.85, 14.85 - 4.8, false);

  // --- 1.4 REUSABLE CLASSICAL FLUTED COLUMN BUILDER (Multi-Tiered Gold Base, 16-Flute Pearl Shaft, Corinthian Gold Capital) ---
  const flColPlinthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.74, 0.14, 0.74));
  const flColBaseTorus1Geo = tracker.trackGeo(new THREE.TorusGeometry(0.31, 0.055, 10, 24));
  flColBaseTorus1Geo.rotateX(Math.PI / 2);
  const flColBaseTorus2Geo = tracker.trackGeo(new THREE.TorusGeometry(0.27, 0.042, 10, 24));
  flColBaseTorus2Geo.rotateX(Math.PI / 2);
  const flColShaftGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.225, 0.245, 3.32, 24));
  const flColFluteRibGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.025, 3.22, 6));
  const flColCapBellGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.33, 0.23, 0.34, 20));
  const flColVoluteGeo = tracker.trackGeo(new THREE.TorusGeometry(0.068, 0.022, 8, 14, Math.PI * 1.35));
  const flColAbacusGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.12, 0.76));

  const buildClassicalFlutedColumn = (scale = 1.0): THREE.Group => {
    const colGrp = new THREE.Group();
    colGrp.scale.setScalar(scale);

    // Multi-stepped gold base
    const plinth = new THREE.Mesh(flColPlinthGeo, galleryRoyalGoldMat);
    plinth.position.set(0, 0.07, 0);
    const torus1 = new THREE.Mesh(flColBaseTorus1Geo, galleryRoyalGoldMat);
    torus1.position.set(0, 0.18, 0);
    const torus2 = new THREE.Mesh(flColBaseTorus2Geo, galleryRoyalGoldMat);
    torus2.position.set(0, 0.27, 0);

    // Fluted pearl-blush shaft (core cylinder + 16 carved vertical flute ridges)
    const shaft = new THREE.Mesh(flColShaftGeo, mats.pearlWhite);
    shaft.position.set(0, 1.96, 0);
    colGrp.add(plinth, torus1, torus2, shaft);

    for (let f = 0; f < 16; f++) {
      const ang = (f / 16) * Math.PI * 2;
      const rib = new THREE.Mesh(flColFluteRibGeo, galleryBlushWallMat);
      rib.position.set(Math.cos(ang) * 0.228, 1.96, Math.sin(ang) * 0.228);
      colGrp.add(rib);
    }

    // Ornate Corinthian/classical gold capital
    const neckRing = new THREE.Mesh(flColBaseTorus2Geo, galleryRoyalGoldMat);
    neckRing.position.set(0, 3.62, 0);
    const capBell = new THREE.Mesh(flColCapBellGeo, galleryRoyalGoldMat);
    capBell.position.set(0, 3.82, 0);
    const abacus = new THREE.Mesh(flColAbacusGeo, galleryRoyalGoldMat);
    abacus.position.set(0, 4.05, 0);
    colGrp.add(neckRing, capBell, abacus);

    for (let v = 0; v < 8; v++) {
      const ang = (v / 8) * Math.PI * 2;
      const vol = new THREE.Mesh(flColVoluteGeo, galleryRoyalGoldMat);
      vol.position.set(Math.cos(ang) * 0.28, 3.88, Math.sin(ang) * 0.28);
      vol.rotation.y = -ang;
      colGrp.add(vol);
    }

    return colGrp;
  };

  // --- 1.5 MAIN GRAND ENTRANCE ARCHWAY (lx = +4.8, lz = +1.5, width = 3.6m) ---
  // Reconstructs every detail from the reference image:
  // - Fluted classical columns on stepped gold bases with ornate gold capitals
  // - 2 side glowing faceted pink crystal hearts atop the left & right column capitals
  // - Central large faceted glowing pink crystal heart in a double gold heart bezel at the arch apex
  // - Gold baroque scrollwork volutes flanking the central heart along the arch extrados
  // - Warm stud lights along the gold arch ring
  // - 9 hanging vertical crystal bead garlands with pink heart drops inside the upper arch
  // - Gathered sheer translucent blush-pink curtains tied back on both sides with warm fairy sparkles
  const mainArchGroup = new THREE.Group();
  mainArchGroup.position.set(4.8, y0, 1.5);
  mainArchGroup.rotation.y = Math.PI / 2; // Local +Z points East (+X) into the Heart Gallery
  heartGalleryGroup.add(mainArchGroup);

  const mainArchHalfW = 1.82;
  const sideCrystalHeartGeo = buildExtrudedHeartGeometry(tracker, 0.46, 0.16, 0.04);
  const centerApexHeartGeo = buildExtrudedHeartGeometry(tracker, 0.82, 0.22, 0.055);
  const centerOuterGoldHeartGeo = buildExtrudedHeartGeometry(tracker, 1.05, 0.14, 0.045);
  const centerInnerGoldHeartGeo = buildExtrudedHeartGeometry(tracker, 0.92, 0.18, 0.04);

  [-mainArchHalfW, mainArchHalfW].forEach((px) => {
    const col = buildClassicalFlutedColumn(1.0);
    col.position.set(px, 0, 0);
    mainArchGroup.add(col);

    // Glowing Faceted Pink Crystal Heart mounted atop each column capital
    const sideHeartPedestal = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.16, 0.22, 0.1, 16)),
      galleryRoyalGoldMat,
    );
    sideHeartPedestal.position.set(px, 4.16, 0);
    const sideHeart = new THREE.Mesh(sideCrystalHeartGeo, floatingHeartCrystalMat);
    sideHeart.position.set(px, 4.42, 0.04);
    mainArchGroup.add(sideHeartPedestal, sideHeart);
  });

  // Multi-layered Champagne-Gold Arch Ring spanning between the two column capitals
  const archSpanR = mainArchHalfW;
  const archCenterY = 3.28;
  const mainArchOuterRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(archSpanR, 0.13, 14, 40, Math.PI),
  );
  const mainArchInnerRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(archSpanR - 0.14, 0.065, 12, 36, Math.PI),
  );
  const mainArchOuterRing = new THREE.Mesh(mainArchOuterRingGeo, galleryRoyalGoldMat);
  mainArchOuterRing.position.set(0, archCenterY, 0);
  const mainArchInnerRing = new THREE.Mesh(mainArchInnerRingGeo, galleryRoyalGoldMat);
  mainArchInnerRing.position.set(0, archCenterY, 0);
  mainArchGroup.add(mainArchOuterRing, mainArchInnerRing);

  // Warm recessed stud lights along the gold arch curve
  const archStudGeo = tracker.trackGeo(new THREE.SphereGeometry(0.036, 10, 10));
  for (let s = 1; s < 14; s++) {
    const ang = (s / 14) * Math.PI;
    const sx = Math.cos(ang) * (archSpanR - 0.06);
    const sy = archCenterY + Math.sin(ang) * (archSpanR - 0.06);
    const studFront = new THREE.Mesh(archStudGeo, galleryWarmLinearGlowMat);
    studFront.position.set(sx, sy, 0.11);
    const studBack = new THREE.Mesh(archStudGeo, galleryWarmLinearGlowMat);
    studBack.position.set(sx, sy, -0.11);
    mainArchGroup.add(studFront, studBack);
  }

  // Central Apex Faceted Glowing Pink Crystal Heart inside Double Gold Heart Bezel
  const apexY = archCenterY + archSpanR + 0.02;
  const apexOuterBezel = new THREE.Mesh(centerOuterGoldHeartGeo, galleryRoyalGoldMat);
  apexOuterBezel.position.set(0, apexY, 0.08);
  const apexInnerBezel = new THREE.Mesh(centerInnerGoldHeartGeo, galleryWarmLinearGlowMat);
  apexInnerBezel.position.set(0, apexY, 0.1);
  const apexCrystalHeart = new THREE.Mesh(centerApexHeartGeo, floatingHeartCrystalMat);
  apexCrystalHeart.position.set(0, apexY, 0.15);
  mainArchGroup.add(apexOuterBezel, apexInnerBezel, apexCrystalHeart);

  // Baroque Gold Scrollwork Volutes flanking the Central Apex Heart along the top of the arch
  const scrollMajorGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.32, 0.038, 10, 24, Math.PI * 1.45),
  );
  const scrollMinorGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.19, 0.032, 10, 20, Math.PI * 1.6),
  );
  [-1, 1].forEach((side) => {
    const majorScroll = new THREE.Mesh(scrollMajorGeo, galleryRoyalGoldMat);
    majorScroll.position.set(side * 0.78, apexY - 0.18, 0.1);
    majorScroll.rotation.z = side * -0.45;
    const minorScroll = new THREE.Mesh(scrollMinorGeo, galleryRoyalGoldMat);
    minorScroll.position.set(side * 1.22, apexY - 0.36, 0.1);
    minorScroll.rotation.z = side * 0.85;
    mainArchGroup.add(majorScroll, minorScroll);
  });

  // Hanging Vertical Crystal Bead Garlands & Glowing Pink Heart Drops inside the Main Archway
  const crystalBeadGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.034, 0));
  const garlandDropHeartGeo = buildExtrudedHeartGeometry(tracker, 0.16, 0.08, 0.02);
  const numStrands = 9;
  for (let st = 0; st < numStrands; st++) {
    const u = (st - (numStrands - 1) * 0.5) / ((numStrands - 1) * 0.5); // -1 .. +1
    const gx = u * 1.18;
    const archTopAtX = archCenterY + Math.sqrt(Math.max(0.1, (archSpanR - 0.18) ** 2 - gx * gx));
    // Parabolic / chandelier-style drop length
    const strandLen = 0.52 + (1.0 - Math.abs(u)) * 0.42 + (st % 2 === 0 ? 0.14 : 0);
    const beadCount = Math.floor(strandLen / 0.12);
    for (let b = 0; b < beadCount; b++) {
      const by = archTopAtX - 0.08 - b * 0.12;
      const bead = new THREE.Mesh(
        crystalBeadGeo,
        b % 2 === 0 ? crystalArchMat : galleryWarmLinearGlowMat,
      );
      bead.position.set(gx, by, 0);
      mainArchGroup.add(bead);
    }
    const bottomHeart = new THREE.Mesh(garlandDropHeartGeo, floatingHeartCrystalMat);
    bottomHeart.position.set(gx, archTopAtX - 0.1 - beadCount * 0.12, 0);
    mainArchGroup.add(bottomHeart);
  }

  // Draped Translucent Blush-Pink Curtains on both sides of an archway
  const buildArchwaySheerDrapes = (parentArch: THREE.Group, halfSpan: number, archH: number) => {
    const tiebackRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.028, 8, 18));
    tiebackRingGeo.rotateX(Math.PI / 2);
    const lowerSkirtFoldGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.085, 1.65, 10));

    [-1, 1].forEach((side) => {
      const drapeSideGrp = new THREE.Group();
      const anchorX = side * (halfSpan - 0.24);

      // 5 pleated sheer folds sweeping from upper arch down to the column tieback at y = 1.65m
      for (let f = 0; f < 5; f++) {
        const startX = side * (0.28 + f * 0.26);
        const startY = archH + Math.sqrt(Math.max(0.05, (halfSpan - 0.15) ** 2 - startX * startX)) - 0.08;
        const midX = side * (halfSpan - 0.42 + f * 0.04);
        const midY = 2.45 + f * 0.08;
        const endX = anchorX + (f - 2) * 0.03;
        const endY = 1.65;
        const zOff = (f - 2) * 0.028;

        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(startX, startY, zOff),
          new THREE.Vector3(midX, midY, zOff + 0.04),
          new THREE.Vector3(endX, endY, zOff),
        );
        const foldGeo = tracker.trackGeo(
          new THREE.TubeGeometry(curve, 16, 0.058 + (f % 2) * 0.015, 8, false),
        );
        const foldMesh = new THREE.Mesh(foldGeo, gallerySheerCurtainMat);
        drapeSideGrp.add(foldMesh);

        // Lower vertical pleated skirt from tieback down to floor
        const lowerFold = new THREE.Mesh(lowerSkirtFoldGeo, gallerySheerCurtainMat);
        lowerFold.position.set(endX, 0.825, zOff);
        drapeSideGrp.add(lowerFold);
      }

      // Gold tieback ring + warm fairy-light sparkles along the curtain edge
      const tieRing = new THREE.Mesh(tiebackRingGeo, galleryRoyalGoldMat);
      tieRing.position.set(anchorX, 1.65, 0);
      drapeSideGrp.add(tieRing);

      for (let sp = 0; sp < 6; sp++) {
        const spark = new THREE.Mesh(archStudGeo, galleryWarmLinearGlowMat);
        spark.scale.setScalar(0.65);
        spark.position.set(
          side * (halfSpan - 0.36 - sp * 0.12),
          1.4 + sp * 0.42,
          0.09,
        );
        drapeSideGrp.add(spark);
      }

      parentArch.add(drapeSideGrp);
    });
  };

  buildArchwaySheerDrapes(mainArchGroup, mainArchHalfW, archCenterY);

  // --- 1.6 SECONDARY ORNATE ARCHWAY (Far Right in Reference: lx = +4.8, lz = -9.5, width = 3.2m) ---
  // Flanked by fluted columns with gold capitals and crowned by 3 glowing faceted pink crystal hearts
  const secondaryArchGroup = new THREE.Group();
  secondaryArchGroup.position.set(4.8, y0, -9.5);
  secondaryArchGroup.rotation.y = Math.PI / 2;
  heartGalleryGroup.add(secondaryArchGroup);

  const secArchHalfW = 1.6;
  [-secArchHalfW, secArchHalfW].forEach((px) => {
    const col = buildClassicalFlutedColumn(0.96);
    col.position.set(px, 0, 0);
    secondaryArchGroup.add(col);
  });

  const secArchRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(secArchHalfW, 0.11, 12, 32, Math.PI),
  );
  const secArchRing = new THREE.Mesh(secArchRingGeo, galleryRoyalGoldMat);
  secArchRing.position.set(0, 3.15, 0);
  const secLintelGeo = tracker.trackGeo(new THREE.BoxGeometry(secArchHalfW * 2 + 0.72, 0.22, 0.48));
  const secLintel = new THREE.Mesh(secLintelGeo, galleryRoyalGoldMat);
  secLintel.position.set(0, 4.02, 0);
  secondaryArchGroup.add(secArchRing, secLintel);

  // 3 Glowing Pink Crystal Hearts across the top of the Secondary Archway (Left Column, Center Crown, Right Column)
  [-secArchHalfW, 0, secArchHalfW].forEach((hx, hIdx) => {
    const hy = hIdx === 1 ? 4.38 : 4.44;
    const hMesh = new THREE.Mesh(sideCrystalHeartGeo, floatingHeartCrystalMat);
    hMesh.position.set(hx, hy, 0.04);
    secondaryArchGroup.add(hMesh);
  });

  buildArchwaySheerDrapes(secondaryArchGroup, secArchHalfW, 3.15);

  // North Gallery Portal Archway at (lx = 11.6, lz = 7.8, width = 2.8m)
  buildPalacePortalArch(11.6, 7.8, 2.8, 3.85, 0, floatingHeartCrystalMat);

  // --- 1.7 THROUGH-ARCHWAY PROMENADE COLONNADE VISTA (Visible through the Main Entrance Archway) ---
  // Places classical fluted columns with gold capitals and floating crystal hearts along the outer
  // promenade edge (lx = +2.35, outside the 3.6m entrance corridor) so looking through the Main Archway
  // matches the deep multi-column background vista in the reference image.
  const vistaColumnCoords = [
    { lx: 2.65, lz: 2.95 },
    { lx: 2.65, lz: -0.65 },
    { lx: 0.65, lz: -2.15 },
  ];
  vistaColumnCoords.forEach(({ lx, lz }) => {
    const vCol = buildClassicalFlutedColumn(0.95);
    vCol.position.set(lx, y0, lz);
    heartGalleryGroup.add(vCol);
    registerLocalCollider(lx, lz, 0.34, 3.8);
  });

  // Floating glowing pink crystal hearts suspended in the upper atrium visible through the Main Archway
  [
    { lx: 2.8, ly: 3.45, lz: 2.35, s: 0.55 },
    { lx: 2.4, ly: 3.25, lz: 1.45, s: 0.65 },
    { lx: 2.8, ly: 3.4, lz: 0.55, s: 0.55 },
    { lx: 1.8, ly: 2.15, lz: 1.55, s: 0.72 },
  ].forEach(({ lx, ly, lz, s }) => {
    const vh = new THREE.Mesh(sideCrystalHeartGeo, floatingHeartCrystalMat);
    vh.position.set(lx, y0 + ly, lz);
    vh.rotation.y = Math.PI / 2;
    vh.scale.setScalar(s);
    heartGalleryGroup.add(vh);
  });

  // --- 1.8 FACETED PINK CRYSTAL WALL SCONCES (6 on West Wall + 2 on East Apse) ---
  const sconceBracketGeo = tracker.trackGeo(new THREE.BoxGeometry(0.12, 0.28, 0.14));
  const sconceLanternTopGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.26, 6));
  const sconceLanternBotGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.28, 6));
  sconceLanternBotGeo.rotateX(Math.PI);
  const sconceFinialGeo = tracker.trackGeo(new THREE.ConeGeometry(0.055, 0.18, 8));
  sconceFinialGeo.rotateX(Math.PI);
  const sconceBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 10, 10));
  const sconceWashPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.95, 1.15));

  const buildCrystalWallSconce = (lx: number, lz: number, rotY: number) => {
    const scGrp = new THREE.Group();
    scGrp.position.set(lx, y0 + 2.24, lz);
    scGrp.rotation.y = rotY;

    // Soft radial warm glow on the wall behind the sconce
    const washPlane = new THREE.Mesh(sconceWashPlaneGeo, sconceWallWashMat);
    washPlane.position.set(0, 0.04, 0.02);
    scGrp.add(washPlane);

    const wallPlate = new THREE.Mesh(sconceBracketGeo, galleryRoyalGoldMat);
    wallPlate.position.set(0, 0, 0.05);

    const arm = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.05, 0.05, 0.18)),
      galleryRoyalGoldMat,
    );
    arm.position.set(0, -0.06, 0.14);

    // Faceted diamond-lantern pink crystal shade + inner warm bulb + gold crown & bottom finial
    const lanternTop = new THREE.Mesh(sconceLanternTopGeo, floatingHeartCrystalMat);
    lanternTop.position.set(0, 0.14, 0.22);
    const lanternBot = new THREE.Mesh(sconceLanternBotGeo, floatingHeartCrystalMat);
    lanternBot.position.set(0, -0.13, 0.22);
    const innerBulb = new THREE.Mesh(sconceBulbGeo, galleryWarmLinearGlowMat);
    innerBulb.position.set(0, 0.01, 0.22);

    const goldRing = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.02, 8, 6)),
      galleryRoyalGoldMat,
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.set(0, 0.01, 0.22);

    const botFinial = new THREE.Mesh(sconceFinialGeo, galleryRoyalGoldMat);
    botFinial.position.set(0, -0.34, 0.22);

    scGrp.add(wallPlate, arm, lanternTop, lanternBot, innerBulb, goldRing, botFinial);
    heartGalleryGroup.add(scGrp);
  };

  // West Wall Sconces (Flanking North, Center, and South Portrait Exhibits)
  [7.68, 5.65, 3.62, -1.05, -3.85, -6.72, -11.75, -14.25].forEach((sz) => {
    buildCrystalWallSconce(4.98, sz, Math.PI / 2);
  });
  // East Apse Sconces flanking Exhibits 4, 5, 6 (Right Wall of the Gallery)
  [-5.15, -2.45, 0.60, -1.90].forEach((sz) => {
    buildCrystalWallSconce(14.66, sz, -Math.PI / 2);
  });
  // South Wall Sconces flanking South Curated Exhibits
  [6.8, 10.0, 13.2].forEach((sx) => {
    buildCrystalWallSconce(sx, -14.66, 0);
  });
  // North Wall Sconces flanking Exhibit 10 in the exact center of the wall (lx = 7.50)
  [6.25, 8.75].forEach((nx) => {
    buildCrystalWallSconce(nx, 7.63, Math.PI);
  });

  // --- 1.9 MARBLE & GOLD FLORAL PEDESTALS WITH HEART EMBLEMS & GOLD ROSE URNS ---
  const pedBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.74, 0.12, 0.74));
  const pedStepGeo = tracker.trackGeo(new THREE.BoxGeometry(0.66, 0.08, 0.66));
  const pedBodyGeo = tracker.trackGeo(new THREE.BoxGeometry(0.58, 0.68, 0.58));
  const pedCapGeo = tracker.trackGeo(new THREE.BoxGeometry(0.7, 0.09, 0.7));
  const pedGlowGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.026, 0.76));
  const pedHeartBezelGeo = buildExtrudedHeartGeometry(tracker, 0.28, 0.06, 0.02);
  const pedHeartGemGeo = buildExtrudedHeartGeometry(tracker, 0.22, 0.08, 0.02);

  const urnFootGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.17, 0.12, 16));
  const urnBowlGeo = tracker.trackGeo(new THREE.SphereGeometry(0.22, 18, 14));
  const urnRimGeo = tracker.trackGeo(new THREE.TorusGeometry(0.19, 0.026, 8, 20));
  urnRimGeo.rotateX(Math.PI / 2);
  const roseBloomGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.075, 1));
  const roseLeafGeo = tracker.trackGeo(new THREE.ConeGeometry(0.055, 0.14, 5));

  const buildFloralHeartPedestal = (lx: number, lz: number, rotY: number) => {
    const pedGrp = new THREE.Group();
    pedGrp.position.set(lx, y0, lz);
    pedGrp.rotation.y = rotY;

    // Stepped Gold Base + Warm Floor Edge Glow + Pearl-Blush Body + Stepped Gold Cap
    const floorGlow = new THREE.Mesh(pedGlowGeo, galleryWarmLinearGlowMat);
    floorGlow.position.set(0, 0.015, 0);
    const base = new THREE.Mesh(pedBaseGeo, galleryRoyalGoldMat);
    base.position.set(0, 0.07, 0);
    const step = new THREE.Mesh(pedStepGeo, galleryRoyalGoldMat);
    step.position.set(0, 0.16, 0);
    const body = new THREE.Mesh(pedBodyGeo, mats.pearlWhite);
    body.position.set(0, 0.54, 0);
    const cap = new THREE.Mesh(pedCapGeo, galleryRoyalGoldMat);
    cap.position.set(0, 0.92, 0);

    // Front Recessed Glowing Pink Heart Emblem in Gold Bezel
    const heartBezel = new THREE.Mesh(pedHeartBezelGeo, galleryRoyalGoldMat);
    heartBezel.position.set(0, 0.54, 0.295);
    const heartGem = new THREE.Mesh(pedHeartGemGeo, floatingHeartCrystalMat);
    heartGem.position.set(0, 0.54, 0.315);

    // Sculpted Gold Urn atop the Pedestal
    const urnFoot = new THREE.Mesh(urnFootGeo, galleryRoyalGoldMat);
    urnFoot.position.set(0, 1.02, 0);
    const urnBowl = new THREE.Mesh(urnBowlGeo, galleryRoyalGoldMat);
    urnBowl.position.set(0, 1.19, 0);
    urnBowl.scale.set(1.0, 0.88, 1.0);
    const urnRim = new THREE.Mesh(urnRimGeo, galleryRoyalGoldMat);
    urnRim.position.set(0, 1.32, 0);

    pedGrp.add(floorGlow, base, step, body, cap, heartBezel, heartGem, urnFoot, urnBowl, urnRim);

    // Lush Rounded Bouquet of Pink, Blush & Cream Roses with Green Foliage
    const roseMats = [galleryRoseDeepPinkMat, galleryRoseSoftPinkMat, galleryRoseCreamMat];
    for (let r = 0; r < 19; r++) {
      const ring = r === 0 ? 0 : r < 7 ? 1 : 2;
      const countInRing = ring === 1 ? 6 : 12;
      const idxInRing = ring === 1 ? r - 1 : r - 7;
      const ang = (idxInRing / countInRing) * Math.PI * 2 + ring * 0.4;
      const rad = ring === 0 ? 0 : ring === 1 ? 0.13 : 0.25;
      const ry = ring === 0 ? 1.56 : ring === 1 ? 1.51 : 1.41;

      const rose = new THREE.Mesh(roseBloomGeo, roseMats[r % 3]);
      rose.position.set(Math.cos(ang) * rad, ry, Math.sin(ang) * rad);
      rose.rotation.set(r * 0.5, ang, r * 0.3);
      pedGrp.add(rose);

      if (ring === 2 && r % 2 === 0) {
        const leaf = new THREE.Mesh(roseLeafGeo, galleryRoseLeafMat);
        leaf.position.set(Math.cos(ang) * 0.29, 1.35, Math.sin(ang) * 0.29);
        leaf.rotation.z = -Math.cos(ang) * 1.1;
        leaf.rotation.x = Math.sin(ang) * 1.1;
        pedGrp.add(leaf);
      }
    }

    heartGalleryGroup.add(pedGrp);
    registerLocalCollider(lx, lz, 0.42, 1.6);
  };

  // West-Wall Floral Pedestals at reference positions + East-Apse & South Wall Pedestals
  buildFloralHeartPedestal(5.38, 5.65, Math.PI / 2); // Between Left Portrait 1 & Portrait 2
  buildFloralHeartPedestal(5.38, -1.12, Math.PI / 2); // Between Right Main Arch Column & Portrait 3
  buildFloralHeartPedestal(5.38, -6.82, Math.PI / 2); // Between Portrait 4 & Secondary Right Archway
  buildFloralHeartPedestal(5.38, -14.15, Math.PI / 2); // Beside Portrait 8 on south-west wall
  buildFloralHeartPedestal(14.28, -5.25, -Math.PI / 2);
  buildFloralHeartPedestal(14.28, -2.35, -Math.PI / 2);
  buildFloralHeartPedestal(10.0, -14.26, 0); // South Wall between Hero & East exhibits
  buildFloralHeartPedestal(9.75, 7.35, Math.PI); // Portal opening corner of North Wall

  // --- 1.10 CENTRAL MEMORY COURT, FLUTED BLUSH-PEARL PEDESTAL, FOCAL CRYSTAL HEART & VELVET BENCHES ---
  const courtCenterX = 10.6;
  const courtCenterZ = -3.8;

  // Concentric Glowing Champagne-Gold Floor Medallion Rings (flush on the polished marble floor)
  [3.85, 2.65, 1.62].forEach((ringR, idx) => {
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(ringR, idx === 0 ? 0.042 : 0.032, 10, 56));
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      idx < 2 ? galleryWarmLinearGlowMat : galleryRoyalGoldMat,
    );
    ringMesh.position.set(courtCenterX, y0 + 0.025, courtCenterZ);
    heartGalleryGroup.add(ringMesh);
  });

  // Fluted Circular Blush-Pearl Pedestal with Wide Stepped Gold Base Ring & Under-Glow
  const heartPedestalGroup = new THREE.Group();
  heartPedestalGroup.position.set(courtCenterX, y0, courtCenterZ);

  const pedUnderGlow = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.56, 0.035, 8, 48)).rotateX(Math.PI / 2),
    galleryWarmLinearGlowMat,
  );
  pedUnderGlow.position.y = 0.028;

  const pedGoldBase1 = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.44, 1.56, 0.12, 40)),
    galleryRoyalGoldMat,
  );
  pedGoldBase1.position.y = 0.06;

  const pedGoldBase2 = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.22, 1.36, 0.12, 40)),
    galleryRoyalGoldMat,
  );
  pedGoldBase2.position.y = 0.16;

  const pedFlutedDrum = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.96, 1.16, 0.86, 36)),
    galleryBlushWallMat,
  );
  pedFlutedDrum.position.y = 0.64;

  // 28 Vertical Carved Flutes around the Circular Pedestal Drum
  const drumFluteGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.82, 6));
  for (let df = 0; df < 28; df++) {
    const ang = (df / 28) * Math.PI * 2;
    const flute = new THREE.Mesh(drumFluteGeo, mats.pearlWhite);
    flute.position.set(Math.cos(ang) * 1.05, 0.64, Math.sin(ang) * 1.05);
    flute.rotation.z = Math.cos(ang) * 0.22;
    flute.rotation.x = Math.sin(ang) * 0.22;
    heartPedestalGroup.add(flute);
  }

  const pedTopGoldCornice = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.12, 1.02, 0.12, 40)),
    galleryRoyalGoldMat,
  );
  pedTopGoldCornice.position.y = 1.11;

  const pedTopGlowRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.06, 0.03, 8, 40)).rotateX(Math.PI / 2),
    galleryWarmLinearGlowMat,
  );
  pedTopGlowRing.position.y = 1.18;

  heartPedestalGroup.add(
    pedUnderGlow,
    pedGoldBase1,
    pedGoldBase2,
    pedFlutedDrum,
    pedTopGoldCornice,
    pedTopGlowRing,
  );
  heartGalleryGroup.add(heartPedestalGroup);
  registerLocalCollider(courtCenterX, courtCenterZ, 1.48, 2.8);

  // Large Faceted Glowing Pink Crystal Heart Sculpture with Curving Gold Orbital Ribbons
  const floatingCrystalHeartPivot = new THREE.Group();
  floatingCrystalHeartPivot.position.set(courtCenterX, y0 + 2.08, courtCenterZ);
  const mainFloatingHeartGeo = buildExtrudedHeartGeometry(tracker, 1.48, 0.28, 0.068);
  const mainFloatingHeartMesh = new THREE.Mesh(mainFloatingHeartGeo, floatingHeartCrystalMat);
  const innerHeartCoreGeo = buildExtrudedHeartGeometry(tracker, 0.92, 0.16, 0.03);
  const innerHeartCoreMesh = new THREE.Mesh(innerHeartCoreGeo, galleryWarmLinearGlowMat);

  // Curving Gold Orbital Ribbons cradling the Focal Crystal Heart
  const floatingHeartHaloGeo = tracker.trackGeo(new THREE.TorusGeometry(1.05, 0.032, 12, 44));
  const floatingHeartHalo = new THREE.Mesh(floatingHeartHaloGeo, galleryRoyalGoldMat);
  const secondGoldRibbonGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.96, 0.028, 10, 40, Math.PI * 1.35),
  );
  const secondGoldRibbon = new THREE.Mesh(secondGoldRibbonGeo, galleryRoyalGoldMat);
  secondGoldRibbon.rotation.z = -Math.PI * 0.68;
  secondGoldRibbon.position.y = -0.12;

  floatingCrystalHeartPivot.add(
    mainFloatingHeartMesh,
    innerHeartCoreMesh,
    floatingHeartHalo,
    secondGoldRibbon,
  );
  heartGalleryGroup.add(floatingCrystalHeartPivot);

  // Restrained Instanced Crystal Light Motes orbiting the Focal Crystal Heart (Zero Dynamic Lights)
  const HEART_MOTE_COUNT = 18;
  const heartMoteGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.052, 0));
  const heartMoteInstanced = new THREE.InstancedMesh(
    heartMoteGeo,
    mats.warmLanternGlow,
    HEART_MOTE_COUNT,
  );
  heartMoteInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heartGalleryGroup.add(heartMoteInstanced);

  // Rectangular Rose-Burgundy Velvet Gallery Benches with Recessed Gold Plinth Bases
  // Positioned at exact reference coordinates flanking the circular court while keeping >= 3.0m clear promenade
  const benchCushionGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.32, 2.12));
  const benchTopPadGeo = tracker.trackGeo(new THREE.BoxGeometry(0.72, 0.08, 2.08));
  const benchGoldBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.74, 0.1, 2.1));
  const benchGlowStripGeo = tracker.trackGeo(new THREE.BoxGeometry(0.78, 0.024, 2.14));

  const buildGalleryVelvetBench = (bx: number, bz: number, rotY = 0) => {
    const bGrp = new THREE.Group();
    bGrp.position.set(bx, y0, bz);
    bGrp.rotation.y = rotY;

    const glow = new THREE.Mesh(benchGlowStripGeo, galleryWarmLinearGlowMat);
    glow.position.y = 0.014;
    const base = new THREE.Mesh(benchGoldBaseGeo, galleryRoyalGoldMat);
    base.position.y = 0.06;
    const cushion = new THREE.Mesh(benchCushionGeo, galleryBurgundyBenchMat);
    cushion.position.y = 0.26;
    const topPad = new THREE.Mesh(benchTopPadGeo, galleryBurgundyBenchMat);
    topPad.position.y = 0.44;

    bGrp.add(glow, base, cushion, topPad);
    heartGalleryGroup.add(bGrp);
    registerLocalCollider(bx, bz, 0.72, 0.9);
  };

  buildGalleryVelvetBench(7.55, -2.15, 0); // Foreground Right Bench in Reference
  buildGalleryVelvetBench(7.55, -7.65, 0); // Background Right Bench in Reference
  buildGalleryVelvetBench(13.35, -3.8, 0); // East Court Companion Bench

  // --- 1.11 10 INTERACTIVE MEMORY PORTRAITS IN VERTICAL ORNATE ROCOCO GOLD FRAMES ---
  // Preserves all existing gallery memories, custom photo persistence, and inspection controls,
  // while rendering all 10 portraits in the Heart Gallery (West Wall, East Apse, and Right Wall)
  // in vertical Rococo frames with top glowing pink heart crests, bottom gold cartouche plaques,
  // and physical overhead gold picture lights!
  const galleryMemories: GalleryMemory[] = [
    {
      title: 'First Starlight Kiss',
      subtitle: 'Central Plaza Fountain · Memory I',
      quote: '"Every star in the sky paused to watch us."',
      skyTop: '#9d174d',
      skyBottom: '#f472b6',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'The Crag Magic Flight',
      subtitle: 'Above Heart Island · Memory II',
      quote: '"I want you beside me across every horizon."',
      skyTop: '#831843',
      skyBottom: '#ec4899',
      accentColor: '#fbcfe8',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'The Royal Ballroom Waltz',
      subtitle: 'Pastel Dream Castle · Memory III',
      quote: '"Two hearts spinning in golden candlelight."',
      skyTop: '#78350f',
      skyBottom: '#fde68a',
      accentColor: '#facc15',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Sunset at the Gazebo',
      subtitle: 'Enchanted Rose Garden · Memory IV',
      quote: '"Where every petal whispers your name, Harsha."',
      skyTop: '#581c87',
      skyBottom: '#fda4af',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Two Hearts, One Light',
      subtitle: 'Aurora Underground Lake · Memory V',
      quote: '"Forever ours, written in crystal and starlight."',
      skyTop: '#1e1b4b',
      skyBottom: '#c084fc',
      accentColor: '#67e8f9',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Enchanted Twilight Pergola',
      subtitle: 'Palace Rose Terrace · Memory VI',
      quote: '"Under twilight roses, my heart found its forever home."',
      skyTop: '#581c87',
      skyBottom: '#f472b6',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Rose-Gold Lagoon Bridge',
      subtitle: 'Starlit Palace Lagoon · Memory VII',
      quote: '"Walking hand in hand where water meets the stars."',
      skyTop: '#311042',
      skyBottom: '#fb7185',
      accentColor: '#fde68a',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Balcony Golden Hour',
      subtitle: 'Palace Veranda · Memory VIII',
      quote: '"Golden sunlight caught in your smile, Harsha."',
      skyTop: '#831843',
      skyBottom: '#fb7185',
      accentColor: '#fef08a',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Yeshwanth & Harsha',
      subtitle: 'Royal Starlight Gazebo · Memory IX',
      quote: '"Two souls bound in endless love and devotion."',
      skyTop: '#2e1065',
      skyBottom: '#db2777',
      accentColor: '#fde047',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Crystal Fountain Garden',
      subtitle: 'Dream Palace Courtyard · Memory X',
      quote: '"Every splash of crystal water sparkles with our happiness."',
      skyTop: '#4c1d95',
      skyBottom: '#f472b6',
      accentColor: '#fde68a',
      customImage: null,
      customImageUrl: null,
    },
    {
      title: 'Starlight Dream Terrace',
      subtitle: 'North Palace Gallery · Memory XI',
      quote: '"Beneath the starlight crown, our forever begins."',
      skyTop: '#4a154b',
      skyBottom: '#f472b6',
      accentColor: '#fef08a',
      customImage: null,
      customImageUrl: null,
    },
  ];

  const galleryCanvases: HTMLCanvasElement[] = [];
  const galleryTextures: THREE.CanvasTexture[] = [];
  const galleryFrameHalos: THREE.MeshStandardMaterial[] = [];

  // Renders the vertical portrait canvases (512 x 680) matching painted subjects in the gallery
  // (or user-uploaded custom photos when present) without dark UI banners covering the artwork.
  const drawGalleryCanvas = (idx: number, isHighlighted: boolean) => {
    const canvas = galleryCanvases[idx];
    const tex = galleryTextures[idx];
    const mem = galleryMemories[idx];
    if (!canvas || !tex || !mem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 512;
    const H = 680;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (mem.customImage) {
      const img = mem.customImage;
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);
    } else if (idx === 0) {
      // PORTRAIT 1 (Outer Left in Reference): Romantic Couple Silhouette at Sunset by the Ocean
      const sky = ctx.createLinearGradient(0, 0, 0, 430);
      sky.addColorStop(0, '#c084fc');
      sky.addColorStop(0.38, '#f472b6');
      sky.addColorStop(0.72, '#fb923c');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 430);

      // Glowing sunset sun & soft pink clouds
      const sunGlow = ctx.createRadialGradient(270, 340, 10, 270, 340, 160);
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      sunGlow.addColorStop(0.35, 'rgba(254, 240, 138, 0.65)');
      sunGlow.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 140, W, 290);

      ctx.fillStyle = 'rgba(244, 114, 182, 0.38)';
      for (let c = 0; c < 7; c++) {
        ctx.beginPath();
        ctx.ellipse(90 + c * 62, 115 + (c % 3) * 42, 95, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shimmering sunset ocean horizon
      const sea = ctx.createLinearGradient(0, 425, 0, H);
      sea.addColorStop(0, '#f97316');
      sea.addColorStop(0.35, '#be185d');
      sea.addColorStop(1, '#4c0519');
      ctx.fillStyle = sea;
      ctx.fillRect(0, 425, W, H - 425);

      ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
      for (let w = 0; w < 14; w++) {
        ctx.fillRect(190 + (w % 3) * 12, 432 + w * 14, 130 - w * 6, 4);
      }

      // Couple standing close together looking out at the sunset ocean (Her on left, Him on right)
      ctx.fillStyle = '#3b0a20';
      ctx.beginPath();
      ctx.arc(198, 412, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(138, H);
      ctx.quadraticCurveTo(155, 480, 206, 456);
      ctx.quadraticCurveTo(245, 480, 256, H);
      ctx.closePath();
      ctx.fillStyle = '#9d174d';
      ctx.fill();

      // His silhouette & warm linen shirt beside her
      ctx.fillStyle = '#2a0815';
      ctx.beginPath();
      ctx.arc(296, 386, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(232, H);
      ctx.quadraticCurveTo(242, 455, 302, 438);
      ctx.quadraticCurveTo(372, 455, 396, H);
      ctx.closePath();
      ctx.fillStyle = '#7c2d12';
      ctx.fill();
    } else if (idx === 1) {
      // PORTRAIT 2 (Inner Left in Reference): Macro Blooming Pink Rose with Water Droplets
      const bg = ctx.createRadialGradient(256, 340, 40, 256, 340, 380);
      bg.addColorStop(0, '#f472b6');
      bg.addColorStop(0.65, '#831843');
      bg.addColorStop(1, '#1f2937');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Soft emerald garden bokeh leaves in corners
      ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
      ctx.beginPath();
      ctx.ellipse(75, 590, 95, 48, -0.5, 0, Math.PI * 2);
      ctx.ellipse(430, 120, 85, 44, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Concentric multi-layered velvety pink rose petals
      const cx = 256;
      const cy = 355;
      for (let ring = 6; ring >= 0; ring--) {
        const count = 5 + ring * 2;
        const rDist = 18 + ring * 31;
        const pRadX = 28 + ring * 16;
        const pRadY = 22 + ring * 12;
        for (let p = 0; p < count; p++) {
          const ang = (p / count) * Math.PI * 2 + ring * 0.52;
          const px = cx + Math.cos(ang) * rDist;
          const py = cy + Math.sin(ang) * rDist * 0.92;
          const pGrad = ctx.createRadialGradient(px, py - 8, 4, px, py, pRadX);
          pGrad.addColorStop(0, '#fbcfe8');
          pGrad.addColorStop(0.55, '#f472b6');
          pGrad.addColorStop(1, '#be185d');

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang + Math.PI * 0.5);
          ctx.beginPath();
          ctx.ellipse(0, 0, pRadX, pRadY, 0, 0, Math.PI * 2);
          ctx.fillStyle = pGrad;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 241, 242, 0.38)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Glistening crystal dewdrops on the rose petals
      for (let d = 0; d < 22; d++) {
        const dx = 110 + ((d * 67) % 292);
        const dy = 195 + ((d * 53) % 310);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5 + (d % 3) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (idx === 2) {
      // PORTRAIT 3 (Inner Right in Reference): Couple Embracing in a Sunlit Golden Palace Colonnade
      const glow = ctx.createRadialGradient(256, 260, 20, 256, 340, 390);
      glow.addColorStop(0, '#fef9c3');
      glow.addColorStop(0.35, '#fbbf24');
      glow.addColorStop(0.75, '#92400e');
      glow.addColorStop(1, '#451a03');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Perspective golden palace arches & columns
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 14;
      [48, 118, 394, 464].forEach((colX) => {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(colX - 18, 90, 36, 470);
      });
      ctx.beginPath();
      ctx.arc(256, 220, 195, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(256, 235, 138, Math.PI, 0);
      ctx.stroke();

      // Warm hanging fairy lights along the archways
      ctx.fillStyle = '#ffffff';
      for (let f = 0; f < 26; f++) {
        const fx = 65 + ((f * 37) % 380);
        const fy = 70 + ((f * 29) % 190);
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Couple silhouette embracing in the golden colonnade center
      ctx.fillStyle = '#291005';
      ctx.beginPath();
      ctx.arc(236, 368, 22, 0, Math.PI * 2);
      ctx.arc(276, 354, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(198, 585);
      ctx.lineTo(220, 392);
      ctx.lineTo(292, 382);
      ctx.lineTo(312, 585);
      ctx.closePath();
      ctx.fill();
    } else if (idx === 3) {
      // PORTRAIT 4 (Outer Right in Reference): Fairytale Spired Castle at Sunset over Reflecting Water
      const sky = ctx.createLinearGradient(0, 0, 0, 440);
      sky.addColorStop(0, '#a855f7');
      sky.addColorStop(0.45, '#f472b6');
      sky.addColorStop(0.82, '#fb923c');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 440);

      // Reflecting sunset water below
      const water = ctx.createLinearGradient(0, 440, 0, H);
      water.addColorStop(0, '#f472b6');
      water.addColorStop(0.5, '#7e22ce');
      water.addColorStop(1, '#3b0764');
      ctx.fillStyle = water;
      ctx.fillRect(0, 440, W, H - 440);

      // Fairytale multi-spired castle silhouette
      ctx.fillStyle = '#4c1d95';
      const towers = [
        { x: 145, w: 36, h: 170, spireH: 65 },
        { x: 195, w: 44, h: 220, spireH: 80 },
        { x: 256, w: 58, h: 285, spireH: 105 },
        { x: 318, w: 46, h: 230, spireH: 85 },
        { x: 368, w: 34, h: 165, spireH: 60 },
      ];
      towers.forEach((t) => {
        const baseY = 440 - t.h;
        ctx.fillRect(t.x - t.w * 0.5, baseY, t.w, t.h);
        ctx.beginPath();
        ctx.moveTo(t.x - t.w * 0.62, baseY);
        ctx.lineTo(t.x, baseY - t.spireH);
        ctx.lineTo(t.x + t.w * 0.62, baseY);
        ctx.closePath();
        ctx.fill();
      });

      // Warm glowing castle windows & water reflections
      ctx.fillStyle = '#fef08a';
      for (let w = 0; w < 18; w++) {
        const wx = 155 + ((w * 29) % 205);
        const wy = 240 + ((w * 37) % 185);
        ctx.fillRect(wx, wy, 6, 12);
        ctx.fillRect(wx - 8, 455 + (w * 11), 22, 3);
      }
    } else if (idx === 4) {
      // PORTRAIT 5 (East Royal Apse Hero Exhibit): Two Hearts, One Light over Starlight Lake
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mem.skyTop);
      sky.addColorStop(0.6, mem.skyBottom);
      sky.addColorStop(1, '#3b0764');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let s = 0; s < 36; s++) {
        const sx = ((s * 97) % 460) + 26;
        const sy = ((s * 61) % 320) + 24;
        ctx.beginPath();
        ctx.arc(sx, sy, (s % 3) + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(256, 310);
      ctx.fillStyle = '#fbcfe8';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 28;
      ctx.font = 'bold 120px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
      ctx.restore();
    } else if (idx === 5) {
      // PORTRAIT 6 (North-East Apse): Enchanted Pastel Rose Garden Pergola at Twilight
      const sky = ctx.createLinearGradient(0, 0, 0, 420);
      sky.addColorStop(0, '#581c87');
      sky.addColorStop(0.48, '#be185d');
      sky.addColorStop(0.85, '#f472b6');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 420);

      const pathGrad = ctx.createLinearGradient(0, 420, 0, H);
      pathGrad.addColorStop(0, '#fbcfe8');
      pathGrad.addColorStop(0.5, '#9d174d');
      pathGrad.addColorStop(1, '#3b0764');
      ctx.fillStyle = pathGrad;
      ctx.fillRect(0, 420, W, H - 420);

      // Classical garden pergola columns & arch in soft silhouette
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 10;
      ctx.strokeRect(108, 165, 296, 360);
      ctx.beginPath();
      ctx.arc(256, 165, 148, Math.PI, 0);
      ctx.stroke();

      // Climbing pastel rose blossoms & warm lantern motes
      for (let r = 0; r < 28; r++) {
        const ang = (r / 28) * Math.PI;
        const rx = 256 + Math.cos(ang) * 148 + ((r % 3) - 1) * 12;
        const ry = 165 - Math.sin(ang) * 148 + ((r % 2) * 10);
        ctx.fillStyle = r % 2 === 0 ? '#fbcfe8' : '#f472b6';
        ctx.beginPath();
        ctx.arc(rx, ry, 14 + (r % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (idx === 6) {
      // PORTRAIT 7 (South-East Apse): Dreamy Rose-Gold Palace Bridge & Starlit Lagoon
      const sky = ctx.createLinearGradient(0, 0, 0, 400);
      sky.addColorStop(0, '#311042');
      sky.addColorStop(0.45, '#9d174d');
      sky.addColorStop(0.82, '#fb7185');
      sky.addColorStop(1, '#fde68a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 400);

      const lagoon = ctx.createLinearGradient(0, 400, 0, H);
      lagoon.addColorStop(0, '#f472b6');
      lagoon.addColorStop(0.55, '#701a75');
      lagoon.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = lagoon;
      ctx.fillRect(0, 400, W, H - 400);

      // Graceful arched palace bridge & shimmering reflections
      ctx.fillStyle = '#4a044e';
      ctx.beginPath();
      ctx.moveTo(56, 415);
      ctx.quadraticCurveTo(256, 310, 456, 415);
      ctx.lineTo(456, 435);
      ctx.quadraticCurveTo(256, 355, 56, 435);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
      for (let l = 0; l < 11; l++) {
        const lxPos = 86 + l * 34;
        const u = (lxPos - 256) / 200;
        const lyPos = 355 + u * u * 55;
        ctx.beginPath();
        ctx.arc(lxPos, lyPos, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(lxPos - 8, 445 + l * 14, 16, 3);
      }
    } else if (idx === 7) {
      // PORTRAIT 8 (Right-Wall Left): Romantic Rose & Palace Balcony Memory at Golden Hour
      const sky = ctx.createLinearGradient(0, 0, 0, 440);
      sky.addColorStop(0, '#831843');
      sky.addColorStop(0.38, '#db2777');
      sky.addColorStop(0.75, '#fb7185');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 440);

      const terrace = ctx.createLinearGradient(0, 430, 0, H);
      terrace.addColorStop(0, '#fda4af');
      terrace.addColorStop(0.45, '#9d174d');
      terrace.addColorStop(1, '#4c0519');
      ctx.fillStyle = terrace;
      ctx.fillRect(0, 430, W, H - 430);

      // Golden sunset glow orb over the horizon
      const sunGlow = ctx.createRadialGradient(256, 340, 14, 256, 340, 175);
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      sunGlow.addColorStop(0.35, 'rgba(254, 240, 138, 0.72)');
      sunGlow.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 140, W, 300);

      // Classical palace balcony balustrade & twin marble columns
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(48, 425, W - 96, 18);
      ctx.fillRect(48, 535, W - 96, 22);
      for (let b = 0; b < 9; b++) {
        ctx.fillRect(72 + b * 44, 443, 14, 92);
      }

      // Lush cascading pink & blush roses framing the upper balcony arch
      for (let r = 0; r < 24; r++) {
        const ang = (r / 23) * Math.PI;
        const rx = 256 + Math.cos(ang) * 185;
        const ry = 215 - Math.sin(ang) * 145 + (r % 3) * 12;
        ctx.fillStyle = r % 3 === 0 ? '#fff1f2' : r % 2 === 0 ? '#fbcfe8' : '#f472b6';
        ctx.beginPath();
        ctx.arc(rx, ry, 20 + (r % 3) * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (idx === 8) {
      // PORTRAIT 9 (Right-Wall Center Hero): Yeshwanth & Harsha Romantic Memory
      const bg = ctx.createRadialGradient(256, 285, 24, 256, 340, 410);
      bg.addColorStop(0, '#fffbeb');
      bg.addColorStop(0.28, '#fde047');
      bg.addColorStop(0.58, '#db2777');
      bg.addColorStop(0.85, '#701a75');
      bg.addColorStop(1, '#2e1065');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Ornate golden royal arch & twin fluted columns framing Yeshwanth and Harsha
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(256, 250, 176, Math.PI, 0);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(256, 250, 152, Math.PI, 0);
      ctx.stroke();

      [80, 432].forEach((colX) => {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(colX - 18, 250, 36, 360);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(colX - 24, 242, 48, 16);
      });

      // Glowing pink heart emblem at the top of the painted gazebo arch
      ctx.save();
      ctx.translate(256, 92);
      ctx.fillStyle = '#fbcfe8';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 24;
      ctx.font = 'bold 54px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
      ctx.restore();

      // Cascading fairy-light sparkles around the arch
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 30; s++) {
        const sx = 95 + ((s * 43) % 322);
        const sy = 115 + ((s * 29) % 210);
        ctx.beginPath();
        ctx.arc(sx, sy, 2.8 + (s % 2) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Yeshwanth & Harsha standing close together holding hands in golden starlight
      ctx.fillStyle = '#4c0519';
      ctx.beginPath();
      ctx.arc(224, 356, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9d174d';
      ctx.beginPath();
      ctx.moveTo(168, 600);
      ctx.quadraticCurveTo(192, 425, 226, 386);
      ctx.quadraticCurveTo(254, 425, 266, 600);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#3b0764';
      ctx.beginPath();
      ctx.arc(286, 342, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.moveTo(248, 600);
      ctx.quadraticCurveTo(256, 412, 288, 374);
      ctx.quadraticCurveTo(324, 412, 342, 600);
      ctx.closePath();
      ctx.fill();

      // Golden tribute script at the bottom of the hero canvas
      ctx.save();
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = 'rgba(120, 53, 15, 0.85)';
      ctx.shadowBlur = 10;
      ctx.font = 'italic bold 24px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Yeshwanth & Harsha', 256, 638);
      ctx.restore();
    } else if (idx === 9) {
      // PORTRAIT 10 (Right-Wall Right): Dreamy Palace Courtyard & Crystal Fountain Garden Memory
      const sky = ctx.createLinearGradient(0, 0, 0, 410);
      sky.addColorStop(0, '#4c1d95');
      sky.addColorStop(0.45, '#be185d');
      sky.addColorStop(0.82, '#f472b6');
      sky.addColorStop(1, '#fef08a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 410);

      const garden = ctx.createLinearGradient(0, 410, 0, H);
      garden.addColorStop(0, '#fbcfe8');
      garden.addColorStop(0.45, '#831843');
      garden.addColorStop(1, '#311042');
      ctx.fillStyle = garden;
      ctx.fillRect(0, 410, W, H - 410);

      // Distant pastel palace domes & spires
      ctx.fillStyle = '#581c87';
      [150, 256, 362].forEach((tx, pIdx) => {
        const w = pIdx === 1 ? 74 : 48;
        const h = pIdx === 1 ? 210 : 155;
        ctx.fillRect(tx - w * 0.5, 410 - h, w, h);
        ctx.beginPath();
        ctx.arc(tx, 410 - h, w * 0.5, Math.PI, 0);
        ctx.fill();
      });

      // Glowing crystal heart fountain in the garden foreground
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(256, 520, 128, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(256, 520, 112, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(256, 448);
      ctx.fillStyle = '#fff1f2';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 20;
      ctx.font = 'bold 46px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
      ctx.restore();
    } else {
      // PORTRAIT 11 (North Wall Center): Starlight Dream Palace Terrace & Glowing Heart Constellation
      const sky = ctx.createLinearGradient(0, 0, 0, 420);
      sky.addColorStop(0, '#311042');
      sky.addColorStop(0.38, '#701a75');
      sky.addColorStop(0.75, '#db2777');
      sky.addColorStop(1, '#fde047');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 420);

      const terrace = ctx.createLinearGradient(0, 420, 0, H);
      terrace.addColorStop(0, '#fbcfe8');
      terrace.addColorStop(0.5, '#9d174d');
      terrace.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = terrace;
      ctx.fillRect(0, 420, W, H - 420);

      // Golden crescent moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(380, 115, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#311042';
      ctx.beginPath();
      ctx.arc(394, 107, 30, 0, Math.PI * 2);
      ctx.fill();

      // Twinkling starlight motes across the night sky
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 32; s++) {
        const sx = 35 + ((s * 49) % 440);
        const sy = 25 + ((s * 33) % 350);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + (s % 3) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Classical marble palace terrace balustrade
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(40, 410, W - 80, 16);
      ctx.fillRect(40, 520, W - 80, 20);
      for (let b = 0; b < 10; b++) {
        ctx.fillRect(65 + b * 40, 426, 14, 94);
      }

      // Grand starlight gazebo arch with glowing heart crest
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(256, 260, 140, Math.PI, 0);
      ctx.stroke();

      ctx.save();
      ctx.translate(256, 120);
      ctx.fillStyle = '#fbcfe8';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 24;
      ctx.font = 'bold 50px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
      ctx.restore();
    }

    // Subtle inner golden picture mat border (keeps the painting unobstructed)
    ctx.strokeStyle = isHighlighted ? '#fef08a' : 'rgba(253, 224, 71, 0.65)';
    ctx.lineWidth = isHighlighted ? 10 : 6;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    tex.needsUpdate = true;
  };

  interface GalleryExhibitPlacement {
    lx: number;
    lz: number;
    rotY: number;
    camDist: number;
    scaleMult?: number;
    isHeroExhibit?: boolean;
  }

  // Exact Reference-Locked Portrait Placements:
  // - Exhibits 0..3: West Colonnade Wall (North & Center segments)
  // - Exhibit 4: East Royal Apse Wall (Center Hero)
  // - Exhibit 5: East Royal Apse Wall (North segment - Right Wall restored!)
  // - Exhibit 6: East Royal Apse Wall (South segment - Right Wall)
  // - Exhibit 7: West Colonnade Wall South of Secondary Archway (User requested wall from screenshot!)
  // - Exhibits 8..9: South Curated Wall (Center Hero + East Exhibit, facing North into gallery)
  // - Exhibit 10: North Wall (Centered at lx 7.50, lz 7.63, facing South into gallery)
  const exhibitPlacements: GalleryExhibitPlacement[] = [
    { lx: 4.98, lz: 6.68, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: 4.62, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: -2.35, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: -5.35, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 14.66, lz: -3.8, rotY: -Math.PI * 0.5, camDist: 2.85, isHeroExhibit: true },
    { lx: 14.66, lz: -0.65, rotY: -Math.PI * 0.5, camDist: 2.65 },
    { lx: 14.66, lz: -6.95, rotY: -Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: -13.0, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 8.40, lz: -14.66, rotY: 0, camDist: 2.75, isHeroExhibit: true, scaleMult: 1.08 },
    { lx: 11.60, lz: -14.66, rotY: 0, camDist: 2.65 },
    { lx: 7.50, lz: 7.63, rotY: Math.PI, camDist: 2.65 },
  ];

  // Shared Geometries for Vertical Ornate Rococo Gold Portrait Frames (1.46m wide x 1.92m tall)
  const frameW = 1.46;
  const frameH = 1.92;
  const artW = 1.22;
  const artH = 1.62;

  const frameShadowBackGeo = tracker.trackGeo(new THREE.BoxGeometry(frameW + 0.08, frameH + 0.08, 0.04));
  const frameOuterHorizGeo = tracker.trackGeo(new THREE.BoxGeometry(frameW + 0.06, 0.11, 0.11));
  const frameOuterVertGeo = tracker.trackGeo(new THREE.BoxGeometry(0.11, frameH + 0.06, 0.11));
  const frameInnerHorizGeo = tracker.trackGeo(new THREE.BoxGeometry(artW + 0.1, 0.065, 0.135));
  const frameInnerVertGeo = tracker.trackGeo(new THREE.BoxGeometry(0.065, artH + 0.1, 0.135));
  const frameCornerScrollGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.13, 0.028, 8, 16, Math.PI * 1.45),
  );
  const frameTopHeartBezelGeo = buildExtrudedHeartGeometry(tracker, 0.36, 0.09, 0.03);
  const frameTopHeartGemGeo = buildExtrudedHeartGeometry(tracker, 0.27, 0.12, 0.03);
  const frameBottomPlaqueGeo = tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.14, 0.06));
  const frameCanvasGeo = tracker.trackGeo(new THREE.PlaneGeometry(artW, artH));

  // Shared Geometries for the Physical Gold Overhead Picture Light & Downward Light Spill
  const picLightCanopyGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 0.06, 16));
  picLightCanopyGeo.rotateX(Math.PI / 2);
  const picLightArmGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10));
  picLightArmGeo.rotateX(Math.PI / 2);
  const picLightHoodGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.16, 18, 1, true));
  const picLightBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.048, 10, 10));
  const picWallWashPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.95, 2.35));
  const picBeamConeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.78, 1.85, 18, 1, true));

  const picBeamConeMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef9c3'),
      transparent: true,
      opacity: 0.085,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const frameHeroPlaqueBackGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.18, 0.05));
  const frameHeroPlaqueHeartGeo = buildExtrudedHeartGeometry(tracker, 0.11, 0.04, 0.015);

  // Reusable builder for all physical portrait exhibits (5 interactive memories + decorative architectural portraits)
  // Guarantees identical 3D Rococo frame geometry, top glowing pink heart crest, bottom gold plaque,
  // and physical overhead gold picture-light fixture + warm bulb + downward beam cone + wall wash.
  const buildGalleryPortraitExhibit = (
    lx: number,
    lz: number,
    rotY: number,
    scaleMult: number,
    tex: THREE.CanvasTexture,
    outerFrameMat: THREE.Material,
    isWallHero = false,
  ) => {
    const exhibitGroup = new THREE.Group();
    exhibitGroup.position.set(lx, y0, lz);
    exhibitGroup.rotation.y = rotY;
    exhibitGroup.scale.setScalar(scaleMult);

    // Keep world-space vertical center consistently aligned at y0 + 2.22m across all frame scales
    const centerY = 2.22 / scaleMult;

    // 1. Warm Downward Wall-Wash Spill Plane behind & above the Portrait Frame
    const wallWash = new THREE.Mesh(picWallWashPlaneGeo, portraitWallWashMat);
    wallWash.position.set(0, centerY + 0.36, 0.015);
    exhibitGroup.add(wallWash);

    // 2. Dark Contact-Shadow Backing Plate
    const shadowBack = new THREE.Mesh(frameShadowBackGeo, galleryShadowBackingMat);
    shadowBack.position.set(0, centerY, 0.03);
    exhibitGroup.add(shadowBack);

    // 3. Multi-Layered 3D Molded Champagne-Gold Portrait Frame
    const topRail = new THREE.Mesh(frameOuterHorizGeo, outerFrameMat);
    topRail.position.set(0, centerY + frameH * 0.5, 0.075);
    const botRail = new THREE.Mesh(frameOuterHorizGeo, outerFrameMat);
    botRail.position.set(0, centerY - frameH * 0.5, 0.075);
    const leftRail = new THREE.Mesh(frameOuterVertGeo, outerFrameMat);
    leftRail.position.set(-frameW * 0.5, centerY, 0.075);
    const rightRail = new THREE.Mesh(frameOuterVertGeo, outerFrameMat);
    rightRail.position.set(frameW * 0.5, centerY, 0.075);

    const inTop = new THREE.Mesh(frameInnerHorizGeo, galleryRoyalGoldMat);
    inTop.position.set(0, centerY + artH * 0.5 + 0.02, 0.09);
    const inBot = new THREE.Mesh(frameInnerHorizGeo, galleryRoyalGoldMat);
    inBot.position.set(0, centerY - artH * 0.5 - 0.02, 0.09);
    const inLeft = new THREE.Mesh(frameInnerVertGeo, galleryRoyalGoldMat);
    inLeft.position.set(-artW * 0.5 - 0.02, centerY, 0.09);
    const inRight = new THREE.Mesh(frameInnerVertGeo, galleryRoyalGoldMat);
    inRight.position.set(artW * 0.5 + 0.02, centerY, 0.09);

    exhibitGroup.add(topRail, botRail, leftRail, rightRail, inTop, inBot, inLeft, inRight);

    // 4. Sculpted Corner Rococo Scroll Flourishes at all 4 Corners
    [
      { cx: -frameW * 0.5, cy: centerY + frameH * 0.5, rz: 0.4 },
      { cx: frameW * 0.5, cy: centerY + frameH * 0.5, rz: -2.0 },
      { cx: -frameW * 0.5, cy: centerY - frameH * 0.5, rz: 2.0 },
      { cx: frameW * 0.5, cy: centerY - frameH * 0.5, rz: -0.4 },
    ].forEach(({ cx, cy, rz }) => {
      const scroll = new THREE.Mesh(frameCornerScrollGeo, galleryRoyalGoldMat);
      scroll.position.set(cx, cy, 0.11);
      scroll.rotation.z = rz;
      exhibitGroup.add(scroll);
    });

    // 5. Top-Center Glowing Faceted Pink Heart Gem inside Ornate Gold Heart Crest + Flanking Scroll Wings
    const topCrestY = centerY + frameH * 0.5 + 0.14;
    const topHeartBezel = new THREE.Mesh(frameTopHeartBezelGeo, galleryRoyalGoldMat);
    topHeartBezel.position.set(0, topCrestY, 0.11);
    const topHeartGem = new THREE.Mesh(frameTopHeartGemGeo, floatingHeartCrystalMat);
    topHeartGem.position.set(0, topCrestY, 0.14);
    exhibitGroup.add(topHeartBezel, topHeartGem);

    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(frameCornerScrollGeo, galleryRoyalGoldMat);
      wing.position.set(side * 0.28, topCrestY - 0.06, 0.11);
      wing.rotation.z = side * -0.65;
      exhibitGroup.add(wing);
    });

    // 6. Bottom-Center Curved Gold Cartouche Nameplate Plaque (with extra detailed backing & heart cameo on Wall-Hero frames)
    const plaque = new THREE.Mesh(frameBottomPlaqueGeo, galleryRoyalGoldMat);
    plaque.position.set(0, centerY - frameH * 0.5 - 0.02, 0.12);
    exhibitGroup.add(plaque);

    if (isWallHero) {
      const heroPlaqueBack = new THREE.Mesh(frameHeroPlaqueBackGeo, outerFrameMat);
      heroPlaqueBack.position.set(0, centerY - frameH * 0.5 - 0.02, 0.105);
      const heroPlaqueHeart = new THREE.Mesh(frameHeroPlaqueHeartGeo, floatingHeartCrystalMat);
      heroPlaqueHeart.position.set(0, centerY - frameH * 0.5 - 0.02, 0.155);
      exhibitGroup.add(heroPlaqueBack, heroPlaqueHeart);
    }

    // 7. Portrait Canvas Surface (Lit from above by the Picture Light — non-self-luminous UI look)
    const artMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color('#fff1f2'),
        emissiveMap: tex,
        emissiveIntensity: isWallHero ? 0.48 : 0.42,
        roughness: 0.26,
        metalness: 0.02,
        side: THREE.FrontSide,
      }),
    );
    const artMesh = new THREE.Mesh(frameCanvasGeo, artMat);
    artMesh.position.set(0, centerY, 0.088);
    exhibitGroup.add(artMesh);

    // 8. Physical Gold Overhead Picture-Light Fixture + Downward Light Cone
    const fixtureY = centerY + frameH * 0.5 + 0.56;
    const canopy = new THREE.Mesh(picLightCanopyGeo, galleryRoyalGoldMat);
    canopy.position.set(0, fixtureY, 0.03);
    const arm = new THREE.Mesh(picLightArmGeo, galleryRoyalGoldMat);
    arm.position.set(0, fixtureY, 0.14);
    const hood = new THREE.Mesh(picLightHoodGeo, galleryRoyalGoldMat);
    hood.position.set(0, fixtureY - 0.05, 0.25);
    hood.rotation.x = -0.22;
    const bulb = new THREE.Mesh(picLightBulbGeo, galleryWarmLinearGlowMat);
    bulb.position.set(0, fixtureY - 0.09, 0.24);

    const beamCone = new THREE.Mesh(picBeamConeGeo, picBeamConeMat);
    beamCone.position.set(0, fixtureY - 0.92, 0.18);
    beamCone.rotation.x = -0.08;
    beamCone.scale.set(1.05, 1.0, 0.35);

    exhibitGroup.add(canopy, arm, hood, bulb, beamCone);
    heartGalleryGroup.add(exhibitGroup);
    return exhibitGroup;
  };

  const interactivePortraitExhibits: InteractivePortraitExhibit[] = [];
  let savedPlacements: Record<string, { position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] }> = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(GALLERY_PLACEMENT_STORAGE_KEY) : null;
    if (raw) {
      savedPlacements = JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse issues
  }

  // Instantiate all 10 Interactive Memory Portraits (indices 0..9)
  for (let i = 0; i < galleryMemories.length; i++) {
    const p = exhibitPlacements[i];
    const scaleMult = p.scaleMult ?? (p.isHeroExhibit ? 1.08 : 1.0);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    galleryCanvases.push(canvas);

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    galleryTextures.push(tex);

    drawGalleryCanvas(i, i === 0);

    const haloMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: p.isHeroExhibit ? new THREE.Color('#fde047') : new THREE.Color('#f5d076'),
        emissive: new THREE.Color('#fbbf24'),
        emissiveIntensity: i === 0 ? 0.55 : p.isHeroExhibit ? 0.36 : 0.24,
        roughness: 0.18,
        metalness: 0.85,
      }),
    );
    galleryFrameHalos.push(haloMat);

    const exhibitGroup = buildGalleryPortraitExhibit(p.lx, p.lz, p.rotY, scaleMult, tex, haloMat, Boolean(p.isHeroExhibit));
    const exhibitId = `portrait-${i}`;
    exhibitGroup.name = `GalleryExhibit_${exhibitId}`;

    const defaultTransform = {
      position: [p.lx, y0, p.lz] as [number, number, number],
      rotation: [0, p.rotY, 0] as [number, number, number],
      scale: [scaleMult, scaleMult, scaleMult] as [number, number, number],
    };

    // Apply saved manual placement if present in localStorage
    if (savedPlacements[exhibitId]) {
      const sp = savedPlacements[exhibitId];
      if (Array.isArray(sp.position) && sp.position.length === 3) {
        exhibitGroup.position.set(sp.position[0], sp.position[1], sp.position[2]);
      }
      if (Array.isArray(sp.rotation) && sp.rotation.length === 3) {
        exhibitGroup.rotation.set(sp.rotation[0], sp.rotation[1], sp.rotation[2]);
      }
      if (Array.isArray(sp.scale) && sp.scale.length === 3) {
        exhibitGroup.scale.set(sp.scale[0], sp.scale[1], sp.scale[2]);
      }
      exhibitGroup.updateMatrixWorld(true);
    }

    interactivePortraitExhibits.push({
      id: exhibitId,
      name: galleryMemories[i].title,
      group: exhibitGroup,
      defaultTransform,
    });
  }

  const applySavedGalleryImage = (frameIndex: number, imageSrc: string, persist = true) => {
    if (frameIndex < 0 || frameIndex >= galleryMemories.length) return;
    if (!imageSrc || !imageSrc.trim()) {
      galleryMemories[frameIndex].customImage = null;
      galleryMemories[frameIndex].customImageUrl = null;
      if (persist) {
        try {
          window.localStorage.removeItem(`${GALLERY_STORAGE_KEY_PREFIX}${frameIndex}`);
        } catch {
          // Ignore storage restrictions
        }
      }
      drawGalleryCanvas(frameIndex, true);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      galleryMemories[frameIndex].customImage = img;
      galleryMemories[frameIndex].customImageUrl = imageSrc;
      if (persist) {
        try {
          window.localStorage.setItem(`${GALLERY_STORAGE_KEY_PREFIX}${frameIndex}`, imageSrc);
        } catch {
          // Ignore quota issues
        }
      }
      drawGalleryCanvas(frameIndex, true);
    };
    img.src = imageSrc;
  };

  if (typeof window !== 'undefined') {
    for (let i = 0; i < galleryMemories.length; i++) {
      try {
        const saved = window.localStorage.getItem(`${GALLERY_STORAGE_KEY_PREFIX}${i}`);
        if (saved) {
          applySavedGalleryImage(i, saved, false);
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }

  // --- 1.12 ROSE PETAL DOME CEILING (REFERENCE-LOCKED ROYAL ARCHITECTURAL DOME) ---
  // Recreates the exact Rose Petal Dome reference ceiling inside the Heart Gallery:
  // - Placed below the Floor 4 slab (bottom at y0 + 4.55m) with the backing plane at the very TOP (y0 + 4.53m)
  //   so zero flat geometry ever blocks or occludes the upward-arching 3D petals when viewed from below.
  // - Concentric 6-petal inner bloom + 6 alternating middle petals + 6 outer vault petals with 3D champagne-gold
  //   tubular ribs, warm glowing seam light, faceted crystal drop sconces at every petal tip, and the central
  //   Royal Gold Crown Chandelier suspending a multi-faceted glowing pink crystal heart with 5 bottom crystal drops.
  const rosePetalDomeGroup = new THREE.Group();
  rosePetalDomeGroup.name = 'HeartGalleryRosePetalDomeCeiling';
  const domeBaseY = y0 + 4.34; // Cornice level at top of 4.35m Heart Gallery walls
  rosePetalDomeGroup.position.set(0, domeBaseY, 0);
  heartGalleryGroup.add(rosePetalDomeGroup);

  // 1.12A Silky Rose-Petal Vault Texture with Baked Seam Cove Glow & Delicate Petal Striations
  // UV mapping: u in [0, 1] across petal width (0 and 1 are the gold rib seams, 0.5 is petal center),
  //             v in [0, 1] along petal length (0 is inner crown ring, 1 is pointed petal tip).
  const createRosePetalSilkTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Base rich romantic rose-pink silk fill
      const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
      baseGrad.addColorStop(0.0, '#fff1f2'); // Bright warm glow near central crown
      baseGrad.addColorStop(0.18, '#f9a8d4'); // Soft blush-pink upper vault
      baseGrad.addColorStop(0.55, '#ec4899'); // Deep romantic rose-pink center belly
      baseGrad.addColorStop(0.84, '#f472b6'); // Soft rose taper
      baseGrad.addColorStop(1.0, '#fef08a'); // Luminous warm tip glow at crystal finial
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Soft darker rose-magenta depth in the central hollow of the petal
      const bellyGrad = ctx.createRadialGradient(256, 250, 20, 256, 250, 220);
      bellyGrad.addColorStop(0.0, 'rgba(219, 39, 119, 0.42)');
      bellyGrad.addColorStop(0.6, 'rgba(244, 114, 182, 0.15)');
      bellyGrad.addColorStop(1.0, 'rgba(255, 241, 242, 0.0)');
      ctx.fillStyle = bellyGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Warm luminous cove-light rim along left & right petal seams (u near 0 and u near 1)
      const leftSeamGlow = ctx.createLinearGradient(0, 0, 115, 0);
      leftSeamGlow.addColorStop(0.0, 'rgba(254, 249, 195, 0.96)');
      leftSeamGlow.addColorStop(0.28, 'rgba(253, 230, 138, 0.68)');
      leftSeamGlow.addColorStop(0.65, 'rgba(251, 207, 232, 0.28)');
      leftSeamGlow.addColorStop(1.0, 'rgba(251, 207, 232, 0.0)');
      ctx.fillStyle = leftSeamGlow;
      ctx.fillRect(0, 0, 115, 512);

      const rightSeamGlow = ctx.createLinearGradient(512, 0, 397, 0);
      rightSeamGlow.addColorStop(0.0, 'rgba(254, 249, 195, 0.96)');
      rightSeamGlow.addColorStop(0.28, 'rgba(253, 230, 138, 0.68)');
      rightSeamGlow.addColorStop(0.65, 'rgba(251, 207, 232, 0.28)');
      rightSeamGlow.addColorStop(1.0, 'rgba(251, 207, 232, 0.0)');
      ctx.fillStyle = rightSeamGlow;
      ctx.fillRect(397, 0, 115, 512);

      // Delicate curved silk petal veins radiating from crown (v=0) to tip (v=1)
      for (let s = -12; s <= 12; s++) {
        const uNorm = s / 12;
        ctx.strokeStyle =
          Math.abs(s) % 2 === 0
            ? 'rgba(255, 241, 242, 0.22)'
            : 'rgba(157, 23, 77, 0.12)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(256 + uNorm * 60, 0);
        ctx.quadraticCurveTo(256 + uNorm * 235, 260, 256 + uNorm * 45, 512);
        ctx.stroke();
      }
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  // Multi-faceted pink diamond jewel texture for the central suspended crystal heart
  const createFacetedHeartJewelTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const bg = ctx.createRadialGradient(256, 256, 20, 256, 256, 260);
      bg.addColorStop(0.0, '#ffffff');
      bg.addColorStop(0.25, '#fbcfe8');
      bg.addColorStop(0.6, '#ec4899');
      bg.addColorStop(1.0, '#be185d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 512);

      // Geometric diamond facets matching the reference crystal heart
      const facetColors = [
        'rgba(255, 255, 255, 0.75)',
        'rgba(251, 207, 232, 0.65)',
        'rgba(244, 114, 182, 0.55)',
        'rgba(219, 39, 119, 0.52)',
        'rgba(253, 164, 175, 0.6)',
        'rgba(255, 241, 242, 0.82)',
      ];
      const rings = [55, 125, 195, 260];
      const sectors = 12;
      for (let rIdx = 0; rIdx < rings.length; rIdx++) {
        const rIn = rIdx === 0 ? 0 : rings[rIdx - 1];
        const rOut = rings[rIdx];
        for (let s = 0; s < sectors; s++) {
          const a0 = (s / sectors) * Math.PI * 2;
          const a1 = ((s + 1) / sectors) * Math.PI * 2;
          const aMid = (a0 + a1) * 0.5 + (rIdx % 2) * 0.18;

          ctx.beginPath();
          ctx.moveTo(256 + Math.cos(a0) * rIn, 256 + Math.sin(a0) * rIn);
          ctx.lineTo(256 + Math.cos(a1) * rIn, 256 + Math.sin(a1) * rIn);
          ctx.lineTo(256 + Math.cos(aMid) * rOut, 256 + Math.sin(aMid) * rOut);
          ctx.closePath();
          ctx.fillStyle = facetColors[(s + rIdx * 2) % facetColors.length];
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const rosePetalSilkTex = createRosePetalSilkTexture();
  const facetedHeartJewelTex = createFacetedHeartJewelTexture();

  const rosePetalVaultMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: rosePetalSilkTex,
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveMap: rosePetalSilkTex,
      emissiveIntensity: 0.56,
      roughness: 0.24,
      metalness: 0.05,
      transmission: 0.34,
      transparent: true,
      opacity: 0.94,
      sheen: 0.9,
      sheenColor: new THREE.Color('#fff1f2'),
      clearcoat: 0.38,
      side: THREE.DoubleSide,
    }),
  );

  const rosePetalInnerTierMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: rosePetalSilkTex,
      color: new THREE.Color('#fff1f2'),
      emissive: new THREE.Color('#f9a8d4'),
      emissiveMap: rosePetalSilkTex,
      emissiveIntensity: 0.64,
      roughness: 0.2,
      metalness: 0.06,
      transmission: 0.38,
      transparent: true,
      opacity: 0.96,
      sheen: 1.0,
      sheenColor: new THREE.Color('#fef08a'),
      clearcoat: 0.45,
      side: THREE.DoubleSide,
    }),
  );

  const facetedHeartJewelMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: facetedHeartJewelTex,
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveMap: facetedHeartJewelTex,
      emissiveIntensity: 0.72,
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.35,
      transparent: true,
      opacity: 0.96,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
  );

  // 1.12B Upper Recessed Ceiling Backing Plane (Placed at y = domeBaseY + 0.195 = y0 + 4.535m,
  // right beneath the Floor 4 slab bottom at y0 + 4.55m so it NEVER blocks any petal vaults below it!)
  const ceilingTopBackingGeo = tracker.trackGeo(new THREE.BoxGeometry(10.05, 0.025, 22.65));
  const ceilingTopBackingMesh = new THREE.Mesh(ceilingTopBackingGeo, galleryBlushWallMat);
  ceilingTopBackingMesh.position.set(9.825, 0.195, -3.525);
  rosePetalDomeGroup.add(ceilingTopBackingMesh);

  // Recessed Upper Perimeter Cove Molding & Warm Golden Cove Strip above the Gallery Walls
  const ceilPerimLongGoldGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.09, 22.65));
  const ceilPerimShortGoldGeo = tracker.trackGeo(new THREE.BoxGeometry(10.05, 0.09, 0.18));
  const ceilPerimLongGlowGeo = tracker.trackGeo(new THREE.BoxGeometry(0.06, 0.045, 22.45));
  const ceilPerimShortGlowGeo = tracker.trackGeo(new THREE.BoxGeometry(9.85, 0.045, 0.06));

  [
    { x: 4.92, z: -3.525, isLong: true },
    { x: 14.73, z: -3.525, isLong: true },
    { x: 9.825, z: -14.74, isLong: false },
    { x: 9.825, z: 7.69, isLong: false },
  ].forEach(({ x, z, isLong }) => {
    const mold = new THREE.Mesh(
      isLong ? ceilPerimLongGoldGeo : ceilPerimShortGoldGeo,
      galleryRoyalGoldMat,
    );
    mold.position.set(x, 0.14, z);
    const glow = new THREE.Mesh(
      isLong ? ceilPerimLongGlowGeo : ceilPerimShortGlowGeo,
      galleryWarmLinearGlowMat,
    );
    glow.position.set(x, 0.08, z);
    rosePetalDomeGroup.add(mold, glow);
  });

  // 1.12C Shared Sparkling Faceted Crystal Drop Finial Sconce Builder (mounted at every petal tip junction)
  const finialMountCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.085, 0.065, 12));
  const finialGoldCollarGeo = tracker.trackGeo(new THREE.TorusGeometry(0.078, 0.018, 8, 16));
  finialGoldCollarGeo.rotateX(Math.PI / 2);
  const finialUpperFacetGeo = tracker.trackGeo(new THREE.ConeGeometry(0.115, 0.16, 8));
  const finialLowerFacetGeo = tracker.trackGeo(new THREE.ConeGeometry(0.115, 0.22, 8));
  finialLowerFacetGeo.rotateX(Math.PI);
  const finialInnerBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.068, 10, 10));

  const buildPetalCrystalFinial = (scale = 1.0): THREE.Group => {
    const finGrp = new THREE.Group();
    finGrp.scale.setScalar(scale);

    const cap = new THREE.Mesh(finialMountCapGeo, galleryRoyalGoldMat);
    cap.position.y = 0.04;
    const collar = new THREE.Mesh(finialGoldCollarGeo, galleryRoyalGoldMat);
    collar.position.y = 0.0;
    const topCrystal = new THREE.Mesh(finialUpperFacetGeo, crystalArchMat);
    topCrystal.position.y = -0.05;
    const botCrystal = new THREE.Mesh(finialLowerFacetGeo, crystalArchMat);
    botCrystal.position.y = -0.24;
    const warmCore = new THREE.Mesh(finialInnerBulbGeo, galleryWarmLinearGlowMat);
    warmCore.position.y = -0.12;

    finGrp.add(cap, collar, topCrystal, botCrystal, warmCore);
    return finGrp;
  };

  const domeRadius = 4.62;

  const outerDrumRingGeo = tracker.trackGeo(new THREE.TorusGeometry(domeRadius, 0.12, 16, 72));
  outerDrumRingGeo.rotateX(Math.PI / 2);
  const outerDrumInnerLipGeo = tracker.trackGeo(new THREE.TorusGeometry(domeRadius - 0.14, 0.045, 10, 72));
  outerDrumInnerLipGeo.rotateX(Math.PI / 2);
  const outerCoveHaloRingGeo = tracker.trackGeo(new THREE.TorusGeometry(domeRadius + 0.14, 0.048, 10, 72));
  outerCoveHaloRingGeo.rotateX(Math.PI / 2);

  // Shared geometries for the Central Royal Crown Chandelier & Faceted Pink Crystal Heart
  const crownUpperPlateGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.68, 0.76, 0.07, 32));
  const crownInnerSunDiskGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 28));
  const crownInnerGoldTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(0.44, 0.042, 10, 32));
  crownInnerGoldTorusGeo.rotateX(Math.PI / 2);
  const crownRoyalBandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.58, 0.48, 0.22, 32, 1, true));
  const crownLowerRimGeo = tracker.trackGeo(new THREE.TorusGeometry(0.49, 0.035, 10, 32));
  crownLowerRimGeo.rotateX(Math.PI / 2);
  const crownPointSpikeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.26, 4));
  const crownPointTipBallGeo = tracker.trackGeo(new THREE.SphereGeometry(0.028, 8, 8));
  const crownDiamondGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.062, 0));

  const chandelierMainRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.92, 0.038, 12, 48));
  chandelierMainRingGeo.rotateX(Math.PI / 2);
  const chandelierInnerRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.62, 0.024, 10, 40));
  chandelierInnerRingGeo.rotateX(Math.PI / 2);
  const chandelierRingStudGeo = tracker.trackGeo(new THREE.SphereGeometry(0.028, 8, 8));

  const pendantChainBeadGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.03, 0));
  const pendantTeardropGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.076, 0));
  pendantTeardropGeo.scale(0.72, 1.75, 0.72);

  const domeHeartGoldFrameGeo = buildExtrudedHeartGeometry(tracker, 1.02, 0.14, 0.042);
  const domeHeartFacetedBodyGeo = buildExtrudedHeartGeometry(tracker, 0.9, 0.22, 0.058);
  const domeHeartBrightCoreGeo = buildExtrudedHeartGeometry(tracker, 0.56, 0.26, 0.03);

  const domeCenterHeartPivots: THREE.Group[] = [];

  // Builder for a complete 8-Petal Rose Petal Dome Bay using the modular `RosePetalGeometry` class
  const buildRosePetalDomeBay = (bayCenterX: number, bayCenterZ: number, stretchZ = 1.08) => {
    const bayGroup = new THREE.Group();
    bayGroup.position.set(bayCenterX, 0, bayCenterZ);
    rosePetalDomeGroup.add(bayGroup);

    // 1. Modular 8-Petal Translucent Curved Dome Assembly with Champagne-Gold Trim (via RosePetalGeometry)
    const {
      group: petalVaultContainer,
      outerTipPositions,
      innerTipPositions,
    } = RosePetalGeometry.createEightPetalDomeAssembly(
      tracker,
      rosePetalVaultMat,
      rosePetalInnerTierMat,
      galleryRoyalGoldMat,
      galleryWarmLinearGlowMat,
      {
        outerRadius: domeRadius,
        stretchZ,
        petalCount: 8,
        includeInnerTier: true,
      },
    );
    bayGroup.add(petalVaultContainer);

    // 2. Outer Molded Champagne-Gold Circular/Elliptical Cornice Ring & Warm Cove Halo
    const drumRing = new THREE.Mesh(outerDrumRingGeo, galleryRoyalGoldMat);
    drumRing.position.y = -0.02;
    const drumInnerLip = new THREE.Mesh(outerDrumInnerLipGeo, galleryWarmLinearGlowMat);
    drumInnerLip.position.y = 0.0;
    const drumOuterHalo = new THREE.Mesh(outerCoveHaloRingGeo, galleryWarmLinearGlowMat);
    drumOuterHalo.position.y = 0.03;
    petalVaultContainer.add(drumRing, drumInnerLip, drumOuterHalo);

    // Attach Faceted Crystal Drop Finials at all 8 outer petal tips and 8 inner petal tips
    for (let i = 0; i < outerTipPositions.length; i++) {
      const tip = outerTipPositions[i];
      const fOut = buildPetalCrystalFinial(1.02);
      fOut.scale.set(1.02, 1.02, 1.02 / stretchZ);
      fOut.position.copy(tip);
      petalVaultContainer.add(fOut);
    }
    for (let i = 0; i < innerTipPositions.length; i++) {
      const tip = innerTipPositions[i];
      const fIn = buildPetalCrystalFinial(1.08);
      fIn.scale.set(1.08, 1.08, 1.08 / stretchZ);
      fIn.position.copy(tip);
      petalVaultContainer.add(fIn);
    }

    // 3. Central Royal Gold Crown Mount, Chandelier Ring & Faceted Pink Crystal Heart
    const crownAssembly = new THREE.Group();
    crownAssembly.position.set(0, 0.02, 0);
    bayGroup.add(crownAssembly);

    const upperPlate = new THREE.Mesh(crownUpperPlateGeo, galleryRoyalGoldMat);
    upperPlate.position.y = 0.02;
    const innerSunDisk = new THREE.Mesh(crownInnerSunDiskGeo, galleryWarmLinearGlowMat);
    innerSunDisk.position.y = -0.14;
    const innerGoldTorus = new THREE.Mesh(crownInnerGoldTorusGeo, galleryRoyalGoldMat);
    innerGoldTorus.position.y = -0.16;
    const royalBand = new THREE.Mesh(crownRoyalBandGeo, galleryRoyalGoldMat);
    royalBand.position.y = -0.08;
    const lowerRim = new THREE.Mesh(crownLowerRimGeo, galleryRoyalGoldMat);
    lowerRim.position.y = -0.19;
    crownAssembly.add(upperPlate, innerSunDisk, innerGoldTorus, royalBand, lowerRim);

    // 8 Sculpted Royal Crown Points flaring upward/outward + 8 Pink Crystal Gems in the Crown Band
    for (let cs = 0; cs < 8; cs++) {
      const cAng = (cs / 8) * Math.PI * 2;
      const crownPt = new THREE.Mesh(crownPointSpikeGeo, galleryRoyalGoldMat);
      crownPt.position.set(Math.cos(cAng) * 0.56, 0.06, Math.sin(cAng) * 0.56);
      crownPt.rotation.y = -cAng;
      crownPt.rotation.z = -Math.cos(cAng) * 0.28;
      crownPt.rotation.x = Math.sin(cAng) * 0.28;

      const tipBall = new THREE.Mesh(crownPointTipBallGeo, galleryWarmLinearGlowMat);
      tipBall.position.set(Math.cos(cAng) * 0.62, 0.19, Math.sin(cAng) * 0.62);

      const bandGem = new THREE.Mesh(crownDiamondGemGeo, floatingHeartCrystalMat);
      bandGem.position.set(Math.cos(cAng) * 0.54, -0.08, Math.sin(cAng) * 0.54);
      bandGem.rotation.y = -cAng;
      crownAssembly.add(crownPt, tipBall, bandGem);
    }

    // Suspended Circular Gold Chandelier Ring below the Royal Crown
    const chandelierRingY = -0.38;
    const mainRing = new THREE.Mesh(chandelierMainRingGeo, galleryRoyalGoldMat);
    mainRing.position.y = chandelierRingY;
    const innerRing = new THREE.Mesh(chandelierInnerRingGeo, galleryRoyalGoldMat);
    innerRing.position.y = chandelierRingY + 0.08;
    crownAssembly.add(mainRing, innerRing);

    // 6 Curved Gold Scrollwork Struts connecting the Crown Rim to the Chandelier Ring
    for (let st = 0; st < 6; st++) {
      const sAng = (st / 6) * Math.PI * 2;
      const strutCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.cos(sAng) * 0.46, -0.18, Math.sin(sAng) * 0.46),
        new THREE.Vector3(Math.cos(sAng) * 0.78, -0.22, Math.sin(sAng) * 0.78),
        new THREE.Vector3(Math.cos(sAng) * 0.92, chandelierRingY, Math.sin(sAng) * 0.92),
      );
      const strutGeo = tracker.trackGeo(new THREE.TubeGeometry(strutCurve, 12, 0.018, 6, false));
      crownAssembly.add(new THREE.Mesh(strutGeo, galleryRoyalGoldMat));
    }

    // 14 Hanging Faceted Crystal Teardrop Pendants around the Chandelier Ring
    const ringPendantCount = 14;
    for (let pd = 0; pd < ringPendantCount; pd++) {
      const pAng = (pd / ringPendantCount) * Math.PI * 2;
      const rx = Math.cos(pAng) * 0.92;
      const rz = Math.sin(pAng) * 0.92;
      const dropLen = pd % 2 === 0 ? 0.28 : 0.22;

      const stud = new THREE.Mesh(chandelierRingStudGeo, galleryWarmLinearGlowMat);
      stud.position.set(rx, chandelierRingY - 0.02, rz);
      const bead1 = new THREE.Mesh(pendantChainBeadGeo, galleryWarmLinearGlowMat);
      bead1.position.set(rx, chandelierRingY - 0.09, rz);
      const bead2 = new THREE.Mesh(pendantChainBeadGeo, crystalArchMat);
      bead2.position.set(rx, chandelierRingY - 0.16, rz);
      const teardrop = new THREE.Mesh(pendantTeardropGeo, crystalArchMat);
      teardrop.position.set(rx, chandelierRingY - dropLen, rz);
      crownAssembly.add(stud, bead1, bead2, teardrop);
    }

    // Central Suspended Multi-Faceted Glowing Pink Crystal Heart inside Champagne-Gold Heart Frame
    const heartPivot = new THREE.Group();
    heartPivot.position.set(0, -0.66, 0);

    const goldHeartFrame = new THREE.Mesh(domeHeartGoldFrameGeo, galleryRoyalGoldMat);
    const facetedHeartBody = new THREE.Mesh(domeHeartFacetedBodyGeo, facetedHeartJewelMat);
    const brightHeartCore = new THREE.Mesh(domeHeartBrightCoreGeo, galleryWarmLinearGlowMat);
    heartPivot.add(goldHeartFrame, facetedHeartBody, brightHeartCore);

    // 5 Hanging Crystal Teardrop Pendants in a V-Cascade along the lower contour of the Heart Frame
    [
      { hx: -0.34, hy: -0.22, drop: 0.22, scale: 0.88 },
      { hx: -0.18, hy: -0.35, drop: 0.26, scale: 0.96 },
      { hx: 0.0, hy: -0.46, drop: 0.3, scale: 1.12 },
      { hx: 0.18, hy: -0.35, drop: 0.26, scale: 0.96 },
      { hx: 0.34, hy: -0.22, drop: 0.22, scale: 0.88 },
    ].forEach(({ hx, hy, drop, scale }) => {
      const b1 = new THREE.Mesh(pendantChainBeadGeo, galleryWarmLinearGlowMat);
      b1.position.set(hx, hy - 0.06, 0);
      const b2 = new THREE.Mesh(pendantChainBeadGeo, crystalArchMat);
      b2.position.set(hx, hy - 0.13, 0);
      const td = new THREE.Mesh(pendantTeardropGeo, crystalArchMat);
      td.position.set(hx, hy - drop, 0);
      td.scale.setScalar(scale);
      heartPivot.add(b1, b2, td);
    });

    crownAssembly.add(heartPivot);
    domeCenterHeartPivots.push(heartPivot);
  };

  // Instantiate the South Portrait Room Rose Petal Dome (exact bay shown in the reference screenshot)
  // and the companion North Portrait Room Rose Petal Dome so the entire Heart Gallery ceiling is vaulted!
  buildRosePetalDomeBay(9.825, -9.25, 1.08);
  buildRosePetalDomeBay(9.825, 1.95, 1.08);

  // ==========================================================================
  // 2. ICE SKATING PALACE (PRIORITY #2 — SECOND-LARGEST SPACE ON FLOOR 3)
  //    West Grand Wing: lx in [-15.0, -3.8], lz in [-15.0, +4.2] (~215 m²)
  //    Elongated Oval Ice Rink centered at (lx = -9.4, lz = -5.4), rx = 3.4m, rz = 6.2m (6.8m × 12.4m)
  //    Surrounded by a >= 2.5m clear pearl-marble walking promenade!
  // ==========================================================================
  const icePalaceGroup = new THREE.Group();
  icePalaceGroup.name = 'IceSkatingPalaceWing';
  group.add(icePalaceGroup);

  const rinkCenterX = -9.4;
  const rinkCenterZ = -5.4;
  const rinkRadiusX = 3.4;
  const rinkRadiusZ = 6.2;

  // Open Colonnade Portal framing the Ice Skating Palace from the Central Royal Promenade
  buildPalacePortalArch(-3.8, -5.4, 3.8, 3.85, Math.PI / 2, iceFountainHeartMat);

  // Luminous Sub-Ice Pattern Canvas (Snowflakes, Crystal Filigree & Twin Hearts under the translucent ice)
  const createIceSubPatternTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(256, 512, 30, 256, 512, 500);
      grad.addColorStop(0, '#f0f9ff');
      grad.addColorStop(0.55, '#e0f2fe');
      grad.addColorStop(1, '#ede9fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 1024);

      // Subtle skating figure-eight & center ice medallion rings
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(256, 512, 210, 440, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(256, 360, 125, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(256, 664, 125, 0, Math.PI * 2);
      ctx.stroke();

      // Center ice heart & snowflake motifs
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(236, 72, 153, 0.35)';
      ctx.font = 'bold 96px Georgia, serif';
      ctx.fillText('♡', 256, 512);

      ctx.fillStyle = 'rgba(125, 211, 252, 0.65)';
      ctx.font = '44px Georgia, serif';
      const flakes = [
        [256, 210],
        [256, 814],
        [145, 360],
        [367, 360],
        [145, 664],
        [367, 664],
      ];
      flakes.forEach(([fx, fy]) => ctx.fillText('❄', fx, fy));
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const iceSubTex = createIceSubPatternTexture();
  const iceSubBaseMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({ map: iceSubTex }),
  );

  // Oval Sub-Ice Pattern Base + Translucent Reflective Ice Top Sheet
  const rinkSubGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.0, 1.0, 0.022, 48));
  rinkSubGeo.scale(rinkRadiusX, 1, rinkRadiusZ);
  const rinkSubMesh = new THREE.Mesh(rinkSubGeo, iceSubBaseMat);
  rinkSubMesh.position.set(rinkCenterX, y0 + 0.012, rinkCenterZ);

  const rinkIceGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.0, 1.0, 0.032, 48));
  rinkIceGeo.scale(rinkRadiusX, 1, rinkRadiusZ);
  const rinkIceMesh = new THREE.Mesh(rinkIceGeo, iceSurfaceMat);
  rinkIceMesh.position.set(rinkCenterX, y0 + 0.026, rinkCenterZ);
  rinkIceMesh.receiveShadow = true;

  // Champagne-Gold & Pearl Outer Rink Curb
  const rinkCurbGeo = tracker.trackGeo(new THREE.TorusGeometry(1.0, 0.045, 10, 56));
  rinkCurbGeo.rotateX(Math.PI / 2);
  rinkCurbGeo.scale(rinkRadiusX + 0.06, 1, rinkRadiusZ + 0.06);
  const rinkCurb = new THREE.Mesh(rinkCurbGeo, mats.champagneGold);
  rinkCurb.position.set(rinkCenterX, y0 + 0.04, rinkCenterZ);
  icePalaceGroup.add(rinkSubMesh, rinkIceMesh, rinkCurb);

  // Low Crystal Rink Barrier & Champagne-Gold Handrail with Open East Promenade Gate (lz: -6.8..-4.0) & South Gate
  const RINK_SEGMENTS = 36;
  const barrierPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.068, 0.86, 10));
  barrierPostGeo.translate(0, 0.43, 0);
  const barrierFinialGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.08, 0));
  barrierFinialGeo.translate(0, 0.9, 0);

  for (let s = 0; s < RINK_SEGMENTS; s++) {
    const a0 = (s / RINK_SEGMENTS) * Math.PI * 2;
    const a1 = ((s + 1) / RINK_SEGMENTS) * Math.PI * 2;
    const aMid = (a0 + a1) * 0.5;
    const mx = rinkCenterX + Math.cos(aMid) * rinkRadiusX;
    const mz = rinkCenterZ + Math.sin(aMid) * rinkRadiusZ;

    // Leave open 2.8m East Gate (facing Royal Promenade) and 2.4m South Gate
    const isEastGate = mx > rinkCenterX + 1.8 && mz >= -6.85 && mz <= -3.95;
    const isSouthGate = mz < rinkCenterZ - 4.8 && mx >= -10.6 && mx <= -8.2;
    if (isEastGate || isSouthGate) continue;

    const x0 = rinkCenterX + Math.cos(a0) * rinkRadiusX;
    const z0 = rinkCenterZ + Math.sin(a0) * rinkRadiusZ;
    const x1 = rinkCenterX + Math.cos(a1) * rinkRadiusX;
    const z1 = rinkCenterZ + Math.sin(a1) * rinkRadiusZ;
    const segLen = Math.hypot(x1 - x0, z1 - z0);
    const segYaw = Math.atan2(x1 - x0, z1 - z0);

    const panelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.05, 0.68, segLen + 0.02));
    const panel = new THREE.Mesh(panelGeo, iceCrystalBarrierMat);
    panel.position.set(mx, y0 + 0.4, mz);
    panel.rotation.y = segYaw;

    const railGeo = tracker.trackGeo(new THREE.BoxGeometry(0.09, 0.06, segLen + 0.04));
    const rail = new THREE.Mesh(railGeo, mats.champagneGold);
    rail.position.set(mx, y0 + 0.78, mz);
    rail.rotation.y = segYaw;
    icePalaceGroup.add(panel, rail);

    if (s % 2 === 0) {
      const post = new THREE.Mesh(barrierPostGeo, mats.pearlWhite);
      post.position.set(x0, y0, z0);
      const finial = new THREE.Mesh(barrierFinialGeo, mats.champagneGold);
      finial.position.set(x0, y0, z0);
      icePalaceGroup.add(post, finial);
    }
  }

  // --- CRYSTAL HEART FOUNTAIN CENTERPIECE AT NORTH END OF THE ICE RINK (lx = -9.4, lz = +1.35) ---
  const fountainX = -9.4;
  const fountainZ = 1.45;
  const iceFountainGroup = new THREE.Group();
  iceFountainGroup.position.set(fountainX, y0, fountainZ);

  const fBasinGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.45, 1.62, 0.42, 28));
  fBasinGeo.translate(0, 0.21, 0);
  const fRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.5, 0.055, 10, 36));
  fRimGeo.rotateX(Math.PI / 2);
  fRimGeo.translate(0, 0.42, 0);
  const fTierGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.72, 0.95, 0.68, 24));
  fTierGeo.translate(0, 0.72, 0);
  iceFountainGroup.add(
    new THREE.Mesh(fBasinGeo, mats.pearlWhite),
    new THREE.Mesh(fRimGeo, mats.champagneGold),
    new THREE.Mesh(fTierGeo, iceCrystalBarrierMat),
  );

  const iceFountainHeartPivot = new THREE.Group();
  iceFountainHeartPivot.position.set(0, 1.75, 0);
  const iceFountainHeartMesh = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 1.15, 0.22, 0.05),
    iceFountainHeartMat,
  );
  iceFountainHeartPivot.add(iceFountainHeartMesh);
  iceFountainGroup.add(iceFountainHeartPivot);
  icePalaceGroup.add(iceFountainGroup);
  registerLocalCollider(fountainX, fountainZ, 1.55, 2.8);

  // Instanced Crystal-Ice Fountain Droplets & Rink Shimmer Motes (Zero Per-Frame Allocations)
  const ICE_DROPLET_COUNT = 22;
  const iceDropletGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.05, 0));
  const iceDropletInstanced = new THREE.InstancedMesh(
    iceDropletGeo,
    iceFountainHeartMat,
    ICE_DROPLET_COUNT,
  );
  iceDropletInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icePalaceGroup.add(iceDropletInstanced);

  // Two Skate-Side Velvet Viewing Benches along the West Outer Promenade (outside the 2.5m walking lane)
  [-3.2, -7.8].forEach((bz) => {
    const skateBench = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.58, 0.44, 1.65)),
      mats.softLavender,
    );
    skateBench.position.set(-14.35, y0 + 0.22, bz);
    const benchGold = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.64, 0.07, 1.72)),
      mats.champagneGold,
    );
    benchGold.position.set(-14.35, y0 + 0.04, bz);
    icePalaceGroup.add(skateBench, benchGold);
    registerLocalCollider(-14.35, bz, 0.62, 0.9);
  });

  // ==========================================================================
  // 3. PUPPY PLAY AREA (PRIORITY #3 — THIRD-LARGEST SPACE ON FLOOR 3)
  //    South-Central Open Garden Playground: lx in [-3.8, +4.8], lz in [-15.0, -4.2] (~93 m²)
  //    Open Central Puppy Play Lawn + 5 Perimeter Activity Zones + 4 Animated Puppy NPCs
  // ==========================================================================
  const puppyPlayGroup = new THREE.Group();
  puppyPlayGroup.name = 'PuppyPlayAreaWing';
  group.add(puppyPlayGroup);

  const playCenterX = 0.5;
  const playCenterZ = -9.6;

  // Open Garden Archway framing the entrance from the Central Royal Promenade (lz = -4.2)
  buildPalacePortalArch(0.5, -4.2, 3.8, 3.65, 0, mats.champagneGold);

  // Soft Pastel Grass Lawn with Champagne-Gold Garden Border
  const lawnGeo = tracker.trackGeo(new THREE.BoxGeometry(7.8, 0.026, 9.8));
  const lawnMesh = new THREE.Mesh(lawnGeo, pastelLawnMat);
  lawnMesh.position.set(playCenterX, y0 + 0.013, playCenterZ);
  lawnMesh.receiveShadow = true;
  const lawnBorderGeo = tracker.trackGeo(new THREE.BoxGeometry(8.0, 0.018, 10.0));
  const lawnBorder = new THREE.Mesh(lawnBorderGeo, mats.champagneGold);
  lawnBorder.position.set(playCenterX, y0 + 0.008, playCenterZ);
  puppyPlayGroup.add(lawnMesh, lawnBorder);

  // Low Pastel Garden Hedging along the West & South edges (leaving wide promenade & gallery openings)
  const lowHedgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.52, 2.8));
  [-6.4, -12.4].forEach((hz) => {
    const westHedge = new THREE.Mesh(lowHedgeGeo, pastelHedgeMat);
    westHedge.position.set(-3.55, y0 + 0.26, hz);
    puppyPlayGroup.add(westHedge);
  });

  // Paw-Print Stepping Stones & Tiny Pastel Garden Flowers on the Lawn (Flush on y0 + 0.028m)
  const pawPadMainGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.16, 0.17, 0.016, 14));
  const pawToeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.065, 0.07, 0.018, 10));
  const pawPositions: Array<[number, number, number]> = [
    [0.5, -5.2, 0.1],
    [0.2, -6.3, -0.15],
    [0.6, -7.4, 0.12],
    [0.3, -8.5, -0.08],
    [0.5, -9.6, 0.05],
  ];
  pawPositions.forEach(([px, pz, rot]) => {
    const pawGroup = new THREE.Group();
    pawGroup.position.set(px, y0 + 0.028, pz);
    pawGroup.rotation.y = rot;
    pawGroup.add(new THREE.Mesh(pawPadMainGeo, mats.champagneGold));
    [-0.12, 0, 0.12].forEach((tx, idx) => {
      const toe = new THREE.Mesh(pawToeGeo, mats.blushRoseMarble);
      toe.position.set(tx, 0.002, -0.18 - (idx === 1 ? 0.04 : 0));
      pawGroup.add(toe);
    });
    puppyPlayGroup.add(pawGroup);
  });

  // --- PERIMETER ACTIVITY ZONE 1: CURVED PASTEL TUNNEL (lx = -2.35, lz = -7.4) ---
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(-2.35, y0, -7.4);
  tunnelGroup.rotation.y = 0.28;
  const tunnelTubeGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.52, 0.52, 1.65, 20, 1, true, 0, Math.PI),
  );
  tunnelTubeGeo.rotateZ(Math.PI * 0.5);
  tunnelTubeGeo.rotateY(Math.PI * 0.5);
  const tunnelMesh = new THREE.Mesh(tunnelTubeGeo, mats.blushRoseMarble);
  tunnelMesh.position.y = 0.04;
  [-0.8, 0, 0.8].forEach((tz) => {
    const archRib = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.53, 0.035, 8, 20, Math.PI)),
      mats.champagneGold,
    );
    archRib.position.set(0, 0.04, tz);
    tunnelGroup.add(archRib);
  });
  tunnelGroup.add(tunnelMesh);
  puppyPlayGroup.add(tunnelGroup);

  // --- PERIMETER ACTIVITY ZONE 2: MINI CLIMBABLE / PLAY RAMP (lx = +3.2, lz = -7.4) ---
  const rampGroup = new THREE.Group();
  rampGroup.position.set(3.2, y0, -7.4);
  rampGroup.rotation.y = -0.25;
  const rampPlatform = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.82, 0.36, 0.82)),
    mats.pearlWhite,
  );
  rampPlatform.position.set(0, 0.18, 0);
  const rampSlopeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.06, 1.05));
  [-0.78, 0.78].forEach((rz, idx) => {
    const slope = new THREE.Mesh(rampSlopeGeo, mats.softLavender);
    slope.position.set(0, 0.18, rz);
    slope.rotation.x = idx === 0 ? 0.34 : -0.34;
    rampGroup.add(slope);
  });
  rampGroup.add(rampPlatform);
  puppyPlayGroup.add(rampGroup);

  // --- PERIMETER ACTIVITY ZONE 3: INTERACTIVE BALL AREA (lx = +2.6, lz = -11.8) ---
  type PlayBallState =
    | 'ON_GROUND'
    | 'HELD_BY_PLAYER'
    | 'THROWN'
    | 'CARRIED_BY_PUPPY';
  const playBalls: Array<{
    mesh: THREE.Mesh;
    homeLx: number;
    homeLz: number;
    lx: number;
    ly: number;
    lz: number;
    vx: number;
    vy: number;
    vz: number;
    state: PlayBallState;
    claimedByPuppy: number;
    bouncePuffTimer: number;
    bouncePuffLx: number;
    bouncePuffLz: number;
  }> = [];
  const ballGeo = tracker.trackGeo(new THREE.SphereGeometry(0.16, 16, 14));
  const ballConfigs = [
    { lx: 2.3, lz: -11.4, mat: mats.velvetPlum },
    { lx: 2.9, lz: -12.1, mat: mats.champagneGold },
    { lx: 1.9, lz: -12.3, mat: mats.softLavender },
  ];
  ballConfigs.forEach((bc) => {
    const m = new THREE.Mesh(ballGeo, bc.mat);
    m.position.set(bc.lx, y0 + 0.17, bc.lz);
    m.castShadow = true;
    puppyPlayGroup.add(m);
    playBalls.push({
      mesh: m,
      homeLx: bc.lx,
      homeLz: bc.lz,
      lx: bc.lx,
      ly: 0.17,
      lz: bc.lz,
      vx: 0,
      vy: 0,
      vz: 0,
      state: 'ON_GROUND',
      claimedByPuppy: -1,
      bouncePuffTimer: 0,
      bouncePuffLx: bc.lx,
      bouncePuffLz: bc.lz,
    });
  });

  // Ground dust / grass puff motes for ball bounce & puppy play-bow heart sparkles (InstancedMesh, Zero Allocations)
  const BALL_PUFF_COUNT = 12;
  const ballPuffGeo = tracker.trackGeo(new THREE.SphereGeometry(0.045, 8, 8));
  const ballPuffInstanced = new THREE.InstancedMesh(
    ballPuffGeo,
    mats.pearlWhite,
    BALL_PUFF_COUNT,
  );
  ballPuffInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puppyPlayGroup.add(ballPuffInstanced);

  const PUPPY_SPARKLE_COUNT = 12;
  const puppySparkleGeo = buildExtrudedHeartGeometry(tracker, 0.11, 0.04, 0.012);
  const puppySparkleInstanced = new THREE.InstancedMesh(
    puppySparkleGeo,
    floatingHeartCrystalMat,
    PUPPY_SPARKLE_COUNT,
  );
  puppySparkleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puppyPlayGroup.add(puppySparkleInstanced);

  // --- PERIMETER ACTIVITY ZONE 4: TOY GARDEN (lx = -2.35, lz = -11.8) ---
  const toyGardenGroup = new THREE.Group();
  toyGardenGroup.position.set(-2.35, y0, -11.8);
  const ringToyGeo = tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.045, 10, 20));
  ringToyGeo.rotateX(Math.PI / 2);
  const ringToy1 = new THREE.Mesh(ringToyGeo, mats.velvetPlum);
  ringToy1.position.set(0.2, 0.05, 0.1);
  const ringToy2 = new THREE.Mesh(ringToyGeo, mats.champagneGold);
  ringToy2.position.set(-0.25, 0.05, -0.2);
  // Crystal garden flower sprouts
  const crystalSproutGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.14, 0));
  [-0.35, 0.35].forEach((sx, sIdx) => {
    const sprout = new THREE.Mesh(crystalSproutGeo, floatingHeartCrystalMat);
    sprout.position.set(sx, 0.22, sIdx === 0 ? 0.35 : -0.35);
    toyGardenGroup.add(sprout);
  });
  toyGardenGroup.add(ringToy1, ringToy2);
  puppyPlayGroup.add(toyGardenGroup);

  // --- PERIMETER ACTIVITY ZONE 5: COZY REST ZONE (lx = +0.5, lz = -13.65) ---
  const restBedOuterGeo = tracker.trackGeo(new THREE.TorusGeometry(0.52, 0.14, 12, 24));
  restBedOuterGeo.rotateX(Math.PI / 2);
  const restBedCushionGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 20));
  [-0.75, 0.75].forEach((bx, idx) => {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(playCenterX + bx, y0 + 0.08, -13.65);
    const bolster = new THREE.Mesh(
      restBedOuterGeo,
      idx === 0 ? mats.blushRoseMarble : mats.softLavender,
    );
    const cushion = new THREE.Mesh(restBedCushionGeo, mats.pearlWhite);
    bedGroup.add(bolster, cushion);
    puppyPlayGroup.add(bedGroup);
  });

  // --- 4 EXPRESSIVE PROCEDURAL PUPPY NPCs (Bella, Mochi, Rosie, Coco) ---
  const puppyBodyGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.14, 0.24, 8, 12));
  puppyBodyGeo.rotateX(Math.PI / 2);
  const puppyHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 12));
  const puppySnoutGeo = tracker.trackGeo(new THREE.SphereGeometry(0.075, 10, 10));
  puppySnoutGeo.scale(1.0, 0.82, 1.25);
  const puppyEarGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.042, 0.11, 6, 8));
  const puppyLegGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.038, 0.12, 6, 8));
  puppyLegGeo.translate(0, -0.08, 0);
  const puppyTailGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.028, 0.12, 6, 8));
  puppyTailGeo.translate(0, 0.07, 0);
  const puppyEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
  const puppyBowGeo = buildExtrudedHeartGeometry(tracker, 0.11, 0.05, 0.015);

  const createPuppyModel = (coatMat: THREE.Material, bowMat: THREE.Material) => {
    const root = new THREE.Group();

    const body = new THREE.Mesh(puppyBodyGeo, coatMat);
    body.position.set(0, 0.24, 0);
    body.castShadow = true;
    root.add(body);

    // Satin Collar Bow
    const collarBow = new THREE.Mesh(puppyBowGeo, bowMat);
    collarBow.position.set(0, 0.28, 0.17);
    root.add(collarBow);

    // Head Pivot
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.34, 0.18);
    const headMesh = new THREE.Mesh(puppyHeadGeo, coatMat);
    const snoutMesh = new THREE.Mesh(puppySnoutGeo, coatMat);
    snoutMesh.position.set(0, -0.03, 0.12);
    const noseMesh = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    noseMesh.position.set(0, -0.01, 0.2);
    const eyeL = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    eyeL.position.set(-0.055, 0.03, 0.125);
    const eyeR = new THREE.Mesh(puppyEyeGeo, puppyEyeNoseMat);
    eyeR.position.set(0.055, 0.03, 0.125);

    const earL = new THREE.Mesh(puppyEarGeo, coatMat);
    earL.position.set(-0.13, -0.01, 0.02);
    earL.rotation.z = 0.28;
    const earR = new THREE.Mesh(puppyEarGeo, coatMat);
    earR.position.set(0.13, -0.01, 0.02);
    earR.rotation.z = -0.28;

    headPivot.add(headMesh, snoutMesh, noseMesh, eyeL, eyeR, earL, earR);
    root.add(headPivot);

    // Wagging Tail Pivot
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.29, -0.18);
    const tailMesh = new THREE.Mesh(puppyTailGeo, coatMat);
    tailMesh.rotation.x = -0.55;
    tailPivot.add(tailMesh);
    root.add(tailPivot);

    // 4 Animated Leg Pivots
    const makeLeg = (x: number, z: number) => {
      const lp = new THREE.Group();
      lp.position.set(x, 0.18, z);
      lp.add(new THREE.Mesh(puppyLegGeo, coatMat));
      root.add(lp);
      return lp;
    };
    const legFL = makeLeg(-0.08, 0.11);
    const legFR = makeLeg(0.08, 0.11);
    const legBL = makeLeg(-0.08, -0.11);
    const legBR = makeLeg(0.08, -0.11);

    return { root, bodyMesh: body, headPivot, tailPivot, legFL, legFR, legBL, legBR, collarBow };
  };

  const puppies: PuppyNpc[] = [];
  const puppySpecs: Array<{
    name: string;
    personality: PuppyNpc['personality'];
    coat: THREE.Material;
    bow: THREE.Material;
    lx: number;
    lz: number;
    initialState: PuppyBehaviorState;
  }> = [
    {
      name: 'Bella',
      personality: 'energetic',
      coat: puppyCreamMat,
      bow: mats.velvetPlum,
      lx: 0.4,
      lz: -8.6,
      initialState: 'PLAY',
    },
    {
      name: 'Mochi',
      personality: 'curious',
      coat: puppySnowMat,
      bow: mats.champagneGold,
      lx: -0.9,
      lz: -9.8,
      initialState: 'WANDER',
    },
    {
      name: 'Rosie',
      personality: 'sleepy',
      coat: puppyBlushMat,
      bow: mats.champagneGold,
      lx: -0.25,
      lz: -13.5,
      initialState: 'REST',
    },
    {
      name: 'Coco',
      personality: 'playful',
      coat: puppyCaramelMat,
      bow: mats.softLavender,
      lx: 1.6,
      lz: -10.8,
      initialState: 'PLAY',
    },
  ];

  puppySpecs.forEach((spec, idx) => {
    const model = createPuppyModel(spec.coat, spec.bow);
    model.root.position.set(spec.lx, y0, spec.lz);
    puppyPlayGroup.add(model.root);
    puppies.push({
      name: spec.name,
      personality: spec.personality,
      ...model,
      state: spec.initialState,
      stateTimer: 3.5 + idx * 1.4,
      lx: spec.lx,
      lz: spec.lz,
      targetLx: spec.lx,
      targetLz: spec.lz,
      homeLx: spec.lx,
      homeLz: spec.lz,
      yaw: idx * 1.2,
      speed: spec.personality === 'energetic' ? 1.55 : 1.15,
      hopPhase: idx * 1.5,
      barkSparkleBoost: 0,
      retrievePhase: 'NONE',
      playBowTimer: 0,
      carryingBallIdx: -1,
      followDisengageTimer: 0,
    });
  });

  // ==========================================================================
  // 4. PET SALON (PRIORITY #4 — SMALLEST COMPACT LUXURY SUITE ON FLOOR 3)
  //    North-West Luxury Suite: lx in [-15.0, -9.6], lz in [+4.5, +14.8] (~55 m²)
  //    West of F3->F4 Staircase (`lx: -9.2..-5.8`), connected via 2.6m Archway at (-12.3, y0, +4.5)
  // ==========================================================================
  const petSalonGroup = new THREE.Group();
  petSalonGroup.name = 'PetSalonWing';
  group.add(petSalonGroup);

  // Boutique Lavender & Pearl Floor Carpet inside Pet Salon
  const salonFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(5.1, 0.02, 9.9));
  const salonFloor = new THREE.Mesh(salonFloorGeo, galleryRoseMarbleMat);
  salonFloor.position.set(-12.3, y0 + 0.01, 9.65);
  salonFloor.receiveShadow = true;
  petSalonGroup.add(salonFloor);

  // Pet Salon Partition Walls:
  //   - South Wall at lz = +4.5 with 2.6m open archway at lx in [-13.6, -11.0]
  //   - East Wall at lx = -9.6 separating Pet Salon from F3->F4 West Staircase
  [
    { x1: -15.0, x2: -13.6, z: 4.5 },
    { x1: -11.0, x2: -9.6, z: 4.5 },
  ].forEach(({ x1, x2, z }) => {
    const w = x2 - x1;
    const mx = (x1 + x2) * 0.5;
    const sWall = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w, 4.1, 0.34)),
      mats.pearlWhite,
    );
    sWall.position.set(mx, y0 + 2.05, z);
    const sTrim = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w + 0.04, 0.14, 0.38)),
      mats.champagneGold,
    );
    sTrim.position.set(mx, y0 + 0.07, z);
    petSalonGroup.add(sWall, sTrim);
    partitionMeshes.push(sWall);
  });

  const salonEastWall = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.34, 4.1, 10.3)),
    mats.pearlWhite,
  );
  salonEastWall.position.set(-9.6, y0 + 2.05, 9.65);
  const salonEastTrim = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.38, 0.14, 10.34)),
    mats.champagneGold,
  );
  salonEastTrim.position.set(-9.6, y0 + 0.07, 9.65);
  petSalonGroup.add(salonEastWall, salonEastTrim);
  partitionMeshes.push(salonEastWall);

  // Pet Salon Entrance Portal Archway at (-12.3, y0, +4.5)
  buildPalacePortalArch(-12.3, 4.5, 2.6, 3.55, 0, crystalArchMat);

  // --- STATION 1: MAIN GROOMING TABLE (lx = -12.3, lz = +9.6) ---
  const groomX = -12.3;
  const groomZ = 9.6;
  const groomTableGroup = new THREE.Group();
  groomTableGroup.position.set(groomX, y0, groomZ);

  const groomBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 24)),
    mats.champagneGold,
  );
  groomBase.position.y = 0.06;
  const groomPillar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 20)),
    mats.pearlWhite,
  );
  groomPillar.position.y = 0.42;
  const groomTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.78, 0.78, 0.09, 28)),
    mats.blushRoseMarble,
  );
  groomTop.position.y = 0.82;
  const groomRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.79, 0.03, 8, 32)).rotateX(Math.PI / 2),
    mats.champagneGold,
  );
  groomRim.position.y = 0.84;

  // Champagne-gold overhead grooming arch bar with hanging crystal heart
  const groomArm = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.62, 0.024, 8, 24, Math.PI)),
    mats.champagneGold,
  );
  groomArm.position.set(0, 0.85, 0);
  const groomHangingHeart = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.2, 0.08, 0.02),
    floatingHeartCrystalMat,
  );
  groomHangingHeart.position.set(0, 1.32, 0);

  // Salon Puppy "Lulu" being pampered on the Grooming Table (dedicated coat material for wet/fluffy sheen)
  const salonPuppyCoatMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff9fb'),
      roughness: 0.48,
      metalness: 0.04,
      emissive: new THREE.Color('#fbcfe8'),
      emissiveIntensity: 0.04,
    }),
  );
  const salonPuppyModel = createPuppyModel(salonPuppyCoatMat, floatingHeartCrystalMat);
  salonPuppyModel.root.position.set(0, 0.86, 0);

  // 3D Royal Grooming Brush (visible during Stage 2 — Brush)
  const salonBrushGroup = new THREE.Group();
  salonBrushGroup.position.set(0, 1.32, 0.05);
  salonBrushGroup.visible = false;
  const brushHeadMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.036, 0.095)),
    mats.champagneGold,
  );
  const brushPadMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.025, 0.08)),
    mats.velvetPlum,
  );
  brushPadMesh.position.y = -0.025;
  const brushHandleStem = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 0.14, 10)).rotateZ(Math.PI / 2),
    mats.champagneGold,
  );
  brushHandleStem.position.set(0.13, 0.01, 0);
  salonBrushGroup.add(brushHeadMesh, brushPadMesh, brushHandleStem);

  // 3 Cycling 3D Royal Accessories for Stage 3 — Style (never duplicated on replays)
  // Accessory 0: Glossy Barbie-Pink Satin Bow atop Lulu's head
  const accBowGroup = new THREE.Group();
  accBowGroup.position.set(0, 0.145, 0.02);
  accBowGroup.visible = false;
  const bowLobeGeo = tracker.trackGeo(new THREE.TorusGeometry(0.052, 0.018, 8, 14));
  const bowLeft = new THREE.Mesh(bowLobeGeo, mats.velvetPlum);
  bowLeft.position.set(-0.045, 0, 0);
  bowLeft.rotation.z = 0.25;
  const bowRight = new THREE.Mesh(bowLobeGeo, mats.velvetPlum);
  bowRight.position.set(0.045, 0, 0);
  bowRight.rotation.z = -0.25;
  const bowCenterKnot = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.024, 8, 8)),
    mats.champagneGold,
  );
  accBowGroup.add(bowLeft, bowRight, bowCenterKnot);
  salonPuppyModel.headPivot.add(accBowGroup);

  // Accessory 1: Miniature Champagne-Gold Crown Tiara with Ruby Heart Gem
  const accCrownGroup = new THREE.Group();
  accCrownGroup.position.set(0, 0.15, 0.01);
  accCrownGroup.visible = false;
  const miniCrownBand = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.062, 0.012, 8, 18)).rotateX(Math.PI / 2),
    mats.champagneGold,
  );
  const miniCrownPeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.018, 0.055, 5));
  for (let cp = 0; cp < 5; cp++) {
    const ang = (cp / 5) * Math.PI * 2;
    const pk = new THREE.Mesh(miniCrownPeakGeo, mats.champagneGold);
    pk.position.set(Math.cos(ang) * 0.058, 0.028, Math.sin(ang) * 0.058);
    accCrownGroup.add(pk);
  }
  const miniCrownGem = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.055, 0.025, 0.008),
    floatingHeartCrystalMat,
  );
  miniCrownGem.position.set(0, 0.032, 0.064);
  accCrownGroup.add(miniCrownBand, miniCrownGem);
  salonPuppyModel.headPivot.add(accCrownGroup);

  // Accessory 2: Ruby-Heart Collar Charm & Silk Ribbon
  const accCollarGroup = new THREE.Group();
  accCollarGroup.position.set(0, 0.27, 0.08);
  accCollarGroup.visible = false;
  const silkCollarRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.115, 0.02, 8, 20)).rotateX(Math.PI / 2 - 0.35),
    mats.velvetPlum,
  );
  const collarCharmHeart = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.14, 0.05, 0.015),
    floatingHeartCrystalMat,
  );
  collarCharmHeart.position.set(0, -0.02, 0.11);
  accCollarGroup.add(silkCollarRing, collarCharmHeart);
  salonPuppyModel.root.add(accCollarGroup);

  const salonAccessoryGroups = [accBowGroup, accCrownGroup, accCollarGroup];

  groomTableGroup.add(
    groomBase,
    groomPillar,
    groomTop,
    groomRim,
    groomArm,
    groomHangingHeart,
    salonPuppyModel.root,
    salonBrushGroup,
  );
  petSalonGroup.add(groomTableGroup);
  registerLocalCollider(groomX, groomZ, 0.82, 1.8);

  // --- STATION 2: LUXURY PET BATH WITH WARM BUBBLES (lx = -13.95, lz = +12.8) ---
  const bathGroup = new THREE.Group();
  bathGroup.position.set(-13.95, y0, 12.8);
  const tubBody = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.68, 0.56, 0.56, 24)),
    mats.pearlWhite,
  );
  tubBody.scale.set(1.0, 1.0, 1.35);
  tubBody.position.y = 0.32;
  const tubGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.68, 0.04, 10, 28)).rotateX(Math.PI / 2),
    mats.champagneGold,
  );
  tubGoldRim.scale.set(1.0, 1.35, 1.0);
  tubGoldRim.position.y = 0.6;
  const tubWater = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 24)),
    iceSurfaceMat,
  );
  tubWater.scale.set(1.0, 1.0, 1.32);
  tubWater.position.y = 0.54;
  const faucetPipe = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 10)),
    mats.champagneGold,
  );
  faucetPipe.position.set(-0.55, 0.72, 0);
  bathGroup.add(tubBody, tubGoldRim, tubWater, faucetPipe);
  petSalonGroup.add(bathGroup);
  registerLocalCollider(-13.95, 12.8, 0.85, 1.4);

  // Animated Iridescent Bath & Grooming Bubbles (InstancedMesh, Zero Per-Frame Allocations)
  const SALON_BUBBLE_COUNT = 20;
  const bubbleSphereGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 10, 10));
  const salonBubbleInstanced = new THREE.InstancedMesh(
    bubbleSphereGeo,
    bubbleIridescentMat,
    SALON_BUBBLE_COUNT,
  );
  salonBubbleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  petSalonGroup.add(salonBubbleInstanced);

  // --- STATION 3: STYLING VANITY STATION (Mirror, Brushes, Combs, Ribbons at lx = -14.2, lz = +7.4) ---
  const stylingGroup = new THREE.Group();
  stylingGroup.position.set(-14.2, y0, 7.4);
  stylingGroup.rotation.y = Math.PI / 2;

  const vanityCounter = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.65, 0.78, 0.56)),
    mats.pearlWhite,
  );
  vanityCounter.position.set(0, 0.39, 0);
  const vanityTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.74, 0.06, 0.62)),
    mats.champagneGold,
  );
  vanityTop.position.set(0, 0.8, 0);
  const heartMirrorFrame = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.92, 0.08, 0.025),
    mats.champagneGold,
  );
  heartMirrorFrame.position.set(0, 1.52, -0.2);
  const heartMirrorGlass = new THREE.Mesh(
    buildExtrudedHeartGeometry(tracker, 0.76, 0.09, 0.015),
    iceSurfaceMat,
  );
  heartMirrorGlass.position.set(0, 1.52, -0.18);

  // Miniature Brushes, Combs, Ribbons & Bows on the Styling Vanity
  const brushHandleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.03, 0.08));
  [-0.45, -0.18, 0.18, 0.45].forEach((vx, idx) => {
    const prop = new THREE.Mesh(
      idx < 2 ? brushHandleGeo : puppyBowGeo,
      idx % 2 === 0 ? mats.velvetPlum : mats.champagneGold,
    );
    prop.position.set(vx, 0.86, 0.06);
    stylingGroup.add(prop);
  });
  stylingGroup.add(vanityCounter, vanityTop, heartMirrorFrame, heartMirrorGlass);
  petSalonGroup.add(stylingGroup);
  registerLocalCollider(-14.2, 7.4, 0.68, 2.0);

  // --- STATION 4: WAITING AREA PET BEDS (lx = -10.45, lz = +6.8 & +8.1) ---
  [6.7, 8.0].forEach((wz, idx) => {
    const waitBed = new THREE.Group();
    waitBed.position.set(-10.45, y0 + 0.08, wz);
    waitBed.add(
      new THREE.Mesh(restBedOuterGeo, idx === 0 ? mats.softLavender : mats.blushRoseMarble),
      new THREE.Mesh(restBedCushionGeo, mats.pearlWhite),
    );
    petSalonGroup.add(waitBed);
  });

  // --- STATION 5: CARE COUNTER (Miniature Grooming Bottles, Folded Towels, Small Bowls, Crystal Containers at lx = -10.45, lz = +12.2) ---
  const careCounterGroup = new THREE.Group();
  careCounterGroup.position.set(-10.45, y0, 12.2);
  careCounterGroup.rotation.y = -Math.PI / 2;

  const careCabinet = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.85, 0.82, 0.56)),
    mats.pearlWhite,
  );
  careCabinet.position.set(0, 0.41, 0);
  const careTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.92, 0.06, 0.62)),
    mats.champagneGold,
  );
  careTop.position.set(0, 0.85, 0);

  // Miniature shampoo/perfume bottles, folded pastel towels, and crystal treat containers
  const miniBottleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.22, 12));
  [-0.65, -0.45, -0.25].forEach((bx, bIdx) => {
    const bottle = new THREE.Mesh(
      miniBottleGeo,
      bIdx === 1 ? floatingHeartCrystalMat : mats.champagneGold,
    );
    bottle.position.set(bx, 0.99, 0);
    careCounterGroup.add(bottle);
  });
  // Folded pastel towel stack
  const towelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.06, 0.26));
  [0, 1, 2].forEach((tIdx) => {
    const towel = new THREE.Mesh(
      towelGeo,
      tIdx % 2 === 0 ? mats.blushRoseMarble : mats.pearlWhite,
    );
    towel.position.set(0.18, 0.91 + tIdx * 0.062, 0);
    careCounterGroup.add(towel);
  });
  // Crystal treat jar + twin gold pet bowls at base
  const crystalJar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 14)),
    crystalArchMat,
  );
  crystalJar.position.set(0.62, 1.01, 0);
  const petBowlGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.08, 16));
  [-0.35, 0.35].forEach((bwx) => {
    const bowl = new THREE.Mesh(petBowlGeo, mats.champagneGold);
    bowl.position.set(bwx, 0.04, 0.48);
    careCounterGroup.add(bowl);
  });

  careCounterGroup.add(careCabinet, careTop, crystalJar);
  petSalonGroup.add(careCounterGroup);
  registerLocalCollider(-10.45, 12.2, 0.68, 1.6);

  // ==========================================================================
  // ICE SKATING BLADE MARKS & LANDING CRYSTAL BURST (Ring Buffer InstancedMeshes)
  // ==========================================================================
  const SKATE_BLADE_MARK_COUNT = 28;
  const skateBladeMarkGeo = tracker.trackGeo(new THREE.BoxGeometry(0.032, 0.008, 0.24));
  const skateBladeMarkMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#e0f2fe'),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  const skateBladeMarkInstanced = new THREE.InstancedMesh(
    skateBladeMarkGeo,
    skateBladeMarkMat,
    SKATE_BLADE_MARK_COUNT,
  );
  skateBladeMarkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icePalaceGroup.add(skateBladeMarkInstanced);

  const skateBladeMarks: Array<{
    lx: number;
    lz: number;
    yaw: number;
    age: number;
    active: boolean;
  }> = [];
  for (let i = 0; i < SKATE_BLADE_MARK_COUNT; i++) {
    skateBladeMarks.push({ lx: 0, lz: 0, yaw: 0, age: 99, active: false });
    _dummy.position.set(0, -100, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    skateBladeMarkInstanced.setMatrixAt(i, _dummy.matrix);
  }
  skateBladeMarkInstanced.instanceMatrix.needsUpdate = true;
  let skateBladeWriteIdx = 0;
  let skateBladeSampleDist = 0;
  let lastSkateSampleLx = rinkCenterX;
  let lastSkateSampleLz = rinkCenterZ;
  let skateBladeSideToggle = 1;

  const SKATE_JUMP_CRYSTAL_COUNT = 12;
  const skateJumpCrystalInstanced = new THREE.InstancedMesh(
    iceDropletGeo,
    floatingHeartCrystalMat,
    SKATE_JUMP_CRYSTAL_COUNT,
  );
  skateJumpCrystalInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icePalaceGroup.add(skateJumpCrystalInstanced);
  let skateJumpBurstLx = rinkCenterX;
  let skateJumpBurstLz = rinkCenterZ;

  // ==========================================================================
  // INTERACTION, SKATING, PUPPY PLAY, PET SALON & CAMERA STATE MACHINE
  // ==========================================================================
  let activeMode: Floor3ActiveCameraMode = 'none';
  let lookYawOffset = 0.0;
  let lookPitchOffset = 0.0;
  let currentGalleryIndex = 0;
  let gallerySwitchCooldown = 0.0;

  // Ice Skating State
  let isSkatingExplicitlyActive = false;
  let skatingJumpSpinBoost = 0.0;

  // Puppy Play Area State (Petting & Ball Retrieve Loop)
  let heldBallIndex = -1;
  let activePettingPuppyIndex = -1;
  let pettingTimer = 0.0;
  let puppyPlayCelebrationTimer = 0.0;

  // Pet Salon 4-Stage Grooming State Machine
  // Stage 0 = Idle, Stage 1 = Wash, Stage 2 = Brush, Stage 3 = Style, Stage 4 = Finish ("All Done! ❤️")
  let groomStage: 0 | 1 | 2 | 3 | 4 = 0;
  let groomAnimTimer = 0.0;
  let groomCompletedCount = 0;
  let salonGroomCelebrationTimer = 0.0;

  const camState: Floor3CameraState = {
    active: false,
    mode: 'none',
    camWorldPos: new THREE.Vector3(),
    lookWorldPos: new THREE.Vector3(),
    blendAlpha: 0.0,
    isSitting: false,
  };

  const isOnFloor3 = (playerPos: THREE.Vector3) =>
    Math.abs(playerPos.y - floor3WorldY) <= 2.35;

  const isPointInsideIceRink = (lx: number, lz: number): boolean => {
    const dx = (lx - rinkCenterX) / (rinkRadiusX - 0.12);
    const dz = (lz - rinkCenterZ) / (rinkRadiusZ - 0.12);
    return dx * dx + dz * dz <= 1.0;
  };

  const isPlayerOnIceRink = (playerPos: THREE.Vector3): boolean => {
    if (!isOnFloor3(playerPos)) return false;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    return isPointInsideIceRink(lx, lz);
  };

  const isNearIceRinkEdge = (playerPos: THREE.Vector3): boolean => {
    if (!isPlayerOnIceRink(playerPos)) return false;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    const normDist = Math.hypot(
      (lx - rinkCenterX) / (rinkRadiusX - 0.12),
      (lz - rinkCenterZ) / (rinkRadiusZ - 0.12),
    );
    return normDist >= 0.62;
  };

  const constrainSkatingToRinkCurb = (
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
  ) => {
    if (!isSkatingExplicitlyActive) return;
    if (!isOnFloor3(playerPos)) {
      isSkatingExplicitlyActive = false;
      return;
    }
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    const rx = rinkRadiusX - 0.36;
    const rz = rinkRadiusZ - 0.36;
    const nx = (lx - rinkCenterX) / rx;
    const nz = (lz - rinkCenterZ) / rz;
    const ellipDist = Math.hypot(nx, nz);

    // Softly slide along the inner oval rink curb so the player doesn't launch out the gate at speed
    if (ellipDist > 1.0 && ellipDist > 0.0001) {
      const clampedLx = rinkCenterX + (nx / ellipDist) * rx;
      const clampedLz = rinkCenterZ + (nz / ellipDist) * rz;
      playerPos.x = originX + clampedLx;
      playerPos.z = originZ + clampedLz;

      // Normal vector of ellipse at boundary: (nx / rx, nz / rz)
      let gradX = nx / rx;
      let gradZ = nz / rz;
      const gradLen = Math.hypot(gradX, gradZ) || 1;
      gradX /= gradLen;
      gradZ /= gradLen;

      const outVel = playerVel.x * gradX + playerVel.z * gradZ;
      if (outVel > 0) {
        // Remove outward velocity component + gentle inward rebound so carving along the barrier feels smooth
        playerVel.x -= gradX * outVel * 1.12;
        playerVel.z -= gradZ * outVel * 1.12;
      }
    }

    // Also smoothly slide around the North-Center Ice Crystal Fountain (fountainX = -9.4, fountainZ = 1.45)
    const fdx = playerPos.x - (originX + fountainX);
    const fdz = playerPos.z - (originZ + fountainZ);
    const fDist = Math.hypot(fdx, fdz);
    const minFDist = 1.88;
    if (fDist < minFDist && fDist > 0.0001) {
      const fnx = fdx / fDist;
      const fnz = fdz / fDist;
      playerPos.x = originX + fountainX + fnx * minFDist;
      playerPos.z = originZ + fountainZ + fnz * minFDist;
      const inVel = playerVel.x * fnx + playerVel.z * fnz;
      if (inVel < 0) {
        playerVel.x -= fnx * inVel * 1.1;
        playerVel.z -= fnz * inVel * 1.1;
      }
    }
  };

  const recordSkateBladeMark = (wx: number, wz: number, yaw: number, speed: number) => {
    if (!isSkatingExplicitlyActive || speed < 0.45) return;
    const lx = wx - originX;
    const lz = wz - originZ;
    const stepD = Math.hypot(lx - lastSkateSampleLx, lz - lastSkateSampleLz);
    skateBladeSampleDist += stepD;
    lastSkateSampleLx = lx;
    lastSkateSampleLz = lz;

    if (skateBladeSampleDist >= 0.26) {
      skateBladeSampleDist = 0;
      skateBladeSideToggle = -skateBladeSideToggle;
      const rightX = Math.cos(yaw) * 0.11 * skateBladeSideToggle;
      const rightZ = -Math.sin(yaw) * 0.11 * skateBladeSideToggle;
      const slot = skateBladeMarks[skateBladeWriteIdx];
      slot.lx = lx + rightX;
      slot.lz = lz + rightZ;
      slot.yaw = yaw + skateBladeSideToggle * 0.08;
      slot.age = 0;
      slot.active = true;
      skateBladeWriteIdx = (skateBladeWriteIdx + 1) % SKATE_BLADE_MARK_COUNT;
    }
  };

  const findNearestGalleryExhibitIndex = (lx: number, lz: number): { index: number; dist: number } => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < exhibitPlacements.length; i++) {
      const curGroup = interactivePortraitExhibits[i]?.group;
      const px = curGroup ? curGroup.position.x : exhibitPlacements[i].lx;
      const pz = curGroup ? curGroup.position.z : exhibitPlacements[i].lz;
      const d = Math.hypot(lx - px, lz - pz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { index: bestIdx, dist: bestDist };
  };

  const findNearestPickupBall = (lx: number, lz: number): { index: number; dist: number } => {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let b = 0; b < playBalls.length; b++) {
      const ball = playBalls[b];
      if (
        ball.state === 'HELD_BY_PLAYER' ||
        ball.state === 'CARRIED_BY_PUPPY' ||
        (ball.state === 'THROWN' && Math.hypot(ball.vx, ball.vz) > 1.6)
      ) {
        continue;
      }
      const d = Math.hypot(lx - ball.lx, lz - ball.lz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = b;
      }
    }
    return { index: bestIdx, dist: bestDist };
  };

  const findNearestPuppy = (lx: number, lz: number): { index: number; dist: number } => {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let p = 0; p < puppies.length; p++) {
      const pup = puppies[p];
      if (pup.carryingBallIdx !== -1 || pup.retrievePhase === 'CHASE_BALL') continue;
      const d = Math.hypot(lx - pup.lx, lz - pup.lz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = p;
      }
    }
    return { index: bestIdx, dist: bestDist };
  };

  type ResolvedFloor3Action =
    | { type: 'exit_gallery'; prompt: string }
    | { type: 'groom_stage'; prompt: string }
    | { type: 'throw_ball'; prompt: string }
    | { type: 'exit_skating'; prompt: string }
    | { type: 'skating_active'; prompt: string }
    | { type: 'pickup_ball'; ballIdx: number; prompt: string }
    | { type: 'pet_puppy'; puppyIdx: number; prompt: string }
    | { type: 'start_skating'; prompt: string }
    | { type: 'start_groom'; prompt: string }
    | { type: 'view_gallery'; exhibitIdx: number; prompt: string };

  const resolvePriorityFloor3Action = (
    playerPos: THREE.Vector3,
  ): ResolvedFloor3Action | null => {
    // Priority 0: Active Heart Gallery inspection camera
    if (activeMode === 'heart_gallery') {
      const mem = galleryMemories[currentGalleryIndex];
      return {
        type: 'exit_gallery',
        prompt: `Heart Gallery (Frame ${currentGalleryIndex}: ${mem.title}) · Select [0-10] or [A/D] · [E] Exit`,
      };
    }

    if (!isOnFloor3(playerPos)) return null;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;

    // Priority 1: Active Pet Salon Grooming Stage
    if (groomStage > 0 && Math.hypot(lx - groomX, lz - groomZ) <= 3.4) {
      if (groomStage === 1) {
        return { type: 'groom_stage', prompt: '[E] Wash' };
      }
      if (groomStage === 2) {
        return { type: 'groom_stage', prompt: '[E] Brush' };
      }
      if (groomStage === 3) {
        return { type: 'groom_stage', prompt: '[E] Style' };
      }
      return { type: 'groom_stage', prompt: 'All Done! ❤️' };
    }

    // Priority 2: Holding a Ball -> ALWAYS "[E] Throw Ball" (never overridden by Pet Puppy)
    if (heldBallIndex !== -1) {
      return { type: 'throw_ball', prompt: '[E] Throw Ball' };
    }

    // Priority 3: Active Ice Skating Mode
    if (isSkatingExplicitlyActive && isPlayerOnIceRink(playerPos)) {
      if (isNearIceRinkEdge(playerPos)) {
        return { type: 'exit_skating', prompt: '[E] Exit Skating' };
      }
      return { type: 'skating_active', prompt: '[Space] Spin Jump · [E] Exit Skating' };
    }

    // Priority 4: Closest Valid Proximity Activity on Floor 3
    let bestAction: ResolvedFloor3Action | null = null;
    let bestScoreDist = Infinity;

    // Candidate A: Pick Up Ball (within 1.85m)
    const nearBall = findNearestPickupBall(lx, lz);
    if (nearBall.index !== -1 && nearBall.dist <= 1.85) {
      bestScoreDist = nearBall.dist;
      bestAction = {
        type: 'pickup_ball',
        ballIdx: nearBall.index,
        prompt: '[E] Pick Up Ball',
      };
    }

    // Candidate B: Pet Puppy (within 1.95m)
    const nearPup = findNearestPuppy(lx, lz);
    if (nearPup.index !== -1 && nearPup.dist <= 1.95 && nearPup.dist < bestScoreDist) {
      bestScoreDist = nearPup.dist;
      bestAction = {
        type: 'pet_puppy',
        puppyIdx: nearPup.index,
        prompt: '[E] Pet Puppy',
      };
    }

    // Candidate C: Start Skating (when standing on the Ice Rink surface)
    if (isPlayerOnIceRink(playerPos)) {
      const rinkScore = 0.5;
      if (rinkScore < bestScoreDist) {
        bestScoreDist = rinkScore;
        bestAction = {
          type: 'start_skating',
          prompt: '[E] Start Skating',
        };
      }
    }

    // Candidate D: Pet Salon Grooming Table (within 2.85m)
    const distGroom = Math.hypot(lx - groomX, lz - groomZ);
    if (lx <= -9.2 && lz >= 4.0 && distGroom <= 2.85 && distGroom < bestScoreDist) {
      bestScoreDist = distGroom;
      bestAction = {
        type: 'start_groom',
        prompt: groomCompletedCount > 0 ? '[E] Groom Puppy Again' : '[E] Groom Puppy',
      };
    }

    // Candidate E: Heart Gallery Portrait Inspection
    if (lx >= 4.2 && lx <= 15.5 && lz >= -15.5 && lz <= 8.0) {
      const nearestEx = findNearestGalleryExhibitIndex(lx, lz);
      const distCourt = Math.hypot(lx - courtCenterX, lz - courtCenterZ);
      const galleryDist = Math.min(nearestEx.dist, distCourt);
      if ((nearestEx.dist <= 4.8 || distCourt <= 4.5) && galleryDist < bestScoreDist) {
        bestScoreDist = galleryDist;
        bestAction = {
          type: 'view_gallery',
          exhibitIdx: nearestEx.index,
          prompt: 'Heart Gallery · [E] View Memory',
        };
      }
    }

    return bestAction;
  };

  const selectGalleryFrame = (index: number) => {
    const nextIdx =
      ((index % galleryMemories.length) + galleryMemories.length) %
      galleryMemories.length;
    currentGalleryIndex = nextIdx;
    for (let i = 0; i < galleryMemories.length; i++) {
      const isSel = i === currentGalleryIndex;
      drawGalleryCanvas(i, isSel);
      if (galleryFrameHalos[i]) {
        galleryFrameHalos[i].emissiveIntensity = isSel ? 1.05 : 0.28;
      }
    }
    playChime(587.33 + nextIdx * 65, 880 + nextIdx * 90);
  };

  const exitActiveCameraMode = () => {
    if (activeMode === 'none') return;
    activeMode = 'none';
    camState.active = false;
    camState.mode = 'none';
    camState.blendAlpha = 0.0;
    camState.isSitting = false;
    camState.seatWorldPos = undefined;
    camState.seatYaw = undefined;
    lookYawOffset = 0.0;
    lookPitchOffset = 0.0;
    avatarCallbacks?.resetNeutralPose();
    playChime(523.25, 392.0);
  };

  const throwHeldBall = (playerPos: THREE.Vector3): boolean => {
    if (heldBallIndex < 0 || heldBallIndex >= playBalls.length) return false;
    const ball = playBalls[heldBallIndex];
    heldBallIndex = -1;

    const playerLx = playerPos.x - originX;
    const playerLz = playerPos.z - originZ;
    let yaw = avatarCallbacks?.getPlayerFacingYaw?.() ?? 0;

    // If player is standing near the edge of the Puppy Play Area facing outward, bias throw toward the garden interior
    let dirX = Math.sin(yaw);
    let dirZ = Math.cos(yaw);
    const projLx = playerLx + dirX * 3.0;
    const projLz = playerLz + dirZ * 3.0;
    if (projLx < -2.6 || projLx > 3.4 || projLz < -13.5 || projLz > -5.2) {
      const toCenterYaw = Math.atan2(playCenterX - playerLx, playCenterZ - playerLz);
      dirX = Math.sin(toCenterYaw);
      dirZ = Math.cos(toCenterYaw);
    }

    ball.lx = THREE.MathUtils.clamp(playerLx + dirX * 0.45, -2.6, 3.4);
    ball.ly = 0.88;
    ball.lz = THREE.MathUtils.clamp(playerLz + dirZ * 0.45, -13.4, -5.3);
    ball.vx = dirX * 5.4;
    ball.vy = 2.45;
    ball.vz = dirZ * 5.4;
    ball.state = 'THROWN';

    // Single-Puppy Claim: select the nearest available puppy to chase & retrieve this ball
    let bestPup = -1;
    let bestPupDist = Infinity;
    for (let p = 0; p < puppies.length; p++) {
      if (p === activePettingPuppyIndex) continue;
      const pup = puppies[p];
      if (pup.carryingBallIdx !== -1 || pup.retrievePhase === 'CHASE_BALL') continue;
      const d = Math.hypot(pup.lx - ball.lx, pup.lz - ball.lz);
      if (d < bestPupDist) {
        bestPupDist = d;
        bestPup = p;
      }
    }
    if (bestPup === -1) bestPup = 0;

    ball.claimedByPuppy = bestPup;
    const claimingPup = puppies[bestPup];
    claimingPup.state = 'PLAY';
    claimingPup.retrievePhase = 'CHASE_BALL';
    claimingPup.playBowTimer = 0;
    claimingPup.stateTimer = 8.0;
    claimingPup.barkSparkleBoost = 1.0;
    claimingPup.targetLx = ball.lx;
    claimingPup.targetLz = ball.lz;

    puppyPlayCelebrationTimer = 4.5;
    playChime(659.25, 987.77);
    return true;
  };

  return {
    group,
    colliders,
    partitionMeshes,

    setAvatarCallbacks: (cbs) => {
      avatarCallbacks = cbs;
    },

    getActiveRoomCaption: () => {
      if (activeMode === 'heart_gallery') {
        return galleryMemories[currentGalleryIndex]?.quote ?? null;
      }
      return null;
    },

    getProximityPrompt: (playerPos: THREE.Vector3) => {
      const resolved = resolvePriorityFloor3Action(playerPos);
      return resolved ? resolved.prompt : null;
    },

    interact: (playerPos: THREE.Vector3) => {
      const resolved = resolvePriorityFloor3Action(playerPos);
      if (!resolved) return false;

      if (resolved.type === 'exit_gallery') {
        exitActiveCameraMode();
        return true;
      }

      if (resolved.type === 'groom_stage') {
        // Trigger current stage animation if not already animating
        if (groomAnimTimer > 0 || groomStage === 4) {
          return true;
        }
        if (groomStage === 1) {
          // STAGE 1: WASH
          groomAnimTimer = 1.8;
          salonGroomCelebrationTimer = 2.2;
          salonPuppyCoatMat.roughness = 0.18;
          salonPuppyCoatMat.emissiveIntensity = 0.14;
          avatarCallbacks?.setActivityPose('groom_wash');
          playChime(587.33, 880.0);
          return true;
        }
        if (groomStage === 2) {
          // STAGE 2: BRUSH
          groomAnimTimer = 1.8;
          salonBrushGroup.visible = true;
          salonGroomCelebrationTimer = 2.2;
          salonPuppyCoatMat.roughness = 0.32;
          salonPuppyCoatMat.emissiveIntensity = 0.18;
          avatarCallbacks?.setActivityPose('groom_brush');
          playChime(659.25, 987.77);
          return true;
        }
        if (groomStage === 3) {
          // STAGE 3: STYLE -> Attaches 1 of 3 cycling 3D accessories
          groomAnimTimer = 1.8;
          salonGroomCelebrationTimer = 3.2;
          const accIdx = groomCompletedCount % salonAccessoryGroups.length;
          for (let a = 0; a < salonAccessoryGroups.length; a++) {
            salonAccessoryGroups[a].visible = a === accIdx;
          }
          avatarCallbacks?.setActivityPose('groom_style');
          playChime(783.99, 1174.66);
          return true;
        }
        return true;
      }

      if (resolved.type === 'throw_ball') {
        return throwHeldBall(playerPos);
      }

      if (resolved.type === 'exit_skating' || resolved.type === 'skating_active') {
        isSkatingExplicitlyActive = false;
        avatarCallbacks?.resetNeutralPose();
        playChime(587.33, 440.0);
        return true;
      }

      if (resolved.type === 'pickup_ball') {
        const ball = playBalls[resolved.ballIdx];
        // Clear any previous puppy claim on this ball
        for (let p = 0; p < puppies.length; p++) {
          if (puppies[p].carryingBallIdx === resolved.ballIdx) {
            puppies[p].carryingBallIdx = -1;
            puppies[p].retrievePhase = 'NONE';
          }
        }
        ball.state = 'HELD_BY_PLAYER';
        ball.claimedByPuppy = -1;
        ball.vx = 0;
        ball.vy = 0;
        ball.vz = 0;
        heldBallIndex = resolved.ballIdx;
        playChime(587.33, 783.99);
        return true;
      }

      if (resolved.type === 'pet_puppy') {
        const pup = puppies[resolved.puppyIdx];
        activePettingPuppyIndex = resolved.puppyIdx;
        pettingTimer = 2.4;
        pup.state = 'FOLLOW_PLAYER';
        pup.stateTimer = 6.0;
        pup.retrievePhase = 'NONE';
        pup.barkSparkleBoost = 1.0;
        const playerLx = playerPos.x - originX;
        const playerLz = playerPos.z - originZ;
        pup.yaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
        avatarCallbacks?.setActivityPose('pet_puppy');
        playChime(659.25, 880.0);
        return true;
      }

      if (resolved.type === 'start_skating') {
        isSkatingExplicitlyActive = true;
        playChime(659.25, 880.0);
        return true;
      }

      if (resolved.type === 'start_groom') {
        groomStage = 1;
        groomAnimTimer = 0.0;
        salonBrushGroup.visible = false;
        salonGroomCelebrationTimer = 1.5;
        playChime(659.25, 880.0);
        return true;
      }

      if (resolved.type === 'view_gallery') {
        activeMode = 'heart_gallery';
        camState.active = true;
        camState.mode = 'heart_gallery';
        camState.blendAlpha = 0.0;
        camState.isSitting = false;
        camState.seatWorldPos = undefined;
        camState.seatYaw = undefined;
        lookYawOffset = 0.0;
        lookPitchOffset = 0.0;
        selectGalleryFrame(resolved.exhibitIdx);
        return true;
      }

      return false;
    },

    handleKeyAction: (code: string) => {
      if (activeMode !== 'heart_gallery') return false;
      if (code === 'Digit0' || code === 'Numpad0') {
        selectGalleryFrame(0);
        return true;
      }
      if (code === 'Digit1' || code === 'Numpad1') {
        selectGalleryFrame(1);
        return true;
      }
      if (code === 'Digit2' || code === 'Numpad2') {
        selectGalleryFrame(2);
        return true;
      }
      if (code === 'Digit3' || code === 'Numpad3') {
        selectGalleryFrame(3);
        return true;
      }
      if (code === 'Digit4' || code === 'Numpad4') {
        selectGalleryFrame(4);
        return true;
      }
      if (code === 'Digit5' || code === 'Numpad5') {
        selectGalleryFrame(5);
        return true;
      }
      if (code === 'Digit6' || code === 'Numpad6') {
        selectGalleryFrame(6);
        return true;
      }
      if (code === 'Digit7' || code === 'Numpad7') {
        selectGalleryFrame(7);
        return true;
      }
      if (code === 'Digit8' || code === 'Numpad8') {
        selectGalleryFrame(8);
        return true;
      }
      if (code === 'Digit9' || code === 'Numpad9') {
        selectGalleryFrame(9);
        return true;
      }
      if (code === 'ArrowRight' || code === 'KeyD') {
        selectGalleryFrame(currentGalleryIndex + 1);
        return true;
      }
      if (code === 'ArrowLeft' || code === 'KeyA') {
        selectGalleryFrame(currentGalleryIndex - 1);
        return true;
      }
      return false;
    },

    applyLookDelta: (yawDelta: number, pitchDelta: number) => {
      if (activeMode === 'none') return;
      lookYawOffset = THREE.MathUtils.clamp(lookYawOffset - yawDelta, -0.75, 0.75);
      lookPitchOffset = THREE.MathUtils.clamp(lookPitchOffset - pitchDelta, -0.42, 0.45);
    },

    exitActiveCameraMode,

    getCameraState: () => camState,

    selectGalleryFrame,

    setGalleryFrameImage: (frameIndex: number, imageSrc: string) => {
      applySavedGalleryImage(frameIndex, imageSrc, true);
    },

    getGalleryFrames: () =>
      galleryMemories.map((m, idx) => ({
        index: idx,
        title: m.title,
        sub: m.subtitle,
        hasCustomImage: Boolean(m.customImageUrl),
        customImageSrc: m.customImageUrl ?? undefined,
      })),

    getInteractivePortraitExhibits: () => interactivePortraitExhibits,

    isPlayerOnIceRink,

    isSkatingModeActive: () => isSkatingExplicitlyActive,

    exitSkatingMode: () => {
      isSkatingExplicitlyActive = false;
    },

    constrainSkatingToRinkCurb,

    recordSkateBladeMark,

    isHoldingPuppyBall: () => heldBallIndex !== -1,

    triggerSkatingJump: () => {
      skatingJumpSpinBoost = 1.0;
      skateJumpBurstLx = lastSkateSampleLx;
      skateJumpBurstLz = lastSkateSampleLz;
      playChime(783.99, 1174.66);
    },

    update: (
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      inputKeys?: Set<string>,
    ) => {
      const distToCastle = Math.hypot(playerPos.x - originX, playerPos.z - originZ);
      if (distToCastle > 60.0) return;

      // Auto-disengage skating mode immediately if player steps off the ice rink
      if (isSkatingExplicitlyActive && !isPlayerOnIceRink(playerPos)) {
        isSkatingExplicitlyActive = false;
      }

      if (gallerySwitchCooldown > 0) {
        gallerySwitchCooldown = Math.max(0, gallerySwitchCooldown - delta);
      }
      if (skatingJumpSpinBoost > 0) {
        skatingJumpSpinBoost = Math.max(0, skatingJumpSpinBoost - delta * 1.45);
      }
      if (puppyPlayCelebrationTimer > 0) {
        puppyPlayCelebrationTimer = Math.max(0, puppyPlayCelebrationTimer - delta);
      }
      if (salonGroomCelebrationTimer > 0) {
        salonGroomCelebrationTimer = Math.max(0, salonGroomCelebrationTimer - delta);
      }

      const playerLx = playerPos.x - originX;
      const playerLz = playerPos.z - originZ;

      // Update Puppy Petting Sequence (~2.4s)
      if (activePettingPuppyIndex !== -1) {
        const petPup = puppies[activePettingPuppyIndex];
        const dPet = Math.hypot(playerLx - petPup.lx, playerLz - petPup.lz);
        pettingTimer -= delta;
        if (pettingTimer <= 0 || dPet > 2.5 || heldBallIndex !== -1) {
          activePettingPuppyIndex = -1;
          pettingTimer = 0;
          if (groomStage === 0) {
            avatarCallbacks?.resetNeutralPose();
          }
        }
      }

      // Update Pet Salon 4-Stage Grooming Progression
      if (groomStage > 0) {
        const distGroom = Math.hypot(playerLx - groomX, playerLz - groomZ);
        if (distGroom > 3.4) {
          groomStage = 0;
          groomAnimTimer = 0;
          salonBrushGroup.visible = false;
          avatarCallbacks?.resetNeutralPose();
        } else if (groomAnimTimer > 0) {
          groomAnimTimer = Math.max(0, groomAnimTimer - delta);
          if (groomAnimTimer <= 0) {
            if (groomStage === 1) {
              // Wash complete -> Advance directly to Stage 2 ([E] Brush)
              groomStage = 2;
              avatarCallbacks?.resetNeutralPose();
            } else if (groomStage === 2) {
              // Brush complete -> Advance directly to Stage 3 ([E] Style)
              salonBrushGroup.visible = false;
              groomStage = 3;
              avatarCallbacks?.resetNeutralPose();
            } else if (groomStage === 3) {
              // Style complete -> Auto-trigger Stage 4 ("All Done! ❤️")
              groomStage = 4;
              groomAnimTimer = 1.65;
              groomCompletedCount += 1;
              salonGroomCelebrationTimer = 2.0;
              avatarCallbacks?.resetNeutralPose();
              playChime(880.0, 1318.51);
            } else if (groomStage === 4) {
              // Finish complete -> Return cleanly to idle exploration
              groomStage = 0;
              salonBrushGroup.visible = false;
            }
          }
        }
      }

      // 0. Animate Floor 3 Central Plaza Romantic Crystal Fountain
      plazaFountainWaterUniforms.uTime.value = elapsedTime;
      plazaFountainHeartPivot.position.y = 1.46 + Math.sin(elapsedTime * 1.6) * 0.035;
      plazaFountainHeartPivot.rotation.y = Math.sin(elapsedTime * 0.85) * 0.22;

      for (let sm = 0; sm < PLAZA_FOUNTAIN_DROPLET_COUNT; sm++) {
        const streamIdx = sm >> 1;
        const subIdx = sm & 1;
        const sCycle = (elapsedTime * 1.35 + streamIdx * 0.19 + subIdx * 0.47) % 1.0;
        const baseAng = (streamIdx / 8) * Math.PI * 2 + (subIdx === 0 ? -0.035 : 0.035);
        const sRad = 1.01 + sCycle * 0.09 * (subIdx === 0 ? 1 : -0.6);
        const sY = 0.402 + Math.sin(sCycle * Math.PI) * (subIdx === 0 ? 0.075 : 0.052);
        _dummy.position.set(Math.cos(baseAng) * sRad, sY, Math.sin(baseAng) * sRad);
        _dummy.scale.setScalar((1.0 - sCycle * 0.45) * (0.75 + Math.sin(sCycle * Math.PI) * 0.35));
        _dummy.updateMatrix();
        plazaFountainDropletInst.setMatrixAt(sm, _dummy.matrix);
      }
      plazaFountainDropletInst.instanceMatrix.needsUpdate = true;

      // 1. Animate Heart Gallery Floating Crystal Heart, Rose Petal Dome Central Heart & Orbiting Light Motes
      floatingCrystalHeartPivot.position.y =
        y0 + 2.05 + Math.sin(elapsedTime * 1.8) * 0.12;
      floatingCrystalHeartPivot.rotation.y = elapsedTime * 0.65;
      floatingHeartHalo.rotation.x = Math.sin(elapsedTime * 1.2) * 0.35;
      floatingHeartHalo.rotation.z = elapsedTime * 0.45;

      for (let hp = 0; hp < domeCenterHeartPivots.length; hp++) {
        domeCenterHeartPivots[hp].rotation.y = Math.sin(elapsedTime * 0.75 + hp) * 0.25;
        domeCenterHeartPivots[hp].position.y = -0.66 + Math.sin(elapsedTime * 1.6 + hp) * 0.02;
      }

      for (let m = 0; m < HEART_MOTE_COUNT; m++) {
        const ang = elapsedTime * 0.75 + (m / HEART_MOTE_COUNT) * Math.PI * 2;
        const r = 1.15 + Math.sin(elapsedTime * 1.5 + m) * 0.32;
        const my = y0 + 1.45 + ((elapsedTime * 0.45 + m * 0.19) % 1.65);
        _dummy.position.set(
          courtCenterX + Math.cos(ang) * r,
          my,
          courtCenterZ + Math.sin(ang) * r,
        );
        _dummy.rotation.set(elapsedTime + m, elapsedTime * 0.8, 0);
        const s = 0.65 + Math.sin(elapsedTime * 3.0 + m) * 0.35;
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        heartMoteInstanced.setMatrixAt(m, _dummy.matrix);
      }
      heartMoteInstanced.instanceMatrix.needsUpdate = true;

      // 2. Animate Ice Skating Palace Crystal Heart Fountain, Droplets, Fading Blade Marks & Spin Jump Burst
      const rinkActiveBoost = isSkatingExplicitlyActive || isPlayerOnIceRink(playerPos) ? 1.35 : 1.0;
      iceFountainHeartPivot.position.y = 1.75 + Math.sin(elapsedTime * 2.1) * 0.08;
      iceFountainHeartPivot.rotation.y =
        elapsedTime * (0.55 + skatingJumpSpinBoost * 2.5);

      for (let d = 0; d < ICE_DROPLET_COUNT; d++) {
        const cycle = (elapsedTime * 0.62 * rinkActiveBoost + d * 0.17) % 1.0;
        const arcR = 0.25 + cycle * 1.05;
        const ang = (d / ICE_DROPLET_COUNT) * Math.PI * 2 + elapsedTime * 0.4;
        const dy = y0 + 0.55 + Math.sin(cycle * Math.PI) * 1.45;
        _dummy.position.set(
          fountainX + Math.cos(ang) * arcR,
          dy,
          fountainZ + Math.sin(ang) * arcR,
        );
        _dummy.rotation.set(elapsedTime * 1.5, ang, 0);
        _dummy.scale.setScalar(0.6 + (1.0 - cycle) * 0.55);
        _dummy.updateMatrix();
        iceDropletInstanced.setMatrixAt(d, _dummy.matrix);
      }
      iceDropletInstanced.instanceMatrix.needsUpdate = true;

      // Update Fading Skate Blade Marks (0.8s lifetime)
      for (let bm = 0; bm < SKATE_BLADE_MARK_COUNT; bm++) {
        const slot = skateBladeMarks[bm];
        if (slot.active) {
          slot.age += delta;
          if (slot.age >= 0.8) {
            slot.active = false;
            _dummy.position.set(0, -100, 0);
            _dummy.scale.setScalar(0.0001);
          } else {
            const fade = 1.0 - slot.age / 0.8;
            _dummy.position.set(slot.lx, y0 + 0.031, slot.lz);
            _dummy.rotation.set(0, slot.yaw, 0);
            _dummy.scale.set(fade, 1.0, fade);
          }
          _dummy.updateMatrix();
          skateBladeMarkInstanced.setMatrixAt(bm, _dummy.matrix);
        }
      }
      skateBladeMarkInstanced.instanceMatrix.needsUpdate = true;

      // Update Skating Jump Crystal Burst
      for (let jc = 0; jc < SKATE_JUMP_CRYSTAL_COUNT; jc++) {
        if (skatingJumpSpinBoost > 0.01) {
          const prog = 1.0 - skatingJumpSpinBoost;
          const ang = (jc / SKATE_JUMP_CRYSTAL_COUNT) * Math.PI * 2 + prog * 3.2;
          const rad = 0.22 + prog * 0.85;
          const cy = y0 + 0.12 + Math.sin(prog * Math.PI) * 0.55;
          _dummy.position.set(
            skateJumpBurstLx + Math.cos(ang) * rad,
            cy,
            skateJumpBurstLz + Math.sin(ang) * rad,
          );
          _dummy.rotation.set(prog * 5.0, ang, prog * 3.0);
          _dummy.scale.setScalar(skatingJumpSpinBoost * 0.65);
        } else {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.setScalar(0.0001);
        }
        _dummy.updateMatrix();
        skateJumpCrystalInstanced.setMatrixAt(jc, _dummy.matrix);
      }
      skateJumpCrystalInstanced.instanceMatrix.needsUpdate = true;

      // 3. Animate Puppy Play Area Interactive Balls & 4 Puppy NPCs
      const isPlayerInPuppyGarden =
        isOnFloor3(playerPos) &&
        playerLx >= -3.8 &&
        playerLx <= 4.8 &&
        playerLz >= -15.0 &&
        playerLz <= -4.2;

      // Update Interactive Balls (Held in Player Hand, Thrown with Gravity/Bounce/Roll, or Carried in Puppy Mouth)
      for (let b = 0; b < playBalls.length; b++) {
        const ball = playBalls[b];
        if (ball.bouncePuffTimer > 0) {
          ball.bouncePuffTimer = Math.max(0, ball.bouncePuffTimer - delta * 2.2);
        }

        if (ball.state === 'HELD_BY_PLAYER') {
          if (avatarCallbacks?.getRightHandWorldPos) {
            avatarCallbacks.getRightHandWorldPos(_handWorldScratch);
            ball.lx = _handWorldScratch.x - originX;
            ball.ly = _handWorldScratch.y - floor3WorldY - 0.04;
            ball.lz = _handWorldScratch.z - originZ;
          } else {
            const yaw = avatarCallbacks?.getPlayerFacingYaw?.() ?? 0;
            ball.lx = playerLx + Math.sin(yaw + 0.45) * 0.35;
            ball.ly = 0.88;
            ball.lz = playerLz + Math.cos(yaw + 0.45) * 0.35;
          }
          ball.mesh.position.set(ball.lx, y0 + ball.ly, ball.lz);
          continue;
        }

        if (ball.state === 'CARRIED_BY_PUPPY') {
          // Positioned by the carrying puppy below
          continue;
        }

        // Thrown or rolling on ground
        const isMoving =
          Math.abs(ball.vx) > 0.015 ||
          Math.abs(ball.vz) > 0.015 ||
          ball.ly > 0.175 ||
          Math.abs(ball.vy) > 0.05;

        if (isMoving) {
          ball.lx += ball.vx * delta;
          ball.lz += ball.vz * delta;

          if (ball.ly > 0.17 || Math.abs(ball.vy) > 0.01) {
            ball.vy -= 12.5 * delta;
            ball.ly += ball.vy * delta;
            if (ball.ly <= 0.17) {
              ball.ly = 0.17;
              if (Math.abs(ball.vy) > 0.55) {
                ball.vy = -ball.vy * 0.52;
                ball.bouncePuffTimer = 1.0;
                ball.bouncePuffLx = ball.lx;
                ball.bouncePuffLz = ball.lz;
              } else {
                ball.vy = 0;
              }
            }
          }

          const drag = ball.ly <= 0.18 ? 1.95 : 0.45;
          ball.vx *= Math.exp(-drag * delta);
          ball.vz *= Math.exp(-drag * delta);

          // Strictly clamp & bounce within Puppy Play Area walkable bounds
          if (ball.lx < -2.65 || ball.lx > 3.45) {
            ball.vx = -ball.vx * 0.72;
            ball.lx = THREE.MathUtils.clamp(ball.lx, -2.65, 3.45);
          }
          if (ball.lz < -13.45 || ball.lz > -5.25) {
            ball.vz = -ball.vz * 0.72;
            ball.lz = THREE.MathUtils.clamp(ball.lz, -13.45, -5.25);
          }

          // Deflect off the Agility Tunnel (-2.35, -7.8) and Bridge Ramp (2.6, -7.8)
          const obstacles = [
            { ox: -2.35, oz: -7.8, r: 0.75 },
            { ox: 2.6, oz: -7.8, r: 0.85 },
          ];
          for (let ob = 0; ob < obstacles.length; ob++) {
            const o = obstacles[ob];
            const odx = ball.lx - o.ox;
            const odz = ball.lz - o.oz;
            const od = Math.hypot(odx, odz);
            if (od < o.r && od > 0.0001) {
              const onx = odx / od;
              const onz = odz / od;
              ball.lx = o.ox + onx * o.r;
              ball.lz = o.oz + onz * o.r;
              const dot = ball.vx * onx + ball.vz * onz;
              if (dot < 0) {
                ball.vx -= 1.7 * dot * onx;
                ball.vz -= 1.7 * dot * onz;
              }
            }
          }

          ball.mesh.position.set(ball.lx, y0 + ball.ly, ball.lz);
          ball.mesh.rotation.x += ball.vz * delta * 4.2;
          ball.mesh.rotation.z -= ball.vx * delta * 4.2;
        } else if (ball.state === 'THROWN' && ball.claimedByPuppy === -1) {
          ball.state = 'ON_GROUND';
        }
      }

      // Animate Ball Bounce Grass/Dust Puff Motes
      for (let pf = 0; pf < BALL_PUFF_COUNT; pf++) {
        const bIdx = pf % playBalls.length;
        const subIdx = Math.floor(pf / playBalls.length);
        const ball = playBalls[bIdx];
        if (ball.bouncePuffTimer > 0.01) {
          const prog = 1.0 - ball.bouncePuffTimer;
          const ang = (subIdx / 4) * Math.PI * 2 + bIdx;
          const rad = 0.08 + prog * 0.34;
          _dummy.position.set(
            ball.bouncePuffLx + Math.cos(ang) * rad,
            y0 + 0.04 + Math.sin(prog * Math.PI) * 0.14,
            ball.bouncePuffLz + Math.sin(ang) * rad,
          );
          _dummy.scale.setScalar(ball.bouncePuffTimer * 0.85);
        } else {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.setScalar(0.0001);
        }
        _dummy.updateMatrix();
        ballPuffInstanced.setMatrixAt(pf, _dummy.matrix);
      }
      ballPuffInstanced.instanceMatrix.needsUpdate = true;

      // Update 4 Puppy NPCs (Petting, Single-Puppy Retrieve-to-Feet, Play-Bow & Hysteresis AI)
      for (let p = 0; p < puppies.length; p++) {
        const pup = puppies[p];
        pup.stateTimer -= delta;
        if (pup.barkSparkleBoost > 0) {
          pup.barkSparkleBoost = Math.max(0, pup.barkSparkleBoost - delta * 0.55);
        }

        const distToPlayer = Math.hypot(playerLx - pup.lx, playerLz - pup.lz);

        // A. Active Petting Override
        if (p === activePettingPuppyIndex) {
          const toPlayerYaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
          let yawDiff = toPlayerYaw - pup.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          pup.yaw += yawDiff * Math.min(1, delta * 10.0);

          pup.root.position.set(
            pup.lx,
            y0 + Math.abs(Math.sin(elapsedTime * 7.5)) * 0.045,
            pup.lz,
          );
          pup.root.rotation.y = pup.yaw;
          pup.bodyMesh.rotation.x = 0;
          pup.headPivot.rotation.y = 0;
          pup.headPivot.rotation.x = -0.18 + Math.sin(elapsedTime * 6.0) * 0.08;
          pup.headPivot.rotation.z = 0.26 * Math.sin(elapsedTime * 3.5);
          pup.tailPivot.rotation.z = Math.sin(elapsedTime * 18.0) * 0.58;
          pup.legFL.rotation.x = 0;
          pup.legFR.rotation.x = 0;
          pup.legBL.rotation.x = -0.25;
          pup.legBR.rotation.x = -0.25;
          continue;
        }

        // B. Single-Puppy Ball Retrieve-to-Feet State Machine
        if (pup.retrievePhase === 'CHASE_BALL') {
          let claimedBallIdx = -1;
          for (let b = 0; b < playBalls.length; b++) {
            if (playBalls[b].claimedByPuppy === p) {
              claimedBallIdx = b;
              break;
            }
          }
          if (claimedBallIdx === -1) {
            pup.retrievePhase = 'NONE';
          } else {
            const ball = playBalls[claimedBallIdx];
            pup.targetLx = ball.lx;
            pup.targetLz = ball.lz;
            const dBall = Math.hypot(ball.lx - pup.lx, ball.lz - pup.lz);
            if (dBall <= 0.44 && ball.ly <= 0.48) {
              // Pick up ball in mouth & trot back to player's feet!
              ball.state = 'CARRIED_BY_PUPPY';
              ball.vx = 0;
              ball.vy = 0;
              ball.vz = 0;
              pup.carryingBallIdx = claimedBallIdx;
              pup.retrievePhase = 'RETURN_TO_PLAYER';
              pup.barkSparkleBoost = 1.0;
              playChime(783.99, 1046.5);
            }
          }
        } else if (pup.retrievePhase === 'RETURN_TO_PLAYER') {
          const bIdx = pup.carryingBallIdx;
          if (bIdx < 0 || bIdx >= playBalls.length) {
            pup.retrievePhase = 'NONE';
          } else {
            const ball = playBalls[bIdx];
            const playerYaw = avatarCallbacks?.getPlayerFacingYaw?.() ?? 0;
            const dropLx = isPlayerInPuppyGarden
              ? THREE.MathUtils.clamp(playerLx + Math.sin(playerYaw) * 1.15, -2.5, 3.3)
              : playCenterX;
            const dropLz = isPlayerInPuppyGarden
              ? THREE.MathUtils.clamp(playerLz + Math.cos(playerYaw) * 1.15, -13.2, -5.4)
              : playCenterZ;
            pup.targetLx = dropLx;
            pup.targetLz = dropLz;

            // Keep ball attached to puppy's mouth offset while trotting back
            ball.lx = pup.lx + Math.sin(pup.yaw) * 0.34;
            ball.ly = 0.28 + Math.abs(Math.sin(elapsedTime * 11.0)) * 0.06;
            ball.lz = pup.lz + Math.cos(pup.yaw) * 0.34;
            ball.mesh.position.set(ball.lx, y0 + ball.ly, ball.lz);

            const dDrop = Math.hypot(dropLx - pup.lx, dropLz - pup.lz);
            if (dDrop <= 0.38 || (isPlayerInPuppyGarden && distToPlayer <= 1.35)) {
              // Drop ball cleanly on floor at player's feet & enter Play-Bow!
              ball.state = 'ON_GROUND';
              ball.claimedByPuppy = -1;
              ball.ly = 0.17;
              ball.vx = 0;
              ball.vy = 0;
              ball.vz = 0;
              ball.mesh.position.set(ball.lx, y0 + 0.17, ball.lz);
              pup.carryingBallIdx = -1;
              pup.retrievePhase = 'PLAY_BOW';
              pup.playBowTimer = 1.25;
              pup.barkSparkleBoost = 1.0;
              playChime(659.25, 987.77);
            }
          }
        } else if (pup.retrievePhase === 'PLAY_BOW') {
          pup.playBowTimer -= delta;
          const toPlayerYaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
          let yawDiff = toPlayerYaw - pup.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          pup.yaw += yawDiff * Math.min(1, delta * 10.0);

          // Play-Bow Pose: front legs lowered, chest dipped, head looking up happily, rapid tail wag
          pup.root.position.set(pup.lx, y0 - 0.04, pup.lz);
          pup.root.rotation.y = pup.yaw;
          pup.bodyMesh.rotation.x = 0.26;
          pup.legFL.rotation.x = -0.68;
          pup.legFR.rotation.x = -0.68;
          pup.legBL.rotation.x = 0.15;
          pup.legBR.rotation.x = 0.15;
          pup.headPivot.rotation.x = -0.32;
          pup.headPivot.rotation.z = Math.sin(elapsedTime * 6.0) * 0.16;
          pup.tailPivot.rotation.z = Math.sin(elapsedTime * 19.0) * 0.62;

          if (pup.playBowTimer <= 0) {
            pup.retrievePhase = 'NONE';
            pup.bodyMesh.rotation.x = 0;
            pup.state = isPlayerInPuppyGarden ? 'FOLLOW_PLAYER' : 'WANDER';
            pup.stateTimer = 5.0;
          }
          continue;
        }

        // C. Standard Puppy AI State Transitions with Hysteresis (REST -> FOLLOW_PLAYER -> WANDER)
        if (pup.retrievePhase === 'NONE') {
          // REST -> player approaches within 2.6m -> FOLLOW_PLAYER
          if (pup.state === 'REST' && isPlayerInPuppyGarden && distToPlayer <= 2.6) {
            pup.state = 'FOLLOW_PLAYER';
            pup.stateTimer = 5.5;
            pup.followDisengageTimer = 0;
          }

          // FOLLOW_PLAYER -> player walks away (> 4.5m or leaves garden for > 1.5s) -> WANDER
          if (pup.state === 'FOLLOW_PLAYER') {
            if (!isPlayerInPuppyGarden || distToPlayer > 4.5) {
              pup.followDisengageTimer += delta;
              if (pup.followDisengageTimer >= 1.5) {
                pup.state = 'WANDER';
                pup.stateTimer = 4.5 + p * 0.8;
                pup.followDisengageTimer = 0;
                pup.targetLx = playCenterX + Math.sin(elapsedTime + p * 1.7) * 2.1;
                pup.targetLz = playCenterZ + Math.cos(elapsedTime + p * 1.3) * 2.4;
              }
            } else {
              pup.followDisengageTimer = 0;
            }
          }

          if (pup.stateTimer <= 0) {
            if (isPlayerInPuppyGarden && distToPlayer <= 3.2) {
              pup.state = 'FOLLOW_PLAYER';
              pup.stateTimer = 4.8 + p * 0.7;
            } else if (pup.state === 'REST') {
              pup.state = 'WANDER';
              pup.stateTimer = 4.2 + p * 0.9;
              pup.targetLx = playCenterX + Math.sin(elapsedTime * 1.3 + p * 2.1) * 2.2;
              pup.targetLz = playCenterZ + Math.cos(elapsedTime * 1.1 + p * 1.7) * 2.5;
            } else if (pup.state === 'WANDER' && pup.personality === 'sleepy') {
              pup.state = 'REST';
              pup.stateTimer = 4.5;
              pup.targetLx = pup.homeLx;
              pup.targetLz = pup.homeLz;
            } else {
              pup.state = 'WANDER';
              pup.stateTimer = 4.0 + p * 0.8;
              pup.targetLx = playCenterX + Math.cos(elapsedTime * 0.9 + p * 1.9) * 2.2;
              pup.targetLz = playCenterZ + Math.sin(elapsedTime * 1.1 + p * 1.5) * 2.5;
            }
          }

          if (pup.state === 'FOLLOW_PLAYER' && isPlayerInPuppyGarden) {
            const offsetAng = (p / puppies.length) * Math.PI * 2 + elapsedTime * 0.3;
            pup.targetLx = THREE.MathUtils.clamp(playerLx + Math.cos(offsetAng) * 1.35, -2.6, 3.4);
            pup.targetLz = THREE.MathUtils.clamp(playerLz + Math.sin(offsetAng) * 1.35, -13.4, -5.3);
          }
        }

        pup.bodyMesh.rotation.x = THREE.MathUtils.damp(pup.bodyMesh.rotation.x, 0, 10, delta);
        _scratchDir.set(pup.targetLx - pup.lx, pup.targetLz - pup.lz);
        const distToTarget = _scratchDir.length();
        const isMoving = pup.state !== 'REST' && distToTarget > 0.14;

        if (isMoving) {
          _scratchDir.divideScalar(distToTarget);
          const speedMult =
            pup.retrievePhase === 'CHASE_BALL'
              ? 1.85
              : pup.retrievePhase === 'RETURN_TO_PLAYER'
                ? 1.55
                : pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0
                  ? 1.35
                  : 1.0;
          const stepSpeed = pup.speed * speedMult;
          pup.lx = THREE.MathUtils.clamp(pup.lx + _scratchDir.x * stepSpeed * delta, -2.75, 3.45);
          pup.lz = THREE.MathUtils.clamp(pup.lz + _scratchDir.y * stepSpeed * delta, -13.6, -5.1);

          const desiredYaw = Math.atan2(_scratchDir.x, _scratchDir.y);
          let yawDiff = desiredYaw - pup.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          pup.yaw += yawDiff * Math.min(1, delta * 9.0);
          pup.headPivot.rotation.y = THREE.MathUtils.damp(pup.headPivot.rotation.y, 0, 8, delta);
        } else if (isPlayerInPuppyGarden) {
          const toPlayerYaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
          let hDiff = toPlayerYaw - pup.yaw;
          while (hDiff > Math.PI) hDiff -= Math.PI * 2;
          while (hDiff < -Math.PI) hDiff += Math.PI * 2;
          pup.headPivot.rotation.y = THREE.MathUtils.clamp(hDiff * 0.55, -0.55, 0.55);
        }

        const wagSpeed =
          pup.retrievePhase !== 'NONE' || pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0
            ? 15.0
            : 7.5;
        pup.tailPivot.rotation.z = Math.sin(elapsedTime * wagSpeed + p) * 0.45;
        pup.headPivot.rotation.z = THREE.MathUtils.damp(pup.headPivot.rotation.z, 0, 8, delta);

        if (isMoving || pup.state === 'PLAY') {
          const trot = elapsedTime * 11.5 + p * 1.5;
          const legSwing = Math.sin(trot) * 0.48;
          pup.legFL.rotation.x = legSwing;
          pup.legBR.rotation.x = legSwing;
          pup.legFR.rotation.x = -legSwing;
          pup.legBL.rotation.x = -legSwing;
          const hopY =
            pup.retrievePhase !== 'NONE' || pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0
              ? Math.abs(Math.sin(trot * 0.85)) * 0.085
              : 0;
          pup.root.position.set(pup.lx, y0 + hopY, pup.lz);
          pup.headPivot.rotation.x = Math.sin(trot * 0.5) * 0.1;
        } else {
          pup.legFL.rotation.x = 0;
          pup.legFR.rotation.x = 0;
          pup.legBL.rotation.x = -0.35;
          pup.legBR.rotation.x = -0.35;
          pup.root.position.set(pup.lx, y0 - 0.03, pup.lz);
          pup.headPivot.rotation.x = Math.sin(elapsedTime * 1.8 + p) * 0.06;
        }
        pup.root.rotation.y = pup.yaw;
      }

      // Animate Floating Heart Sparkles above Petted / Play-Bowing Puppies
      for (let hs = 0; hs < PUPPY_SPARKLE_COUNT; hs++) {
        const pupIdx = hs % puppies.length;
        const subIdx = Math.floor(hs / puppies.length);
        const pup = puppies[pupIdx];
        const isSparkling =
          pupIdx === activePettingPuppyIndex ||
          pup.retrievePhase === 'PLAY_BOW' ||
          pup.barkSparkleBoost > 0.05;
        if (isSparkling) {
          const cycle = (elapsedTime * 0.85 + subIdx * 0.33 + pupIdx * 0.2) % 1.0;
          const ang = subIdx * 2.1 + elapsedTime * 2.2;
          const rad = 0.16 + cycle * 0.22;
          _dummy.position.set(
            pup.lx + Math.cos(ang) * rad,
            y0 + 0.48 + cycle * 0.55,
            pup.lz + Math.sin(ang) * rad,
          );
          _dummy.rotation.set(0, elapsedTime * 2.5 + hs, 0);
          _dummy.scale.setScalar(Math.sin(cycle * Math.PI) * 0.95);
        } else {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.setScalar(0.0001);
        }
        _dummy.updateMatrix();
        puppySparkleInstanced.setMatrixAt(hs, _dummy.matrix);
      }
      puppySparkleInstanced.instanceMatrix.needsUpdate = true;

      // 4. Animate Pet Salon Puppy "Lulu", 3D Brush & Iridescent Wash/Sparkle Bubbles
      if (groomStage === 1 && groomAnimTimer > 0) {
        // STAGE 1: WASH — Happy wiggle under pink soap bubbles
        salonPuppyModel.root.position.set(0, 0.86 + Math.abs(Math.sin(elapsedTime * 8.0)) * 0.03, 0);
        salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * 5.0) * 0.35;
        salonPuppyModel.headPivot.rotation.x = -0.12 + Math.sin(elapsedTime * 7.0) * 0.1;
        salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 16.0) * 0.55;
      } else if (groomStage === 2 && groomAnimTimer > 0) {
        // STAGE 2: BRUSH — 3D Royal Brush sweeps across Lulu + fluffy coat bounce + head tilt
        const sweep = Math.sin(elapsedTime * 9.5);
        salonBrushGroup.visible = true;
        salonBrushGroup.position.set(
          sweep * 0.16,
          1.26 + Math.cos(elapsedTime * 9.5) * 0.03,
          Math.cos(elapsedTime * 4.75) * 0.12,
        );
        salonBrushGroup.rotation.z = sweep * 0.22;
        const bounce = 1.0 + Math.abs(sweep) * 0.08;
        salonPuppyModel.bodyMesh.scale.set(bounce, bounce, 1.0);
        salonPuppyModel.headPivot.rotation.z = 0.24 * Math.sin(elapsedTime * 4.5);
        salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 17.0) * 0.55;
      } else if (groomStage === 3 && groomAnimTimer > 0) {
        // STAGE 3: STYLE — Proud pose as accessory is placed
        salonPuppyModel.bodyMesh.scale.set(1, 1, 1);
        salonPuppyModel.root.position.set(0, 0.86, 0);
        salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * 3.0) * 0.25;
        salonPuppyModel.headPivot.rotation.x = -0.22;
        salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 18.0) * 0.58;
      } else if (groomStage === 4) {
        // STAGE 4: ALL DONE! ❤️ — Stands, shakes slightly, sparkles, wags tail happily
        salonPuppyModel.bodyMesh.scale.set(1, 1, 1);
        salonPuppyModel.root.position.set(
          0,
          0.86 + Math.abs(Math.sin(elapsedTime * 10.0)) * 0.055,
          0,
        );
        salonPuppyModel.root.rotation.z = Math.sin(elapsedTime * 22.0) * 0.12;
        salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * 4.5) * 0.45;
        salonPuppyModel.headPivot.rotation.x = -0.18;
        salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 20.0) * 0.65;
      } else {
        salonPuppyModel.bodyMesh.scale.set(1, 1, 1);
        salonPuppyModel.root.position.set(0, 0.86, 0);
        salonPuppyModel.root.rotation.z = 0;
        salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * 0.65) * 0.45;
        salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 9.5) * 0.38;
        salonPuppyModel.headPivot.rotation.z = Math.sin(elapsedTime * 2.2) * 0.1;
      }

      const isWashingOrCelebrating =
        (groomStage === 1 && groomAnimTimer > 0) ||
        groomStage === 4 ||
        salonGroomCelebrationTimer > 0;
      const bubbleBoost = isWashingOrCelebrating ? 1.75 : 1.0;
      for (let b = 0; b < SALON_BUBBLE_COUNT; b++) {
        const bCycle = (elapsedTime * 0.42 * bubbleBoost + b * 0.19) % 1.0;
        const onGroomTable =
          (groomStage === 1 && groomAnimTimer > 0) ||
          (isWashingOrCelebrating && b % 2 === 0);
        const baseX = onGroomTable ? groomX : -13.95;
        const baseZ = onGroomTable ? groomZ : 12.8;
        const baseY = onGroomTable ? y0 + 0.92 : y0 + 0.58;
        const bAng = b * 1.3 + elapsedTime * (onGroomTable ? 2.2 : 0.8);
        const bRad = (onGroomTable ? 0.42 : 0.46) * (0.35 + bCycle * 0.65);
        _dummy.position.set(
          baseX + Math.cos(bAng) * bRad,
          baseY + bCycle * (onGroomTable ? 0.95 : 1.25),
          baseZ + Math.sin(bAng) * bRad,
        );
        _dummy.scale.setScalar((1.0 - bCycle * 0.6) * (onGroomTable ? 1.25 : 0.9));
        _dummy.updateMatrix();
        salonBubbleInstanced.setMatrixAt(b, _dummy.matrix);
      }
      salonBubbleInstanced.instanceMatrix.needsUpdate = true;

      // 5. Update Heart Gallery Inspection Camera if active
      if (activeMode === 'heart_gallery') {
        if (inputKeys && gallerySwitchCooldown <= 0) {
          if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight')) {
            selectGalleryFrame(currentGalleryIndex + 1);
            gallerySwitchCooldown = 0.28;
          } else if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft')) {
            selectGalleryFrame(currentGalleryIndex - 1);
            gallerySwitchCooldown = 0.28;
          }
        }

        camState.blendAlpha = Math.min(1.0, camState.blendAlpha + delta * 2.6);
        const ex = exhibitPlacements[currentGalleryIndex];
        const exhibitGroup = interactivePortraitExhibits[currentGalleryIndex]?.group;
        const curLx = exhibitGroup ? exhibitGroup.position.x : ex.lx;
        const curLz = exhibitGroup ? exhibitGroup.position.z : ex.lz;
        const curRotY = exhibitGroup ? exhibitGroup.rotation.y : ex.rotY;
        const normalX = Math.sin(curRotY);
        const normalZ = Math.cos(curRotY);
        const rightX = Math.cos(curRotY);
        const rightZ = -Math.sin(curRotY);
        const camWx = originX + curLx + normalX * ex.camDist;
        const camWz = originZ + curLz + normalZ * ex.camDist;
        const lookWx = originX + curLx;
        const lookWz = originZ + curLz;
        const panOffset = Math.sin(lookYawOffset) * 0.85;

        camState.camWorldPos.set(camWx, floor3WorldY + 2.18, camWz);
        camState.lookWorldPos.set(
          lookWx + rightX * panOffset,
          floor3WorldY + 2.22 + Math.sin(lookPitchOffset) * 0.75,
          lookWz + rightZ * panOffset,
        );
      }
    },
  };
}
