# Implementation Plan — Phase 1: Complete Character Production (The Last of Us Part II Realism Benchmark)

This implementation plan incorporates your approved **Phase 1 Character Production Plan** for the standalone Prequel module (`/src/prequel/`), elevating Harsha from a procedural primitive mesh to a highly detailed, cinematic human character with realistic proportions, clothing, hair, rigging, 8-state animation blending, and multi-lighting cinematic rendering tests.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The guiding principles and production milestones from your Phase 1 plan are fully locked in:

- **Confirmed Benchmark — The Last of Us Part II Realism**: Cinematic character realism, natural skin shading, realistic eyes with reflections, detailed hair silhouette, clothing drape with proper fabric roughness and seams, and subtle facial performance.
- **Confirmed Production Sequence**:
  1. **Milestone 1 & 2 — High-Fidelity Character Model**: Constructing an articulated human rig with detailed head, face, eyes, hair, kurti/jacket outfit, jeans, and footwear.
  2. **Milestone 3 & 4 — Rigging & Animation Library**: Implementing the 8-state animation blender (`WALK`, `IDLE`, `PHONE_NOTICE`, `PHONE_TAKE_OUT`, `PHONE_READ`, `PHONE_PUT_AWAY`, `LOOK_BACK`, `STOP`) with smooth walking deceleration (`0.85s` curve) when the phone vibrates.
  3. **Milestone 5 & 6 — Facial Performance & Three.js Integration**: Integrating the character into `/src/prequel/HarshaCharacter.ts` and `/src/prequel/PrequelGame.tsx` while preserving existing state machine orchestration (`chapter1StateMachine.ts`) and hybrid camera choreography (`HybridCameraDirector.ts`).
  4. **Milestone 7 & 8 — Cinematic Lighting & Three-Situation Testing**: Testing the character under residential streetlights, warm window glow, and car headlights.

---

## 1. Overview & Core Concept

- **Goal**: Replace the primitive geometric placeholder inside `/src/prequel/HarshaStreetCharacter.ts` with a fully articulated, cinematic 3D character model that feels like a real person walking through a real Indian residential neighborhood on February 13, 2027.
- **Key Deliverable**: An advanced procedural and modular character sub-system inside `/src/prequel/character/` that supports close-up phone reading shots, medium walking sequences, and reactive head turns.

---

## 2. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Application Root (App.tsx)                         │
│                    Active Chapter: 'PROLOGUE' (PrequelGame)                │
└────────────────────┬───────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    Standalone Prequel Module (/src/prequel)                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Chapter 1 State Machine & Audio Controller                           │  │
│  └───────────┬──────────────────────────────────────────────────────────┘  │
│              │                                                             │
│              ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Advanced Cinematic Character System (/src/prequel/character/)        │  │
│  │                                                                         │  │
│  │  • HarshaCharacterMesh.ts : Multi-part articulated anatomical rig      │  │
│  │    - Detailed head, expressive eyes, hair strands & flow                │  │
│  │    - Layered evening kurti, scarf stole, jeans, and footwear            │  │
│  │    - 3D smartphone with emissive screen & face/hand point lighting     │  │
│  │                                                                         │  │
│  │  • CharacterAnimator.ts : 8-State smooth pose blender & footstep IK    │  │
│  │    - Gradual deceleration curve (0.85s) on phone vibration              │  │
│  │    - Procedural breathing, weight shifts, and look-back rotation        │  │
│  │                                                                         │  │
│  │  • CharacterMaterialTest.ts : Three-situation lighting test rig         │  │
│  │    - 1. Neutral daylight portrait                                      │  │
│  │    - 2. Residential streetlight close-up                               │  │
│  │    - 3. Walking full-body shot under car headlights                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

1. **Create Character Sub-Directory (`/src/prequel/character/`)**:
   - `HarshaCharacterMesh.ts`: Enhanced anatomical 3D geometry with refined facial proportions, detailed hair cap/flow strands, layered kurti clothing normals, and smartphone attachment.
   - `CharacterAnimator.ts`: Robust animation mixer and IK transition math supporting the 8 Chapter 1 poses and smooth deceleration.
   - `CharacterLightingTest.ts`: Developer testing utility to preview the character under the three required lighting situations.
2. **Update Prequel Game Integration (`/src/prequel/PrequelGame.tsx`)**:
   - Wire the advanced character bundle into the existing 12-stage state machine and hybrid camera director.
3. **Build & Verify**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
