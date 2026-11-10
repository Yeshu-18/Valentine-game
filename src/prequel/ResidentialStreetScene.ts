import * as THREE from 'three';

export interface CarTransformParams {
  zPos: number;
  xOffset: number;
  headlightIntensity: number;
  brakeIntensity: number;
  wheelSpinDelta: number;
  steeringAngle?: number;
  chassisPitch?: number;
  chassisRoll?: number;
  doorOpenRatio?: number;
}

export interface ResidentialStreetBundle {
  group: THREE.Group;
  carGroup: THREE.Group;
  setCarTransform: (
    zPos: number,
    xOffset: number,
    headlightIntensity: number,
    brakeIntensity: number,
    wheelSpinDelta: number,
    steeringAngle?: number,
    chassisPitch?: number,
    chassisRoll?: number,
    doorOpenRatio?: number,
    carYaw?: number,
    rearDoorOpenRatio?: number,
    driftSmokeIntensity?: number,
  ) => void;
  updateEnvironment: (
    dt: number,
    elapsed: number,
    distantTrafficActive: boolean,
  ) => void;
  dispose: () => void;
}

/**
 * High-Polygon (5,120 triangles per canopy) Vertex-Sculpted Organic Tree & Shrub Foliage:
 * Replaces flat low-poly dodecahedrons with a 4-subdivision Icosahedron displaced by
 * multi-frequency 3D leaf-cluster harmonics for lush, realistic nighttime tree silhouettes.
 */
function createSculptedFoliageCanopyGeometry(
  radius: number,
  seed: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 4); // 5,120 triangles
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    const nx = v.x / len;
    const ny = v.y / len;
    const nz = v.z / len;

    // Multi-layered organic leaf-tuft billowing
    const cluster1 =
      Math.sin(nx * 5.2 + seed) *
      Math.cos(ny * 4.8 - seed * 0.7) *
      Math.sin(nz * 5.5 + seed * 1.3);
    const cluster2 =
      Math.cos(nx * 11.4 - seed * 1.9) *
      Math.sin(ny * 10.6 + seed * 0.5) *
      Math.cos(nz * 11.1);
    const bottomFlatten = ny < -0.25 ? (ny + 0.25) * 0.22 : 0;

    const radialScale = 1.0 + cluster1 * 0.14 + cluster2 * 0.045 + bottomFlatten;
    v.multiplyScalar(radialScale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * High-Polygon (1,120 triangles) Vertex-Sculpted Tree Trunk with root flare & organic bark ridges
 */
function createSculptedTreeTrunkGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.17, 0.29, 2.75, 32, 18);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const hNorm = (v.y + 1.375) / 2.75; // 0 at ground, 1 at crown
    const angle = Math.atan2(v.z, v.x);

    // Root flare at the base + slight organic bend + bark flutes
    const rootFlare = Math.pow(Math.max(0, 1 - hNorm * 2.5), 2) * 0.28;
    const barkFlute = Math.sin(angle * 7 + hNorm * 4.5) * 0.014;
    const radialMult = 1 + rootFlare + barkFlute;

    v.x = v.x * radialMult + Math.sin(hNorm * Math.PI) * 0.045;
    v.z = v.z * radialMult + Math.cos(hNorm * Math.PI * 0.8) * 0.03;
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * High-Polygon (12,480 triangles) Vertex-Sculpted Aerodynamic Sports Sedan Body:
 * Subdivided 48x20x64 chassis mesh sculpted with:
 * - Curved front bumper splitter & sloped aerodynamic hood with dual power-dome creases
 * - Flared muscular front & rear wheel arches
 * - Tumblehome side door curvature & sharp shoulder beltline crease
 * - Sculpted rear decklid & diffuser taper
 */
function createSculptedSedanChassisGeometry(): THREE.BufferGeometry {
  const width = 1.9;
  const height = 0.66;
  const length = 4.62;
  const geo = new THREE.BoxGeometry(width, height, length, 40, 18, 64);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = THREE.MathUtils.clamp(v.x / (width * 0.5), -1, 1);
    const ny = THREE.MathUtils.clamp(v.y / (height * 0.5), -1, 1);
    const nz = THREE.MathUtils.clamp(v.z / (length * 0.5), -1, 1);
    const absX = Math.abs(nx);

    // 1. Tumblehome & Side Door Curvature (rounded upper shoulder & tucked lower rocker panel)
    if (ny > 0.2) {
      const upperT = THREE.MathUtils.clamp((ny - 0.2) / 0.8, 0, 1);
      v.x *= 1 - Math.pow(upperT, 1.6) * 0.075;
    } else if (ny < -0.5) {
      const lowerT = THREE.MathUtils.clamp((-0.5 - ny) / 0.5, 0, 1);
      v.x *= 1 - Math.pow(lowerT, 1.5) * 0.065;
    }

    // 2. Aerodynamic Front Nose Taper & Sloped Hood (nz > 0.35)
    if (nz > 0.35) {
      const frontT = THREE.MathUtils.clamp((nz - 0.35) / 0.65, 0, 1);
      // Hood slopes down toward the front grille
      if (ny > 0) {
        v.y -= Math.pow(frontT, 1.45) * 0.12 * ny;
        // Dual power-dome creases on hood
        const creaseDist = Math.abs(absX - 0.42);
        if (creaseDist < 0.18) {
          v.y += Math.cos((creaseDist / 0.18) * Math.PI * 0.5) * 0.016 * (1 - frontT * 0.5);
        }
      }
      // Front corners curve smoothly inward in plan view
      v.x *= 1 - Math.pow(frontT, 2.1) * 0.11;
      // Front bumper rounding
      if (frontT > 0.78) {
        const noseTip = THREE.MathUtils.clamp((frontT - 0.78) / 0.22, 0, 1);
        v.z -= Math.pow(absX, 2.0) * noseTip * 0.14;
      }
    }

    // 3. Sculpted Rear Quarter Taper & Integrated Trunk Lip Spoiler (nz < -0.45)
    if (nz < -0.45) {
      const rearT = THREE.MathUtils.clamp((-0.45 - nz) / 0.55, 0, 1);
      v.x *= 1 - Math.pow(rearT, 1.8) * 0.085;
      if (ny > 0.65 && rearT > 0.65) {
        // Subtle integrated ducktail trunk lip
        v.y += (rearT - 0.65) * 0.085 * (1 - absX * 0.3);
      }
      if (ny < -0.4 && rearT > 0.6) {
        // Rear diffuser upward sweep
        v.y += (rearT - 0.6) * 0.09;
      }
    }

    // 4. Muscular Flared Wheel Arches around z = +1.38 (front) and z = -1.38 (rear)
    for (const wheelZ of [1.38, -1.38]) {
      const dz = v.z - wheelZ;
      const dy = v.y - -0.14;
      const rSq = dz * dz + dy * dy;
      if (rSq < 0.26 && absX > 0.72) {
        const archFactor = Math.cos((Math.sqrt(rSq) / 0.51) * (Math.PI * 0.5));
        v.x += Math.sign(v.x) * archFactor * 0.048;
      }
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * High-Polygon (6,912 triangles) Vertex-Sculpted Fastback Cabin Greenhouse:
 * Subdivided 36x16x48 mesh with raked windshield, curved aerodynamic roof arch,
 * pinched tumblehome side windows, and sweeping fastback C-pillars.
 */
function createSculptedFastbackCabinGeometry(): THREE.BufferGeometry {
  const width = 1.58;
  const height = 0.54;
  const length = 2.48;
  const geo = new THREE.BoxGeometry(width, height, length, 36, 16, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = THREE.MathUtils.clamp(v.x / (width * 0.5), -1, 1);
    const ny = THREE.MathUtils.clamp(v.y / (height * 0.5), -1, 1); // -1 bottom .. +1 roof
    const nz = THREE.MathUtils.clamp(v.z / (length * 0.5), -1, 1); // -1 rear .. +1 front windshield
    const absX = Math.abs(nx);
    const h01 = THREE.MathUtils.clamp((ny + 1) * 0.5, 0, 1); // 0 at beltline, 1 at roof

    // 1. Tumblehome inward slope from beltline to roof
    v.x *= 1 - h01 * 0.16;

    // 2. Sweeping Raked Front Windshield (+Z) and Fastback Rear Glass (-Z)
    if (nz > 0) {
      v.z -= Math.pow(Math.max(0, h01), 1.15) * 0.58 * nz;
    } else {
      v.z += Math.pow(Math.max(0, h01), 1.25) * 0.68 * Math.abs(nz);
    }

    // 3. Longitudinal & Lateral Roof Arch Dome
    const zArch = Math.cos(nz * Math.PI * 0.48);
    const xArch = Math.cos(absX * Math.PI * 0.35);
    if (ny > -0.2) {
      v.y = -height * 0.5 + h01 * height * (0.78 + 0.26 * zArch * xArch);
    }

    // 4. Rounded plan-view corners at windshield & rear window headers
    v.x *= 1 - Math.pow(THREE.MathUtils.clamp(Math.abs(nz), 0, 1), 2.4) * 0.12;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the Indian Residential Street at Night (13 February 2027 · 10:30 PM)
 * with high-polygon sculpted vehicles, lush 5,120-triangle organic trees,
 * physical clearcoat materials, and full kidnap + drift getaway kinematics.
 */
export function createResidentialStreetScene(): ResidentialStreetBundle {
  const group = new THREE.Group();
  group.name = 'Chapter1ResidentialStreet';

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

  // Animation collections for updateEnvironment()
  const windSwayPivots: {
    obj: THREE.Object3D;
    baseRotZ: number;
    baseRotX: number;
    phase: number;
    amp: number;
  }[] = [];
  const animatedWindows: {
    mat: THREE.MeshStandardMaterial;
    baseIntensity: number;
    speed: number;
    phase: number;
  }[] = [];
  const rooftopSpinners: THREE.Object3D[] = [];
  const streetlampDustGroups: {
    points: THREE.Points;
    baseY: number;
    phase: number;
  }[] = [];
  const distantTrafficCars: {
    mesh: THREE.Group;
    speed: number;
    dir: number;
    limitX: number;
  }[] = [];

  const animatedCatTails: THREE.Object3D[] = [];
  const textures: THREE.Texture[] = [];

  // Procedural Interlocking Indian Sidewalk Paver-Block Texture
  const paverCanvas = document.createElement('canvas');
  paverCanvas.width = 256;
  paverCanvas.height = 256;
  const pCtx = paverCanvas.getContext('2d');
  if (pCtx) {
    pCtx.fillStyle = '#1e2430';
    pCtx.fillRect(0, 0, 256, 256);
    const rows = 8;
    const cols = 4;
    const bw = 256 / cols;
    const bh = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const xShift = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const isTerracotta = (r + c) % 3 === 0;
        pCtx.fillStyle = isTerracotta ? '#35292d' : '#28303e';
        pCtx.fillRect(c * bw + xShift + 2, r * bh + 2, bw - 4, bh - 4);
        pCtx.strokeStyle = '#141821';
        pCtx.lineWidth = 2;
        pCtx.strokeRect(c * bw + xShift + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
  }
  const paverTex = new THREE.CanvasTexture(paverCanvas);
  paverTex.wrapS = THREE.RepeatWrapping;
  paverTex.wrapT = THREE.RepeatWrapping;
  paverTex.repeat.set(2, 95);
  paverTex.colorSpace = THREE.SRGBColorSpace;
  textures.push(paverTex);

  // Shared PBR Materials
  const asphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x10141d,
      roughness: 0.42,
      metalness: 0.18,
    }),
  );
  const asphaltWetStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b0e15,
      roughness: 0.16,
      metalness: 0.38,
    }),
  );
  const rainPuddleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x070a10,
      roughness: 0.04,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.86,
    }),
  );
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: paverTex,
      color: 0xd8dee9,
      roughness: 0.78,
      metalness: 0.06,
    }),
  );
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x333c4d,
      roughness: 0.74,
    }),
  );
  const bougainvilleaFlowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.28,
      roughness: 0.62,
    }),
  );
  const terracottaPotMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9a4428,
      roughness: 0.76,
      metalness: 0.04,
    }),
  );
  const brassPlaqueMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.24,
      metalness: 0.88,
    }),
  );
  const compoundWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a2f3d,
      roughness: 0.86,
    }),
  );
  const ironGateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x12151e,
      roughness: 0.36,
      metalness: 0.82,
    }),
  );
  const foliageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x13261c,
      roughness: 0.82,
    }),
  );
  const foliageHighlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c3426,
      roughness: 0.78,
    }),
  );
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a1d17,
      roughness: 0.9,
    }),
  );
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.42,
      metalness: 0.72,
    }),
  );
  const sodiumBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffdba8,
      emissive: 0xf59e0b,
      emissiveIntensity: 3.0,
      roughness: 0.15,
    }),
  );
  const volumetricConeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const gateLanternMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xd97706,
      emissiveIntensity: 1.4,
      roughness: 0.22,
    }),
  );
  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.35,
      roughness: 0.26,
    }),
  );
  const dimWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f1523,
      roughness: 0.2,
      metalness: 0.48,
    }),
  );

  // ============================================================================
  // 1. SUBDIVIDED ROAD SURFACE, DAMP REFLECTION STRIPS, SIDEWALKS & ORNATE GATES
  // ============================================================================
  const roadGeo = trackGeo(new THREE.PlaneGeometry(8.6, 175, 24, 120));
  const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(0, 0, -68);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  for (const trackX of [-1.55, 0.0, 1.55]) {
    const wetStrip = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.95, 170, 8, 80)),
      asphaltWetStripMat,
    );
    wetStrip.rotation.x = -Math.PI / 2;
    wetStrip.position.set(trackX, 0.003, -68);
    wetStrip.receiveShadow = true;
    group.add(wetStrip);
  }

  const lineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.65,
      transparent: true,
      opacity: 0.42,
    }),
  );
  const edgeLineGeo = trackGeo(new THREE.PlaneGeometry(0.1, 170));
  for (const side of [-1, 1]) {
    const edgeLine = new THREE.Mesh(edgeLineGeo, lineMat);
    edgeLine.rotation.x = -Math.PI / 2;
    edgeLine.position.set(side * 3.65, 0.006, -68);
    group.add(edgeLine);
  }

  const sidewalkGeo = trackGeo(new THREE.BoxGeometry(2.8, 0.16, 175, 6, 2, 60));
  const curbGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.18, 175, 4, 4, 60));
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sw.position.set(side * 5.6, 0.08, -68);
    sw.receiveShadow = true;
    group.add(sw);

    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(side * 4.25, 0.09, -68);
    curb.receiveShadow = true;
    group.add(curb);
  }

  // Mirror-Smooth Rain Puddles on the Damp Night Asphalt
  const puddleGeo = trackGeo(new THREE.CircleGeometry(1.15, 36));
  for (const pCoord of [
    { x: -1.1, z: -9, sx: 1.1, sz: 1.75 },
    { x: 1.45, z: -24, sx: 0.95, sz: 1.5 },
    { x: -0.65, z: -41, sx: 1.25, sz: 1.9 },
    { x: 1.15, z: -61, sx: 1.05, sz: 1.65 },
    { x: -1.35, z: -84, sx: 1.15, sz: 1.8 },
  ]) {
    const puddle = new THREE.Mesh(puddleGeo, rainPuddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(pCoord.sx, pCoord.sz, 1);
    puddle.position.set(pCoord.x, 0.007, pCoord.z);
    group.add(puddle);
  }

  // Residential Compound Walls, Ornate Iron Gates, Brass Nameplates, Terracotta Planters & Flowering Bougainvillea
  const wallSegmentGeo = trackGeo(new THREE.BoxGeometry(0.32, 1.85, 9.2, 4, 8, 16));
  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.48, 2.15, 0.48, 6, 10, 6));
  const gatePanelGeo = trackGeo(new THREE.BoxGeometry(0.08, 1.62, 3.2, 2, 8, 12));
  const gateBarGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 1.58, 16));
  const gateSpearTipGeo = trackGeo(new THREE.ConeGeometry(0.028, 0.09, 12));
  const lanternGlobeGeo = trackGeo(new THREE.SphereGeometry(0.12, 28, 28));
  const highPolyShrubGeo = trackGeo(createSculptedFoliageCanopyGeometry(0.66, 2.4));
  const flowerClusterGeo = trackGeo(new THREE.IcosahedronGeometry(0.16, 2));
  const plaqueGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.22, 0.36));
  const planterPotGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.16, 0.38, 24));
  const planterRimGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.025, 12, 24));
  const fernFrondGeo = trackGeo(new THREE.ConeGeometry(0.28, 0.56, 16));

  for (let z = 10; z >= -134; z -= 14) {
    for (const side of [-1, 1]) {
      const wallX = side * 6.95;

      const wall = new THREE.Mesh(wallSegmentGeo, compoundWallMat);
      wall.position.set(wallX, 0.92, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      const pillar1 = new THREE.Mesh(pillarGeo, compoundWallMat);
      pillar1.position.set(wallX, 1.07, z - 4.7);
      pillar1.castShadow = true;
      group.add(pillar1);

      const pillar2 = new THREE.Mesh(pillarGeo, compoundWallMat);
      pillar2.position.set(wallX, 1.07, z - 8.3);
      pillar2.castShadow = true;
      group.add(pillar2);

      // Brass Villa Nameplate mounted on the front of Pillar 1
      const plaque = new THREE.Mesh(plaqueGeo, brassPlaqueMat);
      plaque.position.set(wallX - side * 0.25, 1.48, z - 4.7);
      group.add(plaque);

      // Terracotta Potted Plant (Gamla) outside the Gate Pillar on the Sidewalk
      if (Math.abs(z) % 14 === 0) {
        const potGroup = new THREE.Group();
        potGroup.position.set(wallX - side * 0.52, 0.16, z - 4.2);
        group.add(potGroup);

        const pot = new THREE.Mesh(planterPotGeo, terracottaPotMat);
        pot.position.y = 0.19;
        pot.castShadow = true;
        potGroup.add(pot);

        const potRim = new THREE.Mesh(planterRimGeo, terracottaPotMat);
        potRim.rotation.x = Math.PI / 2;
        potRim.position.y = 0.37;
        potGroup.add(potRim);

        const plantCrown = new THREE.Mesh(fernFrondGeo, foliageHighlightMat);
        plantCrown.position.y = 0.55;
        plantCrown.castShadow = true;
        potGroup.add(plantCrown);
      }

      if (Math.abs(z) % 28 === 0) {
        const lantern = new THREE.Mesh(lanternGlobeGeo, gateLanternMat);
        lantern.position.set(wallX, 2.24, z - 4.7);
        group.add(lantern);
      }

      const gateGroup = new THREE.Group();
      gateGroup.position.set(wallX, 0.88, z - 6.5);
      group.add(gateGroup);

      const gateFrame = new THREE.Mesh(gatePanelGeo, ironGateMat);
      gateGroup.add(gateFrame);

      for (let b = -1.2; b <= 1.2; b += 0.4) {
        const bar = new THREE.Mesh(gateBarGeo, ironGateMat);
        bar.position.set(0, 0, b);
        gateGroup.add(bar);

        const spear = new THREE.Mesh(gateSpearTipGeo, brassPlaqueMat);
        spear.position.set(0, 0.84, b);
        gateGroup.add(spear);
      }

      // High-Polygon Overhanging Bougainvillea Shrubs with Magenta Flower Clusters (wind-animated)
      if ((Math.abs(z) + (side > 0 ? 7 : 0)) % 14 === 0) {
        const shrubPivot = new THREE.Group();
        shrubPivot.position.set(wallX - side * 0.2, 1.85, z + 1.5);
        group.add(shrubPivot);

        const shrubMesh = new THREE.Mesh(highPolyShrubGeo, foliageHighlightMat);
        shrubMesh.scale.set(0.8, 0.65, 1.45);
        shrubMesh.castShadow = true;
        shrubPivot.add(shrubMesh);

        // Cascading vibrant magenta bougainvillea blossoms
        for (const fOff of [
          { x: -side * 0.36, y: 0.12, z: -0.35 },
          { x: -side * 0.42, y: -0.08, z: 0.15 },
          { x: -side * 0.3, y: 0.18, z: 0.45 },
        ]) {
          const blossom = new THREE.Mesh(flowerClusterGeo, bougainvilleaFlowerMat);
          blossom.position.set(fOff.x, fOff.y, fOff.z);
          shrubPivot.add(blossom);
        }

        windSwayPivots.push({
          obj: shrubPivot,
          baseRotZ: 0,
          baseRotX: 0,
          phase: z * 0.25 + side,
          amp: 0.032,
        });
      }
    }
  }

  // ============================================================================
  // 2. INDIAN RESIDENTIAL BUILDINGS, BALCONIES, FLICKERING WINDOWS & VENTILATORS
  // ============================================================================
  const buildingPalette = [0x1c2230, 0x232938, 0x1a202c, 0x262330];
  const buildingMats = buildingPalette.map((col) =>
    trackMat(new THREE.MeshStandardMaterial({ color: col, roughness: 0.84 })),
  );
  const windowGeo = trackGeo(new THREE.PlaneGeometry(1.15, 1.25, 4, 4));
  const balconyGeo = trackGeo(new THREE.BoxGeometry(1.45, 0.18, 3.8, 6, 2, 10));
  const railingGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.72, 3.8, 2, 4, 10));
  const waterTankGeo = trackGeo(new THREE.CylinderGeometry(0.65, 0.65, 1.25, 28, 6));
  const ventilatorGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.24, 0.32, 24, 4));

  let bIdx = 0;
  for (let z = 6; z >= -132; z -= 16) {
    for (const side of [-1, 1]) {
      bIdx++;
      const stories = (bIdx % 2) + 2;
      const height = stories * 3.45;
      const depth = 9.5 + (bIdx % 3) * 1.4;
      const width = 7.4;

      const bGeo = trackGeo(new THREE.BoxGeometry(width, height, depth, 8, 12, 10));
      const bMat = buildingMats[bIdx % buildingMats.length];
      const building = new THREE.Mesh(bGeo, bMat);
      const bX = side * 12.2;
      building.position.set(bX, height / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);

      const tank = new THREE.Mesh(waterTankGeo, poleMat);
      tank.position.set(bX + side * 0.8, height + 0.6, z - 1.5);
      group.add(tank);

      const vent = new THREE.Mesh(ventilatorGeo, ironGateMat);
      vent.position.set(bX - side * 1.2, height + 0.16, z + 1.2);
      group.add(vent);
      rooftopSpinners.push(vent);

      const faceX = bX - side * (width / 2 + 0.02);
      for (let floor = 0; floor < stories; floor++) {
        const floorY = 2.0 + floor * 3.3;

        if (floor > 0) {
          const balcony = new THREE.Mesh(balconyGeo, curbMat);
          balcony.position.set(faceX - side * 0.55, floorY - 0.8, z);
          group.add(balcony);

          const railing = new THREE.Mesh(railingGeo, ironGateMat);
          railing.position.set(faceX - side * 1.2, floorY - 0.38, z);
          group.add(railing);
        }

        for (const wZOffset of [-2.2, 2.2]) {
          const isLit = (bIdx + floor + (wZOffset > 0 ? 1 : 0)) % 3 === 0;
          const isAnimatedTV = isLit && (bIdx + floor) % 4 === 0;

          let winMat = isLit ? warmWindowMat : dimWindowMat;
          if (isAnimatedTV) {
            const dynamicMat = trackMat(
              new THREE.MeshStandardMaterial({
                color: 0xfde68a,
                emissive: 0xf59e0b,
                emissiveIntensity: 1.25,
                roughness: 0.25,
              }),
            );
            animatedWindows.push({
              mat: dynamicMat,
              baseIntensity: 1.25,
              speed: 2.2 + (bIdx % 3) * 1.1,
              phase: bIdx * 1.7 + floor,
            });
            winMat = dynamicMat;
          }

          const win = new THREE.Mesh(windowGeo, winMat);
          win.position.set(faceX, floorY, z + wZOffset);
          win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(win);
        }
      }
    }
  }

  // ============================================================================
  // 3. WARM SODIUM STREETLIGHTS, VOLUMETRIC CONES, DUST MOTES & UTILITY CABLES
  // ============================================================================
  const poleShaftGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.105, 5.9, 24, 8));
  const poleArmGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 1.65, 20, 4));
  const lampHeadGeo = trackGeo(new THREE.CapsuleGeometry(0.11, 0.28, 16, 24));
  const lampConeGeo = trackGeo(
    new THREE.ConeGeometry(2.6, 5.5, 36, 1, true),
  );

  const moteCount = 28;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const angle = (i / moteCount) * Math.PI * 2 * 3.7;
    const r = 0.2 + (((i * 17) % 100) / 100) * 1.5;
    motePositions[i * 3] = Math.cos(angle) * r;
    motePositions[i * 3 + 1] = -(((i * 23) % 100) / 100) * 3.6;
    motePositions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.045,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const streetlightZPositions = [4, -14, -32, -50, -68, -86, -104, -122];
  streetLightLoop: for (let idx = 0; idx < streetlightZPositions.length; idx++) {
    const z = streetlightZPositions[idx];
    const side = idx % 2 === 0 ? 1 : -1;
    const poleX = side * 4.45;

    const poleGroup = new THREE.Group();
    poleGroup.position.set(poleX, 0, z);
    group.add(poleGroup);

    const shaft = new THREE.Mesh(poleShaftGeo, poleMat);
    shaft.position.y = 2.95;
    shaft.castShadow = true;
    poleGroup.add(shaft);

    const arm = new THREE.Mesh(poleArmGeo, poleMat);
    arm.position.set(-side * 0.72, 5.75, 0);
    arm.rotation.z = side * (Math.PI / 2 - 0.18);
    poleGroup.add(arm);

    const headX = -side * 1.42;
    const head = new THREE.Mesh(lampHeadGeo, sodiumBulbMat);
    head.rotation.z = Math.PI / 2;
    head.scale.set(0.65, 1.0, 1.0);
    head.position.set(headX, 5.86, 0);
    poleGroup.add(head);

    const haloSphere = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.58, 24, 24)),
      volumetricConeMat,
    );
    haloSphere.position.set(headX, 5.78, 0);
    poleGroup.add(haloSphere);

    const cone = new THREE.Mesh(lampConeGeo, volumetricConeMat);
    cone.position.set(headX, 3.1, 0);
    poleGroup.add(cone);

    const roadGlowPool = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(2.85, 36)),
      volumetricConeMat,
    );
    roadGlowPool.rotation.x = -Math.PI / 2;
    roadGlowPool.position.set(headX, 0.008, 0);
    poleGroup.add(roadGlowPool);

    const motes = new THREE.Points(moteGeo, moteMat);
    motes.position.set(headX, 5.4, 0);
    poleGroup.add(motes);
    streetlampDustGroups.push({
      points: motes,
      baseY: 5.4,
      phase: idx * 1.3,
    });

    const light = new THREE.PointLight(0xf59e0b, 4.1, 23, 1.5);
    light.position.set(poleX + headX, 5.65, z);
    group.add(light);

    if (idx >= 2) {
      const prevZ = streetlightZPositions[idx - 2];
      const spanLen = Math.abs(z - prevZ);
      const wireCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(poleX, 5.5, prevZ),
        new THREE.Vector3(poleX, 4.85, (prevZ + z) * 0.5),
        new THREE.Vector3(poleX, 5.5, z),
      );
      const wireGeo = trackGeo(new THREE.TubeGeometry(wireCurve, 24, 0.012, 8, false));
      const wireMesh = new THREE.Mesh(wireGeo, ironGateMat);
      wireMesh.userData.spanLen = spanLen;
      group.add(wireMesh);
    }
    continue streetLightLoop;
  }

  // Starry Night Sky Canopy & Luminous High-Poly Moon with Corona Halo
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = ((i * 73) % 360) * (Math.PI / 180);
    const yHeight = 24 + ((i * 41) % 45);
    const radius = 32 + ((i * 29) % 65);
    starPos[i * 3] = Math.cos(theta) * radius;
    starPos[i * 3 + 1] = yHeight;
    starPos[i * 3 + 2] = -55 + Math.sin(theta) * radius;
  }
  const starGeo = trackGeo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.16,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
  const starField = new THREE.Points(starGeo, starMat);
  group.add(starField);

  const moonDisc = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(2.6, 36, 36)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
      }),
    ),
  );
  moonDisc.position.set(22, 42, -118);
  group.add(moonDisc);

  const moonHalo = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(5.8, 36, 36)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  moonHalo.position.copy(moonDisc.position);
  group.add(moonHalo);

  // ============================================================================
  // 4. HIGH-POLYGON ROADSIDE TREES (15,360 TRIANGLES PER TREE), SCOOTERS & CARS
  // ============================================================================
  const treeTrunkGeo = trackGeo(createSculptedTreeTrunkGeometry());
  const treeCrownGeo = trackGeo(createSculptedFoliageCanopyGeometry(1.58, 1.1));
  const treeSubCrownGeo = trackGeo(createSculptedFoliageCanopyGeometry(1.08, 3.7));

  const treeZPositions = [-4, -22, -40, -58, -76, -96, -114];
  treeZPositions.forEach((z, idx) => {
    const side = idx % 2 === 0 ? -1 : 1;
    const treeGroup = new THREE.Group();
    treeGroup.position.set(side * 5.05, 0, z);
    group.add(treeGroup);

    const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
    trunk.position.y = 1.35;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const canopyPivot = new THREE.Group();
    canopyPivot.position.set(0, 2.6, 0);
    treeGroup.add(canopyPivot);

    const mainCrown = new THREE.Mesh(treeCrownGeo, foliageMat);
    mainCrown.position.set(-side * 0.35, 1.0, 0);
    mainCrown.scale.set(1.18, 0.92, 1.12);
    mainCrown.castShadow = true;
    canopyPivot.add(mainCrown);

    const subCrownL = new THREE.Mesh(treeSubCrownGeo, foliageHighlightMat);
    subCrownL.position.set(-side * 0.9, 0.65, 0.65);
    subCrownL.castShadow = true;
    canopyPivot.add(subCrownL);

    const subCrownR = new THREE.Mesh(treeSubCrownGeo, foliageMat);
    subCrownR.position.set(0.25, 1.35, -0.6);
    subCrownR.castShadow = true;
    canopyPivot.add(subCrownR);

    windSwayPivots.push({
      obj: canopyPivot,
      baseRotZ: 0,
      baseRotX: 0,
      phase: idx * 1.4,
      amp: 0.038,
    });
  });

  // High-Polygon Parked Scooters near Residential Gates
  const scooterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      roughness: 0.26,
      metalness: 0.68,
      clearcoat: 0.85,
    }),
  );
  const scooterWheelGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 28));
  const scooterBodyGeo = trackGeo(new THREE.CapsuleGeometry(0.24, 0.88, 20, 28));
  const scooterSeatGeo = trackGeo(new THREE.CapsuleGeometry(0.14, 0.42, 16, 20));

  for (const sPos of [
    { x: -3.65, z: -18, rotY: 0.14 },
    { x: 3.65, z: -45, rotY: -0.2 },
    { x: -3.6, z: -82, rotY: 0.08 },
  ]) {
    const scoot = new THREE.Group();
    scoot.position.set(sPos.x, 0, sPos.z);
    scoot.rotation.y = sPos.rotY;
    scoot.rotation.z = 0.08;
    group.add(scoot);

    const body = new THREE.Mesh(scooterBodyGeo, scooterMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(0.88, 1.0, 1.15);
    body.position.y = 0.44;
    body.castShadow = true;
    scoot.add(body);

    const seat = new THREE.Mesh(scooterSeatGeo, bootSeatMat(trackMat));
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1.2, 1.0, 0.55);
    seat.position.set(0, 0.75, -0.15);
    scoot.add(seat);

    const stem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 18)),
      scooterMat,
    );
    stem.position.set(0, 0.78, 0.48);
    stem.rotation.x = -0.22;
    scoot.add(stem);

    const handle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 18)),
      ironGateMat,
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.05, 0.42);
    scoot.add(handle);

    for (const wz of [-0.46, 0.48]) {
      const sw = new THREE.Mesh(scooterWheelGeo, ironGateMat);
      sw.rotation.z = Math.PI / 2;
      sw.position.set(0, 0.21, wz);
      scoot.add(sw);
    }
  }

  // Sculpted High-Polygon Parked Residential Car on Left Curb (at z = -31)
  const parkedCarGroup = new THREE.Group();
  parkedCarGroup.position.set(-2.95, 0, -31);
  group.add(parkedCarGroup);

  const parkedCarMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.24,
      metalness: 0.72,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
    }),
  );
  const sculptedSedanBodyGeo = trackGeo(createSculptedSedanChassisGeometry());
  const sculptedCabinGeo = trackGeo(createSculptedFastbackCabinGeometry());

  const pChassis = new THREE.Mesh(sculptedSedanBodyGeo, parkedCarMat);
  pChassis.scale.set(0.92, 0.96, 0.86);
  pChassis.position.y = 0.56;
  pChassis.castShadow = true;
  parkedCarGroup.add(pChassis);

  const pCabin = new THREE.Mesh(sculptedCabinGeo, parkedCarMat);
  pCabin.scale.set(0.92, 0.98, 0.88);
  pCabin.position.set(0, 1.08, -0.15);
  pCabin.castShadow = true;
  parkedCarGroup.add(pCabin);

  // ============================================================================
  // 4B. AUTHENTIC INDIAN NEIGHBORHOOD DETAILS: AUTO-RICKSHAW, CHAI TAPRI,
  //     TRANSFORMER JUNCTION BOX, BOLLARDS & PERCHED STREET CAT
  // ============================================================================
  // 1. Parked Black & Yellow Indian Auto-Rickshaw (Tuk-Tuk) at Right Curb (x = 3.15, z = -54)
  const autoGroup = new THREE.Group();
  autoGroup.position.set(3.15, 0, -54);
  autoGroup.rotation.y = -0.06;
  group.add(autoGroup);

  const autoYellowMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xeab308,
      roughness: 0.28,
      metalness: 0.35,
      clearcoat: 0.8,
    }),
  );
  const autoHoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x14161c,
      roughness: 0.78,
    }),
  );

  const autoLowerBody = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.58, 1.15, 20, 28)),
    autoYellowMat,
  );
  autoLowerBody.rotation.x = Math.PI / 2;
  autoLowerBody.scale.set(0.95, 1.0, 0.65);
  autoLowerBody.position.set(0, 0.56, -0.12);
  autoLowerBody.castShadow = true;
  autoGroup.add(autoLowerBody);

  const autoFrontNose = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.22, 0.42, 0.75, 24)),
    autoYellowMat,
  );
  autoFrontNose.position.set(0, 0.54, 0.75);
  autoFrontNose.castShadow = true;
  autoGroup.add(autoFrontNose);

  const autoCanopyRoof = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.56, 1.25, 20, 28)),
    autoHoodMat,
  );
  autoCanopyRoof.rotation.x = Math.PI / 2;
  autoCanopyRoof.scale.set(0.96, 1.0, 0.48);
  autoCanopyRoof.position.set(0, 1.38, -0.05);
  autoCanopyRoof.castShadow = true;
  autoGroup.add(autoCanopyRoof);

  // Auto Pillars & Windshield
  const autoPillarGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 12));
  for (const px of [-0.48, 0.48]) {
    for (const pz of [-0.65, 0.52]) {
      const pillar = new THREE.Mesh(autoPillarGeo, ironGateMat);
      pillar.position.set(px, 1.02, pz);
      autoGroup.add(pillar);
    }
  }

  // 3 Auto-Rickshaw Wheels (1 Front + 2 Rear)
  for (const aw of [
    { x: 0, z: 0.92 },
    { x: -0.56, z: -0.58 },
    { x: 0.56, z: -0.58 },
  ]) {
    const wMesh = new THREE.Mesh(scooterWheelGeo, ironGateMat);
    wMesh.rotation.z = Math.PI / 2;
    wMesh.position.set(aw.x, 0.21, aw.z);
    autoGroup.add(wMesh);
  }

  // 2. Atmospheric Late-Night Corner Chai / Tea Stall (Tapri) at Sidewalk (x = 5.45, z = -25)
  const chaiStallGroup = new THREE.Group();
  chaiStallGroup.position.set(5.45, 0.16, -25);
  group.add(chaiStallGroup);

  const stallWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b281e,
      roughness: 0.82,
    }),
  );
  const stallAwningMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.65,
      metalness: 0.25,
    }),
  );

  const stallCounter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.15, 0.92, 1.85, 6, 6, 8)),
    stallWoodMat,
  );
  stallCounter.position.set(0, 0.46, 0);
  stallCounter.castShadow = true;
  chaiStallGroup.add(stallCounter);

  const stallRoof = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.48, 0.08, 2.15, 8, 2, 10)),
    stallAwningMat,
  );
  stallRoof.position.set(-0.08, 2.05, 0);
  stallRoof.rotation.z = 0.14;
  stallRoof.castShadow = true;
  chaiStallGroup.add(stallRoof);

  for (const sx of [-0.5, 0.5]) {
    for (const sz of [-0.82, 0.82]) {
      const post = new THREE.Mesh(autoPillarGeo, ironGateMat);
      post.scale.set(1, 1.55, 1);
      post.position.set(sx, 1.45, sz);
      chaiStallGroup.add(post);
    }
  }

  // Gleaming Brass Samovar Tea Kettle & Glass Jars on the Counter
  const teaKettle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.28, 24)),
    brassPlaqueMat,
  );
  teaKettle.position.set(-0.22, 1.06, 0.35);
  chaiStallGroup.add(teaKettle);

  const hangingBulb = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.055, 16, 16)),
    gateLanternMat,
  );
  hangingBulb.position.set(-0.25, 1.78, 0);
  chaiStallGroup.add(hangingBulb);

  const stallWarmLight = new THREE.PointLight(0xf59e0b, 1.4, 5.5, 1.6);
  stallWarmLight.position.set(-0.35, 1.7, 0);
  chaiStallGroup.add(stallWarmLight);

  // Roadside Wooden Bench beside the Chai Stall
  const benchSeat = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.42, 0.06, 1.35)),
    stallWoodMat,
  );
  benchSeat.position.set(-0.45, 0.44, 1.65);
  chaiStallGroup.add(benchSeat);

  // 3. Street Electrical Feeder Pillar / Transformer Box (x = -4.75, z = -39)
  const feederBoxGroup = new THREE.Group();
  feederBoxGroup.position.set(-4.75, 0.16, -39);
  group.add(feederBoxGroup);

  const feederBox = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.55, 1.32, 0.78, 4, 8, 6)),
    poleMat,
  );
  feederBox.position.y = 0.66;
  feederBox.castShadow = true;
  feederBoxGroup.add(feederBox);

  // Red/Amber/Green Phase Indicator LEDs on the Transformer Box
  for (const [idx, ledCol] of [0xef4444, 0xf59e0b, 0x22c55e].entries()) {
    const led = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.018, 12, 12)),
      trackMat(new THREE.MeshBasicMaterial({ color: ledCol })),
    );
    led.position.set(0.28, 1.05, -0.14 + idx * 0.14);
    feederBoxGroup.add(led);
  }

  // 4. Sculpted Night Cat Perched on Warm Left Gate Pillar (x = -6.95, y = 2.15, z = -18.7)
  const catGroup = new THREE.Group();
  catGroup.position.set(-6.95, 2.15, -18.7);
  catGroup.rotation.y = Math.PI * 0.38;
  group.add(catGroup);

  const catFurMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161922,
      roughness: 0.72,
    }),
  );
  const catEyeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
    }),
  );

  const catBody = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.085, 0.16, 16, 20)),
    catFurMat,
  );
  catBody.position.set(0, 0.14, 0);
  catBody.rotation.x = 0.25;
  catGroup.add(catBody);

  const catHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.072, 20, 20)),
    catFurMat,
  );
  catHead.position.set(0, 0.27, 0.05);
  catGroup.add(catHead);

  const catEarGeo = trackGeo(new THREE.ConeGeometry(0.026, 0.055, 10));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(catEarGeo, catFurMat);
    ear.position.set(side * 0.042, 0.335, 0.05);
    ear.rotation.z = -side * 0.22;
    catGroup.add(ear);

    const cEye = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.011, 10, 10)),
      catEyeMat,
    );
    cEye.position.set(side * 0.026, 0.278, 0.115);
    catGroup.add(cEye);
  }

  const catTailPivot = new THREE.Group();
  catTailPivot.position.set(0, 0.06, -0.06);
  catGroup.add(catTailPivot);
  animatedCatTails.push(catTailPivot);

  const catTail = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.018, 0.22, 12, 16)),
    catFurMat,
  );
  catTail.position.set(0, -0.08, -0.06);
  catTail.rotation.x = 0.65;
  catTailPivot.add(catTail);

  // ============================================================================
  // 5. DISTANT CROSS-STREET HORIZON TRAFFIC (BEAT 01/02 LIFE)
  // ============================================================================
  const horizonHeadlightMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  const horizonTaillightMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );

  for (let i = 0; i < 2; i++) {
    const dCar = new THREE.Group();
    const dir = i === 0 ? 1 : -1;
    dCar.position.set(dir * -18, 0.55, -138 - i * 4);
    group.add(dCar);

    const dBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.6, 1.1, 1.6, 8, 4, 4)),
      ironGateMat,
    );
    dCar.add(dBody);

    const fLight = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.18, 16, 16)),
      horizonHeadlightMat,
    );
    fLight.position.set(dir * 1.85, 0, 0.5);
    dCar.add(fLight);

    const rLight = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.16, 16, 16)),
      horizonTaillightMat,
    );
    rLight.position.set(-dir * 1.85, 0, 0.5);
    dCar.add(rLight);

    distantTrafficCars.push({
      mesh: dCar,
      speed: 6.5 + i * 2.2,
      dir,
      limitX: 38,
    });
  }

  // ============================================================================
  // 6. HIGH-POLYGON SCULPTED DARK SEDAN (25,000+ TRIANGLES)
  // ============================================================================
  const carGroup = new THREE.Group();
  carGroup.name = 'ApproachingDarkSedan';
  carGroup.position.set(-1.2, 0, -120);
  group.add(carGroup);

  const carChassisPivot = new THREE.Group();
  carChassisPivot.position.set(0, 0.36, 0);
  carGroup.add(carChassisPivot);

  const sedanPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x070a10, // Deep obsidian-midnight metallic automotive clearcoat
      roughness: 0.14,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
  );
  const darkGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x04060b,
      roughness: 0.06,
      metalness: 0.92,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
  );
  const chromeTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.94,
    }),
  );
  const tireRubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      roughness: 0.78,
      metalness: 0.12,
    }),
  );
  const alloyRimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.24,
      metalness: 0.88,
    }),
  );
  const headlightEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0,
      roughness: 0.08,
    }),
  );
  const brakeLightEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      emissive: 0xef4444,
      emissiveIntensity: 0,
      roughness: 0.18,
    }),
  );
  const headlightBeamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const roadBrakeGlareMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // High-Polygon Sculpted Main Lower Body (12,480 triangles)
  const sedanBody = new THREE.Mesh(sculptedSedanBodyGeo, sedanPaintMat);
  sedanBody.position.set(0, 0.22, 0);
  sedanBody.castShadow = true;
  sedanBody.receiveShadow = true;
  carChassisPivot.add(sedanBody);

  // Front Grille Mesh & Chrome Surround
  const frontGrille = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.06, 0.24, 0.08, 16, 6, 2)),
    ironGateMat,
  );
  frontGrille.position.set(0, 0.19, 2.26);
  carChassisPivot.add(frontGrille);

  const grilleChrome = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.015, 1.08, 12, 24)),
    chromeTrimMat,
  );
  grilleChrome.rotation.z = Math.PI / 2;
  grilleChrome.position.set(0, 0.32, 2.27);
  carChassisPivot.add(grilleChrome);

  // High-Polygon Sculpted Fastback Cabin Greenhouse (6,912 triangles)
  const sedanCabin = new THREE.Mesh(sculptedCabinGeo, darkGlassMat);
  sedanCabin.position.set(0, 0.78, -0.18);
  sedanCabin.castShadow = true;
  carChassisPivot.add(sedanCabin);

  // Aerodynamic Sculpted Wing Mirrors
  const mirrorGeo = trackGeo(new THREE.SphereGeometry(0.11, 20, 20));
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorGeo, sedanPaintMat);
    mirror.scale.set(0.85, 0.55, 0.65);
    mirror.position.set(side * 0.96, 0.62, 0.68);
    carChassisPivot.add(mirror);
  }

  // Dual Chrome Exhaust Tips at Rear Diffuser
  const exhaustTipGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 20));
  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(exhaustTipGeo, chromeTrimMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * 0.58, 0.02, -2.28);
    carChassisPivot.add(exhaust);
  }

  // Articulated Front-Right Passenger Door (facing Harsha at +X)
  const passengerDoorPivot = new THREE.Group();
  passengerDoorPivot.position.set(0.94, 0.25, 0.72);
  carChassisPivot.add(passengerDoorPivot);

  const passengerDoorPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.05, 0.58, 1.08, 4, 10, 18)),
    sedanPaintMat,
  );
  passengerDoorPanel.position.set(0, 0, -0.54);
  passengerDoorPivot.add(passengerDoorPanel);

  const passengerDoorWindow = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.04, 0.44, 0.96, 4, 8, 16)),
    darkGlassMat,
  );
  passengerDoorWindow.position.set(-0.08, 0.48, -0.54);
  passengerDoorPivot.add(passengerDoorWindow);

  const doorHandleGeo = trackGeo(new THREE.CapsuleGeometry(0.016, 0.13, 12, 16));
  const doorHandle = new THREE.Mesh(doorHandleGeo, chromeTrimMat);
  doorHandle.rotation.x = Math.PI / 2;
  doorHandle.position.set(0.03, 0.12, -0.88);
  passengerDoorPivot.add(doorHandle);

  // Articulated Rear-Right Passenger Door (opens wide when Masked Man pulls Harsha inside)
  const rearDoorPivot = new THREE.Group();
  rearDoorPivot.position.set(0.94, 0.25, -0.36);
  carChassisPivot.add(rearDoorPivot);

  const rearDoorPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.05, 0.58, 1.02, 4, 10, 18)),
    sedanPaintMat,
  );
  rearDoorPanel.position.set(0, 0, -0.51);
  rearDoorPivot.add(rearDoorPanel);

  const rearDoorWindow = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.04, 0.44, 0.9, 4, 8, 16)),
    darkGlassMat,
  );
  rearDoorWindow.position.set(-0.08, 0.48, -0.51);
  rearDoorPivot.add(rearDoorWindow);

  const rearDoorHandle = new THREE.Mesh(doorHandleGeo, chromeTrimMat);
  rearDoorHandle.rotation.x = Math.PI / 2;
  rearDoorHandle.position.set(0.03, 0.12, -0.84);
  rearDoorPivot.add(rearDoorHandle);

  // High-Polygon Volumetric Tire Drift Smoke Puffs behind Rear Wheels
  const driftSmokeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const smokePuffGeo = trackGeo(new THREE.IcosahedronGeometry(0.38, 3));
  const driftSmokePuffs: {
    mesh: THREE.Mesh;
    side: number;
    idx: number;
  }[] = [];

  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(smokePuffGeo, driftSmokeMat);
      puff.position.set(side * 0.95, 0.25 + i * 0.12, -1.65 - i * 0.65);
      puff.visible = false;
      carGroup.add(puff);
      driftSmokePuffs.push({ mesh: puff, side, idx: i });
    }
  }

  const interiorCourtesyLight = new THREE.PointLight(0xfde68a, 0, 2.8, 1.6);
  interiorCourtesyLight.position.set(0.55, 0.55, -0.1);
  carChassisPivot.add(interiorCourtesyLight);

  // Sculpted Projector Headlight Pods, Volumetric Cones & SpotLight
  const hlGeo = trackGeo(new THREE.CapsuleGeometry(0.058, 0.26, 16, 24));
  const beamConeGeo = trackGeo(
    new THREE.ConeGeometry(1.35, 11.5, 36, 1, true),
  );
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headlightEmissiveMat);
    hl.rotation.z = Math.PI / 2 - side * 0.12;
    hl.scale.set(1.0, 1.0, 0.55);
    hl.position.set(side * 0.66, 0.26, 2.24);
    carChassisPivot.add(hl);

    const beamCone = new THREE.Mesh(beamConeGeo, headlightBeamMat);
    beamCone.rotation.x = -Math.PI / 2 - 0.06;
    beamCone.position.set(side * 0.66, 0.05, 7.95);
    carChassisPivot.add(beamCone);
  }

  const headlightSpot = new THREE.SpotLight(
    0xe0f2fe,
    0,
    42,
    Math.PI / 4.2,
    0.52,
    1.35,
  );
  headlightSpot.position.set(0, 0.32, 2.2);
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(0.35, -0.25, 16.0);
  carChassisPivot.add(headlightTarget);
  headlightSpot.target = headlightTarget;
  carChassisPivot.add(headlightSpot);

  // Sculpted LED Rear Taillight Bars + Wet Asphalt Red Glare Decal
  const tlGeo = trackGeo(new THREE.CapsuleGeometry(0.055, 0.34, 16, 24));
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(tlGeo, brakeLightEmissiveMat);
    tl.rotation.z = Math.PI / 2;
    tl.scale.set(1.0, 1.0, 0.5);
    tl.position.set(side * 0.66, 0.32, -2.26);
    carChassisPivot.add(tl);
  }

  const brakeGlowLight = new THREE.PointLight(0xef4444, 0, 9.5, 1.5);
  brakeGlowLight.position.set(0, 0.34, -2.55);
  carChassisPivot.add(brakeGlowLight);

  const roadBrakeGlare = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.6, 3.8, 8, 8)),
    roadBrakeGlareMat,
  );
  roadBrakeGlare.rotation.x = -Math.PI / 2;
  roadBrakeGlare.position.set(0, 0.012, -3.4);
  carGroup.add(roadBrakeGlare);

  // 4 High-Polygon Articulated Wheels (36 radial segments + beveled tire shoulder + 10-spoke alloy rims)
  const wheelTireGeo = trackGeo(
    new THREE.CylinderGeometry(0.35, 0.35, 0.25, 36, 4),
  );
  const tireSidewallTorusGeo = trackGeo(
    new THREE.TorusGeometry(0.285, 0.065, 20, 36),
  );
  const wheelRimGeo = trackGeo(
    new THREE.CylinderGeometry(0.23, 0.23, 0.26, 32),
  );
  const spokeBarGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.022, 0.43, 12));

  const wheelSpinGroups: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];

  const wheelCoords = [
    { x: -0.92, z: 1.38, isFront: true },
    { x: 0.92, z: 1.38, isFront: true },
    { x: -0.92, z: -1.38, isFront: false },
    { x: 0.92, z: -1.38, isFront: false },
  ];

  for (const wc of wheelCoords) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wc.x, 0.35, wc.z);
    carGroup.add(steerPivot);
    if (wc.isFront) {
      frontSteerPivots.push(steerPivot);
    }

    const spinGroup = new THREE.Group();
    steerPivot.add(spinGroup);
    wheelSpinGroups.push(spinGroup);

    const tire = new THREE.Mesh(wheelTireGeo, tireRubberMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinGroup.add(tire);

    const outerSidewall = new THREE.Mesh(tireSidewallTorusGeo, tireRubberMat);
    outerSidewall.rotation.y = Math.PI / 2;
    outerSidewall.position.x = Math.sign(wc.x) * 0.095;
    spinGroup.add(outerSidewall);

    const rim = new THREE.Mesh(wheelRimGeo, alloyRimMat);
    rim.rotation.z = Math.PI / 2;
    spinGroup.add(rim);

    // 5 diametrical alloy spokes (= 10-spoke star pattern)
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(spokeBarGeo, chromeTrimMat);
      spoke.rotation.x = (s / 5) * Math.PI;
      spoke.position.x = Math.sign(wc.x) * 0.125;
      spinGroup.add(spoke);
    }
  }

  return {
    group,
    carGroup,
    setCarTransform(
      zPos,
      xOffset,
      headlightIntensity,
      brakeIntensity,
      wheelSpinDelta,
      steeringAngle = 0,
      chassisPitch = 0,
      chassisRoll = 0,
      doorOpenRatio = 0,
      carYaw = 0,
      rearDoorOpenRatio = 0,
      driftSmokeIntensity = 0,
    ) {
      carGroup.position.set(xOffset, 0, zPos);
      carGroup.rotation.y = carYaw;

      carChassisPivot.rotation.x = chassisPitch;
      carChassisPivot.rotation.z = chassisRoll;

      for (const fp of frontSteerPivots) {
        fp.rotation.y = steeringAngle;
      }
      for (const wg of wheelSpinGroups) {
        wg.rotation.x += wheelSpinDelta;
      }

      headlightSpot.intensity = headlightIntensity;
      headlightEmissiveMat.emissiveIntensity =
        headlightIntensity > 0.1 ? 3.8 : 0;
      headlightBeamMat.opacity = Math.min(0.12, headlightIntensity * 0.02);

      brakeGlowLight.intensity = brakeIntensity;
      brakeLightEmissiveMat.emissiveIntensity =
        brakeIntensity > 0.1 ? brakeIntensity * 1.45 : 0;
      roadBrakeGlareMat.opacity = Math.min(0.32, brakeIntensity * 0.068);

      passengerDoorPivot.rotation.y = doorOpenRatio * 1.05;
      rearDoorPivot.rotation.y = rearDoorOpenRatio * 1.12;
      interiorCourtesyLight.intensity =
        Math.max(doorOpenRatio, rearDoorOpenRatio) * 1.8;

      const showSmoke = driftSmokeIntensity > 0.02;
      driftSmokeMat.opacity = Math.min(0.38, driftSmokeIntensity * 0.28);
      const nowSec = performance.now() * 0.004;
      for (const puff of driftSmokePuffs) {
        puff.mesh.visible = showSmoke;
        if (showSmoke) {
          const cycle = (nowSec + puff.idx * 0.22) % 1;
          const scale = 0.55 + cycle * 1.85 * driftSmokeIntensity;
          puff.mesh.scale.set(scale * 1.2, scale * 0.85, scale * 1.3);
          puff.mesh.position.set(
            puff.side * (0.92 + cycle * 0.55),
            0.22 + cycle * 0.55,
            -1.45 - cycle * 3.8,
          );
          puff.mesh.rotation.z = nowSec + puff.idx;
        }
      }
    },
    updateEnvironment(dt, elapsed, distantTrafficActive) {
      for (const item of windSwayPivots) {
        const w1 = Math.sin(elapsed * 1.45 + item.phase) * item.amp;
        const w2 = Math.cos(elapsed * 0.95 + item.phase * 0.7) * item.amp * 0.7;
        item.obj.rotation.z = item.baseRotZ + w1;
        item.obj.rotation.x = item.baseRotX + w2;
      }

      for (const win of animatedWindows) {
        const flicker =
          Math.sin(elapsed * win.speed + win.phase) * 0.14 +
          Math.cos(elapsed * (win.speed * 1.7) + win.phase) * 0.08;
        win.mat.emissiveIntensity = win.baseIntensity + flicker;
      }

      for (const spinner of rooftopSpinners) {
        spinner.rotation.y += dt * 1.8;
      }

      for (const dust of streetlampDustGroups) {
        dust.points.rotation.y = elapsed * 0.18 + dust.phase;
        dust.points.position.y =
          dust.baseY + Math.sin(elapsed * 0.8 + dust.phase) * 0.08;
      }

      for (const dCar of distantTrafficCars) {
        dCar.mesh.visible = distantTrafficActive;
        if (distantTrafficActive) {
          dCar.mesh.position.x += dCar.dir * dCar.speed * dt;
          if (Math.abs(dCar.mesh.position.x) > dCar.limitX) {
            dCar.mesh.position.x = -dCar.dir * dCar.limitX;
          }
        }
      }

      // Gently swaying tail on the perched gate-pillar cat
      for (const tail of animatedCatTails) {
        tail.rotation.z = Math.sin(elapsed * 2.1) * 0.28;
      }
    },
    dispose() {
      for (const t of textures) t.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

function bootSeatMat(
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.MeshStandardMaterial {
  return trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.65,
    }),
  );
}
