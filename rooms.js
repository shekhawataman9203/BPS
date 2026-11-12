import { THREE, RoundedBoxGeometry } from './lib.js';
import { C, CSS, FONT, mat, glow, box, cyl, shadows, CanvasTex, fitText, V, fmt, clamp, ease, lerp } from './util.js';

// ======================= Meeting room =======================
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

export class LedWall {
  constructor(data) {
    this.data = data; this.view = 'idle'; this.p = 1; this.hl = -1; this.animating = false;
    this.ct = new CanvasTex(2048, 768, (ctx, W, H) => this.draw(ctx, W, H));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ map: this.ct.tex, toneMapped: false }));
    this.mesh.material.color.setScalar(1.05);
    this.mesh.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
  }
  show(view, hl = -1) { if (view === this.view && hl === this.hl) return; this.view = view; this.hl = hl; this.p = 0; this.animating = true; }
  highlight(i) { this.hl = i; this.ct.redraw(); }
  update(dt) { if (!this.animating) return; this.p = Math.min(1, this.p + dt / 1.8); this.ct.redraw(); if (this.p >= 1) this.animating = false; }
  // world position of a spot on the screen, u,v in 0..1 from top-left
  spot(u, v) { return V(SCREEN.x - SCREEN.w / 2 + u * SCREEN.w, SCREEN.y + SCREEN.h / 2 - v * SCREEN.h, SCREEN.z); }
  tileSpot(i) { return this.spot((80 + i * 488 + 224) / 2048, 0.55); }
  draw(ctx, W, H) {
    const d = this.data, p = ease.out(this.p);
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0e1218'); g.addColorStop(1, '#151a22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#ffffff';
    for (let x = 0; x < W; x += 64) ctx.fillRect(x, 0, 1, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = CSS.red; ctx.fillRect(0, H - 10, W * p, 10);
    const head = (title, sub) => {
      ctx.globalAlpha = p; ctx.fillStyle = '#F4F6F8'; ctx.font = `800 76px ${FONT}`; ctx.fillText(title, 80, 130);
      if (sub) { ctx.fillStyle = '#9AA3AE'; ctx.font = `500 34px ${FONT}`; ctx.fillText(sub, 80, 184); }
      ctx.fillStyle = CSS.red; ctx.fillRect(80, 40, 90 * p, 10); ctx.globalAlpha = 1;
    };
    if (this.view === 'idle' || this.view === 'title') {
      ctx.fillStyle = CSS.red; ctx.fillRect(80, 200, 140 * p, 14);
      ctx.fillStyle = '#F4F6F8'; ctx.globalAlpha = p;
      ctx.font = `800 150px ${FONT}`; ctx.fillText('BPS Strategy', 80, 380);
      ctx.fillText('Workshop 2026', 80, 540);
      ctx.fillStyle = '#9AA3AE'; ctx.font = `500 44px ${FONT}`; ctx.fillText(`${d.meta.plant}, ${d.meta.date}`, 80, 640);
      ctx.globalAlpha = 1;
    } else if (this.view === 'welcome') {
      head('Welcome', d.meta.tagline);
      const items = ['2026 achievements', 'Lean transformation', 'Digital projects', 'KPI review', '2027 strategy', 'Commitment'];
      items.forEach((s, i) => {
        const k = clamp(p * 1.6 - i * 0.1, 0, 1); ctx.globalAlpha = k;
        const col = i % 2, row = Math.floor(i / 2), x = 80 + col * 960, y = 300 + row * 140;
        ctx.fillStyle = CSS.red; ctx.font = `800 64px ${FONT}`; ctx.fillText(String(i + 2).padStart(2, '0'), x, y + 20);
        ctx.fillStyle = '#F4F6F8'; ctx.font = `700 60px ${FONT}`; ctx.fillText(s, x + 120, y + 20);
      });
      ctx.globalAlpha = 1;
    } else if (this.view === 'achievements') {
      head('2026 achievements', d.achievements.intro);
      d.achievements.headline.forEach((h, i) => {
        const x = 80 + i * 488, y = 240, w = 448, hh = 470;
        const k = clamp(p * 1.4 - i * 0.12, 0, 1);
        ctx.globalAlpha = 0.25 + 0.75 * k;
        ctx.fillStyle = i === this.hl ? 'rgba(226,0,21,0.16)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x, y, w, hh);
        ctx.fillStyle = i === this.hl ? CSS.red : 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, i === this.hl ? 10 : 3);
        ctx.fillStyle = '#9AA3AE'; ctx.font = `600 34px ${FONT}`; ctx.fillText(h.short, x + 32, y + 72);
        const v = h.value * ease.outExpo(k);
        const txt = (h.prefix || '') + fmt(v, h.decimals) + (h.unit.trim() === '%' ? '%' : '');
        ctx.fillStyle = '#F4F6F8'; const fs = fitText(ctx, txt, w - 64, 132, 800); ctx.font = `800 ${fs}px ${FONT}`; ctx.fillText(txt, x + 32, y + 220);
        if (h.unit.trim() && h.unit.trim() !== '%') { ctx.fillStyle = '#9AA3AE'; ctx.font = `600 34px ${FONT}`; ctx.fillText(h.unit.trim(), x + 32, y + 268); }
        ctx.fillStyle = i === this.hl ? '#ffffff' : '#c9ced5'; ctx.font = `600 30px ${FONT}`; ctx.fillText(h.delta, x + 32, y + 318);
        // sparkline
        const s = h.series, mn = Math.min(...s), mx = Math.max(...s);
        ctx.beginPath(); ctx.strokeStyle = i === this.hl ? CSS.red : '#F4F6F8'; ctx.lineWidth = 5;
        const n = Math.max(2, Math.floor(s.length * k));
        for (let j = 0; j < n; j++) { const px = x + 32 + j / (s.length - 1) * (w - 64), py = y + hh - 40 - (s[j] - mn) / (mx - mn || 1) * 90; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    } else if (this.view === 'kpi') {
      head('KPI review 2026', 'December result against target. Bar height shows attainment; the line marks 100%.');
      const items = d.kpis.items; const bw = 150, gap = (W - 160 - bw * items.length) / (items.length - 1);
      const base = 640, full = 300;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(80, base - full); ctx.lineTo(W - 80, base - full); ctx.stroke(); ctx.setLineDash([]);
      items.forEach((k, i) => {
        const a = attainment(k); const x = 80 + i * (bw + gap);
        const hgt = full * Math.min(1.35, a) * ease.out(clamp(p * 1.4 - i * 0.06, 0, 1));
        ctx.fillStyle = a >= 1 ? (i === this.hl ? '#ffffff' : '#c9ced5') : CSS.red; ctx.globalAlpha = i === this.hl || this.hl < 0 ? 1 : 0.55;
        ctx.fillRect(x, base - hgt, bw, hgt);
        ctx.fillStyle = '#F4F6F8'; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(fmt(last(k), k.decimals) + k.unit.replace(' ', ''), x + bw / 2, base - hgt - 18);
        ctx.fillStyle = '#9AA3AE'; ctx.font = `600 24px ${FONT}`;
        const words = k.name.split(' '); const l1 = words.slice(0, 2).join(' '), l2 = words.slice(2).join(' ');
        ctx.fillText(l1, x + bw / 2, base + 44); if (l2) ctx.fillText(l2, x + bw / 2, base + 74);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      });
    } else {
      const titles = { lean: ['Lean transformation', 'Shop floor walk, Line A'], digital: ['Digital projects', 'Shop floor walk, digital cell'], strategy: ['2027 strategy', 'Town hall, shop floor'], closing: [d.closing.title, d.meta.event] };
      const [a, b] = titles[this.view] || ['', ''];
      ctx.globalAlpha = p; ctx.fillStyle = '#F4F6F8'; ctx.font = `800 120px ${FONT}`; ctx.fillText(a, 80, 400);
      ctx.fillStyle = '#9AA3AE'; ctx.font = `500 44px ${FONT}`; ctx.fillText(b, 80, 480); ctx.globalAlpha = 1;
    }
  }
}
export const last = k => k.monthly[k.monthly.length - 1];
export function attainment(k, v = last(k)) { return k.higherBetter ? v / k.target : k.target / v; }

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
  const sign = new CanvasTex(1024, 256, (ctx, W, H) => { ctx.clearRect(0, 0, W, H); ctx.fillStyle = CSS.red; ctx.fillRect(0, 30, 10, 196); ctx.fillStyle = '#F4F6F8'; ctx.font = `800 92px ${FONT}`; ctx.fillText('BPS', 50, 120); ctx.fillStyle = '#9AA3AE'; ctx.font = `500 46px ${FONT}`; ctx.fillText('Bosch Production System', 50, 196); });
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, toneMapped: false }));
  signM.rotation.y = Math.PI / 2; signM.position.set(x0 + 0.02, 2.6, -15.5); root.add(signM);
  // right wall graphic: the eight BPS principles
  const prin = (data.lean && data.lean.principles || []).map(p => p.name);
  const pw = new CanvasTex(2048, 512, (ctx, W, H) => {
    ctx.fillStyle = '#14181e'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 40px ${FONT}`; ctx.fillText('The eight principles of the Bosch Production System', 70, 92);
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
  const wall = new LedWall(data);
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

// ======================= KPI hologram (over the table) =======================
export function buildKpiHologram(scene, data) {
  const g = new THREE.Group(); g.position.set(0, TABLE.top + 0.02, TABLE.z); scene.add(g);
  const items = data.kpis.items, n = items.length, span = 5.8;
  const bars = [], mats = [];
  const fade = (c, max, additive = true) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }); m.userData.max = max; mats.push(m); return m; };
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, span + 0.8), fade(C.red, 0.12)); g.add(plate);
  const target = new THREE.Mesh(new THREE.PlaneGeometry(1.0, span + 0.6), fade(0xffffff, 0.08)); target.rotation.x = -Math.PI / 2; target.position.y = 1; g.add(target);
  const tEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.0, span + 0.6)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); tEdge.material.userData.max = 0.6; mats.push(tEdge.material);
  tEdge.rotation.x = -Math.PI / 2; tEdge.position.y = 1; g.add(tEdge);
  items.forEach((k, i) => {
    const z = -span / 2 + i * span / (n - 1);
    const a = attainment(k);
    const ok = a >= 1;
    const geo = new THREE.BoxGeometry(0.34, 1, 0.34); geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, fade(ok ? 0xffffff : C.red, ok ? 0.42 : 0.6));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: ok ? 0xffffff : 0xff2233, transparent: true, opacity: 0, depthWrite: false }));
    edges.material.userData.max = 0.95; mats.push(edges.material);
    m.position.z = z; edges.position.z = z; m.scale.y = 0.001; edges.scale.y = 0.001;
    m.userData.kpi = k.id; g.add(m, edges);
    bars.push({ k, m, edges, h: Math.min(1.4, a), cur: 0.001, delay: i * 0.12, z });
  });
  let level = 0, targetLevel = 0, grow = 0, hl = null;
  return {
    group: g, bars,
    show(on) { targetLevel = on ? 1 : 0; if (on) grow = 0; },
    highlight(id) { hl = id; },
    anchor(id) { const b = bars.find(b => b.k.id === id); return b ? V(g.position.x, g.position.y + b.h + 0.18, g.position.z + b.z) : null; },
    update(dt, t) {
      level += (targetLevel - level) * (1 - Math.exp(-3 * dt));
      g.visible = level > 0.01; if (!g.visible) return;
      grow += dt;
      for (const m of mats) m.opacity = m.userData.max * level;
      for (const b of bars) {
        const k = clamp((grow - 0.5 - b.delay) / 1.2, 0, 1);
        const hgt = Math.max(0.001, b.h * ease.outBack(k) * level);
        b.m.scale.y = hgt; b.edges.scale.y = hgt;
        const on = hl === b.k.id;
        b.m.scale.x = b.m.scale.z = b.edges.scale.x = b.edges.scale.z = on ? 1.25 + 0.05 * Math.sin(t * 6) : 1;
        b.m.material.opacity = b.m.material.userData.max * level * (hl && !on ? 0.4 : on ? 1.8 : 1);
      }
      plate.material.opacity = (0.09 + 0.04 * Math.sin(t * 2)) * level;
    },
  };
}

// ======================= Town hall: strategy house, banner, confetti =======================
export function buildTownHall(scene, data) {
  const root = new THREE.Group(); root.name = 'townhall'; scene.add(root);
  const center = V(-4, 0, 25);
  // floor rings
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.0, 128), glow(C.red, 1.8)); ring.rotation.x = -Math.PI / 2; ring.position.set(center.x, 0.02, center.z); root.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.04, 96), glow(0xffffff, 0.8)); ring2.rotation.x = -Math.PI / 2; ring2.position.set(center.x, 0.02, center.z); root.add(ring2);
  // banner on back wall
  const banner = new CanvasTex(2048, 512, (ctx, W, H) => {
    ctx.fillStyle = '#0d1015'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, 24, H);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 132px ${FONT}`; ctx.fillText('Bosch Production System', 110, 250);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `500 60px ${FONT}`; ctx.fillText(data.meta.org + ' ' + data.meta.plant, 114, 370);
  });
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshBasicMaterial({ map: banner.tex, toneMapped: false }));
  ban.material.color.setScalar(0.7);
  ban.rotation.y = Math.PI; ban.position.set(-4, 8.3, 31.55); root.add(ban);

  // ---- strategy house (faces -z, toward the hall) ----
  const house = new THREE.Group(); house.position.set(-4, 0, 28.6); root.add(house);
  const parts = []; // {id, group, mats, kind}
  const glassM = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, emissive: new THREE.Color(C.red), emissiveIntensity: 0.0 });
  const edgeM = (c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9, toneMapped: false });
  const label = (text, w, h, size, vertical = false) => {
    const ct = new CanvasTex(vertical ? 256 : 1024, vertical ? 1024 : Math.round(1024 * h / w), (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#F4F6F8';
      if (vertical) { ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 2); const s = fitText(ctx, text, H * 0.9, size, 800); ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0); }
      else { const s = fitText(ctx, text, W * 0.9, size, 800); ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, H / 2); }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? h : w, vertical ? w : h), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
    m.rotation.y = Math.PI; return m;
  };
  const mkPart = (id, geo, pos, edgeColor, lbl) => {
    const grp = new THREE.Group(); grp.position.copy(pos); house.add(grp);
    const gm = glassM(); const mesh = new THREE.Mesh(geo, gm); mesh.userData.part = id; grp.add(mesh);
    const em = edgeM(edgeColor); const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), em); grp.add(e);
    if (lbl) grp.add(lbl);
    const p = { id, grp, mesh, gm, em, lbl, base: pos.clone() }; parts.push(p); return p;
  };
  const fGeo = new THREE.BoxGeometry(10.4, 0.6, 2.6); fGeo.translate(0, 0.3, 0);
  const fl = label(data.strategy.foundation.name, 5.6, 0.36, 120); fl.position.set(0, 0.3, -1.32);
  mkPart('base', fGeo, V(0, 0, 0), 0xffffff, fl);
  data.strategy.pillars.forEach((pl, i) => {
    const geo = new THREE.BoxGeometry(1.25, 3.4, 1.25); geo.translate(0, 1.7, 0);
    const l = label(pl.name, 3.0, 0.62, 150, true); l.position.set(0, 1.7, -0.64);
    mkPart(pl.id, geo, V(3.9 - i * 2.6, 0.6, 0), 0xffffff, l); // house faces -z, so +x is screen-left
  });
  const roofShape = new THREE.Shape(); roofShape.moveTo(-5.9, 0); roofShape.lineTo(5.9, 0); roofShape.lineTo(0, 2.5); roofShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 2.8, bevelEnabled: false }); rGeo.translate(0, 0, -1.4);
  const rl = label(data.strategy.vision.title, 4.4, 0.9, 200); rl.position.set(0, 0.85, -1.42);
  mkPart('vision', rGeo, V(0, 4.0, 0), C.red, rl);
  const houseLight = new THREE.PointLight(0xff3344, 0, 10, 1.8); houseLight.position.set(0, 3, -2.5); house.add(houseLight);
  house.visible = false;
  let prog = 0, progTarget = 0, hl = null;

  // ---- confetti ----
  const CN = 420;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CN);
  conf.frustumCulled = false; conf.visible = false; root.add(conf);
  const cs = []; const white = new THREE.Color(2, 2, 2), red = new THREE.Color(C.red).multiplyScalar(2);
  for (let i = 0; i < CN; i++) { cs.push({ p: V(), v: V(), r: V(), w: V(Math.random() * 6, Math.random() * 6, Math.random() * 6) }); conf.setColorAt(i, i % 3 === 0 ? white : red); }
  let confT = -1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);

  return {
    root, house, parts,
    anchor(id) { const p = parts.find(p => p.id === id); if (!p) return null; const v = p.grp.getWorldPosition(V()); v.y += id === 'base' ? 0.9 : id === 'vision' ? 2.9 : 3.8; v.z -= 1; return v; },
    setBuild(v) { progTarget = v; if (v === 0) prog = 0; },
    snapBuild(v) { prog = progTarget = v; },
    highlight(id) { hl = id; },
    burst() {
      confT = 0; conf.visible = true;
      cs.forEach(c => { c.p.set(center.x + (Math.random() - 0.5) * 3, 4.5 + Math.random() * 2, center.z - 1 + (Math.random() - 0.5) * 3); const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; c.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.v.set(Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s); c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); });
    },
    update(dt, t) {
      prog += (progTarget - prog) * (1 - Math.exp(-1.6 * dt));
      house.visible = prog > 0.005;
      if (house.visible) {
        for (const p of parts) {
          let k;
          if (p.id === 'base') k = clamp(prog / 0.25, 0, 1);
          else if (p.id === 'vision') k = clamp((prog - 0.72) / 0.28, 0, 1);
          else { const i = data.strategy.pillars.findIndex(x => x.id === p.id); k = clamp((prog - 0.22 - i * 0.12) / 0.2, 0, 1); }
          const ek = ease.out(k);
          if (p.id === 'vision') { p.grp.position.y = p.base.y + (1 - ek) * 3.5; p.grp.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * ek)); }
          else p.grp.scale.set(1, Math.max(0.001, ek), 1);
          const on = hl === p.id;
          p.gm.opacity = (on ? 0.32 : 0.12) * ek; p.gm.emissiveIntensity = on ? 0.9 + 0.3 * Math.sin(t * 5) : 0.08;
          p.em.opacity = 0.9 * ek; p.em.color.setHex(on ? C.red : (p.id === 'vision' ? C.red : 0xffffff)); p.em.color.multiplyScalar(on ? 2.5 : 1.4);
          if (p.lbl) p.lbl.material.opacity = clamp((k - 0.6) / 0.4, 0, 1);
        }
        houseLight.intensity = 7 * prog;
      }
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
