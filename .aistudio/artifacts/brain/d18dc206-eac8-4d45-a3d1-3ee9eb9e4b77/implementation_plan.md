# Phase 1: Prologue · Chapter 1 — The Ordinary Night (`13 FEBRUARY 2027 · 10:30 PM`)

This revised plan focuses specifically on **Phase 1 of the Prequel (`Prologue · Chapter 1: The Ordinary Night`)** inside its own dedicated top-level `prequel` module (completely outside the `world` directory), while keeping the existing 3D Dream World untouched and accessible at any moment via a developer shortcut.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The three Chapter 1 visual & interaction decisions from Section 10 of your specification are locked in using your recommended direction:

- **Decision A — Harsha's Character Representation**: **Stylized but recognizable 3D character** featuring articulated head, upper body, arms, hands, and legs supporting all 8 required animation states (`WALK`, `IDLE`, `PHONE_NOTICE`, `PHONE_TAKE_OUT`, `PHONE_READ`, `PHONE_PUT_AWAY`, `LOOK_BACK`, `STOP`) with smooth pose blending and gradual walking deceleration.
- **Decision B — Street Environment**: **Familiar Indian residential street at night** featuring 2–3 storey residential villas/apartment blocks with compound walls, iron gates, warm illuminated windows, sodium-vapor streetlights casting warm pools of light on slightly reflective asphalt, parked cars/scooters, roadside trees, and distant city horizon glow.
- **Decision C — Phone Interface**: **Both 3D phone + readable cinematic close-up** — Harsha physically pulls out a glowing 3D smartphone that casts soft blue-white light across her hands and face as the camera eases over her shoulder, paired with a crisp, readable close-up of `"Are you home yet?"`.
- **Standalone Isolation & Testing Controls**: Built inside a standalone `prequel` folder (outside `world`), with a clean developer shortcut bar to jump directly to the 3D Dream World, restart Chapter 1, or warp to any of the 12 Chapter 1 state-machine stages.

---

## 1. Overview & Core Concept

- **Date & Time**: `13 FEBRUARY 2027 · 10:30 PM`
- **Core Feeling**: Familiarity $\rightarrow$ Curiosity $\rightarrow$ Subtle Unease
- **Chapter Purpose**: Let the player experience a deceptively ordinary night walk as Harsha—with no health bars, quest markers, or gamey HUD clutter—until a single unexpected message (`"Are you home yet?"`) and a pair of approaching headlights quietly shift the mood.

---

## 2. Complete 5-Beat Scene Flow & Visual Design

### Beat 01: Establish the Night (`0:00–0:40` · Playable)
- Fade in from black with the typographic title card: **`13 FEBRUARY 2027 · 10:30 PM`**.
- The opening camera slowly reveals Harsha walking along a quiet, sodium-lit Indian residential street.
- Layered nighttime ambience: distant city traffic hum, occasional distant dog bark, crickets/insects, and synchronized footsteps on asphalt.
- Once the camera settles into the diagonal `FOLLOW` state, the player seamlessly gains movement control (`WASD` to walk, `Shift` to walk slightly faster, `Mouse` to look around).

### Beat 02: The First Message (`0:40–1:20` · Cinematic Interaction)
- Triggered automatically after walking down the first block (or via `[E]` / state trigger): the phone vibrates with a tactile buzz.
- **Gradual Deceleration**: Harsha does not freeze abruptly—her walking stride gradually slows (`WALK` $\rightarrow$ `PHONE_NOTICE`), her head tilts slightly, and she comes to a natural stop (`PHONE_TAKE_OUT`).
- **Over-the-Shoulder Hybrid Camera (`PHONE_CINEMATIC`)**: The camera eases closer over her right shoulder as she raises the 3D phone (`PHONE_READ`), whose screen glow illuminates her hands and face.
- A crisp, readable phone screen close-up displays:
  > **"Are you home yet?"**
- After holding long enough to read (and allowing `[E]` / click / brief pause to dismiss), Harsha pauses thoughtfully, lowers the phone back to her pocket (`PHONE_PUT_AWAY`), and the camera smoothly blends back to `FOLLOW`.

### Beat 03: Something Feels Different (`1:20–2:15` · Playable Exploration)
- Player regains control (`PLAYER_WALKING_2`).
- Ambient background traffic fades lower; the residential street feels quieter.
- A low, distant car engine enters the audio mix from behind/down the road, and twin headlights appear at the far end of the street (`CAR_VISIBLE`).
- As the player walks or looks around (`LOOK_AROUND`), the camera gently assists awareness of the headlights without forcing a hard lock.

### Beat 04: The Approaching Car (`2:15–3:00` · Cinematic Transition)
- As Harsha reaches the next streetlight pool (`CAR_APPROACHING`), the headlights grow brighter, casting long moving shadows across the asphalt.
- The camera transitions smoothly into `CAR_CINEMATIC`:
  1. Shifts behind Harsha toward the approaching headlights.
  2. Cuts/glides to a low-angle shot of the dark sedan's wheels and headlights rolling slowly into the foreground.
  3. The engine sound deepens; red brake lights flare against the dark road surface as the car slows and stops nearby (`CAR_STOPPED`).

### Beat 05: Chapter Ending (`3:00–3:30` · Controlled Cinematic)
- Harsha slows and stops walking, turning her head and upper body toward the dark car (`WALK` $\rightarrow$ `LOOK_BACK` $\rightarrow$ `STOP`).
- The camera glides from behind her to a composed side-profile framing: Harsha in the foreground, the dark sedan's silhouette and glowing red tail lights in the background.
- Hold on the silhouette in silence—then a distinct mechanical **car door unlock click** echoes.
- Immediate cut to black before showing what happens next.
- End Card: **`CHAPTER 01 · THE ORDINARY NIGHT`** (with options to replay Chapter 1, proceed to Chapter 2 when ready, or enter the 3D Dream World).

---

## 3. Key Product Decisions & Systems Architecture

### A. 4-State Hybrid Camera Director
- **`FOLLOW`**: Third-person slight diagonal offset behind and slightly above Harsha, with exponential damping (`THREE.MathUtils.damp`) and subtle walking bob.
- **`LOOK_AROUND`**: Player-controlled mouse look with gentle yaw/pitch limits so the street architecture and headlights remain framed naturally.
- **`PHONE_CINEMATIC`**: Smoothly interpolates over Harsha's right shoulder, shifting focal framing from her shoulder to the glowing 3D phone in her hand.
- **`CAR_CINEMATIC`**: Directed spline/keyframe camera blending from follow view $\rightarrow$ low-angle wheel/headlight approach $\rightarrow$ side-profile silhouette composition.

### B. 8-State Character Animation Blender
- Procedural skeletal/hierarchical rig for Harsha with continuous weight interpolation (`WALK` $\rightarrow$ `PHONE_NOTICE` $\rightarrow$ `PHONE_TAKE_OUT` $\rightarrow$ `PHONE_READ` $\rightarrow$ `PHONE_PUT_AWAY` $\rightarrow$ `WALK` $\rightarrow$ `LOOK_BACK` $\rightarrow$ `STOP`, plus breathing `IDLE`).
- Enforces a smooth velocity ramp-down (`0.85s` deceleration curve) when the phone vibrates so she never snaps from full stride to a static pose.

### C. Event-Driven 12-Stage State Machine & Developer Toolbar
- Predictable, event-driven state progression (`SCENE_START` through `TRANSITION_TO_CHAPTER_2`) with a collapsible developer bar at the top-right to jump to any of the 12 states or straight into the 3D Dream World.

---

## 4. Technical Architecture & State Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Application Root (App.tsx)                         │
│   Active Mode: 'PREQUEL' (Default) ◄───► 'DREAM_WORLD' ◄───► 'EPILOGUE'    │
│   + Persistent Top-Right Developer Shortcut ("Go Directly to Dream World") │
└────────────────────┬───────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             Standalone Prequel Module (Outside World Directory)            │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Chapter 1 State Machine (Event-Driven, Zero Competing Timers)        │  │
│  │ SCENE_START ──► OPENING_CINEMATIC ──► PLAYER_WALKING                 │  │
│  │ ──► PHONE_VIBRATION ──► PHONE_CINEMATIC ──► MESSAGE_READ             │  │
│  │ ──► PLAYER_WALKING_2 ──► CAR_VISIBLE ──► CAR_APPROACHING             │  │
│  │ ──► CAR_STOPPED ──► CHAPTER_END ──► TRANSITION_TO_CHAPTER_2          │  │
│  └───────────┬──────────────────────┬───────────────────────┬───────────┘  │
│              │                      │                       │              │
│              ▼                      ▼                       ▼              │
│  ┌──────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐  │
│  │ Residential Street   │ │ Hybrid Camera &     │ │ Chapter 1 Audio     │  │
│  │ 3D Environment       │ │ Animation Systems   │ │ Controller          │  │
│  │ • Indian Villas/Gates│ │ • FOLLOW / LOOK     │ │ • Night Ambience    │  │
│  │ • Warm Streetlights  │ │ • PHONE_CINEMATIC   │ │ • Synced Footsteps  │  │
│  │ • Parked Vehicles    │ │ • CAR_CINEMATIC     │ │ • Phone Vibration   │  │
│  │ • Spline Dark Sedan  │ │ • 8 Blended Poses   │ │ • Car Engine/Brakes │  │
│  │ • Headlights/Brakes  │ │ • Smooth Slowdown   │ │ • Door Unlock Click │  │
│  └──────────────────────┘ └─────────────────────┘ └─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```
