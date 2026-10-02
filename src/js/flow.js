/* One trial's checkout: listing -> cart -> bill, then optionally edit -> bill loops until the
 * participant places the order or leaves. Used by view mode and run mode. */
'use strict';

const DECISION = { order: 'Place order', add: 'Add item', exit: 'Exit' };

/**
 * opts: { arm, trialId, start: 'listing'|'cart'|'bill'|'edit',
 *         hooks: { screen(label, kind, cart), refresh(cart), decision(choice, label, event),
 *                  editClick(key, delta, cart), done({ decision, cart }) } }
 * Screen labels: listing, cart, bill, then edit1, bill2, edit2, bill3, ...
 */
function TrialFlow(opts) {
  const arm = opts.arm, trialId = opts.trialId, hooks = opts.hooks || {};
  const keys = editKeys(trialId);
  const cart = initialCart(trialId);
  let kind = null, bills = 0, edits = 0, finished = false;

  function render() {
    if (kind === 'listing') return listingScreen(arm, trialId, cart);
    if (kind === 'cart') return cartScreen(arm, cart);
    if (kind === 'bill') return billScreen(cart, suggestKey(trialId));
    return editScreen(arm, trialId, cart);
  }

  function go(next) {
    kind = next;
    let label = next;
    if (next === 'bill') label = ++bills === 1 ? 'bill' : 'bill' + bills;
    if (next === 'edit') label = 'edit' + (++edits);
    Phone.show(render(), onAction);
    if (hooks.screen) hooks.screen(label, kind, cart);
  }

  /** Keeps the cart in edit-list order so rows and CSV changes are stable. */
  function setQty(key, qty) {
    const next = {};
    for (const k of keys) {
      const q = k === key ? qty : (cart[k] || 0);
      if (q > 0) next[k] = q;
    }
    for (const k of Object.keys(cart)) delete cart[k];
    Object.assign(cart, next);
  }

  function onAction(act, el, ev) {
    if (finished) return;
    if (act === 'toCart' && kind === 'listing') return go('cart');
    if (act === 'toBill' && kind === 'cart') return go('bill');
    if (kind === 'bill' && DECISION[act]) {
      if (hooks.decision) hooks.decision(DECISION[act], bills === 1 ? 'bill' : 'bill' + bills, ev);
      if (act === 'add') return go('edit');
      finished = true;
      if (hooks.done) hooks.done({ decision: DECISION[act], cart: Object.assign({}, cart) });
      return;
    }
    if (kind === 'edit' && (act === 'inc' || act === 'dec')) {
      const key = el.dataset.key, q = cart[key] || 0;
      const nq = act === 'inc' ? Math.min(9, q + 1) : Math.max(0, q - 1);
      if (nq === q) return;
      setQty(key, nq);
      Phone.update(render());
      if (hooks.editClick) hooks.editClick(key, nq - q, cart);
      if (hooks.refresh) hooks.refresh(cart);
      return;
    }
    if (act === 'viewBill' && kind === 'edit' && priceCart(cart).count > 0) return go('bill');
  }

  return {
    start() { go(opts.start || 'listing'); },
    cart: () => Object.assign({}, cart),
  };
}
