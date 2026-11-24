import { THREE, RoundedBoxGeometry } from './lib.js';
import { C, CSS, FONT, mat, glow, box, cyl, shadows, CanvasTex, fitText, textPlane, V, clamp, ease } from './util.js';

// ======================= SCRUM review room (glass room at the back of the hall) =======================
export const ROOM = { x0: -9, x1: 9, z0: -22, z1: -10, h: 4.3 };
export const TABLE = { x: 0, z: -15.6, w: 2.2, len: 7, top: 0.77 };
export const SEATS = [
  { id: 'bps', x: 1.42, z: -14, yaw: -Math.PI / 2 },
  { id: 'prod', x: 1.42, z: -16, yaw: -Math.PI / 2 },
  { id: 'dig', x: 1.42, z: -18, yaw: -Math.PI / 2 },
  { id: 'log', x: -1.42, z: -14, yaw: Math.PI / 2 },
  { id: 'qual', x: -1.42, z: -16, yaw: Math.PI / 2 },
  { id: null, x: -1.42, z: -18, yaw: Math.PI / 2 },
];
const SCREEN = { x: 0, y: 2.45, z: -21.86, w: 7.2, h: 2.7 };

function makeChair() {
  const g = new THREE.Group();
  const shell = mat(0x1b1f26, { rough: 0.7 }), frame = mat(0x9aa3ae, { rough: 0.35, metal: 0.8 });
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.08, 0.5, 3, 0.03), shell); seat.position.y = 0.42; g.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.58, 0.06, 3, 0.025), shell); back.position.set(0, 0.78, -0.26); back.rotation.x = -0.12; g.add(back);
  box(0.36, 0.035, 0.02, glow(C.red, 1.4), 0, 0.98, -0.29, g).rotation.x = -0.12;
  cyl(0.03, 0.03, 0.34, frame, 10, g).position.y = 0.22;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = box(0.3, 0.025, 0.04, frame, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15, g); leg.rotation.y = a + Math.PI / 2; }
  shadows(g, true, true);
  return g;
}

export class ScrumWall {
  constructor(data) {
    this.data = data; this.p = 1; this.animating = false;
    this.ct = new CanvasTex(2048, 768, (ctx, W, H) => this.draw(ctx, W, H));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ map: this.ct.tex, toneMapped: false }));
    this.mesh.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
  }
  replay() { this.p = 0; this.animating = true; }
  update(dt) { if (!this.animating) return; this.p = Math.min(1, this.p + dt / 1.8); this.ct.redraw(); if (this.p >= 1) this.animating = false; }
  draw(ctx, W, H) {
    const p = ease.out(this.p);
    ctx.fillStyle = '#0e1218'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 76px ${FONT}`; ctx.fillText('SCRUM review', 80, 130);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `500 34px ${FONT}`; ctx.fillText('Sprint board · agile projects 2026', 80, 184);
    ctx.fillStyle = CSS.red; ctx.fillRect(80, 40, 90, 10);
    const cols = ['Backlog', 'In sprint', 'Review', 'Done'], cards = [5, 4, 3, 7];
    cols.forEach((c, i) => {
      const x = 80 + i * 480;
      ctx.fillStyle = '#9AA3AE'; ctx.font = `700 34px ${FONT}`; ctx.fillText(c, x, 270);
      for (let k = 0; k < cards[i]; k++) {
        const a = clamp(p * 2 - (i * 0.2 + k * 0.05), 0, 1); ctx.globalAlpha = a;
        ctx.fillStyle = i === 3 ? '#7EDEBE' : k % 3 === 0 ? '#F4F6F8' : '#c9ced5';
        ctx.fillRect(x + (k % 2) * 210, 300 + Math.floor(k / 2) * 110, 190, 90);
      }
      ctx.globalAlpha = 1;
    });
  }
}

export function buildMeetingRoom(scene, data) {
  const root = new THREE.Group(); root.name = 'meeting'; scene.add(root);
  const { x0, x1, z0, z1, h } = ROOM, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  // floor (carpet) and ceiling
  const carpet = new CanvasTex(512, 512, (ctx, W, H) => { ctx.fillStyle = '#1c2026'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); } });
  carpet.tex.wrapS = carpet.tex.wrapT = THREE.RepeatWrapping; carpet.tex.repeat.set(6, 4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: carpet.tex, roughness: 0.95 }));
  fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.012, cz); fl.receiveShadow = true; root.add(fl);
  box(w + 0.3, 0.15, d + 0.3, mat(0x15181d, { rough: 0.8 }), cx, h + 0.075, cz, root);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0x181b21, { rough: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, h - 0.005, cz); root.add(ceil);
  for (const lx of [-3.2, 3.2]) box(0.12, 0.03, d - 2, glow(0xfff4e8, 1.5), lx, h - 0.03, cz, root);
  box(4, 0.03, 0.12, glow(0xfff4e8, 1.2), 0, h - 0.03, -15.6, root);
  // back wall with slats
  box(w, h, 0.2, mat(0x171a20, { rough: 0.85 }), cx, h / 2, z0 - 0.1, root);
  const slatM = mat(0x3a2c22, { rough: 0.6 });
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, h - 0.2, 0.05), slatM, 70);
  const m4 = new THREE.Matrix4(); let si = 0;
  for (let x = x0 + 0.2; x < x1 - 0.1 && si < 70; x += 0.12) { if (Math.abs(x) < SCREEN.w / 2 + 0.25) continue; m4.makeTranslation(x, h / 2, z0 + 0.03); slats.setMatrixAt(si++, m4); }
  slats.count = si; root.add(slats);
  // side walls
  box(0.2, h, d, mat(0x1d2128, { rough: 0.85 }), x0 - 0.1, h / 2, cz, root);
  box(0.2, h, d, mat(0x1d2128, { rough: 0.85 }), x1 + 0.1, h / 2, cz, root);
  // wall sign (left wall)
  const sign = new CanvasTex(1024, 256, (ctx, W, H) => { ctx.clearRect(0, 0, W, H); ctx.fillStyle = CSS.red; ctx.fillRect(0, 30, 10, 196); ctx.fillStyle = '#F4F6F8'; ctx.font = `800 92px ${FONT}`; ctx.fillText('SCRUM', 50, 120); ctx.fillStyle = '#9AA3AE'; ctx.font = `500 46px ${FONT}`; ctx.fillText('Review room · agile projects', 50, 196); });
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, toneMapped: false }));
  signM.rotation.y = Math.PI / 2; signM.position.set(x0 + 0.02, 2.6, -15.5); root.add(signM);
  // right wall graphic: the enablers from the Picture of Future
  const prin = ((data.plant && data.plant.enablers) || []).slice(0, 8);
  const pw = new CanvasTex(2048, 512, (ctx, W, H) => {
    ctx.fillStyle = '#14181e'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 40px ${FONT}`; ctx.fillText('Enablers', 70, 92);
    ctx.fillStyle = CSS.red; ctx.fillRect(70, 118, 120, 8);
    prin.forEach((n, i) => {
      const col = i % 4, row = Math.floor(i / 4), x = 70 + col * 490, y = 250 + row * 150;
      ctx.fillStyle = CSS.red; ctx.fillRect(x, y - 34, 22, 22);
      ctx.fillStyle = '#F4F6F8'; const sz = fitText(ctx, n, 420, 50, 700); ctx.font = `700 ${sz}px ${FONT}`; ctx.fillText(n, x + 40, y - 12);
    });
  });
  const pwm = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), new THREE.MeshStandardMaterial({ map: pw.tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: pw.tex, emissiveIntensity: 0.35 }));
  pwm.rotation.y = -Math.PI / 2; pwm.position.set(x1 - 0.02, 2.35, -15.8); root.add(pwm);
  box(0.03, 0.03, d - 0.4, glow(C.red, 2), x0 + 0.03, 0.12, cz, root);
  box(0.03, 0.03, d - 0.4, glow(C.red, 2), x1 - 0.03, 0.12, cz, root);
  // glass front with door gap x[5,7]
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.4 });
  const mull = mat(0x0f1114, { rough: 0.4, metal: 0.6 });
  const fz = z1;
  box(5 - x0, h, 0.03, glass, (x0 + 5) / 2, h / 2, fz, root);
  box(x1 - 7, h, 0.03, glass, (x1 + 7) / 2, h / 2, fz, root);
  box(2, h - 2.4, 0.03, glass, 6, 2.4 + (h - 2.4) / 2, fz, root);
  for (let x = x0; x <= x1 + 0.01; x += 2) box(0.06, h, 0.08, mull, x, h / 2, fz, root);
  box(w, 0.1, 0.1, mull, cx, h, fz, root); box(2, 0.08, 0.1, mull, 6, 2.4, fz, root);
  // manifestation band (red line across glass)
  box(5 - x0, 0.05, 0.035, glow(C.red, 1.5), (x0 + 5) / 2, 1.25, fz + 0.01, root);
  box(x1 - 7, 0.05, 0.035, glow(C.red, 1.5), (x1 + 7) / 2, 1.25, fz + 0.01, root);
  // open sliding door leaf parked beside the gap
  box(1.9, 2.35, 0.03, glass, 7.95, 1.2, fz + 0.12, root);
  // table
  const top = new THREE.Mesh(new RoundedBoxGeometry(TABLE.w, 0.06, TABLE.len, 4, 0.03), mat(0xeef0f2, { rough: 0.25 }));
  top.position.set(TABLE.x, 0.74, TABLE.z); root.add(top);
  box(TABLE.w - 0.02, 0.012, TABLE.len - 0.02, glow(C.red, 0.0), TABLE.x, 0.705, TABLE.z, root);
  for (const zz of [-1.9, 1.9]) { box(0.5, 0.71, 1.2, mat(0x1b1f26, { rough: 0.5, metal: 0.3 }), TABLE.x, 0.355, TABLE.z + zz, root); }
  // laptops / notebooks on table
  for (const s of SEATS.slice(0, 5)) {
    const nb = box(0.3, 0.012, 0.22, mat(s.id === 'dig' ? 0x2b313a : 0xF4F6F8, { rough: 0.5 }), s.x > 0 ? 0.62 : -0.62, 0.776, s.z + 0.2, root);
    nb.rotation.y = 0.1;
  }
  // chairs
  const chairs = SEATS.map(s => { const c = makeChair(); c.position.set(s.x, 0, s.z); c.rotation.y = s.yaw; c.userData.home = V(s.x, 0, s.z); root.add(c); return c; });
  // LED wall
  const wall = new ScrumWall(data);
  box(SCREEN.w + 0.16, SCREEN.h + 0.16, 0.1, mat(0x07080a, { rough: 0.3, metal: 0.5 }), SCREEN.x, SCREEN.y, SCREEN.z - 0.06, root);
  root.add(wall.mesh);
  box(5, 0.5, 0.45, mat(0x1b1f26, { rough: 0.5 }), 0, 0.25, z0 + 0.3, root);
  // lights
  const l1 = new THREE.PointLight(0xfff1e2, 9, 12, 1.6); l1.position.set(0, 3.9, -13.5); root.add(l1);
  const l2 = new THREE.PointLight(0xfff1e2, 9, 12, 1.6); l2.position.set(0, 3.9, -18.5); root.add(l2);
  const spill = new THREE.PointLight(0xcfdcff, 5, 8, 1.5); spill.position.set(0, 2.4, -20.6); root.add(spill);
  // only furniture casts shadows; walls, ceiling and glass would darken the room under the hall light
  root.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  top.castShadow = true; chairs.forEach(c => shadows(c, true, true));
  return { root, wall, chairs };
}

// ======================= Entrance: big KPI screen (left of the gate aisle), confetti =======================
const STATUS_COL = { ok: '#3FBF8F', watch: '#F2B233', behind: '#E20015' };
export const STATUS_LABEL = { ok: 'On track', watch: 'Watch', behind: 'Behind' };
export const KPI_WALL = { x: -8.7, y: 3.75, z: 23.6, w: 14, h: 6.1, ry: Math.PI / 2 - 0.35 };
const TEX_W = 4096, TEX_H = Math.round(4096 * KPI_WALL.h / KPI_WALL.w); // 4K-wide canvas

export function allRows(data) {
  const out = [];
  data.roadmap.pillars.forEach(p => p.groups.forEach(g => g.rows.forEach(r => out.push({ ...r, pillar: p.id, pillarName: p.name, group: g.id, groupName: g.name, color: p.color }))));
  return out;
}
// "**bold**" markers removed for canvas text
const plain = t => t.replace(/\*\*/g, '');

function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

class KpiWall {
  constructor(data, logoImg) {
    this.data = data; this.logoImg = logoImg; this.p = 1; this.animating = false;
    this.hl = { pillar: null, row: null }; this.layouts = { house: {}, roadmap: {}, kpi: {}, house27: {}, flash: {}, align: {}, target27: {}, gl26: {} }; this.alignK = 1; this.mode = 'kpi';
    this.h27 = { drop: 1, dropT: 1, rev: [1, 1, 1, 1], shown: 4 }; this.t27 = { shown: 2, v: [1, 1] };
    // Innovate · Simplify · Accelerate logos that drop onto the 2027 house (t = seconds since each one was dropped)
    this.isa = { shown: 0, t: [0, 0, 0] }; this.isaImg = {};
    try { const G = JSON.parse(document.getElementById('glimpse-images')?.textContent || '{}');
      for (const it of data.house2027?.isa || []) { const src = G['isa-' + (it.img || it.id) + '.png']; if (!src) continue; const im = new Image(); im.onload = () => this.ct.redraw(); im.src = src; this.isaImg[it.id] = im; } } catch (e) { /* no logos */ }
    // 2026 house build-up, one stage per Next: 0 white, 1 roof, 2 band, 3 pillars, 4-7 pillar content, 8 boosters, 9 statement
    this.h26 = { stage: 9, v: { roof: 1, band: 1, pil: [1, 1, 1, 1], con: [1, 1, 1, 1], boost: 1, stmt: 1 } }; this.hits = []; this.hover = null;
    this.ct = new CanvasTex(TEX_W, TEX_H, (ctx, W, H) => this.draw(ctx, W, H));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(KPI_WALL.w, KPI_WALL.h), new THREE.MeshBasicMaterial({ map: this.ct.tex, toneMapped: false }));
    this.mesh.userData.kpiWall = true;
    if (logoImg && !logoImg.complete) logoImg.addEventListener('load', () => this.ct.redraw());
  }
  setAnisotropy(a) { this.ct.tex.anisotropy = a; this.ct.tex.needsUpdate = true; }
  get layout() { return this.layouts[this.mode]; }
  replay() { this.p = 0; this.animating = true; }
  // screen views: 'house' (House of BPS GO!+), 'roadmap' (Roadmap 2026), 'kpi' (KPI wall)
  setMode(m) { if (m === 'align') this.alignK = 0; if (m === this.mode) return; this.mode = m; this.hl = { pillar: null, row: null }; this.replay(); this.ct.redraw(); this.onMode?.(m); }
  highlight(pillar = null, row = null) { this.hl = { pillar, row }; this.ct.redraw(); }
  setHover(h) { const k = h ? h.type + h.id : null; if (k === this.hoverKey) return; this.hoverKey = k; this.hover = h; this.ct.redraw(); }
  // 2027 house: dropIn = house visible (drops from the top), shown = how many pillars have their content
  set27(dropIn, shown, snap = false) {
    const r = this.h27; r.dropT = dropIn ? 1 : 0; r.shown = shown;
    if (snap) { r.drop = r.dropT; r.rev = r.rev.map((_, i) => (i < shown ? 1 : 0)); }
    this.ct.redraw();
  }
  // Target 2027: how many target cards are on the screen (each Next adds one)
  setT27(shown, snap = false) { const t = this.t27; t.shown = shown; if (snap) t.v = t.v.map((_, i) => (i < shown ? 1 : 0)); this.ct.redraw(); }
  // how many of the Innovate / Simplify / Accelerate logos are on the 2027 house
  setISA(shown, snap = false) { const S = this.isa; S.shown = shown; S.t = S.t.map((t, i) => (i < shown ? (snap ? 10 : t) : 0)); this.ct.redraw(); }
  set26(stage, snap = false) {
    const R = this.h26; R.stage = stage;
    if (snap) { const t = this.t26(); R.v = { roof: t.roof, band: t.band, pil: [...t.pil], con: [...t.con], boost: t.boost, stmt: t.stmt }; }
    this.ct.redraw();
  }
  t26() { const s = this.h26.stage, b = x => (s >= x ? 1 : 0); return { roof: b(1), band: b(2), pil: [0, 1, 2, 3].map(() => b(3)), con: [0, 1, 2, 3].map(i => b(4 + i)), boost: b(8), stmt: b(9) }; }
  update(dt) {
    let dirty = false;
    if (this.mode === 'align' && this.alignK < 1) { this.alignK = Math.min(1, this.alignK + dt / 6.5); dirty = true; }
    if (this.mode === 'house') {
      const v = this.h26.v, t = this.t26(), step = (a, b, r) => (a === b ? a : b > a ? Math.min(b, a + dt / r) : 0);
      const before = JSON.stringify(v);
      v.roof = step(v.roof, t.roof, 1.1); v.band = step(v.band, t.band, 0.8);
      v.pil = v.pil.map((x, i) => (i === 0 || v.pil[i - 1] > 0.55 ? step(x, t.pil[i], 0.7) : (t.pil[i] ? x : 0)));
      v.con = v.con.map((x, i) => step(x, t.con[i], 0.8)); v.boost = step(v.boost, t.boost, 0.8); v.stmt = step(v.stmt, t.stmt, 0.8);
      if (JSON.stringify(v) !== before) dirty = true;
    }
    if (this.animating) { this.p = Math.min(1, this.p + dt / 2.2); dirty = true; if (this.p >= 1) this.animating = false; }
    if (this.mode === 'target27') {
      const t = this.t27; t.v = t.v.map((v, i) => { const g = i < t.shown ? 1 : 0; if (v === g) return v; dirty = true; return g > v ? Math.min(1, v + dt / 1.1) : 0; });
    }
    if (this.mode === 'house27') {
      const r = this.h27;
      if (r.drop > 0.5) { this.gearT = (this.gearT || 0) + dt; this.gearAcc = (this.gearAcc || 0) + dt; if (this.gearAcc > 1 / 24) { this.gearAcc = 0; dirty = true; } }
      const S = this.isa; S.t = S.t.map((t, i) => { if (i >= S.shown || t >= 3.2) return t; dirty = true; return Math.min(3.2, t + dt); });
      if (r.drop !== r.dropT) { r.drop = r.dropT > r.drop ? Math.min(r.dropT, r.drop + dt / 1.3) : Math.max(r.dropT, r.drop - dt / 0.6); dirty = true; }
      r.rev = r.rev.map((v, i) => { const t = i < r.shown ? 1 : 0; if (v === t) return v; dirty = true; return t > v ? Math.min(1, v + dt / 0.9) : 0; });
    }
    if (dirty) this.ct.redraw();
  }
  // world position of a spot on the screen, u,v in 0..1 from top-left
  spot(u, v) { this.mesh.updateMatrixWorld(true); return this.mesh.localToWorld(V((u - 0.5) * KPI_WALL.w, (0.5 - v) * KPI_WALL.h, 0.05)); }
  rowSpot(id) { const l = this.layout[id]; return l ? this.spot(l.u, l.v) : this.spot(0.5, 0.5); }
  pillarSpot(id) { const l = this.layout[id]; return l ? this.spot(l.u, l.v) : this.spot(0.5, 0.5); }
  logoSpot() { return this.spot(0.1, 0.06); }
  // what is at texture coordinate (u, v from the bottom-left, as three.js returns it)
  hitTest(uv) {
    const x = uv.x * TEX_W, y = (1 - uv.y) * TEX_H;
    for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
    return null;
  }
  draw(ctx, W, H) {
    const d = this.data, rm = d.roadmap, rf = d.reflection, p = ease.out(this.p), hl = this.hl, hv = this.hover;
    const hits = this.hits = [];
    const isHover = (type, id) => hv && hv.type === type && hv.id === id;
    if (this.mode === 'flash') {
      // title on the screen after the gate: 2026 FLASHBACK, like the doors
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2d343e'); g.addColorStop(1, '#141920');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 3);
      ctx.fillStyle = CSS.red; ctx.fillRect(W * 0.12, H * 0.62, W * 0.76, 16);
      ctx.fillStyle = '#F4F6F8'; ctx.textAlign = 'center'; ctx.font = `800 520px ${FONT}`; ctx.fillText('2026', W / 2, H * 0.55);
      ctx.font = `800 220px ${FONT}`; ctx.fillText('FLASHBACK', W / 2, H * 0.83);
      ctx.fillStyle = '#C3C9D1'; ctx.font = `600 70px ${FONT}`; ctx.fillText('BPS GO!+ · Reflection', W / 2, H * 0.94);
      if (this.logoImg && this.logoImg.complete && this.logoImg.naturalWidth) { const lh = 170, lw = this.logoImg.naturalWidth * lh / this.logoImg.naturalHeight; ctx.fillStyle = '#ffffff'; ctx.fillRect(W - lw - 140, 60, lw + 80, lh + 50); ctx.drawImage(this.logoImg, W - lw - 100, 85, lw, lh); }
      ctx.textAlign = 'left'; return;
    }
    ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, W, H);
    // header: logo, title, legend
    const HH = 210;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, HH);
    let lx0 = 70;
    if (this.logoImg && this.logoImg.complete && this.logoImg.naturalWidth) {
      const lh = 150, lw = this.logoImg.naturalWidth * lh / this.logoImg.naturalHeight;
      ctx.drawImage(this.logoImg, 60, (HH - lh) / 2, lw, lh); hits.push({ type: 'logo', id: 'logo', x: 40, y: 20, w: lw + 40, h: HH - 40 }); lx0 = 60 + lw + 60;
    }
    const TITLES = { gl26: ['Glimpses 2026', 'Moments from the year · a Gemba walk'], target27: ['Target 2027', 'Where BPS GO!+ takes JaP in 2027'], align: ['House of BPS GO!+  →  Roadmap 2026', 'Every element of the house has its block in the roadmap'], house27: ['House of BPS GO!+ 2027', 'How we do it · Strategy 2027 · click any element'], house: ['House of BPS GO!+', 'Strategy 2026 · click any element to zoom in'], roadmap: ['BPS GO!+ Roadmap 2026', 'Aligned with the house · click a row for its plan'], kpi: ['KPI wall 2026', `Target against ${rm.ytdLabel} · click any tile for details`] };
    const [tt, ts] = TITLES[this.mode];
    ctx.fillStyle = '#0A6EBD'; ctx.font = `800 96px ${FONT}`; ctx.fillText(tt, lx0, 118);
    ctx.fillStyle = '#4a525d'; ctx.font = `600 44px ${FONT}`; ctx.fillText(ts, lx0, 176);
    // view tabs: House · Roadmap · KPI wall
    let lx = W - 60;
    for (const [m, label] of (this.mode === 'align' || this.mode === 'target27' || this.mode === 'gl26' ? [] : this.mode === 'house27' ? [['house27', '2027']] : [['kpi', 'KPI wall'], ['roadmap', 'Roadmap'], ['house', 'House']])) {
      ctx.font = `700 44px ${FONT}`; const tw = ctx.measureText(label).width + 70, on = this.mode === m, hov = isHover('mode', m);
      ctx.fillStyle = on ? '#0A6EBD' : hov ? '#dfe9f4' : '#eef1f4'; ctx.fillRect(lx - tw, 50, tw, 100);
      ctx.fillStyle = on ? '#ffffff' : '#12161C'; ctx.textAlign = 'center'; ctx.fillText(label, lx - tw / 2, 116); ctx.textAlign = 'left';
      hits.push({ type: 'mode', id: m, x: lx - tw, y: 50, w: tw, h: 100 }); lx -= tw + 16;
    }
    if (this.mode === 'kpi') {
      lx -= 40; ctx.textAlign = 'right'; ctx.font = `700 40px ${FONT}`;
      for (const k of ['behind', 'watch', 'ok']) { const t = STATUS_LABEL[k]; ctx.fillStyle = '#12161C'; ctx.fillText(t, lx, 114); lx -= ctx.measureText(t).width + 20; ctx.fillStyle = STATUS_COL[k]; ctx.beginPath(); ctx.arc(lx - 16, 100, 16, 0, Math.PI * 2); ctx.fill(); lx -= 64; }
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = CSS.red; ctx.fillRect(0, HH - 8, W, 8);
    const L = this.layouts[this.mode];
    if (this.mode === 'align') { drawAlign(this, ctx, W, H, HH); return; }
    if (this.mode === 'target27') { drawTarget27(this, ctx, W, H, HH); return; }
    if (this.mode === 'gl26') {
      // Glimpses 2026 cover on the big screen
      const G = d.glimpses || {}, a = ease.out(clamp(p * 1.4, 0, 1));
      const g = ctx.createLinearGradient(0, HH, 0, H); g.addColorStop(0, '#0d1420'); g.addColorStop(1, '#1b2a40'); ctx.fillStyle = g; ctx.fillRect(0, HH, W, H - HH);
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = `200px ${FONT}`; ctx.fillText((G.icons || []).join('   '), W / 2, HH + 420);
      ctx.fillStyle = '#ffffff'; ctx.font = `900 330px ${FONT}`; ctx.fillText(G.title || 'Glimpses 2026', W / 2, HH + 860 - (1 - a) * 60);
      ctx.fillStyle = CSS.red; ctx.fillRect(W / 2 - 260 * a, HH + 940, 520 * a, 20);
      ctx.fillStyle = '#c8d2de'; ctx.font = `600 82px ${FONT}`; ctx.fillText(G.subtitle || '', W / 2, HH + 1100);
      ctx.fillStyle = '#29d3ff'; ctx.font = `800 70px ${FONT}`; ctx.fillText('Gemba walk  ·  follow us onto the shop floor  →', W / 2, H - 170);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1; return;
    }
    if (this.mode === 'house' || this.mode === 'house27') { drawHouse(this, ctx, W, H, HH, p, L, hits, isHover, this.mode === 'house27' ? d.house2027 : d.house, this.mode === 'house27' ? 'house27' : 'house'); return; }
    if (this.mode === 'roadmap') { drawRoadmap(this, ctx, W, H, HH, p, L, hits, isHover); return; }
    // six columns, one per element of the House of BPS GO!+, each with its roadmap KPIs
    const cols = houseColumns(d);
    const gap = 28, colW = (W - 100 - gap * (cols.length - 1)) / cols.length, top = HH + 36;
    cols.forEach((col, ci) => {
      const x = 50 + ci * (colW + gap);
      const on = hl.pillar === col.id || hl.pillar === col.group;
      const dim = (hl.pillar && !on) ? 0.3 : 1;
      const k = clamp(p * 1.5 - ci * 0.1, 0, 1);
      ctx.globalAlpha = dim * (0.2 + 0.8 * k);
      // element header tile
      const hh = 214, hov = isHover('house', col.id);
      ctx.fillStyle = col.color; ctx.fillRect(x, top, colW, hh);
      if (hov || on) { ctx.strokeStyle = '#12161C'; ctx.lineWidth = 8; ctx.strokeRect(x + 4, top + 4, colW - 8, hh - 8); }
      icon(ctx, col.icon, x + 62, top + 60, 30, '#ffffff');
      ctx.fillStyle = '#ffffff'; ctx.font = `800 50px ${FONT}`;
      const lines = wrap(ctx, col.name, colW - 140); lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + 112, top + 74 + i * 56));
      const ok = col.rows.filter(r => r.status === 'ok').length;
      ctx.font = `700 34px ${FONT}`; ctx.fillText(`${ok}/${col.rows.length} on track`, x + 30, top + hh - 24);
      hits.push({ type: 'house', id: col.id, x, y: top, w: colW, h: hh });
      L[col.id] = { u: (x + colW / 2) / W, v: (top + hh / 2) / H };
      const y0 = top + hh + 18, avail = H - y0 - 40;
      const rh = Math.min(300, avail / 4);
      col.rows.forEach((r, i) => {
        const y = y0 + i * rh, rOn = hl.row === r.id, rHov = isHover('kpi', r.id);
        ctx.globalAlpha = dim * clamp(p * 1.8 - ci * 0.1 - i * 0.05, 0, 1) * (hl.row && !rOn ? 0.5 : 1);
        ctx.fillStyle = rOn ? '#e7eef7' : rHov ? '#eef4fb' : '#ffffff'; ctx.fillRect(x, y, colW, rh - 16);
        ctx.fillStyle = rOn || rHov ? col.color : 'rgba(18,22,28,0.1)'; ctx.fillRect(x, y, rOn || rHov ? 14 : 5, rh - 16);
        ctx.fillStyle = STATUS_COL[r.status] || '#9AA3AE'; ctx.beginPath(); ctx.arc(x + colW - 42, y + 50, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#12161C'; ctx.font = `800 46px ${FONT}`;
        const kl = wrap(ctx, r.kpi, colW - 120).slice(0, 2); kl.forEach((ln, li) => ctx.fillText(ln, x + 34, y + 64 + li * 52));
        ctx.fillStyle = '#6b737e'; ctx.font = `600 30px ${FONT}`; ctx.fillText(fitLine(ctx, r.element, colW - 60), x + 34, y + rh - 128);
        // target and YTD on their own lines so long values fit
        const lab = 170;
        ctx.fillStyle = '#6b737e'; ctx.font = `600 32px ${FONT}`; ctx.fillText('Target', x + 34, y + rh - 78);
        ctx.fillStyle = '#12161C'; ctx.font = `700 40px ${FONT}`; ctx.fillText(fitLine(ctx, r.target, colW - lab - 50), x + 34 + lab, y + rh - 78);
        ctx.fillStyle = '#6b737e'; ctx.font = `600 32px ${FONT}`; ctx.fillText(rm.ytdLabel, x + 34, y + rh - 30);
        ctx.fillStyle = '#12161C'; ctx.font = `800 48px ${FONT}`; ctx.fillText(fitLine(ctx, r.ytd, colW - lab - 50), x + 34 + lab, y + rh - 28);
        hits.push({ type: 'kpi', id: r.id, x, y, w: colW, h: rh - 16 });
        L[r.id] = { u: (x + colW / 2) / W, v: (y + rh / 2) / H };
      });
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = CSS.red; ctx.fillRect(0, H - 14, W * p, 14);
  }
}

// KPI wall columns: the six elements of the House of BPS GO!+, each with the KPIs of its roadmap block
export function houseColumns(d) {
  const H = d.house, groups = {};
  d.roadmap.pillars.forEach(p => p.groups.forEach(g => { groups[g.id] = { g, p }; }));
  const boosterCol = { 'h-digi': '#1E88D9', 'h-indirect': '#0A6EBD' };
  return [...H.pillars, ...H.boosters].map(e => {
    const gp = groups[e.roadmap];
    return { id: e.id, name: e.name, icon: e.icon, color: e.color || boosterCol[e.id] || '#1E88D9', group: e.roadmap, pillarId: gp?.p.id, rows: gp ? gp.g.rows.map(r => ({ ...r, pillar: gp.p.id, group: gp.g.id })) : [] };
  });
}

// ---------- House of BPS GO!+ (drawn like the strategy slide) ----------
function icon(ctx, kind, cx, cy, r, col) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
  if (kind === 'lines') { for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(cx - r * 0.8 + (k === 0 ? r * 0.25 : 0), cy + k * r * 0.45); ctx.lineTo(cx + r * 0.8, cy + k * r * 0.45); ctx.stroke(); } }
  else if (kind === 'pie') { ctx.beginPath(); ctx.moveTo(cx - r * 0.06, cy + r * 0.06); ctx.arc(cx - r * 0.06, cy + r * 0.06, r * 0.82, -Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + r * 0.08, cy - r * 0.08); ctx.arc(cx + r * 0.08, cy - r * 0.08, r * 0.82, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill(); }
  else if (kind === 'people') { for (const [dx, s] of [[-0.65, 0.75], [0.65, 0.75], [0, 1]]) { ctx.beginPath(); ctx.arc(cx + dx * r, cy - r * 0.35 * s, r * 0.28 * s, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + dx * r, cy + r * 0.45, r * 0.45 * s, r * 0.32 * s, 0, Math.PI, 0); ctx.fill(); } }
  else if (kind === 'person') { ctx.beginPath(); ctx.arc(cx, cy - r * 0.38, r * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.7, r * 0.5, 0, Math.PI, 0); ctx.fill(); }
  else if (kind === 'network') { ctx.strokeRect(cx - r * 0.25, cy - r * 0.75, r * 0.5, r * 0.4); for (const dx of [-0.6, 0, 0.6]) ctx.strokeRect(cx + dx * r - r * 0.2, cy + r * 0.35, r * 0.4, r * 0.35); ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.35); ctx.lineTo(cx, cy + r * 0.35); ctx.moveTo(cx - r * 0.6, cy + r * 0.35); ctx.lineTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy + r * 0.35); ctx.stroke(); }
  else if (kind === 'doc') { ctx.strokeRect(cx - r * 0.5, cy - r * 0.75, r, r * 1.5); for (const k of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy + k * r); ctx.lineTo(cx + r * 0.28, cy + k * r); ctx.stroke(); } }
  ctx.restore();
}
function drawHouse(w, ctx, W, H, HH, p, L, hits, isHover, h = w.data.house, ht = 'house') {
  const hl = w.hl, isH = (t, id) => isHover(ht, id);
  const is27 = ht === 'house27', R = w.h27;
  const x0 = 520, x1 = W - 520, top = HH + (is27 ? 15 : 40);
  const dk = is27 ? ease.out(R.drop) : 1;
  const k = i => (is27 ? 1 : clamp(p * 1.6 - i * 0.12, 0, 1));
  const r26 = ht === 'house' ? w.h26.v : null, E = ease.out;
  if (is27 && dk < 1) {
    // blank screen first: BPS GO!+ 2027
    ctx.globalAlpha = 1 - dk;
    if (w.logoImg && w.logoImg.complete && w.logoImg.naturalWidth) { const lh = 300, lw = w.logoImg.naturalWidth * lh / w.logoImg.naturalHeight; ctx.drawImage(w.logoImg, W / 2 - lw / 2, H * 0.3, lw, lh); }
    ctx.fillStyle = '#0A6EBD'; ctx.font = `800 240px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('2027', W / 2, H * 0.3 + 560); ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    if (dk <= 0.001) return;
  }
  ctx.save(); ctx.translate(0, -(1 - dk) * H * 0.9);
  if (is27) { const sh = isaShake(w); if (sh) ctx.translate(sh[0], sh[1]); }
  const dim = id => (hl.pillar && hl.pillar !== id ? 0.3 : 1);
  // roof
  // roof: in the 2026 build-up it rises from below
  const hdim = hl.pillar && hl.pillar !== 'h-house' ? 0.45 : 1, rf = r26 ? E(r26.roof) : 1;
  ctx.save(); if (r26) ctx.translate(0, (1 - rf) * 900);
  ctx.globalAlpha = (r26 ? Math.min(1, r26.roof * 2) : k(0)) * hdim;
  ctx.fillStyle = '#E8101E'; ctx.beginPath(); ctx.moveTo(x0 - 40, top + 210); ctx.lineTo(W / 2, top); ctx.lineTo(x1 + 40, top + 210); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `800 76px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(h.title, W / 2, top + 160);
  ctx.restore();
  // operating system band: in the build-up it opens from the centre
  const bk = r26 ? E(r26.band) : 1;
  ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - (x1 - x0) / 2 * bk, top + 220, (x1 - x0) * bk, 120); ctx.clip();
  ctx.globalAlpha = (r26 ? Math.min(1, r26.band * 3) : k(0)) * hdim; ctx.textAlign = 'center';
  ctx.fillStyle = '#3a3a3c'; ctx.fillRect(x0, top + 228, x1 - x0, 104);
  ctx.fillStyle = '#ffffff'; ctx.font = `800 58px ${FONT}`; ctx.fillText(h.band.split('').join(String.fromCharCode(8202)), W / 2, top + 300);
  ctx.restore();
  hits.push({ type: ht, id: 'h-house', x: x0, y: top, w: x1 - x0, h: 332 }); L['h-house'] = { u: 0.5, v: (top + 200) / H };
  ctx.textAlign = 'left';
  // four pillars
  const py = top + 360, ph = is27 ? 620 : 690, gap = 30, pw = (x1 - x0 - gap * 3) / 4, headH = 270;
  const drawPillar = (pl, i, pk) => {
    const x = x0 + i * (pw + gap), hov = isH(ht, pl.id), on = hl.pillar === pl.id;
    ctx.globalAlpha = (r26 ? pk : k(i + 1)) * dim(pl.id);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, py, pw, ph);
    ctx.strokeStyle = on || hov ? pl.color : '#d6d9de'; ctx.lineWidth = on || hov ? 10 : 4; ctx.strokeRect(x, py, pw, ph);
    ctx.fillStyle = pl.color; ctx.fillRect(x, py, pw, headH);
    icon(ctx, pl.icon, x + pw / 2, py + 80, 44, '#ffffff');
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = `800 54px ${FONT}`;
    const words = pl.name.split(' '), mid = Math.ceil(words.length / 2), l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');
    ctx.fillText(l1, x + pw / 2, py + 180); if (l2) ctx.fillText(l2, x + pw / 2, py + 240);
    // pillar content: in the 2027 house it slides in from the right when revealed
    const rk = is27 ? ease.out(R.rev[i] ?? 1) : r26 ? E(r26.con[i]) : 1;
    hits.push({ type: ht, id: pl.id, x, y: py, w: pw, h: ph }); L[pl.id] = { u: (x + pw / 2) / W, v: (py + ph / 2) / H };
    ctx.textAlign = 'left';
    if (rk <= 0.001) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 4, py + headH, pw - 8, ph - headH - 4); ctx.clip(); ctx.translate((1 - rk) * pw, 0); ctx.globalAlpha *= rk;
    ctx.fillStyle = '#12161C'; ctx.font = `800 52px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(pl.driver, x + pw / 2, py + headH + 78);
    ctx.textAlign = 'left'; ctx.font = `600 44px ${FONT}`; ctx.fillStyle = '#1d2228';
    // shrink the bullet text until all items fit in the pillar
    let fs = 44;
    const linesFor = size => pl.items.map(it => { const isNew = it.includes('**'); ctx.font = `${isNew ? 800 : 600} ${size}px ${FONT}`; return { isNew, lines: wrap(ctx, it.replace(/\*\*/g, ''), pw - 100) }; });
    let blocks = linesFor(fs);
    const height = (b, size) => b.reduce((acc, x) => acc + x.lines.length * size * 1.22 + 8, 0);
    while (fs > 30 && py + headH + 150 - fs + height(blocks, fs) > py + ph - 24) { fs -= 2; blocks = linesFor(fs); }
    let ty = py + headH + 150 - (44 - fs);
    for (const bl of blocks) { ctx.fillStyle = bl.isNew ? '#1E9E3C' : '#1d2228'; ctx.font = `${bl.isNew ? 800 : 600} ${fs}px ${FONT}`; bl.lines.forEach((ln, li) => { if (li === 0) { ctx.beginPath(); ctx.arc(x + 42, ty - fs * 0.32, 8, 0, Math.PI * 2); ctx.fill(); } ctx.fillText(ln, x + 64, ty); ty += fs * 1.22; }); ty += 8; }
    if ((hov || on) && ty < py + ph - 60) { ctx.fillStyle = pl.color; ctx.font = `700 34px ${FONT}`; ctx.fillText('Click for details ›', x + 40, py + ph - 26); }
    ctx.restore();
  };
  // pillars: in the build-up they rise in one after another
  h.pillars.forEach((pl, i) => { const pk = r26 ? E(r26.pil[i]) : 1; if (r26 && pk <= 0.001) return; ctx.save(); if (r26) ctx.translate(0, (1 - pk) * 220); drawPillar(pl, i, pk); ctx.restore(); });
  // 2027: gears on a belt link the four pillars to the System Boosters
  const gz = is27 ? 125 : 0;
  if (is27) drawGears(w, ctx, { x0, pw, gap, n: h.pillars.length, y0: py + ph, y1: py + ph + 36 + gz, cols: h.pillars.map(p => p.color) });
  // system boosters
  const by = py + ph + 36 + gz, bh = is27 ? 220 : 250;
  ctx.globalAlpha = r26 ? E(r26.boost) : k(5);
  ctx.fillStyle = '#eceef1'; ctx.fillRect(x0 - 40, by, x1 - x0 + 80, bh);
  ctx.fillStyle = '#1E88D9'; ctx.fillRect(x0 - 40, by, x1 - x0 + 80, 8);
  ctx.font = `800 40px ${FONT}`; const lw = ctx.measureText('System Boosters').width + 80;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - lw / 2, by - 30, lw, 66, 33) : ctx.rect(W / 2 - lw / 2, by - 30, lw, 66); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText('System Boosters', W / 2, by + 16); ctx.textAlign = 'left';
  const bw = (x1 - x0 - 60) / 2;
  h.boosters.forEach((b, i) => {
    const x = x0 + i * (bw + 60), y = by + 48, hov = isH(ht, b.id), on = hl.pillar === b.id, ch = bh - 66;
    ctx.globalAlpha = (r26 ? E(r26.boost) : k(5 + i)) * dim(b.id);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, bw, ch);
    ctx.strokeStyle = on || hov ? '#1E88D9' : '#d6d9de'; ctx.lineWidth = on || hov ? 10 : 4; ctx.strokeRect(x, y, bw, ch);
    ctx.fillStyle = '#1E88D9'; ctx.beginPath(); ctx.arc(x + 150, y + ch / 2, 60, 0, Math.PI * 2); ctx.fill();
    icon(ctx, b.icon, x + 150, y + ch / 2, 33, '#ffffff');
    ctx.fillStyle = '#12161C'; ctx.font = `800 54px ${FONT}`; ctx.fillText(b.name, x + 250, y + (is27 ? 70 : 80));
    ctx.fillStyle = '#4a525d'; ctx.font = `500 40px ${FONT}`; ctx.fillText(b.text, x + 250, y + (is27 ? 126 : 140));
    hits.push({ type: ht, id: b.id, x, y, w: bw, h: ch }); L[b.id] = { u: (x + bw / 2) / W, v: (y + ch / 2) / H };
  });
  // statement
  ctx.globalAlpha = r26 ? E(r26.stmt) : k(7);
  ctx.fillStyle = '#18A8E0'; ctx.fillRect(0, H - 150, W, 150);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; const fs = fitText(ctx, h.statement, W - 200, 66, 600); ctx.font = `600 ${fs}px ${FONT}`; ctx.fillText(h.statement, W / 2, H - 52); ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  if (is27) drawISA(w, ctx, H, { W, x0, x1, py, ph, pw, gap, by, bh, pillars: h.pillars });
  ctx.restore();
}
// ---------- 2027 gears: one gear under each pillar, a timing belt joining them, shafts to the boosters ----------
function gearPath(ctx, r, teeth, rootK = 0.8) {
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, s = Math.PI * 2 / teeth;
    const pts = [[a0, rootK], [a0 + s * 0.12, 1], [a0 + s * 0.48, 1], [a0 + s * 0.6, rootK]];
    pts.forEach(([a, k], j) => { const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k; (i === 0 && j === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  }
  ctx.closePath();
}
function drawGear(ctx, cx, cy, r, teeth, ang, col) {
  const depth = r * 0.14;
  // side of the gear (extrusion) for a 3D look
  ctx.save(); ctx.translate(cx + depth * 0.5, cy + depth); ctx.rotate(ang);
  gearPath(ctx, r, teeth); ctx.fillStyle = '#3d454f'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(cx + depth * 0.25, cy + depth * 0.5); ctx.rotate(ang);
  gearPath(ctx, r, teeth); ctx.fillStyle = '#56606b'; ctx.fill(); ctx.restore();
  // face: brushed metal
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.45, '#b9c3cd'); g.addColorStop(0.55, '#d9e0e6'); g.addColorStop(1, '#7d8893');
  ctx.save(); ctx.rotate(ang); gearPath(ctx, r, teeth); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#4a535d'; ctx.stroke();
  // lightening holes
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2, hx = Math.cos(a) * r * 0.5, hy = Math.sin(a) * r * 0.5;
    const hg = ctx.createRadialGradient(hx - r * 0.04, hy - r * 0.04, 0, hx, hy, r * 0.14); hg.addColorStop(0, '#2a3038'); hg.addColorStop(1, '#4d5660');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, r * 0.13, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // bevel shade, hub in the pillar colour, bolt
  const rg = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.2, 0, 0, r * 0.74); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.85, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.fill();
  const hb = ctx.createRadialGradient(-r * 0.08, -r * 0.08, 0, 0, 0, r * 0.3); hb.addColorStop(0, '#ffffff'); hb.addColorStop(0.35, col); hb.addColorStop(1, '#12161C');
  ctx.fillStyle = hb; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d7dde3'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawGears(w, ctx, G) {
  const T = w.gearT || 0, cy = (G.y0 + G.y1) / 2, r = Math.min(80, (G.y1 - G.y0) / 2 - 4);
  const xs = Array.from({ length: G.n }, (_, i) => G.x0 + i * (G.pw + G.gap) + G.pw / 2);
  // shafts: pillar → gear → booster band
  xs.forEach(x => {
    const sg = ctx.createLinearGradient(x - 16, 0, x + 16, 0); sg.addColorStop(0, '#5b6570'); sg.addColorStop(0.5, '#e6ebf0'); sg.addColorStop(1, '#5b6570');
    ctx.fillStyle = sg; ctx.fillRect(x - 16, G.y0 - 4, 32, G.y1 - G.y0 + 8);
  });
  // timing belt around all gears, its teeth moving with them
  const bt = r + 10, xL = xs[0], xR = xs[xs.length - 1];
  ctx.save(); ctx.beginPath(); ctx.moveTo(xL, cy - bt); ctx.lineTo(xR, cy - bt); ctx.arc(xR, cy, bt, -Math.PI / 2, Math.PI / 2); ctx.lineTo(xL, cy + bt); ctx.arc(xL, cy, bt, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
  ctx.lineWidth = 22; ctx.strokeStyle = '#1f252c'; ctx.stroke();
  ctx.setLineDash([14, 14]); ctx.lineDashOffset = -T * 120; ctx.lineWidth = 10; ctx.strokeStyle = '#6b7580'; ctx.stroke(); ctx.restore();
  // gears (on a belt they all turn the same way)
  xs.forEach((x, i) => drawGear(ctx, x, cy, r, 16, T * 120 / bt + i * 0.2, G.cols[i] || '#0A6EBD'));
}

// ---------- Innovate / Simplify / Accelerate drop-in ----------
const rnd = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); };
const FALL = 0.55;
function isaShake(w) {
  const S = w.isa; let m = 0;
  S.t.forEach((t, i) => { if (i < S.shown && t > FALL && t < FALL + 0.5) m = Math.max(m, 1 - (t - FALL) / 0.5); });
  if (!m) return null; const T = performance.now() / 1000;
  return [Math.sin(T * 90) * 14 * m, Math.cos(T * 77) * 10 * m];
}
function drawISA(w, ctx, H, G) {
  const S = w.isa, list = w.data.house2027?.isa || [];
  list.forEach((it, i) => {
    const t = S.t[i]; if (i >= S.shown || !t) return;
    const im = w.isaImg[it.id], ar = im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1;
    // landing spots beside the house (the pillar text stays visible): left margin top / bottom, right margin bottom
    const pi = G.pillars.findIndex(p => p.id === it.at), mw = G.x0 - 120; let cww = Math.min(mw, 440), chh = (cww - 60) / ar + 60;
    const slot = it.place || (i === 0 ? 'left-bottom' : i === 1 ? 'left-top' : 'right-bottom');
    let cx = slot.startsWith('left') ? 30 + mw / 2 + 20 : G.W - 30 - mw / 2 - 20;
    let ground = slot === 'left-top' ? G.py + chh : G.by + G.bh;
    if (slot === 'roof') { chh = 240; cww = (chh - 60) * ar + 60; ground = G.py - 145; cx = G.x0 + G.pw + G.gap + 290 - cww / 2; }
    const col = it.color || '#0A6EBD';
    // after landing: outline the pillar / booster band it belongs to and draw an arrow to it
    const lt0 = t - FALL;
    if (lt0 > 0.15) {
      const k = ease.out(Math.min(1, (lt0 - 0.15) / 0.6));
      const box = pi >= 0 ? [G.x0 + pi * (G.pw + G.gap), G.py, G.pw, G.ph] : [G.x0 - 40, G.by, G.x1 - G.x0 + 80, G.bh];
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = col; ctx.lineWidth = 16; ctx.shadowColor = col; ctx.shadowBlur = 40;
      ctx.strokeRect(box[0] - 10, box[1] - 10, box[2] + 20, box[3] + 20); ctx.restore();
      // arrow path from the card's edge to the target
      const ex = slot.startsWith('left') ? cx + cww / 2 : cx - cww / 2;
      let pts;
      if (slot === 'roof') { const x = box[0] + 160; pts = [[x, ground + 4], [x, box[1] - 14]]; }
      else if (pi < 0) { const y = G.by + G.bh / 2 + 60; pts = [[ex, y], [box[0] + box[2] + 12, y]]; }
      else if (slot === 'left-top' && pi === 0) { const y = G.py + 135; pts = [[ex, y], [box[0] - 12, y]]; }
      else { const y = G.py + G.ph + 22, px = box[0] + box[2] / 2; pts = [[ex, Math.min(y, ground - 40)], [ex + 30, y], [px, y], [px, G.py + G.ph + 12]]; }
      let len = 0; for (let j = 1; j < pts.length; j++) len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      let left = len * k; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...pts[0]);
      let end = pts[0], dir = [1, 0];
      for (let j = 1; j < pts.length && left > 0; j++) { const [ax, ay] = pts[j - 1], [bx, by] = pts[j], d = Math.hypot(bx - ax, by - ay) || 1, u = Math.min(1, left / d); end = [ax + (bx - ax) * u, ay + (by - ay) * u]; dir = [(bx - ax) / d, (by - ay) / d]; ctx.lineTo(...end); left -= d; }
      ctx.stroke();
      if (k > 0.98) { ctx.fillStyle = col; ctx.beginPath(); const [x, y] = end, [dx, dy] = dir; ctx.moveTo(x + dx * 10, y + dy * 10); ctx.lineTo(x - dx * 34 - dy * 24, y - dy * 34 + dx * 24); ctx.lineTo(x - dx * 34 + dy * 24, y - dy * 34 - dx * 24); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    // fall with gravity, then a squash-and-bounce on impact
    const f = Math.min(1, t / FALL), lt = t - FALL;
    const dy = -(1 - f * f) * (ground + 200);
    let sx = 1, sy = 1, rot = (1 - f) * (i % 2 ? 0.12 : -0.12);
    if (lt > 0) { const b = Math.exp(-lt * 7) * Math.cos(lt * 26); sx = 1 + 0.1 * b; sy = 1 - 0.14 * b; }
    // shockwave ring and dust on the ground
    if (lt > 0) {
      const k = Math.min(1, lt / 0.7);
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 18 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(cx, ground, cww * (0.5 + 0.9 * k), 60 * (0.4 + 1.2 * k), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // the card
    ctx.save(); ctx.translate(cx, ground + dy); ctx.rotate(rot); ctx.scale(sx, sy);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-cww / 2, -chh, cww, chh, 36) : ctx.rect(-cww / 2, -chh, cww, chh); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 8; ctx.strokeStyle = it.color || '#0A6EBD'; ctx.stroke();
    if (im && im.naturalWidth) ctx.drawImage(im, -cww / 2 + 30, -chh + 30, cww - 60, chh - 60);
    else { ctx.fillStyle = it.color || '#0A6EBD'; ctx.font = `900 120px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(it.label, 0, -chh / 2); ctx.textAlign = 'left'; }
    ctx.restore();
    // dust clouds rolling out sideways, debris and sparks flung into the air
    if (lt > 0 && lt < 2.6) {
      ctx.save();
      for (let j = 0; j < 34; j++) {
        const side = j % 2 ? 1 : -1, sp = 0.35 + rnd(i, j) * 0.9, life = 1.4 + rnd(j, i) * 1.0, u = lt / life; if (u >= 1) continue;
        const e = 1 - Math.pow(1 - u, 3);
        const px = cx + side * (cww * 0.42 + e * 520 * sp), py = ground - 10 - e * (40 + rnd(j, 7) * 170) * sp;
        const r = 30 + e * (90 + rnd(j, 3) * 90);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        const c = j % 3 ? '205,198,186' : '232,228,220';
        g.addColorStop(0, `rgba(${c},${0.55 * (1 - u)})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      for (let j = 0; j < 22; j++) {
        const life = 1.2 + rnd(i + 5, j) * 0.9, u = lt / life; if (u >= 1) continue;
        const vx = (rnd(j, i + 9) - 0.5) * 1400, vy = -(500 + rnd(i + 2, j) * 900), g = 1900;
        const px = cx + (rnd(j, 11) - 0.5) * cww * 0.9 + vx * lt, py = ground - 20 + vy * lt + 0.5 * g * lt * lt;
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = j % 3 === 0 ? '#FFD34D' : j % 3 === 1 ? (it.color || '#0A6EBD') : '#9a9288';
        const sz = 8 + rnd(j, 4) * 16; ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.restore();
    }
  });
}
// ---------- House → Roadmap alignment (transition) ----------
function drawAlign(w, ctx, W, H, HH) {
  const d = w.data, k = w.alignK, rm = d.roadmap, Hs = d.house;
  const seg = (a, b) => ease.inOut(clamp((k - a) / (b - a), 0, 1));
  const shrink = seg(0, 0.28), appear = seg(0.2, 0.45);
  // the house, shrinking to the left
  const s = 1 - 0.56 * shrink, tx = 40 * shrink - 230 * shrink, ty = (HH + 10) * shrink * 0.35;
  const Lh = {};
  ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s);
  const sv = w.h26.stage; w.h26.stage = 9;
  drawHouse(w, ctx, W, H, HH, 1, Lh, [], () => false, Hs, 'house');
  w.h26.stage = sv; ctx.restore();
  const hp = id => { const l = Lh[id]; return l ? [tx + l.u * W * s, ty + l.v * H * s] : null; };
  // the roadmap, by pillar and block, on the right
  const rx0 = 2080, rx1 = W - 70, ry0 = HH + 40, rows = [];
  rm.pillars.forEach(p => { rows.push({ band: p }); p.groups.forEach(g => rows.push({ p, g })); });
  const rh = (H - ry0 - 50) / rows.length, gy = {};
  const links = [...Hs.pillars, ...Hs.boosters].map((e, i) => ({ e, i }));
  const linkDone = gid => { const L = links.find(x => x.e.roadmap === gid); return L ? seg(0.42 + L.i * 0.09, 0.52 + L.i * 0.09) : 0; };
  ctx.globalAlpha = appear;
  ctx.save(); ctx.translate((1 - appear) * 300, 0);
  rows.forEach((row, i) => {
    const y = ry0 + i * rh;
    if (row.band) {
      ctx.fillStyle = row.band.color; ctx.fillRect(rx0, y + 6, rx1 - rx0, rh - 12);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.min(64, rh * 0.5)}px ${FONT}`; ctx.fillText(row.band.name.toUpperCase(), rx0 + 30, y + rh * 0.66);
      ctx.font = `600 ${Math.min(40, rh * 0.32)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`${row.band.motto} ${row.band.tag}`, rx1 - 30, y + rh * 0.62); ctx.textAlign = 'left';
    } else {
      const on = linkDone(row.g.id);
      ctx.fillStyle = on > 0.99 ? row.p.light : '#eef1f4'; ctx.fillRect(rx0, y + 6, rx1 - rx0, rh - 12);
      ctx.fillStyle = row.p.color; ctx.fillRect(rx0, y + 6, 16, rh - 12);
      ctx.fillStyle = '#12161C'; ctx.font = `800 ${Math.min(58, rh * 0.46)}px ${FONT}`; ctx.fillText(row.g.name, rx0 + 50, y + rh * 0.64);
      ctx.fillStyle = '#5a6470'; ctx.font = `600 ${Math.min(40, rh * 0.32)}px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText(`${row.g.rows.length} roadmap element${row.g.rows.length > 1 ? 's' : ''} · Q1–Q4`, rx1 - 30, y + rh * 0.62); ctx.textAlign = 'left';
      if (on > 0.99) { ctx.strokeStyle = row.p.color; ctx.lineWidth = 8; ctx.strokeRect(rx0 + 4, y + 10, rx1 - rx0 - 8, rh - 20); }
      gy[row.g.id] = y + rh / 2;
    }
  });
  ctx.restore();
  ctx.globalAlpha = 1;
  // connectors: each house element draws a line to its roadmap block
  const boosterCol = { 'h-digi': '#1E88D9', 'h-indirect': '#0A6EBD' };
  links.forEach(({ e, i }) => {
    const t = seg(0.42 + i * 0.09, 0.52 + i * 0.09); if (t <= 0) return;
    const a = hp(e.id), by = gy[e.roadmap]; if (!a || by == null) return;
    const b = [rx0 - 10, by], c1 = [a[0] + 520, a[1]], c2 = [b[0] - 420, b[1]];
    const col = e.color || boosterCol[e.id] || '#1E88D9';
    ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath();
    const N = 60, n = Math.max(1, Math.round(N * t));
    for (let j = 0; j <= n; j++) { const u = j / N, m = 1 - u; const x = m * m * m * a[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * b[0], y = m * m * m * a[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * b[1]; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a[0], a[1], 22, 0, Math.PI * 2); ctx.fill();
    if (t > 0.98) { ctx.beginPath(); ctx.moveTo(b[0] + 6, b[1]); ctx.lineTo(b[0] - 40, b[1] - 26); ctx.lineTo(b[0] - 40, b[1] + 26); ctx.closePath(); ctx.fill(); }
  });
  ctx.lineCap = 'butt';
  const done = seg(0.95, 1);
  if (done > 0) { ctx.globalAlpha = done; ctx.fillStyle = '#0A6EBD'; ctx.font = `800 60px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Roadmap 2026 · aligned with the House of BPS GO!+', W * 0.27, H - 70); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
}
// ---------- Roadmap 2026 (rows grouped by pillar, quarters with ticks) ----------
function drawRoadmap(w, ctx, W, H, HH, p, L, hits, isHover) {
  const rm = w.data.roadmap, hl = w.hl;
  const x0 = 50, top = HH + 30, cols = [380, 520, 470, 470, 470, 470, 560, 300, 330];
  const cx = []; let acc = x0; for (const c of cols) { cx.push(acc); acc += c; }
  const rows = []; rm.pillars.forEach(pl => { rows.push({ band: pl }); pl.groups.forEach(g => g.rows.forEach((r, i) => rows.push({ pl, g, r, first: i === 0, n: g.rows.length }))); });
  const headH = 76, rh = (H - top - headH - 20) / rows.length;
  // header
  ctx.fillStyle = '#a6a6a6'; ctx.fillRect(cx[2], top, acc - cx[2], headH);
  ctx.fillStyle = '#ffffff'; ctx.font = `800 40px ${FONT}`; ctx.textAlign = 'center';
  [...rm.quarters, 'KPI', 'Target', rm.ytdLabel].forEach((t, i) => ctx.fillText(t, cx[i + 2] + cols[i + 2] / 2, top + 52));
  let y = top + headH;
  rows.forEach((row, ri) => {
    const k = clamp(p * 1.8 - ri * 0.03, 0, 1);
    if (row.band) {
      const pl = row.band, dim = hl.pillar && hl.pillar !== pl.id && !pl.groups.some(g => g.id === hl.pillar) ? 0.3 : 1;
      ctx.globalAlpha = k * dim; ctx.fillStyle = pl.color; ctx.fillRect(x0, y, acc - x0, rh - 4);
      ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.min(46, rh * 0.6)}px ${FONT}`; ctx.fillText(pl.name.toUpperCase(), cx[0] + (cols[0] + cols[1]) / 2, y + rh * 0.68);
      ctx.font = `600 ${Math.min(38, rh * 0.5)}px ${FONT}`; ctx.fillText(`${pl.motto}  ${pl.tag}`, cx[2] + (acc - cx[2]) / 2, y + rh * 0.66);
      hits.push({ type: 'pillar', id: pl.id, x: x0, y, w: acc - x0, h: rh }); L[pl.id] = { u: (cx[2] + (acc - cx[2]) / 2) / W, v: (y + rh / 2) / H };
    } else {
      const { pl, g, r } = row, on = hl.row === r.id, gOn = hl.pillar === g.id || hl.pillar === pl.id, hov = isHover('kpi', r.id);
      const dim = hl.pillar && !gOn ? 0.3 : 1;
      ctx.globalAlpha = k * dim;
      if (row.first) {
        const gh = rh * row.n, gHov = isHover('group', g.id);
        ctx.fillStyle = gHov || hl.pillar === g.id ? pl.light : '#e8e8e8'; ctx.fillRect(x0, y, cols[0] - 4, gh - 4);
        ctx.fillStyle = '#12161C'; ctx.font = `800 ${Math.min(40, rh * 0.5)}px ${FONT}`; ctx.textAlign = 'center';
        const lines = wrap(ctx, g.name, cols[0] - 40); lines.forEach((ln, i) => ctx.fillText(ln, x0 + cols[0] / 2, y + gh / 2 + (i - (lines.length - 1) / 2) * rh * 0.55 + 12));
        hits.push({ type: 'group', id: g.id, x: x0, y, w: cols[0], h: gh }); L[g.id] = { u: (x0 + cols[0] / 2) / W, v: (y + gh / 2) / H };
        L['rows:' + g.id] = { u: (x0 + acc) / 2 / W, v: (y + gh / 2) / H };
      }
      ctx.fillStyle = on ? pl.light : hov ? '#e3eef8' : '#f2f2f2'; ctx.fillRect(cx[1], y, cols[1] - 4, rh - 4);
      ctx.fillStyle = '#222'; ctx.font = `700 ${Math.min(36, rh * 0.46)}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(fitLine(ctx, r.element, cols[1] - 30), cx[1] + 16, y + rh * 0.62);
      const fs = Math.min(33, rh * 0.43);
      r.q.forEach(([txt, done], qi) => {
        const qx = cx[2 + qi]; ctx.fillStyle = pl.color; ctx.globalAlpha = k * dim * (on ? 1 : 0.92); ctx.fillRect(qx, y, cols[2 + qi] - 4, rh - 4);
        ctx.fillStyle = '#ffffff'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(fitLine(ctx, txt, cols[2 + qi] - 70), qx + cols[2 + qi] / 2 - 14, y + rh * 0.62);
        if (done) { ctx.fillStyle = '#12161C'; ctx.font = `800 ${fs * 1.3}px ${FONT}`; ctx.fillText('✓', qx + cols[2 + qi] - 34, y + rh * 0.7); }
      });
      ctx.globalAlpha = k * dim;
      ctx.fillStyle = pl.color; ctx.fillRect(cx[6], y, cols[6] - 4, rh - 4); ctx.fillStyle = '#ffffff'; ctx.font = `700 ${fs}px ${FONT}`; ctx.fillText(fitLine(ctx, r.kpi, cols[6] - 30), cx[6] + cols[6] / 2, y + rh * 0.62);
      ctx.fillStyle = pl.color; ctx.fillRect(cx[7], y, cols[7] - 4, rh - 4); ctx.fillStyle = '#ffffff'; ctx.fillText(fitLine(ctx, r.target, cols[7] - 20), cx[7] + cols[7] / 2, y + rh * 0.62);
      ctx.fillStyle = pl.color; ctx.fillRect(cx[8], y, cols[8] - 4, rh - 4); ctx.fillStyle = '#ffffff'; ctx.fillText(fitLine(ctx, r.ytd, cols[8] - 70), cx[8] + cols[8] / 2 - 18, y + rh * 0.62);
      if (on || hov) { ctx.strokeStyle = '#12161C'; ctx.lineWidth = 6; ctx.strokeRect(cx[1], y, acc - cx[1] - 4, rh - 4); }
      ctx.textAlign = 'left';
      hits.push({ type: 'kpi', id: r.id, x: cx[1], y, w: acc - cx[1], h: rh }); L[r.id] = { u: (cx[1] + (acc - cx[1]) / 2) / W, v: (y + rh / 2) / H };
    }
    y += rh;
  });
  ctx.globalAlpha = 1;
}

function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// Target 2027: two goal cards, revealed one per Next (w.t27.v = reveal 0..1 per card)
function drawTarget27(w, ctx, W, H, HH) {
  const T = w.data.target2027, V27 = w.t27.v;
  const g = ctx.createLinearGradient(0, HH, 0, H); g.addColorStop(0, '#eef3f9'); g.addColorStop(1, '#dde6f0');
  ctx.fillStyle = g; ctx.fillRect(0, HH, W, H - HH);
  const pad = 110, gap = 110, cw = (W - pad * 2 - gap) / 2, y0 = HH + 110, ch = H - y0 - 110;
  T.items.forEach((it, i) => {
    const a = ease.out(clamp(V27[i] || 0, 0, 1)); if (a <= 0) {
      // placeholder outline so the empty slot reads as "coming next"
      ctx.save(); ctx.setLineDash([30, 24]); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,110,189,0.25)';
      rrect(ctx, pad + i * (cw + gap), y0, cw, ch, 48); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(10,110,189,0.35)'; ctx.font = `800 300px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('?', pad + i * (cw + gap) + cw / 2, y0 + ch / 2 + 100); ctx.textAlign = 'left';
      return;
    }
    const x = pad + i * (cw + gap), gold = i === 1;
    const c1 = gold ? '#C8960C' : '#0A6EBD', c2 = gold ? '#8A5A00' : '#063E70', ink = gold ? '#7A4E00' : '#0A4F8A';
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + cw / 2, y0 + ch / 2); const s = 0.85 + 0.15 * a; ctx.scale(s, s); ctx.translate(-(x + cw / 2), -(y0 + ch / 2) + (1 - a) * 120);
    // card with shadow
    ctx.shadowColor = 'rgba(6,30,60,0.28)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
    ctx.fillStyle = '#ffffff'; rrect(ctx, x, y0, cw, ch, 48); ctx.fill();
    ctx.shadowColor = 'transparent';
    // header band
    ctx.save(); rrect(ctx, x, y0, cw, ch, 48); ctx.clip();
    const hg = ctx.createLinearGradient(x, 0, x + cw, 0); hg.addColorStop(0, c1); hg.addColorStop(1, c2);
    ctx.fillStyle = hg; ctx.fillRect(x, y0, cw, 170);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `800 56px ${FONT}`; ctx.fillText(`GOAL ${i + 1}`, x + 80, y0 + 108);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 76px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(it.head, x + cw - 80, y0 + 112); ctx.textAlign = 'left';
    // icon badge
    const bx = x + cw / 2, by = y0 + 170 + 175, br = 135;
    const bg = ctx.createRadialGradient(bx - 60, by - 60, 20, bx, by, br); bg.addColorStop(0, gold ? '#FFF4CC' : '#E3F0FC'); bg.addColorStop(1, gold ? '#F3D77A' : '#9CC7EE');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 14; ctx.strokeStyle = c1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `170px ${FONT}`; ctx.fillText(it.icon, bx, by + 60);
    // big statement
    ctx.fillStyle = ink; const fs = fitText(ctx, it.big, cw - 160, 230, 900); ctx.font = `900 ${fs}px ${FONT}`; ctx.fillText(it.big, bx, by + br + 210);
    ctx.fillStyle = '#3f4853'; ctx.font = `700 64px ${FONT}`; ctx.fillText(it.sub, bx, by + br + 300);
    ctx.textAlign = 'left';
    // journey: rising steps
    const steps = it.steps || [], sy = y0 + ch - 110, sx0 = x + 140, sw = cw - 280;
    if (steps.length) {
      const n = steps.length, bw = (sw - (n - 1) * 50) / n, maxH = Math.max(200, sy - (by + br + 360) - 40);
      steps.forEach((st, k) => {
        const kk = clamp(a * 1.6 - k * 0.25, 0, 1), bh = (maxH * (0.4 + 0.6 * k / Math.max(1, n - 1))) * kk, bxk = sx0 + k * (bw + 50);
        const last = k === n - 1;
        ctx.fillStyle = last ? c1 : (gold ? '#EBD9A6' : '#BFD8EF'); rrect(ctx, bxk, sy - bh, bw, Math.max(bh, 1), 22); ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = last ? '#ffffff' : ink; ctx.font = `900 ${last ? 96 : 80}px ${FONT}`; if (bh > 120) ctx.fillText(st[1], bxk + bw / 2, sy - bh + (last ? 110 : 96));
        ctx.fillStyle = '#5a6470'; ctx.font = `800 52px ${FONT}`; ctx.fillText(st[0], bxk + bw / 2, sy + 70);
        ctx.textAlign = 'left';
        if (k < n - 1 && kk > 0.9) { ctx.fillStyle = c1; ctx.font = `900 60px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('➜', bxk + bw + 25, sy - bh - 30); ctx.textAlign = 'left'; }
      });
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function fitLine(ctx, text, maxW) { if (ctx.measureText(text).width <= maxW) return text; let t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }

export function buildEntrance(scene, data, logoImg) {
  const root = new THREE.Group(); root.name = 'entrance'; scene.add(root);
  const wall = new KpiWall(data, logoImg);
  const wg = new THREE.Group(); wg.position.set(KPI_WALL.x, KPI_WALL.y, KPI_WALL.z); wg.rotation.y = KPI_WALL.ry; root.add(wg);
  wg.add(wall.mesh);
  const frameM = mat(0x1b2027, { rough: 0.35, metal: 0.6 });
  box(KPI_WALL.w + 0.3, KPI_WALL.h + 0.3, 0.3, frameM, 0, 0, -0.17, wg);
  box(KPI_WALL.w + 0.3, 0.07, 0.07, glow(C.red, 2), 0, -KPI_WALL.h / 2 - 0.19, 0.02, wg);
  const legH = KPI_WALL.y - KPI_WALL.h / 2;
  for (const sx of [-KPI_WALL.w * 0.33, KPI_WALL.w * 0.33]) { box(0.3, legH + 0.4, 0.3, frameM, sx, -KPI_WALL.y + (legH + 0.4) / 2, -0.17, wg); box(1.2, 0.08, 1.4, frameM, sx, -KPI_WALL.y + 0.04, -0.17, wg); }
  shadows(wg, true, true); wall.mesh.castShadow = false;
  const wallLight = new THREE.PointLight(0xffffff, 0, 12, 1.6);
  let hlPillar = null, pulse = 0;

  const center = V(0, 0, 24);
  // ---- confetti ----
  const CN = 420;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CN);
  conf.frustumCulled = false; conf.visible = false; root.add(conf);
  const cs = []; const white = new THREE.Color(2, 2, 2), red = new THREE.Color(C.red).multiplyScalar(2);
  for (let i = 0; i < CN; i++) { cs.push({ p: V(), v: V(), r: V(), w: V(Math.random() * 6, Math.random() * 6, Math.random() * 6) }); conf.setColorAt(i, i % 3 === 0 ? white : red); }
  let confT = -1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);


  return {
    root, wall,
    pillarIds: [...data.roadmap.pillars.map(p => p.id), data.reflection.id],
    logoAnchor() { return wall.logoSpot(); },
    anchor(id) { return wall.pillarSpot(id); },
    setBuild() { }, snapBuild() { },
    highlight(id) { hlPillar = id; wall.highlight(id, null); },
    pulse() { pulse = 1; },
    burst() {
      confT = 0; conf.visible = true;
      cs.forEach(c => { c.p.set(center.x + (Math.random() - 0.5) * 3, 4.5 + Math.random() * 2, center.z - 1 + (Math.random() - 0.5) * 3); const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; c.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.v.set(Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s); c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); });
    },
    update(dt, t) {
      wall.update(dt);
      pulse = Math.max(0, pulse - dt * 0.8); void hlPillar; void wallLight;
      if (confT >= 0) {
        confT += dt;
        cs.forEach((c, i) => {
          c.v.y -= 4.5 * dt; c.v.multiplyScalar(1 - 1.6 * dt); c.v.y = Math.max(c.v.y, -1.2);
          c.p.addScaledVector(c.v, dt); c.p.x += Math.sin(t * 2 + i) * dt * 0.3;
          c.r.addScaledVector(c.w, dt); if (c.p.y < 0.02) { c.p.y = 0.02; c.v.set(0, 0, 0); c.r.x = -Math.PI / 2; c.w.set(0, 0, 0); }
          q.setFromEuler(e.set(c.r.x, c.r.y, c.r.z)); m4.compose(c.p, q, one); conf.setMatrixAt(i, m4);
        });
        conf.instanceMatrix.needsUpdate = true;
        if (confT > 14) { confT = -1; conf.visible = false; }
      }
    },
    hideConfetti() { confT = -1; conf.visible = false; },
  };
}
