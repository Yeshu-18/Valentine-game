import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { DreamCastleMaterials } from './CastleMaterials';

export type HeartTreeVariant = 'pink' | 'lavender' | 'golden' | 'dream';

export interface HeartTreePlacement {
  x?: number;
  lx?: number;
  y: number;
  z?: number;
  lz?: number;
  scale: number;
  rotY: number;
  variant: HeartTreeVariant;
  skipCollider?: boolean;
  /**
   * Group role for progressive awakening in the Grand Castle Entrance cinematic:
   * - 'entrance_primary': First Heart Tree to awaken (left entrance tree)
   * - 'entrance_secondary': Second Heart Tree to awaken (right entrance tree)
   * - 'ambient': Garden, pathway, courtyard, balcony, and tabletop Heart Trees
   */
  awakeningRole?: 'entrance_primary' | 'entrance_secondary' | 'ambient';
}

export interface CastleHeartTreesBundle {
  group: THREE.Group;
  localColliders: Array<{ lx: number; lz: number; radius: number }>;
  /**
   * Updates gentle branch/canopy sway, lantern pendulum motion, drifting petals,
   * and progressive awakening glow with zero per-frame allocations.
   */
  update: (
    delta: number,
    clockTime: number,
    primaryAwake: number,
    secondaryAwake: number,
    ambientAwake: number,
  ) => void;
  /**
   * Creates a miniature or standalone Heart Tree group reusing the shared geometries
   * and materials (used for Tabletop Castle & Little Dream World).
   */
  createStandaloneHeartTree: (
    variant: HeartTreeVariant,
    scale: number,
    rotY?: number,
  ) => THREE.Group;
}

interface VariantMaterials {
  canopyPrimary: THREE.MeshStandardMaterial;
  canopySecondary: THREE.MeshStandardMaterial;
  blossomMat: THREE.MeshStandardMaterial;
  heartLeafMat: THREE.MeshStandardMaterial;
  lanternGlowMat: THREE.MeshStandardMaterial;
  petalMat: THREE.MeshBasicMaterial;
}

interface AnimatedTreeInstance {
  root: THREE.Group;
  canopyGroup: THREE.Group;
  lanternPivots: THREE.Group[];
  petalMeshes: THREE.Mesh[];
  petalPhaseOffsets: number[];
  baseScale: number;
  phaseOffset: number;
  variant: HeartTreeVariant;
  role: 'entrance_primary' | 'entrance_secondary' | 'ambient';
}

/**
 * Builds the signature romantic 3D Heart-Shaped Trees ("Heart Trees") for the
 * Pastel Dream Castle, Approach Avenue, Courtyards, Balconies, and Love Gardens.
 *
 * Design Principles (Sections 3–8):
 * - Organic curved trunk + visible branching limbs
 * - True 3D sculpted heart-shaped canopy volume (multi-cluster 3D heart silhouette,
 *   readable from every angle, never a flat 2D cutout or solid primitive block)
 * - Small blossom clusters & subtle heart-shaped leaves/flowers used sparingly
 * - Hanging warm crystal lanterns suspended from the lower heart lobes
 * - Gentle wind sway, drifting petals, and progressive awakening illumination
 */
export function createCastleHeartTrees(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
   placements: readonly HeartTreePlacement[],
): CastleHeartTreesBundle {
  const group = new THREE.Group();
  group.name = 'CastleHeartTrees';

  // ============================================================================
  // 1. SHARED ORGANIC TRUNK & BRANCH GEOMETRIES
  // ============================================================================
  const trunkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: '#6d4c41',
      emissive: '#3e2723',
      emissiveIntensity: 0.1,
      roughness: 0.72,
      metalness: 0.08,
    }),
  );

  // Graceful S-curved main trunk rising from root flare (y=0) to heart cleft (y=2.35)
  const mainTrunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(0.08, 0.65, -0.04),
    new THREE.Vector3(-0.07, 1.38, 0.05),
    new THREE.Vector3(0.03, 1.95, 0.0),
    new THREE.Vector3(0.0, 2.38, 0.0),
  ]);
  const mainTrunkGeo = tracker.trackGeo(
    new THREE.TubeGeometry(mainTrunkCurve, 14, 0.16, 8, false),
  );

  // Sculpted root flare base for grounded botanical realism
  const rootFlareGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.32, 0.48, 8),
  );
  rootFlareGeo.translate(0, 0.24, 0);

  // Left and Right primary curved limbs branching into the two upper heart lobes
  const leftBranchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 1.88, 0.0),
    new THREE.Vector3(-0.38, 2.32, 0.06),
    new THREE.Vector3(-0.78, 2.86, -0.04),
    new THREE.Vector3(-0.98, 3.32, 0.02),
  ]);
  const leftBranchGeo = tracker.trackGeo(
    new THREE.TubeGeometry(leftBranchCurve, 10, 0.085, 7, false),
  );

  const rightBranchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 1.88, 0.0),
    new THREE.Vector3(0.38, 2.32, -0.05),
    new THREE.Vector3(0.78, 2.86, 0.05),
    new THREE.Vector3(0.98, 3.32, -0.02),
  ]);
  const rightBranchGeo = tracker.trackGeo(
    new THREE.TubeGeometry(rightBranchCurve, 10, 0.085, 7, false),
  );

  // Forward/Back depth branch for 3D silhouette fullness
  const depthBranchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 2.02, 0.0),
    new THREE.Vector3(0.04, 2.52, 0.34),
    new THREE.Vector3(-0.04, 2.95, -0.34),
  ]);
  const depthBranchGeo = tracker.trackGeo(
    new THREE.TubeGeometry(depthBranchCurve, 8, 0.065, 6, false),
  );

  // ============================================================================
  // 2. SHARED 3D HEART CANOPY, BLOSSOM, HEART-LEAF & LANTERN GEOMETRIES
  // ============================================================================
  // Soft organic foliage cluster sphere (non-faceted soft icosahedron)
  const foliageClusterGeo = tracker.trackGeo(
    new THREE.IcosahedronGeometry(0.55, 2),
  );

  // Blossom cluster geometry
  const blossomClusterGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.12, 1),
  );

  // Subtle 3D heart-shaped leaf/flower accent (used sparingly per Section 4)
  const miniHeartShape = new THREE.Shape();
  miniHeartShape.moveTo(0, -0.07);
  miniHeartShape.bezierCurveTo(-0.09, -0.01, -0.1, 0.08, -0.045, 0.095);
  miniHeartShape.bezierCurveTo(-0.01, 0.105, 0, 0.07, 0, 0.05);
  miniHeartShape.bezierCurveTo(0, 0.07, 0.01, 0.105, 0.045, 0.095);
  miniHeartShape.bezierCurveTo(0.1, 0.08, 0.09, -0.01, 0, -0.07);
  const heartLeafGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(miniHeartShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.006,
      bevelThickness: 0.006,
    }),
  );
  heartLeafGeo.center();

  // Hanging lantern geometries (cord + gold cap + warm glowing crystal bulb)
  const lanternCordGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6),
  );
  lanternCordGeo.translate(0, -0.21, 0);
  const lanternCapGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.075, 0.065, 8),
  );
  lanternCapGeo.translate(0, -0.42, 0);
  const lanternGlobeGeo = tracker.trackGeo(
    new THREE.OctahedronGeometry(0.072, 1),
  );
  lanternGlobeGeo.translate(0, -0.49, 0);

  // Drifting petal geometry
  const petalGeo = tracker.trackGeo(new THREE.CircleGeometry(0.045, 6));
  petalGeo.scale(1.35, 0.85, 1.0);

  // ============================================================================
  // 3. FOUR COLOUR VARIANT MATERIALS (Section 5)
  // ============================================================================
  const createVariantMaterials = (
    primaryColor: string,
    primaryEmissive: string,
    secondaryColor: string,
    secondaryEmissive: string,
    blossomColor: string,
    blossomEmissive: string,
    leafColor: string,
    lanternColor: string,
    petalColor: string,
  ): VariantMaterials => ({
    canopyPrimary: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryEmissive,
        emissiveIntensity: 0.24,
        roughness: 0.52,
        metalness: 0.04,
      }),
    ),
    canopySecondary: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: secondaryColor,
        emissive: secondaryEmissive,
        emissiveIntensity: 0.28,
        roughness: 0.48,
        metalness: 0.06,
      }),
    ),
    blossomMat: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: blossomColor,
        emissive: blossomEmissive,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.12,
      }),
    ),
    heartLeafMat: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: leafColor,
        emissive: blossomEmissive,
        emissiveIntensity: 0.48,
        roughness: 0.3,
        metalness: 0.18,
      }),
    ),
    lanternGlowMat: tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        emissive: lanternColor,
        emissiveIntensity: 1.35,
        roughness: 0.15,
      }),
    ),
    petalMat: tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: petalColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  });

  const variantMaterials: Record<HeartTreeVariant, VariantMaterials> = {
    // 1. Romantic Pink Tree: blush + rose + pearl flowers
    pink: createVariantMaterials(
      '#f9a8d4',
      '#be185d',
      '#f472b6',
      '#9d174d',
      '#fff1f2',
      '#fda4af',
      '#fb7185',
      '#fde047',
      '#fbcfe8',
    ),
    // 2. Lavender Tree: lavender + lilac + soft blue
    lavender: createVariantMaterials(
      '#d8b4fe',
      '#6b21a8',
      '#c084fc',
      '#581c87',
      '#bae6fd',
      '#38bdf8',
      '#e9d5ff',
      '#fef08a',
      '#e9d5ff',
    ),
    // 3. Golden Heart Tree: warm green foliage + champagne-gold flowers + warm lights
    golden: createVariantMaterials(
      '#86efac',
      '#166534',
      '#bbf7d0',
      '#15803d',
      '#fde047',
      '#d97706',
      '#fbbf24',
      '#f59e0b',
      '#fef08a',
    ),
    // 4. Dream Tree: pastel mixed foliage + subtle crystal flowers
    dream: createVariantMaterials(
      '#fbcfe8',
      '#9d174d',
      '#ddd6fe',
      '#5b21b6',
      '#e0f2fe',
      '#7dd3fc',
      '#fde047',
      '#fde047',
      '#fce7f3',
    ),
  };

  // Separate material clones for the two entrance trees so their progressive awakening
  // in the Grand Castle Entrance cinematic illuminates them independently before the rest!
  const entrancePrimaryMats = createVariantMaterials(
    '#f9a8d4',
    '#be185d',
    '#f472b6',
    '#9d174d',
    '#fff1f2',
    '#fda4af',
    '#fde047',
    '#fde047',
    '#fbcfe8',
  );
  const entranceSecondaryMats = createVariantMaterials(
    '#fbcfe8',
    '#9d174d',
    '#ddd6fe',
    '#6b21a8',
    '#fef08a',
    '#f59e0b',
    '#fb7185',
    '#fde047',
    '#fef08a',
  );

  // ============================================================================
  // 4. SCULPTED 3D HEART CANOPY CLUSTER LAYOUT
  // ============================================================================
  // 19 overlapping 3D foliage clusters arranged in a volumetric heart silhouette:
  // - Lower tapered point at (0, 2.05, 0)
  // - Mid-lower flanks at (±0.52, 2.48, ±0.12)
  // - Wide cheek lobes at (±1.04, 3.05, ±0.15)
  // - Upper rounded arches at (±0.78, 3.68, ±0.12) and (±0.40, 3.82, ±0.08)
  // - Distinct central heart cleft at (0, 3.32, 0) so the heart notch is unmistakable!
  // - Front/Back depth puffs at z = ±0.42 so the tree is lush and 3D from side angles too.
  const HEART_CANOPY_CLUSTERS: readonly {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    secondary: boolean;
  }[] = [
    // Bottom tapered heart tip
    { x: 0.0, y: 2.06, z: 0.0, sx: 0.72, sy: 0.78, sz: 0.72, secondary: false },
    // Lower V-flanks
    { x: -0.44, y: 2.42, z: 0.06, sx: 0.88, sy: 0.85, sz: 0.86, secondary: true },
    { x: 0.44, y: 2.42, z: -0.06, sx: 0.88, sy: 0.85, sz: 0.86, secondary: true },
    // Mid-wide heart cheeks
    { x: -0.86, y: 2.86, z: -0.05, sx: 1.04, sy: 0.96, sz: 0.95, secondary: false },
    { x: 0.86, y: 2.86, z: 0.05, sx: 1.04, sy: 0.96, sz: 0.95, secondary: false },
    // Outer upper lobes (widest part of the heart)
    { x: -1.12, y: 3.34, z: 0.04, sx: 1.08, sy: 1.02, sz: 0.98, secondary: true },
    { x: 1.12, y: 3.34, z: -0.04, sx: 1.08, sy: 1.02, sz: 0.98, secondary: true },
    // Top-most lobe crowns (left & right domes of the heart)
    { x: -0.78, y: 3.78, z: -0.03, sx: 1.02, sy: 0.96, sz: 0.94, secondary: false },
    { x: 0.78, y: 3.78, z: 0.03, sx: 1.02, sy: 0.96, sz: 0.94, secondary: false },
    // Inner-upper lobe shoulders framing the central cleft notch
    { x: -0.42, y: 3.68, z: 0.05, sx: 0.78, sy: 0.76, sz: 0.82, secondary: true },
    { x: 0.42, y: 3.68, z: -0.05, sx: 0.78, sy: 0.76, sz: 0.82, secondary: true },
    // Central heart core (below the cleft at y=3.32)
    { x: 0.0, y: 2.88, z: 0.0, sx: 1.05, sy: 0.98, sz: 1.02, secondary: false },
    // Front & Back 3D depth clusters so side profiles also look lush and organic
    { x: -0.48, y: 3.18, z: 0.42, sx: 0.84, sy: 0.82, sz: 0.78, secondary: true },
    { x: 0.48, y: 3.18, z: 0.42, sx: 0.84, sy: 0.82, sz: 0.78, secondary: false },
    { x: -0.48, y: 3.18, z: -0.42, sx: 0.84, sy: 0.82, sz: 0.78, secondary: false },
    { x: 0.48, y: 3.18, z: -0.42, sx: 0.84, sy: 0.82, sz: 0.78, secondary: true },
    { x: 0.0, y: 2.58, z: 0.38, sx: 0.76, sy: 0.74, sz: 0.72, secondary: true },
    { x: 0.0, y: 2.58, z: -0.38, sx: 0.76, sy: 0.74, sz: 0.72, secondary: true },
  ];

  // Blossom & subtle 3D heart-flower accent coordinates on the outer canopy surface
  const BLOSSOM_OFFSETS: readonly [number, number, number, boolean][] = [
    [-1.18, 3.45, 0.42, true],
    [1.18, 3.45, 0.42, true],
    [-0.82, 3.92, 0.35, false],
    [0.82, 3.92, 0.35, false],
    [0.0, 2.28, 0.48, true],
    [-0.68, 2.75, 0.56, false],
    [0.68, 2.75, 0.56, false],
    [-0.36, 3.42, 0.58, true],
    [0.36, 3.42, 0.58, true],
    [-1.15, 3.38, -0.42, false],
    [1.15, 3.38, -0.42, false],
    [-0.78, 3.88, -0.36, true],
    [0.78, 3.88, -0.36, true],
    [0.0, 2.32, -0.48, false],
    [-0.65, 2.78, -0.54, false],
    [0.65, 2.78, -0.54, false],
  ];

  const buildSingleHeartTree = (
    vMats: VariantMaterials,
    scale: number,
    rotY: number,
    includePetals: boolean,
  ): {
    root: THREE.Group;
    canopyGroup: THREE.Group;
    lanternPivots: THREE.Group[];
    petalMeshes: THREE.Mesh[];
  } => {
    const root = new THREE.Group();
    root.scale.setScalar(scale);
    root.rotation.y = rotY;

    // 1. Trunk & Branching Structure
    const trunkMesh = new THREE.Mesh(mainTrunkGeo, trunkMat);
    trunkMesh.castShadow = true;
    const flareMesh = new THREE.Mesh(rootFlareGeo, trunkMat);
    const branchL = new THREE.Mesh(leftBranchGeo, trunkMat);
    const branchR = new THREE.Mesh(rightBranchGeo, trunkMat);
    const branchD = new THREE.Mesh(depthBranchGeo, trunkMat);
    root.add(trunkMesh, flareMesh, branchL, branchR, branchD);

    // Golden heart collar ring around trunk base
    const collarRingGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.24, 0.025, 8, 18),
    );
    collarRingGeo.rotateX(Math.PI / 2);
    collarRingGeo.translate(0, 0.14, 0);
    root.add(new THREE.Mesh(collarRingGeo, mats.champagneGold));

    // 2. Sculpted 3D Heart Canopy Group
    const canopyGroup = new THREE.Group();
    for (let i = 0; i < HEART_CANOPY_CLUSTERS.length; i++) {
      const c = HEART_CANOPY_CLUSTERS[i];
      const m = new THREE.Mesh(
        foliageClusterGeo,
        c.secondary ? vMats.canopySecondary : vMats.canopyPrimary,
      );
      m.position.set(c.x, c.y, c.z);
      m.scale.set(c.sx, c.sy, c.sz);
      if (i < 6) m.castShadow = true;
      canopyGroup.add(m);
    }

    // 3. Blossom Clusters & Sparse 3D Heart-Shaped Leaves/Flowers
    for (let i = 0; i < BLOSSOM_OFFSETS.length; i++) {
      const [bx, by, bz, isHeartFlower] = BLOSSOM_OFFSETS[i];
      const bMesh = new THREE.Mesh(
        isHeartFlower ? heartLeafGeo : blossomClusterGeo,
        isHeartFlower ? vMats.heartLeafMat : vMats.blossomMat,
      );
      bMesh.position.set(bx, by, bz);
      if (isHeartFlower) {
        bMesh.rotation.y = Math.atan2(bx, bz);
        bMesh.scale.setScalar(1.25);
      }
      canopyGroup.add(bMesh);
    }

    // 4. Hanging Warm Crystal Lanterns under the Left & Right Heart Lobes
    const lanternPivots: THREE.Group[] = [];
    const lanternCoords: readonly [number, number, number][] = [
      [-1.02, 2.78, 0.14],
      [1.02, 2.78, -0.14],
      [0.0, 2.38, 0.36],
    ];
    for (let l = 0; l < lanternCoords.length; l++) {
      const [lx, ly, lz] = lanternCoords[l];
      const lPivot = new THREE.Group();
      lPivot.position.set(lx, ly, lz);
      lPivot.add(
        new THREE.Mesh(lanternCordGeo, mats.champagneGold),
        new THREE.Mesh(lanternCapGeo, mats.champagneGold),
        new THREE.Mesh(lanternGlobeGeo, vMats.lanternGlowMat),
      );
      canopyGroup.add(lPivot);
      lanternPivots.push(lPivot);
    }

    root.add(canopyGroup);

    // 5. Gentle Drifting Petals beneath the canopy
    const petalMeshes: THREE.Mesh[] = [];
    if (includePetals) {
      for (let p = 0; p < 5; p++) {
        const pMesh = new THREE.Mesh(petalGeo, vMats.petalMat);
        const angle = (p * Math.PI * 2) / 5;
        pMesh.position.set(
          Math.cos(angle) * 0.72,
          1.2 + (p % 3) * 0.55,
          Math.sin(angle) * 0.72,
        );
        root.add(pMesh);
        petalMeshes.push(pMesh);
      }
    }

    return { root, canopyGroup, lanternPivots, petalMeshes };
  };

  // ============================================================================
  // 5. INSTANTIATE ALL PLACED HEART TREES
  // ============================================================================
  const animatedTrees: AnimatedTreeInstance[] = [];
  const localColliders: Array<{ lx: number; lz: number; radius: number }> = [];

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const role = p.awakeningRole ?? 'ambient';
    const vMats =
      role === 'entrance_primary'
        ? entrancePrimaryMats
        : role === 'entrance_secondary'
          ? entranceSecondaryMats
          : variantMaterials[p.variant];

    const px = p.lx ?? p.x ?? 0;
    const pz = p.lz ?? p.z ?? 0;

    const built = buildSingleHeartTree(vMats, p.scale, p.rotY, true);
    built.root.position.set(px, p.y, pz);
    group.add(built.root);

    if (!p.skipCollider) {
      localColliders.push({
        lx: px,
        lz: pz,
        radius: 0.42 * p.scale,
      });
    }

    animatedTrees.push({
      root: built.root,
      canopyGroup: built.canopyGroup,
      lanternPivots: built.lanternPivots,
      petalMeshes: built.petalMeshes,
      petalPhaseOffsets: [0.0, 1.25, 2.5, 3.75, 5.0],
      baseScale: p.scale,
      phaseOffset: i * 1.17,
      variant: p.variant,
      role,
    });
  }

  return {
    group,
    localColliders,

    createStandaloneHeartTree: (
      variant: HeartTreeVariant,
      scale: number,
      rotY = 0,
    ): THREE.Group => {
      const built = buildSingleHeartTree(
        variantMaterials[variant],
        scale,
        rotY,
        false,
      );
      return built.root;
    },

    update: (
      _delta: number,
      clockTime: number,
      primaryAwake: number,
      secondaryAwake: number,
      ambientAwake: number,
    ) => {
      // 1. Update progressive awakening glow on entrance & ambient Heart Trees
      const pBoost = THREE.MathUtils.clamp(primaryAwake, 0, 1);
      entrancePrimaryMats.canopyPrimary.emissiveIntensity = 0.16 + pBoost * 0.34;
      entrancePrimaryMats.canopySecondary.emissiveIntensity = 0.2 + pBoost * 0.38;
      entrancePrimaryMats.blossomMat.emissiveIntensity = 0.35 + pBoost * 0.85;
      entrancePrimaryMats.heartLeafMat.emissiveIntensity = 0.3 + pBoost * 0.8;
      entrancePrimaryMats.lanternGlowMat.emissiveIntensity =
        0.45 + pBoost * 1.65 + Math.sin(clockTime * 3.0) * 0.18;

      const sBoost = THREE.MathUtils.clamp(secondaryAwake, 0, 1);
      entranceSecondaryMats.canopyPrimary.emissiveIntensity = 0.16 + sBoost * 0.34;
      entranceSecondaryMats.canopySecondary.emissiveIntensity = 0.2 + sBoost * 0.38;
      entranceSecondaryMats.blossomMat.emissiveIntensity = 0.35 + sBoost * 0.85;
      entranceSecondaryMats.heartLeafMat.emissiveIntensity = 0.3 + sBoost * 0.8;
      entranceSecondaryMats.lanternGlowMat.emissiveIntensity =
        0.45 + sBoost * 1.65 + Math.cos(clockTime * 3.0) * 0.18;

      const aBoost = THREE.MathUtils.clamp(ambientAwake, 0, 1);
      const pulse = Math.sin(clockTime * 2.2) * 0.12;
      (Object.keys(variantMaterials) as HeartTreeVariant[]).forEach((k) => {
        const vm = variantMaterials[k];
        vm.blossomMat.emissiveIntensity = 0.45 + aBoost * 0.35 + pulse * 0.5;
        vm.lanternGlowMat.emissiveIntensity = 1.15 + aBoost * 0.65 + pulse;
      });

      // 2. Gentle organic canopy sway, lantern pendulum swing & falling petals
      for (let i = 0; i < animatedTrees.length; i++) {
        const tree = animatedTrees[i];
        const phase = clockTime * 1.25 + tree.phaseOffset;

        // Subtle wind sway on heart canopy
        tree.canopyGroup.rotation.z = Math.sin(phase) * 0.026;
        tree.canopyGroup.rotation.x = Math.cos(phase * 0.85) * 0.018;

        // Hanging warm lights sway gently
        for (let l = 0; l < tree.lanternPivots.length; l++) {
          const lp = tree.lanternPivots[l];
          lp.rotation.z = Math.sin(phase * 1.35 + l * 1.1) * 0.065;
          lp.rotation.x = Math.cos(phase * 1.15 + l * 0.9) * 0.045;
        }

        // Occasional falling petals drifting down and recycling seamlessly
        const awakeFactor =
          tree.role === 'entrance_primary'
            ? 0.4 + pBoost * 0.8
            : tree.role === 'entrance_secondary'
              ? 0.4 + sBoost * 0.8
              : 0.6 + aBoost * 0.4;

        for (let p = 0; p < tree.petalMeshes.length; p++) {
          const pm = tree.petalMeshes[p];
          const pTime =
            (clockTime * 0.38 * awakeFactor +
              tree.petalPhaseOffsets[p] +
              tree.phaseOffset * 0.3) %
            1.0;
          const baseAng = (p * Math.PI * 2) / tree.petalMeshes.length;
          const radius = 0.55 + Math.sin(pTime * Math.PI * 2 + p) * 0.28;
          pm.position.set(
            Math.cos(baseAng + pTime * 1.8) * radius,
            2.45 - pTime * 2.25,
            Math.sin(baseAng + pTime * 1.8) * radius,
          );
          pm.rotation.set(
            pTime * 3.2 + p,
            pTime * 2.4,
            Math.sin(clockTime * 2.0 + p) * 0.6,
          );
        }
      }
    },
  };
}
