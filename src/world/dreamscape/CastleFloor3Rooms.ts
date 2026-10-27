import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { AvatarActivityPose } from '../PlayerCharacter';
import { DreamCastleMaterials } from './CastleMaterials';

export type Floor3ActiveCameraMode =
  | 'none'
  | 'star_lounge'
  | 'heart_gallery'
  | 'infinite_mirrors'
  | 'cloud_bedroom'
  | 'aurora_chamber';

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

export interface Floor3AvatarCallbacks {
  setActivityPose: (pose: AvatarActivityPose) => void;
  resetNeutralPose?: () => void;
}

export interface CastleFloor3RoomsBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  setAvatarCallbacks: (callbacks: Floor3AvatarCallbacks) => void;
  setGalleryFrameImage: (frameIndex: number, imageSrc: string) => void;
  getGalleryFrames: () => readonly {
    index: number;
    title: string;
    sub: string;
    hasCustomImage: boolean;
    customImageSrc?: string;
  }[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (code: string) => boolean;
  applyLookDelta: (deltaYaw: number, deltaPitch: number) => void;
  exitActiveCameraMode: (playerPos?: THREE.Vector3) => void;
  getCameraState: () => Floor3CameraState;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ) => void;
}

// Module-scope scratch objects (Zero Per-Frame Allocations)
const _scratchLocal = new THREE.Vector3();
const _scratchLightPos = new THREE.Vector3();
const _scratchLightColor = new THREE.Color();
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();
const _scratchSeatWorldPos = new THREE.Vector3();

function smoothStep01(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

function lockStaticHierarchy(
  root: THREE.Object3D,
  dynamicSet: Set<THREE.Object3D>,
) {
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

function createCelestialConstellationTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = 256;
    const cy = 256;
    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 248);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(0.55, '#312e81');
    bg.addColorStop(0.85, '#4c1d95');
    bg.addColorStop(1, '#d8b467');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 215, 0, Math.PI * 2);
    ctx.stroke();

    // Star constellations
    const stars = [
      { x: 140, y: 160 }, { x: 210, y: 120 }, { x: 280, y: 140 },
      { x: 360, y: 190 }, { x: 330, y: 290 }, { x: 256, y: 350 },
      { x: 180, y: 310 }, { x: 140, y: 240 },
    ];
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    stars.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.stroke();

    stars.forEach((pt) => {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#fbcfe8';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ HARSHA & MANDU ✦', cx, cy - 10);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('Written in the Stars', cx, cy + 28);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawGalleryCanvas(
  canvas: HTMLCanvasElement,
  title: string,
  subtitle: string,
  themeColor: string,
  customImg?: HTMLImageElement | HTMLCanvasElement | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (customImg) {
    // Draw user's image filling the frame with a lovely soft romantic border
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 512, 384);

    // Draw the image centered maintaining aspect ratio
    const imgW = (customImg as HTMLImageElement).naturalWidth || customImg.width || 512;
    const imgH = (customImg as HTMLImageElement).naturalHeight || customImg.height || 384;
    const imgAspect = imgW / imgH;
    const canvasAspect = 512 / 384;
    let sW = 512;
    let sH = 384;
    let sX = 0;
    let sY = 0;
    if (imgAspect > canvasAspect) {
      sW = 512;
      sH = 512 / imgAspect;
      sY = (384 - sH) / 2;
    } else {
      sH = 384;
      sW = 384 * imgAspect;
      sX = (512 - sW) / 2;
    }
    ctx.drawImage(customImg, sX, sY, sW, sH);

    // Elegant gold filigree inner frame border
    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 364);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff1f2';
    ctx.strokeRect(20, 20, 472, 344);

    // Subtle romantic caption banner at the bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(20, 318, 472, 46);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 348);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 512, 384);
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.5, themeColor);
    grad.addColorStop(1, '#fce7f3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 384);

    ctx.strokeStyle = '#d8b467';
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, 480, 352);
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 452, 324);

    ctx.fillStyle = '#831843';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 140);

    ctx.fillStyle = '#9d174d';
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText(subtitle, 256, 195);

    ctx.fillStyle = '#d8b467';
    ctx.font = '48px Georgia, serif';
    ctx.fillText('♡  ♕  ♡', 256, 275);
  }
}

export function createCastleFloor3Rooms(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleFloor3RoomsBundle {
  const group = new THREE.Group();
  group.name = 'CastleFloor3Rooms';

  const colliders: CircleCollider[] = [];
  const partitionMeshes: THREE.Mesh[] = [];
  const dynamicObjects = new Set<THREE.Object3D>();

  const y0 = 10.25; // Floor 3 top surface elevation
  let avatarCallbacks: Floor3AvatarCallbacks | null = null;

  const addLocalCollider = (lx: number, lz: number, radius: number) => {
    colliders.push({
      x: originX + lx,
      z: originZ + lz,
      radius,
      y: baseY + y0,
      height: 3.5,
    });
  };

  // ============================================================================
  // SHARED DYNAMIC FLOOR 3 ACCENT POINT LIGHT (1 Light Budget for Floor 3)
  // ============================================================================
  const floor3RoomLight = new THREE.PointLight('#fce7f3', 0.0, 14.5, 1.5);
  floor3RoomLight.position.set(0.0, y0 + 3.2, -12.0);
  group.add(floor3RoomLight);
  dynamicObjects.add(floor3RoomLight);

  // ============================================================================
  // FLOOR 3 INTERIOR PARTITION WALLS & ARCHWAYS
  // Completely preserves stair landing at East (lx: 5.8..9.2, lz: 6.5..13.0)
  // and West F3->F4 stairs (lx: -7.5, lz: 6.5..13.0)
  // ============================================================================
  const wallWestSegGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 4.4, 0.42));
  wallWestSegGeo.translate(0, 2.2, 0);
  const wallHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(2.6, 1.15, 0.44));
  wallHeaderGeo.translate(0, 3.82, 0);
  const archTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.3, 0.055, 8, 20, Math.PI),
  );

  const buildPartitionAt = (xCenter: number, zPos: number) => {
    const wallMat = tracker.trackMat(mats.creamStone.clone());
    const segL = new THREE.Mesh(wallWestSegGeo, wallMat);
    segL.position.set(xCenter - 2.2, y0, zPos);
    segL.castShadow = true;
    segL.receiveShadow = true;

    const segR = new THREE.Mesh(wallWestSegGeo, wallMat);
    segR.position.set(xCenter + 2.2, y0, zPos);
    segR.castShadow = true;
    segR.receiveShadow = true;

    const header = new THREE.Mesh(wallHeaderGeo, wallMat);
    header.position.set(xCenter, y0, zPos);

    const archTrim = new THREE.Mesh(archTrimGeo, mats.champagneGold);
    archTrim.position.set(xCenter, y0 + 2.7, zPos);

    group.add(segL, segR, header, archTrim);
    partitionMeshes.push(segL, segR, header);
    dynamicObjects.add(segL);
    dynamicObjects.add(segR);
    dynamicObjects.add(header);
  };

  buildPartitionAt(-11.8, -6.2); // Cloud Bedroom Entrance
  buildPartitionAt(11.8, -6.2);  // Heart Gallery Entrance

  // ============================================================================
  // 1. STAR LOUNGE & SOUTH CELESTIAL BALCONY (lx: [-5.0, +5.0], lz: [-14.8, -7.0])
  // ============================================================================
  const starLoungeGroup = new THREE.Group();
  starLoungeGroup.name = 'StarLoungeRoom';
  group.add(starLoungeGroup);

  // Circular Constellation Carpet beneath Crescent Moon Loveseat
  const starRugTex = createCelestialConstellationTexture(tracker);
  const starRugMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: starRugTex,
      roughness: 0.28,
      metalness: 0.15,
    }),
  );
  const starRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.7, 2.7, 0.025, 32));
  starRugGeo.translate(0, 0.012, 0);
  const starRug = new THREE.Mesh(starRugGeo, starRugMat);
  starRug.position.set(0.0, y0, -11.8);
  starRug.receiveShadow = true;
  starLoungeGroup.add(starRug);

  // Sculpted Crescent Moon Velvet Loveseat at (0.0, y0, -11.8)
  const crescentLoveseatGroup = new THREE.Group();
  crescentLoveseatGroup.position.set(0.0, y0, -11.8);
  starLoungeGroup.add(crescentLoveseatGroup);

  const moonBackGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.25, 0.32, 12, 28, Math.PI * 0.95),
  );
  moonBackGeo.rotateZ(-Math.PI * 0.475);
  moonBackGeo.rotateY(Math.PI);
  const moonBack = new THREE.Mesh(moonBackGeo, mats.champagneGold);
  moonBack.position.set(0.0, 0.85, -0.22);
  crescentLoveseatGroup.add(moonBack);

  const seatCushionGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 0.32, 0.78));
  seatCushionGeo.translate(0, 0.32, 0);
  const seatCushion = new THREE.Mesh(seatCushionGeo, mats.velvetPlum);
  seatCushion.receiveShadow = true;
  crescentLoveseatGroup.add(seatCushion);

  // Twin Starlight Floor Lanterns
  const lanternStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.045, 1.85, 10));
  lanternStandGeo.translate(0, 0.925, 0);
  const lanternGlassGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.18, 1));
  lanternGlassGeo.translate(0, 1.85, 0);

  [-2.6, 2.6].forEach((lx) => {
    const lg = new THREE.Group();
    lg.position.set(lx, y0, -11.8);
    const pole = new THREE.Mesh(lanternStandGeo, mats.champagneGold);
    const glass = new THREE.Mesh(lanternGlassGeo, mats.warmLanternGlow);
    lg.add(pole, glass);
    starLoungeGroup.add(lg);
    addLocalCollider(lx, -11.8, 0.42);
  });
  addLocalCollider(0.0, -11.8, 0.95);

  // Floating Starlight Particles in Star Lounge
  const starParticleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.065, 0));
  const starParticleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.0,
    }),
  );
  const starParticles: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(starParticleGeo, starParticleMat);
    sp.visible = false;
    starLoungeGroup.add(sp);
    starParticles.push(sp);
    dynamicObjects.add(sp);
  }

  // ============================================================================
  // 2. ROMANTIC HEART MEMORY GALLERY (lx: [+9.2, +14.8], lz: [-14.5, +5.8])
  // ============================================================================
  const heartGalleryGroup = new THREE.Group();
  heartGalleryGroup.name = 'HeartGalleryRoom';
  group.add(heartGalleryGroup);

  const galleryMemories = [
    { title: 'First Starlight Kiss', sub: 'Beneath the ancient cherry blossoms', color: '#fbcfe8', z: -12.5 },
    { title: 'The Crag Magic Flight', sub: 'Gliding high over the azure sea', color: '#bae6fd', z: -8.0 },
    { title: 'The Royal Ballroom Waltz', sub: 'Dancing under the twin crystal hearts', color: '#fce7f3', z: -3.5 },
    { title: 'Sunset at the Gazebo', sub: 'Whispered promises in the rose promenade', color: '#fed7aa', z: 1.0 },
    { title: 'Two Hearts, One Light', sub: 'Forever Harsha & Mandu', color: '#f5d0fe', z: 5.0 },
  ];

  const galleryFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(0.12, 1.85, 2.45));
  galleryFrameGeo.translate(-0.06, 2.05, 0);
  const galleryCanvasGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.32, 1.72));
  galleryCanvasGeo.rotateY(-Math.PI / 2);
  galleryCanvasGeo.translate(-0.11, 2.05, 0);

  const galleryCanvases: HTMLCanvasElement[] = [];
  const galleryTextures: THREE.CanvasTexture[] = [];
  const galleryCustomImages: (string | null)[] = [];

  galleryMemories.forEach((mem, idx) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    galleryCanvases.push(canvas);
    drawGalleryCanvas(canvas, mem.title, mem.sub, mem.color);

    const memTex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    memTex.colorSpace = THREE.SRGBColorSpace;
    memTex.needsUpdate = true;
    galleryTextures.push(memTex);
    galleryCustomImages.push(null);

    // Restore custom photo from localStorage if present
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`heart_gallery_frame_${idx}`);
        if (stored) {
          galleryCustomImages[idx] = stored;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            drawGalleryCanvas(canvas, mem.title, mem.sub, mem.color, img);
            memTex.needsUpdate = true;
          };
          img.src = stored;
        }
      } catch {
        // ignore
      }
    }

    const canvasMat = tracker.trackMat(new THREE.MeshBasicMaterial({ map: memTex }));
    const frame = new THREE.Mesh(galleryFrameGeo, mats.champagneGold);
    frame.position.set(14.85, y0, mem.z);
    const canvasMesh = new THREE.Mesh(galleryCanvasGeo, canvasMat);
    canvasMesh.position.set(14.85, y0, mem.z);
    heartGalleryGroup.add(frame, canvasMesh);

    // Glowing Heart Crystal Pedestal opposite each canvas
    const pedGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.26, 0.32, 0.85, 14));
    pedGeo.translate(0, 0.425, 0);
    const gemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.18, 1));
    gemGeo.translate(0, 0.98, 0);

    const ped = new THREE.Mesh(pedGeo, mats.creamStone);
    ped.position.set(10.8, y0, mem.z);
    const gem = new THREE.Mesh(gemGeo, mats.warmLanternGlow);
    gem.position.set(10.8, y0, mem.z);
    heartGalleryGroup.add(ped, gem);
    addLocalCollider(10.8, mem.z, 0.42);
  });

  // ============================================================================
  // 3. INFINITE STARLIGHT MIRROR ROOM (NE Chamber: lx in [+9.6, +14.8], lz in [+7.0, +14.8])
  // ============================================================================
  const infiniteMirrorGroup = new THREE.Group();
  infiniteMirrorGroup.name = 'InfiniteMirrorRoom';
  group.add(infiniteMirrorGroup);

  const mirrorOctagonRadius = 2.45;
  const mirrorPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 3.2, 0.08));
  mirrorPanelGeo.translate(0, 1.6, 0);
  const mirrorGlassPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.55, 3.05));
  mirrorGlassPlaneGeo.translate(0, 1.6, 0.045);

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const mpGroup = new THREE.Group();
    mpGroup.position.set(
      12.2 + Math.sin(ang) * mirrorOctagonRadius,
      y0,
      11.0 + Math.cos(ang) * mirrorOctagonRadius,
    );
    mpGroup.rotation.y = ang + Math.PI;

    const frame = new THREE.Mesh(mirrorPanelGeo, mats.champagneGold);
    const glass = new THREE.Mesh(mirrorGlassPlaneGeo, mats.crystalGlass);
    mpGroup.add(frame, glass);
    infiniteMirrorGroup.add(mpGroup);
  }

  // Central Floating Infinite Prism Core at (12.2, y0 + 1.6, 11.0)
  const prismCoreGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.42, 2));
  const prismCoreMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f472b6',
      emissive: '#ec4899',
      emissiveIntensity: 1.45,
      roughness: 0.1,
      metalness: 0.4,
    }),
  );
  const prismCore = new THREE.Mesh(prismCoreGeo, prismCoreMat);
  prismCore.position.set(12.2, y0 + 1.55, 11.0);
  infiniteMirrorGroup.add(prismCore);
  dynamicObjects.add(prismCore);
  addLocalCollider(12.2, 11.0, 0.65);

  // ============================================================================
  // 4. ROYAL CLOUD BEDROOM & CANOPY BED (SW Wing: lx in [-14.8, -9.2], lz in [-14.5, +5.8])
  // ============================================================================
  const cloudBedroomGroup = new THREE.Group();
  cloudBedroomGroup.name = 'RoyalCloudBedroom';
  group.add(cloudBedroomGroup);

  // Four-Poster Cloud Canopy Bed centered at (-11.8, y0, -1.5)
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-11.8, y0, -1.5);
  cloudBedroomGroup.add(bedGroup);

  // Bed Base & Tufted Velvet Mattress
  const bedFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(2.45, 0.42, 2.85));
  bedFrameGeo.translate(0, 0.21, 0);
  const bedFrame = new THREE.Mesh(bedFrameGeo, mats.creamStone);
  bedGroup.add(bedFrame);

  const mattressGeo = tracker.trackGeo(new THREE.BoxGeometry(2.32, 0.35, 2.72));
  mattressGeo.translate(0, 0.52, 0);
  const mattress = new THREE.Mesh(mattressGeo, mats.softLavender);
  mattress.receiveShadow = true;
  bedGroup.add(mattress);

  // 4 Sculpted Cloud Pillars
  const cloudPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 12));
  cloudPillarGeo.translate(0, 1.7, 0);
  const cloudPillarPuffGeo = tracker.trackGeo(new THREE.SphereGeometry(0.24, 10, 10));
  cloudPillarPuffGeo.scale(1.2, 0.75, 1.2);

  [
    { x: -1.15, z: -1.35 },
    { x: 1.15, z: -1.35 },
    { x: -1.15, z: 1.35 },
    { x: 1.15, z: 1.35 },
  ].forEach((cp) => {
    const pMesh = new THREE.Mesh(cloudPillarGeo, mats.pearlWhite);
    pMesh.position.set(cp.x, 0, cp.z);
    const puff = new THREE.Mesh(cloudPillarPuffGeo, mats.blushRoseMarble);
    puff.position.set(cp.x, 3.35, cp.z);
    bedGroup.add(pMesh, puff);
  });

  // Crown Canopy Top Rim & Silk Drapes
  const canopyRimGeo = tracker.trackGeo(new THREE.BoxGeometry(2.45, 0.14, 2.85));
  canopyRimGeo.translate(0, 3.38, 0);
  const canopyRim = new THREE.Mesh(canopyRimGeo, mats.champagneGold);
  bedGroup.add(canopyRim);

  const drapeGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.85, 2.8));
  drapeGeo.translate(0, 1.85, 0);
  const drapeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fbcfe8',
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  const drapes = [
    { x: -1.16, z: -0.65, rotY: Math.PI / 2 },
    { x: 1.16, z: -0.65, rotY: -Math.PI / 2 },
    { x: -0.65, z: -1.36, rotY: 0 },
    { x: 0.65, z: -1.36, rotY: 0 },
  ];
  drapes.forEach((dp) => {
    const dm = new THREE.Mesh(drapeGeo, drapeMat);
    dm.position.set(dp.x, 0, dp.z);
    dm.rotation.y = dp.rotY;
    bedGroup.add(dm);
  });

  // Embroidered Dream Pillows
  const pillowGeo = tracker.trackGeo(new THREE.BoxGeometry(0.72, 0.18, 0.45));
  pillowGeo.translate(0, 0.75, -1.05);
  const pillowL = new THREE.Mesh(pillowGeo, mats.velvetPlum);
  pillowL.position.x = -0.55;
  const pillowR = new THREE.Mesh(pillowGeo, mats.velvetPlum);
  pillowR.position.x = 0.55;
  bedGroup.add(pillowL, pillowR);
  addLocalCollider(-11.8, -1.5, 1.65);

  // Twin Crescent Moon Nightstands with Starlight Lamps
  const nightstandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.38, 0.42, 0.65, 16));
  nightstandGeo.translate(0, 0.325, 0);
  [-13.6, -10.0].forEach((nx) => {
    const ns = new THREE.Mesh(nightstandGeo, mats.creamStone);
    ns.position.set(nx, y0, -1.5);
    const lamp = new THREE.Mesh(prismCoreGeo, mats.warmLanternGlow);
    lamp.scale.setScalar(0.45);
    lamp.position.set(nx, y0 + 0.85, -1.5);
    cloudBedroomGroup.add(ns, lamp);
    addLocalCollider(nx, -1.5, 0.45);
  });

  // ============================================================================
  // 5. PASTEL AURORA NORTH SANCTUARY (lx: [-5.2, +5.2], lz: [+6.8, +10.2])
  // ============================================================================
  const auroraSanctuaryGroup = new THREE.Group();
  auroraSanctuaryGroup.name = 'AuroraSanctuaryRoom';
  group.add(auroraSanctuaryGroup);

  // Overhead Aurora Ribbon Canopy
  const auroraRibbonGeo = tracker.trackGeo(
    new THREE.TorusGeometry(3.6, 0.22, 10, 32, Math.PI * 0.95),
  );
  auroraRibbonGeo.rotateX(Math.PI / 2);
  const auroraRibbonMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#818cf8',
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  const auroraRibbon = new THREE.Mesh(auroraRibbonGeo, auroraRibbonMat);
  auroraRibbon.position.set(0.0, y0 + 3.4, 8.5);
  auroraSanctuaryGroup.add(auroraRibbon);
  dynamicObjects.add(auroraRibbon);

  // Central Starlight Aurora Resonator Pedestal at (0.0, y0, 8.5)
  const resonatorBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.55, 0.68, 0.95, 18));
  resonatorBaseGeo.translate(0, 0.475, 0);
  const resonatorOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.32, 16, 16));
  resonatorOrbGeo.translate(0, 1.25, 0);

  const resonatorBase = new THREE.Mesh(resonatorBaseGeo, mats.creamStone);
  resonatorBase.position.set(0.0, y0, 8.5);
  const resonatorOrb = new THREE.Mesh(resonatorOrbGeo, mats.warmLanternGlow);
  resonatorOrb.position.set(0.0, y0, 8.5);
  auroraSanctuaryGroup.add(resonatorBase, resonatorOrb);
  dynamicObjects.add(resonatorOrb);
  addLocalCollider(0.0, 8.5, 0.72);

  // Lock static furniture
  lockStaticHierarchy(group, dynamicObjects);

  // ============================================================================
  // PROCEDURAL WEB AUDIO SYNTHESIZER FOR FLOOR 3 CELESTIAL SOUNDSCAPES
  // ============================================================================
  let audioCtx: AudioContext | null = null;
  const ensureAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  };

  const playSynthTone = (
    freq: number,
    duration = 0.45,
    type: OscillatorType = 'sine',
    gainPeak = 0.12,
  ) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  const playCelestialArpeggio = (baseFreq = 440.0) => {
    const chord = [1.0, 1.25, 1.5, 1.875, 2.0];
    chord.forEach((ratio, idx) => {
      setTimeout(() => {
        playSynthTone(baseFreq * ratio, 0.75, 'sine', 0.08);
      }, idx * 75);
    });
  };

  // ============================================================================
  // INTERACTIVE STATE MACHINE FOR FLOOR 3 CELESTIAL ACTIVITIES
  // ============================================================================
  let activeMode: Floor3ActiveCameraMode = 'none';
  let cameraBlendAlpha = 0.0;
  let cameraLookYawOffset = 0.0;
  let cameraLookPitchOffset = 0.0;
  let selectedMemoryIndex = 0;
  let statusCaptionText: string | null = null;
  let statusCaptionTimer = 0.0;

  const setTemporaryCaption = (text: string, duration = 4.2) => {
    statusCaptionText = text;
    statusCaptionTimer = duration;
  };

  const setGalleryFrameImage = (frameIdx: number, imageSrc: string) => {
    if (frameIdx < 0 || frameIdx >= galleryMemories.length) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`heart_gallery_frame_${frameIdx}`, imageSrc);
      }
    } catch {
      // ignore
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cvs = galleryCanvases[frameIdx];
      const tex = galleryTextures[frameIdx];
      const mem = galleryMemories[frameIdx];
      galleryCustomImages[frameIdx] = imageSrc;
      drawGalleryCanvas(cvs, mem.title, mem.sub, mem.color, img);
      tex.needsUpdate = true;
      setTemporaryCaption(`♡ Frame [${frameIdx + 1}]: "${mem.title}" Photo Updated! ♡`, 3.5);
    };
    img.src = imageSrc;
  };

  const getGalleryFrames = () => {
    return galleryMemories.map((m, idx) => ({
      index: idx,
      title: m.title,
      sub: m.sub,
      hasCustomImage: Boolean(galleryCustomImages[idx]),
      customImageSrc: galleryCustomImages[idx] || undefined,
    }));
  };

  const exitActiveCameraMode = (playerPos?: THREE.Vector3) => {
    if (activeMode === 'none') return;
    const prev = activeMode;
    activeMode = 'none';
    cameraLookYawOffset = 0.0;
    cameraLookPitchOffset = 0.0;
    avatarCallbacks?.resetNeutralPose?.();
    avatarCallbacks?.setActivityPose('none');

    if (playerPos) {
      if (prev === 'star_lounge') {
        playerPos.set(originX + 0.0, baseY + y0, originZ - 10.2);
      } else if (prev === 'heart_gallery') {
        playerPos.set(originX + 11.8, baseY + y0, originZ - 3.5);
      } else if (prev === 'infinite_mirrors') {
        playerPos.set(originX + 12.2, baseY + y0, originZ + 7.8);
      } else if (prev === 'cloud_bedroom') {
        playerPos.set(originX - 10.4, baseY + y0, originZ - 1.5);
      } else if (prev === 'aurora_chamber') {
        playerPos.set(originX + 0.0, baseY + y0, originZ + 6.8);
      }
    }
  };

  return {
    group,
    colliders,
    partitionMeshes,

    setAvatarCallbacks: (callbacks: Floor3AvatarCallbacks) => {
      avatarCallbacks = callbacks;
    },
    setGalleryFrameImage,
    getGalleryFrames,

    getProximityPrompt: (playerPos: THREE.Vector3): string | null => {
      if (activeMode === 'star_lounge') {
        return '[Space] Play Celestial Harp Arpeggio · [E/Esc] Stand Up';
      }
      if (activeMode === 'heart_gallery') {
        return '[1-5] View Romantic Memory · [E/Esc] Leave Gallery';
      }
      if (activeMode === 'infinite_mirrors') {
        return '[Space] Pulse Crystal Prism · [E/Esc] Exit Mirror Room';
      }
      if (activeMode === 'cloud_bedroom') {
        return '[Space] Toggle Bedside Starlight · [E/Esc] Wake Up';
      }
      if (activeMode === 'aurora_chamber') {
        return '[Space] Wave Aurora Sky · [E/Esc] Exit Sanctuary';
      }

      const py = playerPos.y - baseY;
      if (Math.abs(py - y0) > 1.85) return null;

      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;

      // 1. Star Lounge Crescent Moon Loveseat (0.0, -11.8)
      if (Math.hypot(lx - 0.0, lz - -11.8) <= 3.2) {
        return '[E] Sit on Crescent Moon Loveseat';
      }
      // 2. Heart Gallery Memory Pedestals (10.8, -3.5)
      if (Math.hypot(lx - 10.8, lz - -3.5) <= 3.4) {
        return '[E] View Romantic Memory Gallery';
      }
      // 3. Infinite Starlight Mirror Room (12.2, 11.0)
      if (Math.hypot(lx - 12.2, lz - 11.0) <= 3.1) {
        return '[E] Awaken Infinite Starlight Mirrors';
      }
      // 4. Royal Cloud Bedroom Canopy Bed (-11.8, -1.5)
      if (Math.hypot(lx - -11.8, lz - -1.5) <= 3.2) {
        return '[E] Rest on Royal Cloud Bed';
      }
      // 5. Pastel Aurora North Sanctuary (0.0, 8.5)
      if (Math.hypot(lx - 0.0, lz - 8.5) <= 3.2) {
        return '[E] Channel Pastel Aurora Sky';
      }

      return null;
    },

    getActiveRoomCaption: (): string | null => {
      if (statusCaptionTimer > 0 && statusCaptionText) {
        return statusCaptionText;
      }
      if (activeMode === 'star_lounge') {
        return 'Star Lounge • Crescent Moon Balcony Overlook • Press [Space] for Harp Harmony';
      }
      if (activeMode === 'heart_gallery') {
        const mem = galleryMemories[selectedMemoryIndex];
        return `Heart Gallery • Memory [${selectedMemoryIndex + 1}/5]: ${mem.title} — "${mem.sub}"`;
      }
      if (activeMode === 'infinite_mirrors') {
        return 'Infinite Starlight Mirrors • Recursive Crystal Dimension • Press [Space] to Pulse';
      }
      if (activeMode === 'cloud_bedroom') {
        return 'Royal Cloud Bedroom • Resting in Dream Canopy Bed • Lullaby Playing ♬';
      }
      if (activeMode === 'aurora_chamber') {
        return 'Pastel Aurora Sanctuary • Channeling Northern Starlight Ribbons';
      }
      return null;
    },

    interact: (playerPos: THREE.Vector3): boolean => {
      if (activeMode !== 'none') {
        exitActiveCameraMode(playerPos);
        return true;
      }

      const py = playerPos.y - baseY;
      if (Math.abs(py - y0) > 1.85) return false;

      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;

      cameraLookYawOffset = 0.0;
      cameraLookPitchOffset = 0.0;

      // 1. Star Lounge Crescent Moon Loveseat
      if (Math.hypot(lx - 0.0, lz - -11.8) <= 3.2) {
        activeMode = 'star_lounge';
        cameraBlendAlpha = 0.0;
        playCelestialArpeggio(392.0); // G major celestial harp
        setTemporaryCaption('✦ Seated upon Crescent Moon Balcony Loveseat ✦', 3.5);
        return true;
      }

      // 2. Romantic Heart Memory Gallery
      if (Math.hypot(lx - 10.8, lz - -3.5) <= 3.4) {
        activeMode = 'heart_gallery';
        cameraBlendAlpha = 0.0;
        selectedMemoryIndex = 2; // Start with Ballroom Waltz
        playCelestialArpeggio(523.25);
        setTemporaryCaption('♡ Viewing Romantic Keepsake Memories of Harsha & Mandu ♡', 3.5);
        return true;
      }

      // 3. Infinite Starlight Mirror Room
      if (Math.hypot(lx - 12.2, lz - 11.0) <= 3.1) {
        activeMode = 'infinite_mirrors';
        cameraBlendAlpha = 0.0;
        playCelestialArpeggio(659.25);
        setTemporaryCaption('✦ Infinite Starlight Mirror Array Awakened ✦', 3.5);
        return true;
      }

      // 4. Royal Cloud Bedroom Canopy Bed
      if (Math.hypot(lx - -11.8, lz - -1.5) <= 3.2) {
        activeMode = 'cloud_bedroom';
        cameraBlendAlpha = 0.0;
        playCelestialArpeggio(329.63);
        setTemporaryCaption('☁ Resting peacefully in the Royal Cloud Bed ☁', 3.5);
        return true;
      }

      // 5. Pastel Aurora Sanctuary
      if (Math.hypot(lx - 0.0, lz - 8.5) <= 3.2) {
        activeMode = 'aurora_chamber';
        cameraBlendAlpha = 0.0;
        playCelestialArpeggio(587.33);
        setTemporaryCaption('✦ Pastel Aurora Dome Resonating ✦', 3.5);
        return true;
      }

      return false;
    },

    handleKeyAction: (code: string): boolean => {
      if (activeMode === 'none') return false;

      if (activeMode === 'star_lounge') {
        if (code === 'Space') {
          playCelestialArpeggio(440.0);
          setTemporaryCaption('♬ Celestial Harp Arpeggio Resonating Across the Balcony ♬', 3.2);
          return true;
        }
        return false;
      }

      if (activeMode === 'heart_gallery') {
        const digitMap: Record<string, number> = {
          Digit1: 0, Numpad1: 0,
          Digit2: 1, Numpad2: 1,
          Digit3: 2, Numpad3: 2,
          Digit4: 3, Numpad4: 3,
          Digit5: 4, Numpad5: 4,
        };
        if (code in digitMap) {
          selectedMemoryIndex = digitMap[code];
          playSynthTone(523.25 + selectedMemoryIndex * 65, 0.45, 'sine', 0.12);
          const mem = galleryMemories[selectedMemoryIndex];
          setTemporaryCaption(`♡ Memory: ${mem.title} — "${mem.sub}" ♡`, 3.5);
          return true;
        }
        return false;
      }

      if (activeMode === 'infinite_mirrors') {
        if (code === 'Space') {
          playSynthTone(783.99, 0.65, 'triangle', 0.14);
          prismCoreMat.emissiveIntensity = 2.4;
          setTemporaryCaption('✦ Infinite Crystal Prism Radiating Starlight ✦', 2.8);
          return true;
        }
        return false;
      }

      if (activeMode === 'cloud_bedroom') {
        if (code === 'Space') {
          playSynthTone(659.25, 0.55, 'sine', 0.11);
          setTemporaryCaption('♬ Soothing Music Box Lullaby Echoes Softly ♬', 3.2);
          return true;
        }
        return false;
      }

      if (activeMode === 'aurora_chamber') {
        if (code === 'Space') {
          playCelestialArpeggio(698.46);
          setTemporaryCaption('✦ Luminous Aurora Waves Flowing Across the Sky ✦', 3.2);
          return true;
        }
        return false;
      }

      return false;
    },

    applyLookDelta: (deltaYaw: number, deltaPitch: number) => {
      if (activeMode !== 'none') {
        cameraLookYawOffset -= deltaYaw;
        cameraLookPitchOffset = THREE.MathUtils.clamp(
          cameraLookPitchOffset + deltaPitch,
          -0.85,
          0.92,
        );
      }
    },

    exitActiveCameraMode,

    getCameraState: (): Floor3CameraState => {
      if (activeMode === 'none') {
        return {
          active: false,
          mode: 'none',
          camWorldPos: _scratchCamWorldPos,
          lookWorldPos: _scratchLookWorldPos,
          blendAlpha: 0,
          isSitting: false,
        };
      }

      let isSitting = false;
      let seatYaw = 0;

      if (activeMode === 'star_lounge') {
        const slX = originX + 0.0;
        const slY = baseY + y0;
        const slZ = originZ - 11.8;
        _scratchCamWorldPos.set(slX, slY + 1.48, slZ + 2.85);
        _scratchLookWorldPos.set(slX, slY + 1.15, slZ - 8.0);
        _scratchSeatWorldPos.set(slX, slY + 0.35, slZ);
        isSitting = true;
        seatYaw = Math.PI; // Face south toward the panorama
      } else if (activeMode === 'heart_gallery') {
        const mem = galleryMemories[selectedMemoryIndex];
        const gX = originX + 11.5;
        const gY = baseY + y0 + 1.45;
        const gZ = originZ + mem.z;
        _scratchCamWorldPos.set(gX - 1.85, gY, gZ);
        _scratchLookWorldPos.set(originX + 14.8, gY, gZ);
        _scratchSeatWorldPos.set(gX, baseY + y0, gZ);
        seatYaw = -Math.PI / 2; // Face east toward the canvas
      } else if (activeMode === 'infinite_mirrors') {
        const imX = originX + 12.2;
        const imY = baseY + y0 + 1.65;
        const imZ = originZ + 11.0;
        _scratchCamWorldPos.set(imX - 1.95, imY + 0.45, imZ - 1.95);
        _scratchLookWorldPos.set(imX, imY, imZ);
        _scratchSeatWorldPos.set(imX, baseY + y0, imZ);
        seatYaw = Math.PI * 0.25;
      } else if (activeMode === 'cloud_bedroom') {
        const bdX = originX - 11.8;
        const bdY = baseY + y0 + 0.38;
        const bdZ = originZ - 1.5;
        _scratchCamWorldPos.set(bdX + 2.35, bdY + 1.25, bdZ + 0.15);
        _scratchLookWorldPos.set(bdX + 0.85, bdY + 0.75, bdZ + 0.15);
        _scratchSeatWorldPos.set(bdX + 0.85, bdY, bdZ + 0.15);
        isSitting = true;
        seatYaw = Math.PI * 0.5;
      } else {
        // aurora_chamber
        const auX = originX + 0.0;
        const auY = baseY + y0 + 1.25;
        const auZ = originZ + 8.5;
        _scratchCamWorldPos.set(auX, auY, auZ - 2.85);
        _scratchLookWorldPos.set(auX, auY + 2.45, auZ + 0.5);
        _scratchSeatWorldPos.set(auX, baseY + y0, auZ);
        seatYaw = 0;
      }

      if (Math.abs(cameraLookYawOffset) > 0.0001 || Math.abs(cameraLookPitchOffset) > 0.0001) {
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
        active: true,
        mode: activeMode,
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: cameraBlendAlpha,
        isSitting,
        seatWorldPos: _scratchSeatWorldPos,
        seatYaw,
      };
    },

    update: (
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      inputKeys?: Set<string>,
    ) => {
      if (statusCaptionTimer > 0) {
        statusCaptionTimer = Math.max(0, statusCaptionTimer - delta);
      }

      if (activeMode !== 'none') {
        cameraBlendAlpha = smoothStep01(Math.min(1.0, cameraBlendAlpha + delta * 2.6));
      } else {
        cameraBlendAlpha = 0.0;
      }

      // Keyboard 2-Axis Camera Look
      if (activeMode !== 'none' && inputKeys) {
        if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') || inputKeys.has('KeyQ')) {
          cameraLookYawOffset += delta * 1.45;
        }
        if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') || inputKeys.has('KeyR')) {
          cameraLookYawOffset -= delta * 1.45;
        }
        if (inputKeys.has('KeyW') || inputKeys.has('ArrowUp')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(
            cameraLookPitchOffset - delta * 1.15,
            -0.85,
            0.92,
          );
        }
        if (inputKeys.has('KeyS') || inputKeys.has('ArrowDown')) {
          cameraLookPitchOffset = THREE.MathUtils.clamp(
            cameraLookPitchOffset + delta * 1.15,
            -0.85,
            0.92,
          );
        }
      }

      // Animate Star Lounge Starlight Particles
      if (activeMode === 'star_lounge') {
        starParticleMat.opacity = 0.65 + Math.sin(elapsedTime * 4.0) * 0.3;
        for (let i = 0; i < starParticles.length; i++) {
          const sp = starParticles[i];
          sp.visible = true;
          const ang = (i * Math.PI * 2) / starParticles.length + elapsedTime * 1.2;
          const r = 1.45 + Math.sin(elapsedTime * 2.0 + i) * 0.45;
          sp.position.set(
            Math.cos(ang) * r,
            y0 + 1.2 + Math.sin(elapsedTime * 3.0 + i) * 0.35,
            -11.8 + Math.sin(ang) * r * 0.65,
          );
          sp.rotation.y = elapsedTime * 2.5 + i;
        }
      } else {
        for (let i = 0; i < starParticles.length; i++) {
          starParticles[i].visible = false;
        }
      }

      // Animate Infinite Prism Core
      prismCore.rotation.y = elapsedTime * 1.6;
      prismCore.rotation.x = Math.sin(elapsedTime * 1.2) * 0.35;
      prismCoreMat.emissiveIntensity = THREE.MathUtils.lerp(
        prismCoreMat.emissiveIntensity,
        1.45 + Math.sin(elapsedTime * 3.5) * 0.4,
        1 - Math.exp(-6 * delta),
      );

      // Animate Pastel Aurora Ribbon
      auroraRibbon.rotation.z = Math.sin(elapsedTime * 1.2) * 0.12;
      auroraRibbonMat.emissiveIntensity = 1.35 + Math.sin(elapsedTime * 2.4) * 0.45;
      resonatorOrb.rotation.y = elapsedTime * 1.8;

      // Shared Floor 3 Dynamic PointLight Tracking
      _scratchLocal.set(
        playerPos.x - originX,
        playerPos.y - baseY,
        playerPos.z - originZ,
      );
      if (Math.abs(_scratchLocal.y - y0) > 2.6) {
        floor3RoomLight.intensity = THREE.MathUtils.lerp(
          floor3RoomLight.intensity,
          0.0,
          1 - Math.exp(-8 * delta),
        );
        return;
      }

      let targetIntensity = 1.35;
      if (Math.abs(_scratchLocal.x) <= 6.0 && _scratchLocal.z < -6.0) {
        // Star Lounge
        _scratchLightPos.set(0.0, y0 + 3.2, -11.8);
        _scratchLightColor.set('#fde047');
        targetIntensity = activeMode === 'star_lounge' ? 2.2 : 1.5;
      } else if (_scratchLocal.x > 6.0 && _scratchLocal.z < 6.0) {
        // Heart Gallery
        _scratchLightPos.set(12.5, y0 + 3.0, _scratchLocal.z);
        _scratchLightColor.set('#fbcfe8');
        targetIntensity = activeMode === 'heart_gallery' ? 2.1 : 1.45;
      } else if (_scratchLocal.x > 6.0 && _scratchLocal.z >= 6.0) {
        // Infinite Mirror Room
        _scratchLightPos.set(12.2, y0 + 2.8, 11.0);
        _scratchLightColor.set('#f472b6');
        targetIntensity = activeMode === 'infinite_mirrors' ? 2.3 : 1.5;
      } else if (_scratchLocal.x < -6.0) {
        // Royal Cloud Bedroom
        _scratchLightPos.set(-11.8, y0 + 3.1, -1.5);
        _scratchLightColor.set('#e9d5ff');
        targetIntensity = activeMode === 'cloud_bedroom' ? 1.8 : 1.35;
      } else {
        // Aurora Sanctuary
        _scratchLightPos.set(0.0, y0 + 3.2, 8.5);
        _scratchLightColor.set('#38bdf8');
        targetIntensity = activeMode === 'aurora_chamber' ? 2.2 : 1.4;
      }

      floor3RoomLight.position.lerp(_scratchLightPos, 1 - Math.exp(-6 * delta));
      floor3RoomLight.color.lerp(_scratchLightColor, 1 - Math.exp(-6 * delta));
      floor3RoomLight.intensity = THREE.MathUtils.lerp(
        floor3RoomLight.intensity,
        targetIntensity,
        1 - Math.exp(-8 * delta),
      );
    },
  };
}
