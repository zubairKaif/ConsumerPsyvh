'use strict';
const { test, expect } = require('@playwright/test');
const { C, view, aois, byName, text, pixelDiff, watchErrors } = require('./helpers');

const R = C.rupees;

test.describe('static screens (view mode, 1920 x 1080)', () => {
  test('acceptance 1: bill screens are pixel-identical between arms for all 9 trials', async ({ page }) => {
    for (const trial of C.TRIAL_IDS) {
      await view(page, 'A', trial, 'bill');
      const a = await page.screenshot();
      await view(page, 'B', trial, 'bill');
      const b = await page.screenshot();
      expect(pixelDiff(a, b), `bill ${trial}: differing pixels between arm A and arm B`).toBe(0);
    }
  });

  test('sanity: listing and cart DO differ between arms (the manipulation is visible)', async ({ page }) => {
    for (const screen of ['listing', 'cart']) {
      await view(page, 'A', 'S1', screen);
      const a = await page.screenshot();
      await view(page, 'B', 'S1', screen);
      const b = await page.screenshot();
      expect(pixelDiff(a, b), screen).toBeGreaterThan(1000);
    }
  });

  test('acceptance 2: every fee AOI is at least 60 px tall at 1920 x 1080', async ({ page }) => {
    for (const trial of C.TRIAL_IDS) {
      await view(page, 'A', trial, 'bill');
      const fees = (await aois(page)).filter((a) => a.fee !== null);
      expect(fees.length, trial).toBe(C.priceCart(C.initialCart(trial)).smallCart ? 4 : 3);
      for (const f of fees) expect(f.h, `${trial} ${f.aoi}`).toBeGreaterThanOrEqual(60);
    }
  });

  test('acceptance 3: B, F and T on every screen match the fee rules', async ({ page }) => {
    // The brief's worked examples first.
    expect(C.priceCart(C.initialCart('S1'))).toMatchObject({ B: 118, F: 66, T: 184 });
    expect(C.priceCart(C.initialCart('L2'))).toMatchObject({ B: 462, F: 16, T: 478 });

    for (const trial of C.TRIAL_IDS) {
      const p = C.priceCart(C.initialCart(trial));
      const items = `${p.count} items`;
      for (const arm of ['A', 'B']) {
        const tag = `${arm} ${trial}`;
        // Listing: cart bar in the arm's format.
        await view(page, arm, trial, 'listing');
        const bar = await text(page, 'LST_CARTBAR');
        expect(bar, tag).toContain(items);
        if (arm === 'A') { expect(bar, tag).toContain(R(p.B)); expect(bar).not.toContain('incl.'); }
        else expect(bar.replace(/\s+/g, ' '), tag).toContain(`${R(p.T)} incl. all fees`);
        const ban = page.locator('[data-aoi="LST_FEEBAN"]');
        if (arm === 'B') {
          await expect(ban).toHaveText('Every order: handling fee ₹11 and platform fee ₹5. Delivery fee ₹30 below ₹199. Small cart fee ₹20 below ₹149.');
        } else await expect(ban).toHaveCount(0);

        // Cart: arm A shows only the item total, arm B the all-in card.
        await view(page, arm, trial, 'cart');
        const pay = (await text(page, 'CRT_PAYBAR')).replace(/\s+/g, ' ');
        if (arm === 'A') {
          expect(await text(page, 'CRT_SUB'), tag).toContain(R(p.B));
          expect(pay, tag).toContain(`${R(p.B)} ITEM TOTAL`);
          await expect(page.locator('[data-aoi="CRT_ALLIN"]')).toHaveCount(0);
        } else {
          const allin = (await text(page, 'CRT_ALLIN')).replace(/\s+/g, ' ');
          expect(allin, tag).toContain(`Total to pay Includes all fees ${R(p.T)}`);
          expect(allin, tag).toContain(`Item total ${R(p.B)}`);
          expect(allin, tag).toContain(p.delivery ? `Delivery fee ${R(30)}` : 'Delivery fee ₹30 FREE');
          expect(allin, tag).toContain('Handling fee ₹11');
          expect(allin, tag).toContain('Platform fee ₹5');
          expect(allin.includes('Small cart fee ₹20'), tag).toBe(p.smallCart === 20);
          expect(pay, tag).toContain(`${R(p.T)} TOTAL INCL. FEES`);
          await expect(page.locator('[data-aoi="CRT_SUB"]')).toHaveCount(0);
        }
        expect(pay, tag).toContain('Proceed to pay');

        // Bill: fee rows, total, savings and nudge.
        await view(page, arm, trial, 'bill');
        const A = byName(await aois(page));
        const fees = Object.values(A).filter((a) => a.fee !== null);
        expect(fees.reduce((s, a) => s + a.fee, 0), tag + ' sum of data-fee').toBe(p.F);
        expect(A.BIL_DEL.fee, tag).toBe(p.delivery);
        expect(A.BIL_HND.fee).toBe(11);
        expect(A.BIL_PLT.fee).toBe(5);
        expect(Boolean(A.BIL_SCF), tag).toBe(p.smallCart > 0);
        expect(await text(page, 'BIL_BASE'), tag).toContain(R(p.B));
        expect((await text(page, 'BIL_TOT')).replace(/\s+/g, ' '), tag).toBe(`To pay ${R(p.T)}`);
        expect((await text(page, 'BTN_ORDER')).replace(/\s+/g, ' '), tag).toContain(`${R(p.T)} TOTAL Place order`);
        expect(await text(page, 'BIL_SAVE'), tag).toBe(`You saved ${R(p.savings)} on this order`);
        if (p.B < 199) {
          const s = C.PRODUCTS[C.suggestKey(trial)];
          expect((await text(page, 'BIL_NUDGE')).replace(/\s+/g, ' '), tag)
            .toBe(`Add ${R(199 - p.B)} more to get free delivery Try ${s.name} (${s.size}) for ${R(s.price)}`);
        } else expect(A.BIL_NUDGE, tag).toBeUndefined();
      }
    }
  });

  test('acceptance 4: listing grid bottom sits above the cart bar top in both arms', async ({ page }) => {
    for (const trial of C.TRIAL_IDS) {
      for (const arm of ['A', 'B']) {
        await view(page, arm, trial, 'listing');
        const A = byName(await aois(page));
        expect(A.LST_TILES.y + A.LST_TILES.h, `${arm} ${trial}`).toBeLessThan(A.LST_CARTBAR.y);
      }
    }
  });

  test('bill layout: rows are 56 css px (scaled), To pay is 62, AOIs are inside the phone', async ({ page }) => {
    await view(page, 'A', 'S1', 'bill');
    const s = Math.min((1080 - 40) / 935, (1920 - 40) / 432);
    const A = byName(await aois(page));
    for (const k of ['BIL_BASE', 'BIL_DEL', 'BIL_HND', 'BIL_SCF', 'BIL_PLT']) expect(A[k].h).toBeCloseTo(56 * s, 0);
    expect(A.BIL_TOT.h).toBeCloseTo(62 * s, 0);
    const phone = await page.evaluate(() => { const r = document.getElementById('device').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    expect(phone.h).toBeCloseTo(935 * s, 0);
    for (const a of Object.values(A)) {
      expect(a.x).toBeGreaterThanOrEqual(phone.x); expect(a.y).toBeGreaterThanOrEqual(phone.y);
      expect(a.x + a.w).toBeLessThanOrEqual(phone.x + phone.w + 0.5); expect(a.y + a.h).toBeLessThanOrEqual(phone.y + phone.h + 0.5);
    }
    // Rows are contiguous: fees form one block between the item total and To pay.
    expect(A.BIL_DEL.y).toBeCloseTo(A.BIL_BASE.y + A.BIL_BASE.h, 0);
    expect(A.BIL_TOT.y).toBeCloseTo(A.BIL_PLT.y + A.BIL_PLT.h, 0);
  });

  test('click zones: decision buttons and forward bars carry data-click', async ({ page }) => {
    const zones = {};
    for (const screen of ['listing', 'cart', 'bill', 'edit']) {
      await view(page, 'A', 'S1', screen);
      for (const a of await aois(page)) if (a.click_zone) zones[a.aoi] = true;
    }
    expect(Object.keys(zones).sort()).toEqual(['BTN_ADD', 'BTN_EXIT', 'BTN_ORDER', 'CRT_PAYBAR', 'EDT_CARTBAR', 'LST_CARTBAR']);
  });

  test('view mode: forward buttons navigate onward and the hash follows', async ({ page }) => {
    const errors = watchErrors(page);
    await view(page, 'B', 'S2', 'listing');
    await expect(page).toHaveURL(/#0-S2-listing$/);
    await page.click('[data-aoi="LST_CARTBAR"]');
    await expect(page.locator('[data-aoi="CRT_ALLIN"]')).toBeVisible();
    await expect(page).toHaveURL(/#0-S2-cart$/);
    await page.click('[data-aoi="CRT_PAYBAR"]');
    await expect(page.locator('[data-aoi="BIL_TOT"]')).toBeVisible();
    await expect(page).toHaveURL(/#0-S2-bill$/);
    await page.click('[data-aoi="BTN_ADD"]');
    await expect(page.locator('[data-aoi="EDT_LIST"]')).toBeVisible();
    await expect(page).toHaveURL(/#0-S2-edit1$/);
    await page.click('[data-aoi="EDT_CARTBAR"]');
    await expect(page).toHaveURL(/#0-S2-bill2$/);
    await page.click('[data-aoi="BTN_ORDER"]');
    await expect(page.getByText('Decision: Place order')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('aoi=1 draws one box per AOI; click zones are dashed', async ({ page }) => {
    await view(page, 'A', 'S1', 'bill', '&aoi=1');
    const n = (await aois(page)).length;
    await expect(page.locator('.aoi-box')).toHaveCount(n);
    await expect(page.locator('.aoi-box.aoi-click')).toHaveCount(3);
    expect(await page.locator('.aoi-click').first().evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('dashed');
  });

  test('bad view parameters show a helpful message instead of a broken screen', async ({ page }) => {
    await page.goto('QuikKart_Stimulus_App.html?mode=view&arm=C&trial=S1&screen=bill');
    await expect(page.getByText('arm must be A or B.')).toBeVisible();
  });

  test('rupee sign renders in Roboto (latin-ext subset), not a fallback font', async ({ page }) => {
    await view(page, 'A', 'S1', 'bill');
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable'); await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-aoi="BIL_TOT"] b' });
    const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(fonts.map((f) => f.familyName)).toEqual(['Roboto']);
  });
});
