import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { getTerrainHeight } from '../terrainMath';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';

export interface CastleGardenBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  isWithinGazeboVista: (playerPos: THREE.Vector3) => boolean;
  update: (delta: number, elapsedTime: number, playerPos: THREE.Vector3) => void;
}

// Pre-allocated scratch objects at module scope (Zero Per-Frame Allocations)
const _dummy = new THREE.Object3D();

function lockStaticGardenMeshes(root: THREE.Object3D, dynamicSet: Set<THREE.Object3D>) {
  root.traverse((obj) => {
    if (dynamicSet.has(obj)) return;
    let p: THREE.Object3D | null = obj.parent;
    while (p) {
      if (dynamicSet.has(p)) return;
      p = p.parent;
    }
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
  });
}

export function createCastleGarden(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  originX: number,
  baseY: number,
  originZ: number,
): CastleGardenBundle {
  const gardenGroup = new THREE.Group();
  gardenGroup.name = 'CastleRearGarden_Sprint2';
  const colliders: CircleCollider[] = [];
  const dynamicObjects = new Set<THREE.Object3D>();

  const crimsonRoseMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e11d48'),
      emissive: new THREE.Color('#9f1239'),
      emissiveIntensity: 0.18,
      roughness: 0.42,
    }),
  );

  const blushRosePetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.14,
      roughness: 0.45,
    }),
  );

  const foliageEmeraldMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#10b981'),
      roughness: 0.68,
      metalness: 0.04,
    }),
  );

  const warmCedarBridgeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b45309'),
      roughness: 0.58,
      metalness: 0.08,
    }),
  );

  const butterflyWingMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f472b6'),
      emissive: new THREE.Color('#f9a8d4'),
      emissiveIntensity: 0.65,
      roughness: 0.25,
      side: THREE.DoubleSide,
    }),
  );

  const localGroundY = (lx: number, lz: number): number => {
    return getTerrainHeight(originX + lx, originZ + lz) - baseY;
  };

  // ==========================================================================
  // 1. ROSE GARDEN PROMENADE, 5 INSTANCED ROSE ARCHES & SCULPTED BENCHES
  // ==========================================================================
  const ARCH_COUNT = 5;
  const archZSpots = [17.6, 19.3, 21.0, 22.7, 24.4];

  // Paved Garden Promenade Stones (lz: +16.4 to +24.8)
  const PROMENADE_STEPS = 12;
  const promStoneGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.35, 1.42, 0.14, 10));
  const promStoneInst = new THREE.InstancedMesh(promStoneGeo, mats.blushRoseMarble, PROMENADE_STEPS);
  promStoneInst.receiveShadow = true;

  for (let i = 0; i < PROMENADE_STEPS; i++) {
    const lz = THREE.MathUtils.lerp(16.5, 24.2, i / (PROMENADE_STEPS - 1));
    const ly = i < 3 ? THREE.MathUtils.lerp(0.2, localGroundY(0, lz), i / 3) : localGroundY(0, lz);
    _dummy.position.set(0, ly + 0.05, lz);
    _dummy.rotation.set(0, (i % 2) * 0.3, 0);
    _dummy.scale.set(1.25, 1.0, 0.85);
    _dummy.updateMatrix();
    promStoneInst.setMatrixAt(i, _dummy.matrix);
  }
  promStoneInst.instanceMatrix.needsUpdate = true;
  gardenGroup.add(promStoneInst);

  // 5 Instanced Champagne-Gold & Pearl Rose Arches wrapped in Crimson & Blush Climbing Roses
  const archPillarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 12));
  archPillarGeo.translate(0, 1.6, 0);
  const archCrownGeo = tracker.trackGeo(new THREE.TorusGeometry(2.15, 0.11, 10, 24, Math.PI));
  const vineGarlandGeo = tracker.trackGeo(new THREE.TorusGeometry(2.15, 0.22, 8, 20, Math.PI));
  const roseClusterGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.18, 0));

  const archPillarInst = new THREE.InstancedMesh(archPillarGeo, mats.pearlWhite, ARCH_COUNT * 2);
  const archCrownInst = new THREE.InstancedMesh(archCrownGeo, mats.champagneGold, ARCH_COUNT);
  const archVineInst = new THREE.InstancedMesh(vineGarlandGeo, foliageEmeraldMat, ARCH_COUNT);
  const crimsonRoseInst = new THREE.InstancedMesh(roseClusterGeo, crimsonRoseMat, ARCH_COUNT * 8);
  const blushRoseInst = new THREE.InstancedMesh(roseClusterGeo, blushRosePetalMat, ARCH_COUNT * 8);

  let crimsonIdx = 0;
  let blushIdx = 0;

  archZSpots.forEach((az, aIdx) => {
    const gy = localGroundY(0, az);

    // Left & Right Pearl Columns
    [-2.15, 2.15].forEach((ax, sideIdx) => {
      _dummy.position.set(ax, gy, az);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      archPillarInst.setMatrixAt(aIdx * 2 + sideIdx, _dummy.matrix);
    });

    // Gold Arch Crown & Climbing Vine Garland
    _dummy.position.set(0, gy + 3.15, az);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    archCrownInst.setMatrixAt(aIdx, _dummy.matrix);
    archVineInst.setMatrixAt(aIdx, _dummy.matrix);

    // 16 Climbing Rose Clusters per Arch (8 Crimson + 8 Blush)
    for (let r = 0; r < 16; r++) {
      const ang = (r / 15) * Math.PI;
      const rx = Math.cos(ang) * 2.15 + Math.sin(r * 2.1) * 0.14;
      const ry = gy + 3.15 + Math.sin(ang) * 2.15 + Math.cos(r * 1.7) * 0.12;
      const rz = az + (r % 2 === 0 ? -0.15 : 0.15);

      _dummy.position.set(rx, ry, rz);
      _dummy.rotation.set(r * 0.5, r * 0.8, 0);
      _dummy.scale.setScalar(0.85 + (r % 3) * 0.22);
      _dummy.updateMatrix();

      if (r % 2 === 0) {
        crimsonRoseInst.setMatrixAt(crimsonIdx++, _dummy.matrix);
      } else {
        blushRoseInst.setMatrixAt(blushIdx++, _dummy.matrix);
      }
    }
  });

  archPillarInst.instanceMatrix.needsUpdate = true;
  archCrownInst.instanceMatrix.needsUpdate = true;
  archVineInst.instanceMatrix.needsUpdate = true;
  crimsonRoseInst.instanceMatrix.needsUpdate = true;
  blushRoseInst.instanceMatrix.needsUpdate = true;
  gardenGroup.add(archPillarInst, archCrownInst, archVineInst, crimsonRoseInst, blushRoseInst);

  // Sculpted Garden Benches flanking the Rose Promenade
  const benchSeatGeo = tracker.trackGeo(new THREE.BoxGeometry(0.65, 0.1, 1.85));
  benchSeatGeo.translate(0, 0.52, 0);
  const benchBackGeo = tracker.trackGeo(new THREE.BoxGeometry(0.1, 0.55, 1.85));
  benchBackGeo.translate(-0.28, 0.82, 0);
  const benchLegGeo = tracker.trackGeo(new THREE.BoxGeometry(0.58, 0.48, 0.14));
  benchLegGeo.translate(0, 0.24, 0);

  [
    { lx: -3.6, lz: 20.2, rotY: 0 },
    { lx: 3.6, lz: 20.2, rotY: Math.PI },
    { lx: -5.4, lz: 30.0, rotY: 0.35 },
    { lx: 5.4, lz: 30.0, rotY: Math.PI - 0.35 },
  ].forEach((b) => {
    const by = localGroundY(b.lx, b.lz);
    const bg = new THREE.Group();
    bg.position.set(b.lx, by, b.lz);
    bg.rotation.y = b.rotY;
    const seat = new THREE.Mesh(benchSeatGeo, mats.pearlWhite);
    const back = new THREE.Mesh(benchBackGeo, mats.champagneGold);
    const leg1 = new THREE.Mesh(benchLegGeo, mats.champagneGold);
    leg1.position.z = -0.75;
    const leg2 = new THREE.Mesh(benchLegGeo, mats.champagneGold);
    leg2.position.z = 0.75;
    bg.add(seat, back, leg1, leg2);
    gardenGroup.add(bg);
    colliders.push({ x: originX + b.lx, z: originZ + b.lz, radius: 0.85 });
  });

  // ==========================================================================
  // 2. REFLECTIVE CRYSTAL POND & ARCHED FOOTBRIDGE (lz: +24.2 to +29.0)
  // ==========================================================================
  const pondCenterZ = 26.6;
  const pondY = localGroundY(0, pondCenterZ);

  const pondRimGeo = tracker.trackGeo(new THREE.TorusGeometry(4.4, 0.24, 10, 36));
  pondRimGeo.rotateX(Math.PI / 2);
  pondRimGeo.scale(1.38, 0.72, 1.0);
  const pondWaterGeo = tracker.trackGeo(new THREE.CylinderGeometry(4.3, 4.3, 0.08, 32));
  pondWaterGeo.scale(1.38, 1.0, 0.72);

  const pondRim = new THREE.Mesh(pondRimGeo, mats.blushRoseMarble);
  pondRim.position.set(0, pondY + 0.14, pondCenterZ);
  const pondWater = new THREE.Mesh(pondWaterGeo, mats.fountainWater);
  pondWater.position.set(0, pondY + 0.1, pondCenterZ);
  gardenGroup.add(pondRim, pondWater);

  // Arched Wooden & Marble Footbridge crossing the Reflective Pond (lz: 24.0..29.2)
  const bridgeGroup = new THREE.Group();
  const BRIDGE_PLANKS = 14;
  const bridgePlankGeo = tracker.trackGeo(new THREE.BoxGeometry(2.35, 0.1, 0.34));
  const bridgePostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.88, 8));
  bridgePostGeo.translate(0, 0.44, 0);

  for (let p = 0; p < BRIDGE_PLANKS; p++) {
    const u = p / (BRIDGE_PLANKS - 1);
    const bz = THREE.MathUtils.lerp(24.1, 29.1, u);
    const archH = Math.sin(u * Math.PI) * 0.55;
    const baseEndY = THREE.MathUtils.lerp(localGroundY(0, 24.1), localGroundY(0, 29.1), u);
    const py = baseEndY + archH + 0.08;

    const plank = new THREE.Mesh(
      bridgePlankGeo,
      p % 3 === 0 ? mats.blushRoseMarble : warmCedarBridgeMat,
    );
    plank.position.set(0, py, bz);
    plank.rotation.x = Math.cos(u * Math.PI) * -0.22;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);

    if (p % 3 === 0 || p === BRIDGE_PLANKS - 1) {
      [-1.12, 1.12].forEach((rx) => {
        const post = new THREE.Mesh(bridgePostGeo, mats.champagneGold);
        post.position.set(rx, py, bz);
        bridgeGroup.add(post);
      });
    }
  }
  gardenGroup.add(bridgeGroup);

  // ==========================================================================
  // 3. CENTRAL BELVEDERE GAZEBO (lx = 0, lz = +32.5)
  // ==========================================================================
  const gazeboZ = 32.5;
  const gazeboY = localGroundY(0, gazeboZ);
  const gazeboGroup = new THREE.Group();
  gazeboGroup.position.set(0, gazeboY, gazeboZ);

  const gazPodiumGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.85, 4.15, 0.44, 8));
  gazPodiumGeo.translate(0, 0.22, 0);
  const gazFloorGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.65, 3.65, 0.08, 8));
  gazFloorGeo.translate(0, 0.46, 0);
  const gazColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 3.8, 12));
  gazColGeo.translate(0, 2.35, 0);
  const gazRingBeamGeo = tracker.trackGeo(new THREE.TorusGeometry(3.45, 0.16, 8, 8));
  gazRingBeamGeo.rotateX(Math.PI / 2);
  gazRingBeamGeo.translate(0, 4.28, 0);
  const gazDomeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(3.55, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
  );
  gazDomeGeo.translate(0, 4.25, 0);
  const gazFinialGeo = tracker.trackGeo(new THREE.ConeGeometry(0.32, 1.1, 8));
  gazFinialGeo.translate(0, 8.15, 0);

  const gazPodium = new THREE.Mesh(gazPodiumGeo, mats.pearlWhite);
  gazPodium.receiveShadow = true;
  const gazFloor = new THREE.Mesh(gazFloorGeo, mats.blushRoseMarble);
  gazFloor.receiveShadow = true;
  const gazRingBeam = new THREE.Mesh(gazRingBeamGeo, mats.champagneGold);
  const gazDome = new THREE.Mesh(gazDomeGeo, mats.crystalGlass);
  const gazFinial = new THREE.Mesh(gazFinialGeo, mats.champagneGold);
  gazeboGroup.add(gazPodium, gazFloor, gazRingBeam, gazDome, gazFinial);

  for (let c = 0; c < 8; c++) {
    const ang = (c * Math.PI * 2) / 8 + Math.PI / 8;
    const cx = Math.cos(ang) * 3.35;
    const cz = Math.sin(ang) * 3.35;
    const col = new THREE.Mesh(gazColGeo, mats.pearlWhite);
    col.position.set(cx, 0, cz);
    col.castShadow = true;
    gazeboGroup.add(col);
    colliders.push({ x: originX + cx, z: originZ + gazeboZ + cz, radius: 0.35 });
  }

  // Central Rose Love-Seat inside the Belvedere Gazebo
  const loveSeat = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(0.95, 1.05, 0.48, 16)).translate(0, 0.7, 0),
    mats.blushRoseMarble,
  );
  const loveCenterFinial = new THREE.Mesh(
    tracker.trackGeo(new THREE.OctahedronGeometry(0.26, 0)).translate(0, 1.35, 0),
    mats.champagneGold,
  );
  gazeboGroup.add(loveSeat, loveCenterFinial);
  gardenGroup.add(gazeboGroup);

  // ==========================================================================
  // 4. BUTTERFLY GARDEN: REACTIVE FLOWER BEDS & 24 ANIMATED BUTTERFLIES
  // ==========================================================================
  const FLOWER_BED_COUNT = 16;
  const bedMoundGeo = tracker.trackGeo(new THREE.SphereGeometry(0.75, 10, 8));
  bedMoundGeo.scale(1.4, 0.38, 1.15);
  const bedMoundInst = new THREE.InstancedMesh(bedMoundGeo, foliageEmeraldMat, FLOWER_BED_COUNT);

  const reactiveBlossoms: { group: THREE.Group; lx: number; lz: number; openRatio: number }[] = [];
  const blossomPetalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.22, 0.48, 6));
  blossomPetalGeo.translate(0, 0.24, 0);

  for (let b = 0; b < FLOWER_BED_COUNT; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const row = Math.floor(b / 2);
    const bx = side * (4.6 + (row % 3) * 2.4);
    const bz = 18.8 + row * 2.85;
    const by = localGroundY(bx, bz);

    _dummy.position.set(bx, by + 0.08, bz);
    _dummy.rotation.set(0, b * 0.7, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    bedMoundInst.setMatrixAt(b, _dummy.matrix);

    const blosGroup = new THREE.Group();
    blosGroup.position.set(bx, by + 0.32, bz);
    dynamicObjects.add(blosGroup);

    const bMat = b % 2 === 0 ? crimsonRoseMat : blushRosePetalMat;
    for (let p = 0; p < 5; p++) {
      const pAng = (p * Math.PI * 2) / 5;
      const petal = new THREE.Mesh(blossomPetalGeo, bMat);
      petal.rotation.y = pAng;
      petal.rotation.z = 0.52;
      blosGroup.add(petal);
    }
    gardenGroup.add(blosGroup);
    reactiveBlossoms.push({ group: blosGroup, lx: bx, lz: bz, openRatio: 0 });
  }
  bedMoundInst.instanceMatrix.needsUpdate = true;
  gardenGroup.add(bedMoundInst);

  // 24 Animated 3D Butterflies (InstancedMesh for 1 Single Draw Call!)
  const BUTTERFLY_COUNT = 24;
  const butterflyGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.14, 0));
  butterflyGeo.scale(1.85, 0.28, 1.15);
  const butterflyInst = new THREE.InstancedMesh(butterflyGeo, butterflyWingMat, BUTTERFLY_COUNT);
  butterflyInst.frustumCulled = false;
  dynamicObjects.add(butterflyInst);
  gardenGroup.add(butterflyInst);

  interface ButterflyAgent {
    anchorX: number;
    anchorY: number;
    anchorZ: number;
    phase: number;
    speed: number;
    flutterLift: number;
  }
  const butterflies: ButterflyAgent[] = [];
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const bedRef = reactiveBlossoms[i % reactiveBlossoms.length];
    const ax = bedRef.lx + Math.cos(i * 1.9) * 0.65;
    const az = bedRef.lz + Math.sin(i * 1.9) * 0.65;
    const ay = localGroundY(ax, az) + 0.55;
    butterflies.push({
      anchorX: ax,
      anchorY: ay,
      anchorZ: az,
      phase: i * 1.37,
      speed: 1.4 + (i % 5) * 0.28,
      flutterLift: 0.0,
    });
  }

  // Lock all static garden geometry matrices
  lockStaticGardenMeshes(gardenGroup, dynamicObjects);

  // Footbridge acoustic resonance state
  let audioCtx: AudioContext | null = null;
  let bridgeStepCooldown = 0.0;
  let lastPlayerX = 0;
  let lastPlayerZ = 0;

  const playBridgeStepResonance = () => {
    try {
      if (!audioCtx && typeof window !== 'undefined') {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195 + Math.random() * 25, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.09);
      gain.gain.setValueAtTime(0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Audio fallback
    }
  };

  return {
    group: gardenGroup,
    colliders,

    isWithinGazeboVista: (playerPos: THREE.Vector3) => {
      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;
      return Math.abs(lx) <= 5.2 && lz >= 23.5 && lz <= 36.8;
    },

    update: (delta: number, elapsedTime: number, playerPos: THREE.Vector3) => {
      const lx = playerPos.x - originX;
      const lz = playerPos.z - originZ;

      // Distance culling when far from the Rear Castle Garden (center at lz = +28)
      const distFromGarden = Math.hypot(lx, lz - 28.0);
      if (distFromGarden > 65.0) {
        gardenGroup.visible = false;
        return;
      }
      gardenGroup.visible = true;

      // 1. Footbridge Acoustic Resonance when walking across (lx: -1.4..1.4, lz: 24.0..29.2)
      if (bridgeStepCooldown > 0) {
        bridgeStepCooldown = Math.max(0, bridgeStepCooldown - delta);
      }
      const movedDist = Math.hypot(playerPos.x - lastPlayerX, playerPos.z - lastPlayerZ);
      lastPlayerX = playerPos.x;
      lastPlayerZ = playerPos.z;

      if (
        Math.abs(lx) <= 1.35 &&
        lz >= 24.0 &&
        lz <= 29.2 &&
        movedDist > 0.035 &&
        bridgeStepCooldown <= 0
      ) {
        bridgeStepCooldown = 0.36;
        playBridgeStepResonance();
      }

      // 2. Reactive Flower Beds (bloom & rotate gently when Harsha walks within 3.6m)
      for (let i = 0; i < reactiveBlossoms.length; i++) {
        const rb = reactiveBlossoms[i];
        const dist = Math.hypot(lx - rb.lx, lz - rb.lz);
        const targetOpen = dist <= 3.6 ? 1.0 : 0.0;
        rb.openRatio = THREE.MathUtils.lerp(rb.openRatio, targetOpen, 1 - Math.exp(-5.0 * delta));
        rb.group.scale.setScalar(1.0 + rb.openRatio * 0.42);
        rb.group.rotation.y = elapsedTime * (0.25 + rb.openRatio * 1.1) + i;
      }

      // 3. 24 Reactive Butterflies (pause on petals, flutter upward in a swirl when Harsha approaches)
      for (let i = 0; i < BUTTERFLY_COUNT; i++) {
        const bf = butterflies[i];
        const dist = Math.hypot(lx - bf.anchorX, lz - bf.anchorZ);
        const isDisturbed = dist <= 4.5;
        const targetLift = isDisturbed ? 1.0 : 0.0;
        bf.flutterLift = THREE.MathUtils.lerp(bf.flutterLift, targetLift, 1 - Math.exp(-4.5 * delta));

        const swirlAngle = elapsedTime * bf.speed * (1.0 + bf.flutterLift * 1.4) + bf.phase;
        const radius = 0.22 + bf.flutterLift * 1.15;
        const bx = bf.anchorX + Math.cos(swirlAngle) * radius;
        const bz = bf.anchorZ + Math.sin(swirlAngle) * radius;
        const by =
          bf.anchorY +
          bf.flutterLift * 1.45 +
          Math.sin(elapsedTime * 5.5 + bf.phase) * (0.08 + bf.flutterLift * 0.25);

        const wingFlap = 0.45 + 0.55 * Math.abs(Math.sin(elapsedTime * (12.0 + bf.flutterLift * 10.0) + bf.phase));
        _dummy.position.set(bx, by, bz);
        _dummy.rotation.set(0.25, -swirlAngle, Math.sin(elapsedTime * 8.0 + bf.phase) * 0.3);
        _dummy.scale.set(wingFlap, 1.0, 1.0);
        _dummy.updateMatrix();
        butterflyInst.setMatrixAt(i, _dummy.matrix);
      }
      butterflyInst.instanceMatrix.needsUpdate = true;
    },
  };
}
