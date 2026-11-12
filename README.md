# BPS Strategy Workshop 2026 — source

The delivered single HTML file is built from these sources.

- `src/data.json` — all text and figures (sample data). Also embedded in the HTML as the `workshop-data` block, so you can edit the HTML directly instead.
- `src/characters.js` — procedural rigged characters and every body animation (walk, sit, wave, point, handshake, clap, celebrate…).
- `src/director.js` — the eight chapters: staging, camera shots, choreography and subtitles.
- `src/factory.js`, `src/rooms.js` — the factory hall, meeting room, KPI hologram and strategy house.
- `src/ui.js`, `src/style.css`, `src/index.html` — interface, panels, presentation mode.

Rebuild: `npm install three esbuild && node build.mjs` → `dist/bosch-bps-strategy-workshop-2026.html`.
To use real 3D models later, load GLB files with Three.js GLTFLoader and swap them in where `makeCast`, `makeRobot` or `makeAGV` build placeholders.
