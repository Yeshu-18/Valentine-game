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
  subtitle: string,
  bg = '#4a1026',
  fg = '#fde047',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 88);
    ctx.fillStyle = fg;
    ctx.font = 'bold 19px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 36);
    ctx.fillStyle = '#ffe4e6';
    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillText(subtitle, 128, 66);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createFloatingMessageTex(
  tracker: ResourceTracker,
  line1: string,
  line2?: string,
  isHeroLove = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 160);
    const grad = ctx.createRadialGradient(256, 80, 10, 256, 80, 240);
    grad.addColorStop(0, 'rgba(74, 16, 38, 0.86)');
    grad.addColorStop(0.75, 'rgba(74, 16, 38, 0.55)');
    grad.addColorStop(1, 'rgba(74, 16, 38, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 20, 464, 120);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isHeroLove) {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 42px Georgia, serif';
      ctx.fillText(line1, 256, 72);
      if (line2) {
        ctx.fillStyle = '#fbcfe8';
        ctx.font = 'italic 20px Georgia, serif';
        ctx.fillText(line2, 256, 114);
      }
    } else {
      ctx.fillStyle = '#fff1f2';
      ctx.font = 'italic 23px Georgia, serif';
      ctx.fillText(line1, 256, 68);
      if (line2) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 17px Georgia, serif';
        ctx.fillText(line2, 256, 108);
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
      'Two Towers, One Bridge',
      'Yeshwanth & Harsha',
      'Every Laugh Together',
      'Our Little Dream World',
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

  // Little Dream World transformation & Golden Yeshwanth elements (Sections 13–18)
  private dwExpandGroup!: THREE.Group;
  private readonly flowerGroups: THREE.Group[] = [];
  private dwFullCastleBackdrop!: THREE.Group;
  private goldenYeshwanthGroup!: THREE.Group;
  private yeshLeftLeg!: THREE.Group;
  private yeshRightLeg!: THREE.Group;
  private yeshLeftArm!: THREE.Group;
  private yeshRightArm!: THREE.Group;
  private yeshRoseGroup!: THREE.Group;
  private goldenArrivalGlow!: THREE.Mesh;
  private messageBanner1!: THREE.Mesh;
  private messageBanner1Mat!: THREE.MeshBasicMaterial;
  private messageBanner2!: THREE.Mesh;
  private messageBanner2Mat!: THREE.MeshBasicMaterial;

  // Scale-Transition & Story Cinematic State Machine
  public isInsideLittleDreamWorld = false;
  private transitionState: 'NONE' | 'ENTERING_STORY' | 'REPLAY_ROSE' | 'EXITING' = 'NONE';
  private transitionElapsed = 0.0;
  private readonly ENTER_STORY_DUR = 36.8; // Sections 13-18 complete romantic sequence
  private readonly REPLAY_ROSE_DUR = 22.8; // Sections 15-18 when triggered inside Little Dream World
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
  private dreamWorldFountainStream!: THREE.Mesh;

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

    // Single Source of Truth for Tabletop Castle & Accessible Front (South) Miniature Gate (Section 20)
    // Positioned at (12.85, y0, 11.85) with 1.18m radius so all 4 sides have >1.2m clear player circulation:
    // Front/South: 4.29m open approach | Left/West: 1.83m | Right/East: 1.32m | Rear/North: 1.85m
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
      returnYaw: 0, // Faces North (+Z) directly toward the Miniature Castle Gate
    };

    this.buildLuxuryTabletopAndMiniatureCastle();
    this.buildConnectedLittleDreamWorld(colliders);
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
  }

  /**
   * Sections 29–34 & Section 13:
   * - Luxury circular table + Miniature Twin-Tower Castle + Miniature "I LOVE YOU" garden detail
   * - Interactive Castle Gate (`[E] EXPLORE LITTLE CASTLE`)
   */
  private buildLuxuryTabletopAndMiniatureCastle(): void {
    const { tracker, mats, y0, entranceSpec } = this;
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
      '✦ THE TABLETOP DREAM CASTLE ✦',
      'Tower of Yeshwanth & Tower of Harsha · Connected by One Bridge',
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
    const towerCylGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.13, 0.15, 1.02, 14));
    towerCylGeo.translate(0, 0.51, 0);
    const towerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.18, 0.5, 14));
    towerSpireGeo.translate(0, 1.27, 0);
    const balconyRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.15, 0.014, 8, 16));
    balconyRingGeo.rotateX(Math.PI / 2);
    balconyRingGeo.translate(0, 0.76, 0);

    // Left (West) = Yeshwanth's Tower, Right (East) = Harsha's Tower (Section 33)
    const towerAGroup = new THREE.Group();
    towerAGroup.position.set(-0.24, mcY, -0.04);
    const warmChampagneMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.25,
        roughness: 0.25,
        metalness: 0.45,
      }),
    );
    towerAGroup.add(
      new THREE.Mesh(towerCylGeo, warmChampagneMat),
      new THREE.Mesh(towerSpireGeo, mats.champagneGold),
      new THREE.Mesh(balconyRingGeo, mats.champagneGold),
    );

    const towerBGroup = new THREE.Group();
    towerBGroup.position.set(0.24, mcY, -0.04);
    const softBlushCrystalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fce7f3',
        emissive: '#f472b6',
        emissiveIntensity: 0.32,
        roughness: 0.18,
        metalness: 0.25,
      }),
    );
    towerBGroup.add(
      new THREE.Mesh(towerCylGeo, softBlushCrystalMat),
      new THREE.Mesh(towerSpireGeo, mats.blushRoseMarble),
      new THREE.Mesh(balconyRingGeo, mats.crystalGlass),
    );

    const skyBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.08, 0.14));
    skyBridgeGeo.translate(0, mcY + 0.74, -0.04);
    const skyBridgeArchGeo = tracker.trackGeo(new THREE.TorusGeometry(0.22, 0.014, 8, 16, Math.PI));
    skyBridgeArchGeo.translate(0, mcY + 0.78, -0.04);

    // Section 13 & 16–21: Miniature "♥ I LOVE YOU ♥" garden signs with FrontSide (never mirrored!)
    const miniLoveSignTex = createPlaqueCanvasTex(
      tracker,
      '♥ I LOVE YOU ♥',
      'Yeshwanth & Harsha',
      '#831843',
      '#fde047',
    );
    const miniLoveSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.32, 0.11));
    const miniLoveBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.34, 0.125, 0.014));
    const miniLoveSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: miniLoveSignTex, side: THREE.FrontSide }),
    );
    // Front sign on South (-Z) side facing approaching player & entry camera (rotation.y = Math.PI)
    const miniLoveBoardFront = new THREE.Mesh(miniLoveBoardGeo, mats.champagneGold);
    miniLoveBoardFront.position.set(0, mcY + 0.148, -0.572);
    miniLoveBoardFront.rotation.order = 'YXZ';
    miniLoveBoardFront.rotation.y = Math.PI;
    miniLoveBoardFront.rotation.x = -0.22;

    const miniLoveSignFront = new THREE.Mesh(miniLoveSignGeo, miniLoveSignMat);
    miniLoveSignFront.position.set(0, mcY + 0.15, -0.58);
    miniLoveSignFront.rotation.order = 'YXZ';
    miniLoveSignFront.rotation.y = Math.PI;
    miniLoveSignFront.rotation.x = -0.22;

    // Back sign on North (+Z) side facing +Z viewer (rotation.y = 0)
    const miniLoveBoardBack = new THREE.Mesh(miniLoveBoardGeo, mats.champagneGold);
    miniLoveBoardBack.position.set(0, mcY + 0.148, 0.572);
    miniLoveBoardBack.rotation.order = 'YXZ';
    miniLoveBoardBack.rotation.y = 0;
    miniLoveBoardBack.rotation.x = -0.22;

    const miniLoveSignBack = new THREE.Mesh(miniLoveSignGeo, miniLoveSignMat);
    miniLoveSignBack.position.set(0, mcY + 0.15, 0.58);
    miniLoveSignBack.rotation.order = 'YXZ';
    miniLoveSignBack.rotation.y = 0;
    miniLoveSignBack.rotation.x = -0.22;

    tableGroup.add(
      towerAGroup,
      towerBGroup,
      new THREE.Mesh(skyBridgeGeo, mats.champagneGold),
      new THREE.Mesh(skyBridgeArchGeo, mats.crystalGlass),
      miniLoveBoardFront,
      miniLoveSignFront,
      miniLoveBoardBack,
      miniLoveSignBack,
    );

    // Miniature 3D Heart Trees flanking the Tabletop Castle gate & courtyard (Section 6)
    const trunkGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.015, 0.022, 0.22, 8));
    trunkGeo.translate(0, 0.11, 0);
    const canopyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.078, 10, 10));
    const buildMiniHeartTree = (tx: number, tz: number, matA: THREE.Material, matB: THREE.Material) => {
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
      buildMiniHeartTree(-0.46, -0.44, softBlushCrystalMat, warmChampagneMat),
      buildMiniHeartTree(0.46, -0.44, warmChampagneMat, softBlushCrystalMat),
      buildMiniHeartTree(-0.56, 0.15, softBlushCrystalMat, warmChampagneMat),
      buildMiniHeartTree(0.56, 0.15, warmChampagneMat, softBlushCrystalMat),
    );

    const streamGeo = tracker.trackGeo(new THREE.BoxGeometry(0.042, 0.012, 0.32));
    const streamMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.65,
        roughness: 0.1,
      }),
    );
    const streamL = new THREE.Mesh(streamGeo, streamMat);
    streamL.position.set(-0.12, mcY + 0.01, 0.56);
    streamL.rotation.y = 0.42;
    const streamR = new THREE.Mesh(streamGeo, streamMat);
    streamR.position.set(0.12, mcY + 0.01, 0.56);
    streamR.rotation.y = -0.42;
    tableGroup.add(streamL, streamR);

    const windingPathGeo = tracker.trackGeo(new THREE.RingGeometry(0.82, 0.94, 36));
    windingPathGeo.rotateX(-Math.PI / 2);
    windingPathGeo.translate(0, mcY + 0.006, 0);
    tableGroup.add(new THREE.Mesh(windingPathGeo, mats.champagneGold));

    const miniLanternPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 6));
    miniLanternPostGeo.translate(0, 0.07, 0);
    const miniLanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
    miniLanternOrbGeo.translate(0, 0.15, 0);
    for (let l = 0; l < 6; l++) {
      const ang = (l * Math.PI * 2) / 6 + 0.25;
      const lg = new THREE.Group();
      lg.position.set(Math.cos(ang) * 0.96, mcY, Math.sin(ang) * 0.96);
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

    // Interactive Castle Gate on the Accessible Front (South, -Z) side of the Miniature Castle (Sections 19–21)
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

    const doorLeafGeo = tracker.trackGeo(new THREE.BoxGeometry(0.17, 0.24, 0.016));
    doorLeafGeo.translate(0.085, 0.12, 0);
    this.leftGatePivot = new THREE.Group();
    this.leftGatePivot.position.copy(entranceSpec.doorPivotLeft);
    this.leftGatePivot.add(new THREE.Mesh(doorLeafGeo, softBlushCrystalMat));

    const doorLeafRightGeo = tracker.trackGeo(new THREE.BoxGeometry(0.17, 0.24, 0.016));
    doorLeafRightGeo.translate(-0.085, 0.12, 0);
    this.rightGatePivot = new THREE.Group();
    this.rightGatePivot.position.copy(entranceSpec.doorPivotRight);
    this.rightGatePivot.add(new THREE.Mesh(doorLeafRightGeo, warmChampagneMat));

    this.dynamicObjects.add(this.leftGatePivot);
    this.dynamicObjects.add(this.rightGatePivot);

    gateGroup.add(
      new THREE.Mesh(gateArchGeo, mats.champagneGold),
      gpL,
      gpR,
      this.leftGatePivot,
      this.rightGatePivot,
    );
    tableGroup.add(gateGroup);
  }

  /**
   * Sections 14–18 & 35–36: Connected Full-Scale `LITTLE DREAM WORLD` Fantasy Enclave
   * Includes:
   * - Expandable world architecture for Stage 1–8 Transformation
   * - Full-scale Twin-Tower Dream Castle backdrop on the East edge
   * - Golden Yeshwanth figure with articulated limbs & detailed 3D Golden-Rimmed Rose
   * - Floating world-integrated personal message banners ("Harsha, this little world was made for you." & "I LOVE YOU.")
   */
  private buildConnectedLittleDreamWorld(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const dwRoot = new THREE.Group();
    dwRoot.name = 'LittleDreamWorldEnclave';
    dwRoot.position.set(33.0, y0, 12.0);
    this.group.add(dwRoot);

    this.dwExpandGroup = new THREE.Group();
    dwRoot.add(this.dwExpandGroup);

    const plateauGeo = tracker.trackGeo(new THREE.CylinderGeometry(8.2, 7.6, 0.45, 36));
    plateauGeo.translate(0, -0.225, 0);
    const plateauMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        roughness: 0.75,
        metalness: 0.05,
      }),
    );
    const plateauMesh = new THREE.Mesh(plateauGeo, plateauMat);
    plateauMesh.receiveShadow = true;

    const rimGoldGeo = tracker.trackGeo(new THREE.TorusGeometry(8.15, 0.12, 10, 48));
    rimGoldGeo.rotateX(Math.PI / 2);
    rimGoldGeo.translate(0, 0.02, 0);

    const pathGeo = tracker.trackGeo(new THREE.BoxGeometry(12.6, 0.025, 2.1));
    pathGeo.translate(-0.8, 0.012, 0);

    this.dwExpandGroup.add(
      plateauMesh,
      new THREE.Mesh(rimGoldGeo, mats.champagneGold),
      new THREE.Mesh(pathGeo, mats.blushRoseMarble),
    );

    // Physical Return Castle Gate on West Edge (-6.8, 0, 0) -> castle local (26.2, y0, 12.0)
    const returnGateGroup = new THREE.Group();
    returnGateGroup.position.set(-6.8, 0, 0);
    returnGateGroup.rotation.y = Math.PI / 2;

    const rgPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 3.2, 12));
    rgPillarGeo.translate(0, 1.6, 0);
    const rgPillarL = new THREE.Mesh(rgPillarGeo, mats.pearlWhite);
    rgPillarL.position.x = -1.35;
    const rgPillarR = new THREE.Mesh(rgPillarGeo, mats.pearlWhite);
    rgPillarR.position.x = 1.35;

    const rgArchGeo = tracker.trackGeo(new THREE.TorusGeometry(1.35, 0.14, 10, 24, Math.PI));
    rgArchGeo.translate(0, 3.2, 0);

    const portalRingGeo = tracker.trackGeo(new THREE.RingGeometry(0.85, 1.25, 28));
    portalRingGeo.translate(0, 1.75, 0);
    const portalGlowMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#f472b6',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
      }),
    );
    this.dreamWorldPortalRing = new THREE.Mesh(portalRingGeo, portalGlowMat);
    this.dynamicObjects.add(this.dreamWorldPortalRing);

    const returnSignTex = createPlaqueCanvasTex(
      tracker,
      '← RETURN TO OUR LITTLE CASTLE',
      'Walk Through Gate to Return to Tabletop Castle',
    );
    const returnSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.2, 0.56));
    const returnSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: returnSignTex, side: THREE.FrontSide }),
    );
    const returnSignMeshFront = new THREE.Mesh(returnSignGeo, returnSignMat);
    returnSignMeshFront.position.set(0, 3.65, 0.16);
    const returnSignMeshBack = new THREE.Mesh(returnSignGeo, returnSignMat);
    returnSignMeshBack.position.set(0, 3.65, -0.16);
    returnSignMeshBack.rotation.y = Math.PI;

    returnGateGroup.add(
      rgPillarL,
      rgPillarR,
      new THREE.Mesh(rgArchGeo, mats.champagneGold),
      this.dreamWorldPortalRing,
      returnSignMeshFront,
      returnSignMeshBack,
    );
    this.dwExpandGroup.add(returnGateGroup);

    // Central Twin-Stream Heart Fountain at (0, 0, 0)
    const fountainBasinGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.65, 1.85, 0.42, 24));
    fountainBasinGeo.translate(0, 0.21, 0);
    const waterDiscGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.52, 1.52, 0.36, 24));
    waterDiscGeo.translate(0, 0.22, 0);
    const waterMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#7dd3fc',
        emissive: '#0284c7',
        emissiveIntensity: 0.45,
        roughness: 0.12,
      }),
    );
    const centerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 1.55, 12));
    centerSpireGeo.translate(0, 0.95, 0);
    this.dreamWorldFountainStream = new THREE.Mesh(centerSpireGeo, waterMat);
    this.dynamicObjects.add(this.dreamWorldFountainStream);

    this.dwExpandGroup.add(
      new THREE.Mesh(fountainBasinGeo, mats.pearlWhite),
      new THREE.Mesh(waterDiscGeo, waterMat),
      this.dreamWorldFountainStream,
    );
    colliders.push({
      x: this.originX + 33.0,
      z: this.originZ + 12.0,
      radius: 1.75,
      y: this.baseY + y0,
      height: 3.5,
    });

    // Oversized Fantasy Flowers (Stage 3 of Little Dream World Transformation)
    const stemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.12, 2.8, 10));
    stemGeo.translate(0, 1.4, 0);
    const blossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.68, 12, 10));
    blossomGeo.scale(1.2, 0.55, 1.2);
    blossomGeo.translate(0, 2.85, 0);
    const stemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.5 }),
    );
    const flowerPinkMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f472b6',
        emissive: '#db2777',
        emissiveIntensity: 0.35,
        roughness: 0.3,
      }),
    );

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
        new THREE.Mesh(stemGeo, stemMat),
        new THREE.Mesh(blossomGeo, idx % 2 === 0 ? flowerPinkMat : mats.softLavender),
      );
      this.dwExpandGroup.add(fg);
      this.flowerGroups.push(fg);
    });

    // Glowing Fairy Mushrooms & Toy-Style Village Houses
    const mushStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.16, 0.55, 10));
    mushStemGeo.translate(0, 0.275, 0);
    const mushCapGeo = tracker.trackGeo(new THREE.ConeGeometry(0.42, 0.36, 12));
    mushCapGeo.translate(0, 0.68, 0);
    const mushGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.95,
        roughness: 0.2,
      }),
    );

    [
      [-4.8, -1.8],
      [-4.8, 1.8],
      [2.8, -2.5],
      [2.8, 2.5],
      [5.4, 0.0],
    ].forEach(([mx, mz]) => {
      const mg = new THREE.Group();
      mg.position.set(mx, 0, mz);
      mg.add(
        new THREE.Mesh(mushStemGeo, mats.pearlWhite),
        new THREE.Mesh(mushCapGeo, mushGlowMat),
      );
      this.dwExpandGroup.add(mg);
    });

    const houseWallsGeo = tracker.trackGeo(new THREE.BoxGeometry(1.65, 1.85, 1.65));
    houseWallsGeo.translate(0, 0.925, 0);
    const houseRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(1.45, 1.35, 4));
    houseRoofGeo.rotateY(Math.PI / 4);
    houseRoofGeo.translate(0, 2.52, 0);

    [
      [-2.2, -5.2],
      [-2.2, 5.2],
      [3.6, -5.0],
      [3.6, 5.0],
    ].forEach(([hx, hz]) => {
      const hg = new THREE.Group();
      hg.position.set(hx, 0, hz);
      hg.add(
        new THREE.Mesh(houseWallsGeo, mats.creamStone),
        new THREE.Mesh(houseRoofGeo, mats.powderBlueSpire),
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

    // Full-Scale Twin-Tower Castle Backdrop on East Edge (+6.2, 0, 0) + "I LOVE YOU" Garden Topiary
    this.dwFullCastleBackdrop = new THREE.Group();
    this.dwFullCastleBackdrop.position.set(6.2, 0, 0);
    this.dwFullCastleBackdrop.rotation.y = -Math.PI / 2;

    const bigTowerGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.85, 0.95, 5.4, 16));
    bigTowerGeo.translate(0, 2.7, 0);
    const bigSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(1.08, 2.4, 16));
    bigSpireGeo.translate(0, 6.6, 0);
    const bigBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(3.2, 0.48, 0.85));
    bigBridgeGeo.translate(0, 3.8, 0);

    const bigTowerL = new THREE.Group();
    bigTowerL.position.set(-1.6, 0, 0);
    bigTowerL.add(
      new THREE.Mesh(bigTowerGeo, mats.champagneGold),
      new THREE.Mesh(bigSpireGeo, mats.powderBlueSpire),
    );
    const bigTowerR = new THREE.Group();
    bigTowerR.position.set(1.6, 0, 0);
    bigTowerR.add(
      new THREE.Mesh(bigTowerGeo, mats.blushRoseMarble),
      new THREE.Mesh(bigSpireGeo, mats.champagneGold),
    );

    const bigLovePlaqueTex = createPlaqueCanvasTex(
      tracker,
      '♥ I LOVE YOU, HARSHA ♥',
      'Tower of Yeshwanth & Tower of Harsha · Forever One World',
      '#831843',
      '#fde047',
    );
    const bigLovePlaqueBoardGeo = tracker.trackGeo(new THREE.BoxGeometry(2.74, 0.96, 0.12));
    const bigLovePlaqueBoard = new THREE.Mesh(bigLovePlaqueBoardGeo, mats.champagneGold);
    bigLovePlaqueBoard.position.set(0, 3.05, 0);

    const bigLovePlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.6, 0.85));
    const bigLovePlaqueMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: bigLovePlaqueTex, side: THREE.FrontSide }),
    );
    const bigLovePlaqueFront = new THREE.Mesh(bigLovePlaqueGeo, bigLovePlaqueMat);
    bigLovePlaqueFront.position.set(0, 3.05, 0.07);
    const bigLovePlaqueBack = new THREE.Mesh(bigLovePlaqueGeo, bigLovePlaqueMat);
    bigLovePlaqueBack.position.set(0, 3.05, -0.07);
    bigLovePlaqueBack.rotation.y = Math.PI;

    // 3D "I ♥ U" Rose Parterre Bed in front of the Full-Scale Twin-Tower Castle (facing player looking East -> local +Z of dwFullCastleBackdrop)
    const dwParterreGroup = new THREE.Group();
    dwParterreGroup.position.set(0, 0.02, 1.35);
    const dwParterreBed = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(2.2, 0.08, 0.88)),
      mats.pearlWhite,
    );
    dwParterreGroup.add(dwParterreBed);
    const dwRoseBudGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 8, 8));
    // Local +Z of dwFullCastleBackdrop points West (-X) toward approaching Harsha!
    // When Harsha looks East (-Z of dwFullCastleBackdrop), local -X is screen-left, +X is screen-right, -Z is top, +Z is bottom:
    const dwParterrePoints: Array<{ x: number; z: number; isHeart?: boolean }> = [
      // 'I' (left, -X)
      { x: -0.68, z: -0.22 },
      { x: -0.68, z: -0.11 },
      { x: -0.68, z: 0.0 },
      { x: -0.68, z: 0.11 },
      { x: -0.68, z: 0.22 },
      // '♥' (center: upper lobes at -Z, lower tip at +Z)
      { x: -0.12, z: -0.18, isHeart: true },
      { x: 0.12, z: -0.18, isHeart: true },
      { x: -0.2, z: -0.04, isHeart: true },
      { x: 0.0, z: -0.06, isHeart: true },
      { x: 0.2, z: -0.04, isHeart: true },
      { x: -0.11, z: 0.1, isHeart: true },
      { x: 0.11, z: 0.1, isHeart: true },
      { x: 0.0, z: 0.22, isHeart: true },
      // 'U' (right, +X: top at -Z, bottom curve at +Z)
      { x: 0.52, z: -0.22 },
      { x: 0.52, z: -0.06 },
      { x: 0.52, z: 0.1 },
      { x: 0.65, z: 0.22 },
      { x: 0.78, z: 0.1 },
      { x: 0.78, z: -0.06 },
      { x: 0.78, z: -0.22 },
    ];
    dwParterrePoints.forEach((pt) => {
      const bud = new THREE.Mesh(
        dwRoseBudGeo,
        pt.isHeart ? flowerPinkMat : mats.champagneGold,
      );
      bud.position.set(pt.x, 0.08, pt.z);
      dwParterreGroup.add(bud);
    });

    // Sculpted 3D Heart Trees flanking the Full-Scale Twin-Tower Castle in Little Dream World
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
      bigLovePlaqueBoard,
      bigLovePlaqueFront,
      bigLovePlaqueBack,
      dwParterreGroup,
      buildDreamWorldHeartTree(-3.4, 0.8, flowerPinkMat),
      buildDreamWorldHeartTree(3.4, 0.8, mats.softLavender),
    );
    this.dwExpandGroup.add(this.dwFullCastleBackdrop);

    // =========================================================================
    // SECTIONS 15, 16, 17: GOLDEN YESHWANTH FIGURE + GOLDEN-RIMMED ROSE + MESSAGES
    // =========================================================================
    this.goldenYeshwanthGroup = new THREE.Group();
    this.goldenYeshwanthGroup.name = 'GoldenYeshwanthFigure';
    // Default standing spot in the Little Dream World garden (East of fountain)
    this.goldenYeshwanthGroup.position.set(2.4, 0, 0);
    this.goldenYeshwanthGroup.rotation.y = -Math.PI / 2; // Faces West toward Harsha

    const goldenSkinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.72,
        roughness: 0.18,
        metalness: 0.82,
      }),
    );
    const goldenCoatMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.55,
        roughness: 0.24,
        metalness: 0.88,
      }),
    );

    // Distant Golden Arrival Glow Halo (Section 15.2)
    const arrivalGlowGeo = tracker.trackGeo(new THREE.SphereGeometry(0.65, 16, 16));
    const arrivalGlowMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.32,
      }),
    );
    this.goldenArrivalGlow = new THREE.Mesh(arrivalGlowGeo, arrivalGlowMat);
    this.goldenArrivalGlow.position.set(0, 1.15, 0);
    this.goldenYeshwanthGroup.add(this.goldenArrivalGlow);

    // Legs
    const legGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.068, 0.055, 0.72, 10));
    legGeo.translate(0, -0.36, 0);
    this.yeshLeftLeg = new THREE.Group();
    this.yeshLeftLeg.position.set(-0.11, 0.72, 0);
    this.yeshLeftLeg.add(new THREE.Mesh(legGeo, goldenCoatMat));
    this.yeshRightLeg = new THREE.Group();
    this.yeshRightLeg.position.set(0.11, 0.72, 0);
    this.yeshRightLeg.add(new THREE.Mesh(legGeo, goldenCoatMat));

    // Royal Tunic & Torso
    const torsoGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.21, 0.16, 0.68, 12));
    torsoGeo.translate(0, 1.04, 0);
    const sashGeo = tracker.trackGeo(new THREE.TorusGeometry(0.18, 0.025, 8, 16));
    sashGeo.rotateX(Math.PI / 3);
    sashGeo.translate(0, 1.08, 0);

    // Head & Royal Golden Circlet
    const headGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 14));
    headGeo.translate(0, 1.54, 0);
    const circletGeo = tracker.trackGeo(new THREE.TorusGeometry(0.135, 0.014, 8, 20));
    circletGeo.rotateX(Math.PI / 2);
    circletGeo.translate(0, 1.64, 0);

    // Arms
    const armGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.048, 0.042, 0.56, 10));
    armGeo.translate(0, -0.26, 0);
    this.yeshLeftArm = new THREE.Group();
    this.yeshLeftArm.position.set(-0.24, 1.32, 0);
    this.yeshLeftArm.add(new THREE.Mesh(armGeo, goldenSkinMat));

    this.yeshRightArm = new THREE.Group();
    this.yeshRightArm.position.set(0.24, 1.32, 0);
    this.yeshRightArm.add(new THREE.Mesh(armGeo, goldenSkinMat));

    // Detailed 3D Rose in Yeshwanth's Right Hand (Section 16 Shot 4: petals, stem, leaves, golden rim light)
    this.yeshRoseGroup = new THREE.Group();
    this.yeshRoseGroup.position.set(0, -0.52, 0.06);
    this.yeshRoseGroup.rotation.x = Math.PI * 0.42;

    const rStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.006, 0.007, 0.26, 8));
    rStemGeo.translate(0, 0.1, 0);
    const rStemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.4 }),
    );
    const rPetalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#fbbf24',
        emissiveIntensity: 0.55,
        roughness: 0.2,
      }),
    );
    const rBudGeo = tracker.trackGeo(new THREE.ConeGeometry(0.028, 0.055, 10));
    rBudGeo.rotateX(Math.PI);
    rBudGeo.translate(0, 0.24, 0);
    const rOuterGeo = tracker.trackGeo(new THREE.SphereGeometry(0.034, 10, 8));
    rOuterGeo.scale(1.18, 0.85, 1.18);
    rOuterGeo.translate(0, 0.23, 0);
    const rLeafGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 6));
    rLeafGeo.scale(1.6, 0.35, 0.75);
    const rLeaf1 = new THREE.Mesh(rLeafGeo, rStemMat);
    rLeaf1.position.set(-0.02, 0.13, 0);
    rLeaf1.rotation.z = 0.45;
    const rLeaf2 = new THREE.Mesh(rLeafGeo, rStemMat);
    rLeaf2.position.set(0.02, 0.16, 0);
    rLeaf2.rotation.z = -0.45;
    const rRimHaloGeo = tracker.trackGeo(new THREE.TorusGeometry(0.038, 0.005, 8, 18));
    rRimHaloGeo.translate(0, 0.235, 0);

    this.yeshRoseGroup.add(
      new THREE.Mesh(rStemGeo, rStemMat),
      new THREE.Mesh(rOuterGeo, rPetalMat),
      new THREE.Mesh(rBudGeo, goldenSkinMat),
      rLeaf1,
      rLeaf2,
      new THREE.Mesh(rRimHaloGeo, goldenSkinMat),
    );
    this.yeshRightArm.add(this.yeshRoseGroup);

    this.goldenYeshwanthGroup.add(
      this.yeshLeftLeg,
      this.yeshRightLeg,
      new THREE.Mesh(torsoGeo, goldenCoatMat),
      new THREE.Mesh(sashGeo, mats.blushRoseMarble),
      new THREE.Mesh(headGeo, goldenSkinMat),
      new THREE.Mesh(circletGeo, mats.champagneGold),
      this.yeshLeftArm,
      this.yeshRightArm,
    );
    this.dwExpandGroup.add(this.goldenYeshwanthGroup);

    // Section 17: World-Integrated Floating Personal Message Banners above the Two-Shot
    // Strictly uses THREE.FrontSide with separate Front (+Z) and Back (-Z, rotation.y = Math.PI) meshes so text is NEVER mirrored!
    const msgGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.92, 0.58));
    const msg1Tex = createFloatingMessageTex(
      tracker,
      '"Harsha, this little world was made for you."',
      '— Yeshwanth ♡',
      false,
    );
    this.messageBanner1Mat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: msg1Tex,
        transparent: true,
        opacity: 0.0,
        side: THREE.FrontSide,
      }),
    );
    this.messageBanner1 = new THREE.Mesh(msgGeo, this.messageBanner1Mat);
    this.messageBanner1.position.set(-2.9, 1.94, 0);
    const msg1Back = new THREE.Mesh(msgGeo, this.messageBanner1Mat);
    msg1Back.position.z = -0.01;
    msg1Back.rotation.y = Math.PI;
    this.messageBanner1.add(msg1Back);
    this.messageBanner1.visible = false;

    const msg2Tex = createFloatingMessageTex(
      tracker,
      'I LOVE YOU.',
      'Forever in Our Little Dream World ♡',
      true,
    );
    this.messageBanner2Mat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: msg2Tex,
        transparent: true,
        opacity: 0.0,
        side: THREE.FrontSide,
      }),
    );
    this.messageBanner2 = new THREE.Mesh(msgGeo, this.messageBanner2Mat);
    this.messageBanner2.position.set(-2.9, 1.94, 0);
    const msg2Back = new THREE.Mesh(msgGeo, this.messageBanner2Mat);
    msg2Back.position.z = -0.01;
    msg2Back.rotation.y = Math.PI;
    this.messageBanner2.add(msg2Back);
    this.messageBanner2.visible = false;

    this.dwExpandGroup.add(this.messageBanner1, this.messageBanner2);
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
    return Math.hypot(lx - (33.0 + this.goldenYeshwanthGroup.position.x), lz - 12.0) <= 3.2;
  }

  public triggerEnterLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'ENTERING_STORY';
    this.transitionElapsed = 0.0;
    this.yeshRoseGroup.visible = true;
    this.avatarBridge?.setRoseHeld?.(false);
    this.avatarBridge?.setRaisingHand?.(false);
    this.activeStoryCaption =
      'Tabletop Dream Castle ✧ Observing the Twin Towers & Miniature Gardens… ([E] Continue · [Space] Skip)';
    return true;
  }

  public triggerReplayGoldenYeshwanthStory(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'REPLAY_ROSE';
    this.transitionElapsed = 0.0;
    this.yeshRoseGroup.visible = true;
    this.avatarBridge?.setRoseHeld?.(false);
    this.avatarBridge?.setRaisingHand?.(false);
    this.activeStoryCaption =
      'Golden Yeshwanth ✧ A Golden Glow Awakens Along the Path… ([E] Continue · [Space] Skip)';
    return true;
  }

  public triggerExitLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'EXITING';
    this.transitionElapsed = 0.0;
    this.activeStoryCaption = 'Returning Gently Through the Castle Gate to the Doll Playroom…';
    return true;
  }

  public isTransitionActive(): boolean {
    return this.transitionState !== 'NONE';
  }

  public getStoryCaption(): string | null {
    return this.isTransitionActive() ? this.activeStoryCaption : null;
  }

  /**
   * Section 21: `[E] Continue` advances the active Tabletop / Little Dream World cinematic to the next beat.
   */
  public advanceOrContinueCinematic(): boolean {
    if (!this.isTransitionActive()) return false;
    if (this.transitionState === 'ENTERING_STORY') {
      const jumpPoints = [5.0, 14.0, 20.5, 26.8, 32.2, this.ENTER_STORY_DUR];
      const nextPt = jumpPoints.find((pt) => pt > this.transitionElapsed + 0.4);
      if (nextPt === undefined || nextPt >= this.ENTER_STORY_DUR) {
        return this.skipCinematic();
      }
      if (nextPt >= 5.0 && !this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      if (nextPt >= 25.0) {
        this.yeshRoseGroup.visible = false;
        this.avatarBridge?.setRoseHeld?.(true);
        this.avatarBridge?.setRaisingHand?.(false);
      }
      this.transitionElapsed = nextPt;
      return true;
    }
    if (this.transitionState === 'REPLAY_ROSE') {
      const jumpPoints = [6.5, 12.8, 18.2, this.REPLAY_ROSE_DUR];
      const nextPt = jumpPoints.find((pt) => pt > this.transitionElapsed + 0.4);
      if (nextPt === undefined || nextPt >= this.REPLAY_ROSE_DUR) {
        return this.skipCinematic();
      }
      if (nextPt >= 11.0) {
        this.yeshRoseGroup.visible = false;
        this.avatarBridge?.setRoseHeld?.(true);
        this.avatarBridge?.setRaisingHand?.(false);
      }
      this.transitionElapsed = nextPt;
      return true;
    }
    return this.skipCinematic();
  }

  /**
   * Section 21 & 23: Safe Skip / Interruption (`[Space]` or `[Esc]`)
   */
  public skipCinematic(): boolean {
    if (!this.isTransitionActive()) return false;

    if (this.transitionState === 'ENTERING_STORY') {
      if (!this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      this.yeshRoseGroup.visible = false;
      this.avatarBridge?.setRoseHeld?.(true);
    } else if (this.transitionState === 'REPLAY_ROSE') {
      this.yeshRoseGroup.visible = false;
      this.avatarBridge?.setRoseHeld?.(true);
    } else if (this.transitionState === 'EXITING') {
      if (this.isInsideLittleDreamWorld) {
        this.completeWorldExitTeleport();
      }
    }

    // Reset all animated scales, banners, and poses cleanly
    this.dwExpandGroup.scale.setScalar(1.0);
    this.flowerGroups.forEach((fg) => fg.scale.setScalar(1.0));
    this.goldenYeshwanthGroup.position.set(-2.35, 0, 0);
    this.yeshLeftLeg.rotation.set(0, 0, 0);
    this.yeshRightLeg.rotation.set(0, 0, 0);
    this.yeshRightArm.rotation.set(-0.35, 0, 0);
    this.goldenArrivalGlow.scale.setScalar(1.0);
    this.messageBanner1.visible = false;
    this.messageBanner2.visible = true;
    this.messageBanner2.position.set(-1.2, 2.32, 0);
    this.messageBanner2Mat.opacity = 0.92;
    this.avatarBridge?.setRaisingHand?.(false);

    this.transitionState = 'NONE';
    this.transitionElapsed = 0.0;
    this.transitionSeatYaw = undefined;
    this.activeStoryCaption =
      'Little Dream World ✧ Holding the Golden Rose from Yeshwanth ♡';
    return true;
  }

  private completeWorldEntryTeleport(): void {
    this.isInsideLittleDreamWorld = true;
    this.pendingPlayerWorldTeleport = new THREE.Vector3(
      this.originX + 29.35,
      this.baseY + this.y0,
      this.originZ + 12.0,
    );
    this.pendingPlayerYaw = Math.PI / 2; // Face East toward the fountain & Golden Yeshwanth
  }

  private completeWorldExitTeleport(): void {
    this.isInsideLittleDreamWorld = false;
    this.pendingPlayerWorldTeleport = new THREE.Vector3(
      this.originX + this.entranceSpec.returnPoint.x,
      this.baseY + this.entranceSpec.returnPoint.y,
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

    // Determine timeline offset for ENTERING_STORY (0..36.8s) vs REPLAY_ROSE (maps to 14.0..36.8s)
    const totalDur =
      this.transitionState === 'ENTERING_STORY' ? this.ENTER_STORY_DUR : this.REPLAY_ROSE_DUR;
    const rawT = this.transitionElapsed;
    const enterAlpha = easeInOutSine(THREE.MathUtils.clamp(rawT / 1.1, 0, 1));
    const exitAlpha = easeInOutSine(THREE.MathUtils.clamp((totalDur - rawT) / 1.2, 0, 1));
    const blendAlpha = Math.min(enterAlpha, exitAlpha);

    const storyT =
      this.transitionState === 'ENTERING_STORY' ? rawT : rawT + 14.0;

    const tableCenterX = this.originX + this.entranceSpec.tableCenterLocal.x;
    const tableCenterY = this.baseY + this.y0 + 0.55;
    const tableCenterZ = this.originZ + this.entranceSpec.tableCenterLocal.z;
    const gateWorldX = this.originX + this.entranceSpec.position.x;
    const gateWorldZ = this.originZ + this.entranceSpec.position.z;

    const dwCenterX = this.originX + 33.0;
    const dwCenterY = this.baseY + this.y0;
    const dwCenterZ = this.originZ + 12.0;

    // Harsha's position inside the Little Dream World during Sections 15–18
    const harshaWorldX = dwCenterX - 3.65; // lx = 29.35
    const harshaWorldY = dwCenterY;
    const harshaWorldZ = dwCenterZ;

    // =========================================================================
    // SECTION 13: TABLETOP CASTLE ENTRY CAMERA (0.0s -> 5.0s)
    // Slow lingering arc around miniature castle (Twin Towers, bridge, fountain, "I LOVE YOU" sign) -> South Gate opens -> Move through
    // =========================================================================
    if (storyT < 5.0) {
      this.transitionSeatYaw = undefined;
      if (storyT < 3.2) {
        const u = easeInOutCubic(storyT / 3.2);
        // Lingering orbital sweep from South-West (Yeshwanth Tower) to South-East (Harsha Tower) and back to the Front Gate
        const ang = -Math.PI * 0.5 + Math.sin(u * Math.PI * 2.0) * 0.42;
        const radius = THREE.MathUtils.lerp(1.62, 1.28, u);
        this.transitionCamPos.set(
          tableCenterX + Math.cos(ang) * radius,
          tableCenterY + THREE.MathUtils.lerp(0.62, 0.34, u),
          tableCenterZ + Math.sin(ang) * radius,
        );
        this.transitionLookPos.set(
          tableCenterX + Math.sin(u * Math.PI * 2.0) * 0.16,
          tableCenterY + THREE.MathUtils.lerp(0.38, 0.22, u),
          tableCenterZ + THREE.MathUtils.lerp(0.05, -0.35, u),
        );
        this.transitionFov = 46.0;
        this.activeStoryCaption =
          'Tabletop Dream Castle ✧ Twin Towers, Skybridge, Fountain & Miniature "I LOVE YOU" Garden';
      } else {
        // Approach South miniature gate -> Lingering pause as tiny gate opens -> Glide through gate
        const u = easeInOutCubic((storyT - 3.2) / 1.8);
        this.transitionCamPos.set(
          gateWorldX,
          tableCenterY + THREE.MathUtils.lerp(0.34, 0.15, u),
          THREE.MathUtils.lerp(gateWorldZ - 0.52, gateWorldZ + 0.12, u),
        );
        this.transitionLookPos.set(
          tableCenterX,
          tableCenterY + 0.16,
          tableCenterZ,
        );
        this.transitionFov = THREE.MathUtils.lerp(46, 38, u);
        this.activeStoryCaption =
          'The Miniature Castle Gate Opens ✧ Stepping Inside Our Little Castle…';
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
    // SECTION 14: LITTLE DREAM WORLD TRANSFORMATION (5.0s -> 14.0s, 8 Stages)
    // =========================================================================
    if (storyT < 14.0) {
      const u = (storyT - 5.0) / 9.0;
      const smoothU = easeInOutCubic(u);

      // Stage 2–6: Environment, Oversized Flowers & Castle expand gracefully around the player
      const worldScale = THREE.MathUtils.lerp(0.45, 1.0, easeInOutSine(Math.min(1, u * 1.25)));
      this.dwExpandGroup.scale.setScalar(worldScale);

      const flowerGrowth = easeInOutCubic(THREE.MathUtils.clamp((u - 0.15) / 0.65, 0, 1));
      this.flowerGroups.forEach((fg) => {
        fg.scale.setScalar(THREE.MathUtils.lerp(0.25, 1.0, flowerGrowth));
      });
      if (this.dwFullCastleBackdrop) {
        const castleGrowth = easeInOutCubic(THREE.MathUtils.clamp((u - 0.3) / 0.65, 0, 1));
        this.dwFullCastleBackdrop.scale.setScalar(THREE.MathUtils.lerp(0.35, 1.0, castleGrowth));
      }

      this.transitionSeatPos.set(harshaWorldX, harshaWorldY, harshaWorldZ);
      this.transitionSeatYaw = Math.PI / 2;

      // Stage 1 -> Stage 7 -> Stage 8: Camera emerges from the gate, glides forward and rises gently
      this.transitionCamPos.set(
        dwCenterX + THREE.MathUtils.lerp(-6.2, -5.4, smoothU),
        dwCenterY + THREE.MathUtils.lerp(0.95, 2.35, smoothU),
        dwCenterZ + Math.sin(u * Math.PI) * 1.25,
      );
      this.transitionLookPos.set(
        dwCenterX + THREE.MathUtils.lerp(-2.5, 1.8, smoothU),
        dwCenterY + THREE.MathUtils.lerp(1.05, 1.75, smoothU),
        dwCenterZ,
      );
      this.transitionFov = THREE.MathUtils.lerp(42, 54, smoothU);

      if (u < 0.35) {
        this.activeStoryCaption =
          'Little Dream World ✧ The Miniature Garden & Blossom Path Begin Expanding…';
      } else if (u < 0.7) {
        this.activeStoryCaption =
          'Little Dream World ✧ Oversized Pastel Flowers & Twin Streams Awaken Around Harsha…';
      } else {
        this.activeStoryCaption =
          'Little Dream World ✧ Welcoming Harsha Into the Hidden World Inside the Castle…';
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

    // Ensure world scale is 1.0 for Sections 15–18
    this.dwExpandGroup.scale.setScalar(1.0);
    this.flowerGroups.forEach((fg) => fg.scale.setScalar(1.0));
    if (this.dwFullCastleBackdrop) this.dwFullCastleBackdrop.scale.setScalar(1.0);

    this.transitionSeatPos.set(harshaWorldX, harshaWorldY, harshaWorldZ);
    this.transitionSeatYaw = Math.PI / 2;

    // =========================================================================
    // SECTION 15: GOLDEN YESHWANTH CAMERA (14.0s -> 20.5s)
    // Wide shot -> Distant golden glow -> Slow camera pan -> Walks toward Harsha -> Front 3/4 two-shot
    // =========================================================================
    if (storyT < 20.5) {
      const u = (storyT - 14.0) / 6.5;
      const walkU = easeInOutSine(THREE.MathUtils.clamp((u - 0.22) / 0.78, 0, 1));

      // Yeshwanth walks from East Castle path (+4.2) to (-2.35), stopping 1.3m in front of Harsha (-3.65)
      const yeshLocalX = THREE.MathUtils.lerp(4.2, -2.35, walkU);
      this.goldenYeshwanthGroup.position.set(yeshLocalX, 0, 0);

      // Gentle walking stride while moving
      const isWalking = u > 0.22 && u < 0.96;
      const stride = isWalking ? Math.sin(storyT * 5.5) * 0.32 : 0.0;
      this.yeshLeftLeg.rotation.x = stride;
      this.yeshRightLeg.rotation.x = -stride;
      this.yeshLeftArm.rotation.x = -stride * 0.6;
      this.yeshRightArm.rotation.x = -0.45; // Carrying the rose gently

      // Distant golden glow pulse during initial reveal
      const glowPulse = u < 0.35 ? 1.45 + Math.sin(storyT * 6.0) * 0.35 : 0.85;
      this.goldenArrivalGlow.scale.setScalar(glowPulse);

      const yeshWorldX = dwCenterX + yeshLocalX;
      const yeshWorldY = dwCenterY;
      const yeshWorldZ = dwCenterZ;

      const panU = easeInOutSine(u);
      this.transitionCamPos.set(
        THREE.MathUtils.lerp(harshaWorldX - 2.1, harshaWorldX + 0.65, panU),
        dwCenterY + THREE.MathUtils.lerp(2.15, 1.52, panU),
        dwCenterZ + THREE.MathUtils.lerp(2.65, 1.85, panU),
      );
      this.transitionLookPos.set(
        THREE.MathUtils.lerp(yeshWorldX, (harshaWorldX + yeshWorldX) * 0.5, panU),
        yeshWorldY + 1.35,
        yeshWorldZ,
      );
      this.transitionFov = THREE.MathUtils.lerp(52, 45, panU);
      this.activeStoryCaption =
        u < 0.3
          ? 'A Warm Golden Glow Appears Along the Garden Path…'
          : 'Golden Yeshwanth Approaches Harsha with a Single Rose…';

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

    // Keep Yeshwanth standing facing Harsha at (-2.35, 0, 0) -> worldX = dwCenterX - 2.35
    this.goldenYeshwanthGroup.position.set(-2.35, 0, 0);
    this.yeshLeftLeg.rotation.x = 0;
    this.yeshRightLeg.rotation.x = 0;
    this.goldenArrivalGlow.scale.setScalar(0.65);

    const yeshWorldX = dwCenterX - 2.35;
    const midTwoShotX = (harshaWorldX + yeshWorldX) * 0.5; // dwCenterX - 3.0
    const handMeetWorldX = midTwoShotX;
    const handMeetWorldY = dwCenterY + 1.12;
    const handMeetWorldZ = dwCenterZ;

    // =========================================================================
    // SECTION 16: ROSE HANDOFF CINEMATIC (20.5s -> 26.8s, Shots 1 to 10)
    // =========================================================================
    if (storyT < 26.8) {
      const hT = storyT - 20.5; // 0.0 -> 6.3s

      if (hT < 1.6) {
        // SHOT 1–3: Wide shot slowly moving closer into a medium two-shot
        const u = easeInOutSine(hT / 1.6);
        this.yeshRightArm.rotation.x = THREE.MathUtils.lerp(-0.45, -0.75, u);
        this.transitionCamPos.set(
          midTwoShotX,
          dwCenterY + 1.46,
          dwCenterZ + THREE.MathUtils.lerp(1.95, 1.38, u),
        );
        this.transitionLookPos.set(midTwoShotX, dwCenterY + 1.32, dwCenterZ);
        this.transitionFov = THREE.MathUtils.lerp(45, 41, u);
        this.activeStoryCaption = 'Golden Yeshwanth Looks Toward Harsha…';
      } else if (hT < 2.8) {
        // SHOT 4: Camera gently moves toward the Rose (petals, stem, leaves, golden rim light)
        const u = easeInOutCubic((hT - 1.6) / 1.2);
        this.yeshRightArm.rotation.x = THREE.MathUtils.lerp(-0.75, -1.05, u);
        this.transitionCamPos.set(
          midTwoShotX + 0.12,
          handMeetWorldY + 0.12,
          dwCenterZ + THREE.MathUtils.lerp(1.38, 0.56, u),
        );
        this.transitionLookPos.set(midTwoShotX + 0.15, handMeetWorldY + 0.04, dwCenterZ);
        this.transitionFov = THREE.MathUtils.lerp(41, 35, u);
        this.activeStoryCaption = 'A Golden-Rimmed Rose ✧ Crimson Petals & Warm Rim Light';
      } else if (hT < 4.2) {
        // SHOT 5 & 6: Yeshwanth extends his hand (hold) -> Harsha's hand approaches (hold)
        const u = easeInOutSine((hT - 2.8) / 1.4);
        this.yeshRightArm.rotation.x = -1.22;
        if (hT >= 3.4) {
          this.avatarBridge?.setRaisingHand?.(true);
        }
        this.transitionCamPos.set(
          midTwoShotX,
          handMeetWorldY + 0.08,
          dwCenterZ + 0.52,
        );
        this.transitionLookPos.set(handMeetWorldX, handMeetWorldY, handMeetWorldZ);
        this.transitionFov = 35.0;
        this.activeStoryCaption =
          hT < 3.4
            ? 'Yeshwanth Extends the Rose Toward Harsha…'
            : "Harsha's Hand Reaches Gently to Receive the Rose…";
      } else if (hT < 5.2) {
        // SHOT 7 & 8: Rose transfers into Harsha's hand + Close detail of their hands
        this.yeshRoseGroup.visible = false;
        this.avatarBridge?.setRoseHeld?.(true);
        this.avatarBridge?.setRaisingHand?.(true);
        this.yeshRightArm.rotation.x = -1.15;

        this.transitionCamPos.set(
          midTwoShotX - 0.05,
          handMeetWorldY + 0.06,
          dwCenterZ + 0.48,
        );
        this.transitionLookPos.set(handMeetWorldX, handMeetWorldY, handMeetWorldZ);
        this.transitionFov = 34.0;
        this.activeStoryCaption = 'The Rose is Placed Gently Into Harsha’s Hand ♡';
      } else {
        // SHOT 9 & 10: Camera slowly rises back to the two-character composition for a quiet emotional beat
        const u = easeInOutSine((hT - 5.2) / 1.1);
        this.avatarBridge?.setRaisingHand?.(false);
        this.yeshRightArm.rotation.x = THREE.MathUtils.lerp(-1.15, -0.35, u);
        this.transitionCamPos.set(
          midTwoShotX,
          THREE.MathUtils.lerp(handMeetWorldY + 0.06, dwCenterY + 1.48, u),
          dwCenterZ + THREE.MathUtils.lerp(0.48, 1.52, u),
        );
        this.transitionLookPos.set(
          midTwoShotX,
          THREE.MathUtils.lerp(handMeetWorldY, dwCenterY + 1.36, u),
          dwCenterZ,
        );
        this.transitionFov = THREE.MathUtils.lerp(34, 43, u);
        this.activeStoryCaption = 'Together in the Little Dream World…';
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

    // Ensure Rose is held by Harsha for Sections 17 & 18
    this.yeshRoseGroup.visible = false;
    this.avatarBridge?.setRoseHeld?.(true);
    this.avatarBridge?.setRaisingHand?.(false);
    this.yeshRightArm.rotation.x = -0.3;

    // =========================================================================
    // SECTION 17: GOLDEN MAN PERSONAL MESSAGE (26.8s -> 32.2s)
    // Hold two-shot -> "Harsha, this little world was made for you." -> Pause -> "I LOVE YOU."
    // =========================================================================
    if (storyT < 32.2) {
      const mT = storyT - 26.8; // 0.0 -> 5.4s

      if (mT < 0.9) {
        // Quiet emotional hold before any text appears
        this.messageBanner1.visible = false;
        this.messageBanner2.visible = false;
        this.activeStoryCaption = '…';
      } else if (mT < 3.1) {
        // Message 1: "Harsha, this little world was made for you."
        const alpha1 =
          mT < 1.5
            ? easeInOutSine((mT - 0.9) / 0.6)
            : mT > 2.6
              ? easeInOutSine((3.1 - mT) / 0.5)
              : 1.0;
        this.messageBanner1.visible = true;
        this.messageBanner1Mat.opacity = alpha1;
        this.messageBanner2.visible = false;
        this.activeStoryCaption = '"Harsha, this little world was made for you."';
      } else {
        // Message 2 with greater emotional weight: "I LOVE YOU."
        const alpha2 = easeInOutSine(THREE.MathUtils.clamp((mT - 3.2) / 0.7, 0, 1));
        this.messageBanner1.visible = false;
        this.messageBanner2.visible = true;
        this.messageBanner2Mat.opacity = alpha2;
        this.activeStoryCaption = 'Golden Yeshwanth: "I LOVE YOU." ♡';
      }

      const slowBreath = Math.sin(mT * 0.8) * 0.08;
      this.messageBanner1.position.set(-2.9, 1.94, 0);
      this.messageBanner2.position.set(-2.9, 1.94, 0);
      this.transitionCamPos.set(
        midTwoShotX + slowBreath,
        dwCenterY + 1.56,
        dwCenterZ + 2.15,
      );
      this.transitionLookPos.set(midTwoShotX, dwCenterY + 1.66, dwCenterZ);
      this.transitionFov = 45.0;
      const bannerYaw1 = Math.atan2(
        this.transitionCamPos.x - (dwCenterX - 2.9),
        this.transitionCamPos.z - dwCenterZ,
      );
      this.messageBanner1.rotation.set(0, bannerYaw1, 0);
      this.messageBanner2.rotation.set(0, bannerYaw1, 0);

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
    // SECTION 18: FINAL CASTLE REVEAL (32.2s -> 36.8s)
    // Slowly pulls backward revealing Harsha + Rose + Golden Yeshwanth + Garden + Castle + Flowers + Sky + "I LOVE YOU" details -> Hold -> Release
    // =========================================================================
    const rT = storyT - 32.2; // 0.0 -> 4.6s
    const pullU = easeInOutCubic(THREE.MathUtils.clamp(rT / 3.2, 0, 1));
    this.messageBanner1.visible = false;
    this.messageBanner2.visible = true;
    this.messageBanner2Mat.opacity = THREE.MathUtils.lerp(1.0, 0.92, pullU);
    const bannerLocalX = THREE.MathUtils.lerp(-2.9, -1.2, pullU);
    const bannerLocalY = THREE.MathUtils.lerp(1.94, 2.32, pullU);
    this.messageBanner2.position.set(bannerLocalX, bannerLocalY, 0);

    this.transitionCamPos.set(
      THREE.MathUtils.lerp(midTwoShotX, dwCenterX - 5.2, pullU),
      dwCenterY + THREE.MathUtils.lerp(1.56, 4.15, pullU),
      dwCenterZ + THREE.MathUtils.lerp(2.15, 6.2, pullU),
    );
    this.transitionLookPos.set(
      THREE.MathUtils.lerp(midTwoShotX, dwCenterX + 1.2, pullU),
      dwCenterY + THREE.MathUtils.lerp(1.66, 2.05, pullU),
      dwCenterZ,
    );
    this.transitionFov = THREE.MathUtils.lerp(45, 56, pullU);
    const bannerYaw2 = Math.atan2(
      this.transitionCamPos.x - (dwCenterX + bannerLocalX),
      this.transitionCamPos.z - dwCenterZ,
    );
    this.messageBanner2.rotation.set(0, bannerYaw2, 0);
    this.activeStoryCaption =
      'Our Little Dream World ✧ Harsha, Golden Yeshwanth & the Twin-Tower Castle ("I LOVE YOU")';

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

    // Animate miniature gate doors when near or transitioning
    const shouldOpenGate =
      (this.transitionState === 'ENTERING_STORY' && this.transitionElapsed >= 3.2) ||
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
    if (this.dreamWorldFountainStream) {
      this.dreamWorldFountainStream.rotation.y = clockTime * 1.4;
      this.dreamWorldFountainStream.scale.y = 0.95 + Math.sin(clockTime * 4.0) * 0.08;
    }

    // Keep "I LOVE YOU." banner gently floating and oriented toward Harsha during free exploration inside Little Dream World
    if (this.isInsideLittleDreamWorld && this.transitionState === 'NONE') {
      this.messageBanner2.visible = true;
      this.messageBanner2.position.set(
        -1.2,
        2.32 + Math.sin(clockTime * 1.6) * 0.04,
        0,
      );
      const exploreYaw = Math.atan2(
        lx - (33.0 + this.messageBanner2.position.x),
        lz - 12.0,
      );
      this.messageBanner2.rotation.set(0, exploreYaw, 0);
    }

    // Physical walk-through return gate check inside Little Dream World
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
      if (this.transitionElapsed >= 5.0 && !this.isInsideLittleDreamWorld) {
        this.completeWorldEntryTeleport();
      }
      if (this.transitionElapsed >= this.ENTER_STORY_DUR) {
        this.skipCinematic();
      }
    } else if (this.transitionState === 'REPLAY_ROSE') {
      this.transitionElapsed += delta;
      if (this.transitionElapsed >= this.REPLAY_ROSE_DUR) {
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
