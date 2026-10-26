import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLAZA_RADIAL_SPOKES, getTerrainHeight } from './terrainMath';
import { CircleCollider } from './VegetationSystem';
import {
  ResourceTracker,
  createThemeParkMaterials,
  createHeartShape2D,
  createBeveledBoxGeometry,
  createCurvedParterreGeometry,
  createOrnamentalBasinRimGeometry,
  createExtrudedArchwayGeometry,
  createExtrudedAvenueSlabGeometry,
  createExtrudedPlazaBaseGeometry,
  createHeartBasinRimGeometry,
} from './ProceduralKit';

export interface CentralPlazaBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Reusable Data-Driven Boulevard Gateway Configuration (Sections 12–16).
 */
export interface GatewayConfig {
  id: string;
  spokeIndex: number;
  radialDistance: number;
  zoneTitle: string;
  zoneSubtitle: string;
  primaryAccentHex: string;
  secondaryTrimHex: string;
  motifType: 'aurora' | 'magic' | 'brick' | 'thrill' | 'fashion' | 'midway';
}

export const BOULEVARD_GATEWAYS: GatewayConfig[] = [
  {
    id: 'gateway-north-aurora',
    spokeIndex: 0,
    radialDistance: 36.8, // Positioned cleanly north of the Clock Tower archway (z = 26.5m)
    zoneTitle: 'NORTHERN LIGHTS',
    zoneSubtitle: 'Aurora Lake Sanctuary',
    primaryAccentHex: '#06b6d4', // Cyan
    secondaryTrimHex: '#0d9488', // Teal
    motifType: 'aurora',
  },
  {
    id: 'gateway-nw-magic',
    spokeIndex: 1,
    radialDistance: 32.2,
    zoneTitle: 'ANCIENT MAGIC REALM',
    zoneSubtitle: 'Mystic Castle Highlands',
    primaryAccentHex: '#7c3aed', // Violet
    secondaryTrimHex: '#1e3a8a', // Deep Blue
    motifType: 'magic',
  },
  {
    id: 'gateway-west-brick',
    spokeIndex: 2,
    radialDistance: 32.2,
    zoneTitle: 'BRICK VALLEY',
    zoneSubtitle: 'Playful Modular District',
    primaryAccentHex: '#dc2626', // Warm Red
    secondaryTrimHex: '#f59e0b', // Golden Yellow
    motifType: 'brick',
  },
  {
    id: 'gateway-ne-thrill',
    spokeIndex: 3,
    radialDistance: 32.2,
    zoneTitle: 'THRILL ZONE',
    zoneSubtitle: 'Heartline Coaster Ridge',
    primaryAccentHex: '#f43f5e', // Coral Rose
    secondaryTrimHex: '#f59e0b', // Energetic Gold
    motifType: 'thrill',
  },
  {
    id: 'gateway-east-fashion',
    spokeIndex: 4,
    radialDistance: 32.2,
    zoneTitle: 'FASHION WORLD',
    zoneSubtitle: 'Pastel Couture Promenade',
    primaryAccentHex: '#ec4899', // Rose
    secondaryTrimHex: '#c084fc', // Lavender
    motifType: 'fashion',
  },
  {
    id: 'gateway-south-midway',
    spokeIndex: 5,
    radialDistance: 32.2,
    zoneTitle: 'ROMANTIC MIDWAY',
    zoneSubtitle: 'Carnival & Special Gate',
    primaryAccentHex: '#e11d48', // Rose Crimson
    secondaryTrimHex: '#db2777', // Warm Magenta
    motifType: 'midway',
  },
];

/**
 * 4-Ring Data-Driven Spatial Composition for the Central Plaza (`(0, 4.2, 0)`).
 */
export const PLAZA_RING_CONFIG = {
  CENTER: { innerR: 0, outerR: 8.4, label: 'Luminous Heart Fountain Sanctuary' },
  INNER_RING: {
    innerR: 8.4,
    outerR: 16.2,
    label: 'Sculpted Parterre Gardens & Sweetheart Bench Promenade',
  },
  MIDDLE_RING: {
    innerR: 16.2,
    outerR: 24.8,
    label: 'Artisanal Boutiques, Royal Rotunda & Rose-Trellis Pergolas',
  },
  OUTER_RING: {
    innerR: 24.8,
    outerR: 46.0,
    label: 'Grand Clock Tower Belvedere & 6 Zone-Transition Gateways',
  },
} as const;

/**
 * Generates both the high-resolution warm sunlit cobblestone albedo texture and
 * a matching height/bump texture so the Central Plaza floor has authentic stone relief.
 */
function createPlazaPavingTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Base warm golden-sandstone & rose-travertine radial gradient
  const radGrad = ctx.createRadialGradient(cx, cy, 36, cx, cy, size * 0.5);
  radGrad.addColorStop(0, '#f4e1c6');
  radGrad.addColorStop(0.45, '#e5cca6');
  radGrad.addColorStop(0.82, '#d4b48c');
  radGrad.addColorStop(1, '#c0986e');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#d8d8d8';
  bCtx.fillRect(0, 0, size, size);

  // Alternating warm sandstone & blush-rose radial sector wedges (12 sectors)
  for (let s = 0; s < 12; s++) {
    const a0 = (s / 12) * Math.PI * 2;
    const a1 = ((s + 1) / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 445, a0, a1);
    ctx.closePath();
    ctx.fillStyle =
      s % 2 === 0 ? 'rgba(214, 144, 150, 0.13)' : 'rgba(252, 240, 220, 0.14)';
    ctx.fill();
  }

  // Concentric cobblestone paver rings & radial mortar joints (both color & recessed bump)
  for (let r = 44; r < size * 0.49; r += 12) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      r % 24 === 0 ? 'rgba(138, 98, 66, 0.42)' : 'rgba(158, 118, 82, 0.26)';
    ctx.lineWidth = r % 48 === 0 ? 3.0 : 1.6;
    ctx.stroke();

    bCtx.beginPath();
    bCtx.arc(cx, cy, r, 0, Math.PI * 2);
    bCtx.strokeStyle = '#383838';
    bCtx.lineWidth = 2.4;
    bCtx.stroke();

    const segments = Math.max(18, Math.floor((r * 2 * Math.PI) / 18));
    for (let s = 0; s < segments; s++) {
      const ang = (s / segments) * Math.PI * 2 + (r % 24 === 0 ? 0.04 : 0);
      const x0 = cx + Math.cos(ang) * r;
      const y0 = cy + Math.sin(ang) * r;
      const x1 = cx + Math.cos(ang) * (r + 12);
      const y1 = cy + Math.sin(ang) * (r + 12);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = 'rgba(142, 104, 72, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(x0, y0);
      bCtx.lineTo(x1, y1);
      bCtx.strokeStyle = '#454545';
      bCtx.lineWidth = 1.8;
      bCtx.stroke();
    }
  }

  // Champagne-gold & rose-granite inlaid ring borders
  const bandRadii = [142, 235, 345, 435, 484];
  bandRadii.forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx % 2 === 0 ? 'rgba(214, 130, 146, 0.52)' : 'rgba(235, 188, 106, 0.72)';
    ctx.lineWidth = idx === 3 ? 12 : 7;
    ctx.stroke();
  });

  // 12-point golden star-compass rays radiating from the Heart Fountain
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 140, cy + Math.sin(ang) * 140);
    ctx.lineTo(cx + Math.cos(ang) * 435, cy + Math.sin(ang) * 435);
    ctx.strokeStyle =
      i % 2 === 0 ? 'rgba(236, 186, 104, 0.56)' : 'rgba(212, 132, 148, 0.32)';
    ctx.lineWidth = i % 2 === 0 ? 6 : 3;
    ctx.stroke();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = maxAnisotropy;
  colorMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.needsUpdate = true;

  return { colorMap, bumpMap };
}

/**
 * Generates an illuminated golden clock-face texture for the Plaza Clock Tower.
 */
function createClockFaceTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
  rad.addColorStop(0, '#fffdf2');
  rad.addColorStop(0.75, '#ffefc2');
  rad.addColorStop(1, '#f5d07a');
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d89e3c';
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.strokeStyle = '#8c5e1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 92, cy + Math.sin(ang) * 92);
    ctx.lineTo(cx + Math.cos(ang) * 110, cy + Math.sin(ang) * 110);
    ctx.strokeStyle = '#5c3a0e';
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.stroke();
  }

  // Golden sun-star & heart filigree in center of clock dial
  ctx.fillStyle = 'rgba(218, 145, 56, 0.45)';
  ctx.beginPath();
  ctx.arc(cx - 12, cy - 8, 14, 0, Math.PI * 2);
  ctx.arc(cx + 12, cy - 8, 14, 0, Math.PI * 2);
  ctx.moveTo(cx - 25, cy - 3);
  ctx.lineTo(cx, cy + 24);
  ctx.lineTo(cx + 25, cy - 3);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a crisp directional theme-park signpost or gateway frieze plaque texture.
 */
function createSignpostTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  maxAnisotropy: number,
  centered = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c1726';
  ctx.fillRect(0, 0, 640, 160);

  ctx.strokeStyle = '#e5b564';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 624, 144);

  ctx.fillStyle = accentHex;
  ctx.fillRect(16, 16, 16, 128);
  if (centered) {
    ctx.fillRect(608, 16, 16, 128);
  }

  ctx.textAlign = centered ? 'center' : 'left';
  const textX = centered ? 320 : 52;

  ctx.fillStyle = '#f2d28b';
  ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle.toUpperCase(), textX, 52);

  ctx.fillStyle = '#faf6ee';
  ctx.font = 'bold 38px "Fraunces", Georgia, serif';
  ctx.fillText(title, textX, 112);

  if (!centered) {
    ctx.fillStyle = '#f2d28b';
    ctx.beginPath();
    ctx.moveTo(572, 52);
    ctx.lineTo(606, 80);
    ctx.lineTo(572, 108);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Parametric 3D point on a sculptural heart curve used to extrude
 * the monumental intertwined Golden & Warm-Luminous Heart Fountain ribbons.
 */
function getHeartCurvePoint(
  t: number,
  scale: number,
  zWave: number,
): THREE.Vector3 {
  const angle = t * Math.PI * 2;
  const x = 16 * Math.pow(Math.sin(angle), 3);
  const y =
    13 * Math.cos(angle) -
    5 * Math.cos(2 * angle) -
    2 * Math.cos(3 * angle) -
    Math.cos(4 * angle);
  const normalizedX = (x / 16) * scale;
  const normalizedY = ((y + 17) / 30) * (scale * 1.85);
  const z = Math.sin(angle * 2) * zWave;
  return new THREE.Vector3(normalizedX, normalizedY, z);
}

export function createCentralPlaza(
  renderer: THREE.WebGLRenderer,
): CentralPlazaBundle {
  const group = new THREE.Group();
  group.name = 'CentralPlazaGroup';

  const colliders: CircleCollider[] = [];
  const tracker = new ResourceTracker();
  const mats = createThemeParkMaterials(tracker);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const baseElevation = 4.2;

  const lushTurfMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#397544'),
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  const hedgeFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2b633a'),
      roughness: 0.74,
      metalness: 0.02,
    }),
  );
  // Subtle contact-shadow / ambient-occlusion grounding material for architectural bases (Section 8)
  const contactGroundMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#211813'),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );

  // Level 2: Soft champagne-gold inner rim material for the Heart Fountain arch (calibrated to 0.8)
  const goldenFountainGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fff6de'),
      emissive: new THREE.Color('#f5be62'),
      emissiveIntensity: 0.8,
      roughness: 0.26,
    }),
  );
  // Level 5: Soft ruby-rose lantern material for hanging tree heart ornaments (calibrated to 0.4)
  const rubyHeartLanternMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f27992'),
      emissive: new THREE.Color('#d9264e'),
      emissiveIntensity: 0.4,
      roughness: 0.3,
    }),
  );
  // Level 3: Subtle warm architectural interior glow for Clock Tower lancet windows (calibrated to 0.38)
  const clockWindowGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#faebd4'),
      emissive: new THREE.Color('#e6a450'),
      emissiveIntensity: 0.38,
      roughness: 0.38,
    }),
  );
  // Level 4: Gentle diffused interior glow for Boutique & Rotunda kiosk cores (calibrated to 0.22)
  const kioskInteriorGlowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5e6cc'),
      emissive: new THREE.Color('#d99642'),
      emissiveIntensity: 0.22,
      roughness: 0.48,
    }),
  );

  const finialGeo = tracker.trackGeo(new THREE.SphereGeometry(0.3, 12, 12));
  const heartMotifShape = createHeartShape2D(1.0);
  const extrudedHeartEmblemGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartMotifShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.055,
      bevelSegments: 3,
    }),
  );
  extrudedHeartEmblemGeo.center();

  // ============================================================================
  // 1. SEMI-MATTE TRAVERTINE & COBBLESTONE PLAZA DECK & 6 RADIAL BOULEVARDS
  // ============================================================================
  const { colorMap: pavingTex, bumpMap: pavingBumpTex } =
    createPlazaPavingTextures(maxAniso);
  tracker.trackTex(pavingTex);
  tracker.trackTex(pavingBumpTex);

  const plazaDeckGeo = tracker.trackGeo(
    createExtrudedPlazaBaseGeometry(29.8, 0.06, 24),
  );
  // Semi-matte natural travertine & cobblestone (controlled specular highlight, no plastic mirror glare)
  const plazaDeckMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      map: pavingTex,
      bumpMap: pavingBumpTex,
      bumpScale: 0.035,
      roughness: 0.52,
      metalness: 0.03,
      clearcoat: 0.08,
      clearcoatRoughness: 0.55,
    }),
  );
  const plazaDeckMesh = new THREE.Mesh(plazaDeckGeo, plazaDeckMat);
  plazaDeckMesh.position.set(0, baseElevation + 0.01, 0);
  plazaDeckMesh.receiveShadow = true;
  group.add(plazaDeckMesh);

  // Outer Molded Stone Ring Curb grounding the 29.8m Plaza Perimeter
  const outerPlazaCurbGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(29.45, 30.15, 0.16, 24),
  );
  const outerPlazaCurbMesh = new THREE.Mesh(outerPlazaCurbGeo, mats.warmSandstone);
  outerPlazaCurbMesh.position.set(0, baseElevation, 0);
  outerPlazaCurbMesh.receiveShadow = true;
  group.add(outerPlazaCurbMesh);

  const spokeAngles = PLAZA_RADIAL_SPOKES.map((s) =>
    Math.atan2(s.bx - s.ax, s.bz - s.az),
  ).sort((a, b) => a - b);

  // 6 Radial Avenue Carpets with Natural Sandstone Finish & Beveled Cream-Stone Curbs
  const avenueTileGeo = tracker.trackGeo(
    createExtrudedAvenueSlabGeometry(5.6, 2.8, 0.08),
  );
  const avenueCurbGeo = tracker.trackGeo(
    createExtrudedAvenueSlabGeometry(0.44, 2.84, 0.22),
  );
  const glossyAvenueMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e3cca5'),
      roughness: 0.54,
      metalness: 0.03,
      clearcoat: 0.06,
      clearcoatRoughness: 0.58,
    }),
  );

  PLAZA_RADIAL_SPOKES.forEach((spoke) => {
    const dirX = spoke.bx - spoke.ax;
    const dirZ = spoke.bz - spoke.az;
    const angle = Math.atan2(dirX, dirZ);

    const segCount = 7;
    for (let s = 0; s < segCount; s++) {
      const r0 = 28.0 + s * 2.75;
      const sx = Math.sin(angle) * r0;
      const sz = Math.cos(angle) * r0;
      const sy = getTerrainHeight(sx, sz);

      const tileMesh = new THREE.Mesh(avenueTileGeo, glossyAvenueMat);
      tileMesh.position.set(sx, sy + 0.01, sz);
      tileMesh.rotation.y = angle;
      tileMesh.receiveShadow = true;
      group.add(tileMesh);

      const curbL = new THREE.Mesh(avenueCurbGeo, mats.creamStone);
      curbL.position.set(
        sx + Math.cos(angle) * 2.92,
        sy + 0.02,
        sz - Math.sin(angle) * 2.92,
      );
      curbL.rotation.y = angle;
      curbL.castShadow = true;
      curbL.receiveShadow = true;

      const curbR = new THREE.Mesh(avenueCurbGeo, mats.creamStone);
      curbR.position.set(
        sx - Math.cos(angle) * 2.92,
        sy + 0.02,
        sz + Math.sin(angle) * 2.92,
      );
      curbR.rotation.y = angle;
      curbR.castShadow = true;
      curbR.receiveShadow = true;

      group.add(curbL, curbR);
    }
  });

  // ============================================================================
  // 2. RING 0 (CENTER, 0–12m): THE LUMINOUS GOLDEN HEART FOUNTAIN (0, 4.2, 0)
  // ============================================================================
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, baseElevation, 0);
  group.add(fountainGroup);

  colliders.push({ x: 0, z: 0, radius: 8.4 });

  // Grounded Stepped Foundation Apron & Contact Darkening Ring (Section 8)
  const fountainContactGeo = tracker.trackGeo(new THREE.RingGeometry(8.1, 8.95, 48));
  fountainContactGeo.rotateX(-Math.PI / 2);
  const fountainContactMesh = new THREE.Mesh(fountainContactGeo, contactGroundMat);
  fountainContactMesh.position.y = 0.02;
  fountainGroup.add(fountainContactMesh);

  const fountainApronGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(6.85, 8.5, 0.2, 12),
  );
  const fountainApronMesh = new THREE.Mesh(fountainApronGeo, mats.warmSandstone);
  fountainApronMesh.receiveShadow = true;
  fountainGroup.add(fountainApronMesh);

  // Scalloped 12-Lobed Marble Basin Rim (`THREE.Shape` + `THREE.ExtrudeGeometry`)
  const basinRimGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(6.95, 8.15, 0.72, 12),
  );
  const basinRimMesh = new THREE.Mesh(basinRimGeo, mats.creamStone);
  basinRimMesh.castShadow = true;
  basinRimMesh.receiveShadow = true;
  fountainGroup.add(basinRimMesh);

  // Molded Rose-Granite Coping Cap & Brushed-Gold Trim around the Outer Fountain Basin
  const basinCopingGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(6.9, 8.22, 0.12, 12),
  );
  basinCopingGeo.translate(0, 0.68, 0);
  const basinCopingMesh = new THREE.Mesh(basinCopingGeo, mats.roseGranite);
  basinCopingMesh.receiveShadow = true;
  fountainGroup.add(basinCopingMesh);

  const basinGoldRingGeo = tracker.trackGeo(
    new THREE.TorusGeometry(7.55, 0.08, 10, 64),
  );
  basinGoldRingGeo.rotateX(Math.PI / 2);
  basinGoldRingGeo.translate(0, 0.82, 0);
  const basinGoldRingMesh = new THREE.Mesh(basinGoldRingGeo, mats.brushedGold);
  fountainGroup.add(basinGoldRingMesh);

  // Luminous Golden-Turquoise Fountain Pool Water (radius 7.05m) with Concentric Ripple Shader
  const plazaWaterUniforms = { uTime: { value: 0 } };
  mats.fountainWater.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = plazaWaterUniforms.uTime;
    shader.vertexShader =
      `varying vec2 vPoolUv;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vPoolUv = uv - vec2(0.5);
        `,
      );
    shader.fragmentShader =
      `uniform float uTime;\nvarying vec2 vPoolUv;\n` +
      shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        float rDist = length(vPoolUv) * 14.1;
        float ripple1 = sin(rDist * 6.5 - uTime * 3.8);
        float ripple2 = cos(vPoolUv.x * 38.0 + uTime * 2.4) * sin(vPoolUv.y * 38.0 - uTime * 2.1);
        vec2 radialDir = normalize(vPoolUv + vec2(0.0001));
        normal = normalize(normal + vec3(
          radialDir.x * ripple1 * 0.085 + ripple2 * 0.035,
          0.0,
          radialDir.y * ripple1 * 0.085 + ripple2 * 0.035
        ));
        `,
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float causticRing = smoothstep(0.65, 1.0, sin(length(vPoolUv) * 85.0 - uTime * 3.8));
        diffuseColor.rgb += vec3(0.12, 0.17, 0.16) * causticRing * 0.18;
        `,
      );
  };

  const poolWaterGeo = tracker.trackGeo(new THREE.CircleGeometry(7.05, 64));
  poolWaterGeo.rotateX(-Math.PI / 2);
  const poolWaterMesh = new THREE.Mesh(poolWaterGeo, mats.fountainWater);
  poolWaterMesh.position.y = 0.58;
  fountainGroup.add(poolWaterMesh);

  // Sculpted Inner Golden-Rose Heart Basin Rim inside the Pool
  const innerHeartBasinGeo = tracker.trackGeo(
    createHeartBasinRimGeometry(4.2, 3.35, 1.05),
  );
  const innerHeartBasinMesh = new THREE.Mesh(
    innerHeartBasinGeo,
    mats.brushedGold,
  );
  innerHeartBasinMesh.position.set(0, 0.45, 0.35);
  innerHeartBasinMesh.castShadow = true;
  innerHeartBasinMesh.receiveShadow = true;
  fountainGroup.add(innerHeartBasinMesh);

  // Glowing Warm-Gold Rim Cap on the Heart Inner Basin
  const innerHeartGlowGeo = tracker.trackGeo(
    createHeartBasinRimGeometry(4.05, 3.55, 0.18),
  );
  const innerHeartGlowMesh = new THREE.Mesh(
    innerHeartGlowGeo,
    goldenFountainGlowMat,
  );
  innerHeartGlowMesh.position.set(0, 1.48, 0.35);
  fountainGroup.add(innerHeartGlowMesh);

  // Multi-Tiered Sculpted Marble & Gold Pedestal supporting the Monumental Heart Arch
  const pedSubBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.75, 2.95, 0.48, 24),
  );
  pedSubBaseGeo.translate(0, 0.44, 0);
  const pedestalTier1Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.05, 2.55, 1.45, 24),
  );
  pedestalTier1Geo.translate(0, 1.2, 0);
  const pedestalBowlGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(3.5, 1.95, 0.68, 32),
  );
  pedestalBowlGeo.translate(0, 2.02, 0);
  const pedestalTrimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(3.5, 0.12, 10, 36),
  );
  pedestalTrimGeo.rotateX(Math.PI / 2);
  pedestalTrimGeo.translate(0, 2.34, 0);

  const pedSubBase = new THREE.Mesh(pedSubBaseGeo, mats.warmSandstone);
  const pedTier1 = new THREE.Mesh(pedestalTier1Geo, mats.creamStone);
  const pedBowl = new THREE.Mesh(pedestalBowlGeo, mats.creamStone);
  const pedTrim = new THREE.Mesh(pedestalTrimGeo, mats.brushedGold);
  pedSubBase.castShadow = true;
  pedTier1.castShadow = true;
  pedBowl.castShadow = true;
  fountainGroup.add(pedSubBase, pedTier1, pedBowl, pedTrim);

  // Monumental Sculpted Brushed-Gold Outer Heart Arch + Luminous Warm-Gold Inner Heart Arch
  const heartPointsA: THREE.Vector3[] = [];
  const heartPointsB: THREE.Vector3[] = [];
  const sampleSteps = 72;
  for (let i = 0; i <= sampleSteps; i++) {
    const t = i / sampleSteps;
    const pA = getHeartCurvePoint(t, 4.5, 0.28);
    pA.y += 2.25;
    heartPointsA.push(pA);

    const pB = getHeartCurvePoint(t, 4.05, -0.22);
    pB.y += 2.48;
    heartPointsB.push(pB);
  }

  const heartCurveA = new THREE.CatmullRomCurve3(heartPointsA, true);
  const heartCurveB = new THREE.CatmullRomCurve3(heartPointsB, true);

  const heartRibbonGeoA = tracker.trackGeo(
    new THREE.TubeGeometry(heartCurveA, 96, 0.34, 14, true),
  );
  const heartRibbonGeoB = tracker.trackGeo(
    new THREE.TubeGeometry(heartCurveB, 96, 0.22, 14, true),
  );

  const heartRibbonMeshA = new THREE.Mesh(heartRibbonGeoA, mats.brushedGold);
  const heartRibbonMeshB = new THREE.Mesh(
    heartRibbonGeoB,
    goldenFountainGlowMat,
  );
  heartRibbonMeshA.castShadow = true;
  heartRibbonMeshB.castShadow = true;
  fountainGroup.add(heartRibbonMeshA, heartRibbonMeshB);

  // Levitating Glowing Crystal Heart Core inside the Arch
  const coreHeartMesh = new THREE.Mesh(
    extrudedHeartEmblemGeo,
    mats.crystalHeart,
  );
  coreHeartMesh.position.set(0, 6.25, 0);
  coreHeartMesh.scale.setScalar(0.95);
  fountainGroup.add(coreHeartMesh);

  // 8 Beveled Stone Plinths & Framed Bronze Pedestal Lanterns around the Fountain Curb
  const plinthGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.68, 0.52, 0.68, 0.045),
  );
  plinthGeo.translate(0, 0.72, 0);
  const lanternFootGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.44, 0.1, 0.44, 0.02),
  );
  lanternFootGeo.translate(0, 1.24, 0);
  const lanternBodyGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.32, 0.46, 0.32, 0.025),
  );
  lanternBodyGeo.translate(0, 1.32, 0);
  const lanternCapGeo = tracker.trackGeo(new THREE.ConeGeometry(0.3, 0.26, 4));
  lanternCapGeo.rotateY(Math.PI / 4);
  lanternCapGeo.translate(0, 1.89, 0);
  const spoutNozzleGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.22, 0.36, 8),
  );
  spoutNozzleGeo.rotateX(-Math.PI / 3);

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const lx = Math.sin(ang) * 7.55;
    const lz = Math.cos(ang) * 7.55;

    const plinth = new THREE.Mesh(plinthGeo, mats.creamStone);
    plinth.position.set(lx, 0, lz);
    const lFoot = new THREE.Mesh(lanternFootGeo, mats.wroughtBronze);
    lFoot.position.set(lx, 0, lz);
    const lBody = new THREE.Mesh(lanternBodyGeo, mats.warmLanternGlow);
    lBody.position.set(lx, 0, lz);
    const lCap = new THREE.Mesh(lanternCapGeo, mats.wroughtBronze);
    lCap.position.set(lx, 0, lz);

    const spout = new THREE.Mesh(spoutNozzleGeo, mats.brushedGold);
    spout.position.set(Math.sin(ang) * 6.55, 0.78, Math.cos(ang) * 6.55);
    spout.rotation.y = ang + Math.PI;

    fountainGroup.add(plinth, lFoot, lBody, lCap, spout);
  }

  // Animated Cascading Fountain Water Plumes & Heart-Arch Veil
  const dropCount = 260;
  const dropGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.075, 0.36, 4, 6),
  );
  const dropMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#f2f7fa'),
      transparent: true,
      opacity: 0.56,
    }),
  );
  const dropInst = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
  dropInst.frustumCulled = false;
  fountainGroup.add(dropInst);

  // Level 2: Soft Champagne-Gold Fountain PointLight (the unmistakable focal light of the plaza)
  const fountainLight = new THREE.PointLight(0xffe4b5, 7.5, 27, 1.9);
  fountainLight.position.set(0, 4.8, 0);
  fountainGroup.add(fountainLight);

  // Level 4: 4 Localized Warm Amber Promenade Lantern Pools around benches & boutique approaches
  const promenadeLanternCoords: Array<[number, number, number]> = [
    [-11.5, 3.6, -13.5],
    [11.5, 3.6, -13.5],
    [-14.5, 3.8, 10.5],
    [14.5, 3.8, 10.5],
  ];
  promenadeLanternCoords.forEach(([lx, ly, lz]) => {
    const pLight = new THREE.PointLight(0xffc880, 3.0, 14, 2.0);
    pLight.position.set(lx, baseElevation + ly, lz);
    group.add(pLight);
  });

  // ============================================================================
  // 3. RING 1 (INNER RING, 12–22m): SCULPTED PARTERRE GARDENS & DETAILED BENCHES
  // ============================================================================
  // Detailed Multi-Slat Beveled Bench Geometry with Cast-Bronze Legs, Armrests & Grounding Pads (Section 17)
  const slat1 = createBeveledBoxGeometry(2.14, 0.065, 0.18, 0.015);
  slat1.translate(0, 0.45, 0.19);
  const slat2 = createBeveledBoxGeometry(2.14, 0.065, 0.18, 0.015);
  slat2.translate(0, 0.46, 0.0);
  const slat3 = createBeveledBoxGeometry(2.14, 0.065, 0.18, 0.015);
  slat3.translate(0, 0.45, -0.19);
  const backSlat1 = createBeveledBoxGeometry(2.14, 0.18, 0.06, 0.015);
  backSlat1.translate(0, 0.64, -0.25);
  const backSlat2 = createBeveledBoxGeometry(2.14, 0.2, 0.065, 0.015);
  backSlat2.translate(0, 0.86, -0.26);
  const benchTimberGeo = tracker.trackGeo(
    mergeGeometries([slat1, slat2, slat3, backSlat1, backSlat2]),
  );

  const legFront = createBeveledBoxGeometry(0.11, 0.46, 0.12, 0.02);
  legFront.translate(0, 0.02, 0.2);
  const legRear = createBeveledBoxGeometry(0.11, 0.94, 0.12, 0.02);
  legRear.translate(0, 0.02, -0.24);
  const armRest = createBeveledBoxGeometry(0.1, 0.07, 0.54, 0.02);
  armRest.translate(0, 0.64, -0.02);
  const footPadF = createBeveledBoxGeometry(0.2, 0.045, 0.22, 0.01);
  footPadF.translate(0, 0.0, 0.2);
  const footPadR = createBeveledBoxGeometry(0.2, 0.045, 0.22, 0.01);
  footPadR.translate(0, 0.0, -0.24);
  const benchFrameGeo = tracker.trackGeo(
    mergeGeometries([legFront, legRear, armRest, footPadF, footPadR]),
  );
  const benchContactGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.35, 0.82));
  benchContactGeo.rotateX(-Math.PI / 2);

  const topiaryHeartGeo = extrudedHeartEmblemGeo;

  function createSweetheartBench(
    x: number,
    z: number,
    rotY: number,
    variantIdx: number,
  ) {
    const bGroup = new THREE.Group();
    // Subtle controlled imperfection in rotation & scale (Section 18)
    const rotJitter = ((variantIdx % 3) - 1) * 0.022;
    const scaleJitter = 0.985 + (variantIdx % 3) * 0.015;
    bGroup.position.set(x, baseElevation + 0.01, z);
    bGroup.rotation.y = rotY + rotJitter;
    bGroup.scale.setScalar(scaleJitter);

    const contactPad = new THREE.Mesh(benchContactGeo, contactGroundMat);
    contactPad.position.y = 0.01;

    const timber = new THREE.Mesh(benchTimberGeo, mats.warmTimber);
    const frameL = new THREE.Mesh(benchFrameGeo, mats.wroughtBronze);
    frameL.position.x = -0.88;
    const frameR = new THREE.Mesh(benchFrameGeo, mats.wroughtBronze);
    frameR.position.x = 0.88;

    const crest = new THREE.Mesh(topiaryHeartGeo, mats.brushedGold);
    crest.scale.setScalar(0.16);
    crest.position.set(0, 0.98, -0.23);

    timber.castShadow = true;
    timber.receiveShadow = true;
    frameL.castShadow = true;
    frameR.castShadow = true;
    bGroup.add(contactPad, timber, frameL, frameR, crest);
    group.add(bGroup);
  }

  for (let i = 0; i < spokeAngles.length; i++) {
    const aStart = spokeAngles[i];
    const aEnd =
      i + 1 < spokeAngles.length
        ? spokeAngles[i + 1]
        : spokeAngles[0] + Math.PI * 2;
    const sectorSpan = aEnd - aStart;
    if (sectorSpan < 0.45) continue;

    const pad = 0.26;
    const pStart = aStart + pad;
    const pEnd = aEnd - pad;
    const midAngle = (pStart + pEnd) * 0.5;

    // Grounded Stone Parterre Curb (`r = 12.2m..15.1m`) + Molded Upper Coping Rim
    const parterreStoneGeo = tracker.trackGeo(
      createCurvedParterreGeometry(12.2, 15.1, pStart, pEnd, 0.44, 0.075),
    );
    const parterreStoneMesh = new THREE.Mesh(parterreStoneGeo, mats.creamStone);
    parterreStoneMesh.position.y = baseElevation;
    parterreStoneMesh.castShadow = true;
    parterreStoneMesh.receiveShadow = true;
    group.add(parterreStoneMesh);

    const parterreTurfGeo = tracker.trackGeo(
      createCurvedParterreGeometry(
        12.52,
        14.78,
        pStart + 0.035,
        pEnd - 0.035,
        0.48,
        0.02,
      ),
    );
    const parterreTurfMesh = new THREE.Mesh(parterreTurfGeo, lushTurfMat);
    parterreTurfMesh.position.y = baseElevation;
    parterreTurfMesh.receiveShadow = true;
    group.add(parterreTurfMesh);

    // Low Manicured Boxwood Border Hedge framing the inner arc of each Parterre (Section 4)
    const innerHedgeGeo = tracker.trackGeo(
      createCurvedParterreGeometry(
        12.62,
        13.05,
        pStart + 0.08,
        pEnd - 0.08,
        0.68,
        0.05,
      ),
    );
    const innerHedgeMesh = new THREE.Mesh(innerHedgeGeo, hedgeFoliageMat);
    innerHedgeMesh.position.y = baseElevation;
    innerHedgeMesh.castShadow = true;
    innerHedgeMesh.receiveShadow = true;
    group.add(innerHedgeMesh);

    // Stone Pedestal Lanterns at the two corners of each Curved Parterre
    [pStart + 0.06, pEnd - 0.06].forEach((cAng) => {
      const px = Math.sin(cAng) * 12.35;
      const pz = Math.cos(cAng) * 12.35;
      const pPed = new THREE.Mesh(plinthGeo, mats.creamStone);
      pPed.position.set(px, baseElevation - 0.25, pz);
      const pFoot = new THREE.Mesh(lanternFootGeo, mats.wroughtBronze);
      pFoot.position.set(px, baseElevation - 0.25, pz);
      const pLantern = new THREE.Mesh(lanternBodyGeo, mats.warmLanternGlow);
      pLantern.position.set(px, baseElevation - 0.25, pz);
      const pCap = new THREE.Mesh(lanternCapGeo, mats.wroughtBronze);
      pCap.position.set(px, baseElevation - 0.25, pz);
      group.add(pPed, pFoot, pLantern, pCap);
    });

    // Compact Ornamental Topiary Shrub at the center of the Parterre (`r = 13.85m`, low height so sightlines stay clear!)
    const topiaryX = Math.sin(midAngle) * 13.85;
    const topiaryZ = Math.cos(midAngle) * 13.85;
    const topiaryUrnGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.38, 0.28, 0.45, 10),
    );
    topiaryUrnGeo.translate(0, 0.68, 0);
    const topiaryStemGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.08, 0.12, 0.55, 8),
    );
    topiaryStemGeo.translate(0, 1.05, 0);
    const urnMesh = new THREE.Mesh(topiaryUrnGeo, mats.warmSandstone);
    urnMesh.position.set(topiaryX, baseElevation, topiaryZ);
    const stemMesh = new THREE.Mesh(topiaryStemGeo, mats.darkWalnut);
    stemMesh.position.set(topiaryX, baseElevation, topiaryZ);

    const heartBushMesh = new THREE.Mesh(topiaryHeartGeo, hedgeFoliageMat);
    heartBushMesh.position.set(topiaryX, baseElevation + 1.52, topiaryZ);
    heartBushMesh.rotation.y = midAngle;
    heartBushMesh.scale.set(0.54, 0.54, 0.72);
    heartBushMesh.castShadow = true;
    group.add(urnMesh, stemMesh, heartBushMesh);

    colliders.push({ x: topiaryX, z: topiaryZ, radius: 1.35 });

    const benchX = Math.sin(midAngle) * 10.6;
    const benchZ = Math.cos(midAngle) * 10.6;
    createSweetheartBench(benchX, benchZ, midAngle + Math.PI, i);
  }

  // ============================================================================
  // 4. RING 2 (MIDDLE RING, 22–35m): DETAILED PAVILIONS, ROTUNDA & FRAMING TREES
  // ============================================================================
  // Upgraded Kiosk Architecture: Stepped Foundation, Toe-Kick, Overhanging Counter, Column Plinths/Capitals & Layered Roof Fascia
  const kioskContactGeo = tracker.trackGeo(new THREE.CircleGeometry(3.85, 16));
  kioskContactGeo.rotateX(-Math.PI / 2);
  const kioskStep1Geo = tracker.trackGeo(
    new THREE.CylinderGeometry(3.55, 3.72, 0.22, 8),
  );
  kioskStep1Geo.translate(0, 0.11, 0);
  const kioskBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(3.32, 3.45, 0.28, 8),
  );
  kioskBaseGeo.translate(0, 0.36, 0);
  const kioskToeKickGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.18, 2.22, 0.18, 8),
  );
  kioskToeKickGeo.translate(0, 0.58, 0);
  const kioskCounterGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.26, 2.34, 0.92, 8),
  );
  kioskCounterGeo.translate(0, 1.12, 0);
  const kioskCounterTopGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.48, 2.44, 0.12, 8),
  );
  kioskCounterTopGeo.translate(0, 1.62, 0);
  const kioskCoreGlowGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.48, 1.48, 2.2, 8),
  );
  kioskCoreGlowGeo.translate(0, 1.95, 0);

  // Column with Base Plinth, Shaft, and Doric Capital
  const colPlinth = createBeveledBoxGeometry(0.46, 0.28, 0.46, 0.03);
  colPlinth.translate(0, 0.48, 0);
  const colShaft = new THREE.CylinderGeometry(0.13, 0.16, 2.55, 10).toNonIndexed();
  colShaft.translate(0, 1.88, 0);
  const colCap = createBeveledBoxGeometry(0.44, 0.2, 0.44, 0.03);
  colCap.translate(0, 3.16, 0);
  const kioskColGeo = tracker.trackGeo(
    mergeGeometries([colPlinth, colShaft, colCap]),
  );

  // Roof Fascia Ring + Thick Roof + Scalloped Awning Valance
  const kioskFasciaGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(3.68, 3.62, 0.34, 8),
  );
  kioskFasciaGeo.translate(0, 3.48, 0);
  const kioskRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(4.08, 2.45, 8));
  kioskRoofGeo.translate(0, 4.82, 0);
  const kioskValanceGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(3.25, 3.72, 0.28, 8),
  );
  kioskValanceGeo.translate(0, 3.22, 0);

  const rotundaDomeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(3.95, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
  );
  rotundaDomeGeo.translate(0, 3.55, 0);
  const eaveBulbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.08, 8, 8));

  const kioskConfigs = [
    {
      x: -17.2,
      z: 7.8,
      roofMat: mats.patinaTealRoof,
      counterMat: mats.warmTimber,
      isRotunda: false,
    },
    {
      x: 17.8,
      z: 8.2,
      roofMat: mats.royalSlateRoof,
      counterMat: mats.warmSandstone,
      isRotunda: true,
    },
    {
      x: -17.2,
      z: -13.8,
      roofMat: mats.patinaTealRoof,
      counterMat: mats.warmTimber,
      isRotunda: false,
    },
    {
      x: 17.2,
      z: -13.8,
      roofMat: mats.royalSlateRoof,
      counterMat: mats.roseGranite,
      isRotunda: true,
    },
  ];

  kioskConfigs.forEach((cfg) => {
    const kGroup = new THREE.Group();
    kGroup.position.set(cfg.x, baseElevation, cfg.z);

    const kContact = new THREE.Mesh(kioskContactGeo, contactGroundMat);
    kContact.position.y = 0.02;
    const kStep1 = new THREE.Mesh(kioskStep1Geo, mats.warmSandstone);
    const kBase = new THREE.Mesh(kioskBaseGeo, mats.creamStone);
    const kToe = new THREE.Mesh(kioskToeKickGeo, mats.wroughtBronze);
    const kCounter = new THREE.Mesh(kioskCounterGeo, cfg.counterMat);
    const kCounterTop = new THREE.Mesh(kioskCounterTopGeo, mats.creamStone);
    const kGlow = new THREE.Mesh(kioskCoreGlowGeo, kioskInteriorGlowMat);
    const kFascia = new THREE.Mesh(kioskFasciaGeo, mats.creamStone);
    const kRoof = new THREE.Mesh(
      cfg.isRotunda ? rotundaDomeGeo : kioskRoofGeo,
      cfg.roofMat,
    );
    const kValance = new THREE.Mesh(kioskValanceGeo, mats.brushedGold);
    const kFinial = new THREE.Mesh(finialGeo, mats.brushedGold);
    kFinial.position.y = cfg.isRotunda ? 7.65 : 6.12;

    kStep1.receiveShadow = true;
    kBase.receiveShadow = true;
    kCounter.castShadow = true;
    kCounterTop.castShadow = true;
    kRoof.castShadow = true;
    kGroup.add(
      kContact,
      kStep1,
      kBase,
      kToe,
      kCounter,
      kCounterTop,
      kGlow,
      kFascia,
      kRoof,
      kValance,
      kFinial,
    );

    const colCount = 8;
    for (let c = 0; c < colCount; c++) {
      const cAng = (c / colCount) * Math.PI * 2;
      const col = new THREE.Mesh(kioskColGeo, mats.creamStone);
      col.position.set(Math.sin(cAng) * 2.85, 0, Math.cos(cAng) * 2.85);
      col.rotation.y = cAng;
      col.castShadow = true;
      kGroup.add(col);
    }

    // Ring of warm festival light bulbs under the gazebo eaves
    for (let b = 0; b < 16; b++) {
      const bAng = (b / 16) * Math.PI * 2;
      const bulb = new THREE.Mesh(eaveBulbGeo, mats.warmLanternGlow);
      bulb.position.set(Math.sin(bAng) * 3.55, 3.2, Math.cos(bAng) * 3.55);
      kGroup.add(bulb);
    }

    if (cfg.isRotunda) {
      const ribGeo = tracker.trackGeo(
        new THREE.TorusGeometry(3.98, 0.065, 8, 24, Math.PI),
      );
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(ribGeo, mats.brushedGold);
        rib.position.y = 3.55;
        rib.rotation.y = (r / 4) * Math.PI;
        kGroup.add(rib);
      }
    }

    group.add(kGroup);
    colliders.push({ x: cfg.x, z: cfg.z, radius: 3.6 });
  });

  // Artisanal Café Carts with Beveled Counter & Grounded Wheel Supports
  const cartBodyGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.68, 0.86, 0.98, 0.04),
  );
  cartBodyGeo.translate(0, 0.36, 0);
  const cartTopGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.82, 0.09, 1.1, 0.025),
  );
  cartTopGeo.translate(0, 1.2, 0);
  const cartLegGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.1, 0.38, 0.1, 0.015),
  );
  cartLegGeo.translate(0.65, 0.0, 0);
  const cartWheelGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.34, 0.05, 8, 16),
  );
  const parasolConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(1.85, 0.72, 16),
  );
  parasolConeGeo.translate(0, 2.58, 0);
  const parasolValanceGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(1.62, 1.88, 0.16, 12),
  );
  parasolValanceGeo.translate(0, 2.15, 0);
  const parasolPoleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.045, 0.055, 2.4, 8),
  );
  parasolPoleGeo.translate(0, 1.2, 0);

  function createArtisanalCart(
    x: number,
    z: number,
    rotY: number,
    canopyMat: THREE.Material,
  ) {
    const cGroup = new THREE.Group();
    cGroup.position.set(x, baseElevation, z);
    cGroup.rotation.y = rotY;

    const body = new THREE.Mesh(cartBodyGeo, mats.creamStone);
    body.castShadow = true;
    const topSlab = new THREE.Mesh(cartTopGeo, mats.warmTimber);
    topSlab.castShadow = true;
    const legL = new THREE.Mesh(cartLegGeo, mats.wroughtBronze);
    legL.position.z = 0.36;
    const legR = new THREE.Mesh(cartLegGeo, mats.wroughtBronze);
    legR.position.z = -0.36;
    const pole = new THREE.Mesh(parasolPoleGeo, mats.brushedGold);
    const canopy = new THREE.Mesh(parasolConeGeo, canopyMat);
    canopy.castShadow = true;
    const valance = new THREE.Mesh(parasolValanceGeo, mats.ivoryCanvas);

    const wheelL = new THREE.Mesh(cartWheelGeo, mats.wroughtBronze);
    wheelL.position.set(-0.38, 0.38, 0.54);
    const wheelR = new THREE.Mesh(cartWheelGeo, mats.wroughtBronze);
    wheelR.position.set(-0.38, 0.38, -0.54);

    cGroup.add(body, topSlab, legL, legR, pole, canopy, valance, wheelL, wheelR);
    group.add(cGroup);
    colliders.push({ x, z, radius: 1.08 });
  }

  createArtisanalCart(-15.4, 9.6, 0.45, mats.blushPastel);
  createArtisanalCart(15.4, 9.6, -0.55, mats.blushPastel);

  // Selective Ornamental Plaza Perimeter Trees in Grounded Stone Planters (`r = 25.4m–26.8m`, strictly outside 0–22m!)
  const treePlanterStoneGeo = tracker.trackGeo(
    createOrnamentalBasinRimGeometry(0.95, 1.38, 0.48, 8),
  );
  const treePlanterSoilGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.05, 1.05, 0.42, 12),
  );
  treePlanterSoilGeo.translate(0, 0.21, 0);
  const plazaTreeTrunkGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.24, 0.42, 4.6, 10),
  );
  plazaTreeTrunkGeo.translate(0, 2.3, 0);
  const plazaTreeBoughGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.09, 0.18, 2.4, 8),
  );
  plazaTreeBoughGeo.translate(0, 1.2, 0);

  // 9-puff organically perturbed leafy cluster geometry for the Selective Ornamental Plaza Trees
  const plazaCanopyPuffs: Array<[number, number, number, number]> = [
    [0.0, 0.0, 0.0, 1.22],
    [-1.02, -0.2, 0.32, 0.88],
    [1.02, -0.16, -0.28, 0.86],
    [0.22, -0.18, 0.98, 0.84],
    [-0.22, -0.2, -0.96, 0.84],
    [-0.68, 0.34, -0.58, 0.78],
    [0.7, 0.38, 0.56, 0.78],
    [0.0, 0.64, 0.08, 0.82],
    [0.76, -0.32, 0.48, 0.7],
  ];
  const plazaCanopyGeo = tracker.trackGeo(
    mergeGeometries(
      plazaCanopyPuffs.map(([px, py, pz, r], idx) => {
        const g = new THREE.IcosahedronGeometry(r, 2);
        const pos = g.attributes.position;
        const freq = 3.2 + (idx % 3) * 0.4;
        for (let k = 0; k < pos.count; k++) {
          const vx = pos.getX(k);
          const vy = pos.getY(k);
          const vz = pos.getZ(k);
          const len = Math.hypot(vx, vy, vz) || 1;
          const d =
            Math.sin(vx * freq + vy * 2.7) *
            Math.cos(vz * freq - vx * 1.9) *
            0.14 *
            r;
          pos.setXYZ(
            k,
            vx + (vx / len) * d,
            vy + (vy / len) * d * 0.85,
            vz + (vz / len) * d,
          );
        }
        g.computeVertexNormals();
        g.scale(1.16, 0.76, 1.16);
        g.translate(px, py, pz);
        return g;
      }),
    ),
  );
  const cordGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.016, 0.016, 1.1, 6),
  );
  cordGeo.translate(0, -0.55, 0);

  // All 6 selective ornamental trees are placed in the 22–35m ring (`r = 25.4m–26.8m`), leaving 0–22m 100% tree-free!
  const plazaFramingTreeCoords = [
    { x: -13.6, z: -21.8, rotY: 0.55, scale: 0.92 }, // SW Outer Promenade Pocket (r = 25.7m)
    { x: 13.6, z: -21.8, rotY: -0.55, scale: 0.96 }, // SE Outer Promenade Pocket (r = 25.7m)
    { x: -13.8, z: 22.0, rotY: 2.45, scale: 0.94 }, // NW Outer Promenade Pocket (r = 26.0m)
    { x: 13.8, z: 22.0, rotY: -2.45, scale: 0.9 }, // NE Outer Promenade Pocket (r = 26.0m)
    { x: -24.8, z: -8.5, rotY: Math.PI / 2, scale: 0.88 }, // WSW Garden Pocket (r = 26.2m)
    { x: 24.8, z: -8.5, rotY: -Math.PI / 2, scale: 0.92 }, // ESE Garden Pocket (r = 26.2m)
  ];

  plazaFramingTreeCoords.forEach((tc) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tc.x, baseElevation, tc.z);
    tGroup.rotation.y = tc.rotY;
    tGroup.scale.setScalar(tc.scale);

    // Grounded Stone Tree-Ring Planter & Under-Planted Shrub Bed
    const planterCurb = new THREE.Mesh(treePlanterStoneGeo, mats.creamStone);
    planterCurb.castShadow = true;
    planterCurb.receiveShadow = true;
    const planterSoil = new THREE.Mesh(treePlanterSoilGeo, hedgeFoliageMat);
    planterSoil.receiveShadow = true;

    const trunk = new THREE.Mesh(plazaTreeTrunkGeo, mats.darkWalnut);
    trunk.castShadow = true;
    const bough = new THREE.Mesh(plazaTreeBoughGeo, mats.darkWalnut);
    bough.position.set(0, 3.85, 0);
    bough.rotation.z = -0.78;

    const c1 = new THREE.Mesh(plazaCanopyGeo, hedgeFoliageMat);
    c1.position.set(0, 5.25, 0);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(plazaCanopyGeo, lushTurfMat);
    c2.scale.setScalar(0.75);
    c2.position.set(1.08, 4.65, 0.35);
    c2.castShadow = true;

    // Hanging warm lantern & restrained ruby heart ornament from the overhanging bough
    const cord1 = new THREE.Mesh(cordGeo, mats.wroughtBronze);
    cord1.position.set(1.48, 4.75, 0);
    const lantern1 = new THREE.Mesh(lanternBodyGeo, mats.warmLanternGlow);
    lantern1.position.set(1.48, 2.38, 0);

    const cord2 = new THREE.Mesh(cordGeo, mats.brushedGold);
    cord2.position.set(0.88, 4.95, 0.48);
    const heartOrnament = new THREE.Mesh(
      extrudedHeartEmblemGeo,
      rubyHeartLanternMat,
    );
    heartOrnament.scale.setScalar(0.24);
    heartOrnament.position.set(0.88, 3.82, 0.48);

    tGroup.add(
      planterCurb,
      planterSoil,
      trunk,
      bough,
      c1,
      c2,
      cord1,
      lantern1,
      cord2,
      heartOrnament,
    );
    group.add(tGroup);
    colliders.push({ x: tc.x, z: tc.z, radius: 1.35 * tc.scale });
  });

  // ============================================================================
  // 5. RING 3: SOARING FAIRY-TALE CLOCK TOWER & MULTI-SPIRE CASTLE BACKING
  // ============================================================================
  const clockTowerGroup = new THREE.Group();
  clockTowerGroup.position.set(0, baseElevation, 26.5);
  group.add(clockTowerGroup);

  colliders.push(
    { x: -4.4, z: 26.5, radius: 2.2 },
    { x: 4.4, z: 26.5, radius: 2.2 },
    { x: -9.2, z: 27.5, radius: 2.25 },
    { x: 9.2, z: 27.5, radius: 2.25 },
  );

  // Grounded Stepped Stone Foundation Plinths under the Clock Tower Piers
  const towerPierPlinthGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.6, 0.65, 4.6, 0.06),
  );
  [-4.4, 4.4].forEach((px) => {
    const pPlinth = new THREE.Mesh(towerPierPlinthGeo, mats.warmSandstone);
    pPlinth.position.set(px, 0, 0);
    pPlinth.castShadow = true;
    pPlinth.receiveShadow = true;
    clockTowerGroup.add(pPlinth);
  });

  // Pointed Vaulted Gothic-Romantic Pass-Through Archway
  const clockArchGeo = tracker.trackGeo(
    createExtrudedArchwayGeometry(11.8, 10.4, 5.8, 7.8, 4.0),
  );
  const clockArchMesh = new THREE.Mesh(clockArchGeo, mats.creamStone);
  clockArchMesh.castShadow = true;
  clockArchMesh.receiveShadow = true;
  clockTowerGroup.add(clockArchMesh);

  const corniceGeo = tracker.trackGeo(
    createBeveledBoxGeometry(12.6, 0.52, 4.45, 0.05),
  );
  corniceGeo.translate(0, 10.25, 0);
  const corniceMesh = new THREE.Mesh(corniceGeo, mats.brushedGold);
  clockTowerGroup.add(corniceMesh);

  // Central Slender Multi-Tiered Clock Tower Shaft with Beveled Corner Pilasters & Stringcourses
  const lowerShaftGeo = tracker.trackGeo(
    createBeveledBoxGeometry(4.8, 8.5, 4.8, 0.08),
  );
  lowerShaftGeo.translate(0, 10.5, 0);
  const midStringCourseGeo = tracker.trackGeo(
    createBeveledBoxGeometry(5.2, 0.42, 5.2, 0.05),
  );
  midStringCourseGeo.translate(0, 18.85, 0);
  const belfryStageGeo = tracker.trackGeo(
    createBeveledBoxGeometry(4.4, 5.2, 4.4, 0.08),
  );
  belfryStageGeo.translate(0, 19.1, 0);
  const upperCorniceGeo = tracker.trackGeo(
    createBeveledBoxGeometry(4.85, 0.38, 4.85, 0.05),
  );
  upperCorniceGeo.translate(0, 24.15, 0);

  const lowerShaftMesh = new THREE.Mesh(lowerShaftGeo, mats.creamStone);
  const midCourseMesh = new THREE.Mesh(midStringCourseGeo, mats.warmSandstone);
  const belfryStageMesh = new THREE.Mesh(belfryStageGeo, mats.creamStone);
  const upperCorniceMesh = new THREE.Mesh(upperCorniceGeo, mats.brushedGold);
  lowerShaftMesh.castShadow = true;
  belfryStageMesh.castShadow = true;
  clockTowerGroup.add(
    lowerShaftMesh,
    midCourseMesh,
    belfryStageMesh,
    upperCorniceMesh,
  );

  // Recessed Arched Lancet Windows with Molded Stone Sills on the Clock Tower Shaft
  const lancetWinGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.75, 3.6));
  const lancetSillGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.98, 0.16, 0.24, 0.02),
  );
  [-1.1, 1.1].forEach((wx) => {
    const winS = new THREE.Mesh(lancetWinGeo, clockWindowGlowMat);
    winS.position.set(wx, 14.8, -2.44);
    winS.rotation.y = Math.PI;
    const sillS = new THREE.Mesh(lancetSillGeo, mats.warmSandstone);
    sillS.position.set(wx, 12.92, -2.46);

    const winN = new THREE.Mesh(lancetWinGeo, clockWindowGlowMat);
    winN.position.set(wx, 14.8, 2.44);
    const sillN = new THREE.Mesh(lancetSillGeo, mats.warmSandstone);
    sillN.position.set(wx, 12.92, 2.46);
    clockTowerGroup.add(winS, sillS, winN, sillN);
  });

  // 4 Corner Pinnacles around the Clock Belfry + Soaring Royal-Blue Main Spire
  const mainSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(3.2, 11.5, 8));
  mainSpireGeo.translate(0, 29.95, 0);
  const mainSpireMesh = new THREE.Mesh(mainSpireGeo, mats.royalSlateRoof);
  mainSpireMesh.castShadow = true;
  const finialTop = new THREE.Mesh(finialGeo, mats.brushedGold);
  finialTop.position.set(0, 35.8, 0);
  clockTowerGroup.add(mainSpireMesh, finialTop);

  const cornerPinCylGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.45, 0.52, 3.8, 8),
  );
  cornerPinCylGeo.translate(0, 24.2, 0);
  const cornerPinConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.62, 3.2, 8),
  );
  cornerPinConeGeo.translate(0, 27.7, 0);

  [
    [-2.1, -2.1],
    [2.1, -2.1],
    [-2.1, 2.1],
    [2.1, 2.1],
  ].forEach(([px, pz]) => {
    const pCyl = new THREE.Mesh(cornerPinCylGeo, mats.creamStone);
    pCyl.position.set(px, 0, pz);
    const pCone = new THREE.Mesh(cornerPinConeGeo, mats.royalSlateRoof);
    pCone.position.set(px, 0, pz);
    clockTowerGroup.add(pCyl, pCone);
  });

  // Flanking Multi-Turreted Castle Wings with Stepped Base Plinths
  const sideTurretGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.4, 1.55, 8.2, 12),
  );
  sideTurretGeo.translate(0, 14.5, 0);
  const sideRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(1.85, 5.5, 12));
  sideRoofGeo.translate(0, 21.35, 0);

  const outerWingPlinthGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.05, 2.25, 0.75, 12),
  );
  outerWingPlinthGeo.translate(0, 0.375, 0);
  const outerWingTurretGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.65, 1.85, 13.5, 12),
  );
  outerWingTurretGeo.translate(0, 6.75, 0);
  const outerWingRoofGeo = tracker.trackGeo(
    new THREE.ConeGeometry(2.15, 6.2, 12),
  );
  outerWingRoofGeo.translate(0, 16.6, 0);

  [-4.4, 4.4].forEach((tx) => {
    const tCyl = new THREE.Mesh(sideTurretGeo, mats.creamStone);
    tCyl.position.x = tx;
    tCyl.castShadow = true;
    const tRoof = new THREE.Mesh(sideRoofGeo, mats.royalSlateRoof);
    tRoof.position.x = tx;
    tRoof.castShadow = true;
    const tFinial = new THREE.Mesh(finialGeo, mats.brushedGold);
    tFinial.position.set(tx, 24.2, 0);
    clockTowerGroup.add(tCyl, tRoof, tFinial);
  });

  [-9.2, 9.2].forEach((ox) => {
    const oPlinth = new THREE.Mesh(outerWingPlinthGeo, mats.warmSandstone);
    oPlinth.position.set(ox, 0, 1.0);
    const oCyl = new THREE.Mesh(outerWingTurretGeo, mats.creamStone);
    oCyl.position.set(ox, 0, 1.0);
    oCyl.castShadow = true;
    const oRoof = new THREE.Mesh(outerWingRoofGeo, mats.royalSlateRoof);
    oRoof.position.set(ox, 0, 1.0);
    oRoof.castShadow = true;
    const oWin = new THREE.Mesh(lancetWinGeo, clockWindowGlowMat);
    oWin.position.set(ox, 9.5, -0.88);
    oWin.rotation.y = Math.PI;
    clockTowerGroup.add(oPlinth, oCyl, oRoof, oWin);
  });

  // Illuminated Clock Faces with 3D Brushed-Gold Bezel Rings on All 4 Cardinal Sides
  const clockTex = tracker.trackTex(createClockFaceTexture(maxAniso));
  const clockDialGeo = tracker.trackGeo(new THREE.CircleGeometry(1.68, 24));
  const clockBezelGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.72, 0.1, 10, 32),
  );
  const clockDialMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: clockTex,
      color: new THREE.Color('#f7ecd0'),
    }),
  );

  const dialPlacements: Array<[number, number, number, number]> = [
    [0, 21.6, -2.25, Math.PI],
    [0, 21.6, 2.25, 0],
    [2.25, 21.6, 0, Math.PI / 2],
    [-2.25, 21.6, 0, -Math.PI / 2],
  ];
  dialPlacements.forEach(([dx, dy, dz, ry]) => {
    const dial = new THREE.Mesh(clockDialGeo, clockDialMat);
    dial.position.set(dx, dy, dz);
    dial.rotation.y = ry;
    const bezel = new THREE.Mesh(clockBezelGeo, mats.brushedGold);
    bezel.position.set(dx, dy, dz);
    bezel.rotation.y = ry;
    clockTowerGroup.add(dial, bezel);
  });

  const minuteHandGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.1, 1.22, 0.06),
  );
  minuteHandGeo.translate(0, 0.5, 0);
  const hourHandGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.13, 0.82, 0.06),
  );
  hourHandGeo.translate(0, 0.34, 0);
  const minuteHand = new THREE.Mesh(minuteHandGeo, mats.wroughtBronze);
  minuteHand.position.set(0, 21.6, -2.31);
  const hourHand = new THREE.Mesh(hourHandGeo, mats.wroughtBronze);
  hourHand.position.set(0, 21.6, -2.31);
  hourHand.rotation.z = -0.8;
  clockTowerGroup.add(minuteHand, hourHand);

  // ============================================================================
  // 6. DETAILED WROUGHT-IRON LAMPPOSTS & FRAMED DIRECTIONAL SIGNPOSTS
  // ============================================================================
  // Lamppost with Molded Stone Plinth, Stepped Cast-Bronze Base, Tapered Shaft, Collar & Lantern Housing
  const lampStonePlinth = new THREE.CylinderGeometry(0.28, 0.34, 0.32, 8);
  lampStonePlinth.translate(0, 0.16, 0);
  const lampBronzeBase = new THREE.CylinderGeometry(0.18, 0.25, 0.38, 8);
  lampBronzeBase.translate(0, 0.51, 0);
  const lampShaft = new THREE.CylinderGeometry(0.08, 0.13, 3.65, 8);
  lampShaft.translate(0, 2.52, 0);
  const lampCollar = new THREE.TorusGeometry(0.12, 0.035, 6, 12);
  lampCollar.rotateX(Math.PI / 2);
  lampCollar.translate(0, 2.25, 0);
  const lampTopCap = new THREE.ConeGeometry(0.16, 0.28, 8);
  lampTopCap.translate(0, 4.48, 0);
  const lampPostGeo = tracker.trackGeo(
    mergeGeometries([lampBronzeBase, lampShaft, lampCollar, lampTopCap]),
  );
  const lampStoneBaseGeo = tracker.trackGeo(lampStonePlinth);

  const lampCrossbarGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.42, 0.085, 0.085, 0.015),
  );
  lampCrossbarGeo.translate(0, 4.12, 0);
  const lampCageGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.22, 0.14, 0.46, 6),
  );
  const lampHoodGeo = tracker.trackGeo(new THREE.ConeGeometry(0.27, 0.2, 6));
  const bannerGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.64, 1.58));
  bannerGeo.translate(0, 2.95, 0);
  const lampContactGeo = tracker.trackGeo(new THREE.CircleGeometry(0.46, 12));
  lampContactGeo.rotateX(-Math.PI / 2);

  function createOrnateLamppost(x: number, z: number, rotY: number) {
    const lGroup = new THREE.Group();
    const ly = getTerrainHeight(x, z);
    lGroup.position.set(x, ly, z);
    lGroup.rotation.y = rotY;

    const contact = new THREE.Mesh(lampContactGeo, contactGroundMat);
    contact.position.y = 0.02;
    const stoneBase = new THREE.Mesh(lampStoneBaseGeo, mats.warmSandstone);
    stoneBase.receiveShadow = true;
    const post = new THREE.Mesh(lampPostGeo, mats.wroughtBronze);
    post.castShadow = true;
    const bar = new THREE.Mesh(lampCrossbarGeo, mats.brushedGold);

    const globeL = new THREE.Mesh(lampCageGeo, mats.warmLanternGlow);
    globeL.position.set(-0.58, 4.4, 0);
    const hoodL = new THREE.Mesh(lampHoodGeo, mats.wroughtBronze);
    hoodL.position.set(-0.58, 4.72, 0);

    const globeR = new THREE.Mesh(lampCageGeo, mats.warmLanternGlow);
    globeR.position.set(0.58, 4.4, 0);
    const hoodR = new THREE.Mesh(lampHoodGeo, mats.wroughtBronze);
    hoodR.position.set(0.58, 4.72, 0);

    const bannerL = new THREE.Mesh(bannerGeo, mats.crimsonVelvet);
    bannerL.position.x = -0.46;
    const bannerR = new THREE.Mesh(bannerGeo, mats.crimsonVelvet);
    bannerR.position.x = 0.46;

    lGroup.add(
      contact,
      stoneBase,
      post,
      bar,
      globeL,
      hoodL,
      globeR,
      hoodR,
      bannerL,
      bannerR,
    );
    group.add(lGroup);
  }

  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const r = i % 2 === 0 ? 11.8 : 23.2;
    const lx = Math.sin(ang) * r;
    const lz = Math.cos(ang) * r;
    createOrnateLamppost(lx, lz, ang);
  }

  // Upgraded Signposts with Stone Plinth, Bronze Mounting Collar & Beveled Frame (Section 17)
  const signBasePlinth = new THREE.CylinderGeometry(0.24, 0.3, 0.28, 8);
  signBasePlinth.translate(0, 0.14, 0);
  const signShaft = new THREE.CylinderGeometry(0.095, 0.125, 2.95, 8);
  signShaft.translate(0, 1.65, 0);
  const signCollar1 = new THREE.TorusGeometry(0.12, 0.03, 6, 12);
  signCollar1.rotateX(Math.PI / 2);
  signCollar1.translate(0, 2.28, 0);
  const signCollar2 = new THREE.TorusGeometry(0.12, 0.03, 6, 12);
  signCollar2.rotateX(Math.PI / 2);
  signCollar2.translate(0, 2.82, 0);
  const signPostPoleGeo = tracker.trackGeo(
    mergeGeometries([signShaft, signCollar1, signCollar2]),
  );
  const signStoneBaseGeo = tracker.trackGeo(signBasePlinth);
  const signFrameBackGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.42, 0.82, 0.09, 0.025),
  );
  const signBoardGeo = tracker.trackGeo(
    new THREE.BoxGeometry(2.26, 0.68, 0.13),
  );

  PLAZA_RADIAL_SPOKES.forEach((spoke) => {
    const dirX = spoke.bx - spoke.ax;
    const dirZ = spoke.bz - spoke.az;
    const angle = Math.atan2(dirX, dirZ);

    [28.8, 40.5].forEach((rDist) => {
      const cx = Math.sin(angle) * rDist;
      const cz = Math.cos(angle) * rDist;
      const perpX = Math.cos(angle) * 3.75;
      const perpZ = -Math.sin(angle) * 3.75;
      createOrnateLamppost(cx + perpX, cz + perpZ, angle + Math.PI / 2);
      createOrnateLamppost(cx - perpX, cz - perpZ, angle + Math.PI / 2);
    });

    const signX = Math.sin(angle) * 25.4 + Math.cos(angle) * 3.65;
    const signZ = Math.cos(angle) * 25.4 - Math.sin(angle) * 3.65;
    const signY = getTerrainHeight(signX, signZ);

    const signGroup = new THREE.Group();
    signGroup.position.set(signX, signY, signZ);
    signGroup.rotation.y = Math.atan2(-signX, -signZ);

    const sBase = new THREE.Mesh(signStoneBaseGeo, mats.warmSandstone);
    const pole = new THREE.Mesh(signPostPoleGeo, mats.wroughtBronze);
    pole.castShadow = true;
    const topCap = new THREE.Mesh(finialGeo, mats.brushedGold);
    topCap.position.y = 3.22;
    topCap.scale.setScalar(0.52);

    const signTex = tracker.trackTex(
      createSignpostTexture(
        spoke.label,
        spoke.directionLabel,
        spoke.accentColor,
        maxAniso,
        false,
      ),
    );
    const faceMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: signTex,
        color: new THREE.Color('#ede7df'),
      }),
    );

    const frameBacking = new THREE.Mesh(signFrameBackGeo, mats.wroughtBronze);
    frameBacking.position.set(0.32, 2.14, 0);
    frameBacking.castShadow = true;

    const board = new THREE.Mesh(signBoardGeo, [
      mats.brushedGold,
      mats.brushedGold,
      mats.brushedGold,
      mats.brushedGold,
      faceMat,
      faceMat,
    ]);
    board.position.set(0.32, 2.55, 0);
    board.castShadow = true;

    signGroup.add(sBase, pole, topCap, frameBacking, board);
    group.add(signGroup);
  });

  // ============================================================================
  // 6B. ILLUMINATED 2D MASTER PARK MAP & CENTRAL PLAZA VISTA BOARDS
  // ============================================================================
  const texLoader = new THREE.TextureLoader();
  const dirPostGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.11, 0.14, 3.0, 10),
  );
  dirPostGeo.translate(0, 1.5, 0);
  const dirPlinthGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.42, 0.32, 0.42, 0.03),
  );
  const dirFrameGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.54, 2.28, 0.18, 0.04),
  );
  const dirArtPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(3.2, 1.95));
  const dirCrownGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.78, 0.24, 0.28, 0.03),
  );

  function createParkDirectoryBoard(
    x: number,
    z: number,
    rotY: number,
    imageUrl: string,
  ) {
    const dGroup = new THREE.Group();
    const dy = getTerrainHeight(x, z);
    dGroup.position.set(x, dy, z);
    dGroup.rotation.y = rotY;

    const plinthL = new THREE.Mesh(dirPlinthGeo, mats.warmSandstone);
    plinthL.position.x = -1.45;
    const plinthR = new THREE.Mesh(dirPlinthGeo, mats.warmSandstone);
    plinthR.position.x = 1.45;

    const postL = new THREE.Mesh(dirPostGeo, mats.wroughtBronze);
    postL.position.x = -1.45;
    postL.castShadow = true;
    const postR = new THREE.Mesh(dirPostGeo, mats.wroughtBronze);
    postR.position.x = 1.45;
    postR.castShadow = true;

    const frame = new THREE.Mesh(dirFrameGeo, mats.brushedGold);
    frame.position.set(0, 0.94, 0);
    frame.castShadow = true;

    const loadedTex = tracker.trackTex(texLoader.load(imageUrl));
    loadedTex.colorSpace = THREE.SRGBColorSpace;
    loadedTex.anisotropy = maxAniso;

    const boardFaceMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: loadedTex,
        color: new THREE.Color('#ede7df'),
      }),
    );

    const artFront = new THREE.Mesh(dirArtPlaneGeo, boardFaceMat);
    artFront.position.set(0, 2.08, 0.11);
    const artBack = new THREE.Mesh(dirArtPlaneGeo, boardFaceMat);
    artBack.position.set(0, 2.08, -0.11);
    artBack.rotation.y = Math.PI;

    const crown = new THREE.Mesh(dirCrownGeo, mats.brushedGold);
    crown.position.set(0, 3.16, 0);

    const heartTop = new THREE.Mesh(
      extrudedHeartEmblemGeo,
      rubyHeartLanternMat,
    );
    heartTop.scale.setScalar(0.3);
    heartTop.position.set(0, 3.62, 0);

    dGroup.add(
      plinthL,
      plinthR,
      postL,
      postR,
      frame,
      artFront,
      artBack,
      crown,
      heartTop,
    );
    group.add(dGroup);
    colliders.push({ x, z, radius: 1.4 });
  }

  createParkDirectoryBoard(
    -6.8,
    -16.2,
    0.26,
    '/assets/vistas/art_aerial_map.jpg',
  );
  createParkDirectoryBoard(
    6.8,
    17.5,
    Math.PI - 0.26,
    '/assets/vistas/art_central_plaza.jpg',
  );

  // ============================================================================
  // 6C. REUSABLE ARCHITECTURAL BOULEVARD GATEWAY COMPONENT (SECTIONS 12–16)
  // ============================================================================
  // Shared layered geometries for the Central Plaza Gateway architectural family:
  // Warm stone primary structure, stepped plinths, tapered columns, decorative capitals,
  // layered stone arch, brushed-gold trim, integrated zone signage, and flanking low planter boxes.
  const gwPierStep1Geo = tracker.trackGeo(
    createBeveledBoxGeometry(2.38, 0.42, 2.42, 0.05),
  );
  const gwPierStep2Geo = tracker.trackGeo(
    createBeveledBoxGeometry(2.08, 0.48, 2.14, 0.045),
  );
  gwPierStep2Geo.translate(0, 0.4, 0);

  const gwTaperedColumnGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.46, 0.58, 4.55, 12),
  );
  gwTaperedColumnGeo.translate(0, 3.12, 0);

  const gwCapitalNeckGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.5, 0.065, 8, 20),
  );
  gwCapitalNeckGeo.rotateX(Math.PI / 2);
  gwCapitalNeckGeo.translate(0, 5.38, 0);

  const gwCapitalAbacusGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.16, 0.36, 2.18, 0.04),
  );
  gwCapitalAbacusGeo.translate(0, 5.42, 0);

  // Main Layered Arch Span (Total Width 10.4m, Clear Opening 6.2m wide × 6.7m tall)
  const gwMainArchGeo = tracker.trackGeo(
    createExtrudedArchwayGeometry(10.4, 8.45, 6.2, 6.7, 1.78),
  );
  const gwInnerArchivoltGeo = tracker.trackGeo(
    createExtrudedArchwayGeometry(9.6, 8.05, 6.08, 6.62, 1.94),
  );
  const gwGoldArchMoldGeo = tracker.trackGeo(
    new THREE.TorusGeometry(3.22, 0.11, 10, 32, Math.PI),
  );
  gwGoldArchMoldGeo.translate(0, 4.35, 0);

  // Upper Entablature Frieze, Cornice & Central Crest Pediment
  const gwEntablatureGeo = tracker.trackGeo(
    createBeveledBoxGeometry(10.85, 0.68, 2.12, 0.05),
  );
  gwEntablatureGeo.translate(0, 8.38, 0);
  const gwCorniceGeo = tracker.trackGeo(
    createBeveledBoxGeometry(11.35, 0.34, 2.34, 0.04),
  );
  gwCorniceGeo.translate(0, 9.02, 0);
  const gwCrestPedimentGeo = tracker.trackGeo(
    createBeveledBoxGeometry(3.65, 0.85, 1.45, 0.05),
  );
  gwCrestPedimentGeo.translate(0, 9.32, 0);

  // Integrated Framed Zone-Name Sign Plaque on Both Sides of the Gateway Entablature
  const gwSignFrameGeo = tracker.trackGeo(
    createBeveledBoxGeometry(4.85, 0.96, 0.16, 0.03),
  );
  const gwSignFaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.56, 0.76));

  // Pillar Accent Inlay Strip & Flanking Low Stone Planter Box (Section 13 & 19)
  const gwAccentInlayGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.28, 3.3, 0.12, 0.02),
  );
  const gwPlanterBoxGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.65, 0.52, 2.25, 0.045),
  );
  const gwPlanterHedgeGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.32, 0.44, 1.88, 0.06),
  );
  gwPlanterHedgeGeo.translate(0, 0.48, 0);

  const gwPillarUrnBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.38, 0.28, 0.55, 10),
  );
  gwPillarUrnBaseGeo.translate(0, 9.62, 0);
  const gwPillarUrnOrbGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.36, 12, 12),
  );
  gwPillarUrnOrbGeo.translate(0, 10.12, 0);

  const gwContactPadGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.75, 2.75));
  gwContactPadGeo.rotateX(-Math.PI / 2);

  // Zone-specific top crest emblem geometries (shared & tracked)
  const gwCrystalSpireGeo = tracker.trackGeo(
    new THREE.OctahedronGeometry(0.52, 0),
  );
  gwCrystalSpireGeo.scale(0.85, 1.65, 0.85);
  const gwBrickStudCrestGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.15, 0.65, 0.55, 0.04),
  );
  const gwThrillWheelGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.56, 0.1, 8, 20),
  );
  const gwFashionBowLoopGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.42, 0.12, 8, 18),
  );

  // Store flanking gateway planter flower anchor points so Section 7 populates them with low flowers
  const gatewayPlanterFlowerSpots: Array<{
    x: number;
    y: number;
    z: number;
    color: THREE.Color;
  }> = [];

  function createBoulevardGateway(cfg: GatewayConfig) {
    const spoke = PLAZA_RADIAL_SPOKES[cfg.spokeIndex];
    const angle = Math.atan2(spoke.bx - spoke.ax, spoke.bz - spoke.az);
    const gx = Math.sin(angle) * cfg.radialDistance;
    const gz = Math.cos(angle) * cfg.radialDistance;
    const gy = getTerrainHeight(gx, gz);

    const gwGroup = new THREE.Group();
    gwGroup.name = `BoulevardGateway_${cfg.id}`;
    gwGroup.position.set(gx, gy, gz);
    gwGroup.rotation.y = angle;
    group.add(gwGroup);

    const primaryAccentMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.primaryAccentHex),
        roughness: 0.38,
        metalness: 0.18,
      }),
    );
    const secondaryTrimMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.secondaryTrimHex),
        roughness: 0.34,
        metalness: 0.32,
      }),
    );

    // 1. Layered Stone Archway & Brushed-Gold Archivolts
    const mainArch = new THREE.Mesh(gwMainArchGeo, mats.creamStone);
    mainArch.castShadow = true;
    mainArch.receiveShadow = true;
    const innerArchivolt = new THREE.Mesh(
      gwInnerArchivoltGeo,
      mats.warmSandstone,
    );
    innerArchivolt.castShadow = true;
    innerArchivolt.receiveShadow = true;

    const goldMoldFront = new THREE.Mesh(gwGoldArchMoldGeo, mats.brushedGold);
    goldMoldFront.position.z = -0.96;
    const goldMoldBack = new THREE.Mesh(gwGoldArchMoldGeo, mats.brushedGold);
    goldMoldBack.position.z = 0.96;

    // 2. Stepped Entablature, Gilded Cornice & Central Pediment
    const entablature = new THREE.Mesh(gwEntablatureGeo, mats.warmSandstone);
    entablature.castShadow = true;
    const cornice = new THREE.Mesh(gwCorniceGeo, mats.brushedGold);
    cornice.castShadow = true;
    const pediment = new THREE.Mesh(gwCrestPedimentGeo, mats.creamStone);
    pediment.castShadow = true;

    gwGroup.add(
      mainArch,
      innerArchivolt,
      goldMoldFront,
      goldMoldBack,
      entablature,
      cornice,
      pediment,
    );

    // 3. Left & Right Grounded Pillars, Capitals, Lantern Sconces & Low Planter Boxes
    [-4.15, 4.15].forEach((pierX, sideIdx) => {
      const contact = new THREE.Mesh(gwContactPadGeo, contactGroundMat);
      contact.position.set(pierX, 0.02, 0);

      const step1 = new THREE.Mesh(gwPierStep1Geo, mats.warmSandstone);
      step1.position.x = pierX;
      step1.receiveShadow = true;
      const step2 = new THREE.Mesh(gwPierStep2Geo, mats.creamStone);
      step2.position.x = pierX;
      step2.receiveShadow = true;

      // Engaged Tapered Column Shafts on Plaza-Facing (-Z) & Zone-Facing (+Z) Pier Faces
      [-0.86, 0.86].forEach((cz) => {
        const col = new THREE.Mesh(gwTaperedColumnGeo, mats.creamStone);
        col.position.set(pierX, 0, cz);
        col.castShadow = true;
        const neck = new THREE.Mesh(gwCapitalNeckGeo, mats.brushedGold);
        neck.position.set(pierX, 0, cz);
        gwGroup.add(col, neck);
      });

      const abacus = new THREE.Mesh(gwCapitalAbacusGeo, mats.brushedGold);
      abacus.position.x = pierX;

      // Zone-Colored Vertical Inlay Strip & Warm Bronze Lantern Sconce facing the Central Plaza
      const inlay = new THREE.Mesh(gwAccentInlayGeo, primaryAccentMat);
      inlay.position.set(pierX, 1.85, -1.04);

      const sconceBody = new THREE.Mesh(lanternBodyGeo, mats.warmLanternGlow);
      sconceBody.position.set(pierX, 2.35, -1.22);
      const sconceCap = new THREE.Mesh(lanternCapGeo, mats.wroughtBronze);
      sconceCap.position.set(pierX, 2.35, -1.22);

      // Pillar Crown Finial Urn in Zone Secondary Trim Color
      const urnBase = new THREE.Mesh(gwPillarUrnBaseGeo, mats.brushedGold);
      urnBase.position.x = pierX;
      const urnOrb = new THREE.Mesh(gwPillarUrnOrbGeo, secondaryTrimMat);
      urnOrb.position.x = pierX;

      gwGroup.add(
        contact,
        step1,
        step2,
        abacus,
        inlay,
        sconceBody,
        sconceCap,
        urnBase,
        urnOrb,
      );

      // Register accurate pier collider (leaves the 6.2m central boulevard opening 100% clear!)
      const worldPierX = gx + Math.cos(angle) * pierX;
      const worldPierZ = gz - Math.sin(angle) * pierX;
      colliders.push({ x: worldPierX, z: worldPierZ, radius: 1.25 });

      // Flanking Low Stone Planter Box with Boxwood Hedge (`Gateway → low flowers → hedge → open path`)
      const planterOffsetX = sideIdx === 0 ? -5.85 : 5.85;
      const planterBox = new THREE.Mesh(gwPlanterBoxGeo, mats.warmSandstone);
      planterBox.position.set(planterOffsetX, 0, 0);
      planterBox.castShadow = true;
      planterBox.receiveShadow = true;
      const planterHedge = new THREE.Mesh(gwPlanterHedgeGeo, hedgeFoliageMat);
      planterHedge.position.set(planterOffsetX, 0, 0);
      planterHedge.castShadow = true;
      gwGroup.add(planterBox, planterHedge);

      // Record world flower cluster spots on top of the lowgateway planter box
      [-0.55, 0, 0.55].forEach((zLocal) => {
        const wx =
          gx +
          Math.cos(angle) * planterOffsetX +
          Math.sin(angle) * zLocal;
        const wz =
          gz -
          Math.sin(angle) * planterOffsetX +
          Math.cos(angle) * zLocal;
        gatewayPlanterFlowerSpots.push({
          x: wx,
          y: gy + 0.72,
          z: wz,
          color: new THREE.Color(cfg.primaryAccentHex),
        });
      });
    });

    // 4. Integrated Zone-Name Sign Plaque (Plaza-Facing & Zone-Facing)
    const signTex = tracker.trackTex(
      createSignpostTexture(
        cfg.zoneTitle,
        cfg.zoneSubtitle,
        cfg.primaryAccentHex,
        maxAniso,
        true,
      ),
    );
    const signFaceMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: signTex,
        color: new THREE.Color('#f2ece1'),
      }),
    );

    [-1.08, 1.08].forEach((sz, faceIdx) => {
      const sFrame = new THREE.Mesh(gwSignFrameGeo, mats.wroughtBronze);
      sFrame.position.set(0, 7.65, sz);
      const sFace = new THREE.Mesh(gwSignFaceGeo, signFaceMat);
      sFace.position.set(0, 8.13, sz + (faceIdx === 0 ? -0.1 : 0.1));
      if (faceIdx === 0) sFace.rotation.y = Math.PI;
      gwGroup.add(sFrame, sFace);
    });

    // 5. Restrained Central Heart Crest Frame + Data-Driven Zone Emblem on Top of the Gateway
    const crestHeartFrame = new THREE.Mesh(
      extrudedHeartEmblemGeo,
      mats.brushedGold,
    );
    crestHeartFrame.scale.setScalar(0.78);
    crestHeartFrame.position.set(0, 10.65, 0);
    gwGroup.add(crestHeartFrame);

    if (cfg.motifType === 'magic' || cfg.motifType === 'aurora') {
      const crystalMat =
        cfg.motifType === 'magic' ? mats.magicVioletGlow : mats.auroraCyanGlow;
      const spire = new THREE.Mesh(gwCrystalSpireGeo, crystalMat);
      spire.position.set(0, 10.68, 0);
      gwGroup.add(spire);
    } else if (cfg.motifType === 'brick') {
      const brickCrest = new THREE.Mesh(gwBrickStudCrestGeo, primaryAccentMat);
      brickCrest.position.set(0, 10.35, 0);
      gwGroup.add(brickCrest);
    } else if (cfg.motifType === 'thrill') {
      const wheelEmblem = new THREE.Mesh(gwThrillWheelGeo, secondaryTrimMat);
      wheelEmblem.position.set(0, 10.65, 0);
      gwGroup.add(wheelEmblem);
    } else if (cfg.motifType === 'fashion') {
      const bowL = new THREE.Mesh(gwFashionBowLoopGeo, secondaryTrimMat);
      bowL.position.set(-0.36, 10.65, 0);
      bowL.rotation.z = 0.25;
      const bowR = new THREE.Mesh(gwFashionBowLoopGeo, secondaryTrimMat);
      bowR.position.set(0.36, 10.65, 0);
      bowR.rotation.z = -0.25;
      gwGroup.add(bowL, bowR);
    } else {
      const innerHeart = new THREE.Mesh(
        extrudedHeartEmblemGeo,
        rubyHeartLanternMat,
      );
      innerHeart.scale.setScalar(0.48);
      innerHeart.position.set(0, 10.65, 0);
      gwGroup.add(innerHeart);
    }
  }

  // Instantiate all 6 Boulevard Gateways using the unified Gateway component
  BOULEVARD_GATEWAYS.forEach((gwCfg) => {
    createBoulevardGateway(gwCfg);
  });

  // ============================================================================
  // 7. NATURAL BOTANICAL LANDSCAPE COMPOSITION (CLUSTERED SHRUBS & BLOSSOMS)
  // ============================================================================
  const flowerCount = 680;

  // 7A. Lush Low Dark-Green Leafy Shrub Cushion
  const shrubPuffCoords: Array<[number, number, number, number]> = [
    [0.0, 0.14, 0.0, 0.22],
    [-0.16, 0.11, 0.08, 0.17],
    [0.16, 0.11, -0.07, 0.17],
    [0.05, 0.11, 0.16, 0.16],
    [-0.06, 0.11, -0.15, 0.16],
  ];
  const shrubGeo = tracker.trackGeo(
    mergeGeometries(
      shrubPuffCoords.map(([sx, sy, sz, sr]) => {
        const g = new THREE.IcosahedronGeometry(sr, 1);
        g.scale(1.25, 0.68, 1.25);
        g.translate(sx, sy, sz);
        return g;
      }),
    ),
  );
  const shrubMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, flowerCount);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;
  group.add(shrubInst);

  // 7B. Delicate 6-Bud Multi-Blossom Cluster
  const floretOffsets: Array<[number, number, number, number]> = [
    [0.0, 0.27, 0.0, 0.082],
    [-0.14, 0.23, 0.07, 0.074],
    [0.14, 0.24, -0.06, 0.076],
    [0.06, 0.23, 0.14, 0.072],
    [-0.07, 0.22, -0.14, 0.072],
    [0.11, 0.21, 0.11, 0.066],
  ];
  const flowerGeo = tracker.trackGeo(
    mergeGeometries(
      floretOffsets.map(([fx, fy, fz, fr]) => {
        const b = new THREE.DodecahedronGeometry(fr, 1);
        b.scale(1.15, 0.78, 1.15);
        b.translate(fx, fy, fz);
        return b;
      }),
    ),
  );
  const flowerMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.66,
      metalness: 0.02,
    }),
  );
  const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerInst.castShadow = true;
  flowerInst.receiveShadow = true;
  group.add(flowerInst);

  const shrubGreens = [
    new THREE.Color('#275933'),
    new THREE.Color('#316b3d'),
    new THREE.Color('#3b7a44'),
  ];

  const flowerColors = [
    new THREE.Color('#e11d48'), // Valentine Crimson Rose
    new THREE.Color('#f472b6'), // Blush Pink Hydrangea
    new THREE.Color('#9333ea'), // Royal Lavender
    new THREE.Color('#f59e0b'), // Warm Marigold Gold
    new THREE.Color('#ffe4e6'), // Tea Rose Ivory
  ];

  const dummy = new THREE.Object3D();
  let flowerIdx = 0;

  // Deterministic helper for natural organic cluster variation (Section 4 & 18)
  const detHash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Ring A (0–12m Fountain Core): Very open! Only 8 curated floral pockets nestled beside the 8 stone lantern plinths
  // (Replaces the old 300-plant ring so the marble fountain rim breathes cleanly!)
  for (let p = 0; p < 8; p++) {
    const baseAng = (p / 8) * Math.PI * 2 + Math.PI / 8;
    const speciesColor = flowerColors[p % flowerColors.length];
    for (let c = 0; c < 4 && flowerIdx < flowerCount; c++) {
      const angOffset = ((c - 1.5) * 0.038) + (detHash(p * 11 + c) - 0.5) * 0.015;
      const r = 7.42 + (detHash(p * 19 + c) - 0.5) * 0.34;
      const ang = baseAng + angOffset;
      const s = 0.78 + detHash(p * 23 + c) * 0.28;

      dummy.position.set(
        Math.sin(ang) * r,
        baseElevation + 0.68,
        Math.cos(ang) * r,
      );
      dummy.rotation.set(0, ang + detHash(p + c) * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(flowerIdx, dummy.matrix);
      shrubInst.setColorAt(flowerIdx, shrubGreens[(p + c) % shrubGreens.length]);
      flowerInst.setMatrixAt(flowerIdx, dummy.matrix);
      flowerInst.setColorAt(flowerIdx, speciesColor);
      flowerIdx++;
    }
  }

  // Ring B (12–22m Inner Parterre Ring): Natural Multi-Plant Botanical Drifts inside the 6 Parterre Beds
  // Grouped by species into 5 distinct floral drifts per parterre with varied spacing, scale, and rotation
  for (let i = 0; i < spokeAngles.length; i++) {
    const aStart = spokeAngles[i];
    const aEnd =
      i + 1 < spokeAngles.length
        ? spokeAngles[i + 1]
        : spokeAngles[0] + Math.PI * 2;
    if (aEnd - aStart < 0.45) continue;
    const pStart = aStart + 0.32;
    const pEnd = aEnd - 0.32;

    const clusterCenters = [0.14, 0.32, 0.5, 0.68, 0.86];
    clusterCenters.forEach((tCenter, cIdx) => {
      const centerAng = THREE.MathUtils.lerp(pStart, pEnd, tCenter);
      const driftColor = flowerColors[(i * 2 + cIdx) % flowerColors.length];
      const plantsInDrift = 5 + (cIdx % 3);

      for (let m = 0; m < plantsInDrift && flowerIdx < flowerCount; m++) {
        const seed = i * 100 + cIdx * 17 + m;
        const angJitter = (detHash(seed) - 0.5) * 0.085;
        const r = 13.25 + detHash(seed + 7) * 1.28;
        const ang = centerAng + angJitter;
        const s = 0.76 + detHash(seed + 13) * 0.38;

        dummy.position.set(
          Math.sin(ang) * r,
          baseElevation + 0.46,
          Math.cos(ang) * r,
        );
        dummy.rotation.set(
          (detHash(seed + 3) - 0.5) * 0.08,
          detHash(seed + 5) * Math.PI * 2,
          (detHash(seed + 9) - 0.5) * 0.08,
        );
        dummy.scale.set(s, s * (0.88 + detHash(seed + 11) * 0.24), s);
        dummy.updateMatrix();
        shrubInst.setMatrixAt(flowerIdx, dummy.matrix);
        shrubInst.setColorAt(
          flowerIdx,
          shrubGreens[(i + cIdx + m) % shrubGreens.length],
        );
        flowerInst.setMatrixAt(flowerIdx, dummy.matrix);
        flowerInst.setColorAt(flowerIdx, driftColor);
        flowerIdx++;
      }
    });
  }

  // Ring C (22–35m Gateway Planters & Boulevard Approaches):
  // 1) Low flowers inside the flanking Gateway Planter Boxes (Section 19: Gateway → low flowers → hedge → open path)
  gatewayPlanterFlowerSpots.forEach((spot, idx) => {
    for (let k = 0; k < 2 && flowerIdx < flowerCount; k++) {
      const jx = (detHash(idx * 7 + k) - 0.5) * 0.45;
      const jz = (detHash(idx * 13 + k) - 0.5) * 0.45;
      const s = 0.85 + detHash(idx * 19 + k) * 0.25;
      dummy.position.set(spot.x + jx, spot.y, spot.z + jz);
      dummy.rotation.set(0, detHash(idx + k) * Math.PI * 2, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(flowerIdx, dummy.matrix);
      shrubInst.setColorAt(flowerIdx, shrubGreens[(idx + k) % shrubGreens.length]);
      flowerInst.setMatrixAt(flowerIdx, dummy.matrix);
      flowerInst.setColorAt(flowerIdx, spot.color);
      flowerIdx++;
    }
  });

  // 2) Curated Cluster Pockets along the 6 Radial Boulevard Curbs (instead of continuous mechanical rows)
  PLAZA_RADIAL_SPOKES.forEach((spoke, sIdx) => {
    const dirX = spoke.bx - spoke.ax;
    const dirZ = spoke.bz - spoke.az;
    const angle = Math.atan2(dirX, dirZ);
    const spokeTone = new THREE.Color(spoke.accentColor);

    const pocketDistances = [28.4, 34.8, 40.2, 44.6];
    pocketDistances.forEach((dist, pIdx) => {
      const cx = Math.sin(angle) * dist;
      const cz = Math.cos(angle) * dist;
      const cy = getTerrainHeight(cx, cz);

      [-3.45, 3.45].forEach((offsetSide, sideIdx) => {
        for (let cl = 0; cl < 3 && flowerIdx < flowerCount; cl++) {
          const seed = sIdx * 70 + pIdx * 13 + sideIdx * 5 + cl;
          const alongJitter = (detHash(seed) - 0.5) * 1.15;
          const sideJitter = (detHash(seed + 3) - 0.5) * 0.36;
          const fx =
            cx +
            Math.sin(angle) * alongJitter +
            Math.cos(angle) * (offsetSide + sideJitter);
          const fz =
            cz +
            Math.cos(angle) * alongJitter -
            Math.sin(angle) * (offsetSide + sideJitter);
          const s = 0.78 + detHash(seed + 9) * 0.34;

          dummy.position.set(fx, cy + 0.01, fz);
          dummy.rotation.set(0, detHash(seed + 11) * Math.PI * 2, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          shrubInst.setMatrixAt(flowerIdx, dummy.matrix);
          shrubInst.setColorAt(
            flowerIdx,
            shrubGreens[(pIdx + cl) % shrubGreens.length],
          );
          flowerInst.setMatrixAt(flowerIdx, dummy.matrix);
          const col =
            cl % 2 === 0
              ? spokeTone
              : flowerColors[(sIdx + pIdx) % flowerColors.length];
          flowerInst.setColorAt(flowerIdx, col);
          flowerIdx++;
        }
      });
    });
  });

  shrubInst.count = flowerIdx;
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  shrubInst.computeBoundingSphere();

  flowerInst.count = flowerIdx;
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  flowerInst.computeBoundingSphere();

  // Level 6: Magical Micro-Detail Layer — 90 Instanced Floating Golden Light Motes
  const moteCount = 90;
  const moteGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.075, 0));
  const moteMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#f7dfa0'),
      transparent: true,
      opacity: 0.48,
    }),
  );
  const moteInst = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
  moteInst.frustumCulled = false;
  group.add(moteInst);

  return {
    group,
    colliders,
    update(elapsedTime: number) {
      // 0. Advance concentric fountain basin water ripples
      plazaWaterUniforms.uTime.value = elapsedTime;

      // 1. Gently rotate and pulse the glowing crystal heart core inside the fountain
      coreHeartMesh.rotation.y = Math.sin(elapsedTime * 0.9) * 0.38;
      coreHeartMesh.position.y = 6.25 + Math.sin(elapsedTime * 2.2) * 0.15;

      // 2. Slowly advance Clock Tower minute hand
      minuteHand.rotation.z = -elapsedTime * 0.08;

      // 3. Animate the 260 fountain water droplets along vertical jets & heart-arch cascades
      for (let i = 0; i < dropCount; i++) {
        const phase = (elapsedTime * 0.88 + i * 0.068) % 1.0;

        if (i < 144) {
          const jetIdx = i % 36;
          const jetAngle = (jetIdx / 36) * Math.PI * 2;
          const startR = 5.4;
          const endR = 2.6;
          const currR = THREE.MathUtils.lerp(startR, endR, phase);
          const x = Math.sin(jetAngle) * currR;
          const z = Math.cos(jetAngle) * currR;
          const y = 0.72 + Math.sin(phase * Math.PI) * 3.9;

          dummy.position.set(x, y, z);
          dummy.scale.set(0.82, 1.2 + Math.sin(phase * Math.PI) * 0.65, 0.82);
          dummy.rotation.set(0, jetAngle, (phase - 0.5) * 0.85);
        } else {
          const tArch = ((i - 144) / 116) * 0.82 + 0.09;
          const archPt = getHeartCurvePoint(tArch, 4.25, 0);
          const fallY = THREE.MathUtils.lerp(archPt.y + 2.25, 1.35, phase);
          dummy.position.set(
            archPt.x * (1.0 - phase * 0.2),
            fallY,
            (i % 2 === 0 ? 1 : -1) * 0.14,
          );
          dummy.scale.set(0.68, 1.5, 0.68);
          dummy.rotation.set(0, 0, 0);
        }

        dummy.updateMatrix();
        dropInst.setMatrixAt(i, dummy.matrix);
      }
      dropInst.instanceMatrix.needsUpdate = true;

      // 4. Gently drift the 90 magical golden light motes above the Fountain & Parterre Gardens
      for (let m = 0; m < moteCount; m++) {
        const baseAng = (m / moteCount) * Math.PI * 2 + elapsedTime * 0.06;
        const ringR = m < 36 ? 4.8 + (m % 5) * 0.7 : 12.6 + (m % 4) * 0.65;
        const mx = Math.sin(baseAng) * ringR;
        const mz = Math.cos(baseAng) * ringR;
        const my =
          baseElevation +
          1.15 +
          Math.sin(elapsedTime * 1.4 + m * 0.9) * 0.55 +
          (m < 36 ? 1.4 : 0);
        const pulse = 0.65 + Math.sin(elapsedTime * 3.1 + m) * 0.35;

        dummy.position.set(mx, my, mz);
        dummy.scale.setScalar(pulse);
        dummy.rotation.set(elapsedTime + m, elapsedTime * 0.7, 0);
        dummy.updateMatrix();
        moteInst.setMatrixAt(m, dummy.matrix);
      }
      moteInst.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      tracker.dispose();
    },
  };
}
