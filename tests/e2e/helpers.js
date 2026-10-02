'use strict';
const path = require('path');
const { PNG } = require('pngjs');
const C = require('../../src/js/core.js');

const APP = 'QuikKart_Stimulus_App.html';
const DIST = path.resolve(__dirname, '..', '..', 'dist');

/** Opens the app with a query string and waits until fonts are in and the first screen painted. */
async function open(page, query) {
  await page.goto(APP + (query ? '?' + query : ''));
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
}

const view = (page, arm, trial, screen, extra) =>
  open(page, `mode=view&arm=${arm}&trial=${trial}&screen=${screen}${extra || ''}`);

const aois = (page) => page.evaluate(() => window.getAOIs());
const byName = (list) => Object.fromEntries(list.map((a) => [a.aoi, a]));
const text = (page, aoi) => page.locator(`[data-aoi="${aoi}"]`).innerText();

/** Number of differing pixels between two PNG buffers (Infinity if sizes differ). */
function pixelDiff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return Infinity;
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) n++;
  }
  return n;
}

/** Collects page errors and console errors so a test can assert there were none. */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

module.exports = { C, APP, DIST, open, view, aois, byName, text, pixelDiff, watchErrors };
