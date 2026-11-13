import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';
import {
  GROTTO_BIOLUM_GARDEN,
  GROTTO_CENTRAL_ISLAND,
  GROTTO_ISLAND_STEPPING_STONES,
  GROTTO_LAKE_WATER_LEVEL,
  GROTTO_SECONDARY_VIEWPOINT,
  GROTTO_STONE_BRIDGE,
  GROTTO_WATERFALL_CHAMBER,
  RESERVED_GROTTO_VOLUME,
  createPrivateSeededRng,
  getGrottoCeilingHeightAt,
  getGrottoStoneBridgeHeightAt,
  getHiddenCaveTunnelFloorHeightAt,
  privateNoise2D,
} from './privateWorldMath';

export interface PrivateHiddenGrottoBundle {
  group: THREE.Group;
  lakeGroup: THREE.Group;
  colliders: CircleCollider[];
  triggerLakeRipple: (
    worldX: number,
    worldZ: number,
    strength?: number,
    exciteFlora?: boolean,
  ) => void;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

export const GROTTO_ISLAND_BENCH_POS = {
  x: GROTTO_CENTRAL_ISLAND.x - 0.9, // 2.6
  y: GROTTO_CENTRAL_ISLAND.topY, // 3.85
  z: GROTTO_CENTRAL_ISLAND.z - 1.2, // 72.3
  rotY: -0.58, // Facing NNW toward the Waterfall Chamber, Moonlit Lake & Lanterns
} as const;

export const GROTTO_OVERLOOK_BENCH_POS = {
  x: GROTTO_SECONDARY_VIEWPOINT.x + 0.7, // 12.2
  y: GROTTO_SECONDARY_VIEWPOINT.topY, // 5.45
  z: GROTTO_SECONDARY_VIEWPOINT.z + 0.3, // 81.8
  rotY: -1.18, // Facing WSW across the Central Discovery Island & Waterfall
} as const;

/**
 * Generates a high-craft cobblestone & flagstone texture for the enchanted grotto lakeside promenade.
 */
function createGrottoCobblestoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep slate-charcoal mortar bed with warm golden-moss undertones
  ctx.fillStyle = '#1b2432';
  ctx.fillRect(0, 0, size, size);

  const cellRows = 8;
  const cellCols = 8;
  const cellW = size / cellCols;
  const cellH = size / cellRows;

  for (let r = 0; r < cellRows; r++) {
    for (let c = 0; c < cellCols; c++) {
      const staggerX = (r % 2) * (cellW * 0.45);
      const cx = ((c * cellW + staggerX) % size) + cellW * 0.5;
      const cy = r * cellH + cellH * 0.5;
      const n = privateNoise2D(c * 1.7 + r * 0.9, r * 2.1 - c * 0.6);
      const w = cellW * (0.78 + n * 0.08);
      const h = cellH * (0.76 - n * 0.06);

      // Stone base color varying between cool moonlit blue-slate and warm lantern-lit sandstone grey
      const baseLum = Math.round(62 + n * 18);
      const warmShift = Math.round(n * 8);
      ctx.fillStyle = `rgb(${baseLum + warmShift}, ${baseLum + 4}, ${baseLum + 14 - warmShift})`;

      ctx.beginPath();
      ctx.roundRect(cx - w * 0.5, cy - h * 0.5, w, h, 8);
      ctx.fill();

      // Subtle bevel highlight on top-left of each cobblestone
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.16)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createPrivateHiddenGrotto(): PrivateHiddenGrottoBundle {
  const group = new THREE.Group();
  group.name = 'HiddenGrotto_UndergroundLakeworldRoot';

  const lakeGroup = new THREE.Group();
  lakeGroup.name = 'HiddenGrotto_LakeAndWaterfallGroup';
  group.add(lakeGroup);

  const colliders: CircleCollider[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const rng = createPrivateSeededRng(20270214 ^ 0x6a09e667);
  const cobblestoneTex = trackTex(createGrottoCobblestoneTexture());

  // ============================================================================
  // 1. SHARED CAVERN ROCK, COBBLESTONE, FLORAL, LANTERN & WATER MATERIALS
  // ============================================================================
  const cavernShellBlackMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#040812'),
      side: THREE.DoubleSide,
    }),
  );
  const cavernBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#162030'),
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  const cavernWetSlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1f2d40'),
      roughness: 0.66,
      metalness: 0.14,
    }),
  );
  const cavernMossStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e4640'),
      roughness: 0.82,
      metalness: 0.05,
    }),
  );
  const bridgeArchStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#334155'),
      roughness: 0.78,
      metalness: 0.08,
    }),
  );
  const mineralCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#67e8f9'),
      emissive: new THREE.Color('#06b6d4'),
      emissiveIntensity: 1.5,
      roughness: 0.22,
    }),
  );
  const mineralTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5eead4'),
      emissive: new THREE.Color('#14b8a6'),
      emissiveIntensity: 1.4,
      roughness: 0.24,
    }),
  );
  const sanctuaryAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 2.1,
      roughness: 0.16,
      metalness: 0.2,
    }),
  );
  const wroughtIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e2530'),
      roughness: 0.42,
      metalness: 0.78,
    }),
  );
  const silverFiligreeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cbd5e1'),
      roughness: 0.28,
      metalness: 0.84,
    }),
  );
  const warmBenchTimberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#854d27'),
      roughness: 0.68,
      metalness: 0.06,
    }),
  );

  // Lush Botanical & Floral Materials (Matching the uploaded Enchanted Moonlit Grotto reference images)
  const foliageLeafMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e5641'),
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  const whiteMoonLilyPetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f8fafc'),
      emissive: new THREE.Color('#e0f2fe'),
      emissiveIntensity: 0.55,
      roughness: 0.32,
      side: THREE.DoubleSide,
    }),
  );
  const goldenLilyCenterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 2.4,
      roughness: 0.18,
    }),
  );
  const pinkRoseBloomMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f472b6'),
      emissive: new THREE.Color('#db2777'),
      emissiveIntensity: 0.75,
      roughness: 0.35,
    }),
  );
  const marigoldBloomMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbbf24'),
      emissive: new THREE.Color('#d97706'),
      emissiveIntensity: 0.95,
      roughness: 0.32,
    }),
  );
  const wisteriaLavenderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b4fe'),
      emissive: new THREE.Color('#9333ea'),
      emissiveIntensity: 0.85,
      roughness: 0.38,
    }),
  );
  const wisteriaRoseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.82,
      roughness: 0.38,
    }),
  );

  const rockDodecGeo = trackGeo(new THREE.DodecahedronGeometry(1.0, 1));
  const stalactiteConeGeo = trackGeo(new THREE.ConeGeometry(0.48, 2.6, 7));
  const crystalPrismGeo = trackGeo(
    new THREE.CylinderGeometry(0.04, 0.16, 1.0, 6),
  );
  crystalPrismGeo.translate(0, 0.5, 0);

  // ============================================================================
  // 2. DESCENDING ENTRANCE TUNNEL (Connecting (18, 56, Y=10.0m) -> (14, 66.5, Y=3.85m))
  //    Wide, vaulted, and warmly lit so the Grotto Lake & Lanterns are clearly visible from the entrance!
  // ============================================================================
  const tunnelGroup = new THREE.Group();
  tunnelGroup.name = 'HiddenGrotto_OpenDescendingTunnel';
  group.add(tunnelGroup);

  const numTunnelSegments = 14;
  for (let i = 0; i < numTunnelSegments; i++) {
    const t = i / (numTunnelSegments - 1);
    const z = 56.0 + t * 10.5; // Z: 56.0 -> 66.5
    const smoothT = t * t * (3.0 - 2.0 * t);
    const centerX = 18.0 - smoothT * 4.0; // X: 18.0 -> 14.0
    const floorY =
      getHiddenCaveTunnelFloorHeightAt(centerX, z) ??
      THREE.MathUtils.lerp(10.0, 3.85, smoothT);
    const halfWidth = THREE.MathUtils.lerp(
      2.35,
      4.35,
      THREE.MathUtils.smoothstep(t, 0.5, 1.0),
    );

    // 2A. Stepped Flagstone Floor Slab flush with getHiddenCaveTunnelFloorHeightAt
    const slabGeo = trackGeo(
      new THREE.BoxGeometry(halfWidth * 2.1, 0.38, 1.15),
    );
    const floorSlab = new THREE.Mesh(
      slabGeo,
      i % 2 === 0 ? cavernWetSlateMat : cavernMossStoneMat,
    );
    floorSlab.position.set(centerX, floorY - 0.19, z);
    floorSlab.rotation.x = 0.52 * (1.0 - Math.abs(t - 0.5) * 0.5);
    floorSlab.rotation.y = -0.32 * Math.sin(t * Math.PI);
    floorSlab.receiveShadow = true;
    tunnelGroup.add(floorSlab);

    // 2B. Ribbed Basalt Side Walls & Layer-Aware Underground Colliders
    for (const side of [-1, 1] as const) {
      const wx = centerX + side * (halfWidth + 0.55);
      const wallRock = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
      wallRock.position.set(wx, floorY + 2.05, z);
      wallRock.scale.set(1.35, 2.55, 1.25);
      wallRock.rotation.set(0.12 * side, i * 0.5, -0.08 * side);
      wallRock.castShadow = true;
      wallRock.receiveShadow = true;
      tunnelGroup.add(wallRock);

      colliders.push({
        x: centerX + side * (halfWidth + 0.65),
        y: floorY,
        z,
        radius: 0.85,
      });

      // Cascading Wisteria & Warm Guía Lanterns along the tunnel walls
      if (i % 3 === 1) {
        const wisteriaCluster = new THREE.Mesh(
          rockDodecGeo,
          (i + (side === 1 ? 1 : 0)) % 2 === 0
            ? wisteriaLavenderMat
            : wisteriaRoseMat,
        );
        wisteriaCluster.position.set(
          centerX + side * (halfWidth - 0.15),
          floorY + 3.45,
          z,
        );
        wisteriaCluster.scale.set(0.32, 0.72, 0.32);
        tunnelGroup.add(wisteriaCluster);
      }
    }

    // 2C. High Vaulted Tunnel Ceiling Arch (placed at floorY + 4.35m so it never clips the sightline)
    const ceilingArch = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
    ceilingArch.position.set(centerX, floorY + 4.45, z);
    ceilingArch.scale.set(halfWidth * 1.55, 1.15, 1.25);
    ceilingArch.rotation.set(0.18, i * 0.3, 0);
    tunnelGroup.add(ceilingArch);
  }

  // ============================================================================
  // 3. MAIN SUBTERRANEAN CAVERN SHELL (OPEN PORTAL AT TUNNEL MOUTH), SKYLIGHT OCULUS & WALLS
  // ============================================================================
  const cavernShellGroup = new THREE.Group();
  cavernShellGroup.name = 'HiddenGrotto_MainCavernEnclosure';
  group.add(cavernShellGroup);

  // Build enclosure walls around RESERVED_GROTTO_VOLUME WITHOUT blocking the southern tunnel entrance (X: 9..21, Z: 58..66)
  const minX = RESERVED_GROTTO_VOLUME.minX;
  const maxX = RESERVED_GROTTO_VOLUME.maxX;
  const minY = RESERVED_GROTTO_VOLUME.minY;
  const maxY = RESERVED_GROTTO_VOLUME.maxY;
  const minZ = RESERVED_GROTTO_VOLUME.minZ;
  const maxZ = RESERVED_GROTTO_VOLUME.maxZ;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;

  // North back wall (+Z)
  const northWall = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(spanX, spanY)),
    cavernShellBlackMat,
  );
  northWall.position.set(
    RESERVED_GROTTO_VOLUME.centerX,
    RESERVED_GROTTO_VOLUME.centerY,
    maxZ - 0.4,
  );
  cavernShellGroup.add(northWall);

  // West wall (-X) & East wall (+X)
  const westWall = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(spanZ, spanY)),
    cavernShellBlackMat,
  );
  westWall.rotation.y = Math.PI / 2;
  westWall.position.set(
    minX + 0.4,
    RESERVED_GROTTO_VOLUME.centerY,
    RESERVED_GROTTO_VOLUME.centerZ,
  );
  cavernShellGroup.add(westWall);

  const eastWall = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(spanZ, spanY)),
    cavernShellBlackMat,
  );
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.position.set(
    maxX - 0.4,
    RESERVED_GROTTO_VOLUME.centerY,
    RESERVED_GROTTO_VOLUME.centerZ,
  );
  cavernShellGroup.add(eastWall);

  // Roof plane (+Y)
  const roofPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(spanX, spanZ)),
    cavernShellBlackMat,
  );
  roofPlane.rotation.x = Math.PI / 2;
  roofPlane.position.set(
    RESERVED_GROTTO_VOLUME.centerX,
    maxY - 0.2,
    RESERVED_GROTTO_VOLUME.centerZ,
  );
  cavernShellGroup.add(roofPlane);

  // South wall (-Z) split into West-South panel (x: -24..+9.0) and East-South panel (x: +20.5..+34)
  // leaving the Tunnel Entrance Portal (x: +9.0..+20.5) 100% open to the camera!
  const southWestSpan = 9.0 - minX;
  const southWestWall = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(southWestSpan, spanY)),
    cavernShellBlackMat,
  );
  southWestWall.position.set(
    minX + southWestSpan * 0.5,
    RESERVED_GROTTO_VOLUME.centerY,
    minZ + 2.5,
  );
  cavernShellGroup.add(southWestWall);

  const southEastSpan = maxX - 20.5;
  const southEastWall = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(southEastSpan, spanY)),
    cavernShellBlackMat,
  );
  southEastWall.position.set(
    20.5 + southEastSpan * 0.5,
    RESERVED_GROTTO_VOLUME.centerY,
    minZ + 2.5,
  );
  cavernShellGroup.add(southEastWall);

  // Cavern Ceiling Moonlit Oculus (Matching the glowing moon skylight in the reference images!)
  const oculusGroup = new THREE.Group();
  oculusGroup.name = 'HiddenGrotto_MoonbeamSkylightOculus';
  oculusGroup.position.set(2.5, 12.85, 76.5);
  cavernShellGroup.add(oculusGroup);

  const oculusSkyMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#172554'),
      side: THREE.DoubleSide,
    }),
  );
  const oculusSkyDisc = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(4.8, 32)),
    oculusSkyMat,
  );
  oculusSkyDisc.rotation.x = Math.PI / 2;
  oculusGroup.add(oculusSkyDisc);

  const oculusMoonMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef9c3'),
      side: THREE.DoubleSide,
    }),
  );
  const oculusMoonDisc = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(1.65, 32)),
    oculusMoonMat,
  );
  oculusMoonDisc.rotation.x = Math.PI / 2;
  oculusMoonDisc.position.set(-0.6, -0.05, 0.4);
  oculusGroup.add(oculusMoonDisc);

  // Soft volumetric moonbeam halo cone descending from the cavern oculus
  const moonbeamConeGeo = trackGeo(
    new THREE.CylinderGeometry(2.1, 6.2, 9.6, 24, 1, true),
  );
  const moonbeamConeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bae6fd'),
      transparent: true,
      opacity: 0.085,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const moonbeamCone = new THREE.Mesh(moonbeamConeGeo, moonbeamConeMat);
  moonbeamCone.position.set(0, -4.8, 0);
  oculusGroup.add(moonbeamCone);

  // Sculpted Cavern Perimeter Wall Crags & Vaulted Ceiling Dome Boulders
  const wallSegments = 34;
  for (let i = 0; i < wallSegments; i++) {
    const ang = (i / wallSegments) * Math.PI * 2;
    const rx = 25.5 + Math.sin(ang * 3.0) * 1.8;
    const rz = 13.8 + Math.cos(ang * 2.0) * 1.2;
    const wx = 3.5 + Math.cos(ang) * rx;
    const wz = 74.5 + Math.sin(ang) * rz;

    // Leave the Southeastern Tunnel Entrance Mouth around (14..18, 61..67) wide open!
    if (wx > 8.0 && wx < 22.0 && wz < 68.5) {
      continue;
    }

    const wallH = 8.8 + (i % 3) * 1.2;
    const wallCrag = new THREE.Mesh(
      rockDodecGeo,
      i % 3 === 0 ? cavernWetSlateMat : cavernBasaltMat,
    );
    wallCrag.position.set(wx, 2.2 + wallH * 0.45, wz);
    wallCrag.scale.set(3.8, wallH * 0.58, 3.4);
    wallCrag.rotation.set(
      (rng() - 0.5) * 0.2,
      ang + 0.4,
      (rng() - 0.5) * 0.2,
    );
    wallCrag.receiveShadow = true;
    cavernShellGroup.add(wallCrag);

    colliders.push({
      x: wx,
      y: 4.0,
      z: wz,
      radius: 2.6,
    });
  }

  // Vaulted Ceiling Roof Crags, Hanging Stalactites & Cascading Ceiling Wisteria Vines
  for (let i = 0; i < 38; i++) {
    const cx = -18.0 + rng() * 44.0;
    const cz = 63.0 + rng() * 23.0;
    // Keep the central skylight oculus clear
    if (Math.hypot(cx - 2.5, cz - 76.5) < 5.2) continue;

    const ceilY = getGrottoCeilingHeightAt(cx, cz);

    const roofRock = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
    roofRock.position.set(cx, ceilY + 0.55, cz);
    roofRock.scale.set(3.2 + rng() * 2.4, 1.15, 3.0 + rng() * 2.2);
    roofRock.rotation.set(0, rng() * Math.PI * 2, 0);
    cavernShellGroup.add(roofRock);

    if (i < 24) {
      const stalLen = 1.2 + rng() * 1.8;
      const stal = new THREE.Mesh(stalactiteConeGeo, cavernWetSlateMat);
      stal.position.set(cx, ceilY - stalLen * 0.42, cz);
      stal.rotation.x = Math.PI;
      stal.scale.set(0.48 + rng() * 0.35, stalLen / 2.6, 0.48 + rng() * 0.35);
      cavernShellGroup.add(stal);

      // Hanging Wisteria & Bioluminescent Vine Drapes
      if (i % 2 === 0) {
        const vineDrape = new THREE.Mesh(
          crystalPrismGeo,
          i % 4 === 0 ? wisteriaLavenderMat : wisteriaRoseMat,
        );
        vineDrape.position.set(cx, ceilY - stalLen * 0.88, cz);
        vineDrape.rotation.x = Math.PI;
        vineDrape.scale.set(0.85, 1.35, 0.85);
        cavernShellGroup.add(vineDrape);
      }
    }
  }

  // ============================================================================
  // 4. COBBLESTONE LAKESIDE PROMENADE, WARM POST LANTERNS & LUSH MOON-LILY GARDEN
  // ============================================================================
  const shoreAndGardenGroup = new THREE.Group();
  shoreAndGardenGroup.name = 'HiddenGrotto_CobblestonePromenadeAndGarden';
  group.add(shoreAndGardenGroup);

  // Contoured Walkable Cobblestone Lakeside Promenade & Garden Terrace Mesh (Z: 61.5..73.5, X: -21.0..+24.5)
  const shoreGeo = trackGeo(new THREE.PlaneGeometry(45.5, 12.2, 56, 22));
  shoreGeo.rotateX(-Math.PI / 2);
  const shorePos = shoreGeo.attributes.position as THREE.BufferAttribute;
  const shoreCols = new Float32Array(shorePos.count * 3);
  const cCobbleWarm = new THREE.Color('#94a3b8');
  const cGardenMoss = new THREE.Color('#2dd4bf');
  const cGardenLush = new THREE.Color('#34d399');
  const _col = new THREE.Color();

  for (let i = 0; i < shorePos.count; i++) {
    const wx = shorePos.getX(i) + 1.75;
    const wz = shorePos.getZ(i) + 67.5;
    const gardenSlope = THREE.MathUtils.smoothstep(69.5, 62.5, wz) * 0.36;
    const westTerrace = THREE.MathUtils.smoothstep(0.0, -16.0, wx) * 0.28;
    const wy = 3.66 + gardenSlope + westTerrace;
    shorePos.setXYZ(i, wx, wy, wz);

    const gardenBlend = THREE.MathUtils.smoothstep(6.0, -10.0, wx);
    _col.lerpColors(cCobbleWarm, cGardenMoss, gardenBlend * 0.55);
    if (gardenBlend > 0.45) {
      _col.lerp(cGardenLush, (gardenBlend - 0.45) * 0.4);
    }
    shoreCols[i * 3] = _col.r;
    shoreCols[i * 3 + 1] = _col.g;
    shoreCols[i * 3 + 2] = _col.b;
  }
  shoreGeo.setAttribute('color', new THREE.BufferAttribute(shoreCols, 3));
  shoreGeo.computeVertexNormals();

  const shoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cobblestoneTex,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.08,
    }),
  );
  const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
  shoreMesh.receiveShadow = true;
  shoreAndGardenGroup.add(shoreMesh);

  // ============================================================================
  // 4B. VINTAGE WROUGHT-IRON STREETLAMP POSTS WITH WARM GOLDEN LANTERNS & WISTERIA
  //     (Matching the warm glowing post lamps along the lakeside in Reference Images 1 & 2)
  // ============================================================================
  const lampPostPositions: ReadonlyArray<{ x: number; z: number; y?: number; rotY: number }> = [
    // 1. Tunnel threshold welcome lamp (visible immediately from the cave entrance!)
    { x: 15.6, z: 63.8, y: 4.55, rotY: -0.4 },
    // 2. Southern cobblestone promenade east lamp
    { x: 12.8, z: 66.8, rotY: -0.8 },
    // 3. Southern cobblestone promenade center-east lamp (beside stepping stones)
    { x: 7.4, z: 66.4, rotY: -0.2 },
    // 4. Southern cobblestone promenade center-west lamp
    { x: 0.5, z: 66.8, rotY: 0.25 },
    // 5. Southwestern floral promenade lamp
    { x: -6.2, z: 67.2, rotY: 0.55 },
    // 6. Western garden terrace lamp
    { x: -12.8, z: 68.5, rotY: 0.85 },
    // 7. Central Discovery Island lamp (beside the ornate island bench)
    { x: GROTTO_CENTRAL_ISLAND.x - 2.3, z: GROTTO_CENTRAL_ISLAND.z + 0.8, y: GROTTO_CENTRAL_ISLAND.topY, rotY: 0.6 },
    // 8. Northeastern Overlook Ledge lamp
    { x: GROTTO_SECONDARY_VIEWPOINT.x - 1.8, z: GROTTO_SECONDARY_VIEWPOINT.z - 0.8, y: GROTTO_SECONDARY_VIEWPOINT.topY, rotY: -0.9 },
  ];

  const lampPostBaseGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.22, 0.55, 10));
  const lampPostPoleGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.08, 2.65, 10));
  const lampPostArmGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.05, 0.05));
  const lampGlassGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.13, 0.42, 6));
  const lampRoofGeo = trackGeo(new THREE.ConeGeometry(0.25, 0.2, 6));

  lampPostPositions.forEach((lp, idx) => {
    const baseY =
      lp.y ??
      3.66 +
        THREE.MathUtils.smoothstep(69.5, 62.5, lp.z) * 0.36 +
        THREE.MathUtils.smoothstep(0.0, -16.0, lp.x) * 0.28;

    const lampGroup = new THREE.Group();
    lampGroup.name = `HiddenGrotto_VintagePostLantern_${idx + 1}`;
    lampGroup.position.set(lp.x, baseY, lp.z);
    lampGroup.rotation.y = lp.rotY;

    const base = new THREE.Mesh(lampPostBaseGeo, wroughtIronMat);
    base.position.y = 0.275;
    base.castShadow = true;

    const pole = new THREE.Mesh(lampPostPoleGeo, wroughtIronMat);
    pole.position.y = 1.6;
    pole.castShadow = true;

    const arm = new THREE.Mesh(lampPostArmGeo, wroughtIronMat);
    arm.position.set(0.22, 2.86, 0);

    const glass = new THREE.Mesh(lampGlassGeo, sanctuaryAmberMat);
    glass.position.set(0.42, 2.62, 0);

    const roof = new THREE.Mesh(lampRoofGeo, wroughtIronMat);
    roof.position.set(0.42, 2.92, 0);

    lampGroup.add(base, pole, arm, glass, roof);

    // Cascading Wisteria & Ivy Vines draped from the lamp crossbar
    for (let w = 0; w < 3; w++) {
      const wisteria = new THREE.Mesh(
        crystalPrismGeo,
        w % 2 === 0 ? wisteriaLavenderMat : wisteriaRoseMat,
      );
      wisteria.position.set(0.12 + w * 0.14, 2.82, (w - 1) * 0.08);
      wisteria.rotation.x = Math.PI;
      wisteria.scale.set(0.42, 0.55 + (w % 2) * 0.2, 0.42);
      lampGroup.add(wisteria);
    }

    shoreAndGardenGroup.add(lampGroup);
    colliders.push({ x: lp.x, y: baseY, z: lp.z, radius: 0.35 });
  });

  // ============================================================================
  // 4C. LUSH ENCHANTED FLORAL BANKS (5-Petal White Moon-Lilies with Glowing Golden Centers,
  //     Pink Roses, Golden Marigolds & Violet Irises)
  // ============================================================================
  const lilyPetalGeo = trackGeo(new THREE.SphereGeometry(0.11, 8, 6));
  lilyPetalGeo.scale(0.62, 0.18, 1.35);
  lilyPetalGeo.translate(0, 0, 0.12);

  const lilyCenterGeo = trackGeo(new THREE.SphereGeometry(0.055, 8, 8));
  const flowerStemGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.026, 0.38, 6));
  flowerStemGeo.translate(0, 0.19, 0);
  const tulipCupGeo = trackGeo(new THREE.ConeGeometry(0.095, 0.18, 7));
  tulipCupGeo.rotateX(Math.PI);
  tulipCupGeo.translate(0, 0.4, 0);

  interface GrottoMoonLilyCluster {
    x: number;
    z: number;
    centerMats: THREE.MeshStandardMaterial[];
    boost: number;
  }
  const grottoMoonLilyClusters: GrottoMoonLilyCluster[] = [];

  /**
   * Helper that builds a lush 5-petal White Moon-Lily cluster with glowing golden centers
   * (matching the signature foreground flowers in Reference Image 2).
   */
  const buildMoonLilyCluster = (
    cx: number,
    cy: number,
    cz: number,
    bloomCount: number,
    scaleMultiplier = 1.0,
  ) => {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(cx, cy, cz);
    const centerMats: THREE.MeshStandardMaterial[] = [];

    for (let b = 0; b < bloomCount; b++) {
      const ang = (b / bloomCount) * Math.PI * 2 + rng() * 0.5;
      const dist = b === 0 ? 0 : 0.18 + rng() * 0.26;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      const hScale = (0.78 + rng() * 0.45) * scaleMultiplier;

      const flowerNode = new THREE.Group();
      flowerNode.position.set(bx, 0, bz);
      flowerNode.rotation.y = rng() * Math.PI * 2;
      flowerNode.scale.setScalar(hScale);

      const stem = new THREE.Mesh(flowerStemGeo, foliageLeafMat);
      flowerNode.add(stem);

      // Broad lush green base leaves
      for (let lf = 0; lf < 3; lf++) {
        const leaf = new THREE.Mesh(lilyPetalGeo, foliageLeafMat);
        leaf.position.y = 0.06;
        leaf.rotation.y = (lf / 3) * Math.PI * 2;
        leaf.rotation.x = 0.35;
        leaf.scale.set(1.3, 1.0, 1.5);
        flowerNode.add(leaf);
      }

      // 5 Sculpted White Moon-Lily Petals
      const headGroup = new THREE.Group();
      headGroup.position.y = 0.38;
      headGroup.rotation.x = 0.22 + (rng() - 0.5) * 0.18;
      for (let p = 0; p < 5; p++) {
        const petal = new THREE.Mesh(lilyPetalGeo, whiteMoonLilyPetalMat);
        petal.rotation.y = (p / 5) * Math.PI * 2;
        petal.rotation.x = -0.18;
        headGroup.add(petal);
      }

      // Glowing Warm-Gold Stamen Core
      const coreMat = trackMat(goldenLilyCenterMat.clone());
      centerMats.push(coreMat);
      const centerCore = new THREE.Mesh(lilyCenterGeo, coreMat);
      centerCore.position.y = 0.02;
      headGroup.add(centerCore);

      flowerNode.add(headGroup);
      clusterGroup.add(flowerNode);
    }

    shoreAndGardenGroup.add(clusterGroup);
    grottoMoonLilyClusters.push({ x: cx, z: cz, centerMats, boost: 0 });
  };

  // Plant 28 White Moon-Lily Clusters along the cobblestone promenade, tunnel exit, and Central Discovery Island
  const moonLilySpots: Array<[number, number, number?]> = [
    // Tunnel threshold & arrival edge (immediately visible from the cave entrance!)
    [16.2, 62.5, 5.1],
    [12.4, 65.2],
    [15.8, 65.8],
    [10.2, 66.4],
    [8.2, 66.9],
    [5.4, 66.8],
    [2.8, 67.2],
    [0.2, 67.0],
    [-2.4, 67.4],
    [-5.2, 67.6],
    [-8.0, 67.8],
    [-10.8, 68.2],
    [-13.5, 68.8],
    // Garden inner border
    [6.5, 64.2],
    [1.8, 64.5],
    [-3.5, 64.8],
    [-7.8, 65.2],
    [-11.8, 65.8],
    // Central Discovery Island floral ring
    [GROTTO_CENTRAL_ISLAND.x + 2.4, GROTTO_CENTRAL_ISLAND.z - 1.5, GROTTO_CENTRAL_ISLAND.topY],
    [GROTTO_CENTRAL_ISLAND.x - 2.6, GROTTO_CENTRAL_ISLAND.z - 1.2, GROTTO_CENTRAL_ISLAND.topY],
    [GROTTO_CENTRAL_ISLAND.x + 1.8, GROTTO_CENTRAL_ISLAND.z + 2.2, GROTTO_CENTRAL_ISLAND.topY],
    [GROTTO_CENTRAL_ISLAND.x - 1.9, GROTTO_CENTRAL_ISLAND.z + 2.4, GROTTO_CENTRAL_ISLAND.topY],
    // Secondary Overlook Ledge floral accents
    [GROTTO_SECONDARY_VIEWPOINT.x - 2.2, GROTTO_SECONDARY_VIEWPOINT.z + 0.6, GROTTO_SECONDARY_VIEWPOINT.topY],
    [GROTTO_SECONDARY_VIEWPOINT.x + 2.0, GROTTO_SECONDARY_VIEWPOINT.z - 1.1, GROTTO_SECONDARY_VIEWPOINT.topY],
  ];

  moonLilySpots.forEach(([lx, lz, forcedY], idx) => {
    const ly =
      forcedY ??
      3.66 +
        THREE.MathUtils.smoothstep(69.5, 62.5, lz) * 0.36 +
        THREE.MathUtils.smoothstep(0.0, -16.0, lx) * 0.28;
    buildMoonLilyCluster(lx, ly, lz, idx % 2 === 0 ? 4 : 3, 1.08);
  });

  // Plant 42 Companion Pink Roses, Golden Marigolds & Lavender Blooms across the Grotto Garden
  for (let i = 0; i < 42; i++) {
    const gx = -17.5 + rng() * 34.0;
    const gz = 62.8 + rng() * 6.8;
    // Keep the main cobblestone walking lane clear
    if (gz > 65.2 && gz < 66.6 && gx > -8.0 && gx < 14.5) continue;

    const gy =
      3.66 +
      THREE.MathUtils.smoothstep(69.5, 62.5, gz) * 0.36 +
      THREE.MathUtils.smoothstep(0.0, -16.0, gx) * 0.28;

    const scale = 0.85 + rng() * 0.65;
    const stem = new THREE.Mesh(flowerStemGeo, foliageLeafMat);
    stem.position.set(gx, gy, gz);
    stem.scale.setScalar(scale);

    const bloomMat =
      i % 3 === 0
        ? pinkRoseBloomMat
        : i % 3 === 1
          ? marigoldBloomMat
          : wisteriaLavenderMat;
    const cup = new THREE.Mesh(tulipCupGeo, bloomMat);
    cup.position.set(gx, gy, gz);
    cup.scale.setScalar(scale);

    shoreAndGardenGroup.add(stem, cup);
  }

  // ============================================================================
  // 5. MIDNIGHT-SAPPHIRE MIRROR LAKE (Y = 3.15m), INTERACTIVE RIPPLES & WATERFALL CHAMBER
  // ============================================================================
  const lakeGeo = trackGeo(new THREE.PlaneGeometry(54.0, 26.0, 72, 48));
  lakeGeo.rotateX(-Math.PI / 2);

  const MAX_GROTTO_RIPPLES = 6;
  const grottoRippleUniformArray = Array.from(
    { length: MAX_GROTTO_RIPPLES },
    () => new THREE.Vector4(0, 0, 0, 0),
  );

  const lakeUniforms = {
    uTime: { value: 0 },
    uDeepSapphire: { value: new THREE.Color('#041024') },
    uMidSapphire: { value: new THREE.Color('#0c2d4e') },
    uCyanGlow: { value: new THREE.Color('#38bdf8') },
    uAmberLanternGlow: { value: new THREE.Color('#fbbf24') },
    uMoonlightColor: { value: new THREE.Color('#e0f2fe') },
    uRipples: { value: grottoRippleUniformArray },
  };

  const lakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#082038'),
      roughness: 0.1,
      metalness: 0.58,
      transparent: true,
      opacity: 0.95,
    }),
  );

  lakeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lakeUniforms.uTime;
    shader.uniforms.uDeepSapphire = lakeUniforms.uDeepSapphire;
    shader.uniforms.uMidSapphire = lakeUniforms.uMidSapphire;
    shader.uniforms.uCyanGlow = lakeUniforms.uCyanGlow;
    shader.uniforms.uAmberLanternGlow = lakeUniforms.uAmberLanternGlow;
    shader.uniforms.uMoonlightColor = lakeUniforms.uMoonlightColor;
    shader.uniforms.uRipples = lakeUniforms.uRipples;

    shader.vertexShader =
      `
      uniform float uTime;
      varying vec3 vLakeWorldPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec3 wp = transformed + vec3(2.5, 0.0, 74.8);
        float w1 = sin(wp.x * 0.85 + uTime * 1.5) * cos(wp.z * 0.95 - uTime * 1.2) * 0.016;
        float w2 = sin(length(wp.xz - vec2(-11.5, 82.5)) * 2.4 - uTime * 3.2) * 0.014;
        transformed.y += w1 + w2;
        vLakeWorldPos = wp;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform vec3 uDeepSapphire;
      uniform vec3 uMidSapphire;
      uniform vec3 uCyanGlow;
      uniform vec3 uAmberLanternGlow;
      uniform vec3 uMoonlightColor;
      uniform vec4 uRipples[${MAX_GROTTO_RIPPLES}];
      varying vec3 vLakeWorldPos;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float distWaterfall = length(vLakeWorldPos.xz - vec2(-11.5, 82.5));
        float distIsland = length(vLakeWorldPos.xz - vec2(3.5, 73.5));

        vec3 waterCol = mix(uDeepSapphire, uMidSapphire, smoothstep(3.0, 16.0, distIsland));

        // 1. Silvery-blue Moonbeam Oculus Reflection Path across the center of the lake
        float distOculus = length((vLakeWorldPos.xz - vec2(2.0, 75.5)) * vec2(0.75, 1.15));
        float moonShimmer = 0.55 + 0.45 * sin(vLakeWorldPos.z * 3.8 - uTime * 2.1 + sin(vLakeWorldPos.x * 2.0));
        float moonPool = (1.0 - smoothstep(0.8, 7.5, distOculus)) * moonShimmer;
        waterCol += uMoonlightColor * moonPool * 0.38;

        // 2. Concentric ripples radiating from the Waterfall plunge pool (-11.5, 82.5)
        float wfRipple = sin(distWaterfall * 3.4 - uTime * 4.0) * 0.5 + 0.5;
        float wfEnvelope = 1.0 - smoothstep(1.2, 16.0, distWaterfall);
        waterCol += uCyanGlow * wfRipple * wfEnvelope * 0.34;

        // 3. Warm golden reflection columns from the lakeside post lanterns & Central Discovery Island
        float islandRim = 1.0 - smoothstep(4.5, 10.5, distIsland);
        float lanternWave = 0.5 + 0.5 * sin(vLakeWorldPos.z * 5.2 + uTime * 2.6);
        float southShoreDist = abs(vLakeWorldPos.z - 68.2);
        float southLanternGlow = (1.0 - smoothstep(0.5, 5.5, southShoreDist)) * (0.5 + 0.5 * cos(vLakeWorldPos.x * 0.95));
        waterCol += uAmberLanternGlow * (islandRim * 0.32 + southLanternGlow * 0.36) * lanternWave;

        // 4. Interactive expanding concentric water ripples from E Touch the water & stepping stones
        float interactiveRingGlow = 0.0;
        for (int i = 0; i < ${MAX_GROTTO_RIPPLES}; i++) {
          vec4 rp = uRipples[i];
          if (rp.w > 0.005) {
            float d = length(vLakeWorldPos.xz - rp.xy);
            float band = abs(d - rp.z);
            float w1 = exp(-band * band * 18.0) * (0.55 + 0.45 * cos((d - rp.z) * 16.0));
            float band2 = abs(d - rp.z * 0.62);
            float w2 = exp(-band2 * band2 * 22.0) * 0.65;
            interactiveRingGlow += (w1 + w2) * rp.w;
          }
        }
        waterCol += mix(uMoonlightColor, uAmberLanternGlow, 0.45) * clamp(interactiveRingGlow, 0.0, 1.25) * 0.55;

        diffuseColor.rgb = waterCol;
        `,
      );
  };

  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.name = 'HiddenGrotto_UndergroundLakeSurface';
  lakeMesh.position.set(2.5, GROTTO_LAKE_WATER_LEVEL, 74.8);
  lakeMesh.receiveShadow = true;
  lakeGroup.add(lakeMesh);

  // Bounded Pool of 6 3D Expanding Concentric Ripple Rings on the Underground Lake Surface
  interface ActiveGrottoRipple {
    active: boolean;
    x: number;
    z: number;
    age: number;
    duration: number;
    maxRadius: number;
    strength: number;
    outerMesh: THREE.Mesh;
    innerMesh: THREE.Mesh;
    outerMat: THREE.MeshBasicMaterial;
    innerMat: THREE.MeshBasicMaterial;
  }

  const grottoRipplePoolGroup = new THREE.Group();
  grottoRipplePoolGroup.name = 'HiddenGrotto_InteractiveRipplePool';
  lakeGroup.add(grottoRipplePoolGroup);

  const grottoRippleRingGeo = trackGeo(new THREE.RingGeometry(0.88, 1.0, 36));
  grottoRippleRingGeo.rotateX(-Math.PI / 2);

  const activeGrottoRipples: ActiveGrottoRipple[] = [];
  for (let i = 0; i < MAX_GROTTO_RIPPLES; i++) {
    const outerMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#fde68a'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const innerMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#7dd3fc'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const outerMesh = new THREE.Mesh(grottoRippleRingGeo, outerMat);
    const innerMesh = new THREE.Mesh(grottoRippleRingGeo, innerMat);
    outerMesh.visible = false;
    innerMesh.visible = false;
    outerMesh.position.y = GROTTO_LAKE_WATER_LEVEL + 0.015;
    innerMesh.position.y = GROTTO_LAKE_WATER_LEVEL + 0.018;
    grottoRipplePoolGroup.add(outerMesh, innerMesh);

    activeGrottoRipples.push({
      active: false,
      x: 0,
      z: 0,
      age: 0,
      duration: 2.4,
      maxRadius: 2.6,
      strength: 1.0,
      outerMesh,
      innerMesh,
      outerMat,
      innerMat,
    });
  }

  function triggerLakeRipple(
    worldX: number,
    worldZ: number,
    strength = 1.0,
    exciteFlora = true,
  ) {
    let chosen = activeGrottoRipples.find((r) => !r.active);
    if (!chosen) {
      chosen = activeGrottoRipples.reduce((prev, curr) =>
        curr.age > prev.age ? curr : prev,
      );
    }

    chosen.active = true;
    chosen.x = worldX;
    chosen.z = worldZ;
    chosen.age = 0;
    chosen.duration = 2.3 + strength * 0.45;
    chosen.maxRadius = 1.95 + strength * 1.25;
    chosen.strength = THREE.MathUtils.clamp(strength, 0.35, 1.35);

    chosen.outerMesh.position.set(
      worldX,
      GROTTO_LAKE_WATER_LEVEL + 0.015,
      worldZ,
    );
    chosen.innerMesh.position.set(
      worldX,
      GROTTO_LAKE_WATER_LEVEL + 0.018,
      worldZ,
    );
    chosen.outerMesh.scale.setScalar(0.15);
    chosen.innerMesh.scale.setScalar(0.08);
    chosen.outerMesh.visible = true;
    chosen.innerMesh.visible = true;

    if (exciteFlora) {
      for (let i = 0; i < grottoMoonLilyClusters.length; i++) {
        const cl = grottoMoonLilyClusters[i];
        const d = Math.hypot(cl.x - worldX, cl.z - worldZ);
        if (d < 9.5) {
          const prox = 1.0 - d / 9.5;
          cl.boost = Math.max(cl.boost, 0.75 + prox * 1.35);
        }
      }
    }
  }

  // Waterfall Chamber (-11.5, 82.5): High Ledge (Y=11.2m) -> Plunge Pool (Y=3.15m)
  const waterfallGroup = new THREE.Group();
  waterfallGroup.name = 'HiddenGrotto_WaterfallChamber';
  waterfallGroup.position.set(
    GROTTO_WATERFALL_CHAMBER.x,
    GROTTO_LAKE_WATER_LEVEL,
    GROTTO_WATERFALL_CHAMBER.z,
  );
  lakeGroup.add(waterfallGroup);

  const waterfallHeight =
    GROTTO_WATERFALL_CHAMBER.ledgeY - GROTTO_LAKE_WATER_LEVEL;
  const waterfallSheetGeo = trackGeo(
    new THREE.CylinderGeometry(
      GROTTO_WATERFALL_CHAMBER.width * 0.42,
      GROTTO_WATERFALL_CHAMBER.width * 0.58,
      waterfallHeight,
      16,
      1,
      true,
      -Math.PI * 0.42,
      Math.PI * 0.84,
    ),
  );
  const waterfallUniforms = {
    uTime: { value: 0 },
  };
  const waterfallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7dd3fc'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.95,
      roughness: 0.18,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  waterfallMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterfallUniforms.uTime;
    shader.fragmentShader =
      `
      uniform float uTime;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float streak = sin(gl_FragCoord.x * 0.18) * cos(gl_FragCoord.y * 0.08 + uTime * 9.5);
        diffuseColor.rgb += vec3(0.25, 0.45, 0.55) * max(0.0, streak);
        `,
      );
  };

  const waterfallSheet = new THREE.Mesh(waterfallSheetGeo, waterfallMat);
  waterfallSheet.position.set(0, waterfallHeight * 0.5, 0);
  waterfallGroup.add(waterfallSheet);

  const plungeFoamGeo = trackGeo(new THREE.RingGeometry(1.1, 3.1, 32));
  plungeFoamGeo.rotateX(-Math.PI / 2);
  const plungeFoamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bae6fd'),
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  const plungeFoamMesh = new THREE.Mesh(plungeFoamGeo, plungeFoamMat);
  plungeFoamMesh.position.y = 0.03;
  waterfallGroup.add(plungeFoamMesh);

  // ============================================================================
  // 6. NATURAL STONE ARCH BRIDGE & SECONDARY ROCK VIEWPOINT LEDGE (11.5, 81.5, Y=5.45m)
  // ============================================================================
  const bridgeAndViewpointGroup = new THREE.Group();
  bridgeAndViewpointGroup.name = 'HiddenGrotto_BridgeAndViewpoint';
  group.add(bridgeAndViewpointGroup);

  const numBridgeSteps = 18;
  for (let i = 0; i < numBridgeSteps; i++) {
    const t = i / (numBridgeSteps - 1);
    const bz = THREE.MathUtils.lerp(
      GROTTO_STONE_BRIDGE.startZ,
      GROTTO_STONE_BRIDGE.endZ,
      t,
    );
    const bx =
      THREE.MathUtils.lerp(
        GROTTO_STONE_BRIDGE.startX,
        GROTTO_STONE_BRIDGE.endX,
        t,
      ) +
      Math.sin(t * Math.PI) * 1.15;
    const by =
      getGrottoStoneBridgeHeightAt(bx, bz) ??
      THREE.MathUtils.lerp(
        GROTTO_STONE_BRIDGE.startY,
        GROTTO_STONE_BRIDGE.endY,
        t,
      );

    const archBlock = new THREE.Mesh(
      trackGeo(
        new THREE.BoxGeometry(
          GROTTO_STONE_BRIDGE.halfWidth * 2.05,
          0.48,
          0.95,
        ),
      ),
      i % 3 === 0 ? cavernMossStoneMat : bridgeArchStoneMat,
    );
    archBlock.position.set(bx, by - 0.23, bz);
    archBlock.rotation.y = -0.25;
    archBlock.castShadow = true;
    archBlock.receiveShadow = true;
    bridgeAndViewpointGroup.add(archBlock);
  }

  // Secondary Rock Viewpoint Ledge Platform at (11.5, 81.5, topY = 5.45m)
  const viewpointSlabGeo = trackGeo(
    new THREE.CylinderGeometry(
      GROTTO_SECONDARY_VIEWPOINT.radiusX,
      GROTTO_SECONDARY_VIEWPOINT.radiusX + 1.2,
      2.6,
      16,
    ),
  );
  const viewpointSlab = new THREE.Mesh(viewpointSlabGeo, shoreMat);
  viewpointSlab.position.set(
    GROTTO_SECONDARY_VIEWPOINT.x,
    GROTTO_SECONDARY_VIEWPOINT.topY - 1.3,
    GROTTO_SECONDARY_VIEWPOINT.z,
  );
  viewpointSlab.scale.set(
    1.0,
    1.0,
    GROTTO_SECONDARY_VIEWPOINT.radiusZ / GROTTO_SECONDARY_VIEWPOINT.radiusX,
  );
  viewpointSlab.receiveShadow = true;
  viewpointSlab.castShadow = true;
  bridgeAndViewpointGroup.add(viewpointSlab);

  /**
   * Builds an Ornate Silver-Filigree & Warm Timber Garden Bench (matching Reference Images 1 & 2).
   */
  const benchSeatGeo = trackGeo(new THREE.BoxGeometry(2.05, 0.12, 0.62));
  const benchBackGeo = trackGeo(new THREE.BoxGeometry(2.05, 0.44, 0.1));
  const benchArmGeo = trackGeo(new THREE.TorusGeometry(0.28, 0.04, 8, 16, Math.PI));
  const benchLegGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.46, 8));

  const buildOrnateGardenBench = (
    name: string,
    bx: number,
    by: number,
    bz: number,
    rotY: number,
  ) => {
    const bGroup = new THREE.Group();
    bGroup.name = name;
    bGroup.position.set(bx, by, bz);
    bGroup.rotation.y = rotY;

    const seat = new THREE.Mesh(benchSeatGeo, warmBenchTimberMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    bGroup.add(seat);

    const back = new THREE.Mesh(benchBackGeo, warmBenchTimberMat);
    back.position.set(0, 0.74, -0.26);
    back.rotation.x = -0.14;
    back.castShadow = true;
    bGroup.add(back);

    for (const side of [-0.92, 0.92]) {
      const frontLeg = new THREE.Mesh(benchLegGeo, silverFiligreeMat);
      frontLeg.position.set(side, 0.23, 0.22);
      const backLeg = new THREE.Mesh(benchLegGeo, silverFiligreeMat);
      backLeg.position.set(side, 0.23, -0.22);

      const arm = new THREE.Mesh(benchArmGeo, silverFiligreeMat);
      arm.position.set(side, 0.52, 0.0);
      arm.rotation.y = Math.PI / 2;

      bGroup.add(frontLeg, backLeg, arm);
    }

    return bGroup;
  };

  const overlookBenchGroup = buildOrnateGardenBench(
    'HiddenGrotto_OverlookOrnateBench',
    GROTTO_OVERLOOK_BENCH_POS.x,
    GROTTO_OVERLOOK_BENCH_POS.y,
    GROTTO_OVERLOOK_BENCH_POS.z,
    GROTTO_OVERLOOK_BENCH_POS.rotY,
  );
  bridgeAndViewpointGroup.add(overlookBenchGroup);
  colliders.push({
    x: GROTTO_OVERLOOK_BENCH_POS.x,
    y: GROTTO_OVERLOOK_BENCH_POS.y,
    z: GROTTO_OVERLOOK_BENCH_POS.z,
    radius: 0.9,
  });

  // ============================================================================
  // 7. SIX WALKABLE STEPPING STONES & CENTRAL DISCOVERY ISLAND (3.5, 73.5, Y=3.85m)
  // ============================================================================
  const islandGroup = new THREE.Group();
  islandGroup.name = 'HiddenGrotto_CentralDiscoveryIsland';
  group.add(islandGroup);

  const grottoStepStoneGeo = trackGeo(
    new THREE.CylinderGeometry(0.95, 1.08, 0.44, 10),
  );
  const grottoStepRimGeo = trackGeo(new THREE.RingGeometry(0.88, 0.98, 10));
  grottoStepRimGeo.rotateX(-Math.PI / 2);

  GROTTO_ISLAND_STEPPING_STONES.forEach((st, idx) => {
    const stGroup = new THREE.Group();
    stGroup.name = `GrottoSteppingStone_${idx + 1}`;
    stGroup.position.set(st.x, st.topY - 0.21, st.z);
    stGroup.rotation.y = st.rotY;

    const stone = new THREE.Mesh(grottoStepStoneGeo, bridgeArchStoneMat);
    stone.scale.set(st.scaleX, 1.0, st.scaleZ);
    stone.castShadow = true;
    stone.receiveShadow = true;

    const rim = new THREE.Mesh(
      grottoStepRimGeo,
      idx % 2 === 0 ? mineralCyanMat : mineralTealMat,
    );
    rim.position.y = 0.225;
    rim.scale.set(st.scaleX, st.scaleZ, 1.0);

    stGroup.add(stone, rim);
    islandGroup.add(stGroup);
  });

  // Central Discovery Island Cobblestone Terrace Mound (center (3.5, 73.5), radius 5.5m, topY = 3.85m)
  const islandBaseGeo = trackGeo(
    new THREE.CylinderGeometry(
      GROTTO_CENTRAL_ISLAND.flatRadius,
      GROTTO_CENTRAL_ISLAND.radius + 0.5,
      1.8,
      28,
    ),
  );
  const islandBaseMesh = new THREE.Mesh(islandBaseGeo, shoreMat);
  islandBaseMesh.position.set(
    GROTTO_CENTRAL_ISLAND.x,
    GROTTO_CENTRAL_ISLAND.topY - 0.9,
    GROTTO_CENTRAL_ISLAND.z,
  );
  islandBaseMesh.receiveShadow = true;
  islandBaseMesh.castShadow = true;
  islandGroup.add(islandBaseMesh);

  // Ornate Silver-Filigree & Warm Timber Bench on the Central Discovery Island (`E  Sit at the island sanctuary`)
  const islandBenchGroup = buildOrnateGardenBench(
    'HiddenGrotto_IslandSanctuaryBench',
    GROTTO_ISLAND_BENCH_POS.x,
    GROTTO_ISLAND_BENCH_POS.y,
    GROTTO_ISLAND_BENCH_POS.z,
    GROTTO_ISLAND_BENCH_POS.rotY,
  );
  islandGroup.add(islandBenchGroup);
  colliders.push({
    x: GROTTO_ISLAND_BENCH_POS.x,
    y: GROTTO_ISLAND_BENCH_POS.y,
    z: GROTTO_ISLAND_BENCH_POS.z,
    radius: 0.9,
  });

  // ============================================================================
  // 8. FLOATING WARM-GOLD FIREFLY ORBS & SUBTERRANEAN LIGHTING RIG
  // ============================================================================
  const fireflyCount = 46;
  const fireflyGeo = trackGeo(new THREE.SphereGeometry(0.065, 8, 8));
  const fireflyMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fef08a'),
      transparent: true,
      opacity: 0.92,
    }),
  );
  const fireflyInst = new THREE.InstancedMesh(
    fireflyGeo,
    fireflyMat,
    fireflyCount,
  );
  fireflyInst.name = 'HiddenGrotto_FloatingGoldenFireflies';
  group.add(fireflyInst);

  const fireflySeeds = Array.from({ length: fireflyCount }, () => ({
    baseX: -15.0 + rng() * 34.0,
    baseY: 3.9 + rng() * 3.2,
    baseZ: 63.0 + rng() * 19.0,
    speed: 0.8 + rng() * 1.1,
    phase: rng() * Math.PI * 2,
    radius: 0.35 + rng() * 0.65,
  }));
  const _fireflyDummy = new THREE.Object3D();

  const islandAmberLight = new THREE.PointLight(0xfbbf24, 2.35, 28.0, 1.45);
  islandAmberLight.position.set(
    GROTTO_CENTRAL_ISLAND.x,
    GROTTO_CENTRAL_ISLAND.topY + 3.2,
    GROTTO_CENTRAL_ISLAND.z,
  );
  islandAmberLight.userData.skipAtmosphereCull = true;
  group.add(islandAmberLight);

  const gardenWarmLight = new THREE.PointLight(0xfde68a, 2.1, 26.0, 1.45);
  gardenWarmLight.position.set(
    GROTTO_BIOLUM_GARDEN.x + 2.0,
    GROTTO_BIOLUM_GARDEN.baseY + 3.0,
    GROTTO_BIOLUM_GARDEN.z,
  );
  gardenWarmLight.userData.skipAtmosphereCull = true;
  group.add(gardenWarmLight);

  const waterfallTealLight = new THREE.PointLight(0x38bdf8, 1.95, 28.0, 1.45);
  waterfallTealLight.position.set(
    GROTTO_WATERFALL_CHAMBER.x + 1.5,
    GROTTO_LAKE_WATER_LEVEL + 4.2,
    GROTTO_WATERFALL_CHAMBER.z - 2.0,
  );
  waterfallTealLight.userData.skipAtmosphereCull = true;
  group.add(waterfallTealLight);

  const tunnelThresholdLight = new THREE.PointLight(0xfbbf24, 1.85, 22.0, 1.5);
  tunnelThresholdLight.position.set(15.5, 6.2, 62.5);
  tunnelThresholdLight.userData.skipAtmosphereCull = true;
  group.add(tunnelThresholdLight);

  return {
    group,
    lakeGroup,
    colliders,
    triggerLakeRipple,
    update(
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
    ) {
      const dt = Math.min(Math.max(delta, 0.001), 0.1);
      lakeUniforms.uTime.value = elapsedTime;
      waterfallUniforms.uTime.value = elapsedTime;

      const foamPulse = 0.92 + Math.sin(elapsedTime * 3.8) * 0.08;
      plungeFoamMesh.scale.set(foamPulse, 1.0, foamPulse);
      plungeFoamMat.opacity = 0.42 + Math.sin(elapsedTime * 4.5) * 0.12;

      // 1. Update Interactive Grotto Lake Water Ripples (3D rings + shader uniforms)
      for (let i = 0; i < MAX_GROTTO_RIPPLES; i++) {
        const rp = activeGrottoRipples[i];
        const uVec = grottoRippleUniformArray[i];
        if (!rp.active) {
          uVec.set(0, 0, 0, 0);
          continue;
        }
        rp.age += dt;
        const progress = rp.age / rp.duration;
        if (progress >= 1.0) {
          rp.active = false;
          rp.outerMesh.visible = false;
          rp.innerMesh.visible = false;
          uVec.set(0, 0, 0, 0);
          continue;
        }

        const eased = 1.0 - Math.pow(1.0 - progress, 2.1);
        const outerR = 0.18 + eased * rp.maxRadius;
        const innerR = Math.max(0.1, outerR * 0.62);
        const fade = Math.sin(progress * Math.PI) * (1.0 - progress * 0.35);

        rp.outerMesh.scale.setScalar(outerR);
        rp.innerMesh.scale.setScalar(innerR);
        rp.outerMat.opacity = fade * 0.62 * rp.strength;
        rp.innerMat.opacity = fade * 0.46 * rp.strength;

        uVec.set(rp.x, rp.z, outerR, fade * rp.strength);
      }

      // 2. Update White Moon-Lily Golden Center Glow Boost Decay
      for (let i = 0; i < grottoMoonLilyClusters.length; i++) {
        const cl = grottoMoonLilyClusters[i];
        if (cl.boost > 0.005) {
          cl.boost *= Math.exp(-dt * 1.5);
        } else {
          cl.boost = 0;
        }
        const glowVal =
          2.2 +
          Math.sin(elapsedTime * 2.4 + i * 0.7) * 0.25 +
          cl.boost * 2.2;
        for (let m = 0; m < cl.centerMats.length; m++) {
          cl.centerMats[m].emissiveIntensity = glowVal;
        }
      }

      // 3. Animate Floating Golden Firefly Orbs above the Grotto Flowers & Cobblestones
      for (let i = 0; i < fireflyCount; i++) {
        const f = fireflySeeds[i];
        const t = elapsedTime * f.speed + f.phase;
        _fireflyDummy.position.set(
          f.baseX + Math.cos(t) * f.radius,
          f.baseY + Math.sin(t * 1.3) * 0.28,
          f.baseZ + Math.sin(t * 0.9) * f.radius,
        );
        const pulseScale = 0.75 + 0.35 * Math.sin(t * 2.2);
        _fireflyDummy.scale.setScalar(pulseScale);
        _fireflyDummy.updateMatrix();
        fireflyInst.setMatrixAt(i, _fireflyDummy.matrix);
      }
      fireflyInst.instanceMatrix.needsUpdate = true;

      // 4. Smoothly activate cavern lights well before the cave entrance (Z > 36) so the interior glows from the tunnel mouth!
      const grottoProx = THREE.MathUtils.smoothstep(playerPos.z, 36.0, 54.0);
      islandAmberLight.intensity =
        (2.35 + Math.sin(elapsedTime * 2.2) * 0.2) * grottoProx;
      gardenWarmLight.intensity =
        (2.1 + Math.cos(elapsedTime * 1.9) * 0.18) * grottoProx;
      waterfallTealLight.intensity = 1.95 * grottoProx;
      tunnelThresholdLight.intensity = 1.85 * grottoProx;

      islandAmberLight.visible = grottoProx > 0.02;
      gardenWarmLight.visible = grottoProx > 0.02;
      waterfallTealLight.visible = grottoProx > 0.02;
      tunnelThresholdLight.visible = grottoProx > 0.02;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
