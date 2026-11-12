import * as esbuild from 'esbuild';
import fs from 'fs';
const vendor = await esbuild.build({ entryPoints: ['src/vendor.js'], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'inline' });
const app = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: false, format: 'iife', write: false, target: 'es2020' });
const esc = s => s.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync('src/index.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');
const data = fs.readFileSync('src/data.json', 'utf8');
JSON.parse(data); // validate
html = html.replace('/*__CSS__*/', () => css)
  .replace('__DATA__', () => esc(data))
  .replace('/*__VENDOR__*/', () => esc(vendor.outputFiles[0].text))
  .replace('/*__APP__*/', () => esc(app.outputFiles[0].text));
fs.writeFileSync('dist/bosch-bps-strategy-workshop-2026.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
