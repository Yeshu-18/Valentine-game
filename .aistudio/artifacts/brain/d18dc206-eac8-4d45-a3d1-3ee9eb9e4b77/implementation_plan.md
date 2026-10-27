# Heart Island Dream Castle — Phase 2 Master Architecture & Implementation Blueprint

An evidence-based architectural analysis and sprint-by-sprint build blueprint for completing the multi-floor Pastel Dreamscape Castle in *Heart Island: Valentine's Dream World* while preserving all existing Floor 1 systems, vertical connectivity, and locked island regions at 60 FPS.

---

## User Review & Confirmed Architectural Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed with the user during Phase 1 and govern all subsequent Build Mode sprints:

- **Confirmed Decision 1 — Basement Elevation (`Y = -4.50m`)**: Preserve the existing, verified `Y = -4.50m` Basement elevation across the slab (`topY = -4.50m`), service staircase (`f1_to_basement`), and Royal Crystal Elevator stop (`id: -1, elevOffset: -4.50`) rather than shifting existing geometry to `-4.75m`.
- **Confirmed Decision 2 — Physical Access to `Y = +19.75m` Observatory Level**: Add a physically walkable Belvedere / spiral staircase (`f4_to_observatory`) ascending from Floor 4 (`Y = +15.25m`) up to the elevated Starlight Observatory platform (`Y = +19.75m`), registered in `CASTLE_STAIRCASE_CONFIGS`.
- **Confirmed Decision 3 — Dedicated Per-Floor Modularity**: Organize new castle interior levels into dedicated per-floor modules (`CastleFloor2Rooms`, `CastleFloor3Rooms`, `CastleFloor4Towers`, `CastleBasementSecrets`, plus `CastleDreamCar`) following the exact bundle contract established by `CastleFloor1Rooms`.
- **Confirmed Decision 4 — Full Interactive Activity Depth on Floor 2**: Implement full interactive camera framing, avatar pose/appearance customization, keyboard/HUD controls, and procedural Web Audio synthesis for Floor 2's hero activities (`Royal Wardrobe`, `Pop Stage`, `Dance Studio`, `Fashion Photography Studio`).

---

## 1. Overview & Core Concept

- **What It Does**: Extends the existing 5-level Pastel Dreamscape Castle (which already features a completed Exterior, Grand Entrance Hall, Royal Crystal Elevator, Love Ribbon Staircases, 6 interactive Floor 1 rooms, and Rear Rose & Butterfly Gardens) into a fully realized vertical palace across **Floor 2 (Creative & Couture Wing)**, **Floor 3 (Celestial Dream Wing)**, **Floor 4 (Corner Towers & +19.75m Observatory)**, **Basement (-4.50m Secret Chambers)**, and **Exterior Boulevard (Convertible Dream Cruiser)**.
- **Target Audience / Persona**: Players exploring *Heart Island: Valentine's Dream World* as Harsha, experiencing tactile, physical interactions, musical performances, fashion customization, and romantic keepsake moments dedicated to Mandu.
- **Key Value**: Transforms the upper castle floors and basement from architectural shells into rich, physically navigable, interactive spaces without sacrificing the strict `<= 400` draw call and `<= 12` dynamic PointLight performance budget.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Vertical Traversal**: Walk seamlessly up the twin Love Ribbon staircases (`F1 -> F2`), East Gallery stairs (`F2 -> F3`), West Gallery stairs (`F3 -> F4`), and Belvedere stairs (`F4 -> Observatory +19.75m`), or ride the 360° FPV Royal Crystal Elevator across `Basement (-1)` and `Floors 1–4`.
  2. **Floor 2 Activities**: Step into the **Royal Wardrobe** to customize Harsha's gown, hair, and tiara colors in real time; perform on the **Pop Stage** with stage lighting and rhythm cues; practice choreography in the **Dance Studio**; or frame portraits in the **Fashion Photography Studio**.
  3. **Floor 3 Celestial Wing**: Explore the **Star Lounge**, **Heart Gallery**, **Infinite Mirror Room**, **Cloud Bedroom** (with interactive canopy bed), **Aurora Chamber**, and ascend to the **Dream Observatory (`+19.75m`)**.
  4. **Floor 4 Towers & Basement Secrets**: Visit the four themed corner towers (**Heart**, **Rose**, **Star**, **Pearl**) on Floor 4 (`+15.25m`), and descend to the Basement (`-4.50m`) to unlock the **Hidden Library**, **Secret Workshop**, **Crystal Vault**, and **Impossible Door**.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft Romantic Pastel Couture Palace — sculpted pearl-white stone, brushed champagne-gold filigree, blush-rose clearcoat marble, lavender silk, and faceted rose crystals.
  - *Color Palette & Mood*:
    - Dominant Neutral Canvas (60%): Pearl White (`#fcfaf7`) & Cream Stone (`#f5f0eb`).
    - Structural Surfaces (30%): Blush Rose Marble (`#f4dce2`), Soft Lavender (`#e3d7f4`), Powder Blue Spire (`#cfe2f3`).
    - High-Intent Accents (10%): Champagne Gold (`#d8b467`), Velvet Plum (`#831843`), Rose Crystal (`#f43f5e`), Warm Lantern Glow (`#fef08a`).
  - *Typography & HUD Discipline*: Clean semantic DOM overlays using serif display titles (`Georgia` / editorial serif) paired with crisp sans-serif key prompts (`[E]`, `[1-4 / B]`, `[Space]`, `[Esc]`), zero decorative pulsing status dots, and unobstructed central 3D viewport framing.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Single-Source-of-Truth Staircase Engine (`CASTLE_STAIRCASE_CONFIGS`)**:
  - *Chosen Approach*: Keep all staircase geometry, landing pads, floor slab cutouts, side-rail barriers, and `getSurfaceHeight()` math driven by `CASTLE_STAIRCASE_CONFIGS`, adding one new entry (`f4_to_observatory`) for the `+15.25m -> +19.75m` Belvedere climb.
  - *Why*: Guarantees `0.000m` vertical error between top steps and floor slabs and prevents any regression to the verified Floor 1–4 stairs.
- **Decision 2 — One Shared Dynamic Accent PointLight Per Floor**:
  - *Chosen Approach*: Mirror Floor 1's proven lighting architecture by allocating **1 shared Floor 2 Accent PointLight**, **1 shared Floor 3 Accent PointLight**, and **1 shared Basement Accent PointLight** that smoothly lerp to whichever room or activity the player occupies, plus vertical distance culling when the player is on a different floor.
  - *Why*: Keeps total active dynamic PointLights globally `<= 12` while giving every room warm, responsive illumination.
- **Decision 3 — Extend Existing `PlayerController` & `PlayerCharacter` In-Place**:
  - *Chosen Approach*: Expose material tint setters (`setOutfitPalette`) and activity pose states (`dance`, `stage_sing`, `photo_pose`) on the existing `PlayerAvatarBundle`, and route Floor 2/3/Basement activity cameras through `DreamCastle.getCameraFocus()`.
  - *Why*: Preserves existing third-person/first-person movement, raycast camera obstruction resolution, and input priority (`WORLD -> ACTIVITY -> VEHICLE -> WORLD`) without duplicating controllers.

---

## 4. Technical Architecture & Data Strategy

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        React Bootstrap & HUD Overlay                       │
│     (Scene Init, Post-Processing, Telemetry, Prompts, Activity Banners)    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         PlayerController & Camera                          │
│  • Input Priority: WORLD ──► ACTIVITY ──► VEHICLE ──► WORLD                │
│  • Sub-Stepped Collision (4x/frame) + Raycast Camera Obstruction Resolver  │
│  • Avatar Pose & Appearance API (Walk, Sit, Play, Dance, Wardrobe Palette) │
└─────────────────┬───────────────────────────────────────┬──────────────────┘
                  │                                       │
                  ▼                                       ▼
┌─────────────────────────────────────┐ ┌────────────────────────────────────┐
│     CastleNavigationController      │ │        DreamCastle Coordinator     │
│ • CASTLE_FLOOR_DEFS (-1, 1, 2, 3, 4)│ │ • Exterior Shell, Doors, Fountain  │
│ • CASTLE_STAIRCASE_CONFIGS (6 runs) │ │ • Love Ribbon Staircases           │
│ • Royal Crystal Elevator State/FPV  │ │ • Royal Crystal Elevator Cabin/UI  │
│ • Wall, Rail & Cutout Collision     │ │ • "Two Hearts Became One" Light    │
└─────────────────┬───────────────────┘ └─────────────────┬──────────────────┘
                  │                                       │
                  └───────────────────┬───────────────────┘
                                      │
        ┌───────────────┬─────────────┴───┬───────────────┬──────────────┐
        ▼               ▼                 ▼               ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────┐
│ Floor 1 Rooms│ │ Floor 2 Rooms│ │ Floor 3 Rooms│ │Floor 4/Obv. │ │ Basement  │
│  (VERIFIED)  │ │ (SPRINT 01-2)│ │ (SPRINT 03)  │ │ (SPRINT 04) │ │(SPRINT 05)│
│ • 6 Alcoves  │ │ • Wardrobe   │ │ • Star Lounge│ │ • 4 Towers  │ │ • Library │
│ • Piano/Gtr  │ │ • Pop Stage  │ │ • Heart Gal. │ │ • Rooftop   │ │ • Workshop│
│ • Sofa/Record│ │ • Dance/Photo│ │ • Cloud/Mirr.│ │ • +19.75m   │ │ • Vault   │
│ • Fridge/Chef│ │ • Boutique   │ │ • Aurora Rm  │ │   Belvedere │ │ • Imp.Door│
└──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ └───────────┘
```

---

# HEART ISLAND DREAM CASTLE
# PHASE 2 PLAN MODE REPORT

## 1. Repository Reality

Inspection of the actual workspace confirms a single-page React 19 + TypeScript + Three.js (`r160+`) application structured around domain modules inside `src/` and `src/world/`:

- **Entry & Bootstrap**: `main.tsx` mounts `App.tsx`, which initializes the `THREE.WebGLRenderer`, `EffectComposer` (`RenderPass`, `UnrealBloomPass`, and custom `GoldenHourGradeShader`), procedural `RoomEnvironment` PMREM lighting, and the React HUD overlay.
- **World & Terrain Foundation**: `terrainMath.ts` and `IslandTerrain.ts` define deterministic heightfields (`getTerrainHeight(x, z)`), island zones (`ISLAND_ZONES`), and coordinate helpers (`castleLocalToWorld`).
- **Player & Avatar System**: `PlayerController.ts` owns keyboard/pointer input, sub-stepped movement (4 sub-steps per frame), gravity/jumping, camera orbit (`third-person` and `first-person`), indoor raycast camera obstruction resolution, and interaction dispatch (`[E]`, `[Space]`, `[1-4 / B]`, `[Esc]`). `PlayerCharacter.ts` builds Harsha's composite procedural avatar (`PlayerAvatarBundle`) with skeletal/group animations (`walk`, `sprint`, `broom`, `embrace`, `kiss`, `sit`) and first-person visibility toggling.
- **Dreamscape Castle Subsystem (`src/world/dreamscape/`)**:
  - `CastleMaterials.ts`: Shared PBR material palette (`13` core materials tracked by `ResourceTracker`).
  - `CastleNavigation.ts`: Single source of truth for castle origin (`X = 88.0, Z = 18.0`), floor elevations (`CASTLE_FLOOR_DEFS`), staircase configurations (`CASTLE_STAIRCASE_CONFIGS`), entrance door state machine, elevator state machine & 360° FPV mode, `getSurfaceHeight()`, `getCeilingHeight()`, `resolveCastleWallCollisions()`, and `validateStaircaseConnections()`.
  - `DreamCastle.ts`: 5-level exterior and interior architectural shell, firefly pathway, 4 exterior corner tower shells, Barbie arched entrance doors, Central Crystal Fountain + hologram, "Two Hearts Became One Light" chandelier, Love Ribbon staircases, Royal Crystal Elevator cabin/shaft/doors/plaques, Floor 2/3/4/Basement slabs, and Rooftop telescope.
  - `CastleFloor1Rooms.ts`: Complete Floor 1 interior wing (`6` furnished rooms, partition walls, murals, interactive fridge, playable piano, playable guitar, couture turntable, Starlight Orchid plaque, and Velvet Sofa + Vintage Fireplace + Mechanical Record Player).
  - `CastleGarden.ts`: Rear Rose Promenade, 5 instanced rose arches, butterfly conservatory garden, heart pond, wooden bridge, and gazebo vista.

---

## 2. Existing Floor 1

Every Floor 1 element has been inspected in `DreamCastle.ts`, `CastleNavigation.ts`, and `CastleFloor1Rooms.ts`:

```text
SYSTEM: Grand Entrance Hall & Medallion Atrium
FILE: src/world/dreamscape/DreamCastle.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: 31m x 31m blush-rose marble slab at topY = +0.25m, velvet-plum runner carpet, pearl/gold compass medallion, and 6 gilded archway portals at |lx| = 9.2m, lz ∈ {-11.4, 0.0, +11.4}.
DEPENDENCIES: CastleMaterials, ResourceTracker, CastleNavigation
REUSABLE: Yes (archway portal & medallion patterns)
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Grand Entrance Arched Double Doors
FILE: src/world/dreamscape/DreamCastle.ts, src/world/dreamscape/CastleNavigation.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Quilted Barbie-pink & gold double doors at (0, +0.25, -16.0) with bow handles, fanlight transom crest at y = +7.2m, temporary collision barrier when closed, and 3.5s cinematic reveal camera on [E].
DEPENDENCIES: CastleNavigation.openEntranceDoors(), resolveEntranceDoorBarrier()
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: "Two Hearts Became One Light" Grand Chandelier
FILE: src/world/dreamscape/DreamCastle.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Suspended at (0, +7.8m, 0) with intertwined warm/blush crystal hearts, unified glowing core, 8 sweeping gold arms, floor heart projection decal at y = +0.292m, and music-reactive pulse linked to Floor 1 instruments.
DEPENDENCIES: floor1Rooms.getMusicPulseIntensity()
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Central Crystal Lotus Fountain & Couple Hologram
FILE: src/world/dreamscape/DreamCastle.ts, src/world/dreamscape/CastleNavigation.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at (0, +0.25, 0) with custom GLSL ripple water shader, [E] Touch Fountain Water interaction, and rising cyan/gold holographic couple portrait with orbiting blossom sparkles.
DEPENDENCIES: CastleNavigation.triggerFountainRipple()
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Love Ribbon Sweeping Staircases (F1 <-> F2 West & East)
FILE: src/world/dreamscape/DreamCastle.ts, src/world/dreamscape/CastleNavigation.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Driven by CASTLE_STAIRCASE_CONFIGS[0..1] at lx = ±6.9, lz = -6.0 -> +6.0, 18 steps from y = +0.25m to +5.25m, S-curve gold rails, weaving pink ribbons, negative-space heart balusters, 5-petal flowers, and bottom/top landing pads.
DEPENDENCIES: CASTLE_STAIRCASE_CONFIGS, nav.getSurfaceHeight()
REUSABLE: Yes (buildLoveRibbonRailLine helper)
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Royal Crystal Elevator (Shaft, Doors, Cabin, Control Panel, Floor Indicators)
FILE: src/world/dreamscape/DreamCastle.ts, src/world/dreamscape/CastleNavigation.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at (0, y, +12.2) serving Basement (-4.5m) and Floors 1-4 (+0.25m, +5.25m, +10.25m, +15.25m). Tufted blush velvet cabin, curved pink crystal doors, un-mirrored canvas plaques, [E] Enter/Exit 360° FPV mode, and [1-4 / B] floor selection.
DEPENDENCIES: CastleNavigation elevator state machine
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Fashion Gallery (SW Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [-15.2, -9.2], lz ∈ [-14.8, -8.0]. Features 3 glass couture display cases, interactive rotating center couture pedestal ([E] Inspect Couture Gown with mouse yaw drag), and Paris Runway mural.
DEPENDENCIES: Floor1CameraState ('couture_inspect')
REUSABLE: Yes (mannequin & pedestal helpers reusable for Floor 2 Wardrobe/Boutique)
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Living / Relax Lounge (West-Center Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [-15.2, -9.2], lz ∈ [-4.2, +4.2]. Features tufted Velvet Sofa ([E] Relax on Velvet Sofa with 1st-person seated head look), structured Vintage Fireplace (Logs, EmberBed, Inner/OuterFlame, EmberParticles, WarmLight), and mechanical Barbie-era Record Player (33.3 RPM vinyl, articulated tonearm, 1.5s audio fade-in).
DEPENDENCIES: RelaxLoungeState, Floor1CameraState ('sofa_sit')
REUSABLE: Yes (seated camera & audio fade patterns)
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Music Lounge (NW Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [-15.2, -9.2], lz ∈ [+8.0, +14.8]. Features interactive Rose-Gold Grand Piano ("En Kadhale" melody guide + manual A-K keys + custom MP4 hook) and Acoustic Guitar ("Thuli Thuli" melody guide + manual A-G keys + custom MP4 hook).
DEPENDENCIES: Web Audio synthesizer, Floor1CameraState ('piano_play', 'guitar_play')
REUSABLE: Yes (Web Audio synth & HUD banner patterns reusable for Floor 2 Pop Stage & Dance Studio)
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Dream Kitchen (SE Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [+9.2, +15.2], lz ∈ [-14.8, -8.0]. Features marble island, interactive Pastel-Pink Double-Door Fridge ([E] Open Fridge & Serve Heart Pastries), animated pastry tray flight to dining table, and Patisserie mural.
DEPENDENCIES: CastleFloor1Rooms update loop
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Royal Dining Room (East-Center Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [+9.2, +15.2], lz ∈ [-4.2, +4.2]. Features 4.2m champagne-gold dining table, 6 velvet chairs, candelabrum ([E] Take a Seat at the Royal Dining Table), and served heart pastries.
DEPENDENCIES: Floor1CameraState ('dining_sit')
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Indoor Glass Conservatory (NE Wing)
FILE: src/world/dreamscape/CastleFloor1Rooms.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Located at lx ∈ [+9.2, +15.2], lz ∈ [+8.0, +14.8]. Features Starlight Orchid Table with static flat surface plaque ("I Love u Mandu 💕" facing the player on [E]) and Botanical mural.
DEPENDENCIES: CastleFloor1Rooms interactables
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW

SYSTEM: Rear Rose & Butterfly Gardens
FILE: src/world/dreamscape/CastleGarden.ts
STATUS: VERIFIED
CURRENT IMPLEMENTATION: Extends north of Rear Portal (lz = +16.4 to +38.0) with 5 instanced rose arches, 24 flapping instanced butterflies, heart reflection pond, arched cedar bridge, and marble gazebo at (0, y, +32.0).
DEPENDENCIES: CastleMaterials, terrainMath
REUSABLE: Yes
NEEDS MODIFICATION: No
RISK: LOW
```

---

## 3. Existing Architecture

Evaluation of the target architectural symbols against the actual repository:

| Conceptual Symbol | Repository Status | Actual File & Symbol | Notes |
| :--- | :--- | :--- | :--- |
| `GameRuntime` / `GameState` | `VERIFIED` | `src/App.tsx` | Manages WebGL loop, post-processing, React HUD state, and zone telemetry. |
| `InputManager` | `VERIFIED` | `src/world/PlayerController.ts` | Integrated inside `createPlayerController` (`keys`, `onKeyDown`, `onPointerMove`, `onWheel`). |
| `InteractionManager` | `VERIFIED` | `src/world/PlayerController.ts` + `DreamCastle.ts` | Centralized priority chain in `DreamCastle.getProximityPrompt()` and `DreamCastle.interact()`. |
| `CameraManager` | `VERIFIED` | `src/world/PlayerController.ts` | Handles 3rd-person orbit, 1st-person eye view, raycast wall obstruction, and focus blending (`dreamCastle.getCameraFocus()`). |
| `WorldManager` | `VERIFIED` | `src/App.tsx` | Instantiates terrain, atmosphere, plaza, forest, wizarding school, carnival, and `dreamCastle`. |
| `ResourceManager` | `VERIFIED` | `src/world/ProceduralKit.ts` (`ResourceTracker`) | Tracks and disposes `BufferGeometry`, `Material`, and `Texture` instances. |
| `PlayerController` | `VERIFIED` | `src/world/PlayerController.ts` (`createPlayerController`) | Complete movement, sub-stepped collision, grounding, and camera controller. |
| `PlayerCharacter` | `VERIFIED` | `src/world/PlayerCharacter.ts` (`createPlayerAvatar`) | Procedural character rig for Harsha with animation state parameters. |
| `PlayerAppearance` | `PARTIAL` | `src/world/PlayerCharacter.ts` | Materials (`dressMat`, `hairMat`, `collarTrimMat`, `ribbonGoldMat`) exist in closure; needs public setter method for Royal Wardrobe customization. |
| `DreamCastle` | `VERIFIED` | `src/world/dreamscape/DreamCastle.ts` (`createDreamCastle`) | Master castle coordinator bundle. |
| `CastleFloor` / `CastleRoom` | `PARTIAL` | `src/world/dreamscape/CastleFloor1Rooms.ts` | Floor 1 rooms are complete; Floors 2, 3, 4 Towers, and Basement rooms are currently un-furnished slabs. |
| `CastleElevator` | `VERIFIED` | `src/world/dreamscape/DreamCastle.ts` + `CastleNavigation.ts` | Complete 5-stop Royal Crystal Elevator with FPV mode and curved doors. |
| `CastleStairs` | `VERIFIED` | `src/world/dreamscape/CastleNavigation.ts` (`CASTLE_STAIRCASE_CONFIGS`) | Complete 5-flight staircase config + validation; needs 6th entry for `+15.25m -> +19.75m` Observatory stairs. |
| `CastleTower` | `PARTIAL` | `src/world/dreamscape/DreamCastle.ts` | Exterior cylinders & spires exist at `(±15.5, ±15.5)` with solid `radius: 3.3` colliders; interior/alcove tower shrines on Floor 4 are `MISSING`. |
| `CastleSecrets` | `MISSING` | To be created in `CastleBasementSecrets.ts` | Basement slab (`Y = -4.50m`) exists, but Hidden Library, Secret Workshop, Crystal Vault, and Impossible Door are `MISSING`. |
| `WardrobeSystem` | `MISSING` | To be created in `CastleFloor2Rooms.ts` | Interactive Royal Wardrobe with live outfit/hair/tiara customization is `MISSING`. |
| `PopStage` / `DanceRoom` / `Photography` | `MISSING` | To be created in `CastleFloor2Rooms.ts` | Floor 2 interactive studio activities are `MISSING`. |
| `DreamCar` | `MISSING` | To be created in `CastleDreamCar.ts` | Convertible pastel Dream Cruiser on the exterior boulevard is `MISSING`. |

---

## 4. Player / Camera Architecture

- **Current Modes in `PlayerController.ts`**:
  1. `third-person`: Orbit camera (`cameraYaw`, `cameraPitch`, `cameraDistance`) with **Raycast Camera Obstruction Resolver** (`_cameraRaycaster` intersecting `dreamCastle.cameraOccluders` with `minDist = 1.2m`) and **Interior Partition Wall Transparency Fade** (`opacity = 0.22` when a partition blocks line-of-sight).
  2. `first-person`: Eye-level camera (`playerPos.y + 1.56m`) hiding `avatar.bodyGroup`.
  3. `ActivityCamera` (`dreamCastle.getCameraFocus()`): Smoothly blends camera `position`, `target`, and `fov` using `blendAlpha`, optionally locking `avatar.group.position` to `seatWorldPos`/`seatYaw` and hiding the avatar in `isFirstPersonSeated` mode.
- **Input Ownership Model**:
  - Currently, `isInstrumentOrInspectLocked` in `PlayerController.ts` suspends `WASD` locomotion whenever `isElevatorFpv` or a Floor 1 activity mode (`sofa_sit`, `piano_play`, `guitar_play`, `couture_inspect`) is active.
  - **Extension Point**: Generalize `isInstrumentOrInspectLocked` to query `dreamCastle.isActivityMovementLocked()` so Floor 2 activities (`wardrobe_customize`, `pop_stage_perform`, `dance_studio`, `photo_studio`), Floor 3 activities (`cloud_bed_rest`, `infinite_mirror`, `observatory_telescope`), and `DreamCar` vehicle driving cleanly own input and camera without modifying `PlayerController`'s core physics loop.

---

## 5. Interaction Architecture

- **How Interactables Work Today**:
  - `DreamCastle.getProximityPrompt(playerPos)` evaluates a deterministic priority chain every frame (zero allocation, returning pre-allocated prompt objects):
    1. Royal Crystal Elevator (inside FPV or nearby landing door)
    2. Entrance Doors / Rooftop Telescope
    3. `floor1Rooms.getProximityPrompt(playerPos)`
    4. Central Crystal Fountain
  - Pressing `[E]` calls `DreamCastle.interact(playerPos)` using the exact same priority order.
  - Pressing `[1–9 / A–K / Space]` inside an active room mode delegates to `floor1Rooms.handleKeyAction(e.code)`.
  - Pressing `[Esc]` calls `exitActiveCameraMode(playerPos)` and restores exploration camera and player standing position.
- **Minimum Extension Required**:
  - Extend `DreamCastle.getProximityPrompt(playerPos)`, `DreamCastle.interact(playerPos)`, `DreamCastle.handleKeyAction(code)`, and `DreamCastle.exitActiveActivity(playerPos)` to dispatch by the player's current elevation (`playerLocalY`) to the active floor module (`CastleBasementSecrets` when `y < -1.0m`, `CastleFloor1Rooms` when `y < 3.5m`, `CastleFloor2Rooms` when `3.5m <= y < 8.5m`, `CastleFloor3Rooms` when `8.5m <= y < 13.5m`, `CastleFloor4Towers` when `y >= 13.5m`, and `CastleDreamCar` when outdoors near the boulevard).

---

## 6. Collision / Navigation

- **Current Collision & Grounding Architecture (`CastleNavigation.ts` & `PlayerController.ts`)**:
  - **Sub-Stepped Horizontal Movement**: 4 sub-steps per frame testing `CircleCollider[]` (`queryNearbyColliders`) and analytical box barriers (`resolveEntranceDoorBarrier`, `resolveCastleWallCollisions`).
  - **Vertical Grounding (`nav.getSurfaceHeight`)**:
    - Evaluates all staircases in `CASTLE_STAIRCASE_CONFIGS` first (with `0.25m` Z landing buffers and ramp X width slightly wider than floor cutout holes so the player never drops through a seam).
    - Evaluates Floor 4 (`15.25m`), Floor 3 (`10.25m`), Floor 2 (`5.25m`), Floor 1 (`0.25m`), Exterior Podium (`0.10m`), and Basement (`-4.50m`) with explicit stairwell cutout holes (`inF34Cutout`, `inF23Cutout`, `inF12WestCutout`, `inF12EastCutout`, `inBasementCutout`).
  - **Headroom Enforcement (`nav.getCeilingHeight`)**: Prevents jumping into the underside of upper slabs while granting open headroom inside stairwell openings.

---

## 7. Coordinate System

- **World vs. Castle-Local Coordinates**:
  - **Right-Handed Three.js Coordinate System**: `+X` = East/Right, `+Y` = Up, `+Z` = North/Rear (into the castle from the `-Z` South Front Entrance).
  - **Castle World Origin**: `CASTLE_ORIGIN_X = 88.0`, `CASTLE_ORIGIN_Z = 18.0`, `baseY = getTerrainHeight(88.0, 18.0)`.
  - **Transform Helpers**:
    - `worldX = 88.0 + lx`, `worldY = baseY + ly`, `worldZ = 18.0 + lz`.
  - **Key Landmarks in Castle-Local `(lx, ly, lz)`**:
    - Front Entrance Porch Steps: `(0, +0.10, -19.1)`
    - Grand Double Entrance Doors: `(0, +0.25, -16.0)`
    - Central Crystal Fountain: `(0, +0.25, 0)`
    - "Two Hearts Became One Light" Chandelier: `(0, +7.80, 0)`
    - Royal Crystal Elevator Shaft: `(0, -4.50..+15.25, +12.2)`
    - Rear Garden Portal: `(0, +0.25, +16.0)` leading to Gazebo at `(0, terrainY, +32.0)`

---

## 8. Vertical Castle Map

Comparison of the Phase 2 Spec elevations against the actual repository (`CastleNavigation.ts` & `DreamCastle.ts`):

| Level | Spec Target `Y` | Repository Actual `topY` | Status & Resolution |
| :--- | :--- | :--- | :--- |
| **Basement** | `-4.75m` | **`-4.50m`** (slab center `-4.75m`, thickness `0.50m`) | **CONFIRMED**: Keep working `topY = -4.50m` (slab center is `-4.75m`, top walkable surface is `-4.50m`). |
| **Exterior Podium** | `+0.10m` | **`+0.10m`** (slab center `-0.15m`, thickness `0.50m`) | **VERIFIED MATCH** |
| **Floor 1 (Grand Hall)** | `+0.25m` | **`+0.25m`** (slab center `+0.05m`, thickness `0.40m`) | **VERIFIED MATCH** |
| **Floor 2 (Mezzanine)** | `+5.25m` | **`+5.25m`** (slab center `+5.075m`, thickness `0.35m`) | **VERIFIED MATCH** |
| **Floor 3 (Dream Wing)** | `+10.25m` | **`+10.25m`** (slab center `+10.075m`, thickness `0.35m`) | **VERIFIED MATCH** |
| **Floor 4 (Rooftop / Towers)** | `+15.25m` | **`+15.25m`** (slab center `+15.025m`, thickness `0.45m`) | **VERIFIED MATCH** |
| **Observatory Belvedere** | `+19.75m` | `MISSING` (currently dome finial is at `+18.45m`) | **TO ADD IN SPRINT 04**: Add elevated Starlight Belvedere platform at `topY = +19.75m` connected via walkable spiral/stepped Belvedere stair from Floor 4 (`+15.25m`). |

---

## 9. Protected / Forbidden Regions

Audit of the 6 architecturally protected regions against current repository geometry:

1. **Central Atrium (`|lx| < 4.8m, |lz| < 4.8m`)**:
   - *Floor 1*: Contains the Central Crystal Fountain (`r = 3.1m`) and Chandelier floor heart decal.
   - *Floor 2 (`+5.25m`)*: Open atrium (`|lx| < 5.2m, |lz| < 6.0m`) — **RESPECTED**.
   - *Floor 3 (`+10.25m`)*: Open atrium (`|lx| < 5.2m, |lz| < 5.2m`) — **RESPECTED**.
2. **Royal Crystal Elevator Shaft (`|lx - 0.0| < 2.4m, |lz - 12.2| < 2.4m`)**:
   - Clear on all floors with south entry portal at `lz = +10.2m` — **RESPECTED**.
3. **Floor 1 -> Floor 2 West Stairwell (`lx ∈ [-8.8, -5.0], lz ∈ [-6.2, +6.2]`)**:
   - Occupied exclusively by `f1_to_f2_west` (`lx ∈ [-8.6, -5.2], lz ∈ [-6.0, +6.0]`) — **RESPECTED**.
4. **Floor 1 -> Floor 2 East Stairwell (`lx ∈ [+5.0, +8.8], lz ∈ [-6.2, +6.2]`)**:
   - Occupied exclusively by `f1_to_f2_east` (`lx ∈ [+5.2, +8.6], lz ∈ [-6.0, +6.0]`) — **RESPECTED**.
5. **Floor 2 -> Floor 3 East Stairwell (`lx ∈ [+6.0, +9.0], lz ∈ [+6.2, +13.2]`)**:
   - Occupied exclusively by `f2_to_f3_east` (`lx ∈ [+5.8, +9.2], lz ∈ [+6.5, +13.0]`) — **RESPECTED**.
6. **Floor 3 -> Floor 4 West Stairwell (`lx ∈ [-9.0, -6.0], lz ∈ [+6.2, +13.2]`)**:
   - Occupied exclusively by `f3_to_f4_west` (`lx ∈ [-9.2, -5.8], lz ∈ [+6.5, +13.0]`) — **RESPECTED**.

*Rule for All Sprints*: No Floor 2, Floor 3, or Floor 4 room partition, stage, bed, or furniture collider may intrude into any of the 6 regions above, nor block their North/South entry landings (`lz ∈ [-8.5, -6.0]` and `lz ∈ [+5.6, +8.5]` for F1–F2; `lz ∈ [+5.5, +6.5]` and `lz ∈ [+13.0, +15.2]` for F2–F4).

---

## 10. Staircase Architecture

`CASTLE_STAIRCASE_CONFIGS` in `CastleNavigation.ts` already serves as the verified Single Source of Truth for the 5 existing staircases (`f1_to_f2_west`, `f1_to_f2_east`, `f2_to_f3_east`, `f3_to_f4_west`, `f1_to_basement`) and passes `nav.validateStaircaseConnections()` with `0.000m` vertical error.

- **Planned Extension in Sprint 04 (`f4_to_observatory`)**:
  - Add a 6th staircase config (`id: 'f4_to_observatory'`) ascending from the Floor 4 East-Central terrace (`startX = 7.5, startZ = -6.0, startY = 15.25`) to the elevated Starlight Observatory Belvedere (`endX = 7.5, endZ = 2.0, endY = 19.75`, `16` steps, `stepWidth = 2.6m`), with matching Love Ribbon balustrade and automatic validation in `nav.validateStaircaseConnections()`.

---

## 11. Elevator Architecture

The Royal Crystal Elevator (`RoyalElevator` in `DreamCastle.ts` and state machine in `CastleNavigation.ts`) is **VERIFIED** and supports:
- All 5 stops: `Basement (-4.50m)`, `Floor 1 (+0.25m)`, `Floor 2 (+5.25m)`, `Floor 3 (+10.25m)`, `Floor 4 (+15.25m)`.
- States: `IDLE_OPEN`, `CLOSING`, `MOVING`, `OPENING`.
- Controls: `[E] Enter Royal Crystal Elevator` -> 360° FPV interior look -> `[1-4 / B]` floor selection (waits until floor is selected before closing doors and moving) -> `[E] Step Out`.
- **No structural changes required**; remains untouched and protected during Sprints 01–06.

---

## 12. Room Architecture

Every new room is mapped below to conflict-free coordinates outside all stairwell and atrium forbidden zones:

### FLOOR 2 (`Y = +5.25m` — Owner: `CastleFloor2Rooms.ts`)
| Room | Position `(lx, lz)` | Size `(W × D)` | Theme & Key Interactables | Camera / Audio / Lighting |
| :--- | :--- | :--- | :--- | :--- |
| **Pop Stage** | `lx: [-5.0, +5.0]`, `lz: [-14.8, -7.2]` (South Mezzanine Overlook) | `10.0m × 7.6m` | Heart-arch neon stage, standing mic, starlight runway (`[E] Perform on Pop Stage`, `[1-4]` spotlights, `[Space]` sing/backing track) | Stage front camera + singing pose + Web Audio pop synth + Floor 2 shared PointLight |
| **Royal Wardrobe** | `lx: [-14.8, -9.2]`, `lz: [-14.8, -6.2]` (SW Corner Wing) | `5.6m × 8.6m` | Walk-in closet, rotating mirror podium, gown/hair/tiara swatches (`[E] Enter Royal Wardrobe`, `[1-5]` Dress Color, `[Q/W]` Hair, `[T]` Tiara) | Full-body mirror camera + live `avatar.setOutfitPalette()` update |
| **Dance Studio** | `lx: [-14.8, -9.2]`, `lz: [-5.8, +5.8]` (West Mezzanine Gallery) | `5.6m × 11.6m` | Mirrored ballet barre, polished rosewood floor, rhythm floor pads (`[E] Practice Choreography`, `[A/S/D/F]` dance moves) | Wide studio mirror camera + 4 procedural avatar dance steps + beat synth |
| **Beauty Studio** | `lx: [-14.8, -9.2]`, `lz: [+6.2, +14.8]` (NW Corner Wing) | `5.6m × 8.6m` | Hollywood bulb vanity mirror, perfume atomizers, velvet stool (`[E] Sit at Royal Vanity` -> sparkle mist & blush glow) | Seated vanity close-up camera + chime/shimmer SFX |
| **Fashion Photography Studio** | `lx: [+9.2, +14.8]`, `lz: [-14.8, -6.2]` (SE Corner Wing) | `5.6m × 8.6m` | Pastel cyclorama backdrop, twin studio softbox stands, brass tripod camera (`[E] Strike a Pose in Photo Studio`, `[Space]` shutter flash, `[1-3]` poses) | Viewfinder camera mode + shutter flash effect + pose cycler |
| **Mini Fashion Boutique** | `lx: [+9.2, +14.8]`, `lz: [-5.8, +5.2]` (East Mezzanine Gallery) | `5.6m × 11.0m` | Glass handbag vitrines, hat stands, ribbon gift boxes (`[E] Browse Royal Accessories` -> equips/toggles hair bow or handbag accent) | Showcase inspection camera |
| **Doll Playroom** | `lx: [-5.2, +4.8]`, `lz: [+6.6, +9.8]` (North-Central Alcove) | `10.0m × 3.2m` | Miniature scale model of the Dream Castle, plush heart cushions (`[E] Inspect Miniature Dream Castle` -> lights up mini castle windows) | Tabletop miniature camera |

### FLOOR 3 (`Y = +10.25m` — Owner: `CastleFloor3Rooms.ts`)
| Room | Position `(lx, lz)` | Size `(W × D)` | Theme & Key Interactables | Camera / Audio / Lighting |
| :--- | :--- | :--- | :--- | :--- |
| **Star Lounge** | `lx: [-5.2, +5.2]`, `lz: [-14.8, -6.2]` (South Celestial Balcony) | `10.4m × 8.6m` | Crescent-moon velvet loveseat, floating starlight lanterns (`[E] Sit on Crescent Moon Loveseat`) | Seated celestial camera + harp arpeggio |
| **Heart Gallery** | `lx: [+9.2, +14.8]`, `lz: [-14.8, +5.8]` (SE & East Gallery) | `5.6m × 20.6m` | Framed romantic canvas gallery & sculpted glass heart pedestals (`[E] View Romantic Memory Canvas`) | Gallery framing camera |
| **Infinite Mirror Room** | `lx: [+9.6, +14.8]`, `lz: [+6.8, +14.8]` (NE Corner Chamber) | `5.2m × 8.0m` | Octagonal mirrored chamber with illusionary depth crystal array (`[E] Awaken Infinite Starlight Mirrors`) | Kaleidoscope orbit camera + ambient pad |
| **Cloud Bedroom** | `lx: [-14.8, -9.2]`, `lz: [-14.8, +5.8]` (SW & West Wing) | `5.6m × 20.6m` | Sculpted cloud-pillar four-poster canopy bed, silk drapes, floating dream pillows (`[E] Rest on Royal Cloud Bed`) | Cozy canopy camera + lullaby music box |
| **Aurora Chamber** | `lx: [-5.4, +5.4]`, `lz: [+6.8, +9.8]` (North-Central Sanctuary) | `10.8m × 3.0m` | Overhead procedural aurora ribbon dome & crystal prism (`[E] Channel Pastel Aurora Sky`) | Upward aurora dome camera + ethereal choir synth |

### FLOOR 4 TOWERS (`Y = +15.25m`) & OBSERVATORY (`Y = +19.75m` — Owner: `CastleFloor4Towers.ts`)
| Room / Zone | Position `(lx, lz, ly)` | Size | Theme & Key Interactables | Camera / Audio / Lighting |
| :--- | :--- | :--- | :--- | :--- |
| **Heart Tower Pavilion (SW)** | `(-13.2, -13.2, +15.25)` | `r = 2.8m` | Open colonnade shrine framing the SW tower with floating heart chime (`[E] Ring Heart Tower Chime`) | SW Island vista camera |
| **Rose Tower Pavilion (SE)** | `(+13.2, -13.2, +15.25)` | `r = 2.8m` | Blooming crystal rose gazebo (`[E] Touch Eternal Crystal Rose`) | SE Ocean vista camera |
| **Star Tower Pavilion (NW)** | `(-13.2, +13.2, +15.25)` | `r = 2.8m` | Astrolabe & star map pedestal (`[E] Align Starlight Astrolabe`) | NW Wizarding School vista camera |
| **Pearl Tower Pavilion (NE)** | `(+13.2, +13.2, +15.25)` | `r = 2.8m` | Giant iridescent clam-pearl fountain (`[E] Open Iridescent Pearl`) | NE Garden & Forest vista camera |
| **Dream Observatory (`+19.75m`)** | `(0, 0, +19.75)` reached via `f4_to_observatory` stairs | `r = 4.6m` | Elevated crystal cupola platform above the central dome with Celestial Orrery & Stargazer Telescope (`[E] Gaze Through Celestial Orrery`) | 360° high-altitude island panorama at `Y = +21.5m` |

### BASEMENT (`Y = -4.50m` — Owner: `CastleBasementSecrets.ts`)
| Room | Position `(lx, lz)` | Size `(W × D)` | Theme & Key Interactables | Camera / Audio / Lighting |
| :--- | :--- | :--- | :--- | :--- |
| **Hidden Library** | `lx: [-12.5, -4.5]`, `lz: [-12.5, -1.5]` (SW Vault) | `8.0m × 11.0m` | Floor-to-ceiling arched bookshelves, floating enchanted tomes, secret rotating bookcase switch (`[E] Pull Illuminated Romance Tome`) | Secret passage reveal camera |
| **Secret Workshop** | `lx: [+4.5, +12.5]`, `lz: [-12.5, -1.5]` (SE Vault) | `8.0m × 11.0m` | Clockwork music-box workbench, gown pattern drafting table (`[E] Wind Golden Heart Music Box`) | Workbench close-up + music box melody |
| **Crystal Vault** | `lx: [-12.5, -4.5]`, `lz: [+1.5, +12.5]` (NW Vault) | `8.0m × 11.0m` | Illuminated rose-quartz crystal pillars & Royal Crown Jewels display (`[E] Illuminate Heart Diamond Vault`) | Shimmering vault camera |
| **Impossible Door** | `lx: [+4.5, +12.5]`, `lz: [+1.5, +12.5]` (NE Vault) | `8.0m × 11.0m` | Freestanding ornate portal frame opening into a starfield/heart-nebula shader dimension (`[E] Open the Impossible Door`) | Portal vista camera |

---

## 13. Existing Heart Island Systems

| System | File | Classification | Notes |
| :--- | :--- | :--- | :--- |
| **Central Plaza** | `src/world/CentralPlaza.ts` | `LOCKED` | Protected; do not modify. |
| **NW Wizarding School** | `src/world/WizardingSchool.ts` | `LOCKED` | Protected; do not modify. |
| **Ancient Forest & Enchanted Garden** | `src/world/forest/AncientForest.ts`, `EnchantedGarden.ts` | `LOCKED` | Protected; do not modify. |
| **Romantic Carnival Midway** | `src/world/carnival/CarnivalDistrict.ts` | `LOCKED` | Protected; do not modify. |
| **Aurora Underground Cinematic** | `src/world/cinematics/AuroraUndergroundCinematic.ts` | `LOCKED` | Protected; do not modify. |
| **Magic Flight (Broom)** | `src/world/MagicFlight.ts` | `REUSABLE` | Existing flight locomotion; untouched. |
| **Magic Mystery Box** | `src/world/MagicMysteryBox.ts` | `REUSABLE` | Existing plaza interaction; untouched. |
| **ProceduralKit (`ResourceTracker`)** | `src/world/ProceduralKit.ts` | `REUSABLE` | Core disposal tracker used by all new castle modules. |
| **PlayerCharacter / PlayerController** | `src/world/PlayerCharacter.ts`, `PlayerController.ts` | `EXTENDABLE` | Extend with wardrobe palette setters, dance/stage poses, and DreamCar vehicle hooks. |

---

## 14. Performance Architecture

- **Current Budget & Guardrails**:
  - Draw calls `<= 400`, triangles `<= 1.5M`, global dynamic `PointLight` count `<= 12`, particles `<= 600`, zero per-frame object allocations (`new THREE.Vector3()` prohibited inside `update()`).
- **Current Castle Dynamic Lights Count**:
  1. `chandelierLight` (Floor 1 Atrium)
  2. `chandelierPinkFillLight` (Floor 1 Atrium)
  3. `rooftopLight` (Floor 4)
  4. `roomAccentLight` (Floor 1 shared room light)
  5. `fireplaceWarmLight` (Floor 1 Living Room, `intensity = 0` when `dist > 18m`)
- **Planned Floor-Based Vertical Culling & Light Sharing**:
  - Instead of adding permanent lights per room, add **only 2 new shared dynamic PointLights** (`floor23AccentLight` shared between Floor 2 & Floor 3 based on `playerLocalY`, and `basementAccentLight` active only when `playerLocalY < -0.5m`), keeping total castle dynamic PointLights `<= 7` (well below the global `12` limit).
  - **Vertical Frustum / Distance Culling**: In `DreamCastle.update()`, toggle `.visible` on interior room furniture groups for `Basement` (visible only when `playerLocalY < 1.5m`), `Floor 2` (visible when `distToCastleCenter < 45m`), and `Floor 3` (visible when `distToCastleCenter < 45m`), and lock all static furniture matrices (`matrixAutoUpdate = false`).

---

## 15. Resource Management

- `ResourceTracker` (`src/world/ProceduralKit.ts`) is already passed into `createDreamCastleMaterials`, `createCastleFloor1Rooms`, and `createCastleGarden`.
- Every new module (`createCastleFloor2Rooms`, `createCastleFloor3Rooms`, `createCastleFloor4Towers`, `createCastleBasementSecrets`, `createCastleDreamCar`) will accept `tracker: ResourceTracker` and register every geometry (`tracker.trackGeo`), material (`tracker.trackMat`), and procedural `CanvasTexture` (`tracker.trackTex`) so `dreamCastle.dispose()` frees 100% of GPU memory.

---

## 16. Dependency Graph

```text
App.tsx (GameRuntime & HUD)
  └──► PlayerController.ts (Input, Movement, Camera Obstruction, Vehicle/Activity Lock)
         ├──► PlayerCharacter.ts (Avatar Mesh, Poses, Wardrobe Palette API)
         └──► DreamCastle.ts (Master Castle Coordinator)
                ├──► CastleMaterials.ts (Shared PBR Material Library)
                ├──► CastleNavigation.ts (Elevations, CASTLE_STAIRCASE_CONFIGS, Elevator, Wall Colliders)
                ├──► CastleFloor1Rooms.ts (VERIFIED — 6 Floor 1 Rooms & Instruments)
                ├──► CastleGarden.ts (VERIFIED — Rear Rose & Butterfly Gardens)
                ├──► CastleFloor2Rooms.ts (SPRINT 01 & 02 — Wardrobe, Pop Stage, Dance, Photo, Boutique, Playroom)
                ├──► CastleFloor3Rooms.ts (SPRINT 03 — Star Lounge, Heart Gallery, Mirror Room, Cloud Bed, Aurora)
                ├──► CastleFloor4Towers.ts (SPRINT 04 — 4 Tower Pavilions + Y=19.75m Belvedere Observatory)
                ├──► CastleBasementSecrets.ts (SPRINT 05 — Library, Workshop, Crystal Vault, Impossible Door)
                └──► CastleDreamCar.ts (SPRINT 06 — Convertible Dream Cruiser on Fashion Boulevard)
```

- **Zero Circular Dependencies**: Child floor modules depend only on `THREE`, `ResourceTracker`, `CastleMaterials`, and `CastleNavigation` constants, never importing `DreamCastle.ts` or `PlayerController.ts`.

---

## 17. Missing Systems

1. `PlayerAvatarBundle.setOutfitPalette()` & dance/performance pose animations in `src/world/PlayerCharacter.ts` (`PARTIAL` -> extend).
2. `src/world/dreamscape/CastleFloor2Rooms.ts` (`MISSING` -> create in Sprints 01–02).
3. `src/world/dreamscape/CastleFloor3Rooms.ts` (`MISSING` -> create in Sprint 03).
4. `src/world/dreamscape/CastleFloor4Towers.ts` + `f4_to_observatory` staircase (`+15.25m -> +19.75m`) (`MISSING` -> create in Sprint 04).
5. `src/world/dreamscape/CastleBasementSecrets.ts` (`MISSING` -> create in Sprint 05).
6. `src/world/dreamscape/CastleDreamCar.ts` (`MISSING` -> create in Sprint 06).

---

## 18. Conflicts & Resolutions

1. **Basement Elevation (`-4.75m` in Spec vs `-4.50m` in Repository)**:
   - *Repository Behavior*: ` basementFloorGeo` has thickness `0.50m` centered at `-4.75m`, making its walkable top surface `Y = -4.50m`, matching `CASTLE_FLOOR_DEFS[0]` (`elevOffset: -4.5`) and `f1_to_basement` (`endY: -4.5`).
   - *Resolution (Confirmed)*: Keep `topY = -4.50m` (slab center `-4.75m`). Zero destructive change to existing stairs or elevator.
2. **Corner Towers (`±15.5, ±15.5`) Solid Cylinder Colliders**:
   - *Repository Behavior*: The 4 corner towers have solid `CylinderGeometry(3.1, 3.4, 21.0)` bodies and `radius: 3.3` colliders at `(±15.5, ±15.5)`.
   - *Resolution*: Place the 4 Floor 4 Tower Pavilions (**Heart**, **Rose**, **Star**, **Pearl**) as open arched colonnade shrines on the Floor 4 terrace immediately inboard of each corner spire at `(±12.8, +15.25, ±12.8)` so players can physically walk into each tower pavilion without colliding with the exterior structural cylinder.
3. **Observatory Elevation (`+19.75m`) vs Existing Rooftop Dome (`+15.25m..+18.45m`)**:
   - *Repository Behavior*: Floor 4 has a central translucent glass dome (`r = 4.8m`, top at `+18.45m`).
   - *Resolution (Confirmed)*: Crown the central glass dome with a sculpted champagne-gold **Starlight Observatory Belvedere Platform** at `topY = +19.75m` (`r = 4.4m`), connected to Floor 4 (`+15.25m`) via a walkable Belvedere staircase (`f4_to_observatory`) along the east-central terrace (`lx = +7.5, lz = -6.0 -> +2.0`).

---

## 19. Risks & Mitigations

| Risk Area | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Forbidden Stairwell / Atrium Intrusion** | `CRITICAL` | Enforce strict coordinate bounds in all Floor 2 & Floor 3 room partitions (`|lx| >= 9.0` for side wings; keep `lz ∈ [-8.5, -6.0]` and `[+5.6, +8.5]` stair landings 100% clear). |
| **Camera Clipping on Upper Floors** | `HIGH` | Register all new Floor 2, Floor 3, and Basement partition walls in `dreamCastle.interiorPartitionMeshes` and `cameraOccluders` so the existing Raycast Camera Obstruction Resolver & wall opacity fade work automatically. |
| **Dynamic PointLight Overload (`> 12`)** | `HIGH` | Use 1 shared lerping PointLight for Floors 2–3 and 1 for Basement; never instantiate per-room PointLights. |
| **Draw Call Budget (`> 400`)** | `HIGH` | Use `InstancedMesh` for repeated boutique items, bookshelves, crystals, and balusters; lock static matrices (`matrixAutoUpdate = false`); cull Basement when above Floor 1. |
| **Input Lock Leak After Activity Exit** | `MEDIUM` | Ensure `[Esc]` and `[E]` always invoke `exitActiveCameraMode(playerPos)` and restore exploration camera and standing position. |

---

## 20. Recommended Implementation Order

1. **Sprint 01 — Avatar Appearance/Pose API + Floor 2 South & West Wing (`Royal Wardrobe`, `Pop Stage`, `Dance Studio`, `Beauty Studio`)**
2. **Sprint 02 — Floor 2 East & North Wing (`Fashion Photography Studio`, `Mini Fashion Boutique`, `Doll Playroom`)**
3. **Sprint 03 — Floor 3 Celestial Dream Wing (`Star Lounge`, `Heart Gallery`, `Infinite Mirror Room`, `Cloud Bedroom`, `Aurora Chamber`)**
4. **Sprint 04 — Floor 4 Corner Tower Pavilions + `Y = +19.75m` Starlight Observatory & Walkable Belvedere Staircase**
5. **Sprint 05 — Basement Secret Chambers (`Hidden Library`, `Secret Workshop`, `Crystal Vault`, `Impossible Door`)**
6. **Sprint 06 — Exterior Pastel Dream Cruiser (`DreamCar`) + Full Castle Performance & Regression Audit**

---

## 21. Sprint Roadmap

### SPRINT 01: Floor 2 Creative Wing Part 1 (`Royal Wardrobe`, `Pop Stage`, `Dance Studio`, `Beauty Studio`) & Avatar Customization API
- **Objective**: Extend `PlayerCharacter.ts` with live outfit/hair/tiara palette customization and performance/dance poses, and build the first 4 interactive rooms on Floor 2 (`Y = +5.25m`).
- **Files to Create**: `src/world/dreamscape/CastleFloor2Rooms.ts`
- **Files to Modify**: `src/world/PlayerCharacter.ts`, `src/world/PlayerController.ts`, `src/world/dreamscape/DreamCastle.ts`, `src/world/dreamscape/CastleNavigation.ts`
- **Files Untouched**: `CentralPlaza.ts`, `WizardingSchool.ts`, `AncientForest.ts`, `CarnivalDistrict.ts`, `AuroraUndergroundCinematic.ts`, `CastleFloor1Rooms.ts`, `CastleGarden.ts`
- **Acceptance & Runtime Tests**:
  - Walk up `f1_to_f2_west` or `f1_to_f2_east` stairs to `Y = +5.25m`.
  - Enter **Royal Wardrobe** (`SW Wing`), press `[E]`, cycle gown/hair/tiara colors (`[1-5]`, `[Q/W]`, `[T]`), exit with `[Esc]` and verify Harsha's avatar retains the selected couture palette during exploration.
  - Perform on the **Pop Stage** (`South Mezzanine`) and practice choreography in the **Dance Studio** (`West Gallery`) with full camera, pose, and Web Audio synthesis.

### SPRINT 02: Floor 2 Creative Wing Part 2 (`Fashion Photography Studio`, `Mini Fashion Boutique`, `Doll Playroom`)
- **Objective**: Complete all 7 rooms of Floor 2 (`Y = +5.25m`) by adding the SE Photography Studio, East Mini Fashion Boutique, and North-Central Doll Playroom.
- **Files to Create**: None
- **Files to Modify**: `src/world/dreamscape/CastleFloor2Rooms.ts`, `src/world/dreamscape/DreamCastle.ts`
- **Acceptance & Runtime Tests**:
  - Walk unobstructed around the entire Floor 2 Mezzanine loop and onto the `f2_to_f3_east` bottom landing (`lx = +7.5, lz = +6.5`).
  - Enter **Photography Studio**, trigger camera flash (`[Space]`) and pose switches (`[1-3]`).
  - Interact with **Mini Fashion Boutique** and **Doll Playroom** miniature castle.

### SPRINT 03: Floor 3 Celestial Dream Wing (`Star Lounge`, `Heart Gallery`, `Infinite Mirror Room`, `Cloud Bedroom`, `Aurora Chamber`)
- **Objective**: Furnish Floor 3 (`Y = +10.25m`) with 5 celestial rooms, partition walls, and interactive experiences while keeping the `f2_to_f3_east` top landing and `f3_to_f4_west` bottom landing 100% clear.
- **Files to Create**: `src/world/dreamscape/CastleFloor3Rooms.ts`
- **Files to Modify**: `src/world/dreamscape/DreamCastle.ts`, `src/world/dreamscape/CastleNavigation.ts`, `src/world/PlayerController.ts`
- **Acceptance & Runtime Tests**:
  - Climb `f2_to_f3_east` stairs to `Y = +10.25m` and test `[E]` interactions in **Star Lounge**, **Heart Gallery**, **Infinite Mirror Room**, **Cloud Bedroom**, and **Aurora Chamber**.
  - Verify interior partition wall transparency fade and camera collision on Floor 3.

### SPRINT 04: Floor 4 Corner Tower Pavilions & `Y = +19.75m` Starlight Observatory Belvedere
- **Objective**: Build the 4 themed Corner Tower Pavilions (`Heart`, `Rose`, `Star`, `Pearl`) on Floor 4 (`Y = +15.25m`), construct the elevated Starlight Observatory platform at `Y = +19.75m`, and connect them with the walkable `f4_to_observatory` Belvedere staircase in `CASTLE_STAIRCASE_CONFIGS`.
- **Files to Create**: `src/world/dreamscape/CastleFloor4Towers.ts`
- **Files to Modify**: `src/world/dreamscape/CastleNavigation.ts`, `src/world/dreamscape/DreamCastle.ts`
- **Acceptance & Runtime Tests**:
  - Verify `nav.validateStaircaseConnections()` passes all 6 staircases (`0.000m` error).
  - Physically walk from Floor 4 (`+15.25m`) up the Belvedere staircase to `Y = +19.75m` and interact with the **Celestial Orrery & Observatory Telescope**.
  - Interact with all 4 Corner Tower Pavilions on Floor 4.

### SPRINT 05: Basement Secret Chambers (`Hidden Library`, `Secret Workshop`, `Crystal Vault`, `Impossible Door`)
- **Objective**: Transform the Basement (`Y = -4.50m`) into 4 atmospheric secret chambers with physical interactions and vertical culling.
- **Files to Create**: `src/world/dreamscape/CastleBasementSecrets.ts`
- **Files to Modify**: `src/world/dreamscape/DreamCastle.ts`, `src/world/dreamscape/CastleNavigation.ts`
- **Acceptance & Runtime Tests**:
  - Descend `f1_to_basement` stairs (`lx = -11.5, lz = +4.0 -> +12.0`) or ride the Royal Crystal Elevator to `Basement (-1)` at `Y = -4.50m`.
  - Test `[E]` interactions in **Hidden Library**, **Secret Workshop**, **Crystal Vault**, and **Impossible Door**.

### SPRINT 06: Convertible Pastel Dream Cruiser (`DreamCar`) & Full Performance/Regression Validation
- **Objective**: Add an original pastel-pink & champagne-gold Convertible Dream Cruiser parked near the Fashion Boulevard castle entrance with `[E] Drive Dream Cruiser` vehicle mode, chase camera, and full 60 FPS regression verification.
- **Files to Create**: `src/world/dreamscape/CastleDreamCar.ts`
- **Files to Modify**: `src/world/dreamscape/DreamCastle.ts`, `src/world/PlayerController.ts`
- **Acceptance & Runtime Tests**:
  - Enter, drive, steer, stop, and exit the Convertible Dream Cruiser cleanly on the exterior boulevard/island paths.
  - Verify all 6 staircases, 5 elevator stops, and all Floor 1–4 & Basement interactions work with `<= 400` draw calls and `<= 12` dynamic PointLights.

---

## 22. Acceptance Strategy

Every sprint is gated by four verification tiers before proceeding:
1. `IMPLEMENTED`: Complete TypeScript implementation with zero placeholder stubs (`// TODO`, empty handlers).
2. `BUILD VERIFIED`: `compile_applet` (`tsc && vite build`) passes with zero errors.
3. `RUNTIME VERIFIED`: `nav.validateStaircaseConnections()` passes, collision boundaries respect all 6 forbidden regions, and camera/input ownership restores cleanly to exploration on `[Esc]` or `[E]`.
4. `ACCEPTED`: All sprint-specific acceptance criteria and performance budgets (`<= 400` draw calls, `<= 12` PointLights, zero per-frame allocations) are confirmed.

---

## 23. Final Architectural Recommendation

Proceed with **modular per-floor expansion** (`CastleFloor2Rooms.ts`, `CastleFloor3Rooms.ts`, `CastleFloor4Towers.ts`, `CastleBasementSecrets.ts`, `CastleDreamCar.ts`) anchored by `CastleNavigation.ts` (`CASTLE_STAIRCASE_CONFIGS` and `CASTLE_FLOOR_DEFS`). This preserves 100% of the verified Floor 1, Rear Garden, Royal Crystal Elevator, and Love Ribbon Staircase systems while delivering a complete, physically connected, 60 FPS Barbie-inspired Romantic Dream Castle from `Y = -4.50m` to `Y = +19.75m`.
