import * as THREE from 'three';

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
  const bowCenter = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    ribbonGoldMat,
  );
  bowCenter.position.set(0, 0.02, -0.01);
  ponytailPivot.add(bowLeft, bowRight, bowCenter);

  geometries.push(headGeo, hairCapGeo, ponytailGeo, bowWingGeo);

  let walkPhase = 0;

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
      rightArmPivot.rotation.z = THREE.MathUtils.damp(
        rightArmPivot.rotation.z,
        isReceivingKey ? 0.18 : -0.14,
        10,
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

      const normalizedSpeed = THREE.MathUtils.clamp(moveSpeed / 5.0, 0, 1.7);

      if (normalizedSpeed > 0.04) {
        const freq = isSprinting ? 13.5 : 9.5;
        walkPhase += delta * freq * Math.min(normalizedSpeed, 1.35);

        const swingAmp =
          (isSprinting ? 0.68 : 0.45) * Math.min(normalizedSpeed, 1.15);
        leftLegPivot.rotation.x = Math.sin(walkPhase) * swingAmp;
        rightLegPivot.rotation.x = -Math.sin(walkPhase) * swingAmp;

        leftArmPivot.rotation.x = -Math.sin(walkPhase) * swingAmp * 0.82;
        rightArmPivot.rotation.x = isReceivingKey
          ? THREE.MathUtils.damp(rightArmPivot.rotation.x, -1.25, 10, delta)
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
          isReceivingKey ? -1.25 : -Math.sin(elapsedTime * 1.8) * 0.03,
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
        ponytailPivot.rotation.y = Math.sin(elapsedTime * 2.0) * 0.06;
        ponytailPivot.rotation.x = THREE.MathUtils.damp(
          ponytailPivot.rotation.x,
          0,
          8,
          delta,
        );
      }
    },
    setFirstPersonVisibility(isFirstPerson: boolean) {
      bodyGroup.visible = !isFirstPerson;
    },
    setShadowVisible(visible: boolean) {
      shadowMesh.visible = visible;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadowTex.dispose();
    },
  };
}
