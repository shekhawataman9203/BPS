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
JSON.parse(data); // validate
html = html.replace('/*__CSS__*/', () => css)
  .replace('__DATA__', () => esc(data))
  .replace('/*__VENDOR__*/', () => esc(vendor.outputFiles[0].text))
  .replace('/*__APP__*/', () => esc(app.outputFiles[0].text));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log('built', path.relative(root, outFile), (html.length / 1024).toFixed(0) + ' KB');
