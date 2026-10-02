/* Minimal ZIP writer (no dependencies). Entries are marked as made on Unix so that file modes survive:
 * Start_QuikKart_Mac.command stays executable after unzipping on a Mac. Deflates when it helps, else stores. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Lists files under dir (sorted, forward slashes), with their Unix modes. */
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? base + '/' + e.name : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push({ rel: rel + '/', abs, dir: true }, ...walk(abs, rel));
    else out.push({ rel, abs, dir: false, mode: fs.statSync(abs).mode & 0o777 });
  }
  return out;
}

/** Zips the contents of srcDir into zipFile, under the folder name `root`. */
function zipDir(srcDir, zipFile, root, options) {
  const opts = Object.assign({ exclude: () => false, modeFor: () => null }, options);
  const { time, date } = dosDateTime(new Date());
  const locals = [], central = [];
  let offset = 0;
  const entries = [{ rel: root + '/', dir: true }].concat(
    walk(srcDir).filter((e) => !opts.exclude(e.rel)).map((e) => Object.assign(e, { rel: root + '/' + e.rel })));
  for (const e of entries) {
    const name = Buffer.from(e.rel, 'utf8');
    let data = Buffer.alloc(0), method = 0, crc = 0, size = 0;
    if (!e.dir) {
      const raw = fs.readFileSync(e.abs);
      crc = crc32(raw); size = raw.length;
      const deflated = zlib.deflateRawSync(raw, { level: 9 });
      if (deflated.length < raw.length) { data = deflated; method = 8; } else data = raw;
    }
    const mode = e.dir ? 0o40755 : 0o100000 | (opts.modeFor(e.rel) || (e.mode & 0o111 ? 0o755 : 0o644));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE((3 << 8) | 20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(method, 10); cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32); cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36); cen.writeUInt32LE(((mode << 16) | (e.dir ? 0x10 : 0)) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    central.push(cen, name);
    offset += local.length + name.length + data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  if (entries.length > 0xFFFF || offset + cdSize > 0xFFFFFFFF) throw new Error('Pack too large for a plain ZIP');
  fs.writeFileSync(zipFile, Buffer.concat(locals.concat(central, [end])));
  return entries.length;
}

/** Reads a ZIP's central directory: [{ name, mode, method, size }]. Used by the tests. */
function listZip(zipFile) {
  const buf = fs.readFileSync(zipFile);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    out.push({
      name: buf.toString('utf8', p + 46, p + 46 + nameLen), method: buf.readUInt16LE(p + 10),
      size: buf.readUInt32LE(p + 24), mode: (buf.readUInt32LE(p + 38) >>> 16) & 0o777, madeBy: buf.readUInt16LE(p + 4) >> 8,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

module.exports = { zipDir, listZip, crc32 };
