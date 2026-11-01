import * as THREE from 'three';
import { ResourceTracker } from '../ProceduralKit';
import { CircleCollider } from '../VegetationSystem';
import { DreamCastleMaterials } from './CastleMaterials';
import { JewelleryAvatarBridge } from './CastleJewelleryAtelier';
import { AuroraDialogueLine } from '../cinematics/auroraDialogueData';
import {
  IntimateMiniWorld,
  MiniWorldEntranceSpec,
  MiniWorldState,
  MiniWorldTransitionCameraState,
} from './IntimateMiniWorld';

export type TabletopEntranceSpec = MiniWorldEntranceSpec;
export type TabletopTransitionPhase = MiniWorldState;
export type TabletopTransitionCameraState = MiniWorldTransitionCameraState;

/**
 * Room 3: Doll Playroom Tabletop Display & Connected Intimate Romantic Garden Sanctuary
 *
 * Keeps the exact doorway/integration contract with `CastleFloor2CreativeWing`, `CastleNavigation`,
 * and `PlayerController` while delegating all visual construction and ceremony state to
 * `IntimateMiniWorld`. All obsolete Mini Castle / Little Kingdom towers, walls, bridges,
 * signs, banners, and dialogue sequences have been removed from the construction path.
 */
export class CastleTabletopWorld {
  private readonly miniWorld: IntimateMiniWorld;

  constructor(
    tracker: ResourceTracker,
    mats: DreamCastleMaterials,
    originX: number,
    baseY: number,
    originZ: number,
    y0: number,
    colliders: CircleCollider[],
  ) {
    this.miniWorld = new IntimateMiniWorld(
      tracker,
      mats,
      originX,
      baseY,
      originZ,
      y0,
      colliders,
    );
  }

  public get group(): THREE.Group {
    return this.miniWorld.group;
  }

  public get dynamicObjects(): Set<THREE.Object3D> {
    return this.miniWorld.dynamicObjects;
  }

  public get isInsideLittleDreamWorld(): boolean {
    return this.miniWorld.isInsideLittleDreamWorld;
  }

  public set isInsideLittleDreamWorld(val: boolean) {
    this.miniWorld.isInsideLittleDreamWorld = val;
  }

  public get entranceSpec(): TabletopEntranceSpec {
    return this.miniWorld.entranceSpec;
  }

  public setAvatarBridge(bridge: JewelleryAvatarBridge): void {
    this.miniWorld.setAvatarBridge(bridge);
  }

  public addCapturedPortraitToMemoryPath(portraitTex: THREE.Texture): void {
    this.miniWorld.addCapturedPortraitToMemoryPath(portraitTex);
  }

  public isNearTabletopGate(lx: number, lz: number): boolean {
    return this.miniWorld.isNearTabletopGate(lx, lz);
  }

  public isNearDreamWorldReturnGate(lx: number, lz: number): boolean {
    return this.miniWorld.isNearDreamWorldReturnGate(lx, lz);
  }

  public isNearGoldenYeshwanth(lx: number, lz: number): boolean {
    return this.miniWorld.isNearGoldenYeshwanth(lx, lz);
  }

  public triggerEnterLittleDreamWorld(): boolean {
    return this.miniWorld.triggerEnterLittleDreamWorld();
  }

  public triggerReplayGoldenYeshwanthStory(): boolean {
    return this.miniWorld.triggerReplayGoldenYeshwanthStory();
  }

  public triggerExitLittleDreamWorld(): boolean {
    return this.miniWorld.triggerExitLittleDreamWorld();
  }

  public isTransitionActive(): boolean {
    return this.miniWorld.isTransitionActive();
  }

  public isFreeCameraWindowActive(): boolean {
    return this.miniWorld.isFreeCameraWindowActive();
  }

  public isWaitingForCrownInteract(): boolean {
    return this.miniWorld.isWaitingForCrownInteract();
  }

  public applyFocusLookDelta(deltaYaw: number, deltaPitch: number): void {
    this.miniWorld.applyFocusLookDelta(deltaYaw, deltaPitch);
  }

  public updateFocusPositionOffset(
    delta: number,
    moveForward: number,
    moveRight: number,
    moveUp: number,
  ): void {
    this.miniWorld.updateFocusPositionOffset(
      delta,
      moveForward,
      moveRight,
      moveUp,
    );
  }

  public getCurrentDialogue(): AuroraDialogueLine | null {
    return this.miniWorld.getCurrentDialogue();
  }

  public getStoryCaption(): string | null {
    return this.miniWorld.getStoryCaption();
  }

  public advanceOrContinueCinematic(): boolean {
    return this.miniWorld.advanceOrContinueCinematic();
  }

  public skipCinematic(): boolean {
    return this.miniWorld.skipCinematic();
  }

  public getTransitionCameraState(): TabletopTransitionCameraState {
    return this.miniWorld.getTransitionCameraState();
  }

  public consumePendingTeleport(): { pos: THREE.Vector3; yaw: number } | null {
    return this.miniWorld.consumePendingTeleport();
  }

  public update(
    delta: number,
    clockTime: number,
    playerPos: THREE.Vector3,
  ): void {
    this.miniWorld.update(delta, clockTime, playerPos);
  }
}
