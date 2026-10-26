/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';

/**
 * Reusable motion graphics particle type.
 */
export type MotionGraphicType =
  | 'heart_burst'
  | 'sparkle_ring'
  | 'float_hearts'
  | 'light_sweep'
  | 'soft_pulse'
  | 'orbit_symbol'
  | 'confetti_micro';

/**
 * Damped spring micro-physics helper for tactile bounces, snaps, and squash & stretch:
 * f(t) = sin(t * freq) * exp(-t * damping)
 */
export function dampedSpring(t: number, freq = 14.0, damping = 4.5): number {
  if (t <= 0) return 0;
  return Math.sin(t * freq) * Math.exp(-t * damping);
}

/**
 * Creates high-DPI texture for a 3D world-space diegetic personal message plaque
 * with soft left-to-right alpha wipe progress (0..1).
 */
export function createWorldSpaceMessagePlaque(
  title: string,
  message: string,
  subline: string,
  tracker: ResourceTracker,
): {
  mesh: THREE.Mesh;
  group: THREE.Group;
  setRevealProgress: (progress: number, elapsedTime: number) => void;
  dispose: () => void;
} {
  const width = 1280;
  const height = 440;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Render pristine parchment & gold plaque graphic to base canvas
  function renderBasePlaque(wipeProgress: number) {
    ctx.clearRect(0, 0, width, height);

    if (wipeProgress <= 0.001) return;

    // Create soft gradient alpha mask for left-to-right wipe
    ctx.save();

    // Clip according to wipeProgress with smooth feather edge
    const wipeX = wipeProgress * (width + 120) - 60;

    // Use clip path
    ctx.beginPath();
    ctx.rect(0, 0, Math.max(0, wipeX + 60), height);
    ctx.clip();

    // Plaque background: deep crimson velvet & ivory cream parchment
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#2e0f19');
    bgGrad.addColorStop(1, '#1b080f');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(24, 24, width - 48, height - 48, 28);
    ctx.fill();

    // Outer warm gold filigree border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner thin rose-gold border
    ctx.strokeStyle = 'rgba(244, 180, 196, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(36, 36, width - 72, height - 72, 20);
    ctx.stroke();

    // Corner decorative heart flourishes
    const drawHeart = (cx: number, cy: number, size: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#e5b564';
      ctx.beginPath();
      ctx.moveTo(0, size * 0.4);
      ctx.bezierCurveTo(-size * 0.8, -size * 0.3, -size * 0.5, -size * 0.9, 0, -size * 0.3);
      ctx.bezierCurveTo(size * 0.5, -size * 0.9, size * 0.8, -size * 0.3, 0, size * 0.4);
      ctx.fill();
      ctx.restore();
    };
    drawHeart(60, 60, 16);
    drawHeart(width - 60, 60, 16);
    drawHeart(60, height - 60, 16);
    drawHeart(width - 60, height - 60, 16);

    // Subtitle / category badge
    ctx.fillStyle = '#f5c6d1';
    ctx.font = '600 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subline.toUpperCase(), width / 2, 78);

    const maxTextWidth = width - 200; // 100px padding on each side (>25% total margin)

    // Auto-scale Main Title / Inscription font
    let titleFontSize = 42;
    ctx.font = `bold ${titleFontSize}px Georgia, serif`;
    while (ctx.measureText(title).width > maxTextWidth && titleFontSize > 22) {
      titleFontSize -= 2;
      ctx.font = `bold ${titleFontSize}px Georgia, serif`;
    }
    ctx.fillStyle = '#fff4db';
    ctx.fillText(title, width / 2, 165);

    // Auto-scale Romantic Personal Message font
    let msgFontSize = 30;
    ctx.font = `italic ${msgFontSize}px Georgia, serif`;
    while (ctx.measureText(message).width > maxTextWidth && msgFontSize > 18) {
      msgFontSize -= 2;
      ctx.font = `italic ${msgFontSize}px Georgia, serif`;
    }
    ctx.fillStyle = '#ffd1dc';
    ctx.fillText(message, width / 2, 260);

    // Subtle bottom heart divider
    ctx.fillStyle = '#d4af37';
    ctx.font = '22px serif';
    ctx.fillText('♡', width / 2, 345);

    ctx.restore();
  }

  renderBasePlaque(1.0);

  const texture = tracker.trackTex(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const mat = tracker.trackMat(
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false, // Prevents booth geometry slicing through plaque
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  // Plaque geometry: 0.72m wide x 0.25m high
  const geo = tracker.trackGeo(new THREE.PlaneGeometry(0.72, 0.25));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 999;

  const group = new THREE.Group();
  group.name = 'WorldSpaceMessagePlaqueGroup';
  group.add(mesh);
  group.visible = false;

  let lastWipe = -1;

  return {
    mesh,
    group,
    setRevealProgress(progress: number, elapsedTime: number) {
      const clamped = THREE.MathUtils.clamp(progress, 0, 1);
      if (clamped <= 0.001) {
        group.visible = false;
        mat.opacity = 0;
        return;
      }
      group.visible = true;

      // Soft alpha wipe (0.45s)
      mat.opacity = THREE.MathUtils.smoothstep(clamped, 0.05, 0.45);

      // Quantize canvas re-renders to save CPU while wiping
      const quantized = Math.floor(clamped * 30) / 30;
      if (quantized !== lastWipe) {
        lastWipe = quantized;
        renderBasePlaque(clamped);
        texture.needsUpdate = true;
      }

      // Gentle floating breath
      mesh.position.y = Math.sin(elapsedTime * 2.2) * 0.006;
    },
    dispose() {
      // ResourceTracker handles disposal
    },
  };
}

/**
 * Shared reusable motion graphics particle engine:
 * Supports HeartBurst, SparkleRing, FloatHearts, LightSweep, SoftPulse, OrbitSymbol, ConfettiMicro.
 */
export class PrizeCinematicFXSystem {
  public group: THREE.Group;
  private tracker: ResourceTracker;

  // Reusable instanced particles
  private heartMesh: THREE.InstancedMesh;
  private sparkleMesh: THREE.InstancedMesh;
  private confettiMesh: THREE.InstancedMesh;
  private pulseDisc: THREE.Mesh;
  private sweepQuad: THREE.Mesh;

  // Theatrical focus lighting rig (key + rim point lights)
  public keyLight: THREE.PointLight;
  public rimLight: THREE.PointLight;
  private lightIntensityScale = 0;

  // Active particle state pools
  private activeHearts: Array<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    rot: THREE.Vector3;
    rotVel: THREE.Vector3;
    scale: number;
    life: number;
    maxLife: number;
  }> = [];

  private activeSparkles: Array<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    scale: number;
    life: number;
    maxLife: number;
    color: THREE.Color;
  }> = [];

  private activeConfetti: Array<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    rot: THREE.Vector3;
    rotVel: THREE.Vector3;
    scale: number;
    life: number;
    maxLife: number;
    color: THREE.Color;
  }> = [];

  private pulseActive = false;
  private pulseTimer = 0;
  private sweepActive = false;
  private sweepTimer = 0;

  private dummy = new THREE.Object3D();
  private colorHelper = new THREE.Color();

  constructor(tracker: ResourceTracker) {
    this.tracker = tracker;
    this.group = new THREE.Group();
    this.group.name = 'PrizeCinematicFXSystem';

    // 1. Heart particles (Extruded 3D mini hearts)
    const heartShape = new THREE.Shape();
    const hr = 0.024;
    heartShape.moveTo(0, hr * 0.4);
    heartShape.bezierCurveTo(-hr * 0.8, -hr * 0.3, -hr * 0.5, -hr * 0.9, 0, -hr * 0.3);
    heartShape.bezierCurveTo(hr * 0.5, -hr * 0.9, hr * 0.8, -hr * 0.3, 0, hr * 0.4);
    const heartGeo = tracker.trackGeo(
      new THREE.ExtrudeGeometry(heartShape, {
        depth: 0.008,
        bevelEnabled: false,
      }),
    );
    heartGeo.center();

    const heartMat = tracker.trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ff5983'),
        emissive: new THREE.Color('#ff3366'),
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
      }),
    );

    this.heartMesh = new THREE.InstancedMesh(heartGeo, heartMat, 32);
    this.heartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heartMesh.frustumCulled = false;
    this.group.add(this.heartMesh);

    // 2. Sparkles (Octahedron diamonds)
    const sparkleGeo = tracker.trackGeo(new THREE.OctahedronGeometry(0.016, 0));
    const sparkleMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffe8a3'),
        transparent: true,
      }),
    );
    this.sparkleMesh = new THREE.InstancedMesh(sparkleGeo, sparkleMat, 48);
    this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkleMesh.frustumCulled = false;
    this.group.add(this.sparkleMesh);

    // 3. Miniature confetti (Thin rectangles)
    const confettiGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.025, 0.014));
    const confettiMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    this.confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, 40);
    this.confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confettiMesh.frustumCulled = false;
    this.group.add(this.confettiMesh);

    // 4. Soft radial glow pulse disc
    const pulseGeo = tracker.trackGeo(new THREE.RingGeometry(0.02, 0.38, 24));
    const pulseMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffe194'),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.pulseDisc = new THREE.Mesh(pulseGeo, pulseMat);
    this.pulseDisc.rotation.x = -Math.PI / 2;
    this.pulseDisc.visible = false;
    this.group.add(this.pulseDisc);

    // 5. Specular light sweep quad
    const sweepGeo = tracker.trackGeo(new THREE.PlaneGeometry(0.06, 0.45));
    const sweepMat = tracker.trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sweepQuad = new THREE.Mesh(sweepGeo, sweepMat);
    this.sweepQuad.rotation.z = Math.PI / 4;
    this.sweepQuad.visible = false;
    this.group.add(this.sweepQuad);

    // 6. Theatrical Focus Lighting Rig
    // Dedicated warm local key light (#fff6e8, intensity up to 1.15) directly facing the photo/gift plane
    this.keyLight = new THREE.PointLight(0xfff6e8, 0, 5.2, 1.35);
    this.keyLight.position.set(0.18, 0.25, 0.62);
    this.group.add(this.keyLight);

    // Soft neutral-warm rim light
    this.rimLight = new THREE.PointLight(0xfff0dd, 0, 4.5, 1.5);
    this.rimLight.position.set(-0.38, 0.32, -0.35);
    this.group.add(this.rimLight);

    // Initialize all instances as scale 0
    this.resetAllInstances();
  }

  private resetAllInstances() {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = 0; i < 32; i++) {
      this.heartMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.heartMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 48; i++) {
      this.sparkleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparkleMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 40; i++) {
      this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Triggers a bursting burst of tiny floating hearts radiating outward.
   */
  public triggerHeartBurst(centerPos: THREE.Vector3, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 0.25 + Math.random() * 0.35;
      const elev = (Math.random() - 0.2) * 0.3;
      this.activeHearts.push({
        pos: centerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05)),
        vel: new THREE.Vector3(Math.cos(angle) * speed, 0.22 + Math.random() * 0.25 + elev, Math.sin(angle) * speed),
        rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
        rotVel: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 0),
        scale: 0.6 + Math.random() * 0.5,
        life: 0,
        maxLife: 1.1 + Math.random() * 0.4,
      });
    }
  }

  /**
   * Triggers an expanding sparkle ring of golden points.
   */
  public triggerSparkleRing(centerPos: THREE.Vector3, radius = 0.18, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = radius * (0.85 + Math.random() * 0.3);
      this.activeSparkles.push({
        pos: centerPos.clone().add(new THREE.Vector3(Math.cos(angle) * r, 0.02, Math.sin(angle) * r)),
        vel: new THREE.Vector3(Math.cos(angle) * 0.25, 0.1 + Math.random() * 0.15, Math.sin(angle) * 0.25),
        scale: 0.8 + Math.random() * 0.6,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.3,
        color: new THREE.Color(i % 2 === 0 ? '#ffe194' : '#ffb3c6'),
      });
    }
  }

  /**
   * Triggers a shower of miniature festive confetti for the Mystery Egg pop.
   */
  public triggerConfettiMicro(centerPos: THREE.Vector3, count = 28) {
    const palette = ['#ff6b8b', '#ffd166', '#06d6a0', '#118ab2', '#f72585', '#faf0ca'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.45;
      this.activeConfetti.push({
        pos: centerPos.clone().add(new THREE.Vector3(0, 0.05, 0)),
        vel: new THREE.Vector3(Math.cos(angle) * speed, 0.45 + Math.random() * 0.4, Math.sin(angle) * speed),
        rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotVel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        scale: 0.7 + Math.random() * 0.6,
        life: 0,
        maxLife: 1.4 + Math.random() * 0.5,
        color: new THREE.Color(palette[i % palette.length]),
      });
    }
  }

  /**
   * Triggers a soft radial pulse disc expanding behind the prize.
   */
  public triggerSoftPulse(centerPos: THREE.Vector3) {
    this.pulseDisc.position.copy(centerPos);
    this.pulseDisc.scale.set(0.01, 0.01, 0.01);
    this.pulseDisc.visible = true;
    this.pulseActive = true;
    this.pulseTimer = 0;
  }

  /**
   * Triggers a diagonal light sweep across the prize surface.
   */
  public triggerLightSweep(centerPos: THREE.Vector3) {
    this.sweepQuad.position.copy(centerPos);
    this.sweepQuad.position.z += 0.02;
    this.sweepQuad.visible = true;
    this.sweepActive = true;
    this.sweepTimer = 0;
  }

  /**
   * Sets theatrical focus lighting intensity (0..1).
   * Positions the warm key light (#fff6e8, intensity 1.15) directly facing the photo/gift plane
   * and a soft neutral rim light behind/beside it.
   */
  public setTheatricalLighting(intensity: number, targetPos: THREE.Vector3) {
    this.lightIntensityScale = THREE.MathUtils.clamp(intensity, 0, 1);
    this.keyLight.position.set(targetPos.x + 0.16, targetPos.y + 0.24, targetPos.z + 0.58);
    this.keyLight.intensity = this.lightIntensityScale * 1.15;

    this.rimLight.position.set(targetPos.x - 0.36, targetPos.y + 0.28, targetPos.z - 0.42);
    this.rimLight.intensity = this.lightIntensityScale * 0.65;
  }

  /**
   * Multiplier to duck background/ambient lights (~30% reduction) during the cinematic.
   */
  public getBackgroundDimMultiplier(): number {
    return 1.0 - this.lightIntensityScale * 0.32;
  }

  /**
   * Frame update for all active particle systems and motion graphics.
   */
  public update(dt: number) {
    // 1. Update Hearts
    for (let i = this.activeHearts.length - 1; i >= 0; i--) {
      const h = this.activeHearts[i];
      h.life += dt;
      if (h.life >= h.maxLife) {
        this.activeHearts.splice(i, 1);
        continue;
      }
      h.pos.addScaledVector(h.vel, dt);
      h.vel.y -= dt * 0.45; // Gentle gravity
      h.vel.x *= 1 - dt * 1.2;
      h.vel.z *= 1 - dt * 1.2;
      h.rot.addScaledVector(h.rotVel, dt);

      const progress = h.life / h.maxLife;
      const s = Math.sin(progress * Math.PI) * h.scale;

      this.dummy.position.copy(h.pos);
      this.dummy.rotation.set(h.rot.x, h.rot.y, h.rot.z);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      if (i < 32) {
        this.heartMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    // Clear unused slots
    for (let i = this.activeHearts.length; i < 32; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.heartMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.heartMesh.instanceMatrix.needsUpdate = true;

    // 2. Update Sparkles
    for (let i = this.activeSparkles.length - 1; i >= 0; i--) {
      const sp = this.activeSparkles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.activeSparkles.splice(i, 1);
        continue;
      }
      sp.pos.addScaledVector(sp.vel, dt);
      sp.vel.multiplyScalar(1 - dt * 1.5);

      const progress = sp.life / sp.maxLife;
      const s = Math.sin(progress * Math.PI) * sp.scale;

      this.dummy.position.copy(sp.pos);
      this.dummy.rotation.set(sp.life * 4, sp.life * 5, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      if (i < 48) {
        this.sparkleMesh.setMatrixAt(i, this.dummy.matrix);
        this.sparkleMesh.setColorAt(i, sp.color);
      }
    }
    for (let i = this.activeSparkles.length; i < 48; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.sparkleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparkleMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkleMesh.instanceColor) this.sparkleMesh.instanceColor.needsUpdate = true;

    // 3. Update Confetti
    for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
      const c = this.activeConfetti[i];
      c.life += dt;
      if (c.life >= c.maxLife) {
        this.activeConfetti.splice(i, 1);
        continue;
      }
      c.pos.addScaledVector(c.vel, dt);
      c.vel.y -= dt * 0.75; // Confetti flutter down
      c.vel.x += Math.sin(c.life * 8 + i) * dt * 0.2;
      c.vel.z += Math.cos(c.life * 8 + i) * dt * 0.2;
      c.rot.addScaledVector(c.rotVel, dt);

      const progress = c.life / c.maxLife;
      const s = Math.sin(progress * Math.PI) * c.scale;

      this.dummy.position.copy(c.pos);
      this.dummy.rotation.set(c.rot.x, c.rot.y, c.rot.z);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      if (i < 40) {
        this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
        this.confettiMesh.setColorAt(i, c.color);
      }
    }
    for (let i = this.activeConfetti.length; i < 40; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
    if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;

    // 4. Update Soft Pulse Disc
    if (this.pulseActive) {
      this.pulseTimer += dt;
      const u = Math.min(1, this.pulseTimer / 0.85);
      const scale = 0.2 + u * 1.6;
      this.pulseDisc.scale.set(scale, scale, scale);
      (this.pulseDisc.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.45;
      if (u >= 1) {
        this.pulseActive = false;
        this.pulseDisc.visible = false;
      }
    }

    // 5. Update Light Sweep Quad
    if (this.sweepActive) {
      this.sweepTimer += dt;
      const u = Math.min(1, this.sweepTimer / 0.65);
      this.sweepQuad.position.x += dt * 0.42;
      (this.sweepQuad.material as THREE.MeshBasicMaterial).opacity = Math.sin(u * Math.PI) * 0.65;
      if (u >= 1) {
        this.sweepActive = false;
        this.sweepQuad.visible = false;
      }
    }
  }

  public clear() {
    this.activeHearts.length = 0;
    this.activeSparkles.length = 0;
    this.activeConfetti.length = 0;
    this.pulseActive = false;
    this.pulseDisc.visible = false;
    this.sweepActive = false;
    this.sweepQuad.visible = false;
    this.setTheatricalLighting(0, new THREE.Vector3());
    this.resetAllInstances();
  }
}
