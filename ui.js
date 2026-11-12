import { THREE } from './lib.js';
import { clamp } from './util.js';
import { CHAPTERS } from './director.js';
import { allRows, STATUS_LABEL } from './rooms.js';

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
const pad = n => String(n).padStart(2, '0');
// "**bold** text" → nodes
const rich = text => text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => t.startsWith('**') ? h('strong', {}, t.slice(2, -2)) : t);

export class UI {
  constructor(app) {
    this.app = app; this.data = app.data;
    this.cc = true; this.autoplay = false; this.autoplayHold = 10; this.presenting = false; this.explore = false; this.roles = false; this.paused = false;
    this.pins = []; this.panelOpen = false; this.startTime = 0; this.pausedAt = 0; this.pausedTotal = 0;
    this.timers = new Map(); // pausable UI timers
    this.sel = {};
    this.buildStatic();
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
    $('#plantName').textContent = `${d.meta.event} · ${d.meta.date}`;
    $('#introPlant').textContent = `${d.meta.event} · ${d.meta.date}`;
    $('#introTag').textContent = d.meta.tagline;
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
    $('#btnPause').onclick = () => this.togglePause();
    $('#btnPresent').onclick = () => this.togglePresent();
    $('#btnHelp').onclick = () => this.toggleHelp();
    $('#btnBpsGo').onclick = () => this.roadmapOpen ? this.closeRoadmap() : this.openRoadmap();
    $('#pauseBadge').onclick = () => this.togglePause(false);
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
      if (k === 'Escape') { if (!$('#help').hidden) this.toggleHelp(false); else if (this.roadmapOpen) { if (this.rmFocus) this.zoomTo(null); else this.closeRoadmap(); } else if (this.explore) this.toggleExplore(false); return; }
      if (k === 'k' || k === 'K' || k === 'Pause') { e.preventDefault(); this.togglePause(); return; }
      if (k === 'b' || k === 'B') { this.roadmapOpen ? this.closeRoadmap() : this.openRoadmap(); return; }
      if (this.roadmapOpen) return; // the roadmap overlay keeps the arrow keys for itself
      if (d.index === 0 && ['ArrowRight', 'PageDown', ' ', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); return; } // first chapter is already starting
      if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); if (this.paused) this.togglePause(false); d.scriptDone ? d.next() : d.skip(); }
      else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); d.prev(); }
      else if (k === 'Home') d.go(1); else if (k === 'End') d.go(CHAPTERS.length - 1);
      else if (new RegExp(`^[1-${CHAPTERS.length - 1}]$`).test(k)) d.go(+k);
      else if (k === 's' || k === 'S') d.skip();
      else if (k === 'c' || k === 'C') this.toggleCC();
      else if (k === 'p' || k === 'P') this.togglePresent();
      else if (k === 'f' || k === 'F') this.toggleExplore();
      else if (k === 'a' || k === 'A') this.toggleAutoplay();
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
    $('#btnPause .lg').textContent = v ? 'Play' : 'Pause'; $('#btnPause .sm').textContent = v ? '▶' : '❚❚';
    $('#btnPause').setAttribute('title', v ? 'Play animation (K)' : 'Pause animation (K)');
    const now = performance.now();
    if (v) { this.pausedAt = now; for (const t of this.timers.values()) { clearTimeout(t.id); t.left = Math.max(0, t.end - now); } }
    else {
      this.pausedTotal += now - this.pausedAt;
      for (const [key, t] of this.timers) { t.end = now + t.left; t.id = setTimeout(() => { this.timers.delete(key); t.fn(); }, t.left); }
    }
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
    [...title].forEach((ch, k) => t.append(h('span', { style: `--k:${k}` }, ch === ' ' ? ' ' : ch)));
    $('.tc-sub', tc).textContent = sub || '';
    tc.classList.add('on');
    this.later('tc', 3300, () => tc.classList.remove('on'));
  }
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
    this.chapter = i;
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
  panelSize() { const p = $('#panel'); return { w: p.offsetWidth, h: p.offsetHeight }; }
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
    d.cast.forEach(c => ul.append(h('li', { class: c.id === 'ph' ? 'lead' : '' }, h('span', { class: 'dot' }), c.role)));
    b.append(ul);
    b.append(h('p', { class: 'hint' }, 'Move on with the arrow keys or a presentation clicker. K pauses the animation. The BPS GO!+ icon at the top opens the roadmap at any time.'));
  }

  panel_kpis(b) {
    const d = this.data, rows = allRows(d);
    const count = s => rows.filter(r => r.status === s).length;
    b.append(h('p', { class: 'lede' }, `All ${rows.length} BPS GO!+ KPIs on one wall, target against ${d.roadmap.ytdLabel}.`));
    b.append(h('div', { class: 'status-sum' }, ...['ok', 'watch', 'behind'].map(s => h('div', { class: 'ss s-' + s }, h('b', {}, count(s)), h('span', {}, STATUS_LABEL[s])))));
    let pf = 'all';
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by pillar' });
    const list = h('div', { class: 'kpi-list' });
    const render = () => {
      list.innerHTML = '';
      d.roadmap.pillars.filter(p => pf === 'all' || p.id === pf).forEach(p => {
        list.append(h('div', { class: 'kl-head', style: `--c:${p.color}` }, p.name, h('small', {}, `${p.motto} ${p.tag}`)));
        rows.filter(r => r.pillar === p.id).forEach(r => list.append(h('button', { class: 'kl-row' + (this.sel.kpi === r.id ? ' sel' : ''), 'data-id': r.id, 'aria-pressed': this.sel.kpi === r.id ? 'true' : 'false', style: `--c:${p.color}`, onclick: () => { this.sel.kpi = r.id; render(); this.select('kpi', r.id); } },
          h('span', { class: 'kl-name' }, r.kpi, h('small', {}, r.element)),
          h('span', { class: 'kl-num' }, h('small', {}, 'Target'), r.target),
          h('span', { class: 'kl-num' }, h('small', {}, d.roadmap.ytdLabel), h('b', {}, r.ytd)),
          h('span', { class: 'badge st-' + r.status }, STATUS_LABEL[r.status]))));
      });
    };
    [['all', 'All'], ...d.roadmap.pillars.map(p => [p.id, p.name])].forEach(([id, name]) => chips.append(h('button', { 'aria-pressed': id === 'all' ? 'true' : 'false', onclick: e => { pf = id; chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === e.currentTarget)); render(); if (id !== 'all') this.select('kpiPillar', id); else this.app.entrance.wall.highlight(null, null); } }, name)));
    b.append(chips, list, h('p', { class: 'hint' }, 'Pick a KPI to highlight it on the wall.'));
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

  panel_bpsgo(b) {
    const d = this.data;
    b.append(h('div', { class: 'logo-card' }, h('img', { src: $('#bpsLogoImg').src, alt: 'BPS GO!+ Creating value. Together.' })));
    b.append(h('p', { class: 'lede' }, 'Three pillars carry the 2026 roadmap. The fourth looks back: what we learned.'));
    b.append(this.pillarButtons());
    b.append(h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => this.openRoadmap() }, 'Open the full roadmap')));
    b.append(h('h4', {}, 'Zoom into a block'));
    const blocks = h('div', { class: 'stations' });
    d.roadmap.pillars.forEach(p => p.groups.forEach(g => blocks.append(h('button', { style: `--c:${p.color}`, onclick: () => this.openRoadmap(g.id) }, g.name))));
    b.append(blocks, h('p', { class: 'hint' }, 'In the roadmap, click any block to zoom in. Esc zooms out.'));
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
