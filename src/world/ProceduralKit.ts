import * as THREE from 'three';

/**
 * Reusable resource lifecycle tracker for geometries, materials, and textures.
 * Ensures zero memory leaks across hot reloads or future zone transitions.
 */
export class ResourceTracker {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();

  trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.add(geo);
    return geo;
  }

  trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.add(mat);
    return mat;
  }

  trackTex<T extends THREE.Texture>(tex: T): T {
    this.textures.add(tex);
    return tex;
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}

export interface ThemeParkMaterials {
  creamStone: THREE.MeshStandardMaterial;
  warmSandstone: THREE.MeshStandardMaterial;
  roseGranite: THREE.MeshStandardMaterial;
  darkBasalt: THREE.MeshStandardMaterial;
  brushedGold: THREE.MeshPhysicalMaterial;
  softRoseGold: THREE.MeshPhysicalMaterial;
  wroughtBronze: THREE.MeshStandardMaterial;
  warmTimber: THREE.MeshStandardMaterial;
  darkWalnut: THREE.MeshStandardMaterial;
  royalSlateRoof: THREE.MeshStandardMaterial;
  patinaTealRoof: THREE.MeshStandardMaterial;
  blushPastel: THREE.MeshPhysicalMaterial;
  lavenderPastel: THREE.MeshPhysicalMaterial;
  mintPastel: THREE.MeshPhysicalMaterial;
  crimsonVelvet: THREE.MeshStandardMaterial;
  ivoryCanvas: THREE.MeshStandardMaterial;
  warmLanternGlow: THREE.MeshStandardMaterial;
  softRoseGlow: THREE.MeshStandardMaterial;
  magicVioletGlow: THREE.MeshStandardMaterial;
  auroraCyanGlow: THREE.MeshStandardMaterial;
  fountainWater: THREE.MeshPhysicalMaterial;
  crystalHeart: THREE.MeshPhysicalMaterial;
}

/**
 * Generates a tileable procedural limestone/travertine micro-relief bump texture
 * so architectural stonework (Clock Tower, archways, curbs, balustrades) has
 * warm tactile grain rather than looking like smooth plastic.
 */
function createStoneMicroBumpTexture(tracker: ResourceTracker): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Subtle ashlar stone block joints
  ctx.strokeStyle = 'rgba(45, 40, 35, 0.38)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();

    const offset = (row % 2) * 32;
    for (let col = 0; col < 4; col++) {
      const x = (col * 64 + offset) % size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 32);
      ctx.stroke();
    }
  }

  // Fine travertine pores and mineral grain
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 2400; i++) {
    const x = nextRand() * size;
    const y = nextRand() * size;
    const r = 0.6 + nextRand() * 1.8;
    const shade = nextRand() > 0.5 ? 168 : 92;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.22)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a cohesive, calibrated PBR material palette shared across Central Plaza
 * and future theme-park zones. Roughness values are carefully balanced to avoid
 * plastic over-gloss while preserving crisp metallic and stone highlights.
 */
export function createThemeParkMaterials(
  tracker: ResourceTracker,
): ThemeParkMaterials {
  const stoneBump = createStoneMicroBumpTexture(tracker);

  return {
    // STONE: roughness 0.4–0.65, low metalness, subtle surface variation
    creamStone: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f2e8d9'),
        roughness: 0.54,
        metalness: 0.02,
        bumpMap: stoneBump,
        bumpScale: 0.03,
      }),
    ),
    warmSandstone: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2cfb2'),
        roughness: 0.62,
        metalness: 0.02,
        bumpMap: stoneBump,
        bumpScale: 0.04,
      }),
    ),
    roseGranite: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d6a7a4'),
        roughness: 0.48,
        metalness: 0.04,
        bumpMap: stoneBump,
        bumpScale: 0.028,
      }),
    ),
    darkBasalt: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#474554'),
        roughness: 0.58,
        metalness: 0.05,
        bumpMap: stoneBump,
        bumpScale: 0.035,
      }),
    ),
    // POLISHED DECORATIVE METAL / GOLD: roughness 0.25–0.34, metallic but NOT mirror-like, restrained clearcoat
    brushedGold: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e5b564'),
        roughness: 0.3,
        metalness: 0.78,
        clearcoat: 0.12,
        clearcoatRoughness: 0.35,
      }),
    ),
    softRoseGold: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e3929b'),
        roughness: 0.32,
        metalness: 0.72,
        clearcoat: 0.12,
        clearcoatRoughness: 0.35,
      }),
    ),
    // ORDINARY METAL: roughness 0.4–0.6, moderate metalness
    wroughtBronze: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2d2522'),
        roughness: 0.48,
        metalness: 0.58,
      }),
    ),
    // PAINTED / STAINED WOOD: roughness 0.45–0.7, very low metalness
    warmTimber: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8c583a'),
        roughness: 0.56,
        metalness: 0.02,
      }),
    ),
    darkWalnut: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#523322'),
        roughness: 0.64,
        metalness: 0.02,
      }),
    ),
    // ARCHITECTURAL METAL / SLATE ROOFS: roughness 0.45–0.54, moderate metalness
    royalSlateRoof: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2c496e'),
        roughness: 0.52,
        metalness: 0.22,
      }),
    ),
    patinaTealRoof: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2e7775'),
        roughness: 0.46,
        metalness: 0.24,
      }),
    ),
    // CERAMIC / ARCHITECTURAL PASTELS: roughness 0.28–0.42, subtle glaze without plastic clearcoat
    blushPastel: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f5c6d1'),
        roughness: 0.34,
        metalness: 0.03,
        clearcoat: 0.14,
        clearcoatRoughness: 0.36,
      }),
    ),
    lavenderPastel: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#d4b0f2'),
        roughness: 0.38,
        metalness: 0.03,
        clearcoat: 0.12,
        clearcoatRoughness: 0.38,
      }),
    ),
    mintPastel: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#a4ebd0'),
        roughness: 0.36,
        metalness: 0.03,
        clearcoat: 0.12,
        clearcoatRoughness: 0.38,
      }),
    ),
    crimsonVelvet: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c23b57'),
        emissive: new THREE.Color('#3b0a18'),
        emissiveIntensity: 0.06,
        roughness: 0.64,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    ),
    ivoryCanvas: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#faf3e6'),
        roughness: 0.62,
        metalness: 0.01,
        side: THREE.DoubleSide,
      }),
    ),
    // RESTRAINED EMISSIVES: subtle warm glow, never neon
    warmLanternGlow: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff2d6'),
        emissive: new THREE.Color('#f0a848'),
        emissiveIntensity: 0.38,
        roughness: 0.32,
      }),
    ),
    softRoseGlow: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffd6e4'),
        emissive: new THREE.Color('#e85280'),
        emissiveIntensity: 0.45,
        roughness: 0.28,
      }),
    ),
    magicVioletGlow: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e9d5ff'),
        emissive: new THREE.Color('#8b32d9'),
        emissiveIntensity: 0.48,
        roughness: 0.28,
      }),
    ),
    auroraCyanGlow: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#cffafe'),
        emissive: new THREE.Color('#0891b2'),
        emissiveIntensity: 0.48,
        roughness: 0.26,
      }),
    ),
    // WATER: reflective with controlled highlight (no blown-out mirror sun spot)
    fountainWater: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#36bccb'),
        emissive: new THREE.Color('#105a69'),
        emissiveIntensity: 0.22,
        roughness: 0.22,
        metalness: 0.06,
        clearcoat: 0.45,
        clearcoatRoughness: 0.28,
      }),
    ),
    crystalHeart: tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ff85b3'),
        emissive: new THREE.Color('#ff3877'),
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.08,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
      }),
    ),
  };
}

/**
 * Builds a low-segment beveled rectangular block (`THREE.Shape` + `THREE.ExtrudeGeometry`)
 * centered in X and Z, with bottom at Y = 0, avoiding razor-sharp primitive box edges on
 * architectural plinths, lintels, benches, and sign frames while maintaining fast performance.
 */
export function createBeveledBoxGeometry(
  width: number,
  height: number,
  depth: number,
  bevel = 0.035,
): THREE.BufferGeometry {
  const w = Math.max(0.02, width - bevel * 2);
  const d = Math.max(0.02, depth - bevel * 2);
  const hw = w * 0.5;
  const hd = d * 0.5;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, height - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a 2D `THREE.Shape` in the silhouette of a classic romantic heart.
 */
export function createHeartShape2D(scale = 1.0): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3) * 0.06 * scale;
    const y =
      (13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a)) *
      0.06 *
      scale;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/**
 * Builds an extruded curved garden parterre bed (`THREE.Shape` + `THREE.ExtrudeGeometry`)
 * occupying an angular sector `[startAngle, endAngle]` between `innerRadius` and `outerRadius`.
 * The resulting geometry sits horizontally on the XZ plane with bottom at Y = 0.
 */
export function createCurvedParterreGeometry(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  height: number,
  bevelSize = 0.08,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const arcSegments = 24;

  // Start at inner arc
  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const ang = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const x = Math.sin(ang) * innerRadius;
    const y = Math.cos(ang) * innerRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  // Outer arc with subtle scalloped wave
  for (let i = arcSegments; i >= 0; i--) {
    const t = i / arcSegments;
    const ang = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const scallop = Math.sin(t * Math.PI * 3) * 0.35;
    const r = outerRadius + scallop;
    const x = Math.sin(ang) * r;
    const y = Math.cos(ang) * r;
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 24,
  });

  // Rotate from XY extrusion plane onto XZ ground plane (extruding upward along +Y)
  geo.rotateX(-Math.PI / 2);
  // Because rotateX(-PI/2) maps (x, y, z) -> (x, z, -y), mirror Z so (sin(ang), cos(ang)) maps to (+X, +Z)
  geo.scale(1, 1, -1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an extruded scalloped quatrefoil / 8-lobed ornamental fountain rim
 * using `THREE.Shape` and `THREE.ExtrudeGeometry`.
 */
export function createOrnamentalBasinRimGeometry(
  innerRadius: number,
  outerRadius: number,
  height: number,
  lobes = 12,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = 96;

  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wave = Math.cos(a * lobes) * 0.22;
    const r = outerRadius + wave;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const hole = new THREE.Path();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wave = Math.cos(a * lobes) * 0.14;
    const r = innerRadius + wave;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  geo.scale(1, 1, -1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a graceful extruded Gothic/Romantic pointed archway span (`THREE.Shape` + `THREE.ExtrudeGeometry`)
 * centered on X = 0, sitting on Y = 0, with total width `totalWidth`, total height `totalHeight`,
 * and central arch opening `openingWidth` × `openingHeight`.
 */
export function createExtrudedArchwayGeometry(
  totalWidth: number,
  totalHeight: number,
  openingWidth: number,
  openingHeight: number,
  depth: number,
): THREE.BufferGeometry {
  const hw = totalWidth / 2;
  const ow = openingWidth / 2;
  const springY = openingHeight * 0.65;

  const shape = new THREE.Shape();
  // Left pier base up to top-left corner, across top, down to right pier base
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, totalHeight);
  shape.lineTo(hw, totalHeight);
  shape.lineTo(hw, 0);
  shape.lineTo(ow, 0);
  shape.lineTo(ow, springY);

  // Pointed romantic arch curve from right spring to apex to left spring
  shape.quadraticCurveTo(ow * 0.85, openingHeight * 0.94, 0, openingHeight);
  shape.quadraticCurveTo(-ow * 0.85, openingHeight * 0.94, -ow, springY);
  shape.lineTo(-ow, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 3,
    curveSegments: 20,
  });
  // Center along Z depth
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an extruded curved boulevard ribbon carpet with raised stone curbs
 * using `THREE.Shape` and `THREE.ExtrudeGeometry` along a radial direction.
 */
export function createExtrudedAvenueSlabGeometry(
  width: number,
  length: number,
  thickness = 0.08,
): THREE.BufferGeometry {
  const hw = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, length);
  shape.lineTo(-hw, length);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.scale(1, 1, -1);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the main circular Central Plaza paved stone deck using `THREE.Shape`
 * and `THREE.ExtrudeGeometry` with a subtle 24-scallop ornamental promenade border.
 */
export function createExtrudedPlazaBaseGeometry(
  radius: number,
  thickness = 0.06,
  scallops = 24,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = 144;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wave = Math.cos(a * scallops) * 0.18;
    const r = radius + wave;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 36,
  });

  // Normalize planar UVs to [0, 1] across the plaza disc so the high-res radial stone texture maps cleanly
  geo.rotateX(-Math.PI / 2);
  geo.scale(1, 1, -1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const maxR = radius + 0.25;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    uv.setXY(i, px / (maxR * 2) + 0.5, pz / (maxR * 2) + 0.5);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a heart-shaped inner fountain basin rim using `THREE.Shape` (outer heart contour)
 * and `THREE.Path` (inner heart hole) with `THREE.ExtrudeGeometry`, matching the
 * Master Park Map reference where a glowing pink-and-gold heart basin sits inside the circular pool.
 */
export function createHeartBasinRimGeometry(
  outerScale: number,
  innerScale: number,
  height: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3) * 0.06 * outerScale;
    const y =
      (13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a)) *
      0.06 *
      outerScale;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const hole = new THREE.Path();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3) * 0.06 * innerScale;
    const y =
      (13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a)) *
      0.06 *
      innerScale;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  geo.scale(1, 1, -1);
  geo.computeVertexNormals();
  return geo;
}

