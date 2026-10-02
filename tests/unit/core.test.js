'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../src/js/core.js');

// Expected first-pass values, worked out by hand from the brief's fee rules.
const EXPECTED = {
  P0: { B: 48, F: 66, T: 114, savings: 4 },
  S1: { B: 118, F: 66, T: 184, savings: 11 },
  S2: { B: 126, F: 66, T: 192, savings: 12 },
  S3: { B: 112, F: 66, T: 178, savings: 3 },
  S4: { B: 137, F: 66, T: 203, savings: 12 },
  L1: { B: 437, F: 16, T: 453, savings: 51 },
  L2: { B: 462, F: 16, T: 478, savings: 58 },
  L3: { B: 418, F: 16, T: 434, savings: 41 },
  L4: { B: 471, F: 16, T: 487, savings: 68 },
};

test('every trial prices as expected (B, F, T, savings)', () => {
  for (const id of C.TRIAL_IDS) {
    const p = C.priceCart(C.initialCart(id));
    assert.deepEqual({ B: p.B, F: p.F, T: p.T, savings: p.savings }, EXPECTED[id], id);
    assert.equal(p.T, p.B + p.F);
  }
});

test('brief examples: S1 = 118/66/184, L2 = 462/16/478', () => {
  const s1 = C.priceCart(C.initialCart('S1'));
  assert.equal(s1.B, 118); assert.equal(s1.F, 66); assert.equal(s1.T, 184);
  const l2 = C.priceCart(C.initialCart('L2'));
  assert.equal(l2.B, 462); assert.equal(l2.F, 16); assert.equal(l2.T, 478);
});

test('fee thresholds are strict "below" comparisons', () => {
  // A synthetic ₹1 product lets us build a cart worth exactly B.
  C.PRODUCTS.__t = { name: 't', size: '', price: 1, mrp: 1, shape: 'box', c: '#000', bg: '#fff' };
  try {
    const q = (B) => C.priceCart({ __t: B });
    assert.equal(q(148).smallCart, 20); assert.equal(q(149).smallCart, 0);
    assert.equal(q(198).delivery, 30); assert.equal(q(199).delivery, 0);
    assert.equal(q(148).F, 66); assert.equal(q(149).F, 46);
    assert.equal(q(198).F, 46); assert.equal(q(199).F, 16);
    assert.equal(q(150).toFreeDelivery, 49); assert.equal(q(199).toFreeDelivery, 0);
  } finally { delete C.PRODUCTS.__t; }
});

test('quantities multiply price and MRP', () => {
  const p = C.priceCart({ cookies: 2, milk: 3 });
  assert.equal(p.B, 2 * 90 + 3 * 32);
  assert.equal(p.mrpTotal, 2 * 95 + 3 * 34);
  assert.equal(p.count, 5);
  assert.equal(p.items.length, 2);
});

test('editing example from the brief: S1 + cookies gives B 208, F 16', () => {
  const cart = Object.assign(C.initialCart('S1'), { cookies: 1 });
  const p = C.priceCart(cart);
  const p0 = C.priceCart(C.initialCart('S1'));
  assert.equal(p.B, 208); assert.equal(p.F, 16); assert.equal(p.delivery, 0); assert.equal(p.smallCart, 0);
  assert.equal(p.B - p0.B, 90);
  assert.equal(p.F - p0.F, -50);
  assert.equal(C.cartChanges(C.initialCart('S1'), cart, C.editKeys('S1')), 'cookies:+1');
});

test('cartChanges formats net changes in list order', () => {
  const before = { milk: 1, bread: 1, eggs: 1 };
  const after = { milk: 1, bread: 1, eggs: 0, cookies: 1 };
  assert.equal(C.cartChanges(before, after, C.editKeys('S1')), 'eggs:-1|cookies:+1');
  assert.equal(C.cartChanges(before, { milk: 3, bread: 1, eggs: 1 }, []), 'milk:+2');
  assert.equal(C.cartChanges(before, before, []), '');
});

test('listing has six tiles with cart items interleaved on a checkerboard', () => {
  for (const id of C.TRIAL_IDS) {
    const tiles = C.listingTiles(id);
    assert.equal(tiles.length, 6, id);
    const t = C.TRIALS[id];
    assert.deepEqual(tiles.filter((x) => x.inCart).map((x) => x.key), t.items, id);
    assert.deepEqual(tiles.filter((x) => !x.inCart).map((x) => x.key), t.fill, id);
    const slots = tiles.map((x, i) => (x.inCart ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(slots, t.items.length === 3 ? [0, 3, 4] : [0, 3], id);
  }
});

test('edit list: trial items, suggestion (or cookies), then fill, without duplicates', () => {
  assert.deepEqual(C.editKeys('S1'), ['milk', 'bread', 'eggs', 'cookies', 'butter', 'juice', 'cheese']);
  assert.deepEqual(C.editKeys('S3'), ['cola', 'chips', 'biscuit', 'nuts', 'juice', 'cookies']);
  assert.deepEqual(C.editKeys('L1'), ['atta', 'dal', 'cookies', 'rice', 'oil', 'sugar', 'salt']);
  assert.equal(C.suggestKey('L2'), 'cookies');
  assert.equal(C.suggestKey('S2'), 'mango');
});

test('trial order is a seeded, deterministic permutation of the 8 test trials', () => {
  const a = C.trialOrder('P001', 'A', 'A');
  assert.deepEqual(a, C.trialOrder('P001', 'A', 'A'));
  assert.deepEqual(a, C.trialOrder(' p001 ', 'a', 'a'), 'pid/arm/list are normalised');
  assert.deepEqual(a.slice().sort(), C.ORDER8.slice().sort());
  assert.ok(!a.includes('P0'));
  // Different inputs give different orders for most participants.
  const seen = new Set();
  for (let n = 1; n <= 80; n++) {
    const pid = 'P' + String(n).padStart(3, '0');
    const as = C.assignment(pid);
    seen.add(C.trialOrder(pid, as.arm, as.list).join(''));
  }
  assert.ok(seen.size >= 75, 'orders should rarely repeat, got ' + seen.size + ' distinct of 80');
});

test('each test trial lands in each position roughly equally often over many pids', () => {
  const counts = {};
  const N = 4000;
  for (let n = 1; n <= N; n++) {
    C.trialOrder('X' + n, 'A', 'A').forEach((t, i) => { counts[t + i] = (counts[t + i] || 0) + 1; });
  }
  for (const t of C.ORDER8) for (let i = 0; i < 8; i++) {
    const c = counts[t + i] || 0;
    assert.ok(Math.abs(c - N / 8) < N / 8 * 0.2, `${t} at ${i}: ${c}`);
  }
});

test('mulberry32 matches the canonical implementation; cyrb128 is stable', () => {
  // Canonical mulberry32 (bryc), copied verbatim.
  function ref(a) {
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  for (const seed of [0, 1, 42, 0xdeadbeef, C.cyrb128('P001AA')[0]]) {
    const mine = C.mulberry32(seed), theirs = ref(seed);
    for (let i = 0; i < 1000; i++) assert.equal(mine(), theirs(), `seed ${seed}, draw ${i}`);
  }
  const h = C.cyrb128('P001AA');
  assert.equal(h.length, 4);
  assert.ok(h.every((w) => Number.isInteger(w) && w >= 0 && w < 2 ** 32));
  assert.notDeepEqual(h, C.cyrb128('P001AB'));
});

test('assignment: odd -> arm A, even -> arm B; lists alternate within arm starting with A', () => {
  const got = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => C.assignment('P' + String(n).padStart(3, '0')));
  assert.deepEqual(got, [
    { arm: 'A', list: 'A' }, { arm: 'B', list: 'A' }, { arm: 'A', list: 'B' }, { arm: 'B', list: 'B' },
    { arm: 'A', list: 'A' }, { arm: 'B', list: 'A' }, { arm: 'A', list: 'B' }, { arm: 'B', list: 'B' },
  ]);
  assert.equal(C.assignment('pilot'), null);
  assert.deepEqual(C.assignment('S2-P012'), { arm: 'B', list: 'B' });
});

test('probe type: P0 and the list trials are recall, the rest filler', () => {
  for (const list of ['A', 'B']) {
    assert.equal(C.probeType('P0', list), 'recall');
    for (const t of C.ORDER8) assert.equal(C.probeType(t, list), C.LISTS[list].includes(t) ? 'recall' : 'filler');
  }
  // Every non-practice trial has a filler question for the participants who get it as filler.
  for (const t of C.ORDER8) assert.equal(C.TRIALS[t].filler.length, 2);
});

test('rupees uses the ₹ sign and Indian digit grouping', () => {
  assert.equal(C.rupees(184), '₹184');
  assert.equal(C.rupees(2385), '₹2,385');
  assert.equal(C.rupees(123456), '₹1,23,456');
});

test('CSV quoting', () => {
  const csv = C.toCSV(['a', 'b'], [{ a: 'x,y', b: 'say "hi"' }, { a: null, b: 3 }]);
  assert.equal(csv, 'a,b\r\n"x,y","say ""hi"""\r\n,3\r\n');
  assert.equal(C.BEHAVIOUR_COLUMNS.length, 47);
  assert.equal(C.GAZE_COLUMNS.join(','), 'pid,arm,trial_id,trial_order,screen,t_ms,x,y,aoi,aoi_group');
});

test('gaze classification: smallest AOI, FEES union, PHONE_OTHER, OFF_PHONE, NO_FACE', () => {
  const aois = [
    { aoi: 'BIL_BASE', x: 0, y: 0, w: 100, h: 50 },
    { aoi: 'BIL_DEL', x: 0, y: 50, w: 100, h: 50 },
    { aoi: 'BIL_HND', x: 0, y: 100, w: 100, h: 50 },
    { aoi: 'BIL_PLT', x: 0, y: 150, w: 100, h: 50 },
    { aoi: 'BIL_TOT', x: 0, y: 200, w: 100, h: 60 },
    { aoi: 'BIL_BTN', x: 0, y: 300, w: 100, h: 100 },
    { aoi: 'BTN_ORDER', x: 10, y: 310, w: 80, h: 40 },
  ];
  const P = C.prepareAOIs(aois, { x: -10, y: -10, w: 130, h: 430 });
  assert.deepEqual(P.fees, { x: 0, y: 50, w: 100, h: 150 });
  assert.deepEqual(C.classifyPoint(50, 120, P), { aoi: 'BIL_HND', group: 'FEES' });
  assert.deepEqual(C.classifyPoint(50, 25, P), { aoi: 'BIL_BASE', group: 'BASE' });
  assert.deepEqual(C.classifyPoint(50, 230, P), { aoi: 'BIL_TOT', group: 'TOTAL' });
  assert.deepEqual(C.classifyPoint(50, 320, P), { aoi: 'BTN_ORDER', group: 'BUTTONS' });
  assert.deepEqual(C.classifyPoint(5, 380, P), { aoi: 'BIL_BTN', group: 'BUTTONS' });
  assert.deepEqual(C.classifyPoint(50, 280, P), { aoi: '', group: 'PHONE_OTHER' });
  assert.deepEqual(C.classifyPoint(500, 280, P), { aoi: '', group: 'OFF_PHONE' });
  assert.deepEqual(C.classifyPoint(null, null, P), { aoi: '', group: 'NO_FACE' });
  // Shared edges belong to the lower row (half-open rectangles).
  assert.equal(C.classifyPoint(50, 100, P).aoi, 'BIL_HND');
});

test('gaze summary: dwell capped at 100 ms, TTFF, valid percentage', () => {
  const s = [
    { t: 0, group: 'NO_FACE' },
    { t: 33, group: 'TOTAL' },
    { t: 66, group: 'FEES' },
    { t: 99, group: 'FEES' },
    { t: 400, group: 'BUTTONS' },   // gap of 301 ms after the previous FEES sample is capped
  ];
  const r = C.summarizeGaze(s, 450);
  assert.equal(r.wc_bill_samples, 5);
  assert.equal(r.wc_bill_valid_pct, 80);
  assert.equal(r.wc_fees_hit, 1);
  assert.equal(r.wc_fees_ttff_ms, 66);
  assert.equal(r.wc_fees_ms, 33 + 100);
  assert.equal(r.wc_total_ms, 33);
  assert.equal(r.wc_buttons_ms, 50);
  const none = C.summarizeGaze([], 1000);
  assert.equal(none.wc_fees_hit, 0); assert.equal(none.wc_fees_ttff_ms, ''); assert.equal(none.wc_bill_valid_pct, 0);
});

test('visual angle conversion and accuracy labels', () => {
  // 34.5 cm wide, 1920 px, 60 cm away: 1 degree is about 58 px.
  const onePx = C.pxToDeg(1, 34.5, 1920, 60);
  assert.ok(Math.abs(58.3 * onePx - 1) < 0.01, String(1 / onePx));
  assert.equal(C.accuracyLabel(2.9), 'Good');
  assert.equal(C.accuracyLabel(3), 'Good');
  assert.equal(C.accuracyLabel(4.5), 'Usable');
  assert.equal(C.accuracyLabel(4.51), 'Poor');
  assert.equal(C.accuracyLabel(null), 'Poor');
  assert.equal(C.accuracyLabel(NaN), 'Poor');
});
