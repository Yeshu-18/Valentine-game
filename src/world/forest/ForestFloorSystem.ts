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

export interface ForestFloorSystemBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Perturbs an IcosahedronGeometry organically for moss cushions, weathered boulders, and wild shrubs.
 */
function createOrganicClusterGeometry(
  rx: number,
  ry: number,
  rz: number,
  detail: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  const freq = 3.0 + (seed % 4) * 0.45;
  const phase = seed * 1.29;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.7 + phase) *
        Math.cos(vz * freq - vx * 2.1 - phase) *
        irregularity +
      Math.sin((vx + vz) * freq * 1.6 + phase) * (irregularity * 0.4);
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
 * Builds Phase F2's Multi-Layered Forest Floor & Understory System:
 * - Clustered placement with natural density variation: OPEN -> DENSE -> OPEN -> DENSE
 * - Preserves negative space in sun-dappled glades and winding exploration corridors
 * - LOW LAYER: Moss cushions, small woodland grasses, fallen leaves, twigs, ordinary small mushrooms
 * - MEDIUM LAYER: Woodland fern rosettes, restrained forest wildflowers, weathered embedded rocks
 * - HIGH LAYER: Wild forest bushes/shrubs, fallen mossy branches/logs, exposed surface roots
 */
export function createForestFloorSystem(): ForestFloorSystemBundle {
  const group = new THREE.Group();
  group.name = 'PhaseF2_ForestFloorAndUnderstory';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED + 2201);

  const _dummy = new THREE.Object3D();
  const _col = new THREE.Color();

  // ============================================================================
  // 1. DETERMINISTIC CLUSTER CENTERS (OPEN -> DENSE -> OPEN -> DENSE)
  //    Defines 22 rich understory cluster hubs while keeping glades (f ~ 0.33, 0.67)
  //    and the winding footpath open with negative space.
  // ============================================================================
  interface UnderstoryCluster {
    localX: number;
    localZ: number;
    wx: number;
    wz: number;
    radius: number;
    density: number; // 0.35 (light edge) .. 1.0 (dense thicket pocket)
  }

  const clusters: UnderstoryCluster[] = [];
  const segCount = ANCIENT_FOREST_LOCAL_POINTS.length - 1;

  for (let i = 0; i < 24; i++) {
    const prog = (i + 0.35) / 24;
    const segIdx = Math.min(segCount - 1, Math.floor(prog * segCount));
    const segT = prog * segCount - segIdx;
    const pA = ANCIENT_FOREST_LOCAL_POINTS[segIdx];
    const pB = ANCIENT_FOREST_LOCAL_POINTS[segIdx + 1];

    const abx = pB.localX - pA.localX;
    const abz = pB.localZ - pA.localZ;
    const len = Math.hypot(abx, abz) || 1;
    const side = i % 2 === 0 ? 1 : -1;

    // Alternating OPEN -> DENSE -> OPEN -> DENSE rhythm along the route
    const isGladeZone =
      Math.abs(prog - 0.33) < 0.08 || Math.abs(prog - 0.67) < 0.08;
    const latOffset = isGladeZone
      ? 6.4 + rand() * 5.2
      : 3.1 + rand() * 6.8;

    const lx =
      THREE.MathUtils.lerp(pA.localX, pB.localX, segT) +
      (-abz / len) * side * latOffset +
      (rand() - 0.5) * 2.2;
    const lz =
      THREE.MathUtils.lerp(pA.localZ, pB.localZ, segT) +
      (abx / len) * side * latOffset +
      (rand() - 0.5) * 2.2;

    const w = castleLocalToWorld(lx, lz);
    clusters.push({
      localX: lx,
      localZ: lz,
      wx: w.x,
      wz: w.z,
      radius: 3.2 + rand() * 2.8,
      density: isGladeZone ? 0.45 : 0.78 + rand() * 0.22,
    });
  }

  /**
   * Samples a clustered world position near one of the 24 understory hubs,
   * guaranteeing natural clumping and preserving open negative space on the main trail.
   */
  function sampleClusteredPoint(
    minTrailClearance: number,
    spreadMultiplier = 1.0,
  ): { wx: number; wy: number; wz: number; prog: number } | null {
    for (let attempt = 0; attempt < 18; attempt++) {
      const c = clusters[Math.floor(rand() * clusters.length)];
      const ang = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.72) * c.radius * spreadMultiplier;
      const lx = c.localX + Math.cos(ang) * r;
      const lz = c.localZ + Math.sin(ang) * r;

      if (lx < 40.4) continue;
      const fProx = evaluateAncientForestLocalProximity(lx, lz);
      if (fProx.minDist < minTrailClearance) continue;

      // Keep the immediate front hollow of the Giant Ancient Tree clear for sightlines
      const dGiant = Math.hypot(
        lx - GIANT_ANCIENT_TREE_LOCAL_POS.localX,
        lz - GIANT_ANCIENT_TREE_LOCAL_POS.localZ,
      );
      if (dGiant < 2.9) continue;

      // Keep the entire Forest Lake basin and its shoreline clear of floor bushes, logs, rocks & grass
      const lakeDx = (lx - FOREST_LAKE_LOCAL_POS.localX) / 1.22;
      const lakeDz = (lz - FOREST_LAKE_LOCAL_POS.localZ) / 0.95;
      if (Math.hypot(lakeDx, lakeDz) < 12.8) continue;

      const w = castleLocalToWorld(lx, lz);
      const wy = getTerrainHeight(w.x, w.z);
      return { wx: w.x, wy, wz: w.z, prog: fProx.normalizedProgress };
    }
    return null;
  }

  // ============================================================================
  // 2. LOW LAYER: MOSS CUSHIONS, SMALL GRASSES, FALLEN LEAVES, TWIGS & MUSHROOMS
  // ============================================================================

  // 2A. Velvet Moss Cushions (140 Instances)
  const mossCushionGeo = tracker.trackGeo(
    createOrganicClusterGeometry(0.42, 0.11, 0.38, 1, 0.24, 2210),
  );
  const mossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  const mossCount = 140;
  const mossInst = new THREE.InstancedMesh(mossCushionGeo, mossMat, mossCount);
  mossInst.receiveShadow = true;
  const cMossDeep = new THREE.Color('#34542b');
  const cMossOlive = new THREE.Color('#4a6e38');

  let mossPlaced = 0;
  for (let i = 0; i < mossCount; i++) {
    const pt = sampleClusteredPoint(1.25, 1.15);
    if (!pt) continue;
    const s = 0.65 + rand() * 1.15;
    _dummy.position.set(pt.wx, pt.wy - 0.02, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.14,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.14,
    );
    _dummy.scale.set(s, s * (0.7 + rand() * 0.5), s * (0.85 + rand() * 0.3));
    _dummy.updateMatrix();
    mossInst.setMatrixAt(mossPlaced, _dummy.matrix);
    _col.lerpColors(cMossDeep, cMossOlive, rand());
    mossInst.setColorAt(mossPlaced, _col);
    mossPlaced++;
  }
  mossInst.count = mossPlaced;
  mossInst.instanceMatrix.needsUpdate = true;
  if (mossInst.instanceColor) mossInst.instanceColor.needsUpdate = true;
  group.add(mossInst);

  // 2B. Small Woodland Grasses & Sedge Tufts (180 Instances)
  const grassBladeGeo = new THREE.ConeGeometry(0.048, 0.38, 4);
  grassBladeGeo.scale(1.0, 1.0, 0.3);
  grassBladeGeo.translate(0, 0.19, 0);
  const grassTuftGeo = tracker.trackGeo(
    mergeGeometries(
      [0, 1, 2, 3, 4].map((bIdx) => {
        const g = grassBladeGeo.clone();
        g.rotateX((bIdx % 2 === 0 ? 1 : -1) * 0.26);
        g.rotateY((bIdx * Math.PI * 2) / 5);
        g.translate(Math.cos(bIdx) * 0.05, 0, Math.sin(bIdx) * 0.05);
        return g;
      }),
    ),
  );
  grassBladeGeo.dispose();

  const grassMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.82,
    }),
  );
  const grassCount = 180;
  const grassInst = new THREE.InstancedMesh(grassTuftGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;
  const cGrassShade = new THREE.Color('#385e33');
  const cGrassSun = new THREE.Color('#55793e');

  let grassPlaced = 0;
  for (let i = 0; i < grassCount; i++) {
    const pt = sampleClusteredPoint(1.35, 1.25);
    if (!pt) continue;
    const s = 0.65 + rand() * 0.85;
    _dummy.position.set(pt.wx, pt.wy - 0.02, pt.wz);
    _dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    _dummy.scale.set(s, s * (0.75 + rand() * 0.55), s);
    _dummy.updateMatrix();
    grassInst.setMatrixAt(grassPlaced, _dummy.matrix);
    _col.lerpColors(cGrassShade, cGrassSun, rand());
    grassInst.setColorAt(grassPlaced, _col);
    grassPlaced++;
  }
  grassInst.count = grassPlaced;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  group.add(grassInst);

  // 2C. Fallen Leaves & Woodland Litter Scatter (160 Instances)
  const leafPatchGeo = (() => {
    const leaves: THREE.BufferGeometry[] = [];
    for (let l = 0; l < 4; l++) {
      const d = new THREE.CircleGeometry(0.085, 5).toNonIndexed();
      d.scale(1.35, 0.85, 1.0);
      d.rotateX(-Math.PI / 2 + (l % 2 === 0 ? 0.08 : -0.08));
      d.rotateY((l * Math.PI) / 2 + 0.3);
      d.translate(
        Math.cos(l * 1.6) * 0.14,
        0.015 + l * 0.003,
        Math.sin(l * 1.6) * 0.14,
      );
      leaves.push(d);
    }
    const merged = tracker.trackGeo(mergeGeometries(leaves));
    leaves.forEach((g) => g.dispose());
    return merged;
  })();

  const fallenLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),
  );
  const leafPatchCount = 160;
  const leafPatchInst = new THREE.InstancedMesh(
    leafPatchGeo,
    fallenLeafMat,
    leafPatchCount,
  );
  leafPatchInst.receiveShadow = true;
  const cLeafRusset = new THREE.Color('#7c4d2b');
  const cLeafOchre = new THREE.Color('#9c6b34');
  const cLeafOlive = new THREE.Color('#5c532c');

  let leafPlaced = 0;
  for (let i = 0; i < leafPatchCount; i++) {
    // Fallen leaves also lightly scatter across the trail edges
    const pt = sampleClusteredPoint(0.45, 1.35);
    if (!pt) continue;
    const s = 0.75 + rand() * 0.95;
    _dummy.position.set(pt.wx, pt.wy + 0.01, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.1,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.1,
    );
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    leafPatchInst.setMatrixAt(leafPlaced, _dummy.matrix);

    const pick = rand();
    if (pick < 0.45) _col.copy(cLeafRusset);
    else if (pick < 0.8) _col.copy(cLeafOchre);
    else _col.copy(cLeafOlive);
    leafPatchInst.setColorAt(leafPlaced, _col);
    leafPlaced++;
  }
  leafPatchInst.count = leafPlaced;
  leafPatchInst.instanceMatrix.needsUpdate = true;
  if (leafPatchInst.instanceColor) leafPatchInst.instanceColor.needsUpdate = true;
  group.add(leafPatchInst);

  // 2D. Fallen Woodland Twigs (75 Instances)
  const twigClusterGeo = (() => {
    const t1 = new THREE.CylinderGeometry(0.01, 0.016, 0.52, 5);
    t1.rotateZ(Math.PI / 2 - 0.08);
    t1.translate(0, 0.02, 0);
    const t2 = new THREE.CylinderGeometry(0.008, 0.013, 0.34, 5);
    t2.rotateZ(Math.PI / 2 + 0.12);
    t2.rotateY(0.65);
    t2.translate(0.08, 0.02, 0.06);
    const merged = tracker.trackGeo(mergeGeometries([t1, t2]));
    t1.dispose();
    t2.dispose();
    return merged;
  })();

  const darkWoodMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3828'),
      roughness: 0.9,
    }),
  );
  const twigCount = 75;
  const twigInst = new THREE.InstancedMesh(
    twigClusterGeo,
    darkWoodMat,
    twigCount,
  );
  let twigPlaced = 0;
  for (let i = 0; i < twigCount; i++) {
    const pt = sampleClusteredPoint(0.85, 1.2);
    if (!pt) continue;
    const s = 0.75 + rand() * 0.8;
    _dummy.position.set(pt.wx, pt.wy + 0.01, pt.wz);
    _dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    twigInst.setMatrixAt(twigPlaced, _dummy.matrix);
    twigPlaced++;
  }
  twigInst.count = twigPlaced;
  twigInst.instanceMatrix.needsUpdate = true;
  group.add(twigInst);

  // 2E. Ordinary Small Forest Mushrooms (48 Clustered Trio Instances)
  const smallMushroomTrioGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    const offsets = [
      [0, 0, 1.0],
      [0.07, 0.05, 0.72],
      [-0.06, 0.04, 0.58],
    ];
    offsets.forEach(([ox, oz, sc]) => {
      const stem = new THREE.CylinderGeometry(
        0.014 * sc,
        0.02 * sc,
        0.085 * sc,
        6,
      );
      stem.translate(ox, 0.042 * sc, oz);
      const cap = new THREE.ConeGeometry(0.052 * sc, 0.048 * sc, 7);
      cap.translate(ox, 0.095 * sc, oz);
      parts.push(stem, cap);
    });
    const merged = tracker.trackGeo(mergeGeometries(parts));
    parts.forEach((g) => g.dispose());
    return merged;
  })();

  const mushroomMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#966c44'),
      roughness: 0.78,
    }),
  );
  const mushroomCount = 48;
  const mushroomInst = new THREE.InstancedMesh(
    smallMushroomTrioGeo,
    mushroomMat,
    mushroomCount,
  );
  let mushroomPlaced = 0;
  for (let i = 0; i < mushroomCount; i++) {
    const pt = sampleClusteredPoint(1.6, 0.9);
    if (!pt) continue;
    const s = 0.8 + rand() * 0.75;
    _dummy.position.set(pt.wx, pt.wy - 0.01, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.12,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.12,
    );
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    mushroomInst.setMatrixAt(mushroomPlaced, _dummy.matrix);
    mushroomPlaced++;
  }
  mushroomInst.count = mushroomPlaced;
  mushroomInst.instanceMatrix.needsUpdate = true;
  group.add(mushroomInst);

  // ============================================================================
  // 3. MEDIUM LAYER: WOODLAND FERNS, RESTRAINED WILDFLOWERS & WEATHERED ROCKS
  // ============================================================================

  // 3A. Woodland Fern Rosettes (135 Instances)
  const fernRosetteGeo = (() => {
    const fronds: THREE.BufferGeometry[] = [];
    const frondCount = 7;
    for (let f = 0; f < frondCount; f++) {
      const ang = (f / frondCount) * Math.PI * 2;
      const blade = new THREE.ConeGeometry(0.11, 0.58, 4);
      blade.scale(1.0, 1.0, 0.24);
      blade.translate(0, 0.29, 0);
      blade.rotateX(0.68 + (f % 2) * 0.14);
      blade.rotateY(ang);
      fronds.push(blade);
    }
    const merged = tracker.trackGeo(mergeGeometries(fronds));
    fronds.forEach((g) => g.dispose());
    return merged;
  })();

  const fernMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.74,
      side: THREE.DoubleSide,
    }),
  );
  const fernCount = 135;
  const fernInst = new THREE.InstancedMesh(fernRosetteGeo, fernMat, fernCount);
  fernInst.castShadow = true;
  fernInst.receiveShadow = true;
  const cFernDeep = new THREE.Color('#315833');
  const cFernBright = new THREE.Color('#4c7c42');

  let fernPlaced = 0;
  for (let i = 0; i < fernCount; i++) {
    const pt = sampleClusteredPoint(1.55, 1.1);
    if (!pt) continue;
    const s = 0.75 + rand() * 0.85;
    _dummy.position.set(pt.wx, pt.wy - 0.03, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.12,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.12,
    );
    _dummy.scale.set(s, s * (0.85 + rand() * 0.35), s);
    _dummy.updateMatrix();
    fernInst.setMatrixAt(fernPlaced, _dummy.matrix);
    _col.lerpColors(cFernDeep, cFernBright, rand());
    fernInst.setColorAt(fernPlaced, _col);
    fernPlaced++;
  }
  fernInst.count = fernPlaced;
  fernInst.instanceMatrix.needsUpdate = true;
  if (fernInst.instanceColor) fernInst.instanceColor.needsUpdate = true;
  group.add(fernInst);

  // 3B. Restrained Woodland Wildflowers / Forest Bluebells (52 Instances)
  const wildflowerClumpGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 3; s++) {
      const ang = (s * Math.PI * 2) / 3 + 0.3;
      const ox = Math.cos(ang) * 0.09;
      const oz = Math.sin(ang) * 0.09;
      const stem = new THREE.CylinderGeometry(0.008, 0.012, 0.32, 5).toNonIndexed();
      stem.translate(ox, 0.16, oz);
      const blossom = new THREE.DodecahedronGeometry(0.038, 0);
      blossom.translate(ox, 0.33, oz);
      parts.push(stem, blossom);
    }
    // Development diagnostic comparing all geometry attributes before merge
    if (typeof console !== 'undefined' && console.log) {
      parts.forEach((g, idx) => {
        console.log(`[Diagnostic] geometry[${idx}]`, {
          type: g.type,
          index: g.index !== null ? `exists (count=${g.index.count}, itemSize=${g.index.itemSize})` : null,
          attributes: Object.keys(g.attributes),
          position: g.attributes.position ? { count: g.attributes.position.count, itemSize: g.attributes.position.itemSize } : null,
          normal: g.attributes.normal ? { count: g.attributes.normal.count, itemSize: g.attributes.normal.itemSize } : null,
          uv: g.attributes.uv ? { count: g.attributes.uv.count, itemSize: g.attributes.uv.itemSize } : null,
          color: g.attributes.color ? { count: g.attributes.color.count, itemSize: g.attributes.color.itemSize } : 'absent',
          tangent: g.attributes.tangent ? 'present' : 'absent',
          morphAttributes: Object.keys(g.morphAttributes),
        });
      });
    }

    const merged = tracker.trackGeo(mergeGeometries(parts));
    parts.forEach((g) => g.dispose());
    return merged;
  })();

  const wildflowerMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.65,
    }),
  );
  const flowerCount = 52;
  const flowerInst = new THREE.InstancedMesh(
    wildflowerClumpGeo,
    wildflowerMat,
    flowerCount,
  );
  const cBluebell = new THREE.Color('#7c8cc4');
  const cWoodAnemone = new THREE.Color('#dcd8c8');

  let flowerPlaced = 0;
  for (let i = 0; i < flowerCount; i++) {
    const pt = sampleClusteredPoint(1.65, 1.0);
    if (!pt) continue;
    const s = 0.8 + rand() * 0.55;
    _dummy.position.set(pt.wx, pt.wy - 0.02, pt.wz);
    _dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    flowerInst.setMatrixAt(flowerPlaced, _dummy.matrix);
    _col.lerpColors(cBluebell, cWoodAnemone, rand() > 0.5 ? 1 : 0);
    flowerInst.setColorAt(flowerPlaced, _col);
    flowerPlaced++;
  }
  flowerInst.count = flowerPlaced;
  flowerInst.instanceMatrix.needsUpdate = true;
  if (flowerInst.instanceColor) flowerInst.instanceColor.needsUpdate = true;
  group.add(flowerInst);

  // 3C. Weathered Partially-Embedded Forest Rocks (68 Instances)
  const forestRockGeo = tracker.trackGeo(
    createOrganicClusterGeometry(0.46, 0.28, 0.42, 1, 0.26, 2260),
  );
  const forestRockMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.92,
      metalness: 0.03,
    }),
  );
  const rockCount = 68;
  const rockInst = new THREE.InstancedMesh(
    forestRockGeo,
    forestRockMat,
    rockCount,
  );
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  const cSlateDark = new THREE.Color('#57534e');
  const cMossyStone = new THREE.Color('#525e4a');

  let rockPlaced = 0;
  for (let i = 0; i < rockCount; i++) {
    const pt = sampleClusteredPoint(1.9, 1.25);
    if (!pt) continue;
    const sx = 0.55 + rand() * 1.35;
    const sy = 0.48 + rand() * 0.95;
    const sz = 0.55 + rand() * 1.35;
    // Partially embed into the terrain (-0.08m) so no rock ever floats
    _dummy.position.set(pt.wx, pt.wy - 0.06, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.35,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.35,
    );
    _dummy.scale.set(sx, sy, sz);
    _dummy.updateMatrix();
    rockInst.setMatrixAt(rockPlaced, _dummy.matrix);
    _col.lerpColors(cSlateDark, cMossyStone, rand());
    rockInst.setColorAt(rockPlaced, _col);
    rockPlaced++;
  }
  rockInst.count = rockPlaced;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  group.add(rockInst);

  // ============================================================================
  // 4. HIGH UNDERSTORY LAYER: WILD BUSHES/SHRUBS, FALLEN BRANCHES & SURFACE ROOTS
  // ============================================================================

  // 4A. Wild Forest Bushes & Understory Shrubs (74 Instances)
  const wildShrubGeo = (() => {
    const p1 = createOrganicClusterGeometry(0.58, 0.42, 0.54, 1, 0.24, 2301);
    p1.translate(0, 0.36, 0);
    const p2 = createOrganicClusterGeometry(0.44, 0.36, 0.42, 1, 0.24, 2302);
    p2.translate(0.28, 0.32, 0.16);
    const p3 = createOrganicClusterGeometry(0.42, 0.34, 0.4, 1, 0.24, 2303);
    p3.translate(-0.26, 0.3, -0.14);
    const merged = tracker.trackGeo(mergeGeometries([p1, p2, p3]));
    [p1, p2, p3].forEach((g) => g.dispose());
    return merged;
  })();

  const shrubMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.78,
    }),
  );
  const shrubCount = 74;
  const shrubInst = new THREE.InstancedMesh(wildShrubGeo, shrubMat, shrubCount);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;
  const cShrubDark = new THREE.Color('#1f3d23');
  const cShrubMid = new THREE.Color('#2f522c');

  let shrubPlaced = 0;
  for (let i = 0; i < shrubCount; i++) {
    const pt = sampleClusteredPoint(2.35, 1.2);
    if (!pt) continue;
    const s = 0.75 + rand() * 0.95;
    _dummy.position.set(pt.wx, pt.wy - 0.05, pt.wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.1,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.1,
    );
    _dummy.scale.set(s, s * (0.8 + rand() * 0.45), s);
    _dummy.updateMatrix();
    shrubInst.setMatrixAt(shrubPlaced, _dummy.matrix);
    _col.lerpColors(cShrubDark, cShrubMid, rand());
    shrubInst.setColorAt(shrubPlaced, _col);
    shrubPlaced++;
  }
  shrubInst.count = shrubPlaced;
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  group.add(shrubInst);

  // 4B. Fallen Mossy Branches, Nurse Logs & Sprawling Surface Roots (38 Instances)
  const fallenLogGeo = (() => {
    const log = new THREE.CylinderGeometry(0.14, 0.19, 2.35, 8);
    log.rotateZ(Math.PI / 2);
    log.translate(0, 0.12, 0);
    const branchStub = new THREE.CylinderGeometry(0.05, 0.09, 0.68, 6);
    branchStub.rotateZ(0.65);
    branchStub.rotateX(0.35);
    branchStub.translate(0.35, 0.28, 0.12);
    const merged = tracker.trackGeo(mergeGeometries([log, branchStub]));
    log.dispose();
    branchStub.dispose();
    return merged;
  })();

  const logCount = 38;
  const logInst = new THREE.InstancedMesh(fallenLogGeo, darkWoodMat, logCount);
  logInst.castShadow = true;
  logInst.receiveShadow = true;

  let logPlaced = 0;
  for (let i = 0; i < logCount; i++) {
    const pt = sampleClusteredPoint(2.55, 1.15);
    if (!pt) continue;
    const s = 0.7 + rand() * 0.75;
    const yaw = rand() * Math.PI * 2;
    _dummy.position.set(pt.wx, pt.wy - 0.04, pt.wz);
    _dummy.rotation.set((rand() - 0.5) * 0.12, yaw, (rand() - 0.5) * 0.12);
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    logInst.setMatrixAt(logPlaced, _dummy.matrix);
    logPlaced++;
  }
  logInst.count = logPlaced;
  logInst.instanceMatrix.needsUpdate = true;
  group.add(logInst);

  return {
    group,
    colliders,

    update(_elapsedTime: number): void {
      // Static instanced floor layers require zero per-frame matrix uploads for 60 FPS performance
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
