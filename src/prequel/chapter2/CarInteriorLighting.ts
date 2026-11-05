import * as THREE from 'three';

export interface CarInteriorLightingBundle {
  lightingGroup: THREE.Group;
  updateLighting: (
    dt: number,
    elapsed: number,
    carWorldZ: number,
    carSpeedMs: number,
    streetlightSpacing: number,
    passingVehicleFlash: number,
    doorOpenRatio: number,
    engineRunning: boolean,
  ) => { passingLightAngle: number; streetlampSweepIntensity: number };
  dispose: () => void;
}

/**
 * Chapter 2: High-Contrast Cinematic Car Interior & Exterior Light Spill System
 *
 * Calibrated for the unified cabin coordinate system where:
 * - Harsha's seated head/eyes are at (x = +0.36, y = 1.30, z = +0.62)
 * - Harsha's hands/lap are at (x = +0.36, y = 0.78, z = +0.32)
 * - Masked Driver is at (x = -0.40, y = 1.18, z = -0.32)
 * - Panoramic Moonroof is at y = 1.64
 */
export function createCarInteriorLighting(): CarInteriorLightingBundle {
  const lightingGroup = new THREE.Group();
  lightingGroup.name = 'Chapter2CarInteriorLighting';

  // 1. Dedicated Warm Cinema Key Light on Harsha (guarantees her face, eyes, and expressions are always crystal-clear)
  const harshaCabinKeyLight = new THREE.PointLight(0xffe4cc, 2.35, 3.8, 1.2);
  harshaCabinKeyLight.position.set(0.08, 1.38, 0.14);
  lightingGroup.add(harshaCabinKeyLight);

  // 2. Cool Moonlight Window Rim Light on Harsha's Hair, Cheekbones & Jhumka Earrings
  const harshaRimLight = new THREE.PointLight(0x93c5fd, 1.55, 3.5, 1.3);
  harshaRimLight.position.set(0.76, 1.44, 0.74);
  lightingGroup.add(harshaRimLight);

  // 3. Passing Sodium-Vapor Streetlight Sweep (glides front-to-back above the windows & moonroof)
  const streetlampSweepLight = new THREE.PointLight(0xf59e0b, 0.0, 6.8, 1.2);
  streetlampSweepLight.position.set(0.75, 1.58, 0.0);
  lightingGroup.add(streetlampSweepLight);

  // 4. Soft Rear-Cabin Ambient Fill (illuminates quilted leather seats, stitching, and lap/hands)
  const cabinAmbientFill = new THREE.PointLight(0x64748b, 1.45, 4.5, 1.2);
  cabinAmbientFill.position.set(-0.15, 1.48, 0.25);
  lightingGroup.add(cabinAmbientFill);

  // 5. Dashboard & Digital Cockpit Glow (illuminates steering wheel, center console, and Masked Driver)
  const dashboardGlowLight = new THREE.PointLight(0x38bdf8, 1.4, 3.2, 1.3);
  dashboardGlowLight.position.set(-0.22, 1.08, -0.68);
  lightingGroup.add(dashboardGlowLight);

  // 6. Oncoming Vehicle Headlight Sweep SpotLight (Scene 3.2 Passing Headlights)
  const oncomingHeadlightFlash = new THREE.SpotLight(
    0xe0f2fe,
    0.0,
    10.0,
    Math.PI / 3.2,
    0.45,
    1.2,
  );
  oncomingHeadlightFlash.position.set(-1.25, 1.35, -2.4);
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0.36, 1.25, 0.62); // Aimed directly at Harsha in the rear-right seat
  lightingGroup.add(flashTarget);
  oncomingHeadlightFlash.target = flashTarget;
  lightingGroup.add(oncomingHeadlightFlash);

  // 7. Rear Door Open Exterior & Dome Courtesy Light Spill (Scene 1.1 & Scene 4.3 / 5.1)
  const doorOpenSpillLight = new THREE.PointLight(0xfde68a, 0.0, 4.8, 1.2);
  doorOpenSpillLight.position.set(1.22, 1.35, 0.58);
  lightingGroup.add(doorOpenSpillLight);

  return {
    lightingGroup,
    updateLighting(
      _dt,
      elapsed,
      carWorldZ,
      carSpeedMs,
      streetlightSpacing,
      passingVehicleFlash,
      doorOpenRatio,
      engineRunning,
    ) {
      const spacing = Math.max(12, streetlightSpacing);
      const distInCycle = ((Math.abs(carWorldZ) % spacing) / spacing) * 2 - 1; // -1 (approaching) -> 0 (under lamp) -> +1 (leaving)
      const lampProximity = Math.max(0, 1 - Math.abs(distInCycle) * 1.45);
      const sweepCurve = Math.pow(lampProximity, 1.5);

      // Sweep light from front windshield (-1.65m) to rear window (+1.65m) as the car drives under each streetlamp
      const sweepZ = distInCycle * 1.65;
      streetlampSweepLight.position.set(0.68, 1.56, sweepZ);

      const stationaryLamp =
        carSpeedMs < 0.4
          ? 2.2 + Math.sin(elapsed * 1.6) * 0.25
          : 0.65;

      const streetlampSweepIntensity = Math.max(
        sweepCurve * 5.2,
        stationaryLamp,
      );
      streetlampSweepLight.intensity = streetlampSweepIntensity;

      // Subtle modulation on Harsha's key light as streetlamps pass
      harshaCabinKeyLight.intensity =
        2.15 + sweepCurve * 1.1 + passingVehicleFlash * 1.4;

      // Dashboard glow responds to engine ignition
      dashboardGlowLight.intensity = engineRunning ? 1.55 : 0.45;

      // Oncoming vehicle headlight sweep
      oncomingHeadlightFlash.intensity = passingVehicleFlash * 7.5;
      oncomingHeadlightFlash.position.z = -2.4 + passingVehicleFlash * 2.2;

      // Door open courtesy & exterior light spill
      doorOpenSpillLight.intensity = doorOpenRatio * 3.8;
      cabinAmbientFill.intensity =
        1.35 + doorOpenRatio * 0.85 + passingVehicleFlash * 0.65;

      const passingLightAngle = distInCycle * Math.PI * 0.5;
      return { passingLightAngle, streetlampSweepIntensity };
    },
    dispose() {
      // Lights are cleaned up with scene disposal
    },
  };
}
