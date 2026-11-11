import * as THREE from 'three';

export interface AtmosphereRevealModulation {
  active: boolean;
  envLightFactor: number; // 0..1 multiplier for sun, hemisphere & environment reflection
  pointLightFactor: number; // 0..1.35 multiplier for plaza & attraction lights
  fogDensityOverride: number | null; // custom FogExp2 density during Stage A/B clearing
  fogColorBlend: number; // 0 = deep twilight veil (#120e1c), 1 = golden hour (#e8b89a)
  skyVisibilityFactor: number; // 0..1 controls sky dome & horizon mountain emergence
}

export interface AtmosphereBundle {
  registerPointLights: () => void;
  getActivePointLightCount: () => number;
  setRevealModulation: (mod: Partial<AtmosphereRevealModulation>) => void;
  setPrivateWorldMoonlightMode: (
    enabled: boolean,
    topDownDebug?: boolean,
  ) => void;
  update: (
    playerPos: THREE.Vector3,
    delta: number,
    elapsedTime: number,
  ) => void;
  setShadowResolution: (res: 1024 | 2048) => void;
  dispose: () => void;
}

interface TrackedPointLight {
  light: THREE.PointLight | THREE.SpotLight;
  baseIntensity: number;
  worldPos: THREE.Vector3;
  distSq: number;
}

const MAX_ACTIVE_POINT_LIGHTS = 10;
const POINT_LIGHT_CULL_RADIUS = 65.0;
const POINT_LIGHT_CULL_RADIUS_SQ = POINT_LIGHT_CULL_RADIUS * POINT_LIGHT_CULL_RADIUS;

/**
 * M6 Golden-Hour Lighting & Atmosphere System:
 * - Sun at elevation 28°, azimuth 220°: dir = (-0.567, 0.469, -0.676), #ffd9a0, intensity 2.2
 * - Single shadow-casting DirectionalLight, 2048x2048 shadow map, orthographic frustum ±80m
 *   snapped to texel grid only when player moves > 2.0m
 * - Dynamic PointLight Distance Culler: caps active PointLights to <= 10 within 65m
 * - HemisphereLight(sky = #ffcaa6, ground = #3a2d4c, intensity = 0.65)
 * - FogExp2(#e8b89a, 0.0018) so the Castle at 280m retains ~60% contrast
 */
export function createAtmosphereSystem(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): AtmosphereBundle {
  // 1. M6 Exponential Fog: FogExp2(#e8b89a, 0.0018)
  const baseFogColor = new THREE.Color('#e8b89a');
  const fog = new THREE.FogExp2(baseFogColor, 0.0018);
  scene.fog = fog;
  scene.background = baseFogColor;

  // 2. M6 Golden-Hour Sun Direction (elevation 28°, azimuth 220°)
  const elevRad = THREE.MathUtils.degToRad(28.0);
  const azimRad = THREE.MathUtils.degToRad(220.0);
  const sunDirection = new THREE.Vector3(
    Math.cos(elevRad) * Math.sin(azimRad), // -0.567
    Math.sin(elevRad), // +0.469
    Math.cos(elevRad) * Math.cos(azimRad), // -0.676
  ).normalize();

  // 3. Procedural Golden-Hour Sunset Sky Dome
  const skyGeo = new THREE.SphereGeometry(950, 40, 28);
  const skyUniforms = {
    uZenithColor: { value: new THREE.Color('#223b6e') },
    uMidSkyColor: { value: new THREE.Color('#845882') },
    uHorizonColor: { value: new THREE.Color('#e8b89a') },
    uSunColor: { value: new THREE.Color('#ffd9a0') },
    uSunDir: { value: sunDirection },
    uStarAlpha: { value: 0.22 },
    uRevealBrightness: { value: 1.0 },
    uTime: { value: 0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uStarAlpha;
      uniform float uRevealBrightness;
      uniform float uTime;
      varying vec3 vWorldDirection;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDirection);
        float elevation = clamp(dir.y, 0.0, 1.0);

        vec3 upperBlend = mix(uMidSkyColor, uZenithColor, smoothstep(0.16, 0.72, elevation));
        vec3 skyCol = mix(uHorizonColor, upperBlend, smoothstep(0.0, 0.28, elevation)) * 0.82;

        float sunAlignment = max(0.0, dot(dir, uSunDir));
        float wideScatter = pow(sunAlignment, 3.5) * 0.18;
        float sunHalo = pow(sunAlignment, 18.0) * 0.36;
        float sunCore = smoothstep(0.9968, 0.9995, sunAlignment);
        skyCol += vec3(0.95, 0.62, 0.34) * wideScatter;

        if (dir.y > 0.02) {
          vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.45;
          float n1 = fbm(cloudUv + vec2(uTime * 0.008, -uTime * 0.005));
          float n2 = fbm(cloudUv * 2.1 - vec2(uTime * 0.012, 0.0));
          float cloudDensity = smoothstep(0.42, 0.78, n1 * 0.7 + n2 * 0.3) * smoothstep(0.02, 0.28, dir.y);

          vec3 cloudShadow = mix(vec3(0.38, 0.28, 0.48), uMidSkyColor * 0.78, 0.5);
          vec3 cloudLit = mix(vec3(0.78, 0.64, 0.52), vec3(0.84, 0.75, 0.62), pow(sunAlignment, 2.0));
          vec3 cloudCol = mix(cloudShadow, cloudLit, smoothstep(0.35, 0.72, n2 + sunAlignment * 0.35));
          skyCol = mix(skyCol, cloudCol, cloudDensity * 0.56);
        }

        skyCol += uSunColor * (sunHalo + sunCore * 1.1);

        if (dir.y > 0.18 && uStarAlpha > 0.01) {
          vec2 starGrid = floor(dir.xz / (dir.y + 0.1) * 260.0);
          float starSeed = hash(starGrid);
          if (starSeed > 0.994) {
            float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + starSeed * 100.0);
            float starMask = smoothstep(0.18, 0.55, dir.y) * uStarAlpha * twinkle;
            skyCol += vec3(0.85, 0.92, 1.0) * starMask;
          }
        }

        vec3 twilightVeil = vec3(0.07, 0.055, 0.11);
        skyCol = mix(twilightVeil, skyCol, clamp(uRevealBrightness, 0.0, 1.0));

        gl_FragColor = vec4(skyCol, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'HeartIslandSkyDome';
  scene.add(skyMesh);

  // 4. Bake Sunset Sky Dome into PMREM Environment Reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(skyMesh.clone());
  const envTexture = pmremGenerator.fromScene(envScene, 0.025).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.68;
  pmremGenerator.dispose();

  // 5. Distant Horizon Alpine Mountain Range Ring (r = 560..620m around island center (0, 140))
  const mountainRingGroup = new THREE.Group();
  mountainRingGroup.name = 'DistantHorizonMountains';
  scene.add(mountainRingGroup);

  const mountainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a5475'),
    roughness: 0.88,
    metalness: 0.05,
    fog: true,
  });
  const snowPeakMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f7d9c4'),
    roughness: 0.65,
    metalness: 0.05,
    fog: true,
  });
  const mountainGeos: THREE.BufferGeometry[] = [];

  const peakCount = 32;
  for (let i = 0; i < peakCount; i++) {
    const ang = (i / peakCount) * Math.PI * 2;
    const dist = 580 + (i % 3) * 45;
    const mx = Math.sin(ang) * dist;
    const mz = 140 + Math.cos(ang) * dist;
    const mh = 65 + ((i * 17) % 55);
    const mr = 48 + ((i * 13) % 28);

    const mGeo = new THREE.ConeGeometry(mr, mh, 7);
    mGeo.translate(mx, mh * 0.42 - 6, mz);
    const mMesh = new THREE.Mesh(
      mGeo,
      i % 3 === 0 ? snowPeakMat : mountainMat,
    );
    mountainRingGroup.add(mMesh);
    mountainGeos.push(mGeo);
  }

  // 6. M6 Golden-Hour Directional Sun Light: #ffd9a0, intensity 2.2, 2048 shadow map, ±80m frustum
  let currentShadowRes: 1024 | 2048 = 2048;
  const sunOffset = sunDirection.clone().multiplyScalar(150);
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sunLight.position.copy(sunOffset);
  sunLight.castShadow = !isSoftwareGl;

  if (!isSoftwareGl) {
    sunLight.shadow.mapSize.width = currentShadowRes;
    sunLight.shadow.mapSize.height = currentShadowRes;
    const d = 80; // ±80m orthographic frustum per M6 spec
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 320;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.025;
  }

  scene.add(sunLight);
  scene.add(sunLight.target);

  // 7. M6 HemisphereLight(sky = #ffcaa6, ground = #3a2d4c, intensity = 0.65)
  const hemiLight = new THREE.HemisphereLight(0xffcaa6, 0x3a2d4c, 0.65);
  hemiLight.position.set(0, 80, 0);
  scene.add(hemiLight);

  function setShadowResolution(res: 1024 | 2048) {
    if (isSoftwareGl || currentShadowRes === res) return;
    currentShadowRes = res;
    sunLight.shadow.mapSize.width = res;
    sunLight.shadow.mapSize.height = res;
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  }

  const surfaceFogColor = new THREE.Color('#e8b89a');
  const revealTwilightFogColor = new THREE.Color('#130f1e');
  const blendedSurfaceFogColor = new THREE.Color('#e8b89a');
  const undergroundVoidColor = new THREE.Color('#01030a');
  const privateMoonlightFogColor = new THREE.Color('#1e2944');

  let privateMoonlightMode = false;
  let privateTopDownDebug = false;

  const revealMod: AtmosphereRevealModulation = {
    active: false,
    envLightFactor: 1.0,
    pointLightFactor: 1.0,
    fogDensityOverride: null,
    fogColorBlend: 1.0,
    skyVisibilityFactor: 1.0,
  };

  // 8. Dynamic PointLight & SpotLight Distance Culler (35 lights -> max 10 active)
  const trackedLights: TrackedPointLight[] = [];
  let activePointLightCount = 0;
  let lightCullTimer = 0.15;
  const lastShadowSnapPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  const _spawnPos = new THREE.Vector3(-16.5, 2.5, 16.0);

  function evaluatePointLightCulling(playerPos: THREE.Vector3) {
    const n = trackedLights.length;
    if (n === 0) return;

    if (privateMoonlightMode) {
      for (let i = 0; i < n; i++) {
        trackedLights[i].light.visible = false;
      }
      activePointLightCount = 0;
      return;
    }

    const effectiveRadius = revealMod.active ? 165.0 : POINT_LIGHT_CULL_RADIUS;
    const effectiveRadiusSq = effectiveRadius * effectiveRadius;
    const ptScale = revealMod.active ? revealMod.pointLightFactor : 1.0;

    for (let i = 0; i < n; i++) {
      const item = trackedLights[i];
      const e = item.light.matrixWorld.elements;
      item.worldPos.set(e[12], e[13], e[14]);
      const dx = item.worldPos.x - playerPos.x;
      const dy = item.worldPos.y - playerPos.y;
      const dz = item.worldPos.z - playerPos.z;
      item.distSq = dx * dx + dy * dy + dz * dz;
    }

    trackedLights.sort((a, b) => a.distSq - b.distSq);

    let activeCount = 0;
    for (let i = 0; i < n; i++) {
      const item = trackedLights[i];
      if (
        activeCount < MAX_ACTIVE_POINT_LIGHTS &&
        item.distSq <= effectiveRadiusSq &&
        item.baseIntensity > 0.01 &&
        ptScale > 0.005
      ) {
        const dist = Math.sqrt(item.distSq);
        const fade = THREE.MathUtils.clamp(
          1.0 - dist / effectiveRadius,
          0.0,
          1.0,
        );
        item.light.visible = true;
        item.light.intensity = item.baseIntensity * fade * ptScale;
        activeCount++;
      } else {
        item.light.visible = false;
      }
    }
    activePointLightCount = activeCount;
  }

  function registerPointLights() {
    trackedLights.length = 0;
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if (obj instanceof THREE.PointLight || obj instanceof THREE.SpotLight) {
        if (obj.userData?.skipAtmosphereCull) {
          return;
        }
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        const baseIntensity = obj.intensity > 0 ? obj.intensity : 2.2;
        obj.userData.baseIntensity = baseIntensity;
        obj.userData.worldPos = worldPos;
        obj.castShadow = false; // Ensure point lights never allocate cube shadow maps
        trackedLights.push({
          light: obj,
          baseIntensity,
          worldPos,
          distSq: 0,
        });
      }
    });
    evaluatePointLightCulling(_spawnPos);
  }

  return {
    registerPointLights,
    getActivePointLightCount: () => activePointLightCount,
    setRevealModulation(mod: Partial<AtmosphereRevealModulation>) {
      const wasActive = revealMod.active;
      Object.assign(revealMod, mod);
      if (wasActive && !revealMod.active) {
        revealMod.envLightFactor = 1.0;
        revealMod.pointLightFactor = 1.0;
        revealMod.fogDensityOverride = null;
        revealMod.fogColorBlend = 1.0;
        revealMod.skyVisibilityFactor = 1.0;
        skyUniforms.uRevealBrightness.value = 1.0;
        mountainRingGroup.position.y = 0;
        evaluatePointLightCulling(_spawnPos);
      }
    },
    setPrivateWorldMoonlightMode(enabled: boolean, topDownDebug = false) {
      privateMoonlightMode = enabled;
      privateTopDownDebug = topDownDebug;
      if (enabled) {
        skyUniforms.uZenithColor.value.set('#141e38');
        skyUniforms.uMidSkyColor.value.set('#2a365c');
        skyUniforms.uHorizonColor.value.set('#4c436b');
        skyUniforms.uSunColor.value.set('#e8dcf8');
        skyUniforms.uStarAlpha.value = 0.78;
        skyUniforms.uRevealBrightness.value = 1.0;
        sunLight.color.set('#e8dcf8');
        hemiLight.color.set('#8494c4');
        hemiLight.groundColor.set('#34453e');
        mountainRingGroup.visible = false;
      } else {
        skyUniforms.uZenithColor.value.set('#223b6e');
        skyUniforms.uMidSkyColor.value.set('#845882');
        skyUniforms.uHorizonColor.value.set('#e8b89a');
        skyUniforms.uSunColor.value.set('#ffd9a0');
        skyUniforms.uStarAlpha.value = 0.22;
        skyUniforms.uRevealBrightness.value = 1.0;
        sunLight.color.set('#ffd9a0');
        hemiLight.color.set('#ffcaa6');
        hemiLight.groundColor.set('#3a2d4c');
        mountainRingGroup.visible = true;
      }
    },
    update(playerPos: THREE.Vector3, delta: number, elapsedTime: number) {
      skyUniforms.uTime.value = elapsedTime;
      skyMesh.position.set(playerPos.x, 0, playerPos.z);

      // Periodic Dynamic PointLight Distance Culler (runs every 0.15s, or every frame during reveal Stage C)
      lightCullTimer += delta;
      if (lightCullTimer >= (revealMod.active ? 0.05 : 0.15)) {
        lightCullTimer = 0;
        evaluatePointLightCulling(playerPos);
      }

      if (privateMoonlightMode) {
        sunLight.intensity = 2.35;
        hemiLight.intensity = 1.28;
        scene.environmentIntensity = 0.88;
        fog.color.copy(privateMoonlightFogColor);
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(privateMoonlightFogColor);
        }
        fog.density = privateTopDownDebug ? 0.00018 : 0.00062;
        skyMesh.visible = true;
        mountainRingGroup.visible = false;

        if (playerPos.distanceToSquared(lastShadowSnapPos) > 4.0) {
          lastShadowSnapPos.copy(playerPos);
          const texelWorldSize = 160.0 / currentShadowRes;
          const snappedX =
            Math.round(playerPos.x / texelWorldSize) * texelWorldSize;
          const snappedZ =
            Math.round(playerPos.z / texelWorldSize) * texelWorldSize;
          sunLight.position.set(
            snappedX + sunOffset.x,
            sunOffset.y,
            snappedZ + sunOffset.z,
          );
          sunLight.target.position.set(snappedX, 0, snappedZ);
          sunLight.target.updateMatrixWorld();
        }
        return;
      }

      // Smoothly transition surface golden-hour atmosphere to pitch-dark void when descending underground
      const surfaceFactor = THREE.MathUtils.smoothstep(
        playerPos.y,
        -11.0,
        2.2,
      );
      const envScale = revealMod.active ? revealMod.envLightFactor : 1.0;
      const fogBlend = revealMod.active ? revealMod.fogColorBlend : 1.0;
      const skyVis = revealMod.active ? revealMod.skyVisibilityFactor : 1.0;

      sunLight.intensity = 2.2 * surfaceFactor * envScale;
      hemiLight.intensity = 0.65 * surfaceFactor * envScale;
      scene.environmentIntensity = 0.68 * surfaceFactor * envScale;

      blendedSurfaceFogColor.lerpColors(
        revealTwilightFogColor,
        surfaceFogColor,
        fogBlend,
      );
      fog.color.lerpColors(
        undergroundVoidColor,
        blendedSurfaceFogColor,
        surfaceFactor,
      );
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(fog.color);
      }

      const targetFogDensity =
        revealMod.active && revealMod.fogDensityOverride !== null
          ? revealMod.fogDensityOverride
          : 0.0018;
      fog.density = THREE.MathUtils.lerp(
        0.00015,
        targetFogDensity,
        surfaceFactor,
      );

      skyUniforms.uRevealBrightness.value = skyVis;
      skyMesh.visible = surfaceFactor > 0.01 && skyVis > 0.01;
      mountainRingGroup.visible = surfaceFactor > 0.01 && skyVis > 0.05;
      mountainRingGroup.position.y = (1.0 - skyVis) * -35.0;

      // M6 Shadow camera tracking player snapped to texel grid ONLY when player moved > 2.0m (distSq > 4.0)
      if (playerPos.distanceToSquared(lastShadowSnapPos) > 4.0) {
        lastShadowSnapPos.copy(playerPos);
        const texelWorldSize = 160.0 / currentShadowRes;
        const snappedX =
          Math.round(playerPos.x / texelWorldSize) * texelWorldSize;
        const snappedZ =
          Math.round(playerPos.z / texelWorldSize) * texelWorldSize;

        sunLight.position.set(
          snappedX + sunOffset.x,
          sunOffset.y,
          snappedZ + sunOffset.z,
        );
        sunLight.target.position.set(snappedX, 0, snappedZ);
        sunLight.target.updateMatrixWorld();
      }
    },
    setShadowResolution,
    dispose() {
      envTexture.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      mountainMat.dispose();
      snowPeakMat.dispose();
      mountainGeos.forEach((g) => g.dispose());
      scene.remove(
        skyMesh,
        mountainRingGroup,
        sunLight,
        sunLight.target,
        hemiLight,
      );
    },
  };
}
