/**
 * Publication-ready tree sprites:
 * - Edge flood: checker + Twilight purple UI backgrounds
 * - Bottom flood: tan/cream “shelf” under dirt
 * - Global: white / off-white halos (edges + gaps between leaves)
 * - Bottom band: aggressive matte strip in lower ~32% of opaque bbox
 * - 1px erode: leftover fringe next to transparency
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PNG } = require('pngjs');

/** Authoring folder in repo — replace these PNGs, then run: node apply-user-tree-sprites.js */
const ASSETS_DIR = path.join(__dirname, 'source-images');

const MAP = [
  { name: 'SPRITE_DIRT', file: 'dirt.png' },
  { name: 'SPRITE_SPROUT', file: 'sprout.png' },
  { name: 'SPRITE_SAPLING', file: 'sapling.png' },
  { name: 'SPRITE_FULL', file: 'full-tree.png' },
];

function dist2(r, g, b, R, G, B) {
  const dr = r - R;
  const dg = g - G;
  const db = b - B;
  return dr * dr + dg * dg + db * db;
}

/** Screenshots / exports on Twilight-ish purple. */
function isTwilightPurpleBg(r, g, b) {
  const samples = [
    [140, 130, 168],
    [125, 118, 158],
    [110, 100, 145],
    [160, 150, 185],
    [180, 165, 200],
    [200, 188, 218],
    [95, 88, 125],
    [136, 126, 168],
  ];
  for (const [R, G, B] of samples) {
    if (dist2(r, g, b, R, G, B) < 52 * 52) return true;
  }
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (avg < 72 || avg > 235) return false;
  if (hi - lo > 88) return false;
  if (b < 100) return false;
  if (b + 15 < g) return false;
  if (r < 70) return false;
  return b >= r - 35 && b >= g - 25;
}

/** Gray/white checker + light neutral matte. */
function isCheckerOrLightNeutral(r, g, b) {
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  if (hi < 168) return false;
  if (hi - lo > 44) return false;
  return (r + g + b) / 3 >= 165;
}

function isEdgeSeed(r, g, b) {
  return isCheckerOrLightNeutral(r, g, b) || isTwilightPurpleBg(r, g, b);
}

/** Strong near-white (halo, gaps). */
function isNearWhite(r, g, b, a) {
  if (a < 5) return false;
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (min3(r, g, b) >= 218 && hi - lo <= 38) return true;
  if (min3(r, g, b) >= 200 && hi - lo <= 22 && avg >= 202) return true;
  if (min3(r, g, b) >= 188 && hi - lo <= 16 && avg >= 195) return true;
  return false;
}

function min3(r, g, b) {
  return Math.min(r, g, b);
}

/** Cream / tan shelf under dirt — not green, not deep brown. */
function isTanOrCreamMatte(r, g, b, a) {
  if (a < 5) return false;
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  if (g > r + 22 && g > b + 18) return false;
  if (avg < 120 || avg > 248) return false;
  if (hi - lo > 52) return false;
  if (avg < 165 && hi - lo > 38) return false;
  return true;
}

function floodFromEdges(png, matchFn) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  const n = w * h;
  const visited = new Uint8Array(n);
  const queue = [];

  function idx(x, y) {
    return y * w + x;
  }

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = idx(x, y);
    if (visited[k]) return;
    const i = k * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!matchFn(r, g, b)) return;
    visited[k] = 1;
    queue.push(k);
  }

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (queue.length) {
    const k = queue.pop();
    const x = k % w;
    const y = (k - x) / w;
    const i = k * 4;
    data[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
}

/** Tan / white connected to bottom row (under-mound shelf). */
function floodFromBottom(png) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  const n = w * h;
  const visited = new Uint8Array(n);
  const queue = [];

  function idx(x, y) {
    return y * w + x;
  }

  function seedMatch(r, g, b, a) {
    if (a < 8) return false;
    return (
      isTanOrCreamMatte(r, g, b, a) ||
      isNearWhite(r, g, b, a) ||
      isTwilightPurpleBg(r, g, b) ||
      isCheckerOrLightNeutral(r, g, b)
    );
  }

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = idx(x, y);
    if (visited[k]) return;
    const i = k * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!seedMatch(r, g, b, a)) return;
    visited[k] = 1;
    queue.push(k);
  }

  for (let x = 0; x < w; x++) {
    tryPush(x, h - 1);
    tryPush(x, h - 2);
  }

  while (queue.length) {
    const k = queue.pop();
    const x = k % w;
    const y = (k - x) / w;
    const i = k * 4;
    data[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
}

function opaqueBBox(png) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, maxX, minY, maxY };
}

/** Strip matte in lower portion of art (tan shelf even if disconnected). */
function stripBottomRegionMatte(png) {
  const box = opaqueBBox(png);
  if (!box) return;
  const bh = box.maxY - box.minY + 1;
  const yCut = box.minY + Math.floor(bh * 0.68);
  const w = png.width;
  const data = png.data;
  for (let y = yCut; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 8) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isTanOrCreamMatte(r, g, b, a) || isNearWhite(r, g, b, a)) {
        data[i + 3] = 0;
      }
    }
  }
}

function globalWhiteAndTanPass(png) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 5) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isNearWhite(r, g, b, a)) {
        data[i + 3] = 0;
        continue;
      }
      const hi = Math.max(r, g, b);
      const lo = min3(r, g, b);
      const avg = (r + g + b) / 3;
      if (
        g <= r + 18 &&
        min3(r, g, b) >= 178 &&
        hi - lo <= 30 &&
        avg >= 182 &&
        avg <= 238
      ) {
        data[i + 3] = 0;
      }
    }
  }
}

/** Remove 1px halos: opaque pixel touches transparency and looks like fringe. */
function erodeFringeOnce(png) {
  const w = png.width;
  const h = png.height;
  const data = png.data;
  const kill = new Uint8Array(w * h);
  const neigh = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const i = k * 4;
      if (data[i + 3] < 10) continue;
      let touchesClear = false;
      for (const [dx, dy] of neigh) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          touchesClear = true;
          break;
        }
        if (data[(ny * w + nx) * 4 + 3] < 14) {
          touchesClear = true;
          break;
        }
      }
      if (!touchesClear) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const hi = Math.max(r, g, b);
      const lo = min3(r, g, b);
      const avg = (r + g + b) / 3;
      if (g > r + 28 && g > b + 22) continue;
      if (min3(r, g, b) >= 168 && hi - lo <= 42 && avg >= 165) {
        kill[k] = 1;
      }
    }
  }
  for (let k = 0; k < kill.length; k++) {
    if (kill[k]) data[k * 4 + 3] = 0;
  }
}

function processPng(png) {
  floodFromEdges(png, isEdgeSeed);
  floodFromBottom(png);
  globalWhiteAndTanPass(png);
  stripBottomRegionMatte(png);
  globalWhiteAndTanPass(png);
  /* One pass only — double erode ate anti-aliasing and looked blurry when scaled */
  erodeFringeOnce(png);
  return png;
}

/** Some exports append extra bytes after IEND — pngjs rejects those. */
function truncatePngToValidIend(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24 || buf[0] !== 0x89) return buf;
  let o = 8;
  while (o + 12 <= buf.length) {
    const len = buf.readUInt32BE(o);
    if (len < 0 || len > 0x7fffffff) return buf;
    const type = buf.toString('ascii', o + 4, o + 8);
    const next = o + 12 + len;
    if (next > buf.length) return buf;
    if (type === 'IEND') return buf.slice(0, next);
    o = next;
  }
  return buf;
}

async function processFile(absPath) {
  let buf = fs.readFileSync(absPath);
  /* Cursor sometimes saves JPEG data with a .png name */
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    buf = await sharp(buf)
      .ensureAlpha()
      .resize({
        width: 340,
        height: 340,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  }
  buf = truncatePngToValidIend(buf);
  const png = PNG.sync.read(buf);
  processPng(png);
  return PNG.sync.write(png);
}

async function main() {
  const htmlPath = path.join(__dirname, 'stage5.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  for (const { name, file } of MAP) {
    const abs = path.join(ASSETS_DIR, file);
    if (!fs.existsSync(abs)) {
      console.error('Missing file:', abs);
      process.exit(1);
    }
    const outBuf = await processFile(abs);
    const b64 = outBuf.toString('base64');
    const re = new RegExp(
      'const ' + name + ' = "data:image/png;base64,[^"]+"'
    );
    if (!re.test(html)) {
      console.error('Could not find in HTML:', name);
      process.exit(1);
    }
    html = html.replace(re, `const ${name} = "data:image/png;base64,${b64}"`);
    console.log(name, '→', outBuf.length, 'bytes');
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Updated', htmlPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
