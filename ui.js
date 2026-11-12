import { THREE } from './lib.js';
import { fmt, clamp } from './util.js';
import { CHAPTERS } from './director.js';
import { attainment, last } from './rooms.js';

const $ = (s, r = document) => r.querySelector(s);
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
const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) { const e = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; }
const pad = n => String(n).padStart(2, '0');
const isNarrow = () => innerWidth <= 900;

export class UI {
  constructor(app) {
    this.app = app; this.data = app.data;
    this.cc = true; this.autoplay = false; this.autoplayHold = 10; this.presenting = false; this.explore = false; this.roles = false;
    this.pins = []; this.panelOpen = false; this.capTimer = null; this.startTime = 0;
    this.viewShift = { x: 0, y: 0, cx: 0, cy: 0 };
    this.sel = {};
    this.buildStatic();
    this.bindKeys();
  }

  // ------------------------------------------------------------ static chrome
  buildStatic() {
    const d = this.data;
    $('#plantName').textContent = `${d.meta.org} ${d.meta.plant}`;
    $('#introPlant').textContent = `${d.meta.org} ${d.meta.plant}, ${d.meta.date}`;
    $('#introTag').textContent = d.meta.tagline;
    // rail
    const rail = $('#railStations');
    CHAPTERS.forEach((c, i) => {
      if (i === 0) return;
      rail.append(h('button', { class: 'station', 'data-i': i, onclick: () => this.app.director.go(i), 'aria-label': `Chapter ${i}: ${c.title}` },
        h('span', { class: 'st-num' }, pad(i)), h('span', { class: 'st-name' }, c.title)));
    });
    $('#btnCC').onclick = () => this.toggleCC();
    $('#btnRoles').onclick = () => { this.rolesByUser = true; this.rolesAuto = false; this.toggleRoles(); };
    $('#btnExplore').onclick = () => this.toggleExplore();
    $('#btnAuto').onclick = () => this.toggleAutoplay();
    $('#btnPresent').onclick = () => this.togglePresent();
    $('#btnHelp').onclick = () => this.toggleHelp();
    $('#btnSkip').onclick = () => this.app.director.skip();
    $('#btnReset').onclick = () => this.app.director.resetView();
    $('#panelToggle').onclick = () => this.panelOpen ? this.closePanel() : this.openPanel();
    $('#panelTab').onclick = () => this.openPanel();
    $('#btnPrev').onclick = () => this.app.director.prev();
    $('#btnNext').onclick = () => this.app.director.next();
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
      if (d.index === 0 && ['ArrowRight', 'PageDown', ' ', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); return; } // first chapter is already starting
      if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); d.scriptDone ? d.next() : d.skip(); }
      else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); d.prev(); }
      else if (k === 'Home') d.go(1); else if (k === 'End') d.go(CHAPTERS.length - 1);
      else if (/^[1-7]$/.test(k)) d.go(+k);
      else if (k === 's' || k === 'S') d.skip();
      else if (k === 'c' || k === 'C') this.toggleCC();
      else if (k === 'p' || k === 'P') this.togglePresent();
      else if (k === 'f' || k === 'F') this.toggleExplore();
      else if (k === 'a' || k === 'A') this.toggleAutoplay();
      else if (k === 'r' || k === 'R') { this.rolesByUser = true; this.rolesAuto = false; this.toggleRoles(); }
      else if (k === 'h' || k === 'H') this.panelOpen ? this.closePanel() : this.openPanel();
      else if (k === '?') this.toggleHelp();
      else if (k === 'Escape') { if (!$('#help').hidden) this.toggleHelp(false); else if (this.explore) this.toggleExplore(false); }
    });
  }

  // ------------------------------------------------------------ toggles
  pressed(id, on) { $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); }
  toggleCC(v = !this.cc) { this.cc = v; this.pressed('#btnCC', v); document.body.classList.toggle('no-cc', !v); }
  toggleRoles(v = !this.roles) { this.roles = v; this.pressed('#btnRoles', v); document.body.classList.toggle('show-roles', v); }
  toggleAutoplay(v = !this.autoplay) { this.autoplay = v; this.pressed('#btnAuto', v); this.toast(v ? 'Autoplay on: chapters advance on their own' : 'Autoplay off'); }
  toggleHelp(v) { const el = $('#help'); el.hidden = v === undefined ? !el.hidden : !v; }
  toggleExplore(v = !this.explore) {
    this.explore = v; this.pressed('#btnExplore', v); document.body.classList.toggle('exploring', v);
    this.app.setExplore(v);
    if (v) this.toast('Free camera: drag to orbit, scroll to zoom. Press F to return.');
    else this.app.director.resetView();
  }
  togglePresent(v = !this.presenting) {
    this.presenting = v; this.pressed('#btnPresent', v); document.body.classList.toggle('presenting', v);
    if (v) { if (!this.startTime) this.startTime = performance.now(); document.documentElement.requestFullscreen?.().catch(() => { }); this.toast('Presentation mode: → / clicker for next, ← for back, ? for shortcuts'); }
    else if (document.fullscreenElement) document.exitFullscreen?.();
    setTimeout(() => this.app.resize(), 120);
  }
  toast(text) {
    const t = $('#toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(this._toast); this._toast = setTimeout(() => t.classList.remove('on'), 3200);
  }

  // ------------------------------------------------------------ cinematic layers
  fade(to, dur) { const f = $('#fade'); f.style.transitionDuration = dur + 's'; f.style.opacity = to; }
  letterbox(on) { document.body.classList.toggle('cinema', on); }
  showSkip(on) { $('#btnSkip').hidden = !on; }
  showResetView(on) { $('#btnReset').hidden = !on; }
  titleCard(i, title, sub) {
    const tc = $('#titlecard');
    tc.classList.remove('on'); void tc.offsetWidth;
    $('.tc-num', tc).textContent = pad(i);
    const t = $('.tc-title', tc); t.innerHTML = '';
    [...title].forEach((ch, k) => t.append(h('span', { style: `--k:${k}` }, ch === ' ' ? ' ' : ch)));
    $('.tc-sub', tc).textContent = sub || '';
    tc.classList.add('on');
    clearTimeout(this._tc); this._tc = setTimeout(() => tc.classList.remove('on'), 3300);
  }
  hideTitleCard() { $('#titlecard').classList.remove('on'); }
  bigTitle(text) {
    const b = $('#bigtitle'); b.innerHTML = '';
    text.split(' ').forEach((w, i) => b.append(h('span', { style: `--k:${i}` }, w), ' '));
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  caption(text, { kind = 'line', hold } = {}) {
    if (kind === 'marker') {
      const m = $('#marker'); m.textContent = ''; m.classList.remove('on'); void m.offsetWidth;
      [...text].forEach((c, k) => m.append(h('span', { style: `--k:${k}` }, c)));
      m.classList.add('on'); clearTimeout(this._mk); this._mk = setTimeout(() => m.classList.remove('on'), 4200);
      return;
    }
    const box = $('#captions');
    const old = box.querySelector('.cap.on'); if (old) { old.classList.remove('on'); old.classList.add('out'); setTimeout(() => old.remove(), 500); }
    const line = h('p', { class: 'cap' });
    text.split(' ').forEach((w, k) => { line.append(h('span', { style: `--k:${k}` }, w)); line.append(' '); });
    box.append(line); void line.offsetWidth; line.classList.add('on');
    clearTimeout(this.capTimer);
    const ms = hold ? hold * 1000 : 2200 + text.length * 45;
    this.capTimer = setTimeout(() => { line.classList.remove('on'); line.classList.add('out'); setTimeout(() => line.remove(), 500); }, ms);
  }
  clearCaptions() { $('#captions').innerHTML = ''; $('#marker').classList.remove('on'); $('#bigtitle').classList.remove('on'); clearTimeout(this.capTimer); }

  // ------------------------------------------------------------ rail / progress
  setChapter(i) {
    this.chapter = i;
    document.querySelectorAll('.station').forEach(b => { const k = +b.dataset.i; b.classList.toggle('done', k < i); b.classList.toggle('current', k === i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    $('#hudChapter').textContent = i ? `${pad(i)} / ${pad(CHAPTERS.length - 1)}` : '';
    $('#hudTitle').textContent = CHAPTERS[i].title;
    document.body.dataset.chapter = CHAPTERS[i].id;
    if (this.rolesAuto && CHAPTERS[i].id !== 'arrival') { this.toggleRoles(false); this.rolesAuto = false; }
    this.renderPanel(i);
  }
  setProgress(i, p) {
    const n = CHAPTERS.length - 1; if (!i) { $('#railFill').style.transform = 'scaleX(0)'; return; }
    const at = (i - 1) / (n - 1), frac = clamp(at + p * 0.45 / (n - 1), 0, 1);
    $('#railFill').style.transform = `scaleX(${frac})`;
    $('#railPart').style.left = `${at * 100}%`;
    if (this.startTime) { const s = Math.floor((performance.now() - this.startTime) / 1000); $('#hudTime').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }
  }

  // ------------------------------------------------------------ panel
  openPanel() { const ch = CHAPTERS[this.chapter]; if (!ch || ch.id === 'opening') return; this.panelOpen = true; document.body.classList.add('panel-open'); this.pressed('#panelToggle', true); $('#panelToggle').textContent = 'Hide'; this.animateCounters(); }
  closePanel(silent) { this.panelOpen = false; document.body.classList.remove('panel-open'); $('#panelToggle').textContent = 'Show'; }
  panelSize() { const p = $('#panel'); return { w: p.offsetWidth, h: p.offsetHeight }; }
  renderPanel(i) {
    const ch = CHAPTERS[i], body = $('#panelBody');
    $('#panelNum').textContent = pad(i); $('#panelTitle').textContent = ch.title;
    $('#panelFoot').textContent = this.data.meta.sampleNotice;
    body.innerHTML = ''; body.scrollTop = 0; this.sel = {};
    const fn = this['panel_' + ch.id]; if (fn) fn.call(this, body);
  }
  animateCounters() {
    document.querySelectorAll('#panel [data-count]').forEach(el => {
      const to = +el.dataset.count, dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      const t0 = performance.now();
      const step = (t) => { const k = clamp((t - t0) / 1300, 0, 1), e = 1 - Math.pow(1 - k, 4); el.textContent = pre + fmt(to * e, dec) + suf; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  select(type, id, opts) { this.app.director.select(type, id, opts); this.pins.forEach(p => p.el.classList.toggle('sel', p.type === type && p.id === id)); }

  panel_arrival(b) {
    const d = this.data;
    b.append(h('p', { class: 'lede' }, `${d.meta.date}, ${d.meta.plant}. ${d.meta.tagline}.`));
    b.append(h('h4', {}, 'Agenda'));
    const ol = h('ol', { class: 'agenda' });
    CHAPTERS.slice(2).forEach((c, k) => ol.append(h('li', {}, h('button', { onclick: () => this.app.director.go(k + 2) }, h('span', { class: 'ag-n' }, pad(k + 2)), h('span', {}, h('strong', {}, c.title), h('small', {}, c.sub))))));
    b.append(ol);
    b.append(h('h4', {}, 'In the room'));
    const ul = h('ul', { class: 'cast' });
    d.cast.forEach(c => ul.append(h('li', { class: c.id === 'ph' ? 'lead' : '' }, h('span', { class: 'dot' }), c.role)));
    b.append(ul);
    b.append(h('p', { class: 'hint' }, 'Move on with the arrow keys or a presentation clicker. Turn on Roles to label everyone in the scene.'));
  }

  panel_achievements(b) {
    const d = this.data.achievements;
    b.append(h('p', { class: 'lede' }, d.intro));
    const grid = h('div', { class: 'metric-grid', role: 'group', 'aria-label': 'Headline results' });
    d.headline.forEach((m, i) => {
      const btn = h('button', { class: 'metric', 'aria-pressed': 'false', onclick: () => { grid.querySelectorAll('.metric').forEach(x => x.setAttribute('aria-pressed', 'false')); btn.setAttribute('aria-pressed', 'true'); this.select('achievement', i); } },
        h('span', { class: 'm-label' }, m.short),
        h('span', { class: 'm-val', 'data-count': m.value, 'data-dec': m.decimals, 'data-pre': m.prefix || '', 'data-suf': m.unit }, '0'),
        h('span', { class: 'm-delta' }, m.delta));
      grid.append(btn);
    });
    b.append(grid, h('p', { class: 'hint' }, 'Pick a result to see it on the meeting room screen.'));
    b.append(h('h4', {}, 'Milestones'));
    const tl = h('div', { class: 'timeline', role: 'tablist' });
    const detail = h('div', { class: 'tl-detail', role: 'tabpanel' });
    const show = i => { const m = d.milestones[i]; tl.querySelectorAll('button').forEach((x, k) => x.setAttribute('aria-selected', k === i)); detail.innerHTML = ''; detail.append(h('strong', {}, m.title), h('p', {}, m.text)); };
    d.milestones.forEach((m, i) => tl.append(h('button', { role: 'tab', onclick: () => show(i) }, h('span', { class: 'tl-q' }, m.q), h('span', { class: 'tl-t' }, m.title))));
    b.append(tl, detail); show(0);
    b.append(h('h4', {}, 'Also in 2026'));
    const hl = h('ul', { class: 'highlights' });
    d.highlights.forEach(x => hl.append(h('li', {}, h('strong', {}, x.title), h('span', {}, x.text))));
    b.append(hl);
  }

  panel_lean(b) {
    const d = this.data.lean;
    b.append(h('p', { class: 'lede' }, d.intro));
    // radar
    const W = 400, H = 330, cx = 200, cy = 165, R = 112, n = d.principles.length;
    const ang = i => -Math.PI / 2 + i * Math.PI * 2 / n;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 5, cy + Math.sin(ang(i)) * R * v / 5];
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'radar', role: 'img', 'aria-label': 'BPS principle maturity 2025 versus 2026' });
    for (let r = 1; r <= 5; r++) svg.append(s('polygon', { points: d.principles.map((_, i) => pt(i, r).join(',')).join(' '), class: 'ring' + (r === 5 ? ' outer' : '') }));
    d.principles.forEach((_, i) => svg.append(s('line', { x1: cx, y1: cy, x2: pt(i, 5)[0], y2: pt(i, 5)[1], class: 'axis' })));
    svg.append(s('polygon', { points: d.principles.map((p, i) => pt(i, p.y2025).join(',')).join(' '), class: 'poly y25' }));
    svg.append(s('polygon', { points: d.principles.map((p, i) => pt(i, p.y2026).join(',')).join(' '), class: 'poly y26' }));
    const detail = h('div', { class: 'pr-detail' });
    const labels = [];
    const pick = i => {
      const p = d.principles[i]; labels.forEach((l, k) => l.classList.toggle('sel', k === i));
      detail.innerHTML = ''; detail.append(h('div', { class: 'pr-head' }, h('strong', {}, p.name), h('span', { class: 'pr-score' }, `${p.y2025.toFixed(1)} → ${p.y2026.toFixed(1)}`)), h('p', {}, p.action));
    };
    d.principles.forEach((p, i) => {
      const [x, y] = pt(i, 6.1), a = ang(i), anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      const words = p.name.split(' '); const lines = p.name.length > 13 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [p.name];
      const g = s('g', { class: 'lbl', tabindex: '0', role: 'button', 'aria-label': p.name, onclick: () => pick(i), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } } });
      lines.forEach((ln, k) => g.append(s('text', { x, y: y + (k - (lines.length - 1) / 2) * 14 + 4, 'text-anchor': anchor }, ln)));
      g.append(s('circle', { cx: pt(i, p.y2026)[0], cy: pt(i, p.y2026)[1], r: 4, class: 'dot26' }));
      svg.append(g); labels.push(g);
    });
    b.append(h('h4', {}, 'BPS principle maturity'), h('div', { class: 'legend' }, h('span', { class: 'k25' }, '2025'), h('span', { class: 'k26' }, '2026'), h('span', { class: 'scale' }, 'Scale 1 to 5')), svg, detail);
    pick(1);
    b.append(h('h4', {}, 'Before and after'));
    const tbl = h('div', { class: 'ba' });
    d.metrics.forEach(m => {
      const pct = Math.round((m.after - m.before) / m.before * 100);
      tbl.append(h('div', { class: 'ba-row' },
        h('span', { class: 'ba-l' }, m.label),
        h('span', { class: 'ba-bars' }, h('i', { class: 'b0', style: 'width:100%' }), h('i', { class: 'b1', style: `width:${m.after / m.before * 100}%` })),
        h('span', { class: 'ba-v' }, `${fmt(m.before, m.decimals)} → ${fmt(m.after, m.decimals)}${m.unit}`),
        h('span', { class: 'ba-p' }, `${pct}%`)));
    });
    b.append(tbl);
    b.append(h('h4', {}, 'On the shop floor'));
    const list = h('div', { class: 'stations' });
    const det = h('p', { class: 'st-detail' });
    d.stations.forEach(st => list.append(h('button', { 'data-id': st.id, onclick: (e) => { list.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === st.id)); det.textContent = st.text; this.select('station', st.id); } }, st.title)));
    b.append(list, det, h('p', { class: 'hint' }, 'Pick a station, or a marker in the scene, to fly there.'));
  }

  panel_digital(b) {
    const d = this.data.digital;
    b.append(h('p', { class: 'lede' }, d.intro));
    const statuses = ['All', 'Live', 'Scaling', 'Pilot', 'Planned'];
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by status' });
    const list = h('div', { class: 'projects' });
    let filter = 'All';
    const render = () => {
      list.innerHTML = '';
      d.projects.filter(p => filter === 'All' || p.status === filter).forEach(p => {
        const open = this.sel.project === p.id;
        const card = h('div', { class: 'proj' + (open ? ' open' : '') },
          h('button', { class: 'proj-head', 'aria-expanded': open ? 'true' : 'false', onclick: () => { this.sel.project = open ? null : p.id; render(); if (!open) this.select('project', p.id); } },
            h('span', { class: 'proj-name' }, p.name), h('span', { class: 'badge s-' + p.status.toLowerCase() }, p.status),
            h('span', { class: 'prog' }, h('i', { style: `width:${p.progress}%` })), h('span', { class: 'proj-impact' }, p.impact)),
          open ? h('div', { class: 'proj-body' }, h('p', {}, p.text), h('p', { class: 'owner' }, `Owner: ${p.owner}. Progress ${p.progress}%.`)) : null);
        list.append(card);
      });
    };
    statuses.forEach(st => {
      const n = st === 'All' ? d.projects.length : d.projects.filter(p => p.status === st).length;
      if (!n) return;
      chips.append(h('button', { 'aria-pressed': st === 'All' ? 'true' : 'false', onclick: e => { filter = st; chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === e.currentTarget)); render(); } }, `${st} ${n}`));
    });
    const sw = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: true, onchange: e => this.app.factory.setDigital(e.target.checked) }), h('span', { class: 'track' }), 'Show the digital layer');
    b.append(chips, list, sw);
    render();
  }

  panel_kpis(b) {
    const d = this.data.kpis;
    b.append(h('p', { class: 'lede' }, d.intro));
    const periods = [['Q1', 2], ['Q2', 5], ['Q3', 8], ['Q4', 11]];
    let per = 3, selId = d.items[0].id;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' });
    const grid = h('div', { class: 'kpi-grid' });
    const chart = h('div', { class: 'kpi-chart' });
    const drawGrid = () => {
      grid.innerHTML = '';
      d.items.forEach(k => {
        const v = k.monthly[periods[per][1]], ok = attainment(k, v) >= 1;
        grid.append(h('button', { class: 'kpi' + (k.id === selId ? ' sel' : ''), 'aria-pressed': k.id === selId ? 'true' : 'false', onclick: () => { selId = k.id; drawGrid(); drawChart(); this.select('kpi', k.id); } },
          h('span', { class: 'k-name' }, k.name),
          h('span', { class: 'k-val' }, fmt(v, k.decimals), h('small', {}, k.unit)),
          h('span', { class: 'k-tgt' }, `Target ${fmt(k.target, k.decimals)}${k.unit}`),
          h('span', { class: 'k-stat ' + (ok ? 'ok' : 'miss') }, ok ? 'On target' : 'Below target')));
      });
    };
    const drawChart = () => {
      const k = d.items.find(x => x.id === selId), W = 380, H = 170, P = { l: 34, r: 12, t: 16, b: 26 };
      const vals = [...k.monthly, k.target], mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1;
      const X = i => P.l + i * (W - P.l - P.r) / 11, Y = v => P.t + (1 - (v - mn + sp * 0.1) / (sp * 1.2)) * (H - P.t - P.b);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line-chart', role: 'img', 'aria-label': `${k.name} by month against target` });
      svg.append(s('line', { x1: P.l, x2: W - P.r, y1: Y(k.target), y2: Y(k.target), class: 'tgt' }));
      svg.append(s('text', { x: W - P.r, y: Y(k.target) - 6, 'text-anchor': 'end', class: 'tgt-l' }, `Target ${fmt(k.target, k.decimals)}`));
      svg.append(s('path', { d: k.monthly.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(''), class: 'ln' }));
      d.months.forEach((m, i) => { if (i % 2 === 0) svg.append(s('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'ax' }, m)); });
      const tip = s('g', { class: 'tip', visibility: 'hidden' }); const tipBg = s('rect', { rx: 3, height: 22 }); const tipT = s('text', {}); tip.append(tipBg, tipT);
      k.monthly.forEach((v, i) => {
        const ok = attainment(k, v) >= 1;
        svg.append(s('circle', { cx: X(i), cy: Y(v), r: i === periods[per][1] ? 5 : 3, class: ok ? 'pt ok' : 'pt miss' }));
        svg.append(s('rect', { x: X(i) - 14, y: 0, width: 28, height: H, fill: 'transparent', onpointerenter: () => { tip.setAttribute('visibility', 'visible'); tipT.textContent = `${d.months[i]}: ${fmt(v, k.decimals)}${k.unit}`; const tx = clamp(X(i) - 40, 2, W - 100); tipBg.setAttribute('x', tx); tipBg.setAttribute('y', Y(v) - 32); tipBg.setAttribute('width', 96); tipT.setAttribute('x', tx + 8); tipT.setAttribute('y', Y(v) - 17); }, onpointerleave: () => tip.setAttribute('visibility', 'hidden') }));
      });
      svg.append(tip);
      chart.innerHTML = ''; chart.append(h('div', { class: 'chart-head' }, h('strong', {}, k.name), h('span', {}, k.higherBetter ? 'Higher is better' : 'Lower is better')), svg);
    };
    periods.forEach(([l], i) => seg.append(h('button', { 'aria-pressed': i === per ? 'true' : 'false', onclick: e => { per = i; seg.querySelectorAll('button').forEach((x, k) => x.setAttribute('aria-pressed', k === i)); drawGrid(); drawChart(); } }, `End of ${l}`)));
    b.append(seg, grid, chart, h('p', { class: 'hint' }, 'Pick a KPI to raise it in the hologram above the table.'));
    drawGrid(); drawChart();
  }

  panel_strategy(b) {
    const d = this.data.strategy;
    b.append(h('p', { class: 'lede' }, d.intro));
    const house = h('div', { class: 'house', role: 'group', 'aria-label': 'Strategy house 2027' });
    const det = h('div', { class: 'house-detail' });
    const items = [{ id: 'vision', ...d.vision, name: d.vision.title, initiatives: null }, ...d.pillars, { id: 'base', ...d.foundation }];
    const pick = id => {
      house.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === id));
      const it = items.find(x => x.id === id); det.innerHTML = '';
      det.append(h('strong', {}, it.name));
      if (it.target) det.append(h('p', { class: 'tgt' }, `2027 target: ${it.target}`));
      if (it.text) det.append(h('p', {}, it.text));
      if (it.initiatives) { const ul = h('ul', {}); it.initiatives.forEach(x => ul.append(h('li', {}, x))); det.append(ul); }
      gantt.querySelectorAll('.g-row').forEach(r => r.classList.toggle('hl', r.dataset.p === id));
      this.select('pillar', id);
    };
    house.append(h('button', { class: 'roof', 'data-id': 'vision', onclick: () => pick('vision') }, h('span', {}, d.vision.title)));
    const cols = h('div', { class: 'cols' });
    d.pillars.forEach(p => cols.append(h('button', { class: 'pillar', 'data-id': p.id, onclick: () => pick(p.id) }, h('span', {}, p.name))));
    house.append(cols, h('button', { class: 'base', 'data-id': 'base', onclick: () => pick('base') }, d.foundation.name));
    b.append(house, det);
    b.append(h('h4', {}, 'Roadmap 2027'));
    const gantt = h('div', { class: 'gantt' });
    gantt.append(h('div', { class: 'g-head' }, h('span', {}), ...['Q1', 'Q2', 'Q3', 'Q4'].map(q => h('span', {}, q))));
    d.roadmap.forEach(r => gantt.append(h('div', { class: 'g-row', 'data-p': r.pillar }, h('span', { class: 'g-l' }, r.item), h('span', { class: 'g-track' }, h('i', { style: `left:${r.start * 25}%;width:${(r.end - r.start) * 25}%` })))));
    b.append(gantt);
    this._pickPillar = pick;
    setTimeout(() => det.innerHTML || det.append(h('p', { class: 'hint' }, 'Pick a part of the house to see its commitments.')), 0);
  }

  panel_closing(b) {
    const d = this.data.closing;
    b.append(h('p', { class: 'closing-title' }, d.title));
    b.append(h('h4', {}, 'Commitments'));
    const ul = h('ul', { class: 'commit' });
    const count = h('p', { class: 'hint' });
    const upd = () => { const n = ul.querySelectorAll('input:checked').length; count.textContent = `${n} of ${d.commitments.length} agreed in the room.`; };
    d.commitments.forEach((c, i) => ul.append(h('li', {}, h('label', {}, h('input', { type: 'checkbox', onchange: upd }), h('span', { class: 'box' }), h('span', {}, c)))));
    b.append(ul, count); upd();
    b.append(h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => this.app.director.go(1) }, 'Replay from the start'),
      h('button', { onclick: () => this.toggleExplore(true) }, 'Explore the plant freely')));
    b.append(h('h4', {}, 'Revisit a chapter'));
    const ol = h('ol', { class: 'agenda compact' });
    CHAPTERS.slice(2, -1).forEach((c, k) => ol.append(h('li', {}, h('button', { onclick: () => this.app.director.go(k + 2) }, h('span', { class: 'ag-n' }, pad(k + 2)), h('span', {}, h('strong', {}, c.title))))));
    b.append(ol);
  }

  // ------------------------------------------------------------ 3D pins
  setPins(list) {
    const wrap = $('#pins'); wrap.innerHTML = '';
    this.pins = list.map(p => {
      const el = h('button', { class: 'pin' + (p.compact ? ' compact' : '') + (p.role ? ' role' : ''), 'aria-label': p.label, onclick: () => { if (p.type === 'role') return; if (p.type === 'pillar' && this._pickPillar) this._pickPillar(p.id); else this.select(p.type, p.id); this.syncPanel(p.type, p.id); } },
        h('i', { class: 'pin-dot' }), h('span', { class: 'pin-label' }, p.compact ? h('span', { class: 'pin-name' }, p.label) : p.label, p.value ? h('b', {}, p.value) : null));
      wrap.append(el);
      return { ...p, el, v: new THREE.Vector3() };
    });
  }
  syncPanel(type, id) {
    if (!this.panelOpen) this.openPanel();
    if (type === 'station') { const b = document.querySelector(`.stations button[data-id="${id}"]`); b?.click(); }
    if (type === 'project') { this.sel.project = id; const f = document.querySelector('.chips button'); f?.click(); setTimeout(() => document.querySelector('.proj.open')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50); }
    if (type === 'kpi') { [...document.querySelectorAll('.kpi')].find(b => b.querySelector('.k-name').textContent === this.data.kpis.items.find(k => k.id === id).name)?.click(); }
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
