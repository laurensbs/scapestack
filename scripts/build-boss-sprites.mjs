#!/usr/bin/env node
// Pull boss portrait images from the OSRS Wiki via its MediaWiki API.
//
// Why an API call: the naive Special:FilePath/<Boss>.png URL fails on most
// bosses (Zulrah's main image is "Zulrah_(serpentine).png", not "Zulrah.png").
// The pageimages module returns whatever the wiki considers the lead image
// for that article — which is exactly what we want for a portrait.
//
// Run: node scripts/build-boss-sprites.mjs
// Output: public/sprites/bosses/<slug>.png

import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "sprites", "bosses");

// (slug, wiki page title). The slug is what we use to look up the local
// file; the title is what the wiki has the page filed under.
const BOSSES = [
  { slug: "vorkath",   page: "Vorkath" },
  { slug: "zulrah",    page: "Zulrah" },
  { slug: "cox",       page: "Great Olm" },
  { slug: "tob",       page: "Verzik Vitur" },
  { slug: "toa",       page: "Tumeken's Warden" },
  { slug: "hydra",     page: "Alchemical Hydra" },
  { slug: "nex",       page: "Nex" },
  { slug: "vardorvis", page: "Vardorvis" }
];

// ASCII-only UA — em-dashes break Node's HTTP header check.
const UA = "scapestack-boss-sprite-builder/1.0 (+https://scapestack.app - laurensbs@hotmail.com)";

async function fetchLeadImage(pageTitle) {
  // pithumbsize=400 asks for a thumbnail capped at 400px — large enough to
  // look crisp at the 64px tile size with retina + 2x hover scale, small
  // enough to keep the public/ folder under ~200KB total.
  const url = `https://oldschool.runescape.wiki/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=400&format=json`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) throw new Error("no pages");
  const page = Object.values(pages)[0];
  if (!page?.thumbnail?.source) throw new Error("no thumbnail");
  return page.thumbnail.source;
}

async function fileExists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function downloadOne(entry) {
  const dest = join(OUT_DIR, `${entry.slug}.png`);
  if (await fileExists(dest)) {
    console.log(`  · ${entry.slug}: already on disk`);
    return true;
  }
  const imgUrl = await fetchLeadImage(entry.page);
  const res = await fetch(imgUrl, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  ✓ ${entry.slug}: ${buf.length} bytes  (${entry.page})`);
  return true;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Pulling ${BOSSES.length} boss portraits to public/sprites/bosses/`);
  let ok = 0; let failed = 0;
  for (const entry of BOSSES) {
    try {
      if (await downloadOne(entry)) ok++;
    } catch (err) {
      console.error(`  ✗ ${entry.slug}: ${err.message}`);
      failed++;
    }
    // Be kind to the wiki — 600ms between requests (2x the skill-sprite
    // builder because each boss is 2 calls: API + image).
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(`\nDone. ${ok} ok, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
