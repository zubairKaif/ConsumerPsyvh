'use strict';
const { test, expect } = require('@playwright/test');
const { C, watchErrors, parseCSV, playSession } = require('./helpers');

// Chrome's fake camera: a moving test pattern, granted without a permission prompt. It contains no face.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

const RUN = (pid, extra) => `QuikKart_Stimulus_App.html?mode=run&pid=${pid}&arm=A&list=A&et=webcam${extra || ''}`;

async function startCamera(page) {
  await page.getByRole('button', { name: 'Start camera' }).click();
  await page.getByRole('heading', { name: 'Camera check' }).waitFor({ timeout: 90000 });
}

/** Clicks each calibration dot 5 times at its centre (by coordinates: MediaPipe on software GL keeps the
 *  main thread busy, so actionability checks would be slow), waiting for the next dot each time. */
async function clickAllDots(page) {
  const seen = [];
  for (let i = 0; i < 9; i++) {
    await expect(page.locator('.cal-prog')).toHaveText(`Dot ${i + 1} of 9`, { timeout: 20000 });
    const d = page.locator('.cal-dot:not(.is-done)');
    seen.push(await d.evaluate((e) => e.style.left + ',' + e.style.top));
    const b = await d.boundingBox();
    for (let k = 0; k < 5; k++) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.locator('.cal-dot').waitFor({ state: 'detached', timeout: 20000 });
  return seen;
}

/** Feeds synthetic gaze to the tracker while validation dots are shown: target + (dx, dy) px. */
async function injectGaze(page, dx, dy) {
  await page.evaluate(([ox, oy]) => {
    clearInterval(window.__inj);
    window.__inj = setInterval(() => {
      const d = document.querySelector('.val-dot');
      if (!d || !window.QKSession) return;
      const x = (parseFloat(d.style.left) / 100) * innerWidth + ox, y = (parseFloat(d.style.top) / 100) * innerHeight + oy;
      window.QKSession.tracker.sample(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4);
    }, 30);
  }, [dx, dy]);
}

async function validateWith(page, dx, dy) {
  await injectGaze(page, dx, dy);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('heading', { name: 'Calibration result' }).waitFor({ timeout: 30000 });
  await page.evaluate(() => clearInterval(window.__inj));
}

test.describe('eye tracking: webcam (WebGazer 3.5.3)', () => {
  test('acceptance 7: served from localhost, WebGazer loads from ./webcam and calibration appears with no console errors', async ({ page }) => {
    const errors = watchErrors(page);
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto(RUN('W1'));
    await expect(page.getByText('No video is recorded, stored or uploaded')).toBeVisible();
    await startCamera(page);

    // Camera check: preview at the top, status text, Continue disabled until a face is found.
    const video = await page.locator('#webgazerVideoContainer').boundingBox();
    expect(video.y).toBeLessThan(60);
    expect(Math.abs(video.x + video.width / 2 - 960)).toBeLessThan(2);
    await expect(page.locator('#webgazerFaceOverlay')).toBeVisible();
    await expect(page.locator('#webgazerFaceFeedbackBox')).toBeVisible();
    await expect(page.locator('[data-status]')).toHaveText('Looking for your face…');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByText('Researcher: continue anyway').click();

    await page.getByRole('button', { name: 'Start calibration' }).click();
    await expect(page.locator('.cal-dot')).toBeVisible();
    await expect(page.locator('.cal-prog')).toHaveText('Dot 1 of 9');
    await expect(page.locator('#webgazerVideoContainer')).toBeHidden();

    const local = (u) => u.startsWith('http://localhost:4173/webcam/');
    expect(urls.some((u) => u === 'http://localhost:4173/webcam/webgazer.js')).toBe(true);
    expect(urls.some((u) => local(u) && u.includes('/mediapipe/face_mesh/') && u.endsWith('.wasm'))).toBe(true);
    expect(urls.filter((u) => u.includes('jsdelivr'))).toEqual([]);
    expect(await page.evaluate(() => window.webgazer.params.faceMeshSolutionPath)).toBe('./webcam/mediapipe/face_mesh');
    expect(errors).toEqual([]);
  });

  test('calibration (9 dots x 5 clicks) then validation (5 dots): degrees, labels, recalibrate loop', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(RUN('W2', '&cm=34.5&dist=60'));
    await startCamera(page);
    await page.getByText('Researcher: continue anyway').click();
    await page.getByRole('button', { name: 'Start calibration' }).click();
    // The 9 dots appear one at a time at 10/50/90 % of the window, in random order.
    const seen = await clickAllDots(page);
    expect(new Set(seen).size).toBe(9);
    for (const p of seen) expect(p).toMatch(/^(10|50|90)%,(10|50|90)%$/);

    // No gaze at all (the fake camera shows no face): Poor, with no data.
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('heading', { name: 'Calibration result' }).waitFor({ timeout: 30000 });
    await expect(page.locator('.val-badge')).toHaveText('Poor');
    await expect(page.getByText('0 of 5 dots with data')).toBeVisible();

    // Recalibrate goes round again. Gaze 58 px right of every target is about 1 degree at 34.5 cm / 1920 px / 60 cm.
    await page.getByRole('button', { name: 'Recalibrate' }).click();
    await page.getByRole('button', { name: 'Start calibration' }).click();
    await clickAllDots(page);
    await validateWith(page, 58, 0);
    const v = await page.evaluate(() => window.QKSession.tracker.validations.slice(-1)[0]);
    expect(v.dots).toBe(5);
    expect(v.accDeg).toBeGreaterThan(0.9);
    expect(v.accDeg).toBeLessThan(1.1);
    expect(v.precDeg).toBeLessThan(0.2);
    await expect(page.locator('.val-badge')).toHaveText('Good');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('full webcam session: the mid-session check before trial 5 recalibrates automatically above 4.5 degrees', async ({ page }) => {
    test.setTimeout(480000);
    const errors = watchErrors(page);
    const { behaviour, gaze, hashes } = await playSession(page, {
      pid: 'W3', arm: 'B', list: 'B', et: 'webcam',
      beforeWelcome: async (p) => {
        await startCamera(p);
        await p.getByText('Researcher: continue anyway').click();
        await p.getByRole('button', { name: 'Start calibration' }).click();
        await clickAllDots(p);
        await validateWith(p, 30, 0);
        await p.getByRole('button', { name: 'Continue' }).click();
      },
      beforeTrial: async (p, order) => {
        if (order !== 5) return;
        await injectGaze(p, 0, 6 * 58.3);                  // 6 degrees off -> automatic recalibration
        await p.getByRole('button', { name: 'Start the check' }).click({ timeout: 30000 });
        await p.getByText('Accuracy has dropped, so let\'s calibrate again.').waitFor({ timeout: 30000 });
        await p.evaluate(() => clearInterval(window.__inj));
        await p.getByRole('button', { name: 'Start calibration' }).click();
        await clickAllDots(p);
        await validateWith(p, 0, 40);
        await expect(p.locator('.val-badge')).toHaveText('Good');
        await p.getByRole('button', { name: 'Continue' }).click();
      },
    });
    expect(errors).toEqual([]);
    const rows = parseCSV(behaviour).rows;
    expect(rows).toHaveLength(9);
    const acc = rows.map((r) => Number(r.wc_cal_acc_deg));
    for (let i = 0; i < 5; i++) expect(acc[i]).toBeCloseTo(30 / 58.3, 1);   // set-up validation
    for (let i = 5; i < 9; i++) expect(acc[i]).toBeCloseTo(40 / 58.3, 1);   // after the mid-session recalibration
    for (const r of rows) {
      expect(r.et_mode).toBe('webcam');
      expect(Number(r.wc_bill_samples)).toBeGreaterThan(0);
      expect(r.wc_bill_valid_pct).toBe('0');                          // the fake camera shows no face
      expect(r.wc_fees_hit).toBe('0');
    }
    const g = parseCSV(gaze);
    expect(g.header).toEqual(C.GAZE_COLUMNS);
    expect(g.rows.length).toBeGreaterThan(50);
    expect(new Set(g.rows.map((r) => r.aoi_group))).toEqual(new Set(['NO_FACE']));
    expect(hashes).toContain('#5-none-check');
    expect(hashes).toContain('#5-none-calibration');
  });
});
