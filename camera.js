import { THREE } from './lib.js';
import { V, ease, damp, clamp } from './util.js';

export class CameraRig {
  constructor(camera, dom) {
    this.cam = camera;
    this.pos = camera.position.clone();
    this.tgt = V(0, 1, 0);
    this.fov = camera.fov;
    this.tw = null; this.fol = null; this.orb = null;
    this.par = { x: 0, y: 0, cx: 0, cy: 0 };
    this.drift = 1; this.enabled = true;
    this.shake = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) this.drift = 0;
    dom.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { this.par.x = (e.clientX / innerWidth - 0.5) * 2; this.par.y = (e.clientY / innerHeight - 0.5) * 2; } });
    this._r = V(); this._u = V(); this._f = V();
  }
  stop() { this.tw = null; this.fol = null; this.orb = null; }
  cut(s) { this.stop(); this.pos.set(...s.pos); this.tgt.set(...s.target); if (s.fov) this.fov = s.fov; }
  moveTo(s, dur = 3, { arc = 0.12, easing = ease.inOut } = {}) {
    this.fol = null; this.orb = null;
    const p0 = this.pos.clone(), t0 = this.tgt.clone(), p1 = V(...s.pos), t1 = V(...s.target);
    const mid = p0.clone().lerp(p1, 0.5); mid.y += p0.distanceTo(p1) * arc;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    const f0 = this.fov, f1 = s.fov || this.fov;
    return new Promise(res => { this.tw = { t: 0, dur, curve, t0, t1, f0, f1, easing, res }; });
  }
  follow(target, { offset = [0, 2, 4], look = [0, 1.2, 0], lag = 2.2 } = {}) { this.tw = null; this.orb = null; this.fol = { target, offset: V(...offset), look: V(...look), lag }; }
  orbit(center, radius, height, speed = 0.05, start = 0) { this.tw = null; this.fol = null; this.orb = { c: V(...center), r: radius, h: height, s: speed, a: start }; }
  update(dt, t) {
    if (this.tw) {
      const w = this.tw; w.t += dt; const k = clamp(w.t / w.dur, 0, 1), e = w.easing(k);
      w.curve.getPoint(e, this.pos); this.tgt.copy(w.t0).lerp(w.t1, e); this.fov = w.f0 + (w.f1 - w.f0) * e;
      if (k >= 1) { this.tw = null; w.res(); }
    } else if (this.fol) {
      const f = this.fol, tp = f.target.isVector3 ? f.target : f.target.root.position;
      const desired = this._f.copy(tp).add(f.offset);
      this.pos.x = damp(this.pos.x, desired.x, f.lag, dt); this.pos.y = damp(this.pos.y, desired.y, f.lag, dt); this.pos.z = damp(this.pos.z, desired.z, f.lag, dt);
      const lt = tp.clone().add(f.look);
      this.tgt.x = damp(this.tgt.x, lt.x, f.lag * 1.6, dt); this.tgt.y = damp(this.tgt.y, lt.y, f.lag * 1.6, dt); this.tgt.z = damp(this.tgt.z, lt.z, f.lag * 1.6, dt);
    } else if (this.orb) {
      const o = this.orb; o.a += dt * o.s;
      this.pos.set(o.c.x + Math.cos(o.a) * o.r, o.h, o.c.z + Math.sin(o.a) * o.r); this.tgt.copy(o.c);
    }
    if (!this.enabled) return;
    this.par.cx = damp(this.par.cx, this.par.x, 2, dt); this.par.cy = damp(this.par.cy, this.par.y, 2, dt);
    const c = this.cam;
    this._f.copy(this.tgt).sub(this.pos).normalize();
    this._r.crossVectors(this._f, V(0, 1, 0)).normalize(); this._u.crossVectors(this._r, this._f).normalize();
    const dx = this.par.cx * 0.22 + Math.sin(t * 0.21) * 0.07 * this.drift, dy = -this.par.cy * 0.12 + Math.sin(t * 0.17 + 1) * 0.045 * this.drift;
    c.position.copy(this.pos).addScaledVector(this._r, dx).addScaledVector(this._u, dy);
    c.lookAt(this.tgt);
    // keep the horizontal framing on portrait screens by widening the vertical field of view
    const asp = c.aspect, want = asp < 1.3 ? Math.min(80, 2 * Math.atan(Math.tan(this.fov * Math.PI / 360) * Math.pow(1.3 / asp, 0.75)) * 180 / Math.PI) : this.fov;
    if (Math.abs(c.fov - want) > 0.01) { c.fov = damp(c.fov, want, 6, dt); c.updateProjectionMatrix(); }
  }
}
