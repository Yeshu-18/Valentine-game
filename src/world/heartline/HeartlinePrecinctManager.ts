import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ResourceTracker } from '../ProceduralKit';
import { getTerrainHeight } from '../terrainMath';
import {
  createHeartlineTrackSpline,
  createEmptyTrackFrame,
  LOVE_MEADOW_CENTER,
  STATION_BOARDING_POS,
  STATION_EXIT_POS,
  TICKET_BOOTH_POS,
  ENTRANCE_ARCH_POS,
  VIEWING_DECK_POS,
  CRYSTAL_TUNNEL_CENTER,
} from './HeartlineTrackSpline';
import {
  createHeartlineTrainSolver,
  RAIL_GAUGE_HALF,
  RAIL_HEIGHT_OFFSET,
} from './HeartlineTrainSolver';
import {
  createHeartlineChoreographyDirector,
} from './HeartlineChoreographyDirector';
import {
  createHeartlineCameraRig,
  HeartlineCameraState,
} from './HeartlineCameraRig';
import { createHeartlineUnderwaterReef } from './HeartlineUnderwaterReef';

export interface HeartlinePrecinctManager {
  readonly group: THREE.Group;
  readonly colliders: THREE.Box3[];
  getSurfaceHeight: (x: number, z: number, baseGroundY: number) => number;
  resolveSkywalkBarriers: (playerPos: THREE.Vector3, playerRadius: number) => void;
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  handleKeyAction: (key: string, playerPos: THREE.Vector3) => boolean;
  interact: (playerPos: THREE.Vector3) => boolean;
  applyLookDelta: (yawDeltaRad: number, pitchDeltaRad: number) => void;
  isRiding: () => boolean;
  getRideZoneLabel: () => string;
  getCameraState: () => HeartlineCameraState;
  consumeExitDisembark: (outExitPos: THREE.Vector3) => boolean;
  getUnderwaterSpeedFactor: () => number;
  setUnderwaterSpeedFactor: (factor: number) => void;
  update: (dt: number, elapsedTime: number, playerPos: THREE.Vector3) => void;
  dispose: () => void;
}

const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchColor = new THREE.Color();

function createSignBannerTexture(
  tracker: ResourceTracker,
  title: string,
  subtitle?: string,
  bgHex = '#0f296b',
  borderHex = '#d8b467'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(0.5, bgHex);
    grad.addColorStop(1, '#0b1942');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, 996, 228);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, 968, 200);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 88px Georgia, serif';
    ctx.fillText(title, 512, subtitle ? 102 : 128);

    if (subtitle) {
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText(subtitle, 512, 184);
    }
  }
  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSapphirePathwayTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich Royal/Sapphire Blue Stone Flagstone Base
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, '#1e3a8a');
    grad.addColorStop(0.12, '#1d4ed8');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(0.88, '#1d4ed8');
    grad.addColorStop(1.0, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle Ashlar Blue-Stone Tile Grid
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.32)';
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      const offset = (y / 64) % 2 === 0 ? 0 : 64;
      for (let x = offset; x < 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }

    // Luminous Cyan-Blue Wayfinding Center Strip & Gold Border Lines
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(244, 0, 24, 512);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(252, 0, 8, 512);

    ctx.fillStyle = '#d8b467';
    ctx.fillRect(14, 0, 12, 512);
    ctx.fillRect(486, 0, 12, 512);
  }
  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a single closed tube geometry from an array of 3D points and frames.
 */
function buildClosedRailBufferGeometry(
  centers: THREE.Vector3[],
  tangents: THREE.Vector3[],
  normals: THREE.Vector3[],
  radius: number,
  radialSegments = 8
): THREE.BufferGeometry {
  const ringCount = centers.length;
  const vertexCount = (ringCount + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normalsArr = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const binormal = new THREE.Vector3();
  const vOffset = new THREE.Vector3();

  for (let i = 0; i <= ringCount; i++) {
    const idx = i % ringCount;
    const c = centers[idx];
    const t = tangents[idx];
    const n = normals[idx];
    binormal.crossVectors(t, n).normalize();

    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      vOffset.set(0, 0, 0).addScaledVector(binormal, cosT).addScaledVector(n, sinT).normalize();
      const vIdx = (i * (radialSegments + 1) + j) * 3;
      positions[vIdx] = c.x + vOffset.x * radius;
      positions[vIdx + 1] = c.y + vOffset.y * radius;
      positions[vIdx + 2] = c.z + vOffset.z * radius;

      normalsArr[vIdx] = vOffset.x;
      normalsArr[vIdx + 1] = vOffset.y;
      normalsArr[vIdx + 2] = vOffset.z;
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < ringCount; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normalsArr, 3));
  geo.setIndex(indices);
  return geo;
}

export function createHeartlinePrecinct(): HeartlinePrecinctManager {
  const tracker = new ResourceTracker();
  const group = new THREE.Group();
  group.name = 'HeartlineSpectacularPrecinct';
  const colliders: THREE.Box3[] = [];

  const spline = createHeartlineTrackSpline();
  const train = createHeartlineTrainSolver(spline, tracker);
  group.add(train.group);

  const cameraRig = createHeartlineCameraRig(spline, train);

  // ============================================================================
  // SHARED ATTRACTION MATERIALS (Strict Sapphire / Cyan / Navy / Pearl / Gold Palette)
  // ============================================================================
  const sapphireRailMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.24,
      metalness: 0.55,
    })
  );
  const cyanSpineMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.48,
    })
  );
  const deepNavySupportMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.38,
      metalness: 0.52,
    })
  );
  const pearlStoneMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.36,
      metalness: 0.08,
    })
  );
  const sapphirePathwayTex = createSapphirePathwayTexture(tracker);
  const warmPlazaTileMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: sapphirePathwayTex,
      color: 0xbfdbfe,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.28,
      roughness: 0.34,
      metalness: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const champagneGoldMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xd8b467,
      roughness: 0.26,
      metalness: 0.72,
    })
  );
  const sapphireGlassMat = tracker.track(
    new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.25,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.62,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    })
  );
  const cyanCrystalMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.2,
    })
  );
  const queueGlowMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    })
  );
  const castleGardenGlowMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    })
  );
  const reflectiveWaterMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22,
      roughness: 0.08,
      metalness: 0.35,
    })
  );

  // ============================================================================
  // 1. MERGED TRACK RAILS, ELECTRIC CYAN SPINE, INSTANCED TIES & NAVY SUPPORTS
  // ============================================================================
  const TRACK_RING_SAMPLES = 420;
  const leftCenters: THREE.Vector3[] = [];
  const rightCenters: THREE.Vector3[] = [];
  const spineCenters: THREE.Vector3[] = [];
  const sampleTangents: THREE.Vector3[] = [];
  const sampleNormals: THREE.Vector3[] = [];
  const sampleFrame = createEmptyTrackFrame();

  for (let i = 0; i < TRACK_RING_SAMPLES; i++) {
    const s = (i / TRACK_RING_SAMPLES) * spline.totalLength;
    spline.evaluateAtS(s, sampleFrame);

    const railUpX = sampleFrame.normal.x * RAIL_HEIGHT_OFFSET;
    const railUpY = sampleFrame.normal.y * RAIL_HEIGHT_OFFSET;
    const railUpZ = sampleFrame.normal.z * RAIL_HEIGHT_OFFSET;

    leftCenters.push(
      new THREE.Vector3(
        sampleFrame.pos.x + railUpX + sampleFrame.binormal.x * RAIL_GAUGE_HALF,
        sampleFrame.pos.y + railUpY + sampleFrame.binormal.y * RAIL_GAUGE_HALF,
        sampleFrame.pos.z + railUpZ + sampleFrame.binormal.z * RAIL_GAUGE_HALF
      )
    );
    rightCenters.push(
      new THREE.Vector3(
        sampleFrame.pos.x + railUpX - sampleFrame.binormal.x * RAIL_GAUGE_HALF,
        sampleFrame.pos.y + railUpY - sampleFrame.binormal.y * RAIL_GAUGE_HALF,
        sampleFrame.pos.z + railUpZ - sampleFrame.binormal.z * RAIL_GAUGE_HALF
      )
    );
    spineCenters.push(
      new THREE.Vector3(
        sampleFrame.pos.x - sampleFrame.normal.x * 0.16,
        sampleFrame.pos.y - sampleFrame.normal.y * 0.16,
        sampleFrame.pos.z - sampleFrame.normal.z * 0.16
      )
    );
    sampleTangents.push(sampleFrame.tangent.clone());
    sampleNormals.push(sampleFrame.normal.clone());
  }

  const leftRailGeo = buildClosedRailBufferGeometry(leftCenters, sampleTangents, sampleNormals, 0.068, 8);
  const rightRailGeo = buildClosedRailBufferGeometry(rightCenters, sampleTangents, sampleNormals, 0.068, 8);
  const mergedRailsGeo = tracker.track(mergeGeometries([leftRailGeo, rightRailGeo], false));
  leftRailGeo.dispose();
  rightRailGeo.dispose();

  const railsMesh = new THREE.Mesh(mergedRailsGeo, sapphireRailMat);
  railsMesh.castShadow = true;
  railsMesh.receiveShadow = true;
  group.add(railsMesh);

  const spineGeo = tracker.track(buildClosedRailBufferGeometry(spineCenters, sampleTangents, sampleNormals, 0.14, 8));
  const spineMesh = new THREE.Mesh(spineGeo, cyanSpineMat);
  spineMesh.castShadow = true;
  group.add(spineMesh);

  // Instanced Track Cross-Ties (340 ties along the full circuit)
  const TIE_COUNT = 340;
  const tieBarGeo = new THREE.BoxGeometry(RAIL_GAUGE_HALF * 2 + 0.08, 0.07, 0.12);
  tieBarGeo.translate(0, RAIL_HEIGHT_OFFSET - 0.02, 0);
  const tieStrutLeftGeo = new THREE.BoxGeometry(0.08, 0.36, 0.10);
  tieStrutLeftGeo.translate(-RAIL_GAUGE_HALF * 0.5, 0.04, 0);
  tieStrutLeftGeo.rotateZ(-0.52);
  const tieStrutRightGeo = new THREE.BoxGeometry(0.08, 0.36, 0.10);
  tieStrutRightGeo.translate(RAIL_GAUGE_HALF * 0.5, 0.04, 0);
  tieStrutRightGeo.rotateZ(0.52);
  const mergedTieGeo = tracker.track(mergeGeometries([tieBarGeo, tieStrutLeftGeo, tieStrutRightGeo], false));
  tieBarGeo.dispose();
  tieStrutLeftGeo.dispose();
  tieStrutRightGeo.dispose();

  const tiesInstanced = tracker.track(new THREE.InstancedMesh(mergedTieGeo, sapphireRailMat, TIE_COUNT));
  for (let i = 0; i < TIE_COUNT; i++) {
    const s = (i / TIE_COUNT) * spline.totalLength;
    spline.evaluateAtS(s, sampleFrame);
    _scratchForward.copy(sampleFrame.tangent).normalize();
    _scratchUp.copy(sampleFrame.normal).normalize();
    _scratchRight.crossVectors(_scratchUp, _scratchForward).normalize();
    _scratchUp.crossVectors(_scratchForward, _scratchRight).normalize();
    _scratchMat4.makeBasis(_scratchRight, _scratchUp, _scratchForward);
    _scratchMat4.setPosition(sampleFrame.pos);
    tiesInstanced.setMatrixAt(i, _scratchMat4);
  }
  tiesInstanced.instanceMatrix.needsUpdate = true;
  group.add(tiesInstanced);

  // Pre-sample underwater reef corridor (u = 0.525..0.785) so upper-track support columns never drop through the underwater track
  const underwaterSamplesXZ: { x: number; z: number }[] = [];
  for (let k = 0; k <= 44; k++) {
    const uwU = 0.525 + (k / 44) * 0.26;
    spline.evaluateAtU(uwU, sampleFrame);
    underwaterSamplesXZ.push({ x: sampleFrame.pos.x, z: sampleFrame.pos.z });
  }

  // Instanced Deep-Navy Support Columns + Pearl-White Foundation Collars
  const supportPositions: { x: number; topY: number; z: number }[] = [];
  const SUPPORT_SAMPLES = 64;
  for (let i = 0; i < SUPPORT_SAMPLES; i++) {
    const u = i / SUPPORT_SAMPLES;
    // Skip support columns inside the Station canopy (0..0.04, 0.96..1.0) and Crystal Tunnel / Underwater Reef Arches (0.525..0.785)
    if (u < 0.04 || u > 0.965 || (u > 0.525 && u < 0.785)) continue;
    spline.evaluateAtU(u, sampleFrame);
    // Avoid blocking the Queue Garden bridge walkway near (64..76, 80..89)
    if (
      sampleFrame.pos.x > 64 &&
      sampleFrame.pos.x < 76 &&
      sampleFrame.pos.z > 80 &&
      sampleFrame.pos.z < 89
    ) {
      continue;
    }
    // Ensure upper-track support columns (e.g. Major Drop / Castle Flyby) do not intersect the Underwater Reef track
    let hitsUnderwaterTrack = false;
    for (let k = 0; k < underwaterSamplesXZ.length; k++) {
      const uw = underwaterSamplesXZ[k];
      if (Math.hypot(sampleFrame.pos.x - uw.x, sampleFrame.pos.z - uw.z) < 5.2) {
        hitsUnderwaterTrack = true;
        break;
      }
    }
    if (hitsUnderwaterTrack) continue;

    supportPositions.push({
      x: sampleFrame.pos.x,
      topY: sampleFrame.pos.y - 0.22,
      z: sampleFrame.pos.z,
    });
  }

  const supportColGeo = tracker.track(new THREE.CylinderGeometry(0.24, 0.32, 1.0, 10));
  const supportCollarGeo = tracker.track(new THREE.CylinderGeometry(0.46, 0.54, 0.9, 12));
  const supportsInstanced = tracker.track(
    new THREE.InstancedMesh(supportColGeo, deepNavySupportMat, supportPositions.length)
  );
  const collarsInstanced = tracker.track(
    new THREE.InstancedMesh(supportCollarGeo, pearlStoneMat, supportPositions.length)
  );
  supportsInstanced.castShadow = true;

  for (let i = 0; i < supportPositions.length; i++) {
    const sp = supportPositions[i];
    const groundY = getTerrainHeight(sp.x, sp.z);
    const h = Math.max(0.5, sp.topY - groundY);
    _scratchPos.set(sp.x, groundY + h * 0.5, sp.z);
    _scratchQuat.identity();
    _scratchScale.set(1, h, 1);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    supportsInstanced.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(sp.x, groundY + 0.45, sp.z);
    _scratchScale.set(1, 1, 1);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    collarsInstanced.setMatrixAt(i, _scratchMat4);
  }
  supportsInstanced.instanceMatrix.needsUpdate = true;
  collarsInstanced.instanceMatrix.needsUpdate = true;
  group.add(supportsInstanced);
  group.add(collarsInstanced);

  // ============================================================================
  // 2. COMPLETE BLUISH PATHWAY FROM ENTRANCE TO COASTER & DECORATED PROMENADE
  // ============================================================================
  const pathwayJunctionGeo = tracker.track(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 24));
  const pathwayUrnPedestalGeo = tracker.track(new THREE.CylinderGeometry(0.42, 0.52, 0.68, 12));
  const pathwayFlowerMoundGeo = tracker.track(new THREE.SphereGeometry(0.55, 10, 8));
  const pathwayLampPoleGeo = tracker.track(new THREE.CylinderGeometry(0.09, 0.13, 3.8, 10));
  const pathwayBannerGeo = tracker.track(new THREE.PlaneGeometry(0.68, 1.55));
  const royalBannerMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      side: THREE.DoubleSide,
    })
  );
  const blueFlowerMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.5,
    })
  );

  function addBluePathwayJunction(x: number, z: number, radius: number, elevY = 12.56): void {
    const disk = new THREE.Mesh(pathwayJunctionGeo, warmPlazaTileMat);
    disk.position.set(x, elevY, z);
    disk.scale.set(radius, 1, radius);
    disk.receiveShadow = true;
    group.add(disk);

    const rim = new THREE.Mesh(
      tracker.track(new THREE.TorusGeometry(radius + 0.08, 0.09, 8, 28)),
      champagneGoldMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, elevY + 0.08, z);
    group.add(rim);
  }

  function addBluePathwaySegment(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    width = 5.4,
    elevY = 12.56,
    withDecor = true,
    followTerrain = false
  ): void {
    const totalDx = bx - ax;
    const totalDz = bz - az;
    const totalLen = Math.hypot(totalDx, totalDz);
    const angle = Math.atan2(totalDx, totalDz);
    const perpX = totalDz / (totalLen || 1);
    const perpZ = -totalDx / (totalLen || 1);

    const stepCount = followTerrain ? Math.max(1, Math.ceil(totalLen / 2.2)) : 1;

    for (let s = 0; s < stepCount; s++) {
      const t0 = s / stepCount;
      const t1 = (s + 1) / stepCount;
      const sx0 = THREE.MathUtils.lerp(ax, bx, t0);
      const sz0 = THREE.MathUtils.lerp(az, bz, t0);
      const sx1 = THREE.MathUtils.lerp(ax, bx, t1);
      const sz1 = THREE.MathUtils.lerp(az, bz, t1);
      const smx = (sx0 + sx1) * 0.5;
      const smz = (sz0 + sz1) * 0.5;
      const subLen = totalLen / stepCount;

      const y0 = followTerrain ? getTerrainHeight(sx0, sz0) + 0.06 : elevY;
      const y1 = followTerrain ? getTerrainHeight(sx1, sz1) + 0.06 : elevY;
      const smy = (y0 + y1) * 0.5;
      const pitch = followTerrain ? -Math.atan2(y1 - y0, subLen || 1) : 0;

      const subGroup = new THREE.Group();
      subGroup.position.set(smx, smy, smz);
      subGroup.rotation.order = 'YXZ';
      subGroup.rotation.y = angle;
      subGroup.rotation.x = pitch;

      const segGeo = tracker.track(new THREE.BoxGeometry(width, 0.14, subLen + 0.32));
      const segMesh = new THREE.Mesh(segGeo, warmPlazaTileMat);
      segMesh.receiveShadow = true;
      subGroup.add(segMesh);

      for (const side of [-1, 1]) {
        const curbX = side * (width * 0.5 + 0.14);
        const curbGeo = tracker.track(new THREE.BoxGeometry(0.24, 0.22, subLen + 0.28));
        const curb = new THREE.Mesh(curbGeo, cyanSpineMat);
        curb.position.set(curbX, 0.05, 0);
        subGroup.add(curb);

        const goldRailGeo = tracker.track(new THREE.BoxGeometry(0.10, 0.06, subLen + 0.28));
        const goldRail = new THREE.Mesh(goldRailGeo, champagneGoldMat);
        goldRail.position.set(curbX, 0.18, 0);
        subGroup.add(goldRail);
      }

      group.add(subGroup);
    }

    // Seamless circular sapphire-and-gold medallions at both ends of the segment
    const startY = followTerrain ? getTerrainHeight(ax, az) + 0.055 : elevY - 0.005;
    const endY = followTerrain ? getTerrainHeight(bx, bz) + 0.055 : elevY - 0.005;
    addBluePathwayJunction(ax, az, width * 0.52, startY);
    addBluePathwayJunction(bx, bz, width * 0.52, endY);

    if (withDecor && totalLen >= 5.5) {
      const decorPairs = followTerrain ? Math.max(1, Math.floor(totalLen / 9.5)) : 1;
      for (let p = 0; p < decorPairs; p++) {
        const frac = (p + 0.5) / decorPairs;
        const cx = THREE.MathUtils.lerp(ax, bx, frac);
        const cz = THREE.MathUtils.lerp(az, bz, frac);

        for (const side of [-1, 1]) {
          const postOffset = side * (width * 0.5 + 0.68);
          const px = cx + perpX * postOffset;
          const pz = cz + perpZ * postOffset;
          const py = followTerrain ? getTerrainHeight(px, pz) + 0.04 : elevY;

          // Pearl Pedestal Urn with Glowing Blue Hydrangea Mound
          const urn = new THREE.Mesh(pathwayUrnPedestalGeo, pearlStoneMat);
          urn.position.set(px, py + 0.34, pz);
          group.add(urn);

          const blooms = new THREE.Mesh(pathwayFlowerMoundGeo, blueFlowerMat);
          blooms.position.set(px, py + 0.78, pz);
          blooms.scale.set(1.1, 0.75, 1.1);
          group.add(blooms);

          // Ornamental Lamp Post with Hanging Royal-Blue Banner & Warm Crystal Lantern
          const pole = new THREE.Mesh(pathwayLampPoleGeo, deepNavySupportMat);
          pole.position.set(px, py + 1.9, pz);
          group.add(pole);

          const lantern = new THREE.Mesh(
            tracker.track(new THREE.OctahedronGeometry(0.26, 1)),
            queueGlowMat
          );
          lantern.position.set(px, py + 3.95, pz);
          group.add(lantern);

          const banner = new THREE.Mesh(pathwayBannerGeo, royalBannerMat);
          banner.position.set(px - perpX * side * 0.36, py + 2.75, pz - perpZ * side * 0.36);
          banner.rotation.y = angle + Math.PI / 2;
          group.add(banner);
        }
      }
    }
  }

  // 1. Grand Sapphire-Blue & Gold Approach Boulevard connecting:
  //    Central Plaza "THRILL ZONE / HEARTLINE COASTER RIDGE" Gateway (24.58, 20.80)
  //    -> Thrill Zone Welcome Rondel at (31.87, 26.97) [Image 2 Viewpoint!]
  //    -> Lower & Mid-Hill Scenic Boulevard (35.6, 36.0 -> 39.0, 45.5 -> 42.5, 55.5)
  //    -> HEARTLINE Entrance Gateway Arch at (46.0, 65.0) [Image 1 Viewpoint!]
  //    -> Octagonal Luxury Ticket Booth at (55.0, 71.0)
  addBluePathwaySegment(24.58, 20.80, 31.87, 26.97, 5.8, 4.3, true, true);
  addBluePathwaySegment(31.87, 26.97, 35.60, 36.00, 6.2, 5.1, true, true);
  addBluePathwaySegment(35.60, 36.00, 39.00, 45.50, 6.2, 7.5, true, true);
  addBluePathwaySegment(39.00, 45.50, 42.50, 55.50, 6.4, 9.9, true, true);
  addBluePathwaySegment(42.50, 55.50, 46.00, 65.00, 6.4, 12.2, true, true);
  addBluePathwaySegment(46.00, 65.00, 55.00, 71.00, 6.4, 12.56, true, false);

  // Grand Sapphire & Gold Welcome Rondel at (31.87, 26.97) right outside the Central Plaza "THRILL ZONE" Gateway (Image 2)
  const rondelY = getTerrainHeight(31.87, 26.97) + 0.06;
  addBluePathwayJunction(31.87, 26.97, 4.8, rondelY);

  // 3 Ornamental Sapphire & Pearl Crystal Boulevard Arches spanning the Grand Boulevard between Image 2 and Image 1
  const boulevardArches: { x: number; z: number; nextX: number; nextZ: number }[] = [
    { x: 33.7, z: 31.5, nextX: 35.6, nextZ: 36.0 },
    { x: 37.3, z: 40.8, nextX: 39.0, nextZ: 45.5 },
    { x: 40.8, z: 50.5, nextX: 42.5, nextZ: 55.5 },
  ];
  const boulArchPillarGeo = tracker.track(new THREE.CylinderGeometry(0.24, 0.32, 4.4, 12));
  const boulArchRibGeo = tracker.track(new THREE.TorusGeometry(3.45, 0.16, 10, 24, Math.PI));

  for (let i = 0; i < boulevardArches.length; i++) {
    const ba = boulevardArches[i];
    const ay = getTerrainHeight(ba.x, ba.z);
    const aAngle = Math.atan2(ba.nextX - ba.x, ba.nextZ - ba.z);
    const archGrp = new THREE.Group();
    archGrp.position.set(ba.x, ay, ba.z);
    archGrp.rotation.y = aAngle;

    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(boulArchPillarGeo, pearlStoneMat);
      col.position.set(side * 3.45, 2.2, 0);
      archGrp.add(col);

      const baseCollar = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.42, 0.48, 0.45, 12)),
        champagneGoldMat
      );
      baseCollar.position.set(side * 3.45, 0.22, 0);
      archGrp.add(baseCollar);

      const spire = new THREE.Mesh(
        tracker.track(new THREE.ConeGeometry(0.32, 1.05, 6)),
        cyanCrystalMat
      );
      spire.position.set(side * 3.45, 4.85, 0);
      archGrp.add(spire);
    }

    const rib = new THREE.Mesh(boulArchRibGeo, pearlStoneMat);
    rib.position.set(0, 4.35, 0);
    archGrp.add(rib);

    const goldRib = new THREE.Mesh(
      tracker.track(new THREE.TorusGeometry(3.58, 0.07, 8, 24, Math.PI)),
      champagneGoldMat
    );
    goldRib.position.set(0, 4.35, 0);
    archGrp.add(goldRib);

    const crownHeart = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.42, 1)),
      cyanCrystalMat
    );
    crownHeart.position.set(0, 8.15, 0);
    archGrp.add(crownHeart);

    const centerLantern = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.28, 1)),
      queueGlowMat
    );
    centerLantern.position.set(0, 7.25, 0);
    archGrp.add(centerLantern);

    group.add(archGrp);
  }

  // 2. Direct South Sapphire Promenade: Ticket Booth (55, 71) -> (62.5, 73.2) -> South Boarding Stand Forecourt (70.0, 73.8)
  // Stays cleanly on the South side of the Station (never crossing the coaster track at z = 78.0!)
  addBluePathwaySegment(55.0, 71.0, 62.5, 73.2, 5.2, 12.56, true);
  addBluePathwaySegment(62.5, 73.2, 70.0, 73.8, 5.2, 12.57, true);

  // 3. Scenic Wisteria Queue Garden Bluish Pathway: Ticket Booth (55, 71) -> Viewing Deck (65.5, 86.5) -> North Boarding Stand (70.0, 82.2)
  addBluePathwaySegment(55.0, 71.0, 58.5, 75.0, 4.4, 12.56, false);
  addBluePathwaySegment(58.5, 75.0, 61.2, 79.5, 4.4, 12.56, false);
  addBluePathwaySegment(61.2, 79.5, 63.5, 83.5, 4.4, 12.57, false);
  addBluePathwaySegment(63.5, 83.5, 65.5, 86.5, 4.4, 12.57, false);
  addBluePathwaySegment(65.5, 86.5, 68.2, 84.2, 4.4, 12.57, false);
  addBluePathwaySegment(68.2, 84.2, 70.0, 82.2, 4.6, 12.58, false);

  // Circular Sapphire Forecourt Medallions under the Octagonal Ticket Booth (55, 71), Viewing Deck (65.5, 86.5), and Station (70, 78)
  addBluePathwayJunction(TICKET_BOOTH_POS.x, TICKET_BOOTH_POS.z, 6.8, 12.56);
  addBluePathwayJunction(VIEWING_DECK_POS.x, VIEWING_DECK_POS.z, 5.6, 12.57);

  const stationPlazaGeo = tracker.track(new THREE.BoxGeometry(20.5, 0.15, 13.8));
  const stationPlaza = new THREE.Mesh(stationPlazaGeo, warmPlazaTileMat);
  stationPlaza.position.set(70.0, 12.55, 78.0);
  stationPlaza.receiveShadow = true;
  group.add(stationPlaza);

  // Reflective Sapphire Water Feature alongside the Entrance-to-Booth Bluish Promenade
  const waterChannelCurbGeo = tracker.track(new THREE.BoxGeometry(3.2, 0.22, 12.0));
  const waterChannelCurb = new THREE.Mesh(waterChannelCurbGeo, pearlStoneMat);
  waterChannelCurb.position.set(48.0, 12.55, 71.8);
  waterChannelCurb.rotation.y = Math.atan2(9.0, 6.0);
  group.add(waterChannelCurb);

  const waterChannelGeo = tracker.track(new THREE.BoxGeometry(2.6, 0.26, 11.4));
  const waterChannel = new THREE.Mesh(waterChannelGeo, reflectiveWaterMat);
  waterChannel.position.set(48.0, 12.56, 71.8);
  waterChannel.rotation.y = Math.atan2(9.0, 6.0);
  group.add(waterChannel);

  // Curved Attraction Entrance Gateway at ENTRANCE_ARCH_POS (46.0, 12.5, 65.0) facing SW (-X, -Z)
  const entranceGroup = new THREE.Group();
  entranceGroup.position.copy(ENTRANCE_ARCH_POS);
  entranceGroup.rotation.y = -Math.PI * 0.75; // Faces approaching player walking up the NE Boulevard spoke

  const archPillarGeo = tracker.track(new THREE.BoxGeometry(1.35, 6.2, 1.35));
  const archCrystalInlayGeo = tracker.track(new THREE.BoxGeometry(0.55, 3.8, 1.42));
  const archCrystalSpireGeo = tracker.track(new THREE.ConeGeometry(0.58, 1.85, 6));

  for (const side of [-1, 1]) {
    const px = side * 4.4;
    const pillar = new THREE.Mesh(archPillarGeo, pearlStoneMat);
    pillar.position.set(px, 3.1, 0);
    pillar.castShadow = true;
    entranceGroup.add(pillar);

    const crystalInlay = new THREE.Mesh(archCrystalInlayGeo, cyanCrystalMat);
    crystalInlay.position.set(px, 3.1, 0);
    entranceGroup.add(crystalInlay);

    const crystalSpire = new THREE.Mesh(archCrystalSpireGeo, cyanCrystalMat);
    crystalSpire.position.set(px, 7.05, 0);
    entranceGroup.add(crystalSpire);

    // Flanking Royal-Blue Banner Posts & Streetlamps
    const lampPostGeo = tracker.track(new THREE.CylinderGeometry(0.12, 0.16, 4.6, 10));
    const lampPost = new THREE.Mesh(lampPostGeo, deepNavySupportMat);
    lampPost.position.set(side * 6.8, 2.3, 0.4);
    entranceGroup.add(lampPost);

    const lanternGlobeGeo = tracker.track(new THREE.SphereGeometry(0.32, 12, 12));
    const lanternGlobe = new THREE.Mesh(lanternGlobeGeo, queueGlowMat);
    lanternGlobe.position.set(side * 6.8, 4.75, 0.4);
    entranceGroup.add(lanternGlobe);

    // Blue Hydrangea Planter Mound at base of each entrance pillar
    const planterGeo = tracker.track(new THREE.CylinderGeometry(1.25, 1.05, 0.65, 14));
    const planter = new THREE.Mesh(planterGeo, pearlStoneMat);
    planter.position.set(px + side * 0.8, 0.32, 1.1);
    entranceGroup.add(planter);
  }

  // Curved Overhead Sign Board ("HEARTLINE / THE SKY OF OUR DREAMS") — diffused matte finish with soft self-illumination so zero sun glare washes out text
  const signTex = createSignBannerTexture(
    tracker,
    'HEARTLINE',
    'THE SKY OF OUR DREAMS'
  );
  const signMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const signBoardGeo = tracker.track(new THREE.BoxGeometry(8.2, 2.1, 0.55));
  const signBoard = new THREE.Mesh(signBoardGeo, [
    champagneGoldMat,
    champagneGoldMat,
    champagneGoldMat,
    champagneGoldMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(0, 6.4, 0);
  entranceGroup.add(signBoard);

  // Apex Glowing Sapphire Crystal Heart Emblem above the Entrance Arch
  const apexHeartGeo = tracker.track(new THREE.OctahedronGeometry(0.85, 1));
  apexHeartGeo.scale(1.15, 1.15, 0.55);
  const apexHeart = new THREE.Mesh(apexHeartGeo, cyanCrystalMat);
  apexHeart.position.set(0, 7.95, 0);
  entranceGroup.add(apexHeart);

  const apexGoldRingGeo = tracker.track(new THREE.TorusGeometry(0.95, 0.09, 10, 24));
  const apexGoldRing = new THREE.Mesh(apexGoldRingGeo, champagneGoldMat);
  apexGoldRing.position.set(0, 7.95, 0);
  entranceGroup.add(apexGoldRing);

  group.add(entranceGroup);

  // ============================================================================
  // 3. OCTAGONAL LUXURY TICKET BOOTH AT TICKET_BOOTH_POS (63.0, 12.5, 57.0)
  // ============================================================================
  const boothGroup = new THREE.Group();
  boothGroup.position.copy(TICKET_BOOTH_POS);
  boothGroup.rotation.y = -Math.PI * 0.75;

  const boothBaseGeo = tracker.track(new THREE.CylinderGeometry(3.4, 3.6, 1.15, 8));
  const boothBase = new THREE.Mesh(boothBaseGeo, pearlStoneMat);
  boothBase.position.y = 0.58;
  boothBase.castShadow = true;
  boothGroup.add(boothBase);

  const boothCounterRingGeo = tracker.track(new THREE.CylinderGeometry(3.55, 3.55, 0.14, 8));
  const boothCounterRing = new THREE.Mesh(boothCounterRingGeo, champagneGoldMat);
  boothCounterRing.position.y = 1.18;
  boothGroup.add(boothCounterRing);

  // 8 Fluted Octagonal Columns supporting the Sapphire Glass Dome
  const boothColGeo = tracker.track(new THREE.CylinderGeometry(0.18, 0.22, 2.35, 10));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const col = new THREE.Mesh(boothColGeo, pearlStoneMat);
    col.position.set(Math.cos(ang) * 2.95, 2.32, Math.sin(ang) * 2.95);
    boothGroup.add(col);
  }

  // Pearl-White & Gold Cornice Ring
  const boothCorniceGeo = tracker.track(new THREE.CylinderGeometry(3.7, 3.45, 0.52, 8));
  const boothCornice = new THREE.Mesh(boothCorniceGeo, pearlStoneMat);
  boothCornice.position.y = 3.65;
  boothGroup.add(boothCornice);

  // "TICKETS" Plaque & Glowing Sapphire Heart Crest on front of Booth
  const ticketsTex = createSignBannerTexture(tracker, 'TICKETS', 'RIDE PASSES & EXPRESS');
  const ticketsMat = tracker.track(new THREE.MeshStandardMaterial({ map: ticketsTex, roughness: 0.25 }));
  const ticketsPlaqueGeo = tracker.track(new THREE.BoxGeometry(2.6, 0.68, 0.18));
  const ticketsPlaque = new THREE.Mesh(ticketsPlaqueGeo, ticketsMat);
  ticketsPlaque.position.set(0, 3.65, 3.45);
  boothGroup.add(ticketsPlaque);

  const boothHeartCrest = new THREE.Mesh(
    tracker.track(new THREE.OctahedronGeometry(0.42, 1)),
    cyanCrystalMat
  );
  boothHeartCrest.position.set(0, 4.35, 3.48);
  boothGroup.add(boothHeartCrest);

  // Ribbed Sapphire Glass Dome Roof + Golden Finial Spire
  const boothDomeGeo = tracker.track(
    new THREE.SphereGeometry(3.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48)
  );
  const boothDome = new THREE.Mesh(boothDomeGeo, sapphireGlassMat);
  boothDome.position.y = 3.82;
  boothGroup.add(boothDome);

  const boothFinialGeo = tracker.track(new THREE.ConeGeometry(0.32, 1.35, 10));
  const boothFinial = new THREE.Mesh(boothFinialGeo, champagneGoldMat);
  boothFinial.position.y = 7.65;
  boothGroup.add(boothFinial);

  // Miniature Glowing Coaster Model inside the Ticket Booth
  const miniLoopGeo = tracker.track(new THREE.TorusKnotGeometry(0.65, 0.045, 48, 8, 2, 3));
  const miniLoop = new THREE.Mesh(miniLoopGeo, cyanCrystalMat);
  miniLoop.position.set(0, 1.85, 0);
  boothGroup.add(miniLoop);

  group.add(boothGroup);

  // ============================================================================
  // 4. BOTANICAL QUEUE GARDEN (WISTERIA ARBORS, LANTERNS) & VIEWING DECK
  // ============================================================================
  // Elevated Viewing Deck at VIEWING_DECK_POS (73.5, 13.3, 77.5)
  const deckGroup = new THREE.Group();
  deckGroup.position.copy(VIEWING_DECK_POS);

  const deckPlatformGeo = tracker.track(new THREE.CylinderGeometry(4.8, 5.2, 0.85, 16));
  const deckPlatform = new THREE.Mesh(deckPlatformGeo, pearlStoneMat);
  deckPlatform.position.y = -0.42;
  deckPlatform.receiveShadow = true;
  deckGroup.add(deckPlatform);

  const deckRailingRingGeo = tracker.track(new THREE.TorusGeometry(4.55, 0.06, 8, 24, Math.PI * 1.35));
  deckRailingRingGeo.rotateX(Math.PI / 2);
  const deckRailing = new THREE.Mesh(deckRailingRingGeo, deepNavySupportMat);
  deckRailing.position.y = 0.95;
  deckRailing.rotation.y = -0.4;
  deckGroup.add(deckRailing);

  group.add(deckGroup);

  // 6 White Wisteria Pergola Arches directly over the Northern Bluish Queue Garden Path
  const queueWaypoints = [
    new THREE.Vector3(58.5, 12.58, 75.0),
    new THREE.Vector3(61.2, 12.58, 79.5),
    new THREE.Vector3(63.5, 12.58, 83.5),
    new THREE.Vector3(65.5, 13.15, 86.5),
    new THREE.Vector3(68.2, 12.58, 84.2),
    new THREE.Vector3(69.8, 12.58, 82.2),
  ];

  const pergolaPillarGeo = tracker.track(new THREE.CylinderGeometry(0.16, 0.22, 3.5, 10));
  const pergolaBeamGeo = tracker.track(new THREE.TorusGeometry(2.2, 0.12, 8, 18, Math.PI));
  const wisteriaClusterGeo = tracker.track(new THREE.ConeGeometry(0.32, 1.15, 7));
  wisteriaClusterGeo.rotateX(Math.PI); // Hang downward
  const wisteriaMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.32,
      roughness: 0.5,
    })
  );
  const lanternDropGeo = tracker.track(new THREE.OctahedronGeometry(0.24, 1));

  for (let i = 0; i < queueWaypoints.length; i++) {
    const wp = queueWaypoints[i];
    const nextWp = queueWaypoints[Math.min(queueWaypoints.length - 1, i + 1)];
    const dirAngle = i < queueWaypoints.length - 1
      ? Math.atan2(nextWp.x - wp.x, nextWp.z - wp.z)
      : Math.PI;

    const arbor = new THREE.Group();
    arbor.position.copy(wp);
    arbor.rotation.y = dirAngle;

    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(pergolaPillarGeo, pearlStoneMat);
      col.position.set(side * 2.2, 1.75, 0);
      arbor.add(col);

      const goldRing = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 10)),
        champagneGoldMat
      );
      goldRing.position.set(side * 2.2, 0.2, 0);
      arbor.add(goldRing);

      const lantern = new THREE.Mesh(lanternDropGeo, queueGlowMat);
      lantern.position.set(side * 1.7, 2.9, 0);
      arbor.add(lantern);

      // Blue Hydrangea Planter Mound at each Pergola Column Base
      const planter = new THREE.Mesh(pathwayFlowerMoundGeo, blueFlowerMat);
      planter.position.set(side * 2.45, 0.32, 0);
      arbor.add(planter);
    }

    const archBeam = new THREE.Mesh(pergolaBeamGeo, pearlStoneMat);
    archBeam.position.set(0, 3.4, 0);
    arbor.add(archBeam);

    // Draped Lavender & Blue Wisteria Blossom Clusters
    for (let w = -4; w <= 4; w++) {
      const wAng = (w / 4.2) * (Math.PI * 0.44);
      const blossom = new THREE.Mesh(
        wisteriaClusterGeo,
        w % 2 === 0 ? wisteriaMat : blueFlowerMat
      );
      blossom.position.set(Math.sin(wAng) * 2.1, 3.25 + Math.cos(wAng) * 1.72, (w % 2) * 0.24);
      arbor.add(blossom);
    }

    group.add(arbor);
  }

  // ============================================================================
  // 5. OPEN-AIR SAPPHIRE & PEARL BOARDING STAND / STATION AT (70.0, 12.5, 78.0)
  // ============================================================================
  const stationGroup = new THREE.Group();
  stationGroup.position.set(70.0, 12.5, 78.0);

  // North Boarding Stand (Z = +2.8 -> World Z = 80.8) & South Boarding/Exit Stand (Z = -2.8 -> World Z = 75.2)
  const platformSlabGeo = tracker.track(new THREE.BoxGeometry(17.2, 0.72, 3.8));
  const platformTopTileGeo = tracker.track(new THREE.BoxGeometry(16.8, 0.05, 3.4));
  const tactileStripGeo = tracker.track(new THREE.BoxGeometry(16.6, 0.06, 0.24));

  for (const zSign of [-1, 1]) {
    const platZ = zSign * 2.85;
    const slab = new THREE.Mesh(platformSlabGeo, pearlStoneMat);
    slab.position.set(0, 0.36, platZ);
    slab.receiveShadow = true;
    stationGroup.add(slab);

    // Rich Sapphire-Blue Inlaid Platform Deck Carpeting
    const topTile = new THREE.Mesh(platformTopTileGeo, warmPlazaTileMat);
    topTile.position.set(0, 0.73, platZ);
    topTile.receiveShadow = true;
    stationGroup.add(topTile);

    // Gold Trackside Safety Tactile Strip
    const strip = new THREE.Mesh(tactileStripGeo, champagneGoldMat);
    strip.position.set(0, 0.75, zSign * 1.25);
    stationGroup.add(strip);

    // Grand Stepped Sapphire & Gold Boarding Staircase + Ramp connecting the Bluish Pathway to the Stand
    for (let stepIdx = 0; stepIdx < 4; stepIdx++) {
      const stepH = (stepIdx + 1) * 0.18;
      const stepZ = zSign * (5.9 - stepIdx * 0.38);
      const stepMesh = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(6.2, stepH, 0.42)),
        stepIdx % 2 === 0 ? warmPlazaTileMat : pearlStoneMat
      );
      stepMesh.position.set(0, stepH * 0.5, stepZ);
      stationGroup.add(stepMesh);
    }

    // Gold Stair Handrails & Glowing Crystal Newel Posts flanking the Boarding Stand Stairs
    for (const stairSide of [-1, 1]) {
      const newel = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.16, 0.20, 1.35, 10)),
        pearlStoneMat
      );
      newel.position.set(stairSide * 3.1, 0.68, zSign * 5.8);
      stationGroup.add(newel);

      const newelOrb = new THREE.Mesh(
        tracker.track(new THREE.OctahedronGeometry(0.24, 1)),
        cyanCrystalMat
      );
      newelOrb.position.set(stairSide * 3.1, 1.52, zSign * 5.8);
      stationGroup.add(newelOrb);
    }

    // 4 Illuminated Sapphire-Glass Boarding Gate Bays aligned with the 4 Coaster Cars
    for (let gateIdx = 0; gateIdx < 5; gateIdx++) {
      const gx = -5.2 + gateIdx * 2.6;
      const gatePost = new THREE.Mesh(
        tracker.track(new THREE.CylinderGeometry(0.11, 0.13, 1.15, 10)),
        champagneGoldMat
      );
      gatePost.position.set(gx, 1.28, zSign * 1.38);
      stationGroup.add(gatePost);

      const gateCrystal = new THREE.Mesh(
        tracker.track(new THREE.OctahedronGeometry(0.15, 1)),
        cyanCrystalMat
      );
      gateCrystal.position.set(gx, 1.92, zSign * 1.38);
      stationGroup.add(gateCrystal);

      if (gateIdx < 4) {
        const glassGate = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(1.65, 0.78, 0.06)),
          sapphireGlassMat
        );
        glassGate.position.set(gx + 1.3, 1.18, zSign * 1.38);
        stationGroup.add(glassGate);
      }
    }

    // Luxury Pearl-and-Gold Waiting Benches & Floral Planters on the Boarding Stand
    for (const benchX of [-5.6, 5.6]) {
      const benchSeat = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.4, 0.14, 0.68)),
        pearlStoneMat
      );
      benchSeat.position.set(benchX, 1.16, zSign * 3.85);
      stationGroup.add(benchSeat);

      const benchBack = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(2.4, 0.55, 0.12)),
        champagneGoldMat
      );
      benchBack.position.set(benchX, 1.48, zSign * 4.15);
      stationGroup.add(benchBack);
    }
  }

  // Master Dispatch Control Podium with Glowing Crystal Console on the Boarding Stand
  const podiumBase = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(1.1, 1.18, 0.85)),
    pearlStoneMat
  );
  podiumBase.position.set(6.8, 1.3, 2.4);
  stationGroup.add(podiumBase);

  const podiumScreen = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(0.88, 0.42, 0.55)),
    cyanCrystalMat
  );
  podiumScreen.position.set(6.8, 1.95, 2.4);
  podiumScreen.rotation.x = -0.35;
  stationGroup.add(podiumScreen);

  // 10 Pearl-White Station Columns with Recessed Blue Crystal Panels, Royal-Blue Heart Banners & Vaulted Sapphire Canopy
  const stColGeo = tracker.track(new THREE.BoxGeometry(0.72, 5.5, 0.72));
  const stPanelGeo = tracker.track(new THREE.BoxGeometry(0.44, 3.8, 0.76));
  const canopyArchRibGeo = tracker.track(new THREE.TorusGeometry(4.85, 0.18, 10, 24, Math.PI));
  canopyArchRibGeo.rotateY(Math.PI / 2);

  for (let ix = -2; ix <= 2; ix++) {
    const colX = ix * 3.8;
    for (const zSide of [-1, 1]) {
      const colZ = zSide * 4.65;
      const col = new THREE.Mesh(stColGeo, pearlStoneMat);
      col.position.set(colX, 2.75, colZ);
      col.castShadow = true;
      stationGroup.add(col);

      const bluePanel = new THREE.Mesh(stPanelGeo, cyanCrystalMat);
      bluePanel.position.set(colX, 2.85, colZ);
      stationGroup.add(bluePanel);

      // Blue Hydrangea Floral Planter Box at the base of each Station Column
      const colPlanter = new THREE.Mesh(
        tracker.track(new THREE.BoxGeometry(1.25, 0.55, 0.95)),
        pearlStoneMat
      );
      colPlanter.position.set(colX, 0.95, colZ + zSide * 0.45);
      stationGroup.add(colPlanter);

      const colBlooms = new THREE.Mesh(pathwayFlowerMoundGeo, blueFlowerMat);
      colBlooms.position.set(colX, 1.38, colZ + zSide * 0.45);
      colBlooms.scale.set(1.15, 0.7, 0.95);
      stationGroup.add(colBlooms);

      // Royal-Blue Heraldic Silk Banners with Glowing Crystal Heart Emblem between Columns
      if (ix < 2) {
        const midColX = colX + 1.9;
        const stBanner = new THREE.Mesh(
          tracker.track(new THREE.BoxGeometry(1.45, 2.4, 0.08)),
          royalBannerMat
        );
        stBanner.position.set(midColX, 3.55, colZ);
        stationGroup.add(stBanner);

        const bannerHeart = new THREE.Mesh(
          tracker.track(new THREE.OctahedronGeometry(0.28, 1)),
          cyanCrystalMat
        );
        bannerHeart.position.set(midColX, 3.55, colZ + zSide * 0.08);
        stationGroup.add(bannerHeart);
      }
    }

    const archRib = new THREE.Mesh(canopyArchRibGeo, champagneGoldMat);
    archRib.position.set(colX, 5.35, 0);
    stationGroup.add(archRib);

    // Warm Hanging Station Chandelier Lanterns
    const pendant = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.42, 1)),
      queueGlowMat
    );
    pendant.position.set(colX, 6.85, 0);
    stationGroup.add(pendant);
  }

  // Vaulted Sapphire Glass Barrel Roof over the Station
  const stationVaultGeo = tracker.track(
    new THREE.CylinderGeometry(4.78, 4.78, 16.8, 20, 1, true, 0, Math.PI)
  );
  stationVaultGeo.rotateZ(Math.PI / 2);
  stationVaultGeo.rotateX(Math.PI / 2);
  const stationVault = new THREE.Mesh(stationVaultGeo, sapphireGlassMat);
  stationVault.position.set(0, 5.35, 0);
  stationGroup.add(stationVault);

  // Station Entrance & Exit Portal Heart Crests
  for (const xEnd of [-8.3, 8.3]) {
    const portalHeart = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.68, 1)),
      cyanCrystalMat
    );
    portalHeart.position.set(xEnd, 8.3, 0);
    stationGroup.add(portalHeart);
  }

  // Illuminated "BOARDING STAND / HEARTLINE EXPRESS" Marquee Signs on both North & South Station Facades
  const boardingStandTex = createSignBannerTexture(
    tracker,
    'BOARDING STAND',
    'HEARTLINE — PRESS [E] TO BOARD'
  );
  const boardingStandSignMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: boardingStandTex,
      roughness: 0.22,
      metalness: 0.15,
    })
  );
  for (const zFacade of [-4.95, 4.95]) {
    const marqueeBoard = new THREE.Mesh(
      tracker.track(new THREE.BoxGeometry(6.4, 1.45, 0.36)),
      [
        champagneGoldMat,
        champagneGoldMat,
        champagneGoldMat,
        champagneGoldMat,
        boardingStandSignMat,
        boardingStandSignMat,
      ]
    );
    marqueeBoard.position.set(0, 5.65, zFacade);
    stationGroup.add(marqueeBoard);

    const marqueeHeart = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.48, 1)),
      cyanCrystalMat
    );
    marqueeHeart.position.set(0, 6.68, zFacade);
    stationGroup.add(marqueeHeart);
  }

  group.add(stationGroup);

  // ============================================================================
  // 6. 45M SUMMIT BOTANICAL "I LOVE YOU ❤️" MEADOW AT (90.0, 17.6, 110.0)
  // ============================================================================
  const meadowGroup = new THREE.Group();
  meadowGroup.position.copy(LOVE_MEADOW_CENTER);
  // Tilted -12° around X so the southern upper edge (-Z) rises toward the sky and the face normal points North (+Z) toward the 45m Crest!
  meadowGroup.rotation.x = THREE.MathUtils.degToRad(-12);

  const deepTurfMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.78,
      metalness: 0.02,
    })
  );
  const brightTurfMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.72,
      metalness: 0.02,
    })
  );
  const topiaryLeafMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.65,
    })
  );
  const topiaryCrownBlossomMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 0.48,
      roughness: 0.35,
    })
  );
  const crimsonRoseMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    })
  );

  // Sculpted Oval Hillside Berm + Pearl Stone Rim (deep 6.8m foundation so the tilted edge never dips below ground)
  const bermRimGeo = tracker.track(new THREE.CylinderGeometry(20.5, 23.0, 6.8, 40));
  bermRimGeo.scale(1.28, 1.0, 0.74);
  const bermRim = new THREE.Mesh(bermRimGeo, pearlStoneMat);
  bermRim.position.y = -3.35;
  meadowGroup.add(bermRim);

  const bermLawnGeo = tracker.track(new THREE.CylinderGeometry(19.4, 21.6, 6.95, 40));
  bermLawnGeo.scale(1.28, 1.0, 0.74);
  const bermLawn = new THREE.Mesh(bermLawnGeo, deepTurfMat);
  bermLawn.position.y = -3.22;
  bermLawn.receiveShadow = true;
  meadowGroup.add(bermLawn);

  // Inner Bright-Cut Lawn Oval Framing the Topiary Message
  const innerLawnGeo = tracker.track(new THREE.CylinderGeometry(17.5, 18.2, 0.35, 36));
  innerLawnGeo.scale(1.28, 1.0, 0.70);
  const innerLawn = new THREE.Mesh(innerLawnGeo, brightTurfMat);
  innerLawn.position.y = 0.28;
  meadowGroup.add(innerLawn);

  // Pixel-Grid Bitmap for 3D Sculpted Topiary Letters "I LOVE YOU"
  // Camera at Crest (91, 57.6, 133.5) looks South (-Z) and Down (-Y) at Meadow (90, 17.6, 110.0) with Up = (0, 1, 0):
  // In Three.js lookAt:
  // - Screen Left to Screen Right is -X to +X!
  // - Screen Top to Screen Bottom is -Z (farther/higher) to +Z (closer/lower)!
  const LETTER_PATTERNS: Record<string, string[]> = {
    I: [
      '###',
      ' # ',
      ' # ',
      ' # ',
      '###',
    ],
    L: [
      '#  ',
      '#  ',
      '#  ',
      '#  ',
      '###',
    ],
    O: [
      '###',
      '# #',
      '# #',
      '# #',
      '###',
    ],
    V: [
      '# #',
      '# #',
      '# #',
      '# #',
      ' # ',
    ],
    E: [
      '###',
      '#  ',
      '###',
      '#  ',
      '###',
    ],
    Y: [
      '# #',
      '# #',
      ' # ',
      ' # ',
      ' # ',
    ],
    U: [
      '# #',
      '# #',
      '# #',
      '# #',
      '###',
    ],
  };

  const phrase = 'I LOVE YOU';
  const topiaryBlocks: { x: number; z: number }[] = [];
  let cursorCol = 0;
  for (let chIdx = 0; chIdx < phrase.length; chIdx++) {
    const ch = phrase[chIdx];
    if (ch === ' ') {
      cursorCol += 2.2;
      continue;
    }
    const rows = LETTER_PATTERNS[ch];
    if (rows) {
      for (let r = 0; r < rows.length; r++) {
        const line = rows[r];
        for (let c = 0; c < line.length; c++) {
          if (line[c] === '#') {
            topiaryBlocks.push({
              x: cursorCol + c,
              z: r,
            });
          }
        }
      }
      cursorCol += 4.1;
    }
  }

  // Place "I LOVE YOU" reading Left-to-Right (-X to +X) and Top-to-Bottom (-Z to +Z), with the Giant ❤️ on the Right (+X)
  const blockSize = 0.92;
  const topiaryHedgeGeo = tracker.track(new THREE.BoxGeometry(blockSize, 1.35, blockSize));
  const topiaryCrownGeo = tracker.track(new THREE.BoxGeometry(blockSize * 0.92, 0.32, blockSize * 0.92));

  const hedgeInstanced = tracker.track(
    new THREE.InstancedMesh(topiaryHedgeGeo, topiaryLeafMat, topiaryBlocks.length)
  );
  const crownInstanced = tracker.track(
    new THREE.InstancedMesh(topiaryCrownGeo, topiaryCrownBlossomMat, topiaryBlocks.length)
  );

  for (let i = 0; i < topiaryBlocks.length; i++) {
    const b = topiaryBlocks[i];
    // Map cursorCol (0..38) from -21.5 (Screen Left) to +8.5 (Screen Right)
    const lx = -21.5 + b.x * 0.82;
    // Map row r (0..4, top to bottom) from -3.8 (Screen Top) to +1.8 (Screen Bottom)
    const lz = (b.z - 2.0) * 1.40 - 1.0;

    _scratchPos.set(lx, 0.85, lz);
    _scratchQuat.identity();
    _scratchScale.set(1, 1, 1);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    hedgeInstanced.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(lx, 1.62, lz);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    crownInstanced.setMatrixAt(i, _scratchMat4);
  }
  hedgeInstanced.instanceMatrix.needsUpdate = true;
  crownInstanced.instanceMatrix.needsUpdate = true;
  meadowGroup.add(hedgeInstanced);
  meadowGroup.add(crownInstanced);

  // Giant Natural Red Rose Heart (❤️) on the right side of the phrase (local X ≈ +15.8, Z ≈ -1.0)
  // Top lobes (gz > 0) placed toward -Z (Screen Top), bottom point (gz < 0) placed toward +Z (Screen Bottom)
  const rosePoints: { x: number; z: number; s: number }[] = [];
  for (let gx = -1.35; gx <= 1.35; gx += 0.14) {
    for (let gz = -1.25; gz <= 1.35; gz += 0.14) {
      const a = gx * gx + gz * gz - 1.0;
      if (a * a * a - gx * gx * (gz * gz * gz) <= 0.0) {
        rosePoints.push({
          x: 15.8 + gx * 4.8,
          z: -1.0 - gz * 4.5,
          s: 0.85 + ((Math.abs(gx * 17 + gz * 31) % 10) / 10) * 0.35,
        });
      }
    }
  }

  const roseBushGeo = tracker.track(new THREE.DodecahedronGeometry(0.58, 1));
  const roseHeartInstanced = tracker.track(
    new THREE.InstancedMesh(roseBushGeo, crimsonRoseMat, rosePoints.length)
  );
  for (let i = 0; i < rosePoints.length; i++) {
    const rp = rosePoints[i];
    _scratchPos.set(rp.x, 1.05, rp.z);
    _scratchQuat.identity();
    _scratchScale.set(rp.s, rp.s * 1.15, rp.s);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    roseHeartInstanced.setMatrixAt(i, _scratchMat4);
  }
  roseHeartInstanced.instanceMatrix.needsUpdate = true;
  meadowGroup.add(roseHeartInstanced);

  // Secondary Smaller Golden Blossom Heart below "LOVE" (centered at local X ≈ -4.2, Z ≈ +6.2)
  const goldHeartGeo = tracker.track(new THREE.OctahedronGeometry(0.52, 1));
  const smallHeartPoints: { x: number; z: number }[] = [];
  for (let gx = -1.2; gx <= 1.2; gx += 0.25) {
    for (let gz = -1.1; gz <= 1.2; gz += 0.25) {
      const a = gx * gx + gz * gz - 1.0;
      if (a * a * a - gx * gx * (gz * gz * gz) <= 0.0) {
        smallHeartPoints.push({
          x: -4.2 + gx * 2.4,
          z: 6.2 - gz * 2.2,
        });
      }
    }
  }
  const smallGoldHeartInstanced = tracker.track(
    new THREE.InstancedMesh(goldHeartGeo, topiaryCrownBlossomMat, smallHeartPoints.length)
  );
  for (let i = 0; i < smallHeartPoints.length; i++) {
    const sp = smallHeartPoints[i];
    _scratchPos.set(sp.x, 0.65, sp.z);
    _scratchQuat.identity();
    _scratchScale.set(1, 0.8, 1);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    smallGoldHeartInstanced.setMatrixAt(i, _scratchMat4);
  }
  smallGoldHeartInstanced.instanceMatrix.needsUpdate = true;
  meadowGroup.add(smallGoldHeartInstanced);

  group.add(meadowGroup);

  // ============================================================================
  // 7. GEMSTONE CRYSTAL TUNNEL & ARCHED STONE BRIDGE AT (96.0, 14.2, 69.5)
  // ============================================================================
  const CRYSTAL_RIB_COUNT = 14;
  const crystalSpireLeftGeo = new THREE.ConeGeometry(0.65, 3.8, 6);
  crystalSpireLeftGeo.translate(-2.4, 1.8, 0);
  crystalSpireLeftGeo.rotateZ(-0.28);
  const crystalSpireRightGeo = new THREE.ConeGeometry(0.65, 3.8, 6);
  crystalSpireRightGeo.translate(2.4, 1.8, 0);
  crystalSpireRightGeo.rotateZ(0.28);
  const crystalCrownArchGeo = new THREE.TorusGeometry(2.65, 0.34, 6, 12, Math.PI);
  crystalCrownArchGeo.translate(0, 2.2, 0);
  const mergedCrystalRibGeo = tracker.track(
    mergeGeometries([crystalSpireLeftGeo, crystalSpireRightGeo, crystalCrownArchGeo], false)
  );
  crystalSpireLeftGeo.dispose();
  crystalSpireRightGeo.dispose();
  crystalCrownArchGeo.dispose();

  const crystalRibMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.65,
      roughness: 0.14,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
    })
  );

  const crystalTunnelRibsMesh = tracker.track(
    new THREE.InstancedMesh(mergedCrystalRibGeo, crystalRibMat, CRYSTAL_RIB_COUNT)
  );
  for (let i = 0; i < CRYSTAL_RIB_COUNT; i++) {
    // T+00s Transition In: Crystal Tunnel deepens along u = 0.524..0.562 as the track plunges into the ocean coral reef!
    const u = 0.524 + (i / (CRYSTAL_RIB_COUNT - 1)) * 0.038;
    spline.evaluateAtU(u, sampleFrame);
    _scratchForward.copy(sampleFrame.tangent).normalize();
    _scratchUp.copy(sampleFrame.normal).normalize();
    _scratchRight.crossVectors(_scratchUp, _scratchForward).normalize();
    _scratchUp.crossVectors(_scratchForward, _scratchRight).normalize();
    _scratchMat4.makeBasis(_scratchRight, _scratchUp, _scratchForward);
    _scratchMat4.setPosition(sampleFrame.pos);
    crystalTunnelRibsMesh.setMatrixAt(i, _scratchMat4);
    crystalTunnelRibsMesh.setColorAt(i, _scratchColor.setHex(0x22d3ee));
  }
  crystalTunnelRibsMesh.instanceMatrix.needsUpdate = true;
  if (crystalTunnelRibsMesh.instanceColor) crystalTunnelRibsMesh.instanceColor.needsUpdate = true;
  group.add(crystalTunnelRibsMesh);

  // ============================================================================
  // 7B. MAGICAL UNDERWATER CORAL REEF JOURNEY (T+00s to T+28s)
  // ============================================================================
  const underwaterReef = createHeartlineUnderwaterReef(spline, tracker);
  group.add(underwaterReef.group);

  // ============================================================================
  // 8. CHOREOGRAPHY INSTANCED BEACONS (DEPARTURE, HEARTLINE LOOP, BUTTERFLIES)
  // ============================================================================
  const beaconCrystalGeo = tracker.track(new THREE.OctahedronGeometry(0.32, 1));
  const beaconMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.95,
      roughness: 0.15,
    })
  );

  // 10 Departure Beacons (5 pairs along u = 0.042..0.088)
  const DEPARTURE_BEACON_COUNT = 10;
  const departureBeaconsMesh = tracker.track(
    new THREE.InstancedMesh(beaconCrystalGeo, beaconMat, DEPARTURE_BEACON_COUNT)
  );
  for (let pair = 0; pair < 5; pair++) {
    const u = 0.042 + (pair / 4) * 0.045;
    spline.evaluateAtU(u, sampleFrame);
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const side = sideIdx === 0 ? -1 : 1;
      const idx = pair * 2 + sideIdx;
      _scratchPos
        .copy(sampleFrame.pos)
        .addScaledVector(sampleFrame.binormal, side * 1.35)
        .addScaledVector(sampleFrame.normal, 0.55);
      _scratchQuat.identity();
      _scratchScale.set(1, 1.4, 1);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      departureBeaconsMesh.setMatrixAt(idx, _scratchMat4);
      departureBeaconsMesh.setColorAt(idx, _scratchColor.setHex(0x0ea5e9));
    }
  }
  departureBeaconsMesh.instanceMatrix.needsUpdate = true;
  if (departureBeaconsMesh.instanceColor) departureBeaconsMesh.instanceColor.needsUpdate = true;
  group.add(departureBeaconsMesh);

  // 14 Heartline Loop Beacons along u = 0.64..0.75
  const HEARTLINE_BEACON_COUNT = 14;
  const heartlineBeaconsMesh = tracker.track(
    new THREE.InstancedMesh(beaconCrystalGeo, beaconMat, HEARTLINE_BEACON_COUNT)
  );
  for (let i = 0; i < HEARTLINE_BEACON_COUNT; i++) {
    const u = 0.64 + (i / (HEARTLINE_BEACON_COUNT - 1)) * 0.11;
    spline.evaluateAtU(u, sampleFrame);
    _scratchPos.copy(sampleFrame.pos).addScaledVector(sampleFrame.normal, -0.52);
    _scratchQuat.identity();
    _scratchScale.set(1.2, 1.2, 1.2);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    heartlineBeaconsMesh.setMatrixAt(i, _scratchMat4);
    heartlineBeaconsMesh.setColorAt(i, _scratchColor.setHex(0x38bdf8));
  }
  heartlineBeaconsMesh.instanceMatrix.needsUpdate = true;
  if (heartlineBeaconsMesh.instanceColor) heartlineBeaconsMesh.instanceColor.needsUpdate = true;
  group.add(heartlineBeaconsMesh);

  // 24 Ambient Meadow Butterflies
  const BUTTERFLY_COUNT = 24;
  const butterflyGeo = tracker.track(new THREE.PlaneGeometry(0.32, 0.24));
  const butterflyMat = tracker.track(
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
    })
  );
  const meadowButterfliesMesh = tracker.track(
    new THREE.InstancedMesh(butterflyGeo, butterflyMat, BUTTERFLY_COUNT)
  );
  group.add(meadowButterfliesMesh);

  // ============================================================================
  // 9. BOTANICAL TREES, BLUE HYDRANGEAS & CASTLE-SIDE GARDEN BUFFER (INSTANCED)
  // ============================================================================
  const gardenSpots: { x: number; z: number; scale: number }[] = [
    // Entrance & Ticket Forecourt Outer Borders (placed well outside the Entrance Arch sightline!)
    { x: 36.5, z: 71.5, scale: 1.15 },
    { x: 54.5, z: 61.5, scale: 1.15 },
    { x: 45.0, z: 76.5, scale: 1.25 },
    { x: 60.5, z: 66.5, scale: 1.1 },
    // Southern Thrill Zone Border (framing the Dream Castle Flyby at z = 65..69, well clear of Castle Rear Garden z <= 56.5)
    { x: 81.0, z: 65.5, scale: 1.25 },
    { x: 88.0, z: 65.0, scale: 1.3 },
    { x: 95.0, z: 65.0, scale: 1.3 },
    { x: 103.0, z: 65.5, scale: 1.35 },
    { x: 110.5, z: 66.5, scale: 1.3 },
    { x: 116.0, z: 69.0, scale: 1.25 },
    // Meadow Perimeter Grove (North & East rim behind the Love Meadow)
    { x: 67.0, z: 114.0, scale: 1.4 },
    { x: 74.0, z: 124.0, scale: 1.5 },
    { x: 84.0, z: 127.0, scale: 1.45 },
    { x: 97.0, z: 126.0, scale: 1.5 },
    { x: 108.0, z: 118.0, scale: 1.4 },
    { x: 114.0, z: 104.0, scale: 1.35 },
    // Final Helix Interior Garden
    { x: 48.0, z: 86.0, scale: 1.3 },
    { x: 52.5, z: 89.0, scale: 1.2 },
  ];

  const trunkGeo = tracker.track(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8));
  const trunkMat = tracker.track(new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 }));
  const canopyGeo = tracker.track(new THREE.DodecahedronGeometry(1.85, 1));
  const hydrangeaMoundGeo = tracker.track(new THREE.SphereGeometry(0.95, 10, 8));
  const hydrangeaMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.18,
      roughness: 0.55,
    })
  );

  const trunksInst = tracker.track(new THREE.InstancedMesh(trunkGeo, trunkMat, gardenSpots.length));
  const canopiesInst = tracker.track(new THREE.InstancedMesh(canopyGeo, topiaryLeafMat, gardenSpots.length));
  const hydrangeasInst = tracker.track(
    new THREE.InstancedMesh(hydrangeaMoundGeo, hydrangeaMat, gardenSpots.length)
  );

  for (let i = 0; i < gardenSpots.length; i++) {
    const gs = gardenSpots[i];
    const s = gs.scale;
    const gY = getTerrainHeight(gs.x, gs.z);
    _scratchPos.set(gs.x, gY + 1.2 * s, gs.z);
    _scratchQuat.identity();
    _scratchScale.set(s, s, s);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    trunksInst.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(gs.x, gY + 3.1 * s, gs.z);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    canopiesInst.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(gs.x + 1.4, gY + 0.35 * s, gs.z - 0.8);
    _scratchScale.set(s * 0.9, s * 0.55, s * 0.9);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    hydrangeasInst.setMatrixAt(i, _scratchMat4);
  }
  trunksInst.instanceMatrix.needsUpdate = true;
  canopiesInst.instanceMatrix.needsUpdate = true;
  hydrangeasInst.instanceMatrix.needsUpdate = true;
  group.add(trunksInst);
  group.add(canopiesInst);
  group.add(hydrangeasInst);

  // ============================================================================
  // 9B. ROMANTIC LOVER'S CRYSTAL HEART BRIDGE, ROTUNDA & LAGOON SKYWALK
  // ============================================================================
  interface SkywalkBarrierSegment {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
  }
  const skywalkBarrierSegments: SkywalkBarrierSegment[] = [];
  const floatingBridgeHeartCrystals: THREE.Object3D[] = [];

  {
    const skywalkGroup = new THREE.Group();
    skywalkGroup.name = 'CrystalGlassLagoonSkywalk';

    const crystalWalkwayGlassMat = tracker.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.24,
        roughness: 0.08,
        metalness: 0.08,
        transmission: 0.55,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    const balustradeGlassMat = tracker.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.5,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    const romanticRoseGlowMat = tracker.track(
      new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xec4899,
        emissiveIntensity: 0.95,
        roughness: 0.18,
        metalness: 0.22,
      })
    );

    const softBlushPetalMat = tracker.track(
      new THREE.MeshStandardMaterial({
        color: 0xfda4af,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.38,
        roughness: 0.32,
        metalness: 0.08,
      })
    );

    const warmLanternHeartMat = tracker.track(
      new THREE.MeshStandardMaterial({
        color: 0xffe4e6,
        emissive: 0xfb7185,
        emissiveIntensity: 1.25,
        roughness: 0.14,
      })
    );

    const DECK_Y = 12.55;
    const DECK_THICK = 0.22;

    function addGlassDeckSection(
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
      topY = DECK_Y,
      useRoseAccent = false
    ): void {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;

      // Transparent Crystal-Glass Floor Slab
      const slabGeo = tracker.track(new THREE.BoxGeometry(w, DECK_THICK, d));
      const slabMesh = new THREE.Mesh(slabGeo, crystalWalkwayGlassMat);
      slabMesh.position.set(cx, topY - DECK_THICK * 0.5, cz);
      slabMesh.renderOrder = 4;
      skywalkGroup.add(slabMesh);

      // Outer & Inner Pearl-and-Gold Structural Edge Curbs + Dual Cyan/Rose LED Trim
      const curbAlongX = w >= d;
      const accentMat = useRoseAccent ? romanticRoseGlowMat : cyanCrystalMat;
      if (curbAlongX) {
        const curbGeo = tracker.track(new THREE.BoxGeometry(w, DECK_THICK + 0.06, 0.24));
        const glowStripGeo = tracker.track(new THREE.BoxGeometry(w, 0.045, 0.09));
        for (const zEdge of [minZ + 0.12, maxZ - 0.12]) {
          const curb = new THREE.Mesh(curbGeo, pearlStoneMat);
          curb.position.set(cx, topY - DECK_THICK * 0.5 + 0.01, zEdge);
          const glow = new THREE.Mesh(glowStripGeo, accentMat);
          glow.position.set(cx, topY + 0.025, zEdge);
          skywalkGroup.add(curb, glow);
        }
        const ribCount = Math.max(2, Math.floor(w / 4.2));
        const ribGeo = tracker.track(new THREE.BoxGeometry(0.22, DECK_THICK + 0.03, d - 0.2));
        for (let i = 0; i <= ribCount; i++) {
          const rx = minX + (i / ribCount) * w;
          const rib = new THREE.Mesh(ribGeo, champagneGoldMat);
          rib.position.set(rx, topY - DECK_THICK * 0.5, cz);
          skywalkGroup.add(rib);
        }
      } else {
        const curbGeo = tracker.track(new THREE.BoxGeometry(0.26, DECK_THICK + 0.06, d));
        const glowStripGeo = tracker.track(new THREE.BoxGeometry(0.09, 0.045, d));
        const innerRoseStripGeo = tracker.track(new THREE.BoxGeometry(0.06, 0.045, d));
        for (const side of [-1, 1]) {
          const xEdge = side < 0 ? minX + 0.13 : maxX - 0.13;
          const curb = new THREE.Mesh(curbGeo, pearlStoneMat);
          curb.position.set(xEdge, topY - DECK_THICK * 0.5 + 0.01, cz);
          const glow = new THREE.Mesh(glowStripGeo, accentMat);
          glow.position.set(xEdge, topY + 0.026, cz);
          const innerCyan = new THREE.Mesh(innerRoseStripGeo, cyanCrystalMat);
          innerCyan.position.set(xEdge - side * 0.18, topY + 0.022, cz);
          skywalkGroup.add(curb, glow, innerCyan);
        }
        const ribCount = Math.max(2, Math.floor(d / 3.0));
        const ribGeo = tracker.track(new THREE.BoxGeometry(w - 0.2, DECK_THICK + 0.03, 0.24));
        for (let i = 0; i <= ribCount; i++) {
          const rz = minZ + (i / ribCount) * d;
          const rib = new THREE.Mesh(ribGeo, champagneGoldMat);
          rib.position.set(cx, topY - DECK_THICK * 0.5, rz);
          skywalkGroup.add(rib);
        }
      }
    }

    // 1. South Crystal Glass Promenade (x: 76.5..144.8, z: 62.0..66.2)
    addGlassDeckSection(76.5, 144.8, 62.0, 66.2, DECK_Y, false);

    // 2. North Crystal Glass Promenade (x: 76.5..144.8, z: 90.2..94.4)
    addGlassDeckSection(76.5, 144.8, 90.2, 94.4, DECK_Y, false);

    // 3. East Crystal Glass Overlook Terrace (x: 140.5..144.8, z: 66.2..90.2)
    addGlassDeckSection(140.5, 144.8, 66.2, 90.2, DECK_Y, false);

    // 4. West Station-to-Lagoon Connector Deck (x: 76.5..80.6, z: 66.2..90.2)
    addGlassDeckSection(76.5, 80.6, 66.2, 90.2, DECK_Y, false);

    // 5. Central Lover's Crystal Heart Bridge (x: 111.0..116.5, z: 66.2..90.2)
    addGlassDeckSection(111.0, 116.5, 66.2, 90.2, DECK_Y + 0.01, true);

    // 6. Central Circular "Lover's Overlook Rotunda" Deck at Bridge Midpoint (113.75, 78.2, radius = 4.15m)
    const rotundaCylGeo = tracker.track(new THREE.CylinderGeometry(4.15, 4.15, DECK_THICK, 36));
    const rotundaSlab = new THREE.Mesh(rotundaCylGeo, crystalWalkwayGlassMat);
    rotundaSlab.position.set(113.75, DECK_Y + 0.01 - DECK_THICK * 0.5, 78.2);
    rotundaSlab.renderOrder = 4;
    skywalkGroup.add(rotundaSlab);

    const rotundaGoldRimGeo = tracker.track(new THREE.RingGeometry(3.88, 4.16, 40));
    rotundaGoldRimGeo.rotateX(-Math.PI / 2);
    const rotundaGoldRim = new THREE.Mesh(rotundaGoldRimGeo, champagneGoldMat);
    rotundaGoldRim.position.set(113.75, DECK_Y + 0.025, 78.2);
    skywalkGroup.add(rotundaGoldRim);

    const rotundaRoseInnerRingGeo = tracker.track(new THREE.RingGeometry(2.35, 2.55, 36));
    rotundaRoseInnerRingGeo.rotateX(-Math.PI / 2);
    const rotundaRoseRing = new THREE.Mesh(rotundaRoseInnerRingGeo, romanticRoseGlowMat);
    rotundaRoseRing.position.set(113.75, DECK_Y + 0.028, 78.2);
    skywalkGroup.add(rotundaRoseRing);

    // 7. Parametric 3D Heart Geometry Helper for Overhead Heart Arches, Floor Medallions & Chandeliers
    function buildHeartTubeGeo(
      scaleX: number,
      scaleY: number,
      tubeRadius: number,
      tubularSegments = 56
    ): THREE.TubeGeometry {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= tubularSegments; i++) {
        const t = (i / tubularSegments) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3) * scaleX;
        const hy =
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
          scaleY;
        pts.push(new THREE.Vector3(hx, hy, 0));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      return tracker.track(new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, 10, true));
    }

    // 5 Inlaid Glowing Heart Stepping Medallions down the centerline of the Lover's Bridge (x = 113.75)
    const floorHeartGeo = buildHeartTubeGeo(0.065, 0.062, 0.045, 40);
    floorHeartGeo.rotateX(-Math.PI / 2);
    const floorMedallionRingGeo = tracker.track(new THREE.RingGeometry(1.12, 1.25, 28));
    floorMedallionRingGeo.rotateX(-Math.PI / 2);
    const bridgeMedallionZs = [69.5, 73.8, 78.2, 82.6, 86.9];
    for (let m = 0; m < bridgeMedallionZs.length; m++) {
      const mz = bridgeMedallionZs[m];
      const isCenter = m === 2;
      const heartInlay = new THREE.Mesh(
        floorHeartGeo,
        m % 2 === 0 ? romanticRoseGlowMat : cyanCrystalMat
      );
      heartInlay.position.set(113.75, DECK_Y + 0.03, mz);
      const s = isCenter ? 1.55 : 1.0;
      heartInlay.scale.set(s, 1.0, s);
      skywalkGroup.add(heartInlay);

      const mRing = new THREE.Mesh(floorMedallionRingGeo, champagneGoldMat);
      mRing.position.set(113.75, DECK_Y + 0.024, mz);
      mRing.scale.setScalar(isCenter ? 1.45 : 0.92);
      skywalkGroup.add(mRing);
    }

    // 8. 5 Grand Overhead Glowing Twin-Heart Floral & Crystal Arches spanning the Lover's Bridge!
    const archOuterHeartGeo = buildHeartTubeGeo(0.22, 0.195, 0.095, 64);
    const archInnerHeartGeo = buildHeartTubeGeo(0.198, 0.175, 0.055, 64);
    const chandelierHeartGeo = buildHeartTubeGeo(0.036, 0.034, 0.035, 36);
    const chandelierCoreGeo = tracker.track(new THREE.OctahedronGeometry(0.18, 1));
    const blossomGeo = tracker.track(new THREE.DodecahedronGeometry(0.16, 0));
    const archPedestalGeo = tracker.track(new THREE.CylinderGeometry(0.26, 0.34, 0.65, 12));

    const archLocationsZ = [67.4, 72.8, 78.2, 83.6, 89.0];
    for (let a = 0; a < archLocationsZ.length; a++) {
      const az = archLocationsZ[a];
      const isCenterRotundaArch = a === 2;
      const archScaleX = isCenterRotundaArch ? 1.24 : 1.02;
      const archScaleY = isCenterRotundaArch ? 1.18 : 1.04;

      const archGroup = new THREE.Group();
      archGroup.position.set(113.75, DECK_Y + 2.55 * archScaleY, az);
      archGroup.scale.set(archScaleX, archScaleY, 1.0);

      const outerHeart = new THREE.Mesh(
        archOuterHeartGeo,
        a % 2 === 0 ? romanticRoseGlowMat : cyanCrystalMat
      );
      const innerHeart = new THREE.Mesh(archInnerHeartGeo, champagneGoldMat);
      innerHeart.position.z = 0.09;
      const backHeart = new THREE.Mesh(
        archInnerHeartGeo,
        a % 2 === 0 ? cyanCrystalMat : romanticRoseGlowMat
      );
      backHeart.position.z = -0.09;
      archGroup.add(outerHeart, innerHeart, backHeart);

      // Romantic Rose-Blossom Garland Clusters draped along the upper lobes of each Heart Arch
      for (let b = 0; b < 14; b++) {
        const bt = (b / 14) * Math.PI * 2;
        const bx = 16 * Math.pow(Math.sin(bt), 3) * 0.21;
        const by =
          (13 * Math.cos(bt) -
            5 * Math.cos(2 * bt) -
            2 * Math.cos(3 * bt) -
            Math.cos(4 * bt)) *
          0.185;
        if (by > -0.8) {
          const blossom = new THREE.Mesh(
            blossomGeo,
            b % 2 === 0 ? softBlushPetalMat : warmLanternHeartMat
          );
          blossom.position.set(bx, by, (b % 2 === 0 ? 1 : -1) * 0.14);
          archGroup.add(blossom);
        }
      }

      // Suspended Floating Rose-Quartz & Diamond Heart Chandelier at the Crown of the Arch
      const chandelierGroup = new THREE.Group();
      chandelierGroup.position.set(0, 0.85, 0);
      const chLoop = new THREE.Mesh(chandelierHeartGeo, warmLanternHeartMat);
      const chGem = new THREE.Mesh(chandelierCoreGeo, cyanCrystalMat);
      chandelierGroup.add(chLoop, chGem);
      archGroup.add(chandelierGroup);
      floatingBridgeHeartCrystals.push(chandelierGroup);

      // Left & Right Pearl-and-Gold Arch Base Pedestals anchored to the bridge curbs
      const pedOffsetX = isCenterRotundaArch ? 3.85 : 2.65;
      for (const side of [-1, 1]) {
        const ped = new THREE.Mesh(archPedestalGeo, pearlStoneMat);
        ped.position.set(113.75 + side * pedOffsetX, DECK_Y + 0.32, az);
        skywalkGroup.add(ped);
      }

      skywalkGroup.add(archGroup);
    }

    // 9. Two Sculpted Pearl & Rose-Gold Lover's Benches in the West & East Rotunda Observation Bays
    const benchSeatGeo = tracker.track(new THREE.BoxGeometry(0.62, 0.1, 1.85));
    const benchLegGeo = tracker.track(new THREE.BoxGeometry(0.56, 0.42, 0.14));
    const benchBackHeartGeo = buildHeartTubeGeo(0.032, 0.03, 0.032, 32);
    for (const side of [-1, 1]) {
      const benchGroup = new THREE.Group();
      benchGroup.position.set(113.75 + side * 3.15, DECK_Y + 0.02, 78.2);
      benchGroup.rotation.y = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

      const seat = new THREE.Mesh(benchSeatGeo, pearlStoneMat);
      seat.position.set(0, 0.44, 0);
      const legL = new THREE.Mesh(benchLegGeo, champagneGoldMat);
      legL.position.set(0, 0.21, -0.72);
      const legR = new THREE.Mesh(benchLegGeo, champagneGoldMat);
      legR.position.set(0, 0.21, 0.72);

      // Twin Heart Backrests
      for (const hz of [-0.42, 0.42]) {
        const hBack = new THREE.Mesh(benchBackHeartGeo, romanticRoseGlowMat);
        hBack.rotation.y = Math.PI * 0.5;
        hBack.position.set(-0.26, 0.86, hz);
        benchGroup.add(hBack);
      }
      benchGroup.add(seat, legL, legR);
      skywalkGroup.add(benchGroup);
    }

    // 10. Grand Stepped Crystal & Pearl Garden Terrace Ramp (x: 76.5..106.0, z: 57.5..62.0)
    // Connects the entire Dream Castle Rear Garden (Y = 10.0m) smoothly up to the South Glass Promenade (Y = 12.55m)
    const RAMP_STEPS = 12;
    const rampStepGeo = tracker.track(new THREE.BoxGeometry(29.5, 0.26, 0.44));
    const rampRoseTrimGeo = tracker.track(new THREE.BoxGeometry(29.5, 0.04, 0.08));
    for (let s = 0; s < RAMP_STEPS; s++) {
      const t = (s + 0.5) / RAMP_STEPS;
      const sz = THREE.MathUtils.lerp(57.55, 61.95, t);
      const sy = THREE.MathUtils.lerp(10.02, DECK_Y, t);
      const stepMesh = new THREE.Mesh(
        rampStepGeo,
        s % 2 === 0 ? pearlStoneMat : crystalWalkwayGlassMat
      );
      stepMesh.position.set(91.25, sy - 0.12, sz);
      const stepGlow = new THREE.Mesh(
        rampRoseTrimGeo,
        s % 2 === 0 ? romanticRoseGlowMat : cyanCrystalMat
      );
      stepGlow.position.set(91.25, sy + 0.015, sz - 0.18);
      skywalkGroup.add(stepMesh, stepGlow);
    }

    // 11. Complete, Gap-Free Crystal-Glass & Rose-Gold Safety Balustrades + Physical Collision Barriers
    const RAIL_H = 1.28;
    const postGeo = tracker.track(new THREE.CylinderGeometry(0.09, 0.11, RAIL_H, 10));
    const finialHeartGeo = buildHeartTubeGeo(0.012, 0.012, 0.016, 20);
    const lanternPoleGeo = tracker.track(new THREE.CylinderGeometry(0.055, 0.075, 2.55, 10));
    const lanternGlobeGeo = tracker.track(new THREE.OctahedronGeometry(0.22, 1));

    function addGlassBalustradeRun(
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      baseY1 = DECK_Y,
      baseY2 = baseY1,
      withLanterns = false
    ): void {
      // Register physical barrier segment for 100% leak-proof player collision!
      skywalkBarrierSegments.push({ x1, z1, x2, z2 });

      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.2) return;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const my = (baseY1 + baseY2) * 0.5;
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      const pitch = -Math.atan2(baseY2 - baseY1, len);
      const slopeLen = Math.hypot(len, baseY2 - baseY1);

      const railGroup = new THREE.Group();
      railGroup.position.set(mx, my, mz);
      railGroup.rotation.y = yaw;
      railGroup.rotation.x = pitch;

      // Tempered Crystal-Glass Safety Barrier Panel
      const panelGeo = tracker.track(new THREE.BoxGeometry(0.07, RAIL_H - 0.18, slopeLen));
      const panelMesh = new THREE.Mesh(panelGeo, balustradeGlassMat);
      panelMesh.position.set(0, RAIL_H * 0.5, 0);
      panelMesh.renderOrder = 5;
      railGroup.add(panelMesh);

      // Champagne-Gold Top Handrail, Rose-Pink Middle Accent Rail & Pearl Base Curb
      const topRailGeo = tracker.track(new THREE.BoxGeometry(0.15, 0.085, slopeLen + 0.12));
      const topRail = new THREE.Mesh(topRailGeo, champagneGoldMat);
      topRail.position.set(0, RAIL_H, 0);

      const midRoseGeo = tracker.track(new THREE.BoxGeometry(0.09, 0.045, slopeLen + 0.08));
      const midRose = new THREE.Mesh(midRoseGeo, romanticRoseGlowMat);
      midRose.position.set(0, RAIL_H * 0.58, 0);

      const botRailGeo = tracker.track(new THREE.BoxGeometry(0.18, 0.11, slopeLen + 0.12));
      const botRail = new THREE.Mesh(botRailGeo, pearlStoneMat);
      botRail.position.set(0, 0.055, 0);
      railGroup.add(topRail, midRose, botRail);
      skywalkGroup.add(railGroup);

      // Stanchion Posts, Glowing Heart Finials & Romantic Lantern Posts
      const postCount = Math.max(1, Math.round(len / 4.0));
      for (let i = 0; i <= postCount; i++) {
        const t = i / postCount;
        const px = THREE.MathUtils.lerp(x1, x2, t);
        const pz = THREE.MathUtils.lerp(z1, z2, t);
        const py = THREE.MathUtils.lerp(baseY1, baseY2, t);

        const post = new THREE.Mesh(postGeo, champagneGoldMat);
        post.position.set(px, py + RAIL_H * 0.5, pz);
        const finial = new THREE.Mesh(
          finialHeartGeo,
          i % 2 === 0 ? romanticRoseGlowMat : cyanCrystalMat
        );
        finial.position.set(px, py + RAIL_H + 0.18, pz);
        finial.rotation.y = yaw + Math.PI * 0.5;
        skywalkGroup.add(post, finial);

        if (withLanterns && i > 0 && i < postCount && i % 2 === 1) {
          const lPole = new THREE.Mesh(lanternPoleGeo, champagneGoldMat);
          lPole.position.set(px, py + 1.28, pz);
          const lGlobe = new THREE.Mesh(lanternGlobeGeo, warmLanternHeartMat);
          lGlobe.position.set(px, py + 2.66, pz);
          skywalkGroup.add(lPole, lGlobe);
        }
      }
    }

    // --- A. 100% CLOSED INNER WEST LAGOON CUTOUT LOOP (x = 80.6..111.0, z = 66.2..90.2, curving around West Rotunda Bay) ---
    addGlassBalustradeRun(80.6, 66.2, 111.0, 66.2, DECK_Y, DECK_Y, true);
    addGlassBalustradeRun(111.0, 66.2, 111.0, 74.4, DECK_Y + 0.01, DECK_Y + 0.01, true);
    addGlassBalustradeRun(111.0, 74.4, 109.65, 76.3, DECK_Y + 0.01, DECK_Y + 0.01, false);
    addGlassBalustradeRun(109.65, 76.3, 109.65, 80.1, DECK_Y + 0.01, DECK_Y + 0.01, true);
    addGlassBalustradeRun(109.65, 80.1, 111.0, 82.0, DECK_Y + 0.01, DECK_Y + 0.01, false);
    addGlassBalustradeRun(111.0, 82.0, 111.0, 90.2, DECK_Y + 0.01, DECK_Y + 0.01, true);
    addGlassBalustradeRun(111.0, 90.2, 80.6, 90.2, DECK_Y, DECK_Y, true);
    addGlassBalustradeRun(80.6, 90.2, 80.6, 66.2, DECK_Y, DECK_Y, false);

    // --- B. 100% CLOSED INNER EAST LAGOON CUTOUT LOOP (x = 116.5..140.5, z = 66.2..90.2, curving around East Rotunda Bay) ---
    addGlassBalustradeRun(116.5, 66.2, 140.5, 66.2, DECK_Y, DECK_Y, true);
    addGlassBalustradeRun(140.5, 66.2, 140.5, 90.2, DECK_Y, DECK_Y, true);
    addGlassBalustradeRun(140.5, 90.2, 116.5, 90.2, DECK_Y, DECK_Y, true);
    addGlassBalustradeRun(116.5, 90.2, 116.5, 82.0, DECK_Y + 0.01, DECK_Y + 0.01, true);
    addGlassBalustradeRun(116.5, 82.0, 117.85, 80.1, DECK_Y + 0.01, DECK_Y + 0.01, false);
    addGlassBalustradeRun(117.85, 80.1, 117.85, 76.3, DECK_Y + 0.01, DECK_Y + 0.01, true);
    addGlassBalustradeRun(117.85, 76.3, 116.5, 74.4, DECK_Y + 0.01, DECK_Y + 0.01, false);
    addGlassBalustradeRun(116.5, 74.4, 116.5, 66.2, DECK_Y + 0.01, DECK_Y + 0.01, true);

    // --- C. OUTER PERIMETER & RAMP SIDEWALL BALUSTRADES (Zero Unprotected Drop-Offs Anywhere) ---
    // West Sidewall of the Grand South Ramp (x = 76.5, z = 57.5..62.0)
    addGlassBalustradeRun(76.5, 57.5, 76.5, 62.0, 10.02, DECK_Y, true);
    // East Sidewall of the Grand South Ramp (x = 106.0, z = 57.5..62.0)
    addGlassBalustradeRun(106.0, 57.5, 106.0, 62.0, 10.02, DECK_Y, true);
    // South-East Outer Cliff Balustrade (from Ramp East edge x = 106.0 to SE corner x = 144.8 at z = 62.0)
    addGlassBalustradeRun(106.0, 62.0, 144.8, 62.0, DECK_Y, DECK_Y, true);
    // Full East Outer Cliff Balustrade (x = 144.8, z = 62.0..94.4)
    addGlassBalustradeRun(144.8, 62.0, 144.8, 94.4, DECK_Y, DECK_Y, true);
    // North-East Outer Cliff Balustrade (x = 144.8 back to Love Meadow at x = 110.0, z = 94.4)
    addGlassBalustradeRun(144.8, 94.4, 110.0, 94.4, DECK_Y, DECK_Y, true);

    group.add(skywalkGroup);
  }

  // Castle-Side Crystal Fountain Beacon (at z = 65.5, well clear of Castle Rear Garden)
  const castleFountainCrystal = new THREE.Mesh(
    tracker.track(new THREE.OctahedronGeometry(1.1, 1)),
    castleGardenGlowMat
  );
  castleFountainCrystal.position.set(94.0, 14.8, 65.5);
  group.add(castleFountainCrystal);

  // ============================================================================
  // 10. CHOREOGRAPHY DIRECTOR & INTERACTION PIPELINE
  // ============================================================================
  const director = createHeartlineChoreographyDirector({
    departureBeaconsMesh,
    departureBeaconCount: DEPARTURE_BEACON_COUNT,
    crystalTunnelRibsMesh,
    crystalTunnelRibCount: CRYSTAL_RIB_COUNT,
    heartlineBeaconsMesh,
    heartlineBeaconCount: HEARTLINE_BEACON_COUNT,
    meadowButterfliesMesh,
    meadowButterflyCount: BUTTERFLY_COUNT,
    queueGlowMaterial: queueGlowMat,
    castleGardenGlowMaterial: castleGardenGlowMat,
  });

  let ticketConfirmed = false;
  let playerIsRiding = false;
  let pendingExitDisembark = false;

  function isRiding(): boolean {
    return playerIsRiding;
  }

  function resolveSkywalkBarriers(
    playerPos: THREE.Vector3,
    playerRadius: number
  ): void {
    if (playerIsRiding) return;
    if (
      playerPos.x < 74.0 ||
      playerPos.x > 147.5 ||
      playerPos.z < 55.5 ||
      playerPos.z > 97.0
    ) {
      return;
    }

    const minDist = playerRadius + 0.18;
    for (let i = 0; i < skywalkBarrierSegments.length; i++) {
      const seg = skywalkBarrierSegments[i];
      const abx = seg.x2 - seg.x1;
      const abz = seg.z2 - seg.z1;
      const lenSq = abx * abx + abz * abz;
      if (lenSq < 1e-6) continue;
      const t = THREE.MathUtils.clamp(
        ((playerPos.x - seg.x1) * abx + (playerPos.z - seg.z1) * abz) / lenSq,
        0,
        1
      );
      const cx = seg.x1 + t * abx;
      const cz = seg.z1 + t * abz;
      const dx = playerPos.x - cx;
      const dz = playerPos.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist && dist > 1e-5) {
        const push = minDist - dist;
        playerPos.x += (dx / dist) * push;
        playerPos.z += (dz / dist) * push;
      }
    }
  }

  function getSurfaceHeight(x: number, z: number, baseGroundY: number): number {
    let h = baseGroundY;

    // 0. Romantic Crystal Lagoon Skywalk, Lover's Heart Bridge, Rotunda & Grand South Ramp (x: 76.0..145.5, z: 57.5..95.0)
    // Guarantees the walking player stands firmly on the Glass Promenade & Bridge at Y = 12.55m and never falls into the -6.2m lagoon trench!
    if (x >= 76.0 && x <= 145.5 && z >= 57.5 && z <= 95.0) {
      if (z >= 62.0) {
        const onBridgeOrRotunda =
          (x >= 111.0 && x <= 116.5 && z >= 66.2 && z <= 90.2) ||
          Math.hypot(x - 113.75, z - 78.2) <= 4.18;
        h = Math.max(h, onBridgeOrRotunda ? 12.56 : 12.55);
      } else if (x <= 106.2) {
        // Smooth stepped crystal ramp from Castle Rear Garden (z = 57.5, Y = 10.0m) up to South Glass Promenade (z = 62.0, Y = 12.55m)
        const rampT = THREE.MathUtils.clamp((z - 57.5) / (62.0 - 57.5), 0, 1);
        const rampY = THREE.MathUtils.lerp(10.0, 12.55, rampT);
        h = Math.max(h, rampY);
      }
    }

    // 1. Station Boarding Stand & Stepped Boarding Staircases at (70.0, 12.5, 78.0)
    const stDx = Math.abs(x - 70.0);
    const stDz = Math.abs(z - 78.0);

    // Station Plaza Slab base (20.5m x 13.8m, top at Y = 12.625m)
    if (stDx <= 10.25 && stDz <= 6.9) {
      h = Math.max(h, 12.625);
    }

    // North & South Boarding Stand Platforms (17.2m wide -> stDx <= 8.6, platZ = ±2.85 with depth 3.8m -> stDz in [0.95..4.75])
    // Platform top deck carpet is at 12.5 + 0.755 = 13.255m
    if (stDx <= 8.65 && stDz >= 0.9 && stDz <= 4.78) {
      h = Math.max(h, 13.255);
    }

    // Grand Stepped Boarding Staircase + Ramp connecting the Sapphire Pathway (stDz = 6.2) up to the Stand Deck (stDz = 4.55)
    // Staircase width is 6.2m (stDx <= 3.35 with margin)
    if (stDx <= 3.35 && stDz > 4.55 && stDz <= 6.25) {
      const rampT = THREE.MathUtils.clamp((6.15 - stDz) / (6.15 - 4.72), 0, 1);
      const stairY = THREE.MathUtils.lerp(12.625, 13.255, rampT);
      h = Math.max(h, stairY);
    }

    // Also allow smooth step-up from the outer platform edges (stDx <= 8.65, stDz in 4.78..5.35)
    if (stDx <= 8.65 && stDz > 4.78 && stDz <= 5.35) {
      const edgeT = THREE.MathUtils.clamp((5.35 - stDz) / (5.35 - 4.78), 0, 1);
      h = Math.max(h, THREE.MathUtils.lerp(12.625, 13.255, edgeT));
    }

    // 2. Octagonal Luxury Ticket Booth / Ticket Counter at TICKET_BOOTH_POS (55.0, 12.5, 71.0)
    // Forecourt medallion at Y = 12.56m, Octagonal Counter Deck top at 12.5 + 1.25 = 13.75m (radius 3.6m)
    const boothDist = Math.hypot(x - TICKET_BOOTH_POS.x, z - TICKET_BOOTH_POS.z);
    if (boothDist <= 6.8) {
      h = Math.max(h, 12.565);
    }
    if (boothDist <= 3.62) {
      h = Math.max(h, 13.75);
    } else if (boothDist <= 4.35) {
      // Smooth step-up collar around the Ticket Counter perimeter so the player can walk right up onto the counter
      const counterT = THREE.MathUtils.clamp((4.35 - boothDist) / (4.35 - 3.62), 0, 1);
      h = Math.max(h, THREE.MathUtils.lerp(12.565, 13.75, counterT));
    }

    // 3. Elevated Viewing Deck at VIEWING_DECK_POS (65.5, 13.3, 86.5)
    // Deck platform top is at Y = 13.3m (radius 4.85m, tapered outer base to 5.4m)
    const deckDist = Math.hypot(x - VIEWING_DECK_POS.x, z - VIEWING_DECK_POS.z);
    if (deckDist <= 4.85) {
      h = Math.max(h, 13.3);
    } else if (deckDist <= 5.6) {
      const deckT = THREE.MathUtils.clamp((5.6 - deckDist) / (5.6 - 4.85), 0, 1);
      h = Math.max(h, THREE.MathUtils.lerp(12.57, 13.3, deckT));
    }

    return h;
  }

  function getProximityPrompt(playerPos: THREE.Vector3): string | null {
    if (playerIsRiding) {
      return `Riding Heartline — ${cameraRig.getState().zoneLabel}  |  [Esc] Exit to Station`;
    }

    // 1. Station Boarding Stand check (covers both North & South Boarding Stands at (70.0, 78.0))
    const isAtStationStand =
      Math.abs(playerPos.x - 70.0) <= 9.5 && Math.abs(playerPos.z - 78.0) <= 6.8;
    if (isAtStationStand) {
      return '[E] Board Heartline';
    }

    // 2. Octagonal Ticket Booth check (within 5.8m of TICKET_BOOTH_POS)
    const distBooth = playerPos.distanceTo(TICKET_BOOTH_POS);
    if (distBooth <= 5.8) {
      return ticketConfirmed
        ? 'Ticket Confirmed ✨ Follow the Sapphire Pathway to Boarding Stand ([E] Board Now)'
        : '[E] Ride Heartline';
    }

    // 3. Elevated Viewing Deck hint
    if (playerPos.distanceTo(VIEWING_DECK_POS) <= 4.8) {
      return 'Heartline Viewing Deck — Walk East to Boarding Stand to Board';
    }

    return null;
  }

  function boardPlayerOntoTrain(): void {
    ticketConfirmed = true;
    playerIsRiding = true;
    pendingExitDisembark = false;
    cameraRig.resetForBoarding();
    train.startBoarding();
    cameraRig.update(0.016, 0);
  }

  function interact(playerPos: THREE.Vector3): boolean {
    if (playerIsRiding) return false;

    const isAtStationStand =
      Math.abs(playerPos.x - 70.0) <= 9.5 && Math.abs(playerPos.z - 78.0) <= 6.8;
    if (isAtStationStand) {
      boardPlayerOntoTrain();
      return true;
    }

    const distBooth = playerPos.distanceTo(TICKET_BOOTH_POS);
    if (distBooth <= 6.0) {
      director.playTicketConfirmationCue();
      boardPlayerOntoTrain();
      return true;
    }

    return false;
  }

  function handleKeyAction(key: string, playerPos: THREE.Vector3): boolean {
    const lower = key.toLowerCase();
    if (playerIsRiding) {
      if (lower === 'escape') {
        playerIsRiding = false;
        pendingExitDisembark = true;
        train.cancelRideToStation();
        return true;
      }
      return false;
    }

    if (lower === 'e' || lower === 'enter') {
      return interact(playerPos);
    }
    return false;
  }

  function consumeExitDisembark(outExitPos: THREE.Vector3): boolean {
    if (!pendingExitDisembark) return false;
    pendingExitDisembark = false;
    outExitPos.copy(STATION_EXIT_POS);
    return true;
  }

  function update(dt: number, elapsedTime: number, _playerPos: THREE.Vector3): void {
    train.update(dt, elapsedTime);
    const cues = train.consumeCueEvents();
    director.processBoardingCues(cues);

    if (cues.rideCompleteJustNow && playerIsRiding) {
      playerIsRiding = false;
      pendingExitDisembark = true;
    }

    if (playerIsRiding) {
      cameraRig.update(dt, elapsedTime);
    }

    const leadU = train.getLeadU();
    underwaterReef.update(dt, elapsedTime, leadU, playerIsRiding);

    // Gently bob & rotate the suspended floating rose-heart crystals under each Lover's Bridge Heart Arch
    for (let i = 0; i < floatingBridgeHeartCrystals.length; i++) {
      const ch = floatingBridgeHeartCrystals[i];
      ch.position.y = 0.85 + Math.sin(elapsedTime * 2.2 + i * 0.8) * 0.08;
      ch.rotation.y = elapsedTime * 0.9 + i * 0.6;
    }

    director.update(
      dt,
      elapsedTime,
      leadU,
      train.getSpeed(),
      playerIsRiding,
      ticketConfirmed
    );
  }

  function dispose(): void {
    underwaterReef.dispose();
    director.dispose();
    tracker.dispose();
  }

  return {
    group,
    colliders,
    getSurfaceHeight,
    resolveSkywalkBarriers,
    getProximityPrompt,
    handleKeyAction,
    interact,
    applyLookDelta: cameraRig.applyLookDelta,
    isRiding,
    getRideZoneLabel: () => cameraRig.getState().zoneLabel,
    getCameraState: cameraRig.getState,
    consumeExitDisembark,
    getUnderwaterSpeedFactor: train.getUnderwaterSpeedFactor,
    setUnderwaterSpeedFactor: train.setUnderwaterSpeedFactor,
    update,
    dispose,
  };
}
