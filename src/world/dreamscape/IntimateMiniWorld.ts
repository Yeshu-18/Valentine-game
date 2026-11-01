import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';
import { JewelleryAvatarBridge } from './CastleJewelleryAtelier';

function smoothStep01(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

export type MiniWorldState =
  | 'IDLE'
  | 'ENTERING'
  | 'GARDEN'
  | 'CROWN_RISING'
  | 'CROWN_SETTLING'
  | 'QUIET_PAUSE'
  | 'FINALE_CAMERA'
  | 'FIREWORKS'
  | 'FINAL_HOLD'
  | 'RESTORE_CONTROL'
  | 'EXITING';

export interface MiniWorldEntranceSpec {
  position: THREE.Vector3;
  facingRotation: number;
  interactionRadius: number;
  entryPoint: THREE.Vector3;
  returnPoint: THREE.Vector3;
}

export interface MiniWorldTransitionCameraState {
  active: boolean;
  phase: MiniWorldState;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  fov: number;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
  isSitting?: boolean;
}

// Module-scope zero-allocation scratch vectors
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();
const _scratchSeatWorldPos = new THREE.Vector3();
const _scratchTeleportPos = new THREE.Vector3();
const _scratchCrownAttachWorldPos = new THREE.Vector3();
const _scratchMatrix = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();
const _scratchColor = new THREE.Color();

/**
 * Soft radial glow particle texture for the finale fireworks and subtle garden shimmer.
 */
function createSoftParticleGlowTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 240, 248, 0.78)');
    grad.addColorStop(0.7, 'rgba(244, 114, 182, 0.28)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates the ONLY permitted text texture in the Mini World:
 * "I LOVE YOU ❤️" rendered in an elegant couture serif typeface on a transparent background
 * for the 3D world-space sky relief sculpture.
 */
function createSkyLoveReliefTexture(
  tracker: ResourceTracker,
  isGoldBackLayer: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 88px Georgia, "Times New Roman", serif';

    if (isGoldBackLayer) {
      ctx.shadowColor = 'rgba(244, 63, 94, 0.75)';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#d8b467';
      ctx.fillText('I LOVE YOU', 445, 128);
    } else {
      ctx.shadowColor = 'rgba(244, 114, 182, 0.92)';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#fffbeb';
      ctx.fillText('I LOVE YOU', 445, 128);

      ctx.strokeStyle = 'rgba(251, 207, 232, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.strokeText('I LOVE YOU', 445, 128);
    }
    ctx.restore();
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Intimate Romantic Garden Sanctuary (`IntimateMiniWorld`)
 *
 * Replaces the obsolete Mini Castle / Little Kingdom visual payload while preserving
 * the exact doorway/integration contract with `CastleTabletopWorld`, `CastleFloor2CreativeWing`,
 * `CastleNavigation`, and `PlayerController`.
 *
 * Visual Elements (5 Total):
 * 1. Harsha (emotional center, seated on her couture throne) + quiet witnessing Yeshwanth
 * 2. Her Crown (delicate princess tiara, 70-80% head width, champagne gold #d8b467, ruby-pink heart gem #f43f5e)
 * 3. Her Throne (intimate human-scale blush velvet & champagne-gold couture throne on a 2-step pearl dais)
 * 4. Secluded Nighttime Romantic Garden & Curved S-Path (soft grass, sparse blossoms, ground crystal lights)
 * 5. Sparse Finale Fireworks (Heart -> Flower -> Star) + 3D World-Space Sky Message ("I LOVE YOU ❤️")
 */
export class IntimateMiniWorld {
  public readonly group: THREE.Group;
  public readonly dynamicObjects = new Set<THREE.Object3D>();

  private readonly tracker: ResourceTracker;
  private readonly mats: DreamCastleMaterials;
  private readonly parentGroup: THREE.Group;
  private readonly originX: number;
  private readonly baseY: number;
  private readonly originZ: number;
  private readonly y0: number;
  private readonly colliders: CircleCollider[];

  // Tabletop Display Coordinates in Room 3 (Doll Playroom)
  private readonly tableX = 12.85;
  private readonly tableZ = 11.85;

  // Full-Scale Sanctuary Clearing Center in Castle-Local Coordinates
  private readonly dwCenterX = 33.0;
  private readonly dwCenterZ = 12.0;

  // Throne Dais Local Coordinates (relative to dwRoot at (33.0, y0, 12.0))
  private readonly throneLocalX = 3.35;
  private readonly throneLocalZ = 0.0;
  private readonly daisTopY = 0.22; // 2 low steps of 0.11m each

  public isInsideLittleDreamWorld = false;
  public readonly entranceSpec: MiniWorldEntranceSpec;

  private avatarBridge: JewelleryAvatarBridge | null = null;

  // Single Authoritative State Machine
  private state: MiniWorldState = 'IDLE';
  private stateElapsed = 0.0;
  private pendingTeleport: { pos: THREE.Vector3; yaw: number } | null = null;
  private hasCompletedEntryTeleport = false;
  private hasCompletedExitTeleport = false;
  private hasEquippedCrownInSequence = false;

  // Groups & Animated References
  private tabletopGateArch!: THREE.Group;
  private tabletopPortalGlowMat!: THREE.MeshStandardMaterial;

  private dwRoot!: THREE.Group;
  private dreamWorldPortalRing!: THREE.Mesh;
  private crownGroup!: THREE.Group;
  private crownHeartGemMat!: THREE.MeshStandardMaterial;
  private throneUnderglowMat!: THREE.MeshStandardMaterial;
  private pathCrystalGlowMat!: THREE.MeshStandardMaterial;
  private gardenBlossomMat!: THREE.MeshStandardMaterial;
  private sanctuaryKeyLight!: THREE.PointLight;

  // 3D World-Space Sky Message ("I LOVE YOU ❤️")
  private skyMessageGroup!: THREE.Group;
  private skyFrontTextMat!: THREE.MeshBasicMaterial;
  private skyBackReliefMat!: THREE.MeshBasicMaterial;
  private skyHeartGemMat!: THREE.MeshStandardMaterial;

  // Preserved Finale Fireworks Particle System (3 deterministic bursts: Heart -> Flower -> Star)
  private fireworksPoints!: THREE.Points;
  private fireworksPosAttr!: THREE.BufferAttribute;
  private fireworksColorAttr!: THREE.BufferAttribute;
  private readonly FIREWORKS_COUNT = 240;
  private readonly fwOrigins = new Float32Array(240 * 3);
  private readonly fwVelocities = new Float32Array(240 * 3);
  private readonly fwBaseColors = new Float32Array(240 * 3);
  private readonly fwAges = new Float32Array(240);
  private readonly fwLifetimes = new Float32Array(240);
  private fireworksBurst1Launched = false;
  private fireworksBurst2Launched = false;
  private fireworksBurst3Launched = false;
  private fireworksElapsed = 0.0;

  // Memory Path Portrait Frames (kept for compatibility with Portrait Atelier `addCapturedPortraitToMemoryPath`)
  private readonly memoryPortraitMaterials: THREE.MeshBasicMaterial[] = [];
  private nextMemoryFrameIdx = 0;

  // Camera Transition State
  private currentCamLocalPos = new THREE.Vector3(-1.2, 1.65, 0.0);
  private currentLookLocalPos = new THREE.Vector3(3.35, 1.35, 0.0);
  private currentFov = 48.0;
  private finaleStartCamLocalPos = new THREE.Vector3(0.95, 1.56, 0.0);
  private finaleStartLookLocalPos = new THREE.Vector3(3.35, 1.36, 0.0);

  // User subtle camera look offset during FINAL_HOLD
  private lookYawOffset = 0.0;
  private lookPitchOffset = 0.0;

  // Authoritative Phase Durations
  private readonly DUR_ENTERING = 1.2;
  private readonly DUR_GARDEN = 2.8;
  private readonly DUR_CROWN_RISING = 1.2;
  private readonly DUR_CROWN_SETTLING = 1.0; // Total Crown Sequence = 2.2s
  private readonly DUR_QUIET_PAUSE = 2.8; // Complete stillness (2.5-3.0s window)
  private readonly DUR_FINALE_CAMERA = 3.5; // Fireworks start at 80% = 2.8s
  private readonly DUR_FIREWORKS_TAIL = 2.8; // Continues after camera pull-back completes
  private readonly DUR_FINAL_HOLD = 5.0; // 5.0s final hold before restoring control
  private readonly DUR_EXITING = 1.6;

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
    this.colliders = colliders;

    this.group = new THREE.Group();
    this.group.name = 'TabletopAndIntimateMiniWorldGroup';
    this.parentGroup = this.group;

    // Preserve exact Floor 2 Doll Playroom doorway/integration contract
    this.entranceSpec = {
      position: new THREE.Vector3(this.tableX, this.y0 + 0.55, this.tableZ - 0.88),
      facingRotation: 0,
      interactionRadius: 2.35,
      entryPoint: new THREE.Vector3(this.dwCenterX - 5.6, this.y0, this.dwCenterZ),
      returnPoint: new THREE.Vector3(this.tableX, this.y0, this.tableZ - 1.88),
    };

    this.buildTabletopGardenPreview();
    this.buildFullScaleRomanticGardenSanctuary();

    // Register dynamic objects so lockStaticHierarchy preserves their per-frame transforms
    this.dynamicObjects.add(this.dreamWorldPortalRing);
    this.dynamicObjects.add(this.crownGroup);
    this.dynamicObjects.add(this.skyMessageGroup);
    this.dynamicObjects.add(this.fireworksPoints);

    // Add gentle collider around the couture throne dais inside the sanctuary so player cannot clip through the chair
    this.colliders.push({
      x: this.originX + this.dwCenterX + this.throneLocalX,
      z: this.originZ + this.dwCenterZ + this.throneLocalZ,
      radius: 0.65,
      y: this.baseY + this.y0,
      height: 2.2,
    });
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
  }

  public addCapturedPortraitToMemoryPath(portraitTex: THREE.Texture): void {
    if (this.memoryPortraitMaterials.length === 0) return;
    const mat =
      this.memoryPortraitMaterials[
        this.nextMemoryFrameIdx % this.memoryPortraitMaterials.length
      ];
    mat.map = portraitTex;
    mat.needsUpdate = true;
    this.nextMemoryFrameIdx += 1;
  }

  /**
   * Builds the miniature preview of the Intimate Romantic Garden Sanctuary on the
   * Doll Playroom display table at `(12.85, y0, 11.85)`.
   * Contains ZERO castle towers, walls, bridges, or text plaques.
   */
  private buildTabletopGardenPreview(): void {
    const { tracker, mats } = this;

    const tableGroup = new THREE.Group();
    tableGroup.name = 'TabletopGardenSanctuaryDisplay';
    tableGroup.position.set(this.tableX, this.y0, this.tableZ);
    this.parentGroup.add(tableGroup);

    // 1. Luxury Pearl & Champagne-Gold Pedestal Table
    const pedestalBaseGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.95, 1.08, 0.12, 24),
    );
    pedestalBaseGeo.translate(0, 0.06, 0);
    const pedestalPillarGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.42, 0.52, 0.4, 20),
    );
    pedestalPillarGeo.translate(0, 0.32, 0);
    const tableTopRimGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.18, 1.14, 0.08, 28),
    );
    tableTopRimGeo.translate(0, 0.52, 0);

    tableGroup.add(
      new THREE.Mesh(pedestalBaseGeo, mats.champagneGold),
      new THREE.Mesh(pedestalPillarGeo, mats.creamStone),
      new THREE.Mesh(tableTopRimGeo, mats.champagneGold),
    );

    // 2. Miniature Nighttime Velvet Grass Sanctuary Disc
    const miniGrassMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#173326',
        roughness: 0.85,
        metalness: 0.04,
      }),
    );
    const miniGrassGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.1, 1.12, 0.04, 28),
    );
    miniGrassGeo.translate(0, 0.57, 0);
    tableGroup.add(new THREE.Mesh(miniGrassGeo, miniGrassMat));

    // 3. Miniature Curved S-Shaped Pearl Stone Path (from South gate -Z to North throne +Z)
    const miniPearlMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        roughness: 0.24,
        metalness: 0.12,
      }),
    );
    const miniStoneGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.11, 0.12, 0.015, 14),
    );
    const sCurvePoints: [number, number][] = [
      [0.0, -0.78],
      [0.08, -0.58],
      [0.14, -0.38],
      [0.05, -0.18],
      [-0.08, 0.02],
      [-0.04, 0.22],
      [0.0, 0.42],
    ];
    for (let i = 0; i < sCurvePoints.length; i++) {
      const [sx, sz] = sCurvePoints[i];
      const stone = new THREE.Mesh(miniStoneGeo, miniPearlMat);
      stone.position.set(sx, 0.595, sz);
      stone.scale.set(1.15, 1.0, 0.85);
      tableGroup.add(stone);
    }

    // 4. Miniature 2-Step Circular Pearl Dais & Intimate Couture Throne at North side (+Z = 0.56)
    const miniDaisGroup = new THREE.Group();
    miniDaisGroup.position.set(0, 0.59, 0.56);
    const miniStep1Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.28, 0.3, 0.025, 20),
    );
    miniStep1Geo.translate(0, 0.0125, 0);
    const miniStep2Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.21, 0.23, 0.025, 20),
    );
    miniStep2Geo.translate(0, 0.0375, 0);
    miniDaisGroup.add(
      new THREE.Mesh(miniStep1Geo, miniPearlMat),
      new THREE.Mesh(miniStep2Geo, miniPearlMat),
    );

    const miniVelvetMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        roughness: 0.35,
        metalness: 0.08,
      }),
    );
    const miniGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#d8b467',
        roughness: 0.2,
        metalness: 0.85,
      }),
    );
    const miniSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.06, 0.12));
    miniSeatGeo.translate(0, 0.08, 0);
    const miniBackGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.08, 0.07, 0.18, 14),
    );
    miniBackGeo.scale(1.0, 1.0, 0.35);
    miniBackGeo.translate(0, 0.16, 0.045);
    const miniFrameGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.085, 0.012, 8, 18),
    );
    miniFrameGeo.translate(0, 0.17, 0.045);
    miniDaisGroup.add(
      new THREE.Mesh(miniSeatGeo, miniVelvetMat),
      new THREE.Mesh(miniBackGeo, miniVelvetMat),
      new THREE.Mesh(miniFrameGeo, miniGoldMat),
    );
    tableGroup.add(miniDaisGroup);

    // 5. Miniature Low Foliage & Sparse Blush/Lavender Blossoms around the perimeter
    const miniFoliageGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.075, 8, 8),
    );
    const miniBlossomGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.028, 6, 6),
    );
    const miniFoliageMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#1e3f2e', roughness: 0.78 }),
    );
    const miniBlossomMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.45,
        roughness: 0.35,
      }),
    );
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(angle), -Math.cos(angle))) < 0.42) {
        continue; // Keep South entry threshold clear
      }
      const r = 0.86 + (i % 2) * 0.08;
      const bx = Math.sin(angle) * r;
      const bz = -Math.cos(angle) * r;
      const bush = new THREE.Mesh(miniFoliageGeo, miniFoliageMat);
      bush.position.set(bx, 0.61, bz);
      bush.scale.set(1.2, 0.65, 1.1);
      tableGroup.add(bush);

      if (i % 2 === 0) {
        const bloom = new THREE.Mesh(miniBlossomGeo, miniBlossomMat);
        bloom.position.set(bx * 0.94, 0.64, bz * 0.94);
        tableGroup.add(bloom);
      }
    }

    // 6. Delicate Golden Garden Entry Threshold at South Rim (`z = -0.88`) — NO text signs
    this.tabletopGateArch = new THREE.Group();
    this.tabletopGateArch.position.set(0, 0.59, -0.88);
    const miniArchRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.14, 0.014, 10, 24, Math.PI),
    );
    miniArchRingGeo.translate(0, 0.12, 0);
    const miniPillarGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.014, 0.018, 0.12, 8),
    );
    miniPillarGeo.translate(0, 0.06, 0);
    const pillarL = new THREE.Mesh(miniPillarGeo, miniGoldMat);
    pillarL.position.x = -0.14;
    const pillarR = new THREE.Mesh(miniPillarGeo, miniGoldMat);
    pillarR.position.x = 0.14;

    this.tabletopPortalGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 0.95,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
      }),
    );
    const miniPortalDiscGeo = tracker.trackGeo(
      new THREE.CircleGeometry(0.125, 18),
    );
    miniPortalDiscGeo.translate(0, 0.11, 0);
    this.tabletopGateArch.add(
      new THREE.Mesh(miniArchRingGeo, miniGoldMat),
      pillarL,
      pillarR,
      new THREE.Mesh(miniPortalDiscGeo, this.tabletopPortalGlowMat),
    );
    tableGroup.add(this.tabletopGateArch);
  }

  /**
   * Builds the Full-Scale Secluded Nighttime Romantic Garden Sanctuary at `(33.0, y0, 12.0)`.
   * Strictly implements the 5 permitted visual elements with zero castle architecture and
   * only ONE text element in the sky ("I LOVE YOU ❤️").
   */
  private buildFullScaleRomanticGardenSanctuary(): void {
    const { tracker } = this;

    this.dwRoot = new THREE.Group();
    this.dwRoot.name = 'IntimateRomanticGardenSanctuary';
    this.dwRoot.position.set(this.dwCenterX, this.y0, this.dwCenterZ);
    this.parentGroup.add(this.dwRoot);

    // Shared Couture Sanctuary Materials
    const champagneGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#d8b467',
        roughness: 0.2,
        metalness: 0.85,
      }),
    );
    const blushVelvetMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#be185d',
        emissiveIntensity: 0.12,
        roughness: 0.38,
        metalness: 0.06,
      }),
    );
    const pearlMarbleMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        roughness: 0.22,
        metalness: 0.1,
      }),
    );
    const blushInlayMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        roughness: 0.18,
        metalness: 0.22,
      }),
    );
    const lavenderCrystalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#e9d5ff',
        emissive: '#c084fc',
        emissiveIntensity: 0.35,
        roughness: 0.14,
        metalness: 0.28,
      }),
    );

    // =========================================================================
    // ELEMENT 4: SECLUDED NIGHTTIME ROMANTIC GARDEN & CURVED S-PATH
    // =========================================================================
    // 1. Soft Nighttime Velvet Grass Clearing Plateau (`radius = 8.4m`)
    const nightGrassMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#13281d',
        roughness: 0.88,
        metalness: 0.04,
      }),
    );
    const innerClearingMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#193527',
        roughness: 0.82,
        metalness: 0.05,
      }),
    );
    const plateauGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(8.4, 8.65, 0.28, 48),
    );
    plateauGeo.translate(0, -0.14, 0);
    const clearingDiscGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(5.6, 5.8, 0.02, 40),
    );
    clearingDiscGeo.translate(1.2, 0.008, 0);
    this.dwRoot.add(
      new THREE.Mesh(plateauGeo, nightGrassMat),
      new THREE.Mesh(clearingDiscGeo, innerClearingMat),
    );

    // 2. Subtle West Return Threshold Ring at `(-6.8, 0, 0)` (Zero signs or castle arches)
    const portalRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(1.05, 0.035, 12, 36),
    );
    portalRingGeo.rotateY(Math.PI / 2);
    portalRingGeo.translate(0, 1.15, 0);
    const portalShimmerMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.dreamWorldPortalRing = new THREE.Mesh(portalRingGeo, portalShimmerMat);
    this.dreamWorldPortalRing.position.set(-6.8, 0.0, 0.0);
    this.dwRoot.add(this.dreamWorldPortalRing);

    // 3. Curved S-Shaped Pearl/Ivory Stone Path with Blush Trim & Lavender Crystal Inlays
    const sPathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.2, 0.015, 0.0),
      new THREE.Vector3(-4.2, 0.015, 0.58),
      new THREE.Vector3(-2.0, 0.015, 0.42),
      new THREE.Vector3(0.0, 0.015, -0.48),
      new THREE.Vector3(1.55, 0.015, -0.22),
      new THREE.Vector3(2.35, 0.015, 0.0),
    ]);

    const PATH_STONES = 26;
    const stoneStepGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.46, 0.49, 0.026, 20),
    );
    const stoneBorderGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.47, 0.018, 8, 20),
    );
    stoneBorderGeo.rotateX(Math.PI / 2);
    const inlayGemGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.045, 0),
    );

    const stonesInst = new THREE.InstancedMesh(
      stoneStepGeo,
      pearlMarbleMat,
      PATH_STONES,
    );
    const bordersInst = new THREE.InstancedMesh(
      stoneBorderGeo,
      blushInlayMat,
      PATH_STONES,
    );
    const inlaysInst = new THREE.InstancedMesh(
      inlayGemGeo,
      lavenderCrystalMat,
      PATH_STONES * 2,
    );

    for (let i = 0; i < PATH_STONES; i++) {
      const u = i / (PATH_STONES - 1);
      sPathCurve.getPoint(u, _scratchPos);
      const tangent = sPathCurve.getTangent(u);
      const yaw = Math.atan2(tangent.x, tangent.z);

      _scratchEuler.set(0, yaw, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.22, 1.0, 0.82);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      stonesInst.setMatrixAt(i, _scratchMatrix);

      _scratchPos.y += 0.012;
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bordersInst.setMatrixAt(i, _scratchMatrix);

      // Subtle lavender crystal inlays along left & right edges of each stepping stone
      const perpX = -tangent.z;
      const perpZ = tangent.x;
      for (let side = 0; side < 2; side++) {
        const sDir = side === 0 ? -1 : 1;
        _scratchPos.set(
          _scratchPos.x + perpX * sDir * 0.36,
          0.032,
          _scratchPos.z + perpZ * sDir * 0.36,
        );
        _scratchScale.set(1.0, 0.45, 1.0);
        _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
        inlaysInst.setMatrixAt(i * 2 + side, _scratchMatrix);
      }
    }
    stonesInst.instanceMatrix.needsUpdate = true;
    bordersInst.instanceMatrix.needsUpdate = true;
    inlaysInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(stonesInst, bordersInst, inlaysInst);

    // 4. Tiny Ground-Level Crystal Path Lights (brighten subtly as Harsha walks along the S-path)
    this.pathCrystalGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.2,
      }),
    );
    const pathLightGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.055, 0),
    );
    const PATH_LIGHTS = 18;
    const pathLightsInst = new THREE.InstancedMesh(
      pathLightGeo,
      this.pathCrystalGlowMat,
      PATH_LIGHTS,
    );
    for (let i = 0; i < PATH_LIGHTS; i++) {
      const u = (i + 0.5) / PATH_LIGHTS;
      sPathCurve.getPoint(u, _scratchPos);
      const tangent = sPathCurve.getTangent(u);
      const side = i % 2 === 0 ? 1 : -1;
      _scratchPos.x += -tangent.z * side * 0.68;
      _scratchPos.z += tangent.x * side * 0.68;
      _scratchPos.y = 0.045;
      _scratchEuler.set(0.2, i * 0.7, 0.15);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.0, 1.25, 1.0);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      pathLightsInst.setMatrixAt(i, _scratchMatrix);
    }
    pathLightsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(pathLightsInst);

    // 5. Gentle Low Perimeter Foliage, Sparse Low Flowers & Scattered Rose Petals (Generous Negative Space)
    const foliageGeo = tracker.trackGeo(new THREE.SphereGeometry(0.42, 10, 8));
    const foliageMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#163022',
        roughness: 0.82,
        metalness: 0.04,
      }),
    );
    this.gardenBlossomMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.35,
        roughness: 0.32,
      }),
    );
    const blossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.075, 8, 8));

    const BUSH_COUNT = 28;
    const bushesInst = new THREE.InstancedMesh(
      foliageGeo,
      foliageMat,
      BUSH_COUNT,
    );
    const bloomsInst = new THREE.InstancedMesh(
      blossomGeo,
      this.gardenBlossomMat,
      BUSH_COUNT,
    );

    for (let i = 0; i < BUSH_COUNT; i++) {
      const angle = (i / BUSH_COUNT) * Math.PI * 2;
      // Leave the West return threshold (-X) and the East sky view behind the throne (+X) open and low
      const isEastVista = Math.cos(angle) > 0.55;
      const isWestPortal = Math.cos(angle) < -0.88;
      const r = isWestPortal ? 7.6 : 6.6 + ((i * 7) % 5) * 0.28;
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;
      const scaleY = isEastVista ? 0.32 : 0.48 + (i % 3) * 0.12;

      _scratchPos.set(bx, scaleY * 0.26, bz);
      _scratchEuler.set(0, angle, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.25, scaleY, 1.15);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bushesInst.setMatrixAt(i, _scratchMatrix);

      _scratchPos.set(bx * 0.96, scaleY * 0.42 + 0.04, bz * 0.96);
      _scratchScale.set(1.1, 0.75, 1.1);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bloomsInst.setMatrixAt(i, _scratchMatrix);
    }
    bushesInst.instanceMatrix.needsUpdate = true;
    bloomsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(bushesInst, bloomsInst);

    // Subtle scattered rose petals on the grass around the clearing and S-path
    const petalGeo = tracker.trackGeo(new THREE.CircleGeometry(0.042, 7));
    petalGeo.rotateX(-Math.PI / 2);
    const petalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#be123c',
        emissiveIntensity: 0.22,
        roughness: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    const PETAL_COUNT = 48;
    const petalsInst = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_COUNT);
    for (let i = 0; i < PETAL_COUNT; i++) {
      const u = (i / PETAL_COUNT) * 0.95;
      sPathCurve.getPoint(u, _scratchPos);
      const offsetAngle = i * 2.39996;
      const offsetDist = 0.55 + (i % 5) * 0.34;
      _scratchPos.x += Math.cos(offsetAngle) * offsetDist;
      _scratchPos.z += Math.sin(offsetAngle) * offsetDist;
      _scratchPos.y = 0.018;
      _scratchEuler.set(0, offsetAngle, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.2, 1.0, 0.85);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      petalsInst.setMatrixAt(i, _scratchMatrix);
    }
    petalsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(petalsInst);

    // =========================================================================
    // ELEMENT 3: HER THRONE (INTIMATE HUMAN-SCALE COUTURE THRONE ON 2-STEP PEARL DAIS)
    // =========================================================================
    const throneSanctuaryGroup = new THREE.Group();
    throneSanctuaryGroup.name = 'HarshaCoutureThroneSanctuary';
    throneSanctuaryGroup.position.set(this.throneLocalX, 0.0, this.throneLocalZ);
    // Face West (-X) toward the approaching curved S-path and finale camera
    throneSanctuaryGroup.rotation.y = -Math.PI / 2;
    this.dwRoot.add(throneSanctuaryGroup);

    // 1. Circular Pearl-Marble Dais (Maximum 2 low steps: 0.11m + 0.11m = 0.22m total)
    const step1Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.62, 1.72, 0.11, 36),
    );
    step1Geo.translate(0, 0.055, 0);
    const step2Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.22, 1.3, 0.11, 36),
    );
    step2Geo.translate(0, 0.165, 0);
    throneSanctuaryGroup.add(
      new THREE.Mesh(step1Geo, pearlMarbleMat),
      new THREE.Mesh(step2Geo, pearlMarbleMat),
    );

    // Subtle warm underglow rings beneath the 2 dais steps
    this.throneUnderglowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f472b6',
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    const underglowRing1Geo = tracker.trackGeo(
      new THREE.TorusGeometry(1.64, 0.018, 10, 36),
    );
    underglowRing1Geo.rotateX(Math.PI / 2);
    underglowRing1Geo.translate(0, 0.11, 0);
    const underglowRing2Geo = tracker.trackGeo(
      new THREE.TorusGeometry(1.24, 0.016, 10, 36),
    );
    underglowRing2Geo.rotateX(Math.PI / 2);
    underglowRing2Geo.translate(0, 0.22, 0);
    throneSanctuaryGroup.add(
      new THREE.Mesh(underglowRing1Geo, this.throneUnderglowMat),
      new THREE.Mesh(underglowRing2Geo, this.throneUnderglowMat),
    );

    // 2. Intimate Human-Scale Couture Throne (placed at dais top y = 0.22m)
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, this.daisTopY, 0);
    throneSanctuaryGroup.add(chairGroup);

    // Sculpted Champagne-Gold Base & Legs
    const seatFrameGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.42, 0.46, 0.12, 24),
    );
    seatFrameGeo.scale(1.15, 1.0, 0.95);
    seatFrameGeo.translate(0, 0.36, 0);
    chairGroup.add(new THREE.Mesh(seatFrameGeo, champagneGoldMat));

    const legGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.032, 0.022, 0.36, 10),
    );
    legGeo.translate(0, 0.18, 0);
    const legOffsets: [number, number][] = [
      [-0.36, 0.26],
      [0.36, 0.26],
      [-0.38, -0.26],
      [0.38, -0.26],
    ];
    for (let i = 0; i < legOffsets.length; i++) {
      const [lx, lz] = legOffsets[i];
      const leg = new THREE.Mesh(legGeo, champagneGoldMat);
      leg.position.set(lx, 0, lz);
      chairGroup.add(leg);
    }

    // Plush Blush Velvet Seat Cushion (`y = 0.42m..0.52m` above dais)
    const cushionGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.39, 0.41, 0.11, 24),
    );
    cushionGeo.scale(1.12, 1.0, 0.92);
    cushionGeo.translate(0, 0.46, 0.02);
    chairGroup.add(new THREE.Mesh(cushionGeo, blushVelvetMat));

    // Curved Graceful Armrests
    const armRestGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.24, 0.024, 10, 20, Math.PI * 0.75),
    );
    [-0.42, 0.42].forEach((ax) => {
      const arm = new THREE.Mesh(armRestGeo, champagneGoldMat);
      arm.position.set(ax, 0.56, 0.04);
      arm.rotation.y = Math.PI / 2;
      arm.rotation.z = Math.PI * 0.12;
      chairGroup.add(arm);
    });

    // Heart-Inspired Couture Backrest Silhouette (Blush Velvet + Champagne-Gold Filigree Rim)
    const heartBackLobeGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.26, 0.22, 0.78, 20),
    );
    heartBackLobeGeo.scale(1.0, 1.0, 0.28);
    const lobeL = new THREE.Mesh(heartBackLobeGeo, blushVelvetMat);
    lobeL.position.set(-0.14, 0.92, -0.28);
    lobeL.rotation.z = -0.14;
    const lobeR = new THREE.Mesh(heartBackLobeGeo, blushVelvetMat);
    lobeR.position.set(0.14, 0.92, -0.28);
    lobeR.rotation.z = 0.14;
    chairGroup.add(lobeL, lobeR);

    const filigreeRimGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.27, 0.022, 10, 24, Math.PI * 1.15),
    );
    const rimL = new THREE.Mesh(filigreeRimGeo, champagneGoldMat);
    rimL.position.set(-0.15, 1.12, -0.28);
    rimL.rotation.z = 0.22;
    const rimR = new THREE.Mesh(filigreeRimGeo, champagneGoldMat);
    rimR.position.set(0.15, 1.12, -0.28);
    rimR.rotation.z = -0.22;
    chairGroup.add(rimL, rimR);

    // Delicate Crown/Heart Crest at the Top of the Throne (`y = 1.44m` above dais)
    const throneGemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#e11d48',
        emissiveIntensity: 0.65,
        roughness: 0.12,
        metalness: 0.2,
      }),
    );
    const crestHeartGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.055, 1),
    );
    crestHeartGeo.scale(1.15, 1.25, 0.55);
    const crestHeart = new THREE.Mesh(crestHeartGeo, throneGemMat);
    crestHeart.position.set(0, 1.44, -0.27);
    chairGroup.add(crestHeart);

    // =========================================================================
    // ELEMENT 1 (SECONDARY): QUIET WITNESSING YESHWANTH FIGURE
    // Placed respectfully off to the side at `(2.05, 0, -1.65)` facing Harsha,
    // subdued lighting, zero competing hero animation.
    // =========================================================================
    const witnessGroup = new THREE.Group();
    witnessGroup.name = 'WitnessingYeshwanth';
    witnessGroup.position.set(2.05, 0.0, -1.65);
    witnessGroup.rotation.y = Math.atan2(
      this.throneLocalX - 2.05,
      this.throneLocalZ - -1.65,
    );
    const suitMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.65,
        metalness: 0.12,
      }),
    );
    const skinMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f1c27d',
        roughness: 0.55,
      }),
    );
    const hairMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#18181b',
        roughness: 0.7,
      }),
    );
    const torsoGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.17, 0.15, 0.62, 12),
    );
    torsoGeo.translate(0, 1.05, 0);
    const legsGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.14, 0.12, 0.74, 12),
    );
    legsGeo.translate(0, 0.37, 0);
    const headGeo = tracker.trackGeo(new THREE.SphereGeometry(0.125, 14, 12));
    headGeo.translate(0, 1.5, 0);
    const hairCapGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.132, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    );
    hairCapGeo.translate(0, 1.52, -0.01);
    witnessGroup.add(
      new THREE.Mesh(legsGeo, suitMat),
      new THREE.Mesh(torsoGeo, suitMat),
      new THREE.Mesh(headGeo, skinMat),
      new THREE.Mesh(hairCapGeo, hairMat),
    );
    this.dwRoot.add(witnessGroup);

    // =========================================================================
    // ELEMENT 2: HER CROWN (DELICATE PRINCESS TIARA, 70-80% HEAD WIDTH)
    // Champagne gold (#d8b467), filigree peaks, central ruby-pink heart gem (#f43f5e),
    // and clear/lavender side stones (#e9d5ff).
    // =========================================================================
    this.crownGroup = new THREE.Group();
    this.crownGroup.name = 'HarshaPrincessTiara';
    // Initial resting position floating gently above the throne before rising
    this.crownGroup.position.set(this.throneLocalX - 0.35, 1.88, this.throneLocalZ);
    this.crownGroup.rotation.y = -Math.PI / 2;
    this.dwRoot.add(this.crownGroup);

    // Tiara Base Band (`radius = 0.135m`, 75% of avatar head width, open-back semicircular tiara)
    const tiaraBandGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.135, 0.01, 10, 28, Math.PI * 1.35),
    );
    tiaraBandGeo.rotateX(Math.PI / 2);
    tiaraBandGeo.rotateY(-Math.PI * 0.175);
    this.crownGroup.add(new THREE.Mesh(tiaraBandGeo, champagneGoldMat));

    // Delicate Filigree Peaks & Side Arches
    const peakAngles = [-0.85, -0.42, 0.0, 0.42, 0.85];
    const peakHeights = [0.032, 0.052, 0.078, 0.052, 0.032];
    const sideGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.014, 0));

    for (let i = 0; i < peakAngles.length; i++) {
      const ang = peakAngles[i];
      const ph = peakHeights[i];
      const px = Math.sin(ang) * 0.135;
      const pz = Math.cos(ang) * 0.135;

      const archGeo = tracker.trackGeo(
        new THREE.ConeGeometry(0.014, ph, 8),
      );
      archGeo.translate(0, ph * 0.5, 0);
      const peakMesh = new THREE.Mesh(archGeo, champagneGoldMat);
      peakMesh.position.set(px, 0.006, pz);
      this.crownGroup.add(peakMesh);

      if (i !== 2) {
        const sideStone = new THREE.Mesh(sideGemGeo, lavenderCrystalMat);
        sideStone.position.set(px, ph * 0.65, pz + 0.008);
        this.crownGroup.add(sideStone);
      }
    }

    // Central Heart-Shaped Ruby-Pink Gemstone (`#f43f5e`, emissive 0.3 -> 1.4 upon settling)
    this.crownHeartGemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#f43f5e',
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.18,
      }),
    );
    const heartGemGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.024, 1),
    );
    heartGemGeo.scale(1.15, 1.25, 0.6);
    const centralHeartGem = new THREE.Mesh(heartGemGeo, this.crownHeartGemMat);
    centralHeartGem.position.set(0, 0.048, 0.142);
    this.crownGroup.add(centralHeartGem);

    // =========================================================================
    // ELEMENT 5A: WORLD-SPACE 3D SKY MESSAGE ("I LOVE YOU ❤️")
    // Placed high in the open sky behind the throne (`localX = 11.2, localY = 5.15, localZ = 0`),
    // facing West (`-X`) toward the finale camera so every character ("I" through "❤️")
    // sits comfortably inside the final camera frustum.
    // =========================================================================
    this.skyMessageGroup = new THREE.Group();
    this.skyMessageGroup.name = 'SkyLoveMessage3D';
    this.skyMessageGroup.position.set(11.2, 5.15, 0.0);
    this.skyMessageGroup.rotation.y = -Math.PI / 2;
    this.skyMessageGroup.visible = false;
    this.dwRoot.add(this.skyMessageGroup);

    const frontTex = createSkyLoveReliefTexture(tracker, false);
    const backTex = createSkyLoveReliefTexture(tracker, true);

    this.skyFrontTextMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: frontTex,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    this.skyBackReliefMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: backTex,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );

    const skyPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(5.8, 1.45));
    const frontTextMesh = new THREE.Mesh(skyPlaneGeo, this.skyFrontTextMat);
    frontTextMesh.position.z = 0.06;
    const midReliefMesh = new THREE.Mesh(skyPlaneGeo, this.skyBackReliefMat);
    midReliefMesh.position.z = 0.0;
    const backReliefMesh = new THREE.Mesh(skyPlaneGeo, this.skyBackReliefMat);
    backReliefMesh.position.z = -0.06;
    this.skyMessageGroup.add(backReliefMesh, midReliefMesh, frontTextMesh);

    // Sculpted 3D Heart ("❤️") beside "I LOVE YOU" in world-space 3D geometry
    this.skyHeartGemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#f43f5e',
        emissiveIntensity: 1.35,
        roughness: 0.15,
        metalness: 0.25,
        transparent: true,
        opacity: 0.0,
      }),
    );
    const skyHeartGroup = new THREE.Group();
    skyHeartGroup.position.set(2.08, 0.04, 0.04);
    const skyLobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.16, 14, 12));
    skyLobeGeo.scale(1.0, 1.05, 0.55);
    const skyLobeL = new THREE.Mesh(skyLobeGeo, this.skyHeartGemMat);
    skyLobeL.position.set(-0.11, 0.08, 0);
    const skyLobeR = new THREE.Mesh(skyLobeGeo, this.skyHeartGemMat);
    skyLobeR.position.set(0.11, 0.08, 0);
    const skyHeartTipGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.24, 0.32, 14),
    );
    skyHeartTipGeo.rotateX(Math.PI);
    skyHeartTipGeo.scale(1.0, 1.0, 0.48);
    skyHeartTipGeo.translate(0, -0.1, 0);
    const skyHeartTip = new THREE.Mesh(skyHeartTipGeo, this.skyHeartGemMat);
    skyHeartGroup.add(skyLobeL, skyLobeR, skyHeartTip);
    this.skyMessageGroup.add(skyHeartGroup);

    // =========================================================================
    // ELEMENT 5B: PRESERVED FINALE FIREWORKS SYSTEM (`buildFinaleFireworksSystem`)
    // =========================================================================
    this.buildFinaleFireworksSystem();

    // =========================================================================
    // WARM INTIMATE SANCTUARY LIGHTING (Single warm key light focused on Harsha & Throne)
    // =========================================================================
    this.sanctuaryKeyLight = new THREE.PointLight('#fff1f2', 1.45, 14.0, 1.6);
    this.sanctuaryKeyLight.position.set(this.throneLocalX - 1.2, 2.8, 0.0);
    this.dwRoot.add(this.sanctuaryKeyLight);
  }

  /**
   * Preserved `buildFinaleFireworksSystem()` particle buffer engine.
   * Configured for the 3 sparse, romantic bursts:
   * 1. Firework 1 (`t = 0.0s`): Gold launch -> forms a Heart (champagne gold + rose pink)
   * 2. Firework 2 (`+1.2s`): Left sky -> forms a Flower (blush + lavender)
   * 3. Firework 3 (`+2.4s`): Right sky -> forms a Star (champagne gold)
   */
  private buildFinaleFireworksSystem(): void {
    const { tracker } = this;
    const count = this.FIREWORKS_COUNT;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -999.0;
      this.fwAges[i] = 99.0;
      this.fwLifetimes[i] = 1.0;
    }

    const fwGeo = tracker.trackGeo(new THREE.BufferGeometry());
    this.fireworksPosAttr = new THREE.BufferAttribute(positions, 3);
    this.fireworksColorAttr = new THREE.BufferAttribute(colors, 3);
    fwGeo.setAttribute('position', this.fireworksPosAttr);
    fwGeo.setAttribute('color', this.fireworksColorAttr);

    const glowTex = createSoftParticleGlowTexture(tracker);
    const fwMat = tracker.trackMat(
      new THREE.PointsMaterial({
        size: 0.34,
        map: glowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    this.fireworksPoints = new THREE.Points(fwGeo, fwMat);
    this.fireworksPoints.frustumCulled = false;
    this.fireworksPoints.visible = false;
    this.dwRoot.add(this.fireworksPoints);
  }

  private launchFireworkBurst(
    slotOffset: number,
    particleCount: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    pattern: 'heart' | 'flower' | 'star',
  ): void {
    for (let i = 0; i < particleCount; i++) {
      const idx = (slotOffset + i) % this.FIREWORKS_COUNT;
      const i3 = idx * 3;
      const t = (i / particleCount) * Math.PI * 2;

      this.fwOrigins[i3] = centerX;
      this.fwOrigins[i3 + 1] = centerY;
      this.fwOrigins[i3 + 2] = centerZ;

      let vy = 0;
      let vz = 0;
      let vx = (Math.sin(i * 12.9898) * 0.5) * 0.28;

      if (pattern === 'heart') {
        // Parametric 3D heart in the Y-Z plane (facing the finale camera along +X)
        const hx = 16 * Math.pow(Math.sin(t), 3) * 0.085;
        const hy =
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
          0.085;
        vz = hx;
        vy = hy;
        // Champagne gold (#fde047) + Rose pink (#f43f5e)
        _scratchColor.set(i % 2 === 0 ? '#fde047' : '#f43f5e');
      } else if (pattern === 'flower') {
        // 6-petal botanical rose/blossom burst in the Y-Z plane
        const r = (0.55 + 0.45 * Math.cos(6 * t)) * 1.25;
        vz = Math.cos(t) * r;
        vy = Math.sin(t) * r;
        // Blush (#fbcfe8) + Lavender (#e9d5ff)
        _scratchColor.set(i % 2 === 0 ? '#fbcfe8' : '#e9d5ff');
      } else {
        // 5-pointed star burst in the Y-Z plane
        const starWave = Math.abs(((t / (Math.PI * 2)) * 5) % 1 - 0.5) * 2.0;
        const r = (0.48 + 0.72 * Math.pow(starWave, 1.4)) * 1.28;
        vz = Math.cos(t) * r;
        vy = Math.sin(t) * r;
        // Champagne gold (#fde047)
        _scratchColor.set(i % 3 === 0 ? '#fffbeb' : '#fde047');
      }

      this.fwVelocities[i3] = vx;
      this.fwVelocities[i3 + 1] = vy;
      this.fwVelocities[i3 + 2] = vz;

      this.fwBaseColors[i3] = _scratchColor.r;
      this.fwBaseColors[i3 + 1] = _scratchColor.g;
      this.fwBaseColors[i3 + 2] = _scratchColor.b;

      this.fwAges[idx] = 0.0;
      this.fwLifetimes[idx] = 2.6 + (i % 5) * 0.18;
    }
  }

  private resetFireworksAndSkyMessage(): void {
    this.fireworksBurst1Launched = false;
    this.fireworksBurst2Launched = false;
    this.fireworksBurst3Launched = false;
    this.fireworksElapsed = 0.0;
    if (this.fireworksPoints) {
      this.fireworksPoints.visible = false;
    }
    if (this.skyMessageGroup) {
      this.skyMessageGroup.visible = false;
      this.skyFrontTextMat.opacity = 0.0;
      this.skyBackReliefMat.opacity = 0.0;
      this.skyHeartGemMat.opacity = 0.0;
    }
  }

  // ===========================================================================
  // PROXIMITY & TRIGGER CONTRACTS
  // ===========================================================================
  public isNearTabletopGate(lx: number, lz: number): boolean {
    if (this.isInsideLittleDreamWorld) return false;
    return (
      Math.hypot(
        lx - this.entranceSpec.position.x,
        lz - this.entranceSpec.position.z,
      ) <= this.entranceSpec.interactionRadius
    );
  }

  public isNearDreamWorldReturnGate(lx: number, lz: number): boolean {
    const dlx = lx - this.dwCenterX;
    const dlz = lz - this.dwCenterZ;
    return Math.hypot(dlx - -6.4, dlz - 0.0) <= 2.35;
  }

  public isNearGoldenYeshwanth(lx: number, lz: number): boolean {
    const dlx = lx - this.dwCenterX;
    const dlz = lz - this.dwCenterZ;
    return Math.hypot(dlx - this.throneLocalX, dlz - this.throneLocalZ) <= 2.85;
  }

  public triggerEnterLittleDreamWorld(): boolean {
    if (this.state !== 'IDLE') return false;
    this.state = 'ENTERING';
    this.stateElapsed = 0.0;
    this.hasCompletedEntryTeleport = false;
    this.hasEquippedCrownInSequence = false;
    this.lookYawOffset = 0.0;
    this.lookPitchOffset = 0.0;
    this.resetFireworksAndSkyMessage();

    // Reset crown to initial floating shrine position above the throne
    this.crownGroup.visible = true;
    this.crownGroup.position.set(this.throneLocalX - 0.38, 1.92, this.throneLocalZ);
    this.crownHeartGemMat.emissiveIntensity = 0.3;
    this.throneUnderglowMat.emissiveIntensity = 0.55;
    return true;
  }

  public triggerReplayGoldenYeshwanthStory(): boolean {
    if (this.state !== 'IDLE') return false;
    this.isInsideLittleDreamWorld = true;
    this.state = 'CROWN_RISING';
    this.stateElapsed = 0.0;
    this.hasEquippedCrownInSequence = false;
    this.lookYawOffset = 0.0;
    this.lookPitchOffset = 0.0;
    this.resetFireworksAndSkyMessage();

    this.crownGroup.visible = true;
    this.crownGroup.position.set(this.throneLocalX - 0.38, 1.92, this.throneLocalZ);
    this.crownHeartGemMat.emissiveIntensity = 0.3;
    this.throneUnderglowMat.emissiveIntensity = 0.55;
    return true;
  }

  public triggerExitLittleDreamWorld(): boolean {
    if (this.state !== 'IDLE' && this.state !== 'FINAL_HOLD') return false;
    this.state = 'EXITING';
    this.stateElapsed = 0.0;
    this.hasCompletedExitTeleport = false;
    this.resetFireworksAndSkyMessage();
    return true;
  }

  public isTransitionActive(): boolean {
    return this.state !== 'IDLE';
  }

  public isFreeCameraWindowActive(): boolean {
    return this.state === 'FINAL_HOLD';
  }

  public isWaitingForCrownInteract(): boolean {
    return false;
  }

  public applyFocusLookDelta(deltaYaw: number, deltaPitch: number): void {
    if (this.state !== 'FINAL_HOLD') return;
    this.lookYawOffset = THREE.MathUtils.clamp(
      this.lookYawOffset + deltaYaw,
      -0.35,
      0.35,
    );
    this.lookPitchOffset = THREE.MathUtils.clamp(
      this.lookPitchOffset + deltaPitch,
      -0.25,
      0.25,
    );
  }

  public updateFocusPositionOffset(
    _delta: number,
    _moveForward: number,
    _moveRight: number,
    _moveUp: number,
  ): void {
    // Camera path is authoritatively choreographed during the sanctuary ceremony
  }

  /**
   * Section 11 & 12: ZERO dialogue cards or subtitles in the Mini World.
   */
  public getCurrentDialogue(): null {
    return null;
  }

  /**
   * Section 11 & 12: ZERO story captions or top banners in the Mini World.
   */
  public getStoryCaption(): null {
    return null;
  }

  public advanceOrContinueCinematic(): boolean {
    if (this.state === 'IDLE') return false;
    if (this.state === 'ENTERING') {
      this.completeWorldEntryTeleport();
      this.state = 'GARDEN';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'GARDEN') {
      this.state = 'CROWN_RISING';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'CROWN_RISING' || this.state === 'CROWN_SETTLING') {
      this.equipCrownOnHarsha();
      this.state = 'QUIET_PAUSE';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'QUIET_PAUSE') {
      this.finaleStartCamLocalPos.copy(this.currentCamLocalPos);
      this.finaleStartLookLocalPos.copy(this.currentLookLocalPos);
      this.state = 'FINALE_CAMERA';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'FINALE_CAMERA' || this.state === 'FIREWORKS') {
      this.state = 'FINAL_HOLD';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'FINAL_HOLD') {
      this.completeRestoreControl();
      return true;
    }
    if (this.state === 'EXITING') {
      this.completeWorldExitTeleport();
      this.state = 'IDLE';
      this.stateElapsed = 0.0;
      return true;
    }
    return true;
  }

  public skipCinematic(): boolean {
    if (this.state === 'IDLE') return false;
    if (this.state === 'EXITING') {
      this.completeWorldExitTeleport();
      this.state = 'IDLE';
      this.stateElapsed = 0.0;
      return true;
    }
    if (!this.hasCompletedEntryTeleport) {
      this.completeWorldEntryTeleport();
    }
    this.equipCrownOnHarsha();
    this.completeRestoreControl();
    return true;
  }

  private equipCrownOnHarsha(): void {
    if (!this.hasEquippedCrownInSequence) {
      this.hasEquippedCrownInSequence = true;
      this.avatarBridge?.setJewelleryEquipped({ crownEquipped: true });
      this.crownGroup.visible = false;
      this.crownHeartGemMat.emissiveIntensity = 1.4;
      this.throneUnderglowMat.emissiveIntensity = 1.35;
      this.gardenBlossomMat.emissiveIntensity = 0.85;
    }
  }

  private completeWorldEntryTeleport(): void {
    if (this.hasCompletedEntryTeleport) return;
    this.hasCompletedEntryTeleport = true;
    this.isInsideLittleDreamWorld = true;
    this.avatarBridge?.setRoseHeld?.(false);
    this.pendingTeleport = {
      pos: _scratchTeleportPos.set(
        this.originX + this.entranceSpec.entryPoint.x,
        this.baseY + this.y0,
        this.originZ + this.entranceSpec.entryPoint.z,
      ),
      yaw: Math.PI / 2,
    };
  }

  /**
   * Restores player exploration control cleanly inside the garden sanctuary
   * after `FINAL_HOLD` completes.
   */
  private completeRestoreControl(): void {
    this.state = 'RESTORE_CONTROL';
    this.isInsideLittleDreamWorld = true;
    // Place Harsha cleanly on the pearl clearing just in front of her throne steps
    this.pendingTeleport = {
      pos: _scratchTeleportPos.set(
        this.originX + this.dwCenterX + 1.45,
        this.baseY + this.y0,
        this.originZ + this.dwCenterZ,
      ),
      yaw: -Math.PI / 2,
    };
    this.state = 'IDLE';
    this.stateElapsed = 0.0;
    this.lookYawOffset = 0.0;
    this.lookPitchOffset = 0.0;
  }

  /**
   * Section 19: Exiting the Mini World ALWAYS returns the player to the safe Floor 2
   * Doll Playroom return position (`y = baseY + 5.25m`), NEVER Floor 3.
   */
  private completeWorldExitTeleport(): void {
    if (this.hasCompletedExitTeleport) return;
    this.hasCompletedExitTeleport = true;
    this.isInsideLittleDreamWorld = false;
    this.pendingTeleport = {
      pos: _scratchTeleportPos.set(
        this.originX + this.entranceSpec.returnPoint.x,
        this.baseY + this.y0,
        this.originZ + this.entranceSpec.returnPoint.z,
      ),
      yaw: Math.PI,
    };
  }

  public consumePendingTeleport(): { pos: THREE.Vector3; yaw: number } | null {
    const out = this.pendingTeleport;
    this.pendingTeleport = null;
    return out;
  }

  // ===========================================================================
  // AUTHORITATIVE CAMERA & AVATAR POSE CHOREOGRAPHY
  // ===========================================================================
  public getTransitionCameraState(): MiniWorldTransitionCameraState {
    if (this.state === 'IDLE') {
      return {
        active: false,
        phase: 'IDLE',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 0.0,
        fov: 52.0,
      };
    }

    const dwWorldX = this.originX + this.dwCenterX;
    const dwWorldY = this.baseY + this.y0;
    const dwWorldZ = this.originZ + this.dwCenterZ;

    // 1. ENTERING (Tabletop Gate in Floor 2 Doll Playroom)
    if (this.state === 'ENTERING') {
      const u = smoothStep01(
        THREE.MathUtils.clamp(this.stateElapsed / this.DUR_ENTERING, 0, 1),
      );
      const gateWorldX = this.originX + this.entranceSpec.position.x;
      const gateWorldY = this.baseY + this.entranceSpec.position.y;
      const gateWorldZ = this.originZ + this.entranceSpec.position.z;

      _scratchCamWorldPos.set(
        gateWorldX,
        THREE.MathUtils.lerp(gateWorldY + 0.55, gateWorldY + 0.16, u),
        THREE.MathUtils.lerp(gateWorldZ - 1.15, gateWorldZ - 0.18, u),
      );
      _scratchLookWorldPos.set(
        gateWorldX,
        gateWorldY + 0.12,
        gateWorldZ + 0.55,
      );
      return {
        active: true,
        phase: 'ENTERING',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: smoothStep01(Math.min(1.0, this.stateElapsed / 0.35)),
        fov: THREE.MathUtils.lerp(50.0, 42.0, u),
      };
    }

    // 2. EXITING (Returning to Floor 2 Doll Playroom)
    if (this.state === 'EXITING') {
      const u = smoothStep01(
        THREE.MathUtils.clamp(this.stateElapsed / this.DUR_EXITING, 0, 1),
      );
      const gateWorldX = this.originX + this.entranceSpec.position.x;
      const gateWorldY = this.baseY + this.entranceSpec.position.y;
      const gateWorldZ = this.originZ + this.entranceSpec.position.z;

      _scratchCamWorldPos.set(
        gateWorldX,
        THREE.MathUtils.lerp(gateWorldY + 0.18, gateWorldY + 0.85, u),
        THREE.MathUtils.lerp(gateWorldZ - 0.25, gateWorldZ - 1.65, u),
      );
      _scratchLookWorldPos.set(
        gateWorldX,
        gateWorldY + 0.15,
        gateWorldZ + 0.45,
      );
      return {
        active: true,
        phase: 'EXITING',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 1.0 - smoothStep01(Math.max(0, (u - 0.65) / 0.35)),
        fov: THREE.MathUtils.lerp(44.0, 54.0, u),
      };
    }

    // 3. GARDEN (Harsha walks gently along the curved S-path and takes her seat on the couture throne)
    if (this.state === 'GARDEN') {
      const u = smoothStep01(
        THREE.MathUtils.clamp(this.stateElapsed / this.DUR_GARDEN, 0, 1),
      );

      // Harsha's path progression from (-4.6, 0, 0.25) to the throne seat (3.32, 0.22, 0)
      const walkU = smoothStep01(THREE.MathUtils.clamp(u / 0.82, 0, 1));
      const sCurveZ = Math.sin(walkU * Math.PI * 2.0) * 0.42 * (1.0 - walkU);
      const harshaLocalX = THREE.MathUtils.lerp(-4.6, this.throneLocalX - 0.03, walkU);
      const harshaLocalY =
        walkU > 0.78
          ? THREE.MathUtils.lerp(0.0, this.daisTopY, (walkU - 0.78) / 0.22)
          : 0.0;
      const harshaLocalZ = sCurveZ;

      const isSeatedNow = u >= 0.84;
      const turnU = smoothStep01(THREE.MathUtils.clamp((u - 0.72) / 0.24, 0, 1));
      const seatYaw = THREE.MathUtils.lerp(Math.PI / 2, -Math.PI / 2, turnU);

      _scratchSeatWorldPos.set(
        dwWorldX + harshaLocalX,
        dwWorldY + harshaLocalY,
        dwWorldZ + harshaLocalZ,
      );

      // Smooth accompanying camera glide coming to rest at the intimate throne framing
      this.currentCamLocalPos.set(
        THREE.MathUtils.lerp(-2.2, 0.95, u),
        THREE.MathUtils.lerp(1.75, 1.56, u),
        THREE.MathUtils.lerp(-1.35, 0.0, u),
      );
      this.currentLookLocalPos.set(
        THREE.MathUtils.lerp(harshaLocalX + 0.6, this.throneLocalX, u),
        THREE.MathUtils.lerp(1.25, 1.36, u),
        THREE.MathUtils.lerp(harshaLocalZ, 0.0, u),
      );
      this.currentFov = THREE.MathUtils.lerp(50.0, 45.0, u);

      _scratchCamWorldPos.set(
        dwWorldX + this.currentCamLocalPos.x,
        dwWorldY + this.currentCamLocalPos.y,
        dwWorldZ + this.currentCamLocalPos.z,
      );
      _scratchLookWorldPos.set(
        dwWorldX + this.currentLookLocalPos.x,
        dwWorldY + this.currentLookLocalPos.y,
        dwWorldZ + this.currentLookLocalPos.z,
      );

      return {
        active: true,
        phase: 'GARDEN',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 1.0,
        fov: this.currentFov,
        seatWorldPos: _scratchSeatWorldPos,
        seatYaw,
        isSitting: isSeatedNow,
      };
    }

    // Harsha remains seated gracefully on her couture throne for all subsequent ceremony states
    _scratchSeatWorldPos.set(
      dwWorldX + this.throneLocalX - 0.03,
      dwWorldY + this.daisTopY,
      dwWorldZ + this.throneLocalZ,
    );
    const seatedYaw = -Math.PI / 2;

    // 4. CROWN_RISING & CROWN_SETTLING (2.2s total) + QUIET_PAUSE (2.8s complete stillness)
    if (
      this.state === 'CROWN_RISING' ||
      this.state === 'CROWN_SETTLING' ||
      this.state === 'QUIET_PAUSE'
    ) {
      // Intimate, completely steady framing on Harsha seated on her throne
      this.currentCamLocalPos.set(0.95, 1.56, 0.0);
      this.currentLookLocalPos.set(this.throneLocalX, 1.36, 0.0);
      this.currentFov = 45.0;

      _scratchCamWorldPos.set(
        dwWorldX + this.currentCamLocalPos.x,
        dwWorldY + this.currentCamLocalPos.y,
        dwWorldZ + this.currentCamLocalPos.z,
      );
      _scratchLookWorldPos.set(
        dwWorldX + this.currentLookLocalPos.x,
        dwWorldY + this.currentLookLocalPos.y,
        dwWorldZ + this.currentLookLocalPos.z,
      );

      return {
        active: true,
        phase: this.state,
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 1.0,
        fov: this.currentFov,
        seatWorldPos: _scratchSeatWorldPos,
        seatYaw: seatedYaw,
        isSitting: true,
      };
    }

    // 5. FINALE_CAMERA, FIREWORKS & FINAL_HOLD
    // Single smooth backward + upward pull-back with cubic smoothstep easing (`DUR_FINALE_CAMERA = 3.5s`)
    let pullProgress = 1.0;
    if (this.state === 'FINALE_CAMERA') {
      pullProgress = THREE.MathUtils.clamp(
        this.stateElapsed / this.DUR_FINALE_CAMERA,
        0,
        1,
      );
    } else if (this.state === 'FIREWORKS') {
      const totalPullElapsed =
        this.DUR_FINALE_CAMERA * 0.8 + this.stateElapsed;
      pullProgress = THREE.MathUtils.clamp(
        totalPullElapsed / this.DUR_FINALE_CAMERA,
        0,
        1,
      );
    }
    const easedPull = smoothStep01(pullProgress);

    // Wide finale camera position (`localX = -4.35, localY = 2.48, localZ = 0.0`)
    // frames Harsha on her throne, the circular garden clearing, the open night sky,
    // all 3 fireworks bursts, and the complete "I LOVE YOU ❤️" 3D sky message inside the frustum.
    this.currentCamLocalPos.set(
      THREE.MathUtils.lerp(this.finaleStartCamLocalPos.x, -4.35, easedPull),
      THREE.MathUtils.lerp(this.finaleStartCamLocalPos.y, 2.48, easedPull),
      THREE.MathUtils.lerp(this.finaleStartCamLocalPos.z, 0.0, easedPull),
    );
    this.currentLookLocalPos.set(
      THREE.MathUtils.lerp(this.finaleStartLookLocalPos.x, 5.6, easedPull),
      THREE.MathUtils.lerp(
        this.finaleStartLookLocalPos.y,
        2.85 + this.lookPitchOffset * 1.4,
        easedPull,
      ),
      THREE.MathUtils.lerp(
        this.finaleStartLookLocalPos.z,
        this.lookYawOffset * 2.2,
        easedPull,
      ),
    );
    this.currentFov = THREE.MathUtils.lerp(45.0, 54.0, easedPull);

    _scratchCamWorldPos.set(
      dwWorldX + this.currentCamLocalPos.x,
      dwWorldY + this.currentCamLocalPos.y,
      dwWorldZ + this.currentCamLocalPos.z,
    );
    _scratchLookWorldPos.set(
      dwWorldX + this.currentLookLocalPos.x,
      dwWorldY + this.currentLookLocalPos.y,
      dwWorldZ + this.currentLookLocalPos.z,
    );

    return {
      active: true,
      phase: this.state,
      camWorldPos: _scratchCamWorldPos,
      lookWorldPos: _scratchLookWorldPos,
      blendAlpha: 1.0,
      fov: this.currentFov,
      seatWorldPos: _scratchSeatWorldPos,
      seatYaw: seatedYaw,
      isSitting: true,
    };
  }

  // ===========================================================================
  // PER-FRAME UPDATE LOOP (ZERO ALLOCATIONS)
  // ===========================================================================
  public update(
    delta: number,
    clockTime: number,
    playerPos: THREE.Vector3,
  ): void {
    // 1. Subtle breathing shimmer on Tabletop Gate & Sanctuary West Return Ring
    if (this.tabletopPortalGlowMat) {
      this.tabletopPortalGlowMat.emissiveIntensity =
        0.85 + Math.sin(clockTime * 2.4) * 0.22;
    }
    if (this.dreamWorldPortalRing) {
      this.dreamWorldPortalRing.rotation.z = Math.sin(clockTime * 1.2) * 0.08;
    }

    // 2. Ground-level crystal path lights brighten subtly when Harsha is in the garden
    if (this.pathCrystalGlowMat) {
      const inSanctuary =
        this.isInsideLittleDreamWorld ||
        Math.hypot(
          playerPos.x - (this.originX + this.dwCenterX),
          playerPos.z - (this.originZ + this.dwCenterZ),
        ) <= 8.5;
      const targetGlow = inSanctuary
        ? 0.95 + Math.sin(clockTime * 2.8) * 0.2
        : 0.4;
      this.pathCrystalGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
        this.pathCrystalGlowMat.emissiveIntensity,
        targetGlow,
        Math.min(1.0, delta * 4.0),
      );
    }

    // 3. Authoritative State Machine Progression
    if (this.state !== 'IDLE') {
      this.stateElapsed += delta;

      if (this.state === 'ENTERING') {
        if (
          this.stateElapsed >= this.DUR_ENTERING * 0.65 &&
          !this.hasCompletedEntryTeleport
        ) {
          this.completeWorldEntryTeleport();
        }
        if (this.stateElapsed >= this.DUR_ENTERING) {
          this.completeWorldEntryTeleport();
          this.state = 'GARDEN';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'GARDEN') {
        if (this.stateElapsed >= this.DUR_GARDEN) {
          this.state = 'CROWN_RISING';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'CROWN_RISING') {
        // First 1.2s of the 2.2s Crown Sequence:
        // Subtle shimmer -> crown rises gently and glides forward toward Harsha
        const u = smoothStep01(
          THREE.MathUtils.clamp(this.stateElapsed / this.DUR_CROWN_RISING, 0, 1),
        );
        this.crownGroup.visible = true;
        this.crownGroup.position.set(
          THREE.MathUtils.lerp(this.throneLocalX - 0.38, this.throneLocalX - 0.14, u),
          THREE.MathUtils.lerp(1.92, 2.04, Math.sin(u * Math.PI * 0.5)),
          this.throneLocalZ,
        );
        this.crownHeartGemMat.emissiveIntensity = THREE.MathUtils.lerp(
          0.3,
          0.75,
          u,
        );
        if (this.stateElapsed >= this.DUR_CROWN_RISING) {
          this.state = 'CROWN_SETTLING';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'CROWN_SETTLING') {
        // Final 1.0s of the 2.2s Crown Sequence:
        // Aligns to Harsha's actual head attachment (`getCrownAttachmentWorldPos`) and settles
        const u = smoothStep01(
          THREE.MathUtils.clamp(
            this.stateElapsed / this.DUR_CROWN_SETTLING,
            0,
            1,
          ),
        );

        let targetLocalX = this.throneLocalX - 0.03;
        let targetLocalY = this.daisTopY + 1.44;
        let targetLocalZ = this.throneLocalZ;

        if (this.avatarBridge?.getCrownAttachmentWorldPos) {
          this.avatarBridge.getCrownAttachmentWorldPos(
            _scratchCrownAttachWorldPos,
          );
          targetLocalX =
            _scratchCrownAttachWorldPos.x - (this.originX + this.dwCenterX);
          targetLocalY =
            _scratchCrownAttachWorldPos.y - (this.baseY + this.y0);
          targetLocalZ =
            _scratchCrownAttachWorldPos.z - (this.originZ + this.dwCenterZ);
        }

        this.crownGroup.position.set(
          THREE.MathUtils.lerp(this.throneLocalX - 0.14, targetLocalX, u),
          THREE.MathUtils.lerp(2.04, targetLocalY, u),
          THREE.MathUtils.lerp(this.throneLocalZ, targetLocalZ, u),
        );

        // Heart gemstone brightens (0.3 -> 1.4) & throne underglow warms
        this.crownHeartGemMat.emissiveIntensity = THREE.MathUtils.lerp(
          0.75,
          1.4,
          u,
        );
        this.throneUnderglowMat.emissiveIntensity = THREE.MathUtils.lerp(
          0.55,
          1.35,
          u,
        );
        this.gardenBlossomMat.emissiveIntensity = THREE.MathUtils.lerp(
          0.35,
          0.85,
          u,
        );

        if (this.stateElapsed >= this.DUR_CROWN_SETTLING) {
          this.equipCrownOnHarsha();
          this.state = 'QUIET_PAUSE';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'QUIET_PAUSE') {
        // Section 9: 2.8s of complete stillness (NO fireworks, NO dialogue, NO captions, NO camera movement)
        if (this.stateElapsed >= this.DUR_QUIET_PAUSE) {
          this.finaleStartCamLocalPos.copy(this.currentCamLocalPos);
          this.finaleStartLookLocalPos.copy(this.currentLookLocalPos);
          this.state = 'FINALE_CAMERA';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'FINALE_CAMERA') {
        // Section 10: Fireworks begin at ~80% of the final camera pull-back
        const progress = this.stateElapsed / this.DUR_FINALE_CAMERA;
        if (progress >= 0.8) {
          this.state = 'FIREWORKS';
          this.stateElapsed = 0.0;
          this.fireworksElapsed = 0.0;
          this.fireworksPoints.visible = true;
          this.skyMessageGroup.visible = true;
        }
      } else if (this.state === 'FIREWORKS') {
        this.updateFinaleFireworksAndSkyMessage(delta, clockTime);
        if (this.stateElapsed >= this.DUR_FIREWORKS_TAIL) {
          this.state = 'FINAL_HOLD';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'FINAL_HOLD') {
        // Section 18: Hold final composition for 5.0s, then restore control cleanly
        this.updateFinaleFireworksAndSkyMessage(delta, clockTime);
        if (this.stateElapsed >= this.DUR_FINAL_HOLD) {
          this.completeRestoreControl();
        }
      } else if (this.state === 'EXITING') {
        if (
          this.stateElapsed >= this.DUR_EXITING * 0.55 &&
          !this.hasCompletedExitTeleport
        ) {
          this.completeWorldExitTeleport();
        }
        if (this.stateElapsed >= this.DUR_EXITING) {
          this.completeWorldExitTeleport();
          this.state = 'IDLE';
          this.stateElapsed = 0.0;
        }
      }
    }
  }

  /**
   * Drives the 3 sparse, deterministic fireworks bursts and the 3D world-space
   * "I LOVE YOU ❤️" sky message during `FIREWORKS` and `FINAL_HOLD`.
   */
  private updateFinaleFireworksAndSkyMessage(
    delta: number,
    clockTime: number,
  ): void {
    this.fireworksElapsed += delta;

    // 1. Deterministic 3-Burst Fireworks Schedule:
    // Burst 1 (t = 0.0s): Gold launch -> Heart in center-top sky (champagne gold + rose pink)
    if (!this.fireworksBurst1Launched && this.fireworksElapsed >= 0.0) {
      this.fireworksBurst1Launched = true;
      this.launchFireworkBurst(0, 80, 10.6, 6.55, 0.0, 'heart');
    }
    // Burst 2 (t = 1.2s): Left side of sky -> Flower (blush + lavender)
    if (!this.fireworksBurst2Launched && this.fireworksElapsed >= 1.2) {
      this.fireworksBurst2Launched = true;
      this.launchFireworkBurst(80, 80, 10.8, 6.1, -2.55, 'flower');
    }
    // Burst 3 (t = 2.4s): Right side of sky -> Star (champagne gold)
    if (!this.fireworksBurst3Launched && this.fireworksElapsed >= 2.4) {
      this.fireworksBurst3Launched = true;
      this.launchFireworkBurst(160, 80, 10.8, 6.1, 2.55, 'star');
    }

    // Gentle secondary shimmer bursts during the final hold so the sky stays alive without clutter
    if (this.fireworksElapsed >= 4.6 && this.fireworksElapsed - delta < 4.6) {
      this.launchFireworkBurst(0, 80, 10.6, 6.55, 0.0, 'heart');
    }

    // 2. Advance Fireworks Particle Physics
    const posArr = this.fireworksPosAttr.array as Float32Array;
    const colArr = this.fireworksColorAttr.array as Float32Array;
    let anyActive = false;

    for (let i = 0; i < this.FIREWORKS_COUNT; i++) {
      const age = this.fwAges[i];
      const life = this.fwLifetimes[i];
      if (age < life) {
        anyActive = true;
        const nextAge = age + delta;
        this.fwAges[i] = nextAge;
        const lifeU = THREE.MathUtils.clamp(nextAge / life, 0, 1);
        const damping = 1.0 - lifeU * 0.42;
        const i3 = i * 3;

        posArr[i3] =
          this.fwOrigins[i3] + this.fwVelocities[i3] * nextAge * damping;
        posArr[i3 + 1] =
          this.fwOrigins[i3 + 1] +
          this.fwVelocities[i3 + 1] * nextAge * damping -
          0.32 * nextAge * nextAge;
        posArr[i3 + 2] =
          this.fwOrigins[i3 + 2] +
          this.fwVelocities[i3 + 2] * nextAge * damping;

        const fade = Math.sin((1.0 - lifeU) * Math.PI * 0.5);
        const twinkle = 0.85 + 0.15 * Math.sin(clockTime * 14.0 + i);
        colArr[i3] = this.fwBaseColors[i3] * fade * twinkle;
        colArr[i3 + 1] = this.fwBaseColors[i3 + 1] * fade * twinkle;
        colArr[i3 + 2] = this.fwBaseColors[i3 + 2] * fade * twinkle;
      } else {
        posArr[i * 3 + 1] = -999.0;
      }
    }

    if (anyActive) {
      this.fireworksPosAttr.needsUpdate = true;
      this.fireworksColorAttr.needsUpdate = true;
    }

    // 3. Smooth Fade-In & Soft Pulse of the 3D World-Space "I LOVE YOU ❤️" Sky Sculpture
    const msgFade = smoothStep01(
      THREE.MathUtils.clamp((this.fireworksElapsed - 0.35) / 1.4, 0, 1),
    );
    const softPulse = 0.92 + 0.08 * Math.sin(clockTime * 2.2);
    this.skyFrontTextMat.opacity = msgFade * softPulse;
    this.skyBackReliefMat.opacity = msgFade * 0.72 * softPulse;
    this.skyHeartGemMat.opacity = msgFade;
    this.skyHeartGemMat.emissiveIntensity =
      1.25 + 0.25 * Math.sin(clockTime * 2.6);
  }
}
