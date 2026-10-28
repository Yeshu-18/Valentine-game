import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export type CreativeWingActiveCameraMode =
  | 'none'
  | 'portrait_atelier'
  | 'couture_boutique'
  | 'doll_playroom';

export interface CreativeWingCameraState {
  active: boolean;
  mode: CreativeWingActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
}

export interface CastleFloor2CreativeWingBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (key: string) => boolean;
  getCameraState: () => CreativeWingCameraState;
  applyLookDelta: (deltaYaw: number, deltaPitch: number) => void;
  update: (delta: number, clockTime: number, playerPos: THREE.Vector3, inputKeys?: Set<string>) => void;
}

// Module-scope scratch objects (Zero Per-Frame Allocations Contract)
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();

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

// ============================================================================
// PROCEDURAL CANVAS TEXTURES FOR ROOM HEADERS & BACKDROPS
// ============================================================================
function createSignboardTexture(
  tracker: ResourceTracker,
  text: string,
  subtext: string,
  bgHue: string,
  borderGold = '#d8b467',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHue;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = borderGold;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 480, 96);

    ctx.fillStyle = borderGold;
    ctx.font = 'bold 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50);

    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#fff1f2';
    ctx.fillText(subtext, 256, 86);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCastleFloor2CreativeWing(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor2CreativeWingBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor2CreativeWing';

  const colliders: CircleCollider[] = [];
  const partitionMeshes: THREE.Mesh[] = [];
  const dynamicObjects = new Set<THREE.Object3D>();

  const y0 = 5.25; // Floor 2 Mezzanine walkable top surface
  const yCeil = 9.9; // Floor 2 Ceiling underside

  const addLocalCollider = (lx: number, lz: number, radius: number) => {
    colliders.push({
      x: originX + lx,
      z: originZ + lz,
      radius,
      y: baseY + y0,
      height: 3.5,
    });
  };

  // Shared PointLight for Creative Wing (Warm Rosy Ambience)
  const wingLight = new THREE.PointLight('#fce7f3', 0.85, 18.0, 1.8);
  wingLight.position.set(12.0, y0 + 3.2, 0.0);
  group.add(wingLight);
  dynamicObjects.add(wingLight);

  // ============================================================================
  // ARCHITECTURAL WALLS, CEILINGS & ENCLOSURES FOR ALL 3 ROOMS
  // ============================================================================
  const wallMat = mats.creamStone;
  const marbleTrimMat = mats.blushRoseMarble;
  const goldTrimMat = mats.champagneGold;

  // 1. South-East Partition Wall separating Photography from Circulation (lz = -6.2)
  // Outer segment: lx 13.2 to 15.4 (center 14.3, w = 2.2)
  const partGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.2, 4.4, 0.38));
  partGeo1.translate(14.3, y0 + 2.2, -6.2);
  const partMesh1 = new THREE.Mesh(partGeo1, wallMat);

  // Inner segment: lx 8.8 to 10.8 (center 9.8, w = 2.0)
  const partGeo2 = tracker.trackGeo(new THREE.BoxGeometry(2.0, 4.4, 0.38));
  partGeo2.translate(9.8, y0 + 2.2, -6.2);
  const partMesh2 = new THREE.Mesh(partGeo2, wallMat);

  // Arch Header over doorway gap lx 10.8 to 13.2 (center 12.0, w = 2.4, h = 1.2)
  const archHeaderGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.2, 0.42));
  archHeaderGeo1.translate(12.0, y0 + 3.8, -6.2);
  const archHeaderMesh1 = new THREE.Mesh(archHeaderGeo1, marbleTrimMat);

  // Arch Trim ring
  const archTorusGeo1 = tracker.trackGeo(new THREE.TorusGeometry(1.2, 0.06, 8, 24, Math.PI));
  const archTrimMesh1 = new THREE.Mesh(archTorusGeo1, goldTrimMat);
  archTrimMesh1.position.set(12.0, y0 + 2.8, -6.2);

  group.add(partMesh1, partMesh2, archHeaderMesh1, archTrimMesh1);
  partitionMeshes.push(partMesh1, partMesh2, archHeaderMesh1);

  // Signboard: THE PORTRAIT ATELIER
  const photoSignTex = createSignboardTexture(
    tracker,
    '✦ THE PORTRAIT ATELIER ✦',
    'Haute Couture Photography & Fine Portraits',
    '#4c0519',
    '#fbbf24',
  );
  const signGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.1, 0.52));
  const photoSignMesh = new THREE.Mesh(
    signGeo,
    tracker.trackMat(new THREE.MeshBasicMaterial({ map: photoSignTex })),
  );
  photoSignMesh.position.set(12.0, y0 + 3.82, -5.98);
  group.add(photoSignMesh);

  // 2. Center-East West Facade for Mini Fashion Boutique (lx = 8.8, lz in [-5.8, +5.8])
  // Doorway in center: lz in [-1.2, +1.2]
  // South window wall: lz -5.8 to -1.2 (center -3.5, d = 4.6)
  const boutiqueWallSouthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 4.6));
  boutiqueWallSouthGeo.translate(8.8, y0 + 2.2, -3.5);
  const boutiqueWallSouth = new THREE.Mesh(boutiqueWallSouthGeo, wallMat);

  // North window wall: lz 1.2 to 5.8 (center 3.5, d = 4.6)
  const boutiqueWallNorthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 4.6));
  boutiqueWallNorthGeo.translate(8.8, y0 + 2.2, 3.5);
  const boutiqueWallNorth = new THREE.Mesh(boutiqueWallNorthGeo, wallMat);

  // Door Header over lz in [-1.2, +1.2] (center 0.0, d = 2.4, h = 1.2)
  const boutiqueDoorHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 1.2, 2.4));
  boutiqueDoorHeaderGeo.translate(8.8, y0 + 3.8, 0.0);
  const boutiqueDoorHeader = new THREE.Mesh(boutiqueDoorHeaderGeo, marbleTrimMat);

  // Arch Trim ring
  const boutiqueArchTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(1.2, 0.06, 8, 24, Math.PI));
  const boutiqueArchTrim = new THREE.Mesh(boutiqueArchTorusGeo, goldTrimMat);
  boutiqueArchTrim.rotation.y = Math.PI / 2;
  boutiqueArchTrim.position.set(8.8, y0 + 2.8, 0.0);

  group.add(boutiqueWallSouth, boutiqueWallNorth, boutiqueDoorHeader, boutiqueArchTrim);
  partitionMeshes.push(boutiqueWallSouth, boutiqueWallNorth, boutiqueDoorHeader);

  // Signboard: HARSHA'S COUTURE CORNER
  const boutiqueSignTex = createSignboardTexture(
    tracker,
    "♕ HARSHA'S COUTURE CORNER ♕",
    'Bespoke Castle Fashion, Accessories & Tailoring',
    '#831843',
    '#fde047',
  );
  const boutiqueSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.2, 0.52));
  boutiqueSignGeo.rotateY(-Math.PI / 2);
  const boutiqueSignMesh = new THREE.Mesh(
    boutiqueSignGeo,
    tracker.trackMat(new THREE.MeshBasicMaterial({ map: boutiqueSignTex })),
  );
  boutiqueSignMesh.position.set(8.58, y0 + 3.82, 0.0);
  group.add(boutiqueSignMesh);

  // 3. North-East Partition Wall separating Doll Playroom from Circulation (lz = +6.2)
  // Outer segment: lx 13.2 to 15.4 (center 14.3, w = 2.2)
  const dollWallGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.2, 4.4, 0.38));
  dollWallGeo1.translate(14.3, y0 + 2.2, 6.2);
  const dollWallMesh1 = new THREE.Mesh(dollWallGeo1, wallMat);

  // Inner segment: lx 8.8 to 10.8 (center 9.8, w = 2.0)
  const dollWallGeo2 = tracker.trackGeo(new THREE.BoxGeometry(2.0, 4.4, 0.38));
  dollWallGeo2.translate(9.8, y0 + 2.2, 6.2);
  const dollWallMesh2 = new THREE.Mesh(dollWallGeo2, wallMat);

  // Arch Header over doorway gap lx 10.8 to 13.2 (center 12.0, w = 2.4, h = 1.2)
  const dollArchHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.2, 0.42));
  dollArchHeaderGeo.translate(12.0, y0 + 3.8, 6.2);
  const dollArchHeaderMesh = new THREE.Mesh(dollArchHeaderGeo, marbleTrimMat);

  // Arch Trim ring
  const dollArchTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(1.2, 0.06, 8, 24, Math.PI));
  const dollArchTrimMesh = new THREE.Mesh(dollArchTorusGeo, goldTrimMat);
  dollArchTrimMesh.position.set(12.0, y0 + 2.8, 6.2);

  // West boundary wall alongside staircase corridor: lx = 9.2, lz in [6.2, 14.8]
  const dollWestWallGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 8.6));
  dollWestWallGeo.translate(9.2, y0 + 2.2, 10.5);
  const dollWestWallMesh = new THREE.Mesh(dollWestWallGeo, wallMat);

  group.add(dollWallMesh1, dollWallMesh2, dollArchHeaderMesh, dollArchTrimMesh, dollWestWallMesh);
  partitionMeshes.push(dollWallMesh1, dollWallMesh2, dollArchHeaderMesh, dollWestWallMesh);

  // Signboard: THE LITTLE DREAM WORLD
  const dollSignTex = createSignboardTexture(
    tracker,
    '♡ THE LITTLE DREAM WORLD ♡',
    'Handcrafted Miniatures, Doll Castle & Childhood Wonder',
    '#581c87',
    '#f472b6',
  );
  const dollSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.1, 0.52));
  const dollSignMesh = new THREE.Mesh(
    dollSignGeo,
    tracker.trackMat(new THREE.MeshBasicMaterial({ map: dollSignTex })),
  );
  dollSignMesh.position.set(12.0, y0 + 3.82, 5.98);
  group.add(dollSignMesh);

  // ============================================================================
  // ROOM 1: 📸 THE PORTRAIT ATELIER (PHOTOGRAPHY STUDIO)
  // Location: lx in [8.8, 15.3], lz in [-14.8, -6.4], Center: (12.05, -10.6)
  // ============================================================================
  const photoGroup = new THREE.Group();
  photoGroup.name = 'PhotographyStudio';
  group.add(photoGroup);

  // 1A. Large Circular Studio Inset Rug (Pearl base with subtle gold ring)
  const photoRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.8, 2.8, 0.024, 32));
  photoRugGeo.translate(0, 0.012, 0);
  const photoRugMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fff5f7',
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  const photoRug = new THREE.Mesh(photoRugGeo, photoRugMat);
  photoRug.position.set(12.05, y0, -10.6);
  photoRug.receiveShadow = true;
  photoGroup.add(photoRug);

  const photoRugGoldRingGeo = tracker.trackGeo(new THREE.RingGeometry(2.55, 2.7, 32));
  photoRugGoldRingGeo.rotateX(-Math.PI / 2);
  const photoRugGoldRing = new THREE.Mesh(photoRugGoldRingGeo, goldTrimMat);
  photoRugGoldRing.position.set(12.05, y0 + 0.026, -10.6);
  photoGroup.add(photoRugGoldRing);

  // 1B. Hero Photography Set on East Wall (lx = 15.15, lz = -10.6)
  const backdropFrameGroup = new THREE.Group();
  backdropFrameGroup.position.set(15.15, y0, -10.6);

  // Champagne-gold arch frame
  const bdPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 3.8, 10));
  bdPillarGeo.translate(0, 1.9, 0);
  const bdPillarL = new THREE.Mesh(bdPillarGeo, goldTrimMat);
  bdPillarL.position.set(0, 0, -2.2);
  const bdPillarR = new THREE.Mesh(bdPillarGeo, goldTrimMat);
  bdPillarR.position.set(0, 0, 2.2);

  const bdArchGeo = tracker.trackGeo(new THREE.TorusGeometry(2.2, 0.08, 8, 28, Math.PI));
  bdArchGeo.rotateY(Math.PI / 2);
  const bdArch = new THREE.Mesh(bdArchGeo, goldTrimMat);
  bdArch.position.set(0, 3.8, 0);
  backdropFrameGroup.add(bdPillarL, bdPillarR, bdArch);

  // Backdrop Presets (6 Physical Canvas Textures)
  const BACKDROP_NAMES = [
    'Romantic Garden',
    'Dream Castle',
    'Starry Night',
    'Aurora Horizon',
    'Cloud Dream',
    'Pure Studio Glamour',
  ];

  const backdropTextures: THREE.CanvasTexture[] = [];
  const createPresetCanvas = (presetIdx: number): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 384;
    const cx = c.getContext('2d');
    if (cx) {
      if (presetIdx === 0) {
        // Romantic Garden
        const grad = cx.createLinearGradient(0, 0, 0, 384);
        grad.addColorStop(0, '#fce7f3');
        grad.addColorStop(0.5, '#fbcfe8');
        grad.addColorStop(1, '#a7f3d0');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
        // Distant castle silhouette
        cx.fillStyle = 'rgba(219, 39, 119, 0.25)';
        cx.fillRect(200, 180, 112, 120);
        cx.beginPath();
        cx.moveTo(256, 110);
        cx.lineTo(200, 180);
        cx.lineTo(312, 180);
        cx.closePath();
        cx.fill();
      } else if (presetIdx === 1) {
        // Dream Castle
        const grad = cx.createLinearGradient(0, 0, 0, 384);
        grad.addColorStop(0, '#fff1f2');
        grad.addColorStop(0.6, '#fda4af');
        grad.addColorStop(1, '#e11d48');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
        cx.fillStyle = '#fef08a';
        cx.font = 'bold 36px Georgia, serif';
        cx.textAlign = 'center';
        cx.fillText('👑 ROYAL DREAM 👑', 256, 180);
      } else if (presetIdx === 2) {
        // Starry Night
        const grad = cx.createLinearGradient(0, 0, 0, 384);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.7, '#312e81');
        grad.addColorStop(1, '#4c1d95');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
        cx.fillStyle = '#fef08a';
        for (let i = 0; i < 40; i++) {
          const sx = (i * 123) % 512;
          const sy = (i * 79) % 280;
          cx.fillRect(sx, sy, 2, 2);
        }
        cx.beginPath();
        cx.arc(420, 80, 24, 0, Math.PI * 2);
        cx.fill();
      } else if (presetIdx === 3) {
        // Aurora Horizon
        const grad = cx.createLinearGradient(0, 0, 512, 384);
        grad.addColorStop(0, '#064e3b');
        grad.addColorStop(0.5, '#065f46');
        grad.addColorStop(1, '#0f172a');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
        cx.fillStyle = 'rgba(52, 211, 153, 0.45)';
        cx.beginPath();
        cx.moveTo(0, 120);
        cx.bezierCurveTo(180, 40, 320, 200, 512, 100);
        cx.lineTo(512, 220);
        cx.bezierCurveTo(320, 300, 180, 150, 0, 240);
        cx.closePath();
        cx.fill();
      } else if (presetIdx === 4) {
        // Cloud Dream
        const grad = cx.createLinearGradient(0, 0, 0, 384);
        grad.addColorStop(0, '#bae6fd');
        grad.addColorStop(0.6, '#e0e7ff');
        grad.addColorStop(1, '#fbcfe8');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
        cx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        [
          [120, 220, 70],
          [260, 200, 95],
          [390, 240, 80],
        ].forEach(([cx0, cy0, cr]) => {
          cx.beginPath();
          cx.arc(cx0, cy0, cr, 0, Math.PI * 2);
          cx.fill();
        });
      } else {
        // Pure Studio Glamour
        const grad = cx.createRadialGradient(256, 192, 20, 256, 192, 260);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#fff1f2');
        grad.addColorStop(1, '#fce7f3');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, 512, 384);
      }
    }
    const t = tracker.trackTex(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };

  for (let i = 0; i < 6; i++) {
    backdropTextures.push(createPresetCanvas(i));
  }

  let activeBackdropIndex = 0;
  const backdropScreenGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.3, 3.6));
  backdropScreenGeo.rotateY(-Math.PI / 2);
  const backdropScreenMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: backdropTextures[0],
      side: THREE.FrontSide,
    }),
  );
  const backdropScreenMesh = new THREE.Mesh(backdropScreenGeo, backdropScreenMat);
  backdropScreenMesh.position.set(-0.02, 1.9, 0);
  backdropFrameGroup.add(backdropScreenMesh);
  photoGroup.add(backdropFrameGroup);

  // 1C. Believable Studio Camera on Tripod at (lx = 10.2, lz = -10.6)
  const cameraRig = new THREE.Group();
  cameraRig.position.set(10.2, y0, -10.6);
  cameraRig.rotation.y = Math.PI / 2; // Facing the backdrop on the East wall

  // Tripod Legs
  const legGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 1.35, 8));
  legGeo.translate(0, 0.67, 0);
  [-0.32, 0, 0.32].forEach((xOff, idx) => {
    const leg = new THREE.Mesh(legGeo, goldTrimMat);
    leg.position.set(xOff, 0, idx === 1 ? -0.28 : 0.18);
    leg.rotation.z = xOff * -0.3;
    cameraRig.add(leg);
  });

  // Camera Body & Lens
  const camBodyGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.18));
  camBodyGeo.translate(0, 1.4, 0);
  const camBody = new THREE.Mesh(camBodyGeo, mats.velvetPlum);

  const camLensGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.28, 16));
  camLensGeo.rotateX(Math.PI / 2);
  camLensGeo.translate(0, 1.4, 0.18);
  const camLens = new THREE.Mesh(camLensGeo, goldTrimMat);

  const camViewfinderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.08, 0.06));
  camViewfinderGeo.translate(0, 1.54, -0.04);
  const camViewfinder = new THREE.Mesh(camViewfinderGeo, mats.champagneGold);

  // Red recording indicator light
  const camLedGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 8));
  camLedGeo.translate(0.12, 1.46, 0.09);
  const camLedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#ef4444',
      emissiveIntensity: 1.5,
      roughness: 0.2,
    }),
  );
  const camLed = new THREE.Mesh(camLedGeo, camLedMat);
  cameraRig.add(camBody, camLens, camViewfinder, camLed);
  photoGroup.add(cameraRig);
  addLocalCollider(10.2, -10.6, 0.45);

  // 1D. Studio Lighting Equipment
  // Key Light Softbox on stand at (lx = 11.2, lz = -12.4)
  const softboxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.95, 0.18));
  softboxGeo.translate(0, 2.2, 0);
  const softboxFaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.64, 0.9));
  softboxFaceGeo.translate(0, 2.2, 0.1);
  const softboxFaceMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fffbeb',
      emissive: '#fef08a',
      emissiveIntensity: 1.25,
      roughness: 0.1,
    }),
  );

  const softboxStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 8));
  softboxStandGeo.translate(0, 1.1, 0);

  const keyLight = new THREE.Group();
  keyLight.position.set(11.2, y0, -12.4);
  keyLight.rotation.y = Math.PI * 0.35;
  const keyStand = new THREE.Mesh(softboxStandGeo, goldTrimMat);
  const keyBox = new THREE.Mesh(softboxGeo, mats.velvetPlum);
  const keyFace = new THREE.Mesh(softboxFaceGeo, softboxFaceMat);
  keyLight.add(keyStand, keyBox, keyFace);
  photoGroup.add(keyLight);
  addLocalCollider(11.2, -12.4, 0.38);

  // Fill Light Softbox on stand at (lx = 11.2, lz = -8.8)
  const fillLight = new THREE.Group();
  fillLight.position.set(11.2, y0, -8.8);
  fillLight.rotation.y = Math.PI * 0.65;
  const fillStand = new THREE.Mesh(softboxStandGeo, goldTrimMat);
  const fillBox = new THREE.Mesh(softboxGeo, mats.velvetPlum);
  const fillFace = new THREE.Mesh(softboxFaceGeo, softboxFaceMat);
  fillLight.add(fillStand, fillBox, fillFace);
  photoGroup.add(fillLight);
  addLocalCollider(11.2, -8.8, 0.38);

  // Circular Reflector on stand at (lx = 13.8, lz = -8.5)
  const reflectorGroup = new THREE.Group();
  reflectorGroup.position.set(13.8, y0, -8.5);
  reflectorGroup.rotation.y = -Math.PI * 0.25;
  const reflDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.48, 24));
  reflDiscGeo.translate(0, 1.45, 0);
  const reflMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
      metalness: 0.85,
    }),
  );
  const reflMesh = new THREE.Mesh(reflDiscGeo, reflMat);
  const reflStand = new THREE.Mesh(softboxStandGeo, goldTrimMat);
  reflectorGroup.add(reflStand, reflMesh);
  photoGroup.add(reflectorGroup);
  addLocalCollider(13.8, -8.5, 0.35);

  // 1E. Makeup / Preparation Corner along South Wall (lx = 13.8, lz = -14.6)
  const vanityGroup = new THREE.Group();
  vanityGroup.position.set(13.8, y0, -14.6);
  const vTableGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 0.76, 0.65));
  vTableGeo.translate(0, 0.38, 0);
  const vTable = new THREE.Mesh(vTableGeo, wallMat);
  vTable.castShadow = true;

  const vMirrorGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.1, 1.2));
  vMirrorGeo.translate(0, 1.45, 0.32);
  const vMirror = new THREE.Mesh(vMirrorGeo, mats.crystalGlass);

  const vMirrorFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(1.22, 1.32, 0.06));
  vMirrorFrameGeo.translate(0, 1.45, 0.3);
  const vMirrorFrame = new THREE.Mesh(vMirrorFrameGeo, goldTrimMat);
  vanityGroup.add(vTable, vMirrorFrame, vMirror);
  photoGroup.add(vanityGroup);
  addLocalCollider(13.8, -14.6, 0.55);

  // 1F. Wardrobe Corner Clothing Rack along North Wall (lx = 9.8, lz = -7.0)
  const rackGroup = new THREE.Group();
  rackGroup.position.set(9.8, y0, -7.0);
  const rackRailGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8));
  rackRailGeo.rotateZ(Math.PI / 2);
  rackRailGeo.translate(0, 1.45, 0);
  const rackRail = new THREE.Mesh(rackRailGeo, goldTrimMat);

  const rackPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8));
  rackPostGeo.translate(0, 0.75, 0);
  const rackPostL = new THREE.Mesh(rackPostGeo, goldTrimMat);
  rackPostL.position.x = -0.85;
  const rackPostR = new THREE.Mesh(rackPostGeo, goldTrimMat);
  rackPostR.position.x = 0.85;
  rackGroup.add(rackRail, rackPostL, rackPostR);

  // 5 Hanging dresses (shared cone geometries with pastel material variants)
  const dressGeo = tracker.trackGeo(new THREE.ConeGeometry(0.24, 0.75, 12));
  dressGeo.translate(0, 0.95, 0);
  const dressColors = ['#f472b6', '#c084fc', '#38bdf8', '#fbcfe8', '#fef08a'];
  for (let d = 0; d < 5; d++) {
    const dMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: dressColors[d],
        roughness: 0.35,
        metalness: 0.1,
      }),
    );
    const dressMesh = new THREE.Mesh(dressGeo, dMat);
    dressMesh.position.set(-0.6 + d * 0.3, 0, 0);
    rackGroup.add(dressMesh);
  }
  photoGroup.add(rackGroup);
  addLocalCollider(9.8, -7.0, 0.45);

  // 1G. Micro Props & Details (Camera cases, clapperboard, framed contact sheet)
  const caseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.28, 0.34));
  caseGeo.translate(0, 0.14, 0);
  const caseMesh = new THREE.Mesh(caseGeo, mats.velvetPlum);
  caseMesh.position.set(10.6, y0, -14.2);
  photoGroup.add(caseMesh);

  // ============================================================================
  // ROOM 2: 👗 HARSHA'S COUTURE CORNER (MINI FASHION BOUTIQUE)
  // Location: lx in [8.8, 15.3], lz in [-5.8, +5.8], Center: (12.05, 0.0)
  // ============================================================================
  const boutiqueGroup = new THREE.Group();
  boutiqueGroup.name = 'MiniFashionBoutique';
  group.add(boutiqueGroup);

  // 2A. Soft Pink-and-White Marble Floor Inset
  const bFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(6.3, 0.02, 11.4));
  bFloorGeo.translate(12.05, y0 + 0.01, 0);
  const bFloor = new THREE.Mesh(bFloorGeo, marbleTrimMat);
  bFloor.receiveShadow = true;
  boutiqueGroup.add(bFloor);

  // 2B. Glass Display Window & Hero Mannequin (Facade lx = 8.8, lz = -3.5)
  const windowDisplayGroup = new THREE.Group();
  windowDisplayGroup.position.set(9.4, y0, -3.5);

  const winGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.6, 2.6));
  winGlassGeo.rotateY(Math.PI / 2);
  winGlassGeo.translate(-0.55, 1.45, 0);
  const winGlass = new THREE.Mesh(winGlassGeo, mats.crystalGlass);
  windowDisplayGroup.add(winGlass);

  // Hero Mannequin on ornate pedestal
  const pedGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.24, 20));
  pedGeo.translate(0, 0.12, 0);
  const ped = new THREE.Mesh(pedGeo, goldTrimMat);

  const heroSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.52, 1.05, 16));
  heroSkirtGeo.translate(0, 0.8, 0);
  const heroBodiceGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.18, 0.48, 14));
  heroBodiceGeo.translate(0, 1.4, 0);
  const heroGownMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#e11d48',
      emissive: '#be123c',
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.2,
    }),
  );
  const heroSkirt = new THREE.Mesh(heroSkirtGeo, heroGownMat);
  const heroBodice = new THREE.Mesh(heroBodiceGeo, heroGownMat);
  windowDisplayGroup.add(ped, heroSkirt, heroBodice);
  boutiqueGroup.add(windowDisplayGroup);
  addLocalCollider(9.4, -3.5, 0.65);

  // Second Mannequin on North Facade Window (lx = 9.4, lz = 3.5)
  const mannequin2Group = new THREE.Group();
  mannequin2Group.position.set(9.4, y0, 3.5);
  const ped2 = new THREE.Mesh(pedGeo, goldTrimMat);
  const skirt2 = new THREE.Mesh(heroSkirtGeo, mats.softLavender);
  const bodice2 = new THREE.Mesh(heroBodiceGeo, mats.softLavender);
  mannequin2Group.add(ped2, skirt2, bodice2);
  boutiqueGroup.add(mannequin2Group);
  addLocalCollider(9.4, 3.5, 0.65);

  // 2C. Boutique Chandelier with crystal drops at center (lx = 12.05, y = y0 + 3.8, lz = 0)
  const bChandelier = new THREE.Group();
  bChandelier.position.set(12.05, y0 + 3.6, 0);
  const bChRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.65, 0.04, 8, 20));
  bChRingGeo.rotateX(Math.PI / 2);
  const bChRing = new THREE.Mesh(bChRingGeo, goldTrimMat);
  bChandelier.add(bChRing);

  // 6 Crystal drops
  const dropGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.08, 0));
  for (let d = 0; d < 6; d++) {
    const ang = (d * Math.PI * 2) / 6;
    const drop = new THREE.Mesh(dropGeo, mats.crystalGlass);
    drop.position.set(Math.cos(ang) * 0.65, -0.22, Math.sin(ang) * 0.65);
    drop.scale.set(1, 1.8, 1);
    bChandelier.add(drop);
  }
  boutiqueGroup.add(bChandelier);

  // 2D. Jewellery Display Counter along East Wall (lx = 14.8, lz = 0.0)
  const jewCounterGroup = new THREE.Group();
  jewCounterGroup.position.set(14.8, y0, 0.0);
  const jCaseBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.72, 0.85, 2.8));
  jCaseBaseGeo.translate(0, 0.425, 0);
  const jCaseBase = new THREE.Mesh(jCaseBaseGeo, wallMat);

  const jGlassGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.35, 2.7));
  jGlassGeo.translate(0, 1.025, 0);
  const jGlass = new THREE.Mesh(jGlassGeo, mats.crystalGlass);

  // Velvet Display Pad with Glowing Tiara & Necklace
  const tiaraGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.035, 6, 16, Math.PI));
  tiaraGeo.rotateX(Math.PI / 2);
  tiaraGeo.translate(0, 0.9, -0.4);
  const tiara = new THREE.Mesh(tiaraGeo, goldTrimMat);

  jewCounterGroup.add(jCaseBase, jGlass, tiara);
  boutiqueGroup.add(jewCounterGroup);
  addLocalCollider(14.8, 0.0, 0.6);

  // 2E. Shoe Tiered Display along North Wall (lx = 12.0, lz = 5.2)
  const shoeRackGroup = new THREE.Group();
  shoeRackGroup.position.set(12.0, y0, 5.2);
  const sShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 0.04, 0.45));
  [0.2, 0.5, 0.8].forEach((shY) => {
    const shelf = new THREE.Mesh(sShelfGeo, goldTrimMat);
    shelf.position.y = shY;
    shoeRackGroup.add(shelf);
  });
  // Pairs of shoes on shelves
  const shoeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.05, 0.16));
  for (let sh = 0; sh < 6; sh++) {
    const shoeL = new THREE.Mesh(shoeGeo, mats.blushRoseMarble);
    shoeL.position.set(-0.8 + sh * 0.3, 0.25, -0.05);
    const shoeR = new THREE.Mesh(shoeGeo, mats.blushRoseMarble);
    shoeR.position.set(-0.8 + sh * 0.3 + 0.1, 0.25, -0.05);
    shoeRackGroup.add(shoeL, shoeR);
  }
  boutiqueGroup.add(shoeRackGroup);
  addLocalCollider(12.0, 5.2, 0.45);

  // 2F. Handbag Display Shelves along South Wall (lx = 12.0, lz = -5.2)
  const handbagRackGroup = new THREE.Group();
  handbagRackGroup.position.set(12.0, y0, -5.2);
  const hbShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 0.04, 0.38));
  [0.4, 0.85, 1.3].forEach((hY) => {
    const shelf = new THREE.Mesh(hbShelfGeo, goldTrimMat);
    shelf.position.y = hY;
    handbagRackGroup.add(shelf);
  });
  // Pastel mini handbags
  const bagGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.16, 0.1));
  const bagColors = ['#f472b6', '#fda4af', '#fef08a', '#c084fc', '#38bdf8'];
  for (let b = 0; b < 5; b++) {
    const bMat = tracker.trackMat(new THREE.MeshStandardMaterial({ color: bagColors[b], roughness: 0.3 }));
    const bag = new THREE.Mesh(bagGeo, bMat);
    bag.position.set(-0.8 + b * 0.38, 0.95, 0);
    handbagRackGroup.add(bag);
  }
  boutiqueGroup.add(handbagRackGroup);
  addLocalCollider(12.0, -5.2, 0.45);

  // 2G. Mini Tailoring Station along East Wall (lx = 14.6, lz = 3.6)
  const tailorGroup = new THREE.Group();
  tailorGroup.position.set(14.6, y0, 3.6);
  const tTableGeo = tracker.trackGeo(new THREE.BoxGeometry(0.75, 0.74, 1.4));
  tTableGeo.translate(0, 0.37, 0);
  const tTable = new THREE.Mesh(tTableGeo, wallMat);

  // Sewing machine
  const smBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.38));
  smBaseGeo.translate(0, 0.76, 0);
  const smArmGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.22, 0.14));
  smArmGeo.translate(-0.06, 0.88, -0.1);
  const sm = new THREE.Mesh(smBaseGeo, goldTrimMat);
  const smArm = new THREE.Mesh(smArmGeo, goldTrimMat);
  tailorGroup.add(tTable, sm, smArm);
  boutiqueGroup.add(tailorGroup);
  addLocalCollider(14.6, 3.6, 0.55);

  // 2H. Semi-Private Fitting Area at (lx = 14.6, lz = -3.6)
  const fittingGroup = new THREE.Group();
  fittingGroup.position.set(14.6, y0, -3.6);
  const curtainRailGeo = tracker.trackGeo(new THREE.TorusGeometry(0.85, 0.03, 8, 16, Math.PI));
  curtainRailGeo.rotateY(Math.PI / 2);
  curtainRailGeo.translate(0, 2.6, 0);
  const curtainRail = new THREE.Mesh(curtainRailGeo, goldTrimMat);

  // Floor mirror
  const fMirrorGeo = tracker.trackGeo(new THREE.BoxGeometry(0.12, 1.85, 0.85));
  fMirrorGeo.translate(-0.2, 0.95, 0);
  const fMirror = new THREE.Mesh(fMirrorGeo, mats.champagneGold);
  fittingGroup.add(curtainRail, fMirror);
  boutiqueGroup.add(fittingGroup);
  addLocalCollider(14.6, -3.6, 0.55);

  // ============================================================================
  // ROOM 3: 🧸 THE LITTLE DREAM WORLD (DOLL PLAYROOM)
  // Location: lx in [9.2, 15.3], lz in [+6.4, +14.8], Center: (12.25, +10.6)
  // ============================================================================
  const dollRoomGroup = new THREE.Group();
  dollRoomGroup.name = 'DollPlayroom';
  group.add(dollRoomGroup);

  // 3A. Giant Soft Circular Play Rug
  const dRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.65, 2.65, 0.024, 32));
  dRugGeo.translate(0, 0.012, 0);
  const dRugMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fdf4ff',
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  const dRug = new THREE.Mesh(dRugGeo, dRugMat);
  dRug.position.set(12.25, y0, 10.6);
  dRug.receiveShadow = true;
  dollRoomGroup.add(dRug);

  // 3B. HERO OBJECT: Large Tabletop Miniature Castle (lx = 12.25, lz = 10.6)
  const miniCastleTable = new THREE.Group();
  miniCastleTable.position.set(12.25, y0, 10.6);

  // Sturdy round table base
  const tableBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.6, 1.7, 0.55, 24));
  tableBaseGeo.translate(0, 0.275, 0);
  const tableBase = new THREE.Mesh(tableBaseGeo, mats.creamStone);
  miniCastleTable.add(tableBase);

  // Tabletop Miniature Castle Structure
  const mcGroup = new THREE.Group();
  mcGroup.position.set(0, 0.55, 0);

  // Central Keep
  const mcKeepGeo = tracker.trackGeo(new THREE.BoxGeometry(0.65, 0.85, 0.65));
  mcKeepGeo.translate(0, 0.425, 0);
  const mcKeep = new THREE.Mesh(mcKeepGeo, mats.blushRoseMarble);

  // Central Spire
  const mcSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 0.85, 12));
  mcSpireGeo.translate(0, 1.25, 0);
  const mcSpire = new THREE.Mesh(mcSpireGeo, mats.powderBlueSpire);
  mcGroup.add(mcKeep, mcSpire);

  // 4 Corner Towers on Miniature Castle
  const mcTowerGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 0.75, 10));
  mcTowerGeo.translate(0, 0.375, 0);
  const mcTowerRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.45, 10));
  mcTowerRoofGeo.translate(0, 0.95, 0);

  const towerOffsets = [
    [-0.38, -0.38],
    [0.38, -0.38],
    [-0.38, 0.38],
    [0.38, 0.38],
  ];
  towerOffsets.forEach(([tx, tz]) => {
    const tw = new THREE.Mesh(mcTowerGeo, mats.pearlWhite);
    tw.position.set(tx, 0, tz);
    const tr = new THREE.Mesh(mcTowerRoofGeo, mats.powderBlueSpire);
    tr.position.set(tx, 0, tz);
    mcGroup.add(tw, tr);
  });

  // Miniature Village Houses around Castle on Tabletop
  const villageHouseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.16, 0.18));
  villageHouseGeo.translate(0, 0.08, 0);
  const villageRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(0.14, 0.16, 4));
  villageRoofGeo.rotateY(Math.PI / 4);
  villageRoofGeo.translate(0, 0.22, 0);

  const villageSpots = [
    [0.9, 0.2],
    [0.85, -0.5],
    [-0.85, 0.4],
    [-0.75, -0.6],
    [0.3, 0.9],
    [-0.3, 0.95],
  ];
  villageSpots.forEach(([vx, vz]) => {
    const h = new THREE.Mesh(villageHouseGeo, mats.blushRoseMarble);
    h.position.set(vx, 0, vz);
    const r = new THREE.Mesh(villageRoofGeo, mats.powderBlueSpire);
    r.position.set(vx, 0, vz);
    mcGroup.add(h, r);
  });

  // Miniature rotating windmill
  const windmillBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.1, 0.14, 0.38, 8));
  windmillBaseGeo.translate(0, 0.19, 0);
  const windmillBase = new THREE.Mesh(windmillBaseGeo, mats.creamStone);
  windmillBase.position.set(0.65, 0, -0.85);

  const windmillBlades = new THREE.Group();
  windmillBlades.position.set(0.65, 0.36, -0.74);
  const bladeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.04, 0.36, 0.015));
  const b1 = new THREE.Mesh(bladeGeo, goldTrimMat);
  const b2 = new THREE.Mesh(bladeGeo, goldTrimMat);
  b2.rotation.z = Math.PI / 2;
  windmillBlades.add(b1, b2);
  mcGroup.add(windmillBase, windmillBlades);
  dynamicObjects.add(windmillBlades);

  miniCastleTable.add(mcGroup);
  dollRoomGroup.add(miniCastleTable);
  addLocalCollider(12.25, 10.6, 1.45);

  // 3C. Multi-Room Visible Dollhouse along East Wall (lx = 14.8, lz = 10.6)
  const dollhouseGroup = new THREE.Group();
  dollhouseGroup.position.set(14.8, y0, 10.6);
  dollhouseGroup.rotation.y = -Math.PI / 2; // Facing into room

  const dhFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.8, 0.65));
  dhFrameGeo.translate(0, 0.9, 0);
  const dhFrame = new THREE.Mesh(dhFrameGeo, mats.creamStone);

  const dhDividerGeo = tracker.trackGeo(new THREE.BoxGeometry(0.06, 1.7, 0.62));
  dhDividerGeo.translate(0, 0.9, 0);
  const dhDividerV = new THREE.Mesh(dhDividerGeo, goldTrimMat);

  const dhFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(2.3, 0.06, 0.62));
  dhFloorGeo.translate(0, 0.9, 0);
  const dhDividerH = new THREE.Mesh(dhFloorGeo, goldTrimMat);
  dollhouseGroup.add(dhFrame, dhDividerV, dhDividerH);
  dollRoomGroup.add(dollhouseGroup);
  addLocalCollider(14.8, 10.6, 0.65);

  // 3D. LEGO-Style Construction Corner along South Wall (lx = 10.4, lz = 7.4)
  const legoTableGroup = new THREE.Group();
  legoTableGroup.position.set(10.4, y0, 7.4);
  const legoTableBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 0.55, 1.0));
  legoTableBaseGeo.translate(0, 0.275, 0);
  const legoTable = new THREE.Mesh(legoTableBaseGeo, mats.softLavender);
  legoTableGroup.add(legoTable);

  // 25 Colorful building block pieces
  const brickGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.06, 0.12));
  const brickColors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#ec4899'];
  for (let b = 0; b < 25; b++) {
    const bMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: brickColors[b % 5],
        roughness: 0.2,
      }),
    );
    const brick = new THREE.Mesh(brickGeo, bMat);
    const row = Math.floor(b / 5);
    const col = b % 5;
    brick.position.set(-0.35 + col * 0.16, 0.58 + (b % 3) * 0.06, -0.3 + row * 0.14);
    legoTableGroup.add(brick);
  }
  dollRoomGroup.add(legoTableGroup);
  addLocalCollider(10.4, 7.4, 0.55);

  // 3E. Toy Shelf & Miniature Library along North Wall (lx = 12.2, lz = 14.6)
  const toyShelfGroup = new THREE.Group();
  toyShelfGroup.position.set(12.2, y0, 14.6);
  const tsShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.6, 1.6, 0.38));
  tsShelfGeo.translate(0, 0.8, 0);
  const toyShelf = new THREE.Mesh(tsShelfGeo, wallMat);
  toyShelfGroup.add(toyShelf);

  // Teddy bears & plushies
  const bearHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.12, 10, 10));
  bearHeadGeo.translate(0, 1.15, 0.15);
  const bearBodyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.16, 10, 10));
  bearBodyGeo.translate(0, 0.95, 0.15);
  const bearMat = tracker.trackMat(new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.9 }));
  const bearHead = new THREE.Mesh(bearHeadGeo, bearMat);
  const bearBody = new THREE.Mesh(bearBodyGeo, bearMat);
  toyShelfGroup.add(bearHead, bearBody);
  dollRoomGroup.add(toyShelfGroup);
  addLocalCollider(12.2, 14.6, 0.55);

  // Lock static hierarchy so non-animated meshes have zero per-frame matrix calculation cost
  lockStaticHierarchy(group, dynamicObjects);

  // ============================================================================
  // INTERACTIVE CAMERA & BACKDROP SYSTEM
  // ============================================================================
  let activeCameraMode: CreativeWingActiveCameraMode = 'none';
  let cameraTransitionElapsed = 0.0;
  const CAMERA_TRANSITION_DUR = 0.45;
  let activeCaption: string | null = null;

  let camLookYaw = 0.0;
  let camLookPitch = 0.0;

  const getCameraState = (): CreativeWingCameraState => {
    if (activeCameraMode === 'none') {
      return {
        active: false,
        mode: 'none',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 0.0,
      };
    }

    const t = THREE.MathUtils.clamp(cameraTransitionElapsed / CAMERA_TRANSITION_DUR, 0, 1);
    const alpha = smoothStep01(t);

    if (activeCameraMode === 'portrait_atelier') {
      // Camera faces the backdrop on the East wall (lx = 15.15) from lx = 10.2
      _scratchCamWorldPos.set(originX + 10.2, baseY + y0 + 1.65, originZ - 10.6);
      _scratchLookWorldPos.set(
        originX + 15.15 + Math.sin(camLookYaw) * 2.0,
        baseY + y0 + 1.85 + Math.sin(camLookPitch) * 1.5,
        originZ - 10.6,
      );
    } else if (activeCameraMode === 'couture_boutique') {
      // Camera frames Harsha's couture window and tailoring corner
      _scratchCamWorldPos.set(originX + 11.2, baseY + y0 + 1.65, originZ - 1.2);
      _scratchLookWorldPos.set(
        originX + 14.2 + Math.sin(camLookYaw) * 2.0,
        baseY + y0 + 1.6 + Math.sin(camLookPitch) * 1.5,
        originZ + 1.5,
      );
    } else if (activeCameraMode === 'doll_playroom') {
      // Camera gracefully frames the tabletop miniature castle
      _scratchCamWorldPos.set(originX + 10.4, baseY + y0 + 1.85, originZ + 9.5);
      _scratchLookWorldPos.set(
        originX + 12.25 + Math.sin(camLookYaw) * 2.0,
        baseY + y0 + 1.25 + Math.sin(camLookPitch) * 1.5,
        originZ + 10.6,
      );
    }

    return {
      active: true,
      mode: activeCameraMode,
      camWorldPos: _scratchCamWorldPos,
      lookWorldPos: _scratchLookWorldPos,
      blendAlpha: alpha,
    };
  };

  const getProximityPrompt = (playerPos: THREE.Vector3): string | null => {
    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    const relY = playerPos.y - (baseY + y0);

    // Floor 2 vertical window check
    if (Math.abs(relY) > 1.4) return null;

    if (activeCameraMode !== 'none') {
      if (activeCameraMode === 'portrait_atelier') {
        return (
          'Portrait Atelier ✧ [1-6] Switch Backdrop (' +
          BACKDROP_NAMES[activeBackdropIndex] +
          ') · [E] Step Back'
        );
      }
      return '[E] Return to Floor 2 Exploration';
    }

    // 1. Photography Studio: lx in [8.8, 15.3], lz in [-14.8, -6.4]
    if (lx >= 8.8 && lx <= 15.3 && lz >= -14.8 && lz <= -6.4) {
      return '[E] Enter Portrait Atelier · [1-6] Backdrops';
    }

    // 2. Mini Fashion Boutique: lx in [8.8, 15.3], lz in [-5.8, +5.8]
    if (lx >= 8.8 && lx <= 15.3 && lz >= -5.8 && lz <= 5.8) {
      return "[E] Browse Harsha's Couture Corner · Tailoring & Jewelry";
    }

    // 3. Doll Playroom: lx in [9.2, 15.3], lz in [+6.4, +14.8]
    if (lx >= 9.2 && lx <= 15.3 && lz >= 6.4 && lz <= 14.8) {
      return '[E] Explore The Little Dream World · Tabletop Castle';
    }

    return null;
  };

  const interact = (playerPos: THREE.Vector3): boolean => {
    if (activeCameraMode !== 'none') {
      activeCameraMode = 'none';
      cameraTransitionElapsed = 0.0;
      activeCaption = null;
      camLookYaw = 0.0;
      camLookPitch = 0.0;
      return true;
    }

    const lx = playerPos.x - originX;
    const lz = playerPos.z - originZ;
    const relY = playerPos.y - (baseY + y0);
    if (Math.abs(relY) > 1.4) return false;

    if (lx >= 8.8 && lx <= 15.3 && lz >= -14.8 && lz <= -6.4) {
      activeCameraMode = 'portrait_atelier';
      cameraTransitionElapsed = 0.0;
      activeCaption = 'The Portrait Atelier ✧ ' + BACKDROP_NAMES[activeBackdropIndex];
      return true;
    }

    if (lx >= 8.8 && lx <= 15.3 && lz >= -5.8 && lz <= 5.8) {
      activeCameraMode = 'couture_boutique';
      cameraTransitionElapsed = 0.0;
      activeCaption = "Harsha's Couture Corner ✧ High Castle Fashion & Tailoring";
      return true;
    }

    if (lx >= 9.2 && lx <= 15.3 && lz >= 6.4 && lz <= 14.8) {
      activeCameraMode = 'doll_playroom';
      cameraTransitionElapsed = 0.0;
      activeCaption = 'The Little Dream World ✧ Handcrafted Tabletop Castle';
      return true;
    }

    return false;
  };

  const handleKeyAction = (key: string): boolean => {
    if (activeCameraMode === 'portrait_atelier') {
      const num = parseInt(key, 10);
      if (!isNaN(num) && num >= 1 && num <= 6) {
        activeBackdropIndex = num - 1;
        backdropScreenMat.map = backdropTextures[activeBackdropIndex];
        backdropScreenMat.needsUpdate = true;
        activeCaption = 'The Portrait Atelier ✧ ' + BACKDROP_NAMES[activeBackdropIndex];
        return true;
      }
    }
    return false;
  };

  const applyLookDelta = (deltaYaw: number, deltaPitch: number) => {
    camLookYaw = THREE.MathUtils.clamp(camLookYaw + deltaYaw, -0.85, 0.85);
    camLookPitch = THREE.MathUtils.clamp(camLookPitch + deltaPitch, -0.65, 0.65);
  };

  const update = (
    delta: number,
    clockTime: number,
    _playerPos: THREE.Vector3,
    _inputKeys?: Set<string>,
  ) => {
    if (activeCameraMode !== 'none') {
      cameraTransitionElapsed = Math.min(
        CAMERA_TRANSITION_DUR,
        cameraTransitionElapsed + delta,
      );
    }

    // Gentle continuous rotation of miniature windmill in doll room
    windmillBlades.rotation.z = (windmillBlades.rotation.z + delta * 1.8) % (Math.PI * 2);

    // Subtle breathing pulse on creative wing warm light
    wingLight.intensity = 0.85 + Math.sin(clockTime * 1.5) * 0.12;
  };

  return {
    group,
    colliders,
    partitionMeshes,
    getProximityPrompt,
    getActiveRoomCaption: () => activeCaption,
    interact,
    handleKeyAction,
    getCameraState,
    applyLookDelta,
    update,
  };
}
