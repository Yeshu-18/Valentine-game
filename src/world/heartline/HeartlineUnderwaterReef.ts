import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ResourceTracker } from '../ProceduralKit';
import {
  HeartlineTrackSpline,
  createEmptyTrackFrame,
} from './HeartlineTrackSpline';

export interface HeartlineUnderwaterReef {
  readonly group: THREE.Group;
  update: (
    dt: number,
    elapsedTime: number,
    leadU: number,
    isPlayerRiding: boolean
  ) => void;
  dispose: () => void;
}

interface ReefTextStage {
  u: number;
  line1: string;
  line2?: string;
  showHeartBelow: boolean;
  isGrandHeartline?: boolean;
  heightOffset: number;
  width: number;
  height: number;
  mesh?: THREE.Mesh;
  mat?: THREE.MeshBasicMaterial;
}

interface FishInstanceData {
  baseU: number;
  schoolIdx: number;
  lateralOffset: number;
  vertOffset: number;
  speedU: number;
  phase: number;
  scale: number;
  isStripedTang: boolean;
}

interface JellyfishInstanceData {
  x: number;
  baseY: number;
  z: number;
  phase: number;
  speed: number;
  scale: number;
  isPink: boolean;
}

interface BubbleInstanceData {
  x: number;
  baseY: number;
  z: number;
  speed: number;
  phase: number;
  radius: number;
}

interface SeaTurtleRig {
  root: THREE.Group;
  leftFlipper: THREE.Mesh;
  rightFlipper: THREE.Mesh;
  centerX: number;
  centerY: number;
  centerZ: number;
  orbitRadiusX: number;
  orbitRadiusZ: number;
  speed: number;
  phase: number;
}

interface LightRayRig {
  mesh: THREE.Mesh;
  baseOpacity: number;
  phase: number;
}

const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchColor = new THREE.Color();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _surfaceFogColor = new THREE.Color('#e8b89a');
const _underwaterFogColor = new THREE.Color('#04437a');

function createGlowingRomanticTextTexture(
  tracker: ResourceTracker,
  line1: string,
  line2?: string,
  showHeartBelow = true,
  isGrandHeartline = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle soft radial bioluminescent aura behind the cursive calligraphy
    const radGrad = ctx.createRadialGradient(512, 235, 20, 512, 235, 420);
    if (isGrandHeartline) {
      radGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.28)');
      radGrad.addColorStop(0.45, 'rgba(244, 63, 94, 0.16)');
      radGrad.addColorStop(1.0, 'rgba(2, 132, 199, 0.0)');
    } else {
      radGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.22)');
      radGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.12)');
      radGrad.addColorStop(1.0, 'rgba(2, 132, 199, 0.0)');
    }
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isGrandHeartline) {
      // Grand T+23s "I LOVE YOU ❤️" Centerpiece matching the reference panel
      ctx.save();
      ctx.font = 'italic bold 108px "Georgia", "Times New Roman", serif';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 34;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText('I LOVE YOU', 435, 250);

      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 3;
      ctx.strokeText('I LOVE YOU', 435, 250);
      ctx.restore();

      // Glowing Neon Rose-Pink Heart Icon on the right of "I LOVE YOU"
      ctx.save();
      ctx.translate(825, 212);
      ctx.scale(1.45, 1.45);
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.bezierCurveTo(0, -12, -38, -22, -38, 8);
      ctx.bezierCurveTo(-38, 32, 0, 50, 0, 68);
      ctx.bezierCurveTo(0, 50, 38, 32, 38, 8);
      ctx.bezierCurveTo(38, -22, 0, -12, 0, 15);
      ctx.closePath();

      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 32;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.fill();
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = '#fda4af';
      ctx.stroke();
      ctx.restore();
    } else {
      const fontSize = line2 ? 76 : 86;
      const y1 = line2 ? 175 : 215;
      const y2 = 268;

      // Outer Cyan-Lavender Neon Glow Pass
      ctx.save();
      ctx.font = `italic bold ${fontSize}px "Georgia", "Palatino Linotype", serif`;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#f0f9ff';
      ctx.fillText(line1, 512, y1);
      if (line2) {
        ctx.fillText(line2, 512, y2);
      }

      // Crisp Inner Pearl-White Calligraphy Pass
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line1, 512, y1);
      if (line2) {
        ctx.fillText(line2, 512, y2);
      }
      ctx.restore();

      if (showHeartBelow) {
        const heartY = line2 ? 345 : 310;
        ctx.save();
        ctx.translate(512, heartY);
        ctx.scale(0.95, 0.95);
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.bezierCurveTo(0, -10, -30, -18, -30, 6);
        ctx.bezierCurveTo(-30, 26, 0, 40, 0, 54);
        ctx.bezierCurveTo(0, 40, 30, 26, 30, 6);
        ctx.bezierCurveTo(30, -18, 0, -10, 0, 12);
        ctx.closePath();

        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 24;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#e0f2fe';
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCausticFloorTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#072a4f';
    ctx.fillRect(0, 0, 512, 512);

    // Intersecting Voronoi-like bright aqua caustic web cells
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 36; i++) {
      const cx = ((i * 97) % 480) + 16;
      const cy = ((i * 151) % 480) + 16;
      const r = 36 + (i % 5) * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const cx = ((i * 131 + 40) % 480) + 16;
      const cy = ((i * 83 + 60) % 480) + 16;
      const r = 24 + (i % 4) * 14;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 6);
  tex.needsUpdate = true;
  return tex;
}

function createStripedFishTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Iconic Reference Image Tropical Fish: Golden-Yellow Nose, Tail & Dorsal with Royal-Blue & White Vertical Bands!
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.0, '#facc15'); // Bright yellow tail
    grad.addColorStop(0.22, '#2563eb'); // Royal blue rear band
    grad.addColorStop(0.45, '#e0f2fe'); // Pearl white center stripe
    grad.addColorStop(0.68, '#1d4ed8'); // Deep sapphire front band
    grad.addColorStop(0.86, '#fde047'); // Bright yellow face/nose
    grad.addColorStop(1.0, '#eab308');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Top & bottom yellow fin trim
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 18);
    ctx.fillRect(0, 110, 256, 18);
  }
  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildBranchingCoralGeometry(): THREE.BufferGeometry {
  // Multi-branch Y-forking Staghorn / Acropora Coral cluster
  const stem = new THREE.CylinderGeometry(0.12, 0.22, 1.25, 7);
  stem.translate(0, 0.62, 0);

  const b1 = new THREE.ConeGeometry(0.15, 1.15, 7);
  b1.translate(0, 0.55, 0);
  b1.rotateZ(0.48);
  b1.rotateY(0.4);
  b1.translate(0, 0.85, 0);

  const b2 = new THREE.ConeGeometry(0.14, 1.1, 7);
  b2.translate(0, 0.52, 0);
  b2.rotateZ(-0.52);
  b2.rotateY(1.9);
  b2.translate(0, 0.82, 0);

  const b3 = new THREE.ConeGeometry(0.13, 0.95, 7);
  b3.translate(0, 0.46, 0);
  b3.rotateX(0.5);
  b3.rotateY(-1.2);
  b3.translate(0, 0.78, 0);

  const b4 = new THREE.ConeGeometry(0.11, 0.85, 6);
  b4.translate(0, 0.42, 0);
  b4.rotateX(-0.42);
  b4.translate(0, 1.05, 0);

  const merged = mergeGeometries([stem, b1, b2, b3, b4], false);
  stem.dispose();
  b1.dispose();
  b2.dispose();
  b3.dispose();
  b4.dispose();
  return merged;
}

function buildTubeSpongeGeometry(): THREE.BufferGeometry {
  // Clustered Organ-Pipe / Tube Sponge Coral
  const t1 = new THREE.CylinderGeometry(0.18, 0.14, 1.45, 8);
  t1.translate(-0.18, 0.72, 0.08);
  t1.rotateZ(0.12);

  const t2 = new THREE.CylinderGeometry(0.21, 0.16, 1.75, 8);
  t2.translate(0.12, 0.86, -0.1);
  t2.rotateZ(-0.08);

  const t3 = new THREE.CylinderGeometry(0.15, 0.12, 1.15, 8);
  t3.translate(0.05, 0.56, 0.22);
  t3.rotateX(0.15);

  const t4 = new THREE.CylinderGeometry(0.14, 0.11, 0.95, 8);
  t4.translate(-0.22, 0.46, -0.18);
  t4.rotateX(-0.14);

  const merged = mergeGeometries([t1, t2, t3, t4], false);
  t1.dispose();
  t2.dispose();
  t3.dispose();
  t4.dispose();
  return merged;
}

function buildTropicalFishGeometry(): THREE.BufferGeometry {
  // Sculpted Tropical Angelfish / Tang (oriented along +Z forward)
  const body = new THREE.SphereGeometry(0.32, 12, 10);
  body.scale(0.32, 0.78, 1.25);

  const dorsalFin = new THREE.ConeGeometry(0.18, 0.42, 4);
  dorsalFin.scale(0.18, 1.0, 1.3);
  dorsalFin.rotateX(-0.55);
  dorsalFin.translate(0, 0.24, -0.06);

  const ventralFin = new THREE.ConeGeometry(0.15, 0.34, 4);
  ventralFin.scale(0.18, 1.0, 1.1);
  ventralFin.rotateX(-Math.PI + 0.55);
  ventralFin.translate(0, -0.22, -0.08);

  const tailFin = new THREE.ConeGeometry(0.24, 0.38, 4);
  tailFin.scale(0.16, 1.15, 0.85);
  tailFin.rotateX(Math.PI / 2);
  tailFin.translate(0, 0, -0.46);

  const merged = mergeGeometries([body, dorsalFin, ventralFin, tailFin], false);
  body.dispose();
  dorsalFin.dispose();
  ventralFin.dispose();
  tailFin.dispose();
  return merged;
}

function buildJellyfishGeometry(): THREE.BufferGeometry {
  // Translucent pulsing bell + trailing oral arms/tentacles
  const bell = new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  bell.scale(1.0, 0.88, 1.0);
  bell.translate(0, 0.15, 0);

  const innerCore = new THREE.SphereGeometry(0.32, 10, 8);
  innerCore.translate(0, 0.1, 0);

  const parts: THREE.BufferGeometry[] = [bell, innerCore];
  for (let t = 0; t < 6; t++) {
    const ang = (t / 6) * Math.PI * 2;
    const r = 0.26;
    const tentacle = new THREE.CylinderGeometry(0.025, 0.008, 1.35, 5);
    tentacle.translate(Math.cos(ang) * r, -0.52, Math.sin(ang) * r);
    parts.push(tentacle);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export function createHeartlineUnderwaterReef(
  spline: HeartlineTrackSpline,
  tracker: ResourceTracker
): HeartlineUnderwaterReef {
  const group = new THREE.Group();
  group.name = 'HeartlineUnderwaterCoralReef';

  const sampleFrame = createEmptyTrackFrame();

  // ============================================================================
  // 1. SHARED REEF & MARINE MATERIALS
  // ============================================================================
  const reefRockMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x0d2847,
      emissive: 0x06182e,
      emissiveIntensity: 0.35,
      roughness: 0.78,
      metalness: 0.08,
    })
  );

  const causticFloorTex = createCausticFloorTexture(tracker);
  const causticSeabedMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: causticFloorTex,
      emissiveMap: causticFloorTex,
      color: 0x0ea5e9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.52,
      roughness: 0.45,
      metalness: 0.05,
    })
  );

  const staghornCoralMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.28,
      roughness: 0.38,
      metalness: 0.06,
    })
  );

  const tubeSpongeMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xc084fc,
      emissiveIntensity: 0.32,
      roughness: 0.42,
      metalness: 0.05,
    })
  );

  const brainCoralMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.26,
      roughness: 0.48,
      metalness: 0.05,
    })
  );

  const heartCoralArchMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.46,
      roughness: 0.34,
      metalness: 0.08,
    })
  );

  const heartCoralVioletMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.45,
      roughness: 0.34,
      metalness: 0.08,
    })
  );

  const glowingHeartlineBlueMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.35,
      roughness: 0.14,
      metalness: 0.25,
    })
  );

  const glowingHeartlinePinkMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 1.25,
      roughness: 0.16,
      metalness: 0.2,
    })
  );

  const stripedFishTex = createStripedFishTexture(tracker);
  const stripedTangFishMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: stripedFishTex,
      emissiveMap: stripedFishTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.32,
      roughness: 0.25,
      metalness: 0.12,
    })
  );

  const coralAnthiasFishMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.42,
      roughness: 0.25,
      metalness: 0.1,
    })
  );

  const jellyfishMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xa855f7,
      emissiveIntensity: 0.78,
      roughness: 0.15,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
    })
  );

  const bubbleMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.72,
    })
  );

  const turtleShellMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      emissive: 0x0d9488,
      emissiveIntensity: 0.22,
      roughness: 0.38,
      metalness: 0.12,
    })
  );

  const turtleSkinMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.18,
      roughness: 0.45,
    })
  );

  // ============================================================================
  // 2. CAUSTIC SEABED FLOOR, WATER-ENTRY / EXIT SPLASH RINGS & ATMOSPHERE HOOK
  // ============================================================================
  let currentImmersionAlpha = 0;

  const seabedGeo = tracker.track(new THREE.PlaneGeometry(66, 32, 24, 16));
  seabedGeo.rotateX(-Math.PI / 2);
  const seabedMesh = new THREE.Mesh(seabedGeo, causticSeabedMat);
  seabedMesh.position.set(112.0, -5.95, 79.0);
  seabedMesh.receiveShadow = true;

  // Apply scene fog underwater sapphire tint right before rendering when the rider is submerged
  seabedMesh.onBeforeRender = (_renderer, scene) => {
    if (currentImmersionAlpha > 0.001 && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerpColors(
        _surfaceFogColor,
        _underwaterFogColor,
        currentImmersionAlpha
      );
      scene.fog.density = THREE.MathUtils.lerp(
        0.0018,
        0.0068,
        currentImmersionAlpha
      );
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(scene.fog.color);
      }
    }
  };
  group.add(seabedMesh);

  // Shimmering Water-Surface Plunge & Breach Splash Portals at Y = 0.05m (u = 0.553 and u = 0.778)
  const splashRingGeo = tracker.track(new THREE.TorusGeometry(3.2, 0.28, 10, 28));
  splashRingGeo.rotateX(Math.PI / 2);
  const splashFoamMat = tracker.track(
    new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.72,
    })
  );

  for (const portalU of [0.553, 0.778]) {
    spline.evaluateAtU(portalU, sampleFrame);
    const splashRing = new THREE.Mesh(splashRingGeo, splashFoamMat);
    splashRing.position.set(sampleFrame.pos.x, 0.06, sampleFrame.pos.z);
    group.add(splashRing);

    const outerRipple = new THREE.Mesh(
      tracker.track(new THREE.RingGeometry(3.3, 4.8, 28)),
      tracker.track(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
        })
      )
    );
    outerRipple.rotation.x = -Math.PI / 2;
    outerRipple.position.set(sampleFrame.pos.x, 0.04, sampleFrame.pos.z);
    group.add(outerRipple);
  }

  // ============================================================================
  // 3. SUBMERGED REEF CANYON WALL BOULDERS & CORAL GARDENS (INSTANCED)
  // ============================================================================
  const coralPaletteHex = [
    0xfb7185, // Warm Rose Pink
    0xfb923c, // Coral Sunset Orange
    0xc084fc, // Dream Lavender
    0x38bdf8, // Luminous Aqua
    0xf472b6, // Pastel Magenta
    0x22d3ee, // Electric Cyan
    0xfbbf24, // Golden Reef Amber
    0x818cf8, // Periwinkle Indigo
  ];

  const rockTransforms: { pos: THREE.Vector3; scale: THREE.Vector3; rotY: number }[] = [];
  const staghornEntries: { pos: THREE.Vector3; scale: THREE.Vector3; rot: THREE.Euler; color: number }[] = [];
  const spongeEntries: { pos: THREE.Vector3; scale: THREE.Vector3; rot: THREE.Euler; color: number }[] = [];
  const brainEntries: { pos: THREE.Vector3; scale: THREE.Vector3; color: number }[] = [];

  // Sample along the underwater track (u = 0.548..0.772) and build dense coral banks on both sides
  const REEF_STEPS = 72;
  for (let i = 0; i < REEF_STEPS; i++) {
    const frac = i / (REEF_STEPS - 1);
    const u = 0.548 + frac * 0.224;
    spline.evaluateAtU(u, sampleFrame);

    for (const side of [-1, 1]) {
      const seed = i * 17 + (side > 0 ? 7 : 3);

      // Inner Reef Garden Bank (3.4m to 5.6m from track centerline — safely clear of 2.6m train envelope)
      const innerDist = 3.4 + ((seed * 13) % 22) * 0.1;
      const bankPos = new THREE.Vector3()
        .copy(sampleFrame.pos)
        .addScaledVector(sampleFrame.binormal, side * innerDist);
      const bedY = Math.min(sampleFrame.pos.y - 0.55, -4.6) + ((seed % 5) - 2) * 0.18;
      bankPos.y = bedY;

      // 1. Reef Canyon Rock Base Mound
      rockTransforms.push({
        pos: bankPos.clone().add(new THREE.Vector3(0, -0.35, 0)),
        scale: new THREE.Vector3(
          1.4 + (seed % 4) * 0.35,
          1.1 + (seed % 3) * 0.45,
          1.4 + ((seed + 2) % 4) * 0.35
        ),
        rotY: (seed * 0.7) % (Math.PI * 2),
      });

      // 2. Branching Staghorn Coral atop the rock bank
      const c1 = coralPaletteHex[seed % coralPaletteHex.length];
      const s1 = 1.05 + (seed % 5) * 0.24;
      staghornEntries.push({
        pos: bankPos.clone().add(new THREE.Vector3(0, 0.25, 0)),
        scale: new THREE.Vector3(s1, s1 * 1.15, s1),
        rot: new THREE.Euler(
          ((seed % 3) - 1) * 0.12,
          seed * 1.1,
          -side * 0.18
        ),
        color: c1,
      });

      // 3. Tube Sponges & Brain Corals interspersed along the reef
      if (i % 2 === 0) {
        const c2 = coralPaletteHex[(seed + 3) % coralPaletteHex.length];
        const spongePos = bankPos
          .clone()
          .addScaledVector(sampleFrame.binormal, side * 1.1)
          .addScaledVector(sampleFrame.tangent, 0.55);
        spongeEntries.push({
          pos: spongePos,
          scale: new THREE.Vector3(1.1, 1.2 + (seed % 3) * 0.3, 1.1),
          rot: new THREE.Euler(0, seed * 0.8, -side * 0.1),
          color: c2,
        });
      } else {
        const c3 = coralPaletteHex[(seed + 5) % coralPaletteHex.length];
        const brainPos = bankPos
          .clone()
          .addScaledVector(sampleFrame.binormal, -side * 0.45)
          .add(new THREE.Vector3(0, 0.15, 0));
        const bs = 0.75 + (seed % 4) * 0.18;
        brainEntries.push({
          pos: brainPos,
          scale: new THREE.Vector3(bs * 1.2, bs * 0.85, bs * 1.2),
          color: c3,
        });
      }

      // Outer High Reef Canyon Wall & Semi-Enclosed Coral Canopy Ridge (6.2m to 8.5m out, rising up toward Y = -0.2m)
      if (i % 2 === 0) {
        const outerDist = 6.4 + (seed % 4) * 0.55;
        const wallPos = new THREE.Vector3()
          .copy(sampleFrame.pos)
          .addScaledVector(sampleFrame.binormal, side * outerDist);
        wallPos.y = -3.2 + (seed % 3) * 0.65;

        rockTransforms.push({
          pos: wallPos,
          scale: new THREE.Vector3(2.4, 2.8 + (seed % 3) * 0.6, 2.4),
          rotY: seed * 0.45,
        });

        // Upper Canopy Overhanging Staghorn Coral leaning inward toward the track
        const canopyCoralPos = wallPos.clone().add(new THREE.Vector3(0, 1.85, 0));
        staghornEntries.push({
          pos: canopyCoralPos,
          scale: new THREE.Vector3(1.45, 1.65, 1.45),
          rot: new THREE.Euler(0, seed * 0.9, side * 0.42),
          color: coralPaletteHex[(seed + 1) % coralPaletteHex.length],
        });
      }
    }
  }

  // ============================================================================
  // 4. STORYBOARD CORAL ARCHES (T+03s First Reef, T+13s Coral Passage, T+18s Heart Reef)
  // ============================================================================
  // A) T+03s First Reef Canopy Arch (u = 0.583) & T+13s Coral Passage Full Arch (u = 0.639)
  for (const archSpec of [
    { u: 0.583, radiusX: 4.8, radiusY: 4.4, rings: 2, ribCount: 16 },
    { u: 0.639, radiusX: 4.6, radiusY: 4.3, rings: 4, ribCount: 18 },
  ]) {
    for (let r = 0; r < archSpec.rings; r++) {
      const ringU = archSpec.u + (r - (archSpec.rings - 1) * 0.5) * 0.0055;
      spline.evaluateAtU(ringU, sampleFrame);
      _scratchForward.copy(sampleFrame.tangent).normalize();
      _scratchRight.crossVectors(_worldUp, _scratchForward).normalize();

      for (let k = 0; k <= archSpec.ribCount; k++) {
        const theta = -Math.PI * 0.12 + (k / archSpec.ribCount) * (Math.PI * 1.24);
        const lx = Math.cos(theta) * archSpec.radiusX;
        const ly = Math.sin(theta) * archSpec.radiusY + 0.65;

        const worldPt = new THREE.Vector3()
          .copy(sampleFrame.pos)
          .addScaledVector(_scratchRight, lx)
          .addScaledVector(_worldUp, ly);

        // Rock arch core
        if (k % 2 === 0) {
          rockTransforms.push({
            pos: worldPt.clone(),
            scale: new THREE.Vector3(0.95, 0.95, 0.95),
            rotY: theta + r,
          });
        }

        // Lush Coral Branches radiating from the arch
        const colorHex = coralPaletteHex[(k + r * 3) % coralPaletteHex.length];
        staghornEntries.push({
          pos: worldPt,
          scale: new THREE.Vector3(1.15, 1.25, 1.15),
          rot: new THREE.Euler(0.2, k * 0.7, theta - Math.PI / 2),
          color: colorHex,
        });
      }
    }
  }

  // B) T+18s Monumental Heart-Shaped Coral Reef Arch at u = 0.667 ("You are my happy place.")
  {
    spline.evaluateAtU(0.667, sampleFrame);
    _scratchForward.copy(sampleFrame.tangent).normalize();
    _scratchRight.crossVectors(_worldUp, _scratchForward).normalize();

    const heartArchGroup = new THREE.Group();
    heartArchGroup.position.copy(sampleFrame.pos).add(new THREE.Vector3(0, 2.35, 0));
    heartArchGroup.lookAt(
      heartArchGroup.position.x - _scratchForward.x * 10,
      heartArchGroup.position.y,
      heartArchGroup.position.z - _scratchForward.z * 10
    );

    const heartClusterGeo = tracker.track(new THREE.DodecahedronGeometry(0.62, 1));
    const HEART_ARCH_SAMPLES = 44;
    for (let i = 0; i < HEART_ARCH_SAMPLES; i++) {
      const t = (i / HEART_ARCH_SAMPLES) * Math.PI * 2;
      // Parametric Heart Curve (clearance >= 3.2m around track at bottom/sides)
      const hx = 16 * Math.pow(Math.sin(t), 3) * 0.34;
      const hy =
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)) *
          0.29 +
        0.55;

      // Skip the very bottom tip where the coaster rails run (|hx| < 1.8 && hy < -1.2)
      if (Math.abs(hx) < 1.85 && hy < -1.05) continue;

      const nodule = new THREE.Mesh(
        heartClusterGeo,
        i % 2 === 0 ? heartCoralArchMat : heartCoralVioletMat
      );
      nodule.position.set(hx, hy, (i % 3 - 1) * 0.22);
      const s = 0.95 + (i % 4) * 0.18;
      nodule.scale.set(s, s, s);
      heartArchGroup.add(nodule);

      // Add branching staghorn coral blooms along the Heart Reef Arch in world space
      const worldCoralPos = new THREE.Vector3()
        .copy(sampleFrame.pos)
        .addScaledVector(_scratchRight, hx)
        .addScaledVector(_worldUp, hy + 2.35);
      staghornEntries.push({
        pos: worldCoralPos,
        scale: new THREE.Vector3(1.1, 1.2, 1.1),
        rot: new THREE.Euler(0, i * 0.5, Math.atan2(hy, hx) - Math.PI / 2),
        color: i % 2 === 0 ? 0xfb7185 : 0xc084fc,
      });
    }
    group.add(heartArchGroup);
  }

  // C) T+23s Underwater Heartline Element at u = 0.722 ("I LOVE YOU ❤️" Twin Glowing Heart Arches)
  const heartlineSparkleMeshes: THREE.Mesh[] = [];
  {
    for (let archIdx = 0; archIdx < 2; archIdx++) {
      const archU = 0.718 + archIdx * 0.008;
      spline.evaluateAtU(archU, sampleFrame);
      _scratchForward.copy(sampleFrame.tangent).normalize();

      const hlArchGroup = new THREE.Group();
      hlArchGroup.position.copy(sampleFrame.pos).add(new THREE.Vector3(0, 2.55, 0));
      hlArchGroup.lookAt(
        hlArchGroup.position.x - _scratchForward.x * 10,
        hlArchGroup.position.y,
        hlArchGroup.position.z - _scratchForward.z * 10
      );

      // Build smooth 3D Heart Tube Curve
      const heartCurvePts: THREE.Vector3[] = [];
      const SEGMENTS = 48;
      for (let i = 0; i <= SEGMENTS; i++) {
        // Start from bottom-left rail base -> over top heart lobes -> down to bottom-right rail base
        const t = Math.PI * 1.12 - (i / SEGMENTS) * (Math.PI * 2.24);
        const hx = 16 * Math.pow(Math.sin(t), 3) * 0.38;
        const hy =
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
            0.32 +
          0.55;
        heartCurvePts.push(new THREE.Vector3(hx, hy, 0));
      }

      const heartCurve = new THREE.CatmullRomCurve3(heartCurvePts, false);
      const outerTubeGeo = tracker.track(
        new THREE.TubeGeometry(heartCurve, 56, 0.22, 10, false)
      );
      const outerTubeMesh = new THREE.Mesh(
        outerTubeGeo,
        archIdx === 0 ? glowingHeartlineBlueMat : glowingHeartlinePinkMat
      );
      hlArchGroup.add(outerTubeMesh);

      const innerCoreGeo = tracker.track(
        new THREE.TubeGeometry(heartCurve, 48, 0.11, 8, false)
      );
      const innerCoreMesh = new THREE.Mesh(
        innerCoreGeo,
        archIdx === 0 ? glowingHeartlinePinkMat : glowingHeartlineBlueMat
      );
      innerCoreMesh.position.z = 0.14;
      hlArchGroup.add(innerCoreMesh);

      // Sparkling Crystal Nodes along the Heartline Arch
      const nodeGeo = tracker.track(new THREE.OctahedronGeometry(0.24, 1));
      for (let n = 2; n < SEGMENTS - 1; n += 4) {
        const pt = heartCurvePts[n];
        const nodeMesh = new THREE.Mesh(
          nodeGeo,
          n % 8 === 0 ? glowingHeartlinePinkMat : glowingHeartlineBlueMat
        );
        nodeMesh.position.set(pt.x, pt.y, 0.22);
        hlArchGroup.add(nodeMesh);
        heartlineSparkleMeshes.push(nodeMesh);
      }

      group.add(hlArchGroup);
    }
  }

  // Build InstancedMeshes for Reef Canyon Rocks, Staghorn Corals, Tube Sponges, and Brain Corals
  const rockGeo = tracker.track(new THREE.DodecahedronGeometry(1.0, 1));
  const rocksInstanced = tracker.track(
    new THREE.InstancedMesh(rockGeo, reefRockMat, rockTransforms.length)
  );
  for (let i = 0; i < rockTransforms.length; i++) {
    const rt = rockTransforms[i];
    _scratchEuler.set(0, rt.rotY, 0);
    _scratchQuat.setFromEuler(_scratchEuler);
    _scratchMat4.compose(rt.pos, _scratchQuat, rt.scale);
    rocksInstanced.setMatrixAt(i, _scratchMat4);
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  group.add(rocksInstanced);

  const staghornGeo = tracker.track(buildBranchingCoralGeometry());
  const staghornInstanced = tracker.track(
    new THREE.InstancedMesh(staghornGeo, staghornCoralMat, staghornEntries.length)
  );
  for (let i = 0; i < staghornEntries.length; i++) {
    const se = staghornEntries[i];
    _scratchQuat.setFromEuler(se.rot);
    _scratchMat4.compose(se.pos, _scratchQuat, se.scale);
    staghornInstanced.setMatrixAt(i, _scratchMat4);
    staghornInstanced.setColorAt(i, _scratchColor.setHex(se.color));
  }
  staghornInstanced.instanceMatrix.needsUpdate = true;
  if (staghornInstanced.instanceColor) staghornInstanced.instanceColor.needsUpdate = true;
  group.add(staghornInstanced);

  const spongeGeo = tracker.track(buildTubeSpongeGeometry());
  const spongeInstanced = tracker.track(
    new THREE.InstancedMesh(spongeGeo, tubeSpongeMat, spongeEntries.length)
  );
  for (let i = 0; i < spongeEntries.length; i++) {
    const sp = spongeEntries[i];
    _scratchQuat.setFromEuler(sp.rot);
    _scratchMat4.compose(sp.pos, _scratchQuat, sp.scale);
    spongeInstanced.setMatrixAt(i, _scratchMat4);
    spongeInstanced.setColorAt(i, _scratchColor.setHex(sp.color));
  }
  spongeInstanced.instanceMatrix.needsUpdate = true;
  if (spongeInstanced.instanceColor) spongeInstanced.instanceColor.needsUpdate = true;
  group.add(spongeInstanced);

  const brainGeo = tracker.track(new THREE.IcosahedronGeometry(0.65, 2));
  const brainInstanced = tracker.track(
    new THREE.InstancedMesh(brainGeo, brainCoralMat, brainEntries.length)
  );
  for (let i = 0; i < brainEntries.length; i++) {
    const be = brainEntries[i];
    _scratchQuat.identity();
    _scratchMat4.compose(be.pos, _scratchQuat, be.scale);
    brainInstanced.setMatrixAt(i, _scratchMat4);
    brainInstanced.setColorAt(i, _scratchColor.setHex(be.color));
  }
  brainInstanced.instanceMatrix.needsUpdate = true;
  if (brainInstanced.instanceColor) brainInstanced.instanceColor.needsUpdate = true;
  group.add(brainInstanced);

  // ============================================================================
  // 5. VOLUMETRIC BLUE UNDERWATER SUNBEAM RAYS PIERCING FROM Y = 0.0m
  // ============================================================================
  const lightRays: LightRayRig[] = [];
  const rayGeo = tracker.track(new THREE.CylinderGeometry(0.65, 2.35, 6.2, 12, 1, true));
  const RAY_COUNT = 16;
  for (let i = 0; i < RAY_COUNT; i++) {
    const u = 0.562 + (i / (RAY_COUNT - 1)) * 0.205;
    spline.evaluateAtU(u, sampleFrame);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = 2.8 + (i % 3) * 1.1;

    const rayMat = tracker.track(
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x7dd3fc : 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    rayMesh.position
      .copy(sampleFrame.pos)
      .addScaledVector(sampleFrame.binormal, side * lateral);
    rayMesh.position.y = -2.6;
    rayMesh.rotation.z = -side * 0.16;
    rayMesh.rotation.x = 0.08;
    group.add(rayMesh);

    lightRays.push({
      mesh: rayMesh,
      baseOpacity: 0.12 + (i % 3) * 0.03,
      phase: i * 1.1,
    });
  }

  // ============================================================================
  // 6. WORLD-SPACE GLOWING ROMANTIC STORYBOARD MESSAGES
  // ============================================================================
  const textStages: ReefTextStage[] = [
    {
      // T+03s First Reef
      u: 0.585,
      line1: 'You are my world.',
      showHeartBelow: true,
      heightOffset: 2.35,
      width: 6.4,
      height: 3.2,
    },
    {
      // T+08s Living Reef
      u: 0.612,
      line1: 'My heart',
      line2: 'belongs to you.',
      showHeartBelow: true,
      heightOffset: 2.4,
      width: 6.2,
      height: 3.1,
    },
    {
      // T+13s Coral Passage
      u: 0.640,
      line1: 'With you,',
      line2: 'everything feels magical.',
      showHeartBelow: false,
      heightOffset: 2.25,
      width: 6.5,
      height: 3.25,
    },
    {
      // T+18s Heart Reef
      u: 0.668,
      line1: 'You are my happy place.',
      showHeartBelow: true,
      heightOffset: 2.25,
      width: 6.2,
      height: 3.1,
    },
    {
      // Extended Romantic Bridge Quote
      u: 0.695,
      line1: 'Every wave whispers',
      line2: 'your name.',
      showHeartBelow: true,
      heightOffset: 2.35,
      width: 6.0,
      height: 3.0,
    },
    {
      // T+23s Heartline Element — Grand Love Moment
      u: 0.722,
      line1: 'I LOVE YOU',
      showHeartBelow: false,
      isGrandHeartline: true,
      heightOffset: 2.45,
      width: 7.8,
      height: 3.9,
    },
    {
      // T+26s Final Reef Vista before Open Sky Emergence
      u: 0.752,
      line1: 'Forever & always,',
      line2: 'into our sky of dreams.',
      showHeartBelow: true,
      heightOffset: 2.35,
      width: 6.2,
      height: 3.1,
    },
  ];

  for (let i = 0; i < textStages.length; i++) {
    const st = textStages[i];
    spline.evaluateAtU(st.u, sampleFrame);

    const tex = createGlowingRomanticTextTexture(
      tracker,
      st.line1,
      st.line2,
      st.showHeartBelow,
      st.isGrandHeartline
    );

    const mat = tracker.track(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: i === textStages.length - 1 ? 0.48 : 0.96,
        depthWrite: false,
        side: THREE.FrontSide,
      })
    );

    const planeGeo = tracker.track(new THREE.PlaneGeometry(st.width, st.height));
    const mesh = new THREE.Mesh(planeGeo, mat);

    mesh.position.copy(sampleFrame.pos).add(new THREE.Vector3(0, st.heightOffset, 0));
    // Face +Z directly toward the approaching train (-sampleFrame.tangent) so text is 100% upright & left-to-right!
    mesh.lookAt(
      mesh.position.x - sampleFrame.tangent.x * 12.0,
      mesh.position.y - sampleFrame.tangent.y * 2.5,
      mesh.position.z - sampleFrame.tangent.z * 12.0
    );

    st.mesh = mesh;
    st.mat = mat;
    group.add(mesh);
  }

  // ============================================================================
  // 7. ANIMATED SCHOOLS OF TROPICAL FISH, SEA TURTLES, JELLYFISH & BUBBLES
  // ============================================================================
  const fishGeo = tracker.track(buildTropicalFishGeometry());
  const TANG_FISH_COUNT = 96;
  const ANTHIAS_FISH_COUNT = 64;

  const tangFishMesh = tracker.track(
    new THREE.InstancedMesh(fishGeo, stripedTangFishMat, TANG_FISH_COUNT)
  );
  const anthiasFishMesh = tracker.track(
    new THREE.InstancedMesh(fishGeo, coralAnthiasFishMat, ANTHIAS_FISH_COUNT)
  );
  group.add(tangFishMesh);
  group.add(anthiasFishMesh);

  const tangFishData: FishInstanceData[] = [];
  for (let i = 0; i < TANG_FISH_COUNT; i++) {
    const schoolIdx = i % 6;
    const baseU = 0.565 + (schoolIdx / 6) * 0.185 + ((i * 19) % 10) * 0.0022;
    const side = schoolIdx % 2 === 0 ? -1 : 1;
    tangFishData.push({
      baseU,
      schoolIdx,
      lateralOffset: side * (2.3 + ((i * 7) % 18) * 0.14),
      vertOffset: 0.8 + ((i * 11) % 16) * 0.16,
      speedU: 0.006 + (i % 5) * 0.0008,
      phase: i * 0.85,
      scale: 0.72 + (i % 4) * 0.14,
      isStripedTang: true,
    });
  }

  const anthiasFishData: FishInstanceData[] = [];
  for (let i = 0; i < ANTHIAS_FISH_COUNT; i++) {
    const schoolIdx = i % 5;
    const baseU = 0.575 + (schoolIdx / 5) * 0.175 + ((i * 13) % 8) * 0.0025;
    const side = schoolIdx % 2 === 0 ? 1 : -1;
    anthiasFishData.push({
      baseU,
      schoolIdx,
      lateralOffset: side * (2.5 + ((i * 9) % 15) * 0.15),
      vertOffset: 1.1 + ((i * 13) % 14) * 0.15,
      speedU: 0.0075 + (i % 4) * 0.0009,
      phase: i * 1.15,
      scale: 0.58 + (i % 3) * 0.12,
      isStripedTang: false,
    });
  }

  // Gliding Sea Turtles (7 sculpted sea turtles along the reef)
  const seaTurtles: SeaTurtleRig[] = [];
  const turtleCarapaceGeo = tracker.track(new THREE.SphereGeometry(0.62, 14, 10));
  turtleCarapaceGeo.scale(0.88, 0.36, 1.18);
  const turtleHeadGeo = tracker.track(new THREE.SphereGeometry(0.18, 10, 8));
  turtleHeadGeo.scale(0.85, 0.75, 1.25);
  const turtleFlipperGeo = tracker.track(new THREE.BoxGeometry(0.68, 0.05, 0.22));
  const turtleRearFlipperGeo = tracker.track(new THREE.BoxGeometry(0.32, 0.04, 0.16));

  const turtleSpotsU = [0.588, 0.608, 0.628, 0.654, 0.675, 0.708, 0.742];
  for (let i = 0; i < turtleSpotsU.length; i++) {
    spline.evaluateAtU(turtleSpotsU[i], sampleFrame);
    const side = i % 2 === 0 ? 1 : -1;
    const anchorPos = new THREE.Vector3()
      .copy(sampleFrame.pos)
      .addScaledVector(sampleFrame.binormal, side * 3.8);

    const turtleRoot = new THREE.Group();
    const shell = new THREE.Mesh(turtleCarapaceGeo, turtleShellMat);
    turtleRoot.add(shell);

    const head = new THREE.Mesh(turtleHeadGeo, turtleSkinMat);
    head.position.set(0, 0.04, 0.78);
    turtleRoot.add(head);

    const leftFlipper = new THREE.Mesh(turtleFlipperGeo, turtleSkinMat);
    leftFlipper.position.set(0.62, -0.02, 0.28);
    leftFlipper.rotation.y = -0.25;
    turtleRoot.add(leftFlipper);

    const rightFlipper = new THREE.Mesh(turtleFlipperGeo, turtleSkinMat);
    rightFlipper.position.set(-0.62, -0.02, 0.28);
    rightFlipper.rotation.y = 0.25;
    turtleRoot.add(rightFlipper);

    for (const rSide of [-1, 1]) {
      const rearFlip = new THREE.Mesh(turtleRearFlipperGeo, turtleSkinMat);
      rearFlip.position.set(rSide * 0.36, -0.04, -0.62);
      rearFlip.rotation.y = rSide * 0.45;
      turtleRoot.add(rearFlip);
    }

    const ts = 0.92 + (i % 3) * 0.15;
    turtleRoot.scale.set(ts, ts, ts);
    group.add(turtleRoot);

    seaTurtles.push({
      root: turtleRoot,
      leftFlipper,
      rightFlipper,
      centerX: anchorPos.x,
      centerY: sampleFrame.pos.y + 2.45 + (i % 2) * 0.65,
      centerZ: anchorPos.z,
      orbitRadiusX: 2.2 + (i % 3) * 0.6,
      orbitRadiusZ: 1.8 + (i % 2) * 0.7,
      speed: 0.38 + (i % 3) * 0.07,
      phase: i * 1.4,
    });
  }

  // Glowing Bioluminescent Jellyfish (32 instanced jellyfish)
  const JELLYFISH_COUNT = 32;
  const jellyfishGeo = tracker.track(buildJellyfishGeometry());
  const jellyfishMesh = tracker.track(
    new THREE.InstancedMesh(jellyfishGeo, jellyfishMat, JELLYFISH_COUNT)
  );
  const jellyfishData: JellyfishInstanceData[] = [];
  for (let i = 0; i < JELLYFISH_COUNT; i++) {
    const u = 0.568 + (i / (JELLYFISH_COUNT - 1)) * 0.195;
    spline.evaluateAtU(u, sampleFrame);
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 2.6 + ((i * 11) % 24) * 0.12;
    const jPos = new THREE.Vector3()
      .copy(sampleFrame.pos)
      .addScaledVector(sampleFrame.binormal, side * dist);

    const isPink = i % 2 === 0;
    jellyfishData.push({
      x: jPos.x,
      baseY: sampleFrame.pos.y + 1.2 + (i % 4) * 0.65,
      z: jPos.z,
      phase: i * 0.9,
      speed: 1.8 + (i % 4) * 0.35,
      scale: 0.68 + (i % 4) * 0.16,
      isPink,
    });
    jellyfishMesh.setColorAt(
      i,
      _scratchColor.setHex(isPink ? 0xf472b6 : 0x38bdf8)
    );
  }
  if (jellyfishMesh.instanceColor) jellyfishMesh.instanceColor.needsUpdate = true;
  group.add(jellyfishMesh);

  // Rising Underwater Bubble Streams (160 instanced spheres)
  const BUBBLE_COUNT = 160;
  const bubbleGeo = tracker.track(new THREE.SphereGeometry(1.0, 8, 8));
  const bubblesMesh = tracker.track(
    new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLE_COUNT)
  );
  const bubbleData: BubbleInstanceData[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const u = 0.552 + ((i * 29) % 100) * 0.00225;
    spline.evaluateAtU(u, sampleFrame);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = 1.65 + ((i * 17) % 30) * 0.14;
    const bPos = new THREE.Vector3()
      .copy(sampleFrame.pos)
      .addScaledVector(sampleFrame.binormal, side * lateral);

    bubbleData.push({
      x: bPos.x,
      baseY: -5.4 + (i % 20) * 0.25,
      z: bPos.z,
      speed: 0.95 + (i % 5) * 0.28,
      phase: i * 0.63,
      radius: 0.045 + (i % 5) * 0.018,
    });
  }
  group.add(bubblesMesh);

  // ============================================================================
  // 8. PER-FRAME ZERO-ALLOCATION CHOREOGRAPHY & MARINE LIFE UPDATE
  // ============================================================================
  function updateFishSchool(
    mesh: THREE.InstancedMesh,
    dataArr: FishInstanceData[],
    elapsedTime: number
  ): void {
    for (let i = 0; i < dataArr.length; i++) {
      const fd = dataArr[i];
      // Swim gently along the reef loop (u = 0.558..0.768)
      const span = 0.21;
      const rawU = 0.558 + (((fd.baseU - 0.558 + elapsedTime * fd.speedU) % span) + span) % span;
      spline.evaluateAtU(rawU, sampleFrame);

      const swayLat = fd.lateralOffset + Math.sin(elapsedTime * 1.8 + fd.phase) * 0.45;
      const swayVert = fd.vertOffset + Math.cos(elapsedTime * 1.4 + fd.phase) * 0.28;

      _scratchPos
        .copy(sampleFrame.pos)
        .addScaledVector(sampleFrame.binormal, swayLat)
        .addScaledVector(_worldUp, swayVert);

      _scratchForward.copy(sampleFrame.tangent).normalize();
      // Subtle tail-swimming yaw wiggle
      const wiggleYaw = Math.sin(elapsedTime * 7.5 + fd.phase) * 0.18;
      _scratchRight.crossVectors(_worldUp, _scratchForward).normalize();
      _scratchForward.addScaledVector(_scratchRight, wiggleYaw).normalize();
      _scratchRight.crossVectors(_worldUp, _scratchForward).normalize();
      _scratchUp.crossVectors(_scratchForward, _scratchRight).normalize();

      _scratchMat4.makeBasis(_scratchRight, _scratchUp, _scratchForward);
      _scratchScale.set(fd.scale, fd.scale, fd.scale);
      _scratchMat4.scale(_scratchScale);
      _scratchMat4.setPosition(_scratchPos);
      mesh.setMatrixAt(i, _scratchMat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function update(
    _dt: number,
    elapsedTime: number,
    leadU: number,
    isPlayerRiding: boolean
  ): void {
    // 1. Compute underwater immersion factor (u = 0.542..0.778)
    let targetImmersion = 0;
    if (isPlayerRiding && leadU >= 0.538 && leadU <= 0.785) {
      if (leadU < 0.562) {
        targetImmersion = THREE.MathUtils.smoothstep(leadU, 0.538, 0.562);
      } else if (leadU <= 0.758) {
        targetImmersion = 1.0;
      } else {
        targetImmersion = 1.0 - THREE.MathUtils.smoothstep(leadU, 0.758, 0.785);
      }
    }
    currentImmersionAlpha = targetImmersion;

    // 2. Animate caustic floor shimmer
    causticFloorTex.offset.x = (elapsedTime * 0.035) % 1.0;
    causticFloorTex.offset.y = (elapsedTime * 0.024) % 1.0;

    // 3. Animate tropical fish schools
    updateFishSchool(tangFishMesh, tangFishData, elapsedTime);
    updateFishSchool(anthiasFishMesh, anthiasFishData, elapsedTime);

    // 4. Animate gliding sea turtles (figure-8 / orbital glide + flipper strokes)
    for (let i = 0; i < seaTurtles.length; i++) {
      const st = seaTurtles[i];
      const ang = elapsedTime * st.speed + st.phase;
      const nx = st.centerX + Math.cos(ang) * st.orbitRadiusX;
      const nz = st.centerZ + Math.sin(ang) * st.orbitRadiusZ;
      const ny = st.centerY + Math.sin(elapsedTime * 1.1 + st.phase) * 0.32;

      const dx = -Math.sin(ang) * st.orbitRadiusX;
      const dz = Math.cos(ang) * st.orbitRadiusZ;
      st.root.position.set(nx, ny, nz);
      st.root.rotation.set(
        Math.cos(elapsedTime * 1.1 + st.phase) * 0.08,
        Math.atan2(dx, dz),
        Math.sin(ang) * 0.14
      );

      const flap = Math.sin(elapsedTime * 2.8 + st.phase) * 0.38;
      st.leftFlipper.rotation.z = flap;
      st.rightFlipper.rotation.z = -flap;
    }

    // 5. Animate pulsing bioluminescent jellyfish
    for (let i = 0; i < jellyfishData.length; i++) {
      const jd = jellyfishData[i];
      const cycle = elapsedTime * jd.speed + jd.phase;
      const pulse = Math.sin(cycle);
      const yBob = Math.sin(cycle * 0.65) * 0.55;

      _scratchPos.set(
        jd.x + Math.cos(cycle * 0.4) * 0.22,
        jd.baseY + yBob,
        jd.z + Math.sin(cycle * 0.4) * 0.22
      );
      _scratchEuler.set(
        Math.sin(cycle * 0.5) * 0.12,
        cycle * 0.25,
        Math.cos(cycle * 0.5) * 0.12
      );
      _scratchQuat.setFromEuler(_scratchEuler);

      const bellWide = jd.scale * (1.0 + pulse * 0.16);
      const bellTall = jd.scale * (1.0 - pulse * 0.14);
      _scratchScale.set(bellWide, bellTall, bellWide);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      jellyfishMesh.setMatrixAt(i, _scratchMat4);
    }
    jellyfishMesh.instanceMatrix.needsUpdate = true;

    // 6. Animate rising ocean bubble streams
    for (let i = 0; i < bubbleData.length; i++) {
      const bd = bubbleData[i];
      const riseSpan = 5.4;
      const curY = -5.5 + (((bd.baseY + 5.5 + elapsedTime * bd.speed) % riseSpan) + riseSpan) % riseSpan;
      const wobbleX = Math.sin(elapsedTime * 3.2 + bd.phase) * 0.16;
      const wobbleZ = Math.cos(elapsedTime * 2.9 + bd.phase) * 0.16;

      _scratchPos.set(bd.x + wobbleX, curY, bd.z + wobbleZ);
      _scratchQuat.identity();
      _scratchScale.set(bd.radius, bd.radius, bd.radius);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      bubblesMesh.setMatrixAt(i, _scratchMat4);
    }
    bubblesMesh.instanceMatrix.needsUpdate = true;

    // 7. Modulate volumetric sunbeam shafts & Heartline sparkles
    for (let i = 0; i < lightRays.length; i++) {
      const lr = lightRays[i];
      const mat = lr.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = lr.baseOpacity + Math.sin(elapsedTime * 1.9 + lr.phase) * 0.045;
    }

    const hlPulse = 1.2 + Math.sin(elapsedTime * 4.2) * 0.35;
    glowingHeartlineBlueMat.emissiveIntensity = hlPulse;
    glowingHeartlinePinkMat.emissiveIntensity = hlPulse;

    // 8. Smooth proximity pulse on each storyboard world-space romantic quote as the train approaches
    for (let i = 0; i < textStages.length; i++) {
      const st = textStages[i];
      if (!st.mesh || !st.mat) continue;
      const deltaU = st.u - leadU;
      let scaleBoost = 1.0;
      if (deltaU >= -0.008 && deltaU <= 0.032) {
        const prox = 1.0 - Math.abs(deltaU - 0.012) / 0.02;
        scaleBoost = 1.0 + Math.max(0, prox) * 0.08;
      }
      const gentleFloat = Math.sin(elapsedTime * 2.2 + i * 0.9) * 0.08;
      spline.evaluateAtU(st.u, sampleFrame);
      st.mesh.position.set(
        sampleFrame.pos.x,
        sampleFrame.pos.y + st.heightOffset + gentleFloat,
        sampleFrame.pos.z
      );
      st.mesh.scale.set(scaleBoost, scaleBoost, 1.0);
    }
  }

  function dispose(): void {
    currentImmersionAlpha = 0;
  }

  return {
    group,
    update,
    dispose,
  };
}
