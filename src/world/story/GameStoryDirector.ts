/**
 * Master Narrative State Machine & Story Script Data for:
 * - Phase I (PREQUEL): February 13, 2027 (10:30 PM) & "Cell 04: The Awakening"
 * - Phase II (DREAM_WORLD): Heart Island & Dream Castle 3D Open World
 * - Phase III (SEQUEL): "The Private Romantic World" behind the Special Gate at (0, -112)
 */

export type GameChapterPhase = 'PROLOGUE' | 'DREAM_WORLD' | 'EPILOGUE';

export type PrequelSceneId =
  | 'SCENE_1_NIGHT_WALK'
  | 'SCENE_2_DARK_CAR'
  | 'SCENE_3_THE_DRIVE'
  | 'SCENE_4_CELL_04_AWAKENING'
  | 'SCENE_5_THE_PHONE'
  | 'SCENE_6_7_THE_CLUES'
  | 'SCENE_8_MEMORY_1_HAIL_MARY'
  | 'SCENE_8_MEMORY_2_PINKY_MOMENT'
  | 'SCENE_8_MEMORY_3_CONFESSION'
  | 'SCENE_9_10_THE_DOOR'
  | 'SCENE_11_12_THE_REVEAL';

export type SequelSceneId =
  | 'SEQUEL_1_THRESHOLD'
  | 'SEQUEL_2_STARLIGHT_HEARTH'
  | 'SEQUEL_3_PLAYFUL_CLOSENESS'
  | 'SEQUEL_4_PRIVATE_LETTER'
  | 'SEQUEL_5_VALENTINE_FINALE';

export const SPECIAL_GATE_WORLD_POS = {
  x: 0.0,
  z: -112.0,
  interactRadius: 9.5,
} as const;

const STORAGE_KEY_PHASE = 'heart_island_story_phase_v1';
const STORAGE_KEY_CHAT_IMG = 'heart_island_real_chat_screenshot_v1';

export function loadSavedStoryPhase(): GameChapterPhase {
  // Always start at PROLOGUE by default on fresh sessions unless explicitly saved
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY_PHASE);
    if (
      saved === 'PROLOGUE' ||
      saved === 'DREAM_WORLD' ||
      saved === 'EPILOGUE'
    ) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'PROLOGUE';
}

export function saveStoryPhase(phase: GameChapterPhase): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_PHASE, phase);
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedChatScreenshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_CHAT_IMG);
  } catch {
    return null;
  }
}

export function saveChatScreenshot(dataUrl: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CHAT_IMG, dataUrl);
  } catch {
    // Ignore quota errors
  }
}

export interface PrequelClueSpec {
  id: 'phone' | 'note_desk' | 'photograph' | 'memory_1' | 'memory_2' | 'memory_3';
  title: string;
  subtitle: string;
  shortPrompt: string;
}

export const CELL_04_CLUES: readonly PrequelClueSpec[] = [
  {
    id: 'phone',
    title: 'Rotary Telephone',
    subtitle: 'Heavy Bakelite Receiver • Desk Corner',
    shortPrompt: 'Press E or Click to Answer Phone',
  },
  {
    id: 'note_desk',
    title: 'Minimalist Desk Notes',
    subtitle: 'Handwritten Cards Under the Lamp',
    shortPrompt: 'Inspect Desk Notes',
  },
  {
    id: 'photograph',
    title: 'The Photograph (14 / 02 / 2024)',
    subtitle: 'Turned Over on the Wooden Desk',
    shortPrompt: 'Turn Over Photograph',
  },
  {
    id: 'memory_1',
    title: 'Memory I — Project Hail Mary',
    subtitle: 'Cinema Interval • The Glasses & Her Smile',
    shortPrompt: 'Recall Memory I',
  },
  {
    id: 'memory_2',
    title: 'Memory II — The Pinky Moment',
    subtitle: 'Mall & Car Ride • Holding Hands',
    shortPrompt: 'Recall Memory II',
  },
  {
    id: 'memory_3',
    title: 'Memory III — The Real Confession',
    subtitle: 'Late Night at Home • The Beginning',
    shortPrompt: 'Recall Memory III',
  },
];

/**
 * Checks whether the player in the 3D Dream World is within interaction range
 * of the Southern Special Gate at (x = 0, z = -112).
 */
export function isNearSpecialGate(x: number, z: number): boolean {
  const dist = Math.hypot(
    x - SPECIAL_GATE_WORLD_POS.x,
    z - SPECIAL_GATE_WORLD_POS.z,
  );
  return dist <= SPECIAL_GATE_WORLD_POS.interactRadius;
}
