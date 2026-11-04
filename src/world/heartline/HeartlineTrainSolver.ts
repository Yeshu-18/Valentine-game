import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import {
  HeartlineTrackSpline,
  HeartlineTrackFrame,
  createEmptyTrackFrame,
} from './HeartlineTrackSpline';

export type HeartlineRidePhase =
  | 'PRE_RIDE_PARKED'
  | 'PRE_RIDE_CIRCUIT'
  | 'DOCKING'
  | 'BOARDING'
  | 'RIDING'
  | 'UNBOARDING';

export interface BoardingCueEvents {
  restraintLockedJustNow: boolean;
  consoleChimeJustNow: boolean;
  brakeReleaseJustNow: boolean;
  dispatchJustNow: boolean;
  rideCompleteJustNow: boolean;
}

export interface HeartlineTrainSolver {
  readonly group: THREE.Group;
  readonly carGroups: readonly THREE.Group[];
  readonly leadCarFrame: HeartlineTrackFrame;
  getPhase: () => HeartlineRidePhase;
  getSpeed: () => number;
  getLeadS: () => number;
  getLeadU: () => number;
  getBoardingTimer: () => number;
  getSeatSettleOffset: () => number;
  getSeatEyeWorldPosition: (outPos: THREE.Vector3) => THREE.Vector3;
  setRiderViewMode: (isRiding: boolean) => void;
  syncRiderNoseToCamera: (
    camPos: THREE.Vector3,
    lookTarget: THREE.Vector3,
    camUp: THREE.Vector3
  ) => void;
  requestDockForTicket: () => void;
  startBoarding: () => void;
  cancelRideToStation: () => void;
  consumeCueEvents: () => BoardingCueEvents;
  getUnderwaterSpeedFactor: () => number;
  setUnderwaterSpeedFactor: (factor: number) => void;
  update: (dt: number, elapsedTime: number) => void;
}

const CAR_COUNT = 4;
const CAR_SPACING = 3.15; // meters between articulated car centers
export const RAIL_GAUGE_HALF = 0.56; // half distance between left and right sapphire rails
export const RAIL_HEIGHT_OFFSET = 0.24; // height of tubular rails above spine center

const _scratchBasisMat = new THREE.Matrix4();
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchEyeLocal = new THREE.Vector3();
const _scratchCouplerA = new THREE.Vector3();
const _scratchCouplerB = new THREE.Vector3();

function createHeartEmblemShape(scale = 1): THREE.Shape {
  const s = scale;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.22 * s);
  shape.bezierCurveTo(-0.28 * s, -0.02 * s, -0.32 * s, 0.22 * s, -0.15 * s, 0.28 * s);
  shape.bezierCurveTo(-0.04 * s, 0.32 * s, 0, 0.20 * s, 0, 0.14 * s);
  shape.bezierCurveTo(0, 0.20 * s, 0.04 * s, 0.32 * s, 0.15 * s, 0.28 * s);
  shape.bezierCurveTo(0.32 * s, 0.22 * s, 0.28 * s, -0.02 * s, 0, -0.22 * s);
  return shape;
}

export function createHeartlineTrainSolver(
  spline: HeartlineTrackSpline,
  tracker: ResourceTracker
): HeartlineTrainSolver {
  const group = new THREE.Group();
  group.name = 'HeartlineTrainGroup';

  // Shared Palette Materials (70% Deep Sapphire Blue, 20% Pearl White, 10% Cyan Crystal + Champagne Gold)
  const sapphireShellMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.22,
      metalness: 0.45,
    })
  );
  const pearlTrimMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.26,
      metalness: 0.18,
    })
  );
  const champagneGoldMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xd8b467,
      roughness: 0.28,
      metalness: 0.72,
    })
  );
  const cyanCrystalMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.95,
      roughness: 0.15,
      metalness: 0.2,
    })
  );
  const headlightMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
      roughness: 0.1,
      metalness: 0.1,
    })
  );
  const royalSeatMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.48,
      metalness: 0.12,
    })
  );
  const restraintMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.25,
    })
  );
  const bogieChassisMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.68,
    })
  );
  const wheelAlloyMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.82,
    })
  );
  const wheelTireMat = tracker.track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.35,
    })
  );

  // Shared Geometries for Bogies & Wheels
  const roadWheelGeo = tracker.track(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14));
  roadWheelGeo.rotateZ(Math.PI / 2);
  const wheelHubGeo = tracker.track(new THREE.CylinderGeometry(0.10, 0.10, 0.095, 10));
  wheelHubGeo.rotateZ(Math.PI / 2);
  const guideWheelGeo = tracker.track(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12));
  const upstopWheelGeo = tracker.track(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12));
  upstopWheelGeo.rotateZ(Math.PI / 2);
  const bogieSideFrameGeo = tracker.track(new THREE.BoxGeometry(0.12, 0.24, 0.62));
  const bogieCrossBeamGeo = tracker.track(new THREE.BoxGeometry(RAIL_GAUGE_HALF * 2 + 0.18, 0.10, 0.16));
  const suspensionStrutGeo = tracker.track(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8));

  function buildTwinAxleBogie(): THREE.Group {
    const bogie = new THREE.Group();
    const crossBeam = new THREE.Mesh(bogieCrossBeamGeo, bogieChassisMat);
    crossBeam.position.set(0, RAIL_HEIGHT_OFFSET + 0.14, 0);
    bogie.add(crossBeam);

    for (const side of [-1, 1]) {
      const railX = side * RAIL_GAUGE_HALF;
      const sideFrame = new THREE.Mesh(bogieSideFrameGeo, bogieChassisMat);
      sideFrame.position.set(railX, RAIL_HEIGHT_OFFSET + 0.02, 0);
      bogie.add(sideFrame);

      const strut = new THREE.Mesh(suspensionStrutGeo, champagneGoldMat);
      strut.position.set(railX * 0.82, RAIL_HEIGHT_OFFSET + 0.22, 0);
      bogie.add(strut);

      // Twin axles (front and rear road wheels on top of the rail + upstop wheel + side guide wheel)
      for (const axleZ of [-0.19, 0.19]) {
        const roadTire = new THREE.Mesh(roadWheelGeo, wheelTireMat);
        roadTire.position.set(railX, RAIL_HEIGHT_OFFSET + 0.20, axleZ);
        bogie.add(roadTire);

        const roadHub = new THREE.Mesh(wheelHubGeo, wheelAlloyMat);
        roadHub.position.set(railX, RAIL_HEIGHT_OFFSET + 0.20, axleZ);
        bogie.add(roadHub);

        const upstop = new THREE.Mesh(upstopWheelGeo, wheelAlloyMat);
        upstop.position.set(railX, RAIL_HEIGHT_OFFSET - 0.14, axleZ);
        bogie.add(upstop);
      }

      const guideWheel = new THREE.Mesh(guideWheelGeo, wheelAlloyMat);
      guideWheel.position.set(railX - side * 0.14, RAIL_HEIGHT_OFFSET + 0.02, 0);
      bogie.add(guideWheel);
    }

    return bogie;
  }

  // Shared Seat & Restraint Geometries
  const seatCushionGeo = tracker.track(new THREE.BoxGeometry(0.46, 0.12, 0.48));
  const seatBackGeo = tracker.track(new THREE.BoxGeometry(0.44, 0.68, 0.12));
  const headrestGeo = tracker.track(new THREE.BoxGeometry(0.34, 0.22, 0.14));
  const bolsterGeo = tracker.track(new THREE.BoxGeometry(0.08, 0.56, 0.22));
  const restraintShoulderGeo = tracker.track(new THREE.CylinderGeometry(0.04, 0.045, 0.54, 10));
  const restraintLapGeo = tracker.track(new THREE.BoxGeometry(0.38, 0.08, 0.12));
  const grabBarGeo = tracker.track(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8));
  grabBarGeo.rotateZ(Math.PI / 2);

  const restraintGroups: THREE.Group[] = [];
  const carGroups: THREE.Group[] = [];
  const carFrames: HeartlineTrackFrame[] = [];

  for (let c = 0; c < CAR_COUNT; c++) {
    carFrames.push(createEmptyTrackFrame());
    const car = new THREE.Group();
    car.name = `HeartlineCar_${c}`;

    // Front and Rear Twin-Axle Wheel Bogies hugging the rails
    const frontBogie = buildTwinAxleBogie();
    frontBogie.position.set(0, 0, 0.88);
    car.add(frontBogie);

    const rearBogie = buildTwinAxleBogie();
    rearBogie.position.set(0, 0, -0.88);
    car.add(rearBogie);

    // Lower Chassis Floor Deck
    const floorDeckGeo = tracker.track(new THREE.BoxGeometry(1.48, 0.18, 2.45));
    const floorDeck = new THREE.Mesh(floorDeckGeo, bogieChassisMat);
    floorDeck.position.set(0, 0.62, 0);
    car.add(floorDeck);

    // Sculpted Pearl-White Outer Lower Sill & Wheel Arch Fairing
    const pearlSillGeo = tracker.track(new THREE.BoxGeometry(1.62, 0.26, 2.52));
    const pearlSill = new THREE.Mesh(pearlSillGeo, pearlTrimMat);
    pearlSill.position.set(0, 0.78, 0.02);
    car.add(pearlSill);

    // Deep Sapphire Blue Side Body Panels (70% Sapphire Blue)
    for (const side of [-1, 1]) {
      const sidePanelGeo = tracker.track(new THREE.BoxGeometry(0.14, 0.52, 2.36));
      const sidePanel = new THREE.Mesh(sidePanelGeo, sapphireShellMat);
      sidePanel.position.set(side * 0.76, 1.08, -0.04);
      car.add(sidePanel);

      // Pearl-White Upper Swept Coaming
      const upperCoamingGeo = tracker.track(new THREE.BoxGeometry(0.16, 0.18, 2.15));
      const upperCoaming = new THREE.Mesh(upperCoamingGeo, pearlTrimMat);
      upperCoaming.position.set(side * 0.77, 1.34, -0.15);
      upperCoaming.rotation.x = -0.08;
      car.add(upperCoaming);

      // Champagne-Gold Pinstripe Accent along the flank
      const goldStripeGeo = tracker.track(new THREE.BoxGeometry(0.17, 0.045, 2.28));
      const goldStripe = new THREE.Mesh(goldStripeGeo, champagneGoldMat);
      goldStripe.position.set(side * 0.77, 0.94, -0.02);
      car.add(goldStripe);
    }

    // Rear Swept Tail Fairing on every car
    const rearTailGeo = tracker.track(new THREE.BoxGeometry(1.56, 0.68, 0.36));
    const rearTail = new THREE.Mesh(rearTailGeo, pearlTrimMat);
    rearTail.position.set(0, 1.18, -1.12);
    rearTail.rotation.x = -0.24;
    car.add(rearTail);

    const rearBlueInsetGeo = tracker.track(new THREE.BoxGeometry(1.24, 0.48, 0.14));
    const rearBlueInset = new THREE.Mesh(rearBlueInsetGeo, sapphireShellMat);
    rearBlueInset.position.set(0, 1.22, -1.25);
    rearBlueInset.rotation.x = -0.24;
    car.add(rearBlueInset);

    if (c === 0) {
      // Lead Car (Car 0): Sculpted Aerodynamic Nose Cone + Glowing Crystal Heart Emblem + V-Headlights
      const noseHoodGeo = tracker.track(new THREE.CylinderGeometry(0.42, 0.78, 1.35, 16));
      noseHoodGeo.scale(1.0, 0.56, 1.0);
      noseHoodGeo.rotateX(Math.PI / 2 - 0.28);
      const noseHood = new THREE.Mesh(noseHoodGeo, sapphireShellMat);
      noseHood.position.set(0, 1.02, 1.18);
      car.add(noseHood);

      // Pearl-White Front Splitter Chin & Side Cheeks
      const splitterGeo = tracker.track(new THREE.BoxGeometry(1.42, 0.16, 0.92));
      const splitter = new THREE.Mesh(splitterGeo, pearlTrimMat);
      splitter.position.set(0, 0.74, 1.28);
      splitter.rotation.x = 0.18;
      car.add(splitter);

      // Champagne-Gold Hood Vent & Rim Trim
      const hoodVentGeo = tracker.track(new THREE.BoxGeometry(0.58, 0.08, 0.36));
      const hoodVent = new THREE.Mesh(hoodVentGeo, champagneGoldMat);
      hoodVent.position.set(0, 1.28, 0.72);
      hoodVent.rotation.x = 0.25;
      car.add(hoodVent);

      // Center Recessed Glowing Sapphire-Cyan Crystal Heart Emblem on Lead Nose
      const heartShape = createHeartEmblemShape(0.85);
      const heartExtrudeGeo = tracker.track(
        new THREE.ExtrudeGeometry(heartShape, {
          depth: 0.06,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 2,
        })
      );
      heartExtrudeGeo.rotateX(-Math.PI / 2 + 0.35);
      const heartEmblem = new THREE.Mesh(heartExtrudeGeo, cyanCrystalMat);
      heartEmblem.position.set(0, 1.16, 1.32);
      car.add(heartEmblem);

      // Gold Heart Bezel Frame
      const heartFrameGeo = tracker.track(new THREE.TorusGeometry(0.22, 0.022, 8, 20));
      heartFrameGeo.rotateX(Math.PI / 2 - 0.35);
      const heartFrame = new THREE.Mesh(heartFrameGeo, champagneGoldMat);
      heartFrame.position.set(0, 1.15, 1.31);
      car.add(heartFrame);

      // Twin V-Shaped Electric-Blue LED Headlight Strips
      for (const side of [-1, 1]) {
        const ledStripGeo = tracker.track(new THREE.BoxGeometry(0.42, 0.06, 0.12));
        const ledStrip = new THREE.Mesh(ledStripGeo, headlightMat);
        ledStrip.position.set(side * 0.44, 0.94, 1.56);
        ledStrip.rotation.y = -side * 0.42;
        ledStrip.rotation.z = side * 0.24;
        car.add(ledStrip);
      }

      // Cockpit Dashboard & Console Indicator Light
      const dashGeo = tracker.track(new THREE.BoxGeometry(1.26, 0.28, 0.32));
      const dash = new THREE.Mesh(dashGeo, bogieChassisMat);
      dash.position.set(0, 1.18, 0.46);
      car.add(dash);

      const indicatorGeo = tracker.track(new THREE.SphereGeometry(0.045, 10, 10));
      const indicator = new THREE.Mesh(indicatorGeo, cyanCrystalMat);
      indicator.position.set(0, 1.34, 0.42);
      car.add(indicator);
    } else {
      // Mid/Rear Cars (Cars 1–3): Sleek Front Cowling Nose + Hitch Coupler Bar
      const midCowlingGeo = tracker.track(new THREE.BoxGeometry(1.44, 0.46, 0.56));
      const midCowling = new THREE.Mesh(midCowlingGeo, sapphireShellMat);
      midCowling.position.set(0, 1.02, 0.96);
      midCowling.rotation.x = 0.28;
      car.add(midCowling);

      const couplerGeo = tracker.track(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 8));
      couplerGeo.rotateX(Math.PI / 2);
      const coupler = new THREE.Mesh(couplerGeo, bogieChassisMat);
      coupler.position.set(0, 0.58, 1.42);
      car.add(coupler);
    }

    // 2 Ergonomic High-Backed Royal-Blue Bucket Seats per Car (8 Seats Total)
    for (const seatSide of [-1, 1]) {
      const seatX = seatSide * 0.36;
      const seatZ = -0.18;

      const cushion = new THREE.Mesh(seatCushionGeo, royalSeatMat);
      cushion.position.set(seatX, 0.86, seatZ + 0.08);
      car.add(cushion);

      const seatBack = new THREE.Mesh(seatBackGeo, royalSeatMat);
      seatBack.position.set(seatX, 1.24, seatZ - 0.16);
      seatBack.rotation.x = -0.14;
      car.add(seatBack);

      const headrest = new THREE.Mesh(headrestGeo, sapphireShellMat);
      headrest.position.set(seatX, 1.66, seatZ - 0.21);
      headrest.rotation.x = -0.10;
      car.add(headrest);

      for (const bolsterSide of [-1, 1]) {
        const bolster = new THREE.Mesh(bolsterGeo, sapphireShellMat);
        bolster.position.set(seatX + bolsterSide * 0.21, 1.22, seatZ - 0.08);
        bolster.rotation.x = -0.14;
        car.add(bolster);
      }

      // Animated Over-the-Shoulder Restraint (pivots around top behind shoulders)
      const restraintPivot = new THREE.Group();
      restraintPivot.position.set(seatX, 1.54, seatZ - 0.12);

      for (const armSide of [-1, 1]) {
        const shoulderArm = new THREE.Mesh(restraintShoulderGeo, restraintMat);
        shoulderArm.position.set(armSide * 0.14, -0.22, 0.16);
        shoulderArm.rotation.x = 0.52;
        restraintPivot.add(shoulderArm);
      }

      const lapBar = new THREE.Mesh(restraintLapGeo, restraintMat);
      lapBar.position.set(0, -0.44, 0.32);
      restraintPivot.add(lapBar);

      const grabBar = new THREE.Mesh(grabBarGeo, champagneGoldMat);
      grabBar.position.set(0, -0.36, 0.36);
      restraintPivot.add(grabBar);

      car.add(restraintPivot);
      restraintGroups.push(restraintPivot);
    }

    group.add(car);
    carGroups.push(car);
  }

  // Dedicated First-Person Short Blue Nose Tip (shown ONLY while riding, anchored low at the very bottom-center of the base coaster view
  // so zero seats, headrests, restraints, or side panels can ever block the view — and shortened so it barely peeks at the bottom edge!)
  const riderNoseTipGroup = new THREE.Group();
  riderNoseTipGroup.name = 'HeartlineRiderTinyNoseTip';
  riderNoseTipGroup.visible = false;

  const tinyNoseGeo = tracker.track(new THREE.CylinderGeometry(0.13, 0.25, 0.22, 16));
  tinyNoseGeo.scale(0.92, 0.34, 1.0);
  tinyNoseGeo.rotateX(Math.PI / 2 - 0.14);
  const tinyNoseMesh = new THREE.Mesh(tinyNoseGeo, sapphireShellMat);
  tinyNoseMesh.position.set(0, -0.43, 0.65);
  riderNoseTipGroup.add(tinyNoseMesh);

  const tinyPearlRimGeo = tracker.track(new THREE.BoxGeometry(0.32, 0.035, 0.14));
  const tinyPearlRim = new THREE.Mesh(tinyPearlRimGeo, pearlTrimMat);
  tinyPearlRim.position.set(0, -0.45, 0.68);
  riderNoseTipGroup.add(tinyPearlRim);

  const tinyHeartShape = createHeartEmblemShape(0.22);
  const tinyHeartGeo = tracker.track(
    new THREE.ExtrudeGeometry(tinyHeartShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
    })
  );
  tinyHeartGeo.rotateX(-Math.PI / 2 + 0.22);
  const tinyHeartMesh = new THREE.Mesh(tinyHeartGeo, cyanCrystalMat);
  tinyHeartMesh.position.set(0, -0.385, 0.67);
  riderNoseTipGroup.add(tinyHeartMesh);

  group.add(riderNoseTipGroup);

  function setRiderViewMode(isRiding: boolean): void {
    // When the player sits/rides, hide all 4 cars' seats, headrests, restraints, side walls & bogies
    // so NOTHING can ever obstruct the camera view, leaving ONLY the tiny blue nose tip!
    for (let c = 0; c < CAR_COUNT; c++) {
      carGroups[c].visible = !isRiding;
    }
    riderNoseTipGroup.visible = isRiding;
  }

  function syncRiderNoseToCamera(
    camPos: THREE.Vector3,
    lookTarget: THREE.Vector3,
    camUp: THREE.Vector3
  ): void {
    if (!riderNoseTipGroup.visible) return;
    riderNoseTipGroup.position.copy(camPos);
    _scratchForward.copy(lookTarget).sub(camPos).normalize();
    _scratchUp.copy(camUp).normalize();
    _scratchRight.crossVectors(_scratchUp, _scratchForward).normalize();
    _scratchUp.crossVectors(_scratchForward, _scratchRight).normalize();
    _scratchBasisMat.makeBasis(_scratchRight, _scratchUp, _scratchForward);
    riderNoseTipGroup.quaternion.setFromRotationMatrix(_scratchBasisMat);
  }

  // Kinematics State
  let phase: HeartlineRidePhase = 'PRE_RIDE_PARKED';
  let leadS = 0; // Station center is s = 0
  let speed = 0;
  let preRideTimer = 4.0;
  let boardingTimer = 0;
  let seatSettleOffset = 0;
  let restraintOpenAngle = -0.78; // Open upward in station
  let underwaterSpeedFactor = 0.72; // Adjustable underwater speed multiplier (slower dreamy pace)

  function getUnderwaterSpeedFactor(): number {
    return underwaterSpeedFactor;
  }
  function setUnderwaterSpeedFactor(factor: number): void {
    underwaterSpeedFactor = Math.max(0.2, Math.min(2.0, factor));
  }

  // Discrete audio/choreography cues during Boarding & Station Return
  let firedRestraintLock = false;
  let firedConsoleChime = false;
  let firedBrakeRelease = false;
  let firedDispatch = false;
  const cueEvents: BoardingCueEvents = {
    restraintLockedJustNow: false,
    consoleChimeJustNow: false,
    brakeReleaseJustNow: false,
    dispatchJustNow: false,
    rideCompleteJustNow: false,
  };

  const leadCarFrame = createEmptyTrackFrame();

  function updateCarTransforms(): void {
    for (let c = 0; c < CAR_COUNT; c++) {
      // Lead car is at leadS; trailing cars are spaced behind by CAR_SPACING meters
      const carS = leadS - c * CAR_SPACING;
      const frame = spline.evaluateAtS(carS, carFrames[c]);
      if (c === 0) {
        leadCarFrame.u = frame.u;
        leadCarFrame.s = frame.s;
        leadCarFrame.pos.copy(frame.pos);
        leadCarFrame.tangent.copy(frame.tangent);
        leadCarFrame.normal.copy(frame.normal);
        leadCarFrame.binormal.copy(frame.binormal);
        leadCarFrame.rollRad = frame.rollRad;
        leadCarFrame.zone = frame.zone;
      }

      const carObj = carGroups[c];
      carObj.position.copy(frame.pos);

      // Local Car axes: +Z is forward along tangent, +Y is normal (up from track), +X is right (-binormal)
      _scratchForward.copy(frame.tangent).normalize();
      _scratchUp.copy(frame.normal).normalize();
      _scratchRight.crossVectors(_scratchUp, _scratchForward).normalize();
      _scratchUp.crossVectors(_scratchForward, _scratchRight).normalize();

      _scratchBasisMat.makeBasis(_scratchRight, _scratchUp, _scratchForward);
      carObj.quaternion.setFromRotationMatrix(_scratchBasisMat);
    }

    for (let i = 0; i < restraintGroups.length; i++) {
      restraintGroups[i].rotation.x = restraintOpenAngle;
    }
  }

  // Compute piecewise target speed or gravity kinematics for a given normalized u
  function stepTrackPhysics(dt: number): boolean {
    const u = spline.sToU(leadS);
    const prevY = leadCarFrame.pos.y;

    if (u < 0.09) {
      // Zone 1 & 2: Station & Departure — smooth drive tire roll-out to 6.4 m/s
      const targetV = 6.4;
      speed = THREE.MathUtils.lerp(speed, targetV, Math.min(1, dt * 2.2));
    } else if (u < 0.215) {
      // Zone 3: 45m Sapphire Lift Hill — steady chain lift climb at 6.2 m/s
      const targetV = 6.2;
      speed = THREE.MathUtils.lerp(speed, targetV, Math.min(1, dt * 3.5));
    } else if (u < 0.24) {
      // Zone 4A: Crest Approach — smooth trim deceleration to 2.25 m/s
      const targetV = 2.25;
      speed = THREE.MathUtils.lerp(speed, targetV, Math.min(1, dt * 3.8));
    } else if (u < 0.31) {
      // Zone 4B: 45m Love Reveal Crest — holds steady 2.25 m/s creep for ~2.0s over the "I LOVE YOU ❤️" meadow
      const targetV = 2.25;
      speed = THREE.MathUtils.lerp(speed, targetV, Math.min(1, dt * 5.0));
    } else if (u < 0.92) {
      // Zones 5–10: Gravity + Drag Energy Solver across Major Drop, Castle Flyby, Crystal Tunnel, Heartline & Helix
      const nextPreviewFrame = spline.evaluateAtS(leadS + Math.max(1.5, speed * dt), carFrames[1]);
      const dh = prevY - nextPreviewFrame.pos.y;
      const g = 9.81 * 1.45; // Coaster scale gravity feel
      const vSq = Math.max(64.0, speed * speed + 2.0 * g * dh);
      let rawV = Math.sqrt(vSq);

      // Gentle zone speed shaping for cinematic pacing
      if (u >= 0.44 && u < 0.53) {
        // Castle Flyby: smooth sweeping 20–21 m/s
        rawV = THREE.MathUtils.lerp(rawV, 20.5, Math.min(1, dt * 2.0));
      } else if (u >= 0.53 && u < 0.565) {
        // T+00s Transition In: Crystal Tunnel plunges into ocean water, decelerating smoothly into underwater glide
        rawV = THREE.MathUtils.lerp(rawV, 8.8 * underwaterSpeedFactor, Math.min(1, dt * 3.2));
      } else if (u >= 0.565 && u < 0.70) {
        // T+03s..T+18s Underwater Coral Reef (First Reef -> Living Reef -> Coral Passage -> Heart Reef): dreamy cruise
        rawV = THREE.MathUtils.lerp(rawV, 7.8 * underwaterSpeedFactor, Math.min(1, dt * 3.8));
      } else if (u >= 0.70 && u < 0.755) {
        // T+23s Underwater Heartline Element ("I LOVE YOU ❤️"): romantic showcase glide
        rawV = THREE.MathUtils.lerp(rawV, 7.2 * underwaterSpeedFactor, Math.min(1, dt * 4.0));
      } else if (u >= 0.755 && u < 0.83) {
        // T+28s Final Reef & Exit to Open Sky: buoyant hydro-launch propelling train out of the ocean up to the Garden Bridge & Helix
        rawV = THREE.MathUtils.lerp(rawV, 16.2, Math.min(1, dt * 3.2));
      } else if (u >= 0.83 && u < 0.92) {
        // Final Helix: gradual scenic slowdown to 13.0 m/s
        rawV = THREE.MathUtils.lerp(rawV, 13.0, Math.min(1, dt * 2.0));
      }

      const drag = 0.0018 * rawV * rawV * dt;
      const minV = u >= 0.53 && u < 0.76 ? 4.2 * underwaterSpeedFactor : 11.5;
      speed = THREE.MathUtils.clamp(rawV - drag, minV, 27.5);
    } else {
      // Zone 11 & 12: Magnetic Brake Run & Station Return (u = 0.92..1.00)
      const remainingS = Math.max(0, spline.totalLength - leadS);
      const targetV = THREE.MathUtils.clamp(remainingS * 0.38, 1.6, 11.5);
      speed = THREE.MathUtils.lerp(speed, targetV, Math.min(1, dt * 4.5));

      if (leadS + speed * dt >= spline.totalLength) {
        leadS = 0;
        speed = 0;
        return true; // Completed full circuit back to Station s = 0
      }
    }

    leadS += speed * dt;
    if (leadS >= spline.totalLength) {
      leadS = 0;
      speed = 0;
      return true;
    }
    return false;
  }

  function requestDockForTicket(): void {
    if (phase === 'BOARDING' || phase === 'RIDING') return;
    if (phase === 'PRE_RIDE_CIRCUIT') {
      phase = 'DOCKING';
    } else {
      phase = 'PRE_RIDE_PARKED';
      leadS = 0;
      speed = 0;
      preRideTimer = 25.0; // Hold train in station waiting for the player to walk the queue garden
    }
  }

  function startBoarding(): void {
    phase = 'BOARDING';
    leadS = 0;
    speed = 0;
    boardingTimer = 0;
    seatSettleOffset = 0;
    restraintOpenAngle = -0.78;
    firedRestraintLock = false;
    firedConsoleChime = false;
    firedBrakeRelease = false;
    firedDispatch = false;
    setRiderViewMode(true);
    updateCarTransforms();
  }

  function cancelRideToStation(): void {
    phase = 'PRE_RIDE_PARKED';
    leadS = 0;
    speed = 0;
    boardingTimer = 0;
    seatSettleOffset = 0;
    restraintOpenAngle = -0.78;
    preRideTimer = 18.0;
    setRiderViewMode(false);
    updateCarTransforms();
  }

  function consumeCueEvents(): BoardingCueEvents {
    const snapshot: BoardingCueEvents = {
      restraintLockedJustNow: cueEvents.restraintLockedJustNow,
      consoleChimeJustNow: cueEvents.consoleChimeJustNow,
      brakeReleaseJustNow: cueEvents.brakeReleaseJustNow,
      dispatchJustNow: cueEvents.dispatchJustNow,
      rideCompleteJustNow: cueEvents.rideCompleteJustNow,
    };
    cueEvents.restraintLockedJustNow = false;
    cueEvents.consoleChimeJustNow = false;
    cueEvents.brakeReleaseJustNow = false;
    cueEvents.dispatchJustNow = false;
    cueEvents.rideCompleteJustNow = false;
    return snapshot;
  }

  function getSeatEyeWorldPosition(outPos: THREE.Vector3): THREE.Vector3 {
    // Player sits in Lead Car (Car 0): positioned cleanly above/ahead of the seat headrest and shoulder restraint
    // so only the sleek sculpted sapphire nose cone & crystal heart emblem frame the lower peripheral horizon
    _scratchEyeLocal.set(0.0, 1.82 + seatSettleOffset, 0.42);
    outPos.copy(_scratchEyeLocal).applyQuaternion(carGroups[0].quaternion).add(carGroups[0].position);
    return outPos;
  }

  function update(dt: number, elapsedTime: number): void {
    const clampedDt = Math.min(dt, 0.05);

    switch (phase) {
      case 'PRE_RIDE_PARKED': {
        leadS = 0;
        speed = 0;
        restraintOpenAngle = THREE.MathUtils.lerp(restraintOpenAngle, -0.78, Math.min(1, clampedDt * 5));
        preRideTimer -= clampedDt;
        if (preRideTimer <= 0) {
          phase = 'PRE_RIDE_CIRCUIT';
          speed = 2.0;
        }
        break;
      }

      case 'PRE_RIDE_CIRCUIT': {
        restraintOpenAngle = THREE.MathUtils.lerp(restraintOpenAngle, 0.0, Math.min(1, clampedDt * 6));
        const finished = stepTrackPhysics(clampedDt);
        if (finished) {
          phase = 'PRE_RIDE_PARKED';
          preRideTimer = 16.0;
        }
        break;
      }

      case 'DOCKING': {
        // Fast-forward or smoothly finish circuit to dock at station for boarding
        restraintOpenAngle = THREE.MathUtils.lerp(restraintOpenAngle, 0.0, Math.min(1, clampedDt * 6));
        const finished = stepTrackPhysics(clampedDt * 1.65);
        if (finished) {
          phase = 'PRE_RIDE_PARKED';
          preRideTimer = 30.0;
        }
        break;
      }

      case 'BOARDING': {
        // ACT 1: 5-Second Boarding & Anticipation Sequence
        boardingTimer += clampedDt;
        leadS = 0;
        speed = 0;

        // T+1.0s: Seat suspension settles slightly (-0.035m)
        const targetSettle = boardingTimer >= 0.8 ? -0.035 : 0.0;
        seatSettleOffset = THREE.MathUtils.lerp(seatSettleOffset, targetSettle, Math.min(1, clampedDt * 6));

        // T+1.5s: Shoulder restraints lower and click locked
        if (boardingTimer >= 1.2) {
          restraintOpenAngle = THREE.MathUtils.lerp(restraintOpenAngle, 0.0, Math.min(1, clampedDt * 7.5));
        }
        if (boardingTimer >= 1.5 && !firedRestraintLock) {
          firedRestraintLock = true;
          cueEvents.restraintLockedJustNow = true;
        }

        // T+2.0s: Nose-heart crystal & console indicator chime
        if (boardingTimer >= 2.0 && !firedConsoleChime) {
          firedConsoleChime = true;
          cueEvents.consoleChimeJustNow = true;
          cyanCrystalMat.emissiveIntensity = 1.65;
        }

        // T+4.0s: Mechanical brake release hiss
        if (boardingTimer >= 4.0 && !firedBrakeRelease) {
          firedBrakeRelease = true;
          cueEvents.brakeReleaseJustNow = true;
        }

        // T+5.0s: Drive tires smoothly roll train out of the station
        if (boardingTimer >= 5.0 && !firedDispatch) {
          firedDispatch = true;
          cueEvents.dispatchJustNow = true;
          phase = 'RIDING';
          speed = 1.2;
        }
        break;
      }

      case 'RIDING': {
        restraintOpenAngle = 0.0;
        // Subtle dynamic crystal glow pulse with speed
        cyanCrystalMat.emissiveIntensity = 1.15 + Math.sin(elapsedTime * 5.0) * 0.25;
        const finished = stepTrackPhysics(clampedDt);
        if (finished) {
          phase = 'UNBOARDING';
          boardingTimer = 0;
          setRiderViewMode(false);
          cueEvents.rideCompleteJustNow = true;
        }
        break;
      }

      case 'UNBOARDING': {
        leadS = 0;
        speed = 0;
        restraintOpenAngle = THREE.MathUtils.lerp(restraintOpenAngle, -0.78, Math.min(1, clampedDt * 6.0));
        seatSettleOffset = THREE.MathUtils.lerp(seatSettleOffset, 0.0, Math.min(1, clampedDt * 6.0));
        boardingTimer += clampedDt;
        if (boardingTimer >= 1.2) {
          phase = 'PRE_RIDE_PARKED';
          preRideTimer = 18.0;
        }
        break;
      }
    }

    updateCarTransforms();
  }

  // Initialize car transforms at station s = 0
  updateCarTransforms();

  return {
    group,
    carGroups,
    leadCarFrame,
    getPhase: () => phase,
    getSpeed: () => speed,
    getLeadS: () => leadS,
    getLeadU: () => leadCarFrame.u,
    getBoardingTimer: () => boardingTimer,
    getSeatSettleOffset: () => seatSettleOffset,
    getSeatEyeWorldPosition,
    setRiderViewMode,
    syncRiderNoseToCamera,
    requestDockForTicket,
    startBoarding,
    cancelRideToStation,
    consumeCueEvents,
    getUnderwaterSpeedFactor,
    setUnderwaterSpeedFactor,
    update,
  };
}
