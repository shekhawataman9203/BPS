import { THREE } from './lib.js';
import { V, Tweens, clamp, fmt, ease } from './util.js';
import { SEATS, TABLE, attainment, last } from './rooms.js';

const PI = Math.PI;
// Camera shots: pos, target, fov
export const SHOT = {
  orbit: { pos: [-20, 9, 24], target: [-2, 1.2, 3], fov: 46 },
  f_wide: { pos: [-21, 7.5, 21], target: [-6, 1.2, 4], fov: 44 },
  f_wide2: { pos: [-15, 4.6, 15.5], target: [-5, 1.3, 5], fov: 44 },
  m_door: { pos: [-2.4, 2.25, -20.6], target: [3.6, 1.15, -11.4], fov: 50 },
  m_wide: { pos: [5.7, 2.55, -10.7], target: [-1.3, 1.4, -18.5], fov: 50 },
  m_screen: { pos: [0.4, 2.3, -10.75], target: [-0.7, 2.0, -21], fov: 50 },
  m_ph: { pos: [-1.2, 1.8, -16.6], target: [-4.4, 1.5, -20.4], fov: 42 },
  m_team: { pos: [-3.3, 2.35, -21.0], target: [1.0, 0.95, -14.6], fov: 52 },
  m_kpi: { pos: [7.2, 2.9, -14.7], target: [0, 1.4, -14.9], fov: 50 },
  f_lineA: { pos: [-23, 2.1, 8.6], target: [-14, 1.2, 1.6], fov: 44 },
  f_lineA2: { pos: [-8.2, 2.0, 8.4], target: [-12, 1.3, 1.6], fov: 44 },
  f_press: { pos: [5.0, 2.4, 8.0], target: [10.6, 1.6, 1.4], fov: 46 },
  f_leanWide: { pos: [-1.5, 4.8, 13.5], target: [3.5, 1.2, 0.6], fov: 50 },
  f_digitalHigh: { pos: [4, 7.4, 24], target: [8, 1.2, 5], fov: 52 },
  f_digitalCell: { pos: [14.2, 2.35, 6.4], target: [21.5, 2.2, 13.4], fov: 48 },
  t_wideLow: { pos: [-4, 1.6, 12.5], target: [-4, 3.2, 27], fov: 48 },
  t_wide2: { pos: [-4, 1.9, 15.5], target: [-4, 3.4, 27], fov: 48 },
  t_team: { pos: [-4, 2.5, 14.2], target: [-4, 2.3, 25.5], fov: 50 },
  t_closing: { pos: [-1.6, 1.9, 17.2], target: [-4, 1.6, 24], fov: 46 },
  t_crane: { pos: [-4, 6.8, 10.5], target: [-4, 2.6, 25.5], fov: 50 },
};
export const HOT_SHOT = {
  vsm: { pos: [-7.6, 2.6, 6.6], target: [-11, 1.3, 0], fov: 46 },
  smed: { pos: [6.6, 3.0, 7.0], target: [12, 2.0, 0], fov: 46 },
  kanban: { pos: [17.2, 2.7, -2.6], target: [24.5, 1.5, -10], fov: 48 },
  andon: { pos: [-10, 3.8, 11.0], target: [-10, 5.6, 3.2], fov: 46 },
  sfm: { pos: [-11.2, 2.0, -3.2], target: [-13, 1.7, -8.6], fov: 46 },
  pdm: { pos: [-0.6, 2.6, 5.2], target: [-4, 1.6, -1.4], fov: 46 },
  aoi: { pos: [18.4, 3.2, 4.0], target: [23, 1.4, 9], fov: 46 },
  dsfm: { pos: [-10, 3.8, 11.0], target: [-10, 5.6, 3.2], fov: 46 },
  energy: { pos: [12.2, 2.2, 3.6], target: [15.9, 1.5, -2.3], fov: 44 },
  twin: { pos: [16.8, 4.4, 21.2], target: [25, 2.8, 15.5], fov: 46 },
};

export const CHAPTERS = [
  { id: 'opening', title: 'Opening', loc: 'factory', dur: 20 },
  { id: 'arrival', title: 'Arrival', sub: 'The Plant Head joins the BPS team', loc: 'meeting', dur: 40 },
  { id: 'achievements', title: '2026 achievements', sub: 'What moved this year', loc: 'meeting', dur: 26 },
  { id: 'lean', title: 'Lean transformation', sub: 'Shop floor walk, Line A', loc: 'line', dur: 32 },
  { id: 'digital', title: 'Digital projects', sub: 'The digital layer of the plant', loc: 'line', dur: 26 },
  { id: 'kpis', title: 'KPI review', sub: 'Twelve months against target', loc: 'meeting', dur: 26 },
  { id: 'strategy', title: '2027 strategy', sub: 'One vision, four pillars, one foundation', loc: 'townhall', dur: 30 },
  { id: 'closing', title: 'Commitment', sub: 'One team. One BPS.', loc: 'townhall', dur: 20 },
];

const OPS = [[-20, 11.75], [-14, 11.75], [-8, 11.75], [-2, 11.75], [4, 11.75], [-22.6, 0.95], [11.2, 1.75]];
const ARC = [-70, -42, 42, 70, 98].map(d => { const a = d * PI / 180; return [-4 + 3.6 * Math.sin(a), 24.2 - 3.6 * Math.cos(a)]; });
const ARC_IDS = ['log', 'qual', 'bps', 'prod', 'dig'];

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
  seatTeam() {
    const { cast } = this; const chairs = this.app.meeting.chairs;
    SEATS.forEach((s, i) => { chairs[i].position.copy(chairs[i].userData.home); if (s.id) cast[s.id].place(s.x, s.z, s.yaw, 'sit'); });
  }
  seatOf(ch) { const i = SEATS.findIndex(s => s.id === ch.id); return { s: SEATS[i], chair: this.app.meeting.chairs[i] }; }
  standUp(ch, dur = 0.9) {
    const { s, chair } = this.seatOf(ch); const sx = Math.sign(s.x);
    ch.setBase('idle', dur);
    this.tw.add(dur, k => { ch.root.position.x = s.x + sx * 0.3 * k; chair.position.x = s.x + sx * 0.55 * k; });
  }
  sitDown(ch, dur = 0.9) {
    const { s, chair } = this.seatOf(ch); const sx = Math.sign(s.x);
    ch.targetYaw = s.yaw; ch.lookAt(null);
    ch.setBase('sit', dur);
    const x0 = ch.root.position.x, z0 = ch.root.position.z, cx0 = chair.position.x;
    return this.tw.add(dur, k => { ch.root.position.x = x0 + (s.x - x0) * k; ch.root.position.z = z0 + (s.z - z0) * k; chair.position.x = cx0 + (s.x - cx0) * k; });
  }
  placeOps() { this.app.ops.forEach((o, i) => { o.place(OPS[i][0], OPS[i][1], PI, 'work'); }); }
  placeFloorTeam() {
    const c = this.cast;
    c.prod.place(9.0, 3.0, PI * 0.85); c.qual.place(1.5, 1.45, PI); c.dig.place(18.6, 12.0, -PI / 2); c.log.place(19.3, -6, PI / 2);
  }
  arcTeam(faceHouse) {
    const c = this.cast;
    ARC_IDS.forEach((id, i) => { const [x, z] = ARC[i]; c[id].place(x, z, faceHouse ? 0 : Math.atan2(-4 - x, 24.2 - z)); });
  }
  all() { const c = this.cast; return [c.bps, c.prod, c.qual, c.dig, c.log]; }

  setWorld({ digital = false, holo = false, build = null, wall = null } = {}) {
    const a = this.app;
    a.factory.setDigital(digital);
    a.kpiHolo.show(holo); a.kpiHolo.highlight(null);
    if (build !== null) a.town.snapBuild(build);
    a.town.highlight(null); a.town.hideConfetti();
    if (wall) a.meeting.wall.show(wall);
    a.meeting.wall.highlight(-1);
  }

  // ---------- chapter states ----------
  stage(id) {
    const c = this.cast, a = this.app;
    for (const ch of [...Object.values(c), ...a.ops]) { ch.gestures.length = 0; ch.aim = null; ch.look = null; }
    this.placeOps();
    switch (id) {
      case 'opening':
        this.seatTeam(); c.ph.place(-9.5, 6.2, PI / 2); this.setWorld({ wall: 'title', build: 0 });
        a.rig.orbit([-2, 1.2, 4], 24, 7.0, 0.035, 2.2); break;
      case 'arrival':
        this.seatTeam(); c.ph.place(-9.5, 6.2, PI / 2); this.setWorld({ wall: 'title', build: 0 }); a.rig.cut(SHOT.f_wide); break;
      case 'achievements':
        this.seatTeam(); c.ph.place(-4.4, -20.45, 0.74); this.setWorld({ wall: 'welcome', build: 0 }); a.rig.cut(SHOT.m_screen); break;
      case 'lean':
        this.placeFloorTeam(); c.ph.place(-17.5, 3.5, PI / 2); c.bps.place(-18.2, 4.35, PI / 2); this.setWorld({ wall: 'lean', build: 0 }); a.rig.cut(SHOT.f_lineA); break;
      case 'digital':
        this.placeFloorTeam(); c.ph.place(9.7, 3.4, PI * 0.8); c.bps.place(8.9, 4.2, PI * 0.8); this.setWorld({ wall: 'digital', build: 0 }); a.rig.cut(SHOT.f_leanWide); break;
      case 'kpis':
        this.seatTeam(); c.ph.place(0, -11.3, PI); this.setWorld({ wall: 'kpi', build: 0 }); a.rig.cut(SHOT.m_kpi); break;
      case 'strategy':
        this.arcTeam(true); c.ph.place(-4, 24.2, 0); this.setWorld({ wall: 'strategy', build: 0 }); a.rig.cut(SHOT.t_wideLow); break;
      case 'closing':
        this.arcTeam(false); c.ph.place(-4, 24.2, PI); this.setWorld({ wall: 'closing', build: 1 }); a.rig.cut(SHOT.t_closing); break;
    }
  }
  // final state of each chapter (used by "Skip scene" and for smooth hand-over to the next chapter)
  end(id) {
    const c = this.cast, a = this.app; const lookAll = t => this.all().forEach(m => m.lookAt(t));
    this.stage(id);
    switch (id) {
      case 'arrival': c.ph.place(-4.4, -20.45, 0.74); a.meeting.wall.show('welcome'); a.rig.cut(SHOT.m_wide); break;
      case 'achievements': c.ph.place(-4.4, -20.45, 0.74); a.meeting.wall.show('achievements'); a.rig.cut(SHOT.m_screen); lookAll(c.ph); break;
      case 'lean': c.ph.place(9.7, 3.4, PI * 0.8); c.bps.place(8.9, 4.2, PI * 0.8); a.rig.cut(SHOT.f_leanWide); break;
      case 'digital': c.ph.place(18.3, 11.2, 0.4); c.bps.place(17.3, 10.4, 0.6); c.dig.place(18.6, 12.0, -2.6); a.factory.setDigital(true); a.rig.cut(SHOT.f_digitalCell); break;
      case 'kpis': a.kpiHolo.show(true); a.rig.cut(SHOT.m_kpi); lookAll(V(0, 1.3, TABLE.z)); break;
      case 'strategy': a.town.snapBuild(1); this.arcTeam(false); c.ph.place(-4, 24.2, PI); a.rig.cut(SHOT.t_team); lookAll(c.ph); break;
      case 'closing': this.rowTeam(true); a.town.snapBuild(1); a.rig.cut(SHOT.t_crane); break;
    }
  }
  rowTeam(snap) {
    const c = this.cast; const order = [c.log, c.qual, c.ph, c.bps, c.prod, c.dig];
    return order.map((m, i) => { const x = -4 + (i - 2) * 1.45 - 0.0, z = 23.3 + Math.abs(i - 2) * 0.18; if (snap) { m.place(x, z, PI); return null; } return [m, x, z]; });
  }

  // ---------- navigation ----------
  next() { if (this.index < CHAPTERS.length - 1) this.go(this.index + 1); }
  prev() { if (this.index > 1) this.go(this.index - 1); else if (this.index === 1) this.go(0); }
  async go(i, { skipTitle = false } = {}) {
    i = clamp(i, 0, CHAPTERS.length - 1);
    const app = this.app, ui = app.ui, ch = CHAPTERS[i], prevCh = CHAPTERS[this.index];
    const gt = ++this.goToken;
    const smooth = prevCh && i === this.index + 1 && prevCh.loc === ch.loc && this.scriptDone;
    this.makeCtx(); // cancels running script
    app.rig.stop(); this.userCam = false; ui.showResetView(false); ui.clearCaptions(); ui.setPins([]); ui.closePanel(true); ui.showSkip(false);
    if (!smooth && this.index >= 0) { ui.fade(1, 0.45); await new Promise(r => setTimeout(r, 470)); if (gt !== this.goToken) return; }
    this.index = i; this.chapterTime = 0; this.scriptDone = false;
    ui.setChapter(i);
    if (!smooth) this.stage(ch.id);
    else { app.kpiHolo.highlight(null); app.town.highlight(null); app.meeting.wall.highlight(-1); }
    if (!smooth) ui.fade(0, 0.8);
    if (ch.id !== 'opening' && !skipTitle) ui.titleCard(i, ch.title, ch.sub);
    const ctx = this.makeCtx();
    ui.showSkip(ch.id !== 'opening'); ui.letterbox(ch.id !== 'opening');
    try { await this[ch.id](ctx); } catch (e) { console.error(e); }
    if (!ctx.alive()) return;
    this.finish(ch.id);
    this.ambient(ctx, ch.id);
  }
  finish(id) {
    const ui = this.app.ui;
    this.scriptDone = true; this.doneAt = this.chapterTime; ui.showSkip(false); ui.letterbox(false);
    if (id !== 'opening') ui.openPanel();
    ui.setPins(this.pinsFor(id));
    if (id === 'arrival' && !ui.rolesByUser) { ui.toggleRoles(true); ui.rolesAuto = true; }
  }
  skip() {
    const ch = CHAPTERS[this.index]; if (!ch || this.scriptDone) return;
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
    const a = this.app, d = a.data, H = a.factory.hotspots;
    if (id === 'lean') return d.lean.stations.map(s => ({ id: s.id, type: 'station', label: s.title, pos: H[s.id] }));
    if (id === 'digital') return d.digital.projects.map(p => ({ id: p.id, type: 'project', label: p.name, pos: p.id === 'agv' ? () => H.agv.clone().setY(1.5) : H[p.id] }));
    if (id === 'kpis') return d.kpis.items.map(k => ({ id: k.id, type: 'kpi', label: k.name, value: fmt(last(k), k.decimals) + k.unit.trim(), pos: a.kpiHolo.anchor(k.id), compact: true }));
    if (id === 'strategy' || id === 'closing') return id === 'strategy' ? [...d.strategy.pillars.map(p => ({ id: p.id, type: 'pillar', label: p.name, pos: a.town.anchor(p.id), compact: true })), { id: 'vision', type: 'pillar', label: d.strategy.vision.title, pos: a.town.anchor('vision'), compact: true }, { id: 'base', type: 'pillar', label: d.strategy.foundation.name, pos: a.town.anchor('base'), compact: true }] : [];
    return [];
  }

  // ---------- reactions to user selections (body language only) ----------
  select(type, id, { fly = true } = {}) {
    const a = this.app, c = this.cast, ph = c.ph, d = a.data;
    const pointAt = (p, dur = 2.6) => { if (!p) return; ph.faceTo(p); ph.lookAt(p); ph.gesture('point', dur, { target: p }); setTimeout(() => { if (ph.look === p) ph.lookAt(null); }, dur * 1000 + 200); };
    if (type === 'achievement') { a.meeting.wall.show('achievements'); a.meeting.wall.highlight(id); pointAt(a.meeting.wall.tileSpot(id)); this.all().forEach(m => m.lookAt(a.meeting.wall.tileSpot(id))); }
    if (type === 'kpi') { a.kpiHolo.highlight(id); a.meeting.wall.highlight(d.kpis.items.findIndex(k => k.id === id)); pointAt(a.kpiHolo.anchor(id)); }
    if (type === 'pillar') { a.town.highlight(id); pointAt(a.town.anchor(id)); }
    if ((type === 'station' || type === 'project') && fly) {
      let shot = HOT_SHOT[id];
      if (id === 'agv') { const p = a.factory.hotspots.agv; shot = { pos: [p.x + 5, 3.6, p.z + 6], target: [p.x, 0.8, p.z], fov: 46 }; }
      if (shot) { this.userCam = true; a.rig.moveTo(shot, 2.4); a.ui.showResetView(true); }
      const hp = a.factory.hotspots[id];
      if (hp && ph.root.position.distanceTo(hp) < 16) pointAt(hp.clone ? hp.clone() : hp);
    }
  }
  resetView() {
    this.userCam = false; this.app.ui.showResetView(false);
    const id = CHAPTERS[this.index]?.id;
    const shot = { arrival: SHOT.m_wide, achievements: SHOT.m_screen, lean: SHOT.f_leanWide, digital: SHOT.f_digitalCell, kpis: SHOT.m_kpi, strategy: SHOT.t_team, closing: SHOT.t_crane }[id];
    if (shot) this.app.rig.moveTo(shot, 2.2);
  }

  // ---------- idle life after a chapter's scene ----------
  async ambient(ctx, id) {
    const c = this.cast, team = this.all();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    while (ctx.alive()) {
      await ctx.wait(3.5 + Math.random() * 3.5);
      if (!ctx.alive()) return;
      const m = pick(team), other = pick([...team, c.ph].filter(x => x !== m));
      const r = Math.random();
      if (r < 0.35) { m.lookAt(other); setTimeout(() => m.look === other && m.lookAt(null), 2600); }
      else if (r < 0.55) m.gesture('nod', 1.3);
      else if (r < 0.7 && m.base !== 'walk') m.gesture('explain', 2.4);
      else if (r < 0.85 && c.ph.base !== 'walk' && !c.ph.aim) c.ph.gesture(pick(['explain', 'present', 'nod']), 2.4);
      else c.ph.lookAt(Math.random() < 0.5 ? other : null);
    }
  }

  // =================== CHAPTER SCRIPTS (body animation only) ===================
  async opening(ctx) { await ctx.wait(0.1); }

  async arrival(ctx) {
    const { ph, bps, prod, qual, dig, log } = this.cast, a = this.app, wall = a.meeting.wall;
    const team = this.all();
    ctx.cam(SHOT.f_wide2, 6.5, { easing: ease.inOutSine, arc: 0 });
    ctx.cap('Shop floor, 07:58', { kind: 'marker' });
    ctx.walk(ph, [[0.5, 6.2]], { speed: 1.35 });
    await ctx.wait(2.6);
    ctx.cap('Before the workshop, the Plant Head walks the line.');
    await ctx.wait(3.4);
    ctx.follow(ph, { offset: [3.6, 1.7, -2.6], look: [0, 1.25, 0.8], lag: 1.5 });
    await ctx.until(() => ph.root.position.x > -4.6);
    const op = a.ops[3];
    ph.lookAt(op); ph.gesture('wave', 2.2); op.lookAt(ph);
    ctx.cap('A wave to the team on Line B.');
    await ctx.wait(0.5); op.gesture('waveL', 1.8);
    await ctx.wait(2.4); ph.lookAt(null); op.lookAt(null);
    await ctx.wait(0.6);
    await ctx.dip(() => { ph.place(6, -6.6, PI); ctx.cut(SHOT.m_door); });
    ctx.cap('Meeting room, 08:00', { kind: 'marker' });
    const phIn = ctx.walk(ph, [[6, -10.4], [5.1, -11.7], [3.0, -12.35]], { speed: 1.2 });
    prod.lookAt(qual); qual.lookAt(prod); prod.gesture('explain', 3.2); dig.gesture('think', 3.4); log.lookAt(prod);
    await ctx.wait(1.4);
    ctx.cap('The BPS team is already seated.');
    await ctx.until(() => ph.root.position.z < -9.9);
    team.forEach(m => m.lookAt(ph));
    ctx.cap('He enters. The team rises to greet him.');
    await ctx.wait(0.35); this.standUp(bps);
    await ctx.wait(0.25); this.standUp(prod); this.standUp(log);
    await ctx.wait(0.25); this.standUp(qual); this.standUp(dig);
    await ctx.wait(0.9);
    const bpsGo = ctx.walk(bps, [[2.32, -12.88]], { speed: 0.9 });
    await Promise.all([phIn, bpsGo]);
    ph.faceTo(bps); bps.faceTo(ph); ph.lookAt(bps); bps.lookAt(ph);
    ctx.cam({ pos: [4.6, 1.75, -14.6], target: [2.6, 1.35, -12.6], fov: 44 }, 1.6);
    await ctx.wait(0.7);
    ph.gesture('handshake', 2.4); bps.gesture('handshake', 2.4);
    ctx.cap('A handshake with the BPS Lead.');
    await ctx.wait(2.5);
    ph.gesture('nod', 1.2); bps.gesture('nod', 1.2);
    await ctx.wait(0.6);
    ph.faceTo(V(0, 0, -16.5)); ph.lookAt(V(0, 1.2, -16.5));
    ctx.cam(SHOT.m_wide, 2.2);
    await ctx.wait(0.4);
    ph.gesture('wave', 2.4);
    ctx.cap('Then a wave to the whole room.');
    [prod, qual, dig, log].forEach((m, i) => setTimeout(() => ctx.alive() && m.gesture('nod', 1.3), 300 + i * 180));
    await ctx.wait(2.6);
    ph.gesture('pleaseSit', 2.8);
    ctx.cap('With an open-palm gesture he asks everyone to sit. The workshop begins.');
    await ctx.wait(0.9);
    this.sitDown(prod); this.sitDown(log); setTimeout(() => ctx.alive() && (this.sitDown(qual), this.sitDown(dig)), 300);
    bps.lookAt(null);
    await ctx.walk(bps, [[1.75, -14]], { speed: 0.9 });
    this.sitDown(bps);
    await ctx.wait(0.6);
    team.forEach(m => m.lookAt(ph));
    const phTo = ctx.walk(ph, [[2.8, -13.3], [2.8, -20.25], [-4.4, -20.45]], { speed: 1.3, faceYaw: 0.74 });
    await phTo;
    wall.show('welcome');
    await ctx.wait(0.4);
    ctx.cam(SHOT.m_screen, 2.6);
    const spot = wall.spot(0.3, 0.55);
    ph.faceTo(spot); ph.lookAt(spot); ph.gesture('point', 2.8, { target: spot });
    team.forEach(m => m.lookAt(wall.spot(0.5, 0.5)));
    ctx.cap('On the wall: six stops, from this year\'s results to next year\'s commitment.');
    await ctx.wait(3.2);
    ph.faceYaw(0.74); ph.lookAt(V(0, 1.1, -15.5)); ph.gesture('present', 3);
    team.forEach(m => m.lookAt(ph));
    await ctx.wait(2.6);
    ctx.cam(SHOT.m_wide, 3);
  }

  async achievements(ctx) {
    const { ph } = this.cast, a = this.app, wall = a.meeting.wall, d = a.data.achievements, team = this.all();
    const H = d.headline, v = h => (h.prefix || '') + fmt(h.value, h.decimals) + h.unit;
    ctx.cam(SHOT.m_screen, 2.4);
    await ctx.wait(1.2);
    wall.show('achievements');
    team.forEach(m => m.lookAt(wall.spot(0.5, 0.5)));
    ph.faceTo(wall.spot(0.5, 0.5));
    await ctx.wait(1.6);
    for (const i of [0, 1]) {
      const s = wall.tileSpot(i);
      wall.highlight(i); ph.lookAt(s); ph.gesture('point', 2.7, { target: s });
      ctx.cap(`${H[i].label}: ${v(H[i])}, ${H[i].delta}.`);
      await ctx.wait(3.1);
    }
    wall.highlight(-1);
    ctx.cam(SHOT.m_ph, 2.0);
    ph.faceYaw(0.74); ph.lookAt(V(0, 1.1, -15.5)); team.forEach(m => m.lookAt(ph));
    await ctx.wait(0.6);
    ph.gesture('present', 3);
    ctx.cap('He turns to the team. The result is theirs.');
    await ctx.wait(2.6);
    ctx.cam(SHOT.m_team, 2.2);
    team.forEach((m, i) => setTimeout(() => ctx.alive() && m.gesture('clap', 2.6), i * 140));
    ctx.cap('The room answers with applause.');
    await ctx.wait(2.8);
    ph.gesture('handOnChest', 2.2); setTimeout(() => ctx.alive() && ph.gesture('nod', 1.2), 500);
    const hl = d.highlights[0];
    ctx.cap(`Also in 2026: ${hl.title} ${hl.text}.`);
    await ctx.wait(2.6);
    ctx.cam(SHOT.m_wide, 2.6);
  }

  async lean(ctx) {
    const { ph, bps, prod, qual } = this.cast, a = this.app, d = a.data.lean;
    const m = k => d.metrics.find(x => x.label.toLowerCase().includes(k));
    const lt = m('lead'), co = m('changeover');
    ctx.cap('Shop floor, Line A', { kind: 'marker' });
    ctx.cam(SHOT.f_lineA2, 8.5, { easing: ease.inOutSine, arc: 0 });
    const w1 = ctx.walk(ph, [[-11.4, 3.5]], { speed: 1.05 }), w2 = ctx.walk(bps, [[-12.1, 4.35]], { speed: 1.05 });
    await ctx.wait(1.6);
    ctx.cap('On Line A, one-piece flow replaced batch and queue.');
    await ctx.until(() => ph.root.position.x > -14.5);
    const st = V(-11, 1.1, 0);
    ph.lookAt(st); ph.gesture('point', 2.4, { target: st });
    await Promise.all([w1, w2]);
    ph.faceTo(V(-11, 0, 0)); bps.faceTo(ph); bps.lookAt(ph);
    await ctx.wait(0.3);
    bps.gesture('explain', 4.2);
    ctx.cap('The BPS Lead walks him through the new standard.');
    await ctx.wait(1.4); ph.lookAt(bps);
    await ctx.wait(1.0); ph.gesture('think', 2.4); ph.lookAt(st);
    await ctx.wait(2.4);
    ph.lookAt(bps); ph.gesture('nod', 1.4);
    if (lt) ctx.cap(`${lt.label}: down from ${fmt(lt.before, lt.decimals)} to ${fmt(lt.after, lt.decimals)}${lt.unit}.`);
    await ctx.wait(2.2);
    ph.gesture('beckon', 1.8); bps.lookAt(null);
    await ctx.wait(0.9);
    ctx.cam(SHOT.f_press, 7, { easing: ease.inOutSine, arc: 0.05 });
    const w3 = ctx.walk(ph, [[-6, 3.5], [9.7, 3.4]], { speed: 1.35, faceYaw: PI * 0.8 });
    const w4 = ctx.walk(bps, [[-6.8, 4.3], [8.9, 4.2]], { speed: 1.35, faceYaw: PI * 0.8 });
    await ctx.until(() => ph.root.position.x > 0.2);
    ph.lookAt(qual); qual.lookAt(ph); qual.gesture('nod', 1.3); ph.gesture('nod', 1.2);
    await ctx.wait(1.6); ph.lookAt(null); qual.lookAt(null);
    await Promise.all([w3, w4]);
    prod.lookAt(ph); prod.gesture('nod', 1.2);
    const pr = V(12, 2.0, 0.7);
    ph.lookAt(pr); ph.gesture('point', 2.6, { target: pr });
    if (co) ctx.cap(`At the press, changeover is down from ${fmt(co.before)} to ${fmt(co.after)} minutes.`);
    await ctx.wait(2.8);
    const op = a.ops[6];
    ph.lookAt(op); ph.gesture('thumbsUp', 2.2); op.lookAt(ph);
    await ctx.wait(0.5); op.gesture('nod', 1.3);
    ctx.cap('A thumbs-up for the press team.');
    await ctx.wait(2.2); ph.lookAt(null); op.lookAt(null);
    ctx.cam(SHOT.f_leanWide, 3.5);
    await ctx.wait(1.5);
  }

  async digital(ctx) {
    const { ph, bps, dig } = this.cast, a = this.app, d = a.data.digital;
    const P = d.projects, count = s => P.filter(p => p.status === s).length;
    ctx.cam(SHOT.f_digitalHigh, 4.2);
    await ctx.wait(1.2);
    a.factory.setDigital(true);
    ctx.cap('The digital layer: machines, vehicles and boards share one stream of data.');
    const w1 = ctx.walk(ph, [[13.5, 4.7], [17.6, 8.4], [18.3, 11.2]], { speed: 1.3 });
    const w2 = ctx.walk(bps, [[13, 5.5], [16.9, 9.0], [17.3, 10.4]], { speed: 1.3 });
    await ctx.wait(4.4);
    ctx.cam(SHOT.f_digitalCell, 4.4);
    await Promise.all([w1, w2]);
    ph.faceTo(dig); ph.lookAt(dig); dig.lookAt(ph); dig.gesture('nod', 1.2);
    await ctx.wait(1.0);
    const holo = a.factory.hotspots.twin.clone().setY(2.6);
    dig.faceTo(holo); dig.lookAt(holo); dig.gesture('present', 3.2);
    ph.lookAt(holo); ph.gesture('point', 2.6, { target: holo }); bps.lookAt(holo);
    const tw = P.find(p => p.id === 'twin');
    ctx.cap(`The Digital Lead shows the ${tw ? tw.name.toLowerCase() : 'digital twin'}: layout changes tested before anything moves.`);
    await ctx.wait(3.6);
    const agv = a.factory.agvs.reduce((b, x) => x.g.position.distanceTo(ph.root.position) < b.g.position.distanceTo(ph.root.position) ? x : b);
    ph.lookAt(agv.g.position); bps.lookAt(agv.g.position);
    const ag = P.find(p => p.id === 'agv');
    if (ag) ctx.cap(`AGVs now run the milk run: ${ag.impact.replace('removed', 'no longer walked')}.`);
    await ctx.wait(3.2);
    ph.faceTo(dig); ph.lookAt(dig); dig.faceTo(ph); dig.lookAt(ph); bps.lookAt(ph);
    await ctx.wait(0.6);
    ph.gesture('handshake', 2.2); dig.gesture('handshake', 2.2);
    ctx.cap(`${count('Live')} projects live, ${count('Scaling')} scaling, ${count('Pilot')} in pilot, ${count('Planned')} planned.`);
    await ctx.wait(2.6);
  }

  async kpis(ctx) {
    const { ph, prod } = this.cast, a = this.app, d = a.data.kpis, team = this.all(), holo = a.kpiHolo;
    const items = d.items, ok = items.filter(k => attainment(k) >= 1).length;
    ctx.cam(SHOT.m_kpi, 2.2);
    await ctx.wait(1.4);
    holo.show(true);
    const c = V(0, 1.3, TABLE.z);
    team.forEach(m => m.lookAt(c)); ph.lookAt(c);
    ctx.cap(`${items.length} steering KPIs rise from the table.`);
    await ctx.wait(2.6);
    ph.gesture('present', 2.6);
    await ctx.wait(1.2);
    ctx.cap(`${ok} of ${items.length} closed December on or above target.`);
    const best = items[0];
    holo.highlight(best.id); ph.gesture('point', 2.6, { target: holo.anchor(best.id) }); ph.lookAt(holo.anchor(best.id));
    team.forEach((m, i) => setTimeout(() => ctx.alive() && m.gesture('leanIn', 2.6), i * 150));
    await ctx.wait(3.0);
    const miss = items.find(k => attainment(k) < 1);
    if (miss) {
      holo.highlight(miss.id); ph.gesture('point', 2.8, { target: holo.anchor(miss.id) }); ph.lookAt(holo.anchor(miss.id));
      ctx.cap(`${miss.name} missed: ${fmt(last(miss), miss.decimals)}${miss.unit} against ${fmt(miss.target, miss.decimals)}${miss.unit}. It moves to the 2027 agenda.`);
      await ctx.wait(3.0);
      ph.gesture('think', 2.4);
      await ctx.wait(2.0);
    }
    holo.highlight(null);
    prod.lookAt(ph); prod.gesture('raiseHand', 2.6);
    ctx.cap('A raised hand from Production.');
    await ctx.wait(1.4);
    ph.lookAt(prod); ph.faceTo(prod);
    await ctx.wait(0.6);
    ph.gesture('nod', 1.3); setTimeout(() => ctx.alive() && ph.gesture('explain', 3), 900);
    ctx.cap('A nod, an open hand: the action goes onto the shop floor board.');
    await ctx.wait(3.2);
    ph.faceYaw(PI); ph.lookAt(null);
  }

  async strategy(ctx) {
    const { ph } = this.cast, a = this.app, s = a.data.strategy, team = this.all(), town = a.town;
    const everyone = [...team, ph];
    ctx.cap('Town hall, shop floor', { kind: 'marker' });
    ctx.cam(SHOT.t_wide2, 10, { easing: ease.inOutSine, arc: 0 });
    await ctx.wait(1.4);
    town.setBuild(0.25);
    everyone.forEach(m => m.lookAt(V(-4, 0.5, 27.5)));
    ctx.cap(`The foundation: ${s.foundation.name}.`);
    await ctx.wait(3.0);
    town.setBuild(0.74);
    everyone.forEach(m => m.lookAt(V(-4, 2.2, 28.4)));
    ctx.cap(`Four pillars: ${s.pillars.map(p => p.name.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
    await ctx.wait(3.8);
    town.setBuild(1);
    everyone.forEach(m => m.lookAt(V(-4, 5.2, 28.6)));
    ctx.cap(`One roof: ${s.vision.title}.`);
    await ctx.wait(3.2);
    ph.faceYaw(PI); ph.lookAt(null);
    team.forEach(m => { m.faceTo(ph); m.lookAt(ph); });
    ctx.cam(SHOT.t_team, 3);
    await ctx.wait(1.4);
    ph.gesture('armsOpen', 3.2);
    ctx.cap(s.vision.text);
    await ctx.wait(3.4);
    ph.gesture('fist', 2.0);
    team.forEach((m, i) => setTimeout(() => ctx.alive() && m.gesture('clap', 2.6), i * 130));
    ctx.cap('Applause from the team.');
    await ctx.wait(2.8);
  }

  async closing(ctx) {
    const { ph, qual, bps } = this.cast, a = this.app, d = a.data, team = this.all();
    ctx.cam(SHOT.t_closing, 2.2);
    await ctx.wait(0.8);
    const shake = async (m, spot) => {
      await ctx.walk(ph, [spot], { speed: 1.1 });
      ph.faceTo(m); m.faceTo(ph); ph.lookAt(m); m.lookAt(ph);
      await ctx.wait(0.5); ph.gesture('handshake', 2.0); m.gesture('handshake', 2.0);
      await ctx.wait(2.1);
    };
    ctx.cap('A handshake for every commitment.');
    const qa = ARC[1], ba = ARC[2];
    await shake(qual, [qa[0] + 0.62, qa[1] + 0.58]);
    await shake(bps, [ba[0] - 0.62, ba[1] + 0.58]);
    ph.lookAt(null);
    const row = this.rowTeam(false);
    ctx.cap('Everyone takes a place in the line.');
    await Promise.all(row.map(([m, x, z]) => ctx.walk(m, [[x, z]], { speed: 1.1, faceYaw: PI })));
    [...team, ph].forEach(m => m.lookAt(null));
    ctx.cam(SHOT.t_crane, 9, { easing: ease.inOutSine, arc: 0.1 });
    await ctx.wait(0.8);
    [...team, ph].forEach((m, i) => setTimeout(() => ctx.alive() && m.gesture('celebrate', 3.2), i * 90));
    a.town.burst();
    a.ui.bigTitle(d.closing.title);
    await ctx.wait(4.5);
  }
}
