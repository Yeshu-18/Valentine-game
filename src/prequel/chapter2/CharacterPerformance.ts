import * as THREE from 'three';
import { createHarshaStreetCharacter, HarshaCharacterBundle } from '../HarshaStreetCharacter';
import { SeatedPerformanceState } from './Chapter2StateMachine';

export interface Chapter2CharacterPerformanceBundle {
  harsha: HarshaCharacterBundle;
  seatAnchorGroup: THREE.Group;
  getEyeWorldPosition: (out: THREE.Vector3) => THREE.Vector3;
  getFaceCenterWorldPosition: (out: THREE.Vector3) => THREE.Vector3;
  updatePerformance: (
    dt: number,
    elapsed: number,
    perfState: SeatedPerformanceState,
    stateElapsed: number,
    carLateralAccel: number,
    carLongitudinalAccel: number,
    passingLightAngle: number,
    playerLookYaw: number,
    playerLookPitch: number,
  ) => void;
  dispose: () => void;
}

/**
 * Chapter 2: Grounded AAA Seated & Awakening Character Performance Rig
 *
 * Uses direct `harsha.joints` references (never fragile child indices) and exact anatomical math:
 * - Seated on `rearPassengerSeatAnchor` at (x = +0.36, y = 0.52, z = +0.62) in car space:
 *   - `pelvisGroup` sits at local y = 0.04 -> world y = 0.56m (resting right on the leather seat cushion)
 *   - `leftLeg.hipPivot` & `rightLeg.hipPivot` rotate +1.46 rad (+X lifts thighs forward along -Z onto the cushion)
 *   - `leftLeg.kneePivot` & `rightLeg.kneePivot` rotate -1.48 rad (-X bends calves straight down to the floorboard)
 *   - `tunicFlarePivot` rotates +1.12 rad so her pleated rose-crimson kurti drapes naturally over her seated thighs
 *   - `leftArmPivot` & `rightArmPivot` rotate NEGATIVE X (-0.55 to -0.85 rad) so her arms reach FORWARD onto her lap,
 *     touch the window glass, or test the locked door handle (never backward through the backrest!)
 *   - Her Head & Eyes sit at world y = 1.30m (with 34cm of clear headroom under the y = 1.64m panoramic moonroof)
 */
export function createChapter2CharacterPerformance(): Chapter2CharacterPerformanceBundle {
  const seatAnchorGroup = new THREE.Group();
  seatAnchorGroup.name = 'Chapter2HarshaPerformanceAnchor';

  const harsha = createHarshaStreetCharacter();
  seatAnchorGroup.add(harsha.group);

  // Boost Harsha's attached face beauty lights for rich interior cabin contrast
  harsha.joints.faceBeautyLight.intensity = 1.65;
  harsha.joints.faceBeautyLight.distance = 2.2;
  harsha.joints.faceFillLight.intensity = 0.85;
  harsha.joints.faceFillLight.distance = 1.8;

  let curHeadYaw = 0;
  let curHeadPitch = 0;
  let curHeadRoll = 0;
  let curNeckYaw = 0;
  let curTorsoLeanZ = 0;
  let curTorsoPitchX = 0;
  let curTorsoYawY = 0;

  let curLeftArmX = -0.56;
  let curLeftArmZ = 0.14;
  let curLeftForearmX = -0.92;
  let curLeftForearmY = -0.24;

  let curRightArmX = -0.58;
  let curRightArmZ = -0.14;
  let curRightForearmX = -0.95;
  let curRightForearmY = 0.26;

  return {
    harsha,
    seatAnchorGroup,
    getEyeWorldPosition(out: THREE.Vector3) {
      seatAnchorGroup.updateMatrixWorld(true);
      harsha.joints.headMesh.getWorldPosition(out);
      out.y += 0.015;
      return out;
    },
    getFaceCenterWorldPosition(out: THREE.Vector3) {
      seatAnchorGroup.updateMatrixWorld(true);
      harsha.joints.headMesh.getWorldPosition(out);
      return out;
    },
    updatePerformance(
      dt,
      elapsed,
      perfState,
      stateElapsed,
      carLateralAccel,
      carLongitudinalAccel,
      passingLightAngle,
      playerLookYaw,
      playerLookPitch,
    ) {
      const j = harsha.joints;

      // Run base idle update for subtle eye blinking & hair/earring secondary motion,
      // then apply our exact seated or reclining anatomical pose overrides below.
      harsha.setAnimationState('IDLE');
      harsha.update(dt, elapsed, 0);

      // Hide ground contact shadow disc when seated in the car or lying on the Cell 04 bed
      j.contactShadow.visible = false;

      // ======================================================================
      // CASE A: SCENE 5.2 & 5.3 — RECLINING ON CELL 04 COT & SLOWLY AWAKENING
      // ======================================================================
      if (
        perfState === 'CELL_04_EYES_CLOSED' ||
        perfState === 'CELL_04_SLOW_AWAKENING'
      ) {
        const wakeT =
          perfState === 'CELL_04_EYES_CLOSED'
            ? 0
            : THREE.MathUtils.smoothstep(stateElapsed, 0.8, 5.2);

        // Position Harsha reclining on the Cell 04 mattress with her head on the pillow (z = -0.72)
        // Rotating group by -Math.PI/2 + 0.18 places her head toward -Z (pillow) and feet toward +Z (blanket),
        // with her face looking UP (+Y) toward the warm overhead lamp and camera!
        harsha.group.position.set(0, 0.56, 0.08);
        harsha.group.rotation.set(-Math.PI / 2 + 0.16 + wakeT * 0.22, 0, 0);

        j.pelvisGroup.position.set(0, 0.0, 0);
        j.pelvisGroup.rotation.set(0, 0, 0);

        // Relaxed legs under the blanket
        j.leftLeg.hipPivot.rotation.set(0.12, 0.04, -0.03);
        j.rightLeg.hipPivot.rotation.set(0.12, -0.04, 0.03);
        j.leftLeg.kneePivot.rotation.set(-0.18, 0, 0);
        j.rightLeg.kneePivot.rotation.set(-0.18, 0, 0);
        j.tunicFlarePivot.rotation.set(0.15, 0, 0);

        // Arms resting on the mattress / blanket, lifting slightly as she wakes up
        j.leftArmPivot.rotation.set(-0.28 - wakeT * 0.22, 0, 0.18);
        j.leftForearmPivot.rotation.set(-0.65 - wakeT * 0.25, -0.2, 0);
        j.rightArmPivot.rotation.set(-0.32 - wakeT * 0.28, 0, -0.18);
        j.rightForearmPivot.rotation.set(-0.72 - wakeT * 0.3, 0.25, 0);

        // Upper body & head stir as she wakes up and looks around Cell 04
        const headStirYaw =
          Math.sin(Math.max(0, stateElapsed - 1.2) * 1.1) * 0.22 * wakeT +
          playerLookYaw * 0.45;
        const headStirPitch = -0.12 * wakeT + playerLookPitch * 0.3;

        curHeadYaw = THREE.MathUtils.damp(curHeadYaw, headStirYaw, 4.5, dt);
        curHeadPitch = THREE.MathUtils.damp(curHeadPitch, headStirPitch, 4.5, dt);

        j.upperBodyPivot.rotation.set(
          wakeT * 0.18 + Math.sin(elapsed * 1.8) * 0.015,
          curHeadYaw * 0.2,
          0,
        );
        j.neckPivot.rotation.y = curHeadYaw * 0.35;
        j.headPivot.rotation.set(curHeadPitch, curHeadYaw * 0.65, 0);

        // Controlled Eyelid Opening (closed = +0.40, open = -0.52)
        const closeAmount = 1 - wakeT;
        for (let i = 0; i < 2; i++) {
          j.eyelidMeshes[i].rotation.x = -0.52 + closeAmount * 0.92;
          j.eyeBallGroups[i].rotation.set(
            curHeadPitch * 0.25,
            curHeadYaw * 0.35,
            0,
          );
        }

        seatAnchorGroup.updateMatrixWorld(true);
        j.headMesh.getWorldPosition(harsha.headWorldPos);
        return;
      }

      // ======================================================================
      // CASE B: SEATED IN THE REAR-RIGHT PASSENGER SEAT OF THE MOVING SEDAN
      // ======================================================================
      harsha.group.position.set(0, 0, 0);
      harsha.group.rotation.set(0, 0, 0);

      // Place pelvis right on the leather seat cushion (y = 0.04 relative to seatAnchor at y = 0.52 -> world y = 0.56m)
      j.pelvisGroup.position.set(0, 0.04, 0);
      j.pelvisGroup.rotation.set(0, 0, 0);

      // Bend hips forward (+1.46 rad lifts thighs from -Y to -Z along the seat cushion)
      j.leftLeg.hipPivot.rotation.set(1.46, 0.08, -0.04);
      j.rightLeg.hipPivot.rotation.set(1.46, -0.08, 0.04);

      // Bend knees downward (-1.48 rad bends calves from -Z down to -Y toward the floorboard)
      j.leftLeg.kneePivot.rotation.set(-1.48, 0, 0);
      j.rightLeg.kneePivot.rotation.set(-1.48, 0, 0);
      j.leftLeg.anklePivot.rotation.set(0.06, 0, 0);
      j.rightLeg.anklePivot.rotation.set(0.06, 0, 0);

      // Drape pleated kurti skirt forward over her seated lap
      j.tunicFlarePivot.rotation.set(1.12, 0, 0);
      j.slingBagPivot.position.set(-0.185, -0.04, -0.06);
      j.slingBagPivot.rotation.set(0.45, 0, -0.08);

      // Authored Multi-Beat Seated Performance Targets (Head, Torso & Expressive Arms/Hands)
      let targetHeadYaw = 0;
      let targetHeadPitch = 0.02;
      let targetHeadRoll = 0;
      let targetTorsoPitch = -0.04; // Slight natural recline against the backrest
      let targetTorsoYaw = 0;
      let targetTorsoLeanZ = 0;

      // Default seated arm pose: NEGATIVE X rotates upper arms & forearms FORWARD (-Z) onto her lap!
      let targetLeftArmX = -0.54;
      let targetLeftArmZ = 0.14;
      let targetLeftForearmX = -0.88;
      let targetLeftForearmY = -0.26;

      let targetRightArmX = -0.56;
      let targetRightArmZ = -0.14;
      let targetRightForearmX = -0.92;
      let targetRightForearmY = 0.28;

      let breathRate = 2.2;
      let browLift = 0.002;
      let squintAmount = 0;

      switch (perfState) {
        case 'DOOR_CLOSE_TENSE': {
          // Scene 1.1: Door slams shut on her right (+X). She turns toward the door and reaches her right hand
          // to test the chrome door handle, finding it locked, then pulls back tensely.
          const tryHandleWave = Math.sin(
            THREE.MathUtils.clamp(stateElapsed / 2.6, 0, 1) * Math.PI,
          );
          targetHeadYaw = -0.52 * (0.4 + 0.6 * tryHandleWave);
          targetHeadPitch = 0.08;
          targetHeadRoll = 0.05;
          targetTorsoYaw = -0.18 * tryHandleWave;
          targetTorsoLeanZ = -0.06 * tryHandleWave;

          // Right hand reaches out toward the right door handle (+X, -Z), then returns to her lap
          targetRightArmX = -0.58 - tryHandleWave * 0.42;
          targetRightArmZ = -0.16 - tryHandleWave * 0.38;
          targetRightForearmX = -0.92 + tryHandleWave * 0.25;
          targetRightForearmY = 0.22 - tryHandleWave * 0.35;
          breathRate = 3.0;
          browLift = 0.0045;
          break;
        }
        case 'ADJUST_POSTURE': {
          // Scene 1.2: Engine starts -> she shifts upright, braces her left hand on the seat, and looks forward at the driver
          const shiftWave = Math.sin(Math.min(Math.PI, stateElapsed * 0.95));
          targetTorsoPitch = -0.02 + shiftWave * 0.06;
          targetTorsoLeanZ = shiftWave * 0.05;
          targetHeadYaw = stateElapsed < 2.2 ? 0.22 : 0.32;
          targetHeadPitch = stateElapsed < 1.6 ? 0.16 : -0.02;

          targetLeftArmX = -0.42;
          targetLeftArmZ = 0.24;
          targetLeftForearmX = -0.72;
          break;
        }
        case 'LOOK_FRONT_SEATS': {
          // Scene 1.3: Leans slightly toward the gap between the front seats to study the dashboard & masked driver
          targetTorsoPitch = 0.04;
          targetTorsoLeanZ = 0.08; // Leans slightly left toward the center console
          targetHeadYaw = 0.28 + Math.sin(passingLightAngle) * 0.18;
          targetHeadPitch = -0.02 + Math.cos(elapsed * 0.9) * 0.03;

          // Left hand braces on the center armrest
          targetLeftArmX = -0.62;
          targetLeftArmZ = 0.22;
          targetLeftForearmX = -0.82;
          targetLeftForearmY = -0.1;
          break;
        }
        case 'WATCH_WINDOW_LIGHTS': {
          // Scene 2 (Stages A & B): Looks out the side window & front windshield as streetlights & shops pass;
          // rests her right arm and gold bangle smoothly along the window sill / door ledge (image_f753b93f.png)
          const windowTouch =
            0.5 + 0.5 * Math.sin(elapsed * 0.65 - 0.4);
          targetHeadYaw = -0.52 + Math.sin(passingLightAngle * 0.5) * 0.22;
          targetHeadPitch = -0.04 + Math.sin(elapsed * 0.7) * 0.04;
          targetHeadRoll = -0.05;
          targetTorsoYaw = -0.16;

          // Right arm resting along the door armrest & window ledge with gold bangle catching moonlight
          targetRightArmX = -0.72 - windowTouch * 0.16;
          targetRightArmZ = -0.28 - windowTouch * 0.14;
          targetRightForearmX = -1.14 - windowTouch * 0.12;
          targetRightForearmY = 0.18;
          break;
        }
        case 'TURN_BODY_LEAN': {
          // Scene 3.1: Car takes a turn -> her upper body leans naturally with centrifugal inertia
          // while she locks eyes with the Masked Driver in the rearview mirror
          targetTorsoLeanZ = THREE.MathUtils.clamp(
            carLateralAccel * 0.16,
            -0.18,
            0.18,
          );
          targetTorsoPitch = 0.03;
          targetHeadYaw = stateElapsed > 2.0 ? 0.36 : -0.22;
          targetHeadPitch = -0.04;
          targetHeadRoll = -targetTorsoLeanZ * 0.5;
          breathRate = 2.7;
          browLift = 0.004;

          // Braces left hand firmly against the seat bolster during the turn
          targetLeftArmX = -0.48;
          targetLeftArmZ = 0.28;
          targetLeftForearmX = -0.75;
          break;
        }
        case 'LOOK_AT_DRIVER': {
          // Scene 2.3 (Stage C Isolated Route): Alternates between watching the Masked Driver and the dark tree-lined road
          const lookCycle = Math.sin(stateElapsed * 0.75);
          targetHeadYaw = lookCycle > 0 ? 0.34 : -0.45;
          targetHeadPitch = lookCycle > 0 ? -0.03 : 0.02;
          targetTorsoLeanZ = lookCycle > 0 ? 0.06 : -0.04;
          break;
        }
        case 'HEADLIGHT_BLINK_REACT': {
          // Scene 3.2: Bright oncoming vehicle headlights sweep through the cabin -> she squints & raises her left hand slightly
          const glareWave = Math.sin(
            THREE.MathUtils.clamp((stateElapsed - 1.0) / 3.0, 0, 1) * Math.PI,
          );
          targetHeadYaw = 0.18 - glareWave * 0.35;
          targetHeadPitch = 0.06 * glareWave;
          squintAmount = glareWave * 0.45;

          targetLeftArmX = -0.58 - glareWave * 0.38;
          targetLeftForearmX = -0.95 - glareWave * 0.32;
          targetLeftForearmY = -0.15;
          break;
        }
        case 'DESTINATION_STOP_NOTICE': {
          // Scene 4.1 & 4.2: Vehicle slows into the concealed pillared portico -> leans forward with braking inertia
          targetTorsoPitch =
            0.06 +
            THREE.MathUtils.clamp(-carLongitudinalAccel * 0.035, -0.04, 0.09);
          targetHeadYaw = stateElapsed > 2.2 ? -0.46 : 0.14;
          targetHeadPitch = -0.02;
          browLift = 0.0035;
          break;
        }
        case 'DOOR_OPEN_REACT': {
          // Scene 4.3 & 5.1: Rear-right door unlatches & swings open -> she turns sharply toward the open doorway (+X)
          // and leans away tensely toward the center of the cabin
          targetHeadYaw = -0.64;
          targetHeadPitch = -0.04;
          targetHeadRoll = 0.06;
          targetTorsoYaw = -0.22;
          targetTorsoLeanZ = 0.12;
          targetTorsoPitch = 0.05;
          breathRate = 3.2;
          browLift = 0.005;

          targetRightArmX = -0.72;
          targetRightForearmX = -1.12;
          targetLeftArmX = -0.48;
          targetLeftArmZ = 0.25;
          break;
        }
      }

      // Blend interactive player look offsets (WASD / Mouse Orbit) smoothly with her head & eye gaze
      targetHeadYaw = THREE.MathUtils.clamp(
        targetHeadYaw + playerLookYaw * 0.48,
        -0.85,
        0.78,
      );
      targetHeadPitch = THREE.MathUtils.clamp(
        targetHeadPitch - playerLookPitch * 0.38,
        -0.36,
        0.42,
      );

      // Add inertial vehicle response & natural breathing to torso
      const breathWave = Math.sin(elapsed * breathRate);
      const totalTorsoLeanZ =
        targetTorsoLeanZ +
        THREE.MathUtils.clamp(carLateralAccel * 0.11, -0.15, 0.15);
      const totalTorsoPitchX =
        targetTorsoPitch +
        breathWave * 0.015 +
        THREE.MathUtils.clamp(-carLongitudinalAccel * 0.025, -0.05, 0.08);

      curHeadYaw = THREE.MathUtils.damp(curHeadYaw, targetHeadYaw, 6.0, dt);
      curHeadPitch = THREE.MathUtils.damp(curHeadPitch, targetHeadPitch, 6.0, dt);
      curHeadRoll = THREE.MathUtils.damp(curHeadRoll, targetHeadRoll, 5.5, dt);
      curNeckYaw = THREE.MathUtils.damp(curNeckYaw, curHeadYaw * 0.35, 6.5, dt);
      curTorsoLeanZ = THREE.MathUtils.damp(curTorsoLeanZ, totalTorsoLeanZ, 6.0, dt);
      curTorsoPitchX = THREE.MathUtils.damp(curTorsoPitchX, totalTorsoPitchX, 6.0, dt);
      curTorsoYawY = THREE.MathUtils.damp(
        curTorsoYawY,
        targetTorsoYaw + curHeadYaw * 0.15,
        5.5,
        dt,
      );

      curLeftArmX = THREE.MathUtils.damp(curLeftArmX, targetLeftArmX, 6.5, dt);
      curLeftArmZ = THREE.MathUtils.damp(curLeftArmZ, targetLeftArmZ, 6.5, dt);
      curLeftForearmX = THREE.MathUtils.damp(curLeftForearmX, targetLeftForearmX, 6.5, dt);
      curLeftForearmY = THREE.MathUtils.damp(curLeftForearmY, targetLeftForearmY, 6.5, dt);

      curRightArmX = THREE.MathUtils.damp(curRightArmX, targetRightArmX, 6.5, dt);
      curRightArmZ = THREE.MathUtils.damp(curRightArmZ, targetRightArmZ, 6.5, dt);
      curRightForearmX = THREE.MathUtils.damp(curRightForearmX, targetRightForearmX, 6.5, dt);
      curRightForearmY = THREE.MathUtils.damp(curRightForearmY, targetRightForearmY, 6.5, dt);

      // Apply Torso, Neck, Head & Expressive Eye/Brow Rotations
      j.upperBodyPivot.rotation.set(curTorsoPitchX, curTorsoYawY, curTorsoLeanZ);
      j.chestGroup.scale.set(
        1 + breathWave * 0.012,
        1 + breathWave * 0.014,
        1 + breathWave * 0.018,
      );
      j.neckPivot.rotation.set(curHeadPitch * 0.25, curNeckYaw, 0);
      j.headPivot.rotation.set(
        curHeadPitch * 0.75,
        curHeadYaw * 0.65,
        curHeadRoll,
      );

      // Apply Forward-Seated Arms & Hands on Lap
      const handMicroBreath = Math.sin(elapsed * 2.1) * 0.02;
      j.leftArmPivot.rotation.set(curLeftArmX + handMicroBreath, 0, curLeftArmZ);
      j.leftForearmPivot.rotation.set(curLeftForearmX, curLeftForearmY, 0);
      j.leftWristGroup.rotation.set(0.12, 0, 0);

      j.rightArmPivot.rotation.set(curRightArmX - handMicroBreath, 0, curRightArmZ);
      j.rightForearmPivot.rotation.set(curRightForearmX, curRightForearmY, 0);
      j.rightWristGroup.rotation.set(0.14, 0, 0);

      // Apply Eye Saccades, Eyebrow Expression & Headlight Glare Squint
      const eyeSaccadeX = Math.sin(elapsed * 1.7) * 0.04 + curHeadYaw * 0.22;
      const eyeSaccadeY = Math.cos(elapsed * 1.3) * 0.025 + curHeadPitch * 0.2;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        j.eyeBallGroups[i].rotation.set(eyeSaccadeY, eyeSaccadeX, 0);
        j.eyebrowPivots[i].position.y = 0.148 + browLift;
        j.eyebrowPivots[i].rotation.z = side * browLift * 5.0;
        if (squintAmount > 0.01) {
          j.eyelidMeshes[i].rotation.x = Math.max(
            j.eyelidMeshes[i].rotation.x,
            -0.52 + squintAmount * 0.85,
          );
        }
      }

      // Secondary Hair & Jhumka Earring Sway from Car Turns
      for (const ep of j.earringPivots) {
        ep.rotation.z = -curTorsoLeanZ * 1.6 + Math.sin(elapsed * 2.8) * 0.04;
      }

      // Refresh exact world head position for the Camera Director
      seatAnchorGroup.updateMatrixWorld(true);
      j.headMesh.getWorldPosition(harsha.headWorldPos);
    },
    dispose() {
      harsha.dispose();
    },
  };
}
