/**
 * Chapter 2: The Unknown Journey — Configuration & Route Constants
 * Story position: Immediately after Harsha is taken into the car at the end of Chapter 1.
 * Core emotion: Confusion -> uncertainty -> curiosity -> disorientation.
 */

export type EnvironmentStageId =
  | 'STAGE_A_NEIGHBOURHOOD'
  | 'STAGE_B_MAIN_ROAD'
  | 'STAGE_C_ISOLATED_ROUTE'
  | 'DESTINATION_ENTRANCE'
  | 'CELL_04_CHAMBER';

export type RoadSurfaceType = 'RESIDENTIAL_ASPHALT' | 'MAIN_HIGHWAY' | 'ISOLATED_ROUGH' | 'CONCRETE_COURTYARD';

export interface RouteSegmentConfig {
  stage: EnvironmentStageId;
  startZ: number;
  endZ: number;
  cruiseSpeed: number; // m/s
  surface: RoadSurfaceType;
  streetlightSpacing: number;
  hasTurnCurve?: boolean;
  turnDirection?: -1 | 1;
}

/**
 * Continuous authored route along -Z (from z = 0 to z = -620m)
 * ensuring real spatial progression through the three connected environments:
 * - Environment A: Familiar Neighbourhood (0m -> -180m)
 * - Environment B: Main Road (-180m -> -410m)
 * - Environment C: Isolated Route (-410m -> -565m) & Destination Courtyard (-565m -> -605m)
 */
export const CHAPTER_2_ROUTE_SEGMENTS: RouteSegmentConfig[] = [
  {
    stage: 'STAGE_A_NEIGHBOURHOOD',
    startZ: 0,
    endZ: -180,
    cruiseSpeed: 9.5,
    surface: 'RESIDENTIAL_ASPHALT',
    streetlightSpacing: 22,
  },
  {
    stage: 'STAGE_B_MAIN_ROAD',
    startZ: -180,
    endZ: -410,
    cruiseSpeed: 14.5,
    surface: 'MAIN_HIGHWAY',
    streetlightSpacing: 28,
    hasTurnCurve: true,
    turnDirection: 1,
  },
  {
    stage: 'STAGE_C_ISOLATED_ROUTE',
    startZ: -410,
    endZ: -565,
    cruiseSpeed: 11.2,
    surface: 'ISOLATED_ROUGH',
    streetlightSpacing: 52,
    hasTurnCurve: true,
    turnDirection: -1,
  },
  {
    stage: 'DESTINATION_ENTRANCE',
    startZ: -565,
    endZ: -605,
    cruiseSpeed: 3.6,
    surface: 'CONCRETE_COURTYARD',
    streetlightSpacing: 90,
  },
];

export const CHAPTER_2_DESTINATION_STOP_Z = -598.0;

/**
 * Cell 04 Room World Offset (isolated interior set for Scene 5 Awakening)
 */
export const CELL_04_WORLD_OFFSET = {
  x: 120,
  y: 0,
  z: -600,
};
