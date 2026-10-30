import * as THREE from 'three';

export type AvatarActivityPose =
  | 'none'
  | 'pop_sing'
  | 'dance_step_1'
  | 'dance_step_2'
  | 'dance_step_3'
  | 'dance_step_4'
  | 'dance_step_5'
  | 'manual_dance_w'
  | 'manual_dance_a'
  | 'manual_dance_s'
  | 'manual_dance_d'
  | 'manual_dance_f'
  | 'manual_dance_g'
  | 'manual_dance_h'
  | 'manual_dance_j'
  | 'manual_dance_k'
  | 'manual_dance_l'
  | 'photo_pose_1'
  | 'photo_pose_2'
  | 'photo_pose_3';

export interface OutfitPalettePreset {
  name: string;
  dressHex: string;
  trimHex: string;
  beltHex: string;
  bootHex: string;
}

export interface HairPalettePreset {
  name: string;
  hairHex: string;
}

export const OUTFIT_PALETTE_PRESETS: readonly OutfitPalettePreset[] = [
  {
    name: 'Rose Quartz Ballgown',
    dressHex: '#f26b8a',
    trimHex: '#fff7f9',
    beltHex: '#f7c96f',
    bootHex: '#4a3228',
  },
  {
    name: 'Starlight Sapphire Gown',
    dressHex: '#38bdf8',
    trimHex: '#e0f2fe',
    beltHex: '#fde047',
    bootHex: '#1e3a8a',
  },
  {
    name: 'Champagne Empress Couture',
    dressHex: '#f59e0b',
    trimHex: '#fef3c7',
    beltHex: '#fbbf24',
    bootHex: '#78350f',
  },
  {
    name: 'Lavender Dream Tulle',
    dressHex: '#c084fc',
    trimHex: '#f3e8ff',
    beltHex: '#f472b6',
    bootHex: '#581c87',
  },
  {
    name: 'Valentine Ruby Velvet',
    dressHex: '#e11d48',
    trimHex: '#ffe4e6',
    beltHex: '#fde047',
    bootHex: '#881337',
  },
];

export const HAIR_PALETTE_PRESETS: readonly HairPalettePreset[] = [
  { name: 'Espresso Silk', hairHex: '#3b261d' },
  { name: 'Golden Honey Blonde', hairHex: '#d97706' },
  { name: 'Pastel Rose Gold', hairHex: '#f472b6' },
  { name: 'Midnight Starlight', hairHex: '#1e1b4b' },
  { name: 'Auburn Velvet', hairHex: '#7c2d12' },
];

export interface PlayerAvatarBundle {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  updateAnimation: (
    delta: number,
    moveSpeed: number,
    isSprinting: boolean,
    elapsedTime: number,
    isSeatedOnBroom?: boolean,
    isReceivingKey?: boolean,
    embraceAlpha?: number,
    kissAlpha?: number,
    isSitting?: boolean,
  ) => void;
  getRightHandWorldPosition: (target: THREE.Vector3) => THREE.Vector3;
  setFirstPersonVisibility: (isFirstPerson: boolean) => void;
  setShadowVisible: (visible: boolean) => void;
  setOutfitPalette: (presetIndex: number) => string;
  cycleOutfitPalette: () => string;
  setHairPalette: (presetIndex: number) => string;
  cycleHairColor: () => string;
  toggleTiara: () => boolean;
  isTiaraVisible: () => boolean;
  setActivityPose: (pose: AvatarActivityPose) => void;
  getActivityPose: () => AvatarActivityPose;
  resetNeutralPose?: () => void;
  getAppearanceSummary: () => {
    outfitName: string;
    hairName: string;
    tiaraVisible: boolean;
  };
  getRingAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  getNecklaceAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  getCrownAttachmentWorldPos: (target: THREE.Vector3) => THREE.Vector3;
  setJewelleryEquipped: (state: {
    ringIndex?: number | null;
    necklaceIndex?: number | null;
    crownEquipped?: boolean;
  }) => void;
  getJewelleryEquipped: () => {
    ringIndex: number | null;
    necklaceIndex: number | null;
    crownEquipped: boolean;
    allThreeWorn: boolean;
  };
  setRaisingHand: (raising: boolean) => void;
  setRoseHeld: (held: boolean) => void;
  isRoseHeld: () => boolean;
  setHairRoseVisible?: (visible: boolean) => void;
  isHairRoseVisible?: () => boolean;
  dispose: () => void;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(18, 24, 32, 0.52)');
  grad.addColorStop(0.55, 'rgba(18, 24, 32, 0.22)');
  grad.addColorStop(1, 'rgba(18, 24, 32, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createPlayerAvatar(): PlayerAvatarBundle {
  const group = new THREE.Group();
  group.name = 'PlayerAvatarRoot';

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'PlayerAvatarBody';
  group.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffdfc4'),
    roughness: 0.65,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3b261d'),
    roughness: 0.42,
    metalness: 0.08,
  });
  const dressMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f26b8a'),
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  const collarTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff7f9'),
    roughness: 0.78,
    metalness: 0.02,
  });
  const ribbonGoldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f7c96f'),
    roughness: 0.22,
    metalness: 0.78,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a3228'),
    roughness: 0.5,
    metalness: 0.12,
  });

  materials.push(
    skinMat,
    hairMat,
    dressMat,
    collarTrimMat,
    ribbonGoldMat,
    bootMat,
  );

  // 1. Contact Shadow Grounding Disc
  const shadowTex = createContactShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);
  geometries.push(shadowGeo);
  materials.push(shadowMat);

  // 2. Left & Right Pivoted Legs + Boots
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.36, 6, 10);
  legGeo.translate(0, -0.22, 0);
  const bootGeo = new THREE.BoxGeometry(0.17, 0.14, 0.24);
  bootGeo.translate(0, -0.44, 0.03);
  geometries.push(legGeo, bootGeo);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.52, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, skinMat);
  const leftBootMesh = new THREE.Mesh(bootGeo, bootMat);
  leftLegMesh.castShadow = true;
  leftBootMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh, leftBootMesh);
  bodyGroup.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.52, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
  const rightBootMesh = new THREE.Mesh(bootGeo, bootMat);
  rightLegMesh.castShadow = true;
  rightBootMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh, rightBootMesh);
  bodyGroup.add(rightLegPivot);

  // 3. Flared Skirt & Torso Bodice
  const skirtGeo = new THREE.ConeGeometry(0.34, 0.44, 16, 1, false);
  skirtGeo.translate(0, 0.68, 0);
  const skirtMesh = new THREE.Mesh(skirtGeo, dressMat);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  bodyGroup.add(skirtMesh);

  const beltGeo = new THREE.TorusGeometry(0.21, 0.028, 8, 20);
  beltGeo.rotateX(Math.PI / 2);
  beltGeo.translate(0, 0.87, 0);
  const beltMesh = new THREE.Mesh(beltGeo, ribbonGoldMat);
  bodyGroup.add(beltMesh);

  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.38, 12);
  torsoGeo.translate(0, 1.05, 0);
  const torsoMesh = new THREE.Mesh(torsoGeo, dressMat);
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  const collarGeo = new THREE.TorusGeometry(0.155, 0.032, 8, 18);
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.translate(0, 1.23, 0);
  const collarMesh = new THREE.Mesh(collarGeo, collarTrimMat);
  bodyGroup.add(collarMesh);

  geometries.push(skirtGeo, beltGeo, torsoGeo, collarGeo);

  // 4. Left & Right Pivoted Arms
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.32, 6, 10);
  armGeo.translate(0, -0.18, 0);
  const sleeveGeo = new THREE.SphereGeometry(0.088, 10, 10);
  sleeveGeo.translate(0, -0.02, 0);
  geometries.push(armGeo, sleeveGeo);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.24, 1.19, 0);
  leftArmPivot.rotation.z = 0.14;
  const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
  const leftSleeveMesh = new THREE.Mesh(sleeveGeo, collarTrimMat);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh, leftSleeveMesh);
  bodyGroup.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.24, 1.19, 0);
  rightArmPivot.rotation.z = -0.14;
  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  const rightSleeveMesh = new THREE.Mesh(sleeveGeo, collarTrimMat);
  rightArmMesh.castShadow = true;
  const rightHandAnchor = new THREE.Group();
  rightHandAnchor.position.set(0, -0.35, 0.04);
  rightArmPivot.add(rightArmMesh, rightSleeveMesh, rightHandAnchor);
  bodyGroup.add(rightArmPivot);

  // 5. Head, Hair Crown, Ponytail & Signature Ribbon Bow
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.46, 0);
  bodyGroup.add(headPivot);

  const headGeo = new THREE.SphereGeometry(0.21, 18, 18);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  const hairCapGeo = new THREE.SphereGeometry(
    0.228,
    18,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.62,
  );
  hairCapGeo.rotateX(-0.22);
  const hairCapMesh = new THREE.Mesh(hairCapGeo, hairMat);
  hairCapMesh.position.y = 0.02;
  hairCapMesh.castShadow = true;
  headPivot.add(hairCapMesh);

  const ponytailPivot = new THREE.Group();
  ponytailPivot.position.set(0, 0.04, -0.2);
  headPivot.add(ponytailPivot);

  const ponytailGeo = new THREE.ConeGeometry(0.11, 0.36, 10);
  ponytailGeo.rotateX(-Math.PI * 0.72);
  ponytailGeo.translate(0, -0.1, -0.09);
  const ponytailMesh = new THREE.Mesh(ponytailGeo, hairMat);
  ponytailMesh.castShadow = true;
  ponytailPivot.add(ponytailMesh);

  const bowWingGeo = new THREE.BoxGeometry(0.14, 0.07, 0.04);
  const bowLeft = new THREE.Mesh(bowWingGeo, collarTrimMat);
  bowLeft.position.set(-0.07, 0.02, -0.01);
  bowLeft.rotation.z = 0.22;
  const bowRight = new THREE.Mesh(bowWingGeo, collarTrimMat);
  bowRight.position.set(0.07, 0.02, -0.01);
  bowRight.rotation.z = -0.22;
  const bowCenterGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const bowCenter = new THREE.Mesh(bowCenterGeo, ribbonGoldMat);
  bowCenter.position.set(0, 0.02, -0.01);
  ponytailPivot.add(bowLeft, bowRight, bowCenter);

  // 6. Harsha's Crown (Hero Tiara on headPivot: 5 crystal points, central heart crystal, 2 smaller hearts, pearls, stars)
  const tiaraGroup = new THREE.Group();
  tiaraGroup.name = 'HarshasCrown';
  tiaraGroup.position.set(0, 0.2, 0.05);
  tiaraGroup.rotation.x = -0.18;
  tiaraGroup.visible = true;
  headPivot.add(tiaraGroup);

  const tiaraBandGeo = new THREE.TorusGeometry(0.145, 0.014, 8, 20, Math.PI * 1.15);
  tiaraBandGeo.rotateX(Math.PI / 2);
  tiaraBandGeo.rotateY(-Math.PI * 0.075);
  const tiaraBand = new THREE.Mesh(tiaraBandGeo, ribbonGoldMat);
  tiaraGroup.add(tiaraBand);

  const tiaraGemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbcfe8'),
    emissive: new THREE.Color('#f472b6'),
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.25,
  });
  const pearlWhiteJewelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fffbeb'),
    emissive: new THREE.Color('#fef3c7'),
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.12,
  });
  materials.push(tiaraGemMat, pearlWhiteJewelMat);

  const tiaraPeakGeo = new THREE.ConeGeometry(0.024, 0.075, 6);
  const tiaraGemGeo = new THREE.OctahedronGeometry(0.022, 0);
  const heartLobeSmallGeo = new THREE.SphereGeometry(0.014, 8, 8);
  const pearlTinyGeo = new THREE.SphereGeometry(0.009, 8, 8);
  const peakAngles = [-0.65, -0.32, 0, 0.32, 0.65];
  peakAngles.forEach((ang, idx) => {
    const isCenter = idx === 2;
    const hScale = isCenter ? 1.42 : idx === 1 || idx === 3 ? 1.08 : 0.82;
    const px = Math.sin(ang) * 0.142;
    const pz = Math.cos(ang) * 0.142;
    const peak = new THREE.Mesh(tiaraPeakGeo, ribbonGoldMat);
    peak.scale.set(1, hScale, 1);
    peak.position.set(px, 0.028 * hScale, pz);
    tiaraGroup.add(peak);

    // 5 major crystal points
    const gem = new THREE.Mesh(tiaraGemGeo, tiaraGemMat);
    gem.scale.setScalar(isCenter ? 1.25 : idx === 1 || idx === 3 ? 0.88 : 0.68);
    gem.position.set(px * 1.03, 0.054 * hScale, pz * 1.03);
    tiaraGroup.add(gem);

    // Pearl details at base of each point
    const pearl = new THREE.Mesh(pearlTinyGeo, pearlWhiteJewelMat);
    pearl.position.set(px * 1.05, 0.012, pz * 1.05);
    tiaraGroup.add(pearl);
  });

  // Central Heart Crystal + Two Smaller Flanking Hearts on Harsha's Crown
  const crownHeartPositions = [
    { ang: 0, s: 1.0, y: 0.042 },
    { ang: -0.22, s: 0.68, y: 0.028 },
    { ang: 0.22, s: 0.68, y: 0.028 },
  ];
  crownHeartPositions.forEach((ch) => {
    const hx = Math.sin(ch.ang) * 0.148;
    const hz = Math.cos(ch.ang) * 0.148;
    const hL = new THREE.Mesh(heartLobeSmallGeo, tiaraGemMat);
    hL.scale.setScalar(ch.s);
    hL.position.set(hx - 0.006 * ch.s, ch.y, hz);
    const hR = new THREE.Mesh(heartLobeSmallGeo, tiaraGemMat);
    hR.scale.setScalar(ch.s);
    hR.position.set(hx + 0.006 * ch.s, ch.y, hz);
    tiaraGroup.add(hL, hR);
  });

  // 7. Wearable Necklace Attachment on Neck / Collar (bodyGroup)
  const necklaceAnchor = new THREE.Group();
  necklaceAnchor.name = 'NecklaceAttachmentAnchor';
  necklaceAnchor.position.set(0, 1.21, 0.01);
  bodyGroup.add(necklaceAnchor);

  const necklaceGroup = new THREE.Group();
  necklaceGroup.visible = false;
  necklaceAnchor.add(necklaceGroup);

  const neckChainGeo = new THREE.TorusGeometry(0.162, 0.0085, 8, 24);
  neckChainGeo.rotateX(Math.PI / 2 + 0.16);
  const neckChainMesh = new THREE.Mesh(neckChainGeo, ribbonGoldMat);
  necklaceGroup.add(neckChainMesh);

  const neckPendantMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f472b6'),
    emissive: new THREE.Color('#ec4899'),
    emissiveIntensity: 0.9,
    roughness: 0.12,
    metalness: 0.28,
  });
  materials.push(neckPendantMat);

  const pendantDropGroup = new THREE.Group();
  pendantDropGroup.position.set(0, -0.042, 0.165);
  const pBail = new THREE.Mesh(pearlTinyGeo, ribbonGoldMat);
  pBail.position.set(0, 0.022, 0);
  const pGemCenter = new THREE.Mesh(tiaraGemGeo, neckPendantMat);
  pGemCenter.scale.set(1.15, 1.35, 0.75);
  const pHeartL = new THREE.Mesh(heartLobeSmallGeo, neckPendantMat);
  pHeartL.position.set(-0.009, 0.008, 0.005);
  const pHeartR = new THREE.Mesh(heartLobeSmallGeo, neckPendantMat);
  pHeartR.position.set(0.009, 0.008, 0.005);
  pendantDropGroup.add(pBail, pGemCenter, pHeartL, pHeartR);
  necklaceGroup.add(pendantDropGroup);

  // 8. Wearable Ring Attachment on Finger / Hand (rightHandAnchor)
  const ringGroup = new THREE.Group();
  ringGroup.name = 'WearableRingGroup';
  ringGroup.position.set(0, -0.025, 0.025);
  ringGroup.visible = false;
  rightHandAnchor.add(ringGroup);

  const ringBandGeo = new THREE.TorusGeometry(0.024, 0.0055, 8, 16);
  ringBandGeo.rotateX(Math.PI / 2);
  const ringBandMesh = new THREE.Mesh(ringBandGeo, ribbonGoldMat);
  const ringGemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fda4af'),
    emissive: new THREE.Color('#f43f5e'),
    emissiveIntensity: 0.95,
    roughness: 0.1,
    metalness: 0.3,
  });
  materials.push(ringGemMat);
  const ringStoneMesh = new THREE.Mesh(tiaraGemGeo, ringGemMat);
  ringStoneMesh.scale.setScalar(0.85);
  ringStoneMesh.position.set(0, 0.01, 0.024);
  ringGroup.add(ringBandMesh, ringStoneMesh);

  // 9. Simultaneous 3-Piece Combination Travelling Heart-Light Particle (Ring -> Necklace -> Crown)
  const comboHeartMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fef08a'),
    transparent: true,
    opacity: 0.95,
  });
  materials.push(comboHeartMat);
  const comboHeartOrb = new THREE.Group();
  comboHeartOrb.visible = false;
  const chOrbCore = new THREE.Mesh(tiaraGemGeo, comboHeartMat);
  chOrbCore.scale.setScalar(0.95);
  const chOrbL = new THREE.Mesh(heartLobeSmallGeo, tiaraGemMat);
  chOrbL.position.set(-0.008, 0.008, 0);
  const chOrbR = new THREE.Mesh(heartLobeSmallGeo, tiaraGemMat);
  chOrbR.position.set(0.008, 0.008, 0);
  comboHeartOrb.add(chOrbCore, chOrbL, chOrbR);
  bodyGroup.add(comboHeartOrb);

  // 10. Wearable Golden-Rimmed Rose on Right Hand (for Little Dream World Rose Handoff)
  const heldRoseGroup = new THREE.Group();
  heldRoseGroup.name = 'HeldGoldenRoseGroup';
  heldRoseGroup.position.set(0.01, -0.02, 0.045);
  heldRoseGroup.rotation.set(Math.PI * 0.35, 0, -0.15);
  heldRoseGroup.visible = false;
  rightHandAnchor.add(heldRoseGroup);

  const roseStemGeo = new THREE.CylinderGeometry(0.0045, 0.0055, 0.22, 8);
  roseStemGeo.translate(0, 0.08, 0);
  const roseStemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#10b981'),
    roughness: 0.45,
    metalness: 0.1,
  });
  const rosePetalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f43f5e'),
    emissive: new THREE.Color('#fbbf24'),
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.25,
  });
  materials.push(roseStemMat, rosePetalMat);

  const roseBudCoreGeo = new THREE.ConeGeometry(0.022, 0.045, 10);
  roseBudCoreGeo.rotateX(Math.PI);
  roseBudCoreGeo.translate(0, 0.2, 0);
  const roseOuterPetalGeo = new THREE.SphereGeometry(0.026, 10, 8);
  roseOuterPetalGeo.scale(1.15, 0.85, 1.15);
  roseOuterPetalGeo.translate(0, 0.195, 0);
  const roseLeafGeo = new THREE.SphereGeometry(0.014, 8, 6);
  roseLeafGeo.scale(1.6, 0.35, 0.75);

  const leafL = new THREE.Mesh(roseLeafGeo, roseStemMat);
  leafL.position.set(-0.016, 0.11, 0);
  leafL.rotation.z = 0.45;
  const leafR = new THREE.Mesh(roseLeafGeo, roseStemMat);
  leafR.position.set(0.016, 0.13, 0);
  leafR.rotation.z = -0.45;
  const goldRimHalo = new THREE.Mesh(ringBandGeo, ribbonGoldMat);
  goldRimHalo.scale.setScalar(1.25);
  goldRimHalo.position.set(0, 0.2, 0);

  heldRoseGroup.add(
    new THREE.Mesh(roseStemGeo, roseStemMat),
    new THREE.Mesh(roseOuterPetalGeo, rosePetalMat),
    new THREE.Mesh(roseBudCoreGeo, ribbonGoldMat),
    leafL,
    leafR,
    goldRimHalo,
  );

  // 11. Small Romantic Hair Rose Flower (worn in Harsha's hair upon entering the castle)
  let hairRoseVisible = false;
  const hairRoseFlowerGroup = new THREE.Group();
  hairRoseFlowerGroup.name = 'HarshaHairRoseFlower';
  hairRoseFlowerGroup.position.set(0.18, 0.08, 0.06);
  hairRoseFlowerGroup.rotation.set(0.25, 0.35, -0.28);
  hairRoseFlowerGroup.visible = false;
  headPivot.add(hairRoseFlowerGroup);

  const hairRoseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f43f5e'),
    emissive: new THREE.Color('#e11d48'),
    emissiveIntensity: 0.65,
    roughness: 0.32,
    metalness: 0.15,
  });
  const hairRoseLeafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#10b981'),
    roughness: 0.45,
  });
  materials.push(hairRoseMat, hairRoseLeafMat);

  const hairRoseBudGeo = new THREE.DodecahedronGeometry(0.042, 1);
  const hairRoseBud = new THREE.Mesh(hairRoseBudGeo, hairRoseMat);
  hairRoseBud.castShadow = true;

  const hairRoseOuterPetalsGeo = new THREE.TorusGeometry(0.038, 0.014, 6, 12);
  hairRoseOuterPetalsGeo.rotateX(Math.PI / 2);
  const hairRoseOuter = new THREE.Mesh(hairRoseOuterPetalsGeo, hairRoseMat);

  const hairRoseLeafGeo = new THREE.ConeGeometry(0.022, 0.065, 4);
  hairRoseLeafGeo.rotateZ(Math.PI / 3);
  hairRoseLeafGeo.translate(-0.025, -0.015, -0.01);
  const hairRoseLeaf1 = new THREE.Mesh(hairRoseLeafGeo, hairRoseLeafMat);
  const hairRoseLeaf2 = hairRoseLeaf1.clone();
  hairRoseLeaf2.rotation.z = -Math.PI / 2.5;
  hairRoseLeaf2.position.set(0.01, -0.025, -0.01);

  const hairRoseCoreGeo = new THREE.SphereGeometry(0.016, 6, 6);
  const hairRoseCore = new THREE.Mesh(hairRoseCoreGeo, ribbonGoldMat);
  hairRoseCore.position.set(0, 0, 0.02);

  hairRoseFlowerGroup.add(hairRoseLeaf1, hairRoseLeaf2, hairRoseBud, hairRoseOuter, hairRoseCore);

  geometries.push(
    headGeo,
    hairCapGeo,
    ponytailGeo,
    bowWingGeo,
    bowCenterGeo,
    tiaraBandGeo,
    tiaraPeakGeo,
    tiaraGemGeo,
    heartLobeSmallGeo,
    pearlTinyGeo,
    neckChainGeo,
    ringBandGeo,
    roseStemGeo,
    roseBudCoreGeo,
    roseOuterPetalGeo,
    roseLeafGeo,
    hairRoseBudGeo,
    hairRoseOuterPetalsGeo,
    hairRoseLeafGeo,
    hairRoseCoreGeo,
  );

  let walkPhase = 0;
  let currentOutfitIndex = 0;
  let currentHairIndex = 0;
  let tiaraVisible = true;
  let equippedRingIndex: number | null = null;
  let equippedNecklaceIndex: number | null = null;
  let activityPose: AvatarActivityPose = 'none';
  let raisingHandForGift = false;
  let roseHeld = false;

  const RING_COLORS = ['#f43f5e', '#fde047', '#38bdf8', '#c084fc', '#f472b6'];
  const NECKLACE_COLORS = ['#ec4899', '#fbbf24', '#38bdf8', '#a855f7', '#fb7185'];

  const applyOutfitPreset = (index: number): string => {
    const safeIdx =
      ((index % OUTFIT_PALETTE_PRESETS.length) + OUTFIT_PALETTE_PRESETS.length) %
      OUTFIT_PALETTE_PRESETS.length;
    currentOutfitIndex = safeIdx;
    const preset = OUTFIT_PALETTE_PRESETS[safeIdx];
    dressMat.color.set(preset.dressHex);
    collarTrimMat.color.set(preset.trimHex);
    ribbonGoldMat.color.set(preset.beltHex);
    bootMat.color.set(preset.bootHex);
    tiaraGemMat.color.set(preset.dressHex);
    tiaraGemMat.emissive.set(preset.dressHex);
    return preset.name;
  };

  const applyHairPreset = (index: number): string => {
    const safeIdx =
      ((index % HAIR_PALETTE_PRESETS.length) + HAIR_PALETTE_PRESETS.length) %
      HAIR_PALETTE_PRESETS.length;
    currentHairIndex = safeIdx;
    const preset = HAIR_PALETTE_PRESETS[safeIdx];
    hairMat.color.set(preset.hairHex);
    return preset.name;
  };

  return {
    group,
    bodyGroup,
    getRightHandWorldPosition(target: THREE.Vector3): THREE.Vector3 {
      group.updateMatrixWorld(true);
      return rightHandAnchor.getWorldPosition(target);
    },
    updateAnimation(
      delta: number,
      moveSpeed: number,
      isSprinting: boolean,
      elapsedTime: number,
      isSeatedOnBroom = false,
      isReceivingKey = false,
      embraceAlpha = 0,
      kissAlpha = 0,
      isSitting = false,
    ) {
      if (isSitting) {
        bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, 0, 8, delta);
        leftLegPivot.rotation.x = THREE.MathUtils.damp(
          leftLegPivot.rotation.x,
          -1.45,
          8,
          delta,
        );
        rightLegPivot.rotation.x = THREE.MathUtils.damp(
          rightLegPivot.rotation.x,
          -1.45,
          8,
          delta,
        );
        leftLegPivot.rotation.z = THREE.MathUtils.damp(
          leftLegPivot.rotation.z,
          0.05,
          8,
          delta,
        );
        rightLegPivot.rotation.z = THREE.MathUtils.damp(
          rightLegPivot.rotation.z,
          -0.05,
          8,
          delta,
        );
        leftArmPivot.rotation.x = THREE.MathUtils.damp(
          leftArmPivot.rotation.x,
          -0.32,
          8,
          delta,
        );
        rightArmPivot.rotation.x = THREE.MathUtils.damp(
          rightArmPivot.rotation.x,
          -0.32,
          8,
          delta,
        );
        leftArmPivot.rotation.y = THREE.MathUtils.damp(
          leftArmPivot.rotation.y,
          0,
          8,
          delta,
        );
        rightArmPivot.rotation.y = THREE.MathUtils.damp(
          rightArmPivot.rotation.y,
          0,
          8,
          delta,
        );
        leftArmPivot.rotation.z = THREE.MathUtils.damp(
          leftArmPivot.rotation.z,
          0.12,
          8,
          delta,
        );
        rightArmPivot.rotation.z = THREE.MathUtils.damp(
          rightArmPivot.rotation.z,
          -0.12,
          8,
          delta,
        );
        const breath = Math.sin(elapsedTime * 1.65) * 0.008;
        const skyGazePitch = -0.26 + Math.sin(elapsedTime * 0.38) * 0.045;
        const skyGazeYaw = -0.06 + Math.sin(elapsedTime * 0.27) * 0.11;
        bodyGroup.position.y = THREE.MathUtils.damp(
          bodyGroup.position.y,
          -0.28 + breath,
          8,
          delta,
        );
        bodyGroup.rotation.x = THREE.MathUtils.damp(
          bodyGroup.rotation.x,
          0.02 * Math.sin(elapsedTime * 0.8),
          8,
          delta,
        );
        headPivot.rotation.x = THREE.MathUtils.damp(
          headPivot.rotation.x,
          skyGazePitch,
          6,
          delta,
        );
        headPivot.rotation.y = THREE.MathUtils.damp(
          headPivot.rotation.y,
          skyGazeYaw,
          6,
          delta,
        );
        headPivot.rotation.z = THREE.MathUtils.damp(
          headPivot.rotation.z,
          Math.sin(elapsedTime * 0.31) * 0.03,
          6,
          delta,
        );
        ponytailPivot.rotation.y = Math.sin(elapsedTime * 1.5) * 0.04;
        return;
      }
      if (isSeatedOnBroom) {
        bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, 0, 10, delta);
        // Seated broom-riding pose: knees tucked back/astride, arms reaching forward to grip handle
        const speedNorm = THREE.MathUtils.clamp(Math.abs(moveSpeed) / 22.0, 0, 1);
        leftLegPivot.rotation.x = THREE.MathUtils.damp(
          leftLegPivot.rotation.x,
          0.62,
          12,
          delta,
        );
        rightLegPivot.rotation.x = THREE.MathUtils.damp(
          rightLegPivot.rotation.x,
          0.52,
          12,
          delta,
        );
        leftLegPivot.rotation.z = THREE.MathUtils.damp(
          leftLegPivot.rotation.z,
          0.18,
          12,
          delta,
        );
        rightLegPivot.rotation.z = THREE.MathUtils.damp(
          rightLegPivot.rotation.z,
          -0.18,
          12,
          delta,
        );

        leftArmPivot.rotation.x = THREE.MathUtils.damp(
          leftArmPivot.rotation.x,
          -0.95,
          12,
          delta,
        );
        rightArmPivot.rotation.x = THREE.MathUtils.damp(
          rightArmPivot.rotation.x,
          -0.95,
          12,
          delta,
        );
        leftArmPivot.rotation.y = THREE.MathUtils.damp(
          leftArmPivot.rotation.y,
          0,
          12,
          delta,
        );
        rightArmPivot.rotation.y = THREE.MathUtils.damp(
          rightArmPivot.rotation.y,
          0,
          12,
          delta,
        );
        leftArmPivot.rotation.z = THREE.MathUtils.damp(
          leftArmPivot.rotation.z,
          -0.22,
          12,
          delta,
        );
        rightArmPivot.rotation.z = THREE.MathUtils.damp(
          rightArmPivot.rotation.z,
          0.22,
          12,
          delta,
        );
        headPivot.rotation.x = THREE.MathUtils.damp(
          headPivot.rotation.x,
          0,
          10,
          delta,
        );
        headPivot.rotation.z = THREE.MathUtils.damp(
          headPivot.rotation.z,
          0,
          10,
          delta,
        );

        bodyGroup.position.y = THREE.MathUtils.damp(
          bodyGroup.position.y,
          -0.32,
          12,
          delta,
        );
        bodyGroup.rotation.x = THREE.MathUtils.damp(
          bodyGroup.rotation.x,
          0.18 + speedNorm * 0.16,
          10,
          delta,
        );

        // Ponytail streams dynamically in the flight slipstream
        ponytailPivot.rotation.x =
          0.25 + speedNorm * 0.55 + Math.sin(elapsedTime * 11.0) * 0.08;
        ponytailPivot.rotation.y =
          Math.cos(elapsedTime * 8.5) * (0.08 + speedNorm * 0.14);
        return;
      }

      // Floor 2 Interactive Activity Poses (Pop Stage, Dance Studio Choreography, Fashion Photo Poses)
      if (activityPose !== 'none') {
        const dRate = 10.0;
        if (activityPose === 'pop_sing') {
          const beat = elapsedTime * 5.2;
          const sway = Math.sin(beat * 0.5) * 0.12;
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            Math.abs(Math.sin(beat)) * 0.045,
            dRate,
            delta,
          );
          bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, -0.04, dRate, delta);
          bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, sway, dRate, delta);
          leftLegPivot.rotation.x = THREE.MathUtils.damp(
            leftLegPivot.rotation.x,
            Math.sin(beat) * 0.14,
            dRate,
            delta,
          );
          rightLegPivot.rotation.x = THREE.MathUtils.damp(
            rightLegPivot.rotation.x,
            -Math.sin(beat) * 0.14,
            dRate,
            delta,
          );
          leftLegPivot.rotation.z = THREE.MathUtils.damp(leftLegPivot.rotation.z, 0.06, dRate, delta);
          rightLegPivot.rotation.z = THREE.MathUtils.damp(rightLegPivot.rotation.z, -0.06, dRate, delta);
          // Right hand holds crystal stand microphone near lips; left arm waves expressively to the crowd
          rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.35, dRate, delta);
          rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, -0.25, dRate, delta);
          rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, 0.15, dRate, delta);
          leftArmPivot.rotation.x = THREE.MathUtils.damp(
            leftArmPivot.rotation.x,
            -0.85 + Math.sin(beat * 0.5) * 0.35,
            dRate,
            delta,
          );
          leftArmPivot.rotation.z = THREE.MathUtils.damp(
            leftArmPivot.rotation.z,
            0.55 + Math.cos(beat * 0.5) * 0.22,
            dRate,
            delta,
          );
          headPivot.rotation.x = THREE.MathUtils.damp(
            headPivot.rotation.x,
            -0.08 + Math.sin(beat) * 0.06,
            dRate,
            delta,
          );
          headPivot.rotation.y = THREE.MathUtils.damp(
            headPivot.rotation.y,
            Math.sin(beat * 0.25) * 0.18,
            dRate,
            delta,
          );
          ponytailPivot.rotation.y = Math.cos(beat) * 0.22;
          ponytailPivot.rotation.x = 0.12 + Math.abs(Math.sin(beat)) * 0.14;
          return;
        }

        if (activityPose === 'dance_step_1') {
          // Pirouette Spin: graceful continuous 360° ballet rotation with arms arched overhead in fifth position
          bodyGroup.rotation.y = (elapsedTime * 3.6) % (Math.PI * 2);
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            0.06 + Math.sin(elapsedTime * 7.2) * 0.025,
            dRate,
            delta,
          );
          bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, 0, dRate, delta);
          leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -2.35, dRate, delta);
          rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -2.35, dRate, delta);
          leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, -0.25, dRate, delta);
          rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, 0.25, dRate, delta);
          leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.05, dRate, delta);
          rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -0.45, dRate, delta);
          rightLegPivot.rotation.z = THREE.MathUtils.damp(rightLegPivot.rotation.z, -0.22, dRate, delta);
          ponytailPivot.rotation.x = 0.35;
          ponytailPivot.rotation.y = Math.sin(elapsedTime * 7.2) * 0.25;
          return;
        }

        if (activityPose === 'dance_step_2') {
          // Ballet Arabesque: poised forward extension with back leg raised and arms outstretched
          const pulse = Math.sin(elapsedTime * 3.2);
          bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, pulse * 0.18, dRate, delta);
          bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, 0.22, dRate, delta);
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            0.04 + Math.abs(pulse) * 0.03,
            dRate,
            delta,
          );
          leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, -0.15, dRate, delta);
          rightLegPivot.rotation.x = THREE.MathUtils.damp(
            rightLegPivot.rotation.x,
            0.78 + pulse * 0.08,
            dRate,
            delta,
          );
          leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.45, dRate, delta);
          rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.65, dRate, delta);
          leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.32, dRate, delta);
          rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.68, dRate, delta);
          headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.18, dRate, delta);
          ponytailPivot.rotation.x = 0.22;
          return;
        }

        if (activityPose === 'dance_step_3') {
          // Upbeat Pop Choreography: side-to-side groove with alternating arm waves
          const groove = elapsedTime * 6.4;
          const s = Math.sin(groove);
          const c = Math.cos(groove);
          bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, s * 0.32, dRate, delta);
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            Math.abs(c) * 0.075,
            dRate,
            delta,
          );
          leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, s * 0.38, dRate, delta);
          rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -s * 0.38, dRate, delta);
          leftArmPivot.rotation.x = THREE.MathUtils.damp(
            leftArmPivot.rotation.x,
            -1.15 + s * 0.65,
            dRate,
            delta,
          );
          rightArmPivot.rotation.x = THREE.MathUtils.damp(
            rightArmPivot.rotation.x,
            -1.15 - s * 0.65,
            dRate,
            delta,
          );
          leftArmPivot.rotation.z = THREE.MathUtils.damp(
            leftArmPivot.rotation.z,
            0.45 + c * 0.25,
            dRate,
            delta,
          );
          rightArmPivot.rotation.z = THREE.MathUtils.damp(
            rightArmPivot.rotation.z,
            -0.45 - c * 0.25,
            dRate,
            delta,
          );
          headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, s * 0.12, dRate, delta);
          ponytailPivot.rotation.y = c * 0.28;
          return;
        }

        if (activityPose === 'dance_step_4') {
          // Heart Ribbon Grand Jeté Leap: joyful rhythmic leap with open heart arms
          const leapWave = Math.abs(Math.sin(elapsedTime * 4.4));
          bodyGroup.rotation.y = THREE.MathUtils.damp(
            bodyGroup.rotation.y,
            Math.sin(elapsedTime * 2.2) * 0.25,
            dRate,
            delta,
          );
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            leapWave * 0.22,
            14,
            delta,
          );
          leftLegPivot.rotation.x = THREE.MathUtils.damp(
            leftLegPivot.rotation.x,
            -leapWave * 0.55,
            14,
            delta,
          );
          rightLegPivot.rotation.x = THREE.MathUtils.damp(
            rightLegPivot.rotation.x,
            leapWave * 0.55,
            14,
            delta,
          );
          leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.85, dRate, delta);
          rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.85, dRate, delta);
          leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.65, dRate, delta);
          rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.65, dRate, delta);
          ponytailPivot.rotation.x = 0.25 + leapWave * 0.35;
          return;
        }

        if (activityPose === 'dance_step_5') {
          // Royal Swan Lake Waltz Glide: graceful undulating swan arms, gentle arched torso rise, poised ballet extension
          const waltzWave = Math.sin(elapsedTime * 3.4);
          const waltzCos = Math.cos(elapsedTime * 3.4);
          bodyGroup.rotation.y = THREE.MathUtils.damp(
            bodyGroup.rotation.y,
            waltzWave * 0.24,
            dRate,
            delta,
          );
          bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, -0.04, dRate, delta);
          bodyGroup.rotation.z = THREE.MathUtils.damp(bodyGroup.rotation.z, waltzWave * 0.08, dRate, delta);
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            0.05 + Math.abs(waltzCos) * 0.045,
            dRate,
            delta,
          );
          // Undulating wing-like swan arms
          leftArmPivot.rotation.x = THREE.MathUtils.damp(
            leftArmPivot.rotation.x,
            -1.65 + waltzWave * 0.35,
            dRate,
            delta,
          );
          rightArmPivot.rotation.x = THREE.MathUtils.damp(
            rightArmPivot.rotation.x,
            -1.65 - waltzWave * 0.35,
            dRate,
            delta,
          );
          leftArmPivot.rotation.z = THREE.MathUtils.damp(
            leftArmPivot.rotation.z,
            0.62 + waltzCos * 0.28,
            dRate,
            delta,
          );
          rightArmPivot.rotation.z = THREE.MathUtils.damp(
            rightArmPivot.rotation.z,
            -0.62 - waltzCos * 0.28,
            dRate,
            delta,
          );
          leftArmPivot.rotation.y = THREE.MathUtils.damp(leftArmPivot.rotation.y, -0.25, dRate, delta);
          rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, 0.25, dRate, delta);
          leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, waltzWave * 0.22, dRate, delta);
          rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -waltzWave * 0.22, dRate, delta);
          headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.12, dRate, delta);
          headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, waltzWave * 0.12, dRate, delta);
          ponytailPivot.rotation.y = waltzCos * 0.25;
          ponytailPivot.rotation.x = 0.18;
          return;
        }

        // Manual Dance Gestures (Keys: W, A, S, D, F, G, H, J, K, L)
        if (activityPose.startsWith('manual_dance_')) {
          if (activityPose === 'manual_dance_w') {
            // [W] High Reach & Graceful Leap: Arms reach skyward, back arches, airborne spring
            const leap = Math.abs(Math.sin(elapsedTime * 5.0));
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, 0.16 + leap * 0.14, 14, delta);
            bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, -0.15, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -2.65, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -2.65, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.28, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.28, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.32, dRate, delta);
            leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, -0.35, dRate, delta);
            rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, 0.25, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_a') {
            // [A] Left Hip Sway & Silk Ribbon Sweep: Left hip sways, left arm sweeps wide
            const sway = Math.sin(elapsedTime * 4.5);
            bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, 0.42 + sway * 0.12, dRate, delta);
            bodyGroup.rotation.z = THREE.MathUtils.damp(bodyGroup.rotation.z, 0.16, dRate, delta);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, Math.abs(sway) * 0.03, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.25, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 1.25, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.35, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.42, dRate, delta);
            headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, 0.24, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_s') {
            // [S] Low Curtsy & Dramatic Floor Dip: Knees bend, skirt flares, arms sweep down
            const dip = Math.cos(elapsedTime * 3.5);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, -0.16 + dip * 0.02, dRate, delta);
            bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, 0.12, dRate, delta);
            leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.45, dRate, delta);
            rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -0.38, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -0.25, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.95, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.25, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.95, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, 0.22, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_d') {
            // [D] Right Hip Sway & Silk Ribbon Sweep: Right hip sways, right arm sweeps wide
            const sway = Math.sin(elapsedTime * 4.5);
            bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, -0.42 - sway * 0.12, dRate, delta);
            bodyGroup.rotation.z = THREE.MathUtils.damp(bodyGroup.rotation.z, -0.16, dRate, delta);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, Math.abs(sway) * 0.03, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.25, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -1.25, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -0.35, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.42, dRate, delta);
            headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, -0.24, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_f') {
            // [F] Front Heart Claps & Pop Isolation: Rhythmic hand clapping in front of chest
            const clap = Math.sin(elapsedTime * 10.0);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, Math.abs(clap) * 0.03, 14, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.45, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.45, dRate, delta);
            leftArmPivot.rotation.y = THREE.MathUtils.damp(leftArmPivot.rotation.y, -0.72 + clap * 0.12, 16, delta);
            rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, 0.72 - clap * 0.12, 16, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.28, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.28, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -clap * 0.08, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_g') {
            // [G] Golden Pirouette 360° Spin: Rapid spin with arms rounded in ballet 5th position
            bodyGroup.rotation.y = (bodyGroup.rotation.y + delta * 7.5) % (Math.PI * 2);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, 0.06, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -2.75, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -2.75, dRate, delta);
            leftArmPivot.rotation.y = THREE.MathUtils.damp(leftArmPivot.rotation.y, -0.45, dRate, delta);
            rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, 0.45, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.22, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.22, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.15, dRate, delta);
            leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.12, dRate, delta);
            rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -0.12, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_h') {
            // [H] Heart Hands to Mandu 💕: Hands curl over chest in a heart shape with sweet tilt
            const breathe = Math.sin(elapsedTime * 3.2);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, breathe * 0.02, dRate, delta);
            bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, breathe * 0.1, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.55, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.55, dRate, delta);
            leftArmPivot.rotation.y = THREE.MathUtils.damp(leftArmPivot.rotation.y, -0.85, dRate, delta);
            rightArmPivot.rotation.y = THREE.MathUtils.damp(rightArmPivot.rotation.y, 0.85, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.35, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.35, dRate, delta);
            headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, 0.26, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.08, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_j') {
            // [J] Jeté Flying Kick & High Kick: Joyful airborne leap with kick
            const leap = Math.abs(Math.sin(elapsedTime * 5.2));
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, 0.22 + leap * 0.12, 14, delta);
            bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, -0.18, dRate, delta);
            rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -1.35, 14, delta);
            leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.65, 14, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.95, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.95, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.85, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.85, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, -0.22, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_k') {
            // [K] K-Pop Shoulder Wave & Hip Snap: Sharp isolations with angled styling arms
            const wave = Math.sin(elapsedTime * 7.5);
            bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, wave * 0.35, 14, delta);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, Math.abs(wave) * 0.04, 14, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -1.85 + wave * 0.35, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.75 - wave * 0.35, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.65, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.45, dRate, delta);
            headPivot.rotation.z = THREE.MathUtils.damp(headPivot.rotation.z, wave * 0.18, dRate, delta);
            return;
          }
          if (activityPose === 'manual_dance_l') {
            // [L] Love Bow & Royal Princess Curtsy: Deep graceful bow with arms swept behind
            bodyGroup.rotation.x = THREE.MathUtils.damp(bodyGroup.rotation.x, 0.38, dRate, delta);
            bodyGroup.position.y = THREE.MathUtils.damp(bodyGroup.position.y, -0.12, dRate, delta);
            leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, 0.65, dRate, delta);
            rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, 0.65, dRate, delta);
            leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.55, dRate, delta);
            rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.55, dRate, delta);
            headPivot.rotation.x = THREE.MathUtils.damp(headPivot.rotation.x, 0.32, dRate, delta);
            leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.28, dRate, delta);
            rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -0.28, dRate, delta);
            return;
          }
        }

        if (
          activityPose === 'photo_pose_1' ||
          activityPose === 'photo_pose_2' ||
          activityPose === 'photo_pose_3'
        ) {
          bodyGroup.rotation.y = THREE.MathUtils.damp(
            bodyGroup.rotation.y,
            activityPose === 'photo_pose_1' ? 0.18 : activityPose === 'photo_pose_2' ? -0.2 : 0,
            dRate,
            delta,
          );
          bodyGroup.position.y = THREE.MathUtils.damp(
            bodyGroup.position.y,
            Math.sin(elapsedTime * 2.0) * 0.01,
            dRate,
            delta,
          );
          leftArmPivot.rotation.x = THREE.MathUtils.damp(
            leftArmPivot.rotation.x,
            activityPose === 'photo_pose_3' ? -1.95 : -0.55,
            dRate,
            delta,
          );
          rightArmPivot.rotation.x = THREE.MathUtils.damp(
            rightArmPivot.rotation.x,
            activityPose === 'photo_pose_1' ? -1.45 : -1.95,
            dRate,
            delta,
          );
          leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, 0.38, dRate, delta);
          rightArmPivot.rotation.z = THREE.MathUtils.damp(rightArmPivot.rotation.z, -0.38, dRate, delta);
          headPivot.rotation.z = THREE.MathUtils.damp(
            headPivot.rotation.z,
            activityPose === 'photo_pose_2' ? -0.1 : 0.08,
            dRate,
            delta,
          );
          return;
        }
      }

      bodyGroup.rotation.y = THREE.MathUtils.damp(bodyGroup.rotation.y, 0, 10, delta);
      bodyGroup.rotation.z = THREE.MathUtils.damp(bodyGroup.rotation.z, 0, 10, delta);

      leftLegPivot.rotation.z = THREE.MathUtils.damp(
        leftLegPivot.rotation.z,
        0,
        10,
        delta,
      );
      rightLegPivot.rotation.z = THREE.MathUtils.damp(
        rightLegPivot.rotation.z,
        0,
        10,
        delta,
      );

      // Slow, tender embrace reaction when Yeshwanth hugs Harsha from behind by the lake
      if (embraceAlpha > 0.001 || kissAlpha > 0.001) {
        const hugDamp = 3.2;
        leftLegPivot.rotation.x = THREE.MathUtils.damp(
          leftLegPivot.rotation.x,
          0,
          hugDamp,
          delta,
        );
        rightLegPivot.rotation.x = THREE.MathUtils.damp(
          rightLegPivot.rotation.x,
          0,
          hugDamp,
          delta,
        );
        // Slowly raise hands to gently hold Yeshwanth's arms wrapped around her from behind
        leftArmPivot.rotation.x = THREE.MathUtils.damp(
          leftArmPivot.rotation.x,
          THREE.MathUtils.lerp(0.02, -0.68, embraceAlpha),
          hugDamp,
          delta,
        );
        rightArmPivot.rotation.x = THREE.MathUtils.damp(
          rightArmPivot.rotation.x,
          THREE.MathUtils.lerp(-0.02, -0.72, embraceAlpha),
          hugDamp,
          delta,
        );
        leftArmPivot.rotation.y = THREE.MathUtils.damp(
          leftArmPivot.rotation.y,
          THREE.MathUtils.lerp(0, 0.28, embraceAlpha),
          hugDamp,
          delta,
        );
        rightArmPivot.rotation.y = THREE.MathUtils.damp(
          rightArmPivot.rotation.y,
          THREE.MathUtils.lerp(0, -0.28, embraceAlpha),
          hugDamp,
          delta,
        );
        leftArmPivot.rotation.z = THREE.MathUtils.damp(
          leftArmPivot.rotation.z,
          THREE.MathUtils.lerp(0.14, -0.22, embraceAlpha),
          hugDamp,
          delta,
        );
        rightArmPivot.rotation.z = THREE.MathUtils.damp(
          rightArmPivot.rotation.z,
          THREE.MathUtils.lerp(-0.14, 0.22, embraceAlpha),
          hugDamp,
          delta,
        );
        // Soft breathing & gentle lean back into Yeshwanth's chest as he holds her from behind
        bodyGroup.position.y = THREE.MathUtils.damp(
          bodyGroup.position.y,
          Math.sin(elapsedTime * 1.5) * 0.01 + kissAlpha * 0.02,
          hugDamp,
          delta,
        );
        bodyGroup.rotation.x = THREE.MathUtils.damp(
          bodyGroup.rotation.x,
          -embraceAlpha * 0.035,
          hugDamp,
          delta,
        );
        headPivot.rotation.x = THREE.MathUtils.damp(
          headPivot.rotation.x,
          -embraceAlpha * 0.12 - kissAlpha * 0.08,
          hugDamp,
          delta,
        );
        headPivot.rotation.z = THREE.MathUtils.damp(
          headPivot.rotation.z,
          -embraceAlpha * 0.1 - kissAlpha * 0.06,
          hugDamp,
          delta,
        );
        headPivot.rotation.y = THREE.MathUtils.damp(
          headPivot.rotation.y,
          embraceAlpha * 0.12 + kissAlpha * 0.08,
          hugDamp,
          delta,
        );
        ponytailPivot.rotation.x = THREE.MathUtils.damp(
          ponytailPivot.rotation.x,
          embraceAlpha * 0.14,
          hugDamp,
          delta,
        );
        ponytailPivot.rotation.y = Math.sin(elapsedTime * 1.4) * 0.03;
        return;
      }

      leftArmPivot.rotation.y = THREE.MathUtils.damp(
        leftArmPivot.rotation.y,
        0,
        10,
        delta,
      );
      rightArmPivot.rotation.y = THREE.MathUtils.damp(
        rightArmPivot.rotation.y,
        0,
        10,
        delta,
      );
      leftArmPivot.rotation.z = THREE.MathUtils.damp(
        leftArmPivot.rotation.z,
        0.14,
        10,
        delta,
      );
      const handGiftPose = Boolean(isReceivingKey || raisingHandForGift);
      rightArmPivot.rotation.z = THREE.MathUtils.damp(
        rightArmPivot.rotation.z,
        handGiftPose ? 0.18 : roseHeld ? 0.08 : -0.14,
        10,
        delta,
      );
      headPivot.rotation.x = THREE.MathUtils.damp(
        headPivot.rotation.x,
        handGiftPose ? 0.12 : 0,
        10,
        delta,
      );
      headPivot.rotation.z = THREE.MathUtils.damp(
        headPivot.rotation.z,
        0,
        10,
        delta,
      );

      const normalizedSpeed = THREE.MathUtils.clamp(moveSpeed / 5.0, 0, 1.7);

      if (normalizedSpeed > 0.04) {
        const freq = isSprinting ? 13.5 : 9.5;
        walkPhase += delta * freq * Math.min(normalizedSpeed, 1.35);

        const swingAmp =
          (isSprinting ? 0.68 : 0.45) * Math.min(normalizedSpeed, 1.15);
        leftLegPivot.rotation.x = Math.sin(walkPhase) * swingAmp;
        rightLegPivot.rotation.x = -Math.sin(walkPhase) * swingAmp;

        leftArmPivot.rotation.x = -Math.sin(walkPhase) * swingAmp * 0.82;
        rightArmPivot.rotation.x = handGiftPose
          ? THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.25, 10, delta)
          : roseHeld
            ? THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.68, 10, delta)
            : Math.sin(walkPhase) * swingAmp * 0.82;

        bodyGroup.position.y = Math.abs(Math.sin(walkPhase)) * 0.055;
        const targetLean = isSprinting ? 0.14 : 0.06;
        bodyGroup.rotation.x = THREE.MathUtils.damp(
          bodyGroup.rotation.x,
          targetLean,
          10,
          delta,
        );

        ponytailPivot.rotation.y = Math.cos(walkPhase) * 0.18;
        ponytailPivot.rotation.x = Math.abs(Math.sin(walkPhase)) * 0.15;
      } else {
        leftLegPivot.rotation.x = THREE.MathUtils.damp(
          leftLegPivot.rotation.x,
          0,
          10,
          delta,
        );
        rightLegPivot.rotation.x = THREE.MathUtils.damp(
          rightLegPivot.rotation.x,
          0,
          10,
          delta,
        );
        leftArmPivot.rotation.x = THREE.MathUtils.damp(
          leftArmPivot.rotation.x,
          Math.sin(elapsedTime * 1.8) * 0.03,
          10,
          delta,
        );
        rightArmPivot.rotation.x = THREE.MathUtils.damp(
          rightArmPivot.rotation.x,
          handGiftPose ? -1.25 : roseHeld ? -0.72 : -Math.sin(elapsedTime * 1.8) * 0.03,
          10,
          delta,
        );
        bodyGroup.position.y = THREE.MathUtils.damp(
          bodyGroup.position.y,
          Math.sin(elapsedTime * 2.4) * 0.012,
          8,
          delta,
        );
        bodyGroup.rotation.x = THREE.MathUtils.damp(
          bodyGroup.rotation.x,
          0,
          10,
          delta,
        );
        bodyGroup.rotation.z = THREE.MathUtils.damp(
          bodyGroup.rotation.z,
          0,
          10,
          delta,
        );
        ponytailPivot.rotation.y = Math.sin(elapsedTime * 2.0) * 0.06;
        ponytailPivot.rotation.x = THREE.MathUtils.damp(
          ponytailPivot.rotation.x,
          0,
          8,
          delta,
        );
      }

      // Section 25: Simultaneous 3-Piece Combination Glow & Travelling Heart-Light (Ring -> Necklace -> Crown)
      const allThreeWorn =
        equippedRingIndex !== null &&
        equippedNecklaceIndex !== null &&
        tiaraVisible;
      if (allThreeWorn) {
        const syncPulse = 1.05 + Math.sin(elapsedTime * 4.2) * 0.45;
        ringGemMat.emissiveIntensity = syncPulse;
        neckPendantMat.emissiveIntensity = syncPulse;
        tiaraGemMat.emissiveIntensity = syncPulse;

        comboHeartOrb.visible = true;
        const cycle = (elapsedTime * 0.65) % 1.0;
        // 0..0.5: Ring (0.24, 0.84, 0.08) -> Necklace (0, 1.17, 0.18)
        // 0.5..1.0: Necklace (0, 1.17, 0.18) -> Crown (0, 1.66, 0.16)
        if (cycle < 0.5) {
          const u = cycle * 2.0;
          comboHeartOrb.position.set(
            THREE.MathUtils.lerp(0.24, 0.0, u) + Math.sin(u * Math.PI) * 0.04,
            THREE.MathUtils.lerp(0.84, 1.17, u),
            THREE.MathUtils.lerp(0.08, 0.18, u),
          );
        } else {
          const u = (cycle - 0.5) * 2.0;
          comboHeartOrb.position.set(
            Math.sin(u * Math.PI) * 0.05,
            THREE.MathUtils.lerp(1.17, 1.66, u),
            THREE.MathUtils.lerp(0.18, 0.16, u),
          );
        }
        comboHeartOrb.rotation.y = elapsedTime * 3.5;
        const sPulse = 0.75 + Math.sin(cycle * Math.PI) * 0.45;
        comboHeartOrb.scale.setScalar(sPulse);
      } else {
        comboHeartOrb.visible = false;
        ringGemMat.emissiveIntensity = 0.85;
        neckPendantMat.emissiveIntensity = 0.85;
        tiaraGemMat.emissiveIntensity = 0.78;
      }
    },
    setFirstPersonVisibility(isFirstPerson: boolean) {
      bodyGroup.visible = !isFirstPerson;
    },
    setShadowVisible(visible: boolean) {
      shadowMesh.visible = visible;
    },
    setOutfitPalette(presetIndex: number): string {
      return applyOutfitPreset(presetIndex);
    },
    cycleOutfitPalette(): string {
      return applyOutfitPreset(currentOutfitIndex + 1);
    },
    setHairPalette(presetIndex: number): string {
      return applyHairPreset(presetIndex);
    },
    cycleHairColor(): string {
      return applyHairPreset(currentHairIndex + 1);
    },
    toggleTiara(): boolean {
      tiaraVisible = !tiaraVisible;
      tiaraGroup.visible = tiaraVisible;
      return tiaraVisible;
    },
    isTiaraVisible(): boolean {
      return tiaraVisible;
    },
    setActivityPose(pose: AvatarActivityPose): void {
      activityPose = pose;
    },
    getActivityPose(): AvatarActivityPose {
      return activityPose;
    },
    resetNeutralPose() {
      activityPose = 'none';
      bodyGroup.rotation.set(0, 0, 0);
      bodyGroup.position.set(0, 0, 0);
      headPivot.rotation.set(0, 0, 0);
      leftArmPivot.rotation.set(0, 0, 0.14);
      rightArmPivot.rotation.set(0, 0, -0.14);
      leftLegPivot.rotation.set(0, 0, 0);
      rightLegPivot.rotation.set(0, 0, 0);
      ponytailPivot.rotation.set(0, 0, 0);
    },
    getAppearanceSummary() {
      return {
        outfitName: OUTFIT_PALETTE_PRESETS[currentOutfitIndex].name,
        hairName: HAIR_PALETTE_PRESETS[currentHairIndex].name,
        tiaraVisible,
      };
    },
    getRingAttachmentWorldPos(target: THREE.Vector3): THREE.Vector3 {
      group.updateMatrixWorld(true);
      return rightHandAnchor.getWorldPosition(target);
    },
    getNecklaceAttachmentWorldPos(target: THREE.Vector3): THREE.Vector3 {
      group.updateMatrixWorld(true);
      return necklaceAnchor.getWorldPosition(target);
    },
    getCrownAttachmentWorldPos(target: THREE.Vector3): THREE.Vector3 {
      group.updateMatrixWorld(true);
      return tiaraGroup.getWorldPosition(target);
    },
    setJewelleryEquipped(state: {
      ringIndex?: number | null;
      necklaceIndex?: number | null;
      crownEquipped?: boolean;
    }) {
      if (state.ringIndex !== undefined) {
        equippedRingIndex = state.ringIndex;
        ringGroup.visible = equippedRingIndex !== null;
        if (equippedRingIndex !== null) {
          const hex = RING_COLORS[equippedRingIndex % RING_COLORS.length];
          ringGemMat.color.set(hex);
          ringGemMat.emissive.set(hex);
        }
      }
      if (state.necklaceIndex !== undefined) {
        equippedNecklaceIndex = state.necklaceIndex;
        necklaceGroup.visible = equippedNecklaceIndex !== null;
        if (equippedNecklaceIndex !== null) {
          const hex = NECKLACE_COLORS[equippedNecklaceIndex % NECKLACE_COLORS.length];
          neckPendantMat.color.set(hex);
          neckPendantMat.emissive.set(hex);
        }
      }
      if (state.crownEquipped !== undefined) {
        tiaraVisible = state.crownEquipped;
        tiaraGroup.visible = tiaraVisible;
      }
    },
    getJewelleryEquipped() {
      return {
        ringIndex: equippedRingIndex,
        necklaceIndex: equippedNecklaceIndex,
        crownEquipped: tiaraVisible,
        allThreeWorn:
          equippedRingIndex !== null &&
          equippedNecklaceIndex !== null &&
          tiaraVisible,
      };
    },
    setRaisingHand(raising: boolean) {
      raisingHandForGift = raising;
    },
    setRoseHeld(held: boolean) {
      roseHeld = held;
      heldRoseGroup.visible = held;
    },
    isRoseHeld() {
      return roseHeld;
    },
    setHairRoseVisible(visible: boolean) {
      hairRoseVisible = visible;
      hairRoseFlowerGroup.visible = visible;
    },
    isHairRoseVisible() {
      return hairRoseVisible;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadowTex.dispose();
    },
  };
}
