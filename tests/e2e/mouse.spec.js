'use strict';
const { test, expect } = require('@playwright/test');
const { C, aois, byName, watchErrors, parseCSV, playSession } = require('./helpers');

const centre = (a) => [a.x + a.w / 2, a.y + a.h / 2];

test.describe('eye tracking: mouse simulation', () => {
  test('acceptance 5: et=mouse completes 9 trials; behaviour CSV columns exact; FEES samples when the cursor is on a fee row', async ({ page }) => {
    const errors = watchErrors(page);
    const { behaviour, gaze } = await playSession(page, {
      pid: 'P007', arm: 'A', list: 'B', et: 'mouse',
      onBill: async (p) => {
        const A = byName(await aois(p));
        // Look at the item total, then hold on the handling fee row, then decide.
        await p.mouse.move(...centre(A.BIL_BASE));
        await p.waitForTimeout(200);
        await p.mouse.move(...centre(A.BIL_HND));
        await p.waitForTimeout(400);
        await p.click('[data-aoi="BTN_ORDER"]');
      },
    });
    expect(errors).toEqual([]);

    const B = parseCSV(behaviour);
    expect(B.header).toEqual(C.BEHAVIOUR_COLUMNS);
    expect(B.rows).toHaveLength(9);
    for (const r of B.rows) {
      expect(r.et_mode).toBe('mouse');
      expect(r.wc_cal_acc_deg).toBe('');
      expect(Number(r.wc_bill_samples), r.trial_id).toBeGreaterThan(10);
      expect(Number(r.wc_bill_valid_pct)).toBe(100);
      expect(r.wc_fees_hit, r.trial_id).toBe('1');
      expect(Number(r.wc_fees_ms), r.trial_id).toBeGreaterThanOrEqual(300);
      expect(Number(r.wc_fees_ttff_ms), r.trial_id).toBeGreaterThan(150); // the cursor sits on Item total for 200 ms first
      expect(Number(r.wc_buttons_ms)).toBeGreaterThanOrEqual(0);
      expect(r.wc_savings_ms).not.toBe('');
    }

    const G = parseCSV(gaze);
    expect(G.header).toEqual(C.GAZE_COLUMNS);
    const fees = G.rows.filter((r) => r.aoi_group === 'FEES');
    expect(fees.length).toBeGreaterThan(9 * 8);
    expect(fees.every((r) => r.screen === 'bill')).toBe(true);
    expect(new Set(fees.map((r) => r.aoi))).toEqual(new Set(['BIL_HND']));
    expect(G.rows.some((r) => r.aoi_group === 'BASE' && r.aoi === 'BIL_BASE')).toBe(true);
    expect(new Set(G.rows.map((r) => r.screen))).toEqual(new Set(['listing', 'cart', 'bill']));
    expect(new Set(G.rows.map((r) => r.trial_id)).size).toBe(9);
    // Roughly 30 Hz: median interval between consecutive samples on one screen is ~33 ms.
    const gaps = [];
    for (let i = 1; i < G.rows.length; i++) {
      const a = G.rows[i - 1], b = G.rows[i];
      if (a.trial_id === b.trial_id && a.screen === b.screen) gaps.push(Number(b.t_ms) - Number(a.t_ms));
    }
    gaps.sort((x, y) => x - y);
    expect(gaps[Math.floor(gaps.length / 2)]).toBeGreaterThanOrEqual(28);
    expect(gaps[Math.floor(gaps.length / 2)]).toBeLessThanOrEqual(40);
  });

  test('hit-testing groups: smallest AOI, PRODUCTS, CARTBAR, PHONE_OTHER, OFF_PHONE; dot=1 highlights the hit AOI', async ({ page }) => {
    await page.goto('QuikKart_Stimulus_App.html?mode=run&pid=T2&arm=B&list=A&et=mouse&dot=1');
    await page.getByRole('button', { name: 'Start the practice order' }).click();
    await page.locator('[data-aoi="LST_CARTBAR"]').waitFor();
    const A = byName(await aois(page));
    const probe = async (x, y) => {
      await page.mouse.move(x, y);
      await page.waitForTimeout(120);
      return page.evaluate(() => { const r = window.QKSession.tracker.rows; return r[r.length - 1].slice(8); });
    };
    expect(await probe(...centre(A.LST_FEEBAN))).toEqual(['LST_FEEBAN', 'FEE_INFO']);
    expect(await probe(...centre(A.LST_TILES))).toEqual(['LST_TILES', 'PRODUCTS']);
    expect(await probe(...centre(A.LST_CARTBAR))).toEqual(['LST_CARTBAR', 'CARTBAR']);
    await expect(page.locator('#hilite')).toBeVisible();
    const h = await page.locator('#hilite').boundingBox();
    expect(Math.abs(h.y - A.LST_CARTBAR.y)).toBeLessThan(1.5);
    const phone = await page.evaluate(() => { const r = document.getElementById('device').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    expect(await probe(phone.x + 40, phone.y + 60)).toEqual(['', 'PHONE_OTHER']);
    expect(await probe(100, 500)).toEqual(['', 'OFF_PHONE']);
  });
});
