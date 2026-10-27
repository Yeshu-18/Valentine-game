import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLAZA_RADIAL_SPOKES, getTerrainHeight } from './terrainMath';
import { CircleCollider } from './VegetationSystem';
import {
  ResourceTracker,
  createThemeParkMaterials,
  createHeartShape2D,
  createExtrudedArchwayGeometry,
} from './ProceduralKit';

export interface DistantLandmarksBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

/**
 * Builds the Boulevard Entrance Framing Trees, Vista Display Portals,
 * and High-Fidelity 3D Zone Landmarks matching the visual design of the PDF.
 */
export function createDistantLandmarks(): DistantLandmarksBundle {
  const group = new THREE.Group();
  group.name = 'DistantLandmarkSilhouettes';

  const colliders: CircleCollider[] = [];
  const tracker = new ResourceTracker();
  const mats = createThemeParkMaterials(tracker);

  const goldMat = mats.brushedGold;
  const warmWindowGlowMat = mats.warmLanternGlow;
  const pinkNeonMat = mats.softRoseGlow;
  const cyanGlowMat = mats.auroraCyanGlow;
  const violetRuneGlowMat = mats.magicVioletGlow;

  const crimsonHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e11d48'),
      emissive: new THREE.Color('#9f1239'),
      emissiveIntensity: 0.55,
      roughness: 0.24,
      clearcoat: 0.35,
    }),
  );
  const sapphireHeartMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2563eb'),
      emissive: new THREE.Color('#1d4ed8'),
      emissiveIntensity: 0.55,
      roughness: 0.24,
      clearcoat: 0.35,
    }),
  );

  // ============================================================================
  // 0. BOULEVARD ENTRANCE FRAMING TREES & ARCHITECTURAL GATEWAYS
  // ============================================================================
  const boulevardGatewaysGroup = new THREE.Group();
  boulevardGatewaysGroup.name = 'BoulevardEntranceGatewaysAndFramingTrees';
  group.add(boulevardGatewaysGroup);

  const planterBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.15, 1.3, 0.72, 12),
  );
  planterBaseGeo.translate(0, 0.36, 0);
  const planterRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.2, 0.1, 8, 24),
  );
  planterRimGeo.rotateX(Math.PI / 2);
  planterRimGeo.translate(0, 0.72, 0);

  const treeTrunkGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.24, 0.42, 4.8, 8),
  );
  treeTrunkGeo.translate(0, 2.4, 0);
  const boughArmGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6),
  );
  boughArmGeo.translate(0, 1.2, 0);

  const boulevardPuffSpecs: Array<[number, number, number, number]> = [
    [0.0, 0.0, 0.0, 1.25],
    [-1.08, -0.2, 0.32, 0.92],
    [1.08, -0.16, -0.28, 0.9],
    [0.22, -0.18, 1.04, 0.88],
    [-0.22, -0.2, -1.02, 0.88],
    [-0.7, 0.35, -0.6, 0.8],
    [0.72, 0.38, 0.58, 0.8],
    [0.0, 0.68, 0.06, 0.86],
    [0.78, -0.32, 0.5, 0.72],
  ];
  const canopyCrownGeo = tracker.trackGeo(
    mergeGeometries(
      boulevardPuffSpecs.map(([px, py, pz, r], idx) => {
        const g = new THREE.IcosahedronGeometry(r, 2);
        const pos = g.attributes.position;
        const freq = 3.2 + (idx % 3) * 0.4;
        for (let k = 0; k < pos.count; k++) {
          const vx = pos.getX(k);
          const vy = pos.getY(k);
          const vz = pos.getZ(k);
          const len = Math.hypot(vx, vy, vz) || 1;
          const d =
            Math.sin(vx * freq + vy * 2.7) *
            Math.cos(vz * freq - vx * 1.9) *
            0.14 *
            r;
          pos.setXYZ(
            k,
            vx + (vx / len) * d,
            vy + (vy / len) * d * 0.85,
            vz + (vz / len) * d,
          );
        }
        g.computeVertexNormals();
        g.scale(1.18, 0.78, 1.18);
        g.translate(px, py, pz);
        return g;
      }),
    ),
  );
  const pineConeGeo = tracker.trackGeo(new THREE.ConeGeometry(1.85, 4.4, 8));
  pineConeGeo.translate(0, 2.2, 0);
  const hangingCordGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6),
  );
  hangingCordGeo.translate(0, -0.55, 0);
  const lanternGlobeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.24, 10, 10),
  );

  const heartShape = createHeartShape2D(1.0);
  const heartEmblemGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 3,
    }),
  );
  heartEmblemGeo.center();

  const gatewayWindUniforms = { uTime: { value: 0 } };
  const applyFramingTreeWind = (mat: THREE.MeshStandardMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = gatewayWindUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float swayAmt = sin(uTime * 1.7 + transformed.x * 1.2 + transformed.z * 1.1) * 0.08;
          transformed.x += swayAmt;
          transformed.z += swayAmt * 0.65;
          `,
        );
    };
  };

  const emeraldFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d6a3e'),
      roughness: 0.76,
    }),
  );
  const blossomPinkFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f472b6'),
      roughness: 0.68,
    }),
  );
  const goldenAutumnFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d97706'),
      roughness: 0.72,
    }),
  );
  const twilightIndigoFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#312e81'),
      roughness: 0.74,
    }),
  );
  const borealPineMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#115e59'),
      roughness: 0.78,
    }),
  );
  [
    emeraldFoliageMat,
    blossomPinkFoliageMat,
    goldenAutumnFoliageMat,
    twilightIndigoFoliageMat,
    borealPineMat,
  ].forEach(applyFramingTreeWind);

  const brickGreenMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#16a34a'),
      roughness: 0.25,
      clearcoat: 0.8,
    }),
  );

  // Botanical shrub cushion inside each stone framing-tree planter
  const planterShrubGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.76, 0.28, 8, 16),
  );
  planterShrubGeo.rotateX(Math.PI / 2);
  planterShrubGeo.scale(1, 0.65, 1);
  planterShrubGeo.translate(0, 0.74, 0);

  /**
   * Places a lush Boulevard Framing Tree in a stone planter with botanical under-planting,
   * an overhanging bough, and a warm hanging lantern (or heart pendant) that frames the boulevard sightline.
   */
  function addBoulevardFramingTree(
    worldX: number,
    worldZ: number,
    inwardAngle: number,
    style: 'aurora' | 'magic' | 'brick' | 'thrill' | 'fashion' | 'midway',
    treeScale: number = 1.0,
  ) {
    const wy = getTerrainHeight(worldX, worldZ);
    const tGroup = new THREE.Group();
    tGroup.position.set(worldX, wy, worldZ);
    tGroup.rotation.y = inwardAngle;
    tGroup.scale.setScalar(treeScale);

    const planter = new THREE.Mesh(planterBaseGeo, mats.creamStone);
    planter.castShadow = true;
    planter.receiveShadow = true;
    const rim = new THREE.Mesh(planterRimGeo, goldMat);
    const baseShrub = new THREE.Mesh(planterShrubGeo, emeraldFoliageMat);
    tGroup.add(planter, rim, baseShrub);

    const trunk = new THREE.Mesh(treeTrunkGeo, mats.darkWalnut);
    trunk.castShadow = true;
    tGroup.add(trunk);

    const bough = new THREE.Mesh(boughArmGeo, mats.darkWalnut);
    bough.position.set(0, 3.9, 0);
    bough.rotation.z = -0.78;
    tGroup.add(bough);

    const lanternX = 1.45;
    const lanternY = 5.05;
    const cord = new THREE.Mesh(hangingCordGeo, goldMat);
    cord.position.set(lanternX, lanternY, 0);

    const lanternMat =
      style === 'aurora'
        ? cyanGlowMat
        : style === 'magic'
          ? violetRuneGlowMat
          : style === 'fashion' || style === 'midway'
            ? pinkNeonMat
            : warmWindowGlowMat;

    const lantern = new THREE.Mesh(
      style === 'fashion' || style === 'midway'
        ? heartEmblemGeo
        : lanternGlobeGeo,
      lanternMat,
    );
    if (style === 'fashion' || style === 'midway') {
      lantern.scale.setScalar(0.28);
    }
    lantern.position.set(lanternX, lanternY - 1.1, 0);
    tGroup.add(cord, lantern);

    if (style === 'aurora') {
      const p1 = new THREE.Mesh(pineConeGeo, borealPineMat);
      p1.position.y = 2.6;
      p1.castShadow = true;
      const p2 = new THREE.Mesh(pineConeGeo, borealPineMat);
      p2.scale.setScalar(0.76);
      p2.position.y = 4.6;
      p2.castShadow = true;
      tGroup.add(p1, p2);
    } else if (style === 'brick') {
      const voxGeo = tracker.trackGeo(new THREE.BoxGeometry(2.4, 2.2, 2.4));
      const voxTopGeo = tracker.trackGeo(new THREE.BoxGeometry(1.6, 1.4, 1.6));
      const v1 = new THREE.Mesh(voxGeo, brickGreenMat);
      v1.position.y = 4.8;
      v1.castShadow = true;
      const v2 = new THREE.Mesh(voxTopGeo, brickGreenMat);
      v2.position.y = 6.4;
      v2.castShadow = true;
      tGroup.add(v1, v2);
    } else {
      const crownMat =
        style === 'fashion'
          ? blossomPinkFoliageMat
          : style === 'magic'
            ? twilightIndigoFoliageMat
            : style === 'thrill'
              ? emeraldFoliageMat
              : goldenAutumnFoliageMat;

      const cMain = new THREE.Mesh(canopyCrownGeo, crownMat);
      cMain.position.set(0, 5.4, 0);
      cMain.castShadow = true;
      const cSide = new THREE.Mesh(
        canopyCrownGeo,
        style === 'thrill' ? goldenAutumnFoliageMat : crownMat,
      );
      cSide.scale.setScalar(0.76);
      cSide.position.set(1.05, 4.75, 0.35);
      cSide.castShadow = true;
      tGroup.add(cMain, cSide);
    }

    boulevardGatewaysGroup.add(tGroup);
    colliders.push({ x: worldX, z: worldZ, radius: 1.25 * treeScale });
  }

  const spokeGatewayStyles: Array<{
    spokeIdx: number;
    style: 'aurora' | 'magic' | 'brick' | 'thrill' | 'fashion' | 'midway';
  }> = [
    { spokeIdx: 0, style: 'aurora' },
    { spokeIdx: 1, style: 'magic' },
    { spokeIdx: 2, style: 'brick' },
    { spokeIdx: 3, style: 'thrill' },
    { spokeIdx: 4, style: 'fashion' },
    { spokeIdx: 5, style: 'midway' },
  ];

  spokeGatewayStyles.forEach(({ spokeIdx, style }) => {
    const spoke = PLAZA_RADIAL_SPOKES[spokeIdx];
    const angle = Math.atan2(spoke.bx - spoke.ax, spoke.bz - spoke.az);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // 3 pairs of graduated framing trees flanking each outer boulevard avenue (r = 36.2m, 42.2m, 48.2m)
    // Placed beyond the CentralPlaza Boulevard Gateways (r = 32.2m) at lateral offset ±6.0m so sightlines stay 100% open
    const treeRows = [
      { rDist: 36.2, latOffset: 6.0, scale: 1.02 },
      { rDist: 42.2, latOffset: 6.1, scale: 0.94 },
      { rDist: 48.2, latOffset: 6.2, scale: 0.86 },
    ];
    treeRows.forEach(({ rDist, latOffset, scale }) => {
      // On North spoke, skip r = 36.2m so the Northern Lights Gateway at r = 36.8m has full clearance
      if (spokeIdx === 0 && rDist < 39.0) return;
      const cx = sinA * rDist;
      const cz = cosA * rDist;

      addBoulevardFramingTree(
        cx + cosA * latOffset,
        cz - sinA * latOffset,
        angle - Math.PI / 2,
        style,
        scale,
      );
      addBoulevardFramingTree(
        cx - cosA * latOffset,
        cz + sinA * latOffset,
        angle + Math.PI / 2,
        style,
        scale,
      );
    });
  });

  // ============================================================================
  // 0C. 2D GILDED VISTA DISPLAY BOARDS AT BOULEVARD ENTRANCES & ZONE OVERLOOKS
  // ============================================================================
  const texLoader = new THREE.TextureLoader();
  const vistaFramePostGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.14, 0.18, 4.4, 10),
  );
  vistaFramePostGeo.translate(0, 2.2, 0);
  const vistaCrownBarGeo = tracker.trackGeo(
    new THREE.BoxGeometry(5.6, 0.28, 0.34),
  );
  const vistaHeaderPlaqueGeo = tracker.trackGeo(
    new THREE.BoxGeometry(3.5, 0.62, 0.22),
  );

  function createVistaHeaderPlaqueTexture(
    title: string,
    subtitle: string,
    accentHex: string,
  ): THREE.Material {
    if (typeof document === 'undefined') {
      return goldMat;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1b1426';
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = '#eab965';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 100);

    ctx.fillStyle = accentHex;
    ctx.fillRect(14, 14, 12, 84);
    ctx.fillRect(486, 14, 12, 84);

    ctx.fillStyle = '#f5d487';
    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle.toUpperCase(), 256, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 31px "Fraunces", Georgia, serif';
    ctx.fillText(title, 256, 82);

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tracker.trackMat(new THREE.MeshBasicMaterial({ map: tex }));
  }

  function addPdfVistaDisplayPortal(
    worldX: number,
    worldZ: number,
    facingX: number,
    facingZ: number,
    imageUrl: string,
    title: string,
    subtitle: string,
    accentHex: string,
    width: number = 4.6,
    height: number = 2.6,
    scale: number = 1.0,
  ) {
    const wy = getTerrainHeight(worldX, worldZ);
    const portalGroup = new THREE.Group();
    portalGroup.position.set(worldX, wy, worldZ);
    portalGroup.rotation.y = Math.atan2(facingX - worldX, facingZ - worldZ);
    portalGroup.scale.setScalar(scale);

    const halfW = width * 0.5 + 0.25;
    const postL = new THREE.Mesh(vistaFramePostGeo, mats.wroughtBronze);
    postL.position.x = -halfW;
    postL.castShadow = true;
    const postR = new THREE.Mesh(vistaFramePostGeo, mats.wroughtBronze);
    postR.position.x = halfW;
    postR.castShadow = true;

    const backingGeo = tracker.trackGeo(
      new THREE.BoxGeometry(width + 0.36, height + 0.36, 0.2),
    );
    const backing = new THREE.Mesh(backingGeo, goldMat);
    const centerY = 1.25 + height * 0.5;
    backing.position.set(0, centerY, 0);
    backing.castShadow = true;

    const loadedTex = tracker.trackTex(texLoader.load(imageUrl));
    loadedTex.colorSpace = THREE.SRGBColorSpace;
    const artMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        map: loadedTex,
        color: new THREE.Color('#ffffff'),
      }),
    );

    const artPlaneGeo = tracker.trackGeo(
      new THREE.PlaneGeometry(width, height),
    );
    const artFront = new THREE.Mesh(artPlaneGeo, artMat);
    artFront.position.set(0, centerY, 0.12);
    const artBack = new THREE.Mesh(artPlaneGeo, artMat);
    artBack.position.set(0, centerY, -0.12);
    artBack.rotation.y = Math.PI;

    const crownY = centerY + height * 0.5 + 0.24;
    const crown = new THREE.Mesh(vistaCrownBarGeo, goldMat);
    crown.scale.x = (width + 0.8) / 5.6;
    crown.position.set(0, crownY, 0);

    const plaqueMat = createVistaHeaderPlaqueTexture(
      title,
      subtitle,
      accentHex,
    );
    const plaque = new THREE.Mesh(vistaHeaderPlaqueGeo, [
      goldMat,
      goldMat,
      goldMat,
      goldMat,
      plaqueMat,
      plaqueMat,
    ]);
    plaque.position.set(0, crownY + 0.44, 0);

    const heartCrest = new THREE.Mesh(heartEmblemGeo, crimsonHeartMat);
    heartCrest.scale.setScalar(0.32);
    heartCrest.position.set(0, crownY + 0.94, 0);

    const lanternL = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
    lanternL.position.set(-halfW, crownY + 0.32, 0);
    const lanternR = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
    lanternR.position.set(halfW, crownY + 0.32, 0);

    portalGroup.add(
      postL,
      postR,
      backing,
      artFront,
      artBack,
      crown,
      plaque,
      heartCrest,
      lanternL,
      lanternR,
    );
    boulevardGatewaysGroup.add(portalGroup);
    colliders.push({ x: worldX, z: worldZ, radius: 1.35 * scale });
  }

  const spokeVistaArtwork: Array<{
    spokeIdx: number;
    url: string;
    title: string;
    subtitle: string;
    accent: string;
    w: number;
    h: number;
  }> = [
    {
      spokeIdx: 0,
      url: '/assets/vistas/art_aurora_lake.jpg',
      title: 'Aurora Lake Sanctuary',
      subtitle: 'North Vista • Celestial Reflection',
      accent: '#2dd4bf',
      w: 3.8,
      h: 2.9,
    },
    {
      spokeIdx: 1,
      url: '/assets/vistas/art_ancient_realm.jpg',
      title: 'Enchanted Ancient Realm',
      subtitle: 'Northwest Vista • Gothic Sanctuary',
      accent: '#a855f7',
      w: 4.8,
      h: 2.4,
    },
    {
      spokeIdx: 2,
      url: '/assets/vistas/art_brick_district.jpg',
      title: 'Playful Brick District',
      subtitle: 'West Vista • Modular Toy Town',
      accent: '#facc15',
      w: 4.8,
      h: 2.4,
    },
    {
      spokeIdx: 3,
      url: '/assets/vistas/art_thrill_zone.jpg',
      title: 'Spectacular Thrill Zone',
      subtitle: 'Northeast Vista • Sky Coaster',
      accent: '#f97316',
      w: 4.8,
      h: 2.4,
    },
    {
      spokeIdx: 4,
      url: '/assets/vistas/art_fashion_world.jpg',
      title: 'Pastel Dreamscape',
      subtitle: 'East Vista • Doll Couture Realm',
      accent: '#ec4899',
      w: 4.8,
      h: 2.1,
    },
    {
      spokeIdx: 5,
      url: '/assets/vistas/art_romantic_midway.jpg',
      title: 'Playful Romantic Midway',
      subtitle: 'South Vista • Couple Carnival',
      accent: '#f43f5e',
      w: 4.8,
      h: 2.1,
    },
  ];

  spokeVistaArtwork.forEach((cfg) => {
    const spoke = PLAZA_RADIAL_SPOKES[cfg.spokeIdx];
    const angle = Math.atan2(spoke.bx - spoke.ax, spoke.bz - spoke.az);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // 1) Boulevard Entrance 2D Vista Display Board (r = 27.2m, lateral offset +5.4m so boulevard path stays clear)
    const portalR = 27.2;
    const lat = 5.4;
    const px = sinA * portalR + cosA * lat;
    const pz = cosA * portalR - sinA * lat;
    addPdfVistaDisplayPortal(
      px,
      pz,
      0,
      0,
      cfg.url,
      cfg.title,
      cfg.subtitle,
      cfg.accent,
      cfg.w,
      cfg.h,
      0.86,
    );

    // 2) Distant Zone Overlook 2D Vista Display Board near the end of each radial boulevard
    // On the NW Ancient Realm spoke (spokeIdx === 1), offset further right so the Castle Landing Terrace (-74, +64) and sightline are 100% clear
    const farLat = cfg.spokeIdx === 1 ? 13.5 : 7.8;
    const farScale = cfg.spokeIdx === 1 ? 0.78 : 0.82;
    const farX = spoke.bx * farScale + cosA * farLat;
    const farZ = spoke.bz * farScale - sinA * farLat;
    addPdfVistaDisplayPortal(
      farX,
      farZ,
      0,
      0,
      cfg.url,
      cfg.title,
      cfg.subtitle,
      cfg.accent,
      cfg.w,
      cfg.h,
      1.25,
    );
  });

  // Special Gate 2D Vista Display Board at the Far South Tip Overlook (-6.5, -103)
  addPdfVistaDisplayPortal(
    -6.5,
    -103,
    0,
    -65,
    '/assets/vistas/art_special_gate.jpg',
    'The Special Gate',
    'Southern Tip • Final Romantic Threshold',
    '#f43f5e',
    3.6,
    3.0,
    1.15,
  );

  // ============================================================================
  // 1. NORTHWEST (-85, +75): ENCHANTED ANCIENT REALM & CASTLE LANDING TERRACE
  // ============================================================================
  const magicGroup = new THREE.Group();
  const magicBaseY = CASTLE_GATE_POS_Y_FALLBACK();
  magicGroup.position.set(-85, magicBaseY, 75);
  group.add(magicGroup);

  function CASTLE_GATE_POS_Y_FALLBACK(): number {
    return 27.2;
  }

  const basaltStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4c465e'),
      roughness: 0.8,
      metalness: 0.08,
    }),
  );
  const indigoSpireMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#27355c'),
      roughness: 0.42,
      metalness: 0.25,
    }),
  );

  magicGroup.rotation.y = -Math.PI / 4;

  // 7 Towering Outer Gothic Turret Spires flanking the Great Hall Cathedral & Library/Potions Wings
  const magicTowers = [
    { x: 0, z: 36.5, r: 3.3, h: 34, roofH: 13.5 },
    { x: -19.8, z: -2.0, r: 2.5, h: 25, roofH: 9.5 },
    { x: 19.8, z: -2.0, r: 2.5, h: 25, roofH: 9.5 },
    { x: -20.5, z: 14.0, r: 2.2, h: 23, roofH: 8.5 },
    { x: 20.5, z: 14.0, r: 2.2, h: 23, roofH: 8.5 },
    { x: -13.5, z: 26.5, r: 2.4, h: 28, roofH: 10.5 },
    { x: 13.5, z: 26.5, r: 2.4, h: 28, roofH: 10.5 },
  ];

  magicTowers.forEach((t) => {
    const tCylGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(t.r * 0.9, t.r, t.h, 12),
    );
    tCylGeo.translate(0, t.h / 2, 0);
    const tRoofGeo = tracker.trackGeo(
      new THREE.ConeGeometry(t.r * 1.25, t.roofH, 12),
    );
    tRoofGeo.translate(0, t.h + t.roofH / 2, 0);

    const tCyl = new THREE.Mesh(tCylGeo, basaltStoneMat);
    tCyl.position.set(t.x, 0, t.z);
    tCyl.castShadow = true;
    const tRoof = new THREE.Mesh(tRoofGeo, indigoSpireMat);
    tRoof.position.set(t.x, 0, t.z);
    tRoof.castShadow = true;

    const lanternRingGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(t.r * 0.93, t.r * 0.93, 1.6, 10),
    );
    lanternRingGeo.translate(t.x, t.h - 2.2, t.z);
    const lanternRing = new THREE.Mesh(lanternRingGeo, warmWindowGlowMat);

    magicGroup.add(tCyl, tRoof, lanternRing);
  });

  // Multi-Arch Stone Viaduct Bridge & Cascading Cliffside Waterfall (Page 6!)
  const viaductGeo = tracker.trackGeo(
    createExtrudedArchwayGeometry(24, 10.5, 9.0, 7.8, 3.6),
  );
  const viaductMesh = new THREE.Mesh(viaductGeo, basaltStoneMat);
  viaductMesh.position.set(17, -9.5, -5);
  magicGroup.add(viaductMesh);

  const waterfallGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.0, 3.6, 19, 12),
  );
  const waterfallMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bae6fd'),
      transparent: true,
      opacity: 0.76,
    }),
  );
  const waterfallMesh = new THREE.Mesh(waterfallGeo, waterfallMat);
  waterfallMesh.position.set(4, -9.0, -8.5);
  magicGroup.add(waterfallMesh);

  // Floating Sky Island Citadel high behind the Castle (visible in Page 5 & Page 6!)
  const floatingIslandGroup = new THREE.Group();
  floatingIslandGroup.position.set(-14, 24, 16);
  magicGroup.add(floatingIslandGroup);
  const rockInvertedConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(6.5, 9.5, 7),
  );
  rockInvertedConeGeo.rotateX(Math.PI);
  rockInvertedConeGeo.translate(0, -4.75, 0);
  const floatingRock = new THREE.Mesh(rockInvertedConeGeo, basaltStoneMat);
  const miniSpireGeo = tracker.trackGeo(new THREE.ConeGeometry(3.2, 11, 8));
  miniSpireGeo.translate(0, 5.5, 0);
  const miniSpire = new THREE.Mesh(miniSpireGeo, indigoSpireMat);
  floatingIslandGroup.add(floatingRock, miniSpire);

  // ============================================================================
  // 1B. INTEGRATED STONE CASTLE LANDING TERRACE AT (-74, +64) & NW MOUNTAIN TRAIL
  // ============================================================================
  const castleTerraceGroup = new THREE.Group();
  const castleTerraceX = -74.0;
  const castleTerraceZ = 64.0;
  const castleTerraceY = getTerrainHeight(castleTerraceX, castleTerraceZ);
  castleTerraceGroup.position.set(
    castleTerraceX,
    castleTerraceY,
    castleTerraceZ,
  );
  // Orient terrace along the NW Castle axis (-85, +75)
  const terraceYaw = Math.atan2(
    -85.0 - castleTerraceX,
    75.0 - castleTerraceZ,
  );
  castleTerraceGroup.rotation.y = terraceYaw;
  group.add(castleTerraceGroup);

  const weatheredFlagstoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#78716c'),
      roughness: 0.86,
      metalness: 0.04,
    }),
  );
  const houseBannerVioletMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4c1d95'),
      roughness: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  const houseBannerCrimsonMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#881337'),
      roughness: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  const subtleLandingRuneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c4b5fd'),
      emissive: new THREE.Color('#6d28d9'),
      emissiveIntensity: 0.38,
      roughness: 0.4,
    }),
  );

  // 1) Deep Battered Basalt Cliffside Foundation & Buttresses (integrates deck into mountain crag)
  const cliffFoundationGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(8.9, 11.4, 14.0, 16),
  );
  cliffFoundationGeo.translate(0, -7.0, 0);
  const cliffFoundationMesh = new THREE.Mesh(
    cliffFoundationGeo,
    basaltStoneMat,
  );
  cliffFoundationMesh.castShadow = true;
  cliffFoundationMesh.receiveShadow = true;
  castleTerraceGroup.add(cliffFoundationMesh);

  const buttressGeo = tracker.trackGeo(new THREE.BoxGeometry(1.35, 13.5, 2.2));
  buttressGeo.translate(0, -6.6, 0);
  for (let b = 0; b < 8; b++) {
    const bAng = (b * Math.PI * 2) / 8 + Math.PI / 8;
    const buttress = new THREE.Mesh(buttressGeo, basaltStoneMat);
    buttress.position.set(Math.sin(bAng) * 9.0, 0, Math.cos(bAng) * 9.0);
    buttress.rotation.y = bAng;
    buttress.castShadow = true;
    buttress.receiveShadow = true;
    castleTerraceGroup.add(buttress);
  }

  // 2) Weathered Basalt & Cream-Stone Terrace Deck
  const terraceDeckGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(8.8, 9.0, 0.42, 16),
  );
  terraceDeckGeo.translate(0, -0.18, 0);
  const terraceDeckMesh = new THREE.Mesh(
    terraceDeckGeo,
    weatheredFlagstoneMat,
  );
  terraceDeckMesh.receiveShadow = true;
  terraceDeckMesh.castShadow = true;
  castleTerraceGroup.add(terraceDeckMesh);

  const terraceRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(8.7, 0.24, 8, 32),
  );
  terraceRimGeo.rotateX(Math.PI / 2);
  terraceRimGeo.translate(0, 0.02, 0);
  const terraceRimMesh = new THREE.Mesh(terraceRimGeo, mats.creamStone);
  terraceRimMesh.receiveShadow = true;
  castleTerraceGroup.add(terraceRimMesh);

  // Connecting Stone Causeway leading from Terrace (+Z in terrace local) flush up to the Castle Gate & Keep (-85, +75)
  const causewayGeo = tracker.trackGeo(new THREE.BoxGeometry(5.6, 3.6, 10.5));
  causewayGeo.translate(0, -1.78, 9.8);
  const causewayMesh = new THREE.Mesh(causewayGeo, weatheredFlagstoneMat);
  causewayMesh.receiveShadow = true;
  causewayMesh.castShadow = true;
  castleTerraceGroup.add(causewayMesh);

  const causewayCurbGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.45, 0.75, 8.8),
  );
  [-2.65, 2.65].forEach((cx) => {
    const curb = new THREE.Mesh(causewayCurbGeo, mats.creamStone);
    curb.position.set(cx, 0.38, 10.2);
    curb.castShadow = true;
    castleTerraceGroup.add(curb);
  });

  // 3) Low Stone Parapets & Warm Bronze Lantern Piers around the cliffside edge
  // Leave wide openings at local angle 0 (NW causeway to Castle) and π (SE approach trail)
  const parapetSegGeo = tracker.trackGeo(
    new THREE.BoxGeometry(2.8, 0.88, 0.52),
  );
  parapetSegGeo.translate(0, 0.44, 0);
  const parapetCapGeo = tracker.trackGeo(
    new THREE.BoxGeometry(2.96, 0.14, 0.64),
  );
  parapetCapGeo.translate(0, 0.92, 0);

  const parapetAngles = [
    0.52,
    0.95,
    1.38,
    1.82,
    2.25,
    -0.52,
    -0.95,
    -1.38,
    -1.82,
    -2.25,
  ];
  parapetAngles.forEach((pAng) => {
    const pGroup = new THREE.Group();
    const pr = 8.35;
    pGroup.position.set(Math.sin(pAng) * pr, 0, Math.cos(pAng) * pr);
    pGroup.rotation.y = pAng;
    const wall = new THREE.Mesh(parapetSegGeo, basaltStoneMat);
    wall.castShadow = true;
    wall.receiveShadow = true;
    const cap = new THREE.Mesh(parapetCapGeo, mats.creamStone);
    cap.castShadow = true;
    pGroup.add(wall, cap);
    castleTerraceGroup.add(pGroup);
  });

  // 6 Stone Parapet Piers with Warm Bronze Lanterns
  const pierGeo = tracker.trackGeo(new THREE.BoxGeometry(0.76, 1.38, 0.76));
  pierGeo.translate(0, 0.69, 0);
  const lanternPostCageGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.18, 0.14, 0.48, 8),
  );
  lanternPostCageGeo.translate(0, 1.62, 0);

  const lanternPierAngles = [0.36, -0.36, 1.57, -1.57, 2.68, -2.68];
  lanternPierAngles.forEach((lAng) => {
    const pr = 8.35;
    const lx = Math.sin(lAng) * pr;
    const lz = Math.cos(lAng) * pr;
    const pier = new THREE.Mesh(pierGeo, mats.creamStone);
    pier.position.set(lx, 0, lz);
    pier.rotation.y = lAng;
    pier.castShadow = true;

    const cage = new THREE.Mesh(lanternPostCageGeo, mats.wroughtBronze);
    cage.position.set(lx, 0, lz);

    const globe = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
    globe.scale.setScalar(0.92);
    globe.position.set(lx, 1.64, lz);

    castleTerraceGroup.add(pier, cage, globe);
  });

  // Warm localized courtyard glow on the Castle Landing Terrace
  const terraceWarmLight = new THREE.PointLight('#ffdfa3', 2.2, 18.0, 1.6);
  terraceWarmLight.position.set(0, 3.2, 0);
  castleTerraceGroup.add(terraceWarmLight);

  // 4) 4 Ancient Realm House Banners flanking the Castle Causeway & Trail Entrance
  const bannerPoleGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.055, 0.07, 4.4, 8),
  );
  bannerPoleGeo.translate(0, 2.2, 0);
  const bannerCrossbarGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8),
  );
  bannerCrossbarGeo.rotateZ(Math.PI / 2);
  bannerCrossbarGeo.translate(0, 3.95, 0.35);
  const bannerClothGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.96, 2.35));
  bannerClothGeo.translate(0, 2.75, 0.35);

  const bannerPositions = [
    { x: -3.2, z: 7.4, rotY: 0, mat: houseBannerVioletMat },
    { x: 3.2, z: 7.4, rotY: 0, mat: houseBannerCrimsonMat },
    { x: -3.4, z: -7.4, rotY: Math.PI, mat: houseBannerCrimsonMat },
    { x: 3.4, z: -7.4, rotY: Math.PI, mat: houseBannerVioletMat },
  ];
  bannerPositions.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0, b.z);
    bGroup.rotation.y = b.rotY;
    const pole = new THREE.Mesh(bannerPoleGeo, mats.wroughtBronze);
    pole.castShadow = true;
    const crossbar = new THREE.Mesh(bannerCrossbarGeo, goldMat);
    const cloth = new THREE.Mesh(bannerClothGeo, b.mat);
    cloth.castShadow = true;
    bGroup.add(pole, crossbar, cloth);
    castleTerraceGroup.add(bGroup);
  });

  // 5) Subtle Inlaid Stone & Brushed-Brass Landing Circle on the Terrace Deck
  const landingOuterRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(3.65, 3.95, 48),
  );
  landingOuterRingGeo.rotateX(-Math.PI / 2);
  const landingOuterRing = new THREE.Mesh(landingOuterRingGeo, goldMat);
  landingOuterRing.position.set(0, 0.045, 0);
  castleTerraceGroup.add(landingOuterRing);

  const landingInnerRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(2.35, 2.55, 40),
  );
  landingInnerRingGeo.rotateX(-Math.PI / 2);
  const landingInnerRing = new THREE.Mesh(
    landingInnerRingGeo,
    subtleLandingRuneMat,
  );
  landingInnerRing.position.set(0, 0.048, 0);
  castleTerraceGroup.add(landingInnerRing);

  // Rotating subtle brass compass inlay inside the landing circle
  const arcaneRing2Geo = tracker.trackGeo(
    new THREE.TorusGeometry(3.1, 0.045, 8, 36),
  );
  arcaneRing2Geo.rotateX(Math.PI / 2);
  const arcaneRing2 = new THREE.Mesh(arcaneRing2Geo, goldMat);
  arcaneRing2.position.set(0, 0.05, 0);
  castleTerraceGroup.add(arcaneRing2);

  const compassRayGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.14, 0.02, 7.2),
  );
  for (let r = 0; r < 4; r++) {
    const ray = new THREE.Mesh(compassRayGeo, goldMat);
    ray.position.set(0, 0.042, 0);
    ray.rotation.y = (r * Math.PI) / 4;
    castleTerraceGroup.add(ray);
  }

  // 6) Northwest Mountain Trail Framing Bollards & Warm Path Lanterns ((-34, +31) up to (-66, +57))
  const trailBollardGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.18, 0.24, 1.25, 8),
  );
  trailBollardGeo.translate(0, 0.625, 0);
  const nwTrailSteps = [0.28, 0.48, 0.68, 0.86];
  nwTrailSteps.forEach((stepT) => {
    const cx = THREE.MathUtils.lerp(-24.0, -70.0, stepT);
    const cz = THREE.MathUtils.lerp(22.0, 60.5, stepT);
    const perpX = 0.645;
    const perpZ = 0.764;
    [-3.4, 3.4].forEach((lat) => {
      const bx = cx + perpX * lat;
      const bz = cz + perpZ * lat;
      const by = getTerrainHeight(bx, bz);
      const bollard = new THREE.Mesh(trailBollardGeo, basaltStoneMat);
      bollard.position.set(bx, by - 0.08, bz);
      bollard.castShadow = true;
      const topLantern = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
      topLantern.scale.setScalar(0.62);
      topLantern.position.set(bx, by + 1.28, bz);
      group.add(bollard, topLantern);
    });
  });

  // 20 Floating Golden Sky Lanterns above the Ancient Realm
  const floatingLanternsGroup = new THREE.Group();
  magicGroup.add(floatingLanternsGroup);
  for (let i = 0; i < 20; i++) {
    const orb = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
    orb.scale.setScalar(1.85);
    const ang = (i / 20) * Math.PI * 2;
    orb.position.set(
      Math.cos(ang) * (9 + (i % 3) * 4.5),
      16 + (i % 5) * 4.4,
      Math.sin(ang) * (8 + (i % 2) * 4.5),
    );
    floatingLanternsGroup.add(orb);
  }

  // ============================================================================
  // 2. WEST (-80, +5): PLAYFUL BRICK-BUILT DISTRICT (PAGE 5 OF PDF)
  // ============================================================================
  const brickGroup = new THREE.Group();
  const brickBaseY = getTerrainHeight(-80, 5);
  brickGroup.position.set(-80, brickBaseY, 5);
  brickGroup.rotation.y = Math.PI / 2;
  group.add(brickGroup);
  colliders.push({ x: -80, z: 5, radius: 12 });

  const brickRedMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dc2626'),
      roughness: 0.22,
      clearcoat: 0.85,
    }),
  );
  const brickBlueMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2563eb'),
      roughness: 0.22,
      clearcoat: 0.85,
    }),
  );
  const brickYellowMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#facc15'),
      roughness: 0.22,
      clearcoat: 0.85,
    }),
  );
  const brickWhiteMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f8fafc'),
      roughness: 0.25,
      clearcoat: 0.8,
    }),
  );

  const studGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.55, 0.55, 0.38, 12),
  );
  studGeo.translate(0, 0.19, 0);

  function addGiantBrickBlock(
    bx: number,
    by: number,
    bz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    studCols = 2,
    studRows = 2,
  ) {
    const bGeo = tracker.trackGeo(new THREE.BoxGeometry(w, h, d));
    bGeo.translate(0, h / 2, 0);
    const bMesh = new THREE.Mesh(bGeo, mat);
    bMesh.position.set(bx, by, bz);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    brickGroup.add(bMesh);

    for (let sc = 0; sc < studCols; sc++) {
      for (let sr = 0; sr < studRows; sr++) {
        const sx =
          bx + (studCols === 1 ? 0 : (sc / (studCols - 1) - 0.5) * (w * 0.62));
        const sz =
          bz + (studRows === 1 ? 0 : (sr / (studRows - 1) - 0.5) * (d * 0.62));
        const stud = new THREE.Mesh(studGeo, mat);
        stud.position.set(sx, by + h, sz);
        brickGroup.add(stud);
      }
    }
  }

  // Blue-and-Cream Brick Castle & Colorful Gabled Townhouses (Page 5!)
  addGiantBrickBlock(0, 0, 0, 13, 8.0, 8.5, brickWhiteMat, 4, 2);
  addGiantBrickBlock(0, 8.0, 0, 7.0, 10.5, 7.0, brickYellowMat, 2, 2);
  addGiantBrickBlock(-8.0, 0, 2.0, 5.4, 13.0, 5.4, brickRedMat, 2, 2);
  addGiantBrickBlock(8.0, 0, 2.0, 5.4, 13.0, 5.4, brickBlueMat, 2, 2);
  addGiantBrickBlock(-13.5, 0, 7.5, 4.8, 8.5, 4.8, brickWhiteMat, 2, 2);

  const brickRoofCenterGeo = tracker.trackGeo(
    new THREE.ConeGeometry(5.5, 7.2, 4),
  );
  brickRoofCenterGeo.rotateY(Math.PI / 4);
  brickRoofCenterGeo.translate(0, 22.1, 0);
  const brickRoofSideGeo = tracker.trackGeo(
    new THREE.ConeGeometry(4.0, 5.4, 4),
  );
  brickRoofSideGeo.rotateY(Math.PI / 4);

  const bRoofC = new THREE.Mesh(brickRoofCenterGeo, brickBlueMat);
  const bRoofL = new THREE.Mesh(brickRoofSideGeo, brickBlueMat);
  bRoofL.position.set(-8.0, 15.7, 2.0);
  const bRoofR = new THREE.Mesh(brickRoofSideGeo, brickRedMat);
  bRoofR.position.set(8.0, 15.7, 2.0);
  const bRoofTown = new THREE.Mesh(brickRoofSideGeo, brickRedMat);
  bRoofTown.position.set(-13.5, 11.2, 7.5);
  brickGroup.add(bRoofC, bRoofL, bRoofR, bRoofTown);

  // Vintage Brick-Built Steam Express Train Puffing White Steam Clouds (Page 5!)
  const trainGroup = new THREE.Group();
  trainGroup.position.set(-5, 0.2, 13.0);
  brickGroup.add(trainGroup);

  const boilerGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.2, 1.2, 5.0, 14),
  );
  boilerGeo.rotateZ(Math.PI / 2);
  boilerGeo.translate(0, 1.85, 0);
  const cabGeo = tracker.trackGeo(new THREE.BoxGeometry(2.5, 3.4, 2.5));
  cabGeo.translate(-2.9, 2.2, 0);
  const smokestackGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.48, 0.34, 1.5, 10),
  );
  smokestackGeo.translate(1.7, 3.2, 0);
  const coachGeo = tracker.trackGeo(new THREE.BoxGeometry(4.8, 2.7, 2.4));
  coachGeo.translate(-7.5, 1.85, 0);

  const boilerMesh = new THREE.Mesh(boilerGeo, brickBlueMat);
  const cabMesh = new THREE.Mesh(cabGeo, brickRedMat);
  const stackMesh = new THREE.Mesh(smokestackGeo, goldMat);
  const coachMesh = new THREE.Mesh(coachGeo, brickRedMat);
  trainGroup.add(boilerMesh, cabMesh, stackMesh, coachMesh);

  for (let s = 0; s < 5; s++) {
    const steamPuff = new THREE.Mesh(lanternGlobeGeo, brickWhiteMat);
    steamPuff.scale.setScalar(1.9 + s * 0.65);
    steamPuff.position.set(1.7 - s * 1.15, 4.5 + s * 0.9, 0);
    trainGroup.add(steamPuff);
  }

  // Rotating Yellow Brick Construction Crane lifting a Blue Brick Block (Page 5!)
  const cranePivot = new THREE.Group();
  cranePivot.position.set(13.5, 0, -4);
  brickGroup.add(cranePivot);
  const craneMastGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 22, 1.7));
  craneMastGeo.translate(0, 11, 0);
  const craneJibGeo = tracker.trackGeo(new THREE.BoxGeometry(15, 1.3, 1.3));
  craneJibGeo.translate(4.8, 21.5, 0);
  const suspendedBrickGeo = tracker.trackGeo(
    new THREE.BoxGeometry(3.4, 2.4, 2.4),
  );
  suspendedBrickGeo.translate(9.5, 15.0, 0);
  const craneMast = new THREE.Mesh(craneMastGeo, brickYellowMat);
  const craneJib = new THREE.Mesh(craneJibGeo, brickYellowMat);
  const suspendedBrick = new THREE.Mesh(suspendedBrickGeo, brickBlueMat);
  cranePivot.add(craneMast, craneJib, suspendedBrick);

  // ============================================================================
  // 3. NORTHEAST (+85, +75): SPECTACULAR THRILL ZONE & ROLLER COASTER (PAGE 7)
  // ============================================================================
  const coasterGroup = new THREE.Group();
  group.add(coasterGroup);

  const coasterSupportMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e2e8f0'),
      roughness: 0.35,
      metalness: 0.42,
    }),
  );

  // Sweeping High-Altitude Coaster Track Spline Silhouette (Apex at Y = +56m!)
  const coasterPts = [
    new THREE.Vector3(52, 16, 44),
    new THREE.Vector3(68, 34, 62),
    new THREE.Vector3(88, 56, 82),
    new THREE.Vector3(106, 26, 74),
    new THREE.Vector3(104, 44, 52),
    new THREE.Vector3(84, 22, 34),
    new THREE.Vector3(64, 31, 28),
    new THREE.Vector3(46, 18, 34),
  ];
  const coasterCurve = new THREE.CatmullRomCurve3(coasterPts, true);

  const spineTrackGeo = tracker.trackGeo(
    new THREE.TubeGeometry(coasterCurve, 150, 0.45, 8, true),
  );
  const spineTrackMesh = new THREE.Mesh(spineTrackGeo, coasterSupportMat);
  spineTrackMesh.castShadow = true;
  coasterGroup.add(spineTrackMesh);

  const upperPts = coasterPts.map(
    (p) => new THREE.Vector3(p.x, p.y + 0.68, p.z),
  );
  const upperCurve = new THREE.CatmullRomCurve3(upperPts, true);
  const upperRailGeo = tracker.trackGeo(
    new THREE.TubeGeometry(upperCurve, 150, 0.24, 6, true),
  );
  const upperRailMesh = new THREE.Mesh(upperRailGeo, sapphireHeartMat);
  coasterGroup.add(upperRailMesh);

  // Coaster Vertical Support Columns
  const supportSamples = 26;
  for (let i = 0; i < supportSamples; i++) {
    const pt = coasterCurve.getPointAt(i / supportSamples);
    const groundY = getTerrainHeight(pt.x, pt.z);
    const colH = Math.max(1, pt.y - groundY);
    const colGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.25, 0.38, colH, 8),
    );
    colGeo.translate(pt.x, groundY + colH / 2, pt.z);
    const colMesh = new THREE.Mesh(colGeo, coasterSupportMat);
    colMesh.castShadow = true;
    coasterGroup.add(colMesh);
  }

  // Animated 4-Car Royal-Blue & Gold Coaster Train riding the spline (Page 7!)
  const coasterCarGeo = tracker.trackGeo(new THREE.BoxGeometry(1.6, 1.0, 2.3));
  const coasterCars: THREE.Mesh[] = [];
  for (let c = 0; c < 4; c++) {
    const car = new THREE.Mesh(
      coasterCarGeo,
      c === 0 ? goldMat : sapphireHeartMat,
    );
    coasterGroup.add(car);
    coasterCars.push(car);
  }

  // Grand Golden Armillary Star-Sphere Monument in the Coaster Plaza (+54, +46) (Page 7!)
  const thrillGateGroup = new THREE.Group();
  const thrillGateY = getTerrainHeight(54, 46);
  thrillGateGroup.position.set(54, thrillGateY, 46);
  thrillGateGroup.rotation.y = Math.atan2(-54, -46);
  coasterGroup.add(thrillGateGroup);

  const armillaryGroup = new THREE.Group();
  armillaryGroup.position.set(0, 9.5, 0);
  thrillGateGroup.add(armillaryGroup);
  const armRing1Geo = tracker.trackGeo(
    new THREE.TorusGeometry(4.4, 0.24, 10, 36),
  );
  const armRing2Geo = tracker.trackGeo(
    new THREE.TorusGeometry(3.4, 0.2, 10, 36),
  );
  const armCoreGeo = tracker.trackGeo(new THREE.SphereGeometry(1.15, 14, 14));
  const armRing1 = new THREE.Mesh(armRing1Geo, goldMat);
  const armRing2 = new THREE.Mesh(armRing2Geo, goldMat);
  armRing2.rotation.x = Math.PI / 3;
  const armCore = new THREE.Mesh(armCoreGeo, warmWindowGlowMat);
  armillaryGroup.add(armRing1, armRing2, armCore);

  // ============================================================================
  // 4. EAST (+80, +5): PASTEL DREAMSCAPE / DOLL WORLD (PAGE 4 OF PDF)
  // Upgraded: The interactive 5-Level Dream Castle at (88, 18) now anchors this zone.
  // We keep only the high-altitude whimsical hot-air balloon so castle interiors remain 100% clear.
  // ============================================================================
  const dollGroup = new THREE.Group();
  const dollBaseY = getTerrainHeight(80, 5);
  dollGroup.position.set(80, dollBaseY, 5);
  dollGroup.rotation.y = -Math.PI / 2;
  group.add(dollGroup);

  const coralPinkMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f472b6'),
      roughness: 0.34,
      clearcoat: 0.2,
    }),
  );

  // Landmark 4E: Pastel Hot-Air Balloon floating above Fashion World (Page 4!)
  const balloonGroup = new THREE.Group();
  balloonGroup.position.set(-4, 26, -6);
  dollGroup.add(balloonGroup);
  const balloonEnvelopeGeo = tracker.trackGeo(
    new THREE.SphereGeometry(4.4, 20, 20),
  );
  balloonEnvelopeGeo.scale(1, 1.28, 1);
  const balloonBasketGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.1, 0.9, 1.4, 10),
  );
  balloonBasketGeo.translate(0, -7.0, 0);
  const balloonEnv = new THREE.Mesh(balloonEnvelopeGeo, coralPinkMat);
  const balloonBasket = new THREE.Mesh(balloonBasketGeo, goldMat);
  balloonGroup.add(balloonEnv, balloonBasket);

  // ============================================================================
  // 5. NORTH (0, +74): AURORA LAKE, ISLAND CASTLE & COZY RETREAT TERRACE (PAGE 9)
  // ============================================================================
  const auroraGroup = new THREE.Group();
  auroraGroup.position.set(0, 0, 74);
  group.add(auroraGroup);

  const iceCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#cffafe'),
      emissive: new THREE.Color('#22d3ee'),
      emissiveIntensity: 1.35,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    }),
  );

  // Crystalline Island Castle Sanctuary rising from Crescent Lake (Page 9!)
  const crystalSpireConfigs = [
    { x: 0, z: 0, r: 2.5, h: 19, mat: iceCrystalMat },
    { x: -3.4, z: 1.2, r: 1.7, h: 13.5, mat: violetRuneGlowMat },
    { x: 3.4, z: 1.2, r: 1.7, h: 14.0, mat: iceCrystalMat },
    { x: -1.9, z: -2.0, r: 1.4, h: 10.0, mat: warmWindowGlowMat },
    { x: 1.9, z: -2.0, r: 1.4, h: 10.0, mat: warmWindowGlowMat },
  ];

  crystalSpireConfigs.forEach((c) => {
    const sGeo = tracker.trackGeo(new THREE.ConeGeometry(c.r, c.h, 6));
    sGeo.translate(c.x, c.h / 2, c.z);
    const sMesh = new THREE.Mesh(sGeo, c.mat);
    auroraGroup.add(sMesh);
  });

  // Cozy Stone Viewing Terrace with Two Lounge Chairs & Warm Table Lantern on the South Shore (Page 9!)
  const terraceY = getTerrainHeight(4.5, 53.5);
  const terraceGroup = new THREE.Group();
  terraceGroup.position.set(4.5, terraceY, 53.5);
  group.add(terraceGroup);

  const terracePadGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(2.6, 2.8, 0.25, 16),
  );
  terracePadGeo.translate(0, 0.125, 0);
  const chairGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.55, 0.48, 0.75, 10),
  );
  chairGeo.translate(0, 0.5, 0);
  const terracePad = new THREE.Mesh(terracePadGeo, mats.warmSandstone);
  const chairL = new THREE.Mesh(chairGeo, mats.creamStone);
  chairL.position.set(-0.95, 0, -0.2);
  const chairR = new THREE.Mesh(chairGeo, mats.creamStone);
  chairR.position.set(0.95, 0, -0.2);
  const tableLantern = new THREE.Mesh(lanternGlobeGeo, warmWindowGlowMat);
  tableLantern.position.set(0, 0.85, 0.2);
  terraceGroup.add(terracePad, chairL, chairR, tableLantern);

  // Sculpted Luminous Cyan-Emerald Aurora Heart floating in the Northern Sky (Page 9!)
  const auroraHeartPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(a), 3) * 0.72;
    const hy =
      (13 * Math.cos(a) -
        5 * Math.cos(2 * a) -
        2 * Math.cos(3 * a) -
        Math.cos(4 * a)) *
      0.72;
    auroraHeartPts.push(new THREE.Vector3(hx, hy + 25, 10));
  }
  const auroraHeartCurve = new THREE.CatmullRomCurve3(auroraHeartPts, true);
  const auroraHeartGeo = tracker.trackGeo(
    new THREE.TubeGeometry(auroraHeartCurve, 96, 0.48, 10, true),
  );
  const auroraHeartMesh = new THREE.Mesh(auroraHeartGeo, cyanGlowMat);
  auroraGroup.add(auroraHeartMesh);

  // Shimmering Aurora Borealis Sky Curtain
  const auroraCurtainGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(
      55,
      55,
      28,
      48,
      1,
      true,
      -Math.PI * 0.35,
      Math.PI * 0.7,
    ),
  );
  const auroraCurtainMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.x += sin(uv.x * 12.0 + uTime * 0.6) * 2.5;
          pos.z += cos(uv.x * 9.0 - uTime * 0.5) * 2.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float verticalFade = sin(vUv.y * 3.14159);
          float edgeFade = sin(vUv.x * 3.14159);
          float curtainWave = sin(vUv.x * 28.0 + uTime * 1.1) * 0.5 + 0.5;
          vec3 colA = vec3(0.15, 0.92, 0.75);
          vec3 colB = vec3(0.65, 0.35, 0.98);
          vec3 col = mix(colA, colB, sin(vUv.x * 6.28 + uTime * 0.3) * 0.5 + 0.5);
          float alpha = verticalFade * verticalFade * edgeFade * (0.18 + 0.15 * curtainWave);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );
  const auroraCurtainMesh = new THREE.Mesh(auroraCurtainGeo, auroraCurtainMat);
  auroraCurtainMesh.position.set(0, 48, 36);
  auroraCurtainMesh.rotation.y = Math.PI;
  auroraGroup.add(auroraCurtainMesh);

  // ============================================================================
  // 6. FAR SOUTH TIP (0, -112): THE SPECIAL GATE (PAGE 10 OF PDF)
  // (Note: The Romantic Midway at (0, -65) is now built by CarnivalDistrict.ts)
  // ============================================================================
  // Twin Inward-Curving Dark-Bronze & Gold Horn Threshold Arch with Open Wrought-Iron Gates!
  const specialGateGroup = new THREE.Group();
  const gateTipY = getTerrainHeight(0, -112);
  specialGateGroup.position.set(0, gateTipY, -112);
  group.add(specialGateGroup);
  colliders.push(
    { x: -5.8, z: -112, radius: 2.4 },
    { x: 5.8, z: -112, radius: 2.4 },
  );

  const hornCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.8, 0, 0),
    new THREE.Vector3(-5.4, 6.8, 0),
    new THREE.Vector3(-3.9, 13.0, 0),
    new THREE.Vector3(-0.75, 14.5, 0),
  ]);
  const hornCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.8, 0, 0),
    new THREE.Vector3(5.4, 6.8, 0),
    new THREE.Vector3(3.9, 13.0, 0),
    new THREE.Vector3(0.75, 14.5, 0),
  ]);
  const hornGeoL = tracker.trackGeo(
    new THREE.TubeGeometry(hornCurveL, 36, 0.72, 12, false),
  );
  const hornGeoR = tracker.trackGeo(
    new THREE.TubeGeometry(hornCurveR, 36, 0.72, 12, false),
  );
  const hornSeamGeoL = tracker.trackGeo(
    new THREE.TubeGeometry(hornCurveL, 36, 0.22, 8, false),
  );
  const hornSeamGeoR = tracker.trackGeo(
    new THREE.TubeGeometry(hornCurveR, 36, 0.22, 8, false),
  );

  const hornL = new THREE.Mesh(hornGeoL, mats.wroughtBronze);
  const hornR = new THREE.Mesh(hornGeoR, mats.wroughtBronze);
  const seamL = new THREE.Mesh(hornSeamGeoL, warmWindowGlowMat);
  seamL.position.z = 0.56;
  const seamR = new THREE.Mesh(hornSeamGeoR, warmWindowGlowMat);
  seamR.position.z = 0.56;
  specialGateGroup.add(hornL, hornR, seamL, seamR);

  // Swung-Open Wrought-Iron Filigree Gate Doors & Glowing Crimson Heart Crest
  const doorGeo = tracker.trackGeo(new THREE.BoxGeometry(2.8, 9.5, 0.18));
  doorGeo.translate(1.4, 4.75, 0);
  const doorL = new THREE.Mesh(doorGeo, mats.wroughtBronze);
  doorL.position.set(-4.2, 0, 0);
  doorL.rotation.y = 0.65;
  const doorR = new THREE.Mesh(doorGeo, mats.wroughtBronze);
  doorR.position.set(4.2, 0, 0);
  doorR.rotation.y = Math.PI - 0.65;

  const gateHeartMesh = new THREE.Mesh(heartEmblemGeo, crimsonHeartMat);
  gateHeartMesh.scale.setScalar(1.65);
  gateHeartMesh.position.set(0, 15.6, 0);
  specialGateGroup.add(doorL, doorR, gateHeartMesh);

  return {
    group,
    colliders,
    update(elapsedTime: number) {
      // 0. Advance breeze-sway on Boulevard Entrance Framing Trees
      gatewayWindUniforms.uTime.value = elapsedTime;

      // 1. Gently bob floating magic lanterns & rotate arcane ring in NW Ancient Realm
      floatingLanternsGroup.position.y = Math.sin(elapsedTime * 1.4) * 0.45;
      floatingLanternsGroup.rotation.y = elapsedTime * 0.08;
      arcaneRing2.rotation.z = elapsedTime * 0.25;

      // 2. Slowly swing the yellow Brick Construction Crane jib in West Brick Valley
      cranePivot.rotation.y = Math.sin(elapsedTime * 0.45) * 0.35;

      // 3. Rotate the Golden Armillary Star-Sphere & advance the 4-Car Coaster Train in NE Thrill Zone
      armRing1.rotation.y = elapsedTime * 0.5;
      armRing2.rotation.z = -elapsedTime * 0.65;
      for (let c = 0; c < coasterCars.length; c++) {
        const t = (elapsedTime * 0.065 - c * 0.018 + 1.0) % 1.0;
        const pos = coasterCurve.getPointAt(t);
        const tangent = coasterCurve.getTangentAt(t);
        coasterCars[c].position.copy(pos);
        coasterCars[c].position.y += 0.75;
        coasterCars[c].lookAt(pos.clone().add(tangent));
      }

      // 4. Gently bob the Pastel Hot-Air Balloon above East Fashion World
      balloonGroup.position.y = 26 + Math.sin(elapsedTime * 0.95) * 1.2;
      balloonGroup.rotation.y = elapsedTime * 0.15;

      // 5. Shimmer the Northern Aurora Lake Sky Curtain & pulse the Aurora Heart
      auroraCurtainMat.uniforms.uTime.value = elapsedTime;
      auroraHeartMesh.position.y = Math.sin(elapsedTime * 1.2) * 0.4;
    },
    dispose() {
      tracker.dispose();
    },
  };
}
