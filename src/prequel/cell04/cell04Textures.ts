import * as THREE from 'three';

/**
 * Procedural HTML5 2D Canvas textures for Cell 04: The Awakening.
 * All albedo textures use SRGBColorSpace and max anisotropy for sharp grazing angles.
 */
export interface RoomTextureSet {
  wall: THREE.CanvasTexture;
  floor: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  fabric: THREE.CanvasTexture;
  doorSteel: THREE.CanvasTexture;
  phoneDial: THREE.CanvasTexture;
  shadowDecal: THREE.CanvasTexture;
  dispose: () => void;
}

export function createRoomTextures(maxAnisotropy: number): RoomTextureSet {
  const configureAlbedo = (
    tex: THREE.CanvasTexture,
    repeatX = 1,
    repeatY = 1,
  ) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    return tex;
  };

  // 1. Weathered Concrete Wall Texture
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wCtx = wallCanvas.getContext('2d')!;
  wCtx.fillStyle = '#36393f';
  wCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 24;
    const shade = 44 + Math.floor(Math.random() * 24);
    wCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 5}, 0.12)`;
    wCtx.beginPath();
    wCtx.arc(x, y, r, 0, Math.PI * 2);
    wCtx.fill();
  }
  wCtx.strokeStyle = 'rgba(20, 22, 26, 0.35)';
  wCtx.lineWidth = 2;
  wCtx.beginPath();
  wCtx.moveTo(0, 256);
  wCtx.lineTo(512, 256);
  wCtx.moveTo(256, 0);
  wCtx.lineTo(256, 512);
  wCtx.stroke();

  // 2. Grungy Concrete Slab Floor Texture
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d')!;
  fCtx.fillStyle = '#26282c';
  fCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 2 + Math.random() * 14;
    const shade = 28 + Math.floor(Math.random() * 26);
    fCtx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 2}, 0.18)`;
    fCtx.fillRect(x, y, w, w);
  }
  fCtx.strokeStyle = 'rgba(12, 13, 16, 0.55)';
  fCtx.lineWidth = 3;
  for (let step = 128; step < 512; step += 128) {
    fCtx.beginPath();
    fCtx.moveTo(step, 0);
    fCtx.lineTo(step, 512);
    fCtx.moveTo(0, step);
    fCtx.lineTo(512, step);
    fCtx.stroke();
  }

  // 3. Worn Dark Timber Texture (Desk & Chair)
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wdCtx = woodCanvas.getContext('2d')!;
  wdCtx.fillStyle = '#4a3222';
  wdCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const delta = Math.sin(y * 0.15) * 8 + (Math.random() - 0.5) * 10;
    const r = Math.min(255, Math.max(0, 74 + delta));
    const g = Math.min(255, Math.max(0, 50 + delta * 0.7));
    const b = Math.min(255, Math.max(0, 34 + delta * 0.5));
    wdCtx.fillStyle = `rgb(${r},${g},${b})`;
    wdCtx.fillRect(0, y, 256, 2);
  }

  // 4. Striped / Worn Mattress Fabric Texture
  const fabricCanvas = document.createElement('canvas');
  fabricCanvas.width = 256;
  fabricCanvas.height = 256;
  const fbCtx = fabricCanvas.getContext('2d')!;
  fbCtx.fillStyle = '#736f68';
  fbCtx.fillRect(0, 0, 256, 256);
  fbCtx.fillStyle = 'rgba(52, 50, 46, 0.35)';
  for (let x = 0; x < 256; x += 16) {
    fbCtx.fillRect(x, 0, 4, 256);
  }
  for (let i = 0; i < 300; i++) {
    fbCtx.fillStyle = 'rgba(40, 36, 30, 0.08)';
    fbCtx.beginPath();
    fbCtx.arc(
      Math.random() * 256,
      Math.random() * 256,
      4 + Math.random() * 14,
      0,
      Math.PI * 2,
    );
    fbCtx.fill();
  }

  // 5. Heavy Steel Door Texture
  const doorCanvas = document.createElement('canvas');
  doorCanvas.width = 256;
  doorCanvas.height = 512;
  const dCtx = doorCanvas.getContext('2d')!;
  dCtx.fillStyle = '#333840';
  dCtx.fillRect(0, 0, 256, 512);
  dCtx.strokeStyle = '#1f2328';
  dCtx.lineWidth = 6;
  dCtx.strokeRect(14, 14, 228, 484);
  dCtx.fillStyle = '#525862';
  for (let y = 32; y <= 480; y += 44) {
    dCtx.beginPath();
    dCtx.arc(26, y, 3.5, 0, Math.PI * 2);
    dCtx.arc(230, y, 3.5, 0, Math.PI * 2);
    dCtx.fill();
  }

  // 6. Rotary Phone Dial Face Texture
  const dialCanvas = document.createElement('canvas');
  dialCanvas.width = 256;
  dialCanvas.height = 256;
  const dlCtx = dialCanvas.getContext('2d')!;
  dlCtx.fillStyle = '#dfd9c8';
  dlCtx.beginPath();
  dlCtx.arc(128, 128, 120, 0, Math.PI * 2);
  dlCtx.fill();
  dlCtx.strokeStyle = '#222';
  dlCtx.lineWidth = 6;
  dlCtx.stroke();
  dlCtx.fillStyle = '#1b1b1d';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 1.55 + 0.4;
    const hx = 128 + Math.cos(angle) * 78;
    const hy = 128 + Math.sin(angle) * 78;
    dlCtx.beginPath();
    dlCtx.arc(hx, hy, 15, 0, Math.PI * 2);
    dlCtx.fill();
  }
  dlCtx.fillStyle = '#8b1e1e';
  dlCtx.beginPath();
  dlCtx.arc(128, 128, 30, 0, Math.PI * 2);
  dlCtx.fill();

  // 7. Soft Radial Contact Shadow Decal
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 16, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  const shadowDecal = new THREE.CanvasTexture(shadowCanvas);
  shadowDecal.colorSpace = THREE.SRGBColorSpace;
  shadowDecal.needsUpdate = true;

  const wall = configureAlbedo(new THREE.CanvasTexture(wallCanvas), 2, 1);
  const floor = configureAlbedo(new THREE.CanvasTexture(floorCanvas), 3, 3);
  const wood = configureAlbedo(new THREE.CanvasTexture(woodCanvas), 1, 1);
  const fabric = configureAlbedo(new THREE.CanvasTexture(fabricCanvas), 2, 2);
  const doorSteel = configureAlbedo(new THREE.CanvasTexture(doorCanvas), 1, 1);
  const phoneDial = configureAlbedo(new THREE.CanvasTexture(dialCanvas), 1, 1);

  return {
    wall,
    floor,
    wood,
    fabric,
    doorSteel,
    phoneDial,
    shadowDecal,
    dispose: () => {
      wall.dispose();
      floor.dispose();
      wood.dispose();
      fabric.dispose();
      doorSteel.dispose();
      phoneDial.dispose();
      shadowDecal.dispose();
    },
  };
}
