import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';
import { MicroPropLibrary } from './CastleCreativeWingMicroProps';
import { CastleJewelleryAtelier, JewelleryAvatarBridge } from './CastleJewelleryAtelier';
import { CastleTabletopWorld } from './CastleTabletopWorld';

export type CreativeWingActiveCameraMode =
  | 'none'
  | 'portrait_atelier'
  | 'film_strip_developing'
  | 'film_strip_inspect'
  | 'return_to_capture_location'
  | 'couture_boutique'
  | 'doll_playroom';

export type FilmStripStage =
  | 'idle'
  | 'developing'
  | 'developed_ready_to_inspect'
  | 'inspecting'
  | 'memory_kept';

export interface LastPhotoCaptureContext {
  worldPosition: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  playerYaw: number;
  playerPitch: number;
  backdropIndex: number;
  portraitIndex: number;
  timestamp: number;
}

export interface CreativeWingCameraState {
  active: boolean;
  mode: CreativeWingActiveCameraMode;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  fov?: number;
  seatWorldPos?: THREE.Vector3;
  seatYaw?: number;
  isSitting?: boolean;
}

export interface CastleFloor2CreativeWingBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  partitionMeshes: THREE.Mesh[];
  microPropLibrary: MicroPropLibrary;
  jewelleryAtelier: CastleJewelleryAtelier;
  tabletopWorld: CastleTabletopWorld;
  setAvatarBridge: (bridge: JewelleryAvatarBridge) => void;
  setKeepMemoryCallback: (cb: (portraitDataUrl: string, portraitIndex: number) => void) => void;
  setOpenCustomBackdropPickerCallback: (cb: () => void) => void;
  setCustomPhotoBackdrop: (imageSource: string) => void;
  capturePlayerPose: (
    worldPos: THREE.Vector3,
    camPos: THREE.Vector3,
    camTarget: THREE.Vector3,
    playerYaw: number,
    playerPitch: number,
  ) => void;
  consumePendingPhotoReturn: () => LastPhotoCaptureContext | null;
  getLastPhotoCaptureContext: () => LastPhotoCaptureContext | null;
  triggerTakePortrait: () => boolean;
  inspectFilmStrip: () => boolean;
  keepCapturedMemory: () => boolean;
  exitActiveCameraMode: () => void;
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  getActiveRoomCaption: () => string | null;
  interact: (playerPos: THREE.Vector3) => boolean;
  handleKeyAction: (key: string) => boolean;
  getCameraState: () => CreativeWingCameraState;
  applyLookDelta: (deltaYaw: number, deltaPitch: number) => void;
  update: (
    delta: number,
    clockTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ) => void;
}

// Module-scope scratch objects (Zero Per-Frame Allocations Contract)
const _scratchCamWorldPos = new THREE.Vector3();
const _scratchLookWorldPos = new THREE.Vector3();
const _scratchSeatWorldPos = new THREE.Vector3();

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
// PROCEDURAL CANVAS TEXTURES FOR HEADERS, BACKDROPS, PORTRAITS & LABELS
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
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createPlaqueTexture(
  tracker: ResourceTracker,
  label: string,
  bg = '#4a1525',
  fg = '#fde047',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = fg;
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 33);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSampleArtworkTexture(
  tracker: ResourceTracker,
  kind:
    | 'portrait_1'
    | 'portrait_2'
    | 'portrait_3'
    | 'diagram'
    | 'camera_art'
    | 'contact_sheet'
    | 'fashion_sketch'
    | 'kid_drawing',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (kind === 'portrait_1' || kind === 'portrait_2' || kind === 'portrait_3') {
      const grad = ctx.createLinearGradient(0, 0, 0, 320);
      if (kind === 'portrait_1') {
        grad.addColorStop(0, '#fbcfe8');
        grad.addColorStop(1, '#831843');
      } else if (kind === 'portrait_2') {
        grad.addColorStop(0, '#ddd6fe');
        grad.addColorStop(1, '#3b0764');
      } else {
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(1, '#9d174d');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 320);

      ctx.fillStyle = 'rgba(255,241,242,0.88)';
      ctx.beginPath();
      ctx.arc(128, 115, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(64, 280);
      ctx.quadraticCurveTo(128, 155, 192, 280);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(104, 80);
      ctx.lineTo(114, 58);
      ctx.lineTo(128, 72);
      ctx.lineTo(142, 58);
      ctx.lineTo(152, 80);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'diagram') {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 256, 320);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 216, 280);
      ctx.beginPath();
      ctx.arc(128, 150, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = '12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUBJECT', 128, 154);
      ctx.fillText('KEY LIGHT 45°', 68, 225);
      ctx.fillText('FILL LIGHT', 188, 225);
      ctx.fillText('RIM / BACKLIGHT', 128, 70);
    } else if (kind === 'camera_art') {
      ctx.fillStyle = '#fff1f2';
      ctx.fillRect(0, 0, 256, 320);
      ctx.strokeStyle = '#9d174d';
      ctx.lineWidth = 5;
      ctx.strokeRect(48, 100, 160, 110);
      ctx.beginPath();
      ctx.arc(128, 155, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#9d174d';
      ctx.font = 'bold 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('ATELIER OPTICS', 128, 255);
    } else if (kind === 'contact_sheet') {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 256, 320);
      const colors = ['#f472b6', '#c084fc', '#38bdf8', '#fbbf24', '#fb7185', '#a7f3d0'];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = colors[(r * 3 + c) % colors.length];
          ctx.fillRect(24 + c * 72, 28 + r * 68, 56, 48);
        }
      }
    } else if (kind === 'fashion_sketch') {
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, 256, 320);
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128, 65);
      ctx.lineTo(106, 130);
      ctx.lineTo(68, 260);
      ctx.lineTo(188, 260);
      ctx.lineTo(150, 130);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
      ctx.fill();
      ctx.fillStyle = '#831843';
      ctx.font = 'italic 15px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Couture Collection', 128, 290);
    } else {
      ctx.fillStyle = '#fefce8';
      ctx.fillRect(0, 0, 256, 320);
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(78, 150, 100, 100);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(68, 150);
      ctx.lineTo(128, 80);
      ctx.lineTo(188, 150);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(200, 60, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const BACKDROP_NAMES = [
  'Romantic Garden',
  'Dream Castle',
  'Starry Night',
  'Aurora Horizon',
  'Cloud Dream',
  'Pure Studio Glamour',
  'Custom Photo',
];

/**
 * `CreativeWing` Component for Floor 2 of the Dream Castle.
 * Handles the architectural layout (walls, floors, ceilings, arched doorways)
 * within the unoccupied left-side wing of Floor 2 (when facing the front atrium from the elevator,
 * lx in [8.8, 15.3], lz in [-15.2, +15.2]) and uses `MicroPropLibrary` to instantiate
 * differentiated props for the Photography Studio, Mini Fashion Boutique, and Doll Playroom
 * without increasing draw calls.
 */
export class CreativeWing implements CastleFloor2CreativeWingBundle {
  public readonly group: THREE.Group;
  public readonly colliders: CircleCollider[] = [];
  public readonly partitionMeshes: THREE.Mesh[] = [];
  public readonly microPropLibrary: MicroPropLibrary;
  public readonly jewelleryAtelier: CastleJewelleryAtelier;
  public readonly tabletopWorld: CastleTabletopWorld;

  private readonly tracker: ResourceTracker;
  private readonly mats: DreamCastleMaterials;
  private readonly originX: number;
  private readonly baseY: number;
  private readonly originZ: number;
  private readonly y0 = 5.25;
  private readonly yCeil = 9.62;

  private readonly dynamicObjects = new Set<THREE.Object3D>();
  private readonly wingLight: THREE.PointLight;
  private readonly roseAccentMat: THREE.MeshStandardMaterial;
  private readonly warmGlowMat: THREE.MeshStandardMaterial;
  private readonly pinkGlowMat: THREE.MeshStandardMaterial;
  private readonly photoRugMat: THREE.MeshStandardMaterial;
  private readonly labelGeo: THREE.PlaneGeometry;
  private readonly frameOuterGeo: THREE.BoxGeometry;
  private readonly frameInnerGeo: THREE.PlaneGeometry;
  private readonly heartSphereGeo: THREE.SphereGeometry;
  private readonly heartRingGeo: THREE.TorusGeometry;

  private backdropTextures: THREE.CanvasTexture[] = [];
  private customBackdropCanvas: HTMLCanvasElement | null = null;
  private customBackdropTex: THREE.CanvasTexture | null = null;
  private hasCustomBackdrop = false;
  private previousPresetIndex = 0;
  private backdropScreenMat!: THREE.MeshBasicMaterial;
  private capturedPortraitMat!: THREE.MeshBasicMaterial;
  private contactSheetMat!: THREE.MeshBasicMaterial;
  private shutterFlashMesh!: THREE.Mesh;
  private shutterFlashMat!: THREE.MeshBasicMaterial;
  private shutterFlashTimer = 0.0;
  private cameraShutterAnimTimer = 0.0;
  private cameraFocusRingMesh!: THREE.Mesh;
  private cameraLedMat!: THREE.MeshStandardMaterial;

  // Physical Film Strip & Memory Film Display State (Sections 5 & 6)
  private avatarBridge: JewelleryAvatarBridge | null = null;
  private filmStripStage: FilmStripStage = 'idle';
  private filmStripDevelopElapsed = 0.0;
  private readonly FILM_DEVELOP_TOTAL_DUR = 15.2; // Complete Phase A + B + C + Film Strip + Return to Capture Location
  private shutterFiredForCurrentCapture = false;
  private lastRedrawnDevelopBucket = -1;
  private filmStripCanvas!: HTMLCanvasElement;
  private filmStripTex!: THREE.CanvasTexture;
  private filmStripMat!: THREE.MeshStandardMaterial;
  private heroFilmStripGroup!: THREE.Group;
  private archivalStrip1Group!: THREE.Group;
  private archivalStrip2Group!: THREE.Group;
  private filmRackLightMat!: THREE.MeshStandardMaterial;
  private latestPortraitCanvas: HTMLCanvasElement | null = null;
  private latestPortraitTex: THREE.CanvasTexture | null = null;
  private isFilmCloseUpView = false;
  private keepMemoryCallback: ((portraitDataUrl: string, portraitIndex: number) => void) | null =
    null;
  private openCustomBackdropPickerCallback: (() => void) | null = null;
  private memoryKeptNoticeTimer = 0.0;

  // Sections 4–7 & 11–13: LastPhotoCaptureContext & Physical Portrait Memory Marker
  private lastPhotoCaptureContext: LastPhotoCaptureContext | null = null;
  private readonly _storedPhotoCaptureContext: LastPhotoCaptureContext = {
    worldPosition: new THREE.Vector3(),
    cameraPosition: new THREE.Vector3(),
    cameraTarget: new THREE.Vector3(),
    playerYaw: -Math.PI / 2,
    playerPitch: 0.14,
    backdropIndex: 0,
    portraitIndex: 0,
    timestamp: 0,
  };
  private readonly _livePoseWorldPos = new THREE.Vector3();
  private readonly _livePoseCamPos = new THREE.Vector3();
  private readonly _livePoseCamTarget = new THREE.Vector3();
  private _livePoseYaw = -Math.PI / 2;
  private _livePosePitch = 0.14;
  private _hasLivePose = false;
  private pendingPhotoReturn = false;
  private readonly returnStartCamPos = new THREE.Vector3();
  private readonly returnStartLookPos = new THREE.Vector3();
  private returnTransitionElapsed = 0.0;
  private readonly RETURN_TO_CAPTURE_DUR = 1.65;
  private lastPhotoMemoryMarkerGroup!: THREE.Group;

  private portraitCount = 0;
  private keptMemoriesCount = 0;
  private audioCtx: AudioContext | null = null;

  private activeBackdropIndex = 0;
  private windmillBlades!: THREE.Group;

  private activeCameraMode: CreativeWingActiveCameraMode = 'none';
  private cameraTransitionElapsed = 0.0;
  private readonly CAMERA_TRANSITION_DUR = 1.45;
  private activeCaption: string | null = null;
  private camLookYaw = 0.0;
  private camLookPitch = 0.0;
  private lastPlayerLx = 0.0;
  private lastPlayerLz = 0.0;
  private lastPlayerRelY = 999.0;

  constructor(
    tracker: ResourceTracker,
    mats: DreamCastleMaterials,
    originX: number,
    baseY: number,
    originZ: number,
  ) {
    this.tracker = tracker;
    this.mats = mats;
    this.originX = originX;
    this.baseY = baseY;
    this.originZ = originZ;

    this.group = new THREE.Group();
    this.group.name = 'CastleFloor2CreativeWing';

    this.microPropLibrary = new MicroPropLibrary(tracker, mats);

    // Shared PointLight for Creative Wing (Warm Rosy Ambience)
    this.wingLight = new THREE.PointLight('#fce7f3', 0.9, 20.0, 1.7);
    this.wingLight.position.set(12.0, this.y0 + 3.3, 0.0);
    this.group.add(this.wingLight);
    this.dynamicObjects.add(this.wingLight);

    this.roseAccentMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.35, metalness: 0.1 }),
    );
    this.warmGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        emissive: '#fde047',
        emissiveIntensity: 1.35,
        roughness: 0.15,
      }),
    );
    this.pinkGlowMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf2f8',
        emissive: '#f472b6',
        emissiveIntensity: 1.15,
        roughness: 0.2,
      }),
    );
    this.photoRugMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff5f7',
        roughness: 0.78,
        metalness: 0.06,
      }),
    );

    this.labelGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.52, 0.14));
    this.frameOuterGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 0.94, 0.04));
    this.frameInnerGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.64, 0.82));
    this.heartSphereGeo = tracker.trackGeo(new THREE.SphereGeometry(0.075, 8, 8));
    this.heartRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.13, 0.018, 6, 16));

    // 1. Build Architectural Layout (Walls, Floors, Ceilings, Arched Doorways)
    this.buildArchitecturalLayout();

    // 2. Build Hero Room Fixtures & Differentiated Micro-Prop Instantiations
    this.buildPhotographyStudio();
    this.buildMiniFashionBoutique();
    this.buildDollPlayroom();

    // 2B. Build Complete Jewellery Atelier & Tabletop Castle / Little Dream World Subsystems
    this.jewelleryAtelier = new CastleJewelleryAtelier(
      tracker,
      mats,
      originX,
      baseY,
      originZ,
      this.y0,
      this.colliders,
    );
    this.group.add(this.jewelleryAtelier.group);
    this.jewelleryAtelier.dynamicObjects.forEach((d) => this.dynamicObjects.add(d));

    this.tabletopWorld = new CastleTabletopWorld(
      tracker,
      mats,
      originX,
      baseY,
      originZ,
      this.y0,
      this.colliders,
    );
    this.group.add(this.tabletopWorld.group);
    this.tabletopWorld.dynamicObjects.forEach((d) => this.dynamicObjects.add(d));

    // 3. Compile all MicroPropLibrary placements across all 3 rooms into 3 static batched draw calls
    this.microPropLibrary.compileIntoGroup(this.group);

    // 4. Lock static hierarchy so non-animated meshes have zero per-frame matrix overhead
    lockStaticHierarchy(this.group, this.dynamicObjects);
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.avatarBridge = bridge;
    this.jewelleryAtelier.setAvatarBridge(bridge);
    this.tabletopWorld.setAvatarBridge(bridge);
  }

  public setKeepMemoryCallback(
    cb: (portraitDataUrl: string, portraitIndex: number) => void,
  ): void {
    this.keepMemoryCallback = cb;
  }

  public setOpenCustomBackdropPickerCallback(cb: () => void): void {
    this.openCustomBackdropPickerCallback = cb;
  }

  /**
   * Captures the player's current spatial pose before entering a portrait camera or taking a photo.
   * Only commits to `lastPhotoCaptureContext` when a photograph is actually taken (Section 13).
   */
  public capturePlayerPose(
    worldPos: THREE.Vector3,
    camPos: THREE.Vector3,
    camTarget: THREE.Vector3,
    playerYaw: number,
    playerPitch: number,
  ): void {
    // Only record live exploration pose when not already locked in a studio camera mode
    if (this.activeCameraMode === 'none') {
      this._livePoseWorldPos.copy(worldPos);
      this._livePoseCamPos.copy(camPos);
      this._livePoseCamTarget.copy(camTarget);
      this._livePoseYaw = playerYaw;
      this._livePosePitch = playerPitch;
      this._hasLivePose = true;
    }
  }

  public consumePendingPhotoReturn(): LastPhotoCaptureContext | null {
    if (!this.pendingPhotoReturn || !this.lastPhotoCaptureContext) return null;
    this.pendingPhotoReturn = false;
    return this.lastPhotoCaptureContext;
  }

  public getLastPhotoCaptureContext(): LastPhotoCaptureContext | null {
    return this.lastPhotoCaptureContext;
  }

  private addLocalCollider(lx: number, lz: number, radius: number): void {
    this.colliders.push({
      x: this.originX + lx,
      z: this.originZ + lz,
      radius,
      y: this.baseY + this.y0,
      height: 3.5,
    });
  }

  private addWallFrame(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rotY: number,
    tex: THREE.CanvasTexture,
  ): void {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.y = rotY;
    const frame = new THREE.Mesh(this.frameOuterGeo, this.mats.champagneGold);
    const art = new THREE.Mesh(
      this.frameInnerGeo,
      this.tracker.trackMat(new THREE.MeshBasicMaterial({ map: tex })),
    );
    art.position.z = 0.024;
    fg.add(frame, art);
    parent.add(fg);
  }

  private addHeartCrest(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rotY = 0,
  ): void {
    const hg = new THREE.Group();
    hg.position.set(x, y, z);
    hg.rotation.y = rotY;
    const hL = new THREE.Mesh(this.heartSphereGeo, this.roseAccentMat);
    hL.position.set(-0.045, 0.03, 0);
    const hR = new THREE.Mesh(this.heartSphereGeo, this.roseAccentMat);
    hR.position.set(0.045, 0.03, 0);
    const ring = new THREE.Mesh(this.heartRingGeo, this.mats.champagneGold);
    hg.add(hL, hR, ring);
    parent.add(hg);
  }

  /**
   * Builds the complete architectural shell for the Creative Wing:
   * - 4-Wall Enclosures, Gold Baseboards & Wainscoting Trim
   * - Distinct Room Floors (Pearl Studio Floor, Blush-White Marble Floor, Warm Pastel Wood Floor)
   * - Room Ceilings (Recessed Studio Lighting Grid, Crown Medallion & Chandelier, Cloud & Star Mobiles)
   * - 4 Physical Arched Doorways with Signboards & Heart Crests
   */
  private buildArchitecturalLayout(): void {
    const { tracker, mats, y0, yCeil, group, partitionMeshes } = this;
    const wallMat = mats.creamStone;
    const marbleTrimMat = mats.blushRoseMarble;
    const goldTrimMat = mats.champagneGold;
    const archTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(1.2, 0.06, 8, 24, Math.PI));

    // A. PHOTOGRAPHY STUDIO WEST WALL & ARCHED DOORWAY (lx = 8.8, lz in [-15.2, -6.2], doorway lz in [-11.8, -9.4])
    const photoWestSouthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 3.4));
    photoWestSouthGeo.translate(8.8, y0 + 2.2, -13.5);
    const photoWestSouth = new THREE.Mesh(photoWestSouthGeo, wallMat);

    const photoWestNorthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 3.2));
    photoWestNorthGeo.translate(8.8, y0 + 2.2, -7.8);
    const photoWestNorth = new THREE.Mesh(photoWestNorthGeo, wallMat);

    const photoWestHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 1.2, 2.4));
    photoWestHeaderGeo.translate(8.8, y0 + 3.8, -10.6);
    const photoWestHeader = new THREE.Mesh(photoWestHeaderGeo, marbleTrimMat);

    const photoWestArchTrim = new THREE.Mesh(archTorusGeo, goldTrimMat);
    photoWestArchTrim.rotation.y = Math.PI / 2;
    photoWestArchTrim.position.set(8.8, y0 + 2.8, -10.6);

    group.add(photoWestSouth, photoWestNorth, photoWestHeader, photoWestArchTrim);
    partitionMeshes.push(photoWestSouth, photoWestNorth, photoWestHeader);

    const photoSignTex = createSignboardTexture(
      tracker,
      '✦ THE PORTRAIT ATELIER ✦',
      'Haute Couture Photography & Fine Portraits',
      '#4c0519',
      '#fbbf24',
    );
    const photoSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: photoSignTex, side: THREE.FrontSide }),
    );
    const signGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.1, 0.52));
    // Exterior West face (x = 8.58): faces -X toward Atrium (rotation.y = -Math.PI / 2)
    const photoWestSignMesh = new THREE.Mesh(signGeo, photoSignMat);
    photoWestSignMesh.position.set(8.58, y0 + 3.82, -10.6);
    photoWestSignMesh.rotation.y = -Math.PI / 2;
    // Interior East face (x = 9.02): faces +X into Portrait Atelier (rotation.y = Math.PI / 2)
    const photoWestSignInner = new THREE.Mesh(signGeo, photoSignMat);
    photoWestSignInner.position.set(9.02, y0 + 3.82, -10.6);
    photoWestSignInner.rotation.y = Math.PI / 2;
    group.add(photoWestSignMesh, photoWestSignInner);
    this.addHeartCrest(group, 8.56, y0 + 4.22, -10.6, Math.PI / 2);

    // B. PARTITION WALL & ARCHED DOORWAY BETWEEN PHOTOGRAPHY STUDIO & BOUTIQUE (lz = -6.2, doorway lx in [10.8, 13.2])
    const partGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.2, 4.4, 0.38));
    partGeo1.translate(14.3, y0 + 2.2, -6.2);
    const partMesh1 = new THREE.Mesh(partGeo1, wallMat);

    const partGeo2 = tracker.trackGeo(new THREE.BoxGeometry(2.0, 4.4, 0.38));
    partGeo2.translate(9.8, y0 + 2.2, -6.2);
    const partMesh2 = new THREE.Mesh(partGeo2, wallMat);

    const archHeaderGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.2, 0.42));
    archHeaderGeo1.translate(12.0, y0 + 3.8, -6.2);
    const archHeaderMesh1 = new THREE.Mesh(archHeaderGeo1, marbleTrimMat);

    const archTrimMesh1 = new THREE.Mesh(archTorusGeo, goldTrimMat);
    archTrimMesh1.position.set(12.0, y0 + 2.8, -6.2);

    group.add(partMesh1, partMesh2, archHeaderMesh1, archTrimMesh1);
    partitionMeshes.push(partMesh1, partMesh2, archHeaderMesh1);

    // Boutique side of z = -6.2 wall (z = -5.98): faces +Z into Boutique (rotation.y = 0)
    const photoSignMesh = new THREE.Mesh(signGeo, photoSignMat);
    photoSignMesh.position.set(12.0, y0 + 3.82, -5.98);
    photoSignMesh.rotation.y = 0;
    // Studio side of z = -6.2 wall (z = -6.42): faces -Z into Portrait Atelier (rotation.y = Math.PI)
    const photoSignInner = new THREE.Mesh(signGeo, photoSignMat);
    photoSignInner.position.set(12.0, y0 + 3.82, -6.42);
    photoSignInner.rotation.y = Math.PI;
    group.add(photoSignMesh, photoSignInner);
    this.addHeartCrest(group, 12.0, y0 + 4.22, -5.96, 0);

    // C. BOUTIQUE WEST FACADE WALL & ARCHED ENTRANCE (lx = 8.8, lz in [-5.8, +5.8], doorway lz in [-1.2, +1.2])
    const boutiqueWallSouthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 4.6));
    boutiqueWallSouthGeo.translate(8.8, y0 + 2.2, -3.5);
    const boutiqueWallSouth = new THREE.Mesh(boutiqueWallSouthGeo, wallMat);

    const boutiqueWallNorthGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 4.6));
    boutiqueWallNorthGeo.translate(8.8, y0 + 2.2, 3.5);
    const boutiqueWallNorth = new THREE.Mesh(boutiqueWallNorthGeo, wallMat);

    const boutiqueDoorHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 1.2, 2.4));
    boutiqueDoorHeaderGeo.translate(8.8, y0 + 3.8, 0.0);
    const boutiqueDoorHeader = new THREE.Mesh(boutiqueDoorHeaderGeo, marbleTrimMat);

    const boutiqueArchTrim = new THREE.Mesh(archTorusGeo, goldTrimMat);
    boutiqueArchTrim.rotation.y = Math.PI / 2;
    boutiqueArchTrim.position.set(8.8, y0 + 2.8, 0.0);

    group.add(boutiqueWallSouth, boutiqueWallNorth, boutiqueDoorHeader, boutiqueArchTrim);
    partitionMeshes.push(boutiqueWallSouth, boutiqueWallNorth, boutiqueDoorHeader);

    const boutiqueSignTex = createSignboardTexture(
      tracker,
      "♕ HARSHA'S COUTURE CORNER ♕",
      'Bespoke Castle Fashion, Accessories & Tailoring',
      '#831843',
      '#fde047',
    );
    const boutiqueSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: boutiqueSignTex, side: THREE.FrontSide }),
    );
    const boutiqueSignGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.2, 0.52));
    // Exterior West face (x = 8.58): faces -X toward Atrium (rotation.y = -Math.PI / 2)
    const boutiqueSignMesh = new THREE.Mesh(boutiqueSignGeo, boutiqueSignMat);
    boutiqueSignMesh.position.set(8.58, y0 + 3.82, 0.0);
    boutiqueSignMesh.rotation.y = -Math.PI / 2;
    // Interior East face (x = 9.02): faces +X into Boutique (rotation.y = Math.PI / 2)
    const boutiqueSignInner = new THREE.Mesh(boutiqueSignGeo, boutiqueSignMat);
    boutiqueSignInner.position.set(9.02, y0 + 3.82, 0.0);
    boutiqueSignInner.rotation.y = Math.PI / 2;
    group.add(boutiqueSignMesh, boutiqueSignInner);

    // D. PARTITION WALL & PLAYFUL ARCHWAY BETWEEN BOUTIQUE & DOLL PLAYROOM (lz = +6.2, doorway lx in [10.8, 13.2])
    const dollWallGeo1 = tracker.trackGeo(new THREE.BoxGeometry(2.2, 4.4, 0.38));
    dollWallGeo1.translate(14.3, y0 + 2.2, 6.2);
    const dollWallMesh1 = new THREE.Mesh(dollWallGeo1, wallMat);

    const dollWallGeo2 = tracker.trackGeo(new THREE.BoxGeometry(1.6, 4.4, 0.38));
    dollWallGeo2.translate(10.0, y0 + 2.2, 6.2);
    const dollWallMesh2 = new THREE.Mesh(dollWallGeo2, wallMat);

    const dollArchHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 1.2, 0.42));
    dollArchHeaderGeo.translate(12.0, y0 + 3.8, 6.2);
    const dollArchHeaderMesh = new THREE.Mesh(dollArchHeaderGeo, marbleTrimMat);

    const dollArchTrimMesh = new THREE.Mesh(archTorusGeo, goldTrimMat);
    dollArchTrimMesh.position.set(12.0, y0 + 2.8, 6.2);

    const dollWestWallGeo = tracker.trackGeo(new THREE.BoxGeometry(0.38, 4.4, 8.6));
    dollWestWallGeo.translate(9.2, y0 + 2.2, 10.5);
    const dollWestWallMesh = new THREE.Mesh(dollWestWallGeo, wallMat);

    group.add(dollWallMesh1, dollWallMesh2, dollArchHeaderMesh, dollArchTrimMesh, dollWestWallMesh);
    partitionMeshes.push(dollWallMesh1, dollWallMesh2, dollArchHeaderMesh, dollWestWallMesh);

    const dollSignTex = createSignboardTexture(
      tracker,
      '♡ THE LITTLE DREAM WORLD ♡',
      'Handcrafted Miniatures, Doll Castle & Childhood Wonder',
      '#581c87',
      '#f472b6',
    );
    const dollSignMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: dollSignTex, side: THREE.FrontSide }),
    );
    // Boutique side of z = +6.2 wall (z = 5.98): faces -Z into Boutique (rotation.y = Math.PI)
    const dollSignMesh = new THREE.Mesh(signGeo, dollSignMat);
    dollSignMesh.position.set(12.0, y0 + 3.82, 5.98);
    dollSignMesh.rotation.y = Math.PI;
    // Doll Playroom side of z = +6.2 wall (z = 6.42): faces +Z into Doll Playroom (rotation.y = 0)
    const dollSignInner = new THREE.Mesh(signGeo, dollSignMat);
    dollSignInner.position.set(12.0, y0 + 3.82, 6.42);
    dollSignInner.rotation.y = 0;
    group.add(dollSignMesh, dollSignInner);
    this.addHeartCrest(group, 12.0, y0 + 4.22, 5.96, 0);

    // E. ARCHITECTURAL FLOORS & CEILINGS FOR ALL 3 ROOMS
    // Room 1 (Photography Studio): Recessed Studio Ceiling Grid + Circular Pearl Studio Rug
    const photoCeilingPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(5.6, 0.08, 7.6));
    photoCeilingPanelGeo.translate(12.05, yCeil, -10.6);
    group.add(new THREE.Mesh(photoCeilingPanelGeo, mats.pearlWhite));

    const ceilingStripGeo = tracker.trackGeo(new THREE.BoxGeometry(4.4, 0.04, 0.14));
    [-12.6, -10.6, -8.6].forEach((cz) => {
      const strip = new THREE.Mesh(ceilingStripGeo, this.warmGlowMat);
      strip.position.set(12.05, yCeil - 0.05, cz);
      group.add(strip);
    });

    const photoRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.8, 2.8, 0.024, 32));
    photoRugGeo.translate(12.05, y0 + 0.012, -10.6);
    const photoRug = new THREE.Mesh(photoRugGeo, this.photoRugMat);
    photoRug.receiveShadow = true;
    const photoRugGoldRingGeo = tracker.trackGeo(new THREE.RingGeometry(2.55, 2.72, 32));
    photoRugGoldRingGeo.rotateX(-Math.PI / 2);
    photoRugGoldRingGeo.translate(12.05, y0 + 0.026, -10.6);
    const photoRugInnerRoseGeo = tracker.trackGeo(new THREE.RingGeometry(1.35, 1.42, 24));
    photoRugInnerRoseGeo.rotateX(-Math.PI / 2);
    photoRugInnerRoseGeo.translate(12.05, y0 + 0.026, -10.6);
    const centerHeartDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.18, 16));
    centerHeartDiscGeo.rotateX(-Math.PI / 2);
    centerHeartDiscGeo.translate(12.05, y0 + 0.027, -10.6);
    group.add(
      photoRug,
      new THREE.Mesh(photoRugGoldRingGeo, goldTrimMat),
      new THREE.Mesh(photoRugInnerRoseGeo, marbleTrimMat),
      new THREE.Mesh(centerHeartDiscGeo, this.roseAccentMat),
    );

    // Room 2 (Mini Fashion Boutique): Soft Marble Floor + Plush Display Rug + Crown Ceiling Medallion & Chandelier
    const bFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(6.3, 0.02, 11.4));
    bFloorGeo.translate(12.05, y0 + 0.01, 0);
    const bFloor = new THREE.Mesh(bFloorGeo, marbleTrimMat);
    bFloor.receiveShadow = true;
    const bCenterRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.85, 1.85, 0.026, 28));
    bCenterRugGeo.translate(12.05, y0 + 0.014, 0);
    const bMedallionGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.15, 1.25, 0.08, 24));
    bMedallionGeo.translate(12.05, yCeil, 0);
    group.add(
      bFloor,
      new THREE.Mesh(bCenterRugGeo, this.photoRugMat),
      new THREE.Mesh(bMedallionGeo, goldTrimMat),
    );

    const bChandelier = new THREE.Group();
    bChandelier.position.set(12.05, y0 + 3.65, 0);
    const bChRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.65, 0.04, 8, 20));
    bChRingGeo.rotateX(Math.PI / 2);
    bChandelier.add(new THREE.Mesh(bChRingGeo, goldTrimMat));
    const dropGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.08, 0));
    for (let d = 0; d < 6; d++) {
      const ang = (d * Math.PI * 2) / 6;
      const drop = new THREE.Mesh(dropGeo, mats.crystalGlass);
      drop.position.set(Math.cos(ang) * 0.65, -0.22, Math.sin(ang) * 0.65);
      drop.scale.set(1, 1.8, 1);
      bChandelier.add(drop);
    }
    const centerHeartCrystal = new THREE.Mesh(dropGeo, this.pinkGlowMat);
    centerHeartCrystal.scale.set(1.6, 2.2, 1.6);
    centerHeartCrystal.position.set(0, -0.32, 0);
    bChandelier.add(centerHeartCrystal);
    group.add(bChandelier);

    // Room 3 (Doll Playroom): Warm Pastel Wood-Plank Floor + Giant Soft Play Rug + Ceiling Clouds
    const dollWoodFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(5.9, 0.018, 8.4));
    dollWoodFloorGeo.translate(12.3, y0 + 0.009, 10.6);
    const dollWoodFloorMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({ color: '#fde8e8', roughness: 0.72, metalness: 0.04 }),
    );
    const dRugGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.35, 2.35, 0.026, 32));
    dRugGeo.translate(12.85, y0 + 0.013, 11.85);
    const dRugMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fdf4ff',
        roughness: 0.9,
        metalness: 0.02,
      }),
    );
    group.add(
      new THREE.Mesh(dollWoodFloorGeo, dollWoodFloorMat),
      new THREE.Mesh(dRugGeo, dRugMat),
    );

    const cloudPuffGeo = tracker.trackGeo(new THREE.SphereGeometry(0.32, 10, 10));
    [
      [11.2, 9.2],
      [13.3, 10.4],
      [11.8, 12.2],
    ].forEach(([cx, cz]) => {
      const cg = new THREE.Group();
      cg.position.set(cx, yCeil - 0.35, cz);
      const p1 = new THREE.Mesh(cloudPuffGeo, mats.pearlWhite);
      const p2 = new THREE.Mesh(cloudPuffGeo, mats.pearlWhite);
      p2.position.set(0.24, -0.05, 0);
      p2.scale.set(0.8, 0.8, 0.8);
      cg.add(p1, p2);
      group.add(cg);
    });
  }

  /**
   * Builds Room 1: The Portrait Atelier (Photography Studio) hero fixtures and
   * delegates micro-prop instantiation to `MicroPropLibrary.instantiatePhotographyStudioProps`.
   */
  private buildPhotographyStudio(): void {
    const { tracker, mats, y0, group } = this;
    const wallMat = mats.creamStone;
    const goldTrimMat = mats.champagneGold;

    const photoGroup = new THREE.Group();
    photoGroup.name = 'PhotographyStudio';
    group.add(photoGroup);

    // Hero Photography Set on East Wall (lx = 15.15, lz = -10.6)
    const backdropFrameGroup = new THREE.Group();
    backdropFrameGroup.position.set(15.15, y0, -10.6);

    const bdPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 3.8, 10));
    bdPillarGeo.translate(0, 1.9, 0);
    const bdPillarL = new THREE.Mesh(bdPillarGeo, goldTrimMat);
    bdPillarL.position.set(0, 0, -2.2);
    const bdPillarR = new THREE.Mesh(bdPillarGeo, goldTrimMat);
    bdPillarR.position.set(0, 0, 2.2);

    // Top support crossbar + arch + side velvet curtains + floor sweep connection (Section 6)
    const topCrossbarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 4.5, 10));
    topCrossbarGeo.rotateX(Math.PI / 2);
    topCrossbarGeo.translate(0, 3.74, 0);

    const curtainDrapeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.24, 3.7, 12));
    curtainDrapeGeo.translate(0, 1.85, 0);
    const curtainL = new THREE.Mesh(curtainDrapeGeo, mats.velvetPlum);
    curtainL.position.set(-0.08, 0, -2.05);
    const curtainR = new THREE.Mesh(curtainDrapeGeo, mats.velvetPlum);
    curtainR.position.set(-0.08, 0, 2.05);

    const floorSweepGeo = tracker.trackGeo(new THREE.BoxGeometry(0.65, 0.04, 4.4));
    floorSweepGeo.translate(-0.3, 0.02, 0);

    const bdArchGeo = tracker.trackGeo(new THREE.TorusGeometry(2.2, 0.08, 8, 28, Math.PI));
    bdArchGeo.rotateY(Math.PI / 2);
    const bdArch = new THREE.Mesh(bdArchGeo, goldTrimMat);
    bdArch.position.set(0, 3.8, 0);
    backdropFrameGroup.add(
      bdPillarL,
      bdPillarR,
      new THREE.Mesh(topCrossbarGeo, goldTrimMat),
      curtainL,
      curtainR,
      new THREE.Mesh(floorSweepGeo, mats.blushRoseMarble),
      bdArch,
    );

    // Portrait Position Floor Marker at (13.55, y0 + 0.028, -10.6) (Sections 5 & 9)
    const posMarkerOuterGeo = tracker.trackGeo(new THREE.RingGeometry(0.42, 0.52, 28));
    posMarkerOuterGeo.rotateX(-Math.PI / 2);
    posMarkerOuterGeo.translate(13.55, y0 + 0.028, -10.6);
    const posMarkerInnerGeo = tracker.trackGeo(new THREE.CircleGeometry(0.38, 24));
    posMarkerInnerGeo.rotateX(-Math.PI / 2);
    posMarkerInnerGeo.translate(13.55, y0 + 0.027, -10.6);
    photoGroup.add(
      new THREE.Mesh(posMarkerOuterGeo, goldTrimMat),
      new THREE.Mesh(posMarkerInnerGeo, this.pinkGlowMat),
    );

    // Sections 7, 13 & 33: Physical Portrait Memory Marker (`lastPhotoMemoryMarkerGroup`)
    // Subtle champagne-gold floor medallion + warm heart-shaped studio floor light + engraved frame icon
    this.lastPhotoMemoryMarkerGroup = new THREE.Group();
    this.lastPhotoMemoryMarkerGroup.name = 'LastPhotoMemoryMarker';
    this.lastPhotoMemoryMarkerGroup.position.set(13.55, y0 + 0.029, -10.6);
    this.lastPhotoMemoryMarkerGroup.visible = false;
    const memMedallionOuterGeo = tracker.trackGeo(new THREE.RingGeometry(0.28, 0.34, 24));
    memMedallionOuterGeo.rotateX(-Math.PI / 2);
    const memMedallionDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.27, 24));
    memMedallionDiscGeo.rotateX(-Math.PI / 2);
    const memFrameIconGeo = tracker.trackGeo(new THREE.RingGeometry(0.11, 0.145, 4));
    memFrameIconGeo.rotateX(-Math.PI / 2);
    memFrameIconGeo.rotateY(Math.PI / 4);
    memFrameIconGeo.translate(0, 0.002, 0);
    const memHeartL = new THREE.Mesh(this.heartSphereGeo, this.warmGlowMat);
    memHeartL.scale.set(0.55, 0.18, 0.55);
    memHeartL.position.set(-0.028, 0.004, -0.01);
    const memHeartR = new THREE.Mesh(this.heartSphereGeo, this.warmGlowMat);
    memHeartR.scale.set(0.55, 0.18, 0.55);
    memHeartR.position.set(0.028, 0.004, -0.01);
    this.lastPhotoMemoryMarkerGroup.add(
      new THREE.Mesh(memMedallionOuterGeo, goldTrimMat),
      new THREE.Mesh(memMedallionDiscGeo, this.pinkGlowMat),
      new THREE.Mesh(memFrameIconGeo, goldTrimMat),
      memHeartL,
      memHeartR,
    );
    photoGroup.add(this.lastPhotoMemoryMarkerGroup);
    this.dynamicObjects.add(this.lastPhotoMemoryMarkerGroup);

    // Entrance Crystal Sconces & Shared-Planter Two Flowers (Sections 4 & 37)
    const sconceOrbGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.11, 0));
    [-12.1, -9.1].forEach((sz) => {
      const sc = new THREE.Mesh(sconceOrbGeo, this.warmGlowMat);
      sc.position.set(8.56, y0 + 2.35, sz);
      photoGroup.add(sc);
    });
    const sharedPlanterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.18, 0.28, 12));
    sharedPlanterGeo.translate(8.42, y0 + 0.14, -9.05);
    const sharedFlower1 = new THREE.Mesh(this.heartSphereGeo, this.roseAccentMat);
    sharedFlower1.position.set(8.42, y0 + 0.36, -9.12);
    const sharedFlower2 = new THREE.Mesh(this.heartSphereGeo, this.pinkGlowMat);
    sharedFlower2.position.set(8.42, y0 + 0.36, -8.98);
    photoGroup.add(new THREE.Mesh(sharedPlanterGeo, goldTrimMat), sharedFlower1, sharedFlower2);

    // Paired Velvet Studio Chairs side-by-side tucked along South Lounge (Section 37: Two chairs together)
    const chairSeatGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.24, 0.22, 0.42, 14));
    chairSeatGeo.translate(0, 0.21, 0);
    [-14.25, -13.65].forEach((cz, idx) => {
      const ch = new THREE.Mesh(
        chairSeatGeo,
        idx === 0 ? mats.blushRoseMarble : goldTrimMat,
      );
      ch.position.set(12.25, y0, cz);
      photoGroup.add(ch);
    });

    const createPresetCanvas = (presetIdx: number): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 384;
      const cx = c.getContext('2d');
      if (cx) {
        if (presetIdx === 0) {
          const grad = cx.createLinearGradient(0, 0, 0, 384);
          grad.addColorStop(0, '#fce7f3');
          grad.addColorStop(0.5, '#fbcfe8');
          grad.addColorStop(1, '#a7f3d0');
          cx.fillStyle = grad;
          cx.fillRect(0, 0, 512, 384);
          cx.fillStyle = 'rgba(219, 39, 119, 0.25)';
          cx.fillRect(200, 180, 112, 120);
          cx.beginPath();
          cx.moveTo(256, 110);
          cx.lineTo(200, 180);
          cx.lineTo(312, 180);
          cx.closePath();
          cx.fill();
        } else if (presetIdx === 1) {
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
      this.backdropTextures.push(createPresetCanvas(i));
    }

    // Initialize 7th slot for Custom Photo Backdrop
    this.customBackdropCanvas = document.createElement('canvas');
    this.customBackdropCanvas.width = 512;
    this.customBackdropCanvas.height = 384;
    const cCtx = this.customBackdropCanvas.getContext('2d');
    if (cCtx) {
      cCtx.fillStyle = '#4c0519';
      cCtx.fillRect(0, 0, 512, 384);
      cCtx.strokeStyle = '#fde047';
      cCtx.lineWidth = 6;
      cCtx.strokeRect(12, 12, 488, 360);
      cCtx.fillStyle = '#fde047';
      cCtx.font = 'bold 26px Georgia, serif';
      cCtx.textAlign = 'center';
      cCtx.fillText('✦ CUSTOM PHOTO BACKDROP ✦', 256, 175);
      cCtx.fillStyle = '#ffe4e6';
      cCtx.font = 'italic 18px Georgia, serif';
      cCtx.fillText('Use the Personal Backdrop Case to project here', 256, 215);
    }
    this.customBackdropTex = tracker.trackTex(new THREE.CanvasTexture(this.customBackdropCanvas));
    this.customBackdropTex.colorSpace = THREE.SRGBColorSpace;
    this.customBackdropTex.needsUpdate = true;
    this.backdropTextures.push(this.customBackdropTex);

    const backdropScreenGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.3, 3.6));
    backdropScreenGeo.rotateY(-Math.PI / 2);
    this.backdropScreenMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.backdropTextures[0],
        side: THREE.FrontSide,
      }),
    );
    const backdropScreenMesh = new THREE.Mesh(backdropScreenGeo, this.backdropScreenMat);
    backdropScreenMesh.position.set(-0.02, 1.9, 0);
    backdropFrameGroup.add(backdropScreenMesh);

    // Studio Flash Overlay Plane right in front of camera lens for shutter burst
    const flashGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.35, 3.65));
    flashGeo.rotateY(-Math.PI / 2);
    this.shutterFlashMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      }),
    );
    this.shutterFlashMesh = new THREE.Mesh(flashGeo, this.shutterFlashMat);
    this.shutterFlashMesh.position.set(-0.05, 1.9, 0);
    this.shutterFlashMesh.visible = false;
    backdropFrameGroup.add(this.shutterFlashMesh);
    this.dynamicObjects.add(this.shutterFlashMesh);

    photoGroup.add(backdropFrameGroup);

    // Believable Studio Camera on Tripod at (lx = 10.85, lz = -10.6) with >1.5m circulation clearance
    const cameraRig = new THREE.Group();
    cameraRig.position.set(10.85, y0, -10.6);
    cameraRig.rotation.y = Math.PI / 2;

    const legGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 1.35, 8));
    legGeo.translate(0, 0.67, 0);
    [-0.32, 0, 0.32].forEach((xOff, idx) => {
      const leg = new THREE.Mesh(legGeo, goldTrimMat);
      leg.position.set(xOff, 0, idx === 1 ? -0.28 : 0.18);
      leg.rotation.z = xOff * -0.3;
      cameraRig.add(leg);
    });

    const camBodyGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.18));
    camBodyGeo.translate(0, 1.4, 0);
    const camLensGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.28, 16));
    camLensGeo.rotateX(Math.PI / 2);
    camLensGeo.translate(0, 1.4, 0.18);
    const focusRingGeo = tracker.trackGeo(new THREE.TorusGeometry(0.082, 0.012, 8, 16));
    this.cameraFocusRingMesh = new THREE.Mesh(focusRingGeo, mats.velvetPlum);
    this.cameraFocusRingMesh.position.set(0, 1.4, 0.22);
    this.dynamicObjects.add(this.cameraFocusRingMesh);

    const camViewfinderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.08, 0.06));
    camViewfinderGeo.translate(0, 1.54, -0.04);
    const cableCoilGeo = tracker.trackGeo(new THREE.TorusGeometry(0.22, 0.015, 6, 16));
    cableCoilGeo.rotateX(Math.PI / 2);
    cableCoilGeo.translate(0.18, 0.02, -0.15);
    const camLedGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 8));
    camLedGeo.translate(0.12, 1.46, 0.09);
    this.cameraLedMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#ef4444',
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
    );
    const camLedMesh = new THREE.Mesh(camLedGeo, this.cameraLedMat);
    this.dynamicObjects.add(camLedMesh);

    cameraRig.add(
      new THREE.Mesh(camBodyGeo, mats.velvetPlum),
      new THREE.Mesh(camLensGeo, goldTrimMat),
      this.cameraFocusRingMesh,
      new THREE.Mesh(camViewfinderGeo, mats.champagneGold),
      new THREE.Mesh(cableCoilGeo, mats.velvetPlum),
      camLedMesh,
    );
    photoGroup.add(cameraRig);
    this.addLocalCollider(10.85, -10.6, 0.38);

    // ========================================================================
    // WALL-MOUNTED MEMORY FILM DISPLAY (Flush against North Studio Wall at lx = 9.75, lz = -6.62)
    // Out of all doorways and walking lanes (Sections 9 & 10)
    // ========================================================================
    const memoryRackGroup = new THREE.Group();
    memoryRackGroup.name = 'MemoryFilmDisplayRack';
    memoryRackGroup.position.set(9.75, y0, -6.62);
    // Rotation.y = Math.PI so local +Z faces South (-Z) directly into the Portrait Atelier!
    memoryRackGroup.rotation.y = Math.PI;

    const woodFrameMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#5c2c35',
        roughness: 0.42,
        metalness: 0.14,
      }),
    );
    const rackBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.96, 0.12, 0.38));
    rackBaseGeo.translate(0, 0.06, 0);
    const rackBaseTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.0, 0.04, 0.42));
    rackBaseTrimGeo.translate(0, 0.02, 0);
    memoryRackGroup.add(
      new THREE.Mesh(rackBaseGeo, woodFrameMat),
      new THREE.Mesh(rackBaseTrimGeo, goldTrimMat),
    );

    // Twin Vertical Wooden/Champagne-Gold Uprights & Arched Header
    const filmRackPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 1.72, 10));
    filmRackPostGeo.translate(0, 0.86, 0);
    [-0.44, 0.44].forEach((px) => {
      const post = new THREE.Mesh(filmRackPostGeo, goldTrimMat);
      post.position.x = px;
      memoryRackGroup.add(post);
    });

    const rackHeaderWoodGeo = tracker.trackGeo(new THREE.BoxGeometry(0.96, 0.12, 0.08));
    rackHeaderWoodGeo.translate(0, 1.74, 0);
    const rackHeaderArchGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.44, 0.022, 8, 20, Math.PI),
    );
    rackHeaderArchGeo.translate(0, 1.78, 0);
    memoryRackGroup.add(
      new THREE.Mesh(rackHeaderWoodGeo, woodFrameMat),
      new THREE.Mesh(rackHeaderArchGeo, goldTrimMat),
    );

    const rackPlaqueTex = createPlaqueTexture(
      tracker,
      '✦ MEMORY FILM DISPLAY ✦',
      '#4a1525',
      '#fde047',
    );
    const rackPlaqueGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.58, 0.11));
    const rackPlaqueMesh = new THREE.Mesh(
      rackPlaqueGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: rackPlaqueTex, side: THREE.FrontSide })),
    );
    rackPlaqueMesh.position.set(0, 1.74, 0.045);
    memoryRackGroup.add(rackPlaqueMesh);

    // Two Horizontal Film Hanging Bars & 8 Metallic Clips
    const hangingBarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.88, 8));
    hangingBarGeo.rotateZ(Math.PI / 2);
    [1.62, 1.12].forEach((barY) => {
      const bar = new THREE.Mesh(hangingBarGeo, goldTrimMat);
      bar.position.set(0, barY, 0.02);
      memoryRackGroup.add(bar);
    });

    const clipGeo = tracker.trackGeo(new THREE.BoxGeometry(0.028, 0.055, 0.028));
    [-0.34, -0.14, 0.14, 0.34].forEach((cx) => {
      const clipTop = new THREE.Mesh(clipGeo, goldTrimMat);
      clipTop.position.set(cx, 1.6, 0.025);
      const clipMid = new THREE.Mesh(clipGeo, goldTrimMat);
      clipMid.position.set(cx, 1.1, 0.025);
      memoryRackGroup.add(clipTop, clipMid);
    });

    // Tiny Warm Studio Light Bar & Translucent Lightbox Diffuser Behind Film
    this.filmRackLightMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        emissive: '#fbbf24',
        emissiveIntensity: 1.45,
        roughness: 0.15,
      }),
    );
    const tinyLightBarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 10));
    tinyLightBarGeo.rotateZ(Math.PI / 2);
    const tinyLightBarMesh = new THREE.Mesh(tinyLightBarGeo, this.filmRackLightMat);
    tinyLightBarMesh.position.set(0, 1.66, 0.06);
    this.dynamicObjects.add(tinyLightBarMesh);
    memoryRackGroup.add(tinyLightBarMesh);

    const diffuserBackGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.84, 0.42));
    const diffuserBackMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fff7ed',
        emissive: '#fde68a',
        emissiveIntensity: 0.45,
        roughness: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    const diffuserBack = new THREE.Mesh(diffuserBackGeo, diffuserBackMat);
    diffuserBack.position.set(0, 1.38, -0.015);
    memoryRackGroup.add(diffuserBack);

    // Subtle Decorative Flowers at Base of Memory Film Display Rack
    const flowerPotGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 10));
    flowerPotGeo.translate(0, 0.18, 0.12);
    memoryRackGroup.add(new THREE.Mesh(flowerPotGeo, goldTrimMat));
    [-0.06, 0, 0.06].forEach((fx, fIdx) => {
      const blossom = new THREE.Mesh(
        this.heartSphereGeo,
        fIdx === 1 ? this.roseAccentMat : this.pinkGlowMat,
      );
      blossom.scale.setScalar(0.62);
      blossom.position.set(fx, 0.27 + (fIdx === 1 ? 0.02 : 0), 0.12);
      memoryRackGroup.add(blossom);
    });

    // Two Lower Archival Hanging Film Strips (Studio Memory Collection — FrontSide on both faces so never mirrored)
    const archStripGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.18, 0.48));
    const archStripBackGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.18, 0.48));
    archStripBackGeo.rotateY(Math.PI);
    archStripBackGeo.translate(0, 0, -0.002);
    const archStripMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: createSampleArtworkTexture(tracker, 'contact_sheet'),
        roughness: 0.25,
        metalness: 0.08,
        transparent: true,
        opacity: 0.92,
        side: THREE.FrontSide,
      }),
    );
    this.archivalStrip1Group = new THREE.Group();
    this.archivalStrip1Group.position.set(-0.28, 0.84, 0.025);
    this.archivalStrip1Group.rotation.z = -0.03;
    this.archivalStrip1Group.add(
      new THREE.Mesh(archStripGeo, archStripMat),
      new THREE.Mesh(archStripBackGeo, archStripMat),
    );
    this.dynamicObjects.add(this.archivalStrip1Group);

    this.archivalStrip2Group = new THREE.Group();
    this.archivalStrip2Group.position.set(0.28, 0.84, 0.025);
    this.archivalStrip2Group.rotation.z = 0.035;
    this.archivalStrip2Group.add(
      new THREE.Mesh(archStripGeo, archStripMat),
      new THREE.Mesh(archStripBackGeo, archStripMat),
    );
    this.dynamicObjects.add(this.archivalStrip2Group);
    memoryRackGroup.add(this.archivalStrip1Group, this.archivalStrip2Group);

    // HERO 4-FRAME DEVELOPED FILM STRIP ON RACK (1024x320 Procedural CanvasTexture)
    // Strictly uses THREE.FrontSide with separate Front (+Z) and Back (-Z, rotation.y = Math.PI) faces so film text is NEVER mirrored!
    this.filmStripCanvas = document.createElement('canvas');
    this.filmStripCanvas.width = 1024;
    this.filmStripCanvas.height = 320;
    this.filmStripTex = tracker.trackTex(new THREE.CanvasTexture(this.filmStripCanvas));
    this.filmStripTex.flipY = true;
    this.filmStripTex.colorSpace = THREE.SRGBColorSpace;
    this.filmStripMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: this.filmStripTex,
        roughness: 0.22,
        metalness: 0.08,
        transparent: true,
        opacity: 0.96,
        side: THREE.FrontSide,
      }),
    );
    this.drawFilmStripCanvas(1.0);

    this.heroFilmStripGroup = new THREE.Group();
    this.heroFilmStripGroup.position.set(0, 1.38, 0.03);
    const heroStripPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.86, 0.27));
    const heroStripBackingGeo = tracker.trackGeo(new THREE.BoxGeometry(0.88, 0.285, 0.006));
    const darkCelluloidMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#181016',
        roughness: 0.28,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
      }),
    );
    const heroStripFront = new THREE.Mesh(heroStripPlaneGeo, this.filmStripMat);
    heroStripFront.position.z = 0.004;
    const heroStripRearFace = new THREE.Mesh(heroStripPlaneGeo, this.filmStripMat);
    heroStripRearFace.position.z = -0.004;
    heroStripRearFace.rotation.y = Math.PI;
    const heroStripBack = new THREE.Mesh(heroStripBackingGeo, darkCelluloidMat);
    this.heroFilmStripGroup.add(heroStripBack, heroStripFront, heroStripRearFace);
    this.dynamicObjects.add(this.heroFilmStripGroup);
    memoryRackGroup.add(this.heroFilmStripGroup);

    photoGroup.add(memoryRackGroup);
    this.addLocalCollider(9.75, -6.62, 0.36);

    // Studio Lighting Equipment tucked out of the central walking lane (Key Light, Fill Light, Rim Light Strip, Reflector)
    const softboxGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.95, 0.18));
    softboxGeo.translate(0, 2.2, 0);
    const softboxFaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.64, 0.9));
    softboxFaceGeo.translate(0, 2.2, 0.1);
    const softboxStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 8));
    softboxStandGeo.translate(0, 1.1, 0);

    const keyLight = new THREE.Group();
    keyLight.position.set(12.6, y0, -13.35);
    keyLight.rotation.y = Math.PI * 0.22;
    keyLight.add(
      new THREE.Mesh(softboxStandGeo, goldTrimMat),
      new THREE.Mesh(softboxGeo, mats.velvetPlum),
      new THREE.Mesh(softboxFaceGeo, this.warmGlowMat),
    );
    photoGroup.add(keyLight);
    this.addLocalCollider(12.6, -13.35, 0.32);

    const fillLight = new THREE.Group();
    fillLight.position.set(12.6, y0, -7.85);
    fillLight.rotation.y = Math.PI * 0.78;
    fillLight.scale.set(0.85, 0.9, 0.85);
    fillLight.add(
      new THREE.Mesh(softboxStandGeo, goldTrimMat),
      new THREE.Mesh(softboxGeo, mats.velvetPlum),
      new THREE.Mesh(softboxFaceGeo, this.warmGlowMat),
    );
    photoGroup.add(fillLight);
    this.addLocalCollider(12.6, -7.85, 0.32);

    const rimLightGroup = new THREE.Group();
    rimLightGroup.position.set(14.5, y0, -13.2);
    const rimStripGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 10));
    rimStripGeo.translate(0, 1.4, 0);
    const rimBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.22, 0.25, 0.06, 12));
    rimBaseGeo.translate(0, 0.03, 0);
    rimLightGroup.add(
      new THREE.Mesh(rimBaseGeo, goldTrimMat),
      new THREE.Mesh(rimStripGeo, this.pinkGlowMat),
    );
    photoGroup.add(rimLightGroup);
    this.addLocalCollider(14.5, -13.2, 0.3);

    const reflectorGroup = new THREE.Group();
    reflectorGroup.position.set(14.5, y0, -8.2);
    reflectorGroup.rotation.y = -Math.PI * 0.25;
    const reflDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.48, 24));
    reflDiscGeo.translate(0, 1.45, 0);
    const reflMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.18,
        metalness: 0.88,
        side: THREE.DoubleSide,
      }),
    );
    reflectorGroup.add(
      new THREE.Mesh(softboxStandGeo, goldTrimMat),
      new THREE.Mesh(reflDiscGeo, reflMat),
    );
    photoGroup.add(reflectorGroup);
    this.addLocalCollider(14.5, -8.2, 0.32);

    // Makeup / Preparation Vanity along South Wall (lx = 13.6, lz = -14.6)
    const vanityGroup = new THREE.Group();
    vanityGroup.position.set(13.6, y0, -14.6);
    const vTableGeo = tracker.trackGeo(new THREE.BoxGeometry(1.75, 0.76, 0.65));
    vTableGeo.translate(0, 0.38, 0);
    const vMirrorGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.15, 1.22));
    vMirrorGeo.translate(0, 1.45, 0.32);
    const vMirrorFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(1.26, 1.34, 0.06));
    vMirrorFrameGeo.translate(0, 1.45, 0.3);
    vanityGroup.add(
      new THREE.Mesh(vTableGeo, wallMat),
      new THREE.Mesh(vMirrorFrameGeo, goldTrimMat),
      new THREE.Mesh(vMirrorGeo, mats.crystalGlass),
    );

    const vBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.028, 8, 8));
    [
      [-0.58, 1.95],
      [-0.58, 1.45],
      [-0.58, 0.95],
      [0.58, 1.95],
      [0.58, 1.45],
      [0.58, 0.95],
      [-0.22, 2.06],
      [0.22, 2.06],
    ].forEach(([bx, by]) => {
      const bulb = new THREE.Mesh(vBulbGeo, this.warmGlowMat);
      bulb.position.set(bx, by, 0.34);
      vanityGroup.add(bulb);
    });
    // Subtle corner inscription on Portrait Vanity Mirror ("I LOVE YOU ♡", FrontSide facing +Z)
    const vanityLoveTex = createPlaqueTexture(
      tracker,
      'I LOVE YOU ♡',
      '#4a1525',
      '#fde047',
    );
    const vanityLoveGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.36, 0.095));
    const vanityLoveMesh = new THREE.Mesh(
      vanityLoveGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: vanityLoveTex, side: THREE.FrontSide })),
    );
    vanityLoveMesh.position.set(0.34, 1.92, 0.335);
    vanityGroup.add(vanityLoveMesh);
    photoGroup.add(vanityGroup);
    this.addLocalCollider(13.6, -14.6, 0.55);

    // Wardrobe Corner Clothing Rack along North-East Wall (lx = 14.2, lz = -6.72)
    const rackGroup = new THREE.Group();
    rackGroup.position.set(14.2, y0, -6.72);
    const rackRailGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.55, 8));
    rackRailGeo.rotateZ(Math.PI / 2);
    rackRailGeo.translate(0, 1.48, 0);
    const rackPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.52, 8));
    rackPostGeo.translate(0, 0.76, 0);
    const rackPostL = new THREE.Mesh(rackPostGeo, goldTrimMat);
    rackPostL.position.x = -0.74;
    const rackPostR = new THREE.Mesh(rackPostGeo, goldTrimMat);
    rackPostR.position.x = 0.74;
    rackGroup.add(new THREE.Mesh(rackRailGeo, goldTrimMat), rackPostL, rackPostR);

    const dressGeo = tracker.trackGeo(new THREE.ConeGeometry(0.2, 0.75, 12));
    dressGeo.translate(0, 0.95, 0);
    const dressColors = ['#f472b6', '#c084fc', '#38bdf8', '#fbcfe8', '#fef08a', '#be185d'];
    for (let d = 0; d < 6; d++) {
      const dMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: dressColors[d],
          roughness: 0.35,
          metalness: 0.1,
        }),
      );
      const dressMesh = new THREE.Mesh(dressGeo, dMat);
      dressMesh.position.set(-0.6 + d * 0.24, 0, 0);
      rackGroup.add(dressMesh);
    }
    photoGroup.add(rackGroup);
    this.addLocalCollider(14.2, -6.72, 0.42);

    // Equipment Storage Cabinet & Physical CUSTOM BACKDROP CASE along South-West Wall (lx = 10.2, lz = -14.6)
    // Section 23: Physical `[E] Place Personal Backdrop` object replaces any floating web upload button
    const storageGroup = new THREE.Group();
    storageGroup.position.set(10.2, y0, -14.6);
    const stCabGeo = tracker.trackGeo(new THREE.BoxGeometry(1.9, 1.85, 0.58));
    stCabGeo.translate(0, 0.925, 0);
    storageGroup.add(new THREE.Mesh(stCabGeo, wallMat));

    ['PORTRAIT', 'LIGHTING', 'BACKDROPS'].forEach((lbl, idx) => {
      const lTex = createPlaqueTexture(tracker, lbl);
      const lMesh = new THREE.Mesh(
        this.labelGeo,
        tracker.trackMat(new THREE.MeshBasicMaterial({ map: lTex, side: THREE.FrontSide })),
      );
      lMesh.position.set(-0.6 + idx * 0.6, 1.65, 0.3);
      storageGroup.add(lMesh);
    });

    const caseStandGeo = tracker.trackGeo(new THREE.BoxGeometry(0.62, 0.74, 0.44));
    caseStandGeo.translate(0, 0.37, 0.52);
    const caseVelvetGeo = tracker.trackGeo(new THREE.BoxGeometry(0.54, 0.1, 0.36));
    caseVelvetGeo.translate(0, 0.78, 0.52);
    const caseLidGeo = tracker.trackGeo(new THREE.BoxGeometry(0.54, 0.34, 0.04));
    caseLidGeo.translate(0, 0.96, 0.34);
    const casePlaqueTex = createPlaqueTexture(
      tracker,
      '✦ PERSONAL BACKDROP ✦',
      '#4a1525',
      '#fde047',
    );
    const casePlaqueMesh = new THREE.Mesh(
      this.labelGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: casePlaqueTex, side: THREE.FrontSide })),
    );
    casePlaqueMesh.position.set(0, 0.96, 0.37);
    storageGroup.add(
      new THREE.Mesh(caseStandGeo, goldTrimMat),
      new THREE.Mesh(caseVelvetGeo, mats.velvetPlum),
      new THREE.Mesh(caseLidGeo, goldTrimMat),
      casePlaqueMesh,
    );
    photoGroup.add(storageGroup);
    this.addLocalCollider(10.2, -14.4, 0.52);

    // Framed Sample Portraits (Frame 1 is live-updated when a portrait is captured!), Lighting Diagram, Camera Art & Contact Sheet
    const capturedFrameGroup = new THREE.Group();
    capturedFrameGroup.position.set(9.02, y0 + 2.1, -13.5);
    capturedFrameGroup.rotation.y = Math.PI / 2;
    const capOuter = new THREE.Mesh(this.frameOuterGeo, this.mats.champagneGold);
    this.capturedPortraitMat = this.tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: createSampleArtworkTexture(tracker, 'portrait_1') }),
    );
    const capInner = new THREE.Mesh(this.frameInnerGeo, this.capturedPortraitMat);
    capInner.position.z = 0.024;
    capturedFrameGroup.add(capOuter, capInner);
    photoGroup.add(capturedFrameGroup);

    this.addWallFrame(
      photoGroup,
      9.02,
      y0 + 2.1,
      -7.8,
      Math.PI / 2,
      createSampleArtworkTexture(tracker, 'portrait_2'),
    );
    this.addWallFrame(
      photoGroup,
      13.6,
      y0 + 2.1,
      -6.42,
      Math.PI,
      createSampleArtworkTexture(tracker, 'portrait_3'),
    );
    this.addWallFrame(
      photoGroup,
      12.1,
      y0 + 2.1,
      -15.1,
      0,
      createSampleArtworkTexture(tracker, 'diagram'),
    );
    this.addWallFrame(
      photoGroup,
      14.5,
      y0 + 2.1,
      -6.42,
      Math.PI,
      createSampleArtworkTexture(tracker, 'camera_art'),
    );

    const csFrameGroup = new THREE.Group();
    csFrameGroup.position.set(9.02, y0 + 2.1, -12.35);
    csFrameGroup.rotation.y = Math.PI / 2;
    const csOuter = new THREE.Mesh(this.frameOuterGeo, this.mats.champagneGold);
    this.contactSheetMat = this.tracker.trackMat(
      new THREE.MeshBasicMaterial({ map: createSampleArtworkTexture(tracker, 'contact_sheet') }),
    );
    const csInner = new THREE.Mesh(this.frameInnerGeo, this.contactSheetMat);
    csInner.position.z = 0.024;
    csFrameGroup.add(csOuter, csInner);
    photoGroup.add(csFrameGroup);

    // Instantiate Photography Studio Micro-Props via shared MicroPropLibrary
    this.microPropLibrary.instantiatePhotographyStudioProps(y0);
  }

  /**
   * Builds Room 2: Harsha's Couture Corner (Mini Fashion Boutique) hero fixtures and
   * delegates micro-prop instantiation to `MicroPropLibrary.instantiateBoutiqueProps`.
   */
  private buildMiniFashionBoutique(): void {
    const { tracker, mats, y0, group } = this;
    const wallMat = mats.creamStone;
    const goldTrimMat = mats.champagneGold;

    const boutiqueGroup = new THREE.Group();
    boutiqueGroup.name = 'MiniFashionBoutique';
    group.add(boutiqueGroup);

    // Two miniature mannequins flanking Boutique entrance (lx = 8.48, lz = -1.42 and +1.42)
    const miniMannequinSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.22, 0.48, 12));
    miniMannequinSkirtGeo.translate(0, 0.42, 0);
    const miniMannequinStandGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.18, 12));
    miniMannequinStandGeo.translate(0, 0.09, 0);
    [-1.42, 1.42].forEach((mz, idx) => {
      const mm = new THREE.Group();
      mm.position.set(8.48, y0, mz);
      mm.add(
        new THREE.Mesh(miniMannequinStandGeo, goldTrimMat),
        new THREE.Mesh(
          miniMannequinSkirtGeo,
          idx === 0 ? this.roseAccentMat : mats.softLavender,
        ),
      );
      boutiqueGroup.add(mm);
    });

    // Glass Display Window & Hero Mannequin (Facade lx = 9.4, lz = -3.5)
    const windowDisplayGroup = new THREE.Group();
    windowDisplayGroup.position.set(9.4, y0, -3.5);
    const winGlassGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.6, 2.6));
    winGlassGeo.rotateY(Math.PI / 2);
    winGlassGeo.translate(-0.55, 1.45, 0);
    const pedGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.24, 20));
    pedGeo.translate(0, 0.12, 0);
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
    windowDisplayGroup.add(
      new THREE.Mesh(winGlassGeo, mats.crystalGlass),
      new THREE.Mesh(pedGeo, goldTrimMat),
      new THREE.Mesh(heroSkirtGeo, heroGownMat),
      new THREE.Mesh(heroBodiceGeo, heroGownMat),
    );
    boutiqueGroup.add(windowDisplayGroup);
    this.addLocalCollider(9.4, -3.5, 0.65);

    // Second Mannequin on North Facade Window (lx = 9.4, lz = 3.5)
    const mannequin2Group = new THREE.Group();
    mannequin2Group.position.set(9.4, y0, 3.5);
    mannequin2Group.add(
      new THREE.Mesh(pedGeo, goldTrimMat),
      new THREE.Mesh(heroSkirtGeo, mats.softLavender),
      new THREE.Mesh(heroBodiceGeo, mats.softLavender),
    );
    boutiqueGroup.add(mannequin2Group);
    this.addLocalCollider(9.4, 3.5, 0.65);

    // Boutique Counter & Packaging Shelf
    const bCounterGroup = new THREE.Group();
    bCounterGroup.position.set(11.8, y0, -2.6);
    const bcBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(1.5, 0.86, 0.64));
    bcBaseGeo.translate(0, 0.43, 0);
    const regGeo = tracker.trackGeo(new THREE.BoxGeometry(0.32, 0.24, 0.26));
    regGeo.translate(-0.35, 0.98, 0);
    bCounterGroup.add(
      new THREE.Mesh(bcBaseGeo, wallMat),
      new THREE.Mesh(regGeo, goldTrimMat),
    );
    boutiqueGroup.add(bCounterGroup);
    this.addLocalCollider(11.8, -2.6, 0.58);

    const packShelfGroup = new THREE.Group();
    packShelfGroup.position.set(14.8, y0, -1.9);
    const pShelfFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 1.65, 1.2));
    pShelfFrameGeo.translate(0, 0.825, 0);
    packShelfGroup.add(new THREE.Mesh(pShelfFrameGeo, wallMat));
    boutiqueGroup.add(packShelfGroup);
    this.addLocalCollider(14.8, -1.9, 0.48);

    // Glass Jewellery Display Counter along East Wall (lx = 14.8, lz = 0.2)
    const jewCounterGroup = new THREE.Group();
    jewCounterGroup.position.set(14.8, y0, 0.2);
    const jCaseBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.72, 0.85, 2.4));
    jCaseBaseGeo.translate(0, 0.425, 0);
    const jGlassGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.35, 2.3));
    jGlassGeo.translate(0, 1.025, 0);
    jewCounterGroup.add(
      new THREE.Mesh(jCaseBaseGeo, wallMat),
      new THREE.Mesh(jGlassGeo, mats.crystalGlass),
    );
    boutiqueGroup.add(jewCounterGroup);
    this.addLocalCollider(14.8, 0.2, 0.6);

    // Shoe Tiered Display Shelves along North Wall (lx = 12.0, lz = 5.3)
    const shoeRackGroup = new THREE.Group();
    shoeRackGroup.position.set(12.0, y0, 5.3);
    const sShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 0.04, 0.45));
    [0.2, 0.5, 0.8].forEach((shY) => {
      const shelf = new THREE.Mesh(sShelfGeo, goldTrimMat);
      shelf.position.y = shY;
      shoeRackGroup.add(shelf);
    });
    boutiqueGroup.add(shoeRackGroup);
    this.addLocalCollider(12.0, 5.3, 0.45);

    // Handbag Display Shelves along South Wall (lx = 12.0, lz = -5.3) + Couture Plaque
    const handbagRackGroup = new THREE.Group();
    handbagRackGroup.position.set(12.0, y0, -5.3);
    const hbShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 0.04, 0.38));
    [0.4, 0.85, 1.3].forEach((hY) => {
      const shelf = new THREE.Mesh(hbShelfGeo, goldTrimMat);
      shelf.position.y = hY;
      handbagRackGroup.add(shelf);
    });
    const couturePlaqueTex = createPlaqueTexture(tracker, '✦ COUTURE ✦');
    const couturePlaque = new THREE.Mesh(
      this.labelGeo,
      tracker.trackMat(new THREE.MeshBasicMaterial({ map: couturePlaqueTex, side: THREE.FrontSide })),
    );
    couturePlaque.position.set(0, 1.65, 0.18);
    handbagRackGroup.add(couturePlaque);
    boutiqueGroup.add(handbagRackGroup);
    this.addLocalCollider(12.0, -5.3, 0.45);

    // Mini Tailoring Station along East Wall (lx = 14.6, lz = 3.8)
    const tailorGroup = new THREE.Group();
    tailorGroup.position.set(14.6, y0, 3.8);
    const tTableGeo = tracker.trackGeo(new THREE.BoxGeometry(0.75, 0.74, 1.45));
    tTableGeo.translate(0, 0.37, 0);
    const smBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.38));
    smBaseGeo.translate(0, 0.76, -0.2);
    const smArmGeo = tracker.trackGeo(new THREE.BoxGeometry(0.08, 0.22, 0.14));
    smArmGeo.translate(-0.06, 0.88, -0.3);
    tailorGroup.add(
      new THREE.Mesh(tTableGeo, wallMat),
      new THREE.Mesh(smBaseGeo, goldTrimMat),
      new THREE.Mesh(smArmGeo, goldTrimMat),
    );
    boutiqueGroup.add(tailorGroup);
    this.addLocalCollider(14.6, 3.8, 0.55);

    // Semi-Private Fitting Area at (lx = 14.6, lz = -3.8)
    const fittingGroup = new THREE.Group();
    fittingGroup.position.set(14.6, y0, -3.8);
    const curtainRailGeo = tracker.trackGeo(new THREE.TorusGeometry(0.85, 0.03, 8, 16, Math.PI));
    curtainRailGeo.rotateY(Math.PI / 2);
    curtainRailGeo.translate(0, 2.6, 0);
    const curtainDrapeGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.85, 0.88, 2.55, 16, 1, true, 0, Math.PI * 0.65),
    );
    curtainDrapeGeo.translate(0, 1.28, 0);
    // Gold backing frame placed behind the mirror reflection chamber (+0.18 in X = 14.78) so mirror glass & inscriptions are unobstructed
    const fMirrorGeo = tracker.trackGeo(new THREE.BoxGeometry(0.12, 1.85, 0.85));
    fMirrorGeo.translate(0.18, 0.95, 0);
    fittingGroup.add(
      new THREE.Mesh(curtainRailGeo, goldTrimMat),
      new THREE.Mesh(curtainDrapeGeo, mats.velvetPlum),
      new THREE.Mesh(fMirrorGeo, mats.champagneGold),
    );
    boutiqueGroup.add(fittingGroup);
    this.addLocalCollider(14.6, -3.8, 0.55);

    // Framed Fashion Sketches on Boutique Walls
    const sketchTex = createSampleArtworkTexture(tracker, 'fashion_sketch');
    this.addWallFrame(boutiqueGroup, 9.02, y0 + 2.1, -3.5, Math.PI / 2, sketchTex);
    this.addWallFrame(boutiqueGroup, 9.02, y0 + 2.1, 3.5, Math.PI / 2, sketchTex);

    // Instantiate Boutique Micro-Props via shared MicroPropLibrary
    this.microPropLibrary.instantiateBoutiqueProps(y0);
  }

  /**
   * Builds Room 3: The Little Dream World (Doll Playroom) hero fixtures and
   * delegates micro-prop instantiation to `MicroPropLibrary.instantiateDollPlayroomProps`.
   */
  private buildDollPlayroom(): void {
    const { tracker, mats, y0, yCeil, group } = this;
    const wallMat = mats.creamStone;
    const goldTrimMat = mats.champagneGold;

    const dollRoomGroup = new THREE.Group();
    dollRoomGroup.name = 'DollPlayroom';
    group.add(dollRoomGroup);

    // Sections 14–16: HERO OBJECT — Tabletop Miniature Castle & Village positioned as a side destination
    // at (lx = 12.85, lz = 11.85) with >1.32m clear walking lanes on all 4 sides (Front, Left, Right, Rear)
    const miniCastleTable = new THREE.Group();
    miniCastleTable.position.set(12.85, y0, 11.85);

    const tableBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.12, 1.18, 0.55, 28));
    tableBaseGeo.translate(0, 0.275, 0);
    miniCastleTable.add(new THREE.Mesh(tableBaseGeo, mats.creamStone));

    // Approach Carpet Runner leading from the South Archway toward the Front Miniature Gate (12.85, 10.97)
    const runnerGeo = tracker.trackGeo(new THREE.BoxGeometry(1.15, 0.022, 3.3));
    runnerGeo.translate(12.85, y0 + 0.014, 8.95);
    const runnerBorderGeo = tracker.trackGeo(new THREE.BoxGeometry(1.24, 0.018, 3.38));
    runnerBorderGeo.translate(12.85, y0 + 0.011, 8.95);
    dollRoomGroup.add(
      new THREE.Mesh(runnerBorderGeo, goldTrimMat),
      new THREE.Mesh(runnerGeo, this.photoRugMat),
    );

    const mcGroup = new THREE.Group();
    mcGroup.position.set(0, 0.55, 0);

    // Low rose-marble courtyard terrace plinth between Yeshwanth & Harsha's Two Towers
    const mcKeepGeo = tracker.trackGeo(new THREE.BoxGeometry(0.68, 0.06, 0.42));
    mcKeepGeo.translate(0, 0.03, -0.04);
    const miniBridgeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.22, 0.03, 0.28));
    miniBridgeGeo.translate(0, 0.015, -0.26);
    const miniFountainGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 0.07, 12));
    miniFountainGeo.translate(0, 0.035, -0.38);

    mcGroup.add(
      new THREE.Mesh(mcKeepGeo, mats.blushRoseMarble),
      new THREE.Mesh(miniBridgeGeo, goldTrimMat),
      new THREE.Mesh(miniFountainGeo, mats.pearlWhite),
    );

    // Miniature Village Houses around Castle
    const villageHouseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.15, 0.14, 0.15));
    villageHouseGeo.translate(0, 0.07, 0);
    const villageRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.14, 4));
    villageRoofGeo.rotateY(Math.PI / 4);
    villageRoofGeo.translate(0, 0.19, 0);

    [
      [0.72, 0.18],
      [0.68, -0.42],
      [-0.68, 0.35],
      [-0.64, -0.48],
      [0.35, 0.74],
      [-0.35, 0.74],
    ].forEach(([vx, vz]) => {
      const h = new THREE.Mesh(villageHouseGeo, mats.blushRoseMarble);
      h.position.set(vx, 0, vz);
      const r = new THREE.Mesh(villageRoofGeo, mats.powderBlueSpire);
      r.position.set(vx, 0, vz);
      mcGroup.add(h, r);
    });

    // Miniature rotating windmill
    const windmillBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.34, 8));
    windmillBaseGeo.translate(0, 0.17, 0);
    const windmillBase = new THREE.Mesh(windmillBaseGeo, mats.creamStone);
    windmillBase.position.set(0.55, 0, 0.58);

    this.windmillBlades = new THREE.Group();
    this.windmillBlades.position.set(0.55, 0.32, 0.69);
    const bladeGeo = tracker.trackGeo(new THREE.BoxGeometry(0.036, 0.32, 0.015));
    const b1 = new THREE.Mesh(bladeGeo, goldTrimMat);
    const b2 = new THREE.Mesh(bladeGeo, goldTrimMat);
    b2.rotation.z = Math.PI / 2;
    this.windmillBlades.add(b1, b2);
    mcGroup.add(windmillBase, this.windmillBlades);
    this.dynamicObjects.add(this.windmillBlades);

    // 5 Stylized Dolls with distinct silhouettes around table
    const dollSkirtGeo = tracker.trackGeo(new THREE.ConeGeometry(0.08, 0.2, 10));
    dollSkirtGeo.translate(0, 0.1, 0);
    const dollHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.042, 8, 8));
    dollHeadGeo.translate(0, 0.23, 0);
    const dollColors = ['#f472b6', '#fbcfe8', '#38bdf8', '#a7f3d0', '#fbbf24'];
    [
      [-0.45, 0.52],
      [0.48, 0.5],
      [-0.82, 0.05],
      [0.84, -0.12],
      [-0.28, -0.78],
    ].forEach(([dx, dz], dIdx) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(dx, 0, dz);
      const sk = new THREE.Mesh(
        dollSkirtGeo,
        tracker.trackMat(
          new THREE.MeshStandardMaterial({ color: dollColors[dIdx], roughness: 0.35 }),
        ),
      );
      const hd = new THREE.Mesh(dollHeadGeo, mats.pearlWhite);
      dGroup.add(sk, hd);
      mcGroup.add(dGroup);
    });

    miniCastleTable.add(mcGroup);
    dollRoomGroup.add(miniCastleTable);
    this.addLocalCollider(12.85, 11.85, 1.18);

    // Multi-Room Visible Dollhouse along West Wall (lx = 9.65, lz = 10.4) so East side of Tabletop Castle is open
    const dollhouseGroup = new THREE.Group();
    dollhouseGroup.position.set(9.65, y0, 10.4);
    dollhouseGroup.rotation.y = Math.PI / 2;

    const dhFrameGeo = tracker.trackGeo(new THREE.BoxGeometry(2.2, 1.8, 0.55));
    dhFrameGeo.translate(0, 0.9, -0.24);
    const dhDividerGeo = tracker.trackGeo(new THREE.BoxGeometry(0.06, 1.7, 0.52));
    dhDividerGeo.translate(0, 0.9, 0);
    const dhFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(2.1, 0.06, 0.52));
    dhFloorGeo.translate(0, 0.9, 0);
    dollhouseGroup.add(
      new THREE.Mesh(dhFrameGeo, mats.creamStone),
      new THREE.Mesh(dhDividerGeo, goldTrimMat),
      new THREE.Mesh(dhFloorGeo, goldTrimMat),
    );
    dollRoomGroup.add(dollhouseGroup);
    this.addLocalCollider(9.65, 10.4, 0.42);

    // LEGO-Style Construction Table (lx = 10.2, lz = 7.4)
    const legoTableGroup = new THREE.Group();
    legoTableGroup.position.set(10.2, y0, 7.4);
    const legoTableBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 0.55, 1.0));
    legoTableBaseGeo.translate(0, 0.275, 0);
    legoTableGroup.add(new THREE.Mesh(legoTableBaseGeo, mats.softLavender));
    dollRoomGroup.add(legoTableGroup);
    this.addLocalCollider(10.2, 7.4, 0.55);

    // Craft Table (lx = 14.3, lz = 7.4)
    const craftGroup = new THREE.Group();
    craftGroup.position.set(14.3, y0, 7.4);
    const craftTableGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.58, 0.58, 0.52, 16));
    craftTableGeo.translate(0, 0.26, 0);
    craftGroup.add(new THREE.Mesh(craftTableGeo, mats.pearlWhite));
    dollRoomGroup.add(craftGroup);
    this.addLocalCollider(14.3, 7.4, 0.55);

    const kidDrawTex = createSampleArtworkTexture(tracker, 'kid_drawing');
    this.addWallFrame(dollRoomGroup, 14.3, y0 + 2.0, 6.42, 0, kidDrawTex);
    this.addWallFrame(dollRoomGroup, 9.42, y0 + 2.0, 8.6, Math.PI / 2, kidDrawTex);

    // Toy Shelf along North Wall (lx = 12.2, lz = 14.6)
    const toyShelfGroup = new THREE.Group();
    toyShelfGroup.position.set(12.2, y0, 14.6);
    const tsShelfGeo = tracker.trackGeo(new THREE.BoxGeometry(2.6, 1.6, 0.38));
    tsShelfGeo.translate(0, 0.8, 0);
    toyShelfGroup.add(new THREE.Mesh(tsShelfGeo, wallMat));
    dollRoomGroup.add(toyShelfGroup);
    this.addLocalCollider(12.2, 14.6, 0.55);

    // Doll Bedroom Corner (lx = 10.1, lz = 13.8)
    const dollBedCorner = new THREE.Group();
    dollBedCorner.position.set(10.1, y0, 13.8);
    const miniBedGeo = tracker.trackGeo(new THREE.BoxGeometry(0.85, 0.28, 0.62));
    miniBedGeo.translate(0, 0.14, 0);
    const miniPillowGeo = tracker.trackGeo(new THREE.BoxGeometry(0.22, 0.08, 0.42));
    miniPillowGeo.translate(-0.26, 0.31, 0);
    dollBedCorner.add(
      new THREE.Mesh(miniBedGeo, mats.blushRoseMarble),
      new THREE.Mesh(miniPillowGeo, mats.pearlWhite),
    );
    dollRoomGroup.add(dollBedCorner);
    this.addLocalCollider(10.1, 13.8, 0.48);

    // Indoor Miniature Raised Garden Planter (lx = 14.4, lz = 13.8)
    const miniGardenCorner = new THREE.Group();
    miniGardenCorner.position.set(14.4, y0, 13.8);
    const planterGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.65, 0.72, 0.26, 16));
    planterGeo.translate(0, 0.13, 0);
    miniGardenCorner.add(new THREE.Mesh(planterGeo, mats.creamStone));
    dollRoomGroup.add(miniGardenCorner);
    this.addLocalCollider(14.4, 13.8, 0.55);

    // Instantiate Doll Playroom Micro-Props via shared MicroPropLibrary
    this.microPropLibrary.instantiateDollPlayroomProps(y0, yCeil);
  }

  /**
   * Section 8–10: Custom Photo Backdrop Loader with Aspect-Ratio-Preserving Cover/Fit Framing,
   * Texture Reuse, and Zero Blob URL Leaks.
   */
  public setCustomPhotoBackdrop(imageSource: string): void {
    if (!imageSource || typeof Image === 'undefined' || !this.customBackdropCanvas) return;

    const isBlobUrl = imageSource.startsWith('blob:');
    const img = new Image();
    if (!isBlobUrl && !imageSource.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (isBlobUrl) {
        URL.revokeObjectURL(imageSource);
      }
      if (!this.customBackdropCanvas || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
      const ctx = this.customBackdropCanvas.getContext('2d');
      if (!ctx) return;

      const cw = this.customBackdropCanvas.width;
      const ch = this.customBackdropCanvas.height;
      ctx.clearRect(0, 0, cw, ch);

      // Soft studio ambient fill behind portrait/landscape images so faces are never stretched
      const bgGrad = ctx.createRadialGradient(cw / 2, ch / 2, 30, cw / 2, ch / 2, cw * 0.65);
      bgGrad.addColorStop(0, '#fdf2f8');
      bgGrad.addColorStop(0.55, '#fce7f3');
      bgGrad.addColorStop(1, '#831843');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = cw / ch;

      // Intelligent aspect-ratio preservation:
      // Portrait or square images fit cleanly with soft studio edges; landscape images cover-fit smoothly
      let drawW = cw;
      let drawH = ch;
      let drawX = 0;
      let drawY = 0;
      if (imgAspect < 0.95) {
        // Portrait image: contain height with soft blurred/pastel side framing so faces are never cropped
        drawH = ch - 16;
        drawW = drawH * imgAspect;
        drawX = (cw - drawW) * 0.5;
        drawY = 8;
      } else if (imgAspect > canvasAspect) {
        drawH = ch;
        drawW = ch * imgAspect;
        drawX = (cw - drawW) * 0.5;
      } else {
        drawW = cw;
        drawH = cw / imgAspect;
        drawY = (ch - drawH) * 0.35;
      }

      ctx.save();
      ctx.shadowColor = 'rgba(131, 24, 67, 0.35)';
      ctx.shadowBlur = 18;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Subtle champagne-gold studio frame border
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);

      if (this.customBackdropTex) {
        this.customBackdropTex.needsUpdate = true;
      }
      this.hasCustomBackdrop = true;
      if (this.activeBackdropIndex !== 6) {
        this.previousPresetIndex = this.activeBackdropIndex;
      }
      this.activeBackdropIndex = 6;
      this.backdropScreenMat.map = this.backdropTextures[6];
      this.backdropScreenMat.needsUpdate = true;
      this.activeCaption = 'The Portrait Atelier ✧ Custom Photo Backdrop Active';
    };
    img.onerror = () => {
      if (isBlobUrl) {
        URL.revokeObjectURL(imageSource);
      }
    };
    img.src = imageSource;
  }

  private playShutterSound(): void {
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
      // Mechanical shutter click + crystal flash chime
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.07);

      const chime = this.audioCtx.createOscillator();
      const cGain = this.audioCtx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(1046.5, now + 0.05);
      chime.frequency.exponentialRampToValueAtTime(1318.5, now + 0.22);
      cGain.gain.setValueAtTime(0.05, now + 0.05);
      cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);
      chime.connect(cGain);
      cGain.connect(this.audioCtx.destination);
      chime.start(now + 0.05);
      chime.stop(now + 0.4);
    } catch {
      // Ignore audio fallback
    }
  }

  /**
   * Renders the 4-frame photographic film strip (`1024x320`) with:
   * - Dark celluloid border & subtle translucent film sheen
   * - Top & bottom sprocket perforations + amber negative edge codes (`01A`–`04A`)
   * - Frame 1: Primary captured portrait
   * - Frame 2: Tasteful close-up portrait crop
   * - Frame 3: Soft-focus rose-gold dream frame with subtle heart/light motif
   * - Frame 4: Final decorative memory frame with Y + H crest
   * - Subtle bottom-edge physical inscription: `Y + H  •  A memory from our little world`
   * - Gradual chemical development progression (`developProgress` in `[0.0, 1.0]`)
   */
  private drawFilmStripCanvas(developProgress: number): void {
    if (!this.filmStripCanvas) return;
    const ctx = this.filmStripCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.filmStripCanvas.width; // 1024
    const h = this.filmStripCanvas.height; // 320
    const dev = THREE.MathUtils.clamp(developProgress, 0, 1);

    // 1. Dark translucent celluloid film base
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, '#130c12');
    baseGrad.addColorStop(0.5, '#1d121b');
    baseGrad.addColorStop(1, '#120b10');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal film strip edge highlight lines
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(w, 4);
    ctx.moveTo(0, h - 4);
    ctx.lineTo(w, h - 4);
    ctx.stroke();

    // 2. Top & Bottom Sprocket Holes (24 perforations per edge)
    for (let i = 0; i < 24; i++) {
      const sx = 18 + i * 42;
      // Warm backlit glow through sprocket holes
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.roundRect(sx, 12, 22, 15, 3);
      ctx.roundRect(sx, h - 29, 22, 15, 3);
      ctx.fill();

      ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Draw the 4 Film Frames
    const srcImg =
      this.latestPortraitCanvas ??
      (this.backdropTextures[this.activeBackdropIndex]?.image as HTMLCanvasElement | undefined);
    const frameW = 222;
    const frameH = 204;
    const frameY = 48;
    const frameLabels = ['01A • PORTRAIT', '02A • CLOSE-UP', '03A • HEART LIGHT', '04A • MEMORY'];

    const drawHeartMotif = (cx: number, cy: number, size: number, color: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.35);
      ctx.bezierCurveTo(
        cx - size,
        cy - size * 0.25,
        cx - size * 0.55,
        cy - size * 0.95,
        cx,
        cy - size * 0.4,
      );
      ctx.bezierCurveTo(
        cx + size * 0.55,
        cy - size * 0.95,
        cx + size,
        cy - size * 0.25,
        cx,
        cy + size * 0.35,
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    for (let f = 0; f < 4; f++) {
      const fx = 24 + f * 248;

      // Top film edge frame code
      ctx.fillStyle = 'rgba(251, 191, 36, 0.72)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(frameLabels[f], fx + 4, 41);

      // Frame recess
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(fx, frameY, frameW, frameH, 4);
      ctx.clip();

      // Unexposed dark negative base inside frame
      ctx.fillStyle = '#1f1019';
      ctx.fillRect(fx, frameY, frameW, frameH);

      // Staggered per-frame development reveal so Frame 1 -> Frame 4 develop organically
      const frameDev = THREE.MathUtils.clamp((dev - f * 0.08) / 0.76, 0, 1);

      if (frameDev > 0.02 && srcImg) {
        ctx.save();
        ctx.globalAlpha = smoothStep01(frameDev);

        if (f === 0) {
          // Frame 1: Primary Captured Portrait
          ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height, fx, frameY, frameW, frameH);
        } else if (f === 1) {
          // Frame 2: Tasteful Close-Up Portrait Crop (upper-center crop of actual captured portrait)
          const sw = srcImg.width * 0.68;
          const sh = srcImg.height * 0.68;
          const sx = (srcImg.width - sw) * 0.5;
          const sy = srcImg.height * 0.08;
          ctx.drawImage(srcImg, sx, sy, sw, sh, fx, frameY, frameW, frameH);
        } else if (f === 2) {
          // Frame 3: Soft-focus / warm rose-gold tone + subtle heart & starlight bokeh motif
          ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height, fx, frameY, frameW, frameH);
          const warmOverlay = ctx.createRadialGradient(
            fx + frameW * 0.5,
            frameY + frameH * 0.45,
            12,
            fx + frameW * 0.5,
            frameY + frameH * 0.5,
            frameW * 0.65,
          );
          warmOverlay.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
          warmOverlay.addColorStop(0.6, 'rgba(244, 114, 182, 0.26)');
          warmOverlay.addColorStop(1, 'rgba(88, 28, 135, 0.38)');
          ctx.fillStyle = warmOverlay;
          ctx.fillRect(fx, frameY, frameW, frameH);

          drawHeartMotif(fx + frameW * 0.5, frameY + frameH * 0.52, 34, 'rgba(254, 240, 138, 0.52)');
          drawHeartMotif(fx + frameW * 0.25, frameY + frameH * 0.28, 12, 'rgba(251, 207, 232, 0.65)');
          drawHeartMotif(fx + frameW * 0.76, frameY + frameH * 0.32, 14, 'rgba(251, 207, 232, 0.65)');
        } else {
          // Frame 4: Final Memory Frame with warm vignette & Y + H crest
          ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height, fx, frameY, frameW, frameH);
          const vig = ctx.createRadialGradient(
            fx + frameW * 0.5,
            frameY + frameH * 0.5,
            frameW * 0.18,
            fx + frameW * 0.5,
            frameY + frameH * 0.5,
            frameW * 0.68,
          );
          vig.addColorStop(0, 'rgba(255, 241, 242, 0.05)');
          vig.addColorStop(1, 'rgba(46, 10, 26, 0.72)');
          ctx.fillStyle = vig;
          ctx.fillRect(fx, frameY, frameW, frameH);

          ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
          ctx.lineWidth = 2;
          ctx.strokeRect(fx + 10, frameY + 10, frameW - 20, frameH - 20);
          ctx.fillStyle = '#fde047';
          ctx.font = 'italic bold 13px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('Forever • Y + H ♡', fx + frameW * 0.5, frameY + frameH - 18);
        }
        ctx.restore();

        // Chemical silver-amber developing wash during mid-development (0.05 < frameDev < 0.88)
        if (frameDev < 0.88) {
          const washAlpha = Math.sin(frameDev * Math.PI) * 0.42;
          ctx.fillStyle = `rgba(217, 119, 6, ${washAlpha.toFixed(3)})`;
          ctx.fillRect(fx, frameY, frameW, frameH);
        }
      }

      // Subtle photographic grain dots inside each frame
      ctx.fillStyle = 'rgba(255, 250, 240, 0.055)';
      for (let g = 0; g < 28; g++) {
        const gx = fx + ((g * 47 + f * 31) % (frameW - 4));
        const gy = frameY + ((g * 61 + f * 19) % (frameH - 4));
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }

      ctx.restore();

      // Thin dark-gold emulsion frame border
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.34)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, frameY, frameW, frameH);
    }

    // 4. Section 8: Subtle physical inscription along the bottom edge of the film strip
    ctx.fillStyle = 'rgba(253, 224, 71, 0.78)';
    ctx.font = 'italic 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Y + H   •   A memory from our little world   •   ATELIER FILM NO. ${Math.max(1, this.portraitCount)}`,
      w * 0.5,
      h - 34,
    );

    if (this.filmStripTex) {
      this.filmStripTex.needsUpdate = true;
    }
  }

  /**
   * Generates the captured portrait canvas & texture from the active studio backdrop and Harsha's worn jewellery.
   */
  private executePortraitCanvasCapture(): void {
    this.portraitCount += 1;
    const activeTex = this.backdropTextures[this.activeBackdropIndex];
    const srcCanvas = activeTex?.image as HTMLCanvasElement | undefined;
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 256;
    pCanvas.height = 320;
    const ctx = pCanvas.getContext('2d');
    if (ctx) {
      if (srcCanvas) {
        ctx.drawImage(srcCanvas, 64, 0, 384, 384, 0, 0, 256, 320);
      } else {
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(0, 0, 256, 320);
      }

      if (this.activeBackdropIndex < 6) {
        ctx.fillStyle = 'rgba(255, 241, 242, 0.92)';
        ctx.beginPath();
        ctx.arc(128, 128, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(68, 290);
        ctx.quadraticCurveTo(128, 168, 188, 290);
        ctx.closePath();
        ctx.fill();

        // Crown emblem
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(104, 92);
        ctx.lineTo(114, 70);
        ctx.lineTo(128, 84);
        ctx.lineTo(142, 70);
        ctx.lineTo(152, 92);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 248, 312);
    }

    this.latestPortraitCanvas = pCanvas;
    const newPortraitTex = this.tracker.trackTex(new THREE.CanvasTexture(pCanvas));
    newPortraitTex.colorSpace = THREE.SRGBColorSpace;
    newPortraitTex.needsUpdate = true;
    this.latestPortraitTex = newPortraitTex;

    if (this.capturedPortraitMat) {
      this.capturedPortraitMat.map = newPortraitTex;
      this.capturedPortraitMat.needsUpdate = true;
    }
  }

  /**
   * Commits the player's current spatial context into `lastPhotoCaptureContext` BEFORE a photograph is taken,
   * and places/updates the physical Portrait Memory Marker on the studio floor (Sections 4–7, 13, 33).
   */
  private commitLastPhotoCaptureContext(): void {
    const ctx = this._storedPhotoCaptureContext;
    if (this._hasLivePose) {
      ctx.worldPosition.copy(this._livePoseWorldPos);
      ctx.cameraPosition.copy(this._livePoseCamPos);
      ctx.cameraTarget.copy(this._livePoseCamTarget);
      ctx.playerYaw = this._livePoseYaw;
      ctx.playerPitch = this._livePosePitch;
    } else {
      const fallbackLx =
        this.lastPlayerLx >= 8.8 && this.lastPlayerLx <= 15.3 ? this.lastPlayerLx : 13.55;
      const fallbackLz =
        this.lastPlayerLz >= -14.8 && this.lastPlayerLz <= -6.4 ? this.lastPlayerLz : -10.6;
      ctx.worldPosition.set(
        this.originX + fallbackLx,
        this.baseY + this.y0,
        this.originZ + fallbackLz,
      );
      ctx.playerYaw = -Math.PI / 2;
      ctx.playerPitch = 0.14;
      ctx.cameraPosition.set(
        ctx.worldPosition.x + 2.8,
        ctx.worldPosition.y + 1.65,
        ctx.worldPosition.z,
      );
      ctx.cameraTarget.set(
        ctx.worldPosition.x,
        ctx.worldPosition.y + 1.38,
        ctx.worldPosition.z,
      );
    }
    ctx.backdropIndex = this.activeBackdropIndex;
    ctx.portraitIndex = this.portraitCount + 1;
    ctx.timestamp = Date.now();
    this.lastPhotoCaptureContext = ctx;

    // Place & reveal the physical Portrait Memory Marker on the studio floor at the exact capture spot
    if (this.lastPhotoMemoryMarkerGroup) {
      const markerLx = THREE.MathUtils.clamp(ctx.worldPosition.x - this.originX, 9.2, 14.8);
      const markerLz = THREE.MathUtils.clamp(ctx.worldPosition.z - this.originZ, -14.4, -7.0);
      this.lastPhotoMemoryMarkerGroup.position.set(markerLx, this.y0 + 0.029, markerLz);
      this.lastPhotoMemoryMarkerGroup.visible = true;
    }
  }

  /**
   * Smoothly transitions the camera from the Memory Film Display back to `lastPhotoCaptureContext`
   * over `RETURN_TO_CAPTURE_DUR` (`1.65s` ease-in-out animating both position and target) and
   * queues player restoration to `lastPhotoCaptureContext` (Sections 5, 6, 11, 12).
   */
  private beginReturnToCaptureLocation(): void {
    if (!this.lastPhotoCaptureContext) {
      this.avatarBridge?.resetNeutralPose?.();
      this.activeCameraMode = 'none';
      this.cameraTransitionElapsed = 0.0;
      this.camLookYaw = 0.0;
      this.camLookPitch = 0.0;
      return;
    }
    // Capture current camera world position & target as start of the smooth return arc
    const rackWorldX = this.originX + 9.75;
    const rackWorldY = this.baseY + this.y0 + 1.38;
    const rackWorldZ = this.originZ - 6.62;
    if (_scratchCamWorldPos.lengthSq() > 1.0) {
      this.returnStartCamPos.copy(_scratchCamWorldPos);
      this.returnStartLookPos.copy(_scratchLookWorldPos);
    } else {
      this.returnStartCamPos.set(rackWorldX, rackWorldY + 0.04, rackWorldZ - 0.92);
      this.returnStartLookPos.set(rackWorldX, rackWorldY, rackWorldZ);
    }
    this.returnTransitionElapsed = 0.0;
    this.pendingPhotoReturn = true;
    this.avatarBridge?.resetNeutralPose?.();
    this.activeCameraMode = 'return_to_capture_location';
  }

  /**
   * Sections 5, 6 & 12: `[E] Take Portrait`
   * Captures `LastPhotoCaptureContext` BEFORE taking the photograph, updates the physical
   * Portrait Memory Marker on the floor, and runs the complete Film Strip sequence:
   * - Phase A (0.0s - 2.8s): Anticipation, soft key light warmup, focus adjustment at the capture spot
   * - Phase B (2.8s - 6.0s): Slow ease-in-out portrait framing arc around Harsha at the capture spot
   * - Phase C (6.0s - 7.8s): Focus lock, shutter & soft flash at 6.35s, and 1.45s lingering hold on the actual portrait composition
   * - Steps 4–6 (7.8s - 9.8s): Slow pull-back as the physical 4-frame film strip emerges near the studio camera and glides to the North-Wall Memory Film Display
   * - Steps 7–8 (9.8s - 13.4s): Gradual 4-frame chemical development + lingering close-up drift across the 4 frames and `Y + H` inscription
   * - Step 9 (13.4s - 15.2s): Smooth ease-in-out camera return (`RETURN_TO_CAPTURE_LOCATION`) back to `lastPhotoCaptureContext` -> release to `EXPLORATION`
   */
  public triggerTakePortrait(): boolean {
    // 1. Capture spatial memory BEFORE taking the photograph (Sections 4 & 13)
    this.commitLastPhotoCaptureContext();

    this.filmStripStage = 'developing';
    this.filmStripDevelopElapsed = 0.0;
    this.shutterFiredForCurrentCapture = false;
    this.lastRedrawnDevelopBucket = -1;
    this.drawFilmStripCanvas(0.0);

    // Position emerging strip near studio camera (local to memoryRackGroup with rotation.y = Math.PI)
    this.heroFilmStripGroup.position.set(-0.85, 1.48, 3.2);
    this.heroFilmStripGroup.rotation.set(0.08, 0.18, 0.04);

    this.avatarBridge?.setActivityPose?.('photo_pose_1');

    this.activeCameraMode = 'film_strip_developing';
    this.cameraTransitionElapsed = 0.0;
    this.camLookYaw = 0.0;
    this.camLookPitch = 0.0;
    this.activeCaption = null;
    return true;
  }

  /**
   * Section 6: `[I] Inspect Film`
   * Smoothly moves the camera to the wall-mounted Memory Film Display (`lx = 9.75, lz = -6.62`)
   * and returns to `lastPhotoCaptureContext` when finished looking.
   */
  public inspectFilmStrip(): boolean {
    if (this.portraitCount <= 0) {
      this.drawFilmStripCanvas(1.0);
    }
    this.filmStripStage =
      this.filmStripStage === 'memory_kept' ? 'memory_kept' : 'inspecting';
    this.activeCameraMode = 'film_strip_inspect';
    this.cameraTransitionElapsed = 0.0;
    this.camLookYaw = 0.0;
    this.camLookPitch = 0.0;
    this.isFilmCloseUpView = false;
    this.activeCaption = null;
    return true;
  }

  /**
   * Section 7 & 26: `[K] Keep Memory`
   * Permanently attaches the developed film strip to the Memory Film Display collection,
   * updates the Tabletop Castle Memory Path, sends the captured memory directly to the
   * Floor 3 Heart Gallery, displays a compact `♡ Memory kept` confirmation in the bottom prompt,
   * and smoothly returns the camera & player to `lastPhotoCaptureContext`.
   */
  public keepCapturedMemory(): boolean {
    if (!this.latestPortraitCanvas || !this.latestPortraitTex) {
      return this.triggerTakePortrait();
    }
    this.keptMemoriesCount += 1;
    this.filmStripStage = 'memory_kept';
    this.drawFilmStripCanvas(1.0);

    // Update contact sheet & archival hanging strip on the Memory Film Display rack
    if (this.contactSheetMat) {
      this.contactSheetMat.map = this.filmStripTex;
      this.contactSheetMat.needsUpdate = true;
    }
    this.archivalStrip1Group.rotation.z = -0.02 + (this.keptMemoriesCount % 3) * 0.015;
    this.archivalStrip2Group.rotation.z = 0.025 - (this.keptMemoriesCount % 2) * 0.015;

    // Connect to Tabletop Castle Memory Path
    if (this.latestPortraitTex) {
      this.tabletopWorld.addCapturedPortraitToMemoryPath(this.latestPortraitTex);
    }

    // Connect automatically to Floor 3 Heart Gallery
    if (this.keepMemoryCallback && this.latestPortraitCanvas) {
      try {
        const dataUrl = this.latestPortraitCanvas.toDataURL('image/png');
        this.keepMemoryCallback(dataUrl, this.keptMemoriesCount);
      } catch {
        // Ignore security taint fallback
      }
    }

    // Play warm crystal memory-kept chord
    this.playShutterSound();

    // Show tiny non-blocking confirmation in the bottom prompt (Section 26)
    this.memoryKeptNoticeTimer = 3.2;
    this.activeCaption = null;

    // Smoothly return camera & player to LastPhotoCaptureContext
    if (this.activeCameraMode !== 'none' && this.lastPhotoCaptureContext) {
      this.beginReturnToCaptureLocation();
    } else if (this.lastPhotoCaptureContext) {
      this.pendingPhotoReturn = true;
    }
    return true;
  }

  public exitActiveCameraMode(): void {
    if (this.jewelleryAtelier.isCinematicActive()) {
      this.jewelleryAtelier.skipCinematic();
    }
    if (this.tabletopWorld.isTransitionActive()) {
      this.tabletopWorld.skipCinematic();
    }
    if (this.filmStripStage === 'developing') {
      if (!this.shutterFiredForCurrentCapture) {
        this.shutterFiredForCurrentCapture = true;
        this.playShutterSound();
        this.executePortraitCanvasCapture();
      }
      this.drawFilmStripCanvas(1.0);
      this.heroFilmStripGroup.position.set(0, 1.38, 0.03);
      this.heroFilmStripGroup.rotation.set(0, 0, 0);
      this.shutterFlashMesh.visible = false;
      this.filmStripStage = 'developed_ready_to_inspect';
      this.beginReturnToCaptureLocation();
      return;
    }
    if (this.activeCameraMode === 'film_strip_inspect') {
      if (this.filmStripStage === 'inspecting') {
        this.filmStripStage = 'developed_ready_to_inspect';
      }
      this.beginReturnToCaptureLocation();
      return;
    }
    // Exiting Portrait Camera without taking a photo does NOT create or trigger a photo anchor (Section 13)
    this.avatarBridge?.resetNeutralPose?.();
    this.activeCameraMode = 'none';
    this.cameraTransitionElapsed = 0.0;
    this.camLookYaw = 0.0;
    this.camLookPitch = 0.0;
  }

  public getCameraState(): CreativeWingCameraState {
    // Priority 1: Tabletop Castle -> Little Dream World + Golden Yeshwanth + Rose Handoff Cinematics
    if (this.tabletopWorld.isTransitionActive()) {
      const tr = this.tabletopWorld.getTransitionCameraState();
      return {
        active: tr.active,
        mode: 'doll_playroom',
        camWorldPos: tr.camWorldPos,
        lookWorldPos: tr.lookWorldPos,
        blendAlpha: tr.blendAlpha,
        fov: tr.fov,
        seatWorldPos: tr.seatWorldPos,
        seatYaw: tr.seatYaw,
        isSitting: tr.isSitting,
      };
    }

    // Priority 2: Jewellery Atelier Romantic Cinematics (Y + H Ring, Necklace, Crown + Mirror, Combination)
    if (this.jewelleryAtelier.isCinematicActive()) {
      const jc = this.jewelleryAtelier.getCinematicCameraState();
      return {
        active: jc.active,
        mode: 'couture_boutique',
        camWorldPos: jc.camWorldPos,
        lookWorldPos: jc.lookWorldPos,
        blendAlpha: jc.blendAlpha,
        fov: jc.fov,
        seatWorldPos: jc.seatWorldPos,
        seatYaw: jc.seatYaw,
      };
    }

    if (this.activeCameraMode === 'none') {
      return {
        active: false,
        mode: 'none',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 0.0,
      };
    }

    // Smooth Return-to-Capture-Location Camera Mode (Sections 5, 6, 11, 12)
    if (this.activeCameraMode === 'return_to_capture_location' && this.lastPhotoCaptureContext) {
      const retU = smoothStep01(
        THREE.MathUtils.clamp(this.returnTransitionElapsed / this.RETURN_TO_CAPTURE_DUR, 0, 1),
      );
      _scratchCamWorldPos.lerpVectors(
        this.returnStartCamPos,
        this.lastPhotoCaptureContext.cameraPosition,
        retU,
      );
      _scratchLookWorldPos.lerpVectors(
        this.returnStartLookPos,
        this.lastPhotoCaptureContext.cameraTarget,
        retU,
      );
      return {
        active: true,
        mode: 'return_to_capture_location',
        camWorldPos: _scratchCamWorldPos,
        lookWorldPos: _scratchLookWorldPos,
        blendAlpha: 1.0 - retU * 0.15,
        fov: THREE.MathUtils.lerp(46.0, 56.0, retU),
      };
    }

    const t = THREE.MathUtils.clamp(
      this.cameraTransitionElapsed / this.CAMERA_TRANSITION_DUR,
      0,
      1,
    );
    const alpha = smoothStep01(t);

    const dirX = Math.cos(this.camLookYaw) * Math.cos(this.camLookPitch);
    const dirY = Math.sin(this.camLookPitch);
    const dirZ = Math.sin(this.camLookYaw) * Math.cos(this.camLookPitch);

    let activeFov = 52.0;
    let seatPosOut: THREE.Vector3 | undefined = undefined;
    let seatYawOut: number | undefined = undefined;

    if (this.activeCameraMode === 'portrait_atelier') {
      _scratchCamWorldPos.set(
        this.originX + 10.85,
        this.baseY + this.y0 + 1.56,
        this.originZ - 10.6,
      );
      _scratchLookWorldPos.set(
        _scratchCamWorldPos.x + dirX * 4.3,
        _scratchCamWorldPos.y + dirY * 3.2 + 0.08,
        _scratchCamWorldPos.z + dirZ * 4.3,
      );
    } else if (this.activeCameraMode === 'film_strip_developing') {
      // =====================================================================
      // SECTIONS 5, 6 & 12: PORTRAIT ATELIER + FILM STRIP + RETURN CINEMATIC (0.0s -> 15.2s)
      // =====================================================================
      const pT = this.filmStripDevelopElapsed;
      const harshaWorldX = this.originX + 13.55;
      const harshaWorldY = this.baseY + this.y0;
      const harshaWorldZ = this.originZ - 10.6;
      _scratchSeatWorldPos.set(harshaWorldX, harshaWorldY, harshaWorldZ);
      seatPosOut = _scratchSeatWorldPos;
      seatYawOut = -Math.PI / 2; // Facing West toward the studio lens

      const studioCamX = this.originX + 10.85;
      const studioCamY = this.baseY + this.y0 + 1.52;
      const studioCamZ = this.originZ - 10.6;

      // Wall-mounted Memory Film Display on North Studio Wall (lx = 9.75, lz = -6.62, facing +Z / South)
      const rackWorldX = this.originX + 9.75;
      const rackWorldY = this.baseY + this.y0 + 1.38;
      const rackWorldZ = this.originZ - 6.62;

      if (pT < 2.8) {
        // PHASE A: PREPARATION (0.0s -> 2.8s)
        // Slow ease-in-out approach toward the portrait framing position + subtle focus adjustment
        const u = smoothStep01(pT / 2.8);
        const latSlide = Math.sin(u * Math.PI) * 0.14;
        _scratchCamWorldPos.set(
          THREE.MathUtils.lerp(studioCamX - 0.35, studioCamX + 0.45, u),
          studioCamY,
          studioCamZ + latSlide,
        );
        _scratchLookWorldPos.set(harshaWorldX, harshaWorldY + 1.38, harshaWorldZ);
        activeFov = THREE.MathUtils.lerp(54, 48, u);
      } else if (pT < 6.0) {
        // PHASE B: PERSONAL PORTRAIT FRAMING (2.8s -> 6.0s)
        // Slow lingering camera arc: Front -> Front 3/4 -> Subtle Side -> Return toward Front 3/4
        const u = smoothStep01((pT - 2.8) / 3.2);
        const arcOffset = Math.sin(u * Math.PI * 1.25) * 0.38;
        const dist = 2.28;
        _scratchCamWorldPos.set(
          harshaWorldX - Math.cos(arcOffset) * dist,
          harshaWorldY + 1.46 + Math.sin(u * Math.PI) * 0.05,
          harshaWorldZ + Math.sin(arcOffset) * dist,
        );
        _scratchLookWorldPos.set(harshaWorldX, harshaWorldY + 1.36, harshaWorldZ);
        activeFov = 47.0 - Math.sin(u * Math.PI) * 2.5;
      } else if (pT < 7.8) {
        // PHASE C: THE PHOTOGRAPH & PORTRAIT HOLD AT CAPTURE SPOT (6.0s -> 7.8s)
        // Focus locks -> Shutter & soft flash at 6.35s -> 1.45s lingering hold on the actual portrait composition
        const heroAngle = 0.2;
        const dist = 2.22;
        _scratchCamWorldPos.set(
          harshaWorldX - Math.cos(heroAngle) * dist,
          harshaWorldY + 1.46,
          harshaWorldZ + Math.sin(heroAngle) * dist,
        );
        _scratchLookWorldPos.set(harshaWorldX, harshaWorldY + 1.36, harshaWorldZ);
        activeFov = 45.0;
      } else if (pT < 9.8) {
        // SECTION 12 STEPS 3–5 (7.8s -> 9.8s):
        // Camera pulls back slightly as physical film strip emerges near studio camera and glides to North-Wall Memory Film Display
        const u = smoothStep01((pT - 7.8) / 2.0);
        const startCamX = studioCamX + 0.45;
        const startCamY = studioCamY - 0.04;
        const startCamZ = studioCamZ - 0.15;

        const endCamX = rackWorldX;
        const endCamY = rackWorldY + 0.04;
        const endCamZ = rackWorldZ - 0.94;

        _scratchCamWorldPos.set(
          THREE.MathUtils.lerp(startCamX, endCamX, u),
          THREE.MathUtils.lerp(startCamY, endCamY, u),
          THREE.MathUtils.lerp(startCamZ, endCamZ, u),
        );
        _scratchLookWorldPos.set(
          THREE.MathUtils.lerp(studioCamX + 0.2, rackWorldX, u),
          THREE.MathUtils.lerp(studioCamY - 0.06, rackWorldY, u),
          THREE.MathUtils.lerp(studioCamZ, rackWorldZ, u),
        );
        activeFov = THREE.MathUtils.lerp(45, 44, u);
      } else if (pT < 13.4) {
        // SECTION 12 STEPS 6 & 7 (9.8s -> 13.4s):
        // Film strip develops on the North-Wall Memory Film Display -> Slow lingering drift across the 4 frames & Y + H inscription
        const devU = smoothStep01(THREE.MathUtils.clamp((pT - 9.8) / 3.6, 0, 1));
        const pushIn = Math.sin(devU * Math.PI);
        const viewDist = THREE.MathUtils.lerp(0.94, 0.58, pushIn);
        const panX = Math.sin(devU * Math.PI * 2) * 0.16;
        _scratchCamWorldPos.set(
          rackWorldX + panX * 0.6,
          rackWorldY + 0.02,
          rackWorldZ - viewDist,
        );
        _scratchLookWorldPos.set(rackWorldX + panX, rackWorldY, rackWorldZ);
        activeFov = THREE.MathUtils.lerp(44, 39, pushIn);
      } else {
        // SECTION 12 STEP 8 (13.4s -> 15.2s):
        // Smooth ease-in-out camera return from the Memory Film Display back to `lastPhotoCaptureContext`
        seatPosOut = undefined;
        seatYawOut = undefined;
        const retU = smoothStep01(THREE.MathUtils.clamp((pT - 13.4) / 1.8, 0, 1));
        const startX = rackWorldX;
        const startY = rackWorldY + 0.02;
        const startZ = rackWorldZ - 0.92;
        const ctx = this.lastPhotoCaptureContext;
        const endCamX = ctx ? ctx.cameraPosition.x : studioCamX + 1.8;
        const endCamY = ctx ? ctx.cameraPosition.y : studioCamY + 0.15;
        const endCamZ = ctx ? ctx.cameraPosition.z : studioCamZ;
        const endLookX = ctx ? ctx.cameraTarget.x : harshaWorldX;
        const endLookY = ctx ? ctx.cameraTarget.y : harshaWorldY + 1.38;
        const endLookZ = ctx ? ctx.cameraTarget.z : harshaWorldZ;

        _scratchCamWorldPos.set(
          THREE.MathUtils.lerp(startX, endCamX, retU),
          THREE.MathUtils.lerp(startY, endCamY, retU),
          THREE.MathUtils.lerp(startZ, endCamZ, retU),
        );
        _scratchLookWorldPos.set(
          THREE.MathUtils.lerp(rackWorldX, endLookX, retU),
          THREE.MathUtils.lerp(rackWorldY, endLookY, retU),
          THREE.MathUtils.lerp(rackWorldZ, endLookZ, retU),
        );
        activeFov = THREE.MathUtils.lerp(44, 56, retU);
      }
    } else if (this.activeCameraMode === 'film_strip_inspect') {
      const rackWorldX = this.originX + 9.75;
      const rackWorldY = this.baseY + this.y0 + 1.38;
      const rackWorldZ = this.originZ - 6.62;
      const viewDist = this.isFilmCloseUpView ? 0.54 : 0.92;
      // Slow lingering horizontal drift + user drag look
      const panX = THREE.MathUtils.clamp(this.camLookYaw * 0.45, -0.36, 0.36);

      _scratchCamWorldPos.set(
        rackWorldX + panX,
        rackWorldY + 0.03 - this.camLookPitch * 0.28,
        rackWorldZ - viewDist,
      );
      _scratchLookWorldPos.set(
        rackWorldX + panX * 0.85,
        rackWorldY + this.camLookPitch * 0.22,
        rackWorldZ,
      );
      activeFov = this.isFilmCloseUpView ? 38.0 : 46.0;
    } else if (this.activeCameraMode === 'couture_boutique') {
      _scratchCamWorldPos.set(
        this.originX + 10.6,
        this.baseY + this.y0 + 1.58,
        this.originZ + 0.15,
      );
      _scratchLookWorldPos.set(
        _scratchCamWorldPos.x + dirX * 3.2,
        _scratchCamWorldPos.y + dirY * 2.5 - 0.18,
        _scratchCamWorldPos.z + dirZ * 3.2,
      );
    } else if (this.activeCameraMode === 'doll_playroom') {
      // Tabletop Castle at (12.85, y0, 11.85): frame from the open South/West approach
      _scratchCamWorldPos.set(
        this.originX + 11.25,
        this.baseY + this.y0 + 1.72,
        this.originZ + 10.25,
      );
      _scratchLookWorldPos.set(
        this.originX + 12.85 + Math.sin(this.camLookYaw) * 0.65,
        this.baseY + this.y0 + 1.05 + this.camLookPitch * 0.45,
        this.originZ + 11.85 + (1.0 - Math.cos(this.camLookYaw)) * 0.35,
      );
    }

    return {
      active: true,
      mode: this.activeCameraMode,
      camWorldPos: _scratchCamWorldPos,
      lookWorldPos: _scratchLookWorldPos,
      blendAlpha: alpha,
      fov: activeFov,
      seatWorldPos: seatPosOut,
      seatYaw: seatYawOut,
    };
  }

  public getProximityPrompt(playerPos: THREE.Vector3): string | null {
    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const relY = playerPos.y - (this.baseY + this.y0);

    if (Math.abs(relY) > 1.6) return null;

    // Non-blocking tiny bottom confirmation when a memory is kept (Section 26)
    if (this.memoryKeptNoticeTimer > 0) {
      return '♡ Memory kept';
    }

    if (this.tabletopWorld.isTransitionActive()) {
      if (this.tabletopWorld.getCurrentDialogue() !== null) {
        return null;
      }
      return '[E] Continue · [Space] Skip';
    }
    if (this.jewelleryAtelier.isCinematicActive()) {
      return '[E] Continue · [Space] Skip';
    }

    // Inside Connected Little Dream World Enclave ("Our Little Kingdom", center lx = 33.0, lz = 12.0)
    if (this.tabletopWorld.isInsideLittleDreamWorld || Math.hypot(lx - 33.0, lz - 12.0) <= 8.5) {
      if (this.tabletopWorld.isNearDreamWorldReturnGate(lx, lz)) {
        return '[E] Return from Our Little Kingdom';
      }
      if (this.tabletopWorld.isNearGoldenYeshwanth(lx, lz)) {
        return '[E] Queen’s Courtyard & Crown Reveal';
      }
      return 'Walk Curved Path through Our Little Kingdom to Queen’s Courtyard or West Gate for [E] Return';
    }

    if (this.activeCameraMode !== 'none') {
      if (this.activeCameraMode === 'return_to_capture_location') {
        return null;
      }
      if (this.activeCameraMode === 'film_strip_developing') {
        return '[E] Continue · [Space] Skip';
      }
      if (this.activeCameraMode === 'film_strip_inspect') {
        return (
          '[E] Finish Looking · [K] Keep Memory · [F] ' +
          (this.isFilmCloseUpView ? 'Full Strip' : 'Close-Up')
        );
      }
      if (this.activeCameraMode === 'portrait_atelier') {
        return (
          '[C] Take Portrait · [1-6] Backdrop (' +
          BACKDROP_NAMES[this.activeBackdropIndex] +
          ') · [E] Exit Camera'
        );
      }
      if (this.activeCameraMode === 'couture_boutique') {
        return this.jewelleryAtelier.getProximityPrompt(lx, lz, true);
      }
      return '[G] Enter Our Little Kingdom · [E] Finish Looking';
    }

    // Room 1: Portrait Atelier (lx in [8.8, 15.3], lz in [-14.8, -6.4])
    if (lx >= 8.8 && lx <= 15.3 && lz >= -14.8 && lz <= -6.4) {
      // Near Physical Custom Backdrop Case (South-West wall at lx = 10.2, lz = -14.1)
      if (Math.hypot(lx - 10.2, lz - (-14.1)) <= 1.25) {
        return '[E] Place Personal Backdrop · [1-6] Switch Studio Backdrop';
      }
      // Near Wall-Mounted Memory Film Display (North wall at lx = 9.75, lz = -6.62)
      if (Math.hypot(lx - 9.75, lz - (-6.85)) <= 1.35) {
        return '[E] Inspect Film · [K] Keep Memory';
      }
      // Near Portrait Position Marker (lx = 13.55, lz = -10.6) or Last Photo Memory Marker
      const nearLastMarker =
        this.lastPhotoCaptureContext &&
        Math.hypot(
          playerPos.x - this.lastPhotoCaptureContext.worldPosition.x,
          playerPos.z - this.lastPhotoCaptureContext.worldPosition.z,
        ) <= 0.95;
      if (Math.hypot(lx - 13.55, lz - (-10.6)) <= 1.25 || nearLastMarker) {
        return '[E] Take Portrait · [1-6] Switch Backdrop · [I] Inspect Film';
      }
      if (this.filmStripStage === 'developed_ready_to_inspect') {
        return '[E] Inspect Film · [K] Keep Memory · [C] Take Portrait';
      }
      return '[E] Use Portrait Camera · [C] Take Portrait · [I] Inspect Film';
    }

    // Room 2: Jewellery Atelier / Couture Corner (lx in [8.8, 15.3], lz in [-5.8, +5.8])
    if (lx >= 8.8 && lx <= 15.3 && lz >= -5.8 && lz <= 5.8) {
      return this.jewelleryAtelier.getProximityPrompt(lx, lz, false);
    }

    // Room 3: Doll Playroom & Tabletop Castle (lx in [9.2, 15.3], lz in [6.4, 14.8])
    if (lx >= 9.2 && lx <= 15.3 && lz >= 6.4 && lz <= 14.8) {
      if (this.tabletopWorld.isNearTabletopGate(lx, lz)) {
        return '[E] Enter Our Little Kingdom';
      }
      if (Math.hypot(lx - 12.85, lz - 11.85) <= 2.35) {
        return '[E] Inspect Our Little Kingdom · Walk to Front Gate for [E] Enter Our Little Kingdom';
      }
      return 'Walk to Tabletop Castle for [E] Enter Our Little Kingdom';
    }

    return null;
  }

  public getActiveRoomCaption(): string | null {
    return (
      this.tabletopWorld.getStoryCaption() ??
      this.jewelleryAtelier.getStatusCaption() ??
      this.activeCaption
    );
  }

  public interact(playerPos: THREE.Vector3): boolean {
    if (this.tabletopWorld.isTransitionActive()) {
      if (this.tabletopWorld.getCurrentDialogue() !== null) {
        return true;
      }
      return this.tabletopWorld.advanceOrContinueCinematic();
    }
    if (this.jewelleryAtelier.isCinematicActive()) {
      return this.jewelleryAtelier.advanceOrContinueCinematic();
    }
    if (this.activeCameraMode === 'return_to_capture_location') {
      this.returnTransitionElapsed = this.RETURN_TO_CAPTURE_DUR;
      this.activeCameraMode = 'none';
      return true;
    }
    if (this.activeCameraMode === 'film_strip_developing') {
      const jumpPoints = [2.8, 6.0, 7.8, 10.2, 13.4, this.FILM_DEVELOP_TOTAL_DUR];
      const nextPt = jumpPoints.find((pt) => pt > this.filmStripDevelopElapsed + 0.35);
      if (nextPt === undefined || nextPt >= this.FILM_DEVELOP_TOTAL_DUR) {
        this.exitActiveCameraMode();
      } else {
        this.filmStripDevelopElapsed = nextPt;
      }
      return true;
    }

    if (this.activeCameraMode !== 'none') {
      // Section 27: Inside Portrait Camera (`[E] Exit Camera`) or Film Inspection (`[E] Finish Looking`),
      // pressing [E] cleanly exits and returns to exploration / LastPhotoCaptureContext.
      this.exitActiveCameraMode();
      return true;
    }

    const lx = playerPos.x - this.originX;
    const lz = playerPos.z - this.originZ;
    const relY = playerPos.y - (this.baseY + this.y0);
    if (Math.abs(relY) > 1.6) return false;

    // Inside Little Dream World: [E] near Golden Yeshwanth replays the Rose & Message story; near Gate returns to Doll Playroom
    if (this.tabletopWorld.isInsideLittleDreamWorld || Math.hypot(lx - 33.0, lz - 12.0) <= 8.5) {
      if (this.tabletopWorld.isNearGoldenYeshwanth(lx, lz)) {
        return this.tabletopWorld.triggerReplayGoldenYeshwanthStory();
      }
      return this.tabletopWorld.triggerExitLittleDreamWorld();
    }

    // Room 1: Portrait Atelier
    if (lx >= 8.8 && lx <= 15.3 && lz >= -14.8 && lz <= -6.4) {
      // Physical Custom Backdrop Case at (lx = 10.2, lz = -14.1): `[E] Place Personal Backdrop`
      if (Math.hypot(lx - 10.2, lz - (-14.1)) <= 1.25) {
        this.openCustomBackdropPickerCallback?.();
        return true;
      }
      // Wall-Mounted Memory Film Display at (lx = 9.75, lz = -6.85): `[E] Inspect Film`
      if (Math.hypot(lx - 9.75, lz - (-6.85)) <= 1.35) {
        return this.inspectFilmStrip();
      }
      // Portrait Position Marker (lx = 13.55, lz = -10.6) or Last Photo Memory Marker: `[E] Take Portrait`
      const nearLastMarker =
        this.lastPhotoCaptureContext &&
        Math.hypot(
          playerPos.x - this.lastPhotoCaptureContext.worldPosition.x,
          playerPos.z - this.lastPhotoCaptureContext.worldPosition.z,
        ) <= 0.95;
      if (Math.hypot(lx - 13.55, lz - (-10.6)) <= 1.25 || nearLastMarker) {
        return this.triggerTakePortrait();
      }
      if (this.filmStripStage === 'developed_ready_to_inspect') {
        return this.inspectFilmStrip();
      }
      this.activeCameraMode = 'portrait_atelier';
      this.cameraTransitionElapsed = 0.0;
      this.camLookYaw = 0.0;
      this.camLookPitch = 0.0;
      return true;
    }

    // Room 2: Jewellery Atelier / Couture Corner
    if (lx >= 8.8 && lx <= 15.3 && lz >= -5.8 && lz <= 5.8) {
      const res = this.jewelleryAtelier.interactAtPosition(lx, lz);
      this.activeCaption = res.caption;
      if (res.enterInspect) {
        this.activeCameraMode = 'couture_boutique';
        this.cameraTransitionElapsed = 0.0;
        this.camLookYaw = 0.0;
        this.camLookPitch = 0.0;
      }
      return true;
    }

    // Room 3: Doll Playroom & Tabletop Castle
    if (lx >= 9.2 && lx <= 15.3 && lz >= 6.4 && lz <= 14.8) {
      if (this.tabletopWorld.isNearTabletopGate(lx, lz)) {
        return this.tabletopWorld.triggerEnterLittleDreamWorld();
      }
      this.activeCameraMode = 'doll_playroom';
      this.cameraTransitionElapsed = 0.0;
      this.camLookYaw = 0.0;
      this.camLookPitch = 0.0;
      return true;
    }

    return false;
  }

  public handleKeyAction(key: string): boolean {
    const lower = key.toLowerCase();
    const onFloor2 = Math.abs(this.lastPlayerRelY) <= 1.6;
    const inPortraitRoom =
      this.activeCameraMode === 'portrait_atelier' ||
      this.activeCameraMode === 'film_strip_developing' ||
      this.activeCameraMode === 'film_strip_inspect' ||
      (onFloor2 &&
        this.lastPlayerLx >= 8.8 &&
        this.lastPlayerLx <= 15.3 &&
        this.lastPlayerLz >= -14.8 &&
        this.lastPlayerLz <= -6.4);
    const inJewelleryRoom =
      this.activeCameraMode === 'couture_boutique' ||
      (onFloor2 &&
        this.lastPlayerLx >= 8.8 &&
        this.lastPlayerLx <= 15.3 &&
        this.lastPlayerLz >= -5.8 &&
        this.lastPlayerLz <= 5.8);
    const inDollRoom =
      this.activeCameraMode === 'doll_playroom' ||
      (onFloor2 &&
        this.lastPlayerLx >= 9.2 &&
        this.lastPlayerLx <= 15.3 &&
        this.lastPlayerLz >= 6.4 &&
        this.lastPlayerLz <= 14.8);

    // Section 21: Allow [Space] to skip non-dialogue romantic cinematics cleanly (active dialogue uses Esc)
    if (key === ' ') {
      if (this.tabletopWorld.isTransitionActive()) {
        if (this.tabletopWorld.getCurrentDialogue() !== null) {
          return true;
        }
        return this.tabletopWorld.skipCinematic();
      }
      if (this.jewelleryAtelier.isCinematicActive()) {
        return this.jewelleryAtelier.skipCinematic();
      }
      if (this.activeCameraMode === 'film_strip_developing') {
        this.exitActiveCameraMode();
        return true;
      }
    }

    // Portrait Atelier shortcuts (work both in studio and in portrait/film camera modes)
    if (inPortraitRoom) {
      if (lower === 'c' || (this.activeCameraMode === 'portrait_atelier' && key === ' ')) {
        return this.triggerTakePortrait();
      }
      if (lower === 'i') {
        return this.inspectFilmStrip();
      }
      if (lower === 'k') {
        return this.keepCapturedMemory();
      }
      if (lower === 'f' && this.activeCameraMode === 'film_strip_inspect') {
        this.isFilmCloseUpView = !this.isFilmCloseUpView;
        return true;
      }
      const num = parseInt(key, 10);
      if (!isNaN(num) && num >= 1 && num <= 6) {
        this.activeBackdropIndex = num - 1;
        this.previousPresetIndex = this.activeBackdropIndex;
        this.backdropScreenMat.map = this.backdropTextures[this.activeBackdropIndex];
        this.backdropScreenMat.needsUpdate = true;
        return true;
      }
      if (num === 7 && this.hasCustomBackdrop) {
        this.activeBackdropIndex = 6;
        this.backdropScreenMat.map = this.backdropTextures[6];
        this.backdropScreenMat.needsUpdate = true;
        return true;
      }
    }

    // Jewellery Atelier shortcuts: [1] Try/Remove Ring, [2] Try/Remove Necklace, [3] Try/Remove Crown, [M] Mirror
    if (inJewelleryRoom) {
      if (key === '1') {
        this.activeCaption = this.jewelleryAtelier.toggleRing();
        return true;
      }
      if (key === '2') {
        this.activeCaption = this.jewelleryAtelier.toggleNecklace();
        return true;
      }
      if (key === '3') {
        this.activeCaption = this.jewelleryAtelier.toggleCrown();
        return true;
      }
      if (lower === 'm') {
        this.activeCaption = this.jewelleryAtelier.triggerMirrorCinematic();
        return true;
      }
    }

    // Doll Playroom shortcut: [G] Enter Our Little Castle from tabletop inspect or room
    if (inDollRoom && lower === 'g') {
      this.exitActiveCameraMode();
      return this.tabletopWorld.triggerEnterLittleDreamWorld();
    }

    return false;
  }

  /**
   * Sections 38–42: Full 360° unrestricted horizontal look (`camLookYaw` wraps around `[-π, +π]`)
   * and smooth vertical pitch (`[-0.78, +0.78]`) during all Creative Wing inspection modes.
   */
  public applyLookDelta(deltaYaw: number, deltaPitch: number): void {
    let nextYaw = this.camLookYaw + deltaYaw;
    while (nextYaw > Math.PI) nextYaw -= Math.PI * 2;
    while (nextYaw < -Math.PI) nextYaw += Math.PI * 2;
    this.camLookYaw = nextYaw;
    this.camLookPitch = THREE.MathUtils.clamp(this.camLookPitch + deltaPitch, -0.78, 0.78);
  }

  public update(
    delta: number,
    clockTime: number,
    playerPos: THREE.Vector3,
    inputKeys?: Set<string>,
  ): void {
    this.lastPlayerLx = playerPos.x - this.originX;
    this.lastPlayerLz = playerPos.z - this.originZ;
    this.lastPlayerRelY = playerPos.y - (this.baseY + this.y0);

    if (this.memoryKeptNoticeTimer > 0) {
      this.memoryKeptNoticeTimer = Math.max(0, this.memoryKeptNoticeTimer - delta);
    }

    // Subtle rotation shimmer on Physical Portrait Memory Marker when visible
    if (this.lastPhotoMemoryMarkerGroup && this.lastPhotoMemoryMarkerGroup.visible) {
      this.lastPhotoMemoryMarkerGroup.rotation.y = Math.sin(clockTime * 1.4) * 0.08;
    }

    if (this.activeCameraMode === 'return_to_capture_location') {
      this.returnTransitionElapsed += delta;
      if (this.returnTransitionElapsed >= this.RETURN_TO_CAPTURE_DUR) {
        this.activeCameraMode = 'none';
        this.cameraTransitionElapsed = 0.0;
        this.camLookYaw = 0.0;
        this.camLookPitch = 0.0;
      }
    } else if (this.activeCameraMode !== 'none') {
      this.cameraTransitionElapsed = Math.min(
        this.CAMERA_TRANSITION_DUR,
        this.cameraTransitionElapsed + delta,
      );
      if (inputKeys && this.activeCameraMode !== 'film_strip_developing') {
        if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') || inputKeys.has('KeyQ')) {
          this.applyLookDelta(-delta * 1.45, 0);
        }
        if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') || inputKeys.has('KeyR')) {
          this.applyLookDelta(delta * 1.45, 0);
        }
        if (inputKeys.has('KeyW') || inputKeys.has('ArrowUp')) {
          this.applyLookDelta(0, delta * 1.05);
        }
        if (inputKeys.has('KeyS') || inputKeys.has('ArrowDown')) {
          this.applyLookDelta(0, -delta * 1.05);
        }
      }
    }

    // Animate Camera Shutter Lens Focus Ring & LED Indicator
    if (this.cameraShutterAnimTimer > 0) {
      this.cameraShutterAnimTimer = Math.max(0, this.cameraShutterAnimTimer - delta);
      const sProg = 1.0 - this.cameraShutterAnimTimer / 0.85;
      this.cameraFocusRingMesh.rotation.z = Math.sin(sProg * Math.PI * 2) * 0.45;
      this.cameraFocusRingMesh.position.z = 0.22 - Math.sin(sProg * Math.PI) * 0.025;
      this.cameraLedMat.emissiveIntensity = 1.5 + Math.sin(sProg * Math.PI * 6) * 2.5;
    } else if (this.cameraLedMat) {
      this.cameraLedMat.emissiveIntensity = 1.2 + Math.sin(clockTime * 3.0) * 0.3;
    }

    // =========================================================================
    // SECTIONS 5, 6 & 12: PORTRAIT ATELIER + FILM STRIP + RETURN UPDATE (0..15.2s)
    // =========================================================================
    if (this.filmStripStage === 'developing') {
      this.filmStripDevelopElapsed += delta;
      const pT = this.filmStripDevelopElapsed;

      // Subtle focus ring adjustment during Phase A (0.8s..2.4s) and Phase C lock (6.0s..6.35s)
      if ((pT >= 0.8 && pT <= 2.4) || (pT >= 6.0 && pT <= 6.35)) {
        this.cameraFocusRingMesh.rotation.z = Math.sin(pT * 5.0) * 0.32;
      }

      // Trigger Shutter Sound, Soft Flash Curve & Canvas Capture at 6.35s (Phase C)
      if (pT >= 6.35 && !this.shutterFiredForCurrentCapture) {
        this.shutterFiredForCurrentCapture = true;
        this.playShutterSound();
        this.cameraShutterAnimTimer = 0.85;
        this.executePortraitCanvasCapture();
      }

      // Phase C Soft Studio Flash Curve (6.25s -> 6.95s):
      if (pT >= 6.25 && pT <= 6.95) {
        this.shutterFlashMesh.visible = true;
        let flashOpacity = 0.0;
        if (pT < 6.38) {
          flashOpacity = smoothStep01((pT - 6.25) / 0.13) * 0.45;
        } else if (pT < 6.5) {
          flashOpacity = THREE.MathUtils.lerp(0.45, 0.88, (pT - 6.38) / 0.12);
        } else {
          flashOpacity = (1.0 - smoothStep01((pT - 6.5) / 0.45)) * 0.88;
        }
        this.shutterFlashMat.opacity = flashOpacity;
      } else {
        this.shutterFlashMesh.visible = false;
      }

      // Section 12 Steps 4 & 5: Film strip emerges near studio camera (7.8s) and glides onto the North-Wall Memory Film Display clips (9.8s)
      const slideT = smoothStep01(THREE.MathUtils.clamp((pT - 7.8) / 2.0, 0, 1));
      this.heroFilmStripGroup.position.set(
        THREE.MathUtils.lerp(-0.85, 0.0, slideT),
        THREE.MathUtils.lerp(1.48, 1.38, slideT),
        THREE.MathUtils.lerp(3.2, 0.03, slideT),
      );
      this.heroFilmStripGroup.rotation.set(
        THREE.MathUtils.lerp(0.08, 0.0, slideT),
        THREE.MathUtils.lerp(0.18, 0.0, slideT),
        THREE.MathUtils.lerp(0.04, 0.0, slideT),
      );

      // Section 12 Step 6: Gradual photographic development (9.0s -> 12.2s)
      const devProgress = THREE.MathUtils.clamp((pT - 9.0) / 3.2, 0, 1);
      const bucket = Math.round(devProgress * 28);
      if (bucket !== this.lastRedrawnDevelopBucket) {
        this.lastRedrawnDevelopBucket = bucket;
        this.drawFilmStripCanvas(devProgress);
      }

      this.filmRackLightMat.emissiveIntensity = 1.65 + Math.sin(clockTime * 6.0) * 0.35;

      // Section 12 Step 8: At 13.4s, queue player pose restoration to LastPhotoCaptureContext
      if (pT >= 13.4 && !this.pendingPhotoReturn && this.lastPhotoCaptureContext) {
        this.pendingPhotoReturn = true;
        this.avatarBridge?.resetNeutralPose?.();
      }

      // Section 12 Step 9: Gentle Release -> Return to Exploration at LastPhotoCaptureContext!
      if (pT >= this.FILM_DEVELOP_TOTAL_DUR) {
        this.drawFilmStripCanvas(1.0);
        this.heroFilmStripGroup.position.set(0, 1.38, 0.03);
        this.heroFilmStripGroup.rotation.set(0, 0, 0);
        this.shutterFlashMesh.visible = false;
        this.filmStripStage = 'developed_ready_to_inspect';
        this.avatarBridge?.resetNeutralPose?.();
        this.activeCameraMode = 'none';
        this.cameraTransitionElapsed = 0.0;
        this.camLookYaw = 0.0;
        this.camLookPitch = 0.0;
        if (this.lastPhotoCaptureContext) {
          this.pendingPhotoReturn = true;
        }
      }
    } else if (this.filmRackLightMat) {
      this.filmRackLightMat.emissiveIntensity = 1.35 + Math.sin(clockTime * 2.4) * 0.15;
    }

    // Update Jewellery Atelier & Tabletop Castle / Little Dream World subsystems
    this.jewelleryAtelier.update(delta, clockTime);
    this.tabletopWorld.update(delta, clockTime, playerPos);

    // Gentle continuous rotation of miniature windmill in doll room
    this.windmillBlades.rotation.z = (this.windmillBlades.rotation.z + delta * 1.8) % (Math.PI * 2);

    // Subtle breathing pulse on creative wing warm light
    this.wingLight.intensity = 0.85 + Math.sin(clockTime * 1.5) * 0.12;
  }
}

export function createCastleFloor2CreativeWing(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CreativeWing {
  return new CreativeWing(tracker, mats, originX, baseY, originZ);
}
