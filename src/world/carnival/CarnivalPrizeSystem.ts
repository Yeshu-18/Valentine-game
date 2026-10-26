/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  ResourceTracker,
  ThemeParkMaterials,
  createHeartShape2D,
} from '../ProceduralKit';
import { CarnivalAudioSynthesizer } from './CarnivalAudio';
import {
  PrizeCinematicFXSystem,
  createWorldSpaceMessagePlaque,
  dampedSpring,
} from './PrizeCinematicFX';
import { CarnivalPrizeDefinition } from './CarnivalState';

export interface PrizeCinematicConfig {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  caption: string;
  message: string;
  titleInscription: string;
  holdExtraSeconds: number; // e.g. 2.0s for #3 Memory Card and #7 Sky Ticket
}

export const CARNIVAL_PRIZES: Record<string, CarnivalPrizeDefinition & PrizeCinematicConfig> = {
  // 1. Heartshot
  paired_heart_charm: {
    id: 'paired_heart_charm',
    name: 'Tiny Heart Token',
    category: 'Heartshot Keepsake',
    subtitle: 'Handcrafted Rose & Gold Token',
    caption: 'A tiny heart token carved from warm brushed gold and rose enamel.',
    titleInscription: 'For Harsha ♡',
    message: 'A tiny heart for you.',
    holdExtraSeconds: 0,
  },
  // 2. Ring Toss
  twin_ring_charms: {
    id: 'twin_ring_charms',
    name: 'Matching H + Y Charms',
    category: 'Ring Toss Keepsake',
    subtitle: 'Magnetic Companion Charms',
    caption: 'Two interlinked companion charms crafted to click together.',
    titleInscription: 'H + Y ♡',
    message: 'Some things are better as a pair.',
    holdExtraSeconds: 0,
  },
  // 3. Prize Knockdown
  little_rose_token: {
    id: 'little_rose_token',
    name: 'Tiny Memory Card',
    category: 'Knockdown Keepsake',
    subtitle: 'Keepsake Polaroid Photo',
    caption: 'A miniature polaroid memory card of a magical starlight moment.',
    titleInscription: 'A little memory to keep.',
    message: 'Every moment with you is my favorite memory. ♡',
    holdExtraSeconds: 2.0, // Extra 2.0s hold to view photo
  },
  // 4. Frog Launch
  golden_star_token: {
    id: 'golden_star_token',
    name: 'Cute Little Frog',
    category: 'Frog Launch Keepsake',
    subtitle: 'Playful Crowned Stepper',
    caption: 'An adorable crowned little frog holding a glowing heart.',
    titleInscription: 'For the girl who makes everything more fun.',
    message: 'You bring endless joy and laughter to my world. ♡',
    holdExtraSeconds: 0,
  },
  // 5. Mystery Egg
  tiny_aurora_crystal: {
    id: 'tiny_aurora_crystal',
    name: 'Mystery Memory Charm',
    category: 'Mystery Capsule Keepsake',
    subtitle: 'Shimmering Emerald-Teal Prism',
    caption: 'A delicate egg that pops open to reveal a shimmering aurora crystal.',
    titleInscription: 'A little mystery from the Carnival.',
    message: 'You are the most wonderful discovery of my life. ♡',
    holdExtraSeconds: 0,
  },
  // 6. Carousel
  mini_carousel_horse: {
    id: 'mini_carousel_horse',
    name: 'Mini Carousel Horse',
    category: 'Carousel Keepsake',
    subtitle: 'Handcrafted Music-Box Steed',
    caption: 'A miniature carved carousel horse that spins on a brass spiral pole.',
    titleInscription: 'Our Little Ride',
    message: 'Some moments are worth going around twice. ♡',
    holdExtraSeconds: 0,
  },
  // 7. Ferris Wheel
  unfolding_sky_ticket: {
    id: 'unfolding_sky_ticket',
    name: 'Unfolding Sky Ticket',
    category: 'Ferris Wheel Keepsake',
    subtitle: '3-Panel Gold Foil Ticket',
    caption: 'PASSENGER: HARSHA | SEAT: NEXT TO YESHWANTH | DESTINATION: ANYWHERE',
    titleInscription: 'PASSENGER: HARSHA | SEAT: NEXT TO YESHWANTH',
    message: "I'd choose the seat next to you anywhere in this universe. ♡",
    holdExtraSeconds: 2.0, // Extra 2.0s hold to read all three panels
  },
  // 8. Quiet Garden
  little_glowing_flower: {
    id: 'little_glowing_flower',
    name: 'Little Glowing Flower',
    category: 'Quiet Garden Keepsake',
    subtitle: 'Bioluminescent Night Blossom',
    caption: 'A delicate blossom that gently unfurls glowing petals under the night sky.',
    titleInscription: 'For all the little things you do.',
    message: 'Thank you for loving me so purely and beautifully. ♡',
    holdExtraSeconds: 0,
  },
};

export interface PrizeDisplayBoxInstance {
  group: THREE.Group;
  lidPivot: THREE.Group;
  charmPivot: THREE.Group;
  glowRing: THREE.Mesh;
  messagePlaque: ReturnType<typeof createWorldSpaceMessagePlaque>;
  setOpenProgress: (openU: number, elapsedTime: number) => void;
  setTactileTilt: (tiltYaw: number, tiltPitch: number) => void;
  updateCinematicAnimation: (
    timeInCinematic: number,
    elapsedTime: number,
    fx: PrizeCinematicFXSystem,
    audio: CarnivalAudioSynthesizer,
  ) => void;
  dispose: () => void;
}

/**
 * Builds high-resolution texture for #1 Tiny Heart Token: "For Harsha ♡".
 */
function createTokenFrontTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm polished gold background
  ctx.fillStyle = '#fce59f';
  ctx.fillRect(0, 0, 512, 512);

  // Outer beveled filigree circle
  ctx.strokeStyle = '#c48f32';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(256, 256, 230, 0, Math.PI * 2);
  ctx.stroke();

  // Inner rose enamel ring
  ctx.strokeStyle = '#c23b57';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 205, 0, Math.PI * 2);
  ctx.stroke();

  // Fine bead dots around rim
  ctx.fillStyle = '#b37e25';
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(256 + Math.cos(a) * 218, 256 + Math.sin(a) * 218, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Heart silhouette
  ctx.fillStyle = '#8a2339';
  ctx.beginPath();
  ctx.moveTo(256, 320);
  ctx.bezierCurveTo(160, 240, 170, 160, 256, 210);
  ctx.bezierCurveTo(342, 160, 352, 240, 256, 320);
  ctx.fill();

  // Inscription text: "For Harsha ♡"
  ctx.fillStyle = '#fff4db';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('For Harsha', 256, 250);
  ctx.font = '32px serif';
  ctx.fillText('♡', 256, 285);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds high-resolution texture for #3 Memory Card: Authentic polaroid snapshot of Yeshwanth and Harsha
 * with boosted vibrance (contrast 1.08, saturate 1.12) and warm paper cardstock border (#fffef9).
 */
function createMemoryPhotoTexture(
  tracker: ResourceTracker,
  loadedImg?: HTMLImageElement,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // Warm paper cardstock frame (#fffef9)
  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, 512, 600);

  // Subtle paper grain
  ctx.fillStyle = 'rgba(180, 140, 100, 0.03)';
  for (let i = 0; i < 300; i++) {
    ctx.fillRect((i * 79) % 512, (i * 53) % 600, 2, 2);
  }

  // Outer gold-accented paper bevel line
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 580);

  // Photo area (440 x 420 at x=36, y=36)
  const px = 36;
  const py = 36;
  const pw = 440;
  const ph = 420;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.filter = 'contrast(1.08) saturate(1.12)';

  if (loadedImg && loadedImg.width > 0) {
    const imgAspect = loadedImg.width / loadedImg.height;
    const boxAspect = pw / ph;
    let drawW = pw;
    let drawH = ph;
    let drawX = px;
    let drawY = py;
    if (imgAspect > boxAspect) {
      drawW = ph * imgAspect;
      drawX = px - (drawW - pw) * 0.5;
    } else {
      drawH = pw / imgAspect;
      drawY = py - (drawH - ph) * 0.5;
    }
    ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);
  } else {
    // Vibrant romantic starlight aurora landscape background
    const photoGrad = ctx.createLinearGradient(px, py, px, py + ph);
    photoGrad.addColorStop(0, '#0f2447');
    photoGrad.addColorStop(0.35, '#0d9488');
    photoGrad.addColorStop(0.7, '#be185d');
    photoGrad.addColorStop(1, '#fde68a');
    ctx.fillStyle = photoGrad;
    ctx.fillRect(px, py, pw, ph);

    // Twinkling stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 45; i++) {
      const sx = px + ((i * 97) % pw);
      const sy = py + ((i * 53) % Math.floor(ph * 0.6));
      const r = (i % 3) + 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Romantic couple silhouette sitting together on the viewing hill
    const cx = px + pw / 2;
    const cy = py + ph - 20;

    // Gentle grassy knoll
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 40, 260, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bench
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy - 10);
    ctx.lineTo(cx + 50, cy - 10);
    ctx.stroke();

    // Yeshwanth and Harsha sitting together side-by-side with heads leaning close
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx - 16, cy - 42, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 28, cy - 28, 22, 28);

    ctx.beginPath();
    ctx.arc(cx + 8, cy - 38, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 2, cy - 26, 20, 26);

    // Soft warm glow surrounding the couple
    const glow = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, 120);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();

  ctx.strokeStyle = '#d94668';
  ctx.lineWidth = 3;
  ctx.strokeRect(px, py, pw, ph);

  // Polaroid bottom margin handwritten note: "Yeshwanth & Harsha ♡"
  ctx.fillStyle = '#372027';
  ctx.font = 'bold italic 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Yeshwanth & Harsha ♡', 256, 505);

  ctx.fillStyle = '#8c3b4f';
  ctx.font = '18px Georgia, serif';
  ctx.fillText('Our Favorite Place · Heart Island', 256, 545);

  // Delicate hand-drawn heart doodle in top-right corner
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  const hx = 450;
  const hy = 58;
  ctx.moveTo(hx, hy + 12);
  ctx.bezierCurveTo(hx - 16, hy, hx - 12, hy - 14, hx, hy - 4);
  ctx.bezierCurveTo(hx + 12, hy - 14, hx + 16, hy, hx, hy + 12);
  ctx.fill();

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds engraved brass plaque texture for the Revolving Carousel Horse Pedestal:
 * "Our Little Ride · Some moments are worth going around twice. ♡"
 */
function createCarouselPlaqueTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0, '#f7d87c');
  grad.addColorStop(0.5, '#ffeaa7');
  grad.addColorStop(1, '#d49b35');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#6e4711';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = '#3d2206';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Our Little Ride', 256, 42);

  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillText('Some moments are worth going around twice. ♡', 256, 84);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds high-resolution texture for #7 Ferris Wheel: 3-Panel Panoramic Sky Ticket.
 */
function createSkyTicketTextures(tracker: ResourceTracker): {
  panelLeft: THREE.CanvasTexture;
  panelCenter: THREE.CanvasTexture;
  panelRight: THREE.CanvasTexture;
} {
  const createPanelCanvas = (headline: string, line1: string, line2: string, motif: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;

    // Vintage ivory parchment
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Warm gold double-border
    ctx.strokeStyle = '#c89646';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.strokeStyle = '#8c3b4f';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Perforated edge marks
    ctx.fillStyle = '#d4af37';
    for (let y = 20; y < canvas.height - 20; y += 18) {
      ctx.beginPath();
      ctx.arc(8, y, 3, 0, Math.PI * 2);
      ctx.arc(canvas.width - 8, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Headline
    ctx.fillStyle = '#8c3b4f';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headline.toUpperCase(), canvas.width / 2, 45);

    // Main line 1
    ctx.fillStyle = '#2d121c';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillText(line1, canvas.width / 2, 95);

    // Line 2
    ctx.fillStyle = '#8c3b4f';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText(line2, canvas.width / 2, 140);

    // Decorative motif
    ctx.fillStyle = '#c89646';
    ctx.font = '24px serif';
    ctx.fillText(motif, canvas.width / 2, 190);

    const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    panelLeft: createPanelCanvas('BOARDING PASS', 'PASSENGER:', 'HARSHA ♡', '★'),
    panelCenter: createPanelCanvas('STARLIGHT VIP', 'SEAT:', 'NEXT TO YESHWANTH', '♡'),
    panelRight: createPanelCanvas('FLIGHT ROUTE', 'DESTINATION:', 'ANYWHERE', '✦'),
  };
}

/**
 * Builds a handcrafted velvet-lined miniature prize compartment box with a hinged lid
 * and the specific 3D collectible mesh inside for each Carnival game's prize reveal.
 */
export function createPrizeDisplayBox(
  prizeId: keyof typeof CARNIVAL_PRIZES,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
): PrizeDisplayBoxInstance {
  const group = new THREE.Group();
  group.name = `CarnivalPrizeBox_${prizeId}`;

  const prizeDef = CARNIVAL_PRIZES[prizeId] || CARNIVAL_PRIZES.paired_heart_charm;

  // 1. Velvet box base (lowered by -0.12m relative to the camera look target so the camera frames the floating gift & text)
  const boxOffsetY = -0.12;
  const baseGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.16, 0.4));
  baseGeo.translate(0, 0.08 + boxOffsetY, 0);
  const baseMesh = new THREE.Mesh(baseGeo, mats.crimsonVelvet);
  baseMesh.castShadow = true;
  group.add(baseMesh);

  const trimGeo = tracker.trackGeo(new THREE.BoxGeometry(0.5, 0.03, 0.42));
  trimGeo.translate(0, 0.15 + boxOffsetY, 0);
  const trimMesh = new THREE.Mesh(trimGeo, mats.brushedGold);
  group.add(trimMesh);

  // Hinged lid at the back edge (z = -0.2)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.16 + boxOffsetY, -0.2);
  group.add(lidPivot);

  const lidGeo = tracker.trackGeo(new THREE.BoxGeometry(0.48, 0.08, 0.4));
  lidGeo.translate(0, 0.04, 0.2);
  const lidMesh = new THREE.Mesh(lidGeo, mats.creamStone);
  lidPivot.add(lidMesh);

  // 2. Rising & rotating 3D collectible charm pivot (levitates to y = +0.30m, z = +0.08m clear of all box walls)
  const charmPivot = new THREE.Group();
  charmPivot.position.set(0, 0.05, 0);
  charmPivot.scale.setScalar(0.01);
  group.add(charmPivot);

  // Dynamic references for specific prize animations
  let tokenMesh: THREE.Mesh | null = null;
  let charmRingA: THREE.Mesh | null = null;
  let charmRingB: THREE.Mesh | null = null;
  let memoryCardMesh: THREE.Mesh | null = null;
  let frogActor: THREE.Group | null = null;
  let frogHeart: THREE.Mesh | null = null;
  let eggUpper: THREE.Mesh | null = null;
  let eggLower: THREE.Mesh | null = null;
  let eggCrystal: THREE.Mesh | null = null;
  let carouselPillar: THREE.Group | null = null;
  let carouselHorseActor: THREE.Group | null = null;
  let carouselPedestal: THREE.Group | null = null;
  let ticketLeftPivot: THREE.Group | null = null;
  let ticketRightPivot: THREE.Group | null = null;
  let ticketRoot: THREE.Group | null = null;
  let flowerBud: THREE.Group | null = null;
  const flowerPetals: THREE.Mesh[] = [];

  // ==========================================================================
  // BUILD SPECIFIC 3D MINIATURE MODEL FOR EACH PRIZE
  // ==========================================================================
  if (prizeId === 'paired_heart_charm') {
    // 01. HEARTSHOT: Tiny Heart Token ("For Harsha ♡" on front, glossy vibrant keepsake photo on reverse)
    const tokenGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.024, 32));
    const tokenTex = createTokenFrontTexture(tracker);
    const tokenFrontMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        map: tokenTex,
        roughness: 0.28,
        metalness: 0.12,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
      }),
    );
    tokenFrontMat.userData.preserveFinish = true;

    const backPhotoTex = createMemoryPhotoTexture(tracker);
    const tokenBackMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        map: backPhotoTex,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
        emissive: new THREE.Color('#fff6e8'),
        emissiveMap: backPhotoTex,
        emissiveIntensity: 0.16,
      }),
    );
    tokenBackMat.userData.preserveFinish = true;

    const materials = [
      mats.brushedGold, // side rim
      tokenFrontMat,    // top front
      tokenBackMat,     // bottom back (vibrant keepsake portrait)
    ];
    tokenMesh = new THREE.Mesh(tokenGeo, materials);
    tokenMesh.rotation.x = Math.PI / 2;
    tokenMesh.castShadow = true;
    charmPivot.add(tokenMesh);
  } else if (prizeId === 'twin_ring_charms') {
    // 02. RING TOSS: Matching H + Y Charms (Magnetic click)
    const heartShape = createHeartShape2D(0.12);
    const charmGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(heartShape, {
        depth: 0.03,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
      }),
    );
    charmGeo.center();

    // Charm H (Rose Gold)
    charmRingA = new THREE.Mesh(charmGeo, mats.softRoseGold);
    charmRingA.position.set(-0.11, 0, 0);
    charmRingA.rotation.z = 0.22;

    // Charm Y (Brushed Gold)
    charmRingB = new THREE.Mesh(charmGeo, mats.brushedGold);
    charmRingB.position.set(0.11, 0, 0);
    charmRingB.rotation.z = -0.22;

    charmPivot.add(charmRingA, charmRingB);
  } else if (prizeId === 'little_rose_token') {
    // 03. PRIZE KNOCKDOWN: Tiny Memory Card with vibrant glossy photo finish
    const photoTex = createMemoryPhotoTexture(tracker);
    const photoMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        map: photoTex,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.16,
        emissive: new THREE.Color('#fff6e8'),
        emissiveMap: photoTex,
        emissiveIntensity: 0.18,
      }),
    );
    photoMat.userData.preserveFinish = true;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const richTex = createMemoryPhotoTexture(tracker, img);
      photoMat.map = richTex;
      photoMat.emissiveMap = richTex;
      photoMat.needsUpdate = true;
    };
    img.src = '/assets/harsha/photo-romantic.jpg';

    const cardBackMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fffef9'),
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
      }),
    );
    cardBackMat.userData.preserveFinish = true;

    const cardGeo = tracker.trackGeo(new THREE.BoxGeometry(0.28, 0.34, 0.01));
    memoryCardMesh = new THREE.Mesh(cardGeo, [
      mats.brushedGold,
      mats.brushedGold,
      mats.brushedGold,
      mats.brushedGold,
      photoMat,
      cardBackMat,
    ]);
    memoryCardMesh.rotation.x = -0.12;
    memoryCardMesh.castShadow = true;
    charmPivot.add(memoryCardMesh);
  } else if (prizeId === 'golden_star_token') {
    // 04. FROG LAUNCH: Cute Little Frog with Golden Crown & Glowing Heart (facing +Z toward camera!)
    frogActor = new THREE.Group();

    // Body
    const fBodyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.1, 14, 12));
    fBodyGeo.scale(1.15, 0.88, 1.25);
    const fBody = new THREE.Mesh(fBodyGeo, mats.mintPastel);
    fBody.castShadow = true;
    frogActor.add(fBody);

    // Vocal throat sac
    const fSacGeo = tracker.trackGeo(new THREE.SphereGeometry(0.055, 10, 10));
    const fSac = new THREE.Mesh(fSacGeo, mats.blushPastel);
    fSac.position.set(0, -0.01, 0.075);
    frogActor.add(fSac);

    // Cute big eyes facing forward (+Z)
    const fEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.035, 10, 10));
    const fPupilGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 8));
    const pupilMat = tracker.trackMat(new THREE.MeshBasicMaterial({ color: 0x111111 }));
    for (const sx of [-0.052, 0.052]) {
      const eyeWhite = new THREE.Mesh(fEyeGeo, mats.creamStone);
      eyeWhite.position.set(sx, 0.08, 0.06);
      const pupil = new THREE.Mesh(fPupilGeo, pupilMat);
      pupil.position.set(sx * 1.05, 0.085, 0.09);
      frogActor.add(eyeWhite, pupil);
    }

    // Mini golden crown
    const crownGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.036, 0.026, 0.045, 5));
    const crown = new THREE.Mesh(crownGeo, mats.brushedGold);
    crown.position.set(0, 0.11, 0.02);
    frogActor.add(crown);

    // Glowing ruby heart held in hands in front (+Z)
    const hShape = createHeartShape2D(0.045);
    const hGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(hShape, {
        depth: 0.015,
        bevelEnabled: false,
      }),
    );
    hGeo.center();
    frogHeart = new THREE.Mesh(hGeo, mats.crystalHeart);
    frogHeart.position.set(0, 0.045, 0.13);
    frogHeart.rotation.x = -Math.PI / 6;
    frogActor.add(frogHeart);

    charmPivot.add(frogActor);
  } else if (prizeId === 'tiny_aurora_crystal') {
    // 05. MYSTERY EGG: Golden Egg popping open to reveal Aurora Crystal
    const eggHalfGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    eggHalfGeo.scale(1, 1.25, 1);

    eggUpper = new THREE.Mesh(eggHalfGeo, mats.brushedGold);
    eggUpper.position.y = 0.01;

    const lowerHalfGeo = eggHalfGeo.clone();
    lowerHalfGeo.rotateX(Math.PI);
    eggLower = new THREE.Mesh(lowerHalfGeo, mats.brushedGold);
    eggLower.position.y = -0.01;

    // Inside Aurora Crystal
    const crystalGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.085, 0));
    crystalGeo.scale(0.65, 1.45, 0.65);
    eggCrystal = new THREE.Mesh(crystalGeo, mats.auroraCyanGlow);
    eggCrystal.position.y = 0;

    charmPivot.add(eggUpper, eggLower, eggCrystal);
  } else if (prizeId === 'mini_carousel_horse') {
    // 06. CAROUSEL: Handcrafted Sculpted Miniature Carousel Horse on Revolving Music-Box Pedestal
    carouselPillar = new THREE.Group();

    // Custom high-luster Barley-Twist Brass material (metalness: 0.85, roughness: 0.22)
    const barleyBrassMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e5b84b'),
        metalness: 0.85,
        roughness: 0.22,
      }),
    );
    barleyBrassMat.userData.preserveFinish = true;

    const crystalFinialMat = tracker.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fff5fb'),
        emissive: new THREE.Color('#ffd6e7'),
        emissiveIntensity: 0.22,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.72,
        clearcoat: 1.0,
      }),
    );
    crystalFinialMat.userData.preserveFinish = true;

    const bluebellMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#7dd3fc'),
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 0.2,
        roughness: 0.35,
      }),
    );

    // 1. Revolving Walnut Music-Box Pedestal with Fluted Brass Rim & Engraved Plaque
    carouselPedestal = new THREE.Group();
    carouselPedestal.position.y = -0.15;

    const walnutBaseGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.145, 0.165, 0.065, 24));
    const walnutBase = new THREE.Mesh(walnutBaseGeo, mats.darkWalnut);
    walnutBase.castShadow = true;
    carouselPedestal.add(walnutBase);

    const flutedRimGeo = tracker.trackGeo(new THREE.TorusGeometry(0.152, 0.012, 10, 28));
    flutedRimGeo.rotateX(Math.PI / 2);
    const flutedRimTop = new THREE.Mesh(flutedRimGeo, barleyBrassMat);
    flutedRimTop.position.y = 0.03;
    const flutedRimBot = new THREE.Mesh(flutedRimGeo, barleyBrassMat);
    flutedRimBot.position.y = -0.028;
    carouselPedestal.add(flutedRimTop, flutedRimBot);

    // Fluted vertical ribs around pedestal circumference
    const ribGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.056, 6));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rib = new THREE.Mesh(ribGeo, barleyBrassMat);
      rib.position.set(Math.cos(a) * 0.155, 0, Math.sin(a) * 0.155);
      carouselPedestal.add(rib);
    }

    // Engraved Brass Plaque on front of pedestal:
    // "Our Little Ride · Some moments are worth going around twice. ♡"
    const plaqueTex = createCarouselPlaqueTexture(tracker);
    const plaqueMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        metalness: 0.65,
        roughness: 0.28,
      }),
    );
    plaqueMat.userData.preserveFinish = true;
    const plaqueGeo = tracker.trackGeo(new THREE.BoxGeometry(0.16, 0.042, 0.008));
    const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaqueMesh.position.set(0, 0.004, 0.162);
    plaqueMesh.rotation.x = -0.12;
    carouselPedestal.add(plaqueMesh);

    carouselPillar.add(carouselPedestal);

    // 2. Spiraling Barley-Twist Brass Pole & Faceted Crystal Sphere Finial
    const corePoleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 12));
    const corePole = new THREE.Mesh(corePoleGeo, barleyBrassMat);
    corePole.position.y = 0.06;
    carouselPillar.add(corePole);

    // Helical barley-twist spiral beads wrapping the brass pole
    const twistBeadGeo = tracker.trackGeo(new THREE.TorusGeometry(0.014, 0.0045, 8, 16));
    for (let i = 0; i < 18; i++) {
      const u = i / 17;
      const ring = new THREE.Mesh(twistBeadGeo, barleyBrassMat);
      ring.position.set(
        Math.cos(u * Math.PI * 6) * 0.003,
        -0.12 + u * 0.36,
        Math.sin(u * Math.PI * 6) * 0.003,
      );
      ring.rotation.set(Math.PI / 2 + 0.35, u * Math.PI * 6, 0);
      carouselPillar.add(ring);
    }

    // Top Brass Crown Collar & Faceted Crystal Sphere Finial
    const collarGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.024, 0.014, 0.022, 12));
    const collar = new THREE.Mesh(collarGeo, barleyBrassMat);
    collar.position.y = 0.27;
    carouselPillar.add(collar);

    const finialGeo = tracker.trackGeo(new THREE.IcosahedronGeometry(0.032, 1));
    const finial = new THREE.Mesh(finialGeo, crystalFinialMat);
    finial.position.y = 0.305;
    carouselPillar.add(finial);

    // 3. Sculpted Realistic Miniature Carousel Horse
    carouselHorseActor = new THREE.Group();
    carouselHorseActor.position.y = 0.04;

    // Muscular barrel torso
    const torsoGeo = tracker.trackGeo(new THREE.CapsuleGeometry(0.056, 0.145, 10, 14));
    torsoGeo.rotateX(Math.PI / 2);
    const torso = new THREE.Mesh(torsoGeo, mats.ivoryCanvas);
    torso.castShadow = true;
    carouselHorseActor.add(torso);

    // Broad sculpted chest (front +Z) & rounded muscular hindquarters/flank (-Z)
    const chestGeo = tracker.trackGeo(new THREE.SphereGeometry(0.062, 12, 12));
    chestGeo.scale(0.95, 1.08, 1.05);
    const chest = new THREE.Mesh(chestGeo, mats.ivoryCanvas);
    chest.position.set(0, 0.012, 0.072);
    carouselHorseActor.add(chest);

    const flankGeo = tracker.trackGeo(new THREE.SphereGeometry(0.064, 12, 12));
    flankGeo.scale(0.98, 1.05, 1.12);
    const flank = new THREE.Mesh(flankGeo, mats.ivoryCanvas);
    flank.position.set(0, 0.016, -0.075);
    carouselHorseActor.add(flank);

    // Arched neck & sculpted head/muzzle
    const neckGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.028, 0.048, 0.135, 12));
    const neck = new THREE.Mesh(neckGeo, mats.ivoryCanvas);
    neck.position.set(0, 0.088, 0.095);
    neck.rotation.x = 0.38;
    carouselHorseActor.add(neck);

    const craniumGeo = tracker.trackGeo(new THREE.SphereGeometry(0.035, 12, 10));
    const cranium = new THREE.Mesh(craniumGeo, mats.ivoryCanvas);
    cranium.position.set(0, 0.148, 0.125);
    carouselHorseActor.add(cranium);

    const muzzleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.019, 0.031, 0.075, 10));
    muzzleGeo.rotateX(Math.PI / 2);
    const muzzle = new THREE.Mesh(muzzleGeo, mats.ivoryCanvas);
    muzzle.position.set(0, 0.132, 0.162);
    muzzle.rotation.x = 0.28;
    carouselHorseActor.add(muzzle);

    // Sculpted pricked ears & golden bridle bit
    const earGeo = tracker.trackGeo(new THREE.ConeGeometry(0.011, 0.032, 6));
    for (const sx of [-0.018, 0.018]) {
      const ear = new THREE.Mesh(earGeo, mats.ivoryCanvas);
      ear.position.set(sx, 0.182, 0.12);
      ear.rotation.x = 0.2;
      carouselHorseActor.add(ear);
    }

    const bridleGeo = tracker.trackGeo(new THREE.TorusGeometry(0.024, 0.004, 6, 14));
    const bridle = new THREE.Mesh(bridleGeo, barleyBrassMat);
    bridle.position.set(0, 0.135, 0.155);
    carouselHorseActor.add(bridle);

    // 4 Prancing Legs (front legs lifted in a gallant prance, hind legs poised) + gilded hooves
    const upperLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.016, 0.012, 0.085, 8));
    const lowerLegGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.011, 0.009, 0.075, 8));
    const hoofGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.012, 0.015, 0.018, 8));

    const legConfigs = [
      // Front Left (prancing high)
      { x: -0.038, y: -0.02, z: 0.088, uRot: -0.65, lRot: 0.85 },
      // Front Right (extended forward)
      { x: 0.038, y: -0.025, z: 0.088, uRot: -0.42, lRot: 0.35 },
      // Hind Left (gracefully extended back)
      { x: -0.04, y: -0.025, z: -0.085, uRot: 0.52, lRot: -0.35 },
      // Hind Right (poised)
      { x: 0.04, y: -0.025, z: -0.085, uRot: 0.32, lRot: -0.22 },
    ];
    for (const lc of legConfigs) {
      const legGroup = new THREE.Group();
      legGroup.position.set(lc.x, lc.y, lc.z);
      legGroup.rotation.x = lc.uRot;

      const uLeg = new THREE.Mesh(upperLegGeo, mats.ivoryCanvas);
      uLeg.position.y = -0.038;
      legGroup.add(uLeg);

      const kneePivot = new THREE.Group();
      kneePivot.position.y = -0.076;
      kneePivot.rotation.x = lc.lRot;
      legGroup.add(kneePivot);

      const lLeg = new THREE.Mesh(lowerLegGeo, mats.ivoryCanvas);
      lLeg.position.y = -0.034;
      kneePivot.add(lLeg);

      const hoof = new THREE.Mesh(hoofGeo, barleyBrassMat);
      hoof.position.y = -0.072;
      kneePivot.add(hoof);

      carouselHorseActor.add(legGroup);
    }

    // 4. Flowing Mane & Sweeping Tail Adorned with Rose & Pastel Bluebell Garland Weaves
    const maneWaveGeo = tracker.trackGeo(new THREE.SphereGeometry(0.018, 8, 8));
    maneWaveGeo.scale(0.65, 1.25, 1.4);
    const blossomGeo = tracker.trackGeo(new THREE.SphereGeometry(0.011, 8, 8));
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      const lock = new THREE.Mesh(maneWaveGeo, barleyBrassMat);
      lock.position.set(0.012, 0.065 + u * 0.085, 0.068 + u * 0.042);
      lock.rotation.z = -0.25;
      carouselHorseActor.add(lock);

      // Alternating miniature sculpted crimson rose & pastel bluebell garland buds woven into mane
      const flower = new THREE.Mesh(
        blossomGeo,
        i % 2 === 0 ? mats.crimsonVelvet : bluebellMat,
      );
      flower.position.set(0.024, 0.068 + u * 0.082, 0.074 + u * 0.042);
      carouselHorseActor.add(flower);
    }

    // Floral chest garland swag (roses + pastel bluebells)
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 0.75;
      const garlandBud = new THREE.Mesh(
        blossomGeo,
        Math.abs(i) % 2 === 0 ? mats.softRoseGlow : bluebellMat,
      );
      garlandBud.position.set(
        Math.sin(a) * 0.062,
        0.018 - Math.cos(a) * 0.018,
        0.095 + Math.cos(a) * 0.038,
      );
      carouselHorseActor.add(garlandBud);
    }

    // Sweeping sculpted tail with floral ribbon tie
    const tailMainGeo = tracker.trackGeo(new THREE.ConeGeometry(0.028, 0.145, 10));
    const tailMain = new THREE.Mesh(tailMainGeo, barleyBrassMat);
    tailMain.position.set(0, -0.01, -0.155);
    tailMain.rotation.x = -0.78;
    carouselHorseActor.add(tailMain);

    const tailRose = new THREE.Mesh(blossomGeo, mats.crimsonVelvet);
    tailRose.position.set(0, 0.035, -0.125);
    tailRose.scale.setScalar(1.3);
    carouselHorseActor.add(tailRose);

    // 5. Parade Saddle & Filigree: Crimson Velvet Blanket, Gold-Leaf Scalloped Fringe, Embossed Leather Saddle & Twin Brass Stirrups
    const saddleBlanketGeo = tracker.trackGeo(
      new THREE.CylinderGeometry(0.064, 0.066, 0.105, 14, 1, false, -Math.PI * 0.72, Math.PI * 1.44),
    );
    saddleBlanketGeo.rotateZ(Math.PI / 2);
    saddleBlanketGeo.rotateY(Math.PI / 2);
    const saddleBlanket = new THREE.Mesh(saddleBlanketGeo, mats.crimsonVelvet);
    saddleBlanket.position.set(0, 0.01, 0);
    carouselHorseActor.add(saddleBlanket);

    // Scalloped gold-leaf fringe beads along both lower edges of the crimson velvet blanket
    const fringeBeadGeo = tracker.trackGeo(new THREE.SphereGeometry(0.0065, 6, 6));
    for (const sx of [-0.061, 0.061]) {
      for (let i = -3; i <= 3; i++) {
        const bead = new THREE.Mesh(fringeBeadGeo, barleyBrassMat);
        bead.position.set(sx, -0.022 + Math.abs(i) * 0.002, i * 0.014);
        carouselHorseActor.add(bead);
      }
    }

    // Embossed floral leather saddle seat & pommel/cantle
    const leatherSaddleGeo = tracker.trackGeo(new THREE.BoxGeometry(0.072, 0.024, 0.076));
    const leatherSaddle = new THREE.Mesh(leatherSaddleGeo, mats.darkWalnut);
    leatherSaddle.position.set(0, 0.064, -0.004);
    carouselHorseActor.add(leatherSaddle);

    const cantleGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.034, 0.036, 0.022, 10));
    const cantle = new THREE.Mesh(cantleGeo, barleyBrassMat);
    cantle.position.set(0, 0.078, -0.032);
    cantle.rotation.x = -0.25;
    carouselHorseActor.add(cantle);

    // Twin hanging brass stirrups on leather straps
    const strapGeo = tracker.trackGeo(new THREE.BoxGeometry(0.004, 0.065, 0.01));
    const stirrupGeo = tracker.trackGeo(new THREE.TorusGeometry(0.011, 0.0028, 6, 12));
    for (const sx of [-0.064, 0.064]) {
      const strap = new THREE.Mesh(strapGeo, mats.darkWalnut);
      strap.position.set(sx, 0.01, 0);
      const stirrup = new THREE.Mesh(stirrupGeo, barleyBrassMat);
      stirrup.position.set(sx, -0.026, 0);
      stirrup.rotation.y = Math.PI / 2;
      carouselHorseActor.add(strap, stirrup);
    }

    carouselPillar.add(carouselHorseActor);
    charmPivot.add(carouselPillar);
  } else if (prizeId === 'unfolding_sky_ticket') {
    // 07. FERRIS WHEEL: Unfolding 3-Panel Sky Ticket
    const tickets = createSkyTicketTextures(tracker);
    ticketRoot = new THREE.Group();

    const panelGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.21, 0.13));

    // Center Panel
    const centerMesh = new THREE.Mesh(
      panelGeo,
      tracker.trackMat(new THREE.MeshStandardMaterial({ map: tickets.panelCenter, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })),
    );
    ticketRoot.add(centerMesh);

    // Left Panel Hinged
    ticketLeftPivot = new THREE.Group();
    ticketLeftPivot.position.set(-0.105, 0, 0);
    const leftMesh = new THREE.Mesh(
      panelGeo,
      tracker.trackMat(new THREE.MeshStandardMaterial({ map: tickets.panelLeft, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })),
    );
    leftMesh.position.set(-0.105, 0, 0);
    ticketLeftPivot.add(leftMesh);
    ticketRoot.add(ticketLeftPivot);

    // Right Panel Hinged
    ticketRightPivot = new THREE.Group();
    ticketRightPivot.position.set(0.105, 0, 0);
    const rightMesh = new THREE.Mesh(
      panelGeo,
      tracker.trackMat(new THREE.MeshStandardMaterial({ map: tickets.panelRight, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })),
    );
    rightMesh.position.set(0.105, 0, 0);
    ticketRightPivot.add(rightMesh);
    ticketRoot.add(ticketRightPivot);

    charmPivot.add(ticketRoot);
  } else {
    // 08. QUIET GARDEN: Little Glowing Flower
    flowerBud = new THREE.Group();

    // Stem
    const stemGeo = tracker.trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6));
    const stem = new THREE.Mesh(stemGeo, mats.patinaTealRoof);
    stem.position.y = -0.11;
    flowerBud.add(stem);

    // Inner glowing core
    const coreGeo = tracker.trackGeo(new THREE.SphereGeometry(0.045, 10, 10));
    const core = new THREE.Mesh(coreGeo, mats.softRoseGlow);
    flowerBud.add(core);

    // 6 Sculpted Petals
    const petalShape = createHeartShape2D(0.075);
    const petalGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(petalShape, {
        depth: 0.012,
        bevelEnabled: false,
      }),
    );
    petalGeo.center();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petalPivot = new THREE.Group();
      petalPivot.rotation.y = angle;

      const petal = new THREE.Mesh(petalGeo, mats.softRoseGlow);
      petal.position.set(0, 0.035, 0.04);
      petal.rotation.x = 0.2;
      petalPivot.add(petal);
      flowerBud.add(petalPivot);
      flowerPetals.push(petal);
    }

    charmPivot.add(flowerBud);
  }

  // 3. Ambient glow ring beneath charm
  const glowRingGeo = tracker.trackGeo(new THREE.RingGeometry(0.14, 0.22, 24));
  glowRingGeo.rotateX(-Math.PI / 2);
  const glowRing = new THREE.Mesh(glowRingGeo, mats.warmLanternGlow);
  glowRing.position.y = 0.165 + boxOffsetY;
  glowRing.scale.setScalar(0.01);
  group.add(glowRing);

  // 4. World-Space 3D Diegetic Personal Message Plaque
  const messagePlaque = createWorldSpaceMessagePlaque(
    prizeDef.titleInscription,
    prizeDef.message,
    prizeDef.category,
    tracker,
  );
  // Placed cleanly below and in front of the lowered velvet box so the levitating gift at y=+0.30m has 100% clearance
  messagePlaque.group.position.set(0, -0.08, 0.42);
  messagePlaque.group.rotation.x = -0.15; // Angled comfortably toward camera
  group.add(messagePlaque.group);

  // Audio & Tactile Interaction state
  let audioFiredStep = 0;
  let targetTactileYaw = 0;
  let targetTactilePitch = 0;
  let currentTactileYaw = 0;
  let currentTactilePitch = 0;

  return {
    group,
    lidPivot,
    charmPivot,
    glowRing,
    messagePlaque,

    setTactileTilt(tiltYaw: number, tiltPitch: number) {
      targetTactileYaw = THREE.MathUtils.clamp(tiltYaw, -0.24, 0.24);
      targetTactilePitch = THREE.MathUtils.clamp(tiltPitch, -0.18, 0.18);
    },

    setOpenProgress(openU: number, elapsedTime: number) {
      const clamped = THREE.MathUtils.clamp(openU, 0, 1);
      // Open lid backward up to 110 degrees
      lidPivot.rotation.x = -clamped * 1.95;
      const liftU = THREE.MathUtils.smoothstep(clamped, 0.08, 1.0);
      charmPivot.position.y =
        THREE.MathUtils.lerp(0.06, 0.32, liftU) +
        Math.sin(elapsedTime * 2.8) * 0.018 * liftU;
      charmPivot.position.z = THREE.MathUtils.lerp(0.0, 0.09, liftU);
      charmPivot.scale.setScalar(Math.max(0.01, liftU));
      glowRing.scale.setScalar(Math.max(0.01, liftU));
    },

    updateCinematicAnimation(
      timeInCinematic: number,
      elapsedTime: number,
      fx: PrizeCinematicFXSystem,
      audio: CarnivalAudioSynthesizer,
    ) {
      const t = timeInCinematic;
      const worldCenter = new THREE.Vector3();
      charmPivot.getWorldPosition(worldCenter);

      // Smoothly interpolate subtle tactile tilt without fighting 360° camera orbit
      currentTactileYaw += (targetTactileYaw - currentTactileYaw) * 0.12;
      currentTactilePitch += (targetTactilePitch - currentTactilePitch) * 0.12;

      charmPivot.rotation.y = 0;
      charmPivot.rotation.x = currentTactilePitch;
      messagePlaque.group.rotation.y = 0;
      messagePlaque.group.rotation.x = -0.15 + currentTactilePitch * 0.35;

      // 0.0s - 0.15s: WIN & World Pause
      if (t < 0.15) {
        if (audioFiredStep === 0) {
          audioFiredStep = 1;
          audio.playWinFanfare();
          fx.triggerSparkleRing(worldCenter, 0.16, 16);
          fx.setTheatricalLighting(0.75, worldCenter);
        }
        return;
      }

      // 0.15s - 0.7s: REVEAL Approach — smoothly levitate prize +0.32m up and +0.09m forward clear of all box walls!
      const revealU = THREE.MathUtils.smoothstep(t, 0.15, 0.75);
      lidPivot.rotation.x = -revealU * 1.95;
      charmPivot.position.y =
        THREE.MathUtils.lerp(0.06, 0.32, revealU) +
        Math.sin(elapsedTime * 2.8) * 0.018 * revealU;
      charmPivot.position.z = THREE.MathUtils.lerp(0.0, 0.09, revealU);
      charmPivot.scale.setScalar(Math.max(0.01, revealU));
      glowRing.scale.setScalar(Math.max(0.01, revealU));
      fx.setTheatricalLighting(revealU * 1.0, worldCenter);

      // Trigger unique reveal sound once at reveal initiation
      if (t >= 0.25 && audioFiredStep === 1) {
        audioFiredStep = 2;
        if (prizeId === 'paired_heart_charm') audio.playTokenBounce();
        else if (prizeId === 'twin_ring_charms') audio.playTargetHitChime(2);
        else if (prizeId === 'little_rose_token') audio.playCardFlutter();
        else if (prizeId === 'golden_star_token') audio.playFrogHopSquash();
        else if (prizeId === 'tiny_aurora_crystal') audio.playEggPopConfetti();
        else if (prizeId === 'mini_carousel_horse') audio.playCarouselMusicBoxChime();
        else if (prizeId === 'unfolding_sky_ticket') audio.playTicketUnfold();
        else if (prizeId === 'little_glowing_flower') audio.playFlowerBloomBell();
      }

      // ======================================================================
      // 0.7s+: SIGNATURE MICRO-ANIMATIONS PER PRIZE
      // ======================================================================
      const motionT = Math.max(0, t - 0.7);

      if (prizeId === 'paired_heart_charm' && tokenMesh) {
        // Token lifts with damped spring bounce and slow 360° turn
        const spring = dampedSpring(motionT, 14, 4.2);
        tokenMesh.position.y = 0.06 * Math.min(1, motionT * 2.5) + spring * 0.04;
        tokenMesh.rotation.y = motionT * 1.8;
        if (motionT > 0.4 && motionT < 0.5) {
          fx.triggerLightSweep(worldCenter);
        }
      } else if (prizeId === 'twin_ring_charms' && charmRingA && charmRingB) {
        // Matching Charms slide together magnetically and snap
        const snapT = THREE.MathUtils.smoothstep(motionT, 0, 0.45);
        charmRingA.position.x = -0.11 * (1 - snapT) - 0.035 * snapT;
        charmRingB.position.x = 0.11 * (1 - snapT) + 0.035 * snapT;
        if (motionT >= 0.45 && audioFiredStep === 2) {
          audioFiredStep = 3;
          audio.playMagneticClick();
          fx.triggerHeartBurst(worldCenter, 14);
          fx.triggerSoftPulse(worldCenter);
        }
        charmPivot.rotation.y = motionT * 1.2 + currentTactileYaw;
      } else if (prizeId === 'little_rose_token' && memoryCardMesh) {
        // Memory Card tilts forward, floats up like a reverse leaf
        const liftU = Math.min(1, motionT * 1.8);
        memoryCardMesh.position.y = liftU * 0.06 + Math.sin(motionT * 3.5) * 0.015;
        memoryCardMesh.rotation.x = -0.12 + Math.sin(motionT * 2.8) * 0.04;
        memoryCardMesh.rotation.z = Math.sin(motionT * 3.2) * 0.03;
        if (motionT > 0.6 && motionT < 0.7) {
          fx.triggerLightSweep(worldCenter);
        }
      } else if (prizeId === 'golden_star_token' && frogActor) {
        // Cute Little Frog hops out facing the camera (+Z), lands with squash & stretch spring
        if (motionT < 0.6) {
          const hopU = motionT / 0.6;
          frogActor.position.y = Math.sin(hopU * Math.PI) * 0.14;
          frogActor.position.z = hopU * 0.05;
        } else {
          const landT = motionT - 0.6;
          const squash = dampedSpring(landT, 16, 5);
          frogActor.scale.set(1 + squash * 0.25, 1 - squash * 0.35, 1 + squash * 0.25);
          // Happy little wiggle & ribbit hop
          const happyHop = Math.max(0, Math.sin(landT * 5.2)) * 0.035;
          frogActor.position.y = happyHop;
          frogActor.rotation.z = Math.sin(landT * 7.5) * 0.09;
          if (frogHeart) {
            frogHeart.scale.setScalar(1 + Math.sin(elapsedTime * 4) * 0.12);
          }
        }
      } else if (prizeId === 'tiny_aurora_crystal') {
        // Mystery Egg wobbles 3 times, pops open, crystal rises
        if (motionT < 0.75) {
          const wobble = Math.sin(motionT * 26) * 0.14 * Math.min(1, motionT * 2);
          if (eggUpper) eggUpper.rotation.z = wobble;
          if (eggLower) eggLower.rotation.z = -wobble;
        } else {
          const popT = motionT - 0.75;
          const openU = Math.min(1, popT * 3.0);
          if (eggUpper) eggUpper.position.y = 0.01 + openU * 0.16;
          if (eggLower) eggLower.position.y = -0.01 - openU * 0.08;
          if (eggCrystal) {
            eggCrystal.position.y = openU * 0.1;
            eggCrystal.rotation.y = popT * 2.5;
          }
          if (audioFiredStep === 2) {
            audioFiredStep = 3;
            fx.triggerConfettiMicro(worldCenter, 32);
            fx.triggerHeartBurst(worldCenter, 12);
          }
        }
      } else if (prizeId === 'mini_carousel_horse' && carouselPillar) {
        // Revolving music-box pedestal slowly rotates while the sculpted horse gently gallops/bobs up and down
        carouselPillar.rotation.y = motionT * 1.15;
        if (carouselHorseActor) {
          carouselHorseActor.position.y = 0.04 + Math.sin(motionT * 3.4) * 0.028;
          carouselHorseActor.rotation.x = Math.cos(motionT * 3.4) * 0.045;
        }
      } else if (prizeId === 'unfolding_sky_ticket' && ticketRoot) {
        // Unfolding 3-Panel Sky Ticket hovering clearly above the box
        const unfoldU = THREE.MathUtils.smoothstep(motionT, 0.1, 0.85);
        if (ticketLeftPivot) ticketLeftPivot.rotation.y = (1 - unfoldU) * (-Math.PI * 0.72);
        if (ticketRightPivot) ticketRightPivot.rotation.y = (1 - unfoldU) * (Math.PI * 0.72);
        ticketRoot.position.y = unfoldU * 0.08;
        ticketRoot.rotation.x = -0.10;
        if (motionT > 0.9 && motionT < 1.0) {
          fx.triggerLightSweep(worldCenter);
        }
      } else if (prizeId === 'little_glowing_flower' && flowerBud) {
        // Little Glowing Flower petals bloom open
        const bloomU = THREE.MathUtils.smoothstep(motionT, 0.1, 1.1);
        for (let i = 0; i < flowerPetals.length; i++) {
          flowerPetals[i].rotation.x = 0.2 + bloomU * 0.75;
        }
        flowerBud.position.y = bloomU * 0.06;
        if (motionT >= 0.8 && audioFiredStep === 2) {
          audioFiredStep = 3;
          fx.triggerSparkleRing(worldCenter, 0.22, 18);
          fx.triggerHeartBurst(worldCenter, 10);
        }
      }

      // ======================================================================
      // 1.4s+: DIEGETIC WORLD-SPACE 3D MESSAGE PLAQUE SOFT ALPHA WIPE (0.45s)
      // ======================================================================
      if (t >= 1.4) {
        const wipeProgress = THREE.MathUtils.clamp((t - 1.4) / 0.45, 0, 1);
        messagePlaque.setRevealProgress(wipeProgress, elapsedTime);

        if (wipeProgress >= 0.1 && (audioFiredStep === 2 || audioFiredStep === 3)) {
          audioFiredStep = 4;
          audio.playMessageRevealAccent();
        }
      }
    },

    dispose() {
      messagePlaque.dispose();
    },
  };
}
