'use strict';
// Checks the output of `npm run render` (dist/ and QuikKart_Stimulus_Pack.zip).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { C, DIST, open, parseCSV, pixelDiff } = require('./helpers');
const { listZip } = require('../../scripts/zip');

const ROOT = path.resolve(DIST, '..');
const read = (f) => fs.readFileSync(path.join(DIST, f));
const csv = (f) => parseCSV(read(f).toString('utf8'));
const SCREENS = ['listing', 'cart', 'bill'];
const imageNames = () => ['A', 'B'].flatMap((arm) => C.TRIAL_IDS.flatMap((t) => SCREENS.map((s) => `${arm}_${t}_${C.SCREEN_N[s]}_${s}.png`)));

test.describe('render output and pack', () => {
  test('acceptance 1 (files): bill PNGs are pixel-identical between arms for all 9 trials', () => {
    for (const t of C.TRIAL_IDS) {
      const a = read(`stimuli_png/A_${t}_3_bill.png`), b = read(`stimuli_png/B_${t}_3_bill.png`);
      expect(pixelDiff(a, b), t).toBe(0);
    }
    // ...while the screens before the bill do differ.
    expect(pixelDiff(read('stimuli_png/A_S1_1_listing.png'), read('stimuli_png/B_S1_1_listing.png'))).toBeGreaterThan(0);
  });

  test('54 screen images + fixation + blank mask, and 54 AOI previews, all 1920 x 1080', () => {
    const expected = imageNames();
    expect(expected).toHaveLength(54);
    expect(fs.readdirSync(path.join(DIST, 'stimuli_png')).sort()).toEqual(expected.concat(['blank_mask.png', 'fixation.png']).sort());
    expect(fs.readdirSync(path.join(DIST, 'aoi_preview')).sort()).toEqual(expected.slice().sort());
    for (const f of ['stimuli_png/A_L2_3_bill.png', 'stimuli_png/fixation.png', 'aoi_preview/B_S4_1_listing.png']) {
      const p = PNG.sync.read(read(f));
      expect([p.width, p.height], f).toEqual([1920, 1080]);
    }
    // Previews differ from the clean images only by the drawn AOIs.
    expect(pixelDiff(read('stimuli_png/A_S1_3_bill.png'), read('aoi_preview/A_S1_3_bill.png'))).toBeGreaterThan(1000);
  });

  test('AOI_coordinates.csv: columns, every image, fee AOIs >= 60 px tall, bill AOIs identical across arms', () => {
    const { header, rows } = csv('AOI_coordinates.csv');
    expect(header).toEqual(C.AOI_COLUMNS);
    expect(new Set(rows.map((r) => r.image))).toEqual(new Set(imageNames()));
    for (const r of rows) {
      expect(r.image).toBe(`${r.arm}_${r.trial}_${C.SCREEN_N[r.screen]}_${r.screen}.png`);
      if (r.fee_rupees !== '') expect(Number(r.h), `${r.image} ${r.aoi}`).toBeGreaterThanOrEqual(60);
      expect(['0', '1']).toContain(r.click_zone);
    }
    const fees = rows.filter((r) => r.fee_rupees !== '');
    expect(new Set(fees.map((r) => r.aoi))).toEqual(new Set(C.FEE_AOIS));
    for (const t of C.TRIAL_IDS) {
      const pick = (arm) => rows.filter((r) => r.image === `${arm}_${t}_3_bill.png`).map(({ aoi, x, y, w, h, fee_rupees, click_zone }) => [aoi, x, y, w, h, fee_rupees, click_zone].join());
      expect(pick('A'), t).toEqual(pick('B'));
      const p = C.priceCart(C.initialCart(t));
      expect(fees.filter((r) => r.image === `A_${t}_3_bill.png`).reduce((s, r) => s + Number(r.fee_rupees), 0)).toBe(p.F);
    }
    expect(rows.filter((r) => r.click_zone === '1').map((r) => r.aoi).sort().filter((v, i, a) => a.indexOf(v) === i))
      .toEqual(['BTN_ADD', 'BTN_EXIT', 'BTN_ORDER', 'CRT_PAYBAR', 'LST_CARTBAR']);
  });

  test('acceptance 8: trial orders from the CSV generator match trialOrder and run mode for P001-P080', async ({ page }) => {
    const { header, rows } = csv('trial_orders_P001-P080.csv');
    expect(header).toEqual(['pid', 'arm', 'list', 'recall_trials'].concat([1, 2, 3, 4, 5, 6, 7, 8].map((i) => 'order_' + i)));
    expect(rows.map((r) => r.pid)).toEqual(Array.from({ length: 80 }, (_, i) => 'P' + String(i + 1).padStart(3, '0')));
    await open(page, '');
    const fromPage = await page.evaluate((list) => list.map((r) => window.trialOrder(r.pid, r.arm, r.list)), rows);
    rows.forEach((r, i) => {
      const order = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => r['order_' + k]);
      expect(order.slice().sort(), r.pid).toEqual(C.ORDER8.slice().sort());
      expect(fromPage[i], r.pid).toEqual(order);
      expect({ arm: r.arm, list: r.list }).toEqual(C.assignment(r.pid));
      expect(r.recall_trials).toBe(C.LISTS[r.list].join('|'));
    });
    // Run mode (arm and list taken from the pid) presents P0 and then exactly the CSV order.
    for (const r of rows) {
      await page.goto(`QuikKart_Stimulus_App.html?mode=run&pid=${r.pid}&et=none`);
      const s = await page.evaluate(() => ({ order: window.QKSession.order, arm: window.QKSession.arm, list: window.QKSession.list }));
      expect(s, r.pid).toEqual({ arm: r.arm, list: r.list, order: ['P0'].concat([1, 2, 3, 4, 5, 6, 7, 8].map((k) => r['order_' + k])) });
    }
  });

  test('start scripts, README and licences', () => {
    const bat = read('Start_QuikKart_Windows.bat').toString('utf8');
    expect(bat).toMatch(/\r\n/);
    expect(bat.replace(/\r\n/g, '')).not.toMatch(/\n/);
    expect(bat).toContain('python -c "import http.server"');
    expect(bat).toContain('py -3 -c "import http.server"');
    expect(bat).toContain('http://localhost:8000/QuikKart_Stimulus_App.html');
    expect(bat).toContain('-m http.server 8000');
    const mac = read('Start_QuikKart_Mac.command').toString('utf8');
    expect(mac.startsWith('#!/bin/bash\n')).toBe(true);
    expect(mac).not.toMatch(/\r/);
    expect(mac).toContain('sleep 2; open "http://localhost:8000/QuikKart_Stimulus_App.html"');
    expect(mac).toContain('-m http.server 8000');
    if (process.platform !== 'win32') expect(fs.statSync(path.join(DIST, 'Start_QuikKart_Mac.command')).mode & 0o111).toBe(0o111);

    const readme = read('README.txt').toString('utf8');
    for (const s of ['1. FILES', 'TOBII PRO LAB (IMAGE STIMULI)', '5. THE EDITING PHASE', 'WEBCAM EYE TRACKING', 'ACCURACY LIMITS', '9. DATA FILES']) {
      expect(readme).toContain(s);
    }
    for (const c of C.BEHAVIOUR_COLUMNS) expect(readme, c).toContain(c);
    expect(readme).toMatch(/^S1\s+Small\s+Rs 118\s+Rs 30\s+Rs 20\s+Rs 11\s+Rs 5\s+Rs 66\s+Rs 184\s+Toned milk/m);
    expect(readme).toMatch(/^L2\s+Large\s+Rs 462\s+Rs 0\s+Rs 0\s+Rs 11\s+Rs 5\s+Rs 16\s+Rs 478\s+Detergent powder/m);

    for (const f of ['webcam/webgazer.js', 'webcam/LICENSE.md', 'webcam/GPL-3.0.txt', 'webcam/mediapipe/face_mesh/face_mesh.js',
      'webcam/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm', 'webcam/mediapipe/face_mesh/Apache-2.0.txt', 'licences/Roboto_font_OFL-1.1.txt']) {
      expect(fs.existsSync(path.join(DIST, f)), f).toBe(true);
    }
    expect(read('webcam/GPL-3.0.txt').toString('utf8')).toContain('GNU GENERAL PUBLIC LICENSE');
  });

  test('QuikKart_Stimulus_Pack.zip holds every file, with the Mac script executable', () => {
    const entries = listZip(path.join(ROOT, 'QuikKart_Stimulus_Pack.zip'));
    const names = new Set(entries.map((e) => e.name));
    const walk = (d, base) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name), base + e.name + '/') : [base + e.name]);
    for (const f of walk(DIST, 'QuikKart_Stimulus_Pack/')) expect(names.has(f), f).toBe(true);
    const mac = entries.find((e) => e.name === 'QuikKart_Stimulus_Pack/Start_QuikKart_Mac.command');
    expect(mac.mode).toBe(0o755);
    expect(mac.madeBy).toBe(3);
    expect(entries.find((e) => e.name === 'QuikKart_Stimulus_Pack/README.txt').mode).toBe(0o644);
  });
});
