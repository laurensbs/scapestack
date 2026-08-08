// Which boss renders can actually be seen on the Journal ground.
//
// Measured 2026-08-08 in a real browser: the homepage showed "Today's boss ·
// Phantom Muspah" over an empty rectangle. The PNG had loaded (520x523, 47%
// non-transparent) and no CSS was dimming it — the render is simply dark grey
// on a #1C1811 ground. Running the numbers over all 76 committed sprites:
// 52 of them, 69%, sit under 3:1 against the ground, and Abyssal Sire measures
// 1.00:1 — the same luminance as the background, pixel for pixel invisible.
//
// So the day-seeded rotation had a two-in-three chance of showing nothing.
// This script writes the measurement to data/boss-contrast.json so the
// rotation can pick from renders that read, and so a test can fail when a new
// sprite would go invisible. It is a build input, not a runtime cost.
//
// Run: npm run build:boss-contrast

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const SPRITE_DIR = "public/sprites/bosses";
const OUT = "data/boss-contrast.json";

/** The Journal ground the sprite is composited onto. */
const GROUND = [0x1c, 0x18, 0x11];

/** WCAG-style relative luminance. Not for text here — for "can I see a shape". */
function channelToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(r, g, b) {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function ratio(a, b) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const GROUND_LUMINANCE = luminance(...GROUND);

/**
 * A minimal PNG decoder — no dependency for a build script that runs on 76
 * committed files. Handles 8-bit greyscale/RGB/palette/alpha, which is every
 * sprite in the directory.
 */
function decodePng(bytes) {
  let offset = 8;
  let width = 0, height = 0, depth = 0, colourType = 0;
  let palette = null, transparency = null;
  const chunks = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const tag = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (tag === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colourType = data[9];
    } else if (tag === "IDAT") chunks.push(data);
    else if (tag === "PLTE") palette = data;
    else if (tag === "tRNS") transparency = data;
    else if (tag === "IEND") break;
    offset += 12 + length;
  }
  if (depth !== 8) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType];
  if (!channels) return null;

  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let read = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    const row = Buffer.from(raw.subarray(read, read + stride));
    read += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        row[i] = (row[i] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
    }
    row.copy(pixels, y * stride);
    previous = row;
  }
  return { width, height, colourType, channels, pixels, palette, transparency };
}

export function measureSprite(bytes) {
  const image = decodePng(bytes);
  if (!image) return null;
  const { width, height, colourType, channels, pixels, palette, transparency } = image;
  const step = Math.max(1, Math.floor((width * height) / 20_000));
  let opaque = 0, sum = 0, lost = 0, sampled = 0;
  for (let i = 0; i < width * height; i += step) {
    const at = i * channels;
    if (at + channels > pixels.length) break;
    let r, g, b, a;
    if (colourType === 6) [r, g, b, a] = [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]];
    else if (colourType === 2) [r, g, b, a] = [pixels[at], pixels[at + 1], pixels[at + 2], 255];
    else if (colourType === 4) [r, g, b, a] = [pixels[at], pixels[at], pixels[at], pixels[at + 1]];
    else if (colourType === 3) {
      const index = pixels[at];
      if (!palette || index * 3 + 2 >= palette.length) continue;
      [r, g, b] = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
      a = transparency && index < transparency.length ? transparency[index] : 255;
    } else [r, g, b, a] = [pixels[at], pixels[at], pixels[at], 255];
    sampled += 1;
    if (a <= 40) continue;
    opaque += 1;
    const l = luminance(r, g, b);
    sum += l;
    if (ratio(l, GROUND_LUMINANCE) < 3) lost += 1;
  }
  if (!opaque || !sampled) return null;
  return {
    contrast: Number(ratio(sum / opaque, GROUND_LUMINANCE).toFixed(2)),
    // Share of the visible silhouette that disappears into the ground. A boss
    // can average acceptably and still be mostly a dark mass.
    lostShare: Number((lost / opaque).toFixed(2)),
    coverage: Number((opaque / sampled).toFixed(2))
  };
}

/**
 * The homepage subject is NOT one of the committed sprites — it is one of the
 * twelve curated wiki renders in src/lib/homepage-boss-renders.ts, proxied
 * through /api/sprite/boss/[slug]. Those are the ones a visitor actually sees,
 * so those are the ones that have to be measured. (Measured 2026-08-08: nine
 * of the twelve sat under 3:1, so three days out of four the homepage's
 * subject was an empty rectangle.)
 */
async function measureHomepageRenders() {
  const source = readFileSync("src/lib/homepage-boss-renders.ts", "utf8");
  const entries = [...source.matchAll(/slug:\s*"([^"]+)"[\s\S]{0,200}?originalUrl:\s*"([^"]+)"/g)];
  const renders = {};
  for (const [, slug, url] of entries) {
    const response = await fetch(url, {
      headers: { "user-agent": "scapestack/0.6 (+https://www.scapestack.org)" }
    }).catch(() => null);
    if (!response?.ok) {
      console.warn(`  ! ${slug}: could not fetch the render — leaving it unmeasured`);
      continue;
    }
    const measured = measureSprite(Buffer.from(await response.arrayBuffer()));
    if (measured) renders[slug] = measured;
  }
  return renders;
}

async function main() {
  const files = readdirSync(SPRITE_DIR).filter((f) => f.endsWith(".png")).sort();
  const bosses = {};
  for (const file of files) {
    const result = measureSprite(readFileSync(join(SPRITE_DIR, file)));
    if (result) bosses[file.replace(/\.png$/, "")] = result;
  }
  const homepage = await measureHomepageRenders();
  const dark = Object.entries(homepage).filter(([, m]) => m.contrast < 3);
  writeFileSync(OUT, `${JSON.stringify({
    ground: "#1C1811",
    note: "contrast is the sprite's mean luminance against the ground; lostShare is the fraction of visible pixels under 3:1. `homepage` covers the twelve curated wiki renders the front page rotates through — those are what a visitor sees.",
    homepage,
    bosses
  }, null, 2)}\n`);
  console.log(`Measured ${Object.keys(bosses).length} committed sprites and ${Object.keys(homepage).length} homepage renders`);
  console.log(`  homepage renders under 3:1 (need the lift): ${dark.length}`);
  console.log(`Wrote ${OUT}`);
}

// fileURLToPath, not a string compare against `file://${argv[1]}`: this repo
// lives under a path with a space, so import.meta.url is percent-encoded and
// the naive compare is never true. That exact bug kept audit:next's main
// guard silent for weeks — see CLAUDE.md.
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) main();
