import { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment } from './lib.js';
import { Character, GESTURES } from './characters.js';
import { mat, clamp, lerp, damp, angleLerp, FONT } from './util.js';

/*
  2027 closing film: "the goal we promised".
  Eight players near the goal. Mr. Singh (red #10) receives a pass, dribbles past a defender,
  shoots, the ball curls past the diving goalkeeper into the top corner, the camera moves close
  to the net where the MOBILITY AWARD 2027 board rises, then the team celebrates.
  The whole film is a pure function of scene time T (events + tracks), so it can replay and seek.
  Silent by design, like the main workshop file.
*/

const END = 28.0;            // scene seconds until the end card
const PRE = 4.6;             // trailer title card before kick-off (scene time runs from -PRE)
const BALL_R = 0.11;
const GOAL_W = 3.66, GOAL_H = 2.44, NET_D = 2.0;
const smooth = x => x * x * (3 - 2 * x);
const sat = x => clamp(x, 0, 1);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- football poses
const key = (t, ks) => { // piecewise smooth keyframes [[t, v], ...]
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const [t0, v0] = ks[i - 1], [t1, v1] = ks[i]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
  return ks[ks.length - 1][1];
};
GESTURES.fbRun = {
  fadeIn: 0.05, fadeOut: 0.2, fn: (lt, p, c) => {
    const a = c.runAmp, ph = c.runPh, s = Math.sin(ph), co = Math.cos(ph), r = 1 - a;
    return {
      hipY: -0.02 - 0.05 * a + 0.07 * a * Math.abs(co), hipZ: 0,
      hips: [0, 0.14 * s * a, 0], spine: [0.1 + 0.14 * a, 0, 0], chest: [0.02, -0.22 * s * a, 0], neck: [-0.06 * a, 0, 0], head: [-0.05 * a, 0, 0],
      lSh: [0.95 * s * a - 0.1 * r, 0, 0.16 + 0.06 * r], lEl: [-0.9 - 0.55 * a, 0, 0],
      rSh: [-0.95 * s * a - 0.1 * r, 0, -0.16 - 0.06 * r], rEl: [-0.9 - 0.55 * a, 0, 0],
      lHip: [-1.0 * s * a - 0.18 * a - 0.2 * r, 0, 0.04], lKnee: [(0.3 + 1.45 * Math.pow(Math.max(0, co), 1.3)) * a + 0.36 * r, 0, 0],
      rHip: [1.0 * s * a - 0.18 * a - 0.2 * r, 0, -0.04], rKnee: [(0.3 + 1.45 * Math.pow(Math.max(0, -co), 1.3)) * a + 0.36 * r, 0, 0],
    };
  },
};
// right-foot strike, contact at lt = 0.45
GESTURES.fbKick = {
  fadeIn: 0.12, fadeOut: 0.5, fn: lt => ({
    hipY: -0.05, hips: [0, key(lt, [[0, 0], [0.25, 0.25], [0.45, -0.15], [0.8, -0.25]]), 0],
    spine: [key(lt, [[0, 0.16], [0.3, 0.06], [0.45, -0.06], [0.8, 0.06]]), 0, 0],
    chest: [0, key(lt, [[0, 0], [0.25, 0.3], [0.45, -0.2], [0.8, -0.3]]), 0], neck: [0.1, 0, 0], head: [0.25, 0, 0],
    lSh: [-0.35, 0, 1.15], lEl: [-0.45, 0, 0], rSh: [0.55, 0, -0.55], rEl: [-0.6, 0, 0],
    rHip: [key(lt, [[0, -0.2], [0.25, 0.8], [0.45, -0.85], [0.72, -1.55], [1.1, -0.4], [1.5, -0.1]]), 0, -0.06],
    rKnee: [key(lt, [[0, 0.3], [0.25, 1.55], [0.45, 0.15], [0.72, 0.3], [1.1, 0.25]]), 0, 0],
    lHip: [key(lt, [[0, -0.3], [0.3, -0.38], [0.45, -0.22], [0.75, 0.12], [1.1, 0]]), 0, 0.06],
    lKnee: [key(lt, [[0, 0.3], [0.3, 0.5], [0.45, 0.4], [0.75, 0.25]]), 0, 0],
  }),
};
GESTURES.fbKeeper = {
  fadeIn: 0.2, fn: lt => {
    const b = Math.sin(lt * 6) * 0.03;
    return {
      hipY: -0.07 + b * 0.5, hips: [0, 0, 0], spine: [0.3, 0, 0], chest: [0.05, 0, 0], neck: [-0.15, 0, 0], head: [-0.18, 0, 0],
      lSh: [-0.6, 0, 0.5], lEl: [-0.75, 0, 0], rSh: [-0.6, 0, -0.5], rEl: [-0.75, 0, 0],
      lHip: [-0.45, 0, 0.2], lKnee: [0.75 + b, 0, 0], rHip: [-0.45, 0, -0.2], rKnee: [0.75 + b, 0, 0],
    };
  },
};
GESTURES.fbDive = {
  fadeIn: 0.12, fn: () => ({
    hipY: 0, hips: [0, 0, 0], spine: [-0.05, 0, -0.1], chest: [0, 0, -0.1], neck: [0, 0, -0.1], head: [-0.1, 0, -0.15],
    lSh: [-0.2, 0, 2.75], lEl: [-0.15, 0, 0], rSh: [-0.2, 0, -2.95], rEl: [-0.1, 0, 0],
    lHip: [-0.5, 0, 0.25], lKnee: [1.0, 0, 0], rHip: [0.05, 0, -0.12], rKnee: [0.15, 0, 0],
  }),
};
GESTURES.fbHandsHead = {
  fadeIn: 0.45, fn: lt => ({
    spine: [0.04, 0, 0], head: [-0.22 + 0.05 * Math.sin(lt * 1.3), 0, 0],
    lSh: [-2.55, 0, 0.5], lEl: [-2.05, 0, 0], rSh: [-2.55, 0, -0.5], rEl: [-2.05, 0, 0],
    lHip: [0, 0, 0.04], lKnee: [0.05, 0, 0], rHip: [0, 0, -0.04], rKnee: [0.05, 0, 0], hipY: 0,
  }),
};
GESTURES.fbDejected = {
  fadeIn: 0.6, fn: lt => ({
    spine: [0.18, 0, 0], chest: [0.05, 0, 0], neck: [0.2, 0, 0], head: [0.35 + 0.04 * Math.sin(lt * 0.8), 0, 0],
    lSh: [0.3, 0.3, 0.5], lEl: [-1.35, 0, 0], rSh: [0.3, -0.3, -0.5], rEl: [-1.35, 0, 0],
    lHip: [0, 0, 0.07], lKnee: [0.05, 0, 0], rHip: [0, 0, -0.07], rKnee: [0.05, 0, 0], hipY: 0,
  }),
};
// everyone in one line: hands joined low, then raised together (neighbours' hands meet at 1 m spacing)
GESTURES.fbTogether = {
  fadeIn: 0.6, fn: lt => {
    const up = smooth(sat((lt - 1.1) / 0.8)), z = lerp(0.55, 2.6, up), x = lerp(-0.12, 0.12, up);
    return {
      hipY: 0, hips: [0, 0, 0], spine: [0, 0, 0], chest: [-0.04 * up, 0, 0], neck: [0, 0, 0], head: [-0.14 * up, 0, 0],
      lSh: [x, 0, z], lEl: [-0.1, 0, 0], rSh: [x, 0, -z], rEl: [-0.1, 0, 0],
      lHip: [0, 0, 0.05], lKnee: [0.03, 0, 0], rHip: [0, 0, -0.05], rKnee: [0.03, 0, 0],
    };
  },
};
GESTURES.fbAirplane = { fadeIn: 0.3, fn: lt => ({ lSh: [-0.1, 0, 1.45 + 0.05 * Math.sin(lt * 3)], lEl: [-0.1, 0, 0], rSh: [-0.1, 0, -1.45 - 0.05 * Math.sin(lt * 3)], rEl: [-0.1, 0, 0], head: [-0.2, 0, 0], chest: [-0.05, 0, Math.sin(lt * 2.4) * 0.12] }) };

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.redraw = fn => { fn(g, w, h); t.needsUpdate = true; };
  return t;
}
function fit(g, text, maxW, size, weight = 800, stretch = '') {
  let s = size; do { g.font = `${stretch} ${weight} ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > maxW && s > 8); return s + 2;
}
function goldFill(g, y0, y1) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, '#fff3c4'); gr.addColorStop(0.35, '#ffd25a'); gr.addColorStop(0.6, '#d99a1c'); gr.addColorStop(1, '#ffe08a');
  return gr;
}

// ---------------------------------------------------------------- players
function addKit(c, { kit, num, name, numColor = '#ffffff', sock }) {
  const j = c.j;
  // socks over the shins (the thighs keep the shorts colour)
  for (const s of ['l', 'r']) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.05, 0.34, 16), mat(sock, { rough: 0.85 })); m.position.y = -0.2; m.castShadow = true; j[s + 'Knee'].add(m); }
  // name and number on the back, bent around the torso
  const tex = canvasTex(512, 512, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.fillStyle = numColor; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (name) { const s = fit(g, name, W * 0.86, 92, 800, 'condensed'); g.font = `condensed 800 ${s}px ${FONT}`; g.fillText(name, W / 2, 88); }
    g.font = `800 ${name ? 300 : 330}px ${FONT}`; g.fillText(String(num), W / 2, name ? 318 : 280);
  });
  const geo = new THREE.PlaneGeometry(0.3, 0.3, 12, 1);
  geo.rotateY(Math.PI); // face backwards (text reads correctly from behind)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, -Math.sqrt(Math.max(0, 1 - (x / 0.19) ** 2)) * 0.122 - 0.004); }
  geo.computeVertexNormals();
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  back.position.set(0, 0.07, 0); j.chest.add(back);
  // small number on the chest
  const numTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = numColor; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 96px ${FONT}`; g.fillText(String(num), W / 2, H / 2 + 4); });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshStandardMaterial({ map: numTex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  front.position.set(-0.07, 0.11, 0.124); front.rotation.x = -0.12; j.chest.add(front);
  c.kitTex = tex;
}
function makePlayer(o) {
  const c = new Character({ sleeves: o.long ? 'long' : 'short', lanyard: false, jacket: null, tie: false, glasses: false, shoes: 0x111111, ...o });
  addKit(c, o);
  c.runPh = Math.random() * 6; c.runAmp = 0; c.prevPos = V();
  return c;
}

// ---------------------------------------------------------------- world
function buildWorld(scene, logoImg) {
  const world = {};
  // grass with mowing stripes along the pitch
  const grassTex = canvasTex(512, 512, (g, W, H) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3f8a37' : '#4a9a41'; g.fillRect(0, i * H / 8, W, H / 8); }
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.4; }
    g.putImageData(img, 0, 0);
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(160 / 44, 160 / 44);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 40); ground.receiveShadow = true; scene.add(ground);
  // pitch markings
  const lineM = new THREE.MeshStandardMaterial({ color: 0xf4f6f2, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 });
  const line = (x1, z1, x2, z2, w = 0.12) => {
    const len = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), lineM);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(x2 - x1, z2 - z1); m.position.set((x1 + x2) / 2, 0.006, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m);
  };
  line(-34, 0, 34, 0); line(-34, 0, -34, 70); line(34, 0, 34, 70);
  line(-20.16, 0, -20.16, 16.5); line(20.16, 0, 20.16, 16.5); line(-20.16, 16.5, 20.16, 16.5);
  line(-9.16, 0, -9.16, 5.5); line(9.16, 0, 9.16, 5.5); line(-9.16, 5.5, 9.16, 5.5);
  const a0 = Math.asin(5.5 / 9.15);
  const arc = new THREE.Mesh(new THREE.RingGeometry(9.09, 9.21, 64, 1, Math.PI + a0, Math.PI - 2 * a0), lineM);
  arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.006, 11); scene.add(arc);
  const spot = new THREE.Mesh(new THREE.RingGeometry(0, 0.12, 20), lineM); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.006, 11); scene.add(spot);
  for (const sx of [-1, 1]) { const ca = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.06, 20, 1, sx < 0 ? -Math.PI / 2 : Math.PI, Math.PI / 2), lineM); ca.rotation.x = -Math.PI / 2; ca.position.set(sx * 34, 0.006, 0); scene.add(ca); }

  // goal frame
  const white = mat(0xf7f8fa, { rough: 0.35 });
  const post = (x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_H, 20), white); p.position.set(x, GOAL_H / 2, 0); p.castShadow = true; scene.add(p); };
  post(-GOAL_W); post(GOAL_W);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_W * 2 + 0.12, 20), white); bar.rotation.z = Math.PI / 2; bar.position.set(0, GOAL_H, 0); bar.castShadow = true; scene.add(bar);
  const grey = mat(0xc9ced4, { rough: 0.4, metal: 0.4 });
  const tube = (a, b, r = 0.025) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), grey); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); scene.add(m); };
  const topBack = 2.2;
  for (const sx of [-1, 1]) { tube(V(sx * GOAL_W, GOAL_H, 0), V(sx * GOAL_W, topBack, -NET_D)); tube(V(sx * GOAL_W, topBack, -NET_D), V(sx * GOAL_W, 0, -NET_D)); tube(V(sx * GOAL_W, 0, 0), V(sx * GOAL_W, 0, -NET_D)); }
  tube(V(-GOAL_W, 0, -NET_D), V(GOAL_W, 0, -NET_D)); tube(V(-GOAL_W, topBack, -NET_D), V(GOAL_W, topBack, -NET_D));

  // net: a grid of nodes on four panels, segments between neighbours; the back bulges where the ball hits
  const nodes = [], segs = [];
  const panel = (nu, nv, f) => {
    const base = nodes.length;
    for (let v = 0; v <= nv; v++) for (let u = 0; u <= nu; u++) nodes.push(f(u / nu, v / nv));
    const id = (u, v) => base + v * (nu + 1) + u;
    for (let v = 0; v <= nv; v++) for (let u = 0; u <= nu; u++) { if (u < nu) segs.push(id(u, v), id(u + 1, v)); if (v < nv) segs.push(id(u, v), id(u, v + 1)); }
  };
  const topY = z => lerp(GOAL_H, topBack, -z / NET_D);
  panel(40, 12, (u, v) => V(lerp(-GOAL_W, GOAL_W, u), v * topBack, -NET_D));                                // back
  panel(40, 11, (u, v) => { const z = -v * NET_D; return V(lerp(-GOAL_W, GOAL_W, u), topY(z), z); });          // roof
  for (const sx of [-1, 1]) panel(11, 13, (u, v) => { const z = -u * NET_D; return V(sx * GOAL_W, v * topY(z), z); }); // sides
  const netPos = new Float32Array(segs.length * 3);
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.BufferAttribute(netPos, 3));
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  net.frustumCulled = false; scene.add(net);
  world.net = { nodes, segs, pos: netPos, geo: netGeo, cur: nodes.map(n => n.clone()) };
  world.updateNet = (impact, amp) => {
    const { nodes, segs, pos, geo, cur } = world.net;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i], c = cur[i]; c.copy(n);
      if (amp !== 0) {
        const d2 = (n.x - impact.x) ** 2 + (n.y - impact.y) ** 2 * 1.2 + (n.z - impact.z) ** 2 * 0.6;
        const k = Math.exp(-d2 / 0.55) * amp;
        const edge = sat(n.y / 0.25) * sat((topBack - n.y) / 0.25 + (n.z > -NET_D + 0.05 ? 1 : 0)) * sat((GOAL_W - Math.abs(n.x)) / 0.3 + (n.z > -NET_D + 0.05 ? 1 : 0));
        c.z -= k * edge; c.y -= k * 0.25 * edge;
      }
    }
    for (let s = 0; s < segs.length; s++) { const c = cur[segs[s]]; pos[s * 3] = c.x; pos[s * 3 + 1] = c.y; pos[s * 3 + 2] = c.z; }
    geo.attributes.position.needsUpdate = true;
  };
  world.updateNet(V(), 0);

  // LED advertising boards (scrolling)
  const ledText = canvasTex(2048, 96, () => { });
  const drawLed = (mode) => ledText.redraw((g, W, H) => {
    g.fillStyle = mode === 'award' ? '#140d02' : '#0a0f1a'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle'; g.font = `condensed 800 64px ${FONT}`;
    const items = mode === 'award' ? ['MOBILITY AWARD 2027', '★', 'GOAL!', '★'] : ['BPS GO!+', '●', 'LEAD · WORK · WIN', '●', '2027', '●'];
    let x = 30; let i = 0;
    while (x < W) {
      const t = items[i % items.length];
      g.fillStyle = mode === 'award' ? goldFill(g, 10, 86) : (t === '●' ? '#E20015' : '#F4F6F8');
      g.fillText(t, x, H / 2 + 2); x += g.measureText(t).width + 48; i++;
      if (mode !== 'award' && t === 'BPS GO!+' && logoImg && logoImg.complete && logoImg.naturalWidth) { const h = 70, w = h * logoImg.naturalWidth / logoImg.naturalHeight; g.drawImage(logoImg, x - 30, (H - h) / 2, w, h); x += w + 30; }
    }
  });
  drawLed('normal');
  ledText.wrapS = THREE.RepeatWrapping;
  const ledMat = new THREE.MeshBasicMaterial({ map: ledText, toneMapped: false, color: 0xbbbbbb });
  const board = (len, x, z, rotY) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), ledMat.clone()); face.material.map = ledText.clone(); face.material.map.repeat.set(len / 14, 1); face.material.map.wrapS = THREE.RepeatWrapping; face.material.map.needsUpdate = true;
    face.position.y = 0.55; g.add(face);
    const backBox = new THREE.Mesh(new THREE.BoxGeometry(len, 1.0, 0.25), mat(0x15181d, { rough: 0.6 })); backBox.position.set(0, 0.5, -0.14); backBox.castShadow = true; g.add(backBox);
    return face;
  };
  world.leds = [board(44, 0, -5.4, 0), board(50, -36, 22, Math.PI / 2), board(50, 36, 22, -Math.PI / 2)];
  world.setLed = (mode) => { drawLed(mode); world.leds.forEach(f => { f.material.map.image = ledText.image; f.material.map.needsUpdate = true; }); };

  // stands with a crowd
  const concrete = mat(0x5d636c, { rough: 0.9 }), seatRed = mat(0x7d1018, { rough: 0.7 });
  const crowd = [];
  const stand = (cx, cz, len, rotY, rows = 12) => {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; scene.add(g);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 0.3), concrete); wall.position.set(0, 0.6, 0); g.add(wall);
    for (let k = 0; k < rows; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.95), k % 2 ? concrete : seatRed);
      step.position.set(0, 0.9 + k * 0.6 - 0.3, -0.6 - k * 0.9); step.receiveShadow = true; g.add(step);
      for (let x = -len / 2 + 0.4; x < len / 2 - 0.4; x += 0.62) if (Math.random() > 0.12) crowd.push({ g, x: x + (Math.random() - 0.5) * 0.15, y: 0.9 + k * 0.6, z: -0.65 - k * 0.9, ph: Math.random() * 6, amp: 0.6 + Math.random() * 0.6 });
    }
    // roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.3, rows * 0.9 + 4), mat(0x2a2f37, { rough: 0.6, metal: 0.3 }));
    roof.position.set(0, 0.9 + rows * 0.6 + 4.2, -rows * 0.45 - 0.8); roof.rotation.x = -0.06; g.add(roof);
    return g;
  };
  stand(0, -8.6, 76, 0); stand(-41, 26, 70, Math.PI / 2); stand(41, 26, 70, -Math.PI / 2);
  const shirtCols = [0xE20015, 0xE20015, 0xf4f6f8, 0x1f3a66, 0x2b2f36, 0xd7dbe0, 0xc21a2a, 0x3d5f8c, 0xe8c547, 0x5a2a2a];
  const skinCols = [0xC99A7A, 0x8D5B3F, 0xE0B697, 0x6B4430, 0xB98466, 0xD7A889];
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.34, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.85 }), crowd.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), crowd.length);
  const col = new THREE.Color();
  crowd.forEach((p, i) => { body.setColorAt(i, col.setHex(shirtCols[(Math.random() * shirtCols.length) | 0])); heads.setColorAt(i, col.setHex(skinCols[(Math.random() * skinCols.length) | 0])); });
  scene.add(body, heads);
  const m4 = new THREE.Matrix4(), pv = V(), qv = new THREE.Quaternion(), one = V(1, 1, 1);
  world.updateCrowd = (T, hype) => {
    crowd.forEach((p, i) => {
      const j = hype * p.amp * Math.max(0, Math.sin(T * 7.5 + p.ph)) * 0.32 + 0.02 * Math.sin(T * 1.3 + p.ph);
      pv.set(p.x, p.y + 0.36 + j, p.z); p.g.localToWorld(pv); qv.setFromAxisAngle(V(0, 1, 0), p.g.rotation.y);
      m4.compose(pv, qv, one); body.setMatrixAt(i, m4);
      pv.set(p.x, p.y + 0.86 + j, p.z); p.g.localToWorld(pv); m4.compose(pv, qv, one); heads.setMatrixAt(i, m4);
    });
    body.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  };
  scene.updateMatrixWorld(true);
  world.updateCrowd(0, 0);

  // floodlight towers
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e0).multiplyScalar(3), toneMapped: false });
  for (const [x, z] of [[-44, -14], [44, -14], [-50, 62], [50, 62]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 34, 10), mat(0x8c939c, { rough: 0.5, metal: 0.6 })); pole.position.set(x, 17, z); scene.add(pole);
    const head = new THREE.Group(); head.position.set(x, 35, z); head.lookAt(0, 0, 14); scene.add(head);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 0.4), mat(0x30353c)); head.add(frame);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { const l = new THREE.Mesh(new THREE.RingGeometry(0, 0.5, 16), lamp); l.position.set(-2.1 + a * 1.4, -1.05 + b * 1.05, 0.21); head.add(l); }
  }

  // MOBILITY AWARD 2027 board that rises behind the net, with a trophy on top
  const award = new THREE.Group(); award.position.set(0, -4, -3.5); scene.add(award); world.award = award;
  const awTex = canvasTex(2048, 860, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1626'); bg.addColorStop(1, '#05070c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // rays
    g.save(); g.translate(W / 2, H * 0.62); for (let i = 0; i < 36; i++) { g.rotate(Math.PI * 2 / 36); g.fillStyle = i % 2 ? 'rgba(255,200,80,0.05)' : 'rgba(255,255,255,0.0)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -60); g.lineTo(1400, 60); g.fill(); } g.restore();
    g.strokeStyle = goldFill(g, 0, H); g.lineWidth = 18; g.strokeRect(24, 24, W - 48, H - 48); g.lineWidth = 4; g.strokeRect(56, 56, W - 112, H - 112);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = fit(g, 'MOBILITY AWARD', W * 0.84, 250, 900, 'condensed');
    g.font = `condensed 900 ${s}px ${FONT}`; g.fillStyle = goldFill(g, 150, 380); g.shadowColor = 'rgba(255,190,60,0.55)'; g.shadowBlur = 30; g.fillText('MOBILITY AWARD', W / 2, 268);
    g.font = `900 330px ${FONT}`; g.fillStyle = goldFill(g, 430, 760); g.fillText('2027', W / 2, 600);
    g.shadowBlur = 0; g.fillStyle = '#E20015'; g.fillRect(W / 2 - 520, 425, 1040, 8);
    g.font = `condensed 700 54px ${FONT}`; g.fillStyle = '#f4f6f8'; g.fillText('BPS GO!+   ·   THE GOAL WE PROMISED', W / 2, 790);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.69), new THREE.MeshBasicMaterial({ map: awTex, toneMapped: false, color: 0xdddddd }));
  face.position.y = 1.55; award.add(face);
  const frameM = mat(0x1a1d22, { rough: 0.4, metal: 0.6 });
  const fb = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.85, 0.16), frameM); fb.position.set(0, 1.55, -0.09); award.add(fb);
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), frameM); leg.position.set(sx * 2.9, -0.1, -0.12); award.add(leg); }
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc845, metalness: 1, roughness: 0.22, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const trophy = new THREE.Group(); trophy.position.set(0, 2.9, 0.1); award.add(trophy); world.trophy = trophy;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.42), mat(0x0e0f12, { rough: 0.3, metal: 0.3 })); plinth.position.y = 0.12; trophy.add(plinth);
  const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.16, 0], [0.16, 0.04], [0.05, 0.08], [0.04, 0.3], [0.08, 0.36], [0.2, 0.46], [0.25, 0.62], [0.26, 0.8], [0.23, 0.8], [0.21, 0.64], [0.001, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40), gold);
  cup.position.y = 0.24; trophy.add(cup);
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 10, 24, Math.PI * 1.2), gold); h.position.set(sx * 0.27, 0.86, 0); h.rotation.z = sx > 0 ? -Math.PI * 0.6 : Math.PI * 1.6; trophy.add(h); }
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0, 1.1, 40), glowM); halo.position.set(0, 0.7, -0.1); trophy.add(halo); world.halo = halo;
  const trophyLight = new THREE.PointLight(0xffd27a, 0, 8, 1.6); trophyLight.position.set(0, 3.6, 1.5); award.add(trophyLight); world.trophyLight = trophyLight;
  return world;
}

// ---------------------------------------------------------------- ball
function makeBall() {
  const tex = canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#16181c';
    const pent = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.0); } g.closePath(); g.fill(); };
    pent(W * 0.5, 30, 55); pent(W * 0.5, H - 30, 55); for (let i = 0; i < 5; i++) { pent(i * W / 5 + W / 10, H * 0.32, 52); pent(i * W / 5, H * 0.68, 52); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(i * W / 10, 0); g.lineTo(i * W / 10 + 40, H); g.stroke(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- tracks
// [t, x, z] waypoints; the player runs between them, easing in/out around stops.
function trackPos(track, T, out) {
  if (T <= track[0][0]) return out.set(track[0][1], 0, track[0][2]);
  for (let i = 1; i < track.length; i++) {
    const [t1, x1, z1] = track[i];
    if (T <= t1) {
      const [t0, x0, z0] = track[i - 1];
      const still = k => k < 0 || k + 1 >= track.length ? true : (track[k][1] === track[k + 1][1] && track[k][2] === track[k + 1][2]);
      const startStop = i - 1 > 0 && still(i - 2), endStop = i + 1 >= track.length || still(i);
      let k = (T - t0) / (t1 - t0);
      k = startStop && endStop ? smooth(k) : startStop ? k * k : endStop ? 1 - (1 - k) * (1 - k) : k;
      return out.set(lerp(x0, x1, k), 0, lerp(z0, z1, k));
    }
  }
  const l = track[track.length - 1]; return out.set(l[1], 0, l[2]);
}

// ---------------------------------------------------------------- film
export function createFilm(canvas, ui) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const lowQ = new URLSearchParams(location.search).get('quality') === 'low';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowQ ? 1 : 2));

  const scene = new THREE.Scene();
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 512;
  { const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#16233d'); gr.addColorStop(0.45, '#3a5a86'); gr.addColorStop(0.8, '#e4a77a'); gr.addColorStop(1, '#f4d2a8'); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); }
  scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;
  scene.fog = new THREE.FogExp2(0x9aa6b8, 0.0055);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 400);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2c4a26, 1.05));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
  sun.castShadow = !lowQ; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const world = buildWorld(scene, document.getElementById('bpsLogoImg'));
  const ball = makeBall(); scene.add(ball);

  // ---- the eight players ----
  const red = 0xD0101E, white = 0xf2f3f5, blue = 0x1d3f8f;
  const P = {
    singh: makePlayer({ id: 'singh', kit: red, top: red, bottom: white, sock: red, num: 10, name: 'MR. SINGH', skin: 0xB07A58, hair: 0x15110e, beard: true, height: 1.02, seed: 1.1 }),
    t1: makePlayer({ id: 't1', top: red, bottom: white, sock: red, num: 8, skin: 0xE0B697, hair: 0x3a2a1c, height: 0.98, seed: 2.3 }),
    t2: makePlayer({ id: 't2', top: red, bottom: white, sock: red, num: 9, skin: 0x8D5B3F, hair: 0x0f0c0a, height: 1.0, seed: 3.1 }),
    t3: makePlayer({ id: 't3', top: red, bottom: white, sock: red, num: 7, skin: 0xC99A7A, hair: 0x2b1d14, height: 0.97, seed: 4.7 }),
    d1: makePlayer({ id: 'd1', top: blue, bottom: 0x10141c, sock: blue, num: 4, skin: 0xD7A889, hair: 0x4a2c1c, height: 1.01, seed: 5.2 }),
    d2: makePlayer({ id: 'd2', top: blue, bottom: 0x10141c, sock: blue, num: 5, skin: 0x6B4430, hair: 0x0f0c0a, hairStyle: 'bald', height: 1.03, seed: 6.4 }),
    d3: makePlayer({ id: 'd3', top: blue, bottom: 0x10141c, sock: blue, num: 3, skin: 0xC99A7A, hair: 0x15110e, height: 0.99, seed: 7.9 }),
    gk: makePlayer({ id: 'gk', top: 0x1fae5b, bottom: 0x111318, sock: 0x1fae5b, num: 1, long: true, skin: 0xE0B697, hair: 0x2b1d14, height: 1.04, seed: 8.8, numColor: '#0d1a12' }),
  };
  const players = Object.values(P);
  players.forEach(c => scene.add(c.root));
  // goalkeeper gloves
  for (const s of ['l', 'r']) { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), mat(0xf2f2f2, { rough: 0.6 })); gl.scale.set(0.9, 1.2, 1.3); gl.position.y = -0.06; P.gk.j[s + 'Hand'].add(gl); }

  const TR = {
    t1: [[0, -9.0, 29.5], [1.6, -6.0, 25.0], [2.6, -5.0, 23.2], [8.6, -6.0, 15.8], [10.4, -6.0, 15.8], [15.6, 7.6, 10.4], [20.0, 7.6, 10.4], [22.4, -2.5, 6]],
    singh: [[0, 8.6, 32.0], [2.6, 4.8, 24.2], [5.3, 3.4, 18.4], [6.8, 2.0, 15.6], [8.55, 1.6, 13.4], [10.2, 1.6, 13.4], [12.9, 6.8, 8.8], [20.0, 6.8, 8.8], [22.4, -0.5, 6]],
    t2: [[0, -5.5, 18], [8.5, -3.4, 11.0], [10.3, -3.4, 11.0], [13.7, 5.9, 9.4], [20.0, 5.9, 9.4], [22.4, 0.5, 6]],
    t3: [[0, 9.5, 21], [8.5, 6.2, 13.2], [10.3, 6.2, 13.2], [13.0, 7.7, 8.0], [20.0, 7.7, 8.0], [22.4, 2.5, 6]],
    d1: [[0, 0.6, 21.0], [4.9, 3.0, 18.0], [5.6, 3.4, 17.4], [7.0, 1.6, 16.4], [8.8, 0.5, 15.0], [10.2, 0.5, 15.0], [20.0, 0.5, 15.0], [22.4, -3.5, 6]],
    d2: [[0, -1.6, 14.2], [8.6, 0.2, 11.8], [9.3, 0.3, 11.6], [20.0, 0.3, 11.6], [22.4, 3.5, 6]],
    d3: [[0, -3.6, 13.2], [8.5, -2.2, 10.0], [9.5, -2.4, 9.6], [20.0, -2.4, 9.6], [22.4, -1.5, 6]],
    gk: [[0, -0.3, 0.9], [6.0, 0.3, 0.9], [8.6, 0.6, 0.85], [9.12, 0.6, 0.85], [14.2, -2.9, 0.6], [20.0, -2.9, 0.6], [22.4, 1.5, 6]],
  };

  // ---- ball path ----
  const spot = V(1.7, BALL_R, 12.85); // where Mr. Singh strikes
  const flight = new THREE.QuadraticBezierCurve3(spot.clone(), V(2.1, 3.1, 6.2), V(-2.95, 1.95, 0));
  const tmp = V(), tmp2 = V();
  const dribble = (c, T, out) => { // ball at the player's feet, small touches ahead
    const yaw = c.yaw, f = 0.5 + 0.22 * Math.abs(Math.sin(T * 4.6));
    trackPos(TR[c.o.id], T, out);
    return out.set(out.x + Math.sin(yaw) * f - Math.cos(yaw) * 0.08, BALL_R, out.z + Math.cos(yaw) * f + Math.sin(yaw) * 0.08);
  };
  const ballAt = (T, out) => {
    if (T < 1.6) return dribble(P.t1, T, out);
    if (T < 2.6) { const k = (T - 1.6) / 1.0, e = 1 - (1 - k) * (1 - k) * 0.6 - 0.4 * (1 - k); dribble(P.t1, 1.6, tmp); trackPos(TR.singh, 2.6, tmp2).add(V(-0.1, BALL_R, -0.55)); return out.copy(tmp).lerp(tmp2, sat(e)); }
    if (T < 8.2) return dribble(P.singh, T, out);
    if (T < 9.0) { dribble(P.singh, 8.2, tmp); return out.copy(tmp).lerp(spot, smooth(sat((T - 8.2) / 0.35))); }
    if (T < 9.75) return flight.getPoint((T - 9.0) / 0.75, out);
    if (T < 10.0) { const k = (T - 9.75) / 0.25, e = 1 - (1 - k) * (1 - k); return out.set(lerp(-2.95, -3.08, e), lerp(1.95, 1.65, e), lerp(0, -2.15, e)); }
    if (T < 10.55) { const k = (T - 10.0) / 0.55; return out.set(lerp(-3.08, -2.9, k), 1.65 - (1.65 - BALL_R) * k * k, lerp(-2.15, -1.6, k)); }
    if (T < 11.3) { const k = (T - 10.55) / 0.75; return out.set(lerp(-2.9, -2.75, k), BALL_R + 0.28 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (k < 0.625 ? 1 : 0), lerp(-1.6, -1.35, 1 - (1 - k) ** 2)); }
    return out.set(-2.75, BALL_R, -1.35);
  };
  const netAmp = T => T < 9.88 ? 0 : T < 10.02 ? 0.38 * smooth((T - 9.88) / 0.14) : 0.38 * Math.exp(-(T - 10.02) * 3.2) * Math.cos((T - 10.02) * 10);
  const impact = V(-3.0, 1.62, -2.0);

  // ---- time scale: slow motion around the strike ----
  const timeScale = T => T < 8.25 ? 1 : T < 8.5 ? lerp(1, 0.3, smooth((T - 8.25) / 0.25)) : T < 9.85 ? 0.3 : T < 10.35 ? lerp(0.3, 1, smooth((T - 9.85) / 0.5)) : 1;

  // ---- keeper dive (root transform) ----
  const keeperDive = T => {
    if (T < 9.12) return null;
    if (T < 9.62) { const k = (T - 9.12) / 0.5; return { x: lerp(0.6, -0.45, smooth(k)), y: 0.62 * Math.sin(k * Math.PI / 2), z: lerp(0.85, 0.95, k), roll: 1.0 * smooth(k) }; }
    if (T < 10.0) { const k = (T - 9.62) / 0.38; return { x: lerp(-0.45, -0.9, k), y: lerp(0.62, 0.17, k * k), z: 0.95, roll: lerp(1.0, 1.42, k) }; }
    if (T < 13.2) return { x: -0.9, y: 0.17, z: 0.95, roll: 1.42 };
    if (T < 14.2) { const k = smooth((T - 13.2) / 1.0); return { x: lerp(-0.9, -2.9, k), y: lerp(0.17, 0, k), z: lerp(0.95, 0.6, k), roll: lerp(1.42, 0, k) }; }
    return { x: -2.9, y: 0, z: 0.6, roll: 0 };
  };

  // Character blends gestures from the end of its list to the start, so the first entry wins:
  // put each new action at the front so it overrides the running/keeper stance underneath.
  const act = (c, name, dur) => { const g = c.gesture(name, dur); c.gestures.splice(c.gestures.indexOf(g), 1); c.gestures.unshift(g); };
  // ---- events ----
  const events = [
    [-100, () => {
      players.forEach(c => { c.gestures.length = 0; if (c !== P.gk) c.gesture('fbRun', 1e9); });
      P.gk.gesture('fbKeeper', 1e9);
      players.forEach(c => c.lookAt(ball.position));
      world.setLed('normal');
    }],
    [8.55, () => { act(P.singh, 'fbKick', 1.6); P.singh.lookAt(null); }],
    [9.12, () => { P.gk.endGesture('fbKeeper'); act(P.gk, 'fbDive', 4.4); P.gk.lookAt(null); }],
    [9.6, () => { act(P.d2, 'fbHandsHead', 9); }],
    [10.15, () => { act(P.singh, 'fbAirplane', 2.8); world.setLed('award'); act(P.d1, 'fbHandsHead', 9); act(P.d3, 'fbHandsHead', 8); }],
    [10.4, () => { [P.t1, P.t2, P.t3].forEach(c => c.lookAt(null)); }],
    [12.9, () => { act(P.singh, 'celebrate', 12); }],
    [13.1, () => { act(P.t3, 'celebrate', 12); }],
    [13.7, () => { act(P.t2, 'celebrate', 12); }],
    [14.0, () => { act(P.gk, 'fbDejected', 20); }],
    [15.6, () => { act(P.t1, 'celebrate', 12); }],
    [20.0, () => { // everyone stops celebrating and walks into one line
      players.forEach(c => { c.gestures.forEach(g => { if (g.name !== 'fbRun') c.endGesture(g.name); }); c.lookAt(null); });
      P.gk.gesture('fbRun', 1e9);
      world.setLed('normal');
    }],
    [22.5, () => { players.forEach(c => act(c, 'fbTogether', 1e9)); }],
  ];
  const jumps = { singh: 14.0, t3: 14.15, t2: 14.35, t1: 15.8 };

  // ---- confetti ----
  const CONF = 700;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.09), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }), CONF);
  const confCols = [0xE20015, 0xffffff, 0xffc845, 0xffc845, 0xE20015];
  const cData = Array.from({ length: CONF }, (_, i) => {
    conf.setColorAt(i, new THREE.Color(confCols[i % confCols.length]));
    const burst = i < CONF * 0.35 ? 0 : i < CONF * 0.68 ? 1 : 2;
    return { burst, v: V((Math.random() - 0.5) * 7, 3 + Math.random() * 5, (Math.random() - 0.5) * 6), o: V((Math.random() - 0.5) * (burst ? 9 : 7), 0, (Math.random() - 0.5) * (burst === 1 ? 7 : 3)), ph: Math.random() * 6, sp: 2 + Math.random() * 5, ax: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize() };
  });
  conf.frustumCulled = false; scene.add(conf);
  const bursts = [{ t: 9.95, c: V(-1.0, 3.4, -1.2) }, { t: 14.0, c: V(6.8, 6.5, 8.8) }, { t: 23.7, c: V(0, 6.5, 5.6) }];
  const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cp = V(), cs = V();
  const updateConfetti = T => {
    cData.forEach((d, i) => {
      const b = bursts[d.burst], t = T - b.t;
      if (t < 0) { cs.setScalar(0); cm.compose(cp.set(0, -10, 0), cq.identity(), cs); conf.setMatrixAt(i, cm); return; }
      const k = 1.8, e = (1 - Math.exp(-k * t)) / k;
      cp.copy(b.c).add(d.o).addScaledVector(d.v, e); cp.y -= 1.0 * (t - e) + (d.burst ? 0 : 0); cp.x += 0.18 * Math.sin(t * 3 + d.ph); cp.z += 0.12 * Math.cos(t * 2.3 + d.ph);
      const ground = cp.y <= 0.01; if (ground) cp.y = 0.01;
      if (ground) cq.setFromAxisAngle(V(1, 0, 0), -Math.PI / 2); else cq.setFromAxisAngle(d.ax, t * d.sp + d.ph);
      cs.setScalar(1); cm.compose(cp, cq, cs); conf.setMatrixAt(i, cm);
    });
    conf.instanceMatrix.needsUpdate = true;
  };

  // ---- camera shots ----
  const cam = { pos: V(), tgt: V(), fov: 42, shot: -1 };
  const sp = V(), st = V();
  const shots = [
    // trailer title: slow fly-in over the stadium that lands exactly on the first shot
    { until: 0, snap: true, f: T => { const k = smooth(sat((T + PRE) / PRE)); sp.set(lerp(-26, 13, k), lerp(34, 7.2, k), lerp(72, 33.5, k)); st.set(lerp(0, -5.4, k), lerp(0, 1, k), lerp(8, 25.6, k)); return 40; } },
    { until: 2.7, snap: true, f: T => { const b = ball.position; sp.set(13 - T * 0.8, 7.2, 33.5 - T * 0.6); st.set(b.x * 0.6, 1.0, b.z * 0.7 + 5); return 40; } },
    { until: 8.2, snap: true, f: T => { const p = P.singh.root.position; sp.set(p.x + 1.1, 2.0, p.z + 4.4); st.set(p.x - 0.5, 1.05, p.z - 5.5); return 44; } },
    { until: 9.05, snap: true, f: T => { const k = sat((T - 8.2) / 0.85); sp.set(lerp(4.4, 3.8, k), lerp(0.95, 0.8, k), lerp(16.2, 15.4, k)); st.set(1.3, 0.8, 12.4); return 40; } },
    { until: 10.9, snap: true, f: T => { const b = ball.position; sp.set(-1.4, 1.55, -4.7); st.set(lerp(-1.6, b.x, 0.7), lerp(1.2, b.y, 0.6), lerp(4, b.z, 0.55)); return 50; } },
    { until: 12.4, snap: true, f: T => { const k = smooth(sat((T - 10.9) / 1.5)); sp.set(lerp(0.6, -1.5, k), lerp(2.1, 1.85, k), lerp(7.0, 3.4, k)); st.set(-2.6, 0.45, -1.3); return 44; } },
    { until: 16.2, snap: false, f: T => { const k = smooth(sat((T - 12.4) / 2.6)); sp.set(lerp(-1.5, -0.2, k), lerp(1.85, 1.7, k), lerp(3.4, 4.6, k)); st.set(lerp(-2.6, 0, k), lerp(0.45, 2.05, k), lerp(-1.3, -3.5, k)); return lerp(44, 38, k); } },
    { until: 20.0, snap: true, f: T => { const a = 0.55 + (T - 16.2) * 0.1, R = 6.6 - Math.min(1.2, (T - 16.2) * 0.12); sp.set(6.8 + Math.sin(a) * R, 2.3, 8.8 + Math.cos(a) * R); st.set(6.6, 1.15, 8.8); return 40; } },
    { until: 1e9, snap: false, f: T => { const k = smooth(sat((T - 21.5) / 5)), fov = 40, need = 5.4 / (Math.tan(fov * Math.PI / 360) * camera.aspect), dist = Math.max(8.2, need) * lerp(1.08, 0.97, k); sp.set(0, 2.35, 6 + dist); st.set(0, 1.75, 2.5); return fov; } },
  ];
  const updateCamera = (T, dt, force) => {
    let i = shots.findIndex(s => T < s.until); if (i < 0) i = shots.length - 1;
    const fov = shots[i].f(T);
    if (force || (i !== cam.shot && shots[i].snap)) { cam.pos.copy(sp); cam.tgt.copy(st); cam.fov = fov; }
    else { const l = 1 - Math.exp(-3.5 * dt); cam.pos.lerp(sp, l); cam.tgt.lerp(st, l); cam.fov = lerp(cam.fov, fov, l); }
    cam.shot = i;
    camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    sun.target.position.set(cam.tgt.x, 0, cam.tgt.z); sun.position.set(cam.tgt.x + 14, 26, cam.tgt.z + 9);
  };

  // ---- simulation ----
  let T = 0, evIdx = 0, finished = false;
  const prevBall = V(), axis = V(), q = new THREE.Quaternion();
  const reset = () => {
    T = -PRE; evIdx = 0; finished = false;
    for (const c of players) { const p = trackPos(TR[c.o.id], 0, V()); c.place(p.x, p.z, c === P.gk ? 0 : Math.PI); c.root.position.y = 0; c.root.rotation.set(0, c.yaw, 0); c.prevPos.copy(c.root.position); c.runAmp = c === P.gk ? 0 : 0.8; }
    world.award.position.y = -4; ball.quaternion.identity(); ballAt(0, ball.position); prevBall.copy(ball.position);
    ui.reset();
    step(0);
    updateCamera(0, 0, true);
  };
  const step = (rawDt, light = false) => {
    const dt = rawDt * timeScale(T);
    T += dt;
    while (evIdx < events.length && events[evIdx][0] <= T) events[evIdx++][1]();
    // ball
    ballAt(T, ball.position);
    const d = tmp.copy(ball.position).sub(prevBall);
    if (T < 9.0 || T > 10.0) { const dist = Math.hypot(d.x, d.z); if (dist > 1e-5) { axis.set(d.z, 0, -d.x).normalize(); q.setFromAxisAngle(axis, dist / BALL_R); ball.quaternion.premultiply(q); } }
    else if (dt > 0) { q.setFromAxisAngle(V(0.3, 1, 0.2).normalize(), dt * 28); ball.quaternion.premultiply(q); }
    prevBall.copy(ball.position);
    // players
    for (const c of players) {
      const id = c.o.id;
      if (id === 'gk' && T >= 9.12 && T < 14.2) {
        const kd = keeperDive(T); c.root.position.set(kd.x, kd.y, kd.z); c.root.rotation.set(0, 0, kd.roll); c.yaw = 0;
        c.update(dt); continue;
      }
      trackPos(TR[id], T, c.root.position);
      const vx = c.root.position.x - c.prevPos.x, vz = c.root.position.z - c.prevPos.z;
      const spd = dt > 0 ? Math.hypot(vx, vz) / dt : 0;
      c.runPh += Math.hypot(vx, vz) / 2.3 * Math.PI * 2;
      if (dt > 0) c.runAmp = damp(c.runAmp, clamp(spd / 4.6, 0, 1), 6, dt);
      // facing: the way they run; when still, toward the ball (Mr. Singh keeps facing the goal for his strike)
      let want;
      if (spd > 0.8) want = Math.atan2(vx, vz);
      else if (T > 21.0 || (id === 'gk' && T >= 14.2)) want = 0;
      else if (id === 'singh' && T > 8.2 && T < 10.2) want = Math.atan2(spot.x - 0.1 - c.root.position.x, -1);
      else if (id === 'gk') want = Math.atan2(ball.position.x - c.root.position.x, Math.max(1, ball.position.z - c.root.position.z)) * 0.6;
      else if (T > 13 && id !== 'd1' && id !== 'd2' && id !== 'd3') want = Math.atan2(P.singh.root.position.x - c.root.position.x, P.singh.root.position.z - c.root.position.z) || c.yaw;
      else want = Math.atan2(ball.position.x - c.root.position.x, ball.position.z - c.root.position.z);
      if (id === 'singh' && T >= 12.9 && T < 20 && spd <= 0.8) want = Math.atan2(cam.pos.x - c.root.position.x, cam.pos.z - c.root.position.z);
      c.targetYaw = null; c.yaw = angleLerp(c.yaw, want, 1 - Math.exp(-7 * dt)); c.root.rotation.set(0, c.yaw, 0);
      // celebration jumps
      const js = jumps[id];
      c.root.position.y = js !== undefined && T > js ? 0.3 * Math.abs(Math.sin((T - js) * Math.PI / 0.62)) * sat((20.4 - T) / 0.4) : 0;
      c.prevPos.copy(c.root.position).setY(0);
      c.update(dt);
    }
    // net, award board, crowd, confetti, LEDs
    if (!finished && T >= END) { finished = true; ui.end(); }
    if (light) return;
    world.updateNet(impact, netAmp(T));
    const ar = smooth(sat((T - 11.4) / 1.6));
    world.award.position.y = lerp(-4.2, 0, ar);
    world.trophy.rotation.y = T * 0.6;
    world.halo.material.opacity = 0.35 * smooth(sat((T - 12.6) / 1.0)) * (0.85 + 0.15 * Math.sin(T * 3));
    world.trophyLight.intensity = 18 * ar;
    world.updateCrowd(T, T < 9.85 ? 0.12 : 1);
    updateConfetti(T);
    world.leds.forEach(f => { f.material.map.offset.x = (T * 0.04) % 1; });
    ui.tick(T);
  };

  // ---- post-processing ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.55, 0.88);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  const film = {
    playing: false, paused: false,
    get T() { return T; },
    reset,
    seek(t) { reset(); const h = 1 / 60; while (T < t) { const before = T; step(h, true); updateCamera(T, h * timeScale(T)); if (T === before) break; } step(0); },
    get ended() { return finished; },
    render() { lowQ ? renderer.render(scene, camera) : composer.render(); },
    frame(rawDt) {
      if (this.playing && !this.paused) { step(Math.min(rawDt, 0.05)); updateCamera(T, Math.min(rawDt, 0.05) * timeScale(T)); }
      this.render();
    },
    P, scene, camera, renderer,
  };
  reset();
  try { renderer.compile(scene, camera); } catch (e) { }
  return film;
}

// ---------------------------------------------------------------- page
const $ = id => document.getElementById(id);
const CAPTIONS = [
  [0.3, 2.6, '<em>2026</em> We came close. The shot went wide.'],
  [2.9, 6.0, '<em>2027</em> Same pitch. Same team. One more chance.'],
  [6.2, 8.4, 'Mr. Singh takes it on…'],
  [13.4, 16.0, 'We said we would score. <strong>We did.</strong>'],
  [17.0, 20.2, 'This time, the whole team scores.'],
  [20.6, 23.5, 'Both sides of the pitch. <strong>One team.</strong>'],
];
// scenes for the Back / Next buttons (the end card is the last stop)
const SCENES = [[-PRE, 'Part 2 · Trailer'], [0, 'The pass'], [2.6, 'Mr. Singh on the ball'], [8.2, 'The strike'], [9.05, 'Goal!'], [10.9, 'Mobility Award 2027'], [16.2, 'Celebration'], [20.0, "Let's come together"]];
const sceneAt = T => { let i = 0; SCENES.forEach(([t], k) => { if (T >= t - 0.01) i = k; }); return i; };
function makeUI() {
  const cap = $('caption'), goal = $('goal'), award = $('awardTag'), end = $('endcard'), tog = $('together'), label = $('sceneLabel'), trailer = $('trailer');
  let capIdx = -1, goalShown = false, awardShown = false, togShown = false, trShown = false, sceneIdx = -1;
  return {
    reset() { capIdx = -1; sceneIdx = -1; goalShown = awardShown = togShown = trShown = false; tog.classList.remove('on'); trailer.classList.remove('on'); cap.classList.remove('on'); goal.classList.remove('on'); award.classList.remove('on'); end.classList.remove('on'); document.body.classList.remove('ended'); },
    tick(T) {
      const i = CAPTIONS.findIndex(([a, b]) => T >= a && T < b);
      if (i !== capIdx) { capIdx = i; cap.classList.remove('on'); if (i >= 0) { cap.innerHTML = CAPTIONS[i][2]; void cap.offsetWidth; cap.classList.add('on'); } }
      const g = T >= 9.9 && T < 12.2; if (g !== goalShown) { goalShown = g; goal.classList.toggle('on', g); }
      const a = T >= 16.6 && T < 20.2; if (a !== awardShown) { awardShown = a; award.classList.toggle('on', a); }
      const tr = T >= -PRE + 0.15 && T < -0.45; if (tr !== trShown) { trShown = tr; trailer.classList.toggle('on', tr); }
      const tg = T >= 23.9 && T < END; if (tg !== togShown) { togShown = tg; tog.classList.toggle('on', tg); }
      const si = sceneAt(T); if (!document.body.classList.contains('ended') && si !== sceneIdx) { sceneIdx = si; label.textContent = `${si + 1}/${SCENES.length + 1} · ${SCENES[si][1]}`; }
    },
    end() { end.classList.add('on'); document.body.classList.add('ended'); tog.classList.remove('on'); togShown = false; label.textContent = `${SCENES.length + 1}/${SCENES.length + 1} · The goal`; sceneIdx = SCENES.length; },
  };
}

function boot() {
  const ui = makeUI();
  let film;
  try { film = createFilm($('stage'), ui); }
  catch (e) { console.error(e); $('introNote').textContent = 'This device could not start WebGL. Try a recent Chrome, Edge or Safari.'; return; }
  window.__film = film;
  const params = new URLSearchParams(location.search);
  const timer = new THREE.Timer(); timer.connect?.(document);
  const loop = () => { requestAnimationFrame(loop); timer.update(); film.frame(timer.getDelta()); };
  document.body.classList.add('ready');

  const setPaused = p => { film.paused = p; document.body.classList.toggle('paused', p); $('btnPause').setAttribute('aria-pressed', p); $('btnPause').textContent = p ? 'Play' : 'Pause'; };
  const play = (full) => {
    if (full && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
    document.body.classList.add('playing');
    film.reset(); setPaused(false); film.playing = true;
  };
  $('btnPlay').onclick = () => play(false);
  $('btnPlayFull').onclick = () => play(true);
  $('btnReplay').onclick = () => play(false);
  $('btnReplay2').onclick = () => play(false);
  $('btnPause').onclick = () => setPaused(!film.paused);
  const goTo = t => { document.body.classList.add('playing'); film.playing = true; film.seek(t); };
  const next = () => {
    if (!document.body.classList.contains('playing')) return play(false);
    if (film.ended) return;
    const i = sceneAt(film.T) + 1;
    goTo(i < SCENES.length ? SCENES[i][0] : END);
  };
  const back = () => {
    if (!document.body.classList.contains('playing')) return;
    if (film.ended) return goTo(SCENES[SCENES.length - 1][0]);
    const i = sceneAt(film.T);
    goTo(film.T - SCENES[i][0] > 1.2 || i === 0 ? SCENES[i][0] : SCENES[i - 1][0]);
  };
  $('btnNext').onclick = next; $('btnBack').onclick = back;
  $('btnFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => { });
  addEventListener('keydown', e => {
    if (e.key === 'k' || e.key === 'K' || (e.key === ' ' && document.body.classList.contains('playing'))) { e.preventDefault(); if (document.body.classList.contains('playing')) setPaused(!film.paused); else play(false); }
    else if (e.key === 'r' || e.key === 'R') play(false);
    else if (e.key === 'f' || e.key === 'F') $('btnFull').click();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
    else if (e.key === 'Enter' && !document.body.classList.contains('playing')) play(false);
  });
  // ?t=12 jumps to a moment (paused) for checking; ?autoplay=1 starts straight away (for embedding)
  if (params.has('t')) { document.body.classList.add('playing'); film.playing = true; film.seek(parseFloat(params.get('t')) || 0); setPaused(true); }
  else if (params.get('autoplay') === '1') play(false);
  loop();
}
boot();
