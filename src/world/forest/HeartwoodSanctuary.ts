/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  ResourceTracker,
  createBeveledBoxGeometry,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  FOREST_LAKE_LOCAL_POS,
  FOREST_SEED,
  HEARTWOOD_SANCTUARY_LOCAL_POS,
  HIDDEN_POOL_LOCAL_POS,
  NORTHERN_SANCTUARY_LOCAL_POINTS,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';
import { ForestAudioSynthesizer } from './ForestAudio';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';

export interface SanctuarySeatAnchor {
  worldPosition: THREE.Vector3;
  lookAtTarget: THREE.Vector3;
  seatYaw: number;
  interactionRadius: number;
}

export type LakePhotoState =
  | 'IDLE'
  | 'WAITING_FOR_E'
  | 'RISING'
  | 'WATER_REVEAL'
  | 'CROSSING'
  | 'MEMORY_REVEAL'
  | 'MEMORY_HOLD'
  | 'DISSOLVE'
  | 'RETURN';

function isLakeMemoryPhaseActive(state: LakePhotoState): boolean {
  return state !== 'IDLE' && state !== 'WAITING_FOR_E';
}

export interface LakePhotoDialogueBanner {
  title: string;
  subtitle: string;
  message: string;
  speaker: string;
  photoUrl?: string;
  stepIndex: number;
  totalSteps: number;
}

export interface LakeMemoryCameraFocus {
  active: boolean;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  playerTurnAlpha?: number;
  embraceAlpha?: number;
  kissAlpha?: number;
  targetPlayerYaw?: number;
}

export interface HeartwoodSanctuaryBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  particleCount: number;
  dynamicLightCount: number;
  sanctuarySeatAnchor: SanctuarySeatAnchor;
  getLakePhotoPrompt: (playerWorldPos: THREE.Vector3) => {
    isNear: boolean;
    title: string;
    actionLabel: string;
  } | null;
  triggerLakePhoto: (
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
    elapsedTime: number,
  ) => boolean;
  isLakePhotoActive: () => boolean;
  advanceLakePhoto: () => boolean;
  skipLakePhoto: () => boolean;
  getLakePhotoBanner: () => LakePhotoDialogueBanner | null;
  getLakeCameraFocus: () => LakeMemoryCameraFocus | null;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

/**
 * Builds a tapered organic TubeGeometry along a 3D curve for roots, trunks, and boughs.
 */
function createOrganicRootOrBranchGeo(
  points: THREE.Vector3[],
  radiusStart: number,
  radiusEnd: number,
  tubularSegments: number,
  radialSegments: number,
  seed: number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    1.0,
    radialSegments,
    false,
  );
  const pos = geo.attributes.position;
  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const center = curve.getPointAt(u);
    const flare = u < 0.2 ? Math.pow(1.0 - u / 0.2, 2.0) * 0.26 : 0.0;
    const baseR =
      THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(u, 0.82)) *
      (1.0 + flare);

    for (let j = 0; j < ringStride; j++) {
      const idx = i * ringStride + j;
      const vx = pos.getX(idx) - center.x;
      const vy = pos.getY(idx) - center.y;
      const vz = pos.getZ(idx) - center.z;
      const ang = (j / radialSegments) * Math.PI * 2;
      const flute =
        1.0 +
        Math.sin(ang * 4.0 + u * 5.0 + seed) * 0.08 +
        Math.cos(ang * 3.0 - u * 4.0 + seed * 1.4) * 0.06;
      const r = baseR * flute;
      pos.setXYZ(idx, center.x + vx * r, center.y + vy * r, center.z + vz * r);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Perturbs an IcosahedronGeometry for organic foliage clusters and mossy cushions.
 */
function createOrganicCanopyClusterGeo(
  rx: number,
  ry: number,
  rz: number,
  detail: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  const freq = 2.6 + (seed % 5) * 0.38;
  const phase = seed * 1.31;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.4 + phase) *
        Math.cos(vz * freq - vx * 1.8 - phase) *
        irregularity +
      Math.sin((vx + vz) * freq * 1.5 + phase) * (irregularity * 0.4);
    pos.setXYZ(
      i,
      (vx + (vx / len) * wave) * rx,
      (vy + (vy / len) * wave * 0.84) * ry,
      (vz + (vz / len) * wave) * rz,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Perturbs a low-poly dodecahedron into an organic mossy boulder or stone slab.
 */
function createCragBoulderGeometry(
  rx: number,
  ry: number,
  rz: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(1.0, 1);
  const pos = geo.attributes.position;
  const freq = 2.9 + (seed % 5) * 0.45;
  const phase = seed * 1.41;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.3 + phase) *
      Math.cos(vz * freq - vx * 1.7 - phase) *
      irregularity;
    pos.setXYZ(
      i,
      (vx + (vx / len) * wave) * rx,
      (vy + (vy / len) * wave * 0.85) * ry,
      (vz + (vz / len) * wave) * rz,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a soft glowing radial particle sprite texture for Sanctuary & Lake motes.
 */
function createLuminousMoteTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  const r = size * 0.5;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.28, 'rgba(165, 243, 252, 0.92)');
  grad.addColorStop(0.62, 'rgba(139, 92, 246, 0.38)');
  grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a procedural water reflection & ripple texture for the Lake, Hidden Pool & Sanctuary Pool.
 */
function createWaterReflectionTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size * 0.48,
    size * 0.48,
    size * 0.04,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  grad.addColorStop(0.0, '#38bdf8'); // Sky opening reflection core
  grad.addColorStop(0.35, '#0f766e'); // Deep teal water
  grad.addColorStop(0.72, '#115e59'); // Mirrored canopy silhouette rim
  grad.addColorStop(1.0, '#064e3b'); // Dark shoreline reflection edge
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle organic water surface wavelets
  const rand = mulberry32(FOREST_SEED + 5501);
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 8 + rand() * 22;
    const ry = 1.5 + rand() * 3.0;
    ctx.strokeStyle =
      rand() > 0.5
        ? 'rgba(186, 230, 253, 0.14)'
        : 'rgba(15, 23, 42, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a warm, sunlit lakeside memory fallback texture so the sub-surface shader
 * and software-renderer fallback always have a valid, rich image even before async load completes.
 */
function createFallbackLakePhotoTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const width = 512;
  const height = 340;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Warm golden-hour twilight sky over enchanted lake
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0.0, '#1e1b4b');
  skyGrad.addColorStop(0.32, '#4c1d95');
  skyGrad.addColorStop(0.58, '#f59e0b');
  skyGrad.addColorStop(0.75, '#fde68a');
  skyGrad.addColorStop(1.0, '#0f766e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Warm central sun-glow highlight (surfaces first during luminance development)
  const sunGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    8,
    width * 0.5,
    height * 0.48,
    width * 0.36,
  );
  sunGrad.addColorStop(0.0, 'rgba(255, 251, 235, 0.98)');
  sunGrad.addColorStop(0.35, 'rgba(253, 224, 71, 0.78)');
  sunGrad.addColorStop(0.7, 'rgba(244, 114, 182, 0.35)');
  sunGrad.addColorStop(1.0, 'rgba(15, 118, 110, 0.0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, width, height);

  // Two silhouettes standing together by the glowing water
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(width * 0.46, height * 0.54, 13, 0, Math.PI * 2);
  ctx.arc(width * 0.54, height * 0.56, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(width * 0.435, height * 0.57, 24, 52);
  ctx.fillRect(width * 0.515, height * 0.59, 22, 48);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Custom GLSL Sub-Surface Lake Memory Shader:
 * - Viewer-aligned horizontal 2D UV basis (uForwardXZ, uRightXZ) centered on uMemoryCenterXZ
 * - Multi-octave 2D FBM noise + elliptical soft-edge mask (zero rectangular borders)
 * - Luminance-weighted emergence (2.0s-5.0s: warm highlights & center surface first)
 * - Calming water turbulence inside memory zone (uDistortion: 1.0 -> 0.15 -> 1.35)
 * - Sub-surface color blend with surface Fresnel reflections, wave-crest specular highlights,
 *   1.8s single-drop concentric ripple, 9.5s dissolve ripple, and 3 firefly surface reflections ON TOP.
 */
const LakeSubsurfaceMemoryShader = {
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      // Gentle living surface micro-undulation
      float surfaceWave = sin(worldPosition.x * 1.8 + uTime * 1.4) * cos(worldPosition.z * 1.6 - uTime * 1.2) * 0.008;
      worldPosition.y += surfaceWave;
      vWorldPos = worldPosition.xyz;

      vec4 mvPosition = viewMatrix * worldPosition;
      vViewPos = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform sampler2D uReflectMap;
    uniform sampler2D uPhotoMap;
    uniform float uPhotoAspect;
    uniform vec2 uMemoryCenterXZ;
    uniform vec2 uForwardXZ;
    uniform vec2 uRightXZ;
    uniform float uMemoryRadius;
    uniform float uRevealProgress;
    uniform float uEmergencePhase;
    uniform float uDissolveProgress;
    uniform float uDistortion;
    uniform float uDropRippleProgress;
    uniform vec2 uFirefly1;
    uniform vec2 uFirefly2;
    uniform vec2 uFirefly3;
    uniform float uFireflyGlow;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;

    // 2D hash & multi-octave FBM for organic water edge feathering
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2D(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 3; i++) {
        v += amp * noise2D(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        amp *= 0.5;
      }
      return v;
    }

    void main() {
      // 1. Viewer-aligned coordinates centered on the lake focal point
      vec2 relXZ = vWorldPos.xz - uMemoryCenterXZ;
      float localX = dot(relXZ, uRightXZ) / (uMemoryRadius * max(0.5, uPhotoAspect));
      float localY = dot(relXZ, uForwardXZ) / uMemoryRadius;
      vec2 memCoord = vec2(localX, localY);
      float ellipDist = length(memCoord);
      float worldDistToFocal = length(relXZ);

      // 2. Calming water turbulence inside the memory zone
      float inMemoryZone = 1.0 - smoothstep(0.45, 1.45, ellipDist);
      float localTurbulence = mix(1.0, uDistortion, inMemoryZone * step(0.001, uRevealProgress));

      // 3. Natural water wave displacement & concentric memory ripples
      float waveA = sin(vWorldPos.x * 2.6 + uTime * 1.65 + sin(vWorldPos.z * 1.9) * 1.2);
      float waveB = cos(vWorldPos.z * 2.9 - uTime * 1.45 + cos(vWorldPos.x * 2.1) * 1.1);
      float baseRipple = (waveA * 0.5 + waveB * 0.5);

      // 1.8s single-drop concentric ring at focal point
      float dropRingHighlight = 0.0;
      float dropWave = 0.0;
      if (uDropRippleProgress > 0.001 && uDropRippleProgress < 0.999) {
        float dropRad = uDropRippleProgress * 3.8;
        float dRing = abs(worldDistToFocal - dropRad);
        float ringEnv = (1.0 - uDropRippleProgress) * exp(-dRing * 4.2);
        dropWave = sin((worldDistToFocal - dropRad) * 16.0) * ringEnv;
        dropRingHighlight = max(0.0, dropWave) * 0.55;
      }

      // 9.5s dissolve concentric ripple wave expanding from center of memory
      float dissolveRingHighlight = 0.0;
      float dissolveWave = 0.0;
      if (uDissolveProgress > 0.001) {
        float disRad = uDissolveProgress * 4.2;
        float dDis = abs(worldDistToFocal - disRad);
        float disEnv = sin(uDissolveProgress * 3.14159) * exp(-dDis * 2.2);
        dissolveWave = sin(worldDistToFocal * 12.0 - uTime * 4.5) * disEnv;
        dissolveRingHighlight = max(0.0, dissolveWave) * 0.42;
      }

      // 4. Base lake water color & canopy reflection
      vec2 reflectUv = vUv + vec2(waveA, waveB) * 0.012 * localTurbulence;
      vec3 texReflect = texture2D(uReflectMap, clamp(reflectUv, 0.01, 0.99)).rgb;
      vec3 deepWaterCol = vec3(0.03, 0.22, 0.27);
      vec3 shallowWaterCol = vec3(0.06, 0.48, 0.54);
      vec3 waterBaseColor = mix(deepWaterCol, shallowWaterCol, texReflect.g * 0.65 + 0.2);
      waterBaseColor = mix(waterBaseColor, texReflect * vec3(0.75, 0.92, 1.0), 0.42);

      // 5. Sub-Surface Photograph Emergence, Crystal-Clear Peak & Warm Golden Glow Rim
      float photoPresence = 0.0;
      float goldenRimHighlight = 0.0;
      if (uRevealProgress > 0.001 && ellipDist < 1.55) {
        float fbmVal = fbm(memCoord * 2.5 + vec2(uTime * 0.05, -uTime * 0.04));

        // Gentle UV wave refraction: calms during emergence so the photo is crystal-clear at peak
        vec2 waveOffset = vec2(
          sin(memCoord.y * 8.5 + uTime * 1.45) + cos(ellipDist * 13.0 - uTime * 3.0) * uDissolveProgress * 1.2,
          cos(memCoord.x * 8.5 - uTime * 1.35) + sin(ellipDist * 13.0 - uTime * 3.0) * uDissolveProgress * 1.2
        ) * (0.015 * uDistortion);

        vec2 photoUV = memCoord * 0.5 + 0.5 + waveOffset;
        vec3 photoRGB = texture2D(uPhotoMap, clamp(photoUV, 0.01, 0.99)).rgb;

        // Enhance color richness and clarity so the photograph reads vividly in the water
        vec3 vividPhoto = clamp(pow(max(photoRGB, vec3(0.001)), vec3(0.90)) * 1.14, 0.0, 1.0);
        float lum = dot(vividPhoto, vec3(0.299, 0.587, 0.114));

        // Elliptical + multi-octave FBM soft edge mask (zero rectangular borders)
        float noisyDist = ellipDist + (fbmVal - 0.5) * 0.28 + dissolveWave * 0.12;
        float activeRadius = mix(1.04, 0.06, pow(uDissolveProgress, 1.2));
        float edgeFeather = 1.0 - smoothstep(activeRadius - 0.34, activeRadius + 0.06, noisyDist);

        // Warm golden glow rim around the organic boundary of the water reflection
        float innerRim = smoothstep(activeRadius - 0.42, activeRadius - 0.14, noisyDist);
        float outerRim = 1.0 - smoothstep(activeRadius - 0.14, activeRadius + 0.08, noisyDist);
        goldenRimHighlight = innerRim * outerRim * uRevealProgress * (1.0 - uDissolveProgress * 0.75);

        // Luminance development: highlights surface first, then full-color midtones & shadows lock in clearly
        float lumSignal = clamp(lum * 1.15 + (1.0 - ellipDist * 0.45) * 0.52 + fbmVal * 0.24, 0.0, 1.7);
        float devThreshold = (1.0 - uEmergencePhase) * 1.25;
        float rawLumMask = smoothstep(devThreshold - 0.32, devThreshold + 0.18, lumSignal);
        float lumMask = mix(rawLumMask, 1.0, smoothstep(0.28, 0.76, uEmergencePhase));

        // Crystal-clear vivid blend (up to 93% clarity in the water)
        float subSurfaceBlend = clamp(edgeFeather * lumMask * uRevealProgress * 0.93, 0.0, 0.94);
        photoPresence = subSurfaceBlend;

        // Warm golden-sunlit water tint with subtle caustics
        float caustic = sin(vWorldPos.x * 5.2 + uTime * 2.1) * cos(vWorldPos.z * 5.2 - uTime * 1.8) * 0.035;
        vec3 warmGoldTint = vec3(1.03, 1.01, 0.97) + vec3(1.0, 0.88, 0.55) * max(0.0, caustic);
        vec3 subSurfacePhoto = vividPhoto * warmGoldTint;

        waterBaseColor = mix(waterBaseColor, subSurfacePhoto, subSurfaceBlend);
        // Add warm golden glow rim around the revealed memory reflection
        vec3 goldenRimCol = mix(vec3(1.0, 0.84, 0.38), vec3(1.0, 0.95, 0.72), 0.5 + 0.5 * sin(uTime * 2.6 + ellipDist * 4.0));
        waterBaseColor += goldenRimCol * goldenRimHighlight * 0.68;
      }

      // 6. Surface Specular Highlights, Sky Fresnel Reflections & Firefly Reflections ON TOP
      vec3 normalPerturb = normalize(vec3(
        (waveA * 0.045 * localTurbulence) + (dropWave + dissolveWave) * 0.08,
        1.0,
        (waveB * 0.045 * localTurbulence) + (dropWave + dissolveWave) * 0.08
      ));
      vec3 viewDir = normalize(vViewPos);
      float fresnel = pow(1.0 - max(0.0, dot(viewDir, normalPerturb)), 2.4);

      // Reduce Fresnel sky washout over the active photograph so the image remains crystal-clear from all angles
      vec3 skyFresnelCol = vec3(0.73, 0.91, 0.99);
      float fresnelStrength = mix(0.34, 0.08, photoPresence);
      vec3 finalColor = mix(waterBaseColor, skyFresnelCol, fresnel * fresnelStrength);

      // Sun & sky wave-crest specular shimmer across the water and photograph
      vec3 sunDir = normalize(vec3(-0.35, 0.84, 0.42));
      vec3 halfVec = normalize(sunDir + viewDir);
      float spec = pow(max(0.0, dot(normalPerturb, halfVec)), 42.0) * mix(0.52, 0.22, photoPresence);
      finalColor += vec3(0.98, 0.96, 0.88) * spec;

      // Concentric ripple crest highlights (1.55s drop & 11.0s dissolve)
      finalColor += vec3(0.88, 0.96, 1.0) * (dropRingHighlight + dissolveRingHighlight);

      // 2-3 slow-drifting firefly reflections gliding over the surface of the photograph
      if (uFireflyGlow > 0.001) {
        float dF1 = length(vWorldPos.xz - uFirefly1);
        float dF2 = length(vWorldPos.xz - uFirefly2);
        float dF3 = length(vWorldPos.xz - uFirefly3);
        float fGlow =
          exp(-dF1 * 3.4) * 0.55 +
          exp(-dF2 * 3.6) * 0.48 +
          exp(-dF3 * 3.8) * 0.45;
        vec3 fireflyCol = mix(vec3(0.55, 0.95, 0.98), vec3(0.99, 0.92, 0.62), 0.55);
        finalColor += fireflyCol * fGlow * uFireflyGlow;
      }

      // Soft shoreline alpha feathering at outer rim of the lake reflection disc
      float rimDist = length((vUv - vec2(0.5)) * 2.0);
      float rimAlpha = 1.0 - smoothstep(0.80, 1.0, rimDist);
      float activeBoost = max(photoPresence * 0.34, goldenRimHighlight * 0.28);
      float alpha = clamp((0.68 + fresnel * 0.16 + activeBoost) * rimAlpha, 0.0, 0.97);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

/**
 * Builds a single reed / cattail stalk with blade leaves.
 */
function createReedClusterGeo(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const count = 4 + (seed % 3);

  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const dist = 0.08 + rand() * 0.16;
    const h = 0.75 + rand() * 0.55;
    const tilt = 0.08 + rand() * 0.14;

    const stalk = new THREE.CylinderGeometry(0.012, 0.022, h, 5);
    stalk.translate(0, h * 0.5, 0);
    stalk.rotateZ(Math.cos(ang) * tilt);
    stalk.rotateX(Math.sin(ang) * tilt);
    stalk.translate(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    parts.push(stalk);

    if (i % 2 === 0) {
      const head = new THREE.CylinderGeometry(0.026, 0.026, 0.16, 6);
      head.translate(0, h * 0.82, 0);
      head.rotateZ(Math.cos(ang) * tilt);
      head.rotateX(Math.sin(ang) * tilt);
      head.translate(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      parts.push(head);
    }
  }

  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Builds a lush woodland fern rosette.
 */
function createFernClusterGeo(scale: number, seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const fronds: THREE.BufferGeometry[] = [];
  const frondCount = 7;

  for (let f = 0; f < frondCount; f++) {
    const yaw = (f / frondCount) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const len = (0.65 + rand() * 0.35) * scale;
    const w = (0.18 + rand() * 0.06) * scale;

    const plane = new THREE.PlaneGeometry(w, len, 1, 4);
    const pos = plane.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const py = pos.getY(v) + len * 0.5;
      const u = py / len;
      const arch = Math.sin(u * Math.PI * 0.85) * 0.24 * scale;
      const taper = Math.sin(u * Math.PI);
      pos.setX(v, pos.getX(v) * (0.35 + 0.65 * taper));
      pos.setY(v, arch);
      pos.setZ(v, py * 0.88);
    }
    plane.computeVertexNormals();
    plane.rotateY(yaw);
    fronds.push(plane);
  }

  const merged = mergeGeometries(fronds);
  fronds.forEach((f) => f.dispose());
  return merged;
}

/**
 * Builds Phase F5/F6:
 * 1. Three-Stage Lake Reveal & Magical Lake Response (at the existing Forest Lake on LEFT of main walkway)
 * 2. Gradual Path Continuation & Sun-Dappled Northern Woodland beyond the Giant Ancient Tree
 * 3. The Hidden Pool / Spring in a secluded northern hollow
 * 4. The Heartwood Sanctuary, The Heartwood Tree, Sanctuary Water Feature, Weathered Rune Stones,
 *    Luminous Flora, and Natural Seating Point (prepared for a future Yeshwanth -> Harsha moment).
 */
export function createHeartwoodSanctuarySystem(): HeartwoodSanctuaryBundle {
  const group = new THREE.Group();
  group.name = 'PhaseF5F6_HeartwoodSanctuaryAndLakeReveal';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED + 5601);

  const waterReflectTex = createWaterReflectionTexture(tracker);
  const moteSpriteTex = createLuminousMoteTexture(tracker);

  // ============================================================================
  // SHARED BELIEVABLE WOODLAND & SANCTUARY MATERIALS
  // ============================================================================
  const ancientBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#46372b'),
      roughness: 0.91,
      metalness: 0.02,
    }),
  );

  const heartwoodBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2f2a'),
      roughness: 0.86,
      metalness: 0.04,
    }),
  );

  const heartwoodVeinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a5f3fc'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.95,
      roughness: 0.32,
      metalness: 0.08,
    }),
  );

  const heartwoodVioletVeinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ddd6fe'),
      emissive: new THREE.Color('#8b5cf6'),
      emissiveIntensity: 0.78,
      roughness: 0.36,
      metalness: 0.06,
    }),
  );

  const canopyDeepMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#244429'),
      roughness: 0.74,
      metalness: 0.02,
    }),
  );

  const canopySunlitMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3e6b35'),
      roughness: 0.68,
      metalness: 0.02,
    }),
  );

  const heartwoodCanopyMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#28544b'),
      emissive: new THREE.Color('#0f766e'),
      emissiveIntensity: 0.18,
      roughness: 0.64,
      metalness: 0.04,
    }),
  );

  const heartwoodBlossomMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#67e8f9'),
      emissiveIntensity: 0.72,
      roughness: 0.38,
      metalness: 0.05,
    }),
  );

  const mossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6834'),
      roughness: 0.86,
      metalness: 0.0,
    }),
  );

  const wetStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#575b56'),
      roughness: 0.62,
      metalness: 0.06,
    }),
  );

  const runeStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#646863'),
      roughness: 0.84,
      metalness: 0.05,
    }),
  );

  const fadedRuneInlayMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#99f6e4'),
      emissive: new THREE.Color('#2dd4bf'),
      emissiveIntensity: 0.52,
      roughness: 0.4,
    }),
  );

  const reedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4d6b38'),
      roughness: 0.78,
      side: THREE.DoubleSide,
    }),
  );

  const fernMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b6e38'),
      roughness: 0.74,
      side: THREE.DoubleSide,
    }),
  );

  const sanctuaryFernMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#346b5c'),
      emissive: new THREE.Color('#14b8a6'),
      emissiveIntensity: 0.16,
      roughness: 0.68,
      side: THREE.DoubleSide,
    }),
  );

  // ============================================================================
  // PART 1: THREE-STAGE LAKE REVEAL & SUB-SURFACE LAKE MEMORY REFLECTION
  //         (Refining the existing Lake at localX: 47.5, localZ: -20.5 on LEFT of main walkway)
  // ============================================================================
  const lakeW = castleLocalToWorld(
    FOREST_LAKE_LOCAL_POS.localX,
    FOREST_LAKE_LOCAL_POS.localZ,
  );
  const lakeWaterY = getTerrainHeight(lakeW.x, lakeW.z) + 0.365;

  // 1A. Sub-Surface Lake Memory & Sky/Canopy Reflection Surface on the existing Forest Lake
  const fallbackPhotoTex = createFallbackLakePhotoTexture(tracker);
  const lakeSubsurfaceUniforms = {
    uTime: { value: 0 },
    uReflectMap: { value: waterReflectTex as THREE.Texture | null },
    uPhotoMap: { value: fallbackPhotoTex as THREE.Texture | null },
    uPhotoAspect: { value: 1.5 },
    uMemoryCenterXZ: { value: new THREE.Vector2(lakeW.x, lakeW.z) },
    uForwardXZ: { value: new THREE.Vector2(0, -1) },
    uRightXZ: { value: new THREE.Vector2(1, 0) },
    uMemoryRadius: { value: 2.85 },
    uRevealProgress: { value: 0.0 },
    uEmergencePhase: { value: 0.0 },
    uDissolveProgress: { value: 0.0 },
    uDistortion: { value: 1.0 },
    uDropRippleProgress: { value: 0.0 },
    uFirefly1: { value: new THREE.Vector2(lakeW.x, lakeW.z) },
    uFirefly2: { value: new THREE.Vector2(lakeW.x, lakeW.z) },
    uFirefly3: { value: new THREE.Vector2(lakeW.x, lakeW.z) },
    uFireflyGlow: { value: 0.0 },
  };

  const lakeReflectionGeo = tracker.trackGeo(new THREE.CircleGeometry(8.8, 48));
  lakeReflectionGeo.rotateX(-Math.PI / 2);
  lakeReflectionGeo.scale(1.2, 1.0, 0.93);

  // Standard material kept as graceful fallback if custom shader fails on software WebGL
  const lakeReflectionMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: waterReflectTex ?? undefined,
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.16,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );

  let useFallbackSubsurfaceMesh = false;
  let lakeSubsurfaceShaderMat: THREE.ShaderMaterial | null = null;
  try {
    lakeSubsurfaceShaderMat = tracker.trackMat(
      new THREE.ShaderMaterial({
        uniforms: lakeSubsurfaceUniforms,
        vertexShader: LakeSubsurfaceMemoryShader.vertexShader,
        fragmentShader: LakeSubsurfaceMemoryShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      }),
    );
  } catch {
    useFallbackSubsurfaceMesh = true;
  }

  const lakeReflectionMesh = new THREE.Mesh(
    lakeReflectionGeo,
    lakeSubsurfaceShaderMat ?? lakeReflectionMat,
  );
  lakeReflectionMesh.position.set(lakeW.x, lakeWaterY + 0.015, lakeW.z);
  lakeReflectionMesh.renderOrder = 2;
  lakeReflectionMesh.name = 'ForestLakeSkyCanopyReflection';
  group.add(lakeReflectionMesh);

  // Runtime WebGL shader program verification hook (switches to pre-feathered radial fallback mesh if shader link fails)
  lakeReflectionMesh.onBeforeRender = (renderer) => {
    if (useFallbackSubsurfaceMesh || !lakeSubsurfaceShaderMat) return;
    const props = renderer.properties.get(lakeSubsurfaceShaderMat) as {
      currentProgram?: { program?: WebGLProgram };
    };
    const glProg = props?.currentProgram?.program;
    if (glProg) {
      const gl = renderer.getContext();
      if (gl.getProgramParameter(glProg, gl.LINK_STATUS) === false) {
        useFallbackSubsurfaceMesh = true;
        lakeReflectionMesh.material = lakeReflectionMat;
      }
    }
  };

  // 1B. Northern Woodland tree geometry accumulators (zero trees placed on or leaning over the lake)
  const lakesideTreeParts: THREE.BufferGeometry[] = [];
  const lakesideCanopyParts: THREE.BufferGeometry[] = [];

  // 1C. Stage 1, 2 & 3 Lake Reveal Vegetation Framing (Reeds, Shoreline Ferns & Wet Stones)
  const reedGeos: THREE.BufferGeometry[] = [];
  const shorelineFernGeos: THREE.BufferGeometry[] = [];
  const wetShoreStoneGeos: THREE.BufferGeometry[] = [];

  // Stage 1 & 2 clue reeds & wet stones along the side approach (localX: 49.8..49.0, localZ: -2.8..-10.6)
  const revealClueLocals = [
    { lx: 49.8, lz: -2.8, hasReed: true }, // Stage 1 glimpse clue near main walkway
    { lx: 49.5, lz: -5.8, hasReed: false },
    { lx: 49.2, lz: -8.4, hasReed: true }, // Stage 2 partial reveal window framing
    { lx: 49.0, lz: -10.6, hasReed: true },
  ];
  revealClueLocals.forEach((cl, idx) => {
    const cw = castleLocalToWorld(cl.lx, cl.lz);
    const cy = getTerrainHeight(cw.x, cw.z);
    const st = createCragBoulderGeometry(0.32, 0.12, 0.28, 0.16, 830 + idx);
    st.translate(cw.x, cy + 0.04, cw.z);
    wetShoreStoneGeos.push(st);

    if (cl.hasReed) {
      const rGeo = createReedClusterGeo(840 + idx);
      rGeo.translate(cw.x + 0.45, cy - 0.04, cw.z - 0.35);
      reedGeos.push(rGeo);
    }
  });

  // Stage 3 Shoreline reeds & ferns framing the outer lake edge (strictly outside water perimeter,
  // leaving clear openings for the near-shore beach and the far-right memory photo area!)
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    // Skip near-shore beach & far-right photo reflection quadrant so the water is 100% clean
    if (ang > 0.15 && ang < 1.35) continue;
    if (ang > 3.4 && ang < 5.2) continue;

    const radX = 9.95 * 1.2 + (rand() - 0.5) * 0.45;
    const radZ = 9.95 * 0.95 + (rand() - 0.5) * 0.45;
    const rx = lakeW.x + Math.cos(ang) * radX;
    const rz = lakeW.z + Math.sin(ang) * radZ;
    const ry = getTerrainHeight(rx, rz);

    if (i % 2 === 0) {
      const reed = createReedClusterGeo(860 + i);
      reed.translate(rx, ry - 0.05, rz);
      reedGeos.push(reed);
    } else {
      const fern = createFernClusterGeo(0.95, 880 + i);
      fern.translate(rx, ry + 0.02, rz);
      shorelineFernGeos.push(fern);
    }
  }

  // 1D. Magical Lake Response: Shoreline Aquatic Moon-Flowers at the near shoreline edge (`localX: 48.6, localZ: -11.9`)
  const lakeMoonFlowerLocal = { lx: 48.6, lz: -11.9 };
  const lakeMoonFlowerW = castleLocalToWorld(
    lakeMoonFlowerLocal.lx,
    lakeMoonFlowerLocal.lz,
  );
  const lakeMoonFlowerY = getTerrainHeight(
    lakeMoonFlowerW.x,
    lakeMoonFlowerW.z,
  );
  const lakeMoonFlowerPos = new THREE.Vector3(
    lakeMoonFlowerW.x,
    lakeMoonFlowerY + 0.04,
    lakeMoonFlowerW.z,
  );

  const moonFlowerGroup = new THREE.Group();
  moonFlowerGroup.name = 'LakeShoreMagicalMoonFlowers';
  moonFlowerGroup.position.copy(lakeMoonFlowerPos);
  group.add(moonFlowerGroup);

  const moonPetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0f2fe'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.25,
      roughness: 0.35,
      side: THREE.DoubleSide,
    }),
  );

  const moonCoreMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#67e8f9'),
      emissiveIntensity: 0.4,
      roughness: 0.2,
    }),
  );

  // Lily pad / basal leaf cluster under the moon-flowers
  const padGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.32, 0.34, 0.02, 12));
  [
    { x: 0, z: 0, s: 1.0 },
    { x: 0.38, z: -0.22, s: 0.78 },
    { x: -0.34, z: 0.18, s: 0.72 },
  ].forEach((p) => {
    const pad = new THREE.Mesh(padGeo, fernMat);
    pad.position.set(p.x, 0.02, p.z);
    pad.scale.setScalar(p.s);
    moonFlowerGroup.add(pad);
  });

  // Primary responsive Moon-Flower (6 hinged petals that slowly open when player approaches)
  const petalPivots: THREE.Group[] = [];
  const petalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.085, 0.26, 5));
  petalGeo.scale(1.0, 1.0, 0.35);
  petalGeo.translate(0, 0.13, 0);

  for (let p = 0; p < 6; p++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (p / 6) * Math.PI * 2;
    pivot.position.set(0, 0.06, 0);

    const petalMesh = new THREE.Mesh(petalGeo, moonPetalMat);
    // Initially closed bud (tilted inward)
    petalMesh.rotation.x = 0.18;
    pivot.add(petalMesh);
    moonFlowerGroup.add(pivot);
    petalPivots.push(pivot);
  }

  const flowerCoreGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 8, 8));
  const flowerCoreMesh = new THREE.Mesh(flowerCoreGeo, moonCoreMat);
  flowerCoreMesh.position.set(0, 0.1, 0);
  moonFlowerGroup.add(flowerCoreMesh);

  // Expanding water ripple ring on the lake surface triggered by the Moon-Flower
  const rippleRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.22, 0.32, 28),
  );
  rippleRingGeo.rotateX(-Math.PI / 2);
  const rippleRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#a5f3fc'),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const lakeRippleMesh = new THREE.Mesh(rippleRingGeo, rippleRingMat);
  lakeRippleMesh.position.set(
    lakeMoonFlowerW.x + (lakeW.x - lakeMoonFlowerW.x) * 0.25,
    lakeWaterY + 0.02,
    lakeMoonFlowerW.z + (lakeW.z - lakeMoonFlowerW.z) * 0.25,
  );
  group.add(lakeRippleMesh);

  let moonFlowerBloom = 0; // 0 = closed, 1 = fully open
  let ripplePhase = 0;

  // ============================================================================
  // 1E. 13.5-SECOND SUB-SURFACE LAKE MEMORY CINEMATIC & MEMORY FIGURE
  //     - Triggered ONLY by pressing E near the shoreline (never auto-triggers)
  //     - Zero UI popups, modals, dialogue boxes, or floating 3D cards
  //     - Photograph placed at the far-right/end portion of the existing lake
  //     - Opposite-shore view reveals a soft translucent mist silhouette embracing
  //       the player from behind (8.0s - 12.0s)
  // ============================================================================
  const LAKE_PHOTO_INTERACT_RADIUS = 8.5;
  const LAKE_MEMORY_DURATION = 16.0;
  let lakePhotoState: LakePhotoState = 'IDLE';
  let lakeMemoryTimer = 0.0;
  let dropRippleTriggered = false;
  let figureToneTriggered = false;
  let dissolveRippleTriggered = false;

  // Deterministic shore-to-lake horizontal basis from existing shoreline & lake center
  const baseDirX = lakeW.x - lakeMoonFlowerW.x;
  const baseDirZ = lakeW.z - lakeMoonFlowerW.z;
  const baseDirLen = Math.hypot(baseDirX, baseDirZ) || 1.0;
  const shoreForwardXZ = new THREE.Vector2(
    baseDirX / baseDirLen,
    baseDirZ / baseDirLen,
  );
  const shoreRightXZ = new THREE.Vector2(
    -shoreForwardXZ.y,
    shoreForwardXZ.x,
  );

  // Place the sub-surface memory photograph toward the clean FAR-RIGHT / END portion of the existing lake
  const lakeFocalPoint = new THREE.Vector3(
    lakeW.x + shoreForwardXZ.x * 1.95 + shoreRightXZ.x * 2.55,
    lakeWaterY + 0.015,
    lakeW.z + shoreForwardXZ.y * 1.95 + shoreRightXZ.y * 2.55,
  );
  lakeSubsurfaceUniforms.uMemoryCenterXZ.value.set(
    lakeFocalPoint.x,
    lakeFocalPoint.z,
  );
  lakeSubsurfaceUniforms.uMemoryRadius.value = 2.85;

  const capturedPlayerShorePos = new THREE.Vector3().copy(lakeMoonFlowerPos);
  const viewerForwardXZ = new THREE.Vector2().copy(shoreForwardXZ);
  const viewerRightXZ = new THREE.Vector2().copy(shoreRightXZ);

  // Camera keyframe anchors computed on activation for continuous curved trajectory
  const startCamPos = new THREE.Vector3();
  const startLookPos = new THREE.Vector3();
  const highCamPos = new THREE.Vector3();
  const highLookPos = new THREE.Vector3();
  const crossCtrlPos = new THREE.Vector3();
  const oppBaseCamPos = new THREE.Vector3();
  const returnCtrlPos = new THREE.Vector3();

  const lakeCameraFocus: LakeMemoryCameraFocus = {
    active: false,
    camWorldPos: new THREE.Vector3(),
    lookWorldPos: new THREE.Vector3(),
    blendAlpha: 0,
    playerTurnAlpha: 0,
    embraceAlpha: 0,
    kissAlpha: 0,
  };

  // ----------------------------------------------------------------------------
  // Warm Golden-Lit Stylized Man (Yeshwanth) Matching Harsha's Art Style (7.5s - 12.0s)
  // ----------------------------------------------------------------------------
  const memoryFigureGroup = new THREE.Group();
  memoryFigureGroup.name = 'LakeMemoryYeshwanthRomanticFigure';
  memoryFigureGroup.visible = false;
  group.add(memoryFigureGroup);

  const memoryBodyGroup = new THREE.Group();
  memoryBodyGroup.scale.setScalar(1.05); // Slightly taller than Harsha (~1.76m)
  memoryFigureGroup.add(memoryBodyGroup);

  // Stylized character materials matching PlayerCharacter.ts with warm golden memory rim lighting
  const yeshSkinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffdfc4'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.22,
      roughness: 0.62,
      metalness: 0.02,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshHairMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#241610'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.14,
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshJacketMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e3a5f'), // Deep twilight royal navy jacket
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.24,
      roughness: 0.36,
      metalness: 0.08,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshShirtMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbeb'), // Warm ivory shirt collar
      emissive: new THREE.Color('#fde68a'),
      emissiveIntensity: 0.26,
      roughness: 0.72,
      metalness: 0.02,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshGoldTrimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f7c96f'), // Warm golden trim matching Harsha's gold ribbon
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.42,
      roughness: 0.24,
      metalness: 0.72,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshTrouserMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d3748'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.16,
      roughness: 0.65,
      metalness: 0.04,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshBootMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3228'),
      emissive: new THREE.Color('#b45309'),
      emissiveIntensity: 0.14,
      roughness: 0.5,
      metalness: 0.12,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshFeatureMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#291d18'),
      roughness: 0.4,
      transparent: true,
      opacity: 0.0,
    }),
  );
  const yeshSmileMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d9776c'),
      emissive: new THREE.Color('#f43f5e'),
      emissiveIntensity: 0.18,
      roughness: 0.45,
      transparent: true,
      opacity: 0.0,
    }),
  );

  const yeshCharacterMaterials = [
    yeshSkinMat,
    yeshHairMat,
    yeshJacketMat,
    yeshShirtMat,
    yeshGoldTrimMat,
    yeshTrouserMat,
    yeshBootMat,
    yeshFeatureMat,
    yeshSmileMat,
  ];

  const memoryHaloMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: moteSpriteTex ?? undefined,
      color: new THREE.Color('#fde68a'),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  // 1. Pivoted Left & Right Legs + Boots (matching PlayerCharacter.ts proportions)
  const yeshLegGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.082, 0.38, 6, 10),
  );
  yeshLegGeo.translate(0, -0.23, 0);
  const yeshBootGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.18, 0.14, 0.25),
  );
  yeshBootGeo.translate(0, -0.45, 0.035);

  const yeshLeftLegPivot = new THREE.Group();
  yeshLeftLegPivot.position.set(-0.125, 0.54, 0);
  yeshLeftLegPivot.add(
    new THREE.Mesh(yeshLegGeo, yeshTrouserMat),
    new THREE.Mesh(yeshBootGeo, yeshBootMat),
  );
  memoryBodyGroup.add(yeshLeftLegPivot);

  const yeshRightLegPivot = new THREE.Group();
  yeshRightLegPivot.position.set(0.125, 0.54, 0);
  yeshRightLegPivot.add(
    new THREE.Mesh(yeshLegGeo, yeshTrouserMat),
    new THREE.Mesh(yeshBootGeo, yeshBootMat),
  );
  memoryBodyGroup.add(yeshRightLegPivot);

  // 2. Tailored Masculine Torso, Jacket Hem, Gold Belt Trim & Warm Ivory Collar
  const yeshPelvisGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.185, 0.195, 0.26, 14),
  );
  yeshPelvisGeo.translate(0, 0.66, 0);
  memoryBodyGroup.add(new THREE.Mesh(yeshPelvisGeo, yeshJacketMat));

  const yeshBeltGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.192, 0.024, 8, 20),
  );
  yeshBeltGeo.rotateX(Math.PI / 2);
  yeshBeltGeo.translate(0, 0.79, 0);
  memoryBodyGroup.add(new THREE.Mesh(yeshBeltGeo, yeshGoldTrimMat));

  const yeshTorsoGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.215, 0.182, 0.46, 14),
  );
  yeshTorsoGeo.translate(0, 1.02, 0);
  memoryBodyGroup.add(new THREE.Mesh(yeshTorsoGeo, yeshJacketMat));

  const yeshCollarGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.158, 0.032, 8, 18),
  );
  yeshCollarGeo.rotateX(Math.PI / 2);
  yeshCollarGeo.translate(0, 1.25, 0);
  memoryBodyGroup.add(new THREE.Mesh(yeshCollarGeo, yeshShirtMat));

  const yeshLapelGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.12, 0.24, 0.04),
  );
  const yeshChestShirt = new THREE.Mesh(yeshLapelGeo, yeshShirtMat);
  yeshChestShirt.position.set(0, 1.13, 0.175);
  memoryBodyGroup.add(yeshChestShirt);

  // 3. Articulated Left & Right Arms (Shoulder + Elbow Forearm + Hand for natural Hug & Kiss)
  const yeshShoulderGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.092, 10, 10),
  );
  const yeshUpperArmGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.064, 0.18, 6, 10),
  );
  yeshUpperArmGeo.translate(0, -0.11, 0);
  const yeshForearmGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.056, 0.18, 6, 10),
  );
  yeshForearmGeo.translate(0, -0.11, 0);
  const yeshHandGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.058, 10, 10),
  );
  yeshHandGeo.scale(0.9, 1.1, 0.75);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.255, 1.21, 0);
  leftArmPivot.add(
    new THREE.Mesh(yeshShoulderGeo, yeshJacketMat),
    new THREE.Mesh(yeshUpperArmGeo, yeshJacketMat),
  );
  const leftForearmPivot = new THREE.Group();
  leftForearmPivot.position.set(0, -0.21, 0);
  const leftHandMesh = new THREE.Mesh(yeshHandGeo, yeshSkinMat);
  leftHandMesh.position.set(0, -0.23, 0.02);
  leftForearmPivot.add(
    new THREE.Mesh(yeshForearmGeo, yeshJacketMat),
    leftHandMesh,
  );
  leftArmPivot.add(leftForearmPivot);
  memoryBodyGroup.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.255, 1.21, 0);
  rightArmPivot.add(
    new THREE.Mesh(yeshShoulderGeo, yeshJacketMat),
    new THREE.Mesh(yeshUpperArmGeo, yeshJacketMat),
  );
  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -0.21, 0);
  const rightHandMesh = new THREE.Mesh(yeshHandGeo, yeshSkinMat);
  rightHandMesh.position.set(0, -0.23, 0.02);
  rightForearmPivot.add(
    new THREE.Mesh(yeshForearmGeo, yeshJacketMat),
    rightHandMesh,
  );
  rightArmPivot.add(rightForearmPivot);
  memoryBodyGroup.add(rightArmPivot);

  // 4. Stylized Head, Neck, Tousled Dark Hair & Warm Facial Features
  const yeshNeckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.068, 0.078, 0.12, 10),
  );
  yeshNeckGeo.translate(0, 1.32, 0);
  memoryBodyGroup.add(new THREE.Mesh(yeshNeckGeo, yeshSkinMat));

  const memHeadPivot = new THREE.Group();
  memHeadPivot.position.set(0, 1.48, 0);
  memoryBodyGroup.add(memHeadPivot);

  const memHeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.212, 18, 18));
  const memHeadMesh = new THREE.Mesh(memHeadGeo, yeshSkinMat);
  memHeadPivot.add(memHeadMesh);

  // Masculine stylized dark hair cap + side-swept wavy front quiff
  const yeshHairCapGeo = tracker.trackGeo(
    new THREE.SphereGeometry(
      0.228,
      18,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.64,
    ),
  );
  yeshHairCapGeo.rotateX(-0.26);
  const yeshHairCap = new THREE.Mesh(yeshHairCapGeo, yeshHairMat);
  yeshHairCap.position.y = 0.025;
  memHeadPivot.add(yeshHairCap);

  const yeshQuiffGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.095, 12, 10),
  );
  yeshQuiffGeo.scale(1.65, 0.72, 1.15);
  const yeshQuiff = new THREE.Mesh(yeshQuiffGeo, yeshHairMat);
  yeshQuiff.position.set(0.02, 0.145, 0.155);
  yeshQuiff.rotation.set(0.22, 0.15, -0.18);
  memHeadPivot.add(yeshQuiff);

  const yeshSideHairGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.075, 10, 8),
  );
  yeshSideHairGeo.scale(0.65, 1.35, 1.25);
  const yeshLeftSideburn = new THREE.Mesh(yeshSideHairGeo, yeshHairMat);
  yeshLeftSideburn.position.set(-0.185, 0.02, 0.04);
  const yeshRightSideburn = new THREE.Mesh(yeshSideHairGeo, yeshHairMat);
  yeshRightSideburn.position.set(0.185, 0.02, 0.04);
  memHeadPivot.add(yeshLeftSideburn, yeshRightSideburn);

  // Warm expressive eyes, brows & gentle romantic smile on front (+Z) of head
  const yeshEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
  yeshEyeGeo.scale(1.0, 1.15, 0.55);
  const yeshLeftEye = new THREE.Mesh(yeshEyeGeo, yeshFeatureMat);
  yeshLeftEye.position.set(-0.068, 0.022, 0.195);
  const yeshRightEye = new THREE.Mesh(yeshEyeGeo, yeshFeatureMat);
  yeshRightEye.position.set(0.068, 0.022, 0.195);
  memHeadPivot.add(yeshLeftEye, yeshRightEye);

  const yeshBrowGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.052, 0.012, 0.015),
  );
  const yeshLeftBrow = new THREE.Mesh(yeshBrowGeo, yeshHairMat);
  yeshLeftBrow.position.set(-0.068, 0.062, 0.198);
  yeshLeftBrow.rotation.z = 0.08;
  const yeshRightBrow = new THREE.Mesh(yeshBrowGeo, yeshHairMat);
  yeshRightBrow.position.set(0.068, 0.062, 0.198);
  yeshRightBrow.rotation.z = -0.08;
  memHeadPivot.add(yeshLeftBrow, yeshRightBrow);

  const yeshSmileGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.036, 0.007, 6, 12, Math.PI * 0.78),
  );
  const yeshSmile = new THREE.Mesh(yeshSmileGeo, yeshSmileMat);
  yeshSmile.position.set(0, -0.032, 0.196);
  yeshSmile.rotation.set(0.18, 0, Math.PI * 1.11);
  memHeadPivot.add(yeshSmile);

  // 5. Soft golden ground shimmer disc beneath the couple (no ghostly fog planes over face)
  const haloPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.65, 1.65));
  haloPlaneGeo.rotateX(-Math.PI / 2);
  const haloFront = new THREE.Mesh(haloPlaneGeo, memoryHaloMat);
  haloFront.position.set(0, 0.04, 0.15);
  memoryFigureGroup.add(haloFront);

  // 6. 18 Warm golden-rose starlight motes rising gently around Yeshwanth & Harsha during the hug and kiss
  const memMistCount = 18;
  const memMistPositions = new Float32Array(memMistCount * 3);
  const memMistBase: Array<{
    angle: number;
    radius: number;
    baseY: number;
    speed: number;
    phase: number;
  }> = [];
  for (let i = 0; i < memMistCount; i++) {
    const ang = (i / memMistCount) * Math.PI * 2;
    const rad = 0.34 + (i % 4) * 0.12;
    const by = 0.25 + (i / memMistCount) * 1.45;
    memMistPositions[i * 3] = Math.cos(ang) * rad;
    memMistPositions[i * 3 + 1] = by;
    memMistPositions[i * 3 + 2] = Math.sin(ang) * rad;
    memMistBase.push({
      angle: ang,
      radius: rad,
      baseY: by,
      speed: 0.9 + (i % 3) * 0.35,
      phase: i * 0.65,
    });
  }
  const memMistGeo = tracker.trackGeo(new THREE.BufferGeometry());
  memMistGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(memMistPositions, 3),
  );
  const memMistMat = tracker.trackMat(
    new THREE.PointsMaterial({
      map: moteSpriteTex ?? undefined,
      color: new THREE.Color('#fde047'),
      size: 0.24,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const memMistPoints = new THREE.Points(memMistGeo, memMistMat);
  memoryFigureGroup.add(memMistPoints);

  // Pre-masked, soft-feathered radial sub-surface fallback mesh flush within the water plane
  // (Used automatically if custom shader compilation is unavailable/fails on software WebGL)
  const fallbackCanvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (fallbackCanvas) {
    fallbackCanvas.width = 512;
    fallbackCanvas.height = 512;
  }
  const fallbackFeatheredTex = fallbackCanvas
    ? tracker.trackTex(new THREE.CanvasTexture(fallbackCanvas))
    : null;
  if (fallbackFeatheredTex) {
    fallbackFeatheredTex.colorSpace = THREE.SRGBColorSpace;
  }

  function renderFeatheredFallbackCanvas(
    sourceImg?: CanvasImageSource,
    aspect: number = 1.5,
  ) {
    if (!fallbackCanvas || !fallbackFeatheredTex) return;
    const ctx = fallbackCanvas.getContext('2d');
    if (!ctx) return;
    const s = fallbackCanvas.width;
    ctx.clearRect(0, 0, s, s);

    ctx.save();
    // Elliptical organic radial clip + soft alpha feathering (zero hard rectangle)
    const radGrad = ctx.createRadialGradient(
      s * 0.5,
      s * 0.5,
      s * 0.08,
      s * 0.5,
      s * 0.5,
      s * 0.47,
    );
    radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    radGrad.addColorStop(0.58, 'rgba(224, 242, 254, 0.92)');
    radGrad.addColorStop(0.82, 'rgba(125, 211, 252, 0.38)');
    radGrad.addColorStop(1.0, 'rgba(14, 116, 144, 0.0)');

    if (sourceImg) {
      const drawW = s;
      const drawH = s / Math.max(0.6, aspect);
      const offsetY = (s - drawH) * 0.5;
      ctx.drawImage(sourceImg, 0, offsetY, drawW, drawH);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, s, s);
      // Warm golden glow rim on fallback canvas
      ctx.globalCompositeOperation = 'source-over';
      const rimGrad = ctx.createRadialGradient(
        s * 0.5,
        s * 0.5,
        s * 0.34,
        s * 0.5,
        s * 0.5,
        s * 0.47,
      );
      rimGrad.addColorStop(0.0, 'rgba(251, 191, 36, 0.0)');
      rimGrad.addColorStop(0.55, 'rgba(253, 224, 71, 0.45)');
      rimGrad.addColorStop(1.0, 'rgba(251, 191, 36, 0.0)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, s, s);
    } else {
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, s, s);
    }
    ctx.restore();
    fallbackFeatheredTex.needsUpdate = true;
  }

  renderFeatheredFallbackCanvas(fallbackPhotoTex?.image, 1.5);

  const fallbackDiskGeo = tracker.trackGeo(
    new THREE.PlaneGeometry(6.4, 6.4, 20, 20),
  );
  fallbackDiskGeo.rotateX(-Math.PI / 2);
  const fallbackBasePos = (
    fallbackDiskGeo.attributes.position as THREE.BufferAttribute
  ).array.slice() as Float32Array;

  const fallbackDiskMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: fallbackFeatheredTex ?? fallbackPhotoTex ?? undefined,
      color: new THREE.Color('#fffbeb'),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const fallbackSubsurfaceMesh = new THREE.Mesh(
    fallbackDiskGeo,
    fallbackDiskMat,
  );
  fallbackSubsurfaceMesh.position.set(
    lakeFocalPoint.x,
    lakeWaterY + 0.018,
    lakeFocalPoint.z,
  );
  fallbackSubsurfaceMesh.renderOrder = 3;
  fallbackSubsurfaceMesh.visible = false;
  fallbackSubsurfaceMesh.name = 'LakeSubsurfaceMemoryFallbackMesh';
  group.add(fallbackSubsurfaceMesh);

  // Load the lake photograph asynchronously and preserve its natural aspect ratio
  const photoTexLoader = new THREE.TextureLoader();
  photoTexLoader.load(
    '/assets/vistas/art_aurora_lake.jpg',
    (loadedTex) => {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      loadedTex.minFilter = THREE.LinearFilter;
      loadedTex.magFilter = THREE.LinearFilter;
      tracker.trackTex(loadedTex);

      const img = loadedTex.image as
        | {
            naturalWidth?: number;
            naturalHeight?: number;
            width?: number;
            height?: number;
          }
        | undefined;
      const w = img?.naturalWidth || img?.width || 1536;
      const h = img?.naturalHeight || img?.height || 1024;
      const aspect = w > 0 && h > 0 ? w / h : 1.5;

      lakeSubsurfaceUniforms.uPhotoAspect.value = aspect;
      lakeSubsurfaceUniforms.uPhotoMap.value = loadedTex;
      renderFeatheredFallbackCanvas(
        loadedTex.image as CanvasImageSource,
        aspect,
      );
    },
    undefined,
    () => {
      // Graceful fallback on texture load error: procedural canvas texture remains active
    },
  );

  // ============================================================================
  // PART 2: GRADUAL PATH CONTINUATION & SUN-DAPPLED NORTHERN WOODLAND
  //         (Beyond Giant Ancient Tree: localX: 73..108, localZ: 12..45)
  // ============================================================================
  const sanctuarySpinePts = NORTHERN_SANCTUARY_LOCAL_POINTS.map((p) => {
    const w = castleLocalToWorld(p.localX, p.localZ);
    return new THREE.Vector3(w.x, getTerrainHeight(w.x, w.z), w.z);
  });
  const sanctuarySpline = new THREE.CatmullRomCurve3(sanctuarySpinePts);

  // Gradual trail dissolution:
  // u = 0.0..0.28: Weathered earth ribbon & scattered stones
  // u = 0.28..0.58: Compacted earth patches, roots & moss cushions
  // u = 0.58..0.82: Subtle root & moss guides leading into the Heartwood Sanctuary
  const fadingTrailStoneGeos: THREE.BufferGeometry[] = [];
  const fadingTrailMossGeos: THREE.BufferGeometry[] = [];
  const fadingTrailRootGeos: THREE.BufferGeometry[] = [];
  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  const trailSteps = 34;
  for (let s = 2; s <= trailSteps; s++) {
    const u = s / trailSteps;
    if (u > 0.78) break; // Dissolves completely before the Heartwood Tree clearing center

    sanctuarySpline.getPointAt(u, _pt);
    sanctuarySpline.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();
    const yaw = Math.atan2(_tan.x, _tan.z);

    // Stage 1 of northern path (u < 0.35): weathered earth & flat stones
    if (u < 0.42 && s % 2 === 0) {
      const lat = (rand() - 0.5) * 0.65;
      const sx = _pt.x + _right.x * lat;
      const sz = _pt.z + _right.z * lat;
      const sy = getTerrainHeight(sx, sz) + 0.03;
      const st = createCragBoulderGeometry(
        0.38 * (1.0 - u * 0.6),
        0.055,
        0.32 * (1.0 - u * 0.6),
        0.16,
        900 + s,
      );
      st.rotateY(yaw + (rand() - 0.5) * 0.4);
      st.translate(sx, sy, sz);
      fadingTrailStoneGeos.push(st);
    }

    // Stage 2 & 3 (u >= 0.22): moss cushions & exposed roots guiding naturally
    if (u >= 0.2 && s % 2 === 1) {
      const side = s % 4 === 1 ? 1 : -1;
      const mLat = side * (0.65 + rand() * 0.75);
      const mx = _pt.x + _right.x * mLat;
      const mz = _pt.z + _right.z * mLat;
      const my = getTerrainHeight(mx, mz);

      const mossPad = createOrganicCanopyClusterGeo(
        0.48 + rand() * 0.25,
        0.09,
        0.42 + rand() * 0.22,
        1,
        0.18,
        940 + s,
      );
      mossPad.translate(mx, my + 0.02, mz);
      fadingTrailMossGeos.push(mossPad);

      if (s % 5 === 0) {
        const r0x = _pt.x + _right.x * (side * 2.2);
        const r0z = _pt.z + _right.z * (side * 2.2);
        const r1x = _pt.x + _right.x * (side * 0.9) + _tan.x * 0.4;
        const r1z = _pt.z + _right.z * (side * 0.9) + _tan.z * 0.4;
        const rPts = [
          new THREE.Vector3(r0x, getTerrainHeight(r0x, r0z) + 0.12, r0z),
          new THREE.Vector3(r1x, getTerrainHeight(r1x, r1z) + 0.05, r1z),
          new THREE.Vector3(_pt.x, getTerrainHeight(_pt.x, _pt.z) - 0.03, _pt.z),
        ];
        fadingTrailRootGeos.push(
          createOrganicRootOrBranchGeo(rPts, 0.08, 0.03, 7, 5, 980 + s),
        );
      }
    }
  }

  // Winding natural clue route from Northern Glade 2 (86.0, 31.5) to Hidden Pool (95.5, 14.5)
  const hiddenPoolRouteLocals = [
    { lx: 88.2, lz: 27.5 },
    { lx: 90.4, lz: 23.2 },
    { lx: 92.6, lz: 19.2 },
    { lx: 94.2, lz: 16.4 },
  ];
  hiddenPoolRouteLocals.forEach((pt, idx) => {
    const w = castleLocalToWorld(pt.lx, pt.lz);
    const wy = getTerrainHeight(w.x, w.z);
    const dampRock = createCragBoulderGeometry(
      0.34,
      0.11,
      0.3,
      0.18,
      1020 + idx,
    );
    dampRock.translate(w.x, wy + 0.04, w.z);
    wetShoreStoneGeos.push(dampRock);

    const fern = createFernClusterGeo(0.85, 1040 + idx);
    fern.translate(w.x + 0.55, wy + 0.02, w.z - 0.4);
    shorelineFernGeos.push(fern);
  });

  // ============================================================================
  // PART 3: THE HIDDEN POOL / SPRING (`localX: 95.5, localZ: 14.5`)
  //         Secluded, irregular woodland spring discovered by exploration
  // ============================================================================
  const hiddenPoolW = castleLocalToWorld(
    HIDDEN_POOL_LOCAL_POS.localX,
    HIDDEN_POOL_LOCAL_POS.localZ,
  );
  const hiddenPoolY = getTerrainHeight(hiddenPoolW.x, hiddenPoolW.z) + 0.22;

  // Irregular organic spring water surface
  const hiddenPoolGeo = tracker.trackGeo(new THREE.CircleGeometry(4.2, 24));
  hiddenPoolGeo.rotateX(-Math.PI / 2);
  const hpPos = hiddenPoolGeo.attributes.position;
  for (let i = 1; i < hpPos.count; i++) {
    const vx = hpPos.getX(i);
    const vz = hpPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const radScale =
      1.0 +
      Math.sin(ang * 2.0 + 0.7) * 0.22 +
      Math.cos(ang * 3.0 - 1.1) * 0.14;
    hpPos.setX(i, vx * radScale * 1.15);
    hpPos.setZ(i, vz * radScale * 0.85);
  }
  hiddenPoolGeo.computeVertexNormals();

  const hiddenPoolMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: waterReflectTex ?? undefined,
      color: new THREE.Color('#14b8a6'),
      emissive: new THREE.Color('#0d9488'),
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0.14,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    }),
  );
  const hiddenPoolMesh = new THREE.Mesh(hiddenPoolGeo, hiddenPoolMat);
  hiddenPoolMesh.position.set(hiddenPoolW.x, hiddenPoolY, hiddenPoolW.z);
  hiddenPoolMesh.name = 'HiddenNorthernSpringPool';
  group.add(hiddenPoolMesh);

  // Springhead mossy rock shelf & damp boulders cradling the Hidden Pool
  for (let k = 0; k < 14; k++) {
    const ang = (k / 14) * Math.PI * 2;
    // Leave a walkable mossy bank on the northwest approach side
    if (ang > 2.1 && ang < 2.9) continue;

    const radScale =
      1.0 +
      Math.sin(ang * 2.0 + 0.7) * 0.22 +
      Math.cos(ang * 3.0 - 1.1) * 0.14;
    const rx = hiddenPoolW.x + Math.cos(ang) * 4.1 * radScale * 1.15;
    const rz = hiddenPoolW.z + Math.sin(ang) * 4.1 * radScale * 0.85;
    const ry = getTerrainHeight(rx, rz);

    const isSpringHead = k === 0 || k === 1;
    const rock = createCragBoulderGeometry(
      isSpringHead ? 0.95 : 0.48 + (k % 3) * 0.16,
      isSpringHead ? 0.65 : 0.24,
      isSpringHead ? 0.85 : 0.44 + (k % 2) * 0.16,
      0.2,
      1100 + k,
    );
    rock.translate(rx, ry + (isSpringHead ? 0.28 : 0.08), rz);
    wetShoreStoneGeos.push(rock);

    const mossCap = createCragBoulderGeometry(
      isSpringHead ? 0.82 : 0.36,
      0.12,
      isSpringHead ? 0.74 : 0.34,
      0.18,
      1130 + k,
    );
    mossCap.translate(rx, ry + (isSpringHead ? 0.62 : 0.22), rz);
    fadingTrailMossGeos.push(mossCap);

    if (k % 2 === 0) {
      const fern = createFernClusterGeo(0.92, 1160 + k);
      fern.translate(
        rx + Math.cos(ang) * 0.5,
        ry + 0.02,
        rz + Math.sin(ang) * 0.5,
      );
      shorelineFernGeos.push(fern);
    } else {
      const reed = createReedClusterGeo(1180 + k);
      reed.translate(rx, ry - 0.04, rz);
      reedGeos.push(reed);
    }
  }

  // ============================================================================
  // PART 4: NORTHERN WOODLAND TREES, SANCTUARY PERIMETER & DEEP WILDERNESS BEYOND
  // ============================================================================
  const northernTreeSpecs: Array<{
    lx: number;
    lz: number;
    h: number;
    r: number;
    isSanctuaryRim?: boolean;
  }> = [
    // Sun-dappled Northern Woodland Trees (framing open negative-space pockets)
    { lx: 75.5, lz: 24.5, h: 13.5, r: 0.56 },
    { lx: 82.5, lz: 15.0, h: 12.8, r: 0.52 },
    { lx: 80.0, lz: 33.5, h: 14.2, r: 0.58 },
    { lx: 89.5, lz: 22.0, h: 13.0, r: 0.54 },
    { lx: 84.5, lz: 40.5, h: 14.6, r: 0.60 },
    { lx: 93.0, lz: 29.0, h: 12.4, r: 0.50 },
    // Hidden Pool Secluded Framing Trees
    { lx: 99.5, lz: 18.8, h: 13.8, r: 0.56 },
    { lx: 98.8, lz: 9.8, h: 14.4, r: 0.58 },
    { lx: 91.2, lz: 10.5, h: 12.6, r: 0.52 },
    // Deepening Forest Transition before Sanctuary
    { lx: 94.0, lz: 46.5, h: 15.2, r: 0.64 },
    { lx: 101.5, lz: 35.0, h: 14.8, r: 0.62 },
    { lx: 102.0, lz: 50.0, h: 15.6, r: 0.66 },
    // Heartwood Sanctuary Irregular Clearing Perimeter (surrounding 114.0, 46.0 at ~14m-17m radius)
    { lx: 106.5, lz: 34.5, h: 16.0, r: 0.68, isSanctuaryRim: true },
    { lx: 114.5, lz: 31.8, h: 16.4, r: 0.70, isSanctuaryRim: true },
    { lx: 123.5, lz: 34.8, h: 15.8, r: 0.66, isSanctuaryRim: true },
    { lx: 128.5, lz: 42.5, h: 16.8, r: 0.72, isSanctuaryRim: true },
    { lx: 127.8, lz: 52.0, h: 16.2, r: 0.68, isSanctuaryRim: true },
    { lx: 121.5, lz: 58.8, h: 15.6, r: 0.66, isSanctuaryRim: true },
    { lx: 111.5, lz: 59.5, h: 16.0, r: 0.68, isSanctuaryRim: true },
    { lx: 103.8, lz: 54.5, h: 15.4, r: 0.64, isSanctuaryRim: true },
    // Deep Wilderness Beyond the Sanctuary (ensuring the forest continues beyond!)
    { lx: 133.5, lz: 48.0, h: 15.5, r: 0.62 },
    { lx: 135.0, lz: 58.5, h: 16.2, r: 0.65 },
    { lx: 128.0, lz: 66.0, h: 15.0, r: 0.60 },
    { lx: 118.0, lz: 67.5, h: 14.8, r: 0.58 },
    { lx: 141.0, lz: 54.0, h: 16.5, r: 0.66 },
    { lx: 139.5, lz: 65.5, h: 15.8, r: 0.64 },
  ];

  const deepCanopyGeos: THREE.BufferGeometry[] = [];

  northernTreeSpecs.forEach((tSpec, idx) => {
    const w = castleLocalToWorld(tSpec.lx, tSpec.lz);
    const wy = getTerrainHeight(w.x, w.z);
    const leanX = (rand() - 0.5) * 0.9;
    const leanZ = (rand() - 0.5) * 0.9;

    const tPts = [
      new THREE.Vector3(w.x, wy - 0.3, w.z),
      new THREE.Vector3(
        w.x + leanX * 0.4,
        wy + tSpec.h * 0.38,
        w.z + leanZ * 0.4,
      ),
      new THREE.Vector3(
        w.x + leanX,
        wy + tSpec.h * 0.78,
        w.z + leanZ,
      ),
    ];
    lakesideTreeParts.push(
      createOrganicRootOrBranchGeo(
        tPts,
        tSpec.r,
        tSpec.r * 0.36,
        10,
        7,
        1200 + idx,
      ),
    );

    // 3 basal roots per ancient tree
    for (let r = 0; r < 3; r++) {
      const rAng = (r / 3) * Math.PI * 2 + idx * 0.7;
      const rPts = [
        new THREE.Vector3(w.x, wy + 0.55, w.z),
        new THREE.Vector3(
          w.x + Math.cos(rAng) * (tSpec.r * 2.4),
          wy - 0.15,
          w.z + Math.sin(rAng) * (tSpec.r * 2.4),
        ),
      ];
      lakesideTreeParts.push(
        createOrganicRootOrBranchGeo(
          rPts,
          tSpec.r * 0.38,
          0.06,
          5,
          5,
          1250 + idx * 3 + r,
        ),
      );
    }

    // Layered canopy crowns
    const topX = w.x + leanX;
    const topY = wy + tSpec.h * 0.82;
    const topZ = w.z + leanZ;

    const crownMain = createOrganicCanopyClusterGeo(
      3.2 + (idx % 3) * 0.45,
      1.85,
      3.1 + (idx % 2) * 0.45,
      2,
      0.22,
      1300 + idx,
    );
    crownMain.translate(topX, topY, topZ);
    deepCanopyGeos.push(crownMain);

    const crownSun = createOrganicCanopyClusterGeo(
      2.4,
      1.35,
      2.3,
      1,
      0.2,
      1350 + idx,
    );
    crownSun.translate(topX + 0.8, topY + 1.1, topZ - 0.6);
    lakesideCanopyParts.push(crownSun);

    // Register trunk collider
    colliders.push({
      x: w.x,
      z: w.z,
      radius: tSpec.r * 0.92,
    });
  });

  // Natural Outer Perimeter Crag Boulders & Fallen Logs far beyond the Heartwood Sanctuary
  // (at localX: 110..146, localZ: 68..82) so the Sanctuary is completely open and never blocked!
  const outerRimBoulderGeos: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 14; b++) {
    const prog = b / 13;
    const lx = 104.0 + prog * 42.0;
    const lz = 68.0 + Math.sin(prog * Math.PI) * 10.0;
    const w = castleLocalToWorld(lx, lz);
    const wy = getTerrainHeight(w.x, w.z);
    const rx = 1.8 + (b % 3) * 0.5;
    const ry = 1.4 + (b % 2) * 0.5;
    const rz = 1.7 + (b % 3) * 0.5;

    const boulder = createCragBoulderGeometry(rx, ry, rz, 0.24, 1400 + b);
    boulder.translate(w.x, wy + ry * 0.35 - 0.2, w.z);
    outerRimBoulderGeos.push(boulder);

    colliders.push({ x: w.x, z: w.z, radius: Math.max(rx, rz) * 0.8 });
  }

  // ============================================================================
  // PART 5: THE HEARTWOOD SANCTUARY & THE HEARTWOOD TREE (`localX: 114.0, localZ: 46.0`)
  // ============================================================================
  const sanctuaryCenterW = castleLocalToWorld(
    HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
    HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
  );

  // 5A. Sanctuary Water Pool (`localX: 111.8, localZ: 48.2`) cradling the Heartwood Tree's roots
  const sanctuaryPoolLocal = { lx: 111.8, lz: 48.2 };
  const sanctuaryPoolW = castleLocalToWorld(
    sanctuaryPoolLocal.lx,
    sanctuaryPoolLocal.lz,
  );
  const sanctuaryPoolY =
    getTerrainHeight(sanctuaryPoolW.x, sanctuaryPoolW.z) + 0.18;

  const sanctuaryPoolGeo = tracker.trackGeo(new THREE.CircleGeometry(3.8, 28));
  sanctuaryPoolGeo.rotateX(-Math.PI / 2);
  const spPos = sanctuaryPoolGeo.attributes.position;
  for (let i = 1; i < spPos.count; i++) {
    const vx = spPos.getX(i);
    const vz = spPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const rMod = 1.0 + Math.sin(ang * 2.0 + 1.2) * 0.18 + Math.cos(ang * 3.0) * 0.1;
    spPos.setX(i, vx * rMod * 1.12);
    spPos.setZ(i, vz * rMod * 0.92);
  }
  sanctuaryPoolGeo.computeVertexNormals();

  const sanctuaryPoolMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: waterReflectTex ?? undefined,
      color: new THREE.Color('#38bdf8'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.28,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  const sanctuaryPoolMesh = new THREE.Mesh(sanctuaryPoolGeo, sanctuaryPoolMat);
  sanctuaryPoolMesh.position.set(
    sanctuaryPoolW.x,
    sanctuaryPoolY,
    sanctuaryPoolW.z,
  );
  sanctuaryPoolMesh.name = 'HeartwoodSanctuaryMirrorPool';
  group.add(sanctuaryPoolMesh);

  // 5B. THE HEARTWOOD TREE (`localX: 115.2, localZ: 46.5`)
  // Smaller, more intimate, and sacred compared to the monumental Giant Ancient Tree (10.5m vs 20.8m)
  const hwTreeLocal = { lx: 115.2, lz: 46.5 };
  const hwTreeW = castleLocalToWorld(hwTreeLocal.lx, hwTreeLocal.lz);
  const hwTreeY = getTerrainHeight(hwTreeW.x, hwTreeW.z);

  const hwBarkGeos: THREE.BufferGeometry[] = [];
  const hwCyanVeinGeos: THREE.BufferGeometry[] = [];
  const hwVioletVeinGeos: THREE.BufferGeometry[] = [];
  const hwCanopyGeos: THREE.BufferGeometry[] = [];
  const hwBlossomGeos: THREE.BufferGeometry[] = [];

  // Graceful intertwined twin-spiral Heartwood trunk
  for (let strand = 0; strand < 2; strand++) {
    const sPhase = strand * Math.PI;
    const pts: THREE.Vector3[] = [];
    for (let step = 0; step <= 6; step++) {
      const u = step / 6;
      const twist = u * Math.PI * 1.15 + sPhase;
      const radiusOffset = Math.sin(u * Math.PI) * 0.28;
      pts.push(
        new THREE.Vector3(
          hwTreeW.x + Math.cos(twist) * radiusOffset,
          hwTreeY - 0.25 + u * 6.4,
          hwTreeW.z + Math.sin(twist) * radiusOffset,
        ),
      );
    }
    hwBarkGeos.push(
      createOrganicRootOrBranchGeo(
        pts,
        0.58 - strand * 0.08,
        0.24,
        18,
        8,
        1500 + strand,
      ),
    );
  }

  // 7 Visible Sacred Roots radiating across the Sanctuary mound & dipping into the Sanctuary Pool
  for (let r = 0; r < 7; r++) {
    const rAng = (r / 7) * Math.PI * 2 + 0.25;
    const reach = r === 2 || r === 3 ? 4.4 : 3.2; // Roots 2 & 3 reach into the Sanctuary Water Pool
    const rPts: THREE.Vector3[] = [];
    for (let step = 0; step <= 4; step++) {
      const u = step / 4;
      const rx = hwTreeW.x + Math.cos(rAng + Math.sin(u * Math.PI) * 0.18) * (0.45 + u * reach);
      const rz = hwTreeW.z + Math.sin(rAng + Math.sin(u * Math.PI) * 0.18) * (0.45 + u * reach);
      const ry =
        getTerrainHeight(rx, rz) +
        (1.0 - u) * 0.85 +
        Math.sin(u * Math.PI) * 0.16 -
        0.04;
      rPts.push(new THREE.Vector3(rx, ry, rz));
    }
    hwBarkGeos.push(
      createOrganicRootOrBranchGeo(rPts, 0.26, 0.055, 12, 6, 1520 + r),
    );

    // Internal Emissive Root Veins (soft cyan & violet bioluminescent channels nestled along the root ridges)
    const veinPts = rPts.map(
      (p, idx) =>
        new THREE.Vector3(
          p.x,
          p.y + (idx === 0 ? 0.04 : 0.035),
          p.z,
        ),
    );
    const veinGeo = createOrganicRootOrBranchGeo(
      veinPts,
      0.065,
      0.018,
      10,
      5,
      1540 + r,
    );
    if (r % 3 === 0) {
      hwVioletVeinGeos.push(veinGeo);
    } else {
      hwCyanVeinGeos.push(veinGeo);
    }
  }

  // 5 Ascending Heartwood Bark Glow Filaments spiraling up the trunk into the crown
  for (let v = 0; v < 5; v++) {
    const vStartAng = (v / 5) * Math.PI * 2;
    const vPts: THREE.Vector3[] = [];
    for (let step = 0; step <= 6; step++) {
      const u = step / 6;
      const ang = vStartAng + u * Math.PI * 1.15;
      const rad = THREE.MathUtils.lerp(0.56, 0.25, u);
      vPts.push(
        new THREE.Vector3(
          hwTreeW.x + Math.cos(ang) * rad,
          hwTreeY + 0.4 + u * 5.8,
          hwTreeW.z + Math.sin(ang) * rad,
        ),
      );
    }
    const trunkVein = createOrganicRootOrBranchGeo(
      vPts,
      0.052,
      0.02,
      14,
      5,
      1560 + v,
    );
    if (v % 2 === 1) {
      hwVioletVeinGeos.push(trunkVein);
    } else {
      hwCyanVeinGeos.push(trunkVein);
    }
  }

  // 6 Gracefully Arched Heartwood Canopy Boughs & Sacred Foliage Clusters
  for (let b = 0; b < 6; b++) {
    const bAng = (b / 6) * Math.PI * 2 + 0.4;
    const bReach = 3.6 + (b % 2) * 0.8;
    const bPts = [
      new THREE.Vector3(hwTreeW.x, hwTreeY + 5.6, hwTreeW.z),
      new THREE.Vector3(
        hwTreeW.x + Math.cos(bAng) * (bReach * 0.55),
        hwTreeY + 7.2 + (b % 2) * 0.4,
        hwTreeW.z + Math.sin(bAng) * (bReach * 0.55),
      ),
      new THREE.Vector3(
        hwTreeW.x + Math.cos(bAng + 0.18) * bReach,
        hwTreeY + 7.8 + (b % 3) * 0.45,
        hwTreeW.z + Math.sin(bAng + 0.18) * bReach,
      ),
    ];
    hwBarkGeos.push(
      createOrganicRootOrBranchGeo(bPts, 0.22, 0.06, 10, 6, 1580 + b),
    );

    const endPt = bPts[2];
    const canopyCluster = createOrganicCanopyClusterGeo(
      2.35,
      1.28,
      2.25,
      2,
      0.22,
      1600 + b,
    );
    canopyCluster.translate(endPt.x, endPt.y + 0.45, endPt.z);
    hwCanopyGeos.push(canopyCluster);

    // Subtle luminous Heartwood blossoms hanging beneath the boughs
    for (let bl = 0; bl < 4; bl++) {
      const blAng = bAng + (bl - 1.5) * 0.28;
      const blRad = bReach * (0.55 + bl * 0.12);
      const blossom = new THREE.OctahedronGeometry(0.14, 1);
      blossom.scale(1.0, 1.45, 1.0);
      blossom.translate(
        hwTreeW.x + Math.cos(blAng) * blRad,
        endPt.y - 0.35 - (bl % 2) * 0.22,
        hwTreeW.z + Math.sin(blAng) * blRad,
      );
      hwBlossomGeos.push(blossom);
    }
  }

  // Central Heartwood Apex Crown
  const apexCrown = createOrganicCanopyClusterGeo(
    2.9,
    1.65,
    2.9,
    2,
    0.24,
    1620,
  );
  apexCrown.translate(hwTreeW.x, hwTreeY + 8.9, hwTreeW.z);
  hwCanopyGeos.push(apexCrown);

  // Merge and attach Heartwood Tree meshes
  const hwBarkMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(hwBarkGeos)),
    heartwoodBarkMat,
  );
  hwBarkGeos.forEach((g) => g.dispose());
  hwBarkMesh.castShadow = true;
  hwBarkMesh.receiveShadow = true;
  hwBarkMesh.name = 'HeartwoodTreeTrunkAndRoots';
  group.add(hwBarkMesh);

  const hwCyanVeinMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(hwCyanVeinGeos)),
    heartwoodVeinMat,
  );
  hwCyanVeinGeos.forEach((g) => g.dispose());
  hwCyanVeinMesh.name = 'HeartwoodTreeCyanVeins';
  group.add(hwCyanVeinMesh);

  const hwVioletVeinMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(hwVioletVeinGeos)),
    heartwoodVioletVeinMat,
  );
  hwVioletVeinGeos.forEach((g) => g.dispose());
  hwVioletVeinMesh.name = 'HeartwoodTreeVioletVeins';
  group.add(hwVioletVeinMesh);

  const hwCanopyMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(hwCanopyGeos)),
    heartwoodCanopyMat,
  );
  hwCanopyGeos.forEach((g) => g.dispose());
  hwCanopyMesh.castShadow = true;
  hwCanopyMesh.receiveShadow = true;
  hwCanopyMesh.name = 'HeartwoodTreeCanopy';
  group.add(hwCanopyMesh);

  const hwBlossomMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(hwBlossomGeos)),
    heartwoodBlossomMat,
  );
  hwBlossomGeos.forEach((g) => g.dispose());
  hwBlossomMesh.name = 'HeartwoodTreeBlossoms';
  group.add(hwBlossomMesh);

  colliders.push({
    x: hwTreeW.x,
    z: hwTreeW.z,
    radius: 0.95,
  });

  // 1 Restrained PointLight for the Heartwood Tree (Total Forest Dynamic Lights = 9 + 1 = 10 <= 12 Budget!)
  const heartwoodLight = new THREE.PointLight('#a5f3fc', 2.2, 24.0, 1.25);
  heartwoodLight.position.set(hwTreeW.x, hwTreeY + 3.4, hwTreeW.z);
  group.add(heartwoodLight);

  // 5C. 4 Ancient Weathered Sanctuary Stones with Faded Original Rune Carvings
  // Visually connecting the Heartwood Sanctuary to the Ancient Enchanted Realm
  const sanctuaryRuneStoneSpecs = [
    { lx: 106.8, lz: 41.2, yaw: 0.65, h: 1.85, tilt: 0.08 },
    { lx: 108.5, lz: 50.8, yaw: -0.45, h: 1.65, tilt: -0.11 },
    { lx: 118.8, lz: 52.2, yaw: -1.35, h: 2.05, tilt: 0.09 },
    { lx: 120.2, lz: 40.8, yaw: 1.85, h: 1.75, tilt: -0.07 },
  ];

  const runeStoneBodyGeos: THREE.BufferGeometry[] = [];
  const runeInlayGeos: THREE.BufferGeometry[] = [];

  sanctuaryRuneStoneSpecs.forEach((rSpec, idx) => {
    const rw = castleLocalToWorld(rSpec.lx, rSpec.lz);
    const ry = getTerrainHeight(rw.x, rw.z);

    const monolith = createCragBoulderGeometry(
      0.52,
      rSpec.h * 0.55,
      0.34,
      0.16,
      1700 + idx,
    );
    monolith.rotateZ(rSpec.tilt);
    monolith.rotateY(rSpec.yaw);
    monolith.translate(rw.x, ry + rSpec.h * 0.42, rw.z);
    runeStoneBodyGeos.push(monolith);

    // Moss cap on weathered stone
    const mCap = createCragBoulderGeometry(0.44, 0.16, 0.28, 0.18, 1720 + idx);
    mCap.rotateY(rSpec.yaw);
    mCap.translate(rw.x, ry + rSpec.h * 0.84, rw.z);
    fadingTrailMossGeos.push(mCap);

    // Faded original geometric rune carvings on the inward-facing stone surface
    const dirToTreeX = hwTreeW.x - rw.x;
    const dirToTreeZ = hwTreeW.z - rw.z;
    const faceYaw = Math.atan2(dirToTreeX, dirToTreeZ);
    const nX = Math.sin(faceYaw) * 0.31;
    const nZ = Math.cos(faceYaw) * 0.31;

    // Vertical stave + diamond rune ring
    const stave = new THREE.BoxGeometry(0.032, rSpec.h * 0.48, 0.02);
    stave.rotateY(faceYaw);
    stave.translate(rw.x + nX, ry + rSpec.h * 0.46, rw.z + nZ);
    runeInlayGeos.push(stave);

    const diamond = new THREE.TorusGeometry(0.14, 0.018, 5, 4);
    diamond.rotateY(faceYaw);
    diamond.translate(rw.x + nX * 1.04, ry + rSpec.h * 0.52, rw.z + nZ * 1.04);
    runeInlayGeos.push(diamond);

    colliders.push({ x: rw.x, z: rw.z, radius: 0.55 });
  });

  const runeStoneMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(runeStoneBodyGeos)),
    runeStoneMat,
  );
  runeStoneBodyGeos.forEach((g) => g.dispose());
  runeStoneMesh.castShadow = true;
  runeStoneMesh.receiveShadow = true;
  group.add(runeStoneMesh);

  const runeInlayMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(runeInlayGeos)),
    fadedRuneInlayMat,
  );
  runeInlayGeos.forEach((g) => g.dispose());
  group.add(runeInlayMesh);

  // 5D. Sanctuary Luminous Flora & Ferns (Moon-Flowers, Blue-Green Blossoms & Ferns)
  const sanctuaryFloraGeos: THREE.BufferGeometry[] = [];
  const sanctuaryFernGeos: THREE.BufferGeometry[] = [];

  for (let f = 0; f < 22; f++) {
    const fAng = (f / 22) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    const fRad = 3.2 + (f % 4) * 2.1 + rand() * 1.2;
    const fx = hwTreeW.x + Math.cos(fAng) * fRad;
    const fz = hwTreeW.z + Math.sin(fAng) * fRad;
    const fy = getTerrainHeight(fx, fz);

    const sFern = createFernClusterGeo(0.82 + (f % 3) * 0.18, 1750 + f);
    sFern.translate(fx, fy + 0.02, fz);
    sanctuaryFernGeos.push(sFern);

    // Luminous moon-flower / twilight blossom stem
    if (f % 2 === 0) {
      const chalice = new THREE.ConeGeometry(0.09, 0.18, 6, 1, true);
      chalice.rotateX(Math.PI);
      chalice.translate(fx, fy + 0.34, fz);
      sanctuaryFloraGeos.push(chalice);
    }
  }

  const sanctuaryFernMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(sanctuaryFernGeos)),
    sanctuaryFernMat,
  );
  sanctuaryFernGeos.forEach((g) => g.dispose());
  group.add(sanctuaryFernMesh);

  const sanctuaryFloraMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries(sanctuaryFloraGeos)),
    heartwoodBlossomMat,
  );
  sanctuaryFloraGeos.forEach((g) => g.dispose());
  group.add(sanctuaryFloraMesh);

  // 5E. ONE SUBTLE NATURAL SEATING POINT (`localX: 109.2, localZ: 43.8`)
  // Positioned with a serene view of the Heartwood Tree (115.2, 46.5), the Sanctuary Pool (111.8, 48.2),
  // and the open forest sky above — prepared for a future Yeshwanth -> Harsha moment.
  const seatLocal = { lx: 109.2, lz: 43.8 };
  const seatW = castleLocalToWorld(seatLocal.lx, seatLocal.lz);
  const seatY = getTerrainHeight(seatW.x, seatW.z);
  const seatLookTarget = new THREE.Vector3(
    (hwTreeW.x + sanctuaryPoolW.x) * 0.5,
    hwTreeY + 1.8,
    (hwTreeW.z + sanctuaryPoolW.z) * 0.5,
  );
  const seatYaw = Math.atan2(
    seatLookTarget.x - seatW.x,
    seatLookTarget.z - seatW.z,
  );

  const seatGroup = new THREE.Group();
  seatGroup.name = 'HeartwoodSanctuaryNaturalBench';
  seatGroup.position.set(seatW.x, seatY, seatW.z);
  seatGroup.rotation.y = seatYaw;

  // Two smooth mossy ancient support stones
  const leftStone = tracker.trackGeo(
    createCragBoulderGeometry(0.36, 0.28, 0.38, 0.14, 1801),
  );
  leftStone.translate(-0.78, 0.22, 0);
  const rightStone = tracker.trackGeo(
    createCragBoulderGeometry(0.36, 0.28, 0.38, 0.14, 1802),
  );
  rightStone.translate(0.78, 0.22, 0);

  // Weathered heartwood slab seat & subtle backrest log
  const seatSlabGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.95, 0.11, 0.56, 0.035),
  );
  seatSlabGeo.translate(0, 0.44, 0);

  const backrestPts = [
    new THREE.Vector3(-0.88, 0.72, -0.24),
    new THREE.Vector3(0.0, 0.76, -0.28),
    new THREE.Vector3(0.88, 0.72, -0.24),
  ];
  const backrestGeo = tracker.trackGeo(
    createOrganicRootOrBranchGeo(backrestPts, 0.085, 0.08, 10, 6, 1803),
  );

  const supportPostsGeo = (() => {
    const pL = new THREE.CylinderGeometry(0.055, 0.07, 0.36, 6);
    pL.rotateX(-0.18);
    pL.translate(-0.72, 0.58, -0.2);
    const pR = pL.clone();
    pR.translate(1.44, 0, 0);
    const merged = mergeGeometries([pL, pR]);
    pL.dispose();
    pR.dispose();
    return tracker.trackGeo(merged);
  })();

  const seatStoneMesh = new THREE.Mesh(
    tracker.trackGeo(mergeGeometries([leftStone, rightStone])),
    runeStoneMat,
  );
  seatStoneMesh.castShadow = true;
  seatStoneMesh.receiveShadow = true;
  seatGroup.add(seatStoneMesh);

  const seatWoodMesh = new THREE.Mesh(
    tracker.trackGeo(
      mergeGeometries([seatSlabGeo, backrestGeo, supportPostsGeo]),
    ),
    heartwoodBarkMat,
  );
  seatWoodMesh.castShadow = true;
  seatWoodMesh.receiveShadow = true;
  seatGroup.add(seatWoodMesh);

  // Subtle moss cushion on one corner of the bench
  const benchMossGeo = tracker.trackGeo(
    createOrganicCanopyClusterGeo(0.28, 0.06, 0.22, 1, 0.15, 1805),
  );
  benchMossGeo.translate(-0.75, 0.5, -0.08);
  seatGroup.add(new THREE.Mesh(benchMossGeo, mossMat));

  group.add(seatGroup);
  colliders.push({ x: seatW.x, z: seatW.z, radius: 0.75 });

  const sanctuarySeatAnchor: SanctuarySeatAnchor = {
    worldPosition: new THREE.Vector3(seatW.x, seatY + 0.48, seatW.z),
    lookAtTarget: seatLookTarget,
    seatYaw,
    interactionRadius: 2.8,
  };

  // ============================================================================
  // PART 6: MERGE BATCHED NORTHERN WOODLAND & SHORELINE GEOMETRIES
  // ============================================================================
  if (lakesideTreeParts.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(lakesideTreeParts));
    lakesideTreeParts.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, ancientBarkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (deepCanopyGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(deepCanopyGeos));
    deepCanopyGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, canopyDeepMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (lakesideCanopyParts.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(lakesideCanopyParts));
    lakesideCanopyParts.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, canopySunlitMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (reedGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(reedGeos));
    reedGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, reedMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  if (shorelineFernGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(shorelineFernGeos));
    shorelineFernGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, fernMat);
    group.add(mesh);
  }

  if (wetShoreStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(wetShoreStoneGeos));
    wetShoreStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, wetStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (fadingTrailStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(fadingTrailStoneGeos));
    fadingTrailStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, runeStoneMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (fadingTrailMossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(fadingTrailMossGeos));
    fadingTrailMossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (fadingTrailRootGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(fadingTrailRootGeos));
    fadingTrailRootGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, ancientBarkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (outerRimBoulderGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(outerRimBoulderGeos));
    outerRimBoulderGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, wetStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ============================================================================
  // PART 7: FLOATING HEARTWOOD SANCTUARY MOTES & LAKE RESPONSE MOTES (48 Total)
  // ============================================================================
  const moteCount = 48; // 42 in Heartwood Sanctuary + 6 Lake Moon-Flower response motes
  const motePositions = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  const moteData: Array<{
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
    speed: number;
    driftR: number;
    isLakeMote: boolean;
  }> = [];

  for (let i = 0; i < moteCount; i++) {
    const isLakeMote = i >= 42;
    let bx = 0;
    let by = 0;
    let bz = 0;

    if (isLakeMote) {
      const ang = ((i - 42) / 6) * Math.PI * 2;
      const rad = 0.6 + rand() * 1.6;
      bx = lakeMoonFlowerW.x + Math.cos(ang) * rad;
      bz = lakeMoonFlowerW.z + Math.sin(ang) * rad;
      by = lakeWaterY + 0.35 + rand() * 0.9;
    } else {
      const ang = rand() * Math.PI * 2;
      const rad = 0.8 + rand() * 8.5;
      bx = hwTreeW.x + Math.cos(ang) * rad;
      bz = hwTreeW.z + Math.sin(ang) * rad;
      by = getTerrainHeight(bx, bz) + 0.4 + rand() * 4.8;
    }

    motePositions[i * 3] = bx;
    motePositions[i * 3 + 1] = by;
    motePositions[i * 3 + 2] = bz;

    const isViolet = i % 4 === 0 && !isLakeMote;
    moteColors[i * 3] = isViolet ? 0.82 : 0.45;
    moteColors[i * 3 + 1] = isViolet ? 0.72 : 0.94;
    moteColors[i * 3 + 2] = 0.99;

    moteData.push({
      baseX: bx,
      baseY: by,
      baseZ: bz,
      phase: rand() * Math.PI * 2,
      speed: 0.45 + rand() * 0.45,
      driftR: 0.3 + rand() * 0.55,
      isLakeMote,
    });
  }

  const moteGeo = tracker.trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteColors, 3));

  const moteMat = tracker.trackMat(
    new THREE.PointsMaterial({
      map: moteSpriteTex ?? undefined,
      size: 0.24,
      transparent: true,
      opacity: 0.86,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const sanctuaryMotes = new THREE.Points(moteGeo, moteMat);
  sanctuaryMotes.name = 'HeartwoodSanctuaryLuminousMotes';
  group.add(sanctuaryMotes);

  return {
    group,
    colliders,
    particleCount: moteCount,
    dynamicLightCount: 1, // Single restrained PointLight for the Heartwood Tree
    sanctuarySeatAnchor,

    getLakePhotoPrompt(playerWorldPos: THREE.Vector3) {
      if (isLakeMemoryPhaseActive(lakePhotoState)) return null;
      const distToFlower = playerWorldPos.distanceTo(lakeMoonFlowerPos);
      const lakeEdgeDist = Math.abs(
        Math.hypot(
          (playerWorldPos.x - lakeW.x) / 1.2,
          (playerWorldPos.z - lakeW.z) / 0.94,
        ) - 9.0,
      );
      if (distToFlower <= LAKE_PHOTO_INTERACT_RADIUS || lakeEdgeDist <= 3.6) {
        return {
          isNear: true,
          title: 'Enchanted Forest Lake',
          actionLabel: 'Gaze into the Water',
        };
      }
      return null;
    },

    triggerLakePhoto(
      playerWorldPos: THREE.Vector3,
      _audio: ForestAudioSynthesizer,
      _elapsedTime: number,
    ): boolean {
      // Guard against held/repeated E key opening multiple copies while sequence is active
      if (isLakeMemoryPhaseActive(lakePhotoState)) return false;
      const distToFlower = playerWorldPos.distanceTo(lakeMoonFlowerPos);
      const lakeEdgeDist = Math.abs(
        Math.hypot(
          (playerWorldPos.x - lakeW.x) / 1.2,
          (playerWorldPos.z - lakeW.z) / 0.94,
        ) - 9.0,
      );
      if (distToFlower > LAKE_PHOTO_INTERACT_RADIUS && lakeEdgeDist > 3.6) {
        return false;
      }

      lakePhotoState = 'RISING';
      lakeMemoryTimer = 0.0;
      dropRippleTriggered = false;
      figureToneTriggered = false;
      dissolveRippleTriggered = false;
      capturedPlayerShorePos.copy(playerWorldPos);

      // Compute horizontal unit vector from player's near shoreline position toward the lake center
      let dirX = lakeW.x - playerWorldPos.x;
      let dirZ = lakeW.z - playerWorldPos.z;
      const dirLen = Math.hypot(dirX, dirZ);
      if (dirLen > 0.001) {
        dirX /= dirLen;
        dirZ /= dirLen;
      } else {
        dirX = shoreForwardXZ.x;
        dirZ = shoreForwardXZ.y;
      }
      viewerForwardXZ.set(dirX, dirZ).normalize();
      viewerRightXZ.set(-viewerForwardXZ.y, viewerForwardXZ.x).normalize();

      // Place the sub-surface memory photograph deterministically in the clean FAR-RIGHT / END
      // water zone of the lake so it is never obstructed by terrain, trees, or shoreline rocks
      lakeFocalPoint.set(
        lakeW.x + shoreForwardXZ.x * 1.95 + shoreRightXZ.x * 2.55,
        lakeWaterY + 0.015,
        lakeW.z + shoreForwardXZ.y * 1.95 + shoreRightXZ.y * 2.55,
      );
      lakeRippleMesh.position.set(
        lakeFocalPoint.x,
        lakeWaterY + 0.022,
        lakeFocalPoint.z,
      );

      // 1. Captured third-person gameplay camera start/return anchor behind the player on the near shore
      const startCamGroundY = getTerrainHeight(
        capturedPlayerShorePos.x - viewerForwardXZ.x * 3.1,
        capturedPlayerShorePos.z - viewerForwardXZ.y * 3.1,
      );
      startCamPos.set(
        capturedPlayerShorePos.x - viewerForwardXZ.x * 3.1,
        Math.max(startCamGroundY + 0.95, capturedPlayerShorePos.y + 1.95),
        capturedPlayerShorePos.z - viewerForwardXZ.y * 3.1,
      );
      startLookPos.set(
        capturedPlayerShorePos.x + viewerForwardXZ.x * 2.2,
        capturedPlayerShorePos.y + 1.25,
        capturedPlayerShorePos.z + viewerForwardXZ.y * 2.2,
      );

      // 2. High three-quarter / top view (1.5s - 6.5s) showing:
      //    - the player near the shoreline
      //    - the clean lake water surface
      //    - the crystal-clear photograph emerging in the far-right/end section of the lake
      highCamPos.set(
        capturedPlayerShorePos.x -
          viewerForwardXZ.x * 2.6 -
          viewerRightXZ.x * 0.85,
        lakeWaterY + 8.15,
        capturedPlayerShorePos.z -
          viewerForwardXZ.y * 2.6 -
          viewerRightXZ.y * 0.85,
      );
      highLookPos.set(
        lakeFocalPoint.x * 0.72 + lakeW.x * 0.28,
        lakeWaterY + 0.08,
        lakeFocalPoint.z * 0.72 + lakeW.z * 0.28,
      );

      // 3. Curved crossing control point & intimate lakeside viewpoint (6.5s - 12.0s)
      //    Sweeps gracefully over the right side of the lake into an intimate three-quarter profile
      //    viewpoint (~3.1m -> 2.35m from Harsha & Yeshwanth) so their walk-up, turn, hug, and kiss
      //    are framed clearly with the glowing lake reflection behind them.
      crossCtrlPos.set(
        lakeW.x + viewerForwardXZ.x * 1.4 + viewerRightXZ.x * 4.2,
        lakeWaterY + 3.85,
        lakeW.z + viewerForwardXZ.y * 1.4 + viewerRightXZ.y * 4.2,
      );

      const oppX =
        capturedPlayerShorePos.x +
        viewerForwardXZ.x * 2.15 +
        viewerRightXZ.x * 2.25;
      const oppZ =
        capturedPlayerShorePos.z +
        viewerForwardXZ.y * 2.15 +
        viewerRightXZ.y * 2.25;
      const oppGroundY = getTerrainHeight(oppX, oppZ);
      oppBaseCamPos.set(
        oppX,
        Math.max(oppGroundY + 0.85, capturedPlayerShorePos.y + 1.52),
        oppZ,
      );

      // 4. Elevated return arc control point (12.0s - 13.5s) back to gameplay camera
      returnCtrlPos.set(
        capturedPlayerShorePos.x -
          viewerForwardXZ.x * 1.2 +
          viewerRightXZ.x * 2.1,
        lakeWaterY + 2.85,
        capturedPlayerShorePos.z -
          viewerForwardXZ.y * 1.2 +
          viewerRightXZ.y * 2.1,
      );

      // Align sub-surface photograph horizontal UV basis with the high-view camera's look direction
      // so the photograph reads right-side-up during the 5-second high view (1.5s - 6.5s)
      const photoFwdX = lakeFocalPoint.x - highCamPos.x;
      const photoFwdZ = lakeFocalPoint.z - highCamPos.z;
      const photoFwdLen = Math.hypot(photoFwdX, photoFwdZ) || 1.0;
      const photoFwd = new THREE.Vector2(
        photoFwdX / photoFwdLen,
        photoFwdZ / photoFwdLen,
      );
      const photoRight = new THREE.Vector2(-photoFwd.y, photoFwd.x);

      lakeSubsurfaceUniforms.uMemoryCenterXZ.value.set(
        lakeFocalPoint.x,
        lakeFocalPoint.z,
      );
      lakeSubsurfaceUniforms.uForwardXZ.value.copy(photoFwd);
      lakeSubsurfaceUniforms.uRightXZ.value.copy(photoRight);
      lakeSubsurfaceUniforms.uRevealProgress.value = 0.0;
      lakeSubsurfaceUniforms.uEmergencePhase.value = 0.0;
      lakeSubsurfaceUniforms.uDissolveProgress.value = 0.0;
      lakeSubsurfaceUniforms.uDistortion.value = 1.0;
      lakeSubsurfaceUniforms.uDropRippleProgress.value = 0.0;
      lakeSubsurfaceUniforms.uFireflyGlow.value = 0.0;

      // Align fallback mesh position & yaw with the high-view orientation
      fallbackSubsurfaceMesh.position.set(
        lakeFocalPoint.x,
        lakeWaterY + 0.018,
        lakeFocalPoint.z,
      );
      fallbackSubsurfaceMesh.rotation.set(
        -Math.PI / 2,
        0,
        Math.atan2(photoRight.y, photoRight.x),
      );
      fallbackSubsurfaceMesh.visible = false;

      // Reset Yeshwanth figure state
      memoryFigureGroup.visible = false;
      yeshCharacterMaterials.forEach((m) => {
        m.opacity = 0.0;
      });
      memoryHaloMat.opacity = 0.0;
      memMistMat.opacity = 0.0;
      lakeCameraFocus.playerTurnAlpha = 0.0;
      lakeCameraFocus.embraceAlpha = 0.0;
      lakeCameraFocus.kissAlpha = 0.0;

      return true;
    },

    isLakePhotoActive(): boolean {
      return isLakeMemoryPhaseActive(lakePhotoState);
    },

    advanceLakePhoto(): boolean {
      // No "Press Enter" step advancement during the 13.5s continuous water memory cinematic
      return false;
    },

    skipLakePhoto(): boolean {
      if (!isLakeMemoryPhaseActive(lakePhotoState)) return false;
      lakePhotoState = 'WAITING_FOR_E';
      lakeMemoryTimer = 0.0;
      dropRippleTriggered = false;
      figureToneTriggered = false;
      dissolveRippleTriggered = false;
      lakeCameraFocus.active = false;
      lakeCameraFocus.blendAlpha = 0.0;
      lakeCameraFocus.playerTurnAlpha = 0.0;
      lakeCameraFocus.embraceAlpha = 0.0;
      lakeCameraFocus.kissAlpha = 0.0;
      lakeSubsurfaceUniforms.uRevealProgress.value = 0.0;
      lakeSubsurfaceUniforms.uEmergencePhase.value = 0.0;
      lakeSubsurfaceUniforms.uDissolveProgress.value = 0.0;
      lakeSubsurfaceUniforms.uDistortion.value = 1.0;
      lakeSubsurfaceUniforms.uDropRippleProgress.value = 0.0;
      lakeSubsurfaceUniforms.uFireflyGlow.value = 0.0;
      fallbackSubsurfaceMesh.visible = false;
      fallbackDiskMat.opacity = 0.0;
      rippleRingMat.opacity = 0.0;
      memoryFigureGroup.visible = false;
      yeshCharacterMaterials.forEach((m) => {
        m.opacity = 0.0;
      });
      memoryHaloMat.opacity = 0.0;
      memMistMat.opacity = 0.0;
      return true;
    },

    getLakePhotoBanner(): LakePhotoDialogueBanner | null {
      // Strictly no UI popup, modal, dialogue box, or "Press Enter" prompt during the cinematic
      return null;
    },

    getLakeCameraFocus(): LakeMemoryCameraFocus | null {
      if (!isLakeMemoryPhaseActive(lakePhotoState) || !lakeCameraFocus.active) {
        return null;
      }
      return lakeCameraFocus;
    },

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
      audio: ForestAudioSynthesizer,
    ): void {
      lakeSubsurfaceUniforms.uTime.value = elapsedTime;

      // 1. 13.5-SECOND MULTI-PHASE LAKE MEMORY STATE MACHINE (Gated strictly by pressing E)
      const distToLakeFlower = playerWorldPos.distanceTo(lakeMoonFlowerPos);

      if (!isLakeMemoryPhaseActive(lakePhotoState)) {
        lakePhotoState =
          distToLakeFlower <= LAKE_PHOTO_INTERACT_RADIUS
            ? 'WAITING_FOR_E'
            : 'IDLE';
        lakeCameraFocus.active = false;
        lakeCameraFocus.blendAlpha = 0.0;
        lakeCameraFocus.playerTurnAlpha = 0.0;
        lakeCameraFocus.embraceAlpha = 0.0;
        lakeCameraFocus.kissAlpha = 0.0;
        memoryFigureGroup.visible = false;
        audio.setLakeMemoryDucking(0.0);
      } else {
        lakeMemoryTimer += dt;
        const t = lakeMemoryTimer;

        // Update explicit state machine phase based on timeline position (16.0s total)
        if (t < 1.5) {
          lakePhotoState = 'RISING';
        } else if (t < 6.2) {
          lakePhotoState = 'WATER_REVEAL';
        } else if (t < 7.5) {
          lakePhotoState = 'CROSSING';
        } else if (t < 10.4) {
          lakePhotoState = 'MEMORY_REVEAL';
        } else if (t < 13.7) {
          lakePhotoState = 'MEMORY_HOLD';
        } else if (t < 14.6) {
          lakePhotoState = 'DISSOLVE';
        } else {
          lakePhotoState = 'RETURN';
        }

        // Ambient audio ducking: gently quiet forest noise during 0.0s - 1.5s, restore during 14.5s - 16.0s
        let duckAmount = 0.0;
        if (t < 1.5) {
          duckAmount = THREE.MathUtils.smoothstep(t, 0.0, 1.5);
        } else if (t <= 14.5) {
          duckAmount = 1.0;
        } else if (t < LAKE_MEMORY_DURATION) {
          duckAmount = 1.0 - THREE.MathUtils.smoothstep(t, 14.5, LAKE_MEMORY_DURATION);
        }
        audio.setLakeMemoryDucking(duckAmount);

        // Audio cues:
        // - 1.55s: Soft water ripple + sub-surface harmonic warmth pad as high-view water reveal begins
        if (t >= 1.55 && !dropRippleTriggered) {
          dropRippleTriggered = true;
          audio.playLakeMemoryDrop();
        }
        // - 7.8s: Warm atmospheric tone when Yeshwanth begins slowly walking up from behind Harsha
        if (t >= 7.8 && !figureToneTriggered) {
          figureToneTriggered = true;
          audio.playLakeMemoryFigureTone();
        }
        // - 13.7s: Gentle dissolve ripple wave when the memory figure & water photo dissolve
        if (t >= 13.7 && !dissolveRippleTriggered) {
          dissolveRippleTriggered = true;
          audio.playLakeMemoryDissolveRipple();
        }

        // Single concentric drop ripple progress (1.55s -> 4.05s)
        const dropProg =
          t >= 1.55 ? THREE.MathUtils.clamp((t - 1.55) / 2.5, 0.0, 1.0) : 0.0;
        lakeSubsurfaceUniforms.uDropRippleProgress.value = dropProg;

        // --------------------------------------------------------------------
        // SUB-SURFACE WATER PHOTO TIMELINE (1.5s - 6.2s High View + 13.7s - 14.6s Dissolve)
        // --------------------------------------------------------------------
        let revealProg = 0.0;
        let emergencePhase = 0.0;
        let dissolveProg = 0.0;
        let distortion = 1.0;

        if (t < 1.5) {
          // 0.0s - 1.5s (RISING): Begin gentle emergence as camera lifts so photo is ready
          const u0 = THREE.MathUtils.smoothstep(t, 0.8, 1.5);
          revealProg = u0 * 0.18;
          emergencePhase = u0 * 0.25;
          dissolveProg = 0.0;
          distortion = THREE.MathUtils.lerp(1.0, 0.75, u0);
        } else if (t < 2.5) {
          // 1.5s - 2.5s (WATER_REVEAL 1): Ripple spreads and golden-rimmed reflection surfaces
          const u1 = THREE.MathUtils.smoothstep(t, 1.5, 2.5);
          revealProg = THREE.MathUtils.lerp(0.18, 0.58, u1);
          emergencePhase = THREE.MathUtils.lerp(0.25, 0.68, u1);
          dissolveProg = 0.0;
          distortion = THREE.MathUtils.lerp(0.75, 0.35, u1);
        } else if (t < 3.6) {
          // 2.5s - 3.6s (WATER_REVEAL 2): Full color & detail lock into crystal-clear focus
          const u2 = THREE.MathUtils.smoothstep(t, 2.5, 3.6);
          revealProg = THREE.MathUtils.lerp(0.58, 0.94, u2);
          emergencePhase = THREE.MathUtils.lerp(0.68, 0.96, u2);
          dissolveProg = 0.0;
          distortion = THREE.MathUtils.lerp(0.35, 0.14, u2);
        } else if (t < 6.2) {
          // 3.6s - 6.2s (WATER_REVEAL 3-5): Hold crystal-clear vivid reflection with warm golden rim
          const u3 = THREE.MathUtils.smoothstep(t, 3.6, 4.5);
          revealProg = THREE.MathUtils.lerp(0.94, 1.0, u3);
          emergencePhase = 1.0;
          dissolveProg = 0.0;
          distortion = 0.11 + Math.sin(t * 1.8) * 0.01;
        } else if (t < 13.7) {
          // 6.2s - 13.7s (CROSSING, MEMORY_REVEAL, MEMORY_HOLD):
          // Photograph remains vividly glowing in the lake water while Yeshwanth walks up & hugs Harsha
          revealProg = 0.96;
          emergencePhase = 1.0;
          dissolveProg = 0.0;
          distortion = 0.12 + Math.sin(t * 1.6) * 0.012;
        } else if (t < 14.6) {
          // 13.7s - 14.6s (DISSOLVE): Dissolve photograph back into expanding ripples
          const d = THREE.MathUtils.clamp((t - 13.7) / 0.9, 0.0, 1.0);
          const smoothD = THREE.MathUtils.smoothstep(t, 13.7, 14.6);
          revealProg = 0.96 * (1.0 - Math.pow(smoothD, 1.3));
          emergencePhase = 1.0;
          dissolveProg = d;
          distortion = THREE.MathUtils.lerp(0.12, 1.35, smoothD);
        } else {
          // 14.6s - 16.0s (RETURN): Lake surface is completely normal again
          revealProg = 0.0;
          emergencePhase = 0.0;
          dissolveProg = 0.0;
          distortion = 1.0;
        }

        lakeSubsurfaceUniforms.uRevealProgress.value = revealProg;
        lakeSubsurfaceUniforms.uEmergencePhase.value = emergencePhase;
        lakeSubsurfaceUniforms.uDissolveProgress.value = dissolveProg;
        lakeSubsurfaceUniforms.uDistortion.value = distortion;

        // 3 faint environmental firefly reflections drifting across the revealed water image
        const ffGlow =
          t >= 2.2 && t <= 14.4
            ? THREE.MathUtils.smoothstep(t, 2.2, 4.0) *
              (1.0 - THREE.MathUtils.smoothstep(t, 13.4, 14.4))
            : 0.0;
        lakeSubsurfaceUniforms.uFireflyGlow.value = ffGlow;
        lakeSubsurfaceUniforms.uFirefly1.value.set(
          lakeFocalPoint.x + Math.cos(elapsedTime * 0.55) * 1.25,
          lakeFocalPoint.z + Math.sin(elapsedTime * 0.48) * 0.9,
        );
        lakeSubsurfaceUniforms.uFirefly2.value.set(
          lakeFocalPoint.x + Math.sin(elapsedTime * 0.42 + 2.1) * 1.4,
          lakeFocalPoint.z + Math.cos(elapsedTime * 0.52 + 1.4) * 1.0,
        );
        lakeSubsurfaceUniforms.uFirefly3.value.set(
          lakeFocalPoint.x + Math.cos(elapsedTime * 0.38 + 4.2) * 0.95,
          lakeFocalPoint.z + Math.sin(elapsedTime * 0.61 + 3.1) * 0.8,
        );

        // Concentric surface ripple ring mesh (1.55s initial drop & 13.7s dissolve ripple)
        if (dropProg > 0.001 && dropProg < 0.999) {
          const rScale = 0.6 + dropProg * 6.4;
          lakeRippleMesh.scale.set(rScale, 1.0, rScale);
          rippleRingMat.opacity = Math.sin(dropProg * Math.PI) * 0.56;
        } else if (dissolveProg > 0.001 && dissolveProg < 0.999) {
          const rScale = 0.8 + dissolveProg * 7.6;
          lakeRippleMesh.scale.set(rScale, 1.0, rScale);
          rippleRingMat.opacity = Math.sin(dissolveProg * Math.PI) * 0.48;
        } else {
          rippleRingMat.opacity = 0.0;
        }

        // Graceful fallback mesh update if custom shader compilation failed on software renderer
        if (useFallbackSubsurfaceMesh && revealProg > 0.001) {
          fallbackSubsurfaceMesh.visible = true;
          fallbackDiskMat.opacity = revealProg * 0.92;
          const posAttr = fallbackDiskGeo.attributes
            .position as THREE.BufferAttribute;
          for (let v = 0; v < posAttr.count; v++) {
            const bx = fallbackBasePos[v * 3];
            const by = fallbackBasePos[v * 3 + 1];
            const bz = fallbackBasePos[v * 3 + 2];
            const waveX =
              Math.sin(bz * 2.2 + elapsedTime * 1.8) * 0.06 * distortion;
            const waveZ =
              Math.cos(bx * 2.2 - elapsedTime * 1.6) * 0.06 * distortion;
            const waveY =
              Math.sin((bx + bz) * 1.8 + elapsedTime * 1.5) * 0.01;
            posAttr.setXYZ(v, bx + waveX, by + waveY, bz + waveZ);
          }
          posAttr.needsUpdate = true;
        } else {
          fallbackSubsurfaceMesh.visible = false;
        }

        // --------------------------------------------------------------------
        // YESHWANTH SLOW WALK FROM BEHIND & SLOW TENDER HUG FROM BEHIND (7.2s - 14.5s)
        // --------------------------------------------------------------------
        if (t >= 7.2 && t < 14.5) {
          memoryFigureGroup.visible = true;

          // Beat 1 (7.2s - 10.4s): Yeshwanth materializes softly 1.85m behind Harsha and
          //                        SLOWLY walks up from behind her over ~3.0 seconds
          // Beat 2 (9.9s - 12.4s): His arms SLOWLY rise and wrap around her shoulders and waist
          //                        from behind in a warm, lingering hug (2.5s slow hug wrap)
          // Beat 3 (11.5s - 13.7s): He holds her closely from behind, resting his head tenderly
          //                         against hers as they sway softly together by the water
          // Beat 4 (13.7s - 14.5s): Slow release and warm golden starlight dissolve
          const condenseU = THREE.MathUtils.smoothstep(t, 7.2, 8.2);
          const walkU = THREE.MathUtils.smoothstep(t, 7.45, 10.4);
          const embraceU =
            THREE.MathUtils.smoothstep(t, 9.9, 12.4) *
            (1.0 - THREE.MathUtils.smoothstep(t, 13.65, 14.45));
          const kissU =
            THREE.MathUtils.smoothstep(t, 11.4, 12.7) *
            (1.0 - THREE.MathUtils.smoothstep(t, 13.55, 14.3));
          const figureDissolveU = THREE.MathUtils.smoothstep(t, 13.7, 14.48);
          const figureVisibility = condenseU * (1.0 - figureDissolveU);

          // Harsha stays facing the lake (playerTurnAlpha = 0) while leaning gently back into his hug from behind
          lakeCameraFocus.playerTurnAlpha = 0.0;
          lakeCameraFocus.embraceAlpha = embraceU;
          lakeCameraFocus.kissAlpha = kissU;

          // Slowly walk from 1.85m behind Harsha right up to 0.25m behind her back for the hug
          const distBehind =
            THREE.MathUtils.lerp(1.85, 0.25, walkU) -
            embraceU * 0.02 +
            figureDissolveU * 0.22;
          // Slight lateral offset during walk-up so Yeshwanth is clearly visible behind Harsha's shoulder,
          // then nestling right behind her with a gentle romantic sway during the embrace
          const gentleSway =
            embraceU * Math.sin((t - 10.2) * 1.15) * 0.032;
          const lateralNudge =
            THREE.MathUtils.lerp(0.14, 0.045, walkU) + gentleSway;
          const figX =
            capturedPlayerShorePos.x -
            viewerForwardXZ.x * distBehind +
            viewerRightXZ.x * lateralNudge;
          const figZ =
            capturedPlayerShorePos.z -
            viewerForwardXZ.y * distBehind +
            viewerRightXZ.y * lateralNudge;
          const figGroundY = getTerrainHeight(figX, figZ);

          // Slow, calm, unhurried walking stride cycle while stepping up from behind (7.45s - 10.4s)
          const walkEnvelope =
            THREE.MathUtils.smoothstep(t, 7.45, 7.9) * (1.0 - walkU);
          const stridePhase = (t - 7.45) * 4.1;
          const strideSwing = Math.sin(stridePhase) * 0.28 * walkEnvelope;
          const walkBobY =
            Math.abs(Math.sin(stridePhase)) * 0.022 * walkEnvelope;
          const breathY = Math.sin(elapsedTime * 1.5) * 0.01;

          memoryFigureGroup.position.set(
            figX,
            Math.max(figGroundY, capturedPlayerShorePos.y) +
              walkBobY +
              breathY +
              figureDissolveU * 0.12,
            figZ,
          );
          memoryFigureGroup.rotation.set(
            0,
            Math.atan2(viewerForwardXZ.x, viewerForwardXZ.y),
            0,
          );

          // Slow leg stride during walk-up, settling smoothly to a grounded stance as he reaches her
          const slowHugDamp = 2.8;
          yeshLeftLegPivot.rotation.x = THREE.MathUtils.damp(
            yeshLeftLegPivot.rotation.x,
            strideSwing,
            6.0,
            dt,
          );
          yeshRightLegPivot.rotation.x = THREE.MathUtils.damp(
            yeshRightLegPivot.rotation.x,
            -strideSwing,
            6.0,
            dt,
          );

          // Gentle forward torso lean & subtle sway as he wraps his arms around her from behind
          memoryBodyGroup.rotation.x = THREE.MathUtils.damp(
            memoryBodyGroup.rotation.x,
            embraceU * 0.065 + kissU * 0.045,
            slowHugDamp,
            dt,
          );
          memoryBodyGroup.rotation.z = THREE.MathUtils.damp(
            memoryBodyGroup.rotation.z,
            gentleSway * 0.8,
            slowHugDamp,
            dt,
          );
          memoryBodyGroup.scale.setScalar(1.06 + figureDissolveU * 0.06);

          // Slow, tender hugging animation:
          // - Arms swing gently during the slow walk from behind
          // - Slowly rise forward (-1.12 rad) and bend inward across Harsha's front shoulders & waist
          leftArmPivot.rotation.x = THREE.MathUtils.damp(
            leftArmPivot.rotation.x,
            THREE.MathUtils.lerp(-strideSwing * 0.55, -1.10 - kissU * 0.05, embraceU),
            slowHugDamp,
            dt,
          );
          leftArmPivot.rotation.y = THREE.MathUtils.damp(
            leftArmPivot.rotation.y,
            THREE.MathUtils.lerp(0.0, 0.34, embraceU),
            slowHugDamp,
            dt,
          );
          leftArmPivot.rotation.z = THREE.MathUtils.damp(
            leftArmPivot.rotation.z,
            THREE.MathUtils.lerp(0.11, -0.14, embraceU),
            slowHugDamp,
            dt,
          );

          rightArmPivot.rotation.x = THREE.MathUtils.damp(
            rightArmPivot.rotation.x,
            THREE.MathUtils.lerp(strideSwing * 0.55, -1.14 - kissU * 0.06, embraceU),
            slowHugDamp,
            dt,
          );
          rightArmPivot.rotation.y = THREE.MathUtils.damp(
            rightArmPivot.rotation.y,
            THREE.MathUtils.lerp(0.0, -0.36, embraceU),
            slowHugDamp,
            dt,
          );
          rightArmPivot.rotation.z = THREE.MathUtils.damp(
            rightArmPivot.rotation.z,
            THREE.MathUtils.lerp(-0.11, 0.14, embraceU),
            slowHugDamp,
            dt,
          );

          leftForearmPivot.rotation.x = THREE.MathUtils.damp(
            leftForearmPivot.rotation.x,
            THREE.MathUtils.lerp(-0.14, -0.78, embraceU),
            slowHugDamp,
            dt,
          );
          leftForearmPivot.rotation.z = THREE.MathUtils.damp(
            leftForearmPivot.rotation.z,
            THREE.MathUtils.lerp(0.0, -0.46, embraceU),
            slowHugDamp,
            dt,
          );

          rightForearmPivot.rotation.x = THREE.MathUtils.damp(
            rightForearmPivot.rotation.x,
            THREE.MathUtils.lerp(-0.14, -0.82, embraceU),
            slowHugDamp,
            dt,
          );
          rightForearmPivot.rotation.z = THREE.MathUtils.damp(
            rightForearmPivot.rotation.z,
            THREE.MathUtils.lerp(0.0, 0.48, embraceU),
            slowHugDamp,
            dt,
          );

          // Head & neck:
          // - Warm gaze toward Harsha as he slowly walks up from behind
          // - Slowly tilts down and nestles tenderly against her head/cheek during the hug
          memHeadPivot.rotation.x = THREE.MathUtils.damp(
            memHeadPivot.rotation.x,
            embraceU * 0.14 + kissU * 0.12,
            slowHugDamp,
            dt,
          );
          memHeadPivot.rotation.z = THREE.MathUtils.damp(
            memHeadPivot.rotation.z,
            -embraceU * 0.08 - kissU * 0.08,
            slowHugDamp,
            dt,
          );
          memHeadPivot.rotation.y = THREE.MathUtils.damp(
            memHeadPivot.rotation.y,
            -embraceU * 0.10 - kissU * 0.08,
            slowHugDamp,
            dt,
          );

          // Warm golden-lit character opacity (solid & recognizable, 94% peak) + hug glow boost
          const charOpacity = figureVisibility * 0.94;
          for (let m = 0; m < yeshCharacterMaterials.length; m++) {
            yeshCharacterMaterials[m].opacity = charOpacity;
          }
          yeshSkinMat.emissiveIntensity = 0.22 + embraceU * 0.14 + kissU * 0.1;
          yeshJacketMat.emissiveIntensity = 0.24 + embraceU * 0.12 + kissU * 0.08;
          yeshGoldTrimMat.emissiveIntensity = 0.42 + embraceU * 0.28 + kissU * 0.18;

          // Golden ground shimmer & rising starlight motes around the couple
          const mistIn = THREE.MathUtils.smoothstep(t, 7.2, 8.4);
          const mistOut = 1.0 - THREE.MathUtils.smoothstep(t, 13.7, 14.48);
          const mistAlpha = mistIn * mistOut;
          memoryHaloMat.opacity = (0.28 + embraceU * 0.18) * mistAlpha;
          memMistMat.opacity = (0.72 + embraceU * 0.24) * mistAlpha;

          const mistAttr = memMistGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          const sepExpand =
            1.0 + THREE.MathUtils.smoothstep(t, 13.65, 14.48) * 1.35;
          for (let i = 0; i < memMistCount; i++) {
            const mb = memMistBase[i];
            const ang = mb.angle + elapsedTime * 0.48 + mb.phase;
            const rad =
              mb.radius *
              THREE.MathUtils.lerp(1.35, 0.92, embraceU) *
              sepExpand;
            const my =
              mb.baseY +
              Math.sin(elapsedTime * mb.speed + mb.phase) * 0.14 +
              embraceU * 0.14 +
              figureDissolveU * (0.38 + (i % 3) * 0.18);
            mistAttr.setXYZ(
              i,
              Math.cos(ang) * rad,
              my,
              0.14 + Math.sin(ang) * rad,
            );
          }
          mistAttr.needsUpdate = true;
        } else {
          memoryFigureGroup.visible = false;
          for (let m = 0; m < yeshCharacterMaterials.length; m++) {
            yeshCharacterMaterials[m].opacity = 0.0;
          }
          memoryHaloMat.opacity = 0.0;
          memMistMat.opacity = 0.0;
          lakeCameraFocus.playerTurnAlpha = 0.0;
          lakeCameraFocus.embraceAlpha = 0.0;
          lakeCameraFocus.kissAlpha = 0.0;
        }

        // --------------------------------------------------------------------
        // MULTI-PHASE CONTINUOUS CAMERA JOURNEY (0.0s - 16.0s, Zero Hard Cuts)
        // --------------------------------------------------------------------
        // Living subtle drift during the high view (1.5s - 6.2s)
        const highDriftX =
          Math.sin((t - 1.5) * 0.62) * 0.22 * viewerRightXZ.x +
          Math.cos((t - 1.5) * 0.48) * 0.12 * viewerForwardXZ.x;
        const highDriftZ =
          Math.sin((t - 1.5) * 0.62) * 0.22 * viewerRightXZ.y +
          Math.cos((t - 1.5) * 0.48) * 0.12 * viewerForwardXZ.y;
        const highDriftY = Math.sin((t - 1.5) * 0.75) * 0.08;

        // Intimate front-three-quarter lakeside camera framing during 7.5s - 14.5s:
        // Looks back across the water edge at Harsha and the path behind her so the player clearly sees
        // Yeshwanth slowly walking up from behind her and slowly wrapping his arms around her in a hug!
        const computeOppositeShoreCamera = (
          arcProgress: number,
          outCam: THREE.Vector3,
          outLook: THREE.Vector3,
        ) => {
          const pushDist = THREE.MathUtils.lerp(3.25, 2.35, arcProgress);
          const baseAngle = Math.atan2(
            oppBaseCamPos.z - capturedPlayerShorePos.z,
            oppBaseCamPos.x - capturedPlayerShorePos.x,
          );
          const rotAngle = baseAngle - arcProgress * 0.28;
          const cx =
            capturedPlayerShorePos.x + Math.cos(rotAngle) * pushDist;
          const cz =
            capturedPlayerShorePos.z + Math.sin(rotAngle) * pushDist;
          const cGround = getTerrainHeight(cx, cz);
          const cy = Math.max(
            cGround + 0.75,
            capturedPlayerShorePos.y +
              THREE.MathUtils.lerp(1.54, 1.44, arcProgress),
          );
          outCam.set(cx, cy, cz);

          // Look slightly behind Harsha at first so Yeshwanth's slow approach is framed,
          // then center right on the couple as he wraps his arms around her from behind
          const lookBehindDist = THREE.MathUtils.lerp(0.45, 0.12, arcProgress);
          const coupleMidX =
            capturedPlayerShorePos.x - viewerForwardXZ.x * lookBehindDist;
          const coupleMidZ =
            capturedPlayerShorePos.z - viewerForwardXZ.y * lookBehindDist;
          outLook.set(
            coupleMidX,
            capturedPlayerShorePos.y +
              THREE.MathUtils.lerp(1.32, 1.40, arcProgress),
            coupleMidZ,
          );
        };

        if (t < 1.5) {
          // 0.0s - 1.5s (RISING): Smooth ease-in-out lift from gameplay camera to high view
          const u = THREE.MathUtils.smoothstep(t, 0.0, 1.5);
          lakeCameraFocus.camWorldPos.lerpVectors(startCamPos, highCamPos, u);
          lakeCameraFocus.lookWorldPos.lerpVectors(
            startLookPos,
            highLookPos,
            u,
          );
          lakeCameraFocus.blendAlpha = 1.0;
          lakeCameraFocus.active = true;
        } else if (t < 6.2) {
          // 1.5s - 6.2s (WATER_REVEAL): High view with subtle drift over the lake & photo
          const driftEnv = Math.sin(((t - 1.5) / 4.7) * Math.PI);
          lakeCameraFocus.camWorldPos.set(
            highCamPos.x + highDriftX * driftEnv,
            highCamPos.y + highDriftY * driftEnv,
            highCamPos.z + highDriftZ * driftEnv,
          );
          lakeCameraFocus.lookWorldPos.set(
            highLookPos.x + highDriftX * 0.35 * driftEnv,
            highLookPos.y,
            highLookPos.z + highDriftZ * 0.35 * driftEnv,
          );
          lakeCameraFocus.blendAlpha = 1.0;
          lakeCameraFocus.active = true;
        } else if (t < 7.5) {
          // 6.2s - 7.5s (CROSSING): Smooth curved quadratic Bezier flight from high view
          // down to the front-three-quarter lakeside viewpoint looking at Harsha & Yeshwanth behind her
          const u = THREE.MathUtils.smoothstep(t, 6.2, 7.5);
          const invU = 1.0 - u;
          const oppStartCam = new THREE.Vector3();
          const oppStartLook = new THREE.Vector3();
          computeOppositeShoreCamera(0.0, oppStartCam, oppStartLook);

          lakeCameraFocus.camWorldPos.set(
            invU * invU * highCamPos.x +
              2.0 * invU * u * crossCtrlPos.x +
              u * u * oppStartCam.x,
            invU * invU * highCamPos.y +
              2.0 * invU * u * crossCtrlPos.y +
              u * u * oppStartCam.y,
            invU * invU * highCamPos.z +
              2.0 * invU * u * crossCtrlPos.z +
              u * u * oppStartCam.z,
          );
          lakeCameraFocus.lookWorldPos.lerpVectors(
            highLookPos,
            oppStartLook,
            u,
          );
          lakeCameraFocus.blendAlpha = 1.0;
          lakeCameraFocus.active = true;
        } else if (t < 14.5) {
          // 7.5s - 14.5s (MEMORY_REVEAL, MEMORY_HOLD, DISSOLVE):
          // Slow push-in framing Yeshwanth slowly walking from behind Harsha and hugging her from behind
          const arcU = THREE.MathUtils.smoothstep(t, 7.5, 14.2);
          computeOppositeShoreCamera(
            arcU,
            lakeCameraFocus.camWorldPos,
            lakeCameraFocus.lookWorldPos,
          );
          lakeCameraFocus.blendAlpha = 1.0;
          lakeCameraFocus.active = true;
        } else if (t < LAKE_MEMORY_DURATION) {
          // 14.5s - 16.0s (RETURN): Smooth curved flight back to original third-person camera
          const u = THREE.MathUtils.smoothstep(t, 14.5, LAKE_MEMORY_DURATION);
          const invU = 1.0 - u;
          const oppEndCam = new THREE.Vector3();
          const oppEndLook = new THREE.Vector3();
          computeOppositeShoreCamera(1.0, oppEndCam, oppEndLook);

          lakeCameraFocus.camWorldPos.set(
            invU * invU * oppEndCam.x +
              2.0 * invU * u * returnCtrlPos.x +
              u * u * startCamPos.x,
            invU * invU * oppEndCam.y +
              2.0 * invU * u * returnCtrlPos.y +
              u * u * startCamPos.y,
            invU * invU * oppEndCam.z +
              2.0 * invU * u * returnCtrlPos.z +
              u * u * startCamPos.z,
          );
          lakeCameraFocus.lookWorldPos.lerpVectors(
            oppEndLook,
            startLookPos,
            u,
          );
          // Smoothly hand off blendAlpha at the very end of the return
          lakeCameraFocus.blendAlpha =
            1.0 - THREE.MathUtils.smoothstep(t, 15.65, LAKE_MEMORY_DURATION);
          lakeCameraFocus.active = true;
        }

        // Complete the 13.5s sequence and restore normal gameplay state
        if (t >= LAKE_MEMORY_DURATION) {
          lakePhotoState =
            distToLakeFlower <= LAKE_PHOTO_INTERACT_RADIUS
              ? 'WAITING_FOR_E'
              : 'IDLE';
          lakeMemoryTimer = 0.0;
          lakeCameraFocus.active = false;
          lakeCameraFocus.blendAlpha = 0.0;
          lakeCameraFocus.playerTurnAlpha = 0.0;
          lakeCameraFocus.embraceAlpha = 0.0;
          lakeCameraFocus.kissAlpha = 0.0;
          lakeSubsurfaceUniforms.uRevealProgress.value = 0.0;
          lakeSubsurfaceUniforms.uFireflyGlow.value = 0.0;
          fallbackSubsurfaceMesh.visible = false;
          rippleRingMat.opacity = 0.0;
          memoryFigureGroup.visible = false;
          audio.setLakeMemoryDucking(0.0);
        }
      }

      // Shoreline Moon-Flower gently blooms in sympathy with the lake memory
      const targetBloom =
        isLakeMemoryPhaseActive(lakePhotoState) &&
        lakeMemoryTimer >= 1.5 &&
        lakeMemoryTimer <= 12.0
          ? 1.0
          : 0.0;

      moonFlowerBloom = THREE.MathUtils.lerp(
        moonFlowerBloom,
        targetBloom,
        dt * (targetBloom > moonFlowerBloom ? 1.15 : 0.75),
      );

      // Smoothly open/close the 6 Moon-Flower petals
      const openAngle = 0.18 + moonFlowerBloom * 0.78;
      for (let p = 0; p < petalPivots.length; p++) {
        const mesh = petalPivots[p].children[0] as THREE.Mesh;
        mesh.rotation.x =
          openAngle + Math.sin(elapsedTime * 1.6 + p) * 0.03 * moonFlowerBloom;
      }

      // Emissive glow on Moon-Flower & Lake reflection catch
      moonPetalMat.emissiveIntensity = 0.22 + moonFlowerBloom * 0.85;
      moonCoreMat.emissiveIntensity = 0.35 + moonFlowerBloom * 1.15;
      lakeReflectionMat.emissiveIntensity =
        0.15 + Math.sin(elapsedTime * 1.2) * 0.03 + moonFlowerBloom * 0.22;

      // 2. HEARTWOOD SANCTUARY BREATHING GLOW & AUDIO AMBIENCE
      const distToSanctuary = Math.hypot(
        playerWorldPos.x - sanctuaryCenterW.x,
        playerWorldPos.z - sanctuaryCenterW.z,
      );
      if (distToSanctuary < 15.0) {
        audio.playSanctuaryHarmonicPulse(elapsedTime, distToSanctuary);
      }

      const proximityBoost = THREE.MathUtils.clamp(
        1.0 - distToSanctuary / 18.0,
        0.0,
        1.0,
      );
      const heartPulse =
        0.5 + 0.5 * Math.sin(elapsedTime * 1.35) + proximityBoost * 0.35;

      heartwoodVeinMat.emissiveIntensity = 0.72 + heartPulse * 0.48;
      heartwoodVioletVeinMat.emissiveIntensity = 0.58 + heartPulse * 0.42;
      heartwoodBlossomMat.emissiveIntensity = 0.55 + heartPulse * 0.38;
      fadedRuneInlayMat.emissiveIntensity = 0.38 + heartPulse * 0.32;
      heartwoodLight.intensity = 1.95 + heartPulse * 0.55;

      // Subtle shimmer on Hidden Pool & Sanctuary Pool water
      hiddenPoolMat.emissiveIntensity =
        0.2 + Math.sin(elapsedTime * 1.5 + 1.0) * 0.04;
      sanctuaryPoolMat.emissiveIntensity =
        0.24 + Math.sin(elapsedTime * 1.35) * 0.06 + proximityBoost * 0.14;

      // 3. UPDATE SANCTUARY & LAKE RESPONSE MOTES
      const posAttr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = moteGeo.getAttribute('color') as THREE.BufferAttribute;

      for (let i = 0; i < moteCount; i++) {
        const m = moteData[i];
        const t = elapsedTime * m.speed + m.phase;

        const mx = m.baseX + Math.sin(t * 0.85) * m.driftR;
        const mz = m.baseZ + Math.cos(t * 0.78) * m.driftR;
        const my =
          m.baseY +
          Math.sin(t * 1.2) * 0.32 +
          (m.isLakeMote ? moonFlowerBloom * 0.45 : 0.0);

        posAttr.setXYZ(i, mx, my, mz);

        const pulse =
          0.45 + 0.55 * Math.sin(elapsedTime * 1.8 + m.phase * 2.5);
        const activeFactor = m.isLakeMote
          ? 0.25 + moonFlowerBloom * 0.75
          : 0.75 + proximityBoost * 0.25;
        const bFactor = pulse * activeFactor;

        const isViolet = i % 4 === 0 && !m.isLakeMote;
        colAttr.setXYZ(
          i,
          (isViolet ? 0.82 : 0.42) * bFactor,
          (isViolet ? 0.7 : 0.94) * bFactor,
          0.99 * bFactor,
        );
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
