import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

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
  }) => void;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyLookDelta: (yawDelta: number, pitchDelta: number) => void;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor3CameraState;
  setGalleryFrameImage: (frameIndex: number, imageSrc: string) => void;
  getGalleryFrames: () => readonly GalleryFrameInfo[];
  isPlayerOnIceRink: (playerPos: THREE.Vector3) => boolean;
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

interface PuppyNpc {
  name: string;
  personality: 'energetic' | 'curious' | 'sleepy' | 'playful';
  root: THREE.Group;
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
  } | null = null;

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
  //    ("YESHWANTH LOVES HARSHA" physically inlaid in curved champagne-gold serif lettering)
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
      emissiveIntensity: 0.22,
      roughness: 0.16,
      metalness: 0.88,
      clearcoat: 0.75,
      clearcoatRoughness: 0.1,
    }),
  );
  const fountainWaterMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f5d0fe'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.22,
      roughness: 0.04,
      metalness: 0.08,
      transmission: 0.72,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      ior: 1.333,
    }),
  );
  const fountainStreamMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fdf4ff'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.28,
      roughness: 0.06,
      metalness: 0.05,
      transmission: 0.78,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
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

  // --- 0.1 CIRCULAR MARBLE FLOOR COMPOSITION & CURVED INLAID GOLD INSCRIPTION ("YESHWANTH LOVES HARSHA") ---
  // High-resolution 2048x2048 circular floor inlay texture + 3D raised champagne-gold letter plaques
  const createPlazaFloorInscriptionTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const C = 1024;
      ctx.clearRect(0, 0, 2048, 2048);

      // Concentric polished blush-pink & pearl marble floor rings (outer radius 980px => 2.68m)
      const bgGrad = ctx.createRadialGradient(C, C, 460, C, C, 990);
      bgGrad.addColorStop(0, '#fce7f3');
      bgGrad.addColorStop(0.45, '#fdf2f8');
      bgGrad.addColorStop(0.76, '#fbcfe8');
      bgGrad.addColorStop(0.95, '#f9a8d4');
      bgGrad.addColorStop(1, 'rgba(249, 168, 212, 0.0)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(C, C, 990, 0, Math.PI * 2);
      ctx.fill();

      // Subtle radial champagne-gold geometric lines across the outer motif band
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.25)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(ang) * 610, C + Math.sin(ang) * 610);
        ctx.lineTo(C + Math.cos(ang) * 960, C + Math.sin(ang) * 960);
        ctx.stroke();
      }

      // Concentric champagne-gold inlay rings framing the inscription band (r = 635px..830px)
      [625, 642, 822, 838, 968].forEach((rPx, idx) => {
        ctx.beginPath();
        ctx.arc(C, C, rPx, 0, Math.PI * 2);
        ctx.strokeStyle = idx % 2 === 0 ? '#f59e0b' : '#fef08a';
        ctx.lineWidth = idx === 4 ? 10 : 5;
        ctx.stroke();
      });

      // Darker blush-rose marble inscription channel (r = 642px..822px) so gold serif letters pop with high contrast
      ctx.beginPath();
      ctx.arc(C, C, 822, 0, Math.PI * 2);
      ctx.arc(C, C, 642, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(190, 24, 93, 0.16)';
      ctx.fill();

      // Helper to render curved inlaid champagne-gold serif lettering along a circular arc
      // Viewer standing outside at centerPhi looking inward reads left-to-right (decreasing phi) with letter tops pointing inward
      const drawCurvedGoldInscription = (text: string, centerPhi: number, radiusPx: number) => {
        const charCount = text.length;
        const totalArc = 1.62; // radians (~93 degrees)
        const stepPhi = totalArc / Math.max(1, charCount - 1);
        const startPhi = centerPhi + totalArc * 0.5;

        ctx.save();
        ctx.font = 'bold 68px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < charCount; i++) {
          const ch = text[i];
          const phi = startPhi - i * stepPhi;
          const x = C + Math.cos(phi) * radiusPx;
          const y = C + Math.sin(phi) * radiusPx;

          ctx.save();
          ctx.translate(x, y);
          // Rotate so letter top (0, -1) points inward (-cos phi, -sin phi) and letter right (+1, 0) points along decreasing phi
          ctx.rotate(phi - Math.PI * 0.5);

          // Engraved marble shadow bevel
          ctx.fillStyle = 'rgba(131, 24, 67, 0.72)';
          ctx.fillText(ch, 3, 4);

          // Warm golden glow halo
          ctx.shadowColor = 'rgba(254, 240, 138, 0.95)';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#f59e0b';
          ctx.fillText(ch, 0, 0);

          // Bright champagne-gold metallic face + specular highlight stroke
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fef08a';
          ctx.fillText(ch, -1, -1);
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.8;
          ctx.strokeText(ch, 0, 0);

          ctx.restore();
        }
        ctx.restore();
      };

      const inscriptionText = 'YESHWANTH LOVES HARSHA';
      // Primary Front Arc (facing the player in the West/North-West Plaza & Stair view, e.g. X 82m / Z 21m)
      // plus Opposite Arc (facing the Heart Gallery & South-East Promenade) so it is readable from every approach
      drawCurvedGoldInscription(inscriptionText, Math.PI * 0.78, 732);
      drawCurvedGoldInscription(inscriptionText, -Math.PI * 0.22, 732);
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
      emissive: new THREE.Color('#fde68a'),
      emissiveMap: plazaFloorInlayTex,
      emissiveIntensity: 0.22,
      roughness: 0.14,
      metalness: 0.28,
      transparent: true,
    }),
  );

  const plazaFloorDiscGeo = tracker.trackGeo(new THREE.PlaneGeometry(5.5, 5.5));
  plazaFloorDiscGeo.rotateX(-Math.PI / 2);
  const plazaFloorDisc = new THREE.Mesh(plazaFloorDiscGeo, plazaFloorInlayMat);
  plazaFloorDisc.position.y = 0.012;
  plazaFloorDisc.receiveShadow = true;
  plazaFountainGroup.add(plazaFloorDisc);

  // Physical 3D Concentric Champagne-Gold & Glow Rings inlaid into the circular marble floor
  [
    { r: 1.72, tube: 0.022, mat: fountainGoldMat },
    { r: 2.25, tube: 0.024, mat: fountainGoldMat },
    { r: 2.64, tube: 0.03, mat: fountainGoldMat },
    { r: 2.67, tube: 0.016, mat: fountainSoftGlowMat },
  ].forEach(({ r, tube, mat }) => {
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(r, tube, 10, 64));
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, mat);
    ringMesh.position.y = 0.016;
    plazaFountainGroup.add(ringMesh);
  });

  // Physical Raised/Inlaid 3D Champagne-Gold Letter Relief Bars along the Circular Inscription Path (r = 1.98m)
  // Gives real 3D specular highlights to every character of "YESHWANTH LOVES HARSHA" on the floor
  const letterReliefBarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.068, 0.008, 0.11));
  const inscriptionPhrase = 'YESHWANTH LOVES HARSHA';
  [Math.PI * 0.78, -Math.PI * 0.22].forEach((centerPhi) => {
    const totalArc = 1.62;
    const stepPhi = totalArc / (inscriptionPhrase.length - 1);
    const startPhi = centerPhi + totalArc * 0.5;
    for (let i = 0; i < inscriptionPhrase.length; i++) {
      if (inscriptionPhrase[i] === ' ') continue;
      const phi = startPhi - i * stepPhi;
      const rLet = 1.98;
      const bar = new THREE.Mesh(letterReliefBarGeo, fountainGoldMat);
      bar.position.set(Math.cos(phi) * rLet, 0.014, Math.sin(phi) * rLet);
      bar.rotation.y = -phi + Math.PI * 0.5;
      plazaFountainGroup.add(bar);
    }
  });

  // 8 Inlaid Heart-Shaped Geometric Motifs & Crystal Inlays around the Outer Floor Ring (r = 2.45m)
  const floorHeartBezelGeo = buildExtrudedHeartGeometry(tracker, 0.26, 0.022, 0.008);
  floorHeartBezelGeo.rotateX(-Math.PI / 2);
  const floorHeartCrystalGeo = buildExtrudedHeartGeometry(tracker, 0.2, 0.026, 0.008);
  floorHeartCrystalGeo.rotateX(-Math.PI / 2);
  const floorDiamondCrystalGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.042, 0));

  for (let h = 0; h < 8; h++) {
    const ang = (h / 8) * Math.PI * 2 + Math.PI * 0.125;
    const hr = 2.45;
    const hx = Math.cos(ang) * hr;
    const hz = Math.sin(ang) * hr;

    const hBezel = new THREE.Mesh(floorHeartBezelGeo, fountainGoldMat);
    hBezel.position.set(hx, 0.015, hz);
    hBezel.rotation.y = -ang + Math.PI * 0.5;

    const hCrystal = new THREE.Mesh(floorHeartCrystalGeo, floatingHeartCrystalMat);
    hCrystal.position.set(hx, 0.018, hz);
    hCrystal.rotation.y = -ang + Math.PI * 0.5;

    // Small lavender/pink crystal inlay between the heart motifs
    const midAng = ang + Math.PI / 8;
    const inlay = new THREE.Mesh(floorDiamondCrystalGeo, crystalArchMat);
    inlay.position.set(Math.cos(midAng) * 2.45, 0.016, Math.sin(midAng) * 2.45);
    inlay.scale.set(1.0, 0.35, 1.0);

    plazaFountainGroup.add(hBezel, hCrystal, inlay);
  }

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

  plazaFountainGroup.add(
    basinBaseStep,
    basinUnderGlow,
    basinOuterWall,
    basinTopGoldRim,
    basinInnerLip,
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

  // Shallow Layer of Clear Reflective Water inside the Basin + Animated Concentric Ripple Rings
  const waterDiscGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.25, 1.25, 0.03, 44));
  const waterDisc = new THREE.Mesh(waterDiscGeo, fountainWaterMat);
  waterDisc.position.y = 0.39;
  plazaFountainGroup.add(waterDisc);

  const plazaFountainRippleRings: THREE.Mesh[] = [];
  [0.45, 0.78, 1.08].forEach((rInit) => {
    const ripGeo = tracker.trackGeo(new THREE.TorusGeometry(1.0, 0.012, 8, 40));
    ripGeo.rotateX(Math.PI / 2);
    const ripMesh = new THREE.Mesh(ripGeo, fountainPinkGlowMat);
    ripMesh.position.y = 0.41;
    ripMesh.scale.setScalar(rInit);
    plazaFountainRippleRings.push(ripMesh);
    plazaFountainGroup.add(ripMesh);
  });

  // --- 0.3 CENTRAL PEDESTAL, UPPER SPILL BOWL & SMALL ELEGANT CRYSTAL CENTERPIECE ---
  // Central Fluted Blush-Marble Column + Upper Scalloped Spill Bowl
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

  const upperBowlWaterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 0.025, 32));
  const upperBowlWater = new THREE.Mesh(upperBowlWaterGeo, fountainWaterMat);
  upperBowlWater.position.y = 1.06;

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

  // --- 0.4 CALM, SMOOTH FLOWING WATER STREAMS (Zero Large Waterfall, Restrained Peaceful Shimmer) ---
  // 4 Delicate Upper Streams flowing from beneath the suspended crystal into the upper bowl
  for (let us = 0; us < 4; us++) {
    const ang = (us / 4) * Math.PI * 2 + Math.PI * 0.25;
    const uCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(ang) * 0.06, 1.32, Math.sin(ang) * 0.06),
      new THREE.Vector3(Math.cos(ang) * 0.28, 1.26, Math.sin(ang) * 0.28),
      new THREE.Vector3(Math.cos(ang) * 0.46, 1.06, Math.sin(ang) * 0.46),
    );
    const uStreamGeo = tracker.trackGeo(new THREE.TubeGeometry(uCurve, 16, 0.016, 8, false));
    plazaFountainGroup.add(new THREE.Mesh(uStreamGeo, fountainStreamMat));
  }

  // 8 Smooth Arching Water Streams flowing from the upper bowl lip down into the main basin
  const splashRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.085, 0.009, 6, 20));
  splashRingGeo.rotateX(Math.PI / 2);
  for (let ls = 0; ls < 8; ls++) {
    const ang = (ls / 8) * Math.PI * 2;
    const lCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(ang) * 0.62, 1.05, Math.sin(ang) * 0.62),
      new THREE.Vector3(Math.cos(ang) * 0.92, 0.86, Math.sin(ang) * 0.92),
      new THREE.Vector3(Math.cos(ang) * 1.04, 0.39, Math.sin(ang) * 1.04),
    );
    const lStreamGeo = tracker.trackGeo(new THREE.TubeGeometry(lCurve, 18, 0.022, 8, false));
    const lStreamMesh = new THREE.Mesh(lStreamGeo, fountainStreamMat);

    const splashRing = new THREE.Mesh(splashRingGeo, fountainPinkGlowMat);
    splashRing.position.set(Math.cos(ang) * 1.04, 0.405, Math.sin(ang) * 1.04);

    plazaFountainGroup.add(lStreamMesh, splashRing);
  }

  // 12 Subtle Instanced Water Shimmer Motes gliding smoothly along the streams (Zero Excessive Particles)
  const PLAZA_FOUNTAIN_SHIMMER_COUNT = 12;
  const shimmerMoteGeo = tracker.trackGeo(new THREE.SphereGeometry(0.026, 8, 8));
  const plazaFountainWaterShimmerInst = new THREE.InstancedMesh(
    shimmerMoteGeo,
    fountainPinkGlowMat,
    PLAZA_FOUNTAIN_SHIMMER_COUNT,
  );
  plazaFountainWaterShimmerInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plazaFountainGroup.add(plazaFountainWaterShimmerInst);

  // --- 0.5 SMALL ROMANTIC FLOWER CLUSTERS & MINIATURE GOLD LANTERNS AROUND BASIN EDGE ---
  // Hugs the immediate outer edge of the basin (r = 1.48m), leaving the "YESHWANTH LOVES HARSHA"
  // floor inscription (r = 1.98m) and surrounding walking paths 100% clear and unobstructed!
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

  // West Wall Sconces (3 flanking Left Portrait Pair, 3 flanking Right Portrait Pair — exact match with reference!)
  [7.68, 5.65, 3.62, -1.05, -3.85, -6.72].forEach((sz) => {
    buildCrystalWallSconce(4.98, sz, Math.PI / 2);
  });
  // East Apse Sconces flanking the 5th Memory Exhibit
  [-5.15, -2.45].forEach((sz) => {
    buildCrystalWallSconce(14.66, sz, -Math.PI / 2);
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

  // 3 West-Wall Floral Pedestals at exact reference positions + 2 East-Apse Floral Pedestals
  buildFloralHeartPedestal(5.38, 5.65, Math.PI / 2); // Between Left Portrait 1 & Portrait 2
  buildFloralHeartPedestal(5.38, -1.12, Math.PI / 2); // Between Right Main Arch Column & Portrait 3
  buildFloralHeartPedestal(5.38, -6.82, Math.PI / 2); // Between Portrait 4 & Secondary Right Archway
  buildFloralHeartPedestal(14.28, -5.25, -Math.PI / 2);
  buildFloralHeartPedestal(14.28, -2.35, -Math.PI / 2);

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

  // --- 1.11 5 INTERACTIVE MEMORY PORTRAITS IN VERTICAL ORNATE ROCOCO GOLD FRAMES ---
  // Preserves all 5 existing gallery memories, custom photo persistence, and inspection controls,
  // while rendering the 4 West-Wall Reference Portraits + 1 East-Apse Hero Portrait in vertical Rococo frames
  // with top glowing pink heart crests, bottom gold cartouche plaques, and physical overhead gold picture lights!
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
  ];

  const galleryCanvases: HTMLCanvasElement[] = [];
  const galleryTextures: THREE.CanvasTexture[] = [];
  const galleryFrameHalos: THREE.MeshStandardMaterial[] = [];

  // Renders the 5 vertical portrait canvases (512 x 680) matching the exact painted subjects in the reference image
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
      // Her silhouette & flowing hair + soft rose dress
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
    } else {
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
    isHeroExhibit?: boolean;
  }

  // Exact Reference-Locked Portrait Placements:
  // - Exhibits 0 & 1: Left of the Main Archway on the West Wall (lx = 4.98, facing East +X -> rotY = +Math.PI / 2)
  // - Exhibits 2 & 3: Right of the Main Archway on the West Wall (lx = 4.98, facing East +X -> rotY = +Math.PI / 2)
  // - Exhibit 4: East Apse Hero Portrait across the Central Memory Court (lx = 14.66, facing West -X -> rotY = -Math.PI / 2)
  const exhibitPlacements: GalleryExhibitPlacement[] = [
    { lx: 4.98, lz: 6.68, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: 4.62, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: -2.35, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 4.98, lz: -5.35, rotY: Math.PI * 0.5, camDist: 2.65 },
    { lx: 14.66, lz: -3.8, rotY: -Math.PI * 0.5, camDist: 2.85, isHeroExhibit: true },
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

  // Reusable builder for all 7 physical portrait exhibits (5 interactive memories + 2 decorative architectural portraits)
  // Guarantees identical 3D Rococo frame geometry, top glowing pink heart crest, bottom gold plaque,
  // and physical overhead gold picture-light fixture + warm bulb + downward beam cone + wall wash.
  const buildGalleryPortraitExhibit = (
    lx: number,
    lz: number,
    rotY: number,
    scaleMult: number,
    tex: THREE.CanvasTexture,
    outerFrameMat: THREE.Material,
  ) => {
    const exhibitGroup = new THREE.Group();
    exhibitGroup.position.set(lx, y0, lz);
    exhibitGroup.rotation.y = rotY;
    exhibitGroup.scale.setScalar(scaleMult);

    const centerY = 2.22;

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

    // 6. Bottom-Center Curved Gold Cartouche Nameplate Plaque
    const plaque = new THREE.Mesh(frameBottomPlaqueGeo, galleryRoyalGoldMat);
    plaque.position.set(0, centerY - frameH * 0.5 - 0.02, 0.12);
    exhibitGroup.add(plaque);

    // 7. Portrait Canvas Surface (Lit from above by the Picture Light — non-self-luminous UI look)
    const artMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color('#fff1f2'),
        emissiveMap: tex,
        emissiveIntensity: 0.42,
        roughness: 0.28,
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
  };

  // Instantiate the 5 Interactive Memory Portraits (indices 0..4)
  for (let i = 0; i < galleryMemories.length; i++) {
    const p = exhibitPlacements[i];
    const scaleMult = p.isHeroExhibit ? 1.08 : 1.0;

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
        color: new THREE.Color('#f5d076'),
        emissive: new THREE.Color('#fbbf24'),
        emissiveIntensity: i === 0 ? 0.55 : 0.24,
        roughness: 0.18,
        metalness: 0.85,
      }),
    );
    galleryFrameHalos.push(haloMat);

    buildGalleryPortraitExhibit(p.lx, p.lz, p.rotY, scaleMult, tex, haloMat);
  }

  // --- 1.12 TWO DECORATIVE ARCHITECTURAL PORTRAIT EXHIBITS (Total Visible Portraits = 7) ---
  // Symmetrically flank Memory 5 Hero (lx = 14.66, lz = -3.8) along the uninterrupted East / Apse Wall
  // at lz = -0.65 and lz = -6.95 (outside the East sconces & floral pedestals), without modifying the
  // 5-memory interactive system, localStorage model, or getGalleryFrames().
  const createDecorativePortraitTexture = (variant: 0 | 1): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const W = 512;
      const H = 680;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (variant === 0) {
        // Decorative Portrait 1 (North-East Apse): Enchanted Pastel Rose Garden Pergola at Twilight
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
      } else {
        // Decorative Portrait 2 (South-East Apse): Dreamy Rose-Gold Palace Bridge & Starlit Lagoon
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
      }

      // Matching subtle inner golden picture mat border
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, W - 16, H - 16);
    }

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  };

  const decorativeFrameMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5d076'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.24,
      roughness: 0.18,
      metalness: 0.85,
    }),
  );

  // Place the 2 decorative portraits on the East / Apse wall flanking [Memory 5 Hero]
  buildGalleryPortraitExhibit(
    14.66,
    -0.65,
    -Math.PI * 0.5,
    1.0,
    createDecorativePortraitTexture(0),
    decorativeFrameMat,
  );
  buildGalleryPortraitExhibit(
    14.66,
    -6.95,
    -Math.PI * 0.5,
    1.0,
    createDecorativePortraitTexture(1),
    decorativeFrameMat,
  );

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
  const playBalls: Array<{
    mesh: THREE.Mesh;
    homeLx: number;
    homeLz: number;
    lx: number;
    lz: number;
    vx: number;
    vz: number;
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
      lz: bc.lz,
      vx: 0,
      vz: 0,
    });
  });

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

    return { root, headPivot, tailPivot, legFL, legFR, legBL, legBR };
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

  // Salon Puppy "Lulu" being pampered on the Grooming Table
  const salonPuppyModel = createPuppyModel(puppySnowMat, floatingHeartCrystalMat);
  salonPuppyModel.root.position.set(0, 0.86, 0);
  groomTableGroup.add(
    groomBase,
    groomPillar,
    groomTop,
    groomRim,
    groomArm,
    groomHangingHeart,
    salonPuppyModel.root,
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
  // INTERACTION, SKATING, PUPPY PLAY & CAMERA STATE MACHINE
  // ==========================================================================
  let activeMode: Floor3ActiveCameraMode = 'none';
  let lookYawOffset = 0.0;
  let lookPitchOffset = 0.0;
  let currentGalleryIndex = 0;
  let gallerySwitchCooldown = 0.0;
  let isSkatingExplicitlyActive = false;
  let skatingJumpSpinBoost = 0.0;
  let puppyPlayCelebrationTimer = 0.0;
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
    const dx = (lx - rinkCenterX) / (rinkRadiusX - 0.15);
    const dz = (lz - rinkCenterZ) / (rinkRadiusZ - 0.15);
    return dx * dx + dz * dz <= 1.0;
  };

  const isPlayerOnIceRink = (playerPos: THREE.Vector3): boolean => {
    if (!isOnFloor3(playerPos)) return false;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    return isPointInsideIceRink(lx, lz);
  };

  const findNearestGalleryExhibitIndex = (lx: number, lz: number): { index: number; dist: number } => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < exhibitPlacements.length; i++) {
      const p = exhibitPlacements[i];
      const d = Math.hypot(lx - p.lx, lz - p.lz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { index: bestIdx, dist: bestDist };
  };

  const getNearestZoneInteraction = (
    playerPos: THREE.Vector3,
  ): 'heart_gallery' | 'ice_palace' | 'puppy_play' | 'pet_salon' | null => {
    if (!isOnFloor3(playerPos)) return null;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;

    // 1. Heart Gallery (East & South-East Wing: lx >= 4.2, lz in [-15.0, +7.8])
    if (lx >= 4.2 && lz <= 8.0) {
      const nearestEx = findNearestGalleryExhibitIndex(lx, lz);
      const distCourt = Math.hypot(lx - courtCenterX, lz - courtCenterZ);
      if (nearestEx.dist <= 4.5 || distCourt <= 4.2) {
        return 'heart_gallery';
      }
    }

    // 2. Pet Salon (North-West Suite: lx <= -9.2, lz >= 4.0)
    if (lx <= -9.2 && lz >= 4.0) {
      if (Math.hypot(lx - groomX, lz - groomZ) <= 3.6) {
        return 'pet_salon';
      }
    }

    // 3. Ice Skating Palace (West Wing: lx <= -3.5, lz <= 4.2)
    if (lx <= -3.5 && lz <= 4.2) {
      const normDist = Math.hypot(
        (lx - rinkCenterX) / (rinkRadiusX + 1.8),
        (lz - rinkCenterZ) / (rinkRadiusZ + 1.8),
      );
      if (normDist <= 1.08) {
        return 'ice_palace';
      }
    }

    // 4. Puppy Play Area (South-Central Garden: lx in [-4.0, +4.8], lz <= -4.0)
    if (lx >= -4.0 && lx <= 4.8 && lz <= -4.0) {
      if (Math.hypot(lx - playCenterX, lz - playCenterZ) <= 5.4) {
        return 'puppy_play';
      }
    }

    return null;
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

  const triggerPuppyPlayAction = (playerPos: THREE.Vector3) => {
    puppyPlayCelebrationTimer = 7.5;
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;

    // Give the interactive pastel play balls a gentle playful bounce across the lawn
    for (let b = 0; b < playBalls.length; b++) {
      const ball = playBalls[b];
      const ang = (b / playBalls.length) * Math.PI * 2 + Math.random() * 0.6;
      ball.vx = Math.cos(ang) * 2.2;
      ball.vz = Math.sin(ang) * 2.2;
    }

    // Transition all 4 puppies into excited PLAY / FOLLOW_PLAYER states
    for (let p = 0; p < puppies.length; p++) {
      const pup = puppies[p];
      pup.state = p % 2 === 0 ? 'FOLLOW_PLAYER' : 'PLAY';
      pup.stateTimer = 6.5;
      pup.barkSparkleBoost = 1.0;
      pup.targetLx = THREE.MathUtils.clamp(lx + Math.cos(p * 1.57) * 1.25, -2.8, 3.6);
      pup.targetLz = THREE.MathUtils.clamp(lz + Math.sin(p * 1.57) * 1.25, -13.8, -5.2);
    }

    playChime(659.25, 987.77);
    return true;
  };

  const triggerPetSalonGroomAction = () => {
    salonGroomCelebrationTimer = 5.5;
    playChime(783.99, 1046.5);
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
      if (activeMode === 'heart_gallery') {
        const mem = galleryMemories[currentGalleryIndex];
        return `Heart Gallery (${currentGalleryIndex + 1}/5: ${mem.title}) · [1-5 / A/D] Switch · [E] Exit`;
      }

      if (isPlayerOnIceRink(playerPos)) {
        return 'Ice Palace · [Space] Spin Jump · [E] Exit Ice';
      }

      const zone = getNearestZoneInteraction(playerPos);
      if (zone === 'heart_gallery') {
        return 'Heart Gallery · [E] View Memory';
      }
      if (zone === 'ice_palace') {
        return 'Ice Palace · [E] Enter Ice';
      }
      if (zone === 'puppy_play') {
        return 'Puppy Play Area · [E] Play';
      }
      if (zone === 'pet_salon') {
        return 'Pet Salon · [E] Groom';
      }
      return null;
    },

    interact: (playerPos: THREE.Vector3) => {
      if (activeMode !== 'none') {
        exitActiveCameraMode();
        return true;
      }

      // If currently on the Ice Rink, pressing [E] cleanly steps onto the East Promenade Gate
      if (isPlayerOnIceRink(playerPos)) {
        isSkatingExplicitlyActive = false;
        playerPos.x = originX - 5.1;
        playerPos.z = originZ - 5.4;
        playChime(587.33, 440.0);
        return true;
      }

      const zone = getNearestZoneInteraction(playerPos);
      if (!zone) return false;

      if (zone === 'heart_gallery') {
        const lx = playerPos.x - originX;
        const lz = playerPos.z - originZ;
        const nearest = findNearestGalleryExhibitIndex(lx, lz);
        activeMode = 'heart_gallery';
        camState.active = true;
        camState.mode = 'heart_gallery';
        camState.blendAlpha = 0.0;
        camState.isSitting = false;
        camState.seatWorldPos = undefined;
        camState.seatYaw = undefined;
        lookYawOffset = 0.0;
        lookPitchOffset = 0.0;
        selectGalleryFrame(nearest.index);
        return true;
      }

      if (zone === 'ice_palace') {
        isSkatingExplicitlyActive = true;
        playerPos.x = originX - 7.4;
        playerPos.z = originZ - 5.4;
        playChime(659.25, 880.0);
        return true;
      }

      if (zone === 'puppy_play') {
        return triggerPuppyPlayAction(playerPos);
      }

      if (zone === 'pet_salon') {
        return triggerPetSalonGroomAction();
      }

      return false;
    },

    handleKeyAction: (code: string) => {
      if (activeMode !== 'heart_gallery') return false;
      if (code === 'Digit1' || code === 'Numpad1') {
        selectGalleryFrame(0);
        return true;
      }
      if (code === 'Digit2' || code === 'Numpad2') {
        selectGalleryFrame(1);
        return true;
      }
      if (code === 'Digit3' || code === 'Numpad3') {
        selectGalleryFrame(2);
        return true;
      }
      if (code === 'Digit4' || code === 'Numpad4') {
        selectGalleryFrame(3);
        return true;
      }
      if (code === 'Digit5' || code === 'Numpad5') {
        selectGalleryFrame(4);
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

    isPlayerOnIceRink,

    triggerSkatingJump: () => {
      skatingJumpSpinBoost = 1.0;
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

      if (gallerySwitchCooldown > 0) {
        gallerySwitchCooldown = Math.max(0, gallerySwitchCooldown - delta);
      }
      if (skatingJumpSpinBoost > 0) {
        skatingJumpSpinBoost = Math.max(0, skatingJumpSpinBoost - delta * 1.4);
      }
      if (puppyPlayCelebrationTimer > 0) {
        puppyPlayCelebrationTimer = Math.max(0, puppyPlayCelebrationTimer - delta);
      }
      if (salonGroomCelebrationTimer > 0) {
        salonGroomCelebrationTimer = Math.max(0, salonGroomCelebrationTimer - delta);
      }

      // 0. Animate Floor 3 Central Plaza Romantic Crystal Fountain (Suspended Heart, Gentle Ripples & Smooth Water Shimmer)
      plazaFountainHeartPivot.position.y = 1.46 + Math.sin(elapsedTime * 1.6) * 0.035;
      plazaFountainHeartPivot.rotation.y = Math.sin(elapsedTime * 0.85) * 0.22;

      for (let r = 0; r < plazaFountainRippleRings.length; r++) {
        const ripPhase = (elapsedTime * 0.36 + r / plazaFountainRippleRings.length) % 1.0;
        const ripScale = 0.35 + ripPhase * 0.85;
        plazaFountainRippleRings[r].scale.setScalar(ripScale);
      }

      for (let sm = 0; sm < PLAZA_FOUNTAIN_SHIMMER_COUNT; sm++) {
        const sCycle = (elapsedTime * 0.55 + sm * (1.0 / PLAZA_FOUNTAIN_SHIMMER_COUNT)) % 1.0;
        const sAng = (sm / PLAZA_FOUNTAIN_SHIMMER_COUNT) * Math.PI * 2;
        const sRad = 0.62 + sCycle * 0.42;
        const sY = 1.05 - sCycle * sCycle * 0.66;
        _dummy.position.set(Math.cos(sAng) * sRad, sY, Math.sin(sAng) * sRad);
        _dummy.scale.setScalar(0.65 + Math.sin(sCycle * Math.PI) * 0.45);
        _dummy.updateMatrix();
        plazaFountainWaterShimmerInst.setMatrixAt(sm, _dummy.matrix);
      }
      plazaFountainWaterShimmerInst.instanceMatrix.needsUpdate = true;

      // 1. Animate Heart Gallery Floating Crystal Heart & Orbiting Light Motes
      floatingCrystalHeartPivot.position.y =
        y0 + 2.05 + Math.sin(elapsedTime * 1.8) * 0.12;
      floatingCrystalHeartPivot.rotation.y = elapsedTime * 0.65;
      floatingHeartHalo.rotation.x = Math.sin(elapsedTime * 1.2) * 0.35;
      floatingHeartHalo.rotation.z = elapsedTime * 0.45;

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

      // 2. Animate Ice Skating Palace Crystal Heart Fountain & Ascending Ice Droplets
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

      // 3. Animate Puppy Play Area Interactive Balls & 4 Puppy NPCs (REST -> WANDER -> PLAY -> FOLLOW_PLAYER)
      const playerLx = playerPos.x - originX;
      const playerLz = playerPos.z - originZ;
      const isPlayerInPuppyGarden =
        isOnFloor3(playerPos) &&
        playerLx >= -3.8 &&
        playerLx <= 4.8 &&
        playerLz >= -15.0 &&
        playerLz <= -4.2;

      // Update rolling play balls
      for (let b = 0; b < playBalls.length; b++) {
        const ball = playBalls[b];
        if (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vz) > 0.01) {
          ball.lx += ball.vx * delta;
          ball.lz += ball.vz * delta;
          ball.vx *= Math.exp(-2.4 * delta);
          ball.vz *= Math.exp(-2.4 * delta);

          if (ball.lx < -2.6 || ball.lx > 3.5) {
            ball.vx = -ball.vx * 0.75;
            ball.lx = THREE.MathUtils.clamp(ball.lx, -2.6, 3.5);
          }
          if (ball.lz < -13.4 || ball.lz > -5.4) {
            ball.vz = -ball.vz * 0.75;
            ball.lz = THREE.MathUtils.clamp(ball.lz, -13.4, -5.4);
          }
          ball.mesh.position.set(
            ball.lx,
            y0 + 0.17 + Math.abs(Math.sin(elapsedTime * 8.0 + b)) * 0.08 * Math.hypot(ball.vx, ball.vz),
            ball.lz,
          );
          ball.mesh.rotation.x += ball.vz * delta * 4.0;
          ball.mesh.rotation.z -= ball.vx * delta * 4.0;
        }
      }

      // Update 4 Puppy NPCs
      for (let p = 0; p < puppies.length; p++) {
        const pup = puppies[p];
        pup.stateTimer -= delta;
        if (pup.barkSparkleBoost > 0) {
          pup.barkSparkleBoost = Math.max(0, pup.barkSparkleBoost - delta * 0.6);
        }

        if (pup.stateTimer <= 0) {
          if (isPlayerInPuppyGarden && (pup.personality === 'energetic' || pup.personality === 'curious')) {
            pup.state = 'FOLLOW_PLAYER';
            pup.stateTimer = 4.5 + p * 0.8;
          } else if (pup.state === 'REST') {
            pup.state = 'WANDER';
            pup.stateTimer = 4.0 + p * 0.9;
            pup.targetLx = playCenterX + Math.sin(elapsedTime * 1.3 + p * 2.1) * 2.2;
            pup.targetLz = playCenterZ + Math.cos(elapsedTime * 1.1 + p * 1.7) * 2.6;
          } else if (pup.state === 'WANDER') {
            pup.state = 'PLAY';
            pup.stateTimer = 4.2 + p * 0.7;
            const targetBall = playBalls[p % playBalls.length];
            pup.targetLx = targetBall.lx;
            pup.targetLz = targetBall.lz;
          } else {
            pup.state = pup.personality === 'sleepy' ? 'REST' : 'WANDER';
            pup.stateTimer = 3.8 + p;
            pup.targetLx = pup.homeLx;
            pup.targetLz = pup.homeLz;
          }
        }

        if (pup.state === 'FOLLOW_PLAYER' && isPlayerInPuppyGarden) {
          const offsetAng = (p / puppies.length) * Math.PI * 2 + elapsedTime * 0.35;
          pup.targetLx = THREE.MathUtils.clamp(playerLx + Math.cos(offsetAng) * 1.35, -2.6, 3.4);
          pup.targetLz = THREE.MathUtils.clamp(playerLz + Math.sin(offsetAng) * 1.35, -13.6, -5.2);
        }

        _scratchDir.set(pup.targetLx - pup.lx, pup.targetLz - pup.lz);
        const distToTarget = _scratchDir.length();
        const isMoving = pup.state !== 'REST' && distToTarget > 0.14;

        if (isMoving) {
          _scratchDir.divideScalar(distToTarget);
          const stepSpeed =
            pup.speed * (pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0 ? 1.35 : 1.0);
          pup.lx = THREE.MathUtils.clamp(pup.lx + _scratchDir.x * stepSpeed * delta, -2.8, 3.5);
          pup.lz = THREE.MathUtils.clamp(pup.lz + _scratchDir.y * stepSpeed * delta, -13.8, -5.0);

          const desiredYaw = Math.atan2(_scratchDir.x, _scratchDir.y);
          let yawDiff = desiredYaw - pup.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          pup.yaw += yawDiff * Math.min(1, delta * 8.0);
        } else if (isPlayerInPuppyGarden) {
          // Turn head gently toward player when nearby
          const toPlayerYaw = Math.atan2(playerLx - pup.lx, playerLz - pup.lz);
          let hDiff = toPlayerYaw - pup.yaw;
          while (hDiff > Math.PI) hDiff -= Math.PI * 2;
          while (hDiff < -Math.PI) hDiff += Math.PI * 2;
          pup.headPivot.rotation.y = THREE.MathUtils.clamp(hDiff * 0.55, -0.55, 0.55);
        }

        const wagSpeed = pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0 ? 14.0 : 7.5;
        pup.tailPivot.rotation.z = Math.sin(elapsedTime * wagSpeed + p) * 0.45;

        if (isMoving || pup.state === 'PLAY') {
          const trot = elapsedTime * 11.0 + p * 1.5;
          const legSwing = Math.sin(trot) * 0.48;
          pup.legFL.rotation.x = legSwing;
          pup.legBR.rotation.x = legSwing;
          pup.legFR.rotation.x = -legSwing;
          pup.legBL.rotation.x = -legSwing;
          const hopY =
            pup.state === 'PLAY' || puppyPlayCelebrationTimer > 0
              ? Math.abs(Math.sin(trot * 0.85)) * 0.09
              : 0;
          pup.root.position.set(pup.lx, y0 + hopY, pup.lz);
          pup.headPivot.rotation.x = Math.sin(trot * 0.5) * 0.12;
        } else {
          // Resting / sitting pose
          pup.legFL.rotation.x = 0;
          pup.legFR.rotation.x = 0;
          pup.legBL.rotation.x = -0.35;
          pup.legBR.rotation.x = -0.35;
          pup.root.position.set(pup.lx, y0 - 0.03, pup.lz);
          pup.headPivot.rotation.x = Math.sin(elapsedTime * 1.8 + p) * 0.06;
        }
        pup.root.rotation.y = pup.yaw;
      }

      // 4. Animate Pet Salon Puppy "Lulu" & Floating Iridescent Bath Bubbles
      const salonSpinRate = salonGroomCelebrationTimer > 0 ? 2.8 : 0.45;
      salonPuppyModel.root.rotation.y = Math.sin(elapsedTime * salonSpinRate) * 0.65;
      salonPuppyModel.tailPivot.rotation.z = Math.sin(elapsedTime * 10.5) * 0.42;
      salonPuppyModel.headPivot.rotation.z = Math.sin(elapsedTime * 2.4) * 0.12;

      const bubbleBoost = salonGroomCelebrationTimer > 0 ? 1.6 : 1.0;
      for (let b = 0; b < SALON_BUBBLE_COUNT; b++) {
        const bCycle = (elapsedTime * 0.38 * bubbleBoost + b * 0.19) % 1.0;
        const isGroomSparkle = salonGroomCelebrationTimer > 0 && b % 2 === 0;
        const baseX = isGroomSparkle ? groomX : -13.95;
        const baseZ = isGroomSparkle ? groomZ : 12.8;
        const baseY = isGroomSparkle ? y0 + 0.95 : y0 + 0.58;
        const bAng = b * 1.3 + elapsedTime * 0.8;
        const bRad = (isGroomSparkle ? 0.55 : 0.46) * (0.4 + bCycle * 0.7);
        _dummy.position.set(
          baseX + Math.cos(bAng) * bRad,
          baseY + bCycle * 1.25,
          baseZ + Math.sin(bAng) * bRad,
        );
        _dummy.scale.setScalar((1.0 - bCycle * 0.65) * (isGroomSparkle ? 1.15 : 0.9));
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
        const normalX = Math.sin(ex.rotY);
        const normalZ = Math.cos(ex.rotY);
        const rightX = Math.cos(ex.rotY);
        const rightZ = -Math.sin(ex.rotY);
        const camWx = originX + ex.lx + normalX * ex.camDist;
        const camWz = originZ + ex.lz + normalZ * ex.camDist;
        const lookWx = originX + ex.lx;
        const lookWz = originZ + ex.lz;
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
