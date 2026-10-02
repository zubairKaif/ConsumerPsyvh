/* HTML builders for the four phone screens. Every AOI carries data-aoi; click zones carry data-click="1".
 * The bill builder takes only the cart (and the suggested product), never the arm, so the bill is
 * identical in both arms by construction. */
'use strict';

const itemsLabel = (n) => n + (n === 1 ? ' item' : ' items');

function statusBar(theme) {
  return `<div class="sb sb-${theme}"><span class="sb-time">10:42</span><span class="sb-icons">${ICON.signal}${ICON.wifi}${ICON.battery}</span></div>`;
}

function appBar(title) {
  return `<div class="appbar"><span class="appbar-back">${ICON.back}</span><h1>${title}</h1></div>`;
}

function thumb(key, size, art) {
  return `<div class="thumb" style="width:${size}px;height:${size}px;background:${PRODUCTS[key].bg}">${productArt(key, art)}</div>`;
}

function priceHTML(price, mrp) {
  return `<b>${rupees(price)}</b>` + (mrp > price ? `<s>${rupees(mrp)}</s>` : '');
}

/** "− n +" stepper. With a key it is live (edit screen); without, it is display-only. */
function stepperHTML(qty, key) {
  if (!key) return `<div class="stepper"><span class="st-b">−</span><span class="st-n">${qty}</span><span class="st-b">+</span></div>`;
  return `<div class="stepper"><span class="st-b" data-act="dec" data-key="${key}">−</span><span class="st-n">${qty}</span>` +
    `<span class="st-b${qty >= 9 ? ' is-off' : ''}" data-act="inc" data-key="${key}">+</span></div>`;
}

function addHTML(key) {
  return key ? `<div class="addbtn" data-act="inc" data-key="${key}">ADD</div>` : '<div class="addbtn">ADD</div>';
}

function feeBannerText() {
  return `Every order: handling fee ${rupees(FEES.handling)} and platform fee ${rupees(FEES.platform)}. ` +
    `Delivery fee ${rupees(FEES.delivery)} below ${rupees(FEES.deliveryFreeAbove)}. ` +
    `Small cart fee ${rupees(FEES.smallCart)} below ${rupees(FEES.smallCartBelow)}.`;
}

/** Floating cart bar used on the listing and edit screens, in the arm's price format. */
function cartBar(arm, pr, aoi, act, label) {
  const empty = pr.count === 0;
  const amount = arm === 'B' ? `${rupees(pr.T)} <span class="cb-incl">incl. all fees</span>` : rupees(pr.B);
  return `<div class="cartbar${empty ? ' is-off' : ''}" data-aoi="${aoi}" data-click="1" data-act="${act}">` +
    `<div class="cb-l"><span class="cb-ico">${ICON.cart}</span><span class="cb-txt">` +
    (empty ? '<span class="cb-n">Your cart is empty</span><span class="cb-amt">Add an item to continue</span>'
      : `<span class="cb-n">${itemsLabel(pr.count)}</span><span class="cb-amt">${amount}</span>`) +
    `</span></div><div class="cb-r">${label}${ICON.chevron}</div></div>`;
}

/* ---------- 1. Listing ---------- */

function tileHTML(key, qty) {
  const p = PRODUCTS[key];
  return `<div class="tile"><div class="tile-img" style="background:${p.bg}">${productArt(key, 58)}</div>` +
    `<div class="tile-name">${p.name}</div><div class="tile-size">${p.size}</div>` +
    `<div class="tile-foot"><div class="price">${priceHTML(p.price, p.mrp)}</div>${qty > 0 ? stepperHTML(qty) : addHTML()}</div></div>`;
}

function listingScreen(arm, trialId, cart) {
  const pr = priceCart(cart);
  const tiles = listingTiles(trialId).map((t) => tileHTML(t.key, cart[t.key] || 0)).join('');
  return `<div class="scr scr-listing">
  <div class="lst-head">${statusBar('brand')}
    <div class="lst-top">
      <div><div class="lst-kicker">QuikKart delivers in</div><div class="lst-eta">9 minutes</div>
        <div class="lst-addr">${ICON.pin}<span>Home – Hostel 12, Powai, Mumbai</span>${ICON.chevronDown}</div></div>
      <div class="lst-avatar">${ICON.person}</div>
    </div>
    <div class="lst-search">${ICON.search}<span>Search for atta, dal, milk and more</span></div>
  </div>
  ${arm === 'B' ? `<div class="feeban" data-aoi="LST_FEEBAN"><span class="feeban-ico">${ICON.infoFill}</span><p>${feeBannerText()}</p></div>` : ''}
  <h2 class="lst-title">Your usual picks</h2>
  <div class="grid" data-aoi="LST_TILES">${tiles}</div>
  ${cartBar(arm, pr, 'LST_CARTBAR', 'toCart', 'View cart')}
</div>`;
}

/* ---------- 2. Cart ("Checkout") ---------- */

function deliveryValue(pr) {
  return pr.deliveryFree ? `<s>${rupees(FEES.delivery)}</s><span class="free">FREE</span>` : rupees(pr.delivery);
}

function cartScreen(arm, cart) {
  const pr = priceCart(cart);
  const rows = pr.items.map((it) => {
    const p = PRODUCTS[it.key];
    return `<div class="crow">${thumb(it.key, 52, 42)}<div class="crow-mid"><div class="crow-name">${p.name}</div>` +
      `<div class="crow-size">${p.size}</div><div class="price">${priceHTML(it.line, it.mrpLine)}</div></div>${stepperHTML(it.qty)}</div>`;
  }).join('');
  const line = (label, value) => `<div class="al"><span>${label}</span><span>${value}</span></div>`;
  const totals = arm === 'B'
    ? `<div class="card allin" data-aoi="CRT_ALLIN">
    <div class="allin-top"><div><div class="allin-t">Total to pay</div><div class="allin-s">Includes all fees</div></div><div class="allin-v">${rupees(pr.T)}</div></div>
    <div class="allin-lines">${line('Item total', rupees(pr.B))}${line('Delivery fee', deliveryValue(pr))}${line('Handling fee', rupees(pr.handling))}` +
      `${pr.smallCart ? line('Small cart fee', rupees(pr.smallCart)) : ''}${line('Platform fee', rupees(pr.platform))}</div>
  </div>`
    : `<div class="card sub" data-aoi="CRT_SUB"><span>Item total</span><b>${rupees(pr.B)}</b></div>`;
  return `<div class="scr scr-light">${statusBar('light')}${appBar('Checkout')}
  <div class="body">
    <div class="card deliv"><span class="deliv-ico">${ICON.bolt}</span><div><div class="deliv-t">Delivery in 9 minutes</div><div class="deliv-s">Shipment of ${itemsLabel(pr.count)}</div></div></div>
    <div class="card items" data-aoi="CRT_ITEMS">${rows}</div>
    ${totals}
    <p class="policy"><b>Cancellation policy:</b> orders cannot be cancelled once packed for delivery. Refunds for missing or damaged items go back to the original payment method.</p>
  </div>
  <div class="paybar" data-aoi="CRT_PAYBAR" data-click="1" data-act="toBill">
    <div class="pb-amt"><div class="pb-v">${rupees(arm === 'B' ? pr.T : pr.B)}</div><div class="pb-k">${arm === 'B' ? 'TOTAL INCL. FEES' : 'ITEM TOTAL'}</div></div>
    <div class="pb-btn">Proceed to pay${ICON.chevron}</div>
  </div>
</div>`;
}

/* ---------- 3. Bill ("Bill summary"), identical in both arms ---------- */

function billScreen(cart, suggest) {
  const pr = priceCart(cart);
  const fee = (aoi, label, amount, value) =>
    `<div class="brow" data-aoi="${aoi}" data-fee="${amount}"><span class="bl">${label}<span class="ii">${ICON.info}</span></span><span class="bv">${value}</span></div>`;
  const s = PRODUCTS[suggest];
  const nudge = pr.B < FEES.deliveryFreeAbove
    ? `<div class="card nudge" data-aoi="BIL_NUDGE">${thumb(suggest, 44, 36)}<div><div class="nudge-t">Add ${rupees(FEES.deliveryFreeAbove - pr.B)} more to get free delivery</div>` +
      `<div class="nudge-s">Try ${s.name} (${s.size}) for ${rupees(s.price)}</div></div></div>`
    : '';
  return `<div class="scr scr-light">${statusBar('light')}${appBar('Bill summary')}
  <div class="body">
    <div class="savebar" data-aoi="BIL_SAVE">${ICON.tag}<span>You saved <b>${rupees(pr.savings)}</b> on this order</span></div>
    <div class="card bill">
      <div class="bill-title">${ICON.receipt}<span>Bill details</span></div>
      <div class="brow" data-aoi="BIL_BASE"><span class="bl">Item total</span><span class="bv">${pr.mrpTotal > pr.B ? `<s>${rupees(pr.mrpTotal)}</s>` : ''}${rupees(pr.B)}</span></div>
      ${fee('BIL_DEL', 'Delivery fee', pr.delivery, deliveryValue(pr))}
      ${fee('BIL_HND', 'Handling fee', pr.handling, rupees(pr.handling))}
      ${pr.smallCart ? fee('BIL_SCF', 'Small cart fee', pr.smallCart, rupees(pr.smallCart)) : ''}
      ${fee('BIL_PLT', 'Platform fee', pr.platform, rupees(pr.platform))}
      <div class="btot" data-aoi="BIL_TOT"><span>To pay</span><b>${rupees(pr.T)}</b></div>
    </div>
    ${nudge}
    <div class="card upi"><span class="upi-ico">${ICON.wallet}</span><div class="upi-t">Pay using UPI<div class="upi-s">Linked bank account</div></div><span class="upi-chg">Change</span></div>
  </div>
  <div class="decide" data-aoi="BIL_BTN">
    <div class="btn-order" data-aoi="BTN_ORDER" data-click="1" data-act="order">
      <div class="bo-l"><div class="bo-v">${rupees(pr.T)}</div><div class="bo-k">TOTAL</div></div><div class="bo-r">Place order${ICON.chevron}</div>
    </div>
    <div class="btn-row">
      <div class="btn btn-add" data-aoi="BTN_ADD" data-click="1" data-act="add">Add more items</div>
      <div class="btn btn-exit" data-aoi="BTN_EXIT" data-click="1" data-act="exit">Leave checkout</div>
    </div>
  </div>
</div>`;
}

/* ---------- 4. Edit ("Add items"), reached only via Add more items ---------- */

function editScreen(arm, trialId, cart) {
  const pr = priceCart(cart);
  const toGo = FEES.deliveryFreeAbove - pr.B;
  const pct = Math.min(100, Math.round((100 * pr.B) / FEES.deliveryFreeAbove));
  const progress = toGo > 0
    ? `<div class="prog-t"><b>Add ${rupees(toGo)} more</b> for free delivery</div>`
    : `<div class="prog-t prog-ok">${ICON.check}<b>Free delivery unlocked</b></div>`;
  const rows = editKeys(trialId).map((key) => {
    const p = PRODUCTS[key], qty = cart[key] || 0;
    return `<div class="erow">${thumb(key, 48, 40)}<div class="erow-mid"><div class="erow-name">${p.name}</div>` +
      `<div class="erow-sub"><span>${p.size}</span><span class="price">${priceHTML(p.price, p.mrp)}</span></div></div>` +
      `${qty > 0 ? stepperHTML(qty, key) : addHTML(key)}</div>`;
  }).join('');
  return `<div class="scr scr-light">${statusBar('light')}${appBar('Add items')}
  <div class="body">
    <div class="card prog">${progress}<div class="bar${toGo > 0 ? '' : ' bar-ok'}"><i style="width:${pct}%"></i></div></div>
    <div class="card elist" data-aoi="EDT_LIST">${rows}</div>
  </div>
  ${cartBar(arm, pr, 'EDT_CARTBAR', 'viewBill', 'View bill')}
</div>`;
}

/** Shown inside the phone when a view-mode preview reaches a final decision. */
function previewEndScreen(decision) {
  return `<div class="scr scr-light">${statusBar('light')}<div class="preview-end"><div class="pe-k">Preview ended</div>` +
    `<div class="pe-v">Decision: ${decision}</div><div class="pe-btn" data-act="restart">Start again</div></div></div>`;
}
