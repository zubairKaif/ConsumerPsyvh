#!/usr/bin/env node
/* Renders the Tobii stimulus images and assembles the pack (run `npm run render`, which builds first).
 * Playwright Chromium at 1920 x 1080, deviceScaleFactor 1:
 *   dist/stimuli_png/{arm}_{trial}_{n}_{screen}.png (54) + fixation.png + blank_mask.png
 *   dist/aoi_preview/ (the 54 screens with AOIs drawn), dist/AOI_coordinates.csv,
 *   dist/trial_orders_P001-P080.csv, start scripts, README.txt, then QuikKart_Stimulus_Pack.zip */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');
const C = require('../src/js/core.js');
const { zipDir } = require('./zip');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACK = path.join(__dirname, 'pack');
const APP = path.join(DIST, 'QuikKart_Stimulus_App.html');
const ZIP = path.join(ROOT, 'QuikKart_Stimulus_Pack.zip');
const SCREENS = ['listing', 'cart', 'bill'];
const PIDS = Array.from({ length: 80 }, (_, i) => 'P' + String(i + 1).padStart(3, '0'));

const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

async function renderImages() {
  for (const d of ['stimuli_png', 'aoi_preview']) {
    fs.rmSync(path.join(DIST, d), { recursive: true, force: true });
    fs.mkdirSync(path.join(DIST, d));
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const base = pathToFileURL(APP).href;
  const shoot = async (query, file) => {
    await page.goto(base + '?' + query);
    await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
    await page.screenshot({ path: file });
  };
  const aoiRows = [];
  for (const arm of ['A', 'B']) {
    for (const trial of C.TRIAL_IDS) {
      for (const screen of SCREENS) {
        const name = `${arm}_${trial}_${C.SCREEN_N[screen]}_${screen}.png`;
        const q = `mode=view&arm=${arm}&trial=${trial}&screen=${screen}`;
        await shoot(q, path.join(DIST, 'stimuli_png', name));
        for (const a of await page.evaluate(() => window.getAOIs())) {
          aoiRows.push({ image: name, arm, trial, screen, aoi: a.aoi, x: a.x, y: a.y, w: a.w, h: a.h,
            fee_rupees: a.fee === null ? '' : a.fee, click_zone: a.click_zone ? 1 : 0 });
        }
        await shoot(q + '&aoi=1', path.join(DIST, 'aoi_preview', name));
      }
      process.stdout.write('.');
    }
  }
  await shoot('mode=fix', path.join(DIST, 'stimuli_png', 'fixation.png'));
  await shoot('mode=blank', path.join(DIST, 'stimuli_png', 'blank_mask.png'));
  await browser.close();
  process.stdout.write('\n');
  if (errors.length) throw new Error('Page errors while rendering:\n' + errors.join('\n'));
  fs.writeFileSync(path.join(DIST, 'AOI_coordinates.csv'), C.toCSV(C.AOI_COLUMNS, aoiRows));
  return aoiRows.length;
}

function trialOrdersCSV() {
  const cols = ['pid', 'arm', 'list', 'recall_trials'].concat([1, 2, 3, 4, 5, 6, 7, 8].map((i) => 'order_' + i));
  const rows = PIDS.map((pid) => {
    const { arm, list } = C.assignment(pid);
    const row = { pid, arm, list, recall_trials: C.LISTS[list].join('|') };
    C.trialOrder(pid, arm, list).forEach((t, i) => { row['order_' + (i + 1)] = t; });
    return row;
  });
  fs.writeFileSync(path.join(DIST, 'trial_orders_P001-P080.csv'), C.toCSV(cols, rows));
}

function basketsTable() {
  const cols = [['Trial', 7], ['Basket', 8], ['B', 9], ['Delivery', 10], ['Small cart', 12], ['Handling', 10], ['Platform', 10], ['F', 8], ['T', 9], ['Items', 0]];
  const line = (cells) => cells.map((c, i) => String(c).padEnd(cols[i][1])).join('').trimEnd();
  const rs = (v) => 'Rs ' + v;
  const rows = C.TRIAL_IDS.map((id) => {
    const t = C.TRIALS[id], p = C.priceCart(C.initialCart(id));
    return line([id, t.basket, rs(p.B), rs(p.delivery), rs(p.smallCart), rs(p.handling), rs(p.platform), rs(p.F), rs(p.T),
      t.items.map((k) => C.PRODUCTS[k].name).join(', ')]);
  });
  const head = line(cols.map((c) => c[0]));
  return [head, '-'.repeat(head.length)].concat(rows).join('\n');
}

function packFiles() {
  const bat = path.join(DIST, 'Start_QuikKart_Windows.bat');
  fs.writeFileSync(bat, crlf(fs.readFileSync(path.join(PACK, 'Start_QuikKart_Windows.bat'), 'utf8')));
  const mac = path.join(DIST, 'Start_QuikKart_Mac.command');
  fs.writeFileSync(mac, fs.readFileSync(path.join(PACK, 'Start_QuikKart_Mac.command'), 'utf8').replace(/\r\n/g, '\n'));
  fs.chmodSync(mac, 0o755);
  const readme = fs.readFileSync(path.join(PACK, 'README.template.txt'), 'utf8')
    .replace('{{BUILT}}', new Date().toISOString().slice(0, 10))
    .replace('{{BASKETS}}', basketsTable());
  fs.writeFileSync(path.join(DIST, 'README.txt'), crlf(readme));
}

async function main() {
  if (!fs.existsSync(APP)) throw new Error('dist/QuikKart_Stimulus_App.html is missing: run `npm run build` first.');
  const t0 = Date.now();
  const nAOI = await renderImages();
  trialOrdersCSV();
  packFiles();
  const n = zipDir(DIST, ZIP, 'QuikKart_Stimulus_Pack', { modeFor: (rel) => (rel.endsWith('.command') ? 0o755 : null) });
  const mb = (fs.statSync(ZIP).size / 1048576).toFixed(1);
  console.log(`Rendered 56 images and ${nAOI} AOI rows; wrote the CSVs, start scripts and README.`);
  console.log(`Pack: ${path.relative(ROOT, ZIP)} (${n} entries, ${mb} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
