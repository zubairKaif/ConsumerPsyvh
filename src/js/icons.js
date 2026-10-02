/* Inline SVG icons and generic product art (no real brands). */
'use strict';

/** Mixes a #rrggbb colour toward black (f < 0) or white (f > 0). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  const ch = (v) => Math.round((t - v) * p + v);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const svg = (w, h, vb, body, extra) =>
  `<svg width="${w}" height="${h}" viewBox="${vb}" aria-hidden="true" focusable="false"${extra || ''}>${body}</svg>`;

const ICON = {
  back: svg(24, 24, '0 0 24 24', '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" fill="currentColor"/>'),
  chevron: svg(16, 16, '0 0 16 16', '<path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  chevronDown: svg(14, 14, '0 0 16 16', '<path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  search: svg(20, 20, '0 0 24 24', '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  pin: svg(14, 14, '0 0 24 24', '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/>'),
  person: svg(22, 22, '0 0 24 24', '<circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 20c.8-3.8 4-6 8-6s7.2 2.2 8 6" fill="currentColor"/>'),
  info: svg(14, 14, '0 0 16 16', '<circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.3" y="6.9" width="1.4" height="4.7" rx=".7" fill="currentColor"/><circle cx="8" cy="4.8" r=".95" fill="currentColor"/>'),
  infoFill: svg(18, 18, '0 0 16 16', '<circle cx="8" cy="8" r="7" fill="currentColor"/><rect x="7.25" y="6.8" width="1.5" height="4.8" rx=".75" fill="#fff"/><circle cx="8" cy="4.7" r="1" fill="#fff"/>'),
  tag: svg(18, 18, '0 0 24 24', '<path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.8 8.8a1.5 1.5 0 0 1 0 2.1l-7.1 7.1a1.5 1.5 0 0 1-2.1 0z" fill="currentColor"/><circle cx="7.6" cy="7.6" r="1.7" fill="#fff"/>'),
  bolt: svg(20, 20, '0 0 24 24', '<path d="M13.5 2 5 13.2h5.6L9.8 22l9.2-12.4h-6z" fill="currentColor"/>'),
  check: svg(16, 16, '0 0 16 16', '<circle cx="8" cy="8" r="7.2" fill="currentColor"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
  wallet: svg(22, 22, '0 0 24 24', '<rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 9.5h18" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="12.2" width="4" height="3" rx="1" fill="currentColor"/>'),
  cart: svg(22, 22, '0 0 24 24', '<path d="M3 4h2.2l2.3 10.4a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.4-1.1L21 8H6.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19.5" r="1.6" fill="currentColor"/><circle cx="17" cy="19.5" r="1.6" fill="currentColor"/>'),
  receipt: svg(18, 18, '0 0 24 24', '<path d="M6 2.5h12a1 1 0 0 1 1 1V21l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21V3.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 8h7M8.5 12h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
  signal: svg(17, 12, '0 0 17 12', '<rect x="0" y="8" width="3" height="4" rx=".7" fill="currentColor"/><rect x="4.6" y="5.5" width="3" height="6.5" rx=".7" fill="currentColor"/><rect x="9.2" y="3" width="3" height="9" rx=".7" fill="currentColor"/><rect x="13.8" y="0" width="3" height="12" rx=".7" fill="currentColor"/>'),
  wifi: svg(16, 12, '0 0 16 12', '<path d="M8 12 5.6 9.3a3.4 3.4 0 0 1 4.8 0z" fill="currentColor"/><path d="M3.4 7.1a6.5 6.5 0 0 1 9.2 0M1 4.6a9.9 9.9 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
  battery: svg(24, 12, '0 0 24 12', '<rect x=".75" y=".75" width="20" height="10.5" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/><rect x="2.6" y="2.6" width="13.6" height="6.8" rx="1.3" fill="currentColor"/><path d="M22.4 4.1v3.8c.9-.3 1.4-1 1.4-1.9s-.5-1.6-1.4-1.9z" fill="currentColor" opacity=".55"/>'),
};

/* ---------- product art: one simple shape per product type, drawn in the product colour ---------- */

const SHAPES = {
  carton: (c, d, l) =>
    `<path d="M20 22.5 26 11h12l6 11.5z" fill="${l}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="25" y="6.5" width="14" height="5" rx="1" fill="${c}" stroke="${d}" stroke-width="1.3"/>` +
    `<rect x="20" y="22.5" width="24" height="35" rx="2" fill="${c}" stroke="${d}" stroke-width="1.3"/>` +
    `<rect x="23.5" y="31" width="17" height="15.5" rx="2.5" fill="#fff" fill-opacity=".92"/>` +
    `<circle cx="32" cy="38.7" r="4.2" fill="${c}"/>`,
  bag: (c, d) =>
    `<path d="M18.5 14h27l-1 3.5c2.6 10 3 26.5 1.2 36.4-.4 2.2-2.2 3.6-4.4 3.6H22.7c-2.2 0-4-1.4-4.4-3.6-1.8-9.9-1.4-26.4 1.2-36.4z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M18.5 8.5h27V14h-27z" fill="${d}" fill-opacity=".55"/>` +
    `<path d="M18.5 8.5l1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8 1.7-1.8 1.7 1.8" fill="none" stroke="${d}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<ellipse cx="32" cy="35.5" rx="10.5" ry="9" fill="#fff" fill-opacity=".92"/>` +
    `<ellipse cx="32" cy="35.5" rx="5" ry="4.2" fill="${c}"/>`,
  bottle: (c, d) =>
    `<rect x="27" y="5.5" width="10" height="6.5" rx="1.6" fill="${d}"/>` +
    `<path d="M28.5 12h7v4.6c0 2.2 6.5 3.8 6.5 9V54c0 2.2-1.8 4-4 4H26c-2.2 0-4-1.8-4-4V25.6c0-5.2 6.5-6.8 6.5-9z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="22" y="32.5" width="20" height="14" fill="#fff" fill-opacity=".92"/>` +
    `<rect x="25.5" y="36.7" width="13" height="5.6" rx="1.6" fill="${c}"/>` +
    `<path d="M25.6 25v5" stroke="#fff" stroke-opacity=".45" stroke-width="2.2" stroke-linecap="round"/>`,
  tub: (c, d) =>
    `<rect x="14.5" y="16.5" width="35" height="7.5" rx="2.6" fill="${d}"/>` +
    `<path d="M17 24h30l-3.4 30c-.2 1.8-1.7 3.2-3.5 3.2H23.9c-1.8 0-3.3-1.4-3.5-3.2z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M19.4 32.5h25.2l-1.3 11.6H20.7z" fill="#fff" fill-opacity=".92"/>` +
    `<ellipse cx="32" cy="38.3" rx="5.4" ry="3.2" fill="${c}"/>`,
  round: (c, d) =>
    `<circle cx="32" cy="37" r="19" fill="${c}" stroke="${d}" stroke-width="1.3"/>` +
    `<path d="M32 18.5c0-3 .8-5.2 2.6-6.6" fill="none" stroke="${shade(d, -0.3)}" stroke-width="2.3" stroke-linecap="round"/>` +
    `<path d="M33.6 15.6c3.2-4.4 8.6-4.6 11-2.2-3 3.4-7.6 4.4-11 2.2z" fill="#4C9A4A"/>` +
    `<ellipse cx="24.6" cy="29.6" rx="5.4" ry="3.4" fill="#fff" fill-opacity=".38" transform="rotate(-38 24.6 29.6)"/>`,
  box: (c, d, l) =>
    `<path d="M14 22.5 22 14.5h28l-8 8z" fill="${l}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M42 22.5l8-8v34l-8 8z" fill="${shade(c, -0.22)}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="14" y="22.5" width="28" height="34" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="17.5" y="31" width="21" height="15.5" rx="2" fill="#fff" fill-opacity=".92"/>` +
    `<rect x="21" y="35.8" width="14" height="6" rx="1.6" fill="${c}"/>`,
  sack: (c, d) =>
    `<path d="M24.5 16.5c-1.4-3.4.4-7 3.2-7h8.6c2.8 0 4.6 3.6 3.2 7z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M22.5 19.5c-8.4 6-10.6 18-9.6 28 .6 6.2 5.2 10 11.2 10h15.8c6 0 10.6-3.8 11.2-10 1-10-1.2-22-9.6-28z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="22" y="15.6" width="20" height="5" rx="2.2" fill="${d}"/>` +
    `<rect x="19" y="32" width="26" height="15.5" rx="2.2" fill="#fff" fill-opacity=".92"/>` +
    `<rect x="23" y="36.8" width="18" height="6" rx="1.6" fill="${c}"/>`,
  tube: (c, d) =>
    `<rect x="18.5" y="7" width="27" height="6.5" rx="1.2" fill="${d}"/>` +
    `<path d="M18.5 13.5h27l-5.2 34.5H23.7z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="25.5" y="48" width="13" height="9.5" rx="2.2" fill="#fff" stroke="${d}" stroke-width="1.3"/>` +
    `<path d="M22.2 23h19.6l-1.5 11.5H23.7z" fill="#fff" fill-opacity=".92"/>` +
    `<path d="M26 27.3h12" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`,
  eggs: (c, d) => {
    const tray = shade(c, -0.3);
    const egg = (x, y, s) => `<ellipse cx="${x}" cy="${y}" rx="${6.6 * s}" ry="${8.4 * s}" fill="${c}" stroke="${d}" stroke-width="1.2"/>`;
    return egg(20, 27, 0.92) + egg(32, 26, 0.92) + egg(44, 27, 0.92) +
      `<path d="M9 34.5h46l-4.2 20.5c-.3 1.6-1.7 2.7-3.3 2.7H16.5c-1.6 0-3-1.1-3.3-2.7z" fill="${tray}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
      egg(19, 36, 1) + egg(32, 35.5, 1) + egg(45, 36, 1) +
      `<path d="M9 43.5c3.3 3.5 7 3.5 10 0 3 3.5 7 3.5 10 0 3 3.5 7 3.5 10 0 3 3.5 7 3.5 10 0 2.4 2.6 4.8 3.3 6 2" fill="${tray}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M10 44h44l-3.2 11c-.3 1.6-1.7 2.7-3.3 2.7H16.5c-1.6 0-3-1.1-3.3-2.7z" fill="${tray}"/>`;
  },
  bunch: (c, d) => {
    const banana = (rot) =>
      `<path d="M17 18.5c1.2 18 13.4 30.6 32.6 29.2 2.2-.2 2.6-2.8.5-3.5C35 40 25.6 31 22.8 17.4c-.5-2.4-6-2.2-5.8 1.1z" fill="${c}" stroke="${d}" stroke-width="1.3" stroke-linejoin="round" transform="rotate(${rot} 19 17)"/>`;
    return banana(-14) + banana(4) + banana(22) +
      `<path d="M19.6 16.8l-2.8-6.6" stroke="#7A6230" stroke-width="3.4" stroke-linecap="round"/>`;
  },
};

/** Product picture as an inline SVG of the given pixel size. */
function productArt(key, size) {
  const p = PRODUCTS[key];
  const d = shade(p.c, -0.42), l = shade(p.c, 0.32);
  return svg(size, size, '0 0 64 64', SHAPES[p.shape](p.c, d, l), ' class="art"');
}
