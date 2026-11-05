import * as THREE from 'three';
import { HarshaAnimState } from './chapter1StateMachine';

export interface HarshaCharacterBundle {
  group: THREE.Group;
  phoneAnchorWorldPos: THREE.Vector3;
  shoulderWorldPos: THREE.Vector3;
  headWorldPos: THREE.Vector3;
  setAnimationState: (next: HarshaAnimState) => void;
  getAnimationState: () => HarshaAnimState;
  update: (
    dt: number,
    elapsed: number,
    moveSpeedRatio: number,
    onFootstep?: (isLeft: boolean, speedRatio: number) => void,
  ) => void;
  dispose: () => void;
}

const _tempPhoneWorld = new THREE.Vector3();
const _tempShoulderWorld = new THREE.Vector3();
const _tempHeadWorld = new THREE.Vector3();

/**
 * Stylized, recognizable 3D character for Harsha in Prologue · Chapter 1: The Ordinary Night.
 * Supports all 8 blended animation states:
 * WALK, IDLE, PHONE_NOTICE, PHONE_TAKE_OUT, PHONE_READ, PHONE_PUT_AWAY, LOOK_BACK, STOP
 */
export function createHarshaStreetCharacter(): HarshaCharacterBundle {
  const group = new THREE.Group();
  group.name = 'HarshaStreetCharacter';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Materials
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6b89c,
      roughness: 0.55,
      metalness: 0.04,
    }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161118,
      roughness: 0.68,
      metalness: 0.12,
    }),
  );
  const outfitTopMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x882946, // Warm muted rose-plum evening kurti/jacket
      roughness: 0.62,
      metalness: 0.06,
    }),
  );
  const scarfMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4a373,
      roughness: 0.7,
      metalness: 0.05,
    }),
  );
  const jeansMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.5,
      metalness: 0.15,
    }),
  );
  const phoneBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.8,
    }),
  );

  // Procedural CanvasTexture for the 3D Smartphone Screen ("Are you home yet?")
  const phoneCanvas = document.createElement('canvas');
  phoneCanvas.width = 256;
  phoneCanvas.height = 512;
  const ctx = phoneCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 256, 512);
    // Lockscreen time
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('10:30', 128, 110);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText('Sat, 13 February', 128, 142);

    // Notification card
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.beginPath();
    ctx.roundRect(18, 210, 220, 110, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MESSAGE · NOW', 34, 242);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText('"Are you home yet?"', 32, 284);
  }
  const phoneTex = new THREE.CanvasTexture(phoneCanvas);
  phoneTex.colorSpace = THREE.SRGBColorSpace;

  const phoneScreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: phoneTex,
      emissive: 0x93c5fd,
      emissiveMap: phoneTex,
      emissiveIntensity: 0.0,
      roughness: 0.15,
    }),
  );

  // Root Pelvis / Hip Pivot (y = 0.88m)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.88, 0);
  group.add(pelvisGroup);

  // Contact shadow disc under feet
  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.36, 24));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x020409,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  group.add(contactShadow);

  // Upper Body / Torso Pivot
  const upperBodyPivot = new THREE.Group();
  upperBodyPivot.position.set(0, 0.04, 0);
  pelvisGroup.add(upperBodyPivot);

  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.16, 0.34, 8, 16)),
    outfitTopMat,
  );
  torsoMesh.position.set(0, 0.24, 0);
  torsoMesh.scale.set(1.05, 1, 0.78);
  torsoMesh.castShadow = true;
  upperBodyPivot.add(torsoMesh);

  // Lower Kurti Flare / Tunic Skirt
  const tunicFlare = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.15, 0.22, 0.32, 16)),
    outfitTopMat,
  );
  tunicFlare.position.set(0, 0.02, 0);
  tunicFlare.scale.set(1.02, 1, 0.82);
  tunicFlare.castShadow = true;
  upperBodyPivot.add(tunicFlare);

  // Cozy Evening Stole / Scarf Collar
  const scarfRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.125, 0.036, 10, 20)),
    scarfMat,
  );
  scarfRing.rotation.x = Math.PI / 2 + 0.1;
  scarfRing.position.set(0, 0.45, 0.01);
  upperBodyPivot.add(scarfRing);

  // Shoulder Camera Target Marker (Over-the-shoulder right side)
  const shoulderMarker = new THREE.Object3D();
  shoulderMarker.position.set(0.24, 0.46, 0.05);
  upperBodyPivot.add(shoulderMarker);

  // Neck & Head Pivot
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.49, 0);
  upperBodyPivot.add(headPivot);

  const neckMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.052, 0.058, 0.09, 12)),
    skinMat,
  );
  neckMesh.position.set(0, 0.03, 0);
  headPivot.add(neckMesh);

  const headMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.135, 20, 20)),
    skinMat,
  );
  headMesh.position.set(0, 0.15, 0);
  headMesh.scale.set(0.95, 1.06, 0.98);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  // Hair Cap & Flowing Back Hair
  const hairCap = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.143, 20, 20)),
    hairMat,
  );
  hairCap.position.set(0, 0.165, 0.015);
  hairCap.scale.set(0.98, 1.05, 1.02);
  headPivot.add(hairCap);

  const hairBackFlow = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.095, 0.24, 8, 14)),
    hairMat,
  );
  hairBackFlow.position.set(0, 0.02, 0.09);
  hairBackFlow.rotation.x = 0.18;
  hairBackFlow.scale.set(1.15, 1.0, 0.65);
  headPivot.add(hairBackFlow);

  // Left Arm Rig
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.2, 0.41, 0);
  upperBodyPivot.add(leftArmPivot);

  const leftUpperArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.045, 0.2, 6, 12)),
    outfitTopMat,
  );
  leftUpperArm.position.set(0, -0.12, 0);
  leftUpperArm.castShadow = true;
  leftArmPivot.add(leftUpperArm);

  const leftForearmPivot = new THREE.Group();
  leftForearmPivot.position.set(0, -0.24, 0);
  leftArmPivot.add(leftForearmPivot);

  const leftForearm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.038, 0.18, 6, 12)),
    skinMat,
  );
  leftForearm.position.set(0, -0.1, 0);
  leftForearmPivot.add(leftForearm);

  // Right Arm Rig (Holds the 3D Smartphone)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.2, 0.41, 0);
  upperBodyPivot.add(rightArmPivot);

  const rightUpperArm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.045, 0.2, 6, 12)),
    outfitTopMat,
  );
  rightUpperArm.position.set(0, -0.12, 0);
  rightUpperArm.castShadow = true;
  rightArmPivot.add(rightUpperArm);

  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -0.24, 0);
  rightArmPivot.add(rightForearmPivot);

  const rightForearm = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.038, 0.18, 6, 12)),
    skinMat,
  );
  rightForearm.position.set(0, -0.1, 0);
  rightForearmPivot.add(rightForearm);

  // 3D Smartphone Group in Right Hand
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(-0.04, -0.21, -0.06);
  phoneGroup.rotation.set(-Math.PI / 3, 0.2, 0);
  phoneGroup.visible = false;
  rightForearmPivot.add(phoneGroup);

  const phoneChassis = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.082, 0.155, 0.01)),
    phoneBodyMat,
  );
  phoneGroup.add(phoneChassis);

  const phoneScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.074, 0.145)),
    phoneScreenMat,
  );
  phoneScreen.position.set(0, 0, 0.0056);
  phoneGroup.add(phoneScreen);

  // Dedicated PointLight so the phone glow illuminates Harsha's hands and face in Beat 02
  const phoneGlowLight = new THREE.PointLight(0x93c5fd, 0, 1.45, 1.6);
  phoneGlowLight.position.set(0, 0.02, 0.09);
  phoneGroup.add(phoneGlowLight);

  // Legs Rig
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.09, -0.02, 0);
  pelvisGroup.add(leftLegPivot);

  const leftLegMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.058, 0.62, 8, 12)),
    jeansMat,
  );
  leftLegMesh.position.set(0, -0.38, 0);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  const leftShoe = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.095, 0.065, 0.19)),
    shoeMat,
  );
  leftShoe.position.set(0, -0.78, -0.035);
  leftShoe.castShadow = true;
  leftLegPivot.add(leftShoe);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.09, -0.02, 0);
  pelvisGroup.add(rightLegPivot);

  const rightLegMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.058, 0.62, 8, 12)),
    jeansMat,
  );
  rightLegMesh.position.set(0, -0.38, 0);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  const rightShoe = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.095, 0.065, 0.19)),
    shoeMat,
  );
  rightShoe.position.set(0, -0.78, -0.035);
  rightShoe.castShadow = true;
  rightLegPivot.add(rightShoe);

  // Animation State Variables
  let currentState: HarshaAnimState = 'IDLE';
  let walkCyclePhase = 0;
  let lastFootstepSign = 0;

  // Blended pose targets
  let curHeadPitch = 0;
  let curHeadYaw = 0;
  let curTorsoYaw = 0;
  let curTorsoPitch = 0;
  let curRightArmPitch = 0;
  let curRightArmRoll = 0;
  let curRightForearmPitch = 0;
  let curRightForearmYaw = 0;
  let curPhoneGlow = 0;

  const phoneAnchorWorldPos = new THREE.Vector3();
  const shoulderWorldPos = new THREE.Vector3();
  const headWorldPos = new THREE.Vector3();

  return {
    group,
    phoneAnchorWorldPos,
    shoulderWorldPos,
    headWorldPos,
    setAnimationState(next: HarshaAnimState) {
      currentState = next;
    },
    getAnimationState() {
      return currentState;
    },
    update(dt, elapsed, moveSpeedRatio, onFootstep) {
      const dampRate = 7.5;

      // 1. Advance walking cycle smoothly (supports gradual slowdown in PHONE_NOTICE)
      const isStriding =
        moveSpeedRatio > 0.03 &&
        (currentState === 'WALK' || currentState === 'PHONE_NOTICE');

      if (isStriding) {
        const strideFreq = 5.4 * Math.max(0.25, moveSpeedRatio);
        walkCyclePhase += dt * strideFreq;

        const sinPhase = Math.sin(walkCyclePhase);
        const currentSign = sinPhase >= 0 ? 1 : -1;
        if (currentSign !== lastFootstepSign && moveSpeedRatio > 0.12) {
          lastFootstepSign = currentSign;
          onFootstep?.(currentSign > 0, moveSpeedRatio);
        }
      } else {
        // Decay walk phase back toward neutral stance
        walkCyclePhase = THREE.MathUtils.damp(
          walkCyclePhase,
          Math.round(walkCyclePhase / Math.PI) * Math.PI,
          6.0,
          dt,
        );
      }

      const legSwing = isStriding
        ? Math.sin(walkCyclePhase) * 0.42 * moveSpeedRatio
        : 0;
      const verticalBob = isStriding
        ? Math.abs(Math.cos(walkCyclePhase)) * 0.028 * moveSpeedRatio
        : Math.sin(elapsed * 1.9) * 0.006;

      pelvisGroup.position.y = 0.88 + verticalBob;
      leftLegPivot.rotation.x = THREE.MathUtils.damp(
        leftLegPivot.rotation.x,
        legSwing,
        10,
        dt,
      );
      rightLegPivot.rotation.x = THREE.MathUtils.damp(
        rightLegPivot.rotation.x,
        -legSwing,
        10,
        dt,
      );

      // Left arm natural counter-swing
      const targetLeftArmPitch = isStriding
        ? -legSwing * 0.65
        : Math.sin(elapsed * 1.4) * 0.02;
      leftArmPivot.rotation.x = THREE.MathUtils.damp(
        leftArmPivot.rotation.x,
        targetLeftArmPitch,
        9,
        dt,
      );
      leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        leftForearmPivot.rotation.x,
        isStriding ? 0.22 : 0.1,
        8,
        dt,
      );

      // 2. Determine Target Upper-Body, Head, and Right-Arm Poses for the 8 States
      let targetHeadPitch = 0;
      let targetHeadYaw = 0;
      let targetTorsoYaw = 0;
      let targetTorsoPitch = isStriding ? 0.035 * moveSpeedRatio : 0;
      let targetRightArmPitch = isStriding ? legSwing * 0.65 : 0;
      let targetRightArmRoll = -0.04;
      let targetRightForearmPitch = isStriding ? 0.22 : 0.1;
      let targetRightForearmYaw = 0;
      let targetPhoneGlow = 0;
      let showPhoneMesh = false;

      switch (currentState) {
        case 'IDLE':
        case 'STOP': {
          targetHeadPitch = Math.sin(elapsed * 1.2) * 0.025;
          targetHeadYaw = Math.cos(elapsed * 0.8) * 0.03;
          break;
        }
        case 'WALK': {
          targetHeadPitch = 0.02;
          targetTorsoYaw = Math.sin(walkCyclePhase) * 0.045 * moveSpeedRatio;
          break;
        }
        case 'PHONE_NOTICE': {
          // Small pause/deceleration and head movement toward right pocket
          targetHeadPitch = -0.26;
          targetHeadYaw = -0.18;
          targetRightArmPitch = -0.15;
          targetRightForearmPitch = 0.45;
          break;
        }
        case 'PHONE_TAKE_OUT': {
          // Hand moves from pocket up in front of chest
          targetHeadPitch = -0.32;
          targetHeadYaw = -0.12;
          targetRightArmPitch = 0.52;
          targetRightArmRoll = 0.12;
          targetRightForearmPitch = 1.15;
          targetRightForearmYaw = 0.32;
          targetPhoneGlow = 0.55;
          showPhoneMesh = true;
          break;
        }
        case 'PHONE_READ': {
          // Head tilts down, eyes toward phone, phone illuminates hands & face
          targetHeadPitch = -0.38;
          targetHeadYaw = -0.08;
          targetTorsoPitch = 0.04;
          targetRightArmPitch = 0.68;
          targetRightArmRoll = 0.16;
          targetRightForearmPitch = 1.28;
          targetRightForearmYaw = 0.38;
          targetPhoneGlow = 1.35;
          showPhoneMesh = true;
          break;
        }
        case 'PHONE_PUT_AWAY': {
          // Phone returns to pocket before walking resumes
          targetHeadPitch = -0.14;
          targetHeadYaw = -0.05;
          targetRightArmPitch = 0.12;
          targetRightForearmPitch = 0.42;
          targetPhoneGlow = 0.15;
          showPhoneMesh = true;
          break;
        }
        case 'LOOK_BACK': {
          // Gentle head turn, followed by upper body toward the approaching/stopped car on her left-rear
          targetHeadYaw = 0.62;
          targetHeadPitch = -0.04;
          targetTorsoYaw = 0.34;
          break;
        }
      }

      // 3. Smoothly damp all joints (Animation Blending)
      curHeadPitch = THREE.MathUtils.damp(curHeadPitch, targetHeadPitch, dampRate, dt);
      curHeadYaw = THREE.MathUtils.damp(curHeadYaw, targetHeadYaw, dampRate, dt);
      curTorsoYaw = THREE.MathUtils.damp(curTorsoYaw, targetTorsoYaw, dampRate * 0.8, dt);
      curTorsoPitch = THREE.MathUtils.damp(curTorsoPitch, targetTorsoPitch, dampRate, dt);

      curRightArmPitch = THREE.MathUtils.damp(
        curRightArmPitch,
        targetRightArmPitch,
        dampRate,
        dt,
      );
      curRightArmRoll = THREE.MathUtils.damp(
        curRightArmRoll,
        targetRightArmRoll,
        dampRate,
        dt,
      );
      curRightForearmPitch = THREE.MathUtils.damp(
        curRightForearmPitch,
        targetRightForearmPitch,
        dampRate,
        dt,
      );
      curRightForearmYaw = THREE.MathUtils.damp(
        curRightForearmYaw,
        targetRightForearmYaw,
        dampRate,
        dt,
      );
      curPhoneGlow = THREE.MathUtils.damp(curPhoneGlow, targetPhoneGlow, 6.0, dt);

      headPivot.rotation.x = curHeadPitch;
      headPivot.rotation.y = curHeadYaw;
      upperBodyPivot.rotation.y = curTorsoYaw;
      upperBodyPivot.rotation.x = curTorsoPitch;

      rightArmPivot.rotation.x = curRightArmPitch;
      rightArmPivot.rotation.z = curRightArmRoll;
      rightForearmPivot.rotation.x = -curRightForearmPitch;
      rightForearmPivot.rotation.y = curRightForearmYaw;

      phoneGroup.visible = showPhoneMesh || curPhoneGlow > 0.05;
      phoneGlowLight.intensity = curPhoneGlow;
      phoneScreenMat.emissiveIntensity = curPhoneGlow * 0.95;

      // Update world anchors for the HybridCameraDirector
      group.updateMatrixWorld(true);
      phoneGroup.getWorldPosition(_tempPhoneWorld);
      phoneAnchorWorldPos.copy(_tempPhoneWorld);

      shoulderMarker.getWorldPosition(_tempShoulderWorld);
      shoulderWorldPos.copy(_tempShoulderWorld);

      headMesh.getWorldPosition(_tempHeadWorld);
      headWorldPos.copy(_tempHeadWorld);
    },
    dispose() {
      phoneTex.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
