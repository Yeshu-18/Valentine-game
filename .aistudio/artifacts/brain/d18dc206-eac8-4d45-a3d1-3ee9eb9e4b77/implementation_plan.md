# Central Plaza Heart Focus & Updated Reveal Dedication

This update refines the **Cinematic Dream World Appearance Sequence** so that the first camera pullback (`Stages B & C`) smoothly centers and focuses directly on the **Central Plaza's Luminous Heart Fountain** (the sculpted brushed-gold heart arch and levitating crystal heart core at the center of the plaza), and updates the romantic dedication during the Stage D grand island reveal to **"This world is yours my love"**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed and govern this update:

- **Confirmed Decision 1 — First Camera Pullback Framing (`Stages B & C: 4.5s – 13.8s`)**: **Smooth pullback centering the plaza heart arch** (`_camStageCPos` glides to a clean vantage point framing the Central Plaza's Luminous Heart Fountain at `X = 0.0, Y = plazaBaseY + 6.0m, Z = 0.0`, holding focus on the levitating crystal heart core as the plaza lanterns and fountain plumes ignite).
- **Confirmed Decision 2 — Dedication Wording & Timing (`Stage D: 14.0s – 24.0s`)**: Change the dedication wording to **"This world is yours my love"** and display it during the **Stage D grand full-island reveal** as the camera zooms out to reveal the entire heart-shaped island silhouette.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Central Plaza Center Heart Focus (`4.5s – 13.8s`)**: As the golden mist clears in Stage B and the plaza lights ignite in Stage C, the camera performs a smooth backward and upward pullback from Harsha's starting position (`X = -16.5, Z = 16.0`) to a dedicated hero framing position (`X = 0.0, Y = plazaBaseY + 9.2m, Z = -22.5m`), locking its gaze directly onto the **Central Plaza's Center Heart Arch & Levitating Crystal Heart Core** (`X = 0.0, Y = plazaBaseY + 6.0m, Z = 0.0`).
  2. **Seamless Two-Heart Visual Progression (`Plaza Heart -> Island Heart`)**: Focusing first on the sculpted golden heart at the center of the Central Plaza creates a poetic visual echo when Stage D (`14.0s – 24.0s`) pulls high into the sky (`Y = 335m, Z = -285m`) to reveal that the entire island itself is shaped like a giant glowing heart.
  3. **Updated Romantic Dedication (`Stage D`)**: Updates the title card during the high-altitude aerial hold to **"This world is yours my love"**.
- **Target Audience / Persona**: Harsha experiencing the emotional culmination of the Prequel journey as the Dream World materializes around her.
- **Key Value**: Establishes an unmistakable focal anchor on the Central Plaza's centerpiece heart monument during the initial reveal movement before unveiling the macro heart-shaped island with the personal message *"This world is yours my love"*.

---

## 2. User Experience & Visual Design

- **Key User Flows (Four-Stage 24-Second Choreography)**:
  1. **Stage A — Vision Returns (`0.0s – 4.5s`)**:
     - The blindfold lifts with a warm amber-rose light veil (`14px -> 1.2px` optical focus restoration) and floating golden motes while the camera rests behind Harsha.
  2. **Stage B — Environment Materializes & Camera Focuses on the Plaza Center Heart (`4.5s – 9.5s`)**:
     - As the warm golden fog rolls back and the plaza emerges, the camera smoothly glides back and arcs toward the southern approach of the Central Plaza, centering the **Luminous Heart Fountain** (`(0, plazaBaseY + 6.0, 0)`) in the frame.
  3. **Stage C — Plaza Heart & Attractions Illuminate (`9.5s – 13.8s`)**:
     - While holding a slow, majestic dolly-back focused directly on the Central Plaza's Brushed-Gold Heart Arch and Levitating Crystal Heart Core, the fountain's champagne-gold light (`PointLight` at `(0, 4.8, 0)`), cascading water plumes, and surrounding promenade lanterns ignite in a warm harmonic swell.
  4. **Stage D — High-Altitude Island Silhouette & Dedication (`13.8s – 24.0s`)**:
     - Keeping its look-target anchored through the heart of the plaza, the camera soars upward and backward to `(0, 335m, -285m)` with a soft `4.2px` optical blur, warm interior mist veil, and luminous heart shoreline halo—revealing the entire heart-shaped island as **"This world is yours my love"** fades in across the upper sky (`16.0s – 21.4s`), before gliding back to Harsha at `24.0s`.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Atmospheric romantic realism—transitioning from an intimate portrait of the Central Plaza's golden heart sculpture to the sweeping aerial silhouette of Heart Island.
  - *Color Palette & Mood*: Champagne gold (`#fde68a`), warm tungsten (`#f59e0b`), crystal rose (`#f472b6`), and deep twilight slate (`#090b10`).
  - *Typography & Hierarchy*: Clean serif/display headline for *"This world is yours my love"* (`text-3xl sm:text-5xl font-semibold tracking-tight text-white`) paired with a subtle uppercase kicker (`For Harsha · Valentine's Day`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Aligning Stage B/C Camera Trajectory with the Central Plaza Heart Arch (`(0, plazaBaseY + 6.0, 0)`)**
  - *Chosen Approach*: Set `_camStageCLook` to `(0.0, plazaBaseY + 6.0, 0.0)`—the exact world coordinates of the Brushed-Gold Heart Arch and Levitating Crystal Heart Core in `CentralPlaza`—and position `_camStageCPos` at `(0.0, plazaBaseY + 8.8, -21.5)` with a gentle continuous pullback drift so the heart arch is framed symmetrically in the center of the viewport before Stage D climbs straight up the southern axis to `(0, 335, -285)`.
  - *Why*: Previously, `_camStageCPos` stayed offset to the southwest (`X = -16.5`) looking toward `Z = +10`, which viewed the plaza obliquely. Aligning `_camStageCPos` on the central `X = 0` axis looking directly at `(0, plazaBaseY + 6.0, 0)` frames the Central Plaza's center heart head-on and makes the subsequent Stage D climb to `(0, 335, -285)` a seamless, straight-line vertical crane & pullback along the island's centerline.
  - *Alternatives Considered*: Keeping the oblique southwest angle was rejected because the heart arch is sculpted in the `X-Y` plane (`getHeartCurvePoint`), meaning its heart silhouette reads with maximum clarity when viewed along the `Z` axis (`X ≈ 0`).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Camera Choreography Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                24.0s DREAM WORLD REVEAL CAMERA & UI PIPELINE                 │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────────┐
│   Stage A (0–4.5s)    │   │ Stages B & C (4.5–13.8s)│ │ Stage D (13.8–24.0s) │
│  Behind Harsha Spawn  │   │  First Camera Pullback│   │ High-Altitude Vista  │
│  Pos: (-19.2, 6.9, 10)│   │  Pos -> (0, 13.0, -21)│   │ Pos -> (0, 335, -285)│
│  Look: Harsha         │──▶│  Look -> Plaza Center │──▶│ Look -> Island Heart │
│                       │   │  Heart (0, 10.2, 0)   │   │ Soft 4.2px Blur +    │
│                       │   │  Fountain & Lights On │   │ Shoreline Halo +     │
│                       │   │                       │   │ "This world is yours │
│                       │   │                       │   │  my love" Title Card │
└───────────────────────┘   └───────────────────────┘   └──────────────────────┘
```

### Interactive Component & State Mapping
- **Reveal Camera Director**:
  - Computes `plazaBaseY = getTerrainHeight(0, 0)` (`~4.2m`) so `_camStageCLook` targets `(0.0, plazaBaseY + 6.0, 0.0)`—the exact center of the Luminous Heart Fountain's sculpted golden heart arch and levitating crystal heart core (`coreHeartMesh` at `y = 6.25` local).
  - During `4.5s – 9.5s` (Stage B), smoothly interpolates from `_camStartPos` / `_camStartLook` to an intimate framing of the Central Plaza Heart (`(0.0, plazaBaseY + 7.2, -16.5)` looking at `(0.0, plazaBaseY + 6.0, 0.0)`).
  - During `9.5s – 13.8s` (Stage C), performs a slow, steady pullback along the southern plaza axis from `Z = -16.5m` to `Z = -24.0m` (`Y = plazaBaseY + 9.4m`) while keeping the camera focused dead-center on the illuminating Plaza Heart Arch (`(0.0, plazaBaseY + 6.0, 0.0)`).
  - At `13.8s` (Stage D), transitions smoothly along the same `X = 0` centerline up to `(0.0, 335.0, -285.0)` looking at `(0.0, 6.0, 32.0)`.
- **Dedication Overlay UI**:
  - Renders `"This world is yours my love"` inside the Stage D title card (`16.0s – 21.4s`) with smooth fade-in and fade-out opacity.
