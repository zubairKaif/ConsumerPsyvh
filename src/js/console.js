/* Researcher console (the default page): start a session, preview a screen, check baskets,
 * read the Tobii workflow, and download sessions saved in this browser. */
'use strict';

function savedSessions() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!/^quikkart_/.test(key)) continue;
      try {
        const s = JSON.parse(localStorage.getItem(key));
        if (s && Array.isArray(s.rows)) out.push(Object.assign({ key }, s));
      } catch (e) { /* not ours */ }
    }
  } catch (e) { /* storage blocked */ }
  return out.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
}

function basketTable() {
  const rows = TRIAL_IDS.map((id) => {
    const t = TRIALS[id], p = priceCart(initialCart(id));
    const recall = id === 'P0' ? 'A and B' : LISTS.A.includes(id) ? 'A' : 'B';
    const fee = (v) => (v ? rupees(v) : '<span class="muted">0</span>');
    return `<tr><td><b>${id}</b>${t.practice ? ' <span class="tag">practice</span>' : ''}</td><td>${t.basket}</td>` +
      `<td class="items">${t.items.map((k) => PRODUCTS[k].name).join(', ')}</td>` +
      `<td class="num">${rupees(p.B)}</td><td class="num">${fee(p.delivery)}</td><td class="num">${fee(p.smallCart)}</td>` +
      `<td class="num">${rupees(p.handling)}</td><td class="num">${rupees(p.platform)}</td><td class="num"><b>${rupees(p.F)}</b></td>` +
      `<td class="num"><b>${rupees(p.T)}</b></td><td class="num">${p.B < FEES.deliveryFreeAbove ? rupees(FEES.deliveryFreeAbove - p.B) : '–'}</td>` +
      `<td>${recall}</td></tr>`;
  }).join('');
  return `<table class="bt"><thead><tr><th>Trial</th><th>Basket</th><th>Items</th><th class="num">B</th><th class="num">Delivery</th>` +
    `<th class="num">Small cart</th><th class="num">Handling</th><th class="num">Platform</th><th class="num">F</th><th class="num">T</th>` +
    `<th class="num">Nudge</th><th>Recall in list</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const opt = (v, label, sel) => `<option value="${v}"${v === sel ? ' selected' : ''}>${label || v}</option>`;

function startConsole() {
  document.title = 'QuikKart · Researcher console';
  const file = location.protocol === 'file:';
  const root = Phone.showOverlay(`<div class="con">
  <header class="con-head"><div class="run-brand">QuikKart</div><div><h1>Researcher console</h1>
    <p>SOM 749 · fees shown late (arm A, drip) versus upfront (arm B). The bill is identical in both arms.</p></div></header>
  <div class="con-grid">
    <section class="con-card" id="run">
      <h2>Run a full session</h2>
      <form class="con-form" autocomplete="off">
        <label>Participant ID<input name="pid" placeholder="P001" required></label>
        <div class="con-row">
          <label>Arm<select name="arm">${opt('auto', 'Auto from ID')}${opt('A', 'A · drip')}${opt('B', 'B · upfront')}</select></label>
          <label>Probe list<select name="list">${opt('auto', 'Auto from ID')}${opt('A')}${opt('B')}</select></label>
        </div>
        <p class="con-hint" data-assign>Odd numbers get arm A, even numbers arm B; lists alternate A, B within each arm.</p>
        <label>Eye tracking<select name="et">${opt('webcam', 'Webcam (laptop camera, WebGazer)')}${opt('none', 'None: camera off (Tobii records separately)')}${opt('mouse', 'Mouse simulation (testing)')}</select></label>
        <p class="con-hint" data-et-hint></p>
        <div class="con-cam" data-cam>
          <button type="button" class="con-btn" data-cam-test>Test camera</button>
          <button type="button" class="con-btn" data-cam-stop hidden>Stop camera</button>
          <div class="con-cam-out" data-cam-out hidden><video data-cam-video autoplay muted playsinline></video><ul class="con-checks" data-cam-checks></ul></div>
        </div>
        <div class="con-row">
          <label>Screen width (cm)<input name="cm" type="number" step="0.1" min="10" max="200" value="34.5"></label>
          <label>Viewing distance (cm)<input name="dist" type="number" step="1" min="20" max="200" value="60"></label>
        </div>
        <label class="con-check"><input type="checkbox" name="dot"> Show the gaze dot and AOI highlight (demo only, never with participants)</label>
        <div class="con-warn">Webcam tracking error is 2–4° against about 0.5° for the Tobii. It cannot separate individual fee lines, so analyse the coarse groups (FEES, TOTAL, BASE, SAVINGS, NUDGE, BUTTONS).</div>
        ${file ? '<p class="con-hint con-file" data-file-hint>Opened as a file: webcam mode downloads WebGazer (about 12 MB) from the internet. Start the app with the start script instead: it uses the webcam folder and works offline.</p>' : ''}
        <div class="con-order" data-order></div>
        <p class="con-hint con-exists" data-exists hidden></p>
        <button class="run-btn" type="submit">Start session</button>
      </form>
    </section>
    <section class="con-card" id="preview">
      <h2>Preview one screen</h2>
      <form class="con-form" data-preview>
        <div class="con-row">
          <label>Arm<select name="arm">${opt('A', 'A · drip')}${opt('B', 'B · upfront')}</select></label>
          <label>Trial<select name="trial">${TRIAL_IDS.map((t) => opt(t, t, 'S1')).join('')}</select></label>
          <label>Screen<select name="screen">${VIEW_SCREENS.map((s) => opt(s)).join('')}</select></label>
        </div>
        <label class="con-check"><input type="checkbox" name="aoi"> Draw AOI boxes (pink; dashed blue = click zone)</label>
        <button class="run-btn" type="submit">Open preview</button>
        <p class="con-hint">Opens in a new tab. The forward buttons work, so you can click through to the bill and the edit screen.
          Also: <a href="?mode=fix" target="_blank">fixation cross</a> · <a href="?mode=blank" target="_blank">blank mask</a></p>
      </form>
      <h2 class="con-h2b">Saved sessions in this browser</h2>
      <div data-saved></div>
    </section>
  </div>
  <section class="con-card">
    <h2>Baskets and fees</h2>
    <p class="con-hint">Delivery ${rupees(FEES.delivery)} below ${rupees(FEES.deliveryFreeAbove)}; small cart fee ${rupees(FEES.smallCart)} below ${rupees(FEES.smallCartBelow)};
      handling ${rupees(FEES.handling)} and platform ${rupees(FEES.platform)} on every order. F = all fees, T = B + F. Nudge = amount still needed for free delivery.</p>
    <div class="bt-wrap">${basketTable()}</div>
  </section>
  <section class="con-card con-tobii">
    <h2>Tobii Pro Lab (desktop, image stimuli)</h2>
    <ol>
      <li>Set the stimulus display to <b>1920 × 1080</b> and add the images from <code>stimuli_png/</code> (made by <code>npm run render</code>; also in the pack). They are full-screen at 1920 × 1080, so AOI pixels map one to one.</li>
      <li>Build one timeline per participant from <code>trial_orders_P001-P080.csv</code>: P0 first, then order_1 … order_8. Each trial is
        <code>fixation.png</code> (800 ms) → <code>{arm}_{trial}_1_listing.png</code> → <code>_2_cart.png</code> → <code>_3_bill.png</code> → <code>blank_mask.png</code> (500 ms).
        End the listing, cart and bill images on a mouse click.</li>
      <li>Draw rectangle AOIs from <code>AOI_coordinates.csv</code> (x, y, w, h in image pixels; <code>aoi_preview/</code> shows them).
        Bill images are pixel-identical across arms, so one set of bill AOIs serves both.</li>
      <li>Code the bill decision from the mouse-click position: the BTN_ORDER, BTN_ADD and BTN_EXIT rows have click_zone = 1.</li>
      <li>Static images cannot show the editing phase or the probes. For those, run this app in run mode with eye tracking set to None,
        in Chrome full screen (F11) at 1920 × 1080, and record it with a Pro Lab screen recording. First-pass screens then sit at the same
        pixels as the images, and the URL hash (<code>#order-trial-screen</code>) plus the behaviour CSV give the screen times.</li>
    </ol>
  </section>
</div>`, 'ov-page ov-console');

  /* ---- run form ---- */
  const form = root.querySelector('#run form');
  const resolve = () => {
    const pid = form.pid.value.trim(), auto = assignment(pid);
    const arm = form.arm.value === 'auto' ? (auto && auto.arm) : form.arm.value;
    const list = form.list.value === 'auto' ? (auto && auto.list) : form.list.value;
    return { pid, auto, arm, list };
  };
  const ET_HINT = {
    webcam: 'The camera turns on when the participant clicks Start camera. Test it here first.',
    none: 'The app does not use the camera in this mode.',
    mouse: 'The mouse position is logged as if it were gaze, to test the pipeline. The camera stays off.',
  };
  const refresh = () => {
    const r = resolve();
    root.querySelector('[data-et-hint]').textContent = ET_HINT[form.et.value];
    root.querySelector('[data-cam]').hidden = form.et.value !== 'webcam';
    const fileHint = root.querySelector('[data-file-hint]');
    if (fileHint) fileHint.hidden = form.et.value !== 'webcam';
    const hint = root.querySelector('[data-assign]'), order = root.querySelector('[data-order]'), exists = root.querySelector('[data-exists]');
    if (r.pid && r.auto) hint.textContent = `${normPid(r.pid)} is participant ${participantNumber(r.pid)}: arm ${r.auto.arm}, list ${r.auto.list}.`;
    else if (r.pid) hint.textContent = 'This ID has no number, so choose the arm and list yourself.';
    order.innerHTML = r.pid && r.arm && r.list
      ? `<b>Order</b> ${['P0'].concat(trialOrder(r.pid, r.arm, r.list)).map((t) => `<span class="${probeType(t, r.list)}">${t}</span>`).join('')}` +
        '<span class="con-key"><i class="recall"></i>recall <i class="filler"></i>filler</span>'
      : '';
    const prev = r.pid && savedSessions().find((s) => s.pid === r.pid);
    exists.hidden = !prev;
    if (prev) exists.textContent = `A session for ${r.pid} is already saved here (${prev.rows.length} trial${prev.rows.length === 1 ? '' : 's'}). Starting again will overwrite it, so download it first.`;
  };
  form.addEventListener('input', refresh);
  wireCameraTest(root.querySelector('[data-cam]'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = resolve();
    if (!r.pid) return form.pid.focus();
    if (!r.arm || !r.list) { root.querySelector('[data-assign]').textContent = 'Choose the arm and list: this ID has no number to assign them from.'; return; }
    const q = new URLSearchParams({ mode: 'run', pid: r.pid, arm: r.arm, list: r.list, et: form.et.value, cm: form.cm.value, dist: form.dist.value });
    if (form.dot.checked) q.set('dot', '1');
    location.href = '?' + q.toString();
  });
  refresh();

  /* ---- preview form ---- */
  const pv = root.querySelector('[data-preview]');
  pv.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams({ mode: 'view', arm: pv.arm.value, trial: pv.trial.value, screen: pv.screen.value });
    if (pv.aoi.checked) q.set('aoi', '1');
    window.open('?' + q.toString(), '_blank');
  });

  /* ---- saved sessions ---- */
  const savedBox = root.querySelector('[data-saved]');
  const renderSaved = () => {
    const list = savedSessions();
    if (!list.length) { savedBox.innerHTML = '<p class="con-hint">None yet. Run mode saves the behaviour data here after every trial (gaze data is downloaded at the end of the session).</p>'; return; }
    savedBox.innerHTML = `<table class="ss"><tbody>${list.map((s) => `<tr>
      <td><b>${esc(s.pid)}</b><div class="muted">arm ${esc(s.arm)} · list ${esc(s.list)} · ${esc(s.et)}</div></td>
      <td>${s.rows.length} of 9 trials${s.complete ? '' : ' <span class="tag tag-warn">incomplete</span>'}<div class="muted">${esc(String(s.updated || '').replace('T', ' ').slice(0, 16))} UTC</div></td>
      <td class="ss-btns"><button class="con-btn" data-dl="${esc(s.key)}">Behaviour CSV</button>
      <button class="con-btn con-del" data-del="${esc(s.key)}">Delete</button></td></tr>`).join('')}</tbody></table>
      <button class="con-btn" data-all>Download all behaviour data (one CSV)</button>`;
  };
  savedBox.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const list = savedSessions();
    if (b.dataset.dl) {
      const s = list.find((x) => x.key === b.dataset.dl);
      downloadText(`QuikKart_${s.pid}_behaviour.csv`, toCSV(BEHAVIOUR_COLUMNS, s.rows));
    } else if (b.dataset.del) {
      if (!window.confirm('Delete the saved data for ' + b.dataset.del.replace(/^quikkart_/, '') + '? This cannot be undone.')) return;
      try { localStorage.removeItem(b.dataset.del); } catch (err) { /* ignore */ }
      renderSaved(); refresh();
    } else if (b.hasAttribute('data-all')) {
      downloadText('QuikKart_all_behaviour.csv', toCSV(BEHAVIOUR_COLUMNS, list.flatMap((s) => s.rows)));
    }
  });
  renderSaved();
}

/** Console "Test camera": camera (live preview), WebGazer library and face-model files, each with a fix. */
function wireCameraTest(box) {
  const out = box.querySelector('[data-cam-out]'), list = box.querySelector('[data-cam-checks]');
  const video = box.querySelector('[data-cam-video]'), stopBtn = box.querySelector('[data-cam-stop]');
  const file = location.protocol === 'file:', base = wgBase();
  const where = base === WG_CDN ? 'cdn.jsdelivr.net' : 'the webcam folder';
  const offline = file
    ? 'Could not download it from cdn.jsdelivr.net (no internet, or the network blocks it). Start the app with the start script instead: it uses the webcam folder and works offline.'
    : 'Keep the webcam folder next to QuikKart_Stimulus_App.html (unzip the whole pack).';
  let stream = null;
  const stop = () => { stopStream(stream); stream = null; video.srcObject = null; stopBtn.hidden = true; };
  stopBtn.addEventListener('click', () => { stop(); out.hidden = true; });
  box.querySelector('[data-cam-test]').addEventListener('click', async () => {
    stop();
    out.hidden = false;
    const rows = [];
    const paint = () => { list.innerHTML = rows.map(([state, title, detail]) => `<li class="ck ck-${state}"><b>${esc(title)}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</li>`).join(''); };
    rows[0] = ['wait', 'Camera', 'Asking for permission…'];
    paint();
    try {
      stream = await requestCamera();
      video.srcObject = stream;
      video.hidden = false;
      stopBtn.hidden = false;
      const track = stream.getVideoTracks()[0], set = track.getSettings ? track.getSettings() : {};
      rows[0] = ['ok', 'Camera works', [track.label, set.width && `${set.width} x ${set.height}`].filter(Boolean).join(' · ')];
    } catch (err) {
      video.hidden = true;
      const h = cameraHelp(err);
      rows[0] = ['bad', h.title, h.fix];
    }
    rows[1] = ['wait', 'Eye-tracking library', 'Loading WebGazer from ' + where + '…'];
    paint();
    try {
      if (!window.webgazer) await withTimeout(loadScript(base + '/webgazer.js'), LOAD_TIMEOUT_MS, 'timed out');
      rows[1] = ['ok', 'Eye-tracking library', 'WebGazer loaded from ' + where + '.'];
    } catch (err) {
      rows[1] = ['bad', 'WebGazer could not be loaded', offline];
    }
    rows[2] = ['wait', 'Face model', 'Checking the MediaPipe files…'];
    paint();
    try {
      const res = await withTimeout(fetch(base + '/mediapipe/face_mesh/face_mesh.binarypb', { cache: 'no-store' }), LOAD_TIMEOUT_MS, 'timed out');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows[2] = ['ok', 'Face model', 'MediaPipe face-mesh files are reachable in ' + where + '.'];
    } catch (err) {
      rows[2] = ['bad', 'The face-model files could not be reached', offline];
    }
    paint();
  });
}
