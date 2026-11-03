# Heartline — The Sky of Our Dreams (Flagship Roller Coaster Attraction)

Transforms the Northeast Spectacular Thrill Zone into a complete, physically walkable and rideable flagship roller coaster attraction featuring a sapphire-and-pearl ground arrival precinct, a 4-car articulated bogie train, a 12-zone closed C2 track circuit, a 45-meter crest downward reveal of a sculpted botanical "I LOVE YOU ❤️" meadow, and an additive seat-mounted cinematography layer running at 60 FPS.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user-experience choices have been confirmed from your answers and are locked into the specification:

- **Confirmed Decision 1 — Complete Replacement of Placeholder Coaster**: The new Heartline attraction completely replaces the old distant placeholder coaster and armillary monument in the Northeast Thrill Zone so there are zero overlapping rails or duplicate structures.
- **Confirmed Decision 2 — Flexible Ticketing & Queue Boarding Flow**: Approaching the Octagonal Ticket Booth offers `[E] Ride Heartline` (confirming a ticket with a chime, summoning/docking the train, and opening the scenic Hydrangea & White-Rose Queue Garden through the Elevated Viewing Deck to the Station), while walking directly to the Station Boarding Platform also supports `[E] Board Heartline` at any time.
- **Confirmed Decision 3 — Seat Camera Framing & Look-Around Balance**: While seated in Car 0, the camera smoothly locks onto the downward botanical `"I LOVE YOU ❤️"` meadow framing during the 45-meter Crest Reveal (keeping the blue coaster nose in the top 15% of the viewport and the meadow across the lower 85% for 1.8–2.0 seconds) and blends with subtle player mouse/trackpad look-around freedom across the remaining track zones.

---

### 1. Overview & Core Concept

- **What It Does**: Delivers an end-to-end theme-park flagship coaster experience—starting from a curved sapphire-and-pearl entrance gateway on the Northeast Boulevard, leading through a forecourt, octagonal ticket pavilion, botanical queue garden, and elevated viewing deck into an open-air sapphire glass station where Harsha and Yeshwanth board the lead car of a 4-car articulated blue train across a 12-zone choreographed circuit.
- **Target Audience / Persona**: Players exploring the Valentine Dream World who want an emotional, physically grounded spectacle that blends high-speed roller coaster thrills with an intimate, non-UI architectural discovery (`"I LOVE YOU ❤️"` sculpted directly into the living landscape below the 45-meter summit).
- **Key Value**: Replaces a static background loop with a living, 21-act spatial performance where the train, track lighting, crystal tunnel ribs, Dream Castle sightlines, and botanical earthworks respond dynamically to the train's physical arc-length position.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Ambient Park Presence (Act 0 — `PRE_RIDE`)**: As the player walks the Northeast Boulevard, the towering 45-meter sapphire Lift Hill and sweeping Heartline silhouette rise against the sky. Every 15–25 seconds, the 4-car blue train autonomously runs the circuit, station beacons pulse softly, and crystal clusters shimmer.
  2. **Ground Arrival & Queue Walk**: Passing beneath the curved **HEARTLINE / THE SKY OF OUR DREAMS** entrance arch, the player enters the blue-stone Ticket Forecourt and approaches the **Octagonal Luxury Ticket Booth** (`[E] Ride Heartline`). A gentle confirmation chime sounds, the train docks at the Boarding Platform, and the player strolls along a wide (`>= 2.8m`) garden path lined with blue hydrangeas, white roses, and lavender up to the **Elevated Viewing Deck** (where the main track passes overhead) and into the **Open-Air Sapphire & Pearl Station**.
  3. **5-Second Boarding Sequence (Act 1 — `STATION`)**: Pressing `[E] Board Heartline` seats Harsha and Yeshwanth in Car 0 and attaches the camera to the physical seat eye-point. Over 5 seconds of quiet anticipation: seat suspension settles (`T+1.0s`, `-0.03m`), blue over-the-shoulder restraints lower and click (`T+1.5s`), the nose-heart crystal emblem illuminates (`T+2.0s`), station ambient audio dips (`T+3.0s`), mechanical brakes release (`T+4.0s`), and drive tires smoothly roll the train out (`T+5.0s`).
  4. **The 12-Zone Ride Journey (Acts 2–20)**:
     - **Departure & 45m Lift Hill**: 5 pairs of sapphire departure beacons ignite sequentially ahead of the nose car as the train engages the chain lift (`~5.5 m/s`), revealing Central Plaza, Aurora Lake, the Carnival Midway, and the Pastel Dream Castle in vertical layers.
     - **The 45m Crest & Botanical `"I LOVE YOU ❤️"` Reveal**: Nearing the summit, particles calm and the train slows to a `~2.2 m/s` trim creep. Directly below lies a gently rolling meadow tilted `18°` toward the crest sightline where two-tone cut turf, shaped earth berms, white flower borders, and natural red rose bushes (`#e11d48`) form `"I LOVE YOU ❤️"`. The seat camera smoothly pitches down (`-52°`) for `1.8–2.0 seconds` with zero UI, floating text, or fireworks.
     - **62° Major Drop & Sweeping Castle Flyby**: Crossing the crest exit marker lifts the camera forward as gravity accelerates the train up to `~26 m/s` (`FOV: 54° → 68°`). A low banked turn sweeps into an elevated flyby outside the Dream Castle's exclusion envelope across a manicured Castle-Side Garden Buffer while castle windows brighten and the camera softly biases (`0.40`) toward the spires.
     - **Gemstone Crystal Tunnel, Heartline Element & Garden Speed Run**: Progressive blue-to-lavender crystal shards lead into an enclosed translucent Crystal Tunnel where rib arches illuminate sequentially ahead of the train (`TRAIN → 💡1..💡5`), bursting back into open sky before banking through the signature 3D **Heartline Element** and racing low through arches, flower beds, a signature coaster bridge over a walkable path, and a reflective stream.
     - **Final Helix, Distant Meadow Callback & Brake Run**: A wide rising spiral gradually decelerates the train, offering a natural distant callback view of the `"I LOVE YOU ❤️"` meadow and a grand panoramic reveal of the entire island before entering the magnetic brake run (`FOV → 52°`).
  5. **Station Return & Exit Garden (Act 21)**: The train glides to a smooth stop at `s = 0`, shoulder restraints open, and walking control is cleanly restored on the **Station Exit Platform**, leading through the **Exit Garden** back to the **Exit Plaza**.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Romantic Luxury Fantasy Coaster—sleek aerospace-grade tubular steel engineering fused with translucent sapphire glass, pearl-white stone architecture, and curated botanical landscaping.
  - *Color Palette & Mood*:
    - **Main Track Rails**: Sapphire / Royal Blue (`#1e40af` / `#2563eb`)
    - **Track Spine & Running Highlights**: Electric Cyan-Blue (`#38bdf8`)
    - **Support Columns**: Deep Navy (`#0f172a` / `#1e3a8a`) grounded by Pearl-White foundation collars (`#f8fafc`)
    - **4-Car Train**: 70% Deep Sapphire Blue, 20% Pearl White shells, 10% Cyan Crystal emblem & strips + subtle Champagne-Gold trim (`#d8b467`)
    - **Station, Gateway & Ticket Pavilion**: Pearl White stonework + Sapphire Glass canopies + Cyan Crystal accents + restrained Champagne Gold
    - **Crystal Tunnel**: Translucent Cyan (`#22d3ee`) transitioning to Lavender (`#c084fc`)
    - **Botanical Gardens & Meadow**: Natural Emerald/Forest Greens (`#15803d`, `#166534`, `#4ade80`, `#14532d`) + Blue Hydrangeas, White Roses, Lavender, and Natural Red Roses (`#e11d48`) for the meadow heart.
  - *Typography & Signage Hierarchy*: Clean architectural serif lettering (`Cinzel` / `Georgia`) for the illuminated **`HEARTLINE`** header paired with crisp geometric sans (`Plus Jakarta Sans`) for **`THE SKY OF OUR DREAMS`** and **`TICKETS`** signage.
  - *Interactive Feedback & Motion*: Frame-rate-independent exponential damping (`dampValue` / quaternion `slerp`) across all restraint animations, FOV transitions, horizon stabilization, and sequential `InstancedMesh` color waves.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Arc-Length Parameterized Track (`s ∈ [0, totalLength]`) vs. Raw Spline Parameter (`t ∈ [0, 1]`)**:
  - *Chosen Approach*: Precompute a 2048-sample Arc-Length Lookup Table (`LUT`) mapping physical meters `s` to normalized spline parameter `u`, paired with gimbal-safe Parallel Transport frames (`pos`, `tangent`, `normal`, `binormal`) and banking roll interpolation.
  - *Why*: Raw Catmull-Rom `t` spacing varies wildly with control-point density, which causes multi-car trains to accordion-stretch or compress on drops and curves. Arc-length parameterization guarantees that all 4 cars and their 8 wheel bogies maintain exact physical spacing (`s_k = s_lead - k * carSpacing`) with zero floating or rail clipping.
- **Decision 2 — Additive Seat Camera Layer vs. Separate Camera Controller**:
  - *Chosen Approach*: `HeartlineCameraRig` computes `FinalCamera = PhysicalSeatBase + CinematicOffset` and feeds `position`, `target`, and `fov` directly into the existing `PlayerController` camera handoff.
  - *Why*: Preserves single-controller input ownership, eliminates camera cut/teleport artifacts on boarding and exit, and seamlessly blends automated sightline framing (100% locked during the 45m Love Reveal, subtle player look-around elsewhere) with horizon stabilization.
- **Decision 3 — Instanced Emissive Color Waves vs. Dynamic PointLights**:
  - *Chosen Approach*: Batch all track cross-ties, support columns, departure beacons, crystal tunnel rib arches, and meadow rose bushes into `THREE.InstancedMesh` buffers and animate sequential lighting waves via per-instance color attributes (`setColorAt`) and shared material uniforms.
  - *Why*: Sustains a locked 60 FPS with zero per-frame garbage collection and avoids exceeding WebGL shader light limits.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        PlayerController & App Loop                         │
│   • Routes [E] / Enter prompts & camera handoff (pos, lookTarget, fov)     │
│   • Passes delta, elapsedTime, playerPos, and subtle look offsets          │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         HeartlinePrecinctManager                           │
│   • Owns Precinct Group, Walkable Colliders, Ground Arrival Architecture   │
│   • Gateway → Forecourt → Octagonal Ticket Booth → Queue Garden → Deck     │
│   • Open-Air Sapphire/Pearl Station, Exit Garden & Botanical Meadow        │
└──────┬──────────────────┬───────────────────────┬───────────────────┬──────┘
       │                  │                       │                   │
       ▼                  ▼                       ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────┐
│ Heartline    │  │ Heartline        │  │ Heartline         │  │ Heartline   │
│ TrackSpline  │  │ TrainSolver      │  │ Choreography      │  │ CameraRig   │
│              │  │                  │  │ Director          │  │             │
│ • Closed C2  │  │ • Act 0 Autonomous│  │ • Evaluates u ∈   │  │ • Physical  │
│   3D Curve   │  │   Circuit Loop   │  │   [0,1] Intervals │  │   Car 0 Seat│
│ • 2048-Entry │  │ • Act 1 5s Board │  │ • Departure 1..5  │  │   Transform │
│   Arc-Length │  │   Timeline       │  │   Beacon Wave     │  │ • Zone FOV &│
│   LUT (s↔u)  │  │ • Piecewise Drive│  │ • Crystal Tunnel  │  │   Horizon   │
│ • Banking &  │  │   Lift, Creep,   │  │   Rib Pulse Wave  │  │   Lock      │
│   Parallel   │  │   Gravity & Brake│  │ • Castle Flyby &  │  │ • -52° Pitch│
│   Transport  │  │ • 4-Car x 2-Bogie│  │   Heartline LEDs  │  │   Meadow    │
│   Frames     │  │   Rail Solver    │  │ • Ambient Audio   │  │   Hold      │
└──────────────┘  └──────────────────┘  └───────────────────┘  └─────────────┘
```

- **Data Model & State**:
  - **Track Spline & Frame Table**:
    - `totalLength`: Physical loop length in meters (`~620m`).
    - `arcLengthLUT`: `Float32Array(2048)` mapping `s → u`.
    - `TrackFrame`: Pre-allocated `{ pos, tangent, normal, binormal, rollRad, zoneId }` evaluated without heap allocations.
  - **12 Track Zones (`u ∈ [0, 1]`)**:
    - `STATION` (`0.00..0.04`), `DEPARTURE` (`0.04..0.09`), `CLIMB` (`0.09..0.24`, rising to `+45m`), `CREST_REVEAL` (`0.24..0.30`, `~2.2 m/s` hold over the `"I LOVE YOU ❤️"` meadow), `MAJOR_DROP` (`0.30..0.44`, `62°` dive up to `~26 m/s`), `CASTLE_FLYBY` (`0.44..0.53`, outside Dream Castle exclusion radius), `CRYSTAL_TUNNEL` (`0.53..0.63`), `HEARTLINE_ENTRY` (`0.63..0.73`), `LOW_SPEED_RUN` (`0.73..0.82`), `FINAL_HELIX` (`0.82..0.90`), `WORLD_REVEAL_BRAKE` (`0.90..0.97`), and `STATION_RETURN` (`0.97..1.00`).
  - **Train & Ride State Machine**:
    - `ridePhase`: `'PRE_RIDE_CIRCUIT' | 'DOCKED_READY' | 'BOARDING_ACT1' | 'RIDING' | 'UNBOARDING'`.
    - `boardingTimer`: `0.0 → 5.0s` driving seat settle (`1.0s`), shoulder restraint rotation (`1.5s`), nose-heart glow (`2.0s`), audio ducking (`3.0s`), brake release (`4.0s`), and drive-tire launch (`5.0s`).

- **Interactive Component & State Mapping**:
  - **Ticket Booth Interaction (`[E] Ride Heartline`)**: Sets `ticketConfirmed = true`, plays a subtle harmonic chime, illuminates queue garden path lanterns, and transitions the autonomous train to dock at `s = 0` (`DOCKED_READY`).
  - **Station Boarding Interaction (`[E] Board Heartline`)**: Snap-seats the player and companion into Car 0, hides the walking avatar collider, transitions `ridePhase` to `'BOARDING_ACT1'`, and hands camera control to `HeartlineCameraRig`.
  - **Emergency / Early Disembark (`[Esc]` during ride) & Natural Arrival (`STATION_RETURN`)**: Raises shoulder restraints, restores default camera FOV (`60°`), places the player cleanly on the **Station Exit Platform** (`wx, wy, wz`) facing the **Exit Garden**, and resumes normal walking locomotion.
