import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export interface JewelleryAvatarBridge {
  getRingAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  getNecklaceAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  getCrownAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  setJewelleryEquipped: (state: {
    ringIndex?: number | null;
    necklaceIndex?: number | null;
    crownEquipped?: boolean;
  }) => void;
  getJewelleryEquipped: () => {
    ringIndex: number | null;
    necklaceIndex: number | null;
    crownEquipped: boolean;
    allThreeWorn: boolean;
  };
}

export const NECKLACE_DESIGNS = [
  { name: 'Two Hearts Necklace', sub: 'Two linked champagne-gold hearts', color: '#ec4899' },
  { name: 'Understanding Pendant', sub: 'Two curved halves forming one heart', color: '#fbbf24' },
  { name: 'Playful Star Necklace', sub: 'Starlight & rose-heart charm', color: '#38bdf8' },
  { name: 'Forever Ribbon Pendant', sub: 'Gold ribbon looping around crystal', color: '#a855f7' },
  { name: 'Our Heart Necklace', sub: 'Two halves united as one pendant', color: '#fb7185' },
] as const;

export const RING_DESIGNS = [
  { name: 'Two Hearts Ring', sub: 'Twin rose-quartz hearts in gold', color: '#f43f5e' },
  { name: 'Promise Ring', sub: 'Solitaire blush diamond band', color: '#fde047' },
  { name: 'Star Ring', sub: 'Celestial star-cut sapphire setting', color: '#38bdf8' },
  { name: 'Forever Ring', sub: 'Infinity-twisted champagne gold band', color: '#c084fc' },
  { name: 'Y + H Ring', sub: 'Engraved "Y + H" inside the gold band', color: '#f472b6' },
] as const;

const _scratchTargetPos = new THREE.Vector3();

function createLabelCanvasTex(
  tracker: ResourceTracker,
  text: string,
  subtext?: string,
  bg = '#4a1026',
  fg = '#fde047',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = subtext ? 96 : 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (subtext) {
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(text, 128, 34);
      ctx.fillStyle = '#ffe4e6';
      ctx.font = 'italic 14px Georgia, serif';
      ctx.fillText(subtext, 128, 66);
    } else {
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText(text, 128, 32);
    }
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHandwrittenNoteTex(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 180);

    ctx.fillStyle = '#831843';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('"Still becoming', 128, 72);
    ctx.fillText('ours."', 128, 104);

    ctx.fillStyle = '#be185d';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillText('— Y + H ♡', 128, 148);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface FlightAnimState {
  active: boolean;
  kind: 'ring' | 'necklace' | 'crown';
  equipping: boolean;
  progress: number;
  startWorldPos: THREE.Vector3;
  endWorldPos: THREE.Vector3;
  mesh: THREE.Group;
}

export class CastleJewelleryAtelier {
  public readonly group = new THREE.Group();
  public readonly dynamicObjects = new Set<THREE.Object3D>();

  private readonly tracker: ResourceTracker;
  private readonly mats: DreamCastleMaterials;
  private readonly originX: number;
  private readonly baseY: number;
  private readonly originZ: number;
  private readonly y0: number;

  private avatarBridge: JewelleryAvatarBridge | null = null;
  private audioCtx: AudioContext | null = null;

  // Display meshes that hide when worn on the avatar and reappear when removed
  private readonly ringDisplayMeshes: THREE.Group[] = [];
  private readonly necklaceDisplayMeshes: THREE.Group[] = [];
  private crownDisplayGroup!: THREE.Group;

  // Selected indices on the tray/stands (0..4)
  private selectedRingIdx = 4; // Default to "Y + H Ring"
  private selectedNecklaceIdx = 0; // Default to "Two Hearts Necklace"

  // Animated try-on flight tokens
  private readonly flightTokens: FlightAnimState[] = [];
  private readonly flightGroup = new THREE.Group();

  // Status caption for HUD feedback
  private statusCaption: string | null = null;
  private statusTimer = 0.0;

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

    this.group.name = 'CastleJewelleryAtelier';
    this.flightGroup.name = 'JewelleryFlightTokens';
    this.group.add(this.flightGroup);
    this.dynamicObjects.add(this.flightGroup);

    this.buildCentralJewelleryIsland(colliders);
    this.buildHeroCrownPedestal(colliders);
    this.buildJewelleryMakerWorkbench(colliders);
    this.buildJewelleryBoxesAndMirror();
    this.initFlightTokens();
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
    // Sync initial crown display state with avatar tiara visibility
    const eq = bridge.getJewelleryEquipped();
    if (this.crownDisplayGroup) {
      this.crownDisplayGroup.visible = !eq.crownEquipped;
    }
  }

  private playJewelleryChime(allThree = false): void {
    try {
      if (!this.audioCtx && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const notes = allThree
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : [659.25, 880.0, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.08 + 0.55);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.6);
      });
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Section 13–17: Central Jewellery Island with:
   * - Pearl marble surface, champagne-gold trim, blush velvet inset, crystal supports, subtle under-lighting
   * - 5 Named 3D Necklaces on Velvet Busts
   * - 5 Named 3D Rings on Velvet Ring Tray (including "Y + H Ring")
   * - 5 Pairs of Earrings & 4 Bracelets on Display Supports
   */
  private buildCentralJewelleryIsland(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const islandX = 11.85;
    const islandZ = 0.15;

    const islandGroup = new THREE.Group();
    islandGroup.position.set(islandX, y0, islandZ);
    this.group.add(islandGroup);

    // Oval pearl marble base & top
    const basePlinthGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.95, 1.05, 0.78, 28));
    basePlinthGeo.scale(0.85, 1.0, 1.38);
    basePlinthGeo.translate(0, 0.39, 0);
    const basePlinth = new THREE.Mesh(basePlinthGeo, mats.pearlWhite);
    basePlinth.receiveShadow = true;

    // Subtle under-lighting glow ring
    const underGlowGeo = tracker.trackGeo(new THREE.TorusGeometry(0.98, 0.028, 8, 28));
    underGlowGeo.rotateX(Math.PI / 2);
    underGlowGeo.scale(0.85, 1.38, 1.0);
    underGlowGeo.translate(0, 0.03, 0);
    const underGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 1.25,
        roughness: 0.2,
      }),
    );

    // Champagne-gold rim & blush velvet top inset
    const topRimGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.04, 1.02, 0.06, 28));
    topRimGeo.scale(0.86, 1.0, 1.4);
    topRimGeo.translate(0, 0.81, 0);

    const velvetTopGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.96, 0.96, 0.03, 28));
    velvetTopGeo.scale(0.84, 1.0, 1.36);
    velvetTopGeo.translate(0, 0.845, 0);
    const blushVelvetMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#9d174d',
        roughness: 0.85,
        metalness: 0.05,
      }),
    );

    // 4 Crystal corner supports & glass vitrine canopy rail
    const crystalPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10));
    crystalPostGeo.translate(0, 1.02, 0);
    [
      [-0.62, -0.92],
      [0.62, -0.92],
      [-0.62, 0.92],
      [0.62, 0.92],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(crystalPostGeo, mats.crystalGlass);
      post.position.set(px, 0, pz);
      islandGroup.add(post);
    });

    const glassCoverGeo = tracker.trackGeo(new THREE.BoxGeometry(1.32, 0.025, 1.95));
    glassCoverGeo.translate(0, 1.2, 0);

    islandGroup.add(
      basePlinth,
      new THREE.Mesh(underGlowGeo, underGlowMat),
      new THREE.Mesh(topRimGeo, mats.champagneGold),
      new THREE.Mesh(velvetTopGeo, blushVelvetMat),
      new THREE.Mesh(glassCoverGeo, mats.crystalGlass),
    );

    // Shared jewellery micro-geometries
    const bustConeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.075, 0.17, 12));
    bustConeGeo.translate(0, 0.085, 0);
    const bustNeckGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.032, 0.042, 0.06, 10));
    bustNeckGeo.translate(0, 0.17, 0);
    const chainTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(0.048, 0.0045, 8, 18));
    chainTorusGeo.rotateX(Math.PI / 3);
    const heartSphereGeo = tracker.trackGeo(new THREE.SphereGeometry(0.014, 8, 8));
    const gemOctGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.018, 0));
    const ribbonLoopGeo = tracker.trackGeo(new THREE.TorusGeometry(0.018, 0.004, 6, 12));

    // 1. 5 PHYSICAL 3D NECKLACES ON VELVET BUSTS (Section 15)
    NECKLACE_DESIGNS.forEach((nd, idx) => {
      const zOff = (idx - 2) * 0.44;
      const bustGroup = new THREE.Group();
      bustGroup.position.set(-0.28, 0.86, zOff);
      bustGroup.rotation.y = -Math.PI / 2;

      const bustBase = new THREE.Mesh(bustConeGeo, blushVelvetMat);
      const bustNeck = new THREE.Mesh(bustNeckGeo, mats.champagneGold);
      bustGroup.add(bustBase, bustNeck);

      const necklacePiece = new THREE.Group();
      necklacePiece.position.set(0, 0.14, 0.01);
      const chain = new THREE.Mesh(chainTorusGeo, mats.champagneGold);
      const clasp = new THREE.Mesh(heartSphereGeo, mats.champagneGold);
      clasp.scale.setScalar(0.45);
      clasp.position.set(0, 0.025, -0.042);

      const pMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: nd.color,
          emissive: nd.color,
          emissiveIntensity: 0.65,
          roughness: 0.15,
          metalness: 0.25,
        }),
      );

      // Distinct pendant geometry per design
      const pendant = new THREE.Group();
      pendant.position.set(0, -0.022, 0.044);
      if (idx === 0 || idx === 4) {
        // Two Hearts / Our Heart
        const h1 = new THREE.Mesh(heartSphereGeo, pMat);
        h1.position.set(-0.008, 0, 0);
        const h2 = new THREE.Mesh(heartSphereGeo, mats.champagneGold);
        h2.position.set(0.008, 0.004, 0.004);
        pendant.add(h1, h2);
      } else if (idx === 1) {
        // Understanding Pendant (two curved pieces forming a heart)
        const c1 = new THREE.Mesh(ribbonLoopGeo, pMat);
        c1.position.set(-0.006, 0, 0);
        const c2 = new THREE.Mesh(ribbonLoopGeo, mats.champagneGold);
        c2.position.set(0.006, 0, 0);
        pendant.add(c1, c2);
      } else if (idx === 2) {
        // Playful Star
        const st = new THREE.Mesh(gemOctGeo, pMat);
        st.scale.set(1.2, 1.2, 0.5);
        pendant.add(st);
      } else {
        // Forever Ribbon looping around crystal
        const rb = new THREE.Mesh(ribbonLoopGeo, mats.champagneGold);
        const cr = new THREE.Mesh(gemOctGeo, pMat);
        cr.scale.setScalar(0.75);
        pendant.add(rb, cr);
      }

      necklacePiece.add(chain, clasp, pendant);
      bustGroup.add(necklacePiece);
      islandGroup.add(bustGroup);
      this.necklaceDisplayMeshes.push(necklacePiece);
      this.dynamicObjects.add(necklacePiece);
    });

    // 2. VELVET RING TRAY WITH 5 PHYSICAL 3D RINGS (Section 16)
    const ringTrayGroup = new THREE.Group();
    ringTrayGroup.position.set(0.28, 0.86, -0.35);
    const trayBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.36, 0.035, 0.72));
    trayBoxGeo.translate(0, 0.0175, 0);
    const trayTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(0.39, 0.025, 0.75));
    trayTrimGeo.translate(0, 0.0125, 0);
    ringTrayGroup.add(
      new THREE.Mesh(trayTrimGeo, mats.champagneGold),
      new THREE.Mesh(trayBoxGeo, blushVelvetMat),
    );

    const ringBandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.022, 0.0045, 8, 16));
    RING_DESIGNS.forEach((rd, idx) => {
      const rz = (idx - 2) * 0.13;
      const rGroup = new THREE.Group();
      rGroup.position.set(0, 0.048, rz);
      rGroup.rotation.y = -Math.PI / 2;

      const rMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: rd.color,
          emissive: rd.color,
          emissiveIntensity: 0.7,
          roughness: 0.12,
          metalness: 0.3,
        }),
      );
      const band = new THREE.Mesh(ringBandGeo, mats.champagneGold);
      const setting = new THREE.Mesh(gemOctGeo, rMat);
      setting.scale.setScalar(0.68);
      setting.position.set(0, 0.024, 0);
      rGroup.add(band, setting);

      ringTrayGroup.add(rGroup);
      this.ringDisplayMeshes.push(rGroup);
      this.dynamicObjects.add(rGroup);
    });

    // Tiny engraved plaque beside the Y + H Ring
    const yhPlaqueTex = createLabelCanvasTex(tracker, 'Y + H RING', 'Engraved Band');
    const yhPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.22, 0.08));
    yhPlaqueGeo.rotateX(-Math.PI / 2);
    yhPlaqueGeo.rotateZ(-Math.PI / 2);
    const yhPlaque = new THREE.Mesh(
      yhPlaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: yhPlaqueTex })),
    );
    yhPlaque.position.set(0.24, 0.02, 0.26);
    ringTrayGroup.add(yhPlaque);
    islandGroup.add(ringTrayGroup);

    // 3. EARRINGS (5 pairs) & BRACELETS (4 designs) ON DISPLAY SUPPORTS (Section 17)
    const earringStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 8));
    earringStandGeo.translate(0, 0.06, 0);
    const earringCrossGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8));
    earringCrossGeo.rotateX(Math.PI / 2);
    earringCrossGeo.translate(0, 0.11, 0);

    for (let e = 0; e < 5; e++) {
      const eStand = new THREE.Group();
      eStand.position.set(0.28, 0.86, 0.22 + e * 0.15);
      eStand.add(
        new THREE.Mesh(earringStandGeo, mats.champagneGold),
        new THREE.Mesh(earringCrossGeo, mats.champagneGold),
      );
      const dropL = new THREE.Mesh(gemOctGeo, mats.crystalGlass);
      dropL.scale.setScalar(0.55);
      dropL.position.set(0, 0.085, -0.026);
      const dropR = new THREE.Mesh(gemOctGeo, mats.crystalGlass);
      dropR.scale.setScalar(0.55);
      dropR.position.set(0, 0.085, 0.026);
      eStand.add(dropL, dropR);
      islandGroup.add(eStand);
    }

    // 4 Bracelets on velvet cylinder roll (Pearl, Charm, Crystal, Gold)
    const rollerGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.36, 12));
    rollerGeo.rotateX(Math.PI / 2);
    rollerGeo.translate(0, 0.9, 0.65);
    islandGroup.add(new THREE.Mesh(rollerGeo, blushVelvetMat));

    const braceletTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(0.04, 0.006, 8, 16));
    [-0.12, -0.04, 0.04, 0.12].forEach((bz, bIdx) => {
      const br = new THREE.Mesh(
        braceletTorusGeo,
        bIdx % 2 === 0 ? mats.champagneGold : mats.pearlWhite,
      );
      br.position.set(0, 0.9, 0.65 + bz);
      islandGroup.add(br);
    });

    colliders.push({
      x: this.originX + islandX,
      z: this.originZ + islandZ,
      radius: 1.15,
      y: this.baseY + y0,
      height: 3.5,
    });
  }

  /**
   * Section 18: Hero Piece — `Harsha's Crown` on Dedicated Illuminated Crystal Pedestal
   */
  private buildHeroCrownPedestal(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const pedX = 13.35;
    const pedZ = 1.65;

    const pedGroup = new THREE.Group();
    pedGroup.position.set(pedX, y0, pedZ);
    this.group.add(pedGroup);

    const colGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 0.98, 24));
    colGeo.translate(0, 0.49, 0);
    const cushionGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 20));
    cushionGeo.translate(0, 1.01, 0);
    const domeGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.3, 0.3, 0.42, 20, 1, false),
    );
    domeGeo.translate(0, 1.25, 0);

    const pinkGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.25,
      }),
    );

    // Plaque: "Harsha's Crown"
    const crownPlaqueTex = createLabelCanvasTex(
      tracker,
      "👑 HARSHA'S CROWN 👑",
      'Royal Heart & Starlight Filigree',
    );
    const plaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.46, 0.16));
    plaqueGeo.rotateY(-Math.PI / 2);
    const plaqueMesh = new THREE.Mesh(
      plaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: crownPlaqueTex })),
    );
    plaqueMesh.position.set(-0.36, 0.76, 0);

    pedGroup.add(
      new THREE.Mesh(colGeo, mats.pearlWhite),
      new THREE.Mesh(cushionGeo, mats.velvetPlum),
      new THREE.Mesh(domeGeo, mats.crystalGlass),
      plaqueMesh,
    );

    // Hero Crown 3D Model on Pedestal
    this.crownDisplayGroup = new THREE.Group();
    this.crownDisplayGroup.position.set(0, 1.08, 0);
    this.dynamicObjects.add(this.crownDisplayGroup);

    const bandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.015, 8, 24));
    bandGeo.rotateX(Math.PI / 2);
    this.crownDisplayGroup.add(new THREE.Mesh(bandGeo, mats.champagneGold));

    const peakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.025, 0.09, 6));
    const gemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.024, 0));
    const pearlGeo = tracker.trackGeo(new THREE.SphereGeometry(0.012, 8, 8));

    // 5 Major Crystal Points + Central Heart + Two Smaller Hearts + Pearl & Star Details
    for (let i = 0; i < 5; i++) {
      const ang = (i - 2) * 0.48 - Math.PI / 2;
      const isCenter = i === 2;
      const hScale = isCenter ? 1.45 : i === 1 || i === 3 ? 1.12 : 0.85;
      const px = Math.cos(ang) * 0.14;
      const pz = Math.sin(ang) * 0.14;

      const peak = new THREE.Mesh(peakGeo, mats.champagneGold);
      peak.scale.set(1, hScale, 1);
      peak.position.set(px, 0.045 * hScale, pz);

      const gem = new THREE.Mesh(gemGeo, pinkGlowMat);
      gem.scale.setScalar(isCenter ? 1.3 : 0.85);
      gem.position.set(px * 1.04, 0.09 * hScale, pz * 1.04);

      const pearl = new THREE.Mesh(pearlGeo, mats.pearlWhite);
      pearl.position.set(px * 1.05, 0.015, pz * 1.05);

      this.crownDisplayGroup.add(peak, gem, pearl);
    }

    pedGroup.add(this.crownDisplayGroup);

    colliders.push({
      x: this.originX + pedX,
      z: this.originZ + pedZ,
      radius: 0.46,
      y: this.baseY + y0,
      height: 3.5,
    });
  }

  /**
   * Sections 19–20: Jewellery Maker's Workbench, 6 Labeled Drawers, 19 Tools & Materials,
   * and the Special Unfinished Heart ("Still becoming ours.")
   */
  private buildJewelleryMakerWorkbench(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const wbX = 14.55;
    const wbZ = 3.8;

    const wbGroup = new THREE.Group();
    wbGroup.position.set(wbX, y0, wbZ);
    this.group.add(wbGroup);

    // 6 Labeled Drawers on Workbench Front: HEARTS, STARS, PEARLS, CRYSTALS, RIBBONS, CHARMS
    const drawerLabels = ['HEARTS', 'STARS', 'PEARLS', 'CRYSTALS', 'RIBBONS', 'CHARMS'];
    const drawerPlateGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.32, 0.09));
    drawerPlateGeo.rotateY(-Math.PI / 2);
    drawerLabels.forEach((lbl, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const tex = createLabelCanvasTex(tracker, lbl, undefined, '#500724', '#fde047');
      const mesh = new THREE.Mesh(
        drawerPlateGeo,
        tracker.trackMat(new THREE.MeshBasicMaterial({ map: tex })),
      );
      mesh.position.set(-0.38, 0.56 - row * 0.22, -0.44 + col * 0.44);
      wbGroup.add(mesh);
    });

    // Workbench Top Velvet Mat
    const matGeo = tracker.trackGeo(new THREE.BoxGeometry(0.52, 0.015, 0.92));
    matGeo.translate(-0.04, 0.75, 0.05);
    wbGroup.add(new THREE.Mesh(matGeo, mats.velvetPlum));

    // Section 20: SPECIAL UNFINISHED HEART (Two separate heart halves waiting to be joined) + Note "Still becoming ours."
    const heartHalfGeo = tracker.trackGeo(new THREE.SphereGeometry(0.032, 10, 10));
    heartHalfGeo.scale(1.2, 0.55, 0.85);
    const roseGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fda4af',
        emissive: '#f43f5e',
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.75,
      }),
    );
    const leftHalf = new THREE.Mesh(heartHalfGeo, roseGoldMat);
    leftHalf.position.set(-0.08, 0.77, 0.02);
    leftHalf.rotation.y = 0.28;
    const rightHalf = new THREE.Mesh(heartHalfGeo, mats.champagneGold);
    rightHalf.position.set(-0.08, 0.77, 0.11);
    rightHalf.rotation.y = -0.28;
    wbGroup.add(leftHalf, rightHalf);

    // Handwritten-style note: "Still becoming ours."
    const noteTex = createHandwrittenNoteTex(tracker);
    const noteGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.24, 0.18));
    noteGeo.rotateX(-Math.PI / 2);
    noteGeo.rotateZ(-Math.PI / 2 + 0.12);
    const noteMesh = new THREE.Mesh(
      noteGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: noteTex })),
    );
    noteMesh.position.set(-0.06, 0.762, 0.28);
    wbGroup.add(noteMesh);

    // Jeweller's Loupe, Magnifying Glass, Ring Mandrel, Spools of Gold/Silver Wire, Gemstone Tray & Tiny Scale
    const loupeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.024, 0.028, 0.035, 12));
    loupeGeo.translate(-0.14, 0.775, -0.18);
    const mandrelGeo = tracker.trackGeo(new THREE.ConeGeometry(0.018, 0.22, 12));
    mandrelGeo.rotateZ(Math.PI / 2);
    mandrelGeo.translate(0.08, 0.77, -0.12);
    const wireSpoolGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12));
    const goldSpool = new THREE.Mesh(wireSpoolGeo, mats.champagneGold);
    goldSpool.position.set(0.12, 0.78, 0.32);
    const silverSpool = new THREE.Mesh(wireSpoolGeo, mats.pearlWhite);
    silverSpool.position.set(0.12, 0.78, 0.42);
    wbGroup.add(
      new THREE.Mesh(loupeGeo, mats.champagneGold),
      new THREE.Mesh(mandrelGeo, mats.champagneGold),
      goldSpool,
      silverSpool,
    );

    colliders.push({
      x: this.originX + wbX,
      z: this.originZ + wbZ,
      radius: 0.55,
      y: this.baseY + y0,
      height: 3.5,
    });
  }

  /**
   * Section 21 & 26: Open/Closed Jewellery Boxes + Full-Height Jewellery Mirror with Hidden Heart behind Mirror
   */
  private buildJewelleryBoxesAndMirror(): void {
    const { tracker, mats, y0 } = this;

    // Jewellery Boxes on East Counter (lx = 14.8, lz = 0.2)
    const boxCounterGroup = new THREE.Group();
    boxCounterGroup.position.set(14.75, y0 + 1.21, 0.2);
    this.group.add(boxCounterGroup);

    const boxBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.055, 0.14));
    const boxLidGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.025, 0.14));
    const gemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.02, 0));

    // 1. Open velvet-lined box with ring inside
    const openRingBox = new THREE.Group();
    openRingBox.position.set(0, 0.028, -0.55);
    const lid1 = new THREE.Mesh(boxLidGeo, mats.blushRoseMarble);
    lid1.position.set(0.06, 0.06, 0);
    lid1.rotation.z = -1.1;
    const innerRing = new THREE.Mesh(gemGeo, mats.champagneGold);
    innerRing.position.set(0, 0.035, 0);
    openRingBox.add(new THREE.Mesh(boxBaseGeo, mats.velvetPlum), lid1, innerRing);

    // 2. Open box with necklace inside
    const openNeckBox = new THREE.Group();
    openNeckBox.position.set(0, 0.028, -0.18);
    const lid2 = new THREE.Mesh(boxLidGeo, mats.pearlWhite);
    lid2.position.set(0.06, 0.06, 0);
    lid2.rotation.z = -1.1;
    const innerNeck = new THREE.Mesh(gemGeo, mats.softLavender);
    innerNeck.position.set(0, 0.035, 0);
    openNeckBox.add(new THREE.Mesh(boxBaseGeo, mats.velvetPlum), lid2, innerNeck);

    // 3. Stacked keepsake boxes & tiny heart lock box
    const stackBox1 = new THREE.Mesh(boxBaseGeo, mats.champagneGold);
    stackBox1.position.set(0, 0.028, 0.25);
    const stackBox2 = new THREE.Mesh(boxBaseGeo, mats.blushRoseMarble);
    stackBox2.scale.setScalar(0.8);
    stackBox2.position.set(0, 0.075, 0.25);

    boxCounterGroup.add(openRingBox, openNeckBox, stackBox1, stackBox2);

    // Full-Height Jewellery Mirror at (lx = 14.45, lz = -3.8) + Subtle Hidden Heart Behind Mirror (Section 37)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(14.45, y0, -3.8);
    const mirrorGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.76, 1.72));
    mirrorGlassGeo.rotateY(-Math.PI / 2);
    mirrorGlassGeo.translate(-0.22, 0.96, 0);
    const mirrorReflectMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff1f2',
        roughness: 0.06,
        metalness: 0.92,
      }),
    );
    mirrorGroup.add(new THREE.Mesh(mirrorGlassGeo, mirrorReflectMat));

    // Hidden Heart Behind Mirror ("Y + H")
    const hiddenHeartTex = createLabelCanvasTex(
      tracker,
      '♡ Y + H ♡',
      'Hidden Forever in Our Castle',
      '#831843',
      '#fde047',
    );
    const hiddenHeartGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.34, 0.16));
    hiddenHeartGeo.rotateY(-Math.PI / 2);
    const hiddenHeartMesh = new THREE.Mesh(
      hiddenHeartGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: hiddenHeartTex })),
    );
    hiddenHeartMesh.position.set(-0.05, 0.96, 0);
    mirrorGroup.add(hiddenHeartMesh);

    this.group.add(mirrorGroup);
  }

  private initFlightTokens(): void {
    const { tracker, mats } = this;
    const tokenGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.045, 0));
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(0.055, 0.01, 8, 16));
    const glowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f472b6',
        emissiveIntensity: 1.8,
        roughness: 0.1,
        metalness: 0.3,
      }),
    );

    (['ring', 'necklace', 'crown'] as const).forEach((kind) => {
      const m = new THREE.Group();
      m.visible = false;
      m.add(new THREE.Mesh(tokenGeo, glowMat), new THREE.Mesh(ringGeo, mats.champagneGold));
      this.flightGroup.add(m);
      this.flightTokens.push({
        active: false,
        kind,
        equipping: true,
        progress: 0,
        startWorldPos: new THREE.Vector3(),
        endWorldPos: new THREE.Vector3(),
        mesh: m,
      });
    });
  }

  private startFlightToken(
    kind: 'ring' | 'necklace' | 'crown',
    equipping: boolean,
    standLocalX: number,
    standLocalY: number,
    standLocalZ: number,
  ): void {
    const token = this.flightTokens.find((t) => t.kind === kind);
    if (!token || !this.avatarBridge) return;

    const standWorld = new THREE.Vector3(
      this.originX + standLocalX,
      this.baseY + this.y0 + standLocalY,
      this.originZ + standLocalZ,
    );
    if (kind === 'ring') {
      this.avatarBridge.getRingAttachmentWorldPos(_scratchTargetPos);
    } else if (kind === 'necklace') {
      this.avatarBridge.getNecklaceAttachmentWorldPos(_scratchTargetPos);
    } else {
      this.avatarBridge.getCrownAttachmentWorldPos(_scratchTargetPos);
    }

    token.active = true;
    token.equipping = equipping;
    token.progress = 0.0;
    if (equipping) {
      token.startWorldPos.copy(standWorld);
      token.endWorldPos.copy(_scratchTargetPos);
    } else {
      token.startWorldPos.copy(_scratchTargetPos);
      token.endWorldPos.copy(standWorld);
    }
    token.mesh.visible = true;
  }

  public toggleRing(designIdx?: number): string {
    if (!this.avatarBridge) return '';
    if (designIdx !== undefined) {
      this.selectedRingIdx = ((designIdx % 5) + 5) % 5;
    }
    const eq = this.avatarBridge.getJewelleryEquipped();
    const isWearingThis = eq.ringIndex !== null && (designIdx === undefined || eq.ringIndex === this.selectedRingIdx);

    if (isWearingThis) {
      this.avatarBridge.setJewelleryEquipped({ ringIndex: null });
      this.ringDisplayMeshes.forEach((m) => (m.visible = true));
      this.startFlightToken('ring', false, 12.13, 0.92, -0.2);
      this.playJewelleryChime(false);
      this.statusCaption = `Removed ${RING_DESIGNS[this.selectedRingIdx].name} · Returned to Velvet Tray`;
    } else {
      this.avatarBridge.setJewelleryEquipped({ ringIndex: this.selectedRingIdx });
      this.ringDisplayMeshes.forEach((m, i) => (m.visible = i !== this.selectedRingIdx));
      this.startFlightToken('ring', true, 12.13, 0.92, -0.2);
      const after = this.avatarBridge.getJewelleryEquipped();
      this.playJewelleryChime(after.allThreeWorn);
      const rDef = RING_DESIGNS[this.selectedRingIdx];
      this.statusCaption = after.allThreeWorn
        ? `Wearing ${rDef.name} + Necklace + Harsha's Crown ✧ All Three Harmonized! 💕`
        : `Equipped ${rDef.name} (${rDef.sub}) ✧ Attached to Hand`;
    }
    this.statusTimer = 5.5;
    return this.statusCaption;
  }

  public toggleNecklace(designIdx?: number): string {
    if (!this.avatarBridge) return '';
    if (designIdx !== undefined) {
      this.selectedNecklaceIdx = ((designIdx % 5) + 5) % 5;
    }
    const eq = this.avatarBridge.getJewelleryEquipped();
    const isWearingThis =
      eq.necklaceIndex !== null &&
      (designIdx === undefined || eq.necklaceIndex === this.selectedNecklaceIdx);

    if (isWearingThis) {
      this.avatarBridge.setJewelleryEquipped({ necklaceIndex: null });
      this.necklaceDisplayMeshes.forEach((m) => (m.visible = true));
      this.startFlightToken('necklace', false, 11.57, 1.0, 0.15);
      this.playJewelleryChime(false);
      this.statusCaption = `Removed ${NECKLACE_DESIGNS[this.selectedNecklaceIdx].name} · Returned to Bust`;
    } else {
      this.avatarBridge.setJewelleryEquipped({ necklaceIndex: this.selectedNecklaceIdx });
      this.necklaceDisplayMeshes.forEach((m, i) => (m.visible = i !== this.selectedNecklaceIdx));
      this.startFlightToken('necklace', true, 11.57, 1.0, 0.15);
      const after = this.avatarBridge.getJewelleryEquipped();
      this.playJewelleryChime(after.allThreeWorn);
      const nDef = NECKLACE_DESIGNS[this.selectedNecklaceIdx];
      this.statusCaption = after.allThreeWorn
        ? `Wearing ${nDef.name} + Ring + Harsha's Crown ✧ All Three Harmonized! 💕`
        : `Equipped ${nDef.name} (${nDef.sub}) ✧ Attached to Neck`;
    }
    this.statusTimer = 5.5;
    return this.statusCaption;
  }

  public toggleCrown(): string {
    if (!this.avatarBridge) return '';
    const eq = this.avatarBridge.getJewelleryEquipped();
    const nextCrown = !eq.crownEquipped;
    this.avatarBridge.setJewelleryEquipped({ crownEquipped: nextCrown });
    if (this.crownDisplayGroup) {
      this.crownDisplayGroup.visible = !nextCrown;
    }
    this.startFlightToken('crown', nextCrown, 13.35, 1.15, 1.65);
    const after = this.avatarBridge.getJewelleryEquipped();
    this.playJewelleryChime(after.allThreeWorn);
    this.statusCaption = nextCrown
      ? after.allThreeWorn
        ? "Crowned with Harsha's Crown + Ring + Necklace ✧ All Three Harmonized! 💕"
        : "Equipped Harsha's Crown ✧ 5 Crystal Points & Heart Filigree"
      : "Removed Harsha's Crown · Returned to Illuminated Crystal Pedestal";
    this.statusTimer = 5.5;
    return this.statusCaption;
  }

  /**
   * Context-sensitive proximity prompt inside Room 2 (Jewellery Atelier / Couture Corner)
   */
  public getProximityPrompt(lx: number, lz: number, isInspecting: boolean): string {
    const eq = this.avatarBridge?.getJewelleryEquipped() ?? {
      ringIndex: null,
      necklaceIndex: null,
      crownEquipped: true,
      allThreeWorn: false,
    };
    const ringLabel = eq.ringIndex !== null ? 'REMOVE RING' : 'TRY RING';
    const neckLabel = eq.necklaceIndex !== null ? 'REMOVE NECKLACE' : 'TRY NECKLACE';
    const crownLabel = eq.crownEquipped ? 'REMOVE CROWN' : 'TRY CROWN';

    if (isInspecting) {
      return `Jewellery Atelier ✧ [1] ${ringLabel} · [2] ${neckLabel} · [3] ${crownLabel} · Drag/Touchpad 360° Look · [E] Step Back`;
    }

    // Near Harsha's Crown Pedestal (13.35, 1.65)
    if (Math.hypot(lx - 13.35, lz - 1.65) <= 1.35) {
      return `[E] ${crownLabel} (Harsha's Crown) · [1] Ring · [2] Necklace`;
    }
    // Near Workbench & Special Unfinished Heart (14.55, 3.8)
    if (Math.hypot(lx - 14.55, lz - 3.8) <= 1.45) {
      return `[E] Inspect Jewellery Workbench ("Still becoming ours." — Y + H)`;
    }
    // Near Ring Side of Central Island (lx >= 11.8, lz in [-1.2, 0.8])
    if (Math.hypot(lx - 12.2, lz - (-0.25)) <= 1.35) {
      return `[E] ${ringLabel} (${RING_DESIGNS[this.selectedRingIdx].name}) · [1-5] Select Ring`;
    }
    // Near Necklace Side of Central Island
    if (Math.hypot(lx - 11.5, lz - 0.15) <= 1.45) {
      return `[E] ${neckLabel} (${NECKLACE_DESIGNS[this.selectedNecklaceIdx].name}) · [1-5] Select Necklace`;
    }
    return `[E] Jewellery Atelier Try-On · [1] ${ringLabel} · [2] ${neckLabel} · [3] ${crownLabel}`;
  }

  public interactAtPosition(lx: number, lz: number): { enterInspect: boolean; caption: string } {
    // Direct spatial interaction with Crown Pedestal, Ring Tray, or Necklace Busts!
    if (Math.hypot(lx - 13.35, lz - 1.65) <= 1.35) {
      const cap = this.toggleCrown();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 12.2, lz - (-0.25)) <= 1.25) {
      const cap = this.toggleRing();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 11.5, lz - 0.15) <= 1.25) {
      const cap = this.toggleNecklace();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 14.55, lz - 3.8) <= 1.45) {
      this.statusCaption = 'Jewellery Workbench ✧ Two Heart Halves: "Still becoming ours." — Y + H';
      this.statusTimer = 6.0;
      return { enterInspect: true, caption: this.statusCaption };
    }
    return {
      enterInspect: true,
      caption:
        this.statusCaption ??
        "Harsha's Jewellery Atelier ✧ [1] Try/Remove Ring · [2] Try/Remove Necklace · [3] Try/Remove Crown",
    };
  }

  public getStatusCaption(): string | null {
    return this.statusTimer > 0 ? this.statusCaption : null;
  }

  public update(delta: number, clockTime: number): void {
    if (this.statusTimer > 0) {
      this.statusTimer = Math.max(0, this.statusTimer - delta);
    }

    if (this.crownDisplayGroup && this.crownDisplayGroup.visible) {
      this.crownDisplayGroup.rotation.y = clockTime * 0.65;
    }

    // Update animated try-on flight tokens
    for (let i = 0; i < this.flightTokens.length; i++) {
      const t = this.flightTokens[i];
      if (!t.active) continue;

      t.progress = Math.min(1.0, t.progress + delta * 2.1);
      const u = t.progress * t.progress * (3.0 - 2.0 * t.progress);

      // Update live avatar target if equipping
      if (t.equipping && this.avatarBridge) {
        if (t.kind === 'ring') {
          this.avatarBridge.getRingAttachmentWorldPos(t.endWorldPos);
        } else if (t.kind === 'necklace') {
          this.avatarBridge.getNecklaceAttachmentWorldPos(t.endWorldPos);
        } else {
          this.avatarBridge.getCrownAttachmentWorldPos(t.endWorldPos);
        }
      }

      const wx = THREE.MathUtils.lerp(t.startWorldPos.x, t.endWorldPos.x, u);
      const wy =
        THREE.MathUtils.lerp(t.startWorldPos.y, t.endWorldPos.y, u) +
        Math.sin(u * Math.PI) * 0.38;
      const wz = THREE.MathUtils.lerp(t.startWorldPos.z, t.endWorldPos.z, u);

      t.mesh.position.set(wx - this.originX, wy - this.baseY, wz - this.originZ);
      t.mesh.rotation.y = clockTime * 5.0;

      if (t.progress >= 1.0) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
  }
}
