import { V, Tweens, clamp, ease } from './util.js';
import { allRows, KPI_WALL, houseColumns } from './rooms.js';

const PI = Math.PI;
// Camera shots: pos, target, fov
export const SHOT = {
  g_far: { pos: [7, 2.4, 70], target: [0, 3.6, 32], fov: 42 },
  g_door: { pos: [4.6, 2.3, 44], target: [0, 3.6, 32], fov: 46 },
  g_doorClose: { pos: [2.6, 1.8, 39.4], target: [0, 2.8, 32], fov: 50 },
  in_entry: { pos: [3.4, 2.3, 17.2], target: [0, 1.9, 30], fov: 50 },
  in_greet: { pos: [4.2, 1.9, 29.6], target: [-0.6, 1.4, 25.4], fov: 46 },
  k_wall: { pos: [1.7, 3.85, 27.4], target: [-8.7, 3.75, 23.6], fov: 50 },
  k_close: { pos: [-1.4, 3.7, 27.0], target: [-8.7, 3.7, 23.6], fov: 50 },
  k_team: { pos: [-4.3, 2.1, 28.0], target: [0.4, 1.3, 23.4], fov: 50 },
  in_both: { pos: [3.2, 3.0, 30.6], target: [-5.5, 2.8, 22.5], fov: 58 },
  p_high: { pos: [0, 17, 33], target: [0, 0, 4], fov: 55 },
  p_digital: { pos: [4, 7.4, 24], target: [8, 1.2, 5], fov: 52 },
  p_cell: { pos: [17.2, 2.6, 0.6], target: [23.6, 2.0, 9.0], fov: 50 },
  p_lines: { pos: [0, 4.2, 18.6], target: [0, 1.0, 9.5], fov: 62 },
  p_press: { pos: [5.0, 2.4, 8.0], target: [10.6, 1.6, 1.4], fov: 46 },
  s_stand: { pos: [3.4, 3.9, 28.2], target: [-8.7, 3.75, 23.6], fov: 50 },
  s_close: { pos: [-1.4, 3.7, 27.0], target: [-8.7, 3.7, 23.6], fov: 50 },
  c_low: { pos: [0.5, 1.7, 17.0], target: [0, 1.9, 26], fov: 48 },
  c_crane: { pos: [0, 9.5, 11.5], target: [0, 1.8, 25], fov: 50 },
};
// Fly-to shots for the tour stops
export const ZONE_SHOT = {
  supplier: { pos: [-23, 3.4, -5.5], target: [-31.5, 2.2, -14], fov: 50 },
  inbound: { pos: [17.2, 2.7, -2.6], target: [24.5, 1.5, -10], fov: 48 },
  nha: { pos: [-7.6, 2.6, 6.6], target: [-11, 1.3, 0], fov: 46 },
  assembly: { pos: [-12.0, 2.8, 16.6], target: [-18.5, 1.2, 10.6], fov: 50 },
  veAssembly: { pos: [14.6, 2.8, 16.4], target: [9.0, 1.2, 10.6], fov: 50 },
  machiningNha: { pos: [-18.0, 3.0, 16.2], target: [-23.5, 1.4, 23.5], fov: 50 },
  veTest: { pos: [12.0, 3.0, 16.2], target: [17.5, 1.4, 23.5], fov: 50 },
  ve: { pos: [6.6, 3.0, 7.0], target: [12, 2.0, 0], fov: 46 },
  calibration: { pos: [18.0, 3.2, 1.8], target: [23.5, 1.4, 9], fov: 48 },
  scrum: { pos: [3, 3.4, -4.5], target: [0, 2.2, -14], fov: 50 },
  customer: { pos: [23, 3.4, -5.5], target: [31.5, 2.2, -14], fov: 50 },
};

export const CHAPTERS = [
  { id: 'opening', title: 'Opening', loc: 'overview', dur: 20 },
  { id: 'flashback', title: '2026 Flashback', sub: 'Through the main gate, between NHA and VE Pump', loc: 'gate', dur: 24 },
  { id: 'house', title: 'House of BPS GO!+', sub: 'Where 2026 started: one operating system', loc: 'wall', dur: 30 },
  { id: 'kpis', title: 'KPI wall', sub: 'Every element of the house, target against YTD', loc: 'wall', dur: 30 },
  { id: 'future', title: 'How 2027 looks like', sub: 'Back through the gate, into the plant of 2027', loc: 'gate', dur: 40, stepped: true },
  { id: 'plant', title: 'Picture of Future', sub: 'A walk through the modern plant', loc: 'floor', dur: 36 },
  { id: 'closing', title: 'Lead. Work. Win.', sub: 'Creating value. Together.', loc: 'close', dur: 18 },
];

// Operators at work [x, z, yaw]: NHA assembly line (4), VE pump line (3), NHA component line, VE press,
// calibration cell, NHA machining (front and back), VE end of line test
const OPS = [
  [-26.6, 11.95, PI], [-21.1, 11.95, PI], [-15.6, 11.95, PI], [-10.1, 11.95, PI],
  [4.6, 11.95, PI], [9.1, 11.95, PI], [13.6, 11.95, PI],
  [-22.6, 0.95, PI], [11.2, 1.75, PI], [21.6, 10.2, PI],
  [-22.0, -7.75, PI], [-25.6, 21.2, 0], [15.3, 21.2, 0],
];
export const OPS_COUNT = OPS.length;
// The team waiting inside the gate, facing it
const WAIT = { bps: [-1.2, 25.3], prod: [1.5, 24.8], qual: [0.2, 23.8] };
// The team watching the KPI wall
const WALLTEAM = { bps: [-1.0, 26.2], prod: [0.6, 25.0], qual: [-2.0, 23.4] };
// The team at the BPS GO!+ stand

export class Director {
  constructor(app) {
    this.app = app; this.index = -1; this.token = 0; this.timers = []; this.tw = new Tweens();
    this.goToken = 0; this.scriptDone = true; this.userCam = false; this.chapterTime = 0; this.doneAt = 0;
  }
  get cast() { return this.app.cast; }
  update(dt) {
    this.tw.update(dt);
    this.chapterTime += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if (tm.token !== this.token) { this.timers.splice(i, 1); continue; }
      if (tm.until) { if (tm.until()) { this.timers.splice(i, 1); tm.res(); } }
      else { tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.res(); } }
    }
    const ch = CHAPTERS[this.index];
    if (ch) this.app.ui.setProgress(this.index, this.scriptDone ? 1 : clamp(this.chapterTime / ch.dur, 0, 0.98));
    // autoplay
    if (this.app.ui.autoplay && this.scriptDone && this.index > 0 && this.index < CHAPTERS.length - 1 && this.chapterTime - this.doneAt > this.app.ui.autoplayHold) this.next();
  }

  makeCtx() {
    const token = ++this.token; this.timers.length = 0; this.tw.clear();
    const alive = () => token === this.token;
    const app = this.app, rig = app.rig;
    const ctx = {
      alive,
      wait: s => new Promise(res => this.timers.push({ t: s, res, token })),
      until: fn => new Promise(res => this.timers.push({ until: fn, res, token })),
      // game-time delay (pauses with the animation)
      later: (s, fn) => { this.timers.push({ t: s, res: () => { if (alive()) fn(); }, token }); },
      walk: (ch, pts, o = {}) => new Promise(res => ch.walkTo(pts, { ...o, onArrive: () => { if (alive()) res(); } })),
      cap: (text, o) => { if (alive()) app.ui.caption(text, o); },
      cam: (shot, dur = 3, o) => { if (alive() && !this.userCam) return rig.moveTo(shot, dur, o); },
      cut: shot => { if (alive() && !this.userCam) rig.cut(shot); },
      follow: (t, o) => { if (alive() && !this.userCam) rig.follow(t, o); },
      tween: (dur, fn, e) => this.tw.add(dur, fn, e),
      dip: async (fn) => { app.ui.fade(1, 0.35); await ctx.wait(0.4); fn(); app.ui.fade(0, 0.6); },
    };
    return ctx;
  }

  // ---------- staging helpers ----------
  placeOps() { this.app.ops.forEach((o, i) => { o.place(OPS[i][0], OPS[i][1], OPS[i][2], 'work'); }); }
  placeGroup(spots, yawOf) { const c = this.cast; for (const [id, [x, z]] of Object.entries(spots)) c[id].place(x, z, yawOf(x, z)); }
  all() { const c = this.cast; return [c.bps, c.prod, c.qual]; }
  wallCenter() { return V(KPI_WALL.x, KPI_WALL.y, KPI_WALL.z); }
  yawTo(px, pz) { return (x, z) => Math.atan2(px - x, pz - z); }

  setWorld({ digital = false, gate = false, build = 1, screen = 'kpi', future = false } = {}) {
    const a = this.app;
    a.entrance.wall.setMode(screen);
    a.factory.setDigital(digital); a.factory.setFuture(future); a.ui.yearCard(null);
    a.factory.gate.snap(gate);
    a.entrance.snapBuild(build); a.entrance.highlight(null); a.entrance.hideConfetti();
    a.entrance.wall.highlight(null, null);
  }

  // ---------- chapter states ----------
  stage(id) {
    const c = this.cast, a = this.app;
    for (const ch of [...Object.values(c), ...a.ops]) { ch.gestures.length = 0; ch.aim = null; ch.look = null; }
    this.placeOps();
    const W = this.wallCenter();
    switch (id) {
      case 'opening':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 48, PI); this.setWorld({ gate: false, build: 1, screen: 'house' });
        a.rig.orbit([0, 0, 4], 62, 44, 0.03, 1.1); break;
      case 'flashback':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 48, PI); this.setWorld({ gate: false, build: 1, screen: 'house' }); a.rig.cut(SHOT.g_far); break;
      case 'house': case 'roadmap': case 'kpis':
        this.placeGroup(WALLTEAM, this.yawTo(W.x, W.z)); c.ph.place(-4.6, 24.4, Math.atan2(W.x + 4.6, W.z - 24.4));
        this.setWorld({ gate: true, screen: { house: 'house', roadmap: 'roadmap', kpis: 'kpi' }[id] }); a.rig.cut(SHOT.k_wall); break;
      case 'future':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 40.5, PI); this.setWorld({ gate: false, future: true, screen: 'house27' }); a.entrance.wall.set27(false, 0, true); a.rig.cut(SHOT.g_door); break;
      case 'plant':
        this.placeGroup(WAIT, () => PI); c.qual.place(23.4, 5.7, -PI * 0.75); c.ph.place(0, 21.5, PI); c.bps.place(0.9, 22.2, PI); this.setWorld({ gate: true, digital: true, future: true }); a.rig.cut(SHOT.p_high); break;
      case 'closing':
        this.placeGroup(WAIT, () => PI); c.ph.place(-0.6, 26.8, PI); this.setWorld({ gate: true, future: true, screen: 'house27' }); a.entrance.wall.set27(true, 4, true); a.rig.cut(SHOT.c_low); break;
    }
  }
  // final state of each chapter (used by "Skip scene")
  end(id) {
    const c = this.cast, a = this.app; const lookAll = t => this.all().forEach(m => m.lookAt(t));
    this.stage(id);
    switch (id) {
      case 'flashback': a.factory.gate.snap(true); this.placeGroup(WAIT, () => 0); c.ph.place(0, 27.4, PI); c.bps.place(-0.6, 26.3, PI * 0.75); lookAll(c.ph); a.rig.cut(SHOT.in_both); break;
      case 'house': case 'roadmap': case 'kpis': a.rig.cut(SHOT.k_wall); lookAll(this.wallCenter()); break;
      case 'future': a.factory.gate.snap(true); this.placeGroup(WALLTEAM, this.yawTo(KPI_WALL.x, KPI_WALL.z)); c.ph.place(-4.6, 24.4, Math.atan2(KPI_WALL.x + 4.6, KPI_WALL.z - 24.4)); lookAll(this.wallCenter()); a.entrance.wall.set27(true, 4, true); a.rig.cut(SHOT.k_wall); break;
      case 'plant': c.ph.place(22.2, 5.0, 0.6); c.bps.place(21.1, 4.6, 0.6); c.qual.place(23.4, 5.7, -2.4); a.rig.cut(SHOT.p_cell); break;
      case 'closing': this.rowTeam(true); a.rig.cut(SHOT.c_crane); break;
    }
  }
  rowTeam(snap) {
    const c = this.cast; const order = [c.qual, c.ph, c.bps, c.prod];
    return order.map((m, i) => { const x = (i - 1.5) * 1.4, z = 25.6 - Math.abs(i - 1.5) * 0.25; if (snap) { m.place(x, z, PI); return null; } return [m, x, z]; });
  }

  // ---------- navigation ----------
  next() { if (this.index < CHAPTERS.length - 1) this.go(this.index + 1); }
  prev() { if (this.index > 1) this.go(this.index - 1); else if (this.index === 1) this.go(0); }
  async go(i, { skipTitle = false } = {}) {
    i = clamp(i, 0, CHAPTERS.length - 1);
    const app = this.app, ui = app.ui, ch = CHAPTERS[i];
    const gt = ++this.goToken;
    this.makeCtx(); // cancels running script
    this.stepRes = null; app.timeScale = 1; ui.stepHint(false);
    app.rig.stop(); this.userCam = false; ui.showResetView(false); ui.clearCaptions(); ui.setPins([]); ui.closePanel(true); ui.showSkip(false); ui.closeRoadmap();
    if (this.index >= 0) { ui.fade(1, 0.45); await new Promise(r => setTimeout(r, 470)); if (gt !== this.goToken) return; }
    this.index = i; this.chapterTime = 0; this.scriptDone = false;
    ui.setChapter(i);
    this.stage(ch.id);
    ui.fade(0, 0.8);
    // the gate chapter has no title card: '2026 Flashback' is written on the doors
    if (ch.id !== 'opening' && ch.id !== 'flashback' && ch.id !== 'future' && !skipTitle) ui.titleCard(i, ch.title, ch.sub);
    const ctx = this.makeCtx();
    ui.showSkip(ch.id !== 'opening'); ui.letterbox(ch.id !== 'opening');
    try { await this[ch.id](ctx); } catch (e) { console.error(e); }
    if (!ctx.alive()) return;
    this.finish(ch.id);
    this.ambient(ctx, ch.id);
  }
  finish(id) {
    const ui = this.app.ui;
    this.scriptDone = true; this.doneAt = this.chapterTime; this.app.timeScale = 1; this.stepRes = null; ui.stepHint(false); ui.showSkip(false); ui.letterbox(false);
    if (id !== 'opening') ui.openPanel();
    ui.setPins(this.pinsFor(id));
    if (id === 'flashback' && !ui.rolesByUser) { ui.toggleRoles(true); ui.rolesAuto = true; }
  }
  // stepped chapters: the script waits here until Next (→, Space, clicker) is pressed
  waitStep(ctx, autoAfter = null) {
    this.app.timeScale = 1;
    const auto = autoAfter ?? (this.app.ui.autoplay ? 4 : null);
    return new Promise(res => {
      const done = () => { if (this.stepRes === done) this.stepRes = null; res(); };
      this.stepRes = done;
      if (auto) ctx.later(auto, done);
      this.app.ui.stepHint(true);
    }).then(() => this.app.ui.stepHint(false));
  }
  skip() {
    const ch = CHAPTERS[this.index]; if (!ch || this.scriptDone) return;
    if (ch.stepped) {
      if (this.stepRes) { this.stepRes(); return; }
      this.app.timeScale = 5; // fast-forward the current animation to the next step
      return;
    }
    const ctx = this.makeCtx(); this.app.rig.stop(); this.app.ui.clearCaptions(); this.app.ui.hideTitleCard();
    this.app.ui.fade(1, 0.25);
    setTimeout(() => { if (!ctx.alive()) return; this.end(ch.id); this.app.ui.fade(0, 0.5); this.finish(ch.id); this.ambient(ctx, ch.id); }, 280);
  }

  pinsFor(id) {
    if (id === 'opening') return [];
    const roles = Object.values(this.cast).map(m => ({ id: m.id, type: 'role', label: m.role, pos: () => m.headWorld(), role: true }));
    return [...this.chapterPins(id), ...roles];
  }
  chapterPins(id) {
    const a = this.app, d = a.data, H = a.factory.hotspots, E = a.entrance;
    // the KPI screen itself is clickable, so it needs no markers; pillar markers sit just above it
    const above = pid => () => { const l = E.wall.layout[pid]; return l ? E.wall.spot(l.u, -0.05) : null; };
    if (id === 'plant') return d.plant.zones.map(z => ({ id: z.id, type: 'zone', label: z.name, pos: H[z.id] })).filter(p => p.pos);
    if (id === 'closing') return [{ id: 'logo', type: 'logo', label: 'BPS GO!+ roadmap', pos: () => E.wall.spot(0.09, -0.05) }];
    void above;
    return [];
  }

  // ---------- reactions to user selections (body language and camera) ----------
  select(type, id, { fly = true } = {}) {
    const a = this.app, c = this.cast, ph = c.ph, E = a.entrance;
    const near = p => p && ph.root.position.distanceTo(p) < 14;
    const pointAt = (p, dur = 2.6) => { if (!near(p)) return; ph.faceTo(p); ph.lookAt(p); ph.gesture('point', dur, { target: p }); setTimeout(() => { if (ph.look === p) ph.lookAt(null); }, dur * 1000 + 200); };
    if (type === 'kpi') {
      const r = allRows(a.data).find(r => r.id === id); if (!r) return;
      if (E.wall.mode === 'house') E.wall.setMode('kpi');
      E.wall.highlight(r.group, id); const s = E.wall.rowSpot(id); pointAt(s); this.all().forEach(m => near(s) && m.lookAt(s));
      if (fly && !near(s)) this.fly(SHOT.k_wall);
    }
    if (type === 'house' || type === 'group') {
      clearTimeout(this._toRoadmap);
      const H = a.data.house, el = [...H.pillars, ...H.boosters].find(x => x.id === id);
      const gid = type === 'group' ? id : el?.roadmap;
      const goRoadmap = () => {
        if (E.wall.mode !== 'roadmap') E.wall.setMode('roadmap');
        E.wall.highlight(gid, null);
        const sp = E.wall.rowSpot('rows:' + gid); pointAt(sp); this.all().forEach(m => near(sp) && m.lookAt(sp));
        if (fly) this.zoomScreen('rows:' + gid, 8.5);
      };
      if (id === 'h-house') { if (E.wall.mode !== 'house') E.wall.setMode('house'); E.wall.highlight(id, null); if (fly) this.zoomScreen(id, 7.5); }
      else if (type === 'house' && E.wall.mode === 'house') {
        // zoom into the element on the house, then go to its block in the roadmap
        E.wall.highlight(id, null);
        const sp = E.wall.rowSpot(id); pointAt(sp); this.all().forEach(m => near(sp) && m.lookAt(sp));
        if (fly) this.zoomScreen(id, 5.2);
        if (gid) this._toRoadmap = setTimeout(goRoadmap, 2600);
      } else if (gid) goRoadmap();
    }
    if (type === 'house27') {
      if (E.wall.mode !== 'house27') E.wall.setMode('house27');
      E.wall.highlight(id, null);
      const sp = E.wall.rowSpot(id); pointAt(sp); this.all().forEach(m => near(sp) && m.lookAt(sp));
      if (fly) this.zoomScreen(id, id === 'h-house' ? 7.5 : 5.2);
    }
    if (type === 'reflection') { E.wall.highlight(a.data.reflection.id, id); pointAt(E.wall.rowSpot(id)); }
    if (type === 'kpiCol') { if (E.wall.mode !== 'kpi') E.wall.setMode('kpi'); E.wall.highlight(id, null); pointAt(E.wall.pillarSpot(id)); }
    if (type === 'pillar') { E.highlight(id); pointAt(E.anchor(id)); E.pulse(); }
    if (type === 'logo') { E.highlight(null); E.pulse(); pointAt(E.logoAnchor()); }
    if (type === 'zone' && fly) {
      const shot = ZONE_SHOT[id]; if (shot) this.fly(shot);
      const hp = a.factory.hotspots[id]; pointAt(hp);
    }
  }
  fly(shot) { this.userCam = true; this.app.rig.moveTo(shot, 2.4); this.app.ui.showResetView(true); }
  // camera moves in front of an element on the big screen
  zoomScreen(key, dist = 5) {
    const w = this.app.entrance.wall, l = w.layout[key]; if (!l) return;
    const sp = w.spot(l.u, l.v), ry = KPI_WALL.ry, nx = Math.sin(ry), nz = Math.cos(ry);
    this.fly({ pos: [sp.x + nx * dist, sp.y + 0.15, sp.z + nz * dist], target: [sp.x, sp.y, sp.z], fov: 42 });
  }
  resetView() {
    this.userCam = false; this.app.ui.showResetView(false);
    const id = CHAPTERS[this.index]?.id;
    const shot = { flashback: SHOT.in_both, house: SHOT.k_wall, kpis: SHOT.k_wall, future: SHOT.k_wall, plant: SHOT.p_cell, closing: SHOT.c_crane }[id];
    if (shot) this.app.rig.moveTo(shot, 2.2);
  }

  // ---------- idle life after a chapter's scene ----------
  async ambient(ctx) {
    const c = this.cast, team = this.all();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    while (ctx.alive()) {
      await ctx.wait(3.5 + Math.random() * 3.5);
      if (!ctx.alive()) return;
      const m = pick(team), other = pick([...team, c.ph].filter(x => x !== m));
      const r = Math.random();
      if (r < 0.35) { m.lookAt(other); ctx.later(2.6, () => m.look === other && m.lookAt(null)); }
      else if (r < 0.55) m.gesture('nod', 1.3);
      else if (r < 0.7 && m.base !== 'walk') m.gesture('explain', 2.4);
      else if (r < 0.85 && c.ph.base !== 'walk' && !c.ph.aim) c.ph.gesture(pick(['explain', 'present', 'nod']), 2.4);
      else c.ph.lookAt(Math.random() < 0.5 ? other : null);
    }
  }

  // =================== CHAPTER SCRIPTS ===================
  async opening(ctx) { await ctx.wait(0.1); }

  async flashback(ctx) {
    const { ph, bps, prod, qual } = this.cast, a = this.app, gate = a.factory.gate, d = a.data;
    const team = this.all(), sign = a.factory.hotspots.gate;
    ph.place(0, 40.5, PI);
    ctx.cut(SHOT.g_door);
    ctx.cap(`Main gate, ${d.meta.plant} · 07:58`, { kind: 'marker' });
    ctx.cam(SHOT.g_doorClose, 3.2, { easing: ease.inOutSine, arc: 0 });
    ctx.cap(`The Plant Head walks to the main gate, between ${d.meta.gateLeft} and ${d.meta.gateRight}. On the doors: 2026 Flashback.`);
    ph.lookAt(sign);
    await ctx.walk(ph, [[0, 34.6]], { speed: 2.1 });
    ph.lookAt(null);
    gate.open(true);
    ph.gesture('point', 1.2, { target: V(0, 3.4, 32.4) });
    await ctx.wait(1.3);
    a.ui.flash();
    await ctx.wait(0.3);
    ctx.cut(SHOT.in_entry);
    team.forEach(m => m.lookAt(ph));
    ph.place(0, 31.2, PI);
    const walkIn = ctx.walk(ph, [[0, 27.4]], { speed: 1.9 });
    ctx.cap('Inside, the plant has changed: bright, connected, modern.');
    await ctx.until(() => ph.root.position.z < 29.5);
    gate.glow(false);
    await walkIn;
    const bpsGo = ctx.walk(bps, [[-0.6, 26.3]], { speed: 1.0 });
    ph.gesture('wave', 2.2);
    ctx.cap('The BPS team is waiting at the entrance.');
    [prod, qual].forEach((m, i) => ctx.later(0.3 + i * 0.2, () => m.gesture(i % 2 ? 'nod' : 'waveL', 1.6)));
    ctx.cam(SHOT.in_greet, 2.4);
    await bpsGo;
    ph.faceTo(bps); bps.faceTo(ph); ph.lookAt(bps); bps.lookAt(ph);
    await ctx.wait(0.6);
    ph.gesture('handshake', 2.4); bps.gesture('handshake', 2.4);
    ctx.cap('A handshake with the BPS Lead.');
    await ctx.wait(2.6);
    const W = a.entrance.wall.spot(0.5, 0.4);
    ph.faceTo(W); ph.lookAt(W); bps.lookAt(W); team.forEach(m => m.lookAt(W));
    ph.gesture('point', 2.6, { target: W });
    ctx.cap('On the left, the KPI wall: every BPS GO!+ KPI on one screen.');
    ctx.cam(SHOT.in_both, 3);
    await ctx.wait(3.2);
  }

  async house(ctx) {
    const { ph } = this.cast, a = this.app, h = a.data.house, team = this.all(), wall = a.entrance.wall;
    ctx.cam(SHOT.k_wall, 2.2);
    wall.replay();
    const c = wall.spot(0.5, 0.4); team.forEach(m => m.lookAt(c)); ph.lookAt(c);
    await ctx.wait(1.2);
    ctx.cap('At the start of 2026, we built the House of BPS GO!+: one operating system for the value stream.');
    ph.gesture('present', 2.8);
    await ctx.wait(3.6);
    for (const p of h.pillars) {
      const s = wall.rowSpot(p.id);
      wall.highlight(p.id, null); ph.lookAt(s); ph.gesture('point', 2.6, { target: s }); team.forEach(m => m.lookAt(s));
      ctx.cap(`${p.name}. ${p.driver}: ${p.items.slice(0, 2).join(', ')}.`);
      await ctx.wait(3.4);
    }
    wall.highlight('h-digi', null); const sb = wall.rowSpot('h-digi'); ph.lookAt(sb); ph.gesture('point', 2.4, { target: sb });
    ctx.cap(`System boosters: ${h.boosters.map(b => b.name).join(' and ')}.`);
    await ctx.wait(3.2);
    wall.highlight(null, null); ph.lookAt(null); ph.faceYaw(PI * 0.6); team.forEach(m => m.lookAt(ph));
    ph.gesture('armsOpen', 2.6);
    ctx.cap(h.statement + '.');
    await ctx.wait(3.6);
  }

  async roadmap(ctx) {
    const { ph } = this.cast, a = this.app, rm = a.data.roadmap, team = this.all(), wall = a.entrance.wall;
    ctx.cam(SHOT.k_wall, 2.0);
    wall.replay();
    const c = wall.spot(0.5, 0.5); team.forEach(m => m.lookAt(c)); ph.lookAt(c);
    await ctx.wait(1.0);
    ctx.cap('Aligned with the house, we built the BPS GO!+ Roadmap 2026: every element, quarter by quarter.');
    await ctx.wait(3.4);
    for (const p of rm.pillars) {
      const s = wall.rowSpot(p.id);
      wall.highlight(p.id, null); ph.lookAt(s); ph.gesture('point', 2.4, { target: s });
      ctx.cap(`${p.name}: ${p.motto} ${p.tag}.`);
      await ctx.wait(2.9);
    }
    wall.highlight(null, null); ph.lookAt(null);
    ctx.cap('Click any block on the screen to zoom in, or the BPS GO!+ icon for the full roadmap.');
    await ctx.wait(3.0);
  }

  async kpis(ctx) {
    const { ph, prod } = this.cast, a = this.app, d = a.data, team = this.all(), wall = a.entrance.wall;
    const rows = allRows(d);
    ctx.cam(SHOT.k_wall, 2.2);
    wall.replay();
    const c = wall.spot(0.5, 0.5); team.forEach(m => m.lookAt(c)); ph.lookAt(c);
    await ctx.wait(1.0);
    ctx.cap('And this is the KPI wall: every element of the house, target against year to date.');
    await ctx.wait(3.0);
    ctx.cap(`${rows.length} KPIs on one wall: ${rows.filter(r => r.status === 'ok').length} on track, ${rows.filter(r => r.status === 'watch').length} to watch, ${rows.filter(r => r.status === 'behind').length} behind.`);
    await ctx.wait(3.2);
    for (const col of houseColumns(d)) {
      const s = wall.pillarSpot(col.id);
      wall.highlight(col.id, null); ph.lookAt(s); ph.gesture('point', 2.2, { target: s });
      ctx.cap(`${col.name}: ${col.rows.filter(r => r.status === 'ok').length} of ${col.rows.length} on track.`);
      await ctx.wait(2.6);
    }
    const miss = rows.find(r => r.status === 'behind');
    if (miss) {
      const s = wall.rowSpot(miss.id);
      wall.highlight(miss.group, miss.id); ph.lookAt(s); ph.gesture('point', 2.8, { target: s });
      ctx.cap(`${miss.kpi}: ${miss.ytd} against a target of ${miss.target}.`);
      await ctx.wait(3.0);
      ph.gesture('think', 2.4);
      await ctx.wait(2.0);
    }
    wall.highlight(null, null);
    ctx.cam(SHOT.k_team, 2.4);
    prod.lookAt(ph); prod.gesture('raiseHand', 2.6);
    ph.faceTo(prod); ph.lookAt(prod);
    ctx.cap('A raised hand from Production.');
    await ctx.wait(1.8);
    ph.gesture('nod', 1.3); ctx.later(0.9, () => ph.gesture('explain', 3));
    ctx.cap('A nod, an open hand: every gap gets an owner and a date.');
    await ctx.wait(3.0);
    ph.faceTo(wall.spot(0.5, 0.5)); ph.lookAt(null); team.forEach(m => m.lookAt(wall.spot(0.5, 0.5)));
    ctx.cam(SHOT.k_wall, 2.6);
    await ctx.wait(2.0);
  }

  async future(ctx) {
    const { ph } = this.cast, a = this.app, gate = a.factory.gate, wall = a.entrance.wall, H = a.data.house2027;
    const team = this.all();
    // step 1: the screens go dark, a black card asks the question
    a.ui.fade(1, 0.01); a.ui.yearCard('How 2027 looks like');
    wall.set27(false, 0, true);
    await this.waitStep(ctx, 4);
    a.ui.yearCard(null); a.ui.fade(0, 1.0);
    // step 2: back to the gate, doors read 2027 | FUTURE
    ctx.cap('Main gate · 2027', { kind: 'marker' });
    ctx.cam(SHOT.g_doorClose, 3.2, { easing: ease.inOutSine, arc: 0 });
    ctx.cap('Back at the main gate. This time the doors read 2027.');
    await ctx.walk(ph, [[0, 34.6]], { speed: 2.1 });
    gate.open(true);
    ph.gesture('point', 1.2, { target: V(0, 3.4, 32.4) });
    await ctx.wait(1.3);
    a.ui.flash();
    await ctx.wait(0.3);
    ph.place(0, 31.2, PI);
    ctx.cut(SHOT.p_lines);
    ctx.cap('Inside, the plant of 2027: cobots at the stations, live KPIs over every line, more AGVs on the milk run.');
    const walkIn = ctx.walk(ph, [[0, 27.4]], { speed: 1.6 });
    ctx.cam({ pos: [0, 5.2, 21.5], target: [0, 1.4, 6], fov: 64 }, 5.5, { easing: ease.inOutSine, arc: 0 });
    await ctx.wait(5.0);
    gate.glow(false);
    await walkIn;
    this.placeGroup(WALLTEAM, this.yawTo(KPI_WALL.x, KPI_WALL.z));
    await ctx.walk(ph, [[-4.6, 24.4]], { speed: 1.6 });
    ph.faceTo(this.wallCenter());
    // step 3: the screen shows BPS GO!+ 2027
    ctx.cam(SHOT.k_wall, 2.4);
    const c = wall.spot(0.5, 0.4); team.forEach(m => m.lookAt(c)); ph.lookAt(c);
    ctx.cap('On the screen: BPS GO!+ 2027.', { hold: 600 });
    await this.waitStep(ctx);
    // step 4: the house drops in, its pillars still empty
    wall.set27(true, 0);
    ph.gesture('present', 2.6);
    ctx.cap('The House of BPS GO!+ for 2027.', { hold: 600 });
    await this.waitStep(ctx);
    // steps 5-8: each Next fills one pillar from the right
    for (let i = 0; i < H.pillars.length; i++) {
      const p = H.pillars[i], s = wall.rowSpot(p.id);
      wall.set27(true, i + 1);
      wall.highlight(p.id, null); ph.lookAt(s); ph.gesture('point', 2.4, { target: s }); team.forEach(m => m.lookAt(s));
      ctx.cap(`${p.name}. ${p.driver}: ${p.items.map(it => it.replace(/\*\*/g, '')).join(', ')}.`, { hold: 600 });
      if (i < H.pillars.length - 1) await this.waitStep(ctx);
    }
    await this.waitStep(ctx);
    wall.highlight(null, null); ph.lookAt(null); ph.faceYaw(PI * 0.6); team.forEach(m => m.lookAt(ph));
    ph.gesture('armsOpen', 2.6);
    team.forEach((m, i) => ctx.later(0.6 + i * 0.15, () => m.gesture('clap', 2.4)));
    ctx.cap(H.statement + '.');
    await ctx.wait(3.4);
  }

  async plant(ctx) {
    const { ph, bps, qual: dig } = this.cast, a = this.app, d = a.data.plant, H = a.factory.hotspots; // the Quality Manager presents the AI vision cell
    const Z = id => d.zones.find(z => z.id === id) || { name: id, items: [''] };
    ctx.cap(d.title, { kind: 'marker' });
    ctx.cam(SHOT.p_digital, 6, { easing: ease.inOutSine, arc: 0.05 });
    ctx.cap(d.intro);
    const w1 = ctx.walk(ph, [[0, 8.5], [-6, 6.1], [-11.4, 3.5]], { speed: 1.9 }), w2 = ctx.walk(bps, [[0.8, 8.9], [-6.6, 6.6], [-12.1, 4.35]], { speed: 1.9 });
    await ctx.wait(4);
    ctx.follow(ph, { offset: [3.8, 2.0, 3.6], look: [0, 1.2, -1.2], lag: 1.4 });
    await Promise.all([w1, w2]);
    ctx.cam({ pos: [-7.8, 2.2, 7.4], target: [-11.5, 1.3, 0.6], fov: 46 }, 1.8);
    const line = V(-11, 1.1, 0);
    ph.faceTo(line); ph.lookAt(line); ph.gesture('point', 2.6, { target: line }); bps.lookAt(line); bps.gesture('explain', 3.6);
    ctx.cap(`${Z('nha').name}: ${Z('nha').items[0]}.`);
    await ctx.wait(3.4);
    await ctx.dip(() => { ph.place(9.7, 3.4, PI * 0.8); bps.place(8.9, 4.2, PI * 0.8); ctx.cut(SHOT.p_press); });
    const pr = V(12, 2.0, 0.7);
    ph.lookAt(pr); ph.gesture('point', 2.6, { target: pr });
    ctx.cap(`${Z('ve').name}: ${Z('ve').items[0]}, ${Z('ve').items[1].toLowerCase()}. Behind it, the ${Z('veAssembly').name.split('·').pop().trim().toLowerCase()}.`);
    await ctx.wait(3.0);
    const op = a.ops[5];
    ph.lookAt(op); ph.gesture('thumbsUp', 2.2); op.lookAt(ph); ctx.later(0.5, () => op.gesture('nod', 1.3));
    await ctx.wait(2.2); ph.lookAt(null); op.lookAt(null);
    ctx.cam(SHOT.p_cell, 4.4);
    const w3 = ctx.walk(ph, [[14.5, 4.0], [22.2, 5.0]], { speed: 1.7 });
    const w4 = ctx.walk(bps, [[14.0, 4.8], [21.1, 4.6]], { speed: 1.7 });
    await Promise.all([w3, w4]);
    ph.faceTo(dig); ph.lookAt(dig); dig.lookAt(ph); dig.gesture('nod', 1.2);
    await ctx.wait(0.8);
    const holo = H.calibration.clone();
    dig.faceTo(holo); dig.lookAt(holo); dig.gesture('present', 3.2);
    ph.lookAt(holo); bps.lookAt(holo);
    ctx.cap(`The Quality Manager shows ${Z('calibration').name}: ${Z('calibration').items[0]}.`);
    await ctx.wait(3.4);
    ph.faceTo(dig); ph.lookAt(dig); dig.faceTo(ph); dig.lookAt(ph);
    await ctx.wait(0.5);
    ph.gesture('handshake', 2.2); dig.gesture('handshake', 2.2);
    ctx.cap('Pick a zone to fly to it, from supplier to customer.');
    await ctx.wait(2.6);
  }

  async closing(ctx) {
    const { ph, bps } = this.cast, a = this.app, d = a.data, team = this.all();
    await ctx.wait(0.6);
    ph.faceTo(bps); bps.faceTo(ph); ph.lookAt(bps); bps.lookAt(ph);
    await ctx.wait(0.5);
    ph.gesture('handshake', 2.0); bps.gesture('handshake', 2.0);
    ctx.cap('A handshake for every commitment.');
    await ctx.wait(2.2);
    ph.lookAt(null);
    const row = this.rowTeam(false);
    ctx.cap('Everyone takes a place in the line.');
    await Promise.all(row.map(([m, x, z]) => ctx.walk(m, [[x, z]], { speed: 1.1, faceYaw: PI })));
    [...team, ph].forEach(m => m.lookAt(null));
    ctx.cam(SHOT.c_crane, 8, { easing: ease.inOutSine, arc: 0.1 });
    await ctx.wait(0.8);
    [...team, ph].forEach((m, i) => ctx.later(i * 0.09, () => m.gesture('celebrate', 3.2)));
    a.entrance.burst();
    a.ui.bigTitle(d.closing.title);
    await ctx.wait(4.5);
  }
}
