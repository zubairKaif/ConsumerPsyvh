/* Eye tracking for run mode.
 * et=mouse  samples the cursor every 33 ms as if it were gaze (pipeline testing).
 * et=webcam uses WebGazer 3.5.3: camera check, 9-dot calibration, 5-dot validation, mid-session check.
 * Both feed GazeRecorder, which hit-tests every sample against the AOIs of the current phone screen. */
'use strict';

const WG_CDN = 'https://cdn.jsdelivr.net/npm/webgazer@3.5.3/dist';
const MOUSE_MS = 33;
const CAL_CLICKS = 5;
const CAL_POINTS = [10, 50, 90].flatMap((y) => [10, 50, 90].map((x) => [x, y]));
const VAL_POINTS = [[50, 50], [25, 25], [75, 25], [25, 75], [75, 75]];
const VAL_SHOW_MS = 2000, VAL_COLLECT_MS = 1200;
const MID_RECAL_DEG = 4.5;
const FACE_FRESH_MS = 700;
// Loading never hangs silently: the script is 1.9 MB, the face model about 10 MB from the CDN on file://.
const LOAD_TIMEOUT_MS = window.__QK_LOAD_TIMEOUT_MS || 45000;
const START_TIMEOUT_MS = window.__QK_START_TIMEOUT_MS || 90000;

/** Where WebGazer comes from: ./webcam when served over http(s), the CDN when opened as a file. */
const wgBase = () => (/^https?:$/.test(location.protocol) ? './webcam' : WG_CDN);

function withTimeout(promise, ms, message) {
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { name: 'TimeoutError' })), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Asks for the camera at once, so the permission prompt appears on the click and camera problems
 *  are reported before WebGazer and its face model are downloaded. Resolves with a MediaStream. */
function requestCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.reject(Object.assign(new Error('This page is not a secure context.'), { name: 'InsecureContext' }));
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
}

const stopStream = (stream) => { if (stream) stream.getTracks().forEach((t) => t.stop()); };

/** What went wrong and what to do about it, for every way the camera or WebGazer can fail to start. */
function cameraHelp(err) {
  const name = (err && err.name) || '', file = location.protocol === 'file:';
  const embedded = window.self !== window.top;
  const startScript = 'Start the app with Start_QuikKart_Windows.bat or Start_QuikKart_Mac.command, which open it at http://localhost:8000.';
  if (embedded && /NotAllowed|Security|NotSupported|InsecureContext/.test(name)) {
    return { title: 'This page is shown inside another page, which blocks the camera.', fix: 'Open QuikKart_Stimulus_App.html in its own browser tab. ' + startScript };
  }
  switch (name) {
    case 'InsecureContext':
      return { title: 'The browser allows the camera only on secure pages.', fix: startScript };
    case 'NotAllowedError': case 'PermissionDeniedError': case 'SecurityError':
      return { title: 'Camera access was blocked.', fix: 'Click the camera icon at the right of the address bar (or the padlock, then Site settings), choose Allow, then click Try again. Also check that the computer lets the browser use the camera: on a Mac, System Settings > Privacy & Security > Camera; on Windows, Settings > Privacy & security > Camera.' };
    case 'NotFoundError': case 'DevicesNotFoundError':
      return { title: 'No camera was found.', fix: 'Connect or switch on a webcam (some laptops have a camera switch or a privacy shutter), then click Try again.' };
    case 'NotReadableError': case 'TrackStartError': case 'AbortError':
      return { title: 'The camera is busy or could not start.', fix: 'Close other apps that use the camera (Zoom, Teams, the Camera app) and check the camera privacy settings of the computer, then click Try again.' };
    case 'OverconstrainedError':
      return { title: 'The camera does not offer a usable picture size (at least 320 x 240).', fix: 'Use another webcam, then click Try again.' };
    case 'NotSupportedError':
      return { title: 'This browser does not allow camera access on this page.', fix: 'Use Chrome or Edge. ' + startScript };
    case 'LoadError':
      return file
        ? { title: 'The camera works, but the eye-tracking files could not be downloaded.', fix: 'Opened as a file, the app downloads WebGazer from cdn.jsdelivr.net, which this computer cannot reach (no internet, or the network blocks it). ' + startScript + ' That uses the copy in the webcam folder and works offline.' }
        : { title: 'The eye-tracking files are missing.', fix: 'Keep the webcam folder next to QuikKart_Stimulus_App.html (unzip the whole pack), then click Try again.' };
    case 'TimeoutError':
      return file
        ? { title: 'Downloading the eye-tracking files took too long.', fix: 'The connection to cdn.jsdelivr.net is too slow or blocked. ' + startScript + ' That works offline.' }
        : { title: 'Starting eye tracking took too long.', fix: 'Close other heavy apps, check that hardware acceleration is on in the browser settings, then click Try again.' };
    default:
      return { title: 'The camera did not start.', fix: 'Check that a camera is connected, that no other app is using it, and that this page may use it, then click Try again.' };
  }
}

const Tracker = {
  create(cfg) {
    if (cfg.et === 'mouse') return new MouseTracker(cfg);
    if (cfg.et === 'webcam') return new WebcamTracker(cfg);
    return {
      setup: async () => {}, midCheck: async () => {},
      beginTrial() {}, screen() {}, refresh() {}, endScreens() {},
      billSummary: () => ({}), calAccDeg: () => '', hasGaze: () => false, gazeCSV: () => toCSV(GAZE_COLUMNS, []),
    };
  },
};

/** Mode-agnostic recording: AOI cache per screen, hit-testing, gaze rows, first-pass bill summary. */
class GazeRecorder {
  constructor(cfg) {
    this.cfg = cfg;
    this.rows = [];         // gaze CSV rows in GAZE_COLUMNS order
    this.trial = null;      // { id, order }
    this.cur = null;        // { label, onset, prepared }
    this.bill = null;       // first-pass bill: { samples: [{ t, group }], end }
    this.collector = null;  // validation sink, gets every sample
    this.lastAcc = null;    // latest validation accuracy in degrees
    Phone.onResize(() => this.refresh());
  }

  hasGaze() { return true; }
  calAccDeg() { return this.lastAcc === null ? '' : this.lastAcc.toFixed(2); }
  gazeCSV() { return toCSV(GAZE_COLUMNS, this.rows); }
  async midCheck() {}

  beginTrial(id, order) { this.trial = { id, order }; this.bill = null; }

  /** A trial screen was rendered: cache its AOIs and record samples under its label. */
  screen(label) {
    this.closeScreen();
    this.cur = { label, onset: performance.now(), prepared: null };
    if (label === 'bill') this.bill = { samples: [], end: null };
    this.refresh();
  }

  refresh() {
    if (this.cur) this.cur.prepared = prepareAOIs(Phone.getAOIs(), Phone.phoneRect());
  }

  closeScreen() {
    if (this.cur && this.cur.label === 'bill' && this.bill && this.bill.end === null) {
      this.bill.end = performance.now() - this.cur.onset;
    }
    this.cur = null;
    if (this.cfg.dot) Phone.highlight(null);
  }

  endScreens() { this.closeScreen(); }

  /** One gaze sample in viewport px; x/y are null when there is no estimate (no face). */
  sample(x, y) {
    if (this.collector) this.collector(x, y);
    const cur = this.cur;
    if (!cur || !cur.prepared || !this.trial) return;
    const t = performance.now() - cur.onset;
    const hit = classifyPoint(x, y, cur.prepared);
    const has = x !== null && y !== null && isFinite(x) && isFinite(y);
    this.rows.push([this.cfg.pid, this.cfg.arm, this.trial.id, this.trial.order, cur.label, Math.round(t),
      has ? Math.round(x) : '', has ? Math.round(y) : '', hit.aoi, hit.group]);
    if (cur.label === 'bill' && this.bill) this.bill.samples.push({ t, group: hit.group });
    if (this.cfg.dot) {
      const rect = hit.group === 'FEES' ? cur.prepared.fees : cur.prepared.aois.find((a) => a.aoi === hit.aoi);
      Phone.highlight(rect || null);
    }
  }

  /** wc_* columns, from the first-pass bill only. */
  billSummary() {
    if (!this.bill) return summarizeGaze([], 0);
    return summarizeGaze(this.bill.samples, this.bill.end === null ? Infinity : this.bill.end);
  }
}

class MouseTracker extends GazeRecorder {
  async setup() {
    let x = null, y = null;
    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, true);
    document.documentElement.addEventListener('mouseleave', () => { x = null; y = null; });
    setInterval(() => this.sample(x, y), MOUSE_MS);
  }
}

class WebcamTracker extends GazeRecorder {
  constructor(cfg) {
    super(cfg);
    this.faceAt = -Infinity;
    this.validations = [];
    this.hashOrder = 0;   // order shown in the URL hash during set-up (0) or the mid-session check (5)
  }

  get base() { return wgBase(); }

  async setup() {
    const camera = await this.intro();
    await this.start(camera);
    await this.cameraCheck();
    await this.calibrateAndCheck();
  }

  /** Mid-session check: validate; recalibrate straight away if accuracy is worse than 4.5 degrees. */
  async midCheck() {
    this.hashOrder = 5;
    const v = await this.validate('mid');
    if (v.accDeg !== null && v.accDeg <= MID_RECAL_DEG) {
      if (await this.result(v) === 'continue') return;
      return this.calibrateAndCheck();
    }
    await this.calibrateAndCheck(v.accDeg === null ? 'We could not see your eyes well, so let\'s calibrate again.'
      : 'Accuracy has dropped, so let\'s calibrate again.');
  }

  intro() {
    setHash(0, 'none', 'camera');
    return page(`<div class="run-card"><div class="run-brand">QuikKart</div><h1>Camera set-up</h1>
      <p>This study estimates where you look on the screen using the computer's camera.</p>
      <p class="run-note">No video is recorded, stored or uploaded. The camera image is processed only inside this browser, on this computer, while the study runs.</p>
      <p>Your browser will ask for permission to use the camera. Please choose Allow.</p>
      <button class="run-btn" data-go>Start camera</button></div>`,
    (root, done) => root.querySelector('[data-go]').addEventListener('click', () => {
      const camera = requestCamera();
      camera.catch(() => {});   // handled in start()
      done({ camera });         // wrapped: resolving with the promise itself would wait for the camera
    }));
  }

  /** Camera first (already requested in the click), then WebGazer from ./webcam over http(s) or the CDN on
   *  file://. Every failure shows what went wrong and how to fix it, with Try again. */
  async start(first) {
    let pending = first && first.camera;
    for (;;) {
      const cdn = this.base === WG_CDN;
      Phone.showOverlay(`<div class="run-card"><h1>Starting the camera…</h1><p>${cdn
        ? 'Downloading the eye-tracking files (about 12 MB) the first time. This can take a minute.'
        : 'This can take a few seconds.'}</p></div>`, 'ov-run');
      try {
        stopStream(await (pending || requestCamera()));   // permission granted; WebGazer opens its own stream
        pending = null;
        await this.begin();
        return;
      } catch (err) {
        pending = null;
        console.warn('Webcam start failed:', err);
        try { if (window.webgazer) window.webgazer.end(); } catch (e) { /* begin() stopped before creating its elements */ }
        const help = cameraHelp(err);
        await page(`<div class="run-card"><h1>${esc(help.title)}</h1><p>${esc(help.fix)}</p>
          <p class="run-tech">${esc([err && err.name, err && err.message].filter(Boolean).join(': '))}</p>
          <button class="run-btn" data-go>Try again</button></div>`,
        (root, done) => root.querySelector('[data-go]').addEventListener('click', () => done()));
      }
    }
  }

  async begin() {
    if (!window.webgazer) {
      await withTimeout(loadScript(this.base + '/webgazer.js'), LOAD_TIMEOUT_MS, 'Loading webgazer.js took too long.');
    }
    const wg = window.webgazer;
    if (!wg) throw new Error('WebGazer did not load.');
    wg.params.faceMeshSolutionPath = this.base + '/mediapipe/face_mesh';
    wg.saveDataAcrossSessions(false);
    wg.setRegression('ridge');
    wg.applyKalmanFilter(true);
    wg.showPredictionPoints(!!this.cfg.dot);
    // Face found/lost signal: getTracker().getPositions() goes stale when the face is lost, so watch each frame.
    const tracker = wg.getTracker();
    if (!tracker.__qkWrapped) {
      const orig = tracker.getEyePatches;
      const self = this;
      tracker.getEyePatches = async function () {
        const r = await orig.apply(this, arguments);
        if (r) self.faceAt = performance.now();
        return r;
      };
      tracker.__qkWrapped = true;
    }
    wg.setGazeListener((data) => this.sample(data ? data.x : null, data ? data.y : null));
    // begin() alerts outside https/localhost even where the camera works (file://, 127.0.0.1); log instead.
    const alert0 = window.alert;
    if (window.isSecureContext) window.alert = (m) => console.info('[WebGazer] ' + m);
    let started;
    try { started = wg.begin(); } finally { window.alert = alert0; }
    await withTimeout(started, START_TIMEOUT_MS, 'WebGazer did not finish starting.');
    wg.removeMouseEventListeners();   // begin() adds them; they must be on only during calibration
    wg.clearData();
    this.wg = wg;
  }

  faceFound() { return performance.now() - this.faceAt < FACE_FRESH_MS; }

  cameraCheck() {
    setHash(0, 'none', 'cameracheck');
    const wg = this.wg;
    wg.showVideoPreview(true).showVideo(true).showFaceOverlay(true).showFaceFeedbackBox(true);
    return page(`<div class="cam-page"><div class="run-card">
      <h1>Camera check</h1>
      <p>Sit about an arm's length from the screen, facing it. Keep your face in the middle of the video, inside the box, with both eyes clearly visible and evenly lit.</p>
      <div class="cam-status" data-status>Looking for your face…</div>
      <div><button class="run-btn" data-go disabled>Continue</button></div>
      <a href="#" class="cam-skip" data-skip>Researcher: continue anyway</a></div></div>`,
    (root, done) => {
      const status = root.querySelector('[data-status]'), go = root.querySelector('[data-go]');
      const timer = setInterval(() => {
        const ok = this.faceFound();
        status.textContent = ok ? 'Face found' : 'Looking for your face…';
        status.classList.toggle('is-ok', ok);
        go.disabled = !ok;
      }, 200);
      const finish = (e) => {
        if (e) e.preventDefault();
        clearInterval(timer);
        wg.showVideoPreview(false);
        goFullscreen();   // now, so calibration happens in the same viewport as the trials
        done();
      };
      go.addEventListener('click', () => finish());
      root.querySelector('[data-skip]').addEventListener('click', finish);
    }, 'ov-run ov-cam');
  }

  async calibrateAndCheck(reason) {
    for (;;) {
      await this.calibrate(reason);
      const v = await this.validate('setup');
      if (await this.result(v) === 'continue') return;
      reason = null;
    }
  }

  /** 9 red dots at 10/50/90 % in random order; 5 clicks each while looking at the dot. */
  async calibrate(reason) {
    setHash(this.hashOrder, 'none', 'calibration');
    await page(`<div class="run-card"><h1>Calibration</h1>${reason ? `<p class="run-note">${reason}</p>` : ''}
      <p>Red dots will appear one at a time. Look at each dot and click it ${CAL_CLICKS} times, keeping your eyes on it. It turns green when it is done.</p>
      <p>Keep your head still and as you are now.</p>
      <button class="run-btn" data-go>Start calibration</button></div>`,
    (root, done) => root.querySelector('[data-go]').addEventListener('click', () => done()));
    const wg = this.wg;
    wg.clearData();
    const order = CAL_POINTS.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const root = Phone.showOverlay('<div class="cal-dot" data-dot></div><div class="cal-prog" data-prog></div>', 'ov-cal');
    const dot = root.querySelector('[data-dot]'), prog = root.querySelector('[data-prog]');
    wg.addMouseEventListeners();
    try {
      for (let i = 0; i < order.length; i++) {
        const [px, py] = order[i];
        dot.className = 'cal-dot';
        dot.style.left = px + '%';
        dot.style.top = py + '%';
        dot.style.opacity = 0.35;
        prog.textContent = `Dot ${i + 1} of ${order.length}`;
        await new Promise((resolve) => {
          let n = 0;
          const onClick = () => {
            n++;
            dot.style.opacity = Math.min(1, 0.35 + (0.65 * n) / CAL_CLICKS);
            if (n < CAL_CLICKS) return;
            dot.removeEventListener('click', onClick);
            dot.classList.add('is-done');
            setTimeout(resolve, 300);
          };
          dot.addEventListener('click', onClick);
        });
      }
    } finally {
      wg.removeMouseEventListeners();
    }
  }

  /** 5 black dots, 2 s each; samples from the last 1.2 s. Accuracy = mean distance from the mean gaze to the
   *  target; precision = RMS spread around the mean gaze. Both converted to degrees of visual angle. */
  async validate(when) {
    const mid = when === 'mid';
    setHash(this.hashOrder, 'none', mid ? 'check' : 'validation');
    await page(`<div class="run-card"><h1>${mid ? 'Quick camera check' : 'Accuracy check'}</h1>
      <p>${mid ? 'Before the next orders, ' : 'Now '}${VAL_POINTS.length} black dots will appear one at a time. Look at the centre of each dot until it disappears. Do not click.</p>
      <button class="run-btn" data-go>${mid ? 'Start the check' : 'Start'}</button></div>`,
    (root, done) => root.querySelector('[data-go]').addEventListener('click', () => done()));
    const root = Phone.showOverlay('<div class="val-dot" data-dot></div>', 'ov-cal');
    const dot = root.querySelector('[data-dot]');
    const perDot = [];
    for (const [px, py] of VAL_POINTS) {
      dot.style.left = px + '%';
      dot.style.top = py + '%';
      const tx = (window.innerWidth * px) / 100, ty = (window.innerHeight * py) / 100;
      await sleep(VAL_SHOW_MS - VAL_COLLECT_MS);
      const pts = [];
      this.collector = (x, y) => { if (x !== null && y !== null && isFinite(x) && isFinite(y)) pts.push([x, y]); };
      await sleep(VAL_COLLECT_MS);
      this.collector = null;
      if (!pts.length) continue;
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const rms = Math.sqrt(pts.reduce((s, p) => s + (p[0] - mx) ** 2 + (p[1] - my) ** 2, 0) / pts.length);
      perDot.push({ acc: Math.hypot(mx - tx, my - ty), rms, n: pts.length });
    }
    const toDeg = (px) => pxToDeg(px, this.cfg.cm, window.screen.width, this.cfg.dist);
    const mean = (k) => perDot.reduce((s, d) => s + d[k], 0) / perDot.length;
    const v = perDot.length
      ? { when, accDeg: toDeg(mean('acc')), precDeg: toDeg(mean('rms')), dots: perDot.length, samples: perDot.reduce((s, d) => s + d.n, 0) }
      : { when, accDeg: null, precDeg: null, dots: 0, samples: 0 };
    v.label = accuracyLabel(v.accDeg);
    this.validations.push(v);
    this.lastAcc = v.accDeg;
    return v;
  }

  result(v) {
    const fmt = (d) => (d === null ? 'no data' : d.toFixed(1) + '°');
    return page(`<div class="run-card"><h1>Calibration result</h1>
      <div class="val-badge val-${v.label.toLowerCase()}">${v.label}</div>
      <p>Accuracy ${fmt(v.accDeg)} · precision ${fmt(v.precDeg)} · ${v.dots} of ${VAL_POINTS.length} dots with data</p>
      <p class="val-scale">Good ≤ 3°, usable ≤ 4.5°, poor above that or with no data.</p>
      <div class="run-res-btns"><button class="run-btn" data-v="continue">Continue</button>
      <button class="run-btn run-btn-2" data-v="recalibrate">Recalibrate</button></div></div>`,
    (root, done) => root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => done(b.dataset.v))));
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(Object.assign(new Error('Could not load ' + src), { name: 'LoadError' }));
    document.head.appendChild(s);
  });
}
