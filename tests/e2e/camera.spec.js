'use strict';
// "The app is not accessing the camera": every way the camera can fail to start must request the camera
// first and then say exactly what is wrong and how to fix it. Uses Chrome's fake camera.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { DIST } = require('./helpers');

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

const CDN = 'https://cdn.jsdelivr.net/npm/webgazer@3.5.3/dist/';
const FILE_APP = 'file://' + path.join(DIST, 'QuikKart_Stimulus_App.html');
const RUN = 'mode=run&pid=C1&arm=A&list=A&et=webcam';

/** Records getUserMedia calls and outcomes in window.__gum. */
const spyCamera = () => {
  window.__gum = [];
  const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => {
    window.__gum.push('called');
    return orig(c).then((s) => { window.__gum.push('granted'); return s; }, (e) => { window.__gum.push(e.name); throw e; });
  };
};

async function startCamera(page) {
  await page.getByRole('button', { name: 'Start camera' }).click();
}

test.describe('camera access and failure messages', () => {
  test('the camera is requested on Start camera, before WebGazer loads; a stalled load times out', async ({ page }) => {
    await page.addInitScript(() => { window.__QK_LOAD_TIMEOUT_MS = 2500; });
    await page.addInitScript(spyCamera);
    await page.route('**/webcam/webgazer.js', () => {});   // never answers
    await page.goto('QuikKart_Stimulus_App.html?' + RUN);
    await startCamera(page);
    await expect.poll(() => page.evaluate(() => window.__gum)).toEqual(['called', 'granted']);
    await expect(page.getByRole('heading', { name: 'Starting eye tracking took too long.' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('TimeoutError: Loading webgazer.js took too long.')).toBeVisible();
    // Try again, now with the real file: the camera check appears.
    await page.unroute('**/webcam/webgazer.js');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Camera check' })).toBeVisible({ timeout: 90000 });
  });

  test('opened as a file without internet: the camera works and the message points to the start script', async ({ page }) => {
    await page.addInitScript(spyCamera);
    await page.context().route(CDN + '**', (r) => r.abort('internetdisconnected'));
    await page.goto(FILE_APP + '?' + RUN);
    await startCamera(page);
    await expect(page.getByRole('heading', { name: 'The camera works, but the eye-tracking files could not be downloaded.' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Start_QuikKart_Windows.bat or Start_QuikKart_Mac.command')).toBeVisible();
    expect(await page.evaluate(() => window.__gum)).toEqual(['called', 'granted']);
  });

  test('opened as a file with a stalled CDN: a timeout, not an endless "Starting the camera…"', async ({ page }) => {
    await page.addInitScript(() => { window.__QK_LOAD_TIMEOUT_MS = 2000; });
    await page.context().route(CDN + '**', () => {});
    await page.goto(FILE_APP + '?' + RUN);
    await startCamera(page);
    await expect(page.getByText('Downloading the eye-tracking files (about 12 MB)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Downloading the eye-tracking files took too long.' })).toBeVisible({ timeout: 10000 });
  });

  test('opened as a file with internet: WebGazer and the face model come from the CDN', async ({ page }) => {
    // Serve the CDN paths from the local copy (this sandbox has no internet).
    const urls = [];
    await page.context().route(CDN + '**', (r) => {
      urls.push(r.request().url());
      const f = path.join(DIST, 'webcam', r.request().url().slice(CDN.length).split('?')[0]);
      const type = f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
      r.fulfill({ path: f, headers: { 'access-control-allow-origin': '*', 'content-type': type } });
    });
    await page.goto(FILE_APP + '?' + RUN);
    await startCamera(page);
    await expect(page.getByRole('heading', { name: 'Camera check' })).toBeVisible({ timeout: 90000 });
    expect(urls).toContain(CDN + 'webgazer.js');
    expect(urls.some((u) => u.startsWith(CDN + 'mediapipe/face_mesh/') && u.endsWith('.wasm'))).toBe(true);
    expect(await page.evaluate(() => window.webgazer.params.faceMeshSolutionPath)).toBe(CDN + 'mediapipe/face_mesh');
  });

  for (const [error, heading] of [
    ['NotAllowedError', 'Camera access was blocked.'],
    ['NotReadableError', 'The camera is busy or could not start.'],
    ['NotFoundError', 'No camera was found.'],
  ]) {
    test(`${error}: specific advice, and Try again recovers`, async ({ page }) => {
      // The first request fails with this error; later ones use the (fake) camera.
      await page.addInitScript((name) => {
        const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
        let first = true;
        md.getUserMedia = (c) => { if (first) { first = false; return Promise.reject(new DOMException('simulated', name)); } return orig(c); };
      }, error);
      await page.goto('QuikKart_Stimulus_App.html?' + RUN);
      await startCamera(page);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByText(`${error}: simulated`)).toBeVisible();
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(page.getByRole('heading', { name: 'Camera check' })).toBeVisible({ timeout: 90000 });
    });
  }

  test('inside another site\'s frame (no camera permission): says to open it in its own tab', async ({ page }) => {
    // 127.0.0.1 and localhost are different origins, so the frame may not use the camera.
    await page.goto('http://127.0.0.1:4173/QuikKart_Stimulus_App.html?mode=blank');
    await page.evaluate((src) => { document.body.innerHTML = `<iframe src="${src}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`; },
      'http://localhost:4173/QuikKart_Stimulus_App.html?' + RUN);
    const frame = page.frameLocator('iframe');
    await frame.getByRole('button', { name: 'Start camera' }).click();
    await expect(frame.getByRole('heading', { name: 'This page is shown inside another page, which blocks the camera.' })).toBeVisible();
  });

  test('console: Webcam is the default; Test camera shows a live preview and passes all checks', async ({ page }) => {
    await page.goto('QuikKart_Stimulus_App.html');
    await expect(page.locator('#run select[name=et]')).toHaveValue('webcam');
    await expect(page.locator('[data-et-hint]')).toHaveText('The camera turns on when the participant clicks Start camera. Test it here first.');
    await page.getByRole('button', { name: 'Test camera' }).click();
    await expect(page.locator('.ck-ok')).toHaveCount(3, { timeout: 30000 });
    await expect(page.locator('.ck-ok b')).toHaveText(['Camera works', 'Eye-tracking library', 'Face model']);
    await expect.poll(() => page.locator('[data-cam-video]').evaluate((v) => v.videoWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Stop camera' }).click();
    expect(await page.locator('[data-cam-video]').evaluate((v) => v.srcObject)).toBeNull();
    // Other modes say the camera stays off and hide the test.
    await page.locator('#run select[name=et]').selectOption('none');
    await expect(page.locator('[data-et-hint]')).toHaveText('The app does not use the camera in this mode.');
    await expect(page.locator('[data-cam]')).toBeHidden();
  });

  test('console opened as a file without internet: camera passes, library and face model are flagged with the fix', async ({ page }) => {
    await page.context().route(CDN + '**', (r) => r.abort('internetdisconnected'));
    await page.goto(FILE_APP);
    await expect(page.locator('[data-file-hint]')).toBeVisible();
    await page.getByRole('button', { name: 'Test camera' }).click();
    await expect(page.locator('.ck-wait')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.ck-ok b')).toHaveText(['Camera works']);
    await expect(page.locator('.ck-bad b')).toHaveText(['WebGazer could not be loaded', 'The face-model files could not be reached']);
    await expect(page.locator('.ck-bad').first()).toContainText('Start the app with the start script instead');
  });
});
