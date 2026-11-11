import * as THREE from 'three';

export type InteractableId =
  | 'phone'
  | 'photograph'
  | 'memory_hail_mary'
  | 'memory_pinky'
  | 'memory_confession'
  | 'door'
  | 'bed'
  | 'desk'
  | 'chair';

export type InspectionMode =
  | 'photograph'
  | 'memory_hail_mary'
  | 'memory_pinky'
  | 'memory_confession'
  | 'bed'
  | 'desk'
  | 'chair'
  | null;

export interface Cell04NarrativeState {
  phoneAnswered: boolean;
  photographInspected: boolean;
  memoryHailMaryDiscovered: boolean;
  memoryPinkyDiscovered: boolean;
  memoryConfessionDiscovered: boolean;
  doorUnlocked: boolean;
  doorOpened: boolean;
  activeInspection: InspectionMode;
}

export interface InteractableDefinition {
  id: InteractableId;
  anchorObject: THREE.Object3D;
  anchorOffset?: THREE.Vector3;
  hitMeshes: THREE.Object3D[];
  interactionDistance: number;
  oneTime: boolean;
  isCompleted: (state: Cell04NarrativeState) => boolean;
  getPrompt: (state: Cell04NarrativeState) => string | null;
  onInteract: () => void;
}

export interface TargetedInteractable {
  id: InteractableId;
  prompt: string;
  distance: number;
  completed: boolean;
}

// Pre-allocated vectors to avoid GC pressure during tick
const _worldPos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

/**
 * Reusable raycast + proximity interaction registry for Cell 04: The Awakening.
 * Handles object registration, raycast targeting, interaction distance,
 * contextual prompts, one-time interaction tracking, and inspection cancellation.
 */
export class Cell04InteractionRegistry {
  private items = new Map<InteractableId, InteractableDefinition>();
  private allHitMeshes: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();

  constructor() {
    this.raycaster.near = 0.08;
    this.raycaster.far = 3.0;
  }

  public register(def: InteractableDefinition): void {
    this.items.set(def.id, def);
    for (const mesh of def.hitMeshes) {
      mesh.userData = {
        ...mesh.userData,
        interactId: def.id,
      };
      if (!this.allHitMeshes.includes(mesh)) {
        this.allHitMeshes.push(mesh);
      }
    }
  }

  public getDefinition(id: InteractableId): InteractableDefinition | undefined {
    return this.items.get(id);
  }

  /**
   * Evaluates which registered interactable object the player is currently targeting
   * via center-screen raycast first, followed by a forgiving spatial view-cone fallback.
   */
  public evaluateTarget(
    camera: THREE.Camera,
    state: Cell04NarrativeState,
  ): TargetedInteractable | null {
    // Pause world targeting while in an active inspection or once the door opens for the finale
    if (state.activeInspection || state.doorOpened) {
      return null;
    }

    camera.getWorldDirection(_rayDir);
    _rayOrigin.copy(camera.position);
    this.raycaster.set(_rayOrigin, _rayDir);

    // 1. Primary center-screen raycast against all registered interactable meshes
    const hits = this.raycaster.intersectObjects(this.allHitMeshes, false);
    for (let i = 0; i < hits.length; i++) {
      const hitObj = hits[i].object;
      const id = hitObj.userData?.interactId as InteractableId | undefined;
      if (!id) continue;

      const def = this.items.get(id);
      if (!def) continue;

      this.getAnchorPosition(def, _worldPos);
      const dist = camera.position.distanceTo(_worldPos);

      if (dist <= def.interactionDistance) {
        const prompt = def.getPrompt(state);
        if (prompt) {
          return {
            id: def.id,
            prompt,
            distance: dist,
            completed: def.isCompleted(state),
          };
        }
      }
    }

    // 2. Forgiving view-cone + proximity check (prioritizing small tabletop clues over larger furniture)
    let bestCandidate: TargetedInteractable | null = null;
    let bestScore = Infinity;

    for (const def of this.items.values()) {
      const prompt = def.getPrompt(state);
      if (!prompt) continue;

      this.getAnchorPosition(def, _worldPos);
      const dist = camera.position.distanceTo(_worldPos);
      if (dist > def.interactionDistance) continue;

      _toTarget.copy(_worldPos).sub(camera.position).normalize();
      const alignment = _rayDir.dot(_toTarget);

      // Require looking roughly toward the object, or standing very close to it
      if (alignment > 0.58 || (dist < 1.35 && alignment > 0.35)) {
        // Weight score by distance and gaze alignment; give priority to key story objects over bulk furniture
        const isBulkFurniture =
          def.id === 'bed' || def.id === 'desk' || def.id === 'chair';
        const priorityPenalty = isBulkFurniture ? 0.65 : 0;
        const score = dist * (1.4 - alignment) + priorityPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestCandidate = {
            id: def.id,
            prompt,
            distance: dist,
            completed: def.isCompleted(state),
          };
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Triggers interaction on the currently targeted object (or closest in-range object).
   * Enforces one-time interaction tracking so completed story sequences do not replay.
   */
  public triggerInteract(
    currentTarget: TargetedInteractable | null,
    state: Cell04NarrativeState,
  ): boolean {
    if (state.activeInspection || state.doorOpened) return false;
    if (!currentTarget) return false;

    const def = this.items.get(currentTarget.id);
    if (!def) return false;

    if (def.oneTime && def.isCompleted(state)) {
      return false;
    }

    def.onInteract();
    return true;
  }

  private getAnchorPosition(
    def: InteractableDefinition,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    def.anchorObject.getWorldPosition(out);
    if (def.anchorOffset) {
      out.add(def.anchorOffset);
    }
    return out;
  }

  public clear(): void {
    this.items.clear();
    this.allHitMeshes.length = 0;
  }
}
