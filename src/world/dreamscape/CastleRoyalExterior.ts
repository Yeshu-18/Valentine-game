import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { DreamCastleMaterials } from './CastleMaterials';

export interface CastleRoyalExteriorBundle {
  group: THREE.Group;
  windowGlowMats: {
    warmIvory: THREE.MeshStandardMaterial;
    softPink: THREE.MeshStandardMaterial;
    pastelLavender: THREE.MeshStandardMaterial;
  };
  update: (delta: number, elapsedTime: number, awakeningFactor: number) => void;
}

/**
 * Builds a smooth parametric 2D Heart Shape centered at (0, 0) for 3D extrusion.
 */
function createRoyalHeartShape(scale = 1.0, elongated = 1.08): THREE.Shape {
  const s = new THREE.Shape();
  // Start at bottom point
  s.moveTo(0, -1.32 * scale * elongated);
  // Right lower curve up to right lobe
  s.bezierCurveTo(
    0.68 * scale,
    -0.82 * scale * elongated,
    1.42 * scale,
    -0.12 * scale * elongated,
    1.42 * scale,
    0.52 * scale,
  );
  // Right upper lobe
  s.bezierCurveTo(
    1.42 * scale,
    1.08 * scale,
    0.92 * scale,
    1.38 * scale,
    0.48 * scale,
    1.38 * scale,
  );
  // Dip into top center cleft
  s.bezierCurveTo(
    0.2 * scale,
    1.38 * scale,
    0.05 * scale,
    1.16 * scale,
    0,
    0.96 * scale,
  );
  // Left upper lobe from top center cleft
  s.bezierCurveTo(
    -0.05 * scale,
    1.16 * scale,
    -0.2 * scale,
    1.38 * scale,
    -0.48 * scale,
    1.38 * scale,
  );
  s.bezierCurveTo(
    -0.92 * scale,
    1.38 * scale,
    -1.42 * scale,
    1.08 * scale,
    -1.42 * scale,
    0.52 * scale,
  );
  // Left lower curve back to bottom point
  s.bezierCurveTo(
    -1.42 * scale,
    -0.12 * scale * elongated,
    -0.68 * scale,
    -0.82 * scale * elongated,
    0,
    -1.32 * scale * elongated,
  );
  return s;
}

/**
 * Builds a heart-with-hole bezel shape for the sculpted Champagne-Gold structural frame around the HARSHA heart.
 */
function createRoyalHeartFrameShape(outerScale: number, innerScale: number, elongated = 1.08): THREE.Shape {
  const outer = createRoyalHeartShape(outerScale, elongated);
  const innerHole = new THREE.Path();
  innerHole.moveTo(0, -1.32 * innerScale * elongated);
  innerHole.bezierCurveTo(
    0.68 * innerScale,
    -0.82 * innerScale * elongated,
    1.42 * innerScale,
    -0.12 * innerScale * elongated,
    1.42 * innerScale,
    0.52 * innerScale,
  );
  innerHole.bezierCurveTo(
    1.42 * innerScale,
    1.08 * innerScale,
    0.92 * innerScale,
    1.38 * innerScale,
    0.48 * innerScale,
    1.38 * innerScale,
  );
  innerHole.bezierCurveTo(
    0.2 * innerScale,
    1.38 * innerScale,
    0.05 * innerScale,
    1.16 * innerScale,
    0,
    0.96 * innerScale,
  );
  innerHole.bezierCurveTo(
    -0.05 * innerScale,
    1.16 * innerScale,
    -0.2 * innerScale,
    1.38 * innerScale,
    -0.48 * innerScale,
    1.38 * innerScale,
  );
  innerHole.bezierCurveTo(
    -0.92 * innerScale,
    1.38 * innerScale,
    -1.42 * innerScale,
    1.08 * innerScale,
    -1.42 * innerScale,
    0.52 * innerScale,
  );
  innerHole.bezierCurveTo(
    -1.42 * innerScale,
    -0.12 * innerScale * elongated,
    -0.68 * innerScale,
    -0.82 * innerScale * elongated,
    0,
    -1.32 * innerScale * elongated,
  );
  outer.holes.push(innerHole);
  return outer;
}

/**
 * Creates 3D extruded geometric capital letters for the physical 'HARSHA' engraving
 * embedded on the front crystal face of the Central Royal Heart.
 * Each letter is constructed from crisp 3D boxes/cylinders/arches in local letter space
 * so it has genuine 3D bevelled depth, catches directional/point light, and is 100% readable from the Hero Camera.
 */
function build3DEngravedHarshaWord(
  tracker: ResourceTracker,
  goldFaceMat: THREE.Material,
  goldBevelMat: THREE.Material,
): THREE.Group {
  const wordGroup = new THREE.Group();
  wordGroup.name = 'Harsha3DEngraving';

  const strokeW = 0.135;
  const letterH = 0.88;
  const depth = 0.18;
  const serifW = 0.22;
  const serifH = 0.055;

  const vBarGeo = tracker.trackGeo(new THREE.BoxGeometry(strokeW, letterH, depth));
  const vBarBackGeo = tracker.trackGeo(
    new THREE.BoxGeometry(strokeW + 0.035, letterH + 0.035, depth * 0.65),
  );
  const serifGeo = tracker.trackGeo(new THREE.BoxGeometry(serifW, serifH, depth * 1.05));

  const addBarWithBevel = (
    parent: THREE.Group,
    w: number,
    h: number,
    x: number,
    y: number,
    rotZ = 0,
  ) => {
    const fg = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w, h, depth)),
      goldFaceMat,
    );
    fg.position.set(x, y, 0.02);
    fg.rotation.z = rotZ;
    const bg = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(w + 0.036, h + 0.036, depth * 0.72)),
      goldBevelMat,
    );
    bg.position.set(x, y, -0.015);
    bg.rotation.z = rotZ;
    parent.add(bg, fg);
  };

  const addSerif = (parent: THREE.Group, x: number, y: number) => {
    const s = new THREE.Mesh(serifGeo, goldFaceMat);
    s.position.set(x, y, 0.02);
    parent.add(s);
  };

  const buildLetterH = (): THREE.Group => {
    const g = new THREE.Group();
    const left = new THREE.Mesh(vBarGeo, goldFaceMat);
    left.position.set(-0.24, 0, 0.02);
    const leftB = new THREE.Mesh(vBarBackGeo, goldBevelMat);
    leftB.position.set(-0.24, 0, -0.015);

    const right = new THREE.Mesh(vBarGeo, goldFaceMat);
    right.position.set(0.24, 0, 0.02);
    const rightB = new THREE.Mesh(vBarBackGeo, goldBevelMat);
    rightB.position.set(0.24, 0, -0.015);

    g.add(leftB, left, rightB, right);
    addBarWithBevel(g, 0.48, strokeW * 0.88, 0, 0.02);
    addSerif(g, -0.24, letterH * 0.5);
    addSerif(g, -0.24, -letterH * 0.5);
    addSerif(g, 0.24, letterH * 0.5);
    addSerif(g, 0.24, -letterH * 0.5);
    return g;
  };

  const buildLetterA = (): THREE.Group => {
    const g = new THREE.Group();
    addBarWithBevel(g, strokeW * 0.95, letterH * 1.02, -0.14, 0, -0.26);
    addBarWithBevel(g, strokeW * 0.95, letterH * 1.02, 0.14, 0, 0.26);
    addBarWithBevel(g, 0.34, strokeW * 0.82, 0, -0.1);
    addSerif(g, 0, letterH * 0.5);
    addSerif(g, -0.26, -letterH * 0.5);
    addSerif(g, 0.26, -letterH * 0.5);
    return g;
  };

  const buildLetterR = (): THREE.Group => {
    const g = new THREE.Group();
    const left = new THREE.Mesh(vBarGeo, goldFaceMat);
    left.position.set(-0.22, 0, 0.02);
    const leftB = new THREE.Mesh(vBarBackGeo, goldBevelMat);
    leftB.position.set(-0.22, 0, -0.015);
    g.add(leftB, left);

    // Upper bowl of R
    addBarWithBevel(g, 0.32, strokeW * 0.84, -0.06, letterH * 0.43);
    addBarWithBevel(g, 0.32, strokeW * 0.84, -0.06, 0.04);
    const loopArchGeo = tracker.trackGeo(
      new THREE.TorusGeometry(0.195, strokeW * 0.46, 10, 20, Math.PI),
    );
    loopArchGeo.rotateZ(-Math.PI / 2);
    const loopArch = new THREE.Mesh(loopArchGeo, goldFaceMat);
    loopArch.position.set(0.08, 0.235, 0.02);
    loopArch.scale.set(1.0, 1.0, 1.35);
    g.add(loopArch);

    // Diagonal leg of R
    addBarWithBevel(g, strokeW * 0.92, letterH * 0.54, 0.12, -0.21, 0.46);
    addSerif(g, -0.22, letterH * 0.5);
    addSerif(g, -0.22, -letterH * 0.5);
    addSerif(g, 0.24, -letterH * 0.5);
    return g;
  };

  const buildLetterS = (): THREE.Group => {
    const g = new THREE.Group();
    const sPts = [
      new THREE.Vector3(0.2, 0.34, 0.02),
      new THREE.Vector3(0.02, 0.43, 0.02),
      new THREE.Vector3(-0.21, 0.31, 0.02),
      new THREE.Vector3(-0.18, 0.11, 0.02),
      new THREE.Vector3(0.0, 0.01, 0.02),
      new THREE.Vector3(0.21, -0.11, 0.02),
      new THREE.Vector3(0.22, -0.31, 0.02),
      new THREE.Vector3(0.0, -0.43, 0.02),
      new THREE.Vector3(-0.22, -0.33, 0.02),
    ];
    const sCurve = new THREE.CatmullRomCurve3(sPts);
    const sTubeGeo = tracker.trackGeo(new THREE.TubeGeometry(sCurve, 32, strokeW * 0.52, 10, false));
    sTubeGeo.scale(1.0, 1.0, 1.25);
    const sBackGeo = tracker.trackGeo(new THREE.TubeGeometry(sCurve, 28, strokeW * 0.64, 10, false));
    const sBack = new THREE.Mesh(sBackGeo, goldBevelMat);
    sBack.position.z = -0.025;
    const sFront = new THREE.Mesh(sTubeGeo, goldFaceMat);
    g.add(sBack, sFront);
    addSerif(g, 0.2, 0.36);
    addSerif(g, -0.21, -0.35);
    return g;
  };

  const builders = [
    buildLetterH,
    buildLetterA,
    buildLetterR,
    buildLetterS,
    buildLetterH,
    buildLetterA,
  ];
  const xPositions = [-1.85, -1.11, -0.37, 0.37, 1.11, 1.85];

  builders.forEach((fn, idx) => {
    const letterGrp = fn();
    letterGrp.position.set(xPositions[idx], 0, 0);
    wordGroup.add(letterGrp);
  });

  return wordGroup;
}

/**
 * Creates a high-resolution un-mirrored royal luminous relief texture backing the 3D 'HARSHA' engraving
 * inside the Central Heart so the name is razor-sharp at both close and far camera distances.
 */
function createHarshaHeartEngravingBackingTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1024, 512);

    // Subtle soft rose-crystal & pearl inner cartouche glow
    const rad = ctx.createRadialGradient(512, 256, 24, 512, 256, 460);
    rad.addColorStop(0.0, 'rgba(255, 241, 242, 0.42)');
    rad.addColorStop(0.55, 'rgba(244, 114, 182, 0.22)');
    rad.addColorStop(1.0, 'rgba(244, 114, 182, 0.0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 1024, 512);

    // Delicate champagne-gold filigreeflourishes above and below HARSHA
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(220, 118);
    ctx.quadraticCurveTo(512, 82, 804, 118);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(240, 396);
    ctx.quadraticCurveTo(512, 430, 784, 396);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Subtle royal crown icon above name
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('♕', 512, 84);

    // Crisp engraved drop shadow + luminous gold-ivory serif lettering
    ctx.save();
    ctx.shadowColor = 'rgba(157, 23, 77, 0.92)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.font = 'bold 148px Georgia, "Times New Roman", serif';
    ctx.strokeText('H A R S H A', 512, 258);
    ctx.fillText('H A R S H A', 512, 258);
    ctx.restore();

    ctx.fillStyle = '#fde68a';
    ctx.font = 'italic 30px Georgia, serif';
    ctx.fillText('✦   ♡   ✦', 512, 424);
  }
  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Constructs the complete HARsha Royal Dream Castle Exterior enhancements:
 * - Section 2: Central HARSHA Heart (sculpted rose-pink crystal, gold frame, physical 3D HARSHA engraving, living glow)
 * - Section 3 & 4: Layered Royal Dream Palace Roof Silhouette (Level 1 Wing Mansards, Level 2 Elevated Central Palace Roof, Level 3 Crown)
 * - Section 5: Symmetrical Main Towers Architectural Layering (plinth base, fluted ribs, ornamental mid-ring, upper crown balcony, ribbed roof)
 * - Section 6 & 7: Central Royal Entrance & Central Balcony + Grand Arched Window visual hierarchy
 * - Section 8 & 9: Royal Arched Windows with varied warm ivory / pink / lavender emission & Pastel Royal Palette
 * - Section 10 & 11: Colourful Ambient Lighting & Romantic Entrance Floral Arrangements
 */
export function createCastleRoyalExterior(
  tracker: ResourceTracker,
  mats: DreamCastleMaterials,
  sampleLocalGroundY: (lx: number, lz: number) => number,
): CastleRoyalExteriorBundle {
  const group = new THREE.Group();
  group.name = 'HarshaRoyalCastleExterior';

  // ==========================================================================
  // 1. ROYAL PASTEL & CRYSTAL MATERIAL PALETTE (Section 9)
  // ==========================================================================
  const royalPearlIvoryMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fcfaf7'),
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.28,
      clearcoatRoughness: 0.2,
    }),
  );

  const royalWarmCreamMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#faf3e8'),
      roughness: 0.42,
      metalness: 0.04,
    }),
  );

  const royalBlushPinkMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.1,
      roughness: 0.28,
      metalness: 0.06,
      clearcoat: 0.42,
      clearcoatRoughness: 0.18,
    }),
  );

  const royalPaleRoseMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f9a8d4'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.14,
      roughness: 0.24,
      metalness: 0.08,
      clearcoat: 0.5,
    }),
  );

  const royalPastelLavenderMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e9d5ff'),
      emissive: new THREE.Color('#a855f7'),
      emissiveIntensity: 0.12,
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.38,
    }),
  );

  const royalPowderBlueMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.1,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.4,
    }),
  );

  const royalChampagneGoldMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e6c268'),
      emissive: new THREE.Color('#92400e'),
      emissiveIntensity: 0.18,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 0.65,
      clearcoatRoughness: 0.14,
    }),
  );

  // Translucent Rose-Pink Crystal for the Central HARSHA Heart
  const harshaHeartCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f472b6'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.72,
      roughness: 0.1,
      metalness: 0.08,
      transmission: 0.64,
      ior: 1.52,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.94,
    }),
  );

  // Inner Pearl-Rose Faceted Core inside the HARSHA Heart
  const harshaHeartInnerCoreMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff1f2'),
      emissive: new THREE.Color('#fb7185'),
      emissiveIntensity: 0.95,
      roughness: 0.08,
      metalness: 0.12,
      clearcoat: 0.95,
      transparent: true,
      opacity: 0.88,
    }),
  );

  // Travelling Highlight Band Material across the HARSHA Crystal Heart
  const harshaHeartSweepHighlightMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fffdf9'),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    }),
  );

  // Luminous Champagne-Gold for the physical 3D 'HARSHA' Engraving
  const harshaEngravingFaceMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fef9c3'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 1.05,
      metalness: 0.78,
      roughness: 0.14,
      clearcoat: 0.92,
    }),
  );

  const harshaEngravingBevelMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b45309'),
      emissive: new THREE.Color('#78350f'),
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.2,
    }),
  );

  const lavenderCrystalMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d8b4fe'),
      emissive: new THREE.Color('#9333ea'),
      emissiveIntensity: 0.48,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.58,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.88,
    }),
  );

  const cyanCrystalFinialMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#a5f3fc'),
      emissive: new THREE.Color('#06b6d4'),
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.65,
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.95,
    }),
  );

  // Varied Window Emission Materials (Section 8: warm ivory, soft pink, pastel lavender)
  const winGlowWarmIvory = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef9c3'),
      emissive: new THREE.Color('#fbbf24'),
      emissiveIntensity: 0.85,
      roughness: 0.18,
    }),
  );

  const winGlowSoftPink = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fce7f3'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.82,
      roughness: 0.18,
    }),
  );

  const winGlowPastelLavender = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f3e8ff'),
      emissive: new THREE.Color('#c084fc'),
      emissiveIntensity: 0.8,
      roughness: 0.18,
    }),
  );

  // ==========================================================================
  // 2. LAYERED ROYAL PALACE ROOF SILHOUETTE (Sections 3 & 4)
  //    Level 1: Main Palace Wing Roofs (West & East Front/Side Mansards)
  //    Level 2: Central Elevated Royal Roof Pavilion (lx = -6.8..+6.8, y = 16.0..24.5m)
  //    Level 3: Central HARSHA Heart & 3-Point Royal Crown (lx = 0, y = 23.0..34.2m)
  // ==========================================================================
  const roofSilhouetteGroup = new THREE.Group();
  roofSilhouetteGroup.name = 'LayeredRoyalRoofSilhouette';
  group.add(roofSilhouetteGroup);

  // --- 2A. Level 1: Main Palace Wing Mansard Roofs & Ornamental Cresting (y = 15.8m..19.8m) ---
  // Positioned along the Left Front Wing (lx = -12.6..-6.4) and Right Front Wing (lx = +6.4..+12.6)
  // Leaving the central bay (lx = -6.4..+6.4) open for the Level 2 Elevated Central Palace Pavilion
  // and preserving 100% open viewing clearance for the Floor 4 Telescope at (lx = 0, y = 15.25, lz = -13.5)!
  const wingMansardSlopeGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.45, 2.15, 5.8, 4, 1));
  wingMansardSlopeGeo.rotateY(Math.PI / 4);
  wingMansardSlopeGeo.rotateZ(Math.PI / 2);

  const wingCrestRailGeo = tracker.trackGeo(new THREE.BoxGeometry(5.6, 0.14, 0.14));
  const wingDormerArchGeo = tracker.trackGeo(new THREE.TorusGeometry(0.68, 0.08, 8, 18, Math.PI));
  const wingDormerPaneGeo = tracker.trackGeo(new THREE.CircleGeometry(0.66, 16));
  const wingFinialSpikeGeo = tracker.trackGeo(new THREE.ConeGeometry(0.14, 0.95, 6));
  wingFinialSpikeGeo.translate(0, 0.475, 0);
  const wingFinialGemGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.18, 0));

  [-9.6, 9.6].forEach((wingX, wIdx) => {
    const wingGrp = new THREE.Group();
    wingGrp.position.set(wingX, 16.85, -15.85);

    const mansardBody = new THREE.Mesh(
      wingMansardSlopeGeo,
      wIdx === 0 ? royalBlushPinkMat : royalPastelLavenderMat,
    );
    mansardBody.scale.set(1.0, 1.15, 0.72);
    mansardBody.castShadow = true;
    mansardBody.receiveShadow = true;

    const lowerGoldCornice = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(6.3, 0.28, 2.4)),
      royalChampagneGoldMat,
    );
    lowerGoldCornice.position.set(0, -0.95, 0);

    const upperGoldCrest = new THREE.Mesh(wingCrestRailGeo, royalChampagneGoldMat);
    upperGoldCrest.position.set(0, 1.18, 0);

    wingGrp.add(mansardBody, lowerGoldCornice, upperGoldCrest);

    // Front Dormer Window with Heart Finial on each Level 1 Wing Roof
    const dormerArch = new THREE.Mesh(wingDormerArchGeo, royalChampagneGoldMat);
    dormerArch.position.set(0, 0.15, -1.02);
    const dormerPane = new THREE.Mesh(
      wingDormerPaneGeo,
      wIdx === 0 ? winGlowSoftPink : winGlowPastelLavender,
    );
    dormerPane.position.set(0, 0.15, -0.98);
    dormerPane.rotation.y = Math.PI;
    wingGrp.add(dormerArch, dormerPane);

    // Decorative gold cresting spikes along the Level 1 wing ridge
    for (let k = -2; k <= 2; k++) {
      const sp = new THREE.Mesh(wingFinialSpikeGeo, royalChampagneGoldMat);
      sp.position.set(k * 1.15, 1.22, 0);
      const gm = new THREE.Mesh(
        wingFinialGemGeo,
        k === 0 ? cyanCrystalFinialMat : harshaHeartCrystalMat,
      );
      gm.position.set(k * 1.15, 2.24, 0);
      wingGrp.add(sp, gm);
    }

    roofSilhouetteGroup.add(wingGrp);
  });

  // Side & Rear Level 1 Mansard Cornice Trim so the entire castle perimeter has a cohesive royal roofline
  [-11.0, 0.0, 11.0].forEach((sideZ, sIdx) => {
    [-16.0, 16.0].forEach((sideX) => {
      const sideGable = new THREE.Group();
      sideGable.position.set(sideX, 16.35, sideZ);
      sideGable.rotation.y = sideX < 0 ? -Math.PI / 2 : Math.PI / 2;
      const arch = new THREE.Mesh(wingDormerArchGeo, royalChampagneGoldMat);
      const pane = new THREE.Mesh(
        wingDormerPaneGeo,
        sIdx % 2 === 0 ? winGlowWarmIvory : winGlowSoftPink,
      );
      pane.position.z = 0.02;
      const spike = new THREE.Mesh(wingFinialSpikeGeo, royalChampagneGoldMat);
      spike.position.y = 0.72;
      sideGable.add(arch, pane, spike);
      roofSilhouetteGroup.add(sideGable);
    });
  });

  // --- 2B. Level 2: Central Elevated Royal Palace Roof & Triumphal Colonnade (y = 15.25m..24.8m) ---
  // Rises dramatically above the central entrance & balcony, framing the Floor 4 Telescope with a
  // 5.4m-wide open Triumphal Arch (y = 15.25..20.8m) and sweeping upward into a curved royal pavilion roof!
  const centralPalaceCrownGroup = new THREE.Group();
  centralPalaceCrownGroup.name = 'Level2CentralElevatedPalace';
  centralPalaceCrownGroup.position.set(0, 0, -16.15);
  roofSilhouetteGroup.add(centralPalaceCrownGroup);

  const centralPierGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.34, 0.42, 6.2, 14));
  centralPierGeo.translate(0, 3.1, 0);
  const centralPierBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(1.05, 0.55, 1.05));
  centralPierBaseGeo.translate(0, 0.275, 0);
  const centralPierCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.54, 0.36, 0.48, 14));
  centralPierCapGeo.translate(0, 6.25, 0);

  // Four grand piers at lx = -5.5, -2.9, +2.9, +5.5 (leaving lx = -2.5..+2.5 completely open for the telescope!)
  [-5.5, -2.9, 2.9, 5.5].forEach((px) => {
    const pierBase = new THREE.Mesh(centralPierBaseGeo, royalPearlIvoryMat);
    pierBase.position.set(px, 15.25, 0);
    const pierShaft = new THREE.Mesh(centralPierGeo, royalPearlIvoryMat);
    pierShaft.position.set(px, 15.25, 0);
    pierShaft.castShadow = true;
    const pierCap = new THREE.Mesh(centralPierCapGeo, royalChampagneGoldMat);
    pierCap.position.set(px, 15.25, 0);

    // Gold vertical fluting rings on each pier
    [16.8, 18.4, 20.0].forEach((ry) => {
      const ring = new THREE.Mesh(
        tracker.trackGeo(new THREE.TorusGeometry(0.39, 0.045, 8, 18)).rotateX(Math.PI / 2),
        royalChampagneGoldMat,
      );
      ring.position.set(px, ry, 0);
      centralPalaceCrownGroup.add(ring);
    });

    centralPalaceCrownGroup.add(pierBase, pierShaft, pierCap);
  });

  // Grand Triumphal Arch spanning lx = -2.9..+2.9 at y = 21.4m
  const triumphalOuterArchGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.9, 0.26, 12, 36, Math.PI),
  );
  const triumphalInnerArchGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.65, 0.11, 10, 32, Math.PI),
  );
  const triumphalOuterArch = new THREE.Mesh(triumphalOuterArchGeo, royalPearlIvoryMat);
  triumphalOuterArch.position.set(0, 21.2, 0);
  const triumphalGoldArch = new THREE.Mesh(triumphalInnerArchGeo, royalChampagneGoldMat);
  triumphalGoldArch.position.set(0, 21.2, -0.18);
  centralPalaceCrownGroup.add(triumphalOuterArch, triumphalGoldArch);

  // Side Arches spanning (-5.5..-2.9) and (+2.9..+5.5) with translucent lavender/rose crystal tracery
  [-4.2, 4.2].forEach((sx, sIdx) => {
    const sideArch = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(1.3, 0.16, 10, 24, Math.PI)),
      royalChampagneGoldMat,
    );
    sideArch.position.set(sx, 21.2, -0.08);
    const sideCrystalFan = new THREE.Mesh(
      tracker.trackGeo(new THREE.CircleGeometry(1.22, 20, 0, Math.PI)),
      sIdx === 0 ? lavenderCrystalMat : harshaHeartCrystalMat,
    );
    sideCrystalFan.position.set(sx, 21.2, -0.05);
    sideCrystalFan.rotation.y = Math.PI;
    centralPalaceCrownGroup.add(sideArch, sideCrystalFan);
  });

  // Level 2 Entablature & Sweeping Imperial Pavilion Roof (y = 21.5m..25.4m)
  // Visually steps upward toward the central axis to support the Level 3 HARSHA Heart!
  const level2Entablature = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(12.4, 0.65, 1.85)),
    royalPearlIvoryMat,
  );
  level2Entablature.position.set(0, 21.85, 0);

  const level2GoldFrieze = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(12.6, 0.22, 2.02)),
    royalChampagneGoldMat,
  );
  level2GoldFrieze.position.set(0, 22.24, 0);
  centralPalaceCrownGroup.add(level2Entablature, level2GoldFrieze);

  // Stepped Imperial Mansard Dome / Tiered Roof rising from y = 22.3m to y = 25.4m
  const imperialRoofLowerGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.8, 5.9, 2.4, 8));
  imperialRoofLowerGeo.rotateY(Math.PI / 8);
  imperialRoofLowerGeo.scale(1.18, 1.0, 0.36);
  const imperialRoofLower = new THREE.Mesh(imperialRoofLowerGeo, royalBlushPinkMat);
  imperialRoofLower.position.set(0, 23.45, 0);
  imperialRoofLower.castShadow = true;

  const imperialRoofMidRing = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(8.6, 0.26, 1.68)),
    royalChampagneGoldMat,
  );
  imperialRoofMidRing.position.set(0, 24.68, 0);

  const imperialRoofUpperGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.35, 3.85, 1.75, 8));
  imperialRoofUpperGeo.rotateY(Math.PI / 8);
  imperialRoofUpperGeo.scale(1.15, 1.0, 0.38);
  const imperialRoofUpper = new THREE.Mesh(imperialRoofUpperGeo, royalPastelLavenderMat);
  imperialRoofUpper.position.set(0, 25.6, 0);
  imperialRoofUpper.castShadow = true;

  centralPalaceCrownGroup.add(imperialRoofLower, imperialRoofMidRing, imperialRoofUpper);

  // Sweeping Golden Flying Buttress Scrolls on Left & Right of Level 2 Roof pointing toward the HARSHA Heart
  [-1, 1].forEach((side) => {
    const scrollCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 5.8, 22.3, -0.35),
      new THREE.Vector3(side * 4.6, 23.6, -0.45),
      new THREE.Vector3(side * 3.5, 25.2, -0.52),
      new THREE.Vector3(side * 2.55, 26.8, -0.55),
    ]);
    const scrollTube = new THREE.Mesh(
      tracker.trackGeo(new THREE.TubeGeometry(scrollCurve, 24, 0.14, 10, false)),
      royalChampagneGoldMat,
    );
    const pearlRosette = new THREE.Mesh(
      tracker.trackGeo(new THREE.SphereGeometry(0.28, 12, 12)),
      royalPearlIvoryMat,
    );
    pearlRosette.position.set(side * 4.6, 23.6, -0.55);
    const sideCrystalSpire = new THREE.Mesh(
      tracker.trackGeo(new THREE.ConeGeometry(0.24, 1.45, 6)).translate(0, 0.725, 0),
      royalChampagneGoldMat,
    );
    sideCrystalSpire.position.set(side * 5.6, 22.3, -0.4);
    const sideSpireGem = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(0.24, 0)),
      cyanCrystalFinialMat,
    );
    sideSpireGem.position.set(side * 5.6, 23.95, -0.4);
    centralPalaceCrownGroup.add(scrollTube, pearlRosette, sideCrystalSpire, sideSpireGem);
  });

  // ==========================================================================
  // 3. LEVEL 3: THE CENTRAL HARSHA HEART & ROYAL CROWN (Section 2 — Signature Element)
  //    Position: lx = 0, y = 27.6m, lz = -16.65m (integrated into the Central Palace Crown)
  // ==========================================================================
  const harshaHeartCenterpieceGroup = new THREE.Group();
  harshaHeartCenterpieceGroup.name = 'CentralHarshaHeartCenterpiece';
  // Positioned at the apex of the central palace, between the two primary towers
  harshaHeartCenterpieceGroup.position.set(0, 27.65, -16.65);
  // Orient front face (+Z in local group) toward -Z (the Hero Camera & Front Approach)
  // With rotation.y = Math.PI and scale (1, 1, 1), local +X maps to screen-right and local +Z points at the camera!
  harshaHeartCenterpieceGroup.rotation.y = Math.PI;
  group.add(harshaHeartCenterpieceGroup);

  // Architectural Cradle Pedestal beneath the Heart (integrates Heart into the Level 2 roof)
  const heartCradleBase = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(1.65, 2.45, 1.25, 16)),
    royalPearlIvoryMat,
  );
  heartCradleBase.position.set(0, -2.55, 0);
  const heartCradleGoldCollar = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.75, 0.14, 10, 28)).rotateX(Math.PI / 2),
    royalChampagneGoldMat,
  );
  heartCradleGoldCollar.position.set(0, -1.95, 0);
  harshaHeartCenterpieceGroup.add(heartCradleBase, heartCradleGoldCollar);

  // 3A. Main Sculpted Translucent Rose-Pink Crystal Heart (width ~5.8m, height ~6.2m)
  const mainHeartShape = createRoyalHeartShape(2.05, 1.06);
  const mainHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(mainHeartShape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.24,
      bevelSize: 0.18,
      bevelSegments: 5,
      curveSegments: 28,
    }),
  );
  mainHeartGeo.translate(0, 0, -0.28);
  const mainHeartCrystalMesh = new THREE.Mesh(mainHeartGeo, harshaHeartCrystalMat);
  mainHeartCrystalMesh.castShadow = true;
  harshaHeartCenterpieceGroup.add(mainHeartCrystalMesh);

  // 3B. Inner Faceted Pearl-Rose Crystal Core (layered depth inside the translucent crystal)
  const innerHeartShape = createRoyalHeartShape(1.68, 1.06);
  const innerHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(innerHeartShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.28,
      bevelSize: 0.22,
      bevelSegments: 3,
      curveSegments: 18,
    }),
  );
  innerHeartGeo.translate(0, 0.04, -0.17);
  const innerHeartCoreMesh = new THREE.Mesh(innerHeartGeo, harshaHeartInnerCoreMat);
  harshaHeartCenterpieceGroup.add(innerHeartCoreMesh);

  // 3C. Thin Sculpted Champagne-Gold Structural Frame & Filigree Bezel Around the Heart
  const goldFrameShape = createRoyalHeartFrameShape(2.26, 1.94, 1.06);
  const goldFrameGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(goldFrameShape, {
      depth: 0.68,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.09,
      bevelSegments: 4,
      curveSegments: 28,
    }),
  );
  goldFrameGeo.translate(0, 0, -0.34);
  const goldFrameMesh = new THREE.Mesh(goldFrameGeo, royalChampagneGoldMat);
  harshaHeartCenterpieceGroup.add(goldFrameMesh);

  // Pearl & Crystal Cabochon Studs around the Champagne-Gold Heart Frame
  const framePearlGeo = tracker.trackGeo(new THREE.SphereGeometry(0.12, 10, 10));
  const outlinePts = mainHeartShape.getSpacedPoints(28);
  for (let i = 0; i < outlinePts.length - 1; i++) {
    const pt = outlinePts[i];
    const pearl = new THREE.Mesh(
      framePearlGeo,
      i % 2 === 0 ? royalPearlIvoryMat : cyanCrystalFinialMat,
    );
    pearl.position.set(pt.x * 1.04, pt.y * 1.04, 0.42);
    harshaHeartCenterpieceGroup.add(pearl);
  }

  // 3D. Travelling Crystal Highlight Band (animates smoothly across the crystal heart in update())
  const highlightSweepGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.95, 5.2));
  const highlightSweepMesh = new THREE.Mesh(highlightSweepGeo, harshaHeartSweepHighlightMat);
  highlightSweepMesh.position.set(-2.2, 0.2, 0.54);
  highlightSweepMesh.rotation.z = -0.38;
  harshaHeartCenterpieceGroup.add(highlightSweepMesh);

  // 3E. Physical 3D Engraved 'HARSHA' Inside the Heart (Centered, High-Contrast Luminous Champagne Gold)
  const engravingBackingTex = createHarshaHeartEngravingBackingTexture(tracker);
  const engravingBackingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: engravingBackingTex,
      transparent: true,
      opacity: 0.96,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  // Subtle crystal-recessed relief backing plane at z = +0.49 (on the front surface of the crystal heart)
  const engravingBackingPlane = new THREE.Mesh(
    tracker.trackGeo(new THREE.PlaneGeometry(4.45, 2.22)),
    engravingBackingMat,
  );
  engravingBackingPlane.position.set(0, 0.36, 0.49);
  harshaHeartCenterpieceGroup.add(engravingBackingPlane);

  // Physical 3D Extruded/Sculpted 'HARSHA' Lettering mounted at z = +0.52 on the front face of the heart
  const harsha3DWord = build3DEngravedHarshaWord(
    tracker,
    harshaEngravingFaceMat,
    harshaEngravingBevelMat,
  );
  harsha3DWord.position.set(0, 0.36, 0.52);
  harshaHeartCenterpieceGroup.add(harsha3DWord);

  // Also mount a rear-facing 3D 'HARSHA' engraving on the back of the heart (z = -0.52, rotated Math.PI)
  // so when viewed from the Floor 4 Rooftop Observatory or Rear Garden, it is ALSO un-mirrored and readable!
  const harsha3DWordBack = build3DEngravedHarshaWord(
    tracker,
    harshaEngravingFaceMat,
    harshaEngravingBevelMat,
  );
  harsha3DWordBack.position.set(0, 0.36, -0.52);
  harsha3DWordBack.rotation.y = Math.PI;
  harshaHeartCenterpieceGroup.add(harsha3DWordBack);

  // 3F. Level 3 Royal Crown Feature Above the HARSHA Heart (Three elegant gold points, curved crown frame, crystal finials)
  const heartTopCrownGroup = new THREE.Group();
  heartTopCrownGroup.name = 'HarshaHeartRoyalCrown';
  heartTopCrownGroup.position.set(0, 2.75, 0);
  harshaHeartCenterpieceGroup.add(heartTopCrownGroup);

  // Curved Crown Base Arch cradling the upper lobes of the heart
  const crownBaseBand = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.55, 0.14, 12, 32, Math.PI * 0.85)).rotateZ(Math.PI * 0.075),
    royalChampagneGoldMat,
  );
  crownBaseBand.scale.set(1.35, 0.55, 0.85);
  heartTopCrownGroup.add(crownBaseBand);

  // Three Primary Elegant Gold Crown Points + Two Outer Filigree Scrolls + Crystal Finials
  const crownPointConfigs = [
    { x: 0.0, y: 0.35, h: 2.65, r: 0.28, rotZ: 0.0, isCenter: true },
    { x: -1.35, y: 0.18, h: 2.05, r: 0.22, rotZ: 0.22, isCenter: false },
    { x: 1.35, y: 0.18, h: 2.05, r: 0.22, rotZ: -0.22, isCenter: false },
    { x: -2.35, y: -0.15, h: 1.35, r: 0.16, rotZ: 0.42, isCenter: false },
    { x: 2.35, y: -0.15, h: 1.35, r: 0.16, rotZ: -0.42, isCenter: false },
  ];

  crownPointConfigs.forEach((cp) => {
    const ptGrp = new THREE.Group();
    ptGrp.position.set(cp.x, cp.y, 0);
    ptGrp.rotation.z = cp.rotZ;

    const spireCone = new THREE.Mesh(
      tracker.trackGeo(new THREE.ConeGeometry(cp.r, cp.h, 6)).translate(0, cp.h * 0.5, 0),
      royalChampagneGoldMat,
    );
    const baseGem = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(cp.r * 0.85, 0)),
      cp.isCenter ? harshaHeartCrystalMat : lavenderCrystalMat,
    );
    baseGem.position.set(0, 0.22, 0.18);

    // Crystal Finial atop each gold crown point
    const finialDiamond = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(cp.r * 1.15, 0)).scale(0.78, 1.45, 0.78),
      cp.isCenter ? harshaHeartInnerCoreMat : cyanCrystalFinialMat,
    );
    finialDiamond.position.set(0, cp.h + 0.28, 0);

    ptGrp.add(spireCone, baseGem, finialDiamond);
    heartTopCrownGroup.add(ptGrp);
  });

  // Curved Crown Filigree Arches linking the 3 primary gold points
  [-1, 1].forEach((side) => {
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.25, 0),
      new THREE.Vector3(side * 0.68, 2.48, 0.12),
      new THREE.Vector3(side * 1.35, 1.85, 0),
    ]);
    const archTube = new THREE.Mesh(
      tracker.trackGeo(new THREE.TubeGeometry(archCurve, 18, 0.065, 8, false)),
      royalChampagneGoldMat,
    );
    heartTopCrownGroup.add(archTube);
  });

  // ==========================================================================
  // 4. TWO MAIN TOWERS & CORNER TOWERS ARCHITECTURAL LAYERING (Section 5)
  //    1. Lower decorative base
  //    2. Main tower body fluted pilasters & arched windows
  //    3. Ornamental middle ring
  //    4. Upper crown balcony
  //    5. Layered blush/lavender/pearl/gold roof ribs & heart ornaments
  // ==========================================================================
  const towersEnhancementGroup = new THREE.Group();
  towersEnhancementGroup.name = 'RoyalTowersLayering';
  group.add(towersEnhancementGroup);

  const towerPlinthLowerGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.62, 3.92, 1.65, 16));
  towerPlinthLowerGeo.translate(0, 0.825, 0);
  const towerPlinthUpperGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.42, 3.62, 1.75, 16));
  towerPlinthUpperGeo.translate(0, 2.52, 0);
  const towerBaseTorusGeo = tracker.trackGeo(new THREE.TorusGeometry(3.64, 0.13, 10, 28));
  towerBaseTorusGeo.rotateX(Math.PI / 2);

  const towerPilasterGeo = tracker.trackGeo(new THREE.BoxGeometry(0.24, 17.2, 0.24));
  towerPilasterGeo.translate(0, 12.0, 0);

  const towerMidBandBodyGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.38, 3.38, 1.35, 20));
  towerMidBandBodyGeo.translate(0, 10.85, 0);
  const towerMidRingGoldGeo = tracker.trackGeo(new THREE.TorusGeometry(3.42, 0.11, 10, 28));
  towerMidRingGoldGeo.rotateX(Math.PI / 2);

  const towerBalconyDeckGeo = tracker.trackGeo(new THREE.CylinderGeometry(3.92, 3.45, 0.42, 24));
  towerBalconyDeckGeo.translate(0, 21.05, 0);
  const towerBalconyRailGeo = tracker.trackGeo(new THREE.TorusGeometry(3.85, 0.085, 10, 32));
  towerBalconyRailGeo.rotateX(Math.PI / 2);
  towerBalconyRailGeo.translate(0, 21.95, 0);
  const towerCorbelGeo = tracker.trackGeo(new THREE.BoxGeometry(0.22, 0.68, 0.52));

  const spireRibCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.38, 21.6, 0),
    new THREE.Vector3(2.25, 24.6, 0),
    new THREE.Vector3(1.12, 27.6, 0),
    new THREE.Vector3(0.08, 30.3, 0),
  ]);
  const spireRibGeo = tracker.trackGeo(new THREE.TubeGeometry(spireRibCurve, 20, 0.075, 8, false));

  const towerConfigs = [
    { lx: -15.5, lz: -15.5, isFront: true, isLeft: true },
    { lx: 15.5, lz: -15.5, isFront: true, isLeft: false },
    { lx: -15.5, lz: 15.5, isFront: false, isLeft: true },
    { lx: 15.5, lz: 15.5, isFront: false, isLeft: false },
  ];

  const smallHeartShape = createRoyalHeartShape(0.32, 1.05);
  const smallHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(smallHeartShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
    }),
  );

  towerConfigs.forEach((tc) => {
    const tGrp = new THREE.Group();
    tGrp.position.set(tc.lx, 0, tc.lz);

    // 1. Lower Decorative Base
    const plinthLower = new THREE.Mesh(towerPlinthLowerGeo, royalWarmCreamMat);
    const plinthUpper = new THREE.Mesh(towerPlinthUpperGeo, royalBlushPinkMat);
    const torus1 = new THREE.Mesh(towerBaseTorusGeo, royalChampagneGoldMat);
    torus1.position.y = 1.65;
    const torus2 = new THREE.Mesh(towerBaseTorusGeo, royalChampagneGoldMat);
    torus2.position.y = 3.4;
    torus2.scale.setScalar(0.95);
    tGrp.add(plinthLower, plinthUpper, torus1, torus2);

    // 2. Vertical Architectural Pilasters & Spire Ribs (8 radial angles)
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI * 2) / 8;
      const pil = new THREE.Mesh(
        towerPilasterGeo,
        i % 2 === 0 ? royalChampagneGoldMat : royalPearlIvoryMat,
      );
      pil.position.set(Math.cos(ang) * 3.22, 0, Math.sin(ang) * 3.22);
      pil.rotation.y = -ang;
      tGrp.add(pil);

      // Spire Roof Ribbing (alternating champagne gold and blush pink / soft lavender)
      const ribPivot = new THREE.Group();
      ribPivot.rotation.y = ang;
      const rib = new THREE.Mesh(
        spireRibGeo,
        i % 2 === 0
          ? royalChampagneGoldMat
          : tc.isLeft
            ? royalBlushPinkMat
            : royalPastelLavenderMat,
      );
      ribPivot.add(rib);
      tGrp.add(ribPivot);
    }

    // 3. Ornamental Middle Ring (y = 10.2m..11.6m)
    const midBand = new THREE.Mesh(
      towerMidBandBodyGeo,
      tc.isLeft ? royalPastelLavenderMat : royalBlushPinkMat,
    );
    const midRingBot = new THREE.Mesh(towerMidRingGoldGeo, royalChampagneGoldMat);
    midRingBot.position.y = 10.18;
    const midRingTop = new THREE.Mesh(towerMidRingGoldGeo, royalChampagneGoldMat);
    midRingTop.position.y = 11.52;
    tGrp.add(midBand, midRingBot, midRingTop);

    for (let m = 0; m < 8; m++) {
      const mAng = (m * Math.PI * 2) / 8 + Math.PI / 8;
      const hOrn = new THREE.Mesh(
        smallHeartGeo,
        m % 2 === 0 ? royalChampagneGoldMat : harshaHeartCrystalMat,
      );
      hOrn.position.set(Math.cos(mAng) * 3.42, 10.85, Math.sin(mAng) * 3.42);
      hOrn.rotation.y = -mAng + Math.PI / 2;
      tGrp.add(hOrn);
    }

    // 4. Upper Crown Balcony (y = 20.6m..22.4m)
    const balcDeck = new THREE.Mesh(towerBalconyDeckGeo, royalPearlIvoryMat);
    const balcRail = new THREE.Mesh(towerBalconyRailGeo, royalChampagneGoldMat);
    tGrp.add(balcDeck, balcRail);

    for (let b = 0; b < 12; b++) {
      const bAng = (b * Math.PI * 2) / 12;
      const corb = new THREE.Mesh(towerCorbelGeo, royalChampagneGoldMat);
      corb.position.set(Math.cos(bAng) * 3.48, 20.65, Math.sin(bAng) * 3.48);
      corb.rotation.y = -bAng + Math.PI / 2;
      tGrp.add(corb);

      // Balcony Heart Balusters & Flower Clusters
      const balHeart = new THREE.Mesh(smallHeartGeo, royalChampagneGoldMat);
      balHeart.scale.setScalar(0.82);
      balHeart.position.set(Math.cos(bAng) * 3.82, 21.52, Math.sin(bAng) * 3.82);
      balHeart.rotation.y = -bAng + Math.PI / 2;
      tGrp.add(balHeart);
    }

    // 5. Spire Roof Pastel Tier Collars & Top Heart Finial Ornament (y = 23.5m..31.5m)
    const spireBlushBand = new THREE.Mesh(
      tracker.trackGeo(new THREE.ConeGeometry(2.82, 3.6, 16, 1, true)).translate(0, 24.4, 0),
      tc.isLeft ? royalBlushPinkMat : royalPastelLavenderMat,
    );
    const spirePearlBand = new THREE.Mesh(
      tracker.trackGeo(new THREE.ConeGeometry(1.65, 2.8, 16, 1, true)).translate(0, 27.6, 0),
      royalPearlIvoryMat,
    );
    const spireHeartFinial = new THREE.Mesh(smallHeartGeo, harshaHeartCrystalMat);
    spireHeartFinial.scale.setScalar(1.65);
    spireHeartFinial.position.set(0, 31.15, 0);
    spireHeartFinial.rotation.y = Math.PI;
    tGrp.add(spireBlushBand, spirePearlBand, spireHeartFinial);

    // Tall Royal Arched Windows on the Front/Side faces of each Tower (y = 6.4m and y = 16.4m)
    const frontAng = tc.isFront ? -Math.PI / 2 : Math.PI / 2;
    [6.4, 16.4].forEach((wy, wIdx) => {
      const winGrp = new THREE.Group();
      winGrp.position.set(
        Math.cos(frontAng) * 3.24,
        wy,
        Math.sin(frontAng) * 3.24,
      );
      winGrp.rotation.y = tc.isFront ? Math.PI : 0;

      const pane = new THREE.Mesh(
        tracker.trackGeo(new THREE.BoxGeometry(1.15, 2.35, 0.08)),
        wIdx === 0
          ? tc.isLeft
            ? winGlowPastelLavender
            : winGlowSoftPink
          : winGlowWarmIvory,
      );
      const arch = new THREE.Mesh(
        tracker.trackGeo(new THREE.TorusGeometry(0.58, 0.075, 8, 18, Math.PI)),
        royalChampagneGoldMat,
      );
      arch.position.set(0, 1.18, 0.04);
      const heartTop = new THREE.Mesh(smallHeartGeo, royalChampagneGoldMat);
      heartTop.scale.setScalar(0.68);
      heartTop.position.set(0, 0.92, 0.06);
      winGrp.add(pane, arch, heartTop);
      tGrp.add(winGrp);
    });

    towersEnhancementGroup.add(tGrp);
  });

  // ==========================================================================
  // 5. CENTRAL ROYAL ENTRANCE & CENTRAL BALCONY VISUAL HIERARCHY (Sections 6 & 7)
  //    GROUND -> FLOWERS -> ROYAL ENTRANCE -> CENTRAL WINDOW / BALCONY -> HARSHA HEART -> CROWN
  // ==========================================================================
  const centralEntranceAndBalconyGroup = new THREE.Group();
  centralEntranceAndBalconyGroup.name = 'CentralRoyalEntranceAndBalcony';
  group.add(centralEntranceAndBalconyGroup);

  // --- 5A. Ceremonial Grand Entrance Arch, Layered Columns & Crystal Side Panels (lz = -16.8..-21.5) ---
  // Tiered Rose-Marble & Champagne-Gold Cheek Balustrades flanking the entrance ramp (|lx| = 4.4..5.6)
  [-4.85, 4.85].forEach((sideX) => {
    const cheekWall = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.62, 0.85, 4.8)),
      royalPearlIvoryMat,
    );
    cheekWall.position.set(sideX, 0.35, -19.2);
    const cheekGoldCap = new THREE.Mesh(
      tracker.trackGeo(new THREE.BoxGeometry(0.74, 0.12, 5.0)),
      royalChampagneGoldMat,
    );
    cheekGoldCap.position.set(sideX, 0.82, -19.2);

    // Front Newel Pedestal with Crystal Finial Orb
    const frontPedestal = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.42, 0.48, 1.25, 14)),
      royalBlushPinkMat,
    );
    frontPedestal.position.set(sideX, 0.45, -21.65);
    const frontCrystalOrb = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(0.32, 1)),
      harshaHeartCrystalMat,
    );
    frontCrystalOrb.position.set(sideX, 1.32, -21.65);
    const frontGoldRing = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.36, 0.05, 8, 20)).rotateX(Math.PI / 2),
      royalChampagneGoldMat,
    );
    frontGoldRing.position.set(sideX, 1.08, -21.65);

    centralEntranceAndBalconyGroup.add(
      cheekWall,
      cheekGoldCap,
      frontPedestal,
      frontCrystalOrb,
      frontGoldRing,
    );
  });

  // Layered Outer Royal Columns & Translucent Pink/Lavender Crystal Side Panels at the Entrance (lz = -17.05)
  const outerColShaftGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 6.4, 14));
  outerColShaftGeo.translate(0, 3.45, 0);
  const outerColCapGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.46, 0.3, 0.45, 14));
  outerColCapGeo.translate(0, 6.75, 0);
  const crystalSidePanelGeo = tracker.trackGeo(new THREE.BoxGeometry(1.15, 5.4, 0.12));

  [-4.65, 4.65].forEach((cx, cIdx) => {
    const colShaft = new THREE.Mesh(outerColShaftGeo, royalPearlIvoryMat);
    colShaft.position.set(cx, 0, -17.05);
    const colCap = new THREE.Mesh(outerColCapGeo, royalChampagneGoldMat);
    colCap.position.set(cx, 0, -17.05);

    // Pink & Lavender Crystal Side Panel between inner column (3.8) and outer column (4.65)
    const crystalPanel = new THREE.Mesh(
      crystalSidePanelGeo,
      cIdx === 0 ? lavenderCrystalMat : harshaHeartCrystalMat,
    );
    crystalPanel.position.set(cx > 0 ? 4.22 : -4.22, 3.25, -16.92);
    const panelGoldArch = new THREE.Mesh(
      tracker.trackGeo(new THREE.TorusGeometry(0.56, 0.06, 8, 18, Math.PI)),
      royalChampagneGoldMat,
    );
    panelGoldArch.position.set(cx > 0 ? 4.22 : -4.22, 5.95, -16.92);

    centralEntranceAndBalconyGroup.add(colShaft, colCap, crystalPanel, panelGoldArch);
  });

  // Grand Ceremonial Entrance Arch & Crown Motif above the Entrance Portal (y = 6.95m..8.35m, lz = -17.15)
  const grandPortalArch = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(2.65, 0.18, 12, 36, Math.PI)),
    royalChampagneGoldMat,
  );
  grandPortalArch.position.set(0, 6.85, -17.12);
  grandPortalArch.scale.set(1.45, 0.58, 1.0);

  const portalCrownMotif = new THREE.Mesh(
    tracker.trackGeo(new THREE.ConeGeometry(0.32, 0.85, 5)).translate(0, 0.425, 0),
    royalChampagneGoldMat,
  );
  portalCrownMotif.position.set(0, 8.28, -17.24);
  centralEntranceAndBalconyGroup.add(grandPortalArch, portalCrownMotif);

  // --- 5B. Central Royal Balcony & Grand Central Arched Window (y = 8.45m..16.2m, lz = -16.3..-18.4) ---
  const centralBalconyGroup = new THREE.Group();
  centralBalconyGroup.name = 'CentralRoyalBalcony';
  centralBalconyGroup.position.set(0, 8.45, -16.45);
  centralBalconyGroup.rotation.y = Math.PI; // +Z points toward -Z (front)
  centralEntranceAndBalconyGroup.add(centralBalconyGroup);

  // Curved Pearl-and-Blush Balcony Platform projecting forward
  const centralBalcDeck = new THREE.Mesh(
    tracker.trackGeo(new THREE.CylinderGeometry(4.2, 3.75, 0.42, 28, 1, false, 0, Math.PI)),
    royalPearlIvoryMat,
  );
  centralBalcDeck.scale.set(1.12, 1.0, 0.52);

  const centralBalcGoldTrim = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(4.18, 0.095, 10, 32, Math.PI)).rotateX(Math.PI / 2),
    royalChampagneGoldMat,
  );
  centralBalcGoldTrim.scale.set(1.12, 0.52, 1.0);
  centralBalcGoldTrim.position.y = -0.12;

  const centralBalcTopRail = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(4.08, 0.085, 10, 32, Math.PI)).rotateX(Math.PI / 2),
    royalChampagneGoldMat,
  );
  centralBalcTopRail.scale.set(1.12, 0.52, 1.0);
  centralBalcTopRail.position.y = 1.08;
  centralBalconyGroup.add(centralBalcDeck, centralBalcGoldTrim, centralBalcTopRail);

  // Balcony Railing: Pearl Balusters, Heart-Shaped Negative Space & Pink Crystal Accents
  for (let i = 1; i <= 9; i++) {
    const ang = (i / 10) * Math.PI;
    const rx = Math.cos(ang) * 4.08 * 1.12;
    const rz = Math.sin(ang) * 4.08 * 0.52;

    const pearlPost = new THREE.Mesh(
      tracker.trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 1.05, 10)).translate(0, 0.525, 0),
      royalPearlIvoryMat,
    );
    pearlPost.position.set(rx, 0, rz);

    // Heart-shaped negative-space filigree & pink crystal gem between posts
    const heartCutout = new THREE.Mesh(
      smallHeartGeo,
      i % 2 === 0 ? royalChampagneGoldMat : harshaHeartCrystalMat,
    );
    heartCutout.scale.setScalar(1.05);
    heartCutout.position.set(rx, 0.56, rz);
    heartCutout.rotation.y = -ang + Math.PI / 2;

    const topCrystalGem = new THREE.Mesh(
      tracker.trackGeo(new THREE.OctahedronGeometry(0.11, 0)),
      i % 2 === 0 ? harshaHeartCrystalMat : lavenderCrystalMat,
    );
    topCrystalGem.position.set(rx, 1.22, rz);

    centralBalconyGroup.add(pearlPost, heartCutout, topCrystalGem);
  }

  // Grand Central Royal Arched Window rising behind the Central Balcony (y = 8.8m..15.8m)
  // Visually connects the Central Balcony to the Level 2 Palace & Central HARSHA Heart above!
  const centralRoyalWindowGroup = new THREE.Group();
  centralRoyalWindowGroup.position.set(0, 3.4, -0.15);
  centralBalconyGroup.add(centralRoyalWindowGroup);

  const centralWinPane = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(3.6, 4.8, 0.12)),
    harshaHeartCrystalMat,
  );
  const centralWinArchPane = new THREE.Mesh(
    tracker.trackGeo(new THREE.CircleGeometry(1.8, 24, 0, Math.PI)),
    lavenderCrystalMat,
  );
  centralWinArchPane.position.set(0, 2.4, 0.04);

  const centralWinOuterArch = new THREE.Mesh(
    tracker.trackGeo(new THREE.TorusGeometry(1.88, 0.15, 12, 32, Math.PI)),
    royalChampagneGoldMat,
  );
  centralWinOuterArch.position.set(0, 2.4, 0.08);

  const centralWinStileL = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.22, 4.8, 0.22)),
    royalChampagneGoldMat,
  );
  centralWinStileL.position.set(-1.88, 0, 0.08);
  const centralWinStileR = new THREE.Mesh(
    tracker.trackGeo(new THREE.BoxGeometry(0.22, 4.8, 0.22)),
    royalChampagneGoldMat,
  );
  centralWinStileR.position.set(1.88, 0, 0.08);

  // Heart-shaped Rose Window Tracery inside the Grand Central Arched Window
  const centralWinHeartTracery = new THREE.Mesh(
    createRoyalHeartFrameShape(0.82, 0.64, 1.05)
      ? tracker.trackGeo(
          new THREE.ExtrudeGeometry(createRoyalHeartFrameShape(0.82, 0.64, 1.05), {
            depth: 0.14,
            bevelEnabled: false,
          }),
        )
      : smallHeartGeo,
    royalChampagneGoldMat,
  );
  centralWinHeartTracery.position.set(0, 2.35, 0.08);

  centralRoyalWindowGroup.add(
    centralWinPane,
    centralWinArchPane,
    centralWinOuterArch,
    centralWinStileL,
    centralWinStileR,
    centralWinHeartTracery,
  );

  // ==========================================================================
  // 6. ROMANTIC ENTRANCE FLORAL ARRANGEMENTS (Section 11 — Instanced Pastel Flowers)
  //    Roses, pastel flower clusters, climbing vines, and small glowing blossoms
  //    in pink, blush, lavender, cream, and pale peach framing the entrance!
  // ==========================================================================
  const entranceFloralsGroup = new THREE.Group();
  entranceFloralsGroup.name = 'RomanticEntranceFlorals';
  group.add(entranceFloralsGroup);

  const foliageFoliageMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#15803d'),
      roughness: 0.52,
    }),
  );
  const palePeachFlowerMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fed7aa'),
      emissive: new THREE.Color('#fb923c'),
      emissiveIntensity: 0.28,
      roughness: 0.3,
    }),
  );
  const glowingBlossomMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fdf2f8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.78,
      roughness: 0.2,
    }),
  );

  // Curated floral cluster anchor coordinates around the entrance steps, cheek walls, facade base & central balcony
  // (Leaving the central walkway |lx| <= 2.4 completely unobstructed for gameplay)
  const floralClusterCoords: Array<{ lx: number; ly: number; lz: number; scale: number }> = [
    // Along the entrance staircase cheek-walls & front pedestals
    { lx: -4.85, ly: 0.92, lz: -18.0, scale: 1.1 },
    { lx: -4.85, ly: 0.92, lz: -19.4, scale: 1.05 },
    { lx: -4.85, ly: 0.92, lz: -20.8, scale: 1.1 },
    { lx: 4.85, ly: 0.92, lz: -18.0, scale: 1.1 },
    { lx: 4.85, ly: 0.92, lz: -19.4, scale: 1.05 },
    { lx: 4.85, ly: 0.92, lz: -20.8, scale: 1.1 },
    // Flanking the front facade base between entrance and main front towers
    { lx: -6.8, ly: sampleLocalGroundY(-6.8, -17.2) + 0.25, lz: -17.2, scale: 1.25 },
    { lx: -9.2, ly: sampleLocalGroundY(-9.2, -17.2) + 0.25, lz: -17.2, scale: 1.3 },
    { lx: -11.8, ly: sampleLocalGroundY(-11.8, -17.2) + 0.25, lz: -17.2, scale: 1.25 },
    { lx: 6.8, ly: sampleLocalGroundY(6.8, -17.2) + 0.25, lz: -17.2, scale: 1.25 },
    { lx: 9.2, ly: sampleLocalGroundY(9.2, -17.2) + 0.25, lz: -17.2, scale: 1.3 },
    { lx: 11.8, ly: sampleLocalGroundY(11.8, -17.2) + 0.25, lz: -17.2, scale: 1.25 },
    // Around the base of the two main front towers
    { lx: -14.2, ly: sampleLocalGroundY(-14.2, -19.2) + 0.25, lz: -19.2, scale: 1.35 },
    { lx: 14.2, ly: sampleLocalGroundY(14.2, -19.2) + 0.25, lz: -19.2, scale: 1.35 },
    // Along the Central Royal Balcony rail above the entrance
    { lx: -3.6, ly: 9.55, lz: -17.2, scale: 0.95 },
    { lx: -1.8, ly: 9.55, lz: -18.2, scale: 0.95 },
    { lx: 0.0, ly: 9.55, lz: -18.55, scale: 1.05 },
    { lx: 1.8, ly: 9.55, lz: -18.2, scale: 0.95 },
    { lx: 3.6, ly: 9.55, lz: -17.2, scale: 0.95 },
    // Along the Level 2 Central Palace Entablature
    { lx: -4.2, ly: 22.35, lz: -17.1, scale: 1.1 },
    { lx: 0.0, ly: 22.35, lz: -17.1, scale: 1.2 },
    { lx: 4.2, ly: 22.35, lz: -17.1, scale: 1.1 },
  ];

  const moundGeo = tracker.trackGeo(new THREE.SphereGeometry(0.48, 10, 8));
  moundGeo.scale(1.45, 0.62, 1.15);
  const roseBloomGeo = tracker.trackGeo(new THREE.DodecahedronGeometry(0.13, 1));

  const numClusters = floralClusterCoords.length;
  const moundInst = new THREE.InstancedMesh(moundGeo, foliageFoliageMat, numClusters);
  const pinkRoseInst = new THREE.InstancedMesh(roseBloomGeo, royalPaleRoseMat, numClusters * 3);
  const blushRoseInst = new THREE.InstancedMesh(roseBloomGeo, royalBlushPinkMat, numClusters * 3);
  const lavenderFlowerInst = new THREE.InstancedMesh(
    roseBloomGeo,
    royalPastelLavenderMat,
    numClusters * 2,
  );
  const peachCreamFlowerInst = new THREE.InstancedMesh(
    roseBloomGeo,
    palePeachFlowerMat,
    numClusters * 2,
  );
  const glowingFlowerInst = new THREE.InstancedMesh(
    roseBloomGeo,
    glowingBlossomMat,
    numClusters * 2,
  );

  const flDummy = new THREE.Object3D();
  for (let i = 0; i < numClusters; i++) {
    const fc = floralClusterCoords[i];
    flDummy.position.set(fc.lx, fc.ly, fc.lz);
    flDummy.rotation.set(0, i * 0.7, 0);
    flDummy.scale.setScalar(fc.scale);
    flDummy.updateMatrix();
    moundInst.setMatrixAt(i, flDummy.matrix);

    // 3 Pink Roses per cluster
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI * 2) / 3 + i * 0.5;
      flDummy.position.set(
        fc.lx + Math.cos(ang) * 0.36 * fc.scale,
        fc.ly + 0.24 * fc.scale,
        fc.lz + Math.sin(ang) * 0.28 * fc.scale,
      );
      flDummy.scale.setScalar(fc.scale * 0.95);
      flDummy.updateMatrix();
      pinkRoseInst.setMatrixAt(i * 3 + k, flDummy.matrix);
    }

    // 3 Blush Roses per cluster
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI * 2) / 3 + i * 0.5 + 1.05;
      flDummy.position.set(
        fc.lx + Math.cos(ang) * 0.48 * fc.scale,
        fc.ly + 0.18 * fc.scale,
        fc.lz + Math.sin(ang) * 0.36 * fc.scale,
      );
      flDummy.scale.setScalar(fc.scale * 0.88);
      flDummy.updateMatrix();
      blushRoseInst.setMatrixAt(i * 3 + k, flDummy.matrix);
    }

    // 2 Lavender + 2 Peach/Cream + 2 Glowing Blossoms per cluster
    for (let k = 0; k < 2; k++) {
      const ang = k * Math.PI + i * 0.9;
      flDummy.position.set(
        fc.lx + Math.cos(ang) * 0.24 * fc.scale,
        fc.ly + 0.31 * fc.scale,
        fc.lz + Math.sin(ang) * 0.22 * fc.scale,
      );
      flDummy.scale.setScalar(fc.scale * 0.85);
      flDummy.updateMatrix();
      lavenderFlowerInst.setMatrixAt(i * 2 + k, flDummy.matrix);

      flDummy.position.set(
        fc.lx + Math.cos(ang + 1.57) * 0.32 * fc.scale,
        fc.ly + 0.27 * fc.scale,
        fc.lz + Math.sin(ang + 1.57) * 0.28 * fc.scale,
      );
      flDummy.scale.setScalar(fc.scale * 0.82);
      flDummy.updateMatrix();
      peachCreamFlowerInst.setMatrixAt(i * 2 + k, flDummy.matrix);

      flDummy.position.set(
        fc.lx + Math.cos(ang + 0.78) * 0.16 * fc.scale,
        fc.ly + 0.34 * fc.scale,
        fc.lz + Math.sin(ang + 0.78) * 0.16 * fc.scale,
      );
      flDummy.scale.setScalar(fc.scale * 0.76);
      flDummy.updateMatrix();
      glowingFlowerInst.setMatrixAt(i * 2 + k, flDummy.matrix);
    }
  }

  moundInst.instanceMatrix.needsUpdate = true;
  pinkRoseInst.instanceMatrix.needsUpdate = true;
  blushRoseInst.instanceMatrix.needsUpdate = true;
  lavenderFlowerInst.instanceMatrix.needsUpdate = true;
  peachCreamFlowerInst.instanceMatrix.needsUpdate = true;
  glowingFlowerInst.instanceMatrix.needsUpdate = true;

  entranceFloralsGroup.add(
    moundInst,
    pinkRoseInst,
    blushRoseInst,
    lavenderFlowerInst,
    peachCreamFlowerInst,
    glowingFlowerInst,
  );

  // ==========================================================================
  // 7. COLOURFUL AMBIENT LIGHTING (Section 10 — Carefully Budgeted Focal Lights)
  //    - Central HARSHA Heart: Strongest focal rose-pink/champagne light at apex
  //    - Left Tower: Subtle lavender / purple uplight
  //    - Right Tower: Subtle rose / pink uplight
  //    - Crystal Areas: Restrained cyan / blue crystal accent light
  // ==========================================================================
  const harshaHeartFocalLight = new THREE.PointLight('#ff4d94', 2.65, 24.0, 1.5);
  harshaHeartFocalLight.position.set(0, 27.6, -18.2);

  const leftTowerLavenderLight = new THREE.PointLight('#c084fc', 1.45, 19.0, 1.6);
  leftTowerLavenderLight.position.set(-15.5, 13.5, -19.2);

  const rightTowerRoseLight = new THREE.PointLight('#fb7185', 1.45, 19.0, 1.6);
  rightTowerRoseLight.position.set(15.5, 13.5, -19.2);

  const crystalCyanAccentLight = new THREE.PointLight('#67e8f9', 1.15, 15.0, 1.7);
  crystalCyanAccentLight.position.set(0, 19.5, -17.6);

  group.add(
    harshaHeartFocalLight,
    leftTowerLavenderLight,
    rightTowerRoseLight,
    crystalCyanAccentLight,
  );

  // ==========================================================================
  // 8. UPDATE LOOP — SUBTLE LIVING GLOW ON CENTRAL HARSHA HEART & WINDOWS
  // ==========================================================================
  return {
    group,
    windowGlowMats: {
      warmIvory: winGlowWarmIvory,
      softPink: winGlowSoftPink,
      pastelLavender: winGlowPastelLavender,
    },
    update: (_delta: number, elapsedTime: number, awakeningFactor: number) => {
      // Section 2: HARSHA Heart Subtle Living Glow Cycle (6.5s romantic cycle):
      // 1. Normal soft pink glow
      // 2. Gentle highlight travelling across the crystal
      // 3. Slight shimmer over the HARSHA engraving
      // 4. Slow return to normal
      const cycleDuration = 6.5;
      const phase = (elapsedTime % cycleDuration) / cycleDuration; // 0..1

      // Smooth breathing base pink crystal glow
      const baseBreath = 0.5 + 0.5 * Math.sin(elapsedTime * 1.6);
      const awakeBoost = 0.55 + awakeningFactor * 0.65;

      // Travelling crystal highlight active during phase 0.18..0.62
      let sweepAlpha = 0.0;
      if (phase >= 0.18 && phase <= 0.62) {
        const u = (phase - 0.18) / 0.44;
        sweepAlpha = Math.sin(u * Math.PI);
        highlightSweepMesh.position.x = THREE.MathUtils.lerp(-2.1, 2.1, u);
        highlightSweepMesh.visible = true;
        harshaHeartSweepHighlightMat.opacity = sweepAlpha * 0.38 * awakeBoost;
      } else {
        highlightSweepMesh.visible = false;
        harshaHeartSweepHighlightMat.opacity = 0.0;
      }

      // Shimmer over the 3D 'HARSHA' engraving peaks right as the highlight passes the center (phase 0.32..0.78)
      let engravingShimmer = 0.0;
      if (phase >= 0.32 && phase <= 0.78) {
        const v = (phase - 0.32) / 0.46;
        engravingShimmer = Math.sin(v * Math.PI);
      }

      harshaHeartCrystalMat.emissiveIntensity =
        (0.62 + baseBreath * 0.24 + sweepAlpha * 0.35) * awakeBoost;
      harshaHeartInnerCoreMat.emissiveIntensity =
        (0.85 + baseBreath * 0.28 + sweepAlpha * 0.45) * awakeBoost;
      harshaEngravingFaceMat.emissiveIntensity =
        (0.95 + baseBreath * 0.22 + engravingShimmer * 0.75) * awakeBoost;

      // Focal light intensity gently breathes with the HARSHA Heart
      harshaHeartFocalLight.intensity =
        (2.1 + baseBreath * 0.55 + engravingShimmer * 0.65) * awakeBoost;

      // Subtle colourful ambient tower & crystal lights
      leftTowerLavenderLight.intensity =
        (1.05 + 0.25 * Math.sin(elapsedTime * 1.4)) * awakeBoost;
      rightTowerRoseLight.intensity =
        (1.05 + 0.25 * Math.cos(elapsedTime * 1.4)) * awakeBoost;
      crystalCyanAccentLight.intensity =
        (0.85 + 0.22 * Math.sin(elapsedTime * 1.9 + 1.0)) * awakeBoost;

      // Varied subtle emission across Warm Ivory, Soft Pink, and Pastel Lavender Royal Windows
      winGlowWarmIvory.emissiveIntensity =
        0.42 + awakeningFactor * 1.15 + Math.sin(elapsedTime * 2.1) * 0.08;
      winGlowSoftPink.emissiveIntensity =
        0.4 + awakeningFactor * 1.1 + Math.sin(elapsedTime * 2.1 + 2.0) * 0.08;
      winGlowPastelLavender.emissiveIntensity =
        0.38 + awakeningFactor * 1.05 + Math.sin(elapsedTime * 2.1 + 4.0) * 0.08;
    },
  };
}
