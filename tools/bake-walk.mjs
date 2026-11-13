// Usage: node tools/bake-walk.mjs path/to/Walking.fbx walkcycle.json   (Mixamo walk, with or without skin)
// Bake a Mixamo walk (FBX, any skin) into per-joint Euler tables for the procedural rig.
import fs from 'fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, getContext: () => null, addEventListener() {} }), createElement: () => ({ style: {}, getContext: () => null }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const [inFile, outFile] = process.argv.slice(2);
const buf = fs.readFileSync(inFile);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const bones = {}; obj.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig\d*:?/i, '')] = o; });
const clip = obj.animations[0];
const mixer = new THREE.AnimationMixer(obj); const act = mixer.clipAction(clip); act.play();
// rest = bind pose with arms and legs straight down (same as the runtime retarget)
mixer.stopAllAction(); obj.updateMatrixWorld(true);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const align = (b, c, dir) => {
  const bw = bones[b].getWorldPosition(V()), cw = bones[c].getWorldPosition(V());
  const q = new THREE.Quaternion().setFromUnitVectors(cw.sub(bw).normalize(), dir.normalize());
  const wq = bones[b].getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
  const pq = bones[b].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bones[b].quaternion.copy(pq.multiply(wq)); bones[b].updateMatrixWorld(true);
};
const down = V(0, -1, 0);
align('LeftArm', 'LeftForeArm', V(0.12, -1, 0)); align('LeftForeArm', 'LeftHand', V(0.08, -1, 0.04));
align('RightArm', 'RightForeArm', V(-0.12, -1, 0)); align('RightForeArm', 'RightHand', V(-0.08, -1, 0.04));
align('LeftUpLeg', 'LeftLeg', down.clone()); align('LeftLeg', 'LeftFoot', down.clone());
align('RightUpLeg', 'RightLeg', down.clone()); align('RightLeg', 'RightFoot', down.clone());
const MAP = { hips: 'Hips', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head', lSh: 'LeftArm', lEl: 'LeftForeArm', rSh: 'RightArm', rEl: 'RightForeArm', lHip: 'LeftUpLeg', lKnee: 'LeftLeg', rHip: 'RightUpLeg', rKnee: 'RightLeg' };
const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', lSh: 'chest', lEl: 'lSh', rSh: 'chest', rEl: 'rSh', lHip: 'hips', lKnee: 'lHip', rHip: 'hips', rKnee: 'rHip' };
const restInv = {}; for (const [j, b] of Object.entries(MAP)) restInv[j] = bones[b].getWorldQuaternion(new THREE.Quaternion()).invert();
const hipsRestY = bones.Hips.getWorldPosition(V()).y;
// sample the clip
act.play(); act.reset();
const N = 48, out = { samples: N, joints: {}, hipY: [], hipZ: [] };
for (const j of Object.keys(MAP)) out.joints[j] = [];
const posTrack = clip.tracks.find(t => /Hips\.position$/.test(t.name));
const p0 = posTrack.values.slice(0, 3), p1 = posTrack.values.slice(-3);
const travel = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]); // cycle distance in clip units
let ys = [];
for (let i = 0; i < N; i++) {
  mixer.setTime(clip.duration * i / N); obj.updateMatrixWorld(true);
  const rel = {};
  for (const [j, b] of Object.entries(MAP)) {
    rel[j] = bones[b].getWorldQuaternion(new THREE.Quaternion()).multiply(restInv[j]);
    const parent = PARENT[j] ? rel[PARENT[j]].clone().invert() : new THREE.Quaternion();
    const local = parent.multiply(rel[j]);
    const e = new THREE.Euler().setFromQuaternion(local, 'XYZ');
    out.joints[j].push([e.x, e.y, e.z]);
  }
  ys.push(bones.Hips.getWorldPosition(V()).y);
}
// unwrap angles so interpolation never jumps by 2π
for (const arr of Object.values(out.joints)) for (let k = 0; k < 3; k++) for (let i = 1; i < arr.length; i++) { while (arr[i][k] - arr[i - 1][k] > Math.PI) arr[i][k] -= 2 * Math.PI; while (arr[i][k] - arr[i - 1][k] < -Math.PI) arr[i][k] += 2 * Math.PI; }
// hips yaw: remove the average heading so the rig's own facing stays in charge
const meanY = out.joints.hips.reduce((s, e) => s + e[1], 0) / N; out.joints.hips.forEach(e => e[1] -= meanY);
const meanH = ys.reduce((a, b) => a + b, 0) / N;
const unit = 0.94 / hipsRestY; // clip units → rig metres (rig hips at 0.94)
out.hipY = ys.map(y => +((y - meanH) * unit).toFixed(4));
out.stride = +(travel * unit).toFixed(3);
for (const arr of Object.values(out.joints)) arr.forEach((e, i) => arr[i] = e.map(v => +v.toFixed(4)));
fs.writeFileSync(outFile, JSON.stringify(out));
console.log('baked', N, 'samples, stride', out.stride, 'm, duration', clip.duration.toFixed(2), 's, hip bob', Math.min(...out.hipY), Math.max(...out.hipY));
console.log('lHip x range', Math.min(...out.joints.lHip.map(e => e[0])).toFixed(2), Math.max(...out.joints.lHip.map(e => e[0])).toFixed(2), 'lKnee x', Math.min(...out.joints.lKnee.map(e => e[0])).toFixed(2), Math.max(...out.joints.lKnee.map(e => e[0])).toFixed(2), 'lSh x', Math.min(...out.joints.lSh.map(e => e[0])).toFixed(2), Math.max(...out.joints.lSh.map(e => e[0])).toFixed(2));
