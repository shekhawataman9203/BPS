import { THREE, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment } from './lib.js';
import { C, damp, clamp } from './util.js';
import { buildFactory } from './factory.js';
import { buildMeetingRoom, buildEntrance } from './rooms.js';
import { makeCast, makeOperator } from './characters.js';
import { CameraRig } from './camera.js';
import { Director, CHAPTERS, OPS_COUNT } from './director.js';
import { UI } from './ui.js';

// This experience is intentionally silent: no audio elements, no Web Audio, no speech synthesis.

const data = JSON.parse(document.getElementById('workshop-data').textContent);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const isCoarse = matchMedia('(pointer: coarse)').matches;

async function boot() {
  const app = { data };
  const ui = app.ui = new UI(app);
  ui.setLoading(0.05);
  requestAnimationFrame(() => document.body.classList.add('ready'));
  // wait briefly for the display font so canvas textures use it (falls back if offline)
  try { await Promise.race([document.fonts.load('800 40px Archivo'), new Promise(r => setTimeout(r, 1800))]); } catch (e) { }

  // ---------- renderer ----------
  const canvas = document.getElementById('stage');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { document.querySelector('.load-text').textContent = 'This device could not start WebGL. Try a recent Chrome, Edge or Safari.'; return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // daylight sky behind the plant (vertical gradient)
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 512;
  { const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5f8fc6'); gr.addColorStop(0.55, '#a9c6e4'); gr.addColorStop(1, '#dfe8f1'); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); }
  scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;
  scene.fog = new THREE.FogExp2(0xc4d3e2, 0.0052);
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(-20, 9, 24);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  const hemi = new THREE.HemisphereLight(0xe4ecf6, 0x3a3f46, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e6, 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  ui.setLoading(0.2); await nextFrame();

  // ---------- world ----------
  app.factory = buildFactory(scene, renderer, data); ui.setLoading(0.45); await nextFrame();
  app.meeting = buildMeetingRoom(scene, data);
  app.entrance = buildEntrance(scene, data, document.getElementById('bpsLogoImg')); ui.setLoading(0.62); await nextFrame();
  app.cast = makeCast(data);
  Object.values(app.cast).forEach(c => scene.add(c.root));
  app.ops = Array.from({ length: OPS_COUNT }, (_, i) => makeOperator(i));
  app.ops.forEach(o => scene.add(o.root));
  scene.traverse(o => { if (o.isMesh && o.material && o.material.transparent) o.castShadow = false; });
  ui.setLoading(0.75); await nextFrame();

  // ---------- post-processing ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- quality ----------
  const Q = { high: { dpr: 2, shadow: 2048, bloom: true, shadows: true }, medium: { dpr: 1.25, shadow: 1024, bloom: true, shadows: true }, low: { dpr: 1, shadow: 512, bloom: false, shadows: false } };
  // ?quality=low|medium|high in the URL forces a level (handy on weak laptops or projectors)
  const qParam = new URLSearchParams(location.search).get('quality');
  let quality = Q[qParam] ? qParam : isCoarse ? 'medium' : 'high';
  const applyQuality = () => {
    const q = Q[quality];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.dpr));
    renderer.shadowMap.enabled = q.shadows; sun.castShadow = q.shadows;
    if (sun.shadow.map && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
    resize();
  };

  // ---------- camera rig, controls, director ----------
  const rig = app.rig = new CameraRig(camera, canvas);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false; controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.5; controls.maxDistance = 90;
  app.setExplore = (on) => {
    if (on) { rig.stop(); rig.enabled = false; controls.target.copy(rig.tgt); controls.enabled = true; controls.update(); }
    else { controls.enabled = false; rig.pos.copy(camera.position); rig.tgt.copy(controls.target); rig.enabled = true; }
  };
  const director = app.director = new Director(app);
  app.entrance.wall.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  // ---------- clicking the KPI screen opens a details tile ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const screenHit = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(app.entrance.wall.mesh, false)[0];
    return hit && hit.uv ? app.entrance.wall.hitTest(hit.uv) : null;
  };
  let downAt = null, hoverQueued = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    downAt = null;
    if (!document.body.classList.contains('entered')) return;
    const h = screenHit(e); if (h) ui.showDetail(h);
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') hoverQueued = e; });
  app.hoverScreen = () => {
    if (!hoverQueued) return;
    const h = document.body.classList.contains('entered') ? screenHit(hoverQueued) : null; hoverQueued = null;
    app.entrance.wall.setHover(h); canvas.style.cursor = h ? 'pointer' : '';
  };

  // ---------- sizing (with view offset so the scene centres beside the panel) ----------
  let W = innerWidth, H = innerHeight;
  const shift = { x: 0, y: 0 };
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  app.resize = resize;
  addEventListener('resize', resize);
  applyQuality();

  // ---------- warm up ----------
  director.stage('opening'); director.index = 0; ui.setChapter(0);
  rig.update(0.016, 0);
  try { renderer.compile(scene, camera); } catch (e) { }
  ui.setLoading(1);
  ui.fade(0, 1.2);

  // ---------- loop ----------
  const timer = new THREE.Timer(); timer.connect?.(document);
  app.timeScale = 1;
  let t = 0, fpsAcc = 0, fpsN = 0, fpsCheck = 0;
  const everyone = [...Object.values(app.cast), ...app.ops];
  function frame() {
    requestAnimationFrame(frame);
    app.frames = (app.frames || 0) + 1;
    timer.update(); const rawDt = timer.getDelta(); const dt = Math.min(rawDt, 0.05) * (ui.paused ? 0 : app.timeScale); t += dt;
    director.update(dt);
    if (controls.enabled) controls.update(); else rig.update(dt, t);
    for (const c of everyone) c.update(dt);
    app.factory.update(dt, t); app.meeting.wall.update(dt); app.entrance.update(dt, t);
    // shadow light follows the area being looked at
    const focus = controls.enabled ? controls.target : rig.tgt;
    sun.target.position.set(focus.x, 0, focus.z);
    { const fx = focus.x - camera.position.x, fz = focus.z - camera.position.z, l = Math.hypot(fx, fz) || 1, ux = fx / l, uz = fz / l;
      sun.position.set(focus.x + uz * 10 - ux * 6, 22, focus.z - ux * 10 - uz * 6); }
    // view offset toward the free area beside the panel
    const narrow = W <= 900;
    const tx = ui.sideOpen() && !narrow ? Math.min(ui.panelSize().w, W * 0.4) / 2 : 0;
    const ty = ui.sideOpen() && narrow ? Math.min(ui.panelSize().h, H * 0.55) / 2 : 0;
    shift.x = damp(shift.x, tx, 4, dt); shift.y = damp(shift.y, ty, 4, dt);
    if (Math.abs(shift.x) > 0.5 || Math.abs(shift.y) > 0.5) camera.setViewOffset(W, H, shift.x, shift.y, W, H); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    if (Q[quality].bloom) composer.render(); else renderer.render(scene, camera);
    ui.updatePins(camera, W, H);
    app.hoverScreen();
    // adaptive quality after the visitor has entered
    if (document.body.classList.contains('entered') && !document.hidden) {
      fpsAcc += rawDt; fpsN++; fpsCheck += rawDt;
      if (fpsCheck > 3) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsCheck = 0; if (fps < 26 && quality !== 'low') { quality = quality === 'high' ? 'medium' : 'low'; applyQuality(); } }
    }
  }
  frame();
  window.__app = app; // handy for debugging in the console
}
boot();
