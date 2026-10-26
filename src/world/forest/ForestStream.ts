/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker, createBeveledBoxGeometry } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import {
  FOREST_LAKE_LOCAL_POS,
  FOREST_SEED,
  HEARTWOOD_SANCTUARY_LOCAL_POS,
  HIDDEN_POOL_LOCAL_POS,
  castleLocalToWorld,
  getTerrainHeight,
  mulberry32,
} from '../terrainMath';
import { ForestAudioSynthesizer } from './ForestAudio';
import { mergeCompatibleGeometries as mergeGeometries } from './utils';

export interface ForestStreamBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  streamMidWorldPos: THREE.Vector3;
  waterfallWorldPos: THREE.Vector3;
  bridgeWorldPos: THREE.Vector3;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
    audio: ForestAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

/**
 * Custom GLSL Shader for Natural Woodland Stream Water
 * - Gentle ripples and flowing UV motion
 * - Fresnel edge transparency and soft emerald-cyan woodland tint
 * - Restrained specular highlight
 */
const ForestWaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color('#042f2e') },
    uColorShallow: { value: new THREE.Color('#0d9488') },
    uColorFoam: { value: new THREE.Color('#ccfbf1') },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);

      // Subtle surface wave displacement along the stream
      float wave = sin(position.x * 2.8 + uTime * 2.1) * cos(position.z * 2.2 - uTime * 1.7) * 0.022;
      vec3 pos = position + vec3(0.0, wave, 0.0);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 2.2);

      // Flowing ripple bands along stream UV length
      float flow1 = sin(vUv.x * 24.0 - uTime * 2.4 + sin(vUv.y * 12.0) * 1.5);
      float flow2 = cos(vUv.x * 32.0 + uTime * 1.8 + cos(vUv.y * 16.0) * 1.2);
      float ripple = (flow1 * 0.5 + flow2 * 0.5) * 0.5 + 0.5;

      vec3 waterColor = mix(uColorDeep, uColorShallow, ripple * 0.45 + fresnel * 0.35);

      // Foam shimmer on higher ripple crests
      if (ripple > 0.82) {
        waterColor = mix(waterColor, uColorFoam, (ripple - 0.82) * 2.8);
      }

      // Restrained specular highlight
      vec3 lightDir = normalize(vec3(-0.4, 0.8, -0.45));
      vec3 halfVec = normalize(lightDir + viewDir);
      float spec = pow(max(0.0, dot(vNormal, halfVec)), 32.0) * 0.45;
      waterColor += vec3(spec);

      float alpha = 0.74 + fresnel * 0.18;
      gl_FragColor = vec4(waterColor, alpha);
    }
  `,
};

/**
 * Builds Phase F3 System 3: Forest Stream, Small Waterfall & Old Forest Bridge.
 * - Stream flows ~32m from rocky knoll spring down past ruins
 * - Small 1.4m waterfall cascading over mossy tiered rock shelf into splash plunge pool
 * - Walkable Old Forest Bridge with aged timber planks and stone abutments
 */
export function createForestStream(): ForestStreamBundle {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'ForestStream';
  const colliders: CircleCollider[] = [];

  const rand = mulberry32(FOREST_SEED + 5300);

  // 1. Define Stream Spline Path in Wizarding School Local Coordinates
  const streamLocalNodes: Array<{ localX: number; localZ: number; width: number }> = [
    { localX: 73.0, localZ: -2.8, width: 1.3 }, // Spring under crag
    { localX: 69.5, localZ: -4.2, width: 1.5 },
    { localX: 66.8, localZ: -5.6, width: 1.7 }, // Waterfall Ledge (Top)
    { localX: 64.6, localZ: -7.0, width: 2.2 }, // Waterfall Plunge Pool (Bottom)
    { localX: 62.4, localZ: -8.4, width: 1.9 },
    { localX: 60.2, localZ: -9.8, width: 1.8 }, // Old Bridge Crossing
    { localX: 57.6, localZ: -11.6, width: 1.6 },
    { localX: 54.8, localZ: -13.8, width: 1.7 },
    { localX: 53.6, localZ: -14.8, width: 1.6 },
    { localX: 52.6, localZ: -15.6, width: 1.5 }, // Gently enters the northeast edge of the Forest Lake
  ];

  // Convert nodes to world coordinates
  const streamWorldPoints = streamLocalNodes.map((n) => {
    const w = castleLocalToWorld(n.localX, n.localZ);
    const wy = getTerrainHeight(w.x, w.z);
    return {
      x: w.x,
      y: wy,
      z: w.z,
      width: n.width,
    };
  });

  const waterfallNode = streamWorldPoints[2];
  const waterfallWorldPos = new THREE.Vector3(
    waterfallNode.x,
    waterfallNode.y,
    waterfallNode.z,
  );

  const bridgeNode = streamWorldPoints[5];
  const bridgeWorldPos = new THREE.Vector3(
    bridgeNode.x,
    bridgeNode.y + 0.35,
    bridgeNode.z,
  );

  const streamMidNode = streamWorldPoints[4];
  const streamMidWorldPos = new THREE.Vector3(
    streamMidNode.x,
    streamMidNode.y,
    streamMidNode.z,
  );

  // 2. Generate Continuous Stream Water Surface Geometry (Strip of Quad Segments)
  const streamSegments = 40;
  const waterPositions: number[] = [];
  const waterUvs: number[] = [];
  const waterIndices: number[] = [];

  const splinePoints = streamWorldPoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(splinePoints);

  const _pt = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _side = new THREE.Vector3();

  for (let i = 0; i <= streamSegments; i++) {
    const u = i / streamSegments;
    curve.getPointAt(u, _pt);
    curve.getTangentAt(u, _tan).normalize();
    _side.crossVectors(_tan, _up).normalize();

    // Width interpolation
    const widthIdx = u * (streamLocalNodes.length - 1);
    const wFloor = Math.floor(widthIdx);
    const wCeil = Math.min(streamLocalNodes.length - 1, wFloor + 1);
    const wFrac = widthIdx - wFloor;
    const curWidth = THREE.MathUtils.lerp(
      streamLocalNodes[wFloor].width,
      streamLocalNodes[wCeil].width,
      wFrac,
    );
    const halfW = curWidth * 0.5;

    // Slight elevation below bank level so water sits nicely inside the bed
    const leftX = _pt.x - _side.x * halfW;
    const leftZ = _pt.z - _side.z * halfW;
    const leftY = _pt.y + 0.08;

    const rightX = _pt.x + _side.x * halfW;
    const rightZ = _pt.z + _side.z * halfW;
    const rightY = _pt.y + 0.08;

    waterPositions.push(leftX, leftY, leftZ);
    waterPositions.push(rightX, rightY, rightZ);

    waterUvs.push(u, 0);
    waterUvs.push(u, 1);

    if (i < streamSegments) {
      const rowA = i * 2;
      const rowB = (i + 1) * 2;
      waterIndices.push(rowA, rowB, rowA + 1);
      waterIndices.push(rowA + 1, rowB, rowB + 1);
    }
  }

  const waterGeo = tracker.trackGeo(new THREE.BufferGeometry());
  waterGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(waterPositions, 3),
  );
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
  waterGeo.setIndex(waterIndices);
  waterGeo.computeVertexNormals();

  const waterMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ForestWaterShader.uniforms),
      vertexShader: ForestWaterShader.vertexShader,
      fragmentShader: ForestWaterShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'ForestStreamWater';
  group.add(waterMesh);

  // 3. Exposed Riverbed Stones, Pebbles & Mossy Riverbank Rocks
  const riverStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#44403c'),
      roughness: 0.38, // Wet river stone specular response
      metalness: 0.05,
    }),
  );

  const bankMossMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d4022'),
      roughness: 0.94,
      metalness: 0.02,
    }),
  );

  const riverStoneGeos: THREE.BufferGeometry[] = [];
  const bankMossGeos: THREE.BufferGeometry[] = [];
  const lakeCenterWorld = castleLocalToWorld(
    FOREST_LAKE_LOCAL_POS.localX,
    FOREST_LAKE_LOCAL_POS.localZ,
  );

  for (let s = 0; s < 34; s++) {
    const u = s / 38;
    curve.getPointAt(u, _pt);
    curve.getTangentAt(u, _tan).normalize();
    _side.crossVectors(_tan, _up).normalize();

    if (
      Math.hypot(
        (_pt.x - lakeCenterWorld.x) / 1.22,
        (_pt.z - lakeCenterWorld.z) / 0.95,
      ) < 9.8
    ) {
      continue;
    }

    // Submerged riverbed stones
    if (s % 2 === 0) {
      const sideOffset = (rand() - 0.5) * 0.85;
      const rx = _pt.x + _side.x * sideOffset;
      const rz = _pt.z + _side.z * sideOffset;
      const ry = _pt.y + 0.02;

      const rSize = 0.16 + rand() * 0.22;
      const stoneGeo = new THREE.SphereGeometry(rSize, 7, 6);
      stoneGeo.scale(1.2, 0.45, 1.1);
      stoneGeo.rotateY(rand() * Math.PI);
      stoneGeo.translate(rx, ry, rz);
      riverStoneGeos.push(stoneGeo);
    }

    // Mossy bank boundary rocks
    const sideSign = s % 2 === 0 ? 1 : -1;
    const bx = _pt.x + _side.x * sideSign * (0.95 + rand() * 0.35);
    const bz = _pt.z + _side.z * sideSign * (0.95 + rand() * 0.35);
    const by = getTerrainHeight(bx, bz);

    const bSize = 0.28 + rand() * 0.38;
    const bankRock = new THREE.DodecahedronGeometry(bSize, 1);
    bankRock.scale(1.2, 0.65, 1.1);
    bankRock.translate(bx, by + bSize * 0.2, bz);
    riverStoneGeos.push(bankRock);

    const mossCap = new THREE.DodecahedronGeometry(bSize * 0.78, 1);
    mossCap.scale(1.1, 0.32, 1.05);
    mossCap.translate(bx, by + bSize * 0.42, bz);
    bankMossGeos.push(mossCap);
  }

  // ============================================================================
  // 4. SMALL NATURAL WATERFALL (1.4m Cascade over Tiered Rock Shelf)
  // ============================================================================
  const wfTop = streamWorldPoints[2];
  const wfBot = streamWorldPoints[3];

  // Waterfall rock shelf slabs
  for (let r = 0; r < 4; r++) {
    const rx = THREE.MathUtils.lerp(wfTop.x, wfBot.x, r / 3);
    const rz = THREE.MathUtils.lerp(wfTop.z, wfBot.z, r / 3);
    const ry = THREE.MathUtils.lerp(wfTop.y, wfBot.y, r / 3);

    const shelf = createBeveledBoxGeometry(2.4, 0.45, 1.2, 0.08);
    shelf.rotateY(0.55);
    shelf.translate(rx, ry + 0.1, rz);
    riverStoneGeos.push(shelf);
  }

  // Cascading water curtain geometry
  const cascadeGeo = new THREE.PlaneGeometry(1.8, 1.6, 6, 8);
  cascadeGeo.rotateX(-Math.PI * 0.32);
  cascadeGeo.translate(
    (wfTop.x + wfBot.x) * 0.5,
    (wfTop.y + wfBot.y) * 0.5 + 0.18,
    (wfTop.z + wfBot.z) * 0.5,
  );

  const cascadeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#99f6e4'),
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.78,
      emissive: new THREE.Color('#14b8a6'),
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  const cascadeMesh = new THREE.Mesh(cascadeGeo, cascadeMat);
  group.add(cascadeMesh);

  // Waterfall Mist & Splash Foam Particles (24 points)
  const mistCount = 24;
  const mistPositions = new Float32Array(mistCount * 3);
  const mistBase: Array<{ x: number; y: number; z: number; phase: number; spread: number }> = [];

  for (let m = 0; m < mistCount; m++) {
    const mx = wfBot.x + (rand() - 0.5) * 1.5;
    const mz = wfBot.z + (rand() - 0.5) * 1.5;
    const my = wfBot.y + 0.15 + rand() * 0.85;
    mistPositions[m * 3] = mx;
    mistPositions[m * 3 + 1] = my;
    mistPositions[m * 3 + 2] = mz;
    mistBase.push({
      x: mx,
      y: my,
      z: mz,
      phase: rand() * Math.PI * 2,
      spread: 0.2 + rand() * 0.3,
    });
  }

  const mistGeo = tracker.trackGeo(new THREE.BufferGeometry());
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#ccfbf1'),
      size: 0.14,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  group.add(mistPoints);

  // ============================================================================
  // 5. OLD FOREST BRIDGE (Walkable Weathered Wood & Stone Bridge)
  // ============================================================================
  const woodPlankMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5c4033'), // Aged dark oak
      roughness: 0.92,
      metalness: 0.03,
    }),
  );

  const bridgeStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#57534e'),
      roughness: 0.94,
      metalness: 0.02,
    }),
  );

  const woodGeos: THREE.BufferGeometry[] = [];
  const bStoneGeos: THREE.BufferGeometry[] = [];

  // Bridge alignment: Crosses stream at bridgeWorldPos
  // Angle perpendicular to stream flow:
  curve.getPointAt(0.5, _pt);
  curve.getTangentAt(0.5, _tan).normalize();
  const bridgeYaw = Math.atan2(_tan.x, _tan.z) + Math.PI / 2;

  // Stone Abutments on left and right banks
  const abLeft = createBeveledBoxGeometry(1.4, 0.85, 2.6, 0.08);
  abLeft.rotateY(bridgeYaw);
  abLeft.translate(bridgeWorldPos.x - _side.x * 1.5, bridgeWorldPos.y - 0.2, bridgeWorldPos.z - _side.z * 1.5);
  bStoneGeos.push(abLeft);

  const abRight = createBeveledBoxGeometry(1.4, 0.85, 2.6, 0.08);
  abRight.rotateY(bridgeYaw);
  abRight.translate(bridgeWorldPos.x + _side.x * 1.5, bridgeWorldPos.y - 0.2, bridgeWorldPos.z + _side.z * 1.5);
  bStoneGeos.push(abRight);

  // 11 Aged Wooden Planks with Slight Arch and Irregular Gaps
  const plankCount = 11;
  const plankW = 2.4;
  const plankD = 0.24;
  const plankH = 0.09;

  for (let p = 0; p < plankCount; p++) {
    const prog = (p - (plankCount - 1) * 0.5) / ((plankCount - 1) * 0.5); // -1.0 to +1.0
    const archLift = Math.cos(prog * Math.PI * 0.5) * 0.14; // subtle graceful arch

    const px = bridgeWorldPos.x + _side.x * (prog * 1.35);
    const pz = bridgeWorldPos.z + _side.z * (prog * 1.35);
    const py = bridgeWorldPos.y + archLift;

    const plank = createBeveledBoxGeometry(plankD, plankH, plankW, 0.015);
    // Slight yaw jitter for worn handcrafted character
    plank.rotateY(bridgeYaw + (rand() - 0.5) * 0.04);
    plank.translate(px, py, pz);
    woodGeos.push(plank);
  }

  // Wooden Guardrails (Left and Right)
  for (let side = -1; side <= 1; side += 2) {
    // 3 Upright Posts per side
    for (let u = -1; u <= 1; u++) {
      const postX = bridgeWorldPos.x + _side.x * (u * 1.1) - _tan.x * side * 1.15;
      const postZ = bridgeWorldPos.z + _side.z * (u * 1.1) - _tan.z * side * 1.15;
      const postY = bridgeWorldPos.y + 0.42;

      const post = createBeveledBoxGeometry(0.12, 0.85, 0.12, 0.01);
      post.rotateY(bridgeYaw);
      post.translate(postX, postY, postZ);
      woodGeos.push(post);
    }

    // Top Handrail Beam
    const railX = bridgeWorldPos.x - _tan.x * side * 1.15;
    const railZ = bridgeWorldPos.z - _tan.z * side * 1.15;
    const railY = bridgeWorldPos.y + 0.82;

    const rail = createBeveledBoxGeometry(2.6, 0.08, 0.14, 0.015);
    rail.rotateY(bridgeYaw);
    rail.translate(railX, railY, railZ);
    woodGeos.push(rail);
  }

  // Bridge Collision: Walkable surface + Guardrail boundary colliders
  colliders.push({
    x: bridgeWorldPos.x - _tan.x * 1.2,
    z: bridgeWorldPos.z - _tan.z * 1.2,
    radius: 0.65,
  });
  colliders.push({
    x: bridgeWorldPos.x + _tan.x * 1.2,
    z: bridgeWorldPos.z + _tan.z * 1.2,
    radius: 0.65,
  });

  // Merge Stone and Wood
  if (riverStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(riverStoneGeos));
    riverStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, riverStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (bankMossGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(bankMossGeos));
    bankMossGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, bankMossMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (woodGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(woodGeos));
    woodGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, woodPlankMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (bStoneGeos.length > 0) {
    const merged = tracker.trackGeo(mergeGeometries(bStoneGeos));
    bStoneGeos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, bridgeStoneMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return {
    group,
    colliders,
    streamMidWorldPos,
    waterfallWorldPos,
    bridgeWorldPos,

    update(
      _dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
      audio: ForestAudioSynthesizer,
    ): void {
      // 1. Advance water shader ripple time
      waterMat.uniforms.uTime.value = elapsedTime;

      // 2. Cascade water shimmering
      cascadeMat.opacity = 0.72 + Math.sin(elapsedTime * 8.0) * 0.12;

      // 3. Animate waterfall splash mist
      const posAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let m = 0; m < mistCount; m++) {
        const b = mistBase[m];
        const cycle = (elapsedTime * 1.2 + b.phase) % 1.0;
        posAttr.setXYZ(
          m,
          b.x + Math.sin(elapsedTime * 2.5 + b.phase) * b.spread,
          b.y + cycle * 0.45,
          b.z + Math.cos(elapsedTime * 2.2 + b.phase) * b.spread,
        );
      }
      posAttr.needsUpdate = true;

      // 4. Update procedural audio based on player proximity to Stream, Waterfall, Lake, Hidden Pool & Sanctuary Pool
      const distToStream = Math.hypot(
        playerWorldPos.x - streamMidWorldPos.x,
        playerWorldPos.z - streamMidWorldPos.z,
      );
      const distToWaterfall = Math.hypot(
        playerWorldPos.x - waterfallWorldPos.x,
        playerWorldPos.z - waterfallWorldPos.z,
      );
      const lakeW = castleLocalToWorld(
        FOREST_LAKE_LOCAL_POS.localX,
        FOREST_LAKE_LOCAL_POS.localZ,
      );
      const hiddenPoolW = castleLocalToWorld(
        HIDDEN_POOL_LOCAL_POS.localX,
        HIDDEN_POOL_LOCAL_POS.localZ,
      );
      const sanctuaryPoolW = castleLocalToWorld(
        HEARTWOOD_SANCTUARY_LOCAL_POS.localX,
        HEARTWOOD_SANCTUARY_LOCAL_POS.localZ,
      );
      const distToLakeShore = Math.max(
        0,
        Math.hypot(playerWorldPos.x - lakeW.x, playerWorldPos.z - lakeW.z) - 7.5,
      );
      const distToHiddenPool = Math.max(
        0,
        Math.hypot(
          playerWorldPos.x - hiddenPoolW.x,
          playerWorldPos.z - hiddenPoolW.z,
        ) - 3.2,
      );
      const distToSanctuaryPool = Math.max(
        0,
        Math.hypot(
          playerWorldPos.x - sanctuaryPoolW.x,
          playerWorldPos.z - sanctuaryPoolW.z,
        ) - 4.0,
      );
      const effectiveStreamDist = Math.min(
        distToStream,
        distToLakeShore * 1.15,
        distToHiddenPool * 0.95,
        distToSanctuaryPool * 1.25,
      );
      audio.updateStreamProximity(
        effectiveStreamDist,
        distToWaterfall,
        elapsedTime,
      );
    },

    dispose(): void {
      tracker.dispose();
    },
  };
}
