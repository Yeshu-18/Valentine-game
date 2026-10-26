import * as THREE from 'three';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  ANCIENT_FOREST_LOCAL_POINTS,
  FOREST_LAKE_LOCAL_POS,
  FOREST_SEED,
  GIANT_ANCIENT_TREE_LOCAL_POS,
  castleLocalToWorld,
  evaluateAncientForestLocalProximity,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';

export type HeroTreeArchetype =
  | 'leaning_hollow_oak'
  | 'buttress_root_patriarch'
  | 'forked_canopy_elder'
  | 'twisted_moss_sentinel';

export interface HeroTreeSpec {
  id: string;
  archetype: HeroTreeArchetype;
  localX: number;
  localZ: number;
  targetHeight: number;
  trunkRadius: number;
  leanX: number;
  leanZ: number;
  rotationY: number;
  hasHollow: boolean;
}

export interface ForestTreeSystemBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  heroTreeCount: number;
  midgroundTreeCount: number;
  backgroundTreeCount: number;
  giantTreeCount: number;
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Generates a tileable procedural furrowed bark bump texture so ancient trunks
 * have organic vertical ridges, knots, and believable roughness with zero plastic sheen.
 */
function createAncientBarkBumpTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#787878';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(FOREST_SEED + 1205);
  // Vertical bark furrows and crevices
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 1.5 + rand() * 3.5;
    const h = 18 + rand() * 48;
    const shade = rand() > 0.45 ? 42 : 188;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.32)`;
    ctx.fillRect(x, y, w, h);
    if (y + h > size) {
      ctx.fillRect(x, y - size, w, h);
    }
  }

  // Subtle bark knots
  for (let k = 0; k < 28; k++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const rx = 4 + rand() * 6;
    const ry = 6 + rand() * 10;
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, (rand() - 0.5) * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tileable procedural leaf-grain bump texture for forest canopies.
 */
function createForestLeafBumpTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(FOREST_SEED + 1209);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 1.4 + rand() * 3.0;
    const ry = 0.8 + rand() * 1.8;
    const ang = rand() * Math.PI;
    const v = rand() > 0.48 ? 195 : 60;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.26)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, ang, 0, Math.PI * 2);
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
 * Perturbs an IcosahedronGeometry organically for asymmetric ancient tree foliage clusters,
 * moss cushions, and root burls.
 */
function createPerturbedClusterGeo(
  rx: number,
  ry: number,
  rz: number,
  detail: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  const freq = 2.8 + (seed % 5) * 0.42;
  const phase = seed * 1.37;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.6 + phase) *
        Math.cos(vz * freq - vx * 1.9 - phase) *
        irregularity +
      Math.sin((vx + vz) * freq * 1.65 + phase) * (irregularity * 0.42);
    pos.setXYZ(
      i,
      (vx + (vx / len) * wave) * rx,
      (vy + (vy / len) * wave * 0.82) * ry,
      (vz + (vz / len) * wave) * rz,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a tapered organic TubeGeometry along a 3D curve so trunks, boughs, and exposed roots
 * naturally narrow from base to tip.
 */
function createTaperedBranchGeometry(
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
    // Natural basal flare near u = 0 and smooth taper toward u = 1
    const flare = u < 0.22 ? Math.pow(1.0 - u / 0.22, 2.0) * 0.28 : 0.0;
    const baseR = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(u, 0.82)) * (1.0 + flare);

    for (let j = 0; j < ringStride; j++) {
      const idx = i * ringStride + j;
      const vx = pos.getX(idx) - center.x;
      const vy = pos.getY(idx) - center.y;
      const vz = pos.getZ(idx) - center.z;
      const ang = (j / radialSegments) * Math.PI * 2;
      // Organic bark flute/ridge modulation
      const flute =
        1.0 +
        Math.sin(ang * 5.0 + u * 6.0 + seed) * 0.08 +
        Math.cos(ang * 3.0 - u * 4.0 + seed * 1.7) * 0.06;
      const r = baseR * flute;
      pos.setXYZ(
        idx,
        center.x + vx * r,
        center.y + vy * r,
        center.z + vz * r,
      );
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds Phase F2's 3-Tier Layered Forest + The Giant Ancient Tree Landmark:
 * - Layer 1: 10 Hero Ancient Trees (12.5m–17.8m height, individually composed landmarks with thick trunks,
 *   exposed roots, hollow cavities, directional moss, hanging vines & asymmetric canopies)
 * - Giant Ancient Tree: 1 major landmark at local (72.5, 10.5) (20.8m height, enormous trunk, 8 sprawling
 *   exposed roots, deep hollow trunk opening, twisted boughs, moss, hanging vines & base mushrooms)
 * - Layer 2: 56 Midground Trees (6.2m–10.0m height, 2 distinct InstancedMesh variants)
 * - Layer 3: 78 Background Silhouette Trees (9.5m–16.0m height, InstancedMesh outer horizon ring)
 */
export function createForestTreeSystem(): ForestTreeSystemBundle {
  const group = new THREE.Group();
  group.name = 'PhaseF2_ForestTreeSystem';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED + 1201);

  const barkBumpTex = createAncientBarkBumpTexture(tracker);
  const leafBumpTex = createForestLeafBumpTexture(tracker);

  // ============================================================================
  // SHARED NATURAL WOODLAND MATERIALS (Believable Roughness, Controlled Saturation)
  // ============================================================================
  const ancientBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3b2f'),
      roughness: 0.91,
      metalness: 0.02,
      bumpMap: barkBumpTex ?? undefined,
      bumpScale: 0.045,
    }),
  );

  const giantTreeBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f3126'),
      roughness: 0.93,
      metalness: 0.02,
      bumpMap: barkBumpTex ?? undefined,
      bumpScale: 0.055,
    }),
  );

  const hollowShadowMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#140f0b'),
      roughness: 0.98,
      metalness: 0.0,
    }),
  );

  const trunkMossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6234'),
      roughness: 0.86,
      metalness: 0.0,
      bumpMap: leafBumpTex ?? undefined,
      bumpScale: 0.025,
    }),
  );

  const hangingVineMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d4c2b'),
      roughness: 0.78,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );

  const canopyDeepMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#234228'),
      roughness: 0.74,
      metalness: 0.02,
      bumpMap: leafBumpTex ?? undefined,
      bumpScale: 0.03,
    }),
  );

  const canopyOliveMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#31572c'),
      roughness: 0.71,
      metalness: 0.02,
      bumpMap: leafBumpTex ?? undefined,
      bumpScale: 0.03,
    }),
  );

  const canopySunlitMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3d6634'),
      roughness: 0.68,
      metalness: 0.02,
      bumpMap: leafBumpTex ?? undefined,
      bumpScale: 0.028,
    }),
  );

  const mushroomCapMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8c6239'),
      roughness: 0.76,
    }),
  );

  const mushroomStemMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d6cbb5'),
      roughness: 0.82,
    }),
  );

  // ============================================================================
  // LAYER 1: 10 INDIVIDUALLY COMPOSED HERO ANCIENT TREES (12.5m–17.8m Height)
  // ============================================================================
  const heroSpecs: HeroTreeSpec[] = [
    // Transition edge (localX ~ 43–46): framing the passage beyond Gate 2
    {
      id: 'hero_tree_1_gate_guardian_left',
      archetype: 'buttress_root_patriarch',
      localX: 43.2,
      localZ: 14.6,
      targetHeight: 13.8,
      trunkRadius: 0.68,
      leanX: 0.04,
      leanZ: -0.05,
      rotationY: 0.4,
      hasHollow: false,
    },
    {
      id: 'hero_tree_2_leaning_oak_right',
      archetype: 'leaning_hollow_oak',
      localX: 43.8,
      localZ: 1.2,
      targetHeight: 14.6,
      trunkRadius: 0.74,
      leanX: -0.06,
      leanZ: 0.08,
      rotationY: 2.1,
      hasHollow: true,
    },
    // First Sun-Dappled Glade (localX ~ 48–53): framing open negative space
    {
      id: 'hero_tree_3_glade1_north',
      archetype: 'forked_canopy_elder',
      localX: 49.4,
      localZ: 5.4,
      targetHeight: 15.8,
      trunkRadius: 0.78,
      leanX: 0.03,
      leanZ: -0.04,
      rotationY: -1.1,
      hasHollow: false,
    },
    {
      id: 'hero_tree_4_glade1_south',
      archetype: 'twisted_moss_sentinel',
      localX: 50.8,
      localZ: -5.8,
      targetHeight: 13.2,
      trunkRadius: 0.65,
      leanX: -0.05,
      leanZ: 0.05,
      rotationY: 0.85,
      hasHollow: true,
    },
    // Root-Corridor & Shallow Depression (localX ~ 54–59): narrower ancient passage
    {
      id: 'hero_tree_5_corridor_arch_left',
      archetype: 'leaning_hollow_oak',
      localX: 54.8,
      localZ: -0.4,
      targetHeight: 16.4,
      trunkRadius: 0.82,
      leanX: 0.07,
      leanZ: -0.09,
      rotationY: -0.6,
      hasHollow: true,
    },
    {
      id: 'hero_tree_6_corridor_buttress_right',
      archetype: 'buttress_root_patriarch',
      localX: 54.8,
      localZ: -7.5,
      targetHeight: 15.2,
      trunkRadius: 0.76,
      leanX: -0.04,
      leanZ: 0.07,
      rotationY: 1.65,
      hasHollow: false,
    },
    // Second Ancient Canopy Pocket (localX ~ 60–65)
    {
      id: 'hero_tree_7_glade2_west',
      archetype: 'forked_canopy_elder',
      localX: 60.4,
      localZ: 3.4,
      targetHeight: 17.2,
      trunkRadius: 0.86,
      leanX: 0.05,
      leanZ: -0.04,
      rotationY: 2.6,
      hasHollow: false,
    },
    {
      id: 'hero_tree_8_glade2_east',
      archetype: 'twisted_moss_sentinel',
      localX: 63.2,
      localZ: -6.8,
      targetHeight: 14.4,
      trunkRadius: 0.72,
      leanX: -0.07,
      leanZ: 0.04,
      rotationY: -2.2,
      hasHollow: true,
    },
    // Ascending Root-Arch Corridor framing the Giant Ancient Tree sightline (localX ~ 66–70)
    {
      id: 'hero_tree_9_sanctuary_portal_left',
      archetype: 'buttress_root_patriarch',
      localX: 66.8,
      localZ: 9.8,
      targetHeight: 17.8,
      trunkRadius: 0.88,
      leanX: 0.04,
      leanZ: -0.06,
      rotationY: -0.45,
      hasHollow: false,
    },
    {
      id: 'hero_tree_10_sanctuary_portal_right',
      archetype: 'leaning_hollow_oak',
      localX: 68.4,
      localZ: 0.4,
      targetHeight: 16.8,
      trunkRadius: 0.84,
      leanX: -0.05,
      leanZ: 0.08,
      rotationY: 1.25,
      hasHollow: true,
    },
  ];

  const heroBarkGeos: THREE.BufferGeometry[] = [];
  const heroHollowGeos: THREE.BufferGeometry[] = [];
  const heroMossGeos: THREE.BufferGeometry[] = [];
  const heroVineGeos: THREE.BufferGeometry[] = [];
  const heroCanopyDeepGeos: THREE.BufferGeometry[] = [];
  const heroCanopyOliveGeos: THREE.BufferGeometry[] = [];
  const heroCanopySunlitGeos: THREE.BufferGeometry[] = [];

  heroSpecs.forEach((spec, hIdx) => {
    const w = castleLocalToWorld(spec.localX, spec.localZ);
    const wy = getTerrainHeight(w.x, w.z);
    const h = spec.targetHeight;
    const r0 = spec.trunkRadius;
    const seed = (hIdx + 1) * 97;

    // Register solid trunk collider
    colliders.push({ x: w.x, z: w.z, radius: r0 * 1.15 });

    const trunkTopH = h * 0.62;
    const midX = Math.sin(spec.rotationY) * 0.35 + spec.leanX * trunkTopH * 0.45;
    const midZ = Math.cos(spec.rotationY) * 0.35 + spec.leanZ * trunkTopH * 0.45;
    const topX = spec.leanX * trunkTopH;
    const topZ = spec.leanZ * trunkTopH;

    // 1. Main Gnarled Trunk Column
    const trunkPts = [
      new THREE.Vector3(w.x, wy - 0.35, w.z),
      new THREE.Vector3(w.x + midX * 0.35, wy + trunkTopH * 0.28, w.z + midZ * 0.35),
      new THREE.Vector3(w.x + midX, wy + trunkTopH * 0.64, w.z + midZ),
      new THREE.Vector3(w.x + topX, wy + trunkTopH, w.z + topZ),
    ];
    heroBarkGeos.push(
      createTaperedBranchGeometry(trunkPts, r0 * 1.28, r0 * 0.48, 12, 9, seed),
    );

    // 2. 5 Sprawling Exposed Roots hugging the local terrain height
    const rootCount = spec.archetype === 'buttress_root_patriarch' ? 6 : 5;
    for (let rt = 0; rt < rootCount; rt++) {
      const rAng = spec.rotationY + (rt / rootCount) * Math.PI * 2 + (rand() - 0.5) * 0.28;
      const rLen = r0 * (2.4 + rand() * 1.4);
      const rx1 = w.x + Math.cos(rAng) * (rLen * 0.48);
      const rz1 = w.z + Math.sin(rAng) * (rLen * 0.48);
      const ry1 = getTerrainHeight(rx1, rz1) + r0 * 0.36;

      const rx2 = w.x + Math.cos(rAng + 0.14) * rLen;
      const rz2 = w.z + Math.sin(rAng + 0.14) * rLen;
      const ry2 = getTerrainHeight(rx2, rz2) - 0.12;

      const rootPts = [
        new THREE.Vector3(
          w.x + Math.cos(rAng) * (r0 * 0.55),
          wy + r0 * 0.85,
          w.z + Math.sin(rAng) * (r0 * 0.55),
        ),
        new THREE.Vector3(rx1, ry1, rz1),
        new THREE.Vector3(rx2, ry2, rz2),
      ];
      heroBarkGeos.push(
        createTaperedBranchGeometry(
          rootPts,
          r0 * 0.42,
          r0 * 0.09,
          8,
          6,
          seed + rt * 13,
        ),
      );

      // Directional moss cushion on the shaded side of the root flare (first 3 roots)
      if (rt < 3) {
        const mGeo = createPerturbedClusterGeo(
          r0 * 0.48,
          r0 * 0.22,
          r0 * 0.42,
          1,
          0.22,
          seed + rt * 19,
        );
        mGeo.translate(
          (w.x + rx1) * 0.5,
          (wy + ry1) * 0.5 + 0.08,
          (w.z + rz1) * 0.5,
        );
        heroMossGeos.push(mGeo);
      }
    }

    // 3. Optional Hollow-Looking Bark Cavity on trunk base/mid
    if (spec.hasHollow) {
      const hAng = spec.rotationY;
      const hx = w.x + Math.sin(hAng) * (r0 * 0.88);
      const hz = w.z + Math.cos(hAng) * (r0 * 0.88);
      const hy = wy + 1.25;

      const hollowInterior = new THREE.CylinderGeometry(
        r0 * 0.36,
        r0 * 0.44,
        1.45,
        8,
      );
      hollowInterior.scale(1.0, 1.0, 0.45);
      hollowInterior.rotateY(hAng);
      hollowInterior.translate(hx, hy, hz);
      heroHollowGeos.push(hollowInterior);

      const lipRim = new THREE.TorusGeometry(r0 * 0.42, r0 * 0.12, 6, 12);
      lipRim.scale(0.82, 1.55, 0.65);
      lipRim.rotateY(hAng);
      lipRim.translate(hx, hy, hz);
      heroBarkGeos.push(lipRim);
    }

    // 4. Concentrated Directional Moss Shelves on one side of the trunk
    const mossSideAng = spec.rotationY + 0.65;
    for (let m = 0; m < 4; m++) {
      const mh = 1.1 + m * (trunkTopH * 0.2);
      const frac = mh / trunkTopH;
      const curR = THREE.MathUtils.lerp(r0 * 1.05, r0 * 0.56, frac);
      const mx =
        w.x +
        topX * frac +
        Math.cos(mossSideAng + m * 0.22) * (curR * 0.92);
      const mz =
        w.z +
        topZ * frac +
        Math.sin(mossSideAng + m * 0.22) * (curR * 0.92);
      const mossPatch = createPerturbedClusterGeo(
        curR * 0.42,
        0.38,
        curR * 0.36,
        1,
        0.24,
        seed + m * 31,
      );
      mossPatch.translate(mx, wy + mh, mz);
      heroMossGeos.push(mossPatch);
    }

    // 5. 4–5 Sweeping Primary Boughs + Asymmetric Multi-Tier Canopy + Hanging Vines
    const boughCount = spec.archetype === 'forked_canopy_elder' ? 5 : 4;
    for (let b = 0; b < boughCount; b++) {
      const bAng =
        spec.rotationY +
        (b / boughCount) * Math.PI * 2 +
        (b % 2 === 0 ? 0.18 : -0.18);
      const startFrac = 0.56 + (b % 3) * 0.14;
      const startY = wy + trunkTopH * startFrac;
      const sx = w.x + topX * startFrac;
      const sz = w.z + topZ * startFrac;

      const bSpan = 3.2 + (b % 2) * 1.15 + rand() * 0.85;
      const bRise = h * (0.22 + (b % 3) * 0.08);
      const mx = sx + Math.cos(bAng) * (bSpan * 0.52);
      const mz = sz + Math.sin(bAng) * (bSpan * 0.52);
      const my = startY + bRise * 0.58;

      const ex = sx + Math.cos(bAng + 0.16) * bSpan;
      const ez = sz + Math.sin(bAng + 0.16) * bSpan;
      const ey = startY + bRise;

      heroBarkGeos.push(
        createTaperedBranchGeometry(
          [
            new THREE.Vector3(sx, startY, sz),
            new THREE.Vector3(mx, my, mz),
            new THREE.Vector3(ex, ey, ez),
          ],
          r0 * 0.42,
          r0 * 0.11,
          8,
          6,
          seed + b * 43,
        ),
      );

      // Hanging woody vine ribbons suspended from the mid-bough
      if (b % 2 === 0) {
        const vineLen = 1.6 + rand() * 1.3;
        const vineRibbon = new THREE.ConeGeometry(0.085, vineLen, 4);
        vineRibbon.scale(1.0, 1.0, 0.25);
        vineRibbon.rotateZ((rand() - 0.5) * 0.12);
        vineRibbon.translate(mx, my - vineLen * 0.5, mz);
        heroVineGeos.push(vineRibbon);
      }

      // Layered asymmetric foliage puffs around each bough tip & mid-bough
      const puffRx = 1.85 + rand() * 0.65;
      const puffRy = 1.15 + rand() * 0.38;
      const puffRz = 1.75 + rand() * 0.65;
      const tipPuff = createPerturbedClusterGeo(
        puffRx,
        puffRy,
        puffRz,
        2,
        0.22,
        seed + b * 59,
      );
      tipPuff.translate(ex, ey + 0.35, ez);
      if (b % 3 === 0) {
        heroCanopyDeepGeos.push(tipPuff);
      } else if (b % 3 === 1) {
        heroCanopyOliveGeos.push(tipPuff);
      } else {
        heroCanopySunlitGeos.push(tipPuff);
      }

      const subPuff = createPerturbedClusterGeo(
        puffRx * 0.78,
        puffRy * 0.82,
        puffRz * 0.78,
        2,
        0.2,
        seed + b * 67,
      );
      subPuff.translate(mx, my + 0.65, mz);
      heroCanopyDeepGeos.push(subPuff);
    }

    // Upper crown dome puff reaching spec.targetHeight
    const apexPuff = createPerturbedClusterGeo(
      2.45,
      1.55,
      2.35,
      2,
      0.22,
      seed + 199,
    );
    apexPuff.translate(w.x + topX, wy + h - 1.25, w.z + topZ);
    heroCanopySunlitGeos.push(apexPuff);
  });

  if (heroBarkGeos.length > 0) {
    const mergedHeroBark = tracker.trackGeo(mergeGeometries(heroBarkGeos));
    heroBarkGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(mergedHeroBark, ancientBarkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (heroHollowGeos.length > 0) {
    const mergedHollows = tracker.trackGeo(mergeGeometries(heroHollowGeos));
    heroHollowGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(mergedHollows, hollowShadowMat);
    group.add(mesh);
  }

  if (heroMossGeos.length > 0) {
    const mergedMoss = tracker.trackGeo(mergeGeometries(heroMossGeos));
    heroMossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(mergedMoss, trunkMossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (heroVineGeos.length > 0) {
    const mergedVines = tracker.trackGeo(mergeGeometries(heroVineGeos));
    heroVineGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(mergedVines, hangingVineMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  if (heroCanopyDeepGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(heroCanopyDeepGeos));
    heroCanopyDeepGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, canopyDeepMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (heroCanopyOliveGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(heroCanopyOliveGeos));
    heroCanopyOliveGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, canopyOliveMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (heroCanopySunlitGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(heroCanopySunlitGeos));
    heroCanopySunlitGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, canopySunlitMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ============================================================================
  // THE GIANT ANCIENT TREE LANDMARK (local 72.5, 10.5 • 20.8m Height)
  // Enormous trunk, 8 large exposed roots, twisted branching, hollow trunk opening,
  // moss, hanging vines, and ordinary mushrooms around the base.
  // ============================================================================
  const giantWorldCoords = castleLocalToWorld(
    GIANT_ANCIENT_TREE_LOCAL_POS.localX,
    GIANT_ANCIENT_TREE_LOCAL_POS.localZ,
  );
  const giantGroundY = getTerrainHeight(giantWorldCoords.x, giantWorldCoords.z);
  const giantTreeGroup = new THREE.Group();
  giantTreeGroup.name = 'F2_GiantAncientTreeLandmark';
  giantTreeGroup.position.set(
    giantWorldCoords.x,
    giantGroundY,
    giantWorldCoords.z,
  );
  // Orient the hollow-like trunk opening toward the approaching forest corridor (localX ~ 67, localZ ~ 4.2)
  const approachWorld = castleLocalToWorld(67.2, 4.2);
  const giantFacingYaw = Math.atan2(
    approachWorld.x - giantWorldCoords.x,
    approachWorld.z - giantWorldCoords.z,
  );
  giantTreeGroup.rotation.y = giantFacingYaw;
  group.add(giantTreeGroup);

  // Collider for the Giant Ancient Tree massive basal trunk
  colliders.push({
    x: giantWorldCoords.x,
    z: giantWorldCoords.z,
    radius: 2.35,
  });

  const giantBarkGeos: THREE.BufferGeometry[] = [];
  const giantMossGeos: THREE.BufferGeometry[] = [];
  const giantVineGeos: THREE.BufferGeometry[] = [];
  const giantCanopyDeep: THREE.BufferGeometry[] = [];
  const giantCanopyOlive: THREE.BufferGeometry[] = [];
  const giantCanopySunlit: THREE.BufferGeometry[] = [];

  // 1. Enormous Multi-Ribbed Ancient Trunk (Height up to 13.2m before upper crown)
  const mainGiantTrunkPts = [
    new THREE.Vector3(0, -0.6, 0),
    new THREE.Vector3(0.12, 3.6, -0.08),
    new THREE.Vector3(-0.18, 7.8, 0.14),
    new THREE.Vector3(0.08, 12.6, -0.1),
  ];
  giantBarkGeos.push(
    createTaperedBranchGeometry(mainGiantTrunkPts, 1.85, 0.88, 16, 12, 801),
  );

  // 3 Intertwined Secondary Trunk Ribs giving the ancient trunk a gnarled, braided silhouette
  for (let rib = 0; rib < 3; rib++) {
    const rAng = (rib * Math.PI * 2) / 3 + 0.65;
    const ribPts = [
      new THREE.Vector3(Math.cos(rAng) * 0.95, -0.4, Math.sin(rAng) * 0.95),
      new THREE.Vector3(
        Math.cos(rAng + 0.45) * 0.78,
        4.2,
        Math.sin(rAng + 0.45) * 0.78,
      ),
      new THREE.Vector3(
        Math.cos(rAng + 0.9) * 0.55,
        9.4,
        Math.sin(rAng + 0.9) * 0.55,
      ),
    ];
    giantBarkGeos.push(
      createTaperedBranchGeometry(ribPts, 0.76, 0.34, 12, 8, 820 + rib),
    );
  }

  // 2. Deep Hollow-Like Trunk Opening Facing the Approach Route (+Z in local group)
  const giantHollowInterior = tracker.trackGeo(
    new THREE.CylinderGeometry(0.68, 0.88, 2.85, 10),
  );
  giantHollowInterior.scale(1.0, 1.0, 0.52);
  giantHollowInterior.translate(0, 1.45, 1.32);
  const giantHollowMesh = new THREE.Mesh(giantHollowInterior, hollowShadowMat);
  giantTreeGroup.add(giantHollowMesh);

  // Gnarled Bark Arch Framing the Hollow Trunk Opening
  const hollowArchPts = [
    new THREE.Vector3(-0.92, -0.1, 1.38),
    new THREE.Vector3(-0.78, 1.65, 1.52),
    new THREE.Vector3(0, 2.95, 1.46),
    new THREE.Vector3(0.78, 1.65, 1.52),
    new THREE.Vector3(0.92, -0.1, 1.38),
  ];
  giantBarkGeos.push(
    createTaperedBranchGeometry(hollowArchPts, 0.34, 0.32, 14, 8, 845),
  );

  // 3. 8 Massive Sprawling Exposed Roots Radiating Across the Knoll
  for (let gr = 0; gr < 8; gr++) {
    // Leave a welcoming gap directly in front of the hollow opening (gr === 0 and gr === 7 frame it)
    const baseAng = ((gr + 0.5) / 8) * Math.PI * 2;
    const rootSpan = 4.2 + (gr % 3) * 0.95;

    const p0 = new THREE.Vector3(
      Math.sin(baseAng) * 1.25,
      1.35 + (gr % 2) * 0.35,
      Math.cos(baseAng) * 1.25,
    );
    const p1 = new THREE.Vector3(
      Math.sin(baseAng + 0.12) * (rootSpan * 0.45),
      0.58,
      Math.cos(baseAng + 0.12) * (rootSpan * 0.45),
    );
    const p2 = new THREE.Vector3(
      Math.sin(baseAng - 0.08) * (rootSpan * 0.78),
      0.18,
      Math.cos(baseAng - 0.08) * (rootSpan * 0.78),
    );
    const p3 = new THREE.Vector3(
      Math.sin(baseAng + 0.05) * rootSpan,
      -0.38,
      Math.cos(baseAng + 0.05) * rootSpan,
    );

    giantBarkGeos.push(
      createTaperedBranchGeometry([p0, p1, p2, p3], 0.62, 0.14, 12, 8, 860 + gr),
    );

    // Moss cushions nestled along the massive root backs
    const rootMoss = createPerturbedClusterGeo(
      0.58,
      0.24,
      0.48,
      1,
      0.25,
      880 + gr,
    );
    rootMoss.translate(p1.x, p1.y + 0.16, p1.z);
    giantMossGeos.push(rootMoss);
  }

  // 4. 7 Twisted Primary & Secondary Boughs Supporting the 20.8m Canopy
  const giantBoughSpecs = [
    { ang: 0.35, startY: 8.8, span: 6.4, rise: 5.4, r0: 0.68 },
    { ang: 1.25, startY: 9.4, span: 6.8, rise: 5.8, r0: 0.72 },
    { ang: 2.15, startY: 8.6, span: 6.2, rise: 5.2, r0: 0.65 },
    { ang: 3.05, startY: 9.8, span: 6.6, rise: 5.6, r0: 0.7 },
    { ang: 3.95, startY: 9.1, span: 6.5, rise: 5.5, r0: 0.68 },
    { ang: 4.85, startY: 10.2, span: 6.0, rise: 5.8, r0: 0.64 },
    { ang: 5.65, startY: 9.5, span: 6.2, rise: 5.4, r0: 0.66 },
  ];

  giantBoughSpecs.forEach((bSpec, bIdx) => {
    const p0 = new THREE.Vector3(0, bSpec.startY, 0);
    const p1 = new THREE.Vector3(
      Math.sin(bSpec.ang) * (bSpec.span * 0.48),
      bSpec.startY + bSpec.rise * 0.55,
      Math.cos(bSpec.ang) * (bSpec.span * 0.48),
    );
    const p2 = new THREE.Vector3(
      Math.sin(bSpec.ang + 0.24) * bSpec.span,
      bSpec.startY + bSpec.rise,
      Math.cos(bSpec.ang + 0.24) * bSpec.span,
    );
    giantBarkGeos.push(
      createTaperedBranchGeometry(
        [p0, p1, p2],
        bSpec.r0,
        bSpec.r0 * 0.22,
        10,
        8,
        900 + bIdx,
      ),
    );

    // Secondary forked sub-branch
    const subAng = bSpec.ang - 0.42;
    const pSub = new THREE.Vector3(
      p1.x + Math.sin(subAng) * 3.1,
      p1.y + 2.4,
      p1.z + Math.cos(subAng) * 3.1,
    );
    giantBarkGeos.push(
      createTaperedBranchGeometry(
        [p1, pSub],
        bSpec.r0 * 0.46,
        bSpec.r0 * 0.14,
        7,
        6,
        920 + bIdx,
      ),
    );

    // Moss shelf along the upper bough shoulder
    const bMoss = createPerturbedClusterGeo(0.65, 0.22, 0.45, 1, 0.22, 940 + bIdx);
    bMoss.translate(p1.x, p1.y + 0.24, p1.z);
    giantMossGeos.push(bMoss);

    // Hanging ancient vines draped from the boughs
    for (let v = 0; v < 2; v++) {
      const vx = THREE.MathUtils.lerp(p1.x, p2.x, 0.35 + v * 0.4);
      const vy = THREE.MathUtils.lerp(p1.y, p2.y, 0.35 + v * 0.4);
      const vz = THREE.MathUtils.lerp(p1.z, p2.z, 0.35 + v * 0.4);
      const vLen = 2.6 + (bIdx % 3) * 0.65 + v * 0.5;
      const vGeo = new THREE.ConeGeometry(0.11, vLen, 5);
      vGeo.scale(1.0, 1.0, 0.28);
      vGeo.translate(vx, vy - vLen * 0.5, vz);
      giantVineGeos.push(vGeo);
    }

    // Layered Foliage Puffs on Main Bough, Sub-Branch & Upper Tier
    const mainCrownPuff = createPerturbedClusterGeo(
      2.85,
      1.65,
      2.75,
      2,
      0.24,
      960 + bIdx,
    );
    mainCrownPuff.translate(p2.x, p2.y + 0.55, p2.z);
    if (bIdx % 2 === 0) {
      giantCanopyOlive.push(mainCrownPuff);
    } else {
      giantCanopySunlit.push(mainCrownPuff);
    }

    const midCrownPuff = createPerturbedClusterGeo(
      2.35,
      1.45,
      2.25,
      2,
      0.22,
      980 + bIdx,
    );
    midCrownPuff.translate(p1.x, p1.y + 1.1, p1.z);
    giantCanopyDeep.push(midCrownPuff);

    const subCrownPuff = createPerturbedClusterGeo(
      2.15,
      1.35,
      2.1,
      2,
      0.22,
      1000 + bIdx,
    );
    subCrownPuff.translate(pSub.x, pSub.y + 0.45, pSub.z);
    giantCanopyOlive.push(subCrownPuff);
  });

  // Grand Upper Canopy Crown Dome reaching 20.8m height
  const grandApexDome = createPerturbedClusterGeo(3.8, 2.2, 3.6, 2, 0.25, 1050);
  grandApexDome.translate(0, 18.6, 0);
  giantCanopySunlit.push(grandApexDome);

  const upperRingOffsets = [
    [-2.4, 16.8, 1.8],
    [2.5, 17.1, 1.6],
    [-2.1, 16.9, -2.2],
    [2.2, 17.2, -2.0],
  ];
  upperRingOffsets.forEach(([ux, uy, uz], uIdx) => {
    const uPuff = createPerturbedClusterGeo(
      2.65,
      1.6,
      2.55,
      2,
      0.22,
      1060 + uIdx,
    );
    uPuff.translate(ux, uy, uz);
    if (uIdx % 2 === 0) {
      giantCanopySunlit.push(uPuff);
    } else {
      giantCanopyOlive.push(uPuff);
    }
  });

  // 5. Ordinary Woodland Mushrooms Clustered Around the Giant Ancient Tree Base
  const mushroomCapGeo = new THREE.SphereGeometry(0.085, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  mushroomCapGeo.scale(1.15, 0.85, 1.15);
  const mushroomStemGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.12, 6);
  mushroomStemGeo.translate(0, 0.06, 0);

  const baseCapGeos: THREE.BufferGeometry[] = [];
  const baseStemGeos: THREE.BufferGeometry[] = [];
  for (let m = 0; m < 18; m++) {
    const clusterIdx = Math.floor(m / 3);
    const mAng = ((clusterIdx + 0.25) / 6) * Math.PI * 2 + (m % 3) * 0.08;
    const mRad = 1.65 + (m % 3) * 0.22 + (clusterIdx % 2) * 0.45;
    const mx = Math.sin(mAng) * mRad;
    const mz = Math.cos(mAng) * mRad;
    const my = 0.08 + (1.0 - (mRad - 1.5) / 1.5) * 0.22;
    const mScale = 0.65 + (m % 3) * 0.32;

    const sGeo = mushroomStemGeo.clone();
    sGeo.scale(mScale, mScale, mScale);
    sGeo.translate(mx, my, mz);
    baseStemGeos.push(sGeo);

    const cGeo = mushroomCapGeo.clone();
    cGeo.scale(mScale, mScale, mScale);
    cGeo.translate(mx, my + 0.11 * mScale, mz);
    baseCapGeos.push(cGeo);
  }
  mushroomCapGeo.dispose();
  mushroomStemGeo.dispose();

  const mergedGiantBark = tracker.trackGeo(mergeGeometries(giantBarkGeos));
  giantBarkGeos.forEach((g) => g.dispose());
  const giantBarkMesh = new THREE.Mesh(mergedGiantBark, giantTreeBarkMat);
  giantBarkMesh.castShadow = true;
  giantBarkMesh.receiveShadow = true;
  giantTreeGroup.add(giantBarkMesh);

  const mergedGiantMoss = tracker.trackGeo(mergeGeometries(giantMossGeos));
  giantMossGeos.forEach((g) => g.dispose());
  const giantMossMesh = new THREE.Mesh(mergedGiantMoss, trunkMossMat);
  giantMossMesh.receiveShadow = true;
  giantTreeGroup.add(giantMossMesh);

  const mergedGiantVines = tracker.trackGeo(mergeGeometries(giantVineGeos));
  giantVineGeos.forEach((g) => g.dispose());
  const giantVineMesh = new THREE.Mesh(mergedGiantVines, hangingVineMat);
  giantVineMesh.castShadow = true;
  giantTreeGroup.add(giantVineMesh);

  const mergedGiantDeep = tracker.trackGeo(mergeGeometries(giantCanopyDeep));
  giantCanopyDeep.forEach((g) => g.dispose());
  const giantDeepMesh = new THREE.Mesh(mergedGiantDeep, canopyDeepMat);
  giantDeepMesh.castShadow = true;
  giantDeepMesh.receiveShadow = true;
  giantTreeGroup.add(giantDeepMesh);

  const mergedGiantOlive = tracker.trackGeo(mergeGeometries(giantCanopyOlive));
  giantCanopyOlive.forEach((g) => g.dispose());
  const giantOliveMesh = new THREE.Mesh(mergedGiantOlive, canopyOliveMat);
  giantOliveMesh.castShadow = true;
  giantOliveMesh.receiveShadow = true;
  giantTreeGroup.add(giantOliveMesh);

  const mergedGiantSunlit = tracker.trackGeo(mergeGeometries(giantCanopySunlit));
  giantCanopySunlit.forEach((g) => g.dispose());
  const giantSunlitMesh = new THREE.Mesh(mergedGiantSunlit, canopySunlitMat);
  giantSunlitMesh.castShadow = true;
  giantSunlitMesh.receiveShadow = true;
  giantTreeGroup.add(giantSunlitMesh);

  const mergedBaseStems = tracker.trackGeo(mergeGeometries(baseStemGeos));
  baseStemGeos.forEach((g) => g.dispose());
  const mergedBaseCaps = tracker.trackGeo(mergeGeometries(baseCapGeos));
  baseCapGeos.forEach((g) => g.dispose());
  giantTreeGroup.add(
    new THREE.Mesh(mergedBaseStems, mushroomStemMat),
    new THREE.Mesh(mergedBaseCaps, mushroomCapMat),
  );

  // ============================================================================
  // LAYER 2: MIDGROUND TREES (56 Trees • 6.2m–10.0m Height • 2 InstancedMesh Variants)
  // ============================================================================
  // Variant A: Gnarled Woodland Broadleaf (Normalized 1.0m unit height -> scaled 6.2m..10.0m)
  const midBroadleafTrunkGeo = (() => {
    const trunk = createTaperedBranchGeometry(
      [
        new THREE.Vector3(0, -0.04, 0),
        new THREE.Vector3(0.02, 0.28, 0.01),
        new THREE.Vector3(-0.02, 0.58, -0.01),
      ],
      0.068,
      0.032,
      8,
      7,
      301,
    );
    const b1 = createTaperedBranchGeometry(
      [
        new THREE.Vector3(0, 0.42, 0),
        new THREE.Vector3(-0.18, 0.68, 0.08),
      ],
      0.032,
      0.012,
      5,
      5,
      302,
    );
    const b2 = createTaperedBranchGeometry(
      [
        new THREE.Vector3(0, 0.46, 0),
        new THREE.Vector3(0.17, 0.72, -0.09),
      ],
      0.03,
      0.012,
      5,
      5,
      303,
    );
    const rootFlare = new THREE.CylinderGeometry(0.055, 0.11, 0.12, 7);
    rootFlare.translate(0, 0.04, 0);
    const merged = tracker.trackGeo(mergeGeometries([trunk, b1, b2, rootFlare]));
    [trunk, b1, b2, rootFlare].forEach((g) => g.dispose());
    return merged;
  })();

  const midBroadleafCanopyGeo = (() => {
    const puffs = [
      [0, 0.76, 0, 0.28, 0.19, 0.27],
      [-0.18, 0.68, 0.09, 0.22, 0.16, 0.21],
      [0.18, 0.71, -0.08, 0.22, 0.16, 0.21],
      [0.05, 0.66, -0.17, 0.2, 0.15, 0.2],
      [-0.06, 0.67, 0.17, 0.2, 0.15, 0.2],
      [0, 0.89, 0.02, 0.21, 0.15, 0.2],
    ].map(([px, py, pz, rx, ry, rz], idx) => {
      const g = createPerturbedClusterGeo(rx, ry, rz, 1, 0.2, 310 + idx);
      g.translate(px, py, pz);
      return g;
    });
    const merged = tracker.trackGeo(mergeGeometries(puffs));
    puffs.forEach((g) => g.dispose());
    return merged;
  })();

  // Variant B: Ancient Highland Yew / Multi-Stem Alder (Normalized 1.0m unit height)
  const midYewTrunkGeo = (() => {
    const stem1 = createTaperedBranchGeometry(
      [
        new THREE.Vector3(-0.02, -0.04, 0),
        new THREE.Vector3(-0.07, 0.36, 0.04),
        new THREE.Vector3(-0.11, 0.68, 0.06),
      ],
      0.052,
      0.018,
      7,
      6,
      331,
    );
    const stem2 = createTaperedBranchGeometry(
      [
        new THREE.Vector3(0.02, -0.04, 0),
        new THREE.Vector3(0.08, 0.38, -0.03),
        new THREE.Vector3(0.12, 0.72, -0.05),
      ],
      0.048,
      0.016,
      7,
      6,
      332,
    );
    const collar = new THREE.CylinderGeometry(0.06, 0.12, 0.1, 7);
    collar.translate(0, 0.03, 0);
    const merged = tracker.trackGeo(mergeGeometries([stem1, stem2, collar]));
    [stem1, stem2, collar].forEach((g) => g.dispose());
    return merged;
  })();

  const midYewCanopyGeo = (() => {
    const puffs = [
      [-0.1, 0.56, 0.05, 0.24, 0.14, 0.23],
      [0.11, 0.62, -0.04, 0.23, 0.14, 0.22],
      [0, 0.76, 0.02, 0.22, 0.15, 0.21],
      [-0.08, 0.86, 0.04, 0.17, 0.14, 0.17],
      [0.06, 0.92, -0.02, 0.14, 0.13, 0.14],
    ].map(([px, py, pz, rx, ry, rz], idx) => {
      const g = createPerturbedClusterGeo(rx, ry, rz, 1, 0.22, 340 + idx);
      g.translate(px, py, pz);
      return g;
    });
    const merged = tracker.trackGeo(mergeGeometries(puffs));
    puffs.forEach((g) => g.dispose());
    return merged;
  })();

  const instBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.9,
      metalness: 0.02,
      bumpMap: barkBumpTex ?? undefined,
      bumpScale: 0.035,
    }),
  );
  const instCanopyMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.72,
      metalness: 0.02,
      bumpMap: leafBumpTex ?? undefined,
      bumpScale: 0.028,
    }),
  );

  // Generate 56 deterministic Midground Tree placements around forest pockets & route edges
  interface MidTreePlacement {
    wx: number;
    wy: number;
    wz: number;
    height: number;
    widthScale: number;
    rotY: number;
    leanX: number;
    leanZ: number;
    variant: 0 | 1;
  }

  const midPlacements: MidTreePlacement[] = [];
  let attempts = 0;
  while (midPlacements.length < 68 && attempts < 800) {
    attempts++;
    const prog = Math.pow(rand(), 0.88); // Gradual ramp from scattered at Gate 2 to denser deeper in
    const segIdx = Math.min(
      ANCIENT_FOREST_LOCAL_POINTS.length - 2,
      Math.floor(prog * (ANCIENT_FOREST_LOCAL_POINTS.length - 1)),
    );
    const segT = prog * (ANCIENT_FOREST_LOCAL_POINTS.length - 1) - segIdx;
    const pA = ANCIENT_FOREST_LOCAL_POINTS[segIdx];
    const pB = ANCIENT_FOREST_LOCAL_POINTS[segIdx + 1];

    const centerLocalX = THREE.MathUtils.lerp(pA.localX, pB.localX, segT);
    const centerLocalZ = THREE.MathUtils.lerp(pA.localZ, pB.localZ, segT);

    // Preserve open glade pockets at prog ~ 0.33 and prog ~ 0.67 (OPEN -> DENSE -> OPEN -> DENSE)
    const isGladePocket =
      Math.abs(prog - 0.33) < 0.09 || Math.abs(prog - 0.67) < 0.09;
    const minCorridorHalfWidth =
      prog < 0.16 ? 4.8 : isGladePocket ? 6.2 : 3.4;
    const lateralDist = minCorridorHalfWidth + rand() * 10.5;
    const side = rand() > 0.5 ? 1 : -1;

    const abx = pB.localX - pA.localX;
    const abz = pB.localZ - pA.localZ;
    const len = Math.hypot(abx, abz) || 1;
    const perpX = (-abz / len) * side;
    const perpZ = (abx / len) * side;

    const lx =
      centerLocalX + perpX * lateralDist + (rand() - 0.5) * 3.2;
    const lz =
      centerLocalZ + perpZ * lateralDist + (rand() - 0.5) * 3.2;

    // Keep clear of F1 garden and Giant Ancient Tree knoll center
    if (lx < 40.8) continue;
    if (
      Math.hypot(
        lx - GIANT_ANCIENT_TREE_LOCAL_POS.localX,
        lz - GIANT_ANCIENT_TREE_LOCAL_POS.localZ,
      ) < 6.8
    ) {
      continue;
    }

    // Keep the entire Forest Lake basin and its shoreline completely free of midground trees
    const midLakeDx = (lx - FOREST_LAKE_LOCAL_POS.localX) / 1.22;
    const midLakeDz = (lz - FOREST_LAKE_LOCAL_POS.localZ) / 0.95;
    if (Math.hypot(midLakeDx, midLakeDz) < 15.5) {
      continue;
    }

    // Controlled sightline opening to the Lake on the left side of the walkway (localX: 45..58, localZ: -14..-4)
    if (lx >= 45.0 && lx <= 58.0 && lz >= -14.0 && lz <= -4.0) {
      continue;
    }

    // Keep the Neon Pathway corridor to the Signboard and Rune Stone open and visible (localX: 55.5..62.5, localZ: -11.5..-4.0)
    if (lx >= 55.5 && lx <= 62.5 && lz >= -11.5 && lz <= -4.0) {
      continue;
    }

    // Keep the central glade of the Northern Plateau open as sun-dappled negative space for future gameplay (localX: 82..98, localZ: 26..46)
    if (lx >= 82.0 && lx <= 98.0 && lz >= 26.0 && lz <= 46.0) {
      continue;
    }

    const fProx = evaluateAncientForestLocalProximity(lx, lz);
    if (fProx.minDist < minCorridorHalfWidth) continue;

    const w = castleLocalToWorld(lx, lz);
    // Avoid overlapping Hero Trees or other Midground Trees
    let tooClose = false;
    for (let c = 0; c < colliders.length; c++) {
      if (Math.hypot(w.x - colliders[c].x, w.z - colliders[c].z) < 2.8) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    for (let m = 0; m < midPlacements.length; m++) {
      if (
        Math.hypot(w.x - midPlacements[m].wx, w.z - midPlacements[m].wz) < 2.6
      ) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const wy = getTerrainHeight(w.x, w.z);
    const height = 6.2 + rand() * 3.8; // 6.2m–10.0m target range
    const widthScale = height * (0.85 + rand() * 0.3);
    const variant: 0 | 1 = rand() > 0.46 ? 0 : 1;

    midPlacements.push({
      wx: w.x,
      wy,
      wz: w.z,
      height,
      widthScale,
      rotY: rand() * Math.PI * 2,
      leanX: (rand() - 0.5) * 0.08,
      leanZ: (rand() - 0.5) * 0.08,
      variant,
    });

    // Add lightweight trunk collider for walkable corridor boundary trees
    if (fProx.minDist < 12.5) {
      colliders.push({
        x: w.x,
        z: w.z,
        radius: widthScale * 0.058,
      });
    }
  }

  const variantA = midPlacements.filter((p) => p.variant === 0);
  const variantB = midPlacements.filter((p) => p.variant === 1);

  const _dummy = new THREE.Object3D();
  const _col = new THREE.Color();
  const cBarkDark = new THREE.Color('#433529');
  const cBarkWarm = new THREE.Color('#574435');
  const cFoliageDeep = new THREE.Color('#25462a');
  const cFoliageMoss = new THREE.Color('#365e32');

  function buildMidgroundInstancedLayer(
    list: MidTreePlacement[],
    trunkGeo: THREE.BufferGeometry,
    canopyGeo: THREE.BufferGeometry,
  ) {
    if (list.length === 0) return;
    const trunkInst = new THREE.InstancedMesh(
      trunkGeo,
      instBarkMat,
      list.length,
    );
    const canopyInst = new THREE.InstancedMesh(
      canopyGeo,
      instCanopyMat,
      list.length,
    );
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;

    list.forEach((item, idx) => {
      _dummy.position.set(item.wx, item.wy, item.wz);
      _dummy.rotation.set(item.leanX, item.rotY, item.leanZ);
      _dummy.scale.set(item.widthScale, item.height, item.widthScale);
      _dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, _dummy.matrix);
      canopyInst.setMatrixAt(idx, _dummy.matrix);

      _col.lerpColors(cBarkDark, cBarkWarm, (idx * 0.37) % 1.0);
      trunkInst.setColorAt(idx, _col);

      _col.lerpColors(cFoliageDeep, cFoliageMoss, (idx * 0.61) % 1.0);
      canopyInst.setColorAt(idx, _col);
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (trunkInst.instanceColor) trunkInst.instanceColor.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;

    group.add(trunkInst, canopyInst);
  }

  buildMidgroundInstancedLayer(
    variantA,
    midBroadleafTrunkGeo,
    midBroadleafCanopyGeo,
  );
  buildMidgroundInstancedLayer(variantB, midYewTrunkGeo, midYewCanopyGeo);

  // ============================================================================
  // LAYER 3: BACKGROUND FOREST SILHOUETTES (78 Trees • 9.5m–16.0m • InstancedMesh)
  // Establishes deep woodland continuity beyond the immediately explorable area.
  // ============================================================================
  const bgTrunkGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.028, 0.065, 0.65, 6),
  );
  bgTrunkGeo.translate(0, 0.32, 0);

  const bgCanopyGeo = (() => {
    const tier1 = createPerturbedClusterGeo(0.28, 0.22, 0.28, 1, 0.18, 501);
    tier1.translate(0, 0.62, 0);
    const tier2 = createPerturbedClusterGeo(0.22, 0.2, 0.22, 1, 0.18, 502);
    tier2.translate(0, 0.84, 0);
    const merged = tracker.trackGeo(mergeGeometries([tier1, tier2]));
    tier1.dispose();
    tier2.dispose();
    return merged;
  })();

  const bgBarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#362c24'),
      roughness: 0.94,
    }),
  );
  const bgCanopyMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.82,
    }),
  );

  const bgCount = 78;
  const bgTrunkInst = new THREE.InstancedMesh(bgTrunkGeo, bgBarkMat, bgCount);
  const bgCanopyInst = new THREE.InstancedMesh(
    bgCanopyGeo,
    bgCanopyMat,
    bgCount,
  );
  const cBgNear = new THREE.Color('#223d27');
  const cBgDistant = new THREE.Color('#1c3328');

  let bgPlaced = 0;
  let bgAttempts = 0;
  while (bgPlaced < bgCount && bgAttempts < 600) {
    bgAttempts++;
    const prog = rand() * 1.12;
    const segIdx = Math.min(
      ANCIENT_FOREST_LOCAL_POINTS.length - 2,
      Math.floor(Math.min(0.99, prog) * (ANCIENT_FOREST_LOCAL_POINTS.length - 1)),
    );
    const segT =
      Math.min(0.99, prog) * (ANCIENT_FOREST_LOCAL_POINTS.length - 1) - segIdx;
    const pA = ANCIENT_FOREST_LOCAL_POINTS[segIdx];
    const pB = ANCIENT_FOREST_LOCAL_POINTS[segIdx + 1];

    const abx = pB.localX - pA.localX;
    const abz = pB.localZ - pA.localZ;
    const len = Math.hypot(abx, abz) || 1;

    // Place in the deep perimeter ring (13.5m–26.0m from route centerline) and beyond the Giant Tree knoll
    const side = rand() > 0.5 ? 1 : -1;
    const distOut = 13.5 + rand() * 12.5;
    let lx =
      THREE.MathUtils.lerp(pA.localX, pB.localX, segT) +
      (-abz / len) * side * distOut +
      (rand() - 0.5) * 4.5;
    let lz =
      THREE.MathUtils.lerp(pA.localZ, pB.localZ, segT) +
      (abx / len) * side * distOut +
      (rand() - 0.5) * 4.5;

    // Also wrap background forest along the outer mountain rim of the expanded Northern Plateau
    if (prog > 0.96) {
      const arcAng = (rand() - 0.5) * Math.PI * 0.95;
      const arcRad = 32.0 + rand() * 24.0;
      lx = GIANT_ANCIENT_TREE_LOCAL_POS.localX + Math.cos(arcAng) * arcRad;
      lz = GIANT_ANCIENT_TREE_LOCAL_POS.localZ + Math.sin(arcAng) * arcRad;
    }

    // Keep the reserved Northern Plateau central glade open for future exploration
    if (lx >= 82.0 && lx <= 98.0 && lz >= 26.0 && lz <= 46.0) {
      continue;
    }

    // Keep the entire Forest Lake basin and its shoreline completely free of background trees
    const bgLakeDx = (lx - FOREST_LAKE_LOCAL_POS.localX) / 1.22;
    const bgLakeDz = (lz - FOREST_LAKE_LOCAL_POS.localZ) / 0.95;
    if (Math.hypot(bgLakeDx, bgLakeDz) < 16.0) {
      continue;
    }

    if (lx < 39.5) continue;
    const fProx = evaluateAncientForestLocalProximity(lx, lz);
    if (fProx.minDist < 12.2) continue;

    const w = castleLocalToWorld(lx, lz);
    const wy = getTerrainHeight(w.x, w.z);
    if (wy < 8.0) continue;

    const h = 9.5 + rand() * 6.5;
    const wScale = h * (0.78 + rand() * 0.34);
    _dummy.position.set(w.x, wy - 0.25, w.z);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.06,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.06,
    );
    _dummy.scale.set(wScale, h, wScale);
    _dummy.updateMatrix();

    bgTrunkInst.setMatrixAt(bgPlaced, _dummy.matrix);
    bgCanopyInst.setMatrixAt(bgPlaced, _dummy.matrix);

    const depthFactor = THREE.MathUtils.clamp((distOut - 13.5) / 12.5, 0, 1);
    _col.lerpColors(cBgNear, cBgDistant, depthFactor);
    bgCanopyInst.setColorAt(bgPlaced, _col);

    bgPlaced++;
  }

  bgTrunkInst.count = bgPlaced;
  bgCanopyInst.count = bgPlaced;
  bgTrunkInst.instanceMatrix.needsUpdate = true;
  bgCanopyInst.instanceMatrix.needsUpdate = true;
  if (bgCanopyInst.instanceColor) bgCanopyInst.instanceColor.needsUpdate = true;
  group.add(bgTrunkInst, bgCanopyInst);

  return {
    group,
    colliders,
    heroTreeCount: heroSpecs.length,
    midgroundTreeCount: midPlacements.length,
    backgroundTreeCount: bgPlaced,
    giantTreeCount: 1,

    update(elapsedTime: number): void {
      // Subtle wind breathing on the Giant Ancient Tree upper canopy & hanging vines
      giantVineMesh.rotation.z = Math.sin(elapsedTime * 1.15) * 0.014;
      giantSunlitMesh.rotation.y = Math.sin(elapsedTime * 0.45) * 0.008;
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
