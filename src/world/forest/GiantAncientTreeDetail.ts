/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker, createBeveledBoxGeometry } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  FOREST_SEED,
  GIANT_ANCIENT_TREE_LOCAL_POS,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';

export interface GiantAncientTreeDetailBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  treeWorldPos: THREE.Vector3;
  update: (dt: number, elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Creates an organic curved buttress root geometry tapering outward and plunging into the earth.
 */
function createButtressRootGeo(
  rBase: number,
  rTip: number,
  len: number,
  curveAng: number,
  seed: number,
): THREE.BufferGeometry {
  const segments = 10;
  const radialSegs = 8;
  const geo = new THREE.CylinderGeometry(rTip, rBase, len, radialSegs, segments);
  const pos = geo.attributes.position;
  const rand = mulberry32(seed);

  // Curve and flatten horizontally like natural tree buttresses
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const prog = (y + len * 0.5) / len; // 0.0 at base to 1.0 at tip
    const bend = Math.sin(prog * Math.PI * 0.5) * curveAng;
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Buttress flaring (narrower sideways, taller vertically)
    pos.setXYZ(i, (x + bend) * 0.72, y, z * 1.35 + (rand() - 0.5) * 0.05);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds Phase F3 System 6: Giant Ancient Tree Detail Pass.
 * Enriches the 18–22m Giant Ancient Tree created in F2 with:
 * - Enormous crawling buttress roots clutching the knoll terrain
 * - Deep ancient hollow cavity opening with dark knotted rim
 * - Tiered shelf / bracket fungi stepping up the flared trunk
 * - Hanging canopy liana vines swaying gently
 * - Wild woodland ferns, moss cushions and fallen woodland debris circling the base
 * - Subtle floating woodland pollen motes
 */
export function createGiantAncientTreeDetail(): GiantAncientTreeDetailBundle {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'GiantAncientTreeDetail';
  const colliders: CircleCollider[] = [];

  const rand = mulberry32(FOREST_SEED + 6400);

  const treeWorld = castleLocalToWorld(
    GIANT_ANCIENT_TREE_LOCAL_POS.localX,
    GIANT_ANCIENT_TREE_LOCAL_POS.localZ,
  );
  const treeY = getTerrainHeight(treeWorld.x, treeWorld.z);
  const treeWorldPos = new THREE.Vector3(treeWorld.x, treeY, treeWorld.z);

  // Materials matching existing Ancient Forest palette
  const barkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38281d'),
      roughness: 0.94,
      metalness: 0.02,
    }),
  );

  const mossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d4022'),
      roughness: 0.96,
      metalness: 0.02,
    }),
  );

  const hollowDarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#120d09'),
      roughness: 0.98,
      metalness: 0.01,
    }),
  );

  const shelfFungiMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#78350f'), // Warm cedar bracket fungus
      roughness: 0.82,
      metalness: 0.04,
      emissive: new THREE.Color('#451a03'),
      emissiveIntensity: 0.12,
    }),
  );

  const vineMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#263d1a'),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const fernMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3f6212'),
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
  );

  const barkGeos: THREE.BufferGeometry[] = [];
  const mossGeos: THREE.BufferGeometry[] = [];
  const fungiGeos: THREE.BufferGeometry[] = [];
  const vineGeos: THREE.BufferGeometry[] = [];
  const fernGeos: THREE.BufferGeometry[] = [];

  // ============================================================================
  // 1. MASSIVE BUTTRESS ROOTS SNROLLING ACROSS THE KNOLL
  // ============================================================================
  // 6 sprawling roots extending 5.5m to 8.2m out from the trunk
  const rootAngles = [
    -0.2, // Toward the trail approach
    0.85, // East
    1.95, // Northeast
    3.05, // Northwest
    -2.15, // Southwest
    -1.15, // South
  ];

  rootAngles.forEach((ang, idx) => {
    const rootLen = 5.2 + (idx % 3) * 1.2 + rand() * 0.8;
    const rBase = 0.65 + (idx % 2) * 0.15;
    const rTip = 0.22;

    const rootGeo = createButtressRootGeo(rBase, rTip, rootLen, 0.45, 100 + idx);
    // Align with ground slope
    rootGeo.rotateX(Math.PI / 2 + 0.12);
    rootGeo.rotateY(ang);

    const midDist = rootLen * 0.48;
    const rx = treeWorldPos.x + Math.sin(ang) * midDist;
    const rz = treeWorldPos.z + Math.cos(ang) * midDist;
    const ry = getTerrainHeight(rx, rz);

    rootGeo.translate(rx, ry + rBase * 0.35, rz);
    barkGeos.push(rootGeo);

    // Moss coating along the top crest of the root
    const rootMoss = createButtressRootGeo(
      rBase * 0.75,
      rTip * 0.75,
      rootLen * 0.85,
      0.45,
      150 + idx,
    );
    rootMoss.rotateX(Math.PI / 2 + 0.12);
    rootMoss.rotateY(ang);
    rootMoss.translate(rx, ry + rBase * 0.62, rz);
    mossGeos.push(rootMoss);

    // Colliders for the root flares
    colliders.push({
      x: treeWorldPos.x + Math.sin(ang) * (midDist * 0.7),
      z: treeWorldPos.z + Math.cos(ang) * (midDist * 0.7),
      radius: rBase * 1.1,
    });
  });

  // ============================================================================
  // 2. HOLLOW CAVITY OPENING AT TRUNK BASE
  // ============================================================================
  // Visual hollow on the South-facing side (toward approaching player)
  // Arched opening: 1.6m wide, 2.4m tall, 1.8m deep
  const hollowAng = 0.0; // Facing straight South toward the incoming trail
  const hollowX = treeWorldPos.x + Math.sin(hollowAng) * 2.1;
  const hollowZ = treeWorldPos.z + Math.cos(hollowAng) * 2.1;
  const hollowY = getTerrainHeight(hollowX, hollowZ);

  // Arched dark cavity backing
  const cavityGeo = new THREE.CylinderGeometry(0.78, 0.95, 2.3, 12, 1, false, 0, Math.PI);
  cavityGeo.rotateY(Math.PI * 0.5);
  cavityGeo.translate(hollowX, hollowY + 1.15, hollowZ - 0.2);
  const cavityMesh = new THREE.Mesh(cavityGeo, hollowDarkMat);
  group.add(cavityMesh);

  // Knotted gnarled rim framing the hollow opening
  for (let k = 0; k < 6; k++) {
    const kAng = (k / 5) * Math.PI;
    const kx = hollowX + Math.cos(kAng) * 0.88;
    const ky = hollowY + 0.35 + Math.sin(kAng) * 1.8;
    const kz = hollowZ;

    const knot = new THREE.SphereGeometry(0.24, 7, 6);
    knot.scale(1.2, 0.8, 0.9);
    knot.translate(kx, ky, kz);
    barkGeos.push(knot);

    // Velvet moss along hollow threshold
    if (k <= 2 || k >= 4) {
      const hMoss = new THREE.SphereGeometry(0.22, 6, 5);
      hMoss.scale(1.1, 0.5, 0.9);
      hMoss.translate(kx, ky + 0.08, kz);
      mossGeos.push(hMoss);
    }
  }

  // ============================================================================
  // 3. TIERED SHELF / BRACKET FUNGI STEPPING UP THE TRUNK
  // ============================================================================
  // 14 bracket mushrooms stepping up East & North trunk sides between 1.2m and 4.8m height
  for (let f = 0; f < 14; f++) {
    const fAng = 0.75 + (f * 0.28) + (rand() - 0.5) * 0.15;
    const fHeight = 1.2 + (f / 14) * 3.6;
    const fRad = 2.15 - (fHeight / 20.0) * 0.6; // Hugging trunk taper

    const fx = treeWorldPos.x + Math.sin(fAng) * fRad;
    const fz = treeWorldPos.z + Math.cos(fAng) * fRad;
    const fy = treeWorldPos.y + fHeight;

    const fScale = 0.32 + (1.0 - f / 18) * 0.28;
    // Semicircular fan shelf
    const shelf = new THREE.CylinderGeometry(
      fScale,
      fScale * 0.85,
      0.065 * fScale,
      8,
      1,
      false,
      0,
      Math.PI,
    );
    shelf.rotateY(fAng + Math.PI);
    shelf.rotateX((rand() - 0.5) * 0.12);
    shelf.translate(fx, fy, fz);
    fungiGeos.push(shelf);
  }

  // ============================================================================
  // 4. HANGING CANOPY LIANA VINES
  // ============================================================================
  // 10 long vines draping down from the lower branches (heights 8m to 14m)
  for (let v = 0; v < 10; v++) {
    const vAng = (v / 10) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const vRad = 2.8 + (v % 3) * 0.85;
    const vLen = 5.2 + rand() * 4.2;
    const topH = 11.5 + (v % 4) * 1.5;

    const vx = treeWorldPos.x + Math.sin(vAng) * vRad;
    const vz = treeWorldPos.z + Math.cos(vAng) * vRad;
    const vy = treeWorldPos.y + topH - vLen * 0.5;

    const vine = new THREE.CylinderGeometry(0.038, 0.024, vLen, 6);
    // Subtle organic wavy sway in geometry
    const pos = vine.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const wave = Math.sin((y / vLen) * Math.PI * 2.5) * 0.14;
      pos.setX(i, pos.getX(i) + wave);
    }
    vine.translate(vx, vy, vz);
    vineGeos.push(vine);
  }

  // ============================================================================
  // 5. WILD WOODLAND FERNS & DEBRIS AROUND THE BASE
  // ============================================================================
  for (let fe = 0; fe < 18; fe++) {
    const feAng = rand() * Math.PI * 2;
    const feRad = 3.2 + rand() * 3.4;
    const fex = treeWorldPos.x + Math.sin(feAng) * feRad;
    const fez = treeWorldPos.z + Math.cos(feAng) * feRad;
    const fey = getTerrainHeight(fex, fez);

    // 4 Fern fronds per plant
    for (let fr = 0; fr < 4; fr++) {
      const frondAng = feAng + (fr / 4) * Math.PI * 2;
      const frond = new THREE.PlaneGeometry(0.35, 1.1, 2, 4);
      frond.rotateX(Math.PI * 0.32);
      frond.rotateY(frondAng);
      frond.translate(fex, fey + 0.32, fez);
      fernGeos.push(frond);
    }
  }

  // Floating woodland pollen motes around the hollow opening (18 points)
  const pollenCount = 18;
  const pollenPositions = new Float32Array(pollenCount * 3);
  const pollenBase: Array<{ x: number; y: number; z: number; phase: number; radius: number }> = [];

  for (let p = 0; p < pollenCount; p++) {
    const px = hollowX + (rand() - 0.5) * 1.8;
    const pz = hollowZ + (rand() - 0.5) * 1.4;
    const py = hollowY + 0.4 + rand() * 1.8;
    pollenPositions[p * 3] = px;
    pollenPositions[p * 3 + 1] = py;
    pollenPositions[p * 3 + 2] = pz;
    pollenBase.push({
      x: px,
      y: py,
      z: pz,
      phase: rand() * Math.PI * 2,
      radius: 0.15 + rand() * 0.25,
    });
  }

  const pollenGeo = tracker.trackGeo(new THREE.BufferGeometry());
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
  const pollenMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#fde68a'),
      size: 0.08,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const pollenPoints = new THREE.Points(pollenGeo, pollenMat);
  group.add(pollenPoints);

  // Merge Geometries
  if (barkGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(barkGeos));
    barkGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, barkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (mossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(mossGeos));
    mossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (fungiGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(fungiGeos));
    fungiGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, shelfFungiMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (vineGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(vineGeos));
    vineGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, vineMat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  if (fernGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(fernGeos));
    fernGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, fernMat);
    group.add(mesh);
  }

  return {
    group,
    colliders,
    treeWorldPos,

    update(_dt: number, elapsedTime: number): void {
      // Animate gentle drifting pollen near the hollow
      const posAttr = pollenGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let p = 0; p < pollenCount; p++) {
        const b = pollenBase[p];
        const a = elapsedTime * 0.42 + b.phase;
        posAttr.setXYZ(
          p,
          b.x + Math.cos(a) * b.radius,
          b.y + Math.sin(elapsedTime * 0.75 + b.phase) * 0.16,
          b.z + Math.sin(a) * b.radius,
        );
      }
      posAttr.needsUpdate = true;
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
