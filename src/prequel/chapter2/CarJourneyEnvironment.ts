import * as THREE from 'three';
import { createMaskedKidnapperCharacter } from '../MaskedKidnapperCharacter';

export interface CarJourneyEnvironmentBundle {
  environmentGroup: THREE.Group;
  approachingFigureGroup: THREE.Group;
  updateEnvironment: (
    dt: number,
    elapsed: number,
    carWorldZ: number,
    triggerPassingCarFlash: boolean,
    approachingWalkProgress?: number,
  ) => { passingVehicleFlashIntensity: number; oncomingJustPassed: boolean };
  dispose: () => void;
}

/**
 * Generates an Asphalt Road Texture with crisp lane markings, wet puddles, and shoulder lines
 */
function createHighwayAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#101520';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt grain
    for (let i = 0; i < 1800; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      ctx.fillStyle = i % 2 === 0 ? '#182030' : '#0b0e17';
      ctx.fillRect(x, y, 2, 2);
    }

    // Left & Right White Edge Lines
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.fillRect(28, 0, 8, 512);
    ctx.fillRect(476, 0, 8, 512);

    // Center Dashed Yellow/White Divider Line
    ctx.fillStyle = 'rgba(251, 191, 36, 0.78)';
    ctx.fillRect(252, 24, 8, 180);
    ctx.fillRect(252, 280, 8, 180);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 38);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Chapter 2: The Unknown Journey — High-Detail 3-Stage Connected Night Environment (0m -> -625m)
 *
 * Includes:
 * - Dynamic Leapfrogging Streetlamp PointLights (6 real PointLights that move ahead of the car
 *   so the road, buildings, trees, and car exterior are always illuminated by real pools of light!)
 * - Stage A · Familiar Neighbourhood (0m to -180m): Multi-storey Indian villas, glowing windows,
 *   balcony railings, neon shop signboards, closed shutter shops, parked scooters, resting street dogs,
 *   and animated walking pedestrians.
 * - Stage B · Main Road (-180m to -410m): Divided 4-lane avenue, traffic signal gantries,
 *   illuminated commercial glass buildings, and animated oncoming/passing cars with real headlight cones.
 * - Stage C · Isolated Route & Concealed Destination (-410m to -625m): Dense tree-lined road leading
 *   into the pillared Concealed Destination Portico, plus the articulated Masked Kidnapper figure
 *   walking up to open the rear door in Scene 4.3 / 5.1.
 */
export function createCarJourneyEnvironment(): CarJourneyEnvironmentBundle {
  const environmentGroup = new THREE.Group();
  environmentGroup.name = 'Chapter2ConnectedRouteEnvironment';

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

  const roadTex = createHighwayAsphaltTexture();
  textures.push(roadTex);

  const asphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.32,
      metalness: 0.24,
    }),
  );
  const wetReflectionMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b101b,
      roughness: 0.08,
      metalness: 0.55,
      clearcoat: 1.0,
    }),
  );
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262e3d,
      roughness: 0.78,
    }),
  );
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2e3646,
      roughness: 0.82,
    }),
  );
  const shutterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b495e,
      roughness: 0.48,
      metalness: 0.68,
    }),
  );
  const buildingWarmStuccoMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x232a38,
      roughness: 0.76,
    }),
  );
  const commercialGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x132038,
      roughness: 0.16,
      metalness: 0.78,
      clearcoat: 0.9,
    }),
  );
  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.85,
    }),
  );
  const coolOfficeWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.45,
    }),
  );
  const neonSignEmeraldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      emissive: 0x10b981,
      emissiveIntensity: 2.4,
    }),
  );
  const neonSignRoseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.4,
    }),
  );
  const sodiumLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf59e0b,
      emissiveIntensity: 3.8,
    }),
  );
  const foliageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x162c22,
      roughness: 0.8,
    }),
  );
  const bougainvilleaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdb2777,
      emissive: 0x831843,
      emissiveIntensity: 0.35,
      roughness: 0.65,
    }),
  );
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x33241b,
      roughness: 0.88,
    }),
  );
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x252e3d,
      roughness: 0.42,
      metalness: 0.72,
    }),
  );
  const dogFurMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x785232,
      roughness: 0.78,
    }),
  );
  const destinationConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3f4756,
      roughness: 0.72,
    }),
  );

  // ============================================================================
  // 1. CONTINUOUS ROADBED, LANE MARKINGS & WET SPECULAR STRIPS (z = +20m to -635m)
  // ============================================================================
  const roadLength = 660;
  const roadCenterZ = -305;
  const roadPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(14.5, roadLength, 16, 180)),
    asphaltMat,
  );
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, 0, roadCenterZ);
  roadPlane.receiveShadow = true;
  environmentGroup.add(roadPlane);

  for (const wx of [-2.4, 2.4]) {
    const wetStrip = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(1.35, roadLength, 4, 90)),
      wetReflectionMat,
    );
    wetStrip.rotation.x = -Math.PI / 2;
    wetStrip.position.set(wx, 0.005, roadCenterZ);
    environmentGroup.add(wetStrip);
  }

  const sidewalkGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.18, roadLength));
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sw.position.set(side * 7.2, 0.09, roadCenterZ);
    sw.receiveShadow = true;
    environmentGroup.add(sw);
  }

  // ============================================================================
  // 2. POOL OF 6 DYNAMIC LEAPFROGGING STREETLAMP POINTLIGHTS
  //    Keeps the road, buildings, and trees around the car richly lit at all times!
  // ============================================================================
  const activeRoadLights: THREE.PointLight[] = [];
  for (let i = 0; i < 6; i++) {
    const pl = new THREE.PointLight(0xf59e0b, 4.2, 26, 1.35);
    pl.position.set(i % 2 === 0 ? -4.2 : 4.2, 5.5, -i * 22);
    environmentGroup.add(pl);
    activeRoadLights.push(pl);
  }

  // Shared Geometries
  const treeCrownGeo = trackGeo(new THREE.IcosahedronGeometry(1.75, 3));
  const flowerClusterGeo = trackGeo(new THREE.DodecahedronGeometry(0.65, 2));
  const treeTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 2.9, 16));
  const poleShaftGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 16));
  const poleArmGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 12));
  const lampHeadGeo = trackGeo(new THREE.CapsuleGeometry(0.12, 0.32, 12, 18));
  const lampHaloMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const lampHaloGeo = trackGeo(new THREE.SphereGeometry(0.85, 16, 16));
  const groundPoolMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const groundPoolGeo = trackGeo(new THREE.CircleGeometry(4.2, 24));

  const addStreetlamp = (x: number, z: number, side: number) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, 0, z);
    environmentGroup.add(pGroup);

    const shaft = new THREE.Mesh(poleShaftGeo, poleMat);
    shaft.position.y = 2.9;
    pGroup.add(shaft);

    const arm = new THREE.Mesh(poleArmGeo, poleMat);
    arm.rotation.z = side * (Math.PI / 2 - 0.25);
    arm.position.set(-side * 0.65, 5.65, 0);
    pGroup.add(arm);

    const head = new THREE.Mesh(lampHeadGeo, sodiumLampMat);
    head.rotation.z = Math.PI / 2;
    head.position.set(-side * 1.25, 5.8, 0);
    pGroup.add(head);

    const halo = new THREE.Mesh(lampHaloGeo, lampHaloMat);
    halo.position.set(-side * 1.25, 5.72, 0);
    pGroup.add(halo);

    // Warm light pool on the asphalt below each streetlamp
    const pool = new THREE.Mesh(groundPoolGeo, groundPoolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-side * 1.6, 0.012, 0);
    pGroup.add(pool);
  };

  // ============================================================================
  // 3. STAGE A · FAMILIAR NEIGHBOURHOOD (z = +10m to -180m)
  // ============================================================================
  const houseBoxGeo = trackGeo(new THREE.BoxGeometry(7.6, 7.4, 9.2));
  const balconySlabGeo = trackGeo(new THREE.BoxGeometry(1.2, 0.18, 4.4));
  const shopShutterGeo = trackGeo(new THREE.BoxGeometry(0.14, 2.4, 3.6));
  const neonSignGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.55, 3.2));
  const wallSegGeo = trackGeo(new THREE.BoxGeometry(0.32, 1.85, 11.8));
  const winPaneGeo = trackGeo(new THREE.PlaneGeometry(1.25, 1.35));
  const scooterBodyGeo = trackGeo(new THREE.CapsuleGeometry(0.18, 0.65, 12, 16));

  for (let z = 8; z >= -176; z -= 20) {
    for (const side of [-1, 1]) {
      addStreetlamp(side * 5.6, z, side);

      const wall = new THREE.Mesh(wallSegGeo, wallMat);
      wall.position.set(side * 8.6, 0.92, z);
      environmentGroup.add(wall);

      const house = new THREE.Mesh(houseBoxGeo, buildingWarmStuccoMat);
      house.position.set(side * 13.0, 3.7, z);
      environmentGroup.add(house);

      // Second-floor overhanging balcony slab
      const balcony = new THREE.Mesh(balconySlabGeo, wallMat);
      balcony.position.set(side * 8.9, 3.8, z);
      environmentGroup.add(balcony);

      // Ground-floor closed metal rolling-shutter shop + glowing neon signboard
      if (Math.abs(z) % 40 === 8) {
        const shutter = new THREE.Mesh(shopShutterGeo, shutterMat);
        shutter.position.set(side * 9.15, 1.25, z + 1.8);
        environmentGroup.add(shutter);

        const sign = new THREE.Mesh(
          neonSignGeo,
          side < 0 ? neonSignEmeraldMat : neonSignRoseMat,
        );
        sign.position.set(side * 9.12, 2.85, z + 1.8);
        environmentGroup.add(sign);
      }

      // Multiple warm glowing upstairs residential windows
      for (const wzOff of [-2.2, 1.8]) {
        const win = new THREE.Mesh(winPaneGeo, warmWindowMat);
        win.position.set(side * 9.16, 5.1, z + wzOff);
        win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        environmentGroup.add(win);
      }

      // Roadside trees + flowering magenta bougainvillea over the compound wall
      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.set(side * 6.2, 1.45, z - 9);
      environmentGroup.add(trunk);

      const crown = new THREE.Mesh(treeCrownGeo, foliageMat);
      crown.position.set(side * 5.7, 3.8, z - 9);
      environmentGroup.add(crown);

      const flowers = new THREE.Mesh(flowerClusterGeo, bougainvilleaMat);
      flowers.position.set(side * 8.3, 2.05, z - 3);
      environmentGroup.add(flowers);

      // Parked scooters along the curb
      if (Math.abs(z) % 40 === 28) {
        const scooter = new THREE.Mesh(scooterBodyGeo, shutterMat);
        scooter.rotation.x = Math.PI / 2;
        scooter.position.set(side * 6.4, 0.52, z + 3);
        environmentGroup.add(scooter);
      }
    }

    // Resting street dogs near residential gates (at z = -32 and z = -112)
    if (z === -32 || z === -112) {
      const dogGroup = new THREE.Group();
      dogGroup.position.set(-7.5, 0.18, z - 3);
      environmentGroup.add(dogGroup);

      const dogBody = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.15, 0.38, 12, 16)),
        dogFurMat,
      );
      dogBody.rotation.z = Math.PI / 2;
      dogBody.position.y = 0.15;
      dogGroup.add(dogBody);

      const dogHead = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.115, 14, 14)),
        dogFurMat,
      );
      dogHead.position.set(0.24, 0.24, 0.06);
      dogGroup.add(dogHead);
    }
  }

  // Animated Sidewalk Pedestrians in Stage A
  const walkingPedestrians: { group: THREE.Group; baseZ: number; dir: number }[] = [];
  for (const [idx, pz] of [-48, -96, -148].entries()) {
    const pedGroup = new THREE.Group();
    const side = idx % 2 === 0 ? -1 : 1;
    pedGroup.position.set(side * 6.8, 0.18, pz);
    environmentGroup.add(pedGroup);

    const torso = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.19, 0.65, 12, 18)),
      poleMat,
    );
    torso.position.y = 1.05;
    pedGroup.add(torso);

    const head = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.125, 16, 16)),
      dogFurMat,
    );
    head.position.y = 1.56;
    pedGroup.add(head);

    walkingPedestrians.push({ group: pedGroup, baseZ: pz, dir: side });
  }

  // ============================================================================
  // 4. STAGE B · MAIN ROAD (z = -180m to -410m)
  // ============================================================================
  const medianGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.26, 228));
  const medianMesh = new THREE.Mesh(medianGeo, wallMat);
  medianMesh.position.set(0, 0.13, -295);
  environmentGroup.add(medianMesh);

  const commBuildingGeo = trackGeo(new THREE.BoxGeometry(10.0, 14.5, 14.5));
  const officeStripGeo = trackGeo(new THREE.PlaneGeometry(0.12, 8.2, 1, 1));
  const signalRedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const signalAmberMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  const signalGreenMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const signalDotGeo = trackGeo(new THREE.SphereGeometry(0.12, 14, 14));

  for (let z = -190; z >= -405; z -= 26) {
    for (const side of [-1, 1]) {
      addStreetlamp(side * 5.8, z, side);

      const commBldg = new THREE.Mesh(commBuildingGeo, commercialGlassMat);
      commBldg.position.set(side * 14.2, 7.25, z);
      environmentGroup.add(commBldg);

      // Glowing vertical office window ribbons on commercial towers
      for (const wzOff of [-4.2, 0, 4.2]) {
        const strip = new THREE.Mesh(
          officeStripGeo,
          wzOff === 0 ? warmWindowMat : coolOfficeWindowMat,
        );
        strip.position.set(side * 9.15, 7.5, z + wzOff);
        strip.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        environmentGroup.add(strip);
      }

      // Traffic signal gantries at major intersections
      if ((z === -216 || z === -294 || z === -372) && side === -1) {
        const sigPole = new THREE.Mesh(poleShaftGeo, poleMat);
        sigPole.position.set(-5.6, 2.9, z + 6);
        environmentGroup.add(sigPole);

        const sigBox = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.36, 0.92, 0.26)),
          poleMat,
        );
        sigBox.position.set(-4.8, 5.25, z + 6);
        environmentGroup.add(sigBox);

        const rDot = new THREE.Mesh(signalDotGeo, signalRedMat);
        rDot.position.set(-4.8, 5.52, z + 6.14);
        environmentGroup.add(rDot);

        const aDot = new THREE.Mesh(signalDotGeo, signalAmberMat);
        aDot.position.set(-4.8, 5.25, z + 6.14);
        environmentGroup.add(aDot);

        const gDot = new THREE.Mesh(signalDotGeo, signalGreenMat);
        gDot.position.set(-4.8, 4.98, z + 6.14);
        environmentGroup.add(gDot);
      }
    }
  }

  // Oncoming & Passing Traffic Vehicles on the Main Road
  const trafficCars: { mesh: THREE.Group; speed: number; baseZ: number }[] = [];
  const oncomingHlMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
  );
  const tCarBodyGeo = trackGeo(new THREE.BoxGeometry(1.82, 1.18, 4.2));
  const beamConeGeo = trackGeo(new THREE.ConeGeometry(1.6, 9.5, 16, 1, true));
  const beamConeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );

  for (let i = 0; i < 5; i++) {
    const tCar = new THREE.Group();
    const startZ = -205 - i * 48;
    tCar.position.set(-2.5, 0.62, startZ);
    environmentGroup.add(tCar);

    const body = new THREE.Mesh(tCarBodyGeo, poleMat);
    tCar.add(body);

    for (const sx of [-0.64, 0.64]) {
      const hl = new THREE.Mesh(signalDotGeo, oncomingHlMat);
      hl.position.set(sx, -0.08, 2.12);
      tCar.add(hl);
    }

    const cone = new THREE.Mesh(beamConeGeo, beamConeMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, -0.1, 6.8);
    tCar.add(cone);

    trafficCars.push({
      mesh: tCar,
      speed: 14.5 + i * 1.6,
      baseZ: startZ,
    });
  }

  // ============================================================================
  // 5. STAGE C · ISOLATED ROUTE (-410m to -565m) & CONCEALED DESTINATION (-607.5m)
  // ============================================================================
  for (let z = -418; z >= -575; z -= 24) {
    for (const side of [-1, 1]) {
      if (Math.abs(z) % 48 === 10) {
        addStreetlamp(side * 5.6, z, side);
      }

      const isoWall = new THREE.Mesh(wallSegGeo, wallMat);
      isoWall.scale.set(1, 1.15, 2.1);
      isoWall.position.set(side * 8.2, 1.0, z);
      environmentGroup.add(isoWall);

      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.set(side * 6.4, 1.45, z);
      environmentGroup.add(trunk);

      const crown = new THREE.Mesh(treeCrownGeo, foliageMat);
      crown.scale.set(1.38, 1.18, 1.38);
      crown.position.set(side * 5.6, 3.95, z);
      environmentGroup.add(crown);
    }
  }

  // Concealed Destination Entrance Portico at z = -607.5m
  const destinationGroup = new THREE.Group();
  destinationGroup.position.set(2.4, 0, -607.5);
  destinationGroup.rotation.y = -0.18;
  environmentGroup.add(destinationGroup);

  const porticoSteps = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(8.8, 0.36, 4.8)),
    destinationConcreteMat,
  );
  porticoSteps.position.set(0, 0.18, 0);
  porticoSteps.receiveShadow = true;
  destinationGroup.add(porticoSteps);

  const porticoPillarGeo = trackGeo(new THREE.BoxGeometry(0.68, 4.2, 0.68));
  for (const px of [-3.5, -1.25, 1.25, 3.5]) {
    const pMesh = new THREE.Mesh(porticoPillarGeo, destinationConcreteMat);
    pMesh.position.set(px, 2.28, 1.7);
    pMesh.castShadow = true;
    destinationGroup.add(pMesh);
  }

  const porticoRoof = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(9.6, 0.54, 5.4)),
    destinationConcreteMat,
  );
  porticoRoof.position.set(0, 4.5, 0);
  destinationGroup.add(porticoRoof);

  const mainFacade = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(12.0, 7.0, 3.2)),
    buildingWarmStuccoMat,
  );
  mainFacade.position.set(0, 3.5, -2.6);
  destinationGroup.add(mainFacade);

  const entranceFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.6, 2.85, 0.18)),
    warmWindowMat,
  );
  entranceFrame.position.set(0, 1.65, -0.95);
  destinationGroup.add(entranceFrame);

  const porticoPointLight = new THREE.PointLight(0xfde68a, 5.5, 22, 1.25);
  porticoPointLight.position.set(0, 3.9, 0.8);
  destinationGroup.add(porticoPointLight);

  // Articulated Masked Figure for Scene 4.3 / 5.1 (walks toward the open rear car door!)
  const approachingKidnapper = createMaskedKidnapperCharacter();
  const approachingFigureGroup = approachingKidnapper.group;
  approachingFigureGroup.position.set(3.2, 0, -598);
  approachingFigureGroup.visible = false;
  environmentGroup.add(approachingFigureGroup);

  let passingFlashTimer = 0;

  return {
    environmentGroup,
    approachingFigureGroup,
    updateEnvironment(
      dt,
      elapsed,
      carWorldZ,
      triggerPassingCarFlash,
      approachingWalkProgress = 0,
    ) {
      // 1. Leapfrog the 6 dynamic streetlamp PointLights around `carWorldZ`
      const baseGridZ = Math.floor(carWorldZ / 20) * 20;
      for (let i = 0; i < activeRoadLights.length; i++) {
        const lampZ = baseGridZ + 20 - i * 20;
        const side = i % 2 === 0 ? -1 : 1;
        activeRoadLights[i].position.set(side * 4.2, 5.4, lampZ);
      }

      // 2. Animate Stage A walking pedestrians
      for (const ped of walkingPedestrians) {
        ped.group.position.z =
          ped.baseZ + Math.sin(elapsed * 0.65 + ped.dir) * 4.5;
      }

      // 3. Animate approaching Masked Figure in Scene 4.3 / 5.1
      if (approachingFigureGroup.visible) {
        approachingKidnapper.setAnimationState('STALK_WALK');
        approachingKidnapper.update(dt, elapsed, approachingWalkProgress);
      }

      // 4. Oncoming traffic & Scene 3.2 headlight flash
      let passingVehicleFlashIntensity = 0;
      let oncomingJustPassed = false;

      if (triggerPassingCarFlash) {
        passingFlashTimer += dt;
        const flashWindow = Math.sin(
          THREE.MathUtils.clamp((passingFlashTimer - 0.8) / 2.4, 0, 1) * Math.PI,
        );
        passingVehicleFlashIntensity = Math.pow(flashWindow, 1.4);
        if (passingFlashTimer >= 1.0 && passingFlashTimer - dt < 1.0) {
          oncomingJustPassed = true;
        }
      } else {
        passingFlashTimer = 0;
      }

      for (const tc of trafficCars) {
        tc.mesh.position.z += tc.speed * dt;
        if (tc.mesh.position.z > carWorldZ + 35) {
          tc.mesh.position.z = carWorldZ - 140;
        }
      }

      return { passingVehicleFlashIntensity, oncomingJustPassed };
    },
    dispose() {
      approachingKidnapper.dispose();
      for (const t of textures) t.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
