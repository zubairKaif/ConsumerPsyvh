#!/usr/bin/env node
/* Builds dist/QuikKart_Stimulus_App.html (one self-contained file) from src/,
 * and copies WebGazer into dist/webcam/. Usage: node scripts/build.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'QuikKart_Stimulus_App.html');

// Concatenation order matters: later files use earlier ones.
const JS_FILES = ['core', 'icons', 'screens', 'phone', 'flow', 'tracker', 'runner', 'console', 'main'];
const FONT_WEIGHTS = [400, 500, 700];
const FONT_SUBSETS = ['latin-ext', 'latin']; // ₹ (U+20B9) is only in latin-ext

function resolvePkg(name) {
  return path.dirname(require.resolve(name + '/package.json', { paths: [ROOT] }));
}

/** unicode-range of one subset, read from @fontsource/roboto's own CSS so it stays in sync. */
function unicodeRange(fontDir, weight, subset) {
  const css = fs.readFileSync(path.join(fontDir, weight + '.css'), 'utf8');
  const re = new RegExp('/\\* roboto-' + subset + '-' + weight + '-normal \\*/\\s*@font-face\\s*{([^}]*)}');
  const m = css.match(re);
  const range = m && m[1].match(/unicode-range:\s*([^;]+);/);
  if (!range) throw new Error(`No unicode-range for ${subset} ${weight} in @fontsource/roboto`);
  return range[1].trim();
}

function fontFaces() {
  const dir = resolvePkg('@fontsource/roboto');
  const out = [];
  for (const w of FONT_WEIGHTS) {
    for (const s of FONT_SUBSETS) {
      const file = path.join(dir, 'files', `roboto-${s}-${w}-normal.woff2`);
      const b64 = fs.readFileSync(file).toString('base64');
      out.push(`/* Roboto ${w} ${s} (@fontsource/roboto, OFL-1.1) */\n@font-face{font-family:'Roboto';font-style:normal;font-weight:${w};` +
        `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${unicodeRange(dir, w, s)};}`);
    }
  }
  return out.join('\n');
}

function scripts() {
  const parts = JS_FILES.map((name) => {
    const file = path.join(SRC, 'js', name + '.js');
    return `/* ---- ${name}.js ---- */\n` + fs.readFileSync(file, 'utf8').replace(/^'use strict';\n/m, '');
  });
  const js = `(function () {\n'use strict';\n${parts.join('\n')}\n})();`;
  if (/<\/script/i.test(js)) throw new Error('JS contains "</script", which would break the inline <script>.');
  return js;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

function copyWebGazer() {
  const wg = resolvePkg('webgazer');
  const version = require(path.join(wg, 'package.json')).version;
  if (version !== '3.5.3') throw new Error('Expected webgazer 3.5.3, found ' + version);
  const dest = path.join(DIST, 'webcam');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(wg, 'dist', 'webgazer.js'), path.join(dest, 'webgazer.js'));
  copyDir(path.join(wg, 'dist', 'mediapipe', 'face_mesh'), path.join(dest, 'mediapipe', 'face_mesh'));
  fs.copyFileSync(path.join(wg, 'LICENSE.md'), path.join(dest, 'LICENSE.md'));
  fs.copyFileSync(path.join(ROOT, 'vendor', 'GPL-3.0.txt'), path.join(dest, 'GPL-3.0.txt'));
  fs.copyFileSync(path.join(ROOT, 'vendor', 'Apache-2.0.txt'), path.join(dest, 'mediapipe', 'face_mesh', 'Apache-2.0.txt'));
  fs.writeFileSync(path.join(dest, 'README.txt'), [
    'Third-party files used for webcam eye tracking',
    '',
    'webgazer.js         WebGazer.js ' + version + ', copyright Brown WebGazer Team.',
    '                    Licence: GPL-3.0-or-later. Notice in LICENSE.md, full licence text in GPL-3.0.txt.',
    '                    Source: https://github.com/brownhci/WebGazer and the npm package webgazer@' + version + ' (includes src/).',
    'mediapipe/face_mesh MediaPipe Face Mesh solution files as shipped inside webgazer@' + version + '.',
    '                    Licence: Apache-2.0 (Google LLC), text in mediapipe/face_mesh/Apache-2.0.txt.',
    '',
    'The QuikKart app loads these files at run time only when webcam tracking is switched on.',
    '',
  ].join('\r\n'));
}

/** The Roboto faces are embedded in the HTML, so their OFL licence travels with the pack. */
function copyFontLicence() {
  const dest = path.join(DIST, 'licences');
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(resolvePkg('@fontsource/roboto'), 'LICENSE'), path.join(dest, 'Roboto_font_OFL-1.1.txt'));
}

function build() {
  const template = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const html = template
    .replace('/*FONTS*/', () => fontFaces())
    .replace('/*STYLES*/', () => css)
    .replace('/*SCRIPT*/', () => scripts());
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, html);
  copyWebGazer();
  copyFontLicence();
  console.log(`Built ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB) and dist/webcam/`);
}

build();
