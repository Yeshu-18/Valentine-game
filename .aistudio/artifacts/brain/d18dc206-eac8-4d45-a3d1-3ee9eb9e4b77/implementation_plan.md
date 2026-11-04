# Heartline Underwater Ocean Coral Journey — Revised Implementation Plan

## 1. Physical Track Path Diving Into the Ocean & Rising Back to Open Sky

Per your direction and the reference storyboard (`T+00s` to `T+28s`), the Heartline roller coaster track will **physically descend into the submerged ocean water** after the Dream Castle Flyby, travel completely **underwater through the Ocean Coral Reef**, and **rise back out of the ocean water into the open sky** before the Final Helix:

1. **Submerged Ocean Reef Trench & Lagoon Integration (`src/world/terrainMath.ts` & `src/world/IslandTerrain.ts`)**:
   - Carve a deep **Eastern Ocean Reef Inlet & Submerged Coral Trench** (`x = 82..156, z = 66..96`) where the seabed drops down to `Y = -5.8m` beneath the animated ocean surface (`Y = 0.0m`), connected via a stepped crystal-water waterfall plunge pool from the Crystal Tunnel portal (`x = 79.5, z = 73.5`).
   - Configure the ocean surface material (`DoubleSide` + translucent underside shimmer and splash mist rings at the entry plunge and exit breach) so riders physically see the track dive beneath the ocean surface and see sunlit ocean waves and volumetric rays overhead while underwater.

2. **Updated Coaster Track Spline (`src/world/heartline/HeartlineTrackSpline.ts`)**:
   - **`T+00s` — Transition In (`u = 0.53–0.56`)**: The track enters the Crystal Tunnel at `(79.5, 13.8, 73.5)` and plunges down a crystalline water tunnel ramp through the ocean surface (`Y = 0.0m`) into the submerged ocean reef floor (`Y = -3.8m`).
   - **`T+03s` — First Reef (`u = 0.56–0.60`)**: Track glides underwater along the sandy coral seabed (`Y = -4.2m`, `x = 96..112, z = 82..89`) surrounded by colorful staghorn/brain corals and yellow-and-blue tropical fish schools. World-space glowing text: **"You are my world."**
   - **`T+08s` — Living Reef (`u = 0.60–0.63`)**: Track curves deeper into the Eastern Ocean Reef (`Y = -4.5m`, `x = 112..128, z = 89..84`) between tall coral towers, swaying sea fans, and gliding sea turtles. World-space glowing text: **"My heart belongs to you."**
   - **`T+13s` — Coral Passage (`u = 0.63–0.66`)**: Track sweeps through an overarching underwater **Coral Arch Passage** (`Y = -4.4m`, `x = 128..138, z = 84..76`) filled with rising bubble streams, volumetric blue sunbeams piercing from the ocean surface above, and pulsing bioluminescent jellyfish. World-space glowing text: **"With you, everything feels magical."**
   - **`T+18s` — Heart Reef (`u = 0.66–0.69`)**: Track aligns straight through a monumental **Heart-Shaped Coral Formation** (`Y = -4.0m`, `x = 134..122, z = 72..69`) teeming with swirling reef fish. World-space glowing text: **"You are my happy place."**
   - **`T+23s` — Underwater Heartline Element (`u = 0.69–0.74`)**: Still submerged beneath the ocean surface (`Y = -3.6m` rising to `-1.8m`, `x = 122..104, z = 69..72`), the train sweeps through twin glowing neon-blue & pink **Heartline Arches** surrounded by jellyfish, coral gardens, and rising bubbles, framing the grand glowing centerpiece: **"I LOVE YOU ❤️"**.
   - **`T+28s` — Final Reef & Exit to Open Sky (`u = 0.74–0.78`)**: The coral reef opens up, volumetric sunlight brightens overhead, and the coaster track **physically breaches upward out of the ocean water surface (`Y = 0.0m` → `Y = 14.5m`)** back onto the island garden run (`(88, 14.5, 75)` → `(76, 16.4, 84)`) toward the Final Panoramic Helix and Station.

---

## 2. Underwater Ocean Environment & Marine Life (`src/world/heartline/HeartlineUnderwaterReef.ts`)

All repeating geometry uses `THREE.InstancedMesh` and shared `BufferGeometry` tracked via `ResourceTracker` with zero per-frame allocations:

- **Ocean Entry Plunge & Exit Breach Splash Portals**: Shimmering water-curtain rings, foam crests, and rising bubble curtains where the track dives below `Y = 0.0m` and where it breaches back into the open sky.
- **Submerged Canyon Walls, Seabed & Overhead Caustic Water Surface**: Sculpted ocean rock cliffs framing the reef corridor, sandy seabed with animated caustic light ripples, and 14 volumetric blue-cyan light-ray shafts (`AdditiveBlending`, `depthWrite: false`) streaming down from the ocean surface (`Y = 0.0m`) to the seabed (`Y = -5.5m`).
- **Colorful Coral Reef Ecosystem (`InstancedMesh`)**:
  - 110 branching staghorn & antler corals in vibrant pink (`#f472b6`), magenta (`#e879f9`), coral orange (`#fb923c`), and electric cyan (`#38bdf8`).
  - 90 brain corals, fluted tube sponges, and glowing sea anemones along the ocean floor and rocky ledges.
  - Sculpted **Coral Arch Passage (`T+13s`)** and **Heart-Shaped Coral Reef Arch (`T+18s`)** with `>= 2.6m` radial clearance around the rails.
  - **Twin Glowing Heartline Neon & Crystal Ribbons (`T+23s`)** framing the underwater **"I LOVE YOU ❤️"** climax.
- **Living Marine Life (`InstancedMesh`, Zero Allocation in `update()`)**:
  - **Schools of Tropical Fish (150 instances)**: Yellow-and-blue regal tangs and pink-gold reef fish swimming along the track and swirling around the Heart Reef.
  - **Gliding Sea Turtles (6 instances)**: Animated sea turtles swimming gracefully beside and above the coaster train.
  - **Glowing Jellyfish (32 instances)**: Translucent pulsing magenta, lavender, and cyan jellyfish drifting around the Coral Passage and Heartline Element.
  - **Rising Ocean Bubbles & Bioluminescent Sparkles (140 instances)**: Continuous upward bubble streams rising toward the ocean surface.

---

## 3. World-Space Romantic Texts & Underwater Atmosphere Transition

- **World-Space Glowing Cursive Text Installations**: Each of the storyboard texts (*"You are my world."*, *"My heart belongs to you."*, *"With you, everything feels magical."*, *"You are my happy place."*, and **"I LOVE YOU ❤️"**, plus entry/exit whispers) is rendered on a transparent, additive-blended luminous 3D mesh with a glowing heart emblem suspended directly over the underwater track ahead of the rider.
- **Underwater Camera & Pacing Integration (`HeartlineTrackSpline.ts`, `HeartlineTrainSolver.ts`, `HeartlineCameraRig.ts`)**:
  - Smooth underwater speed profile (`~9.5–11.5 m/s`) across `u = 0.54–0.75` so the underwater journey lasts ~28 seconds matching the `T+00s` to `T+28s` script, followed by a powerful buoyant launch boost as the train rises back out of the ocean to the open sky at `u = 0.74–0.78`.
  - Keep all Castle Rear Garden (`z <= 57.5`), Station (`(70, 13.15, 78)`), and Love Meadow (`(90, 17.6, 110)`) coordinates completely untouched.
