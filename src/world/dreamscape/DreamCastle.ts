import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { createDreamCastleMaterials, DreamCastleMaterials } from './CastleMaterials';
import {
  CastleNavigationController,
  CASTLE_ORIGIN_X,
  CASTLE_ORIGIN_Z,
  CASTLE_FLOOR_DEFS,
} from './CastleNavigation';

export interface DreamCastleBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  nav: CastleNavigationController;
  getSurfaceHeight: (wx: number, wz: number, playerY: number, defaultGroundY: number) => number;
  isInsideCastle: (wx: number, wz: number) => boolean;
  getProximityPrompt: (playerPos: THREE.Vector3) => { prompt: string; action: 'door' | 'call_elevator' | 'telescope' | 'none' } | null;
  interact: () => boolean;
  handleElevatorFloorSelect: (floorNum: number) => boolean;
  getCameraFocus: () => { target: THREE.Vector3; position: THREE.Vector3; fov?: number } | null;
  update: (delta: number, playerPos: THREE.Vector3) => void;
  dispose: () => void;
}

export function createDreamCastle(): DreamCastleBundle {
  const tracker = new ResourceTracker();
  const mats: DreamCastleMaterials = createDreamCastleMaterials(tracker);
  const nav = new CastleNavigationController();

  const group = new THREE.Group();
  group.name = 'DreamCastle_Sprint1';
  group.position.set(nav.originX, nav.baseY, nav.originZ);

  const colliders: CircleCollider[] = [];

  // ========================================================================
  // 1. ARCHITECTURAL PODIUM & EXTERIOR FOUNDATION (5-LEVEL SHELL)
  // ========================================================================
  // Base Podium
  const podiumGeo = tracker.trackGeo(new THREE.BoxGeometry(38.0, 0.5, 38.0));
  podiumGeo.translate(0, 0.0, 0);
  const podium = new THREE.Mesh(podiumGeo, mats.creamStone);
  podium.receiveShadow = true;
  group.add(podium);

  // Exterior Entrance Steps & Balustraded Porch (lz = -22 to -16)
  const stepsGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 0.5, 6.2));
  stepsGeo.translate(0, 0.0, -19.0);
  const stepsMesh = new THREE.Mesh(stepsGeo, mats.blushRoseMarble);
  stepsMesh.receiveShadow = true;
  group.add(stepsMesh);

  // Grand Colonnade Columns flanking entrance
  const colGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.36, 0.44, 5.2, 12));
  colGeo.translate(0, 2.6, 0);
  const colCapGeo = tracker.trackGeo(new THREE.BoxGeometry(1.1, 0.35, 1.1));
  colCapGeo.translate(0, 5.3, 0);

  [-3.8, -1.9, 1.9, 3.8].forEach((cx) => {
    const col = new THREE.Mesh(colGeo, mats.pearlWhite);
    col.position.set(cx, 0.25, -16.8);
    col.castShadow = true;
    const cap = new THREE.Mesh(colCapGeo, mats.champagneGold);
    cap.position.set(cx, 0.25, -16.8);
    group.add(col, cap);
    colliders.push({ x: nav.originX + cx, z: nav.originZ - 16.8, radius: 0.55 });
  });

  // Entrance Portico Pediment with Golden Heart Crest
  const pedimentGeo = tracker.trackGeo(new THREE.BoxGeometry(9.6, 1.2, 2.2));
  pedimentGeo.translate(0, 5.8, -16.8);
  const pediment = new THREE.Mesh(pedimentGeo, mats.blushRoseMarble);
  pediment.castShadow = true;
  group.add(pediment);

  // ========================================================================
  // 2. 4 CORNER TOWERS: ROSE, PEARL, STAR, HEART TOWERS
  // ========================================================================
  const towerPositions = [
    { name: 'HeartTower', lx: -15.5, lz: -15.5, spireColor: mats.powderBlueSpire },
    { name: 'RoseTower', lx: 15.5, lz: -15.5, spireColor: mats.powderBlueSpire },
    { name: 'StarTower', lx: -15.5, lz: 15.5, spireColor: mats.softLavender },
    { name: 'PearlTower', lx: 15.5, lz: 15.5, spireColor: mats.powderBlueSpire },
  ];

  const towerBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.1, 3.4, 21.0, 16));
  towerBodyGeo.translate(0, 10.5, 0);
  const towerCorniceGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.6, 3.1, 0.9, 16));
  towerCorniceGeo.translate(0, 21.4, 0);
  const towerSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(3.4, 8.5, 16));
  towerSpireGeo.translate(0, 25.8, 0);
  const towerFinialGeo = tracker.trackGeo(new THREE.SphereGeometry(0.55, 10, 10));
  towerFinialGeo.translate(0, 30.4, 0);

  towerPositions.forEach((tp) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tp.lx, 0, tp.lz);

    const body = new THREE.Mesh(towerBodyGeo, mats.pearlWhite);
    body.castShadow = true;
    body.receiveShadow = true;
    const cornice = new THREE.Mesh(towerCorniceGeo, mats.champagneGold);
    const spire = new THREE.Mesh(towerSpireGeo, tp.spireColor);
    spire.castShadow = true;
    const finial = new THREE.Mesh(towerFinialGeo, mats.champagneGold);

    tGroup.add(body, cornice, spire, finial);
    group.add(tGroup);

    colliders.push({
      x: nav.originX + tp.lx,
      z: nav.originZ + tp.lz,
      radius: 3.3,
    });
  });

  // Exterior Perimeter Walls with Window Arches
  const wallFrontLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 16.0, 1.2));
  wallFrontLeftGeo.translate(-9.5, 8.0, -16.0);
  const wallFrontRightGeo = tracker.trackGeo(new THREE.BoxGeometry(11.0, 16.0, 1.2));
  wallFrontRightGeo.translate(9.5, 8.0, -16.0);
  const wallBackGeo = tracker.trackGeo(new THREE.BoxGeometry(30.0, 16.0, 1.2));
  wallBackGeo.translate(0, 8.0, 16.0);
  const wallSideLeftGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 16.0, 30.0));
  wallSideLeftGeo.translate(-16.0, 8.0, 0);
  const wallSideRightGeo = tracker.trackGeo(new THREE.BoxGeometry(1.2, 16.0, 30.0));
  wallSideRightGeo.translate(16.0, 8.0, 0);

  const wallFL = new THREE.Mesh(wallFrontLeftGeo, mats.pearlWhite);
  const wallFR = new THREE.Mesh(wallFrontRightGeo, mats.pearlWhite);
  const wallB = new THREE.Mesh(wallBackGeo, mats.pearlWhite);
  const wallSL = new THREE.Mesh(wallSideLeftGeo, mats.pearlWhite);
  const wallSR = new THREE.Mesh(wallSideRightGeo, mats.pearlWhite);
  [wallFL, wallFR, wallB, wallSL, wallSR].forEach((w) => {
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
  });

  // Colliders for exterior walls (leaving open entrance portal at lx: [-2.2, 2.2], lz = -16)
  colliders.push({ x: nav.originX - 9.5, z: nav.originZ - 16.0, radius: 5.4 });
  colliders.push({ x: nav.originX + 9.5, z: nav.originZ - 16.0, radius: 5.4 });
  colliders.push({ x: nav.originX, z: nav.originZ + 16.0, radius: 14.5 });
  colliders.push({ x: nav.originX - 16.0, z: nav.originZ, radius: 14.5 });
  colliders.push({ x: nav.originX + 16.0, z: nav.originZ, radius: 14.5 });

  // ========================================================================
  // 3. PHYSICAL DOUBLE ENTRANCE DOORS & REVEAL MECHANISM
  // ========================================================================
  const doorPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(2.05, 4.4, 0.16));
  doorPanelGeo.translate(1.025, 2.2, 0); // Pivot on side edge
  const doorTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 3.8, 0.22));
  doorTrimGeo.translate(1.025, 2.2, 0);
  const handleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8));
  handleGeo.translate(1.85, 2.0, 0.16);

  // Left Door Pivot at lx = -2.1, lz = -16.0
  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-2.1, 0.25, -16.0);
  const leftDoorPanel = new THREE.Mesh(doorPanelGeo, mats.blushRoseMarble);
  const leftDoorTrim = new THREE.Mesh(doorTrimGeo, mats.champagneGold);
  const leftDoorHandle = new THREE.Mesh(handleGeo, mats.champagneGold);
  leftDoorPivot.add(leftDoorPanel, leftDoorTrim, leftDoorHandle);

  // Right Door Pivot at lx = 2.1, lz = -16.0 (mirrored)
  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(2.1, 0.25, -16.0);
  rightDoorPivot.scale.x = -1; // Mirror horizontally so pivot is on outer edge
  const rightDoorPanel = new THREE.Mesh(doorPanelGeo, mats.blushRoseMarble);
  const rightDoorTrim = new THREE.Mesh(doorTrimGeo, mats.champagneGold);
  const rightDoorHandle = new THREE.Mesh(handleGeo, mats.champagneGold);
  rightDoorPivot.add(rightDoorPanel, rightDoorTrim, rightDoorHandle);

  group.add(leftDoorPivot, rightDoorPivot);

  // Arch Header over entrance doors
  const archHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(4.8, 1.4, 0.8));
  archHeaderGeo.translate(0, 5.1, -16.0);
  const archHeader = new THREE.Mesh(archHeaderGeo, mats.blushRoseMarble);
  group.add(archHeader);

  // ========================================================================
  // 4. LEVEL 1: GRAND ENTRANCE HALL, FOUNTAIN & CHANDELIER
  // ========================================================================
  // Floor 1 Slab (Y = +0.25m)
  const floor1Geo = tracker.trackGeo(new THREE.BoxGeometry(31.0, 0.4, 31.0));
  floor1Geo.translate(0, 0.05, 0);
  const floor1Mesh = new THREE.Mesh(floor1Geo, mats.blushRoseMarble);
  floor1Mesh.receiveShadow = true;
  group.add(floor1Mesh);

  // Central Velvet Plum Carpet Runner leading from entrance to fountain
  const carpetGeo = tracker.trackGeo(new THREE.BoxGeometry(3.6, 0.02, 18.0));
  carpetGeo.translate(0, 0.26, -5.0);
  const carpetMesh = new THREE.Mesh(carpetGeo, mats.velvetPlum);
  carpetMesh.receiveShadow = true;
  group.add(carpetMesh);

  // Central Crystal Lotus Water Fountain (Center lx = 0, lz = 0)
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, 0.25, 0);

  const basinOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.8, 3.1, 0.75, 24));
  basinOuterGeo.translate(0, 0.375, 0);
  const basinRimGeo = tracker.trackGeo(new THREE.TorusGeometry(2.9, 0.16, 8, 32));
  basinRimGeo.rotateX(Math.PI / 2);
  basinRimGeo.translate(0, 0.75, 0);
  const waterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 24));
  waterGeo.translate(0, 0.65, 0);

  const basinOuter = new THREE.Mesh(basinOuterGeo, mats.blushRoseMarble);
  const basinRim = new THREE.Mesh(basinRimGeo, mats.champagneGold);
  const waterMesh = new THREE.Mesh(waterGeo, mats.fountainWater);
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;

  // Central Lotus Pedestal & Crystal Flower
  const lotusStemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.42, 0.6, 1.4, 12));
  lotusStemGeo.translate(0, 1.35, 0);
  const lotusStem = new THREE.Mesh(lotusStemGeo, mats.champagneGold);

  const lotusPetalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.7, 1.3, 6));
  const lotusPetalsGroup = new THREE.Group();
  lotusPetalsGroup.position.set(0, 2.0, 0);
  for (let p = 0; p < 8; p++) {
    const ang = (p * Math.PI * 2) / 8;
    const petal = new THREE.Mesh(lotusPetalGeo, mats.fountainWater);
    petal.position.set(Math.cos(ang) * 0.45, 0, Math.sin(ang) * 0.45);
    petal.rotation.z = Math.cos(ang) * 0.4;
    petal.rotation.x = -Math.sin(ang) * 0.4;
    lotusPetalsGroup.add(petal);
  }

  fountainGroup.add(basinOuter, basinRim, waterMesh, lotusStem, lotusPetalsGroup);
  group.add(fountainGroup);
  colliders.push({ x: nav.originX, z: nav.originZ, radius: 2.9 });

  // Suspended Grand Crystal Chandelier (Hangs from high atrium roof down to Y = 7.5m)
  const chandelierGroup = new THREE.Group();
  chandelierGroup.position.set(0, 7.8, 0);

  const rodGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 8.5, 8));
  rodGeo.translate(0, 4.25, 0);
  const rodMesh = new THREE.Mesh(rodGeo, mats.champagneGold);

  const ring1Geo = tracker.trackGeo(new THREE.TorusGeometry(2.4, 0.1, 8, 24));
  ring1Geo.rotateX(Math.PI / 2);
  const ring2Geo = tracker.trackGeo(new THREE.TorusGeometry(1.5, 0.08, 8, 20));
  ring2Geo.rotateX(Math.PI / 2);
  ring2Geo.translate(0, -0.6, 0);
  const ring3Geo = tracker.trackGeo(new THREE.TorusGeometry(0.75, 0.06, 8, 16));
  ring3Geo.rotateX(Math.PI / 2);
  ring3Geo.translate(0, -1.2, 0);

  const chRing1 = new THREE.Mesh(ring1Geo, mats.champagneGold);
  const chRing2 = new THREE.Mesh(ring2Geo, mats.champagneGold);
  const chRing3 = new THREE.Mesh(ring3Geo, mats.champagneGold);

  // Crystal Drops
  const crystalDropGeo = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.6, 6));
  for (let cd = 0; cd < 16; cd++) {
    const ang = (cd * Math.PI * 2) / 16;
    const drop = new THREE.Mesh(crystalDropGeo, mats.crystalGlass);
    drop.position.set(Math.cos(ang) * 2.38, -0.3, Math.sin(ang) * 2.38);
    chandelierGroup.add(drop);
  }
  for (let cd = 0; cd < 10; cd++) {
    const ang = (cd * Math.PI * 2) / 10;
    const drop = new THREE.Mesh(crystalDropGeo, mats.crystalGlass);
    drop.position.set(Math.cos(ang) * 1.48, -0.9, Math.sin(ang) * 1.48);
    chandelierGroup.add(drop);
  }

  // Warm Chandelier PointLight (Restrained, counts as 1 dynamic point light)
  const chandelierLight = new THREE.PointLight('#fef08a', 2.2, 24.0, 1.5);
  chandelierLight.position.set(0, -0.4, 0);
  chandelierGroup.add(rodMesh, chRing1, chRing2, chRing3, chandelierLight);
  group.add(chandelierGroup);

  // ========================================================================
  // 5. TWIN SWEEPING STAIRS (FLOOR 1 -> FLOOR 2 MEZZANINE)
  // ========================================================================
  // Left / West Sweeping Staircase (lx: [-8.6, -5.2], lz: [-6.0, 6.0])
  const numSteps12 = 18;
  const stepW = 3.2;
  const stepH = 5.0 / numSteps12;
  const stepD = 12.0 / numSteps12;
  const stepGeo = tracker.trackGeo(new THREE.BoxGeometry(stepW, stepH, stepD + 0.05));

  const stairsWestGroup = new THREE.Group();
  const stairsEastGroup = new THREE.Group();

  for (let s = 0; s < numSteps12; s++) {
    const sz = -6.0 + (s + 0.5) * stepD;
    const sy = 0.25 + (s + 0.5) * stepH;

    const westStep = new THREE.Mesh(stepGeo, mats.blushRoseMarble);
    westStep.position.set(-6.9, sy, sz);
    westStep.receiveShadow = true;
    stairsWestGroup.add(westStep);

    const eastStep = new THREE.Mesh(stepGeo, mats.blushRoseMarble);
    eastStep.position.set(6.9, sy, sz);
    eastStep.receiveShadow = true;
    stairsEastGroup.add(eastStep);
  }

  // Golden Balustrades along outer stair edges
  const railGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 13.0, 8));
  railGeo.rotateX(Math.PI / 4.2);
  railGeo.translate(0, 3.2, 0);
  const railWest = new THREE.Mesh(railGeo, mats.champagneGold);
  railWest.position.set(-8.4, 0.25, 0);
  const railEast = new THREE.Mesh(railGeo, mats.champagneGold);
  railEast.position.set(8.4, 0.25, 0);

  group.add(stairsWestGroup, stairsEastGroup, railWest, railEast);

  // ========================================================================
  // 6. LEVEL 2: MEZZANINE & HAUTE COUTURE GALLERY (Y = +5.25m)
  // ========================================================================
  // Perimeter Gallery Floor with Central Atrium Opening (|lx| < 4.8, |lz| < 4.8)
  const mezPlates = [
    { x: 0, z: -10.5, w: 30.0, d: 9.0 },
    { x: 0, z: 10.5, w: 30.0, d: 9.0 },
    { x: -10.5, z: 0, w: 9.0, d: 12.0 },
    { x: 10.5, z: 0, w: 9.0, d: 12.0 },
  ];

  mezPlates.forEach((p) => {
    const geo = tracker.trackGeo(new THREE.BoxGeometry(p.w, 0.35, p.d));
    geo.translate(p.x, 5.25, p.z);
    const mesh = new THREE.Mesh(geo, mats.softLavender);
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  // Mezzanine Gold Balustrades surrounding central atrium
  const balustradeRailGeo = tracker.trackGeo(new THREE.BoxGeometry(9.6, 0.12, 0.16));
  balustradeRailGeo.translate(0, 6.15, 0);
  [-4.8, 4.8].forEach((bz) => {
    const rail = new THREE.Mesh(balustradeRailGeo, mats.champagneGold);
    rail.position.set(0, 0, bz);
    group.add(rail);
  });
  [-4.8, 4.8].forEach((bx) => {
    const railSide = new THREE.Mesh(balustradeRailGeo, mats.champagneGold);
    railSide.rotation.y = Math.PI / 2;
    railSide.position.set(bx, 0, 0);
    group.add(railSide);
  });

  // Stairs (Floor 2 -> Floor 3) along East side: lx: [5.8, 9.2], lz: [7.0, 13.5]
  const numSteps23 = 14;
  const stepH23 = 5.0 / numSteps23;
  const stepD23 = 6.5 / numSteps23;
  const step23Geo = tracker.trackGeo(new THREE.BoxGeometry(3.2, stepH23, stepD23 + 0.04));

  for (let s = 0; s < numSteps23; s++) {
    const sz = 7.0 + (s + 0.5) * stepD23;
    const sy = 5.25 + (s + 0.5) * stepH23;
    const stp = new THREE.Mesh(step23Geo, mats.blushRoseMarble);
    stp.position.set(7.5, sy, sz);
    stp.receiveShadow = true;
    group.add(stp);
  }

  // ========================================================================
  // 7. LEVEL 3: DREAM WING & STARLIGHT SALON (Y = +10.25m)
  // ========================================================================
  const dreamPlates = [
    { x: 0, z: -10.5, w: 29.0, d: 9.0 },
    { x: 0, z: 10.5, w: 29.0, d: 9.0 },
    { x: -10.5, z: 0, w: 9.0, d: 12.0 },
    { x: 10.5, z: 0, w: 9.0, d: 12.0 },
  ];

  dreamPlates.forEach((p) => {
    const geo = tracker.trackGeo(new THREE.BoxGeometry(p.w, 0.35, p.d));
    geo.translate(p.x, 10.25, p.z);
    const mesh = new THREE.Mesh(geo, mats.pearlWhite);
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  // Stairs (Floor 3 -> Floor 4 Rooftop) along West side: lx: [-9.2, -5.8], lz: [7.0, 13.5]
  for (let s = 0; s < numSteps23; s++) {
    const sz = 7.0 + (s + 0.5) * stepD23;
    const sy = 10.25 + (s + 0.5) * stepH23;
    const stp = new THREE.Mesh(step23Geo, mats.blushRoseMarble);
    stp.position.set(-7.5, sy, sz);
    stp.receiveShadow = true;
    group.add(stp);
  }

  // ========================================================================
  // 8. LEVEL 4: ROOFTOP OBSERVATORY TERRACE & TELESCOPE (Y = +15.25m)
  // ========================================================================
  const roofTerraceGeo = tracker.trackGeo(new THREE.BoxGeometry(31.0, 0.45, 31.0));
  roofTerraceGeo.translate(0, 15.25, 0);
  const roofTerrace = new THREE.Mesh(roofTerraceGeo, mats.blushRoseMarble);
  roofTerrace.receiveShadow = true;
  group.add(roofTerrace);

  // Central Faceted Glass Skylight Dome over Atrium
  const domeGeo = tracker.trackGeo(new THREE.SphereGeometry(4.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45));
  domeGeo.translate(0, 15.4, 0);
  const glassDome = new THREE.Mesh(domeGeo, mats.crystalGlass);
  const domeFinialGeo = tracker.trackGeo(new THREE.SphereGeometry(0.4, 8, 8));
  domeFinialGeo.translate(0, 18.6, 0);
  const domeFinial = new THREE.Mesh(domeFinialGeo, mats.champagneGold);
  group.add(glassDome, domeFinial);

  // Champagne Gold Balustrade around Rooftop Terrace Perimeter
  const roofRailNGeo = tracker.trackGeo(new THREE.BoxGeometry(29.0, 0.88, 0.14));
  roofRailNGeo.translate(0, 15.9, -14.8);
  const roofRailSGeo = tracker.trackGeo(new THREE.BoxGeometry(29.0, 0.88, 0.14));
  roofRailSGeo.translate(0, 15.9, 14.8);
  const roofRailWGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.88, 29.0));
  roofRailWGeo.translate(-14.8, 15.9, 0);
  const roofRailEGeo = tracker.trackGeo(new THREE.BoxGeometry(0.14, 0.88, 29.0));
  roofRailEGeo.translate(14.8, 15.9, 0);

  const rRailN = new THREE.Mesh(roofRailNGeo, mats.champagneGold);
  const rRailS = new THREE.Mesh(roofRailSGeo, mats.champagneGold);
  const rRailW = new THREE.Mesh(roofRailWGeo, mats.champagneGold);
  const rRailE = new THREE.Mesh(roofRailEGeo, mats.champagneGold);
  group.add(rRailN, rRailS, rRailW, rRailE);

  // Gilded Brass Telescope on Rooftop (lx = 0, lz = -13.5, overlooking Heart Island)
  const telescopeGroup = new THREE.Group();
  telescopeGroup.position.set(0, 15.48, -13.5);

  const teleBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.65, 0.85, 0.25, 12));
  const telePierGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 1.35, 10));
  telePierGeo.translate(0, 0.75, 0);
  const teleTubeGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 2.2, 12));
  teleTubeGeo.rotateX(Math.PI / 4.5);
  teleTubeGeo.translate(0, 1.48, 0.35);

  const teleBase = new THREE.Mesh(teleBaseGeo, mats.champagneGold);
  const telePier = new THREE.Mesh(telePierGeo, mats.champagneGold);
  const teleTube = new THREE.Mesh(teleTubeGeo, mats.telescopeBrass);
  telescopeGroup.add(teleBase, telePier, teleTube);
  group.add(telescopeGroup);

  // Soft Rooftop Lantern Glow PointLight (Restrained, 2nd point light)
  const rooftopLight = new THREE.PointLight('#fef08a', 1.8, 18.0, 1.6);
  rooftopLight.position.set(0, 17.5, 0);
  group.add(rooftopLight);

  // ========================================================================
  // 9. LEVEL -1: BASEMENT VAULT & SERVICE STAIRS (Y = -4.5m)
  // ========================================================================
  const basementFloorGeo = tracker.trackGeo(new THREE.BoxGeometry(26.0, 0.5, 26.0));
  basementFloorGeo.translate(0, -4.5, 0);
  const basementFloor = new THREE.Mesh(basementFloorGeo, mats.creamStone);
  basementFloor.receiveShadow = true;
  group.add(basementFloor);

  // Basement Service Stairs (Floor 1 -> Basement -1): lx: [-3.0, 3.0], lz: [11.5, 15.5]
  const numStepsB = 16;
  const stepHB = 4.75 / numStepsB;
  const stepDB = 4.0 / numStepsB;
  const stepBGeo = tracker.trackGeo(new THREE.BoxGeometry(3.0, stepHB, stepDB + 0.04));

  for (let s = 0; s < numStepsB; s++) {
    const sz = 11.5 + (s + 0.5) * stepDB;
    const sy = 0.25 - (s + 0.5) * stepHB;
    const stp = new THREE.Mesh(stepBGeo, mats.creamStone);
    stp.position.set(0, sy, sz);
    stp.receiveShadow = true;
    group.add(stp);
  }

  // ========================================================================
  // 10. WORKING 5-FLOOR GLASS & GOLD ELEVATOR
  // ========================================================================
  const elevatorShaftX = nav.elevatorShaftLocalX;
  const elevatorShaftZ = nav.elevatorShaftLocalZ;

  // 4 Champagne Gold Guide Columns spanning Basement to Rooftop (-4.5m to 16.5m, H = 21m)
  const shaftColGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 22.0, 10));
  shaftColGeo.translate(0, 6.0, 0);

  const shaftCornerOffsets = [
    { x: -1.75, z: -1.75 },
    { x: 1.75, z: -1.75 },
    { x: -1.75, z: 1.75 },
    { x: 1.75, z: 1.75 },
  ];

  shaftCornerOffsets.forEach((off) => {
    const col = new THREE.Mesh(shaftColGeo, mats.champagneGold);
    col.position.set(elevatorShaftX + off.x, 0, elevatorShaftZ + off.z);
    col.castShadow = true;
    group.add(col);
  });

  // Elevator Floor Ring Frames at each floor level
  CASTLE_FLOOR_DEFS.forEach((f) => {
    const ringGeo = tracker.trackGeo(new THREE.TorusGeometry(2.35, 0.08, 8, 20));
    ringGeo.rotateX(Math.PI / 2);
    ringGeo.translate(elevatorShaftX, f.elevOffset, elevatorShaftZ);
    const ring = new THREE.Mesh(ringGeo, mats.champagneGold);
    group.add(ring);
  });

  // Dynamic Elevator Cabin
  const cabinGroup = new THREE.Group();
  cabinGroup.position.set(elevatorShaftX, nav.elevatorCabinY, elevatorShaftZ);

  // Cabin Floor & Ceiling
  const cabinFloorGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.85, 1.85, 0.22, 20));
  cabinFloorGeo.translate(0, -0.11, 0);
  const cabinCeilGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.85, 1.85, 0.25, 20));
  cabinCeilGeo.translate(0, 2.7, 0);
  const cabinDomeGeo = tracker.trackGeo(new THREE.ConeGeometry(1.9, 0.8, 16));
  cabinDomeGeo.translate(0, 3.2, 0);

  const cabinFloorMesh = new THREE.Mesh(cabinFloorGeo, mats.blushRoseMarble);
  cabinFloorMesh.receiveShadow = true;
  const cabinCeilMesh = new THREE.Mesh(cabinCeilGeo, mats.champagneGold);
  const cabinDomeMesh = new THREE.Mesh(cabinDomeGeo, mats.champagneGold);

  // Translucent Curved Glass Walls (Back and Sides)
  const cabinGlassGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.82, 1.82, 2.6, 24, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
  );
  cabinGlassGeo.translate(0, 1.3, 0);
  const cabinGlassMesh = new THREE.Mesh(cabinGlassGeo, mats.crystalGlass);

  // Sliding Glass & Gold Front Doors (left and right panels)
  const slideDoorGeo = tracker.trackGeo(new THREE.BoxGeometry(0.85, 2.5, 0.08));
  slideDoorGeo.translate(0.425, 1.25, 0);

  const leftSlideDoor = new THREE.Mesh(slideDoorGeo, mats.champagneGold);
  leftSlideDoor.position.set(-0.85, 0, -1.8);
  const rightSlideDoor = new THREE.Mesh(slideDoorGeo, mats.champagneGold);
  rightSlideDoor.scale.x = -1;
  rightSlideDoor.position.set(0.85, 0, -1.8);

  // Miniature Golden Chandelier inside Cabin
  const miniChandelierGeo = tracker.trackGeo(new THREE.SphereGeometry(0.18, 8, 8));
  miniChandelierGeo.translate(0, 2.45, 0);
  const miniChandelier = new THREE.Mesh(miniChandelierGeo, mats.warmLanternGlow);

  cabinGroup.add(
    cabinFloorMesh,
    cabinCeilMesh,
    cabinDomeMesh,
    cabinGlassMesh,
    leftSlideDoor,
    rightSlideDoor,
    miniChandelier,
  );
  group.add(cabinGroup);

  // ========================================================================
  // 11. PUBLIC INTERACTION & UPDATE LOGIC
  // ========================================================================
  return {
    group,
    colliders,
    nav,

    getSurfaceHeight: (wx: number, wz: number, playerY: number, defaultGroundY: number) => {
      return nav.getSurfaceHeight(wx, wz, playerY, defaultGroundY);
    },

    isInsideCastle: (wx: number, wz: number) => {
      return nav.isInsideCastleBounds(wx, wz);
    },

    getProximityPrompt: (playerPos: THREE.Vector3) => {
      // 1. Entrance Doors
      if (nav.isNearEntranceDoors(playerPos) && nav.doorState === 'CLOSED') {
        return {
          prompt: '[E] Open the Grand Palace Doors',
          action: 'door',
        };
      }

      // 2. Inside Elevator Cabin
      if (nav.isInsideElevatorCabin(playerPos)) {
        return {
          prompt: '[1] Grand Hall  [2] Fashion  [3] Dream Wing  [4] Rooftop  [0] Basement',
          action: 'call_elevator',
        };
      }

      // 3. Near Elevator Call Button on any floor
      const callInfo = nav.isNearElevatorFloorCall(playerPos);
      if (callInfo) {
        return {
          prompt: `[E] Call Elevator (${callInfo.floor.shortName})`,
          action: 'call_elevator',
        };
      }

      // 4. Rooftop Telescope
      const { lx, lz } = nav.worldToLocal(playerPos.x, playerPos.z);
      if (Math.hypot(lx, lz - (-13.5)) <= 2.8 && playerPos.y >= nav.baseY + 14.5) {
        return {
          prompt: '[E] Look through Gilded Telescope',
          action: 'telescope',
        };
      }

      return null;
    },

    interact: () => {
      // Check what action applies
      if (nav.doorState === 'CLOSED') {
        nav.openEntranceDoors();
        return true;
      }
      return false;
    },

    handleElevatorFloorSelect: (floorNum: number) => {
      return nav.callElevatorToFloor(floorNum);
    },

    getCameraFocus: () => {
      if (!nav.activeCameraFocus) return null;
      return {
        target: nav.activeCameraFocus.target,
        position: nav.activeCameraFocus.position,
        fov: nav.activeCameraFocus.fov,
      };
    },

    update: (delta: number, playerPos: THREE.Vector3) => {
      nav.update(delta, playerPos);

      // Animate Entrance Doors
      // Left swings to -105 deg (-1.83 rad), Right swings to +105 deg (+1.83 rad)
      const maxSwing = THREE.MathUtils.degToRad(105);
      leftDoorPivot.rotation.y = -nav.doorOpenRatio * maxSwing;
      rightDoorPivot.rotation.y = -nav.doorOpenRatio * maxSwing;

      // Animate Elevator Cabin Y and Doors
      cabinGroup.position.y = nav.elevatorCabinY - nav.baseY;
      const doorSlideOffset = nav.elevatorDoorsOpenRatio * 0.78;
      leftSlideDoor.position.x = -0.85 - doorSlideOffset;
      rightSlideDoor.position.x = 0.85 + doorSlideOffset;
    },

    dispose: () => {
      tracker.dispose();
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    },
  };
}
