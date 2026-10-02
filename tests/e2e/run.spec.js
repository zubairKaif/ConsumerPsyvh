'use strict';
const { test, expect } = require('@playwright/test');
const { C, open, watchErrors, parseCSV, playSession } = require('./helpers');

test.describe('run mode', () => {
  test('a session with et=none runs P0 + 8 trials and writes a complete behaviour CSV', async ({ page }) => {
    const errors = watchErrors(page);
    const pid = 'P003', arm = 'A', list = 'B';
    const { behaviour, gaze, hashes, trials } = await playSession(page, { pid, arm, list, et: 'none' });
    expect(errors).toEqual([]);
    expect(gaze).toBeNull();

    // Order: practice first, then the seeded order for this participant.
    expect(trials).toEqual(['P0'].concat(C.trialOrder(pid, arm, list)));

    const { header, rows } = parseCSV(behaviour);
    expect(header).toEqual(C.BEHAVIOUR_COLUMNS);
    expect(rows).toHaveLength(9);
    rows.forEach((r, i) => {
      const p = C.priceCart(C.initialCart(r.trial_id));
      expect(r).toMatchObject({ pid, arm, list, trial_id: trials[i], trial_order: String(i), basket: C.TRIALS[r.trial_id].basket,
        B: String(p.B), F: String(p.F), T: String(p.T), decision: 'Place order', final_decision: 'Place order',
        final_T: String(p.T), added_value: '0', fee_change: '0', edit_rounds: '0', cart_changes: '', et_mode: 'none' });
      for (const k of ['listing_ms', 'cart_ms', 'bill_ms', 'dec_rt_ms']) expect(Number(r[k]), `${r.trial_id} ${k}`).toBeGreaterThan(0);
      expect(Math.abs(Number(r.dec_rt_ms) - Number(r.bill_ms))).toBeLessThan(100);
      expect(r.trial_start_iso).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(r.wc_bill_samples).toBe('');
      const type = C.probeType(r.trial_id, list);
      expect(r.probe_type).toBe(type);
      if (type === 'recall') {
        expect(r).toMatchObject({ probe_question: C.RECALL_QUESTION, recall_T: String(p.T), recall_ref_T: String(p.T), conf: '4', filler_answer: '' });
      } else {
        expect(r).toMatchObject({ probe_question: C.TRIALS[r.trial_id].filler[0], filler_answer: C.TRIALS[r.trial_id].filler[1],
          filler_correct_answer: C.TRIALS[r.trial_id].filler[1], recall_T: '', conf: '' });
      }
      expect(Number(r.probe_rt_s)).toBeGreaterThan(0);
    });
    expect(rows.filter((r) => r.probe_type === 'recall').map((r) => r.trial_id).sort()).toEqual(['P0'].concat(C.LISTS[list]).sort());

    // Hash on every screen change: #{order}-{trial}-{screen}.
    for (const s of ['fix', 'listing', 'cart', 'bill', 'blank', 'probe']) expect(hashes).toContain(`#3-${trials[3]}-${s}`);
    expect(hashes).toContain('#0-none-practicedone');
    expect(hashes[hashes.length - 1]).toBe('#9-none-end');

    // Autosave to localStorage.
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), 'quikkart_' + pid);
    expect(saved.complete).toBe(true);
    expect(saved.rows).toHaveLength(9);
    expect(saved.columns).toEqual(C.BEHAVIOUR_COLUMNS);
  });

  test('Exit and Add item decisions are recorded; arm and list default from the pid', async ({ page }) => {
    // P002 -> arm B, list A when arm/list are left out of the URL.
    await open(page, 'mode=run&pid=P002&et=none');
    expect(await page.evaluate(() => [window.QKSession.arm, window.QKSession.list])).toEqual(['B', 'A']);
    const { behaviour } = await playSession(page, {
      pid: 'P010', arm: 'B', list: 'A',
      onBill: async (p, { order }) => {
        if (order === 1) { // Add item, change nothing, then leave
          await p.click('[data-aoi="BTN_ADD"]');
          await p.click('[data-aoi="EDT_CARTBAR"]');
          await p.click('[data-aoi="BTN_EXIT"]');
        } else if (order === 2) await p.click('[data-aoi="BTN_EXIT"]');
        else await p.click('[data-aoi="BTN_ORDER"]');
      },
    });
    const rows = parseCSV(behaviour).rows;
    expect(rows[1]).toMatchObject({ decision: 'Add item', final_decision: 'Exit', edit_rounds: '1', cart_changes: '', added_value: '0' });
    expect(Number(rows[1].edit_ms)).toBeGreaterThan(0);
    expect(Number(rows[1].rebill_ms)).toBeGreaterThan(0);
    expect(rows[2]).toMatchObject({ decision: 'Exit', final_decision: 'Exit', edit_rounds: '0' });
  });

  test('missing pid shows a message', async ({ page }) => {
    await page.goto('QuikKart_Stimulus_App.html?mode=run');
    await expect(page.getByText('pid is missing')).toBeVisible();
  });
});
