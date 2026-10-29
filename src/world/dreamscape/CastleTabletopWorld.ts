import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { JewelleryAvatarBridge } from './CastleJewelleryAtelier';
import { DreamCastleMaterials } from './CastleMaterials';

function easeInOutCubic(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeInOutSine(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function createPlaqueCanvasTex(
  tracker: ResourceTracker,
  title: string,
  subtitle?: string,
  bg = '#4a1026',
  fg = '#fde047',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 320, 112);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 310, 102);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (subtitle) {
      ctx.fillStyle = fg;
      ctx.font = 'bold 21px Georgia, serif';
      ctx.fillText(title, 160, 40);
      ctx.fillStyle = '#ffe4e6';
      ctx.font = 'italic 15px Georgia, serif';
      ctx.fillText(subtitle, 160, 76);
    } else {
      ctx.fillStyle = fg;
      ctx.font = 'bold 26px Georgia, serif';
      ctx.fillText(title, 160, 56);
    }
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createInitialMedallionTex(
  tracker: ResourceTracker,
  letter: 'Y' | 'H',
  bg: string,
  fg: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 112, 112);
    ctx.fillStyle = fg;
    ctx.font = 'bold 68px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 64, 66);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWorldGratitudeMessageTex(
  tracker: ResourceTracker,
  line1: string,
  line2?: string,
  style: 'title' | 'gratitude' | 'love' = 'gratitude',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 640, 192);
    const grad = ctx.createRadialGradient(320, 96, 12, 320, 96, 300);
    grad.addColorStop(0, 'rgba(74, 16, 38, 0.88)');
    grad.addColorStop(0.75, 'rgba(74, 16, 38, 0.58)');
    grad.addColorStop(1, 'rgba(74, 16, 38, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 192);

    ctx.strokeStyle = 'rgba(253, 224, 71, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(26, 22, 588, 148);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (style === 'title') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 46px Georgia, serif';
      ctx.fillText(line1, 320, line2 ? 78 : 96);
      if (line2) {
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'italic 21px Georgia, serif';
        ctx.fillText(line2, 320, 128);
      }
    } else if (style === 'love') {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 42px Georgia, serif';
      ctx.fillText(line1, 320, line2 ? 78 : 96);
      if (line2) {
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'italic 20px Georgia, serif';
        ctx.fillText(line2, 320, 126);
      }
    } else {
      ctx.fillStyle = '#fff1f2';
      ctx.font = 'italic 25px Georgia, serif';
      ctx.fillText(line1, 320, line2 ? 76 : 96);
      if (line2) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'italic 22px Georgia, serif';
        ctx.fillText(line2, 320, 122);
      }
    }
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMemoryFrameDefaultTex(
  tracker: ResourceTracker,
  idx: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grads = [
      ['#fbcfe8', '#831843'],
      ['#fef08a', '#9d174d'],
      ['#bae6fd', '#312e81'],
      ['#e9d5ff', '#581c87'],
    ];
    const [c0, c1] = grads[idx % grads.length];
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 192, 240);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 176, 224);

    ctx.fillStyle = 'rgba(255, 241, 242, 0.9)';
    ctx.beginPath();
    ctx.arc(80, 96, 20, 0, Math.PI * 2);
    ctx.arc(112, 96, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(61, 104);
    ctx.lineTo(96, 148);
    ctx.lineTo(131, 104);
    ctx.closePath();
    ctx.fill();

    const captions = [
      'Our Little Kingdom',
      'Two Towers, One Bridge',
      'Queen of My Life',
      'Yeshwanth & Harsha',
    ];
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(captions[idx % captions.length], 96, 192);
    ctx.fillStyle = '#fff1f2';
    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillText('Y + H ♡', 96, 214);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSculptedHeartMesh(
  tracker: ResourceTracker,
  scale: number,
  mat: THREE.Material,
): THREE.Group {
  const hg = new THREE.Group();
  const lobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.08 * scale, 10, 10));
  const tipGeo = tracker.trackGeo(new THREE.ConeGeometry(0.11 * scale, 0.18 * scale, 12));
  tipGeo.rotateX(Math.PI);

  const lL = new THREE.Mesh(lobeGeo, mat);
  lL.position.set(-0.055 * scale, 0.045 * scale, 0);
  const lR = new THREE.Mesh(lobeGeo, mat);
  lR.position.set(0.055 * scale, 0.045 * scale, 0);
  const tip = new THREE.Mesh(tipGeo, mat);
  tip.position.set(0, -0.05 * scale, 0);
  tip.scale.set(1.05, 1.0, 0.68);
  hg.add(lL, lR, tip);
  return hg;
}

export interface TabletopCastleEntranceSpec {
  tableCenterLocal: THREE.Vector3;
  tableRadius: number;
  position: THREE.Vector3;
  forward: THREE.Vector3;
  interactionRadius: number;
  cameraApproach: THREE.Vector3;
  doorPivotLeft: THREE.Vector3;
  doorPivotRight: THREE.Vector3;
  returnPoint: THREE.Vector3;
  returnYaw: number;
}

interface AwakeningFlower {
  group: THREE.Group;
  localX: number;
  localZ: number;
  bloomRatio: number;
}

interface AwakeningLantern {
  orbMat: THREE.MeshStandardMaterial;
  localX: number;
  localZ: number;
  wakeRatio: number;
}

export class CastleTabletopWorld {
  public readonly group = new THREE.Group();
  public readonly dynamicObjects = new Set<THREE.Object3D>();
  public readonly entranceSpec: TabletopCastleEntranceSpec;

  private readonly tracker: ResourceTracker;
  private readonly mats: DreamCastleMaterials;
  private readonly originX: number;
  private readonly baseY: number;
  private readonly originZ: number;
  private readonly y0: number;

  private avatarBridge: JewelleryAvatarBridge | null = null;

  // Miniature castle animated elements
  private leftGatePivot!: THREE.Group;
  private rightGatePivot!: THREE.Group;
  private gateOpenRatio = 0.0;
  private readonly memoryFrameMaterials: THREE.MeshBasicMaterial[] = [];

  // Little Kingdom ("OUR LITTLE KINGDOM") Awakening & Queen Reveal elements
  private dwExpandGroup!: THREE.Group;
  private readonly flowerGroups: THREE.Group[] = [];
  private readonly awakeningFlowers: AwakeningFlower[] = [];
  private readonly awakeningLanterns: AwakeningLantern[] = [];
  private readonly kingdomWindowMats: THREE.MeshStandardMaterial[] = [];
  private readonly heartPerimeterLights: THREE.MeshStandardMaterial[] = [];

  private dwFullCastleBackdrop!: THREE.Group;
  private fountainStreamLeftMesh!: THREE.Mesh;
  private fountainStreamRightMesh!: THREE.Mesh;
  private fountainWaterMat!: THREE.MeshStandardMaterial;
  private fountainCenterHeartGroup!: THREE.Group;
  private fountainHeartMat!: THREE.MeshStandardMaterial;

  // Queen's Courtyard, Circular Heart Frame & Rising Crown (Sections 7 & 8)
  private queenCourtyardGroup!: THREE.Group;
  private queenArchFrameMat!: THREE.MeshStandardMaterial;
  private queenFrameHeartGroup!: THREE.Group;
  private queenCrownGroup!: THREE.Group;
  private queenCrownHaloMat!: THREE.MeshBasicMaterial;
  private crownRevealedInExplore = false;
  private crownRevealProgress = 0.0;

  // Dissolving Entrance Rose Petals (Section 13: "The rose is the welcome. The crown is the recognition. The castle is the gratitude.")
  private dissolvingRosePetalsGroup!: THREE.Group;
  private readonly rosePetalMeshes: THREE.Mesh[] = [];
  private rosePetalMat!: THREE.MeshStandardMaterial;
  private entranceRoseDissolved = false;

  // Golden Yeshwanth Figure (Section 9: Witnessing the Queen Reveal, hand over heart, no second rose)
  private goldenYeshwanthGroup!: THREE.Group;
  private yeshHeadGroup!: THREE.Group;
  private yeshLeftLeg!: THREE.Group;
  private yeshRightLeg!: THREE.Group;
  private yeshLeftArm!: THREE.Group;
  private yeshRightArm!: THREE.Group;
  private goldenArrivalGlow!: THREE.Mesh;

  // World-Space Cinematic Gratitude Banners (Section 10: 5 sequential beats, strictly FrontSide)
  private gratitudeBannerMesh!: THREE.Mesh;
  private gratitudeBannerMat!: THREE.MeshBasicMaterial;
  private readonly gratitudeBannerTextures: THREE.CanvasTexture[] = [];
  private currentBannerBeatIndex = -1;

  // Scale-Transition & Queen Reveal Story State Machine
  public isInsideLittleDreamWorld = false;
  private transitionState: 'NONE' | 'ENTERING_STORY' | 'REPLAY_QUEEN' | 'EXITING' = 'NONE';
  private transitionElapsed = 0.0;
  private readonly ENTER_STORY_DUR = 38.0; // Complete "Our Little Kingdom" -> Awakening -> Queen Reveal -> Gratitude -> Heart Kingdom Illumination
  private readonly REPLAY_QUEEN_DUR = 24.0; // Queen's Courtyard -> Crown -> Yeshwanth Hand over Heart -> Gratitude -> Heart Kingdom Illumination
  private readonly EXIT_DUR = 2.4;

  private pendingPlayerWorldTeleport: THREE.Vector3 | null = null;
  private pendingPlayerYaw: number | null = null;

  private readonly transitionCamPos = new THREE.Vector3();
  private readonly transitionLookPos = new THREE.Vector3();
  private readonly transitionSeatPos = new THREE.Vector3();
  private transitionSeatYaw: number | undefined = undefined;
  private transitionFov = 54.0;
  private activeStoryCaption: string | null = null;

  private dreamWorldPortalRing!: THREE.Mesh;

  constructor(
    tracker: ResourceTracker,
    mats: DreamCastleMaterials,
    originX: number,
    baseY: number,
    originZ: number,
    y0: number,
    colliders: CircleCollider[],
  ) {
    this.tracker = tracker;
    this.mats = mats;
    this.originX = originX;
    this.baseY = baseY;
    this.originZ = originZ;
    this.y0 = y0;

    this.group.name = 'CastleTabletopAndLittleDreamWorld';

    // Single Source of Truth for Tabletop Castle & Accessible Front (South) Ornate Golden Gate
    const tableX = 12.85;
    const tableZ = 11.85;
    const tableR = 1.18;
    const gateOffsetZ = -0.88;
    this.entranceSpec = {
      tableCenterLocal: new THREE.Vector3(tableX, y0, tableZ),
      tableRadius: tableR,
      position: new THREE.Vector3(tableX, y0 + 0.55, tableZ + gateOffsetZ),
      forward: new THREE.Vector3(0, 0, -1),
      interactionRadius: 2.15,
      cameraApproach: new THREE.Vector3(tableX, y0 + 0.92, tableZ - 1.58),
      doorPivotLeft: new THREE.Vector3(-0.18, 0, 0),
      doorPivotRight: new THREE.Vector3(0.18, 0, 0),
      returnPoint: new THREE.Vector3(tableX, y0, tableZ - 1.88),
      returnYaw: 0, // Faces North (+Z) directly toward the Ornate Golden Gate
    };

    this.buildLuxuryTabletopAndMiniatureCastle();
    this.buildConnectedLittleDreamWorld(colliders);
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
  }

  /**
   * Sections 1, 3, 5, 6 & 7:
   * Builds the miniature "Our Little Kingdom" on the Doll Playroom table:
   * - Small ornate golden gate with "OUR LITTLE KINGDOM" above it & sculpted heart details
   * - Yeshwanth's Tower (warm champagne gold, ivory, sun/star motifs, golden lights)
   * - Harsha's Tower (soft blush pink, pearl, lavender, crystal, flowers)
   * - Connecting bridge with "Y" and "H" golden plaques & shared garden below
   * - Twin-stream heart fountain & miniature Queen's Courtyard throne + circular heart frame
   */
  private buildLuxuryTabletopAndMiniatureCastle(): void {
    const { tracker, mats, entranceSpec } = this;
    const tableGroup = new THREE.Group();
    tableGroup.position.copy(entranceSpec.tableCenterLocal);
    this.group.add(tableGroup);

    const goldEdgeGeo = tracker.trackGeo(
      new THREE.TorusGeometry(entranceSpec.tableRadius, 0.034, 10, 36),
    );
    goldEdgeGeo.rotateX(Math.PI / 2);
    goldEdgeGeo.translate(0, 0.55, 0);

    const underGlowGeo = tracker.trackGeo(
      new THREE.TorusGeometry(entranceSpec.tableRadius - 0.08, 0.022, 8, 32),
    );
    underGlowGeo.rotateX(Math.PI / 2);
    underGlowGeo.translate(0, 0.035, 0);
    const underGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 1.25,
        roughness: 0.2,
      }),
    );

    const crystalLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.05, 0.038, 0.54, 12));
    crystalLegGeo.translate(0, 0.27, 0);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(crystalLegGeo, mats.crystalGlass);
      leg.position.set(Math.cos(ang) * 1.02, 0, Math.sin(ang) * 1.02);
      tableGroup.add(leg);
    }

    const heartLobeBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.045, 16));
    heartLobeBaseGeo.translate(0, 0.022, 0);
    const hbL = new THREE.Mesh(heartLobeBaseGeo, mats.champagneGold);
    hbL.position.set(-0.14, 0, -1.08);
    const hbR = new THREE.Mesh(heartLobeBaseGeo, mats.champagneGold);
    hbR.position.set(0.14, 0, -1.08);

    const tablePlaqueTex = createPlaqueCanvasTex(
      tracker,
      '✦ OUR LITTLE KINGDOM ✦',
      'Two Lives · One Little Kingdom',
    );
    const plaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.5, 0.16));
    const plaqueBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.53, 0.18, 0.018));
    const plaqueMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: tablePlaqueTex, side: THREE.FrontSide }),
    );
    // Front plaque at South (-Z) edge: rotation.y = Math.PI so +Z front normal points toward -Z viewer
    const plaqueBoardFront = new THREE.Mesh(plaqueBoardGeo, mats.champagneGold);
    plaqueBoardFront.position.set(0, 0.575, -1.11);
    plaqueBoardFront.rotation.order = 'YXZ';
    plaqueBoardFront.rotation.y = Math.PI;
    plaqueBoardFront.rotation.x = -Math.PI / 4;

    const plaqueMeshFront = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaqueMeshFront.position.set(0, 0.582, -1.122);
    plaqueMeshFront.rotation.order = 'YXZ';
    plaqueMeshFront.rotation.y = Math.PI;
    plaqueMeshFront.rotation.x = -Math.PI / 4;

    // Back plaque at North (+Z) edge: rotation.y = 0 so +Z front normal points toward +Z viewer
    const plaqueBoardBack = new THREE.Mesh(plaqueBoardGeo, mats.champagneGold);
    plaqueBoardBack.position.set(0, 0.575, 1.11);
    plaqueBoardBack.rotation.order = 'YXZ';
    plaqueBoardBack.rotation.y = 0;
    plaqueBoardBack.rotation.x = -Math.PI / 4;

    const plaqueMeshBack = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaqueMeshBack.position.set(0, 0.582, 1.122);
    plaqueMeshBack.rotation.order = 'YXZ';
    plaqueMeshBack.rotation.y = 0;
    plaqueMeshBack.rotation.x = -Math.PI / 4;

    tableGroup.add(
      new THREE.Mesh(goldEdgeGeo, mats.champagneGold),
      new THREE.Mesh(underGlowGeo, underGlowMat),
      hbL,
      hbR,
      plaqueBoardFront,
      plaqueMeshFront,
      plaqueBoardBack,
      plaqueMeshBack,
    );

    const mcY = 0.55;
    const towerCylGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.135, 0.155, 1.04, 16));
    towerCylGeo.translate(0, 0.52, 0);
    const towerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.185, 0.52, 16));
    towerSpireGeo.translate(0, 1.3, 0);
    const balconyRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.155, 0.014, 8, 18));
    balconyRingGeo.rotateX(Math.PI / 2);
    balconyRingGeo.translate(0, 0.78, 0);

    // 1. Left (West) = Yeshwanth's Tower (Warm champagne gold, warm ivory, sun/star motifs, golden lights)
    const towerAGroup = new THREE.Group();
    towerAGroup.position.set(-0.28, mcY, 0.18);
    const warmChampagneMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.5,
      }),
    );
    const sunStarGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.032, 0));
    const sunFinial = new THREE.Mesh(sunStarGeo, warmChampagneMat);
    sunFinial.position.set(0, 1.6, 0);
    const starMotifFront = new THREE.Mesh(sunStarGeo, mats.champagneGold);
    starMotifFront.position.set(0, 0.62, -0.15);
    towerAGroup.add(
      new THREE.Mesh(towerCylGeo, warmChampagneMat),
      new THREE.Mesh(towerSpireGeo, mats.champagneGold),
      new THREE.Mesh(balconyRingGeo, mats.champagneGold),
      sunFinial,
      starMotifFront,
    );

    // 2. Right (East) = Harsha's Tower (Blush pink, pearl, lavender, crystal, flowers)
    const towerBGroup = new THREE.Group();
    towerBGroup.position.set(0.28, mcY, 0.18);
    const softBlushCrystalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fce7f3',
        emissive: '#f472b6',
        emissiveIntensity: 0.38,
        roughness: 0.16,
        metalness: 0.25,
      }),
    );
    const miniFlowerGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
    for (let f = 0; f < 5; f++) {
      const ang = (f * Math.PI * 2) / 5;
      const fl = new THREE.Mesh(
        miniFlowerGeo,
        f % 2 === 0 ? softBlushCrystalMat : mats.softLavender,
      );
      fl.position.set(Math.cos(ang) * 0.155, 0.78, Math.sin(ang) * 0.155);
      towerBGroup.add(fl);
    }
    const heartFinial = buildSculptedHeartMesh(tracker, 0.28, softBlushCrystalMat);
    heartFinial.position.set(0, 1.6, 0);
    towerBGroup.add(
      new THREE.Mesh(towerCylGeo, softBlushCrystalMat),
      new THREE.Mesh(towerSpireGeo, mats.blushRoseMarble),
      new THREE.Mesh(balconyRingGeo, mats.crystalGlass),
      heartFinial,
    );

    // 3. Connecting Bridge between Yeshwanth's Tower & Harsha's Tower + "Y" and "H" Plaques
    const skyBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.56, 0.075, 0.14));
    skyBridgeGeo.translate(0, mcY + 0.74, 0.18);
    const skyBridgeArchGeo = tracker.trackGeo(new THREE.TorusGeometry(0.24, 0.014, 8, 18, Math.PI));
    skyBridgeArchGeo.translate(0, mcY + 0.78, 0.18);

    const yMedallionTex = createInitialMedallionTex(tracker, 'Y', '#4a1026', '#fde047');
    const hMedallionTex = createInitialMedallionTex(tracker, 'H', '#831843', '#fbcfe8');
    const miniMedallionGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.065, 0.065));
    const yMedMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: yMedallionTex, side: THREE.FrontSide }),
    );
    const hMedMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: hMedallionTex, side: THREE.FrontSide }),
    );
    const yPlaqueFront = new THREE.Mesh(miniMedallionGeo, yMedMat);
    yPlaqueFront.position.set(-0.12, mcY + 0.74, 0.108);
    yPlaqueFront.rotation.y = Math.PI;
    const hPlaqueFront = new THREE.Mesh(miniMedallionGeo, hMedMat);
    hPlaqueFront.position.set(0.12, mcY + 0.74, 0.108);
    hPlaqueFront.rotation.y = Math.PI;
    const yPlaqueBack = new THREE.Mesh(miniMedallionGeo, yMedMat);
    yPlaqueBack.position.set(-0.12, mcY + 0.74, 0.252);
    const hPlaqueBack = new THREE.Mesh(miniMedallionGeo, hMedMat);
    hPlaqueBack.position.set(0.12, mcY + 0.74, 0.252);

    // Miniature Queen's Courtyard Throne & Circular Heart Frame at (0, mcY, -0.04)
    const miniQueenDaisGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.21, 0.035, 18));
    miniQueenDaisGeo.translate(0, mcY + 0.018, -0.04);
    const miniQueenFrameGeo = tracker.trackGeo(new THREE.TorusGeometry(0.11, 0.01, 8, 18));
    miniQueenFrameGeo.translate(0, mcY + 0.16, 0.02);
    const miniFrameHeart = buildSculptedHeartMesh(tracker, 0.22, softBlushCrystalMat);
    miniFrameHeart.position.set(0, mcY + 0.16, 0.02);

    // Miniature Twin-Stream Heart Fountain at (0, mcY, -0.38)
    const miniFountainHeart = buildSculptedHeartMesh(tracker, 0.22, mats.crystalGlass);
    miniFountainHeart.position.set(0, mcY + 0.11, -0.38);

    tableGroup.add(
      towerAGroup,
      towerBGroup,
      new THREE.Mesh(skyBridgeGeo, mats.champagneGold),
      new THREE.Mesh(skyBridgeArchGeo, mats.crystalGlass),
      yPlaqueFront,
      hPlaqueFront,
      yPlaqueBack,
      hPlaqueBack,
      new THREE.Mesh(miniQueenDaisGeo, mats.pearlWhite),
      new THREE.Mesh(miniQueenFrameGeo, mats.champagneGold),
      miniFrameHeart,
      miniFountainHeart,
    );

    // Miniature 3D Heart Trees arranged in a subtle Heart-Shaped Kingdom silhouette
    const trunkGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.015, 0.022, 0.22, 8));
    trunkGeo.translate(0, 0.11, 0);
    const canopyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.078, 10, 10));
    const buildMiniHeartTree = (
      tx: number,
      tz: number,
      matA: THREE.Material,
      matB: THREE.Material,
    ) => {
      const htg = new THREE.Group();
      htg.position.set(tx, mcY, tz);
      const tr = new THREE.Mesh(trunkGeo, mats.champagneGold);
      const lobeL = new THREE.Mesh(canopyGeo, matA);
      lobeL.position.set(-0.048, 0.24, 0);
      lobeL.scale.set(1.05, 1.12, 0.95);
      const lobeR = new THREE.Mesh(canopyGeo, matB);
      lobeR.position.set(0.048, 0.24, 0);
      lobeR.scale.set(1.05, 1.12, 0.95);
      const tip = new THREE.Mesh(canopyGeo, matA);
      tip.position.set(0, 0.175, 0);
      tip.scale.set(0.78, 0.85, 0.78);
      htg.add(tr, lobeL, lobeR, tip);
      return htg;
    };
    tableGroup.add(
      buildMiniHeartTree(-0.46, -0.44, warmChampagneMat, softBlushCrystalMat),
      buildMiniHeartTree(0.46, -0.44, softBlushCrystalMat, warmChampagneMat),
      buildMiniHeartTree(-0.58, 0.18, warmChampagneMat, softBlushCrystalMat),
      buildMiniHeartTree(0.58, 0.18, softBlushCrystalMat, warmChampagneMat),
    );

    // Subtle Heart-Shaped Perimeter Path & Miniature Lanterns
    const windingPathGeo = tracker.trackGeo(new THREE.RingGeometry(0.82, 0.94, 36));
    windingPathGeo.rotateX(-Math.PI / 2);
    windingPathGeo.translate(0, mcY + 0.006, 0);
    tableGroup.add(new THREE.Mesh(windingPathGeo, mats.champagneGold));

    const miniLanternPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 6));
    miniLanternPostGeo.translate(0, 0.07, 0);
    const miniLanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
    miniLanternOrbGeo.translate(0, 0.15, 0);
    for (let l = 0; l < 8; l++) {
      const t = (l / 8) * Math.PI * 2;
      // Heart-shaped parametric curve on tabletop
      const hx = 0.68 * Math.pow(Math.sin(t), 3);
      const hz = 0.56 * Math.cos(t) - 0.18 * Math.cos(2 * t) - 0.08 * Math.cos(3 * t);
      const lg = new THREE.Group();
      lg.position.set(hx, mcY, hz);
      lg.add(
        new THREE.Mesh(miniLanternPostGeo, mats.champagneGold),
        new THREE.Mesh(miniLanternOrbGeo, warmChampagneMat),
      );
      tableGroup.add(lg);
    }

    const memFrameOuterGeo = tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.2, 0.016));
    memFrameOuterGeo.translate(0, 0.11, 0);
    const memFrameInnerGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.13, 0.16));
    memFrameInnerGeo.translate(0, 0.11, 0.01);
    const memFrameInnerBackGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.13, 0.16));
    memFrameInnerBackGeo.rotateY(Math.PI);
    memFrameInnerBackGeo.translate(0, 0.11, -0.01);

    const frameAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
    frameAngles.forEach((ang, idx) => {
      const fg = new THREE.Group();
      const fx = Math.cos(ang) * 0.88;
      const fz = Math.sin(ang) * 0.88;
      fg.position.set(fx, mcY, fz);
      fg.rotation.y = Math.atan2(fx, fz);

      const defaultTex = createMemoryFrameDefaultTex(tracker, idx);
      const artMat = tracker.trackMat(
        new THREE.MeshBasicMaterial({ map: defaultTex, side: THREE.FrontSide }),
      );
      this.memoryFrameMaterials.push(artMat);

      fg.add(
        new THREE.Mesh(memFrameOuterGeo, mats.champagneGold),
        new THREE.Mesh(memFrameInnerGeo, artMat),
        new THREE.Mesh(memFrameInnerBackGeo, artMat),
      );
      tableGroup.add(fg);
    });

    // Section 1: Small Ornate Golden Gate on the Front (South, -Z) side with "OUR LITTLE KINGDOM" above it
    const gateGroup = new THREE.Group();
    gateGroup.position.set(
      entranceSpec.position.x - entranceSpec.tableCenterLocal.x,
      mcY,
      entranceSpec.position.z - entranceSpec.tableCenterLocal.z,
    );
    gateGroup.rotation.y = Math.PI; // Faces South (-Z) directly toward the approaching player

    const gateArchGeo = tracker.trackGeo(new THREE.TorusGeometry(0.19, 0.022, 8, 20, Math.PI));
    gateArchGeo.translate(0, 0.22, 0);
    const gatePillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.024, 0.028, 0.22, 8));
    gatePillarGeo.translate(0, 0.11, 0);
    const gpL = new THREE.Mesh(gatePillarGeo, mats.champagneGold);
    gpL.position.x = -0.19;
    const gpR = new THREE.Mesh(gatePillarGeo, mats.champagneGold);
    gpR.position.x = 0.19;

    // Small sculpted heart details integrated into the golden gate architecture
    const gateHeartTop = buildSculptedHeartMesh(tracker, 0.22, mats.champagneGold);
    gateHeartTop.position.set(0, 0.44, 0);
    const gateHeartL = buildSculptedHeartMesh(tracker, 0.14, softBlushCrystalMat);
    gateHeartL.position.set(-0.19, 0.24, 0.02);
    const gateHeartR = buildSculptedHeartMesh(tracker, 0.14, warmChampagneMat);
    gateHeartR.position.set(0.19, 0.24, 0.02);

    // "OUR LITTLE KINGDOM" plaque mounted above the small ornate golden gate (FrontSide on both faces)
    const gateTitleTex = createPlaqueCanvasTex(
      tracker,
      'OUR LITTLE KINGDOM',
      undefined,
      '#4a1026',
      '#fde047',
    );
    const gateTitleMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: gateTitleTex, side: THREE.FrontSide }),
    );
    const gateTitleGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.34, 0.095));
    const gateTitleBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.36, 0.11, 0.014));
    const gateTitleBoard = new THREE.Mesh(gateTitleBoardGeo, mats.champagneGold);
    gateTitleBoard.position.set(0, 0.34, 0);
    const gateTitleFront = new THREE.Mesh(gateTitleGeo, gateTitleMat);
    gateTitleFront.position.set(0, 0.34, 0.009); // +Z of gateGroup faces South (-Z) toward approaching player!
    const gateTitleBack = new THREE.Mesh(gateTitleGeo, gateTitleMat);
    gateTitleBack.position.set(0, 0.34, -0.009);
    gateTitleBack.rotation.y = Math.PI;

    const doorLeafGeo = tracker.trackGeo(new THREE.BoxGeometry(0.17, 0.24, 0.016));
    doorLeafGeo.translate(0.085, 0.12, 0);
    this.leftGatePivot = new THREE.Group();
    this.leftGatePivot.position.copy(entranceSpec.doorPivotLeft);
    this.leftGatePivot.add(new THREE.Mesh(doorLeafGeo, mats.champagneGold));

    const doorLeafRightGeo = tracker.trackGeo(new THREE.BoxGeometry(0.17, 0.24, 0.016));
    doorLeafRightGeo.translate(-0.085, 0.12, 0);
    this.rightGatePivot = new THREE.Group();
    this.rightGatePivot.position.copy(entranceSpec.doorPivotRight);
    this.rightGatePivot.add(new THREE.Mesh(doorLeafRightGeo, mats.champagneGold));

    this.dynamicObjects.add(this.leftGatePivot);
    this.dynamicObjects.add(this.rightGatePivot);

    gateGroup.add(
      new THREE.Mesh(gateArchGeo, mats.champagneGold),
      gpL,
      gpR,
      gateHeartTop,
      gateHeartL,
      gateHeartR,
      gateTitleBoard,
      gateTitleFront,
      gateTitleBack,
      this.leftGatePivot,
      this.rightGatePivot,
    );
    tableGroup.add(gateGroup);
  }

  /**
   * Sections 1–13: Connected Full-Scale "OUR LITTLE KINGDOM" Enclave (`dwRoot` at `(33.0, y0, 12.0)`)
   * Journey:
   * Entrance ("OUR LITTLE KINGDOM") -> Awakening Flower Path -> Central Courtyard (Twin-Stream Heart Fountain)
   * -> Two Towers & Shared Bridge/Garden ("Y" & "H") -> Queen's Courtyard (Elevated Circular Dais, Intimate Throne, Circular Heart Frame)
   * -> Rising Crown (Queen Reveal) -> Golden Yeshwanth Witnessing (Hand over Heart) -> World-Space Gratitude Messages
   * -> Full Kingdom Illumination & Subtle Heart-Shaped Castle Composition from Above.
   */
  private buildConnectedLittleDreamWorld(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const dwRoot = new THREE.Group();
    dwRoot.name = 'LittleDreamWorldEnclave';
    dwRoot.position.set(33.0, y0, 12.0);
    this.group.add(dwRoot);

    this.dwExpandGroup = new THREE.Group();
    dwRoot.add(this.dwExpandGroup);

    const plateauGeo = tracker.trackGeo(new THREE.CylinderGeometry(8.6, 8.0, 0.45, 40));
    plateauGeo.translate(0, -0.225, 0);
    const plateauMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        roughness: 0.72,
        metalness: 0.05,
      }),
    );
    const plateauMesh = new THREE.Mesh(plateauGeo, plateauMat);
    plateauMesh.receiveShadow = true;

    const rimGoldGeo = tracker.trackGeo(new THREE.TorusGeometry(8.55, 0.12, 10, 48));
    rimGoldGeo.rotateX(Math.PI / 2);
    rimGoldGeo.translate(0, 0.02, 0);

    // Narrow curved pathway winding from West Entrance (-6.6, 0) through Central Courtyard (0, 0) to Queen's Courtyard (+3.35, 0)
    const pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.6, 0.018, 0.0),
      new THREE.Vector3(-4.8, 0.018, 0.42),
      new THREE.Vector3(-2.6, 0.018, -0.38),
      new THREE.Vector3(0.0, 0.018, 0.0),
      new THREE.Vector3(1.85, 0.018, 0.22),
      new THREE.Vector3(3.35, 0.018, 0.0),
    ]);
    const curvedPathGeo = tracker.trackGeo(new THREE.TubeGeometry(pathCurve, 36, 0.82, 8, false));
    curvedPathGeo.scale(1.0, 0.035, 1.0);

    this.dwExpandGroup.add(
      plateauMesh,
      new THREE.Mesh(rimGoldGeo, mats.champagneGold),
      new THREE.Mesh(curvedPathGeo, mats.blushRoseMarble),
    );

    // =========================================================================
    // 1. ENTRANCE GATE ("OUR LITTLE KINGDOM") ON WEST EDGE (-6.8, 0, 0)
    // =========================================================================
    const returnGateGroup = new THREE.Group();
    returnGateGroup.position.set(-6.8, 0, 0);
    returnGateGroup.rotation.y = Math.PI / 2;

    const rgPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 3.1, 14));
    rgPillarGeo.translate(0, 1.55, 0);
    const rgPillarL = new THREE.Mesh(rgPillarGeo, mats.champagneGold);
    rgPillarL.position.x = -1.35;
    const rgPillarR = new THREE.Mesh(rgPillarGeo, mats.champagneGold);
    rgPillarR.position.x = 1.35;

    const rgArchGeo = tracker.trackGeo(new THREE.TorusGeometry(1.35, 0.13, 10, 28, Math.PI));
    rgArchGeo.translate(0, 3.1, 0);

    const gateCrestHeart = buildSculptedHeartMesh(tracker, 1.6, mats.champagneGold);
    gateCrestHeart.position.set(0, 4.35, 0);

    const portalRingGeo = tracker.trackGeo(new THREE.RingGeometry(0.85, 1.25, 28));
    portalRingGeo.translate(0, 1.75, 0);
    const portalGlowMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#f472b6',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42,
      }),
    );
    this.dreamWorldPortalRing = new THREE.Mesh(portalRingGeo, portalGlowMat);
    this.dynamicObjects.add(this.dreamWorldPortalRing);

    const kingdomGateTex = createPlaqueCanvasTex(
      tracker,
      'OUR LITTLE KINGDOM',
      'Two Lives · One Little Kingdom',
      '#4a1026',
      '#fde047',
    );
    const returnSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.35, 0.62));
    const returnSignBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(2.45, 0.7, 0.1));
    const returnSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: kingdomGateTex, side: THREE.FrontSide }),
    );
    const returnSignBoard = new THREE.Mesh(returnSignBoardGeo, mats.champagneGold);
    returnSignBoard.position.set(0, 3.62, 0);
    const returnSignMeshFront = new THREE.Mesh(returnSignGeo, returnSignMat);
    returnSignMeshFront.position.set(0, 3.62, 0.06);
    const returnSignMeshBack = new THREE.Mesh(returnSignGeo, returnSignMat);
    returnSignMeshBack.position.set(0, 3.62, -0.06);
    returnSignMeshBack.rotation.y = Math.PI;

    returnGateGroup.add(
      rgPillarL,
      rgPillarR,
      new THREE.Mesh(rgArchGeo, mats.champagneGold),
      gateCrestHeart,
      this.dreamWorldPortalRing,
      returnSignBoard,
      returnSignMeshFront,
      returnSignMeshBack,
    );
    this.dwExpandGroup.add(returnGateGroup);

    // =========================================================================
    // 2 & 4. AWAKENING PATHWAY: BLOOMING FLOWERS, CRYSTALS, TINY HEDGES & LANTERNS
    // =========================================================================
    const stemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.45 }),
    );
    const flowerPinkMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f472b6',
        emissive: '#db2777',
        emissiveIntensity: 0.45,
        roughness: 0.25,
      }),
    );
    const flowerGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.45,
        roughness: 0.25,
      }),
    );

    const pathStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 8));
    pathStemGeo.translate(0, 0.21, 0);
    const pathPetalGeo = tracker.trackGeo(new THREE.SphereGeometry(0.14, 10, 8));
    pathPetalGeo.scale(1.25, 0.65, 1.25);
    pathPetalGeo.translate(0, 0.44, 0);

    // 14 Pathway flowers that bloom sequentially as Harsha walks from the entrance (-5.8) to the Queen's Courtyard (+3.0)
    const pathFlowerCoords: Array<[number, number]> = [
      [-5.6, -0.85],
      [-5.4, 0.92],
      [-4.4, -0.72],
      [-4.1, 1.05],
      [-3.1, -1.02],
      [-2.8, 0.68],
      [-1.8, -0.95],
      [-1.5, 0.95],
      [-0.4, -1.95],
      [-0.4, 1.95],
      [1.2, -1.25],
      [1.2, 1.25],
      [2.3, -1.35],
      [2.3, 1.35],
    ];
    pathFlowerCoords.forEach(([fx, fz], idx) => {
      const fg = new THREE.Group();
      fg.position.set(fx, 0, fz);
      fg.scale.setScalar(0.18); // Starts as a tiny sleeping bud!
      fg.add(
        new THREE.Mesh(pathStemGeo, stemMat),
        new THREE.Mesh(
          pathPetalGeo,
          idx % 3 === 0 ? flowerGoldMat : idx % 2 === 0 ? flowerPinkMat : mats.softLavender,
        ),
      );
      this.dwExpandGroup.add(fg);
      this.awakeningFlowers.push({
        group: fg,
        localX: fx,
        localZ: fz,
        bloomRatio: 0.0,
      });
    });

    // Tiny Hedges, Glowing Crystals & Heart-Shaped Decorations along the curved path (Section 4)
    const tinyHedgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.75, 0.34, 0.28));
    tinyHedgeGeo.translate(0, 0.17, 0);
    const crystalClusterGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.18, 0));
    crystalClusterGeo.scale(0.65, 1.45, 0.65);
    crystalClusterGeo.translate(0, 0.24, 0);

    [
      { x: -4.9, z: -1.25, rot: 0.18 },
      { x: -4.9, z: 1.35, rot: -0.18 },
      { x: -2.2, z: -1.35, rot: -0.15 },
      { x: -2.2, z: 1.25, rot: 0.15 },
      { x: 1.65, z: -1.65, rot: 0.1 },
      { x: 1.65, z: 1.65, rot: -0.1 },
    ].forEach((hd, idx) => {
      const hMesh = new THREE.Mesh(tinyHedgeGeo, stemMat);
      hMesh.position.set(hd.x, 0, hd.z);
      hMesh.rotation.y = hd.rot;
      const crMesh = new THREE.Mesh(
        crystalClusterGeo,
        idx % 2 === 0 ? mats.crystalGlass : mats.softLavender,
      );
      crMesh.position.set(hd.x + 0.38, 0, hd.z);
      const heartOrn = buildSculptedHeartMesh(tracker, 0.35, mats.champagneGold);
      heartOrn.position.set(hd.x, 0.42, hd.z);
      this.dwExpandGroup.add(hMesh, crMesh, heartOrn);
    });

    // Section 6 ("Our Story" Detail #1): Two flowers growing together on intertwined stems in the garden
    const twinFlowerGroup = new THREE.Group();
    twinFlowerGroup.position.set(-1.35, 0, -1.45);
    const stem1 = new THREE.Mesh(pathStemGeo, stemMat);
    stem1.rotation.z = -0.18;
    const stem2 = new THREE.Mesh(pathStemGeo, stemMat);
    stem2.position.x = 0.12;
    stem2.rotation.z = 0.18;
    const bloomGold = new THREE.Mesh(pathPetalGeo, flowerGoldMat);
    bloomGold.position.set(0.06, 0, 0);
    const bloomBlush = new THREE.Mesh(pathPetalGeo, flowerPinkMat);
    bloomBlush.position.set(0.06, 0.02, 0.08);
    twinFlowerGroup.add(stem1, stem2, bloomGold, bloomBlush);
    this.dwExpandGroup.add(twinFlowerGroup);

    // Pathway & Heart-Perimeter Lanterns that wake up as Harsha walks through the kingdom
    const lanternPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.048, 1.15, 8));
    lanternPostGeo.translate(0, 0.575, 0);
    const lanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
    lanternOrbGeo.translate(0, 1.2, 0);

    // 16 Lanterns arranged along the pathway AND forming a subtle Heart-Shaped Kingdom outline from above (Section 11)
    const lanternCoords: Array<[number, number]> = [
      [-5.2, -1.4],
      [-5.2, 1.4],
      [-3.4, -2.6],
      [-3.4, 2.6],
      [-1.2, -3.9],
      [-1.2, 3.9],
      [1.4, -4.6],
      [1.4, 4.6],
      [3.8, -4.2],
      [3.8, 4.2],
      [5.4, -2.6],
      [5.4, 2.6],
      [4.2, -1.1],
      [4.2, 1.1],
      [1.6, -1.15],
      [1.6, 1.15],
    ];
    lanternCoords.forEach(([lxPos, lzPos]) => {
      const orbMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: '#fef3c7',
          emissive: '#f59e0b',
          emissiveIntensity: 0.08, // Starts asleep/dim, wakes up as Harsha arrives!
          roughness: 0.2,
        }),
      );
      const lg = new THREE.Group();
      lg.position.set(lxPos, 0, lzPos);
      lg.add(
        new THREE.Mesh(lanternPostGeo, mats.champagneGold),
        new THREE.Mesh(lanternOrbGeo, orbMat),
      );
      this.dwExpandGroup.add(lg);
      this.awakeningLanterns.push({
        orbMat,
        localX: lxPos,
        localZ: lzPos,
        wakeRatio: 0.0,
      });
      this.heartPerimeterLights.push(orbMat);
    });

    // =========================================================================
    // 5. THE CENTRAL COURTYARD — TWIN-STREAM HEART-SHAPED FOUNTAIN AT (0, 0, 0)
    // =========================================================================
    const fountainBasinGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.55, 1.75, 0.42, 28));
    fountainBasinGeo.translate(0, 0.21, 0);
    const waterDiscGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.42, 1.42, 0.36, 28));
    waterDiscGeo.translate(0, 0.22, 0);
    this.fountainWaterMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#7dd3fc',
        emissive: '#0284c7',
        emissiveIntensity: 0.35,
        roughness: 0.12,
      }),
    );

    // Two curved streams of water arching from opposite sides to meet at the center (forming a natural heart arch)
    const leftStreamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.35, -0.92),
      new THREE.Vector3(0, 1.28, -0.78),
      new THREE.Vector3(0, 1.62, -0.32),
      new THREE.Vector3(0, 1.18, 0.0),
    ]);
    const rightStreamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.35, 0.92),
      new THREE.Vector3(0, 1.28, 0.78),
      new THREE.Vector3(0, 1.62, 0.32),
      new THREE.Vector3(0, 1.18, 0.0),
    ]);
    const leftStreamGeo = tracker.trackGeo(
      new THREE.TubeGeometry(leftStreamCurve, 20, 0.055, 8, false),
    );
    const rightStreamGeo = tracker.trackGeo(
      new THREE.TubeGeometry(rightStreamCurve, 20, 0.055, 8, false),
    );
    this.fountainStreamLeftMesh = new THREE.Mesh(leftStreamGeo, this.fountainWaterMat);
    this.fountainStreamRightMesh = new THREE.Mesh(rightStreamGeo, this.fountainWaterMat);
    this.dynamicObjects.add(this.fountainStreamLeftMesh);
    this.dynamicObjects.add(this.fountainStreamRightMesh);

    // Where the two curved streams meet at the center, a small crystal heart glows + two tiny intertwined hearts below (Sections 5 & 6)
    this.fountainHeartMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f43f5e',
        emissiveIntensity: 0.45,
        roughness: 0.12,
        metalness: 0.2,
      }),
    );
    this.fountainCenterHeartGroup = buildSculptedHeartMesh(tracker, 1.35, this.fountainHeartMat);
    this.fountainCenterHeartGroup.position.set(0, 1.18, 0);
    this.dynamicObjects.add(this.fountainCenterHeartGroup);

    const intertwinedHeartA = buildSculptedHeartMesh(tracker, 0.65, mats.champagneGold);
    intertwinedHeartA.position.set(-0.06, 0.52, -0.04);
    intertwinedHeartA.rotation.y = 0.25;
    const intertwinedHeartB = buildSculptedHeartMesh(tracker, 0.65, mats.blushRoseMarble);
    intertwinedHeartB.position.set(0.06, 0.52, 0.04);
    intertwinedHeartB.rotation.y = -0.25;

    // Miniature curved benches & rose clusters around the Central Fountain
    const benchSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.95, 0.08, 0.36));
    benchSeatGeo.translate(0, 0.38, 0);
    const benchN = new THREE.Mesh(benchSeatGeo, mats.pearlWhite);
    benchN.position.set(0, 0, -2.25);
    const benchS = new THREE.Mesh(benchSeatGeo, mats.pearlWhite);
    benchS.position.set(0, 0, 2.25);

    this.dwExpandGroup.add(
      new THREE.Mesh(fountainBasinGeo, mats.pearlWhite),
      new THREE.Mesh(waterDiscGeo, this.fountainWaterMat),
      this.fountainStreamLeftMesh,
      this.fountainStreamRightMesh,
      this.fountainCenterHeartGroup,
      intertwinedHeartA,
      intertwinedHeartB,
      benchN,
      benchS,
    );
    colliders.push({
      x: this.originX + 33.0,
      z: this.originZ + 12.0,
      radius: 1.65,
      y: this.baseY + y0,
      height: 3.5,
    });

    // Oversized & Courtyard Fantasy Flowers around the kingdom
    const bigStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.07, 0.11, 2.4, 10));
    bigStemGeo.translate(0, 1.2, 0);
    const bigBlossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.58, 12, 10));
    bigBlossomGeo.scale(1.2, 0.55, 1.2);
    bigBlossomGeo.translate(0, 2.45, 0);

    const flowerSpots = [
      [-3.8, -3.5],
      [-3.8, 3.5],
      [0.5, -4.8],
      [0.5, 4.8],
      [4.2, -3.6],
      [4.2, 3.6],
    ];
    flowerSpots.forEach(([fx, fz], idx) => {
      const fg = new THREE.Group();
      fg.position.set(fx, 0, fz);
      fg.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.08;
      fg.add(
        new THREE.Mesh(bigStemGeo, stemMat),
        new THREE.Mesh(bigBlossomGeo, idx % 2 === 0 ? flowerPinkMat : mats.softLavender),
      );
      this.dwExpandGroup.add(fg);
      this.flowerGroups.push(fg);
    });

    // =========================================================================
    // 7 & 8. THE QUEEN'S COURTYARD (DEEPER INSIDE AT (+3.35, 0, 0)) + RISING CROWN
    // =========================================================================
    this.queenCourtyardGroup = new THREE.Group();
    this.queenCourtyardGroup.name = 'QueensCourtyard';
    this.queenCourtyardGroup.position.set(3.35, 0, 0);
    this.dwExpandGroup.add(this.queenCourtyardGroup);

    // Slightly elevated 2-tier circular platform
    const daisTier1Geo = tracker.trackGeo(new THREE.CylinderGeometry(1.95, 2.15, 0.14, 32));
    daisTier1Geo.translate(0, 0.07, 0);
    const daisTier2Geo = tracker.trackGeo(new THREE.CylinderGeometry(1.55, 1.72, 0.14, 32));
    daisTier2Geo.translate(0, 0.21, 0);
    const daisGoldRimGeo = tracker.trackGeo(new THREE.TorusGeometry(1.56, 0.03, 8, 32));
    daisGoldRimGeo.rotateX(Math.PI / 2);
    daisGoldRimGeo.translate(0, 0.28, 0);

    this.queenCourtyardGroup.add(
      new THREE.Mesh(daisTier1Geo, mats.pearlWhite),
      new THREE.Mesh(daisTier2Geo, mats.blushRoseMarble),
      new THREE.Mesh(daisGoldRimGeo, mats.champagneGold),
    );

    // Intimate, elegant miniature royal chair / throne (miniature royal chair + crystal + flowers + gold)
    const throneGroup = new THREE.Group();
    throneGroup.position.set(0.35, 0.28, 0);
    throneGroup.rotation.y = -Math.PI / 2; // Faces West (-X) toward the approaching path & Central Courtyard

    const throneSeatGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.38, 0.34, 0.42, 18));
    throneSeatGeo.translate(0, 0.21, 0);
    const throneCushionGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 18));
    throneCushionGeo.translate(0, 0.44, 0);
    const throneBackGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.96, 0.1));
    throneBackGeo.translate(0, 0.88, -0.28);
    const throneBackArchGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.34, 0.04, 10, 20, Math.PI),
    );
    throneBackArchGeo.translate(0, 1.36, -0.28);
    const throneArmGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.28, 0.48));
    const armL = new THREE.Mesh(throneArmGeo, mats.champagneGold);
    armL.position.set(-0.34, 0.58, -0.04);
    const armR = new THREE.Mesh(throneArmGeo, mats.champagneGold);
    armR.position.set(0.34, 0.58, -0.04);
    const throneTopCrystal = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(0.09, 0)),
      mats.crystalGlass,
    );
    throneTopCrystal.position.set(0, 1.76, -0.28);

    throneGroup.add(
      new THREE.Mesh(throneSeatGeo, mats.pearlWhite),
      new THREE.Mesh(throneCushionGeo, flowerPinkMat),
      new THREE.Mesh(throneBackGeo, mats.pearlWhite),
      new THREE.Mesh(throneBackArchGeo, mats.champagneGold),
      armL,
      armR,
      throneTopCrystal,
    );
    this.queenCourtyardGroup.add(throneGroup);

    // Behind the throne: Circular Architectural Frame + Subtle Glowing Heart inside the frame (Section 7)
    this.queenArchFrameMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 0.28,
        roughness: 0.2,
        metalness: 0.78,
      }),
    );
    const queenCircleFrameGeo = tracker.trackGeo(new THREE.TorusGeometry(1.18, 0.065, 12, 36));
    const queenCircleFrame = new THREE.Mesh(queenCircleFrameGeo, this.queenArchFrameMat);
    queenCircleFrame.position.set(0.82, 1.52, 0);
    queenCircleFrame.rotation.y = Math.PI / 2;

    this.queenFrameHeartGroup = buildSculptedHeartMesh(tracker, 2.1, this.fountainHeartMat);
    this.queenFrameHeartGroup.position.set(0.82, 1.52, 0);
    this.queenFrameHeartGroup.rotation.y = -Math.PI / 2;
    this.dynamicObjects.add(this.queenFrameHeartGroup);

    this.queenCourtyardGroup.add(queenCircleFrame, this.queenFrameHeartGroup);

    // Section 8: Crystal Pedestal in front of the throne + Hidden Royal Crown (NOT visible initially!)
    const crownPedestalGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.28, 0.68, 20));
    crownPedestalGeo.translate(0, 0.34, 0);
    const crownPedestalMesh = new THREE.Mesh(crownPedestalGeo, mats.crystalGlass);
    crownPedestalMesh.position.set(-0.68, 0.28, 0); // At localX = 3.35 - 0.68 = 2.67 in dwRoot
    this.queenCourtyardGroup.add(crownPedestalMesh);

    this.queenCrownGroup = new THREE.Group();
    this.queenCrownGroup.name = 'QueensRisingCrown';
    this.queenCrownGroup.position.set(-0.68, 0.62, 0);
    this.queenCrownGroup.visible = false; // Crucial Section 8 requirement: Crown is NOT visible from the beginning!
    this.dynamicObjects.add(this.queenCrownGroup);

    const crownBandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.15, 0.018, 10, 24));
    crownBandGeo.rotateX(Math.PI / 2);
    const crownPeakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.028, 0.11, 6));
    const crownGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.026, 0));
    this.queenCrownGroup.add(new THREE.Mesh(crownBandGeo, mats.champagneGold));

    for (let p = 0; p < 5; p++) {
      const ang = (p * Math.PI * 2) / 5;
      const peak = new THREE.Mesh(crownPeakGeo, mats.champagneGold);
      peak.position.set(Math.cos(ang) * 0.15, 0.055, Math.sin(ang) * 0.15);
      const gem = new THREE.Mesh(crownGemGeo, flowerPinkMat);
      gem.position.set(Math.cos(ang) * 0.15, 0.115, Math.sin(ang) * 0.15);
      this.queenCrownGroup.add(peak, gem);
    }

    const crownHaloGeo = tracker.trackGeo(new THREE.SphereGeometry(0.32, 14, 14));
    this.queenCrownHaloMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.0,
      }),
    );
    this.queenCrownGroup.add(new THREE.Mesh(crownHaloGeo, this.queenCrownHaloMat));
    this.queenCourtyardGroup.add(this.queenCrownGroup);

    // =========================================================================
    // 3 & 6. THE TWO TOWERS, CONNECTING BRIDGE ("Y" & "H"), SHARED GARDEN & MEETING TREES
    // =========================================================================
    this.dwFullCastleBackdrop = new THREE.Group();
    this.dwFullCastleBackdrop.position.set(6.2, 0, 0);
    this.dwFullCastleBackdrop.rotation.y = -Math.PI / 2;

    const bigTowerGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.88, 0.98, 5.4, 20));
    bigTowerGeo.translate(0, 2.7, 0);
    const bigSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(1.12, 2.45, 20));
    bigSpireGeo.translate(0, 6.62, 0);
    const bigBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(3.8, 0.48, 0.92));
    bigBridgeGeo.translate(0, 3.8, 0);

    const yeshTowerMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.22,
        roughness: 0.25,
        metalness: 0.48,
      }),
    );
    const harshaTowerMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fce7f3',
        emissive: '#f472b6',
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.22,
      }),
    );
    this.heartPerimeterLights.push(yeshTowerMat, harshaTowerMat);

    // Tower Windows: One warm gold (Yeshwanth), One soft pink (Harsha) — Section 6
    const towerWinGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.34, 0.62));
    const yeshWinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.15, // Wakes up when Harsha walks in!
        roughness: 0.15,
      }),
    );
    const harshaWinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#ec4899',
        emissiveIntensity: 0.15, // Wakes up when Harsha walks in!
        roughness: 0.15,
      }),
    );
    this.kingdomWindowMats.push(yeshWinMat, harshaWinMat);
    this.heartPerimeterLights.push(yeshWinMat, harshaWinMat);

    // Yeshwanth's Tower (Left when facing East -> local -X of dwFullCastleBackdrop)
    const bigTowerL = new THREE.Group();
    bigTowerL.position.set(-1.95, 0, 0);
    const yeshWin1 = new THREE.Mesh(towerWinGeo, yeshWinMat);
    yeshWin1.position.set(0, 2.2, 0.94);
    const yeshWin2 = new THREE.Mesh(towerWinGeo, yeshWinMat);
    yeshWin2.position.set(0, 3.6, 0.91);
    const bigSunStarGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.28, 0));
    const yeshSunMotif = new THREE.Mesh(bigSunStarGeo, mats.champagneGold);
    yeshSunMotif.position.set(0, 4.65, 0.9);
    bigTowerL.add(
      new THREE.Mesh(bigTowerGeo, yeshTowerMat),
      new THREE.Mesh(bigSpireGeo, mats.champagneGold),
      yeshWin1,
      yeshWin2,
      yeshSunMotif,
    );

    // Harsha's Tower (Right when facing East -> local +X of dwFullCastleBackdrop)
    const bigTowerR = new THREE.Group();
    bigTowerR.position.set(1.95, 0, 0);
    const harshaWin1 = new THREE.Mesh(towerWinGeo, harshaWinMat);
    harshaWin1.position.set(0, 2.2, 0.94);
    const harshaWin2 = new THREE.Mesh(towerWinGeo, harshaWinMat);
    harshaWin2.position.set(0, 3.6, 0.91);
    const harshaHeartMotif = buildSculptedHeartMesh(tracker, 1.4, flowerPinkMat);
    harshaHeartMotif.position.set(0, 4.65, 0.92);
    bigTowerR.add(
      new THREE.Mesh(bigTowerGeo, harshaTowerMat),
      new THREE.Mesh(bigSpireGeo, mats.blushRoseMarble),
      harshaWin1,
      harshaWin2,
      harshaHeartMotif,
    );

    // Section 6 ("Our Story" Detail #2): Two small golden plaques "Y" and "H" on the connecting bridge
    const yBridgeTex = createInitialMedallionTex(tracker, 'Y', '#4a1026', '#fde047');
    const hBridgeTex = createInitialMedallionTex(tracker, 'H', '#831843', '#fbcfe8');
    const bridgeMedallionGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.46, 0.46));
    const bridgeMedBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.52, 0.52, 0.08));
    const yBridgeMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: yBridgeTex, side: THREE.FrontSide }),
    );
    const hBridgeMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: hBridgeTex, side: THREE.FrontSide }),
    );

    const yBridgeBoard = new THREE.Mesh(bridgeMedBoardGeo, mats.champagneGold);
    yBridgeBoard.position.set(-0.85, 3.8, 0.45);
    const yBridgeFront = new THREE.Mesh(bridgeMedallionGeo, yBridgeMat);
    yBridgeFront.position.set(-0.85, 3.8, 0.5);
    const hBridgeBoard = new THREE.Mesh(bridgeMedBoardGeo, mats.champagneGold);
    hBridgeBoard.position.set(0.85, 3.8, 0.45);
    const hBridgeFront = new THREE.Mesh(bridgeMedallionGeo, hBridgeMat);
    hBridgeFront.position.set(0.85, 3.8, 0.5);

    const centerBridgeHeart = buildSculptedHeartMesh(tracker, 1.5, mats.champagneGold);
    centerBridgeHeart.position.set(0, 3.8, 0.52);

    // Section 6 ("Our Story" Detail #5): Two trees beneath the bridge whose branches gently meet overhead
    const meetBranchCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, 0.0, 0.45),
      new THREE.Vector3(-1.05, 1.35, 0.45),
      new THREE.Vector3(-0.48, 2.35, 0.45),
      new THREE.Vector3(0.0, 2.55, 0.45),
    ]);
    const meetBranchCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.15, 0.0, 0.45),
      new THREE.Vector3(1.05, 1.35, 0.45),
      new THREE.Vector3(0.48, 2.35, 0.45),
      new THREE.Vector3(0.0, 2.55, 0.45),
    ]);
    const meetTreeL = new THREE.Mesh(
      tracker.trackGeo(new THREE.TubeGeometry(meetBranchCurveL, 16, 0.08, 8, false)),
      mats.champagneGold,
    );
    const meetTreeR = new THREE.Mesh(
      tracker.trackGeo(new THREE.TubeGeometry(meetBranchCurveR, 16, 0.08, 8, false)),
      mats.champagneGold,
    );
    const meetCanopyHeart = buildSculptedHeartMesh(tracker, 2.2, flowerPinkMat);
    meetCanopyHeart.position.set(0, 2.62, 0.45);

    // Flanking Heart Trees
    const dwTreeTrunkGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 10));
    dwTreeTrunkGeo.translate(0, 1.1, 0);
    const dwTreeLobeGeo = tracker.trackGeo(new THREE.IcosahedronGeometry(0.82, 2));
    const buildDreamWorldHeartTree = (hx: number, hz: number, primaryMat: THREE.Material) => {
      const htg = new THREE.Group();
      htg.position.set(hx, 0, hz);
      htg.add(new THREE.Mesh(dwTreeTrunkGeo, mats.champagneGold));
      const lL = new THREE.Mesh(dwTreeLobeGeo, primaryMat);
      lL.position.set(-0.56, 2.65, 0);
      lL.scale.set(1.05, 1.15, 0.92);
      const lR = new THREE.Mesh(dwTreeLobeGeo, primaryMat);
      lR.position.set(0.56, 2.65, 0);
      lR.scale.set(1.05, 1.15, 0.92);
      const lTip = new THREE.Mesh(dwTreeLobeGeo, mats.champagneGold);
      lTip.position.set(0, 1.98, 0);
      lTip.scale.set(0.75, 0.85, 0.75);
      htg.add(lL, lR, lTip);
      return htg;
    };

    this.dwFullCastleBackdrop.add(
      bigTowerL,
      bigTowerR,
      new THREE.Mesh(bigBridgeGeo, mats.champagneGold),
      yBridgeBoard,
      yBridgeFront,
      hBridgeBoard,
      hBridgeFront,
      centerBridgeHeart,
      meetTreeL,
      meetTreeR,
      meetCanopyHeart,
      buildDreamWorldHeartTree(-3.6, 0.8, flowerGoldMat),
      buildDreamWorldHeartTree(3.6, 0.8, flowerPinkMat),
    );
    this.dwExpandGroup.add(this.dwFullCastleBackdrop);

    // Toy-Style Kingdom Houses with Illuminating Windows
    const houseWallsGeo = tracker.trackGeo(new THREE.BoxGeometry(1.55, 1.75, 1.55));
    houseWallsGeo.translate(0, 0.875, 0);
    const houseRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(1.38, 1.28, 4));
    houseRoofGeo.rotateY(Math.PI / 4);
    houseRoofGeo.translate(0, 2.38, 0);
    const houseWinGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.32, 0.42));

    [
      [-2.2, -5.2],
      [-2.2, 5.2],
      [3.6, -5.0],
      [3.6, 5.0],
    ].forEach(([hx, hz], idx) => {
      const hg = new THREE.Group();
      hg.position.set(hx, 0, hz);
      const hwMat = idx % 2 === 0 ? yeshWinMat : harshaWinMat;
      const hw = new THREE.Mesh(houseWinGeo, hwMat);
      hw.position.set(0, 0.95, hz < 0 ? 0.785 : -0.785);
      if (hz > 0) hw.rotation.y = Math.PI;
      hg.add(
        new THREE.Mesh(houseWallsGeo, mats.creamStone),
        new THREE.Mesh(houseRoofGeo, idx % 2 === 0 ? mats.champagneGold : mats.blushRoseMarble),
        hw,
      );
      this.dwExpandGroup.add(hg);
      colliders.push({
        x: this.originX + 33.0 + hx,
        z: this.originZ + 12.0 + hz,
        radius: 1.15,
        y: this.baseY + y0,
        height: 3.5,
      });
    });

    // =========================================================================
    // 9. GOLDEN YESHWANTH FIGURE (WITNESSING THE QUEEN REVEAL — NO ROSE, NO KNEELING)
    // =========================================================================
    this.goldenYeshwanthGroup = new THREE.Group();
    this.goldenYeshwanthGroup.name = 'GoldenYeshwanthFigure';
    // Positioned respectfully beside the Queen's Courtyard at (2.35, 0, -1.45), facing Harsha & the Crown
    this.goldenYeshwanthGroup.position.set(2.35, 0, -1.45);
    this.goldenYeshwanthGroup.rotation.y = -0.35;

    const goldenSkinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.68,
        roughness: 0.18,
        metalness: 0.82,
      }),
    );
    const goldenCoatMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.52,
        roughness: 0.24,
        metalness: 0.88,
      }),
    );

    const arrivalGlowGeo = tracker.trackGeo(new THREE.SphereGeometry(0.62, 16, 16));
    const arrivalGlowMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.26,
      }),
    );
    this.goldenArrivalGlow = new THREE.Mesh(arrivalGlowGeo, arrivalGlowMat);
    this.goldenArrivalGlow.position.set(0, 1.15, 0);
    this.goldenYeshwanthGroup.add(this.goldenArrivalGlow);

    const legGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.068, 0.055, 0.72, 10));
    legGeo.translate(0, -0.36, 0);
    this.yeshLeftLeg = new THREE.Group();
    this.yeshLeftLeg.position.set(-0.11, 0.72, 0);
    this.yeshLeftLeg.add(new THREE.Mesh(legGeo, goldenCoatMat));
    this.yeshRightLeg = new THREE.Group();
    this.yeshRightLeg.position.set(0.11, 0.72, 0);
    this.yeshRightLeg.add(new THREE.Mesh(legGeo, goldenCoatMat));

    const torsoGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.21, 0.16, 0.68, 12));
    torsoGeo.translate(0, 1.04, 0);
    const sashGeo = tracker.trackGeo(new THREE.TorusGeometry(0.18, 0.025, 8, 16));
    sashGeo.rotateX(Math.PI / 3);
    sashGeo.translate(0, 1.08, 0);

    this.yeshHeadGroup = new THREE.Group();
    this.yeshHeadGroup.position.set(0, 1.54, 0);
    const headGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 14));
    const circletGeo = tracker.trackGeo(new THREE.TorusGeometry(0.135, 0.014, 8, 20));
    circletGeo.rotateX(Math.PI / 2);
    circletGeo.translate(0, 0.1, 0);
    this.yeshHeadGroup.add(
      new THREE.Mesh(headGeo, goldenSkinMat),
      new THREE.Mesh(circletGeo, mats.champagneGold),
    );

    const armGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.048, 0.042, 0.56, 10));
    armGeo.translate(0, -0.26, 0);
    this.yeshLeftArm = new THREE.Group();
    this.yeshLeftArm.position.set(-0.24, 1.32, 0);
    this.yeshLeftArm.add(new THREE.Mesh(armGeo, goldenSkinMat));

    this.yeshRightArm = new THREE.Group();
    this.yeshRightArm.position.set(0.24, 1.32, 0);
    this.yeshRightArm.add(new THREE.Mesh(armGeo, goldenSkinMat));

    this.goldenYeshwanthGroup.add(
      this.yeshLeftLeg,
      this.yeshRightLeg,
      new THREE.Mesh(torsoGeo, goldenCoatMat),
      new THREE.Mesh(sashGeo, mats.blushRoseMarble),
      this.yeshHeadGroup,
      this.yeshLeftArm,
      this.yeshRightArm,
    );
    this.dwExpandGroup.add(this.goldenYeshwanthGroup);

    // =========================================================================
    // 13. DISSOLVING ENTRANCE ROSE PETALS GROUP (Symbolic transition from Rose to Crown)
    // =========================================================================
    this.dissolvingRosePetalsGroup = new THREE.Group();
    this.dissolvingRosePetalsGroup.visible = false;
    const petalGeo = tracker.trackGeo(new THREE.SphereGeometry(0.038, 8, 6));
    petalGeo.scale(1.3, 0.35, 0.9);
    this.rosePetalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fb7185',
        emissive: '#fbbf24',
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.0,
      }),
    );
    for (let i = 0; i < 16; i++) {
      const pm = new THREE.Mesh(petalGeo, this.rosePetalMat);
      this.dissolvingRosePetalsGroup.add(pm);
      this.rosePetalMeshes.push(pm);
    }
    this.dwExpandGroup.add(this.dissolvingRosePetalsGroup);

    // =========================================================================
    // 10. WORLD-SPACE CINEMATIC GRATITUDE TEXT BANNERS (5 SEQUENTIAL BEATS)
    // Strictly uses THREE.FrontSide with separate Front (+Z) and Back (-Z, rotation.y = Math.PI) meshes!
    // =========================================================================
    this.gratitudeBannerTextures.push(
      createWorldGratitudeMessageTex(
        tracker,
        'MY QUEEN',
        'Our Little Kingdom Awakens for You',
        'title',
      ),
      createWorldGratitudeMessageTex(
        tracker,
        'You are the queen of my life.',
        undefined,
        'gratitude',
      ),
      createWorldGratitudeMessageTex(
        tracker,
        'And I am so grateful',
        'that I get to have you in mine.',
        'gratitude',
      ),
      createWorldGratitudeMessageTex(
        tracker,
        'Thank you for making my world',
        'more beautiful.',
        'gratitude',
      ),
      createWorldGratitudeMessageTex(
        tracker,
        'I LOVE YOU, HARSHA ❤️',
        'Forever in Our Little Kingdom',
        'love',
      ),
    );

    const msgGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.15, 0.64));
    this.gratitudeBannerMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.gratitudeBannerTextures[0],
        transparent: true,
        opacity: 0.0,
        side: THREE.FrontSide,
      }),
    );
    this.gratitudeBannerMesh = new THREE.Mesh(msgGeo, this.gratitudeBannerMat);
    this.gratitudeBannerMesh.position.set(2.45, 1.92, 0);
    const msgBack = new THREE.Mesh(msgGeo, this.gratitudeBannerMat);
    msgBack.position.z = -0.01;
    msgBack.rotation.y = Math.PI;
    this.gratitudeBannerMesh.add(msgBack);
    this.gratitudeBannerMesh.visible = false;

    this.dwExpandGroup.add(this.gratitudeBannerMesh);
  }

  private setGratitudeBannerBeat(beatIndex: number, opacity: number): void {
    if (beatIndex < 0 || beatIndex >= this.gratitudeBannerTextures.length || opacity <= 0.01) {
      this.gratitudeBannerMesh.visible = false;
      this.gratitudeBannerMat.opacity = 0.0;
      return;
    }
    if (this.currentBannerBeatIndex !== beatIndex) {
      this.currentBannerBeatIndex = beatIndex;
      this.gratitudeBannerMat.map = this.gratitudeBannerTextures[beatIndex];
      this.gratitudeBannerMat.needsUpdate = true;
    }
    this.gratitudeBannerMesh.visible = true;
    this.gratitudeBannerMat.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
  }

  private applyKingdomIlluminationState(
    awakeningU: number,
    quietDimFactor = 1.0,
    fullHeartKingdomGlow = 0.0,
  ): void {
    // 1. Sequential blooming of the 14 pathway flowers
    const totalFlowers = this.awakeningFlowers.length;
    this.awakeningFlowers.forEach((af, idx) => {
      const threshold = (idx / Math.max(1, totalFlowers - 1)) * 0.78;
      const localBloom = easeInOutCubic(
        THREE.MathUtils.clamp((awakeningU - threshold) / 0.22, 0, 1),
      );
      af.bloomRatio = Math.max(af.bloomRatio, localBloom, fullHeartKingdomGlow);
      af.group.scale.setScalar(THREE.MathUtils.lerp(0.18, 1.0, af.bloomRatio));
    });

    // 2. Sequential waking of pathway & heart-perimeter lanterns
    const totalLanterns = this.awakeningLanterns.length;
    this.awakeningLanterns.forEach((al, idx) => {
      const threshold = (idx / Math.max(1, totalLanterns - 1)) * 0.82;
      const localWake = easeInOutSine(THREE.MathUtils.clamp((awakeningU - threshold) / 0.2, 0, 1));
      al.wakeRatio = Math.max(al.wakeRatio, localWake, fullHeartKingdomGlow);
      al.orbMat.emissiveIntensity =
        THREE.MathUtils.lerp(0.08, 1.25, al.wakeRatio) * quietDimFactor +
        fullHeartKingdomGlow * 0.75;
    });

    // 3. Tower & Village Windows (warm gold on Yeshwanth's side, soft pink on Harsha's side)
    const winWake = easeInOutSine(THREE.MathUtils.clamp((awakeningU - 0.25) / 0.65, 0, 1));
    this.kingdomWindowMats.forEach((wm) => {
      wm.emissiveIntensity =
        THREE.MathUtils.lerp(0.12, 1.15, Math.max(winWake, fullHeartKingdomGlow)) *
          quietDimFactor +
        fullHeartKingdomGlow * 0.65;
    });

    // 4. Twin-Stream Heart Fountain flow & central crystal heart glow
    const fountWake = easeInOutSine(THREE.MathUtils.clamp((awakeningU - 0.15) / 0.55, 0, 1));
    const streamScale = THREE.MathUtils.lerp(0.25, 1.0, Math.max(fountWake, fullHeartKingdomGlow));
    this.fountainStreamLeftMesh.scale.set(1.0, streamScale * quietDimFactor, 1.0);
    this.fountainStreamRightMesh.scale.set(1.0, streamScale * quietDimFactor, 1.0);
    this.fountainWaterMat.emissiveIntensity =
      THREE.MathUtils.lerp(0.15, 0.68, fountWake) * quietDimFactor + fullHeartKingdomGlow * 0.45;
    this.fountainHeartMat.emissiveIntensity =
      THREE.MathUtils.lerp(0.22, 1.35, fountWake) * quietDimFactor + fullHeartKingdomGlow * 0.75;
  }

  public addCapturedPortraitToMemoryPath(tex: THREE.Texture): void {
    if (this.memoryFrameMaterials.length === 0) return;
    const mat = this.memoryFrameMaterials[0];
    mat.map = tex;
    mat.needsUpdate = true;
  }

  public isNearTabletopGate(lx: number, lz: number): boolean {
    if (this.isInsideLittleDreamWorld) return false;
    return (
      Math.hypot(lx - this.entranceSpec.position.x, lz - this.entranceSpec.position.z) <=
      this.entranceSpec.interactionRadius
    );
  }

  public isNearDreamWorldReturnGate(lx: number, lz: number): boolean {
    if (!this.isInsideLittleDreamWorld) return false;
    return Math.hypot(lx - 26.2, lz - 12.0) <= 2.45;
  }

  public isNearGoldenYeshwanth(lx: number, lz: number): boolean {
    if (!this.isInsideLittleDreamWorld) return false;
    // Near the Queen's Courtyard / Golden Yeshwanth (lx = 33.0 + 2.67 = 35.67, lz = 12.0)
    return Math.hypot(lx - 35.6, lz - 12.0) <= 3.4;
  }

  public triggerEnterLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'ENTERING_STORY';
    this.transitionElapsed = 0.0;

    // Reset kingdom to its sleeping pre-arrival state for the journey
    this.awakeningFlowers.forEach((af) => {
      af.bloomRatio = 0.0;
      af.group.scale.setScalar(0.18);
    });
    this.awakeningLanterns.forEach((al) => {
      al.wakeRatio = 0.0;
      al.orbMat.emissiveIntensity = 0.08;
    });
    this.queenCrownGroup.visible = false;
    this.queenCrownGroup.position.set(-0.68, 0.62, 0);
    this.queenCrownHaloMat.opacity = 0.0;
    this.queenArchFrameMat.emissiveIntensity = 0.25;
    this.dissolvingRosePetalsGroup.visible = false;
    this.gratitudeBannerMesh.visible = false;

    // Section 13: The rose from the previous entrance scene is still in Harsha's hand when she enters
    this.avatarBridge?.setRoseHeld?.(true);
    this.avatarBridge?.setRaisingHand?.(false);

    this.activeStoryCaption =
      'Our Little Kingdom ✧ Approaching the Ornate Golden Gate… ([E] Continue · [Space] Skip)';
    return true;
  }

  public triggerReplayGoldenYeshwanthStory(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'REPLAY_QUEEN';
    this.transitionElapsed = 0.0;
    this.queenCrownGroup.visible = false;
    this.queenCrownGroup.position.set(-0.68, 0.62, 0);
    this.queenCrownHaloMat.opacity = 0.0;
    this.gratitudeBannerMesh.visible = false;
    this.activeStoryCaption =
      'The Queen’s Courtyard ✧ A Quiet Moment Before the Throne… ([E] Continue · [Space] Skip)';
    return true;
  }

  public triggerExitLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'EXITING';
    this.transitionElapsed = 0.0;
    this.activeStoryCaption = 'Returning Gently Through the Golden Gate to the Doll Playroom…';
    return true;
  }

  public isTransitionActive(): boolean {
    return this.transitionState !== 'NONE';
  }

  public getStoryCaption(): string | null {
    return this.isTransitionActive() ? this.activeStoryCaption : null;
  }

  /**
   * Section 21: `[E] Continue` advances the active "Our Little Kingdom" cinematic to the next story beat.
   */
  public advanceOrContinueCinematic(): boolean {
    if (!this.isTransitionActive()) return false;
    if (this.transitionState === 'ENTERING_STORY') {
      const jumpPoints = [4.6, 14.0, 20.5, 25.0, 32.8, this.ENTER_STORY_DUR];
      const nextPt = jumpPoints.find((pt) => pt > this.transitionElapsed + 0.4);
      if (nextPt === undefined || nextPt >= this.ENTER_STORY_DUR) {
        return this.skipCinematic();
      }
      if (nextPt >= 4.6 && !this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      if (nextPt >= 14.0) {
        this.avatarBridge?.setRoseHeld?.(false);
        this.entranceRoseDissolved = true;
      }
      this.transitionElapsed = nextPt;
      return true;
    }
    if (this.transitionState === 'REPLAY_QUEEN') {
      const jumpPoints = [6.5, 11.0, 18.8, this.REPLAY_QUEEN_DUR];
      const nextPt = jumpPoints.find((pt) => pt > this.transitionElapsed + 0.4);
      if (nextPt === undefined || nextPt >= this.REPLAY_QUEEN_DUR) {
        return this.skipCinematic();
      }
      this.transitionElapsed = nextPt;
      return true;
    }
    return this.skipCinematic();
  }

  /**
   * Safe Skip / Completion (`[Space]` or `[Esc]` or end of sequence)
   */
  public skipCinematic(): boolean {
    if (!this.isTransitionActive()) return false;

    if (this.transitionState === 'ENTERING_STORY' || this.transitionState === 'REPLAY_QUEEN') {
      if (!this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      this.avatarBridge?.setRoseHeld?.(false);
      this.entranceRoseDissolved = true;
      this.crownRevealedInExplore = true;
      this.crownRevealProgress = 1.0;
    } else if (this.transitionState === 'EXITING') {
      if (this.isInsideLittleDreamWorld) {
        this.completeWorldExitTeleport();
      }
    }

    // Ensure full awakened kingdom state & revealed Queen's Crown
    this.dwExpandGroup.scale.setScalar(1.0);
    this.flowerGroups.forEach((fg) => fg.scale.setScalar(1.0));
    this.applyKingdomIlluminationState(1.0, 1.0, 1.0);

    this.queenCrownGroup.visible = true;
    this.queenCrownGroup.position.set(-0.68, 1.16, 0);
    this.queenCrownHaloMat.opacity = 0.36;
    this.queenArchFrameMat.emissiveIntensity = 1.15;

    this.goldenYeshwanthGroup.position.set(2.35, 0, -1.45);
    this.goldenYeshwanthGroup.rotation.y = -0.45;
    this.yeshLeftLeg.rotation.set(0, 0, 0);
    this.yeshRightLeg.rotation.set(0, 0, 0);
    // Yeshwanth's hand over his heart
    this.yeshRightArm.rotation.set(-0.68, 0, -0.52);
    this.yeshLeftArm.rotation.set(0, 0, 0);
    this.yeshHeadGroup.rotation.set(0, 0, 0);
    this.goldenArrivalGlow.scale.setScalar(0.85);
    this.dissolvingRosePetalsGroup.visible = false;

    // Keep final gratitude message ("I LOVE YOU, HARSHA ❤️") visible above the Queen's Courtyard
    this.setGratitudeBannerBeat(4, 0.94);
    this.gratitudeBannerMesh.position.set(2.45, 2.18, 0);
    this.avatarBridge?.setRaisingHand?.(false);

    this.transitionState = 'NONE';
    this.transitionElapsed = 0.0;
    this.transitionSeatYaw = undefined;
    this.activeStoryCaption =
      'Our Little Kingdom ✧ The Queen’s Crown & Heart-Shaped Kingdom Glow for Harsha ♡';
    return true;
  }

  private completeWorldEntryTeleport(): void {
    this.isInsideLittleDreamWorld = true;
    // Place Harsha at the Queen's Courtyard approach (lx = 33.0 + 1.35 = 34.35, lz = 12.0) facing East toward the Crown & Throne
    this.pendingPlayerWorldTeleport = new THREE.Vector3(
      this.originX + 34.35,
      this.baseY + this.y0,
      this.originZ + 12.0,
    );
    this.pendingPlayerYaw = Math.PI / 2;
  }

  private completeWorldExitTeleport(): void {
    this.isInsideLittleDreamWorld = false;
    this.pendingPlayerWorldTeleport = new THREE.Vector3(
      this.originX + this.entranceSpec.returnPoint.x,
      this.baseY + this.y0 + this.entranceSpec.returnPoint.y,
      this.originZ + this.entranceSpec.returnPoint.z,
    );
    this.pendingPlayerYaw = this.entranceSpec.returnYaw;
  }

  public getTransitionCameraState(): {
    active: boolean;
    camWorldPos: THREE.Vector3;
    lookWorldPos: THREE.Vector3;
    blendAlpha: number;
    fov: number;
    seatWorldPos?: THREE.Vector3;
    seatYaw?: number;
  } {
    if (this.transitionState === 'NONE') {
      return {
        active: false,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha: 0,
        fov: 55,
      };
    }

    if (this.transitionState === 'EXITING') {
      const u = THREE.MathUtils.clamp(this.transitionElapsed / this.EXIT_DUR, 0, 1);
      const smoothU = easeInOutSine(u);
      this.transitionCamPos.set(
        this.originX + THREE.MathUtils.lerp(28.5, 26.4, smoothU),
        this.baseY + this.y0 + 1.65,
        this.originZ + 12.0,
      );
      this.transitionLookPos.set(
        this.originX + 25.0,
        this.baseY + this.y0 + 1.65,
        this.originZ + 12.0,
      );
      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha: Math.sin(u * Math.PI),
        fov: 54,
      };
    }

    // Timeline offset: ENTERING_STORY (0..38.0s) vs REPLAY_QUEEN (maps to 14.0..38.0s)
    const totalDur =
      this.transitionState === 'ENTERING_STORY' ? this.ENTER_STORY_DUR : this.REPLAY_QUEEN_DUR;
    const rawT = this.transitionElapsed;
    const enterAlpha = easeInOutSine(THREE.MathUtils.clamp(rawT / 1.1, 0, 1));
    const exitAlpha = easeInOutSine(THREE.MathUtils.clamp((totalDur - rawT) / 1.2, 0, 1));
    const blendAlpha = Math.min(enterAlpha, exitAlpha);

    const storyT = this.transitionState === 'ENTERING_STORY' ? rawT : rawT + 14.0;

    const tableCenterX = this.originX + this.entranceSpec.tableCenterLocal.x;
    const tableCenterY = this.baseY + this.y0 + 0.55;
    const tableCenterZ = this.originZ + this.entranceSpec.tableCenterLocal.z;
    const gateWorldX = this.originX + this.entranceSpec.position.x;
    const gateWorldZ = this.originZ + this.entranceSpec.position.z;

    const dwCenterX = this.originX + 33.0;
    const dwCenterY = this.baseY + this.y0;
    const dwCenterZ = this.originZ + 12.0;

    // =========================================================================
    // STAGE 1: THE ENTRANCE — "OUR LITTLE KINGDOM" & THE TWO TINY TOWERS (0.0s -> 4.6s)
    // =========================================================================
    if (storyT < 4.6) {
      this.transitionSeatYaw = undefined;
      if (storyT < 2.8) {
        const u = easeInOutCubic(storyT / 2.8);
        const ang = -Math.PI * 0.5 + Math.sin(u * Math.PI * 2.0) * 0.36;
        const radius = THREE.MathUtils.lerp(1.58, 1.22, u);
        this.transitionCamPos.set(
          tableCenterX + Math.cos(ang) * radius,
          tableCenterY + THREE.MathUtils.lerp(0.58, 0.34, u),
          tableCenterZ + Math.sin(ang) * radius,
        );
        this.transitionLookPos.set(
          tableCenterX + Math.sin(u * Math.PI * 2.0) * 0.14,
          tableCenterY + THREE.MathUtils.lerp(0.38, 0.24, u),
          tableCenterZ + THREE.MathUtils.lerp(0.08, -0.42, u),
        );
        this.transitionFov = 45.0;
        this.activeStoryCaption =
          'OUR LITTLE KINGDOM ✧ Two Connected Towers & the Small Ornate Golden Gate';
      } else {
        // Focus on "OUR LITTLE KINGDOM" above the small ornate golden gate as the doors swing open
        const u = easeInOutCubic((storyT - 2.8) / 1.8);
        this.transitionCamPos.set(
          gateWorldX,
          tableCenterY + THREE.MathUtils.lerp(0.34, 0.16, u),
          THREE.MathUtils.lerp(gateWorldZ - 0.5, gateWorldZ + 0.12, u),
        );
        this.transitionLookPos.set(tableCenterX, tableCenterY + 0.18, tableCenterZ);
        this.transitionFov = THREE.MathUtils.lerp(45, 38, u);
        this.activeStoryCaption = 'OUR LITTLE KINGDOM ✧ Stepping Through the Golden Gate…';
      }

      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha,
        fov: this.transitionFov,
      };
    }

    // =========================================================================
    // STAGE 2: THE LITTLE KINGDOM WAKES UP BECAUSE SHE ARRIVED (4.6s -> 14.0s)
    // - Harsha walks along the curved path (-5.2 -> +1.35)
    // - Flowers bloom near her feet one by one
    // - Twin-stream heart fountain begins flowing & glowing
    // - Two towers (Yeshwanth's warm gold & Harsha's blush crystal) & bridge ("Y" & "H") illuminate
    // - Entrance rose in Harsha's hand gently dissolves into glowing petals (10.8s -> 13.8s)
    // =========================================================================
    if (storyT < 14.0) {
      const u = (storyT - 4.6) / 9.4;
      const smoothU = easeInOutSine(u);

      this.dwExpandGroup.scale.setScalar(1.0);
      this.flowerGroups.forEach((fg) => {
        fg.scale.setScalar(THREE.MathUtils.lerp(0.35, 1.0, easeInOutCubic(Math.min(1, u * 1.3))));
      });

      // Harsha walks along the curved garden path from (-5.2) past the Central Fountain (0.0) to the Queen's Courtyard (+1.35)
      const harshaLocalX = THREE.MathUtils.lerp(-5.2, 1.35, smoothU);
      const harshaLocalZ = Math.sin(u * Math.PI * 2.0) * 0.28 * (1.0 - u * 0.5);
      this.transitionSeatPos.set(dwCenterX + harshaLocalX, dwCenterY, dwCenterZ + harshaLocalZ);
      this.transitionSeatYaw = Math.PI / 2;

      // Kingdom awakens progressively as she steps forward
      this.applyKingdomIlluminationState(u, 1.0, 0.0);

      // Section 13: The rose from the entrance remains in her hand through the early part, then gently dissolves into glowing petals
      if (storyT < 11.2) {
        this.avatarBridge?.setRoseHeld?.(true);
        this.dissolvingRosePetalsGroup.visible = false;
      } else {
        this.avatarBridge?.setRoseHeld?.(false);
        this.entranceRoseDissolved = true;
        const pU = THREE.MathUtils.clamp((storyT - 11.2) / 2.6, 0, 1);
        this.dissolvingRosePetalsGroup.visible = true;
        this.dissolvingRosePetalsGroup.position.set(harshaLocalX + 0.35, 1.05, harshaLocalZ + 0.18);
        this.rosePetalMat.opacity = Math.sin(pU * Math.PI) * 0.92;
        this.rosePetalMeshes.forEach((pm, idx) => {
          const ang = idx * 1.15 + pU * 3.2;
          const r = 0.08 + pU * (0.45 + (idx % 4) * 0.12);
          pm.position.set(
            Math.cos(ang) * r,
            pU * (0.65 + (idx % 3) * 0.25),
            Math.sin(ang) * r,
          );
          pm.rotation.set(pU * 2.4, ang, pU * 1.8);
        });
      }

      // Camera glides alongside Harsha, showing the blooming flower path, the twin-stream heart fountain, and the Two Connected Towers
      this.transitionCamPos.set(
        dwCenterX + harshaLocalX - THREE.MathUtils.lerp(2.4, 2.8, smoothU),
        dwCenterY + THREE.MathUtils.lerp(1.45, 2.05, smoothU),
        dwCenterZ + THREE.MathUtils.lerp(1.35, 1.95, Math.sin(u * Math.PI)),
      );
      this.transitionLookPos.set(
        dwCenterX + THREE.MathUtils.lerp(harshaLocalX + 1.6, 3.8, smoothU),
        dwCenterY + THREE.MathUtils.lerp(0.95, 1.85, smoothU),
        dwCenterZ,
      );
      this.transitionFov = THREE.MathUtils.lerp(46, 50, smoothU);

      if (u < 0.32) {
        this.activeStoryCaption =
          'The Little Kingdom Awakens ✧ Flowers Bloom Near Harsha’s Feet Along the Path…';
      } else if (u < 0.68) {
        this.activeStoryCaption =
          'Central Courtyard ✧ Two Streams Meet in a Glowing Crystal Heart & the Two Towers Illuminate…';
      } else {
        this.activeStoryCaption =
          'The Entrance Rose Gently Dissolves into Glowing Petals as Harsha Reaches the Queen’s Courtyard…';
      }

      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha,
        fov: this.transitionFov,
        seatWorldPos: this.transitionSeatPos,
        seatYaw: this.transitionSeatYaw,
      };
    }

    // Harsha stands at the Queen's Courtyard approach (localX = 1.35, facing East toward the Crown Pedestal at 2.67 & Throne at 3.70)
    const harshaCourtX = dwCenterX + 1.35;
    const harshaCourtY = dwCenterY;
    const harshaCourtZ = dwCenterZ;
    this.transitionSeatPos.set(harshaCourtX, harshaCourtY, harshaCourtZ);
    this.transitionSeatYaw = Math.PI / 2;
    this.dissolvingRosePetalsGroup.visible = false;
    this.avatarBridge?.setRoseHeld?.(false);

    // =========================================================================
    // STAGE 3: THE QUEEN'S COURTYARD & THE RISING CROWN REVEAL (14.0s -> 20.5s)
    // - Environment becomes quiet; fountain slows; castle lights dim slightly (14.0s -> 16.0s)
    // - Circular architectural frame behind the throne begins glowing (15.5s -> 17.5s)
    // - Small royal crown appears and slowly rises from the crystal pedestal (16.2s -> 19.5s)
    // - Crown is illuminated; castle lights return warmly (19.0s -> 20.5s)
    // =========================================================================
    if (storyT < 20.5) {
      const qT = storyT - 14.0; // 0.0 -> 6.5s
      // Quiet dim curve: dims down to 0.45 at qT=1.6s, then returns to 1.0 as the crown illuminates
      const quietDim =
        qT < 2.2
          ? THREE.MathUtils.lerp(1.0, 0.45, easeInOutSine(qT / 2.2))
          : THREE.MathUtils.lerp(0.45, 1.05, easeInOutSine(THREE.MathUtils.clamp((qT - 2.2) / 3.5, 0, 1)));
      this.applyKingdomIlluminationState(1.0, quietDim, 0.0);

      // Circular frame behind the throne begins glowing
      const frameGlowU = easeInOutSine(THREE.MathUtils.clamp((qT - 1.2) / 2.4, 0, 1));
      this.queenArchFrameMat.emissiveIntensity = THREE.MathUtils.lerp(0.28, 1.45, frameGlowU);

      // Crown appears at qT = 2.0s and slowly rises from the crystal pedestal (y = 0.62 -> 1.16)
      if (qT < 2.0) {
        this.queenCrownGroup.visible = false;
        this.queenCrownHaloMat.opacity = 0.0;
      } else {
        const riseU = easeInOutCubic(THREE.MathUtils.clamp((qT - 2.0) / 3.4, 0, 1));
        this.queenCrownGroup.visible = true;
        this.queenCrownGroup.position.set(
          -0.68,
          THREE.MathUtils.lerp(0.62, 1.16, riseU),
          0,
        );
        this.queenCrownGroup.rotation.y = (qT - 2.0) * 0.55;
        this.queenCrownHaloMat.opacity = THREE.MathUtils.lerp(0.05, 0.42, riseU);
        this.crownRevealedInExplore = true;
        this.crownRevealProgress = riseU;
      }

      // Camera frames the elevated Queen's Courtyard, the intimate throne, the glowing circular heart frame, and the rising crown
      const camU = easeInOutCubic(qT / 6.5);
      this.transitionCamPos.set(
        dwCenterX + THREE.MathUtils.lerp(0.65, 1.45, camU),
        dwCenterY + THREE.MathUtils.lerp(1.62, 1.42, camU),
        dwCenterZ + THREE.MathUtils.lerp(1.85, 1.28, camU),
      );
      this.transitionLookPos.set(
        dwCenterX + THREE.MathUtils.lerp(3.15, 2.85, camU),
        dwCenterY + THREE.MathUtils.lerp(1.25, 1.32, camU),
        dwCenterZ,
      );
      this.transitionFov = THREE.MathUtils.lerp(46, 39, camU);

      if (qT < 2.0) {
        this.activeStoryCaption =
          'The Queen’s Courtyard ✧ The Fountain Slows & the Kingdom Grows Quiet…';
      } else if (qT < 4.8) {
        this.activeStoryCaption =
          'The Queen Reveal ✧ The Circular Heart Frame Glows & a Royal Crown Rises from the Crystal Pedestal…';
      } else {
        this.activeStoryCaption =
          'The Crown is Illuminated ✧ Warm Light Returns Across the Courtyard…';
      }

      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha,
        fov: this.transitionFov,
        seatWorldPos: this.transitionSeatPos,
        seatYaw: this.transitionSeatYaw,
      };
    }

    // Ensure Crown is fully risen and illuminated for Stages 4–6
    this.queenCrownGroup.visible = true;
    this.queenCrownGroup.position.set(-0.68, 1.16, 0);
    this.queenCrownGroup.rotation.y = (storyT - 16.0) * 0.45;
    this.queenCrownHaloMat.opacity = 0.38;
    this.queenArchFrameMat.emissiveIntensity = 1.35;

    // =========================================================================
    // STAGE 4: YESHWANTH'S PRESENCE — HAND OVER HEART ("This is your kingdom.") (20.5s -> 25.0s)
    // - Yeshwanth turns toward Harsha
    // - Places his right hand over his heart
    // - Looks toward the crown, then back toward Harsha (no kneeling, no proposal, no rose)
    // =========================================================================
    if (storyT < 25.0) {
      const yT = storyT - 20.5; // 0.0 -> 4.5s
      this.applyKingdomIlluminationState(1.0, 1.0, 0.25);

      // Yeshwanth stands at (2.35, 0, -1.45) and turns smoothly toward Harsha (at 1.35, 0, 0)
      const turnU = easeInOutSine(THREE.MathUtils.clamp(yT / 1.2, 0, 1));
      this.goldenYeshwanthGroup.position.set(2.35, 0, -1.45);
      this.goldenYeshwanthGroup.rotation.y = THREE.MathUtils.lerp(-0.15, -0.58, turnU);

      // Places his right hand over his heart
      const heartHandU = easeInOutCubic(THREE.MathUtils.clamp((yT - 0.5) / 1.3, 0, 1));
      this.yeshRightArm.rotation.set(
        THREE.MathUtils.lerp(0, -0.68, heartHandU),
        0,
        THREE.MathUtils.lerp(0, -0.52, heartHandU),
      );

      // Head gaze: looks toward Harsha -> looks toward the Crown (yT 1.8..3.1) -> looks back toward Harsha (yT 3.1..4.5)
      let headYaw = 0.0;
      if (yT >= 1.6 && yT < 3.1) {
        headYaw = Math.sin(((yT - 1.6) / 1.5) * Math.PI) * -0.42;
      }
      this.yeshHeadGroup.rotation.set(0.06, headYaw, 0);

      // Camera frames warm three-way composition: Harsha, the Illuminated Crown, and Golden Yeshwanth with his hand over his heart
      const panU = easeInOutSine(yT / 4.5);
      this.transitionCamPos.set(
        dwCenterX + THREE.MathUtils.lerp(0.85, 0.55, panU),
        dwCenterY + 1.48,
        dwCenterZ + THREE.MathUtils.lerp(1.45, 1.75, panU),
      );
      this.transitionLookPos.set(
        dwCenterX + 2.25,
        dwCenterY + 1.32,
        dwCenterZ - 0.35,
      );
      this.transitionFov = 42.0;
      this.activeStoryCaption =
        yT < 2.0
          ? 'Yeshwanth Turns Toward Harsha & Places His Hand Over His Heart…'
          : 'He Looks Toward the Crown, Then Back to Harsha — "This is your kingdom."';

      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha,
        fov: this.transitionFov,
        seatWorldPos: this.transitionSeatPos,
        seatYaw: this.transitionSeatYaw,
      };
    }

    // Keep Yeshwanth's hand over his heart for Stages 5 & 6
    this.goldenYeshwanthGroup.position.set(2.35, 0, -1.45);
    this.goldenYeshwanthGroup.rotation.y = -0.58;
    this.yeshRightArm.rotation.set(-0.68, 0, -0.52);
    this.yeshHeadGroup.rotation.set(0.05, 0, 0);

    // =========================================================================
    // STAGE 5: THE GRATITUDE MOMENT — WORLD-SPACE CINEMATIC TEXT (25.0s -> 32.8s)
    // 1. "MY QUEEN"
    // 2. "You are the queen of my life."
    // 3. "And I am so grateful that I get to have you in mine."
    // 4. "Thank you for making my world more beautiful."
    // 5. "I LOVE YOU, HARSHA ❤️"
    // =========================================================================
    if (storyT < 32.8) {
      const gT = storyT - 25.0; // 0.0 -> 7.8s
      this.applyKingdomIlluminationState(1.0, 1.0, 0.45);

      // 5 sequential beats with gentle fade-in / pause / fade-out
      let beatIdx = 0;
      let localBeatT = 0;
      let beatDur = 1.45;
      if (gT < 1.45) {
        beatIdx = 0;
        localBeatT = gT;
        beatDur = 1.45;
        this.activeStoryCaption = 'MY QUEEN';
      } else if (gT < 2.95) {
        beatIdx = 1;
        localBeatT = gT - 1.45;
        beatDur = 1.5;
        this.activeStoryCaption = 'You are the queen of my life.';
      } else if (gT < 4.55) {
        beatIdx = 2;
        localBeatT = gT - 2.95;
        beatDur = 1.6;
        this.activeStoryCaption = 'And I am so grateful that I get to have you in mine.';
      } else if (gT < 6.15) {
        beatIdx = 3;
        localBeatT = gT - 4.55;
        beatDur = 1.6;
        this.activeStoryCaption = 'Thank you for making my world more beautiful.';
      } else {
        beatIdx = 4;
        localBeatT = gT - 6.15;
        beatDur = 1.65;
        this.activeStoryCaption = 'I LOVE YOU, HARSHA ❤️';
      }

      const fadeIn = easeInOutSine(THREE.MathUtils.clamp(localBeatT / 0.32, 0, 1));
      const fadeOut =
        beatIdx === 4
          ? 1.0
          : easeInOutSine(THREE.MathUtils.clamp((beatDur - localBeatT) / 0.28, 0, 1));
      this.setGratitudeBannerBeat(beatIdx, Math.min(fadeIn, fadeOut));
      this.gratitudeBannerMesh.position.set(2.45, 1.92, 0);

      const slowDrift = Math.sin(gT * 0.65) * 0.1;
      this.transitionCamPos.set(
        dwCenterX + 0.45 + slowDrift,
        dwCenterY + 1.54,
        dwCenterZ + 2.15,
      );
      this.transitionLookPos.set(dwCenterX + 2.45, dwCenterY + 1.58, dwCenterZ);
      this.transitionFov = 44.0;

      const bannerYaw = Math.atan2(
        this.transitionCamPos.x - (dwCenterX + 2.45),
        this.transitionCamPos.z - dwCenterZ,
      );
      this.gratitudeBannerMesh.rotation.set(0, bannerYaw, 0);

      return {
        active: true,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha,
        fov: this.transitionFov,
        seatWorldPos: this.transitionSeatPos,
        seatYaw: this.transitionSeatYaw,
      };
    }

    // =========================================================================
    // STAGE 6: THE IMPORTANT TWIST — FULL KINGDOM ILLUMINATION & HEART-SHAPED CASTLE REVEAL (32.8s -> 38.0s)
    // - Camera slowly pulls backward and rises upward
    // - Every light in the castle turns on (two towers, bridge, garden, fountain, windows, tiny houses, lanterns)
    // - Reveals that the entire kingdom forms a subtle heart-shaped composition from above
    // =========================================================================
    const rT = storyT - 32.8; // 0.0 -> 5.2s
    const pullU = easeInOutCubic(THREE.MathUtils.clamp(rT / 3.8, 0, 1));

    // Every light in the kingdom turns on!
    this.applyKingdomIlluminationState(1.0, 1.0, pullU);

    this.setGratitudeBannerBeat(4, THREE.MathUtils.lerp(1.0, 0.92, pullU));
    const bannerY = THREE.MathUtils.lerp(1.92, 2.25, pullU);
    this.gratitudeBannerMesh.position.set(2.45, bannerY, 0);

    this.transitionCamPos.set(
      THREE.MathUtils.lerp(dwCenterX + 0.45, dwCenterX - 6.8, pullU),
      dwCenterY + THREE.MathUtils.lerp(1.54, 7.2, pullU),
      dwCenterZ + THREE.MathUtils.lerp(2.15, 4.8, pullU),
    );
    this.transitionLookPos.set(
      THREE.MathUtils.lerp(dwCenterX + 2.45, dwCenterX + 0.8, pullU),
      dwCenterY + THREE.MathUtils.lerp(1.58, 1.4, pullU),
      dwCenterZ,
    );
    this.transitionFov = THREE.MathUtils.lerp(44, 56, pullU);

    const bannerYaw2 = Math.atan2(
      this.transitionCamPos.x - (dwCenterX + 2.45),
      this.transitionCamPos.z - dwCenterZ,
    );
    this.gratitudeBannerMesh.rotation.set(0, bannerYaw2, 0);
    this.activeStoryCaption =
      'Our Little Kingdom Illuminates ✧ Every Tower, Bridge, Fountain & Lantern Glows in a Heart-Shaped Kingdom ❤️';

    return {
      active: true,
      camWorldPos: this.transitionCamPos,
      lookWorldPos: this.transitionLookPos,
      blendAlpha,
      fov: this.transitionFov,
      seatWorldPos: this.transitionSeatPos,
      seatYaw: this.transitionSeatYaw,
    };
  }

  public consumePendingTeleport(): { pos: THREE.Vector3; yaw: number } | null {
    if (!this.pendingPlayerWorldTeleport || this.pendingPlayerYaw === null) {
      return null;
    }
    const out = {
      pos: this.pendingPlayerWorldTeleport.clone(),
      yaw: this.pendingPlayerYaw,
    };
    this.pendingPlayerWorldTeleport = null;
    this.pendingPlayerYaw = null;
    return out;
  }

  public update(delta: number, clockTime: number, playerPos: THREE.Vector3): void {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;

    // Animate miniature ornate golden gate doors when near or transitioning
    const shouldOpenGate =
      (this.transitionState === 'ENTERING_STORY' && this.transitionElapsed >= 2.8) ||
      this.isInsideLittleDreamWorld ||
      this.isNearTabletopGate(lx, lz);
    this.gateOpenRatio = THREE.MathUtils.lerp(
      this.gateOpenRatio,
      shouldOpenGate ? 1.0 : 0.0,
      1 - Math.exp(-5.0 * delta),
    );
    if (this.leftGatePivot && this.rightGatePivot) {
      this.leftGatePivot.rotation.y = -this.gateOpenRatio * 1.35;
      this.rightGatePivot.rotation.y = this.gateOpenRatio * 1.35;
    }

    if (this.dreamWorldPortalRing) {
      this.dreamWorldPortalRing.rotation.z = clockTime * 0.85;
    }

    // Gentle pulse on the central fountain heart & Queen's circular frame heart
    if (this.fountainCenterHeartGroup) {
      const pulse = 1.0 + Math.sin(clockTime * 3.2) * 0.06;
      this.fountainCenterHeartGroup.scale.setScalar(pulse);
    }
    if (this.queenFrameHeartGroup) {
      const pulse = 1.0 + Math.sin(clockTime * 2.6 + 1.0) * 0.05;
      this.queenFrameHeartGroup.scale.setScalar(pulse);
    }

    // Physical proximity-driven awakening & Queen's Crown reveal during free exploration inside Our Little Kingdom
    if (this.isInsideLittleDreamWorld && this.transitionState === 'NONE') {
      const relKingdomX = lx - 33.0;
      const relKingdomZ = lz - 12.0;

      // Any flower or lantern near Harsha's feet blooms/wakes up naturally as she walks!
      this.awakeningFlowers.forEach((af) => {
        const dist = Math.hypot(relKingdomX - af.localX, relKingdomZ - af.localZ);
        if (dist < 2.6) {
          af.bloomRatio = Math.min(1.0, af.bloomRatio + delta * 1.8);
          af.group.scale.setScalar(THREE.MathUtils.lerp(0.18, 1.0, af.bloomRatio));
        }
      });
      this.awakeningLanterns.forEach((al) => {
        const dist = Math.hypot(relKingdomX - al.localX, relKingdomZ - al.localZ);
        if (dist < 3.2) {
          al.wakeRatio = Math.min(1.0, al.wakeRatio + delta * 1.6);
          al.orbMat.emissiveIntensity = THREE.MathUtils.lerp(0.08, 1.45, al.wakeRatio);
        }
      });

      // When Harsha walks into the Queen's Courtyard (relKingdomX >= 1.2), smoothly rise & illuminate the Crown if not yet revealed
      if (relKingdomX >= 1.2 || this.crownRevealedInExplore) {
        this.crownRevealedInExplore = true;
        this.crownRevealProgress = Math.min(1.0, this.crownRevealProgress + delta * 0.65);
        const riseU = easeInOutCubic(this.crownRevealProgress);
        this.queenCrownGroup.visible = true;
        this.queenCrownGroup.position.set(
          -0.68,
          THREE.MathUtils.lerp(0.62, 1.16, riseU),
          0,
        );
        this.queenCrownGroup.rotation.y = clockTime * 0.55;
        this.queenCrownHaloMat.opacity = THREE.MathUtils.lerp(0.0, 0.38, riseU);
      }

      // Keep "I LOVE YOU, HARSHA ❤️" banner floating gently above the Queen's Courtyard and facing Harsha
      this.setGratitudeBannerBeat(4, 0.92);
      this.gratitudeBannerMesh.position.set(
        2.45,
        2.18 + Math.sin(clockTime * 1.6) * 0.04,
        0,
      );
      const exploreYaw = Math.atan2(
        lx - (33.0 + this.gratitudeBannerMesh.position.x),
        lz - 12.0,
      );
      this.gratitudeBannerMesh.rotation.set(0, exploreYaw, 0);
    }

    // Physical walk-through return gate check inside Our Little Kingdom
    if (
      this.isInsideLittleDreamWorld &&
      this.transitionState === 'NONE' &&
      lx <= 26.65 &&
      lx >= 25.0 &&
      Math.abs(lz - 12.0) <= 1.35
    ) {
      this.triggerExitLittleDreamWorld();
    }

    // Advance active story/transition state machine
    if (this.transitionState === 'ENTERING_STORY') {
      this.transitionElapsed += delta;
      if (this.transitionElapsed >= 4.6 && !this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      if (this.transitionElapsed >= this.ENTER_STORY_DUR) {
        this.skipCinematic();
      }
    } else if (this.transitionState === 'REPLAY_QUEEN') {
      this.transitionElapsed += delta;
      if (this.transitionElapsed >= this.REPLAY_QUEEN_DUR) {
        this.skipCinematic();
      }
    } else if (this.transitionState === 'EXITING') {
      this.transitionElapsed += delta;
      if (this.transitionElapsed >= this.EXIT_DUR * 0.55 && this.isInsideLittleDreamWorld) {
        this.completeWorldExitTeleport();
      }
      if (this.transitionElapsed >= this.EXIT_DUR) {
        this.transitionState = 'NONE';
        this.transitionElapsed = 0.0;
        this.activeStoryCaption = null;
      }
    }
  }
}
