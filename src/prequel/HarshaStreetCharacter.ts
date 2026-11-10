import * as THREE from 'three';
import { HarshaAnimState } from './chapter1StateMachine';

export interface HarshaJointRig {
  pelvisGroup: THREE.Group;
  upperBodyPivot: THREE.Group;
  chestGroup: THREE.Group;
  neckPivot: THREE.Group;
  headPivot: THREE.Group;
  headMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  leftWristGroup: THREE.Group;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  rightWristGroup: THREE.Group;
  rightFingerCurlPivot: THREE.Group;
  leftLeg: {
    hipPivot: THREE.Group;
    kneePivot: THREE.Group;
    anklePivot: THREE.Group;
  };
  rightLeg: {
    hipPivot: THREE.Group;
    kneePivot: THREE.Group;
    anklePivot: THREE.Group;
  };
  tunicFlarePivot: THREE.Group;
  slingBagPivot: THREE.Group;
  scarfTailPivot: THREE.Group;
  scarfTailLowerPivot: THREE.Group;
  hairBackUpperPivot: THREE.Group;
  hairBackLowerPivot: THREE.Group;
  leftTempleLockPivot: THREE.Group;
  rightTempleLockPivot: THREE.Group;
  earringPivots: THREE.Group[];
  eyeBallGroups: THREE.Group[];
  eyelidMeshes: THREE.Mesh[];
  eyebrowPivots: THREE.Group[];
  contactShadow: THREE.Mesh;
  faceBeautyLight: THREE.PointLight;
  faceFillLight: THREE.PointLight;
}

export interface HarshaCharacterBundle {
  group: THREE.Group;
  joints: HarshaJointRig;
  phoneAnchorWorldPos: THREE.Vector3;
  shoulderWorldPos: THREE.Vector3;
  headWorldPos: THREE.Vector3;
  setAnimationState: (next: HarshaAnimState) => void;
  getAnimationState: () => HarshaAnimState;
  update: (
    dt: number,
    elapsed: number,
    moveSpeedRatio: number,
    onFootstep?: (isLeft: boolean, speedRatio: number) => void,
    aimYawDelta?: number,
    aimPitchDelta?: number,
    turnBankRoll?: number,
  ) => void;
  dispose: () => void;
}

const _tempPhoneWorld = new THREE.Vector3();
const _tempShoulderWorld = new THREE.Vector3();
const _tempHeadWorld = new THREE.Vector3();

/**
 * Generates a high-resolution (256x256) radial Hazel-Amber Iris Texture
 * with a dark limbal ring, golden-brown iris fibers, deep pupil, and crisp catchlight.
 */
function createIrisCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = 128;
    const cy = 128;

    // Base radial iris gradient (dark limbal ring -> rich espresso -> warm golden amber -> pupil)
    const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 124);
    grad.addColorStop(0.0, '#050404');
    grad.addColorStop(0.28, '#090606');
    grad.addColorStop(0.34, '#7c4722');
    grad.addColorStop(0.58, '#5c3116');
    grad.addColorStop(0.82, '#2d160b');
    grad.addColorStop(0.95, '#120905');
    grad.addColorStop(1.0, '#090504');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 124, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial iris striations
    for (let i = 0; i < 140; i++) {
      const angle = (i / 140) * Math.PI * 2;
      const innerR = 38 + (i % 5) * 4;
      const outerR = 104 + (i % 7) * 2.5;
      ctx.strokeStyle =
        i % 3 === 0
          ? 'rgba(217, 149, 78, 0.28)'
          : 'rgba(42, 20, 10, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.stroke();
    }

    // Deep velvet center pupil
    ctx.fillStyle = '#040303';
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();

    // Subtle warm golden collarette ring around pupil
    ctx.strokeStyle = 'rgba(234, 179, 104, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 43, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a high-polygon (96x96 = 18,432 triangles) sculpted female beauty head geometry:
 * - Graceful heart-shaped V-line jawline & delicate feminine chin (zero "round ball" look)
 * - Smooth, luminous high cheekbones with airbrushed per-vertex rosy blush & highlight shading
 * - Gentle orbital eye contour & gracefully arched brow ridge
 * - Seamlessly integrated slender feminine nose bridge & softly upturned dainty nasal tip
 * (Face is oriented along -Z, crown at +Y, back of skull at +Z)
 */
function createSculptedSharpHeadGeometry(): THREE.BufferGeometry {
  const radius = 0.126;
  const geo = new THREE.SphereGeometry(radius, 96, 96);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();

  const baseColor = new THREE.Color(0xffffff);
  const blushColor = new THREE.Color(0xe08288);
  const shadowTone = new THREE.Color(0xdca08c);
  const highlightTone = new THREE.Color(0xfff4ec);
  const vertColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Normalized coordinates in [-1, 1]
    const nx = v.x / radius;
    const ny = v.y / radius;
    const nz = v.z / radius;
    const absX = Math.abs(nx);

    // 1. Feminine Heart-Shaped Cranial Proportions
    v.x *= 0.87;
    v.y *= 1.07;
    v.z *= 0.96;

    // 2. Graceful V-Tapered Lower Face & Delicate Chin (below cheekbones ny < 0.08)
    if (ny < 0.08) {
      const jawT = THREE.MathUtils.clamp((0.08 - ny) / 1.08, 0, 1);

      // Smooth heart-shaped V-line taper toward a delicate feminine chin
      const vTaper = 1.0 - Math.pow(jawT, 1.22) * 0.52;
      v.x *= vTaper;

      // Subtle, graceful cheek contour (smooth transition, never gaunt or sunken)
      if (nz < 0 && absX > 0.28 && jawT > 0.12 && jawT < 0.65) {
        const contour = Math.sin(((jawT - 0.12) / 0.53) * Math.PI) * 0.0042;
        v.x -= Math.sign(v.x) * contour;
      }

      // Delicate forward chin projection on the front hemisphere (nz < 0)
      if (nz < 0.12 && ny < -0.35) {
        const chinT = THREE.MathUtils.clamp((-0.35 - ny) / 0.65, 0, 1);
        const chinSpan = Math.max(0, 1 - Math.pow(absX / 0.45, 2));
        v.z -= Math.sin(chinT * Math.PI * 0.85) * chinSpan * 0.012;
      }

      // Crisp submental under-chin jawline definition
      if (ny < -0.58 && nz > -0.42) {
        v.y += Math.pow(Math.max(0, (-0.58 - ny) / 0.42), 1.3) * 0.022;
      }
    }

    // 3. Luminous High Cheekbones (ny in [-0.10, 0.22], nz < -0.15)
    let cheekBlushWeight = 0;
    if (nz < -0.15 && ny > -0.14 && ny < 0.24) {
      const cheekY = 1 - Math.abs(ny - 0.04) / 0.19;
      const cheekX = 1 - Math.abs(absX - 0.52) / 0.34;
      if (cheekY > 0 && cheekX > 0) {
        const smoothCheek =
          Math.sin(cheekY * Math.PI * 0.5) * Math.sin(cheekX * Math.PI * 0.5);
        const zygoma = smoothCheek * 0.0082;
        v.x += Math.sign(v.x) * zygoma * 0.85;
        v.z -= zygoma * 0.72;
        cheekBlushWeight = smoothCheek;
      }
    }

    // 4. Gentle Orbital Contour, Brow Arch & Seamless Dainty Feminine Nose (nz < -0.45)
    let eyelidCreaseWeight = 0;
    let bridgeHighlightWeight = 0;
    if (nz < -0.45) {
      // Soft orbital recess around nx = ±0.32, ny = 0.12 so eyes sit naturally
      const dxEye = (absX - 0.32) / 0.21;
      const dyEye = (ny - 0.12) / 0.15;
      const distEyeSq = dxEye * dxEye + dyEye * dyEye;
      if (distEyeSq < 1.0) {
        const socketDepth = Math.cos(distEyeSq * Math.PI * 0.5) * 0.0065;
        v.z += socketDepth;
        if (ny > 0.12) {
          eyelidCreaseWeight = Math.cos(distEyeSq * Math.PI * 0.5);
        }
      }

      // Softly arched feminine brow bone (ny in [0.23, 0.41])
      if (ny > 0.22 && ny < 0.42 && absX < 0.6) {
        const browT = 1 - Math.abs(ny - 0.31) / 0.1;
        const browSpan = 1 - Math.pow(absX / 0.6, 2);
        if (browT > 0 && browSpan > 0) {
          v.z -= browT * browSpan * 0.0055;
        }
      }

      // Seamlessly Sculpted Slender Feminine Nose Bridge & Softly Upturned Nasal Tip
      if (absX < 0.155 && ny > -0.21 && ny < 0.27) {
        const noseWidthT = Math.pow(
          Math.cos((absX / 0.155) * (Math.PI * 0.5)),
          1.35,
        );
        // Peak projection at dainty tip (ny ~ -0.10), tapering smoothly to bridge (ny ~ 0.27)
        const noseProfileT =
          ny >= -0.1
            ? 1 - THREE.MathUtils.smoothstep(ny, -0.1, 0.27)
            : THREE.MathUtils.smoothstep(ny, -0.21, -0.1);
        // Subtle ski-slope feminine curve along the bridge
        const skiSlopeCurve =
          ny > -0.05 ? Math.pow(noseProfileT, 1.15) : noseProfileT;
        v.z -= noseWidthT * skiSlopeCurve * 0.021;
        bridgeHighlightWeight = noseWidthT * skiSlopeCurve;
      }
    }

    // 5. Soft Temple Taper
    if (ny > 0.12 && ny < 0.55 && nz < 0.1 && absX > 0.66) {
      v.x *= 0.955;
    }

    // 6. Per-Vertex Airbrushed Beauty Shading (Rosy Cheek Blush + Eyeshadow + Bridge Highlight)
    vertColor.copy(baseColor);
    if (cheekBlushWeight > 0) {
      vertColor.lerp(blushColor, cheekBlushWeight * 0.42);
    }
    if (eyelidCreaseWeight > 0) {
      vertColor.lerp(shadowTone, eyelidCreaseWeight * 0.35);
    }
    if (bridgeHighlightWeight > 0) {
      vertColor.lerp(highlightTone, bridgeHighlightWeight * 0.32);
    }
    colors[i * 3] = vertColor.r;
    colors[i * 3 + 1] = vertColor.g;
    colors[i * 3 + 2] = vertColor.b;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a high-polygon (56x36) draped silk kurti skirt with natural vertical fabric pleats
 * and tailored waist-to-hip curvature.
 */
function createDrapedKurtiSkirtGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.138, 0.228, 0.39, 56, 36, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    // y is in [-0.195, +0.195]; 0 at top waist, 1 at bottom hem
    const hemT = THREE.MathUtils.clamp((0.195 - v.y) / 0.39, 0, 1);

    // Subtle organic fabric pleats radiating toward the lower hem
    const pleatWave =
      (Math.sin(angle * 10) * 0.0055 + Math.cos(angle * 16) * 0.003) *
      Math.pow(hemT, 1.3);
    const radialScale = 1 + pleatWave;

    v.x *= radialScale * 1.03;
    v.z *= radialScale * 0.78;
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * AAA High-Polygon Character Implementation for Harsha (Prologue · Chapter 1: The Ordinary Night)
 */
export function createHarshaStreetCharacter(): HarshaCharacterBundle {
  const group = new THREE.Group();
  group.name = 'HarshaCinematicCharacter';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // ============================================================================
  // HIGH-CRAFT PBR & PHYSICAL MATERIALS
  // ============================================================================
  const skinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xebb99b,
      roughness: 0.34,
      metalness: 0.01,
      clearcoat: 0.14,
      clearcoatRoughness: 0.48,
      sheen: 0.35,
      sheenRoughness: 0.48,
      sheenColor: new THREE.Color(0xffdcd0),
    }),
  );
  const headSkinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xebb99b,
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.01,
      clearcoat: 0.16,
      clearcoatRoughness: 0.44,
      sheen: 0.38,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xffe0d4),
    }),
  );
  const eyelidMakeupMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd49689,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.25,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xf9c6b6),
    }),
  );
  const lipMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc84b5c,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.14,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xff9eaa),
    }),
  );
  const eyeScleraMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfdfefe,
      roughness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    }),
  );
  const irisTex = createIrisCanvasTexture();
  const eyeIrisMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
  );
  const tearDuctMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe58c94,
      roughness: 0.2,
      clearcoat: 0.8,
    }),
  );
  const eyeCatchlightMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }),
  );
  const eyelashMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x070508,
    }),
  );
  const pearlWhiteMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfffbf5,
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 0.9,
    }),
  );
  const diamondStudMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }),
  );
  const hairMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x120d15,
      roughness: 0.34,
      metalness: 0.14,
      clearcoat: 0.32,
      clearcoatRoughness: 0.38,
      sheen: 0.38,
      sheenColor: new THREE.Color(0x3d2e46),
    }),
  );
  const outfitKurtiMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x862244,
      roughness: 0.48,
      metalness: 0.06,
      sheen: 0.5,
      sheenRoughness: 0.42,
      sheenColor: new THREE.Color(0xf4a2b8),
    }),
  );
  const outfitTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe4b482,
      roughness: 0.26,
      metalness: 0.72,
    }),
  );
  const scarfMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xeed0b3,
      roughness: 0.64,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xfff1e0),
    }),
  );
  const jeansMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x192334,
      roughness: 0.64,
      metalness: 0.08,
    }),
  );
  const bootMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x15151a,
      roughness: 0.3,
      metalness: 0.28,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
    }),
  );
  const bootSoleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x09090c,
      roughness: 0.76,
    }),
  );
  const bagMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2c1d1a,
      roughness: 0.36,
      metalness: 0.25,
      clearcoat: 0.2,
    }),
  );
  const goldAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.16,
      metalness: 0.92,
    }),
  );
  const bindiMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x6b1426,
    }),
  );
  const phoneBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.15,
      metalness: 0.9,
    }),
  );

  // High-contrast CanvasTexture for the 3D Smartphone Screen ("Are you home yet?")
  const phoneCanvas = document.createElement('canvas');
  phoneCanvas.width = 256;
  phoneCanvas.height = 512;
  const ctx = phoneCanvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#070b16');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('10:30', 128, 106);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText('Sat, 13 February', 128, 136);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.96)';
    ctx.beginPath();
    ctx.roundRect(14, 194, 228, 122, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MESSAGE · NOW', 30, 228);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText('"Are you home yet?"', 28, 274);
  }
  const phoneTex = new THREE.CanvasTexture(phoneCanvas);
  phoneTex.colorSpace = THREE.SRGBColorSpace;

  const phoneScreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: phoneTex,
      emissive: 0x93c5fd,
      emissiveMap: phoneTex,
      emissiveIntensity: 0.0,
      roughness: 0.1,
    }),
  );

  // Soft Ground Contact Shadow Disc (High-Segment)
  const contactShadow = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.38, 48)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x020307,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    ),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.014;
  group.add(contactShadow);

  // ============================================================================
  // 1. HIGH-POLYGON ROOT PELVIS, HOURGLASS TORSO & DRAPED PLEATED KURTI
  // ============================================================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.89, 0);
  group.add(pelvisGroup);

  const pelvisMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.138, 0.146, 0.14, 36, 12)),
    jeansMat,
  );
  pelvisMesh.scale.set(1.04, 1, 0.75);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  const upperBodyPivot = new THREE.Group();
  upperBodyPivot.position.set(0, 0.05, 0);
  pelvisGroup.add(upperBodyPivot);

  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 0.22, 0);
  upperBodyPivot.add(chestGroup);

  // High-density 36x48 Hourglass Torso Mesh
  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.15, 0.34, 32, 48)),
    outfitKurtiMat,
  );
  torsoMesh.position.set(0, 0.04, 0);
  torsoMesh.scale.set(1.03, 1, 0.72);
  torsoMesh.castShadow = true;
  chestGroup.add(torsoMesh);

  // Zari Gold Embroidery Neckline Trim (High-Segment Torus)
  const necklineTrim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.086, 0.0085, 16, 48)),
    outfitTrimMat,
  );
  necklineTrim.rotation.x = Math.PI / 2 + 0.18;
  necklineTrim.position.set(0, 0.23, -0.024);
  chestGroup.add(necklineTrim);

  // Vertex-Draped Pleated Kurti Skirt (56x36 = 4,032 triangles)
  const tunicFlarePivot = new THREE.Group();
  tunicFlarePivot.position.set(0, 0.08, 0);
  upperBodyPivot.add(tunicFlarePivot);

  const tunicFlare = new THREE.Mesh(
    trackGeo(createDrapedKurtiSkirtGeometry()),
    outfitKurtiMat,
  );
  tunicFlare.position.set(0, -0.1, 0);
  tunicFlare.castShadow = true;
  tunicFlarePivot.add(tunicFlare);

  const tunicHemTrim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.226, 0.0075, 16, 56)),
    outfitTrimMat,
  );
  tunicHemTrim.rotation.x = Math.PI / 2;
  tunicHemTrim.scale.set(1.03, 0.78, 1);
  tunicHemTrim.position.set(0, -0.29, 0);
  tunicFlarePivot.add(tunicHemTrim);

  // Crossbody Sling Strap & Sculpted Evening Bag
  const slingStrap = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.235, 0.011, 16, 48)),
    bagMat,
  );
  slingStrap.rotation.set(0.2, 0.35, -0.82);
  slingStrap.scale.set(0.75, 1.35, 0.65);
  slingStrap.position.set(0, 0.02, 0);
  chestGroup.add(slingStrap);

  const slingBagPivot = new THREE.Group();
  slingBagPivot.position.set(-0.185, -0.02, 0.04);
  upperBodyPivot.add(slingBagPivot);

  const slingBagMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.036, 0.1, 16, 28)),
    bagMat,
  );
  slingBagMesh.rotation.x = Math.PI / 2;
  slingBagMesh.scale.set(0.9, 1.0, 1.35);
  slingBagMesh.position.set(0, -0.06, 0);
  slingBagMesh.castShadow = true;
  slingBagPivot.add(slingBagMesh);

  const slingBagClasp = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.012, 16, 16)),
    goldAccentMat,
  );
  slingBagClasp.position.set(-0.034, -0.04, 0);
  slingBagPivot.add(slingBagClasp);

  // Soft Cream-Cashmere Stole + High-Segment Flowing Tails
  const scarfWrap = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.122, 0.034, 24, 48)),
    scarfMat,
  );
  scarfWrap.rotation.x = Math.PI / 2 + 0.12;
  scarfWrap.position.set(0, 0.245, 0.012);
  chestGroup.add(scarfWrap);

  const scarfTailPivot = new THREE.Group();
  scarfTailPivot.position.set(0.085, 0.22, 0.11);
  chestGroup.add(scarfTailPivot);

  const scarfTailUpper = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.024, 0.2, 16, 28)),
    scarfMat,
  );
  scarfTailUpper.scale.set(1.6, 1, 0.45);
  scarfTailUpper.position.set(0, -0.11, 0);
  scarfTailUpper.castShadow = true;
  scarfTailPivot.add(scarfTailUpper);

  const scarfTailLowerPivot = new THREE.Group();
  scarfTailLowerPivot.position.set(0, -0.22, 0);
  scarfTailPivot.add(scarfTailLowerPivot);

  const scarfTailLower = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.025, 0.18, 16, 28)),
    scarfMat,
  );
  scarfTailLower.scale.set(1.65, 1, 0.42);
  scarfTailLower.position.set(0, -0.1, 0);
  scarfTailLower.castShadow = true;
  scarfTailLowerPivot.add(scarfTailLower);

  const shoulderMarker = new THREE.Object3D();
  shoulderMarker.position.set(0.24, 0.25, 0.05);
  chestGroup.add(shoulderMarker);

  // ============================================================================
  // 2. NECK, 96x96 HEART-SHAPED V-LINE BEAUTY FACE & LAYERED HAIRSTYLE
  // ============================================================================
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.27, 0);
  chestGroup.add(neckPivot);

  const neckMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.042, 0.05, 0.11, 36, 12)),
    skinMat,
  );
  neckMesh.position.set(0, 0.044, 0);
  neckPivot.add(neckMesh);

  // Delicate Gold Necklace Chain + Teardrop Pendant
  const necklace = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.053, 0.0028, 16, 48)),
    goldAccentMat,
  );
  necklace.rotation.x = Math.PI / 2 + 0.22;
  necklace.position.set(0, 0.015, -0.006);
  neckPivot.add(necklace);

  const necklacePendant = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.0055, 16, 16)),
    goldAccentMat,
  );
  necklacePendant.scale.set(0.85, 1.25, 0.65);
  necklacePendant.position.set(0, 0.002, -0.057);
  neckPivot.add(necklacePendant);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.088, 0);
  neckPivot.add(headPivot);

  // Dual Soft Cinema Beauty Lights attached to Head Rig (Warm Key + Soft Rose Fill)
  const faceBeautyLight = new THREE.PointLight(0xffe4cc, 0.88, 1.55, 1.4);
  faceBeautyLight.position.set(0.06, 0.14, -0.44);
  headPivot.add(faceBeautyLight);

  const faceFillLight = new THREE.PointLight(0xffd1dc, 0.36, 1.2, 1.5);
  faceFillLight.position.set(-0.12, 0.08, -0.35);
  headPivot.add(faceFillLight);

  // 96x96 Vertex-Sculpted Heart-Shaped V-Line Beauty Head (18,432 Triangles + Airbrushed Vertex Blush)
  const headMesh = new THREE.Mesh(
    trackGeo(createSculptedSharpHeadGeometry()),
    headSkinMat,
  );
  headMesh.position.set(0, 0.115, 0);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Delicate Nostril Alar Curves & Sparkling Diamond/Gold Nose Pin (Nath Stud) on Left Nostril
  for (const side of [-1, 1]) {
    const nostrilWing = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0052, 16, 16)),
      skinMat,
    );
    nostrilWing.scale.set(1.05, 0.78, 1.12);
    nostrilWing.position.set(side * 0.0078, 0.097, -0.126);
    headPivot.add(nostrilWing);
  }

  const nosePinGoldBase = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.0022, 14, 14)),
    goldAccentMat,
  );
  nosePinGoldBase.position.set(-0.0112, 0.099, -0.1285);
  headPivot.add(nosePinGoldBase);

  const nosePinDiamond = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.0018, 1)),
    diamondStudMat,
  );
  nosePinDiamond.position.set(-0.012, 0.0995, -0.1298);
  headPivot.add(nosePinDiamond);

  // Sculpted Glossy Rose-Berry Lips with Cupid's Bow & Gentle Warm Smile Corners
  for (const side of [-1, 1]) {
    const cupidArch = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0046, 0.0115, 16, 24)),
      lipMat,
    );
    cupidArch.rotation.z = Math.PI / 2 - side * 0.19;
    cupidArch.rotation.y = side * -0.14;
    cupidArch.scale.set(1.0, 1.0, 0.78);
    cupidArch.position.set(side * 0.0058, 0.0685, -0.1205);
    headPivot.add(cupidArch);

    // Subtle upturned smile corner
    const smileCorner = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0032, 14, 14)),
      lipMat,
    );
    smileCorner.position.set(side * 0.0135, 0.0665, -0.1175);
    headPivot.add(smileCorner);
  }

  const upperLipTubercle = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.0048, 16, 16)),
    lipMat,
  );
  upperLipTubercle.scale.set(1.15, 0.82, 0.85);
  upperLipTubercle.position.set(0, 0.068, -0.1225);
  headPivot.add(upperLipTubercle);

  const lowerLip = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.0058, 0.017, 18, 28)),
    lipMat,
  );
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.scale.set(1.0, 1.0, 0.86);
  lowerLip.position.set(0, 0.0595, -0.12);
  headPivot.add(lowerLip);

  // Traditional Maroon-Gold Forehead Bindi
  const bindiGoldRim = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.0038, 24)),
    goldAccentMat,
  );
  bindiGoldRim.position.set(0, 0.149, -0.1215);
  bindiGoldRim.rotation.y = Math.PI;
  headPivot.add(bindiGoldRim);

  const bindi = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.0029, 24)),
    bindiMat,
  );
  bindi.position.set(0, 0.149, -0.122);
  bindi.rotation.y = Math.PI;
  headPivot.add(bindi);

  // Sculpted Ears & Swaying 2-Tier Golden Jhumka Earrings with Pearl Drops
  const earringPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const earMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.019, 24, 24)),
      skinMat,
    );
    earMesh.scale.set(0.4, 1.15, 0.7);
    earMesh.position.set(side * 0.105, 0.112, -0.004);
    headPivot.add(earMesh);

    const earringStud = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0058, 18, 18)),
      goldAccentMat,
    );
    earringStud.position.set(side * 0.11, 0.092, -0.006);
    headPivot.add(earringStud);

    const jhumkaPivot = new THREE.Group();
    jhumkaPivot.position.set(side * 0.11, 0.09, -0.006);
    headPivot.add(jhumkaPivot);
    earringPivots.push(jhumkaPivot);

    const jhumkaDome = new THREE.Mesh(
      trackGeo(
        new THREE.SphereGeometry(
          0.0105,
          24,
          16,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.58,
        ),
      ),
      goldAccentMat,
    );
    jhumkaDome.position.set(0, -0.011, 0);
    jhumkaPivot.add(jhumkaDome);

    const jhumkaRim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.0102, 0.0018, 12, 24)),
      goldAccentMat,
    );
    jhumkaRim.rotation.x = Math.PI / 2;
    jhumkaRim.position.set(0, -0.013, 0);
    jhumkaPivot.add(jhumkaRim);

    // Delicate dangling pearl beads around the bottom rim of each Jhumka
    for (let p = 0; p < 5; p++) {
      const pAngle = (p / 5) * Math.PI * 2;
      const pearlDrop = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.0024, 12, 12)),
        pearlWhiteMat,
      );
      pearlDrop.position.set(
        Math.cos(pAngle) * 0.0085,
        -0.0175,
        Math.sin(pAngle) * 0.0085,
      );
      jhumkaPivot.add(pearlDrop);
    }
  }

  // Large, Luminous, Expressive Almond Eyes with Radial Hazel-Amber Iris & Feathered Cat-Eye Lashes
  const eyeBallGroups: THREE.Group[] = [];
  const eyelidMeshes: THREE.Mesh[] = [];
  const eyebrowPivots: THREE.Group[] = [];

  for (const side of [-1, 1]) {
    const eyeSocketGroup = new THREE.Group();
    eyeSocketGroup.position.set(side * 0.0365, 0.1245, -0.1135);
    eyeSocketGroup.rotation.y = side * -0.13;
    headPivot.add(eyeSocketGroup);

    // Delicate inner pink tear-duct caruncle
    const tearDuct = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0032, 12, 12)),
      tearDuctMat,
    );
    tearDuct.position.set(-side * 0.0145, -0.001, -0.0085);
    eyeSocketGroup.add(tearDuct);

    const eyeBallGroup = new THREE.Group();
    eyeSocketGroup.add(eyeBallGroup);
    eyeBallGroups.push(eyeBallGroup);

    const sclera = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0158, 32, 32)),
      eyeScleraMat,
    );
    sclera.scale.set(1.16, 0.9, 0.74);
    eyeBallGroup.add(sclera);

    // Curved 3D Iris & Corneal Dome mapped with high-res radial Hazel-Amber texture
    const irisDome = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.0094, 36)),
      eyeIrisMat,
    );
    irisDome.position.set(0, 0, -0.012);
    irisDome.rotation.y = Math.PI;
    eyeBallGroup.add(irisDome);

    // Dual 3D Corneal Sparkle Catchlights (never covered when eyes are open)
    const catchlight1 = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.0027, 16)),
      eyeCatchlightMat,
    );
    catchlight1.position.set(side * 0.0032, 0.003, -0.0126);
    catchlight1.rotation.y = Math.PI;
    eyeBallGroup.add(catchlight1);

    const catchlight2 = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.0014, 14)),
      eyeCatchlightMat,
    );
    catchlight2.position.set(-side * 0.0026, -0.0026, -0.0126);
    catchlight2.rotation.y = Math.PI;
    eyeBallGroup.add(catchlight2);

    // Winged Upper Eyeliner & Lash Arch
    const upperLash = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.0158, 0.0019, 14, 36, Math.PI * 0.92)),
      eyelashMat,
    );
    upperLash.position.set(0, 0.0018, -0.0092);
    upperLash.rotation.z = Math.PI * 0.04;
    upperLash.scale.set(1.15, 0.85, 1);
    eyeSocketGroup.add(upperLash);

    // 5 Feathered Outer Cat-Eye Lash Tips per Eye
    for (let l = 0; l < 5; l++) {
      const lashAngle = 0.25 + l * 0.22;
      const lashTip = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.0009, 0.0058 + l * 0.0007, 8)),
        eyelashMat,
      );
      const lx = side * (0.007 + l * 0.0026);
      const ly = 0.0085 - l * 0.0011;
      lashTip.position.set(lx, ly, -0.0108);
      lashTip.rotation.z = -side * lashAngle;
      lashTip.rotation.x = -0.35;
      eyeSocketGroup.add(lashTip);
    }

    // Subtle Lower Lash Line Accent
    const lowerLash = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.0148, 0.0009, 10, 28, Math.PI * 0.72)),
      eyelashMat,
    );
    lowerLash.position.set(0, -0.0015, -0.0088);
    lowerLash.rotation.z = Math.PI * 1.14;
    lowerLash.scale.set(1.12, 0.76, 1);
    eyeSocketGroup.add(lowerLash);

    // Blinking Upper Eyelid with Shimmer Rose-Bronze Eyeshadow (open at -0.52 so iris is 100% clear)
    const eyelid = new THREE.Mesh(
      trackGeo(
        new THREE.SphereGeometry(
          0.0168,
          28,
          18,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.42,
        ),
      ),
      eyelidMakeupMat,
    );
    eyelid.scale.set(1.16, 0.9, 0.77);
    eyelid.rotation.x = -0.52;
    eyeSocketGroup.add(eyelid);
    eyelidMeshes.push(eyelid);

    // Graceful 3-Segment Tapered Arched Eyebrow
    const browPivot = new THREE.Group();
    browPivot.position.set(side * 0.038, 0.148, -0.117);
    browPivot.rotation.y = side * -0.15;
    headPivot.add(browPivot);
    eyebrowPivots.push(browPivot);

    const browInner = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0031, 0.014, 12, 16)),
      hairMat,
    );
    browInner.rotation.z = Math.PI / 2 - side * 0.16;
    browInner.position.set(-side * 0.007, -0.001, 0);
    browPivot.add(browInner);

    const browArch = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0028, 0.013, 12, 16)),
      hairMat,
    );
    browArch.rotation.z = Math.PI / 2 - side * 0.05;
    browArch.position.set(side * 0.005, 0.0018, 0.001);
    browPivot.add(browArch);

    const browTail = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.0026, 0.014, 12)),
      hairMat,
    );
    browTail.rotation.z = -side * (Math.PI / 2 + 0.28);
    browTail.position.set(side * 0.016, -0.0005, 0.003);
    browPivot.add(browTail);
  }

  // ============================================================================
  // HIGH-POLYGON SILK HAIRSTYLE + JASMINE GAJRA (100% CLEAR OF HER FACE)
  // ============================================================================
  const hairCrownCap = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.129, 48, 48)),
    hairMat,
  );
  hairCrownCap.position.set(0, 0.134, 0.034);
  hairCrownCap.scale.set(0.91, 1.04, 0.86);
  hairCrownCap.castShadow = true;
  headPivot.add(hairCrownCap);

  // Swept High Crown Curtain Waves (framing top of forehead high above eyebrows)
  const hairlineSweepLeft = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.023, 0.095, 18, 28)),
    hairMat,
  );
  hairlineSweepLeft.position.set(-0.046, 0.214, -0.062);
  hairlineSweepLeft.rotation.set(0.22, 0.34, 1.18);
  headPivot.add(hairlineSweepLeft);

  const hairlineSweepRight = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.025, 0.105, 18, 28)),
    hairMat,
  );
  hairlineSweepRight.position.set(0.048, 0.212, -0.06);
  hairlineSweepRight.rotation.set(0.22, -0.34, -1.14);
  headPivot.add(hairlineSweepRight);

  // Golden Side Hair Pin (Barrette) on Right Temple Wave
  const goldHairClip = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.0028, 0.024, 10, 16)),
    goldAccentMat,
  );
  goldHairClip.position.set(0.095, 0.168, -0.036);
  goldHairClip.rotation.set(0.3, -0.4, 0.25);
  headPivot.add(goldHairClip);

  // Fragrant White Jasmine Gajra Buds tucked gracefully behind her right ear & back crown
  const jasmineBudGeo = trackGeo(new THREE.SphereGeometry(0.0068, 14, 14));
  for (let j = 0; j < 9; j++) {
    const t = j / 8;
    const angle = -0.35 + t * Math.PI * 1.15;
    const bud = new THREE.Mesh(jasmineBudGeo, pearlWhiteMat);
    bud.scale.set(0.85, 1.15, 0.85);
    bud.position.set(
      Math.cos(angle) * 0.108,
      0.118 - Math.sin(t * Math.PI) * 0.018,
      0.035 + Math.sin(angle) * 0.092,
    );
    headPivot.add(bud);
  }

  // Side Temple Locks Tucked Behind Ears so Her Cheekbones & Heart-Shaped Jawline Stand Out
  const leftTempleLockPivot = new THREE.Group();
  leftTempleLockPivot.position.set(-0.112, 0.145, 0.01);
  headPivot.add(leftTempleLockPivot);

  const leftTempleLock = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.02, 0.165, 18, 28)),
    hairMat,
  );
  leftTempleLock.position.set(0, -0.08, 0.015);
  leftTempleLock.rotation.z = 0.06;
  leftTempleLockPivot.add(leftTempleLock);

  const rightTempleLockPivot = new THREE.Group();
  rightTempleLockPivot.position.set(0.112, 0.145, 0.01);
  headPivot.add(rightTempleLockPivot);

  const rightTempleLock = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.02, 0.165, 18, 28)),
    hairMat,
  );
  rightTempleLock.position.set(0, -0.08, 0.015);
  rightTempleLock.rotation.z = -0.06;
  rightTempleLockPivot.add(rightTempleLock);

  // Multi-Strand Voluminous Back Hair Cascade (High-Segment Capsules)
  const hairBackUpperPivot = new THREE.Group();
  hairBackUpperPivot.position.set(0, 0.118, 0.095);
  headPivot.add(hairBackUpperPivot);

  const hairBackUpper = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.092, 0.19, 28, 36)),
    hairMat,
  );
  hairBackUpper.position.set(0, -0.09, 0.018);
  hairBackUpper.rotation.x = 0.18;
  hairBackUpper.scale.set(1.2, 1.0, 0.58);
  hairBackUpper.castShadow = true;
  hairBackUpperPivot.add(hairBackUpper);

  for (const strandOffset of [-0.065, -0.022, 0.022, 0.065]) {
    const waveStrand = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.022, 0.21, 16, 28)),
      hairMat,
    );
    waveStrand.position.set(strandOffset, -0.095, 0.055);
    waveStrand.rotation.x = 0.2;
    waveStrand.rotation.z = -strandOffset * 0.6;
    hairBackUpperPivot.add(waveStrand);
  }

  const hairBackLowerPivot = new THREE.Group();
  hairBackLowerPivot.position.set(0, -0.175, 0.034);
  hairBackUpperPivot.add(hairBackLowerPivot);

  const hairBackLower = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.078, 0.18, 28, 36)),
    hairMat,
  );
  hairBackLower.position.set(0, -0.085, 0.012);
  hairBackLower.rotation.x = 0.12;
  hairBackLower.scale.set(1.15, 1.0, 0.52);
  hairBackLower.castShadow = true;
  hairBackLowerPivot.add(hairBackLower);

  // ============================================================================
  // 3. HIGH-POLYGON ARTICULATED ARMS, WRISTS, HANDS & FINGERS
  // ============================================================================
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.2, 0.21, 0);
  chestGroup.add(leftArmPivot);

  const leftUpperArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.042, 0.21, 20, 28)),
    outfitKurtiMat,
  );
  leftUpperArm.position.set(0, -0.115, 0);
  leftUpperArm.castShadow = true;
  leftArmPivot.add(leftUpperArm);

  const leftForearmPivot = new THREE.Group();
  leftForearmPivot.position.set(0, -0.24, 0);
  leftArmPivot.add(leftForearmPivot);

  const leftForearm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.033, 0.18, 20, 28)),
    skinMat,
  );
  leftForearm.position.set(0, -0.1, 0);
  leftForearm.castShadow = true;
  leftForearmPivot.add(leftForearm);

  const leftWristGroup = new THREE.Group();
  leftWristGroup.position.set(0, -0.21, 0);
  leftForearmPivot.add(leftWristGroup);

  const leftPalm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.015, 0.042, 12, 18)),
    skinMat,
  );
  leftPalm.scale.set(0.85, 1, 1.55);
  leftPalm.position.set(0, -0.032, 0);
  leftWristGroup.add(leftPalm);

  const leftFingers = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.012, 0.036, 12, 18)),
    skinMat,
  );
  leftFingers.scale.set(0.8, 1, 1.5);
  leftFingers.position.set(0.006, -0.075, 0);
  leftFingers.rotation.z = 0.18;
  leftWristGroup.add(leftFingers);

  // Right Arm Rig
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.2, 0.21, 0);
  chestGroup.add(rightArmPivot);

  const rightUpperArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.042, 0.21, 20, 28)),
    outfitKurtiMat,
  );
  rightUpperArm.position.set(0, -0.115, 0);
  rightUpperArm.castShadow = true;
  rightArmPivot.add(rightUpperArm);

  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -0.24, 0);
  rightArmPivot.add(rightForearmPivot);

  const rightForearm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.033, 0.18, 20, 28)),
    skinMat,
  );
  rightForearm.position.set(0, -0.1, 0);
  rightForearm.castShadow = true;
  rightForearmPivot.add(rightForearm);

  const wristBangle = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.035, 0.0045, 14, 32)),
    goldAccentMat,
  );
  wristBangle.rotation.x = Math.PI / 2;
  wristBangle.position.set(0, -0.185, 0);
  rightForearmPivot.add(wristBangle);

  const rightWristGroup = new THREE.Group();
  rightWristGroup.position.set(0, -0.21, 0);
  rightForearmPivot.add(rightWristGroup);

  const rightPalm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.015, 0.042, 12, 18)),
    skinMat,
  );
  rightPalm.scale.set(0.85, 1, 1.55);
  rightPalm.position.set(0, -0.032, 0);
  rightWristGroup.add(rightPalm);

  const rightFingerCurlPivot = new THREE.Group();
  rightFingerCurlPivot.position.set(0, -0.062, 0);
  rightWristGroup.add(rightFingerCurlPivot);

  const rightFingers = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.012, 0.036, 12, 18)),
    skinMat,
  );
  rightFingers.scale.set(0.8, 1, 1.5);
  rightFingers.position.set(-0.006, -0.022, 0);
  rightFingerCurlPivot.add(rightFingers);

  const rightThumbPivot = new THREE.Group();
  rightThumbPivot.position.set(-0.014, -0.025, -0.024);
  rightWristGroup.add(rightThumbPivot);

  const rightThumb = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.0075, 0.03, 10, 14)),
    skinMat,
  );
  rightThumb.position.set(-0.01, -0.014, -0.01);
  rightThumb.rotation.set(0.4, 0, 0.5);
  rightThumbPivot.add(rightThumb);

  // 3D Smartphone in Right Hand
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(-0.032, -0.05, 0.035);
  phoneGroup.rotation.set(Math.PI / 3.2, -0.18, 0);
  phoneGroup.visible = false;
  rightWristGroup.add(phoneGroup);

  const phoneChassis = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.082, 0.156, 0.01, 4, 8, 2)),
    phoneBodyMat,
  );
  phoneGroup.add(phoneChassis);

  const phoneScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.074, 0.146)),
    phoneScreenMat,
  );
  phoneScreen.position.set(0, 0, 0.0058);
  phoneGroup.add(phoneScreen);

  const phoneGlowLight = new THREE.PointLight(0x93c5fd, 0, 1.65, 1.5);
  phoneGlowLight.position.set(0, 0.02, 0.095);
  phoneGroup.add(phoneGlowLight);

  // ============================================================================
  // 4. HIGH-POLYGON MULTI-JOINTED LEGS & SCULPTED LEATHER BOOTS
  // ============================================================================
  const createArticulatedLeg = (sideOffset: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(sideOffset, -0.02, 0);
    pelvisGroup.add(hipPivot);

    const thighMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.062, 0.31, 24, 32)),
      jeansMat,
    );
    thighMesh.position.set(0, -0.19, 0);
    thighMesh.castShadow = true;
    hipPivot.add(thighMesh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.38, 0);
    hipPivot.add(kneePivot);

    const calfMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.05, 0.31, 24, 32)),
      jeansMat,
    );
    calfMesh.position.set(0, -0.19, 0);
    calfMesh.castShadow = true;
    kneePivot.add(calfMesh);

    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.39, 0);
    kneePivot.add(anklePivot);

    const bootAnkleShaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.045, 0.05, 0.095, 28, 8)),
      bootMat,
    );
    bootAnkleShaft.position.set(0, 0.01, 0);
    bootAnkleShaft.castShadow = true;
    anklePivot.add(bootAnkleShaft);

    // Sculpted Rounded Toe & Boot Vamp (High-Segment Capsule)
    const bootFoot = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.044, 0.125, 20, 28)),
      bootMat,
    );
    bootFoot.rotation.x = Math.PI / 2;
    bootFoot.scale.set(1.06, 1.0, 0.76);
    bootFoot.position.set(0, -0.042, -0.042);
    bootFoot.castShadow = true;
    anklePivot.add(bootFoot);

    const bootSole = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.046, 0.132, 16, 24)),
      bootSoleMat,
    );
    bootSole.rotation.x = Math.PI / 2;
    bootSole.scale.set(1.08, 1.0, 0.25);
    bootSole.position.set(0, -0.076, -0.042);
    anklePivot.add(bootSole);

    return { hipPivot, kneePivot, anklePivot };
  };

  const leftLeg = createArticulatedLeg(-0.095);
  const rightLeg = createArticulatedLeg(0.095);

  // ============================================================================
  // 5. ANIMATION STATE MACHINE, SECONDARY MOTION & BIOMECHANICS
  // ============================================================================
  let currentState: HarshaAnimState = 'IDLE';
  let walkCyclePhase = 0;
  let lastFootstepSign = 0;

  let curHeadPitch = 0;
  let curHeadYaw = 0;
  let curHeadRoll = 0;
  let curNeckYaw = 0;
  let curTorsoYaw = 0;
  let curTorsoPitch = 0;
  let curTorsoRoll = 0;

  let curRightArmPitch = 0;
  let curRightArmRoll = 0;
  let curRightForearmPitch = 0.16;
  let curRightForearmYaw = 0;
  let curRightWristPitch = 0;
  let curFingerCurl = 0.2;
  let curPhoneGlow = 0;

  let curEyeYaw = 0;
  let curEyePitch = 0;
  let curBrowLift = 0;
  let blinkTimer = 1.8;
  let blinkProgress = 0;
  let isBlinking = false;

  let hairSwingPitch = 0;
  let hairSwingRoll = 0;
  let prevHeadWorldYaw = 0;

  const phoneAnchorWorldPos = new THREE.Vector3();
  const shoulderWorldPos = new THREE.Vector3();
  const headWorldPos = new THREE.Vector3();

  const joints: HarshaJointRig = {
    pelvisGroup,
    upperBodyPivot,
    chestGroup,
    neckPivot,
    headPivot,
    headMesh,
    leftArmPivot,
    leftForearmPivot,
    leftWristGroup,
    rightArmPivot,
    rightForearmPivot,
    rightWristGroup,
    rightFingerCurlPivot,
    leftLeg,
    rightLeg,
    tunicFlarePivot,
    slingBagPivot,
    scarfTailPivot,
    scarfTailLowerPivot,
    hairBackUpperPivot,
    hairBackLowerPivot,
    leftTempleLockPivot,
    rightTempleLockPivot,
    earringPivots,
    eyeBallGroups,
    eyelidMeshes,
    eyebrowPivots,
    contactShadow,
    faceBeautyLight,
    faceFillLight,
  };

  return {
    group,
    joints,
    phoneAnchorWorldPos,
    shoulderWorldPos,
    headWorldPos,
    setAnimationState(next: HarshaAnimState) {
      if (currentState !== next) {
        currentState = next;
        if (
          next === 'PHONE_NOTICE' ||
          next === 'PHONE_READ' ||
          next === 'LOOK_BACK'
        ) {
          isBlinking = true;
          blinkProgress = 0;
        }
      }
    },
    getAnimationState() {
      return currentState;
    },
    update(
      dt,
      elapsed,
      moveSpeedRatio,
      onFootstep,
      aimYawDelta = 0,
      aimPitchDelta = 0,
      turnBankRoll = 0,
    ) {
      const dampRate = 8.5;

      const isJogging = currentState === 'JOG' && moveSpeedRatio > 0.05;
      const isCrouching =
        currentState === 'CROUCH_IDLE' || currentState === 'CROUCH_WALK';
      const isBackingAway = currentState === 'BACK_AWAY';
      const isStruggling = currentState === 'KIDNAP_STRUGGLE';
      const isStriding =
        (moveSpeedRatio > 0.025 &&
          (currentState === 'WALK' ||
            currentState === 'JOG' ||
            currentState === 'CROUCH_WALK' ||
            currentState === 'PHONE_NOTICE')) ||
        isBackingAway ||
        isStruggling;

      if (isStriding) {
        const baseFreq = isJogging
          ? 7.2
          : isCrouching
            ? 4.2
            : isBackingAway
              ? 4.6
              : isStruggling
                ? 8.5
                : 5.35;
        const strideFreq = baseFreq * Math.max(0.32, moveSpeedRatio);
        walkCyclePhase += dt * (isBackingAway ? -strideFreq : strideFreq);

        const sinPhase = Math.sin(walkCyclePhase);
        const currentSign = sinPhase >= 0 ? 1 : -1;
        if (currentSign !== lastFootstepSign && (moveSpeedRatio > 0.1 || isBackingAway)) {
          lastFootstepSign = currentSign;
          onFootstep?.(currentSign > 0, isCrouching ? moveSpeedRatio * 0.45 : moveSpeedRatio);
        }
      } else {
        walkCyclePhase = THREE.MathUtils.damp(
          walkCyclePhase,
          Math.round(walkCyclePhase / Math.PI) * Math.PI,
          6.5,
          dt,
        );
      }

      const strideIntensity = isStriding
        ? Math.min(1.35, Math.max(0.35, moveSpeedRatio))
        : 0;
      const sinP = Math.sin(walkCyclePhase);
      const cosP = Math.cos(walkCyclePhase);

      // Hip Swing (+X forward, -X backward)
      const hipSwingAmp = isJogging ? 0.58 : isCrouching ? 0.34 : isStruggling ? 0.36 : 0.42;
      const crouchHipForward = isCrouching ? 0.48 : isBackingAway ? 0.16 : 0;
      const leftHipTarget = crouchHipForward + sinP * hipSwingAmp * strideIntensity;
      const rightHipTarget = crouchHipForward - sinP * hipSwingAmp * strideIntensity;

      // Knee Flexion (-X bends calf backward)
      const kneeBaseMag = isCrouching ? 0.82 : isJogging ? 0.26 : isBackingAway ? 0.25 : 0.04;
      const kneeDynamicMag = isJogging ? 0.85 : isCrouching ? 0.36 : 0.56;
      const leftKneeBendMag =
        kneeBaseMag +
        strideIntensity *
          (Math.max(0, cosP) * kneeDynamicMag + Math.max(0, -sinP) * 0.2);
      const rightKneeBendMag =
        kneeBaseMag +
        strideIntensity *
          (Math.max(0, -cosP) * kneeDynamicMag + Math.max(0, sinP) * 0.2);

      const ankleCrouchBias = isCrouching ? 0.34 : 0;
      const leftAnkleTarget =
        ankleCrouchBias + strideIntensity * (sinP * 0.2 + (leftKneeBendMag - kneeBaseMag) * 0.35);
      const rightAnkleTarget =
        ankleCrouchBias + strideIntensity * (-sinP * 0.2 + (rightKneeBendMag - kneeBaseMag) * 0.35);

      leftLeg.hipPivot.rotation.x = THREE.MathUtils.damp(
        leftLeg.hipPivot.rotation.x,
        leftHipTarget,
        12,
        dt,
      );
      rightLeg.hipPivot.rotation.x = THREE.MathUtils.damp(
        rightLeg.hipPivot.rotation.x,
        rightHipTarget,
        12,
        dt,
      );

      leftLeg.kneePivot.rotation.x = THREE.MathUtils.damp(
        leftLeg.kneePivot.rotation.x,
        -leftKneeBendMag,
        13,
        dt,
      );
      rightLeg.kneePivot.rotation.x = THREE.MathUtils.damp(
        rightLeg.kneePivot.rotation.x,
        -rightKneeBendMag,
        13,
        dt,
      );

      leftLeg.anklePivot.rotation.x = THREE.MathUtils.damp(
        leftLeg.anklePivot.rotation.x,
        leftAnkleTarget,
        13,
        dt,
      );
      rightLeg.anklePivot.rotation.x = THREE.MathUtils.damp(
        rightLeg.anklePivot.rotation.x,
        rightAnkleTarget,
        13,
        dt,
      );

      // Pelvis 3D Cadence
      const basePelvisY = isCrouching ? 0.64 : isBackingAway ? 0.84 : isStruggling ? 0.85 : 0.89;
      const bobAmp = isJogging ? 0.048 : isCrouching ? 0.018 : 0.03;
      const verticalBob = isStriding
        ? Math.abs(cosP) * bobAmp * strideIntensity
        : Math.sin(elapsed * 1.85) * 0.005;
      const lateralHipSway = isStriding ? cosP * 0.022 * strideIntensity : 0;
      const pelvisRoll = isStriding ? cosP * 0.038 * strideIntensity : 0;
      const pelvisYaw = isStriding ? -sinP * (isJogging ? 0.08 : 0.05) * strideIntensity : 0;

      pelvisGroup.position.y = THREE.MathUtils.damp(
        pelvisGroup.position.y,
        basePelvisY + verticalBob,
        11,
        dt,
      );
      pelvisGroup.position.x = THREE.MathUtils.damp(
        pelvisGroup.position.x,
        lateralHipSway,
        10,
        dt,
      );
      pelvisGroup.rotation.z = THREE.MathUtils.damp(
        pelvisGroup.rotation.z,
        pelvisRoll + turnBankRoll * 0.4,
        10,
        dt,
      );
      pelvisGroup.rotation.y = THREE.MathUtils.damp(
        pelvisGroup.rotation.y,
        pelvisYaw,
        10,
        dt,
      );

      const breathFreq = isJogging || isBackingAway || isStruggling ? 4.2 : 2.1;
      const breathPhase = Math.sin(elapsed * breathFreq);
      chestGroup.scale.set(
        1 + breathPhase * 0.01,
        1 + breathPhase * 0.012,
        1 + breathPhase * 0.016,
      );

      // Left Arm & Elbow Counter-Swing (+X = forward!)
      const leftArmSwing = -sinP * hipSwingAmp * strideIntensity;
      let targetLeftArmPitch = isStriding
        ? leftArmSwing * (isJogging ? 0.85 : 0.68)
        : Math.sin(elapsed * 1.35) * 0.02;
      let targetLeftArmRoll = isJogging ? -0.08 : -0.045;
      let targetLeftElbowBend = isJogging
        ? 0.88 + Math.max(0, leftArmSwing) * 0.42
        : isCrouching
          ? 0.55
          : isStriding
            ? 0.24 + Math.max(0, leftArmSwing) * 0.38
            : 0.15;

      if (isBackingAway) {
        targetLeftArmPitch = 0.58 + Math.sin(elapsed * 5.0) * 0.06;
        targetLeftArmRoll = -0.16;
        targetLeftElbowBend = 1.15;
      } else if (isStruggling) {
        targetLeftArmPitch = 0.92 + Math.sin(elapsed * 9.5) * 0.16;
        targetLeftArmRoll = 0.14;
        targetLeftElbowBend = 1.32 + Math.cos(elapsed * 8.0) * 0.12;
      }

      leftArmPivot.rotation.x = THREE.MathUtils.damp(
        leftArmPivot.rotation.x,
        targetLeftArmPitch,
        10,
        dt,
      );
      leftArmPivot.rotation.z = THREE.MathUtils.damp(
        leftArmPivot.rotation.z,
        targetLeftArmRoll,
        9,
        dt,
      );
      leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        leftForearmPivot.rotation.x,
        targetLeftElbowBend,
        10,
        dt,
      );

      // Target Upper Body, Head & Right Arm Poses
      const clampedAimYaw = THREE.MathUtils.clamp(aimYawDelta, -0.55, 0.55);
      const clampedAimPitch = THREE.MathUtils.clamp(aimPitchDelta, -0.32, 0.32);

      let targetHeadPitch = clampedAimPitch * 0.45;
      let targetHeadYaw = clampedAimYaw * 0.48;
      let targetHeadRoll = -turnBankRoll * 0.25;
      let targetNeckYaw = clampedAimYaw * 0.25;

      let targetTorsoYaw =
        (isStriding ? sinP * (isJogging ? 0.1 : 0.065) * strideIntensity : 0) +
        clampedAimYaw * 0.18;
      let targetTorsoPitch = isJogging
        ? -0.12 * strideIntensity
        : isCrouching
          ? -0.24
          : isStriding
            ? -0.038 * strideIntensity
            : 0;
      let targetTorsoRoll =
        (isStriding ? -cosP * 0.025 * strideIntensity : 0) + turnBankRoll;

      const rightArmSwing = sinP * hipSwingAmp * strideIntensity;
      let targetRightArmPitch = isStriding
        ? rightArmSwing * (isJogging ? 0.85 : 0.68)
        : 0;
      let targetRightArmRoll = isJogging ? 0.08 : 0.045;
      let targetRightForearmPitch = isJogging
        ? 0.88 + Math.max(0, rightArmSwing) * 0.42
        : isCrouching
          ? 0.55
          : isStriding
            ? 0.24 + Math.max(0, rightArmSwing) * 0.38
            : 0.15;
      let targetRightForearmYaw = 0;
      let targetRightWristPitch = 0;
      let targetFingerCurl = isJogging ? 0.55 : 0.25;
      let targetPhoneGlow = 0;
      let showPhoneMesh = false;

      let targetEyeYaw = clampedAimYaw * 0.3;
      let targetEyePitch = clampedAimPitch * 0.3;
      let targetBrowLift = 0;

      switch (currentState) {
        case 'IDLE':
        case 'STOP': {
          targetHeadPitch += Math.sin(elapsed * 1.15) * 0.022;
          targetHeadYaw += Math.cos(elapsed * 0.75) * 0.035;
          targetHeadRoll += Math.sin(elapsed * 0.9) * 0.015;
          targetEyeYaw += Math.cos(elapsed * 0.75) * 0.04;
          break;
        }
        case 'WALK': {
          targetHeadPitch += 0.018 + Math.sin(walkCyclePhase * 2) * 0.012;
          targetHeadYaw += -sinP * 0.025 * strideIntensity;
          break;
        }
        case 'JOG': {
          targetHeadPitch += 0.09 + Math.sin(walkCyclePhase * 2) * 0.02;
          targetHeadYaw += -sinP * 0.035 * strideIntensity;
          targetBrowLift = -0.002;
          break;
        }
        case 'CROUCH_IDLE':
        case 'CROUCH_WALK': {
          targetHeadPitch += 0.2;
          targetBrowLift = 0.003;
          break;
        }
        case 'PHONE_NOTICE': {
          targetHeadPitch = -0.24;
          targetHeadYaw = -0.18;
          targetHeadRoll = 0.04;
          targetNeckYaw = -0.08;
          targetRightArmPitch = 0.18;
          targetRightArmRoll = 0.08;
          targetRightForearmPitch = 0.52;
          targetEyePitch = -0.18;
          targetEyeYaw = -0.12;
          targetBrowLift = 0.005;
          break;
        }
        case 'PHONE_TAKE_OUT': {
          targetHeadPitch = -0.28;
          targetHeadYaw = -0.12;
          targetHeadRoll = 0.04;
          targetNeckYaw = -0.06;
          targetRightArmPitch = 0.52;
          targetRightArmRoll = -0.12;
          targetRightForearmPitch = 1.12;
          targetRightForearmYaw = -0.28;
          targetRightWristPitch = 0.12;
          targetFingerCurl = 0.65;
          targetPhoneGlow = 0.65;
          targetEyePitch = -0.22;
          targetEyeYaw = -0.08;
          showPhoneMesh = true;
          break;
        }
        case 'PHONE_READ': {
          const readMicroScan = Math.sin(elapsed * 2.8) * 0.025;
          targetHeadPitch = -0.32;
          targetHeadYaw = -0.08 + readMicroScan * 0.4;
          targetHeadRoll = 0.04;
          targetTorsoPitch = -0.04;
          targetRightArmPitch = 0.64;
          targetRightArmRoll = -0.15;
          targetRightForearmPitch = 1.22;
          targetRightForearmYaw = -0.32;
          targetRightWristPitch = 0.15;
          targetFingerCurl = 0.72;
          targetPhoneGlow = 1.45;
          targetEyePitch = -0.25;
          targetEyeYaw = readMicroScan;
          targetBrowLift = -0.003;
          showPhoneMesh = true;
          break;
        }
        case 'PHONE_PUT_AWAY': {
          targetHeadPitch = -0.12;
          targetHeadYaw = -0.05;
          targetRightArmPitch = 0.16;
          targetRightForearmPitch = 0.45;
          targetFingerCurl = 0.4;
          targetPhoneGlow = 0.15;
          showPhoneMesh = true;
          break;
        }
        case 'LOOK_BACK': {
          targetTorsoYaw = 0.36;
          targetTorsoRoll = -0.03;
          targetNeckYaw = 0.24;
          targetHeadYaw = 0.52;
          targetHeadPitch = -0.03;
          targetHeadRoll = -0.04;
          targetEyeYaw = 0.22;
          targetBrowLift = 0.006;
          targetRightArmPitch = 0.12;
          targetRightForearmPitch = 0.32;
          break;
        }
        case 'BACK_AWAY': {
          targetTorsoPitch = 0.08;
          targetTorsoYaw = 0.25;
          targetNeckYaw = 0.18;
          targetHeadYaw = 0.38 + Math.sin(elapsed * 4.5) * 0.05;
          targetHeadPitch = -0.06;
          targetRightArmPitch = 0.58;
          targetRightArmRoll = 0.16;
          targetRightForearmPitch = 1.15;
          targetBrowLift = 0.008;
          break;
        }
        case 'KIDNAP_STRUGGLE': {
          const struggleOsc = Math.sin(elapsed * 10.5);
          const struggleCos = Math.cos(elapsed * 8.2);
          targetTorsoPitch = 0.14 + struggleOsc * 0.06;
          targetTorsoYaw = struggleCos * 0.18;
          targetTorsoRoll = struggleOsc * 0.08;
          targetHeadYaw = struggleCos * 0.32;
          targetHeadPitch = 0.12 + struggleOsc * 0.1;
          targetRightArmPitch = 0.92 + struggleOsc * 0.16;
          targetRightArmRoll = -0.14;
          targetRightForearmPitch = 1.32;
          targetBrowLift = 0.009;
          break;
        }
      }

      // Smooth Joint Blending
      curHeadPitch = THREE.MathUtils.damp(curHeadPitch, targetHeadPitch, dampRate, dt);
      curHeadYaw = THREE.MathUtils.damp(curHeadYaw, targetHeadYaw, dampRate, dt);
      curHeadRoll = THREE.MathUtils.damp(curHeadRoll, targetHeadRoll, dampRate, dt);
      curNeckYaw = THREE.MathUtils.damp(curNeckYaw, targetNeckYaw, dampRate, dt);

      curTorsoYaw = THREE.MathUtils.damp(curTorsoYaw, targetTorsoYaw, dampRate * 0.85, dt);
      curTorsoPitch = THREE.MathUtils.damp(curTorsoPitch, targetTorsoPitch, dampRate, dt);
      curTorsoRoll = THREE.MathUtils.damp(curTorsoRoll, targetTorsoRoll, dampRate, dt);

      curRightArmPitch = THREE.MathUtils.damp(curRightArmPitch, targetRightArmPitch, dampRate, dt);
      curRightArmRoll = THREE.MathUtils.damp(curRightArmRoll, targetRightArmRoll, dampRate, dt);
      curRightForearmPitch = THREE.MathUtils.damp(
        curRightForearmPitch,
        targetRightForearmPitch,
        dampRate,
        dt,
      );
      curRightForearmYaw = THREE.MathUtils.damp(
        curRightForearmYaw,
        targetRightForearmYaw,
        dampRate,
        dt,
      );
      curRightWristPitch = THREE.MathUtils.damp(
        curRightWristPitch,
        targetRightWristPitch,
        dampRate,
        dt,
      );
      curFingerCurl = THREE.MathUtils.damp(curFingerCurl, targetFingerCurl, dampRate, dt);
      curPhoneGlow = THREE.MathUtils.damp(curPhoneGlow, targetPhoneGlow, 6.5, dt);

      curEyeYaw = THREE.MathUtils.damp(curEyeYaw, targetEyeYaw, 12, dt);
      curEyePitch = THREE.MathUtils.damp(curEyePitch, targetEyePitch, 12, dt);
      curBrowLift = THREE.MathUtils.damp(curBrowLift, targetBrowLift, 9, dt);

      upperBodyPivot.rotation.set(curTorsoPitch, curTorsoYaw, curTorsoRoll);
      neckPivot.rotation.y = curNeckYaw;
      headPivot.rotation.set(curHeadPitch, curHeadYaw, curHeadRoll);

      rightArmPivot.rotation.x = curRightArmPitch;
      rightArmPivot.rotation.z = curRightArmRoll;
      rightForearmPivot.rotation.x = curRightForearmPitch;
      rightForearmPivot.rotation.y = curRightForearmYaw;
      rightWristGroup.rotation.x = curRightWristPitch;
      rightFingerCurlPivot.rotation.z = -curFingerCurl;

      const thumbScroll =
        currentState === 'PHONE_READ' ? Math.sin(elapsed * 4.2) * 0.12 : 0;
      rightThumbPivot.rotation.x = thumbScroll;

      blinkTimer -= dt;
      if (blinkTimer <= 0 && !isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
        blinkTimer = 2.6 + (Math.sin(elapsed * 7.3) * 0.5 + 0.5) * 2.4;
      }

      let eyelidCloseRatio = 0;
      if (isBlinking) {
        blinkProgress += dt * 7.5;
        if (blinkProgress >= Math.PI) {
          isBlinking = false;
          eyelidCloseRatio = 0;
        } else {
          eyelidCloseRatio = Math.sin(blinkProgress);
        }
      }

      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        eyeBallGroups[i].rotation.set(curEyePitch, curEyeYaw, 0);
        eyelidMeshes[i].rotation.x = -0.52 + eyelidCloseRatio * 0.92;
        eyebrowPivots[i].position.y = 0.148 + curBrowLift;
        eyebrowPivots[i].rotation.z = side * curBrowLift * 6.0;
      }

      // Secondary Physics Follow-Through
      const totalHeadYaw = curTorsoYaw + curNeckYaw + curHeadYaw;
      const headYawVel = (totalHeadYaw - prevHeadWorldYaw) / Math.max(0.001, dt);
      prevHeadWorldYaw = totalHeadYaw;

      const breezeWave = Math.sin(elapsed * 2.2) * 0.035 + Math.cos(elapsed * 3.7) * 0.015;
      const targetHairPitch =
        0.08 +
        strideIntensity * 0.12 +
        Math.abs(cosP) * 0.06 * strideIntensity +
        breezeWave;
      const targetHairRoll =
        THREE.MathUtils.clamp(-headYawVel * 0.045, -0.22, 0.22) +
        sinP * 0.04 * strideIntensity +
        breezeWave * 0.5;

      hairSwingPitch = THREE.MathUtils.damp(hairSwingPitch, targetHairPitch, 6.0, dt);
      hairSwingRoll = THREE.MathUtils.damp(hairSwingRoll, targetHairRoll, 5.5, dt);

      hairBackUpperPivot.rotation.x = hairSwingPitch;
      hairBackUpperPivot.rotation.z = hairSwingRoll;
      hairBackLowerPivot.rotation.x =
        hairSwingPitch * 0.85 + Math.sin(elapsed * 3.2 - 0.6) * 0.04;
      hairBackLowerPivot.rotation.z = hairSwingRoll * 1.25;

      leftTempleLockPivot.rotation.x = -curHeadPitch * 0.25 + breezeWave * 0.4;
      leftTempleLockPivot.rotation.z = 0.05 + hairSwingRoll * 0.5;
      rightTempleLockPivot.rotation.x = -curHeadPitch * 0.25 + breezeWave * 0.4;
      rightTempleLockPivot.rotation.z = -0.05 + hairSwingRoll * 0.5;

      for (const ep of earringPivots) {
        ep.rotation.z = hairSwingRoll * 1.4 + Math.sin(walkCyclePhase * 2) * 0.08 * strideIntensity;
        ep.rotation.x = -curHeadPitch * 0.5;
      }

      scarfTailPivot.rotation.x =
        -0.12 - strideIntensity * 0.1 - Math.abs(sinP) * 0.06 * strideIntensity - breezeWave;
      scarfTailPivot.rotation.z = hairSwingRoll * 0.8 + breezeWave * 0.8;
      scarfTailLowerPivot.rotation.x =
        -0.08 + Math.sin(elapsed * 2.9 - 0.8) * 0.06 - strideIntensity * 0.08;

      tunicFlarePivot.rotation.x =
        strideIntensity * 0.05 + Math.sin(walkCyclePhase * 2) * 0.02 * strideIntensity;
      tunicFlarePivot.rotation.z = -pelvisRoll * 0.6 + breezeWave * 0.3;

      slingBagPivot.position.y = -0.02 + Math.abs(sinP) * 0.015 * strideIntensity;
      slingBagPivot.rotation.z = -0.04 - Math.abs(cosP) * 0.05 * strideIntensity;

      phoneGroup.visible = showPhoneMesh || curPhoneGlow > 0.04;
      phoneGlowLight.intensity = curPhoneGlow;
      phoneScreenMat.emissiveIntensity = curPhoneGlow * 0.96;

      group.updateMatrixWorld(true);
      phoneGroup.getWorldPosition(_tempPhoneWorld);
      phoneAnchorWorldPos.copy(_tempPhoneWorld);

      shoulderMarker.getWorldPosition(_tempShoulderWorld);
      shoulderWorldPos.copy(_tempShoulderWorld);

      headMesh.getWorldPosition(_tempHeadWorld);
      headWorldPos.copy(_tempHeadWorld);
    },
    dispose() {
      phoneTex.dispose();
      irisTex.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
