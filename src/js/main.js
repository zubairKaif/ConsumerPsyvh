/* Entry point: reads ?mode= and starts the console, a one-screen preview, a full session,
 * or the fixation/blank images. */
'use strict';

const PARAMS = new URLSearchParams(location.search);
const MODE = (PARAMS.get('mode') || '').toLowerCase();
const VIEW_SCREENS = ['listing', 'cart', 'bill', 'edit'];

window.getAOIs = () => Phone.getAOIs();
window.trialOrder = (pid, arm, list) => trialOrder(pid, arm, list);
window.QK = Object.assign({ productArt }, QKCore);

/** Resolves once every Roboto face (latin and latin-ext, 400/500/700) is loaded. */
function fontsReady() {
  const loads = [400, 500, 700].map((w) => document.fonts.load(`${w} 16px Roboto`, 'Aa₹'));
  return Promise.all(loads).then(() => document.fonts.ready).catch(() => {});
}

/** data-ready="1" on <html> once fonts are in and the first screen has painted (used by the renderer). */
function markReady() {
  fontsReady().then(() => {
    Phone.redraw();
    requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.ready = '1'; }));
  });
}

function paramError(msg) {
  Phone.showOverlay(`<div class="card-page"><h1>Check the address</h1><p>${msg}</p><p><a href="?">Open the researcher console</a></p></div>`, 'ov-page');
}

function startView() {
  const arm = (PARAMS.get('arm') || 'A').toUpperCase();
  const trialId = (PARAMS.get('trial') || 'S1').toUpperCase();
  const screen = (PARAMS.get('screen') || 'listing').toLowerCase();
  if (!['A', 'B'].includes(arm)) return paramError('arm must be A or B.');
  if (!TRIALS[trialId]) return paramError('trial must be one of ' + TRIAL_IDS.join(', ') + '.');
  if (!VIEW_SCREENS.includes(screen)) return paramError('screen must be one of ' + VIEW_SCREENS.join(', ') + '.');
  document.title = `QuikKart ${arm} ${trialId} ${screen}`;
  Phone.setAOIOverlay(PARAMS.get('aoi') === '1');
  TrialFlow({
    arm, trialId, start: screen,
    hooks: {
      screen: (label) => setHash(0, trialId, label),
      done: (res) => {
        setHash(0, trialId, 'end');
        Phone.show(previewEndScreen(res.decision), (act) => { if (act === 'restart') location.reload(); });
      },
    },
  }).start();
}

function main() {
  document.body.className = 'mode-' + (MODE || 'console');
  Phone.mount();
  if (MODE === 'view') startView();
  else if (MODE === 'run') startRun();
  else if (MODE === 'fix') Phone.showOverlay('<div class="fix-cross"></div>', 'ov-fix');
  else if (MODE === 'blank') Phone.showOverlay('', 'ov-blank');
  else startConsole();
  markReady();
}

main();
