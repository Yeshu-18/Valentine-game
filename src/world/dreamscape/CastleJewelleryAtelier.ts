import * as THREE from 'three';
import { AvatarActivityPose } from '../PlayerCharacter';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export type CinematicStatePhase =
  | 'EXPLORATION'
  | 'CINEMATIC_ENTER'
  | 'CINEMATIC_ESTABLISH'
  | 'CINEMATIC_DISCOVER'
  | 'CINEMATIC_INTERACTION'
  | 'CINEMATIC_PRESENT'
  | 'CINEMATIC_REVEAL'
  | 'CINEMATIC_RELEASE';

export type JewelleryCinematicKind =
  | 'none'
  | 'yh_ring'
  | 'ring'
  | 'necklace'
  | 'crown_and_mirror'
  | 'mirror_only'
  | 'combination';

export interface JewelleryCinematicCameraOutput {
  active: boolean;
  phase: CinematicStatePhase;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  fov: number;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
}

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
  setRaisingHand?: (raising: boolean) => void;
  setRoseHeld?: (held: boolean) => void;
  isRoseHeld?: () => boolean;
  setActivityPose?: (pose: AvatarActivityPose) => void;
  resetNeutralPose?: () => void;
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
  { name: 'Y + H Ring', sub: 'Engraved "Y ♥ H" inside the gold band', color: '#f472b6' },
] as const;

const _scratchTargetPos = new THREE.Vector3();
const _scratchHandPos = new THREE.Vector3();
const _scratchNeckPos = new THREE.Vector3();
const _scratchCrownPos = new THREE.Vector3();

function easeInOutCubic(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeInOutSine(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

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
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createInnerBandEngravingTex(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#b45309');
    grad.addColorStop(0.5, '#fde047');
    grad.addColorStop(1, '#b45309');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 64);

    ctx.fillStyle = '#4a1026';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Y  ♥  H', 128, 33);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createInitialEmblemTex(tracker: ResourceTracker, letter: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#831843';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 32, 34);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
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
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface FlightAnimState {
  active: boolean;
  kind: 'ring' | 'necklace' | 'crown';
  equipping: boolean;
  progress: number;
  duration: number;
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

  // Mirrored avatar reflection inside the Full-Height Jewellery Mirror (Section 11)
  private mirrorReflectionGroup!: THREE.Group;
  private mirrorReflCrown!: THREE.Group;
  private mirrorReflNecklace!: THREE.Mesh;
  private mirrorReflRing!: THREE.Mesh;

  // Pedestal & room focus light for Phase 1 Room Response
  private pedestalFocusLight!: THREE.PointLight;
  private comboLightOrb!: THREE.Group;

  // Selected indices on the tray/stands (0..4)
  private selectedRingIdx = 4; // Default to "Y + H Ring"
  private selectedNecklaceIdx = 0; // Default to "Two Hearts Necklace"

  // Animated try-on flight tokens
  private readonly flightTokens: FlightAnimState[] = [];
  private readonly flightGroup = new THREE.Group();

  // Centralized Romantic Cinematic State Machine (Sections 1-12, 22-23)
  private cinematicKind: JewelleryCinematicKind = 'none';
  private cinematicPhase: CinematicStatePhase = 'EXPLORATION';
  private cinematicElapsed = 0.0;
  private cinematicTotalDuration = 0.0;
  private pendingChainCombination = false;
  private pendingEquipResolved = false;

  private readonly cinCamPos = new THREE.Vector3();
  private readonly cinLookPos = new THREE.Vector3();
  private readonly cinSeatPos = new THREE.Vector3();
  private cinSeatYaw = 0.0;
  private cinFov = 52.0;

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

    this.pedestalFocusLight = new THREE.PointLight('#fef08a', 0.85, 6.5, 1.6);
    this.pedestalFocusLight.position.set(12.1, y0 + 1.65, 0.15);
    this.group.add(this.pedestalFocusLight);

    this.buildCentralJewelleryIsland(colliders);
    this.buildHeroCrownPedestal(colliders);
    this.buildJewelleryMakerWorkbench(colliders);
    this.buildJewelleryBoxesAndMirror();
    this.initFlightTokens();
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
    const eq = bridge.getJewelleryEquipped();
    if (this.crownDisplayGroup) {
      this.crownDisplayGroup.visible = !eq.crownEquipped;
    }
    this.syncMirrorReflection();
  }

  private syncMirrorReflection(): void {
    if (!this.avatarBridge || !this.mirrorReflectionGroup) return;
    const eq = this.avatarBridge.getJewelleryEquipped();
    if (this.mirrorReflCrown) this.mirrorReflCrown.visible = eq.crownEquipped;
    if (this.mirrorReflNecklace) this.mirrorReflNecklace.visible = eq.necklaceIndex !== null;
    if (this.mirrorReflRing) this.mirrorReflRing.visible = eq.ringIndex !== null;
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
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.001, now + idx * 0.11);
        gain.gain.linearRampToValueAtTime(0.055, now + idx * 0.11 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.11 + 0.65);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.7);
      });
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Section 13–17: Central Jewellery Island with:
   * - Pearl marble surface, champagne-gold trim, blush velvet inset, crystal supports, subtle under-lighting
   * - 5 Named 3D Necklaces on Velvet Busts
   * - 5 Named 3D Rings on Velvet Ring Tray (including "Y + H Ring" with Y and H emblems + "Y ♥ H" inner engraving)
   * - 5 Pairs of Earrings & 4 Bracelets on Display Supports
   */
  private buildCentralJewelleryIsland(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const islandX = 11.85;
    const islandZ = 0.15;

    const islandGroup = new THREE.Group();
    islandGroup.position.set(islandX, y0, islandZ);
    this.group.add(islandGroup);

    const basePlinthGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.95, 1.05, 0.78, 28));
    basePlinthGeo.scale(0.85, 1.0, 1.38);
    basePlinthGeo.translate(0, 0.39, 0);
    const basePlinth = new THREE.Mesh(basePlinthGeo, mats.pearlWhite);
    basePlinth.receiveShadow = true;

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

      const pendant = new THREE.Group();
      pendant.position.set(0, -0.022, 0.044);
      if (idx === 0 || idx === 4) {
        const h1 = new THREE.Mesh(heartSphereGeo, pMat);
        h1.position.set(-0.008, 0, 0);
        const h2 = new THREE.Mesh(heartSphereGeo, mats.champagneGold);
        h2.position.set(0.008, 0.004, 0.004);
        pendant.add(h1, h2);
      } else if (idx === 1) {
        const c1 = new THREE.Mesh(ribbonLoopGeo, pMat);
        c1.position.set(-0.006, 0, 0);
        const c2 = new THREE.Mesh(ribbonLoopGeo, mats.champagneGold);
        c2.position.set(0.006, 0, 0);
        pendant.add(c1, c2);
      } else if (idx === 2) {
        const st = new THREE.Mesh(gemOctGeo, pMat);
        st.scale.set(1.2, 1.2, 0.5);
        pendant.add(st);
      } else {
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

    // 2. VELVET RING TRAY WITH 5 PHYSICAL 3D RINGS (Section 16 & Section 7 Y + H Ring Details)
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

    const ringBandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.028, 0.0055, 10, 24));
    const innerEngraveGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.036, 0.011));
    const emblemDiscGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.018, 0.018));
    const yEmblemTex = createInitialEmblemTex(tracker, 'Y');
    const hEmblemTex = createInitialEmblemTex(tracker, 'H');
    const innerEngraveTex = createInnerBandEngravingTex(tracker);
    const yEmblemMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: yEmblemTex, side: THREE.FrontSide }),
    );
    const hEmblemMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: hEmblemTex, side: THREE.FrontSide }),
    );
    const innerEngraveMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: innerEngraveTex, side: THREE.FrontSide }),
    );

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
      setting.scale.setScalar(0.72);
      setting.position.set(0, 0.029, 0);
      rGroup.add(band, setting);

      // Section 7: Physical 'Y', 'H', and inner-band 'Y ♥ H' engraving on the Y + H Ring (idx === 4)
      // Uses FrontSide on both +Z (facing West) and -Z (rotation.y = Math.PI, facing East macro camera)
      if (idx === 4) {
        const yCrestFront = new THREE.Mesh(emblemDiscGeo, yEmblemMat);
        yCrestFront.position.set(-0.024, 0.016, 0.007);
        yCrestFront.rotation.y = -0.35;

        const hCrestFront = new THREE.Mesh(emblemDiscGeo, hEmblemMat);
        hCrestFront.position.set(0.024, 0.016, 0.007);
        hCrestFront.rotation.y = 0.35;

        const yCrestMacro = new THREE.Mesh(emblemDiscGeo, yEmblemMat);
        yCrestMacro.position.set(0.024, 0.016, -0.007);
        yCrestMacro.rotation.y = Math.PI - 0.35;

        const hCrestMacro = new THREE.Mesh(emblemDiscGeo, hEmblemMat);
        hCrestMacro.position.set(-0.024, 0.016, -0.007);
        hCrestMacro.rotation.y = Math.PI + 0.35;

        const innerBandFront = new THREE.Mesh(innerEngraveGeo, innerEngraveMat);
        innerBandFront.position.set(0, -0.016, 0.005);

        const innerBandMacro = new THREE.Mesh(innerEngraveGeo, innerEngraveMat);
        innerBandMacro.position.set(0, -0.016, -0.005);
        innerBandMacro.rotation.y = Math.PI;

        rGroup.add(
          yCrestFront,
          hCrestFront,
          yCrestMacro,
          hCrestMacro,
          innerBandFront,
          innerBandMacro,
        );
      }

      ringTrayGroup.add(rGroup);
      this.ringDisplayMeshes.push(rGroup);
      this.dynamicObjects.add(rGroup);
    });

    const yhPlaqueTex = createLabelCanvasTex(tracker, 'Y + H RING', 'Engraved "Y ♥ H" Band');
    const yhPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.22, 0.08));
    yhPlaqueGeo.rotateX(-Math.PI / 2);
    yhPlaqueGeo.rotateZ(-Math.PI / 2);
    const yhPlaque = new THREE.Mesh(
      yhPlaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: yhPlaqueTex, side: THREE.FrontSide })),
    );
    yhPlaque.position.set(0.24, 0.02, 0.26);
    ringTrayGroup.add(yhPlaque);
    islandGroup.add(ringTrayGroup);

    // 3. EARRINGS & BRACELETS ON DISPLAY SUPPORTS (Section 17)
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

    const crownPlaqueTex = createLabelCanvasTex(
      tracker,
      "👑 HARSHA'S CROWN 👑",
      'Royal Heart & Starlight Filigree',
    );
    const plaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.46, 0.16));
    plaqueGeo.rotateY(-Math.PI / 2);
    const plaqueMesh = new THREE.Mesh(
      plaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: crownPlaqueTex, side: THREE.FrontSide })),
    );
    plaqueMesh.position.set(-0.36, 0.76, 0);

    pedGroup.add(
      new THREE.Mesh(colGeo, mats.pearlWhite),
      new THREE.Mesh(cushionGeo, mats.velvetPlum),
      new THREE.Mesh(domeGeo, mats.crystalGlass),
      plaqueMesh,
    );

    this.crownDisplayGroup = new THREE.Group();
    this.crownDisplayGroup.position.set(0, 1.08, 0);
    this.dynamicObjects.add(this.crownDisplayGroup);

    const bandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.14, 0.015, 8, 24));
    bandGeo.rotateX(Math.PI / 2);
    this.crownDisplayGroup.add(new THREE.Mesh(bandGeo, mats.champagneGold));

    const peakGeo = tracker.trackGeo(new THREE.ConeGeometry(0.025, 0.09, 6));
    const gemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.024, 0));
    const pearlGeo = tracker.trackGeo(new THREE.SphereGeometry(0.012, 8, 8));

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
   * Sections 19–20: Jewellery Maker's Workbench, 6 Labeled Drawers, Tools & Materials,
   * and the Special Unfinished Heart ("Still becoming ours.")
   */
  private buildJewelleryMakerWorkbench(colliders: CircleCollider[]): void {
    const { tracker, mats, y0 } = this;
    const wbX = 14.55;
    const wbZ = 3.8;

    const wbGroup = new THREE.Group();
    wbGroup.position.set(wbX, y0, wbZ);
    this.group.add(wbGroup);

    const drawerLabels = ['HEARTS', 'STARS', 'PEARLS', 'CRYSTALS', 'RIBBONS', 'CHARMS'];
    const drawerPlateGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.32, 0.09));
    drawerPlateGeo.rotateY(-Math.PI / 2);
    drawerLabels.forEach((lbl, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const tex = createLabelCanvasTex(tracker, lbl, undefined, '#500724', '#fde047');
      const mesh = new THREE.Mesh(
        drawerPlateGeo,
        tracker.trackMat(new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide })),
      );
      mesh.position.set(-0.38, 0.56 - row * 0.22, -0.44 + col * 0.44);
      wbGroup.add(mesh);
    });

    const matGeo = tracker.trackGeo(new THREE.BoxGeometry(0.52, 0.015, 0.92));
    matGeo.translate(-0.04, 0.75, 0.05);
    wbGroup.add(new THREE.Mesh(matGeo, mats.velvetPlum));

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

    const noteTex = createHandwrittenNoteTex(tracker);
    const noteGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.24, 0.18));
    noteGeo.rotateX(-Math.PI / 2);
    noteGeo.rotateZ(-Math.PI / 2 + 0.12);
    const noteMesh = new THREE.Mesh(
      noteGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: noteTex, side: THREE.FrontSide })),
    );
    noteMesh.position.set(-0.06, 0.762, 0.28);
    wbGroup.add(noteMesh);

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
   * Section 21, 26 & Section 11: Open/Closed Jewellery Boxes + Full-Height Jewellery Mirror
   * with live Reflected Avatar Silhouette & Hidden Heart Behind Mirror
   */
  private buildJewelleryBoxesAndMirror(): void {
    const { tracker, mats, y0 } = this;

    const boxCounterGroup = new THREE.Group();
    boxCounterGroup.position.set(14.75, y0 + 1.21, 0.2);
    this.group.add(boxCounterGroup);

    const boxBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.055, 0.14));
    const boxLidGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.025, 0.14));
    const gemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.02, 0));

    const openRingBox = new THREE.Group();
    openRingBox.position.set(0, 0.028, -0.55);
    const lid1 = new THREE.Mesh(boxLidGeo, mats.blushRoseMarble);
    lid1.position.set(0.06, 0.06, 0);
    lid1.rotation.z = -1.1;
    const innerRing = new THREE.Mesh(gemGeo, mats.champagneGold);
    innerRing.position.set(0, 0.035, 0);
    openRingBox.add(new THREE.Mesh(boxBaseGeo, mats.velvetPlum), lid1, innerRing);

    const openNeckBox = new THREE.Group();
    openNeckBox.position.set(0, 0.028, -0.18);
    const lid2 = new THREE.Mesh(boxLidGeo, mats.pearlWhite);
    lid2.position.set(0.06, 0.06, 0);
    lid2.rotation.z = -1.1;
    const innerNeck = new THREE.Mesh(gemGeo, mats.softLavender);
    innerNeck.position.set(0, 0.035, 0);
    openNeckBox.add(new THREE.Mesh(boxBaseGeo, mats.velvetPlum), lid2, innerNeck);

    const stackBox1 = new THREE.Mesh(boxBaseGeo, mats.champagneGold);
    stackBox1.position.set(0, 0.028, 0.25);
    const stackBox2 = new THREE.Mesh(boxBaseGeo, mats.blushRoseMarble);
    stackBox2.scale.setScalar(0.8);
    stackBox2.position.set(0, 0.075, 0.25);

    boxCounterGroup.add(openRingBox, openNeckBox, stackBox1, stackBox2);

    // Full-Height Jewellery Mirror at (lx = 14.45, lz = -3.8)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(14.45, y0, -3.8);
    const mirrorGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.76, 1.72));
    mirrorGlassGeo.rotateY(-Math.PI / 2);
    mirrorGlassGeo.translate(-0.22, 0.96, 0);
    const mirrorReflectMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff1f2',
        roughness: 0.08,
        metalness: 0.85,
        transparent: true,
        opacity: 0.62,
      }),
    );
    mirrorGroup.add(new THREE.Mesh(mirrorGlassGeo, mirrorReflectMat));

    // Section 11: Mirrored Reflection Figure visible inside the mirror glass during Mirror Cinematic
    this.mirrorReflectionGroup = new THREE.Group();
    this.mirrorReflectionGroup.position.set(0.12, 0.0, 0.0);
    this.mirrorReflectionGroup.rotation.y = -Math.PI / 2; // Faces West out of the mirror toward Harsha

    const reflSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 0.88, 14));
    reflSkirtGeo.translate(0, 0.44, 0);
    const reflTorsoGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.12, 0.46, 12));
    reflTorsoGeo.translate(0, 1.06, 0);
    const reflHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.15, 12, 12));
    reflHeadGeo.translate(0, 1.46, 0);
    const reflDressMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f472b6',
        emissive: '#db2777',
        emissiveIntensity: 0.25,
        roughness: 0.35,
      }),
    );
    const reflGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f472b6',
        emissiveIntensity: 1.5,
        roughness: 0.1,
      }),
    );

    this.mirrorReflCrown = new THREE.Group();
    this.mirrorReflCrown.position.set(0, 1.62, 0.02);
    const reflCrownBandGeo = tracker.trackGeo(new THREE.TorusGeometry(0.09, 0.012, 8, 16));
    reflCrownBandGeo.rotateX(Math.PI / 2);
    const reflCrownGem = new THREE.Mesh(gemGeo, reflGlowMat);
    reflCrownGem.position.set(0, 0.04, 0.09);
    this.mirrorReflCrown.add(
      new THREE.Mesh(reflCrownBandGeo, mats.champagneGold),
      reflCrownGem,
    );

    const reflNeckGeo = tracker.trackGeo(new THREE.TorusGeometry(0.09, 0.009, 8, 16));
    reflNeckGeo.rotateX(Math.PI / 3);
    this.mirrorReflNecklace = new THREE.Mesh(reflNeckGeo, reflGlowMat);
    this.mirrorReflNecklace.position.set(0, 1.24, 0.06);

    this.mirrorReflRing = new THREE.Mesh(gemGeo, reflGlowMat);
    this.mirrorReflRing.position.set(-0.18, 0.92, 0.12);

    this.mirrorReflectionGroup.add(
      new THREE.Mesh(reflSkirtGeo, reflDressMat),
      new THREE.Mesh(reflTorsoGeo, reflDressMat),
      new THREE.Mesh(reflHeadGeo, mats.pearlWhite),
      this.mirrorReflCrown,
      this.mirrorReflNecklace,
      this.mirrorReflRing,
    );
    mirrorGroup.add(this.mirrorReflectionGroup);

    // Hidden Heart on Lower Mirror Crest ("♡ Y + H ♡") + Upper Mirror Inscription ("I LOVE YOU ♡", Section 15 & 22)
    const hiddenHeartTex = createLabelCanvasTex(
      tracker,
      '♡ Y + H ♡',
      'Hidden Forever in Our Castle',
      '#831843',
      '#fde047',
    );
    const hiddenHeartGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.36, 0.15));
    hiddenHeartGeo.rotateY(-Math.PI / 2);
    const hiddenHeartMesh = new THREE.Mesh(
      hiddenHeartGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: hiddenHeartTex, side: THREE.FrontSide })),
    );
    hiddenHeartMesh.position.set(-0.226, 0.28, 0);

    const mirrorCornerLoveTex = createLabelCanvasTex(
      tracker,
      'I LOVE YOU ♡',
      undefined,
      '#4a1026',
      '#fde047',
    );
    const mirrorCornerLoveGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.38, 0.105));
    mirrorCornerLoveGeo.rotateY(-Math.PI / 2);
    const mirrorCornerLoveMesh = new THREE.Mesh(
      mirrorCornerLoveGeo,
      tracker.trackMat(
        new THREE.MeshBasicMaterial({ map: mirrorCornerLoveTex, side: THREE.FrontSide }),
      ),
    );
    mirrorCornerLoveMesh.position.set(-0.228, 1.62, 0.0);
    mirrorGroup.add(hiddenHeartMesh, mirrorCornerLoveMesh);

    this.group.add(mirrorGroup);
  }

  private initFlightTokens(): void {
    const { tracker, mats } = this;
    const tokenGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.036, 0));
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(0.045, 0.008, 10, 20));
    const glowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f472b6',
        emissiveIntensity: 1.6,
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
        duration: 1.8,
        startWorldPos: new THREE.Vector3(),
        endWorldPos: new THREE.Vector3(),
        mesh: m,
      });
    });

    // Section 12: Subtle Warm Light Orb for Jewellery Combination Cinematic (Ring -> Necklace -> Crown)
    this.comboLightOrb = new THREE.Group();
    this.comboLightOrb.visible = false;
    const orbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.032, 12, 12));
    const haloGeo = tracker.trackGeo(new THREE.TorusGeometry(0.052, 0.005, 8, 20));
    this.comboLightOrb.add(
      new THREE.Mesh(orbGeo, glowMat),
      new THREE.Mesh(haloGeo, mats.champagneGold),
    );
    this.flightGroup.add(this.comboLightOrb);
  }

  private startFlightToken(
    kind: 'ring' | 'necklace' | 'crown',
    equipping: boolean,
    standLocalX: number,
    standLocalY: number,
    standLocalZ: number,
    duration = 1.9,
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
    token.duration = duration;
    if (equipping) {
      token.startWorldPos.copy(standWorld);
      token.endWorldPos.copy(_scratchTargetPos);
    } else {
      token.startWorldPos.copy(_scratchTargetPos);
      token.endWorldPos.copy(standWorld);
    }
    token.mesh.visible = true;
  }

  /**
   * Starts a directed, slow, story-driven romantic jewellery cinematic (Sections 4, 7-12).
   */
  private beginJewelleryCinematic(
    kind: JewelleryCinematicKind,
    duration: number,
    chainCombination: boolean,
  ): void {
    this.cinematicKind = kind;
    this.cinematicPhase = 'CINEMATIC_ENTER';
    this.cinematicElapsed = 0.0;
    this.cinematicTotalDuration = duration;
    this.pendingChainCombination = chainCombination;
    this.pendingEquipResolved = false;
  }

  public isCinematicActive(): boolean {
    return this.cinematicKind !== 'none' && this.cinematicPhase !== 'EXPLORATION';
  }

  /**
   * Section 21: `[E] Continue` advances to the next major emotional phase or completes cleanly.
   */
  public advanceOrContinueCinematic(): boolean {
    if (!this.isCinematicActive()) return false;
    const nextJump = Math.min(
      this.cinematicTotalDuration,
      this.cinematicElapsed + Math.max(2.2, this.cinematicTotalDuration * 0.25),
    );
    if (nextJump >= this.cinematicTotalDuration - 0.15) {
      this.skipCinematic();
    } else {
      this.cinematicElapsed = nextJump;
    }
    return true;
  }

  /**
   * Section 21 & 23: Safe Interruption / Skip Cinematic (`[Space]` or `[Esc]`)
   * Immediately resolves all attachment states, restores display meshes, clears hand poses,
   * and returns camera ownership to Exploration.
   */
  public skipCinematic(): boolean {
    if (!this.isCinematicActive()) return false;

    // Resolve any pending equip state immediately
    this.resolvePendingJewelleryState();
    this.avatarBridge?.setRaisingHand?.(false);
    this.comboLightOrb.visible = false;
    this.flightTokens.forEach((ft) => {
      ft.active = false;
      ft.mesh.visible = false;
    });
    this.ringDisplayMeshes.forEach((m, idx) => {
      const eq = this.avatarBridge?.getJewelleryEquipped();
      m.position.y = 0.048;
      m.rotation.set(0, -Math.PI / 2, 0);
      m.visible = eq?.ringIndex !== idx;
    });
    this.necklaceDisplayMeshes.forEach((m, idx) => {
      const eq = this.avatarBridge?.getJewelleryEquipped();
      m.position.y = 0.14;
      m.visible = eq?.necklaceIndex !== idx;
    });
    if (this.crownDisplayGroup) {
      const eq = this.avatarBridge?.getJewelleryEquipped();
      this.crownDisplayGroup.position.y = 1.08;
      this.crownDisplayGroup.visible = !eq?.crownEquipped;
    }
    this.syncMirrorReflection();

    this.cinematicKind = 'none';
    this.cinematicPhase = 'EXPLORATION';
    this.cinematicElapsed = 0.0;
    this.pendingChainCombination = false;
    this.pedestalFocusLight.intensity = 0.85;
    return true;
  }

  private resolvePendingJewelleryState(): void {
    if (this.pendingEquipResolved || !this.avatarBridge) return;
    this.pendingEquipResolved = true;

    if (this.cinematicKind === 'yh_ring' || this.cinematicKind === 'ring') {
      this.avatarBridge.setJewelleryEquipped({ ringIndex: this.selectedRingIdx });
      this.ringDisplayMeshes.forEach((m, i) => {
        m.position.y = 0.048;
        m.visible = i !== this.selectedRingIdx;
      });
    } else if (this.cinematicKind === 'necklace') {
      this.avatarBridge.setJewelleryEquipped({ necklaceIndex: this.selectedNecklaceIdx });
      this.necklaceDisplayMeshes.forEach((m, i) => {
        m.position.y = 0.14;
        m.visible = i !== this.selectedNecklaceIdx;
      });
    } else if (this.cinematicKind === 'crown_and_mirror') {
      this.avatarBridge.setJewelleryEquipped({ crownEquipped: true });
      if (this.crownDisplayGroup) {
        this.crownDisplayGroup.position.y = 1.08;
        this.crownDisplayGroup.visible = false;
      }
    }
    this.syncMirrorReflection();
  }

  public toggleRing(designIdx?: number): string {
    if (!this.avatarBridge) return '';
    if (designIdx !== undefined) {
      this.selectedRingIdx = ((designIdx % 5) + 5) % 5;
    }
    const eq = this.avatarBridge.getJewelleryEquipped();
    const isWearingThis =
      eq.ringIndex !== null && (designIdx === undefined || eq.ringIndex === this.selectedRingIdx);

    if (isWearingThis) {
      this.skipCinematic();
      this.avatarBridge.setJewelleryEquipped({ ringIndex: null });
      this.ringDisplayMeshes.forEach((m) => {
        m.position.y = 0.048;
        m.visible = true;
      });
      this.startFlightToken('ring', false, 12.13, 0.92, -0.2, 1.4);
      this.playJewelleryChime(false);
      this.syncMirrorReflection();
      this.statusCaption = `Removed ${RING_DESIGNS[this.selectedRingIdx].name} · Gently Returned to Velvet Tray`;
      this.statusTimer = 5.5;
      return this.statusCaption;
    }

    const rDef = RING_DESIGNS[this.selectedRingIdx];
    const willBeAllThree = eq.necklaceIndex !== null && eq.crownEquipped;
    this.playJewelleryChime(willBeAllThree);

    if (this.selectedRingIdx === 4) {
      // Section 7: Extended 15.6s Y + H Ring Cinematic
      this.beginJewelleryCinematic('yh_ring', 15.6, willBeAllThree);
      this.statusCaption =
        'Y + H Ring ✧ Discovering the Engraved "Y ♥ H" Band — Made for Harsha… ([E] Continue · [Space] Skip)';
      this.statusTimer = 15.6;
    } else {
      this.beginJewelleryCinematic('ring', 10.5, willBeAllThree);
      this.statusCaption = `Trying On ${rDef.name} (${rDef.sub}) ✧ ([E] Continue · [Space] Skip)`;
      this.statusTimer = 10.5;
    }
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
      this.skipCinematic();
      this.avatarBridge.setJewelleryEquipped({ necklaceIndex: null });
      this.necklaceDisplayMeshes.forEach((m) => {
        m.position.y = 0.14;
        m.visible = true;
      });
      this.startFlightToken('necklace', false, 11.57, 1.0, 0.15, 1.4);
      this.playJewelleryChime(false);
      this.syncMirrorReflection();
      this.statusCaption = `Removed ${NECKLACE_DESIGNS[this.selectedNecklaceIdx].name} · Returned to Velvet Bust`;
      this.statusTimer = 5.5;
      return this.statusCaption;
    }

    const nDef = NECKLACE_DESIGNS[this.selectedNecklaceIdx];
    const willBeAllThree = eq.ringIndex !== null && eq.crownEquipped;
    this.playJewelleryChime(willBeAllThree);

    // Section 9: 11.8s Necklace Discovery, Clasp & Portrait Cinematic
    this.beginJewelleryCinematic('necklace', 11.8, willBeAllThree);
    this.statusCaption = `Necklace Presentation ✧ ${nDef.name} (${nDef.sub}) · ([E] Continue · [Space] Skip)`;
    this.statusTimer = 11.8;
    return this.statusCaption;
  }

  public toggleCrown(): string {
    if (!this.avatarBridge) return '';
    const eq = this.avatarBridge.getJewelleryEquipped();
    if (eq.crownEquipped) {
      this.skipCinematic();
      this.avatarBridge.setJewelleryEquipped({ crownEquipped: false });
      if (this.crownDisplayGroup) {
        this.crownDisplayGroup.position.y = 1.08;
        this.crownDisplayGroup.visible = true;
      }
      this.startFlightToken('crown', false, 13.35, 1.15, 1.65, 1.4);
      this.playJewelleryChime(false);
      this.syncMirrorReflection();
      this.statusCaption = "Removed Harsha's Crown · Returned to Illuminated Crystal Pedestal";
      this.statusTimer = 5.5;
      return this.statusCaption;
    }

    const willBeAllThree = eq.ringIndex !== null && eq.necklaceIndex !== null;
    this.playJewelleryChime(willBeAllThree);

    // Sections 10 & 11: 14.8s Crown Ascension, Crowning & Mirror Reflection Cinematic
    this.beginJewelleryCinematic('crown_and_mirror', 14.8, willBeAllThree);
    this.statusCaption =
      "Harsha's Crown ✧ Royal Filigree Reveal & Mirror Reflection · ([E] Continue · [Space] Skip)";
    this.statusTimer = 14.8;
    return this.statusCaption;
  }

  public triggerMirrorCinematic(): string {
    this.syncMirrorReflection();
    this.beginJewelleryCinematic('mirror_only', 8.8, false);
    this.statusCaption =
      'Full-Height Jewellery Mirror ✧ Observing Harsha in Her Royal Jewellery · ([E] Continue · [Space] Skip)';
    this.statusTimer = 8.8;
    return this.statusCaption;
  }

  /**
   * Computes the smooth, slow, romantic camera position, target, FOV, and Harsha pose
   * for Sections 7, 8, 9, 10, 11, and 12.
   */
  public getCinematicCameraState(): JewelleryCinematicCameraOutput {
    if (!this.isCinematicActive()) {
      return {
        active: false,
        phase: 'EXPLORATION',
        camWorldPos: this.cinCamPos,
        lookWorldPos: this.cinLookPos,
        blendAlpha: 0.0,
        fov: 55.0,
      };
    }

    const t = this.cinematicElapsed;
    const total = Math.max(0.1, this.cinematicTotalDuration);
    const enterAlpha = easeInOutSine(THREE.MathUtils.clamp(t / 1.1, 0, 1));
    const exitAlpha = easeInOutSine(THREE.MathUtils.clamp((total - t) / 1.1, 0, 1));
    const blendAlpha = Math.min(enterAlpha, exitAlpha);

    // =========================================================================
    // SECTION 7 & 8: Y + H RING EXTENDED CINEMATIC (15.6s)
    // =========================================================================
    if (this.cinematicKind === 'yh_ring' || this.cinematicKind === 'ring') {
      const ringTrayWorldX = this.originX + 12.13;
      const ringTrayWorldY = this.baseY + this.y0 + 0.91;
      const ringTrayWorldZ = this.originZ - 0.04;

      // Harsha stands gracefully to the South-East of the ring tray
      const harshaX = this.originX + 12.55;
      const harshaY = this.baseY + this.y0;
      const harshaZ = this.originZ - 0.68;
      this.cinSeatPos.set(harshaX, harshaY, harshaZ);
      this.cinSeatYaw = -Math.PI * 0.25; // Facing toward the ring tray and front camera

      const ringMesh = this.ringDisplayMeshes[this.selectedRingIdx];

      if (t < 1.8) {
        // PHASE 1: ROOM RESPONSE & ESTABLISH HARSHA + DISPLAY (0.0s -> 1.8s)
        this.cinematicPhase = t < 0.7 ? 'CINEMATIC_ENTER' : 'CINEMATIC_ESTABLISH';
        const u = easeInOutSine(t / 1.8);
        this.cinCamPos.set(
          THREE.MathUtils.lerp(ringTrayWorldX + 1.45, ringTrayWorldX + 1.05, u),
          THREE.MathUtils.lerp(ringTrayWorldY + 0.65, ringTrayWorldY + 0.42, u),
          THREE.MathUtils.lerp(ringTrayWorldZ - 1.35, ringTrayWorldZ - 0.92, u),
        );
        this.cinLookPos.set(
          THREE.MathUtils.lerp(harshaX, ringTrayWorldX + 0.15, u),
          THREE.MathUtils.lerp(harshaY + 1.25, ringTrayWorldY + 0.08, u),
          THREE.MathUtils.lerp(harshaZ, ringTrayWorldZ - 0.1, u),
        );
        this.cinFov = THREE.MathUtils.lerp(54, 46, u);
      } else if (t < 5.8) {
        // PHASE 2: RING REVEAL — Rise + Controlled Macro Orbit: Reveal Y -> Hold -> Reveal H -> Hold -> Together
        this.cinematicPhase = 'CINEMATIC_DISCOVER';
        const u = (t - 1.8) / 4.0;
        const lift = easeInOutCubic(THREE.MathUtils.clamp(u * 2.2, 0, 1)) * 0.18;
        if (ringMesh) {
          ringMesh.position.y = 0.048 + lift;
          // Gentle presentation rotation
          ringMesh.rotation.y = -Math.PI / 2 + Math.sin(u * Math.PI) * 0.35;
        }
        const ringFocusY = ringTrayWorldY + lift;

        // Controlled macro orbit angle:
        // 0.0..0.35: Focus on left shoulder ('Y')
        // 0.35..0.72: Sweep to right shoulder ('H')
        // 0.72..1.0: Center to show 'Y' and 'H' together
        let orbitAng = -0.42;
        if (u < 0.35) {
          orbitAng = THREE.MathUtils.lerp(-0.65, -0.38, easeInOutSine(u / 0.35));
          this.statusCaption = 'Y + H Ring ✧ Revealing "Y" — Yeshwanth…';
        } else if (u < 0.72) {
          orbitAng = THREE.MathUtils.lerp(-0.38, 0.38, easeInOutSine((u - 0.35) / 0.37));
          this.statusCaption = 'Y + H Ring ✧ Revealing "H" — Harsha…';
        } else {
          orbitAng = THREE.MathUtils.lerp(0.38, 0.0, easeInOutSine((u - 0.72) / 0.28));
          this.statusCaption = 'Y + H Ring ✧ Y and H United Together…';
        }

        const dist = THREE.MathUtils.lerp(0.54, 0.34, easeInOutSine(Math.min(1, u * 1.5)));
        this.cinCamPos.set(
          ringTrayWorldX + Math.cos(orbitAng) * dist,
          ringFocusY + THREE.MathUtils.lerp(-0.04, 0.09, easeInOutSine(u)),
          ringTrayWorldZ + Math.sin(orbitAng) * dist,
        );
        this.cinLookPos.set(ringTrayWorldX, ringFocusY + 0.015, ringTrayWorldZ);
        this.cinFov = 38.0;
      } else if (t < 7.8) {
        // PHASE 3: PERSONAL DETAIL — Macro Shot of "Y ♥ H" Engraved Inside the Band
        this.cinematicPhase = 'CINEMATIC_DISCOVER';
        const u = (t - 5.8) / 2.0;
        const ringFocusY = ringTrayWorldY + 0.18;
        if (ringMesh) {
          ringMesh.position.y = 0.048 + 0.18;
          ringMesh.rotation.y = -Math.PI / 2 + 0.18;
        }
        // Push in softly to macro (0..0.45), hold on 'Y ♥ H' (0.45..0.75), pull back gently (0.75..1.0)
        const macroFactor =
          u < 0.45
            ? easeInOutSine(u / 0.45)
            : u < 0.75
              ? 1.0
              : 1.0 - easeInOutSine((u - 0.75) / 0.25) * 0.65;
        const dist = THREE.MathUtils.lerp(0.36, 0.22, macroFactor);
        this.cinCamPos.set(
          ringTrayWorldX + dist,
          ringFocusY + 0.04,
          ringTrayWorldZ - 0.08 * macroFactor,
        );
        this.cinLookPos.set(ringTrayWorldX, ringFocusY - 0.008, ringTrayWorldZ);
        this.cinFov = THREE.MathUtils.lerp(38, 32, macroFactor);
        this.statusCaption = 'Inner Band Engraving ✧ "Y ♥ H" — Made Personally for Harsha';
      } else if (t < 10.2) {
        // PHASE 4: TRANSFER — Ring Travels Continuously from Pedestal -> Air -> Hand -> Finger
        this.cinematicPhase = 'CINEMATIC_INTERACTION';
        const u = easeInOutCubic((t - 7.8) / 2.4);
        this.avatarBridge?.setRaisingHand?.(true);
        if (this.avatarBridge) {
          this.avatarBridge.getRingAttachmentWorldPos(_scratchHandPos);
        } else {
          _scratchHandPos.set(harshaX - 0.22, harshaY + 1.05, harshaZ - 0.18);
        }

        if (ringMesh) {
          ringMesh.visible = false;
        }
        const token = this.flightTokens.find((ft) => ft.kind === 'ring');
        if (token) {
          token.mesh.visible = true;
          const curX = THREE.MathUtils.lerp(ringTrayWorldX, _scratchHandPos.x, u);
          const curY =
            THREE.MathUtils.lerp(ringTrayWorldY + 0.18, _scratchHandPos.y, u) +
            Math.sin(u * Math.PI) * 0.16;
          const curZ = THREE.MathUtils.lerp(ringTrayWorldZ, _scratchHandPos.z, u);
          token.mesh.position.set(curX - this.originX, curY - this.baseY, curZ - this.originZ);
          token.mesh.rotation.y = t * 2.2;

          this.cinCamPos.set(curX + 0.42, curY + 0.14, curZ - 0.48);
          this.cinLookPos.set(curX, curY, curZ);
        }
        this.cinFov = 42.0;
        this.statusCaption = "Transferring the Y + H Ring to Harsha's Hand…";
      } else if (t < 11.6) {
        // PHASE 5: WEARING — Ring Settles onto Finger + Pause + Subtle Warm Reflection
        this.cinematicPhase = 'CINEMATIC_PRESENT';
        this.resolvePendingJewelleryState();
        const token = this.flightTokens.find((ft) => ft.kind === 'ring');
        if (token) token.mesh.visible = false;

        if (this.avatarBridge) {
          this.avatarBridge.getRingAttachmentWorldPos(_scratchHandPos);
        } else {
          _scratchHandPos.set(harshaX - 0.22, harshaY + 1.05, harshaZ - 0.18);
        }
        this.cinCamPos.set(
          _scratchHandPos.x + 0.36,
          _scratchHandPos.y + 0.12,
          _scratchHandPos.z - 0.38,
        );
        this.cinLookPos.copy(_scratchHandPos);
        this.cinFov = 38.0;
        this.statusCaption = 'Wearing the Y + H Ring ✧ Settled Gently onto Her Finger';
      } else {
        // PHASE 6: EMOTIONAL REVEAL & FRONT PRESENTATION (11.6s -> 15.6s)
        // Travel: hand -> wrist -> upper body -> face -> full front 3/4 portrait, then gentle left/right arc
        this.cinematicPhase = t < 14.8 ? 'CINEMATIC_REVEAL' : 'CINEMATIC_RELEASE';
        const u = (t - 11.6) / 4.0;
        if (u > 0.35) {
          this.avatarBridge?.setRaisingHand?.(false);
        }
        const travelU = easeInOutCubic(THREE.MathUtils.clamp(u / 0.45, 0, 1));
        const arcPhase = THREE.MathUtils.clamp((u - 0.45) / 0.55, 0, 1);
        const gentleArcYaw = Math.sin(arcPhase * Math.PI * 2) * 0.28;

        if (this.avatarBridge) {
          this.avatarBridge.getRingAttachmentWorldPos(_scratchHandPos);
        } else {
          _scratchHandPos.set(harshaX - 0.22, harshaY + 1.05, harshaZ - 0.18);
        }

        const portraitLookX = harshaX;
        const portraitLookY = harshaY + 1.32;
        const portraitLookZ = harshaZ;

        const camAngle = this.cinSeatYaw + 0.24 + gentleArcYaw;
        const portraitDist = 1.65;
        const portraitCamX = harshaX + Math.sin(camAngle) * portraitDist;
        const portraitCamY = harshaY + 1.42;
        const portraitCamZ = harshaZ + Math.cos(camAngle) * portraitDist;

        this.cinCamPos.set(
          THREE.MathUtils.lerp(_scratchHandPos.x + 0.36, portraitCamX, travelU),
          THREE.MathUtils.lerp(_scratchHandPos.y + 0.12, portraitCamY, travelU),
          THREE.MathUtils.lerp(_scratchHandPos.z - 0.38, portraitCamZ, travelU),
        );
        this.cinLookPos.set(
          THREE.MathUtils.lerp(_scratchHandPos.x, portraitLookX, travelU),
          THREE.MathUtils.lerp(_scratchHandPos.y, portraitLookY, travelU),
          THREE.MathUtils.lerp(_scratchHandPos.z, portraitLookZ, travelU),
        );
        this.cinFov = THREE.MathUtils.lerp(38, 48, travelU);
        this.statusCaption = 'Y + H Ring ✧ "This was made for me." ♡';
      }

      return {
        active: true,
        phase: this.cinematicPhase,
        camWorldPos: this.cinCamPos,
        lookWorldPos: this.cinLookPos,
        blendAlpha,
        fov: this.cinFov,
        seatWorldPos: this.cinSeatPos,
        seatYaw: this.cinSeatYaw,
      };
    }

    // =========================================================================
    // SECTION 9: NECKLACE CAMERA CINEMATIC (11.8s)
    // =========================================================================
    if (this.cinematicKind === 'necklace') {
      const bustZ = 0.15 + (this.selectedNecklaceIdx - 2) * 0.44;
      const bustWorldX = this.originX + 11.57;
      const bustWorldY = this.baseY + this.y0 + 1.02;
      const bustWorldZ = this.originZ + bustZ;

      const harshaX = this.originX + 10.65;
      const harshaY = this.baseY + this.y0;
      const harshaZ = this.originZ + bustZ;
      this.cinSeatPos.set(harshaX, harshaY, harshaZ);
      this.cinSeatYaw = Math.PI / 2; // Facing East toward the velvet necklace bust

      const neckMesh = this.necklaceDisplayMeshes[this.selectedNecklaceIdx];

      if (t < 1.8) {
        // Medium shot establishing Harsha and the velvet bust
        this.cinematicPhase = 'CINEMATIC_ESTABLISH';
        const u = easeInOutSine(t / 1.8);
        this.cinCamPos.set(
          THREE.MathUtils.lerp(bustWorldX - 1.35, bustWorldX - 0.78, u),
          bustWorldY + 0.35,
          bustWorldZ + 0.68,
        );
        this.cinLookPos.set(bustWorldX, bustWorldY + 0.04, bustWorldZ);
        this.cinFov = 50.0;
      } else if (t < 4.8) {
        // Pendant rises; slow arc showing chain, pendant, gemstone & connection points
        this.cinematicPhase = 'CINEMATIC_DISCOVER';
        const u = (t - 1.8) / 3.0;
        const lift = easeInOutCubic(Math.min(1, u * 1.8)) * 0.15;
        if (neckMesh) {
          neckMesh.position.y = 0.14 + lift;
        }
        const arcAng = Math.PI + (u - 0.5) * 1.15;
        const dist = 0.42;
        this.cinCamPos.set(
          bustWorldX + Math.cos(arcAng) * dist,
          bustWorldY + lift + 0.06,
          bustWorldZ + Math.sin(arcAng) * dist,
        );
        this.cinLookPos.set(bustWorldX, bustWorldY + lift, bustWorldZ);
        this.cinFov = 38.0;
      } else if (t < 7.2) {
        // Necklace approaches Harsha's neck; camera moves to upper-body 3/4 view as clasp closes
        this.cinematicPhase = 'CINEMATIC_INTERACTION';
        const u = easeInOutCubic((t - 4.8) / 2.4);
        if (neckMesh) neckMesh.visible = false;
        if (this.avatarBridge) {
          this.avatarBridge.getNecklaceAttachmentWorldPos(_scratchNeckPos);
        } else {
          _scratchNeckPos.set(harshaX + 0.12, harshaY + 1.22, harshaZ);
        }

        const token = this.flightTokens.find((ft) => ft.kind === 'necklace');
        if (token) {
          token.mesh.visible = true;
          const cx = THREE.MathUtils.lerp(bustWorldX, _scratchNeckPos.x, u);
          const cy =
            THREE.MathUtils.lerp(bustWorldY + 0.15, _scratchNeckPos.y, u) +
            Math.sin(u * Math.PI) * 0.12;
          const cz = THREE.MathUtils.lerp(bustWorldZ, _scratchNeckPos.z, u);
          token.mesh.position.set(cx - this.originX, cy - this.baseY, cz - this.originZ);
          token.mesh.rotation.y = t * 2.0;
        }

        this.cinCamPos.set(
          _scratchNeckPos.x + 0.62,
          _scratchNeckPos.y + 0.12,
          _scratchNeckPos.z + 0.42,
        );
        this.cinLookPos.copy(_scratchNeckPos);
        this.cinFov = 41.0;
      } else {
        // Clasp closes -> Pendant settles -> Hold -> Slow pull-back & 3/4 portrait arc
        this.cinematicPhase = t < 10.9 ? 'CINEMATIC_REVEAL' : 'CINEMATIC_RELEASE';
        this.resolvePendingJewelleryState();
        const token = this.flightTokens.find((ft) => ft.kind === 'necklace');
        if (token) token.mesh.visible = false;

        const u = (t - 7.2) / 4.6;
        const pullU = easeInOutCubic(Math.min(1, u / 0.45));
        const arcU = Math.sin(THREE.MathUtils.clamp((u - 0.35) / 0.65, 0, 1) * Math.PI * 2) * 0.26;
        const dist = THREE.MathUtils.lerp(0.68, 1.55, pullU);
        const ang = this.cinSeatYaw + arcU;

        this.cinCamPos.set(
          harshaX + Math.sin(ang) * dist,
          harshaY + THREE.MathUtils.lerp(1.26, 1.38, pullU),
          harshaZ + Math.cos(ang) * dist,
        );
        this.cinLookPos.set(
          harshaX,
          harshaY + THREE.MathUtils.lerp(1.22, 1.32, pullU),
          harshaZ,
        );
        this.cinFov = THREE.MathUtils.lerp(40, 48, pullU);
      }

      return {
        active: true,
        phase: this.cinematicPhase,
        camWorldPos: this.cinCamPos,
        lookWorldPos: this.cinLookPos,
        blendAlpha,
        fov: this.cinFov,
        seatWorldPos: this.cinSeatPos,
        seatYaw: this.cinSeatYaw,
      };
    }

    // =========================================================================
    // SECTIONS 10 & 11: CROWN CAMERA + MIRROR CINEMATIC (14.8s)
    // =========================================================================
    if (this.cinematicKind === 'crown_and_mirror' || this.cinematicKind === 'mirror_only') {
      const isMirrorOnly = this.cinematicKind === 'mirror_only';
      const pedWorldX = this.originX + 13.35;
      const pedWorldY = this.baseY + this.y0 + 1.15;
      const pedWorldZ = this.originZ + 1.65;

      const mirrorWorldX = this.originX + 14.23;
      const mirrorWorldY = this.baseY + this.y0 + 1.18;
      const mirrorWorldZ = this.originZ - 3.8;

      if (!isMirrorOnly && t < 9.6) {
        // Harsha stands near the crystal pedestal facing the crown
        const harshaX = this.originX + 12.65;
        const harshaY = this.baseY + this.y0;
        const harshaZ = this.originZ + 1.65;
        this.cinSeatPos.set(harshaX, harshaY, harshaZ);
        this.cinSeatYaw = Math.PI / 2;

        if (t < 2.2) {
          // Wide shot showing Harsha and the Crown together
          this.cinematicPhase = 'CINEMATIC_ESTABLISH';
          const u = easeInOutSine(t / 2.2);
          this.cinCamPos.set(
            THREE.MathUtils.lerp(pedWorldX - 1.65, pedWorldX - 1.1, u),
            pedWorldY + 0.42,
            pedWorldZ - 1.25,
          );
          this.cinLookPos.set(
            THREE.MathUtils.lerp(harshaX + 0.35, pedWorldX, u),
            pedWorldY + 0.08,
            pedWorldZ,
          );
          this.cinFov = 50.0;
        } else if (t < 5.6) {
          // Crown rises; slow upward camera arc showing silhouette, 5 crystal points & inner gold filigree
          this.cinematicPhase = 'CINEMATIC_DISCOVER';
          const u = (t - 2.2) / 3.4;
          const lift = easeInOutCubic(Math.min(1, u * 1.6)) * 0.22;
          if (this.crownDisplayGroup) {
            this.crownDisplayGroup.position.y = 1.08 + lift;
            this.crownDisplayGroup.rotation.y = u * Math.PI * 1.2;
          }
          const arcAng = Math.PI + (u - 0.5) * 1.4;
          const dist = 0.55;
          this.cinCamPos.set(
            pedWorldX + Math.cos(arcAng) * dist,
            pedWorldY + lift + THREE.MathUtils.lerp(-0.08, 0.22, easeInOutSine(u)),
            pedWorldZ + Math.sin(arcAng) * dist,
          );
          this.cinLookPos.set(pedWorldX, pedWorldY + lift + 0.04, pedWorldZ);
          this.cinFov = 40.0;
          this.statusCaption =
            "Harsha's Crown ✧ 5 Crystal Points, Heart Filigree & Champagne-Gold Structure";
        } else {
          // Front portrait height -> Crown approaches Harsha's head -> Settles -> Pause -> Slow pull-back reveal
          this.cinematicPhase = t < 7.8 ? 'CINEMATIC_INTERACTION' : 'CINEMATIC_PRESENT';
          const u = (t - 5.6) / 4.0;
          const descendU = easeInOutCubic(THREE.MathUtils.clamp(u / 0.55, 0, 1));
          const pullBackU = easeInOutSine(THREE.MathUtils.clamp((u - 0.55) / 0.45, 0, 1));

          if (this.crownDisplayGroup) this.crownDisplayGroup.visible = false;
          if (this.avatarBridge) {
            this.avatarBridge.getCrownAttachmentWorldPos(_scratchCrownPos);
          } else {
            _scratchCrownPos.set(harshaX, harshaY + 1.66, harshaZ);
          }

          const token = this.flightTokens.find((ft) => ft.kind === 'crown');
          if (u < 0.55 && token) {
            token.mesh.visible = true;
            const cx = THREE.MathUtils.lerp(pedWorldX, _scratchCrownPos.x, descendU);
            const cy =
              THREE.MathUtils.lerp(pedWorldY + 0.22, _scratchCrownPos.y, descendU) +
              Math.sin(descendU * Math.PI) * 0.14;
            const cz = THREE.MathUtils.lerp(pedWorldZ, _scratchCrownPos.z, descendU);
            token.mesh.position.set(cx - this.originX, cy - this.baseY, cz - this.originZ);
          } else {
            if (token) token.mesh.visible = false;
            this.resolvePendingJewelleryState();
          }

          const dist = THREE.MathUtils.lerp(0.95, 1.72, pullBackU);
          this.cinCamPos.set(
            harshaX + dist,
            harshaY + THREE.MathUtils.lerp(1.62, 1.44, pullBackU),
            harshaZ - 0.35,
          );
          this.cinLookPos.set(
            harshaX,
            harshaY + THREE.MathUtils.lerp(1.58, 1.32, pullBackU),
            harshaZ,
          );
          this.cinFov = THREE.MathUtils.lerp(42, 48, pullBackU);
          this.statusCaption = "Crowned with Harsha's Crown ✧ Moving to the Full-Height Mirror…";
        }
      } else {
        // SECTION 11: MIRROR CINEMATIC (9.6s -> 14.8s or 0.0s -> 8.8s in mirror_only)
        this.cinematicPhase = t < total - 0.9 ? 'CINEMATIC_REVEAL' : 'CINEMATIC_RELEASE';
        this.resolvePendingJewelleryState();
        const token = this.flightTokens.find((ft) => ft.kind === 'crown');
        if (token) token.mesh.visible = false;

        const mElapsed = isMirrorOnly ? t : t - 9.6;
        const mDur = isMirrorOnly ? 8.8 : 5.2;
        const u = THREE.MathUtils.clamp(mElapsed / mDur, 0, 1);

        // Avatar approaches naturally toward the mirror at (13.55, y0, -3.8) facing East (Math.PI / 2)
        const walkU = easeInOutSine(THREE.MathUtils.clamp(u / 0.35, 0, 1));
        const harshaX = this.originX + THREE.MathUtils.lerp(12.85, 13.55, walkU);
        const harshaY = this.baseY + this.y0;
        const harshaZ = this.originZ - 3.8;
        this.cinSeatPos.set(harshaX, harshaY, harshaZ);
        this.cinSeatYaw = Math.PI / 2;

        // Sync reflection double position inside mirror
        if (this.mirrorReflectionGroup) {
          this.mirrorReflectionGroup.position.x = 0.18 + (1.0 - walkU) * 0.45;
        }

        // Camera settles behind/slightly beside Harsha, then slowly slides to reveal the front reflection
        const slideU = easeInOutSine(THREE.MathUtils.clamp((u - 0.3) / 0.55, 0, 1));
        this.cinCamPos.set(
          harshaX - THREE.MathUtils.lerp(0.95, 0.72, slideU),
          harshaY + 1.48,
          harshaZ + THREE.MathUtils.lerp(-0.42, 0.38, slideU),
        );
        this.cinLookPos.set(
          mirrorWorldX + 0.15,
          mirrorWorldY + 0.14,
          mirrorWorldZ + THREE.MathUtils.lerp(-0.08, 0.04, slideU),
        );
        this.cinFov = 46.0;
        this.statusCaption =
          'The Jewellery Mirror ✧ Observing Her Reflection in the Royal Collection';
      }

      return {
        active: true,
        phase: this.cinematicPhase,
        camWorldPos: this.cinCamPos,
        lookWorldPos: this.cinLookPos,
        blendAlpha,
        fov: this.cinFov,
        seatWorldPos: this.cinSeatPos,
        seatYaw: this.cinSeatYaw,
      };
    }

    // =========================================================================
    // SECTION 12: JEWELLERY COMBINATION CINEMATIC (11.2s)
    // Y + H RING -> NECKLACE -> CROWN
    // =========================================================================
    if (this.cinematicKind === 'combination') {
      const harshaX = this.originX + 12.25;
      const harshaY = this.baseY + this.y0;
      const harshaZ = this.originZ + 0.15;
      this.cinSeatPos.set(harshaX, harshaY, harshaZ);
      this.cinSeatYaw = -Math.PI / 2; // Facing West toward the central gallery

      if (this.avatarBridge) {
        this.avatarBridge.getRingAttachmentWorldPos(_scratchHandPos);
        this.avatarBridge.getNecklaceAttachmentWorldPos(_scratchNeckPos);
        this.avatarBridge.getCrownAttachmentWorldPos(_scratchCrownPos);
      } else {
        _scratchHandPos.set(harshaX - 0.18, harshaY + 0.88, harshaZ - 0.22);
        _scratchNeckPos.set(harshaX - 0.15, harshaY + 1.22, harshaZ);
        _scratchCrownPos.set(harshaX, harshaY + 1.66, harshaZ);
      }

      if (t < 5.6) {
        // Small warm light travels: RING (0..2.6s) -> NECKLACE (2.6..4.2s) -> CROWN (4.2..5.6s)
        this.cinematicPhase = 'CINEMATIC_DISCOVER';
        this.comboLightOrb.visible = true;
        const orbPos = _scratchTargetPos;
        if (t < 2.6) {
          const u = easeInOutSine(t / 2.6);
          orbPos.lerpVectors(_scratchHandPos, _scratchNeckPos, u);
          this.statusCaption =
            'Three-Piece Resonance ✧ A Warm Golden Light Awakens at the Y + H Ring…';
        } else {
          const u = easeInOutSine((t - 2.6) / 3.0);
          orbPos.lerpVectors(_scratchNeckPos, _scratchCrownPos, u);
          this.statusCaption =
            "Three-Piece Resonance ✧ Travelling from the Necklace to Harsha's Crown…";
        }
        this.comboLightOrb.position.set(
          orbPos.x - this.originX,
          orbPos.y - this.baseY,
          orbPos.z - this.originZ,
        );
        this.comboLightOrb.rotation.y = t * 3.0;

        this.cinCamPos.set(orbPos.x - 0.72, orbPos.y + 0.08, orbPos.z + 0.35);
        this.cinLookPos.copy(orbPos);
        this.cinFov = 40.0;
      } else if (t < 7.2) {
        // Pause at the Crown as warm glow connects all three
        this.cinematicPhase = 'CINEMATIC_PRESENT';
        this.comboLightOrb.visible = true;
        this.comboLightOrb.position.set(
          _scratchCrownPos.x - this.originX,
          _scratchCrownPos.y - this.baseY + 0.04,
          _scratchCrownPos.z - this.originZ,
        );
        this.cinCamPos.set(
          _scratchCrownPos.x - 0.85,
          _scratchCrownPos.y + 0.06,
          _scratchCrownPos.z + 0.28,
        );
        this.cinLookPos.copy(_scratchCrownPos);
        this.cinFov = 42.0;
        this.statusCaption =
          "Y + H Ring + Necklace + Harsha's Crown ✧ Connected in One Warm Glow";
      } else {
        // Slowly pull back to reveal Harsha in the complete jewellery combination
        this.cinematicPhase = t < 10.3 ? 'CINEMATIC_REVEAL' : 'CINEMATIC_RELEASE';
        this.comboLightOrb.visible = false;
        const u = easeInOutSine((t - 7.2) / 4.0);
        const dist = THREE.MathUtils.lerp(0.95, 2.05, u);
        const arc = Math.sin(u * Math.PI) * 0.25;
        this.cinCamPos.set(
          harshaX - Math.cos(arc) * dist,
          harshaY + THREE.MathUtils.lerp(1.58, 1.38, u),
          harshaZ + Math.sin(arc) * dist,
        );
        this.cinLookPos.set(
          harshaX,
          harshaY + THREE.MathUtils.lerp(1.55, 1.24, u),
          harshaZ,
        );
        this.cinFov = THREE.MathUtils.lerp(42, 50, u);
        this.statusCaption =
          "Complete Royal Combination ✧ Y + H Ring, Necklace & Harsha's Crown ♡";
      }

      return {
        active: true,
        phase: this.cinematicPhase,
        camWorldPos: this.cinCamPos,
        lookWorldPos: this.cinLookPos,
        blendAlpha,
        fov: this.cinFov,
        seatWorldPos: this.cinSeatPos,
        seatYaw: this.cinSeatYaw,
      };
    }

    return {
      active: false,
      phase: 'EXPLORATION',
      camWorldPos: this.cinCamPos,
      lookWorldPos: this.cinLookPos,
      blendAlpha: 0.0,
      fov: 55.0,
    };
  }

  /**
   * Context-sensitive proximity prompt inside Room 2 (Jewellery Atelier / Couture Corner)
   */
  public getProximityPrompt(lx: number, lz: number, isInspecting: boolean): string {
    if (this.isCinematicActive()) {
      return 'Jewellery Atelier Cinematic ✧ [E] Continue · [Space] / [Esc] Skip Cinematic';
    }

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
      return `Jewellery Atelier ✧ [1] ${ringLabel} · [2] ${neckLabel} · [3] ${crownLabel} · [M] Mirror · Drag/Touchpad 360° Look · [E] Step Back`;
    }

    if (Math.hypot(lx - 13.35, lz - 1.65) <= 1.35) {
      return `[E] ${crownLabel} (Harsha's Crown) · [1] Ring · [2] Necklace`;
    }
    if (Math.hypot(lx - 14.45, lz - (-3.8)) <= 1.45) {
      return `[E] Look in Full-Height Jewellery Mirror · [1] ${ringLabel} · [2] ${neckLabel} · [3] ${crownLabel}`;
    }
    if (Math.hypot(lx - 14.55, lz - 3.8) <= 1.45) {
      return `[E] Inspect Jewellery Workbench ("Still becoming ours." — Y + H)`;
    }
    if (Math.hypot(lx - 12.2, lz - (-0.25)) <= 1.35) {
      return `[E] ${ringLabel} (${RING_DESIGNS[this.selectedRingIdx].name}) · [1] Ring · [2] Necklace`;
    }
    if (Math.hypot(lx - 11.5, lz - 0.15) <= 1.45) {
      return `[E] ${neckLabel} (${NECKLACE_DESIGNS[this.selectedNecklaceIdx].name}) · [1] Ring · [2] Necklace`;
    }
    return `[E] Jewellery Atelier Try-On · [1] ${ringLabel} · [2] ${neckLabel} · [3] ${crownLabel}`;
  }

  public interactAtPosition(lx: number, lz: number): { enterInspect: boolean; caption: string } {
    if (this.isCinematicActive()) {
      this.advanceOrContinueCinematic();
      return { enterInspect: false, caption: this.statusCaption ?? '' };
    }

    if (Math.hypot(lx - 13.35, lz - 1.65) <= 1.35) {
      const cap = this.toggleCrown();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 14.45, lz - (-3.8)) <= 1.45) {
      const cap = this.triggerMirrorCinematic();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 12.2, lz - (-0.25)) <= 1.35) {
      const cap = this.toggleRing();
      return { enterInspect: false, caption: cap };
    }
    if (Math.hypot(lx - 11.5, lz - 0.15) <= 1.35) {
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
    return this.statusTimer > 0 || this.isCinematicActive() ? this.statusCaption : null;
  }

  public update(delta: number, clockTime: number): void {
    if (this.statusTimer > 0) {
      this.statusTimer = Math.max(0, this.statusTimer - delta);
    }

    // Advance active Jewellery Cinematic State Machine
    if (this.isCinematicActive()) {
      this.cinematicElapsed += delta;
      // Subtle pedestal focus light boost during Phase 1 & Phase 2
      this.pedestalFocusLight.intensity = 1.65 + Math.sin(clockTime * 2.5) * 0.25;

      if (this.cinematicElapsed >= this.cinematicTotalDuration) {
        this.resolvePendingJewelleryState();
        this.avatarBridge?.setRaisingHand?.(false);
        this.comboLightOrb.visible = false;
        this.flightTokens.forEach((ft) => {
          ft.active = false;
          ft.mesh.visible = false;
        });

        if (this.pendingChainCombination) {
          // Section 12: Chain smoothly into the 3-Piece Jewellery Combination Cinematic!
          this.pendingChainCombination = false;
          this.playJewelleryChime(true);
          this.beginJewelleryCinematic('combination', 11.2, false);
          this.statusCaption =
            "All Three Equipped! ✧ Y + H Ring + Necklace + Harsha's Crown Resonance…";
          this.statusTimer = 11.2;
        } else {
          this.cinematicKind = 'none';
          this.cinematicPhase = 'EXPLORATION';
          this.cinematicElapsed = 0.0;
          this.pedestalFocusLight.intensity = 0.85;
        }
      }
    } else {
      this.pedestalFocusLight.intensity = 0.85;
      if (this.crownDisplayGroup && this.crownDisplayGroup.visible) {
        this.crownDisplayGroup.rotation.y = clockTime * 0.65;
      }
    }

    // Update non-cinematic unequip flight tokens
    for (let i = 0; i < this.flightTokens.length; i++) {
      const t = this.flightTokens[i];
      if (!t.active) continue;

      t.progress = Math.min(1.0, t.progress + delta / Math.max(0.2, t.duration));
      const u = easeInOutCubic(t.progress);

      const wx = THREE.MathUtils.lerp(t.startWorldPos.x, t.endWorldPos.x, u);
      const wy =
        THREE.MathUtils.lerp(t.startWorldPos.y, t.endWorldPos.y, u) +
        Math.sin(u * Math.PI) * 0.28;
      const wz = THREE.MathUtils.lerp(t.startWorldPos.z, t.endWorldPos.z, u);

      t.mesh.position.set(wx - this.originX, wy - this.baseY, wz - this.originZ);
      t.mesh.rotation.y = clockTime * 3.5;

      if (t.progress >= 1.0) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
  }
}
