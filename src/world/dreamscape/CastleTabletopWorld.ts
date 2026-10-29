import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

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

    // Heart emblem
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
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class CastleTabletopWorld {
  public readonly group = new THREE.Group();
  public readonly dynamicObjects = new Set<THREE.Object3D>();

  private readonly tracker: ResourceTracker;
  private readonly mats: DreamCastleMaterials;
  private readonly originX: number;
  private readonly baseY: number;
  private readonly originZ: number;
  private readonly y0: number;

  // Miniature castle animated elements
  private leftGatePivot!: THREE.Group;
  private rightGatePivot!: THREE.Group;
  private gateOpenRatio = 0.0;
  private readonly memoryFrameMaterials: THREE.MeshBasicMaterial[] = [];

  // Scale-Transition & Little Dream World State
  public isInsideLittleDreamWorld = false;
  private transitionState: 'NONE' | 'ENTERING' | 'EXITING' = 'NONE';
  private transitionElapsed = 0.0;
  private readonly TRANSITION_DUR = 0.85;
  private pendingPlayerWorldTeleport: THREE.Vector3 | null = null;
  private pendingPlayerYaw: number | null = null;

  private readonly transitionCamPos = new THREE.Vector3();
  private readonly transitionLookPos = new THREE.Vector3();
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

    this.buildLuxuryTabletopAndMiniatureCastle();
    this.buildConnectedLittleDreamWorld(colliders);
  }

  /**
   * Sections 29–34:
   * - Luxury circular table (ivory/pearl surface, champagne-gold edge, crystal legs, heart-shaped engraved base, underlighting, plaque)
   * - Detailed Multi-Part Miniature Castle with Two Main Towers (Tower A warm champagne/gold for Yeshwanth, Tower B soft blush/crystal for Harsha, joined by a central bridge)
   * - Miniature rose gardens, paired flowers, two trees growing together, fountain with two merging streams, pond, benches, lanterns, tiny carts
   * - Memory Path with 4 physical miniature frames around the castle
   * - Interactive Castle Gate (`[E] EXPLORE LITTLE CASTLE`)
   */
  private buildLuxuryTabletopAndMiniatureCastle(): void {
    const { tracker, mats, y0 } = this;
    const tableGroup = new THREE.Group();
    tableGroup.position.set(12.25, y0, 10.6);
    this.group.add(tableGroup);

    // 1. Luxury Circular Table Upgrades (Section 29)
    const goldEdgeGeo = tracker.trackGeo(new THREE.TorusGeometry(1.68, 0.038, 10, 36));
    goldEdgeGeo.rotateX(Math.PI / 2);
    goldEdgeGeo.translate(0, 0.55, 0);

    const underGlowGeo = tracker.trackGeo(new THREE.TorusGeometry(1.58, 0.024, 8, 32));
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

    // 4 Crystal Legs around perimeter
    const crystalLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.042, 0.54, 12));
    crystalLegGeo.translate(0, 0.27, 0);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(crystalLegGeo, mats.crystalGlass);
      leg.position.set(Math.cos(ang) * 1.48, 0, Math.sin(ang) * 1.48);
      tableGroup.add(leg);
    }

    // Heart-shaped engraved base accent + Decorative Plaque
    const heartLobeBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.35, 0.05, 16));
    heartLobeBaseGeo.translate(0, 0.025, 0);
    const hbL = new THREE.Mesh(heartLobeBaseGeo, mats.champagneGold);
    hbL.position.set(-0.18, 0, -1.52);
    const hbR = new THREE.Mesh(heartLobeBaseGeo, mats.champagneGold);
    hbR.position.set(0.18, 0, -1.52);

    const tablePlaqueTex = createPlaqueCanvasTex(
      tracker,
      '✦ THE TABLETOP DREAM CASTLE ✦',
      'Tower of Yeshwanth & Tower of Harsha · Connected by One Bridge',
    );
    const plaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.56, 0.18));
    plaqueGeo.rotateX(-Math.PI / 4);
    const plaqueMesh = new THREE.Mesh(
      plaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: tablePlaqueTex })),
    );
    plaqueMesh.position.set(0, 0.58, -1.55);

    tableGroup.add(
      new THREE.Mesh(goldEdgeGeo, mats.champagneGold),
      new THREE.Mesh(underGlowGeo, underGlowMat),
      hbL,
      hbR,
      plaqueMesh,
    );

    // 2. Two Main Towers Joined by a Central Bridge (Section 31)
    const mcY = 0.55;
    const towerCylGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 1.05, 14));
    towerCylGeo.translate(0, 0.525, 0);
    const towerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(0.19, 0.52, 14));
    towerSpireGeo.translate(0, 1.31, 0);
    const balconyRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.16, 0.015, 8, 16));
    balconyRingGeo.rotateX(Math.PI / 2);
    balconyRingGeo.translate(0, 0.78, 0);

    // Tower A (Left / West): Warmer champagne/gold accents representing Yeshwanth
    const towerAGroup = new THREE.Group();
    towerAGroup.position.set(-0.24, mcY, -0.05);
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

    // Tower B (Right / East): Softer blush/crystal accents representing Harsha
    const towerBGroup = new THREE.Group();
    towerBGroup.position.set(0.24, mcY, -0.05);
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

    // Central Skybridge connecting Tower A and Tower B
    const skyBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.08, 0.14));
    skyBridgeGeo.translate(0, mcY + 0.76, -0.05);
    const skyBridgeArchGeo = tracker.trackGeo(new THREE.TorusGeometry(0.22, 0.014, 8, 16, Math.PI));
    skyBridgeArchGeo.translate(0, mcY + 0.8, -0.05);

    tableGroup.add(
      towerAGroup,
      towerBGroup,
      new THREE.Mesh(skyBridgeGeo, mats.champagneGold),
      new THREE.Mesh(skyBridgeArchGeo, mats.crystalGlass),
    );

    // 3. Miniature Gardens, Two Trees Growing Together, Paired Flowers, Pond & Two Streams Merging at Fountain (Section 32)
    // Two trees growing together with intertwined trunks at (-0.68, mcY, 0.15)
    const trunkGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.016, 0.024, 0.24, 8));
    trunkGeo.translate(0, 0.12, 0);
    const canopyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.095, 10, 10));
    const twinTreeGroup = new THREE.Group();
    twinTreeGroup.position.set(-0.68, mcY, 0.15);
    const t1 = new THREE.Mesh(trunkGeo, mats.champagneGold);
    t1.position.x = -0.025;
    t1.rotation.z = -0.18;
    const t2 = new THREE.Mesh(trunkGeo, mats.champagneGold);
    t2.position.x = 0.025;
    t2.rotation.z = 0.18;
    const c1 = new THREE.Mesh(canopyGeo, softBlushCrystalMat);
    c1.position.set(-0.04, 0.25, 0);
    const c2 = new THREE.Mesh(canopyGeo, warmChampagneMat);
    c2.position.set(0.04, 0.26, 0);
    twinTreeGroup.add(t1, t2, c1, c2);
    tableGroup.add(twinTreeGroup);

    // Two streams merging at the miniature front fountain (0, mcY, 0.88)
    const streamGeo = tracker.trackGeo(new THREE.BoxGeometry(0.045, 0.012, 0.36));
    const streamMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.65,
        roughness: 0.1,
      }),
    );
    const streamL = new THREE.Mesh(streamGeo, streamMat);
    streamL.position.set(-0.14, mcY + 0.01, 0.72);
    streamL.rotation.y = 0.42;
    const streamR = new THREE.Mesh(streamGeo, streamMat);
    streamR.position.set(0.14, mcY + 0.01, 0.72);
    streamR.rotation.y = -0.42;
    tableGroup.add(streamL, streamR);

    // Winding Golden Path & Miniature Lanterns around the Castle
    const windingPathGeo = tracker.trackGeo(new THREE.RingGeometry(1.12, 1.26, 36));
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
      lg.position.set(Math.cos(ang) * 1.28, mcY, Math.sin(ang) * 1.28);
      lg.add(
        new THREE.Mesh(miniLanternPostGeo, mats.champagneGold),
        new THREE.Mesh(miniLanternOrbGeo, warmChampagneMat),
      );
      tableGroup.add(lg);
    }

    // 4. Memory Path with 4 Miniature Physical Frames around the Castle (Section 33)
    const memFrameOuterGeo = tracker.trackGeo(new THREE.BoxGeometry(0.18, 0.22, 0.018));
    memFrameOuterGeo.translate(0, 0.12, 0);
    const memFrameInnerGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.14, 0.18));
    memFrameInnerGeo.translate(0, 0.12, 0.011);

    const frameAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
    frameAngles.forEach((ang, idx) => {
      const fg = new THREE.Group();
      const fx = Math.cos(ang) * 1.18;
      const fz = Math.sin(ang) * 1.18;
      fg.position.set(fx, mcY, fz);
      fg.rotation.y = Math.atan2(fx, fz);

      const defaultTex = createMemoryFrameDefaultTex(tracker, idx);
      const artMat = tracker.trackMat(new THREE.MeshBasicMaterial({ map: defaultTex }));
      this.memoryFrameMaterials.push(artMat);

      fg.add(
        new THREE.Mesh(memFrameOuterGeo, mats.champagneGold),
        new THREE.Mesh(memFrameInnerGeo, artMat),
      );
      tableGroup.add(fg);
    });

    // 5. Interactive Castle Gate at the West/Side of the Miniature Castle (`[E] EXPLORE LITTLE CASTLE`, Section 34)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(-1.05, mcY, 0.0);
    gateGroup.rotation.y = -Math.PI / 2;

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
    this.leftGatePivot.position.set(-0.18, 0, 0);
    this.leftGatePivot.add(new THREE.Mesh(doorLeafGeo, softBlushCrystalMat));

    const doorLeafRightGeo = tracker.trackGeo(new THREE.BoxGeometry(0.17, 0.24, 0.016));
    doorLeafRightGeo.translate(-0.085, 0.12, 0);
    this.rightGatePivot = new THREE.Group();
    this.rightGatePivot.position.set(0.18, 0, 0);
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
   * Sections 35 & 36: Connected Full-Scale `LITTLE DREAM WORLD` Fantasy Enclave
   * Built at castle-local `lx in [25.0, 41.0], lz in [4.0, 20.0]` at elevation `y0 = 5.25m`.
   * Features:
   * - Oversized pastel flowers & glowing mushrooms
   * - Miniature-style fairy village houses & arched footbridge
   * - Lantern path leading from the Return Castle Gate to the Central Merging-Streams Fountain
   * - Two intertwined heart trees & romantic paired seating
   * - Physical Return Gate at `(26.2, y0, 12.0)`: walking back through it transitions the player smoothly back to the Doll Playroom!
   */
  private buildConnectedLittleDreamWorld(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const dwGroup = new THREE.Group();
    dwGroup.name = 'LittleDreamWorldEnclave';
    dwGroup.position.set(33.0, y0, 12.0);
    this.group.add(dwGroup);

    // 1. Enchanted Cloud-Meadow Circular Plateau (radius 8.2m)
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

    // Winding Rose-Gold Path from West Return Gate (-6.8, 0) to Center Fountain (0, 0) and East Gazebo (+4.5, 0)
    const pathGeo = tracker.trackGeo(new THREE.BoxGeometry(12.6, 0.025, 2.1));
    pathGeo.translate(-0.8, 0.012, 0);

    dwGroup.add(
      plateauMesh,
      new THREE.Mesh(rimGoldGeo, mats.champagneGold),
      new THREE.Mesh(pathGeo, mats.blushRoseMarble),
    );

    // 2. Physical Return Castle Gate on West Edge (-6.8, 0, 0) -> castle local (26.2, y0, 12.0)
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
      '← RETURN THROUGH CASTLE GATE',
      'Walk Through Gate to Return to Tabletop Castle',
    );
    const returnSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.2, 0.56));
    const returnSignMesh = new THREE.Mesh(
      returnSignGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: returnSignTex })),
    );
    returnSignMesh.position.set(0, 3.65, 0.16);

    returnGateGroup.add(
      rgPillarL,
      rgPillarR,
      new THREE.Mesh(rgArchGeo, mats.champagneGold),
      this.dreamWorldPortalRing,
      returnSignMesh,
    );
    dwGroup.add(returnGateGroup);

    // 3. Central Twin-Stream Heart Fountain & Arched Footbridge at (0, 0, 0)
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

    dwGroup.add(
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

    // 4. Oversized Fantasy Flowers (6 giant pastel blossoms around the enclave)
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
      dwGroup.add(fg);
    });

    // 5. Glowing Fairy Mushrooms & Toy-Style Village Houses
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
      dwGroup.add(mg);
    });

    // 4 Walk-Around Miniature-Style Fairy Houses
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
      dwGroup.add(hg);
      colliders.push({
        x: this.originX + 33.0 + hx,
        z: this.originZ + 12.0 + hz,
        radius: 1.15,
        y: this.baseY + y0,
        height: 3.5,
      });
    });

    // Romantic Bench & Paired Lanterns looking across the Little Dream World
    const benchSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(1.4, 0.12, 0.52));
    benchSeatGeo.translate(0, 0.46, 0);
    const benchGroup = new THREE.Group();
    benchGroup.position.set(4.5, 0, 0);
    benchGroup.rotation.y = -Math.PI / 2;
    benchGroup.add(new THREE.Mesh(benchSeatGeo, mats.champagneGold));
    dwGroup.add(benchGroup);
  }

  /**
   * Updates one of the miniature Memory Path frames with a newly captured portrait texture!
   */
  public addCapturedPortraitToMemoryPath(tex: THREE.Texture): void {
    if (this.memoryFrameMaterials.length === 0) return;
    const mat = this.memoryFrameMaterials[0];
    mat.map = tex;
    mat.needsUpdate = true;
  }

  public isNearTabletopGate(lx: number, lz: number): boolean {
    if (this.isInsideLittleDreamWorld) return false;
    return Math.hypot(lx - 11.1, lz - 10.6) <= 2.35;
  }

  public isNearDreamWorldReturnGate(lx: number, lz: number): boolean {
    if (!this.isInsideLittleDreamWorld) return false;
    return Math.hypot(lx - 26.2, lz - 12.0) <= 2.45;
  }

  public triggerEnterLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'ENTERING';
    this.transitionElapsed = 0.0;
    return true;
  }

  public triggerExitLittleDreamWorld(): boolean {
    if (this.transitionState !== 'NONE') return false;
    this.transitionState = 'EXITING';
    this.transitionElapsed = 0.0;
    return true;
  }

  public isTransitionActive(): boolean {
    return this.transitionState !== 'NONE';
  }

  public getTransitionCameraState(): {
    active: boolean;
    camWorldPos: THREE.Vector3;
    lookWorldPos: THREE.Vector3;
    blendAlpha: number;
  } {
    if (this.transitionState === 'NONE') {
      return {
        active: false,
        camWorldPos: this.transitionCamPos,
        lookWorldPos: this.transitionLookPos,
        blendAlpha: 0,
      };
    }

    const u = THREE.MathUtils.clamp(this.transitionElapsed / this.TRANSITION_DUR, 0, 1);
    const smoothU = u * u * (3.0 - 2.0 * u);

    if (this.transitionState === 'ENTERING') {
      // Smoothly dive camera from tabletop overview into the miniature gate at (11.2, y0 + 0.72, 10.6)
      this.transitionCamPos.set(
        this.originX + THREE.MathUtils.lerp(10.1, 11.08, smoothU),
        this.baseY + this.y0 + THREE.MathUtils.lerp(1.55, 0.74, smoothU),
        this.originZ + 10.6,
      );
      this.transitionLookPos.set(
        this.originX + 12.25,
        this.baseY + this.y0 + THREE.MathUtils.lerp(0.95, 0.72, smoothU),
        this.originZ + 10.6,
      );
    } else {
      // Smoothly glide through the return gate back to tabletop view
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
    }

    return {
      active: true,
      camWorldPos: this.transitionCamPos,
      lookWorldPos: this.transitionLookPos,
      blendAlpha: Math.sin(u * Math.PI),
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
      this.transitionState === 'ENTERING' ||
      this.isInsideLittleDreamWorld ||
      this.isNearTabletopGate(lx, lz);
    this.gateOpenRatio = THREE.MathUtils.lerp(
      this.gateOpenRatio,
      shouldOpenGate ? 1.0 : 0.0,
      1 - Math.exp(-6.0 * delta),
    );
    if (this.leftGatePivot && this.rightGatePivot) {
      this.leftGatePivot.rotation.y = -this.gateOpenRatio * 1.35;
      this.rightGatePivot.rotation.y = this.gateOpenRatio * 1.35;
    }

    // Animate Little Dream World portal & fountain
    if (this.dreamWorldPortalRing) {
      this.dreamWorldPortalRing.rotation.z = clockTime * 0.85;
    }
    if (this.dreamWorldFountainStream) {
      this.dreamWorldFountainStream.rotation.y = clockTime * 1.4;
      this.dreamWorldFountainStream.scale.y = 0.95 + Math.sin(clockTime * 4.0) * 0.08;
    }

    // Physical walk-through return gate check inside Little Dream World (Section 36: no UI teleport button required!)
    if (
      this.isInsideLittleDreamWorld &&
      this.transitionState === 'NONE' &&
      lx <= 26.65 &&
      lx >= 25.0 &&
      Math.abs(lz - 12.0) <= 1.35
    ) {
      this.triggerExitLittleDreamWorld();
    }

    // Advance scale-transition state machine
    if (this.transitionState !== 'NONE') {
      this.transitionElapsed += delta;
      if (this.transitionElapsed >= this.TRANSITION_DUR * 0.55) {
        if (this.transitionState === 'ENTERING' && !this.isInsideLittleDreamWorld) {
          this.isInsideLittleDreamWorld = true;
          this.pendingPlayerWorldTeleport = new THREE.Vector3(
            this.originX + 28.2,
            this.baseY + this.y0,
            this.originZ + 12.0,
          );
          this.pendingPlayerYaw = Math.PI / 2; // Face East into the Little Dream World
        } else if (this.transitionState === 'EXITING' && this.isInsideLittleDreamWorld) {
          this.isInsideLittleDreamWorld = false;
          this.pendingPlayerWorldTeleport = new THREE.Vector3(
            this.originX + 10.55,
            this.baseY + this.y0,
            this.originZ + 10.6,
          );
          this.pendingPlayerYaw = Math.PI / 2; // Face the Tabletop Castle in the Doll Playroom
        }
      }
      if (this.transitionElapsed >= this.TRANSITION_DUR) {
        this.transitionState = 'NONE';
        this.transitionElapsed = 0.0;
      }
    }
  }
}
