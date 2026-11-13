# BPS GO!+ 2026 Flashback — source

The delivered single HTML file is built from these sources (all in the repository root).

- `data.json` — all text and figures: the BPS GO!+ roadmap 2026 (People, Process, System), Reflection 2026, the Picture of Future zones and the closing. Also embedded in the HTML as the `workshop-data` block, so you can edit the HTML directly instead. Each KPI has a `status` (`ok`, `watch`, `behind`) that colours it on the KPI wall.
- `characters.js` — procedural rigged characters and every body animation (walk, sit, wave, point, handshake, clap, celebrate…).
- `director.js` — the six chapters (opening, 2026 Flashback through the main gate, KPI wall, Picture of Future tour, BPS GO!+ roadmap, closing): staging, camera shots, choreography and subtitles.
- `factory.js` — the modern plant laid out like the JaP Picture of Future (NHA left, VE Pump right, main gate between them, ABE store, finish goods store, supplier and customer docks), the forecourt and the sliding "2026 | FLASHBACK" gate.
- `rooms.js` — the KPI wall (left of the entrance), the BPS GO!+ stand with its four pillars (right of the entrance) and the SCRUM review room.
- `assets/` — the BPS GO!+ logo, the Lead Work Win image and the reflection picture, embedded into the HTML at build time.
- `camera.js` — camera moves, follow and orbit.
- `ui.js`, `style.css`, `index.html` — interface, panels, the zoomable roadmap overlay (BPS GO!+ icon or `B`), pause (`K`) and presentation mode.
- `vendor.js`, `lib.js` — the Three.js subset that is bundled, and how the app imports it.
- `main.js` — entry point: renderer, scene, main loop.

Rebuild:

```bash
npm install
npm run build
```

Output: `dist/bosch-bps-strategy-workshop-2026.html`. Add `?quality=low` to the URL on slow machines.

To use real 3D models later, load GLB files with Three.js GLTFLoader and swap them in where `makeCast`, `makeRobot` or `makeAGV` build placeholders.
