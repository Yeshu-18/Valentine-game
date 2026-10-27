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
  getProximityPrompt: (playerPos: THREE.Vector3) => { prompt: string; action: 'door' | 'call_elevator' | 'fountain' | 'telescope' | 'none' } | null;
  interact: (playerPos?: THREE.Vector3) => boolean;
  handleElevatorFloorSelect: (floorNum: number) => boolean;
  getCameraFocus: () => { target: THREE.Vector3; position: THREE.Vector3; fov?: number } | null;
  update: (delta: number, playerPos: THREE.Vector3) => void;
  dispose: () => void;
}

function createFountainHologramTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 512, 640);

    // 1. Soft radial cyan & champagne-gold holographic aura
    const bgGrad = ctx.createRadialGradient(256, 310, 24, 256, 310, 250);
    bgGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.42)');
    bgGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.28)');
    bgGrad.addColorStop(0.82, 'rgba(14, 165, 233, 0.08)');
    bgGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 640);

    // 2. Arched Royal Filigree Frame
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(256, 250, 172, Math.PI, 0, false);
    ctx.lineTo(428, 520);
    ctx.quadraticCurveTo(256, 555, 84, 520);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 250, 160, Math.PI, 0, false);
    ctx.lineTo(416, 508);
    ctx.quadraticCurveTo(256, 540, 96, 508);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 3. Glowing Heart Halo behind Yeshwanth & Harsha
    const drawHeart = (cx: number, cy: number, size: number, fill: string, stroke?: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.35);
      ctx.bezierCurveTo(cx - size, cy - size * 0.25, cx - size * 0.55, cy - size * 0.95, cx, cy - size * 0.42);
      ctx.bezierCurveTo(cx + size * 0.55, cy - size * 0.95, cx + size, cy - size * 0.25, cx, cy + size * 0.35);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    };

    ctx.save();
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 22;
    drawHeart(256, 255, 118, 'rgba(253, 224, 71, 0.16)', 'rgba(253, 224, 71, 0.78)');
    ctx.restore();

    // 4. Stylized Romantic Silhouette Portrait of Yeshwanth & Harsha Holding Hands
    ctx.save();
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 18;
    const silGrad = ctx.createLinearGradient(160, 175, 350, 465);
    silGrad.addColorStop(0.0, 'rgba(254, 249, 195, 0.96)');
    silGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.92)');
    silGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.78)');
    ctx.fillStyle = silGrad;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
    ctx.lineWidth = 2.5;

    // Yeshwanth (left, slightly taller, warm gentle posture leaning toward Harsha)
    ctx.beginPath();
    ctx.arc(216, 214, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(182, 438);
    ctx.quadraticCurveTo(180, 290, 196, 246);
    ctx.quadraticCurveTo(216, 238, 236, 248);
    ctx.quadraticCurveTo(250, 285, 254, 332);
    ctx.lineTo(242, 438);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Harsha (right, flowing gown silhouette, leaning warmly against Yeshwanth)
    ctx.beginPath();
    ctx.arc(292, 226, 21.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(252, 438);
    ctx.quadraticCurveTo(260, 325, 272, 256);
    ctx.quadraticCurveTo(292, 248, 310, 258);
    ctx.quadraticCurveTo(334, 335, 348, 438);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Joined hands at center with glowing heart spark
    drawHeart(255, 305, 22, 'rgba(254, 240, 138, 0.95)', 'rgba(255, 255, 255, 0.95)');
    ctx.restore();

    // 5. Floating Heart Sparkles around the couple
    const heartSpots = [
      { x: 132, y: 185, s: 14 },
      { x: 382, y: 192, s: 15 },
      { x: 148, y: 315, s: 12 },
      { x: 372, y: 310, s: 13 },
      { x: 256, y: 125, s: 18 },
      { x: 188, y: 145, s: 11 },
      { x: 326, y: 148, s: 11 },
    ];
    heartSpots.forEach((h) => {
      drawHeart(h.x, h.y, h.s, 'rgba(253, 224, 71, 0.85)', 'rgba(125, 211, 252, 0.9)');
    });

    // 6. Subtle Holographic Scanlines
    ctx.fillStyle = 'rgba(186, 230, 253, 0.09)';
    for (let y = 60; y < 560; y += 6) {
      ctx.fillRect(76, y, 360, 1.5);
    }

    // 7. Romantic Caption & Names on the Hologram Projection
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(14, 165, 233, 0.95)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText('Yeshwanth & Harsha', 256, 478);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'italic 16.5px Georgia, serif';
    ctx.fillText('"Our favorite place in the world', 256, 508);
    ctx.fillText('is right beside you. ♡"', 256, 530);
    ctx.restore();
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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

    // Signature Heart-Arched Window on Heart Tower (front-west tower)
    if (tp.name === 'HeartTower') {
      const heartWinGroup = new THREE.Group();
      heartWinGroup.position.set(0, 13.5, -3.22);
      const lobeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.42, 10, 10));
      const lobeL = new THREE.Mesh(lobeGeo, mats.champagneGold);
      lobeL.position.set(-0.32, 0.35, 0);
      const lobeR = new THREE.Mesh(lobeGeo, mats.champagneGold);
      lobeR.position.set(0.32, 0.35, 0);
      const pointGeo = tracker.trackGeo(new THREE.ConeGeometry(0.62, 0.95, 10));
      pointGeo.rotateX(Math.PI);
      const pointM = new THREE.Mesh(pointGeo, mats.champagneGold);
      pointM.position.set(0, -0.1, 0);
      const glassPaneGeo = tracker.trackGeo(new THREE.CircleGeometry(0.55, 12));
      const glassPane = new THREE.Mesh(glassPaneGeo, mats.warmLanternGlow);
      glassPane.position.set(0, 0.15, -0.05);
      heartWinGroup.add(lobeL, lobeR, pointM, glassPane);
      tGroup.add(heartWinGroup);
    }

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
  // 3. PHYSICAL DOUBLE ENTRANCE DOORS, HINGE PIVOTS & COLLISION BARRIER
  // ========================================================================
  // Temporary doorway barrier colliders active ONLY while doorState === 'CLOSED'
  const doorBarrierColliders: CircleCollider[] = [
    { x: nav.originX - 1.35, z: nav.originZ - 16.0, radius: 0.95 },
    { x: nav.originX, z: nav.originZ - 16.0, radius: 0.95 },
    { x: nav.originX + 1.35, z: nav.originZ - 16.0, radius: 0.95 },
  ];
  doorBarrierColliders.forEach((c) => colliders.push(c));
  let doorBarrierRemoved = false;

  // Left Door: local pivot shifted to far-left outer frame edge (lx = -2.1, rotates +105 deg)
  const leftDoorPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(2.08, 4.4, 0.16));
  leftDoorPanelGeo.translate(1.04, 2.2, 0);
  const leftDoorTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 3.8, 0.22));
  leftDoorTrimGeo.translate(1.04, 2.2, 0);
  const leftHandleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 0.08, 0.16));
  leftHandleGeo.translate(-0.18, 0, 0);

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-2.1, 0.25, -16.0);
  const leftDoorPanel = new THREE.Mesh(leftDoorPanelGeo, mats.blushRoseMarble);
  const leftDoorTrim = new THREE.Mesh(leftDoorTrimGeo, mats.champagneGold);
  const leftDoorHandle = new THREE.Mesh(leftHandleGeo, mats.champagneGold);
  leftDoorHandle.position.set(1.88, 2.05, 0);
  leftDoorPivot.add(leftDoorPanel, leftDoorTrim, leftDoorHandle);

  // Right Door: local pivot shifted to far-right outer frame edge (lx = +2.1, rotates -105 deg)
  const rightDoorPanelGeo = tracker.trackGeo(new THREE.BoxGeometry(2.08, 4.4, 0.16));
  rightDoorPanelGeo.translate(-1.04, 2.2, 0);
  const rightDoorTrimGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 3.8, 0.22));
  rightDoorTrimGeo.translate(-1.04, 2.2, 0);
  const rightHandleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 0.08, 0.16));
  rightHandleGeo.translate(0.18, 0, 0);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(2.1, 0.25, -16.0);
  const rightDoorPanel = new THREE.Mesh(rightDoorPanelGeo, mats.blushRoseMarble);
  const rightDoorTrim = new THREE.Mesh(rightDoorTrimGeo, mats.champagneGold);
  const rightDoorHandle = new THREE.Mesh(rightHandleGeo, mats.champagneGold);
  rightDoorHandle.position.set(-1.88, 2.05, 0);
  rightDoorPivot.add(rightDoorPanel, rightDoorTrim, rightDoorHandle);

  group.add(leftDoorPivot, rightDoorPivot);

  // Arch Header over entrance doors
  const archHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(4.8, 1.4, 0.8));
  archHeaderGeo.translate(0, 5.1, -16.0);
  const archHeader = new THREE.Mesh(archHeaderGeo, mats.blushRoseMarble);
  group.add(archHeader);

  // ========================================================================
  // 4. LEVEL 1: GRAND ENTRANCE HALL, FOUNTAIN HOLOGRAM & CHANDELIER
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

  // Circular Inlaid Pearl-and-Rose Floor Medallion around the Fountain
  const medallionOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(4.8, 4.8, 0.03, 32));
  medallionOuterGeo.translate(0, 0.26, 0);
  const medallionInnerGeo = tracker.trackGeo(new THREE.TorusGeometry(4.2, 0.09, 8, 36));
  medallionInnerGeo.rotateX(Math.PI / 2);
  medallionInnerGeo.translate(0, 0.275, 0);
  const medallionOuter = new THREE.Mesh(medallionOuterGeo, mats.pearlWhite);
  medallionOuter.receiveShadow = true;
  const medallionInner = new THREE.Mesh(medallionInnerGeo, mats.champagneGold);
  group.add(medallionOuter, medallionInner);

  // Open Archway Portals on Floor 1 perimeter walls leading toward future Sprint 2 rooms
  const roomArchPillarGeo = tracker.trackGeo(new THREE.BoxGeometry(0.45, 3.8, 0.45));
  roomArchPillarGeo.translate(0, 2.15, 0);
  const roomArchHeaderGeo = tracker.trackGeo(new THREE.BoxGeometry(0.5, 0.55, 2.9));
  roomArchHeaderGeo.translate(0, 4.15, 0);
  [-15.2, 15.2].forEach((wx) => {
    [-8.5, 0.0, 8.5].forEach((wz) => {
      const p1 = new THREE.Mesh(roomArchPillarGeo, mats.champagneGold);
      p1.position.set(wx, 0, wz - 1.2);
      const p2 = new THREE.Mesh(roomArchPillarGeo, mats.champagneGold);
      p2.position.set(wx, 0, wz + 1.2);
      const hdr = new THREE.Mesh(roomArchHeaderGeo, mats.blushRoseMarble);
      hdr.position.set(wx, 0, wz);
      group.add(p1, p2, hdr);
    });
  });

  // Central Crystal Lotus Water Fountain (Center lx = 0, lz = 0)
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, 0.25, 0);

  const basinOuterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.8, 3.1, 0.75, 24));
  basinOuterGeo.translate(0, 0.375, 0);
  const basinRimGeo = tracker.trackGeo(new THREE.TorusGeometry(2.9, 0.16, 8, 32));
  basinRimGeo.rotateX(Math.PI / 2);
  basinRimGeo.translate(0, 0.75, 0);
  const waterGeo = tracker.trackGeo(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32));
  waterGeo.translate(0, 0.65, 0);

  // Custom Water Ripple Shader that intensifies with cyan & champagne-gold waves when touched
  const fountainWaterUniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 0.0 },
  };
  const fountainWaterShaderMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: fountainWaterUniforms,
      transparent: true,
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        varying vec3 vLocalPos;
        void main() {
          float r = length(vLocalPos.xz);
          float speed = mix(2.4, 6.2, uIntensity);
          float freq = mix(5.5, 10.5, uIntensity);
          float wave1 = sin(r * freq - uTime * speed) * 0.5 + 0.5;
          float wave2 = sin(r * (freq * 1.45) - uTime * (speed * 1.25) + 1.2) * 0.5 + 0.5;
          float ripple = pow(wave1 * wave2, mix(2.2, 1.35, uIntensity));

          vec3 baseWater = vec3(0.48, 0.84, 0.96);
          vec3 cyanGlow = vec3(0.22, 0.78, 0.98);
          vec3 goldCrest = vec3(0.99, 0.91, 0.52);

          vec3 col = mix(baseWater, cyanGlow, ripple * (0.45 + 0.55 * uIntensity));
          col = mix(col, goldCrest, pow(ripple, 2.0) * (0.28 + 0.65 * uIntensity));
          float centerGlow = smoothstep(1.6, 0.0, r) * uIntensity * 0.55;
          col += goldCrest * centerGlow;

          float alpha = mix(0.84, 0.95, uIntensity);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );

  const basinOuter = new THREE.Mesh(basinOuterGeo, mats.blushRoseMarble);
  const basinRim = new THREE.Mesh(basinRimGeo, mats.champagneGold);
  const waterMesh = new THREE.Mesh(waterGeo, fountainWaterShaderMat);
  basinOuter.castShadow = true;
  basinOuter.receiveShadow = true;

  // Expanding Golden-Cyan Water Ripple Rings
  const rippleRingGeo = tracker.trackGeo(new THREE.TorusGeometry(1.0, 0.045, 8, 32));
  rippleRingGeo.rotateX(Math.PI / 2);
  const rippleRingMesh = new THREE.Mesh(rippleRingGeo, mats.warmLanternGlow);
  rippleRingMesh.position.set(0, 0.72, 0);
  rippleRingMesh.visible = false;

  // Hologram Projector Group (Vertical Light Beam + 3D Couple Portrait Canvas + Heart Sparkles & Confetti)
  const hologramGroup = new THREE.Group();
  hologramGroup.position.set(0, 0.7, 0);
  hologramGroup.visible = false;

  // Soft Vertical Beam of Cyan / Champagne-Gold Light beaming upward from basin center
  const beamUniforms = {
    uTime: { value: 0.0 },
    uAlpha: { value: 0.0 },
  };
  const beamMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          float vertFade = sin(vUv.y * 3.14159265) * (1.0 - vUv.y * 0.35);
          float shimmer = 0.82 + 0.18 * sin(vUv.y * 18.0 - uTime * 4.5 + vUv.x * 12.56);
          vec3 cyanCol = vec3(0.25, 0.82, 0.98);
          vec3 goldCol = vec3(0.99, 0.89, 0.48);
          vec3 col = mix(goldCol, cyanCol, vUv.y);
          gl_FragColor = vec4(col, vertFade * shimmer * 0.36 * uAlpha);
        }
      `,
    }),
  );
  const beamGeo = tracker.trackGeo(new THREE.CylinderGeometry(1.25, 0.42, 3.8, 28, 1, true));
  beamGeo.translate(0, 1.9, 0);
  const hologramBeamMesh = new THREE.Mesh(beamGeo, beamMat);
  hologramGroup.add(hologramBeamMesh);

  // Semi-Transparent Glowing 3D Hologram Canvas Plane (Yeshwanth & Harsha Silhouette Portrait)
  const hologramTex = createFountainHologramTexture(tracker);
  const hologramPlaneMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: hologramTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  const hologramBackdropMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: hologramTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const hologramPlaneGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.35, 2.95));
  const hologramBackdropMesh = new THREE.Mesh(hologramPlaneGeo, hologramBackdropMat);
  const hologramGlowMesh = new THREE.Mesh(hologramPlaneGeo, hologramPlaneMat);
  hologramGlowMesh.position.z = 0.01;
  const hologramPortraitPivot = new THREE.Group();
  hologramPortraitPivot.position.set(0, 2.1, 0);
  hologramPortraitPivot.add(hologramBackdropMesh, hologramGlowMesh);
  hologramGroup.add(hologramPortraitPivot);

  // Floating Heart Sparkles & Micro-Confetti Particles orbiting the Hologram
  const blossomSparklesGroup = new THREE.Group();
  blossomSparklesGroup.position.set(0, 0.85, 0);
  blossomSparklesGroup.visible = false;

  const sparkleHeartGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.085, 0));
  const confettiGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.09, 0.055));
  const cyanSparkleMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  const roseConfettiMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: '#f9a8d4',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );

  interface HologramParticle {
    mesh: THREE.Mesh;
    baseAngle: number;
    radius: number;
    baseY: number;
    speed: number;
  }
  const hologramParticles: HologramParticle[] = [];
  for (let b = 0; b < 28; b++) {
    const isHeart = b % 2 === 0;
    const mat = b % 3 === 0 ? mats.warmLanternGlow : b % 3 === 1 ? cyanSparkleMat : roseConfettiMat;
    const sp = new THREE.Mesh(isHeart ? sparkleHeartGeo : confettiGeo, mat);
    const baseAngle = (b * Math.PI * 2) / 28;
    const radius = 1.15 + (b % 4) * 0.28;
    const baseY = (b % 7) * 0.42;
    sp.position.set(Math.cos(baseAngle) * radius, baseY, Math.sin(baseAngle) * radius);
    blossomSparklesGroup.add(sp);
    hologramParticles.push({
      mesh: sp,
      baseAngle,
      radius,
      baseY,
      speed: 0.9 + (b % 5) * 0.22,
    });
  }

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

  fountainGroup.add(
    basinOuter,
    basinRim,
    waterMesh,
    rippleRingMesh,
    hologramGroup,
    blossomSparklesGroup,
    lotusStem,
    lotusPetalsGroup,
  );
  group.add(fountainGroup);
  colliders.push({ x: nav.originX, z: nav.originZ, radius: 2.9 });
  let fountainClock = 0;

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

  // Rooftop Flower Planters & Warm Lanterns along Terrace Balustrade
  const planterBoxGeo = tracker.trackGeo(new THREE.BoxGeometry(2.2, 0.55, 0.85));
  planterBoxGeo.translate(0, 15.72, 0);
  const blossomBushGeo = tracker.trackGeo(new THREE.SphereGeometry(0.55, 10, 8));
  blossomBushGeo.scale(1.6, 0.75, 0.9);
  blossomBushGeo.translate(0, 16.15, 0);
  const lanternPostGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.45, 8));
  lanternPostGeo.translate(0, 16.2, 0);
  const lanternOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.22, 10, 10));
  lanternOrbGeo.translate(0, 17.0, 0);

  [
    { x: -8.5, z: -13.8 },
    { x: 8.5, z: -13.8 },
    { x: -8.5, z: 13.8 },
    { x: 8.5, z: 13.8 },
  ].forEach((pt) => {
    const planter = new THREE.Mesh(planterBoxGeo, mats.pearlWhite);
    planter.position.set(pt.x, 0, pt.z);
    const bush = new THREE.Mesh(blossomBushGeo, mats.blushRoseMarble);
    bush.position.set(pt.x, 0, pt.z);
    const lPost = new THREE.Mesh(lanternPostGeo, mats.champagneGold);
    lPost.position.set(pt.x * 1.15, 0, pt.z);
    const lOrb = new THREE.Mesh(lanternOrbGeo, mats.warmLanternGlow);
    lOrb.position.set(pt.x * 1.15, 0, pt.z);
    group.add(planter, bush, lPost, lOrb);
  });

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
  cabinGroup.position.set(elevatorShaftX, nav.elevatorCabinY - nav.baseY, elevatorShaftZ);

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
          prompt: '[1] Grand Hall  [2] Fashion  [3] Dream Wing  [4] Rooftop  [0/B] Basement',
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

      // 4. Near Central Crystal Fountain on Floor 1
      if (nav.isNearFountain(playerPos)) {
        return {
          prompt: '[E] Touch Fountain Water',
          action: 'fountain',
        };
      }

      // 5. Rooftop Telescope
      const { lx, lz } = nav.worldToLocal(playerPos.x, playerPos.z);
      if (Math.hypot(lx, lz - (-13.5)) <= 2.8 && playerPos.y >= nav.baseY + 14.5) {
        return {
          prompt: '[E] Look through Gilded Telescope',
          action: 'telescope',
        };
      }

      return null;
    },

    interact: (playerPos?: THREE.Vector3) => {
      if (playerPos) {
        if (nav.isNearEntranceDoors(playerPos) && nav.doorState === 'CLOSED') {
          return nav.openEntranceDoors();
        }
        if (nav.isInsideElevatorCabin(playerPos)) {
          return nav.cycleElevatorFloor();
        }
        const callInfo = nav.isNearElevatorFloorCall(playerPos);
        if (callInfo) {
          return nav.callElevatorToFloor(callInfo.floor.id);
        }
        if (nav.isNearFountain(playerPos)) {
          return nav.triggerFountainRipple();
        }
        const { lx, lz } = nav.worldToLocal(playerPos.x, playerPos.z);
        if (Math.hypot(lx, lz - (-13.5)) <= 2.8 && playerPos.y >= nav.baseY + 14.5) {
          nav.triggerRooftopPanoramicPan(playerPos, true);
          return true;
        }
      }
      if (nav.doorState === 'CLOSED') {
        return nav.openEntranceDoors();
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
      fountainClock += delta;

      // Remove temporary doorway barrier collider once entrance doors transition to OPENING / OPEN
      if (!doorBarrierRemoved && nav.doorState !== 'CLOSED') {
        doorBarrierRemoved = true;
        for (const c of doorBarrierColliders) {
          c.radius = -10.0;
          c.x = -99999;
          c.z = -99999;
          const idx = colliders.indexOf(c);
          if (idx !== -1) {
            colliders.splice(idx, 1);
          }
        }
      }

      // Animate Brass Door Handles & Entrance Door Side-Hinge Swing
      // Left door pivots from far-left outer frame edge (+105°), Right door pivots from far-right outer frame edge (-105°)
      leftDoorHandle.rotation.z = -nav.doorHandleAngle;
      rightDoorHandle.rotation.z = nav.doorHandleAngle;
      const maxSwing = THREE.MathUtils.degToRad(105);
      leftDoorPivot.rotation.y = nav.doorOpenRatio * maxSwing;
      rightDoorPivot.rotation.y = -nav.doorOpenRatio * maxSwing;

      // Update Fountain Water Ripple Shader
      const holoAlpha = nav.fountainHologramAlpha;
      fountainWaterUniforms.uTime.value = fountainClock;
      fountainWaterUniforms.uIntensity.value = Math.max(
        holoAlpha,
        nav.fountainRippleTimer > 0 ? 0.55 : 0.0,
      );

      // Animate Fountain Water Ripple Ring, Hologram Light Beam, 3D Couple Portrait & Floating Heart Sparkles
      if (holoAlpha > 0.01 || nav.fountainRippleTimer > 0) {
        const rippleWave = (fountainClock * 0.75) % 1.0;
        rippleRingMesh.visible = true;
        const rippleScale = THREE.MathUtils.lerp(0.65, 2.55, rippleWave);
        rippleRingMesh.scale.set(rippleScale, rippleScale, 1);
      } else {
        rippleRingMesh.visible = false;
      }

      if (holoAlpha > 0.01) {
        hologramGroup.visible = true;
        beamUniforms.uTime.value = fountainClock;
        beamUniforms.uAlpha.value = holoAlpha;

        // Smoothly project the 3D Hologram Canvas Plane upward out of the water & face Harsha
        const riseEase = 1.0 - Math.pow(1.0 - holoAlpha, 3);
        const bobOffset = Math.sin(fountainClock * 2.1) * 0.07;
        hologramPortraitPivot.position.y =
          THREE.MathUtils.lerp(0.65, 2.15, riseEase) + bobOffset;
        const scaleEase = THREE.MathUtils.lerp(0.55, 1.0, riseEase);
        hologramPortraitPivot.scale.setScalar(scaleEase);

        const lookYaw = Math.atan2(
          playerPos.x - nav.originX,
          playerPos.z - nav.originZ,
        );
        hologramPortraitPivot.rotation.y = lookYaw;

        hologramBackdropMat.opacity = holoAlpha * 0.86;
        hologramPlaneMat.opacity =
          holoAlpha * (0.42 + 0.12 * Math.sin(fountainClock * 4.2));

        // Orbiting Heart Sparkles & Micro-Confetti Particles
        blossomSparklesGroup.visible = true;
        cyanSparkleMat.opacity = holoAlpha * 0.9;
        roseConfettiMat.opacity = holoAlpha * 0.9;
        for (let i = 0; i < hologramParticles.length; i++) {
          const p = hologramParticles[i];
          const ang = p.baseAngle + fountainClock * p.speed;
          const lift = ((p.baseY + fountainClock * 0.55) % 2.8) * riseEase;
          const radialPulse = p.radius + Math.sin(fountainClock * 2.4 + i) * 0.12;
          p.mesh.position.set(
            Math.cos(ang) * radialPulse,
            0.35 + lift,
            Math.sin(ang) * radialPulse,
          );
          p.mesh.rotation.y = ang + fountainClock * 1.8;
          p.mesh.rotation.x = Math.sin(fountainClock * 2.2 + i) * 0.45;
        }
      } else {
        hologramGroup.visible = false;
        blossomSparklesGroup.visible = false;
      }

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
