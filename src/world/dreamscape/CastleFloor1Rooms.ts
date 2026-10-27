import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export type Floor1ActiveCameraMode =
  | 'none'
  | 'couture_inspect'
  | 'dining_sit'
  | 'dining_centerpiece'
  | 'sofa_sit'
  | 'piano_play'
  | 'guitar_play';

export type RelaxLoungeState =
  | 'RELAX_LOUNGE_IDLE'
  | 'SOFA_SEATED'
  | 'RECORD_READY'
  | 'RECORD_PLAYING'
  | 'RECORD_PAUSED';

export const RECORD_PLAYER_SONG = '/assets/audio/records/barbie-song.mp3';

export interface Floor1CameraState {
  active: boolean;
  mode: Floor1ActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  isSitting: boolean;
  isFirstPersonSeated?: boolean;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
}

export interface CastleFloor1RoomsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyInspectYawDelta: (deltaYaw: number) => void;
  applySeatedLookDelta: (deltaYaw: number, deltaPitch: number) => void;
  getRelaxLoungeState: () => RelaxLoungeState;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor1CameraState;
  getMusicPulseIntensity: () => number;
  update: (delta: number, elapsedTime: number, playerPos: THREE.Vector3, inputKeys?: Set<string>) => void;
}

// Pre-allocated scratch objects at module scope (Zero Per-Frame Allocations)
const _scratchPlayerLocal = new THREE.Vector3();
const _scratchLightTargetPos = new THREE.Vector3();
const _scratchLightTargetColor = new THREE.Color();
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();
const _scratchSeatWorldPos = new THREE.Vector3();
const _scratchDummy = new THREE.Object3D();

function smoothStep01(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

function lockStaticHierarchy(root: THREE.Object3D, dynamicSet: Set<THREE.Object3D>) {
  root.traverse((obj) => {
    if (dynamicSet.has(obj)) return;
    let p: THREE.Object3D | null = obj.parent;
    while (p) {
      if (dynamicSet.has(p)) return;
      p = p.parent;
    }
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });
}

function createPlaceCardTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 484, 228);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, 460, 204);

    ctx.fillStyle = '#be123c';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Yeshwanth & Harsha', 256, 108);

    ctx.fillStyle = '#9d174d';
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('Royal Valentine Table • Forever Ours ♡', 256, 162);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWallPortraitTexture(
  tracker: ResourceTracker,
  title: string,
  subtitle: string,
  accentHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.5, accentHex);
    grad.addColorStop(1, '#fce7f3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 320);

    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 232, 296);

    // Stylized silhouette crown / heart emblem
    ctx.fillStyle = 'rgba(216, 180, 103, 0.35)';
    ctx.beginPath();
    ctx.arc(128, 125, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#831843';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 236);
    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillText(subtitle, 128, 264);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Romantic Pastel-Neon Wall Art CanvasTexture (1024x512, created once):
 * "Yeshwanth ❤️ Harsha" with magenta/rose halo, champagne-gold brush lettering,
 * hot pink accents, tiny royal crown, and heart splatters.
 */
function createRomanticNeonWallArtTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(1, 1);

    // 1. Soft Velvet Rose & Magenta-Halo Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 512);
    bgGrad.addColorStop(0.0, '#2a091f');
    bgGrad.addColorStop(0.5, '#4a0e32');
    bgGrad.addColorStop(1.0, '#26081c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 512);

    const halo = ctx.createRadialGradient(512, 264, 30, 512, 264, 460);
    halo.addColorStop(0.0, 'rgba(244, 63, 94, 0.58)');
    halo.addColorStop(0.42, 'rgba(236, 72, 153, 0.34)');
    halo.addColorStop(0.75, 'rgba(190, 24, 93, 0.16)');
    halo.addColorStop(1.0, 'rgba(190, 24, 93, 0.0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 1024, 512);

    // 2. Champagne-Gold & Hot-Pink Neon Double Filigree Border
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 984, 472);

    ctx.save();
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#f9a8d4';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, 952, 440);
    ctx.restore();

    // 3. Romantic Heart Splatters & Pastel Neon Sparkles
    const heartSplatters = [
      { x: 118, y: 120, s: 24, c: '#ec4899' },
      { x: 906, y: 118, s: 26, c: '#f43f5e' },
      { x: 156, y: 382, s: 22, c: '#f9a8d4' },
      { x: 874, y: 388, s: 24, c: '#ec4899' },
      { x: 245, y: 98, s: 18, c: '#d8b467' },
      { x: 780, y: 102, s: 18, c: '#d8b467' },
      { x: 310, y: 416, s: 19, c: '#f472b6' },
      { x: 720, y: 414, s: 19, c: '#f472b6' },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < heartSplatters.length; i++) {
      const hs = heartSplatters[i];
      ctx.shadowColor = hs.c;
      ctx.shadowBlur = 14;
      ctx.fillStyle = hs.c;
      ctx.font = `bold ${hs.s}px Georgia, serif`;
      ctx.fillText(i % 2 === 0 ? '♥' : '♡', hs.x, hs.y);
    }
    ctx.restore();

    // 4. Tiny Royal Crown (♕) & Hot-Pink Neon Flourish at Top Center
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#d8b467';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('♕', 512, 118);

    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(280, 156);
    ctx.quadraticCurveTo(512, 136, 744, 156);
    ctx.stroke();
    ctx.restore();

    // 5. Main Pastel-Neon & Champagne-Gold Brush Lettering: "Yeshwanth ❤️ Harsha"
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic bold 78px Georgia, serif';

    // Outer Magenta/Rose Neon Halo Pass
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 32;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#f43f5e';
    ctx.strokeText('Yeshwanth ❤️ Harsha', 512, 268);

    // Champagne-Gold Brush Gradient Fill with Hot-Pink Accents
    const brushGrad = ctx.createLinearGradient(140, 210, 884, 325);
    brushGrad.addColorStop(0.0, '#fde68a');
    brushGrad.addColorStop(0.28, '#d8b467');
    brushGrad.addColorStop(0.5, '#f9a8d4');
    brushGrad.addColorStop(0.72, '#d8b467');
    brushGrad.addColorStop(1.0, '#fef08a');
    ctx.fillStyle = brushGrad;
    ctx.fillText('Yeshwanth ❤️ Harsha', 512, 268);
    ctx.restore();

    // 6. Subtitle Scroll
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#be185d';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f9a8d4';
    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillText('✦ Two Hearts Became One Light • Forever Ours ✦', 512, 392);
    ctx.restore();
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Hand-Painted Barbie Dreamhouse Mural CanvasTexture:
 * Depicts classic, elegant fashion-doll couture illustrations in vintage pastel frames
 * with gold-leaf filigree borders, scalloped arches, and romantic heart/star flourishes.
 */
function createBarbieFashionMuralTexture(
  tracker: ResourceTracker,
  title: string,
  eraSubtitle: string,
  gownPrimaryHex: string,
  gownSecondaryHex: string,
  poseVariant: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // 1. Soft Vintage Pastel Backdrop with Radial Sunburst Glow
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 640);
    bgGrad.addColorStop(0, '#fff1f2');
    bgGrad.addColorStop(0.45, '#fce7f3');
    bgGrad.addColorStop(1, '#f5d0fe');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 640);

    const halo = ctx.createRadialGradient(256, 265, 25, 256, 265, 220);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    halo.addColorStop(0.55, 'rgba(251, 207, 232, 0.45)');
    halo.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 512, 640);

    // 2. Ornate Gold-Leaf Filigree Double Frame & Scalloped Arch Header
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, 476, 604);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, 448, 576);
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 432, 560);

    // Scalloped Seashell Arch Rays at Top of Mural
    ctx.save();
    ctx.translate(256, 155);
    ctx.strokeStyle = 'rgba(216, 180, 103, 0.55)';
    ctx.lineWidth = 2.5;
    for (let i = -6; i <= 6; i++) {
      const ang = (i / 6) * (Math.PI * 0.44) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * 165, Math.sin(ang) * 115);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Hand-Painted Classic Fashion-Doll Couture Silhouette & Flowing Ballgown
    ctx.save();
    // Flowing couture skirt layers
    const skirtGrad = ctx.createLinearGradient(160, 270, 350, 485);
    skirtGrad.addColorStop(0, gownPrimaryHex);
    skirtGrad.addColorStop(0.6, gownSecondaryHex);
    skirtGrad.addColorStop(1, '#831843');
    ctx.fillStyle = skirtGrad;
    ctx.beginPath();
    ctx.moveTo(256, 268);
    const flare = poseVariant % 2 === 0 ? 118 : 96;
    ctx.bezierCurveTo(215, 315, 256 - flare, 405, 256 - flare - 14, 475);
    ctx.quadraticCurveTo(256, 502, 256 + flare + 14, 475);
    ctx.bezierCurveTo(256 + flare, 405, 297, 315, 256, 268);
    ctx.closePath();
    ctx.fill();

    // Gold leaf embroidery trim on skirt
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tulle Peplum / Overskirt Drape
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(256, 268);
    ctx.quadraticCurveTo(200, 330, 178, 415);
    ctx.quadraticCurveTo(256, 385, 334, 415);
    ctx.quadraticCurveTo(312, 330, 256, 268);
    ctx.fill();

    // Sculpted Couture Bodice & Graceful Neck/Head Silhouette
    ctx.fillStyle = gownPrimaryHex;
    ctx.beginPath();
    ctx.moveTo(234, 206);
    ctx.lineTo(278, 206);
    ctx.lineTo(266, 272);
    ctx.lineTo(246, 272);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Porcelain Silhouette Neck, Head & Classic Updo Ponytail
    ctx.fillStyle = '#fce7f3';
    ctx.fillRect(250, 180, 12, 28);
    ctx.beginPath();
    ctx.arc(256, 164, 20, 0, Math.PI * 2);
    ctx.fill();

    // Classic High-Fashion Swept Coiffure & Golden Tiara Crown
    ctx.fillStyle = '#be185d';
    ctx.beginPath();
    ctx.arc(256, 158, 21, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(288, 142, 296, 174);
    ctx.quadraticCurveTo(276, 168, 268, 158);
    ctx.fill();

    // Golden Crown Tiara
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(241, 144);
    ctx.lineTo(246, 128);
    ctx.lineTo(256, 138);
    ctx.lineTo(266, 124);
    ctx.lineTo(271, 144);
    ctx.closePath();
    ctx.fill();

    // Sparkling Stars & Hearts around the Couture Illustration
    ctx.fillStyle = '#f43f5e';
    ctx.font = '26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('♥', 118, 210);
    ctx.fillText('♥', 394, 210);
    ctx.fillStyle = '#d8b467';
    ctx.fillText('✦', 142, 135);
    ctx.fillText('✦', 370, 135);
    ctx.fillText('✦', 112, 340);
    ctx.fillText('✦', 400, 340);
    ctx.restore();

    // 4. Lower Cartouche Banner with Title & Era Subtitle
    ctx.fillStyle = 'rgba(255, 250, 252, 0.94)';
    ctx.fillRect(62, 506, 388, 76);
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 3;
    ctx.strokeRect(62, 506, 388, 76);

    ctx.fillStyle = '#9d174d';
    ctx.font = 'bold 23px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 538);

    ctx.fillStyle = '#be123c';
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillText(eraSubtitle, 256, 566);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCastleFloor1Rooms(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor1RoomsBundle {
  const floor1RoomsGroup = new THREE.Group();
  floor1RoomsGroup.name = 'CastleFloor1Rooms_Sprint2';
  const colliders: CircleCollider[] = [];
  const dynamicObjects = new Set<THREE.Object3D>();

  // ==========================================================================
  // SHARED BARBIE-COUTURE MATERIALS
  // ==========================================================================
  const barbieRoseLacquer = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f43f5e'),
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
    }),
  );

  const blushQuiltedVelvet = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      roughness: 0.58,
      metalness: 0.04,
    }),
  );

  const champagneGoldFiligreeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b467'),
      roughness: 0.24,
      metalness: 0.86,
    }),
  );

  const lavenderSilk = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e9d5ff'),
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.35,
    }),
  );

  const mintPastelEnamel = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#a7f3d0'),
      roughness: 0.28,
      clearcoat: 0.45,
    }),
  );

  const vinylBlackMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e1b24'),
      roughness: 0.22,
      metalness: 0.35,
    }),
  );

  const fridgeInteriorGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      emissive: new THREE.Color('#fde68a'),
      emissiveIntensity: 0.0,
      roughness: 0.3,
    }),
  );

  const ovenBakingGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fed7aa'),
      emissive: new THREE.Color('#f97316'),
      emissiveIntensity: 0.0,
      roughness: 0.3,
    }),
  );

  const fireplaceEmberMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fb923c'),
      emissive: new THREE.Color('#ea580c'),
      emissiveIntensity: 1.35,
      roughness: 0.4,
    }),
  );

  const smoothieBerryMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ec4899'),
      emissive: new THREE.Color('#db2777'),
      emissiveIntensity: 0.25,
      roughness: 0.25,
    }),
  );

  const steamParticleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );

  const goldNoteParticleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fde047'),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  // ==========================================================================
  // SINGLE SHARED FLOOR 1 ACCENT POINTLIGHT (<= 12 Global PointLights Budget)
  // ==========================================================================
  const sharedRoomAccentLight = new THREE.PointLight('#fff1f2', 1.5, 13.5, 1.5);
  sharedRoomAccentLight.position.set(-10.5, 3.6, 0.0);
  floor1RoomsGroup.add(sharedRoomAccentLight);
  dynamicObjects.add(sharedRoomAccentLight);

  // ==========================================================================
  // BARBIE DREAMHOUSE WALLS, CARVINGS & HAND-PAINTED MURALS (0.88m THICK COLLIDERS)
  // ==========================================================================
  // Strict Staircase Clearance Rule:
  // Twin Sweeping Staircases occupy lx: [-8.6, -5.2] (West) and lx: [+5.2, +8.6] (East), lz: [-6.0, +6.0].
  // All West/East Wing partition walls & pilasters are pushed outward to |lx| >= 9.2 and recessed to lz = ±7.6
  // so |lx| < 9.0, |lz| < 7.5 is 100% open and unobstructed.
  const partitionGroup = new THREE.Group();
  const partitionMeshes: THREE.Mesh[] = [];
  const dividerCorniceGeo = tracker.trackGeo(new THREE.BoxGeometry(6.2, 0.24, 0.98));
  dividerCorniceGeo.translate(0, 4.92, 0);
  const dividerBaseboardGeo = tracker.trackGeo(new THREE.BoxGeometry(1.88, 0.24, 0.94));
  dividerBaseboardGeo.translate(0, 0.4, 0);
  const pilasterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 4.72, 12));
  pilasterGeo.translate(0, 2.64, 0);

  // Partition walls at lz = -7.6 and lz = +7.6 on both West (lx: -15.4..-9.2) and East (lx: +9.2..+15.4) wings
  // Styled in Glossy Barbie Pink Lacquer (#f43f5e), Blush Velvet Quilted Panels (#fbcfe8) & Champagne Gold Filigree (#d8b467)
  const sideWingWallSegGeo = tracker.trackGeo(new THREE.BoxGeometry(1.85, 4.72, 0.88));
  sideWingWallSegGeo.translate(0, 2.64, 0);
  const quiltedWainscotGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 1.85, 0.92));
  quiltedWainscotGeo.translate(0, 1.48, 0);
  const upperVelvetInlayGeo = tracker.trackGeo(new THREE.BoxGeometry(1.55, 1.55, 0.91));
  upperVelvetInlayGeo.translate(0, 3.55, 0);
  const goldFrameStripGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 0.08, 0.94));
  const sideWingHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(2.5, 1.15, 0.9));
  sideWingHeaderGeo.translate(0, 4.42, 0);

  // Barbie Carvings Geometries: Scalloped Seashell Arches, Embossed Heart Motifs, Crown Reliefs & Star-Studded Friezes
  const seashellArchGeo = tracker.trackGeo(new THREE.TorusGeometry(1.18, 0.08, 10, 24, Math.PI));
  const seashellRayGeo = tracker.trackGeo(new THREE.ConeGeometry(0.06, 0.48, 5));
  const crownReliefGeo = tracker.trackGeo(new THREE.ConeGeometry(0.22, 0.34, 5));
  const starStudGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.095, 0));
  const embossedHeartLobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
  embossedHeartLobeGeo.scale(1.0, 1.0, 0.45);
  const embossedHeartTipGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.24, 10));
  embossedHeartTipGeo.rotateX(Math.PI);
  embossedHeartTipGeo.scale(1.0, 1.0, 0.45);

  const createEmbossedHeartCarving = (mat: THREE.Material): THREE.Group => {
    const hg = new THREE.Group();
    const lLobe = new THREE.Mesh(embossedHeartLobeGeo, mat);
    lLobe.position.set(-0.075, 0.06, 0);
    const rLobe = new THREE.Mesh(embossedHeartLobeGeo, mat);
    rLobe.position.set(0.075, 0.06, 0);
    const tip = new THREE.Mesh(embossedHeartTipGeo, mat);
    tip.position.set(0, -0.08, 0);
    hg.add(lLobe, rLobe, tip);
    return hg;
  };

  [-1, 1].forEach((side) => {
    [-7.6, 7.6].forEach((pz) => {
      // Clone materials per partition so Dynamic Raycast Camera Obstruction Resolver can fade individual walls cleanly
      const partWallMat = tracker.trackMat(barbieRoseLacquer.clone());
      const partHeaderMat = tracker.trackMat(barbieRoseLacquer.clone());

      const wOuter = new THREE.Mesh(sideWingWallSegGeo, partWallMat);
      wOuter.position.set(side * 14.45, 0, pz);
      const wInner = new THREE.Mesh(sideWingWallSegGeo, partWallMat);
      wInner.position.set(side * 10.12, 0, pz);
      const wHeader = new THREE.Mesh(sideWingHeaderGeo, partHeaderMat);
      wHeader.position.set(side * 12.28, 0, pz);

      // Blush Velvet Quilted Panels & Champagne Gold Filigree Trim on both wall segments
      [14.45, 10.12].forEach((segX) => {
        const wainscot = new THREE.Mesh(quiltedWainscotGeo, blushQuiltedVelvet);
        wainscot.position.set(side * segX, 0, pz);
        const upperVelvet = new THREE.Mesh(upperVelvetInlayGeo, blushQuiltedVelvet);
        upperVelvet.position.set(side * segX, 0, pz);
        const railMid = new THREE.Mesh(goldFrameStripGeo, champagneGoldFiligreeMat);
        railMid.position.set(side * segX, 2.52, pz);
        const railTop = new THREE.Mesh(goldFrameStripGeo, champagneGoldFiligreeMat);
        railTop.position.set(side * segX, 4.38, pz);
        const baseboard = new THREE.Mesh(dividerBaseboardGeo, champagneGoldFiligreeMat);
        baseboard.position.set(side * segX, 0, pz);
        partitionGroup.add(wainscot, upperVelvet, railMid, railTop, baseboard);

        // Embossed Heart Motif Carvings on both faces of the upper velvet panels
        [-0.48, 0.48].forEach((zOff) => {
          const heartCarving = createEmbossedHeartCarving(champagneGoldFiligreeMat);
          heartCarving.position.set(side * segX, 3.55, pz + zOff);
          partitionGroup.add(heartCarving);
        });
      });

      const cornice = new THREE.Mesh(dividerCorniceGeo, champagneGoldFiligreeMat);
      cornice.position.set(side * 12.28, 0, pz);

      // Scalloped Seashell Arch & Crown Relief over each doorway header (both front & back faces)
      [-0.47, 0.47].forEach((zFace) => {
        const shellArch = new THREE.Mesh(seashellArchGeo, champagneGoldFiligreeMat);
        shellArch.position.set(side * 12.28, 3.82, pz + zFace);
        const crownKeystone = new THREE.Mesh(crownReliefGeo, champagneGoldFiligreeMat);
        crownKeystone.position.set(side * 12.28, 4.62, pz + zFace);
        const headerHeart = createEmbossedHeartCarving(blushQuiltedVelvet);
        headerHeart.position.set(side * 12.28, 4.32, pz + zFace * 1.04);
        partitionGroup.add(shellArch, crownKeystone, headerHeart);

        // Scalloped seashell fan ribs radiating above the doorway arch
        for (let r = -3; r <= 3; r++) {
          const ray = new THREE.Mesh(seashellRayGeo, champagneGoldFiligreeMat);
          const ang = (r / 3) * 0.85;
          ray.position.set(
            side * 12.28 + Math.sin(ang) * 0.62,
            4.12 + Math.cos(ang) * 0.26,
            pz + zFace,
          );
          ray.rotation.z = -ang;
          partitionGroup.add(ray);
        }
      });

      // Star-Studded Frieze along the top cornice
      for (let st = -2; st <= 2; st++) {
        [-0.51, 0.51].forEach((zFace) => {
          const star = new THREE.Mesh(starStudGeo, champagneGoldFiligreeMat);
          star.position.set(side * 12.28 + st * 1.15, 4.92, pz + zFace);
          partitionGroup.add(star);
        });
      }

      const pil1 = new THREE.Mesh(pilasterGeo, champagneGoldFiligreeMat);
      pil1.position.set(side * 9.25, 0, pz);
      const pil2 = new THREE.Mesh(pilasterGeo, champagneGoldFiligreeMat);
      pil2.position.set(side * 11.05, 0, pz);
      const pil3 = new THREE.Mesh(pilasterGeo, champagneGoldFiligreeMat);
      pil3.position.set(side * 13.52, 0, pz);

      partitionGroup.add(wOuter, wInner, wHeader, cornice, pil1, pil2, pil3);
      partitionMeshes.push(wOuter, wInner, wHeader);

      // Partition CircleColliders strictly outside |lx| >= 9.4 at z = ±7.6 (leaving doorway at |lx| = 12.28 and staircase corridor |lx| < 9.0 100% open)
      [14.8, 13.8, 10.5, 9.5].forEach((absX) => {
        colliders.push({
          x: originX + side * absX,
          z: originZ + pz,
          radius: 0.65,
          y: baseY + 0.25,
          height: 4.5,
        });
      });
    });
  });

  // ==========================================================================
  // HAND-PAINTED BARBIE FASHION MURALS ON GRAND ENTRANCE HALL & HALLWAY WALLS
  // ==========================================================================
  const muralConfigs = [
    {
      title: 'La Belle Parisienne',
      era: '1959 Couture Premiere • Harsha Collection',
      primary: '#f43f5e',
      secondary: '#fbcfe8',
      pose: 0,
      lx: -10.12,
      lz: -7.08,
      rotY: 0, // Faces South into Living Lounge
    },
    {
      title: 'Starlight Royal Gala',
      era: 'Enchanted Dreamhouse Ballgown • Couture II',
      primary: '#ec4899',
      secondary: '#e9d5ff',
      pose: 1,
      lx: 10.12,
      lz: -7.08,
      rotY: 0, // Faces South into Royal Dining
    },
    {
      title: 'Symphony of Roses',
      era: 'Rose-Quartz Promenade • Couture III',
      primary: '#db2777',
      secondary: '#fde68a',
      pose: 2,
      lx: -10.12,
      lz: 7.08,
      rotY: Math.PI, // Faces North into Living Lounge
    },
    {
      title: 'Crystal Conservatory',
      era: 'Midnight Blossom Atelier • Couture IV',
      primary: '#f43f5e',
      secondary: '#a7f3d0',
      pose: 3,
      lx: 10.12,
      lz: 7.08,
      rotY: Math.PI, // Faces North into Royal Dining
    },
    {
      title: 'Golden Crown Serenade',
      era: 'Grand Entrance Foyer • Royal Edition',
      primary: '#e11d48',
      secondary: '#fef08a',
      pose: 0,
      lx: -6.2,
      lz: -15.32,
      rotY: 0, // Grand Entrance Hall Front West Foyer Wall
    },
    {
      title: 'Empress of Heart Island',
      era: 'Grand Entrance Foyer • Forever Harsha',
      primary: '#be185d',
      secondary: '#fbcfe8',
      pose: 1,
      lx: 6.2,
      lz: -15.32,
      rotY: 0, // Grand Entrance Hall Front East Foyer Wall
    },
  ];

  const muralPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.95, 2.45));
  const muralGoldFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(2.14, 2.64, 0.06));
  const muralVelvetMatBackGeo = tracker.trackGeo(new THREE.BoxGeometry(2.04, 2.54, 0.07));

  muralConfigs.forEach((mc) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(mc.lx, 2.52, mc.lz);
    mGroup.rotation.y = mc.rotY;

    const frameMesh = new THREE.Mesh(muralGoldFrameGeo, champagneGoldFiligreeMat);
    frameMesh.position.z = -0.02;
    const velvetBack = new THREE.Mesh(muralVelvetMatBackGeo, barbieRoseLacquer);
    velvetBack.position.z = -0.01;

    const mTex = createBarbieFashionMuralTexture(
      tracker,
      mc.title,
      mc.era,
      mc.primary,
      mc.secondary,
      mc.pose,
    );
    const mMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: mTex,
        roughness: 0.32,
        metalness: 0.08,
      }),
    );
    const canvasMesh = new THREE.Mesh(muralPlaneGeo, mMat);
    canvasMesh.position.z = 0.032;

    // Crown & Heart crest atop each vintage mural frame
    const crestCrown = new THREE.Mesh(crownReliefGeo, champagneGoldFiligreeMat);
    crestCrown.position.set(0, 1.44, 0.02);
    const crestHeart = createEmbossedHeartCarving(barbieRoseLacquer);
    crestHeart.position.set(0, 1.32, 0.05);
    crestHeart.scale.setScalar(0.85);

    mGroup.add(frameMesh, velvetBack, canvasMesh, crestCrown, crestHeart);
    partitionGroup.add(mGroup);
  });

  // Rear Center Garden Portal Archway (lx: -2.8..+2.8, lz: +16.0)
  const rearPortalPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 4.6, 14));
  rearPortalPillarGeo.translate(0, 2.55, 0);
  const rearPortalArchGeo = tracker.trackGeo(new THREE.TorusGeometry(2.4, 0.18, 10, 28, Math.PI));
  const rearPortalGlassDoorGeo = tracker.trackGeo(new THREE.BoxGeometry(1.15, 4.1, 0.1));
  rearPortalGlassDoorGeo.translate(0, 2.3, 0);

  [-2.4, 2.4].forEach((px, idx) => {
    const pil = new THREE.Mesh(rearPortalPillarGeo, mats.champagneGold);
    pil.position.set(px, 0, 15.8);
    // Open French glass doors angled gracefully outward toward the Rose Garden
    const glassDoor = new THREE.Mesh(rearPortalGlassDoorGeo, mats.crystalGlass);
    glassDoor.position.set(px * 0.85, 0, 16.15);
    glassDoor.rotation.y = idx === 0 ? 0.65 : -0.65;
    const goldFrame = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(1.22, 4.18, 0.12)).translate(0, 2.3, 0),
      mats.champagneGold,
    );
    goldFrame.position.copy(glassDoor.position);
    goldFrame.rotation.copy(glassDoor.rotation);
    partitionGroup.add(pil, glassDoor, goldFrame);
  });
  const rearArch = new THREE.Mesh(rearPortalArchGeo, mats.champagneGold);
  rearArch.position.set(0, 4.6, 15.8);
  partitionGroup.add(rearArch);

  floor1RoomsGroup.add(partitionGroup);

  // ==========================================================================
  // ROOM A: FASHION GALLERY (West-Front: lx -15..-6, lz -15..-5)
  // ==========================================================================
  const fashionGroup = new THREE.Group();
  const pedestalPivots: THREE.Group[] = [];
  const pedestalRingMats: THREE.MeshStandardMaterial[] = [];

  const pedBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.05, 1.18, 0.34, 24));
  pedBaseGeo.translate(0, 0.42, 0);
  const pedGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.08, 0.045, 8, 28));
  pedGoldRimGeo.rotateX(Math.PI / 2);
  pedGoldRimGeo.translate(0, 0.58, 0);

  const mannequinTorsoGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.16, 0.11, 0.56, 14));
  const mannequinNeckGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.048, 0.058, 0.22, 10));
  const mannequinHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.12, 12, 12));
  mannequinHeadGeo.scale(0.88, 1.12, 0.9);
  const mannequinStandRodGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8));
  mannequinStandRodGeo.translate(0, 0.575, 0);

  const ballgownSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.68, 1.28, 20));
  const ballgownTierGeo = tracker.trackGeo(new THREE.TorusGeometry(0.46, 0.06, 8, 20));
  ballgownTierGeo.rotateX(Math.PI / 2);
  const cocktailSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.48, 0.95, 18));
  const cocktailPeplumGeo = tracker.trackGeo(new THREE.SphereGeometry(0.28, 14, 10));
  cocktailPeplumGeo.scale(1.15, 0.55, 0.85);
  const eveningColumnGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.38, 1.32, 16));
  const eveningCapeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.58, 1.42, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
  );
  const crownTiaraGeo = tracker.trackGeo(new THREE.ConeGeometry(0.1, 0.18, 5));

  const pedestalConfigs = [
    { lx: -13.0, lz: -12.8, gownType: 0, baseYaw: 0.45 },
    { lx: -13.0, lz: -9.8, gownType: 1, baseYaw: 0.85 },
    { lx: -10.0, lz: -12.8, gownType: 2, baseYaw: -0.35 },
  ];

  pedestalConfigs.forEach((cfg) => {
    const pedBase = new THREE.Mesh(pedBaseGeo, mats.blushRoseMarble);
    pedBase.position.set(cfg.lx, 0, cfg.lz);
    pedBase.receiveShadow = true;

    const ringMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fde047'),
        emissive: new THREE.Color('#f59e0b'),
        emissiveIntensity: 0.95,
        roughness: 0.2,
      }),
    );
    pedestalRingMats.push(ringMat);
    const pedRim = new THREE.Mesh(pedGoldRimGeo, ringMat);
    pedRim.position.set(cfg.lx, 0, cfg.lz);
    fashionGroup.add(pedBase, pedRim);

    const pivot = new THREE.Group();
    pivot.position.set(cfg.lx, 0.58, cfg.lz);
    pivot.rotation.y = cfg.baseYaw;
    dynamicObjects.add(pivot);

    const rod = new THREE.Mesh(mannequinStandRodGeo, mats.champagneGold);
    const torso = new THREE.Mesh(
      mannequinTorsoGeo,
      cfg.gownType === 0 ? mats.champagneGold : cfg.gownType === 1 ? barbieRoseLacquer : lavenderSilk,
    );
    torso.position.set(0, 1.35, 0);
    const neck = new THREE.Mesh(mannequinNeckGeo, mats.pearlWhite);
    neck.position.set(0, 1.7, 0);
    const head = new THREE.Mesh(mannequinHeadGeo, mats.pearlWhite);
    head.position.set(0, 1.88, 0);
    const tiara = new THREE.Mesh(crownTiaraGeo, mats.champagneGold);
    tiara.position.set(0, 2.04, 0);

    pivot.add(rod, torso, neck, head, tiara);

    if (cfg.gownType === 0) {
      // 1: Starlight Ballgown with flared tulle & gold bodice
      const skirt = new THREE.Mesh(ballgownSkirtGeo, lavenderSilk);
      skirt.position.set(0, 0.66, 0);
      skirt.castShadow = true;
      const tier1 = new THREE.Mesh(ballgownTierGeo, mats.champagneGold);
      tier1.position.set(0, 0.52, 0);
      const tier2 = new THREE.Mesh(ballgownTierGeo, blushQuiltedVelvet);
      tier2.position.set(0, 0.85, 0);
      tier2.scale.setScalar(0.74);
      pivot.add(skirt, tier1, tier2);
    } else if (cfg.gownType === 1) {
      // 2: Parisian Rose Cocktail Dress with pleated peplum
      const skirt = new THREE.Mesh(cocktailSkirtGeo, barbieRoseLacquer);
      skirt.position.set(0, 0.72, 0);
      skirt.castShadow = true;
      const peplum = new THREE.Mesh(cocktailPeplumGeo, blushQuiltedVelvet);
      peplum.position.set(0, 1.08, 0);
      const sash = new THREE.Mesh(ballgownTierGeo, mats.champagneGold);
      sash.position.set(0, 1.14, 0);
      sash.scale.setScalar(0.36);
      pivot.add(skirt, peplum, sash);
    } else {
      // 3: Lavender Evening Cape Gown
      const colSkirt = new THREE.Mesh(eveningColumnGeo, blushQuiltedVelvet);
      colSkirt.position.set(0, 0.66, 0);
      colSkirt.castShadow = true;
      const cape = new THREE.Mesh(eveningCapeGeo, mats.crystalGlass);
      cape.position.set(0, 0.88, -0.08);
      const collar = new THREE.Mesh(ballgownTierGeo, mats.champagneGold);
      collar.position.set(0, 1.58, 0);
      collar.scale.setScalar(0.38);
      pivot.add(colSkirt, cape, collar);
    }

    pedestalPivots.push(pivot);
    fashionGroup.add(pivot);
    colliders.push({ x: originX + cfg.lx, z: originZ + cfg.lz, radius: 1.08 });
  });

  // Glass-and-Gold Vitrine Cases (Miniature High-Heeled Shoes, Quilted Handbags & Pearl Necklaces)
  const vitrineBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 0.92, 0.85));
  vitrineBaseGeo.translate(0, 0.71, 0);
  const vitrineGlassGeo = tracker.trackGeo(new THREE.BoxGeometry(2.32, 1.15, 0.78));
  vitrineGlassGeo.translate(0, 1.74, 0);
  const vitrineTopRimGeo = tracker.trackGeo(new THREE.BoxGeometry(2.44, 0.08, 0.88));
  vitrineTopRimGeo.translate(0, 2.34, 0);
  const vitrineBagGeo = tracker.trackGeo(new THREE.BoxGeometry(0.34, 0.26, 0.14));
  const vitrineBagHandleGeo = tracker.trackGeo(new THREE.TorusGeometry(0.09, 0.016, 8, 14, Math.PI));
  const shoeSoleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.04, 0.28));
  const shoeHeelGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.015, 0.01, 0.14, 6));
  const necklaceBustGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.34, 12));
  const necklacePearlRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.12, 0.022, 8, 16));
  necklacePearlRingGeo.rotateX(Math.PI / 2.6);

  [
    { lx: -9.8, lz: -14.4, rotY: 0 },
    { lx: -14.4, lz: -11.2, rotY: Math.PI / 2 },
  ].forEach((vc) => {
    const vGroup = new THREE.Group();
    vGroup.position.set(vc.lx, 0, vc.lz);
    vGroup.rotation.y = vc.rotY;

    const base = new THREE.Mesh(vitrineBaseGeo, mats.pearlWhite);
    const glass = new THREE.Mesh(vitrineGlassGeo, mats.crystalGlass);
    const topRim = new THREE.Mesh(vitrineTopRimGeo, mats.champagneGold);
    vGroup.add(base, glass, topRim);

    // Quilted Handbag with Gold Chain Strap
    const bag = new THREE.Mesh(vitrineBagGeo, barbieRoseLacquer);
    bag.position.set(-0.65, 1.32, 0);
    const bagHandle = new THREE.Mesh(vitrineBagHandleGeo, mats.champagneGold);
    bagHandle.position.set(-0.65, 1.45, 0);

    // Miniature High-Heeled Stiletto Shoes
    const shoeL = new THREE.Mesh(shoeSoleGeo, barbieRoseLacquer);
    shoeL.position.set(0.0, 1.28, 0.05);
    shoeL.rotation.x = 0.38;
    const heelL = new THREE.Mesh(shoeHeelGeo, mats.champagneGold);
    heelL.position.set(0.0, 1.24, -0.06);

    // Diamond & Pearl Necklace Bust
    const bust = new THREE.Mesh(necklaceBustGeo, mats.velvetPlum);
    bust.position.set(0.68, 1.35, 0);
    const pearls = new THREE.Mesh(necklacePearlRingGeo, mats.warmLanternGlow);
    pearls.position.set(0.68, 1.42, 0.02);

    vGroup.add(bag, bagHandle, shoeL, heelL, bust, pearls);
    fashionGroup.add(vGroup);
    colliders.push({ x: originX + vc.lx, z: originZ + vc.lz, radius: 0.95 });
  });

  // Framed Couture Wall Portrait
  const galleryPortraitTex = createWallPortraitTexture(
    tracker,
    'Maison de Rêve',
    'Haute Couture Collection',
    '#fbcfe8',
  );
  const portraitFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 2.15, 0.08));
  const portraitCanvasGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.45, 1.92));
  const galleryPortraitMat = tracker.trackMat(new THREE.MeshBasicMaterial({ map: galleryPortraitTex }));
  const gpFrame = new THREE.Mesh(portraitFrameGeo, mats.champagneGold);
  gpFrame.position.set(-11.2, 2.85, -15.2);
  const gpArt = new THREE.Mesh(portraitCanvasGeo, galleryPortraitMat);
  gpArt.position.set(-11.2, 2.85, -15.14);
  fashionGroup.add(gpFrame, gpArt);

  floor1RoomsGroup.add(fashionGroup);

  // ==========================================================================
  // ROOM B: DREAM KITCHEN (East-Front: lx +6..+15, lz -15..-5)
  // ==========================================================================
  const kitchenGroup = new THREE.Group();

  // Scalloped Pastel-Pink North Countertop & Upper Cabinets
  const counterMainGeo = tracker.trackGeo(new THREE.BoxGeometry(6.2, 0.95, 1.1));
  counterMainGeo.translate(0, 0.725, 0);
  const counterMarbleTopGeo = tracker.trackGeo(new THREE.BoxGeometry(6.35, 0.1, 1.18));
  counterMarbleTopGeo.translate(0, 1.24, 0);
  const upperCabGeo = tracker.trackGeo(new THREE.BoxGeometry(5.8, 1.1, 0.55));
  upperCabGeo.translate(0, 3.35, 0);

  const northCounter = new THREE.Mesh(counterMainGeo, blushQuiltedVelvet);
  northCounter.position.set(11.4, 0, -14.3);
  const northMarble = new THREE.Mesh(counterMarbleTopGeo, mats.pearlWhite);
  northMarble.position.set(11.4, 0, -14.3);
  const northUpperCab = new THREE.Mesh(upperCabGeo, blushQuiltedVelvet);
  northUpperCab.position.set(11.4, 0, -14.55);
  kitchenGroup.add(northCounter, northMarble, northUpperCab);

  // Retro Curved Pastel-Pink Refrigerator (lx = 7.6, lz = -14.1)
  const fridgeBodyGeo = tracker.trackGeo(new THREE.BoxGeometry(1.28, 2.35, 1.05));
  fridgeBodyGeo.translate(0, 1.425, 0);
  const fridgeCrownGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.62, 0.64, 1.02, 16, 1, false, 0, Math.PI));
  fridgeCrownGeo.rotateZ(Math.PI / 2);
  fridgeCrownGeo.rotateY(Math.PI / 2);
  fridgeCrownGeo.translate(0, 2.6, 0);

  const fridgeGroup = new THREE.Group();
  fridgeGroup.position.set(7.6, 0, -14.1);
  const fridgeBody = new THREE.Mesh(fridgeBodyGeo, blushQuiltedVelvet);
  const fridgeCrown = new THREE.Mesh(fridgeCrownGeo, barbieRoseLacquer);
  const fridgeGlowBack = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(1.05, 1.95)),
    fridgeInteriorGlowMat,
  );
  fridgeGlowBack.position.set(0, 1.45, 0.48);

  // 3 Crystal-Glass Shelves inside the Fridge (Top: y=1.88, Middle: y=1.48, Bottom: y=1.08)
  const fridgeCrystalShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(1.06, 0.024, 0.78));
  [1.08, 1.48, 1.88].forEach((sy) => {
    const shelfMesh = new THREE.Mesh(fridgeCrystalShelfGeo, mats.crystalGlass);
    shelfMesh.position.set(0, sy, 0.06);
    fridgeGroup.add(shelfMesh);
  });

  // Low-poly reusable food geometries for the 3 crystal-glass fridge shelves
  const cakeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 14));
  const cakeFrostingGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14));
  const milkGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.048, 0.064, 0.24, 10));
  const berryGeo = tracker.trackGeo(new THREE.SphereGeometry(0.042, 8, 8));
  const macaronGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.032, 10));
  const tartCupGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.055, 0.055, 10));
  const puddingCupGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.048, 0.085, 10));

  const cherryRedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#be185d'), roughness: 0.22 }),
  );
  const roseCrystalFoodMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f472b6'),
      roughness: 0.18,
      metalness: 0.1,
    }),
  );

  // TOP SHELF (y = 1.88m): Strawberry cake + cherry + strawberries
  const shelfCake = new THREE.Mesh(cakeGeo, blushQuiltedVelvet);
  shelfCake.position.set(-0.22, 1.96, 0.12);
  const shelfCakeFrosting = new THREE.Mesh(cakeFrostingGeo, barbieRoseLacquer);
  shelfCakeFrosting.position.set(-0.22, 2.04, 0.12);
  const shelfCakeCherry = new THREE.Mesh(berryGeo, cherryRedMat);
  shelfCakeCherry.position.set(-0.22, 2.08, 0.12);
  fridgeGroup.add(shelfCake, shelfCakeFrosting, shelfCakeCherry);

  // Instanced strawberries & cherries on top shelf + fruit tart toppings (10 instances, 1 draw call)
  const fridgeBerryInst = new THREE.InstancedMesh(berryGeo, barbieRoseLacquer, 10);
  const berryCoords = [
    [0.12, 1.92, 0.14],
    [0.22, 1.92, 0.16],
    [0.31, 1.92, 0.12],
    [0.17, 1.92, 0.24],
    [0.27, 1.92, 0.22],
    [-0.28, 2.07, 0.16],
    [-0.16, 2.07, 0.16],
    [-0.22, 2.07, 0.05],
    [-0.32, 1.16, 0.15],
    [-0.12, 1.16, 0.15],
  ];
  for (let b = 0; b < berryCoords.length; b++) {
    _scratchDummy.position.set(berryCoords[b][0], berryCoords[b][1], berryCoords[b][2]);
    _scratchDummy.rotation.set(0, b * 0.6, 0);
    _scratchDummy.scale.set(0.95, 1.15, 0.95);
    _scratchDummy.updateMatrix();
    fridgeBerryInst.setMatrixAt(b, _scratchDummy.matrix);
  }
  fridgeBerryInst.instanceMatrix.needsUpdate = true;
  fridgeGroup.add(fridgeBerryInst);

  // MIDDLE SHELF (y = 1.48m): Pastel milk bottles, pink berry lemonade & macarons
  const milkBottle1 = new THREE.Mesh(milkGeo, mats.pearlWhite);
  milkBottle1.position.set(-0.34, 1.61, 0.12);
  const milkBottle2 = new THREE.Mesh(milkGeo, blushQuiltedVelvet);
  milkBottle2.position.set(-0.18, 1.61, 0.14);
  const lemonadeCarafe = new THREE.Mesh(milkGeo, smoothieBerryMat);
  lemonadeCarafe.position.set(0.0, 1.62, 0.12);
  lemonadeCarafe.scale.set(1.25, 1.08, 1.25);
  fridgeGroup.add(milkBottle1, milkBottle2, lemonadeCarafe);

  const fridgeMacaronInst = new THREE.InstancedMesh(macaronGeo, roseCrystalFoodMat, 6);
  for (let m = 0; m < 6; m++) {
    const mx = 0.18 + (m % 3) * 0.1;
    const my = 1.51 + Math.floor(m / 3) * 0.034;
    _scratchDummy.position.set(mx, my, 0.16);
    _scratchDummy.rotation.set(0, m * 0.4, 0);
    _scratchDummy.scale.setScalar(1.0);
    _scratchDummy.updateMatrix();
    fridgeMacaronInst.setMatrixAt(m, _scratchDummy.matrix);
  }
  fridgeMacaronInst.instanceMatrix.needsUpdate = true;
  fridgeGroup.add(fridgeMacaronInst);

  // BOTTOM SHELF (y = 1.08m): Fruit tarts, pudding cups & sparkling rose-water bottles
  [-0.32, -0.12].forEach((tx) => {
    const tart = new THREE.Mesh(tartCupGeo, champagneGoldFiligreeMat);
    tart.position.set(tx, 1.12, 0.15);
    fridgeGroup.add(tart);
  });
  [0.06, 0.2].forEach((px) => {
    const pudding = new THREE.Mesh(puddingCupGeo, lavenderSilk);
    pudding.position.set(px, 1.135, 0.15);
    fridgeGroup.add(pudding);
  });
  [0.34, 0.44].forEach((rx) => {
    const roseWater = new THREE.Mesh(milkGeo, roseCrystalFoodMat);
    roseWater.position.set(rx, 1.21, 0.12);
    roseWater.scale.set(0.85, 0.95, 0.85);
    fridgeGroup.add(roseWater);
  });

  fridgeGroup.add(fridgeBody, fridgeCrown, fridgeGlowBack);

  // Hinged Fridge Door (swings open 95 deg on left hinge)
  const fridgeDoorPivot = new THREE.Group();
  fridgeDoorPivot.position.set(-0.62, 0.25, 0.54);
  dynamicObjects.add(fridgeDoorPivot);
  const fridgeDoorGeo = tracker.trackGeo(new THREE.BoxGeometry(1.24, 2.25, 0.1));
  fridgeDoorGeo.translate(0.62, 1.125, 0);
  const fridgeDoorMesh = new THREE.Mesh(fridgeDoorGeo, barbieRoseLacquer);
  const fridgeHandleMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.52, 0.12)).translate(1.08, 1.2, 0.08),
    mats.champagneGold,
  );
  fridgeDoorPivot.add(fridgeDoorMesh, fridgeHandleMesh);
  fridgeGroup.add(fridgeDoorPivot);
  kitchenGroup.add(fridgeGroup);
  colliders.push({ x: originX + 7.6, z: originZ - 14.1, radius: 0.92 });

  // Windowed Royal Oven (lx = 11.4, lz = -13.72)
  const ovenGlowPlane = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(0.95, 0.62)),
    ovenBakingGlowMat,
  );
  ovenGlowPlane.position.set(11.4, 0.72, -13.72);
  kitchenGroup.add(ovenGlowPlane);

  const ovenDoorPivot = new THREE.Group();
  ovenDoorPivot.position.set(11.4, 0.38, -13.7);
  dynamicObjects.add(ovenDoorPivot);
  const ovenDoorFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(1.12, 0.74, 0.08));
  ovenDoorFrameGeo.translate(0, 0.37, 0);
  const ovenDoorMesh = new THREE.Mesh(ovenDoorFrameGeo, mats.champagneGold);
  const ovenWindowMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.84, 0.46, 0.1)).translate(0, 0.38, 0),
    mats.crystalGlass,
  );
  ovenDoorPivot.add(ovenDoorMesh, ovenWindowMesh);
  kitchenGroup.add(ovenDoorPivot);

  // Calacatta Marble Breakfast Island (lx = 10.6, lz = -9.6)
  const islandBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(3.4, 0.95, 1.45));
  islandBaseGeo.translate(0, 0.725, 0);
  const islandTopGeo = tracker.trackGeo(new THREE.BoxGeometry(3.65, 0.1, 1.65));
  islandTopGeo.translate(0, 1.24, 0);
  const islandBase = new THREE.Mesh(islandBaseGeo, blushQuiltedVelvet);
  islandBase.position.set(10.6, 0, -9.6);
  const islandTop = new THREE.Mesh(islandTopGeo, mats.pearlWhite);
  islandTop.position.set(10.6, 0, -9.6);
  kitchenGroup.add(islandBase, islandTop);
  colliders.push(
    { x: originX + 9.6, z: originZ - 9.6, radius: 0.95 },
    { x: originX + 11.6, z: originZ - 9.6, radius: 0.95 },
  );

  // 3 Pastel Barstools
  const stoolSeatGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.26, 0.12, 16));
  const stoolLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.04, 0.06, 0.78, 10));
  stoolLegGeo.translate(0, 0.39, 0);
  [9.4, 10.6, 11.8].forEach((sx) => {
    const leg = new THREE.Mesh(stoolLegGeo, mats.champagneGold);
    leg.position.set(sx, 0.25, -8.35);
    const seat = new THREE.Mesh(stoolSeatGeo, barbieRoseLacquer);
    seat.position.set(sx, 1.05, -8.35);
    kitchenGroup.add(leg, seat);
  });

  // ==========================================================================
  // 20. KITCHEN COUNTERS PROPS (Low-Poly Reusable & Instanced Culinary Details)
  // ==========================================================================
  // 1) Tiered Gold & Blush Pastry Stand + Instanced Cupcakes on the Breakfast Island (lx = 10.55, lz = -9.55)
  const pastryStandRod = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 0.36, 8)).translate(10.55, 1.47, -9.55),
    mats.champagneGold,
  );
  const pastryTierLower = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.22, 0.02, 16)).translate(10.55, 1.38, -9.55),
    mats.pearlWhite,
  );
  const pastryTierUpper = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.17, 0.15, 0.02, 16)).translate(10.55, 1.54, -9.55),
    blushQuiltedVelvet,
  );
  kitchenGroup.add(pastryStandRod, pastryTierLower, pastryTierUpper);

  const cupcakeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.042, 0.032, 0.055, 10));
  const cupcakeInst = new THREE.InstancedMesh(cupcakeGeo, barbieRoseLacquer, 6);
  for (let c = 0; c < 6; c++) {
    const isUpper = c >= 4;
    const ang = (c * Math.PI * 2) / (isUpper ? 2 : 4);
    const r = isUpper ? 0.075 : 0.14;
    const cy = isUpper ? 1.575 : 1.415;
    _scratchDummy.position.set(10.55 + Math.cos(ang) * r, cy, -9.55 + Math.sin(ang) * r);
    _scratchDummy.rotation.set(0, ang, 0);
    _scratchDummy.scale.setScalar(1.0);
    _scratchDummy.updateMatrix();
    cupcakeInst.setMatrixAt(c, _scratchDummy.matrix);
  }
  cupcakeInst.instanceMatrix.needsUpdate = true;
  kitchenGroup.add(cupcakeInst);

  // 2) Pastel Stand Mixer + Stainless Mixing Bowl (North Counter Left: lx = 9.35, y = 1.29, lz = -14.12)
  const stainlessSteelMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#e2e8f0'), roughness: 0.18, metalness: 0.88 }),
  );
  const mixerBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.28, 0.32)).translate(9.35, 1.43, -14.12),
    barbieRoseLacquer,
  );
  const mixerHead = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 12)).rotateX(Math.PI / 2).translate(9.35, 1.58, -14.08),
    blushQuiltedVelvet,
  );
  const mixerBowl = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.08, 0.14, 14)).translate(9.35, 1.37, -13.98),
    stainlessSteelMat,
  );
  kitchenGroup.add(mixerBase, mixerHead, mixerBowl);

  // 3) Miniature Saucepans on the Stovetop (North Counter Center: lx = 11.4, y = 1.29, lz = -14.1)
  const saucepanPotGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.11, 0.09, 14));
  const saucepanHandleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6)).rotateZ(Math.PI / 2);
  [-0.24, 0.24].forEach((px, idx) => {
    const pot = new THREE.Mesh(saucepanPotGeo, idx === 0 ? barbieRoseLacquer : mats.champagneGold);
    pot.position.set(11.4 + px, 1.34, -14.1);
    const hnd = new THREE.Mesh(saucepanHandleGeo, mats.champagneGold);
    hnd.position.set(11.4 + px + (idx === 0 ? -0.17 : 0.17), 1.36, -14.1);
    kitchenGroup.add(pot, hnd);
  });

  // 4) Cutting Board + Sliced Fruit (North Counter Right: lx = 12.65, y = 1.29, lz = -14.12)
  const cuttingBoard = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.46, 0.022, 0.32)).translate(12.65, 1.302, -14.12),
    mats.creamStone,
  );
  kitchenGroup.add(cuttingBoard);
  [-0.1, 0.0, 0.1].forEach((fx, idx) => {
    const fruitSlice = new THREE.Mesh(
      macaronGeo,
      idx === 1 ? cherryRedMat : barbieRoseLacquer,
    );
    fruitSlice.position.set(12.65 + fx, 1.328, -14.12 + (idx - 1) * 0.04);
    kitchenGroup.add(fruitSlice);
  });

  // 5) Utensil Crocks & Spice Jars along North Counter Back Splash (lx = 13.4..14.1, y = 1.29, lz = -14.45)
  const utensilCrock = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.19, 12)).translate(13.45, 1.385, -14.42),
    blushQuiltedVelvet,
  );
  kitchenGroup.add(utensilCrock);

  const spiceJarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.042, 0.042, 0.11, 10));
  const spiceJarInst = new THREE.InstancedMesh(spiceJarGeo, mats.champagneGold, 4);
  for (let j = 0; j < 4; j++) {
    _scratchDummy.position.set(13.72 + j * 0.12, 1.345, -14.44);
    _scratchDummy.rotation.set(0, 0, 0);
    _scratchDummy.scale.setScalar(1.0);
    _scratchDummy.updateMatrix();
    spiceJarInst.setMatrixAt(j, _scratchDummy.matrix);
  }
  spiceJarInst.instanceMatrix.needsUpdate = true;
  kitchenGroup.add(spiceJarInst);

  // 6) Teacups + Saucers on the Breakfast Island (Instanced, 3 sets)
  const saucerGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.095, 0.075, 0.016, 12));
  const teacupGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.058, 0.042, 0.068, 12));
  const saucerInst = new THREE.InstancedMesh(saucerGeo, mats.pearlWhite, 3);
  const teacupInst = new THREE.InstancedMesh(teacupGeo, blushQuiltedVelvet, 3);
  [9.85, 11.1, 11.95].forEach((tx, idx) => {
    _scratchDummy.position.set(tx, 1.298, -9.18);
    _scratchDummy.rotation.set(0, 0, 0);
    _scratchDummy.scale.setScalar(1.0);
    _scratchDummy.updateMatrix();
    saucerInst.setMatrixAt(idx, _scratchDummy.matrix);

    _scratchDummy.position.set(tx, 1.335, -9.18);
    _scratchDummy.updateMatrix();
    teacupInst.setMatrixAt(idx, _scratchDummy.matrix);
  });
  saucerInst.instanceMatrix.needsUpdate = true;
  teacupInst.instanceMatrix.needsUpdate = true;
  kitchenGroup.add(saucerInst, teacupInst);

  // Smoothie Blender (lx = 9.6, lz = -9.6) & Brass-and-Rose Teakettle (lx = 11.5, lz = -9.6)
  const blenderBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 14)).translate(0, 1.4, 0),
    barbieRoseLacquer,
  );
  blenderBase.position.set(9.6, 0, -9.6);
  const blenderJarPivot = new THREE.Group();
  blenderJarPivot.position.set(9.6, 1.66, -9.6);
  dynamicObjects.add(blenderJarPivot);
  const blenderJar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.34, 14)),
    mats.crystalGlass,
  );
  const blenderVortex = new THREE.Mesh(
    tracker.trackGeo(new THREE.ConeGeometry(0.11, 0.26, 12)),
    smoothieBerryMat,
  );
  blenderJarPivot.add(blenderJar, blenderVortex);
  kitchenGroup.add(blenderBase, blenderJarPivot);

  const kettleGroup = new THREE.Group();
  kettleGroup.position.set(11.5, 1.29, -9.6);
  const kettleBody = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.18, 14, 12)).translate(0, 0.15, 0),
    barbieRoseLacquer,
  );
  const kettleHandle = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.022, 8, 16, Math.PI)).translate(0, 0.26, 0),
    mats.champagneGold,
  );
  kettleGroup.add(kettleBody, kettleHandle);
  kitchenGroup.add(kettleGroup);

  // Steam puffs for Oven & Kettle
  const steamGeo = tracker.trackGeo(new THREE.SphereGeometry(0.09, 8, 8));
  const steamPuffs: THREE.Mesh[] = [];
  for (let s = 0; s < 6; s++) {
    const puff = new THREE.Mesh(steamGeo, steamParticleMat);
    puff.position.set(11.5, 1.65 + s * 0.14, -9.6);
    puff.visible = false;
    dynamicObjects.add(puff);
    steamPuffs.push(puff);
    kitchenGroup.add(puff);
  }

  floor1RoomsGroup.add(kitchenGroup);

  // ==========================================================================
  // ROOM C: ROYAL DINING ROOM (East-Center: lx +9.2..+15.2, lz -7.2..+7.2)
  // ==========================================================================
  const diningGroup = new THREE.Group();
  const diningTableX = 12.1;
  const diningTableZ = 0.0;

  const tableTopGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 28));
  tableTopGeo.scale(1.0, 1.0, 1.75);
  tableTopGeo.translate(0, 1.02, 0);
  const tableRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.36, 0.045, 8, 32));
  tableRimGeo.rotateX(Math.PI / 2);
  tableRimGeo.scale(1.0, 1.75, 1.0);
  tableRimGeo.translate(0, 1.02, 0);
  const tablePedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.46, 0.76, 16));
  tablePedestalGeo.translate(0, 0.63, 0);

  const tableTop = new THREE.Mesh(tableTopGeo, mats.pearlWhite);
  tableTop.position.set(diningTableX, 0, diningTableZ);
  tableTop.receiveShadow = true;
  const tableRim = new THREE.Mesh(tableRimGeo, mats.champagneGold);
  tableRim.position.set(diningTableX, 0, diningTableZ);
  const tablePedN = new THREE.Mesh(tablePedestalGeo, mats.champagneGold);
  tablePedN.position.set(diningTableX, 0, diningTableZ - 1.1);
  const tablePedS = new THREE.Mesh(tablePedestalGeo, mats.champagneGold);
  tablePedS.position.set(diningTableX, 0, diningTableZ + 1.1);
  diningGroup.add(tableTop, tableRim, tablePedN, tablePedS);
  colliders.push(
    { x: originX + diningTableX, z: originZ - 1.1, radius: 1.25 },
    { x: originX + diningTableX, z: originZ + 1.1, radius: 1.25 },
  );

  // 6 Princess Dining Chairs
  const chairSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.1, 0.56));
  chairSeatGeo.translate(0, 0.68, 0);
  const chairBackGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.24, 0.68, 12));
  chairBackGeo.scale(1.0, 1.0, 0.25);
  chairBackGeo.translate(0, 1.08, -0.24);
  const chairBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.26, 0.42, 12));
  chairBaseGeo.translate(0, 0.46, 0);

  const chairSpots = [
    { x: diningTableX, z: -2.65, rotY: 0 }, // Head Chair (Interactive Seat)
    { x: diningTableX, z: 2.65, rotY: Math.PI },
    { x: diningTableX - 1.65, z: -0.95, rotY: Math.PI / 2 },
    { x: diningTableX - 1.65, z: 0.95, rotY: Math.PI / 2 },
    { x: diningTableX + 1.65, z: -0.95, rotY: -Math.PI / 2 },
    { x: diningTableX + 1.65, z: 0.95, rotY: -Math.PI / 2 },
  ];

  chairSpots.forEach((cs) => {
    const cg = new THREE.Group();
    cg.position.set(cs.x, 0, cs.z);
    cg.rotation.y = cs.rotY;
    const seat = new THREE.Mesh(chairSeatGeo, blushQuiltedVelvet);
    const back = new THREE.Mesh(chairBackGeo, barbieRoseLacquer);
    const base = new THREE.Mesh(chairBaseGeo, mats.champagneGold);
    cg.add(seat, back, base);
    diningGroup.add(cg);
  });

  // Two-Person Romantic Centerpiece: Gold Candelabra, Blooming Blush Roses & Engraved Place Cards
  const plateGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.18, 0.03, 16));
  const gobletGeo = tracker.trackGeo(new THREE.ConeGeometry(0.065, 0.18, 12));
  const candelabraStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.12, 0.48, 12));
  const candleFlameGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.055, 0));
  const roseBloomGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.085, 0));

  const candelabra = new THREE.Mesh(candelabraStemGeo, mats.champagneGold);
  candelabra.position.set(diningTableX, 1.32, diningTableZ);
  const flameCenter = new THREE.Mesh(candleFlameGeo, mats.warmLanternGlow);
  flameCenter.position.set(diningTableX, 1.62, diningTableZ);
  diningGroup.add(candelabra, flameCenter);

  [-0.28, 0.0, 0.28].forEach((rz, idx) => {
    const rose = new THREE.Mesh(roseBloomGeo, idx === 1 ? barbieRoseLacquer : blushQuiltedVelvet);
    rose.position.set(diningTableX + (idx - 1) * 0.12, 1.14, diningTableZ + rz);
    diningGroup.add(rose);
  });

  // Place settings & engraved place card for Yeshwanth & Harsha
  const placeCardTex = createPlaceCardTexture(tracker);
  const placeCardMat = tracker.trackMat(new THREE.MeshBasicMaterial({ map: placeCardTex, side: THREE.DoubleSide }));
  const placeCardGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.38, 0.19));

  [-1.35, 1.35].forEach((pz, idx) => {
    const plate = new THREE.Mesh(plateGeo, mats.pearlWhite);
    plate.position.set(diningTableX, 1.095, pz);
    const goblet = new THREE.Mesh(gobletGeo, mats.crystalGlass);
    goblet.position.set(diningTableX + 0.26, 1.18, pz);
    const card = new THREE.Mesh(placeCardGeo, placeCardMat);
    card.position.set(diningTableX, 1.18, pz * 0.62);
    card.rotation.y = idx === 0 ? Math.PI : 0;
    card.rotation.x = idx === 0 ? 0.35 : -0.35;
    diningGroup.add(plate, goblet, card);
  });

  floor1RoomsGroup.add(diningGroup);

  // ==========================================================================
  // ROOM D: LIVING ROOM (West-Center: lx -15.2..-9.2, lz -7.2..+7.2)
  //         VELVET SOFA + LAYERED VINTAGE FIREPLACE + MECHANICAL RECORD PLAYER
  // ==========================================================================
  const livingGroup = new THREE.Group();

  // 1. Structured Fireplace Hierarchy (lx = -14.6, lz = 0.0)
  //    Fireplace -> Logs, EmberBed, InnerFlame, OuterFlame, SmallFlameTips, EmberParticles, WarmLight
  const hearthBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(1.1, 2.25, 2.8));
  hearthBaseGeo.translate(0, 1.385, 0);
  const hearthMantelGeo = tracker.trackGeo(new THREE.BoxGeometry(1.28, 0.22, 3.15));
  hearthMantelGeo.translate(0, 2.55, 0);
  const fireboxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 1.08, 1.62));
  fireboxGeo.translate(0.35, 0.84, 0);

  const fireplaceGroup = new THREE.Group();
  fireplaceGroup.name = 'Fireplace';
  fireplaceGroup.position.set(-14.6, 0, 0.0);
  const hearthBase = new THREE.Mesh(hearthBaseGeo, mats.pearlWhite);
  const hearthMantel = new THREE.Mesh(hearthMantelGeo, mats.champagneGold);
  const firebox = new THREE.Mesh(fireboxGeo, mats.darkBronze);
  fireplaceGroup.add(hearthBase, hearthMantel, firebox);

  // Fireplace -> Logs (charred oak logs resting on a brass grate)
  const fpLogsGroup = new THREE.Group();
  fpLogsGroup.name = 'Logs';
  const charredWoodMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2a1810'),
      emissive: new THREE.Color('#7c2d12'),
      emissiveIntensity: 0.35,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  const fpLogGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.085, 0.095, 0.88, 10));
  fpLogGeo.rotateX(Math.PI / 2);
  [
    { x: 0.42, y: 0.46, z: 0.0, rx: 0, ry: 0.12 },
    { x: 0.5, y: 0.45, z: -0.08, rx: 0.08, ry: -0.18 },
    { x: 0.46, y: 0.55, z: 0.04, rx: -0.1, ry: 0.28 },
  ].forEach((lg) => {
    const logMesh = new THREE.Mesh(fpLogGeo, charredWoodMat);
    logMesh.position.set(lg.x, lg.y, lg.z);
    logMesh.rotation.set(lg.rx, lg.ry, 0);
    fpLogsGroup.add(logMesh);
  });
  fireplaceGroup.add(fpLogsGroup);

  // Fireplace -> EmberBed (glowing pulsing coal & ember bed beneath the logs)
  const fpEmberBedGroup = new THREE.Group();
  fpEmberBedGroup.name = 'EmberBed';
  const emberBedGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.09, 1.05));
  const emberBedMesh = new THREE.Mesh(emberBedGeo, fireplaceEmberMat);
  emberBedMesh.position.set(0.45, 0.36, 0);
  fpEmberBedGroup.add(emberBedMesh);

  const coalChunkGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.065, 0));
  [-0.38, -0.22, -0.06, 0.1, 0.26, 0.4].forEach((cz, idx) => {
    const coal = new THREE.Mesh(coalChunkGeo, fireplaceEmberMat);
    coal.position.set(0.46 + (idx % 2) * 0.05, 0.4, cz);
    coal.scale.set(1.2, 0.65, 1.1);
    fpEmberBedGroup.add(coal);
  });
  fireplaceGroup.add(fpEmberBedGroup);

  // Fireplace -> InnerFlame, OuterFlame, SmallFlameTips (3 layered animated flame groups)
  const fpInnerFlameGroup = new THREE.Group();
  fpInnerFlameGroup.name = 'InnerFlame';
  const fpOuterFlameGroup = new THREE.Group();
  fpOuterFlameGroup.name = 'OuterFlame';
  const fpSmallFlameTipsGroup = new THREE.Group();
  fpSmallFlameTipsGroup.name = 'SmallFlameTips';

  const innerFlameMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const outerFlameMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fb923c'),
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const flameTipMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#f43f5e'),
      transparent: true,
      opacity: 0.76,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  // Cone geometry translated so base is at y = 0 and tip stretches upward on scale.y
  const flameConeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.13, 0.42, 8));
  flameConeGeo.translate(0, 0.21, 0);
  flameConeGeo.scale(0.75, 1.0, 1.15);

  interface AnimatedFlameLayer {
    mesh: THREE.Mesh;
    baseX: number;
    baseY: number;
    baseZ: number;
    baseScaleX: number;
    baseScaleY: number;
    baseScaleZ: number;
    speed: number;
    phase: number;
  }
  const animatedFlameLayers: AnimatedFlameLayer[] = [];

  // 3 InnerFlame cores (bright golden-white)
  [
    { x: 0.46, y: 0.46, z: -0.24, sx: 0.85, sy: 0.95, sz: 0.9, speed: 9.2, phase: 0.0 },
    { x: 0.47, y: 0.48, z: 0.0, sx: 1.05, sy: 1.22, sz: 1.1, speed: 8.4, phase: 1.7 },
    { x: 0.46, y: 0.46, z: 0.24, sx: 0.88, sy: 1.0, sz: 0.92, speed: 9.8, phase: 3.1 },
  ].forEach((cfg) => {
    const m = new THREE.Mesh(flameConeGeo, innerFlameMat);
    m.position.set(cfg.x, cfg.y, cfg.z);
    m.scale.set(cfg.sx, cfg.sy, cfg.sz);
    dynamicObjects.add(m);
    fpInnerFlameGroup.add(m);
    animatedFlameLayers.push({
      mesh: m,
      baseX: cfg.x,
      baseY: cfg.y,
      baseZ: cfg.z,
      baseScaleX: cfg.sx,
      baseScaleY: cfg.sy,
      baseScaleZ: cfg.sz,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  });

  // 4 OuterFlame tongues (warm orange-amber)
  [
    { x: 0.44, y: 0.44, z: -0.34, sx: 1.05, sy: 1.1, sz: 1.05, speed: 7.5, phase: 0.6 },
    { x: 0.45, y: 0.45, z: -0.11, sx: 1.25, sy: 1.38, sz: 1.2, speed: 6.8, phase: 2.2 },
    { x: 0.45, y: 0.45, z: 0.12, sx: 1.22, sy: 1.32, sz: 1.18, speed: 7.9, phase: 3.9 },
    { x: 0.44, y: 0.44, z: 0.34, sx: 1.0, sy: 1.05, sz: 1.0, speed: 8.1, phase: 5.1 },
  ].forEach((cfg) => {
    const m = new THREE.Mesh(flameConeGeo, outerFlameMat);
    m.position.set(cfg.x, cfg.y, cfg.z);
    m.scale.set(cfg.sx, cfg.sy, cfg.sz);
    dynamicObjects.add(m);
    fpOuterFlameGroup.add(m);
    animatedFlameLayers.push({
      mesh: m,
      baseX: cfg.x,
      baseY: cfg.y,
      baseZ: cfg.z,
      baseScaleX: cfg.sx,
      baseScaleY: cfg.sy,
      baseScaleZ: cfg.sz,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  });

  // 4 SmallFlameTips (flickering coral-rose upper tongues)
  [
    { x: 0.47, y: 0.68, z: -0.26, sx: 0.55, sy: 0.68, sz: 0.58, speed: 11.5, phase: 1.1 },
    { x: 0.48, y: 0.74, z: -0.05, sx: 0.62, sy: 0.78, sz: 0.65, speed: 10.8, phase: 2.8 },
    { x: 0.48, y: 0.72, z: 0.14, sx: 0.58, sy: 0.74, sz: 0.6, speed: 12.2, phase: 4.4 },
    { x: 0.47, y: 0.66, z: 0.3, sx: 0.52, sy: 0.64, sz: 0.54, speed: 11.9, phase: 5.7 },
  ].forEach((cfg) => {
    const m = new THREE.Mesh(flameConeGeo, flameTipMat);
    m.position.set(cfg.x, cfg.y, cfg.z);
    m.scale.set(cfg.sx, cfg.sy, cfg.sz);
    dynamicObjects.add(m);
    fpSmallFlameTipsGroup.add(m);
    animatedFlameLayers.push({
      mesh: m,
      baseX: cfg.x,
      baseY: cfg.y,
      baseZ: cfg.z,
      baseScaleX: cfg.sx,
      baseScaleY: cfg.sy,
      baseScaleZ: cfg.sz,
      speed: cfg.speed,
      phase: cfg.phase,
    });
  });

  // Fireplace -> EmberParticles (6 lightweight rising glowing ember sparks)
  const fpEmberParticlesGroup = new THREE.Group();
  fpEmberParticlesGroup.name = 'EmberParticles';
  const emberSparkGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.022, 0));
  const emberSparkMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fde047'),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const emberSparkMeshes: THREE.Mesh[] = [];
  for (let eIdx = 0; eIdx < 6; eIdx++) {
    const spark = new THREE.Mesh(emberSparkGeo, emberSparkMat);
    spark.position.set(0.46, 0.55 + eIdx * 0.1, (eIdx - 2.5) * 0.12);
    dynamicObjects.add(spark);
    emberSparkMeshes.push(spark);
    fpEmberParticlesGroup.add(spark);
  }

  // Fireplace -> WarmLight (cozy warm orange/amber firelight illuminating sofa, rug, and record player)
  const fireplaceWarmLight = new THREE.PointLight('#ff9e44', 1.35, 10.5, 1.5);
  fireplaceWarmLight.name = 'WarmLight';
  fireplaceWarmLight.position.set(0.75, 0.95, 0.0);

  fireplaceGroup.add(
    fpInnerFlameGroup,
    fpOuterFlameGroup,
    fpSmallFlameTipsGroup,
    fpEmberParticlesGroup,
    fireplaceWarmLight,
  );
  livingGroup.add(fireplaceGroup);
  colliders.push({ x: originX - 14.6, z: originZ, radius: 1.25 });

  // 2. Open Tufted Blush-Velvet Sofa (lx = -10.5, lz = 0.0, facing fireplace at -X; zero dome or cylindrical obstructions)
  const sofaSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.96, 0.42, 2.65));
  sofaSeatGeo.translate(0, 0.52, 0);
  const sofaBackGeo = tracker.trackGeo(new THREE.BoxGeometry(0.22, 0.82, 2.65));
  sofaBackGeo.translate(0.38, 0.92, 0);
  const sofaArmBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.96, 0.58, 0.22));
  sofaArmBoxGeo.translate(0, 0.62, 0);

  const sofaGroup = new THREE.Group();
  sofaGroup.name = 'VelvetSofa';
  sofaGroup.position.set(-10.5, 0, 0.0);
  const sofaSeat = new THREE.Mesh(sofaSeatGeo, blushQuiltedVelvet);
  const sofaBack = new THREE.Mesh(sofaBackGeo, barbieRoseLacquer);
  const armN = new THREE.Mesh(sofaArmBoxGeo, blushQuiltedVelvet);
  armN.position.set(0, 0, -1.36);
  const armS = new THREE.Mesh(sofaArmBoxGeo, blushQuiltedVelvet);
  armS.position.set(0, 0, 1.36);
  sofaGroup.add(sofaSeat, sofaBack, armN, armS);
  livingGroup.add(sofaGroup);
  colliders.push(
    { x: originX - 10.5, z: originZ - 0.85, radius: 0.68 },
    { x: originX - 10.5, z: originZ + 0.85, radius: 0.68 },
  );

  // Sleek Rectangular Rose-Marble & Gold Coffee Table (lx = -12.3, lz = 0.0)
  const coffeeTable = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.88, 0.06, 1.65)).translate(0, 0.62, 0),
    mats.pearlWhite,
  );
  coffeeTable.position.set(-12.3, 0, 0.0);
  const coffeeBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.34, 1.35)).translate(0, 0.44, 0),
    mats.champagneGold,
  );
  coffeeBase.position.set(-12.3, 0, 0.0);
  livingGroup.add(coffeeTable, coffeeBase);

  // 3. Vintage Barbie-Era Record Player (lx = -11.55, lz = -1.65, angled toward the Velvet Sofa)
  //    Hierarchy: RecordPlayer -> BaseCabinet, LidPivot -> GlassCover, Platter,
  //               RecordDiscPivot -> Vinyl + CenterLabel, TonearmPivot -> Tonearm -> Cartridge -> Stylus
  const recordPlayerX = -11.55;
  const recordPlayerZ = -1.65;
  const recordPlayerGroup = new THREE.Group();
  recordPlayerGroup.name = 'RecordPlayer';
  recordPlayerGroup.position.set(recordPlayerX, 0, recordPlayerZ);
  recordPlayerGroup.rotation.y = 0.52; // Angled toward the Velvet Sofa so it's clearly visible while seated!

  // Side Table Pedestal under Record Player
  const rpTableTop = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.44, 0.42, 0.06, 20)).translate(0, 0.93, 0),
    mats.blushRoseMarble,
  );
  const rpTableStem = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 0.66, 14)).translate(0, 0.58, 0),
    mats.champagneGold,
  );
  const rpTableBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.36, 0.06, 18)).translate(0, 0.28, 0),
    mats.blushRoseMarble,
  );
  recordPlayerGroup.add(rpTableTop, rpTableStem, rpTableBase);

  // BaseCabinet: Dark polished wood body with rounded vintage corners, gold/brass trim, cream controls & Barbie-pink accents
  const baseCabinetGroup = new THREE.Group();
  baseCabinetGroup.name = 'BaseCabinet';
  const darkPolishedWoodMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#3b1912'),
      roughness: 0.2,
      metalness: 0.08,
      clearcoat: 0.82,
      clearcoatRoughness: 0.15,
    }),
  );

  const cabinetCore = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.14, 0.46)).translate(0, 1.03, 0),
    darkPolishedWoodMat,
  );
  baseCabinetGroup.add(cabinetCore);

  // 4 Rounded Vintage Wood Corner Columns + Gold Collars
  const cornerColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.145, 12));
  cornerColGeo.translate(0, 1.03, 0);
  [
    [-0.26, -0.21],
    [0.26, -0.21],
    [-0.26, 0.21],
    [0.26, 0.21],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(cornerColGeo, darkPolishedWoodMat);
    col.position.set(cx, 0, cz);
    baseCabinetGroup.add(col);
  });

  // Gold/Brass Trim Frame & Pink Barbie-Inspired Accent Bezel
  const goldTrimFrame = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.61, 0.025, 0.51)).translate(0, 0.97, 0),
    mats.champagneGold,
  );
  const pinkAccentDeck = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.54, 0.016, 0.44)).translate(0, 1.105, 0),
    barbieRoseLacquer,
  );
  const creamControlStrip = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.5, 0.02, 0.09)).translate(0, 1.11, 0.16),
    mats.pearlWhite,
  );
  baseCabinetGroup.add(goldTrimFrame, pinkAccentDeck, creamControlStrip);

  // Analog Control Knobs & Warm Indicator Light on Front Cream Control Strip
  const knobGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.025, 0.024, 12));
  knobGeo.translate(0, 1.125, 0.16);
  const knobVol = new THREE.Mesh(knobGeo, mats.champagneGold);
  knobVol.position.x = 0.14;
  const knobSpeed = new THREE.Mesh(knobGeo, mats.champagneGold);
  knobSpeed.position.x = 0.2;

  const recordIndicatorMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fda4af'),
      emissive: new THREE.Color('#f43f5e'),
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
  );
  const indicatorLamp = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.016, 10, 10)).translate(-0.18, 1.122, 0.16),
    recordIndicatorMat,
  );

  // Subtle Romantic Engraved Gold Plate ("♡ LOVE") on Front Bevel
  const lovePlateCanvas = document.createElement('canvas');
  lovePlateCanvas.width = 256;
  lovePlateCanvas.height = 64;
  const lpCtx = lovePlateCanvas.getContext('2d');
  if (lpCtx) {
    lpCtx.fillStyle = '#d8b467';
    lpCtx.fillRect(0, 0, 256, 64);
    lpCtx.strokeStyle = '#fff1f2';
    lpCtx.lineWidth = 4;
    lpCtx.strokeRect(4, 4, 248, 56);
    lpCtx.fillStyle = '#831843';
    lpCtx.font = 'bold 28px Georgia, serif';
    lpCtx.textAlign = 'center';
    lpCtx.textBaseline = 'middle';
    lpCtx.fillText('♡ BARBIE LOVE ♡', 128, 34);
  }
  const lovePlateTex = tracker.trackTex(new THREE.CanvasTexture(lovePlateCanvas));
  lovePlateTex.colorSpace = THREE.SRGBColorSpace;
  const lovePlateMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(0.18, 0.045)),
    tracker.trackMat(new THREE.MeshBasicMaterial({ map: lovePlateTex })),
  );
  lovePlateMesh.position.set(0, 1.035, 0.232);
  baseCabinetGroup.add(knobVol, knobSpeed, indicatorLamp, lovePlateMesh);
  recordPlayerGroup.add(baseCabinetGroup);

  // Platter: Brushed Gold Turntable Platter
  const rpPlatter = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.195, 0.205, 0.018, 24)).translate(-0.04, 1.12, -0.02),
    mats.champagneGold,
  );
  rpPlatter.name = 'Platter';
  recordPlayerGroup.add(rpPlatter);

  // RecordDiscPivot -> Vinyl + CenterLabel (spins continuously around Y when playing!)
  const vinylDiscPivot = new THREE.Group();
  vinylDiscPivot.name = 'RecordDiscPivot';
  vinylDiscPivot.position.set(-0.04, 1.132, -0.02);
  dynamicObjects.add(vinylDiscPivot);

  const vinylDisc = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.185, 0.185, 0.01, 28)),
    vinylBlackMat,
  );
  vinylDisc.name = 'Vinyl';

  // Asymmetric Pink/Gold Barbie Center Label CanvasTexture so rotation is unmistakable
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 256;
  const lbCtx = labelCanvas.getContext('2d');
  if (lbCtx) {
    lbCtx.fillStyle = '#f43f5e';
    lbCtx.beginPath();
    lbCtx.arc(128, 128, 124, 0, Math.PI * 2);
    lbCtx.fill();

    // Two gold half-arcs & heart motif so spinning is visually obvious
    lbCtx.fillStyle = '#fde047';
    lbCtx.beginPath();
    lbCtx.moveTo(128, 128);
    lbCtx.arc(128, 128, 110, 0, Math.PI * 0.45);
    lbCtx.closePath();
    lbCtx.fill();

    lbCtx.beginPath();
    lbCtx.moveTo(128, 128);
    lbCtx.arc(128, 128, 110, Math.PI, Math.PI * 1.45);
    lbCtx.closePath();
    lbCtx.fill();

    lbCtx.fillStyle = '#fbcfe8';
    lbCtx.beginPath();
    lbCtx.arc(128, 128, 72, 0, Math.PI * 2);
    lbCtx.fill();

    lbCtx.fillStyle = '#be123c';
    lbCtx.font = 'bold 26px Georgia, serif';
    lbCtx.textAlign = 'center';
    lbCtx.textBaseline = 'middle';
    lbCtx.fillText('♥ BARBIE ♥', 128, 108);
    lbCtx.font = 'italic 20px Georgia, serif';
    lbCtx.fillText('Dream Waltz', 128, 146);

    lbCtx.fillStyle = '#1e1018';
    lbCtx.beginPath();
    lbCtx.arc(128, 128, 12, 0, Math.PI * 2);
    lbCtx.fill();
  }
  const vinylLabelTex = tracker.trackTex(new THREE.CanvasTexture(labelCanvas));
  vinylLabelTex.colorSpace = THREE.SRGBColorSpace;
  const vinylLabel = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.013, 20)),
    tracker.trackMat(new THREE.MeshBasicMaterial({ map: vinylLabelTex })),
  );
  vinylLabel.name = 'CenterLabel';
  vinylDiscPivot.add(vinylDisc, vinylLabel);
  recordPlayerGroup.add(vinylDiscPivot);

  // TonearmPivot -> Tonearm -> Cartridge -> Stylus
  const tonearmPivot = new THREE.Group();
  tonearmPivot.name = 'TonearmPivot';
  tonearmPivot.position.set(0.19, 1.14, -0.14);
  dynamicObjects.add(tonearmPivot);

  const tonearmBasePost = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.028, 0.034, 0.035, 12)),
    mats.champagneGold,
  );
  const tonearmBar = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.008, 0.009, 0.25, 8)).rotateX(Math.PI / 2).translate(0, 0.012, 0.11),
    mats.champagneGold,
  );
  tonearmBar.name = 'Tonearm';

  const cartridgeMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.026, 0.016, 0.044)).translate(0, 0.01, 0.235),
    mats.pearlWhite,
  );
  cartridgeMesh.name = 'Cartridge';

  const stylusMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.ConeGeometry(0.005, 0.018, 6)).rotateX(Math.PI).translate(0, -0.004, 0.245),
    mats.champagneGold,
  );
  stylusMesh.name = 'Stylus';
  cartridgeMesh.add(stylusMesh);
  tonearmBar.add(cartridgeMesh);
  tonearmPivot.add(tonearmBasePost, tonearmBar);
  recordPlayerGroup.add(tonearmPivot);

  // LidPivot -> GlassCover (hinged crystal/glass cover at rear z = -0.22, opens smoothly when active)
  const recordLidPivot = new THREE.Group();
  recordLidPivot.name = 'LidPivot';
  recordLidPivot.position.set(0, 1.115, -0.22);
  dynamicObjects.add(recordLidPivot);

  const glassCoverMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.095, 0.45)).translate(0, 0.048, 0.22),
    mats.crystalGlass,
  );
  glassCoverMesh.name = 'GlassCover';
  const glassCoverGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.57, 0.014, 0.46)).translate(0, 0.095, 0.22),
    mats.champagneGold,
  );
  glassCoverMesh.add(glassCoverGoldRim);
  recordLidPivot.add(glassCoverMesh);
  recordPlayerGroup.add(recordLidPivot);

  livingGroup.add(recordPlayerGroup);
  colliders.push({ x: originX + recordPlayerX, z: originZ + recordPlayerZ, radius: 0.52 });

  // ==========================================================================
  // 18. ROMANTIC WALL ART ("Yeshwanth ❤️ Harsha" — 1024x512 CanvasTexture Created Once)
  // ==========================================================================
  const romanticNeonTex = createRomanticNeonWallArtTexture(tracker);
  const romanticNeonMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: romanticNeonTex,
      side: THREE.FrontSide,
    }),
  );
  const romanticArtPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.7, 1.35));
  const romanticArtFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(2.86, 1.51, 0.06));

  // Mounted above the Living Room Mantelpiece (lx = -14.25, y = 3.42, lz = 0.0, facing East +X)
  const livingWallArtGroup = new THREE.Group();
  livingWallArtGroup.position.set(-14.25, 3.42, 0.0);
  livingWallArtGroup.rotation.y = Math.PI / 2;
  const livingArtFrame = new THREE.Mesh(romanticArtFrameGeo, champagneGoldFiligreeMat);
  livingArtFrame.position.z = -0.025;
  const livingArtCanvas = new THREE.Mesh(romanticArtPlaneGeo, romanticNeonMat);
  livingArtCanvas.position.z = 0.012;
  livingWallArtGroup.add(livingArtFrame, livingArtCanvas);
  livingGroup.add(livingWallArtGroup);

  floor1RoomsGroup.add(livingGroup);

  // ==========================================================================
  // ROOM E: MUSIC LOUNGE (West-Rear: lx -15.2..-9.2, lz +7.8..+15.2)
  // ==========================================================================
  const musicGroup = new THREE.Group();
  const pianoX = -13.1;
  const pianoZ = 10.8;

  // Mounted prominently on the Music Lounge Gallery Wall (lx = -15.32, y = 2.85, lz = 11.4, facing East +X)
  const musicWallArtGroup = new THREE.Group();
  musicWallArtGroup.position.set(-15.32, 2.85, 11.4);
  musicWallArtGroup.rotation.y = Math.PI / 2;
  const musicArtFrame = new THREE.Mesh(romanticArtFrameGeo, champagneGoldFiligreeMat);
  musicArtFrame.position.z = -0.025;
  const musicArtCanvas = new THREE.Mesh(romanticArtPlaneGeo, romanticNeonMat);
  musicArtCanvas.position.z = 0.012;
  musicWallArtGroup.add(musicArtFrame, musicArtCanvas);
  musicGroup.add(musicWallArtGroup);

  // Glossy Pearl-White & Gold Baby Grand Piano with Gold Harp Frame & Propped Lid
  const pianoBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.25, 1.25, 0.36, 24));
  pianoBodyGeo.scale(1.0, 1.0, 1.25);
  pianoBodyGeo.translate(0, 1.05, 0);
  const pianoLidGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.22, 1.22, 0.045, 24));
  pianoLidGeo.scale(1.0, 1.0, 1.22);
  const pianoLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.04, 0.72, 10));
  pianoLegGeo.translate(0, 0.61, 0);

  const pianoGroup = new THREE.Group();
  pianoGroup.position.set(pianoX, 0, pianoZ);
  const pianoBody = new THREE.Mesh(pianoBodyGeo, mats.pearlWhite);
  const pianoRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.26, 0.042, 8, 24)).rotateX(Math.PI / 2).scale(1.0, 1.25, 1.0).translate(0, 1.05, 0),
    mats.champagneGold,
  );

  // Interior Gold Harp Frame & Soundboard inside the open grand piano
  const goldHarpPlate = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.12, 1.12, 0.03, 20)).scale(1.0, 1.0, 1.18).translate(0, 1.23, 0.05),
    mats.champagneGold,
  );
  const harpBarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 1.65, 6)).rotateX(Math.PI / 2);
  [-0.42, -0.14, 0.14, 0.42].forEach((hx, idx) => {
    const harpBar = new THREE.Mesh(harpBarGeo, mats.telescopeBrass);
    harpBar.position.set(hx, 1.255, 0.05);
    harpBar.rotation.y = (idx - 1.5) * 0.08;
    pianoGroup.add(harpBar);
  });

  // Propped Glossy White-and-Gold Lid & Prop Stick
  const pianoLid = new THREE.Mesh(pianoLidGeo, mats.pearlWhite);
  pianoLid.position.set(-0.18, 1.54, 0);
  pianoLid.rotation.z = 0.44;
  const pianoLidGoldTrim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.22, 0.022, 8, 24)).rotateX(Math.PI / 2).scale(1.0, 1.22, 1.0),
    mats.champagneGold,
  );
  pianoLid.add(pianoLidGoldTrim);
  const lidPropRod = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 8)).translate(0.55, 1.44, -0.35),
    mats.champagneGold,
  );
  lidPropRod.rotation.z = -0.22;

  [
    [-0.75, -0.85],
    [0.75, -0.85],
    [0.0, 0.95],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(pianoLegGeo, mats.champagneGold);
    leg.position.set(lx, 0, lz);
    pianoGroup.add(leg);
  });
  pianoGroup.add(pianoBody, pianoRim, goldHarpPlate, pianoLid, lidPropRod);

  // 8 Playable Keys mapped to C Natural Minor / Eb Major Scale for "En Kadhale" (C4, D4, Eb4, F4, G4, Ab4, Bb4, C5)
  // Geometry translated forward so rotating X by +0.05 rad physically depresses the front of the key downward
  const PIANO_KEY_DEFS = [
    { code: 'KeyA', label: 'A', note: 'C4', freq: 261.63 },
    { code: 'KeyS', label: 'S', note: 'D4', freq: 293.66 },
    { code: 'KeyD', label: 'D', note: 'Eb4', freq: 311.13 },
    { code: 'KeyF', label: 'F', note: 'F4', freq: 349.23 },
    { code: 'KeyG', label: 'G', note: 'G4', freq: 392.0 },
    { code: 'KeyH', label: 'H', note: 'Ab4', freq: 415.3 },
    { code: 'KeyJ', label: 'J', note: 'Bb4', freq: 466.16 },
    { code: 'KeyK', label: 'K', note: 'C5', freq: 523.25 },
  ] as const;

  const whiteKeyGeo = tracker.trackGeo(new THREE.BoxGeometry(0.115, 0.042, 0.32));
  whiteKeyGeo.translate(0, 0, -0.14); // Pivot at rear of key bed so rotation.x = +0.05 depresses key front
  const blackKeyGeo = tracker.trackGeo(new THREE.BoxGeometry(0.068, 0.055, 0.19));
  blackKeyGeo.translate(0, 0.02, -0.08);

  const pianoKeyMeshes: THREE.Mesh[] = [];
  const pianoKeyDepressTimers = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let k = 0; k < 8; k++) {
    const keyMesh = new THREE.Mesh(whiteKeyGeo, mats.pearlWhite);
    keyMesh.position.set(-0.455 + k * 0.13, 1.05, -1.16);
    dynamicObjects.add(keyMesh);
    pianoKeyMeshes.push(keyMesh);
    pianoGroup.add(keyMesh);
  }

  // 5 Ebony/Gold Black Sharp/Flat Keys
  [0, 1, 3, 4, 5].forEach((wkIdx) => {
    const bKey = new THREE.Mesh(blackKeyGeo, vinylBlackMat);
    bKey.position.set(-0.455 + (wkIdx + 0.5) * 0.13, 1.06, -1.16);
    pianoGroup.add(bKey);
  });

  // Tufted Velvet & Gold Piano Bench
  const benchMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.05, 0.46, 0.45)).translate(0, 0.48, -1.95),
    blushQuiltedVelvet,
  );
  pianoGroup.add(benchMesh);
  musicGroup.add(pianoGroup);
  colliders.push({ x: originX + pianoX, z: originZ + pianoZ, radius: 1.45 });

  // ==========================================================================
  // PLAYABLE HEART-CUTOUT ACOUSTIC GUITAR ("THULI THULI") & VISUAL GUIDE (lx = -10.6, lz = 11.4)
  // ==========================================================================
  const guitarStandX = -10.6;
  const guitarStandZ = 11.4;

  const GUITAR_NOTE_DEFS = [
    {
      keyLabel: 'A',
      noteName: 'Am Strum',
      freq: 220.0,
      bassFreq: 110.0, // A2 Root
      chordFreqs: [220.0, 261.63, 329.63, 440.0, 659.25], // Am Acoustic Voicing
      colorHex: '#fb7185',
      laneX: -0.24,
      palmMute: false,
    },
    {
      keyLabel: 'S',
      noteName: 'G Strum',
      freq: 196.0,
      bassFreq: 98.0, // G2 Root
      chordFreqs: [196.0, 246.94, 293.66, 392.0, 587.33], // G Major Acoustic Voicing
      colorHex: '#fbbf24',
      laneX: -0.12,
      palmMute: false,
    },
    {
      keyLabel: 'D',
      noteName: 'FMaj7',
      freq: 174.61,
      bassFreq: 87.31, // F2 Root
      chordFreqs: [174.61, 220.0, 261.63, 329.63, 523.25], // FMaj7 Acoustic Voicing
      colorHex: '#fde047',
      laneX: 0.0,
      palmMute: false,
    },
    {
      keyLabel: 'F',
      noteName: 'E7 Strum',
      freq: 164.81,
      bassFreq: 82.41, // E2 Root
      chordFreqs: [164.81, 246.94, 293.66, 329.63, 493.88], // E7 Turnaround Voicing
      colorHex: '#34d399',
      laneX: 0.12,
      palmMute: false,
    },
    {
      keyLabel: 'G',
      noteName: 'Lead E5',
      freq: 659.25,
      bassFreq: 110.0, // A2 Root
      chordFreqs: [220.0, 329.63, 659.25], // Plucked Lead E5 + Warm Am Harmonic Support
      colorHex: '#38bdf8',
      laneX: 0.24,
      palmMute: false,
    },
  ] as const;

  // Velvet & Gold Guitar Stand at base (lx = -10.6, lz = 11.4, facing +Z for straight front-facing camera)
  const guitarStandBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.34, 0.4, 0.09, 18)).translate(guitarStandX, 0.31, guitarStandZ),
    blushQuiltedVelvet,
  );
  const guitarStandGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.36, 0.022, 8, 20)).rotateX(Math.PI / 2).translate(guitarStandX, 0.35, guitarStandZ),
    mats.champagneGold,
  );
  const guitarStandCradle = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.03, 0.035, 0.65, 8)).translate(guitarStandX, 0.62, guitarStandZ - 0.06),
    mats.champagneGold,
  );
  musicGroup.add(guitarStandBase, guitarStandGoldRim, guitarStandCradle);

  const guitarPivot = new THREE.Group();
  guitarPivot.position.set(guitarStandX, 0.92, guitarStandZ);
  dynamicObjects.add(guitarPivot);

  const guitarBodyLower = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 20)).rotateX(Math.PI / 2),
    barbieRoseLacquer,
  );
  const guitarBodyUpper = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.095, 18)).rotateX(Math.PI / 2).translate(0, 0.22, 0),
    barbieRoseLacquer,
  );
  const guitarGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.28, 0.014, 8, 24)).translate(0, 0, 0.05),
    mats.champagneGold,
  );
  const soundholeDarkMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#1e1018') }),
  );
  // Heart-Cutout Acoustic Soundhole (two upper lobes + lower tip + gold heart rosette)
  const guitarSoundhole = new THREE.Mesh(
    tracker.trackGeo(new THREE.CircleGeometry(0.086, 18)).translate(0, 0.11, 0.052),
    soundholeDarkMat,
  );
  const heartCutoutLeft = new THREE.Mesh(
    tracker.trackGeo(new THREE.CircleGeometry(0.054, 14)).translate(-0.038, 0.135, 0.053),
    soundholeDarkMat,
  );
  const heartCutoutRight = new THREE.Mesh(
    tracker.trackGeo(new THREE.CircleGeometry(0.054, 14)).translate(0.038, 0.135, 0.053),
    soundholeDarkMat,
  );
  const guitarRosette = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.096, 0.011, 8, 20)).translate(0, 0.11, 0.054),
    mats.champagneGold,
  );
  const guitarBridge = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.032, 0.022)).translate(0, -0.08, 0.055),
    mats.champagneGold,
  );
  const guitarNeck = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.078, 0.68, 0.04)).translate(0, 0.52, 0.01),
    mats.champagneGold,
  );
  const guitarHeadstock = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.095, 0.16, 0.035)).translate(0, 0.9, 0.005),
    barbieRoseLacquer,
  );

  // 6 Gold Tuning Pegs along left & right edges of the headstock
  const tuningPegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.045, 6)).rotateZ(Math.PI / 2);
  [-1, 1].forEach((side) => {
    [0.85, 0.9, 0.95].forEach((py) => {
      const peg = new THREE.Mesh(tuningPegGeo, mats.champagneGold);
      peg.position.set(side * 0.062, py, 0.005);
      guitarPivot.add(peg);
    });
  });

  guitarPivot.add(
    guitarBodyLower,
    guitarBodyUpper,
    guitarGoldRim,
    guitarSoundhole,
    heartCutoutLeft,
    heartCutoutRight,
    guitarRosette,
    guitarBridge,
    guitarNeck,
    guitarHeadstock,
  );

  // 5 Individual Vibrating & Golden-Pink Light-Pulsing Steel/Silk Guitar Strings
  const guitarStringGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.0038, 0.0038, 0.92, 6));
  const guitarStringMeshes: THREE.Mesh[] = [];
  const guitarStringMats: THREE.MeshStandardMaterial[] = [];
  const guitarStringBaseX: number[] = [];

  for (let s = 0; s < 5; s++) {
    const sx = (s - 2) * 0.014;
    guitarStringBaseX.push(sx);
    const sMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef08a'),
        emissive: new THREE.Color(GUITAR_NOTE_DEFS[s].colorHex),
        emissiveIntensity: 0.2,
        roughness: 0.18,
        metalness: 0.88,
      }),
    );
    const sMesh = new THREE.Mesh(guitarStringGeo, sMat);
    sMesh.position.set(sx, 0.38, 0.058);
    dynamicObjects.add(sMesh);
    guitarStringMeshes.push(sMesh);
    guitarStringMats.push(sMat);
    guitarPivot.add(sMesh);
  }
  musicGroup.add(guitarPivot);

  // ==========================================================================
  // HOLOGRAPHIC FRETBOARD GUIDELINE DISPLAY & SLIDING NOTE CUES ("THULI THULI")
  // ==========================================================================
  const guitarGuideGroup = new THREE.Group();
  // Positioned cleanly to the left of Harsha & the guitar, facing straight (+Z) toward the centered portrait camera
  guitarGuideGroup.position.set(guitarStandX - 0.78, 1.3, guitarStandZ + 0.04);
  guitarGuideGroup.rotation.y = 0.0;
  guitarGuideGroup.visible = false;
  dynamicObjects.add(guitarGuideGroup);

  const guideBoardCanvas = document.createElement('canvas');
  guideBoardCanvas.width = 512;
  guideBoardCanvas.height = 512;
  const gbCtx = guideBoardCanvas.getContext('2d');
  if (gbCtx) {
    // Translucent royal rose-velvet glass backdrop
    const grad = gbCtx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(24, 12, 32, 0.92)');
    grad.addColorStop(0.5, 'rgba(42, 16, 48, 0.86)');
    grad.addColorStop(1, 'rgba(24, 12, 32, 0.94)');
    gbCtx.fillStyle = grad;
    gbCtx.fillRect(0, 0, 512, 512);

    // Outer Gold Filigree Border
    gbCtx.strokeStyle = '#fde047';
    gbCtx.lineWidth = 6;
    gbCtx.strokeRect(10, 10, 492, 492);
    gbCtx.strokeStyle = 'rgba(244, 114, 182, 0.65)';
    gbCtx.lineWidth = 2;
    gbCtx.strokeRect(20, 20, 472, 472);

    // Header Title
    gbCtx.textAlign = 'center';
    gbCtx.fillStyle = '#fde047';
    gbCtx.font = 'bold 20px Georgia, serif';
    gbCtx.fillText('♥ "THULI THULI" ACOUSTIC GUITAR ♥', 256, 52);

    gbCtx.fillStyle = '#fbcfe8';
    gbCtx.font = '14px sans-serif';
    gbCtx.fillText('[A/S/D/F] Chords • [G/H/J/K] Lead Melody E5-D5-C5-A4', 256, 80);

    // 5 Fretboard Lane Dividers & Bottom Key Badges
    const laneCenters = [88, 172, 256, 340, 424];
    const laneColors = ['#fb7185', '#fbbf24', '#fde047', '#34d399', '#38bdf8'];
    const laneKeys = ['[A]', '[S]', '[D]', '[F]', '[G-K]'];
    const laneNotes = ['Am', 'G', 'FMaj7', 'E7', 'Lead'];

    // Horizontal Fret Lines
    gbCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    gbCtx.lineWidth = 1.5;
    for (let fy = 135; fy <= 345; fy += 52) {
      gbCtx.beginPath();
      gbCtx.moveTo(48, fy);
      gbCtx.lineTo(464, fy);
      gbCtx.stroke();
    }

    // Golden Plucking Line at y = 376
    gbCtx.strokeStyle = '#fde047';
    gbCtx.lineWidth = 5;
    gbCtx.beginPath();
    gbCtx.moveTo(44, 376);
    gbCtx.lineTo(468, 376);
    gbCtx.stroke();

    laneCenters.forEach((cx, idx) => {
      // Vertical String Line
      gbCtx.strokeStyle = laneColors[idx];
      gbCtx.lineWidth = 3;
      gbCtx.beginPath();
      gbCtx.moveTo(cx, 102);
      gbCtx.lineTo(cx, 376);
      gbCtx.stroke();

      // Key & Strum Label Badge below Plucking Line
      gbCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      gbCtx.fillRect(cx - 34, 392, 68, 56);
      gbCtx.strokeStyle = laneColors[idx];
      gbCtx.lineWidth = 2.5;
      gbCtx.strokeRect(cx - 34, 392, 68, 56);

      gbCtx.fillStyle = '#ffffff';
      gbCtx.font = 'bold 17px monospace';
      gbCtx.fillText(laneKeys[idx], cx, 416);
      gbCtx.fillStyle = laneColors[idx];
      gbCtx.font = 'bold 14px sans-serif';
      gbCtx.fillText(laneNotes[idx], cx, 439);
    });

    // Bottom Helper Footer
    gbCtx.fillStyle = '#fde68a';
    gbCtx.font = 'italic 14px Georgia, serif';
    gbCtx.fillText('Press [Space] to Play "Thuli Thuli" (Paiyaa)  •  [Esc] Exit', 256, 480);
  }

  const guideBoardTex = tracker.trackTex(new THREE.CanvasTexture(guideBoardCanvas));
  guideBoardTex.colorSpace = THREE.SRGBColorSpace;
  const guideBoardMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: guideBoardTex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  const guideBoardMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(0.76, 0.76)),
    guideBoardMat,
  );
  const guideBoardFrame = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.8, 0.8, 0.02)).translate(0, 0, -0.015),
    mats.champagneGold,
  );
  guitarGuideGroup.add(guideBoardFrame, guideBoardMesh);

  // 5 Plucking Line Target Rings (at y = -0.18 on the 0.76x0.76 board)
  const pluckTargetRingGeo = tracker.trackGeo(new THREE.RingGeometry(0.022, 0.038, 16));
  const pluckTargetRingMeshes: THREE.Mesh[] = [];
  const pluckTargetRingMats: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < 5; i++) {
    const rMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(GUITAR_NOTE_DEFS[i].colorHex),
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      }),
    );
    const rMesh = new THREE.Mesh(pluckTargetRingGeo, rMat);
    rMesh.position.set(GUITAR_NOTE_DEFS[i].laneX, -0.175, 0.008);
    dynamicObjects.add(rMesh);
    pluckTargetRingMeshes.push(rMesh);
    pluckTargetRingMats.push(rMat);
    guitarGuideGroup.add(rMesh);
  }

  // Pool of 10 Sliding Glowing Note Cues that slide down the 5 fretboard lanes from y = +0.21 to y = -0.175
  interface SlidingGuitarCue {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    stringIndex: number;
    progress: number; // 0.0 (top of fretboard) -> 1.0 (plucking line)
    speed: number;
    autoPluck: boolean;
    plucked: boolean;
  }
  const slidingCueGeo = tracker.trackGeo(new THREE.SphereGeometry(0.026, 12, 12));
  slidingCueGeo.scale(1.2, 0.85, 0.45);
  const slidingGuitarCues: SlidingGuitarCue[] = [];

  for (let c = 0; c < 10; c++) {
    const cMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#fde047'),
        transparent: true,
        opacity: 0.95,
      }),
    );
    const cMesh = new THREE.Mesh(slidingCueGeo, cMat);
    cMesh.visible = false;
    dynamicObjects.add(cMesh);
    guitarGuideGroup.add(cMesh);
    slidingGuitarCues.push({
      mesh: cMesh,
      mat: cMat,
      active: false,
      stringIndex: 0,
      progress: 0,
      speed: 0.65,
      autoPluck: false,
      plucked: false,
    });
  }
  musicGroup.add(guitarGuideGroup);

  // ==========================================================================
  // CRYSTALLINE GOLDEN MUSICAL NOTES & HEART SPARKS ('♪', '♫', '♥')
  // ==========================================================================
  const createSymbolSpriteTex = (symbol: string, primaryColor: string): THREE.CanvasTexture => {
    const cvs = document.createElement('canvas');
    cvs.width = 128;
    cvs.height = 128;
    const c = cvs.getContext('2d');
    if (c) {
      c.clearRect(0, 0, 128, 128);
      const glow = c.createRadialGradient(64, 64, 6, 64, 64, 56);
      glow.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
      glow.addColorStop(0.55, 'rgba(251, 113, 133, 0.32)');
      glow.addColorStop(1, 'rgba(251, 113, 133, 0.0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, 128, 128);

      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = 'bold 74px Georgia, serif';
      c.fillStyle = primaryColor;
      c.fillText(symbol, 64, 66);
    }
    const tex = tracker.trackTex(new THREE.CanvasTexture(cvs));
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const noteSymbolTex = createSymbolSpriteTex('♪', '#fde047');
  const doubleBeamNoteTex = createSymbolSpriteTex('♫', '#fef08a');
  const heartSymbolTex = createSymbolSpriteTex('♥', '#fb7185');
  const soundholeSymbolGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.19, 0.19));

  interface SoundholePopParticle {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    age: number;
    maxAge: number;
    vx: number;
    vy: number;
    vz: number;
  }
  const soundholePopParticles: SoundholePopParticle[] = [];

  for (let p = 0; p < 18; p++) {
    const texChoice = p % 3 === 0 ? noteSymbolTex : p % 3 === 1 ? doubleBeamNoteTex : heartSymbolTex;
    const pMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: texChoice,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const pMesh = new THREE.Mesh(soundholeSymbolGeo, pMat);
    pMesh.visible = false;
    dynamicObjects.add(pMesh);
    musicGroup.add(pMesh);
    soundholePopParticles.push({
      mesh: pMesh,
      mat: pMat,
      active: false,
      age: 0,
      maxAge: 1.45,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  }

  // Vintage Brass Microphone on Curved Stage Corner (lx = -13.4, lz = 13.2)
  const stagePlatform = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.65, 1.75, 0.22, 20)).translate(-13.4, 0.36, 13.2),
    mats.blushRoseMarble,
  );
  const micStand = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 1.45, 8)).translate(-13.4, 1.18, 13.2),
    mats.champagneGold,
  );
  const micHead = new THREE.Mesh(
    tracker.trackGeo(new THREE.SphereGeometry(0.075, 10, 10)).translate(-13.4, 1.94, 13.2),
    mats.telescopeBrass,
  );
  musicGroup.add(stagePlatform, micStand, micHead);

  // Floating Musical Note Orbs (shared by Piano & Record Player)
  const noteOrbGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.075, 0));
  const floatingNoteMeshes: THREE.Mesh[] = [];
  for (let n = 0; n < 8; n++) {
    const nm = new THREE.Mesh(noteOrbGeo, goldNoteParticleMat);
    nm.visible = false;
    dynamicObjects.add(nm);
    floatingNoteMeshes.push(nm);
    musicGroup.add(nm);
  }

  floor1RoomsGroup.add(musicGroup);

  // ==========================================================================
  // ROOM F: INDOOR GLASS CONSERVATORY (East-Rear: lx +9.2..+15.2, lz +7.8..+15.2)
  // ==========================================================================
  const conservatoryGroup = new THREE.Group();
  const orchidTableX = 12.0;
  const orchidTableZ = 11.4;

  // Arched Crystal-Glass Trellis Ribs framing the Conservatory (strictly >= 9.2m)
  const trellisArchGeo = tracker.trackGeo(new THREE.TorusGeometry(2.65, 0.065, 8, 24, Math.PI));
  [9.0, 11.4, 13.8].forEach((tz) => {
    const arch = new THREE.Mesh(trellisArchGeo, mats.champagneGold);
    arch.position.set(orchidTableX, 0.25, tz);
    conservatoryGroup.add(arch);
  });

  // Sculpted Starlight Orchid Table (lx = 12.0, lz = 11.4 — smooth marble top, no physical flower model)
  const orchidTableGroup = new THREE.Group();
  orchidTableGroup.position.set(orchidTableX, 0.25, orchidTableZ);

  const otPedestal = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.26, 0.44, 0.72, 16)).translate(0, 0.36, 0),
    mats.pearlWhite,
  );
  const otGoldCollar = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.32, 0.035, 8, 20)).rotateX(Math.PI / 2).translate(0, 0.68, 0),
    mats.champagneGold,
  );
  const otTabletop = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.92, 0.84, 0.08, 24)).translate(0, 0.74, 0),
    mats.blushRoseMarble,
  );
  const otGoldRim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(0.92, 0.032, 8, 28)).rotateX(Math.PI / 2).translate(0, 0.75, 0),
    mats.champagneGold,
  );
  orchidTableGroup.add(otPedestal, otGoldCollar, otTabletop, otGoldRim);

  // Static Flat Table-Top Engraved Gold-and-Pink Surface Inscription: "I Love u Mandu 💕"
  // Rests flat directly on top of the table surface (y = 0.785m) and is displayed ONLY while interaction is active
  const orchidLoveCanvas = document.createElement('canvas');
  orchidLoveCanvas.width = 1024;
  orchidLoveCanvas.height = 512;
  const olCtx = orchidLoveCanvas.getContext('2d');
  if (olCtx) {
    olCtx.clearRect(0, 0, 1024, 512);

    // Carved rose-marble & brushed champagne-gold plaque surface
    const plaqueGrad = olCtx.createLinearGradient(0, 0, 1024, 512);
    plaqueGrad.addColorStop(0, 'rgba(131, 24, 67, 0.94)');
    plaqueGrad.addColorStop(0.5, 'rgba(157, 23, 77, 0.92)');
    plaqueGrad.addColorStop(1, 'rgba(112, 26, 117, 0.94)');
    olCtx.fillStyle = plaqueGrad;
    olCtx.fillRect(32, 32, 960, 448);

    // Engraved double gold-leaf & crystal-pink inlay border
    olCtx.strokeStyle = '#fde047';
    olCtx.lineWidth = 8;
    olCtx.strokeRect(44, 44, 936, 424);
    olCtx.strokeStyle = '#f9a8d4';
    olCtx.lineWidth = 3;
    olCtx.strokeRect(62, 62, 900, 388);

    // Subtle engraved header & footer flourishes
    olCtx.textAlign = 'center';
    olCtx.textBaseline = 'middle';
    olCtx.font = 'bold 24px Georgia, serif';
    olCtx.fillStyle = '#fde68a';
    olCtx.fillText('✦ YESHWANTH TO HARSHA ✦', 512, 132);

    // Main Crisp Carved Gold-and-Pink Table Surface Inscription: "I Love u Mandu 💕"
    olCtx.save();
    olCtx.shadowColor = 'rgba(244, 114, 182, 0.85)';
    olCtx.shadowBlur = 16;
    const textGrad = olCtx.createLinearGradient(180, 210, 844, 310);
    textGrad.addColorStop(0, '#fef08a');
    textGrad.addColorStop(0.5, '#fbcfe8');
    textGrad.addColorStop(1, '#f472b6');
    olCtx.fillStyle = textGrad;
    olCtx.font = 'italic bold 82px Georgia, serif';
    olCtx.fillText('I Love u Mandu 💕', 512, 264);
    olCtx.restore();

    olCtx.font = 'italic 22px Georgia, serif';
    olCtx.fillStyle = '#fbcfe8';
    olCtx.fillText('Forever Engraved in Our Dream World ♡', 512, 384);
  }

  const orchidLoveTex = tracker.trackTex(new THREE.CanvasTexture(orchidLoveCanvas));
  orchidLoveTex.colorSpace = THREE.SRGBColorSpace;
  const orchidLovePlaqueMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: orchidLoveTex,
      transparent: true,
      opacity: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );

  const orchidTableInscriptionGroup = new THREE.Group();
  // Resting flat directly on the table top surface (otTabletop top is at y = 0.78m)
  orchidTableInscriptionGroup.position.set(0, 0.784, 0);
  orchidTableInscriptionGroup.visible = false;
  dynamicObjects.add(orchidTableInscriptionGroup);

  const orchidTablePlaqueMesh = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(1.18, 0.59)).rotateX(-Math.PI / 2),
    orchidLovePlaqueMat,
  );
  // Thin gold inlay frame strips resting flat on the table surface
  const plaqueGoldFrameN = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.14, 0.012, 0.02)).translate(0, 0.004, -0.275),
    mats.champagneGold,
  );
  const plaqueGoldFrameS = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(1.14, 0.012, 0.02)).translate(0, 0.004, 0.275),
    mats.champagneGold,
  );
  orchidTableInscriptionGroup.add(orchidTablePlaqueMesh, plaqueGoldFrameN, plaqueGoldFrameS);
  orchidTableGroup.add(orchidTableInscriptionGroup);

  conservatoryGroup.add(orchidTableGroup);
  colliders.push({ x: originX + orchidTableX, z: originZ + orchidTableZ, radius: 0.92 });

  // Perimeter Corner Star-Lily Planters ONLY along far South/East walls (leaving all doorways & corridors 100% clear)
  interface ReactiveConservatoryPlant {
    group: THREE.Group;
    petalGroup: THREE.Group;
    glowMat: THREE.MeshStandardMaterial;
    lx: number;
    lz: number;
    openRatio: number;
  }
  const reactivePlants: ReactiveConservatoryPlant[] = [];
  const planterPotGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.38, 0.28, 0.44, 12));
  planterPotGeo.translate(0, 0.22, 0);
  const stemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.64, 8));
  stemGeo.translate(0, 0.62, 0);
  const orchidPetalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.18, 0.44, 6));
  orchidPetalGeo.translate(0, 0.22, 0);

  const plantCoords = [
    { lx: 14.5, lz: 11.4, yBase: 0.25 },
    { lx: 10.0, lz: 14.3, yBase: 0.25 },
    { lx: 12.0, lz: 14.3, yBase: 0.25 },
    { lx: 14.4, lz: 14.3, yBase: 0.25 },
  ];

  plantCoords.forEach((pc, idx) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(pc.lx, pc.yBase, pc.lz);

    const pot = new THREE.Mesh(planterPotGeo, mats.champagneGold);
    const stem = new THREE.Mesh(stemGeo, mintPastelEnamel);
    pGroup.add(pot, stem);

    const glowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(idx % 2 === 0 ? '#f472b6' : '#67e8f9'),
        emissive: new THREE.Color(idx % 2 === 0 ? '#db2777' : '#0891b2'),
        emissiveIntensity: 0.24,
        roughness: 0.26,
      }),
    );

    const petalGroup = new THREE.Group();
    petalGroup.position.set(0, 0.94, 0);
    dynamicObjects.add(petalGroup);

    for (let p = 0; p < 6; p++) {
      const ang = (p * Math.PI * 2) / 6;
      const petal = new THREE.Mesh(orchidPetalGeo, glowMat);
      petal.rotation.y = ang;
      petal.rotation.z = 0.55;
      petalGroup.add(petal);
    }

    pGroup.add(petalGroup);
    conservatoryGroup.add(pGroup);
    reactivePlants.push({
      group: pGroup,
      petalGroup,
      glowMat,
      lx: pc.lx,
      lz: pc.lz,
      openRatio: 0.0,
    });
  });

  floor1RoomsGroup.add(conservatoryGroup);

  // Lock all static furniture and partition matrices for 60 FPS performance
  lockStaticHierarchy(floor1RoomsGroup, dynamicObjects);

  // ==========================================================================
  // AUDIO SYNTHESIS, CUSTOM MP4/MP3 LOADER & INTERACTION STATE MACHINE
  // ==========================================================================
  let audioCtx: AudioContext | null = null;
  let guitarPluckNoiseBuffer: AudioBuffer | null = null;

  /**
   * Binds an HTML5 media element (`<video>` / `<audio>`) to custom uploaded `.mp4` or `.mp3` tracks
   * in `/public/assets/audio/` (e.g., `/assets/audio/en-kadhale.mp4` and `/assets/audio/thuli-thuli.mp4`).
   * Gracefully falls back to synthesized procedural Web Audio notes if the custom media files
   * have not been placed in `public/assets/audio/` yet.
   */
  interface CustomInstrumentTrack {
    isPlaying: () => boolean;
    playFromStartWithFade: () => Promise<boolean>;
    togglePlayPauseWithFade: () => Promise<boolean>;
    updateFade: (delta: number) => void;
    stop: () => void;
  }

  const createCustomInstrumentTrack = (candidateUrls: readonly string[]): CustomInstrumentTrack => {
    let mediaEl: HTMLVideoElement | null = null;
    let resolvedUrl: string | null = null;
    let probeInFlight: Promise<boolean> | null = null;
    let currentlyPlaying = false;
    let fadeElapsed = 0.0;
    const FADE_DURATION = 1.5; // 1.5s gradual volume ramp from 0.0 -> 1.0

    const probeAvailableFile = (): Promise<boolean> => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.resolve(false);
      }
      if (resolvedUrl && mediaEl) {
        return Promise.resolve(true);
      }
      if (probeInFlight) {
        return probeInFlight;
      }

      probeInFlight = (async () => {
        for (const url of candidateUrls) {
          try {
            const res = await fetch(url, { method: 'HEAD' });
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            // Ensure Vite SPA fallback didn't return index.html for a not-yet-uploaded file
            if (res.ok && !contentType.includes('text/html')) {
              const v = document.createElement('video');
              v.src = url;
              v.preload = 'auto';
              v.loop = true;
              v.playsInline = true;
              v.volume = 0.0;
              v.addEventListener('ended', () => {
                currentlyPlaying = false;
              });
              v.addEventListener('pause', () => {
                currentlyPlaying = false;
              });
              v.addEventListener('play', () => {
                currentlyPlaying = true;
              });
              mediaEl = v;
              resolvedUrl = url;
              probeInFlight = null;
              return true;
            }
          } catch {
            // Try next candidate extension
          }
        }
        probeInFlight = null;
        return false;
      })();

      return probeInFlight;
    };

    // Kick off non-blocking initial check on creation
    void probeAvailableFile();

    return {
      isPlaying: () => Boolean(mediaEl && currentlyPlaying && !mediaEl.paused),
      playFromStartWithFade: async () => {
        const ok = await probeAvailableFile();
        if (!ok || !mediaEl) return false;
        try {
          fadeElapsed = 0.0;
          mediaEl.volume = 0.0;
          mediaEl.currentTime = 0;
          await mediaEl.play();
          currentlyPlaying = true;
          return true;
        } catch {
          currentlyPlaying = false;
          return false;
        }
      },
      togglePlayPauseWithFade: async () => {
        const ok = await probeAvailableFile();
        if (!ok || !mediaEl) return false;
        try {
          if (mediaEl.paused) {
            fadeElapsed = 0.0;
            mediaEl.volume = 0.0;
            await mediaEl.play();
            currentlyPlaying = true;
          } else {
            mediaEl.pause();
            currentlyPlaying = false;
          }
          return true;
        } catch {
          currentlyPlaying = false;
          return false;
        }
      },
      updateFade: (delta: number) => {
        if (mediaEl && currentlyPlaying && !mediaEl.paused) {
          fadeElapsed = Math.min(FADE_DURATION, fadeElapsed + delta);
          mediaEl.volume = THREE.MathUtils.clamp(fadeElapsed / FADE_DURATION, 0.0, 1.0);
        }
      },
      stop: () => {
        if (mediaEl) {
          try {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.volume = 0.0;
          } catch {
            // Ignore
          }
        }
        fadeElapsed = 0.0;
        currentlyPlaying = false;
      },
    };
  };

  const pianoCustomTrack = createCustomInstrumentTrack([
    '/assets/audio/en-kadhale.mp4',
    '/assets/audio/en-kadhale.mp3',
  ]);
  const guitarCustomTrack = createCustomInstrumentTrack([
    '/assets/audio/thuli-thuli.mp4',
    '/assets/audio/thuli-thuli.mp3',
  ]);
  const recordCustomTrack = createCustomInstrumentTrack([
    RECORD_PLAYER_SONG,
    '/assets/audio/records/barbie-song.mp4',
    '/assets/audio/barbie-song.mp3',
    '/assets/audio/barbie-song.mp4',
  ]);

  const ensureAudio = (): AudioContext | null => {
    if (!audioCtx && typeof window !== 'undefined') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Pre-generate short Karplus-Strong acoustic guitar pick noise transient buffer once
    if (audioCtx && !guitarPluckNoiseBuffer) {
      const sampleRate = audioCtx.sampleRate;
      const len = Math.floor(sampleRate * 0.028);
      guitarPluckNoiseBuffer = audioCtx.createBuffer(1, len, sampleRate);
      const data = guitarPluckNoiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1.0 - i / len, 2.2);
        data[i] = (Math.random() * 2.0 - 1.0) * env;
      }
    }
    return audioCtx;
  };

  const playArpeggioNotes = (freqs: number[], spacing = 0.14, gainPeak = 0.055, wave: OscillatorType = 'sine') => {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      freqs.forEach((f, idx) => {
        const start = now + idx * spacing;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(gainPeak, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.9);
      });
    } catch {
      // Fallback
    }
  };

  // Interactive State Variables
  let activeCameraMode: Floor1ActiveCameraMode = 'none';
  let cameraBlendAlpha = 0.0;
  let coutureInspectRotation = 0.0;
  let coutureSpotlightIndex = 0;

  // Velvet Sofa First-Person Seated Camera & Relax Lounge State Machine
  let relaxLoungeState: RelaxLoungeState = 'RELAX_LOUNGE_IDLE';
  let sofaHeadYaw = -Math.PI / 2; // Facing -X toward Fireplace by default
  let sofaHeadPitch = 0.04; // Clamped between -55° (-0.96 rad) and +65° (+1.13 rad)

  let isFridgeOpen = false;
  let fridgeOpenRatio = 0.0;

  let isOvenOpen = false;
  let ovenOpenRatio = 0.0;

  let blenderActiveTimer = 0.0;
  let kettleChiming = false;

  let isRecordPlaying = false;
  let isRecordPaused = false;
  let recordLidOpenRatio = 0.0;
  let recordTonearmRatio = 0.0;
  let recordSongProgress = 0.0;
  let recordFadeElapsed = 0.0;
  let recordMelodyTimer = 0.0;
  let recordWaltzStepIdx = 0;

  // Vintage Barbie Music-Box / Celesta Waltz Sequencer (used when custom barbie-song.mp3 is not uploaded yet)
  const BARBIE_VINTAGE_WALTZ_STEPS: ReadonlyArray<{
    freqs: readonly number[];
    delay: number;
  }> = [
    { freqs: [261.63, 523.25, 659.25], delay: 0.48 }, // C4 + C5 + E5
    { freqs: [392.0, 587.33], delay: 0.42 }, // G4 + D5
    { freqs: [329.63, 659.25, 783.99], delay: 0.48 }, // E4 + E5 + G5
    { freqs: [293.66, 587.33, 880.0], delay: 0.52 }, // D4 + D5 + A5
    { freqs: [220.0, 523.25, 783.99], delay: 0.46 }, // A3 + C5 + G5
    { freqs: [329.63, 659.25], delay: 0.42 }, // E4 + E5
    { freqs: [261.63, 587.33, 783.99], delay: 0.48 }, // C4 + D5 + G5
    { freqs: [196.0, 493.88, 783.99], delay: 0.62 }, // G3 + B4 + G5
    { freqs: [174.61, 440.0, 698.46, 880.0], delay: 0.48 }, // F3 + A4 + F5 + A5
    { freqs: [261.63, 523.25, 783.99], delay: 0.46 }, // C4 + C5 + G5
    { freqs: [293.66, 587.33, 698.46], delay: 0.46 }, // D4 + D5 + F5
    { freqs: [261.63, 523.25, 659.25, 1046.5], delay: 0.72 }, // C Major Resolution
  ];

  const toggleVintageRecordPlayback = () => {
    if (!isRecordPlaying) {
      isRecordPlaying = true;
      isRecordPaused = false;
      recordFadeElapsed = 0.0;
      recordMelodyTimer = 0.05;
      relaxLoungeState = 'RECORD_PLAYING';
      void recordCustomTrack.playFromStartWithFade();
    } else {
      isRecordPlaying = false;
      isRecordPaused = true;
      relaxLoungeState = activeCameraMode === 'sofa_sit' ? 'RECORD_PAUSED' : 'RELAX_LOUNGE_IDLE';
      recordCustomTrack.stop();
    }
  };

  const isLookingAtRecordPlayerFromSofa = (): boolean => {
    // From sofa eye (-10.68, 0.0) to record player (-11.55, -1.65), target yaw is atan2(-0.87, -1.65) ≈ -2.655 rad
    const targetYaw = Math.atan2(recordPlayerX - -10.68, recordPlayerZ - 0.0);
    let diff = (sofaHeadYaw - targetYaw + Math.PI) % (Math.PI * 2);
    if (diff < 0) diff += Math.PI * 2;
    diff -= Math.PI;
    return Math.abs(diff) <= 0.68;
  };

  let pianoPlayTimer = 0.0;
  let pianoAutoPlayActive = false;
  let pianoAutoStepIndex = 0;
  let pianoAutoStepTimer = 0.0;
  let pianoFadeElapsed = 1.5;
  let musicPulseIntensity = 0.0;

  let guitarStrumTimer = 0.0;
  let guitarFadeElapsed = 1.5;
  let conservatoryWaveTimer = 0.0;

  // Playable Acoustic Guitar State Machine ("Thuli Thuli")
  const guitarStringTimers = [0.0, 0.0, 0.0, 0.0, 0.0];
  let guitarMelodyGuideActive = false;
  let guitarMelodyStepIndex = 0;
  let guitarMelodyStepTimer = 0.0;
  let freePlayGuideTimer = 0.0;
  let freePlayGuideStep = 0;
  let nextSoundholeParticleIdx = 0;

  // ==========================================================================
  // 7A. GRAND PIANO — "EN KADHALE" (Duet — A.R. Rahman, C Minor / Eb Major Ballad, ~76 BPM)
  // ==========================================================================
  // Key indices 0..7 map to C Natural Minor / Eb Major:
  // 0:[A]=C4(261.63), 1:[S]=D4(293.66), 2:[D]=Eb4(311.13), 3:[F]=F4(349.23),
  // 4:[G]=G4(392.00), 5:[H]=Ab4(415.30), 6:[J]=Bb4(466.16), 7:[K]=C5(523.25)
  const EN_KADHALE_MELODY_STEPS: ReadonlyArray<{
    keyIdx: number;
    freq: number;
    padFreqs?: readonly number[];
    delay: number;
    accent: number;
  }> = [
    // Phrase 1 ("En Ka-dha-le..."): G4 (0.45s) -> Ab4 (0.25s) -> G4 (0.45s) -> F4 (0.35s) -> Eb4 (0.85s)
    // Accompanied by soft left-hand C minor triad pad (C3 + G3 + Eb4)
    { keyIdx: 4, freq: 392.0, padFreqs: [130.81, 196.0, 311.13], delay: 0.45, accent: 1.05 }, // G4 [G] ("En")
    { keyIdx: 5, freq: 415.3, delay: 0.25, accent: 0.95 }, // Ab4 [H] ("Ka-")
    { keyIdx: 4, freq: 392.0, delay: 0.45, accent: 1.0 }, // G4 [G] ("-dha-")
    { keyIdx: 3, freq: 349.23, delay: 0.35, accent: 0.92 }, // F4 [F] ("-le")
    { keyIdx: 2, freq: 311.13, padFreqs: [130.81, 196.0], delay: 0.85, accent: 1.1 }, // Eb4 [D] ("...")

    // Phrase 2 ("En Ka-dha-le..."): G4 (0.45s) -> Ab4 (0.25s) -> Bb4 (0.45s) -> Ab4 (0.35s) -> G4 (0.85s)
    // Over Fm7 / G7sus4 harmony (F3 + Ab3 + C4)
    { keyIdx: 4, freq: 392.0, padFreqs: [174.61, 207.65, 261.63], delay: 0.45, accent: 1.05 }, // G4 [G] ("En")
    { keyIdx: 5, freq: 415.3, delay: 0.25, accent: 0.95 }, // Ab4 [H] ("Ka-")
    { keyIdx: 6, freq: 466.16, delay: 0.45, accent: 1.15 }, // Bb4 [J] ("-dha-")
    { keyIdx: 5, freq: 415.3, delay: 0.35, accent: 0.98 }, // Ab4 [H] ("-le")
    { keyIdx: 4, freq: 392.0, padFreqs: [196.0, 261.63, 293.66], delay: 0.85, accent: 1.12 }, // G4 [G] ("...")

    // Phrase 3 ("En-nai en-na sey-ya po-gi-rai..."):
    // C5 (0.30s) -> Bb4 (0.30s) -> Ab4 (0.35s) -> G4 (0.30s) -> F4 (0.35s) -> Eb4 (0.35s) -> D4 (0.45s) -> C4 (0.95s)
    { keyIdx: 7, freq: 523.25, padFreqs: [174.61, 261.63], delay: 0.3, accent: 1.2 }, // C5 [K] ("En-")
    { keyIdx: 6, freq: 466.16, delay: 0.3, accent: 1.05 }, // Bb4 [J] ("-nai")
    { keyIdx: 5, freq: 415.3, delay: 0.35, accent: 1.0 }, // Ab4 [H] ("en-")
    { keyIdx: 4, freq: 392.0, padFreqs: [155.56, 233.08], delay: 0.3, accent: 0.98 }, // G4 [G] ("-na")
    { keyIdx: 3, freq: 349.23, delay: 0.35, accent: 0.95 }, // F4 [F] ("sey-")
    { keyIdx: 2, freq: 311.13, delay: 0.35, accent: 0.95 }, // Eb4 [D] ("-ya")
    { keyIdx: 1, freq: 293.66, padFreqs: [196.0, 246.94], delay: 0.45, accent: 1.02 }, // D4 [S] ("po-gi-")
    { keyIdx: 0, freq: 261.63, padFreqs: [130.81, 196.0, 311.13], delay: 0.95, accent: 1.18 }, // C4 [A] ("-rai...")
  ];

  // ==========================================================================
  // 7B. ACOUSTIC GUITAR — "THULI THULI" (Paiyaa — Harris Jayaraj, A Minor / C Major Groove, ~122 BPM)
  // ==========================================================================
  interface ThuliGuitarStep {
    stringIdx: number;
    delay: number;
    leadFreq?: number;
    bassFreq?: number;
    chordFreqs?: readonly number[];
    accent?: number;
  }

  const THULI_THULI_RHYTHM_STEPS: ReadonlyArray<ThuliGuitarStep> = [
    // 1. Rhythmic Guitar Intro Groove (16th-note acoustic strumming pattern on Am -> G -> FMaj7 -> G: D - D - U - U - D - U)
    { stringIdx: 0, delay: 0.24, bassFreq: 110.0, chordFreqs: [220.0, 261.63, 329.63, 440.0], accent: 1.05 }, // Am Down
    { stringIdx: 0, delay: 0.22, chordFreqs: [261.63, 329.63, 440.0, 659.25], accent: 0.88 }, // Am Down
    { stringIdx: 1, delay: 0.16, bassFreq: 98.0, chordFreqs: [196.0, 246.94, 293.66, 392.0], accent: 0.95 }, // G Up
    { stringIdx: 1, delay: 0.16, chordFreqs: [246.94, 293.66, 392.0, 587.33], accent: 0.9 }, // G Up
    { stringIdx: 2, delay: 0.22, bassFreq: 87.31, chordFreqs: [174.61, 220.0, 261.63, 329.63], accent: 1.02 }, // FMaj7 Down
    { stringIdx: 3, delay: 0.24, bassFreq: 98.0, chordFreqs: [196.0, 246.94, 293.66, 392.0], accent: 0.96 }, // G Up

    // 2. Main Melodic Hook ("Thu-li thu-li thu-li ma-zhai van-dha-dhey..."):
    // E5 (0.22s) -> E5 (0.22s) -> D5 (0.22s) -> E5 (0.25s) -> C5 (0.30s) -> A4 (0.30s) -> G4 (0.25s) -> A4 (0.55s)
    { stringIdx: 4, delay: 0.22, leadFreq: 659.25, bassFreq: 110.0, chordFreqs: [220.0, 329.63], accent: 1.15 }, // E5 ("Thu-")
    { stringIdx: 4, delay: 0.22, leadFreq: 659.25, accent: 1.0 }, // E5 ("-li")
    { stringIdx: 4, delay: 0.22, leadFreq: 587.33, accent: 1.0 }, // D5 ("thu-")
    { stringIdx: 4, delay: 0.25, leadFreq: 659.25, bassFreq: 98.0, chordFreqs: [196.0, 293.66], accent: 1.1 }, // E5 ("-li")
    { stringIdx: 2, delay: 0.3, leadFreq: 523.25, bassFreq: 87.31, chordFreqs: [174.61, 261.63], accent: 1.08 }, // C5 ("ma-")
    { stringIdx: 0, delay: 0.3, leadFreq: 440.0, accent: 0.98 }, // A4 ("-zhai")
    { stringIdx: 1, delay: 0.25, leadFreq: 392.0, bassFreq: 98.0, accent: 0.95 }, // G4 ("van-dha-")
    { stringIdx: 0, delay: 0.55, leadFreq: 440.0, bassFreq: 110.0, chordFreqs: [220.0, 261.63, 329.63], accent: 1.15 }, // A4 ("-dhey...")

    // 3. Phrase 2 ("Thu-li ma-thi vin-ve-li than-dha-dhey..."):
    // E5 (0.22s) -> E5 (0.22s) -> D5 (0.22s) -> E5 (0.25s) -> G5 (0.30s) -> E5 (0.30s) -> D5 (0.25s) -> C5 (0.60s)
    { stringIdx: 4, delay: 0.22, leadFreq: 659.25, bassFreq: 110.0, chordFreqs: [220.0, 329.63], accent: 1.12 }, // E5 ("Thu-")
    { stringIdx: 4, delay: 0.22, leadFreq: 659.25, accent: 1.0 }, // E5 ("-li")
    { stringIdx: 4, delay: 0.22, leadFreq: 587.33, accent: 1.0 }, // D5 ("ma-")
    { stringIdx: 4, delay: 0.25, leadFreq: 659.25, bassFreq: 98.0, accent: 1.08 }, // E5 ("-thi")
    { stringIdx: 4, delay: 0.3, leadFreq: 783.99, bassFreq: 87.31, chordFreqs: [174.61, 261.63], accent: 1.22 }, // G5 ("vin-ve-")
    { stringIdx: 4, delay: 0.3, leadFreq: 659.25, accent: 1.05 }, // E5 ("-li")
    { stringIdx: 1, delay: 0.25, leadFreq: 587.33, bassFreq: 98.0, accent: 1.0 }, // D5 ("than-dha-")
    { stringIdx: 2, delay: 0.6, leadFreq: 523.25, bassFreq: 87.31, chordFreqs: [174.61, 220.0, 261.63, 329.63], accent: 1.16 }, // C5 ("-dhey...")

    // 4. Phrase 3 ("Aa-nura-dha...oo..."):
    // C5 (0.25s) -> D5 (0.25s) -> E5 (0.35s) -> D5 (0.25s) -> C5 (0.25s) -> B4 (0.35s) -> A4 (0.75s)
    { stringIdx: 2, delay: 0.25, leadFreq: 523.25, bassFreq: 87.31, chordFreqs: [174.61, 261.63], accent: 1.05 }, // C5 ("Aa-")
    { stringIdx: 1, delay: 0.25, leadFreq: 587.33, accent: 1.02 }, // D5 ("-nu-")
    { stringIdx: 4, delay: 0.35, leadFreq: 659.25, bassFreq: 98.0, chordFreqs: [196.0, 293.66], accent: 1.15 }, // E5 ("-ra-")
    { stringIdx: 1, delay: 0.25, leadFreq: 587.33, accent: 1.0 }, // D5 ("-dha...")
    { stringIdx: 2, delay: 0.25, leadFreq: 523.25, bassFreq: 82.41, accent: 1.0 }, // C5 ("oo...")
    { stringIdx: 3, delay: 0.35, leadFreq: 493.88, chordFreqs: [164.81, 246.94], accent: 1.04 }, // B4
    { stringIdx: 0, delay: 0.75, leadFreq: 440.0, bassFreq: 110.0, chordFreqs: [220.0, 261.63, 329.63, 440.0], accent: 1.2 }, // A4 (Am Resolution)
  ];

  const spawnFloatingMusicSymbols = (originLocalX: number, originLocalY: number, originLocalZ: number, accent = 1.0) => {
    for (let k = 0; k < 2; k++) {
      const p = soundholePopParticles[nextSoundholeParticleIdx % soundholePopParticles.length];
      nextSoundholeParticleIdx++;
      p.active = true;
      p.age = 0.0;
      p.maxAge = 1.35 + k * 0.22;
      p.mesh.visible = true;
      p.mesh.position.set(
        originLocalX + (k === 0 ? -0.08 : 0.09),
        originLocalY + k * 0.05,
        originLocalZ,
      );
      p.vx = (k === 0 ? -0.15 : 0.17) + Math.sin(nextSoundholeParticleIdx * 1.7) * 0.08;
      p.vy = (0.74 + k * 0.15) * accent;
      p.vz = 0.08 + Math.cos(nextSoundholeParticleIdx * 1.3) * 0.06;
      p.mat.opacity = 1.0;
    }
  };

  /**
   * Synthesizes warm Grand Piano acoustics for "En Kadhale":
   * Layers a fundamental triangle wave + soft sine 2nd harmonic (2 * freq at 0.25 gain) +
   * gentle low-pass filter envelope (2200Hz -> 400Hz) with a lush 1.4s exponential release tail,
   * plus optional left-hand C-minor / Fm7 / G7sus4 chord pad.
   */
  const triggerPianoKeyNote = (
    keyIndex: number,
    customFreq?: number,
    padFreqs?: readonly number[],
    accent = 1.0,
  ) => {
    const clampedIdx = THREE.MathUtils.clamp(keyIndex, 0, 7);
    const freq = customFreq ?? PIANO_KEY_DEFS[clampedIdx].freq;

    // Synthesize procedural Web Audio piano notes only when custom /assets/audio/en-kadhale.mp4 (.mp3) is not actively playing
    if (!pianoCustomTrack.isPlaying()) {
      try {
        const ctx = ensureAudio();
        if (ctx) {
          const now = ctx.currentTime;
          const oscFund = ctx.createOscillator();
          const oscHarm2 = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const masterGain = ctx.createGain();
          const harm2Gain = ctx.createGain();

          oscFund.type = 'triangle';
          oscFund.frequency.setValueAtTime(freq, now);

          oscHarm2.type = 'sine';
          oscHarm2.frequency.setValueAtTime(freq * 2.0, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2200, now);
          filter.frequency.exponentialRampToValueAtTime(400, now + 1.4);

          const peak = 0.09 * accent;
          masterGain.gain.setValueAtTime(0.001, now);
          masterGain.gain.linearRampToValueAtTime(peak, now + 0.012);
          masterGain.gain.exponentialRampToValueAtTime(0.0006, now + 1.4);

          harm2Gain.gain.setValueAtTime(peak * 0.25, now);
          harm2Gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.95);

          oscFund.connect(filter);
          oscHarm2.connect(harm2Gain);
          harm2Gain.connect(filter);
          filter.connect(masterGain);
          masterGain.connect(ctx.destination);

          oscFund.start(now);
          oscHarm2.start(now);
          oscFund.stop(now + 1.45);
          oscHarm2.stop(now + 1.0);

          // Soft Left-Hand Triad Pad ("En Kadhale" C minor / Fm7 / G7sus4 accompaniment)
          if (padFreqs && padFreqs.length > 0) {
            padFreqs.forEach((pf) => {
              const oscPad = ctx.createOscillator();
              const padFilter = ctx.createBiquadFilter();
              const padGain = ctx.createGain();
              oscPad.type = 'sine';
              oscPad.frequency.setValueAtTime(pf, now);
              padFilter.type = 'lowpass';
              padFilter.frequency.setValueAtTime(1100, now);
              padGain.gain.setValueAtTime(0.001, now);
              padGain.gain.linearRampToValueAtTime(peak * 0.28, now + 0.04);
              padGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.65);
              oscPad.connect(padFilter);
              padFilter.connect(padGain);
              padGain.connect(ctx.destination);
              oscPad.start(now);
              oscPad.stop(now + 1.7);
            });
          }
        }
      } catch {
        // Fallback
      }
    }

    // Physically depress the 3D piano key (rotation.x = +0.05 rad)
    pianoKeyDepressTimers[clampedIdx] = 0.36;
    pianoPlayTimer = Math.max(pianoPlayTimer, 0.85);
    musicPulseIntensity = Math.min(1.5, musicPulseIntensity + 0.65 * accent);

    // Float crystalline golden musical notes (♪, ♫, ♥) upward from the keyboard into the atrium
    const keyX = pianoX - 0.455 + clampedIdx * 0.13;
    spawnFloatingMusicSymbols(keyX, 1.15, pianoZ - 1.25, accent);
  };

  const spawnSlidingGuitarCue = (
    step: ThuliGuitarStep,
    autoPluck: boolean,
    speed = 0.78,
  ) => {
    for (let i = 0; i < slidingGuitarCues.length; i++) {
      const cue = slidingGuitarCues[i];
      if (!cue.active) {
        const sIdx = THREE.MathUtils.clamp(step.stringIdx, 0, 4);
        cue.active = true;
        cue.stringIndex = sIdx;
        cue.progress = 0.0;
        cue.speed = speed;
        cue.autoPluck = autoPluck;
        cue.plucked = false;
        cue.mat.color.set(GUITAR_NOTE_DEFS[sIdx].colorHex);
        cue.mat.opacity = 0.96;
        cue.mesh.visible = true;
        cue.mesh.position.set(GUITAR_NOTE_DEFS[sIdx].laneX, 0.21, 0.014);
        cue.mesh.scale.setScalar(1.0);
        return;
      }
    }
  };

  /**
   * Synthesizes an authentic plucked acoustic steel-string guitar for "Thuli Thuli":
   * Uses Karplus-Strong style plucked transients (short filtered noise burst + bright sawtooth/triangle
   * blend with rapid filter cutoff decay from 3500Hz -> 600Hz) layered with warm bass root notes
   * (A2, G2, F2, E2) on the downbeats.
   */
  const triggerGuitarStringPluck = (
    stringIndex: number,
    accent = 1.0,
    customLeadFreq?: number,
    customBassFreq?: number,
    customChordFreqs?: readonly number[],
  ) => {
    const clampedIdx = THREE.MathUtils.clamp(stringIndex, 0, 4);
    const noteDef = GUITAR_NOTE_DEFS[clampedIdx];
    const bassFreq = customBassFreq ?? noteDef.bassFreq;
    const notesToPluck = customLeadFreq
      ? customChordFreqs
        ? [...customChordFreqs, customLeadFreq]
        : [customLeadFreq]
      : (customChordFreqs ?? noteDef.chordFreqs);

    // Synthesize procedural Web Audio guitar notes only when custom /assets/audio/thuli-thuli.mp4 (.mp3) is not actively playing
    if (!guitarCustomTrack.isPlaying()) {
      try {
        const ctx = ensureAudio();
        if (ctx) {
          const now = ctx.currentTime;
          const decayDur = 1.05;

          // 1. Karplus-Strong style short filtered pick noise burst transient
          if (guitarPluckNoiseBuffer) {
            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = guitarPluckNoiseBuffer;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(customLeadFreq ? 2400 : 1850, now);
            noiseFilter.Q.setValueAtTime(1.8, now);
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.042 * accent, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);
            noiseSrc.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noiseSrc.start(now);
          }

          // 2. Warm Bass Root Note (A2, G2, F2, E2) on downbeats
          if (bassFreq) {
            const oscBass = ctx.createOscillator();
            const bassFilter = ctx.createBiquadFilter();
            const bassGain = ctx.createGain();
            oscBass.type = 'triangle';
            oscBass.frequency.setValueAtTime(bassFreq, now);
            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(950, now);
            bassFilter.frequency.exponentialRampToValueAtTime(280, now + 0.85);
            bassGain.gain.setValueAtTime(0.001, now);
            bassGain.gain.linearRampToValueAtTime(0.055 * accent, now + 0.008);
            bassGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.9);
            oscBass.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(ctx.destination);
            oscBass.start(now);
            oscBass.stop(now + 0.95);
          }

          // 3. Plucked Steel-String Sawtooth/Triangle Blend with 3500Hz -> 600Hz Filter Cutoff Decay
          notesToPluck.forEach((f, idx) => {
            const isLeadTop = customLeadFreq !== undefined && idx === notesToPluck.length - 1;
            const start = now + idx * (customLeadFreq ? 0.012 : 0.018);
            const oscSaw = ctx.createOscillator();
            const oscTri = ctx.createOscillator();
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();

            oscSaw.type = 'sawtooth';
            oscSaw.frequency.setValueAtTime(f, start);

            oscTri.type = 'triangle';
            oscTri.frequency.setValueAtTime(f, start);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3500, start);
            filter.frequency.exponentialRampToValueAtTime(600, start + decayDur * 0.55);

            const peakGain = (isLeadTop ? 0.072 : 0.038) * accent;
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(peakGain, start + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0006, start + decayDur);

            oscSaw.connect(filter);
            oscTri.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            oscSaw.start(start);
            oscTri.start(start);
            oscSaw.stop(start + decayDur + 0.04);
            oscTri.stop(start + decayDur + 0.04);
          });
        }
      } catch {
        // Audio fallback
      }
    }

    // Trigger String Snap/Glow & Guitar Body Vibration
    guitarStringTimers[clampedIdx] = 0.72;
    const adjIdx = (clampedIdx + 1) % 5;
    guitarStringTimers[adjIdx] = Math.max(guitarStringTimers[adjIdx], 0.42);
    guitarStrumTimer = Math.max(guitarStrumTimer, 0.48);
    musicPulseIntensity = Math.min(1.5, musicPulseIntensity + 0.55 * accent);

    // Pop Sparkling Heart Notes & Musical Sparks ('♪', '♫', '♥') Upward from Soundhole
    spawnFloatingMusicSymbols(guitarStandX, 1.24, guitarStandZ + 0.08, accent);
  };

  type RoomInteractionId =
    | 'couture'
    | 'fridge'
    | 'oven'
    | 'blender'
    | 'dining_sit'
    | 'dining_centerpiece'
    | 'sofa_sit'
    | 'record_player'
    | 'piano'
    | 'guitar'
    | 'orchid'
    | 'none';

  const _scratchHitResult: { id: RoomInteractionId; prompt: string | null } = {
    id: 'none',
    prompt: null,
  };

  const setHitResult = (id: RoomInteractionId, prompt: string | null) => {
    _scratchHitResult.id = id;
    _scratchHitResult.prompt = prompt;
    return _scratchHitResult;
  };

  const getNearestInteraction = (lx: number, lz: number) => {
    if (activeCameraMode === 'couture_inspect') {
      return setHitResult(
        'couture',
        '[A/D or Drag] Rotate Mannequins  [Space] Cycle Spotlight  [E] Exit Inspection',
      );
    }
    if (activeCameraMode === 'dining_sit') {
      return setHitResult('dining_sit', '[E or WASD] Stand Up from Royal Dining Table');
    }
    if (activeCameraMode === 'dining_centerpiece') {
      return setHitResult('dining_centerpiece', '[E or WASD] Step Back from Centerpiece');
    }
    if (activeCameraMode === 'sofa_sit') {
      const aimingRecord = isLookingAtRecordPlayerFromSofa();
      if (aimingRecord) {
        return setHitResult(
          'record_player',
          isRecordPlaying
            ? '[E] Pause Record · [Esc] Get Up'
            : '[E] Play Vintage Record · [Esc] Get Up',
        );
      }
      return setHitResult(
        'sofa_sit',
        isRecordPlaying
          ? '[E] Get Up · [Space] Pause Record · [Mouse/WASD] Look Around'
          : '[E] Get Up · [Space] Play Vintage Record · [Mouse/WASD] Look Around',
      );
    }
    if (activeCameraMode === 'piano_play') {
      return setHitResult(
        'piano',
        '♪ Press [Enter] or [Space] to Play Song · [A S D F] Notes · [Esc] Exit',
      );
    }
    if (activeCameraMode === 'guitar_play') {
      return setHitResult(
        'guitar',
        '♪ Press [Enter] or [Space] to Play Song · [A S D F] Notes · [Esc] Exit',
      );
    }

    // 1. Dream Kitchen (Priority: Kitchen/fridge before instruments/romantic objects)
    if (Math.hypot(lx - 7.6, lz - -13.2) <= 2.4) {
      return setHitResult(
        'fridge',
        isFridgeOpen ? '[E] Close Pastel Fridge' : '[E] Open Pastel Fridge',
      );
    }
    if (Math.hypot(lx - 11.4, lz - -13.0) <= 2.3) {
      return setHitResult(
        'oven',
        isOvenOpen ? '[E] Close Royal Oven' : '[E] Check Royal Oven',
      );
    }
    if (Math.hypot(lx - 10.6, lz - -9.6) <= 2.5) {
      return setHitResult('blender', '[E] Blend Berry Smoothie / Boil Kettle');
    }

    // 2. Music Lounge (Piano / Guitar)
    if (Math.hypot(lx - guitarStandX, lz - guitarStandZ) <= 2.4) {
      return setHitResult('guitar', '[E] Pick Up & Play Acoustic Guitar');
    }
    if (Math.hypot(lx - pianoX, lz - (pianoZ - 1.2)) <= 2.6) {
      return setHitResult('piano', '[E] Play Grand Piano');
    }

    // 3. Romantic Objects (Starlight Orchid Table, Dining, Living Room, Fashion Gallery)
    if (lx >= 9.0 && lx <= 15.4 && lz >= 7.8 && lz <= 15.4) {
      return setHitResult('orchid', '[E] Touch Starlight Orchid Table');
    }
    if (Math.hypot(lx - diningTableX, lz - -2.65) <= 2.2) {
      return setHitResult('dining_sit', '[E] Sit at Royal Dining Table');
    }
    if (Math.hypot(lx - diningTableX, lz - 0.0) <= 2.6) {
      return setHitResult('dining_centerpiece', '[E] Inspect Table Centerpiece');
    }
    if (Math.hypot(lx - recordPlayerX, lz - recordPlayerZ) <= 2.15) {
      return setHitResult(
        'record_player',
        isRecordPlaying ? '[E] Pause Record' : '[E] Play Vintage Record',
      );
    }
    if (Math.hypot(lx - -10.5, lz - 0.0) <= 2.55) {
      return setHitResult('sofa_sit', '[E] Relax on Velvet Sofa');
    }
    if (Math.hypot(lx - -11.8, lz - -11.4) <= 3.6) {
      return setHitResult('couture', '[E] Inspect Couture Display');
    }

    return setHitResult('none', null);
  };

  let cameraLookYawOffset = 0.0;
  let cameraLookPitchOffset = 0.0;

  return {
    group: floor1RoomsGroup,
    colliders,
    partitionMeshes,

    getProximityPrompt: (playerPos: THREE.Vector3) => {
      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;
      if (activeCameraMode !== 'none') {
        return getNearestInteraction(lx, lz).prompt;
      }
      if (Math.abs(playerPos.y - (baseY + 0.25)) > 2.2) return null;
      if (Math.abs(lx) > 16.0 || Math.abs(lz) > 16.0) return null;
      return getNearestInteraction(lx, lz).prompt;
    },

    getActiveRoomCaption: () => {
      if (conservatoryWaveTimer > 0) {
        return 'I Love u Mandu 💕';
      }
      return null;
    },

    interact: (playerPos: THREE.Vector3) => {
      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;
      const hit = getNearestInteraction(lx, lz);

      // Special handling when seated on the Velvet Sofa (First-Person Seated Mode):
      // If looking toward the Vintage Record Player, [E] plays/pauses the record while staying seated!
      // Otherwise, [E] stands up cleanly beside the sofa.
      if (activeCameraMode === 'sofa_sit') {
        if (hit.id === 'record_player') {
          toggleVintageRecordPlayback();
          return true;
        }
        activeCameraMode = 'none';
        cameraLookYawOffset = 0.0;
        cameraLookPitchOffset = 0.0;
        relaxLoungeState = isRecordPlaying ? 'RECORD_PLAYING' : 'RELAX_LOUNGE_IDLE';
        playerPos.set(originX - 11.35, baseY + 0.25, originZ + 0.0);
        return true;
      }

      if (activeCameraMode !== 'none') {
        activeCameraMode = 'none';
        cameraLookYawOffset = 0.0;
        cameraLookPitchOffset = 0.0;
        pianoAutoPlayActive = false;
        guitarMelodyGuideActive = false;
        pianoCustomTrack.stop();
        guitarCustomTrack.stop();
        return true;
      }

      if (Math.abs(playerPos.y - (baseY + 0.25)) > 2.2) return false;
      if (hit.id === 'none') return false;

      cameraLookYawOffset = 0.0;
      cameraLookPitchOffset = 0.0;

      switch (hit.id) {
        case 'couture':
          activeCameraMode = 'couture_inspect';
          playArpeggioNotes([587.33, 739.99, 880.0, 1174.66], 0.1, 0.045);
          return true;

        case 'fridge':
          isFridgeOpen = !isFridgeOpen;
          playArpeggioNotes(isFridgeOpen ? [523.25, 659.25] : [659.25, 523.25], 0.09, 0.04);
          return true;

        case 'oven':
          isOvenOpen = !isOvenOpen;
          playArpeggioNotes(isOvenOpen ? [440.0, 554.37, 659.25] : [554.37, 440.0], 0.1, 0.04);
          return true;

        case 'blender':
          blenderActiveTimer = 3.6;
          kettleChiming = false;
          playArpeggioNotes([392.0, 493.88, 587.33, 783.99], 0.12, 0.04, 'triangle');
          return true;

        case 'dining_sit':
          activeCameraMode = 'dining_sit';
          playArpeggioNotes([523.25, 659.25, 783.99], 0.12, 0.04);
          return true;

        case 'dining_centerpiece':
          activeCameraMode = 'dining_centerpiece';
          playArpeggioNotes([659.25, 783.99, 987.77, 1318.5], 0.12, 0.045);
          return true;

        case 'sofa_sit':
          activeCameraMode = 'sofa_sit';
          sofaHeadYaw = -Math.PI / 2; // Face -X toward the Fireplace (with Record Player to the left)
          sofaHeadPitch = 0.04;
          relaxLoungeState = isRecordPlaying
            ? 'RECORD_PLAYING'
            : isRecordPaused
              ? 'RECORD_PAUSED'
              : 'SOFA_SEATED';
          playArpeggioNotes([440.0, 523.25, 659.25], 0.14, 0.04);
          return true;

        case 'record_player':
          toggleVintageRecordPlayback();
          return true;

        case 'piano':
          // Enter Piano Performance Mode with audio playback initially paused (starts on Enter or Space)
          activeCameraMode = 'piano_play';
          pianoAutoPlayActive = false;
          pianoAutoStepIndex = 0;
          pianoFadeElapsed = 0.0;
          pianoCustomTrack.stop();
          return true;

        case 'guitar':
          // Enter Guitar Performance Mode with audio playback initially paused (starts on Enter or Space)
          activeCameraMode = 'guitar_play';
          guitarMelodyGuideActive = false;
          guitarFadeElapsed = 0.0;
          freePlayGuideTimer = 0.25;
          freePlayGuideStep = 0;
          guitarCustomTrack.stop();
          return true;

        case 'orchid':
          // Toggle static flat table-top inscription ("I Love u Mandu 💕") on top of the Starlight Orchid Table
          conservatoryWaveTimer = conservatoryWaveTimer > 0 ? 0.0 : 8.5;
          if (conservatoryWaveTimer > 0) {
            playArpeggioNotes([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.11, 0.055);
          }
          return true;
      }
      return false;
    },

    handleKeyAction: (code: string) => {
      if (activeCameraMode === 'sofa_sit' && (code === 'Space' || code === 'KeyR')) {
        toggleVintageRecordPlayback();
        return true;
      }
      if (activeCameraMode === 'couture_inspect' && code === 'Space') {
        coutureSpotlightIndex = (coutureSpotlightIndex + 1) % 3;
        playArpeggioNotes([783.99, 987.77, 1174.66], 0.08, 0.045);
        return true;
      }
      if (activeCameraMode === 'piano_play') {
        // Manual 8-Key Concert Pianist Keyboard (A, S, D, F, G, H, J, K -> C4, D4, Eb4, F4, G4, Ab4, Bb4, C5)
        for (let k = 0; k < PIANO_KEY_DEFS.length; k++) {
          if (code === PIANO_KEY_DEFS[k].code || code === `Digit${k + 1}` || code === `Numpad${k + 1}`) {
            pianoAutoPlayActive = false;
            pianoCustomTrack.stop();
            triggerPianoKeyNote(
              k,
              PIANO_KEY_DEFS[k].freq,
              [PIANO_KEY_DEFS[k].freq * 0.5],
              1.0,
            );
            return true;
          }
        }
        if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
          // Toggle / Start Song "En Kadhale" with 1.5s gradual volume fade-in (0.0 -> 1.0)
          pianoAutoPlayActive = !pianoAutoPlayActive;
          if (pianoAutoPlayActive) {
            pianoAutoStepIndex = 0;
            pianoAutoStepTimer = 0.02;
            pianoFadeElapsed = 0.0;
            void pianoCustomTrack.playFromStartWithFade();
          } else {
            pianoCustomTrack.stop();
          }
          return true;
        }
      }
      if (activeCameraMode === 'guitar_play') {
        if (code === 'KeyA' || code === 'Digit1' || code === 'Numpad1') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(0, 1.0); // Am Strum
          return true;
        }
        if (code === 'KeyS' || code === 'Digit2' || code === 'Numpad2') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(1, 1.0); // G Strum
          return true;
        }
        if (code === 'KeyD' || code === 'Digit3' || code === 'Numpad3') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(2, 1.05); // FMaj7 Strum
          return true;
        }
        if (code === 'KeyF' || code === 'Digit4' || code === 'Numpad4') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(3, 1.0); // E7 Strum
          return true;
        }
        if (code === 'KeyG' || code === 'Digit5' || code === 'Numpad5') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(4, 1.12, 659.25, 110.0, [220.0, 329.63]); // Lead Note E5
          return true;
        }
        if (code === 'KeyH' || code === 'Digit6' || code === 'Numpad6') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(4, 1.08, 587.33, 98.0, [196.0, 293.66]); // Lead Note D5
          return true;
        }
        if (code === 'KeyJ' || code === 'Digit7' || code === 'Numpad7') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(2, 1.08, 523.25, 87.31, [174.61, 261.63]); // Lead Note C5
          return true;
        }
        if (code === 'KeyK' || code === 'Digit8' || code === 'Numpad8') {
          guitarMelodyGuideActive = false;
          guitarCustomTrack.stop();
          triggerGuitarStringPluck(0, 1.12, 440.0, 110.0, [220.0, 329.63]); // Lead Note A4
          return true;
        }
        if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
          // Toggle / Start Song "Thuli Thuli" with 1.5s gradual volume fade-in (0.0 -> 1.0)
          guitarMelodyGuideActive = !guitarMelodyGuideActive;
          guitarMelodyStepIndex = 0;
          guitarMelodyStepTimer = 0.04;
          if (guitarMelodyGuideActive) {
            guitarFadeElapsed = 0.0;
            void guitarCustomTrack.playFromStartWithFade();
          } else {
            guitarCustomTrack.stop();
          }
          for (let i = 0; i < slidingGuitarCues.length; i++) {
            slidingGuitarCues[i].active = false;
            slidingGuitarCues[i].mesh.visible = false;
          }
          return true;
        }
      }
      return false;
    },

    applyInspectYawDelta: (deltaYaw: number) => {
      if (activeCameraMode === 'couture_inspect') {
        coutureInspectRotation += deltaYaw * 2.2;
        cameraLookYawOffset -= deltaYaw * 0.5;
      }
    },

    applySeatedLookDelta: (deltaYaw: number, deltaPitch: number) => {
      if (activeCameraMode === 'sofa_sit') {
        sofaHeadYaw -= deltaYaw;
        // Clamp vertical pitch between -55° (-0.96 rad) and +65° (+1.13 rad)
        sofaHeadPitch = THREE.MathUtils.clamp(sofaHeadPitch + deltaPitch, -0.96, 1.13);
      } else if (activeCameraMode !== 'none') {
        if (activeCameraMode === 'couture_inspect') {
          coutureInspectRotation += deltaYaw * 1.8;
        }
        cameraLookYawOffset -= deltaYaw;
        cameraLookPitchOffset = THREE.MathUtils.clamp(
          cameraLookPitchOffset + deltaPitch,
          -0.88,
          0.95,
        );
      }
    },

    getRelaxLoungeState: () => relaxLoungeState,

    exitActiveCameraMode: (playerPos?: THREE.Vector3) => {
      const wasSofaSit = activeCameraMode === 'sofa_sit';
      activeCameraMode = 'none';
      cameraLookYawOffset = 0.0;
      cameraLookPitchOffset = 0.0;
      pianoAutoPlayActive = false;
      guitarMelodyGuideActive = false;
      pianoCustomTrack.stop();
      guitarCustomTrack.stop();
      if (wasSofaSit) {
        relaxLoungeState = isRecordPlaying ? 'RECORD_PLAYING' : 'RELAX_LOUNGE_IDLE';
        if (playerPos) {
          playerPos.set(originX - 11.35, baseY + 0.25, originZ + 0.0);
        }
      }
    },

    getCameraState: () => {
      const isActive = activeCameraMode !== 'none' && cameraBlendAlpha > 0.005;
      let isSitting = false;
      let isFirstPersonSeated = false;

      if (activeCameraMode === 'couture_inspect') {
        const focusSpot = pedestalConfigs[coutureSpotlightIndex];
        _scratchCamWorldPos.set(originX + focusSpot.lx + 1.45, baseY + 1.85, originZ + focusSpot.lz + 1.45);
        _scratchLookWorldPos.set(originX + focusSpot.lx, baseY + 1.65, originZ + focusSpot.lz);
      } else if (activeCameraMode === 'dining_sit') {
        isSitting = true;
        _scratchSeatWorldPos.set(originX + diningTableX, baseY + 0.25, originZ - 2.65);
        _scratchCamWorldPos.set(originX + diningTableX + 0.45, baseY + 1.82, originZ - 3.35);
        _scratchLookWorldPos.set(originX + diningTableX, baseY + 1.28, originZ + 0.2);
      } else if (activeCameraMode === 'dining_centerpiece') {
        _scratchCamWorldPos.set(originX + diningTableX - 1.35, baseY + 1.82, originZ - 0.55);
        _scratchLookWorldPos.set(originX + diningTableX, baseY + 1.25, originZ - 0.15);
      } else if (activeCameraMode === 'sofa_sit') {
        // First-Person Seated Camera on Velvet Sofa (sofaSeatY + comfortable seated eye height = baseY + 1.34m)
        // with full horizontal (LEFT <-> RIGHT) and clamped vertical (-55° to +65°) free head movement!
        isSitting = true;
        isFirstPersonSeated = true;
        const eyeX = originX - 10.68;
        const eyeY = baseY + 1.34;
        const eyeZ = originZ + 0.0;
        _scratchSeatWorldPos.set(originX - 10.62, baseY + 0.25, originZ + 0.0);
        _scratchCamWorldPos.set(eyeX, eyeY, eyeZ);
        const lookDist = 6.0;
        _scratchLookWorldPos.set(
          eyeX + Math.sin(sofaHeadYaw) * Math.cos(sofaHeadPitch) * lookDist,
          eyeY - Math.sin(sofaHeadPitch) * lookDist,
          eyeZ + Math.cos(sofaHeadYaw) * Math.cos(sofaHeadPitch) * lookDist,
        );
      } else if (activeCameraMode === 'piano_play') {
        isSitting = true;
        _scratchSeatWorldPos.set(originX + pianoX, baseY + 0.25, originZ + pianoZ - 1.95);
        _scratchCamWorldPos.set(originX + pianoX + 1.35, baseY + 1.95, originZ + pianoZ - 1.85);
        _scratchLookWorldPos.set(originX + pianoX - 0.1, baseY + 1.18, originZ + pianoZ - 0.35);
      } else if (activeCameraMode === 'guitar_play') {
        // Straight, level, centered front-facing portrait shot:
        // Distance = 2.35m along local normal (+Z), height = baseY + 1.45m, target = guitar body center (baseY + 1.25m)
        _scratchSeatWorldPos.set(originX + guitarStandX, baseY + 0.25, originZ + guitarStandZ - 0.18);
        _scratchCamWorldPos.set(originX + guitarStandX, baseY + 1.45, originZ + guitarStandZ + 2.35);
        _scratchLookWorldPos.set(originX + guitarStandX, baseY + 1.25, originZ + guitarStandZ);
      }

      // Apply 2-axis user look offsets (Up, Down, Right, Left) for all non-sofa_sit camera modes
      if (
        activeCameraMode !== 'none' &&
        activeCameraMode !== 'sofa_sit' &&
        (Math.abs(cameraLookYawOffset) > 0.0001 || Math.abs(cameraLookPitchOffset) > 0.0001)
      ) {
        const dx = _scratchLookWorldPos.x - _scratchCamWorldPos.x;
        const dy = _scratchLookWorldPos.y - _scratchCamWorldPos.y;
        const dz = _scratchLookWorldPos.z - _scratchCamWorldPos.z;
        const dist = Math.hypot(dx, dy, dz) || 1.0;
        const baseYaw = Math.atan2(dx, dz);
        const basePitch = Math.asin(THREE.MathUtils.clamp(-dy / dist, -0.96, 0.96));
        const finalYaw = baseYaw + cameraLookYawOffset;
        const finalPitch = THREE.MathUtils.clamp(basePitch + cameraLookPitchOffset, -0.92, 0.92);
        _scratchLookWorldPos.set(
          _scratchCamWorldPos.x + Math.sin(finalYaw) * Math.cos(finalPitch) * dist,
          _scratchCamWorldPos.y - Math.sin(finalPitch) * dist,
          _scratchCamWorldPos.z + Math.cos(finalYaw) * Math.cos(finalPitch) * dist,
        );
      }

      return {
        active: isActive,
        mode: activeCameraMode,
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: smoothStep01(cameraBlendAlpha),
        isSitting,
        isFirstPersonSeated,
        seatWorldPos:
          isSitting || activeCameraMode === 'guitar_play' ? _scratchSeatWorldPos : undefined,
        seatYaw:
          activeCameraMode === 'dining_sit'
            ? 0
            : activeCameraMode === 'sofa_sit'
              ? -Math.PI / 2
              : activeCameraMode === 'piano_play'
                ? 0
                : activeCameraMode === 'guitar_play'
                  ? 0.0
                  : undefined,
      };
    },

    getMusicPulseIntensity: () => musicPulseIntensity,

    update: (delta: number, elapsedTime: number, playerPos: THREE.Vector3, inputKeys?: Set<string>) => {
      const targetBlend = activeCameraMode !== 'none' ? 1.0 : 0.0;
      const blendSpeed = activeCameraMode === 'couture_inspect' || activeCameraMode === 'dining_centerpiece' ? 1 / 0.35 : 1 / 0.4;
      cameraBlendAlpha = THREE.MathUtils.clamp(
        cameraBlendAlpha + (targetBlend > cameraBlendAlpha ? delta * blendSpeed : -delta * 2.5),
        0,
        1,
      );

      // 1. Distance & Floor Visibility Culling (> 55m outside castle or above Floor 2: playerY > baseY + 8.5m)
      const dxCastle = playerPos.x - originX;
      const dzCastle = playerPos.z - originZ;
      const distFromCastle = Math.hypot(dxCastle, dzCastle);

      if (distFromCastle > 55.0 || playerPos.y > baseY + 8.5) {
        floor1RoomsGroup.visible = false;
        sharedRoomAccentLight.intensity = 0.0;
        fireplaceWarmLight.intensity = 0.0;
        fireplaceWarmLight.visible = false;
        if (isRecordPlaying) {
          isRecordPlaying = false;
          recordCustomTrack.stop();
        }
        musicPulseIntensity = 0.0;
        return;
      }
      floor1RoomsGroup.visible = true;

      _scratchPlayerLocal.set(dxCastle, playerPos.y - baseY, dzCastle);
      const lx = _scratchPlayerLocal.x;
      const lz = _scratchPlayerLocal.z;

      // 2. Seated Head Movement on Velvet Sofa OR 2-Axis Camera Look in any Floor 1 Activity via Arrow Keys / Q-R
      if (activeCameraMode === 'sofa_sit' && inputKeys) {
        if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') || inputKeys.has('KeyQ')) {
          sofaHeadYaw += delta * 1.65;
        }
        if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') || inputKeys.has('KeyR')) {
          sofaHeadYaw -= delta * 1.65;
        }
        if (inputKeys.has('KeyW') || inputKeys.has('ArrowUp')) {
          sofaHeadPitch = THREE.MathUtils.clamp(sofaHeadPitch - delta * 1.15, -0.96, 1.13);
        }
        if (inputKeys.has('KeyS') || inputKeys.has('ArrowDown')) {
          sofaHeadPitch = THREE.MathUtils.clamp(sofaHeadPitch + delta * 1.15, -0.96, 1.13);
        }
        if (!isRecordPlaying && !isRecordPaused) {
          relaxLoungeState = isLookingAtRecordPlayerFromSofa() ? 'RECORD_READY' : 'SOFA_SEATED';
        }
      } else if (activeCameraMode !== 'none' && inputKeys) {
        if (inputKeys.has('ArrowLeft') || inputKeys.has('KeyQ')) {
          cameraLookYawOffset += delta * 1.55;
        }
        if (inputKeys.has('ArrowRight') || inputKeys.has('KeyR')) {
          cameraLookYawOffset -= delta * 1.55;
        }
        if (inputKeys.has('ArrowUp')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(cameraLookPitchOffset - delta * 1.15, -0.88, 0.95);
        }
        if (inputKeys.has('ArrowDown')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(cameraLookPitchOffset + delta * 1.15, -0.88, 0.95);
        }
      }

      // Smooth Camera Blend & WASD Stand-Up Detection (only for dining_sit / dining_centerpiece)
      if (
        (activeCameraMode === 'dining_sit' || activeCameraMode === 'dining_centerpiece') &&
        inputKeys &&
        (inputKeys.has('KeyW') ||
          inputKeys.has('KeyS') ||
          inputKeys.has('KeyA') ||
          inputKeys.has('KeyD'))
      ) {
        activeCameraMode = 'none';
        cameraLookYawOffset = 0.0;
        cameraLookPitchOffset = 0.0;
      }

      // Decay musicPulseIntensity smoothly for chandelier & room accent light rhythm pulsing
      musicPulseIntensity = Math.max(0.0, musicPulseIntensity - delta * 2.2);

      // 3. Single Shared Floor 1 Accent PointLight Smooth Room Tracking
      if (lx < -8.8) {
        if (lz < -7.6) {
          // Fashion Gallery
          _scratchLightTargetPos.set(-11.8, 3.8, -11.4);
          _scratchLightTargetColor.set('#fdf2f8');
        } else if (lz <= 7.6) {
          // Living Room Fireplace Warmth
          _scratchLightTargetPos.set(-12.2, 3.2, 0.0);
          _scratchLightTargetColor.set('#ffedd5');
        } else {
          // Music Lounge
          _scratchLightTargetPos.set(-11.4, 3.6, 11.4);
          _scratchLightTargetColor.set(activeCameraMode === 'guitar_play' ? '#fbcfe8' : '#fef08a');
        }
      } else if (lx > 8.8) {
        if (lz < -7.6) {
          // Dream Kitchen
          _scratchLightTargetPos.set(10.8, 3.8, -11.2);
          _scratchLightTargetColor.set('#fff1f2');
        } else if (lz <= 7.6) {
          // Royal Dining Room
          _scratchLightTargetPos.set(12.0, 3.5, 0.0);
          _scratchLightTargetColor.set('#fef3c7');
        } else {
          // Indoor Glass Conservatory
          _scratchLightTargetPos.set(12.0, 3.6, 11.4);
          _scratchLightTargetColor.set('#f472b6');
        }
      } else {
        _scratchLightTargetPos.set(0.0, 4.2, 0.0);
        _scratchLightTargetColor.set('#fff1f2');
      }

      sharedRoomAccentLight.position.lerp(_scratchLightTargetPos, 1 - Math.exp(-6.0 * delta));
      sharedRoomAccentLight.color.lerp(_scratchLightTargetColor, 1 - Math.exp(-5.0 * delta));
      const targetAccentIntensity = 1.55 + musicPulseIntensity * 0.65;
      sharedRoomAccentLight.intensity = THREE.MathUtils.lerp(
        sharedRoomAccentLight.intensity,
        targetAccentIntensity,
        1 - Math.exp(-8.0 * delta),
      );

      // 4. Fashion Gallery Rotating Mannequin Pedestals
      if (activeCameraMode === 'couture_inspect' && inputKeys) {
        if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft')) {
          coutureInspectRotation -= delta * 1.85;
        }
        if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight')) {
          coutureInspectRotation += delta * 1.85;
        }
      } else {
        coutureInspectRotation += delta * 0.45;
      }

      for (let i = 0; i < pedestalPivots.length; i++) {
        pedestalPivots[i].rotation.y = pedestalConfigs[i].baseYaw + coutureInspectRotation;
        const isHighlighted = activeCameraMode === 'couture_inspect' && coutureSpotlightIndex === i;
        pedestalRingMats[i].emissiveIntensity = isHighlighted
          ? 1.85 + Math.sin(elapsedTime * 6.0) * 0.35
          : 0.75 + Math.sin(elapsedTime * 2.5 + i) * 0.2;
      }

      // 5. Dream Kitchen Fridge, Oven, Blender & Kettle Micro-Animations
      const targetFridge = isFridgeOpen ? 1.0 : 0.0;
      fridgeOpenRatio = THREE.MathUtils.lerp(fridgeOpenRatio, targetFridge, 1 - Math.exp(-8.0 * delta));
      fridgeDoorPivot.rotation.y = -fridgeOpenRatio * THREE.MathUtils.degToRad(95);
      fridgeInteriorGlowMat.emissiveIntensity = fridgeOpenRatio * 1.4;

      const targetOven = isOvenOpen ? 1.0 : 0.0;
      ovenOpenRatio = THREE.MathUtils.lerp(ovenOpenRatio, targetOven, 1 - Math.exp(-8.0 * delta));
      ovenDoorPivot.rotation.x = ovenOpenRatio * THREE.MathUtils.degToRad(75);
      ovenBakingGlowMat.emissiveIntensity = ovenOpenRatio * 1.65;

      if (blenderActiveTimer > 0) {
        blenderActiveTimer = Math.max(0, blenderActiveTimer - delta);
        blenderJarPivot.rotation.y += delta * 24.0;
        blenderJarPivot.position.x = 9.6 + Math.sin(elapsedTime * 48.0) * 0.012;
        if (blenderActiveTimer <= 0.45 && !kettleChiming) {
          kettleChiming = true;
          playArpeggioNotes([1046.5, 1318.5, 1567.98], 0.12, 0.055);
        }
      } else {
        blenderJarPivot.position.x = 9.6;
      }

      const showSteam = isOvenOpen || blenderActiveTimer > 0;
      steamParticleMat.opacity = showSteam ? 0.52 : 0.0;
      for (let s = 0; s < steamPuffs.length; s++) {
        const puff = steamPuffs[s];
        puff.visible = showSteam;
        if (showSteam) {
          const cycle = (elapsedTime * 0.9 + s * 0.18) % 1.0;
          const anchorX = isOvenOpen && s < 3 ? 11.4 : 11.5;
          const anchorZ = isOvenOpen && s < 3 ? -13.45 : -9.6;
          const baseH = isOvenOpen && s < 3 ? 0.85 : 1.55;
          puff.position.set(
            anchorX + Math.sin(elapsedTime * 3.2 + s) * 0.08,
            baseH + cycle * 0.75,
            anchorZ,
          );
          puff.scale.setScalar(0.6 + cycle * 0.8);
        }
      }

      // 6. Living Room Layered Fireplace Fire, Rising Embers, Cozy WarmLight & Mechanical Vintage Record Player
      const distToLivingRoom = Math.hypot(lx - -12.5, lz - 0.0);
      const isNearLivingRoom = distToLivingRoom <= 18.0;

      const firePulse =
        Math.sin(elapsedTime * 7.5) * 0.28 +
        Math.cos(elapsedTime * 13.0) * 0.16 +
        Math.sin(elapsedTime * 19.5) * 0.08;
      fireplaceEmberMat.emissiveIntensity = 1.35 + firePulse;

      if (isNearLivingRoom) {
        fireplaceWarmLight.visible = true;
        fireplaceWarmLight.intensity = 1.38 + firePulse * 0.45;

        // Animate InnerFlame, OuterFlame, and SmallFlameTips layers
        for (let fIdx = 0; fIdx < animatedFlameLayers.length; fIdx++) {
          const fl = animatedFlameLayers[fIdx];
          const w1 = Math.sin(elapsedTime * fl.speed + fl.phase);
          const w2 = Math.cos(elapsedTime * (fl.speed * 1.62) + fl.phase * 1.3);
          const stretchY = fl.baseScaleY * (1.0 + w1 * 0.24 + w2 * 0.12);
          const breathXZ = 1.0 - w1 * 0.1 + w2 * 0.08;
          fl.mesh.scale.set(
            fl.baseScaleX * breathXZ,
            stretchY,
            fl.baseScaleZ * breathXZ,
          );
          fl.mesh.rotation.z = w1 * 0.14;
          fl.mesh.rotation.x = w2 * 0.1;
        }

        // Animate 6 lightweight rising ember sparks inside the firebox
        fpEmberParticlesGroup.visible = true;
        for (let eIdx = 0; eIdx < emberSparkMeshes.length; eIdx++) {
          const sp = emberSparkMeshes[eIdx];
          const cycle = (elapsedTime * (0.65 + eIdx * 0.08) + eIdx * 0.19) % 1.0;
          sp.position.set(
            0.46 + Math.sin(elapsedTime * 3.8 + eIdx * 1.7) * 0.06,
            0.48 + cycle * 0.72,
            (eIdx - 2.5) * 0.11 + Math.cos(elapsedTime * 3.1 + eIdx) * 0.05,
          );
          const sparkScale = cycle < 0.2 ? cycle / 0.2 : 1.0 - (cycle - 0.2) / 0.8;
          sp.scale.setScalar(Math.max(0.05, sparkScale));
        }
      } else {
        // Distance-based optimization when far from Living Room
        fireplaceWarmLight.intensity = 0.0;
        fireplaceWarmLight.visible = false;
        fpEmberParticlesGroup.visible = false;
      }

      // Vintage Barbie-Era Record Player Mechanical Sequence:
      // 1. Lid opens smoothly (recordLidOpenRatio -> 1.0) & warm indicator lamp glows
      // 2. Tonearm lifts from rest post, moves to outer edge of vinyl, lowers stylus onto groove
      // 3. Vinyl record & pink/gold center label spin continuously at 33 1/3 RPM (3.49 rad/s)
      // 4. Tonearm slowly tracks inward across the vinyl grooves as the song plays
      const targetLidOpen = isRecordPlaying || isRecordPaused ? 1.0 : 0.0;
      recordLidOpenRatio = THREE.MathUtils.lerp(
        recordLidOpenRatio,
        targetLidOpen,
        1 - Math.exp(-5.5 * delta),
      );
      recordLidPivot.rotation.x = -recordLidOpenRatio * 1.05;
      recordIndicatorMat.emissiveIntensity = isRecordPlaying
        ? 1.65 + Math.sin(elapsedTime * 5.0) * 0.25
        : isRecordPaused
          ? 0.75
          : 0.25;

      const targetTonearm = isRecordPlaying ? 1.0 : isRecordPaused ? 0.65 : 0.0;
      recordTonearmRatio = THREE.MathUtils.lerp(
        recordTonearmRatio,
        targetTonearm,
        1 - Math.exp(-4.8 * delta),
      );

      // Compute inward groove tracking angle (outer groove = 0.34 rad -> inner groove = 0.54 rad)
      const grooveYaw = THREE.MathUtils.lerp(0.34, 0.54, recordSongProgress);
      if (isRecordPlaying) {
        tonearmPivot.rotation.y = THREE.MathUtils.lerp(0.0, grooveYaw, Math.min(1.0, recordTonearmRatio * 1.25));
        // Lift arm during swing (0.15..0.75), then lower stylus onto vinyl surface (>= 0.75)
        const liftCurve =
          recordTonearmRatio < 0.75
            ? Math.sin((recordTonearmRatio / 0.75) * Math.PI) * 0.14
            : 0.015;
        tonearmPivot.rotation.x = -liftCurve;
      } else if (isRecordPaused) {
        tonearmPivot.rotation.y = THREE.MathUtils.lerp(tonearmPivot.rotation.y, grooveYaw, 1 - Math.exp(-6.0 * delta));
        tonearmPivot.rotation.x = THREE.MathUtils.lerp(tonearmPivot.rotation.x, -0.09, 1 - Math.exp(-6.0 * delta));
      } else {
        tonearmPivot.rotation.y = THREE.MathUtils.lerp(tonearmPivot.rotation.y, 0.0, 1 - Math.exp(-6.0 * delta));
        tonearmPivot.rotation.x = THREE.MathUtils.lerp(tonearmPivot.rotation.x, 0.0, 1 - Math.exp(-6.0 * delta));
      }

      recordCustomTrack.updateFade(delta);

      if (isRecordPlaying && recordTonearmRatio >= 0.55) {
        // Spin vinyl continuously at 33 1/3 RPM (3.49 rad/s)
        vinylDiscPivot.rotation.y += delta * 3.49;
        recordSongProgress = (recordSongProgress + delta / 95.0) % 1.0;
        recordFadeElapsed = Math.min(1.5, recordFadeElapsed + delta);
        const fadeVol = THREE.MathUtils.clamp(recordFadeElapsed / 1.5, 0.05, 1.0);
        musicPulseIntensity = Math.max(musicPulseIntensity, 0.35 * fadeVol);

        // If custom /assets/audio/records/barbie-song.mp3 is not uploaded yet, play synthesized Vintage Barbie Waltz with 1.5s fade-in
        if (!recordCustomTrack.isPlaying()) {
          recordMelodyTimer -= delta;
          if (recordMelodyTimer <= 0) {
            const wStep = BARBIE_VINTAGE_WALTZ_STEPS[recordWaltzStepIdx % BARBIE_VINTAGE_WALTZ_STEPS.length];
            recordWaltzStepIdx++;
            recordMelodyTimer = wStep.delay;
            playArpeggioNotes([...wStep.freqs], 0.09, 0.042 * fadeVol, 'triangle');
          }
        }
      }

      // 7. Music Lounge: Grand Piano ("En Kadhale") Key Depression (`rotateX` by 0.05 rad), 1.5s Fade-In & Auto-Play Sequencer
      pianoCustomTrack.updateFade(delta);
      guitarCustomTrack.updateFade(delta);

      if (activeCameraMode === 'piano_play' && pianoAutoPlayActive) {
        pianoFadeElapsed = Math.min(1.5, pianoFadeElapsed + delta);
        const fadeRatio = THREE.MathUtils.clamp(pianoFadeElapsed / 1.5, 0.05, 1.0);
        pianoAutoStepTimer -= delta;
        if (pianoAutoStepTimer <= 0) {
          const step = EN_KADHALE_MELODY_STEPS[pianoAutoStepIndex];
          triggerPianoKeyNote(step.keyIdx, step.freq, step.padFreqs, step.accent * fadeRatio);
          pianoAutoStepTimer = step.delay;
          pianoAutoStepIndex = (pianoAutoStepIndex + 1) % EN_KADHALE_MELODY_STEPS.length;
        }
      }

      if (pianoPlayTimer > 0) {
        pianoPlayTimer = Math.max(0, pianoPlayTimer - delta);
      }
      const isMusicNotesActive = pianoPlayTimer > 0 || isRecordPlaying;
      goldNoteParticleMat.opacity = isMusicNotesActive ? 0.88 : 0.0;

      for (let k = 0; k < pianoKeyMeshes.length; k++) {
        const keyM = pianoKeyMeshes[k];
        if (pianoKeyDepressTimers[k] > 0) {
          pianoKeyDepressTimers[k] = Math.max(0, pianoKeyDepressTimers[k] - delta);
          const ratio = Math.min(1.0, pianoKeyDepressTimers[k] / 0.18);
          keyM.rotation.x = ratio * 0.05;
        } else {
          keyM.rotation.x = THREE.MathUtils.lerp(keyM.rotation.x, 0.0, 1 - Math.exp(-16.0 * delta));
        }
      }

      for (let n = 0; n < floatingNoteMeshes.length; n++) {
        const nm = floatingNoteMeshes[n];
        nm.visible = isMusicNotesActive;
        if (isMusicNotesActive) {
          const cycle = (elapsedTime * 0.65 + n * 0.14) % 1.0;
          const noteOriginX = pianoPlayTimer > 0 ? pianoX : recordPlayerX;
          const noteOriginZ = pianoPlayTimer > 0 ? pianoZ - 0.5 : recordPlayerZ;
          nm.position.set(
            noteOriginX + Math.cos(elapsedTime * 2.4 + n) * 0.42,
            1.28 + cycle * 1.45,
            noteOriginZ + Math.sin(elapsedTime * 2.4 + n) * 0.42,
          );
          nm.rotation.y = elapsedTime * 2.5 + n;
        }
      }

      // Acoustic Guitar Posture, String Vibration & "Thuli Thuli" Performance
      const isGuitarMode = activeCameraMode === 'guitar_play';
      guitarGuideGroup.visible = isGuitarMode || (cameraBlendAlpha > 0.02 && guitarGuideGroup.visible);
      if (!isGuitarMode && cameraBlendAlpha <= 0.02) {
        guitarGuideGroup.visible = false;
      }

      // Keep guitar centered, straight, and level facing the portrait camera (+Z, rotation.y = 0)
      const targetGuitarY = isGuitarMode ? 1.14 : 0.92;
      const targetGuitarTiltZ = isGuitarMode ? -0.38 : 0.0;
      const targetGuitarYaw = 0.0;
      guitarPivot.position.y = THREE.MathUtils.lerp(guitarPivot.position.y, targetGuitarY, 1 - Math.exp(-8.0 * delta));
      guitarPivot.rotation.y = THREE.MathUtils.lerp(guitarPivot.rotation.y, targetGuitarYaw, 1 - Math.exp(-8.0 * delta));

      if (guitarStrumTimer > 0) {
        guitarStrumTimer = Math.max(0, guitarStrumTimer - delta);
        const vib = Math.sin(elapsedTime * 48.0) * 0.04 * Math.min(1.0, guitarStrumTimer / 0.45);
        guitarPivot.rotation.z = targetGuitarTiltZ + vib;
      } else {
        guitarPivot.rotation.z = THREE.MathUtils.lerp(guitarPivot.rotation.z, targetGuitarTiltZ, 1 - Math.exp(-8.0 * delta));
      }

      // Animate 5 individual guitar strings with scale.x oscillation & golden-pink light pulse
      for (let s = 0; s < 5; s++) {
        if (guitarStringTimers[s] > 0) {
          guitarStringTimers[s] = Math.max(0, guitarStringTimers[s] - delta);
          const ratio = guitarStringTimers[s] / 0.72;
          const osc = Math.sin(elapsedTime * 76.0 + s * 1.3);
          guitarStringMeshes[s].position.x = guitarStringBaseX[s] + osc * 0.0085 * ratio;
          guitarStringMeshes[s].scale.x = 1.0 + Math.abs(osc) * 1.65 * ratio;
          guitarStringMats[s].emissiveIntensity = 0.25 + ratio * 2.6;
          pluckTargetRingMats[s].opacity = 0.65 + ratio * 0.35;
          pluckTargetRingMeshes[s].scale.setScalar(1.0 + ratio * 0.42);
        } else {
          guitarStringMeshes[s].position.x = guitarStringBaseX[s];
          guitarStringMeshes[s].scale.x = 1.0;
          guitarStringMats[s].emissiveIntensity = 0.2;
          pluckTargetRingMats[s].opacity = 0.55;
          pluckTargetRingMeshes[s].scale.setScalar(1.0);
        }
      }

      // Sequencer for "Thuli Thuli" (Paiyaa — Harris Jayaraj Upbeat Acoustic Groove) with 1.5s Volume Fade-In
      if (isGuitarMode) {
        if (guitarMelodyGuideActive) {
          guitarFadeElapsed = Math.min(1.5, guitarFadeElapsed + delta);
          const fadeRatio = THREE.MathUtils.clamp(guitarFadeElapsed / 1.5, 0.05, 1.0);
          guitarMelodyStepTimer -= delta;
          if (guitarMelodyStepTimer <= 0) {
            const step = THULI_THULI_RHYTHM_STEPS[guitarMelodyStepIndex];
            triggerGuitarStringPluck(
              step.stringIdx,
              (step.accent ?? 1.0) * fadeRatio,
              step.leadFreq,
              step.bassFreq,
              step.chordFreqs,
            );
            spawnSlidingGuitarCue(step, false, 1.35);
            guitarMelodyStepTimer = step.delay;
            guitarMelodyStepIndex = (guitarMelodyStepIndex + 1) % THULI_THULI_RHYTHM_STEPS.length;
          }
        } else {
          freePlayGuideTimer -= delta;
          if (freePlayGuideTimer <= 0) {
            const step = THULI_THULI_RHYTHM_STEPS[freePlayGuideStep % THULI_THULI_RHYTHM_STEPS.length];
            spawnSlidingGuitarCue(step, false, 0.65);
            freePlayGuideStep++;
            freePlayGuideTimer = 0.85;
          }
        }
      }

      // Advance sliding fretboard note cues toward the golden plucking line (y: +0.21 -> -0.175)
      for (let i = 0; i < slidingGuitarCues.length; i++) {
        const cue = slidingGuitarCues[i];
        if (!cue.active) continue;
        cue.progress += delta * cue.speed;
        const yPos = THREE.MathUtils.lerp(0.21, -0.175, cue.progress);
        cue.mesh.position.y = yPos;

        if (cue.progress >= 1.0 && !cue.plucked) {
          cue.plucked = true;
          pluckTargetRingMeshes[cue.stringIndex].scale.setScalar(1.28);
        }

        if (cue.progress >= 1.18) {
          cue.active = false;
          cue.mesh.visible = false;
        } else if (cue.progress > 1.0) {
          const fade = 1.0 - (cue.progress - 1.0) / 0.18;
          cue.mat.opacity = Math.max(0, fade);
          cue.mesh.scale.setScalar(1.0 + (1.0 - fade) * 0.45);
        }
      }

      // Animate crystalline golden '♪', '♫', and '♥' particles floating upward from Piano & Guitar
      for (let p = 0; p < soundholePopParticles.length; p++) {
        const sp = soundholePopParticles[p];
        if (!sp.active) continue;
        sp.age += delta;
        if (sp.age >= sp.maxAge) {
          sp.active = false;
          sp.mesh.visible = false;
          continue;
        }
        const u = sp.age / sp.maxAge;
        sp.mesh.position.x += sp.vx * delta + Math.sin(elapsedTime * 5.0 + p) * 0.0025;
        sp.mesh.position.y += sp.vy * delta;
        sp.mesh.position.z += sp.vz * delta;
        sp.mesh.rotation.y = isGuitarMode ? 0.0 : activeCameraMode === 'piano_play' ? 0.35 : 0.0;
        const popScale = u < 0.2 ? THREE.MathUtils.lerp(0.4, 1.28, u / 0.2) : THREE.MathUtils.lerp(1.28, 0.78, (u - 0.2) / 0.8);
        sp.mesh.scale.setScalar(popScale);
        sp.mat.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1.0 - (u - 0.15) / 0.85);
      }

      // 8. Indoor Glass Conservatory: Static Table-Top Engraved Inscription ("I Love u Mandu 💕") Facing the Player
      if (conservatoryWaveTimer > 0) {
        conservatoryWaveTimer = Math.max(0, conservatoryWaveTimer - delta);
      }

      const isInscriptionActive = conservatoryWaveTimer > 0;
      const targetPlaqueOpacity = isInscriptionActive ? 0.98 : 0.0;
      orchidLovePlaqueMat.opacity = THREE.MathUtils.lerp(
        orchidLovePlaqueMat.opacity,
        targetPlaqueOpacity,
        1 - Math.exp(-8.0 * delta),
      );
      orchidTableInscriptionGroup.visible = orchidLovePlaqueMat.opacity > 0.01;
      if (orchidTableInscriptionGroup.visible) {
        // Dynamically turn local yaw on the tabletop so the text always faces directly toward Harsha's position
        orchidTableInscriptionGroup.rotation.y = Math.atan2(lx - orchidTableX, lz - orchidTableZ);
      }

      for (let i = 0; i < reactivePlants.length; i++) {
        const rp = reactivePlants[i];
        const dist = Math.hypot(lx - rp.lx, lz - rp.lz);
        const isNear = dist <= 2.8 || conservatoryWaveTimer > 0;
        const targetOpen = isNear ? 1.0 : 0.0;
        rp.openRatio = THREE.MathUtils.lerp(rp.openRatio, targetOpen, 1 - Math.exp(-5.5 * delta));

        const scaleVal = 1.0 + rp.openRatio * 0.35;
        rp.petalGroup.scale.setScalar(scaleVal);
        rp.petalGroup.rotation.y = elapsedTime * (0.35 + rp.openRatio * 1.2) + i;

        if (dist <= 2.8 && dist > 0.05) {
          rp.petalGroup.rotation.x = THREE.MathUtils.clamp((lz - rp.lz) * 0.08 * rp.openRatio, -0.22, 0.22);
          rp.petalGroup.rotation.z = THREE.MathUtils.clamp(-(lx - rp.lx) * 0.08 * rp.openRatio, -0.22, 0.22);
        } else {
          rp.petalGroup.rotation.x = 0;
          rp.petalGroup.rotation.z = 0;
        }

        const wavePulse =
          conservatoryWaveTimer > 0 ? 0.55 + 0.45 * Math.sin(elapsedTime * 6.5 - i * 0.5) : 0.0;
        rp.glowMat.emissiveIntensity = 0.24 + rp.openRatio * 1.25 + wavePulse * 0.95;
      }
    },
  };
}
