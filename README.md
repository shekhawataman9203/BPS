# BPS Strategy Workshop 2026 — source

The delivered single HTML file is built from these sources (all in the repository root).

- `data.json` — all text and figures (sample data). Also embedded in the HTML as the `workshop-data` block, so you can edit the HTML directly instead.
- `characters.js` — procedural rigged characters and every body animation (walk, sit, wave, point, handshake, clap, celebrate…).
- `director.js` — the eight chapters: staging, camera shots, choreography and subtitles.
- `factory.js`, `rooms.js` — the factory hall, meeting room, KPI hologram and strategy house.
- `camera.js` — camera moves, follow and orbit.
- `ui.js`, `style.css`, `index.html` — interface, panels, presentation mode.
- `vendor.js`, `lib.js` — the Three.js subset that is bundled, and how the app imports it.
- `main.js` — entry point: renderer, scene, main loop.

Rebuild:

```bash
npm install
npm run build
```

Output: `dist/bosch-bps-strategy-workshop-2026.html`.

To use real 3D models later, load GLB files with Three.js GLTFLoader and swap them in where `makeCast`, `makeRobot` or `makeAGV` build placeholders.
