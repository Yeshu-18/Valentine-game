import * as THREE from 'three';
import { CircleCollider } from '../VegetationSystem';
import {
  PRIVATE_ARRIVAL_GATE_POS,
  PRIVATE_PATH_ROUTES,
  PRIVATE_WORLD_ANCHOR_LIST,
  REFLECTIVE_POND_STEPPING_STONES,
  REFLECTIVE_POND_WATER_LEVEL,
  RESERVED_GROTTO_VOLUME,
  createPrivateSeededRng,
  evaluatePrivatePathNetwork,
  getMemoryGardenBlendWeight,
  getPrivateIslandMask,
  getPrivateTerrainHeight,
  getPrivateTerrainNormal,
  getReflectivePondShoreRadius,
  getReflectivePondSignedDistance,
  privateFbm2D,
  privateNoise2D,
} from './privateWorldMath';
import {
  PrivatePathLightingBundle,
  PrivatePathLightingTelemetry,
  createPrivatePathLightingSystem,
} from './PrivatePathLighting';

export interface PrivateWorldSceneBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  setDebugVisible: (visible: boolean) => void;
  isDebugVisible: () => boolean;
  setVegetationVisible: (visible: boolean) => void;
  isVegetationVisible: () => boolean;
  getPathLightingTelemetry: () => PrivatePathLightingTelemetry;
  resetPathLighting: () => void;
  update: (
    delta: number,
    elapsedTime: number,
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

const TERRAIN_MESH_SPAN_X = 480; // Covers [-240, +240] (450m island + seabed margin)
const TERRAIN_MESH_SPAN_Z = 390; // Covers [-195, +195] (350m island + seabed margin)
const OCEAN_INNER_RADIUS = 520;
const OCEAN_OUTER_RADIUS = 1650;

function createPrivateMicroGrainTexture(
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dfe5e1';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = privateNoise2D(x * 0.28, y * 0.28);
      const n2 = privateNoise2D(x * 0.78 + 19, y * 0.78 + 41);
      const grain = Math.floor(232 + (n1 * 12 + n2 * 8));
      data[idx] = grain;
      data[idx + 1] = grain;
      data[idx + 2] = grain;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(92, 76);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createPrivateCoastalDepthTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const span = OCEAN_INNER_RADIUS * 2.0;

  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1);
      const v = 1.0 - iy / (size - 1);
      const wx = (u - 0.5) * span;
      const wz = (v - 0.5) * span;

      const mask = getPrivateIslandMask(wx, wz);
      const h = getPrivateTerrainHeight(wx, wz);

      const shallow = THREE.MathUtils.clamp(1.0 - Math.abs(h) / 4.8, 0, 1);
      const shoreline =
        mask > -0.055 && mask < 0.035
          ? THREE.MathUtils.clamp(1.0 - Math.abs(mask) / 0.05, 0, 1)
          : 0;

      const radialDist = Math.hypot(wx, wz);
      const edgeFade =
        1.0 -
        THREE.MathUtils.smoothstep(
          radialDist,
          OCEAN_INNER_RADIUS * 0.78,
          OCEAN_INNER_RADIUS * 0.98,
        );

      const idx = (iy * size + ix) * 4;
      data[idx] = Math.round(shallow * edgeFade * 255);
      data[idx + 1] = Math.round(shoreline * edgeFade * 255);
      data[idx + 2] = Math.round(edgeFade * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createPrivateWorldScene(
  renderer: THREE.WebGLRenderer,
): PrivateWorldSceneBundle {
  const group = new THREE.Group();
  group.name = 'PrivateRomanticWorldRoot';
  group.visible = false; // Activated when activeWorldId === 'PRIVATE_WORLD' (EPILOGUE)

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

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const microGrainTex = trackTex(createPrivateMicroGrainTexture(maxAniso));
  const coastalDepthTex = trackTex(createPrivateCoastalDepthTexture());

  // ============================================================================
  // 1. LAYERED TERRAIN MESH (450m × 350m Island Footprint + Garden/Pond/Path Blending)
  // ============================================================================
  const terrainGeo = trackGeo(
    new THREE.PlaneGeometry(
      TERRAIN_MESH_SPAN_X,
      TERRAIN_MESH_SPAN_Z,
      260,
      220,
    ),
  );
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const vertexCount = posAttr.count;

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getPrivateTerrainHeight(vx, vz);
    posAttr.setY(i, vy);
  }

  terrainGeo.computeVertexNormals();

  const normAttr = terrainGeo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(vertexCount * 3);

  // Layered Terrain Palette (Soft Twilight Dusk — Rich Emerald-Teal Grass, Warm Soil, Luminous Slate Paths)
  const cSeabed = new THREE.Color('#132d48');
  const cWetSand = new THREE.Color('#756c62');
  const cDrySand = new THREE.Color('#b0a594');
  const cGrass = new THREE.Color('#2c5845');
  const cForestFloor = new THREE.Color('#224236');
  const cMoss = new THREE.Color('#2b6b63');
  const cExposedSoil = new THREE.Color('#544336');
  const cFallenLeaves = new THREE.Color('#6b4f37');
  const cExposedRock = new THREE.Color('#545d6e');
  const cDarkCliffRock = new THREE.Color('#323a48');
  const cPondBed = new THREE.Color('#14334a');
  const cPondMossBank = new THREE.Color('#2c6660');
  const cStonePathCenter = new THREE.Color('#8c929c');
  const cStonePathEdge = new THREE.Color('#666d78');
  const tempColor = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const ny = normAttr.getY(i);

    const patchNoise =
      privateFbm2D(vx * 0.032 + 4.3, vz * 0.032 - 2.8, 3) * 0.5 + 0.5;
    const mossNoise =
      privateFbm2D(vx * 0.055 - 6.1, vz * 0.055 + 5.4, 3) * 0.5 + 0.5;
    const microSoilNoise =
      privateNoise2D(vx * 0.14 + 2.2, vz * 0.14 - 3.7) * 0.5 + 0.5;
    const pathEval = evaluatePrivatePathNetwork(vx, vz);

    if (vy < -0.15) {
      const t = THREE.MathUtils.clamp((vy + 4.8) / 4.65, 0, 1);
      tempColor.lerpColors(cSeabed, cWetSand, t);
    } else if (vy < 0.65) {
      const t = THREE.MathUtils.clamp((vy + 0.15) / 0.8, 0, 1);
      tempColor.lerpColors(cWetSand, cDrySand, t);
    } else if (vy < 2.35) {
      const t = THREE.MathUtils.clamp((vy - 0.65) / 1.7, 0, 1);
      const botanicalBase = tempColor
        .copy(cGrass)
        .lerp(cForestFloor, patchNoise * 0.45);
      tempColor.lerpColors(cDrySand, botanicalBase, t * t);
    } else {
      tempColor.lerpColors(cForestFloor, cGrass, patchNoise * 0.78);

      // Memory Garden Organic Ground Variation (Grass, Forest Floor, Moss, Exposed Soil, Fallen Leaves)
      const gardenWeight = getMemoryGardenBlendWeight(vx, vz);
      if (gardenWeight > 0.01) {
        if (microSoilNoise > 0.68) {
          tempColor.lerp(
            cFallenLeaves,
            gardenWeight * (microSoilNoise - 0.68) * 1.45,
          );
        } else if (microSoilNoise < 0.34) {
          tempColor.lerp(
            cExposedSoil,
            gardenWeight * (0.34 - microSoilNoise) * 1.35,
          );
        }
        tempColor.lerp(cMoss, gardenWeight * (0.28 + 0.52 * mossNoise));
      }

      // Reflective Pond Organic Basin & Mossy Bank Blending
      const pondSignedDist = getReflectivePondSignedDistance(vx, vz);
      if (pondSignedDist < 4.5) {
        if (pondSignedDist < 0.0) {
          const depthT = THREE.MathUtils.clamp(-pondSignedDist / 3.5, 0, 1);
          tempColor.lerpColors(cPondMossBank, cPondBed, depthT);
        } else {
          const bankT = 1.0 - THREE.MathUtils.smoothstep(pondSignedDist, 0.0, 4.5);
          tempColor.lerp(cPondMossBank, bankT * (0.45 + 0.45 * mossNoise));
        }
      }

      // Hidden Cave approach moss enrichment
      const distCave = Math.hypot(vx - 35, vz - 110);
      const caveMoss = 1.0 - THREE.MathUtils.smoothstep(distCave, 8, 32);
      if (caveMoss > 0.01) {
        tempColor.lerp(cMoss, caveMoss * (0.32 + 0.48 * mossNoise));
      }

      // Higher elevation rocky exposure on Eastern Stargazing Headland (+18m) & Northern Ridge (+25m)
      if (vy > 11.5) {
        const highT = THREE.MathUtils.clamp((vy - 11.5) / 12.0, 0, 1);
        const highlandRock = vz > 75 ? cDarkCliffRock : cExposedRock;
        tempColor.lerp(highlandRock, highT * 0.68);
      }
    }

    // Slope-based Exposed Rock & Dark Cliff Rock
    const slopeFactor = THREE.MathUtils.clamp((0.85 - ny) / 0.28, 0, 1);
    if (slopeFactor > 0.01 && vy > 0.25) {
      const cliffTarget =
        vz > 65 || vy > 15.0
          ? cDarkCliffRock
          : tempColor.clone().lerpColors(cExposedRock, cDarkCliffRock, 0.45);
      tempColor.lerp(cliffTarget, slopeFactor * 0.94);
    }

    // Natural Stone & Packed-Earth Path Network Blending
    if (pathEval.weight > 0.01 && vy > 0.8) {
      const pathColor = new THREE.Color().lerpColors(
        cStonePathEdge,
        cStonePathCenter,
        pathEval.weight,
      );
      tempColor.lerp(pathColor, pathEval.weight * 0.86);
    }

    // Highland Ridge Saddle Trail Blending ((26, 98) -> (0, 143))
    if (vz >= 95.0 && vz <= 145.5 && vx >= -10.0 && vx <= 34.0) {
      const saddleT = THREE.MathUtils.clamp((vz - 98.0) / 45.0, 0, 1);
      const saddleCenterX =
        26.0 - 26.0 * saddleT + Math.sin(saddleT * Math.PI * 2.0) * 2.2;
      const distSaddle = Math.abs(vx - saddleCenterX);
      const saddleWeight =
        1.0 - THREE.MathUtils.smoothstep(distSaddle, 1.4, 3.8);
      if (saddleWeight > 0.01) {
        const highlandPathCol = new THREE.Color().lerpColors(
          cExposedRock,
          cStonePathCenter,
          0.65,
        );
        tempColor.lerp(highlandPathCol, saddleWeight * 0.72);
      }
    }

    // Hidden Cave Descending Tunnel Floor Darkening (Z: 109.5 -> 124.0)
    if (vz >= 109.5 && vz <= 124.5 && vx >= 28.0 && vx <= 40.0) {
      const tunnelT = THREE.MathUtils.clamp((vz - 109.8) / 12.7, 0, 1);
      const tunnelCenterX =
        35.0 - tunnelT * tunnelT * (3.0 - 2.0 * tunnelT) * 2.4;
      const distTunnel = Math.abs(vx - tunnelCenterX);
      const tunnelMask =
        1.0 - THREE.MathUtils.smoothstep(distTunnel, 2.2, 4.2);
      if (tunnelMask > 0.01) {
        tempColor.lerp(
          new THREE.Color('#090d14'),
          tunnelMask * THREE.MathUtils.clamp(0.45 + tunnelT * 0.55, 0, 1),
        );
      }
    }

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: microGrainTex,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'PrivateIslandTerrainMesh';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  // ============================================================================
  // 2. SURROUNDING MOONLIT OCEAN (Circular Disc + Horizon Ring = Zero Rectangular Edges)
  // ============================================================================
  const oceanGeo = trackGeo(
    new THREE.CircleGeometry(OCEAN_INNER_RADIUS, 128),
  );
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#091d36'),
      roughness: 0.2,
      metalness: 0.28,
      transparent: true,
      opacity: 0.92,
    }),
  );

  const oceanUniforms = {
    uTime: { value: 0 },
    uCoastalMap: { value: coastalDepthTex },
    uDeepColor: { value: new THREE.Color('#061224') },
    uMidColor: { value: new THREE.Color('#0b213d') },
    uShallowColor: { value: new THREE.Color('#174263') },
    uFoamColor: { value: new THREE.Color('#8cb8de') },
    uSpan: { value: OCEAN_INNER_RADIUS * 2.0 },
  };

  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oceanUniforms.uTime;
    shader.uniforms.uCoastalMap = oceanUniforms.uCoastalMap;
    shader.uniforms.uDeepColor = oceanUniforms.uDeepColor;
    shader.uniforms.uMidColor = oceanUniforms.uMidColor;
    shader.uniforms.uShallowColor = oceanUniforms.uShallowColor;
    shader.uniforms.uFoamColor = oceanUniforms.uFoamColor;
    shader.uniforms.uSpan = oceanUniforms.uSpan;

    shader.vertexShader =
      `
      uniform float uTime;
      varying vec3 vLocalPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float w1 = sin(transformed.x * 0.11 + uTime * 1.25) * cos(transformed.z * 0.09 + uTime * 1.05) * 0.065;
        float w2 = sin((transformed.x - transformed.z) * 0.21 - uTime * 1.65) * 0.03;
        transformed.y += w1 + w2;
        vLocalPos = transformed;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform sampler2D uCoastalMap;
      uniform vec3 uDeepColor;
      uniform vec3 uMidColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform float uSpan;
      varying vec3 vLocalPos;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        vec2 coastUv = vec2(vLocalPos.x / uSpan + 0.5, 0.5 - vLocalPos.z / uSpan);
        vec4 coastSample = texture2D(uCoastalMap, clamp(coastUv, 0.0, 1.0));
        float shallowMask = coastSample.r;
        float shoreMask = coastSample.g;
        float outerBlend = coastSample.b;

        vec3 baseSea = mix(uDeepColor, uMidColor, outerBlend * 0.65);
        vec3 waterCol = mix(baseSea, uShallowColor, shallowMask * 0.85);

        float lap = sin(shallowMask * 18.0 - uTime * 2.1) * 0.5 + 0.5;
        float shoreLine = smoothstep(0.38, 0.88, shoreMask * (0.65 + 0.35 * lap));

        float moonShimmer = sin(vLocalPos.x * 0.65 + uTime * 1.4) * cos(vLocalPos.z * 0.65 - uTime * 1.2);
        waterCol += vec3(0.035, 0.055, 0.085) * max(0.0, moonShimmer) * shallowMask;

        diffuseColor.rgb = mix(waterCol, uFoamColor, shoreLine * 0.48);
        `,
      );
  };

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.name = 'PrivateWorldOceanSurface';
  oceanMesh.position.y = 0.0;
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  const outerSeaGeo = trackGeo(
    new THREE.RingGeometry(OCEAN_INNER_RADIUS - 12, OCEAN_OUTER_RADIUS, 96),
  );
  outerSeaGeo.rotateX(-Math.PI / 2);
  const outerSeaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#061224'),
      roughness: 0.28,
      metalness: 0.2,
    }),
  );
  const outerSeaMesh = new THREE.Mesh(outerSeaGeo, outerSeaMat);
  outerSeaMesh.name = 'PrivateWorldOuterOceanSkirt';
  outerSeaMesh.position.y = -0.06;
  group.add(outerSeaMesh);

  // ============================================================================
  // 3. SEEDED COASTAL ROCK FORMATIONS & PATH BORDER STONES (InstancedMesh)
  // ============================================================================
  const rng = createPrivateSeededRng();
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(1.0, 1));
  const rockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#272e3a'),
      roughness: 0.86,
      metalness: 0.06,
    }),
  );

  const coastalRocks: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rotY: number;
    rotZ: number;
  }> = [];

  for (let i = 0; i < 110; i++) {
    const theta = (i / 110) * Math.PI * 2.0 + (rng() - 0.5) * 0.04;
    if (Math.sin(theta) < -0.82 && Math.abs(Math.cos(theta)) < 0.22) {
      continue;
    }

    const dirX = Math.cos(theta);
    const dirZ = Math.sin(theta);
    let lo = 60.0;
    let hi = 230.0;
    for (let iter = 0; iter < 12; iter++) {
      const mid = (lo + hi) * 0.5;
      if (getPrivateIslandMask(dirX * mid, dirZ * mid) >= 0.01) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const r = (lo + hi) * 0.5 + (rng() - 0.45) * 9.0;
    const rx = dirX * r;
    const rz = dirZ * r;
    const ry = getPrivateTerrainHeight(rx, rz);

    const sx = 1.6 + rng() * 3.4;
    const sy = 1.1 + rng() * 2.6;
    const sz = 1.5 + rng() * 3.1;
    coastalRocks.push({
      x: rx,
      y: ry + sy * 0.25,
      z: rz,
      sx,
      sy,
      sz,
      rotY: rng() * Math.PI * 2,
      rotZ: (rng() - 0.5) * 0.35,
    });
    if (ry > 0.1) {
      colliders.push({ x: rx, z: rz, radius: Math.max(sx, sz) * 0.68 });
    }
  }

  const coastalRockInst = new THREE.InstancedMesh(
    rockGeo,
    rockMat,
    coastalRocks.length,
  );
  coastalRockInst.name = 'PrivateCoastalRockFormations';
  coastalRockInst.castShadow = true;
  coastalRockInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  coastalRocks.forEach((rk, idx) => {
    dummy.position.set(rk.x, rk.y, rk.z);
    dummy.rotation.set(0, rk.rotY, rk.rotZ);
    dummy.scale.set(rk.sx, rk.sy, rk.sz);
    dummy.updateMatrix();
    coastalRockInst.setMatrixAt(idx, dummy.matrix);
  });
  coastalRockInst.instanceMatrix.needsUpdate = true;
  coastalRockInst.computeBoundingSphere();
  group.add(coastalRockInst);

  // ============================================================================
  // 4. REACTIVE MAGICAL SIDEWAYS ILLUMINATION (Lights up path sides while walking)
  // ============================================================================
  const pathLighting: PrivatePathLightingBundle =
    createPrivatePathLightingSystem();
  group.add(pathLighting.group);

  // ============================================================================
  // 5. SHARED ARCHITECTURAL & BOTANICAL MATERIALS
  // ============================================================================
  const timberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a3728'),
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  const silverBarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6e737b'),
      roughness: 0.76,
      metalness: 0.06,
    }),
  );
  const darkBarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#342820'),
      roughness: 0.88,
      metalness: 0.03,
    }),
  );
  const stoneBlockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5b616b'),
      roughness: 0.82,
      metalness: 0.06,
    }),
  );
  const mossyStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#324d49'),
      roughness: 0.86,
      metalness: 0.05,
    }),
  );
  const darkBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1d222b'),
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  const bronzeGateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2818'),
      roughness: 0.36,
      metalness: 0.78,
    }),
  );
  const goldAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbbf24'),
      emissive: new THREE.Color('#78350f'),
      emissiveIntensity: 0.45,
      roughness: 0.24,
      metalness: 0.84,
    }),
  );
  const biolumTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5eead4'),
      emissive: new THREE.Color('#14b8a6'),
      emissiveIntensity: 1.35,
      roughness: 0.28,
    }),
  );
  const biolumSilverBlueMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 1.25,
      roughness: 0.25,
    }),
  );

  // ============================================================================
  // 6. ARRIVAL SHORE GREYBOX (0, -145, Elev 0 to +3m) — Preserved
  // ============================================================================
  const arrivalShoreGroup = new THREE.Group();
  arrivalShoreGroup.name = 'ArrivalShore_LocationGreybox';
  group.add(arrivalShoreGroup);

  const pierGroup = new THREE.Group();
  pierGroup.name = 'ArrivalShore_WoodenPierPlaceholder';
  arrivalShoreGroup.add(pierGroup);

  const pierDeckGeo = trackGeo(new THREE.BoxGeometry(4.2, 0.24, 18.0));
  const pierDeck = new THREE.Mesh(pierDeckGeo, timberMat);
  pierDeck.position.set(0, 1.55, -152.8);
  pierDeck.receiveShadow = true;
  pierDeck.castShadow = true;
  pierGroup.add(pierDeck);

  const pilingGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.2, 3.6, 10));
  for (let pz = -145.0; pz >= -160.5; pz -= 3.8) {
    for (const side of [-1.75, 1.75]) {
      const piling = new THREE.Mesh(pilingGeo, timberMat);
      piling.position.set(side, 0.45, pz);
      piling.castShadow = true;
      pierGroup.add(piling);
    }
  }

  const stoneStartGeo = trackGeo(new THREE.CylinderGeometry(3.8, 4.2, 0.18, 24));
  const stoneStartMesh = new THREE.Mesh(stoneStartGeo, stoneBlockMat);
  stoneStartMesh.name = 'ArrivalShore_StonePathStart';
  stoneStartMesh.position.set(0, getPrivateTerrainHeight(0, -141) + 0.04, -141);
  stoneStartMesh.receiveShadow = true;
  arrivalShoreGroup.add(stoneStartMesh);

  const specialGateArrivalGroup = new THREE.Group();
  specialGateArrivalGroup.name = 'ArrivalShore_SpecialGateAnchor';
  specialGateArrivalGroup.position.set(
    PRIVATE_ARRIVAL_GATE_POS.x,
    1.65,
    PRIVATE_ARRIVAL_GATE_POS.z,
  );
  arrivalShoreGroup.add(specialGateArrivalGroup);

  const gatePillarGeo = trackGeo(
    new THREE.CylinderGeometry(0.28, 0.36, 4.8, 14),
  );
  const gateHornGeo = trackGeo(
    new THREE.TorusGeometry(2.35, 0.15, 12, 28, Math.PI * 0.52),
  );
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(gatePillarGeo, bronzeGateMat);
    pillar.position.set(side * 2.35, 2.4, 0);
    pillar.castShadow = true;
    specialGateArrivalGroup.add(pillar);

    const horn = new THREE.Mesh(gateHornGeo, goldAccentMat);
    horn.position.set(side * 0.1, 4.55, 0);
    horn.rotation.z = side === -1 ? -0.15 : Math.PI * 0.48;
    specialGateArrivalGroup.add(horn);

    colliders.push({
      x: PRIVATE_ARRIVAL_GATE_POS.x + side * 2.35,
      z: PRIVATE_ARRIVAL_GATE_POS.z,
      radius: 0.55,
    });
  }

  const gateHeartCrestGeo = trackGeo(new THREE.OctahedronGeometry(0.4, 1));
  const gateHeartCrestMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f43f5e'),
      emissive: new THREE.Color('#e11d48'),
      emissiveIntensity: 1.65,
      roughness: 0.18,
    }),
  );
  const gateHeartCrest = new THREE.Mesh(gateHeartCrestGeo, gateHeartCrestMat);
  gateHeartCrest.position.set(0, 5.7, 0);
  specialGateArrivalGroup.add(gateHeartCrest);

  // ============================================================================
  // 7. MEMORY GARDEN (-35, -20, Elev +7.5m) — Phase 4.2 Secluded Moonlit Garden
  // ============================================================================
  const memoryGardenGroup = new THREE.Group();
  memoryGardenGroup.name = 'MemoryGarden_LocationGreybox';
  group.add(memoryGardenGroup);

  // Distinct Foliage Materials for the 7 Mature Trees (Tuned for Soft Twilight Dusk readability)
  const canopyDeepTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#25544b'),
      roughness: 0.8,
      metalness: 0.04,
    }),
  );
  const canopySilverSageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#36695e'),
      roughness: 0.74,
      metalness: 0.06,
    }),
  );
  const canopyMidnightPineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1f4640'),
      roughness: 0.82,
      metalness: 0.03,
    }),
  );
  const canopyMoonlitWillowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2f6360'),
      roughness: 0.76,
      metalness: 0.05,
    }),
  );

  const sharedLobeGeo = trackGeo(new THREE.IcosahedronGeometry(1.0, 1));
  const sharedRootGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.34, 1.9, 7));
  const sharedLimbGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.32, 3.2, 8));
  const sharedTrunkLowerGeo = trackGeo(
    new THREE.CylinderGeometry(0.42, 0.68, 3.2, 10),
  );
  const sharedTrunkUpperGeo = trackGeo(
    new THREE.CylinderGeometry(0.28, 0.44, 3.0, 9),
  );

  interface DistinctTreeSpec {
    name: string;
    x: number;
    z: number;
    archetype:
      | 'specimen-twin'
      | 'weeping-willow'
      | 'broad-oak'
      | 'coastal-cypress'
      | 'silver-birch'
      | 'arching-banyan'
      | 'terraced-cedar';
    trunkMat: THREE.Material;
    canopyMat: THREE.Material;
    heightScale: number;
    crownSpread: number;
    leanX: number;
    leanZ: number;
    rotY: number;
    colliderRadius: number;
  }

  // Seven Visually Distinct Mature Trees positioned around Memory Garden & Garden Loop
  const sevenDistinctTrees: readonly DistinctTreeSpec[] = [
    {
      name: 'MemoryGarden_Tree1_AncientSpecimenTwin',
      x: -41.2,
      z: -18.2,
      archetype: 'specimen-twin',
      trunkMat: darkBarkMat,
      canopyMat: canopySilverSageMat,
      heightScale: 1.38,
      crownSpread: 1.48,
      leanX: 0.08,
      leanZ: -0.04,
      rotY: 0.4,
      colliderRadius: 1.25,
    },
    {
      name: 'MemoryGarden_Tree2_WeepingWillowAsh',
      x: -23.5,
      z: -31.5,
      archetype: 'weeping-willow',
      trunkMat: timberMat,
      canopyMat: canopyMoonlitWillowMat,
      heightScale: 1.18,
      crownSpread: 1.35,
      leanX: -0.06,
      leanZ: 0.09,
      rotY: 1.2,
      colliderRadius: 0.95,
    },
    {
      name: 'MemoryGarden_Tree3_BroadCrownMoonOak',
      x: -51.5,
      z: -28.0,
      archetype: 'broad-oak',
      trunkMat: darkBarkMat,
      canopyMat: canopyDeepTealMat,
      heightScale: 1.28,
      crownSpread: 1.52,
      leanX: 0.04,
      leanZ: 0.05,
      rotY: 2.1,
      colliderRadius: 1.15,
    },
    {
      name: 'MemoryGarden_Tree4_TwistedCoastalCypress',
      x: -48.0,
      z: -5.5,
      archetype: 'coastal-cypress',
      trunkMat: timberMat,
      canopyMat: canopyMidnightPineMat,
      heightScale: 1.42,
      crownSpread: 1.05,
      leanX: 0.14,
      leanZ: -0.08,
      rotY: 0.85,
      colliderRadius: 0.88,
    },
    {
      name: 'MemoryGarden_Tree5_TallSilverBirch',
      x: -25.8,
      z: -6.4,
      archetype: 'silver-birch',
      trunkMat: silverBarkMat,
      canopyMat: canopySilverSageMat,
      heightScale: 1.46,
      crownSpread: 1.08,
      leanX: -0.05,
      leanZ: -0.06,
      rotY: 1.75,
      colliderRadius: 0.85,
    },
    {
      name: 'MemoryGarden_Tree6_ArchingBanyanKnoll',
      x: -19.2,
      z: 20.2,
      archetype: 'arching-banyan',
      trunkMat: darkBarkMat,
      canopyMat: canopyDeepTealMat,
      heightScale: 1.34,
      crownSpread: 1.58,
      leanX: -0.04,
      leanZ: 0.04,
      rotY: 2.65,
      colliderRadius: 1.22,
    },
    {
      name: 'MemoryGarden_Tree7_MossyTerracedCedar',
      x: -37.5,
      z: 14.8,
      archetype: 'terraced-cedar',
      trunkMat: timberMat,
      canopyMat: canopyMidnightPineMat,
      heightScale: 1.5,
      crownSpread: 1.18,
      leanX: 0.03,
      leanZ: -0.03,
      rotY: 0.25,
      colliderRadius: 0.96,
    },
  ];

  const matureTreesContainer = new THREE.Group();
  matureTreesContainer.name = 'MemoryGarden_SevenDistinctMatureTrees';
  memoryGardenGroup.add(matureTreesContainer);

  sevenDistinctTrees.forEach((spec, idx) => {
    const ty = getPrivateTerrainHeight(spec.x, spec.z);
    const treeGroup = new THREE.Group();
    treeGroup.name = spec.name;
    treeGroup.position.set(spec.x, ty, spec.z);
    treeGroup.rotation.y = spec.rotY;
    matureTreesContainer.add(treeGroup);

    // 1. Emerging Ground Root Buttresses (4 to 6 roots flaring naturally into the soil)
    const rootCount = spec.archetype === 'arching-banyan' || spec.archetype === 'specimen-twin' ? 6 : 4;
    for (let r = 0; r < rootCount; r++) {
      const rAng = (r / rootCount) * Math.PI * 2 + idx * 0.4;
      const rootMesh = new THREE.Mesh(sharedRootGeo, spec.trunkMat);
      const flareDist = 0.52 * spec.heightScale;
      rootMesh.position.set(
        Math.cos(rAng) * flareDist,
        0.42,
        Math.sin(rAng) * flareDist,
      );
      rootMesh.rotation.y = -rAng;
      rootMesh.rotation.z = 0.58 + (r % 2) * 0.12;
      rootMesh.scale.set(
        1.0 + (r % 2) * 0.25,
        0.95 * spec.heightScale,
        1.15,
      );
      rootMesh.castShadow = true;
      rootMesh.receiveShadow = true;
      treeGroup.add(rootMesh);
    }

    // 2. Articulated Lower & Upper Trunk with Natural Lean
    const lowerTrunk = new THREE.Mesh(sharedTrunkLowerGeo, spec.trunkMat);
    lowerTrunk.position.set(0, 1.45 * spec.heightScale, 0);
    lowerTrunk.rotation.set(spec.leanZ, 0, -spec.leanX);
    lowerTrunk.scale.set(
      spec.heightScale * 0.95,
      spec.heightScale,
      spec.heightScale * 0.95,
    );
    lowerTrunk.castShadow = true;
    lowerTrunk.receiveShadow = true;
    treeGroup.add(lowerTrunk);

    const upperBaseX = spec.leanX * 2.4 * spec.heightScale;
    const upperBaseY = 2.85 * spec.heightScale;
    const upperBaseZ = spec.leanZ * 2.4 * spec.heightScale;

    if (spec.archetype === 'specimen-twin') {
      // Twin-bough split trunk with wide romantic canopy
      for (const side of [-1, 1]) {
        const twinBranch = new THREE.Mesh(sharedTrunkUpperGeo, spec.trunkMat);
        twinBranch.position.set(
          upperBaseX + side * 0.95,
          upperBaseY + 1.1,
          upperBaseZ + side * 0.25,
        );
        twinBranch.rotation.set(side * 0.12, 0, -side * 0.44);
        twinBranch.scale.set(0.95, 1.25, 0.95);
        twinBranch.castShadow = true;
        treeGroup.add(twinBranch);

        const crown = new THREE.Mesh(sharedLobeGeo, spec.canopyMat);
        crown.position.set(
          upperBaseX + side * 2.15,
          upperBaseY + 2.85,
          upperBaseZ + side * 0.4,
        );
        crown.scale.set(
          3.4 * spec.crownSpread,
          1.65 * spec.heightScale,
          3.1 * spec.crownSpread,
        );
        crown.castShadow = true;
        crown.receiveShadow = true;
        treeGroup.add(crown);
      }
      const topCanopy = new THREE.Mesh(sharedLobeGeo, canopyDeepTealMat);
      topCanopy.position.set(upperBaseX, upperBaseY + 3.9, upperBaseZ);
      topCanopy.scale.set(
        3.8 * spec.crownSpread,
        1.75 * spec.heightScale,
        3.6 * spec.crownSpread,
      );
      topCanopy.castShadow = true;
      treeGroup.add(topCanopy);
    } else if (spec.archetype === 'weeping-willow') {
      // Arching boughs + cascading willow-ash foliage curtains
      const upperTrunk = new THREE.Mesh(sharedTrunkUpperGeo, spec.trunkMat);
      upperTrunk.position.set(upperBaseX, upperBaseY + 1.0, upperBaseZ);
      upperTrunk.castShadow = true;
      treeGroup.add(upperTrunk);

      for (let b = 0; b < 5; b++) {
        const bAng = (b / 5) * Math.PI * 2;
        const limb = new THREE.Mesh(sharedLimbGeo, spec.trunkMat);
        limb.position.set(
          upperBaseX + Math.cos(bAng) * 1.25,
          upperBaseY + 1.65,
          upperBaseZ + Math.sin(bAng) * 1.25,
        );
        limb.rotation.z = -0.68;
        limb.rotation.y = -bAng;
        treeGroup.add(limb);

        const drapeLobe = new THREE.Mesh(sharedLobeGeo, spec.canopyMat);
        drapeLobe.position.set(
          upperBaseX + Math.cos(bAng) * 2.45,
          upperBaseY + 1.55,
          upperBaseZ + Math.sin(bAng) * 2.45,
        );
        drapeLobe.scale.set(1.65, 2.35, 1.65);
        drapeLobe.castShadow = true;
        treeGroup.add(drapeLobe);
      }
      const dome = new THREE.Mesh(sharedLobeGeo, canopySilverSageMat);
      dome.position.set(upperBaseX, upperBaseY + 3.1, upperBaseZ);
      dome.scale.set(3.4, 1.5, 3.4);
      dome.castShadow = true;
      treeGroup.add(dome);
    } else if (spec.archetype === 'silver-birch') {
      // Triple-stem slender silver birch cluster with airy high foliage tiers
      for (let s = 0; s < 3; s++) {
        const sAng = (s / 3) * Math.PI * 2 + 0.3;
        const stem = new THREE.Mesh(sharedTrunkUpperGeo, spec.trunkMat);
        stem.position.set(
          Math.cos(sAng) * 0.45,
          2.9 * spec.heightScale,
          Math.sin(sAng) * 0.45,
        );
        stem.rotation.z = -Math.cos(sAng) * 0.14;
        stem.rotation.x = Math.sin(sAng) * 0.14;
        stem.scale.set(0.62, 1.65, 0.62);
        stem.castShadow = true;
        treeGroup.add(stem);

        const airyCrown = new THREE.Mesh(sharedLobeGeo, spec.canopyMat);
        airyCrown.position.set(
          Math.cos(sAng) * 1.35,
          4.8 * spec.heightScale + s * 0.55,
          Math.sin(sAng) * 1.35,
        );
        airyCrown.scale.set(2.1, 1.25, 2.1);
        airyCrown.castShadow = true;
        treeGroup.add(airyCrown);
      }
    } else if (spec.archetype === 'terraced-cedar' || spec.archetype === 'coastal-cypress') {
      // Conical / wind-sculpted terraced foliage pads
      const upperTrunk = new THREE.Mesh(sharedTrunkUpperGeo, spec.trunkMat);
      upperTrunk.position.set(upperBaseX, upperBaseY + 1.35, upperBaseZ);
      upperTrunk.scale.set(0.85, 1.45, 0.85);
      upperTrunk.castShadow = true;
      treeGroup.add(upperTrunk);

      const tierCount = 4;
      for (let t = 0; t < tierCount; t++) {
        const tierFrac = t / (tierCount - 1);
        const pad = new THREE.Mesh(sharedLobeGeo, spec.canopyMat);
        const driftX =
          spec.archetype === 'coastal-cypress' ? (t - 1) * 0.55 : 0;
        pad.position.set(
          upperBaseX + driftX,
          upperBaseY + 0.9 + t * 1.35,
          upperBaseZ,
        );
        const rad = THREE.MathUtils.lerp(3.2, 1.55, tierFrac) * spec.crownSpread;
        pad.scale.set(rad * 1.15, 0.82, rad);
        pad.castShadow = true;
        treeGroup.add(pad);
      }
    } else {
      // Broad-Oak & Arching Banyan: spreading secondary limbs + layered canopy domes
      const upperTrunk = new THREE.Mesh(sharedTrunkUpperGeo, spec.trunkMat);
      upperTrunk.position.set(upperBaseX, upperBaseY + 0.95, upperBaseZ);
      upperTrunk.castShadow = true;
      treeGroup.add(upperTrunk);

      for (let b = 0; b < 4; b++) {
        const bAng = (b / 4) * Math.PI * 2 + 0.4;
        const limb = new THREE.Mesh(sharedLimbGeo, spec.trunkMat);
        limb.position.set(
          upperBaseX + Math.cos(bAng) * 1.35,
          upperBaseY + 1.5,
          upperBaseZ + Math.sin(bAng) * 1.35,
        );
        limb.rotation.z = -0.58;
        limb.rotation.y = -bAng;
        limb.castShadow = true;
        treeGroup.add(limb);

        const lobe = new THREE.Mesh(
          sharedLobeGeo,
          b % 2 === 0 ? spec.canopyMat : canopySilverSageMat,
        );
        lobe.position.set(
          upperBaseX + Math.cos(bAng) * 2.55,
          upperBaseY + 2.45 + (b % 2) * 0.35,
          upperBaseZ + Math.sin(bAng) * 2.55,
        );
        lobe.scale.set(
          2.65 * spec.crownSpread,
          1.35 * spec.heightScale,
          2.45 * spec.crownSpread,
        );
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        treeGroup.add(lobe);
      }

      const centerCrown = new THREE.Mesh(sharedLobeGeo, spec.canopyMat);
      centerCrown.position.set(upperBaseX, upperBaseY + 3.35, upperBaseZ);
      centerCrown.scale.set(
        3.5 * spec.crownSpread,
        1.6 * spec.heightScale,
        3.3 * spec.crownSpread,
      );
      centerCrown.castShadow = true;
      treeGroup.add(centerCrown);
    }

    colliders.push({ x: spec.x, z: spec.z, radius: spec.colliderRadius });
  });

  // 7B. Central Focal Point Beside Primary Path: Ancient Specimen Tree Alcove & 3 Benches
  const focalAlcoveGroup = new THREE.Group();
  focalAlcoveGroup.name = 'MemoryGarden_FocalBenchAlcove';
  memoryGardenGroup.add(focalAlcoveGroup);

  const benchSeatGeo = trackGeo(new THREE.BoxGeometry(2.3, 0.16, 0.68));
  const benchLegGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.46, 0.62));
  const benchBackGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.42, 0.12));

  const gardenBenches: ReadonlyArray<{
    name: string;
    x: number;
    z: number;
    rotY: number;
    isTimber: boolean;
  }> = [
    {
      name: 'MemoryGarden_AlcoveStoneBench_West',
      x: -38.4,
      z: -21.8,
      rotY: 0.58, // Faces the Specimen Tree & Primary Path
      isTimber: false,
    },
    {
      name: 'MemoryGarden_GardenVistaBench_East',
      x: -30.8,
      z: -15.6,
      rotY: -0.78, // Faces the Reflective Pond & Eastern Branch
      isTimber: true,
    },
    {
      name: 'MemoryGarden_KnollBanyanBench_North',
      x: -22.2,
      z: 17.6,
      rotY: 2.35, // Beneath the Arching Banyan Tree on the Garden Loop
      isTimber: false,
    },
  ];

  gardenBenches.forEach((bSpec) => {
    const by = getPrivateTerrainHeight(bSpec.x, bSpec.z);
    const bGroup = new THREE.Group();
    bGroup.name = bSpec.name;
    bGroup.position.set(bSpec.x, by, bSpec.z);
    bGroup.rotation.y = bSpec.rotY;

    const seatMat = bSpec.isTimber ? timberMat : stoneBlockMat;
    const legMat = bSpec.isTimber ? stoneBlockMat : mossyStoneMat;

    const seat = new THREE.Mesh(benchSeatGeo, seatMat);
    seat.position.y = 0.48;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bGroup.add(seat);

    for (const side of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(benchLegGeo, legMat);
      leg.position.set(side, 0.23, 0);
      leg.castShadow = true;
      bGroup.add(leg);
    }

    if (bSpec.isTimber) {
      const back = new THREE.Mesh(benchBackGeo, timberMat);
      back.position.set(0, 0.78, -0.28);
      back.rotation.x = -0.12;
      back.castShadow = true;
      bGroup.add(back);
    }

    focalAlcoveGroup.add(bGroup);
    colliders.push({ x: bSpec.x, z: bSpec.z, radius: 1.05 });
  });

  // Natural Alcove Flagstone Apron & Bioluminescent Sanctuary Stones around (-39.5, -19.5)
  const alcoveStonesCoords: ReadonlyArray<[number, number, number, boolean]> = [
    [-39.2, -20.2, 0.95, false],
    [-38.0, -19.2, 0.82, false],
    [-40.1, -21.0, 0.76, true],
    [-42.4, -19.6, 0.88, true],
    [-39.6, -16.4, 0.74, true],
    [-33.2, -23.5, 0.68, true],
  ];
  const flatSlabGeo = trackGeo(new THREE.CylinderGeometry(0.85, 0.98, 0.14, 7));
  alcoveStonesCoords.forEach(([sx, sz, sc, isGlow]) => {
    const sy = getPrivateTerrainHeight(sx, sz);
    const slab = new THREE.Mesh(
      flatSlabGeo,
      isGlow ? biolumTealMat : mossyStoneMat,
    );
    slab.position.set(sx, sy + 0.04, sz);
    slab.scale.set(sc, isGlow ? 0.65 : 1.0, sc * 0.85);
    slab.rotation.y = sx * 0.7;
    slab.receiveShadow = true;
    focalAlcoveGroup.add(slab);
  });

  // ============================================================================
  // 8. REFLECTIVE POND (-5, 0, Elev +5m) — Organic Basin,Ripples & Stepping Stones
  // ============================================================================
  const reflectivePondGroup = new THREE.Group();
  reflectivePondGroup.name = 'ReflectivePond_LocationGreybox';
  group.add(reflectivePondGroup);

  // 8A. Organic Contoured Pond Water Mesh matching `getReflectivePondShoreRadius`
  const pondRadialSegs = 64;
  const pondRingSegs = 16;
  const pondWaterGeo = trackGeo(
    new THREE.RingGeometry(0.001, 1.0, pondRadialSegs, pondRingSegs),
  );
  pondWaterGeo.rotateX(-Math.PI / 2);

  const pondPosAttr = pondWaterGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pondPosAttr.count; i++) {
    const ux = pondPosAttr.getX(i);
    const uz = pondPosAttr.getZ(i);
    const rNorm = Math.hypot(ux, uz);
    const ang = Math.atan2(uz, ux);
    const shoreR = getReflectivePondShoreRadius(ang) + 0.35;
    const wx = -5.2 + Math.cos(ang) * rNorm * shoreR * 1.14;
    const wz = -0.3 + Math.sin(ang) * rNorm * shoreR * 0.94;
    pondPosAttr.setXYZ(i, wx, 0, wz);
  }
  pondWaterGeo.computeVertexNormals();

  const pondWaterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c273d'),
      roughness: 0.14,
      metalness: 0.48,
      transparent: true,
      opacity: 0.93,
    }),
  );

  const pondUniforms = {
    uTime: { value: 0 },
    uDeepPondColor: { value: new THREE.Color('#061424') },
    uShallowPondColor: { value: new THREE.Color('#133b54') },
    uMoonHighlightColor: { value: new THREE.Color('#b8d8f8') },
    uBioRimColor: { value: new THREE.Color('#2dd4bf') },
  };

  pondWaterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = pondUniforms.uTime;
    shader.uniforms.uDeepPondColor = pondUniforms.uDeepPondColor;
    shader.uniforms.uShallowPondColor = pondUniforms.uShallowPondColor;
    shader.uniforms.uMoonHighlightColor = pondUniforms.uMoonHighlightColor;
    shader.uniforms.uBioRimColor = pondUniforms.uBioRimColor;

    shader.vertexShader =
      `
      uniform float uTime;
      varying vec3 vPondWorldPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float r1 = sin(transformed.x * 1.35 + uTime * 1.45) * cos(transformed.z * 1.25 - uTime * 1.15) * 0.012;
        float r2 = sin((transformed.x + transformed.z) * 2.4 - uTime * 1.9) * 0.006;
        transformed.y += r1 + r2;
        vPondWorldPos = transformed;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform vec3 uDeepPondColor;
      uniform vec3 uShallowPondColor;
      uniform vec3 uMoonHighlightColor;
      uniform vec3 uBioRimColor;
      varying vec3 vPondWorldPos;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        vec2 rel = vec2((vPondWorldPos.x - -5.2) / 9.8, (vPondWorldPos.z - -0.3) / 8.2);
        float radial = clamp(length(rel), 0.0, 1.0);

        // Natural depth gradient: darker midnight blue in the deep center, muted teal-slate near the shore
        vec3 basePond = mix(uDeepPondColor, uShallowPondColor, smoothstep(0.18, 0.95, radial));

        // Subtle concentric & directional micro-ripples
        float rippleWave = sin(radial * 24.0 - uTime * 1.85 + sin(vPondWorldPos.x * 0.9)) * 0.5 + 0.5;
        float crossRipple = sin(vPondWorldPos.x * 2.1 + uTime * 1.3) * cos(vPondWorldPos.z * 2.3 - uTime * 1.1);

        // Soft moonlight reflection biased toward the moon-facing SW-to-NE glade axis
        float moonSideBias = smoothstep(-0.65, 0.85, -rel.x * 0.55 - rel.y * 0.65);
        float moonSpec = smoothstep(0.45, 0.92, crossRipple * 0.5 + 0.5) * moonSideBias * (1.0 - radial * 0.45);
        basePond += uMoonHighlightColor * moonSpec * 0.22;

        // Subtle shoreline interaction & restrained bioluminescent water rim
        float shoreEdge = smoothstep(0.76, 0.98, radial) * (0.65 + 0.35 * rippleWave);
        basePond = mix(basePond, uBioRimColor, shoreEdge * 0.18);

        diffuseColor.rgb = basePond;
        `,
      );
  };

  const pondWaterMesh = new THREE.Mesh(pondWaterGeo, pondWaterMat);
  pondWaterMesh.name = 'ReflectivePond_WaterSurface';
  pondWaterMesh.position.set(0, REFLECTIVE_POND_WATER_LEVEL, 0);
  pondWaterMesh.receiveShadow = true;
  reflectivePondGroup.add(pondWaterMesh);

  // 8B. Walkable Stepping Stones Crossing the Northern Section of the Pond
  const steppingStonesGroup = new THREE.Group();
  steppingStonesGroup.name = 'ReflectivePond_SteppingStones';
  reflectivePondGroup.add(steppingStonesGroup);

  const stepStoneTopGeo = trackGeo(
    new THREE.CylinderGeometry(0.92, 1.05, 0.36, 9),
  );
  const stepStoneRimGeo = trackGeo(new THREE.RingGeometry(0.86, 0.98, 9));
  stepStoneRimGeo.rotateX(-Math.PI / 2);

  REFLECTIVE_POND_STEPPING_STONES.forEach((st, idx) => {
    const stGroup = new THREE.Group();
    stGroup.name = `PondSteppingStone_${idx + 1}`;
    stGroup.position.set(st.x, st.topY - 0.16, st.z);
    stGroup.rotation.y = st.rotY;

    const stoneMesh = new THREE.Mesh(stepStoneTopGeo, stoneBlockMat);
    stoneMesh.scale.set(st.radiusX, 1.0, st.radiusZ);
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    stGroup.add(stoneMesh);

    const mossRim = new THREE.Mesh(stepStoneRimGeo, biolumTealMat);
    mossRim.position.y = 0.185;
    mossRim.scale.set(st.radiusX, st.radiusZ, 1.0);
    stGroup.add(mossRim);

    steppingStonesGroup.add(stGroup);
  });

  // 8C. Irregular Shoreline Boulders, Moss-Covered Stones & Bioluminescent Pond Flora
  const pondShoreGroup = new THREE.Group();
  pondShoreGroup.name = 'ReflectivePond_ShorelineDetails';
  reflectivePondGroup.add(pondShoreGroup);

  const shoreBoulderCount = 28;
  for (let i = 0; i < shoreBoulderCount; i++) {
    const ang = (i / shoreBoulderCount) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    // Leave the stepping-stone crossing approaches at West (ang ~ 2.75) and East (ang ~ 0.45) clear
    const shoreR = getReflectivePondShoreRadius(ang) + (rng() - 0.35) * 0.85;
    const px = -5.2 + Math.cos(ang) * shoreR * 1.14;
    const pz = -0.3 + Math.sin(ang) * shoreR * 0.94;

    // Do not block the stepping-stone entry/exit banks
    if (
      Math.hypot(px - -12.2, pz - 2.3) < 1.8 ||
      Math.hypot(px - -0.5, pz - 2.45) < 1.8
    ) {
      continue;
    }

    const py = getPrivateTerrainHeight(px, pz);
    const isMossy = i % 2 === 0;
    const boulder = new THREE.Mesh(
      rockGeo,
      isMossy ? mossyStoneMat : stoneBlockMat,
    );
    const sx = 0.42 + rng() * 0.65;
    const sy = 0.24 + rng() * 0.38;
    const sz = 0.38 + rng() * 0.58;
    boulder.position.set(px, py + sy * 0.25, pz);
    boulder.scale.set(sx, sy, sz);
    boulder.rotation.set(
      (rng() - 0.5) * 0.25,
      rng() * Math.PI * 2,
      (rng() - 0.5) * 0.25,
    );
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    pondShoreGroup.add(boulder);
  }

  // 5 Subtle Bioluminescent Pond-Edge Plants that softly illuminate nearby water and stones
  const pondBioPlantAngles = [-0.85, -2.15, 1.55, -0.15, 2.35];
  const bioStemGeo = trackGeo(new THREE.CylinderGeometry(0.03, 0.05, 0.48, 6));
  const bioBloomGeo = trackGeo(new THREE.OctahedronGeometry(0.14, 1));

  pondBioPlantAngles.forEach((ang, idx) => {
    const shoreR = getReflectivePondShoreRadius(ang) - 0.15;
    const bx = -5.2 + Math.cos(ang) * shoreR * 1.14;
    const bz = -0.3 + Math.sin(ang) * shoreR * 0.94;
    const by = Math.max(
      getPrivateTerrainHeight(bx, bz),
      REFLECTIVE_POND_WATER_LEVEL - 0.05,
    );

    const cluster = new THREE.Group();
    cluster.name = `ReflectivePond_BiolumPlant_${idx + 1}`;
    cluster.position.set(bx, by, bz);

    for (let s = 0; s < 3; s++) {
      const ox = (s - 1) * 0.18;
      const oz = ((s * 2) % 3 - 1) * 0.14;
      const hScale = 0.75 + s * 0.22;
      const stem = new THREE.Mesh(bioStemGeo, canopyDeepTealMat);
      stem.position.set(ox, 0.22 * hScale, oz);
      stem.scale.y = hScale;

      const bloom = new THREE.Mesh(
        bioBloomGeo,
        s % 2 === 0 ? biolumTealMat : biolumSilverBlueMat,
      );
      bloom.position.set(ox, 0.46 * hScale, oz);
      bloom.scale.set(1.1, 0.75, 1.1);
      cluster.add(stem, bloom);
    }

    pondShoreGroup.add(cluster);
  });

  // ============================================================================
  // 9. ISLAND-WIDE DETERMINISTIC VEGETATION & ENVIRONMENTAL DETAIL
  // ============================================================================
  const vegetationGroup = new THREE.Group();
  vegetationGroup.name = 'PrivateIsland_VegetationGroup';
  group.add(vegetationGroup);

  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d5e4a'),
      roughness: 0.82,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
  );
  const fernMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#346e5e'),
      roughness: 0.78,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  const shrubMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#255246'),
      roughness: 0.82,
      metalness: 0.03,
    }),
  );
  const wildflowerPetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#93c5fd'),
      emissive: new THREE.Color('#2dd4bf'),
      emissiveIntensity: 0.75,
      roughness: 0.35,
    }),
  );

  // Shared lightweight vegetation geometries
  const grassTuftGeo = trackGeo(new THREE.ConeGeometry(0.22, 0.55, 5));
  grassTuftGeo.translate(0, 0.26, 0);

  const fernClusterGeo = trackGeo(new THREE.CylinderGeometry(0.48, 0.12, 0.38, 6));
  fernClusterGeo.translate(0, 0.19, 0);

  const shrubGeo = trackGeo(new THREE.DodecahedronGeometry(0.55, 1));
  shrubGeo.scale(1.25, 0.78, 1.15);
  shrubGeo.translate(0, 0.36, 0);

  const flowerBudGeo = trackGeo(new THREE.OctahedronGeometry(0.11, 0));
  flowerBudGeo.translate(0, 0.34, 0);

  const mossPatchGeo = trackGeo(new THREE.CylinderGeometry(0.75, 0.85, 0.04, 7));
  mossPatchGeo.translate(0, 0.02, 0);

  const fallenBranchGeo = trackGeo(
    new THREE.CylinderGeometry(0.07, 0.11, 1.65, 6),
  );
  fallenBranchGeo.rotateZ(Math.PI / 2);
  fallenBranchGeo.translate(0, 0.06, 0);

  const grassTransforms: THREE.Matrix4[] = [];
  const fernTransforms: THREE.Matrix4[] = [];
  const shrubTransforms: THREE.Matrix4[] = [];
  const flowerTransforms: THREE.Matrix4[] = [];
  const mossPatchTransforms: THREE.Matrix4[] = [];
  const branchTransforms: THREE.Matrix4[] = [];
  const fieldStoneTransforms: THREE.Matrix4[] = [];

  const vegRng = createPrivateSeededRng(20270214 ^ 0x3c6ef372);
  const _vegNormal = new THREE.Vector3();

  function isValidVegetationSpot(
    wx: number,
    wz: number,
    minPathClearance: number,
  ): { valid: boolean; wy: number; ny: number } {
    // 1. Exclude Reserved Underground Grotto Volume
    if (
      wx >= RESERVED_GROTTO_VOLUME.minX - 2 &&
      wx <= RESERVED_GROTTO_VOLUME.maxX + 2 &&
      wz >= RESERVED_GROTTO_VOLUME.minZ - 2 &&
      wz <= RESERVED_GROTTO_VOLUME.maxZ + 2
    ) {
      return { valid: false, wy: 0, ny: 0 };
    }

    // 2. Exclude Reflective Pond water interior
    if (getReflectivePondSignedDistance(wx, wz) < 0.65) {
      return { valid: false, wy: 0, ny: 0 };
    }

    // 3. Exclude Arrival Shore Pier, Stargazing Deck Platform, Hidden Cave Forecourt/Tunnel & Northern Ridge Lookout
    if (
      (Math.abs(wx) < 5.5 && wz < -138.0) ||
      Math.hypot(wx - 145, wz - 35) < 12.6 ||
      Math.hypot(wx - 35, wz - 112) < 11.5 ||
      (wz > 109.0 && wz < 125.0 && Math.abs(wx - 34.0) < 6.5) ||
      Math.hypot(wx, wz - 143.5) < 9.5 ||
      (wz > 96.0 &&
        wz < 144.0 &&
        Math.abs(wx - (26.0 - 26.0 * ((wz - 98.0) / 45.0))) < 3.5)
    ) {
      return { valid: false, wy: 0, ny: 0 };
    }

    // 4. Exclude Pathways
    const pathEval = evaluatePrivatePathNetwork(wx, wz);
    if (pathEval.minDist < minPathClearance) {
      return { valid: false, wy: 0, ny: 0 };
    }

    // 5. Check elevation & slope
    const wy = getPrivateTerrainHeight(wx, wz);
    if (wy < 1.05 || wy > 21.5) {
      return { valid: false, wy, ny: 0 };
    }

    getPrivateTerrainNormal(wx, wz, _vegNormal);
    if (_vegNormal.y < 0.72) {
      return { valid: false, wy, ny: _vegNormal.y };
    }

    return { valid: true, wy, ny: _vegNormal.y };
  }

  // Sample island-wide + garden/pond concentrated botanical distribution
  const TOTAL_VEG_CANDIDATES = 2400;
  for (let i = 0; i < TOTAL_VEG_CANDIDATES; i++) {
    let wx = 0;
    let wz = 0;

    // 55% concentrated in the botanical belt around Memory Garden, Reflective Pond & paths; 45% across the island
    if (i < TOTAL_VEG_CANDIDATES * 0.55) {
      const angle = vegRng() * Math.PI * 2;
      const radius = Math.pow(vegRng(), 0.7) * 78.0;
      wx = -22.0 + Math.cos(angle) * radius;
      wz = -6.0 + Math.sin(angle) * radius;
    } else {
      wx = (vegRng() - 0.5) * 380.0;
      wz = (vegRng() - 0.5) * 300.0;
    }

    const check = isValidVegetationSpot(wx, wz, 2.85);
    if (!check.valid) continue;

    const gardenWeight = getMemoryGardenBlendWeight(wx, wz);
    const pondDist = getReflectivePondSignedDistance(wx, wz);
    const nearPondShore = pondDist >= 0.65 && pondDist < 5.5;
    const roll = vegRng();

    dummy.position.set(wx, check.wy, wz);
    dummy.rotation.set(
      (vegRng() - 0.5) * 0.14,
      vegRng() * Math.PI * 2,
      (vegRng() - 0.5) * 0.14,
    );

    if (roll < 0.36 && grassTransforms.length < 680) {
      const s = 0.75 + vegRng() * 0.85 + gardenWeight * 0.25;
      dummy.scale.set(s, s * (0.85 + vegRng() * 0.4), s);
      dummy.updateMatrix();
      grassTransforms.push(dummy.matrix.clone());
    } else if (roll < 0.56 && fernTransforms.length < 340) {
      const s = 0.7 + vegRng() * 0.75 + (nearPondShore ? 0.25 : 0);
      dummy.scale.set(s, s * 0.9, s);
      dummy.updateMatrix();
      fernTransforms.push(dummy.matrix.clone());
    } else if (roll < 0.68 && shrubTransforms.length < 210) {
      const s = 0.65 + vegRng() * 0.85;
      dummy.scale.set(s, s * (0.8 + vegRng() * 0.35), s);
      dummy.updateMatrix();
      shrubTransforms.push(dummy.matrix.clone());
    } else if (
      roll < 0.79 &&
      (gardenWeight > 0.08 || nearPondShore || vegRng() < 0.35) &&
      flowerTransforms.length < 190
    ) {
      const s = 0.8 + vegRng() * 0.65;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      flowerTransforms.push(dummy.matrix.clone());
    } else if (roll < 0.89 && mossPatchTransforms.length < 160) {
      const s = 0.65 + vegRng() * 1.15;
      dummy.scale.set(s, 1.0, s * (0.75 + vegRng() * 0.45));
      dummy.updateMatrix();
      mossPatchTransforms.push(dummy.matrix.clone());
    } else if (roll < 0.95 && branchTransforms.length < 65) {
      const s = 0.7 + vegRng() * 0.65;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      branchTransforms.push(dummy.matrix.clone());
    } else if (fieldStoneTransforms.length < 110) {
      const sx = 0.24 + vegRng() * 0.42;
      const sy = 0.14 + vegRng() * 0.22;
      const sz = 0.22 + vegRng() * 0.38;
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      fieldStoneTransforms.push(dummy.matrix.clone());
    }
  }

  const buildInstancedLayer = (
    name: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    matrices: THREE.Matrix4[],
    castShadow = false,
  ) => {
    const inst = new THREE.InstancedMesh(
      geo,
      mat,
      Math.max(1, matrices.length),
    );
    inst.name = name;
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    matrices.forEach((m, idx) => inst.setMatrixAt(idx, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    vegetationGroup.add(inst);
    return inst;
  };

  buildInstancedLayer(
    'PrivateVeg_GrassClusters',
    grassTuftGeo,
    grassMat,
    grassTransforms,
    false,
  );
  buildInstancedLayer(
    'PrivateVeg_WoodlandFerns',
    fernClusterGeo,
    fernMat,
    fernTransforms,
    false,
  );
  buildInstancedLayer(
    'PrivateVeg_BotanicalShrubs',
    shrubGeo,
    shrubMat,
    shrubTransforms,
    true,
  );
  buildInstancedLayer(
    'PrivateVeg_BiolumWildflowers',
    flowerBudGeo,
    wildflowerPetalMat,
    flowerTransforms,
    false,
  );
  buildInstancedLayer(
    'PrivateVeg_MossPatches',
    mossPatchGeo,
    mossyStoneMat,
    mossPatchTransforms,
    false,
  );
  buildInstancedLayer(
    'PrivateVeg_FallenBranches',
    fallenBranchGeo,
    darkBarkMat,
    branchTransforms,
    false,
  );
  buildInstancedLayer(
    'PrivateVeg_FieldStones',
    rockGeo,
    stoneBlockMat,
    fieldStoneTransforms,
    false,
  );

  // ============================================================================
  // 11. PHASE 4.3 LANDMARKS: STARGAZING DECK (+145, +35), NORTHERN RIDGE (0, +145)
  //     & HIDDEN CAVE ENTRANCE WITH DESCENDING TUNNEL (+35, +110)
  // ============================================================================

  //Procedural Wood Grain Texture for Authentic Timber Floorboards & Joinery
  const timberGrainCanvas = document.createElement('canvas');
  timberGrainCanvas.width = 256;
  timberGrainCanvas.height = 256;
  const tCtx = timberGrainCanvas.getContext('2d')!;
  tCtx.fillStyle = '#5c4332';
  tCtx.fillRect(0, 0, 256, 256);
  const tImg = tCtx.getImageData(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const streak =
        privateNoise2D(x * 0.045, y * 0.55) * 18 +
        privateNoise2D(x * 0.18 + 7, y * 1.4) * 9;
      tImg.data[idx] = Math.min(255, Math.max(0, Math.round(212 + streak)));
      tImg.data[idx + 1] = Math.min(
        255,
        Math.max(0, Math.round(196 + streak * 0.85)),
      );
      tImg.data[idx + 2] = Math.min(
        255,
        Math.max(0, Math.round(178 + streak * 0.7)),
      );
      tImg.data[idx + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);
  const timberGrainTex = trackTex(new THREE.CanvasTexture(timberGrainCanvas));
  timberGrainTex.wrapS = THREE.RepeatWrapping;
  timberGrainTex.wrapT = THREE.RepeatWrapping;
  timberGrainTex.repeat.set(4, 1);
  timberGrainTex.colorSpace = THREE.SRGBColorSpace;
  timberGrainTex.anisotropy = maxAniso;

  const deckPlankWarmMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#694c37'),
      map: timberGrainTex,
      roughness: 0.8,
      metalness: 0.04,
    }),
  );
  const deckPlankWeatheredMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#573f2e'),
      map: timberGrainTex,
      roughness: 0.84,
      metalness: 0.04,
    }),
  );
  const deckPlankRichMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4b3526'),
      map: timberGrainTex,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  const deckBeamMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2a1e'),
      map: timberGrainTex,
      roughness: 0.86,
      metalness: 0.05,
    }),
  );
  const deckCushionMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d3848'),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const deckPillowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#465366'),
      roughness: 0.85,
      metalness: 0.02,
    }),
  );
  const telescopeTubeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#182232'),
      roughness: 0.32,
      metalness: 0.68,
    }),
  );
  const telescopeMountIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e242d'),
      roughness: 0.48,
      metalness: 0.75,
    }),
  );
  const telescopeBrassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c89d54'),
      emissive: new THREE.Color('#3b2506'),
      emissiveIntensity: 0.18,
      roughness: 0.26,
      metalness: 0.88,
    }),
  );
  const telescopeOpticsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38bdf8'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.55,
      roughness: 0.08,
      metalness: 0.92,
    }),
  );
  const deckLanternGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde68a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.65,
      roughness: 0.2,
    }),
  );

  // ----------------------------------------------------------------------------
  // 11A. STARGAZING DECK (+145, +35, Elev +18.0m; Deck Surface +18.28m)
  // ----------------------------------------------------------------------------
  const stargazingDeckGroup = new THREE.Group();
  stargazingDeckGroup.name = 'StargazingDeck_LocationGreybox';
  const deckBaseY = getPrivateTerrainHeight(145, 35);
  stargazingDeckGroup.position.set(145, deckBaseY, 35);
  group.add(stargazingDeckGroup);

  // 1. Stone Foundation Piers & Heavy Timber Substructure
  const stonePierGeo = trackGeo(new THREE.CylinderGeometry(0.56, 0.72, 2.2, 8));
  const stoneFootingCollarGeo = trackGeo(
    new THREE.CylinderGeometry(0.78, 0.88, 0.45, 8),
  );
  const supportPilingGeo = trackGeo(
    new THREE.CylinderGeometry(0.24, 0.26, 2.4, 10),
  );
  const radialBeamGeo = trackGeo(new THREE.BoxGeometry(8.9, 0.26, 0.32));
  const kneeBraceGeo = trackGeo(new THREE.BoxGeometry(0.16, 1.15, 0.18));

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(ang) * 8.15;
    const pz = Math.sin(ang) * 8.15;
    const groundOffsetY = getPrivateTerrainHeight(145 + px, 35 + pz) - deckBaseY;

    const stonePier = new THREE.Mesh(stonePierGeo, stoneBlockMat);
    stonePier.position.set(px, groundOffsetY + 0.15, pz);
    stonePier.rotation.y = ang;
    stonePier.castShadow = true;
    stonePier.receiveShadow = true;
    stargazingDeckGroup.add(stonePier);

    const mossyFooting = new THREE.Mesh(stoneFootingCollarGeo, mossyStoneMat);
    mossyFooting.position.set(px, groundOffsetY - 0.65, pz);
    mossyFooting.rotation.y = ang + 0.3;
    stargazingDeckGroup.add(mossyFooting);

    const timberPost = new THREE.Mesh(supportPilingGeo, deckBeamMat);
    timberPost.position.set(px, -0.95, pz);
    timberPost.castShadow = true;
    stargazingDeckGroup.add(timberPost);

    // Diagonal knee braces from post to rim beam
    const brace = new THREE.Mesh(kneeBraceGeo, deckBeamMat);
    brace.position.set(px * 0.91, -0.32, pz * 0.91);
    brace.rotation.y = -ang;
    brace.rotation.z = 0.68;
    stargazingDeckGroup.add(brace);

    if (i < 4) {
      const crossBeam = new THREE.Mesh(radialBeamGeo, deckBeamMat);
      crossBeam.position.set(0, 0.08, 0);
      crossBeam.rotation.y = ang;
      crossBeam.castShadow = true;
      stargazingDeckGroup.add(crossBeam);
    }
  }

  // Octagonal Perimeter Rim Joist Frame & Sub-Deck Apron
  const deckRimGeo = trackGeo(new THREE.CylinderGeometry(9.18, 9.28, 0.24, 8));
  const deckRimMesh = new THREE.Mesh(deckRimGeo, deckBeamMat);
  deckRimMesh.name = 'StargazingDeck_SubstructureFrame';
  deckRimMesh.position.y = 0.11;
  deckRimMesh.rotation.y = Math.PI / 8;
  deckRimMesh.castShadow = true;
  deckRimMesh.receiveShadow = true;
  stargazingDeckGroup.add(deckRimMesh);

  // 2. Individual Natural Wooden Floorboard Planks (Top Surface at y_local = +0.28m)
  const plankGroup = new THREE.Group();
  plankGroup.name = 'StargazingDeck_WoodenFloorboards';
  stargazingDeckGroup.add(plankGroup);

  const deckOctRadius = 8.95;
  const numPlanks = 36;
  const plankPitch = (deckOctRadius * 2) / numPlanks;
  const plankWidth = plankPitch - 0.032; // Visible natural seam between planks
  const plankThickness = 0.075;
  const plankMaterials = [
    deckPlankWarmMat,
    deckPlankWeatheredMat,
    deckPlankRichMat,
  ];

  for (let p = 0; p < numPlanks; p++) {
    const zOffset = -deckOctRadius + (p + 0.5) * plankPitch;
    const absZ = Math.abs(zOffset);
    // Octagon chord width calculation
    const cornerCut = deckOctRadius * 0.4142;
    let halfSpanX = deckOctRadius;
    if (absZ > cornerCut) {
      halfSpanX = Math.max(
        1.2,
        deckOctRadius - (absZ - cornerCut),
      );
    }
    const totalLen = halfSpanX * 2.0;

    // Split every second plank into two realistic staggered boards with butt joints
    if (p % 2 === 0 || totalLen < 8.5) {
      const pGeo = trackGeo(
        new THREE.BoxGeometry(totalLen, plankThickness, plankWidth),
      );
      const pMat = plankMaterials[(p * 7) % plankMaterials.length];
      const plank = new THREE.Mesh(pGeo, pMat);
      plank.position.set(
        0,
        0.28 - plankThickness * 0.5 + ((p % 3) - 1) * 0.002,
        zOffset,
      );
      plank.receiveShadow = true;
      plank.castShadow = true;
      plankGroup.add(plank);
    } else {
      const splitX = ((p % 5) - 2) * 1.35;
      const leftLen = halfSpanX + splitX - 0.018;
      const rightLen = halfSpanX - splitX - 0.018;

      const leftGeo = trackGeo(
        new THREE.BoxGeometry(leftLen, plankThickness, plankWidth),
      );
      const rightGeo = trackGeo(
        new THREE.BoxGeometry(rightLen, plankThickness, plankWidth),
      );
      const leftPlank = new THREE.Mesh(
        leftGeo,
        plankMaterials[p % plankMaterials.length],
      );
      leftPlank.position.set(
        -halfSpanX + leftLen * 0.5,
        0.28 - plankThickness * 0.5,
        zOffset,
      );
      leftPlank.receiveShadow = true;

      const rightPlank = new THREE.Mesh(
        rightGeo,
        plankMaterials[(p + 1) % plankMaterials.length],
      );
      rightPlank.position.set(
        halfSpanX - rightLen * 0.5,
        0.28 - plankThickness * 0.5 + 0.002,
        zOffset,
      );
      rightPlank.receiveShadow = true;

      plankGroup.add(leftPlank, rightPlank);
    }
  }

  // Compass Rose Inlay Medallion in Center of Floorboards
  const inlayOuterRingGeo = trackGeo(
    new THREE.RingGeometry(1.32, 1.48, 24),
  );
  inlayOuterRingGeo.rotateX(-Math.PI / 2);
  const inlayOuterRing = new THREE.Mesh(inlayOuterRingGeo, bronzeGateMat);
  inlayOuterRing.position.set(0.8, 0.283, 0);
  stargazingDeckGroup.add(inlayOuterRing);

  // 3. Western Natural Stone & Timber Approach Staircase (x_local: -12.2 -> -8.7, z_local: -2.2..+2.2)
  const approachStairsGroup = new THREE.Group();
  approachStairsGroup.name = 'StargazingDeck_WesternApproachStairs';
  stargazingDeckGroup.add(approachStairsGroup);

  const stepDepth = 0.88;
  const stepWidth = 4.1;
  for (let s = 0; s < 4; s++) {
    const sx = -11.8 + s * 0.85;
    const stepTopY = 0.06 + (s / 3) * 0.22;
    const stoneTreadGeo = trackGeo(
      new THREE.BoxGeometry(stepDepth, 0.16, stepWidth - s * 0.08),
    );
    const stoneTread = new THREE.Mesh(stoneTreadGeo, stoneBlockMat);
    stoneTread.position.set(sx, stepTopY - 0.08, 0);
    stoneTread.receiveShadow = true;
    stoneTread.castShadow = true;
    approachStairsGroup.add(stoneTread);

    const timberNosingGeo = trackGeo(
      new THREE.BoxGeometry(0.14, 0.06, stepWidth - s * 0.08 + 0.06),
    );
    const timberNosing = new THREE.Mesh(timberNosingGeo, deckPlankWarmMat);
    timberNosing.position.set(sx + stepDepth * 0.42, stepTopY - 0.02, 0);
    approachStairsGroup.add(timberNosing);
  }

  // Low Stone Cheek Walls Flanking the Western Approach Steps
  const cheekWallGeo = trackGeo(new THREE.BoxGeometry(3.6, 0.58, 0.52));
  for (const side of [-1, 1] as const) {
    const cheekWall = new THREE.Mesh(cheekWallGeo, mossyStoneMat);
    cheekWall.position.set(-10.5, 0.18, side * 2.35);
    cheekWall.rotation.z = 0.06;
    cheekWall.castShadow = true;
    cheekWall.receiveShadow = true;
    approachStairsGroup.add(cheekWall);
    colliders.push({ x: 145 - 10.5, z: 35 + side * 2.35, radius: 0.65 });
  }

  // 4. Wooden Perimeter Railings & Unobstructed Eastern Ocean Overlook
  const railingGroup = new THREE.Group();
  railingGroup.name = 'StargazingDeck_WoodenRailings';
  stargazingDeckGroup.add(railingGroup);

  const railPostGeo = trackGeo(new THREE.BoxGeometry(0.2, 1.04, 0.2));
  const postCapGeo = trackGeo(new THREE.BoxGeometry(0.26, 0.06, 0.26));
  const lowOceanCurbGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.16, 2.2));

  // Build 16 perimeter stations around the 8-sided deck (radius = 8.65m)
  const railRadius = 8.65;
  const numStations = 20;
  const stationAngles: number[] = [];
  for (let i = 0; i < numStations; i++) {
    stationAngles.push(-Math.PI + (i / numStations) * Math.PI * 2);
  }

  for (let i = 0; i < numStations; i++) {
    const ang1 = stationAngles[i];
    const ang2 = stationAngles[(i + 1) % numStations];
    const x1 = Math.cos(ang1) * railRadius;
    const z1 = Math.sin(ang1) * railRadius;
    const x2 = Math.cos(ang2) * railRadius;
    const z2 = Math.sin(ang2) * railRadius;
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;

    // Leave Western Stairway Entrance Open (x < -6.5 and |z| < 2.25)
    const isWesternStairGap = midX < -6.5 && Math.abs(midZ) < 2.35;
    if (isWesternStairGap) {
      continue;
    }

    // Leave Eastern Ocean Horizon Unobstructed (ang in [-0.30*PI, +0.30*PI]) with a low architectural wheel-curb
    const isEasternOceanView =
      Math.cos((ang1 + ang2) * 0.5) > 0.62 && Math.abs(midZ) < 6.8;

    if (isEasternOceanView) {
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      const segAngle = Math.atan2(x2 - x1, z2 - z1);
      const curb = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.22, 0.18, segLen)),
        deckBeamMat,
      );
      curb.position.set(midX, 0.37, midZ);
      curb.rotation.y = segAngle;
      curb.castShadow = true;
      railingGroup.add(curb);
      // Keep collider along eastern drop-off so player cannot fall off the +18m cliff
      colliders.push({ x: 145 + midX, z: 35 + midZ, radius: 0.55 });
      continue;
    }

    // Full Wooden Railing Post at (x1, z1)
    const post = new THREE.Mesh(railPostGeo, deckBeamMat);
    post.position.set(x1, 0.28 + 0.52, z1);
    post.rotation.y = -ang1;
    post.castShadow = true;
    post.receiveShadow = true;

    const cap = new THREE.Mesh(postCapGeo, bronzeGateMat);
    cap.position.set(x1, 0.28 + 1.06, z1);
    cap.rotation.y = -ang1;
    railingGroup.add(post, cap);

    // Top Handrail, Mid-Rail & Lower Baluster Rail between station i and i+1
    const segLen = Math.hypot(x2 - x1, z2 - z1);
    const segYaw = Math.atan2(x2 - x1, z2 - z1);

    const topRail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.16, 0.09, segLen + 0.08)),
      deckPlankWarmMat,
    );
    topRail.position.set(midX, 0.28 + 0.98, midZ);
    topRail.rotation.y = segYaw;
    topRail.castShadow = true;

    const midRail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.09, 0.07, segLen)),
      deckPlankWeatheredMat,
    );
    midRail.position.set(midX, 0.28 + 0.62, midZ);
    midRail.rotation.y = segYaw;

    const bottomRail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.11, 0.08, segLen)),
      deckBeamMat,
    );
    bottomRail.position.set(midX, 0.28 + 0.24, midZ);
    bottomRail.rotation.y = segYaw;

    railingGroup.add(topRail, midRail, bottomRail);
    colliders.push({ x: 145 + midX, z: 35 + midZ, radius: 0.58 });
  }

  // 5. Realistic Multi-Part Observation Telescope (StargazingDeck_ObservationTelescope at x_local: +3.2, z_local: 0.0)
  const telescopeGroup = new THREE.Group();
  telescopeGroup.name = 'StargazingDeck_ObservationTelescope';
  telescopeGroup.position.set(3.2, 0.28, 0.0);
  stargazingDeckGroup.add(telescopeGroup);

  // 5a. Masonry Stone & Brushed Bronze Pedestal Pier
  const teleStoneBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.56, 0.68, 0.34, 12)),
    stoneBlockMat,
  );
  teleStoneBase.position.y = 0.17;
  teleStoneBase.castShadow = true;
  teleStoneBase.receiveShadow = true;

  const teleBronzePlinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.36, 0.48, 0.16, 16)),
    telescopeBrassMat,
  );
  teleBronzePlinth.position.y = 0.42;

  const telePillar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.19, 0.25, 0.86, 16)),
    telescopeMountIronMat,
  );
  telePillar.position.y = 0.92;
  telePillar.castShadow = true;

  // Three Cast-Iron Stabilizer Struts around the Pedestal
  const strutGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.68, 0.14));
  for (let l = 0; l < 3; l++) {
    const lang = (l / 3) * Math.PI * 2 + Math.PI / 6;
    const strut = new THREE.Mesh(strutGeo, telescopeMountIronMat);
    strut.position.set(
      Math.cos(lang) * 0.29,
      0.66,
      Math.sin(lang) * 0.29,
    );
    strut.rotation.y = -lang;
    strut.rotation.z = 0.32;
    strut.castShadow = true;
    telescopeGroup.add(strut);
  }

  // 5b. Equatorial Mount Head, Setting Circles & Counterweight Assembly
  const eqMountHead = new THREE.Group();
  eqMountHead.position.set(0, 1.42, 0);
  // Orient toward the eastern night sky and slightly north-east
  eqMountHead.rotation.y = -0.18;
  telescopeGroup.add(teleStoneBase, teleBronzePlinth, telePillar, eqMountHead);

  const polarHousing = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.14, 0.15, 0.42, 16)),
    telescopeMountIronMat,
  );
  polarHousing.rotation.z = -0.52;
  eqMountHead.add(polarHousing);

  const settingCircleRA = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 24)),
    telescopeBrassMat,
  );
  settingCircleRA.position.set(0.08, 0.06, 0);
  settingCircleRA.rotation.z = -0.52;
  eqMountHead.add(settingCircleRA);

  // Counterweight Shaft & Machined Weight Disc
  const cwShaft = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 12)),
    telescopeBrassMat,
  );
  cwShaft.position.set(-0.18, -0.18, 0.24);
  cwShaft.rotation.x = 0.78;
  eqMountHead.add(cwShaft);

  const cwDisc = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.11, 20)),
    telescopeMountIronMat,
  );
  cwDisc.position.set(-0.18, -0.34, 0.38);
  cwDisc.rotation.x = 0.78;
  eqMountHead.add(cwDisc);

  // 5c. Optical Tube Assembly (OTA) — Elevated at +26 degrees toward the stars
  const otaAssembly = new THREE.Group();
  otaAssembly.position.set(0.06, 0.16, 0);
  otaAssembly.rotation.z = 0.46; // +26.3 deg elevation toward eastern sky
  eqMountHead.add(otaAssembly);

  // Main Satin-Dark Optical Tube (aligned along +X when rotation.z = -PI/2)
  const mainTube = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.145, 0.125, 1.52, 24)),
    telescopeTubeMat,
  );
  mainTube.rotation.z = -Math.PI / 2;
  mainTube.position.x = 0.12;
  mainTube.castShadow = true;
  otaAssembly.add(mainTube);

  // Extended Brass Dew Shield & Objective Lens Cell at front (+X)
  const dewShield = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.162, 0.148, 0.38, 24)),
    telescopeBrassMat,
  );
  dewShield.rotation.z = -Math.PI / 2;
  dewShield.position.x = 0.98;
  dewShield.castShadow = true;
  otaAssembly.add(dewShield);

  const objectiveLens = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.146, 24)),
    telescopeOpticsMat,
  );
  objectiveLens.rotation.y = Math.PI / 2;
  objectiveLens.position.x = 1.14;
  otaAssembly.add(objectiveLens);

  // Twin Brass Cradle Rings & Dovetail Bar
  for (const ringX of [-0.14, 0.28]) {
    const cradleRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.146, 0.022, 12, 24)),
      telescopeBrassMat,
    );
    cradleRing.rotation.y = Math.PI / 2;
    cradleRing.position.x = ringX;
    otaAssembly.add(cradleRing);
  }

  // Rear Brass Focuser Housing, Dual Knurled Handwheels, Star Diagonal & Eyepiece (-X)
  const focuserBarrel = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.085, 0.115, 0.28, 18)),
    telescopeBrassMat,
  );
  focuserBarrel.rotation.z = -Math.PI / 2;
  focuserBarrel.position.x = -0.74;
  otaAssembly.add(focuserBarrel);

  const focusWheelGeo = trackGeo(
    new THREE.CylinderGeometry(0.065, 0.065, 0.24, 16),
  );
  focusWheelGeo.rotateX(Math.PI / 2);
  const focusWheels = new THREE.Mesh(focusWheelGeo, telescopeBrassMat);
  focusWheels.position.set(-0.76, -0.08, 0);
  otaAssembly.add(focusWheels);

  const starDiagonal = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.12, 0.14, 0.11)),
    telescopeMountIronMat,
  );
  starDiagonal.position.set(-0.91, 0.03, 0);
  otaAssembly.add(starDiagonal);

  const eyepieceTube = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.042, 0.036, 0.16, 16)),
    telescopeBrassMat,
  );
  eyepieceTube.position.set(-0.94, 0.14, 0);
  eyepieceTube.rotation.z = 0.25;
  otaAssembly.add(eyepieceTube);

  // Parallel Brass Finder Scope Mounted Above Main Tube
  const finderScope = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.034, 0.028, 0.56, 14)),
    telescopeBrassMat,
  );
  finderScope.rotation.z = -Math.PI / 2;
  finderScope.position.set(-0.18, 0.21, 0.06);
  otaAssembly.add(finderScope);

  colliders.push({ x: 145 + 3.2, z: 35 + 0.0, radius: 1.05 });

  // 6. Seating Elements (Curved Two-Person Loveseat Bench + Two Low Timber Loungers)
  // 6a. Curved Two-Person Loveseat Bench (x_local: -1.8, z_local: -3.1, angled toward telescope & ocean)
  const loveseatGroup = new THREE.Group();
  loveseatGroup.name = 'StargazingDeck_CurvedLoveseatBench';
  loveseatGroup.position.set(-1.8, 0.28, -3.1);
  loveseatGroup.rotation.y = 0.42;
  stargazingDeckGroup.add(loveseatGroup);

  const loveseatRadius = 2.45;
  const loveseatSegments = 5;
  const segArc = 0.24;
  for (let s = 0; s < loveseatSegments; s++) {
    const theta = (s - (loveseatSegments - 1) * 0.5) * segArc;
    const segGroup = new THREE.Group();
    segGroup.position.set(
      -loveseatRadius + Math.cos(theta) * loveseatRadius,
      0,
      Math.sin(theta) * loveseatRadius,
    );
    segGroup.rotation.y = -theta;

    const seatFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.68, 0.12, 0.62)),
      deckPlankWarmMat,
    );
    seatFrame.position.y = 0.38;
    seatFrame.castShadow = true;
    seatFrame.receiveShadow = true;

    const seatCushion = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.62, 0.11, 0.58)),
      deckCushionMat,
    );
    seatCushion.position.set(0.02, 0.48, 0);
    seatCushion.castShadow = true;

    const backrestFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.11, 0.56, 0.61)),
      deckBeamMat,
    );
    backrestFrame.position.set(-0.31, 0.68, 0);
    backrestFrame.rotation.z = 0.18;
    backrestFrame.castShadow = true;

    const backPillow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.12, 0.38, 0.52)),
      deckPillowMat,
    );
    backPillow.position.set(-0.22, 0.68, 0);
    backPillow.rotation.z = 0.18;

    segGroup.add(seatFrame, seatCushion, backrestFrame, backPillow);

    if (s === 0 || s === 2 || s === loveseatSegments - 1) {
      const frontLeg = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.38, 0.12)),
        deckBeamMat,
      );
      frontLeg.position.set(0.24, 0.19, 0);
      const backLeg = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.38, 0.12)),
        deckBeamMat,
      );
      backLeg.position.set(-0.26, 0.19, 0);
      segGroup.add(frontLeg, backLeg);
    }

    if (s === 0 || s === loveseatSegments - 1) {
      const armrest = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.66, 0.08, 0.14)),
        deckPlankWarmMat,
      );
      armrest.position.set(
        0,
        0.58,
        s === 0 ? -0.32 : 0.32,
      );
      segGroup.add(armrest);
    }

    loveseatGroup.add(segGroup);
  }
  colliders.push({ x: 145 - 1.8, z: 35 - 3.1, radius: 1.42 });

  // 6b. Two Low Timber Stargazing Loungers Beside the Telescope (x_local: -1.5, z_local: +3.2 & x_local: +0.6, z_local: +4.4)
  const buildTimberLounger = (
    name: string,
    lx: number,
    lz: number,
    yaw: number,
  ) => {
    const lounger = new THREE.Group();
    lounger.name = name;
    lounger.position.set(lx, 0.28, lz);
    lounger.rotation.y = yaw;

    // Low slatted timber chassis
    const baseFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.86, 0.14, 0.78)),
      deckBeamMat,
    );
    baseFrame.position.set(0, 0.22, 0);
    baseFrame.castShadow = true;
    baseFrame.receiveShadow = true;

    // Reclined stargazing backrest
    const reclinedBack = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.82, 0.1, 0.74)),
      deckPlankWarmMat,
    );
    reclinedBack.position.set(-0.62, 0.42, 0);
    reclinedBack.rotation.z = -0.46;
    reclinedBack.castShadow = true;

    // Upholstered seat & backrest cushions
    const mainPad = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.12, 0.09, 0.7)),
      deckCushionMat,
    );
    mainPad.position.set(0.32, 0.33, 0);

    const backPad = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.76, 0.09, 0.68)),
      deckCushionMat,
    );
    backPad.position.set(-0.56, 0.47, 0);
    backPad.rotation.z = -0.46;

    // Cylindrical bolster headrest pillow
    const bolster = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.56, 14)),
      deckPillowMat,
    );
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-0.78, 0.62, 0);

    // 4 stout timber block feet
    const footGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.18, 0.14));
    for (const fx of [-0.78, 0.78]) {
      for (const fz of [-0.3, 0.3]) {
        const foot = new THREE.Mesh(footGeo, deckBeamMat);
        foot.position.set(fx, 0.09, fz);
        lounger.add(foot);
      }
    }

    lounger.add(baseFrame, reclinedBack, mainPad, backPad, bolster);
    stargazingDeckGroup.add(lounger);
    colliders.push({ x: 145 + lx, z: 35 + lz, radius: 1.08 });
  };

  buildTimberLounger('StargazingDeck_TimberLounger_West', -1.5, 3.1, -0.28);
  buildTimberLounger('StargazingDeck_TimberLounger_East', 0.65, 4.35, -0.36);

  // Small Shared Cedar Side Table Between the Loungers
  const sideTableGroup = new THREE.Group();
  sideTableGroup.position.set(-0.45, 0.28, 3.85);
  const tableTop = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16)),
    deckPlankWarmMat,
  );
  tableTop.position.y = 0.44;
  tableTop.castShadow = true;
  const tablePedestal = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.12, 0.22, 0.42, 12)),
    deckBeamMat,
  );
  tablePedestal.position.y = 0.21;
  sideTableGroup.add(tableTop, tablePedestal);
  stargazingDeckGroup.add(sideTableGroup);

  // 7. Subtle Integrated Deck Bollard Lanterns (Low-glare warm amber accents)
  const bollardPositions: Array<{ x: number; z: number }> = [
    { x: -8.3, z: -2.4 },
    { x: -8.3, z: 2.4 },
    { x: -3.2, z: -7.6 },
    { x: -3.2, z: 7.6 },
    { x: 5.8, z: -6.2 },
    { x: 5.8, z: 6.2 },
  ];
  const bollardHousingGeo = trackGeo(
    new THREE.BoxGeometry(0.24, 0.62, 0.24),
  );
  const bollardCoreGeo = trackGeo(
    new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12),
  );
  const bollardCapGeo = trackGeo(new THREE.ConeGeometry(0.21, 0.12, 4));
  bollardCapGeo.rotateY(Math.PI / 4);

  bollardPositions.forEach((bp, idx) => {
    const bollard = new THREE.Group();
    bollard.name = `StargazingDeck_LanternBollard_${idx + 1}`;
    bollard.position.set(bp.x, 0.28, bp.z);

    const housing = new THREE.Mesh(bollardHousingGeo, deckBeamMat);
    housing.position.y = 0.31;
    housing.castShadow = true;

    const glowCore = new THREE.Mesh(bollardCoreGeo, deckLanternGlowMat);
    glowCore.position.y = 0.48;

    const cap = new THREE.Mesh(bollardCapGeo, bronzeGateMat);
    cap.position.y = 0.65;

    bollard.add(housing, glowCore, cap);
    stargazingDeckGroup.add(bollard);
  });

  // Subtle Ambient Warmth PointLight Over the Stargazing Deck (Low intensity to preserve night sky)
  const deckWarmLight = new THREE.PointLight(0xfbbf24, 0.72, 16.0, 1.8);
  deckWarmLight.position.set(0.5, 2.2, 0.0);
  stargazingDeckGroup.add(deckWarmLight);

  // ----------------------------------------------------------------------------
  // 11B. NORTHERN RIDGE (0, +145, Elev +25.0m) — Dramatic Basalt Ridge & Lookout
  // ----------------------------------------------------------------------------
  const northernRidgeGroup = new THREE.Group();
  northernRidgeGroup.name = 'NorthernRidge_LocationGreybox';
  const ridgeBaseY = getPrivateTerrainHeight(0, 145);
  northernRidgeGroup.position.set(0, ridgeBaseY, 145);
  group.add(northernRidgeGroup);

  const basaltColumnMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#242b37'),
      roughness: 0.86,
      metalness: 0.07,
    }),
  );
  const weatheredCragMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#343d4c'),
      roughness: 0.89,
      metalness: 0.05,
    }),
  );

  // 1. Walkable Natural Basalt Summit Lookout Platform around (0, +142.5..+145.5, +25.0m)
  const summitSlabGeo = trackGeo(new THREE.CylinderGeometry(4.6, 5.4, 0.48, 9));
  const summitSlab = new THREE.Mesh(summitSlabGeo, weatheredCragMat);
  summitSlab.name = 'NorthernRidge_SummitLookoutSlab';
  summitSlab.position.set(0, -0.18, -2.0);
  summitSlab.rotation.y = 0.35;
  summitSlab.receiveShadow = true;
  northernRidgeGroup.add(summitSlab);

  // Natural Weathered Stone Sitting Ledge on the Western Side of the Lookout
  const ridgeSeatLedge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.6, 0.58, 1.15)),
    mossyStoneMat,
  );
  ridgeSeatLedge.position.set(-3.1, 0.26, -1.8);
  ridgeSeatLedge.rotation.y = 0.42;
  ridgeSeatLedge.castShadow = true;
  ridgeSeatLedge.receiveShadow = true;
  northernRidgeGroup.add(ridgeSeatLedge);
  colliders.push({ x: -3.1, z: 145 - 1.8, radius: 1.25 });

  // 2. Stratified Northern Cliff Wall & Columnar Basalt Spires (Framing the North Crest)
  const hexColumnGeo = trackGeo(new THREE.CylinderGeometry(1.15, 1.32, 6.5, 6));
  const ridgeCragConfigs: Array<{
    ox: number;
    oz: number;
    sx: number;
    sy: number;
    sz: number;
    rotY: number;
    rotZ: number;
    isColumn: boolean;
  }> = [
    // Northern sheer cliff crest behind the lookout (z_local > +2.8)
    { ox: -18.5, oz: 2.5, sx: 4.8, sy: 4.2, sz: 4.0, rotY: 0.4, rotZ: 0.08, isColumn: false },
    { ox: -12.2, oz: 4.2, sx: 4.2, sy: 5.6, sz: 3.8, rotY: 1.1, rotZ: -0.06, isColumn: true },
    { ox: -6.4, oz: 5.4, sx: 3.8, sy: 6.4, sz: 3.6, rotY: 0.7, rotZ: 0.05, isColumn: true },
    { ox: 0.0, oz: 6.2, sx: 4.6, sy: 7.2, sz: 4.1, rotY: 0.2, rotZ: -0.04, isColumn: true },
    { ox: 6.5, oz: 5.3, sx: 3.9, sy: 6.1, sz: 3.7, rotY: 1.8, rotZ: 0.07, isColumn: true },
    { ox: 12.6, oz: 3.9, sx: 4.4, sy: 5.2, sz: 3.9, rotY: 2.3, rotZ: -0.08, isColumn: true },
    { ox: 18.8, oz: 1.8, sx: 5.0, sy: 3.9, sz: 4.2, rotY: 0.9, rotZ: 0.06, isColumn: false },
    // Secondary lower basalt ledges & flanking shoulders
    { ox: -9.5, oz: -0.8, sx: 3.1, sy: 2.4, sz: 2.9, rotY: 0.5, rotZ: 0.12, isColumn: false },
    { ox: 9.2, oz: -1.2, sx: 2.9, sy: 2.2, sz: 2.7, rotY: 1.4, rotZ: -0.1, isColumn: false },
    { ox: -4.2, oz: 3.2, sx: 2.2, sy: 1.8, sz: 2.1, rotY: 2.1, rotZ: 0.04, isColumn: false },
    { ox: 4.4, oz: 3.0, sx: 2.3, sy: 1.9, sz: 2.0, rotY: 0.8, rotZ: -0.05, isColumn: false },
  ];

  ridgeCragConfigs.forEach((cfg, idx) => {
    const localGroundY =
      getPrivateTerrainHeight(cfg.ox, 145 + cfg.oz) - ridgeBaseY;
    const mesh = new THREE.Mesh(
      cfg.isColumn ? hexColumnGeo : rockGeo,
      idx % 2 === 0 ? darkBasaltMat : basaltColumnMat,
    );
    mesh.position.set(
      cfg.ox,
      localGroundY + (cfg.isColumn ? cfg.sy * 0.35 : cfg.sy * 0.42),
      cfg.oz,
    );
    mesh.scale.set(
      cfg.isColumn ? cfg.sx * 0.48 : cfg.sx,
      cfg.isColumn ? cfg.sy * 0.24 : cfg.sy,
      cfg.isColumn ? cfg.sz * 0.48 : cfg.sz,
    );
    mesh.rotation.set(0, cfg.rotY, cfg.rotZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    northernRidgeGroup.add(mesh);

    // Moss cushion at base of rock crevice
    const moss = new THREE.Mesh(mossPatchGeo, mossyStoneMat);
    moss.position.set(cfg.ox * 0.88, localGroundY + 0.05, cfg.oz - 0.9);
    moss.scale.set(1.6, 1.2, 1.4);
    northernRidgeGroup.add(moss);

    colliders.push({
      x: cfg.ox,
      z: 145 + cfg.oz,
      radius: Math.max(cfg.sx, cfg.sz) * 0.62,
    });
  });

  // Hardy Highland Ferns, Crevice Shrubs & Trail Cairn Stones on the Northern Ridge
  const ridgeFernPositions: Array<{ x: number; z: number; s: number }> = [
    { x: -5.4, z: 1.2, s: 0.85 },
    { x: -2.8, z: 2.1, s: 0.75 },
    { x: 2.9, z: 1.8, s: 0.82 },
    { x: 5.6, z: 0.9, s: 0.9 },
    { x: -6.8, z: -2.4, s: 0.78 },
    { x: 6.4, z: -2.8, s: 0.84 },
  ];
  ridgeFernPositions.forEach((fp) => {
    const fy = getPrivateTerrainHeight(fp.x, 145 + fp.z) - ridgeBaseY;
    const fern = new THREE.Mesh(fernClusterGeo, fernMat);
    fern.position.set(fp.x, fy, fp.z);
    fern.scale.setScalar(fp.s);
    northernRidgeGroup.add(fern);
  });

  // Highland Saddle Trail Stone Cairns guiding from (26, 98) up to (0, 141)
  for (let c = 0; c < 5; c++) {
    const ct = (c + 0.5) / 5;
    const cx = 26.0 - 26.0 * ct + Math.sin(ct * Math.PI * 2.0) * 2.2 - 2.3;
    const cz = 98.0 + 42.0 * ct;
    const cy = getPrivateTerrainHeight(cx, cz);

    for (let tier = 0; tier < 3; tier++) {
      const cairnStone = new THREE.Mesh(rockGeo, stoneBlockMat);
      const scale = 0.42 - tier * 0.1;
      cairnStone.position.set(
        cx,
        cy + tier * 0.22 + 0.12,
        cz - 145,
      );
      cairnStone.scale.set(scale * 1.2, scale * 0.75, scale);
      cairnStone.rotation.y = c * 1.1 + tier * 0.7;
      cairnStone.castShadow = true;
      northernRidgeGroup.add(cairnStone);
    }
  }

  // ----------------------------------------------------------------------------
  // 11C. HIDDEN CAVE ENTRANCE & WALKABLE DESCENDING TUNNEL (+35, +110, Elev +12.0m)
  // ----------------------------------------------------------------------------
  const hiddenCaveGroup = new THREE.Group();
  hiddenCaveGroup.name = 'HiddenCave_LocationGreybox';
  const caveBaseY = getPrivateTerrainHeight(35, 110);
  hiddenCaveGroup.position.set(35, caveBaseY, 110);
  group.add(hiddenCaveGroup);

  const caveOuterBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#232a36'),
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  const caveMidBasaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#131822'),
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  const caveDeepShadowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#070a10'),
      roughness: 0.96,
      metalness: 0.02,
    }),
  );
  const mineralSeamVioletMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8b4fe'),
      emissive: new THREE.Color('#a855f7'),
      emissiveIntensity: 1.15,
      roughness: 0.26,
    }),
  );
  const mineralSeamTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5eead4'),
      emissive: new THREE.Color('#0d9488'),
      emissiveIntensity: 1.15,
      roughness: 0.26,
    }),
  );

  // 1. Natural Eroded Basalt Cave Arch, Cliff Overhang & Flanking Outcrops
  const caveArchBlocks: Array<{
    px: number;
    py: number;
    pz: number;
    sx: number;
    sy: number;
    sz: number;
    rx: number;
    ry: number;
    rz: number;
    mat: THREE.Material;
  }> = [
    // Left massive basalt arch buttress
    { px: -3.6, py: 2.2, pz: 0.6, sx: 2.3, sy: 3.1, sz: 2.6, rx: 0.08, ry: 0.24, rz: -0.12, mat: darkBasaltMat },
    { px: -4.8, py: 1.6, pz: -1.1, sx: 2.1, sy: 2.2, sz: 2.2, rx: -0.05, ry: 0.6, rz: 0.1, mat: caveOuterBasaltMat },
    { px: -2.9, py: 4.3, pz: 0.9, sx: 2.0, sy: 1.9, sz: 2.4, rx: 0.12, ry: -0.18, rz: -0.28, mat: darkBasaltMat },
    // Right massive basalt arch buttress
    { px: 3.6, py: 2.3, pz: 0.5, sx: 2.4, sy: 3.2, sz: 2.5, rx: 0.06, ry: -0.28, rz: 0.14, mat: darkBasaltMat },
    { px: 4.9, py: 1.7, pz: -0.9, sx: 2.2, sy: 2.1, sz: 2.1, rx: -0.08, ry: -0.5, rz: -0.08, mat: caveOuterBasaltMat },
    { px: 2.8, py: 4.4, pz: 0.8, sx: 2.1, sy: 1.8, sz: 2.3, rx: 0.1, ry: 0.22, rz: 0.3, mat: darkBasaltMat },
    // Upper Overhanging Keystone & Layered Rock Brow (z_local: -0.4 to +2.8, y_local: +4.8 to +6.8)
    { px: 0.0, py: 5.3, pz: 0.6, sx: 3.8, sy: 1.65, sz: 2.8, rx: 0.16, ry: 0.04, rz: -0.04, mat: darkBasaltMat },
    { px: -1.4, py: 5.9, pz: 1.8, sx: 3.1, sy: 1.5, sz: 2.6, rx: 0.08, ry: 0.15, rz: 0.06, mat: caveOuterBasaltMat },
    { px: 1.5, py: 5.8, pz: 1.9, sx: 3.2, sy: 1.5, sz: 2.6, rx: 0.06, ry: -0.12, rz: -0.05, mat: caveOuterBasaltMat },
    // Natural foreground screening outcrop to the right-south of the entrance
    { px: 4.2, py: 1.1, pz: -3.2, sx: 1.9, sy: 1.4, sz: 1.7, rx: 0.04, ry: 0.52, rz: -0.06, mat: mossyStoneMat },
  ];

  caveArchBlocks.forEach((b) => {
    const archRock = new THREE.Mesh(rockGeo, b.mat);
    archRock.position.set(b.px, b.py, b.pz);
    archRock.scale.set(b.sx, b.sy, b.sz);
    archRock.rotation.set(b.rx, b.ry, b.rz);
    archRock.castShadow = true;
    archRock.receiveShadow = true;
    hiddenCaveGroup.add(archRock);
  });

  // Colliders for the outer cave arch buttresses & screening boulder (leaving the 4.2m wide entrance mouth open)
  colliders.push(
    { x: 35 - 3.7, z: 110 + 0.5, radius: 1.85 },
    { x: 35 - 4.8, z: 110 - 1.1, radius: 1.75 },
    { x: 35 + 3.7, z: 110 + 0.4, radius: 1.85 },
    { x: 35 + 4.9, z: 110 - 0.9, radius: 1.75 },
    { x: 35 + 4.2, z: 110 - 3.2, radius: 1.55 },
  );

  // 2. Gnarled Overhanging Roots, Hanging Moss Tendrils & Entrance Ferns
  const rootArchConfigs: Array<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    len: number;
    rad: number;
  }> = [
    { x: -2.1, y: 4.5, z: -0.2, rx: 0.25, ry: 0.1, rz: 0.42, len: 2.8, rad: 0.11 },
    { x: -2.6, y: 3.4, z: 0.1, rx: 0.12, ry: -0.2, rz: 0.18, len: 2.4, rad: 0.085 },
    { x: 2.2, y: 4.4, z: -0.1, rx: 0.22, ry: -0.15, rz: -0.38, len: 2.7, rad: 0.1 },
    { x: 0.4, y: 4.8, z: -0.5, rx: 0.35, ry: 0.08, rz: -0.12, len: 1.6, rad: 0.065 },
  ];
  rootArchConfigs.forEach((rc) => {
    const rootGeo = trackGeo(
      new THREE.CylinderGeometry(rc.rad * 0.45, rc.rad, rc.len, 7),
    );
    const rootMesh = new THREE.Mesh(rootGeo, darkBarkMat);
    rootMesh.position.set(rc.x, rc.y, rc.z);
    rootMesh.rotation.set(rc.rx, rc.ry, rc.rz);
    rootMesh.castShadow = true;
    hiddenCaveGroup.add(rootMesh);
  });

  // Hanging Moss Tendrils Along the Cave Brow (Above head clearance y > 3.7m)
  const vineGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.055, 1.15, 5));
  for (let v = 0; v < 9; v++) {
    const vx = -2.2 + (v / 8) * 4.4;
    const vy = 4.25 - Math.abs(vx) * 0.18;
    const vz = -0.35 + (v % 2) * 0.22;
    const vine = new THREE.Mesh(vineGeo, mossyStoneMat);
    vine.position.set(vx, vy, vz);
    vine.rotation.z = (v % 2 === 0 ? 1 : -1) * 0.08;
    hiddenCaveGroup.add(vine);
  }

  // Entrance Crevice Ferns & Moss Cushions
  for (const side of [-1, 1] as const) {
    const fern1 = new THREE.Mesh(fernClusterGeo, fernMat);
    fern1.position.set(side * 2.55, 0.05, -0.8);
    fern1.scale.setScalar(0.95);
    const fern2 = new THREE.Mesh(fernClusterGeo, fernMat);
    fern2.position.set(side * 3.1, 0.12, -2.1);
    fern2.scale.setScalar(0.82);
    hiddenCaveGroup.add(fern1, fern2);
  }

  // 3. Walkable Descending Stone Tunnel (z_local: 0.0 -> +12.2, descending from y_local = 0.0 to -2.85m)
  const tunnelGroup = new THREE.Group();
  tunnelGroup.name = 'HiddenCave_DescendingTunnelPlaceholder';
  hiddenCaveGroup.add(tunnelGroup);

  const numTunnelRings = 8;
  for (let r = 0; r < numTunnelRings; r++) {
    const t = r / (numTunnelRings - 1); // 0.0 to 1.0
    const smoothT = t * t * (3.0 - 2.0 * t);
    const centerZ = 0.6 + t * 11.4; // z_local: +0.6 to +12.0
    const centerX = -smoothT * 2.4; // Curves gently west toward the grotto
    const floorY = -smoothT * 2.82; // Descends 2.82m along the tunnel

    const ringMat =
      r < 3
        ? caveOuterBasaltMat
        : r < 6
          ? caveMidBasaltMat
          : caveDeepShadowMat;

    // Natural Uneven Stone Floor Slab flush with getHiddenCaveTunnelFloorHeightAt
    const floorSlab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.4, 0.36, 1.95)),
      r < 4 ? stoneBlockMat : caveMidBasaltMat,
    );
    floorSlab.position.set(centerX, floorY - 0.19, centerZ);
    floorSlab.rotation.x = 0.23; // Matches descending slope
    floorSlab.rotation.y = -0.18 * (1 - Math.abs(t - 0.5));
    floorSlab.receiveShadow = true;
    tunnelGroup.add(floorSlab);

    // Left & Right Ribbed Basalt Tunnel Walls
    for (const side of [-1, 1] as const) {
      const wallX = centerX + side * 2.45;
      const wallRock = new THREE.Mesh(rockGeo, ringMat);
      wallRock.position.set(wallX, floorY + 1.85, centerZ);
      wallRock.scale.set(1.45, 2.35, 1.55);
      wallRock.rotation.set(
        0.15 * side,
        r * 0.7 + side * 0.4,
        side * -0.12,
      );
      wallRock.castShadow = true;
      wallRock.receiveShadow = true;
      tunnelGroup.add(wallRock);

      // Register tunnel side-wall colliders so player stays cleanly inside the enclosed passage
      colliders.push({
        x: 35 + centerX + side * 2.48,
        z: 110 + centerZ,
        radius: 1.05,
      });
    }

    // Vaulted Basalt Ceiling Arch Over the Tunnel Ring
    const ceilingVault = new THREE.Mesh(rockGeo, ringMat);
    ceilingVault.position.set(centerX, floorY + 4.05, centerZ);
    ceilingVault.scale.set(3.45, 1.35, 1.65);
    ceilingVault.rotation.set(0.22, r * 0.35, (r % 2 === 0 ? 1 : -1) * 0.06);
    ceilingVault.castShadow = true;
    tunnelGroup.add(ceilingVault);
  }

  // 4. Sealed Endpoint at Bottom of Descending Tunnel (z_local: +11.2..+12.8, y_local: -2.85m)
  //    Natural Rockfall Boulders with Faint Bioluminescent Mineral Seams in Deep Shadow
  const rockfallSealGroup = new THREE.Group();
  rockfallSealGroup.name = 'HiddenCave_SealedRockfallEndpoint';
  rockfallSealGroup.position.set(-2.35, -2.82, 11.65);
  tunnelGroup.add(rockfallSealGroup);

  // Deep-shadow occlusion backing wall behind the rockfall boulders (prevents any sky/ocean bleed)
  const sealBackingWall = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 6.4, 1.4)),
    trackMat(new THREE.MeshBasicMaterial({ color: new THREE.Color('#020408') })),
  );
  sealBackingWall.position.set(0, 2.1, 0.95);
  rockfallSealGroup.add(sealBackingWall);

  // 14 Wedged Basalt Rockfall Boulders Sealing the Passage
  const rockfallBoulders: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    ry: number;
    rz: number;
  }> = [
    // Bottom tier boulders resting on tunnel floor
    { x: -1.35, y: 0.65, z: -0.15, sx: 1.25, sy: 0.95, sz: 1.1, ry: 0.4, rz: 0.2 },
    { x: 0.05, y: 0.72, z: -0.22, sx: 1.35, sy: 1.05, sz: 1.15, ry: 1.2, rz: -0.15 },
    { x: 1.38, y: 0.68, z: -0.1, sx: 1.2, sy: 0.92, sz: 1.05, ry: 2.1, rz: 0.18 },
    { x: -0.68, y: 0.42, z: -0.62, sx: 0.78, sy: 0.55, sz: 0.72, ry: 0.8, rz: -0.25 },
    { x: 0.74, y: 0.45, z: -0.58, sx: 0.82, sy: 0.58, sz: 0.75, ry: 1.7, rz: 0.22 },
    // Middle tier wedged boulders
    { x: -1.1, y: 1.75, z: 0.05, sx: 1.18, sy: 0.95, sz: 1.05, ry: 2.5, rz: -0.3 },
    { x: 0.15, y: 1.82, z: 0.02, sx: 1.28, sy: 1.02, sz: 1.08, ry: 0.6, rz: 0.12 },
    { x: 1.25, y: 1.78, z: 0.08, sx: 1.15, sy: 0.94, sz: 1.02, ry: 1.5, rz: -0.22 },
    // Upper tier boulders wedged against tunnel ceiling vault
    { x: -0.75, y: 2.85, z: 0.18, sx: 1.32, sy: 0.98, sz: 1.12, ry: 1.1, rz: 0.28 },
    { x: 0.68, y: 2.88, z: 0.15, sx: 1.36, sy: 1.02, sz: 1.15, ry: 2.3, rz: -0.18 },
    { x: 0.0, y: 3.45, z: 0.25, sx: 1.55, sy: 0.85, sz: 1.2, ry: 0.3, rz: 0.08 },
  ];

  rockfallBoulders.forEach((rb, idx) => {
    const bMesh = new THREE.Mesh(
      rockGeo,
      idx % 3 === 0 ? caveMidBasaltMat : caveDeepShadowMat,
    );
    bMesh.position.set(rb.x, rb.y, rb.z);
    bMesh.scale.set(rb.sx, rb.sy, rb.sz);
    bMesh.rotation.set(0.2, rb.ry, rb.rz);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    rockfallSealGroup.add(bMesh);
  });

  // Faint Bioluminescent Mineral Seams Peeking Between the Deep-Shadow Rockfall Crevices
  const mineralSeams: Array<{
    x: number;
    y: number;
    z: number;
    len: number;
    rad: number;
    rz: number;
    ry: number;
    isViolet: boolean;
  }> = [
    { x: -0.58, y: 1.18, z: -0.22, len: 0.92, rad: 0.036, rz: 0.68, ry: 0.15, isViolet: false },
    { x: 0.62, y: 1.24, z: -0.18, len: 0.88, rad: 0.034, rz: -0.55, ry: -0.12, isViolet: true },
    { x: -0.08, y: 1.38, z: -0.24, len: 0.74, rad: 0.03, rz: 1.15, ry: 0.08, isViolet: false },
    { x: -0.45, y: 2.28, z: 0.02, len: 0.85, rad: 0.032, rz: -0.78, ry: 0.18, isViolet: true },
    { x: 0.48, y: 2.32, z: 0.0, len: 0.82, rad: 0.032, rz: 0.62, ry: -0.14, isViolet: false },
    { x: 0.04, y: 0.78, z: -0.32, len: 0.68, rad: 0.028, rz: -0.35, ry: 0.1, isViolet: true },
    { x: -0.95, y: 1.65, z: -0.12, len: 0.64, rad: 0.026, rz: 0.42, ry: 0.22, isViolet: false },
  ];

  mineralSeams.forEach((ms) => {
    const seamGeo = trackGeo(
      new THREE.CylinderGeometry(ms.rad * 0.6, ms.rad, ms.len, 6),
    );
    const seamMesh = new THREE.Mesh(
      seamGeo,
      ms.isViolet ? mineralSeamVioletMat : mineralSeamTealMat,
    );
    seamMesh.position.set(ms.x, ms.y, ms.z);
    seamMesh.rotation.set(0.15, ms.ry, ms.rz);
    rockfallSealGroup.add(seamMesh);
  });

  // Subtle Restrained Mineral Glow PointLight inside the Deep Rockfall Seal
  const rockfallSeamLight = new THREE.PointLight(0x2dd4bf, 0.48, 6.5, 2.0);
  rockfallSeamLight.position.set(0.0, 1.45, -0.65);
  rockfallSealGroup.add(rockfallSeamLight);

  // Solid Barrier Colliders Across the Rockfall Seal at world Z ≈ 121.3
  colliders.push(
    { x: 35 - 2.35 - 1.1, z: 110 + 11.3, radius: 1.35 },
    { x: 35 - 2.35, z: 110 + 11.25, radius: 1.45 },
    { x: 35 - 2.35 + 1.1, z: 110 + 11.3, radius: 1.35 },
  );

  // ============================================================================
  // 12. DEVELOPER-ONLY TERRAIN & PATH LIGHTING DEBUG VISUALIZATION GROUP
  // ============================================================================
  const debugGroup = new THREE.Group();
  debugGroup.name = 'PrivateWorld_DevTerrainDebugGroup';
  debugGroup.visible = false;
  group.add(debugGroup);

  debugGroup.add(pathLighting.debugGroup);

  const beaconPillarGeo = trackGeo(
    new THREE.CylinderGeometry(0.45, 0.45, 42.0, 12),
  );
  beaconPillarGeo.translate(0, 21.0, 0);

  const beaconRingGeo = trackGeo(new THREE.RingGeometry(4.5, 5.6, 32));
  beaconRingGeo.rotateX(-Math.PI / 2);

  PRIVATE_WORLD_ANCHOR_LIST.forEach((anchor) => {
    const ay = getPrivateTerrainHeight(anchor.x, anchor.z);
    const beaconMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(anchor.debugColorHex),
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    const pillar = new THREE.Mesh(beaconPillarGeo, beaconMat);
    pillar.position.set(anchor.x, ay, anchor.z);

    const ring = new THREE.Mesh(beaconRingGeo, beaconMat);
    ring.position.set(anchor.x, ay + 0.35, anchor.z);

    debugGroup.add(pillar, ring);
  });

  PRIVATE_PATH_ROUTES.forEach((route) => {
    const curvePts = route.samples.map(
      (pt) =>
        new THREE.Vector3(
          pt.x,
          getPrivateTerrainHeight(pt.x, pt.z) + 0.55,
          pt.z,
        ),
    );
    const curve = new THREE.CatmullRomCurve3(curvePts, false);
    const tubeGeo = trackGeo(
      new THREE.TubeGeometry(curve, 96, 0.5, 8, false),
    );
    const tubeMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(route.debugColorHex),
        transparent: true,
        opacity: 0.82,
      }),
    );
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.name = `DebugPath_${route.id}`;
    debugGroup.add(tubeMesh);
  });

  // Highland Ridge Saddle Trail Debug Line ((26, 98) -> (0, 143))
  const saddleDebugPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const sx = 26.0 - 26.0 * t + Math.sin(t * Math.PI * 2.0) * 2.2;
    const sz = 98.0 + 45.0 * t;
    saddleDebugPts.push(
      new THREE.Vector3(sx, getPrivateTerrainHeight(sx, sz) + 0.5, sz),
    );
  }
  const saddleDebugLine = new THREE.Line(
    trackGeo(new THREE.BufferGeometry().setFromPoints(saddleDebugPts)),
    trackMat(new THREE.LineBasicMaterial({ color: 0xf43f5e })),
  );
  saddleDebugLine.name = 'DebugTrail_HighlandRidgeSaddle';
  debugGroup.add(saddleDebugLine);

  // Hidden Cave Descending Tunnel Debug Centerline ((35, 110) -> (32.65, 121.6))
  const tunnelDebugPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const smoothT = t * t * (3.0 - 2.0 * t);
    const tx = 35.0 - smoothT * 2.4;
    const tz = 110.0 + t * 11.6;
    const ty = caveBaseY - smoothT * 2.82 + 0.45;
    tunnelDebugPts.push(new THREE.Vector3(tx, ty, tz));
  }
  const tunnelDebugLine = new THREE.Line(
    trackGeo(new THREE.BufferGeometry().setFromPoints(tunnelDebugPts)),
    trackMat(new THREE.LineBasicMaterial({ color: 0xa855f7 })),
  );
  tunnelDebugLine.name = 'DebugCorridor_HiddenCaveDescendingTunnel';
  debugGroup.add(tunnelDebugLine);

  // Organic Boundary Debug Loops for Memory Garden (-35, -20) & Reflective Pond (-5, 0)
  const gardenBoundaryPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const ang = (i / 64) * Math.PI * 2;
    const r =
      25.5 +
      4.2 * Math.cos(ang * 2.0 + 0.6) +
      3.1 * Math.sin(ang * 3.0 - 0.8) +
      1.8 * Math.cos(ang * 5.0 + 1.2);
    const gx = -35.0 + Math.cos(ang) * r;
    const gz = -20.0 + Math.sin(ang) * r;
    gardenBoundaryPts.push(
      new THREE.Vector3(gx, getPrivateTerrainHeight(gx, gz) + 0.45, gz),
    );
  }
  const gardenBoundaryGeo = trackGeo(
    new THREE.BufferGeometry().setFromPoints(gardenBoundaryPts),
  );
  const gardenBoundaryLine = new THREE.Line(
    gardenBoundaryGeo,
    trackMat(new THREE.LineBasicMaterial({ color: 0x34d399 })),
  );
  gardenBoundaryLine.name = 'DebugBoundary_MemoryGarden';
  debugGroup.add(gardenBoundaryLine);

  const pondBoundaryPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const ang = (i / 64) * Math.PI * 2;
    const r = getReflectivePondShoreRadius(ang);
    const px = -5.2 + Math.cos(ang) * r * 1.14;
    const pz = -0.3 + Math.sin(ang) * r * 0.94;
    pondBoundaryPts.push(
      new THREE.Vector3(px, REFLECTIVE_POND_WATER_LEVEL + 0.25, pz),
    );
  }
  const pondBoundaryGeo = trackGeo(
    new THREE.BufferGeometry().setFromPoints(pondBoundaryPts),
  );
  const pondBoundaryLine = new THREE.Line(
    pondBoundaryGeo,
    trackMat(new THREE.LineBasicMaterial({ color: 0x38bdf8 })),
  );
  pondBoundaryLine.name = 'DebugBoundary_ReflectivePond';
  debugGroup.add(pondBoundaryLine);

  const grottoSpanX =
    RESERVED_GROTTO_VOLUME.maxX - RESERVED_GROTTO_VOLUME.minX;
  const grottoSpanY =
    RESERVED_GROTTO_VOLUME.maxY - RESERVED_GROTTO_VOLUME.minY;
  const grottoSpanZ =
    RESERVED_GROTTO_VOLUME.maxZ - RESERVED_GROTTO_VOLUME.minZ;
  const grottoBoxGeo = trackGeo(
    new THREE.BoxGeometry(grottoSpanX, grottoSpanY, grottoSpanZ),
  );
  const grottoWireMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    }),
  );
  const grottoWireMesh = new THREE.Mesh(grottoBoxGeo, grottoWireMat);
  grottoWireMesh.name = 'ReservedUndergroundGrottoVolume';
  grottoWireMesh.position.set(
    RESERVED_GROTTO_VOLUME.centerX,
    RESERVED_GROTTO_VOLUME.centerY,
    RESERVED_GROTTO_VOLUME.centerZ,
  );
  debugGroup.add(grottoWireMesh);

  let debugVisible = false;
  let vegetationVisible = true;

  return {
    group,
    colliders,
    setDebugVisible(visible: boolean) {
      debugVisible = visible;
      debugGroup.visible = visible;
      pathLighting.debugGroup.visible = visible;
    },
    isDebugVisible() {
      return debugVisible;
    },
    setVegetationVisible(visible: boolean) {
      vegetationVisible = visible;
      vegetationGroup.visible = visible;
    },
    isVegetationVisible() {
      return vegetationVisible;
    },
    getPathLightingTelemetry() {
      return pathLighting.getTelemetry();
    },
    resetPathLighting() {
      pathLighting.reset();
    },
    update(
      delta: number,
      elapsedTime: number,
      playerPos: THREE.Vector3,
      playerVel: THREE.Vector3,
    ) {
      oceanUniforms.uTime.value = elapsedTime;
      pondUniforms.uTime.value = elapsedTime;
      gateHeartCrest.rotation.y = elapsedTime * 0.65;

      // Subtle breathing pulse on the Hidden Cave rockfall mineral seams
      const seamPulse = 0.95 + Math.sin(elapsedTime * 1.8) * 0.25;
      mineralSeamTealMat.emissiveIntensity = 1.05 * seamPulse;
      mineralSeamVioletMat.emissiveIntensity =
        1.05 * (0.95 + Math.cos(elapsedTime * 1.5) * 0.25);

      // Update Reactive Grounded Bioluminescent Mushrooms & Land Glow
      pathLighting.update(delta, elapsedTime, playerPos, playerVel);
    },
    dispose() {
      pathLighting.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
