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
const peopleDir = process.env.PEOPLE_DIR || src('assets/people');
const people = {};
if (fs.existsSync(peopleDir)) for (const f of fs.readdirSync(peopleDir).sort()) if (/\.glb$/i.test(f)) people[f.toLowerCase()] = `data:model/gltf-binary;base64,${fs.readFileSync(path.join(peopleDir, f)).toString('base64')}`;
console.log('people models:', Object.keys(people).join(', ') || 'none (procedural people)');
html = html.replace('__PEOPLE__', () => JSON.stringify(people));
html = html.replace('/*__CSS__*/', () => css)
  .replace('__DATA__', () => esc(data))
  .replace('/*__VENDOR__*/', () => esc(vendor.outputFiles[0].text))
  .replace('/*__APP__*/', () => esc(app.outputFiles[0].text));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log('built', path.relative(root, outFile), (html.length / 1024).toFixed(0) + ' KB');
