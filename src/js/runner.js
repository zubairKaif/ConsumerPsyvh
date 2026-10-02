/* Run mode: one participant's full session.
 * [tracker setup] -> welcome -> P0 + 8 test trials (seeded order) -> end screen with CSV downloads.
 * Each trial: fixation 800 ms -> listing -> cart -> bill [-> edit -> bill ...] -> blank 500 ms -> probe. */
'use strict';

const FIX_MS = 800, BLANK_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(performance.now())));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  try { el.requestFullscreen().catch(() => {}); } catch (e) { /* not allowed here; carry on windowed */ }
}

/** Shows a full-screen page and resolves with the value its submit handler returns. */
function page(html, wire, cls) {
  return new Promise((resolve) => {
    const root = Phone.showOverlay(html, cls || 'ov-run');
    wire(root, resolve);
  });
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const storeKey = (pid) => 'quikkart_' + pid;

function saveLocal(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}

function startRun() {
  const pid = (PARAMS.get('pid') || '').trim();
  if (!pid) return paramError('pid is missing, for example ?mode=run&amp;pid=P001.');
  const auto = assignment(pid);
  const arm = (PARAMS.get('arm') || (auto ? auto.arm : '')).toUpperCase();
  const list = (PARAMS.get('list') || (auto ? auto.list : '')).toUpperCase();
  const et = (PARAMS.get('et') || 'none').toLowerCase();
  if (!['A', 'B'].includes(arm)) return paramError('arm must be A or B (it is set automatically only when the pid ends in a number).');
  if (!['A', 'B'].includes(list)) return paramError('list must be A or B.');
  if (!['none', 'webcam', 'mouse'].includes(et)) return paramError('et must be none, webcam or mouse.');
  const cfg = {
    pid, arm, list, et,
    cm: parseFloat(PARAMS.get('cm')) || 34.5,
    dist: parseFloat(PARAMS.get('dist')) || 60,
    dot: PARAMS.get('dot') === '1',
  };
  document.title = 'QuikKart';
  new Session(cfg).run().catch((err) => {
    console.error(err);
    Phone.showOverlay(`<div class="card-page"><h1>Something went wrong</h1><p>${esc(err && err.message || err)}</p>` +
      '<p>The data collected so far is saved in this browser; download it from the researcher console.</p></div>', 'ov-page');
  });
}

class Session {
  constructor(cfg) {
    Object.assign(this, cfg);
    this.order = ['P0'].concat(trialOrder(cfg.pid, cfg.arm, cfg.list));
    this.rows = [];
    this.started = new Date().toISOString();
    this.done = false;
    this.tracker = Tracker.create(cfg);
    window.addEventListener('beforeunload', (e) => {
      if (this.rows.length && !this.done) { e.preventDefault(); e.returnValue = ''; }
    });
    window.QKSession = this; // handle for the researcher and tests
  }

  async run() {
    if (this.et !== 'none') await this.tracker.setup();
    await this.welcome();
    for (let i = 0; i < this.order.length; i++) {
      if (i === 5 && this.et === 'webcam') await this.tracker.midCheck();
      this.rows.push(await this.trial(this.order[i], i));
      this.autosave();
      if (i === 0) await this.practiceDone();
    }
    this.done = true;
    this.autosave();
    await this.end();
  }

  /* ---------- pages outside the phone ---------- */

  welcome() {
    setHash(0, 'none', 'welcome');
    return page(`<div class="run-card">
      <div class="run-brand">QuikKart</div>
      <h1>Welcome</h1>
      <p>We are testing the usability of a new grocery delivery app. You will see ${this.order.length} short orders on a phone screen.
      For each order, look through the screens as you normally would, then decide at the bill: place the order, add more items or leave checkout.</p>
      <p>After each order we will ask you one short question. Use the mouse to click the buttons on the phone.</p>
      <p class="run-note">The first order is a practice.</p>
      <button class="run-btn" data-go>Start the practice order</button></div>`,
    (root, done) => root.querySelector('[data-go]').addEventListener('click', () => { goFullscreen(); done(); }));
  }

  practiceDone() {
    setHash(0, 'none', 'practicedone');
    return page(`<div class="run-card"><h1>Practice done</h1>
      <p>Now the ${this.order.length - 1} real orders start. They work the same way as the practice.</p>
      <button class="run-btn" data-go>Start</button></div>`,
    (root, done) => root.querySelector('[data-go]').addEventListener('click', () => done()));
  }

  end() {
    setHash(this.order.length, 'none', 'end');
    const gaze = this.tracker.hasGaze();
    const saved = this.savedOK ? `Behaviour data is also saved in this browser as <b>${esc(storeKey(this.pid))}</b>.` :
      'Saving in this browser failed, so download the files now.';
    return page(`<div class="run-card"><h1>Thank you!</h1><p>You have finished. Please let the researcher know.</p>
      <div class="run-res"><div class="run-res-k">Researcher</div>
        <div class="run-res-btns"><button class="run-btn" data-dl="beh">Download behaviour CSV</button>
        ${gaze ? '<button class="run-btn" data-dl="gaze">Download gaze CSV</button>' : ''}</div>
        <p>${saved}</p></div></div>`,
    (root) => {
      root.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.dl === 'beh') downloadText(`QuikKart_${this.pid}_behaviour.csv`, this.behaviourCSV());
        else downloadText(`QuikKart_${this.pid}_gaze.csv`, this.tracker.gazeCSV());
      }));
    });
  }

  /* ---------- one trial ---------- */

  async trial(trialId, order) {
    const t = TRIALS[trialId];
    const p0 = priceCart(initialCart(trialId));
    const row = {};
    for (const c of BEHAVIOUR_COLUMNS) row[c] = '';
    Object.assign(row, {
      pid: this.pid, arm: this.arm, list: this.list, trial_id: trialId, trial_order: order, basket: t.basket,
      B: p0.B, F: p0.F, T: p0.T, edit_rounds: 0, edit_ms: 0, rebill_ms: 0, edit_clicks: 0,
      et_mode: this.et, trial_start_iso: new Date().toISOString(),
    });

    setHash(order, trialId, 'fix');
    Phone.showOverlay('<div class="fix-cross"></div>', 'ov-fix');
    await sleep(FIX_MS);

    this.tracker.beginTrial(trialId, order);
    const result = await this.checkout(trialId, order, row);
    this.tracker.endScreens();

    const p1 = priceCart(result.cart);
    Object.assign(row, {
      final_decision: result.decision, final_B: p1.B, final_F: p1.F, final_T: p1.T,
      added_value: p1.B - p0.B, fee_change: p1.F - p0.F,
      free_delivery_unlocked: p0.delivery > 0 && p1.delivery === 0 ? 1 : 0,
      small_cart_fee_removed: p0.smallCart > 0 && p1.smallCart === 0 ? 1 : 0,
      cart_changes: cartChanges(initialCart(trialId), result.cart, editKeys(trialId)),
    });
    if (this.et !== 'none') {
      Object.assign(row, this.tracker.billSummary());
      row.wc_cal_acc_deg = this.tracker.calAccDeg();
    }

    setHash(order, trialId, 'blank');
    Phone.showOverlay('', 'ov-blank');
    await sleep(BLANK_MS);

    Object.assign(row, await this.probe(trialId, order, p1.T));
    return row;
  }

  /** Runs listing -> cart -> bill (-> edit -> bill)* and fills the timing and decision columns. */
  checkout(trialId, order, row) {
    return new Promise((resolve) => {
      let cur = null;
      const close = () => {
        if (!cur) return;
        const ms = Math.round(performance.now() - cur.onset);
        if (cur.label === 'listing') row.listing_ms = ms;
        else if (cur.label === 'cart') row.cart_ms = ms;
        else if (cur.label === 'bill') row.bill_ms = ms;
        else if (cur.label.startsWith('edit')) row.edit_ms += ms;
        else row.rebill_ms += ms;
        cur = null;
      };
      TrialFlow({
        arm: this.arm, trialId, start: 'listing',
        hooks: {
          screen: (label) => {
            close();
            cur = { label, onset: performance.now(), painted: null };
            const c = cur;
            nextFrame().then((t) => { c.painted = t; });
            if (label.startsWith('edit')) row.edit_rounds++;
            setHash(order, trialId, label);
            this.tracker.screen(label);
          },
          refresh: () => this.tracker.refresh(),
          editClick: () => { row.edit_clicks++; },
          decision: (choice, label, ev) => {
            if (label !== 'bill') return;
            row.decision = choice;
            const from = cur.painted !== null ? cur.painted : cur.onset;
            row.dec_rt_ms = Math.max(0, Math.round((ev && ev.timeStamp ? ev.timeStamp : performance.now()) - from));
          },
          done: (res) => { close(); resolve(res); },
        },
      }).start();
    });
  }

  /* ---------- probes ---------- */

  async probe(trialId, order, finalT) {
    const type = probeType(trialId, this.list);
    const head = order === 0 ? 'Practice order' : `Order ${order} of ${this.order.length - 1}`;
    const onset = performance.now();
    if (type === 'recall') {
      setHash(order, trialId, 'probe');
      const amount = await this.askNumber(head, RECALL_QUESTION);
      const rt = (performance.now() - onset) / 1000;
      setHash(order, trialId, 'conf');
      const conf = await this.askConfidence(head);
      return { probe_type: 'recall', probe_question: RECALL_QUESTION, recall_T: amount, recall_ref_T: finalT, conf, probe_rt_s: rt.toFixed(2) };
    }
    const [q, answer] = TRIALS[trialId].filler;
    setHash(order, trialId, 'probe');
    const typed = await this.askText(head, q);
    return { probe_type: 'filler', probe_question: q, filler_answer: typed, filler_correct_answer: answer,
      probe_rt_s: ((performance.now() - onset) / 1000).toFixed(2) };
  }

  askNumber(head, question) {
    return page(`<form class="run-card probe" autocomplete="off"><div class="run-kicker">${head}</div><h2>${esc(question)}</h2>
      <label class="probe-num"><span>₹</span><input name="v" inputmode="numeric" maxlength="7" aria-label="Amount in rupees"></label>
      <button class="run-btn" disabled>Next</button></form>`,
    (root, done) => {
      const form = root.querySelector('form'), input = form.v, btn = form.querySelector('button');
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); btn.disabled = input.value === ''; });
      form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value !== '') done(Number(input.value)); });
      input.focus();
    });
  }

  askText(head, question) {
    return page(`<form class="run-card probe" autocomplete="off"><div class="run-kicker">${head}</div><h2>${esc(question)}</h2>
      <input class="probe-text" name="v" maxlength="60" aria-label="Your answer">
      <button class="run-btn" disabled>Next</button></form>`,
    (root, done) => {
      const form = root.querySelector('form'), input = form.v, btn = form.querySelector('button');
      input.addEventListener('input', () => { btn.disabled = input.value.trim() === ''; });
      form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value.trim()) done(input.value.trim()); });
      input.focus();
    });
  }

  askConfidence(head) {
    const opts = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="conf-opt" data-v="${n}">${n}</button>`).join('');
    return page(`<form class="run-card probe"><div class="run-kicker">${head}</div><h2>${CONF_QUESTION}</h2>
      <div class="conf"><div class="conf-row">${opts}</div><div class="conf-labels"><span>${CONF_LABELS[0]}</span><span>${CONF_LABELS[1]}</span></div></div>
      <button class="run-btn" disabled>Next</button></form>`,
    (root, done) => {
      const form = root.querySelector('form'), btn = form.querySelector('.run-btn');
      let v = null;
      form.querySelectorAll('.conf-opt').forEach((b) => b.addEventListener('click', () => {
        v = Number(b.dataset.v);
        form.querySelectorAll('.conf-opt').forEach((o) => o.classList.toggle('is-on', o === b));
        btn.disabled = false;
      }));
      form.addEventListener('submit', (e) => { e.preventDefault(); if (v) done(v); });
    });
  }

  /* ---------- data ---------- */

  behaviourCSV() { return toCSV(BEHAVIOUR_COLUMNS, this.rows); }

  autosave() {
    this.savedOK = saveLocal(storeKey(this.pid), JSON.stringify({
      pid: this.pid, arm: this.arm, list: this.list, et: this.et, started: this.started,
      updated: new Date().toISOString(), complete: this.done, columns: BEHAVIOUR_COLUMNS, rows: this.rows,
    }));
    if (this.done && this.tracker.hasGaze()) saveLocal(storeKey(this.pid) + '_gaze', this.tracker.gazeCSV());
  }
}
