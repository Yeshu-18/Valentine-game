import * as THREE from 'three';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';
import {
  ResourceTracker,
  createBeveledBoxGeometry,
  createHeartShape2D,
  createThemeParkMaterials,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  ENCHANTED_GARDEN_LOCAL_POINTS,
  FOREST_SEED,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';
import {
  MagicalPlantSystemBundle,
  createMagicalPlantSystem,
} from './MagicalPlantSystem';
import { TopiarySystemBundle, createTopiarySystem } from './TopiarySystem';

export interface EnchantedGardenBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  topiarySystem: TopiarySystemBundle;
  magicalPlantSystem: MagicalPlantSystemBundle;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

/**
 * Perturbs an IcosahedronGeometry for organic hedges, moss patches, and ivy clusters.
 */
function createOrganicFoliageClusterGeo(
  rx: number,
  ry: number,
  rz: number,
  irregularity: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, 2);
  const pos = geo.attributes.position;
  const freq = 3.2 + (seed % 4) * 0.5;
  const phase = seed * 1.13;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const wave =
      Math.sin(vx * freq + vy * 2.9 + phase) *
        Math.cos(vz * freq - vx * 2.1 - phase) *
        irregularity +
      Math.sin((vx + vz) * freq * 1.8 + phase) * (irregularity * 0.45);
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
 * Creates a crisp, high-contrast carved brass-and-stone archway plaque texture
 * so both the Greenhouse Exit Gate and the Ancient Forest Entrance Gate are unmistakable.
 */
function createGatePlaqueTexture(
  tracker: ResourceTracker,
  headline: string,
  subtitle: string,
  borderHex: string,
  glowHex: string,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Dark carved slate-bronze backing
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#1c1917');
  bgGrad.addColorStop(0.5, '#292524');
  bgGrad.addColorStop(1, '#151312');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Double ornate brass border
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Corner botanical rivets
  const corners = [
    [24, 24],
    [w - 24, 24],
    [24, h - 24],
    [w - 24, h - 24],
  ];
  ctx.fillStyle = glowHex;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Headline
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowHex;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(headline, w * 0.5, h * 0.42);

  // Subtitle
  ctx.shadowBlur = 4;
  ctx.fillStyle = borderHex;
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText(subtitle, w * 0.5, h * 0.72);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds Phase F1 of the Deeper Enchanted Realm & Forest:
 * - Conservatory Wayfinding: 9 Glowing Rune-Inlaid Stepping Stones curving from the Royal Frog Pond
 *   directly to the Greenhouse Exit Gate, flanked by glowing guide blossoms.
 * - Gate 1 (Greenhouse Exit): Prominent 4.85m Ashlar & Wrought-Iron Gatehouse Archway with
 *   "THE ENCHANTED GARDEN" plaque, glowing heart-leaf crest, twin hanging amber lanterns & open doors.
 * - Zone 1–3: Symmetrical hedges, 12 Living Topiaries, 19 Bioluminescent Reactive Magical Plants,
 *   and 6 Wrought-Iron Garden Lantern Posts casting warm PointLight pools along the walk.
 * - Zone 4–5: 25–30m Overgrown Transition & Narrowing Broken Path (3.5m -> 3.0m -> 2.5m -> 1.8m).
 * - Gate 2 (Ancient Forest Entrance): Prominent 5.4m Ancient Mossy Stone & Gnarled-Bough Forest Gatehouse
 *   with glowing forest runes, "THE ANCIENT FOREST" plaque, and twin forest beacon lanterns.
 */
export function createEnchantedGardenSystem(): EnchantedGardenBundle {
  const group = new THREE.Group();
  group.name = 'PhaseF1_EnchantedGardenAndBrokenPath';

  const tracker = new ResourceTracker();
  const mats = createThemeParkMaterials(tracker);
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(FOREST_SEED);

  // Convert local spline control points into a smooth world-space CatmullRomCurve3
  const worldCurvePoints = ENCHANTED_GARDEN_LOCAL_POINTS.map((pt) => {
    const w = castleLocalToWorld(pt.localX, pt.localZ);
    const wy = getTerrainHeight(w.x, w.z);
    return new THREE.Vector3(w.x, wy, w.z);
  });
  const gardenSpline = new THREE.CatmullRomCurve3(
    worldCurvePoints,
    false,
    'centripetal',
    0.5,
  );

  // ============================================================================
  // SHARED GARDEN MATERIALS (Calibrated to Central Plaza & Conservatory Benchmark)
  // ============================================================================
  const weatheredSlabMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b5ada0'),
      emissive: new THREE.Color('#3b352c'),
      emissiveIntensity: 0.14,
      roughness: 0.74,
      metalness: 0.04,
      bumpMap: mats.creamStone.bumpMap,
      bumpScale: 0.038,
    }),
  );
  const mossyCrackedSlabMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8c9681'),
      emissive: new THREE.Color('#273322'),
      emissiveIntensity: 0.16,
      roughness: 0.78,
      metalness: 0.03,
      bumpMap: mats.creamStone.bumpMap,
      bumpScale: 0.045,
    }),
  );
  const trimmedTurfMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#479954'),
      emissive: new THREE.Color('#193d20'),
      emissiveIntensity: 0.24,
      roughness: 0.78,
      metalness: 0.01,
    }),
  );
  const hedgeFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b8a4c'),
      emissive: new THREE.Color('#1a4524'),
      emissiveIntensity: 0.34,
      roughness: 0.66,
      metalness: 0.02,
    }),
  );
  const overgrownHedgeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#317540'),
      emissive: new THREE.Color('#15381d'),
      emissiveIntensity: 0.28,
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  const mossVelvetMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5a9449'),
      emissive: new THREE.Color('#22471b'),
      emissiveIntensity: 0.28,
      roughness: 0.78,
      metalness: 0.01,
    }),
  );
  const vineLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#429155'),
      emissive: new THREE.Color('#1b4525'),
      emissiveIntensity: 0.3,
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
  );
  const burnishedCopperMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d4764a'),
      roughness: 0.32,
      metalness: 0.82,
      clearcoat: 0.18,
    }),
  );
  const weatheredCopperPatinaMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#649980'),
      roughness: 0.55,
      metalness: 0.45,
    }),
  );
  const weatheredOakMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#785943'),
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  const gnarledRootMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5c402c'),
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  const conservatoryGlassMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dbeafe'),
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  const waterDropletMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.62,
      roughness: 0.15,
      transparent: true,
      opacity: 0.88,
    }),
  );

  // Warm Lantern & Bioluminescent Accent Materials
  const lanternAmberGlobeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbeb'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.86,
      roughness: 0.18,
    }),
  );
  const forestRuneCyanMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bbf7d0'),
      emissive: new THREE.Color('#10b981'),
      emissiveIntensity: 0.82,
      roughness: 0.22,
    }),
  );
  const flowerLavMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fae8ff'),
      emissive: new THREE.Color('#c084fc'),
      emissiveIntensity: 0.72,
      roughness: 0.28,
    }),
  );
  const flowerCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef9c3'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.74,
      roughness: 0.26,
    }),
  );
  const flowerBlushMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.72,
      roughness: 0.28,
    }),
  );

  // ============================================================================
  // 0. CONSERVATORY WAYFINDING: GLOWING RUNE-INLAID STEPPING-STONE TRAIL
  //    (From the Royal Frog Pond at localX = 0, localZ = 35.8 to Gate 1 at localX = 10.6, localZ = 38.4)
  // ============================================================================
  const conservatoryTrailGroup = new THREE.Group();
  conservatoryTrailGroup.name = 'ConservatorySteppingStoneTrail';
  group.add(conservatoryTrailGroup);

  const stepStoneBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.42, 0.46, 0.045, 12),
  );
  stepStoneBaseGeo.translate(0, 0.022, 0);
  const stepStoneBrassRimGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.32, 0.38, 24),
  );
  stepStoneBrassRimGeo.rotateX(-Math.PI / 2);
  stepStoneBrassRimGeo.translate(0, 0.048, 0);
  const stepStoneRuneCoreGeo = tracker.trackGeo(
    new THREE.CircleGeometry(0.24, 16),
  );
  stepStoneRuneCoreGeo.rotateX(-Math.PI / 2);
  stepStoneRuneCoreGeo.translate(0, 0.05, 0);
  const smallFlowerGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.06, 0),
  );

  const steppingStoneInlayMats: THREE.MeshStandardMaterial[] = [];
  const steppingStoneCount = 9;

  for (let i = 0; i < steppingStoneCount; i++) {
    const t = i / (steppingStoneCount - 1);
    // Smooth S-curve from (localX = 1.65, localZ = 36.0) beside the Royal Frog Pond to (localX = 10.4, localZ = 38.4)
    const lx = THREE.MathUtils.lerp(1.65, 10.4, t);
    const lz =
      THREE.MathUtils.lerp(36.0, 38.4, t) + Math.sin(t * Math.PI) * 0.45;
    const wCoords = castleLocalToWorld(lx, lz);
    const wy = getTerrainHeight(wCoords.x, wCoords.z);

    const stoneGroup = new THREE.Group();
    stoneGroup.position.set(wCoords.x, wy, wCoords.z);
    stoneGroup.rotation.y = -Math.PI / 4 + t * 0.25;
    conservatoryTrailGroup.add(stoneGroup);

    const baseMesh = new THREE.Mesh(stepStoneBaseGeo, mats.creamStone);
    baseMesh.receiveShadow = true;
    const brassRim = new THREE.Mesh(stepStoneBrassRimGeo, mats.brushedGold);

    const inlayMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#a7f3d0'),
        emissive: new THREE.Color('#10b981'),
        emissiveIntensity: 0.55,
        roughness: 0.26,
      }),
    );
    steppingStoneInlayMats.push(inlayMat);

    const runeCore = new THREE.Mesh(stepStoneRuneCoreGeo, inlayMat);
    stoneGroup.add(baseMesh, brassRim, runeCore);

    // Low glowing guide blossoms flanking the stepping stones inside the Conservatory
    [-0.56, 0.56].forEach((sideLat, sIdx) => {
      const bMesh = new THREE.Mesh(
        smallFlowerGeo,
        (i + sIdx) % 2 === 0 ? flowerCreamMat : flowerLavMat,
      );
      bMesh.position.set(0, 0.06, sideLat);
      stoneGroup.add(bMesh);
    });
  }

  // ============================================================================
  // 1. GATE 1 — PROMINENT GREENHOUSE EXIT GATEHOUSE ARCHWAY (localX = 10.6, localZ = 38.4)
  //    & ZONE 1 SYMMETRICAL COURT, HEDGES, PLANTERS, BENCH & ENCHANTED WATERING CANS
  // ============================================================================
  const zone1Group = new THREE.Group();
  zone1Group.name = 'Zone1_GreenhouseExit';
  group.add(zone1Group);

  const exitWorldCoords = castleLocalToWorld(10.6, 38.4);
  const exitGroundY = getTerrainHeight(exitWorldCoords.x, exitWorldCoords.z);
  const exitPortalGroup = new THREE.Group();
  exitPortalGroup.position.set(
    exitWorldCoords.x,
    exitGroundY,
    exitWorldCoords.z,
  );
  // Match WizardingSchool schoolRoot.rotation.y = -Math.PI / 4 so local +X points directly along
  // the Enchanted Garden spline (+localX) and local ±Z spans flush along the NE Conservatory wall!
  exitPortalGroup.rotation.y = -Math.PI / 4;
  zone1Group.add(exitPortalGroup);

  // 1A. Continuous Carved Stone Threshold Apron bridging the Conservatory floor & stepping stones
  //     directly underneath Gate 1 onto the start of the Zone 1 stone slab pathway
  const gate1ThresholdApronGeo = tracker.trackGeo(
    createBeveledBoxGeometry(2.6, 0.11, 3.75, 0.025),
  );
  const gate1ThresholdApron = new THREE.Mesh(
    gate1ThresholdApronGeo,
    mats.creamStone,
  );
  gate1ThresholdApron.position.set(0.35, -0.02, 0);
  gate1ThresholdApron.receiveShadow = true;
  const gate1BrassSillGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.18, 0.125, 3.6, 0.015),
  );
  const gate1BrassSill = new THREE.Mesh(gate1BrassSillGeo, mats.brushedGold);
  gate1BrassSill.position.set(0.0, -0.01, 0);
  exitPortalGroup.add(gate1ThresholdApron, gate1BrassSill);

  // 1B. Tall 4.85m Ashlar Stone & Wrought-Iron Conservatory Gatehouse Pillars & Archway
  const gatePillarGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.56, 3.85, 0.56, 0.04),
  );
  const gatePillarCapGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.7, 0.22, 0.7, 0.03),
  );
  const gateRuneBandGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.6, 0.14, 0.6, 0.02),
  );
  const archTopOuterGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.05, 0.16, 10, 28, Math.PI),
  );
  archTopOuterGeo.rotateY(Math.PI / 2);
  const archTopInnerGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.86, 0.08, 8, 28, Math.PI),
  );
  archTopInnerGeo.rotateY(Math.PI / 2);

  const lanternArmGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.028, 0.028, 0.55, 6),
  );
  lanternArmGeo.rotateZ(Math.PI / 2);
  const lanternCageGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.16, 0.12, 0.36, 8),
  );
  const lanternGlobeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.14, 10, 10),
  );

  [-2.05, 2.05].forEach((pz) => {
    const pillar = new THREE.Mesh(gatePillarGeo, mats.creamStone);
    pillar.position.set(0, 0, pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;

    const cap = new THREE.Mesh(gatePillarCapGeo, mats.warmSandstone);
    cap.position.set(0, 3.82, pz);
    cap.castShadow = true;

    const bandLower = new THREE.Mesh(gateRuneBandGeo, mats.brushedGold);
    bandLower.position.set(0, 1.45, pz);
    const bandUpper = new THREE.Mesh(gateRuneBandGeo, mats.brushedGold);
    bandUpper.position.set(0, 2.85, pz);

    exitPortalGroup.add(pillar, cap, bandLower, bandUpper);

    // Hang warm amber beacon lanterns on BOTH inside (-X, Conservatory side) and outside (+X, Garden side)
    [-0.42, 0.42].forEach((lxOffset) => {
      const arm = new THREE.Mesh(lanternArmGeo, mats.wroughtBronze);
      arm.position.set(lxOffset * 0.65, 3.15, pz);
      const cage = new THREE.Mesh(lanternCageGeo, mats.wroughtBronze);
      cage.position.set(lxOffset, 2.95, pz);
      const globe = new THREE.Mesh(lanternGlobeGeo, lanternAmberGlobeMat);
      globe.position.set(lxOffset, 2.95, pz);
      exitPortalGroup.add(arm, cage, globe);
    });

    // World collider for the Gate 1 pillar
    const wPillar = new THREE.Vector3(0, 0, pz);
    exitPortalGroup.localToWorld(wPillar);
    colliders.push({ x: wPillar.x, z: wPillar.z, radius: 0.48 });
  });

  const portalArchOuter = new THREE.Mesh(archTopOuterGeo, mats.creamStone);
  portalArchOuter.position.set(0, 3.85, 0);
  portalArchOuter.castShadow = true;
  const portalArchInner = new THREE.Mesh(archTopInnerGeo, mats.brushedGold);
  portalArchInner.position.set(0, 3.85, 0);
  exitPortalGroup.add(portalArchOuter, portalArchInner);

  // Glowing Heart & Botanical Crest at the apex of Gate 1 (Y = 5.95m)
  const heartShape = createHeartShape2D(0.85);
  const heartCrestGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    }),
  );
  heartCrestGeo.center();
  heartCrestGeo.rotateY(Math.PI / 2);
  const gate1HeartCrest = new THREE.Mesh(heartCrestGeo, mats.crystalHeart);
  gate1HeartCrest.position.set(0, 6.08, 0);
  exitPortalGroup.add(gate1HeartCrest);

  // Diegetic Carved Signboard Plaque on Gate 1 ("THE ENCHANTED GARDEN") visible from both inside & outside
  const gate1PlaqueTex = createGatePlaqueTexture(
    tracker,
    'THE ENCHANTED GARDEN',
    'Botanical Topiary Walk • Living Flora',
    '#e5b564',
    '#f59e0b',
  );
  const gate1PlaqueMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: gate1PlaqueTex ?? undefined,
      emissive: new THREE.Color('#fef3c7'),
      emissiveMap: gate1PlaqueTex ?? undefined,
      emissiveIntensity: 0.56,
      roughness: 0.3,
    }),
  );
  const plaqueBackingGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.18, 0.72, 2.35, 0.025),
  );
  const plaqueFaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.22, 0.62));
  const gate1PlaqueBacking = new THREE.Mesh(
    plaqueBackingGeo,
    mats.wroughtBronze,
  );
  gate1PlaqueBacking.position.set(0, 4.55, 0);
  const gate1PlaqueInnerFace = new THREE.Mesh(plaqueFaceGeo, gate1PlaqueMat);
  gate1PlaqueInnerFace.position.set(-0.1, 4.91, 0);
  gate1PlaqueInnerFace.rotation.y = -Math.PI / 2;
  const gate1PlaqueOuterFace = new THREE.Mesh(plaqueFaceGeo, gate1PlaqueMat);
  gate1PlaqueOuterFace.position.set(0.1, 4.91, 0);
  gate1PlaqueOuterFace.rotation.y = Math.PI / 2;
  exitPortalGroup.add(
    gate1PlaqueBacking,
    gate1PlaqueInnerFace,
    gate1PlaqueOuterFace,
  );

  // Open Double Greenhouse Doors swung outward (+X) into Zone 1
  const doorFrameGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.08, 3.6, 1.72, 0.02),
  );
  const doorGlassGeo = tracker.trackGeo(new THREE.BoxGeometry(0.03, 3.2, 1.44));
  doorGlassGeo.translate(0, 1.8, 0);

  [-1, 1].forEach((side) => {
    const doorPivot = new THREE.Group();
    doorPivot.position.set(0.12, 0, side * 1.85);
    doorPivot.rotation.y = -side * 1.25;
    const frame = new THREE.Mesh(doorFrameGeo, mats.wroughtBronze);
    frame.position.set(0, 0, -side * 0.85);
    frame.castShadow = true;
    const glass = new THREE.Mesh(doorGlassGeo, conservatoryGlassMat);
    glass.position.set(0, 0, -side * 0.85);
    doorPivot.add(frame, glass);
    exitPortalGroup.add(doorPivot);
  });

  // Decorative climbing vines & glowing blossoms draped over the Greenhouse Exit Archway
  const vineClusterGeos: THREE.BufferGeometry[] = [];
  const archFlowerGeos: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 20; v++) {
    const ang = (v / 19) * Math.PI;
    const vz = Math.cos(ang) * 2.12 + (rand() - 0.5) * 0.22;
    const vy = 1.6 + Math.sin(ang) * 2.45 + (rand() - 0.5) * 0.2;
    const vx = (rand() - 0.5) * 0.28;
    const vg = createOrganicFoliageClusterGeo(
      0.24 + rand() * 0.1,
      0.28 + rand() * 0.12,
      0.24 + rand() * 0.1,
      0.22,
      v * 19,
    );
    vg.translate(vx, vy, vz);
    vineClusterGeos.push(vg);

    if (v % 2 === 0) {
      const fg = smallFlowerGeo.clone();
      fg.scale(1.3, 1.3, 1.3);
      fg.translate(vx + (v % 4 === 0 ? -0.18 : 0.18), vy, vz);
      archFlowerGeos.push(fg);
    }
  }
  const mergedArchVines = tracker.trackGeo(mergeGeometries(vineClusterGeos));
  vineClusterGeos.forEach((g) => g.dispose());
  const archVineMesh = new THREE.Mesh(mergedArchVines, vineLeafMat);
  archVineMesh.castShadow = true;
  exitPortalGroup.add(archVineMesh);

  if (archFlowerGeos.length > 0) {
    const mergedArchFlowers = tracker.trackGeo(mergeGeometries(archFlowerGeos));
    archFlowerGeos.forEach((g) => g.dispose());
    const archFlowerMesh = new THREE.Mesh(mergedArchFlowers, flowerBlushMat);
    exitPortalGroup.add(archFlowerMesh);
  }

  // 1C. Helper Builders for Garden Benches, Copper Watering Cans & Tool Sets
  const rectPlanterGeo = tracker.trackGeo(
    createBeveledBoxGeometry(1.55, 0.54, 0.78, 0.04),
  );

  function createWeatheredGardenBench(isOvergrown: boolean): THREE.Group {
    const bench = new THREE.Group();
    const legGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.14, 0.46, 0.54, 0.02),
    );
    const seatPlankGeo = tracker.trackGeo(
      createBeveledBoxGeometry(1.68, 0.06, 0.16, 0.015),
    );
    const backPostGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.1, 0.56, 0.08, 0.015),
    );
    const backRailGeo = tracker.trackGeo(
      createBeveledBoxGeometry(1.64, 0.12, 0.05, 0.012),
    );

    [-0.68, 0.68].forEach((lx) => {
      const leg = new THREE.Mesh(
        legGeo,
        isOvergrown ? mossyCrackedSlabMat : weatheredSlabMat,
      );
      leg.position.set(lx, 0, 0);
      leg.castShadow = true;
      bench.add(leg);

      const post = new THREE.Mesh(backPostGeo, mats.wroughtBronze);
      post.position.set(lx, 0.44, -0.22);
      post.rotation.x = -0.14;
      bench.add(post);
    });

    [-0.16, 0.0, 0.16].forEach((sz, sIdx) => {
      const plank = new THREE.Mesh(seatPlankGeo, weatheredOakMat);
      plank.position.set(0, 0.46, sz);
      if (isOvergrown && sIdx === 1) {
        plank.rotation.z = 0.035;
      }
      plank.castShadow = true;
      plank.receiveShadow = true;
      bench.add(plank);
    });

    [0.68, 0.88].forEach((by) => {
      const rail = new THREE.Mesh(backRailGeo, weatheredOakMat);
      rail.position.set(0, by, -0.26);
      rail.rotation.x = -0.14;
      rail.castShadow = true;
      bench.add(rail);
    });

    if (isOvergrown) {
      const mossGeo = tracker.trackGeo(
        createOrganicFoliageClusterGeo(0.45, 0.14, 0.25, 0.25, 881),
      );
      mossGeo.translate(0.38, 0.52, -0.05);
      const moss = new THREE.Mesh(mossGeo, mossVelvetMat);
      bench.add(moss);
    }

    return bench;
  }

  function createCopperWateringCan(withPatina: boolean): THREE.Group {
    const can = new THREE.Group();
    const cMat = withPatina ? weatheredCopperPatinaMat : burnishedCopperMat;

    const bodyGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.13, 0.16, 0.3, 12),
    );
    bodyGeo.translate(0, 0.15, 0);
    const spoutGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.022, 0.042, 0.32, 8),
    );
    spoutGeo.translate(0, 0.16, 0);
    const roseHeadGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.055, 0.06, 10),
    );
    const handleGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.13, 0.018, 6, 16, Math.PI * 1.25),
    );

    const body = new THREE.Mesh(bodyGeo, cMat);
    body.castShadow = true;
    const spout = new THREE.Mesh(spoutGeo, cMat);
    spout.position.set(0, 0.08, 0.12);
    spout.rotation.x = 0.78;
    const roseHead = new THREE.Mesh(roseHeadGeo, mats.brushedGold);
    roseHead.position.set(0, 0.31, 0.35);
    roseHead.rotation.x = -0.78;
    const handle = new THREE.Mesh(handleGeo, cMat);
    handle.position.set(0, 0.22, -0.06);
    handle.rotation.y = Math.PI / 2;

    can.add(body, spout, roseHead, handle);
    return can;
  }

  function createCopperGardeningToolSet(): THREE.Group {
    const tools = new THREE.Group();
    const shaftGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.016, 0.018, 0.85, 6),
    );
    shaftGeo.translate(0, 0.425, 0);
    const spadeBladeGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.14, 0.2, 0.02, 0.005),
    );
    const rakeHeadGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.28, 0.04, 0.04, 0.005),
    );
    const trowelShaftGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.014, 0.016, 0.22, 6),
    );
    const trowelBladeGeo = tracker.trackGeo(
      new THREE.ConeGeometry(0.055, 0.16, 4),
    );
    trowelBladeGeo.scale(1.0, 1.0, 0.25);

    const spade = new THREE.Group();
    const sHandle = new THREE.Mesh(shaftGeo, weatheredOakMat);
    const sBlade = new THREE.Mesh(spadeBladeGeo, burnishedCopperMat);
    sBlade.position.set(0, 0.02, 0);
    spade.add(sHandle, sBlade);
    spade.position.set(-0.18, 0, 0);
    spade.rotation.set(0.24, 0.2, -0.18);
    tools.add(spade);

    const rake = new THREE.Group();
    const rHandle = new THREE.Mesh(shaftGeo, weatheredOakMat);
    const rHead = new THREE.Mesh(rakeHeadGeo, burnishedCopperMat);
    rHead.position.set(0, 0.02, 0);
    rake.add(rHandle, rHead);
    rake.position.set(0.16, 0, 0.05);
    rake.rotation.set(0.28, -0.15, 0.14);
    tools.add(rake);

    const trowel = new THREE.Group();
    const tHandle = new THREE.Mesh(trowelShaftGeo, weatheredOakMat);
    tHandle.rotation.z = Math.PI / 2;
    const tBlade = new THREE.Mesh(trowelBladeGeo, burnishedCopperMat);
    tBlade.rotation.z = -Math.PI / 2;
    tBlade.position.set(0.16, 0, 0);
    trowel.add(tHandle, tBlade);
    trowel.position.set(0, 0.03, 0.22);
    trowel.rotation.y = 0.65;
    tools.add(trowel);

    return tools;
  }

  // 1D. Spline-Aligned Zone 1 Trimmed Turf Borders, Symmetrical Stone Planters, Bench & Enchanted Watering Can
  const _z1Pt = new THREE.Vector3();
  const _z1Tan = new THREE.Vector3();
  const _z1Right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  // Trimmed Emerald Turf Borders placed along u = 0.08 on both sides of the Zone 1 path
  {
    gardenSpline.getPointAt(0.08, _z1Pt);
    gardenSpline.getTangentAt(0.08, _z1Tan).normalize();
    _z1Right.crossVectors(_z1Tan, _up).normalize();
    const z1Yaw = Math.atan2(_z1Tan.x, _z1Tan.z);
    const turfStripGeo = tracker.trackGeo(
      createBeveledBoxGeometry(2.2, 0.08, 6.8, 0.03),
    );
    [-2.95, 2.95].forEach((latOffset) => {
      const tx = _z1Pt.x + _z1Right.x * latOffset;
      const tz = _z1Pt.z + _z1Right.z * latOffset;
      const ty = getTerrainHeight(tx, tz) - 0.02;
      const turf = new THREE.Mesh(turfStripGeo, trimmedTurfMat);
      turf.position.set(tx, ty, tz);
      turf.rotation.y = z1Yaw;
      turf.receiveShadow = true;
      zone1Group.add(turf);
    });
  }

  // 4 Symmetrical Rectangular Stone Planters flanking the Zone 1 path at u = 0.045 and u = 0.135
  const zone1PlanterSpecs = [
    { u: 0.045, side: -1 },
    { u: 0.045, side: 1 },
    { u: 0.135, side: -1 },
    { u: 0.135, side: 1 },
  ];
  const planterBoxAlignedGeo = tracker.trackGeo(
    createBeveledBoxGeometry(0.78, 0.54, 1.55, 0.04),
  );

  zone1PlanterSpecs.forEach((pSpec, pIdx) => {
    gardenSpline.getPointAt(pSpec.u, _z1Pt);
    gardenSpline.getTangentAt(pSpec.u, _z1Tan).normalize();
    _z1Right.crossVectors(_z1Tan, _up).normalize();
    const pYaw = Math.atan2(_z1Tan.x, _z1Tan.z);

    const px = _z1Pt.x + _z1Right.x * (pSpec.side * 2.45);
    const pz = _z1Pt.z + _z1Right.z * (pSpec.side * 2.45);
    const py = getTerrainHeight(px, pz);

    const pGroup = new THREE.Group();
    pGroup.position.set(px, py, pz);
    pGroup.rotation.y = pYaw;
    zone1Group.add(pGroup);

    const stoneBox = new THREE.Mesh(planterBoxAlignedGeo, weatheredSlabMat);
    stoneBox.castShadow = true;
    stoneBox.receiveShadow = true;
    pGroup.add(stoneBox);

    const shrubGeo = tracker.trackGeo(
      createOrganicFoliageClusterGeo(0.3, 0.28, 0.65, 0.18, pIdx * 41),
    );
    shrubGeo.translate(0, 0.62, 0);
    const shrubMesh = new THREE.Mesh(shrubGeo, hedgeFoliageMat);
    shrubMesh.castShadow = true;
    pGroup.add(shrubMesh);

    for (let f = 0; f < 7; f++) {
      const fMesh = new THREE.Mesh(
        smallFlowerGeo,
        (pIdx + f) % 3 === 0
          ? flowerLavMat
          : (pIdx + f) % 3 === 1
            ? flowerCreamMat
            : flowerBlushMat,
      );
      fMesh.position.set(
        (f % 2 === 0 ? 1 : -1) * 0.11,
        0.79 + (f % 2) * 0.05,
        (f - 3.0) * 0.18,
      );
      pGroup.add(fMesh);
    }

    colliders.push({ x: px, z: pz, radius: 0.72 });
  });

  // Weathered Garden Bench, Copper Tools & Enchanted Levitating Watering Can at u = 0.09 along Zone 1
  const enchantedCanRig = new THREE.Group();
  let enchantedCanBaseY = exitGroundY + 1.32;
  {
    gardenSpline.getPointAt(0.09, _z1Pt);
    gardenSpline.getTangentAt(0.09, _z1Tan).normalize();
    _z1Right.crossVectors(_z1Tan, _up).normalize();

    const bx = _z1Pt.x - _z1Right.x * 2.65;
    const bz = _z1Pt.z - _z1Right.z * 2.65;
    const by = getTerrainHeight(bx, bz);
    const zone1Bench = createWeatheredGardenBench(false);
    zone1Bench.position.set(bx, by, bz);
    zone1Bench.rotation.y = Math.atan2(_z1Right.x, _z1Right.z);
    zone1Group.add(zone1Bench);
    colliders.push({ x: bx, z: bz, radius: 0.78 });

    const restingCan = createCopperWateringCan(false);
    restingCan.position.set(
      bx - _z1Tan.x * 1.05 + _z1Right.x * 0.35,
      by,
      bz - _z1Tan.z * 1.05 + _z1Right.z * 0.35,
    );
    restingCan.rotation.y = 0.85;
    zone1Group.add(restingCan);

    const tx = _z1Pt.x + _z1Right.x * 2.35;
    const tz = _z1Pt.z + _z1Right.z * 2.35;
    const ty = getTerrainHeight(tx, tz);
    const zone1Tools = createCopperGardeningToolSet();
    zone1Tools.position.set(tx - _z1Tan.x * 0.85, ty, tz - _z1Tan.z * 0.85);
    zone1Group.add(zone1Tools);

    enchantedCanBaseY = ty + 1.34;
    enchantedCanRig.position.set(
      tx + _z1Tan.x * 1.15,
      enchantedCanBaseY,
      tz + _z1Tan.z * 1.15,
    );
    enchantedCanRig.rotation.y = Math.atan2(-_z1Right.x, -_z1Right.z) + 0.35;
    zone1Group.add(enchantedCanRig);
  }

  const floatingCanMeshGroup = createCopperWateringCan(false);
  floatingCanMeshGroup.rotation.x = 0.62;
  enchantedCanRig.add(floatingCanMeshGroup);

  const dropletGeo = tracker.trackGeo(new THREE.SphereGeometry(0.022, 6, 6));
  const waterDroplets: THREE.Mesh[] = [];
  for (let d = 0; d < 10; d++) {
    const drop = new THREE.Mesh(dropletGeo, waterDropletMat);
    enchantedCanRig.add(drop);
    waterDroplets.push(drop);
  }

  // ============================================================================
  // 2. ZONES 1–5 — CONTINUOUS RAISED WEATHERED STONE SLAB PATH, SYMMETRICAL -> UNRULY HEDGES,
  //    OVERGROWN TRANSITION (25-30m) & ZONE 5 BROKEN NARROWING PATH TO GATE 2
  // ============================================================================
  const pathAndTransitionGroup = new THREE.Group();
  pathAndTransitionGroup.name = 'Zones1To5_PathHedgesAndOvergrownTransition';
  group.add(pathAndTransitionGroup);

  const slabGeometriesClean: THREE.BufferGeometry[] = [];
  const slabGeometriesMossy: THREE.BufferGeometry[] = [];
  const jointMossGeos: THREE.BufferGeometry[] = [];
  const hedgeGeometriesTrimmed: THREE.BufferGeometry[] = [];
  const hedgeGeometriesOvergrown: THREE.BufferGeometry[] = [];
  const hedgeStemGeos: THREE.BufferGeometry[] = [];
  const hedgeBlossomGeos: THREE.BufferGeometry[] = [];
  const rootGeos: THREE.BufferGeometry[] = [];

  const totalSteps = 60;
  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _right = new THREE.Vector3();

  for (let s = 0; s <= totalSteps; s++) {
    const u = s / totalSteps;
    gardenSpline.getPointAt(u, _pt);
    gardenSpline.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const groundY = getTerrainHeight(_pt.x, _pt.z);
    const yaw = Math.atan2(_tan.x, _tan.z);

    // Progressive Path Width Narrowing: 3.5m -> 3.0m -> 2.5m -> 1.8m
    let pathWidth = 3.5;
    if (u < 0.25) {
      pathWidth = THREE.MathUtils.lerp(3.5, 3.3, u / 0.25);
    } else if (u < 0.55) {
      pathWidth = THREE.MathUtils.lerp(3.3, 3.0, (u - 0.25) / 0.3);
    } else if (u < 0.8) {
      pathWidth = THREE.MathUtils.lerp(3.0, 2.5, (u - 0.55) / 0.25);
    } else {
      pathWidth = THREE.MathUtils.lerp(2.5, 1.85, (u - 0.8) / 0.2);
    }

    const overgrowth = THREE.MathUtils.smoothstep(u, 0.14, 0.92);

    // 2A. Raised Stone Paving Slabs (0.14m thick so they sit proudly above the terrain mesh)
    if (u < 0.72) {
      const stonesInRow = u < 0.35 ? 2 : 3;
      const rowGap = 0.05 + overgrowth * 0.11;
      const cellW = (pathWidth - rowGap * (stonesInRow - 1)) / stonesInRow;

      for (let c = 0; c < stonesInRow; c++) {
        // Keep the center stone (c === 1) always present so the pathway centerline is never broken
        if (
          overgrowth > 0.58 &&
          c !== 1 &&
          stonesInRow === 3 &&
          rand() < 0.14
        ) {
          continue;
        }

        const w = cellW * (0.95 + (rand() - 0.5) * overgrowth * 0.18);
        const len = 0.72 * (0.96 + (rand() - 0.5) * overgrowth * 0.16);
        const h = 0.14;
        const slab = createBeveledBoxGeometry(w, h, len, 0.022);

        const latOffset =
          -pathWidth * 0.5 +
          cellW * 0.5 +
          c * (cellW + rowGap) +
          (rand() - 0.5) * overgrowth * 0.1;
        const wx = _pt.x + _right.x * latOffset;
        const wz = _pt.z + _right.z * latOffset;
        const wy = getTerrainHeight(wx, wz) + 0.005;

        slab.rotateX((rand() - 0.5) * overgrowth * 0.06);
        slab.rotateZ((rand() - 0.5) * overgrowth * 0.06);
        slab.rotateY(yaw + (rand() - 0.5) * overgrowth * 0.12);
        slab.translate(wx, wy, wz);

        if (overgrowth > 0.42 && rand() < overgrowth) {
          slabGeometriesMossy.push(slab);
        } else {
          slabGeometriesClean.push(slab);
        }
      }
    } else {
      // Zone 5 — Broken Path (u = 0.72 .. 1.0):
      // Always place a central weathered flagstone along the centerline + flanking cracked stones
      // so the pathway visibly connects all the way into and through Gate 2 (Ancient Forest Gate)!
      const centerW = (0.88 + rand() * 0.32) * (pathWidth / 2.0);
      const centerLen = 0.64 + rand() * 0.22;
      const centerSlab = createBeveledBoxGeometry(
        centerW,
        0.13,
        centerLen,
        0.024,
      );
      const centerLat = (rand() - 0.5) * 0.22;
      const cwx = _pt.x + _right.x * centerLat;
      const cwz = _pt.z + _right.z * centerLat;
      const cwy = getTerrainHeight(cwx, cwz) + 0.004;

      centerSlab.rotateX((rand() - 0.5) * 0.07);
      centerSlab.rotateZ((rand() - 0.5) * 0.07);
      centerSlab.rotateY(yaw + (rand() - 0.5) * 0.2);
      centerSlab.translate(cwx, cwy, cwz);
      if (rand() < 0.35) {
        slabGeometriesClean.push(centerSlab);
      } else {
        slabGeometriesMossy.push(centerSlab);
      }

      // Flanking broken stone fragments along the narrowing path edges
      [-1, 1].forEach((side) => {
        if (rand() < 0.25) return;
        const fragW = 0.44 + rand() * 0.32;
        const fragLen = 0.48 + rand() * 0.26;
        const fragSlab = createBeveledBoxGeometry(fragW, 0.12, fragLen, 0.022);
        const sideLat = side * (pathWidth * 0.34 + (rand() - 0.3) * 0.18);
        const fwx = _pt.x + _right.x * sideLat;
        const fwz = _pt.z + _right.z * sideLat;
        const fwy = getTerrainHeight(fwx, fwz);

        fragSlab.rotateX((rand() - 0.5) * 0.11);
        fragSlab.rotateZ((rand() - 0.5) * 0.11);
        fragSlab.rotateY(yaw + (rand() - 0.5) * 0.32);
        fragSlab.translate(fwx, fwy, fwz);
        slabGeometriesMossy.push(fragSlab);
      });
    }

    // 2B. Moss Cushions & Weeds breaking through stone joints
    if (overgrowth > 0.18 && s % 2 === 0) {
      const tuftCount = 1 + Math.floor(overgrowth * 3);
      for (let m = 0; m < tuftCount; m++) {
        const lat = (rand() - 0.5) * pathWidth * 0.95;
        const mx = _pt.x + _right.x * lat;
        const mz = _pt.z + _right.z * lat;
        const my = getTerrainHeight(mx, mz) + 0.06;
        const mGeo = createOrganicFoliageClusterGeo(
          0.14 + overgrowth * 0.12,
          0.06 + overgrowth * 0.07,
          0.14 + overgrowth * 0.12,
          0.25,
          s * 17 + m,
        );
        mGeo.translate(mx, my, mz);
        jointMossGeos.push(mGeo);
      }
    }

    // 2C. Low Hedges (0.8m–1.2m height) + Glowing Hedge Blossoms
    if (s >= 2 && s <= 48 && s % 2 === 0) {
      [-1, 1].forEach((side, sideIdx) => {
        if (overgrowth > 0.48 && rand() < (overgrowth - 0.38) * 0.72) {
          return;
        }

        const hedgeLat =
          pathWidth * 0.5 +
          0.68 +
          (sideIdx === 0 ? 1 : -1) * overgrowth * (rand() - 0.4) * 0.45;
        const hx = _pt.x + _right.x * side * hedgeLat;
        const hz = _pt.z + _right.z * hedgeLat * side;
        const hy = getTerrainHeight(hx, hz);

        const hHeight = 0.92 + (rand() - 0.45) * overgrowth * 0.42;
        const hWidth = 0.46 + overgrowth * rand() * 0.22;
        const hLen = 0.76 + (rand() - 0.5) * overgrowth * 0.25;

        for (let p = 0; p < 2; p++) {
          const puffOffset = (p - 0.5) * hLen * 0.55;
          const px = hx + _tan.x * puffOffset;
          const pz = hz + _tan.z * puffOffset;
          const hGeo = createOrganicFoliageClusterGeo(
            hWidth,
            hHeight * 0.52,
            hLen * 0.48,
            0.16 + overgrowth * 0.18,
            s * 31 + sideIdx * 7 + p,
          );
          hGeo.rotateY(yaw + (rand() - 0.5) * overgrowth * 0.35);
          hGeo.translate(px, hy + hHeight * 0.48, pz);

          if (overgrowth > 0.38) {
            hedgeGeometriesOvergrown.push(hGeo);
          } else {
            hedgeGeometriesTrimmed.push(hGeo);
          }

          // Bioluminescent blossoms along the inner side of the hedges facing the path
          if (p === 0 && s % 2 === 0) {
            const bGeo = smallFlowerGeo.clone();
            bGeo.scale(1.25, 1.25, 1.25);
            bGeo.translate(
              px - _right.x * side * (hWidth * 0.84),
              hy + hHeight * 0.78,
              pz - _right.z * side * (hWidth * 0.84),
            );
            hedgeBlossomGeos.push(bGeo);
          }
        }

        const stemGeo = new THREE.CylinderGeometry(0.04, 0.065, 0.45, 6);
        stemGeo.translate(hx, hy + 0.2, hz);
        hedgeStemGeos.push(stemGeo);
      });
    }

    // 2D. Crossing Gnarled Roots across the Broken Path edges (Zone 4 & Zone 5)
    if (u >= 0.58 && s % 3 === 0) {
      const side = (s % 2 === 0 ? 1 : -1) * (1.0 - (rand() > 0.7 ? 2 : 0));
      const startLat = side * (pathWidth * 0.5 + 1.45);
      const midLat = side * (pathWidth * 0.24);
      const endLat = side * (pathWidth * 0.04 * rand());

      const p0 = new THREE.Vector3(
        _pt.x + _right.x * startLat,
        groundY + 0.12,
        _pt.z + _right.z * startLat,
      );
      const p1 = new THREE.Vector3(
        _pt.x + _right.x * midLat + _tan.x * 0.35,
        groundY + 0.09,
        _pt.z + _right.z * midLat + _tan.z * 0.35,
      );
      const p2 = new THREE.Vector3(
        _pt.x + _right.x * endLat + _tan.x * 0.65,
        groundY + 0.02,
        _pt.z + _right.z * endLat + _tan.z * 0.65,
      );

      const rootCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const rTube = new THREE.TubeGeometry(
        rootCurve,
        10,
        0.045 + (u - 0.58) * 0.06,
        6,
        false,
      );
      rootGeos.push(rTube);
    }
  }

  if (slabGeometriesClean.length > 0) {
    const mergedCleanSlabs = tracker.trackGeo(
      mergeGeometries(slabGeometriesClean),
    );
    slabGeometriesClean.forEach((g) => g.dispose());
    const cleanSlabMesh = new THREE.Mesh(mergedCleanSlabs, weatheredSlabMat);
    cleanSlabMesh.receiveShadow = true;
    cleanSlabMesh.castShadow = true;
    pathAndTransitionGroup.add(cleanSlabMesh);
  }

  if (slabGeometriesMossy.length > 0) {
    const mergedMossySlabs = tracker.trackGeo(
      mergeGeometries(slabGeometriesMossy),
    );
    slabGeometriesMossy.forEach((g) => g.dispose());
    const mossySlabMesh = new THREE.Mesh(
      mergedMossySlabs,
      mossyCrackedSlabMat,
    );
    mossySlabMesh.receiveShadow = true;
    mossySlabMesh.castShadow = true;
    pathAndTransitionGroup.add(mossySlabMesh);
  }

  if (jointMossGeos.length > 0) {
    const mergedJointMoss = tracker.trackGeo(mergeGeometries(jointMossGeos));
    jointMossGeos.forEach((g) => g.dispose());
    const jointMossMesh = new THREE.Mesh(mergedJointMoss, mossVelvetMat);
    jointMossMesh.receiveShadow = true;
    pathAndTransitionGroup.add(jointMossMesh);
  }

  if (hedgeGeometriesTrimmed.length > 0) {
    const mergedTrimmedHedges = tracker.trackGeo(
      mergeGeometries(hedgeGeometriesTrimmed),
    );
    hedgeGeometriesTrimmed.forEach((g) => g.dispose());
    const trimmedHedgeMesh = new THREE.Mesh(
      mergedTrimmedHedges,
      hedgeFoliageMat,
    );
    trimmedHedgeMesh.castShadow = true;
    trimmedHedgeMesh.receiveShadow = true;
    pathAndTransitionGroup.add(trimmedHedgeMesh);
  }

  if (hedgeGeometriesOvergrown.length > 0) {
    const mergedOvergrownHedges = tracker.trackGeo(
      mergeGeometries(hedgeGeometriesOvergrown),
    );
    hedgeGeometriesOvergrown.forEach((g) => g.dispose());
    const overgrownHedgeMesh = new THREE.Mesh(
      mergedOvergrownHedges,
      overgrownHedgeMat,
    );
    overgrownHedgeMesh.castShadow = true;
    overgrownHedgeMesh.receiveShadow = true;
    pathAndTransitionGroup.add(overgrownHedgeMesh);
  }

  if (hedgeBlossomGeos.length > 0) {
    const mergedHedgeBlossoms = tracker.trackGeo(
      mergeGeometries(hedgeBlossomGeos),
    );
    hedgeBlossomGeos.forEach((g) => g.dispose());
    const blossomMesh = new THREE.Mesh(mergedHedgeBlossoms, flowerCreamMat);
    pathAndTransitionGroup.add(blossomMesh);
  }

  if (hedgeStemGeos.length > 0) {
    const mergedHedgeStems = tracker.trackGeo(mergeGeometries(hedgeStemGeos));
    hedgeStemGeos.forEach((g) => g.dispose());
    const stemMesh = new THREE.Mesh(mergedHedgeStems, weatheredOakMat);
    pathAndTransitionGroup.add(stemMesh);
  }

  if (rootGeos.length > 0) {
    const mergedRoots = tracker.trackGeo(mergeGeometries(rootGeos));
    rootGeos.forEach((g) => g.dispose());
    const rootMesh = new THREE.Mesh(mergedRoots, gnarledRootMat);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    pathAndTransitionGroup.add(rootMesh);
  }

  // ============================================================================
  // 2E. WARM WROUGHT-IRON GARDEN LANTERN POSTS WITH LOCALIZED POINTLIGHT POOLS
  //     (Illuminating the Greenhouse Exit, Topiaries, Reactive Plants & Forest Gate)
  // ============================================================================
  const gardenLightingGroup = new THREE.Group();
  gardenLightingGroup.name = 'EnchantedGardenLanternLighting';
  group.add(gardenLightingGroup);

  const lampPostBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.16, 0.22, 0.42, 8),
  );
  lampPostBaseGeo.translate(0, 0.21, 0);
  const lampPostShaftGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.055, 0.075, 2.55, 8),
  );
  lampPostShaftGeo.translate(0, 1.275, 0);
  const lampScrollArmGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.32, 0.025, 6, 16, Math.PI),
  );
  const lampHatGeo = tracker.trackGeo(new THREE.ConeGeometry(0.24, 0.18, 8));

  const gardenPointLights: Array<{
    light: THREE.PointLight;
    baseIntensity: number;
    phase: number;
  }> = [];

  // 1) Dedicated high-reach warm PointLight right at Gate 1 (Greenhouse Exit Archway)
  {
    const gate1Light = new THREE.PointLight('#ffe4b5', 8.5, 25.0, 1.05);
    gate1Light.position.set(0.35, 3.3, 0);
    exitPortalGroup.add(gate1Light);
    gardenPointLights.push({
      light: gate1Light,
      baseIntensity: 8.5,
      phase: 0.0,
    });
  }

  // 2) 6 Wrought-Iron Garden Lantern Posts along Zones 1–5 + 1 at Gate 2 (8 total warm PointLights)
  const lanternPostSpecs = [
    { u: 0.1, side: -1, lat: 2.35, tilt: 0.0, intensity: 8.6 }, // Zone 1/2 Entry & Wizard/Witch Topiaries
    { u: 0.24, side: 1, lat: 2.28, tilt: 0.01, intensity: 8.6 }, // Zone 2 Owl/Frog Topiaries & Mandrakes
    { u: 0.38, side: -1, lat: 2.22, tilt: -0.02, intensity: 8.8 }, // Zone 2/3 Stag/Bird + Bell Flowers & Bulbs
    { u: 0.52, side: 1, lat: 2.15, tilt: 0.03, intensity: 8.8 }, // Zone 3 Reactive Magical Flora Bend
    { u: 0.68, side: -1, lat: 2.05, tilt: -0.05, intensity: 8.4 }, // Zone 4 Dragon/Serpent & Moon Ferns
    { u: 0.84, side: 1, lat: 1.9, tilt: 0.07, intensity: 8.2 }, // Zone 5 Broken Path approach to Forest Gate
  ];

  lanternPostSpecs.forEach((lSpec, lIdx) => {
    const lPt = gardenSpline.getPointAt(lSpec.u);
    const lTan = gardenSpline.getTangentAt(lSpec.u).normalize();
    const lRight = new THREE.Vector3().crossVectors(lTan, _up).normalize();

    const lx = lPt.x + lRight.x * lSpec.side * lSpec.lat;
    const lz = lPt.z + lRight.z * lSpec.side * lSpec.lat;
    const ly = getTerrainHeight(lx, lz);

    const postGroup = new THREE.Group();
    postGroup.position.set(lx, ly, lz);
    // Point the scrolled lantern arm inward toward the center of the garden path
    const inwardYaw = Math.atan2(
      -lRight.x * lSpec.side,
      -lRight.z * lSpec.side,
    );
    postGroup.rotation.set(lSpec.tilt, inwardYaw, lSpec.tilt * 0.6);
    gardenLightingGroup.add(postGroup);

    const base = new THREE.Mesh(lampPostBaseGeo, weatheredSlabMat);
    const shaft = new THREE.Mesh(lampPostShaftGeo, mats.wroughtBronze);
    shaft.castShadow = true;

    const arm = new THREE.Mesh(lampScrollArmGeo, mats.wroughtBronze);
    arm.position.set(0, 2.48, 0.32);
    arm.rotation.y = Math.PI / 2;

    const cage = new THREE.Mesh(lanternCageGeo, mats.wroughtBronze);
    cage.position.set(0, 2.28, 0.62);
    const globe = new THREE.Mesh(lanternGlobeGeo, lanternAmberGlobeMat);
    globe.position.set(0, 2.28, 0.62);
    globe.scale.setScalar(1.22);
    const hat = new THREE.Mesh(lampHatGeo, mats.wroughtBronze);
    hat.position.set(0, 2.5, 0.62);

    postGroup.add(base, shaft, arm, cage, globe, hat);

    // High-reach localized warm PointLight illuminating nearby plants, topiaries & stone path
    const pLight = new THREE.PointLight(
      '#ffe4b5',
      lSpec.intensity,
      26.0,
      1.05,
    );
    pLight.position.set(0, 2.35, 0.68);
    postGroup.add(pLight);

    gardenPointLights.push({
      light: pLight,
      baseIntensity: lSpec.intensity,
      phase: (lIdx + 1) * 1.15,
    });
  });

  // ============================================================================
  // 3. ZONE 4 — OVERGROWN TRANSITION PROPS & GATE 2: ANCIENT FOREST ENTRANCE GATE
  // ============================================================================
  const zone4PropsGroup = new THREE.Group();
  zone4PropsGroup.name = 'Zone4_OvergrownTransitionProps';
  group.add(zone4PropsGroup);

  // 3A. Neglected Moss-Draped Garden Bench at u = 0.62 (Zone 4)
  {
    const benchPt = gardenSpline.getPointAt(0.62);
    const benchTan = gardenSpline.getTangentAt(0.62).normalize();
    const benchRight = new THREE.Vector3()
      .crossVectors(benchTan, _up)
      .normalize();
    const bx = benchPt.x - benchRight.x * 2.55;
    const bz = benchPt.z - benchRight.z * 2.55;
    const by = getTerrainHeight(bx, bz) - 0.02;

    const neglectedBench = createWeatheredGardenBench(true);
    neglectedBench.position.set(bx, by, bz);
    neglectedBench.rotation.set(
      0.05,
      Math.atan2(benchRight.x, benchRight.z),
      -0.06,
    );
    zone4PropsGroup.add(neglectedBench);
    colliders.push({ x: bx, z: bz, radius: 0.75 });
  }

  // 3B. Cracked/Tilted Stone Planters, Overturned Pots & Abandoned Copper Tools (Zone 4)
  const brokenPlanterU = [0.54, 0.71, 0.82];
  brokenPlanterU.forEach((bu, bIdx) => {
    const bPt = gardenSpline.getPointAt(bu);
    const bTan = gardenSpline.getTangentAt(bu).normalize();
    const bRight = new THREE.Vector3().crossVectors(bTan, _up).normalize();
    const side = bIdx % 2 === 0 ? 1 : -1;
    const lat = side * (2.15 + bIdx * 0.2);
    const px = bPt.x + bRight.x * lat;
    const pz = bPt.z + bRight.z * lat;
    const py = getTerrainHeight(px, pz) - 0.04;

    const brokenGroup = new THREE.Group();
    brokenGroup.position.set(px, py, pz);
    brokenGroup.rotation.set(
      (bIdx === 1 ? 0.38 : 0.14) * side,
      bIdx * 1.4,
      0.18,
    );
    zone4PropsGroup.add(brokenGroup);

    const potMesh = new THREE.Mesh(rectPlanterGeo, mossyCrackedSlabMat);
    potMesh.scale.set(0.68, 0.75, 0.68);
    potMesh.castShadow = true;
    brokenGroup.add(potMesh);

    const spillGeo = tracker.trackGeo(
      createOrganicFoliageClusterGeo(0.52, 0.26, 0.48, 0.28, 700 + bIdx),
    );
    spillGeo.translate(0.18, 0.35, 0.22);
    const spillMesh = new THREE.Mesh(spillGeo, overgrownHedgeMat);
    brokenGroup.add(spillMesh);

    if (bIdx === 0) {
      const abandonedCan = createCopperWateringCan(true);
      abandonedCan.position.set(0.62, 0.12, 0.25);
      abandonedCan.rotation.set(1.15, 0.4, 0.6);
      brokenGroup.add(abandonedCan);
    } else if (bIdx === 1) {
      const abandonedTools = createCopperGardeningToolSet();
      abandonedTools.position.set(-0.55, 0.04, 0.3);
      abandonedTools.rotation.set(1.22, 0.5, -0.4);
      brokenGroup.add(abandonedTools);
    }
  });

  // 3C. Instanced Tall Grass, Weeds & Fallen Leaves along Zone 4 & Zone 5
  const weedBladeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.065, 0.52, 4));
  weedBladeGeo.scale(1.0, 1.0, 0.35);
  weedBladeGeo.translate(0, 0.26, 0);
  const weedClumpGeo = tracker.trackGeo(
    mergeGeometries(
      [0, 1, 2, 3, 4].map((wIdx) => {
        const g = weedBladeGeo.clone();
        g.rotateX((wIdx % 2 === 0 ? 1 : -1) * 0.22);
        g.rotateY((wIdx * Math.PI * 2) / 5);
        g.translate(Math.cos(wIdx) * 0.06, 0, Math.sin(wIdx) * 0.06);
        return g;
      }),
    ),
  );
  const weedMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.78,
    }),
  );

  const weedCount = 220;
  const weedInst = new THREE.InstancedMesh(weedClumpGeo, weedMat, weedCount);
  weedInst.receiveShadow = true;
  const _dummy = new THREE.Object3D();
  const _col = new THREE.Color();
  const cGrassFresh = new THREE.Color('#4ca358');
  const cGrassWild = new THREE.Color('#658c46');
  const cFallenGold = new THREE.Color('#c79f4a');

  for (let i = 0; i < weedCount; i++) {
    const u = Math.pow(rand(), 0.68) * 0.92 + 0.06;
    gardenSpline.getPointAt(u, _pt);
    gardenSpline.getTangentAt(u, _tan).normalize();
    _right.crossVectors(_tan, _up).normalize();

    const side = rand() > 0.5 ? 1 : -1;
    // Keep weeds outside the central stone walk so they frame the pathway without hiding the stones
    const minLat = u < 0.55 ? 1.65 : 1.05;
    const lat = side * (minLat + rand() * 3.6);
    const wx = _pt.x + _right.x * lat + (rand() - 0.5) * 0.45;
    const wz = _pt.z + _right.z * lat + (rand() - 0.5) * 0.45;
    const wy = getTerrainHeight(wx, wz) - 0.02;

    const s = (0.55 + u * 0.85) * (0.75 + rand() * 0.5);
    _dummy.position.set(wx, wy, wz);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.2,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.2,
    );
    _dummy.scale.set(s, s * (0.8 + u * 0.5), s);
    _dummy.updateMatrix();
    weedInst.setMatrixAt(i, _dummy.matrix);

    if (u > 0.55 && rand() < 0.28) {
      _col.copy(cFallenGold);
    } else {
      _col.lerpColors(cGrassFresh, cGrassWild, u);
    }
    weedInst.setColorAt(i, _col);
  }
  weedInst.instanceMatrix.needsUpdate = true;
  if (weedInst.instanceColor) weedInst.instanceColor.needsUpdate = true;
  weedInst.computeBoundingSphere();
  zone4PropsGroup.add(weedInst);

  // ============================================================================
  // 3D. GATE 2 — PROMINENT 5.4m ANCIENT FOREST ENTRANCE GATEHOUSE ARCHWAY (u = 0.98)
  //     (Connected Directly to the Stone Pathway via a Carved Mossy Threshold Apron,
  //      Wing Curbs, Monolithic Rune Pillars, Gnarled Bough Arch & Twin Beacon Lanterns)
  // ============================================================================
  const forestGateGroup = new THREE.Group();
  forestGateGroup.name = 'Gate2_AncientForestThresholdPortal';
  {
    const endPt = gardenSpline.getPointAt(0.98);
    const endTan = gardenSpline.getTangentAt(0.98).normalize();
    const endYaw = Math.atan2(endTan.x, endTan.z);
    const endY = getTerrainHeight(endPt.x, endPt.z);

    forestGateGroup.position.set(endPt.x, endY, endPt.z);
    forestGateGroup.rotation.y = endYaw;
    zone4PropsGroup.add(forestGateGroup);

    // 1) Continuous Weathered Flagstone Threshold Apron & Wing Curbs tying Gate 2 directly into the pathway
    const forestThresholdSlabGeo = tracker.trackGeo(
      createBeveledBoxGeometry(3.4, 0.13, 3.2, 0.03),
    );
    const forestThresholdSlab = new THREE.Mesh(
      forestThresholdSlabGeo,
      weatheredSlabMat,
    );
    forestThresholdSlab.position.set(0, 0.0, 0);
    forestThresholdSlab.receiveShadow = true;

    const forestRuneSillGeo = tracker.trackGeo(
      createBeveledBoxGeometry(3.1, 0.145, 0.24, 0.015),
    );
    const forestRuneSill = new THREE.Mesh(forestRuneSillGeo, forestRuneCyanMat);
    forestRuneSill.position.set(0, 0.005, 0);
    forestGateGroup.add(forestThresholdSlab, forestRuneSill);

    // Stepping flagstones extending from z = -2.2m (approaching the gate) through z = +2.2m (into the forest)
    const gateStepStoneGeo = tracker.trackGeo(
      createBeveledBoxGeometry(1.65, 0.14, 0.68, 0.025),
    );
    [-2.1, -1.25, 1.25, 2.1].forEach((sz, sIdx) => {
      const st = new THREE.Mesh(
        gateStepStoneGeo,
        sIdx % 2 === 0 ? weatheredSlabMat : mossyCrackedSlabMat,
      );
      st.position.set((sIdx % 2 === 0 ? 1 : -1) * 0.08, 0.005, sz);
      st.rotation.y = (sIdx - 1.5) * 0.03;
      st.receiveShadow = true;
      forestGateGroup.add(st);
    });

    // Low mossy stone wing-curbs connecting the gate pillars to the pathway borders
    const wingCurbGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.42, 0.36, 2.6, 0.03),
    );
    [-1.95, 1.95].forEach((wx) => {
      const curb = new THREE.Mesh(wingCurbGeo, mossyCrackedSlabMat);
      curb.position.set(wx, 0, -0.95);
      curb.castShadow = true;
      curb.receiveShadow = true;
      forestGateGroup.add(curb);
    });

    const forestPillarGeo = tracker.trackGeo(
      createBeveledBoxGeometry(0.84, 4.15, 0.84, 0.055),
    );
    const forestCapGeo = tracker.trackGeo(
      createBeveledBoxGeometry(1.04, 0.28, 1.04, 0.04),
    );
    const runeSlotGeo = tracker.trackGeo(
      new THREE.BoxGeometry(0.18, 2.45, 0.88),
    );

    [-2.05, 2.05].forEach((latX, pIdx) => {
      const pillar = new THREE.Mesh(forestPillarGeo, mossyCrackedSlabMat);
      pillar.position.set(latX, 0, 0);
      pillar.rotation.z = (pIdx === 0 ? 1 : -1) * 0.02;
      pillar.castShadow = true;
      pillar.receiveShadow = true;

      const cap = new THREE.Mesh(forestCapGeo, weatheredSlabMat);
      cap.position.set(latX, 4.08, 0);
      cap.castShadow = true;

      // Glowing emerald-cyan forest rune inlay on the front & back of each monolithic pillar
      const runeStrip = new THREE.Mesh(runeSlotGeo, forestRuneCyanMat);
      runeStrip.position.set(latX, 2.1, 0);

      // Thick moss cap around each pillar
      const mossClusterGeo = tracker.trackGeo(
        createOrganicFoliageClusterGeo(0.58, 0.28, 0.58, 0.26, 991 + pIdx),
      );
      mossClusterGeo.translate(latX, 4.35, 0);
      const mossCap = new THREE.Mesh(mossClusterGeo, mossVelvetMat);

      forestGateGroup.add(pillar, cap, runeStrip, mossCap);

      // Hang warm forest beacon lanterns on BOTH approach (-Z) and forest (+Z) sides of each pillar
      [-1, 1].forEach((zSide) => {
        const arm = new THREE.Mesh(lanternArmGeo, mats.wroughtBronze);
        arm.rotation.y = Math.PI / 2;
        arm.position.set(latX, 3.25, zSide * 0.58);
        const cage = new THREE.Mesh(lanternCageGeo, mats.wroughtBronze);
        cage.position.set(latX, 3.05, zSide * 0.78);
        const globe = new THREE.Mesh(lanternGlobeGeo, lanternAmberGlobeMat);
        globe.scale.setScalar(1.25);
        globe.position.set(latX, 3.05, zSide * 0.78);
        forestGateGroup.add(arm, cage, globe);
      });

      // World collider for the monolithic gate pillar
      const wPillar = new THREE.Vector3(latX, 0, 0);
      forestGateGroup.localToWorld(wPillar);
      colliders.push({ x: wPillar.x, z: wPillar.z, radius: 0.78 });
    });

    // Overarching Gnarled Root-Woven Bough Archway & Carved Runic Keystone (height = 5.4m)
    const boughCurveA = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.05, 3.85, -0.12),
      new THREE.Vector3(-1.35, 4.88, 0.08),
      new THREE.Vector3(0.0, 5.32, -0.05),
      new THREE.Vector3(1.35, 4.88, 0.08),
      new THREE.Vector3(2.05, 3.85, -0.12),
    ]);
    const boughCurveB = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.05, 4.05, 0.14),
      new THREE.Vector3(-1.2, 5.05, -0.1),
      new THREE.Vector3(0.0, 5.42, 0.08),
      new THREE.Vector3(1.2, 5.05, -0.1),
      new THREE.Vector3(2.05, 4.05, 0.14),
    ]);
    const boughGeoA = tracker.trackGeo(
      new THREE.TubeGeometry(boughCurveA, 24, 0.16, 8, false),
    );
    const boughGeoB = tracker.trackGeo(
      new THREE.TubeGeometry(boughCurveB, 24, 0.12, 8, false),
    );
    const boughMeshA = new THREE.Mesh(boughGeoA, gnarledRootMat);
    boughMeshA.castShadow = true;
    const boughMeshB = new THREE.Mesh(boughGeoB, weatheredOakMat);
    boughMeshB.castShadow = true;
    forestGateGroup.add(boughMeshA, boughMeshB);

    // Glowing Runic Keystone at the apex of the Ancient Forest Gate
    const keystoneGeo = tracker.trackGeo(
      new THREE.OctahedronGeometry(0.36, 0),
    );
    keystoneGeo.scale(0.85, 1.35, 0.65);
    const keystoneMesh = new THREE.Mesh(keystoneGeo, forestRuneCyanMat);
    keystoneMesh.position.set(0, 5.52, 0);
    forestGateGroup.add(keystoneMesh);

    // Diegetic Carved Plaque on Gate 2: "THE ANCIENT FOREST"
    const gate2PlaqueTex = createGatePlaqueTexture(
      tracker,
      'THE ANCIENT FOREST',
      'Untamed Magical Wilds • Beyond the Garden',
      '#6ee7b7',
      '#10b981',
    );
    const gate2PlaqueMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: gate2PlaqueTex ?? undefined,
        emissive: new THREE.Color('#d1fae5'),
        emissiveMap: gate2PlaqueTex ?? undefined,
        emissiveIntensity: 0.62,
        roughness: 0.3,
      }),
    );
    const gate2BackingGeo = tracker.trackGeo(
      createBeveledBoxGeometry(2.45, 0.72, 0.18, 0.025),
    );
    const gate2Backing = new THREE.Mesh(gate2BackingGeo, mats.wroughtBronze);
    gate2Backing.position.set(0, 4.35, 0);
    const gate2FrontFace = new THREE.Mesh(plaqueFaceGeo, gate2PlaqueMat);
    gate2FrontFace.position.set(0, 4.71, -0.1);
    gate2FrontFace.rotation.y = Math.PI;
    const gate2BackFace = new THREE.Mesh(plaqueFaceGeo, gate2PlaqueMat);
    gate2BackFace.position.set(0, 4.71, 0.1);
    forestGateGroup.add(gate2Backing, gate2FrontFace, gate2BackFace);

    // Dedicated high-reach warm PointLight illuminating the Ancient Forest Gatehouse threshold
    const gate2Light = new THREE.PointLight('#ffe4b5', 9.0, 26.0, 1.05);
    gate2Light.position.set(0, 3.5, -0.4);
    forestGateGroup.add(gate2Light);
    gardenPointLights.push({
      light: gate2Light,
      baseIntensity: 9.0,
      phase: 3.14,
    });
  }

  // ============================================================================
  // 4. ATTACH ZONE 2 TOPIARY SYSTEM & ZONE 3 MAGICAL PLANT SYSTEM
  // ============================================================================
  const topiarySystem = createTopiarySystem();
  group.add(topiarySystem.group);
  colliders.push(...topiarySystem.colliders);

  const magicalPlantSystem = createMagicalPlantSystem();
  group.add(magicalPlantSystem.group);

  return {
    group,
    colliders,
    topiarySystem,
    magicalPlantSystem,

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
    ): void {
      // 0. Animate Directional Glowing Wave along the 9 Conservatory Stepping Stones
      //    (Ripples from the Royal Frog Pond -> Gate 1 so the player's eye follows it to the exit!)
      for (let i = 0; i < steppingStoneInlayMats.length; i++) {
        const wave = Math.sin(elapsedTime * 3.2 - i * 0.65) * 0.5 + 0.5;
        steppingStoneInlayMats[i].emissiveIntensity = 0.52 + wave * 0.42;
      }

      // 1. Gently flicker the 8 Warm Garden Lantern PointLights
      for (let i = 0; i < gardenPointLights.length; i++) {
        const gLight = gardenPointLights[i];
        const flicker =
          Math.sin(elapsedTime * 5.2 + gLight.phase) * 0.25 +
          Math.cos(elapsedTime * 8.7 + gLight.phase * 1.7) * 0.12;
        gLight.light.intensity = gLight.baseIntensity + flicker;
      }

      // 2. Animate Enchanted Levitating Copper Watering Can & Sparkling Water Stream in Zone 1
      const hoverBob = Math.sin(elapsedTime * 2.2) * 0.06;
      const tiltPour = 0.58 + Math.sin(elapsedTime * 1.5) * 0.12;
      enchantedCanRig.position.y = enchantedCanBaseY + hoverBob;
      floatingCanMeshGroup.rotation.x = tiltPour;

      for (let d = 0; d < waterDroplets.length; d++) {
        const prog = (elapsedTime * 1.45 + d / waterDroplets.length) % 1.0;
        const drop = waterDroplets[d];
        drop.position.set(
          (Math.sin(d * 2.1 + elapsedTime * 4.0) - 0.5) * 0.03,
          0.18 - prog * 0.78,
          0.36 + prog * 0.24,
        );
        drop.scale.setScalar(1.0 - prog * 0.45);
      }

      // 3. Update Zone 2 Living Topiaries & Zone 3 Bioluminescent Reactive Magical Flora
      topiarySystem.update(dt, elapsedTime, playerWorldPos);
      magicalPlantSystem.update(dt, elapsedTime, playerWorldPos);
    },

    dispose(): void {
      topiarySystem.dispose();
      magicalPlantSystem.dispose();
      tracker.dispose();
    },
  };
}
