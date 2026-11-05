/**
 * Prologue · Chapter 1: The Ordinary Night (13 February 2027 · 10:30 PM)
 * Predictable, event-driven state machine, camera states, and character animation states.
 */

export type Chapter1StateId =
  | 'SCENE_START'
  | 'OPENING_CINEMATIC'
  | 'PLAYER_WALKING'
  | 'PHONE_VIBRATION'
  | 'PHONE_CINEMATIC'
  | 'MESSAGE_READ'
  | 'PLAYER_WALKING_2'
  | 'CAR_VISIBLE'
  | 'CAR_APPROACHING'
  | 'CAR_STOPPED'
  | 'CHAPTER_END'
  | 'TRANSITION_TO_CHAPTER_2';

export type HybridCameraState =
  | 'FOLLOW'
  | 'PHONE_CINEMATIC'
  | 'LOOK_AROUND'
  | 'CAR_CINEMATIC';

export type HarshaAnimState =
  | 'WALK'
  | 'IDLE'
  | 'PHONE_NOTICE'
  | 'PHONE_TAKE_OUT'
  | 'PHONE_READ'
  | 'PHONE_PUT_AWAY'
  | 'LOOK_BACK'
  | 'STOP';

export interface Chapter1StateMeta {
  id: Chapter1StateId;
  beatNumber: 1 | 2 | 3 | 4 | 5;
  beatTitle: string;
  label: string;
  playerControlAllowed: boolean;
  cameraState: HybridCameraState;
  defaultHarshaZ: number;
}

export const CHAPTER_1_STATES: Chapter1StateMeta[] = [
  {
    id: 'SCENE_START',
    beatNumber: 1,
    beatTitle: 'Beat 01 · Establish the Night',
    label: '01. Scene Start (Fade In)',
    playerControlAllowed: false,
    cameraState: 'FOLLOW',
    defaultHarshaZ: 0,
  },
  {
    id: 'OPENING_CINEMATIC',
    beatNumber: 1,
    beatTitle: 'Beat 01 · Establish the Night',
    label: '02. Opening Camera Reveal',
    playerControlAllowed: false,
    cameraState: 'FOLLOW',
    defaultHarshaZ: -2.5,
  },
  {
    id: 'PLAYER_WALKING',
    beatNumber: 1,
    beatTitle: 'Beat 01 · Establish the Night',
    label: '03. Player Walking (Ordinary Night)',
    playerControlAllowed: true,
    cameraState: 'FOLLOW',
    defaultHarshaZ: -6.0,
  },
  {
    id: 'PHONE_VIBRATION',
    beatNumber: 2,
    beatTitle: 'Beat 02 · The First Message',
    label: '04. Phone Vibrates (Gradual Slowdown)',
    playerControlAllowed: false,
    cameraState: 'PHONE_CINEMATIC',
    defaultHarshaZ: -22.0,
  },
  {
    id: 'PHONE_CINEMATIC',
    beatNumber: 2,
    beatTitle: 'Beat 02 · The First Message',
    label: '05. Over-the-Shoulder Phone Take Out',
    playerControlAllowed: false,
    cameraState: 'PHONE_CINEMATIC',
    defaultHarshaZ: -23.4,
  },
  {
    id: 'MESSAGE_READ',
    beatNumber: 2,
    beatTitle: 'Beat 02 · The First Message',
    label: '06. Read Message ("Are you home yet?")',
    playerControlAllowed: false,
    cameraState: 'PHONE_CINEMATIC',
    defaultHarshaZ: -23.4,
  },
  {
    id: 'PLAYER_WALKING_2',
    beatNumber: 3,
    beatTitle: 'Beat 03 · Something Feels Different',
    label: '07. Walking Resumes (Quiet Street)',
    playerControlAllowed: true,
    cameraState: 'FOLLOW',
    defaultHarshaZ: -25.0,
  },
  {
    id: 'CAR_VISIBLE',
    beatNumber: 3,
    beatTitle: 'Beat 03 · Something Feels Different',
    label: '08. Distant Headlights Appear',
    playerControlAllowed: true,
    cameraState: 'LOOK_AROUND',
    defaultHarshaZ: -38.0,
  },
  {
    id: 'CAR_APPROACHING',
    beatNumber: 4,
    beatTitle: 'Beat 04 · The Approaching Car',
    label: '09. Car Approaches (Cinematic Angles)',
    playerControlAllowed: false,
    cameraState: 'CAR_CINEMATIC',
    defaultHarshaZ: -50.0,
  },
  {
    id: 'CAR_STOPPED',
    beatNumber: 4,
    beatTitle: 'Beat 04 · The Approaching Car',
    label: '10. Car Slows & Brakes Nearby',
    playerControlAllowed: false,
    cameraState: 'CAR_CINEMATIC',
    defaultHarshaZ: -52.5,
  },
  {
    id: 'CHAPTER_END',
    beatNumber: 5,
    beatTitle: 'Beat 05 · Chapter Ending',
    label: '11. Side Profile & Door Unlock Click',
    playerControlAllowed: false,
    cameraState: 'CAR_CINEMATIC',
    defaultHarshaZ: -52.5,
  },
  {
    id: 'TRANSITION_TO_CHAPTER_2',
    beatNumber: 5,
    beatTitle: 'Beat 05 · Chapter Ending',
    label: '12. End Card (CHAPTER 01 · THE ORDINARY NIGHT)',
    playerControlAllowed: false,
    cameraState: 'CAR_CINEMATIC',
    defaultHarshaZ: -52.5,
  },
];

export const CHAPTER_1_TRIGGER_Z = {
  /** Z position along the street where the phone vibration triggers in Beat 02 */
  PHONE_VIBRATE_Z: -22.0,
  /** Z position where distant headlights and engine hum appear in Beat 03 */
  CAR_VISIBLE_Z: -36.5,
  /** Z position where the approaching car cinematic takes over in Beat 04 */
  CAR_APPROACHING_Z: -49.5,
} as const;

export function getChapter1StateMeta(id: Chapter1StateId): Chapter1StateMeta {
  return (
    CHAPTER_1_STATES.find((s) => s.id === id) ?? CHAPTER_1_STATES[0]
  );
}
