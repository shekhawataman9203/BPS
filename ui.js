import { THREE } from './lib.js';
import { clamp } from './util.js';
import { CHAPTERS } from './director.js';
import { allRows, STATUS_LABEL, houseColumns } from './rooms.js';

const $ = (s, r = document) => r.querySelector(s);
const TROPHY_SVG = `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="tg1" x1="0" x2="1"><stop offset="0" stop-color="#8a5a00"/><stop offset=".25" stop-color="#ffe27a"/><stop offset=".5" stop-color="#fff6c8"/><stop offset=".7" stop-color="#e8b020"/><stop offset="1" stop-color="#7a4a00"/></linearGradient>
<linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3240"/><stop offset="1" stop-color="#0c1018"/></linearGradient>
<radialGradient id="tg3" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#ffe27a"/><stop offset="1" stop-color="#b07800"/></radialGradient></defs>
<path d="M95 70 C20 70 20 190 115 205 L120 185 C60 175 55 100 100 95 Z" fill="url(#tg1)"/><path d="M305 70 C380 70 380 190 285 205 L280 185 C340 175 345 100 300 95 Z" fill="url(#tg1)"/>
<path d="M80 40 H320 C320 190 280 250 200 262 C120 250 80 190 80 40 Z" fill="url(#tg1)" stroke="#7a4a00" stroke-width="3"/>
<ellipse cx="200" cy="40" rx="120" ry="16" fill="#fff2b0" stroke="#b07800" stroke-width="3"/>
<path d="M120 60 C125 150 150 210 190 235" stroke="#fffbe0" stroke-width="10" fill="none" opacity=".6" stroke-linecap="round"/>
<circle cx="200" cy="130" r="44" fill="url(#tg3)" stroke="#8a5a00" stroke-width="3"/><path d="M200 102 L208 122 L230 124 L213 138 L219 160 L200 148 L181 160 L187 138 L170 124 L192 122 Z" fill="#E20015"/>
<rect x="182" y="262" width="36" height="58" fill="url(#tg1)"/><path d="M150 320 H250 L262 350 H138 Z" fill="url(#tg1)" stroke="#7a4a00" stroke-width="2"/>
<rect x="100" y="350" width="200" height="150" rx="10" fill="url(#tg2)" stroke="#e8b020" stroke-width="5"/>
<rect x="118" y="368" width="164" height="114" rx="6" fill="none" stroke="#e8b020" stroke-width="1.5" opacity=".6"/>
<text x="200" y="404" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="25" fill="#ffe27a">MOBILITY</text>
<text x="200" y="432" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="25" fill="#ffffff">BPS AWARD</text>
<text x="200" y="468" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="32" fill="#ffe27a">2027</text>
<rect x="84" y="500" width="232" height="26" rx="6" fill="url(#tg1)"/></svg>`;
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const pad = n => String(n).padStart(2, '0');
// "**bold** text" → nodes
const rich = text => text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => t.startsWith('**') ? h('strong', {}, t.slice(2, -2)) : t);

export class UI {
  constructor(app) {
    this.app = app; this.data = app.data;
    this.cc = false; this.autoplay = false; this.autoplayHold = 10; this.presenting = false; this.explore = false; this.roles = false; this.paused = false;
    this.pins = []; this.panelOpen = false; this.startTime = 0; this.pausedAt = 0; this.pausedTotal = 0;
    this.timers = new Map(); // pausable UI timers
    this.sel = {};
    this.buildStatic();
    this.toggleCC(false); // subtitles start off; the Subtitles button (or C) turns them on
    this.buildRoadmap();
    this.bindKeys();
  }

  // ------------------------------------------------------------ pausable timers (captions, title cards)
  later(key, ms, fn) {
    this.cancel(key);
    const t = { fn, end: performance.now() + ms, left: ms, id: null };
    if (!this.paused) t.id = setTimeout(() => { this.timers.delete(key); fn(); }, ms);
    this.timers.set(key, t);
  }
  cancel(key) { const t = this.timers.get(key); if (t) { clearTimeout(t.id); this.timers.delete(key); } }

  // ------------------------------------------------------------ static chrome
  buildStatic() {
    const d = this.data;
    $('#plantName').textContent = d.meta.subtitle || d.meta.event;
    $('#introPlant').textContent = d.meta.subtitle || d.meta.event;
    $('#introTag').textContent = d.meta.tagline;
    const rail = $('#railStations');
    { const n = CHAPTERS.length - 1; rail.style.gridTemplateColumns = `repeat(${n}, 1fr)`; const l = $('#railLine'); if (l) { l.style.left = `calc(100% / ${2 * n})`; l.style.right = `calc(100% / ${2 * n})`; } }
    CHAPTERS.forEach((c, i) => {
      if (i === 0) return;
      rail.append(h('button', { class: 'station', 'data-i': i, onclick: () => this.app.director.go(i), 'aria-label': `Chapter ${i}: ${c.title}` },
        h('span', { class: 'st-num' }, pad(i)), h('span', { class: 'st-name' }, c.title)));
    });
    $('#btnCC').onclick = () => this.toggleCC();
    $('#btnRoles').onclick = () => { this.rolesByUser = true; this.rolesAuto = false; this.toggleRoles(); };
    $('#btnExplore').onclick = () => this.toggleExplore();
    $('#btnPause').onclick = () => this.togglePause();
    $('#btnScreen').onclick = () => this.toggleScreenView();
    $('#svClose').onclick = () => this.toggleScreenView(false);
    $('#btnPresent').onclick = () => this.togglePresent();
    $('#btnHelp').onclick = () => this.toggleHelp();
    $('#btnBpsGo').onclick = () => this.roadmapOpen ? this.closeRoadmap() : this.openRoadmap();
    $('#pauseBadge').onclick = () => this.togglePause(false);
    $('#detailClose').onclick = () => this.closeDetail();
    $('#btnSkip').onclick = () => this.app.director.skip();
    $('#btnReset').onclick = () => this.app.director.resetView();
    $('#panelToggle').onclick = () => this.panelOpen ? this.closePanel() : this.openPanel();
    $('#panelTab').onclick = () => this.openPanel();
    // chapter bar at the bottom: hidden by default, Chapters button / T shows it
    this.toggleChapters = (v = !document.body.classList.contains('show-rail')) => { document.body.classList.toggle('show-rail', v); this.pressed('#btnChapters', v); };
    $('#btnChapters').onclick = () => this.toggleChapters();
    $('#btnPrev').onclick = () => this.app.director.prev();
    $('#btnNext').onclick = () => { if (this.roadmapOpen) this.closeRoadmap(); this.app.director.nextAct(); };
    $('#helpClose').onclick = () => this.toggleHelp(false);
    $('#enter').onclick = () => this.enter(false);
    $('#enterPresent').onclick = () => this.enter(true);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && this.presenting) this.togglePresent(false); });
    let idle;
    const wake = () => { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => this.presenting && document.body.classList.add('idle'), 2600); };
    addEventListener('pointermove', wake); addEventListener('pointerdown', wake);
  }
  setLoading(p) { $('#loadBar').style.transform = `scaleX(${p})`; if (p >= 1) document.body.classList.add('loaded'); }
  enter(present) {
    document.body.classList.add('entered');
    $('#intro').setAttribute('aria-hidden', 'true');
    if (present) this.togglePresent(true);
    this.startTime = performance.now();
    setTimeout(() => this.app.director.go(1), 650);
  }

  // ------------------------------------------------------------ keyboard
  bindKeys() {
    addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      const d = this.app.director;
      if (!document.body.classList.contains('entered')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.enter(false); } return; }
      const k = e.key;
      if (k === 'Escape' && this.screenView && !this.detailOpen && !this.roadmapOpen) { this.toggleScreenView(false); return; }
      if (k === 'Escape' && this.detailOpen && !this.roadmapOpen) { this.closeDetail(); return; }
      if ((k === 'v' || k === 'V') && !this.roadmapOpen) { this.toggleScreenView(); return; }
      if (k === 'Escape') { if (!$('#help').hidden) this.toggleHelp(false); else if (this.roadmapOpen) { if (this.rmFocus) this.zoomTo(null); else this.closeRoadmap(); } else if (this.explore) this.toggleExplore(false); return; }
      if (k === 't' || k === 'T') { this.toggleChapters(); return; }
      if (k === 'k' || k === 'K' || k === 'Pause') { e.preventDefault(); this.togglePause(); return; }
      if (k === 'b' || k === 'B') { this.roadmapOpen ? this.closeRoadmap() : this.openRoadmap(); return; }
      if (this.rm27Open && ['ArrowRight', 'PageDown', ' ', 'Escape'].includes(k)) {
        const f = document.querySelector('#rm27 .rm27-frame');
        if (f && f.classList.contains('zoom')) { e.preventDefault(); f.classList.remove('zoom'); return; }
      }
      if (this.roadmapOpen) {
        // in the roadmap: Next zooms out first, then closes it (and moves the roadmap chapter on)
        if (['ArrowRight', 'PageDown', ' '].includes(k)) {
          e.preventDefault();
          if (this.rmFocus) this.zoomTo(null);
          else { this.closeRoadmap(); if (d.stepRes && CHAPTERS[d.index]?.id === 'roadmap') d.skip(); }
        }
        return;
      }
      if (d.index === 0 && ['ArrowRight', 'PageDown', ' ', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); return; } // first chapter is already starting
      if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); if (this.paused) this.togglePause(false); d.scriptDone ? d.next() : d.skip(); }
      else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); d.prev(); }
      else if (k === 'Home') d.go(1); else if (k === 'End') d.go(CHAPTERS.length - 1);
      else if (new RegExp(`^[1-${CHAPTERS.length - 1}]$`).test(k)) d.go(+k);
      else if (k === 's' || k === 'S') d.skip();
      else if (k === 'c' || k === 'C') this.toggleCC();
      else if (k === 'p' || k === 'P') this.togglePresent();
      else if (k === 'f' || k === 'F') this.toggleExplore();
      else if (k === 'r' || k === 'R') { this.rolesByUser = true; this.rolesAuto = false; this.toggleRoles(); }
      else if (k === 'h' || k === 'H') this.panelOpen ? this.closePanel() : this.openPanel();
      else if (k === '?') this.toggleHelp();
    });
  }

  // ------------------------------------------------------------ toggles
  pressed(id, on) { $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); }
  toggleCC(v = !this.cc) { this.cc = v; this.pressed('#btnCC', v); document.body.classList.toggle('no-cc', !v); }
  toggleRoles(v = !this.roles) { this.roles = v; this.pressed('#btnRoles', v); document.body.classList.toggle('show-roles', v); }
  toggleAutoplay(v = !this.autoplay) { this.autoplay = v; this.pressed('#btnAuto', v); this.toast(v ? 'Autoplay on: chapters advance on their own' : 'Autoplay off'); }
  toggleHelp(v) { const el = $('#help'); el.hidden = v === undefined ? !el.hidden : !v; }
  togglePause(v = !this.paused) {
    if (v === this.paused) return;
    this.paused = v; this.pressed('#btnPause', v); document.body.classList.toggle('paused', v);
    document.querySelectorAll('#thanks *').forEach(e => e.getAnimations().forEach(a => (v ? a.pause() : a.play())));
    try { const f = document.querySelector('#goalfilm iframe')?.contentWindow?.__film; if (f) f.paused = v; } catch (e) { /* film not reachable */ }
    $('#btnPause .lg').textContent = v ? 'Play' : 'Pause'; $('#btnPause .sm').textContent = v ? '▶' : '❚❚';
    $('#btnPause').setAttribute('title', v ? 'Play animation (K)' : 'Pause animation (K)');
    const now = performance.now();
    if (v) { this.pausedAt = now; for (const t of this.timers.values()) { clearTimeout(t.id); t.left = Math.max(0, t.end - now); } }
    else {
      this.pausedTotal += now - this.pausedAt;
      for (const [key, t] of this.timers) { t.end = now + t.left; t.id = setTimeout(() => { this.timers.delete(key); t.fn(); }, t.left); }
    }
  }
  // the big screen's own 4K canvas, shown flat in the page: sharp at any size, still clickable
  toggleScreenView(v = !this.screenView) {
    const wall = this.app.entrance?.wall; if (!wall) return;
    this.screenView = v; this.pressed('#btnScreen', v); document.body.classList.toggle('screen-view', v);
    const host = $('#svHost'), cv = wall.ct.canvas, sec = $('#screenView');
    if (v) {
      sec.hidden = false; host.append(cv); cv.classList.add('sv-canvas');
      if (!cv._svBound) {
        cv._svBound = true;
        const at = e => { const r = cv.getBoundingClientRect(); return wall.hitTest({ x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height }); };
        cv.addEventListener('click', e => { const h = at(e); if (h) this.showDetail(h); });
        cv.addEventListener('pointermove', e => { const h = at(e); wall.setHover(h); cv.style.cursor = h ? 'pointer' : ''; });
        cv.addEventListener('pointerleave', () => wall.setHover(null));
      }
      this.closePanel();
    } else { sec.hidden = true; cv.remove(); wall.setHover(null); }
  }
  toggleExplore(v = !this.explore) {
    this.explore = v; this.pressed('#btnExplore', v); document.body.classList.toggle('exploring', v);
    this.app.setExplore(v);
    if (v) this.toast('Free camera: drag to orbit, scroll to zoom. Press F to return.');
    else this.app.director.resetView();
  }
  togglePresent(v = !this.presenting) {
    this.presenting = v; this.pressed('#btnPresent', v); document.body.classList.toggle('presenting', v);
    if (v) { if (!this.startTime) this.startTime = performance.now(); document.documentElement.requestFullscreen?.().catch(() => { }); this.toast('Presentation mode: → / clicker for next, ← for back, K to pause'); }
    else if (document.fullscreenElement) document.exitFullscreen?.();
    setTimeout(() => this.app.resize(), 120);
  }
  toast(text) {
    const t = $('#toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(this._toast); this._toast = setTimeout(() => t.classList.remove('on'), 3200);
  }

  // ------------------------------------------------------------ cinematic layers
  fade(to, dur) { const f = $('#fade'); f.classList.remove('white'); f.style.transitionDuration = dur + 's'; f.style.opacity = to; }
  flash() {
    const f = $('#fade'); f.classList.add('white'); f.style.transitionDuration = '0.3s'; f.style.opacity = 1;
    setTimeout(() => { f.style.transitionDuration = '1.1s'; f.style.opacity = 0; setTimeout(() => f.classList.remove('white'), 1150); }, 380);
  }
  letterbox(on) { document.body.classList.toggle('cinema', on); }
  showSkip(on) { $('#btnSkip').hidden = !on; }
  showResetView(on) { $('#btnReset').hidden = !on; }
  titleCard(i, title, sub) {
    const tc = $('#titlecard');
    tc.classList.remove('on'); void tc.offsetWidth;
    $('.tc-num', tc).textContent = pad(i);
    const t = $('.tc-title', tc); t.innerHTML = '';
    [...title].forEach((ch, k) => t.append(h('span', { style: `--k:${k}` }, ch === ' ' ? '\u00a0' : ch)));
    $('.tc-sub', tc).textContent = sub || '';
    tc.classList.add('on');
    this.later('tc', 3300, () => tc.classList.remove('on'));
  }
  // full-screen black card with a single line, e.g. "How 2027 looks like"; null hides it
  yearCard(text) {
    const el = $('#yearcard'); if (!el) return;
    if (!text) { el.classList.remove('on'); this.cancel('year'); return; }
    $('h2', el).textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  // ------------------------------------------------------------ Glimpses: photos zoom in full screen, then settle into their place on the slide
  glimpses(action, a, b) {
    const sec = $('#glimpses'), G = this.data.glimpses; if (!sec || !G) return;
    const imgs = this._glImgs ||= JSON.parse(document.getElementById('glimpse-images')?.textContent || '{}');
    const set = st => { sec.dataset.state = st; };
    const slide = $('.gl-slide', sec);
    const items = () => { const a = []; slide.querySelectorAll('.gl-img').forEach(e => { a[+e.dataset.i] = e; }); return a; };
    const place = (el, r) => { el.style.left = r[0] + '%'; el.style.top = r[1] + '%'; el.style.width = r[2] + '%'; el.style.height = r[3] + '%'; };
    const syncCross = () => (M => { if (!M) return; M.images.forEach((im, i) => { if (!im.cross) return;
      let x = slide.querySelector(`.gl-cross[data-i="${i}"]`);
      if (!x) { x = h('i', { class: 'gl-cross', 'data-i': i, 'aria-hidden': 'true' }); place(x, im.slot); slide.append(x); }
      const later = [...slide.querySelectorAll('.gl-img')].some(e => +e.dataset.i > i && ['placed', 'popped'].includes(e.dataset.st));
      x.classList.toggle('on', later); }); })(G.months[a ?? 0]);
    const syncDigi = () => (M => { if (!M) return; M.images.forEach((im, i) => {
      const e = slide.querySelector(`.gl-img[data-i="${i}"]`), placed = !!e && ['placed', 'popped'].includes(e.dataset.st);
      if (im.arrowFrom != null) {
        let ar = slide.querySelector(`.gl-arrow[data-i="${i}"]`);
        if (!ar) { const s0 = M.images[im.arrowFrom].slot, s1 = im.slot, x0 = s0[0] + s0[2], x1 = s1[0], yc = Math.min(s0[1] + s0[3] / 2, s1[1] + s1[3] / 2);
          ar = h('i', { class: 'gl-arrow', 'data-i': i, 'aria-hidden': 'true' }); ar.style.left = (x0 + 0.4) + '%'; ar.style.width = Math.max(2, x1 - x0 - 0.8) + '%'; ar.style.top = yc + '%'; slide.append(ar); }
        ar.classList.toggle('on', placed);
      }
      if (im.digital) {
        let dg = slide.querySelector(`.gl-digi[data-i="${i}"]`);
        if (!dg) { dg = h('div', { class: 'gl-digi', 'data-i': i, 'aria-hidden': 'true' }, h('span', { class: 'dg-live' }, h('b', {}), 'LIVE'), h('i', { class: 'dg-scan' }), h('i', { class: 'dg-corner tl' }), h('i', { class: 'dg-corner tr' }), h('i', { class: 'dg-corner bl' }), h('i', { class: 'dg-corner br' }), h('div', { class: 'dg-chips' }, im.digital.map((t, k) => h('span', { style: `--d:${0.9 + k * 0.35}s` }, '⚡ ' + t))));
          place(dg, im.slot); slide.append(dg); }
        dg.classList.toggle('on', placed);
      } }); })(G.months[a ?? 0]);
    const syncTags = () => { syncCross(); syncDigi(); slide.querySelectorAll('.gl-tag').forEach(t => { const im = slide.querySelector(`.gl-img[data-i="${t.dataset.i}"]`); t.classList.toggle('on', !!im && ['placed', 'popped'].includes(im.dataset.st)); }); };
    if (action === 'close') { sec.hidden = true; set(''); return; }
    // Gemba walk: the slide sits on a board in the plant (a = { obj, w, h } or null); trackGlimpse() keeps it on the board
    if (action === 'gemba') {
      this.glBoard = a || null; sec.classList.toggle('gemba', !!a);
      if (!a) ['left', 'top', 'width', 'height'].forEach(k => { slide.style[k] = ''; });
      return;
    }
    sec.hidden = false;
    if (action === 'cover') {
      $('.gl-icons', sec).textContent = G.icons.join('  '); $('.gl-title', sec).textContent = G.title; $('.gl-sub', sec).textContent = G.subtitle || '';
      set(''); void sec.offsetWidth; set('cover'); return;
    }
    const M = G.months[a ?? 0];
    if (action === 'month') {
      $('.gl-m-title', sec).textContent = M.month; $('.gl-m-event', sec).textContent = M.event;
      // prepare the slide for this month, all photos hidden
      $('.gl-s-title', sec).textContent = G.title; $('.gl-s-event', sec).textContent = M.slideEvent ?? M.event; $('.gl-s-logo', sec).src = $('#bpsLogoImg').src;
      items().forEach(e => e.remove()); slide.querySelectorAll('.gl-box, .gl-tag, .gl-cross, .gl-arrow, .gl-digi, .gl-improve, .gl-hl, .gl-headbg').forEach(e => e.remove());
      if (M.box) {
        // content box whose items appear one per Next
        const bx = h('div', { class: 'gl-box' + (M.box.style ? ' gl-box-' + M.box.style : '') }, h('p', { class: 'gl-box-title' }, M.box.title), h('ul', {}, M.box.items.map(t => h('li', {}, t))));
        place(bx, M.box.slot); slide.append(bx);
      }
      M.images.forEach((im, i) => {
        if (!imgs[im.src]) return; // picture not added yet: skipped
        const el = h('img', { class: 'gl-img', 'data-i': i, alt: im.caption || '', src: imgs[im.src] || '' });
        place(el, [im.slot[0] + im.slot[2] * 0.3, im.slot[1] + im.slot[3] * 0.3, im.slot[2] * 0.4, im.slot[3] * 0.4]);
        el.dataset.st = 'hidden'; slide.append(el);
        if (im.tag) { const tg = h('span', { class: 'gl-tag', 'data-i': i }, im.tag); tg.style.left = im.slot[0] + '%'; tg.style.top = im.slot[1] + '%'; slide.append(tg); }
      });
      set(b === 'nocard' ? 'slide' : 'month'); return;
    }
    if (action === 'improve') {
      // incremental improvement: a staircase, quarter by quarter, with an arrow climbing it
      const I = M.improve; if (!I) return;
      set('slide'); sec.classList.remove('focus');
      items().forEach((e, i) => { e.dataset.st = 'placed'; place(e, M.images[i].slot); });
      let w = slide.querySelector('.gl-improve');
      if (!w) {
        // bars to scale (days fall quarter by quarter: the decline is the improvement), an arrow running down their tops
        const n = I.steps.length, vals = I.steps.map(s => parseFloat(s[1])), hi = Math.max(...vals), lo = Math.min(...vals);
        const hts = vals.map(v => 38 + 54 * (hi === lo ? 1 : (v - lo) / (hi - lo)));
        const pts = hts.map((ht, k) => [((k + 0.5) / n) * 100, 100 - ht - 13]);
        const svg = `<svg class="gi-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="giHead" markerWidth="2.6" markerHeight="2.6" viewBox="0 0 6 6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#1E9E3C"/></marker></defs><polyline points="${pts.map(p => p.join(',')).join(' ')}" pathLength="100" marker-end="url(#giHead)"/></svg>`;
        w = h('div', { class: 'gl-improve' },
          h('p', { class: 'gi-title' }, '📉 ', I.title),
          h('div', { class: 'gi-stairs' }, I.steps.map(([q, v], k) => h('div', { class: 'gi-step', style: `--k:${k};height:${hts[k]}%` }, h('b', {}, v), h('small', {}, I.unit), h('em', {}, q)))),
          h('p', { class: 'gi-note' }, '▼ ', I.note));
        w.querySelector('.gi-stairs').insertAdjacentHTML('beforeend', svg);
        place(w, I.slot); slide.append(w);
      }
      void w.offsetWidth; w.classList.add('on'); syncTags(); return;
    }
    if (action === 'zoom') {
      // zoom into one region of a picture (e.g. one chart) and highlight a point on it
      const el = items()[b], im = M.images[b], Z = im && im.zoom; if (!el || !Z) return;
      set('slide'); sec.classList.remove('focus'); $('.gl-caption', sec).classList.remove('on');
      const S = im.slot, [zx, zy, zw, zh] = Z.rect, T = [4, 18, 92, 77];
      const k = Math.min((T[2] * 16) / (zw * S[2] * 16), (T[3] * 9) / (zh * S[3] * 9));
      const W2 = S[2] * k, H2 = S[3] * k, L = T[0] + T[2] / 2 - (zx + zw / 2) * W2, Tp = T[1] + T[3] / 2 - (zy + zh / 2) * H2;
      el.dataset.st = 'zoomed'; place(el, [L, Tp, W2, H2]);
      if (!slide.querySelector('.gl-headbg')) slide.append(h('i', { class: 'gl-headbg', 'aria-hidden': 'true' }));
      slide.querySelector('.gl-hl')?.remove();
      if (Z.point) {
        const px = L + Z.point[0] * W2, py = Tp + Z.point[1] * H2;
        const hl = h('div', { class: 'gl-hl' }, h('i', { class: 'gl-hl-ring' }), h('i', { class: 'gl-hl-ring r2' }), h('div', { class: 'gl-hl-tag' }, h('b', {}, '🏆 ', Z.label), Z.sub ? h('small', {}, Z.sub) : null));
        hl.style.left = px + '%'; hl.style.top = py + '%'; slide.append(hl);
        setTimeout(() => { hl.classList.add('on'); this.crackers(slide, [[px - 6, py - 8, 12, 16]], 2200); }, 1150);
      }
      syncTags(); return;
    }
    if (action === 'point') {
      set('slide'); sec.classList.remove('focus'); $('.gl-caption', sec).classList.remove('on');
      items().forEach((e, i) => { e.dataset.st = 'placed'; place(e, M.images[i].slot); });
      const bx = $('.gl-box', slide); if (!bx) return;
      bx.classList.add('on');
      [...bx.querySelectorAll('li')].forEach((li, k) => li.classList.toggle('on', k <= b));
      if (M.box.celebrate && b === M.box.items.length - 1) setTimeout(() => this.crackers(slide, [M.box.slot], 3200), 300);
      syncTags(); return;
    }
    if (action === 'pop') {
      // rises from behind the slide straight into its place, then crackers over the celebrated images
      set('slide'); sec.classList.remove('focus'); $('.gl-caption', sec).classList.remove('on');
      const el = items()[b], im = M.images[b];
      items().forEach((e, i) => { if (i < b) { e.dataset.st = 'placed'; place(e, M.images[i].slot); } });
      place(el, im.slot); el.dataset.st = 'pop'; void el.offsetWidth; el.dataset.st = 'popped';
      const targets = (im.celebrate || []).map(src => M.images.find(x => x.src === src)?.slot).filter(Boolean);
      if (im.entry !== 'fade') setTimeout(() => this.crackers(slide, targets.length ? targets : [im.slot]), 700);
      syncTags();
      return;
    }
    if (action === 'full' || action === 'place' || action === 'compose') {
      set('slide');
      items().forEach((el, i) => {
        const im = M.images[i];
        if (action === 'compose' || (action === 'place' && i <= b) || (action === 'full' && i < b)) { el.dataset.st = action === 'full' ? 'placed-hidden' : 'placed'; place(el, im.slot); }
        if (action === 'full' && i === b) { el.dataset.st = 'full'; place(el, [1.5, 1.5, 97, 97]); }
      });
      // a placed image can push earlier ones to new spots (e.g. co-creation photos onto the VE vision)
      M.images.forEach((im, i) => { if (!im.pushes || !(action === 'compose' || (action === 'place' && i <= b))) return;
        for (const [j, r] of Object.entries(im.pushes)) { const e = items()[+j]; if (e) { place(e, r); e.style.zIndex = 4; e.dataset.st = 'placed'; } } });
      const bx = $('.gl-box', slide);
      if (bx && action === 'compose') { bx.classList.add('on'); bx.querySelectorAll('li').forEach(li => li.classList.add('on')); }
      syncTags();
      const cap = $('.gl-caption', sec);
      cap.textContent = action === 'full' ? (M.images[b].caption || '') : ''; cap.classList.toggle('on', action === 'full');
      sec.classList.toggle('focus', action === 'full');
    }
  }
  // ------------------------------------------------------------ BPS Fact Check newsroom
  // 'open' | 'claim' i | 'evidence' i | 'verdict' i | 'signoff' | 'close'
  factCheck(action, i) {
    const el = $('#factcheck'), F = this.data.factCheck; if (!el || !F) return;
    if (action === 'close') { el.classList.remove('on'); el.hidden = true; document.body.classList.remove('factcheck'); return; }
    if (!el.dataset.built) {
      el.dataset.built = '1';
      $('.fc-title', el).textContent = F.title + ' 🔍'; $('.fc-show', el).textContent = F.show;
      $('.fc-name', el).textContent = F.anchor.name; $('.fc-role', el).textContent = F.anchor.role;
      const st = $('.fc-steps', el); F.steps.forEach(s => st.append(h('li', { 'data-id': s.id }, h('b', {}, s.n), h('span', {}, s.name))));
      const txt = F.ticker.join('     •     ') + '     •     ';
      $('.fc-ticker-track', el).append(h('span', {}, txt), h('span', { 'aria-hidden': 'true' }, txt));
    }
    el.hidden = false; document.body.classList.add('factcheck'); void el.offsetWidth; el.classList.add('on');
    if (action === 'show') return;
    const card = $('.fc-card', el), ev = $('.fc-evidence', el), stamp = $('.fc-stamp', el), say = $('.fc-say', el);
    const idx = id => F.steps.findIndex(s => s.id === id);
    const setStep = (id, all = false) => $('.fc-steps', el).querySelectorAll('li').forEach(li => { li.classList.toggle('on', li.dataset.id === id); li.classList.toggle('done', all || (id != null && idx(li.dataset.id) < idx(id))); });
    const pop = e => { e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); };
    const clearStamp = () => { stamp.className = 'fc-stamp'; stamp.textContent = ''; };
    if (action === 'open' || action === 'signoff') {
      const end = action === 'signoff';
      el.dataset.state = end ? 'signoff' : 'open'; setStep(null, end); clearStamp(); ev.innerHTML = ''; ev.classList.remove('on');
      card.innerHTML = '';
      card.append(h('p', { class: 'fc-kicker' }, end ? 'That was' : 'Today on'), h('h2', { class: 'fc-big' }, F.title, ' 🔍'), h('p', { class: 'fc-lede' }, F.show),
        h('ol', { class: 'fc-agenda' }, F.steps.map(s => h('li', {}, h('b', {}, s.n), h('span', {}, h('strong', {}, s.name), h('small', {}, s.q))))));
      pop(card); say.textContent = end ? F.signoff : F.opening; pop(say); return;
    }
    const C = F.claims[i], S = F.steps[idx(C.step)];
    if (action === 'claim') {
      el.dataset.state = 'claim'; setStep(C.step); clearStamp(); ev.innerHTML = ''; ev.classList.remove('on');
      card.innerHTML = '';
      const isa = C.isa ? h('span', { class: 'fc-isa isa-' + C.isa }, C.isa) : null;
      card.append(h('p', { class: 'fc-kicker' }, `${S.n} · ${S.name} — ${S.q}`),
        h('div', { class: 'fc-claim' }, isa, h('div', {}, h('span', { class: 'fc-claim-tag' }, 'CLAIM'), h('q', {}, C.claim), h('small', {}, '📣 ' + (C.source || 'Heard on the shop floor')))));
      pop(card); say.textContent = `Claim ${i + 1} of ${F.claims.length}. Let's check it.`; pop(say); return;
    }
    if (action === 'evidence') {
      el.dataset.state = 'evidence'; ev.innerHTML = '';
      ev.append(h('p', { class: 'fc-ev-tag' }, '🔍 THE CHECK'), this.fcEvidence(C.evidence));
      void ev.offsetWidth; ev.classList.add('on'); return;
    }
    if (action === 'verdict') {
      el.dataset.state = 'verdict'; clearStamp();
      stamp.append(h('small', {}, 'VERDICT'), h('span', {}, `${C.verdict.icon || ''} ${C.verdict.label}`));
      void stamp.offsetWidth; stamp.className = 'fc-stamp on t-' + C.verdict.tone + (C.stampTop ? ' top' : '');
      say.textContent = C.anchor || ''; pop(say);
    }
  }
  // the 85% audit: 'claim' | 'start' (roadmap check opens) | 'kpi' n (reveal KPI n) | 'result' | 'verdict'
  fcAudit(action, n) {
    const el = $('#factcheck'), F = this.data.factCheck, A0 = F.audit; if (!el || !A0) return;
    // tasks mode: the blocks come straight from the roadmap; each row is one roadmap element with its quarterly tasks
    const A = !['tasks', 'status'].includes(A0.mode) ? A0 : { ...A0, blocks: A0.order.map(gid => { const pl = this.data.roadmap.pillars.find(p => p.groups.some(g => g.id === gid)), g = pl.groups.find(x => x.id === gid);
      return { name: g.name, color: pl.color, kpis: g.rows.map(r => { const t = r.q.filter(c => c[0]); const n = t.filter(c => c[1]).length; return { kpi: r.element, tasks: r.q, done: n, total: t.length, pct: r.statusPct ?? Math.round(n / t.length * 100), ok: (r.statusPct ?? Math.round(n / t.length * 100)) >= 100, target: `${n} of ${t.length}`, result: r.ytd }; }) }; }) };
    const tasksMode = ['tasks', 'status'].includes(A0.mode), statusMode = A0.mode === 'status';
    this.factCheck('show');
    const card = $('.fc-card', el), ev = $('.fc-evidence', el), stamp = $('.fc-stamp', el), say = $('.fc-say', el);
    const all = A.blocks.flatMap((b, bi) => b.kpis.map(k => ({ ...k, bi })));
    const pop = e => { e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); };
    const steps = $('.fc-steps', el);
    if (action === 'claim') {
      el.dataset.state = 'claim'; el.classList.remove('audit'); stamp.className = 'fc-stamp'; stamp.textContent = ''; ev.innerHTML = ''; ev.classList.remove('on');
      steps.querySelectorAll('li').forEach(li => { li.classList.toggle('on', li.dataset.id === 'target'); li.classList.remove('done'); });
      card.innerHTML = '';
      card.append(h('p', { class: 'fc-kicker' }, 'Fact check · BPS GO!+ 2026'),
        h('div', { class: 'fc-claim' }, h('div', {}, h('span', { class: 'fc-claim-tag' }, 'CLAIM'), h('q', {}, A.claim), h('small', {}, '📣 ' + A.source))));
      pop(card); say.textContent = A.check; pop(say); return;
    }
    if (action === 'start') {
      el.dataset.state = 'evidence'; ev.innerHTML = '';
      const cols = [h('div', { class: 'au-col' }), h('div', { class: 'au-col' })];
      // balance the two columns by number of rows
      const total = A.blocks.reduce((s, b) => s + b.kpis.length + 1, 0); const side = []; { let l = 0, r = 0; const half = Math.ceil(A.blocks.length / 2); A.blocks.forEach((b, i) => { side[i] = i < half ? 0 : 1; }); void l; void r; void total; }
      let idx = 0;
      A.blocks.forEach((b, bi) => {
        const blk = h('div', { class: 'au-block', 'data-b': bi, style: `--c:${b.color};order:${bi}` }, h('p', { class: 'au-h' }, h('span', {}, b.name), h('small', {}, statusMode ? 'Q1 · Q2 · Q3 · Q4 · status' : tasksMode ? 'Q1 · Q2 · Q3 · Q4 · done' : 'Target · 2026')));
        b.kpis.forEach(k => blk.append(tasksMode
          ? h('div', { class: 'au-row tasks', 'data-n': idx++ }, h('span', { class: 'au-k' }, k.kpi), h('span', { class: 'au-q' }, k.tasks.map(([t, dn]) => h('i', { class: !t ? 'na' : dn ? 'y' : 'n', title: t }, !t ? '–' : dn ? '✓' : '✗'))), h('span', { class: 'au-r' + (statusMode ? (k.pct >= 100 ? ' full' : k.pct >= 75 ? ' part' : ' low') : '') }, statusMode ? `${k.pct}%` : `${k.done}/${k.total}`), h('i', { class: 'au-m' }, k.ok ? '✅' : k.pct >= 75 ? '⚠️' : '❌'))
          : h('div', { class: 'au-row', 'data-n': idx++ }, h('span', { class: 'au-k' }, k.kpi), h('span', { class: 'au-t' }, k.target), h('span', { class: 'au-r' }, k.result), h('i', { class: 'au-m' }, k.ok ? '✅' : '❌'))));
        cols[side[bi]].append(blk);
      });
      ev.append(h('p', { class: 'fc-ev-tag' }, '🔍 THE CHECK · BPS GO!+ Roadmap 2026'), h('div', { class: 'au-grid' }, cols),
        h('div', { class: 'au-tally' }, h('span', { class: 'au-ok' }, '✅ 0'), h('span', { class: 'au-no' }, '❌ 0'), h('b', { class: 'au-pct' }, `0 of ${all.length} checked`)));
      void ev.offsetWidth; ev.classList.add('on'); el.classList.add('audit');
      say.textContent = `${A.blocks[0].name} first.`; pop(say); return;
    }
    if (action === 'kpi') {
      const k = all[n]; if (!k) return;
      const blk = ev.querySelector(`.au-block[data-b="${k.bi}"]`); blk?.classList.add('on');
      const row = ev.querySelector(`.au-row[data-n="${n}"]`); row?.classList.add('on', k.ok ? 'ok' : 'no');
      ev.querySelectorAll('.au-row.cur').forEach(r => r.classList.remove('cur')); row?.classList.add('cur');
      const seen = all.slice(0, n + 1), ok = seen.filter(x => x.ok).length;
      if (statusMode) {
        const avg = Math.floor(seen.reduce((s, x) => s + x.pct, 0) / seen.length);
        $('.au-ok', ev).textContent = `✅ ${ok}`; $('.au-no', ev).textContent = `⚠️ ${seen.length - ok}`; $('.au-pct', ev).textContent = `${seen.length} of ${all.length} rows · average ${avg}%`;
        say.textContent = `${k.kpi}: ${k.done} of ${k.total} quarterly tasks done, status ${k.pct}%.`; pop(say); return;
      }
      if (tasksMode) {
        const dn = seen.reduce((s, x) => s + x.done, 0), tt = seen.reduce((s, x) => s + x.total, 0), allT = all.reduce((s, x) => s + x.total, 0);
        $('.au-ok', ev).textContent = `✓ ${dn} done`; $('.au-no', ev).textContent = `✗ ${tt - dn} open`; $('.au-pct', ev).textContent = `${tt} of ${allT} tasks checked`;
        say.textContent = `${k.kpi}: ${k.done} of ${k.total} tasks done. ${k.ok ? 'Complete ✅' : 'Open points ⚠️'}`; pop(say); return;
      }
      $('.au-ok', ev).textContent = `✅ ${ok}`; $('.au-no', ev).textContent = `❌ ${seen.length - ok}`; $('.au-pct', ev).textContent = `${seen.length} of ${all.length} checked`;
      say.textContent = `${k.kpi}: target ${k.target}, 2026 ${k.result}. ${k.ok ? 'Achieved ✅' : 'Not achieved ❌'}`; pop(say); return;
    }
    const ok = tasksMode ? all.reduce((s, x) => s + x.done, 0) : all.filter(x => x.ok).length, tot = tasksMode ? all.reduce((s, x) => s + x.total, 0) : all.length;
    const pct = statusMode ? Math.floor(all.reduce((s, x) => s + x.pct, 0) / all.length) : Math.round(ok / tot * 100), pass = pct >= A.claimPct - (A.tolerance || 0), unit = statusMode ? 'roadmap rows' : tasksMode ? 'tasks' : 'KPIs';
    if (action === 'result') {
      ev.querySelectorAll('.au-row.cur').forEach(r => r.classList.remove('cur'));
      ev.classList.add('done');
      $('.au-pct', ev).textContent = statusMode ? `Average of ${all.length} rows = ${pct}%  ·  claimed ${A.claimPct}%` : `${ok} of ${tot} ${unit} done = ${pct}%  ·  claimed ${A.claimPct}%`;
      say.textContent = statusMode ? `Average status across all ${all.length} roadmap rows: ${pct}%. The claim was ${A.claimPct}%.` : `${ok} of ${tot} ${unit} done: ${pct}%. The claim was ${A.claimPct}%.`; pop(say); return;
    }
    if (action === 'verdict') {
      el.dataset.state = 'verdict';
      stamp.textContent = ''; stamp.append(h('small', {}, 'VERDICT'), h('span', {}, pass ? '✅ VERIFIED · TRUE' : `⚠️ NOT VERIFIED · ${pct}%`));
      void stamp.offsetWidth; stamp.className = 'fc-stamp on au ' + (pass ? 't-ok' : 't-warn');
      steps.querySelectorAll('li').forEach(li => { li.classList.remove('on'); li.classList.add('done'); });
      say.textContent = pass ? (statusMode ? `Claim verified: the 2026 roadmap stands at ${pct}%, as claimed.` : `Claim verified: ${pct}% of the 2026 roadmap ${unit} done, in line with the ${A.claimPct}% claimed.`) : `Claim not verified: ${pct}% achieved against ${A.claimPct}% claimed. The open points move into 2027.`; pop(say);
    }
  }
  fcEvidence(E) {
    const d = this.data, rows = allRows(d), STC = { ok: '#3FBF8F', watch: '#F2B233', behind: '#E20015' };
    const imgs = this._glImgs ||= JSON.parse(document.getElementById('glimpse-images')?.textContent || '{}');
    const box = h('div', { class: 'fc-ev fc-ev-' + E.type });
    if (E.type === 'house27') {
      const w = this.app.entrance.wall; w.setMode('house27'); w.set27(true, 4, true); w.p = 1; w.animating = false; w.highlight(null, null);
      const cv = document.createElement('canvas'); cv.width = w.ct.canvas.width; cv.height = w.ct.canvas.height; cv.getContext('2d').drawImage(w.ct.canvas, 0, 0); cv.className = 'fc-canvas'; box.append(cv);
    }
    if (E.type === 'images') box.append(h('div', { class: 'fc-imgs' }, E.src.map(s => h('img', { src: imgs[s] || '', alt: '' }))));
    if (E.type === 'kpis') {
      const g = h('div', { class: 'fc-kpis n' + E.ids.length });
      E.ids.forEach(id => { const r = rows.find(x => x.id === id); if (!r) return;
        g.append(h('div', { class: 'fc-kpi', style: `--s:${STC[r.status]}` }, h('span', { class: 'k-n' }, r.kpi), h('small', {}, `${r.pillarName} › ${r.element}`),
          h('div', { class: 'k-v' }, h('span', {}, h('small', {}, 'Target'), r.target), h('span', {}, h('small', {}, d.roadmap.ytdLabel), h('b', {}, r.ytd))), h('i', { class: 'k-s' }, STATUS_LABEL[r.status]))); });
      box.append(g);
    }
    if (E.type === 'reflection') { const b = d.reflection.boxes.find(x => x.id === E.box); box.append(h('p', { class: 'fc-ev-title' }, `Reflection 2026 · ${b.title}`), h('ul', { class: 'fc-list' }, b.items.map(t => h('li', {}, rich(t))))); }
    if (E.type === 'bullets') { if (E.title) box.append(h('p', { class: 'fc-ev-title' }, E.title)); box.append(h('ul', { class: 'fc-list' }, E.items.map(t => h('li', {}, rich(t))))); }
    if (E.type === 'map') {
      const H = d.house2027, all = [...H.pillars, ...H.boosters];
      box.append(h('div', { class: 'fc-map' }, E.rows.map(([gap, pid], k) => { const p = all.find(x => x.id === pid) || { name: pid };
        return h('div', { class: 'fc-map-row', style: `--d:${k * 0.18}s` }, h('span', { class: 'm-gap' }, gap), h('i', {}, '→'), h('span', { class: 'm-p', style: `--c:${p.color || '#1E88D9'}` }, p.name)); })));
    }
    if (E.type === 'compare') {
      const D = d.digitalSM;
      box.append(h('div', { class: 'fc-compare' },
        h('div', { class: 'c-before' }, h('small', {}, 'BEFORE · manual count'), h('b', {}, D.before.time), h('span', { class: 'c-face' }, D.before.face)),
        h('i', { class: 'c-arrow' }, '→'),
        h('div', { class: 'c-after' }, h('small', {}, 'AFTER · Digital SM'), h('b', {}, D.after.time), h('span', { class: 'c-face' }, D.after.face))),
        h('img', { class: 'fc-strip', src: imgs['digital-sm.jpg'] || '', alt: '' }));
      if (E.note) box.append(h('p', { class: 'fc-note' }, E.note));
    }
    if (E.type === 'checks') {
      if (E.title) box.append(h('p', { class: 'fc-ev-title' }, E.title));
      box.append(h('ul', { class: 'fc-checks' }, E.items.map((it, k) => h('li', { class: it.ok ? 'ok' : 'gap', style: `--d:${k * 0.22}s` }, h('i', {}, it.ok ? '✅' : '⚠️'), h('span', {}, rich(it.t)), h('b', {}, it.ok ? 'ACHIEVED' : 'GAP')))));
    }
    if (E.type === 'scorecard') {
      const SC = d.factCheck.scorecard || [];
      box.append(h('div', { class: 'fc-score' }, SC.map((p, k) => h('div', { class: 'sc-card', style: `--c:${p.color};--d:${k * 0.15}s` }, h('p', { class: 'sc-h' }, p.name),
        h('ul', {}, p.items.map(([t, ok]) => h('li', { class: ok ? 'ok' : 'gap' }, h('i', {}, ok ? '✅' : '⚠️'), t)))))));
    }
    if (E.type === 'poll') {
      const [la, lb] = E.labels || ['2026', '2027'];
      box.append(h('div', { class: 'fc-poll' }, E.rows.map((r, k) => { const max = Math.max(r.from, r.to) * 1.12, u = r.unit || '';
        const pre = E.exact ? '' : (r.lowerBetter ? '≤ ' : (r.to >= 100 ? '' : '> '));
        const delta = E.delta ? h('small', { class: 'p-delta' }, `${r.to < r.from ? '−' : '+'}${Math.abs(Math.round((r.to - r.from) / r.from * 1000) / 10)}%`) : null;
        return h('div', { class: 'p-row', style: `--d:${k * 0.25}s` }, h('span', { class: 'p-k' }, r.kpi, delta),
          h('div', { class: 'p-bars' }, h('i', { class: 'p-from', style: `--w:${r.from / max * 100}%` }, h('em', {}, `${la} · ${r.from}${u}`)), h('i', { class: 'p-to', style: `--w:${r.to / max * 100}%` }, h('em', {}, `${lb} · ${pre}${r.to}${u}`))),
          h('b', { class: 'p-arrow' + (r.lowerBetter ? ' down' : '') }, r.lowerBetter ? '▼' : '▲')); })));
    }
    if (E.points) box.append(h('ul', { class: 'fc-list' }, E.points.map(t => h('li', {}, rich(t)))));
    if (E.caption) box.append(h('p', { class: 'fc-cap' }, E.caption));
    return box;
  }
  // corner notepad for the Digital SM story: 'open' (before|after), 'row' i, 'fill', 'done' {time, face}, 'close'
  smNote(action, arg) {
    const el = $('#smNote'), D = this.data.digitalSM; if (!el || !D) return;
    const rows = $('.sn-rows', el);
    const row = (p, delay = 0) => h('li', { style: `--d:${delay}s` }, h('span', {}, p.pn), h('span', {}, p.name), h('b', {}, String(p.qty)));
    if (action === 'close') { document.body.classList.remove('sm-note'); el.classList.remove('on'); setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 400); return; }
    if (action === 'open') {
      el.dataset.mode = arg; rows.innerHTML = ''; el.classList.remove('done');
      $('.sn-title', el).textContent = D.title;
      $('.sn-badge', el).textContent = arg === 'after' ? 'Read from Digital SM' : 'Manual count';
      el.hidden = false; void el.offsetWidth; el.classList.add('on'); document.body.classList.add('sm-note'); return;
    }
    if (action === 'row') { const p = D.parts[arg]; if (p) rows.append(row(p)); return; }
    if (action === 'fill') { rows.innerHTML = ''; D.parts.forEach((p, i) => rows.append(row(p, i * 0.22))); return; }
    if (action === 'done') { $('.sn-time', el).textContent = '⏱ ' + arg.time; $('.sn-face', el).textContent = arg.face; el.classList.add('done'); }
  }
  // fireworks and confetti bursting over slots (percent rects) on the given element
  crackers(host, slots, dur = 4200) {
    const cv = document.createElement('canvas'); cv.className = 'gl-crackers'; host.append(cv);
    const W = cv.width = host.clientWidth * (devicePixelRatio || 1), H = cv.height = host.clientHeight * (devicePixelRatio || 1), ctx = cv.getContext('2d');
    const cols = ['#E20015', '#FFC20E', '#29d3ff', '#7FE08F', '#B90276', '#ffffff', '#1E88D9'];
    const parts = [], start = performance.now();
    const burst = (x, y) => { for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 6) * W / 1400; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5 * W / 1400, life: 1, c: cols[i % cols.length], r: (2 + Math.random() * 3) * W / 1400, conf: Math.random() < 0.45, rot: Math.random() * 6 }); } };
    const centres = slots.map(s => [(s[0] + s[2] * (0.2 + Math.random() * 0.6)) / 100 * W, (s[1] + s[3] * 0.35) / 100 * H, s]);
    let next = 0;
    const tick = t => {
      const el = t - start;
      if (el > next && el < dur - 1200) { for (const [, , s] of centres) burst((s[0] + s[2] * (0.15 + Math.random() * 0.7)) / 100 * W, (s[1] + s[3] * (0.1 + Math.random() * 0.5)) / 100 * H); next = el + 420; }
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.x += p.vx; p.y += p.vy; p.vy += 0.09 * W / 1400; p.vx *= 0.985; p.life -= p.conf ? 0.006 : 0.014; p.rot += 0.2;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      }
      if (el < dur + 1500 && cv.isConnected) requestAnimationFrame(tick); else cv.remove();
    };
    requestAnimationFrame(tick);
  }
  // last screen: 'show' (background only), 'walk' (the three walk in), 'look' (they look at JaP), 'check' k (item k drops in with a blast), 'final', 'hide'
  thanks(action, k) {
    const el = $('#thanks'); if (!el) return;
    const T = this._ty ||= JSON.parse(document.getElementById('thanks-data')?.textContent || '{}');
    const stage = $('.ty-stage', el);
    const place = (e, r) => { e.style.left = r[0] + '%'; e.style.top = r[1] + '%'; e.style.width = r[2] + '%'; e.style.height = r[3] + '%'; };
    if (!stage.childElementCount && T.img) {
      stage.append(h('img', { class: 'ty-bg', src: T.img.bg, alt: '' }));
      stage.append(h('i', { class: 'ty-glow', 'aria-hidden': 'true' }));
      (T.layout.people || []).forEach((r, i) => { const n = (T.layout.names || [])[i]; const p = h('div', { class: 'ty-p' }, h('img', { src: T.img['p' + (i + 1)], alt: n ? n[0] : '' }), n ? h('span', { class: 'ty-name', style: `left:${n[1] * 100}%;top:${n[2] * 100}%;--r:${n[3] || 0}deg` }, n[0]) : null); place(p, r); stage.append(p); });
      (T.layout.checks || []).forEach((r, i) => { const c = h('img', { class: 'ty-c', src: T.img['c' + (i + 1)], alt: '' }); place(c, r); stage.append(c); });
      if (T.layout.jap) { const j = h('div', { class: 'ty-jap', 'aria-label': 'JaP' }, h('span', {}, 'JaP')); place(j, T.layout.jap); stage.append(j); }
    }
    const people = [...stage.querySelectorAll('.ty-p')], checks = [...stage.querySelectorAll('.ty-c')];
    const jap = stage.querySelector('.ty-jap'), trophy = stage.querySelector('.ty-trophy');
    // dust burst on landing: clouds rolling out sideways, bits flung into the air (as on the 2027 house)
    const dust = (cx, gy, wd) => {
      for (let j = 0; j < 22; j++) {
        const side = j % 2 ? 1 : -1, sp = 0.4 + Math.random() * 0.9, sz = 3 + Math.random() * 4;
        const d = h('i', { class: 'ty-dust', style: `left:${cx + side * wd * 0.3}%;top:${gy}%;width:${sz}%;` }); stage.append(d);
        d.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: .8 }, { transform: `translate(calc(-50% + ${side * (40 + sp * 160)}%), calc(-50% - ${20 + Math.random() * 90}%)) scale(1.6)`, opacity: 0 }], { duration: 1400 + Math.random() * 900, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
      }
      for (let j = 0; j < 18; j++) {
        const b = h('i', { class: 'ty-bit', style: `left:${cx + (Math.random() - .5) * wd}%;top:${gy}%;background:${['#FFD34D', '#0A6EBD', '#9a9288'][j % 3]}` }); stage.append(b);
        const vx = (Math.random() - .5) * 14, vy = 6 + Math.random() * 12, kf = [];
        for (let s = 0; s <= 10; s++) { const t = s / 10; kf.push({ transform: `translate(${vx * t * 10}vw, ${(-vy * t + 22 * t * t) * 1.6}vh) rotate(${t * 540}deg)`, opacity: 1 - t * t }); }
        b.animate(kf, { duration: 1300 + Math.random() * 600, easing: 'linear', fill: 'forwards' }).onfinish = () => b.remove();
      }
      const ring = h('i', { class: 'ty-ring', style: `left:${cx}%;top:${gy}%;width:${wd * 1.6}%` }); stage.append(ring); setTimeout(() => ring.remove(), 900);
      stage.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(7px,-3px)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(0,0)' }], { duration: 380 });
    };
    const stop = e => e.getAnimations().forEach(a => a.cancel());
    if (action === 'hide') { el.classList.remove('on'); el.hidden = true; return; }
    el.hidden = false;
    if (action === 'show' || action === 'final') {
      [...people, ...checks].forEach(stop); el.classList.remove('look');
      const fin = action === 'final';
      people.forEach(p => p.style.opacity = fin ? 1 : 0); checks.forEach(c => c.style.opacity = fin ? 1 : 0);
      if (jap) { stop(jap); jap.style.opacity = fin ? 1 : 0; } if (trophy) { trophy.classList.toggle('in', fin); trophy.classList.toggle('done', fin);  }
      if (fin) el.classList.add('look');
      void el.offsetWidth; el.classList.add('on'); return;
    }
    if (action === 'walk') {
      // each walks in from the left edge of the BPS plinth with a step bounce, one after another
      const W = stage.clientWidth, startX = [31.5, 33, 35];
      people.forEach((p, i) => {
        const r = T.layout.people[i], dx = (startX[i] - r[0]) / 100 * W, kf = [];
        const steps = 10;
        for (let s = 0; s <= steps; s++) { const t = s / steps; kf.push({ offset: t, opacity: Math.min(1, t * 4), transform: `translate(${dx * (1 - t)}px, ${s === steps ? 0 : (s % 2 ? -1.6 : 0)}%) rotate(${s === steps ? 0 : (s % 2 ? 0.8 : -0.8)}deg)` }); }
        p.style.opacity = 0;
        const a = p.animate(kf, { duration: 2600, delay: i * 900, easing: 'linear', fill: 'forwards' });
        if (i === 2) a.onfinish = () => p.animate([{ transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }], { duration: 450, easing: 'ease-out' }); // kneels
      });
      return;
    }
    if (action === 'drop') {
      // the three drop from above and land on the plinth, one after another
      people.forEach((p, i) => {
        const r = T.layout.people[i]; p.style.opacity = 0;
        setTimeout(() => {
          p.style.opacity = 1;
          p.animate([{ transform: 'translateY(-260%) scale(.96)', opacity: 0 }, { transform: 'translateY(-120%)', opacity: 1, offset: .35 }, { transform: 'translateY(0) scaleY(.9) scaleX(1.06)', offset: .78, easing: 'ease-out' }, { transform: 'translateY(-3%) scaleY(1.03)', offset: .9 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
          setTimeout(() => dust(r[0] + r[2] / 2, r[1] + r[3] - 1, r[2]), 700);
        }, i * 1100);
      });
      return;
    }
    if (action === 'jap') {
      // JaP lands on the building glass
      if (!jap) return; const r = T.layout.jap; jap.style.opacity = 1;
      jap.animate([{ transform: 'translateY(-160%) rotate(-6deg)', opacity: 0 }, { transform: 'translateY(4%) rotate(0)', opacity: 1, offset: .75 }, { transform: 'translateY(-2%)', offset: .88 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
      setTimeout(() => { dust(r[0] + r[2] / 2, r[1] + r[3] - 2, r[2]); el.classList.add('look'); }, 680);
      return;
    }
    if (action === 'trophy') {
      if (!trophy) return; trophy.classList.remove('in', 'done', 'parked'); void trophy.offsetWidth; trophy.classList.add('in');
      setTimeout(() => { dust(76, 28.6, 12); this.crackers(stage, [[66, 0, 20, 30]], 3600); trophy.classList.add('done'); }, 900); // lands on the roof of the building
      return;
    }
    if (action === 'look') { el.classList.add('look'); return; }
    if (action === 'check') {
      const c = checks[k]; if (!c) return;
      c.style.opacity = 1;
      c.animate([{ transform: 'translateY(-260%) scale(.9)', opacity: 0 }, { transform: 'translateY(8%) scale(1.04)', opacity: 1, offset: 0.62 }, { transform: 'translateY(-3%)', offset: 0.82 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 950, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      const r = T.layout.checks[k];
      setTimeout(() => {
        const fl = h('i', { class: 'ty-flash', style: `left:${r[0] + r[2] * 0.2}%;top:${r[1] + r[3] / 2}%` }); stage.append(fl); setTimeout(() => fl.remove(), 900);
        this.crackers(stage, [r], 2200);
      }, 600);
    }
  }
  covering() { const g = document.getElementById('glimpses'), y = document.getElementById('yearcard'), t = document.getElementById('thanks'); return document.getElementById('goalfilm') || document.getElementById('rm27') || document.getElementById('chsu') || (g && !g.hidden && g.dataset.state && !g.classList.contains('gemba')) || (y && y.classList.contains('on')) || (t && t.classList.contains('on')); }
  // 'Press → for the next step' hint in stepped chapters
  stepHint(on) { const el = $('#stepHint'); if (el) el.classList.toggle('on', !!on); const b = $('#btnSkip'); if (b) b.firstChild.textContent = on ? 'Next step ' : 'Skip scene '; }
  hideTitleCard() { $('#titlecard').classList.remove('on'); this.cancel('tc'); }
  bigTitle(text, { hold } = {}) {
    const b = $('#bigtitle'); b.innerHTML = '';
    text.split(' ').forEach((w, i) => b.append(h('span', { style: `--k:${i}` }, w), ' '));
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    if (hold) this.later('big', hold * 1000, () => b.classList.remove('on')); else this.cancel('big');
  }
  caption(text, { kind = 'line', hold } = {}) {
    if (kind === 'marker') {
      const m = $('#marker'); m.textContent = ''; m.classList.remove('on'); void m.offsetWidth;
      [...text].forEach((c, k) => m.append(h('span', { style: `--k:${k}` }, c)));
      m.classList.add('on'); this.later('marker', 4200, () => m.classList.remove('on'));
      return;
    }
    const box = $('#captions');
    const old = box.querySelector('.cap.on'); if (old) { old.classList.remove('on'); old.classList.add('out'); setTimeout(() => old.remove(), 500); }
    const line = h('p', { class: 'cap' });
    text.split(' ').forEach((w, k) => { line.append(h('span', { style: `--k:${k}` }, w)); line.append(' '); });
    box.append(line); void line.offsetWidth; line.classList.add('on');
    const ms = hold ? hold * 1000 : 2200 + text.length * 45;
    this.later('cap', ms, () => { line.classList.remove('on'); line.classList.add('out'); setTimeout(() => line.remove(), 500); });
  }
  clearCaptions() { $('#captions').innerHTML = ''; $('#marker').classList.remove('on'); $('#bigtitle').classList.remove('on'); ['cap', 'marker', 'big'].forEach(k => this.cancel(k)); }

  // ------------------------------------------------------------ rail / progress
  setChapter(i) {
    this.chapter = i; this.closeDetail(); if (this.screenView) this.toggleScreenView(false);
    document.querySelectorAll('.station').forEach(b => { const k = +b.dataset.i; b.classList.toggle('done', k < i); b.classList.toggle('current', k === i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    $('#hudChapter').textContent = i ? `${pad(i)} / ${pad(CHAPTERS.length - 1)}` : '';
    $('#hudTitle').textContent = CHAPTERS[i].title;
    document.body.dataset.chapter = CHAPTERS[i].id;
    if (this.rolesAuto && CHAPTERS[i].id !== 'flashback') { this.toggleRoles(false); this.rolesAuto = false; }
    this.renderPanel(i);
  }
  setProgress(i, p) {
    const n = CHAPTERS.length - 1; if (!i) { $('#railFill').style.transform = 'scaleX(0)'; return; }
    const at = (i - 1) / (n - 1), frac = clamp(at + p * 0.45 / (n - 1), 0, 1);
    $('#railFill').style.transform = `scaleX(${frac})`;
    $('#railPart').style.left = `${at * 100}%`;
    if (this.startTime) {
      const pausedNow = this.paused ? performance.now() - this.pausedAt : 0;
      const s = Math.floor((performance.now() - this.startTime - this.pausedTotal - pausedNow) / 1000);
      $('#hudTime').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    }
  }

  // ------------------------------------------------------------ panel
  openPanel() { const ch = CHAPTERS[this.chapter]; if (!ch || ch.id === 'opening') return; this.panelOpen = true; document.body.classList.add('panel-open'); this.pressed('#panelToggle', true); $('#panelToggle').textContent = 'Hide'; }
  closePanel() { this.panelOpen = false; document.body.classList.remove('panel-open'); this.pressed('#panelToggle', false); $('#panelToggle').textContent = 'Show'; }
  panelSize() { const p = this.detailOpen ? $('#detail') : $('#panel'); return { w: p.offsetWidth, h: p.offsetHeight }; }
  sideOpen() { return this.panelOpen || this.detailOpen; }

  // ------------------------------------------------------------ details tile (opened by clicking the KPI screen)
  showDetail(hit) {
    if (!hit) return;
    if (hit.type === 'mode') { this.app.entrance.wall.setMode(hit.id); return; } // screen tabs: House · Roadmap · KPI wall
    const d = this.data, rm = d.roadmap, rf = d.reflection, body = $('#detailBody'), el = $('#detail');
    const rows = allRows(d);
    body.innerHTML = ''; body.scrollTop = 0;
    let color = '#1E88D9', kicker = '', title = '';
    const btn = (label, fn, primary) => h('button', { class: primary ? 'primary' : '', onclick: fn }, label);
    const statusBadge = s => h('span', { class: 'badge st-' + s }, STATUS_LABEL[s]);
    if (hit.type === 'house27') {
      const H = d.house2027, el = [...H.pillars, ...H.boosters].find(x => x.id === hit.id);
      const item = it => { const isNew = it.includes('**'); return h('li', { class: isNew ? 'new27' : '' }, it.replace(/\*\*/g, ''), isNew ? h('span', { class: 'tag27' }, 'New 2027') : null); };
      if (!el) {
        color = '#E8101E'; kicker = H.heading; title = 'House of BPS GO!+ 2027';
        body.append(h('p', { class: 'dt-motto', style: '--c:#E8101E' }, h('em', {}, H.band), ' ', h('b', {}, H.statement)));
        H.pillars.forEach(x => body.append(h('button', { class: 'dt-link', style: `--c:${x.color}`, onclick: () => this.showDetail({ type: 'house27', id: x.id }) }, h('span', {}, x.name, h('small', {}, x.driver)))));
      } else {
        color = el.color || '#1E88D9'; kicker = 'House of BPS GO!+ 2027'; title = el.name;
        if (el.driver) { body.append(h('h4', {}, el.driver)); const ul = h('ul', { class: 'dt-list' }); el.items.forEach(it => ul.append(item(it))); body.append(ul); }
        else body.append(h('p', { class: 'dt-el' }, el.text));
        const was = [...d.house.pillars, ...d.house.boosters].find(x => x.id + '-27' === el.id);
        if (was && was.items && el.items && was.items.join() !== el.items.join()) { body.append(h('h4', {}, 'In 2026')); const ul = h('ul', { class: 'dt-list was26' }); was.items.forEach(it => ul.append(h('li', {}, it))); body.append(ul); }
      }
      this.app.director.select('house27', hit.id);
    } else if (hit.type === 'house' || hit.type === 'group') {
      // a house element (or roadmap block): its drivers and the linked roadmap rows
      const H = d.house, el = [...H.pillars, ...H.boosters].find(x => x.id === hit.id);
      const gid = hit.type === 'group' ? hit.id : el?.roadmap;
      const pl = rm.pillars.find(p => p.groups.some(g => g.id === gid)), g = pl?.groups.find(x => x.id === gid);
      if (hit.id === 'h-house') {
        color = '#E8101E'; kicker = H.heading; title = H.title;
        body.append(h('p', { class: 'dt-motto', style: '--c:#E8101E' }, h('em', {}, H.band), ' ', h('b', {}, H.statement)));
        body.append(h('h4', {}, 'Pillars'));
        H.pillars.forEach(x => body.append(h('button', { class: 'dt-link', style: `--c:${x.color}`, onclick: () => this.showDetail({ type: 'house', id: x.id }) }, h('span', {}, x.name, h('small', {}, x.driver)))));
        body.append(h('h4', {}, 'System boosters'));
        H.boosters.forEach(x => body.append(h('button', { class: 'dt-link', onclick: () => this.showDetail({ type: 'house', id: x.id }) }, h('span', {}, x.name, h('small', {}, x.text)))));
      } else {
        color = el?.color || pl?.color || '#1E88D9'; kicker = hit.type === 'house' ? (H.pillars.includes(el) ? 'House of BPS GO!+ · pillar' : 'House of BPS GO!+ · system booster') : `Roadmap 2026 › ${pl?.name ?? ''}`; title = el?.name || g?.name || '';
        if (el && el.driver) { body.append(h('h4', {}, el.driver)); const ul = h('ul', { class: 'dt-list' }); el.items.forEach(it => ul.append(h('li', {}, it))); body.append(ul); }
        else if (el) body.append(h('p', { class: 'dt-el' }, el.text));
        if (g) {
          body.append(h('h4', {}, `In the roadmap: ${pl.name} › ${g.name}`));
          g.rows.forEach(r => body.append(h('button', { class: 'dt-link', style: `--c:${pl.color}`, onclick: () => this.showDetail({ type: 'kpi', id: r.id }) }, h('span', {}, r.kpi, h('small', {}, `${r.element} · Target ${r.target} · ${rm.ytdLabel} ${r.ytd}`)), statusBadge(r.status))));
          body.append(h('div', { class: 'actions' },
            btn('Show it in the roadmap', () => { this.app.entrance.wall.setMode('roadmap'); this.app.director.select('group', g.id); }, true),
            btn('Zoom in the full roadmap', () => this.openRoadmap(g.id))));
        }
      }
      this.app.director.select(hit.type, hit.id);
    } else if (hit.type === 'kpi') {
      const r = rows.find(x => x.id === hit.id); if (!r) return;
      color = r.color; kicker = `${r.pillarName} › ${r.groupName}`; title = r.kpi;
      body.append(h('p', { class: 'dt-el' }, r.element));
      body.append(h('div', { class: 'dt-nums' },
        h('div', {}, h('small', {}, 'Target 2026'), h('b', {}, r.target)),
        h('div', {}, h('small', {}, rm.ytdLabel), h('b', {}, r.ytd)),
        h('div', {}, h('small', {}, 'Status'), statusBadge(r.status))));
      body.append(h('h4', {}, 'Plan by quarter'));
      const ol = h('ol', { class: 'dt-q' });
      r.q.forEach(([txt, done], i) => ol.append(h('li', { class: done ? 'done' : '' }, h('span', { class: 'qn' }, rm.quarters[i]), h('span', {}, txt || '–'), h('i', { 'aria-label': done ? 'done' : 'open' }, done ? '✓' : ''))));
      body.append(ol);
      const sib = rows.filter(x => x.group === r.group && x.id !== r.id);
      if (sib.length) { body.append(h('h4', {}, `Also in ${r.groupName}`)); sib.forEach(x => body.append(h('button', { class: 'dt-link', onclick: () => this.showDetail({ type: 'kpi', id: x.id }) }, h('span', {}, x.kpi), statusBadge(x.status)))); }
      body.append(h('div', { class: 'actions' }, btn('Zoom into the roadmap', () => { this.openRoadmap(r.group); setTimeout(() => this.pickRow(r.id), 900); }, true)));
      this.app.director.select('kpi', r.id, { fly: false });
    } else if (hit.type === 'pillar' && hit.id !== rf.id) {
      const p = rm.pillars.find(x => x.id === hit.id); if (!p) return;
      const pr = rows.filter(r => r.pillar === p.id);
      color = p.color; kicker = 'BPS GO!+ pillar'; title = p.name;
      body.append(h('p', { class: 'dt-motto', style: `--c:${p.color}` }, h('em', {}, p.motto), ' ', h('b', {}, p.tag)));
      body.append(h('div', { class: 'status-sum' }, ...['ok', 'watch', 'behind'].map(s => h('div', { class: 'ss s-' + s }, h('b', {}, pr.filter(r => r.status === s).length), h('span', {}, STATUS_LABEL[s])))));
      p.groups.forEach(g => {
        body.append(h('h4', {}, g.name));
        g.rows.forEach(r => body.append(h('button', { class: 'dt-link', onclick: () => this.showDetail({ type: 'kpi', id: r.id }) }, h('span', {}, r.kpi, h('small', {}, `Target ${r.target} · ${rm.ytdLabel} ${r.ytd}`)), statusBadge(r.status))));
      });
      body.append(h('div', { class: 'actions' }, btn(`Zoom into ${p.name} in the roadmap`, () => this.openRoadmap(p.id), true)));
      this.app.entrance.highlight(p.id); this.app.director.select('pillar', p.id);
    } else if (hit.type === 'pillar' || hit.type === 'reflection') {
      const boxes = hit.type === 'reflection' ? rf.boxes.filter(b => b.id === hit.id) : rf.boxes;
      color = rf.color; kicker = hit.type === 'reflection' ? rf.title : 'Fourth pillar'; title = hit.type === 'reflection' ? boxes[0].title : rf.title;
      boxes.forEach(b => { if (boxes.length > 1) body.append(h('h4', {}, b.title)); const ul = h('ul', { class: 'dt-list' }); b.items.forEach(it => ul.append(h('li', {}, rich(it)))); body.append(ul); });
      if (hit.type === 'reflection') { const others = rf.boxes.filter(b => b.id !== hit.id); body.append(h('h4', {}, 'More from the reflection')); others.forEach(b => body.append(h('button', { class: 'dt-link', onclick: () => this.showDetail({ type: 'reflection', id: b.id }) }, h('span', {}, b.title)))); }
      body.append(h('div', { class: 'actions' }, btn('Open the reflection slide', () => this.openRoadmap(hit.type === 'reflection' ? hit.id : rf.id), true)));
      this.app.entrance.wall.highlight(rf.id, hit.type === 'reflection' ? hit.id : null);
    } else if (hit.type === 'logo') {
      color = '#0A6EBD'; kicker = 'Roadmap 2026'; title = 'BPS GO!+';
      body.append(h('div', { class: 'logo-card' }, h('img', { src: $('#bpsLogoImg').src, alt: 'BPS GO!+ Creating value. Together.' })));
      body.append(this.pillarButtons());
      body.append(h('div', { class: 'actions' }, btn('Open the full roadmap', () => this.openRoadmap(), true)));
      this.app.director.select('logo', 'logo');
    } else return;
    el.style.setProperty('--c', color);
    $('#detailKicker').textContent = kicker; $('#detailTitle').textContent = title;
    if (!this.detailOpen) { this.detailOpen = true; el.hidden = false; void el.offsetWidth; document.body.classList.add('detail-open'); }
  }
  closeDetail() {
    if (!this.detailOpen) return;
    this.detailOpen = false; document.body.classList.remove('detail-open');
    setTimeout(() => { if (!this.detailOpen) $('#detail').hidden = true; }, 400);
    this.app.entrance?.wall.highlight(null, null); this.app.entrance?.highlight(null);
  }
  renderPanel(i) {
    const ch = CHAPTERS[i], body = $('#panelBody');
    $('#panelNum').textContent = pad(i); $('#panelTitle').textContent = ch.title;
    $('#panelFoot').textContent = this.data.meta.sampleNotice;
    body.innerHTML = ''; body.scrollTop = 0; this.sel = {};
    const fn = this['panel_' + ch.id]; if (fn) fn.call(this, body);
  }
  select(type, id, opts) { this.app.director.select(type, id, opts); this.pins.forEach(p => p.el.classList.toggle('sel', p.type === type && p.id === id)); }
  agenda(from, to) {
    const ol = h('ol', { class: 'agenda' });
    CHAPTERS.slice(from, to).forEach((c, k) => ol.append(h('li', {}, h('button', { onclick: () => this.app.director.go(k + from) }, h('span', { class: 'ag-n' }, pad(k + from)), h('span', {}, h('strong', {}, c.title), c.sub ? h('small', {}, c.sub) : null)))));
    return ol;
  }
  pillarButtons(cls = 'pillar-btns') {
    const d = this.data, wrap = h('div', { class: cls, role: 'group', 'aria-label': 'BPS GO!+ pillars' });
    [...d.roadmap.pillars, d.reflection].forEach(p => wrap.append(h('button', { style: `--c:${p.color}`, onclick: () => this.openRoadmap(p.id) }, h('span', { class: 'pb-name' }, p.name), p.motto ? h('small', {}, p.motto) : h('small', {}, 'What went well, gaps, learnings'))));
    return wrap;
  }

  panel_flashback(b) {
    const d = this.data;
    b.append(h('p', { class: 'lede' }, `${d.meta.event}. ${d.meta.date}: a look back at the year through the main gate.`));
    b.append(h('h4', {}, 'Agenda'), this.agenda(2, CHAPTERS.length));
    b.append(h('h4', {}, 'At the entrance'));
    const ul = h('ul', { class: 'cast' });
    d.cast.filter(c => c.id !== 'tl').forEach(c => ul.append(h('li', { class: c.id === 'ph' ? 'lead' : '' }, h('span', { class: 'dot' }), c.role)));
    b.append(ul);
    b.append(h('p', { class: 'hint' }, 'Move on with the arrow keys or a presentation clicker. K pauses the animation. The BPS GO!+ icon at the top opens the roadmap at any time.'));
  }

  panel_kpis(b) {
    const d = this.data, cols = houseColumns(d), rows = cols.flatMap(c => c.rows);
    const count = s => rows.filter(r => r.status === s).length;
    b.append(h('p', { class: 'lede' }, `Every element of the House of BPS GO!+ with its KPIs, target against ${d.roadmap.ytdLabel}.`));
    b.append(h('div', { class: 'status-sum' }, ...['ok', 'watch', 'behind'].map(s => h('div', { class: 'ss s-' + s }, h('b', {}, count(s)), h('span', {}, STATUS_LABEL[s])))));
    let cf = 'all';
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by house element' });
    const list = h('div', { class: 'kpi-list' });
    const render = () => {
      list.innerHTML = '';
      cols.filter(c => cf === 'all' || c.id === cf).forEach(c => {
        list.append(h('button', { class: 'kl-head kl-headbtn', style: `--c:${c.color}`, onclick: () => this.showDetail({ type: 'house', id: c.id }) }, c.name, h('small', {}, `${c.rows.filter(r => r.status === 'ok').length} of ${c.rows.length} on track · open in the roadmap ›`)));
        c.rows.forEach(r => list.append(h('button', { class: 'kl-row' + (this.sel.kpi === r.id ? ' sel' : ''), 'data-id': r.id, 'aria-pressed': this.sel.kpi === r.id ? 'true' : 'false', style: `--c:${c.color}`, onclick: () => { this.sel.kpi = r.id; render(); this.showDetail({ type: 'kpi', id: r.id }); } },
          h('span', { class: 'kl-name' }, r.kpi, h('small', {}, r.element)),
          h('span', { class: 'kl-num' }, h('small', {}, 'Target'), r.target),
          h('span', { class: 'kl-num' }, h('small', {}, d.roadmap.ytdLabel), h('b', {}, r.ytd)),
          h('span', { class: 'badge st-' + r.status }, STATUS_LABEL[r.status]))));
      });
    };
    [['all', 'All'], ...cols.map(c => [c.id, c.name])].forEach(([id, name]) => chips.append(h('button', { 'aria-pressed': id === 'all' ? 'true' : 'false', onclick: e => { cf = id; chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === e.currentTarget)); render(); if (id !== 'all') this.select('kpiCol', id); else this.app.entrance.wall.highlight(null, null); } }, name)));
    b.append(chips, list, h('p', { class: 'hint' }, 'Click a KPI for details, or a house element to see it in the roadmap.'));
    render();
  }

  panel_plant(b) {
    const d = this.data.plant;
    b.append(h('p', { class: 'lede' }, d.intro));
    const list = h('div', { class: 'projects' });
    const render = () => {
      list.innerHTML = '';
      d.zones.forEach(z => {
        const open = this.sel.zone === z.id;
        list.append(h('div', { class: 'proj' + (open ? ' open' : ''), 'data-id': z.id },
          h('button', { class: 'proj-head', 'aria-expanded': open ? 'true' : 'false', onclick: () => { this.sel.zone = open ? null : z.id; render(); if (!open) this.select('zone', z.id); } },
            h('span', { class: 'proj-name' }, z.name), h('span', { class: 'proj-impact' }, z.items[0])),
          open ? h('div', { class: 'proj-body' }, h('ul', {}, z.items.map(it => h('li', {}, it)))) : null));
      });
    };
    b.append(h('h4', {}, 'From supplier to customer'), list);
    render();
    b.append(h('h4', {}, 'Enablers'), h('div', { class: 'enablers' }, d.enablers.map(e => h('span', {}, e))));
    const sw = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: true, onchange: e => this.app.factory.setDigital(e.target.checked) }), h('span', { class: 'track' }), 'Show the real time data layer');
    b.append(sw, h('p', { class: 'hint' }, 'Pick a zone, or a marker in the scene, to fly there.'));
  }

  panel_house(b) {
    const H = this.data.house;
    b.append(h('p', { class: 'lede' }, `${H.heading}. ${H.statement}.`));
    b.append(h('h4', {}, 'Pillars'));
    const grid = h('div', { class: 'pillar-btns' });
    H.pillars.forEach(p => grid.append(h('button', { style: `--c:${p.color}`, onclick: () => this.showDetail({ type: 'house', id: p.id }) }, h('span', { class: 'pb-name' }, p.name), h('small', {}, p.driver))));
    b.append(grid, h('h4', {}, 'System boosters'));
    const bs = h('div', { class: 'pillar-btns' });
    H.boosters.forEach(p => bs.append(h('button', { style: '--c:#1E88D9', onclick: () => this.showDetail({ type: 'house', id: p.id }) }, h('span', { class: 'pb-name' }, p.name), h('small', {}, p.text))));
    b.append(bs, h('p', { class: 'hint' }, 'Click any element here or on the screen: the camera zooms in and its details open on the right.'));
  }

  panel_future(b) {
    const H = this.data.house2027;
    b.append(h('p', { class: 'lede' }, `${H.heading}. New in 2027 is shown in green.`));
    b.append(h('h4', {}, 'Pillars'));
    const grid = h('div', { class: 'pillar-btns' });
    H.pillars.forEach(p => grid.append(h('button', { style: `--c:${p.color}`, onclick: () => this.showDetail({ type: 'house27', id: p.id }) }, h('span', { class: 'pb-name' }, p.name), h('small', {}, p.items.some(i => i.includes('**')) ? 'New targets for 2027' : p.driver))));
    b.append(grid, h('h4', {}, 'System boosters'));
    const bs = h('div', { class: 'pillar-btns' });
    H.boosters.forEach(p => bs.append(h('button', { style: '--c:#1E88D9', onclick: () => this.showDetail({ type: 'house27', id: p.id }) }, h('span', { class: 'pb-name' }, p.name), h('small', {}, p.text))));
    b.append(bs, h('h4', {}, 'In the plant of 2027'));
    const ul = h('ul', { class: 'dt-list' });
    ['Cobots at the assembly stations', 'Holographic live KPIs over every line', 'LED guide lines and more AGVs on the milk run', 'Digital command centre at the entrance'].forEach(t => ul.append(h('li', {}, t)));
    b.append(ul, h('p', { class: 'hint' }, 'Click any element on the screen: the camera zooms in and its 2027 details open on the right.'));
  }

  panel_roadmap(b) {
    const d = this.data;
    b.append(h('div', { class: 'logo-card' }, h('img', { src: $('#bpsLogoImg').src, alt: 'BPS GO!+ Creating value. Together.' })));
    b.append(h('p', { class: 'lede' }, 'Aligned with the House of BPS GO!+, the roadmap plans every element quarter by quarter. Three pillars carry it; the fourth looks back on what we learned.'));
    b.append(this.pillarButtons());
    b.append(h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => this.openRoadmap() }, 'Open the full roadmap')));
    b.append(h('h4', {}, 'Zoom into a block'));
    const blocks = h('div', { class: 'stations' });
    d.roadmap.pillars.forEach(p => p.groups.forEach(g => blocks.append(h('button', { style: `--c:${p.color}`, onclick: () => this.showDetail({ type: 'group', id: g.id }) }, g.name))));
    b.append(blocks, h('p', { class: 'hint' }, 'Click a block here or on the screen: the camera zooms in and the details open on the right. The BPS GO!+ icon opens the full roadmap.'));
  }

  panel_closing(b) {
    const d = this.data.closing;
    b.append(h('p', { class: 'closing-title' }, d.title), h('p', { class: 'lede' }, d.sub));
    b.append(h('h4', {}, 'Commitments for 2027'));
    const ul = h('ul', { class: 'commit' });
    const count = h('p', { class: 'hint' });
    const upd = () => { const n = ul.querySelectorAll('input:checked').length; count.textContent = `${n} of ${d.commitments.length} agreed in the room.`; };
    d.commitments.forEach(c => ul.append(h('li', {}, h('label', {}, h('input', { type: 'checkbox', onchange: upd }), h('span', { class: 'box' }), h('span', {}, c)))));
    b.append(ul, count); upd();
    b.append(h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => this.app.director.go(1) }, 'Replay from the start'),
      h('button', { onclick: () => this.openRoadmap() }, 'Open the roadmap'),
      h('button', { onclick: () => this.toggleExplore(true) }, 'Explore the plant freely')));
    b.append(h('h4', {}, 'Revisit a chapter'), this.agenda(2, CHAPTERS.length - 1));
  }

  // ------------------------------------------------------------ BPS GO!+ roadmap overlay (zoomable)
  buildRoadmap() {
    const d = this.data, rm = d.roadmap, rf = d.reflection;
    const logo = $('#bpsLogoImg').src, lww = $('#lwwImg').src, reflImg = $('#reflImg').src;
    const ov = $('#roadmap'), stage = $('#rmStage'), view = $('#rmView');
    this.rmStage = stage; this.rmView = view;
    // ---- sheet 1: roadmap table (laid out like the BPS GO!+ Roadmap 2026 slide)
    const t = h('table', { class: 'rm-table' });
    const colgroup = h('colgroup', {}, ...[150, 215, 187, 187, 187, 187, 198, 102, 107].map(w => h('col', { style: `width:${w}px` })));
    t.append(colgroup);
    t.append(h('thead', {}, h('tr', {}, h('th', { colspan: 2, class: 'blank' }), ...rm.quarters.map(q => h('th', {}, q)), h('th', {}, 'KPI'), h('th', {}, 'Target'), h('th', {}, rm.ytdLabel))));
    const tb = h('tbody'); t.append(tb);
    const icons = { people: '👥', process: '⚙', system: '🖥' };
    rm.pillars.forEach(p => {
      tb.append(h('tr', { class: 'band', style: `--c:${p.color};--l:${p.light}`, 'data-zone': p.id },
        h('td', { colspan: 2, class: 'band-name zoomable', 'data-target': p.id }, p.name.toUpperCase(), h('span', { class: 'band-ico', 'aria-hidden': 'true' }, icons[p.id] || '')),
        h('td', { colspan: 7, class: 'band-motto zoomable', 'data-target': p.id }, h('span', { class: 'pill' }, h('em', {}, p.motto), ' ', h('b', {}, p.tag)))));
      p.groups.forEach(g => g.rows.forEach((r, i) => {
        const tr = h('tr', { class: 'row', style: `--c:${p.color};--l:${p.light}`, 'data-zone': `${p.id} ${g.id}`, 'data-row': r.id });
        if (i === 0) tr.append(h('td', { rowspan: g.rows.length, class: 'grp zoomable', 'data-target': g.id }, g.name));
        tr.append(h('td', { class: 'el' }, r.element));
        r.q.forEach(([txt, done]) => tr.append(h('td', { class: 'q' }, h('span', {}, txt), done ? h('i', { class: 'tick', 'aria-label': 'done' }, '✓') : null)));
        tr.append(h('td', { class: 'q kpi' }, r.kpi), h('td', { class: 'q num' }, r.target), h('td', { class: 'q num' }, r.ytd, h('i', { class: 'sdot st-' + r.status, title: STATUS_LABEL[r.status] })));
        tb.append(tr);
      }));
    });
    const sheet1 = h('div', { class: 'rm-sheet', 'data-zone': 'overview' },
      h('header', { class: 'rm-head' }, h('h2', {}, 'BPS ', h('em', {}, 'GO!'), '+ ROADMAP 2026'), h('img', { class: 'rm-logo', src: logo, alt: 'BPS GO!+' }), h('img', { class: 'rm-lww', src: lww, alt: 'Lead. Work. Win.' })),
      t);
    // ---- sheet 2: reflection (laid out like the Reflection 2026 slide)
    const boxes = rf.boxes.map(bx => h('div', { class: 'rf-box zoomable', 'data-zone': bx.id, 'data-target': bx.id },
      h('h3', {}, bx.title), h('div', { class: 'rf-card' }, bx.items.map(it => h('p', {}, rich(it))), bx.id === 'better' ? h('span', { class: 'trophy', 'aria-hidden': 'true' }, '🏆') : null)));
    const sheet2 = h('div', { class: 'rf-sheet', 'data-zone': 'reflection' },
      h('header', {}, h('h2', {}, d.meta.event), h('h2', { class: 'blue' }, rf.title)),
      h('div', { class: 'rf-body' }, h('img', { src: reflImg, alt: '' }), h('div', { class: 'rf-grid' }, boxes)));
    stage.append(sheet1, sheet2);
    // pillar quick buttons
    const pills = $('#rmPills');
    [['overview', 'Roadmap', '#12161C'], ...rm.pillars.map(p => [p.id, p.name, p.color]), [rf.id, rf.name, rf.color]].forEach(([id, name, c]) =>
      pills.append(h('button', { 'data-id': id, style: `--c:${c}`, onclick: () => this.zoomTo(id === 'overview' ? null : id) }, name)));
    $('#rmClose').onclick = () => this.closeRoadmap();
    stage.addEventListener('click', e => {
      const z = e.target.closest('.zoomable');
      if (z) { const id = z.dataset.target; this.zoomTo(this.rmFocus === id ? this.parentOf(id) : id); return; }
      const row = e.target.closest('tr.row');
      if (row) { const grp = row.dataset.zone.split(' ')[1]; if (this.rmFocus !== grp) this.zoomTo(grp); else this.pickRow(row.dataset.row); }
    });
    addEventListener('resize', () => this.roadmapOpen && this.zoomTo(this.rmFocus, true));
    view.addEventListener('wheel', e => { if (e.deltaY > 0 && this.rmFocus) { e.preventDefault(); this.zoomTo(this.parentOf(this.rmFocus)); } }, { passive: false });
  }
  parentOf(id) {
    const rm = this.data.roadmap;
    for (const p of rm.pillars) if (p.groups.some(g => g.id === id)) return p.id;
    if (this.data.reflection.boxes.some(b => b.id === id)) return this.data.reflection.id;
    return null;
  }
  pillarOf(id) { return this.data.roadmap.pillars.find(p => p.id === id || p.groups.some(g => g.id === id))?.id || ((id === 'reflection' || this.data.reflection.boxes.some(b => b.id === id)) ? 'reflection' : null); }
  openRoadmap(focus = null) {
    if (!this.roadmapOpen) {
      this.roadmapOpen = true; document.body.classList.add('roadmap-open'); $('#roadmap').hidden = false; this.pressed('#btnBpsGo', true);
      this.rmFocus = undefined; this.zoomTo(null, true);
      void $('#roadmap').offsetWidth; $('#roadmap').classList.add('on');
      if (focus) setTimeout(() => this.zoomTo(focus), 420); else this.select('logo', 'logo');
    } else this.zoomTo(focus);
  }
  closeRoadmap() {
    if (!this.roadmapOpen) return;
    this.roadmapOpen = false; document.body.classList.remove('roadmap-open'); this.pressed('#btnBpsGo', false);
    const ov = $('#roadmap'); ov.classList.remove('on'); setTimeout(() => { if (!this.roadmapOpen) ov.hidden = true; }, 350);
    this.app.entrance?.highlight(null);
  }
  pickRow(id) {
    this.rmStage.querySelectorAll('tr.row').forEach(r => r.classList.toggle('picked', r.dataset.row === id));
    this.app.entrance.wall.highlight(allRows(this.data).find(r => r.id === id)?.pillar, id);
  }
  zoomTo(id, instant = false) {
    const stage = this.rmStage, view = this.rmView;
    const sheet = stage.querySelector('.rm-sheet'), refl = stage.querySelector('.rf-sheet');
    let els;
    if (!id) els = [sheet];
    else if (id === this.data.reflection.id) els = [refl];
    else els = [...stage.querySelectorAll(`[data-zone~="${id}"]`)];
    if (!els.length) els = [sheet];
    // a single block (e.g. "Waste free stable flow") also grows its rows, because the table is wider than it is tall
    const isGroup = !!id && this.data.roadmap.pillars.some(p => p.groups.some(g => g.id === id));
    stage.querySelectorAll('tr.big').forEach(r => r.classList.remove('big'));
    if (isGroup) els.forEach(el => el.classList.add('big'));
    // bounding box in stage coordinates (unscaled)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of els) { let x = 0, y = 0, n = el; while (n && n !== stage) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + el.offsetWidth); y1 = Math.max(y1, y + el.offsetHeight); }
    // pillar bands span the full width
    if (id && els[0].tagName === 'TR') { x0 = 0; x1 = sheet.offsetWidth; }
    const pad = id ? 28 : 16, vw = view.clientWidth, vh = view.clientHeight;
    const s = Math.min((vw - pad * 2) / (x1 - x0), (vh - pad * 2) / (y1 - y0), id ? 3.2 : 2);
    const tx = vw / 2 - (x0 + x1) / 2 * s, ty = vh / 2 - (y0 + y1) / 2 * s;
    stage.style.transition = instant ? 'none' : '';
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    this.rmFocus = id;
    stage.querySelectorAll('[data-zone]').forEach(el => el.classList.remove('focus'));
    stage.classList.toggle('zoomed', !!id);
    if (id) els.forEach(el => el.classList.add('focus'));
    const pid = id ? this.pillarOf(id) : null;
    $('#rmPills').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === (pid || 'overview') ? 'true' : 'false'));
    $('#rmCrumb').textContent = id ? this.crumb(id) : 'Click any block to zoom in';
    if (!instant) { if (pid) this.select('pillar', pid); if (!id) this.app.entrance?.highlight(null); }
    if (pid && pid !== 'reflection') this.app.entrance?.wall.highlight(pid, null);
  }
  crumb(id) {
    const rm = this.data.roadmap, rf = this.data.reflection;
    for (const p of rm.pillars) { if (p.id === id) return `${p.name} · ${p.motto} ${p.tag}`; const g = p.groups.find(g => g.id === id); if (g) return `${p.name} › ${g.name}`; }
    if (id === rf.id) return rf.title; const b = rf.boxes.find(b => b.id === id); return b ? `${rf.title} › ${b.title}` : '';
  }

  // ------------------------------------------------------------ 3D pins
  setPins(list) {
    const wrap = $('#pins'); wrap.innerHTML = '';
    this.pins = list.map(p => {
      const el = h('button', { class: 'pin' + (p.compact ? ' compact' : '') + (p.role ? ' role' : '') + (p.type === 'logo' ? ' logo' : ''), 'aria-label': p.label, onclick: () => this.pinClick(p) },
        h('i', { class: 'pin-dot' }), h('span', { class: 'pin-label' }, p.compact ? h('span', { class: 'pin-name' }, p.label) : p.label, p.value ? h('b', {}, p.value) : null));
      wrap.append(el);
      return { ...p, el, v: new THREE.Vector3() };
    });
  }
  pinClick(p) {
    if (p.type === 'role') return;
    if (p.type === 'pillar') { this.openRoadmap(p.id); return; }
    if (p.type === 'logo') { this.openRoadmap(); return; }
    if (!this.panelOpen) this.openPanel();
    if (p.type === 'zone') { const b = document.querySelector(`.proj[data-id="${p.id}"] .proj-head`); if (b && b.getAttribute('aria-expanded') !== 'true') { b.click(); return; } }
    if (p.type === 'kpiPillar') { const b = [...document.querySelectorAll('.chips button')].find(x => x.textContent === p.label); if (b) { b.click(); return; } }
    this.select(p.type, p.id);
  }
  // ------------------------------------------------------------ BPS GO!+ Roadmap 2027 (modern view, one pillar per Next)
  // roadmap27(true | 'open') · roadmap27('sec', k) · roadmap27(false)
  roadmap27(action, k = 0) {
    let el = document.getElementById('rm27'); const R = this.data.roadmap2027;
    if (!action || action === 'close') { if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 500); } this.rm27Open = false; return; }
    if (!R) return;
    if (action === true || action === 'open') {
      el?.remove();
      const tabs = h('div', { class: 'r7-tabs' }, R.sections.map((s, i) => h('button', { class: 'r7-tab', style: `--c:${s.color}`, 'data-i': i, onclick: () => this.roadmap27('sec', i) }, h('b', {}, s.name), h('small', {}, s.rows.length + ' elements'))));
      const secs = R.sections.map((s, i) => {
        let last = null;
        const rows = s.rows.map((r, j) => {
          const grp = r.el !== last ? h('p', { class: 'r7-el' }, r.el) : null; last = r.el;
          const qs = r.q.map((t, qi) => h('div', { class: 'r7-q' + (t ? '' : ' empty'), style: `--qi:${qi}` }, h('i', { class: 'r7-dot' }), h('small', {}, `Q${qi + 1}`), h('span', {}, t || '·')));
          return [grp, h('div', { class: 'r7-row', style: `--j:${j}` },
            h('div', { class: 'r7-name' }, r.new ? h('em', { class: 'r7-new' }, 'NEW') : null, r.name),
            h('div', { class: 'r7-track' }, h('i', { class: 'r7-line' }), qs),
            h('div', { class: 'r7-kpi' }, h('small', {}, r.kpi), h('b', {}, r.target), r.ytd ? h('span', { class: 'r7-ytd' }, 'YTD ' + r.ytd) : null))];
        });
        return h('section', { class: 'r7-sec', 'data-i': i, style: `--c:${s.color}` },
          h('div', { class: 'r7-sechead' }, h('h3', {}, s.name), h('p', { class: 'r7-tag' }, s.tag[0], ' ', h('b', {}, s.tag[1]))),
          h('div', { class: 'r7-cols' }, h('span', {}, 'Element'), h('span', { class: 'r7-qh' }, ['1Q', '2Q', '3Q', '4Q'].map(q => h('i', {}, q + '/2027'))), h('span', {}, 'KPI · Target')),
          h('div', { class: 'r7-rows' }, rows.flat()));
      });
      el = h('section', { id: 'rm27' }, h('div', { class: 'r7-head' }, h('h2', {}, R.title), tabs), h('div', { class: 'r7-stage' }, secs));
      document.body.append(el); this.rm27Open = true;
      requestAnimationFrame(() => el.classList.add('on'));
      k = 0;
    }
    if (!el) return;
    el.querySelectorAll('.r7-sec').forEach(s => { const on = +s.dataset.i === k; s.classList.toggle('on', on); s.classList.toggle('past', +s.dataset.i < k); });
    el.querySelectorAll('.r7-tab').forEach(t => t.classList.toggle('on', +t.dataset.i === k));
  }
  // ------------------------------------------------------------ closing football film (embedded HTML, full screen)
  goalFilm(on) {
    let el = document.getElementById('goalfilm');
    if (!on) { if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 600); } return; }
    const b64 = (document.getElementById('goal-film')?.textContent || '').trim(); if (!b64) return;
    el?.remove();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), html = new TextDecoder('utf-8').decode(bytes);
    const fr = h('iframe', { title: 'Part 2 · The Comeback · closing film', tabindex: '-1' });
    el = h('section', { id: 'goalfilm' }, fr);
    document.body.append(el);
    fr.addEventListener('load', () => {
      try { const doc = fr.contentDocument; const st = doc.createElement('style'); st.textContent = '#controls, #pauseBadge { display: none !important; }'; doc.head.append(st); doc.getElementById('btnPlay')?.click(); } catch (e) { /* film shows its own Play button */ }
      fr.blur(); window.focus(); // keys stay with the presentation (Next / Back)
    });
    fr.srcdoc = html;
    requestAnimationFrame(() => el.classList.add('on'));
  }
  // ------------------------------------------------------------ Challenges & Support Required
  // 'open' | 'ch' k | 'sup' k | 'close'
  challenges(action, k) {
    const C = this.data.challenges2027; let el = document.getElementById('chsu');
    if (action === 'close') { if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 500); } return; }
    if (!C) return;
    if (action === 'open') {
      el?.remove();
      const card = (it, i, kind) => h('div', { class: 'cs-card ' + kind, 'data-i': i },
        h('span', { class: 'cs-n' }, String(i + 1).padStart(2, '0')), h('span', { class: 'cs-ic' }, it.icon), h('p', {}, it.text),
        kind === 'ch' ? h('i', { class: 'cs-crack', 'aria-hidden': 'true' }) : h('i', { class: 'cs-beam', 'aria-hidden': 'true' }));
      el = h('section', { id: 'chsu' },
        h('div', { class: 'cs-bg', 'aria-hidden': 'true' }),
        h('h2', { class: 'cs-title' }, 'Challenges', h('em', {}, ' & '), 'Support Required'),
        h('div', { class: 'cs-cols' },
          h('div', { class: 'cs-col ch' }, h('p', { class: 'cs-h' }, '⚠️ Challenges'), C.challenges.map((it, i) => card(it, i, 'ch'))),
          h('div', { class: 'cs-mid', 'aria-hidden': 'true' }, h('div', { class: 'cs-goal' }, h('b', {}, '2027'), h('small', {}, 'Goal'))),
          h('div', { class: 'cs-col su' }, h('p', { class: 'cs-h' }, '🤝 Support Required'), C.support.map((it, i) => card(it, i, 'su')))));
      document.body.append(el);
      requestAnimationFrame(() => el.classList.add('on'));
      return;
    }
    if (!el) return;
    const c = el.querySelector(`.cs-col.${action === 'ch' ? 'ch' : 'su'} .cs-card[data-i="${k}"]`); if (!c) return;
    c.classList.add('in');
    if (action === 'ch') setTimeout(() => { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }, 380);
    // the goal lights up as support arrives
    const n = el.querySelectorAll('.cs-card.su.in').length; el.querySelector('.cs-goal').style.setProperty('--lit', n / C.support.length);
    if (action === 'sup' && n === C.support.length) setTimeout(() => this.crackers(el, [[40, 30, 20, 30]], 2600), 700);
  }
  // ------------------------------------------------------------ Target 2027 boards (Gemba walk in the 2027 plant)
  // 'open' i board | 'card' i k | 'close'
  t27Board(action, i, b) {
    const T = (this.data.targets2027 || {}).boards || [];
    let root = document.getElementById('t27b');
    if (action === 'close') { if (root) root.remove(); this.t27Track = null; return; }
    const B = T[i]; if (!B) return;
    if (action === 'open') {
      if (root) root.remove();
      const cols = B.cols || 2, grouped = !!B.groups;
      const cards = B.cards.map((c, k) => {
        const el = h('div', { class: 'tb-card', 'data-k': k },
          h('span', { class: 'tb-num' }, String(k + 1).padStart(2, '0')),
          h('div', { class: 'tb-icon' }, c.icon || '🎯'),
          h('p', { class: 'tb-label' }, c.label),
          h('p', { class: 'tb-big' + (String(c.big).length > 12 ? ' long' : '') }, h('b', {}, c.big), c.unit ? h('small', {}, ' ' + c.unit) : null),
          c.sub ? h('p', { class: 'tb-sub' }, c.sub) : null,
          c.delta ? h('p', { class: 'tb-delta ' + c.delta.dir }, h('i', {}, c.delta.dir === 'down' ? '▼' : '▲'), c.delta.text) : null,
          h('i', { class: 'tb-wave', 'aria-hidden': 'true' }), h('i', { class: 'tb-scan', 'aria-hidden': 'true' }));
        if (grouped) { const g = c.group || 0, r = B.cards.filter((x, j) => j < k && (x.group || 0) === g).length; el.style.gridColumn = String(g + 1); el.style.gridRow = String(r + 2); }
        return el;
      });
      const grid = h('div', { class: 'tb-grid', style: `--cols:${cols}` },
        grouped ? B.groups.map((g, j) => h('p', { class: 'tb-group', style: `grid-column:${j + 1};grid-row:1` }, g)) : null, cards);
      const board = h('div', { class: 'tb-board' + (grouped ? ' grouped' : '') + (B.cards.length > 4 ? ' many' : '') },
        h('div', { class: 'tb-head' }, h('span', { class: 'tb-kicker' }, B.kicker), h('h2', { class: 'tb-title' }, B.title),
          h('div', { class: 'tb-dots' }, B.cards.map(() => h('i', {})))), grid);
      root = h('section', { id: 't27b', 'aria-live': 'polite' }, board);
      document.body.append(root);
      this.t27Track = b ? { obj: b.obj, w: b.w, h: b.h, el: board } : null;
      requestAnimationFrame(() => root.classList.add('on'));
      return;
    }
    if (action === 'card' && root) {
      const k = b, el = root.querySelector(`.tb-card[data-k="${k}"]`), board = root.querySelector('.tb-board'); if (!el) return;
      root.querySelectorAll('.tb-card').forEach((c, j) => { if (j < k) c.classList.add('in', 'done'); });
      el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
      root.querySelectorAll('.tb-dots i').forEach((d, j) => d.classList.toggle('on', j <= k));
      // the board takes the hit
      setTimeout(() => { board.classList.remove('hit'); void board.offsetWidth; board.classList.add('hit'); }, 430);
      // numbers count up
      const bEl = el.querySelector('.tb-big b'), txt = String(B.cards[k].big), m = txt.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
      if (m && bEl) { const to = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length, t0 = performance.now() + 380;
        const step = now => { const u = Math.min(1, Math.max(0, (now - t0) / 900)), e = 1 - Math.pow(1 - u, 3); bEl.textContent = m[1] + (to * e).toFixed(dec) + m[3]; if (u < 1 && el.isConnected) requestAnimationFrame(step); };
        bEl.textContent = m[1] + (0).toFixed(dec) + m[3]; requestAnimationFrame(step); }
    }
  }
  _trackEl(B, el, camera, W, H) {
    const v = this._glV ||= [0, 1, 2, 3].map(() => new THREE.Vector3());
    B.obj.updateMatrixWorld();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => { const p = v[k].set(sx * B.w / 2, sy * B.h / 2, 0.01); B.obj.localToWorld(p); p.project(camera); if (p.z > 1) behind = true;
      const X = (p.x * 0.5 + 0.5) * W, Y = (-p.y * 0.5 + 0.5) * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); });
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px'; el.style.width = Math.max(0, x1 - x0) + 'px'; el.style.height = Math.max(0, y1 - y0) + 'px';
    el.style.visibility = behind ? 'hidden' : '';
  }
  // keep the Glimpses slide exactly on its board in the plant (Gemba walk)
  trackGlimpse(camera, W, H) {
    if (this.t27Track && this.t27Track.el.isConnected) this._trackEl(this.t27Track, this.t27Track.el, camera, W, H);
    const B = this.glBoard, sec = document.getElementById('glimpses'); if (!B || !sec || sec.hidden) return;
    const v = this._glV ||= [0, 1, 2, 3].map(() => new THREE.Vector3());
    B.obj.updateMatrixWorld();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => { const p = v[k].set(sx * B.w / 2, sy * B.h / 2, 0.01); B.obj.localToWorld(p); p.project(camera); if (p.z > 1) behind = true;
      const X = (p.x * 0.5 + 0.5) * W, Y = (-p.y * 0.5 + 0.5) * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); });
    const sl = sec.querySelector('.gl-slide'); if (!sl) return;
    sl.style.left = x0 + 'px'; sl.style.top = y0 + 'px'; sl.style.width = Math.max(0, x1 - x0) + 'px'; sl.style.height = Math.max(0, y1 - y0) + 'px';
    sl.style.setProperty('--gls', ((x1 - x0) / Math.max(1, W)).toFixed(3)); sl.style.visibility = behind ? 'hidden' : '';
  }
  updatePins(camera, W, H) {
    for (const p of this.pins) {
      const pos = typeof p.pos === 'function' ? p.pos() : p.pos;
      if (!pos) { p.el.style.display = 'none'; continue; }
      p.v.copy(pos).project(camera);
      const vis = p.v.z < 1 && Math.abs(p.v.x) < 1.05 && Math.abs(p.v.y) < 1.05;
      p.el.style.display = vis ? '' : 'none';
      if (vis) p.el.style.transform = `translate(${(p.v.x * 0.5 + 0.5) * W}px, ${(-p.v.y * 0.5 + 0.5) * H}px)`;
    }
  }
}
