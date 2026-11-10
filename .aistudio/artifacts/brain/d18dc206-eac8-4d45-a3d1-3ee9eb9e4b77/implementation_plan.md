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

## 4. Phase 2: Chapter 2 The Unknown Journey & Cell 04 Overhaul (Fidelity to Reference Images)

Incorporated direct matching for the 10 reference images provided by the user:
- **`image_900bc9ae.png` & `image_d3c7521e.png` (The Last of Us Rear-Cabin Perspective & Highway Traffic Jam)**:
  - Articulated Front-Right Passenger Companion (Joel silhouette in dark tactical jacket) seated next to the Masked Driver (Tommy).
  - Overhead illuminated digital dot-matrix highway exit sign: `"EXIT 15"`.
  - Windshield horizontal red anamorphic lens flare streak plane with additive blending.
  - Forward highway traffic jam with lead light-blue sedan, left SUV, and right green pickup truck with bright glowing red rectangular brake lights illuminating wet road asphalt.
  - Rearview mirror hanging from the front header with reflective ball mount.
  - Dashboard dual screen instrument cluster with speedometer dials, GPS navigation map, and green radio tuner.
  - Calibrated `INTERIOR_FIXED_WIDE` camera positioned low in the rear seat directly behind Harsha, looking between the two front seats through the windshield.
- **`image_f753b93f.png` (Night Window Arm Rest)**:
  - Seated performance pose in `WATCH_WINDOW_LIGHTS` where Harsha's right arm and gold bangle rest smoothly along the door armrest and window sill catching cool moonlight and passing street bokeh.
- **`image_c9b883df.png` (Brutalist Symmetrical Destination Entrance)**:
  - Modern brutalist concrete facade with overhanging entrance canopy.
  - Lit double glass entrance doors revealing bright warm interior vestibule corridor.
  - Centered glowing green illuminated `"EXIT"` sign above the double doors.
  - Symmetrical exterior wall lantern sconces casting warm light pools on the dark stone facade.
  - Wet asphalt apron in front with specular puddle reflection planes.
- **`image_57be26fb.png`, `image_8dae1dbd.png`, `image_de7d2def.png`, `image_a94592d6.png` (Cell 04: The Awakening)**:
  - Cinderblock concrete walls with horizontal and vertical mortar joints, concrete noise, and dark green institutional wainscoting band.
  - Cracked flagstone floor with surface fissures and specular moisture.
  - High ceiling aperture with a dramatic angled volumetric God-Ray beam cone cutting diagonally across the cell onto Harsha's cot.
  - Solitary vintage wooden chair with turned legs and backrest spindles sitting in the shadows.
  - Heavy reinforced security door with steel cross-ribs, inspection observation window with safety glass, and yellow/black caution header strip.
  - Galvanized steel conduit pipes and junction boxes along the ceiling and walls.
  - Overhead industrial cone pendant lamp and warm rotary desk phone lamp.
  - Calibrated `CELL_04_AWAKENING_PULLBACK` camera pulling back from Harsha's opening eyes on the pillow to frame the god ray, cot, solitary chair, and steel door.
