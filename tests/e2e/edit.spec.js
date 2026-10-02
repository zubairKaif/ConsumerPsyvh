'use strict';
const { test, expect } = require('@playwright/test');
const { C, view, aois, byName, text, watchErrors, parseCSV, playSession } = require('./helpers');

const inc = (page, k) => page.click(`[data-act="inc"][data-key="${k}"]`);
const dec = (page, k) => page.click(`[data-act="dec"][data-key="${k}"]`);

test.describe('editing phase', () => {
  test('acceptance 6: adding 1 cookies to S1 gives B 208, F 16, added_value 90, fee_change -50', async ({ page }) => {
    const errors = watchErrors(page);
    let checkedBill = false;
    const { behaviour, hashes } = await playSession(page, {
      pid: 'P005', arm: 'A', list: 'A',
      onBill: async (p, { trial, order }) => {
        if (trial !== 'S1') return p.click('[data-aoi="BTN_ORDER"]');
        await p.click('[data-aoi="BTN_ADD"]');
        await expect(p).toHaveURL(new RegExp(`#${order}-S1-edit1$`));
        await inc(p, 'cookies');
        await p.click('[data-aoi="EDT_CARTBAR"]');
        await expect(p).toHaveURL(new RegExp(`#${order}-S1-bill2$`));
        // The rebuilt bill: delivery FREE, no small-cart fee, F 16, T 224, no nudge.
        const A = byName(await aois(p));
        expect(A.BIL_DEL.fee).toBe(0);
        expect(A.BIL_SCF).toBeUndefined();
        expect(A.BIL_NUDGE).toBeUndefined();
        expect(Object.values(A).filter((a) => a.fee !== null).reduce((s, a) => s + a.fee, 0)).toBe(16);
        expect(await text(p, 'BIL_BASE')).toContain('₹208');
        expect((await text(p, 'BIL_TOT')).replace(/\s+/g, ' ')).toBe('To pay ₹224');
        checkedBill = true;
        await p.click('[data-aoi="BTN_ORDER"]');
      },
    });
    expect(checkedBill).toBe(true);
    expect(errors).toEqual([]);
    const s1 = parseCSV(behaviour).rows.find((r) => r.trial_id === 'S1');
    expect(s1).toMatchObject({
      B: '118', F: '66', T: '184', decision: 'Add item', final_decision: 'Place order',
      final_B: '208', final_F: '16', final_T: '224', added_value: '90', fee_change: '-50',
      free_delivery_unlocked: '1', small_cart_fee_removed: '1', cart_changes: 'cookies:+1',
      edit_rounds: '1', edit_clicks: '1', probe_type: 'recall', recall_ref_T: '224',
    });
    expect(Number(s1.edit_ms)).toBeGreaterThan(0);
    expect(Number(s1.rebill_ms)).toBeGreaterThan(0);
    expect(hashes.some((h) => /-S1-edit1$/.test(h))).toBe(true);
  });

  test('the loop: Add more items on a rebuilt bill returns to editing (edit2, bill3)', async ({ page }) => {
    const { behaviour, hashes } = await playSession(page, {
      pid: 'P006', arm: 'B', list: 'A',
      onBill: async (p, { trial }) => {
        if (trial !== 'L4') return p.click('[data-aoi="BTN_ORDER"]');
        await p.click('[data-aoi="BTN_ADD"]');
        await dec(p, 'shampoo');                          // B 172: small cart fee stays off, delivery comes back
        await p.click('[data-aoi="EDT_CARTBAR"]');
        await expect(p.locator('[data-aoi="BIL_NUDGE"]')).toContainText('Add ₹27 more to get free delivery');
        await expect(p.locator('[data-aoi="BIL_NUDGE"]')).toContainText('Try Choco chip cookies (150 g) for ₹90');
        await p.click('[data-aoi="BTN_ADD"]');
        await inc(p, 'tissue'); await inc(p, 'tissue');     // +188 -> B 360
        await dec(p, 'tissue');                           // net +1 tissue -> B 266
        await p.click('[data-aoi="EDT_CARTBAR"]');
        await p.click('[data-aoi="BTN_EXIT"]');
      },
    });
    const l4 = parseCSV(behaviour).rows.find((r) => r.trial_id === 'L4');
    expect(l4).toMatchObject({
      decision: 'Add item', final_decision: 'Exit', edit_rounds: '2', edit_clicks: '4',
      final_B: '266', final_F: '16', added_value: String(266 - 471), fee_change: '0',
      free_delivery_unlocked: '0', small_cart_fee_removed: '0', cart_changes: 'shampoo:-1|tissue:+1',
    });
    for (const s of ['edit1', 'bill2', 'edit2', 'bill3']) expect(hashes.some((h) => h.endsWith('-L4-' + s))).toBe(true);
  });

  test('steppers stay within 0..9, an empty cart disables View bill, arm B cart bar is all-in and live', async ({ page }) => {
    await view(page, 'B', 'S1', 'edit');
    const bar = () => text(page, 'EDT_CARTBAR');
    expect((await bar()).replace(/\s+/g, ' ')).toContain('3 items ₹184 incl. all fees');
    await inc(page, 'cookies');
    expect((await bar()).replace(/\s+/g, ' ')).toContain('4 items ₹224 incl. all fees');
    await expect(page.locator('.prog-t')).toHaveText('Free delivery unlocked');
    for (let i = 0; i < 12; i++) if (await page.locator('[data-act="inc"][data-key="milk"]:not(.is-off)').count()) await inc(page, 'milk');
    await expect(page.locator('.erow').first().locator('.st-n')).toHaveText('9');
    await expect(page.locator('[data-act="inc"][data-key="milk"]')).toHaveClass(/is-off/);
    for (let i = 0; i < 9; i++) await dec(page, 'milk');
    await dec(page, 'cookies'); await dec(page, 'bread'); await dec(page, 'eggs');
    await expect(page.locator('[data-act="dec"]')).toHaveCount(0);
    await expect(page.locator('[data-aoi="EDT_CARTBAR"]')).toHaveClass(/is-off/);
    await page.click('[data-aoi="EDT_CARTBAR"]');
    await expect(page.locator('[data-aoi="EDT_LIST"]')).toBeVisible(); // still editing
    await expect(page).toHaveURL(/#0-S1-edit1$/);
    await inc(page, 'butter');
    await page.click('[data-aoi="EDT_CARTBAR"]');
    await expect(page.locator('[data-aoi="BIL_TOT"]')).toContainText('₹124'); // butter 58 + fees 30 + 20 + 11 + 5
  });

  test('edit list order: trial items, suggestion (cookies if none), fill; no duplicates', async ({ page }) => {
    for (const trial of ['S3', 'S4', 'L1']) {
      await view(page, 'A', trial, 'edit');
      const keys = await page.$$eval('.erow [data-key]', (els) => [...new Set(els.map((e) => e.dataset.key))]);
      expect(keys, trial).toEqual(C.editKeys(trial));
    }
  });

  test('edit AOIs: EDT_LIST and EDT_CARTBAR, and the AOI overlay follows re-renders', async ({ page }) => {
    await view(page, 'A', 'S2', 'edit', '&aoi=1');
    const names = (await aois(page)).map((a) => a.aoi).sort();
    expect(names).toEqual(['EDT_CARTBAR', 'EDT_LIST']);
    await inc(page, 'mango');
    await expect(page.locator('.aoi-box')).toHaveCount(2);
  });
});
