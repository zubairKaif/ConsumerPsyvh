/* QuikKart core: experiment data, fee maths, trial ordering and CSV helpers.
 * Pure functions only (no DOM). The build inlines this file into the app, and the
 * Node scripts require() it, so the app and the CSV generators share one source. */
'use strict';

const FEES = { handling: 11, platform: 5, delivery: 30, deliveryFreeAbove: 199, smallCart: 20, smallCartBelow: 149 };

const PRODUCTS = {
  milk:    { name: 'Toned milk', size: '500 ml', price: 32, mrp: 34, shape: 'carton', c: '#3D7BD9', bg: '#E7F0FC' },
  bread:   { name: 'White sandwich bread', size: '400 g', price: 45, mrp: 50, shape: 'bag', c: '#C98B3C', bg: '#FBF0E1' },
  eggs:    { name: 'Farm fresh eggs', size: '6 pieces', price: 41, mrp: 45, shape: 'eggs', c: '#F3E6CF', bg: '#F7F1E6' },
  noodles: { name: 'Masala instant noodles', size: '4 x 70 g', price: 56, mrp: 60, shape: 'bag', c: '#E9B824', bg: '#FCF5DA' },
  curd:    { name: 'Fresh curd', size: '400 g', price: 40, mrp: 42, shape: 'tub', c: '#6FA8DC', bg: '#EAF2FA' },
  banana:  { name: 'Robusta bananas', size: '6 pieces', price: 30, mrp: 36, shape: 'bunch', c: '#E8C42E', bg: '#FBF6DC' },
  cola:    { name: 'Cola soft drink', size: '750 ml', price: 40, mrp: 40, shape: 'bottle', c: '#C8312F', bg: '#FBE7E6' },
  chips:   { name: 'Salted potato chips', size: '52 g', price: 20, mrp: 20, shape: 'bag', c: '#3FA45B', bg: '#E5F4E9' },
  biscuit: { name: 'Chocolate cream biscuits', size: '120 g', price: 52, mrp: 55, shape: 'box', c: '#7A4A2A', bg: '#F3E9E1' },
  paneer:  { name: 'Fresh paneer', size: '200 g', price: 95, mrp: 99, shape: 'box', c: '#E8E2D2', bg: '#F5F2EA' },
  tomato:  { name: 'Hybrid tomatoes', size: '500 g', price: 42, mrp: 50, shape: 'round', c: '#DB3B2E', bg: '#FBE6E3' },
  atta:    { name: 'Whole wheat atta', size: '5 kg', price: 265, mrp: 299, shape: 'sack', c: '#D9822B', bg: '#FBEEDF' },
  dal:     { name: 'Toor dal', size: '1 kg', price: 172, mrp: 189, shape: 'bag', c: '#E2B03A', bg: '#FBF3DD' },
  deterg:  { name: 'Detergent powder', size: '2 kg', price: 249, mrp: 275, shape: 'sack', c: '#2F6BC9', bg: '#E5EEFA' },
  dish:    { name: 'Dishwash gel, lemon', size: '750 ml', price: 119, mrp: 135, shape: 'bottle', c: '#58A83A', bg: '#E8F4E2' },
  tissue:  { name: 'Facial tissues', size: '200 pulls', price: 94, mrp: 110, shape: 'box', c: '#7CB7E6', bg: '#EAF3FB' },
  rice:    { name: 'Basmati rice', size: '1 kg', price: 158, mrp: 180, shape: 'sack', c: '#C9B48A', bg: '#F6F1E6' },
  oil:     { name: 'Sunflower oil', size: '1 L', price: 186, mrp: 199, shape: 'bottle', c: '#E7B92C', bg: '#FBF4DC' },
  sugar:   { name: 'Refined sugar', size: '1 kg', price: 74, mrp: 80, shape: 'bag', c: '#B9C3CF', bg: '#EFF2F5' },
  shampoo: { name: 'Anti-dandruff shampoo', size: '340 ml', price: 299, mrp: 349, shape: 'bottle', c: '#6A4FB6', bg: '#EFEAF8' },
  paste:   { name: 'Toothpaste, pack of 2', size: '2 x 150 g', price: 172, mrp: 190, shape: 'tube', c: '#D63A3A', bg: '#FAE6E6' },
  water:   { name: 'Packaged drinking water', size: '1 L', price: 20, mrp: 22, shape: 'bottle', c: '#7FC3E8', bg: '#E8F4FB' },
  salt:    { name: 'Iodised salt', size: '1 kg', price: 28, mrp: 30, shape: 'bag', c: '#C7CED6', bg: '#F0F2F5' },
  // listing-only distractors
  butter:  { name: 'Salted butter', size: '100 g', price: 58, mrp: 60, shape: 'box', c: '#F0C93C', bg: '#FCF6DE' },
  juice:   { name: 'Orange juice', size: '1 L', price: 110, mrp: 125, shape: 'carton', c: '#F08A24', bg: '#FDEFE0' },
  onion:   { name: 'Onions', size: '1 kg', price: 45, mrp: 55, shape: 'round', c: '#B5536B', bg: '#F7E7EC' },
  potato:  { name: 'Potatoes', size: '1 kg', price: 38, mrp: 45, shape: 'round', c: '#B98A55', bg: '#F5EDE3' },
  tea:     { name: 'Green tea bags', size: '25 bags', price: 160, mrp: 175, shape: 'box', c: '#4E9A62', bg: '#E6F2E9' },
  oats:    { name: 'Rolled oats', size: '1 kg', price: 185, mrp: 199, shape: 'bag', c: '#B79A62', bg: '#F5EFE3' },
  ketchup: { name: 'Tomato ketchup', size: '500 g', price: 115, mrp: 125, shape: 'bottle', c: '#C2312B', bg: '#FAE5E4' },
  handwash:{ name: 'Liquid hand wash', size: '250 ml', price: 99, mrp: 110, shape: 'bottle', c: '#48A6A0', bg: '#E4F3F2' },
  floor:   { name: 'Floor cleaner', size: '1 L', price: 189, mrp: 210, shape: 'bottle', c: '#8A5BC4', bg: '#F0EAF8' },
  cookies: { name: 'Choco chip cookies', size: '150 g', price: 90, mrp: 95, shape: 'box', c: '#8B5A2B', bg: '#F3EBE2' },
  mango:   { name: 'Mango drink', size: '1 L', price: 80, mrp: 85, shape: 'carton', c: '#F2A428', bg: '#FDF1DE' },
  nuts:    { name: 'Roasted cashews', size: '100 g', price: 95, mrp: 110, shape: 'tub', c: '#C9A06A', bg: '#F6EFE4' },
  cheese:  { name: 'Cheese slices', size: '10 slices', price: 130, mrp: 140, shape: 'box', c: '#F3C74A', bg: '#FCF6DE' },
};

const TRIALS = {
  P0: { basket: 'Small', items: ['water', 'salt'], fill: ['butter', 'onion', 'potato', 'tea'], suggest: 'cookies', practice: true },
  S1: { basket: 'Small', items: ['milk', 'bread', 'eggs'], fill: ['butter', 'juice', 'cheese'], suggest: 'cookies',
        filler: ['How many eggs were in the cart?', '6'] },
  S2: { basket: 'Small', items: ['noodles', 'curd', 'banana'], fill: ['onion', 'potato', 'ketchup'], suggest: 'mango',
        filler: ['Which flavour of instant noodles was in the cart?', 'Masala'] },
  S3: { basket: 'Small', items: ['cola', 'chips', 'biscuit'], fill: ['juice', 'cookies', 'nuts'], suggest: 'nuts',
        filler: ['Which drink was in the cart?', 'Cola'] },
  S4: { basket: 'Small', items: ['paneer', 'tomato'], fill: ['onion', 'butter', 'potato', 'cheese'], suggest: 'butter',
        filler: ['How much paneer was in the cart?', '200 g'] },
  L1: { basket: 'Large', items: ['atta', 'dal'], fill: ['rice', 'oil', 'sugar', 'salt'], suggest: null,
        filler: ['Which dal was in the cart?', 'Toor dal'] },
  L2: { basket: 'Large', items: ['deterg', 'dish', 'tissue'], fill: ['handwash', 'floor', 'tea'], suggest: null,
        filler: ['How many products were in the cart?', '3'] },
  L3: { basket: 'Large', items: ['rice', 'oil', 'sugar'], fill: ['atta', 'dal', 'oats'], suggest: null,
        filler: ['Which rice was in the cart?', 'Basmati'] },
  L4: { basket: 'Large', items: ['shampoo', 'paste'], fill: ['handwash', 'tissue', 'floor', 'oats'], suggest: null,
        filler: ['How many toothpaste tubes were in the cart?', '2'] },
};
const LISTS = { A: ['S1', 'S3', 'L2', 'L4'], B: ['S2', 'S4', 'L1', 'L3'] };
const ORDER8 = ['S1', 'S2', 'S3', 'S4', 'L1', 'L2', 'L3', 'L4'];
const TRIAL_IDS = ['P0'].concat(ORDER8);

const RECALL_QUESTION = 'How much in total (₹) would you pay for this order, including everything?';
const CONF_QUESTION = 'How sure are you?';
const CONF_LABELS = ['Not at all sure', 'Completely sure'];
const NO_SUGGEST_FALLBACK = 'cookies';

/* ---------- carts and fees ---------- */

/** The cart a trial starts with: every trial item once, in trial order. */
function initialCart(trialId) {
  const cart = {};
  for (const key of TRIALS[trialId].items) cart[key] = 1;
  return cart;
}

/** Prices a cart ({productKey: qty}) with the fee rules of the brief (section 3). */
function priceCart(cart) {
  const items = [];
  let B = 0, mrpTotal = 0, count = 0;
  for (const key of Object.keys(cart)) {
    const qty = cart[key];
    if (!qty) continue;
    const p = PRODUCTS[key];
    if (!p) throw new Error('Unknown product: ' + key);
    items.push({ key, qty, price: p.price, mrp: p.mrp, line: p.price * qty, mrpLine: p.mrp * qty });
    B += p.price * qty;
    mrpTotal += p.mrp * qty;
    count += qty;
  }
  const delivery = B < FEES.deliveryFreeAbove ? FEES.delivery : 0;
  const smallCart = B < FEES.smallCartBelow ? FEES.smallCart : 0;
  const F = delivery + smallCart + FEES.handling + FEES.platform;
  return {
    items, count, B, mrpTotal, savings: mrpTotal - B,
    delivery, deliveryFree: delivery === 0, smallCart,
    handling: FEES.handling, platform: FEES.platform,
    F, T: B + F,
    toFreeDelivery: Math.max(0, FEES.deliveryFreeAbove - B),
  };
}

/** Product key suggested in the bill nudge and the edit list. */
function suggestKey(trialId) {
  return TRIALS[trialId].suggest || NO_SUGGEST_FALLBACK;
}

/** Edit-screen rows: trial items, then the suggested item, then fill items (no duplicates). */
function editKeys(trialId) {
  const t = TRIALS[trialId];
  const keys = [];
  for (const k of t.items.concat([suggestKey(trialId)], t.fill)) if (!keys.includes(k)) keys.push(k);
  return keys;
}

/** Listing grid: six tiles, cart items on a checkerboard so they are not all in one column.
 *  3 cart items occupy slots 0, 3, 4; 2 cart items occupy slots 0, 3. Fill items take the rest. */
const CART_SLOTS = [0, 3, 4, 1, 2, 5];
function listingTiles(trialId) {
  const t = TRIALS[trialId];
  const n = t.items.length + t.fill.length;
  const tiles = new Array(n);
  const used = CART_SLOTS.slice(0, t.items.length);
  t.items.forEach((key, i) => { tiles[used[i]] = { key, inCart: true }; });
  let f = 0;
  for (let s = 0; s < n; s++) if (!tiles[s]) tiles[s] = { key: t.fill[f++], inCart: false };
  return tiles;
}

/** Net per-item change between two carts, in the given key order: "cookies:+1|eggs:-1". */
function cartChanges(before, after, order) {
  const keys = (order || []).slice();
  for (const k of Object.keys(before).concat(Object.keys(after))) if (!keys.includes(k)) keys.push(k);
  const out = [];
  for (const k of keys) {
    const d = (after[k] || 0) - (before[k] || 0);
    if (d) out.push(k + ':' + (d > 0 ? '+' : '') + d);
  }
  return out.join('|');
}

/* ---------- participants and trial order ---------- */

/** cyrb128 string hash (bryc). Returns four unsigned 32-bit words. */
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** mulberry32 PRNG: returns a function giving floats in [0, 1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normPid(pid) { return String(pid == null ? '' : pid).trim().toUpperCase(); }

/** The 8 test trials in this participant's seeded random order (P0 always runs before them). */
function trialOrder(pid, arm, list) {
  const seed = cyrb128(normPid(pid) + String(arm).toUpperCase() + String(list).toUpperCase())[0];
  const rand = mulberry32(seed);
  const a = ORDER8.slice();
  for (let i = a.length - 1; i > 0; i--) {   // Fisher–Yates
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/** Participant number from an ID such as "P007" (last run of digits), or NaN. */
function participantNumber(pid) {
  const m = normPid(pid).match(/(\d+)(?!.*\d)/);
  return m ? parseInt(m[1], 10) : NaN;
}

/** Odd numbers -> arm A, even -> arm B; within each arm lists alternate A, B, A, ... */
function assignment(pid) {
  const n = participantNumber(pid);
  if (!(n > 0)) return null;
  return { arm: n % 2 === 1 ? 'A' : 'B', list: Math.ceil(n / 2) % 2 === 1 ? 'A' : 'B' };
}

function probeType(trialId, list) {
  return trialId === 'P0' || (LISTS[list] || []).includes(trialId) ? 'recall' : 'filler';
}

/* ---------- formatting and CSV ---------- */

function rupees(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV(columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(Array.isArray(r) ? r[columns.indexOf(c)] : r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

const BEHAVIOUR_COLUMNS = (
  'pid,arm,list,trial_id,trial_order,basket,B,F,T,listing_ms,cart_ms,bill_ms,decision,dec_rt_ms,' +
  'edit_rounds,edit_ms,rebill_ms,final_decision,final_B,final_F,final_T,added_value,fee_change,' +
  'free_delivery_unlocked,small_cart_fee_removed,cart_changes,edit_clicks,' +
  'probe_type,probe_question,recall_T,recall_ref_T,filler_answer,filler_correct_answer,conf,probe_rt_s,' +
  'et_mode,wc_cal_acc_deg,wc_bill_samples,wc_bill_valid_pct,wc_fees_hit,wc_fees_ttff_ms,wc_fees_ms,' +
  'wc_total_ms,wc_savings_ms,wc_nudge_ms,wc_buttons_ms,trial_start_iso').split(',');

const GAZE_COLUMNS = 'pid,arm,trial_id,trial_order,screen,t_ms,x,y,aoi,aoi_group'.split(',');

const AOI_COLUMNS = 'image,arm,trial,screen,aoi,x,y,w,h,fee_rupees,click_zone'.split(',');

/* ---------- AOIs and gaze ---------- */

const SCREEN_N = { listing: 1, cart: 2, bill: 3 };
const FEE_AOIS = ['BIL_DEL', 'BIL_HND', 'BIL_SCF', 'BIL_PLT'];
const AOI_GROUP = {
  BIL_TOT: 'TOTAL', BIL_BASE: 'BASE', BIL_SAVE: 'SAVINGS', BIL_NUDGE: 'NUDGE',
  BIL_BTN: 'BUTTONS', BTN_ORDER: 'BUTTONS', BTN_ADD: 'BUTTONS', BTN_EXIT: 'BUTTONS',
  LST_TILES: 'PRODUCTS', CRT_ITEMS: 'PRODUCTS', EDT_LIST: 'PRODUCTS',
  LST_FEEBAN: 'FEE_INFO', CRT_ALLIN: 'FEE_INFO',
  CRT_SUB: 'SUBTOTAL', CRT_PAYBAR: 'PAYBAR',
  LST_CARTBAR: 'CARTBAR', EDT_CARTBAR: 'CARTBAR',
};
for (const a of FEE_AOIS) AOI_GROUP[a] = 'FEES';

/** Pre-computes what hit-testing needs: the AOI list and the union rectangle of the fee rows. */
function prepareAOIs(aois, phone) {
  let fees = null;
  for (const a of aois) {
    if (!FEE_AOIS.includes(a.aoi)) continue;
    if (!fees) { fees = { x: a.x, y: a.y, r: a.x + a.w, b: a.y + a.h }; continue; }
    fees.x = Math.min(fees.x, a.x); fees.y = Math.min(fees.y, a.y);
    fees.r = Math.max(fees.r, a.x + a.w); fees.b = Math.max(fees.b, a.y + a.h);
  }
  return {
    aois: aois.slice(),
    fees: fees && { x: fees.x, y: fees.y, w: fees.r - fees.x, h: fees.b - fees.y },
    phone: phone || null,
  };
}

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }

/** Classifies one gaze point. aoi = smallest containing AOI; aoi_group follows the brief's map,
 *  with FEES decided by the union rectangle of the fee rows. */
function classifyPoint(x, y, prepared) {
  if (x === null || y === null || x === undefined || y === undefined || !isFinite(x) || !isFinite(y)) {
    return { aoi: '', group: 'NO_FACE' };
  }
  let best = null;
  for (const a of prepared.aois) {
    if (inRect(x, y, a) && (!best || a.w * a.h < best.w * best.h)) best = a;
  }
  if (prepared.fees && inRect(x, y, prepared.fees)) return { aoi: best ? best.aoi : '', group: 'FEES' };
  if (best) return { aoi: best.aoi, group: AOI_GROUP[best.aoi] || 'PHONE_OTHER' };
  return { aoi: '', group: prepared.phone && inRect(x, y, prepared.phone) ? 'PHONE_OTHER' : 'OFF_PHONE' };
}

const DWELL_CAP_MS = 100;

/** Per-trial gaze summary for one screen (the first-pass bill).
 *  samples: [{t, group}] with t in ms from screen onset; endT: screen duration in ms.
 *  Dwell = sum of inter-sample intervals, each capped at 100 ms. */
function summarizeGaze(samples, endT) {
  const dwell = {};
  let valid = 0, feesTTFF = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.group !== 'NO_FACE') valid++;
    if (s.group === 'FEES' && feesTTFF === null) feesTTFF = s.t;
    const next = i + 1 < samples.length ? samples[i + 1].t : endT;
    const dt = Math.max(0, Math.min(DWELL_CAP_MS, next - s.t));
    dwell[s.group] = (dwell[s.group] || 0) + dt;
  }
  const r = (v) => Math.round(v || 0);
  return {
    wc_bill_samples: samples.length,
    wc_bill_valid_pct: samples.length ? Math.round((1000 * valid) / samples.length) / 10 : 0,
    wc_fees_hit: feesTTFF === null ? 0 : 1,
    wc_fees_ttff_ms: feesTTFF === null ? '' : r(feesTTFF),
    wc_fees_ms: r(dwell.FEES),
    wc_total_ms: r(dwell.TOTAL),
    wc_savings_ms: r(dwell.SAVINGS),
    wc_nudge_ms: r(dwell.NUDGE),
    wc_buttons_ms: r(dwell.BUTTONS),
  };
}

/** Visual angle in degrees for a distance in CSS px, given screen width (cm) and viewing distance (cm). */
function pxToDeg(px, screenCm, screenPx, distCm) {
  return (Math.atan((px * (screenCm / screenPx)) / distCm) * 180) / Math.PI;
}

function accuracyLabel(deg) {
  if (deg === null || deg === undefined || !isFinite(deg)) return 'Poor';
  return deg <= 3 ? 'Good' : deg <= 4.5 ? 'Usable' : 'Poor';
}

const QKCore = {
  FEES, PRODUCTS, TRIALS, LISTS, ORDER8, TRIAL_IDS, RECALL_QUESTION, CONF_QUESTION, CONF_LABELS,
  initialCart, priceCart, suggestKey, editKeys, listingTiles, cartChanges,
  cyrb128, mulberry32, normPid, trialOrder, participantNumber, assignment, probeType,
  rupees, csvCell, toCSV, BEHAVIOUR_COLUMNS, GAZE_COLUMNS, AOI_COLUMNS,
  SCREEN_N, FEE_AOIS, AOI_GROUP, prepareAOIs, classifyPoint, summarizeGaze, DWELL_CAP_MS, pxToDeg, accuracyLabel,
};
if (typeof module !== 'undefined' && module.exports) module.exports = QKCore;
