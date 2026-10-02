/* The stage, the scaled device frame, full-screen overlays, AOI export and the URL hash. */
'use strict';

const DEVICE_W = 432, DEVICE_H = 935;

const Phone = (() => {
  let stage, device, app, overlay, aoiLayer, hilite;
  let handler = null, showAOIs = false;
  const resizeHooks = [];

  function mount() {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="stage" hidden><div id="device"><div id="screen"><div id="app"></div><div class="punch"></div><div class="pill"></div></div></div></div>' +
      '<div id="aoi-layer"></div><div id="hilite" hidden></div><div id="overlay" hidden></div>');
    stage = document.getElementById('stage');
    device = document.getElementById('device');
    app = document.getElementById('app');
    overlay = document.getElementById('overlay');
    aoiLayer = document.getElementById('aoi-layer');
    hilite = document.getElementById('hilite');
    app.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.classList.contains('is-off') || !handler) return;
      handler(el.dataset.act, el, e);
    });
    window.addEventListener('resize', () => {
      fit();
      if (showAOIs) drawAOIs();
      resizeHooks.forEach((f) => f());
    });
    fit();
  }

  /** scale = min((innerHeight − 40)/935, (innerWidth − 40)/432), device centred on the stage. */
  function fit() {
    const s = Math.min((window.innerHeight - 40) / DEVICE_H, (window.innerWidth - 40) / DEVICE_W);
    const left = Math.round((window.innerWidth - DEVICE_W * s) / 2);
    const top = Math.round((window.innerHeight - DEVICE_H * s) / 2);
    device.style.transform = `translate(${left}px, ${top}px) scale(${s})`;
  }

  /** Puts a screen into the phone and routes its data-act clicks to onAction(act, el, event). */
  function show(html, onAction) {
    overlay.hidden = true;
    overlay.innerHTML = '';
    stage.hidden = false;
    app.innerHTML = html;
    handler = onAction || null;
    if (showAOIs) drawAOIs();
  }

  /** Re-renders the current screen in place (edit-screen steppers) without treating it as a new screen. */
  function update(html) {
    app.innerHTML = html;
    if (showAOIs) drawAOIs();
  }

  /** Full-viewport page outside the phone (welcome, probes, fixation, calibration ...). */
  function showOverlay(html, cls) {
    stage.hidden = true;
    handler = null;
    app.innerHTML = '';
    aoiLayer.innerHTML = '';
    hilite.hidden = true;
    overlay.className = cls || '';
    overlay.innerHTML = html;
    overlay.hidden = false;
    return overlay;
  }

  const r1 = (v) => Math.round(v * 10) / 10;

  /** Every AOI on the current phone screen, in viewport pixels. */
  function getAOIs() {
    if (stage.hidden) return [];
    return Array.from(app.querySelectorAll('[data-aoi]')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        aoi: el.dataset.aoi, x: r1(r.left), y: r1(r.top), w: r1(r.width), h: r1(r.height),
        fee: el.dataset.fee !== undefined ? Number(el.dataset.fee) : null,
        click_zone: el.dataset.click === '1',
      };
    }).filter((a) => a.w > 0 && a.h > 0);
  }

  /** The whole device (bezel included), in viewport pixels: "inside the phone" for gaze coding. */
  function phoneRect() {
    const r = device.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function drawAOIs() {
    aoiLayer.innerHTML = getAOIs().map((a) =>
      `<div class="aoi-box${a.click_zone ? ' aoi-click' : ''}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px">` +
      `<span>${a.aoi}${a.fee !== null ? ' ₹' + a.fee : ''}</span></div>`).join('');
  }

  /** Redraws the AOI overlay (after web fonts finish loading the layout can shift slightly). */
  function redraw() { if (showAOIs) drawAOIs(); }

  function setAOIOverlay(on) {
    showAOIs = !!on;
    if (showAOIs) drawAOIs(); else aoiLayer.innerHTML = '';
  }

  /** Amber outline on the AOI currently hit by gaze (demo only, dot=1). */
  function highlight(rect) {
    if (!rect) { hilite.hidden = true; return; }
    hilite.hidden = false;
    hilite.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
  }

  return { mount, fit, show, update, showOverlay, getAOIs, phoneRect, drawAOIs, redraw, setAOIOverlay, highlight,
    onResize: (f) => resizeHooks.push(f) };
})();

/** #{order}-{trial}-{screen}, replacing the history entry so Back does not step through screens. */
function setHash(order, trial, screen) {
  const h = '#' + [order, trial, screen].join('-');
  if (location.hash !== h) location.replace(h);
}

/* ---------- small helpers shared by the runner and the tracker ---------- */
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
