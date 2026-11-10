import * as THREE from 'three';
import { RoomTextureSet } from './cell04Textures';

/**
 * Builds the procedural 3D architectural shell and composite 3-12 part furniture groups for Cell 04:
 * - Room shell (floor, ceiling, 4 walls, baseboards, overhead pendant lamp fixture)
 * - Bed (iron frame, 4 corner legs, slatted headboard, mattress, blanket, angled pillow)
 * - Desk (timber tabletop, 4 legs, drawer cabinet, drawer fronts & brass pulls, architect desk lamp)
 * - Chair (4 legs, wooden seat, 2 back posts, 2 curved backrest slats)
 * - Door (heavy steel frame, riveted door slab, barred observation slit, deadbolt lock box, status LED, lever handle)
 * - Rotary Phone on Desk (sloped bakelite base, rotary wheel, cradle prongs, sculpted handset, coiled cord, status LED)
 */
export interface RoomPropsResult {
  doorGroup: THREE.Group;
  doorHandlePivot: THREE.Group;
  doorStatusMat: THREE.MeshStandardMaterial;
  phoneGroup: THREE.Group;
  phoneHandset: THREE.Group;
  phoneLedMat: THREE.MeshStandardMaterial;
  overheadBulbMat: THREE.MeshStandardMaterial;
  deskBulbMat: THREE.MeshStandardMaterial;
  interactables: THREE.Object3D[];
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
  const interactables: THREE.Object3D[] = [];

  // Shared PBR Materials with varied roughness & metalness (>= 0.25 contrast between adjacent parts)
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

  const wallDefs = [
    { pos: [0, roomHeight / 2, -roomSize / 2], rotY: 0 }, // North wall (Door)
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

    // Baseboard trim
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(roomSize, 0.14, 0.04),
      baseboardMat,
    );
    baseMesh.position.set(pos[0], 0.07, pos[2]);
    baseMesh.rotation.y = rotY;
    baseMesh.receiveShadow = true;
    roomGroup.add(baseMesh);
  });

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

  // Contact shadow
  bedGroup.add(createContactShadow(1.55, 2.35, textures.shadowDecal));

  // 4 iron corner legs
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

  // Iron side frame rails
  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.08, 2.04),
    darkIronMat,
  );
  frameBase.position.set(0, 0.34, 0);
  frameBase.castShadow = true;
  frameBase.receiveShadow = true;
  bedGroup.add(frameBase);

  // Headboard (at z = +1.0) with vertical iron bars
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

  // Mattress
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.22, 1.92),
    mattressMat,
  );
  mattress.position.set(0, 0.49, -0.01);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  bedGroup.add(mattress);

  // Disheveled blanket covering lower 2/3 of bed
  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(1.23, 0.23, 1.25),
    blanketMat,
  );
  blanket.position.set(0, 0.5, -0.34);
  blanket.castShadow = true;
  blanket.receiveShadow = true;
  bedGroup.add(blanket);

  // Angled pillow near headboard
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

  scene.add(bedGroup);

  // ==========================================
  // 3. DESK (Composite 9-Part Group, East Wall)
  // ==========================================
  const deskGroup = new THREE.Group();
  deskGroup.position.set(2.15, 0, -0.2);

  // Contact shadow
  deskGroup.add(createContactShadow(1.15, 1.85, textures.shadowDecal));

  // Tabletop (0.85m deep along X, 1.6m wide along Z, at height 0.78m)
  const tabletop = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.06, 1.62),
    woodMat,
  );
  tabletop.position.set(0, 0.78, 0);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  deskGroup.add(tabletop);

  // 4 Desk legs
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

  // Side drawer cabinet under the right side of the desk
  const drawerCabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.46, 0.48),
    woodDarkMat,
  );
  drawerCabinet.position.set(0, 0.52, 0.48);
  drawerCabinet.castShadow = true;
  drawerCabinet.receiveShadow = true;
  deskGroup.add(drawerCabinet);

  // Two drawer fronts + brass pulls facing the room (-X)
  [0.62, 0.41].forEach((dy) => {
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.17, 0.42),
      woodMat,
    );
    front.position.set(-0.39, dy, 0.48);
    deskGroup.add(front);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.025, 0.1),
      brassMat,
    );
    handle.position.set(-0.41, dy, 0.48);
    deskGroup.add(handle);
  });

  // Architect Desk Lamp on the north corner of the desk
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
  chairGroup.rotation.y = 0.28; // Slightly angled toward the bed/player

  chairGroup.add(createContactShadow(0.62, 0.62, textures.shadowDecal));

  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.045, 0.48),
    woodMat,
  );
  seatMesh.position.set(0, 0.46, 0);
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chairGroup.add(seatMesh);

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

  // Backrest posts (on -X side so chair faces +X toward desk)
  [-0.2, 0.2].forEach((bz) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.48, 0.04),
      woodDarkMat,
    );
    post.position.set(-0.21, 0.72, bz);
    post.rotation.z = 0.06;
    post.castShadow = true;
    chairGroup.add(post);
  });

  // Horizontal backrest slats
  [0.65, 0.85].forEach((by) => {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.09, 0.44),
      woodMat,
    );
    slat.position.set(-0.22, by, 0);
    slat.castShadow = true;
    chairGroup.add(slat);
  });

  scene.add(chairGroup);

  // ==========================================
  // 5. LOCKED STEEL DOOR (Composite 8-Part Group, North Wall)
  // ==========================================
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, -2.96);
  doorGroup.userData = { interactType: 'door', label: 'Locked Steel Door' };

  // Heavy steel outer frame
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

  // Door slab
  const doorSlabMat = new THREE.MeshStandardMaterial({
    map: textures.doorSteel,
    roughness: 0.48,
    metalness: 0.78,
  });
  const doorSlab = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 2.12, 0.07),
    doorSlabMat,
  );
  doorSlab.position.set(0, 1.06, 0);
  doorSlab.castShadow = true;
  doorSlab.receiveShadow = true;
  doorSlab.userData = { interactType: 'door' };
  doorGroup.add(doorSlab);
  interactables.push(doorSlab);

  // Barred observation slit at eye level
  const viewportFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.09),
    darkIronMat,
  );
  viewportFrame.position.set(0, 1.62, 0.01);
  doorGroup.add(viewportFrame);

  const viewportBacking = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x050608 }),
  );
  viewportBacking.position.set(0, 1.62, 0.056);
  doorGroup.add(viewportBacking);

  for (let vx = -0.1; vx <= 0.11; vx += 0.065) {
    const vBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8),
      brushedSteelMat,
    );
    vBar.position.set(vx, 1.62, 0.06);
    doorGroup.add(vBar);
  }

  // Electronic / heavy deadbolt lock housing + red locked LED
  const lockBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.24, 0.06),
    darkIronMat,
  );
  lockBox.position.set(0.38, 1.05, 0.05);
  lockBox.userData = { interactType: 'door' };
  doorGroup.add(lockBox);
  interactables.push(lockBox);

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
  lockLed.position.set(0.38, 1.12, 0.082);
  doorGroup.add(lockLed);

  // Lever handle pivot (animates when rattled)
  const doorHandlePivot = new THREE.Group();
  doorHandlePivot.position.set(0.38, 1.0, 0.08);
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
  handleGrip.userData = { interactType: 'door' };
  doorHandlePivot.add(handleGrip);
  interactables.push(handleGrip);

  doorGroup.add(doorHandlePivot);
  scene.add(doorGroup);

  // ==========================================
  // 6. ROTARY PHONE ON THE DESK (Composite 8-Part Group)
  // ==========================================
  const phoneGroup = new THREE.Group();
  // Positioned right on top of the desk (y = 0.81m), facing the center of the room
  phoneGroup.position.set(2.04, 0.81, -0.05);
  phoneGroup.rotation.y = -Math.PI / 2 - 0.15;
  phoneGroup.userData = { interactType: 'phone', label: 'Telephone' };

  const bakeliteMat = new THREE.MeshPhysicalMaterial({
    color: 0x141619,
    roughness: 0.22,
    metalness: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
  });

  // Invisible slightly larger hitbox so raycasting/clicking the phone is effortless
  const phoneHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.32, 0.42),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  phoneHitbox.position.set(0, 0.14, 0);
  phoneHitbox.userData = { interactType: 'phone' };
  phoneGroup.add(phoneHitbox);
  interactables.push(phoneHitbox);

  // 1. Base chassis
  const phoneBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.065, 0.22),
    bakeliteMat,
  );
  phoneBase.position.set(0, 0.0325, 0);
  phoneBase.castShadow = true;
  phoneBase.receiveShadow = true;
  phoneBase.userData = { interactType: 'phone' };
  phoneGroup.add(phoneBase);
  interactables.push(phoneBase);

  // 2. Sloped upper console
  const phoneConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.075, 0.16),
    bakeliteMat,
  );
  phoneConsole.position.set(0, 0.08, -0.01);
  phoneConsole.rotation.x = 0.32;
  phoneConsole.castShadow = true;
  phoneConsole.userData = { interactType: 'phone' };
  phoneGroup.add(phoneConsole);
  interactables.push(phoneConsole);

  // 3. Rotary dial wheel on sloped face
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
  dialWheel.userData = { interactType: 'phone' };
  phoneGroup.add(dialWheel);

  // 4. Cradle prongs (left & right)
  [-0.065, 0.065].forEach((cx) => {
    const prong = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.045, 10),
      brushedSteelMat,
    );
    prong.position.set(cx, 0.13, -0.045);
    phoneGroup.add(prong);
  });

  // 5. Blinking red incoming-call LED on phone front corner
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

  // 6. Sculpted Handset (Group that vibrates when ringing and lifts when answered)
  const phoneHandset = new THREE.Group();
  phoneHandset.position.set(0, 0.155, -0.045);

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12),
    bakeliteMat,
  );
  handleBar.rotation.z = Math.PI / 2;
  handleBar.castShadow = true;
  handleBar.userData = { interactType: 'phone' };
  phoneHandset.add(handleBar);

  [-0.105, 0.105].forEach((earX) => {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.026, 0.045, 16),
      bakeliteMat,
    );
    cup.position.set(earX, -0.012, 0);
    cup.castShadow = true;
    cup.userData = { interactType: 'phone' };
    phoneHandset.add(cup);
  });
  phoneGroup.add(phoneHandset);

  // 7. Coiled telephone cord (TubeGeometry)
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

  return {
    doorGroup,
    doorHandlePivot,
    doorStatusMat,
    phoneGroup,
    phoneHandset,
    phoneLedMat,
    overheadBulbMat,
    deskBulbMat,
    interactables,
  };
}
