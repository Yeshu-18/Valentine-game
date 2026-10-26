/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ResourceTracker,
  ThemeParkMaterials,
} from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { CarnivalAudioSynthesizer } from './CarnivalAudio';
import {
  CarnivalBoothAttraction,
  createPhotoBoothAttraction,
} from './CarnivalBooths';
import { PrizeCinematicFXSystem } from './PrizeCinematicFX';

export type PhotoBoothEmotion = 'romantic' | 'playful' | 'treasured';

/**
 * Creates the handcrafted Vintage Emotional Photo Booth attraction on the boardwalk
 * with seamless 1-2-3 emotion switching in both PLAYING and CINEMATIC/PRIZE_REVEAL states.
 */
export function createPhotoBooth(
  x: number,
  z: number,
  rotY: number,
  tracker: ResourceTracker,
  mats: ThemeParkMaterials,
  audio: CarnivalAudioSynthesizer,
  colliders: CircleCollider[],
  fx: PrizeCinematicFXSystem,
): CarnivalBoothAttraction {
  return createPhotoBoothAttraction(
    x,
    z,
    rotY,
    tracker,
    mats,
    audio,
    colliders,
    fx,
  );
}

