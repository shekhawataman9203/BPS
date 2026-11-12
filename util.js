import { THREE } from './lib.js';

// Bosch-inspired palette: one red, graphite darks, signal white.
export const C = {
  red: 0xE20015,
  redHot: 0xff1f33,
  redDeep: 0x8a000d,
  graphite: 0x12161C,
  graphite2: 0x1A1F27,
  steel: 0x2B323C,
  steelLight: 0x56606D,
  aluminium: 0xB9C0C8,
  grey: 0x9AA3AE,
  white: 0xF4F6F8,
  ink: 0x0A0D12,
};
export const CSS = {
  red: '#E20015', redDeep: '#8a000d', graphite: '#12161C', steel: '#2B323C', grey: '#9AA3AE', white: '#F4F6F8', ink: '#0A0D12',
};
export const FONT = `"Archivo", "Helvetica Neue", Arial, sans-serif`;

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0.0, ...(opts.extra || {}) });
  if (opts.emissive !== undefined) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei ?? 1; }
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 0.5; m.depthWrite = opts.depthWrite ?? false; }
  if (opts.side) m.side = opts.side;
  matCache.set(key, m);
  return m;
}
export function glow(color, intensity = 2.2) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

export function box(w, h, d, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, material, seg = 20, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  if (parent) parent.add(m);
  return m;
}
export function shadows(obj, cast = true, receive = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// Canvas texture with a draw callback that can be re-run.
export class CanvasTex {
  constructor(w, h, draw) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.draw = draw;
    if (draw) this.redraw();
  }
  redraw(...args) { if (this.draw) this.draw(this.ctx, this.canvas.width, this.canvas.height, ...args); this.tex.needsUpdate = true; }
}

export function fitText(ctx, text, maxW, size, weight = 700, stretch = '') {
  let s = size;
  do { ctx.font = `${stretch} ${weight} ${s}px ${FONT}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 8);
  return s + 2;
}

// Easing
export const ease = {
  linear: t => t,
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function fmt(v, decimals = 0) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Simple tween list driven by the main loop (game time, so pausing works).
export class Tweens {
  constructor() { this.list = []; }
  add(dur, onUpdate, easing = ease.inOut, delay = 0) {
    return new Promise(res => this.list.push({ t: -delay, dur, onUpdate, easing, res }));
  }
  clear() { this.list.length = 0; }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = clamp(tw.t / tw.dur, 0, 1);
      tw.onUpdate(tw.easing(k), k);
      if (k >= 1) { this.list.splice(i, 1); tw.res(); }
    }
  }
}

// Label sprite-like plane drawn from canvas (always faces camera if billboard).
export function textPlane(text, { w = 2, h = 0.5, size = 96, color = '#F4F6F8', bg = null, weight = 800, align = 'center', stretch = '' } = {}) {
  const pxW = 1024, pxH = Math.round(1024 * h / w);
  const ct = new CanvasTex(pxW, pxH, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
    const s = fitText(ctx, text, W * 0.92, size, weight, stretch);
    ctx.font = `${stretch} ${weight} ${s}px ${FONT}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(text, align === 'center' ? W / 2 : W * 0.04, H / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.userData.ct = ct;
  return m;
}
