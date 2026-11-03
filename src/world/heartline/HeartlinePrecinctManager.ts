import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ResourceTracker } from '../ProceduralKit';
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

export interface HeartlinePrecinctManager {
  readonly group: THREE.Group;
  readonly colliders: THREE.Box3[];
  getProximityPrompt: (playerPos: THREE.Vector3) => string | null;
  handleKeyAction: (key: string, playerPos: THREE.Vector3) => boolean;
  interact: (playerPos: THREE.Vector3) => boolean;
  applyLookDelta: (yawDeltaRad: number, pitchDeltaRad: number) => void;
  isRiding: () => boolean;
  getRideZoneLabel: () => string;
  getCameraState: () => HeartlineCameraState;
  consumeExitDisembark: (outExitPos: THREE.Vector3) => boolean;
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
  const warmPlazaTileMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.06,
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

  // Instanced Deep-Navy Support Columns + Pearl-White Foundation Collars
  const supportPositions: { x: number; topY: number; z: number }[] = [];
  const SUPPORT_SAMPLES = 64;
  for (let i = 0; i < SUPPORT_SAMPLES; i++) {
    const u = i / SUPPORT_SAMPLES;
    // Skip support columns inside the Station canopy (0..0.04, 0.96..1.0) and Crystal Tunnel interior (0.55..0.63)
    if (u < 0.04 || u > 0.965 || (u > 0.555 && u < 0.625)) continue;
    spline.evaluateAtU(u, sampleFrame);
    // Avoid blocking the Queue Garden bridge walkway near (74..85, 72..78)
    if (
      sampleFrame.pos.x > 73 &&
      sampleFrame.pos.x < 83 &&
      sampleFrame.pos.z > 71 &&
      sampleFrame.pos.z < 79
    ) {
      continue;
    }
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
    const groundY = 12.45;
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
  // 2. WALKABLE PRECINCT GROUND PAVING & CURVED ENTRANCE GATEWAY
  // ============================================================================
  // Precinct Terrace Slab at Y = 12.48m
  const precinctPlazaGeo = tracker.track(new THREE.CylinderGeometry(34, 35, 0.36, 48));
  const precinctPlaza = new THREE.Mesh(precinctPlazaGeo, warmPlazaTileMat);
  precinctPlaza.position.set(72.0, 12.32, 65.0);
  precinctPlaza.receiveShadow = true;
  group.add(precinctPlaza);

  // Entrance Boulevard Apron connecting (50, 44) -> Ticket Booth (63, 57) -> Station (78, 68)
  const boulevardWalkGeo = tracker.track(new THREE.BoxGeometry(10.5, 0.14, 34.0));
  const boulevardWalk = new THREE.Mesh(boulevardWalkGeo, pearlStoneMat);
  boulevardWalk.position.set(61.5, 12.46, 55.5);
  boulevardWalk.rotation.y = Math.PI / 4;
  boulevardWalk.receiveShadow = true;
  group.add(boulevardWalk);

  // Reflective Sapphire Water Feature along the Ticket Forecourt
  const waterChannelGeo = tracker.track(new THREE.BoxGeometry(3.2, 0.16, 16.0));
  const waterChannel = new THREE.Mesh(waterChannelGeo, reflectiveWaterMat);
  waterChannel.position.set(57.5, 12.47, 59.5);
  waterChannel.rotation.y = Math.PI / 4;
  group.add(waterChannel);

  // Curved Attraction Entrance Gateway at ENTRANCE_ARCH_POS (54.0, 12.5, 48.0) facing SW (-X, -Z)
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

  // Curved Overhead Sign Board ("HEARTLINE / THE SKY OF OUR DREAMS")
  const signTex = createSignBannerTexture(
    tracker,
    'HEARTLINE',
    'THE SKY OF OUR DREAMS'
  );
  const signMat = tracker.track(
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.25,
      metalness: 0.15,
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

  // 6 White Wisteria Pergola Arches along the Queue Garden Path ((66, 61) -> (73.5, 76) -> (78, 71))
  const queueWaypoints = [
    new THREE.Vector3(66.5, 12.5, 61.5),
    new THREE.Vector3(69.0, 12.65, 66.5),
    new THREE.Vector3(71.2, 12.85, 71.5),
    new THREE.Vector3(73.5, 13.15, 75.5),
    new THREE.Vector3(76.0, 13.0, 74.0),
    new THREE.Vector3(77.5, 12.85, 71.8),
  ];

  const pergolaPillarGeo = tracker.track(new THREE.CylinderGeometry(0.14, 0.18, 3.4, 8));
  const pergolaBeamGeo = tracker.track(new THREE.TorusGeometry(2.1, 0.11, 8, 16, Math.PI));
  const wisteriaClusterGeo = tracker.track(new THREE.ConeGeometry(0.28, 0.95, 7));
  wisteriaClusterGeo.rotateX(Math.PI); // Hang downward
  const wisteriaMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.25,
      roughness: 0.55,
    })
  );
  const lanternDropGeo = tracker.track(new THREE.OctahedronGeometry(0.22, 1));

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
      col.position.set(side * 2.1, 1.7, 0);
      arbor.add(col);

      const lantern = new THREE.Mesh(lanternDropGeo, queueGlowMat);
      lantern.position.set(side * 1.65, 2.85, 0);
      arbor.add(lantern);
    }

    const archBeam = new THREE.Mesh(pergolaBeamGeo, pearlStoneMat);
    archBeam.position.set(0, 3.3, 0);
    arbor.add(archBeam);

    // Draped Lavender Wisteria Blossom Clusters
    for (let w = -3; w <= 3; w++) {
      const wAng = (w / 3.5) * (Math.PI * 0.42);
      const blossom = new THREE.Mesh(wisteriaClusterGeo, wisteriaMat);
      blossom.position.set(Math.sin(wAng) * 2.0, 3.15 + Math.cos(wAng) * 1.65, (w % 2) * 0.22);
      arbor.add(blossom);
    }

    group.add(arbor);
  }

  // ============================================================================
  // 5. OPEN-AIR SAPPHIRE & PEARL STATION AT (78.0, 12.85, 68.0)
  // ============================================================================
  const stationGroup = new THREE.Group();
  stationGroup.position.set(78.0, 12.5, 68.0);

  // North Boarding Platform (Z = +2.8 -> World Z = 70.8) & South Exit Platform (Z = -2.8 -> World Z = 65.2)
  const platformSlabGeo = tracker.track(new THREE.BoxGeometry(16.5, 0.72, 3.4));
  const boardingSlab = new THREE.Mesh(platformSlabGeo, pearlStoneMat);
  boardingSlab.position.set(0, 0.36, 2.8);
  boardingSlab.receiveShadow = true;
  stationGroup.add(boardingSlab);

  const exitSlab = new THREE.Mesh(platformSlabGeo, pearlStoneMat);
  exitSlab.position.set(0, 0.36, -2.8);
  exitSlab.receiveShadow = true;
  stationGroup.add(exitSlab);

  // Gold Platform Safety Tactile Strips
  const tactileStripGeo = tracker.track(new THREE.BoxGeometry(16.2, 0.04, 0.22));
  for (const zSide of [-1.25, 1.25]) {
    const strip = new THREE.Mesh(tactileStripGeo, champagneGoldMat);
    strip.position.set(0, 0.73, zSide);
    stationGroup.add(strip);
  }

  // 10 Pearl-White Station Columns with Recessed Blue Crystal Panels & Vaulted Sapphire Glass Arch Canopy
  const stColGeo = tracker.track(new THREE.BoxGeometry(0.68, 5.4, 0.68));
  const stPanelGeo = tracker.track(new THREE.BoxGeometry(0.42, 3.6, 0.72));
  const canopyArchRibGeo = tracker.track(new THREE.TorusGeometry(4.8, 0.16, 10, 24, Math.PI));
  canopyArchRibGeo.rotateY(Math.PI / 2);

  for (let ix = -2; ix <= 2; ix++) {
    const colX = ix * 3.6;
    for (const zSide of [-1, 1]) {
      const colZ = zSide * 4.6;
      const col = new THREE.Mesh(stColGeo, pearlStoneMat);
      col.position.set(colX, 2.7, colZ);
      col.castShadow = true;
      stationGroup.add(col);

      const bluePanel = new THREE.Mesh(stPanelGeo, cyanCrystalMat);
      bluePanel.position.set(colX, 2.8, colZ);
      stationGroup.add(bluePanel);
    }

    const archRib = new THREE.Mesh(canopyArchRibGeo, champagneGoldMat);
    archRib.position.set(colX, 5.3, 0);
    stationGroup.add(archRib);

    // Warm Hanging Station Chandelier Lanterns
    const pendant = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.36, 1)),
      queueGlowMat
    );
    pendant.position.set(colX, 6.8, 0);
    stationGroup.add(pendant);
  }

  // Vaulted Sapphire Glass Barrel Roof over the Station
  const stationVaultGeo = tracker.track(
    new THREE.CylinderGeometry(4.72, 4.72, 16.6, 20, 1, true, 0, Math.PI)
  );
  stationVaultGeo.rotateZ(Math.PI / 2);
  stationVaultGeo.rotateX(Math.PI / 2);
  const stationVault = new THREE.Mesh(stationVaultGeo, sapphireGlassMat);
  stationVault.position.set(0, 5.3, 0);
  stationGroup.add(stationVault);

  // Station Entrance & Exit Portal Heart Crests
  for (const xEnd of [-8.2, 8.2]) {
    const portalHeart = new THREE.Mesh(
      tracker.track(new THREE.OctahedronGeometry(0.62, 1)),
      cyanCrystalMat
    );
    portalHeart.position.set(xEnd, 8.2, 0);
    stationGroup.add(portalHeart);
  }

  // Exit Plaza Commemorative "HEARTLINE" Monument Sign on the South Exit Side
  const exitSignBoard = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(5.2, 1.35, 0.38)),
    signMat
  );
  exitSignBoard.position.set(0, 1.45, -6.2);
  stationGroup.add(exitSignBoard);

  group.add(stationGroup);

  // ============================================================================
  // 6. 45M SUMMIT BOTANICAL "I LOVE YOU ❤️" MEADOW AT (98.0, 13.2, 96.0)
  // ============================================================================
  const meadowGroup = new THREE.Group();
  meadowGroup.position.copy(LOVE_MEADOW_CENTER);
  // Tilted 18° Northward (+Z) so the 45m Summit Crest at Z = 121.8 looks perpendicularly at the face!
  meadowGroup.rotation.x = THREE.MathUtils.degToRad(18);

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
      emissiveIntensity: 0.28,
      roughness: 0.45,
    })
  );
  const crimsonRoseMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xbe123c,
      emissiveIntensity: 0.32,
      roughness: 0.42,
    })
  );

  // Sculpted Oval Hillside Berm + Pearl Stone Rim
  const bermRimGeo = tracker.track(new THREE.CylinderGeometry(23.5, 25.0, 1.4, 40));
  bermRimGeo.scale(1.32, 1.0, 0.78);
  const bermRim = new THREE.Mesh(bermRimGeo, pearlStoneMat);
  bermRim.position.y = -0.65;
  meadowGroup.add(bermRim);

  const bermLawnGeo = tracker.track(new THREE.CylinderGeometry(22.2, 23.2, 1.52, 40));
  bermLawnGeo.scale(1.32, 1.0, 0.78);
  const bermLawn = new THREE.Mesh(bermLawnGeo, deepTurfMat);
  bermLawn.position.y = -0.52;
  bermLawn.receiveShadow = true;
  meadowGroup.add(bermLawn);

  // Inner Bright-Cut Lawn Oval Framing the Topiary Message
  const innerLawnGeo = tracker.track(new THREE.CylinderGeometry(19.5, 20.0, 0.25, 36));
  innerLawnGeo.scale(1.32, 1.0, 0.74);
  const innerLawn = new THREE.Mesh(innerLawnGeo, brightTurfMat);
  innerLawn.position.y = 0.22;
  meadowGroup.add(innerLawn);

  // Pixel-Grid Bitmap for 3D Sculpted Topiary Letters "I LOVE YOU"
  // Oriented so when viewed from the North Crest (looking -Z toward the meadow), +X is Left-to-Right in screen space!
  // Wait: from the Crest at (99, 57.6, 121.8) looking South (-Z) at (98, 13.2, 96) with Up = (0, 1, 0):
  // Camera Forward = (0, -0.7, -0.7), Camera Right = Forward x Up = (-1, 0, 0)!
  // Because Camera Right is -X when looking South (-Z), left-to-right on screen corresponds to +X -> -X in world coordinates!
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

  // Place "I LOVE YOU" on the left/center of the meadow (screen left = +X) and the giant ❤️ on screen right (-X)
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
    // Map cursorCol (0..38) to +21.5 .. -8.5 along local X so it reads Left-to-Right from the North Crest
    const lx = 21.5 - b.x * 0.82;
    // Map row r (0..4, top to bottom) to +3.2 .. -3.2 along local Z (since +Z is higher up the tilted slope)
    const lz = (2.0 - b.z) * 1.35 + 1.2;

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

  // Giant Natural Red Rose Heart (❤️) on the right side of the phrase (local X ≈ -16.5, Z ≈ +1.0)
  const rosePoints: { x: number; z: number; s: number }[] = [];
  for (let gx = -1.35; gx <= 1.35; gx += 0.14) {
    for (let gz = -1.25; gz <= 1.35; gz += 0.14) {
      // Implicit heart equation: (x^2 + z^2 - 1)^3 - x^2 * z^3 <= 0
      const a = gx * gx + gz * gz - 1.0;
      if (a * a * a - gx * gx * (gz * gz * gz) <= 0.0) {
        rosePoints.push({
          x: -16.5 - gx * 4.8,
          z: 1.0 + gz * 4.5,
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

  // Secondary Smaller Golden Blossom Heart below "LOVE" (matching the Full Attraction Overview reference image)
  const goldHeartGeo = tracker.track(new THREE.OctahedronGeometry(0.52, 1));
  const smallHeartPoints: { x: number; z: number }[] = [];
  for (let gx = -1.2; gx <= 1.2; gx += 0.25) {
    for (let gz = -1.1; gz <= 1.2; gz += 0.25) {
      const a = gx * gx + gz * gz - 1.0;
      if (a * a * a - gx * gx * (gz * gz * gz) <= 0.0) {
        smallHeartPoints.push({
          x: 4.5 - gx * 2.4,
          z: -6.2 + gz * 2.2,
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
    const u = 0.542 + (i / (CRYSTAL_RIB_COUNT - 1)) * 0.094;
    spline.evaluateAtU(u, sampleFrame);
    _scratchForward.copy(sampleFrame.tangent).normalize();
    _scratchUp.copy(_worldUp);
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

  // Arched Stone Pedestrian Bridge & Reflective Pond beneath the Crystal Tunnel
  const tunnelPondGeo = tracker.track(new THREE.CylinderGeometry(12.5, 13.0, 0.18, 32));
  const tunnelPond = new THREE.Mesh(tunnelPondGeo, reflectiveWaterMat);
  tunnelPond.position.set(CRYSTAL_TUNNEL_CENTER.x, 12.44, CRYSTAL_TUNNEL_CENTER.z - 2.0);
  group.add(tunnelPond);

  const stoneBridgeArchGeo = tracker.track(new THREE.TorusGeometry(6.8, 0.85, 10, 24, Math.PI * 0.65));
  stoneBridgeArchGeo.rotateZ(Math.PI * 0.175);
  const stoneBridge = new THREE.Mesh(stoneBridgeArchGeo, pearlStoneMat);
  stoneBridge.position.set(CRYSTAL_TUNNEL_CENTER.x, 9.2, CRYSTAL_TUNNEL_CENTER.z);
  stoneBridge.rotation.y = Math.PI * 0.25;
  group.add(stoneBridge);

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
    // Entrance & Ticket Forecourt Borders
    { x: 49.5, z: 52.0, scale: 1.1 },
    { x: 58.5, z: 44.5, scale: 1.15 },
    { x: 55.0, z: 61.0, scale: 1.25 },
    { x: 67.5, z: 52.0, scale: 1.1 },
    // Castle-Side Garden Buffer (framing the Dream Castle Flyby at z = 44..52)
    { x: 89.0, z: 45.5, scale: 1.3 },
    { x: 95.0, z: 44.0, scale: 1.4 },
    { x: 102.0, z: 43.0, scale: 1.35 },
    { x: 109.0, z: 44.0, scale: 1.45 },
    { x: 115.5, z: 47.0, scale: 1.3 },
    { x: 121.0, z: 51.0, scale: 1.25 },
    // Meadow Perimeter Grove (North & East rim behind the Love Meadow)
    { x: 75.0, z: 102.0, scale: 1.4 },
    { x: 82.0, z: 112.0, scale: 1.5 },
    { x: 92.0, z: 115.0, scale: 1.45 },
    { x: 105.0, z: 114.0, scale: 1.5 },
    { x: 116.0, z: 106.0, scale: 1.4 },
    { x: 122.0, z: 92.0, scale: 1.35 },
    // Final Helix Interior Garden
    { x: 56.0, z: 76.0, scale: 1.3 },
    { x: 60.5, z: 79.0, scale: 1.2 },
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
    _scratchPos.set(gs.x, 12.5 + 1.2 * s, gs.z);
    _scratchQuat.identity();
    _scratchScale.set(s, s, s);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    trunksInst.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(gs.x, 12.5 + 3.1 * s, gs.z);
    _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
    canopiesInst.setMatrixAt(i, _scratchMat4);

    _scratchPos.set(gs.x + 1.4, 12.5 + 0.35 * s, gs.z - 0.8);
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

  // Castle-Side Crystal Fountain Beacon
  const castleFountainCrystal = new THREE.Mesh(
    tracker.track(new THREE.OctahedronGeometry(1.1, 1)),
    castleGardenGlowMat
  );
  castleFountainCrystal.position.set(102.0, 14.8, 46.5);
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

  function getProximityPrompt(playerPos: THREE.Vector3): string | null {
    if (playerIsRiding) {
      return `Riding Heartline — ${cameraRig.getState().zoneLabel}  |  [Esc] Exit to Station`;
    }

    // 1. Station Boarding Platform check (within 5.5m of STATION_BOARDING_POS)
    const distStation = playerPos.distanceTo(STATION_BOARDING_POS);
    if (distStation <= 5.8) {
      return '[E] Board Heartline';
    }

    // 2. Octagonal Ticket Booth check (within 5.5m of TICKET_BOOTH_POS)
    const distBooth = playerPos.distanceTo(TICKET_BOOTH_POS);
    if (distBooth <= 5.6) {
      return ticketConfirmed
        ? 'Ticket Confirmed ✨ Follow the Wisteria Queue Garden to Station ([E] Board Now)'
        : '[E] Ride Heartline';
    }

    // 3. Elevated Viewing Deck hint
    if (playerPos.distanceTo(VIEWING_DECK_POS) <= 4.5) {
      return 'Heartline Viewing Deck — Walk East to Station Platform to Board';
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

    const distStation = playerPos.distanceTo(STATION_BOARDING_POS);
    if (distStation <= 5.8) {
      boardPlayerOntoTrain();
      return true;
    }

    const distBooth = playerPos.distanceTo(TICKET_BOOTH_POS);
    if (distBooth <= 5.6) {
      if (!ticketConfirmed) {
        // First press at Ticket Booth: confirm ticket, chime, illuminate queue garden & dock train
        ticketConfirmed = true;
        director.playTicketConfirmationCue();
        train.requestDockForTicket();
        return true;
      } else {
        // Second press at Ticket Booth (or direct boarding): board immediately
        boardPlayerOntoTrain();
        return true;
      }
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

    director.update(
      dt,
      elapsedTime,
      train.getLeadU(),
      train.getSpeed(),
      playerIsRiding,
      ticketConfirmed
    );
  }

  function dispose(): void {
    director.dispose();
    tracker.dispose();
  }

  return {
    group,
    colliders,
    getProximityPrompt,
    handleKeyAction,
    interact,
    applyLookDelta: cameraRig.applyLookDelta,
    isRiding,
    getRideZoneLabel: () => cameraRig.getState().zoneLabel,
    getCameraState: cameraRig.getState,
    consumeExitDisembark,
    update,
    dispose,
  };
}
