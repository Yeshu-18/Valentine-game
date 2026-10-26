# 360° Celestial Aurora Dome, Lush Meadow & Romantic Music Transition

Transform the underground sequence at Aurora Lake Vista so that descending into pitch darkness forms an enclosing 360-degree celestial dome around the couple, slowly reveals undulating aurora light across the entire dome interior and lush emerald greenery below, and transitions the audio into an intimate romantic musical score.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All core visual and audio preferences from your clarifications and feedback have been incorporated into this updated plan:

- **Confirmed Decision 1 (360° Dome Formation)**: Upon reaching the underground sanctuary and passing through pitch darkness, an enclosing 360-degree spherical dome forms around the entire space—completely replacing the brown rock walls and shaft so the couple is surrounded in all directions (`360°` azimuth and zenith) by the celestial dome interior.
- **Confirmed Decision 2 (Slowly Revealing Aurora Inside the Dome)**: Inside the 360° dome, darkness gradually blooms into tiny starlight points followed by slowly awakening, multi-layered aurora curtains (emerald, teal, violet, and rose) that flow seamlessly across the curved interior of the dome.
- **Confirmed Decision 3 (Lush Emerald Greenery Floor)**: As the dome's aurora light slowly builds, it illuminates a vibrant emerald grass meadow dotted with softly glowing magical woodland blossoms surrounding the reflective pond and viewing bench.
- **Confirmed Decision 4 (Romantic Music Transition)**: As the subterranean descent rumble fades into silence and the dome begins revealing its aurora light, the audio transitions into a warm, melodic romantic score (gentle arpeggiated piano/harp notes over lush major-9th string pads) that swells tenderly through the proposal and emotional hold.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces the brown subterranean cavern with a magical other-world sanctuary enclosed within a seamless 360-degree celestial dome. After descending into pitch darkness, the dome interior slowly awakens with sweeping aurora ribbons, illuminating a lush emerald meadow, a mirror-like koi pond, and the couple's quiet romantic moment accompanied by a dedicated romantic musical theme.
- **Target Audience / Persona**: Harsha experiencing a personal, wonder-filled Valentine's Day discovery crafted by Yeshwanth.
- **Key Value**: Creates an unforgettable emotional contrast—moving from the quiet mystery of pitch darkness into a breathtaking 360° enveloping aurora dome and romantic melody before Yeshwanth's proposal.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Surface Discovery & Descent**: Player stands on the ancient stone at Aurora Lake Vista (`0, 55`) and presses `E`. The stone smoothly descends as surface light dims into complete pitch darkness (`#02040a`), hiding any brown rock walls once at the bottom.
  2. **Pitch Dark Anticipation & Yeshwanth's Arrival**: In the quiet darkness, a soft warm rim light outlines Yeshwanth as he walks up and invites Harsha: *"Come. Sit with me."* They sit together on the mossy stone bench.
  3. **360° Dome Formation & Slow Aurora Reveal**: Above and all around them (`360°`), the interior of a vast celestial dome begins to shimmer. First, delicate stars twinkle across the dome ceiling; then, soft teal and emerald aurora ribbons slowly unfurl and undulate around the entire 360° dome curvature, gradually blending into violet and rose hues.
  4. **Romantic Music Transition & Lush Meadow Illumination**: Synchronized with the dome's awakening, the ambient sound shifts into a warm, romantic musical piece (expressive bell-piano melody and warm harmonic pads). The growing aurora light gradually reveals the lush emerald grass floor, glowing woodland blossoms, and the tranquil pond with colorful swimming fish.
  5. **Proposal & Return**: Yeshwanth delivers the romantic dialogue and proposal under the glowing 360° dome while the romantic music plays softly. Afterward, the dome gently dims as the stone ascends back to the surface at Aurora Lake Vista.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Ethereal celestial sanctuary inside a seamless 360° planetarium-like aurora dome paired with a bioluminescent botanical glade.
  - *Color Palette & Mood*:
    - Pitch Dark State: Deepest midnight void (`#020308`) with zero brown or muddy tones.
    - 360° Dome Aurora Palette: Bioluminescent turquoise (`#2dd4bf`), aurora emerald (`#34d399`), celestial violet (`#a855f7`), and soft rose-gold (`#f472b6`).
    - Lush Greenery Floor: Deep velvet emerald (`#155e3b`), sunlit meadow green (`#2ea866`), and pastel blossom emissives (`#67e8f9`, `#fbcfe8`, `#fde68a`).
  - *Interactive Feedback & Motion*: Smooth shader-driven reveal (`uDomeReveal`, `uAuroraIntensity`) across the 360° hemisphere geometry, gentle wind sway on meadow blossoms, and synchronized audio crossfading.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Seamless Back-Face 360° Hemisphere & Multi-Layer Ribbon Dome**
  - *Chosen Approach*: Construct the underground sky as an enclosing 360-degree spherical dome (`BackSide` rendered hemisphere with concentric inner aurora curtain shells) that completely encompasses the meadow floor from horizon to zenith, hiding the descent shaft walls once underground.
  - *Why*: Guarantees that no matter where the camera orbits or tilts, the viewer is 100% surrounded by the 360° dome and aurora light with zero brown rock clutter.
  - *Alternatives Considered*: Keeping rock cavern walls with a small ceiling hole was rejected because it looked brown and cramped rather than an enveloping magical realm.

- **Decision 2: Procedural Web Audio Romantic Melodic Score**
  - *Chosen Approach*: Upgrade the audio synthesizer to transition from the subterranean rumble into a multi-layered romantic composition featuring a warm stereo chord pad (`Fmaj9` → `Cmaj9` → `Dm9` → `G13` progression) accompanied by a tender, slow-tempo melodic motif (soft Rhodes/celesta-like bell tones with warm reverb tail).
  - *Why*: Delivers an unmistakable shift into a romantic musical atmosphere right as the aurora light begins to bloom inside the dome, with zero external audio asset loading delays.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Aurora Underground Cinematic System                   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  360° Celestial Dome │  │ Lush Emerald Meadow  │  │   Romantic Audio     │
│      & Shaders       │  │   & Mirror Pond      │  │     Synthesizer      │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ • Full 360° Sky Dome │  │ • Emerald Grass Disc │  │ • Descent Stone Hum  │
│   (Stars + Nebula)   │  │   (Vertex Gradient)  │  │ • Star Chime Arpeggio│
│ • Dual-Layer 360°    │  │ • Instanced Glowing  │  │ • Romantic Chord     │
│   Aurora Curtains    │  │   Meadow Blossoms    │  │   Progression Pads   │
│ • Progressive Reveal │  │ • Reflective Pond &  │  │ • Expressive Celesta │
│   Uniforms (0 → 1)   │  │   Swimming Koi Fish  │  │   / Piano Melody     │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

### Interactive Component & State Mapping

- **`DESCENDING` → `UNDERGROUND_DARKNESS`**:
  - As the stone plinth reaches underground depth, the vertical shaft mesh fades out (`opacity: 1 → 0`) so the space opens into pure pitch darkness inside the unlit 360° dome.
- **`SKY_REVEAL` → `AURORA_REVEAL`**:
  - Triggers `startRomanticMusic()` on the audio synthesizer, starting the warm chord progression and gentle melodic notes.
  - Smoothly interpolates `uDomeStarIntensity` (`0 → 1`) and `uAuroraIntensity` (`0 → 1`) over 14 seconds so the aurora ribbons slowly materialize and wrap 360 degrees around the dome interior.
  - Simultaneously ramps up the meadow floor illumination (`uMeadowReveal: 0 → 1`) and blossom emissive glow, unveiling the lush greenery beneath the couple.
- **`RETURN_PREP` → `ASCENDING`**:
  - Gently fades the 360° aurora dome and romantic music out as the shaft walls reappear for the physical ascent back to Aurora Lake Vista.
