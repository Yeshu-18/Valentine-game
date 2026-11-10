import * as THREE from 'three';
import { CELL_04_WORLD_OFFSET } from './Chapter2Config';

export interface CarInteriorSceneBundle {
  carRootGroup: THREE.Group;
  cabinInteriorGroup: THREE.Group;
  rearPassengerSeatAnchor: THREE.Group;
  cell04RoomGroup: THREE.Group;
  cell04BedAnchor: THREE.Group;
  setVehicleKinematics: (params: {
    worldX: number;
    worldZ: number;
    yaw: number;
    suspensionPitch: number;
    suspensionRoll: number;
    wheelSpinDelta: number;
    steeringAngle: number;
    rearRightDoorOpenRatio: number;
    engineVibrationAmp: number;
    headlightIntensity: number;
    brakeLightIntensity: number;
    indicatorBlinkOn: boolean;
    driverLookAtMirrorRatio?: number;
  }) => void;
  dispose: () => void;
}

/**
 * Generates a Rain-Speckled Window Glass Texture with subtle edge condensation
 * while keeping the center crystal-clear so outside city lights and buildings read sharply.
 */
function createRainWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 256);

    // Subtle rain droplets catching warm amber & cool street light
    for (let i = 0; i < 180; i++) {
      const rx = ((i * 97) % 500) + 6;
      const ry = ((i * 53) % 244) + 6;
      const rSize = 1.1 + (i % 3) * 0.85;
      const alpha = 0.22 + ((i * 19) % 45) / 100;

      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(253, 230, 138, ${alpha.toFixed(2)})`
          : `rgba(186, 230, 253, ${(alpha * 0.85).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rSize * 0.8, rSize * 1.35, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a High-Resolution Glowing Digital Instrument Cluster & GPS Route Screen Texture
 */
function createDashboardClusterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, 1024, 256);

    // Left Tachometer & Right Speedometer Dials
    for (const [idx, cx] of [210, 520].entries()) {
      const grad = ctx.createRadialGradient(cx, 128, 12, cx, 128, 96);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      grad.addColorStop(1, 'rgba(4, 8, 18, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, 128, 96, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, 128, 82, Math.PI * 0.78, Math.PI * 2.22);
      ctx.stroke();

      // Tick marks
      for (let t = 0; t <= 10; t++) {
        const ang = Math.PI * 0.78 + (t / 10) * Math.PI * 1.44;
        ctx.strokeStyle = t >= 8 ? '#f43f5e' : '#bae6fd';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 68, 128 + Math.sin(ang) * 68);
        ctx.lineTo(cx + Math.cos(ang) * 78, 128 + Math.sin(ang) * 78);
        ctx.stroke();
      }

      // Glowing amber needle
      const needleAng = idx === 0 ? -0.45 : -0.25;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, 128);
      ctx.lineTo(cx + Math.cos(needleAng) * 64, 128 + Math.sin(needleAng) * 64);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(idx === 0 ? '2.4' : '46', cx, 136);
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(idx === 0 ? 'RPM x1000' : 'KM/H', cx, 162);
    }

    // Center Infotainment Navigation Map Panel (x = 680..990)
    ctx.fillStyle = '#081224';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(670, 24, 330, 208, 16);
    ctx.fill();
    ctx.stroke();

    // Map grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
    ctx.lineWidth = 1.5;
    for (let gx = 700; gx < 980; gx += 45) {
      ctx.beginPath();
      ctx.moveTo(gx, 28);
      ctx.lineTo(gx, 228);
      ctx.stroke();
    }
    for (let gy = 55; gy < 220; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(674, gy);
      ctx.lineTo(996, gy);
      ctx.stroke();
    }

    // Glowing Amber GPS Route Path
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(720, 205);
    ctx.lineTo(790, 145);
    ctx.lineTo(865, 118);
    ctx.lineTo(935, 58);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DEST: SECTOR 04 · PRIVATE', 690, 52);
    ctx.fillStyle = '#fde68a';
    ctx.font = '14px monospace';
    ctx.fillText('13 FEB 2027 · 10:38 PM', 690, 214);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates the Iconic "EXIT 15" Digital Highway Sign Texture (matching The Last of Us reference image_900bc9ae.png)
 */
function createExit15SignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#060f0a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 250, 58);

    // Green digital dot-matrix background pattern
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    for (let x = 8; x < 248; x += 6) {
      for (let y = 8; y < 56; y += 6) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT 15', 128, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates Horizontal Red Anamorphic Windshield Lens Flare Texture (matching image_900bc9ae.png)
 */
function createRedAnamorphicFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 64);
    const grad = ctx.createRadialGradient(256, 32, 2, 256, 32, 252);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
    grad.addColorStop(0.2, 'rgba(244, 63, 94, 0.65)');
    grad.addColorStop(0.55, 'rgba(225, 29, 72, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 22, 512, 20);

    // Center sharp glowing flare filament
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(246, 30, 20, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates Dark Cinderblock Concrete Wall Texture with Mortar Joints & Institutional Wainscoting (matching image_57be26fb.png & image_8dae1dbd.png)
 */
function createCinderblockWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(0, 0, 512, 512);

    const blockH = 64;
    const blockW = 128;
    for (let y = 0; y < 512; y += blockH) {
      const row = Math.floor(y / blockH);
      const offsetX = (row % 2) * (blockW / 2);
      ctx.strokeStyle = '#10141a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();

      for (let x = -blockW; x <= 512 + blockW; x += blockW) {
        ctx.beginPath();
        ctx.moveTo(x + offsetX, y);
        ctx.lineTo(x + offsetX, y + blockH);
        ctx.stroke();
      }
    }

    // Concrete grimy noise
    for (let i = 0; i < 900; i++) {
      const gx = (i * 97) % 512;
      const gy = (i * 139) % 512;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(8, 10, 14, 0.22)' : 'rgba(42, 52, 64, 0.14)';
      ctx.fillRect(gx, gy, 6, 6);
    }

    // Institutional Green Wainscoting lower wall band (bottom 170px)
    ctx.fillStyle = 'rgba(22, 40, 32, 0.72)';
    ctx.fillRect(0, 342, 512, 170);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 342);
    ctx.lineTo(512, 342);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates Cracked Flagstone Floor Texture (matching image_a94592d6.png)
 */
function createCrackedFlagstoneFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, 512, 512);

    const tileSize = 128;
    ctx.strokeStyle = '#090c10';
    ctx.lineWidth = 5;
    for (let y = 0; y <= 512; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    for (let x = 0; x <= 512; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Surface fissures & cracks catching shadows
    ctx.strokeStyle = 'rgba(6, 8, 11, 0.88)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 22; i++) {
      const cx = ((i * 79) % 460) + 26;
      const cy = ((i * 131) % 460) + 26;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 26, cy + 16);
      ctx.lineTo(cx + 44, cy + 34);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Chapter 2: High-Polygon Executive Sedan Interior/Exterior + Articulated Masked Driver + Cell 04 Room
 *
 * Unified Coordinate System (in carRootGroup & cabinInteriorGroup, where y = 0 is road level, -Z is forward):
 * - Cabin Floorboard: y = 0.24m
 * - Rear Seat Cushion Surface: y = 0.52m, z = +0.62m
 * - Harsha's Rear-Right Passenger Anchor (`rearPassengerSeatAnchor`): (x = +0.36, y = 0.52, z = +0.62)
 *   -> Harsha's Pelvis sits at y = 0.56m, Shoulders at y = 1.04m, Head/Eyes at y = 1.30m!
 * - Roof Header & Panoramic Glass Moonroof: y = 1.64m (34 cm headroom above Harsha's head!)
 * - Front-Left Driver Seat: (x = -0.38, y = 0.50, z = -0.34) with Articulated Masked Driver gripping steering wheel
 * - Front-Right Passenger Seat: Low-profile folded seat (top at y = 0.90m) so cameras & Harsha have an unobstructed view!
 */
export function createCarInteriorScene(): CarInteriorSceneBundle {
  const carRootGroup = new THREE.Group();
  carRootGroup.name = 'Chapter2SedanRoot';

  const cabinInteriorGroup = new THREE.Group();
  cabinInteriorGroup.position.set(0, 0, 0);
  carRootGroup.add(cabinInteriorGroup);

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

  // ============================================================================
  // 1. AUTOMOTIVE PBR MATERIALS
  // ============================================================================
  const bodyPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x080b12,
      roughness: 0.14,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
  );
  const leatherSeatMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1b2230,
      roughness: 0.38,
      metalness: 0.08,
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      sheen: 0.35,
      sheenColor: new THREE.Color(0x3b4861),
    }),
  );
  const leatherBolsterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x131822,
      roughness: 0.34,
      metalness: 0.12,
      clearcoat: 0.25,
    }),
  );
  const leatherStitchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );
  const woodTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b2316,
      roughness: 0.22,
      metalness: 0.1,
      clearcoat: 0.85,
    }),
  );
  const dashboardTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x111622,
      roughness: 0.3,
      metalness: 0.25,
      clearcoat: 0.35,
    }),
  );
  const headlinerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x181f2c,
      roughness: 0.82,
    }),
  );
  const carpetMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d1118,
      roughness: 0.92,
    }),
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.94,
    }),
  );
  const ambientLedCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.8,
    }),
  );
  const ambientLedAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.6,
    }),
  );
  const seatbeltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.5,
      metalness: 0.2,
    }),
  );

  const rainTex = createRainWindowTexture();
  textures.push(rainTex);
  const rainGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbad7f2,
      map: rainTex,
      transparent: true,
      opacity: 0.18,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const clusterTex = createDashboardClusterTexture();
  textures.push(clusterTex);
  const clusterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: clusterTex,
      emissive: 0xffffff,
      emissiveMap: clusterTex,
      emissiveIntensity: 1.15,
      roughness: 0.12,
    }),
  );

  // ============================================================================
  // 2. CHASSIS FLOOR, CENTER CONSOLE, HOOD & TRUNK (y = 0.24m floor)
  // ============================================================================
  const cabinFloor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.92, 0.08, 3.35, 12, 2, 16)),
    carpetMat,
  );
  cabinFloor.position.set(0, 0.24, 0.05);
  cabinFloor.receiveShadow = true;
  cabinInteriorGroup.add(cabinFloor);

  // Center Transmission Console & Leather Armrest with Glowing Cyan Trim
  const centerConsole = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.26, 0.34, 1.32, 8, 6, 12)),
    dashboardTrimMat,
  );
  centerConsole.position.set(0, 0.44, -0.38);
  cabinInteriorGroup.add(centerConsole);

  const consoleWoodTop = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.03, 0.68)),
    woodTrimMat,
  );
  consoleWoodTop.position.set(0, 0.62, -0.52);
  cabinInteriorGroup.add(consoleWoodTop);

  // Chrome Gear Shifter Lever on Center Console
  const gearShifterStick = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 14)),
    chromeMat,
  );
  gearShifterStick.position.set(-0.02, 0.68, -0.56);
  cabinInteriorGroup.add(gearShifterStick);

  const gearShifterKnob = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.022, 0.04, 12, 16)),
    leatherBolsterMat,
  );
  gearShifterKnob.rotation.z = Math.PI / 2;
  gearShifterKnob.position.set(-0.02, 0.74, -0.56);
  cabinInteriorGroup.add(gearShifterKnob);

  // Ambient LED strips along both sides of the Center Console
  const consoleLedGeo = trackGeo(new THREE.BoxGeometry(0.008, 0.012, 1.24));
  for (const side of [-1, 1]) {
    const led = new THREE.Mesh(consoleLedGeo, ambientLedCyanMat);
    led.position.set(side * 0.132, 0.56, -0.38);
    cabinInteriorGroup.add(led);
  }

  // Sculpted Exterior Front Hood & Rear Trunk Deck
  const frontHood = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.94, 0.58, 1.42, 24, 8, 18)),
    bodyPaintMat,
  );
  frontHood.position.set(0, 0.58, -1.96);
  frontHood.castShadow = true;
  cabinInteriorGroup.add(frontHood);

  const rearTrunk = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.94, 0.62, 1.08, 24, 8, 16)),
    bodyPaintMat,
  );
  rearTrunk.position.set(0, 0.62, 1.96);
  rearTrunk.castShadow = true;
  cabinInteriorGroup.add(rearTrunk);

  // ============================================================================
  // 3. SIDE DOORS, WOOD & AMBIENT LED DOOR CARDS, AND RAIN-SPECKLED WINDOWS
  // ============================================================================
  // Left Door Panel (-X side, x = -0.94)
  const leftSidePanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.09, 0.66, 2.65, 4, 8, 16)),
    dashboardTrimMat,
  );
  leftSidePanel.position.set(-0.94, 0.58, 0.05);
  cabinInteriorGroup.add(leftSidePanel);

  const leftDoorWoodStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.02, 0.045, 2.45)),
    woodTrimMat,
  );
  leftDoorWoodStrip.position.set(-0.89, 0.78, 0.05);
  cabinInteriorGroup.add(leftDoorWoodStrip);

  const leftDoorLed = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.01, 0.012, 2.45)),
    ambientLedAmberMat,
  );
  leftDoorLed.position.set(-0.888, 0.75, 0.05);
  cabinInteriorGroup.add(leftDoorLed);

  const leftWindowGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.52, 0.66, 12, 6)),
    rainGlassMat,
  );
  leftWindowGlass.rotation.y = Math.PI / 2;
  leftWindowGlass.position.set(-0.92, 1.24, 0.05);
  cabinInteriorGroup.add(leftWindowGlass);

  // Front-Right Door Panel (+X front, x = +0.94)
  const frontRightPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.09, 0.66, 1.32, 4, 8, 12)),
    dashboardTrimMat,
  );
  frontRightPanel.position.set(0.94, 0.58, -0.62);
  cabinInteriorGroup.add(frontRightPanel);

  const frontRightGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.26, 0.66, 8, 4)),
    rainGlassMat,
  );
  frontRightGlass.rotation.y = -Math.PI / 2;
  frontRightGlass.position.set(0.92, 1.24, -0.62);
  cabinInteriorGroup.add(frontRightGlass);

  // ============================================================================
  // 4. ARTICULATED REAR-RIGHT PASSENGER DOOR (NEXT TO HARSHA AT x = +0.94, z = +0.04..+1.34)
  // ============================================================================
  const rearRightDoorPivot = new THREE.Group();
  rearRightDoorPivot.position.set(0.94, 0.58, 0.04); // Hinged at B-pillar
  cabinInteriorGroup.add(rearRightDoorPivot);

  const rearRightDoorPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.09, 0.66, 1.3, 4, 8, 14)),
    dashboardTrimMat,
  );
  rearRightDoorPanel.position.set(0, 0, 0.65);
  rearRightDoorPivot.add(rearRightDoorPanel);

  const rearRightWoodStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.02, 0.045, 1.18)),
    woodTrimMat,
  );
  rearRightWoodStrip.position.set(-0.048, 0.2, 0.65);
  rearRightDoorPivot.add(rearRightWoodStrip);

  const rearRightLed = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.01, 0.012, 1.18)),
    ambientLedAmberMat,
  );
  rearRightLed.position.set(-0.05, 0.17, 0.65);
  rearRightDoorPivot.add(rearRightLed);

  const doorArmrest = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.032, 0.54, 12, 18)),
    leatherSeatMat,
  );
  doorArmrest.rotation.x = Math.PI / 2;
  doorArmrest.position.set(-0.06, 0.06, 0.66);
  rearRightDoorPivot.add(doorArmrest);

  const interiorDoorHandle = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.024, 0.038, 0.12)),
    chromeMat,
  );
  interiorDoorHandle.position.set(-0.055, 0.18, 0.36);
  rearRightDoorPivot.add(interiorDoorHandle);

  const rearRightDoorGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.24, 0.66, 10, 6)),
    rainGlassMat,
  );
  rearRightDoorGlass.rotation.y = -Math.PI / 2;
  rearRightDoorGlass.position.set(-0.02, 0.66, 0.65);
  rearRightDoorPivot.add(rearRightDoorGlass);

  // ============================================================================
  // 5. HIGH-HEADROOM ROOF FRAME (y = 1.64m) & PANORAMIC TINTED MOONROOF
  //    Provides 34 cm of clear headroom above Harsha's seated head (y = 1.30m)
  // ============================================================================
  const roofSideRailGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.06, 2.55));
  const roofCrossBarGeo = trackGeo(new THREE.BoxGeometry(1.86, 0.06, 0.28));

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(roofSideRailGeo, headlinerMat);
    rail.position.set(side * 0.82, 1.64, 0.05);
    cabinInteriorGroup.add(rail);

    const moonroofLed = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.012, 0.012, 1.85)),
      ambientLedCyanMat,
    );
    moonroofLed.position.set(side * 0.7, 1.61, 0.05);
    cabinInteriorGroup.add(moonroofLed);
  }

  const frontHeaderBar = new THREE.Mesh(roofCrossBarGeo, headlinerMat);
  frontHeaderBar.position.set(0, 1.64, -1.08);
  cabinInteriorGroup.add(frontHeaderBar);

  const rearHeaderBar = new THREE.Mesh(roofCrossBarGeo, headlinerMat);
  rearHeaderBar.position.set(0, 1.64, 1.18);
  cabinInteriorGroup.add(rearHeaderBar);

  const panoramicMoonroofGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.4, 1.98)),
    rainGlassMat,
  );
  panoramicMoonroofGlass.rotation.x = Math.PI / 2;
  panoramicMoonroofGlass.position.set(0, 1.65, 0.05);
  cabinInteriorGroup.add(panoramicMoonroofGlass);

  // Slim A, B, and C Pillars
  const pillarBarGeo = trackGeo(new THREE.CylinderGeometry(0.034, 0.042, 0.76, 16));
  for (const side of [-1, 1]) {
    const aPillar = new THREE.Mesh(pillarBarGeo, dashboardTrimMat);
    aPillar.position.set(side * 0.88, 1.24, -1.16);
    aPillar.rotation.x = 0.42;
    cabinInteriorGroup.add(aPillar);

    const bPillar = new THREE.Mesh(pillarBarGeo, dashboardTrimMat);
    bPillar.position.set(side * 0.91, 1.24, 0.04);
    cabinInteriorGroup.add(bPillar);

    const cPillar = new THREE.Mesh(pillarBarGeo, dashboardTrimMat);
    cPillar.position.set(side * 0.88, 1.24, 1.24);
    cPillar.rotation.x = -0.42;
    cabinInteriorGroup.add(cPillar);
  }

  // Front Windshield & Rear Window
  const frontWindshield = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.74, 0.78, 12, 6)),
    rainGlassMat,
  );
  frontWindshield.position.set(0, 1.24, -1.24);
  frontWindshield.rotation.x = 0.42;
  cabinInteriorGroup.add(frontWindshield);

  // The Last of Us "EXIT 15" Digital Highway Sign overhead at the top of the windshield frame (image_900bc9ae.png)
  const exit15SignTex = createExit15SignTexture();
  textures.push(exit15SignTex);
  const exit15Mat = trackMat(
    new THREE.MeshBasicMaterial({
      map: exit15SignTex,
      transparent: true,
    }),
  );
  const exit15SignMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.38, 0.095)),
    exit15Mat,
  );
  exit15SignMesh.position.set(0.44, 1.58, -1.05);
  exit15SignMesh.rotation.x = 0.22;
  cabinInteriorGroup.add(exit15SignMesh);

  // Red Anamorphic Horizontal Windshield Lens Flare Plane (image_900bc9ae.png & image_d3c7521e.png)
  const redFlareTex = createRedAnamorphicFlareTexture();
  textures.push(redFlareTex);
  const redFlareMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: redFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const redFlareMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.68, 0.12)),
    redFlareMat,
  );
  redFlareMesh.position.set(0.12, 1.18, -1.21);
  redFlareMesh.rotation.x = 0.42;
  cabinInteriorGroup.add(redFlareMesh);

  // Rearview Mirror suspended from Front Header (y = 1.50m, z = -0.84m)
  const mirrorMount = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 10)),
    dashboardTrimMat,
  );
  mirrorMount.position.set(0, 1.58, -0.84);
  cabinInteriorGroup.add(mirrorMount);

  const rearviewMirror = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.068, 0.025)),
    chromeMat,
  );
  rearviewMirror.position.set(0, 1.52, -0.84);
  rearviewMirror.rotation.y = -0.18;
  cabinInteriorGroup.add(rearviewMirror);

  // ============================================================================
  // 6. DASHBOARD, WIDE DIGITAL COCKPIT SCREEN, STEERING WHEEL & ARTICULATED MASKED DRIVER
  // ============================================================================
  const dashboardMain = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.82, 0.38, 0.54, 18, 8, 8)),
    dashboardTrimMat,
  );
  dashboardMain.position.set(0, 0.74, -1.08);
  cabinInteriorGroup.add(dashboardMain);

  const dashWoodTrim = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.78, 0.04, 0.04)),
    woodTrimMat,
  );
  dashWoodTrim.position.set(0, 0.84, -0.81);
  cabinInteriorGroup.add(dashWoodTrim);

  // Dual-Screen Digital Cockpit & GPS Route Display
  const instrumentScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.96, 0.24)),
    clusterMat,
  );
  instrumentScreen.position.set(-0.18, 0.98, -0.84);
  instrumentScreen.rotation.x = -0.14;
  cabinInteriorGroup.add(instrumentScreen);

  // Steering Wheel Pivot (at x = -0.40, y = 0.88, z = -0.68)
  const steeringWheelPivot = new THREE.Group();
  steeringWheelPivot.position.set(-0.4, 0.88, -0.68);
  steeringWheelPivot.rotation.x = -0.28;
  cabinInteriorGroup.add(steeringWheelPivot);

  const steeringWheelRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.175, 0.024, 18, 42)),
    leatherBolsterMat,
  );
  steeringWheelPivot.add(steeringWheelRing);

  const steeringHub = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20)),
    chromeMat,
  );
  steeringHub.rotation.x = Math.PI / 2;
  steeringWheelPivot.add(steeringHub);

  for (const spokeAng of [-0.6, 0.6, Math.PI]) {
    const spoke = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.028, 0.15, 0.018)),
      chromeMat,
    );
    spoke.position.set(Math.sin(spokeAng) * 0.08, -Math.cos(spokeAng) * 0.08, 0);
    spoke.rotation.z = spokeAng;
    steeringWheelPivot.add(spoke);
  }

  // Front-Left Driver Bucket Seat (x = -0.40, z = -0.32)
  const seatBackGeo = trackGeo(new THREE.CapsuleGeometry(0.22, 0.42, 18, 28));
  const seatCushionGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.14, 0.54, 8, 4, 8));
  const headrestGeo = trackGeo(new THREE.CapsuleGeometry(0.088, 0.12, 14, 20));
  const stitchStripGeo = trackGeo(new THREE.CylinderGeometry(0.0045, 0.0045, 0.5, 8));

  const driverSeatGroup = new THREE.Group();
  driverSeatGroup.position.set(-0.4, 0.44, -0.32);
  cabinInteriorGroup.add(driverSeatGroup);

  const dCushion = new THREE.Mesh(seatCushionGeo, leatherSeatMat);
  driverSeatGroup.add(dCushion);

  const dBackrest = new THREE.Mesh(seatBackGeo, leatherSeatMat);
  dBackrest.scale.set(1.12, 1.0, 0.42);
  dBackrest.position.set(0, 0.36, 0.18);
  dBackrest.rotation.x = -0.14;
  driverSeatGroup.add(dBackrest);

  const dHeadrest = new THREE.Mesh(headrestGeo, leatherSeatMat);
  dHeadrest.rotation.z = Math.PI / 2;
  dHeadrest.scale.set(0.82, 1.0, 0.62);
  dHeadrest.position.set(0, 0.72, 0.24);
  driverSeatGroup.add(dHeadrest);

  // Front-Right Passenger Bucket Seat (x = +0.40, z = -0.32) - Upright position matching The Last of Us (image_900bc9ae.png)
  const frontPassSeatGroup = new THREE.Group();
  frontPassSeatGroup.position.set(0.4, 0.44, -0.32);
  cabinInteriorGroup.add(frontPassSeatGroup);

  const fpCushion = new THREE.Mesh(seatCushionGeo, leatherSeatMat);
  frontPassSeatGroup.add(fpCushion);

  const fpBackrest = new THREE.Mesh(seatBackGeo, leatherSeatMat);
  fpBackrest.scale.set(1.12, 1.0, 0.42);
  fpBackrest.position.set(0, 0.36, 0.18);
  fpBackrest.rotation.x = -0.14;
  frontPassSeatGroup.add(fpBackrest);

  const fpHeadrest = new THREE.Mesh(headrestGeo, leatherSeatMat);
  fpHeadrest.rotation.z = Math.PI / 2;
  fpHeadrest.scale.set(0.82, 1.0, 0.62);
  fpHeadrest.position.set(0, 0.72, 0.24);
  frontPassSeatGroup.add(fpHeadrest);

  // Front-Right Passenger Companion Silhouette (Joel Equivalent in image_900bc9ae.png)
  const passCompanionJacketMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x141b27,
      roughness: 0.52,
      metalness: 0.14,
      clearcoat: 0.1,
    }),
  );
  const passCompanionHairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.75,
    }),
  );

  const frontPassCompanionGroup = new THREE.Group();
  frontPassCompanionGroup.position.set(0.4, 0.54, -0.32);
  cabinInteriorGroup.add(frontPassCompanionGroup);

  const fpTorso = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.19, 0.4, 20, 28)),
    passCompanionJacketMat,
  );
  fpTorso.scale.set(1.18, 1.0, 0.82);
  fpTorso.position.set(0, 0.34, 0.02);
  frontPassCompanionGroup.add(fpTorso);

  const fpCollar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.118, 0.03, 14, 28)),
    passCompanionJacketMat,
  );
  fpCollar.rotation.x = Math.PI / 2 - 0.15;
  fpCollar.position.set(0, 0.58, 0.01);
  frontPassCompanionGroup.add(fpCollar);

  const fpHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.128, 28, 28)),
    passCompanionHairMat,
  );
  fpHead.scale.set(0.92, 1.08, 0.98);
  fpHead.position.set(0, 0.72, 0);
  frontPassCompanionGroup.add(fpHead);

  // Left arm resting on center console, right arm resting on door
  const fpLeftArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.046, 0.35, 14, 20)),
    passCompanionJacketMat,
  );
  fpLeftArm.rotation.x = Math.PI / 2 - 0.22;
  fpLeftArm.rotation.z = 0.15;
  fpLeftArm.position.set(-0.19, 0.46, -0.16);
  frontPassCompanionGroup.add(fpLeftArm);

  const fpRightArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.046, 0.35, 14, 20)),
    passCompanionJacketMat,
  );
  fpRightArm.rotation.x = Math.PI / 2 - 0.22;
  fpRightArm.rotation.z = -0.12;
  fpRightArm.position.set(0.2, 0.46, -0.16);
  frontPassCompanionGroup.add(fpRightArm);

  // ============================================================================
  // 7. ARTICULATED MASKED DRIVER RIG (Hands on Steering Wheel + Head Mirror Glance)
  // ============================================================================
  const driverJacketMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x10141d,
      roughness: 0.48,
      metalness: 0.18,
      clearcoat: 0.15,
    }),
  );
  const driverMaskMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e2430,
      roughness: 0.28,
      metalness: 0.65,
      clearcoat: 0.5,
    }),
  );

  const driverGroup = new THREE.Group();
  driverGroup.position.set(-0.4, 0.54, -0.32);
  cabinInteriorGroup.add(driverGroup);

  const driverTorso = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.185, 0.38, 20, 28)),
    driverJacketMat,
  );
  driverTorso.scale.set(1.16, 1.0, 0.78);
  driverTorso.position.set(0, 0.34, 0.02);
  driverGroup.add(driverTorso);

  // Tactical High Collar
  const driverCollar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.115, 0.032, 14, 28)),
    driverJacketMat,
  );
  driverCollar.rotation.x = Math.PI / 2 - 0.15;
  driverCollar.position.set(0, 0.58, 0.01);
  driverGroup.add(driverCollar);

  // Articulated Driver Head & Ballistic Mask
  const driverHeadPivot = new THREE.Group();
  driverHeadPivot.position.set(0, 0.64, 0.0);
  driverGroup.add(driverHeadPivot);

  const driverHeadMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.128, 28, 28)),
    driverJacketMat,
  );
  driverHeadMesh.scale.set(0.92, 1.08, 0.98);
  driverHeadMesh.position.set(0, 0.08, 0);
  driverHeadPivot.add(driverHeadMesh);

  const driverMaskFaceplate = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.126, 24, 24, 0, Math.PI, 0, Math.PI)),
    driverMaskMat,
  );
  driverMaskFaceplate.rotation.x = -Math.PI / 2;
  driverMaskFaceplate.scale.set(0.88, 0.95, 1.05);
  driverMaskFaceplate.position.set(0, 0.075, -0.02);
  driverHeadPivot.add(driverMaskFaceplate);

  // Driver's Articulated Left & Right Arms Gripping the Steering Wheel
  const driverLeftArmPivot = new THREE.Group();
  driverLeftArmPivot.position.set(-0.21, 0.52, 0.0);
  driverGroup.add(driverLeftArmPivot);

  const driverLeftArmMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.048, 0.36, 14, 20)),
    driverJacketMat,
  );
  driverLeftArmMesh.rotation.x = Math.PI / 2 - 0.22;
  driverLeftArmMesh.rotation.z = -0.12;
  driverLeftArmMesh.position.set(0.03, -0.06, -0.18);
  driverLeftArmPivot.add(driverLeftArmMesh);

  const driverRightArmPivot = new THREE.Group();
  driverRightArmPivot.position.set(0.21, 0.52, 0.0);
  driverGroup.add(driverRightArmPivot);

  const driverRightArmMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.048, 0.36, 14, 20)),
    driverJacketMat,
  );
  driverRightArmMesh.rotation.x = Math.PI / 2 - 0.22;
  driverRightArmMesh.rotation.z = 0.12;
  driverRightArmMesh.position.set(-0.03, -0.06, -0.18);
  driverRightArmPivot.add(driverRightArmMesh);

  // ============================================================================
  // 8. PLUSH QUILTED REAR BENCH SEAT & HARSHA'S SEAT ANCHOR (y = 0.52m, z = +0.62m)
  // ============================================================================
  const rearSeatGroup = new THREE.Group();
  rearSeatGroup.position.set(0, 0.44, 0.66);
  cabinInteriorGroup.add(rearSeatGroup);

  const rearBenchCushion = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.68, 0.16, 0.58, 16, 4, 8)),
    leatherSeatMat,
  );
  rearBenchCushion.position.set(0, 0.0, -0.04);
  rearBenchCushion.receiveShadow = true;
  rearSeatGroup.add(rearBenchCushion);

  const rearBenchBackrest = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.68, 0.64, 0.16, 16, 8, 4)),
    leatherSeatMat,
  );
  rearBenchBackrest.position.set(0, 0.38, 0.24);
  rearBenchBackrest.rotation.x = -0.12;
  rearBenchBackrest.receiveShadow = true;
  rearSeatGroup.add(rearBenchBackrest);

  // Quilted Vertical Stitching Ribs & Diagonal Seat Belts on Rear Bench
  for (let sx = -0.66; sx <= 0.66; sx += 0.22) {
    const seam = new THREE.Mesh(stitchStripGeo, leatherStitchMat);
    seam.position.set(sx, 0.38, 0.155);
    seam.rotation.x = -0.12;
    rearSeatGroup.add(seam);
  }

  for (const side of [-1, 1]) {
    const rHeadrest = new THREE.Mesh(headrestGeo, leatherBolsterMat);
    rHeadrest.rotation.z = Math.PI / 2;
    rHeadrest.scale.set(0.86, 1.0, 0.65);
    rHeadrest.position.set(side * 0.38, 0.76, 0.28);
    rearSeatGroup.add(rHeadrest);

    const beltStrap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.048, 0.66, 0.008)),
      seatbeltMat,
    );
    beltStrap.position.set(side * 0.46, 0.38, 0.15);
    beltStrap.rotation.z = side * 0.38;
    beltStrap.rotation.x = -0.12;
    rearSeatGroup.add(beltStrap);
  }

  // Fold-Down Center Rear Armrest between Left and Right Rear Seats
  const rearCenterArmrest = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.11, 0.44, 6, 4, 8)),
    leatherBolsterMat,
  );
  rearCenterArmrest.position.set(0, 0.13, -0.02);
  rearSeatGroup.add(rearCenterArmrest);

  // HARSHA'S REAR-RIGHT PASSENGER SEAT ANCHOR:
  // Placed directly on top of the rear seat cushion at (x = +0.36, y = 0.52, z = +0.62)
  const rearPassengerSeatAnchor = new THREE.Group();
  rearPassengerSeatAnchor.position.set(0.36, 0.52, 0.62);
  cabinInteriorGroup.add(rearPassengerSeatAnchor);

  // ============================================================================
  // 9. 4 HIGH-POLYGON WHEELS, HEADLIGHTS, TAILLIGHTS & TURN INDICATORS
  // ============================================================================
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f1217,
      roughness: 0.72,
    }),
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 3.8,
    }),
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
    }),
  );
  const indicatorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0,
    }),
  );

  const wheelTireGeo = trackGeo(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 36));
  const wheelRimGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 28));
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.27, 0.032, 0.42));

  const wheelSpinGroups: THREE.Group[] = [];
  const frontSteerGroups: THREE.Group[] = [];

  for (const wc of [
    { x: -0.96, z: -1.48, isFront: true },
    { x: 0.96, z: -1.48, isFront: true },
    { x: -0.96, z: 1.48, isFront: false },
    { x: 0.96, z: 1.48, isFront: false },
  ]) {
    const steerGroup = new THREE.Group();
    steerGroup.position.set(wc.x, 0.35, wc.z);
    carRootGroup.add(steerGroup);
    if (wc.isFront) frontSteerGroups.push(steerGroup);

    const spinGroup = new THREE.Group();
    steerGroup.add(spinGroup);
    wheelSpinGroups.push(spinGroup);

    const tire = new THREE.Mesh(wheelTireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinGroup.add(tire);

    const rim = new THREE.Mesh(wheelRimGeo, chromeMat);
    rim.rotation.z = Math.PI / 2;
    spinGroup.add(rim);

    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(spokeGeo, chromeMat);
      spoke.rotation.x = (s / 5) * Math.PI;
      spinGroup.add(spoke);
    }
  }

  const hlPodGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.12, 0.08));
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(hlPodGeo, headlightMat);
    hl.position.set(side * 0.68, 0.62, -2.66);
    cabinInteriorGroup.add(hl);

    const tl = new THREE.Mesh(hlPodGeo, taillightMat);
    tl.position.set(side * 0.68, 0.68, 2.5);
    cabinInteriorGroup.add(tl);

    const ind = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.048, 14, 14)),
      indicatorMat,
    );
    ind.position.set(side * 0.88, 0.62, -2.6);
    cabinInteriorGroup.add(ind);
  }

  const carHeadlightSpot = new THREE.SpotLight(
    0xe0f2fe,
    6.5,
    55,
    Math.PI / 3.8,
    0.45,
    1.2,
  );
  carHeadlightSpot.position.set(0, 0.68, -2.6);
  const hlTarget = new THREE.Object3D();
  hlTarget.position.set(0, 0.1, -22.0);
  cabinInteriorGroup.add(hlTarget);
  carHeadlightSpot.target = hlTarget;
  cabinInteriorGroup.add(carHeadlightSpot);

  // ============================================================================
  // 10. CELL 04: THE AWAKENING ROOM SET (MATCHING REFERENCE IMAGES 57be26fb, 8dae1dbd, a94592d6)
  // ============================================================================
  const cell04RoomGroup = new THREE.Group();
  cell04RoomGroup.name = 'Chapter2Cell04AwakeningSet';
  cell04RoomGroup.position.set(
    CELL_04_WORLD_OFFSET.x,
    CELL_04_WORLD_OFFSET.y,
    CELL_04_WORLD_OFFSET.z,
  );

  const cinderblockTex = createCinderblockWallTexture();
  textures.push(cinderblockTex);
  const cellWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cinderblockTex,
      roughness: 0.82,
      metalness: 0.12,
    }),
  );

  const flagstoneTex = createCrackedFlagstoneFloorTexture();
  textures.push(flagstoneTex);
  const cellFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: flagstoneTex,
      roughness: 0.72,
      metalness: 0.22,
    }),
  );

  const ironFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161a22,
      roughness: 0.45,
      metalness: 0.78,
    }),
  );
  const mattressMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8e1ec,
      roughness: 0.78,
    }),
  );
  const blanketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x273444,
      roughness: 0.85,
    }),
  );
  const deskWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.65,
    }),
  );
  const chairWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4a3424,
      roughness: 0.62,
    }),
  );

  // Cracked Stone Flagstone Floor (image_a94592d6.png)
  const cellFloor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(6.4, 6.0)),
    cellFloorMat,
  );
  cellFloor.rotation.x = -Math.PI / 2;
  cellFloor.receiveShadow = true;
  cell04RoomGroup.add(cellFloor);

  // Dark Concrete Ceiling with High Skylight Aperture (image_a94592d6.png)
  const cellCeiling = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(6.4, 6.0)),
    cellWallMat,
  );
  cellCeiling.rotation.x = Math.PI / 2;
  cellCeiling.position.y = 3.4;
  cell04RoomGroup.add(cellCeiling);

  const backWall = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.4, 3.4, 0.2)),
    cellWallMat,
  );
  backWall.position.set(0, 1.7, -2.8);
  cell04RoomGroup.add(backWall);

  const leftWall = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.2, 3.4, 6.0)),
    cellWallMat,
  );
  leftWall.position.set(-3.1, 1.7, 0);
  cell04RoomGroup.add(leftWall);

  const rightWall = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.2, 3.4, 6.0)),
    cellWallMat,
  );
  rightWall.position.set(3.1, 1.7, 0);
  cell04RoomGroup.add(rightWall);

  // High Ceiling Skylight Aperture Grate & Dramatic Volumetric God-Ray Beam (image_a94592d6.png)
  const skylightFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.2, 0.12, 1.2)),
    ironFrameMat,
  );
  skylightFrame.position.set(-1.6, 3.36, -1.35);
  cell04RoomGroup.add(skylightFrame);

  // Angled Volumetric God-Ray Light Beam Cone slicing across the cell onto the cot
  const godRayGeo = trackGeo(new THREE.CylinderGeometry(0.35, 1.55, 3.9, 24, 1, true));
  const godRayMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff3db,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const godRayBeam = new THREE.Mesh(godRayGeo, godRayMat);
  godRayBeam.position.set(-1.42, 1.75, -1.05);
  godRayBeam.rotation.z = -0.22;
  godRayBeam.rotation.x = 0.18;
  cell04RoomGroup.add(godRayBeam);

  // Focused Directional Skylight God-Ray Spot
  const godRaySpot = new THREE.SpotLight(0xffedd5, 7.5, 9.5, Math.PI / 4.5, 0.45, 1.2);
  godRaySpot.position.set(-1.6, 3.32, -1.35);
  const godRayTarget = new THREE.Object3D();
  godRayTarget.position.set(-1.25, 0.44, -0.75);
  cell04RoomGroup.add(godRayTarget);
  godRaySpot.target = godRayTarget;
  cell04RoomGroup.add(godRaySpot);

  // Industrial Galvanized Conduit Pipes & Junction Box (image_8dae1dbd.png & image_de7d2def.png)
  const pipeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.82,
    }),
  );
  const ceilingPipe = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 5.8, 12)),
    pipeMat,
  );
  ceilingPipe.rotation.z = Math.PI / 2;
  ceilingPipe.position.set(0, 3.28, -2.6);
  cell04RoomGroup.add(ceilingPipe);

  const verticalPipe = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 2.8, 12)),
    pipeMat,
  );
  verticalPipe.position.set(1.15, 1.8, -2.68);
  cell04RoomGroup.add(verticalPipe);

  const junctionBox = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.18, 0.22, 0.1)),
    pipeMat,
  );
  junctionBox.position.set(1.15, 2.7, -2.65);
  cell04RoomGroup.add(junctionBox);

  // Solitary Vintage Wooden Chair sitting in the shadows near the wall (image_57be26fb.png)
  const solitaryChair = new THREE.Group();
  solitaryChair.position.set(2.05, 0, -0.45);
  solitaryChair.rotation.y = -0.32;
  cell04RoomGroup.add(solitaryChair);

  const chairSeat = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.46, 0.045, 0.44)),
    chairWoodMat,
  );
  chairSeat.position.set(0, 0.45, 0);
  chairSeat.castShadow = true;
  solitaryChair.add(chairSeat);

  const legGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.015, 0.45, 10));
  for (const [lx, lz] of [
    [-0.18, -0.17],
    [0.18, -0.17],
    [-0.18, 0.17],
    [0.18, 0.17],
  ]) {
    const leg = new THREE.Mesh(legGeo, chairWoodMat);
    leg.position.set(lx, 0.225, lz);
    solitaryChair.add(leg);
  }

  // Chair Backrest with vertical spindles
  const backPostGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 10));
  for (const bx of [-0.18, 0.18]) {
    const post = new THREE.Mesh(backPostGeo, chairWoodMat);
    post.position.set(bx, 0.7, -0.18);
    solitaryChair.add(post);
  }
  const topCrest = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.44, 0.065, 0.03)),
    chairWoodMat,
  );
  topCrest.position.set(0, 0.92, -0.18);
  solitaryChair.add(topCrest);

  for (const sx of [-0.09, 0, 0.09]) {
    const spindle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.42, 8)),
      chairWoodMat,
    );
    spindle.position.set(sx, 0.68, -0.18);
    solitaryChair.add(spindle);
  }

  // Heavy Reinforced Steel Security Door with Hazard Trim & Observation Slit (image_8dae1dbd.png & image_57be26fb.png)
  const steelDoorGroup = new THREE.Group();
  steelDoorGroup.position.set(1.85, 0, -2.68);
  cell04RoomGroup.add(steelDoorGroup);

  const doorFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.28, 2.38, 0.16)),
    ironFrameMat,
  );
  doorFrame.position.set(0, 1.19, 0);
  steelDoorGroup.add(doorFrame);

  const doorPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.12, 2.24, 0.09)),
    ironFrameMat,
  );
  doorPanel.position.set(0, 1.16, 0.02);
  steelDoorGroup.add(doorPanel);

  // Reinforcing steel ribs
  for (const ry of [0.45, 1.15, 1.85]) {
    const rib = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.06, 0.045, 0.035)),
      ironFrameMat,
    );
    rib.position.set(0, ry, 0.07);
    steelDoorGroup.add(rib);
  }

  // Rectangular Inspection Window with safety glass & metal bars
  const windowOpening = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.36, 0.22, 0.12)),
    ironFrameMat,
  );
  windowOpening.position.set(0, 1.48, 0.02);
  steelDoorGroup.add(windowOpening);

  const inspectionGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.32, 0.18)),
    rainGlassMat,
  );
  inspectionGlass.position.set(0, 1.48, 0.07);
  steelDoorGroup.add(inspectionGlass);

  // Yellow/Black Hazard Caution Header Strip
  const hazardHeader = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.18, 0.085, 0.025)),
    indicatorMat,
  );
  hazardHeader.position.set(0, 2.32, 0.08);
  steelDoorGroup.add(hazardHeader);

  // Iron Frame Bed Cot in Cell 04 (where Harsha awakens under the god ray!)
  const cell04BedAnchor = new THREE.Group();
  cell04BedAnchor.position.set(-1.25, 0, -0.75);
  cell04RoomGroup.add(cell04BedAnchor);

  const bedMattress = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.2, 0.24, 2.1, 8, 4, 12)),
    mattressMat,
  );
  bedMattress.position.set(0, 0.44, 0);
  bedMattress.castShadow = true;
  cell04BedAnchor.add(bedMattress);

  const bedBlanket = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.22, 0.25, 1.15, 8, 4, 8)),
    blanketMat,
  );
  bedBlanket.position.set(0, 0.46, 0.45);
  cell04BedAnchor.add(bedBlanket);

  const bedPillow = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.13, 0.58, 14, 20)),
    mattressMat,
  );
  bedPillow.rotation.z = Math.PI / 2;
  bedPillow.scale.set(0.65, 1.0, 1.2);
  bedPillow.position.set(0, 0.6, -0.72);
  cell04BedAnchor.add(bedPillow);

  const headboardArch = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.56, 0.026, 12, 28, Math.PI)),
    ironFrameMat,
  );
  headboardArch.position.set(0, 0.56, -1.04);
  cell04BedAnchor.add(headboardArch);

  const footboardArch = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.56, 0.026, 12, 28, Math.PI)),
    ironFrameMat,
  );
  footboardArch.position.set(0, 0.44, 1.04);
  cell04BedAnchor.add(footboardArch);

  // Wooden Desk, Vintage Rotary Telephone, Desk Lamp
  const cellDesk = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.3, 0.76, 0.72)),
    deskWoodMat,
  );
  cellDesk.position.set(0.65, 0.38, -2.05);
  cellDesk.castShadow = true;
  cell04RoomGroup.add(cellDesk);

  const rotaryPhoneBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.095, 0.125, 0.095, 20)),
    ironFrameMat,
  );
  rotaryPhoneBase.position.set(0.5, 0.81, -2.0);
  cell04RoomGroup.add(rotaryPhoneBase);

  const rotaryHandset = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.025, 0.17, 12, 18)),
    ironFrameMat,
  );
  rotaryHandset.rotation.z = Math.PI / 2;
  rotaryHandset.position.set(0.5, 0.87, -2.0);
  cell04RoomGroup.add(rotaryHandset);

  // Warm Desk Lamp next to the Rotary Phone
  const deskLampLight = new THREE.PointLight(0xfbbf24, 3.8, 6.5, 1.3);
  deskLampLight.position.set(0.95, 1.12, -1.95);
  cell04RoomGroup.add(deskLampLight);

  // Overhead Industrial Cone Pendant Lamp (image_57be26fb.png)
  const lampCord = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.65, 8)),
    ironFrameMat,
  );
  lampCord.position.set(-0.2, 3.08, -0.4);
  cell04RoomGroup.add(lampCord);

  const lampShade = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.3, 0.2, 24, 1, true)),
    ironFrameMat,
  );
  lampShade.position.set(-0.2, 2.72, -0.4);
  cell04RoomGroup.add(lampShade);

  const cellOverheadLight = new THREE.PointLight(0xf59e0b, 5.5, 12.0, 1.3);
  cellOverheadLight.position.set(-0.2, 2.58, -0.4);
  cell04RoomGroup.add(cellOverheadLight);

  const cellBedKeyLight = new THREE.PointLight(0xffedd5, 3.8, 6.0, 1.2);
  cellBedKeyLight.position.set(-1.1, 1.65, -0.85);
  cell04RoomGroup.add(cellBedKeyLight);

  return {
    carRootGroup,
    cabinInteriorGroup,
    rearPassengerSeatAnchor,
    cell04RoomGroup,
    cell04BedAnchor,
    setVehicleKinematics(params) {
      carRootGroup.position.set(params.worldX, 0, params.worldZ);
      carRootGroup.rotation.y = params.yaw;

      // Subtle engine micro-vibration + suspension pitch & roll
      const nowSec = performance.now() * 0.001;
      const vibY =
        Math.sin(nowSec * 38.0) * 0.0014 * params.engineVibrationAmp;
      cabinInteriorGroup.position.y = vibY;
      cabinInteriorGroup.rotation.x = params.suspensionPitch;
      cabinInteriorGroup.rotation.z = params.suspensionRoll;

      for (const fg of frontSteerGroups) {
        fg.rotation.y = params.steeringAngle;
      }
      for (const wg of wheelSpinGroups) {
        wg.rotation.x -= params.wheelSpinDelta;
      }

      // Rotate Steering Wheel & Masked Driver's Hands/Arms dynamically!
      const wheelRot = params.steeringAngle * 3.2 + Math.sin(nowSec * 1.4) * 0.06;
      steeringWheelPivot.rotation.z = wheelRot;
      driverLeftArmPivot.rotation.z = wheelRot * 0.28;
      driverRightArmPivot.rotation.z = wheelRot * 0.28;
      driverTorso.rotation.z = -params.suspensionRoll * 1.6;

      // Masked Driver subtly glances toward the rearview mirror at Harsha
      const mirrorGlance = params.driverLookAtMirrorRatio ?? 0;
      driverHeadPivot.rotation.y =
        -0.28 * mirrorGlance + Math.sin(nowSec * 0.7) * 0.05;
      driverHeadPivot.rotation.x = 0.04 * mirrorGlance;

      // Rear-right passenger door opening/closing angle (negative Y swings door outward to +X)
      rearRightDoorPivot.rotation.y = -params.rearRightDoorOpenRatio * 1.12;

      carHeadlightSpot.intensity = params.headlightIntensity;
      headlightMat.emissiveIntensity = params.headlightIntensity > 0.2 ? 3.8 : 0;
      taillightMat.emissiveIntensity = params.brakeLightIntensity;
      indicatorMat.emissiveIntensity = params.indicatorBlinkOn ? 3.4 : 0;
    },
    dispose() {
      for (const t of textures) t.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
