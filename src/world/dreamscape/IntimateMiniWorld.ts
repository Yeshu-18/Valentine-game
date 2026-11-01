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
  | 'PALACE_AWAKENING'
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

// Module-scope zero-allocation scratch vectors & matrices
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
 * Harsha's Royal Crystal Garden Palace (`IntimateMiniWorld`)
 *
 * Hierarchy:
 * HARSHA -> HER CROWN -> HER THRONE -> ROYAL CRYSTAL PALACE -> INTIMATE GARDEN -> FIREWORKS + I LOVE YOU ❤️
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

  // Full-Scale Sanctuary Center in Castle-Local Coordinates
  private readonly dwCenterX = 33.0;
  private readonly dwCenterZ = 12.0;

  // Spatial Composition Coordinates (relative to dwRoot at (33.0, y0, 12.0))
  private readonly throneLocalX = 3.15;
  private readonly throneLocalZ = 0.0;
  private readonly daisTopY = 0.22; // 2 low steps of 0.11m each
  private readonly palaceLocalX = 6.45;
  private readonly palaceLocalZ = 0.0;

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
  private palaceGroup!: THREE.Group;
  private dreamWorldPortalRing!: THREE.Mesh;
  private crownGroup!: THREE.Group;
  private crownHeartGemMat!: THREE.MeshStandardMaterial;

  // Progressive Palace & Courtyard Awakening Materials (Section 23 & 25)
  private throneUnderglowMat!: THREE.MeshStandardMaterial;
  private courtyardLanternMat!: THREE.MeshStandardMaterial;
  private pathCrystalGlowMat!: THREE.MeshStandardMaterial;
  private gardenBlossomMat!: THREE.MeshStandardMaterial;
  private groundWindowGlowMat!: THREE.MeshStandardMaterial;
  private upperWindowGlowMat!: THREE.MeshStandardMaterial;
  private crystalDomeShellMat!: THREE.MeshPhysicalMaterial;
  private crystalDomeCoreMat!: THREE.MeshStandardMaterial;
  private spireHeartMat!: THREE.MeshStandardMaterial;

  // Sanctuary Lighting (Respects dynamic light budget: 1 subtle Harsha rim/key light + 1 palace ambient light)
  private harshaRimLight!: THREE.PointLight;
  private palaceAwakeningLight!: THREE.PointLight;

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
  private currentLookLocalPos = new THREE.Vector3(3.15, 1.35, 0.0);
  private currentFov = 48.0;
  private finaleStartCamLocalPos = new THREE.Vector3(0.75, 1.56, 0.0);
  private finaleStartLookLocalPos = new THREE.Vector3(3.15, 1.38, 0.0);

  // Validated Finale Camera & Sky Coordinates (verified by validatePalaceAndSkyFrustum)
  private readonly finaleEndCamLocalPos = new THREE.Vector3(-4.55, 2.38, 0.0);
  private readonly finaleEndLookLocalPos = new THREE.Vector3(5.85, 3.05, 0.0);
  private readonly finaleEndFov = 54.0;

  // User subtle camera look offset during FINAL_HOLD
  private lookYawOffset = 0.0;
  private lookPitchOffset = 0.0;

  // Authoritative Phase Durations (Sections 24, 25, 29, 30, 33)
  private readonly DUR_ENTERING = 1.2;
  private readonly DUR_GARDEN = 2.8;
  private readonly DUR_CROWN_RISING = 1.2;
  private readonly DUR_CROWN_SETTLING = 1.0; // Total Crown Sequence = 2.2s
  private readonly DUR_PALACE_AWAKENING = 2.0; // Progressive T = 0.0 -> 2.0s palace awakening
  private readonly DUR_QUIET_PAUSE = 2.8; // Complete stillness (2.5-3.0s window)
  private readonly DUR_FINALE_CAMERA = 3.6; // Smooth pull-back (3.2-4.0s window); fireworks at 80%
  private readonly DUR_FIREWORKS_TAIL = 2.8; // Sparse 3-burst sequence completion
  private readonly DUR_FINAL_HOLD = 5.0; // 5.0s final hold (4-6s window) before restoring control
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
    this.validatePalaceAndSkyFrustum();

    // Register dynamic objects so lockStaticHierarchy preserves their per-frame transforms
    this.dynamicObjects.add(this.dreamWorldPortalRing);
    this.dynamicObjects.add(this.crownGroup);
    this.dynamicObjects.add(this.skyMessageGroup);
    this.dynamicObjects.add(this.fireworksPoints);

    // Colliders for the couture throne dais and the Royal Crystal Palace behind it
    this.colliders.push(
      {
        x: this.originX + this.dwCenterX + this.throneLocalX,
        z: this.originZ + this.dwCenterZ + this.throneLocalZ,
        radius: 0.65,
        y: this.baseY + this.y0,
        height: 2.2,
      },
      {
        x: this.originX + this.dwCenterX + this.palaceLocalX,
        z: this.originZ + this.dwCenterZ + this.palaceLocalZ,
        radius: 1.55,
        y: this.baseY + this.y0,
        height: 5.5,
      },
      {
        x: this.originX + this.dwCenterX + 6.05,
        z: this.originZ + this.dwCenterZ - 3.35,
        radius: 0.65,
        y: this.baseY + this.y0,
        height: 4.6,
      },
      {
        x: this.originX + this.dwCenterX + 6.05,
        z: this.originZ + this.dwCenterZ + 3.35,
        radius: 0.65,
        y: this.baseY + this.y0,
        height: 4.6,
      },
    );
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
   * Section 37: Tabletop / Doll Playroom Preview (`(12.85, y0, 11.85)`)
   * Previews a simplified miniature of Harsha's Royal Crystal Garden Palace:
   * - Central palace keep + pink crystal dome + tiny heart spire
   * - Two slender framing turrets
   * - Tiny circular pearl courtyard + tiny couture throne + curved pearl garden path
   */
  private buildTabletopGardenPreview(): void {
    const { tracker, mats } = this;

    const tableGroup = new THREE.Group();
    tableGroup.name = 'TabletopRoyalCrystalPalacePreview';
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

    // 2. Miniature Nighttime Velvet Grass & Pearl Courtyard Disc
    const miniGrassMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#173326',
        roughness: 0.85,
        metalness: 0.04,
      }),
    );
    const miniPearlMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        roughness: 0.24,
        metalness: 0.1,
      }),
    );
    const miniBlushMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        roughness: 0.32,
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
    const miniCrystalDomeMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.32,
        roughness: 0.12,
        metalness: 0.08,
        transmission: 0.52,
        transparent: true,
        opacity: 0.86,
      }),
    );

    const miniGrassGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.1, 1.12, 0.04, 28),
    );
    miniGrassGeo.translate(0, 0.57, 0);
    const miniCourtyardGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.36, 0.38, 0.015, 24),
    );
    miniCourtyardGeo.translate(0, 0.595, 0.12);
    tableGroup.add(
      new THREE.Mesh(miniGrassGeo, miniGrassMat),
      new THREE.Mesh(miniCourtyardGeo, miniPearlMat),
    );

    // 3. Miniature Curved Pearl Garden Path (from South gate -Z to Courtyard)
    const miniStoneGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.095, 0.105, 0.014, 14),
    );
    const sCurvePoints: [number, number][] = [
      [0.0, -0.76],
      [0.07, -0.58],
      [0.11, -0.4],
      [0.03, -0.22],
      [-0.05, -0.05],
    ];
    for (let i = 0; i < sCurvePoints.length; i++) {
      const [sx, sz] = sCurvePoints[i];
      const stone = new THREE.Mesh(miniStoneGeo, miniPearlMat);
      stone.position.set(sx, 0.595, sz);
      stone.scale.set(1.15, 1.0, 0.85);
      tableGroup.add(stone);
    }

    // 4. Miniature Couture Throne in the Courtyard (`z = 0.15`)
    const miniDaisGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.16, 0.18, 0.024, 18),
    );
    miniDaisGeo.translate(0, 0.61, 0.15);
    const miniSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.1, 0.05, 0.09));
    miniSeatGeo.translate(0, 0.645, 0.15);
    const miniBackGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.06, 0.05, 0.14, 12),
    );
    miniBackGeo.scale(1.0, 1.0, 0.35);
    miniBackGeo.translate(0, 0.7, 0.185);
    tableGroup.add(
      new THREE.Mesh(miniDaisGeo, miniPearlMat),
      new THREE.Mesh(miniSeatGeo, miniBlushMat),
      new THREE.Mesh(miniBackGeo, miniBlushMat),
    );

    // 5. Simplified Miniature Royal Crystal Palace (`z = 0.56`)
    const miniPalaceGroup = new THREE.Group();
    miniPalaceGroup.position.set(0, 0.59, 0.56);
    tableGroup.add(miniPalaceGroup);

    // Central Keep + Pink Crystal Dome + Heart Spire
    const miniKeepGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.18, 0.19, 0.34, 8),
    );
    miniKeepGeo.translate(0, 0.17, 0);
    const miniCorniceGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.185, 0.012, 8, 16),
    );
    miniCorniceGeo.rotateX(Math.PI / 2);
    miniCorniceGeo.translate(0, 0.34, 0);
    const miniDomeGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    );
    miniDomeGeo.translate(0, 0.34, 0);
    const miniSpireGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.018, 0.12, 8),
    );
    miniSpireGeo.translate(0, 0.56, 0);
    const miniHeartGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.022, 0),
    );
    miniHeartGeo.translate(0, 0.63, 0);
    const miniRubyMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#e11d48',
        emissiveIntensity: 0.65,
        roughness: 0.15,
      }),
    );

    miniPalaceGroup.add(
      new THREE.Mesh(miniKeepGeo, miniPearlMat),
      new THREE.Mesh(miniCorniceGeo, miniGoldMat),
      new THREE.Mesh(miniDomeGeo, miniCrystalDomeMat),
      new THREE.Mesh(miniSpireGeo, miniGoldMat),
      new THREE.Mesh(miniHeartGeo, miniRubyMat),
    );

    // Symmetrical Wings & Twin Slender Turrets
    const miniWingGeo = tracker.trackGeo(new THREE.BoxGeometry(0.22, 0.24, 0.1));
    miniWingGeo.translate(0, 0.12, 0);
    const miniTurretShaftGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.068, 0.074, 0.3, 12),
    );
    miniTurretShaftGeo.translate(0, 0.15, 0);
    const miniTurretRoofGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.082, 0.14, 12),
    );
    miniTurretRoofGeo.translate(0, 0.37, 0);

    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(miniWingGeo, miniBlushMat);
      wing.position.set(side * 0.24, 0, -0.02);
      const turretShaft = new THREE.Mesh(miniTurretShaftGeo, miniPearlMat);
      turretShaft.position.set(side * 0.38, 0, -0.04);
      const turretRoof = new THREE.Mesh(miniTurretRoofGeo, miniBlushMat);
      turretRoof.position.set(side * 0.38, 0, -0.04);
      miniPalaceGroup.add(wing, turretShaft, turretRoof);
    });

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
   * Builds the Full-Scale Royal Crystal Garden Palace & Intimate Sanctuary at `(33.0, y0, 12.0)`.
   * Hierarchy:
   * HARSHA -> HER CROWN -> HER THRONE -> ROYAL CRYSTAL PALACE -> INTIMATE GARDEN -> FIREWORKS + I LOVE YOU ❤️
   */
  private buildFullScaleRomanticGardenSanctuary(): void {
    const { tracker } = this;

    this.dwRoot = new THREE.Group();
    this.dwRoot.name = 'HarshaRoyalCrystalGardenPalace';
    this.dwRoot.position.set(this.dwCenterX, this.y0, this.dwCenterZ);
    this.parentGroup.add(this.dwRoot);

    // =========================================================================
    // SECTION 21: HIGH-CRAFT COUTURE & CRYSTAL PALACE MATERIALS
    // =========================================================================
    const pearlMarbleMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        roughness: 0.24,
        metalness: 0.08,
      }),
    );
    const blushStoneMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        roughness: 0.32,
        metalness: 0.06,
      }),
    );
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
        emissiveIntensity: 0.1,
        roughness: 0.42,
        metalness: 0.04,
      }),
    );
    const lavenderCrystalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#e9d5ff',
        emissive: '#c084fc',
        emissiveIntensity: 0.28,
        roughness: 0.14,
        metalness: 0.24,
      }),
    );
    const turretRoofRoseGoldMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f4a2b8',
        roughness: 0.24,
        metalness: 0.52,
      }),
    );

    // Progressive Palace Awakening Materials (start in soft moonlit state — Section 23)
    this.groundWindowGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fce7f3',
        emissive: '#f472b6',
        emissiveIntensity: 0.16,
        roughness: 0.14,
        metalness: 0.18,
      }),
    );
    this.upperWindowGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f3e8ff',
        emissive: '#e879f9',
        emissiveIntensity: 0.14,
        roughness: 0.14,
        metalness: 0.18,
      }),
    );
    this.crystalDomeShellMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: '#fbcfe8',
        emissive: '#c084fc',
        emissiveIntensity: 0.15,
        roughness: 0.12,
        metalness: 0.08,
        transmission: 0.58,
        ior: 1.46,
        transparent: true,
        opacity: 0.84,
      }),
    );
    this.crystalDomeCoreMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 0.18,
        roughness: 0.2,
        transparent: true,
        opacity: 0.72,
      }),
    );
    this.spireHeartMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#f43f5e',
        emissiveIntensity: 0.12,
        roughness: 0.12,
        metalness: 0.22,
      }),
    );
    this.courtyardLanternMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff1f2',
        emissive: '#f472b6',
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.2,
      }),
    );

    // =========================================================================
    // SECTIONS 16, 18, 19, 20: INTIMATE GARDEN, CURVED S-PATH & ROYAL COURTYARD
    // =========================================================================
    // 1. Nighttime Velvet Grass Sanctuary Plateau (`radius = 8.4m`)
    const nightGrassMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#132620',
        roughness: 0.88,
        metalness: 0.04,
      }),
    );
    const plateauGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(8.4, 8.65, 0.28, 48),
    );
    plateauGeo.translate(0, -0.14, 0);
    this.dwRoot.add(new THREE.Mesh(plateauGeo, nightGrassMat));

    // 2. Subtle West Return Threshold Ring at `(-6.8, 0, 0)` (Zero text signs)
    const portalRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(1.05, 0.035, 12, 36),
    );
    portalRingGeo.rotateY(Math.PI / 2);
    portalRingGeo.translate(0, 1.15, 0);
    const portalShimmerMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.dreamWorldPortalRing = new THREE.Mesh(portalRingGeo, portalShimmerMat);
    this.dreamWorldPortalRing.position.set(-6.8, 0.0, 0.0);
    this.dwRoot.add(this.dreamWorldPortalRing);

    // 3. Royal Courtyard (`center at (3.15, 0, 0)`, pearl marble & blush stone with generous negative space)
    // + Circular Pearl Forecourt Plaza (`centerX = 1.15, localZ = 0.0, radius = 2.2m`) before the Throne Dais
    const forecourtPlazaGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(2.2, 2.24, 0.022, 44),
    );
    forecourtPlazaGeo.translate(1.15, 0.011, 0);
    const forecourtBlushInlayGeo = tracker.trackGeo(
      new THREE.RingGeometry(1.35, 1.85, 40),
    );
    forecourtBlushInlayGeo.rotateX(-Math.PI / 2);
    forecourtBlushInlayGeo.translate(1.15, 0.025, 0);
    const forecourtGoldRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(2.2, 0.02, 10, 48),
    );
    forecourtGoldRingGeo.rotateX(Math.PI / 2);
    forecourtGoldRingGeo.translate(1.15, 0.025, 0);

    const courtyardOuterGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(3.25, 3.32, 0.024, 44),
    );
    courtyardOuterGeo.translate(this.throneLocalX, 0.012, 0);
    const courtyardBlushRingGeo = tracker.trackGeo(
      new THREE.RingGeometry(2.15, 2.95, 40),
    );
    courtyardBlushRingGeo.rotateX(-Math.PI / 2);
    courtyardBlushRingGeo.translate(this.throneLocalX, 0.026, 0);
    const courtyardGoldTrimGeo = tracker.trackGeo(
      new THREE.TorusGeometry(3.26, 0.02, 10, 48),
    );
    courtyardGoldTrimGeo.rotateX(Math.PI / 2);
    courtyardGoldTrimGeo.translate(this.throneLocalX, 0.026, 0);
    this.dwRoot.add(
      new THREE.Mesh(forecourtPlazaGeo, pearlMarbleMat),
      new THREE.Mesh(forecourtBlushInlayGeo, blushStoneMat),
      new THREE.Mesh(forecourtGoldRingGeo, champagneGoldMat),
      new THREE.Mesh(courtyardOuterGeo, pearlMarbleMat),
      new THREE.Mesh(courtyardBlushRingGeo, blushStoneMat),
      new THREE.Mesh(courtyardGoldTrimGeo, champagneGoldMat),
    );

    // 4. Section 19: Subtle Crescent-Shaped Reflection Pool (`arc around East half of courtyard`)
    const poolRadius = 2.42;
    const poolArcSpan = Math.PI * 0.78;
    const poolWaterGeo = tracker.trackGeo(
      new THREE.RingGeometry(
        poolRadius - 0.34,
        poolRadius + 0.34,
        32,
        1,
        -poolArcSpan * 0.5,
        poolArcSpan,
      ),
    );
    poolWaterGeo.rotateX(-Math.PI / 2);
    poolWaterGeo.translate(this.throneLocalX, 0.028, 0);
    const reflectionWaterMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#2e1a36',
        emissive: '#701a75',
        emissiveIntensity: 0.14,
        roughness: 0.12,
        metalness: 0.35,
      }),
    );
    const poolInnerCopingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(
        poolRadius - 0.35,
        0.022,
        8,
        32,
        poolArcSpan,
      ),
    );
    poolInnerCopingGeo.rotateX(Math.PI / 2);
    poolInnerCopingGeo.rotateY(-poolArcSpan * 0.5);
    const poolInnerCoping = new THREE.Mesh(poolInnerCopingGeo, pearlMarbleMat);
    poolInnerCoping.position.set(this.throneLocalX, 0.032, 0);

    const poolOuterCopingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(
        poolRadius + 0.35,
        0.022,
        8,
        32,
        poolArcSpan,
      ),
    );
    poolOuterCopingGeo.rotateX(Math.PI / 2);
    poolOuterCopingGeo.rotateY(-poolArcSpan * 0.5);
    const poolOuterCoping = new THREE.Mesh(poolOuterCopingGeo, pearlMarbleMat);
    poolOuterCoping.position.set(this.throneLocalX, 0.032, 0);

    this.dwRoot.add(
      new THREE.Mesh(poolWaterGeo, reflectionWaterMat),
      poolInnerCoping,
      poolOuterCoping,
    );

    // 5. Section 18: Low Curved Garden Arcades / Balustrades (3 slender columns per side, open & low)
    this.buildLowCurvedGardenArcades(
      pearlMarbleMat,
      blushStoneMat,
      champagneGoldMat,
    );

    // 6. Section 20: Curved S-Shaped Pearl/Ivory Stone Path with Blush/Lavender Crystal Inlays
    const sPathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.2, 0.015, 0.0),
      new THREE.Vector3(-4.4, 0.015, 0.55),
      new THREE.Vector3(-2.4, 0.015, 0.38),
      new THREE.Vector3(-0.6, 0.015, -0.42),
      new THREE.Vector3(0.85, 0.015, -0.16),
      new THREE.Vector3(1.65, 0.015, 0.0),
    ]);

    const PATH_STONES = 22;
    const stoneStepGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.44, 0.47, 0.026, 20),
    );
    const stoneBorderGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.45, 0.016, 8, 20),
    );
    stoneBorderGeo.rotateX(Math.PI / 2);
    const inlayGemGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.042, 0),
    );

    const stonesInst = new THREE.InstancedMesh(
      stoneStepGeo,
      pearlMarbleMat,
      PATH_STONES,
    );
    const bordersInst = new THREE.InstancedMesh(
      stoneBorderGeo,
      blushStoneMat,
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
      _scratchScale.set(1.2, 1.0, 0.82);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      stonesInst.setMatrixAt(i, _scratchMatrix);

      _scratchPos.y += 0.012;
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bordersInst.setMatrixAt(i, _scratchMatrix);

      const perpX = -tangent.z;
      const perpZ = tangent.x;
      for (let side = 0; side < 2; side++) {
        const sDir = side === 0 ? -1 : 1;
        _scratchPos.set(
          _scratchPos.x + perpX * sDir * 0.34,
          0.032,
          _scratchPos.z + perpZ * sDir * 0.34,
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

    // 7. Tiny Ground-Level Crystal Path Lights
    this.pathCrystalGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.2,
      }),
    );
    const pathLightGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.052, 0),
    );
    const PATH_LIGHTS = 14;
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
      _scratchPos.x += -tangent.z * side * 0.64;
      _scratchPos.z += tangent.x * side * 0.64;
      _scratchPos.y = 0.042;
      _scratchEuler.set(0.2, i * 0.7, 0.15);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.0, 1.2, 1.0);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      pathLightsInst.setMatrixAt(i, _scratchMatrix);
    }
    pathLightsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(pathLightsInst);

    // 8. Low Perimeter Foliage, Sparse Roses & Scattered Petals (Substantial Negative Space)
    const foliageGeo = tracker.trackGeo(new THREE.SphereGeometry(0.38, 10, 8));
    const foliageMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#152c20',
        roughness: 0.84,
        metalness: 0.04,
      }),
    );
    this.gardenBlossomMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#f472b6',
        emissiveIntensity: 0.22,
        roughness: 0.34,
      }),
    );
    const blossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.068, 8, 8));

    const BUSH_COUNT = 22;
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
      const isEastPalaceZone = Math.cos(angle) > 0.42;
      const isWestPortal = Math.cos(angle) < -0.88;
      const r = isEastPalaceZone
        ? 7.85
        : isWestPortal
          ? 7.65
          : 6.75 + ((i * 5) % 4) * 0.22;
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;
      const scaleY = isEastPalaceZone ? 0.28 : 0.44 + (i % 3) * 0.1;

      _scratchPos.set(bx, scaleY * 0.24, bz);
      _scratchEuler.set(0, angle, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.2, scaleY, 1.1);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bushesInst.setMatrixAt(i, _scratchMatrix);

      _scratchPos.set(bx * 0.96, scaleY * 0.38 + 0.03, bz * 0.96);
      _scratchScale.set(1.05, 0.72, 1.05);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      bloomsInst.setMatrixAt(i, _scratchMatrix);
    }
    bushesInst.instanceMatrix.needsUpdate = true;
    bloomsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(bushesInst, bloomsInst);

    // Sparse floating petals on the Crescent Reflection Pool & along the path
    const petalGeo = tracker.trackGeo(new THREE.CircleGeometry(0.038, 7));
    petalGeo.rotateX(-Math.PI / 2);
    const petalMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#be123c',
        emissiveIntensity: 0.2,
        roughness: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    const PETAL_COUNT = 32;
    const petalsInst = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_COUNT);
    for (let i = 0; i < PETAL_COUNT; i++) {
      if (i < 12) {
        // Floating on the crescent reflection pool
        const ang = ((i / 11) - 0.5) * poolArcSpan * 0.85;
        const rad = poolRadius + ((i % 3) - 1) * 0.14;
        _scratchPos.set(
          this.throneLocalX + Math.cos(ang) * rad,
          0.033,
          Math.sin(ang) * rad,
        );
      } else {
        const u = ((i - 12) / (PETAL_COUNT - 12)) * 0.95;
        sPathCurve.getPoint(u, _scratchPos);
        const offsetAngle = i * 2.39996;
        const offsetDist = 0.48 + (i % 4) * 0.25;
        _scratchPos.x += Math.cos(offsetAngle) * offsetDist;
        _scratchPos.z += Math.sin(offsetAngle) * offsetDist;
        _scratchPos.y = 0.028;
      }
      _scratchEuler.set(0, i * 1.7, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(1.15, 1.0, 0.85);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      petalsInst.setMatrixAt(i, _scratchMatrix);
    }
    petalsInst.instanceMatrix.needsUpdate = true;
    this.dwRoot.add(petalsInst);

    // =========================================================================
    // SECTION 17: HER THRONE (HUMAN-SCALE COUTURE THRONE IN ROYAL COURTYARD)
    // =========================================================================
    const throneSanctuaryGroup = new THREE.Group();
    throneSanctuaryGroup.name = 'HarshaCoutureThroneSanctuary';
    throneSanctuaryGroup.position.set(this.throneLocalX, 0.0, this.throneLocalZ);
    throneSanctuaryGroup.rotation.y = -Math.PI / 2;
    this.dwRoot.add(throneSanctuaryGroup);

    // 1. Circular Pearl-Marble Dais (2 low steps: 0.11m + 0.11m = 0.22m total)
    const step1Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.48, 1.56, 0.11, 36),
    );
    step1Geo.translate(0, 0.055, 0);
    const step2Geo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.12, 1.18, 0.11, 36),
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
        emissiveIntensity: 0.32,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    const underglowRing1Geo = tracker.trackGeo(
      new THREE.TorusGeometry(1.5, 0.016, 10, 36),
    );
    underglowRing1Geo.rotateX(Math.PI / 2);
    underglowRing1Geo.translate(0, 0.11, 0);
    const underglowRing2Geo = tracker.trackGeo(
      new THREE.TorusGeometry(1.14, 0.015, 10, 36),
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

    const seatFrameGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.41, 0.45, 0.12, 24),
    );
    seatFrameGeo.scale(1.14, 1.0, 0.94);
    seatFrameGeo.translate(0, 0.36, 0);
    chairGroup.add(new THREE.Mesh(seatFrameGeo, champagneGoldMat));

    const legGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.03, 0.02, 0.36, 10),
    );
    legGeo.translate(0, 0.18, 0);
    const legOffsets: [number, number][] = [
      [-0.35, 0.25],
      [0.35, 0.25],
      [-0.37, -0.25],
      [0.37, -0.25],
    ];
    for (let i = 0; i < legOffsets.length; i++) {
      const [lx, lz] = legOffsets[i];
      const leg = new THREE.Mesh(legGeo, champagneGoldMat);
      leg.position.set(lx, 0, lz);
      chairGroup.add(leg);
    }

    const cushionGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.38, 0.4, 0.11, 24),
    );
    cushionGeo.scale(1.1, 1.0, 0.9);
    cushionGeo.translate(0, 0.46, 0.02);
    chairGroup.add(new THREE.Mesh(cushionGeo, blushVelvetMat));

    const armRestGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.23, 0.022, 10, 20, Math.PI * 0.75),
    );
    [-0.4, 0.4].forEach((ax) => {
      const arm = new THREE.Mesh(armRestGeo, champagneGoldMat);
      arm.position.set(ax, 0.56, 0.04);
      arm.rotation.y = Math.PI / 2;
      arm.rotation.z = Math.PI * 0.12;
      chairGroup.add(arm);
    });

    const heartBackLobeGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.25, 0.21, 0.76, 20),
    );
    heartBackLobeGeo.scale(1.0, 1.0, 0.28);
    const lobeL = new THREE.Mesh(heartBackLobeGeo, blushVelvetMat);
    lobeL.position.set(-0.135, 0.91, -0.27);
    lobeL.rotation.z = -0.14;
    const lobeR = new THREE.Mesh(heartBackLobeGeo, blushVelvetMat);
    lobeR.position.set(0.135, 0.91, -0.27);
    lobeR.rotation.z = 0.14;
    chairGroup.add(lobeL, lobeR);

    const filigreeRimGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.26, 0.02, 10, 24, Math.PI * 1.15),
    );
    const rimL = new THREE.Mesh(filigreeRimGeo, champagneGoldMat);
    rimL.position.set(-0.145, 1.1, -0.27);
    rimL.rotation.z = 0.22;
    const rimR = new THREE.Mesh(filigreeRimGeo, champagneGoldMat);
    rimR.position.set(0.145, 1.1, -0.27);
    rimR.rotation.z = -0.22;
    chairGroup.add(rimL, rimR);

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
      new THREE.OctahedronGeometry(0.052, 1),
    );
    crestHeartGeo.scale(1.15, 1.25, 0.55);
    const crestHeart = new THREE.Mesh(crestHeartGeo, throneGemMat);
    crestHeart.position.set(0, 1.42, -0.26);
    chairGroup.add(crestHeart);

    // =========================================================================
    // SECTIONS 7–15: HARSHA'S ROYAL CRYSTAL PALACE (`localX = 6.45, localZ = 0.0`)
    // =========================================================================
    this.buildRoyalCrystalPalace(
      pearlMarbleMat,
      blushStoneMat,
      champagneGoldMat,
      turretRoofRoseGoldMat,
    );

    // =========================================================================
    // SECONDARY WITNESSING YESHWANTH FIGURE (Quiet, off to the side at `(1.85, 0, -1.85)`)
    // =========================================================================
    const witnessGroup = new THREE.Group();
    witnessGroup.name = 'WitnessingYeshwanth';
    witnessGroup.position.set(1.85, 0.0, -1.85);
    witnessGroup.rotation.y = Math.atan2(
      this.throneLocalX - 1.85,
      this.throneLocalZ - -1.85,
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
    // SECTION 24: HER CROWN (DELICATE PRINCESS TIARA, 70-80% HEAD WIDTH)
    // =========================================================================
    this.crownGroup = new THREE.Group();
    this.crownGroup.name = 'HarshaPrincessTiara';
    this.crownGroup.position.set(this.throneLocalX - 0.38, 1.9, this.throneLocalZ);
    this.crownGroup.rotation.y = -Math.PI / 2;
    this.dwRoot.add(this.crownGroup);

    const tiaraBandGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.135, 0.01, 10, 28, Math.PI * 1.35),
    );
    tiaraBandGeo.rotateX(Math.PI / 2);
    tiaraBandGeo.rotateY(-Math.PI * 0.175);
    this.crownGroup.add(new THREE.Mesh(tiaraBandGeo, champagneGoldMat));

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
    // SECTION 28: WORLD-SPACE 3D SKY MESSAGE ("I LOVE YOU ❤️")
    // Positioned high in the open sky above the Heart Spire (`(9.85, 8.35, 0.0)`)
    // =========================================================================
    this.skyMessageGroup = new THREE.Group();
    this.skyMessageGroup.name = 'SkyLoveMessage3D';
    this.skyMessageGroup.position.set(9.85, 8.35, 0.0);
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

    const skyPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(5.2, 1.3));
    const frontTextMesh = new THREE.Mesh(skyPlaneGeo, this.skyFrontTextMat);
    frontTextMesh.position.z = 0.05;
    const midReliefMesh = new THREE.Mesh(skyPlaneGeo, this.skyBackReliefMat);
    midReliefMesh.position.z = 0.0;
    const backReliefMesh = new THREE.Mesh(skyPlaneGeo, this.skyBackReliefMat);
    backReliefMesh.position.z = -0.05;
    this.skyMessageGroup.add(backReliefMesh, midReliefMesh, frontTextMesh);

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
    skyHeartGroup.position.set(1.88, 0.03, 0.04);
    const skyLobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.145, 14, 12));
    skyLobeGeo.scale(1.0, 1.05, 0.55);
    const skyLobeL = new THREE.Mesh(skyLobeGeo, this.skyHeartGemMat);
    skyLobeL.position.set(-0.1, 0.07, 0);
    const skyLobeR = new THREE.Mesh(skyLobeGeo, this.skyHeartGemMat);
    skyLobeR.position.set(0.1, 0.07, 0);
    const skyHeartTipGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.22, 0.29, 14),
    );
    skyHeartTipGeo.rotateX(Math.PI);
    skyHeartTipGeo.scale(1.0, 1.0, 0.48);
    skyHeartTipGeo.translate(0, -0.09, 0);
    const skyHeartTip = new THREE.Mesh(skyHeartTipGeo, this.skyHeartGemMat);
    skyHeartGroup.add(skyLobeL, skyLobeR, skyHeartTip);
    this.skyMessageGroup.add(skyHeartGroup);

    // =========================================================================
    // SECTION 32: PRESERVED FINALE FIREWORKS SYSTEM (`buildFinaleFireworksSystem`)
    // =========================================================================
    this.buildFinaleFireworksSystem();

    // =========================================================================
    // SECTION 22: LAYERED NIGHTTIME PALACE & HARSHA RIM LIGHTING
    // =========================================================================
    // 1. Subtle Harsha Rim & Key Light (keeps Harsha as the visual hero without over-brightening)
    this.harshaRimLight = new THREE.PointLight('#fce7f3', 1.35, 11.0, 1.6);
    this.harshaRimLight.position.set(this.throneLocalX - 1.15, 2.45, 0.0);
    this.dwRoot.add(this.harshaRimLight);

    // 2. Soft Lavender/Pink Palace Awakening Light (starts cool/moonlit, warms as palace awakens)
    this.palaceAwakeningLight = new THREE.PointLight('#e9d5ff', 0.45, 14.0, 1.5);
    this.palaceAwakeningLight.position.set(this.palaceLocalX - 1.1, 3.4, 0.0);
    this.dwRoot.add(this.palaceAwakeningLight);
  }

  /**
   * Section 18: Builds low curved garden arcades / balustrades flanking the North and South
   * edges of Harsha's Royal Courtyard (3 slender columns per side, delicate fairy-tale arches,
   * sparse roses, and tiny hanging crystal lanterns). Open, low, and roof-free.
   */
  private buildLowCurvedGardenArcades(
    pearlMarbleMat: THREE.Material,
    blushStoneMat: THREE.Material,
    champagneGoldMat: THREE.Material,
  ): void {
    const { tracker } = this;
    const arcadeRadius = 3.42;

    const plinthGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.13, 0.15, 0.24, 14),
    );
    plinthGeo.translate(0, 0.12, 0);
    const colShaftGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.068, 0.078, 1.18, 14),
    );
    colShaftGeo.translate(0, 0.83, 0);
    const capitalGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.11, 0.075, 0.1, 14),
    );
    capitalGeo.translate(0, 1.47, 0);
    const lanternDropGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.055, 0),
    );
    const roseAccentGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.055, 8, 8),
    );

    [-1, 1].forEach((sideSign) => {
      // 3 slender columns per side at 58°, 86°, and 114° from East (+X)
      const colAngles = [
        sideSign * 1.02,
        sideSign * 1.48,
        sideSign * 1.94,
      ];
      const colPositions: THREE.Vector3[] = [];

      for (let c = 0; c < colAngles.length; c++) {
        const ang = colAngles[c];
        const cx = this.throneLocalX + Math.cos(ang) * arcadeRadius;
        const cz = Math.sin(ang) * arcadeRadius;
        colPositions.push(new THREE.Vector3(cx, 0, cz));

        const colGroup = new THREE.Group();
        colGroup.position.set(cx, 0, cz);
        colGroup.add(
          new THREE.Mesh(plinthGeo, pearlMarbleMat),
          new THREE.Mesh(colShaftGeo, pearlMarbleMat),
          new THREE.Mesh(capitalGeo, champagneGoldMat),
        );

        // Sparse rose cluster near the column capital
        const rose = new THREE.Mesh(roseAccentGeo, this.gardenBlossomMat);
        rose.position.set(0, 1.44, 0);
        colGroup.add(rose);
        this.dwRoot.add(colGroup);
      }

      // Connect adjacent columns with a low pearl balustrade & delicate fairy-tale arch
      for (let seg = 0; seg < 2; seg++) {
        const pA = colPositions[seg];
        const pB = colPositions[seg + 1];
        const midX = (pA.x + pB.x) * 0.5;
        const midZ = (pA.z + pB.z) * 0.5;
        const span = Math.hypot(pB.x - pA.x, pB.z - pA.z);
        const yaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);

        const segGroup = new THREE.Group();
        segGroup.position.set(midX, 0, midZ);
        segGroup.rotation.y = yaw;

        // Low balustrade rail (`height = 0.42m`)
        const lowRailGeo = tracker.trackGeo(
          new THREE.BoxGeometry(0.09, 0.06, span),
        );
        lowRailGeo.translate(0, 0.42, 0);
        segGroup.add(new THREE.Mesh(lowRailGeo, blushStoneMat));

        // Delicate fairy-tale top arch spanning between the 2 columns
        const archRadius = span * 0.5;
        const archGeo = tracker.trackGeo(
          new THREE.TorusGeometry(archRadius, 0.024, 10, 24, Math.PI),
        );
        archGeo.rotateY(Math.PI / 2);
        archGeo.translate(0, 1.5, 0);
        segGroup.add(new THREE.Mesh(archGeo, champagneGoldMat));

        // Tiny hanging crystal lantern beneath the arch crown
        const lantern = new THREE.Mesh(
          lanternDropGeo,
          this.courtyardLanternMat,
        );
        lantern.position.set(0, 1.5 + archRadius - 0.14, 0);
        segGroup.add(lantern);

        this.dwRoot.add(segGroup);
      }
    });
  }

  /**
   * Sections 7–15: Builds Harsha's Royal Crystal Palace at `(palaceLocalX = 6.45, 0, 0)`,
   * facing West (`-X`) so it frames Harsha and her throne without consuming the upper sky.
   *
   * Architectural Components:
   * 1. Royal Terrace (`y = 0.0..0.28m`)
   * 2. Central Palace Keep (`radius = 1.42m, y = 0.28..3.35m`) with Grand Fairy-Tale Arch
   * 3. Central Translucent Pink Crystal Dome (`y = 3.35..4.55m`) with 8 Champagne-Gold Ribs
   * 4. Slender Heart Spire (`y = 4.55..5.45m`) with small Ruby-Pink Heart Finial
   * 5. Two Symmetrical Two-Story Palace Wings (`z = ±2.15m, height = 2.65m`)
   * 6. Twin Slender Framing Turrets (`z = ±3.35m, total height = 4.52m`)
   */
  private buildRoyalCrystalPalace(
    pearlMarbleMat: THREE.Material,
    blushStoneMat: THREE.Material,
    champagneGoldMat: THREE.Material,
    turretRoofRoseGoldMat: THREE.Material,
  ): void {
    const { tracker } = this;

    this.palaceGroup = new THREE.Group();
    this.palaceGroup.name = 'HarshaRoyalCrystalPalaceArchitecture';
    this.palaceGroup.position.set(this.palaceLocalX, 0.0, this.palaceLocalZ);
    this.dwRoot.add(this.palaceGroup);

    // 1. Royal Terrace Platform (`y = 0.0..0.28m`)
    const terraceBaseGeo = tracker.trackGeo(
      new THREE.BoxGeometry(2.4, 0.28, 7.6),
    );
    terraceBaseGeo.translate(0, 0.14, 0);
    const terraceFrontApronGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.75, 1.88, 0.28, 28),
    );
    terraceFrontApronGeo.translate(-0.45, 0.14, 0);
    const terraceStepGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(1.95, 2.06, 0.14, 28),
    );
    terraceStepGeo.translate(-0.62, 0.07, 0);
    const terraceGoldRimGeo = tracker.trackGeo(
      new THREE.TorusGeometry(1.76, 0.022, 10, 32),
    );
    terraceGoldRimGeo.rotateX(Math.PI / 2);
    terraceGoldRimGeo.translate(-0.45, 0.28, 0);

    this.palaceGroup.add(
      new THREE.Mesh(terraceBaseGeo, pearlMarbleMat),
      new THREE.Mesh(terraceFrontApronGeo, pearlMarbleMat),
      new THREE.Mesh(terraceStepGeo, blushStoneMat),
      new THREE.Mesh(terraceGoldRimGeo, champagneGoldMat),
    );

    // 2. Central Palace Keep (`softly octagonal pavilion, y = 0.28..3.35m`)
    const keepHeight = 3.07;
    const keepRadius = 1.42;
    const keepBodyGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(keepRadius, keepRadius * 1.04, keepHeight, 8),
    );
    keepBodyGeo.rotateY(Math.PI / 8);
    keepBodyGeo.translate(0, 0.28 + keepHeight * 0.5, 0);
    this.palaceGroup.add(new THREE.Mesh(keepBodyGeo, pearlMarbleMat));

    // Blush rose architectural waist & frieze bands on the central keep
    const waistBandGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(keepRadius + 0.03, keepRadius + 0.03, 0.18, 8),
    );
    waistBandGeo.rotateY(Math.PI / 8);
    waistBandGeo.translate(0, 1.92, 0);
    const topCorniceGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(keepRadius + 0.08, keepRadius + 0.02, 0.16, 16),
    );
    topCorniceGeo.translate(0, 3.32, 0);
    const goldCorniceRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(keepRadius + 0.06, 0.028, 10, 32),
    );
    goldCorniceRingGeo.rotateX(Math.PI / 2);
    this.palaceGroup.add(
      new THREE.Mesh(waistBandGeo, blushStoneMat),
      new THREE.Mesh(topCorniceGeo, blushStoneMat),
    );
    [0.3, 1.92, 3.35].forEach((ry) => {
      const ring = new THREE.Mesh(goldCorniceRingGeo, champagneGoldMat);
      ring.position.y = ry;
      this.palaceGroup.add(ring);
    });

    // 8 Slender Champagne-Gold Corner Pilasters around the Octagonal Keep
    const pilasterGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.048, 0.055, keepHeight, 10),
    );
    pilasterGeo.translate(0, 0.28 + keepHeight * 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const pilaster = new THREE.Mesh(pilasterGeo, champagneGoldMat);
      pilaster.position.set(
        Math.cos(ang) * (keepRadius + 0.02),
        0,
        Math.sin(ang) * (keepRadius + 0.02),
      );
      this.palaceGroup.add(pilaster);
    }

    // Central Grand Fairy-Tale Royal Arch on West Facade (`x = -keepRadius`, framing Harsha's throne)
    this.addFairyTaleRoyalArchWindow(
      this.palaceGroup,
      -keepRadius - 0.02,
      0.28,
      0.0,
      -Math.PI / 2,
      0.56,
      1.95,
      this.groundWindowGlowMat,
      champagneGoldMat,
    );

    // Flanking Ground-Tier & Upper-Tier Fairy-Tale Arched Crystal Windows on the Keep
    [-0.78, 0.78].forEach((wz) => {
      const ang = wz < 0 ? -Math.PI * 0.72 : Math.PI * 0.72;
      const wx = Math.cos(ang) * (keepRadius - 0.02);
      const wPosZ = Math.sin(ang) * (keepRadius - 0.02);
      this.addFairyTaleRoyalArchWindow(
        this.palaceGroup,
        wx,
        0.52,
        wPosZ,
        ang - Math.PI / 2,
        0.28,
        1.05,
        this.groundWindowGlowMat,
        champagneGoldMat,
      );
      this.addFairyTaleRoyalArchWindow(
        this.palaceGroup,
        wx,
        2.12,
        wPosZ,
        ang - Math.PI / 2,
        0.24,
        0.78,
        this.upperWindowGlowMat,
        champagneGoldMat,
      );
    });
    // Central Upper Clerestory Crystal Arch above the Grand Arch
    this.addFairyTaleRoyalArchWindow(
      this.palaceGroup,
      -keepRadius - 0.02,
      2.38,
      0.0,
      -Math.PI / 2,
      0.32,
      0.64,
      this.upperWindowGlowMat,
      champagneGoldMat,
    );

    // 3. Section 10: Central Translucent Pink Crystal Dome (`y = 3.35..4.55m`)
    const domeRadius = 1.28;
    const outerDomeGeo = tracker.trackGeo(
      new THREE.SphereGeometry(
        domeRadius,
        28,
        18,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5,
      ),
    );
    outerDomeGeo.scale(1.0, 0.94, 1.0);
    outerDomeGeo.translate(0, 3.35, 0);

    const innerDomeCoreGeo = tracker.trackGeo(
      new THREE.SphereGeometry(
        domeRadius * 0.86,
        20,
        14,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5,
      ),
    );
    innerDomeCoreGeo.scale(1.0, 0.9, 1.0);
    innerDomeCoreGeo.translate(0, 3.35, 0);

    this.palaceGroup.add(
      new THREE.Mesh(innerDomeCoreGeo, this.crystalDomeCoreMat),
      new THREE.Mesh(outerDomeGeo, this.crystalDomeShellMat),
    );

    // 8 Champagne-Gold Structural Ribs & Crown Collar on the Crystal Dome
    const domeRibGeo = tracker.trackGeo(
      new THREE.TorusGeometry(domeRadius + 0.015, 0.02, 8, 24, Math.PI * 0.48),
    );
    for (let r = 0; r < 8; r++) {
      const rib = new THREE.Mesh(domeRibGeo, champagneGoldMat);
      rib.position.set(0, 3.35, 0);
      rib.rotation.y = (r / 8) * Math.PI * 2;
      this.palaceGroup.add(rib);
    }

    const domeCollarGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.24, 0.3, 0.14, 16),
    );
    domeCollarGeo.translate(0, 4.54, 0);
    this.palaceGroup.add(new THREE.Mesh(domeCollarGeo, champagneGoldMat));

    // 4. Section 11: Slender Heart Spire (`y = 4.60..5.45m`)
    const spireShaftGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.075, 0.72, 14),
    );
    spireShaftGeo.translate(0, 4.96, 0);
    this.palaceGroup.add(new THREE.Mesh(spireShaftGeo, champagneGoldMat));

    // Small Refined Architectural Heart Finial at top of Spire (`y = 5.42m`)
    const spireHeartGroup = new THREE.Group();
    spireHeartGroup.position.set(0, 5.42, 0);
    spireHeartGroup.rotation.y = -Math.PI / 2;
    const finialLobeGeo = tracker.trackGeo(
      new THREE.SphereGeometry(0.055, 10, 10),
    );
    finialLobeGeo.scale(1.0, 1.05, 0.55);
    const fLobeL = new THREE.Mesh(finialLobeGeo, this.spireHeartMat);
    fLobeL.position.set(-0.038, 0.025, 0);
    const fLobeR = new THREE.Mesh(finialLobeGeo, this.spireHeartMat);
    fLobeR.position.set(0.038, 0.025, 0);
    const finialTipGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.082, 0.11, 10),
    );
    finialTipGeo.rotateX(Math.PI);
    finialTipGeo.scale(1.0, 1.0, 0.5);
    finialTipGeo.translate(0, -0.035, 0);
    const fTip = new THREE.Mesh(finialTipGeo, this.spireHeartMat);
    spireHeartGroup.add(fLobeL, fLobeR, fTip);
    this.palaceGroup.add(spireHeartGroup);

    // 5. Section 12: Two Symmetrical Two-Story Palace Wings (`z = ±2.15m`)
    const wingWidth = 1.62;
    const wingHeight = 2.42;
    const wingDepth = 0.86;
    const wingBodyGeo = tracker.trackGeo(
      new THREE.BoxGeometry(wingDepth, wingHeight, wingWidth),
    );
    wingBodyGeo.translate(0, 0.28 + wingHeight * 0.5, 0);
    const wingCorniceGeo = tracker.trackGeo(
      new THREE.BoxGeometry(wingDepth + 0.08, 0.1, wingWidth + 0.08),
    );

    [-1, 1].forEach((side) => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(-0.18, 0, side * 2.12);
      wingGroup.rotation.y = side * -0.12; // Gentle welcoming curve toward Harsha

      const wBody = new THREE.Mesh(wingBodyGeo, pearlMarbleMat);
      const wMidBand = new THREE.Mesh(wingCorniceGeo, blushStoneMat);
      wMidBand.position.y = 1.48;
      const wTopCornice = new THREE.Mesh(wingCorniceGeo, champagneGoldMat);
      wTopCornice.position.y = 2.7;
      wingGroup.add(wBody, wMidBand, wTopCornice);

      // Two-story fairy-tale arched crystal windows on each wing
      [-0.42, 0.42].forEach((wz) => {
        this.addFairyTaleRoyalArchWindow(
          wingGroup,
          -wingDepth * 0.5 - 0.01,
          0.46,
          wz,
          -Math.PI / 2,
          0.22,
          0.82,
          this.groundWindowGlowMat,
          champagneGoldMat,
        );
        this.addFairyTaleRoyalArchWindow(
          wingGroup,
          -wingDepth * 0.5 - 0.01,
          1.64,
          wz,
          -Math.PI / 2,
          0.2,
          0.74,
          this.upperWindowGlowMat,
          champagneGoldMat,
        );
      });

      this.palaceGroup.add(wingGroup);
    });

    // 6. Section 13: Twin Slender Framing Turrets (`x = -0.38, z = ±3.35m`)
    const turretRadius = 0.54;
    const turretHeight = 2.92;
    const turretShaftGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(
        turretRadius * 0.94,
        turretRadius,
        turretHeight,
        18,
      ),
    );
    turretShaftGeo.translate(0, 0.28 + turretHeight * 0.5, 0);
    const turretRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(turretRadius, 0.02, 8, 24),
    );
    turretRingGeo.rotateX(Math.PI / 2);
    const turretRoofGeo = tracker.trackGeo(
      new THREE.ConeGeometry(turretRadius * 1.12, 1.12, 20),
    );
    turretRoofGeo.translate(0, 3.2 + 0.56, 0);
    const turretFinialShaftGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.032, 0.22, 8),
    );
    turretFinialShaftGeo.translate(0, 4.42, 0);
    const turretCrownRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.048, 0.012, 8, 14),
    );
    turretCrownRingGeo.rotateX(Math.PI / 2);
    turretCrownRingGeo.translate(0, 4.38, 0);

    [-1, 1].forEach((side) => {
      const turretGroup = new THREE.Group();
      turretGroup.position.set(-0.38, 0, side * 3.35);

      turretGroup.add(
        new THREE.Mesh(turretShaftGeo, pearlMarbleMat),
        new THREE.Mesh(turretRoofGeo, turretRoofRoseGoldMat),
        new THREE.Mesh(turretFinialShaftGeo, champagneGoldMat),
        new THREE.Mesh(turretCrownRingGeo, champagneGoldMat),
      );

      [0.32, 1.72, 3.18].forEach((ry) => {
        const ring = new THREE.Mesh(turretRingGeo, champagneGoldMat);
        ring.position.y = ry;
        turretGroup.add(ring);
      });

      // Small fairy-tale crystal windows on each slender turret
      this.addFairyTaleRoyalArchWindow(
        turretGroup,
        -turretRadius * 0.95,
        0.65,
        0,
        -Math.PI / 2,
        0.19,
        0.78,
        this.groundWindowGlowMat,
        champagneGoldMat,
      );
      this.addFairyTaleRoyalArchWindow(
        turretGroup,
        -turretRadius * 0.95,
        1.92,
        0,
        -Math.PI / 2,
        0.18,
        0.72,
        this.upperWindowGlowMat,
        champagneGoldMat,
      );

      this.palaceGroup.add(turretGroup);
    });
  }

  /**
   * Section 9: Helper to construct a tall, elegant fairy-tale royal arched crystal window
   * with a sculpted champagne-gold frame, vertical mullion, and recessed crystal glass pane.
   */
  private addFairyTaleRoyalArchWindow(
    parent: THREE.Object3D,
    x: number,
    bottomY: number,
    z: number,
    rotY: number,
    halfWidth: number,
    totalHeight: number,
    crystalMat: THREE.Material,
    goldMat: THREE.Material,
  ): void {
    const { tracker } = this;
    const winGroup = new THREE.Group();
    winGroup.position.set(x, bottomY, z);
    winGroup.rotation.y = rotY;

    const archRadius = halfWidth;
    const rectHeight = Math.max(0.18, totalHeight - archRadius);

    // Recessed crystal pane (rectangular lower body + semicircular arch top)
    const paneRectGeo = tracker.trackGeo(
      new THREE.PlaneGeometry(halfWidth * 1.92, rectHeight),
    );
    paneRectGeo.translate(0, rectHeight * 0.5, 0.01);
    const paneArchGeo = tracker.trackGeo(
      new THREE.CircleGeometry(archRadius * 0.96, 18, 0, Math.PI),
    );
    paneArchGeo.translate(0, rectHeight, 0.01);
    winGroup.add(
      new THREE.Mesh(paneRectGeo, crystalMat),
      new THREE.Mesh(paneArchGeo, crystalMat),
    );

    // Sculpted Champagne-Gold Arch Frame, Side Jambs, Sill, and Delicate Mullion
    const archFrameGeo = tracker.trackGeo(
      new THREE.TorusGeometry(archRadius, 0.022, 8, 20, Math.PI),
    );
    archFrameGeo.translate(0, rectHeight, 0.02);
    const jambGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.02, 0.02, rectHeight, 8),
    );
    jambGeo.translate(0, rectHeight * 0.5, 0.02);
    const jambL = new THREE.Mesh(jambGeo, goldMat);
    jambL.position.x = -halfWidth;
    const jambR = new THREE.Mesh(jambGeo, goldMat);
    jambR.position.x = halfWidth;

    const sillGeo = tracker.trackGeo(
      new THREE.BoxGeometry(halfWidth * 2.2, 0.036, 0.06),
    );
    sillGeo.translate(0, 0.018, 0.02);

    const mullionGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.01, 0.01, totalHeight * 0.94, 6),
    );
    mullionGeo.translate(0, totalHeight * 0.47, 0.022);

    winGroup.add(
      new THREE.Mesh(archFrameGeo, goldMat),
      jambL,
      jambR,
      new THREE.Mesh(sillGeo, goldMat),
      new THREE.Mesh(mullionGeo, goldMat),
    );

    parent.add(winGroup);
  }

  /**
   * Section 14 & 15: Frustum & Bounding-Box Validation
   * Evaluates the real bounding boxes of the Royal Crystal Palace and the 3D Sky Message
   * against the actual Finale Camera Frustum (`PerspectiveCamera`), ensuring:
   * 1. The palace never overlaps or clips the "I LOVE YOU ❤️" sky message.
   * 2. Harsha, her throne, the palace, and the full sky message fit inside the finale frustum.
   */
  private validatePalaceAndSkyFrustum(): void {
    this.dwRoot.updateMatrixWorld(true);

    const palaceBox = new THREE.Box3().setFromObject(this.palaceGroup);
    const palaceMaxLocalY = palaceBox.max.y - this.y0;

    // Project palace top Y onto the sky message plane from the finale camera
    const camX = this.finaleEndCamLocalPos.x;
    const camY = this.finaleEndCamLocalPos.y;
    const palaceDistX = this.palaceLocalX - camX;
    const skyDistX = this.skyMessageGroup.position.x - camX;
    const projectedPalaceTopAtSky =
      camY + (palaceMaxLocalY - camY) * (skyDistX / Math.max(1.0, palaceDistX));

    // Guarantee at least 1.35m of open sky clearance between projected palace spire and sky message bottom
    const minSkyCenterY = projectedPalaceTopAtSky + 1.85;
    if (this.skyMessageGroup.position.y < minSkyCenterY) {
      this.skyMessageGroup.position.y = minSkyCenterY;
    }

    // Verify full frustum containment using a real PerspectiveCamera (16:9 standard aspect)
    const testCam = new THREE.PerspectiveCamera(
      this.finaleEndFov,
      16 / 9,
      0.1,
      100.0,
    );
    testCam.position.set(
      this.originX + this.dwCenterX + this.finaleEndCamLocalPos.x,
      this.baseY + this.y0 + this.finaleEndCamLocalPos.y,
      this.originZ + this.dwCenterZ + this.finaleEndCamLocalPos.z,
    );
    testCam.lookAt(
      this.originX + this.dwCenterX + this.finaleEndLookLocalPos.x,
      this.baseY + this.y0 + this.finaleEndLookLocalPos.y,
      this.originZ + this.dwCenterZ + this.finaleEndLookLocalPos.z,
    );
    testCam.updateMatrixWorld(true);
    testCam.updateProjectionMatrix();

    const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(
      testCam.projectionMatrix,
      testCam.matrixWorldInverse,
    );
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      projScreenMatrix,
    );

    const skyTopWorldPoint = new THREE.Vector3(
      this.originX + this.dwCenterX + this.skyMessageGroup.position.x,
      this.baseY + this.y0 + this.skyMessageGroup.position.y + 0.75,
      this.originZ + this.dwCenterZ,
    );
    if (!frustum.containsPoint(skyTopWorldPoint)) {
      this.finaleEndLookLocalPos.y += 0.35;
    }
  }

  /**
   * Preserved `buildFinaleFireworksSystem()` particle buffer engine (Section 32).
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
      const vx = Math.sin(i * 12.9898) * 0.5 * 0.26;

      if (pattern === 'heart') {
        // Parametric 3D heart in the Y-Z plane above the central palace
        const hx = 16 * Math.pow(Math.sin(t), 3) * 0.082;
        const hy =
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
          0.082;
        vz = hx;
        vy = hy;
        _scratchColor.set(i % 2 === 0 ? '#fde047' : '#f43f5e');
      } else if (pattern === 'flower') {
        // 6-petal blossom burst above the left slender turret
        const r = (0.55 + 0.45 * Math.cos(6 * t)) * 1.18;
        vz = Math.cos(t) * r;
        vy = Math.sin(t) * r;
        _scratchColor.set(i % 2 === 0 ? '#fbcfe8' : '#e9d5ff');
      } else {
        // 5-pointed star burst above the right slender turret
        const starWave = Math.abs((((t / (Math.PI * 2)) * 5) % 1) - 0.5) * 2.0;
        const r = (0.48 + 0.72 * Math.pow(starWave, 1.4)) * 1.22;
        vz = Math.cos(t) * r;
        vy = Math.sin(t) * r;
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

  /**
   * Section 23: Resets the Royal Crystal Palace and Courtyard to their soft moonlit state
   * prior to the crown ceremony.
   */
  private resetPalaceToMoonlitState(): void {
    this.crownHeartGemMat.emissiveIntensity = 0.3;
    this.throneUnderglowMat.emissiveIntensity = 0.32;
    this.courtyardLanternMat.emissiveIntensity = 0.22;
    this.gardenBlossomMat.emissiveIntensity = 0.22;
    this.groundWindowGlowMat.emissiveIntensity = 0.16;
    this.upperWindowGlowMat.emissiveIntensity = 0.14;
    this.crystalDomeShellMat.emissiveIntensity = 0.15;
    this.crystalDomeCoreMat.emissiveIntensity = 0.18;
    this.spireHeartMat.emissiveIntensity = 0.12;
    this.palaceAwakeningLight.intensity = 0.45;
    this.palaceAwakeningLight.color.set('#e9d5ff');
  }

  /**
   * Section 25: Sets the Royal Crystal Palace to its fully awakened luminous state.
   */
  private setPalaceFullyAwakened(): void {
    this.crownHeartGemMat.emissiveIntensity = 1.4;
    this.throneUnderglowMat.emissiveIntensity = 1.35;
    this.courtyardLanternMat.emissiveIntensity = 1.25;
    this.gardenBlossomMat.emissiveIntensity = 0.85;
    this.groundWindowGlowMat.emissiveIntensity = 1.25;
    this.upperWindowGlowMat.emissiveIntensity = 1.2;
    this.crystalDomeShellMat.emissiveIntensity = 0.65;
    this.crystalDomeCoreMat.emissiveIntensity = 1.35;
    this.spireHeartMat.emissiveIntensity = 1.45;
    this.palaceAwakeningLight.intensity = 1.45;
    this.palaceAwakeningLight.color.set('#fbcfe8');
  }

  /**
   * Section 25: Progressive Palace Awakening Timeline (`T = 0.0 -> 2.0s`):
   * - T = 0.0s: Crown heart gem reaches peak
   * - T = 0.0–0.4s: Throne/dais brightens
   * - T = 0.4–0.8s: Garden/courtyard accents awaken
   * - T = 0.8–1.3s: Ground-floor palace windows illuminate
   * - T = 1.3–1.7s: Upper windows illuminate
   * - T = 1.7–2.0s: Crystal dome brightens
   * - T = 2.0s: Heart spire glows
   */
  private applyPalaceAwakeningTimeline(tSec: number): void {
    this.crownHeartGemMat.emissiveIntensity = 1.4;

    const uThrone = smoothStep01(THREE.MathUtils.clamp(tSec / 0.4, 0, 1));
    this.throneUnderglowMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.32,
      1.35,
      uThrone,
    );

    const uCourtyard = smoothStep01(
      THREE.MathUtils.clamp((tSec - 0.4) / 0.4, 0, 1),
    );
    this.courtyardLanternMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.22,
      1.25,
      uCourtyard,
    );
    this.gardenBlossomMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.22,
      0.85,
      uCourtyard,
    );

    const uGroundWin = smoothStep01(
      THREE.MathUtils.clamp((tSec - 0.8) / 0.5, 0, 1),
    );
    this.groundWindowGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.16,
      1.25,
      uGroundWin,
    );

    const uUpperWin = smoothStep01(
      THREE.MathUtils.clamp((tSec - 1.3) / 0.4, 0, 1),
    );
    this.upperWindowGlowMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.14,
      1.2,
      uUpperWin,
    );

    const uDome = smoothStep01(
      THREE.MathUtils.clamp((tSec - 1.7) / 0.3, 0, 1),
    );
    this.crystalDomeShellMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.15,
      0.65,
      uDome,
    );
    this.crystalDomeCoreMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.18,
      1.35,
      uDome,
    );
    this.palaceAwakeningLight.intensity = THREE.MathUtils.lerp(
      0.45,
      1.45,
      uDome,
    );

    const uSpire = smoothStep01(
      THREE.MathUtils.clamp((tSec - 1.85) / 0.15, 0, 1),
    );
    this.spireHeartMat.emissiveIntensity = THREE.MathUtils.lerp(
      0.12,
      1.45,
      uSpire,
    );
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
    this.resetPalaceToMoonlitState();

    this.crownGroup.visible = true;
    this.crownGroup.position.set(this.throneLocalX - 0.38, 1.9, this.throneLocalZ);
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
    this.resetPalaceToMoonlitState();

    this.crownGroup.visible = true;
    this.crownGroup.position.set(this.throneLocalX - 0.38, 1.9, this.throneLocalZ);
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
   * Section 27: ZERO dialogue cards or subtitles in the Mini World.
   */
  public getCurrentDialogue(): null {
    return null;
  }

  /**
   * Section 27: ZERO story captions or top banners in the Mini World.
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
      this.state = 'PALACE_AWAKENING';
      this.stateElapsed = 0.0;
      return true;
    }
    if (this.state === 'PALACE_AWAKENING') {
      this.setPalaceFullyAwakened();
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
    this.setPalaceFullyAwakened();
    this.completeRestoreControl();
    return true;
  }

  private equipCrownOnHarsha(): void {
    if (!this.hasEquippedCrownInSequence) {
      this.hasEquippedCrownInSequence = true;
      this.avatarBridge?.setJewelleryEquipped({ crownEquipped: true });
      this.crownGroup.visible = false;
      this.crownHeartGemMat.emissiveIntensity = 1.4;
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
   * Section 34: Restores player exploration control cleanly inside the Royal Courtyard
   * after `FINAL_HOLD` completes.
   */
  private completeRestoreControl(): void {
    this.state = 'RESTORE_CONTROL';
    this.isInsideLittleDreamWorld = true;
    this.pendingTeleport = {
      pos: _scratchTeleportPos.set(
        this.originX + this.dwCenterX + 1.25,
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
   * Section 35: Exiting the Mini World ALWAYS returns the player to the safe Floor 2
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

    // 3. GARDEN (Harsha walks gently along the curved S-path into her courtyard and sits on her throne)
    if (this.state === 'GARDEN') {
      const u = smoothStep01(
        THREE.MathUtils.clamp(this.stateElapsed / this.DUR_GARDEN, 0, 1),
      );

      const walkU = smoothStep01(THREE.MathUtils.clamp(u / 0.82, 0, 1));
      const sCurveZ = Math.sin(walkU * Math.PI * 2.0) * 0.38 * (1.0 - walkU);
      const harshaLocalX = THREE.MathUtils.lerp(
        -4.6,
        this.throneLocalX - 0.03,
        walkU,
      );
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

      // Accompanying camera glide coming to rest at the intimate throne + palace arch framing
      this.currentCamLocalPos.set(
        THREE.MathUtils.lerp(-2.2, 0.75, u),
        THREE.MathUtils.lerp(1.75, 1.56, u),
        THREE.MathUtils.lerp(-1.35, 0.0, u),
      );
      this.currentLookLocalPos.set(
        THREE.MathUtils.lerp(harshaLocalX + 0.6, this.throneLocalX, u),
        THREE.MathUtils.lerp(1.25, 1.38, u),
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

    // 4. CROWN_RISING, CROWN_SETTLING (2.2s), PALACE_AWAKENING (2.0s) & QUIET_PAUSE (2.8s)
    if (
      this.state === 'CROWN_RISING' ||
      this.state === 'CROWN_SETTLING' ||
      this.state === 'PALACE_AWAKENING' ||
      this.state === 'QUIET_PAUSE'
    ) {
      // Intimate, completely steady framing where Harsha, her crown, her throne,
      // and the awakening Royal Crystal Palace behind her are all visible
      this.currentCamLocalPos.set(0.75, 1.56, 0.0);
      this.currentLookLocalPos.set(this.throneLocalX, 1.38, 0.0);
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

    // 5. FINALE_CAMERA, FIREWORKS & FINAL_HOLD (Sections 30–33)
    // Single smooth backward + upward pull-back revealing the courtyard, the awakened palace,
    // the 3 fireworks bursts, and "I LOVE YOU ❤️" in the open sky above the Heart Spire.
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

    this.currentCamLocalPos.set(
      THREE.MathUtils.lerp(
        this.finaleStartCamLocalPos.x,
        this.finaleEndCamLocalPos.x,
        easedPull,
      ),
      THREE.MathUtils.lerp(
        this.finaleStartCamLocalPos.y,
        this.finaleEndCamLocalPos.y,
        easedPull,
      ),
      THREE.MathUtils.lerp(
        this.finaleStartCamLocalPos.z,
        this.finaleEndCamLocalPos.z,
        easedPull,
      ),
    );
    this.currentLookLocalPos.set(
      THREE.MathUtils.lerp(
        this.finaleStartLookLocalPos.x,
        this.finaleEndLookLocalPos.x,
        easedPull,
      ),
      THREE.MathUtils.lerp(
        this.finaleStartLookLocalPos.y,
        this.finaleEndLookLocalPos.y + this.lookPitchOffset * 1.3,
        easedPull,
      ),
      THREE.MathUtils.lerp(
        this.finaleStartLookLocalPos.z,
        this.finaleEndLookLocalPos.z + this.lookYawOffset * 2.0,
        easedPull,
      ),
    );
    this.currentFov = THREE.MathUtils.lerp(45.0, this.finaleEndFov, easedPull);

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
        ? 0.85 + Math.sin(clockTime * 2.6) * 0.18
        : 0.35;
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
        // First 1.2s of the 2.2s Crown Sequence
        const u = smoothStep01(
          THREE.MathUtils.clamp(this.stateElapsed / this.DUR_CROWN_RISING, 0, 1),
        );
        this.crownGroup.visible = true;
        this.crownGroup.position.set(
          THREE.MathUtils.lerp(
            this.throneLocalX - 0.38,
            this.throneLocalX - 0.14,
            u,
          ),
          THREE.MathUtils.lerp(1.9, 2.02, Math.sin(u * Math.PI * 0.5)),
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
        // Final 1.0s of the 2.2s Crown Sequence: aligns to Harsha's real head attachment
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
          THREE.MathUtils.lerp(2.02, targetLocalY, u),
          THREE.MathUtils.lerp(this.throneLocalZ, targetLocalZ, u),
        );
        this.crownHeartGemMat.emissiveIntensity = THREE.MathUtils.lerp(
          0.75,
          1.4,
          u,
        );

        if (this.stateElapsed >= this.DUR_CROWN_SETTLING) {
          this.equipCrownOnHarsha();
          this.state = 'PALACE_AWAKENING';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'PALACE_AWAKENING') {
        // Section 25: Progressive 2.0s Palace Awakening Timeline
        this.applyPalaceAwakeningTimeline(this.stateElapsed);
        if (this.stateElapsed >= this.DUR_PALACE_AWAKENING) {
          this.setPalaceFullyAwakened();
          this.state = 'QUIET_PAUSE';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'QUIET_PAUSE') {
        // Section 29: 2.8s of complete stillness (Harsha + Crown + Throne + Awakened Palace)
        if (this.stateElapsed >= this.DUR_QUIET_PAUSE) {
          this.finaleStartCamLocalPos.copy(this.currentCamLocalPos);
          this.finaleStartLookLocalPos.copy(this.currentLookLocalPos);
          this.state = 'FINALE_CAMERA';
          this.stateElapsed = 0.0;
        }
      } else if (this.state === 'FINALE_CAMERA') {
        // Section 30 & 32: Fireworks begin only after palace awakening + quiet pause + camera progress >= 0.80
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
        // Section 33: Hold final composition for 5.0s, then restore control cleanly
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
   * Section 32: Drives the 3 sparse, deterministic fireworks bursts and the 3D world-space
   * "I LOVE YOU ❤️" sky message during `FIREWORKS` and `FINAL_HOLD`.
   * - Firework 1 (`t = 0.0s`): Rose-pink/champagne Heart above the central palace
   * - Firework 2 (`t = 1.2s`): Blush/lavender Flower above the left turret
   * - Firework 3 (`t = 2.4s`): Champagne-gold Star above the right turret
   */
  private updateFinaleFireworksAndSkyMessage(
    delta: number,
    clockTime: number,
  ): void {
    this.fireworksElapsed += delta;

    // Burst 1 (t = 0.0s): Heart above central palace
    if (!this.fireworksBurst1Launched && this.fireworksElapsed >= 0.0) {
      this.fireworksBurst1Launched = true;
      this.launchFireworkBurst(0, 80, 9.6, 6.85, 0.0, 'heart');
    }
    // Burst 2 (t = 1.2s): Flower above left turret
    if (!this.fireworksBurst2Launched && this.fireworksElapsed >= 1.2) {
      this.fireworksBurst2Launched = true;
      this.launchFireworkBurst(80, 80, 9.4, 6.15, -3.55, 'flower');
    }
    // Burst 3 (t = 2.4s): Star above right turret
    if (!this.fireworksBurst3Launched && this.fireworksElapsed >= 2.4) {
      this.fireworksBurst3Launched = true;
      this.launchFireworkBurst(160, 80, 9.4, 6.15, 3.55, 'star');
    }

    // Gentle secondary heart shimmer during final hold so sky remains luminous without clutter
    if (this.fireworksElapsed >= 4.5 && this.fireworksElapsed - delta < 4.5) {
      this.launchFireworkBurst(0, 80, 9.6, 6.85, 0.0, 'heart');
    }

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

    // Smooth Fade-In & Soft Pulse of the 3D World-Space "I LOVE YOU ❤️" Sky Sculpture
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
