import { THREE, RoundedBoxGeometry, mergeGeometries } from './lib.js';
import { C, mat, glow, clamp, lerp, damp, angleLerp } from './util.js';
// Motion-captured walk (baked from a Mixamo clip by tools/bake-walk.mjs); null falls back to the hand-made walk
import WALK from './walkcycle.json';

/*
  Procedural low-poly humanoids with a joint hierarchy, animated entirely in code.
  Base states: idle | walk | sit | work. Gestures blend over the base (upper body mostly).
  Rotation conventions (limbs hanging down): negative X = swing forward; knees bend with +X; elbows flex with −X.
  Character faces local +Z. Left side is +X.
*/

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKnee', 'rHip', 'rKnee'];
const STRIDE = WALK ? WALK.stride : 1.5; // metres per full walk cycle
const DOWN = new THREE.Vector3(0, -1, 0);
const geoCache = new Map();
function geo(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
const capsule = (r, h) => geo(`cap${r}_${h}`, () => new THREE.CapsuleGeometry(r, h, 6, 14));
const sphere = (r) => geo(`sph${r}`, () => new THREE.SphereGeometry(r, 22, 16));

function zeroPose() { const p = { hipY: 0, hipZ: 0 }; for (const k of JOINTS) p[k] = [0, 0, 0]; return p; }
function copyPose(dst, src) { dst.hipY = src.hipY; dst.hipZ = src.hipZ; for (const k of JOINTS) { const a = dst[k], b = src[k]; a[0] = b[0]; a[1] = b[1]; a[2] = b[2]; } }
function blendInto(out, part, w, additive) {
  for (const k in part) {
    const v = part[k];
    if (k === 'hipY' || k === 'hipZ') { out[k] = additive ? out[k] + v * w : lerp(out[k], v, w); continue; }
    const o = out[k]; if (!o) continue;
    if (additive) { o[0] += v[0] * w; o[1] += v[1] * w; o[2] += v[2] * w; }
    else { o[0] = lerp(o[0], v[0], w); o[1] = lerp(o[1], v[1], w); o[2] = lerp(o[2], v[2], w); }
  }
}
const S = Math.sin;
const ZERO = zeroPose();

// ---------- Base poses ----------
const BASE = {
  idle(c, t) {
    const s = c.seed, b = S(t * 1.7 + s) * 0.018, sw = S(t * 0.45 + s) * 0.03;
    return {
      hipY: 0, hipZ: 0, hips: [0, sw * 0.4, sw * 0.25], spine: [b, 0, -sw * 0.2], chest: [b, 0, 0], neck: [0, 0, 0], head: [0.03, S(t * 0.31 + s) * 0.07, 0],
      lSh: [0.04, 0, 0.1 + b], lEl: [-0.14, 0, 0], rSh: [0.04, 0, -0.1 - b], rEl: [-0.14, 0, 0],
      lHip: [0, 0, 0.035], lKnee: [0.03, 0, 0], rHip: [0, 0, -0.035], rKnee: [0.03, 0, 0],
    };
  },
  walk(c, t) {
    if (WALK) {
      // sample the captured cycle by distance walked; walkAmp eases it in and out
      const a = c.walkAmp, N = WALK.samples, f = ((c.phase / (Math.PI * 2)) % 1 + 1) % 1 * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, k = f - Math.floor(f);
      const out = { hipY: lerp(WALK.hipY[i0], WALK.hipY[i1], k) * a, hipZ: 0 };
      for (const [jn, arr] of Object.entries(WALK.joints)) {
        const A = arr[i0], B = arr[i1];
        out[jn] = [lerp(A[0], B[0], k) * a, lerp(A[1], B[1], k) * a, lerp(A[2], B[2], k) * a];
      }
      return out;
    }
    const ph = c.phase, s = S(ph), a = c.walkAmp;
    const kl = 0.12 + 0.85 * Math.pow(Math.max(0, Math.cos(ph)), 1.4);
    const kr = 0.12 + 0.85 * Math.pow(Math.max(0, Math.cos(ph + Math.PI)), 1.4);
    return {
      hipY: (-0.03 + 0.03 * Math.abs(Math.cos(ph))) * a, hipZ: 0,
      hips: [0, 0.09 * s * a, 0], spine: [0.05, 0, 0], chest: [0.02, -0.12 * s * a, 0], neck: [0, 0.04 * s * a, 0], head: [0.04, 0, 0],
      lSh: [0.36 * s * a, 0, 0.08], lEl: [-0.22 - 0.2 * Math.max(0, -s) * a, 0, 0],
      rSh: [-0.36 * s * a, 0, -0.08], rEl: [-0.22 - 0.2 * Math.max(0, s) * a, 0, 0],
      lHip: [-0.46 * s * a, 0, 0.02], lKnee: [kl * a, 0, 0], rHip: [0.46 * s * a, 0, -0.02], rKnee: [kr * a, 0, 0],
    };
  },
  sit(c, t) {
    const b = S(t * 1.6 + c.seed) * 0.015;
    return {
      hipY: -0.44, hipZ: -0.02, hips: [0, 0, 0], spine: [0.04 + b, 0, 0], chest: [0.02, 0, 0], neck: [0, 0, 0], head: [0.05, S(t * 0.27 + c.seed) * 0.06, 0],
      lSh: [-0.76, 0, 0.16], lEl: [-0.82, 0, 0], rSh: [-0.76, 0, -0.16], rEl: [-0.82, 0, 0],
      lHip: [-1.57, 0, 0.07], lKnee: [1.57, 0, 0], rHip: [-1.57, 0, -0.07], rKnee: [1.57, 0, 0],
    };
  },
  work(c, t) {
    const s = c.seed, f = 2.3;
    return {
      hipY: 0, hipZ: 0, hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.08, S(t * 0.7 + s) * 0.08, 0], neck: [0.1, 0, 0], head: [0.3, S(t * 0.5 + s) * 0.15, 0],
      lSh: [-0.72 + 0.16 * S(t * f + s), 0, -0.04], lEl: [-0.8 + 0.22 * S(t * f + s + 1.2), 0, 0],
      rSh: [-0.72 + 0.16 * S(t * f + s + Math.PI), 0, 0.04], rEl: [-0.8 + 0.22 * S(t * f + s + 4.3), 0, 0],
      lHip: [0, 0, 0.05], lKnee: [0.04, 0, 0], rHip: [0, 0, -0.05], rKnee: [0.04, 0, 0],
    };
  },
};

// ---------- Gestures ----------
const P = t => 0.5 + 0.5 * t;
export const GESTURES = {
  wave: { fn: lt => ({ rSh: [0.35, 0, -2.0], rEl: [0, 0, -1.05 + 0.38 * S(lt * 9)], chest: [0, 0.06, -0.03], head: [0, 0, 0.05] }) },
  waveL: { fn: lt => ({ lSh: [0.35, 0, 2.0], lEl: [0, 0, 1.05 - 0.38 * S(lt * 9)], chest: [0, -0.06, 0.03] }) },
  present: { fn: lt => ({ lSh: [-0.72 + 0.06 * S(lt * 2), 0, 0.42], lEl: [-0.45, 0, 0], rSh: [-0.72 + 0.06 * S(lt * 2 + 1), 0, -0.42], rEl: [-0.45, 0, 0], chest: [-0.04, 0, 0] }) },
  explain: { fn: lt => ({ rSh: [-0.45 + 0.13 * S(lt * 2.6), 0, -0.16], rEl: [-1.05 + 0.25 * S(lt * 2.6 + 0.9), 0, 0], lSh: [-0.36 + 0.1 * S(lt * 2.1 + 2), 0, 0.18], lEl: [-0.95 + 0.2 * S(lt * 2.1 + 3), 0, 0], chest: [0, 0.07 * S(lt * 0.9), 0] }) },
  nod: { additive: true, fadeIn: 0.15, fadeOut: 0.2, fn: lt => ({ head: [0.2 * Math.max(0, S(lt * 7)), 0, 0], neck: [0.08 * Math.max(0, S(lt * 7)), 0, 0] }) },
  handshake: { fn: lt => ({ rSh: [-0.82 + 0.08 * S(lt * 11), 0, 0.14], rEl: [-0.42 + 0.05 * S(lt * 11), 0, 0], chest: [0.06, 0, 0], head: [0.08, 0, 0] }) },
  clap: { fadeIn: 0.25, fn: lt => { const p = P(S(lt * 15)); return { lSh: [-1.0, 0, -0.17 - 0.2 * p], rSh: [-1.0, 0, 0.17 + 0.2 * p], lEl: [-0.8, 0, 0], rEl: [-0.8, 0, 0], head: [-0.04, 0, 0] }; } },
  celebrate: { fn: lt => { const p = Math.abs(S(lt * 7)); return { lSh: [0.2, 0, 2.6 + 0.12 * p], rSh: [0.2, 0, -2.6 - 0.12 * p], lEl: [0, 0, 0.15], rEl: [0, 0, -0.15], head: [-0.15, 0, 0], hipY: 0.03 * p }; } },
  fist: { fn: lt => ({ rSh: [-0.2 - 0.25 * Math.abs(S(lt * 5)), 0, -0.35], rEl: [-2.0, 0, 0], head: [-0.06, 0, 0] }) },
  beckon: { fn: lt => { const p = P(S(lt * 6)); return { rSh: [-1.05, 0, -0.32], rEl: [-0.35 - 0.75 * p, 0, 0], chest: [0, -0.15, 0] }; } },
  pleaseSit: { fn: lt => { const q = P(S(lt * 3.4)); return { lSh: [-0.98 + 0.28 * q, 0, 0.32], rSh: [-0.98 + 0.28 * q, 0, -0.32], lEl: [-0.32, 0, 0], rEl: [-0.32, 0, 0], chest: [0.05, 0, 0] }; } },
  think: { fn: lt => ({ rSh: [-0.95, 0, 0.42], rEl: [-2.15, 0, 0], lSh: [-0.45, 0, -0.38], lEl: [-1.6, 0, 0], head: [0.12, 0, 0.08 + 0.02 * S(lt)], chest: [0.04, 0, 0] }) },
  raiseHand: { fn: lt => ({ rSh: [0.15, 0, -2.85], rEl: [0, 0, -0.12 + 0.04 * S(lt * 3)], head: [-0.06, 0, 0] }) },
  thumbsUp: { fn: lt => ({ rSh: [-0.75, 0, -0.12], rEl: [-1.3 + 0.06 * S(lt * 6), 0, 0], head: [0.05, 0, -0.04] }) },
  leanIn: { additive: true, fn: () => ({ spine: [0.12, 0, 0], chest: [0.08, 0, 0], head: [0.05, 0, 0] }) },
  bow: { additive: true, fadeIn: 0.4, fadeOut: 0.5, fn: () => ({ spine: [0.28, 0, 0], head: [0.18, 0, 0] }) },
  armsOpen: { fn: lt => ({ lSh: [-0.2, 0, 1.35 + 0.05 * S(lt * 2)], rSh: [-0.2, 0, -1.35 - 0.05 * S(lt * 2)], lEl: [-0.2, 0, 0], rEl: [-0.2, 0, 0], head: [-0.08, 0, 0], chest: [-0.06, 0, 0] }) },
  point: { fn: () => ({ lSh: [0.05, 0, 0.12], lEl: [-0.15, 0, 0] }) }, // arm aim applied separately
  handOnChest: { fn: () => ({ rSh: [-0.35, 0, 0.42], rEl: [-1.95, 0, 0], head: [0.1, 0, 0] }) },
};

// Front surface of the torso in chest-local coordinates (chest joint origin), from the lathe profiles above.
const RIBS = [[-0.01, 0.158], [0.06, 0.17], [0.12, 0.172], [0.17, 0.158], [0.2, 0.11], [0.215, 0.055]];
const WAIST = [[-0.26, 0.138], [-0.18, 0.134], [-0.08, 0.142], [-0.01, 0.158]]; // spine profile shifted into chest space
function profileR(y) {
  const P = y < -0.01 ? WAIST : RIBS;
  if (y <= P[0][0]) return P[0][1]; if (y >= P[P.length - 1][0]) return P[P.length - 1][1];
  for (let i = 1; i < P.length; i++) if (y <= P[i][0]) { const [y0, r0] = P[i - 1], [y1, r1] = P[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return P[P.length - 1][1];
}
function surfZ(x, y) { const r = profileR(y), rx = r * (y < -0.01 ? 1 : 1.06), rz = r * (y < -0.01 ? 0.66 : 0.68); const u = Math.min(0.98, Math.abs(x) / rx); return rz * Math.sqrt(1 - u * u); }
// a flat 2D outline laid onto the front of the torso, lifted by `lift`
function bodyPatch(pts, lift) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) sh.lineTo(x, y); sh.closePath();
  // triangulate, then split every triangle into 4 (three times) so the patch can follow the chest's curve
  let tri = Array.from(new THREE.ShapeGeometry(sh, 8).toNonIndexed().attributes.position.array);
  for (let k = 0; k < 3; k++) {
    const out = [];
    for (let i = 0; i < tri.length; i += 9) {
      const A = [tri[i], tri[i + 1]], B = [tri[i + 3], tri[i + 4]], Cc = [tri[i + 6], tri[i + 7]];
      const m = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], ab = m(A, B), bc = m(B, Cc), ca = m(Cc, A);
      for (const [p1, p2, p3] of [[A, ab, ca], [ab, B, bc], [ca, bc, Cc], [ab, bc, ca]]) out.push(p1[0], p1[1], 0, p2[0], p2[1], 0, p3[0], p3[1], 0);
    }
    tri = out;
  }
  for (let i = 0; i < tri.length; i += 3) tri[i + 2] = surfZ(tri[i], tri[i + 1]) + lift;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(tri.length / 3 * 2).fill(0), 2));
  g.computeVertexNormals(); return g;
}

// ---------- sculpted head (used for the Plant Head and the BPS team) ----------
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const G = (dx, dy) => Math.exp(-(dx * dx + dy * dy));
// radial offset of the face surface for a unit direction (front = +z)
function faceRelief(nx, ny, nz) {
  const front = smoothstep(0.15, 0.75, nz), ax = Math.abs(nx);
  let d = 0;
  d += 0.05 * G(nx / 0.55, (ny - 0.27) / 0.09) * front;                 // brow ridge
  d -= 0.065 * G((ax - 0.33) / 0.15, (ny - 0.13) / 0.095) * front;       // eye sockets
  d += 0.1 * G(nx / 0.085, (ny + 0.0) / 0.2) * front;                    // nose bridge
  d += 0.14 * G(nx / 0.12, (ny + 0.19) / 0.09) * front;                  // nose tip
  d += 0.04 * G((ax - 0.11) / 0.07, (ny + 0.23) / 0.055) * front;        // nostril wings
  d += 0.038 * G((ax - 0.5) / 0.17, (ny + 0.04) / 0.13) * smoothstep(0, 0.6, nz); // cheekbones
  d -= 0.025 * G((ax - 0.42) / 0.16, (ny + 0.3) / 0.12) * front;         // under the cheekbones
  d += 0.035 * G(nx / 0.19, (ny + 0.39) / 0.045) * front;                // upper lip
  d -= 0.018 * G(nx / 0.21, (ny + 0.445) / 0.02) * front;                // mouth line
  d += 0.03 * G(nx / 0.16, (ny + 0.5) / 0.045) * front;                  // lower lip
  d += 0.055 * G(nx / 0.22, (ny + 0.72) / 0.12) * front;                 // chin
  d -= 0.03 * G((ax - 0.86) / 0.2, (ny - 0.22) / 0.25);                  // temples
  return d;
}
function headPos(nx, ny, nz, out = new THREE.Vector3()) {
  const d = faceRelief(nx, ny, nz);
  const jaw = clamp((-ny - 0.12) / 0.8, 0, 1);                          // narrower jaw and neck below the cheeks
  const sx = 0.086 * (1 - 0.24 * jaw), sy = 0.112, sz = 0.1 * (nz < 0 ? 1.05 - 0.12 * jaw : 1 - 0.04 * jaw);
  // the underside behind the chin is flattened so the head meets the neck
  let yy = ny;
  if (ny < -0.5) { const k = 1 - smoothstep(0.25, 0.75, nz); yy = ny + ((-0.5 - (-0.5 - ny) * 0.35) - ny) * k; }
  return out.set(nx * sx * (1 + d), yy * sy * (1 + d), nz * sz * (1 + d));
}
function headPoint(nx, ny) { return headPos(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))); }
function sculptedHead() {
  return geo('sculptedHead', () => {
    const g = new THREE.SphereGeometry(1, 80, 60), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); headPos(v.x, v.y, v.z, v); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  });
}
const faceMats = new Map();
function faceMaterial(o) {
  const key = [o.skin, o.hair, !!o.beard].join('|');
  if (faceMats.has(key)) return faceMats.get(key);
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
  const sk = new THREE.Color(o.skin), hr = new THREE.Color(o.hair ?? 0x15110e), lipC = sk.clone().multiplyScalar(0.72).lerp(new THREE.Color(0x9b4a45), 0.35), warm = new THREE.Color(0xc0605a);
  const c = new THREE.Color(), cs = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const theta = (y + 0.5) / H * Math.PI;
    for (let x = 0; x < W; x++) {
      const phi = (x + 0.5) / W * Math.PI * 2;
      const nx = -Math.cos(phi) * Math.sin(theta), ny = Math.cos(theta), nz = Math.sin(phi) * Math.sin(theta);
      const front = smoothstep(0.15, 0.75, nz), ax = Math.abs(nx);
      c.copy(sk);
      // soft variation
      const n = Math.sin(x * 0.9) * Math.sin(y * 1.3) * 0.012; c.offsetHSL(0, 0, n);
      c.lerp(warm, 0.1 * G((ax - 0.45) / 0.2, (ny + 0.12) / 0.15) * front);                 // cheeks
      c.multiplyScalar(1 - 0.14 * G((ax - 0.33) / 0.17, (ny - 0.12) / 0.08) * front);       // eye shadow
      c.multiplyScalar(1 - 0.08 * G((ax - 0.12) / 0.06, (ny + 0.25) / 0.04) * front);       // nostrils
      const lips = Math.max(G(nx / 0.16, (ny + 0.395) / 0.03), G(nx / 0.14, (ny + 0.49) / 0.035)) * front;
      c.lerp(lipC, Math.min(1, lips * 1.1));
      c.multiplyScalar(1 - 0.35 * G(nx / 0.17, (ny + 0.445) / 0.012) * front);              // mouth line
      // eyebrows: an arch over each eye
      const by = 0.255 + 0.03 * Math.cos((ax - 0.33) / 0.16 * 1.2);
      const brow = G((ax - 0.34) / 0.15, (ny - by) / 0.028) * front;
      c.lerp(hr, Math.min(0.9, brow * 1.3));
      // stubble or beard on the lower face
      const lower = smoothstep(-0.25, -0.5, ny) * smoothstep(-0.05, 0.35, nz) * (1 - Math.min(1, lips * 2));
      const upperLip = G(nx / 0.2, (ny + 0.33) / 0.035) * front;
      const beard = o.beard ? Math.min(0.85, lower * 0.9 + upperLip * 0.75) : (lower * 0.16 + upperLip * 0.1);
      c.lerp(hr, beard * (0.75 + 0.25 * Math.sin(x * 7.3 + y * 5.1)));
      cs.copy(c).convertLinearToSRGB();
      const i = (y * W + x) * 4; px[i] = cs.r * 255; px[i + 1] = cs.g * 255; px[i + 2] = cs.b * 255; px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.52, metalness: 0 });
  faceMats.set(key, m); return m;
}

const smooth = x => x * x * (3 - 2 * x);

export class Character {
  constructor(o) {
    o = this.o = Object.assign({ height: 1, skin: 0xC99A7A, hair: 0x2a2018, hairStyle: 'short', top: C.steel, sleeves: 'short', bottom: 0x1b1f26, shoes: 0x0e0f12, jacket: null, tie: false, glasses: false, lanyard: true, vest: false, hardhat: false, seed: Math.random() * 10, role: '' }, o);
    this.role = o.role; this.id = o.id;
    this.seed = o.seed;
    this.root = new THREE.Group();
    this.root.scale.setScalar(o.height);
    this.build();
    this.pose = zeroPose(); this.tmpA = zeroPose(); this.tmpB = zeroPose();
    this.base = 'idle'; this.prevBase = 'idle'; this.baseT = 1; this.baseDur = 0.4;
    this.phase = 0; this.walkAmp = 1;
    this.path = null; this.speed = 1.3; this.yaw = 0; this.targetYaw = null;
    this.gestures = [];
    this.look = null; this.lookYaw = 0; this.lookPitch = 0; this.lookW = 0;
    this.aim = null;
    this.time = Math.random() * 10;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  build() {
    const o = this.o, j = this.j = {};
    const skinC = new THREE.Color(o.skin);
    const skin = mat(o.skin, { rough: 0.52 });
    const lip = mat(skinC.clone().multiplyScalar(0.78).getHex(), { rough: 0.45 });
    const topCol = o.jacket ?? o.top;
    const top = mat(topCol, { rough: 0.82 });
    const shirt = mat(o.jacket ? C.white : topCol, { rough: 0.8 });
    const bottom = mat(o.bottom, { rough: 0.78 });
    const shoes = o.jacket ? mat(0x0b0b0d, { rough: 0.16, metal: 0.35 }) : mat(o.shoes, { rough: 0.32, metal: 0.15 }); // polished black with a suit
    const sole = mat(0x1a1a1a, { rough: 0.9 });
    const hairM = mat(o.hair, { rough: 0.85 });
    const eyeW = mat(0xf1f0ea, { rough: 0.25 }), iris = mat(o.eyes ?? 0x3b2a1e, { rough: 0.2 }), pupil = mat(0x050505, { rough: 0.1 });
    const add = (parent, g, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    const taper = (rt, rb, h, seg = 14) => geo(`tap${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1));
    const lathe = (key, pts, seg = 22) => geo(key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));

    // ---- hips / pelvis with belt ----
    const hips = j.hips = new THREE.Group(); hips.position.y = 0.94; this.root.add(hips);
    const pelvis = add(hips, lathe('pelvis', [[0.001, -0.1], [0.1, -0.085], [0.145, -0.03], [0.152, 0.03], [0.142, 0.08], [0.001, 0.08]]), bottom); pelvis.scale.set(1, 1, 0.7);
    if (!o.jacket) { // the jacket covers the belt
      const belt = add(hips, taper(0.146, 0.148, 0.04, 22), mat(0x1b1714, { rough: 0.5 }), 0, 0.06, 0); belt.scale.set(1, 1, 0.72);
      add(hips, geo('buckle', () => new THREE.BoxGeometry(0.04, 0.03, 0.01)), mat(0xb9c0c8, { rough: 0.2, metal: 0.9 }), 0, 0.06, 0.107);
    }
    // ---- torso: waist to chest, then chest to shoulders ----
    const spine = j.spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
    const waist = add(spine, lathe('waist', [[0.001, -0.02], [0.138, -0.02], [0.134, 0.06], [0.142, 0.16], [0.158, 0.25], [0.001, 0.25]]), top); waist.scale.set(1, 1, 0.66);
    const chest = j.chest = new THREE.Group(); chest.position.y = 0.24; spine.add(chest);
    const ribs = add(chest, lathe('ribs', [[0.001, -0.01], [0.158, -0.01], [0.17, 0.06], [0.172, 0.12], [0.158, 0.17], [0.11, 0.2], [0.055, 0.215], [0.001, 0.215]]), top); ribs.scale.set(1.06, 1, 0.68);
    // trapezius / shoulder line
    const traps = add(chest, capsule(0.056, 0.22), top, 0, 0.152, -0.012); traps.rotation.z = Math.PI / 2; traps.scale.set(1, 1, 0.85);
    if (o.jacket) {
      // tailored suit: white shirt V with collar, notched lapels, tie, two buttons, pocket square, jacket skirt
      const lapelM = mat(new THREE.Color(topCol).multiplyScalar(0.82).getHex(), { rough: 0.6, extra: { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 } });
      const shirtD = mat(C.white, { rough: 0.7, extra: { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 } });
      add(chest, geo('shirtVee', () => bodyPatch([[-0.062, 0.196], [0.062, 0.196], [0.0, -0.105]], 0.007)), shirtD, 0, 0, 0);
      for (const sx of [-1, 1]) {
        add(chest, geo('lapel' + sx, () => bodyPatch([[sx * 0.062, 0.2], [sx * 0.086, 0.205], [sx * 0.078, 0.158], [sx * 0.094, 0.165], [sx * 0.112, 0.112], [sx * 0.03, -0.075], [0, -0.108]], 0.01)), lapelM, 0, 0, 0);
        const col = add(chest, geo('scollar', () => new THREE.BoxGeometry(0.034, 0.022, 0.006)), shirtD, sx * 0.024, 0.192, surfZ(sx * 0.024, 0.192) + 0.01); col.rotation.set(-0.5, sx * 0.35, sx * 0.62);
      }
      if (o.tie) {
        const tie = add(chest, geo('tie2', () => { const sh = new THREE.Shape(); sh.moveTo(-0.011, 0.185); sh.lineTo(0.011, 0.185); sh.lineTo(0.021, -0.03); sh.lineTo(0, -0.058); sh.lineTo(-0.021, -0.03); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + surfZ(0, p.getY(i)) + 0.011); g.computeVertexNormals(); return g; }), mat(o.tieColor ?? C.red, { rough: 0.42, extra: { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 } }), 0, 0, 0);
        void tie; add(chest, sphere(0.014), mat(o.tieColor ?? C.red, { rough: 0.42 }), 0, 0.186, surfZ(0, 0.186) + 0.012).scale.set(1.1, 0.8, 0.7); // knot
      }
      // pocket square on the left breast
      const ps = add(chest, geo('psq', () => { const sh = new THREE.Shape(); sh.moveTo(-0.018, 0); sh.lineTo(0.018, 0); sh.lineTo(0.012, 0.016); sh.lineTo(0, 0.008); sh.lineTo(-0.01, 0.018); sh.closePath(); return new THREE.ShapeGeometry(sh); }), shirtD, 0.098, 0.088, surfZ(0.098, 0.088) + 0.006); ps.rotation.y = 0.35;
      add(chest, geo('pkt', () => new THREE.BoxGeometry(0.05, 0.004, 0.004)), lapelM, 0.098, 0.088, surfZ(0.098, 0.088) + 0.004).rotation.y = 0.35;
      // buttons below the V
      for (const yy of [-0.13, -0.19]) add(chest, sphere(0.0075), mat(0x111214, { rough: 0.25, metal: 0.2 }), 0.004, yy, surfZ(0, yy) + 0.006);
      // jacket skirt over the hips, open at the front
      const skirt = add(spine, geo('jskirt', () => new THREE.LatheGeometry([[0.172, -0.2], [0.166, -0.12], [0.152, -0.02], [0.142, 0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 28, 0.32, Math.PI * 2 - 0.64)), mat(topCol, { rough: 0.82, extra: { side: THREE.DoubleSide } }), 0, 0, 0); skirt.scale.set(1.02, 1, 0.74);
      for (const sx of [-1, 1]) { const fl = add(spine, geo('flap', () => new THREE.BoxGeometry(0.075, 0.018, 0.006)), lapelM, sx * 0.1, -0.06, 0.094); fl.rotation.y = sx * 0.62; }
      traps.scale.set(1.06, 1, 0.88);
    } else {
      // shirt collar and placket
      for (const sx of [-1, 1]) { const c = add(chest, geo('collar', () => new THREE.BoxGeometry(0.06, 0.03, 0.05)), shirt, sx * 0.04, 0.205, 0.04); c.rotation.set(-0.5, sx * 0.5, sx * -0.35); }
      add(chest, geo('placket', () => new THREE.BoxGeometry(0.016, 0.16, 0.004)), mat(new THREE.Color(topCol).multiplyScalar(0.85).getHex(), { rough: 0.8 }), 0, 0.1, 0.118).rotation.x = -0.12;
      for (const yy of [0.06, 0.13]) add(chest, sphere(0.006), mat(0xdfe3e8, { rough: 0.3 }), 0, yy, 0.12);
    }
    if (o.lanyard && !o.jacket) {
      const lan = add(chest, geo('lan', () => new THREE.TorusGeometry(0.1, 0.006, 6, 24, Math.PI)), mat(C.red, { rough: 0.6 }), 0, 0.07, 0.1);
      lan.rotation.z = Math.PI; lan.rotation.x = -0.18; lan.scale.set(0.62, 1, 1);
      add(chest, geo('badge', () => new THREE.BoxGeometry(0.055, 0.075, 0.006)), mat(C.white, { rough: 0.4 }), 0, -0.035, 0.118);
    }
    if (o.vest) {
      const vest = add(spine, lathe('vest', [[0.001, 0.0], [0.147, 0.0], [0.15, 0.12], [0.168, 0.26], [0.178, 0.34], [0.16, 0.42], [0.001, 0.42]]), mat(0x1c2027, { rough: 0.7 }), 0, 0.02, 0); vest.scale.set(1.04, 1, 0.71);
      for (const yy of [0.1, 0.3]) { const band = add(spine, taper(0.17, 0.164, 0.03, 24), glow(0xd8dde3, 1.15), 0, yy, 0); band.scale.set(1.05, 1, 0.72); }
    }
    // ---- neck and head ----
    const neck = j.neck = new THREE.Group(); neck.position.y = 0.21; chest.add(neck);
    // shorter neck for the business cast; a shirt collar band wraps it
    if (o.realFace) add(neck, taper(0.049, 0.055, 0.08), skin, 0, 0.012, 0.005); else add(neck, taper(0.047, 0.054, 0.12), skin, 0, 0.03, 0.005);
    const head = j.head = new THREE.Group(); head.position.y = o.realFace ? 0.045 : 0.08; neck.add(head);
    if (o.realFace && o.jacket) { const band = add(neck, taper(0.058, 0.064, 0.04, 20), mat(C.white, { rough: 0.7 }), 0, -0.012, 0.004); band.scale.set(1, 1, 0.95); }
    if (o.realFace) {
      // sculpted head with a painted skin texture (brows, lips, stubble, soft shading)
      const HC = new THREE.Vector3(0, 0.094, 0.006);
      add(head, sculptedHead(), faceMaterial(o), HC.x, HC.y, HC.z);
      for (const sx of [-1, 1]) {
        const ear = add(head, sphere(0.021), skin, sx * 0.085, 0.094, -0.006); ear.scale.set(0.42, 1.25, 0.8);
        // eyes set into the sockets
        const c = headPoint(sx * 0.33, 0.14).multiplyScalar(0.935).add(HC);
        const dir = new THREE.Vector3(sx * 0.12, 0.02, 1).normalize();
        const ew = add(head, sphere(0.0128), eyeW, c.x, c.y, c.z); ew.scale.set(1.12, 0.82, 0.9);
        const ir = add(head, sphere(0.0068), iris, c.x + dir.x * 0.0105, c.y + dir.y * 0.0105, c.z + dir.z * 0.0105); ir.scale.set(1, 1, 0.45);
        const pu = add(head, sphere(0.0034), pupil, c.x + dir.x * 0.0118, c.y + dir.y * 0.0118, c.z + dir.z * 0.0118); pu.scale.set(1, 1, 0.4);
        const lid = add(head, sphere(0.0138), skin, c.x, c.y + 0.0072, c.z - 0.0006); lid.scale.set(1.14, 0.42, 0.95);
        const lidL = add(head, sphere(0.0132), skin, c.x, c.y - 0.0072, c.z - 0.0008); lidL.scale.set(1.1, 0.3, 0.92);
      }
    } else {
      const skull = add(head, sphere(0.1), skin, 0, 0.12, 0); skull.scale.set(0.9, 1.08, 1.0);
      const jaw = add(head, sphere(0.078), skin, 0, 0.06, 0.022); jaw.scale.set(0.98, 0.82, 0.98);
      const chin = add(head, sphere(0.03), skin, 0, 0.03, 0.074); chin.scale.set(1.2, 0.8, 0.8);
      for (const sx of [-1, 1]) {
        const cheek = add(head, sphere(0.034), skin, sx * 0.048, 0.085, 0.066); cheek.scale.set(1, 0.9, 0.7);
        const ear = add(head, sphere(0.022), skin, sx * 0.09, 0.11, -0.005); ear.scale.set(0.45, 1.25, 0.85);
        // eyes: white, iris, pupil
        const ex = sx * 0.033;
        const ew = add(head, sphere(0.0155), eyeW, ex, 0.123, 0.081); ew.scale.set(1.15, 0.85, 0.75);
        add(head, sphere(0.0085), iris, ex, 0.123, 0.0915);
        add(head, sphere(0.0042), pupil, ex, 0.123, 0.0965);
        const lid = add(head, sphere(0.0165), skin, ex, 0.128, 0.079); lid.scale.set(1.18, 0.5, 0.8); // upper eyelid
        const brow = add(head, geo('brow', () => new RoundedBoxGeometry(0.034, 0.008, 0.01, 1, 0.003)), hairM, ex, 0.146, 0.091); brow.rotation.z = -sx * 0.12;
      }
      const nose = add(head, geo('nose', () => { const g = new THREE.ConeGeometry(0.016, 0.05, 4); g.rotateX(-Math.PI / 2 + 0.35); return g; }), skin, 0, 0.1, 0.098);
      nose.rotation.z = Math.PI / 4;
      add(head, sphere(0.011), skin, 0, 0.088, 0.105).scale.set(1.25, 0.8, 0.9); // nose tip
      const mouth = add(head, geo('lips', () => new RoundedBoxGeometry(0.036, 0.009, 0.01, 1, 0.004)), lip, 0, 0.061, 0.095); mouth.rotation.x = -0.1;
      const lower = add(head, geo('lipL', () => new RoundedBoxGeometry(0.03, 0.007, 0.01, 1, 0.003)), lip, 0, 0.053, 0.093); lower.rotation.x = -0.2;
      if (o.beard) { const bd = add(head, sphere(0.08), hairM, 0, 0.055, 0.02); bd.scale.set(1.0, 0.75, 0.98); }
    }
    const hy = o.realFace ? -0.02 : 0, hk = o.realFace ? 0.95 : 1; // hair follows the sculpted head
    if (o.hairStyle !== 'bald' && !o.hardhat) {
      const cap = add(head, geo('hairCap', () => new THREE.SphereGeometry(0.104, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairM, 0, 0.13 + hy, -0.008);
      cap.scale.set(0.95 * hk, 1.0 * hk, 1.06 * hk); cap.rotation.x = -0.28;
      const back = add(head, sphere(0.098), hairM, 0, 0.115 + hy, -0.03); back.scale.set(0.93 * hk, 0.98 * hk, 0.9 * hk);
      for (const sx of [-1, 1]) { const side = add(head, sphere(0.04), hairM, sx * 0.083 * hk, 0.135 + hy, -0.01); side.scale.set(0.5, 1.0, 1.3); }
      if (o.hairStyle === 'full') { const top = add(head, sphere(0.06), hairM, 0, 0.19 + hy, 0.02); top.scale.set(1.45 * hk, 0.55, 1.5 * hk); }
      if (o.hairStyle === 'short') { const quiff = add(head, sphere(0.05), hairM, 0.02, 0.2 + hy, 0.05); quiff.scale.set(1.4, 0.45, 0.9); }
      if (o.hairStyle === 'long') {
        add(head, geo('hairLong', () => new RoundedBoxGeometry(0.2, 0.3, 0.07, 3, 0.03)), hairM, 0, 0.02, -0.07);
        for (const sx of [-1, 1]) { const st = add(head, geo('strand', () => new RoundedBoxGeometry(0.035, 0.22, 0.06, 2, 0.015)), hairM, sx * 0.088, 0.05, -0.005); st.rotation.z = sx * 0.06; }
      }
      if (o.hairStyle === 'bun') add(head, sphere(0.048), hairM, 0, 0.19, -0.085);
    } else if (o.hairStyle === 'bald' && !o.hardhat) {
      const ring = add(head, sphere(0.099), hairM, 0, 0.1 + hy, -0.022); ring.scale.set(0.95 * hk, 0.6 * hk, 0.92 * hk); // short sides
    }
    if (o.hardhat) {
      const hh = mat(o.hardhatColor ?? C.white, { rough: 0.3 });
      const dome = add(head, geo('hhDome', () => new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hh, 0, 0.16, 0); dome.scale.set(1, 1.05, 1.12);
      const brim = add(head, geo('hhBrim', () => new THREE.CylinderGeometry(0.132, 0.136, 0.012, 24)), hh, 0, 0.16, 0.022); brim.scale.set(1, 1, 1.2);
      add(head, geo('hhRidge', () => new THREE.BoxGeometry(0.022, 0.014, 0.25)), hh, 0, 0.283, 0);
      const hairB = add(head, sphere(0.096), hairM, 0, 0.11, -0.035); hairB.scale.set(0.93, 0.85, 0.85);
    }
    if (o.glasses) {
      const gm = mat(0x0b0c0f, { rough: 0.3, metal: 0.6 });
      for (const sx of [0.034, -0.034]) add(head, geo('lens', () => new THREE.TorusGeometry(0.019, 0.003, 6, 20)), gm, sx, 0.123, 0.101);
      add(head, geo('bridge', () => new THREE.BoxGeometry(0.03, 0.004, 0.004)), gm, 0, 0.126, 0.103);
      for (const sx of [-1, 1]) add(head, geo('temple', () => new THREE.BoxGeometry(0.003, 0.004, 0.09)), gm, sx * 0.053, 0.125, 0.06);
    }
    // ---- arms ----
    const longSleeve = o.sleeves === 'long' || !!o.jacket;
    const arm = (side) => {
      const sx = side === 'l' ? 1 : -1;
      const shJ = j[side + 'Sh'] = new THREE.Group(); shJ.position.set(0.19 * sx, 0.15, 0); chest.add(shJ);
      const delt = add(shJ, sphere(0.054), top, -0.006 * sx, -0.012, 0); delt.scale.set(0.95, 1.1, 0.95);
      // upper arm: sleeve over the top, skin below for short sleeves
      if (longSleeve) add(shJ, taper(0.05, 0.044, 0.28), top, 0, -0.14, 0);
      else { add(shJ, taper(0.053, 0.05, 0.15), top, 0, -0.07, 0); add(shJ, taper(0.047, 0.042, 0.16), skin, 0, -0.2, 0); }
      const el = j[side + 'El'] = new THREE.Group(); el.position.y = -0.29; shJ.add(el);
      add(el, sphere(0.044), longSleeve ? top : skin, 0, 0, 0);
      add(el, taper(0.043, 0.034, 0.24), longSleeve ? top : skin, 0, -0.12, 0);
      if (longSleeve) add(el, taper(0.037, 0.037, 0.03), o.jacket ? shirt : top, 0, -0.235, 0);
      // hand: palm faces the body (x axis), thumb forward (+z)
      const hand = new THREE.Group(); hand.position.y = -0.255; el.add(hand);
      add(hand, sphere(0.03), skin, 0, -0.0, 0).scale.set(0.9, 0.7, 1.1); // wrist
      add(hand, geo('palm', () => new RoundedBoxGeometry(0.03, 0.085, 0.074, 2, 0.012)), skin, 0, -0.045, 0);
      for (let f = 0; f < 4; f++) {
        const fz = -0.026 + f * 0.0175, len = [0.042, 0.05, 0.047, 0.038][f];
        const fg = add(hand, capsule(0.0085, len), skin, -sx * 0.002, -0.1 - len * 0.35, fz);
        fg.rotation.x = 0.0; fg.rotation.z = sx * 0.18; // slight curl toward the palm
      }
      const th = add(hand, capsule(0.01, 0.035), skin, -sx * 0.006, -0.04, 0.04); th.rotation.set(-0.7, 0, sx * 0.25);
      j[side + 'Hand'] = hand;
    };
    arm('l'); arm('r');
    // ---- legs ----
    const leg = (side) => {
      const sx = side === 'l' ? 1 : -1;
      const hp = j[side + 'Hip'] = new THREE.Group(); hp.position.set(0.085 * sx, -0.04, 0); hips.add(hp);
      add(hp, sphere(0.078), bottom, 0, 0.0, 0).scale.set(1, 0.9, 0.95);
      add(hp, taper(0.077, 0.058, 0.43, 16), bottom, 0, -0.215, 0);
      const kn = j[side + 'Knee'] = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
      add(kn, sphere(0.058), bottom, 0, 0, 0.004);
      add(kn, taper(0.057, 0.046, 0.38, 16), bottom, 0, -0.19, 0);
      add(kn, taper(0.05, 0.052, 0.05, 16), bottom, 0, -0.37, 0); // trouser hem
      add(kn, geo('shoe', () => new RoundedBoxGeometry(0.098, 0.075, 0.255, 3, 0.03)), shoes, 0, -0.418, 0.045);
      add(kn, geo('sole', () => new RoundedBoxGeometry(0.104, 0.022, 0.262, 2, 0.008)), sole, 0, -0.452, 0.045);
    };
    leg('l'); leg('r');
    // merge the static parts of each joint by material: far fewer draw calls per person
    for (const g of [this.root, hips, spine, chest, neck, head, j.lSh, j.lEl, j.lHand, j.rSh, j.rEl, j.rHand, j.lHip, j.lKnee, j.rHip, j.rKnee]) mergeChildren(g);
    this.root.traverse(m => { if (m.isMesh) { m.userData.character = this; m.castShadow = true; m.receiveShadow = false; } });
  }

  // ----- realistic model (GLB, Mixamo-style skeleton) driven by this rig -----
  // The procedural rig keeps doing all the animation; its joints are copied onto the model's bones
  // as world-space rotation deltas, so any Mixamo-compatible character works without its own clips.
  attachModel(model, clips = []) {
    const bones = {};
    model.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/i, '').replace(/^.*[:|]/, '')] = o; });
    const need = ['Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
    if (need.some(n => !bones[n])) { console.warn('Model skipped: missing bones', need.filter(n => !bones[n])); return false; }
    const holder = new THREE.Group(); holder.add(model);
    model.updateMatrixWorld(true);
    // scale to this character's height, feet on the ground
    const wp = n => bones[n] ? bones[n].getWorldPosition(new THREE.Vector3()) : null;
    const top = wp('HeadTop_End') || wp('Head').add(new THREE.Vector3(0, 0.18 * (wp('Head').y - wp('Hips').y) / 0.62, 0));
    const feet = Math.min(...['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map(wp).filter(Boolean).map(v => v.y));
    const k = 1.76 / (top.y - feet + 0.04);
    model.scale.multiplyScalar(k); model.position.y -= (feet - 0.03) * k;
    model.updateMatrixWorld(true);
    // bring the bind pose (usually a T-pose) to the rig's rest pose: arms and legs straight down
    const align = (b, c, dir) => {
      if (!bones[b] || !bones[c]) return;
      const bw = bones[b].getWorldPosition(new THREE.Vector3()), cw = bones[c].getWorldPosition(new THREE.Vector3());
      const q = new THREE.Quaternion().setFromUnitVectors(cw.sub(bw).normalize(), dir.clone().normalize());
      const wq = bones[b].getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
      const pq = bones[b].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      bones[b].quaternion.copy(pq.multiply(wq)); bones[b].updateMatrixWorld(true);
    };
    const down = new THREE.Vector3(0, -1, 0);
    align('LeftArm', 'LeftForeArm', new THREE.Vector3(0.12, -1, 0)); align('LeftForeArm', 'LeftHand', new THREE.Vector3(0.08, -1, 0.04));
    align('RightArm', 'RightForeArm', new THREE.Vector3(-0.12, -1, 0)); align('RightForeArm', 'RightHand', new THREE.Vector3(-0.08, -1, 0.04));
    align('LeftUpLeg', 'LeftLeg', down); align('LeftLeg', 'LeftFoot', down);
    align('RightUpLeg', 'RightLeg', down); align('RightLeg', 'RightFoot', down);
    // map rig joints to bones; spine is shared over Spine and Spine1, chest drives Spine2
    const map = [['hips', 'Hips'], ['spine', 'Spine'], ['chest', bones.Spine2 ? 'Spine2' : bones.Spine1 ? 'Spine1' : 'Spine'], ['neck', 'Neck'], ['head', 'Head'],
      ['lSh', 'LeftArm'], ['lEl', 'LeftForeArm'], ['rSh', 'RightArm'], ['rEl', 'RightForeArm'],
      ['lHip', 'LeftUpLeg'], ['lKnee', 'LeftLeg'], ['rHip', 'RightUpLeg'], ['rKnee', 'RightLeg']]
      .filter(([, b], i, arr) => arr.findIndex(x => x[1] === b) === i);
    this.root.add(holder); this.root.updateMatrixWorld(true);
    const rootInv = new THREE.Quaternion();
    this.root.getWorldQuaternion(rootInv).invert();
    const rel = o => o.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootInv);
    const order = [];
    model.traverse(o => { if (o.isBone && map.some(([, b]) => bones[b] === o)) order.push(o); }); // parents before children
    this.retarget = {
      holder, bones,
      list: order.map(bone => { const key = map.find(([, b]) => bones[b] === bone)[0]; return { bone, key, joint: this.j[key], rest: rel(bone) }; }),
      hips: bones.Hips, hipsRest: bones.Hips.position.clone(), hipsRestWorld: bones.Hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(this.root.matrixWorld).invert()),
      tq: new THREE.Quaternion(), pq: new THREE.Quaternion(), ri: new THREE.Quaternion(), v: new THREE.Vector3(),
    };
    // the model's own walk / idle clips, if it has them (in place: forward root motion removed)
    const find = re => clips.find(c => re.test(c.name));
    const walkClip = find(/walk/i), idleClip = find(/idle|stand|breath/i);
    if (walkClip || idleClip) {
      const mixer = new THREE.AnimationMixer(model);
      const inPlace = clip => { const c = clip.clone(); for (const t of c.tracks) if (/hips\.position$/i.test(t.name)) { for (let i = 0; i < t.values.length; i += 3) { t.values[i] = t.values[0]; t.values[i + 2] = t.values[2]; } } return c; };
      const walk = walkClip ? mixer.clipAction(inPlace(walkClip)) : null, idle = idleClip ? mixer.clipAction(inPlace(idleClip)) : null;
      [walk, idle].forEach(a => a && (a.play(), a.setEffectiveWeight(0)));
      this.retarget.clip = { mixer, walk, idle, w: 0 };
    }
    // hide the procedural body; keep its joints as the animation source
    for (const g of Object.values(this.j)) for (const c of g.children) if (c.isMesh) c.visible = false;
    for (const c of this.root.children) if (c.isMesh) c.visible = false;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.2); }); } } });
    return true;
  }
  applyRetarget(dt = 0) {
    const R = this.retarget; if (!R) return;
    let blend = null; // per-joint weight of the rig over the model's own clips
    if (R.clip) {
      const C = R.clip, walking = this.base === 'walk' && !!C.walk;
      C.w = damp(C.w, walking ? 1 : 0, 6, dt);
      if (C.walk) { C.walk.setEffectiveWeight(C.idle ? C.w : 1); C.walk.timeScale = Math.max(0.5, this.speed / 1.3); }
      if (C.idle) C.idle.setEffectiveWeight(1 - (C.walk ? C.w : 0));
      C.mixer.update(dt);
      // clips play the body; gestures, pointing and head turns from the rig blend on top
      const gw = this.gestures.reduce((m, g) => g.def.additive ? m : Math.max(m, g.w || 0), 0);
      const clipCovers = (walking && C.walk) || (!walking && C.idle);
      if (clipCovers && this.base !== 'sit' && this.base !== 'work') {
        const arm = Math.max(gw, this.aim ? this.aim.g.w : 0), head = Math.max(this.lookW, gw * 0.6);
        blend = { hips: 0, spine: gw * 0.6, chest: gw * 0.7, neck: head, head, lSh: arm, lEl: arm, rSh: arm, rEl: arm, lHip: 0, lKnee: 0, rHip: 0, rKnee: 0 };
      }
    }
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(R.ri).invert();
    // hips height and sway follow the rig
    const hipOff = R.v.set(0, this.pose.hipY, this.pose.hipZ);
    const wpos = R.hipsRestWorld.clone().add(hipOff).applyMatrix4(this.root.matrixWorld);
    R.hips.parent.updateMatrixWorld(true);
    if (!blend) R.hips.position.copy(R.hips.parent.worldToLocal(wpos));
    for (const e of R.list) {
      // target rotation relative to the character root = joint delta * bone rest
      e.joint.getWorldQuaternion(R.tq).premultiply(R.ri).multiply(e.rest);
      e.bone.parent.getWorldQuaternion(R.pq).premultiply(R.ri).invert();
      const w = blend ? (blend[e.key] ?? 0) : 1;
      if (w > 0.001) { R.pq.multiply(R.tq); if (w >= 0.999) e.bone.quaternion.copy(R.pq); else e.bone.quaternion.slerp(R.pq, w); }
      e.bone.updateMatrixWorld(true);
    }
  }

  // ----- control API -----
  setBase(name, dur = 0.4) {
    if (name === this.base) return;
    if (!this.blendFrom) this.blendFrom = zeroPose();
    copyPose(this.blendFrom, this.pose); // blend from whatever we currently show
    this.prevBase = this.base; this.base = name; this.baseT = 0; this.baseDur = dur;
  }
  place(x, z, yaw = 0, base = 'idle') {
    this.root.position.set(x, 0, z); this.yaw = yaw; this.root.rotation.y = yaw; this.targetYaw = null;
    this.path = null; this.onArrive = null; this.gestures.length = 0; this.aim = null; this.look = null; this.lookW = 0;
    this.base = base; this.prevBase = base; this.baseT = 1;
  }
  walkTo(points, { speed = 1.3, faceYaw = null, onArrive = null } = {}) {
    this.path = points.map(p => p.isVector3 ? p.clone() : new THREE.Vector3(p[0], 0, p[1]));
    this.speed = speed; this.endYaw = faceYaw; this.onArrive = onArrive; this.walkT = 0;
    this.setBase('walk', 0.25);
  }
  faceYaw(yaw) { this.targetYaw = yaw; }
  faceTo(target) { const p = target.isVector3 ? target : target.root.position; this.targetYaw = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z); }
  lookAt(target) { this.look = target; }
  gesture(name, dur = 2, params = {}) {
    const def = GESTURES[name]; if (!def) return;
    this.gestures = this.gestures.filter(g => g.name !== name);
    const g = { name, def, t: 0, dur, params, fi: def.fadeIn ?? 0.35, fo: def.fadeOut ?? 0.4 };
    this.gestures.push(g);
    if (name === 'point') this.aim = { target: params.target, g };
    return g;
  }
  endGesture(name) { for (const g of this.gestures) if (g.name === name || !name) g.dur = Math.min(g.dur, g.t + g.fo); }
  headWorld(out = new THREE.Vector3()) { return out.copy(this.root.position).setY((this.base === 'sit' ? 1.45 : 1.98) * this.o.height); }

  update(dt) {
    this.time += dt; const t = this.time;
    // --- locomotion ---
    if (this.path && this.path.length) {
      this.walkT += dt;
      const pos = this.root.position, tgt = this.path[0];
      const dx = tgt.x - pos.x, dz = tgt.z - pos.z, dist = Math.hypot(dx, dz);
      let f = Math.min(1, this.walkT / 0.45);
      if (this.path.length === 1) f *= clamp(dist / 0.7, 0.3, 1);
      this.walkAmp = damp(this.walkAmp, 0.55 + 0.45 * f, 8, dt);
      const step = this.speed * f * dt;
      if (dist <= step || dist < 0.02) {
        pos.x = tgt.x; pos.z = tgt.z; this.path.shift();
        if (!this.path.length) {
          this.path = null; this.setBase('idle', 0.35);
          if (this.endYaw !== null && this.endYaw !== undefined) this.targetYaw = this.endYaw;
          const cb = this.onArrive; this.onArrive = null; if (cb) cb();
        }
      } else {
        pos.x += dx / dist * step; pos.z += dz / dist * step;
        this.phase += step / STRIDE * Math.PI * 2;
        this.targetYaw = Math.atan2(dx, dz);
      }
    }
    if (this.targetYaw !== null) {
      this.yaw = angleLerp(this.yaw, this.targetYaw, 1 - Math.exp(-(this.path ? 7 : 4.5) * dt));
      this.root.rotation.y = this.yaw;
    }
    // --- base pose with cross-fade ---
    const cur = BASE[this.base](this, t);
    if (this.baseT < 1 && this.blendFrom) {
      this.baseT = Math.min(1, this.baseT + dt / this.baseDur);
      copyPose(this.pose, this.blendFrom);
      blendInto(this.pose, cur, smooth(this.baseT), false);
    } else { copyPose(this.pose, ZERO); blendInto(this.pose, cur, 1, false); }
    // --- gestures ---
    for (let i = this.gestures.length - 1; i >= 0; i--) {
      const g = this.gestures[i]; g.t += dt;
      if (g.t >= g.dur) { this.gestures.splice(i, 1); if (this.aim && this.aim.g === g) this.aim = null; continue; }
      const w = smooth(clamp(g.t / g.fi, 0, 1)) * smooth(clamp((g.dur - g.t) / g.fo, 0, 1));
      g.w = w;
      blendInto(this.pose, g.def.fn(g.t, g.params, this), w, !!g.def.additive);
    }
    // --- apply ---
    const p = this.pose, j = this.j;
    j.hips.position.y = 0.94 + p.hipY; j.hips.position.z = p.hipZ;
    for (const k of JOINTS) { const r = p[k]; j[k].rotation.set(r[0], r[1], r[2]); }
    // --- head look ---
    let wantYaw = 0, wantPitch = 0, wantW = 0;
    if (this.look) {
      const tp = this.look.isVector3 ? this._v.copy(this.look) : this.look.headWorld(this._v).add(new THREE.Vector3(0, -0.28 * this.look.o.height, 0));
      const local = this.root.worldToLocal(tp.clone());
      const neckY = (this.base === 'sit' ? 1.05 : 1.5);
      const dy = local.y - neckY, hz = Math.hypot(local.x, local.z);
      wantYaw = clamp(Math.atan2(local.x, local.z), -1.45, 1.45);
      wantPitch = clamp(-Math.atan2(dy, hz), -0.5, 0.55);
      wantW = 1;
    }
    this.lookW = damp(this.lookW, wantW, 4, dt);
    this.lookYaw = damp(this.lookYaw, wantYaw, 5, dt);
    this.lookPitch = damp(this.lookPitch, wantPitch, 5, dt);
    if (this.lookW > 0.001) {
      const ly = this.lookYaw * this.lookW, lp = this.lookPitch * this.lookW;
      const chestYaw = clamp(ly * 0.28, -0.35, 0.35);
      j.chest.rotation.y += chestYaw; const rem = ly - chestYaw;
      j.neck.rotation.y += rem * 0.4; j.head.rotation.y += rem * 0.6;
      j.neck.rotation.x += lp * 0.35; j.head.rotation.x += lp * 0.65;
    }
    // --- arm aim (pointing) ---
    if (this.aim && this.aim.g.w > 0.001) {
      const tgt = this.aim.target.isVector3 ? this.aim.target : this.aim.target.headWorld(new THREE.Vector3());
      this.root.updateMatrixWorld(true);
      const shJ = j.rSh;
      const local = shJ.parent.worldToLocal(tgt.clone()).sub(shJ.position).normalize();
      this._q.setFromUnitVectors(DOWN, local);
      shJ.quaternion.slerp(this._q, this.aim.g.w);
      j.rEl.rotation.x = lerp(j.rEl.rotation.x, -0.08, this.aim.g.w);
      j.rEl.rotation.z = lerp(j.rEl.rotation.z, 0, this.aim.g.w);
    }
    if (this.retarget) this.applyRetarget(dt);
  }
}

// Merge a group's direct mesh children that share a material into one mesh (transforms baked in).
function mergeChildren(group) {
  const byMat = new Map();
  for (const c of group.children) if (c.isMesh) { if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(c); }
  for (const [m, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = meshes.map(mesh => {
      mesh.updateMatrix();
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {}; g.clearGroups();
      return g.applyMatrix4(mesh.matrix);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    meshes.forEach(mesh => group.remove(mesh));
    group.add(new THREE.Mesh(merged, m));
  }
}

// ---------- Cast definitions ----------
export function makeCast(data) {
  const roles = Object.fromEntries((data.cast || []).map(c => [c.id, c.role]));
  // All men, business dress as in the reference: suits and ties, Indian skin tones
  const defs = [
    { realFace: true, id: 'ph', height: 1.03, skin: 0xF0C8A6, hair: 0x111111, hairStyle: 'full', jacket: 0x2b2e33, bottom: 0x2b2e33, shoes: 0x1a1412, tie: true, tieColor: 0x8b1c2b, glasses: false, lanyard: false, sleeves: 'long' },
    { realFace: true, id: 'bps', height: 1.0, skin: 0xF3CDAE, hair: 0x111111, hairStyle: 'full', jacket: 0x1c2536, bottom: 0x1c2536, shoes: 0x1a1412, tie: true, tieColor: 0x7c1a28, lanyard: false, sleeves: 'long' },
    { realFace: true, id: 'prod', height: 1.01, skin: 0xEDC3A0, hair: 0x111111, hairStyle: 'full', jacket: 0x33373d, bottom: 0x33373d, shoes: 0x1a1412, tie: true, tieColor: 0x2c3a52, lanyard: false, sleeves: 'long' },
    { realFace: true, id: 'qual', height: 0.99, skin: 0xF2CBA9, hair: 0x111111, hairStyle: 'full', jacket: 0x24304a, bottom: 0x24304a, shoes: 0x1a1412, tie: true, tieColor: 0x6b6f78, glasses: true, lanyard: false, sleeves: 'long' },
    { realFace: true, id: 'dig', height: 1.02, skin: 0xF0C6A3, hair: 0x111111, hairStyle: 'full', jacket: 0x3b3f46, bottom: 0x3b3f46, shoes: 0x2a1a12, tie: true, tieColor: 0x1f3a5f, lanyard: false, sleeves: 'long' },
    { realFace: true, id: 'log', height: 1.0, skin: 0xEEC5A2, hair: 0x111111, hairStyle: 'full', jacket: 0x1f2633, bottom: 0x1f2633, shoes: 0x1a1412, tie: true, tieColor: 0x5e1a24, lanyard: false, sleeves: 'long' },
  ];
  const cast = {};
  defs.forEach((d, i) => { cast[d.id] = new Character({ ...d, role: roles[d.id] || d.id, seed: i * 1.7 + 0.3 }); });
  return cast;
}
export function makeOperator(i) {
  const skins = [0xB07A58, 0x8D5B3F, 0xC08A68, 0x9A6A4E, 0xA87554, 0xB98466, 0x7E5238];
  const hair = [0x15110e, 0x1a1512, 0x2b1d14, 0x0f0c0a];
  // ESD workwear: blue smock on the assembly lines, grey on machining
  const tops = [0x3D5F8C, 0x3D5F8C, 0x55606e];
  return new Character({ id: 'op' + i, role: 'Operator', height: 0.97 + (i % 3) * 0.025, skin: skins[i % skins.length], hair: hair[i % hair.length], top: tops[i % tops.length], bottom: 0x23272e, sleeves: 'long', vest: false, hardhat: false, glasses: i % 2 === 0, lanyard: true, hairStyle: i % 4 === 3 ? 'bald' : 'short', beard: i % 3 === 1, seed: 20 + i * 2.3 });
}
