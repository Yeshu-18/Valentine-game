import * as THREE from 'three';

export interface ResidentialStreetBundle {
  group: THREE.Group;
  carGroup: THREE.Group;
  carWheelMeshes: THREE.Mesh[];
  carHeadlightSpotL: THREE.SpotLight;
  carHeadlightSpotR: THREE.SpotLight;
  carBrakeLightPoint: THREE.PointLight;
  setCarTransform: (
    z: number,
    xOffset: number,
    headlightIntensity: number,
    brakingIntensity: number,
    wheelSpinDelta: number,
  ) => void;
  dispose: () => void;
}

/**
 * Builds the Familiar Indian Residential Street at Night (13 February 2027 · 10:30 PM)
 * - Residential villas & 2-3 storey apartment buildings with compound walls, iron gates, and warm lit windows
 * - Warm sodium streetlights with pools of light on slightly reflective asphalt
 * - Parked vehicles & roadside trees
 * - The approaching dark sedan with directional headlights and red brake/tail lights
 */
export function createResidentialStreetScene(): ResidentialStreetBundle {
  const group = new THREE.Group();
  group.name = 'ResidentialStreetScene';

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

  // 1. Procedural Wet/Night Asphalt Texture for Subtle Streetlight Reflections
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d');
  if (rCtx) {
    rCtx.fillStyle = '#14171f';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = 16 + Math.floor(Math.random() * 20);
      rCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 6})`;
      rCtx.fillRect(x, y, 2, 2);
    }
    // Subtle center dashed road line
    rCtx.fillStyle = 'rgba(203, 213, 225, 0.22)';
    rCtx.fillRect(252, 40, 8, 180);
    rCtx.fillRect(252, 300, 8, 180);
  }
  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 18);
  textures.push(roadTex);

  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.34, // Subtle nighttime road reflection under sodium lamps & brake lights
      metalness: 0.18,
    }),
  );

  const roadMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(9.2, 165)),
    roadMat,
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(0, 0, -62);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2. Pedestrian Footpaths / Curbs & Compound Walls on Both Sides
  const footpathMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262934,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  const compoundWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b3842,
      roughness: 0.85,
    }),
  );
  const gateIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.4,
      metalness: 0.75,
    }),
  );

  for (const side of [-1, 1]) {
    const footpath = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.2, 0.16, 165)),
      footpathMat,
    );
    footpath.position.set(side * 6.2, 0.08, -62);
    footpath.receiveShadow = true;
    group.add(footpath);

    // Outer ground beyond compound walls
    const outerGround = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(40, 165)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0d1017, roughness: 0.95 })),
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.set(side * 27.5, 0.02, -62);
    group.add(outerGround);
  }

  // 3. Familiar Indian Residential Villas & Apartment Blocks (2-3 Storeys)
  const buildingWallMats = [
    trackMat(new THREE.MeshStandardMaterial({ color: 0x35323c, roughness: 0.82 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x2d333f, roughness: 0.82 })),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x3d3535, roughness: 0.82 })),
  ];
  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    }),
  );
  const dimWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.5,
    }),
  );
  const balconyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.7,
    }),
  );

  const lotZPositions = [-4, -20, -36, -52, -68, -84, -100, -116];
  lotZPositions.forEach((lotZ, idx) => {
    for (const side of [-1, 1]) {
      const lotGroup = new THREE.Group();
      lotGroup.position.set(side * 12.2, 0, lotZ);
      group.add(lotGroup);

      const height = 7.2 + ((idx + (side > 0 ? 1 : 0)) % 3) * 2.6;
      const width = 9.5;
      const depth = 11.2;

      const bldgMat = buildingWallMats[(idx + (side > 0 ? 1 : 0)) % buildingWallMats.length];
      const mainBlock = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width, height, depth)),
        bldgMat,
      );
      mainBlock.position.set(0, height * 0.5, 0);
      mainBlock.castShadow = true;
      mainBlock.receiveShadow = true;
      lotGroup.add(mainBlock);

      // Balconies & Windows facing the street
      const floors = Math.floor(height / 3.0);
      const faceX = -side * (width * 0.5 + 0.04);

      for (let f = 0; f < floors; f++) {
        const wy = 2.0 + f * 2.8;
        // Balcony slab on upper floors
        if (f > 0) {
          const balcony = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.9, 0.85, 3.6)),
            balconyMat,
          );
          balcony.position.set(-side * (width * 0.5 + 0.4), wy - 0.55, -1.4);
          lotGroup.add(balcony);
        }

        // Two window bays per floor (only a few warmly lit at 10:30 PM)
        for (const wz of [-2.2, 2.2]) {
          const isWarmLit =
            (idx * 3 + f * 2 + (wz > 0 ? 1 : 0) + (side > 0 ? 2 : 0)) % 5 === 0;
          const winMesh = new THREE.Mesh(
            trackGeo(new THREE.PlaneGeometry(1.35, 1.15)),
            isWarmLit ? warmWindowMat : dimWindowMat,
          );
          winMesh.position.set(faceX, wy, wz);
          winMesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          lotGroup.add(winMesh);
        }
      }

      // Compound wall & residential gate along footpath edge
      const wallX = -side * 4.55;
      const wallSegment = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.28, 1.55, 8.8)),
        compoundWallMat,
      );
      wallSegment.position.set(wallX, 0.775, -1.8);
      lotGroup.add(wallSegment);

      const gateMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 1.45, 3.2)),
        gateIronMat,
      );
      gateMesh.position.set(wallX, 0.725, 4.2);
      lotGroup.add(gateMesh);
    }
  });

  // 4. Warm Sodium Streetlights with Light Pools on the Road
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.7,
    }),
  );
  const bulbEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xffa94d,
      emissiveIntensity: 2.6,
    }),
  );
  const poolTexCanvas = document.createElement('canvas');
  poolTexCanvas.width = 128;
  poolTexCanvas.height = 128;
  const pCtx = poolTexCanvas.getContext('2d');
  if (pCtx) {
    const grad = pCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 180, 90, 0.34)');
    grad.addColorStop(0.5, 'rgba(255, 160, 70, 0.12)');
    grad.addColorStop(1, 'rgba(255, 150, 60, 0.0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 128, 128);
  }
  const poolTex = new THREE.CanvasTexture(poolTexCanvas);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  textures.push(poolTex);

  const poolMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const streetlightZList = [2, -16, -34, -52, -70, -88, -106];
  streetlightZList.forEach((lz, idx) => {
    const side = idx % 2 === 0 ? -1 : 1;
    const lampGroup = new THREE.Group();
    lampGroup.position.set(side * 4.75, 0, lz);
    group.add(lampGroup);

    const pole = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.065, 0.09, 5.6, 10)),
      poleMat,
    );
    pole.position.y = 2.8;
    pole.castShadow = true;
    lampGroup.add(pole);

    const arm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8)),
      poleMat,
    );
    arm.position.set(-side * 0.68, 5.45, 0);
    arm.rotation.z = side * (Math.PI / 2 - 0.22);
    lampGroup.add(arm);

    const fixture = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.46, 0.12, 0.24)),
      bulbEmissiveMat,
    );
    fixture.position.set(-side * 1.38, 5.55, 0);
    lampGroup.add(fixture);

    // PointLight on the 5 key streetlights near Harsha's path for authentic warm pools
    if (idx <= 4) {
      const pointLight = new THREE.PointLight(0xffb057, 2.6, 22, 1.45);
      pointLight.position.set(-side * 1.38, 5.3, 0);
      lampGroup.add(pointLight);
    }

    // Soft light pool decal on the asphalt
    const poolMesh = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(8.5, 8.5)),
      poolMat,
    );
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(-side * 1.5, 0.018, 0);
    lampGroup.add(poolMesh);
  });

  // 5. Roadside Trees & Parked Residential Vehicles
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2c1e18, roughness: 0.9 }),
  );
  const canopyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x16261e, roughness: 0.85 }),
  );

  const treeCoords = [
    { x: -5.4, z: -9 },
    { x: 5.4, z: -26 },
    { x: -5.4, z: -43 },
    { x: 5.4, z: -61 },
    { x: -5.4, z: -79 },
  ];
  for (const tc of treeCoords) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(tc.x, 0, tc.z);
    group.add(treeGroup);

    const trunk = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 10)),
      trunkMat,
    );
    trunk.position.y = 1.3;
    treeGroup.add(trunk);

    const canopy1 = new THREE.Mesh(
      trackGeo(new THREE.DodecahedronGeometry(1.65, 1)),
      canopyMat,
    );
    canopy1.position.set(0, 3.3, 0);
    treeGroup.add(canopy1);

    const canopy2 = new THREE.Mesh(
      trackGeo(new THREE.DodecahedronGeometry(1.25, 1)),
      canopyMat,
    );
    canopy2.position.set(0.55, 3.8, 0.35);
    treeGroup.add(canopy2);
  }

  // Parked Residential Car along the Left Curb (at z = -13.5)
  const parkedCarGroup = new THREE.Group();
  parkedCarGroup.position.set(-3.35, 0, -13.5);
  group.add(parkedCarGroup);

  const parkedBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.65,
    }),
  );
  const parkedChassis = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.75, 0.62, 3.9)),
    parkedBodyMat,
  );
  parkedChassis.position.y = 0.52;
  parkedCarGroup.add(parkedChassis);

  const parkedCabin = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.52, 0.52, 2.05)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.8 })),
  );
  parkedCabin.position.set(0, 1.04, -0.15);
  parkedCarGroup.add(parkedCabin);

  // 6. The Approaching Dark Sedan (Beat 03, 04, 05)
  const carGroup = new THREE.Group();
  carGroup.name = 'ApproachingDarkSedan';
  carGroup.position.set(-1.35, 0, -125);
  group.add(carGroup);

  const darkSedanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b0f17,
      roughness: 0.22,
      metalness: 0.85,
    }),
  );
  const darkGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x05070b,
      roughness: 0.12,
      metalness: 0.92,
    }),
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.75,
    }),
  );
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.85,
    }),
  );
  const headlightLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 3.5,
    }),
  );
  const taillightLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.8,
    }),
  );

  // Primary Lower Body
  const sedanHull = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.88, 0.64, 4.45)),
    darkSedanMat,
  );
  sedanHull.position.y = 0.56;
  sedanHull.castShadow = true;
  carGroup.add(sedanHull);

  // Secondary Sleek Cabin Greenhouse
  const sedanCabin = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.58, 0.52, 2.25)),
    darkGlassMat,
  );
  sedanCabin.position.set(0, 1.08, -0.2);
  sedanCabin.castShadow = true;
  carGroup.add(sedanCabin);

  // 4 Rotating Wheels with Alloy Rims
  const carWheelMeshes: THREE.Mesh[] = [];
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20));
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelPositions = [
    { x: -0.92, y: 0.34, z: 1.38 },
    { x: 0.92, y: 0.34, z: 1.38 },
    { x: -0.92, y: 0.34, z: -1.38 },
    { x: 0.92, y: 0.34, z: -1.38 },
  ];
  for (const wp of wheelPositions) {
    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
    wMesh.position.set(wp.x, wp.y, wp.z);
    const hub = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 12)),
      rimMat,
    );
    hub.rotation.z = Math.PI / 2;
    wMesh.add(hub);
    carGroup.add(wMesh);
    carWheelMeshes.push(wMesh);
  }

  // Headlight Lenses (+Z front facing Harsha as it drives from -Z toward +Z)
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.08)),
      headlightLensMat,
    );
    hl.position.set(side * 0.66, 0.62, 2.22);
    carGroup.add(hl);

    // Red Tail / Brake Lights (-Z rear of car)
    const tl = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.08)),
      taillightLensMat,
    );
    tl.position.set(side * 0.64, 0.66, -2.22);
    carGroup.add(tl);
  }

  // Directional SpotLights for the Car's Headlights
  const carHeadlightSpotL = new THREE.SpotLight(0xe0f2fe, 0, 55, Math.PI / 5, 0.55, 1.3);
  carHeadlightSpotL.position.set(-0.66, 0.65, 2.2);
  carHeadlightSpotL.target.position.set(-0.66, 0.1, 22.0);
  carGroup.add(carHeadlightSpotL);
  carGroup.add(carHeadlightSpotL.target);

  const carHeadlightSpotR = new THREE.SpotLight(0xe0f2fe, 0, 55, Math.PI / 5, 0.55, 1.3);
  carHeadlightSpotR.position.set(0.66, 0.65, 2.2);
  carHeadlightSpotR.target.position.set(0.66, 0.1, 22.0);
  carGroup.add(carHeadlightSpotR);
  carGroup.add(carHeadlightSpotR.target);

  // Red Brake / Tail Light PointLight to illuminate the asphalt in Beat 04 & Beat 05
  const carBrakeLightPoint = new THREE.PointLight(0xef4444, 0, 12, 1.5);
  carBrakeLightPoint.position.set(0, 0.62, -2.55);
  carGroup.add(carBrakeLightPoint);

  return {
    group,
    carGroup,
    carWheelMeshes,
    carHeadlightSpotL,
    carHeadlightSpotR,
    carBrakeLightPoint,
    setCarTransform(z, xOffset, headlightIntensity, brakingIntensity, wheelSpinDelta) {
      carGroup.position.set(xOffset, 0, z);
      carHeadlightSpotL.intensity = headlightIntensity;
      carHeadlightSpotR.intensity = headlightIntensity;
      headlightLensMat.emissiveIntensity = Math.max(0.2, headlightIntensity * 0.8);

      carBrakeLightPoint.intensity = brakingIntensity;
      taillightLensMat.emissiveIntensity = 1.2 + brakingIntensity * 1.4;

      for (const w of carWheelMeshes) {
        w.rotation.x += wheelSpinDelta;
      }
    },
    dispose() {
      for (const t of textures) t.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
