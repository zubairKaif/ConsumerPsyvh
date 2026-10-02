'use strict';
const path = require('path');
const { expect } = require('@playwright/test');
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

/** Minimal RFC 4180 CSV parser: returns { header, rows: [objects] }. */
function parseCSV(textIn) {
  const out = [];
  let row = [], cell = '', q = false;
  const t = textIn.replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  const header = out.shift();
  return { header, rows: out.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))) };
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Plays a whole run-mode session like a participant.
 * opts.onBill(page, { trial, order }) handles each first-pass bill (default: Place order).
 * opts.beforeWelcome(page) and opts.beforeTrial(page, order) handle tracker set-up and check pages.
 * Probes: recall answers with the true final total, filler with the correct answer, confidence 4.
 * Returns { behaviour, gaze (CSV text or null), hashes, trials }.
 */
async function playSession(page, opts) {
  const { pid, arm, list, et = 'none', onBill } = opts;
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.addInitScript(() => {
    window.__hashes = [];
    window.addEventListener('hashchange', () => window.__hashes.push(location.hash));
  });
  await open(page, `mode=run&pid=${pid}&arm=${arm}&list=${list}&et=${et}`);
  if (opts.beforeWelcome) await opts.beforeWelcome(page);
  await page.getByRole('button', { name: 'Start the practice order' }).click();
  const trials = [];
  for (let order = 0; order < 9; order++) {
    if (opts.beforeTrial) await opts.beforeTrial(page, order);
    await page.locator('[data-aoi="LST_CARTBAR"]').waitFor();
    const trial = (await page.evaluate(() => location.hash)).split('-')[1];
    trials.push(trial);
    await page.click('[data-aoi="LST_CARTBAR"]');
    await page.click('[data-aoi="CRT_PAYBAR"]');
    await page.locator('[data-aoi="BIL_TOT"]').waitFor();
    if (onBill) await onBill(page, { trial, order });
    else await page.click('[data-aoi="BTN_ORDER"]');
    await page.locator('.probe').waitFor();
    if (await page.locator('.probe-num').count()) {
      const T = C.priceCart(C.initialCart(trial)).T;
      await page.locator('.probe-num input').fill(String(T));
      await page.getByRole('button', { name: 'Next' }).click();
      await page.locator('.conf-opt[data-v="4"]').click();
      await page.getByRole('button', { name: 'Next' }).click();
    } else {
      await page.locator('.probe-text').fill(C.TRIALS[trial].filler[1]);
      await page.getByRole('button', { name: 'Next' }).click();
    }
    if (order === 0) await page.getByRole('button', { name: 'Start', exact: true }).click();
  }
  // The end page downloads the CSVs by itself (gaze only when tracking was on).
  await page.getByText('Thank you!').waitFor();
  const want = et === 'none' ? ['behaviour'] : ['behaviour', 'gaze'];
  const find = (w) => downloads.find((d) => d.suggestedFilename() === `QuikKart_${pid}_${w}.csv`);
  await expect.poll(() => want.every(find), { timeout: 15000 }).toBe(true);
  const behaviour = await readDownload(find('behaviour'));
  const gaze = et === 'none' ? null : await readDownload(find('gaze'));
  return { behaviour, gaze, downloads, hashes: await page.evaluate(() => window.__hashes), trials };
}

module.exports = { C, APP, DIST, open, view, aois, byName, text, pixelDiff, watchErrors, parseCSV, readDownload, playSession };
