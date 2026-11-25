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
  k_wall: { pos: [1.7, 3.55, 27.4], target: [-8.7, 3.35, 23.6], fov: 50 },
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
  fc_anchor: { pos: [1.1, 1.66, 25.4], target: [1.1, 1.42, 22.0], fov: 40 },
  sm_wide: { pos: [0.3, 3.0, -9.4], target: [0.3, 1.2, -3.2], fov: 62 },
  sm_in: { pos: [-5.6, 2.5, -11.6], target: [-10.5, 1.3, -5.6], fov: 54 },
  sm_watch: { pos: [-11.2, 2.5, -9.4], target: [-1.0, 1.3, -3.6], fov: 58 },
  sm_after: { pos: [-6.3, 2.2, -9.6], target: [-6.35, 1.5, -3.6], fov: 52 },
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
  { id: 'house', title: 'House of BPS GO!+', sub: 'Where 2026 started: one operating system', loc: 'wall', dur: 30, stepped: true },
  { id: 'roadmap', title: 'BPS GO!+ Roadmap 2026', sub: 'Aligned with the House of BPS GO!+', loc: 'wall', dur: 30, stepped: true },
  { id: 'glimpses', title: 'Glimpses 2026', sub: 'Moments from the year', loc: 'wall', dur: 30, stepped: true },
  { id: 'digitalsm', title: 'Digital SM', sub: 'Before and after at the supermarket', loc: 'floor', dur: 45, stepped: true },
  { id: 'glimpses2', title: 'Glimpses 2026', sub: 'Digital twin and awards', loc: 'wall', dur: 30, stepped: true },
  { id: 'factcheck', title: 'BPS Fact Check', sub: 'The JaP Newsroom', loc: 'studio', dur: 900, stepped: true },
  { id: 'future', title: 'How 2027 looks like', sub: 'Back through the gate, into the plant of 2027', loc: 'gate', dur: 40, stepped: true },
  { id: 'plant', title: 'Picture of Future', sub: 'A walk through the modern plant', loc: 'floor', dur: 36 },
  { id: 'closing', title: 'Lead. Work. Win.', sub: 'Creating value. Together.', loc: 'close', dur: 18 },
  { id: 'thanks', title: 'Thank You', sub: '', loc: 'close', dur: 14, stepped: true },
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

  setWorld({ digital = false, gate = false, build = 1, screen = 'kpi', future = false, smScreen = false } = {}) {
    const a = this.app;
    a.factory.sm.setScreen(smScreen || future); a.ui.smNote('close');
    a.entrance.wall.setMode(screen); a.entrance.wall.set26(9, true);
    a.factory.setDigital(digital); a.factory.setFuture(future); a.ui.yearCard(null); a.ui.glimpses('close'); a.ui.glimpses('gemba', null); a.ui.t27Board('close'); a.ui.roadmap27(false); a.ui.challenges('close'); if (a.ui.screenView) a.ui.toggleScreenView(false); a.ui.thanks('hide'); a.ui.factCheck('close');
    a.factory.gate.snap(gate);
    a.entrance.snapBuild(build); a.entrance.highlight(null); a.entrance.hideConfetti();
    a.entrance.wall.highlight(null, null);
  }

  // ---------- chapter states ----------
  stage(id) {
    const c = this.cast, a = this.app;
    for (const ch of [...Object.values(c), ...a.ops]) { ch.gestures.length = 0; ch.aim = null; ch.look = null; ch.setMood?.(null); ch.holdClipboard?.(false); }
    // the Team Leader only appears in the Digital SM story
    c.tl.place(-8.4, -4.35, PI / 2); c.tl.root.visible = id === 'digitalsm';
    this.placeOps();
    const W = this.wallCenter();
    switch (id) {
      case 'opening':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 48, PI); this.setWorld({ gate: false, build: 1, screen: 'flash' });
        a.rig.orbit([0, 0, 4], 62, 44, 0.03, 1.1); break;
      case 'flashback':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 48, PI); this.setWorld({ gate: false, build: 1, screen: 'flash' }); a.rig.cut(SHOT.g_far); break;
      case 'house': case 'roadmap': case 'kpis': case 'glimpses':
        this.placeGroup(WALLTEAM, this.yawTo(W.x, W.z)); c.ph.place(-4.6, 24.4, Math.atan2(W.x + 4.6, W.z - 24.4));
        this.setWorld({ gate: true, screen: { house: 'flash', roadmap: 'roadmap', kpis: 'kpi', glimpses: 'gl26' }[id] }); if (id === 'house') a.entrance.wall.set26(0, true); a.rig.cut(SHOT.k_wall); break;
      case 'glimpses2':
        // back on the gangway, on the VE side, walking on to the next boards
        c.ph.place(1.2, 18.0, PI / 2); c.bps.place(0.4, 18.7, PI / 2); c.prod.place(-0.4, 18.1, PI / 2); c.qual.place(0.3, 17.4, PI / 2);
        this.setWorld({ gate: true, screen: 'kpi' }); a.rig.cut({ pos: [-3.5, 2.6, 22.5], target: [6, 1.4, 16], fov: 56 }); break;
      case 'future':
        this.placeGroup(WAIT, () => 0); c.ph.place(0, 40.5, PI); this.setWorld({ gate: false, future: true, screen: 'house27' }); a.entrance.wall.set27(false, 0, true); a.rig.cut(SHOT.g_door); break;
      case 'plant':
        this.placeGroup(WAIT, () => PI); c.qual.place(23.4, 5.7, -PI * 0.75); c.ph.place(0, 21.5, PI); c.bps.place(0.9, 22.2, PI); this.setWorld({ gate: true, digital: true, future: true }); a.rig.cut(SHOT.p_high); break;
      case 'digitalsm':
        // the team comes in along the supermarket aisle from the west
        c.ph.place(-13.2, -6.0, PI / 2); c.bps.place(-14.0, -5.5, PI / 2); c.prod.place(-14.4, -6.5, PI / 2); c.qual.place(-13.0, -6.9, PI / 2);
        this.setWorld({ gate: true }); a.rig.cut(SHOT.sm_in); break;
      case 'factcheck':
        // studio: the BPS Lead stands in the 2026 plant, framed on the left; the others step out of shot
        c.ph.place(-14, 19, PI); c.prod.place(-15, 20, PI); c.qual.place(-13, 20, PI); c.bps.place(0, 22.2, 0);
        this.setWorld({ gate: true, screen: 'roadmap' }); a.rig.cut(SHOT.fc_anchor); c.bps.lookAt(V(1.1, 1.66, 25.4)); break;
      case 'thanks':
        this.placeGroup(WAIT, () => PI); this.setWorld({ gate: true, future: true, screen: 'house27' }); a.ui.thanks('show'); break;
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
      case 'house': a.entrance.wall.setMode('house'); a.entrance.wall.set26(9, true); a.rig.cut(SHOT.k_wall); lookAll(this.wallCenter()); a.ui.toggleScreenView(true); break;
      case 'roadmap': case 'kpis': a.rig.cut(SHOT.k_wall); lookAll(this.wallCenter()); break;
      case 'glimpses': case 'glimpses2': {
        const G = a.data.glimpses, part = id === 'glimpses' ? 1 : 2, ids = G.months.map((m, k) => ((m.part || 1) === part ? k : -1)).filter(k => k >= 0), last = ids[ids.length - 1], b = a.factory.glBoards?.[last];
        if (b) { const S = this.boardSpots(b), C = V(b.x, b.y, b.z); for (const [k, [x, z]] of Object.entries(S)) { c[k].place(x, z, Math.atan2(b.x - x, b.z - z)); c[k].lookAt(C); } a.rig.cut(this.boardShot(b, true)); a.ui.glimpses('gemba', b); }
        a.ui.glimpses('month', last, 'nocard'); a.ui.glimpses('compose', last); break;
      }
      case 'future': a.factory.gate.snap(true); this.placeGroup(WALLTEAM, this.yawTo(KPI_WALL.x, KPI_WALL.z)); c.ph.place(-4.6, 24.4, Math.atan2(KPI_WALL.x + 4.6, KPI_WALL.z - 24.4)); lookAll(this.wallCenter()); a.entrance.wall.set27(true, 4, true); a.rig.cut(SHOT.k_wall); break;
      case 'plant': c.ph.place(22.2, 5.0, 0.6); c.bps.place(21.1, 4.6, 0.6); c.qual.place(23.4, 5.7, -2.4); a.rig.cut(SHOT.p_cell); break;
      case 'closing': this.rowTeam(true); a.rig.cut(SHOT.c_crane); break;
      case 'thanks': a.ui.thanks('final'); break;
      case 'factcheck': c.bps.lookAt(V(1.1, 1.66, 25.4)); a.ui.factCheck('signoff'); break;
      case 'digitalsm': { const S = a.factory.sm, sp = S.screenPos; a.factory.sm.setScreen(true); c.tl.place(sp.x, -4.75, PI); c.tl.setMood('happy'); a.ui.smNote('open', 'after'); a.ui.smNote('fill'); a.ui.smNote('done', a.data.digitalSM.after); a.rig.cut(SHOT.sm_wide); break; }
    }
  }
  rowTeam(snap) {
    const c = this.cast; const order = [c.qual, c.ph, c.bps, c.prod];
    return order.map((m, i) => { const x = (i - 1.5) * 1.4, z = 25.6 - Math.abs(i - 1.5) * 0.25; if (snap) { m.place(x, z, PI); return null; } return [m, x, z]; });
  }

  // ---------- navigation ----------
  next() { if (this.index < CHAPTERS.length - 1) this.go(this.index + 1); }
  // Back = one step back: replay the current chapter quickly (behind the fade) to the step before;
  // from a chapter's first step, go to the last step of the chapter before
  prev() {
    if (this.catchUp) return;
    const at = this.scriptDone ? (this.stepNo || 0) + 1 : (this.stepNo || 0); // waiting at step 'at'; after the end = last + 1
    if (this.index > 0 && at > 1) { this.go(this.index, { toStep: at - 1 }); return; }
    if (this.index > 1) this.go(this.index - 1, { toStep: Infinity }); else if (this.index === 1) this.go(0);
  }
  endCatchUp() {
    if (!this.catchUp) return;
    this.catchUp = false; this.targetStep = 0; this.app.timeScale = 1; this.app.ui.fade(0, 0.6);
  }
  async go(i, { skipTitle = false, toStep = 0 } = {}) {
    i = clamp(i, 0, CHAPTERS.length - 1);
    const app = this.app, ui = app.ui, ch = CHAPTERS[i];
    const gt = ++this.goToken;
    this.makeCtx(); // cancels running script
    this.stepRes = null; app.timeScale = 1; ui.stepHint(false);
    app.rig.stop(); this.userCam = false; ui.showResetView(false); ui.clearCaptions(); ui.setPins([]); ui.closePanel(true); ui.showSkip(false); ui.closeRoadmap();
    if (this.index >= 0) { ui.fade(1, 0.45); await new Promise(r => setTimeout(r, 470)); if (gt !== this.goToken) return; }
    this.index = i; this.chapterTime = 0; this.scriptDone = false; this.stepNo = 0;
    this.targetStep = toStep; this.catchUp = toStep > 0; if (this.catchUp) skipTitle = true;
    ui.setChapter(i);
    this.stage(ch.id);
    if (this.catchUp) app.timeScale = 20; else ui.fade(0, 0.8);
    // the gate chapter has no title card: '2026 Flashback' is written on the doors
    if (!['opening', 'flashback', 'house', 'roadmap', 'future', 'glimpses', 'glimpses2', 'thanks', 'factcheck'].includes(ch.id) && !skipTitle) ui.titleCard(i, ch.title, ch.sub);
    const ctx = this.makeCtx();
    ui.showSkip(ch.id !== 'opening'); ui.letterbox(ch.id !== 'opening');
    try { await this[ch.id](ctx); } catch (e) { console.error(e); }
    if (!ctx.alive()) return;
    this.endCatchUp();
    this.finish(ch.id);
    this.ambient(ctx, ch.id);
  }
  finish(id) {
    const ui = this.app.ui;
    this.scriptDone = true; this.doneAt = this.chapterTime; this.app.timeScale = 1; this.stepRes = null; ui.stepHint(false); ui.showSkip(false); ui.letterbox(false);
    // the chapter panel stays hidden; it opens only on request (H, or the panel tab)
    ui.setPins(this.pinsFor(id));
  }
  // stepped chapters: the script waits here until Next (→, Space, clicker) is pressed
  waitStep(ctx, autoAfter = null) {
    this.stepNo = (this.stepNo || 0) + 1;
    // replaying after Back: run through the earlier steps without stopping
    if (this.catchUp && this.stepNo < this.targetStep) return new Promise(r => setTimeout(r, 90));
    this.endCatchUp();
    this.app.timeScale = 1;
    const auto = null; void autoAfter; // nothing moves on by itself: every step waits for Next
    return new Promise(res => {
      const done = () => { if (this.stepRes === done) this.stepRes = null; res(); };
      this.stepRes = done;
      if (auto) ctx.later(auto, done);
      this.app.ui.stepHint(true);
    }).then(() => this.app.ui.stepHint(false));
  }
  skip() {
    const ch = CHAPTERS[this.index]; if (!ch || this.scriptDone || this.catchUp) return;
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
    const roles = Object.values(this.cast).map(m => ({ id: m.id, type: 'role', label: m.role, pos: () => (m.root.visible ? m.headWorld() : null), role: true }));
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
    const shot = { flashback: SHOT.in_both, house: SHOT.k_wall, kpis: SHOT.k_wall, future: SHOT.k_wall, digitalsm: SHOT.sm_wide, plant: SHOT.p_cell, closing: SHOT.c_crane }[id];
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
    ctx.cap('On the screen: 2026 Flashback.');
    ctx.cam(SHOT.in_both, 3);
    await ctx.wait(3.2);
  }

  async house(ctx) {
    // the screen opens in full display with '2026 Flashback'; each Next builds the House of BPS GO!+
    const ui = this.app.ui, wall = this.app.entrance.wall;
    ctx.cut(SHOT.k_wall);
    wall.setMode('flash'); wall.set26(0, true);
    ui.toggleScreenView(true);
    await this.waitStep(ctx);
    wall.setMode('house'); wall.set26(0, true); wall.p = 1; wall.animating = false;
    for (let s = 1; s <= 9; s++) { wall.set26(s); await this.waitStep(ctx); } // roof, band, pillars, content ×4, boosters, statement
  }

  async roadmap(ctx) {
    // straight from the House of BPS GO!+ to the roadmap in full screen (click to zoom) → back to the scene
    const ui = this.app.ui, wall = this.app.entrance.wall;
    ctx.cut(SHOT.k_wall);
    wall.setMode('roadmap'); wall.p = 1; ui.toggleScreenView(false); ui.openRoadmap();
    ctx.cap('Click any pillar, block or KPI to zoom in. Next zooms out, then returns to the plant.');
    await this.waitStep(ctx);
    ui.closeRoadmap(); wall.setMode('roadmap'); wall.p = 1; wall.ct.redraw();
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

  async glimpses(ctx) { return this.runGlimpses(ctx, 1); }
  async glimpses2(ctx) { return this.runGlimpses(ctx, 2); }
  // camera shots for a Glimpses board: wide (team and board) and close (board fills most of the view, team at its sides)
  boardShot(b, close) {
    const s = b.part === 1 ? -1 : 1; // look from the outer side, away from the big screen
    return close ? { pos: [b.x, b.y, b.z + 3.9], target: [b.x, b.y, b.z], fov: 50 }
      : { pos: [b.x + s * 2.6, 2.7, b.z + 5.8], target: [b.x - s * 0.5, 1.5, b.z], fov: 54 };
  }
  // where the team stands at a board: Plant Head left, the others right / behind
  boardSpots(b) { return { ph: [b.x - 2.45, b.z + 0.75], bps: [b.x + 2.45, b.z + 0.75], prod: [b.x + 3.0, b.z + 1.7], qual: [b.x - 3.0, b.z + 1.7] }; }
  // Gemba walk to a board along the gangway
  async walkToBoard(ctx, b, from = null) {
    const c = this.cast, S = this.boardSpots(b), GZ = 18.3, sp = 2.1;
    const ids = ['ph', 'bps', 'prod', 'qual'];
    const walks = ids.map((id, k) => {
      const m = c[id], p = m.root.position, [tx, tz] = S[id], lane = GZ + (k % 2 ? 0.55 : -0.25);
      // from the big screen: round its south end (it reaches the gangway at x -6.3, z 17)
      const pts = from === 'wall' ? [[-4.8 + k * 0.3, 19.6 + (k % 2) * 0.4], [-5.6 - k * 0.2, 16.25 + (k % 2) * 0.3], [tx, tz]] : [[p.x, lane], [tx, lane], [tx, tz]];
      return new Promise(res => ctx.later(k * 0.25, () => m.walkTo(pts, { speed: sp, onArrive: () => res() })));
    });
    if (from === 'wall') {
      // the camera stays east of the big screen, then slips round its end to the board
      ctx.cam({ pos: [1.0, 2.6, 23.5], target: [-6, 1.4, 16.5], fov: 56 }, 2.4, { easing: ease.inOutSine, arc: 0 });
      await ctx.wait(2.6);
      await ctx.dip(() => ctx.cut(this.boardShot(b, false))); // quick cut to the gangway side of the board
    } else ctx.cam(this.boardShot(b, false), 4.2, { easing: ease.inOutSine, arc: 0 });
    await walks[0];
    await Promise.race([Promise.all(walks), ctx.wait(2.5)]);
    const C = V(b.x, b.y, b.z);
    ids.forEach(id => { c[id].faceTo?.(C); c[id].lookAt(C); });
  }
  // Target 2027 boards in the 2027 plant: Key Performance Results, Key Performance Indicators, Hunt Runner @ ROIN
  async targetBoards(ctx) {
    const a = this.app, ui = a.ui, c = this.cast, T = (a.data.targets2027 || {}).boards || [], boards = a.factory.t27Boards || [];
    for (let i = 0; i < T.length; i++) {
      const b = boards[i]; if (!b) continue;
      ui.t27Board('close');
      ctx.cap(`Target 2027 · ${T[i].title}`, { hold: 400 });
      await this.walkToBoard(ctx, b);
      c.ph.gesture('present', 2.4);
      ctx.cam(this.boardShot(b, true), 1.6);
      await ctx.wait(1.5);
      ui.t27Board('open', i, b);
      await this.waitStep(ctx);
      for (let k = 0; k < T[i].cards.length; k++) {
        ui.t27Board('card', i, k);
        // the board shakes when the target hits it
        ctx.later(0.43, () => { const g = b.group, x0 = b.x; ctx.tween(0.5, u => { const d = (1 - u) * 0.035; g.position.x = x0 + Math.sin(u * 60) * d; g.rotation.z = Math.sin(u * 47) * d * 0.4; }); ctx.later(0.55, () => { g.position.x = x0; g.rotation.z = 0; }); });
        b.setShown?.(k + 1); // the board in the plant keeps what was shown on it
        ctx.cap(`${T[i].cards[k].label}: ${T[i].cards[k].big}${T[i].cards[k].unit ? ' ' + T[i].cards[k].unit : ''}`, { hold: 600 });
        await this.waitStep(ctx);
      }
    }
    ui.t27Board('close');
    // back to the big screen: how we do it
    await ctx.dip(() => {
      this.placeGroup(WALLTEAM, this.yawTo(KPI_WALL.x, KPI_WALL.z)); c.ph.place(-4.6, 24.4, Math.atan2(KPI_WALL.x + 4.6, KPI_WALL.z - 24.4));
      const C = this.wallCenter(); this.all().forEach(m => m.lookAt(C)); c.ph.lookAt(C); ctx.cut(SHOT.k_wall);
    });
  }
  // Glimpses, part 1 (before the Digital SM scene) or part 2 (after it): a Gemba walk, one board per story
  async runGlimpses(ctx, part) {
    const ui = this.app.ui, G = this.app.data.glimpses, boards = this.app.factory.glBoards || [], c = this.cast;
    const have = JSON.parse(document.getElementById('glimpse-images')?.textContent || '{}');
    if (part === 1) {
      // the cover on the big screen
      ctx.cap('Glimpses 2026: a Gemba walk through the year.', { hold: 600 });
      await this.waitStep(ctx);
    }
    let first = true;
    for (let m = 0; m < G.months.length; m++) {
      const M = G.months[m]; if ((M.part || 1) !== part) continue;
      const b = boards[m]; if (!b) continue;
      if (!M.images.some(im => have[im.src])) continue; // no pictures for this story yet
      // walk to the board
      ui.glimpses('close'); ui.glimpses('gemba', null);
      ctx.cap(`Gemba walk · ${M.month}`, { hold: 400 });
      await this.walkToBoard(ctx, b, part === 1 && first ? 'wall' : null);
      first = false;
      c.ph.gesture('present', 2.4);
      ctx.cam(this.boardShot(b, true), 1.6);
      await ctx.wait(1.5);
      ui.glimpses('gemba', b);
      ui.glimpses('month', m, 'nocard');
      ctx.cap(M.event, { hold: 600 });
      for (let i = 0; i < M.images.length; i++) {
        const im = M.images[i]; if (!have[im.src]) continue; // picture not added yet
        if (im.entry === 'pop' || im.entry === 'fade') ui.glimpses('pop', m, i); // straight into place (pop: with crackers)
        else {
          ui.glimpses('full', m, i);                 // fills the board; the others hidden
          await this.waitStep(ctx);
          if (im.noPlace) continue;                  // replaced by the next image before it settles
          ui.glimpses('place', m, i);                // settles into its place on the slide
        }
        await this.waitStep(ctx);
        if (im.zoom) { ui.glimpses('zoom', m, i); c.ph.gesture('point', 2.2, { target: V(b.x, b.y + 0.4, b.z) }); await this.waitStep(ctx); } // zoom into a chart, highlight
      }
      if (M.improve) { ui.glimpses('improve', m); c.ph.gesture('point', 2.2, { target: V(b.x + 1.4, b.y, b.z) }); await this.waitStep(ctx); } // improvement staircase
      if (M.box) for (let k = 0; k < M.box.items.length; k++) { ui.glimpses('point', m, k); await this.waitStep(ctx); } // box: one item per Next
    }
    if (part === 1) {
      // from the Digital SM board: "let's see the result" — the team walks off towards the supermarket
      ctx.cap("Let's see the result on the shop floor.", { hold: 600 });
      c.ph.gesture('armsOpen', 1.4); await ctx.wait(1.2);
      ui.glimpses('close'); ui.glimpses('gemba', null);
      const p0 = c.ph.root.position;
      ['ph', 'bps', 'prod', 'qual'].forEach((id, k) => { const m = c[id], q = m.root.position; ctx.later(k * 0.15, () => m.walkTo([[q.x, 18.3 + (k % 2) * 0.5], [q.x + 6, 18.3 + (k % 2) * 0.5]], { speed: 1.8 })); });
      ctx.cam({ pos: [p0.x - 1.5, 2.6, 23.5], target: [p0.x + 4, 1.3, 17.5], fov: 56 }, 2.2, { easing: ease.inOutSine, arc: 0 });
      await ctx.wait(2.0);
      if (!this.catchUp) { this.next(); await new Promise(() => {}); } // on into the Digital SM scene (cancelled by the chapter change)
    }
  }

  async digitalsm(ctx) {
    const { tl, ph, bps, prod, qual } = this.cast, a = this.app, ui = a.ui, F = a.factory, S = F.sm, D = a.data.digitalSM;
    const team = [ph, bps, prod, qual], zA = -4.35, last = S.racks[S.racks.length - 1], sp = S.screenPos;
    const walkAll = (spots, speed = 1.7) => Promise.all(team.map((m, k) => new Promise(res => ctx.later(k * 0.15, () => m.walkTo([spots[k]], { speed, onArrive: () => res() })))));
    // ---- the team arrives at the supermarket (about 2 s)
    ctx.cap('At the supermarket.', { hold: 300 });
    await Promise.race([walkAll([[-8.2, -6.2], [-9.0, -5.6], [-9.4, -6.7], [-7.8, -7.0]]), ctx.wait(3.2)]);
    team.forEach(m => m.lookAt(tl));
    // ---- before: one person counts the stock by hand, rack by rack
    ctx.cam(SHOT.sm_watch, 1.6);
    ctx.cap('Before · manual stock count', { kind: 'marker' });
    ctx.cap(D.before.text);
    await ctx.walk(tl, [[S.racks[0].x, zA]], { speed: 1.4, faceYaw: 0 });
    tl.holdClipboard(true); ui.smNote('open', 'before');
    for (let i = 0; i < S.racks.length; i++) {
      const r = S.racks[i];
      if (i) await ctx.walk(tl, [[r.x, zA]], { speed: 1.0, faceYaw: 0 });
      tl.faceYaw(0); tl.lookAt(r.center); tl.gesture('point', 1.1, { target: r.center });
      if (i === 3) ctx.cam(SHOT.sm_wide, 3);
      await ctx.wait(1.1);
      tl.gesture('write', 1.6); tl.lookAt(null);
      ui.smNote('row', i);
      await ctx.wait(1.2);
    }
    // tired after the round
    tl.holdClipboard(false); tl.faceYaw(PI); tl.setMood('tired');
    ctx.cam({ pos: [last.x - 0.3, 1.75, zA - 2.6], target: [last.x, 1.5, zA], fov: 40 }, 2.2);
    tl.gesture('tired', 8); ctx.later(0.9, () => tl.gesture('wipeBrow', 2.2));
    ui.smNote('done', D.before);
    ctx.cap(`${D.before.time} of walking and counting, and the numbers are already old.`);
    await this.waitStep(ctx);
    // ---- after: the team moves to the Digital SM screen; one person comes, checks the stock at a glance and moves on
    ui.smNote('close');
    await ctx.dip(() => { tl.place(-1.5, zA, -PI / 2); tl.setMood(null); tl.holdClipboard(false); F.sm.setScreen(true); ctx.cut(SHOT.sm_after); });
    ctx.cap('After · Digital SM', { kind: 'marker' });
    ctx.cap(D.after.text);
    await Promise.race([walkAll([[sp.x - 1.6, -5.7], [sp.x + 1.6, -5.8], [sp.x - 2.2, -6.6], [sp.x + 2.2, -6.7]], 1.6), ctx.wait(3.0)]);
    team.forEach(m => m.lookAt(sp));
    await ctx.walk(tl, [[sp.x + 0.15, zA - 0.4]], { speed: 1.5, faceYaw: 0 });
    tl.faceYaw(0); tl.lookAt(sp); tl.gesture('point', 1.4, { target: sp });
    ctx.cam({ pos: [sp.x + 1.4, 1.9, zA - 2.7], target: [sp.x, 1.6, sp.z], fov: 46 }, 1.6);
    ui.smNote('open', 'after'); ui.smNote('fill');
    await ctx.wait(1.8);
    tl.lookAt(null); tl.setMood('happy'); tl.faceYaw(PI); tl.gesture('thumbsUp', 1.8);
    ui.smNote('done', D.after);
    ctx.cap(`Stock at a glance in ${D.after.time}, and he moves on. The counting time goes back into improvement.`);
    await ctx.wait(1.6);
    team.forEach(m => m.lookAt(tl));
    ctx.walk(tl, [[sp.x + 0.6, zA - 0.2], [4.0, zA]], { speed: 1.5 }); // on to his next job
    ctx.cam(SHOT.sm_after, 2.2);
    ctx.later(1.2, () => { ph.gesture('clap', 2.2); bps.gesture('thumbsUp', 2.2); });
    await this.waitStep(ctx);
  }

  async factcheck(ctx) {
    const ui = this.app.ui, F = this.app.data.factCheck, A = F.audit, an = this.cast.bps;
    const cam = V(1.1, 1.66, 25.4), panel = V(2.6, 1.55, 22.6);
    an.lookAt(cam);
    ui.factCheck('open'); an.gesture('wave', 2.4);
    await this.waitStep(ctx);
    ui.fcAudit('claim'); an.gesture('present', 2.6);                          // the claim: 85%
    await this.waitStep(ctx);
    ui.fcAudit('start'); an.lookAt(panel); an.gesture('point', 2.4, { target: panel }); // the roadmap check opens
    await this.waitStep(ctx);
    const n = A.mode === 'tasks' ? A.order.reduce((s, gid) => s + this.app.data.roadmap.pillars.flatMap(p => p.groups).find(g => g.id === gid).rows.length, 0) : A.blocks.reduce((s, b) => s + b.kpis.length, 0);
    for (let i = 0; i < n; i++) { ui.fcAudit('kpi', i); an.gesture(i % 3 ? 'nod' : 'explain', 1.6); await this.waitStep(ctx); } // one KPI per Next
    ui.fcAudit('result'); an.lookAt(cam); an.gesture('present', 2.4);       // the tally
    await this.waitStep(ctx);
    ui.fcAudit('verdict'); an.gesture('thumbsUp', 2.4);                     // the verdict
    await this.waitStep(ctx);
    ui.factCheck('signoff'); an.gesture('armsOpen', 2.6);
    await ctx.wait(1.0);
  }

  async thanks(ctx) {
    const ui = this.app.ui;
    ui.thanks('show');
    await ctx.wait(1.0);
    ui.thanks('walk');                 // the three walk to their places on the BPS plinth
    await ctx.wait(4.6);
    ui.thanks('look');                 // and look up at JaP
    for (let k = 0; k < 3; k++) { await this.waitStep(ctx); ui.thanks('check', k); } // each Next: one item drops in with a blast
    await ctx.wait(1.5);
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
    // step: the 2027 target
    wall.setT27(0, true); wall.setMode('target27'); wall.setT27(1); ph.gesture('present', 2.6);
    ctx.cap('Goal 2027, goal 1: a self-learning organisation at BPS Level 3.', { hold: 600 });
    await this.waitStep(ctx);
    // next: goal 2, the Mobility BPS Award
    wall.setT27(2); ph.gesture('point', 2.4, { target: wall.spot(0.75, 0.55) });
    ctx.cap('Goal 2: recognised in the Mobility BPS Award at BBM level.', { hold: 600 });
    await this.waitStep(ctx);
    // Target 2027: a Gemba walk to three boards; each Next fires one target onto the board
    await this.targetBoards(ctx);
    // step 4: how we do it: the house drops in, its pillars still empty
    wall.setISA(0, true); wall.setTag(false, true); wall.setMode('house27'); wall.set27(false, 0, true); wall.set27(true, 0);
    this.app.ui.toggleScreenView(true); // full display: the 4K screen pixel-sharp
    ph.gesture('present', 2.6);
    ctx.cap('How we do it: the House of BPS GO!+ 2027.', { hold: 600 });
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
    // then each Next drops one logo onto the house: Innovate, Simplify, Accelerate
    wall.highlight(null, null);
    for (let i = 0; i < (H.isa || []).length; i++) {
      const it = H.isa[i], s = it.at === 'boosters' ? wall.spot(0.5, 0.82) : wall.rowSpot(it.at);
      wall.setISA(i + 1); ph.lookAt(s); team.forEach(m => m.lookAt(s));
      ctx.later(0.6, () => ph.gesture('point', 2.2, { target: s }));
      ctx.cap(it.cap, { hold: 600 });
      await this.waitStep(ctx);
    }
    // the tagline in the bottom band
    if (H.tagline) { wall.highlight(null, null); wall.setTag(true); ctx.cap(H.tagline.join('  ') + '.', { hold: 600 }); await this.waitStep(ctx); }
    this.app.ui.toggleScreenView(false);
    // BPS GO!+ Roadmap 2027 in full screen (click to zoom)
    { const ui = this.app.ui; ui.roadmap27(true); ctx.cap('BPS GO!+ Roadmap 2027: every element of the house, quarter by quarter.', { hold: 600 }); await this.waitStep(ctx); ui.roadmap27(false);
      // Challenges & Support Required: each Next brings one in
      const C = this.app.data.challenges2027;
      if (C) {
        ui.challenges('open'); await this.waitStep(ctx);
        for (let k = 0; k < C.challenges.length; k++) { ui.challenges('ch', k); ctx.cap('Challenge: ' + C.challenges[k].text + '.', { hold: 600 }); await this.waitStep(ctx); }
        for (let k = 0; k < C.support.length; k++) { ui.challenges('sup', k); ctx.cap('Support required: ' + C.support[k].text + '.', { hold: 600 }); await this.waitStep(ctx); }
        ui.challenges('close');
      } }
    // back to the plant for the applause
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
