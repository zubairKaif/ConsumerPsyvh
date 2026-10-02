'use strict';
const { test, expect } = require('@playwright/test');
const { C, open, watchErrors, parseCSV, readDownload } = require('./helpers');

test.describe('researcher console (default page)', () => {
  test('sections, red webcam warning and the basket table', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, '');
    for (const h of ['Run a full session', 'Preview one screen', 'Saved sessions in this browser', 'Baskets and fees', 'Tobii Pro Lab (desktop, image stimuli)']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible();
    }
    const warn = page.locator('.con-warn');
    await expect(warn).toContainText('Webcam tracking error is 2–4° against about 0.5° for the Tobii');
    await expect(warn).toContainText('cannot separate individual fee lines');
    const rgb = (await warn.evaluate((e) => getComputedStyle(e).color)).match(/\d+/g).map(Number);
    expect(rgb[0]).toBeGreaterThan(150); expect(rgb[1]).toBeLessThan(80); expect(rgb[2]).toBeLessThan(80);

    const rows = page.locator('.bt tbody tr');
    await expect(rows).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      const id = C.TRIAL_IDS[i], p = C.priceCart(C.initialCart(id));
      const cells = await rows.nth(i).locator('td').allInnerTexts();
      expect(cells[0]).toContain(id);
      expect([cells[3], cells[8], cells[9]], id).toEqual([C.rupees(p.B), C.rupees(p.F), C.rupees(p.T)]);
    }
    expect(errors).toEqual([]);
  });

  test('run form: arm and list from the participant number, order preview, start URL', async ({ page }) => {
    await open(page, '');
    await page.fill('input[name=pid]', 'P007');
    await expect(page.locator('[data-assign]')).toHaveText('P007 is participant 7: arm A, list B.');
    const shown = await page.locator('[data-order] span.recall, [data-order] span.filler').allInnerTexts();
    expect(shown).toEqual(['P0'].concat(C.trialOrder('P007', 'A', 'B')));
    expect(await page.locator('[data-order] span.recall').allInnerTexts()).toEqual(
      ['P0'].concat(C.trialOrder('P007', 'A', 'B').filter((t) => C.LISTS.B.includes(t))));
    await page.selectOption('select[name=et]', 'mouse');
    await page.fill('input[name=cm]', '31');
    await page.fill('input[name=dist]', '65');
    await page.check('input[name=dot]');
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.waitForURL(/mode=run/);
    const q = new URL(page.url()).searchParams;
    expect(Object.fromEntries(q)).toEqual({ mode: 'run', pid: 'P007', arm: 'A', list: 'B', et: 'mouse', cm: '31', dist: '65', dot: '1' });
    await expect(page.getByRole('button', { name: 'Start the practice order' })).toBeVisible();
  });

  test('run form: an ID without a number needs a manual arm and list', async ({ page }) => {
    await open(page, '');
    await page.fill('input[name=pid]', 'pilot');
    await expect(page.locator('[data-assign]')).toContainText('choose the arm and list yourself');
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page).not.toHaveURL(/mode=run/);
    await page.selectOption('#run select[name=arm]', 'B');
    await page.selectOption('#run select[name=list]', 'A');
    await page.getByRole('button', { name: 'Start session' }).click();
    await page.waitForURL(/mode=run/);
    expect(new URL(page.url()).searchParams.get('arm')).toBe('B');
  });

  test('preview opens the chosen screen in a new tab', async ({ page }) => {
    await open(page, '');
    const form = page.locator('[data-preview]');
    await form.locator('select[name=arm]').selectOption('B');
    await form.locator('select[name=trial]').selectOption('L3');
    await form.locator('select[name=screen]').selectOption('cart');
    await form.locator('input[name=aoi]').check();
    const [tab] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open preview' }).click()]);
    await tab.waitForFunction(() => document.documentElement.dataset.ready === '1');
    expect(Object.fromEntries(new URL(tab.url()).searchParams)).toEqual({ mode: 'view', arm: 'B', trial: 'L3', screen: 'cart', aoi: '1' });
    await expect(tab.locator('[data-aoi="CRT_ALLIN"]')).toContainText('₹434');
    await expect(tab.locator('.aoi-box')).toHaveCount(3);
  });

  test('saved sessions: download behaviour and gaze CSVs, combined CSV, overwrite warning, delete', async ({ page }) => {
    await open(page, '');
    const row = (pid, trial) => Object.fromEntries(C.BEHAVIOUR_COLUMNS.map((c) => [c, c === 'pid' ? pid : c === 'trial_id' ? trial : '']));
    await page.evaluate(([a, b]) => {
      localStorage.setItem('quikkart_P001', JSON.stringify({ pid: 'P001', arm: 'A', list: 'A', et: 'mouse', updated: '2026-10-02T10:00:00Z', complete: true, rows: a }));
      localStorage.setItem('quikkart_P001_gaze', 'pid,arm\r\nP001,A\r\n');
      localStorage.setItem('quikkart_P002', JSON.stringify({ pid: 'P002', arm: 'B', list: 'A', et: 'none', updated: '2026-10-02T11:00:00Z', complete: false, rows: b }));
      localStorage.setItem('unrelated', 'x');
    }, [[row('P001', 'P0'), row('P001', 'S1')], [row('P002', 'P0')]]);
    await page.reload();
    await expect(page.locator('.ss tr')).toHaveCount(2);
    await expect(page.locator('.ss tr').first()).toContainText('incomplete');   // newest first

    const dl = async (sel) => {
      const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]);
      return { name: d.suggestedFilename(), text: await readDownload(d) };
    };
    const beh = await dl('[data-dl="quikkart_P001"]');
    expect(beh.name).toBe('QuikKart_P001_behaviour.csv');
    const parsed = parseCSV(beh.text);
    expect(parsed.header).toEqual(C.BEHAVIOUR_COLUMNS);
    expect(parsed.rows.map((r) => r.trial_id)).toEqual(['P0', 'S1']);
    expect((await dl('[data-gz="quikkart_P001"]')).text).toBe('pid,arm\r\nP001,A\r\n');
    expect(parseCSV((await dl('[data-all]')).text).rows).toHaveLength(3);

    await page.fill('input[name=pid]', 'P002');
    await expect(page.locator('[data-exists]')).toContainText('already saved here (1 trial)');

    page.once('dialog', (d) => d.accept());
    await page.click('[data-del="quikkart_P002"]');
    await expect(page.locator('.ss tr')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('quikkart_P002'))).toBeNull();
    await expect(page.locator('[data-exists]')).toBeHidden();
  });
});
