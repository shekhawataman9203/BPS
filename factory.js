import { THREE, RoundedBoxGeometry } from './lib.js';
import { C, CSS, FONT, mat, glow, box, cyl, shadows, CanvasTex, fitText, V, fmt, clamp } from './util.js';

/*
  Plant layout (metres, top view; +x right, +z toward the front wall and main gate).
  Modelled on the JaP "Picture of Future": NHA on the left half, VE Pump on the right half,
  main gate in the front wall between them.
    SCRUM review room   x[-9,9]    z[-22,-10]   (built in rooms.js)
    Finish goods store  x[-29,-15] z[-21,-12]
    NHA component mfg   conveyor x[-24,3] at z=0, robots at z=-1.4
    NHA assembly        manual benches at z=11, x -26..-11
    VE Pump press cell  around (12,0)
    ABE store           supermarket x[20,29] z[-18,-2]
    VE Pump calibration x[20,30] z[6,20]
    Entrance            x[-6,6] z[18,32]: KPI wall on the left, BPS GO!+ stand on the right (rooms.js)
    Main gate           x[-4,4] in the front wall z=32; outside is the forecourt
    Supplier dock       left wall z=-14; customer dock right wall z=-14
*/

export const HALL = { x0: -32, x1: 32, z0: -24, z1: 32, h: 11 };
export const GATE = { w: 8, h: 6.2 };
let GATE_TEXT = { left: 'NHA', right: 'VE PUMP' };
const PPM = 32; // floor texture pixels per metre
// Assembly lines (both run along x at z = 11; operators stand on the +z side facing -z)
export const LINES = {
  nha: { x0: -28, x1: -6, z: 11, n: 8 },   // Nozzle holder assembly (NHA), left half
  ve: { x0: 3.5, x1: 17, z: 11, n: 6 },    // VE pump assembly, right half
};
export const stationX = (l, i) => l.x0 + (i + 0.5) * (l.x1 - l.x0) / l.n;

function roundedRectPath(x0, z0, x1, z1, r, seg = 6) {
  const pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push(V(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)); } };
  corner(x1 - r, z0 + r, -Math.PI / 2); corner(x1 - r, z1 - r, 0); corner(x0 + r, z1 - r, Math.PI / 2); corner(x0 + r, z0 + r, Math.PI);
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

function floorTexture() {
  const W = (HALL.x1 - HALL.x0) * PPM, H = (HALL.z1 - HALL.z0) * PPM;
  return new CanvasTex(W, H, (ctx) => {
    const X = x => (x - HALL.x0) * PPM, Z = z => (z - HALL.z0) * PPM;
    ctx.fillStyle = '#7f868e'; ctx.fillRect(0, 0, W, H);
    // concrete mottling
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 140;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const l = Math.random() < 0.5 ? 255 : 0;
      g.addColorStop(0, `rgba(${l},${l},${l},${0.012 + Math.random() * 0.014})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 26000; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    // expansion joints
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (let x = HALL.x0; x <= HALL.x1; x += 6) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
    for (let z = HALL.z0; z <= HALL.z1; z += 6) { ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(W, Z(z)); ctx.stroke(); }
    // mint walkways (as in the Picture of Future)
    const fill = (x0, z0, x1, z1, col = 'rgba(160,170,180,0.28)') => { ctx.fillStyle = col; ctx.fillRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM); };
    fill(-30, 4.6, 18, 7.6); fill(4.6, -9.6, 7.4, 4.6); fill(-30, 17, 18, 19.6); fill(-2.2, 7.6, 2.2, 32);
    fill(-6, 20, 6, 32, 'rgba(160,170,180,0.16)');
    // walkway lines
    const line = (x0, z0, x1, z1, col = 'rgba(244,196,30,0.95)', w = 0.1) => { ctx.strokeStyle = col; ctx.lineWidth = w * PPM; ctx.beginPath(); ctx.moveTo(X(x0), Z(z0)); ctx.lineTo(X(x1), Z(z1)); ctx.stroke(); };
    line(-30, 4.6, 18, 4.6); line(-30, 7.6, 18, 7.6);           // main aisle
    line(4.6, -9.6, 4.6, 4.6); line(7.4, -9.6, 7.4, 4.6);        // cross aisle to meeting room
    line(-30, -4.6, 18, -4.6); line(-30, -7.4, 18, -7.4);
    line(-30, 17, 18, 17); line(-30, 19.6, 18, 19.6);
    line(-2.2, 19.6, -2.2, 32); line(2.2, 19.6, 2.2, 32);        // gate aisle
    // hazard hatch around press cell and robots
    const hatch = (x0, z0, x1, z1) => {
      ctx.save(); ctx.beginPath(); ctx.rect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM); ctx.clip();
      ctx.strokeStyle = 'rgba(226,0,21,0.55)'; ctx.lineWidth = 0.12 * PPM;
      for (let d = -400; d < 1200; d += 0.5 * PPM) { ctx.beginPath(); ctx.moveTo(X(x0) + d, Z(z0)); ctx.lineTo(X(x0) + d - 300, Z(z0) + 300); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(226,0,21,0.8)'; ctx.lineWidth = 0.08 * PPM; ctx.strokeRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM);
    };
    hatch(8.6, -2.6, 15.6, -2.0); hatch(8.6, 2.0, 15.6, 2.6);
    // 5S outlines at Line B benches and Line A stations
    ctx.strokeStyle = 'rgba(225,229,234,0.45)'; ctx.lineWidth = 0.06 * PPM;
    for (const l of Object.values(LINES)) { ctx.strokeRect(X(l.x0 - 0.4), Z(l.z - 1.7), (l.x1 - l.x0 + 2.4) * PPM, 3.4 * PPM); for (let i = 1; i < l.n; i++) { const x = l.x0 + i * (l.x1 - l.x0) / l.n; ctx.beginPath(); ctx.moveTo(X(x), Z(l.z + 0.5)); ctx.lineTo(X(x), Z(l.z + 1.7)); ctx.stroke(); } }
    for (const x of [-22, -16, -10]) ctx.strokeRect(X(x - 1), Z(-2.4), 2 * PPM, 2 * PPM);
    // supermarket lanes
    for (const x of [21, 24.5, 28]) { ctx.strokeStyle = 'rgba(225,229,234,0.35)'; ctx.strokeRect(X(x - 0.8), Z(-17.5), 1.6 * PPM, 15 * PPM); }
    // finish goods store lanes
    for (const z of [-20, -17, -14]) { ctx.strokeStyle = 'rgba(225,229,234,0.4)'; ctx.strokeRect(X(-29), Z(z - 0.6), 14 * PPM, 1.2 * PPM); }
    // stencil text
    const stencil = (t, x, z) => { ctx.save(); ctx.fillStyle = 'rgba(245,247,250,0.5)'; ctx.font = `800 ${1.1 * PPM}px ${FONT}`; ctx.textAlign = 'center'; ctx.translate(X(x), Z(z)); ctx.fillText(t, 0, 0); ctx.restore(); };
    stencil('NHA', -12, 6.6); stencil('VE PUMP', 12, 6.6); stencil('MAIN GATE', 0, 29.5);
  });
}

function makeRobot(accent = true, body = 0xEEF0F2) {
  const g = new THREE.Group();
  const white = mat(body, { rough: 0.32, metal: 0.05 });
  const dark = mat(0x22262d, { rough: 0.5, metal: 0.4 });
  const red = mat(C.red, { rough: 0.4 });
  const base = cyl(0.34, 0.4, 0.28, dark, 24, g); base.position.y = 0.14;
  const turret = new THREE.Group(); turret.position.y = 0.28; g.add(turret);
  cyl(0.27, 0.3, 0.32, white, 24, turret).position.y = 0.16;
  if (accent) { const ring = cyl(0.285, 0.285, 0.05, red, 24, turret); ring.position.y = 0.3; }
  const shoulder = new THREE.Group(); shoulder.position.y = 0.42; turret.add(shoulder);
  const sj = cyl(0.17, 0.17, 0.42, dark, 20, shoulder); sj.rotation.z = Math.PI / 2;
  const lower = new THREE.Mesh(new RoundedBoxGeometry(0.24, 1.1, 0.26, 3, 0.07), white); lower.position.y = 0.55; shoulder.add(lower);
  const elbow = new THREE.Group(); elbow.position.y = 1.08; shoulder.add(elbow);
  const ej = cyl(0.13, 0.13, 0.34, dark, 18, elbow); ej.rotation.z = Math.PI / 2;
  const upper = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.9, 0.2, 3, 0.06), white); upper.position.y = 0.45; elbow.add(upper);
  const band = cyl(0.115, 0.115, 0.06, red, 16, elbow); band.position.y = 0.75;
  const wrist = new THREE.Group(); wrist.position.y = 0.9; elbow.add(wrist);
  cyl(0.08, 0.08, 0.14, dark, 14, wrist).position.y = 0.06;
  box(0.18, 0.05, 0.08, dark, 0, 0.15, 0, wrist);
  const f1 = box(0.03, 0.12, 0.06, dark, 0.07, 0.22, 0, wrist), f2 = box(0.03, 0.12, 0.06, dark, -0.07, 0.22, 0, wrist);
  shadows(g, true, false);
  return { g, turret, shoulder, elbow, wrist, f1, f2 };
}

function makeAGV() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.32, 0.86, 3, 0.08), mat(0x2a2f37, { rough: 0.45, metal: 0.3 }));
  body.position.y = 0.2; g.add(body);
  box(1.32, 0.03, 0.88, glow(C.red, 2.4), 0, 0.12, 0, g);
  const lidar = cyl(0.07, 0.07, 0.08, mat(0x0c0d10, { rough: 0.3 }), 16, g); lidar.position.set(0, 0.4, 0.33);
  const cart = box(1.2, 0.04, 0.8, mat(0x8d949e, { rough: 0.4, metal: 0.6 }), 0, 0.38, 0, g);
  for (const [x, c] of [[-0.3, C.red], [0.3, 0x5b6470]]) { const bin = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.32, 0.7, 2, 0.03), mat(c, { rough: 0.6 })); bin.position.set(x, 0.56, 0); g.add(bin); }
  shadows(g, true, false);
  return g;
}

export function buildFactory(scene, renderer, data = {}) {
  const meta = data.meta || {};
  GATE_TEXT = { left: (meta.gateLeft || 'NHA').toUpperCase(), right: (meta.gateRight || 'VE Pump').toUpperCase() };
  const root = new THREE.Group(); root.name = 'factory'; scene.add(root);
  const anim = [];
  const hotspots = {};

  // ---------- floor ----------
  const ft = floorTexture();
  ft.tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floorMat = new THREE.MeshStandardMaterial({ map: ft.tex, roughness: 0.3, metalness: 0.0, envMapIntensity: 1.15 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set((HALL.x0 + HALL.x1) / 2, 0, (HALL.z0 + HALL.z1) / 2);
  floor.receiveShadow = true; root.add(floor);

  // ---------- shell: walls, columns, roof ----------
  const wallM = mat(0xc9ced4, { rough: 0.8, metal: 0.1 });
  const wallM2 = mat(0xb4bac2, { rough: 0.7, metal: 0.25 });
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  // front wall with the main gate opening x[-GATE.w/2, GATE.w/2]
  const gw = GATE.w / 2, sideW = HALL.x1 - gw;
  box(sideW, HALL.h, 0.3, wallM, HALL.x0 + sideW / 2, HALL.h / 2, HALL.z1, root);
  box(sideW, HALL.h, 0.3, wallM, HALL.x1 - sideW / 2, HALL.h / 2, HALL.z1, root);
  box(GATE.w, HALL.h - GATE.h, 0.3, wallM, 0, GATE.h + (HALL.h - GATE.h) / 2, HALL.z1, root);
  box(W, HALL.h, 0.3, wallM, 0, HALL.h / 2, HALL.z0, root);
  box(0.3, HALL.h, D, wallM, HALL.x0, HALL.h / 2, (HALL.z0 + HALL.z1) / 2, root);
  box(0.3, HALL.h, D, wallM, HALL.x1, HALL.h / 2, (HALL.z0 + HALL.z1) / 2, root);
  // wall cladding ribs (instanced)
  const ribGeo = new THREE.BoxGeometry(0.08, HALL.h - 1, 0.12);
  const ribs = [];
  for (let z = HALL.z0 + 1; z < HALL.z1; z += 1.2) { ribs.push([HALL.x0 + 0.2, z, 0]); ribs.push([HALL.x1 - 0.2, z, 0]); }
  for (let x = HALL.x0 + 1; x < HALL.x1; x += 1.2) { if (Math.abs(x) > GATE.w / 2 + 0.3) ribs.push([x, HALL.z1 - 0.2, Math.PI / 2]); }
  const ribIM = new THREE.InstancedMesh(ribGeo, wallM2, ribs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  ribs.forEach(([x, z, r], i) => { q.setFromEuler(new THREE.Euler(0, r, 0)); m4.compose(V(x, (HALL.h - 1) / 2 + 0.5, z), q, s1); ribIM.setMatrixAt(i, m4); });
  root.add(ribIM);
  // clerestory light bands
  const bandM = glow(0xcfe0ff, 0.9);
  // tall daylight windows along both side walls (instanced panes with mullions)
  {
    const panes = [];
    for (let z = HALL.z0 + 3; z < HALL.z1 - 2; z += 3.2) for (const x of [HALL.x0 + 0.17, HALL.x1 - 0.17]) panes.push([x, z]);
    const paneIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 2.6, 2.7), glow(0xe6f0ff, 1.05), panes.length);
    const mullIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 2.7, 0.08), mat(0x8d949d, { rough: 0.4, metal: 0.6 }), panes.length * 2);
    panes.forEach(([x, z], i) => { m4.makeTranslation(x, 7.6, z); paneIM.setMatrixAt(i, m4); m4.makeTranslation(x, 7.6, z - 0.45); mullIM.setMatrixAt(i * 2, m4); m4.makeTranslation(x, 7.6, z + 0.45); mullIM.setMatrixAt(i * 2 + 1, m4); });
    root.add(paneIM, mullIM); void bandM;
  }
  // red base band on walls
  const redBand = glow(C.red, 1.6);
  box(sideW - 0.4, 0.12, 0.05, redBand, HALL.x0 + sideW / 2, 1.2, HALL.z1 - 0.2, root);
  box(sideW - 0.4, 0.12, 0.05, redBand, HALL.x1 - sideW / 2, 1.2, HALL.z1 - 0.2, root);
  box(0.05, 0.12, D, redBand, HALL.x0 + 0.2, 1.2, 4, root);
  box(0.05, 0.12, D, redBand, HALL.x1 - 0.2, 1.2, 4, root);
  // dock doors (daylight): supplier inbound on the left wall, customer outbound on the right wall
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? HALL.x0 + 0.2 : HALL.x1 - 0.2;
    box(0.05, 4.6, 4.2, glow(0xf2f6ff, 1.35), x, 2.3, -14, root);
    box(0.2, 0.3, 4.6, mat(0x2b313a, { rough: 0.5 }), x - sx * 0.05, 4.75, -14, root);
  }

  // columns (I-beams)
  const colGeo = new THREE.BoxGeometry(0.45, HALL.h, 0.45);
  const colM = mat(0xd3d8de, { rough: 0.45, metal: 0.35 });
  const colPos = [];
  for (const x of [-24, -12, 12, 24]) colPos.push([x, 17]);
  for (const z of [-18, -6, 6, 18, 28]) { colPos.push([HALL.x0 + 0.5, z]); colPos.push([HALL.x1 - 0.5, z]); }
  const colIM = new THREE.InstancedMesh(colGeo, colM, colPos.length);
  colPos.forEach(([x, z], i) => { m4.makeTranslation(x, HALL.h / 2, z); colIM.setMatrixAt(i, m4); });
  colIM.castShadow = true; colIM.receiveShadow = true; root.add(colIM);
  const colRing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), glow(C.red, 1.8), colPos.length);
  colPos.forEach(([x, z], i) => { m4.makeTranslation(x, 2.4, z); colRing.setMatrixAt(i, m4); });
  root.add(colRing);

  // roof beams + skylights
  const beamM = mat(0xaab1ba, { rough: 0.5, metal: 0.5 });
  const beams = [];
  for (let z = HALL.z0 + 2; z < HALL.z1; z += 6) beams.push([0, 10.2, z, W, 0.5, 0.3]);
  for (let x = HALL.x0 + 4; x < HALL.x1; x += 8) beams.push([x, 10.5, 4, 0.25, 0.25, D]);
  const beamIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), beamM, beams.length);
  beams.forEach(([x, y, z, sx, sy, sz], i) => { m4.compose(V(x, y, z), q.identity(), V(sx, sy, sz)); beamIM.setMatrixAt(i, m4); });
  root.add(beamIM);
  // roof: one-sided, seen from inside only, so the overview camera looks into the plant like a cut-away model
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xe2e6ea, { rough: 0.9 }));
  roof.rotation.x = Math.PI / 2; roof.position.set(0, HALL.h, 4); root.add(roof);
  // skylights: face down only, so they light the hall but do not hide it from the overview camera
  for (const x of [-16, 0, 16]) { const sk = new THREE.Mesh(new THREE.PlaneGeometry(2.4, D - 6), glow(0xe8eef8, 1.05)); sk.rotation.x = Math.PI / 2; sk.position.set(x, HALL.h - 0.12, 4); root.add(sk); }
  // hanging high-bay fixtures
  const fixtures = [];
  for (let x = -24; x <= 24; x += 8) for (let z = -6; z <= 24; z += 6) fixtures.push([x, z]);
  const fixIM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.07, 0.24), glow(0xffffff, 1.6), fixtures.length);
  const fixHousing = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.12, 0.32), mat(0x8d949d, { rough: 0.5, metal: 0.5 }), fixtures.length);
  fixtures.forEach(([x, z], i) => { m4.makeTranslation(x, 8.15, z); fixIM.setMatrixAt(i, m4); m4.makeTranslation(x, 8.24, z); fixHousing.setMatrixAt(i, m4); });
  root.add(fixIM, fixHousing);

  // ---------- NHA component line (machining + robots), left half ----------
  const lineA = new THREE.Group(); root.add(lineA);
  const beltCT = new CanvasTex(512, 64, (ctx, w, h) => { ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#23262c'; for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 14, h); });
  beltCT.tex.wrapS = THREE.RepeatWrapping; beltCT.tex.repeat.set(20, 1);
  const beltLen = 20, beltX = -17;
  const belt = box(beltLen, 0.06, 0.9, new THREE.MeshStandardMaterial({ map: beltCT.tex, roughness: 0.8 }), beltX, 0.86, 0, lineA);
  const railM = mat(0xaeb5bd, { rough: 0.3, metal: 0.85 });
  box(beltLen, 0.12, 0.06, railM, beltX, 0.88, 0.48, lineA); box(beltLen, 0.12, 0.06, railM, beltX, 0.88, -0.48, lineA);
  box(beltLen, 0.08, 0.95, mat(0x2a2f37, { rough: 0.5, metal: 0.5 }), beltX, 0.78, 0, lineA);
  const legIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), railM, 22);
  for (let i = 0; i < 11; i++) { const x = -26.5 + i * 2; m4.makeTranslation(x, 0.39, 0.42); legIM.setMatrixAt(i * 2, m4); m4.makeTranslation(x, 0.39, -0.42); legIM.setMatrixAt(i * 2 + 1, m4); }
  lineA.add(legIM);
  // products on belt
  const PCOUNT = 16;
  const prodGeo = new RoundedBoxGeometry(0.36, 0.22, 0.36, 2, 0.04);
  const prodIM = new THREE.InstancedMesh(prodGeo, mat(0xdfe3e8, { rough: 0.3, metal: 0.35 }), PCOUNT);
  prodIM.castShadow = true; lineA.add(prodIM);
  const prodCap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14), mat(C.red, { rough: 0.4 }), PCOUNT); lineA.add(prodCap);
  anim.push((dt, t) => {
    beltCT.tex.offset.x -= dt * 0.035;
    for (let i = 0; i < PCOUNT; i++) {
      const x = -27 + ((t * 0.45 + i * (beltLen / PCOUNT)) % beltLen);
      m4.makeTranslation(x, 1.0, 0); prodIM.setMatrixAt(i, m4);
      m4.makeTranslation(x, 1.135, 0); prodCap.setMatrixAt(i, m4);
    }
    prodIM.instanceMatrix.needsUpdate = true; prodCap.instanceMatrix.needsUpdate = true;
  });
  // robots on line A
  const robots = [];
  [-22, -16, -10].forEach((x, i) => {
    const r = makeRobot(false, 0xF07B12); r.g.position.set(x, 0, -1.45); r.g.rotation.y = 0; lineA.add(r.g); r.o = i * 1.9; robots.push(r);
    // andon tower
    const tower = new THREE.Group(); tower.position.set(x + 1.1, 0, -0.8); lineA.add(tower);
    cyl(0.03, 0.03, 1.8, railM, 8, tower).position.y = 0.9;
    const lamps = [glow(0xffffff, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(1.25), toneMapped: false })];
    const l1 = cyl(0.07, 0.07, 0.14, lamps[0], 14, tower); l1.position.y = 1.85;
    const l2 = cyl(0.07, 0.07, 0.14, lamps[1], 14, tower); l2.position.y = 2.0;
    anim.push((dt, t) => { l2.visible = i === 1 ? (Math.floor(t * 2) % 2 === 0) && (t % 20 < 6) : false; });
  });
  hotspots.vsm = V(-16, 1.9, 0.2);
  hotspots.pdm = V(-10, 2.6, -1.45);
  anim.push((dt, t) => {
    for (const r of robots) {
      const k = t * 0.9 + r.o;
      r.turret.rotation.y = Math.sin(k * 0.7) * 0.9;
      r.shoulder.rotation.x = 0.35 + Math.sin(k * 0.9) * 0.3;
      r.elbow.rotation.x = 1.25 + Math.sin(k * 0.9 + 1.2) * 0.35;
      r.wrist.rotation.x = 0.5 + Math.sin(k * 1.4) * 0.4;
      const gr = 0.05 + 0.03 * Math.sin(k * 2); r.f1.position.x = gr + 0.02; r.f2.position.x = -gr - 0.02;
    }
  });

  // ---------- Press cell (SMED) ----------
  const press = new THREE.Group(); press.position.set(12, 0, 0); root.add(press);
  const pw = mat(0xE9ECEF, { rough: 0.35, metal: 0.1 }), pd = mat(0x262b33, { rough: 0.5, metal: 0.5 });
  box(0.7, 3.6, 1.4, pw, -1.6, 1.8, 0, press); box(0.7, 3.6, 1.4, pw, 1.6, 1.8, 0, press);
  box(3.9, 0.9, 1.6, pw, 0, 3.9, 0, press); box(3.4, 0.9, 1.5, pd, 0, 0.45, 0, press);
  box(3.95, 0.14, 1.62, mat(C.red, { rough: 0.4 }), 0, 3.5, 0, press);
  const ram = box(2.4, 0.5, 1.1, mat(0x3a414c, { rough: 0.35, metal: 0.7 }), 0, 2.6, 0, press);
  const die = box(1.6, 0.3, 0.9, mat(C.red, { rough: 0.45, metal: 0.3 }), 0, 1.05, 0, press);
  for (const sx of [-2.1, 2.1]) box(0.06, 1.8, 0.06, glow(C.red, 2), sx, 1.4, 0.75, press);
  // changeover cart with spare die (SMED prepared outside stop time)
  const cart = new THREE.Group(); cart.position.set(-3.4, 0, 1.7); press.add(cart);
  box(1.4, 0.06, 0.9, mat(0x8d949e, { rough: 0.4, metal: 0.6 }), 0, 0.8, 0, cart);
  for (const [x, z] of [[-0.6, -0.38], [0.6, -0.38], [-0.6, 0.38], [0.6, 0.38]]) box(0.05, 0.8, 0.05, railM, x, 0.4, z, cart);
  box(1.2, 0.26, 0.7, mat(C.red, { rough: 0.45, metal: 0.3 }), 0, 0.96, 0, cart);
  // energy meter cabinet
  const cab = new THREE.Group(); cab.position.set(15.9, 0, -2.3); root.add(cab);
  box(1.1, 2.1, 0.5, mat(0x2b313a, { rough: 0.5, metal: 0.3 }), 0, 1.05, 0, cab);
  const meterCT = new CanvasTex(256, 160, (ctx, w, h, v = 0) => {
    ctx.fillStyle = '#0d1014'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 22px ${FONT}`; ctx.fillText('kWh / unit', 16, 34);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 64px ${FONT}`; ctx.fillText((1.95 + v).toFixed(2), 16, 104);
    ctx.fillStyle = CSS.red; ctx.fillRect(16, 124, 180 + v * 400, 10);
  });
  const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.375), new THREE.MeshBasicMaterial({ map: meterCT.tex, toneMapped: false }));
  meter.position.set(0, 1.45, 0.26); cab.add(meter);
  let meterT = 0; anim.push((dt) => { meterT += dt; if (meterT > 1.2) { meterT = 0; meterCT.redraw((Math.random() - 0.5) * 0.04); } });
  hotspots.smed = V(12, 4.6, 0);
  hotspots.energy = V(15.9, 2.4, -2.3);
  anim.push((dt, t) => { const k = (t * 0.8) % 1; ram.position.y = 2.6 - Math.max(0, Math.sin(k * Math.PI * 2)) * 1.1 * (k < 0.5 ? 1 : 0); });
  shadows(press, true, true); shadows(cab, true, true);

  // ---------- Andon board ----------
  const andonCT = new CanvasTex(1024, 300, (ctx, w, h, out = 1248) => {
    ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, 12, h);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 34px ${FONT}`; ctx.fillText('Line A', 44, 62);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 104px ${FONT}`; ctx.fillText(fmt(out), 44, 180);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 32px ${FONT}`; ctx.fillText('of 1,300 parts this shift', 44, 236);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 30px ${FONT}`; ctx.fillText('OEE', 980, 62); ctx.fillText('Takt', 980, 172);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 64px ${FONT}`; ctx.fillText('84.2%', 980, 128); ctx.fillText('42 s', 980, 238);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(44, 262, 936, 8);
    ctx.fillStyle = CSS.red; ctx.fillRect(44, 262, 936 * out / 1300, 8);
  });
  const andon = new THREE.Group(); andon.position.set(-10, 6.2, 3.2); root.add(andon);
  box(5.3, 1.65, 0.16, mat(0x101317, { rough: 0.4, metal: 0.4 }), 0, 0, -0.09, andon);
  const andonScreen = new THREE.Mesh(new THREE.PlaneGeometry(5.12, 1.5), new THREE.MeshBasicMaterial({ map: andonCT.tex, toneMapped: false }));
  andon.add(andonScreen);
  for (const sx of [-2, 2]) box(0.03, 3.6, 0.03, railM, sx, 2.6, -0.1, andon);
  let outCount = 1248, andonT = 0;
  anim.push((dt) => { andonT += dt; if (andonT > 3.2) { andonT = 0; outCount = outCount >= 1300 ? 1180 : outCount + 1; andonCT.redraw(outCount); } });
  hotspots.andon = V(-10, 7.3, 3.2);
  hotspots.dsfm = V(-10, 7.3, 3.2);

  // ---------- SFM board ----------
  const sfmCT = new CanvasTex(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#12161C'; ctx.font = `800 44px ${FONT}`; ctx.fillText('Shop floor board, tier 2', 40, 70);
    ctx.fillStyle = CSS.red; ctx.fillRect(40, 92, 120, 8);
    const cols = ['Safety', 'Quality', 'Delivery', 'Cost', 'People'];
    cols.forEach((c, i) => {
      const x = 40 + i * 192;
      ctx.fillStyle = '#12161C'; ctx.font = `700 26px ${FONT}`; ctx.fillText(c, x, 150);
      ctx.strokeStyle = '#c9ced5'; ctx.lineWidth = 2; ctx.strokeRect(x, 170, 172, 220);
      ctx.beginPath(); ctx.strokeStyle = i === 3 ? CSS.red : '#12161C'; ctx.lineWidth = 4;
      for (let k = 0; k < 10; k++) { const yy = 360 - (k * 12 + Math.sin(k * 1.7 + i) * 18) * (i === 3 ? 0.5 : 1); k ? ctx.lineTo(x + 12 + k * 16, yy) : ctx.moveTo(x + 12, yy); }
      ctx.stroke();
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k === 2 && i === 1 ? CSS.red : '#12161C'; ctx.fillRect(x, 420 + k * 56, 172, 40); ctx.fillStyle = '#F4F6F8'; ctx.font = `600 18px ${FONT}`; ctx.fillText(['Action open', 'In progress', 'Escalated'][k], x + 12, 446 + k * 56); }
    });
  });
  const sfm = new THREE.Group(); sfm.position.set(-13, 0, -8.6); root.add(sfm);
  box(3.4, 2.2, 0.08, mat(0x2b313a, { rough: 0.5 }), 0, 1.7, -0.05, sfm);
  const sfmFace = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshStandardMaterial({ map: sfmCT.tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: sfmCT.tex, emissiveIntensity: 0.25 }));
  sfmFace.position.set(0, 1.7, 0); sfm.add(sfmFace);
  for (const sx of [-1.6, 1.6]) box(0.06, 0.65, 0.06, railM, sx, 0.33, 0, sfm);
  shadows(sfm, true, true);
  hotspots.sfm = V(-13, 3.1, -8.6);

  // ---------- Supermarket (Kanban flow racks) ----------
  const sm = new THREE.Group(); root.add(sm);
  const rackM = mat(0x3a414b, { rough: 0.5, metal: 0.6 });
  const posts = [], shelves = [], binsR = [], binsG = [];
  for (const x of [21, 24.5, 28]) {
    for (let z = -17.5; z <= -2.5; z += 2.5) { posts.push([x - 0.75, z]); posts.push([x + 0.75, z]); }
    for (let lv = 0; lv < 3; lv++) {
      shelves.push([x, 0.5 + lv * 0.75, -10]);
      for (let z = -17; z <= -3; z += 0.62) {
        for (const bx of [-0.42, 0, 0.42]) {
          const red = ((Math.round(z * 3) + lv + Math.round(bx * 5)) % 3) === 0;
          (red ? binsR : binsG).push([x + bx, 0.68 + lv * 0.75, z]);
        }
      }
    }
  }
  const postIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 2.5, 0.07), rackM, posts.length);
  posts.forEach(([x, z], i) => { m4.makeTranslation(x, 1.25, z); postIM.setMatrixAt(i, m4); }); sm.add(postIM);
  const shelfIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.04, 15), rackM, shelves.length);
  shelves.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); shelfIM.setMatrixAt(i, m4); }); sm.add(shelfIM);
  const binGeo = new RoundedBoxGeometry(0.38, 0.3, 0.56, 2, 0.03);
  for (const [arr, col] of [[binsR, C.red], [binsG, 0x59616c]]) {
    const im = new THREE.InstancedMesh(binGeo, mat(col, { rough: 0.6 }), arr.length);
    arr.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4); });
    im.castShadow = true; sm.add(im);
  }
  hotspots.kanban = V(24.5, 3.1, -9);

  // ---------- Assembly lines: NHA (left) and VE pump (right) ----------
  const frameDark = mat(0x2a2f37, { rough: 0.5, metal: 0.5 }), alu = mat(0xc4cad1, { rough: 0.3, metal: 0.8 });
  const swText = {
    nha: ['Standard work · NHA', '1  Load holder body', '2  Press-fit nozzle', '3  Torque 35 Nm', '4  Leak test, scan'],
    ve: ['Standard work · VE pump', '1  Fit drive shaft', '2  Mount cam plate', '3  Torque housing', '4  Seal, label, scan'],
  };
  const swTex = {};
  for (const [k, lines] of Object.entries(swText)) swTex[k] = new CanvasTex(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#0d1014'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = k === 'nha' ? '#0E9384' : '#8E2C8C'; ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 40px ${FONT}`; ctx.fillText(lines[0], 22, 72);
    ctx.fillStyle = '#C3C9D1'; ctx.font = `600 32px ${FONT}`; lines.slice(1).forEach((s, i) => ctx.fillText(s, 22, 128 + i * 46));
    ctx.fillStyle = '#3FBF8F'; ctx.fillRect(w - 120, 30, 90, 26);
  }).tex;
  const binSmallGeo = new RoundedBoxGeometry(0.3, 0.18, 0.4, 2, 0.02);
  const rackBins = { red: [], grey: [], blue: [] };
  const lineProducts = [];
  const buildLine = (key, l, accent) => {
    const g = new THREE.Group(); g.name = key + '-line'; root.add(g);
    const len = l.x1 - l.x0, cx = (l.x0 + l.x1) / 2, z = l.z;
    const bt = beltCT.tex.clone(); bt.wrapS = THREE.RepeatWrapping; bt.repeat.set(len, 1); bt.needsUpdate = true;
    box(len, 0.05, 0.62, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.8 }), cx, 0.9, z, g);
    box(len, 0.1, 0.05, alu, cx, 0.93, z + 0.33, g); box(len, 0.1, 0.05, alu, cx, 0.93, z - 0.33, g);
    box(len, 0.1, 0.7, frameDark, cx, 0.82, z, g);
    box(len, 0.035, 0.02, glow(accent, 1.7), cx, 0.8, z + 0.36, g);
    const legs = []; for (let x = l.x0 + 0.3; x <= l.x1 - 0.2; x += 1.5) legs.push(x);
    const legIM2 = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), alu, legs.length * 2);
    legs.forEach((x, i) => { m4.makeTranslation(x, 0.4, z + 0.3); legIM2.setMatrixAt(i * 2, m4); m4.makeTranslation(x, 0.4, z - 0.3); legIM2.setMatrixAt(i * 2 + 1, m4); });
    g.add(legIM2);
    const step = len / l.n;
    for (let i = 0; i < l.n; i++) {
      const sx = stationX(l, i);
      // station frame with light bar
      for (const dx of [-step / 2 + 0.12, step / 2 - 0.12]) box(0.06, 2.3, 0.06, alu, sx + dx, 1.15, z - 0.75, g);
      box(step - 0.1, 0.06, 0.06, alu, sx, 2.3, z - 0.75, g);
      box(step - 0.4, 0.04, 0.16, glow(0xffffff, 1.3), sx, 2.24, z - 0.45, g);
      // press-fit / screwing unit over the belt
      box(0.12, 1.25, 0.12, frameDark, sx - 0.35, 1.55, z - 0.42, g);
      box(0.55, 0.18, 0.22, mat(0xE9ECEF, { rough: 0.35 }), sx - 0.18, 2.06, z - 0.32, g);
      box(0.08, 0.5, 0.08, mat(0x3a414c, { rough: 0.35, metal: 0.7 }), sx - 0.05, 1.72, z - 0.22, g);
      // flow rack with bins behind the line
      box(step - 0.3, 0.04, 0.55, alu, sx, 1.05, z - 1.05, g); box(step - 0.3, 0.04, 0.55, alu, sx, 1.45, z - 1.08, g);
      for (let k = 0; k < Math.floor((step - 0.4) / 0.34); k++) {
        const bx = sx - (step - 0.4) / 2 + 0.17 + k * 0.34;
        rackBins[(k + i) % 3 === 0 ? 'red' : key === 'nha' ? 'grey' : 'blue'].push([bx, 1.16, z - 1.05], [bx, 1.56, z - 1.08]);
      }
      // standard work screen on an arm
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.29), new THREE.MeshBasicMaterial({ map: swTex[key], toneMapped: false }));
      scr.position.set(sx + step / 2 - 0.45, 1.5, z - 0.5); scr.rotation.x = -0.2; g.add(scr);
      box(0.5, 0.33, 0.03, frameDark, sx + step / 2 - 0.45, 1.5, z - 0.53, g).rotation.x = -0.2;
      // andon lamp
      const lampOn = i === (key === 'nha' ? 5 : 2);
      cyl(0.045, 0.045, 0.16, lampOn ? glow(0xF2B233, 1.8) : glow(0x3FBF8F, 1.5), 12, g).position.set(sx + step / 2 - 0.12, 2.44, z - 0.75);
      // anti-fatigue mat where the operator stands
      box(step - 0.3, 0.015, 0.8, mat(0x22262c, { rough: 0.95 }), sx, 0.008, z + 0.95, g);
    }
    // end of line test cell
    const tc = new THREE.Group(); tc.position.set(l.x1 + 0.75, 0, z); g.add(tc);
    tc.add(new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.9, 1.3, 3, 0.05), mat(0xE9ECEF, { rough: 0.35 }))).position.y = 0.95;
    box(0.7, 0.6, 0.02, new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.7 }), 0, 1.15, 0.66, tc);
    box(1.22, 0.08, 0.02, glow(accent, 1.7), 0, 1.7, 0.66, tc);
    box(0.32, 0.22, 0.02, glow(0x3FBF8F, 1.2), 0.35, 1.62, 0.67, tc);
    shadows(g, true, true);
    lineProducts.push({ key, l });
  };
  buildLine('nha', LINES.nha, 0x0E9384);
  buildLine('ve', LINES.ve, 0x8E2C8C);
  for (const [k, col] of [['red', C.red], ['grey', 0x59616c], ['blue', 0x1E88D9]]) {
    if (!rackBins[k].length) continue;
    const im = new THREE.InstancedMesh(binSmallGeo, mat(col, { rough: 0.6 }), rackBins[k].length);
    rackBins[k].forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4); }); root.add(im);
  }
  // products moving along the lines: nozzle holders (slim) and VE pumps (chunky), each on a work carrier
  const carrierGeo = new THREE.BoxGeometry(0.34, 0.04, 0.34);
  const nhaGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.34, 16); nhaGeo.rotateZ(Math.PI / 2);
  const vePumpGeo = new RoundedBoxGeometry(0.28, 0.24, 0.26, 2, 0.04);
  const veShaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12); veShaftGeo.rotateZ(Math.PI / 2);
  const flows = lineProducts.map(({ key, l }) => {
    const n = Math.round((l.x1 - l.x0) / 0.9);
    const carrier = new THREE.InstancedMesh(carrierGeo, mat(0x3a414b, { rough: 0.5, metal: 0.5 }), n);
    const body = new THREE.InstancedMesh(key === 'nha' ? nhaGeo : vePumpGeo, mat(key === 'nha' ? 0xcfd5dc : 0x9aa2ac, { rough: 0.28, metal: 0.75 }), n);
    const extra = new THREE.InstancedMesh(key === 'nha' ? new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10) : veShaftGeo, mat(key === 'nha' ? 0x2b313a : 0xd8dde3, { rough: 0.3, metal: 0.8 }), n);
    body.castShadow = true; root.add(carrier, body, extra);
    return { key, l, n, carrier, body, extra };
  });
  anim.push((dt, t) => {
    for (const f of flows) {
      const len = f.l.x1 - f.l.x0;
      for (let i = 0; i < f.n; i++) {
        // indexed flow: each carrier moves one station, then dwells while the operator works
        const u = (t * 0.018 * f.l.n / 6 + i / f.n) % 1, raw = u * f.l.n, k = Math.floor(raw), fr = raw - k;
        const px = f.l.x0 + 0.2 + ((k + Math.min(1, fr * 2.5)) / f.l.n) * (len - 0.4);
        const y = 0.945;
        m4.makeTranslation(px, y, f.l.z); f.carrier.setMatrixAt(i, m4);
        m4.makeTranslation(px, y + (f.key === 'nha' ? 0.1 : 0.14), f.l.z); f.body.setMatrixAt(i, m4);
        m4.makeTranslation(f.key === 'nha' ? px - 0.12 : px + 0.2, y + (f.key === 'nha' ? 0.19 : 0.14), f.l.z); f.extra.setMatrixAt(i, m4);
      }
      f.carrier.instanceMatrix.needsUpdate = f.body.instanceMatrix.needsUpdate = f.extra.instanceMatrix.needsUpdate = true;
    }
  });

  // ---------- CNC machining centres ----------
  const hmiCT = new CanvasTex(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#0d1014'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1E88D9'; ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 26px ${FONT}`; ctx.fillText('RUN  ·  OP 20', 14, 48);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 18px ${FONT}`; ['Spindle 8,000 rpm', 'Cycle 42 s', 'Parts 318 / 340'].forEach((s, i) => ctx.fillText(s, 14, 86 + i * 30));
    ctx.fillStyle = '#3FBF8F'; ctx.fillRect(14, 170, 200, 8);
  });
  const cncBody = mat(0xE6E9ED, { rough: 0.38, metal: 0.1 }), cncDark = mat(0x2b313a, { rough: 0.4, metal: 0.5 });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x24303c, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.78 });
  const cncGeo = new RoundedBoxGeometry(2.1, 2.0, 1.6, 3, 0.06);
  const machines = [];
  const cnc = (x, z, ry, accent) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const body = new THREE.Mesh(cncGeo, cncBody); body.position.y = 1.0; g.add(body);
    box(2.12, 0.1, 1.62, cncDark, 0, 2.03, 0, g);
    box(2.12, 0.16, 1.62, cncDark, 0, 0.08, 0, g);
    box(1.0, 0.9, 0.03, glassDark, -0.25, 1.25, 0.8, g);
    box(1.08, 0.04, 0.04, cncDark, -0.25, 1.72, 0.82, g); box(1.08, 0.04, 0.04, cncDark, -0.25, 0.78, 0.82, g);
    box(0.06, 0.3, 0.06, cncDark, 0.32, 1.25, 0.84, g);
    box(2.12, 0.07, 0.02, glow(accent, 1.6), 0, 1.88, 0.81, g);
    const hmiBox = box(0.42, 0.55, 0.1, cncDark, 0.72, 1.32, 0.86, g);
    const hmi = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), new THREE.MeshBasicMaterial({ map: hmiCT.tex, toneMapped: false })); hmi.position.set(0.72, 1.42, 0.915); g.add(hmi); void hmiBox;
    box(0.55, 0.55, 1.0, cncDark, 1.36, 0.3, 0.1, g); // chip conveyor
    cyl(0.025, 0.025, 0.5, alu, 8, g).position.set(0.95, 2.3, -0.6);
    cyl(0.05, 0.05, 0.1, glow(0x3FBF8F, 1.6), 12, g).position.set(0.95, 2.58, -0.6);
    // light inside the work area
    box(0.9, 0.02, 0.5, glow(0xdfefff, 1.4), -0.25, 1.68, 0.4, g);
    shadows(g, true, true); machines.push(g); return g;
  };
  // NHA machining (front-left row, back-left area) and VE machining (front-right row)
  for (const x of [-27.6, -24.8, -22.0, -19.2, -16.4]) cnc(x, -8.9, 0, 0x0E9384);
  for (const x of [11.2, 14.0, 16.8]) cnc(x, -8.9, 0, 0x8E2C8C);
  for (const z of [22.4, 27.4]) for (const x of [-28.4, -25.6, -22.8, -20.0, -17.2]) cnc(x, z, Math.PI, 0x0E9384);
  // VE pump end of line test and packing (back-right)
  for (const x of [12.5, 15.3, 18.1, 20.9]) cnc(x, 22.4, Math.PI, 0x8E2C8C);
  { // packing: pallets with cartons
    const pal = [], car = [];
    for (const x of [12.5, 14.4, 16.3, 18.2, 20.1, 22.0]) for (const z of [27.0, 29.2]) { pal.push([x, 0.07, z]); car.push([x, 0.42, z]); if ((x + z) % 2 < 1) car.push([x, 0.98, z]); }
    const pIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), mat(0xb08a5a, { rough: 0.8 }), pal.length);
    pal.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); pIM.setMatrixAt(i, m4); });
    const cIM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.1, 0.54, 0.9, 2, 0.03), mat(0xc9a77c, { rough: 0.85 }), car.length);
    car.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); cIM.setMatrixAt(i, m4); });
    cIM.castShadow = true; root.add(pIM, cIM);
  }

  // ---------- Digital cell ----------
  const dc = new THREE.Group(); root.add(dc);
  const fenceM = new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
  const fx0 = 20.5, fx1 = 29.5, fz0 = 6.5, fz1 = 19.5;
  const fencePosts = [];
  for (let x = fx0; x <= fx1 + 0.01; x += 1.5) { fencePosts.push([x, fz0]); fencePosts.push([x, fz1]); }
  for (let z = fz0 + 1.5; z < fz1; z += 1.5) { fencePosts.push([fx0, z]); fencePosts.push([fx1, z]); }
  const fpIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), mat(0x9aa3ae, { rough: 0.4, metal: 0.7 }), fencePosts.length);
  fencePosts.forEach(([x, z], i) => { m4.makeTranslation(x, 1.05, z); fpIM.setMatrixAt(i, m4); }); dc.add(fpIM);
  box(fx1 - fx0, 1.9, 0.02, fenceM, (fx0 + fx1) / 2, 1.05, fz0, dc); box(fx1 - fx0, 1.9, 0.02, fenceM, (fx0 + fx1) / 2, 1.05, fz1, dc);
  box(0.02, 1.9, fz1 - fz0 - 3, fenceM, fx0, 1.05, (fz0 + fz1) / 2 + 1.5, dc); box(0.02, 1.9, fz1 - fz0, fenceM, fx1, 1.05, (fz0 + fz1) / 2, dc);
  box(fx1 - fx0, 0.05, 0.05, glow(C.red, 1.6), (fx0 + fx1) / 2, 2.1, fz0, dc);
  // short conveyor + AOI gantry + 2 robots
  box(7, 0.06, 0.8, new THREE.MeshStandardMaterial({ map: beltCT.tex, roughness: 0.8 }), 25, 0.86, 9, dc);
  box(7, 0.1, 0.85, mat(0x2a2f37, { rough: 0.5, metal: 0.5 }), 25, 0.78, 9, dc);
  const gantry = new THREE.Group(); gantry.position.set(23, 0, 9); dc.add(gantry);
  box(0.12, 2.4, 0.12, railM, -0.8, 1.2, 0, gantry); box(0.12, 2.4, 0.12, railM, 0.8, 1.2, 0, gantry);
  box(1.8, 0.2, 0.3, mat(0x2a2f37, { rough: 0.4, metal: 0.5 }), 0, 2.4, 0, gantry);
  box(0.3, 0.3, 0.3, mat(0x101215, { rough: 0.3 }), 0, 2.15, 0, gantry);
  const aoiRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 32), glow(0xffffff, 2)); aoiRing.rotation.x = Math.PI / 2; aoiRing.position.set(0, 1.98, 0); gantry.add(aoiRing);
  const scanBeam = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(1.2), transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  scanBeam.position.set(0, 1.45, 0); gantry.add(scanBeam);
  const dcRobots = [];
  for (const [x, z, o] of [[26.5, 10.6, 0.7], [28, 7.6, 2.4]]) { const r = makeRobot(); r.g.position.set(x, 0, z); r.g.rotation.y = z > 9 ? Math.PI : 0; r.o = o; dc.add(r.g); dcRobots.push(r); }
  anim.push((dt, t) => { for (const r of dcRobots) { const k = t * 1.1 + r.o; r.turret.rotation.y = Math.sin(k * 0.8) * 1.2; r.shoulder.rotation.x = 0.4 + Math.sin(k) * 0.3; r.elbow.rotation.x = 1.2 + Math.sin(k + 1) * 0.4; r.wrist.rotation.x = 0.4 + Math.sin(k * 1.5) * 0.5; } scanBeam.material.opacity = 0.08 + 0.06 * Math.sin(t * 6); });
  hotspots.aoi = V(23, 3.0, 9);
  shadows(dc, true, true);

  // ---------- AGVs ----------
  const agvPath = roundedRectPath(-30, -6, 19.4, 15.9, 2.4);
  const agvLen = agvPath.getLength();
  const agvs = [0, 0.34, 0.68].map(u0 => { const g = makeAGV(); root.add(g); return { g, u: u0 }; });
  const tmpT = new THREE.Vector3();
  anim.push((dt) => {
    for (const a of agvs) {
      a.u = (a.u + dt * 1.15 / agvLen) % 1;
      agvPath.getPointAt(a.u, a.g.position);
      agvPath.getTangentAt(a.u, tmpT);
      a.g.rotation.y = Math.atan2(tmpT.x, tmpT.z) + Math.PI / 2;
    }
  });
  hotspots.agv = agvs[0].g.position; // live reference (pin follows the vehicle)

  // ---------- Digital layer (visible in chapter 4) ----------
  const digital = new THREE.Group(); digital.visible = false; root.add(digital);
  const digitalMats = [];
  const dmat = (c, op) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }); m.userData.max = op; digitalMats.push(m); return m; };
  // floor dashes along AGV path
  const dashN = Math.floor(agvLen / 0.7);
  const dashIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.01, 0.08), dmat(C.red, 0.9), dashN);
  for (let i = 0; i < dashN; i++) {
    const u = i / dashN; const p = agvPath.getPointAt(u); agvPath.getTangentAt(u, tmpT);
    q.setFromEuler(new THREE.Euler(0, Math.atan2(tmpT.x, tmpT.z) + Math.PI / 2, 0)); m4.compose(V(p.x, 0.02, p.z), q, s1); dashIM.setMatrixAt(i, m4);
  }
  digital.add(dashIM);
  // data streams machine -> cloud node
  const node = V(4, 9.2, 6);
  const sources = [V(-22, 2.2, -1.45), V(-16, 2.2, -1.45), V(-10, 2.2, -1.45), V(12, 4.2, 0), V(15.9, 2.2, -2.3), V(23, 2.6, 9), V(26.5, 2.2, 10.6), V(-13, 2.8, -8.6), V(-10, 6.2, 3.2), V(24.5, 2.6, -9), V(-21.1, 2.2, 11), V(-10.1, 2.2, 11), V(9.7, 2.2, 11), V(14.6, 2.2, 11), V(-22.9, 2.6, 22), V(15.3, 2.6, 22)];
  const curves = sources.map(s => new THREE.QuadraticBezierCurve3(s, V((s.x + node.x) / 2, Math.max(s.y, node.y) + 2.5, (s.z + node.z) / 2), node));
  const PER = 14, NP = curves.length * PER;
  const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3); const pCol = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { const c = (i % 3 === 0) ? [1, 1, 1] : [1.0, 0.05, 0.12]; pCol.set(c, i * 3); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const dotTex = new CanvasTex(64, 64, (ctx) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
  const pMat = new THREE.PointsMaterial({ size: 0.28, map: dotTex.tex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  pMat.userData.max = 1; digitalMats.push(pMat);
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; digital.add(points);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); lineMat.userData.max = 0.25; digitalMats.push(lineMat);
  for (const c of curves) digital.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(40)), lineMat));
  const nodeMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), dmat(0xffffff, 0.9)); nodeMesh.material.wireframe = true; nodeMesh.position.copy(node); digital.add(nodeMesh);
  const nodeCore = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), dmat(C.red, 1)); nodeCore.position.copy(node); digital.add(nodeCore);
  // hologram twin of Line B above the digital cell
  const holo = new THREE.Group(); holo.position.set(25, 2.5, 15.5); holo.scale.setScalar(1.35); digital.add(holo);
  const holoEdges = dmat(0xffffff, 0.85), holoFill = dmat(C.red, 0.2), holoRed = dmat(C.red, 0.95);
  const holoBox = (w, h, d, x, y, z, m = holoEdges) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    e.material.userData.max = 0.9; digitalMats.push(e.material); e.position.set(x, y, z); holo.add(e);
    const f = new THREE.Mesh(g, holoFill); f.position.set(x, y, z); holo.add(f);
  };
  holoBox(5.2, 0.05, 2.2, 0, 0, 0);
  for (let i = 0; i < 5; i++) { holoBox(0.7, 0.32, 0.4, -2 + i, 0.2, -0.3); holoBox(0.12, 0.42, 0.12, -2 + i, 0.24, 0.35); }
  holoBox(5, 0.1, 0.3, 0, 0.2, 0.75);
  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), holoRed); scanPlane.rotation.x = -Math.PI / 2; holo.add(scanPlane);
  scanPlane.material = dmat(C.red, 0.18);
  const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.12, 40), mat(0x1a1f26, { rough: 0.3, metal: 0.6 })); holoBase.position.set(25, 0.06, 15.5); dc.add(holoBase);
  const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.02, 8, 64), glow(C.red, 2.2)); holoRing.rotation.x = Math.PI / 2; holoRing.position.set(25, 0.13, 15.5); dc.add(holoRing);
  const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.9, 2.3, 40, 1, true), dmat(C.red, 0.06)); beamCone.material.side = THREE.DoubleSide; beamCone.position.set(0, -1.15, 0); holo.add(beamCone);
  hotspots.twin = V(25, 4.0, 15.5);
  // pulsing rings at project locations
  const ringGeo = new THREE.RingGeometry(0.9, 1.0, 48);
  const rings = [V(-10, 0.03, -1.45), V(23, 0.03, 9), V(-10, 0.03, 3.2), V(15.9, 0.03, -2.3), V(25, 0.03, 15.5)].map(p => { const r = new THREE.Mesh(ringGeo, dmat(C.red, 0.9)); r.rotation.x = -Math.PI / 2; r.position.copy(p); digital.add(r); return r; });

  let digitalLevel = 0, digitalTarget = 0;
  anim.push((dt, t) => {
    digitalLevel += (digitalTarget - digitalLevel) * (1 - Math.exp(-3 * dt));
    digital.visible = digitalLevel > 0.01;
    if (!digital.visible) return;
    for (const m of digitalMats) m.opacity = m.userData.max * digitalLevel;
    for (let c = 0; c < curves.length; c++) for (let k = 0; k < PER; k++) {
      const i = c * PER + k; const u = ((t * 0.22 + k / PER + c * 0.13) % 1);
      curves[c].getPoint(u, tmpT); pPos[i * 3] = tmpT.x; pPos[i * 3 + 1] = tmpT.y; pPos[i * 3 + 2] = tmpT.z;
    }
    pGeo.attributes.position.needsUpdate = true;
    nodeMesh.rotation.y += dt * 0.4; nodeMesh.rotation.x += dt * 0.15;
    nodeCore.scale.setScalar(1 + 0.15 * Math.sin(t * 4));
    holo.rotation.y = Math.sin(t * 0.25) * 0.5;
    scanPlane.position.y = 0.05 + (Math.sin(t * 1.4) * 0.5 + 0.5) * 0.7;
    rings.forEach((r, i) => { const k = (t * 0.6 + i * 0.2) % 1; r.scale.setScalar(0.4 + k * 1.4); r.material.opacity = (1 - k) * 0.9 * digitalLevel; });
    // dashes march along the path
    dashIM.material.opacity = (0.55 + 0.25 * Math.sin(t * 3)) * digitalLevel;
  });

  // ---------- atmosphere: dust in light ----------
  const DUST = 600;
  const dGeo = new THREE.BufferGeometry(); const dPos = new Float32Array(DUST * 3); const dSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { dPos[i * 3] = -28 + Math.random() * 56; dPos[i * 3 + 1] = Math.random() * 9; dPos[i * 3 + 2] = -8 + Math.random() * 38; dSeed[i] = Math.random() * 10; }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.05, map: dotTex.tex, color: 0xc8d2e0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(dust);
  anim.push((dt, t) => { for (let i = 0; i < DUST; i++) { dPos[i * 3 + 1] += dt * 0.05 * Math.sin(t * 0.3 + dSeed[i]); dPos[i * 3] += dt * 0.04 * Math.cos(t * 0.2 + dSeed[i]); } dGeo.attributes.position.needsUpdate = true; });

  // ---------- overhead gantry cranes (yellow) ----------
  const craneM = mat(0xF2B417, { rough: 0.45, metal: 0.3 }), craneDark = mat(0x2b313a, { rough: 0.45, metal: 0.5 });
  box(0.4, 0.4, D - 2, craneDark, HALL.x0 + 1.0, 8.9, 4, root); box(0.4, 0.4, D - 2, craneDark, HALL.x1 - 1.0, 8.9, 4, root); // runway rails
  const cranes = [];
  for (const [z0, sp] of [[-4, 0.05], [14, 0.04]]) {
    const c = new THREE.Group(); c.position.set(0, 9.25, z0); root.add(c);
    box(W - 2.4, 0.7, 0.45, craneM, 0, 0, -0.5, c); box(W - 2.4, 0.7, 0.45, craneM, 0, 0, 0.5, c);
    for (const sx of [-1, 1]) box(0.8, 0.5, 1.8, craneM, sx * (W / 2 - 1.2), 0.0, 0, c);
    const trolley = new THREE.Group(); trolley.position.y = -0.2; c.add(trolley);
    box(1.4, 0.5, 1.5, craneDark, 0, 0.1, 0, trolley);
    cyl(0.015, 0.015, 3.2, mat(0x111111, { rough: 0.5 }), 6, trolley).position.y = -1.6;
    box(0.4, 0.25, 0.25, craneM, 0, -3.25, 0, trolley);
    box(W - 2.4, 0.05, 0.03, glow(0xffffff, 0.9), 0, -0.37, 0.75, c);
    cranes.push({ c, trolley, z0, sp });
    shadows(c, true, false);
  }
  anim.push((dt, t) => { for (const k of cranes) { k.trolley.position.x = Math.sin(t * k.sp * 2.4) * 18; k.c.position.z = k.z0 + Math.sin(t * k.sp) * 3; } });

  // ---------- Kaizen board (continuous improvement) at the end of the NHA line ----------
  const kzCT = new CanvasTex(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#F7F8FA'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#12161C'; ctx.font = `800 52px ${FONT}`; ctx.fillText('CONTINUOUS IMPROVEMENT / KAIZEN', 36, 74);
    ctx.fillStyle = '#0E9384'; ctx.fillRect(36, 92, 160, 8);
    const cols = ['Idea', 'In progress', 'Done', 'Standardised'];
    cols.forEach((c, i) => { const x = 36 + i * 244; ctx.fillStyle = '#4a525d'; ctx.font = `700 28px ${FONT}`; ctx.fillText(c, x, 150); ctx.strokeStyle = '#c9ced5'; ctx.lineWidth = 2; ctx.strokeRect(x, 166, 226, 440);
      const notes = [5, 4, 6, 3][i];
      for (let k = 0; k < notes; k++) { ctx.fillStyle = ['#FFE066', '#9BE7A0', '#FFB3B3', '#A7D3FF'][(k + i) % 4]; const nx = x + 12 + (k % 2) * 106, ny = 182 + Math.floor(k / 2) * 132; ctx.fillRect(nx, ny, 96, 100); ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let l = 0; l < 4; l++) ctx.fillRect(nx + 10, ny + 22 + l * 18, 60 + ((k + l) % 3) * 8, 4); }
      ctx.fillStyle = i === 2 ? '#3FBF8F' : '#E20015'; ctx.beginPath(); ctx.arc(x + 204, 148, 10, 0, Math.PI * 2); ctx.fill(); });
  });
  const kz = new THREE.Group(); kz.position.set(-3.7, 0, 14.0); kz.rotation.y = 0.5; root.add(kz);
  box(2.5, 1.6, 0.06, mat(0xb9c0c8, { rough: 0.4, metal: 0.6 }), 0, 1.55, -0.04, kz);
  const kzFace = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: kzCT.tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: kzCT.tex, emissiveIntensity: 0.3 }));
  kzFace.position.set(0, 1.55, 0); kz.add(kzFace);
  for (const sx of [-1.15, 1.15]) { box(0.05, 0.8, 0.05, alu, sx, 0.4, 0, kz); box(0.06, 0.04, 0.6, alu, sx, 0.02, 0, kz); }
  shadows(kz, true, true);

  // ---------- national flag on the back wall ----------
  const flagCT = new CanvasTex(600, 400, (ctx, w, h) => {
    ctx.fillStyle = '#FF9933'; ctx.fillRect(0, 0, w, h / 3); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 3, w, h / 3); ctx.fillStyle = '#138808'; ctx.fillRect(0, 2 * h / 3, w, h / 3);
    const cx = w / 2, cy = h / 2, r = h / 6 * 0.92; ctx.strokeStyle = '#000080'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
    ctx.fillStyle = '#000080'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2); ctx.fill();
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshStandardMaterial({ map: flagCT.tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: flagCT.tex, emissiveIntensity: 0.25 }));
  flag.position.set(-6, 7.4, HALL.z0 + 0.17); root.add(flag);

  // ---------- finish goods store ----------
  const fgs = new THREE.Group(); root.add(fgs);
  const palletM = mat(0xb08a5a, { rough: 0.8 }), cartonM = mat(0xc9a77c, { rough: 0.85 });
  const pallets = [], cartons = [];
  for (const z of [-20, -17, -14]) for (let x = -28.2; x <= -16; x += 1.4) {
    pallets.push([x, 0.07, z]);
    const n = 1 + ((Math.round(x * 3) + Math.round(z)) & 1);
    for (let k = 0; k < n; k++) cartons.push([x, 0.14 + 0.28 + k * 0.56, z]);
  }
  const palIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), palletM, pallets.length);
  pallets.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); palIM.setMatrixAt(i, m4); });
  const carIM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.1, 0.54, 0.9, 2, 0.03), cartonM, cartons.length);
  cartons.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); carIM.setMatrixAt(i, m4); });
  carIM.castShadow = true; fgs.add(palIM, carIM);

  // ---------- anomaly detection (MAS) screen beside the press ----------
  const masCT = new CanvasTex(512, 300, (ctx, w, h, ph = 0) => {
    ctx.fillStyle = '#0d1014'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1E88D9'; ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `800 34px ${FONT}`; ctx.fillText('Anomaly detection', 22, 56);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 20px ${FONT}`; ctx.fillText('NEXEED MAS · real time data', 22, 86);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; for (let y = 120; y < h - 20; y += 40) { ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(w - 22, y); ctx.stroke(); }
    ctx.beginPath(); ctx.strokeStyle = '#7EDEBE'; ctx.lineWidth = 4;
    for (let i = 0; i <= 60; i++) { const x = 22 + i * (w - 44) / 60, k = i + ph; const spike = (k % 37) > 33 ? 46 : 0; const y = 200 + Math.sin(k * 0.5) * 22 + Math.sin(k * 1.7) * 9 - spike; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  });
  const mas = new THREE.Group(); mas.position.set(17.6, 0, 3.6); mas.rotation.y = -0.6; root.add(mas);
  box(1.9, 1.15, 0.08, mat(0x1b2027, { rough: 0.4, metal: 0.5 }), 0, 1.75, -0.05, mas);
  const masScr = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), new THREE.MeshBasicMaterial({ map: masCT.tex, toneMapped: false })); masScr.position.y = 1.75; mas.add(masScr);
  box(0.08, 1.2, 0.08, railM, 0, 0.6, -0.1, mas); box(0.7, 0.04, 0.5, railM, 0, 0.02, -0.1, mas);
  let masT = 0, masP = 0; anim.push((dt) => { masT += dt; if (masT > 0.25) { masT = 0; masP += 1; masCT.redraw(masP); } });

  // ---------- zone signs hanging from the roof ----------
  const signs = [];
  const zoneSign = (title, sub, x, y, z, ry = 0, color = '#1E88D9', w = 4.6) => {
    const ct = new CanvasTex(1024, 256, (ctx, W, H) => {
      ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = color; ctx.fillRect(0, 0, 22, H);
      ctx.fillStyle = '#12161C'; const s1 = fitText(ctx, title, W - 90, 104, 800); ctx.font = `800 ${s1}px ${FONT}`; ctx.fillText(title, 56, sub ? 118 : 160);
      if (sub) { ctx.fillStyle = '#4a525d'; const s2 = fitText(ctx, sub, W - 90, 52, 600); ctx.font = `600 ${s2}px ${FONT}`; ctx.fillText(sub, 58, 196); }
    });
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, side: THREE.DoubleSide }));
    face.material.color.setScalar(0.92); g.add(face);
    for (const sx of [-w * 0.4, w * 0.4]) box(0.02, HALL.h - y, 0.02, railM, sx, (HALL.h - y) / 2 + w / 8, 0, g);
    signs.push(g); return g;
  };
  zoneSign('NHA', 'Component manufacturing', -18, 6.6, -1.2, 0, '#0E9384');
  zoneSign('NHA', 'Nozzle holder assembly line', -17, 5.4, 9.0, 0, '#0E9384');
  zoneSign('VE Pump', 'Pump assembly line', 10.2, 5.4, 9.0, 0, '#8E2C8C');
  zoneSign('NHA', 'Machining · holder bodies', -22.8, 5.6, 20.6, 0, '#0E9384');
  zoneSign('VE Pump', 'End of line test · packing', 16.7, 5.6, 20.6, 0, '#8E2C8C');
  zoneSign('VE Pump', 'Component manufacturing · SMED', 12, 6.8, -1.6, 0, '#8E2C8C');
  zoneSign('VE Pump', 'Calibration · AI vision', 25, 5.4, 6.0, 0, '#8E2C8C');
  zoneSign('ABE Store', 'Inbound · Kanban supermarket', 24.5, 5.4, -1.4, 0, '#1E88D9');
  zoneSign('Finish Goods Store', 'Outbound', -22, 5.4, -11.2, 0, '#1E88D9');
  zoneSign('Supplier', 'Inbound dock · AGV milk run', HALL.x0 + 1.2, 6.2, -14, Math.PI / 2, '#E20015', 4.2);
  zoneSign('Customer', 'Outbound dock · pull / MTO', HALL.x1 - 1.2, 6.2, -14, -Math.PI / 2, '#E20015', 4.2);

  // ---------- outside: forecourt, façade, main gate ----------
  const out = new THREE.Group(); out.name = 'outside'; root.add(out);
  const OUT = { x0: -110, x1: 110, z0: HALL.z1 + 0.16, z1: 150 };
  const groundCT = new CanvasTex(2048, 1024, (ctx, Wc, Hc) => {
    const X = x => (x - OUT.x0) / (OUT.x1 - OUT.x0) * Wc, Z = z => (z - OUT.z0) / (OUT.z1 - OUT.z0) * Hc;
    ctx.fillStyle = '#5b8f5f'; ctx.fillRect(0, 0, Wc, Hc); // lawn
    for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,40,0'},0.05)`; ctx.fillRect(Math.random() * Wc, Math.random() * Hc, 2, 2); }
    ctx.fillStyle = '#9ea4aa'; ctx.fillRect(X(-34), Z(OUT.z0), (68) / (OUT.x1 - OUT.x0) * Wc, Z(OUT.z0 + 14) - Z(OUT.z0)); // forecourt
    ctx.fillStyle = '#4b5056'; ctx.fillRect(0, Z(OUT.z0 + 14), Wc, Z(OUT.z0 + 24) - Z(OUT.z0 + 14)); // road
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([22, 18]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, Z(OUT.z0 + 19)); ctx.lineTo(Wc, Z(OUT.z0 + 19)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b9bec3'; ctx.fillRect(X(-2.2), Z(OUT.z0 + 24), X(2.2) - X(-2.2), Hc); // footpath to the gate
    ctx.fillStyle = 'rgba(126,222,190,0.55)'; ctx.fillRect(X(-2.2), Z(OUT.z0), X(2.2) - X(-2.2), Z(OUT.z0 + 14) - Z(OUT.z0)); // mint path on the forecourt
    ctx.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) ctx.fillRect(X(-2.2), Z(OUT.z0 + 15 + k * 1.5), X(2.2) - X(-2.2), Z(0.7) - Z(0)); // zebra crossing
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(OUT.x1 - OUT.x0, OUT.z1 - OUT.z0), new THREE.MeshStandardMaterial({ map: groundCT.tex, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((OUT.x0 + OUT.x1) / 2, -0.01, (OUT.z0 + OUT.z1) / 2); ground.receiveShadow = true; out.add(ground);
  // ground around the other three sides of the hall
  const lawnM = mat(0x5b8f5f, { rough: 0.95 });
  const lawn = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lawnM); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2); m.receiveShadow = true; out.add(m); };
  lawn(-110, -110, 110, HALL.z0 - 0.15); lawn(-110, HALL.z0 - 0.15, HALL.x0 - 0.15, HALL.z1 + 0.2); lawn(HALL.x1 + 0.15, HALL.z0 - 0.15, 110, HALL.z1 + 0.2);
  // trees
  const trunkM = mat(0x5a4632, { rough: 0.9 }), leafM = mat(0x2f6b45, { rough: 0.85 });
  const treeSpots = [[-40, 40], [-30, 52], [-18, 58], [18, 58], [30, 52], [40, 40], [-46, 10], [-46, -14], [46, 10], [46, -14], [-24, 60], [24, 60]];
  for (const [x, z] of treeSpots) {
    const s = 0.9 + ((x * 7 + z * 3) % 5) * 0.08;
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); out.add(t);
    cyl(0.18, 0.24, 1.6, trunkM, 8, t).position.y = 0.8;
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), leafM); c1.position.y = 2.8; t.add(c1);
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), leafM); c2.position.set(0.4, 3.9, 0.2); t.add(c2);
    shadows(t, true, false);
  }
  // façade: glass band, plant signs left (NHA) and right (VE Pump)
  const fz = HALL.z1 + 0.16;
  box(W - 0.4, 1.3, 0.05, glow(0xcfe6ff, 0.75), 0, 9.3, fz + 0.01, out);
  box(W, 0.18, 0.12, mat(0xE20015, { rough: 0.4 }), 0, HALL.h - 0.1, fz + 0.04, out);
  const facadeSign = (title, sub, x) => {
    const ct = new CanvasTex(1024, 320, (ctx, Wc, Hc) => {
      ctx.clearRect(0, 0, Wc, Hc); ctx.fillStyle = '#12161C'; ctx.textAlign = 'center';
      const s1 = fitText(ctx, title, Wc * 0.9, 170, 800); ctx.font = `800 ${s1}px ${FONT}`; ctx.fillText(title, Wc / 2, 170);
      ctx.fillStyle = '#E20015'; ctx.fillRect(Wc / 2 - 80, 205, 160, 12);
      ctx.fillStyle = '#3c444f'; ctx.font = `600 52px ${FONT}`; ctx.fillText(sub, Wc / 2, 284);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.125), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, toneMapped: false })); m.material.color.setScalar(0.9);
    m.position.set(x, 6.4, fz + 0.03); out.add(m);
  };
  facadeSign(GATE_TEXT.left, 'Plant · JaP', -17);
  facadeSign(GATE_TEXT.right, 'Plant · JaP', 17);
  // gate frame and canopy
  const frameM = glow(C.red, 1.7);
  box(0.25, GATE.h + 0.25, 0.25, frameM, -GATE.w / 2 - 0.12, (GATE.h + 0.25) / 2, fz + 0.12, out);
  box(0.25, GATE.h + 0.25, 0.25, frameM, GATE.w / 2 + 0.12, (GATE.h + 0.25) / 2, fz + 0.12, out);
  box(GATE.w + 0.5, 0.25, 0.25, frameM, 0, GATE.h + 0.12, fz + 0.12, out);
  const canopy = box(GATE.w + 3, 0.2, 3.2, mat(0x2b313a, { rough: 0.4, metal: 0.6 }), 0, GATE.h + 0.9, fz + 1.6, out); canopy.castShadow = true;
  box(GATE.w + 3, 0.05, 0.05, glow(0xffffff, 1.6), 0, GATE.h + 0.42, fz + 3.15, out);
  // "Main gate" sign above the canopy
  const gateSignCT = new CanvasTex(1024, 192, (ctx, Wc, Hc) => {
    ctx.fillStyle = '#12161C'; ctx.fillRect(0, 0, Wc, Hc); ctx.fillStyle = CSS.red; ctx.fillRect(0, Hc - 12, Wc, 12);
    ctx.fillStyle = '#F4F6F8'; ctx.textAlign = 'center'; ctx.font = `800 92px ${FONT}`; ctx.fillText('MAIN GATE', Wc / 2, 118);
  });
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: gateSignCT.tex, toneMapped: false }));
  gateSign.scale.setScalar(0.62); gateSign.position.set(0, GATE.h + 0.9, fz + 3.22); out.add(gateSign); // on the canopy's front edge
  // sliding door leaves: "2026" | "FLASHBACK"
  let doorWords = { left: ['2026', 'Reflection'], right: ['FLASHBACK', 'BPS GO!+'], accent: CSS.red };
  const leafTex = (side, align) => new CanvasTex(512, 800, (ctx, Wc, Hc) => {
    const [word, small] = doorWords[side];
    const g = ctx.createLinearGradient(0, 0, Wc, Hc); g.addColorStop(0, '#2d343e'); g.addColorStop(1, '#1a1f26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Wc, Hc);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 0; y < Hc; y += 26) ctx.fillRect(0, y, Wc, 2);
    ctx.fillStyle = doorWords.accent; ctx.fillRect(0, 300, Wc, 8);
    ctx.fillStyle = '#F4F6F8'; ctx.textAlign = align; const x = align === 'right' ? Wc - 34 : 34;
    const s = fitText(ctx, word, Wc - 60, 170, 800); ctx.font = `800 ${s}px ${FONT}`; ctx.fillText(word, x, 430);
    ctx.fillStyle = '#C3C9D1'; ctx.font = `600 34px ${FONT}`; ctx.fillText(small, x, 500);
  });
  const leafTexes = [];
  const leaves = [['left', 'right', -1], ['right', 'left', 1]].map(([side, align, sx]) => {
    const g = new THREE.Group(); g.position.set(sx * GATE.w / 4, 0, fz + 0.4); out.add(g);
    box(GATE.w / 2, GATE.h, 0.1, mat(0x1a1f26, { rough: 0.35, metal: 0.6 }), 0, GATE.h / 2, 0, g).castShadow = true;
    const lt = leafTex(side, align); leafTexes.push(lt);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(GATE.w / 2 - 0.12, GATE.h - 0.2), new THREE.MeshBasicMaterial({ map: lt.tex, toneMapped: false }));
    face.position.set(0, GATE.h / 2, 0.056); face.material.color.setScalar(1.1); g.add(face);
    return { g, sx };
  });
  // light behind the gate: grows as it opens
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(GATE.w, GATE.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  gateGlow.position.set(0, GATE.h / 2, HALL.z1 - 0.3); out.add(gateGlow);
  const gateLight = new THREE.PointLight(0xfff4e6, 0, 26, 1.4); gateLight.position.set(0, 3.6, fz + 3); out.add(gateLight);
  let gateK = 0, gateTarget = 0, glowK = 0, glowTarget = 0;
  anim.push((dt) => {
    gateK += (gateTarget - gateK) * (1 - Math.exp(-1.6 * dt));
    leaves.forEach(({ g, sx }) => { g.position.x = sx * (GATE.w / 4 + gateK * (GATE.w / 2 + 0.2)); });
    glowK += (glowTarget - glowK) * (1 - Math.exp(-2.4 * dt));
    gateGlow.material.opacity = glowK * Math.min(1, gateK * 1.6); gateGlow.visible = gateGlow.material.opacity > 0.01;
    gateLight.intensity = 30 * gateK * (0.35 + 0.65 * glowK);
  });
  hotspots.gate = V(0, GATE.h + 0.9, fz + 3.2);
  // tour stops
  Object.assign(hotspots, {
    supplier: V(HALL.x0 + 1.5, 3.2, -14), inbound: V(24.5, 2.2, -9), nha: V(-16, 2.2, 0), assembly: V(-17, 2.4, 11), veAssembly: V(10.2, 2.4, 11), machiningNha: V(-22.8, 2.6, 22.4), veTest: V(16.7, 2.6, 22.4),
    ve: V(12, 3.4, 0), calibration: V(23, 2.6, 9), scrum: V(0, 3.4, -10), customer: V(HALL.x1 - 1.5, 3.2, -14),
  });

  // ---------- 2027: a more digital plant (cobots, holographic KPIs, LED guide lines, more AGVs) ----------
  const future = new THREE.Group(); future.name = 'future2027'; future.visible = false; root.add(future);
  const cyan = 0x29d3ff;
  // cobots between the assembly stations
  const cobots = [];
  for (const l of Object.values(LINES)) for (let i = 1; i < l.n; i += 2) {
    const r = makeRobot(false, 0xF4F6F8); r.g.scale.setScalar(0.55); r.g.position.set(stationX(l, i), 0.84, l.z - 0.62); r.o = i * 1.3 + l.z; future.add(r.g); cobots.push(r);
    const ringC = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 32), glow(cyan, 1.8)); ringC.rotation.x = Math.PI / 2; ringC.position.set(stationX(l, i), 0.87, l.z - 0.62); future.add(ringC);
  }
  // holographic KPI panels floating over the lines
  const holoPanels = [];
  const holoTex = (title, value, sub) => new CanvasTex(512, 300, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = 'rgba(80,220,255,0.9)'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = 'rgba(40,160,220,0.18)'; ctx.fillRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#bff2ff'; ctx.font = `700 34px ${FONT}`; ctx.fillText(title, 30, 58);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 110px ${FONT}`; ctx.fillText(value, 30, 180);
    ctx.fillStyle = '#9fe6ff'; ctx.font = `600 30px ${FONT}`; ctx.fillText(sub, 30, 240);
    ctx.strokeStyle = '#7EDEBE'; ctx.lineWidth = 5; ctx.beginPath(); for (let i = 0; i < 10; i++) { const x = 300 + i * 20, y = 200 - i * 9 - Math.sin(i) * 8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  });
  const panelDefs = [
    [-22, 3.3, 11, 'NHA line · OEE', '89%', 'Target 85% · live'], [-11, 3.3, 11, 'NHA line · TPT', '−11%', 'vs 2026 · small lot'],
    [6.5, 3.3, 11, 'VE line · FPY', '99.1%', 'AI vision · live'], [14, 3.3, 11, 'VE line · DLPC', '96%', 'Maturity · target >95%'],
    [-16, 3.4, 0, 'Machining · TPM', 'L3', 'Maturity level'], [12, 4.8, 0, 'Press · changeover', '14 min', 'SMED · −22%'],
  ];
  for (const [x, y, z, t, v, sb] of panelDefs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.11), new THREE.MeshBasicMaterial({ map: holoTex(t, v, sb).tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z + 0.9); future.add(m); holoPanels.push({ m, y });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, y - 2.2, 6), glow(cyan, 1.2)); beam.position.set(x, (y + 2.2) / 2 - 0.55, z + 0.9); future.add(beam);
  }
  // LED guide lines along the aisles and the gate approach, light strips under the roof
  const ledM = glow(cyan, 1.6);
  for (const z of [4.6, 7.6, 17, 19.6]) box(48, 0.012, 0.06, ledM, -6, 0.02, z, future);
  for (const x of [-2.2, 2.2]) box(0.06, 0.012, 24.4, ledM, x, 0.02, 19.8, future);
  for (const x of [-16, 0, 16]) box(0.08, 0.06, D - 8, glow(cyan, 1.3), x + 1.4, HALL.h - 0.3, 4, future);
  // two more AGVs on the milk run
  const moreAgvs = [0.17, 0.51, 0.85].map(u0 => { const g = makeAGV(); future.add(g); return { g, u: u0 }; });
  // a digital command centre beside the gate: three linked screens
  const cmdCT = new CanvasTex(1024, 360, (ctx, w, h) => {
    ctx.fillStyle = '#071622'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#29d3ff'; ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = '#e6faff'; ctx.font = `800 46px ${FONT}`; ctx.fillText('Digital command centre 2027', 30, 70);
    ['E2E value stream', 'Energy', 'Quality', 'Logistics'].forEach((t, i) => { const x = 30 + i * 245; ctx.strokeStyle = 'rgba(41,211,255,0.6)'; ctx.strokeRect(x, 110, 220, 210); ctx.fillStyle = '#9fe6ff'; ctx.font = `600 26px ${FONT}`; ctx.fillText(t, x + 14, 146); ctx.fillStyle = '#ffffff'; ctx.font = `800 64px ${FONT}`; ctx.fillText(['98%', '−8%', '1.9', '100%'][i], x + 14, 230); ctx.fillStyle = '#7EDEBE'; ctx.fillRect(x + 14, 270, 150 + i * 12, 10); });
  });
  const cmd = new THREE.Group(); cmd.position.set(7.6, 0, 23.0); cmd.rotation.y = -(Math.PI / 2 - 0.35); future.add(cmd);
  for (const [dx, ry] of [[-2.05, 0.28], [0, 0], [2.05, -0.28]]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.7), new THREE.MeshBasicMaterial({ map: cmdCT.tex, toneMapped: false })); scr.position.set(dx, 2.3, Math.abs(dx) * 0.14); scr.rotation.y = ry; cmd.add(scr);
    box(2.06, 0.76, 0.06, mat(0x14181d, { rough: 0.4, metal: 0.5 }), dx, 2.3, Math.abs(dx) * 0.14 - 0.04, cmd).rotation.y = ry;
  }
  box(0.12, 1.95, 0.12, mat(0x14181d, { rough: 0.4, metal: 0.5 }), 0, 0.98, -0.1, cmd);
  box(5.6, 0.05, 1.4, glow(cyan, 0.9), 0, 0.02, 0.6, cmd);
  let futureOn = false;
  anim.push((dt, t) => {
    if (!futureOn) return;
    for (const r of cobots) { const k = t * 1.2 + r.o; r.turret.rotation.y = Math.sin(k * 0.8) * 1.1; r.shoulder.rotation.x = 0.5 + Math.sin(k) * 0.3; r.elbow.rotation.x = 1.3 + Math.sin(k + 1) * 0.35; r.wrist.rotation.x = 0.4 + Math.sin(k * 1.5) * 0.4; }
    holoPanels.forEach(({ m, y }, i) => { m.position.y = y + Math.sin(t * 1.2 + i) * 0.06; m.material.opacity = 0.85 + 0.15 * Math.sin(t * 3 + i); });
    ledM.color.setRGB(0.16, 0.83, 1).multiplyScalar(1.3 + 0.5 * Math.sin(t * 2));
    for (const a of moreAgvs) { a.u = (a.u + dt * 1.15 / agvLen) % 1; agvPath.getPointAt(a.u, a.g.position); agvPath.getTangentAt(a.u, tmpT); a.g.rotation.y = Math.atan2(tmpT.x, tmpT.z) + Math.PI / 2; }
  });

  return {
    root, hotspots, agvs, outside: out,
    setFuture(on) {
      futureOn = on; future.visible = on; digitalTarget = on ? 1 : digitalTarget;
      doorWords = on ? { left: ['2027', 'How 2027 looks like'], right: ['FUTURE', 'BPS GO!+'], accent: '#29d3ff' } : { left: ['2026', 'Reflection'], right: ['FLASHBACK', 'BPS GO!+'], accent: CSS.red };
      leafTexes.forEach(t => t.redraw());
    },
    gate: {
      open(on = true, glowOn = true) { gateTarget = on ? 1 : 0; glowTarget = on && glowOn ? 1 : 0; },
      snap(on) { gateK = gateTarget = on ? 1 : 0; glowK = glowTarget = 0; },
      glow(on) { glowTarget = on ? 1 : 0; },
    },
    setDigital(on) { digitalTarget = on ? 1 : 0; },
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
