# Prequel & Sequel Narrative Game Scripts Integration Plan
*Valentine's Day 2027: A Personal Journey for Harsha*

## Executive Summary

This plan outlines the architecture, scene flow, and integration strategy to bookend the existing 3D Dream World with two emotional, narrative game scripts:
1. **The Prequel (Prologue — "Cell 04: The Awakening" & February 13, 2027 Mystery)**:
   - Starts on the evening of February 13, 2027 at 10:30 PM with the mysterious text message (*"Are you home yet?"*), the dark car approach, and waking up in the locked room (*Cell 04*).
   - Features the interactive rotary telephone (*"You're awake. Good. We need to talk."*), memory clues (the *14/02/2024* photograph, the *Project Hail Mary* movie theater memory, the mall hand-holding / pinky moment, and the real chat confession).
   - Concludes with the door opening, the blindfold sequence, and the major reveal where she realizes the "kidnapper" is her boyfriend Yeshwanth and that he built an entire fantasy world for her.
2. **The Main World (Heart Island & Dream Castle)**:
   - The current rich 3D world (Castle, Wizarding School, Carnival, Heartline Coaster, Ancient Forest, Aurora Grotto).
3. **The Sequel (Epilogue — "The Private Romantic World" behind the Special Gate)**:
   - Activated when she approaches the mysterious Special Gate at the southern tip of Heart Island.
   - Transitions into a serene, deeply personal sanctuary (secluded starlight terrace, private romantic lounge, memories recap, teasing & cuddling moments, and the final romantic Valentine's proposal reaffirmation).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Unified Game State Machine**: The app will transition linearly: `PROLOGUE` (Cell 04 & Mystery Clues) $\rightarrow$ `DREAM_WORLD` (Current 3D Heart Island) $\rightarrow$ `EPILOGUE` (The Private Romantic World).
> - **Seamless Continuity**: At any time, testing or fast-forward controls (discreet chapter selector in dev mode or menu) allow jumping directly between Prologue, Main World, and Epilogue so exploration of existing areas is never blocked during development.
> - **Zero Destruction**: The existing Three.js scene, terrain, castle, coaster, forest, and cinematics remain 100% intact and are simply wrapped by the game director.

- **Confirmed Decision 1**: Linear story flow (`Prologue` $\rightarrow$ `3D World` $\rightarrow$ `Epilogue`).
- **Confirmed Decision 2**: Deeply personal narrative rooted in Yeshwanth & Harsha's real journey (Project Hail Mary theater memory, the pinky moment, the real confession, the "I built you a world" reveal).
- **Confirmed Decision 3**: The Prequel combines atmospheric 3D room exploration (Cell 04) with tactile 2D narrative cards (phone, clues, photos, memories) and blindfold reveal transition.

---

## 1. Overview & Core Concept

- **Core Theme**: *"I built an entire world for you."* The mystery and kidnapping setup is not a horror game—it is an intricate, suspenseful surprise that recontextualizes into an overwhelming romantic gift.
- **Narrative Arc**:
  $$\text{"Where am I?"} \rightarrow \text{"Who is doing this?"} \rightarrow \text{"These are our memories..."} \rightarrow \text{"It's him!"} \rightarrow \text{Dream World Exploration} \rightarrow \text{Private World & Epilogue}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NARRATIVE EXPERIENCE TIMELINE                   │
└────────────────────────────────────────────────────────────────────────┘

  [PHASE I: PREQUEL]
  February 13, 2027 (10:30 PM)
  ├── Scene 1: The Dark Street & "Are you home yet?"
  ├── Scene 2: The Approaching Dark Car
  ├── Scene 3: The Dark Ride & "Almost there."
  ├── Scene 4 & 5: Cell 04 Awakening & Rotary Phone ("We need to talk.")
  ├── Scene 6 & 7: Searching for Clues & 14/02/2024 Photo
  ├── Scene 8: The 3 Core Clue Memories
  │     ├── Memory 1: Project Hail Mary Theater Interval
  │     ├── Memory 2: Hand-Holding & The Pinky Moment
  │     └── Memory 3: The Real Chat Confession
  ├── Scene 9 & 10: The Door Opens & The Blindfold
  └── Scene 11 & 12: Blindfold Removed ➔ THE BIG REVEAL ("It's Yeshwanth!")
        │
        ▼
  [PHASE II: THE DREAM WORLD]
  Third-Person Free Exploration of Heart Island
  ├── Central Plaza & Orientation Hub
  ├── Dream Castle (Lobby, Ballrooms, Jewellery Atelier, Lego Workshop)
  ├── Wizarding School (Sorting Hat, Mirror of Desire, Pensieve, Royal Frog)
  ├── Carnival District & Keepsake Games
  ├── Ancient Forest & Heartwood Sanctuary
  ├── Heartline Coaster (The Lagoon Dive & "I LOVE YOU ❤️" Meadow Reveal)
  └── Underground Aurora Grotto Cinematic (Aurora Lights & Dialogue)
        │
        ▼ (Passing through the Special Gate at the Southern Tip)
  [PHASE III: SEQUEL]
  The Private Romantic World & Epilogue
  ├── Scene 1: Crossing the Special Gate Threshold
  ├── Scene 2: The Starlight Terrace & Warm Fireplace Pavilion
  ├── Scene 3: The Private Journal & Personal Tokens
  ├── Scene 4: Intimate Conversation (Teasing, Cuddling, Heartfelt Truths)
  └── Scene 5: The Final Valentine's Ending ("Will you keep choosing me?")
```

---

## 2. User Experience & Visual Design

### A. The Prequel: "Cell 04: The Awakening"
- **Aesthetic**: Atmospheric noir, low-key lighting, warm incandescent bulb over a wooden desk, heavy steel door, vintage rotary telephone. Suspenseful but cozy and intrigue-driven, not terrifying.
- **Visual Palette**: Deep slate `#090d16`, warm tungsten amber `#d97706`, brass reflections `#ca8a04`, and nostalgic soft sepia.
- **Interactions**:
  - **Phone Interaction**: Click or press **E** on the rotary telephone. Phone rings, handset lifts, audio clicks, and dialogue typewriter displays:
    > *"You're awake. Good. We need to talk."*
  - **The Clue Desk & Photo**: Inspect the vintage photo dated `14 / 02 / 2024`.
  - **Memory Cutscene Cards**:
    1. *Project Hail Mary*: Screen dims, soft cinematic score plays, showing the movie interval memory, wiping the glass, the quiet smile.
    2. *The Pinky Moment*: The hesitation in the car, holding the pinky, the question *"Do you have any intention of a relationship?"*.
    3. *The Real Confession*: Faithful recreation of their actual chat screenshot on a tactile card.
  - **The Reveal**: The steel door unlocks. A silhouette steps in, gently blindfolds her. Screen fades to black with footsteps and ambient wind changing into the magical melody of Heart Island.
  - **The Unveiling**: Blindfold dissolves away with a radial blur reveal into the sun-drenched Central Plaza with Yeshwanth smiling in front of her.

### B. The Sequel: "The Private Romantic World"
- **Aesthetic**: Dreamy pastel starlight, twilight lavender and rose gold, floating candles, moonlit bay overlook, plush cushions, warm fireplace.
- **Location**: Accessed via the Special Gate at the southern tip of the island (`x: 0, z: -110`).
- **Interactive Moments**:
  - **The Memory Hearth**: Sitting together by the fire with gentle acoustic guitar/piano chords.
  - **The Private Letter / Starlight Book**: A personalized book where Harsha can flip through pages containing reflections from Yeshwanth.
  - **Final Romantic Cutscene**: Custom dialogue card flow that wraps up the journey in an intimate, non-rushed dialogue ending.

---

## 3. Technical Architecture & State Strategy

### Component Hierarchy & Game Director
```
┌────────────────────────────────────────────────────────────────────────┐
│                               App.tsx                                  │
│                      (Master Game State Director)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  PrequelDirector │      │ 3D World (Active)│      │  SequelDirector  │
│(Cell 04 & Mystery│      │  (Heart Island)  │      │(Private Sanctuary│
│    Prologue)     │      │   Current Code   │      │    & Epilogue)   │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
  ┌──────┴──────┐           ┌──────┴──────┐           ┌──────┴──────┐
  │- Street/Car │           │- DreamCastle│           │- Gate Portal│
  │- Room 3D/2D │           │- Wizardry   │           │- Starlight  │
  │- Phone/Desk │           │- Coaster    │           │  Pavilion   │
  │- Memories   │           │- Carnival   │           │- Dialogue   │
  │- Blindfold  │           │- Forest     │           │- Final Gift │
  └─────────────┘           └─────────────┘           └─────────────┘
```

### New Modules & File Responsibilities
1. `src/world/story/GameStoryDirector.ts`:
   - Single source of truth state manager (`currentPhase: 'PROLOGUE' | 'DREAM_WORLD' | 'EPILOGUE'`).
   - Handles persistent progression in `localStorage` so refreshing the browser retains her current progress, while providing a quiet developer skip/jump panel (`Shift + ~`).
2. `src/world/story/PrequelScene.tsx`:
   - Handles Scene 1–12 (Night street, car, Cell 04 room, rotary telephone, clue inspector, 3 memory cards, and blindfold reveal).
3. `src/world/story/SequelScene.tsx`:
   - Handles the Special Gate transition, Private Romantic World sanctuary, intimate dialogue sequences, and final Valentine's celebration.
4. `src/world/story/storyAudio.ts`:
   - Procedural Web Audio score specifically tailored to the mystery tension (subtle vinyl crackle, tape hum, muted chime) transitioning to romantic acoustic felt piano and music box.

---

## 4. Verification & Step-by-Step Delivery Plan

1. **Step 1: State Machine & Data Models**: Create `GameStoryDirector.ts` with types, story beats, and memory data.
2. **Step 2: Build the Prequel Experience**:
   - Implement the intro narrative cards (Feb 13, 10:30 PM street & car).
   - Implement the Cell 04 locked room with rotary telephone interaction and the 3 memory cards (*Project Hail Mary*, *The Pinky Moment*, *The Confession*).
   - Implement the blindfold transition and reveal into Heart Island.
3. **Step 3: Wire Main World & Special Gate**:
   - Add the interactive Special Gate trigger at the southern tip of Heart Island that unlocks after exploring or finding clues, leading into the Sequel.
4. **Step 4: Build the Sequel Experience**:
   - Implement the Private Romantic World sanctuary with starlight terrace, private letter, and romantic dialogue.
5. **Step 5: Audio & Polish**:
   - Add ambient audio and transition cues for both Prologue and Epilogue.
   - Test full linear playthrough and run `compile_applet` + `lint_applet` to verify zero errors.
