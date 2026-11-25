import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Sources live next to this script; the single-file build goes to dist/.
const root = path.dirname(fileURLToPath(import.meta.url));
const src = f => path.join(root, f);
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, 'bosch-bps-strategy-workshop-2026.html');

const vendor = await esbuild.build({ entryPoints: [src('vendor.js')], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'inline' });
const app = await esbuild.build({ entryPoints: [src('main.js')], bundle: true, minify: false, format: 'iife', write: false, target: 'es2020' });
const esc = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(src('index.html'), 'utf8');
const css = fs.readFileSync(src('style.css'), 'utf8');
const data = fs.readFileSync(src('data.json'), 'utf8');
const dataUri = (f, type) => `data:${type};base64,${fs.readFileSync(src(f)).toString('base64')}`;
const images = { __BPS_LOGO__: dataUri('assets/bps-go-logo.png', 'image/png'), __LWW__: dataUri('assets/lead-work-win.jpg', 'image/jpeg'), __REFL__: dataUri('assets/reflection.jpg', 'image/jpeg') };
JSON.parse(data); // validate
for (const [k, v] of Object.entries(images)) html = html.replaceAll(k, v);
// people models: assets/people/<role id>.glb (ph, bps, prod, qual, dig, log) and operator*.glb; PEOPLE_DIR overrides the folder
// Also reads models/ (e.g. models/plant-head.glb). Friendly names map to role ids.
const ALIAS = { 'plant-head': 'ph', 'planthead': 'ph', 'bps-lead': 'bps', 'production': 'prod', 'production-manager': 'prod', 'quality': 'qual', 'quality-manager': 'qual', 'digital': 'dig', 'digital-lead': 'dig', 'logistics': 'log', 'logistics-lead': 'log' };
const peopleDirs = process.env.PEOPLE_DIR ? [process.env.PEOPLE_DIR] : [src('assets/people'), src('models')];
const people = {};
for (const dir of peopleDirs) if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (/\.glb$/i.test(f)) {
  const base = f.toLowerCase().replace(/\.glb$/, ''), id = ALIAS[base] || base;
  people[id + '.glb'] = `data:model/gltf-binary;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
}
console.log('people models:', Object.keys(people).join(', ') || 'none (procedural people)');
html = html.replace('__PEOPLE__', () => JSON.stringify(people));
// thank-you scene layers: assets/thanks (background, three people, three checklist items, layout)
const tyDir = src('assets/thanks'), ty = { layout: {}, img: {} };
if (fs.existsSync(tyDir)) {
  ty.layout = JSON.parse(fs.readFileSync(path.join(tyDir, 'layout.json'), 'utf8'));
  for (const f of fs.readdirSync(tyDir)) if (/\.(jpe?g|webp|png)$/i.test(f)) ty.img[f.replace(/\..*$/, '')] = dataUri('assets/thanks/' + f, /webp$/i.test(f) ? 'image/webp' : /png$/i.test(f) ? 'image/png' : 'image/jpeg');
}
html = html.replace('__THANKS__', () => JSON.stringify(ty));
// glimpses: assets/glimpses/*.jpg|png, embedded by file name
const glimpses = {}, gDir = src('assets/glimpses');
if (fs.existsSync(gDir)) for (const f of fs.readdirSync(gDir).sort()) if (/\.(jpe?g|png|webp)$/i.test(f)) glimpses[f] = dataUri('assets/glimpses/' + f, /png$/i.test(f) ? 'image/png' : /webp$/i.test(f) ? 'image/webp' : 'image/jpeg');
html = html.replace('__GLIMPSES__', () => JSON.stringify(glimpses));
// closing football film (assets/goal/goal-2027.html), embedded as base64 and played in an overlay
{ const gf = src('assets/goal/goal-2027.html'); html = html.replace('__GOALFILM__', () => fs.existsSync(gf) ? fs.readFileSync(gf).toString('base64') : ''); }
html = html.replace('/*__CSS__*/', () => css)
  .replace('__DATA__', () => esc(data))
  .replace('/*__VENDOR__*/', () => esc(vendor.outputFiles[0].text))
  .replace('/*__APP__*/', () => esc(app.outputFiles[0].text));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log('built', path.relative(root, outFile), (html.length / 1024).toFixed(0) + ' KB');
