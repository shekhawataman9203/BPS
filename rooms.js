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

// ======================= Entrance: KPI wall (left), BPS GO!+ stand (right), confetti =======================
const STATUS_COL = { ok: '#3FBF8F', watch: '#F2B233', behind: '#E20015' };
export const STATUS_LABEL = { ok: 'On track', watch: 'Watch', behind: 'Behind' };
export const KPI_WALL = { x: -7.6, y: 3.3, z: 22.2, w: 11, h: 4.8, ry: Math.PI / 2 - 0.35 };
export const STAND = { x: 7.4, z: 22.4, ry: -(Math.PI / 2 - 0.35) };

export function allRows(data) {
  const out = [];
  data.roadmap.pillars.forEach(p => p.groups.forEach(g => g.rows.forEach(r => out.push({ ...r, pillar: p.id, pillarName: p.name, group: g.id, groupName: g.name, color: p.color }))));
  return out;
}

class KpiWall {
  constructor(data) {
    this.data = data; this.p = 1; this.animating = false; this.hl = { pillar: null, row: null }; this.layout = {};
    this.ct = new CanvasTex(3072, 1340, (ctx, W, H) => this.draw(ctx, W, H));
    this.ct.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(KPI_WALL.w, KPI_WALL.h), new THREE.MeshBasicMaterial({ map: this.ct.tex, toneMapped: false }));
    this.mesh.material.color.setScalar(1.02);
  }
  replay() { this.p = 0; this.animating = true; }
  highlight(pillar = null, row = null) { this.hl = { pillar, row }; this.ct.redraw(); }
  update(dt) { if (!this.animating) return; this.p = Math.min(1, this.p + dt / 2.2); this.ct.redraw(); if (this.p >= 1) this.animating = false; }
  // world position of a spot on the wall, u,v in 0..1 from top-left
  spot(u, v) { this.mesh.updateMatrixWorld(true); return this.mesh.localToWorld(V((u - 0.5) * KPI_WALL.w, (0.5 - v) * KPI_WALL.h, 0.05)); }
  rowSpot(id) { const l = this.layout[id]; return l ? this.spot(l.u, l.v) : this.spot(0.5, 0.5); }
  pillarSpot(id) { const l = this.layout[id]; return l ? this.spot(l.u, l.v) : this.spot(0.5, 0.5); }
  draw(ctx, W, H) {
    const d = this.data, rm = d.roadmap, p = ease.out(this.p), hl = this.hl;
    ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0A6EBD'; ctx.font = `800 84px ${FONT}`; ctx.fillText('BPS GO!+ KPI wall 2026', 70, 112);
    ctx.fillStyle = '#4a525d'; ctx.font = `600 40px ${FONT}`; ctx.fillText(`Target against ${rm.ytdLabel}`, 70, 168);
    // legend
    let lx = W - 70; ctx.textAlign = 'right'; ctx.font = `700 36px ${FONT}`;
    for (const k of ['behind', 'watch', 'ok']) { const t = STATUS_LABEL[k]; ctx.fillStyle = '#12161C'; ctx.fillText(t, lx, 140); lx -= ctx.measureText(t).width + 18; ctx.fillStyle = STATUS_COL[k]; ctx.beginPath(); ctx.arc(lx - 14, 128, 14, 0, Math.PI * 2); ctx.fill(); lx -= 60; }
    ctx.textAlign = 'left';
    const colW = (W - 140 - 2 * 40) / 3, top = 214;
    rm.pillars.forEach((pl, ci) => {
      const x = 70 + ci * (colW + 40), rows = pl.groups.flatMap(g => g.rows);
      const dim = (hl.pillar && hl.pillar !== pl.id) ? 0.28 : 1;
      const k = clamp(p * 1.5 - ci * 0.15, 0, 1);
      ctx.globalAlpha = dim * (0.2 + 0.8 * k);
      ctx.fillStyle = pl.color; ctx.fillRect(x, top, colW, 96);
      ctx.fillStyle = '#ffffff'; ctx.font = `800 52px ${FONT}`; ctx.fillText(pl.name.toUpperCase(), x + 30, top + 66);
      const ok = rows.filter(r => r.status === 'ok').length;
      ctx.textAlign = 'right'; ctx.font = `700 36px ${FONT}`; ctx.fillText(`${ok} of ${rows.length} on track`, x + colW - 26, top + 62); ctx.textAlign = 'left';
      this.layout[pl.id] = { u: (x + colW / 2) / W, v: (top + 48) / H };
      // column headers
      ctx.fillStyle = '#6b737e'; ctx.font = `700 28px ${FONT}`;
      const tx = x + colW - 390, yx = x + colW - 190;
      ctx.fillText('KPI', x + 30, top + 140); ctx.fillText('Target', tx, top + 140); ctx.fillText('YTD', yx, top + 140);
      const rh = Math.min(132, (H - top - 170) / rows.length);
      rows.forEach((r, i) => {
        const y = top + 158 + i * rh, on = hl.row === r.id;
        const rk = clamp(p * 1.8 - ci * 0.15 - i * 0.05, 0, 1);
        ctx.globalAlpha = dim * rk * (hl.row && !on ? 0.45 : 1);
        ctx.fillStyle = on ? pl.light : i % 2 ? '#ffffff' : '#eceff2'; ctx.fillRect(x, y, colW, rh - 8);
        if (on) { ctx.fillStyle = pl.color; ctx.fillRect(x, y, 12, rh - 8); }
        ctx.fillStyle = '#12161C'; const fs = fitText(ctx, r.kpi, tx - x - 60, 36, 700); ctx.font = `700 ${fs}px ${FONT}`; ctx.fillText(r.kpi, x + 30, y + rh / 2 - 8);
        ctx.fillStyle = '#6b737e'; ctx.font = `600 26px ${FONT}`; ctx.fillText(r.element, x + 30, y + rh / 2 + 28);
        ctx.fillStyle = '#12161C'; const f2 = fitText(ctx, r.target, 180, 38, 700); ctx.font = `700 ${f2}px ${FONT}`; ctx.fillText(r.target, tx, y + rh / 2 + 8);
        const f3 = fitText(ctx, r.ytd, 150, 40, 800); ctx.font = `800 ${f3}px ${FONT}`; ctx.fillStyle = STATUS_COL[r.status] === STATUS_COL.ok ? '#12161C' : '#12161C'; ctx.fillText(r.ytd, yx, y + rh / 2 + 8);
        ctx.fillStyle = STATUS_COL[r.status] || '#9AA3AE'; ctx.beginPath(); ctx.arc(x + colW - 36, y + rh / 2 - 4, 15, 0, Math.PI * 2); ctx.fill();
        this.layout[r.id] = { u: (x + colW / 2) / W, v: (y + rh / 2) / H };
      });
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = CSS.red; ctx.fillRect(0, H - 12, W * p, 12);
  }
}

export function buildEntrance(scene, data, logoImg) {
  const root = new THREE.Group(); root.name = 'entrance'; scene.add(root);
  // ---- KPI wall (left of the gate aisle when walking in) ----
  const wall = new KpiWall(data);
  const wg = new THREE.Group(); wg.position.set(KPI_WALL.x, KPI_WALL.y, KPI_WALL.z); wg.rotation.y = KPI_WALL.ry; root.add(wg);
  wg.add(wall.mesh);
  const frameM = mat(0x1b2027, { rough: 0.35, metal: 0.6 });
  box(KPI_WALL.w + 0.3, KPI_WALL.h + 0.3, 0.25, frameM, 0, 0, -0.15, wg);
  box(KPI_WALL.w + 0.3, 0.06, 0.06, glow(C.red, 2), 0, -KPI_WALL.h / 2 - 0.18, 0.02, wg);
  for (const sx of [-KPI_WALL.w * 0.35, KPI_WALL.w * 0.35]) box(0.22, KPI_WALL.y - KPI_WALL.h / 2, 0.22, frameM, sx, -(KPI_WALL.y + KPI_WALL.h / 2) / 2 + 0.0, -0.15, wg);
  box(KPI_WALL.w * 0.9, 0.08, 1.2, frameM, 0, -KPI_WALL.y + 0.04, -0.15, wg);
  shadows(wg, true, true); wall.mesh.castShadow = false;

  // ---- BPS GO!+ stand: logo as the roof, four pillars, one base ----
  const stand = new THREE.Group(); stand.position.set(STAND.x, 0, STAND.z); stand.rotation.y = STAND.ry; root.add(stand);
  const pillars = [...data.roadmap.pillars.map(p => ({ id: p.id, name: p.name, color: p.color })), { id: data.reflection.id, name: data.reflection.name, color: data.reflection.color }];
  const base = new THREE.Mesh(new RoundedBoxGeometry(5.6, 0.4, 1.6, 3, 0.06), mat(0xF4F6F8, { rough: 0.35 })); base.position.y = 0.2; stand.add(base);
  const baseLbl = textPlane(data.closing.sub || 'Creating value. Together.', { w: 5.2, h: 0.32, size: 90, color: '#12161C', weight: 700 }); baseLbl.position.set(0, 0.2, 0.81); stand.add(baseLbl);
  const cols = pillars.map((p, i) => {
    const g = new THREE.Group(); g.position.set(-2.1 + i * 1.4, 0.4, 0); stand.add(g);
    const colM = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color), roughness: 0.35, emissive: new THREE.Color(p.color), emissiveIntensity: 0.15 });
    const col = new THREE.Mesh(new RoundedBoxGeometry(0.9, 2.4, 0.9, 3, 0.05), colM); col.position.y = 1.2; col.castShadow = true; col.userData.pillar = p.id; g.add(col);
    const ct = new CanvasTex(256, 768, (ctx, Wc, Hc) => { ctx.clearRect(0, 0, Wc, Hc); ctx.translate(Wc / 2, Hc / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#ffffff'; const s = fitText(ctx, p.name.toUpperCase(), Hc * 0.86, 120, 800); ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name.toUpperCase(), 0, 0); });
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.8), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, toneMapped: false })); lbl.position.set(0, 1.2, 0.46); g.add(lbl);
    return { ...p, g, col, colM, k: 1 };
  });
  // roof board with the logo
  const logoCT = new CanvasTex(1024, 384, (ctx, Wc, Hc) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, Wc, Hc);
    if (logoImg && logoImg.complete && logoImg.naturalWidth) { const r = Math.min((Wc - 80) / logoImg.naturalWidth, (Hc - 60) / logoImg.naturalHeight); const w = logoImg.naturalWidth * r, h = logoImg.naturalHeight * r; ctx.drawImage(logoImg, (Wc - w) / 2, (Hc - h) / 2, w, h); }
    else { ctx.fillStyle = '#12161C'; ctx.font = `800 140px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('BPS GO!+', Wc / 2, 230); }
  });
  if (logoImg && !logoImg.complete) logoImg.addEventListener('load', () => logoCT.redraw());
  const roof = new THREE.Group(); roof.position.y = 3.35; stand.add(roof);
  box(5.9, 2.25, 0.18, mat(0x1b2027, { rough: 0.35, metal: 0.6 }), 0, 0, -0.1, roof);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), new THREE.MeshBasicMaterial({ map: logoCT.tex, toneMapped: false })); logo.position.z = 0.0; logo.material.color.setScalar(0.95); roof.add(logo);
  box(5.9, 0.06, 0.06, glow(C.red, 2.2), 0, -1.16, 0.0, roof);
  // floor ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.42, 96), glow(0x7EDEBE, 1.4)); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 0.4); stand.add(ring);
  shadows(roof, true, false); base.castShadow = true;
  const standLight = new THREE.PointLight(0xffffff, 6, 9, 1.6); standLight.position.set(0, 3.2, 2.6); stand.add(standLight);
  let hlPillar = null, pulse = 0, buildK = 1, buildTarget = 1;

  // ---- confetti ----
  const center = V(0, 0, 23);
  // ---- confetti ----
  const CN = 420;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CN);
  conf.frustumCulled = false; conf.visible = false; root.add(conf);
  const cs = []; const white = new THREE.Color(2, 2, 2), red = new THREE.Color(C.red).multiplyScalar(2);
  for (let i = 0; i < CN; i++) { cs.push({ p: V(), v: V(), r: V(), w: V(Math.random() * 6, Math.random() * 6, Math.random() * 6) }); conf.setColorAt(i, i % 3 === 0 ? white : red); }
  let confT = -1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);


  return {
    root, wall, stand, pillars: cols,
    logoAnchor() { return roof.getWorldPosition(V()).add(V(0, 1.3, 0)); },
    anchor(id) { const c = cols.find(c => c.id === id); if (!c) return null; const v = c.g.getWorldPosition(V()); v.y = 2.9; return v; },
    setBuild(v) { buildTarget = v; },
    snapBuild(v) { buildK = buildTarget = v; },
    highlight(id) { hlPillar = id; },
    pulse() { pulse = 1; },
    burst() {
      confT = 0; conf.visible = true;
      cs.forEach(c => { c.p.set(center.x + (Math.random() - 0.5) * 3, 4.5 + Math.random() * 2, center.z - 1 + (Math.random() - 0.5) * 3); const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; c.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.v.set(Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s); c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); });
    },
    update(dt, t) {
      wall.update(dt);
      buildK += (buildTarget - buildK) * (1 - Math.exp(-2.2 * dt));
      pulse = Math.max(0, pulse - dt * 0.6);
      cols.forEach((c, i) => {
        const k = clamp(buildK * 1.6 - i * 0.15, 0, 1), on = hlPillar === c.id;
        c.g.scale.set(1, Math.max(0.001, ease.out(k)), 1);
        c.colM.emissiveIntensity = on ? 0.7 + 0.25 * Math.sin(t * 5) : 0.15;
        c.g.position.z = on ? 0.25 : 0;
      });
      roof.position.y = 3.35 + (1 - ease.out(clamp(buildK * 1.4 - 0.4, 0, 1))) * 2.2;
      roof.scale.setScalar(1 + pulse * 0.08 * Math.sin(t * 9));
      ring.material.color.setScalar(1).multiply(new THREE.Color(0x7EDEBE)).multiplyScalar(1.1 + 0.5 * Math.sin(t * 2.2) + pulse * 2);
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
