import { EnvironmentStageId } from './Chapter2Config';

/**
 * Authored Camera Approaches from Section 7 (Table: Camera Choreography)
 * plus Cell 04 Awakening Eye-Opening Pullback
 */
export type JourneyCameraShot =
  | 'INTERIOR_FIXED_WIDE'        // Door closes -> Rear-seat wide shot to establish the cabin
  | 'LOW_DASHBOARD_ANGLE'        // Car starts -> Low dashboard angle showing driver silhouette & Harsha
  | 'SIDE_PROFILE_CLOSEUP'       // Car moves -> Side-profile close-up for her expression & passing lights
  | 'WINDOW_POV'                 // Street journey -> Window POV showing neighbourhood & main road passing by
  | 'FACIAL_REACTION_CLOSEUP'    // Character reaction -> Close-up on Harsha's eyes, breathing & subtle lean
  | 'EXTERIOR_TRACKING_SHOT'     // Unfamiliar road -> Exterior tracking shot along the moving dark sedan
  | 'FRONT_THREE_QUARTER_SHOT'   // Car approaches destination -> Exterior front three-quarter approach
  | 'WHEEL_LEVEL_SHOT'           // Car stops -> Low-angle shot of the tyres slowing on courtyard concrete
  | 'INTERIOR_OVER_SHOULDER'     // Door opens -> Interior over-shoulder view as rear door unlatches & light spills in
  | 'CONTROLLED_PUSH_IN'         // Blackout -> Camera pushes closer to her face as outside becomes indistinct
  | 'CELL_04_AWAKENING_PULLBACK';// Chapter 3 Opening -> Close-up of closed eyes opening, pulling back to reveal Cell 04

export type SeatedPerformanceState =
  | 'DOOR_CLOSE_TENSE'
  | 'ADJUST_POSTURE'
  | 'LOOK_FRONT_SEATS'
  | 'WATCH_WINDOW_LIGHTS'
  | 'TURN_BODY_LEAN'
  | 'LOOK_AT_DRIVER'
  | 'HEADLIGHT_BLINK_REACT'
  | 'DESTINATION_STOP_NOTICE'
  | 'DOOR_OPEN_REACT'
  | 'CELL_04_EYES_CLOSED'
  | 'CELL_04_SLOW_AWAKENING';

export type Chapter2StateId =
  | 'SCENE_1_DOOR_CLOSES'
  | 'SCENE_1_ENGINE_START'
  | 'SCENE_1_DEPARTURE_NEIGHBOURHOOD'
  | 'SCENE_2_STAGE_A_FAMILIAR'
  | 'SCENE_2_STAGE_B_MAIN_ROAD'
  | 'SCENE_3_THE_TURN_AND_DRIVER'
  | 'SCENE_3_PASSING_HEADLIGHTS'
  | 'SCENE_2_STAGE_C_ISOLATED'
  | 'SCENE_4_DESTINATION_APPROACH'
  | 'SCENE_4_WHEEL_STOP_ENGINE_OFF'
  | 'SCENE_4_DOOR_OPENS'
  | 'SCENE_5_PERSPECTIVE_PUSH_IN'
  | 'SCENE_5_CONTROLLED_BLACKOUT'
  | 'SCENE_5_CELL_04_AWAKENING';

export interface Chapter2StateMeta {
  id: Chapter2StateId;
  sceneNumber: number;
  label: string;
  subtitle: string;
  emotionTag: string;
  environmentStage: EnvironmentStageId;
  defaultCameraShot: JourneyCameraShot;
  performanceState: SeatedPerformanceState;
  duration: number; // seconds
  observationAllowed: boolean;
  defaultCarZ: number;
}

export const CHAPTER_2_STATES: Chapter2StateMeta[] = [
  {
    id: 'SCENE_1_DOOR_CLOSES',
    sceneNumber: 1,
    label: '1.1 · The Door Closes',
    subtitle: 'The car door seals shut and the cabin plunges into shadow.',
    emotionTag: 'Confusion',
    environmentStage: 'STAGE_A_NEIGHBOURHOOD',
    defaultCameraShot: 'INTERIOR_FIXED_WIDE',
    performanceState: 'DOOR_CLOSE_TENSE',
    duration: 4.5,
    observationAllowed: true,
    defaultCarZ: -4,
  },
  {
    id: 'SCENE_1_ENGINE_START',
    sceneNumber: 1,
    label: '1.2 · Engine Ignition',
    subtitle: 'Subtle engine vibration travels through the cabin.',
    emotionTag: 'Confusion',
    environmentStage: 'STAGE_A_NEIGHBOURHOOD',
    defaultCameraShot: 'LOW_DASHBOARD_ANGLE',
    performanceState: 'ADJUST_POSTURE',
    duration: 5.0,
    observationAllowed: true,
    defaultCarZ: -12,
  },
  {
    id: 'SCENE_1_DEPARTURE_NEIGHBOURHOOD',
    sceneNumber: 1,
    label: '1.3 · Leaving the Street',
    subtitle: 'Streetlights pass across her face at irregular intervals.',
    emotionTag: 'Uncertainty',
    environmentStage: 'STAGE_A_NEIGHBOURHOOD',
    defaultCameraShot: 'SIDE_PROFILE_CLOSEUP',
    performanceState: 'LOOK_FRONT_SEATS',
    duration: 7.5,
    observationAllowed: true,
    defaultCarZ: -45,
  },
  {
    id: 'SCENE_2_STAGE_A_FAMILIAR',
    sceneNumber: 2,
    label: '2.1 · Stage A: Familiar Neighbourhood',
    subtitle: 'Closed shops, parked scooters, and resting street dogs pass outside.',
    emotionTag: 'Uncertainty',
    environmentStage: 'STAGE_A_NEIGHBOURHOOD',
    defaultCameraShot: 'WINDOW_POV',
    performanceState: 'WATCH_WINDOW_LIGHTS',
    duration: 8.5,
    observationAllowed: true,
    defaultCarZ: -115,
  },
  {
    id: 'SCENE_2_STAGE_B_MAIN_ROAD',
    sceneNumber: 2,
    label: '2.2 · Stage B: The Main Road',
    subtitle: 'Wider avenues, traffic signals, commercial buildings, and distant headlights.',
    emotionTag: 'Curiosity',
    environmentStage: 'STAGE_B_MAIN_ROAD',
    defaultCameraShot: 'WINDOW_POV',
    performanceState: 'WATCH_WINDOW_LIGHTS',
    duration: 8.5,
    observationAllowed: true,
    defaultCarZ: -210,
  },
  {
    id: 'SCENE_3_THE_TURN_AND_DRIVER',
    sceneNumber: 3,
    label: '3.1 · The Turn & The Driver',
    subtitle: 'The car takes a turn; her body leans naturally as she glances toward the driver.',
    emotionTag: 'Curiosity → Unease',
    environmentStage: 'STAGE_B_MAIN_ROAD',
    defaultCameraShot: 'FACIAL_REACTION_CLOSEUP',
    performanceState: 'TURN_BODY_LEAN',
    duration: 8.0,
    observationAllowed: true,
    defaultCarZ: -310,
  },
  {
    id: 'SCENE_3_PASSING_HEADLIGHTS',
    sceneNumber: 3,
    label: '3.2 · Passing Headlights',
    subtitle: 'An oncoming vehicle sweeps bright light across the silent cabin.',
    emotionTag: 'Disorientation',
    environmentStage: 'STAGE_B_MAIN_ROAD',
    defaultCameraShot: 'SIDE_PROFILE_CLOSEUP',
    performanceState: 'HEADLIGHT_BLINK_REACT',
    duration: 7.0,
    observationAllowed: true,
    defaultCarZ: -375,
  },
  {
    id: 'SCENE_2_STAGE_C_ISOLATED',
    sceneNumber: 2,
    label: '2.3 · Stage C: Isolated Route',
    subtitle: 'Fewer vehicles, long stretches of dark road, trees, and compound walls.',
    emotionTag: 'Disorientation',
    environmentStage: 'STAGE_C_ISOLATED_ROUTE',
    defaultCameraShot: 'EXTERIOR_TRACKING_SHOT',
    performanceState: 'LOOK_AT_DRIVER',
    duration: 8.5,
    observationAllowed: true,
    defaultCarZ: -455,
  },
  {
    id: 'SCENE_4_DESTINATION_APPROACH',
    sceneNumber: 4,
    label: '4.1 · Approaching Destination',
    subtitle: 'The vehicle slows as headlights illuminate a quiet, concealed entrance.',
    emotionTag: 'Anticipation',
    environmentStage: 'DESTINATION_ENTRANCE',
    defaultCameraShot: 'FRONT_THREE_QUARTER_SHOT',
    performanceState: 'DESTINATION_STOP_NOTICE',
    duration: 6.0,
    observationAllowed: false,
    defaultCarZ: -568,
  },
  {
    id: 'SCENE_4_WHEEL_STOP_ENGINE_OFF',
    sceneNumber: 4,
    label: '4.2 · Tyres Slow & Engine Off',
    subtitle: 'Low-angle tyres come to a halt; the engine idles briefly, then switches off.',
    emotionTag: 'Silence',
    environmentStage: 'DESTINATION_ENTRANCE',
    defaultCameraShot: 'WHEEL_LEVEL_SHOT',
    performanceState: 'DESTINATION_STOP_NOTICE',
    duration: 5.5,
    observationAllowed: false,
    defaultCarZ: -594,
  },
  {
    id: 'SCENE_4_DOOR_OPENS',
    sceneNumber: 4,
    label: '4.3 · Rear Door Opens',
    subtitle: 'A figure approaches outside; the rear door unlatches and cool light enters.',
    emotionTag: 'Suspension',
    environmentStage: 'DESTINATION_ENTRANCE',
    defaultCameraShot: 'INTERIOR_OVER_SHOULDER',
    performanceState: 'DOOR_OPEN_REACT',
    duration: 6.0,
    observationAllowed: true,
    defaultCarZ: -598,
  },
  {
    id: 'SCENE_5_PERSPECTIVE_PUSH_IN',
    sceneNumber: 5,
    label: '5.1 · Perspective Transition',
    subtitle: 'The camera moves closer to her face as the outside world becomes indistinct.',
    emotionTag: 'Disorientation',
    environmentStage: 'DESTINATION_ENTRANCE',
    defaultCameraShot: 'CONTROLLED_PUSH_IN',
    performanceState: 'DOOR_OPEN_REACT',
    duration: 4.5,
    observationAllowed: false,
    defaultCarZ: -598,
  },
  {
    id: 'SCENE_5_CONTROLLED_BLACKOUT',
    sceneNumber: 5,
    label: '5.2 · Controlled Blackout',
    subtitle: 'Car door closes, footsteps echo, a distant mechanical latch opens and fades.',
    emotionTag: 'Transition',
    environmentStage: 'CELL_04_CHAMBER',
    defaultCameraShot: 'CONTROLLED_PUSH_IN',
    performanceState: 'CELL_04_EYES_CLOSED',
    duration: 6.2,
    observationAllowed: false,
    defaultCarZ: -598,
  },
  {
    id: 'SCENE_5_CELL_04_AWAKENING',
    sceneNumber: 5,
    label: '5.3 · Cell 04: The Awakening',
    subtitle: 'Harsha slowly opens her eyes as the camera pulls back to reveal Cell 04.',
    emotionTag: 'Awakening',
    environmentStage: 'CELL_04_CHAMBER',
    defaultCameraShot: 'CELL_04_AWAKENING_PULLBACK',
    performanceState: 'CELL_04_SLOW_AWAKENING',
    duration: 9.0,
    observationAllowed: true,
    defaultCarZ: -598,
  },
];

export function getChapter2StateMeta(id: Chapter2StateId): Chapter2StateMeta {
  return CHAPTER_2_STATES.find((s) => s.id === id) || CHAPTER_2_STATES[0];
}
