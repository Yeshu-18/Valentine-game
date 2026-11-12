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
} from './privateWorldMath';

export interface PrivateHiddenGrottoBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

export const GROTTO_ISLAND_BENCH_POS = {
  x: GROTTO_CENTRAL_ISLAND.x - 1.2, // 4.8
  y: GROTTO_CENTRAL_ISLAND.topY, // 3.85
  z: GROTTO_CENTRAL_ISLAND.z - 1.6, // 135.9
  rotY: -0.58, // Facing NNW toward the Waterfall Chamber & Lake
} as const;

export const GROTTO_OVERLOOK_BENCH_POS = {
  x: GROTTO_SECONDARY_VIEWPOINT.x + 1.1, // 18.6
  y: GROTTO_SECONDARY_VIEWPOINT.topY, // 5.65
  z: GROTTO_SECONDARY_VIEWPOINT.z + 0.4, // 148.6
  rotY: -1.18, // Facing WSW across the Central Discovery Island & Waterfall
} as const;

export function createPrivateHiddenGrotto(): PrivateHiddenGrottoBundle {
  const group = new THREE.Group();
  group.name = 'HiddenGrotto_UndergroundLakeworldRoot';

  const colliders: CircleCollider[] = [];
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

  const rng = createPrivateSeededRng(20270214 ^ 0x6a09e667);

  // ============================================================================
  // 1. SHARED CAVERN ROCK, MINERAL, WATER & BIOLUMINESCENT MATERIALS
  // ============================================================================
  const cavernShellBlackMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#03060c'),
      side: THREE.BackSide,
    }),
  );
  const cavernBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#141b26'),
      roughness: 0.9,
      metalness: 0.06,
    }),
  );
  const cavernWetSlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c2736'),
      roughness: 0.68,
      metalness: 0.14,
    }),
  );
  const cavernMossStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1f4442'),
      roughness: 0.84,
      metalness: 0.05,
    }),
  );
  const bridgeArchStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2c3748'),
      roughness: 0.82,
      metalness: 0.07,
    }),
  );
  const mineralCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#67e8f9'),
      emissive: new THREE.Color('#06b6d4'),
      emissiveIntensity: 1.55,
      roughness: 0.22,
    }),
  );
  const mineralTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5eead4'),
      emissive: new THREE.Color('#14b8a6'),
      emissiveIntensity: 1.45,
      roughness: 0.24,
    }),
  );
  const mineralVioletMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e9d5ff'),
      emissive: new THREE.Color('#a855f7'),
      emissiveIntensity: 1.35,
      roughness: 0.26,
    }),
  );
  const sanctuaryAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.85,
      roughness: 0.18,
      metalness: 0.35,
    }),
  );
  const sanctuaryBronzeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3520'),
      roughness: 0.34,
      metalness: 0.82,
    }),
  );

  const rockDodecGeo = trackGeo(new THREE.DodecahedronGeometry(1.0, 1));
  const stalactiteConeGeo = trackGeo(new THREE.ConeGeometry(0.55, 3.2, 7));
  const crystalPrismGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.18, 1.2, 6));
  crystalPrismGeo.translate(0, 0.6, 0);

  // ============================================================================
  // 2. DESCENDING ENTRANCE TUNNEL (Connecting (35, 110, Y=12.0m) -> (27, 126.5, Y=3.95m))
  // ============================================================================
  const tunnelGroup = new THREE.Group();
  tunnelGroup.name = 'HiddenGrotto_OpenDescendingTunnel';
  group.add(tunnelGroup);

  const numTunnelSegments = 16;
  for (let i = 0; i < numTunnelSegments; i++) {
    const t = i / (numTunnelSegments - 1);
    const z = 110.2 + t * 16.0; // Z: 110.2 -> 126.2
    const smoothT = t * t * (3.0 - 2.0 * t);
    const centerX = 35.0 - smoothT * 8.0; // X: 35.0 -> 27.0
    const floorY =
      getHiddenCaveTunnelFloorHeightAt(centerX, z) ??
      THREE.MathUtils.lerp(12.0, 3.95, smoothT);
    const halfWidth = THREE.MathUtils.lerp(
      2.15,
      4.0,
      THREE.MathUtils.smoothstep(t, 0.6, 1.0),
    );

    // 2A. Stepped / Sloped Basalt Floor Slab flush with getHiddenCaveTunnelFloorHeightAt
    const slabGeo = trackGeo(
      new THREE.BoxGeometry(halfWidth * 2.15, 0.42, 1.55),
    );
    const floorSlab = new THREE.Mesh(
      slabGeo,
      i % 3 === 0 ? cavernMossStoneMat : cavernWetSlateMat,
    );
    floorSlab.position.set(centerX, floorY - 0.21, z);
    floorSlab.rotation.x = 0.44 * (1.0 - Math.abs(t - 0.5) * 0.6);
    floorSlab.rotation.y = -0.38 * Math.sin(t * Math.PI);
    floorSlab.receiveShadow = true;
    tunnelGroup.add(floorSlab);

    // 2B. Ribbed Basalt Side Walls & Layer-Aware Underground Colliders (y < 12.5)
    for (const side of [-1, 1] as const) {
      const wx = centerX + side * (halfWidth + 0.55);
      const wallRock = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
      wallRock.position.set(wx, floorY + 1.95, z);
      wallRock.scale.set(1.55, 2.45, 1.45);
      wallRock.rotation.set(0.14 * side, i * 0.55, -0.1 * side);
      wallRock.castShadow = true;
      wallRock.receiveShadow = true;
      tunnelGroup.add(wallRock);

      colliders.push({
        x: centerX + side * (halfWidth + 0.65),
        y: floorY,
        z,
        radius: 0.95,
      });

      // Glowing Mineral Veins & Guiding Tunnel Mushrooms on alternating ribs
      if (i % 2 === 1) {
        const vein = new THREE.Mesh(
          crystalPrismGeo,
          (i + (side === 1 ? 1 : 0)) % 3 === 0
            ? mineralVioletMat
            : mineralTealMat,
        );
        vein.position.set(
          centerX + side * (halfWidth - 0.05),
          floorY + 0.45 + (i % 3) * 0.35,
          z,
        );
        vein.rotation.set(0.25, side * 0.6, -side * 0.48);
        vein.scale.setScalar(0.65);
        tunnelGroup.add(vein);
      }
    }

    // 2C. Vaulted Basalt Tunnel Ceiling Arch
    const ceilingArch = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
    ceilingArch.position.set(centerX, floorY + 4.15, z);
    ceilingArch.scale.set(halfWidth * 1.65, 1.35, 1.55);
    ceilingArch.rotation.set(0.2, i * 0.3, 0);
    tunnelGroup.add(ceilingArch);
  }

  // ============================================================================
  // 3. MAIN SUBTERRANEAN CAVERN SHELL, PERIMETER WALLS, CEILING & STALACTITES
  // ============================================================================
  const cavernShellGroup = new THREE.Group();
  cavernShellGroup.name = 'HiddenGrotto_MainCavernEnclosure';
  group.add(cavernShellGroup);

  // Outer light-tight occlusion box strictly inside RESERVED_GROTTO_VOLUME so no external sky/ocean ever leaks
  const shellSpanX =
    RESERVED_GROTTO_VOLUME.maxX - RESERVED_GROTTO_VOLUME.minX - 1.0;
  const shellSpanY =
    RESERVED_GROTTO_VOLUME.maxY - RESERVED_GROTTO_VOLUME.minY - 0.4;
  const shellSpanZ =
    RESERVED_GROTTO_VOLUME.maxZ - RESERVED_GROTTO_VOLUME.minZ - 1.0;
  const occlusionShell = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(shellSpanX, shellSpanY, shellSpanZ)),
    cavernShellBlackMat,
  );
  occlusionShell.position.set(
    RESERVED_GROTTO_VOLUME.centerX,
    RESERVED_GROTTO_VOLUME.centerY,
    RESERVED_GROTTO_VOLUME.centerZ,
  );
  cavernShellGroup.add(occlusionShell);

  // Sculpted Cavern Perimeter Wall Crags & Vaulted Ceiling Dome Boulders
  const wallSegments = 38;
  for (let i = 0; i < wallSegments; i++) {
    const ang = (i / wallSegments) * Math.PI * 2;
    const rx = 35.5 + Math.sin(ang * 3.0) * 2.5;
    const rz = 18.2 + Math.cos(ang * 2.0) * 1.6;
    const wx = 4.5 + Math.cos(ang) * rx;
    const wz = 138.0 + Math.sin(ang) * rz;

    // Leave the Southeastern Tunnel Entrance Mouth around (27, 125) open!
    if (Math.hypot(wx - 27.5, wz - 125.0) < 6.2) {
      continue;
    }

    const wallH = 9.5 + (i % 3) * 1.4;
    const wallCrag = new THREE.Mesh(
      rockDodecGeo,
      i % 3 === 0 ? cavernWetSlateMat : cavernBasaltMat,
    );
    wallCrag.position.set(wx, 2.2 + wallH * 0.45, wz);
    wallCrag.scale.set(4.6, wallH * 0.62, 4.2);
    wallCrag.rotation.set(
      (rng() - 0.5) * 0.2,
      ang + 0.4,
      (rng() - 0.5) * 0.2,
    );
    wallCrag.receiveShadow = true;
    cavernShellGroup.add(wallCrag);

    // Register underground perimeter wall colliders
    colliders.push({
      x: wx,
      y: 4.0,
      z: wz,
      radius: 3.2,
    });
  }

  // Vaulted Ceiling Roof Crags & Hanging Stalactites with Luminous Mineral Tips
  for (let i = 0; i < 48; i++) {
    const cx = -24.0 + rng() * 62.0;
    const cz = 122.0 + rng() * 31.0;
    const ceilY = getGrottoCeilingHeightAt(cx, cz);

    const roofRock = new THREE.Mesh(rockDodecGeo, cavernBasaltMat);
    roofRock.position.set(cx, ceilY + 0.65, cz);
    roofRock.scale.set(4.2 + rng() * 3.2, 1.35, 3.8 + rng() * 2.8);
    roofRock.rotation.set(0, rng() * Math.PI * 2, 0);
    cavernShellGroup.add(roofRock);

    if (i < 32) {
      const stalLen = 1.6 + rng() * 2.4;
      const stal = new THREE.Mesh(stalactiteConeGeo, cavernWetSlateMat);
      stal.position.set(cx, ceilY - stalLen * 0.42, cz);
      stal.rotation.x = Math.PI; // Pointing downward from ceiling
      stal.scale.set(0.55 + rng() * 0.45, stalLen / 3.2, 0.55 + rng() * 0.45);
      cavernShellGroup.add(stal);

      if (i % 2 === 0) {
        const glowTip = new THREE.Mesh(
          crystalPrismGeo,
          i % 4 === 0 ? mineralCyanMat : mineralTealMat,
        );
        glowTip.position.set(cx, ceilY - stalLen * 0.85, cz);
        glowTip.rotation.x = Math.PI;
        glowTip.scale.setScalar(0.42);
        cavernShellGroup.add(glowTip);
      }
    }
  }

  // ============================================================================
  // 4. WALKABLE SOUTHERN ARRIVAL SHORE & BIOLUMINESCENT CAVERN GARDEN (-11.5, 126.5)
  // ============================================================================
  const shoreAndGardenGroup = new THREE.Group();
  shoreAndGardenGroup.name = 'HiddenGrotto_ShoreAndBiolumGarden';
  group.add(shoreAndGardenGroup);

  // Contoured Walkable Southern Shore & Southwestern Garden Terrace Mesh (Z: 119.5..135.5, X: -26.5..+33.5)
  const shoreGeo = trackGeo(new THREE.PlaneGeometry(60.0, 16.5, 64, 24));
  shoreGeo.rotateX(-Math.PI / 2);
  const shorePos = shoreGeo.attributes.position as THREE.BufferAttribute;
  const shoreCols = new Float32Array(shorePos.count * 3);
  const cShoreBasalt = new THREE.Color('#182432');
  const cGardenMoss = new THREE.Color('#1d4e4a');
  const cGardenTeal = new THREE.Color('#155e63');
  const _col = new THREE.Color();

  for (let i = 0; i < shorePos.count; i++) {
    const wx = shorePos.getX(i) + 3.5;
    const wz = shorePos.getZ(i) + 127.5;
    const gardenSlope = THREE.MathUtils.smoothstep(130.0, 121.0, wz) * 0.42;
    const westTerrace = THREE.MathUtils.smoothstep(0.0, -22.0, wx) * 0.35;
    const wy = 3.68 + gardenSlope + westTerrace;
    shorePos.setXYZ(i, wx, wy, wz);

    const gardenBlend = THREE.MathUtils.smoothstep(8.0, -14.0, wx);
    _col.lerpColors(cShoreBasalt, cGardenMoss, gardenBlend * 0.85);
    if (gardenBlend > 0.4) {
      _col.lerp(cGardenTeal, (gardenBlend - 0.4) * 0.55);
    }
    shoreCols[i * 3] = _col.r;
    shoreCols[i * 3 + 1] = _col.g;
    shoreCols[i * 3 + 2] = _col.b;
  }
  shoreGeo.setAttribute('color', new THREE.BufferAttribute(shoreCols, 3));
  shoreGeo.computeVertexNormals();

  const shoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.06,
    }),
  );
  const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
  shoreMesh.receiveShadow = true;
  shoreAndGardenGroup.add(shoreMesh);

  // Bioluminescent Cavern Garden Flora: Luminous Giant & Medium Mushrooms + Crystal Spires
  const grottoCapGeo = trackGeo(new THREE.ConeGeometry(0.55, 0.36, 12));
  grottoCapGeo.translate(0, 0.62, 0);
  const grottoStemGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 0.62, 8));
  grottoStemGeo.translate(0, 0.31, 0);

  for (let i = 0; i < 28; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = Math.pow(rng(), 0.7) * 12.5;
    const gx = GROTTO_BIOLUM_GARDEN.x + Math.cos(ang) * rad;
    const gz = GROTTO_BIOLUM_GARDEN.z + Math.sin(ang) * rad * 0.52;
    const gy =
      3.68 +
      THREE.MathUtils.smoothstep(130.0, 121.0, gz) * 0.42 +
      THREE.MathUtils.smoothstep(0.0, -22.0, gx) * 0.35;

    const scale = 0.65 + rng() * 1.15;
    const stem = new THREE.Mesh(grottoStemGeo, cavernMossStoneMat);
    stem.position.set(gx, gy, gz);
    stem.scale.setScalar(scale);

    const capMat =
      i % 3 === 0
        ? mineralCyanMat
        : i % 3 === 1
          ? mineralTealMat
          : mineralVioletMat;
    const cap = new THREE.Mesh(grottoCapGeo, capMat);
    cap.position.set(gx, gy, gz);
    cap.scale.setScalar(scale);

    shoreAndGardenGroup.add(stem, cap);

    if (i % 3 === 0) {
      const crystal = new THREE.Mesh(
        crystalPrismGeo,
        i % 2 === 0 ? mineralCyanMat : mineralVioletMat,
      );
      crystal.position.set(gx + 0.35, gy, gz - 0.25);
      crystal.rotation.set(
        (rng() - 0.5) * 0.35,
        rng() * Math.PI * 2,
        (rng() - 0.5) * 0.35,
      );
      crystal.scale.setScalar(0.55 + rng() * 0.75);
      shoreAndGardenGroup.add(crystal);
    }
  }

  // ============================================================================
  // 5. MIDNIGHT-SAPPHIRE UNDERGROUND LAKE (Y = 3.15m) & WATERFALL CHAMBER (-16.5, 150.5)
  // ============================================================================
  const lakeGeo = trackGeo(new THREE.PlaneGeometry(76.0, 36.0, 72, 48));
  lakeGeo.rotateX(-Math.PI / 2);

  const lakeUniforms = {
    uTime: { value: 0 },
    uDeepSapphire: { value: new THREE.Color('#041022') },
    uMidSapphire: { value: new THREE.Color('#0a2846') },
    uCyanGlow: { value: new THREE.Color('#22d3ee') },
    uAmberIslandGlow: { value: new THREE.Color('#fbbf24') },
  };

  const lakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#082038'),
      roughness: 0.14,
      metalness: 0.52,
      transparent: true,
      opacity: 0.94,
    }),
  );

  lakeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lakeUniforms.uTime;
    shader.uniforms.uDeepSapphire = lakeUniforms.uDeepSapphire;
    shader.uniforms.uMidSapphire = lakeUniforms.uMidSapphire;
    shader.uniforms.uCyanGlow = lakeUniforms.uCyanGlow;
    shader.uniforms.uAmberIslandGlow = lakeUniforms.uAmberIslandGlow;

    shader.vertexShader =
      `
      uniform float uTime;
      varying vec3 vLakeWorldPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec3 wp = transformed + vec3(4.5, 0.0, 139.2);
        float w1 = sin(wp.x * 0.75 + uTime * 1.6) * cos(wp.z * 0.85 - uTime * 1.3) * 0.022;
        float w2 = sin(length(wp.xz - vec2(-16.5, 150.5)) * 2.2 - uTime * 3.4) * 0.018;
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
      uniform vec3 uAmberIslandGlow;
      varying vec3 vLakeWorldPos;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float distWaterfall = length(vLakeWorldPos.xz - vec2(-16.5, 150.5));
        float distIsland = length(vLakeWorldPos.xz - vec2(6.0, 137.5));

        vec3 waterCol = mix(uDeepSapphire, uMidSapphire, smoothstep(4.0, 22.0, distIsland));

        // Concentric ripples radiating from the Waterfall plunge pool (-16.5, 150.5)
        float wfRipple = sin(distWaterfall * 3.2 - uTime * 4.2) * 0.5 + 0.5;
        float wfEnvelope = 1.0 - smoothstep(1.5, 22.0, distWaterfall);
        waterCol += uCyanGlow * wfRipple * wfEnvelope * 0.36;

        // Warm amber-gold reflection around the Central Discovery Island (6.0, 137.5)
        float islandRim = 1.0 - smoothstep(6.2, 13.5, distIsland);
        float islandShimmer = sin(distIsland * 4.5 - uTime * 2.4) * 0.5 + 0.5;
        waterCol += uAmberIslandGlow * islandRim * (0.45 + 0.55 * islandShimmer) * 0.28;

        // Subtle bioluminescent caustics across the lake surface
        float caustic = sin(vLakeWorldPos.x * 1.4 + uTime * 1.5) * cos(vLakeWorldPos.z * 1.4 - uTime * 1.2);
        waterCol += uCyanGlow * max(0.0, caustic) * 0.11;

        diffuseColor.rgb = waterCol;
        `,
      );
  };

  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.name = 'HiddenGrotto_UndergroundLakeSurface';
  lakeMesh.position.set(4.5, GROTTO_LAKE_WATER_LEVEL, 139.2);
  lakeMesh.receiveShadow = true;
  group.add(lakeMesh);

  // Waterfall Chamber (-16.5, 150.5): High Ledge (Y=11.8m) -> Plunge Pool (Y=3.15m)
  const waterfallGroup = new THREE.Group();
  waterfallGroup.name = 'HiddenGrotto_WaterfallChamber';
  waterfallGroup.position.set(
    GROTTO_WATERFALL_CHAMBER.x,
    GROTTO_LAKE_WATER_LEVEL,
    GROTTO_WATERFALL_CHAMBER.z,
  );
  group.add(waterfallGroup);

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

  // Plunge Pool Foam Rings
  const plungeFoamGeo = trackGeo(new THREE.RingGeometry(1.4, 3.6, 32));
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
  // 6. NATURAL STONE ARCH BRIDGE & SECONDARY ROCK VIEWPOINT LEDGE (17.5, 148.2, Y=5.65m)
  // ============================================================================
  const bridgeAndViewpointGroup = new THREE.Group();
  bridgeAndViewpointGroup.name = 'HiddenGrotto_BridgeAndViewpoint';
  group.add(bridgeAndViewpointGroup);

  const numBridgeSteps = 22;
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
      Math.sin(t * Math.PI) * 1.45;
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
          0.55,
          1.12,
        ),
      ),
      i % 4 === 0 ? cavernMossStoneMat : bridgeArchStoneMat,
    );
    archBlock.position.set(bx, by - 0.26, bz);
    archBlock.rotation.y = -0.35;
    archBlock.castShadow = true;
    archBlock.receiveShadow = true;
    bridgeAndViewpointGroup.add(archBlock);

    // Subtle glowing mineral edge stones along the bridge parapet
    if (i % 3 === 1) {
      for (const side of [-1, 1] as const) {
        const curbCrystal = new THREE.Mesh(
          crystalPrismGeo,
          side === -1 ? mineralCyanMat : mineralTealMat,
        );
        curbCrystal.position.set(
          bx + side * (GROTTO_STONE_BRIDGE.halfWidth - 0.15),
          by + 0.02,
          bz,
        );
        curbCrystal.scale.setScalar(0.35);
        bridgeAndViewpointGroup.add(curbCrystal);
      }
    }
  }

  // Secondary Rock Viewpoint Ledge Platform at (17.5, 148.2, topY = 5.65m)
  const viewpointSlabGeo = trackGeo(
    new THREE.CylinderGeometry(
      GROTTO_SECONDARY_VIEWPOINT.radiusX,
      GROTTO_SECONDARY_VIEWPOINT.radiusX + 1.4,
      2.8,
      12,
    ),
  );
  const viewpointSlab = new THREE.Mesh(viewpointSlabGeo, bridgeArchStoneMat);
  viewpointSlab.position.set(
    GROTTO_SECONDARY_VIEWPOINT.x,
    GROTTO_SECONDARY_VIEWPOINT.topY - 1.4,
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

  // Carved Stone Bench on the Grotto Overlook Ledge (`E  Sit at the grotto overlook`)
  const benchSeatGeo = trackGeo(new THREE.BoxGeometry(2.1, 0.18, 0.66));
  const benchLegGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.44, 0.6));
  const overlookBenchGroup = new THREE.Group();
  overlookBenchGroup.name = 'HiddenGrotto_OverlookStoneBench';
  overlookBenchGroup.position.set(
    GROTTO_OVERLOOK_BENCH_POS.x,
    GROTTO_OVERLOOK_BENCH_POS.y,
    GROTTO_OVERLOOK_BENCH_POS.z,
  );
  overlookBenchGroup.rotation.y = GROTTO_OVERLOOK_BENCH_POS.rotY;

  const ovSeat = new THREE.Mesh(benchSeatGeo, cavernMossStoneMat);
  ovSeat.position.y = 0.46;
  ovSeat.castShadow = true;
  overlookBenchGroup.add(ovSeat);
  for (const side of [-0.78, 0.78]) {
    const leg = new THREE.Mesh(benchLegGeo, bridgeArchStoneMat);
    leg.position.set(side, 0.22, 0);
    overlookBenchGroup.add(leg);
  }
  bridgeAndViewpointGroup.add(overlookBenchGroup);
  colliders.push({
    x: GROTTO_OVERLOOK_BENCH_POS.x,
    y: GROTTO_OVERLOOK_BENCH_POS.y,
    z: GROTTO_OVERLOOK_BENCH_POS.z,
    radius: 0.95,
  });

  // ============================================================================
  // 7. SIX WALKABLE STEPPING STONES & CENTRAL DISCOVERY ISLAND (6.0, 137.5, Y=3.85m)
  // ============================================================================
  const islandGroup = new THREE.Group();
  islandGroup.name = 'HiddenGrotto_CentralDiscoveryIsland';
  group.add(islandGroup);

  const grottoStepStoneGeo = trackGeo(
    new THREE.CylinderGeometry(1.0, 1.15, 0.46, 9),
  );
  const grottoStepRimGeo = trackGeo(new THREE.RingGeometry(0.92, 1.04, 9));
  grottoStepRimGeo.rotateX(-Math.PI / 2);

  GROTTO_ISLAND_STEPPING_STONES.forEach((st, idx) => {
    const stGroup = new THREE.Group();
    stGroup.name = `GrottoSteppingStone_${idx + 1}`;
    stGroup.position.set(st.x, st.topY - 0.22, st.z);
    stGroup.rotation.y = st.rotY;

    const stone = new THREE.Mesh(grottoStepStoneGeo, bridgeArchStoneMat);
    stone.scale.set(st.scaleX, 1.0, st.scaleZ);
    stone.castShadow = true;
    stone.receiveShadow = true;

    const rim = new THREE.Mesh(
      grottoStepRimGeo,
      idx % 2 === 0 ? mineralCyanMat : mineralTealMat,
    );
    rim.position.y = 0.235;
    rim.scale.set(st.scaleX, st.scaleZ, 1.0);

    stGroup.add(stone, rim);
    islandGroup.add(stGroup);
  });

  // Central Discovery Island Terraced Mound (center (6.0, 137.5), radius 6.8m, topY = 3.85m)
  const islandBaseGeo = trackGeo(
    new THREE.CylinderGeometry(
      GROTTO_CENTRAL_ISLAND.flatRadius,
      GROTTO_CENTRAL_ISLAND.radius + 0.6,
      1.85,
      24,
    ),
  );
  const islandBaseMesh = new THREE.Mesh(islandBaseGeo, cavernMossStoneMat);
  islandBaseMesh.position.set(
    GROTTO_CENTRAL_ISLAND.x,
    GROTTO_CENTRAL_ISLAND.topY - 0.92,
    GROTTO_CENTRAL_ISLAND.z,
  );
  islandBaseMesh.receiveShadow = true;
  islandBaseMesh.castShadow = true;
  islandGroup.add(islandBaseMesh);

  // Warm Amber-Gold & Rose-Crystal Sanctuary Lantern Shrine on the Central Discovery Island
  const shrineGroup = new THREE.Group();
  shrineGroup.name = 'HiddenGrotto_CentralIslandSanctuaryShrine';
  shrineGroup.position.set(
    GROTTO_CENTRAL_ISLAND.x + 0.8,
    GROTTO_CENTRAL_ISLAND.topY,
    GROTTO_CENTRAL_ISLAND.z + 0.8,
  );
  islandGroup.add(shrineGroup);

  const plinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.95, 1.25, 0.36, 12)),
    bridgeArchStoneMat,
  );
  plinth.position.y = 0.18;
  const pillar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.32, 0.42, 1.35, 12)),
    sanctuaryBronzeMat,
  );
  pillar.position.y = 0.95;
  const lanternCore = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.46, 1)),
    sanctuaryAmberMat,
  );
  lanternCore.position.y = 1.95;
  const crownArch = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.72, 0.06, 10, 24)),
    sanctuaryBronzeMat,
  );
  crownArch.position.y = 1.95;
  shrineGroup.add(plinth, pillar, lanternCore, crownArch);

  colliders.push({
    x: GROTTO_CENTRAL_ISLAND.x + 0.8,
    y: GROTTO_CENTRAL_ISLAND.topY,
    z: GROTTO_CENTRAL_ISLAND.z + 0.8,
    radius: 1.15,
  });

  // Ring of Warm Amber-Gold Crystals & Luminous Flowers Around the Central Discovery Island
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const rad = GROTTO_CENTRAL_ISLAND.flatRadius + 0.65;
    const ix = GROTTO_CENTRAL_ISLAND.x + Math.cos(ang) * rad;
    const iz = GROTTO_CENTRAL_ISLAND.z + Math.sin(ang) * rad;
    // Leave stepping-stone arrival sector on the SE side clear
    if (Math.hypot(ix - 9.0, iz - 132.1) < 2.4) continue;

    const crystal = new THREE.Mesh(
      crystalPrismGeo,
      i % 2 === 0 ? sanctuaryAmberMat : mineralCyanMat,
    );
    crystal.position.set(ix, GROTTO_CENTRAL_ISLAND.topY - 0.15, iz);
    crystal.rotation.set(
      (rng() - 0.5) * 0.25,
      ang,
      (rng() - 0.5) * 0.25,
    );
    crystal.scale.setScalar(0.58 + (i % 3) * 0.22);
    islandGroup.add(crystal);
  }

  // Carved Stone Bench on the Central Discovery Island (`E  Sit on the island sanctuary bench`)
  const islandBenchGroup = new THREE.Group();
  islandBenchGroup.name = 'HiddenGrotto_IslandSanctuaryBench';
  islandBenchGroup.position.set(
    GROTTO_ISLAND_BENCH_POS.x,
    GROTTO_ISLAND_BENCH_POS.y,
    GROTTO_ISLAND_BENCH_POS.z,
  );
  islandBenchGroup.rotation.y = GROTTO_ISLAND_BENCH_POS.rotY;

  const isSeat = new THREE.Mesh(benchSeatGeo, sanctuaryBronzeMat);
  isSeat.position.y = 0.46;
  isSeat.castShadow = true;
  islandBenchGroup.add(isSeat);
  for (const side of [-0.78, 0.78]) {
    const leg = new THREE.Mesh(benchLegGeo, bridgeArchStoneMat);
    leg.position.set(side, 0.22, 0);
    islandBenchGroup.add(leg);
  }
  islandGroup.add(islandBenchGroup);
  colliders.push({
    x: GROTTO_ISLAND_BENCH_POS.x,
    y: GROTTO_ISLAND_BENCH_POS.y,
    z: GROTTO_ISLAND_BENCH_POS.z,
    radius: 0.95,
  });

  // ============================================================================
  // 8. SUBTERRANEAN CAVERN LIGHTING RIG (Activated dynamically when near/inside Grotto)
  // ============================================================================
  const islandAmberLight = new THREE.PointLight(0xfbbf24, 2.2, 32.0, 1.5);
  islandAmberLight.position.set(
    GROTTO_CENTRAL_ISLAND.x,
    GROTTO_CENTRAL_ISLAND.topY + 3.2,
    GROTTO_CENTRAL_ISLAND.z,
  );
  islandAmberLight.userData.skipAtmosphereCull = true;
  group.add(islandAmberLight);

  const gardenCyanLight = new THREE.PointLight(0x22d3ee, 1.85, 28.0, 1.5);
  gardenCyanLight.position.set(
    GROTTO_BIOLUM_GARDEN.x,
    GROTTO_BIOLUM_GARDEN.baseY + 2.8,
    GROTTO_BIOLUM_GARDEN.z,
  );
  gardenCyanLight.userData.skipAtmosphereCull = true;
  group.add(gardenCyanLight);

  const waterfallTealLight = new THREE.PointLight(0x38bdf8, 1.95, 34.0, 1.45);
  waterfallTealLight.position.set(
    GROTTO_WATERFALL_CHAMBER.x + 2.0,
    GROTTO_LAKE_WATER_LEVEL + 4.5,
    GROTTO_WATERFALL_CHAMBER.z - 3.0,
  );
  waterfallTealLight.userData.skipAtmosphereCull = true;
  group.add(waterfallTealLight);

  const tunnelThresholdLight = new THREE.PointLight(0x2dd4bf, 1.4, 20.0, 1.6);
  tunnelThresholdLight.position.set(29.5, 6.8, 121.0);
  tunnelThresholdLight.userData.skipAtmosphereCull = true;
  group.add(tunnelThresholdLight);

  return {
    group,
    colliders,
    update(
      _delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
    ) {
      lakeUniforms.uTime.value = elapsedTime;
      waterfallUniforms.uTime.value = elapsedTime;

      lanternCore.rotation.y = elapsedTime * 0.75;
      lanternCore.position.y = 1.95 + Math.sin(elapsedTime * 2.0) * 0.08;

      const foamPulse = 0.92 + Math.sin(elapsedTime * 3.8) * 0.08;
      plungeFoamMesh.scale.set(foamPulse, 1.0, foamPulse);
      plungeFoamMat.opacity = 0.42 + Math.sin(elapsedTime * 4.5) * 0.12;

      // Smoothly scale cavern lights based on player proximity to the northern cave/grotto region (Z > 95)
      const grottoProx = THREE.MathUtils.smoothstep(playerPos.z, 92.0, 114.0);
      islandAmberLight.intensity =
        (2.15 + Math.sin(elapsedTime * 2.2) * 0.2) * grottoProx;
      gardenCyanLight.intensity =
        (1.85 + Math.cos(elapsedTime * 1.9) * 0.18) * grottoProx;
      waterfallTealLight.intensity = 1.95 * grottoProx;
      tunnelThresholdLight.intensity = 1.45 * grottoProx;

      islandAmberLight.visible = grottoProx > 0.02;
      gardenCyanLight.visible = grottoProx > 0.02;
      waterfallTealLight.visible = grottoProx > 0.02;
      tunnelThresholdLight.visible = grottoProx > 0.02;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
