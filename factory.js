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
const BENCH_X = [-26, -21, -16, -11]; // NHA assembly benches

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
    const fill = (x0, z0, x1, z1, col = 'rgba(126,222,190,0.42)') => { ctx.fillStyle = col; ctx.fillRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM); };
    fill(-30, 4.6, 18, 7.6); fill(4.6, -9.6, 7.4, 4.6); fill(-30, 17, 18, 19.6); fill(-2.2, 7.6, 2.2, 32);
    fill(-6, 20, 6, 32, 'rgba(126,222,190,0.18)');
    // walkway lines
    const line = (x0, z0, x1, z1, col = 'rgba(225,229,234,0.55)', w = 0.1) => { ctx.strokeStyle = col; ctx.lineWidth = w * PPM; ctx.beginPath(); ctx.moveTo(X(x0), Z(z0)); ctx.lineTo(X(x1), Z(z1)); ctx.stroke(); };
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
    for (const x of BENCH_X) ctx.strokeRect(X(x - 1.1), Z(10.3), 2.2 * PPM, 2.4 * PPM);
    for (const x of [-18, -11, -4]) ctx.strokeRect(X(x - 1), Z(-2.4), 2 * PPM, 2 * PPM);
    // supermarket lanes
    for (const x of [21, 24.5, 28]) { ctx.strokeStyle = 'rgba(225,229,234,0.35)'; ctx.strokeRect(X(x - 0.8), Z(-17.5), 1.6 * PPM, 15 * PPM); }
    // finish goods store lanes
    for (const z of [-20, -17, -14]) { ctx.strokeStyle = 'rgba(225,229,234,0.4)'; ctx.strokeRect(X(-29), Z(z - 0.6), 14 * PPM, 1.2 * PPM); }
    // stencil text
    const stencil = (t, x, z) => { ctx.save(); ctx.fillStyle = 'rgba(245,247,250,0.5)'; ctx.font = `800 ${1.1 * PPM}px ${FONT}`; ctx.textAlign = 'center'; ctx.translate(X(x), Z(z)); ctx.fillText(t, 0, 0); ctx.restore(); };
    stencil('NHA', -12, 6.6); stencil('VE PUMP', 12, 6.6); stencil('MAIN GATE', 0, 29.5);
  });
}

function makeRobot(accent = true) {
  const g = new THREE.Group();
  const white = mat(0xEEF0F2, { rough: 0.32, metal: 0.05 });
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
  const floorMat = new THREE.MeshStandardMaterial({ map: ft.tex, roughness: 0.48, metalness: 0.0, envMapIntensity: 0.9 });
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
  box(0.05, 1.1, D - 4, bandM, HALL.x0 + 0.3, 8.4, 4, root);
  box(0.05, 1.1, D - 4, bandM, HALL.x1 - 0.3, 8.4, 4, root);
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
  for (const x of [-16, 0, 16]) box(2.4, 0.05, D - 6, glow(0xe8eef8, 1.05), x, HALL.h - 0.12, 4, root);
  // hanging high-bay fixtures
  const fixtures = [];
  for (let x = -24; x <= 24; x += 8) for (let z = -6; z <= 24; z += 6) fixtures.push([x, z]);
  const fixIM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.07, 0.24), glow(0xffffff, 1.6), fixtures.length);
  const fixHousing = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.12, 0.32), mat(0x8d949d, { rough: 0.5, metal: 0.5 }), fixtures.length);
  fixtures.forEach(([x, z], i) => { m4.makeTranslation(x, 8.15, z); fixIM.setMatrixAt(i, m4); m4.makeTranslation(x, 8.24, z); fixHousing.setMatrixAt(i, m4); });
  root.add(fixIM, fixHousing);

  // ---------- Line A conveyor ----------
  const lineA = new THREE.Group(); root.add(lineA);
  const beltCT = new CanvasTex(512, 64, (ctx, w, h) => { ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#23262c'; for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 14, h); });
  beltCT.tex.wrapS = THREE.RepeatWrapping; beltCT.tex.repeat.set(27, 1);
  const beltLen = 27, beltX = -10.5;
  const belt = box(beltLen, 0.06, 0.9, new THREE.MeshStandardMaterial({ map: beltCT.tex, roughness: 0.8 }), beltX, 0.86, 0, lineA);
  const railM = mat(0xaeb5bd, { rough: 0.3, metal: 0.85 });
  box(beltLen, 0.12, 0.06, railM, beltX, 0.88, 0.48, lineA); box(beltLen, 0.12, 0.06, railM, beltX, 0.88, -0.48, lineA);
  box(beltLen, 0.08, 0.95, mat(0x2a2f37, { rough: 0.5, metal: 0.5 }), beltX, 0.78, 0, lineA);
  const legIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), railM, 28);
  for (let i = 0; i < 14; i++) { const x = -23.5 + i * 2; m4.makeTranslation(x, 0.39, 0.42); legIM.setMatrixAt(i * 2, m4); m4.makeTranslation(x, 0.39, -0.42); legIM.setMatrixAt(i * 2 + 1, m4); }
  lineA.add(legIM);
  // products on belt
  const PCOUNT = 22;
  const prodGeo = new RoundedBoxGeometry(0.36, 0.22, 0.36, 2, 0.04);
  const prodIM = new THREE.InstancedMesh(prodGeo, mat(0xdfe3e8, { rough: 0.3, metal: 0.35 }), PCOUNT);
  prodIM.castShadow = true; lineA.add(prodIM);
  const prodCap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14), mat(C.red, { rough: 0.4 }), PCOUNT); lineA.add(prodCap);
  anim.push((dt, t) => {
    beltCT.tex.offset.x -= dt * 0.035;
    for (let i = 0; i < PCOUNT; i++) {
      const x = -24 + ((t * 0.45 + i * (beltLen / PCOUNT)) % beltLen);
      m4.makeTranslation(x, 1.0, 0); prodIM.setMatrixAt(i, m4);
      m4.makeTranslation(x, 1.135, 0); prodCap.setMatrixAt(i, m4);
    }
    prodIM.instanceMatrix.needsUpdate = true; prodCap.instanceMatrix.needsUpdate = true;
  });
  // robots on line A
  const robots = [];
  [-18, -11, -4].forEach((x, i) => {
    const r = makeRobot(); r.g.position.set(x, 0, -1.45); r.g.rotation.y = 0; lineA.add(r.g); r.o = i * 1.9; robots.push(r);
    // andon tower
    const tower = new THREE.Group(); tower.position.set(x + 1.1, 0, -0.8); lineA.add(tower);
    cyl(0.03, 0.03, 1.8, railM, 8, tower).position.y = 0.9;
    const lamps = [glow(0xffffff, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.red).multiplyScalar(1.25), toneMapped: false })];
    const l1 = cyl(0.07, 0.07, 0.14, lamps[0], 14, tower); l1.position.y = 1.85;
    const l2 = cyl(0.07, 0.07, 0.14, lamps[1], 14, tower); l2.position.y = 2.0;
    anim.push((dt, t) => { l2.visible = i === 1 ? (Math.floor(t * 2) % 2 === 0) && (t % 20 < 6) : false; });
  });
  hotspots.vsm = V(-11, 1.9, 0.2);
  hotspots.pdm = V(-4, 2.6, -1.45);
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

  // ---------- Line B manual workstations ----------
  const benchM = mat(0xcfd4da, { rough: 0.4, metal: 0.3 }), benchTop = mat(0x2a3038, { rough: 0.6 });
  const swCT = new CanvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0d1014'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = '#F4F6F8'; ctx.font = `700 22px ${FONT}`; ctx.fillText('Standard work', 14, 40);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `500 16px ${FONT}`; ['1  Pick housing', '2  Fit seal', '3  Torque 4.5 Nm', '4  Scan and pass'].forEach((s, i) => ctx.fillText(s, 14, 70 + i * 22));
  });
  for (const x of BENCH_X) {
    const st = new THREE.Group(); st.position.set(x, 0, 11); root.add(st);
    box(1.8, 0.06, 0.85, benchTop, 0, 0.92, 0, st);
    for (const [lx, lz] of [[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]]) box(0.05, 0.9, 0.05, benchM, lx, 0.45, lz, st);
    box(1.8, 0.05, 0.4, benchM, 0, 1.5, -0.3, st);
    for (const bx of [-0.6, 0, 0.6]) { const b = new THREE.Mesh(binGeo, mat(bx === 0 ? C.red : 0x59616c, { rough: 0.6 })); b.scale.set(0.8, 0.7, 0.6); b.position.set(bx, 1.64, -0.3); st.add(b); }
    for (const sx of [-0.88, 0.88]) box(0.04, 1.1, 0.04, benchM, sx, 1.45, -0.42, st);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshBasicMaterial({ map: swCT.tex, toneMapped: false }));
    scr.position.set(0.55, 1.22, -0.2); scr.rotation.x = -0.15; st.add(scr);
    box(0.4, 0.12, 0.3, mat(0xdfe3e8, { rough: 0.3, metal: 0.35 }), -0.2, 1.01, 0.05, st);
    box(1.7, 0.04, 0.12, glow(0xffffff, 1.2), 0, 2.02, -0.2, st);
    shadows(st, true, true);
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
  const agvPath = roundedRectPath(-26, -6, 17, 15.5, 2.4);
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
  const sources = [V(-18, 2.2, -1.45), V(-11, 2.2, -1.45), V(-4, 2.2, -1.45), V(12, 4.2, 0), V(15.9, 2.2, -2.3), V(23, 2.6, 9), V(26.5, 2.2, 10.6), V(-13, 2.8, -8.6), V(-10, 6.2, 3.2), V(24.5, 2.6, -9), V(-21, 1.6, 11), V(-11, 1.6, 11)];
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
  const rings = [V(-4, 0.03, -1.45), V(23, 0.03, 9), V(-10, 0.03, 3.2), V(15.9, 0.03, -2.3), V(25, 0.03, 15.5)].map(p => { const r = new THREE.Mesh(ringGeo, dmat(C.red, 0.9)); r.rotation.x = -Math.PI / 2; r.position.copy(p); digital.add(r); return r; });

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
  zoneSign('NHA', 'Component manufacturing', -16, 6.6, -1.2, 0, '#0E9384');
  zoneSign('NHA', 'Assembly · standard work', -18.5, 5.4, 9.2, 0, '#0E9384');
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
  box(GATE.w + 3, 0.05, 0.05, glow(0xffffff, 1.6), 0, GATE.h + 0.78, fz + 3.15, out);
  // "Main gate" sign above the canopy
  const gateSignCT = new CanvasTex(1024, 192, (ctx, Wc, Hc) => {
    ctx.fillStyle = '#12161C'; ctx.fillRect(0, 0, Wc, Hc); ctx.fillStyle = CSS.red; ctx.fillRect(0, Hc - 12, Wc, 12);
    ctx.fillStyle = '#F4F6F8'; ctx.textAlign = 'center'; ctx.font = `800 92px ${FONT}`; ctx.fillText('MAIN GATE', Wc / 2, 118);
  });
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: gateSignCT.tex, toneMapped: false }));
  gateSign.position.set(0, GATE.h + 1.9, fz + 0.03); out.add(gateSign);
  // sliding door leaves: "2026" | "FLASHBACK"
  const leafTex = (word, align) => new CanvasTex(512, 800, (ctx, Wc, Hc) => {
    const g = ctx.createLinearGradient(0, 0, Wc, Hc); g.addColorStop(0, '#2d343e'); g.addColorStop(1, '#1a1f26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Wc, Hc);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 0; y < Hc; y += 26) ctx.fillRect(0, y, Wc, 2);
    ctx.fillStyle = CSS.red; ctx.fillRect(0, 300, Wc, 8);
    ctx.fillStyle = '#F4F6F8'; ctx.textAlign = align; const x = align === 'right' ? Wc - 34 : 34;
    const s = fitText(ctx, word, Wc - 60, 170, 800); ctx.font = `800 ${s}px ${FONT}`; ctx.fillText(word, x, 430);
    ctx.fillStyle = '#C3C9D1'; ctx.font = `600 34px ${FONT}`; ctx.fillText(align === 'right' ? 'Reflection' : 'BPS GO!+', x, 500);
  });
  const leaves = [['2026', 'right', -1], ['FLASHBACK', 'left', 1]].map(([word, align, sx]) => {
    const g = new THREE.Group(); g.position.set(sx * GATE.w / 4, 0, fz + 0.4); out.add(g);
    box(GATE.w / 2, GATE.h, 0.1, mat(0x1a1f26, { rough: 0.35, metal: 0.6 }), 0, GATE.h / 2, 0, g).castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(GATE.w / 2 - 0.12, GATE.h - 0.2), new THREE.MeshBasicMaterial({ map: leafTex(word, align).tex, toneMapped: false }));
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
  hotspots.gate = V(0, GATE.h + 1.9, fz);
  // tour stops
  Object.assign(hotspots, {
    supplier: V(HALL.x0 + 1.5, 3.2, -14), inbound: V(24.5, 2.2, -9), nha: V(-11, 2.2, 0), assembly: V(-18.5, 1.8, 11),
    ve: V(12, 3.4, 0), calibration: V(23, 2.6, 9), scrum: V(0, 3.4, -10), customer: V(HALL.x1 - 1.5, 3.2, -14),
  });

  return {
    root, hotspots, agvs, outside: out,
    gate: {
      open(on = true, glowOn = true) { gateTarget = on ? 1 : 0; glowTarget = on && glowOn ? 1 : 0; },
      snap(on) { gateK = gateTarget = on ? 1 : 0; glowK = glowTarget = 0; },
      glow(on) { glowTarget = on ? 1 : 0; },
    },
    setDigital(on) { digitalTarget = on ? 1 : 0; },
    update(dt, t) { for (const f of anim) f(dt, t); },
  };
}
