import * as THREE from 'three';
import {
  fbm2D,
  getHeartIslandMask,
  getPathWeight,
  getTerrainHeight,
  noise2D,
} from './terrainMath';

export interface IslandTerrainBundle {
  group: THREE.Group;
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

const TERRAIN_SPAN_X = 440;
const TERRAIN_SPAN_Z = 480;
const TERRAIN_CENTER_Z = 35;
const WATER_SPAN = 880;

function createMicroGrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e8ece6';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = noise2D(x * 0.25, y * 0.25);
      const n2 = noise2D(x * 0.75 + 31, y * 0.75 + 17);
      const grain = Math.floor(236 + (n1 * 11 + n2 * 7));
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
  texture.repeat.set(84, 112);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createCoastalFoamTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1);
      const v = 1.0 - iy / (size - 1);
      const wx = (u - 0.5) * WATER_SPAN;
      const wz = TERRAIN_CENTER_Z + (v - 0.5) * WATER_SPAN;

      const mask = getHeartIslandMask(wx, wz);
      const h = getTerrainHeight(wx, wz);

      const shallow = THREE.MathUtils.clamp(1.0 - Math.abs(h) / 4.2, 0, 1);
      const foam =
        mask > -0.06 && mask < 0.04
          ? THREE.MathUtils.clamp(1.0 - Math.abs(mask) / 0.055, 0, 1)
          : 0;

      const idx = (iy * size + ix) * 4;
      data[idx] = Math.round(shallow * 255);
      data[idx + 1] = Math.round(foam * 255);
      data[idx + 2] = 0;
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

export function createIslandTerrain(
  renderer: THREE.WebGLRenderer,
): IslandTerrainBundle {
  const group = new THREE.Group();
  group.name = 'HeartIslandTerrainGroup';

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const microGrainTex = createMicroGrainTexture(maxAniso);
  const coastalTex = createCoastalFoamTexture();

  // 1. Displaced Island Terrain Mesh covering Central Plaza, Magical Village, Railway & Castle Hill
  const terrainGeo = new THREE.PlaneGeometry(
    TERRAIN_SPAN_X,
    TERRAIN_SPAN_Z,
    260,
    340,
  );
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, TERRAIN_CENTER_Z);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const vertexCount = posAttr.count;

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);
  }

  terrainGeo.computeVertexNormals();

  const normAttr = terrainGeo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(vertexCount * 3);

  const cSeabed = new THREE.Color('#194a5e');
  const cWetSand = new THREE.Color('#d2b486');
  const cDrySand = new THREE.Color('#f2dfb6');
  const cLushGrass = new THREE.Color('#4d9e54');
  const cSunlitMeadow = new THREE.Color('#6db85c');
  const cHighlandGrass = new THREE.Color('#3f7d52');
  const cAlpineHeather = new THREE.Color('#5a6b5c');
  const cCliffRock = new THREE.Color('#4a4e58');
  const cBasaltCrag = new THREE.Color('#343742');
  const cScenicPath = new THREE.Color('#d9c39e');
  const cPathEdge = new THREE.Color('#b59f79');
  const tempColor = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const ny = normAttr.getY(i);

    const nPatch = fbm2D(vx * 0.035 + 7.2, vz * 0.035 - 3.4, 3) * 0.5 + 0.5;
    const pathWeight = getPathWeight(vx, vz);

    if (vy < -0.2) {
      const t = THREE.MathUtils.clamp((vy + 4.5) / 4.3, 0, 1);
      tempColor.lerpColors(cSeabed, cWetSand, t);
    } else if (vy < 0.75) {
      const t = THREE.MathUtils.clamp((vy + 0.2) / 0.95, 0, 1);
      tempColor.lerpColors(cWetSand, cDrySand, t);
    } else if (vy < 2.25) {
      const t = THREE.MathUtils.clamp((vy - 0.75) / 1.5, 0, 1);
      tempColor.copy(cLushGrass).lerp(cSunlitMeadow, nPatch * 0.65);
      tempColor.lerpColors(cDrySand, tempColor, t * t);
    } else {
      tempColor.lerpColors(cLushGrass, cSunlitMeadow, nPatch * 0.75);
      if (vy > 11.0) {
        const highT = THREE.MathUtils.clamp((vy - 11.0) / 16.0, 0, 1);
        const highlandTarget =
          vx < -20 || vz > 240 ? cAlpineHeather : cHighlandGrass;
        tempColor.lerp(highlandTarget, highT * 0.8);
      }
    }

    if (pathWeight > 0.01 && vy > 1.2) {
      const pathTint = tempColor
        .clone()
        .lerpColors(cPathEdge, cScenicPath, pathWeight);
      tempColor.lerp(pathTint, pathWeight * 0.88);
    }

    const slopeFactor = THREE.MathUtils.clamp((0.83 - ny) / 0.28, 0, 1);
    if (slopeFactor > 0.01 && vy > 0.3) {
      const rockColor =
        (vx < -25 && vz > 20) || vz > 280 ? cBasaltCrag : cCliffRock;
      tempColor.lerp(rockColor, slopeFactor * 0.92);
    }

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: microGrainTex,
    roughness: 0.86,
    metalness: 0.04,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.name = 'HeartIslandTerrain';
  group.add(terrainMesh);

  // 2. Surrounding Animated Ocean Water Plane (Y = 0.0m)
  const waterGeo = new THREE.PlaneGeometry(WATER_SPAN, WATER_SPAN, 140, 140);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, 0, TERRAIN_CENTER_Z);

  const waterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1ca3b8'),
    roughness: 0.16,
    metalness: 0.12,
    transparent: true,
    opacity: 0.88,
  });

  const waterUniforms = {
    uTime: { value: 0 },
    uCoastalMap: { value: coastalTex },
    uDeepColor: { value: new THREE.Color('#0f5e78') },
    uShallowColor: { value: new THREE.Color('#2ec4c9') },
    uFoamColor: { value: new THREE.Color('#f4fbff') },
  };

  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.uniforms.uCoastalMap = waterUniforms.uCoastalMap;
    shader.uniforms.uDeepColor = waterUniforms.uDeepColor;
    shader.uniforms.uShallowColor = waterUniforms.uShallowColor;
    shader.uniforms.uFoamColor = waterUniforms.uFoamColor;

    shader.vertexShader =
      `
      uniform float uTime;
      varying vec2 vWaterUv;
      varying vec3 vWorldPos;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vWaterUv = uv;
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float wave1 = sin(wp.x * 0.14 + uTime * 1.6) * cos(wp.z * 0.12 + uTime * 1.3) * 0.09;
        float wave2 = sin((wp.x + wp.z) * 0.25 - uTime * 2.1) * 0.04;
        transformed.y += wave1 + wave2;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform sampler2D uCoastalMap;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      varying vec2 vWaterUv;
      varying vec3 vWorldPos;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        vec4 coastSample = texture2D(uCoastalMap, vWaterUv);
        float shallowMask = coastSample.r;
        float shoreMask = coastSample.g;

        vec3 waterCol = mix(uDeepColor, uShallowColor, shallowMask);

        float lapWave = sin(shallowMask * 22.0 - uTime * 2.6) * 0.5 + 0.5;
        float foamLine = smoothstep(0.35, 0.85, shoreMask * (0.65 + 0.35 * lapWave));

        float shimmer = sin(vWorldPos.x * 0.9 + uTime * 2.0) * cos(vWorldPos.z * 0.9 - uTime * 1.7);
        waterCol += vec3(0.06, 0.09, 0.10) * max(0.0, shimmer) * shallowMask;

        diffuseColor.rgb = mix(waterCol, uFoamColor, foamLine * 0.82);
        `,
      );
  };

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.0;
  waterMesh.receiveShadow = true;
  waterMesh.name = 'HeartIslandOcean';
  group.add(waterMesh);

  // 3. Distant Outer Sea Skirt
  const outerSeaGeo = new THREE.RingGeometry(420, 1450, 64);
  outerSeaGeo.rotateX(-Math.PI / 2);
  outerSeaGeo.translate(0, 0, TERRAIN_CENTER_Z);
  const outerSeaMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f5e78'),
    roughness: 0.25,
    metalness: 0.1,
  });
  const outerSeaMesh = new THREE.Mesh(outerSeaGeo, outerSeaMat);
  outerSeaMesh.position.y = -0.08;
  group.add(outerSeaMesh);

  return {
    group,
    terrainMesh,
    waterMesh,
    update(elapsedTime: number) {
      waterUniforms.uTime.value = elapsedTime;
    },
    dispose() {
      terrainGeo.dispose();
      terrainMat.dispose();
      microGrainTex.dispose();
      coastalTex.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      outerSeaGeo.dispose();
      outerSeaMat.dispose();
    },
  };
}
