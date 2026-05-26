#!/usr/bin/env node
// Pull boss portrait images from the OSRS Wiki via its MediaWiki API.
//
// Why an API call: the naive Special:FilePath/<Boss>.png URL fails on most
// bosses (Zulrah's main image is "Zulrah_(serpentine).png", not "Zulrah.png").
// The pageimages module returns whatever the wiki considers the lead image
// for that article — which is exactly what we want for a portrait.
//
// Boss list is generated from src/lib/bosses.ts so the sprite pack stays
// in sync as we add new bosses. Failures (no wiki page, no thumbnail) are
// logged but non-fatal — BossRow has a drop-sprite fallback for those.
//
// Run: node scripts/build-boss-sprites.mjs
// Output: public/sprites/bosses/<slug>.png

import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "sprites", "bosses");
const BOSSES_TS = join(__dirname, "..", "src", "lib", "bosses.ts");

// Some BOSSES slugs don't map 1:1 to the wiki page title. CoX is the page
// 'Chambers of Xeric' but we want the picture of 'Great Olm'; same for ToB
// and ToA. Anything not in this map falls back to the boss's `name` field.
const SLUG_TO_WIKI_PAGE = {
  cox: "Great Olm",
  tob: "Verzik Vitur",
  toa: "Tumeken's Warden",
  // wildy escalation alts share wiki pages with their solo cousins
  calvarion: "Calvar'ion",
  spindel: "Spindel",
  artio: "Artio",
  // KBD has two slugs in bosses.ts; both resolve to the same wiki page
  "king-black-dragon": "King Black Dragon",
  kbd: "King Black Dragon",
  // raid slugs alias the rooms we already cover
  "dks-rex":     "Dagannoth Rex",
  "dks-supreme": "Dagannoth Supreme",
  "dks-prime":   "Dagannoth Prime",
  // misc wildy clusters and minigame bosses with awkward names
  "fortis-colosseum": "Sol Heredit",
  "moons-of-peril":   "Lunar Chest",
  "guardians-of-the-rift": "The Great Guardian",
  "tzkal-zuk": "TzKal-Zuk",
  "tztok-jad": "TzTok-Jad",
  // Slayer-monster bosses (wiki uses spaces/hyphens differently)
  "demonic-gorillas": "Demonic gorilla",
  "thermonuclear":    "Thermonuclear smoke devil",
  // Wilderness archaeologists
  "crazy-archaeologist":     "Crazy archaeologist",
  "deranged-archaeologist":  "Deranged Archaeologist",
  // ToB encounters
  maiden:    "The Maiden of Sugadinti",
  bloat:     "Pestilent Bloat",
  nylo:      "Nylocas",
  sotetseg:  "Sotetseg",
  xarpus:    "Xarpus",
  verzik:    "Verzik Vitur",
  // CoX rooms
  olm:       "Great Olm",
  tekton:    "Tekton",
  muttadile: "Muttadile",
  vasa:      "Vasa Nistirio",
  vespula:   "Vespula",
  // ToA encounters
  akkha:   "Akkha",
  "ba-ba": "Ba-Ba",
  kephri:  "Kephri",
  zebak:   "Zebak",
  warden:  "Tumeken's Warden"
};

// ASCII-only UA — em-dashes break Node's HTTP header check.
const UA = "scapestack-boss-sprite-builder/1.0 (+https://scapestack.app - laurensbs@hotmail.com)";

// Parse the top-level `{ slug: "x", name: "Y" }` entries out of bosses.ts.
// Crude regex, but bosses.ts is hand-written and stable — no need for a
// full TS parser here.
async function readBossesFromSource() {
  const src = await readFile(BOSSES_TS, "utf8");
  const rows = [];
  // Match alle entries — top-level (2-space) én nested raid-room entries
  // (6-space). Vroeger skipte we de rooms maar de DPS-page rendert ze
  // als losse bosses dus ze hebben eigen sprites nodig (Olm, Maiden,
  // Akkha, etc).
  const re = /^\s+\{\s*slug:\s*"([a-z][a-z0-9-]+)",\s*name:\s*"([^"]+)"/gm;
  let m;
  const seen = new Set();
  while ((m = re.exec(src)) !== null) {
    const [, slug, name] = m;
    if (seen.has(slug)) continue;
    seen.add(slug);
    rows.push({ slug, page: SLUG_TO_WIKI_PAGE[slug] ?? name });
  }
  return rows;
}

async function fetchLeadImage(pageTitle) {
  // pithumbsize=800 — large enough to render crisply at the 440px hero
  // showcase frame on retina (which needs ~880px source). The old 400px
  // looked blurry once we removed the radial vignette that was hiding it.
  // Public/ folder stays well under 10MB total at this size.
  const url = `https://oldschool.runescape.wiki/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=800&format=json`;
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
  const bosses = await readBossesFromSource();
  console.log(`Pulling ${bosses.length} boss portraits to public/sprites/bosses/`);
  let ok = 0; let failed = 0; const fails = [];
  for (const entry of bosses) {
    try {
      if (await downloadOne(entry)) ok++;
    } catch (err) {
      console.error(`  ✗ ${entry.slug}: ${err.message}  (page: ${entry.page})`);
      fails.push(entry.slug);
      failed++;
    }
    // Be kind to the wiki — 600ms between requests (2x the skill-sprite
    // builder because each boss is 2 calls: API + image).
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(`\nDone. ${ok} ok, ${failed} failed.`);
  if (fails.length > 0) {
    console.log(`Slugs without a wiki portrait (BossRow will fall back to the drop sprite):`);
    for (const s of fails) console.log(`  ${s}`);
  }
  // Non-zero exit only when *all* failed — partial coverage is fine,
  // the fallback handles missing sprites.
  if (failed > 0 && ok === 0) process.exit(1);
}

main();
