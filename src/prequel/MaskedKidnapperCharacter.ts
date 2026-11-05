import * as THREE from 'three';

export type KidnapperAnimState =
  | 'HIDDEN_IN_CAR'
  | 'STEP_OUT_OF_CAR'
  | 'STALK_WALK'
  | 'GRAB_AND_PULL'
  | 'ENTER_CAR';

export interface MaskedKidnapperBundle {
  group: THREE.Group;
  setAnimationState: (state: KidnapperAnimState) => void;
  getAnimationState: () => KidnapperAnimState;
  update: (
    dt: number,
    elapsed: number,
    stateProgress: number,
    onHeavyStep?: () => void,
  ) => void;
  dispose: () => void;
}

/**
 * Builds a high-polygon (48x48 = 4,608 triangles) vertex-sculpted angular male head
 * encased in a fitted matte-black tactical balaclava:
 * - Chiseled square-tapered jawline & prominent chin
 * - Sharp zygomatic cheekbone ridges & hollow cheek planes
 * - Heavy sculpted brow ridge over recessed orbital eye sockets
 * - Sharp nose bridge & fabric seam contours
 */
function createSculptedMaskedHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.144, 48, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / 0.144;
    const ny = v.y / 0.144;
    const nz = v.z / 0.144;
    const absX = Math.abs(nx);

    v.y *= 1.1;
    v.x *= 0.94;

    // Angular jaw taper below cheekbones
    if (ny < 0.05) {
      const t = Math.min(1, Math.max(0, (0.05 - ny) / 1.05));
      const jawAngle = 1 - (0.34 * Math.pow(t, 1.15) + 0.14 * Math.pow(t, 2.4));
      v.x *= jawAngle;

      if (nz < 0) {
        const chinPull = Math.sin(t * Math.PI) * 0.015 * (1 - absX * 0.65);
        v.z -= chinPull;
      }
      if (nz > 0.15) {
        v.z *= 1 - 0.3 * t;
      }
    }

    // Hollowed cheek planes under the balaclava fabric
    if (ny > -0.45 && ny < 0.04 && nz < -0.1 && absX > 0.34) {
      const hollowY = Math.sin(((ny + 0.45) / 0.49) * Math.PI);
      const hollowX = Math.sin(Math.min(1, (absX - 0.34) / 0.66) * Math.PI);
      v.x -= Math.sign(v.x) * hollowY * hollowX * 0.011;
    }

    // Sharp zygomatic cheekbone ridges
    if (nz < -0.15 && ny > -0.1 && ny < 0.24) {
      const cheekY = 1 - Math.abs(ny - 0.07) / 0.17;
      const cheekX = 1 - Math.abs(absX - 0.6) / 0.35;
      if (cheekY > 0 && cheekX > 0) {
        const zygoma = cheekY * cheekX * 0.011;
        v.x += Math.sign(v.x) * zygoma * 0.85;
        v.z -= zygoma * 0.75;
      }
    }

    // Heavy brow ridge & recessed eye slit cavity
    if (nz < -0.45) {
      if (ny > 0.2 && ny < 0.44 && absX < 0.68) {
        const browT = 1 - Math.abs(ny - 0.31) / 0.12;
        const browSpan = 1 - Math.pow(absX / 0.68, 2);
        if (browT > 0 && browSpan > 0) {
          v.z -= browT * browSpan * 0.012;
        }
      }
      // Sculpted nose bridge under mask
      if (absX < 0.19 && ny > -0.26 && ny < 0.28) {
        const noseWidthT = Math.cos((absX / 0.19) * (Math.PI * 0.5));
        const noseProfileT =
          ny >= -0.14
            ? 1 - THREE.MathUtils.smoothstep(ny, -0.14, 0.28)
            : THREE.MathUtils.smoothstep(ny, -0.26, -0.14);
        v.z -= noseWidthT * noseProfileT * 0.025;
      }
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * High-Polygon Articulated 3D Masked Operative Character for Chapter 1 Beat 05:
 * - 4,608-triangle vertex-sculpted angular balaclava head with sharp brow ridge, cheekbone planes & narrow eye slit
 * - High-subdivision (28x36) tactical jacket with sculpted shoulder pads, collar hood, cargo trousers & laced combat boots
 */
export function createMaskedKidnapperCharacter(): MaskedKidnapperBundle {
  const group = new THREE.Group();
  group.name = 'MaskedKidnapperCharacter';
  group.visible = false;

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

  // High-contrast PBR Materials
  const jacketMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0d1118,
      roughness: 0.52,
      metalness: 0.16,
      clearcoat: 0.18,
      clearcoatRoughness: 0.45,
    }),
  );
  const maskMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x080a0f,
      roughness: 0.76,
      metalness: 0.06,
    }),
  );
  const skinBridgeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc29172,
      roughness: 0.42,
      clearcoat: 0.15,
    }),
  );
  const eyeWhiteMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.08,
      clearcoat: 1.0,
    }),
  );
  const eyePupilMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x090b10,
    }),
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x131822,
      roughness: 0.72,
    }),
  );
  const gloveBootMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x07080c,
      roughness: 0.3,
      metalness: 0.25,
      clearcoat: 0.45,
    }),
  );
  const clothRestraintMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.68,
    }),
  );

  // Soft Ground Shadow Disc
  const shadowDisc = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.44, 40)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x020307,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    ),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  group.add(shadowDisc);

  // ============================================================================
  // 1. PELVIS, SPINE & HIGH-POLYGON TACTICAL TORSO (Taller build ~1.84m)
  // ============================================================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.96, 0);
  group.add(pelvisGroup);

  const pelvisMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.17, 0.165, 0.16, 36, 6)),
    pantsMat,
  );
  pelvisMesh.scale.set(1.08, 1, 0.82);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.06, 0);
  pelvisGroup.add(spinePivot);

  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 0.26, 0);
  spinePivot.add(chestGroup);

  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.195, 0.39, 28, 36)),
    jacketMat,
  );
  torsoMesh.position.set(0, 0.04, 0);
  torsoMesh.scale.set(1.12, 1, 0.82);
  torsoMesh.castShadow = true;
  chestGroup.add(torsoMesh);

  // High Tactical Collar & Hood Ring
  const collarHood = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.145, 0.048, 24, 44)),
    jacketMat,
  );
  collarHood.rotation.x = Math.PI / 2 + 0.15;
  collarHood.position.set(0, 0.28, 0.02);
  chestGroup.add(collarHood);

  // ============================================================================
  // 2. NECK & SCULPTED SHARP BALACLAVA HEAD (4,608 TRIANGLES)
  // ============================================================================
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.31, 0);
  chestGroup.add(neckPivot);

  const neckMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.068, 0.075, 0.11, 28, 4)),
    maskMat,
  );
  neckMesh.position.set(0, 0.04, 0);
  neckPivot.add(neckMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.09, 0);
  neckPivot.add(headPivot);

  const maskedHead = new THREE.Mesh(
    trackGeo(createSculptedMaskedHeadGeometry()),
    maskMat,
  );
  maskedHead.position.set(0, 0.12, 0);
  maskedHead.castShadow = true;
  headPivot.add(maskedHead);

  // Ski-Mask Eye Slit Opening (Facing -Z)
  const eyeSlitStrip = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.015, 0.098, 16, 24)),
    skinBridgeMat,
  );
  eyeSlitStrip.rotation.z = Math.PI / 2;
  eyeSlitStrip.scale.set(1, 1, 0.55);
  eyeSlitStrip.position.set(0, 0.132, -0.128);
  headPivot.add(eyeSlitStrip);

  // Intense Eyes inside the Balaclava Slit
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.013, 20, 20)),
      eyeWhiteMat,
    );
    eyeWhite.position.set(side * 0.038, 0.132, -0.134);
    headPivot.add(eyeWhite);

    const pupil = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.0065, 20)),
      eyePupilMat,
    );
    pupil.position.set(side * 0.038, 0.132, -0.147);
    pupil.rotation.y = Math.PI;
    headPivot.add(pupil);
  }

  // ============================================================================
  // 3. HIGH-POLYGON ARTICULATED ARMS, ELBOWS & GLOVED HANDS
  // ============================================================================
  const createArm = (side: number, hasCloth: boolean) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.245, 0.24, 0);
    chestGroup.add(shoulderPivot);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.056, 0.24, 20, 28)),
      jacketMat,
    );
    upperArm.position.set(0, -0.13, 0);
    upperArm.castShadow = true;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.27, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.048, 0.21, 20, 28)),
      jacketMat,
    );
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const gloveHand = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.028, 0.055, 16, 20)),
      gloveBootMat,
    );
    gloveHand.scale.set(0.75, 1.0, 1.15);
    gloveHand.position.set(0, -0.24, 0);
    elbowPivot.add(gloveHand);

    if (hasCloth) {
      // Soft dark blindfold/cloth held in right gloved hand during capture
      const clothMesh = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.025, 0.065, 16, 20)),
        clothRestraintMat,
      );
      clothMesh.rotation.x = Math.PI / 2;
      clothMesh.position.set(-0.02, -0.26, -0.02);
      elbowPivot.add(clothMesh);
    }

    return { shoulderPivot, elbowPivot };
  };

  const leftArm = createArm(-1, false);
  const rightArm = createArm(1, true);

  // ============================================================================
  // 4. HIGH-POLYGON ARTICULATED LEGS (HIP -> THIGH -> KNEE -> CALF -> BOOT)
  // ============================================================================
  const createLeg = (side: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.11, -0.03, 0);
    pelvisGroup.add(hipPivot);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.074, 0.34, 20, 28)),
      pantsMat,
    );
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.41, 0);
    hipPivot.add(kneePivot);

    const calf = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.06, 0.33, 20, 28)),
      pantsMat,
    );
    calf.position.set(0, -0.2, 0);
    calf.castShadow = true;
    kneePivot.add(calf);

    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.41, 0);
    kneePivot.add(anklePivot);

    const boot = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.048, 0.14, 18, 24)),
      gloveBootMat,
    );
    boot.rotation.x = Math.PI / 2;
    boot.scale.set(1.12, 1.0, 0.92);
    boot.position.set(0, -0.045, -0.045);
    boot.castShadow = true;
    anklePivot.add(boot);

    return { hipPivot, kneePivot, anklePivot };
  };

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

  // ============================================================================
  // 5. ANIMATION BLENDING & CHOREOGRAPHY
  // ============================================================================
  let currentState: KidnapperAnimState = 'HIDDEN_IN_CAR';
  let walkPhase = 0;
  let lastStepSign = 0;

  return {
    group,
    setAnimationState(state) {
      currentState = state;
      group.visible = state !== 'HIDDEN_IN_CAR';
    },
    getAnimationState() {
      return currentState;
    },
    update(dt, elapsed, stateProgress, onHeavyStep) {
      if (currentState === 'HIDDEN_IN_CAR') {
        group.visible = false;
        return;
      }
      group.visible = true;

      let targetPelvisY = 0.96;
      let targetTorsoPitch = 0;
      let targetTorsoYaw = 0;
      let targetHeadPitch = 0;
      let targetHeadYaw = 0;

      let targetLShoulderX = 0;
      let targetLShoulderZ = -0.08;
      let targetLElbowX = 0.22;

      let targetRShoulderX = 0;
      let targetRShoulderZ = 0.08;
      let targetRElbowX = 0.22;

      let targetLHipX = 0;
      let targetLKneeX = 0.06;
      let targetRHipX = 0;
      let targetRKneeX = 0.06;

      if (currentState === 'STEP_OUT_OF_CAR') {
        const riseT = THREE.MathUtils.smoothstep(stateProgress, 0.0, 0.65);
        targetPelvisY = THREE.MathUtils.lerp(0.68, 0.96, riseT);
        targetTorsoPitch = THREE.MathUtils.lerp(-0.42, -0.08, riseT);
        targetLKneeX = THREE.MathUtils.lerp(0.85, 0.08, riseT);
        targetRKneeX = THREE.MathUtils.lerp(0.65, 0.04, riseT);
        targetLHipX = THREE.MathUtils.lerp(0.6, 0.12, riseT);
        targetRHipX = THREE.MathUtils.lerp(0.35, -0.1, riseT);

        targetLShoulderX = THREE.MathUtils.lerp(0.48, 0.12, riseT);
        targetLElbowX = THREE.MathUtils.lerp(0.68, 0.26, riseT);
        targetRShoulderX = 0.15;
        targetRElbowX = 0.45;
      } else if (currentState === 'STALK_WALK') {
        walkPhase += dt * 7.8;
        const sinP = Math.sin(walkPhase);
        const cosP = Math.cos(walkPhase);

        const stepSign = sinP >= 0 ? 1 : -1;
        if (stepSign !== lastStepSign) {
          lastStepSign = stepSign;
          onHeavyStep?.();
        }

        targetPelvisY = 0.94 + Math.abs(cosP) * 0.038;
        targetTorsoPitch = -0.12;
        targetTorsoYaw = sinP * 0.08;
        targetHeadPitch = 0.08;

        targetLHipX = sinP * 0.52;
        targetRHipX = -sinP * 0.52;
        targetLKneeX = Math.max(0, cosP) * 0.68 + 0.08;
        targetRKneeX = Math.max(0, -cosP) * 0.68 + 0.08;

        targetLShoulderX = 0.35 - sinP * 0.32;
        targetRShoulderX = 0.42 + sinP * 0.32;
        targetLElbowX = 0.52;
        targetRElbowX = 0.62;
      } else if (currentState === 'GRAB_AND_PULL') {
        walkPhase += dt * 6.2;
        const sinP = Math.sin(walkPhase);
        const cosP = Math.cos(walkPhase);

        const stepSign = sinP >= 0 ? 1 : -1;
        if (stepSign !== lastStepSign) {
          lastStepSign = stepSign;
          onHeavyStep?.();
        }

        targetPelvisY = 0.91 + Math.abs(cosP) * 0.025;
        targetTorsoPitch = -0.16;
        targetTorsoYaw = Math.sin(elapsed * 5.5) * 0.06;
        targetHeadPitch = -0.12;
        targetHeadYaw = Math.cos(elapsed * 4.2) * 0.08;

        targetLShoulderX = 1.05;
        targetLShoulderZ = 0.25;
        targetLElbowX = 0.72;

        targetRShoulderX = 1.15;
        targetRShoulderZ = -0.28;
        targetRElbowX = 0.82 + Math.sin(elapsed * 6.0) * 0.06;

        targetLHipX = -sinP * 0.38;
        targetRHipX = sinP * 0.38;
        targetLKneeX = 0.25 + Math.max(0, -cosP) * 0.42;
        targetRKneeX = 0.25 + Math.max(0, cosP) * 0.42;
      } else if (currentState === 'ENTER_CAR') {
        const duckT = THREE.MathUtils.clamp(stateProgress, 0, 1);
        targetPelvisY = THREE.MathUtils.lerp(0.88, 0.56, duckT);
        targetTorsoPitch = THREE.MathUtils.lerp(-0.2, -0.58, duckT);
        targetLKneeX = THREE.MathUtils.lerp(0.3, 1.05, duckT);
        targetRKneeX = THREE.MathUtils.lerp(0.3, 1.05, duckT);
        targetLHipX = THREE.MathUtils.lerp(0.2, 0.75, duckT);
        targetRHipX = THREE.MathUtils.lerp(0.2, 0.75, duckT);
        targetLShoulderX = 0.65;
        targetRShoulderX = 0.65;
        targetLElbowX = 0.55;
        targetRElbowX = 0.55;
      }

      const damp = 10.0;
      pelvisGroup.position.y = THREE.MathUtils.damp(
        pelvisGroup.position.y,
        targetPelvisY,
        damp,
        dt,
      );
      spinePivot.rotation.x = THREE.MathUtils.damp(
        spinePivot.rotation.x,
        targetTorsoPitch,
        damp,
        dt,
      );
      spinePivot.rotation.y = THREE.MathUtils.damp(
        spinePivot.rotation.y,
        targetTorsoYaw,
        damp,
        dt,
      );
      headPivot.rotation.x = THREE.MathUtils.damp(
        headPivot.rotation.x,
        targetHeadPitch,
        damp,
        dt,
      );
      headPivot.rotation.y = THREE.MathUtils.damp(
        headPivot.rotation.y,
        targetHeadYaw,
        damp,
        dt,
      );

      // Positive X rotation swings arms and bends elbows FORWARD (-Z)
      leftArm.shoulderPivot.rotation.x = THREE.MathUtils.damp(
        leftArm.shoulderPivot.rotation.x,
        targetLShoulderX,
        damp,
        dt,
      );
      leftArm.shoulderPivot.rotation.z = THREE.MathUtils.damp(
        leftArm.shoulderPivot.rotation.z,
        targetLShoulderZ,
        damp,
        dt,
      );
      leftArm.elbowPivot.rotation.x = THREE.MathUtils.damp(
        leftArm.elbowPivot.rotation.x,
        targetLElbowX,
        damp,
        dt,
      );

      rightArm.shoulderPivot.rotation.x = THREE.MathUtils.damp(
        rightArm.shoulderPivot.rotation.x,
        targetRShoulderX,
        damp,
        dt,
      );
      rightArm.shoulderPivot.rotation.z = THREE.MathUtils.damp(
        rightArm.shoulderPivot.rotation.z,
        targetRShoulderZ,
        damp,
        dt,
      );
      rightArm.elbowPivot.rotation.x = THREE.MathUtils.damp(
        rightArm.elbowPivot.rotation.x,
        targetRElbowX,
        damp,
        dt,
      );

      // Positive hip X lifts thigh forward (-Z); Negative knee X bends calf backward (+Z)
      leftLeg.hipPivot.rotation.x = THREE.MathUtils.damp(
        leftLeg.hipPivot.rotation.x,
        targetLHipX,
        damp,
        dt,
      );
      leftLeg.kneePivot.rotation.x = THREE.MathUtils.damp(
        leftLeg.kneePivot.rotation.x,
        -targetLKneeX,
        damp,
        dt,
      );

      rightLeg.hipPivot.rotation.x = THREE.MathUtils.damp(
        rightLeg.hipPivot.rotation.x,
        targetRHipX,
        damp,
        dt,
      );
      rightLeg.kneePivot.rotation.x = THREE.MathUtils.damp(
        rightLeg.kneePivot.rotation.x,
        -targetRKneeX,
        damp,
        dt,
      );
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
