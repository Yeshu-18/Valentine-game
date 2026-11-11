import * as THREE from 'three';
import { RoomTextureSet } from './cell04Textures';

/**
 * Builds the procedural 3D architectural shell, composite furniture groups,
 * physical narrative clues, and doorway corridor silhouette figure for Cell 04:
 * - Room shell (floor, ceiling, walls with north doorway frame, baseboards, overhead pendant lamp)
 * - Bed (iron frame, 4 corner legs, slatted headboard, mattress, blanket, angled pillow)
 * - Desk (timber tabletop, 4 legs, drawer cabinet, drawer fronts & brass pulls, architect desk lamp)
 * - Chair (4 legs, wooden seat, 2 back posts, 2 curved backrest slats)
 * - Door (heavy steel frame, hinged riveted door slab, barred observation slit, deadbolt lock box, status LED, lever handle)
 * - Rotary Phone on Desk (sloped bakelite base, rotary wheel, cradle prongs, sculpted handset, coiled cord, status LED)
 * - Physical Photograph (14 / 02 / 2024) properly aligned on the desk
 * - Three Relationship Memory Clues (Realistic optical eyeglasses & glass tumbler on desk, Pinky Moment keepsake on chair, Confession phone on bed)
 * - Mysterious Silhouette Figure in the corridor beyond the steel door
 */
export interface RoomPropsResult {
  doorGroup: THREE.Group;
  doorHingePivot: THREE.Group;
  doorHandlePivot: THREE.Group;
  doorStatusMat: THREE.MeshStandardMaterial;
  doorHitMeshes: THREE.Object3D[];

  phoneGroup: THREE.Group;
  phoneHandset: THREE.Group;
  phoneLedMat: THREE.MeshStandardMaterial;
  phoneHitMeshes: THREE.Object3D[];

  photographGroup: THREE.Group;
  photographHitMeshes: THREE.Object3D[];

  memoryHailMaryGroup: THREE.Group;
  memoryHailMaryHitMeshes: THREE.Object3D[];

  memoryPinkyGroup: THREE.Group;
  memoryPinkyHitMeshes: THREE.Object3D[];
  pinkyHandsVfxGroup: THREE.Group;
  pinkyLeftHand: THREE.Group;
  pinkyRightHand: THREE.Group;
  pinkyEmberPoints: THREE.Points;
  pinkyWarmLight: THREE.PointLight;

  memoryConfessionGroup: THREE.Group;
  memoryConfessionHitMeshes: THREE.Object3D[];
  confessionScreenMat: THREE.MeshStandardMaterial;

  bedGroup: THREE.Group;
  bedHitMeshes: THREE.Object3D[];

  deskGroup: THREE.Group;
  deskHitMeshes: THREE.Object3D[];

  chairGroup: THREE.Group;
  chairHitMeshes: THREE.Object3D[];

  figureGroup: THREE.Group;
  corridorLight: THREE.PointLight;

  overheadBulbMat: THREE.MeshStandardMaterial;
  deskBulbMat: THREE.MeshStandardMaterial;
}

function createContactShadow(
  width: number,
  depth: number,
  shadowTex: THREE.CanvasTexture,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  return mesh;
}

export function buildRoomProps(
  scene: THREE.Scene,
  textures: RoomTextureSet,
): RoomPropsResult {
  const doorHitMeshes: THREE.Object3D[] = [];
  const phoneHitMeshes: THREE.Object3D[] = [];
  const photographHitMeshes: THREE.Object3D[] = [];
  const memoryHailMaryHitMeshes: THREE.Object3D[] = [];
  const memoryPinkyHitMeshes: THREE.Object3D[] = [];
  const memoryConfessionHitMeshes: THREE.Object3D[] = [];
  const bedHitMeshes: THREE.Object3D[] = [];
  const deskHitMeshes: THREE.Object3D[] = [];
  const chairHitMeshes: THREE.Object3D[] = [];

  // Shared PBR Materials with varied roughness & metalness
  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.wall,
    roughness: 0.88,
    metalness: 0.05,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.floor,
    roughness: 0.82,
    metalness: 0.08,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e22,
    roughness: 0.92,
    metalness: 0.05,
  });
  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0x181a1d,
    roughness: 0.6,
    metalness: 0.2,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    roughness: 0.45,
    metalness: 0.8,
  });
  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x7c8490,
    roughness: 0.28,
    metalness: 0.9,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb89246,
    roughness: 0.25,
    metalness: 0.88,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.68,
    metalness: 0.06,
  });
  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2f1f14,
    roughness: 0.42,
    metalness: 0.12,
  });
  const mattressMat = new THREE.MeshStandardMaterial({
    map: textures.fabric,
    roughness: 0.9,
    metalness: 0.02,
  });
  const blanketMat = new THREE.MeshStandardMaterial({
    color: 0x2f3b44,
    roughness: 0.94,
    metalness: 0.02,
  });
  const pillowMat = new THREE.MeshStandardMaterial({
    color: 0x9c9689,
    roughness: 0.85,
    metalness: 0.02,
  });

  // ==========================================
  // 1. ROOM SHELL (6m x 6m, height 3.4m)
  // ==========================================
  const roomGroup = new THREE.Group();
  const roomSize = 6.0;
  const roomHeight = 3.4;

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(roomSize, roomSize),
    floorMat,
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  roomGroup.add(floorMesh);

  const ceilingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(roomSize, roomSize),
    ceilingMat,
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.y = roomHeight;
  roomGroup.add(ceilingMesh);

  // North Wall built with doorway aperture (x in [-0.52, +0.52], y in [0, 2.12])
  const northLeftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.48, roomHeight),
    wallMat,
  );
  northLeftWall.position.set(-1.76, roomHeight / 2, -roomSize / 2);
  northLeftWall.receiveShadow = true;
  roomGroup.add(northLeftWall);

  const northRightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.48, roomHeight),
    wallMat,
  );
  northRightWall.position.set(1.76, roomHeight / 2, -roomSize / 2);
  northRightWall.receiveShadow = true;
  roomGroup.add(northRightWall);

  const northTopWall = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, roomHeight - 2.12),
    wallMat,
  );
  northTopWall.position.set(0, 2.12 + (roomHeight - 2.12) / 2, -roomSize / 2);
  northTopWall.receiveShadow = true;
  roomGroup.add(northTopWall);

  const northBaseLeft = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.14, 0.04),
    baseboardMat,
  );
  northBaseLeft.position.set(-1.79, 0.07, -roomSize / 2);
  roomGroup.add(northBaseLeft);

  const northBaseRight = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.14, 0.04),
    baseboardMat,
  );
  northBaseRight.position.set(1.79, 0.07, -roomSize / 2);
  roomGroup.add(northBaseRight);

  const wallDefs = [
    { pos: [0, roomHeight / 2, roomSize / 2], rotY: Math.PI }, // South wall
    { pos: [-roomSize / 2, roomHeight / 2, 0], rotY: Math.PI / 2 }, // West wall (Bed)
    { pos: [roomSize / 2, roomHeight / 2, 0], rotY: -Math.PI / 2 }, // East wall (Desk)
  ];

  wallDefs.forEach(({ pos, rotY }) => {
    const wMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(roomSize, roomHeight),
      wallMat,
    );
    wMesh.position.set(pos[0], pos[1], pos[2]);
    wMesh.rotation.y = rotY;
    wMesh.receiveShadow = true;
    roomGroup.add(wMesh);

    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(roomSize, 0.14, 0.04),
      baseboardMat,
    );
    baseMesh.position.set(pos[0], 0.07, pos[2]);
    baseMesh.rotation.y = rotY;
    baseMesh.receiveShadow = true;
    roomGroup.add(baseMesh);
  });

  // Outer corridor vestibule beyond the North Door
  const corridorMat = new THREE.MeshStandardMaterial({
    color: 0x0d1017,
    roughness: 0.9,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const corridorShell = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.6, 2.8),
    corridorMat,
  );
  corridorShell.position.set(0, 1.3, -4.35);
  roomGroup.add(corridorShell);

  const corridorLight = new THREE.PointLight(0xf59e0b, 0.0, 6.5, 1.6);
  corridorLight.position.set(0, 2.05, -4.85);
  scene.add(corridorLight);

  // Mysterious Figure in Silhouette standing in the outer corridor
  const figureGroup = new THREE.Group();
  figureGroup.position.set(0, 0, -4.15);
  figureGroup.visible = false;

  const silhouetteMat = new THREE.MeshStandardMaterial({
    color: 0x07090d,
    roughness: 0.85,
    metalness: 0.08,
  });

  const leftLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.065, 0.86, 12),
    silhouetteMat,
  );
  leftLeg.position.set(-0.11, 0.43, 0);
  figureGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.065, 0.86, 12),
    silhouetteMat,
  );
  rightLeg.position.set(0.11, 0.43, 0);
  figureGroup.add(rightLeg);

  const torsoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.17, 0.66, 16),
    silhouetteMat,
  );
  torsoMesh.position.set(0, 1.16, 0);
  figureGroup.add(torsoMesh);

  const shouldersMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 12),
    silhouetteMat,
  );
  shouldersMesh.scale.set(1.15, 0.42, 0.68);
  shouldersMesh.position.set(0, 1.44, 0);
  figureGroup.add(shouldersMesh);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.065, 0.12, 12),
    silhouetteMat,
  );
  neckMesh.position.set(0, 1.54, 0);
  figureGroup.add(neckMesh);

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 16),
    silhouetteMat,
  );
  headMesh.scale.set(0.92, 1.12, 0.98);
  headMesh.position.set(0, 1.69, 0);
  figureGroup.add(headMesh);

  const leftArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.048, 0.62, 10),
    silhouetteMat,
  );
  leftArm.position.set(-0.26, 1.15, 0.04);
  leftArm.rotation.z = 0.08;
  leftArm.rotation.x = -0.12;
  figureGroup.add(leftArm);

  const rightArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.048, 0.62, 10),
    silhouetteMat,
  );
  rightArm.position.set(0.26, 1.15, 0.04);
  rightArm.rotation.z = -0.08;
  rightArm.rotation.x = -0.12;
  figureGroup.add(rightArm);

  scene.add(figureGroup);

  // Overhead industrial pendant lamp fixture at ceiling center
  const fixtureGroup = new THREE.Group();
  fixtureGroup.position.set(0, roomHeight, 0);
  const cordMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8),
    darkIronMat,
  );
  cordMesh.position.y = -0.225;
  fixtureGroup.add(cordMesh);

  const shadeMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.16, 16, 1, true),
    darkIronMat,
  );
  shadeMesh.material.side = THREE.DoubleSide;
  shadeMesh.position.y = -0.45;
  fixtureGroup.add(shadeMesh);

  const overheadBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffdf9e,
    emissive: 0xffb85c,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 12),
    overheadBulbMat,
  );
  bulbMesh.position.y = -0.5;
  fixtureGroup.add(bulbMesh);
  roomGroup.add(fixtureGroup);

  scene.add(roomGroup);

  // ==========================================
  // 2. BED (Composite 8-Part Group, West Wall)
  // ==========================================
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-2.2, 0, 1.15);

  bedGroup.add(createContactShadow(1.55, 2.35, textures.shadowDecal));

  const legGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.36, 10);
  const bedLegCoords = [
    [-0.6, 0.18, -0.98],
    [0.6, 0.18, -0.98],
    [-0.6, 0.18, 0.98],
    [0.6, 0.18, 0.98],
  ];
  bedLegCoords.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, darkIronMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    bedGroup.add(leg);
  });

  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.08, 2.04),
    darkIronMat,
  );
  frameBase.position.set(0, 0.34, 0);
  frameBase.castShadow = true;
  frameBase.receiveShadow = true;
  bedGroup.add(frameBase);
  bedHitMeshes.push(frameBase);

  const headboardTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.28, 10),
    darkIronMat,
  );
  headboardTop.rotation.z = Math.PI / 2;
  headboardTop.position.set(0, 0.95, 0.98);
  headboardTop.castShadow = true;
  bedGroup.add(headboardTop);

  for (let bx = -0.55; bx <= 0.56; bx += 0.22) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.62, 8),
      darkIronMat,
    );
    bar.position.set(bx, 0.64, 0.98);
    bar.castShadow = true;
    bedGroup.add(bar);
  }

  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.22, 1.92),
    mattressMat,
  );
  mattress.position.set(0, 0.49, -0.01);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  bedGroup.add(mattress);
  bedHitMeshes.push(mattress);

  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(1.23, 0.23, 1.25),
    blanketMat,
  );
  blanket.position.set(0, 0.5, -0.34);
  blanket.castShadow = true;
  blanket.receiveShadow = true;
  bedGroup.add(blanket);
  bedHitMeshes.push(blanket);

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.11, 0.42),
    pillowMat,
  );
  pillow.position.set(0, 0.64, 0.66);
  pillow.rotation.x = 0.14;
  pillow.rotation.z = -0.05;
  pillow.castShadow = true;
  pillow.receiveShadow = true;
  bedGroup.add(pillow);
  bedHitMeshes.push(pillow);

  scene.add(bedGroup);

  // ==========================================
  // 3. DESK (Composite 9-Part Group, East Wall)
  // ==========================================
  const deskGroup = new THREE.Group();
  deskGroup.position.set(2.15, 0, -0.2);

  deskGroup.add(createContactShadow(1.15, 1.85, textures.shadowDecal));

  const tabletop = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.06, 1.62),
    woodMat,
  );
  tabletop.position.set(0, 0.78, 0);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  deskGroup.add(tabletop);
  deskHitMeshes.push(tabletop);

  const deskLegGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
  const deskLegPositions = [
    [-0.36, 0.375, -0.73],
    [0.36, 0.375, -0.73],
    [-0.36, 0.375, 0.73],
    [0.36, 0.375, 0.73],
  ];
  deskLegPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(deskLegGeo, woodDarkMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    deskGroup.add(leg);
  });

  const drawerCabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.46, 0.48),
    woodDarkMat,
  );
  drawerCabinet.position.set(0, 0.52, 0.48);
  drawerCabinet.castShadow = true;
  drawerCabinet.receiveShadow = true;
  deskGroup.add(drawerCabinet);
  deskHitMeshes.push(drawerCabinet);

  [0.62, 0.41].forEach((dy) => {
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.17, 0.42),
      woodMat,
    );
    front.position.set(-0.39, dy, 0.48);
    deskGroup.add(front);
    deskHitMeshes.push(front);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.025, 0.1),
      brassMat,
    );
    handle.position.set(-0.41, dy, 0.48);
    deskGroup.add(handle);
  });

  const deskLampGroup = new THREE.Group();
  deskLampGroup.position.set(0.18, 0.81, -0.52);

  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.04, 16),
    darkIronMat,
  );
  lampBase.position.y = 0.02;
  deskLampGroup.add(lampBase);

  const lampStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8),
    brassMat,
  );
  lampStem.position.set(0.03, 0.22, 0);
  lampStem.rotation.z = -0.22;
  deskLampGroup.add(lampStem);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.18, 16, 1, true),
    darkIronMat,
  );
  lampShade.material.side = THREE.DoubleSide;
  lampShade.position.set(-0.06, 0.4, 0.08);
  lampShade.rotation.z = 0.48;
  lampShade.rotation.x = 0.25;
  deskLampGroup.add(lampShade);

  const deskBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: 0xffae42,
    emissiveIntensity: 3.0,
    roughness: 0.2,
  });
  const deskBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 10),
    deskBulbMat,
  );
  deskBulb.position.set(-0.07, 0.37, 0.09);
  deskLampGroup.add(deskBulb);

  deskGroup.add(deskLampGroup);
  scene.add(deskGroup);

  // ==========================================
  // 4. CHAIR (Composite 6-Part Group, pulled slightly out from desk)
  // ==========================================
  const chairGroup = new THREE.Group();
  chairGroup.position.set(1.32, 0, -0.35);
  chairGroup.rotation.y = 0.28;

  chairGroup.add(createContactShadow(0.62, 0.62, textures.shadowDecal));

  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.045, 0.48),
    woodMat,
  );
  seatMesh.position.set(0, 0.46, 0);
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chairGroup.add(seatMesh);
  chairHitMeshes.push(seatMesh);

  const chairLegGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.46, 8);
  const chairLegs = [
    [-0.2, 0.23, -0.2],
    [0.2, 0.23, -0.2],
    [-0.2, 0.23, 0.2],
    [0.2, 0.23, 0.2],
  ];
  chairLegs.forEach(([lx, ly, lz]) => {
    const cLeg = new THREE.Mesh(chairLegGeo, woodDarkMat);
    cLeg.position.set(lx, ly, lz);
    cLeg.castShadow = true;
    chairGroup.add(cLeg);
  });

  [-0.2, 0.2].forEach((bz) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.48, 0.04),
      woodDarkMat,
    );
    post.position.set(-0.21, 0.72, bz);
    post.rotation.z = 0.06;
    post.castShadow = true;
    chairGroup.add(post);
    chairHitMeshes.push(post);
  });

  [0.65, 0.85].forEach((by) => {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.09, 0.44),
      woodMat,
    );
    slat.position.set(-0.22, by, 0);
    slat.castShadow = true;
    chairGroup.add(slat);
    chairHitMeshes.push(slat);
  });

  scene.add(chairGroup);

  // ==========================================
  // 5. LOCKED STEEL DOOR (Composite 8-Part Group, North Wall, Hinged for Finale)
  // ==========================================
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, -2.96);

  const frameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.24, 0.14),
    darkIronMat,
  );
  frameLeft.position.set(-0.58, 1.12, 0);
  doorGroup.add(frameLeft);

  const frameRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.24, 0.14),
    darkIronMat,
  );
  frameRight.position.set(0.58, 1.12, 0);
  doorGroup.add(frameRight);

  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.12, 0.14),
    darkIronMat,
  );
  frameTop.position.set(0, 2.18, 0);
  doorGroup.add(frameTop);

  const doorHingePivot = new THREE.Group();
  doorHingePivot.position.set(-0.52, 0, 0);
  doorGroup.add(doorHingePivot);

  const doorSlabMat = new THREE.MeshStandardMaterial({
    map: textures.doorSteel,
    roughness: 0.48,
    metalness: 0.78,
  });
  const doorSlab = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 2.12, 0.07),
    doorSlabMat,
  );
  doorSlab.position.set(0.52, 1.06, 0);
  doorSlab.castShadow = true;
  doorSlab.receiveShadow = true;
  doorHingePivot.add(doorSlab);
  doorHitMeshes.push(doorSlab);

  const viewportFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.09),
    darkIronMat,
  );
  viewportFrame.position.set(0.52, 1.62, 0.01);
  doorHingePivot.add(viewportFrame);

  const viewportBacking = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x050608 }),
  );
  viewportBacking.position.set(0.52, 1.62, 0.056);
  doorHingePivot.add(viewportBacking);

  for (let vx = -0.1; vx <= 0.11; vx += 0.065) {
    const vBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8),
      brushedSteelMat,
    );
    vBar.position.set(0.52 + vx, 1.62, 0.06);
    doorHingePivot.add(vBar);
  }

  const lockBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.24, 0.06),
    darkIronMat,
  );
  lockBox.position.set(0.9, 1.05, 0.05);
  doorHingePivot.add(lockBox);
  doorHitMeshes.push(lockBox);

  const doorStatusMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff1111,
    emissiveIntensity: 2.8,
    roughness: 0.2,
  });
  const lockLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    doorStatusMat,
  );
  lockLed.position.set(0.9, 1.12, 0.082);
  doorHingePivot.add(lockLed);

  const doorHandlePivot = new THREE.Group();
  doorHandlePivot.position.set(0.9, 1.0, 0.08);
  const handleShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.05, 10),
    brushedSteelMat,
  );
  handleShaft.rotation.x = Math.PI / 2;
  doorHandlePivot.add(handleShaft);

  const handleGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.026, 0.024),
    brushedSteelMat,
  );
  handleGrip.position.set(-0.055, 0, 0.025);
  doorHandlePivot.add(handleGrip);
  doorHitMeshes.push(handleGrip);

  doorHingePivot.add(doorHandlePivot);
  scene.add(doorGroup);

  // ==========================================
  // 6. ROTARY PHONE ON THE DESK (Composite 8-Part Group)
  // ==========================================
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(2.04, 0.81, -0.05);
  phoneGroup.rotation.y = -Math.PI / 2 - 0.15;

  const bakeliteMat = new THREE.MeshPhysicalMaterial({
    color: 0x141619,
    roughness: 0.22,
    metalness: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
  });

  const phoneHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.28, 0.32),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  phoneHitbox.position.set(0, 0.14, 0);
  phoneGroup.add(phoneHitbox);
  phoneHitMeshes.push(phoneHitbox);

  const phoneBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.065, 0.22),
    bakeliteMat,
  );
  phoneBase.position.set(0, 0.0325, 0);
  phoneBase.castShadow = true;
  phoneBase.receiveShadow = true;
  phoneGroup.add(phoneBase);
  phoneHitMeshes.push(phoneBase);

  const phoneConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.075, 0.16),
    bakeliteMat,
  );
  phoneConsole.position.set(0, 0.08, -0.01);
  phoneConsole.rotation.x = 0.32;
  phoneConsole.castShadow = true;
  phoneGroup.add(phoneConsole);
  phoneHitMeshes.push(phoneConsole);

  const dialMat = new THREE.MeshStandardMaterial({
    map: textures.phoneDial,
    roughness: 0.35,
    metalness: 0.2,
  });
  const dialWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.012, 24),
    dialMat,
  );
  dialWheel.position.set(0, 0.105, 0.035);
  dialWheel.rotation.x = 0.32;
  phoneGroup.add(dialWheel);

  [-0.065, 0.065].forEach((cx) => {
    const prong = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.045, 10),
      brushedSteelMat,
    );
    prong.position.set(cx, 0.13, -0.045);
    phoneGroup.add(prong);
  });

  const phoneLedMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0xff1111,
    emissiveIntensity: 3.5,
    roughness: 0.15,
  });
  const phoneLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 10, 10),
    phoneLedMat,
  );
  phoneLed.position.set(0.085, 0.095, 0.075);
  phoneGroup.add(phoneLed);

  const phoneHandset = new THREE.Group();
  phoneHandset.position.set(0, 0.155, -0.045);

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12),
    bakeliteMat,
  );
  handleBar.rotation.z = Math.PI / 2;
  handleBar.castShadow = true;
  phoneHandset.add(handleBar);
  phoneHitMeshes.push(handleBar);

  [-0.105, 0.105].forEach((earX) => {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.026, 0.045, 16),
      bakeliteMat,
    );
    cup.position.set(earX, -0.012, 0);
    cup.castShadow = true;
    phoneHandset.add(cup);
    phoneHitMeshes.push(cup);
  });
  phoneGroup.add(phoneHandset);

  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.1, 0.04, -0.05),
    new THREE.Vector3(-0.16, 0.02, -0.02),
    new THREE.Vector3(-0.15, 0.06, 0.04),
    new THREE.Vector3(-0.11, 0.13, -0.04),
  ]);
  const phoneCord = new THREE.Mesh(
    new THREE.TubeGeometry(cordCurve, 20, 0.008, 8, false),
    bakeliteMat,
  );
  phoneGroup.add(phoneCord);

  scene.add(phoneGroup);

  // ==========================================
  // 7. THE PHOTOGRAPH (14 / 02 / 2024) ON THE DESK (Properly Aligned Facing the Player)
  // ==========================================
  const photographGroup = new THREE.Group();
  photographGroup.position.set(1.94, 0.814, 0.34);
  // Rotate -90 deg so the top face (+Y) UVs align upright toward the player standing at -X looking +X
  photographGroup.rotation.y = -Math.PI / 2;

  const photoCardMatFront = new THREE.MeshStandardMaterial({
    map: textures.photoFront,
    roughness: 0.45,
    metalness: 0.04,
  });
  const photoCardMatBack = new THREE.MeshStandardMaterial({
    map: textures.photoBack,
    roughness: 0.65,
    metalness: 0.02,
  });
  const photoEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xe6decb,
    roughness: 0.7,
  });

  // 4:5 Portrait aspect ratio matching the 512x640 textures (0.176m wide x 0.22m tall)
  const photoCard = new THREE.Mesh(
    new THREE.BoxGeometry(0.176, 0.004, 0.22),
    [
      photoEdgeMat,
      photoEdgeMat,
      photoCardMatBack, // +Y face (facing up on the desk with centered 14 / 02 / 2024)
      photoCardMatFront, // -Y face (facing down on the desk)
      photoEdgeMat,
      photoEdgeMat,
    ],
  );
  photoCard.castShadow = true;
  photoCard.receiveShadow = true;
  photographGroup.add(photoCard);
  photographHitMeshes.push(photoCard);

  const photoHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.14, 0.3),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  photoHitbox.position.set(0, 0.05, 0);
  photographGroup.add(photoHitbox);
  photographHitMeshes.push(photoHitbox);

  scene.add(photographGroup);

  // ==========================================
  // 8. MEMORY I CLUE: REALISTIC EYEGLASSES & GLASS TUMBLER ON DESK
  // ==========================================
  const memoryHailMaryGroup = new THREE.Group();
  memoryHailMaryGroup.position.set(1.92, 0.814, -0.46);
  memoryHailMaryGroup.rotation.y = -Math.PI / 2 + 0.25;

  // Soft folded microfiber lens-cleaning cloth underneath
  const clothMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.003, 0.13),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  clothMesh.position.set(0, 0.0015, 0);
  clothMesh.rotation.y = 0.08;
  clothMesh.receiveShadow = true;
  memoryHailMaryGroup.add(clothMesh);

  // Realistic Eyeglasses Sub-Group resting on the cloth
  const glassesRig = new THREE.Group();
  glassesRig.position.set(0, 0.018, 0.015);
  // Tilted slightly forward as natural eyeglasses rest on a table
  glassesRig.rotation.x = 0.14;

  const titaniumRimMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.2,
    metalness: 0.92,
  });
  const tortoiseBrowMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c1411,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.9,
  });
  const opticalLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.06,
    metalness: 0.05,
    transmission: 0.86,
    ior: 1.52,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.82,
  });
  const nosePadMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    transmission: 0.7,
    transparent: true,
    opacity: 0.75,
  });

  // Left and Right Optical Rims, Browline Bars, Meniscus Lenses, and Nose Pads
  [-0.034, 0.034].forEach((lx, sideIdx) => {
    const sign = sideIdx === 0 ? -1 : 1;

    // 1. Sculpted oval-round metallic rim
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.0022, 14, 36),
      titaniumRimMat,
    );
    rimMesh.scale.set(1.12, 0.92, 1.0);
    rimMesh.position.set(lx, 0, 0);
    rimMesh.castShadow = true;
    glassesRig.add(rimMesh);

    // 2. Clubmaster / acetate upper browline accent along top half of rim
    const browArc = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.0255,
        0.0036,
        12,
        24,
        Math.PI * 0.82,
      ),
      tortoiseBrowMat,
    );
    browArc.scale.set(1.12, 0.92, 1.1);
    browArc.rotation.z = Math.PI * 0.09;
    browArc.position.set(lx, 0.001, 0.0005);
    glassesRig.add(browArc);

    // 3. Curved meniscus optical lens (spherical cap)
    const lensCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.052,
        24,
        16,
        0,
        Math.PI * 2,
        0,
        0.48,
      ),
      opticalLensMat,
    );
    lensCap.scale.set(1.1, 0.9, 0.28);
    lensCap.rotation.x = Math.PI / 2;
    lensCap.position.set(lx, 0, -0.012);
    glassesRig.add(lensCap);

    // 4. Translucent silicone nose pad + pad arm on inner side of rim
    const padMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.0042, 10, 10),
      nosePadMat,
    );
    padMesh.scale.set(0.65, 1.45, 0.45);
    padMesh.position.set(lx - sign * 0.021, -0.004, -0.006);
    padMesh.rotation.y = sign * 0.35;
    glassesRig.add(padMesh);

    // 5. Outer endpiece hinge block
    const endpiece = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.0045, 0.007),
      titaniumRimMat,
    );
    endpiece.position.set(lx + sign * 0.029, 0.006, -0.002);
    glassesRig.add(endpiece);

    // 6. Realistic Temple Arm with anatomical ear bend (TubeGeometry)
    const templeX = lx + sign * 0.031;
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(templeX, 0.006, -0.004),
      new THREE.Vector3(templeX - sign * 0.002, 0.005, -0.052),
      new THREE.Vector3(templeX - sign * 0.005, 0.004, -0.092),
      new THREE.Vector3(templeX - sign * 0.008, -0.011, -0.114),
    ]);
    const templeArm = new THREE.Mesh(
      new THREE.TubeGeometry(templeCurve, 20, 0.0021, 8, false),
      titaniumRimMat,
    );
    templeArm.castShadow = true;
    glassesRig.add(templeArm);

    // Acetate ear-sock tip at the end of the temple
    const earTipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(templeX - sign * 0.004, 0.0045, -0.082),
      new THREE.Vector3(templeX - sign * 0.006, 0.001, -0.102),
      new THREE.Vector3(templeX - sign * 0.009, -0.013, -0.116),
    ]);
    const earTip = new THREE.Mesh(
      new THREE.TubeGeometry(earTipCurve, 12, 0.0028, 8, false),
      tortoiseBrowMat,
    );
    glassesRig.add(earTip);
  });

  // Curved anatomical nose bridge connecting the two rims
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.008, 0.005, 0.001),
    new THREE.Vector3(0, 0.0085, 0.003),
    new THREE.Vector3(0.008, 0.005, 0.001),
  ]);
  const noseBridge = new THREE.Mesh(
    new THREE.TubeGeometry(bridgeCurve, 12, 0.002, 8, false),
    titaniumRimMat,
  );
  glassesRig.add(noseBridge);

  memoryHailMaryGroup.add(glassesRig);

  // Crystal water glass tumbler beside the eyeglasses (from the cinema interval memory)
  const glassTumbler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.026, 0.088, 20, 1, true),
    opticalLensMat,
  );
  glassTumbler.position.set(0.105, 0.045, -0.02);
  glassTumbler.castShadow = true;
  memoryHailMaryGroup.add(glassTumbler);

  const glassBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.008, 20),
    opticalLensMat,
  );
  glassBase.position.set(0.105, 0.004, -0.02);
  memoryHailMaryGroup.add(glassBase);

  const hailMaryHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.16, 0.32),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hailMaryHitbox.position.set(0.02, 0.06, 0);
  memoryHailMaryGroup.add(hailMaryHitbox);
  memoryHailMaryHitMeshes.push(hailMaryHitbox, clothMesh, glassTumbler);

  scene.add(memoryHailMaryGroup);

  // ==========================================
  // 9. MEMORY II CLUE: THE PINKY MOMENT (Keepsake & Bus Stop Card on the Chair)
  // ==========================================
  const memoryPinkyGroup = new THREE.Group();
  memoryPinkyGroup.position.set(1.32, 0.485, -0.35);
  memoryPinkyGroup.rotation.y = 0.42;

  const busCardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.004, 0.085),
    new THREE.MeshStandardMaterial({
      color: 0xf1e9db,
      roughness: 0.6,
    }),
  );
  busCardMesh.castShadow = true;
  memoryPinkyGroup.add(busCardMesh);

  const pinkyLoopMat = new THREE.MeshStandardMaterial({
    color: 0xf4a261,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.28,
    metalness: 0.85,
  });
  const pinkyLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.032, 0.0045, 12, 28),
    pinkyLoopMat,
  );
  pinkyLoop.rotation.x = Math.PI / 2;
  pinkyLoop.position.set(0.015, 0.006, 0.01);
  memoryPinkyGroup.add(pinkyLoop);

  const pinkyHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.28),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pinkyHitbox.position.set(0, 0.05, 0);
  memoryPinkyGroup.add(pinkyHitbox);
  memoryPinkyHitMeshes.push(pinkyHitbox, busCardMesh, pinkyLoop);

  // In-Engine 3D Romantic Hands-Holding Hologram & Rose-Gold Ember VFX above the chair keepsake
  const pinkyHandsVfxGroup = new THREE.Group();
  pinkyHandsVfxGroup.position.set(0, 0.18, 0);
  pinkyHandsVfxGroup.visible = false;

  const warmHandLeftMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbd38d,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.28,
    transmission: 0.45,
    transparent: true,
    opacity: 0.88,
  });
  const warmHandRightMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.48,
    roughness: 0.25,
    transmission: 0.45,
    transparent: true,
    opacity: 0.9,
  });

  function createSculpted3DHand(
    mat: THREE.Material,
    mirror: 1 | -1,
  ): THREE.Group {
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.018, 0.044),
      mat,
    );
    palm.position.set(-mirror * 0.022, 0, 0);
    hand.add(palm);

    // 4 sculpted fingers (index -> pinky, with the pinky curved forward to interlock)
    const fingerSpecs = [
      { z: -0.015, len: 0.034, pinky: false },
      { z: -0.005, len: 0.038, pinky: false },
      { z: 0.005, len: 0.035, pinky: false },
      { z: 0.015, len: 0.029, pinky: true },
    ];
    fingerSpecs.forEach(({ z, len, pinky }) => {
      const fMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0042, len, 6, 10),
        mat,
      );
      fMesh.rotation.z = -mirror * (pinky ? Math.PI / 2.2 : Math.PI / 2.6);
      fMesh.position.set(mirror * 0.012, pinky ? 0.002 : -0.003, z);
      hand.add(fMesh);
    });
    return hand;
  }

  const pinkyLeftHand = createSculpted3DHand(warmHandLeftMat, 1);
  pinkyLeftHand.position.set(-0.042, 0, 0);
  pinkyHandsVfxGroup.add(pinkyLeftHand);

  const pinkyRightHand = createSculpted3DHand(warmHandRightMat, -1);
  pinkyRightHand.position.set(0.042, 0, 0);
  pinkyHandsVfxGroup.add(pinkyRightHand);

  // 48 Rising Rose-Gold & Amber Particle Embers
  const emberCount = 48;
  const emberPositions = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    const angle = (i / emberCount) * Math.PI * 2;
    const radius = 0.02 + (i % 7) * 0.014;
    emberPositions[i * 3] = Math.cos(angle) * radius;
    emberPositions[i * 3 + 1] = (i / emberCount) * 0.22 - 0.04;
    emberPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(emberPositions, 3),
  );
  const emberMat = new THREE.PointsMaterial({
    color: 0xfbbf24,
    size: 0.014,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pinkyEmberPoints = new THREE.Points(emberGeo, emberMat);
  pinkyHandsVfxGroup.add(pinkyEmberPoints);

  const pinkyWarmLight = new THREE.PointLight(0xf59e0b, 0, 1.8, 1.8);
  pinkyWarmLight.position.set(0, 0.06, 0);
  pinkyHandsVfxGroup.add(pinkyWarmLight);

  memoryPinkyGroup.add(pinkyHandsVfxGroup);
  scene.add(memoryPinkyGroup);

  // ==========================================
  // 10. MEMORY III CLUE: THE CONFESSION (Late-Night Phone Keepsake on the Bed)
  // ==========================================
  const memoryConfessionGroup = new THREE.Group();
  memoryConfessionGroup.position.set(-1.92, 0.608, 0.32);
  memoryConfessionGroup.rotation.y = 0.48;

  const pocketPhoneChassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, 0.01, 0.162),
    new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.25,
      metalness: 0.75,
    }),
  );
  pocketPhoneChassis.castShadow = true;
  memoryConfessionGroup.add(pocketPhoneChassis);

  const confessionScreenMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.85,
    roughness: 0.15,
  });
  const pocketPhoneScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.072, 0.148),
    confessionScreenMat,
  );
  pocketPhoneScreen.rotation.x = -Math.PI / 2;
  pocketPhoneScreen.position.y = 0.0055;
  memoryConfessionGroup.add(pocketPhoneScreen);

  const confessionHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.28),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  confessionHitbox.position.set(0, 0.05, 0);
  memoryConfessionGroup.add(confessionHitbox);
  memoryConfessionHitMeshes.push(
    confessionHitbox,
    pocketPhoneChassis,
    pocketPhoneScreen,
  );

  scene.add(memoryConfessionGroup);

  return {
    doorGroup,
    doorHingePivot,
    doorHandlePivot,
    doorStatusMat,
    doorHitMeshes,

    phoneGroup,
    phoneHandset,
    phoneLedMat,
    phoneHitMeshes,

    photographGroup,
    photographHitMeshes,

    memoryHailMaryGroup,
    memoryHailMaryHitMeshes,

    memoryPinkyGroup,
    memoryPinkyHitMeshes,
    pinkyHandsVfxGroup,
    pinkyLeftHand,
    pinkyRightHand,
    pinkyEmberPoints,
    pinkyWarmLight,

    memoryConfessionGroup,
    memoryConfessionHitMeshes,
    confessionScreenMat,

    bedGroup,
    bedHitMeshes,

    deskGroup,
    deskHitMeshes,

    chairGroup,
    chairHitMeshes,

    figureGroup,
    corridorLight,

    overheadBulbMat,
    deskBulbMat,
  };
}
