import * as THREE from 'three';
import { ResourceTracker, createHeartShape2D } from './ProceduralKit';
import { CircleCollider } from './VegetationSystem';
import { MagicalPlantSystemBundle } from './forest/MagicalPlantSystem';
import { AncientForestBundle } from './forest/AncientForest';
import {
  CASTLE_GATE_POS,
  castleLocalToWorld,
  dampValue,
  easeOutCubic,
  mulberry32,
  smoothstep01,
} from './terrainMath';

export type IndoorStationId =
  | 'sorting_hat'
  | 'compendium_book'
  | 'mirror_of_desire'
  | 'pensieve'
  | 'amortentia'
  | 'patronus_circle'
  | 'royal_frog';

export type SchoolInteractableId =
  | 'none'
  | IndoorStationId
  | 'f1_mandrake'
  | 'f1_devils_snare'
  | 'f3_rune_stone'
  | 'f5_lake_photo';

export interface SchoolPromptInfo {
  id: SchoolInteractableId;
  title: string;
  actionLabel: string;
}

export interface SchoolBannerNotification {
  title: string;
  subtitle: string;
  message: string;
  headline?: string;
  photoUrl?: string;
  accent: 'gold' | 'violet' | 'cyan' | 'rose' | 'emerald';
  stepIndex: number;
  totalSteps: number;
}

export interface SchoolCameraFocus {
  active: boolean;
  camWorldPos: THREE.Vector3;
  lookWorldPos: THREE.Vector3;
  blendAlpha: number;
  playerTurnAlpha?: number;
  embraceAlpha?: number;
  kissAlpha?: number;
  targetPlayerYaw?: number;
}

export interface WizardingSchoolBundle {
  group: THREE.Group;
  colliders: CircleCollider[];
  setMagicalPlantSystem: (plantSystem: MagicalPlantSystemBundle) => void;
  setAncientForestSystem: (forestSystem: AncientForestBundle) => void;
  getPromptInfo: (
    playerWorldPos: THREE.Vector3,
    isWalking: boolean,
    isGateOpenOrUnlocking: boolean,
  ) => SchoolPromptInfo;
  triggerInteractable: (
    playerWorldPos: THREE.Vector3,
    isWalking: boolean,
    isGateOpenOrUnlocking: boolean,
  ) => {
    triggeredId: SchoolInteractableId;
    openCompendiumModal: boolean;
  };
  isDialogueActive: () => boolean;
  isLakeMemoryActive: () => boolean;
  advanceDialogue: () => boolean;
  skipDialogue: () => boolean;
  getActiveBanner: () => SchoolBannerNotification | null;
  getCameraFocus: () => SchoolCameraFocus | null;
  isPatronusActive: () => boolean;
  update: (
    dt: number,
    elapsedTime: number,
    playerWorldPos: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

const _dummyObj = new THREE.Object3D();
const _tempVecA = new THREE.Vector3();
const _tempVecB = new THREE.Vector3();
const _tempColor = new THREE.Color();

/**
 * Procedural Parchment Acceptance Letter Texture (Cream envelope + Crimson Wax Seal)
 */
function createAcceptanceLetterTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f6ebd4';
  ctx.fillRect(0, 0, 256, 160);

  ctx.strokeStyle = '#d3b88c';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 148);

  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(128, 88);
  ctx.lineTo(250, 6);
  ctx.strokeStyle = '#c8aa7a';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#14532d';
  ctx.font = 'italic bold 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Miss Harsha', 128, 122);
  ctx.font = '11px Georgia, serif';
  ctx.fillText('The Realm of Harsha • Heart Island', 128, 140);

  ctx.beginPath();
  ctx.arc(128, 84, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#991b1b';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#7f1d1d';
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('H', 128, 90);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural 3D Floating Magical Banner Texture for the Sorting Hat & Patronus Sky-Writing
 */
function createFloatingMagicalTextTexture(
  tracker: ResourceTracker,
  headline: string,
  subtext: string,
  primaryHex: string,
  glowHex: string,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 1024, 256);

  const rad = ctx.createRadialGradient(512, 128, 20, 512, 128, 460);
  rad.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
  rad.addColorStop(0.6, 'rgba(56, 189, 248, 0.12)');
  rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.shadowColor = glowHex;
  ctx.shadowBlur = 24;
  ctx.fillStyle = primaryHex;
  ctx.font = 'bold 64px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline, 512, 108);

  if (subtext) {
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fffbeb';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText(subtext, 512, 182);
  }

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural Mirror of Desire Top Inscription Plaque Texture:
 * "I SHOW NOT YOUR FACE BUT YOUR HEART'S DESIRE"
 */
function createMirrorInscriptionTexture(
  tracker: ResourceTracker,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#5c4014');
  grad.addColorStop(0.5, '#8c6622');
  grad.addColorStop(1, '#5c4014');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 1008, 112);

  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 28px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("I SHOW NOT YOUR FACE BUT YOUR HEART'S DESIRE", 512, 64);

  const tex = tracker.trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dynamic Canvas Renderer for the 3D Handwritten Pages of "The Compendium of Harsha"
 * Writes the pages live on the 3D lectern book without opening any 2D modal!
 */
function createDynamicCompendiumPagesCanvas(tracker: ResourceTracker) {
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 1024;
    canvas.height = 512;
  }
  const ctx = canvas ? canvas.getContext('2d') : null;
  const tex = canvas
    ? tracker.trackTex(new THREE.CanvasTexture(canvas))
    : null;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  let lastRenderedState = -999;

  function renderPages(seqTime: number, isIdleFlutter: boolean, elapsedTime: number) {
    if (!ctx || !tex) return;

    // Quantize state to avoid unnecessary texture uploads when idle
    const stateBucket =
      seqTime > 0
        ? Math.floor(seqTime * 15)
        : isIdleFlutter
          ? -Math.floor(elapsedTime * 8)
          : -1;
    if (stateBucket === lastRenderedState) return;
    lastRenderedState = stateBucket;

    // Warm aged two-page parchment spread
    ctx.fillStyle = '#f5e8cc';
    ctx.fillRect(0, 0, 1024, 512);

    // Center spine shadow
    const spineGrad = ctx.createLinearGradient(480, 0, 544, 0);
    spineGrad.addColorStop(0, 'rgba(68, 40, 20, 0)');
    spineGrad.addColorStop(0.5, 'rgba(45, 24, 12, 0.42)');
    spineGrad.addColorStop(1, 'rgba(68, 40, 20, 0)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(480, 0, 64, 512);

    // Ornate gold & burgundy page borders
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 468, 472);
    ctx.strokeRect(536, 20, 468, 472);

    ctx.textAlign = 'center';

    if (seqTime <= 0) {
      // Idle state: Ancient runes + occasional golden letters shimmering
      ctx.fillStyle = '#57361a';
      ctx.font = 'italic bold 26px Georgia, serif';
      ctx.fillText('The Compendium of Harsha', 254, 110);
      ctx.font = 'italic 20px Georgia, serif';
      ctx.fillText('A Chronicle of Quiet Efforts & Devotion', 254, 155);

      ctx.fillText(' Chapter I • Understood', 770, 130);
      ctx.fillText(' Chapter II • Adjusted & Grown', 770, 180);
      ctx.fillText(' Chapter III • Always', 770, 230);

      if (isIdleFlutter) {
        ctx.fillStyle = '#d97706';
        ctx.font = 'italic bold 24px Georgia, serif';
        ctx.fillText('✨ Harsha... I notice what you do. ✨', 512, 410);
      }
      tex.needsUpdate = true;
      return;
    }

    // Active Compendium Sequence (t goes from 0.0 -> 13.2s; seqTime is elapsed time since trigger)
    const t = seqTime;

    if (t < 4.5) {
      // SPREAD 1 (1.5s - 4.5s):
      // Left Page: "Harsha... I don't think I tell you this enough."
      // Right Page: "I've noticed the little things you've changed for me."
      const a1 = smoothstep01((t - 1.4) / 1.1);
      const a2 = smoothstep01((t - 2.3) / 1.1);

      ctx.save();
      ctx.globalAlpha = a1;
      ctx.fillStyle = '#3b1d0e';
      ctx.font = 'italic bold 42px Georgia, serif';
      ctx.fillText('“Harsha...”', 254, 185);
      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillText('“I don’t think I tell you', 254, 265);
      ctx.fillText('this enough.”', 254, 310);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = a2;
      ctx.fillStyle = '#3b1d0e';
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillText('“I’ve noticed the little things', 770, 210);
      ctx.fillText('you’ve changed for me.”', 770, 255);
      ctx.restore();
    } else if (t < 8.4) {
      // SPREAD 2 (4.5s - 8.4s):
      // Left Page: Individual glowing words: understood / adjusted / tried / grown
      // Right Page: "I know you didn't have to. But you did."
      ctx.fillStyle = '#5c2d16';
      ctx.font = 'italic 23px Georgia, serif';
      ctx.fillText('“I’ve noticed the little things you’ve changed:”', 254, 88);

      const words = [
        { text: 'understood', delay: 4.6, y: 168 },
        { text: 'adjusted', delay: 5.1, y: 236 },
        { text: 'tried', delay: 5.6, y: 304 },
        { text: 'grown', delay: 6.1, y: 372 },
      ];
      words.forEach((w) => {
        const wa = smoothstep01((t - w.delay) / 0.5);
        if (wa > 0) {
          ctx.save();
          ctx.globalAlpha = wa;
          ctx.fillStyle = '#b45309';
          ctx.font = 'bold italic 38px Georgia, serif';
          ctx.fillText(w.text, 254, w.y);
          ctx.restore();
        }
      });

      const aRight1 = smoothstep01((t - 6.6) / 0.7);
      const aRight2 = smoothstep01((t - 7.3) / 0.7);
      ctx.save();
      ctx.globalAlpha = aRight1;
      ctx.fillStyle = '#3b1d0e';
      ctx.font = 'italic 30px Georgia, serif';
      ctx.fillText('“I know you didn’t have to.”', 770, 215);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = aRight2;
      ctx.fillStyle = '#7f1d1d';
      ctx.font = 'bold italic 36px Georgia, serif';
      ctx.fillText('“But you did.”', 770, 295);
      ctx.restore();
    } else {
      // SPREAD 3 / FINAL PAGE (8.4s - 13.2s):
      // Left Page: "And I want you to know that I notice. I appreciate it."
      // Right Page (Larger handwriting): "Thank you for growing with me. I love you for it."
      const aL = smoothstep01((t - 8.4) / 0.8);
      const aR1 = smoothstep01((t - 9.6) / 0.9);
      const aR2 = smoothstep01((t - 10.6) / 0.9);

      ctx.save();
      ctx.globalAlpha = aL;
      ctx.fillStyle = '#3b1d0e';
      ctx.font = 'italic 29px Georgia, serif';
      ctx.fillText('“And I want you to know', 254, 195);
      ctx.fillText('that I notice.”', 254, 240);
      ctx.font = 'bold italic 34px Georgia, serif';
      ctx.fillText('“I appreciate it.”', 254, 325);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = aR1;
      ctx.fillStyle = '#7f1d1d';
      ctx.font = 'bold italic 36px Georgia, serif';
      ctx.fillText('“Thank you for', 770, 185);
      ctx.fillText('growing with me.”', 770, 235);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = aR2;
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold italic 44px Georgia, serif';
      ctx.fillText('“I love you for it.” ♥', 770, 345);
      ctx.restore();
    }

    tex.needsUpdate = true;
  }

  return { tex, renderPages };
}

/**
 * Dynamic Canvas Renderer for the Mirror of Desire (#3):
 * Renders the choreographed silhouette reflection inside the mirror glass:
 * - Darkening glass -> Harsha appears -> Yeshwanth appears beside her -> moves closer ->
 *   smiles -> playful nudge -> playful nudge back -> holding hands ->
 *   Starfield & Heart Constellation "HARSHA ♥ YESHWANTH" above them!
 */
function createDynamicMirrorReflectionCanvas(tracker: ResourceTracker) {
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 512;
    canvas.height = 1024;
  }
  const ctx = canvas ? canvas.getContext('2d') : null;
  const tex = canvas
    ? tracker.trackTex(new THREE.CanvasTexture(canvas))
    : null;
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  const rand = mulberry32(77123);
  const stars: Array<{ x: number; y: number; r: number; c: string }> = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: rand() * 512,
      y: rand() * 720,
      r: 0.9 + rand() * 2.0,
      c: i % 5 === 0 ? '#fde047' : i % 3 === 0 ? '#f9a8d4' : '#ffffff',
    });
  }

  let lastBucket = -999;

  function renderMirror(seqElapsed: number, isActive: boolean, elapsedTime: number) {
    if (!ctx || !tex) return;

    const bucket = isActive
      ? Math.floor(seqElapsed * 20)
      : -Math.floor(elapsedTime * 3);
    if (bucket === lastBucket) return;
    lastBucket = bucket;

    // 1. Base Mirror Background (Normal silver-indigo when idle; deep midnight when active)
    const darkFactor = isActive ? smoothstep01(seqElapsed / 0.9) : 0.0;
    const bg = ctx.createLinearGradient(0, 0, 0, 1024);
    bg.addColorStop(0, isActive ? '#060412' : '#1b2238');
    bg.addColorStop(0.5, isActive ? '#130d2e' : '#28314e');
    bg.addColorStop(1, isActive ? '#090618' : '#171d30');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 1024);

    if (!isActive) {
      // Idle: calm reflection with occasional ripple & brief faint heart constellation flash every ~10s
      const rippleR = ((elapsedTime * 45) % 360) + 20;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(256, 512, rippleR, 0, Math.PI * 2);
      ctx.stroke();

      const flashCycle = elapsedTime % 10.0;
      if (flashCycle > 7.5 && flashCycle < 9.2) {
        const fAlpha = Math.sin(((flashCycle - 7.5) / 1.7) * Math.PI) * 0.35;
        ctx.save();
        ctx.globalAlpha = fAlpha;
        ctx.translate(256, 280);
        ctx.beginPath();
        for (let t = 0; t <= Math.PI * 2 + 0.05; t += 0.12) {
          const hx = 16 * Math.pow(Math.sin(t), 3) * 5.2;
          const hy =
            -(
              13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)
            ) * 5.2;
          if (t === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
      tex.needsUpdate = true;
      return;
    }

    // ACTIVE MIRROR SEQUENCE (seqElapsed: 0.0s -> 15.2s)
    const t = seqElapsed;
    const figureFadeOut = 1.0 - smoothstep01((t - 12.0) / 1.8);
    const constellationFadeOut = 1.0 - smoothstep01((t - 13.8) / 1.4);

    // Starfield ceiling reveal (starts faintly, blooms brightly at t >= 8.5s)
    const starAlpha =
      (0.25 + 0.75 * smoothstep01((t - 8.2) / 1.8)) * constellationFadeOut;
    ctx.save();
    ctx.globalAlpha = starAlpha;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Heart Constellation & "HARSHA ♥ YESHWANTH" (connects at t >= 9.2s, stays for 3s after silhouettes fade)
    const constAlpha =
      smoothstep01((t - 9.0) / 1.4) * constellationFadeOut;
    if (constAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = constAlpha;
      ctx.translate(256, 285);
      ctx.beginPath();
      const maxAngle = Math.PI * 2 * smoothstep01((t - 9.0) / 1.5);
      for (let a = 0; a <= maxAngle; a += 0.1) {
        const hx = 16 * Math.pow(Math.sin(a), 3) * 6.4;
        const hy =
          -(
            13 * Math.cos(a) -
            5 * Math.cos(2 * a) -
            2 * Math.cos(3 * a) -
            Math.cos(4 * a)
          ) * 6.4;
        if (a === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('HARSHA  ♥  YESHWANTH', 0, 8);
      ctx.restore();
    }

    // Silhouettes of Harsha & Yeshwanth
    const harshaAlpha = smoothstep01((t - 0.6) / 1.0) * figureFadeOut;
    const yeshAlpha = smoothstep01((t - 1.8) / 1.2) * figureFadeOut;

    // Movement choreography:
    // t = 2.5..4.0: Yeshwanth moves closer from x = 168 to x = 204
    const moveCloser = smoothstep01((t - 2.4) / 1.5);
    // t = 5.4..6.6: Yeshwanth nudges Harsha ("Someone I can annoy.")
    const yeshNudge =
      t >= 5.4 && t <= 6.6
        ? Math.sin(((t - 5.4) / 1.2) * Math.PI) * 16.0
        : 0.0;
    // t = 6.8..8.0: Harsha nudges Yeshwanth right back ("Someone who annoys me right back.")
    const harshaNudge =
      t >= 6.8 && t <= 8.0
        ? -Math.sin(((t - 6.8) / 1.2) * Math.PI) * 16.0
        : 0.0;

    const yeshX = 166 + moveCloser * 36 + yeshNudge + harshaNudge * 0.4;
    const harshaX = 318 - moveCloser * 12 + harshaNudge + yeshNudge * 0.4;
    const showSmile = t >= 4.0;
    const holdHands = t >= 8.0;

    // Draw Yeshwanth Silhouette
    if (yeshAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = yeshAlpha;
      ctx.fillStyle = '#140f2d';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.5;

      ctx.beginPath();
      ctx.arc(yeshX, 585, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (showSmile) {
        ctx.beginPath();
        ctx.arc(yeshX + 6, 590, 9, 0.15, Math.PI - 0.15);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(yeshX - 26, 614);
      ctx.lineTo(yeshX + 26, 614);
      ctx.lineTo(yeshX + 34, 880);
      ctx.lineTo(yeshX - 34, 880);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Harsha Silhouette
    if (harshaAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = harshaAlpha;
      ctx.fillStyle = '#140f2d';
      ctx.strokeStyle = '#f9a8d4';
      ctx.lineWidth = 3.5;

      ctx.beginPath();
      ctx.arc(harshaX, 604, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (showSmile) {
        ctx.beginPath();
        ctx.arc(harshaX - 5, 609, 8.5, 0.15, Math.PI - 0.15);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(harshaX - 22, 630);
      ctx.lineTo(harshaX + 22, 630);
      ctx.lineTo(harshaX + 44, 880);
      ctx.lineTo(harshaX - 44, 880);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#f9a8d4';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    // Joined hands ("Someone who stays.")
    if (holdHands && figureFadeOut > 0.01) {
      const handAlpha = smoothstep01((t - 8.0) / 0.8) * figureFadeOut;
      ctx.save();
      ctx.globalAlpha = handAlpha;
      const midX = (yeshX + harshaX) * 0.5;
      ctx.beginPath();
      ctx.moveTo(yeshX + 24, 675);
      ctx.quadraticCurveTo(midX, 695, harshaX - 22, 680);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, 686, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
      ctx.restore();
    }

    tex.needsUpdate = true;
    void darkFactor;
  }

  return { tex, renderMirror };
}

/**
 * Builds the complete Step 3 Wizarding School Interior & Master Flow Emotional Sequence:
 * 1. Sorting Hat ("I see who you are.") — Great Hall Entrance
 * 2. Compendium of Harsha ("I notice what you've done.") — Live 3D Handwritten Pages on Lectern
 * 3. Mirror of Desire ("I choose you.") — Choreographed Reflection & HARSHA ♥ YESHWANTH Constellation
 * 4. Pensieve ("I remember what we've shared.") — Floating 3D Memory Wisps ("laughing · talking · together")
 * 5. Amortentia ("You make me happy.") — Playful Steam Figures & Heart Steam
 * 6. Expecto Patronum ("You take care of me.") — Progressive Doe Formation + 8s Flight + HARSHA ♥ YESHWANTH Stardust
 * 7. Royal Frog ("You even scold me because you care.") — Comedic Hopping Routine & Lily Pad Splash
 */
export function createWizardingSchoolSystem(): WizardingSchoolBundle {
  const group = new THREE.Group();
  group.name = 'WizardingSchoolAndEnchantedRealm';

  const tracker = new ResourceTracker();
  const colliders: CircleCollider[] = [];
  const rand = mulberry32(19970731);

  const schoolRoot = new THREE.Group();
  schoolRoot.position.set(
    CASTLE_GATE_POS.x,
    CASTLE_GATE_POS.y,
    CASTLE_GATE_POS.z,
  );
  schoolRoot.rotation.y = -Math.PI / 4;
  group.add(schoolRoot);

  const addLocalCollider = (
    localX: number,
    localZ: number,
    radius: number,
  ) => {
    const w = castleLocalToWorld(localX, localZ);
    colliders.push({ x: w.x, z: w.z, radius });
  };

  // ============================================================================
  // SHARED ARCHITECTURAL MATERIALS (Restrained Emissives 0.4 - 0.85 for Zero Glare)
  // ============================================================================
  const basaltStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#48425a'),
      roughness: 0.82,
      metalness: 0.06,
    }),
  );
  const warmAshlarStoneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cfc6b8'),
      roughness: 0.76,
      metalness: 0.05,
    }),
  );
  const flagstoneFloorMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#666070'),
      roughness: 0.78,
      metalness: 0.06,
    }),
  );
  const darkWalnutMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#2c1810'),
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.35,
    }),
  );
  const agedOakMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a2c18'),
      roughness: 0.62,
      metalness: 0.06,
    }),
  );
  const brushedBrassMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c89d54'),
      roughness: 0.34,
      metalness: 0.82,
    }),
  );
  const wroughtIronMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#23252e'),
      roughness: 0.46,
      metalness: 0.78,
    }),
  );
  const royalCarpetMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7f1d1d'),
      roughness: 0.86,
      metalness: 0.02,
    }),
  );
  const indigoRoofSlateMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#243056'),
      roughness: 0.48,
      metalness: 0.22,
    }),
  );
  const conservatoryGlassMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dbeafe'),
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.45,
      side: THREE.DoubleSide,
    }),
  );

  // ============================================================================
  // 1. THE GREAT HALL & ENCHANTED NIGHT CEILING (CENTER ATRIUM, 24m CEILING)
  // ============================================================================
  const greatHallGroup = new THREE.Group();
  greatHallGroup.name = 'GreatHallAtrium';
  schoolRoot.add(greatHallGroup);

  const mainFloorGeo = tracker.trackGeo(
    new THREE.BoxGeometry(38.0, 0.5, 26.0),
  );
  mainFloorGeo.translate(0, -0.25, 12.2);
  const mainFloorMesh = new THREE.Mesh(mainFloorGeo, flagstoneFloorMat);
  mainFloorMesh.receiveShadow = true;
  greatHallGroup.add(mainFloorMesh);

  const carpetRunnerGeo = tracker.trackGeo(
    new THREE.PlaneGeometry(4.4, 21.5),
  );
  carpetRunnerGeo.rotateX(-Math.PI / 2);
  carpetRunnerGeo.translate(0, 0.015, 10.8);
  const carpetRunnerMesh = new THREE.Mesh(carpetRunnerGeo, royalCarpetMat);
  carpetRunnerMesh.receiveShadow = true;
  greatHallGroup.add(carpetRunnerMesh);

  const carpetTrimGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.16, 21.5));
  carpetTrimGeo.rotateX(-Math.PI / 2);
  [-2.12, 2.12].forEach((tx) => {
    const trim = new THREE.Mesh(carpetTrimGeo, brushedBrassMat);
    trim.position.set(tx, 0.018, 10.8);
    greatHallGroup.add(trim);
  });

  // Cathedral Facade & Vaulted Ribs
  const frontWallSideGeo = tracker.trackGeo(
    new THREE.BoxGeometry(6.8, 22.0, 1.1),
  );
  frontWallSideGeo.translate(0, 11.0, 0.35);
  const frontWallLeft = new THREE.Mesh(frontWallSideGeo, basaltStoneMat);
  frontWallLeft.position.x = 5.85;
  frontWallLeft.castShadow = true;
  frontWallLeft.receiveShadow = true;
  const frontWallRight = new THREE.Mesh(frontWallSideGeo, basaltStoneMat);
  frontWallRight.position.x = -5.85;
  frontWallRight.castShadow = true;
  frontWallRight.receiveShadow = true;

  const frontUpperWallGeo = tracker.trackGeo(
    new THREE.BoxGeometry(5.2, 16.5, 1.1),
  );
  frontUpperWallGeo.translate(0, 14.25, 0.35);
  const frontUpperWall = new THREE.Mesh(frontUpperWallGeo, basaltStoneMat);
  greatHallGroup.add(frontWallLeft, frontWallRight, frontUpperWall);

  const roseWinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c084fc'),
      emissive: new THREE.Color('#7e22ce'),
      emissiveIntensity: 0.65,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  const roseWinGeo = tracker.trackGeo(new THREE.CircleGeometry(2.35, 24));
  const roseWinOuter = new THREE.Mesh(roseWinGeo, roseWinMat);
  roseWinOuter.position.set(0, 14.2, -0.24);
  roseWinOuter.rotation.y = Math.PI;
  const roseWinInner = new THREE.Mesh(roseWinGeo, roseWinMat);
  roseWinInner.position.set(0, 14.2, 0.94);
  const roseRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(2.38, 0.16, 8, 24),
  );
  const roseRimOuter = new THREE.Mesh(roseRimGeo, brushedBrassMat);
  roseRimOuter.position.set(0, 14.2, -0.22);
  const roseRimInner = new THREE.Mesh(roseRimGeo, brushedBrassMat);
  roseRimInner.position.set(0, 14.2, 0.92);
  greatHallGroup.add(roseWinOuter, roseWinInner, roseRimOuter, roseRimInner);

  const naveColGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.52, 0.62, 22.0, 10),
  );
  naveColGeo.translate(0, 11.0, 0);
  const naveCapGeo = tracker.trackGeo(new THREE.BoxGeometry(1.45, 0.65, 1.45));
  naveCapGeo.translate(0, 21.8, 0);
  const vaultRibGeo = tracker.trackGeo(
    new THREE.TorusGeometry(8.4, 0.24, 8, 28, Math.PI),
  );

  const naveZPositions = [1.2, 5.6, 10.4, 15.2, 20.0, 24.4];
  naveZPositions.forEach((nz) => {
    [-8.4, 8.4].forEach((nx) => {
      const col = new THREE.Mesh(naveColGeo, warmAshlarStoneMat);
      col.position.set(nx, 0, nz);
      col.castShadow = true;
      col.receiveShadow = true;
      const cap = new THREE.Mesh(naveCapGeo, warmAshlarStoneMat);
      cap.position.set(nx, 0, nz);
      greatHallGroup.add(col, cap);
      addLocalCollider(nx, nz, 0.72);
    });

    const rib = new THREE.Mesh(vaultRibGeo, warmAshlarStoneMat);
    rib.position.set(0, 15.2, nz);
    greatHallGroup.add(rib);
  });

  const clerestoryBeamGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.95, 11.0, 25.0),
  );
  clerestoryBeamGeo.translate(0, 17.0, 12.5);
  [-8.6, 8.6].forEach((wx) => {
    const beam = new THREE.Mesh(clerestoryBeamGeo, basaltStoneMat);
    beam.position.x = wx;
    greatHallGroup.add(beam);
  });

  const roofSlopeGeo = tracker.trackGeo(new THREE.BoxGeometry(11.6, 0.55, 26.2));
  const roofLeft = new THREE.Mesh(roofSlopeGeo, indigoRoofSlateMat);
  roofLeft.position.set(4.5, 25.8, 12.5);
  roofLeft.rotation.z = -0.52;
  const roofRight = new THREE.Mesh(roofSlopeGeo, indigoRoofSlateMat);
  roofRight.position.set(-4.5, 25.8, 12.5);
  roofRight.rotation.z = 0.52;
  greatHallGroup.add(roofLeft, roofRight);

  const wingSideWallGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.95, 14.5, 17.2),
  );
  wingSideWallGeo.translate(0, 7.25, 13.0);
  const rightWingOuterWall = new THREE.Mesh(wingSideWallGeo, basaltStoneMat);
  rightWingOuterWall.position.x = -18.6;
  const leftWingOuterWall = new THREE.Mesh(wingSideWallGeo, basaltStoneMat);
  leftWingOuterWall.position.x = 18.6;
  greatHallGroup.add(rightWingOuterWall, leftWingOuterWall);

  const wingFrontBackWallGeo = tracker.trackGeo(
    new THREE.BoxGeometry(10.6, 14.5, 0.95),
  );
  wingFrontBackWallGeo.translate(0, 7.25, 0);
  [-13.5, 13.5].forEach((wx) => {
    [4.8, 21.2].forEach((wz) => {
      const wMesh = new THREE.Mesh(wingFrontBackWallGeo, basaltStoneMat);
      wMesh.position.set(wx, 0, wz);
      greatHallGroup.add(wMesh);
    });
  });

  const wingCeilingGeo = tracker.trackGeo(
    new THREE.BoxGeometry(11.0, 0.6, 17.2),
  );
  wingCeilingGeo.translate(0, 14.2, 13.0);
  [-13.5, 13.5].forEach((wx) => {
    const wc = new THREE.Mesh(wingCeilingGeo, basaltStoneMat);
    wc.position.x = wx;
    greatHallGroup.add(wc);
  });

  for (let z = 5.5; z <= 20.5; z += 2.5) {
    addLocalCollider(-18.6, z, 0.9);
    addLocalCollider(18.6, z, 0.9);
  }
  for (let x = -18.0; x <= -9.5; x += 2.4) {
    addLocalCollider(x, 4.8, 0.9);
    addLocalCollider(x, 21.2, 0.9);
    addLocalCollider(-x, 4.8, 0.9);
    addLocalCollider(-x, 21.2, 0.9);
  }
  addLocalCollider(-4.5, 0.3, 1.1);
  addLocalCollider(-7.0, 0.3, 1.1);
  addLocalCollider(4.5, 0.3, 1.1);
  addLocalCollider(7.0, 0.3, 1.1);

  // 1C. ENCHANTED STARRY NIGHT CEILING (Custom ShaderMaterial at Y = 22.4m)
  const ceilingUniforms = {
    uTime: { value: 0 },
  };
  const starryCeilingMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: ceilingUniforms,
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
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec2 uv = vUv;
          vec3 nightTop = vec3(0.035, 0.025, 0.11);
          vec3 nightMid = vec3(0.09, 0.06, 0.24);
          vec3 col = mix(nightMid, nightTop, smoothstep(0.0, 0.5, abs(uv.x - 0.5)));

          float n1 = noise(uv * vec2(4.5, 7.0) + vec2(uTime * 0.025, -uTime * 0.018));
          float n2 = noise(uv * vec2(9.0, 13.0) - vec2(uTime * 0.03, uTime * 0.02));
          float nebula = smoothstep(0.38, 0.85, n1 * 0.65 + n2 * 0.35);
          vec3 nebulaViolet = vec3(0.38, 0.20, 0.68);
          vec3 nebulaGold = vec3(0.75, 0.55, 0.28);
          col += mix(nebulaViolet, nebulaGold, n2) * nebula * 0.34;

          vec2 starGrid1 = uv * vec2(32.0, 48.0);
          vec2 id1 = floor(starGrid1);
          vec2 gv1 = fract(starGrid1) - 0.5;
          float rnd1 = hash21(id1);
          if (rnd1 > 0.72) {
            float d = length(gv1 - (vec2(hash21(id1 + 1.3), hash21(id1 + 2.7)) - 0.5) * 0.5);
            float twinkle = 0.55 + 0.45 * sin(uTime * (2.2 + rnd1 * 4.0) + rnd1 * 6.28);
            float star = smoothstep(0.11, 0.01, d) * twinkle;
            col += mix(vec3(1.0, 0.95, 0.82), vec3(0.78, 0.88, 1.0), fract(rnd1 * 7.3)) * star;
          }

          vec2 starGrid2 = uv * vec2(68.0, 96.0);
          vec2 id2 = floor(starGrid2);
          vec2 gv2 = fract(starGrid2) - 0.5;
          float rnd2 = hash21(id2 + 9.1);
          if (rnd2 > 0.82) {
            float d2 = length(gv2);
            float twinkle2 = 0.5 + 0.5 * sin(uTime * 3.1 + rnd2 * 12.0);
            col += vec3(0.9, 0.92, 1.0) * smoothstep(0.14, 0.02, d2) * twinkle2 * 0.65;
          }

          vec2 moonUv = (uv - vec2(0.52, 0.76)) * vec2(1.0, 1.5);
          float moonDist = length(moonUv);
          float moonDisc = smoothstep(0.085, 0.072, moonDist);
          float moonHalo = smoothstep(0.28, 0.04, moonDist) * 0.28;
          col += vec3(1.0, 0.96, 0.84) * (moonDisc * 0.85 + moonHalo);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const starryCeilingGeo = tracker.trackGeo(
    new THREE.PlaneGeometry(16.8, 25.0),
  );
  starryCeilingGeo.rotateX(Math.PI / 2);
  const starryCeilingMesh = new THREE.Mesh(starryCeilingGeo, starryCeilingMat);
  starryCeilingMesh.position.set(0, 22.4, 12.5);
  greatHallGroup.add(starryCeilingMesh);

  // 1D. 180 INSTANCED FLOATING CANDLES (Pause bobbing for 0.3s on Sorting Hat, spread outward on Patronus!)
  const candleCount = 180;
  const candleBodyGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.042, 0.046, 0.48, 8),
  );
  const candleWaxMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbeb'),
      emissive: new THREE.Color('#fde68a'),
      emissiveIntensity: 0.22,
      roughness: 0.55,
    }),
  );
  const candleFlameGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.028, 0.11, 6),
  );
  candleFlameGeo.translate(0, 0.295, 0);
  const candleFlameMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.78,
      roughness: 0.2,
    }),
  );

  const candleBodyInstanced = new THREE.InstancedMesh(
    candleBodyGeo,
    candleWaxMat,
    candleCount,
  );
  const candleFlameInstanced = new THREE.InstancedMesh(
    candleFlameGeo,
    candleFlameMat,
    candleCount,
  );
  greatHallGroup.add(candleBodyInstanced, candleFlameInstanced);

  const candleBaseX = new Float32Array(candleCount);
  const candleBaseY = new Float32Array(candleCount);
  const candleBaseZ = new Float32Array(candleCount);
  const candlePhase = new Float32Array(candleCount);

  for (let i = 0; i < candleCount; i++) {
    if (i < 140) {
      candleBaseX[i] = (rand() - 0.5) * 14.4;
      candleBaseZ[i] = 1.8 + rand() * 21.8;
    } else if (i < 160) {
      candleBaseX[i] = -8.8 - rand() * 7.5;
      candleBaseZ[i] = 6.2 + rand() * 13.5;
    } else {
      candleBaseX[i] = 8.8 + rand() * 7.5;
      candleBaseZ[i] = 6.2 + rand() * 13.5;
    }
    candleBaseY[i] = 5.5 + rand() * 7.5;
    candlePhase[i] = rand() * Math.PI * 2;
  }

  const hallLight1 = new THREE.PointLight('#ffdfa3', 2.8, 26.0, 1.4);
  hallLight1.position.set(0, 9.5, 8.5);
  const hallLight2 = new THREE.PointLight('#ffdfa3', 3.0, 28.0, 1.4);
  hallLight2.position.set(0, 10.0, 18.5);
  greatHallGroup.add(hallLight1, hallLight2);

  // 1E. 16 SWIRLING ACCEPTANCE LETTERS (Offset slightly to localX = -2.8, localZ = 3.2 so entrance sightline to Sorting Hat is crystal clear)
  const letterCount = 16;
  const letterTex = createAcceptanceLetterTexture(tracker);
  const letterGeo = tracker.trackGeo(new THREE.BoxGeometry(0.34, 0.012, 0.22));
  const letterMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: letterTex ?? undefined,
      color: new THREE.Color('#fffbeb'),
      roughness: 0.65,
    }),
  );
  const letterMeshes: THREE.Mesh[] = [];
  const letterGroup = new THREE.Group();
  letterGroup.position.set(-2.9, 0, 3.2);
  greatHallGroup.add(letterGroup);

  for (let i = 0; i < letterCount; i++) {
    const m = new THREE.Mesh(letterGeo, letterMat);
    m.castShadow = true;
    letterGroup.add(m);
    letterMeshes.push(m);
  }

  // 1F. TWO LONG OAK HOUSE TABLES, HIGH TABLE DAIS, 4 HOUSE BANNERS & 4 GEM HOURGLASSES
  const refectoryTableGeo = tracker.trackGeo(
    new THREE.BoxGeometry(1.35, 0.82, 8.6),
  );
  refectoryTableGeo.translate(0, 0.41, 0);
  const benchGeo = tracker.trackGeo(new THREE.BoxGeometry(0.42, 0.46, 8.2));
  benchGeo.translate(0, 0.23, 0);

  [-4.5, 4.5].forEach((tx) => {
    const tbl = new THREE.Mesh(refectoryTableGeo, agedOakMat);
    tbl.position.set(tx, 0, 13.8);
    tbl.castShadow = true;
    tbl.receiveShadow = true;
    const benchL = new THREE.Mesh(benchGeo, agedOakMat);
    benchL.position.set(tx - 1.05, 0, 13.8);
    const benchR = new THREE.Mesh(benchGeo, agedOakMat);
    benchR.position.set(tx + 1.05, 0, 13.8);
    greatHallGroup.add(tbl, benchL, benchR);

    addLocalCollider(tx, 10.2, 0.95);
    addLocalCollider(tx, 13.8, 0.95);
    addLocalCollider(tx, 17.4, 0.95);
  });

  const daisGeo = tracker.trackGeo(new THREE.BoxGeometry(11.6, 0.42, 3.6));
  daisGeo.translate(0, 0.21, 21.2);
  const daisMesh = new THREE.Mesh(daisGeo, warmAshlarStoneMat);
  daisMesh.receiveShadow = true;
  greatHallGroup.add(daisMesh);

  const highTableGeo = tracker.trackGeo(new THREE.BoxGeometry(7.8, 0.85, 1.2));
  highTableGeo.translate(0, 0.84, 21.6);
  const highTableMesh = new THREE.Mesh(highTableGeo, darkWalnutMat);
  highTableMesh.castShadow = true;
  greatHallGroup.add(highTableMesh);

  const bannerSpecs = [
    { x: -5.2, color: '#991b1b', trim: '#fbbf24' },
    { x: -1.8, color: '#065f46', trim: '#e2e8f0' },
    { x: 1.8, color: '#1e3a8a', trim: '#d97706' },
    { x: 5.2, color: '#ca8a04', trim: '#1f2937' },
  ];
  const bannerClothGeo = tracker.trackGeo(
    new THREE.PlaneGeometry(1.45, 4.6, 4, 12),
  );
  bannerClothGeo.translate(0, -2.3, 0);
  const bannerBarGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.04, 0.04, 1.65, 8),
  );
  bannerBarGeo.rotateZ(Math.PI / 2);

  const houseBannerMeshes: THREE.Mesh[] = [];
  bannerSpecs.forEach((b) => {
    const bMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.color),
        emissive: new THREE.Color(b.color),
        emissiveIntensity: 0.22,
        roughness: 0.68,
        side: THREE.DoubleSide,
      }),
    );
    const bar = new THREE.Mesh(bannerBarGeo, brushedBrassMat);
    bar.position.set(b.x, 12.8, 21.8);
    const cloth = new THREE.Mesh(bannerClothGeo, bMat);
    cloth.position.set(b.x, 12.8, 21.8);
    greatHallGroup.add(bar, cloth);
    houseBannerMeshes.push(cloth);
  });

  const hourglassPositions = [
    { x: -6.2, z: 21.6, color: '#e11d48' },
    { x: -4.6, z: 21.6, color: '#10b981' },
    { x: 4.6, z: 21.6, color: '#2563eb' },
    { x: 6.2, z: 21.6, color: '#facc15' },
  ];
  const hgBaseGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.46, 0.52, 0.28, 12),
  );
  const hgGlassBulbGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.38, 0.1, 1.35, 12),
  );
  const hgGemPileGeo = tracker.trackGeo(new THREE.ConeGeometry(0.34, 0.75, 10));

  hourglassPositions.forEach((hg) => {
    const hgGroup = new THREE.Group();
    hgGroup.position.set(hg.x, 0.42, hg.z);

    const botBase = new THREE.Mesh(hgBaseGeo, brushedBrassMat);
    botBase.position.y = 0.14;
    const topBase = new THREE.Mesh(hgBaseGeo, brushedBrassMat);
    topBase.position.y = 3.1;

    const botBulb = new THREE.Mesh(hgGlassBulbGeo, conservatoryGlassMat);
    botBulb.position.y = 0.95;
    botBulb.rotation.x = Math.PI;
    const topBulb = new THREE.Mesh(hgGlassBulbGeo, conservatoryGlassMat);
    topBulb.position.y = 2.28;

    const gemMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hg.color),
        emissive: new THREE.Color(hg.color),
        emissiveIntensity: 0.55,
        roughness: 0.25,
      }),
    );
    const gemPile = new THREE.Mesh(hgGemPileGeo, gemMat);
    gemPile.position.y = 0.65;

    hgGroup.add(botBase, topBase, botBulb, topBulb, gemPile);
    greatHallGroup.add(hgGroup);
    addLocalCollider(hg.x, hg.z, 0.6);
  });

  // ============================================================================
  // 🎩 INTERACTABLE #1: THE SORTING HAT ("I see who you are.")
  //    Located near the Great Hall entrance (localX = 0, localZ = 5.4) so it is
  //    immediately noticeable from the Castle Gate!
  // ============================================================================
  const sortingHatPos = new THREE.Vector3(0, 0, 5.4);
  const sortingStationGroup = new THREE.Group();
  sortingStationGroup.position.copy(sortingHatPos);
  greatHallGroup.add(sortingStationGroup);
  addLocalCollider(0, 5.4, 0.95);

  // Slightly raised circular wooden platform
  const hatPlatformGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(1.18, 1.28, 0.18, 24),
  );
  hatPlatformGeo.translate(0, 0.09, 0);
  const hatPlatformRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.22, 0.035, 8, 28),
  );
  hatPlatformRimGeo.rotateX(Math.PI / 2);
  hatPlatformRimGeo.translate(0, 0.18, 0);
  const hatPlatformMesh = new THREE.Mesh(hatPlatformGeo, darkWalnutMat);
  const hatPlatformRim = new THREE.Mesh(hatPlatformRimGeo, brushedBrassMat);
  sortingStationGroup.add(hatPlatformMesh, hatPlatformRim);

  // Three-legged wooden stool on the platform
  const stoolSeatGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.38, 0.36, 0.08, 16),
  );
  stoolSeatGeo.translate(0, 0.92, 0);
  const stoolLegGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.035, 0.025, 0.78, 8),
  );
  stoolLegGeo.translate(0, 0.53, 0);
  const stoolMesh = new THREE.Mesh(stoolSeatGeo, darkWalnutMat);
  sortingStationGroup.add(stoolMesh);
  for (let l = 0; l < 3; l++) {
    const ang = (l * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(stoolLegGeo, darkWalnutMat);
    leg.position.set(Math.sin(ang) * 0.22, 0, Math.cos(ang) * 0.22);
    leg.rotation.z = -Math.sin(ang) * 0.12;
    leg.rotation.x = Math.cos(ang) * 0.12;
    sortingStationGroup.add(leg);
  }

  // Warm spotlight directly illuminating the Sorting Hat
  const sortingHatSpot = new THREE.PointLight('#ffe4a0', 2.2, 8.0, 1.5);
  sortingHatSpot.position.set(0, 3.4, -0.6);
  sortingStationGroup.add(sortingHatSpot);

  // The Ancient Sorting Hat (weathered stitched leather brim + creased tiers + bent tip)
  const hatPivot = new THREE.Group();
  hatPivot.position.set(0, 0.96, 0);
  sortingStationGroup.add(hatPivot);

  const weatheredLeatherMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#432818'),
      roughness: 0.84,
      metalness: 0.05,
    }),
  );
  const hatBrimGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.42, 0.46, 0.035, 20),
  );
  const hatLowerConeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.26, 0.34, 14),
  );
  hatLowerConeGeo.translate(0, 0.17, 0);
  const hatUpperTipGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.15, 0.36, 12),
  );
  hatUpperTipGeo.translate(0, 0.18, 0);

  const hatBrim = new THREE.Mesh(hatBrimGeo, weatheredLeatherMat);
  const hatLower = new THREE.Mesh(hatLowerConeGeo, weatheredLeatherMat);
  const hatTipPivot = new THREE.Group();
  hatTipPivot.position.set(0, 0.28, 0.02);
  hatTipPivot.rotation.x = -0.38;
  hatTipPivot.rotation.z = 0.24;
  const hatUpper = new THREE.Mesh(hatUpperTipGeo, weatheredLeatherMat);
  hatTipPivot.add(hatUpper);
  hatPivot.add(hatBrim, hatLower, hatTipPivot);

  // Goblet of Blue Flame directly behind the Sorting Hat (z = +1.35m in station space)
  const gobletPedestalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.28, 0.36, 1.15, 12),
  );
  gobletPedestalGeo.translate(0, 0.575, 1.35);
  const gobletCupGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.25, 0.12, 0.44, 12),
  );
  gobletCupGeo.translate(0, 1.36, 1.35);
  const gobletPedestal = new THREE.Mesh(gobletPedestalGeo, warmAshlarStoneMat);
  const gobletCup = new THREE.Mesh(gobletCupGeo, wroughtIronMat);
  sortingStationGroup.add(gobletPedestal, gobletCup);

  const blueFlameMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7dd3fc'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.82,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const gobletFlameGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.18, 0.58, 10),
  );
  gobletFlameGeo.translate(0, 0.29, 0);
  const gobletFlameMesh = new THREE.Mesh(gobletFlameGeo, blueFlameMat);
  gobletFlameMesh.position.set(0, 1.56, 1.35);
  sortingStationGroup.add(gobletFlameMesh);

  // Expanding Magical Pulse Ring around the Sorting Hat ("You understand him.")
  const hatPulseRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.35, 0.44, 32),
  );
  hatPulseRingGeo.rotateX(-Math.PI / 2);
  const hatPulseRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fde047'),
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const hatPulseRingMesh = new THREE.Mesh(hatPulseRingGeo, hatPulseRingMat);
  hatPulseRingMesh.position.set(0, 0.98, 0);
  sortingStationGroup.add(hatPulseRingMesh);

  // 3D Floating Reveal Banner above the Hat & Goblet: "THE REALM OF HARSHA"
  const realmRevealTex = createFloatingMagicalTextTexture(
    tracker,
    'THE REALM OF HARSHA',
    '“Because every good wizard needs someone who understands him.”',
    '#fef08a',
    '#f59e0b',
  );
  const realmRevealMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: realmRevealTex ?? undefined,
      transparent: true,
      opacity: 0.0,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  const realmRevealGeo = tracker.trackGeo(new THREE.PlaneGeometry(4.4, 1.1));
  const realmRevealMesh = new THREE.Mesh(realmRevealGeo, realmRevealMat);
  realmRevealMesh.position.set(0, 2.85, 0.6);
  realmRevealMesh.rotation.y = Math.PI; // Faces toward the Castle Gate entrance
  const realmRevealBackMesh = new THREE.Mesh(realmRevealGeo, realmRevealMat);
  realmRevealBackMesh.position.z = -0.01;
  realmRevealBackMesh.rotation.y = Math.PI;
  realmRevealMesh.add(realmRevealBackMesh);
  sortingStationGroup.add(realmRevealMesh);

  // Sorting Hat & Goblet Spark Particles (54 gold/azure motes)
  const sortingSparkCount = 54;
  const sortingSparkPos = new Float32Array(sortingSparkCount * 3);
  const sortingSparkGeo = tracker.trackGeo(new THREE.BufferGeometry());
  sortingSparkGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(sortingSparkPos, 3),
  );
  const sortingSparkMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#fde047'),
      size: 0.075,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sortingSparkPoints = new THREE.Points(sortingSparkGeo, sortingSparkMat);
  sortingStationGroup.add(sortingSparkPoints);

  // ============================================================================
  // 2. RIGHT WING ALCOVE: BOOK-LOVER'S CATHEDRAL LIBRARY & RESTRICTED SECTION
  // ============================================================================
  const libraryGroup = new THREE.Group();
  libraryGroup.name = 'BookLoversCathedralLibrary';
  schoolRoot.add(libraryGroup);

  const libraryLight = new THREE.PointLight('#ffd28a', 2.6, 18.0, 1.4);
  libraryLight.position.set(-13.5, 5.2, 13.0);
  libraryGroup.add(libraryLight);

  const bookcaseFrameGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.75, 9.6, 3.8),
  );
  bookcaseFrameGeo.translate(0, 4.8, 0);

  const shelfBayPositions = [
    { x: -17.8, z: 7.4, rotY: 0 },
    { x: -17.8, z: 13.0, rotY: 0 },
    { x: -17.8, z: 18.4, rotY: 0 },
    { x: -13.5, z: 5.4, rotY: Math.PI / 2 },
    { x: -13.5, z: 20.4, rotY: -Math.PI / 2 },
  ];

  shelfBayPositions.forEach((bay) => {
    const shelf = new THREE.Mesh(bookcaseFrameGeo, darkWalnutMat);
    shelf.position.set(bay.x, 0, bay.z);
    shelf.rotation.y = bay.rotY;
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    libraryGroup.add(shelf);
  });

  const ladderRailGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.028, 0.028, 7.2, 6),
  );
  [7.4, 18.2].forEach((lz) => {
    const ladderGroup = new THREE.Group();
    ladderGroup.position.set(-17.15, 3.5, lz);
    ladderGroup.rotation.z = -0.14;
    const r1 = new THREE.Mesh(ladderRailGeo, brushedBrassMat);
    r1.position.z = -0.24;
    const r2 = new THREE.Mesh(ladderRailGeo, brushedBrassMat);
    r2.position.z = 0.24;
    ladderGroup.add(r1, r2);
    libraryGroup.add(ladderGroup);
  });

  const bookCount = 640;
  const bookSpineGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.24, 0.34, 0.09),
  );
  const bookSpineMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.52,
      metalness: 0.12,
    }),
  );
  const bookInstanced = new THREE.InstancedMesh(
    bookSpineGeo,
    bookSpineMat,
    bookCount,
  );
  libraryGroup.add(bookInstanced);

  const bookPalette = [
    '#7f1d1d',
    '#14532d',
    '#1e3a8a',
    '#b45309',
    '#581c87',
    '#7c2d12',
  ];

  let bIdx = 0;
  shelfBayPositions.forEach((bay) => {
    for (let row = 0; row < 8; row++) {
      const shelfY = 0.85 + row * 1.05;
      for (let slot = 0; slot < 16; slot++) {
        if (bIdx >= bookCount) break;
        const along = (slot / 15 - 0.5) * 3.35;
        const hScale = 0.82 + rand() * 0.35;
        _dummyObj.position.set(
          bay.x + (bay.rotY === 0 ? 0.32 : along),
          shelfY,
          bay.z + (bay.rotY === 0 ? along : bay.rotY > 0 ? 0.32 : -0.32),
        );
        _dummyObj.rotation.set(0, bay.rotY, (rand() - 0.5) * 0.08);
        _dummyObj.scale.set(1, hScale, 0.85 + rand() * 0.35);
        _dummyObj.updateMatrix();
        bookInstanced.setMatrixAt(bIdx, _dummyObj.matrix);
        _tempColor.set(bookPalette[bIdx % bookPalette.length]);
        bookInstanced.setColorAt(bIdx, _tempColor);
        bIdx++;
      }
    }
  });
  bookInstanced.instanceMatrix.needsUpdate = true;
  if (bookInstanced.instanceColor) bookInstanced.instanceColor.needsUpdate = true;

  // 10 Self-Flying Flapping Books
  const flyingBookSpline = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-12.5, 4.4, 8.2),
      new THREE.Vector3(-15.5, 5.6, 13.0),
      new THREE.Vector3(-12.2, 4.8, 17.8),
      new THREE.Vector3(-7.5, 6.2, 15.2),
      new THREE.Vector3(-8.2, 5.0, 10.2),
    ],
    true,
  );
  const coverWingGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.24, 0.018, 0.32),
  );
  coverWingGeo.translate(0.12, 0, 0);

  interface FlyingBookRig {
    root: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    phaseOffset: number;
  }
  const flyingBooks: FlyingBookRig[] = [];

  for (let i = 0; i < 10; i++) {
    const fbRoot = new THREE.Group();
    const coverMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(bookPalette[i % bookPalette.length]),
        roughness: 0.45,
      }),
    );
    const leftWing = new THREE.Mesh(coverWingGeo, coverMat);
    leftWing.scale.x = -1;
    const rightWing = new THREE.Mesh(coverWingGeo, coverMat);
    fbRoot.add(leftWing, rightWing);
    libraryGroup.add(fbRoot);
    flyingBooks.push({
      root: fbRoot,
      leftWing,
      rightWing,
      phaseOffset: i / 10,
    });
  }

  // ============================================================================
  // 📖 INTERACTABLE #2: THE COMPENDIUM OF HARSHA ("I notice what you've done.")
  //    Articulated 3D Book on the Library Lectern with Live Self-Writing Pages!
  // ============================================================================
  const compendiumPos = new THREE.Vector3(-12.2, 0, 12.8);
  const lecternGroup = new THREE.Group();
  lecternGroup.position.copy(compendiumPos);
  // Orient lectern so its front (+Z) faces the Great Hall archway (+X in schoolRoot = Math.PI/2)
  lecternGroup.rotation.y = Math.PI / 2;
  libraryGroup.add(lecternGroup);
  addLocalCollider(compendiumPos.x, compendiumPos.z, 0.65);

  const lecternPedestalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.18, 0.34, 1.12, 12),
  );
  lecternPedestalGeo.translate(0, 0.56, 0);
  const lecternDeskGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.92, 0.06, 0.64),
  );
  const lecternPedestal = new THREE.Mesh(lecternPedestalGeo, brushedBrassMat);
  const lecternDesk = new THREE.Mesh(lecternDeskGeo, darkWalnutMat);
  lecternDesk.position.set(0, 1.15, 0);
  lecternDesk.rotation.x = 0.42;
  lecternGroup.add(lecternPedestal, lecternDesk);

  // Articulated 3D Grimoire Rig on the tilted desk
  const compendiumBookRig = new THREE.Group();
  compendiumBookRig.position.set(0, 1.2, 0.02);
  compendiumBookRig.rotation.x = 0.42;
  lecternGroup.add(compendiumBookRig);

  const dynamicCompendium = createDynamicCompendiumPagesCanvas(tracker);
  const compendiumSpreadMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: dynamicCompendium.tex ?? undefined,
      color: new THREE.Color('#fffbeb'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.28,
      roughness: 0.55,
    }),
  );
  const compendiumLeatherMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a1d1f'),
      roughness: 0.65,
      metalness: 0.15,
    }),
  );

  // Left & Right hinged covers + Open Parchment Spread + Turning Page Leaf + Glowing Bookmark
  const bookSpreadGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.78, 0.52));
  bookSpreadGeo.rotateX(-Math.PI / 2);
  const bookSpreadMesh = new THREE.Mesh(bookSpreadGeo, compendiumSpreadMat);
  bookSpreadMesh.position.y = 0.028;

  const bookBaseBlockGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.82, 0.045, 0.56),
  );
  const bookBaseBlock = new THREE.Mesh(bookBaseBlockGeo, compendiumLeatherMat);

  const turningLeafPivot = new THREE.Group();
  turningLeafPivot.position.set(0, 0.032, 0);
  const turningLeafGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.38, 0.5));
  turningLeafGeo.rotateX(-Math.PI / 2);
  turningLeafGeo.translate(0.19, 0, 0);
  const turningLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f5e8cc'),
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  const turningLeafMesh = new THREE.Mesh(turningLeafGeo, turningLeafMat);
  turningLeafPivot.add(turningLeafMesh);

  // Glowing Gold-and-Crimson Bookmark Ribbon hanging from the spine
  const bookmarkGeo = tracker.trackGeo(new THREE.BoxGeometry(0.045, 0.01, 0.24));
  const bookmarkMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbbf24'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.35,
      roughness: 0.35,
    }),
  );
  const bookmarkMesh = new THREE.Mesh(bookmarkGeo, bookmarkMat);
  bookmarkMesh.position.set(0, 0.025, 0.32);

  compendiumBookRig.add(
    bookBaseBlock,
    bookSpreadMesh,
    turningLeafPivot,
    bookmarkMesh,
  );

  // Golden Dust Motes rising from the Compendium (32 particles)
  const compendiumDustCount = 32;
  const compendiumDustPos = new Float32Array(compendiumDustCount * 3);
  const compendiumDustGeo = tracker.trackGeo(new THREE.BufferGeometry());
  compendiumDustGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(compendiumDustPos, 3),
  );
  const compendiumDustMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#fde047'),
      size: 0.048,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const compendiumDustPoints = new THREE.Points(
    compendiumDustGeo,
    compendiumDustMat,
  );
  lecternGroup.add(compendiumDustPoints);

  // Emerald Reading Lamp above the lectern
  const emeraldShadeMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#10b981'),
      emissive: new THREE.Color('#059669'),
      emissiveIntensity: 0.62,
      roughness: 0.25,
    }),
  );
  const lampShadeGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.16, 0.14, 12),
  );
  const lampShade = new THREE.Mesh(lampShadeGeo, emeraldShadeMat);
  lampShade.position.set(0, 1.62, -0.22);
  lecternGroup.add(lampShade);

  // ============================================================================
  // 🪞 INTERACTABLE #3: THE MIRROR OF DESIRE ("I choose you.")
  // ============================================================================
  const mirrorPos = new THREE.Vector3(-15.8, 0, 8.2);
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.copy(mirrorPos);
  mirrorGroup.rotation.y = Math.PI / 4;
  libraryGroup.add(mirrorGroup);
  addLocalCollider(mirrorPos.x, mirrorPos.z, 0.95);

  const mirrorFramePillarGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.26, 3.8, 0.28),
  );
  mirrorFramePillarGeo.translate(0, 1.9, 0);
  const mirrorLeftPillar = new THREE.Mesh(mirrorFramePillarGeo, brushedBrassMat);
  mirrorLeftPillar.position.x = -1.05;
  const mirrorRightPillar = new THREE.Mesh(
    mirrorFramePillarGeo,
    brushedBrassMat,
  );
  mirrorRightPillar.position.x = 1.05;

  const mirrorCorniceGeo = tracker.trackGeo(
    new THREE.BoxGeometry(2.48, 0.38, 0.34),
  );
  const mirrorInscriptionTex = createMirrorInscriptionTexture(tracker);
  const mirrorInscriptionMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      map: mirrorInscriptionTex ?? undefined,
      color: new THREE.Color('#fde68a'),
      emissive: new THREE.Color('#b45309'),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.65,
    }),
  );
  const mirrorCornice = new THREE.Mesh(mirrorCorniceGeo, [
    brushedBrassMat,
    brushedBrassMat,
    brushedBrassMat,
    brushedBrassMat,
    mirrorInscriptionMat,
    brushedBrassMat,
  ]);
  mirrorCornice.position.set(0, 3.95, 0);

  const mirrorCrownGeo = tracker.trackGeo(new THREE.ConeGeometry(0.85, 0.75, 4));
  mirrorCrownGeo.rotateY(Math.PI / 4);
  const mirrorCrown = new THREE.Mesh(mirrorCrownGeo, brushedBrassMat);
  mirrorCrown.position.set(0, 4.45, 0);

  const dynamicMirror = createDynamicMirrorReflectionCanvas(tracker);
  const mirrorSurfaceGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.85, 3.6));
  const mirrorGlassMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: dynamicMirror.tex ?? undefined,
    }),
  );
  const mirrorSurfaceMesh = new THREE.Mesh(mirrorSurfaceGeo, mirrorGlassMat);
  mirrorSurfaceMesh.position.set(0, 1.92, 0.065);

  mirrorGroup.add(
    mirrorLeftPillar,
    mirrorRightPillar,
    mirrorCornice,
    mirrorCrown,
    mirrorSurfaceMesh,
  );

  // ============================================================================
  // 🌀 INTERACTABLE #4: THE PENSIEVE STONE BASIN ("I remember what we've shared.")
  // ============================================================================
  const pensievePos = new THREE.Vector3(-15.2, 0, 17.2);
  const pensieveGroup = new THREE.Group();
  pensieveGroup.position.copy(pensievePos);
  libraryGroup.add(pensieveGroup);
  addLocalCollider(pensievePos.x, pensievePos.z, 0.72);

  const pensievePedestalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.42, 0.56, 0.96, 16),
  );
  pensievePedestalGeo.translate(0, 0.48, 0);
  const pensieveRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.56, 0.09, 10, 28),
  );
  pensieveRimGeo.rotateX(Math.PI / 2);
  pensieveRimGeo.translate(0, 0.98, 0);

  const pensievePedestal = new THREE.Mesh(pensievePedestalGeo, basaltStoneMat);
  const pensieveRim = new THREE.Mesh(pensieveRimGeo, warmAshlarStoneMat);
  pensieveGroup.add(pensievePedestal, pensieveRim);

  const pensieveUniforms = {
    uTime: { value: 0 },
    uActiveBoost: { value: 0 },
  };
  const pensieveLiquidMat = tracker.trackMat(
    new THREE.ShaderMaterial({
      uniforms: pensieveUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uActiveBoost;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float swirl = sin(a * 4.0 - r * 10.0 + uTime * (2.2 + uActiveBoost * 2.5));
          float wisp = cos(a * 2.0 + r * 7.0 - uTime * 1.6);
          float pattern = smoothstep(-0.6, 0.8, swirl * 0.6 + wisp * 0.4);
          vec3 deepSilver = vec3(0.18, 0.26, 0.42);
          vec3 pearlGlow = vec3(0.82, 0.94, 1.0);
          vec3 col = mix(deepSilver, pearlGlow, pattern) * (0.85 + uActiveBoost * 0.35);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const pensieveLiquidGeo = tracker.trackGeo(new THREE.CircleGeometry(0.52, 28));
  pensieveLiquidGeo.rotateX(-Math.PI / 2);
  const pensieveLiquidMesh = new THREE.Mesh(
    pensieveLiquidGeo,
    pensieveLiquidMat,
  );
  pensieveLiquidMesh.position.y = 0.97;
  pensieveGroup.add(pensieveLiquidMesh);

  // 3D Floating Silver Memory Words above the Pensieve ("laughing · talking · together")
  const pensieveWordsTex = createFloatingMagicalTextTexture(
    tracker,
    'laughing  ·  talking  ·  together',
    '“Thank you for being there, Harsha.”',
    '#e0f2fe',
    '#38bdf8',
  );
  const pensieveWordsMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: pensieveWordsTex ?? undefined,
      transparent: true,
      opacity: 0.0,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  const pensieveWordsGeo = tracker.trackGeo(new THREE.PlaneGeometry(2.6, 0.65));
  const pensieveWordsMesh = new THREE.Mesh(pensieveWordsGeo, pensieveWordsMat);
  pensieveWordsMesh.position.set(0, 1.95, 0);
  pensieveWordsMesh.rotation.y = Math.PI / 2;
  const pensieveWordsBackMesh = new THREE.Mesh(pensieveWordsGeo, pensieveWordsMat);
  pensieveWordsBackMesh.position.z = -0.01;
  pensieveWordsBackMesh.rotation.y = Math.PI;
  pensieveWordsMesh.add(pensieveWordsBackMesh);
  pensieveGroup.add(pensieveWordsMesh);

  // Playful Bouncing Memory Orb ("And the completely stupid little things.")
  const playfulOrbGeo = tracker.trackGeo(new THREE.SphereGeometry(0.065, 10, 10));
  const playfulOrbMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#bae6fd'),
      transparent: true,
      opacity: 0.0,
    }),
  );
  const playfulMemoryOrb = new THREE.Mesh(playfulOrbGeo, playfulOrbMat);
  playfulMemoryOrb.position.set(0, 1.15, 0);
  pensieveGroup.add(playfulMemoryOrb);

  const pensieveWispCount = 36;
  const pensieveWispPos = new Float32Array(pensieveWispCount * 3);
  const pensieveWispGeo = tracker.trackGeo(new THREE.BufferGeometry());
  pensieveWispGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(pensieveWispPos, 3),
  );
  const pensieveWispMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#e0f2fe'),
      size: 0.065,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const pensieveWispPoints = new THREE.Points(pensieveWispGeo, pensieveWispMat);
  pensieveGroup.add(pensieveWispPoints);

  // ============================================================================
  // 3. LEFT WING ALCOVE: POTIONS APOTHECARY (AMORTENTIA) & PATRONUS SPELL CIRCLE
  // ============================================================================
  const potionsGroup = new THREE.Group();
  potionsGroup.name = 'PotionsApothecaryAndPatronusWing';
  schoolRoot.add(potionsGroup);

  const potionsLight = new THREE.PointLight('#c084fc', 2.4, 18.0, 1.4);
  potionsLight.position.set(13.5, 5.0, 13.0);
  potionsGroup.add(potionsLight);

  const apothecaryRackGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.75, 5.4, 9.2),
  );
  apothecaryRackGeo.translate(17.8, 2.7, 13.0);
  const apothecaryRackMesh = new THREE.Mesh(apothecaryRackGeo, darkWalnutMat);
  potionsGroup.add(apothecaryRackMesh);

  const vialCount = 96;
  const vialGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.065, 0.085, 0.28, 8),
  );
  const vialMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#a855f7'),
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.1,
    }),
  );
  const vialInstanced = new THREE.InstancedMesh(vialGeo, vialMat, vialCount);
  potionsGroup.add(vialInstanced);

  const potionColors = ['#fbbf24', '#10b981', '#a855f7', '#f43f5e', '#38bdf8'];
  for (let i = 0; i < vialCount; i++) {
    const row = Math.floor(i / 16);
    const col = i % 16;
    _dummyObj.position.set(
      17.42,
      0.95 + row * 0.72,
      8.8 + (col / 15) * 8.4,
    );
    _dummyObj.rotation.set(0, 0, 0);
    _dummyObj.scale.setScalar(0.85 + (i % 3) * 0.15);
    _dummyObj.updateMatrix();
    vialInstanced.setMatrixAt(i, _dummyObj.matrix);
    _tempColor.set(potionColors[i % potionColors.length]);
    vialInstanced.setColorAt(i, _tempColor);
  }
  vialInstanced.instanceMatrix.needsUpdate = true;
  if (vialInstanced.instanceColor) vialInstanced.instanceColor.needsUpdate = true;

  // ============================================================================
  // 🧪 INTERACTABLE #5: THE AMORTENTIA LOVE POTION CAULDRON ("You make me happy.")
  // ============================================================================
  const amortentiaPos = new THREE.Vector3(14.6, 0, 9.2);
  const amortentiaGroup = new THREE.Group();
  amortentiaGroup.position.copy(amortentiaPos);
  potionsGroup.add(amortentiaGroup);
  addLocalCollider(amortentiaPos.x, amortentiaPos.z, 0.78);

  const hearthStoneGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.68, 0.76, 0.36, 14),
  );
  hearthStoneGeo.translate(0, 0.18, 0);
  const cauldronBellyGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.52, 16, 14),
  );
  cauldronBellyGeo.scale(1.0, 0.82, 1.0);
  cauldronBellyGeo.translate(0, 0.68, 0);
  const cauldronLipGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.42, 0.06, 8, 24),
  );
  cauldronLipGeo.rotateX(Math.PI / 2);
  cauldronLipGeo.translate(0, 1.02, 0);

  const hearthStone = new THREE.Mesh(hearthStoneGeo, basaltStoneMat);
  const cauldronBelly = new THREE.Mesh(cauldronBellyGeo, wroughtIronMat);
  const cauldronLip = new THREE.Mesh(cauldronLipGeo, brushedBrassMat);
  amortentiaGroup.add(hearthStone, cauldronBelly, cauldronLip);

  const pearlPotionMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.58,
      roughness: 0.15,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
    }),
  );
  const potionDiscGeo = tracker.trackGeo(new THREE.CircleGeometry(0.4, 20));
  potionDiscGeo.rotateX(-Math.PI / 2);
  const potionDisc = new THREE.Mesh(potionDiscGeo, pearlPotionMat);
  potionDisc.position.y = 0.99;
  amortentiaGroup.add(potionDisc);

  const heartShape2D = createHeartShape2D(0.14);
  const steamHeartGeo = tracker.trackGeo(
    new THREE.ExtrudeGeometry(heartShape2D, {
      depth: 0.02,
      bevelEnabled: false,
    }),
  );
  steamHeartGeo.center();
  const steamHeartMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fdf2f8'),
      emissive: new THREE.Color('#f472b6'),
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.72,
    }),
  );
  const steamHearts: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const sh = new THREE.Mesh(steamHeartGeo, steamHeartMat);
    amortentiaGroup.add(sh);
    steamHearts.push(sh);
  }

  // Two miniature laughing steam figures that dance in the vapor during Scent 2 ("Something that makes me smile...")
  const steamLaughingFiguresGroup = new THREE.Group();
  steamLaughingFiguresGroup.position.set(0, 1.55, 0);
  steamLaughingFiguresGroup.visible = false;
  amortentiaGroup.add(steamLaughingFiguresGroup);

  const miniSteamFigGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.06, 0.18, 6, 8),
  );
  const figL = new THREE.Mesh(miniSteamFigGeo, steamHeartMat);
  figL.position.x = -0.14;
  const figR = new THREE.Mesh(miniSteamFigGeo, steamHeartMat);
  figR.position.x = 0.14;
  steamLaughingFiguresGroup.add(figL, figR);

  // ============================================================================
  // 🦌 INTERACTABLE #6: EXPECTO PATRONUM ("You take care of me.")
  //    Progressive Doe Formation (legs -> body -> head) + 8s Flight +
  //    3D Stardust Sky-Writing: "HARSHA ♥ YESHWANTH"
  // ============================================================================
  const patronusCirclePos = new THREE.Vector3(13.4, 0, 16.4);
  const patronusStationGroup = new THREE.Group();
  patronusStationGroup.position.copy(patronusCirclePos);
  potionsGroup.add(patronusStationGroup);
  addLocalCollider(patronusCirclePos.x, patronusCirclePos.z, 0.55);

  const patronusRuneMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#bae6fd'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.68,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
  );
  const outerSpellRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(1.48, 1.62, 40),
  );
  outerSpellRingGeo.rotateX(-Math.PI / 2);
  const innerSpellRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.92, 1.02, 32),
  );
  innerSpellRingGeo.rotateX(-Math.PI / 2);

  const outerSpellRing = new THREE.Mesh(outerSpellRingGeo, patronusRuneMat);
  outerSpellRing.position.y = 0.025;
  const innerSpellRing = new THREE.Mesh(innerSpellRingGeo, patronusRuneMat);
  innerSpellRing.position.y = 0.028;

  const wandPedestalGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.26, 0.34, 0.96, 12),
  );
  wandPedestalGeo.translate(0, 0.48, 0);
  const wandPedestal = new THREE.Mesh(wandPedestalGeo, warmAshlarStoneMat);

  const wandGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.008, 0.018, 0.38, 8),
  );
  wandGeo.rotateZ(Math.PI / 3);
  const floatingWandMesh = new THREE.Mesh(wandGeo, darkWalnutMat);
  floatingWandMesh.position.set(0, 1.18, 0);

  patronusStationGroup.add(
    outerSpellRing,
    innerSpellRing,
    wandPedestal,
    floatingWandMesh,
  );

  // Patronus Doe Rig with separate materials for Legs, Body, and Head so they can materialize progressively!
  const patronusFlightGroup = new THREE.Group();
  patronusFlightGroup.visible = false;
  schoolRoot.add(patronusFlightGroup);

  const patronusDoeRig = new THREE.Group();
  patronusFlightGroup.add(patronusDoeRig);

  const makePatronusPartMat = () =>
    tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e0f2fe'),
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 0.82,
        transparent: true,
        opacity: 0.0,
        roughness: 0.18,
      }),
    );

  const doeLegsMat = makePatronusPartMat();
  const doeBodyMat = makePatronusPartMat();
  const doeHeadMat = makePatronusPartMat();

  const doeTorsoGeo = tracker.trackGeo(
    new THREE.CapsuleGeometry(0.26, 0.72, 8, 12),
  );
  doeTorsoGeo.rotateX(Math.PI / 2);
  const doeNeckGeo = tracker.trackGeo(new THREE.ConeGeometry(0.16, 0.56, 10));
  const doeHeadGeo = tracker.trackGeo(new THREE.ConeGeometry(0.13, 0.38, 10));
  doeHeadGeo.rotateX(Math.PI / 2);
  const doeLegGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.045, 0.025, 0.68, 8),
  );
  doeLegGeo.translate(0, -0.34, 0);

  const doeTorso = new THREE.Mesh(doeTorsoGeo, doeBodyMat);
  doeTorso.position.set(0, 0.78, 0);
  const doeNeck = new THREE.Mesh(doeNeckGeo, doeBodyMat);
  doeNeck.position.set(0, 1.12, 0.38);
  doeNeck.rotation.x = 0.35;
  const doeHead = new THREE.Mesh(doeHeadGeo, doeHeadMat);
  doeHead.position.set(0, 1.38, 0.54);

  const doeFrontLeftLeg = new THREE.Mesh(doeLegGeo, doeLegsMat);
  doeFrontLeftLeg.position.set(-0.14, 0.68, 0.32);
  const doeFrontRightLeg = new THREE.Mesh(doeLegGeo, doeLegsMat);
  doeFrontRightLeg.position.set(0.14, 0.68, 0.32);
  const doeBackLeftLeg = new THREE.Mesh(doeLegGeo, doeLegsMat);
  doeBackLeftLeg.position.set(-0.14, 0.68, -0.32);
  const doeBackRightLeg = new THREE.Mesh(doeLegGeo, doeLegsMat);
  doeBackRightLeg.position.set(0.14, 0.68, -0.32);

  patronusDoeRig.add(
    doeTorso,
    doeNeck,
    doeHead,
    doeFrontLeftLeg,
    doeFrontRightLeg,
    doeBackLeftLeg,
    doeBackRightLeg,
  );

  const patronusPointLight = new THREE.PointLight('#7dd3fc', 0.0, 22.0, 1.4);
  patronusPointLight.position.set(0, 1.0, 0);
  patronusDoeRig.add(patronusPointLight);

  // 120-Particle Silver Stardust Ribbon Trail
  const patronusTrailCount = 120;
  const patronusTrailPos = new Float32Array(patronusTrailCount * 3);
  const patronusTrailGeo = tracker.trackGeo(new THREE.BufferGeometry());
  patronusTrailGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(patronusTrailPos, 3),
  );
  const patronusTrailMat = tracker.trackMat(
    new THREE.PointsMaterial({
      color: new THREE.Color('#bae6fd'),
      size: 0.095,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const patronusTrailPoints = new THREE.Points(
    patronusTrailGeo,
    patronusTrailMat,
  );
  patronusFlightGroup.add(patronusTrailPoints);

  // 3D Stardust Sky-Writing in the Great Hall during the final Patronus loop: "HARSHA ♥ YESHWANTH"
  const patronusSkyTextTex = createFloatingMagicalTextTexture(
    tracker,
    'HARSHA   ♥   YESHWANTH',
    '“Thank you for caring about me the way you do.”',
    '#e0f2fe',
    '#38bdf8',
  );
  const patronusSkyTextMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: patronusSkyTextTex ?? undefined,
      transparent: true,
      opacity: 0.0,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  const patronusSkyTextGeo = tracker.trackGeo(new THREE.PlaneGeometry(7.2, 1.8));
  const patronusSkyTextMesh = new THREE.Mesh(
    patronusSkyTextGeo,
    patronusSkyTextMat,
  );
  patronusSkyTextMesh.position.set(0, 5.2, 13.5);
  const patronusSkyTextBackMesh = new THREE.Mesh(
    patronusSkyTextGeo,
    patronusSkyTextMat,
  );
  patronusSkyTextBackMesh.position.z = -0.01;
  patronusSkyTextBackMesh.rotation.y = Math.PI;
  patronusSkyTextMesh.add(patronusSkyTextBackMesh);
  schoolRoot.add(patronusSkyTextMesh);

  const patronusFlightCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(13.4, 1.2, 16.4),
      new THREE.Vector3(6.5, 4.8, 14.5),
      new THREE.Vector3(-4.2, 6.8, 8.5),
      new THREE.Vector3(-5.5, 7.4, 16.5),
      new THREE.Vector3(0.0, 8.2, 21.0),
      new THREE.Vector3(5.8, 6.2, 12.5),
      new THREE.Vector3(12.2, 1.2, 15.8),
    ],
    false,
  );

  // ============================================================================
  // 4. REAR CONSERVATORY: GRAND STAIRCASE, BOTANICAL GREENHOUSE, ROYAL TALKING
  //    FROG & CRESCENT WIZARDING VILLAGE + SCARLET STEAM LOCOMOTIVE VISTA
  // ============================================================================
  const conservatoryGroup = new THREE.Group();
  conservatoryGroup.name = 'GrandStaircaseAndBotanicalConservatory';
  schoolRoot.add(conservatoryGroup);

  const stairStepCount = 10;
  const stairStepGeo = tracker.trackGeo(new THREE.BoxGeometry(14.5, 0.2, 0.56));
  for (let s = 0; s < stairStepCount; s++) {
    const step = new THREE.Mesh(stairStepGeo, warmAshlarStoneMat);
    step.position.set(0, (s + 0.5) * 0.18, 24.45 + s * 0.5);
    step.receiveShadow = true;
    conservatoryGroup.add(step);
  }

  const portraitFrameGeo = tracker.trackGeo(
    new THREE.BoxGeometry(0.14, 2.2, 1.65),
  );
  const portraitCanvasGeo = tracker.trackGeo(new THREE.PlaneGeometry(1.4, 1.9));
  const portraitMeshes: THREE.Mesh[] = [];

  [-7.8, 7.8].forEach((px, sideIdx) => {
    [25.6, 28.2].forEach((pz, pIdx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(px, 3.8 + pIdx * 0.6, pz);
      pGroup.rotation.y = sideIdx === 0 ? Math.PI / 2 : -Math.PI / 2;

      const frame = new THREE.Mesh(portraitFrameGeo, brushedBrassMat);
      frame.rotation.y = Math.PI / 2;
      const pMat = tracker.trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(
            (sideIdx + pIdx) % 2 === 0 ? '#3b1d5e' : '#1e3a5f',
          ),
          emissive: new THREE.Color('#d97706'),
          emissiveIntensity: 0.28,
          roughness: 0.5,
        }),
      );
      const canvasMesh = new THREE.Mesh(portraitCanvasGeo, pMat);
      canvasMesh.position.z = 0.09;
      pGroup.add(frame, canvasMesh);
      conservatoryGroup.add(pGroup);
      portraitMeshes.push(canvasMesh);
    });
  });

  const conservatoryFloorGeo = tracker.trackGeo(
    new THREE.BoxGeometry(22.5, 2.2, 12.6),
  );
  conservatoryFloorGeo.translate(0, 0.7, 35.4);
  const conservatoryFloor = new THREE.Mesh(
    conservatoryFloorGeo,
    warmAshlarStoneMat,
  );
  conservatoryFloor.receiveShadow = true;
  conservatoryGroup.add(conservatoryFloor);

  const ironArchGeo = tracker.trackGeo(
    new THREE.TorusGeometry(10.6, 0.16, 8, 28, Math.PI),
  );
  // First conservatory bay (z = 29.5 .. 36.1): full 180-degree arched glass vault
  const glassVaultFrontGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(
      10.5,
      10.5,
      6.6,
      20,
      1,
      true,
      -Math.PI / 2,
      Math.PI,
    ),
  );
  glassVaultFrontGeo.rotateX(-Math.PI / 2);

  // Rear conservatory bay over the NE Greenhouse Exit doorway (z = 36.1 .. 41.3):
  // Arches from the NW wall (-localX = -10.5) over the roof apex to y = 5.95m above the NE exit portal so the doorway is completely open!
  const glassVaultDoorBayGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(
      10.5,
      10.5,
      5.2,
      20,
      1,
      true,
      -Math.PI / 2,
      Math.PI * 0.86,
    ),
  );
  glassVaultDoorBayGeo.rotateX(-Math.PI / 2);

  [29.8, 33.6, 37.4, 41.0].forEach((az) => {
    const arch = new THREE.Mesh(ironArchGeo, wroughtIronMat);
    arch.position.set(0, 1.8, az);
    conservatoryGroup.add(arch);
  });

  const glassVaultFront = new THREE.Mesh(
    glassVaultFrontGeo,
    conservatoryGlassMat,
  );
  glassVaultFront.position.set(0, 1.8, 32.8);
  const glassVaultDoorBay = new THREE.Mesh(
    glassVaultDoorBayGeo,
    conservatoryGlassMat,
  );
  glassVaultDoorBay.position.set(0, 1.8, 38.7);
  conservatoryGroup.add(glassVaultFront, glassVaultDoorBay);

  // Warm Overhead Conservatory Chandelier PointLights illuminating the indoor plants, Royal Frog Pond & exit trail
  const conservatoryLightCenter = new THREE.PointLight(
    '#ffe4b5',
    7.5,
    25.0,
    1.05,
  );
  conservatoryLightCenter.position.set(0, 6.4, 34.5);
  const conservatoryLightExit = new THREE.PointLight(
    '#ffe4b5',
    7.2,
    22.0,
    1.05,
  );
  conservatoryLightExit.position.set(5.8, 5.4, 37.8);
  conservatoryGroup.add(conservatoryLightCenter, conservatoryLightExit);

  const balustradeWallGeo = tracker.trackGeo(
    new THREE.BoxGeometry(21.6, 1.05, 0.45),
  );
  balustradeWallGeo.translate(0, 2.32, 41.2);
  const balustradeWall = new THREE.Mesh(balustradeWallGeo, warmAshlarStoneMat);
  conservatoryGroup.add(balustradeWall);

  for (let x = -10.0; x <= 10.0; x += 2.5) {
    addLocalCollider(x, 41.2, 0.75);
  }
  for (let z = 25.0; z <= 40.5; z += 2.5) {
    addLocalCollider(-11.0, z, 0.75);
    // Leave an open 3.5m Greenhouse Exit doorway gap on the NE side (z = 36.2 .. 40.4)
    if (z < 36.2 || z > 40.4) {
      addLocalCollider(11.0, z, 0.75);
    }
  }

  // Indoor Conservatory Reactive Magical Plants (with warm bioluminescent rims, halo rings & vibrant foliage)
  const terracottaMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c25e2e'),
      emissive: new THREE.Color('#7c2d12'),
      emissiveIntensity: 0.22,
      roughness: 0.68,
    }),
  );
  const indoorPotRimMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.68,
      roughness: 0.28,
    }),
  );
  const mandrakeLeafMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4ade80'),
      emissive: new THREE.Color('#22c55e'),
      emissiveIntensity: 0.48,
      roughness: 0.42,
    }),
  );
  const mandrakeRootMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ca8a04'),
      emissive: new THREE.Color('#854d0e'),
      emissiveIntensity: 0.28,
      roughness: 0.62,
    }),
  );
  const potGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.28, 0.2, 0.36, 10),
  );
  potGeo.translate(0, 0.18, 0);
  const indoorPotRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(0.28, 0.035, 7, 16),
  );
  indoorPotRimGeo.rotateX(Math.PI / 2);
  indoorPotRimGeo.translate(0, 0.36, 0);
  const indoorHaloRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.28, 0.42, 20),
  );
  indoorHaloRingGeo.rotateX(-Math.PI / 2);
  indoorHaloRingGeo.translate(0, 0.02, 0);
  const mandrakeHeadGeo = tracker.trackGeo(
    new THREE.SphereGeometry(0.16, 10, 10),
  );
  const mandrakeTuftGeo = tracker.trackGeo(
    new THREE.ConeGeometry(0.26, 0.48, 7),
  );
  mandrakeTuftGeo.translate(0, 0.24, 0);

  interface MandrakeRig {
    worldPos: THREE.Vector3;
    tuftPivot: THREE.Group;
    phase: number;
  }
  const mandrakes: MandrakeRig[] = [];

  const mandrakeCoords = [
    [-6.2, 31.8],
    [-6.2, 34.8],
    [-6.2, 37.8],
    [6.2, 31.8],
    [6.2, 34.8],
    [6.2, 37.8],
  ];
  mandrakeCoords.forEach(([mx, mz], idx) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(mx, 1.8, mz);

    const pot = new THREE.Mesh(potGeo, terracottaMat);
    const potRim = new THREE.Mesh(indoorPotRimGeo, indoorPotRimMat);
    const halo = new THREE.Mesh(indoorHaloRingGeo, mandrakeLeafMat);
    const tuftPivot = new THREE.Group();
    tuftPivot.position.y = 0.32;

    const rootHead = new THREE.Mesh(mandrakeHeadGeo, mandrakeRootMat);
    const leaves = new THREE.Mesh(mandrakeTuftGeo, mandrakeLeafMat);
    leaves.position.y = 0.08;
    tuftPivot.add(rootHead, leaves);
    mGroup.add(pot, potRim, halo, tuftPivot);
    conservatoryGroup.add(mGroup);

    const w = castleLocalToWorld(mx, mz);
    mandrakes.push({
      worldPos: new THREE.Vector3(w.x, CASTLE_GATE_POS.y + 1.8, w.z),
      tuftPivot,
      phase: idx * 1.3,
    });
  });

  const petalGeo = tracker.trackGeo(new THREE.ConeGeometry(0.12, 0.34, 5));
  petalGeo.translate(0, 0.17, 0);
  const flowerPetalMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbcfe8'),
      emissive: new THREE.Color('#ec4899'),
      emissiveIntensity: 0.68,
      roughness: 0.28,
    }),
  );
  const flowerStemGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.025, 0.035, 0.55, 6),
  );
  flowerStemGeo.translate(0, 0.275, 0);

  interface BellFlowerRig {
    worldPos: THREE.Vector3;
    petals: THREE.Mesh[];
  }
  const bellFlowers: BellFlowerRig[] = [];

  for (let i = 0; i < 12; i++) {
    const side = i < 6 ? -1 : 1;
    const fx = side * (3.6 + (i % 2) * 1.2);
    const fz = 30.8 + (i % 6) * 1.65;
    const fGroup = new THREE.Group();
    fGroup.position.set(fx, 1.8, fz);

    const stem = new THREE.Mesh(flowerStemGeo, mandrakeLeafMat);
    const halo = new THREE.Mesh(indoorHaloRingGeo, flowerPetalMat);
    fGroup.add(stem, halo);

    const petals: THREE.Mesh[] = [];
    for (let p = 0; p < 4; p++) {
      const pMesh = new THREE.Mesh(petalGeo, flowerPetalMat);
      pMesh.position.y = 0.55;
      pMesh.rotation.y = (p * Math.PI) / 2;
      fGroup.add(pMesh);
      petals.push(pMesh);
    }
    conservatoryGroup.add(fGroup);
    const w = castleLocalToWorld(fx, fz);
    bellFlowers.push({
      worldPos: new THREE.Vector3(w.x, CASTLE_GATE_POS.y + 1.8, w.z),
      petals,
    });
  }

  // ============================================================================
  // 🐸 INTERACTABLE #7: THE ROYAL FROG ("You even scold me because you care.")
  // ============================================================================
  const royalFrogPos = new THREE.Vector3(0, 1.8, 35.8);
  const frogPondGroup = new THREE.Group();
  frogPondGroup.position.copy(royalFrogPos);
  conservatoryGroup.add(frogPondGroup);
  addLocalCollider(0, 35.8, 1.55);

  const pondRimGeo = tracker.trackGeo(
    new THREE.TorusGeometry(1.45, 0.18, 10, 28),
  );
  pondRimGeo.rotateX(Math.PI / 2);
  pondRimGeo.translate(0, 0.18, 0);
  const pondWaterGeo = tracker.trackGeo(new THREE.CircleGeometry(1.42, 28));
  pondWaterGeo.rotateX(-Math.PI / 2);
  pondWaterGeo.translate(0, 0.22, 0);
  const pondWaterMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0ea5e9'),
      emissive: new THREE.Color('#0284c7'),
      emissiveIntensity: 0.32,
      roughness: 0.12,
      clearcoat: 0.9,
    }),
  );
  const mossyRockGeo = tracker.trackGeo(
    new THREE.DodecahedronGeometry(0.46, 1),
  );
  mossyRockGeo.scale(1.1, 0.72, 1.1);
  mossyRockGeo.translate(0, 0.34, 0);

  // Lily pad + splash ripple ring on the pond water
  const lilyPadGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16),
  );
  const lilyPadMesh = new THREE.Mesh(lilyPadGeo, mandrakeLeafMat);
  lilyPadMesh.position.set(0.58, 0.23, -0.35);

  const splashRingGeo = tracker.trackGeo(
    new THREE.RingGeometry(0.32, 0.38, 24),
  );
  splashRingGeo.rotateX(-Math.PI / 2);
  const splashRingMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#e0f2fe'),
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  const splashRingMesh = new THREE.Mesh(splashRingGeo, splashRingMat);
  splashRingMesh.position.set(0.58, 0.235, -0.35);

  const pondRim = new THREE.Mesh(pondRimGeo, warmAshlarStoneMat);
  const pondWater = new THREE.Mesh(pondWaterGeo, pondWaterMat);
  const mossyRock = new THREE.Mesh(mossyRockGeo, basaltStoneMat);
  frogPondGroup.add(
    pondRim,
    pondWater,
    mossyRock,
    lilyPadMesh,
    splashRingMesh,
  );

  const royalFrogRig = new THREE.Group();
  royalFrogRig.position.set(0, 0.66, 0);
  frogPondGroup.add(royalFrogRig);

  const frogEmeraldMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#22c55e'),
      roughness: 0.32,
      clearcoat: 0.65,
    }),
  );
  const frogThroatMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      roughness: 0.45,
    }),
  );
  const frogBodyGeo = tracker.trackGeo(new THREE.SphereGeometry(0.18, 12, 12));
  frogBodyGeo.scale(1.0, 0.82, 1.25);
  const frogThroatGeo = tracker.trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
  const frogEyeGeo = tracker.trackGeo(new THREE.SphereGeometry(0.042, 8, 8));
  const frogCrownGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.075, 0.055, 0.07, 6),
  );

  const frogBody = new THREE.Mesh(frogBodyGeo, frogEmeraldMat);
  const frogThroat = new THREE.Mesh(frogThroatGeo, frogThroatMat);
  frogThroat.position.set(0, -0.02, 0.16);
  const frogEyeL = new THREE.Mesh(frogEyeGeo, brushedBrassMat);
  frogEyeL.position.set(-0.08, 0.13, 0.14);
  const frogEyeR = new THREE.Mesh(frogEyeGeo, brushedBrassMat);
  frogEyeR.position.set(0.08, 0.13, 0.14);
  const frogCrown = new THREE.Mesh(frogCrownGeo, brushedBrassMat);
  frogCrown.position.set(0, 0.19, 0.05);
  frogCrown.rotation.z = -0.12;

  royalFrogRig.add(frogBody, frogThroat, frogEyeL, frogEyeR, frogCrown);

  // ============================================================================
  // 5. CRESCENT WIZARDING VILLAGE & SCARLET STEAM LOCOMOTIVE VIADUCT VISTA
  // ============================================================================
  const vistaVillageGroup = new THREE.Group();
  vistaVillageGroup.name = 'CrescentWizardingVillageAndLocomotiveVista';
  schoolRoot.add(vistaVillageGroup);

  const cottageWallMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e7decd'),
      roughness: 0.78,
    }),
  );
  const warmShopWinMat = tracker.trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef08a'),
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.72,
      roughness: 0.25,
    }),
  );

  const villageShops = [
    { x: -14.5, y: -3.2, z: 48.0, rotY: 0.35, roofCol: '#312e81' },
    { x: -5.2, y: -3.5, z: 51.5, rotY: 0.12, roofCol: '#7f1d1d' },
    { x: 5.2, y: -3.5, z: 51.5, rotY: -0.12, roofCol: '#1e3a8a' },
    { x: 14.5, y: -3.2, z: 48.0, rotY: -0.35, roofCol: '#065f46' },
  ];

  const shopBaseGeo = tracker.trackGeo(new THREE.BoxGeometry(5.2, 6.8, 4.6));
  shopBaseGeo.translate(0, 3.4, 0);
  const shopRoofGeo = tracker.trackGeo(new THREE.ConeGeometry(4.2, 4.4, 4));
  shopRoofGeo.rotateY(Math.PI / 4);
  shopRoofGeo.translate(0, 9.0, 0);
  const shopBayWinGeo = tracker.trackGeo(new THREE.BoxGeometry(1.8, 1.6, 0.3));

  villageShops.forEach((s) => {
    const sGroup = new THREE.Group();
    sGroup.position.set(s.x, s.y, s.z);
    sGroup.rotation.y = s.rotY + Math.PI;

    const body = new THREE.Mesh(shopBaseGeo, cottageWallMat);
    const rMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(s.roofCol),
        roughness: 0.55,
      }),
    );
    const roof = new THREE.Mesh(shopRoofGeo, rMat);
    const bayWin = new THREE.Mesh(shopBayWinGeo, warmShopWinMat);
    bayWin.position.set(0, 2.4, 2.35);

    sGroup.add(body, roof, bayWin);
    vistaVillageGroup.add(sGroup);
  });

  const viaductCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-28.0, -2.2, 52.0),
      new THREE.Vector3(-10.0, -1.8, 59.5),
      new THREE.Vector3(10.0, -1.8, 59.5),
      new THREE.Vector3(28.0, -2.2, 52.0),
      new THREE.Vector3(12.0, -2.2, 44.5),
      new THREE.Vector3(-12.0, -2.2, 44.5),
    ],
    true,
  );
  const viaductDeckGeo = tracker.trackGeo(
    new THREE.TubeGeometry(viaductCurve, 72, 1.15, 6, true),
  );
  const viaductDeckMesh = new THREE.Mesh(viaductDeckGeo, basaltStoneMat);
  vistaVillageGroup.add(viaductDeckMesh);

  const scarletEngineMat = tracker.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#b91c1c'),
      roughness: 0.28,
      metalness: 0.25,
      clearcoat: 0.75,
    }),
  );
  const steamPuffMat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#f8fafc'),
      transparent: true,
      opacity: 0.75,
    }),
  );

  const scarletTrainGroup = new THREE.Group();
  vistaVillageGroup.add(scarletTrainGroup);

  const locoBoilerGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.78, 0.78, 3.6, 12),
  );
  locoBoilerGeo.rotateX(Math.PI / 2);
  locoBoilerGeo.translate(0, 1.25, 0.6);
  const locoCabGeo = tracker.trackGeo(new THREE.BoxGeometry(1.75, 2.2, 1.8));
  locoCabGeo.translate(0, 1.5, -1.6);
  const locoStackGeo = tracker.trackGeo(
    new THREE.CylinderGeometry(0.28, 0.2, 0.95, 8),
  );
  locoStackGeo.translate(0, 2.1, 1.8);
  const coachBodyGeo = tracker.trackGeo(new THREE.BoxGeometry(1.7, 2.0, 4.2));
  coachBodyGeo.translate(0, 1.4, -5.2);

  const locoBoiler = new THREE.Mesh(locoBoilerGeo, scarletEngineMat);
  const locoCab = new THREE.Mesh(locoCabGeo, scarletEngineMat);
  const locoStack = new THREE.Mesh(locoStackGeo, brushedBrassMat);
  const coachBody = new THREE.Mesh(coachBodyGeo, scarletEngineMat);
  scarletTrainGroup.add(locoBoiler, locoCab, locoStack, coachBody);

  const trainSteamPuffs: THREE.Mesh[] = [];
  const puffSphereGeo = tracker.trackGeo(new THREE.SphereGeometry(0.45, 8, 8));
  for (let p = 0; p < 5; p++) {
    const puff = new THREE.Mesh(puffSphereGeo, steamPuffMat);
    scarletTrainGroup.add(puff);
    trainSteamPuffs.push(puff);
  }

  // ============================================================================
  // 6. MASTER FLOW TIMELINES & CHOREOGRAPHY STATE MACHINE
  // ============================================================================
  interface InteractableSpec {
    id: IndoorStationId;
    localX: number;
    localZ: number;
    radius: number;
    title: string;
    actionLabel: string;
  }

  const interactables: InteractableSpec[] = [
    {
      id: 'sorting_hat',
      localX: sortingHatPos.x,
      localZ: sortingHatPos.z,
      radius: 3.5,
      title: 'The Sorting Hat • Great Hall Entrance',
      actionLabel: 'Consult the Sorting Hat',
    },
    {
      id: 'compendium_book',
      localX: compendiumPos.x,
      localZ: compendiumPos.z,
      radius: 3.3,
      title: 'Library Lectern • Handwritten Tome',
      actionLabel: 'Read "The Compendium of Harsha"',
    },
    {
      id: 'mirror_of_desire',
      localX: mirrorPos.x,
      localZ: mirrorPos.z,
      radius: 3.6,
      title: 'The Mirror of Desire • Romantic Centerpiece',
      actionLabel: 'Gaze into the Mirror of Desire',
    },
    {
      id: 'pensieve',
      localX: pensievePos.x,
      localZ: pensievePos.z,
      radius: 3.3,
      title: 'Rune-Carved Stone Pensieve',
      actionLabel: 'Peer into the Pensieve',
    },
    {
      id: 'amortentia',
      localX: amortentiaPos.x,
      localZ: amortentiaPos.z,
      radius: 3.3,
      title: 'Simmering Pewter Cauldron • Amortentia',
      actionLabel: 'Inhale the Amortentia Potion',
    },
    {
      id: 'patronus_circle',
      localX: patronusCirclePos.x,
      localZ: patronusCirclePos.z,
      radius: 3.6,
      title: 'Silver-Cyan Runic Spell Circle',
      actionLabel: "Cast 'Expecto Patronum'",
    },
    {
      id: 'royal_frog',
      localX: royalFrogPos.x,
      localZ: royalFrogPos.z,
      radius: 3.6,
      title: 'The Royal Frog • Conservatory Lily Pond',
      actionLabel: 'Talk to the Royal Frog',
    },
  ];

  // ============================================================================
  // PLAYER-CONTROLLED DIALOGUE TABLES & INDEPENDENT ANIMATION STATE
  // - Never automatically advances dialogue lines!
  // - Enter advances 1 step; Esc skips cleanly and restores gameplay.
  // ============================================================================
  interface DialogueStepSpec {
    message: string;
    headline?: string;
  }

  const STATION_DIALOGUES: Record<
    IndoorStationId,
    {
      title: string;
      subtitle: string;
      accent: 'gold' | 'violet' | 'cyan' | 'rose' | 'emerald';
      steps: DialogueStepSpec[];
    }
  > = {
    sorting_hat: {
      title: 'The Sorting Hat',
      subtitle: 'Great Hall Entrance • Goblet of Blue Flame',
      accent: 'gold',
      steps: [
        { message: '“Hmm...”' },
        { message: '“Harsha.”' },
        { message: '“You understand him.”' },
        { message: '“Even when Yeshwanth doesn’t explain himself properly.”' },
        {
          message:
            '“You know when he’s serious. You know when he’s overthinking.”',
        },
        { message: '“And you definitely know when he’s being stupid.”' },
        { message: '“Yes... I know exactly where you belong.”' },
        {
          headline: 'THE REALM OF HARSHA',
          message:
            '“Because every good wizard needs someone who understands him.”',
        },
      ],
    },
    compendium_book: {
      title: 'The Compendium of Harsha',
      subtitle: 'Handwritten Pages on the Library Lectern',
      accent: 'gold',
      steps: [
        {
          message:
            'The ancient tome closes itself with a soft THUMP, then opens as golden ink begins to write...',
        },
        {
          message:
            '“Harsha... I don’t think I tell you this enough. I’ve noticed the little things you’ve changed for me.”',
        },
        {
          message:
            'understood  ·  adjusted  ·  tried  ·  grown — “I know you didn’t have to. But you did.”',
        },
        {
          message:
            '“And I want you to know that I notice. I appreciate it.”',
        },
        {
          message: '“Thank you for growing with me. I love you for it.” ♥',
        },
      ],
    },
    mirror_of_desire: {
      title: 'The Mirror of Desire',
      subtitle: "I Show Not Your Face But Your Heart's Desire",
      accent: 'gold',
      steps: [
        { message: '“If you asked me what I want...”' },
        {
          message:
            '“I don’t think I’d ask for some perfect life. I just want you in mine.”',
        },
        { message: '“Someone I can laugh with.”' },
        { message: '“Someone I can annoy.”' },
        { message: '“Someone who annoys me right back.”' },
        { message: '“Someone who stays.”' },
        {
          headline: 'HARSHA ♥ YESHWANTH',
          message: '“And somehow... I got you.”',
        },
      ],
    },
    pensieve: {
      title: 'The Pensieve',
      subtitle: 'Silvery Memory Wisps • Cathedral Library',
      accent: 'cyan',
      steps: [
        {
          message:
            '“I’ve been thinking about all the things we’ve done together.” — laughing · talking · together',
        },
        { message: '“The big things...”' },
        { message: '“And the completely stupid little things.”' },
        {
          message:
            '“The times I needed someone. And you were there. I don’t think I say thank you enough for that.”',
        },
        {
          message:
            '“Thank you for being there, Harsha. I’m really glad I get to have all these memories with you.”',
        },
      ],
    },
    amortentia: {
      title: 'Amortentia',
      subtitle: 'Mother-of-Pearl Steam • Potions Apothecary',
      accent: 'rose',
      steps: [
        {
          message:
            '“Apparently this potion is supposed to reveal what you love most.”',
        },
        { message: '“Something familiar...”' },
        { message: '“Something that makes me smile...”' },
        { message: '“Okay. ... It’s you. I should’ve known.”' },
        {
          message:
            '“Although I’m slightly offended that a potion figured that out before I did.”',
        },
        { message: '“I love how easy it is to have fun with you.”' },
      ],
    },
    patronus_circle: {
      title: 'Expecto Patronum',
      subtitle: 'Silver Guardian • Great Hall Spectacle',
      accent: 'cyan',
      steps: [
        { message: '“You know something, Harsha?”' },
        { message: '“You take care of me more than you probably realize.”' },
        { message: '“You ask if I’ve eaten.”' },
        { message: '“You remind me to take care of myself.”' },
        { message: '“You worry about me.”' },
        {
          message:
            '“And yes... Sometimes you scold me. But I know why. Because you care.”',
        },
        {
          message:
            'The silver-blue Patronus Doe bounds across the Great Hall beneath the floating candles...',
        },
        {
          headline: 'HARSHA   ♥   YESHWANTH',
          message: '“Thank you for caring about me the way you do.”',
        },
      ],
    },
    royal_frog: {
      title: 'The Royal Frog',
      subtitle: 'Enchanted Conservatory Lily Pond',
      accent: 'emerald',
      steps: [
        { message: '“So you’re Harsha.”' },
        {
          message:
            '“I’ve heard quite a lot about you. Mostly about how you keep telling him what to do.”',
        },
        { message: '“Eat properly.”' },
        { message: '“Sleep properly.”' },
        { message: '“Don’t do that.”' },
        { message: '“Why did you do that? ... Am I close?”' },
        {
          message:
            '“Honestly... You sound more like his mother than his girlfriend sometimes.”',
        },
        { message: '“Don’t tell him I said that.”' },
        {
          message:
            '“But I suppose that’s what happens when you care about someone this much. ... Don’t stop looking after him.”',
        },
      ],
    },
  };

  let activeStation: 'none' | IndoorStationId = 'none';
  let linkedMagicalPlantSystem: MagicalPlantSystemBundle | null = null;
  let linkedAncientForestSystem: AncientForestBundle | null = null;
  let currentElapsedTime = 0;
  let dialogueStep = 0;
  let stepTimer = 0; // Elapsed seconds within the current dialogueStep
  let seqTimer = 0; // Total elapsed seconds since station interaction started

  // Virtual animation times driven by (activeStation, dialogueStep, stepTimer)
  let sortingSeqTime = -1;
  const SORTING_DURATION = 12.2;
  let candleFreezeTimer = 0;
  let frozenCandleTime = 0;

  let compendiumSeqTime = -1;
  const COMPENDIUM_DURATION = 13.2;

  let mirrorSeqTime = -1;
  const MIRROR_DURATION = 15.2;

  let pensieveSeqTime = -1;
  const PENSIEVE_DURATION = 11.2;

  let amortentiaSeqTime = -1;
  const AMORTENTIA_DURATION = 11.0;

  let patronusSeqTime = -1;
  const PATRONUS_DURATION = 14.5;

  let frogSeqTime = -1;
  const FROG_DURATION = 13.2;
  let frogFacingYaw = 0;
  let hatFacingYaw = Math.PI;

  const camFocusResult: SchoolCameraFocus = {
    active: false,
    camWorldPos: new THREE.Vector3(),
    lookWorldPos: new THREE.Vector3(),
    blendAlpha: 0,
  };

  function resetAllStationVisuals() {
    activeStation = 'none';
    dialogueStep = 0;
    stepTimer = 0;
    seqTimer = 0;

    sortingSeqTime = -1;
    compendiumSeqTime = -1;
    mirrorSeqTime = -1;
    pensieveSeqTime = -1;
    amortentiaSeqTime = -1;
    patronusSeqTime = -1;
    frogSeqTime = -1;

    // Sorting Hat reset
    hatPivot.position.set(0, 0.96, 0);
    realmRevealMat.opacity = 0;
    hatPulseRingMat.opacity = 0;
    hallLight1.intensity = 2.8;
    sortingHatSpot.intensity = 2.2;

    // Compendium reset
    compendiumBookRig.position.set(0, 1.2, 0.02);
    compendiumBookRig.scale.set(1, 1, 1);
    turningLeafPivot.rotation.z = 0;
    compendiumDustMat.opacity = 0;
    bookmarkMat.emissiveIntensity = 0.35;

    // Pensieve reset
    pensieveUniforms.uActiveBoost.value = 0;
    pensieveLiquidMesh.position.y = 0.97;
    pensieveWordsMat.opacity = 0;
    playfulOrbMat.opacity = 0;

    // Amortentia reset
    steamLaughingFiguresGroup.visible = false;

    // Patronus reset
    patronusFlightGroup.visible = false;
    patronusPointLight.intensity = 0;
    patronusSkyTextMat.opacity = 0;

    // Frog reset
    royalFrogRig.position.set(0, 0.66, 0);
    royalFrogRig.rotation.x = 0;
  }

  function updateStationVirtualAnimationTimes() {
    sortingSeqTime = -1;
    compendiumSeqTime = -1;
    mirrorSeqTime = -1;
    pensieveSeqTime = -1;
    amortentiaSeqTime = -1;
    patronusSeqTime = -1;
    frogSeqTime = -1;

    if (activeStation === 'sorting_hat') {
      const starts = [0.1, 1.1, 2.2, 3.5, 5.1, 6.6, 8.2, 9.6];
      const maxSpan = [0.9, 1.0, 1.2, 1.3, 1.3, 1.2, 1.2, 1.6];
      const s = Math.min(7, dialogueStep);
      sortingSeqTime = starts[s] + Math.min(maxSpan[s], stepTimer);
    } else if (activeStation === 'compendium_book') {
      const starts = [0.05, 1.4, 4.1, 8.1, 9.6];
      const maxSpan = [1.25, 2.5, 3.9, 1.4, 2.2];
      const s = Math.min(4, dialogueStep);
      compendiumSeqTime = starts[s] + Math.min(maxSpan[s], stepTimer);
    } else if (activeStation === 'mirror_of_desire') {
      const starts = [0.1, 2.2, 4.0, 5.4, 6.8, 8.1, 9.5];
      const maxSpan = [2.0, 1.7, 1.3, 1.2, 1.2, 1.3, 2.2];
      const s = Math.min(6, dialogueStep);
      mirrorSeqTime = starts[s] + Math.min(maxSpan[s], stepTimer);
    } else if (activeStation === 'pensieve') {
      if (dialogueStep === 0) pensieveSeqTime = 0.2 + Math.min(2.3, stepTimer);
      else if (dialogueStep === 1)
        pensieveSeqTime = 2.8 + Math.min(1.5, stepTimer);
      else if (dialogueStep === 2)
        pensieveSeqTime = 4.5 + (stepTimer % 2.4); // Playful orb bounces continuously while reading!
      else if (dialogueStep === 3)
        pensieveSeqTime = 6.5 + Math.min(2.0, stepTimer);
      else pensieveSeqTime = 8.8 + Math.min(1.0, stepTimer);
    } else if (activeStation === 'amortentia') {
      const starts = [0.2, 2.0, 3.8, 5.8, 7.5, 9.2];
      const maxSpan = [1.6, 1.5, 1.5, 1.5, 1.5, 0.5];
      const s = Math.min(5, dialogueStep);
      amortentiaSeqTime = starts[s] + Math.min(maxSpan[s], stepTimer);
    } else if (activeStation === 'patronus_circle') {
      if (dialogueStep === 0) patronusSeqTime = 0.2 + Math.min(0.8, stepTimer);
      else if (dialogueStep === 1)
        patronusSeqTime = 1.1 + Math.min(0.9, stepTimer);
      else if (dialogueStep === 2)
        patronusSeqTime = 2.0 + Math.min(1.0, stepTimer);
      else if (dialogueStep === 3)
        patronusSeqTime = 3.1 + Math.min(1.0, stepTimer);
      else if (dialogueStep === 4)
        patronusSeqTime = 4.2 + Math.min(1.0, stepTimer);
      else if (dialogueStep === 5)
        patronusSeqTime = 5.3 + Math.min(1.0, stepTimer);
      else if (dialogueStep === 6)
        patronusSeqTime = 6.5 + (stepTimer % 7.5); // Continuous Great Hall Patronus flight loop!
      else patronusSeqTime = 11.2 + (stepTimer % 2.2); // Stardust "HARSHA ♥ YESHWANTH" sky-writing + Doe flight!
    } else if (activeStation === 'royal_frog') {
      if (dialogueStep === 0) frogSeqTime = 0.2 + Math.min(1.1, stepTimer);
      else if (dialogueStep === 1)
        frogSeqTime = 1.5 + Math.min(1.4, stepTimer);
      else if (dialogueStep === 2)
        frogSeqTime = 3.3 + Math.min(0.88, stepTimer);
      else if (dialogueStep === 3)
        frogSeqTime = 4.18 + Math.min(0.88, stepTimer);
      else if (dialogueStep === 4)
        frogSeqTime = 5.06 + Math.min(0.88, stepTimer);
      else if (dialogueStep === 5)
        frogSeqTime = 5.94 + Math.min(0.88, stepTimer);
      else if (dialogueStep === 6)
        frogSeqTime = 7.4 + Math.min(1.5, stepTimer);
      else if (dialogueStep === 7)
        frogSeqTime = 9.4 + (stepTimer % 1.2); // Nervous glances
      else frogSeqTime = 10.8 + Math.min(1.8, stepTimer); // Lily pad splash
    }
  }

  function findClosestInteractable(
    playerWorldPos: THREE.Vector3,
    isWalking: boolean,
    isGateOpenOrUnlocking: boolean,
  ): InteractableSpec | null {
    if (!isWalking || !isGateOpenOrUnlocking || activeStation !== 'none') {
      return null;
    }

    let best: InteractableSpec | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < interactables.length; i++) {
      const item = interactables[i];
      const w = castleLocalToWorld(item.localX, item.localZ);
      const d = Math.hypot(playerWorldPos.x - w.x, playerWorldPos.z - w.z);
      if (d <= item.radius && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Computes the current player-controlled dialogue beat across the 7 Castle stations.
   */
  function getActiveBanner(): SchoolBannerNotification | null {
    if (linkedAncientForestSystem && linkedAncientForestSystem.isDialogueActive()) {
      const banner = linkedAncientForestSystem.getActiveBanner();
      if (banner) {
        return {
          title: banner.title,
          subtitle: banner.subtitle,
          message: banner.message,
          headline: banner.speaker,
          photoUrl: banner.photoUrl,
          accent: 'cyan',
          stepIndex: banner.stepIndex,
          totalSteps: banner.totalSteps,
        };
      }
    }
    if (activeStation === 'none') return null;
    const spec = STATION_DIALOGUES[activeStation];
    const idx = Math.max(0, Math.min(spec.steps.length - 1, dialogueStep));
    const step = spec.steps[idx];
    return {
      title: spec.title,
      subtitle: spec.subtitle,
      message: step.message,
      headline: step.headline,
      accent: spec.accent,
      stepIndex: idx + 1,
      totalSteps: spec.steps.length,
    };
  }

  /**
   * Gentle, non-locking camera focus for the Sorting Hat, Compendium Lectern, and Mirror of Desire.
   */
  function getCameraFocus(): SchoolCameraFocus | null {
    if (activeStation === 'sorting_hat') {
      const env = smoothstep01(seqTimer / 0.8);
      const camLocal = new THREE.Vector3(0.0, 1.95, 2.55);
      const lookLocal = new THREE.Vector3(0.0, 1.45, 5.6);
      schoolRoot.localToWorld(camLocal);
      schoolRoot.localToWorld(lookLocal);
      camFocusResult.active = env > 0.01;
      camFocusResult.camWorldPos.copy(camLocal);
      camFocusResult.lookWorldPos.copy(lookLocal);
      camFocusResult.blendAlpha = env * 0.85;
      return camFocusResult;
    }

    if (activeStation === 'compendium_book') {
      const env = smoothstep01(seqTimer / 0.7);
      const camLocal = new THREE.Vector3(-11.25, 1.92, 12.8);
      const lookLocal = new THREE.Vector3(-12.22, 1.22, 12.8);
      schoolRoot.localToWorld(camLocal);
      schoolRoot.localToWorld(lookLocal);
      camFocusResult.active = env > 0.01;
      camFocusResult.camWorldPos.copy(camLocal);
      camFocusResult.lookWorldPos.copy(lookLocal);
      camFocusResult.blendAlpha = env * 0.92;
      return camFocusResult;
    }

    if (activeStation === 'mirror_of_desire') {
      const env = smoothstep01(seqTimer / 0.8);
      const camLocal = new THREE.Vector3(-13.5, 2.15, 10.5);
      const lookLocal = new THREE.Vector3(-15.8, 2.25, 8.2);
      schoolRoot.localToWorld(camLocal);
      schoolRoot.localToWorld(lookLocal);
      camFocusResult.active = env > 0.01;
      camFocusResult.camWorldPos.copy(camLocal);
      camFocusResult.lookWorldPos.copy(lookLocal);
      camFocusResult.blendAlpha = env * 0.82;
      return camFocusResult;
    }

    if (linkedAncientForestSystem) {
      const forestFocus = linkedAncientForestSystem.getCameraFocus();
      if (forestFocus && forestFocus.active) {
        camFocusResult.active = true;
        camFocusResult.camWorldPos.copy(forestFocus.camWorldPos);
        camFocusResult.lookWorldPos.copy(forestFocus.lookWorldPos);
        camFocusResult.blendAlpha = forestFocus.blendAlpha;
        camFocusResult.playerTurnAlpha = forestFocus.playerTurnAlpha ?? 0;
        camFocusResult.embraceAlpha = forestFocus.embraceAlpha ?? 0;
        camFocusResult.kissAlpha = forestFocus.kissAlpha ?? 0;
        camFocusResult.targetPlayerYaw = forestFocus.targetPlayerYaw;
        return camFocusResult;
      }
    }

    return null;
  }

  return {
    group,
    colliders,

    setMagicalPlantSystem(plantSystem: MagicalPlantSystemBundle) {
      linkedMagicalPlantSystem = plantSystem;
    },

    setAncientForestSystem(forestSystem: AncientForestBundle) {
      linkedAncientForestSystem = forestSystem;
    },

    getPromptInfo(
      playerWorldPos: THREE.Vector3,
      isWalking: boolean,
      isGateOpenOrUnlocking: boolean,
    ): SchoolPromptInfo {
      const found = findClosestInteractable(
        playerWorldPos,
        isWalking,
        isGateOpenOrUnlocking,
      );
      if (found) {
        return {
          id: found.id,
          title: found.title,
          actionLabel: found.actionLabel,
        };
      }

      if (isWalking && activeStation === 'none' && linkedMagicalPlantSystem) {
        const plantPrompt =
          linkedMagicalPlantSystem.getInteractivePlantPrompt(playerWorldPos);
        if (plantPrompt) {
          return {
            id: plantPrompt.id,
            title: plantPrompt.title,
            actionLabel: plantPrompt.actionLabel,
          };
        }
      }

      if (isWalking && activeStation === 'none' && linkedAncientForestSystem) {
        const runePrompt =
          linkedAncientForestSystem.getRunePrompt(playerWorldPos);
        if (runePrompt) {
          return {
            id: runePrompt.id ?? 'f3_rune_stone',
            title: runePrompt.title,
            actionLabel: runePrompt.actionLabel,
          };
        }
      }

      return { id: 'none', title: '', actionLabel: '' };
    },

    triggerInteractable(
      playerWorldPos: THREE.Vector3,
      isWalking: boolean,
      isGateOpenOrUnlocking: boolean,
    ) {
      const found = findClosestInteractable(
        playerWorldPos,
        isWalking,
        isGateOpenOrUnlocking,
      );
      if (!found) {
        if (isWalking && activeStation === 'none' && linkedMagicalPlantSystem) {
          const triggeredPlant =
            linkedMagicalPlantSystem.triggerInteractivePlant(playerWorldPos);
          if (triggeredPlant !== 'none') {
            return {
              triggeredId: triggeredPlant as SchoolInteractableId,
              openCompendiumModal: false,
            };
          }
        }
        if (isWalking && activeStation === 'none' && linkedAncientForestSystem) {
          if (
            linkedAncientForestSystem.triggerRuneStone(
              playerWorldPos,
              currentElapsedTime,
            )
          ) {
            return {
              triggeredId: 'f3_rune_stone' as SchoolInteractableId,
              openCompendiumModal: false,
            };
          }
        }
        return {
          triggeredId: 'none' as SchoolInteractableId,
          openCompendiumModal: false,
        };
      }

      resetAllStationVisuals();
      activeStation = found.id;
      dialogueStep = 0;
      stepTimer = 0;
      seqTimer = 0;

      if (found.id === 'sorting_hat') {
        candleFreezeTimer = 0.35; // Floating candles pause bobbing for ~0.3s!
      } else if (found.id === 'patronus_circle') {
        patronusFlightGroup.visible = true;
      }

      updateStationVirtualAnimationTimes();
      return { triggeredId: found.id, openCompendiumModal: false };
    },

    isDialogueActive: () =>
      activeStation !== 'none' ||
      (linkedAncientForestSystem ? linkedAncientForestSystem.isDialogueActive() : false),

    isLakeMemoryActive: () =>
      linkedAncientForestSystem ? linkedAncientForestSystem.isLakeMemoryActive() : false,

    advanceDialogue(): boolean {
      if (linkedAncientForestSystem && linkedAncientForestSystem.isDialogueActive()) {
        return linkedAncientForestSystem.advanceDialogue();
      }
      if (activeStation === 'none') return false;
      const spec = STATION_DIALOGUES[activeStation];
      if (dialogueStep < spec.steps.length - 1) {
        dialogueStep++;
        stepTimer = 0;
        updateStationVirtualAnimationTimes();
        return true;
      }
      // Final line reached -> pressing Enter completes the interaction and restores gameplay!
      resetAllStationVisuals();
      return true;
    },

    skipDialogue(): boolean {
      if (linkedAncientForestSystem && linkedAncientForestSystem.isDialogueActive()) {
        return linkedAncientForestSystem.skipDialogue();
      }
      if (activeStation === 'none') return false;
      resetAllStationVisuals();
      return true;
    },

    getActiveBanner,
    getCameraFocus,
    isPatronusActive: () => activeStation === 'patronus_circle',

    update(
      dt: number,
      elapsedTime: number,
      playerWorldPos: THREE.Vector3,
    ) {
      currentElapsedTime = elapsedTime;
      if (activeStation !== 'none') {
        stepTimer += dt;
        seqTimer += dt;
        updateStationVirtualAnimationTimes();
      } else {
        const distToKeep = Math.hypot(
          playerWorldPos.x - CASTLE_GATE_POS.x,
          playerWorldPos.z - CASTLE_GATE_POS.z,
        );
        if (distToKeep > 90.0) {
          return;
        }
      }

      // 1. Update Enchanted Starry Night Ceiling & Pensieve Shaders
      ceilingUniforms.uTime.value = elapsedTime;
      pensieveUniforms.uTime.value = elapsedTime;

      // 2. Bob 180 Instanced Floating Candles (pause for 0.3s on Sorting Hat; spread outward on Patronus!)
      if (candleFreezeTimer > 0) {
        candleFreezeTimer = Math.max(0, candleFreezeTimer - dt);
      } else {
        frozenCandleTime += dt;
      }

      const patronusSpread =
        patronusSeqTime >= 0 && patronusSeqTime < PATRONUS_DURATION
          ? Math.sin(
              smoothstep01(patronusSeqTime / 2.0) *
                (1.0 -
                  smoothstep01((patronusSeqTime - (PATRONUS_DURATION - 2.0)) / 2.0)) *
                Math.PI *
                0.5,
            ) * 1.45
          : 0.0;

      for (let i = 0; i < candleCount; i++) {
        const bobY =
          candleBaseY[i] +
          Math.sin(frozenCandleTime * 1.55 + candlePhase[i]) * 0.16;
        const spreadSign = candleBaseX[i] >= 0 ? 1 : -1;
        const cx = candleBaseX[i] + spreadSign * patronusSpread;
        _dummyObj.position.set(cx, bobY, candleBaseZ[i]);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.setScalar(1.0);
        _dummyObj.updateMatrix();
        candleBodyInstanced.setMatrixAt(i, _dummyObj.matrix);

        const flicker =
          0.9 + 0.18 * Math.sin(elapsedTime * 9.5 + candlePhase[i] * 3.0);
        _dummyObj.scale.set(1.0, flicker, 1.0);
        _dummyObj.updateMatrix();
        candleFlameInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      candleBodyInstanced.instanceMatrix.needsUpdate = true;
      candleFlameInstanced.instanceMatrix.needsUpdate = true;

      // 3. Animate 16 Swirling Acceptance Letters
      for (let i = 0; i < letterCount; i++) {
        const cycle = (elapsedTime * 0.14 + i / letterCount) % 1.0;
        const angle = elapsedTime * 1.85 + (i * Math.PI * 2) / letterCount;
        const radius = 0.55 + cycle * 1.15;
        const height = 0.6 + cycle * 6.2;
        const m = letterMeshes[i];
        m.position.set(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        );
        m.rotation.set(
          Math.sin(elapsedTime * 3.2 + i) * 0.35,
          -angle,
          Math.cos(elapsedTime * 2.7 + i) * 0.28,
        );
      }

      // 4. Gently sway House Banners
      for (let i = 0; i < houseBannerMeshes.length; i++) {
        houseBannerMeshes[i].rotation.x =
          Math.sin(elapsedTime * 1.4 + i) * 0.035;
      }

      // ======================================================================
      // 🎩 STATION 1 UPDATE: SORTING HAT & GOBLET OF BLUE FLAME
      // ======================================================================
      const hatWorld = castleLocalToWorld(sortingHatPos.x, sortingHatPos.z);
      const distToHat = Math.hypot(
        playerWorldPos.x - hatWorld.x,
        playerWorldPos.z - hatWorld.z,
      );
      const playerLocalAngleToHat =
        Math.atan2(playerWorldPos.x - hatWorld.x, playerWorldPos.z - hatWorld.z) +
        Math.PI / 4;

      if (sortingSeqTime >= 0) {
        const t = sortingSeqTime;
        if (t >= SORTING_DURATION) {
          sortingSeqTime = -1;
          hatPivot.position.set(0, 0.96, 0);
          realmRevealMat.opacity = 0;
          hatPulseRingMat.opacity = 0;
          hallLight1.intensity = 2.8;
          sortingHatSpot.intensity = 2.2;
        } else {
          // Background dims slightly while spotlight warms the Hat
          const activeEnv =
            smoothstep01(t / 0.5) *
            (1.0 - smoothstep01((t - (SORTING_DURATION - 1.0)) / 1.0));
          hallLight1.intensity = 2.8 - activeEnv * 0.9;
          sortingHatSpot.intensity = 2.2 + activeEnv * 2.4;

          // Hat rises slightly (+0.16m)
          const comedyBounce =
            t >= 6.6 && t <= 7.8
              ? Math.abs(Math.sin(((t - 6.6) / 1.2) * Math.PI * 3.0)) * 0.14
              : 0.0;
          hatPivot.position.set(0, 0.96 + activeEnv * 0.16 + comedyBounce, 0);

          // Hat turns toward Harsha, leans forward on "Harsha.", straightens on "Yes..."
          hatFacingYaw = dampValue(
            hatFacingYaw,
            playerLocalAngleToHat,
            6.0,
            dt,
          );
          const leanForward =
            t >= 1.1 && t < 8.2 ? smoothstep01((t - 1.1) / 0.6) * 0.22 : 0.0;
          hatPivot.rotation.set(
            leanForward,
            hatFacingYaw,
            Math.sin(elapsedTime * 6.5) * 0.12 * activeEnv,
          );
          hatTipPivot.rotation.x =
            -0.38 + Math.sin(elapsedTime * 10.0) * 0.22 * activeEnv;

          // Goblet flame grows taller
          const revealBoost = t >= 9.6 ? 1.85 : 1.38;
          gobletFlameMesh.scale.set(
            1.0 + Math.sin(elapsedTime * 9.0) * 0.12,
            revealBoost + Math.cos(elapsedTime * 12.0) * 0.18,
            1.0 + Math.sin(elapsedTime * 8.0) * 0.12,
          );

          // Small magical pulse rings on "You understand him." (2.2s) and "Even when Yeshwanth..." (3.5s)
          let pulseAlpha = 0.0;
          let pulseScale = 1.0;
          if (t >= 2.2 && t <= 3.4) {
            const uP = (t - 2.2) / 1.2;
            pulseAlpha = Math.sin(uP * Math.PI) * 0.75;
            pulseScale = 1.0 + uP * 2.8;
          } else if (t >= 3.5 && t <= 4.8) {
            const uP = (t - 3.5) / 1.3;
            pulseAlpha = Math.sin(uP * Math.PI) * 0.75;
            pulseScale = 1.0 + uP * 3.2;
          }
          hatPulseRingMat.opacity = pulseAlpha;
          hatPulseRingMesh.scale.setScalar(pulseScale);

          // 9.6s - 12.2s Reveal: "THE REALM OF HARSHA" 3D sky banner & Goblet eruption
          const revealEnv =
            smoothstep01((t - 9.5) / 0.5) *
            (1.0 - smoothstep01((t - 11.4) / 0.8));
          realmRevealMat.opacity = revealEnv;
          realmRevealMesh.position.y = 2.65 + revealEnv * 0.25;

          sortingSparkMat.opacity = 0.88 * activeEnv;
          const sAttr = sortingSparkGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          for (let i = 0; i < sortingSparkCount; i++) {
            const prog = (elapsedTime * (t >= 9.5 ? 0.95 : 0.45) + i / sortingSparkCount) % 1.0;
            const ang = i * 2.1 + elapsedTime * 3.8;
            const isGobletMote = t >= 9.5 && i % 2 === 1;
            const r = isGobletMote ? 0.2 + prog * 1.6 : 0.45 + Math.sin(prog * Math.PI) * 0.35;
            sAttr.setXYZ(
              i,
              Math.cos(ang) * r,
              (isGobletMote ? 1.55 : 0.98) + prog * (isGobletMote ? 3.2 : 1.4),
              (isGobletMote ? 1.35 : 0.0) + Math.sin(ang) * r,
            );
          }
          sAttr.needsUpdate = true;
        }
      } else {
        // Idle Sorting Hat: gently twitches; every 10s tilts & looks toward player; turns toward her when <= 3.5m
        const idleCycle = elapsedTime % 10.0;
        const lookAtPlayerNow = distToHat <= 3.8 || (idleCycle > 7.0 && idleCycle < 9.2);
        const targetYaw = lookAtPlayerNow ? playerLocalAngleToHat : Math.PI;
        hatFacingYaw = dampValue(hatFacingYaw, targetYaw, 3.5, dt);

        const idleTilt =
          idleCycle > 7.0 && idleCycle < 9.2
            ? Math.sin(((idleCycle - 7.0) / 2.2) * Math.PI) * 0.16
            : Math.sin(elapsedTime * 1.5) * 0.03;
        hatPivot.rotation.set(0, hatFacingYaw, idleTilt);
        hatTipPivot.rotation.x = -0.38 + Math.sin(elapsedTime * 2.2) * 0.05;

        gobletFlameMesh.scale.set(
          1.0 + Math.sin(elapsedTime * 8.0) * 0.08,
          1.0 + Math.cos(elapsedTime * 11.0) * 0.14,
          1.0 + Math.sin(elapsedTime * 7.0) * 0.08,
        );

        // Subtle rising golden particles in idle
        sortingSparkMat.opacity = 0.32;
        const sAttr = sortingSparkGeo.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        for (let i = 0; i < sortingSparkCount; i++) {
          const prog = (elapsedTime * 0.18 + i / sortingSparkCount) % 1.0;
          const ang = i * 1.7 + elapsedTime * 0.8;
          const r = 0.35 + (i % 4) * 0.12;
          sAttr.setXYZ(
            i,
            Math.cos(ang) * r,
            0.3 + prog * 2.2,
            Math.sin(ang) * r,
          );
        }
        sAttr.needsUpdate = true;
      }

      // ======================================================================
      // 📖 STATION 2 UPDATE: THE COMPENDIUM OF HARSHA (Live 3D Pages!)
      // ======================================================================
      for (let i = 0; i < flyingBooks.length; i++) {
        const fb = flyingBooks[i];
        const u = (elapsedTime * 0.055 + fb.phaseOffset) % 1.0;
        const uNext = (u + 0.01) % 1.0;
        flyingBookSpline.getPointAt(u, _tempVecA);
        flyingBookSpline.getPointAt(uNext, _tempVecB);
        fb.root.position.copy(_tempVecA);
        fb.root.lookAt(schoolRoot.localToWorld(_tempVecB.clone()));
        const flap = Math.sin(elapsedTime * 8.0 + i * 1.4) * 0.52;
        fb.leftWing.rotation.z = flap;
        fb.rightWing.rotation.z = -flap;
      }

      if (compendiumSeqTime >= 0) {
        const t = compendiumSeqTime;
        if (t >= COMPENDIUM_DURATION) {
          compendiumSeqTime = -1;
          compendiumBookRig.position.set(0, 1.2, 0.02);
          compendiumBookRig.scale.set(1, 1, 1);
          turningLeafPivot.rotation.z = 0;
          compendiumDustMat.opacity = 0;
          bookmarkMat.emissiveIntensity = 0.35;
        } else {
          dynamicCompendium.renderPages(t, false, elapsedTime);

          // 0.0s - 1.0s: Book closes itself -> THUMP -> opens
          if (t < 1.0) {
            const closeOpen = Math.sin(t * Math.PI);
            compendiumBookRig.scale.x = 1.0 - closeOpen * 0.75;
            const thumpBounce =
              t > 0.45 && t < 0.75
                ? -Math.sin(((t - 0.45) / 0.3) * Math.PI) * 0.045
                : 0;
            compendiumBookRig.position.y = 1.2 + thumpBounce;
          } else if (t > 12.0) {
            // 12.0s - 13.2s: End bounce & glowing bookmark
            const uEnd = (t - 12.0) / 1.2;
            const endBounce = Math.sin(uEnd * Math.PI * 2.0) * 0.03 * (1.0 - uEnd);
            compendiumBookRig.position.y = 1.2 + endBounce;
            compendiumBookRig.scale.x = 1.0;
            bookmarkMat.emissiveIntensity = 0.35 + Math.sin(uEnd * Math.PI) * 0.55;
          } else {
            compendiumBookRig.position.y = 1.2;
            compendiumBookRig.scale.x = 1.0;
          }

          // Automatic 3D page turns at t = 4.1..4.7s and t = 8.1..8.7s
          let leafAngle = 0;
          if (t >= 4.1 && t <= 4.7) {
            leafAngle = smoothstep01((t - 4.1) / 0.6) * Math.PI;
          } else if (t >= 8.1 && t <= 8.7) {
            leafAngle = smoothstep01((t - 8.1) / 0.6) * Math.PI;
          }
          turningLeafPivot.rotation.z = leafAngle;

          // Golden dust rising from the Compendium pages
          const dustEnv =
            smoothstep01((t - 0.8) / 0.8) *
            (1.0 - smoothstep01((t - 11.8) / 1.2));
          compendiumDustMat.opacity = dustEnv * 0.85;
          const dAttr = compendiumDustGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          for (let i = 0; i < compendiumDustCount; i++) {
            const cyc = (elapsedTime * 0.35 + i / compendiumDustCount) % 1.0;
            const ang = i * 2.3 + elapsedTime * 1.5;
            dAttr.setXYZ(
              i,
              Math.cos(ang) * (0.15 + (i % 5) * 0.06),
              1.22 + cyc * 0.75,
              Math.sin(ang) * 0.22,
            );
          }
          dAttr.needsUpdate = true;
        }
      } else {
        // Idle Compendium: every ~15s pages flutter, one page turns itself, tiny golden letters appear
        const idleBookCycle = elapsedTime % 15.0;
        const isFluttering = idleBookCycle > 11.5 && idleBookCycle < 14.0;
        if (isFluttering) {
          dynamicCompendium.renderPages(-1, true, elapsedTime);
          const uTurn = smoothstep01((idleBookCycle - 11.5) / 2.5);
          turningLeafPivot.rotation.z = uTurn * Math.PI;
        } else {
          turningLeafPivot.rotation.z = 0;
        }
      }

      // ======================================================================
      // 🪞 STATION 3 UPDATE: THE MIRROR OF DESIRE
      // ======================================================================
      if (mirrorSeqTime >= 0) {
        dynamicMirror.renderMirror(mirrorSeqTime, true, elapsedTime);
      }

      // ======================================================================
      // 🌀 STATION 4 UPDATE: THE PENSIEVE STONE BASIN
      // ======================================================================
      if (pensieveSeqTime >= 0) {
        const t = pensieveSeqTime;
        if (t >= PENSIEVE_DURATION) {
          pensieveSeqTime = -1;
          pensieveUniforms.uActiveBoost.value = 0;
          pensieveLiquidMesh.position.y = 0.97;
          pensieveWordsMat.opacity = 0;
          playfulOrbMat.opacity = 0;
        } else {
          const pEnv =
            smoothstep01(t / 0.8) *
            (1.0 - smoothstep01((t - (PENSIEVE_DURATION - 1.2)) / 1.2));
          pensieveUniforms.uActiveBoost.value = pEnv;
          pensieveLiquidMesh.position.y = 0.97 + pEnv * 0.045;

          // Floating 3D memory words ("laughing · talking · together")
          pensieveWordsMat.opacity = pEnv * 0.92;
          pensieveWordsMesh.position.y =
            1.75 + Math.sin(elapsedTime * 2.0) * 0.06;

          // Playful bouncing memory particle on "And the completely stupid little things." (4.5s - 6.8s)
          if (t >= 4.4 && t <= 7.2) {
            const uOrb = (t - 4.4) / 2.8;
            playfulOrbMat.opacity = Math.sin(uOrb * Math.PI);
            const bounceArc = Math.abs(Math.sin(t * 9.5)) * 0.42;
            playfulMemoryOrb.position.set(
              Math.cos(t * 4.5) * (0.25 + uOrb * 0.45),
              1.05 + bounceArc,
              Math.sin(t * 4.5) * (0.25 + uOrb * 0.45),
            );
          } else {
            playfulOrbMat.opacity = 0;
          }

          pensieveWispMat.opacity = 0.48 + pEnv * 0.45;
          const pAttr = pensieveWispGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          for (let i = 0; i < pensieveWispCount; i++) {
            const cyc =
              (elapsedTime * (0.25 + pEnv * 0.25) + i / pensieveWispCount) %
              1.0;
            const ang = i * 1.7 + elapsedTime * 2.5;
            // Gather particles closer during "The times I needed someone. And you were there." (6.4s - 8.8s)
            const gatherFactor = t >= 6.4 && t <= 8.8 ? 0.55 : 1.0;
            const rad = (0.12 + cyc * 0.48) * gatherFactor;
            pAttr.setXYZ(
              i,
              Math.cos(ang) * rad,
              1.0 + cyc * (1.2 + pEnv * 1.35),
              Math.sin(ang) * rad,
            );
          }
          pAttr.needsUpdate = true;
        }
      } else {
        const pAttr = pensieveWispGeo.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        for (let i = 0; i < pensieveWispCount; i++) {
          const cyc = (elapsedTime * 0.18 + i / pensieveWispCount) % 1.0;
          const ang = i * 1.7 + elapsedTime * 1.4;
          const rad = 0.12 + cyc * 0.34;
          pAttr.setXYZ(
            i,
            Math.cos(ang) * rad,
            1.0 + cyc * 1.05,
            Math.sin(ang) * rad,
          );
        }
        pAttr.needsUpdate = true;
      }

      // ======================================================================
      // 🧪 STATION 5 UPDATE: AMORTENTIA LOVE POTION CAULDRON
      // ======================================================================
      let aBoost = 0.0;
      let heartScaleMult = 1.0;
      if (amortentiaSeqTime >= 0) {
        const t = amortentiaSeqTime;
        if (t >= AMORTENTIA_DURATION) {
          amortentiaSeqTime = -1;
          steamLaughingFiguresGroup.visible = false;
        } else {
          aBoost =
            smoothstep01(t / 0.8) *
            (1.0 - smoothstep01((t - (AMORTENTIA_DURATION - 1.2)) / 1.2));
          // Scent 2 (3.8s - 5.6s): Two little laughing steam figures
          steamLaughingFiguresGroup.visible = t >= 3.6 && t <= 5.8;
          if (steamLaughingFiguresGroup.visible) {
            steamLaughingFiguresGroup.rotation.y = elapsedTime * 2.2;
            figL.position.y = Math.abs(Math.sin(elapsedTime * 9.0)) * 0.08;
            figR.position.y =
              Math.abs(Math.sin(elapsedTime * 9.0 + 1.2)) * 0.08;
          }
          // Scent 3 (5.6s - 9.2s): Heart-shaped steam suddenly becomes much larger!
          if (t >= 5.6) {
            heartScaleMult = 1.85;
          }
        }
      }

      for (let i = 0; i < steamHearts.length; i++) {
        const sh = steamHearts[i];
        const cyc =
          (elapsedTime * (0.24 + aBoost * 0.22) + i / steamHearts.length) %
          1.0;
        const ang = elapsedTime * 1.8 + i * 0.9;
        const rad = 0.08 + cyc * (0.25 + aBoost * 0.22);
        sh.position.set(
          Math.cos(ang) * rad,
          1.08 + cyc * (1.55 + aBoost * 1.15),
          Math.sin(ang) * rad,
        );
        sh.rotation.y = ang;
        const s =
          Math.sin(cyc * Math.PI) * (1.0 + aBoost * 0.45) * heartScaleMult;
        sh.scale.setScalar(Math.max(0.01, s));
      }

      // ======================================================================
      // 🦌 STATION 6 UPDATE: EXPECTO PATRONUM (Progressive Doe + 8s Flight + Sky-Writing)
      // ======================================================================
      floatingWandMesh.position.y = 1.18 + Math.sin(elapsedTime * 2.4) * 0.05;
      floatingWandMesh.rotation.y = elapsedTime * 0.8;

      if (patronusSeqTime >= 0) {
        const t = patronusSeqTime;
        if (t >= PATRONUS_DURATION) {
          patronusSeqTime = -1;
          patronusFlightGroup.visible = false;
          patronusPointLight.intensity = 0;
          patronusSkyTextMat.opacity = 0;
        } else if (t < 6.5) {
          // PHASE 1 (0.0s - 6.5s): Progressive Materialization of the Doe at the Spell Circle!
          // 2.2s: Legs form ("You ask if I've eaten.")
          // 3.2s: Body forms ("You remind me to take care of myself.")
          // 4.2s: Head forms ("You worry about me.")
          // 5.2s: Looks at Harsha ("Because you care.")
          doeLegsMat.opacity = smoothstep01((t - 1.8) / 1.2) * 0.86;
          doeBodyMat.opacity = smoothstep01((t - 2.9) / 1.2) * 0.86;
          doeHeadMat.opacity = smoothstep01((t - 4.0) / 1.2) * 0.86;

          patronusDoeRig.position.set(
            patronusCirclePos.x,
            0.05,
            patronusCirclePos.z,
          );
          const circleWorld = castleLocalToWorld(
            patronusCirclePos.x,
            patronusCirclePos.z,
          );
          const lookAtHarshaYaw =
            Math.atan2(
              playerWorldPos.x - circleWorld.x,
              playerWorldPos.z - circleWorld.z,
            ) +
            Math.PI / 4;
          patronusDoeRig.rotation.set(0, lookAtHarshaYaw, 0);
          patronusDoeRig.scale.setScalar(1.0);

          doeFrontLeftLeg.rotation.x = 0;
          doeFrontRightLeg.rotation.x = 0;
          doeBackLeftLeg.rotation.x = 0;
          doeBackRightLeg.rotation.x = 0;

          patronusPointLight.intensity = smoothstep01(t / 4.0) * 3.2;
          patronusTrailMat.opacity = smoothstep01(t / 2.0) * 0.75;

          const tAttr = patronusTrailGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          for (let i = 0; i < patronusTrailCount; i++) {
            const cyc = (elapsedTime * 0.45 + i / patronusTrailCount) % 1.0;
            const ang = i * 2.1 + elapsedTime * 3.5;
            const r = 0.45 + Math.sin(cyc * Math.PI) * 0.85;
            tAttr.setXYZ(
              i,
              patronusCirclePos.x + Math.cos(ang) * r,
              0.15 + cyc * 2.2,
              patronusCirclePos.z + Math.sin(ang) * r,
            );
          }
          tAttr.needsUpdate = true;
          patronusSkyTextMat.opacity = 0;
        } else {
          // PHASE 2 (6.5s - 14.5s): 8-Second Great Hall Flight & "HARSHA ♥ YESHWANTH" Stardust Reveal
          const flightT = t - 6.5;
          const u = flightT / 8.0;
          const fadeEnv = 1.0 - smoothstep01((u - 0.85) / 0.15);

          doeLegsMat.opacity = fadeEnv * 0.86;
          doeBodyMat.opacity = fadeEnv * 0.86;
          doeHeadMat.opacity = fadeEnv * 0.86;
          patronusTrailMat.opacity = fadeEnv * 0.88;
          patronusPointLight.intensity = fadeEnv * 3.8;

          patronusFlightCurve.getPointAt(u, _tempVecA);
          patronusFlightCurve.getPointAt(Math.min(1.0, u + 0.015), _tempVecB);

          const gallopWave = Math.sin(flightT * 9.5);
          patronusDoeRig.position.set(
            _tempVecA.x,
            _tempVecA.y + Math.abs(gallopWave) * 0.28,
            _tempVecA.z,
          );

          const dx = _tempVecB.x - _tempVecA.x;
          const dz = _tempVecB.z - _tempVecA.z;
          patronusDoeRig.rotation.set(
            -gallopWave * 0.18,
            Math.atan2(dx, dz),
            0,
          );

          doeFrontLeftLeg.rotation.x = gallopWave * 0.65;
          doeFrontRightLeg.rotation.x =
            Math.sin(flightT * 9.5 + 0.5) * 0.65;
          doeBackLeftLeg.rotation.x = -gallopWave * 0.65;
          doeBackRightLeg.rotation.x =
            -Math.sin(flightT * 9.5 + 0.5) * 0.65;

          const tAttr = patronusTrailGeo.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          for (let i = 0; i < patronusTrailCount; i++) {
            const lag = (i / patronusTrailCount) * 0.22;
            const uTrail = Math.max(0, u - lag);
            patronusFlightCurve.getPointAt(uTrail, _tempVecB);
            const swirlA = i * 1.9 + elapsedTime * 5.0;
            const swirlR = (i / patronusTrailCount) * 0.42;
            tAttr.setXYZ(
              i,
              _tempVecB.x + Math.cos(swirlA) * swirlR,
              _tempVecB.y + 0.75 + Math.sin(swirlA) * swirlR,
              _tempVecB.z + Math.sin(swirlA * 0.8) * swirlR,
            );
          }
          tAttr.needsUpdate = true;

          // Final Loop Stardust Sky-Writing: "HARSHA ♥ YESHWANTH" (11.0s - 14.5s)
          const skyTextEnv =
            smoothstep01((t - 10.8) / 0.8) *
            (1.0 - smoothstep01((t - 13.6) / 0.9));
          patronusSkyTextMat.opacity = skyTextEnv;
        }
      }

      // ======================================================================
      // 🐸 STATION 7 UPDATE: THE ROYAL FROG ("You even scold me because you care.")
      // ======================================================================
      for (let i = 0; i < portraitMeshes.length; i++) {
        portraitMeshes[i].rotation.z =
          Math.sin(elapsedTime * 1.6 + i * 1.5) * 0.03;
      }

      for (let i = 0; i < mandrakes.length; i++) {
        const m = mandrakes[i];
        const d = Math.hypot(
          playerWorldPos.x - m.worldPos.x,
          playerWorldPos.z - m.worldPos.z,
        );
        const excite = 1.0 - smoothstep01((d - 1.8) / 3.2);
        const freq = 3.0 + excite * 19.0;
        const amp = 0.04 + excite * 0.24;
        m.tuftPivot.rotation.z = Math.sin(elapsedTime * freq + m.phase) * amp;
        m.tuftPivot.position.y =
          0.32 +
          Math.abs(Math.sin(elapsedTime * (freq * 0.7) + m.phase)) *
            excite *
            0.12;
      }

      for (let i = 0; i < bellFlowers.length; i++) {
        const bf = bellFlowers[i];
        const d = Math.hypot(
          playerWorldPos.x - bf.worldPos.x,
          playerWorldPos.z - bf.worldPos.z,
        );
        const openFactor = 1.0 - smoothstep01((d - 1.8) / 3.4);
        const tilt =
          0.25 + openFactor * 0.68 + Math.sin(elapsedTime * 2.0 + i) * 0.05;
        for (let p = 0; p < bf.petals.length; p++) {
          bf.petals[p].rotation.x = tilt;
        }
      }

      const frogWorld = castleLocalToWorld(royalFrogPos.x, royalFrogPos.z);
      const dxFrog = playerWorldPos.x - frogWorld.x;
      const dzFrog = playerWorldPos.z - frogWorld.z;
      const baseFrogToPlayerYaw = Math.atan2(dxFrog, dzFrog) + Math.PI / 4;

      if (frogSeqTime >= 0) {
        const t = frogSeqTime;
        if (t >= FROG_DURATION) {
          frogSeqTime = -1;
          royalFrogRig.position.set(0, 0.66, 0);
          royalFrogRig.rotation.x = 0;
        } else {
          // 1.5s - 3.0s: Looks sideways toward imaginary Yeshwanth
          // 9.4s - 10.8s: Looks around nervously ("Don't tell him I said that.")
          let yawOffset = 0;
          if (t >= 1.5 && t < 3.0) {
            yawOffset = 0.65;
          } else if (t >= 9.4 && t < 10.8) {
            yawOffset = Math.sin(t * 14.0) * 0.55;
          }
          frogFacingYaw = dampValue(
            frogFacingYaw,
            baseFrogToPlayerYaw + yawOffset,
            8.0,
            dt,
          );

          // 7.4s - 9.4s: Leans closer ("You sound more like his mother than his girlfriend sometimes.")
          const leanAngle =
            t >= 7.4 && t < 9.4
              ? smoothstep01((t - 7.4) / 0.5) * 0.25
              : 0.0;
          royalFrogRig.rotation.set(leanAngle, frogFacingYaw, 0);

          // 4 Hops on "Eat properly" (3.3-4.1), "Sleep properly" (4.2-5.0), "Don't do that" (5.1-5.9), "Why did you do that" (6.0-6.8)
          let hopY = 0;
          if (t >= 3.3 && t < 6.8) {
            const hopCycle = ((t - 3.3) / 0.88) % 1.0;
            hopY = Math.sin(hopCycle * Math.PI) * 0.24;
          }

          // 10.8s - 13.2s: Frog hops onto lily pad with a splash ripple!
          if (t >= 10.8) {
            const uLily = smoothstep01((t - 10.8) / 0.8);
            const lilyArc = Math.sin(uLily * Math.PI) * 0.38;
            royalFrogRig.position.set(
              THREE.MathUtils.lerp(0, 0.58, uLily),
              THREE.MathUtils.lerp(0.66, 0.34, uLily) + lilyArc,
              THREE.MathUtils.lerp(0, -0.35, uLily),
            );
            const splashU = smoothstep01((t - 11.5) / 1.2);
            splashRingMesh.scale.setScalar(1.0 + splashU * 2.2);
            splashRingMat.opacity = (1.0 - splashU) * 0.85;
          } else {
            royalFrogRig.position.set(0, 0.66 + hopY, 0);
            splashRingMesh.scale.setScalar(1.0);
            splashRingMat.opacity = 0.25;
          }
        }
      } else {
        if (Math.hypot(dxFrog, dzFrog) < 9.0) {
          frogFacingYaw = dampValue(frogFacingYaw, baseFrogToPlayerYaw, 6.0, dt);
          royalFrogRig.rotation.set(0, frogFacingYaw, 0);
        }
        // Occasional tiny idle hop & lily pad ripple
        const idleHopCyc = elapsedTime % 7.5;
        const tinyHop =
          idleHopCyc > 6.8
            ? Math.sin(((idleHopCyc - 6.8) / 0.7) * Math.PI) * 0.1
            : 0;
        royalFrogRig.position.set(0, 0.66 + tinyHop, 0);
        const rippleCyc = (elapsedTime * 0.45) % 1.0;
        splashRingMesh.scale.setScalar(1.0 + rippleCyc * 0.85);
        splashRingMat.opacity = (1.0 - rippleCyc) * 0.35;
      }

      const throatPulse = 1.0 + Math.sin(elapsedTime * 4.8) * 0.18;
      frogThroat.scale.setScalar(throatPulse);

      // 12. Animate the Scarlet Steam Locomotive along the Curved Viaduct Track
      const trainU = (elapsedTime * 0.028) % 1.0;
      const trainUNext = (trainU + 0.01) % 1.0;
      viaductCurve.getPointAt(trainU, _tempVecA);
      viaductCurve.getPointAt(trainUNext, _tempVecB);
      scarletTrainGroup.position.set(
        _tempVecA.x,
        _tempVecA.y + 1.05,
        _tempVecA.z,
      );
      scarletTrainGroup.rotation.y = Math.atan2(
        _tempVecB.x - _tempVecA.x,
        _tempVecB.z - _tempVecA.z,
      );

      for (let p = 0; p < trainSteamPuffs.length; p++) {
        const puffCyc = (elapsedTime * 0.85 + p / trainSteamPuffs.length) % 1.0;
        const puff = trainSteamPuffs[p];
        puff.position.set(0, 2.6 + puffCyc * 2.4, 1.8 - puffCyc * 2.8);
        puff.scale.setScalar(0.55 + puffCyc * 1.45);
      }
    },

    dispose() {
      tracker.dispose();
    },
  };
}
